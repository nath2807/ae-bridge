import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

export const DISTORTION_TYPES = [
  "waveWarp",
  "turbulent",
  "ripple",
  "bulge",
  "twirl",
  "heatHaze",
  "liquify-style displace",
  "shatter",
  "pixelate"
] as const;

export const LIGHT_EFFECT_TYPES = [
  "lightRays",
  "lensFlare",
  "lightSweep",
  "godRays",
  "shine"
] as const;

export const VISUALIZER_TYPES = [
  "spectrum",
  "waveform",
  "circularSpectrum"
] as const;

export function registerDistortTools(server: McpServer): void {
  // 1. ae_apply_distortion
  server.tool(
    "ae_apply_distortion",
    "Apply animated optical warping, liquid displacement, wave ripples, twirls, shatter, or mosaic pixelation to a layer ('waveWarp', 'turbulent', 'ripple', 'bulge', 'twirl', 'heatHaze', 'liquify-style displace', 'shatter', 'pixelate').",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to distort"),
      type: z.enum(DISTORTION_TYPES).describe("Distortion effect algorithm"),
      amount: z.number().min(0.05).max(20).optional().default(1).describe("Intensity multiplier for distortion parameters (default 1)"),
      animate: z.boolean().optional().default(true).describe("Whether to animate procedural evolution, wave phase, or turbulence (default true)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_apply_distortion", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_add_light_effect
  server.tool(
    "ae_add_light_effect",
    "Add cinematic volumetric light rays, optical lens flares, metallic light sweeps, god rays, or radial shines ('lightRays', 'lensFlare', 'lightSweep', 'godRays', 'shine').",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.optional().describe("Layer to apply effect directly to. If omitted, generates an adjustment layer on top"),
      type: z.enum(LIGHT_EFFECT_TYPES).describe("Optical light effect preset"),
      position: z.array(z.number()).min(2).max(2).optional().describe("2D position coordinates [x, y] in pixels"),
      color: colorSchema.optional().describe("Light tint or glow color")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_light_effect", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_add_audio_visualizer
  server.tool(
    "ae_add_audio_visualizer",
    "Generate an animated reactive audio visualizer ('spectrum', 'waveform', or 'circularSpectrum') synchronized to an audio or video track.",
    {
      compRef: compRefSchema.optional(),
      audioLayer: layerRefSchema.describe("Audio or footage layer containing audio to drive the visualizer"),
      type: z.enum(VISUALIZER_TYPES).optional().default("spectrum").describe("Visualizer geometry aesthetic"),
      color: colorSchema.optional().describe("Primary wave/frequency band color (hex string or [r, g, b] array)"),
      position: z.array(z.number()).min(2).max(2).optional().describe("Center origin position [x, y] in pixels (default comp center)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_audio_visualizer", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
