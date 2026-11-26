import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "./schemas.js";

export function registerSceneGraphTools(server: McpServer): void {
  // 1. ae_export_scene_graph
  server.tool(
    "ae_export_scene_graph",
    "Export an entire After Effects composition into a clean, portable JSON scene graph (comp settings, layer stack, types, transforms, text styles, solids, effects, and parenting relationships).",
    {
      compRef: compRefSchema.optional()
    },
    async (params) => {
      try {
        const result = await callAE("ae_export_scene_graph", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_apply_scene_graph
  server.tool(
    "ae_apply_scene_graph",
    "Construct or reconstruct a composition from a portable JSON scene graph schema inside a single undo group.",
    {
      scene: z.object({
        comp: z.object({
          name: z.string().optional(),
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional(),
          duration: z.number().positive().optional(),
          frameRate: z.number().positive().optional(),
          bgColor: z.array(z.number()).min(3).max(3).optional()
        }).optional(),
        layers: z.array(z.record(z.any())).describe("List of layer specifications in the scene graph")
      }).describe("Scene graph payload describing the composition and its layers")
    },
    async (params) => {
      try {
        const result = await callAE("ae_apply_scene_graph", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
