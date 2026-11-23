import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";

export function registerColorTools(server: McpServer): void {
  // 1. ae_color_grade
  server.tool(
    "ae_color_grade",
    "Apply cinematic Lumetri color grading parameters (exposure, contrast, highlights, shadows, saturation, temperature, tint, vibrance) to any clip or adjustment layer.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target video clip or adjustment layer to grade"),
      exposure: z.number().optional().describe("Exposure compensation in stops (e.g. -1.0 to +1.0)"),
      contrast: z.number().optional().describe("Contrast adjustment (-100 to +100)"),
      highlights: z.number().optional().describe("Highlight recovery/boost (-100 to +100)"),
      shadows: z.number().optional().describe("Shadow lift/crush (-100 to +100)"),
      saturation: z.number().min(0).optional().describe("Color saturation percentage (0 = black & white, 100 = neutral, 200 = hyper-saturated)"),
      temperature: z.number().optional().describe("White balance color temperature (-100 cool/blue to +100 warm/amber)"),
      tint: z.number().optional().describe("White balance tint (-100 green to +100 magenta)"),
      vibrance: z.number().optional().describe("Smart skin-tone protective vibrance (-100 to +100)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_color_grade", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_apply_lut
  server.tool(
    "ae_apply_lut",
    "Load and apply a 3D LUT (.cube, .3dl, .look) file to a layer using After Effects' native Apply Color LUT effect.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target video clip or adjustment layer"),
      lutPath: z.string().describe("Absolute file path to the 3D LUT file (.cube, .3dl)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_apply_lut", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_add_adjustment_grade
  server.tool(
    "ae_add_adjustment_grade",
    "Add a master adjustment layer on top of the composition with a curated cinematic color look preset.",
    {
      compRef: compRefSchema.optional(),
      look: z.enum([
        "cinematic",
        "tealOrange",
        "warm",
        "cool",
        "bw",
        "vintage",
        "highContrast"
      ]).describe("Curated color grading aesthetic preset")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_adjustment_grade", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
