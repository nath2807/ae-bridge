import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";

export function registerAudioTools(server: McpServer): void {
  // 1. ae_set_audio_level
  server.tool(
    "ae_set_audio_level",
    "Set a layer's static audio gain/volume level in decibels (0 dB = unity gain, -12 dB = background bed, -48 dB = muted).",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target audio or video layer"),
      db: z.number().describe("Audio level in decibels (dB)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_audio_level", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_fade_audio
  server.tool(
    "ae_fade_audio",
    "Apply smooth audio fade-in and/or fade-out ramps to a layer using -48 dB threshold keyframes.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target audio or video layer"),
      fadeIn: z.number().positive().optional().describe("Fade-in duration in seconds from layer in-point"),
      fadeOut: z.number().positive().optional().describe("Fade-out duration in seconds leading to layer out-point")
    },
    async (params) => {
      try {
        const result = await callAE("ae_fade_audio", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_duck_audio
  server.tool(
    "ae_duck_audio",
    "Automatically duck background music volume while a dialogue, narration, or voiceover layer is actively speaking.",
    {
      compRef: compRefSchema.optional(),
      musicLayer: layerRefSchema.describe("Background music layer to be ducked"),
      voiceLayer: layerRefSchema.describe("Dialogue or voiceover reference layer controlling the duck timing"),
      duckDb: z.number().optional().default(-12).describe("Ducked attenuation level in dB (default -12 dB)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_duck_audio", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_audio_to_keyframes
  server.tool(
    "ae_audio_to_keyframes",
    "Convert audio amplitude waveform into animated keyframe slider values (Both Channels, Left, Right) for audio-reactive motion graphics.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Source audio layer to analyze")
    },
    async (params) => {
      try {
        const result = await callAE("ae_audio_to_keyframes", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_add_markers
  server.tool(
    "ae_add_markers",
    "Add timeline or beat markers to a composition or specific layer with custom labels and durations.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.optional().describe("Target layer (if omitted, markers are added to the composition timeline)"),
      markers: z.array(
        z.object({
          time: z.number().min(0).describe("Marker timestamp in seconds"),
          comment: z.string().optional().describe("Marker text label or comment"),
          duration: z.number().min(0).optional().describe("Optional marker duration in seconds")
        })
      ).min(1).describe("List of markers to create")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_markers", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_cut_to_markers
  server.tool(
    "ae_cut_to_markers",
    "Automatically snap and sequence an array of video clips to composition markers (rhythm/beat synchronization).",
    {
      compRef: compRefSchema.optional(),
      layerRefs: z.array(layerRefSchema).min(1).describe("Ordered array of video clip layers to snap to comp beat markers")
    },
    async (params) => {
      try {
        const result = await callAE("ae_cut_to_markers", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
