import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";

export const LOOK_PRESETS = [
  "filmGrain",
  "vignette",
  "chromaticAberration",
  "vhs",
  "glitch",
  "neonGlow",
  "dreamy",
  "lightLeak",
  "filmBurn",
  "halftone",
  "posterizeTime",
  "scanlines",
  "bloom",
  "cinemaBars"
] as const;

export function registerLookTools(server: McpServer): void {
  // 1. ae_apply_look
  server.tool(
    "ae_apply_look",
    "Apply a polished stylistic look or film emulation effect stack to a layer, or across the whole composition as a top adjustment layer ('filmGrain', 'vignette', 'chromaticAberration', 'vhs', 'glitch', 'neonGlow', 'dreamy', 'lightLeak', 'filmBurn', 'halftone', 'posterizeTime', 'scanlines', 'bloom', 'cinemaBars').",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.optional().describe("Target layer to style. If omitted, generates a new full-comp adjustment layer on top"),
      look: z.enum(LOOK_PRESETS).describe("Stylistic look preset name"),
      intensity: z.number().min(0.05).max(10).optional().default(1).describe("Multiplier for effect parameters and intensity (default 1)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_apply_look", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_list_looks
  server.tool(
    "ae_list_looks",
    "List all available stylistic visual looks, film emulations, descriptions, and the effects used by each stack.",
    {},
    async () => {
      try {
        const result = await callAE("ae_list_looks", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
