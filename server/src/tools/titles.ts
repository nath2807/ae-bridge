import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

export function registerTitleTools(server: McpServer): void {
  // 1. ae_create_title_card
  server.tool(
    "ae_create_title_card",
    "Create a complete cinematic title card composition with typography, gold/color accent, atmosphere background, and coordinated animations.",
    {
      compName: z.string().optional().describe("Composition name (default: title + ' — Title Card')"),
      title: z.string().describe("Main title text to display (e.g. 'THE LAST SIGNAL')"),
      subtitle: z.string().optional().describe("Subtitle text to display below the title (e.g. 'A film by Alex Rivera')"),
      accentColor: colorSchema.optional().describe("Accent element color (hex or [r,g,b] array, default gold '#D4AF37')"),
      titleColor: colorSchema.optional().describe("Main title text color (default platinum white '#F5F5F7')"),
      subtitleColor: colorSchema.optional().describe("Subtitle text color (default matches accentColor)"),
      bgColor: colorSchema.optional().describe("Background atmosphere color (default '#08090D')"),
      accentStyle: z.enum(["line", "bar", "box", "glow", "none"]).optional().default("line").describe("Style of visual accent element"),
      style: z.enum(["cinematic", "minimal", "bold", "dramatic", "neon"]).optional().default("cinematic").describe("Overall aesthetic style preset"),
      width: z.number().int().positive().optional().default(1920).describe("Width in pixels (default 1920)"),
      height: z.number().int().positive().optional().default(1080).describe("Height in pixels (default 1080)"),
      duration: z.number().positive().optional().default(8).describe("Duration in seconds (default 8)"),
      frameRate: z.number().positive().optional().default(24).describe("Frame rate in fps (default 24)"),
      animate: z.boolean().optional().default(true).describe("Whether to generate professional push-in, reveal, and fade animations")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_title_card", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_create_lower_third
  server.tool(
    "ae_create_lower_third",
    "Create a broadcast-quality lower third composition or layer group in bar, modern, or boxed style.",
    {
      compName: z.string().optional().describe("Composition name (default: name + ' — Lower Third')"),
      compRef: compRefSchema.optional().describe("Optional reference to an existing composition to add the lower third into"),
      name: z.string().describe("Primary name text (e.g. 'Alex Rivera')"),
      title: z.string().optional().describe("Secondary role/title text (e.g. 'Motion Designer')"),
      style: z.enum(["bar", "minimal", "boxed", "modern", "line"]).optional().default("bar").describe("Visual style preset of the lower third"),
      accentColor: colorSchema.optional().describe("Accent bar color (default gold '#D4AF37')"),
      primaryColor: colorSchema.optional().describe("Primary text color (default '#FFFFFF')"),
      secondaryColor: colorSchema.optional().describe("Secondary text color (default '#D4AF37')"),
      plateColor: colorSchema.optional().describe("Background container plate color (default '#0F141F')"),
      plateOpacity: z.number().min(0).max(100).optional().default(92).describe("Plate opacity percentage (0-100)"),
      position: z.array(z.number()).min(2).max(2).optional().describe("Anchor [x, y] position in pixels (default lower-left [260, 880])"),
      width: z.number().int().positive().optional().default(1920).describe("Width in pixels (default 1920)"),
      height: z.number().int().positive().optional().default(1080).describe("Height in pixels (default 1080)"),
      duration: z.number().positive().optional().default(6).describe("Duration in seconds (default 6)"),
      frameRate: z.number().positive().optional().default(30).describe("Frame rate in fps (default 30)"),
      animate: z.boolean().optional().default(true).describe("Whether to generate intro wipe, hold, and outro resolve animations")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_lower_third", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_apply_title_preset
  server.tool(
    "ae_apply_title_preset",
    "Apply high-level title styling or motion preset to a text layer ('fadeIn', 'fadeOut', 'slideInLeft', 'slideInRight', 'slideInUp', 'slideInDown', 'scalePop', 'spinIn', 'blurIn', 'typewriter', 'cinematicPush', 'trackingOut').",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target text layer"),
      preset: z.enum([
        "fadeUpChars",
        "blurReveal",
        "trackingCollapse",
        "popWords",
        "typewriter",
        "flip3D",
        "slideMaskUp",
        "glitchIn",
        "scaleDownSettle",
        "lineByLine",
        "fadeIn",
        "fadeOut",
        "slideInLeft",
        "slideInRight",
        "slideInUp",
        "slideInDown",
        "scalePop",
        "spinIn",
        "blurIn",
        "cinematicPush",
        "trackingOut"
      ]).describe("Title motion preset"),
      startTime: z.number().min(0).optional().default(0).describe("Start time in seconds (default 0)"),
      duration: z.number().positive().optional().default(0.6).describe("Duration in seconds (default 0.6)"),
      options: z.record(z.any()).optional().describe("Optional animation tuning parameters (e.g. tracking, blur, rotations)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_apply_title_preset", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_add_text_animator
  server.tool(
    "ae_add_text_animator",
    "Add an After Effects Text Animator group with custom animated properties (opacity, tracking, position, scale, rotation, blur, color) and Range or Wiggly selectors.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target text layer"),
      name: z.string().optional().default("Text Animator").describe("Name of the animator group"),
      properties: z.object({
        opacity: z.number().min(0).max(100).optional().describe("Target opacity (0-100)"),
        position: z.union([z.number(), z.array(z.number())]).optional().describe("Target position offset [x, y] or [x, y, z]"),
        scale: z.union([z.number(), z.array(z.number())]).optional().describe("Target scale offset [x, y] or uniform percentage"),
        tracking: z.number().optional().describe("Tracking amount offset"),
        rotation: z.number().optional().describe("Rotation angle in degrees"),
        blur: z.union([z.number(), z.array(z.number())]).optional().describe("Blur dimensions [x, y] or uniform pixels"),
        fillColor: colorSchema.optional().describe("Fill color override")
      }).describe("Map of animator properties to add"),
      selectorType: z.enum(["range", "wiggly"]).optional().default("range").describe("Selector type"),
      basedOn: z.enum(["characters", "charactersExcludingSpaces", "words", "lines"]).optional().default("characters").describe("Units selection basis"),
      start: z.number().min(0).max(100).optional().describe("Selector start percentage (0-100)"),
      end: z.number().min(0).max(100).optional().describe("Selector end percentage (0-100)"),
      offset: z.number().min(-100).max(100).optional().describe("Selector offset percentage (-100 to 100)"),
      animate: z.object({
        property: z.enum(["start", "end", "offset"]).describe("Selector parameter to animate"),
        from: z.number().describe("Initial parameter value"),
        to: z.number().describe("Final parameter value"),
        startTime: z.number().min(0).describe("Animation start time in seconds"),
        duration: z.number().positive().describe("Animation duration in seconds")
      }).optional().describe("Optional keyframed selector animation specification")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_text_animator", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
