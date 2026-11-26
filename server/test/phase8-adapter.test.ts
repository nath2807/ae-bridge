import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { HostAdapter, CepHostAdapter, UxpHostAdapter } from "../src/adapter/index.js";
import { setCallDispatcher } from "../src/bridge.js";

describe("Phase 8 - UXP Future-Proofing & HostAdapter Abstraction", () => {
  let tmpDir: string;
  const originalEnv = process.env.AE_BRIDGE_HOME;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ae-adapter-test-"));
    process.env.AE_BRIDGE_HOME = tmpDir;
  });

  afterEach(async () => {
    setCallDispatcher(null);
    process.env.AE_BRIDGE_HOME = originalEnv;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("polymorphic interface adheres to HostAdapter contract", () => {
    const cep: HostAdapter = new CepHostAdapter();
    const uxp: HostAdapter = new UxpHostAdapter();

    expect(cep.engineType).toBe("CEP");
    expect(uxp.engineType).toBe("UXP");

    expect(typeof cep.connect).toBe("function");
    expect(typeof cep.disconnect).toBe("function");
    expect(typeof cep.call).toBe("function");
    expect(typeof cep.getStatus).toBe("function");
    expect(typeof cep.executeRawScript).toBe("function");

    expect(typeof uxp.connect).toBe("function");
    expect(typeof uxp.disconnect).toBe("function");
    expect(typeof uxp.call).toBe("function");
    expect(typeof uxp.getStatus).toBe("function");
    expect(typeof uxp.executeRawScript).toBe("function");
  });

  describe("CepHostAdapter", () => {
    it("reports CEP status and delegates calls via bridge", async () => {
      const adapter = new CepHostAdapter();
      const status = adapter.getStatus();
      expect(status.engineType).toBe("CEP");
      expect(status.hostName).toBe("AfterEffects");

      // Mock dispatcher for CEP calls
      setCallDispatcher(async (method, params) => {
        if (method === "ae_eval_script") {
          return { result: "eval-success: " + (params as any).script };
        }
        if (method === "ae_create_comp") {
          return { compId: 1, name: (params as any).compName };
        }
        return { ok: true };
      });

      const res = await adapter.call("ae_create_comp", { compName: "AdapterComp" });
      expect(res).toEqual({ compId: 1, name: "AdapterComp" });

      const scriptRes = await adapter.executeRawScript("app.version");
      expect(scriptRes).toContain("eval-success: app.version");
    });
  });

  describe("UxpHostAdapter", () => {
    it("reads manifest and validates network permissions", () => {
      const uxp = new UxpHostAdapter();
      const manifest = uxp.getManifest();
      expect(manifest.id).toBe("com.aebridge.uxp");
      expect(manifest.manifestVersion).toBe(5);

      expect(uxp.hasNetworkPermission("ws://127.0.0.1:8765")).toBe(true);
      expect(uxp.hasNetworkPermission("http://127.0.0.1:8766")).toBe(true);
      expect(uxp.hasNetworkPermission("http://malicious-external-site.com")).toBe(false);
    });

    it("enforces network permissions on connect()", async () => {
      const restrictedUxp = new UxpHostAdapter({
        requiredPermissions: {
          network: { domains: ["ws://127.0.0.1:9000"] }
        }
      });

      // Default port 8765 is not in whitelist
      await expect(restrictedUxp.connect(8765)).rejects.toThrow("UXP Security Violation");

      // Permitted port 9000 connects
      await restrictedUxp.connect(9000);
      expect(restrictedUxp.getStatus().connected).toBe(true);
      await restrictedUxp.disconnect();
      expect(restrictedUxp.getStatus().connected).toBe(false);
    });

    it("executes operations inside executeAsModal transaction wrapper", async () => {
      const uxp = new UxpHostAdapter();
      await uxp.connect();

      let modalExecuted = false;
      const res = await uxp.executeAsModal(
        async () => {
          modalExecuted = true;
          return "modal-done";
        },
        { title: "Test Modal Transaction" }
      );

      expect(modalExecuted).toBe(true);
      expect(res).toBe("modal-done");
    });

    it("prevents nested or concurrent executeAsModal calls", async () => {
      const uxp = new UxpHostAdapter();
      await uxp.connect();

      await expect(
        uxp.executeAsModal(
          async () => {
            // Nested modal call
            return await uxp.executeAsModal(
              async () => "nested",
              { title: "Nested Transaction" }
            );
          },
          { title: "Outer Transaction" }
        )
      ).rejects.toThrow(/Cannot execute modal 'Nested Transaction'/);
    });

    it("dispatches registered direct API handlers within executeAsModal", async () => {
      const uxp = new UxpHostAdapter();
      await uxp.connect();

      uxp.registerHandler("ae_create_shape", (params) => {
        return { shapeId: "shape_101", shapeType: params.type };
      });

      const res = await uxp.call("ae_create_shape", { type: "star" });
      expect(res).toEqual({ shapeId: "shape_101", shapeType: "star" });
    });

    it("executes modern ECMAScript via executeRawScript with V8 features", async () => {
      const uxp = new UxpHostAdapter();
      await uxp.connect();

      // Modern JS with arrow function, template literal, and array reduction
      const modernCode = `(() => {
        const numbers = [10, 20, 30, 40];
        const sum = numbers.reduce((acc, val) => acc + val, 0);
        return \`Total: \${sum}\`;
      })()`;

      const result = await uxp.executeRawScript(modernCode);
      expect(result).toBe("Total: 100");
    });

    it("reports comprehensive UXP status and V8 capabilities", async () => {
      const uxp = new UxpHostAdapter();
      await uxp.connect();

      const status = uxp.getStatus();
      expect(status.connected).toBe(true);
      expect(status.engineType).toBe("UXP");
      expect(status.capabilities).toContain("v8ModernJs");
      expect(status.capabilities).toContain("executeAsModal");
      expect(status.capabilities).toContain("directDomAccess");
    });
  });
});
