import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "../tools/schemas.js";
import { getActiveBrandDefaults } from "./brand.js";

export const transitionInSchema = z.object({
  type: z.string().describe("Transition effect type (crossDissolve, dipToWhite, dipToBlack, slideLeft, pushUp, zoomIn, linearWipe, glitchCut, whipPan)"),
  duration: z.number().min(0.05).max(10).optional().default(0.5).describe("Transition duration in seconds")
});

export const sceneEffectSchema = z.object({
  kind: z.enum(["look", "particles", "lightEffect", "rig", "distortion"]).describe("Category of effect to apply"),
  name: z.string().describe("Effect or rig preset name (e.g. 'filmGrain', 'vignette', 'lightSweep', 'sparkles', 'goldenEmbers', 'bounce', 'cameraShake')"),
  options: z.record(z.any()).optional().describe("Optional effect parameters")
});

export const sceneContentSchema = z.object({
  text: z.string().optional().describe("Primary headline text"),
  subtitle: z.string().optional().describe("Secondary text, subtitle, or role"),
  itemId: z.number().int().optional().describe("Project item ID of footage, image, or audio asset"),
  path: z.string().optional().describe("Absolute file path to media asset"),
  sourceIn: z.number().min(0).optional().describe("Source in-point time in seconds for video footage"),
  speed: z.number().optional().describe("Playback speed multiplier"),
  preset: z.string().optional().describe("Preset animation or graphic style"),
  style: z.string().optional().describe("Aesthetic theme variant (e.g. 'tech', 'bold', 'minimal', 'neon')"),
  colors: z.record(z.any()).optional().describe("Custom scene colors override"),
  camera: z.record(z.any()).optional().describe("Camera motion or framing options")
});

export const sceneSchema = z.object({
  type: z.enum([
    "title",
    "footage",
    "text",
    "lowerThird",
    "3dText",
    "3dScene",
    "background",
    "logoReveal",
    "counter",
    "quote",
    "endCard"
  ]).describe("Scene category"),
  duration: z.number().min(0.2).max(300).describe("Scene duration in seconds"),
  transitionIn: transitionInSchema.optional().describe("Incoming transition from previous scene"),
  content: sceneContentSchema.default({}).describe("Scene text, media, and design attributes"),
  effects: z.array(sceneEffectSchema).optional().describe("Visual effects, looks, rigs, or particles")
});

export const storyboardMusicSchema = z.object({
  itemId: z.number().int().optional().describe("Project item ID of audio footage"),
  path: z.string().optional().describe("File path to audio soundtrack file"),
  fadeOut: z.number().min(0).optional().describe("Fade-out duration in seconds at end of timeline"),
  beatSync: z.boolean().optional().default(false).describe("Whether to detect audio peaks and align scene cuts")
});

export const storyboardOutputSchema = z.object({
  aspect: z.string().describe("Target aspect ratio (e.g. '16:9', '9:16', '1:1')"),
  preset: z.string().describe("Render output template preset (e.g. 'mp4High', 'prores422')")
});

export const storyboardSchema = z.object({
  title: z.string().describe("Master video project title"),
  width: z.number().int().positive().optional().default(1920).describe("Master width in pixels (default 1920)"),
  height: z.number().int().positive().optional().default(1080).describe("Master height in pixels (default 1080)"),
  frameRate: z.number().positive().optional().default(30).describe("Timeline frame rate (default 30)"),
  look: z.string().optional().describe("Global color grade or aesthetic look applied to the master comp (e.g. 'cinematic', 'warmFilmic', 'bleachBypass', 'vignette')"),
  brand: z.boolean().optional().default(true).describe("Whether to inherit default brand kit palette and typography"),
  music: storyboardMusicSchema.optional().describe("Soundtrack / audio settings"),
  scenes: z.array(sceneSchema).min(1).describe("Ordered sequence of scenes to build"),
  outputs: z.array(storyboardOutputSchema).optional().describe("Target export deliverables")
});

export type Storyboard = z.infer<typeof storyboardSchema>;

export const STORYBOARD_EXAMPLE: Storyboard = {
  title: "NOVA X — Product Debut",
  width: 1920,
  height: 1080,
  frameRate: 30,
  look: "cinematic",
  brand: true,
  scenes: [
    {
      type: "background",
      duration: 3.0,
      content: {
        style: "aurora",
        preset: "darkMinimal"
      },
      effects: [
        {
          kind: "particles",
          name: "sparkles",
          options: { count: 40 }
        }
      ]
    },
    {
      type: "3dText",
      duration: 4.5,
      transitionIn: { type: "zoomIn", duration: 0.5 },
      content: {
        text: "NOVA X",
        subtitle: "UNREAL POWER",
        preset: "dramaticRise"
      },
      effects: [
        {
          kind: "lightEffect",
          name: "lightSweep",
          options: { speed: 1.0 }
        }
      ]
    },
    {
      type: "endCard",
      duration: 3.5,
      transitionIn: { type: "crossDissolve", duration: 0.6 },
      content: {
        text: "AVAILABLE NOW",
        subtitle: "VISIT NOVAX.TECH",
        preset: "fadeScale"
      },
      effects: [
        {
          kind: "look",
          name: "cinemaBars",
          options: { height: 80 }
        }
      ]
    }
  ],
  outputs: [
    { aspect: "16:9", preset: "mp4High" }
  ]
};

export function registerStoryboardTools(server: McpServer): void {
  // 1. ae_build_storyboard
  server.tool(
    "ae_build_storyboard",
    "Assemble a complete multi-scene video from a Storyboard specification. Creates a master timeline comp, builds individual scene precomps, arranges them in sequence with transitions, adds soundtrack with beat-sync, applies brand styling and global looks, runs automated QA checks, and saves the project.",
    {
      storyboard: storyboardSchema.describe("Complete storyboard data specification"),
      compName: z.string().optional().describe("Optional custom name for the master composition")
    },
    async (params) => {
      try {
        const brandKit = params.storyboard.brand !== false ? getActiveBrandDefaults() : null;

        // Long operations up to 10 minutes timeout
        const result = await callAE(
          "ae_build_storyboard",
          {
            storyboard: params.storyboard,
            compName: params.compName,
            brandKit
          },
          600000
        );

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_update_scene
  server.tool(
    "ae_update_scene",
    "Update or rebuild a specific scene precomp within an existing storyboard composition without re-rendering or altering the other scenes.",
    {
      compRef: compRefSchema.optional().describe("Reference to the master storyboard composition"),
      sceneIndex: z.number().int().min(0).describe("0-based index of the scene to update"),
      changes: z.object({
        content: sceneContentSchema.optional(),
        effects: z.array(sceneEffectSchema).optional()
      }).describe("Scene properties, content text, or effects to update")
    },
    async (params) => {
      try {
        const result = await callAE(
          "ae_update_scene",
          {
            compRef: params.compRef,
            sceneIndex: params.sceneIndex,
            changes: params.changes
          },
          120000
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_storyboard_schema
  server.tool(
    "ae_storyboard_schema",
    "Retrieve the JSON schema definition and a complete working example of a Storyboard specification for planning and generating multi-scene videos.",
    {},
    async () => {
      return toolSuccess({
        description: "Storyboard specification schema for the ae-bridge Director layer",
        example: STORYBOARD_EXAMPLE,
        supportedSceneTypes: [
          "title",
          "footage",
          "text",
          "lowerThird",
          "3dText",
          "3dScene",
          "background",
          "logoReveal",
          "counter",
          "quote",
          "endCard"
        ],
        supportedTransitions: [
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
        ]
      });
    }
  );
}
