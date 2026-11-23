import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

export const BACKGROUND_TYPES = [
  "gradient",
  "radialGlow",
  "fractalClouds",
  "liquid",
  "grid",
  "stripes",
  "noiseTexture",
  "aurora"
] as const;

export function registerBackgroundTools(server: McpServer): void {
  // 1. ae_create_background
  server.tool(
    "ae_create_background",
    "Generate an animated procedural motion graphic background layer ('gradient', 'radialGlow', 'fractalClouds', 'liquid', 'grid', 'stripes', 'noiseTexture', 'aurora') placed at the bottom of the layer stack.",
    {
      compRef: compRefSchema.optional(),
      type: z.enum(BACKGROUND_TYPES).describe("Motion graphic background type"),
      colors: z.object({
        primary: colorSchema.optional().describe("Primary color theme"),
        secondary: colorSchema.optional().describe("Secondary / midtone color"),
        accent: colorSchema.optional().describe("Vibrant accent color"),
        background: colorSchema.optional().describe("Deep backdrop / void color")
      }).optional().describe("Custom color palette overrides"),
      animated: z.boolean().optional().default(true).describe("Whether to animate procedural evolution, drift, or scrolling (default true)"),
      duration: z.number().positive().optional().describe("Duration in seconds (default: composition duration)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_background", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
