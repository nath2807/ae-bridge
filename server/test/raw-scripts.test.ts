import { afterEach, describe, expect, it, vi } from "vitest";

const callAEMock = vi.hoisted(() => vi.fn());
vi.mock("../src/bridge.js", () => ({ callAE: callAEMock }));

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rawScriptsEnabled, registerCoreTools } from "../src/tools/core.js";

type ToolResult = { isError?: boolean; content: Array<{ type: string; text: string }> };
type ToolHandler = (args: { code: string }) => Promise<ToolResult>;

const handlers = new Map<string, ToolHandler>();
const server = {
  tool: (_name: string, _description: string, _schema: unknown, handler: ToolHandler) => {
    handlers.set(_name, handler);
  }
} as unknown as McpServer;

registerCoreTools(server);

afterEach(() => {
  vi.unstubAllEnvs();
  callAEMock.mockReset();
});

describe("raw ExtendScript opt-in", () => {
  it("is disabled unless the environment value is exactly true, case-insensitively", () => {
    vi.stubEnv("AE_BRIDGE_ALLOW_RAW_SCRIPTS", undefined);
    expect(rawScriptsEnabled()).toBe(false);
    vi.stubEnv("AE_BRIDGE_ALLOW_RAW_SCRIPTS", " true ");
    expect(rawScriptsEnabled()).toBe(false);
    vi.stubEnv("AE_BRIDGE_ALLOW_RAW_SCRIPTS", "TrUe");
    expect(rawScriptsEnabled()).toBe(true);
  });

  it("blocks execution in the tool handler unless explicitly enabled", async () => {
    vi.stubEnv("AE_BRIDGE_ALLOW_RAW_SCRIPTS", "false");
    const handler = handlers.get("ae_execute_extendscript");
    if (!handler) throw new Error("ae_execute_extendscript handler was not registered");

    const result = await handler({ code: "app.project" });
    expect(result.isError).toBe(true);
    expect(callAEMock).not.toHaveBeenCalled();
  });

  it("passes the explicit opt-in flag to the CEP dispatcher", async () => {
    vi.stubEnv("AE_BRIDGE_ALLOW_RAW_SCRIPTS", "TRUE");
    callAEMock.mockResolvedValue("ok");
    const handler = handlers.get("ae_execute_extendscript");
    if (!handler) throw new Error("ae_execute_extendscript handler was not registered");

    await handler({ code: "app.project" });
    expect(callAEMock).toHaveBeenCalledWith("executeScript", {
      code: "app.project",
      allowRawScripts: true
    });
  });
});
