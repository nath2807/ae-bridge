import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE, getBridgeStatus } from "../bridge.js";
import { searchToolsInCatalog, listProfilesInfo } from "./profiles.js";

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

  // 5. ae_batch
  server.tool(
    "ae_batch",
    "Execute multiple AE Bridge tool calls sequentially in a single round trip wrapped inside an undo group. Reduces latency and network overhead for multi-step operations.",
    {
      calls: z.array(
        z.object({
          tool: z.string().describe("Tool name to execute (e.g. 'ae_create_comp', 'ae_add_text')"),
          args: z.record(z.any()).optional().describe("Tool arguments/parameters")
        })
      ).min(1).describe("Ordered array of tool calls to execute sequentially")
    },
    async ({ calls }) => {
      try {
        const result = await callAE("batch", { calls });
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

  // 6. ae_search_tools
  server.tool(
    "ae_search_tools",
    "Search all available AE Bridge tools by keyword, tag, or category to discover tool capabilities, parameters, and profile assignments.",
    {
      query: z.string().optional().describe("Keyword to search in tool name and description"),
      tag: z.string().optional().describe("Optional tag filter (e.g. 'comps', 'layers', 'animation', 'render', 'blender', 'qa')"),
      category: z.string().optional().describe("Optional category name filter"),
      limit: z.number().int().min(1).max(100).optional().default(20).describe("Maximum number of results to return (default 20)")
    },
    async (params) => {
      const results = searchToolsInCatalog(params);
      return {
        content: [{ type: "text", text: formatResult(results) }]
      };
    }
  );

  // 7. ae_list_profiles
  server.tool(
    "ae_list_profiles",
    "List active and available tool profiles ('minimal', 'standard', 'blender', 'full') with their descriptions, active status, and tool counts. Profiles reduce token overhead by exposing only the tools relevant to the current task.",
    {},
    async () => {
      const info = listProfilesInfo();
      return {
        content: [{ type: "text", text: formatResult(info) }]
      };
    }
  );
}
