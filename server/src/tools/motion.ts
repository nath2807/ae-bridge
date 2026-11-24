import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, propertyPathSchema, toolSuccess, toolError } from "./schemas.js";

export function registerMotionTools(server: McpServer): void {
  // 1. ae_apply_motion_curve
  server.tool(
    "ae_apply_motion_curve",
    "Re-ease existing keyframes on a layer property using high-end named motion curves ('expoOut', 'expoInOut', 'quintOut', 'backOut' with overshoot, 'snap', 'smooth', 'heavy', 'elasticOut', 'linear').",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer possessing keyframes"),
      path: propertyPathSchema.describe("Property path (e.g. 'position', 'scale', 'opacity', or ['Transform', 'Position'])"),
      curve: z.enum([
        "expoOut",
        "expoInOut",
        "quintOut",
        "backOut",
        "snap",
        "smooth",
        "heavy",
        "elasticOut",
        "linear"
      ]).describe("Named motion curve to apply")
    },
    async (params) => {
      try {
        const result = await callAE("ae_apply_motion_curve", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_stagger
  server.tool(
    "ae_stagger",
    "Offset layer start times in sequence for natural cascading visual entrance and rhythmic motion choreography.",
    {
      compRef: compRefSchema.optional(),
      layerRefs: z.array(layerRefSchema).min(1).describe("Ordered array of layer references to stagger"),
      delay: z.number().min(0).max(5).optional().default(0.06).describe("Time delay offset in seconds between consecutive layers (default 0.06s)"),
      order: z.enum(["forward", "reverse", "center", "random"]).optional().default("forward").describe("Staggering cascade order: 'forward' (top to bottom), 'reverse', 'center' (midpoint radiating out), or 'random'")
    },
    async (params) => {
      try {
        const result = await callAE("ae_stagger", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
