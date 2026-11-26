import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import {
  acquireHubOrProxy,
  readLockFile,
  removeLockFile,
  isPidAlive,
  getLockFilePath
} from "../src/hub/lock.js";
import {
  startHubIpcServer,
  stopHubIpcServer,
  startProxyClient,
  stopProxyClient,
  callHubProxy
} from "../src/hub/ipc.js";
import { startHttpBridge } from "../src/hub/http.js";
import { startBridge, stopBridge, getOrCreateAuthToken } from "../src/bridge.js";
import { MockAEPanel } from "./harness/mock-panel.js";
import { handleConfig, resolveClientConfigPath } from "../src/cli.js";

describe("Phase 4 Multi-Client Hub & Proxy Architecture", () => {
  let tempHome: string;
  let tempWorkspace: string;
  const originalHome = process.env.AE_BRIDGE_HOME;
  const originalCwd = process.cwd();
  const testPort = 16765;
  const testIpcPort = 16766;
  const testHttpPort = 16767;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "ae-bridge-test-hub-"));
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ae-bridge-test-ws-"));
    process.env.AE_BRIDGE_HOME = tempHome;
    process.chdir(tempWorkspace);
  });

  afterEach(async () => {
    stopProxyClient();
    await stopHubIpcServer();
    await stopBridge();
    removeLockFile();

    process.chdir(originalCwd);
    if (originalHome !== undefined) {
      process.env.AE_BRIDGE_HOME = originalHome;
    } else {
      delete process.env.AE_BRIDGE_HOME;
    }

    try {
      fs.rmSync(tempHome, { recursive: true, force: true });
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {}
  });

  it("1. Hub lockfile: first process acquires Hub role, writes lockfile, detects live PID", async () => {
    expect(isPidAlive(process.pid)).toBe(true);
    expect(isPidAlive(99999999)).toBe(false);

    const { isHub, hubInfo } = await acquireHubOrProxy(testPort, testIpcPort);
    expect(isHub).toBe(true);
    expect(hubInfo.pid).toBe(process.pid);
    expect(hubInfo.port).toBe(testPort);

    const lockOnDisk = readLockFile();
    expect(lockOnDisk).toBeDefined();
    expect(lockOnDisk?.pid).toBe(process.pid);
  });

  it("2. Proxy Routing: proxy client dispatches calls through Hub IPC server", async () => {
    const token = getOrCreateAuthToken();

    // 1. Start Hub bridge and Hub IPC server
    await startBridge(testPort);
    await startHubIpcServer(testIpcPort);

    // 2. Mock panel connects to Hub
    const mockPanel = new MockAEPanel();
    await mockPanel.connect(testPort, token);

    // 3. Proxy client connects to Hub IPC
    await startProxyClient(testIpcPort, token);

    // 4. Proxy dispatches tool call
    const result: any = await callHubProxy("ping", {});
    expect(result).toBeDefined();
    expect(result.aeVersion).toBe("24.5.0");
    expect(result.projectName).toBe("MockProject.aep");

    mockPanel.disconnect();
  });

  it("3. HTTP Bridge: responds to GET /health and POST /call with bearer token", async () => {
    const token = getOrCreateAuthToken();
    await startBridge(testPort);

    const mockPanel = new MockAEPanel();
    await mockPanel.connect(testPort, token);

    const httpServer = await startHttpBridge(testHttpPort, token);

    // Test GET /health with token
    const healthRes = await new Promise<{ status: number; body: any }>((resolve) => {
      http.get(
        `http://127.0.0.1:${testHttpPort}/health`,
        { headers: { Authorization: `Bearer ${token}` } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ status: res.statusCode || 0, body: JSON.parse(data) }));
        }
      );
    });

    expect(healthRes.status).toBe(200);
    expect(healthRes.body.connected).toBe(true);

    // Test GET /health without token (should be 401)
    const unauthorizedRes = await new Promise<number>((resolve) => {
      http.get(`http://127.0.0.1:${testHttpPort}/health`, (res) => {
        resolve(res.statusCode || 0);
      });
    });
    expect(unauthorizedRes).toBe(401);

    // Test POST /call
    const callRes = await new Promise<{ status: number; body: any }>((resolve) => {
      const req = http.request(
        `http://127.0.0.1:${testHttpPort}/call`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ status: res.statusCode || 0, body: JSON.parse(data) }));
        }
      );
      req.write(JSON.stringify({ method: "ping", params: {} }));
      req.end();
    });

    expect(callRes.status).toBe(200);
    expect(callRes.body.ok).toBe(true);
    expect(callRes.body.result.aeVersion).toBe("24.5.0");

    mockPanel.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("4. CLI config: writes workspace configuration with automatic backups", () => {
    const wsTarget = resolveClientConfigPath("antigravity", "workspace");
    expect(wsTarget.includes(".antigravity")).toBe(true);

    // Initial write
    handleConfig({ client: "antigravity", write: true, workspace: true });
    expect(fs.existsSync(wsTarget)).toBe(true);
    const content1 = JSON.parse(fs.readFileSync(wsTarget, "utf-8"));
    expect(content1.mcpServers["ae-bridge"]).toBeDefined();

    // Second write should create a backup file
    handleConfig({ client: "antigravity", write: true, workspace: true });
    const dirFiles = fs.readdirSync(path.dirname(wsTarget));
    const backupFiles = dirFiles.filter((f) => f.includes(".backup."));
    expect(backupFiles.length).toBeGreaterThanOrEqual(1);
  });
});
