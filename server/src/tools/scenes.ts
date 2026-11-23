import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

export function registerSceneTools(server: McpServer): void {
  // 1. ae_create_3d_text
  server.tool(
    "ae_create_3d_text",
    "Generate a complete cinematic 3D extruded text scene with typography, bevels, physical materials, lighting rig, camera animation, and shadow-catching floor.",
    {
      compRef: compRefSchema.optional(),
      text: z.string().describe("Main 3D text title content"),
      font: z.string().optional().describe("Optional PostScript font name or family"),
      color: colorSchema.optional().describe("Text front face color (hex string or [r, g, b] array)"),
      depth: z.number().min(0).optional().default(40).describe("Extrusion depth in pixels (default 40)"),
      bevel: z.boolean().optional().default(true).describe("Whether to apply convex edge beveling"),
      metal: z.boolean().optional().default(false).describe("Whether to apply a high-reflectivity metallic material finish"),
      lighting: z.enum(["threePoint", "dramatic", "neon", "studio", "sunset", "moody", "soft"]).optional().default("dramatic").describe("Lighting aesthetic rig"),
      cameraMove: z.enum(["orbit", "orbitHalf", "dollyIn", "pushIn", "flyThrough", "spiral", "parallaxDrift"]).optional().default("pushIn").describe("Cinematic camera motion preset"),
      floor: z.boolean().optional().default(false).describe("Whether to generate a 3D reflective floor plate receiving shadows"),
      duration: z.number().positive().optional().default(6).describe("Scene duration in seconds (default 6)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_3d_text", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_create_3d_scene
  server.tool(
    "ae_create_3d_scene",
    "Generate an authored high-level 3D motion graphics scene ('extrudedLogoReveal', 'floatingCards', 'cubeGrid', 'infiniteTunnel', 'layeredParallax', 'orbitingShowcase', 'helixText').",
    {
      compRef: compRefSchema.optional(),
      preset: z.enum([
        "extrudedLogoReveal",
        "floatingCards",
        "cubeGrid",
        "infiniteTunnel",
        "layeredParallax",
        "orbitingShowcase",
        "helixText"
      ]).describe("3D scene design preset"),
      text: z.string().optional().describe("Title or typography content for the scene"),
      colors: z.object({
        primary: colorSchema.optional(),
        secondary: colorSchema.optional(),
        accent: colorSchema.optional()
      }).optional().describe("Color palette overrides"),
      duration: z.number().positive().optional().default(8).describe("Scene duration in seconds (default 8)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_3d_scene", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_list_3d_presets
  server.tool(
    "ae_list_3d_presets",
    "List all available high-level 3D motion graphics scene presets with their design descriptions.",
    {},
    async () => {
      try {
        const result = await callAE("ae_list_3d_presets", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
