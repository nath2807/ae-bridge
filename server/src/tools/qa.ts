import fs from "fs";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "./schemas.js";
import { getPreviewDir, waitForStableFile } from "./preview.js";

export function registerQaTools(server: McpServer): void {
  // 1. ae_get_layer_bounds
  server.tool(
    "ae_get_layer_bounds",
    "Calculate composition-space 2D bounding boxes (left, top, right, bottom, width, height) and opacity for all visible/active layers at a specific time (or current playhead). 3D layers are flagged with approximate bounding box.",
    {
      compRef: compRefSchema.optional(),
      time: z.number().min(0).optional().describe("Time in seconds to evaluate layer boundaries. If omitted, uses current comp playhead time")
    },
    async (params) => {
      try {
        const result = await callAE("ae_get_layer_bounds", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_qa_check
  server.tool(
    "ae_qa_check",
    "Run an automated quality assurance inspection across a composition: checks for title-safe violations (10% margins), off-screen or clipped typography, overlapping text layers, broken expressions, missing footage assets, disabled effects, wasted 0-opacity layers, out-of-bounds keyframes, rapid flicker (<4 frames), tiny text (<24px at 1080p), low contrast (<3:1), and static openings. Returns a structured report with severity, category, and actionable suggested fixes.",
    {
      compRef: compRefSchema.optional(),
      checkTimes: z.union([
        z.number().int().min(2).max(30).describe("Number of evenly spaced sample times to evaluate across duration (default 5)"),
        z.array(z.number()).describe("Explicit array of time points in seconds to check")
      ]).optional().describe("Sample times for layout and collision checks (defaults to 5 evenly spaced sample points)"),
      includePreview: z.boolean().optional().describe("If true, captures a rendered preview frame of the composition and includes it as an MCP image payload alongside the QA report")
    },
    async (params) => {
      try {
        const { includePreview, ...qaParams } = params;
        const result = await callAE("ae_qa_check", qaParams);

        if (includePreview) {
          try {
            const previewDir = getPreviewDir();
            const randId = Math.random().toString(36).slice(2, 9);
            const outPath = path.join(previewDir, `qa_preview_${Date.now()}_${randId}.png`).replace(/\\/g, "/");
            await callAE("ae_preview_frame", {
              compRef: params.compRef,
              outputPath: outPath
            });
            await waitForStableFile(outPath, 5000);
            const imgBuf = await fs.promises.readFile(outPath);
            return {
              content: [
                {
                  type: "text" as const,
                  text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
                },
                {
                  type: "image" as const,
                  data: imgBuf.toString("base64"),
                  mimeType: "image/png"
                }
              ]
            };
          } catch (prevErr) {
            const reportWithWarning = typeof result === "object" && result !== null
              ? { ...result, previewWarning: `Preview capture skipped: ${(prevErr as Error).message}` }
              : result;
            return toolSuccess(reportWithWarning);
          }
        }

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_timeline_summary
  server.tool(
    "ae_timeline_summary",
    "Generate a structured, human-readable timeline summary of the composition: layers in stacking order with their in/out times, layer types, 3D status, keyframed properties and ranges, active effects, and expressions. Provides a quick mental model of the entire composition.",
    {
      compRef: compRefSchema.optional()
    },
    async (params) => {
      try {
        const result = await callAE("ae_timeline_summary", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
