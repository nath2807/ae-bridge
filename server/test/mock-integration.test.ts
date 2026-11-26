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
import { registerCompTools } from "../src/tools/comps.js";
import { registerLayerTools } from "../src/tools/layers.js";
import { registerAnimationTools } from "../src/tools/animation.js";
import { registerEffectTools } from "../src/tools/effects.js";
import { registerTitleTools } from "../src/tools/titles.js";
import { registerFootageTools } from "../src/tools/footage.js";
import { registerEditingTools } from "../src/tools/editing.js";
import { registerTransitionTools } from "../src/tools/transitions.js";
import { registerTimeTools } from "../src/tools/time.js";
import { registerAudioTools } from "../src/tools/audio.js";
import { registerColorTools } from "../src/tools/color.js";
import { registerScene3dTools } from "../src/tools/scene3d.js";
import { registerCameraTools } from "../src/tools/camera.js";
import { registerLightingTools } from "../src/tools/lighting.js";
import { registerSceneTools } from "../src/tools/scenes.js";
import { registerLookTools } from "../src/tools/looks.js";
import { registerParticleTools } from "../src/tools/particles.js";
import { registerBackgroundTools } from "../src/tools/backgrounds.js";
import { registerDistortTools } from "../src/tools/distort.js";
import { registerRigTools } from "../src/tools/rigs.js";
import { registerPreviewTools } from "../src/tools/preview.js";
import { registerQaTools } from "../src/tools/qa.js";
import { registerProjectTools } from "../src/tools/project.js";
import { registerRenderTools } from "../src/tools/render.js";
import { registerFormatTools } from "../src/tools/formats.js";
import { registerTemplateTools } from "../src/tools/templates.js";
import { registerAnalysisTools } from "../src/tools/analysis.js";
import { registerBrandTools } from "../src/director/brand.js";
import { registerStoryboardTools } from "../src/director/storyboard.js";
import { registerRecipeTools } from "../src/director/recipes.js";
import { registerQualityTools } from "../src/tools/quality.js";
import { registerMotionTools } from "../src/tools/motion.js";
import { registerFinishingTools } from "../src/tools/finishing.js";
import { registerReferenceTools } from "../src/tools/reference.js";
import { registerStyleTools } from "../src/director/styles.js";
import { registerBlenderTools } from "../src/tools/blender.js";
import { registerBlenderAETools } from "../src/tools/blenderAE.js";

describe("Mock-AE End-to-End Test Harness", () => {
  let tempHome: string;
  const originalHome = process.env.AE_BRIDGE_HOME;
  const testPort = 17765;
  let mockPanel: MockAEPanel;
  let client: Client;
  let server: McpServer;

  beforeEach(async () => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "ae-bridge-test-harness-"));
    process.env.AE_BRIDGE_HOME = tempHome;

    const token = getOrCreateAuthToken();
    await startBridge(testPort);

    mockPanel = new MockAEPanel();
    await mockPanel.connect(testPort, token);

    server = new McpServer({
      name: "ae-bridge-test",
      version: "1.3.0"
    });

    // Register all tool suites
    registerCoreTools(server);
    registerCompTools(server);
    registerLayerTools(server);
    registerAnimationTools(server);
    registerEffectTools(server);
    registerTitleTools(server);
    registerFootageTools(server);
    registerEditingTools(server);
    registerTransitionTools(server);
    registerTimeTools(server);
    registerAudioTools(server);
    registerColorTools(server);
    registerScene3dTools(server);
    registerCameraTools(server);
    registerLightingTools(server);
    registerSceneTools(server);
    registerLookTools(server);
    registerParticleTools(server);
    registerBackgroundTools(server);
    registerDistortTools(server);
    registerRigTools(server);
    registerPreviewTools(server);
    registerQaTools(server);
    registerProjectTools(server);
    registerRenderTools(server);
    registerFormatTools(server);
    registerTemplateTools(server);
    registerAnalysisTools(server);
    registerBrandTools(server);
    registerStoryboardTools(server);
    registerRecipeTools(server);
    registerQualityTools(server);
    registerMotionTools(server);
    registerStyleTools(server);
    registerFinishingTools(server);
    registerReferenceTools(server);
    registerBlenderTools(server);
    registerBlenderAETools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    mockPanel.disconnect();
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

  it("registers all tools with valid names, descriptions, and input schemas", async () => {
    const response = await client.listTools();
    const tools = response.tools;

    expect(tools.length).toBeGreaterThanOrEqual(166);

    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe("string");
      expect(tool.name.startsWith("ae_") || tool.name.startsWith("blender_")).toBe(true);

      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(10);

      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema).toBe("object");
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("executes ae_ping against the mock harness successfully", async () => {
    const res = await client.callTool({
      name: "ae_ping",
      arguments: {}
    });

    expect(res.isError).toBeFalsy();
    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe("text");
    const parsed = JSON.parse(content[0].text);
    expect(parsed.aeVersion).toBe("24.5.0");
    expect(parsed.projectName).toBe("MockProject.aep");
  });

  it("executes ae_get_project_info against the mock harness", async () => {
    const res = await client.callTool({
      name: "ae_get_project_info",
      arguments: {}
    });

    expect(res.isError).toBeFalsy();
    const content = res.content as Array<{ type: string; text: string }>;
    const comps = JSON.parse(content[0].text);
    expect(Array.isArray(comps)).toBe(true);
    expect(comps[0].name).toBe("MainComp");
  });

  it("executes ae_create_comp to mutate state in mock panel", async () => {
    const res = await client.callTool({
      name: "ae_create_comp",
      arguments: {
        name: "Mock 4K Hero",
        width: 3840,
        height: 2160,
        frameRate: 60,
        duration: 15
      }
    });

    expect(res.isError).toBeFalsy();
    const createdComp = mockPanel.state.comps.find((c) => c.name === "Mock 4K Hero");
    expect(createdComp).toBeDefined();
    expect(createdComp?.width).toBe(3840);
    expect(createdComp?.frameRate).toBe(60);
  });

  it("executes ae_bridge_status and reports live connected state and telemetry", async () => {
    const res = await client.callTool({
      name: "ae_bridge_status",
      arguments: {}
    });

    expect(res.isError).toBeFalsy();
    const content = res.content as Array<{ type: string; text: string }>;
    const status = JSON.parse(content[0].text);
    expect(status.connected).toBe(true);
    expect(status.protocolVersion).toBe(2);
    expect(status.panelVersion).toBe("1.3.0");
    expect(status.serverVersion).toBeDefined();
    expect(status.memory.rssMb).toBeGreaterThan(0);
  });

  it("propagates structured ExtendScript errors when mock panel reports failure", async () => {
    mockPanel.setError("ae_get_comp", {
      message: "Composition 'MissingComp' not found",
      name: "ReferenceError",
      line: 88,
      file: "comps.jsx"
    });

    const res = await client.callTool({
      name: "ae_get_comp",
      arguments: { compRef: { compName: "MissingComp" } }
    });

    expect(res.isError).toBe(true);
    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Composition 'MissingComp' not found");
  });
});
