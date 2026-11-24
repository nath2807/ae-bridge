import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { toolSuccess, toolError } from "./schemas.js";

export function registerQualityTools(server: McpServer): void {
  server.tool(
    "ae_set_quality_mode",
    "Switch After Effects render quality mode between 'draft' (8bpc, 1/2 resolution factor, motion blur disabled for fast responsive scrubbing) and 'final' (32bpc or 16bpc deep color, linear blending enabled, motion blur enabled for comp + animated layers, 180 shutter angle, -90 shutter phase, 16 samples per frame, full resolution, Advanced 3D renderer).",
    {
      mode: z.enum(["draft", "final"]).describe("Quality tier mode: 'draft' for fast editing previews, 'final' for master broadcast fidelity")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_quality_mode", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
