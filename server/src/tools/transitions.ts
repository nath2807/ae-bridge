import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";

export function registerTransitionTools(server: McpServer): void {
  // 1. ae_add_transition
  server.tool(
    "ae_add_transition",
    "Add a smooth, high-impact motion graphic transition between two overlapping or adjacent layers in a composition.",
    {
      compRef: compRefSchema.optional(),
      layerA: layerRefSchema.describe("Outgoing layer"),
      layerB: layerRefSchema.describe("Incoming layer"),
      type: z.enum([
        "crossDissolve",
        "dipToBlack",
        "dipToWhite",
        "slideLeft",
        "slideRight",
        "pushUp",
        "zoomIn",
        "zoomBlur",
        "linearWipe",
        "radialWipe",
        "glitchCut",
        "whipPan"
      ]).describe("Transition type preset"),
      duration: z.number().positive().optional().default(0.5).describe("Transition duration in seconds (default 0.5)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_transition", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_list_transitions
  server.tool(
    "ae_list_transitions",
    "List all available video transition types with categories and animation descriptions.",
    {},
    async () => {
      try {
        const result = await callAE("ae_list_transitions", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
