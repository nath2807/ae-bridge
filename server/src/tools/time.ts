import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";

export function registerTimeTools(server: McpServer): void {
  // 1. ae_set_speed
  server.tool(
    "ae_set_speed",
    "Change layer playback speed percentage using stretch (e.g. 100 for normal, 200 for 2x fast-motion, 50 for slow-motion, -100 for reverse).",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to change speed"),
      speed: z.number().refine((val) => val !== 0, "Speed percentage cannot be 0").describe("Speed percentage (positive for forward, negative for reverse playback)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_speed", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_enable_time_remap
  server.tool(
    "ae_enable_time_remap",
    "Enable time remapping on a layer to allow non-linear retiming, freeze frames, and variable speed ramps.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to enable time remapping")
    },
    async (params) => {
      try {
        const result = await callAE("ae_enable_time_remap", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_speed_ramp
  server.tool(
    "ae_speed_ramp",
    "Apply a smooth multi-point speed ramp curve (e.g. fast-to-slow-to-fast) using time remapping with bezier easing.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to speed ramp"),
      points: z.array(
        z.object({
          time: z.number().min(0).describe("Timeline keyframe time in seconds"),
          speed: z.number().describe("Instantaneous playback speed percentage (e.g. 100, 300, 40)")
        })
      ).min(2).describe("Array of keyframe points defining the speed curve")
    },
    async (params) => {
      try {
        const result = await callAE("ae_speed_ramp", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_freeze_frame
  server.tool(
    "ae_freeze_frame",
    "Freeze video playback at a specific timestamp using a hold time-remapping keyframe.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to freeze"),
      time: z.number().min(0).describe("Timestamp in seconds to freeze"),
      duration: z.number().positive().optional().describe("Optional duration to extend the held frame")
    },
    async (params) => {
      try {
        const result = await callAE("ae_freeze_frame", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_set_frame_blending
  server.tool(
    "ae_set_frame_blending",
    "Configure frame blending on a retimed or stretched layer for ultra-smooth optical flow or frame mix interpolation.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      mode: z.enum(["off", "frameMix", "pixelMotion"]).describe("Frame blending mode ('pixelMotion' uses optical flow vector interpolation)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_frame_blending", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
