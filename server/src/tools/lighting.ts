import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

export function registerLightingTools(server: McpServer): void {
  // 1. ae_setup_lighting
  server.tool(
    "ae_setup_lighting",
    "Deploy a complete 3D lighting rig preset ('threePoint', 'dramatic', 'neon', 'studio', 'sunset', 'moody', 'soft') with configured key, fill, rim lights and shadow parameters.",
    {
      compRef: compRefSchema.optional(),
      preset: z.enum([
        "threePoint",
        "dramatic",
        "neon",
        "studio",
        "sunset",
        "moody",
        "soft"
      ]).describe("Lighting aesthetic preset"),
      shadows: z.boolean().optional().default(true).describe("Whether scene lights should cast physical shadows")
    },
    async (params) => {
      try {
        const result = await callAE("ae_setup_lighting", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_set_light
  server.tool(
    "ae_set_light",
    "Fine-tune light parameters (intensity, color, cone angle, cone feather, shadows, shadow darkness, shadow diffusion) on any light layer.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target light layer"),
      intensity: z.number().min(0).optional().describe("Light intensity percentage (default 100%)"),
      color: colorSchema.optional().describe("Light emission color (hex string or [r, g, b] array)"),
      coneAngle: z.number().min(0).max(180).optional().describe("Spotlight cone angle in degrees (0 - 180)"),
      coneFeather: z.number().min(0).max(100).optional().describe("Spotlight cone edge feather percentage (0 - 100)"),
      castsShadows: z.boolean().optional().describe("Enable or disable shadow casting"),
      shadowDarkness: z.number().min(0).max(100).optional().describe("Shadow density percentage (0 - 100)"),
      shadowDiffusion: z.number().min(0).optional().describe("Soft shadow edge penumbra diffusion in pixels")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_light", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_add_environment_light
  server.tool(
    "ae_add_environment_light",
    "Add an Image-Based Lighting (IBL) Environment Light to illuminate 3D models and extruded objects with HDR reflections (After Effects 2024+ Advanced 3D).",
    {
      compRef: compRefSchema.optional(),
      hdriItemId: z.number().int().optional().describe("Optional project item ID of an HDRI or EXR panorama footage item"),
      intensity: z.number().min(0).optional().default(100).describe("Environment lighting emission intensity percentage")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_environment_light", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
