import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "./schemas.js";

export const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5", "4:3", "21:9"] as const;
export const REFRAME_METHODS = ["fill", "fit", "fitBlurBackground", "smartReframe"] as const;
export const SOCIAL_PLATFORMS = [
  "youtube",
  "shorts",
  "reels",
  "tiktok",
  "instagramFeed",
  "instagramPortrait",
  "x",
  "linkedin"
] as const;

export function registerFormatTools(server: McpServer): void {
  // 1. ae_create_format_variant
  server.tool(
    "ae_create_format_variant",
    "Create an aspect ratio or format variation of a composition ('16:9', '9:16', '1:1', '4:5', '4:3', '21:9') using 'smartReframe' (duplicate + scale/reposition layers into title-safe boundaries), 'fit', 'fill', or 'fitBlurBackground' (with blurred backdrop).",
    {
      compRef: compRefSchema.optional(),
      aspect: z.enum(ASPECT_RATIOS).describe("Target aspect ratio"),
      resolution: z.array(z.number()).min(2).max(2).optional().describe("Optional custom [width, height] resolution override in pixels"),
      method: z.enum(REFRAME_METHODS).optional().default("smartReframe").describe("Reframing strategy: 'smartReframe' (duplicates and adjusts layers into safe areas), 'fitBlurBackground', 'fit', or 'fill'"),
      name: z.string().optional().describe("Optional custom name for the new variant composition")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_format_variant", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_create_all_social_variants
  server.tool(
    "ae_create_all_social_variants",
    "Batch-generate all channel-ready social media formats (YouTube, Shorts, Reels, TikTok, Instagram Feed/Portrait, X, LinkedIn) from a master composition and file them in a 'Social Variants' folder.",
    {
      compRef: compRefSchema.optional(),
      platforms: z.array(z.enum(SOCIAL_PLATFORMS)).optional().describe("List of target platforms (defaults to all: youtube, shorts, reels, tiktok, instagramFeed, instagramPortrait, x, linkedin)"),
      method: z.enum(REFRAME_METHODS).optional().default("smartReframe").describe("Reframing strategy (default 'smartReframe')")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_all_social_variants", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
