import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { findAerenderExecutable } from "../src/render/locator.js";
import {
  startRenderJob,
  getRenderJob,
  listRenderJobs,
  cancelRenderJob,
  killAllRenderJobs,
  loadAllRenderJobs
} from "../src/render/jobs.js";
import { registerRenderTools } from "../src/tools/render.js";
import { registerCompTools } from "../src/tools/comps.js";
import { startBridge, stopBridge, getOrCreateAuthToken } from "../src/bridge.js";
import { MockAEPanel } from "./harness/mock-panel.js";

describe("Phase 6 Non-Blocking Render Pipeline", () => {
  let tempHome: string;
  const originalHome = process.env.AE_BRIDGE_HOME;
  const originalAerenderPath = process.env.AERENDER_PATH;
  const mockScriptPath = path.resolve(__dirname, "fixtures/mock-aerender.js");
  const testPort = 19767;
  let mockPanel: MockAEPanel;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "ae-bridge-p6-test-"));
    process.env.AE_BRIDGE_HOME = tempHome;
    mockPanel = new MockAEPanel();
  });

  afterEach(async () => {
    killAllRenderJobs();
    mockPanel.disconnect();
    await stopBridge();

    if (originalHome) {
      process.env.AE_BRIDGE_HOME = originalHome;
    } else {
      delete process.env.AE_BRIDGE_HOME;
    }

    if (originalAerenderPath) {
      process.env.AERENDER_PATH = originalAerenderPath;
    } else {
      delete process.env.AERENDER_PATH;
    }

    try {
      fs.rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("1. Locator: findAerenderExecutable respects AERENDER_PATH override", () => {
    process.env.AERENDER_PATH = mockScriptPath;
    const exe = findAerenderExecutable();
    expect(exe).toBe(mockScriptPath);

    process.env.AERENDER_PATH = path.join(tempHome, "non-existent-aerender.exe");
    expect(findAerenderExecutable()).toBeNull();
  });

  it("2. Spawner & Persistence: starts aerender background job and tracks frame progress to completion", async () => {
    // Configure mock aerender runner using node executable and script
    // On Windows, node can run the mock script
    const nodeExe = process.execPath;
    // Create a shell wrapper or batch/cmd script pointing to node mock-aerender.js
    const wrapperPath = path.join(tempHome, process.platform === "win32" ? "aerender_mock.bat" : "aerender_mock.sh");
    if (process.platform === "win32") {
      fs.writeFileSync(wrapperPath, `@echo off\r\n"${nodeExe}" "${mockScriptPath}" %*`);
    } else {
      fs.writeFileSync(wrapperPath, `#!/bin/sh\n"${nodeExe}" "${mockScriptPath}" "$@"`);
      fs.chmodSync(wrapperPath, 0o755);
    }
    process.env.AERENDER_PATH = wrapperPath;

    const outputPath = path.join(tempHome, "render_test.mp4").replace(/\\/g, "/");

    const job = startRenderJob({
      compName: "Main Comp",
      outputPath,
      preset: "mp4High",
      startFrame: 1,
      endFrame: 10
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe("running");
    expect(job.outputPath).toBe(outputPath);

    // Verify stored on disk in $AE_BRIDGE_HOME/render_jobs.json
    const diskJobs = loadAllRenderJobs();
    expect(diskJobs[job.id]).toBeDefined();
    expect(diskJobs[job.id].compName).toBe("Main Comp");

    // Wait for the mock process to complete (~250ms)
    let finalJob = getRenderJob(job.id);
    const startWait = Date.now();
    while (finalJob && finalJob.status === "running" && Date.now() - startWait < 3000) {
      await new Promise((r) => setTimeout(r, 50));
      finalJob = getRenderJob(job.id);
    }

    expect(finalJob?.status).toBe("completed");
    expect(finalJob?.progress.percent).toBe(100);
    expect(finalJob?.progress.currentFrame).toBe(10);
    expect(finalJob?.logTail.length).toBeGreaterThan(0);
  });

  it("3. Cancellation: cancels running aerender background job", async () => {
    // Create a mock script that runs indefinitely
    const slowScript = path.join(tempHome, "slow.js");
    fs.writeFileSync(slowScript, `
      console.log("PROGRESS: Frame 1 of 1000");
      setInterval(() => {
        console.log("PROGRESS: Frame 2 of 1000");
      }, 500);
    `);

    const nodeExe = process.execPath;
    const wrapperPath = path.join(tempHome, process.platform === "win32" ? "slow_mock.bat" : "slow_mock.sh");
    if (process.platform === "win32") {
      fs.writeFileSync(wrapperPath, `@echo off\r\n"${nodeExe}" "${slowScript}" %*`);
    } else {
      fs.writeFileSync(wrapperPath, `#!/bin/sh\n"${nodeExe}" "${slowScript}" "$@"`);
      fs.chmodSync(wrapperPath, 0o755);
    }
    process.env.AERENDER_PATH = wrapperPath;

    const job = startRenderJob({
      compName: "Slow Comp",
      outputPath: path.join(tempHome, "slow.mp4")
    });

    expect(job.status).toBe("running");

    const cancelled = cancelRenderJob(job.id);
    expect(cancelled).toBe(true);

    const updated = getRenderJob(job.id);
    expect(updated?.status).toBe("cancelled");
  });

  it("4. MCP Tools: ae_render_job_start, ae_render_job_status, and ae_render_job_list work over client protocol", async () => {
    const nodeExe = process.execPath;
    const wrapperPath = path.join(tempHome, process.platform === "win32" ? "mcp_mock.bat" : "mcp_mock.sh");
    if (process.platform === "win32") {
      fs.writeFileSync(wrapperPath, `@echo off\r\n"${nodeExe}" "${mockScriptPath}" %*`);
    } else {
      fs.writeFileSync(wrapperPath, `#!/bin/sh\n"${nodeExe}" "${mockScriptPath}" "$@"`);
      fs.chmodSync(wrapperPath, 0o755);
    }
    process.env.AERENDER_PATH = wrapperPath;

    const server = new McpServer({ name: "test-render-mcp", version: "1.0.0" });
    registerRenderTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // 1. Start job
    const startRes = await client.callTool({
      name: "ae_render_job_start",
      arguments: {
        compName: "MCP Render Comp",
        preset: "mp4High",
        outputPath: path.join(tempHome, "mcp_render.mp4").replace(/\\/g, "/")
      }
    });

    expect(startRes.isError).toBeFalsy();
    const startData = JSON.parse((startRes.content as any)[0].text);
    expect(startData.id).toBeDefined();
    expect(startData.status).toBe("running");

    const jobId = startData.id;

    // 2. Query status
    const statusRes = await client.callTool({
      name: "ae_render_job_status",
      arguments: { jobId }
    });
    expect(statusRes.isError).toBeFalsy();
    const statusData = JSON.parse((statusRes.content as any)[0].text);
    expect(statusData.id).toBe(jobId);

    // 3. List jobs
    const listRes = await client.callTool({
      name: "ae_render_job_list",
      arguments: { limit: 10 }
    });
    expect(listRes.isError).toBeFalsy();
    const listData = JSON.parse((listRes.content as any)[0].text);
    expect(listData.count).toBeGreaterThan(0);
    expect(listData.jobs.some((j: any) => j.id === jobId)).toBe(true);

    await client.close();
  });
});
