import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { WebSocket } from "ws";
import { getAeBridgeHome, CSXS_VERSIONS, CANONICAL_EXTENSION_NAME } from "../src/utils/paths.js";
import { getAuthTokenPath, getOrCreateAuthToken, startBridge, stopBridge, callAE, isConnected } from "../src/bridge.js";
import { getBrandConfigPath } from "../src/director/brand.js";
import { getStateFilePath } from "../src/director/styles.js";
import { getJobsStorageDir } from "../src/blender/jobs.js";
import { runDiagnostics } from "../src/cli.js";

describe("Phase 1 Defects & Regression Suite", () => {
  let tempHome: string;
  const originalHome = process.env.AE_BRIDGE_HOME;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "ae-bridge-test-home-"));
    process.env.AE_BRIDGE_HOME = tempHome;
  });

  afterEach(async () => {
    await stopBridge();
    if (originalHome !== undefined) {
      process.env.AE_BRIDGE_HOME = originalHome;
    } else {
      delete process.env.AE_BRIDGE_HOME;
    }
    try {
      fs.rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("DEC-001: honors AE_BRIDGE_HOME environment variable for isolation", () => {
    const home = getAeBridgeHome();
    expect(home).toBe(tempHome);

    const tokenPath = getAuthTokenPath();
    expect(tokenPath.startsWith(tempHome)).toBe(true);

    const brandPath = getBrandConfigPath();
    expect(brandPath.startsWith(tempHome)).toBe(true);

    const statePath = getStateFilePath();
    expect(statePath.startsWith(tempHome)).toBe(true);

    const jobsDir = getJobsStorageDir();
    expect(jobsDir.startsWith(tempHome)).toBe(true);
  });

  it("DEC-002: canonical extension name is com.aebridge and covers CSXS 10-13", () => {
    expect(CANONICAL_EXTENSION_NAME).toBe("com.aebridge");
    expect(CSXS_VERSIONS).toEqual(["10", "11", "12", "13"]);
  });

  it("B3: runDiagnostics executes honest checks and does not create token file as side effect", async () => {
    const tokenPath = getAuthTokenPath();
    expect(fs.existsSync(tokenPath)).toBe(false);

    const report = await runDiagnostics();
    expect(report).toBeDefined();
    expect(typeof report.ok).toBe("boolean");
    expect(Array.isArray(report.checks)).toBe(true);

    // Verify token was NOT created by diagnostics
    expect(fs.existsSync(tokenPath)).toBe(false);

    // Verify check IDs
    const checkIds = report.checks.map((c) => c.id);
    expect(checkIds).toContain("node_version");
    expect(checkIds).toContain("port_status");
    expect(checkIds).toContain("cep_installed");
    expect(checkIds).toContain("player_debug_mode");
    expect(checkIds).toContain("auth_token");
    expect(checkIds).toContain("sharp_library");
    expect(checkIds).toContain("csinterface_integrity");
  });

  it("B13: bridge rejects browser origins and timing-safely authenticates valid tokens", async () => {
    const testPort = 18765;
    const token = getOrCreateAuthToken();
    expect(fs.existsSync(getAuthTokenPath())).toBe(true);

    await startBridge(testPort);

    // 1. Connection with browser origin should be closed/rejected
    const browserWs = new WebSocket(`ws://127.0.0.1:${testPort}`, {
      headers: { Origin: "http://malicious-website.com" }
    });

    const browserRejected = await new Promise<boolean>((resolve) => {
      browserWs.on("close", (code) => {
        resolve(code === 4003 || code === 1006);
      });
      browserWs.on("open", () => {
        // Send auth to see if closed
        browserWs.send(JSON.stringify({ type: "auth", token }));
      });
      setTimeout(() => resolve(false), 2000);
    });
    expect(browserRejected).toBe(true);

    // 2. Connection with wrong token should fail authentication
    const badWs = new WebSocket(`ws://127.0.0.1:${testPort}`);
    const badAuthFailed = await new Promise<boolean>((resolve) => {
      badWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_failed") {
          resolve(true);
        }
      });
      badWs.on("open", () => {
        badWs.send(JSON.stringify({ type: "auth", token: "invalid_hex_token_1234567890abcdef" }));
      });
      setTimeout(() => resolve(false), 2000);
    });
    expect(badAuthFailed).toBe(true);
    badWs.close();

    // 3. Connection with valid token succeeds
    const goodWs = new WebSocket(`ws://127.0.0.1:${testPort}`);
    const goodAuthOk = await new Promise<boolean>((resolve) => {
      goodWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          resolve(true);
        }
      });
      goodWs.on("open", () => {
        goodWs.send(JSON.stringify({ type: "auth", token }));
      });
      setTimeout(() => resolve(false), 2000);
    });
    expect(goodAuthOk).toBe(true);
    expect(isConnected()).toBe(true);

    // 4. B4: Pending call is rejected when socket disconnects
    const pendingCallPromise = callAE("ping", {}, 10000);
    goodWs.close();

    await expect(pendingCallPromise).rejects.toThrow(/disconnected while executing 'ping'/);
  });

  it("B11: stopBridge cleans up active sockets and server", async () => {
    const testPort = 18766;
    await startBridge(testPort);
    expect(async () => {
      await stopBridge();
    }).not.toThrow();
    expect(isConnected()).toBe(false);
  });
});
