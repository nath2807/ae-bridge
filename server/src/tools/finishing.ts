import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "./schemas.js";
import { getResolvedStyle } from "../director/styles.js";

export function registerFinishingTools(server: McpServer): void {
  // 1. ae_finish_pass
  server.tool(
    "ae_finish_pass",
    "Apply a high-end compositing finishing pass on top of a composition in a toggleable 'FINISH' group (depth haze, light wrap, bloom & glow, chromatic aberration, film grain matched to resolution, vignette, color grade matching style palette, optional halation and anamorphic streak flare, foreground dust particles and background atmosphere).",
    {
      compRef: compRefSchema.optional(),
      level: z.enum(["subtle", "rich", "extreme"]).optional().default("rich").describe("Finishing intensity level: 'subtle' for refined minimalism, 'rich' for balanced broadcast master, 'extreme' for heavy stylized look"),
      style: z.string().optional().describe("Style identifier (e.g. 'cinematicNoir', 'neonCyber', 'minimalPremium'). If omitted, the currently active style is used.")
    },
    async (params) => {
      try {
        const resolvedStyle = getResolvedStyle(params.style, false);
        const result = await callAE("ae_finish_pass", {
          compRef: params.compRef,
          level: params.level || "rich",
          style: resolvedStyle
        });
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_remove_finish_pass
  server.tool(
    "ae_remove_finish_pass",
    "Remove all finishing pass adjustment layers, particles, and controllers from a composition.",
    {
      compRef: compRefSchema.optional()
    },
    async (params) => {
      try {
        const result = await callAE("ae_remove_finish_pass", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
