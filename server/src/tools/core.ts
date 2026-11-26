import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE, getBridgeStatus } from "../bridge.js";

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
      if (process.env.AE_BRIDGE_ALLOW_RAW_SCRIPTS === "false") {
        return {
          content: [
            {
              type: "text",
              text: "ae_execute_extendscript is disabled by configuration (AE_BRIDGE_ALLOW_RAW_SCRIPTS=false). Use dedicated ae_* tools instead."
            }
          ],
          isError: true
        };
      }
      try {
        const result = await callAE("executeScript", { code });
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

  // 4. ae_bridge_status
  server.tool(
    "ae_bridge_status",
    "Inspect the health, connection status, round-trip latency, queue depth, and memory telemetry of the AE Bridge connection.",
    {},
    async () => {
      const status = getBridgeStatus();
      return {
        content: [{ type: "text", text: formatResult(status) }]
      };
    }
  );
}
