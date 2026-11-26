import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { WebSocket } from "ws";
import {
  startBridge,
  stopBridge,
  callAE,
  getBridgeStatus,
  isConnected,
  getOrCreateAuthToken,
  PROTOCOL_VERSION
} from "../src/bridge.js";
import { BridgeError } from "../src/utils/errors.js";
import { logger } from "../src/utils/logger.js";
import { getAeBridgeHome } from "../src/utils/paths.js";

describe("Phase 2 Protocol & Reliability Test Suite", () => {
  let tempHome: string;
  const originalHome = process.env.AE_BRIDGE_HOME;
  const testPort = 19765;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "ae-bridge-test-p2-"));
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

  it("1. Protocol v2: rejects protocolVersion 1 and accepts protocolVersion 2 with capabilities", async () => {
    const token = getOrCreateAuthToken();
    await startBridge(testPort);

    // Connecting with protocolVersion 1 (legacy) should fail
    const legacyWs = new WebSocket(`ws://127.0.0.1:${testPort}`);
    const legacyResult = await new Promise<any>((resolve) => {
      legacyWs.on("message", (raw) => {
        resolve(JSON.parse(raw.toString()));
      });
      legacyWs.on("open", () => {
        legacyWs.send(JSON.stringify({
          type: "auth",
          token,
          protocolVersion: 1
        }));
      });
    });

    expect(legacyResult.type).toBe("auth_failed");
    expect(legacyResult.error).toContain("Protocol version mismatch");

    // Connecting with protocolVersion 2 should succeed
    const v2Ws = new WebSocket(`ws://127.0.0.1:${testPort}`);
    const v2Result = await new Promise<any>((resolve) => {
      v2Ws.on("message", (raw) => {
        resolve(JSON.parse(raw.toString()));
      });
      v2Ws.on("open", () => {
        v2Ws.send(JSON.stringify({
          type: "auth",
          token,
          protocolVersion: PROTOCOL_VERSION,
          panelVersion: "1.3.0",
          capabilities: ["ping", "batch"]
        }));
      });
    });

    expect(v2Result.type).toBe("auth_ok");
    expect(v2Result.protocolVersion).toBe(2);
    expect(v2Result.capabilities).toContain("priorityQueue");
    expect(v2Result.capabilities).toContain("heartbeat");

    v2Ws.close();
  });

  it("2. Heartbeat: handles bidirectional heartbeat ping and pong", async () => {
    const token = getOrCreateAuthToken();
    await startBridge(testPort);

    const clientWs = new WebSocket(`ws://127.0.0.1:${testPort}`);
    await new Promise<void>((resolve) => {
      clientWs.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth_ok") resolve();
      });
      clientWs.on("open", () => {
        clientWs.send(JSON.stringify({
          type: "auth",
          token,
          protocolVersion: 2,
          panelVersion: "1.3.0"
        }));
      });
    });

    // Client sends heartbeat_ping, expects heartbeat_pong
    const clientTimestamp = Date.now();
    const pongResult = await new Promise<any>((resolve) => {
      clientWs.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "heartbeat_pong") {
          resolve(msg);
        }
      });
      clientWs.send(JSON.stringify({
        type: "heartbeat_ping",
        timestamp: clientTimestamp
      }));
    });

    expect(pongResult.type).toBe("heartbeat_pong");
    expect(pongResult.timestamp).toBe(clientTimestamp);

    clientWs.close();
  });

  it("3. Priority Queue: sequences calls and respects priorities (system > user > batch)", async () => {
    const token = getOrCreateAuthToken();
    await startBridge(testPort);

    const clientWs = new WebSocket(`ws://127.0.0.1:${testPort}`);
    const receivedDispatches: string[] = [];

    clientWs.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && msg.method) {
        receivedDispatches.push(msg.method);
        // Reply with success
        setTimeout(() => {
          clientWs.send(JSON.stringify({
            id: msg.id,
            ok: true,
            result: { method: msg.method }
          }));
        }, 50);
      }
    });

    await new Promise<void>((resolve) => {
      clientWs.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth_ok") resolve();
      });
      clientWs.on("open", () => {
        clientWs.send(JSON.stringify({
          type: "auth",
          token,
          protocolVersion: 2
        }));
      });
    });

    // Enqueue 3 calls: batch first, then user, then system
    // Due to priority ordering, system should run before subsequent queued items
    const p1 = callAE("call_first_batch", {}, { priority: "batch" });
    const p2 = callAE("call_second_batch", {}, { priority: "batch" });
    const p3 = callAE("call_third_system", {}, { priority: "system" });
    const p4 = callAE("call_fourth_user", {}, { priority: "user" });

    await Promise.all([p1, p2, p3, p4]);

    // First call was already dispatched immediately when queue was empty
    expect(receivedDispatches[0]).toBe("call_first_batch");
    // Next available items were sorted by priority: system (0) -> user (1) -> batch (2)
    expect(receivedDispatches[1]).toBe("call_third_system");
    expect(receivedDispatches[2]).toBe("call_fourth_user");
    expect(receivedDispatches[3]).toBe("call_second_batch");

    clientWs.close();
  });

  it("4. Structured ExtendScript errors are mapped to BridgeError with file and line", async () => {
    const token = getOrCreateAuthToken();
    await startBridge(testPort);

    const clientWs = new WebSocket(`ws://127.0.0.1:${testPort}`);
    clientWs.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && msg.method === "failingCall") {
        clientWs.send(JSON.stringify({
          id: msg.id,
          ok: false,
          error: "Composition index out of range",
          errorName: "RangeError",
          line: 142,
          file: "comps.jsx",
          stack: "$.global.aeBridge.handlers.getComp\ncomps.jsx:142"
        }));
      }
    });

    await new Promise<void>((resolve) => {
      clientWs.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth_ok") resolve();
      });
      clientWs.on("open", () => {
        clientWs.send(JSON.stringify({
          type: "auth",
          token,
          protocolVersion: 2
        }));
      });
    });

    try {
      await callAE("failingCall", {});
      expect.fail("Expected call to throw BridgeError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(BridgeError);
      expect(err.name).toBe("BridgeError");
      expect(err.errorName).toBe("RangeError");
      expect(err.line).toBe(142);
      expect(err.file).toBe("comps.jsx");
      expect(err.message).toContain("Composition index out of range (comps.jsx:142)");
    }

    clientWs.close();
  });

  it("5. Telemetry & ae_bridge_status returns health report", async () => {
    const token = getOrCreateAuthToken();
    await startBridge(testPort);

    const clientWs = new WebSocket(`ws://127.0.0.1:${testPort}`);
    await new Promise<void>((resolve) => {
      clientWs.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth_ok") resolve();
      });
      clientWs.on("open", () => {
        clientWs.send(JSON.stringify({
          type: "auth",
          token,
          protocolVersion: 2,
          panelVersion: "1.3.0",
          capabilities: ["ping", "batch"]
        }));
      });
    });

    const status = getBridgeStatus();
    expect(status.connected).toBe(true);
    expect(status.protocolVersion).toBe(2);
    expect(status.panelVersion).toBe("1.3.0");
    expect(status.serverVersion).toBeDefined();
    expect(status.memory.rssMb).toBeGreaterThan(0);
    expect(typeof status.queueDepth).toBe("number");

    clientWs.close();
  });

  it("6. Rotating logger writes to AE_BRIDGE_HOME/logs/bridge.log", () => {
    logger.info("Test log entry for Phase 2 verification");
    const logFile = path.join(getAeBridgeHome(), "logs", "bridge.log");
    expect(fs.existsSync(logFile)).toBe(true);
    const content = fs.readFileSync(logFile, "utf-8");
    expect(content).toContain("[INFO]");
    expect(content).toContain("Test log entry for Phase 2 verification");
  });

  it("7. Non-disruptive doctor_ping probe responds without closing active panel", async () => {
    const token = getOrCreateAuthToken();
    await startBridge(testPort);

    // Active panel connects
    const panelWs = new WebSocket(`ws://127.0.0.1:${testPort}`);
    panelWs.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && msg.method === "ping") {
        panelWs.send(JSON.stringify({
          id: msg.id,
          ok: true,
          result: { aeVersion: "24.5", projectName: "Showcase.aep" }
        }));
      }
    });

    await new Promise<void>((resolve) => {
      panelWs.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth_ok") resolve();
      });
      panelWs.on("open", () => {
        panelWs.send(JSON.stringify({
          type: "auth",
          token,
          protocolVersion: 2
        }));
      });
    });

    expect(isConnected()).toBe(true);

    // Diagnostic probe connects separately
    const probeWs = new WebSocket(`ws://127.0.0.1:${testPort}`);
    const probeResult = await new Promise<any>((resolve) => {
      probeWs.on("message", (raw) => {
        resolve(JSON.parse(raw.toString()));
      });
      probeWs.on("open", () => {
        probeWs.send(JSON.stringify({
          type: "doctor_ping",
          token
        }));
      });
    });

    expect(probeResult.type).toBe("doctor_pong");
    expect(probeResult.connected).toBe(true);
    expect(probeResult.aeVersion).toBe("24.5");
    expect(probeResult.projectName).toBe("Showcase.aep");

    // The primary panel connection remains active and connected!
    expect(isConnected()).toBe(true);

    panelWs.close();
  });
});
