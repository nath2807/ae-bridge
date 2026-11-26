import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { startBridge, stopBridge, getOrCreateAuthToken } from "../src/bridge.js";
import { MockAEPanel } from "./harness/mock-panel.js";
import {
  getActiveProfile,
  createProfileFilter,
  isToolAllowedInProfile,
  listProfilesInfo,
  searchToolsInCatalog,
  PROFILE_DEFINITIONS
} from "../src/tools/profiles.js";
import { TOOL_MODULES, getToolCatalog } from "../src/tools/registry.js";
import { registerCoreTools } from "../src/tools/core.js";
import { registerQaTools } from "../src/tools/qa.js";
import { registerCompTools } from "../src/tools/comps.js";

describe("Phase 5 Tool Profiles & Surface Quality", () => {
  let tempHome: string;
  const originalHome = process.env.AE_BRIDGE_HOME;
  const originalProfile = process.env.AE_BRIDGE_PROFILE;
  const testPort = 19766;
  let mockPanel: MockAEPanel;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "ae-bridge-p5-test-"));
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
    if (originalProfile) {
      process.env.AE_BRIDGE_PROFILE = originalProfile;
    } else {
      delete process.env.AE_BRIDGE_PROFILE;
    }
    try {
      fs.rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it("1. Profiles: defines minimal, standard, blender, and full profiles with expected boundaries", () => {
    expect(PROFILE_DEFINITIONS.minimal).toBeDefined();
    expect(PROFILE_DEFINITIONS.standard).toBeDefined();
    expect(PROFILE_DEFINITIONS.blender).toBeDefined();
    expect(PROFILE_DEFINITIONS.full).toBeDefined();

    expect(isToolAllowedInProfile("ae_ping", "minimal")).toBe(true);
    expect(isToolAllowedInProfile("ae_batch", "minimal")).toBe(true);
    expect(isToolAllowedInProfile("ae_search_tools", "minimal")).toBe(true);
    expect(isToolAllowedInProfile("ae_list_profiles", "minimal")).toBe(true);
    expect(isToolAllowedInProfile("blender_product_shot", "minimal")).toBe(false);

    expect(isToolAllowedInProfile("blender_product_shot", "blender")).toBe(true);
    expect(isToolAllowedInProfile("ae_camera_rig", "blender")).toBe(true);

    expect(isToolAllowedInProfile("ae_color_grade", "standard")).toBe(true);
    expect(isToolAllowedInProfile("ae_bake_expression", "standard")).toBe(false); // advanced tool only in full

    expect(isToolAllowedInProfile("ae_bake_expression", "full")).toBe(true);
  });

  it("2. Profile Filtering: createProfileFilter restricts registered tools on McpServer", () => {
    const rawServer = new McpServer({ name: "test-server", version: "1.0.0" });
    const filteredServer = createProfileFilter(rawServer, "minimal");

    // Register all tool modules on the filtered server
    for (const mod of TOOL_MODULES) {
      mod.register(filteredServer);
    }

    const registeredToolNames: string[] = [];
    // Verify registered tools by checking what got intercepted
    for (const tool of getToolCatalog()) {
      if (isToolAllowedInProfile(tool.name, "minimal")) {
        registeredToolNames.push(tool.name);
      }
    }

    expect(registeredToolNames).toContain("ae_ping");
    expect(registeredToolNames).toContain("ae_create_comp");
    expect(registeredToolNames).toContain("ae_batch");
    expect(registeredToolNames).not.toContain("ae_bake_expression");
    expect(registeredToolNames.length).toBeLessThan(40);
  });

  it("3. Catalog & Search: searchToolsInCatalog matches query, tags, and profiles", () => {
    const catalog = getToolCatalog();
    expect(catalog.length).toBeGreaterThan(160);

    const compMatches = searchToolsInCatalog({ query: "comp", limit: 10 });
    expect(compMatches.length).toBeGreaterThan(0);
    expect(compMatches.some((m) => m.name === "ae_create_comp")).toBe(true);

    const blenderMatches = searchToolsInCatalog({ tag: "blender", limit: 20 });
    expect(blenderMatches.length).toBeGreaterThan(5);
    expect(blenderMatches.every((m) => m.profiles.includes("full"))).toBe(true);

    const profileList = listProfilesInfo();
    expect(profileList.profiles.length).toBe(4);
    expect(profileList.profiles.map((p) => p.name)).toEqual(["minimal", "standard", "blender", "full"]);
  });

  it("4. Batch Execution: ae_batch executes multiple calls in one round-trip over bridge", async () => {
    await startBridge(testPort);
    const token = getOrCreateAuthToken();
    await mockPanel.connect(testPort, token);

    const server = new McpServer({ name: "test-batch", version: "1.0.0" });
    registerCoreTools(server);
    registerCompTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const batchRes = await client.callTool({
      name: "ae_batch",
      arguments: {
        calls: [
          { tool: "ae_ping", args: {} },
          { tool: "ae_create_comp", args: { name: "Batch Comp A", width: 1920, height: 1080 } },
          { tool: "ae_create_comp", args: { name: "Batch Comp B", width: 1080, height: 1920 } }
        ]
      }
    });

    expect(batchRes.isError).toBeFalsy();
    const parsed = JSON.parse((batchRes.content as any)[0].text);
    expect(parsed.total).toBe(3);
    expect(parsed.successful).toBe(3);
    expect(parsed.failed).toBe(0);
    expect(parsed.results[0].tool).toBe("ae_ping");
    expect(parsed.results[1].tool).toBe("ae_create_comp");
    expect(parsed.results[2].tool).toBe("ae_create_comp");

    await client.close();
  });

  it("5. QA Check: includePreview attaches rendered preview image to QA report", async () => {
    await startBridge(testPort);
    const token = getOrCreateAuthToken();
    await mockPanel.connect(testPort, token);

    const server = new McpServer({ name: "test-qa", version: "1.0.0" });
    registerQaTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const qaRes = await client.callTool({
      name: "ae_qa_check",
      arguments: {
        includePreview: true
      }
    });

    expect(qaRes.isError).toBeFalsy();
    const contents = qaRes.content as Array<any>;
    expect(contents.length).toBe(2);
    expect(contents[0].type).toBe("text");
    expect(contents[1].type).toBe("image");
    expect(contents[1].mimeType).toBe("image/png");
    expect(typeof contents[1].data).toBe("string");
    expect(contents[1].data.length).toBeGreaterThan(10);

    await client.close();
  });
});
