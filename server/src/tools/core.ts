import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";

export function rawScriptsEnabled(): boolean {
  return process.env.AE_BRIDGE_ALLOW_RAW_SCRIPTS?.toLowerCase() === "true";
}

function formatResult(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function registerCoreTools(server: McpServer): void {
  // 1. ae_ping
  server.tool(
    "ae_ping",
    "Ping After Effects to check connection, version, and active project.",
    {},
    async () => {
      try {
        const result = await callAE("ping", {});
        return {
          content: [{ type: "text", text: formatResult(result) }]
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: (err as Error).message }],
          isError: true
        };
      }
    }
  );

  // 2. ae_get_project_info
  server.tool(
    "ae_get_project_info",
    "Get information about the open project and compositions in After Effects.",
    {},
    async () => {
      try {
        const result = await callAE("getProjectInfo", {});
        return {
          content: [{ type: "text", text: formatResult(result) }]
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: (err as Error).message }],
          isError: true
        };
      }
    }
  );

  // 3. ae_execute_extendscript
  server.tool(
    "ae_execute_extendscript",
    "LAST RESORT: run raw ExtendScript only when no dedicated ae_ tool can do the job.",
    {
      code: z.string().describe("ExtendScript code to execute in After Effects")
    },
    async ({ code }) => {
      if (!rawScriptsEnabled()) {
        return {
          content: [
            {
              type: "text",
              text: "ae_execute_extendscript is disabled by default. Set AE_BRIDGE_ALLOW_RAW_SCRIPTS=true to enable it. Use dedicated ae_* tools instead."
            }
          ],
          isError: true
        };
      }
      try {
        const result = await callAE("executeScript", { code, allowRawScripts: true });
        return {
          content: [{ type: "text", text: formatResult(result) }]
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: (err as Error).message }],
          isError: true
        };
      }
    }
  );
}
