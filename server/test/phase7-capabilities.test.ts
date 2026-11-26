import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { startBridge, stopBridge, getOrCreateAuthToken } from "../src/bridge.js";
import { MockAEPanel } from "./harness/mock-panel.js";

import { registerCoreTools } from "../src/tools/core.js";
import { registerAnimationTools } from "../src/tools/animation.js";
import { registerSceneGraphTools } from "../src/tools/scenegraph.js";
import { registerVisionTools, analyzeFrameBuffer } from "../src/tools/vision.js";
import { registerCaptionTools, parseSrt } from "../src/tools/captions.js";
import { registerTemplateTools, parseCsvData } from "../src/tools/templates.js";
import { registerBlenderTools } from "../src/tools/blender.js";
import { registerBlenderAETools } from "../src/tools/blenderAE.js";
import { validateSceneSpec } from "../src/blender/spec.js";

describe("Phase 7 Major Capability Leap", () => {
  let tempHome: string;
  const originalHome = process.env.AE_BRIDGE_HOME;
  const testPort = 19768;
  let mockPanel: MockAEPanel;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "ae-bridge-p7-test-"));
    process.env.AE_BRIDGE_HOME = tempHome;
    mockPanel = new MockAEPanel();
  });

  afterEach(async () => {
    mockPanel.disconnect();
    await stopBridge();

    if (originalHome) {
      process.env.AE_BRIDGE_HOME = originalHome;
    } else {
      delete process.env.AE_BRIDGE_HOME;
    }

    try {
      fs.rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("1. Introspection & Undo: ae_describe_property_tree and ae_undo", async () => {
    await startBridge(testPort);
    const token = getOrCreateAuthToken();
    await mockPanel.connect(testPort, token);

    const server = new McpServer({ name: "test-intro", version: "1.0.0" });
    registerCoreTools(server);
    registerAnimationTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // Introspect property tree
    const treeRes = await client.callTool({
      name: "ae_describe_property_tree",
      arguments: {
        layerRef: { layerName: "Text Layer" },
        maxDepth: 3
      }
    });

    expect(treeRes.isError).toBeFalsy();
    const treeData = JSON.parse((treeRes.content as any)[0].text);
    expect(treeData.tree).toBeDefined();
    expect(treeData.tree.name).toBe("Transform");
    expect(treeData.tree.children[0].name).toBe("Position");
    expect(treeData.tree.children[0].numKeys).toBe(2);

    // Undo action
    const undoRes = await client.callTool({
      name: "ae_undo",
      arguments: { steps: 2 }
    });
    expect(undoRes.isError).toBeFalsy();
    const undoData = JSON.parse((undoRes.content as any)[0].text);
    expect(undoData.success).toBe(true);
    expect(undoData.stepsUndone).toBe(2);

    await client.close();
  });

  it("2. Scene Graph: ae_export_scene_graph and ae_apply_scene_graph", async () => {
    await startBridge(testPort);
    const token = getOrCreateAuthToken();
    await mockPanel.connect(testPort, token);

    const server = new McpServer({ name: "test-sg", version: "1.0.0" });
    registerSceneGraphTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // Export scene graph
    const exportRes = await client.callTool({
      name: "ae_export_scene_graph",
      arguments: {}
    });
    expect(exportRes.isError).toBeFalsy();
    const exportData = JSON.parse((exportRes.content as any)[0].text);
    expect(exportData.version).toBe("1.3");
    expect(exportData.comp.width).toBe(1920);
    expect(exportData.layers.length).toBeGreaterThan(0);

    // Apply scene graph
    const applyRes = await client.callTool({
      name: "ae_apply_scene_graph",
      arguments: {
        scene: exportData
      }
    });
    expect(applyRes.isError).toBeFalsy();
    const applyData = JSON.parse((applyRes.content as any)[0].text);
    expect(applyData.success).toBe(true);
    expect(applyData.compId).toBe(42);

    await client.close();
  });

  it("3. Data-Driven MOGRT & CSV Replace: parseCsvData and ae_batch_csv_replace", async () => {
    await startBridge(testPort);
    const token = getOrCreateAuthToken();
    await mockPanel.connect(testPort, token);

    const csvSample = `id,Title,Subtitle,AccentColor\nclientA,Summer Sale,Up to 50% off,#ff3366\nclientB,Winter Warmth,Buy 1 Get 1,#33ccff`;
    const parsedRows = parseCsvData(csvSample, "id");
    expect(parsedRows.length).toBe(2);
    expect(parsedRows[0].suffix).toBe("clientA");
    expect(parsedRows[0].texts.Title).toBe("Summer Sale");
    expect(parsedRows[0].colors?.AccentColor).toBe("#ff3366");

    const server = new McpServer({ name: "test-csv", version: "1.0.0" });
    registerTemplateTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const batchRes = await client.callTool({
      name: "ae_batch_csv_replace",
      arguments: {
        csvData: csvSample,
        suffixColumn: "id"
      }
    });
    expect(batchRes.isError).toBeFalsy();
    const batchData = JSON.parse((batchRes.content as any)[0].text);
    expect(batchData.csvRowsProcessed).toBe(2);
    expect(batchData.totalGenerated).toBe(2);

    await client.close();
  });

  it("4. Vision Metrics with Sharp: analyzeFrameBuffer and ae_measure_frame", async () => {
    // Generate a test 100x100 PNG with sharp
    const sharp = (await import("sharp")).default;
    const testImageBuf = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 120, g: 150, b: 180 }
      }
    }).png().toBuffer();

    const metrics = await analyzeFrameBuffer(testImageBuf);
    expect(metrics.width).toBe(100);
    expect(metrics.height).toBe(100);
    expect(metrics.meanBrightness).toBeGreaterThan(100);
    expect(metrics.meanBrightness).toBeLessThan(180);
    expect(metrics.clipping.blackPercent).toBe(0);
    expect(metrics.clipping.whitePercent).toBe(0);
    expect(metrics.dominantColors.length).toBeGreaterThan(0);
  });

  it("5. Audio Captions: parseSrt and ae_transcribe_audio", async () => {
    const srtText = `1\n00:00:01,000 --> 00:00:03,500\nWelcome to AE Bridge\n\n2\n00:00:03,600 --> 00:00:06,000\nDynamic motion graphics`;
    const segments = parseSrt(srtText);
    expect(segments.length).toBe(2);
    expect(segments[0].text).toBe("Welcome to AE Bridge");
    expect(segments[0].start).toBe(1);
    expect(segments[0].end).toBe(3.5);
    expect(segments[1].start).toBe(3.6);

    const server = new McpServer({ name: "test-caps", version: "1.0.0" });
    registerCaptionTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const res = await client.callTool({
      name: "ae_transcribe_audio",
      arguments: {
        rawTranscript: srtText
      }
    });

    expect(res.isError).toBeFalsy();
    const data = JSON.parse((res.content as any)[0].text);
    expect(data.source).toBe("raw_transcript");
    expect(data.count).toBe(2);
    expect(data.segments[0].text).toBe("Welcome to AE Bridge");

    await client.close();
  });

  it("6. Blender 3D Upgrades: validateSceneSpec validates denoiser, turntable, and spec schema", () => {
    const validSpec = {
      frames: { start: 1, end: 60, fps: 30 },
      resolution: [1920, 1080],
      engine: "cycles",
      quality: "final",
      denoiser: "optix",
      camera: {
        lens: 85,
        move: "turntable",
        turntable: {
          radius: 6.0,
          height: 1.5,
          revolutions: 1.5,
          target: [0, 0, 0]
        }
      },
      objects: [
        {
          id: "cube",
          kind: "primitive",
          params: { type: "cube", size: 1.0 },
          material: { preset: "gold" }
        }
      ]
    };

    const result = validateSceneSpec(validSpec);
    expect(result.valid).toBe(true);
    expect(result.spec?.denoiser).toBe("optix");
    expect(result.spec?.camera.turntable?.radius).toBe(6.0);

    const invalidSpec = {
      frames: { start: -5 }
    };
    const invalidResult = validateSceneSpec(invalidSpec);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors && invalidResult.errors.length).toBeGreaterThan(0);
  });
});
