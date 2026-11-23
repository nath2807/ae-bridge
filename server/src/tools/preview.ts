import fs from "fs";
import os from "os";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import sharp from "sharp";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";

// Check sharp availability safely
let isSharpAvailable = true;
try {
  if (typeof sharp !== "function") {
    isSharpAvailable = false;
  }
} catch {
  isSharpAvailable = false;
}

export function getPreviewDir(): string {
  const dir = path.join(os.tmpdir(), "ae-bridge-previews");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function cleanOldPreviews(): Promise<void> {
  const dir = getPreviewDir();
  try {
    const files = await fs.promises.readdir(dir);
    const now = Date.now();
    const maxAge = 3600 * 1000; // 1 hour
    for (const file of files) {
      try {
        const fullPath = path.join(dir, file);
        const stat = await fs.promises.stat(fullPath);
        if (now - stat.mtimeMs > maxAge) {
          await fs.promises.unlink(fullPath);
        }
      } catch {
        // Ignore errors for individual files
      }
    }
  } catch (err) {
    console.error("[ae-bridge] Failed to clean old previews:", err);
  }
}

export async function waitForStableFile(filePath: string, timeoutMs = 30000): Promise<void> {
  const startTime = Date.now();
  let lastSize = -1;
  let stableSince = 0;

  while (Date.now() - startTime < timeoutMs) {
    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > 0) {
          if (stat.size === lastSize) {
            if (stableSince === 0) {
              stableSince = Date.now();
            } else if (Date.now() - stableSince >= 300) {
              return; // File is stable and fully rendered
            }
          } else {
            lastSize = stat.size;
            stableSince = 0;
          }
        }
      } catch {
        // File may be locked by AE writer, retry
        stableSince = 0;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for rendered frame at: ${filePath}`);
}

export function registerPreviewTools(server: McpServer): void {
  // 1. ae_preview_frame
  server.tool(
    "ae_preview_frame",
    "Capture and inspect a rendered frame from After Effects at a specific time (or current playhead). Returns visual image content along with composition dimensions.",
    {
      compRef: compRefSchema.optional(),
      time: z.number().min(0).optional().describe("Time in seconds to preview. If omitted, uses current comp playhead time"),
      maxWidth: z.number().int().positive().optional().default(960).describe("Maximum image width in pixels for the preview (default 960)")
    },
    async (params) => {
      try {
        const previewDir = getPreviewDir();
        const randId = Math.random().toString(36).slice(2, 9);
        const outputPath = path.join(previewDir, `preview_${Date.now()}_${randId}.png`).replace(/\\/g, "/");

        const aeResult = (await callAE("ae_preview_frame", {
          compRef: params.compRef,
          time: params.time,
          outputPath
        })) as {
          compName: string;
          compId: number;
          time: number;
          width: number;
          height: number;
          outputPath: string;
          method: string;
        };

        await waitForStableFile(outputPath);

        let imgBuffer = await fs.promises.readFile(outputPath);
        let previewWidth = aeResult.width;
        let previewHeight = aeResult.height;
        let sharpWarning: string | null = null;

        if (isSharpAvailable) {
          try {
            const meta = await sharp(imgBuffer).metadata();
            if (meta.width && meta.width > params.maxWidth) {
              imgBuffer = await sharp(imgBuffer)
                .resize({ width: params.maxWidth, withoutEnlargement: true })
                .png()
                .toBuffer();
              const newMeta = await sharp(imgBuffer).metadata();
              previewWidth = newMeta.width ?? previewWidth;
              previewHeight = newMeta.height ?? previewHeight;
            }
          } catch (sharpErr) {
            sharpWarning = `Sharp resizing failed: ${(sharpErr as Error).message}`;
          }
        } else {
          sharpWarning = "sharp is not available; returning original resolution frame without resizing.";
        }

        const metadata = {
          compName: aeResult.compName,
          compId: aeResult.compId,
          time: aeResult.time,
          originalWidth: aeResult.width,
          originalHeight: aeResult.height,
          previewWidth,
          previewHeight,
          captureMethod: aeResult.method,
          ...(sharpWarning ? { warning: sharpWarning } : {})
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(metadata, null, 2)
            },
            {
              type: "image" as const,
              data: imgBuffer.toString("base64"),
              mimeType: "image/png"
            }
          ]
        };
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_contact_sheet
  server.tool(
    "ae_contact_sheet",
    "Render multiple frames evenly across the composition (or work area) and combine them into a single contact sheet grid image with time stamps for visual QA.",
    {
      compRef: compRefSchema.optional(),
      count: z.number().int().min(2).max(30).optional().default(6).describe("Number of frames to sample evenly across duration (default 6, overridden by times)"),
      times: z.array(z.number()).min(1).optional().describe("Explicit array of sample times in seconds to capture"),
      columns: z.number().int().min(1).max(10).optional().default(3).describe("Number of columns in contact sheet grid (default 3)"),
      maxWidth: z.number().int().positive().optional().default(1600).describe("Maximum width of contact sheet grid in pixels (default 1600)")
    },
    async (params) => {
      try {
        const comp = (await callAE("getComp", { compRef: params.compRef })) as {
          id: number;
          name: string;
          width: number;
          height: number;
          duration: number;
          frameRate: number;
          workAreaStart?: number;
          workAreaDuration?: number;
        };

        let sampleTimes: number[] = [];
        if (params.times && params.times.length > 0) {
          sampleTimes = params.times;
        } else {
          const count = params.count || 6;
          const start = comp.workAreaStart ?? 0;
          const dur = comp.workAreaDuration ?? comp.duration;
          const frameDur = 1 / (comp.frameRate || 30);
          const maxT = Math.max(0, start + dur - frameDur);

          if (count === 1) {
            sampleTimes = [start];
          } else {
            sampleTimes = [];
            for (let i = 0; i < count; i++) {
              const t = start + (i / (count - 1)) * (maxT - start);
              sampleTimes.push(Number(t.toFixed(3)));
            }
          }
        }

        const previewDir = getPreviewDir();
        const frameBuffers: Array<{ time: number; buffer: Buffer }> = [];

        for (const t of sampleTimes) {
          const randId = Math.random().toString(36).slice(2, 9);
          const outPath = path.join(previewDir, `sheet_${comp.id}_${Date.now()}_${randId}.png`).replace(/\\/g, "/");

          await callAE("ae_preview_frame", {
            compRef: { compId: comp.id },
            time: t,
            outputPath: outPath
          });

          await waitForStableFile(outPath);
          const buf = await fs.promises.readFile(outPath);
          frameBuffers.push({ time: t, buffer: buf });
        }

        if (!isSharpAvailable) {
          // Sharp missing fallback: return first frame and listing of times
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    compName: comp.name,
                    compId: comp.id,
                    times: sampleTimes,
                    warning: "sharp is not available; contact sheet grid could not be composited. Displaying first sampled frame."
                  },
                  null,
                  2
                )
              },
              {
                type: "image" as const,
                data: frameBuffers[0].buffer.toString("base64"),
                mimeType: "image/png"
              }
            ]
          };
        }

        const cols = params.columns || 3;
        const total = frameBuffers.length;
        const rows = Math.ceil(total / cols);
        const cellWidth = Math.floor(params.maxWidth / cols);
        const aspect = comp.width / comp.height;
        const thumbHeight = Math.max(1, Math.round(cellWidth / aspect));
        const labelHeight = 28;
        const cellTotalHeight = thumbHeight + labelHeight;

        const canvasWidth = cellWidth * cols;
        const canvasHeight = cellTotalHeight * rows;

        const composites: Array<{ input: Buffer; left: number; top: number }> = [];

        for (let idx = 0; idx < total; idx++) {
          const item = frameBuffers[idx];
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const posX = col * cellWidth;
          const posY = row * cellTotalHeight;

          const resizedThumb = await sharp(item.buffer)
            .resize(cellWidth, thumbHeight, {
              fit: "contain",
              background: { r: 15, g: 23, b: 42, alpha: 1 }
            })
            .png()
            .toBuffer();

          composites.push({
            input: resizedThumb,
            left: posX,
            top: posY
          });

          const frameNum = Math.round(item.time * (comp.frameRate || 30));
          const timeLabel = `${item.time.toFixed(2)}s  (f${frameNum})`;

          const labelSvg = `
            <svg width="${cellWidth}" height="${labelHeight}">
              <rect width="100%" height="100%" fill="#0f172a" />
              <rect x="0" y="0" width="100%" height="1" fill="#334155" />
              <text x="50%" y="68%" font-family="monospace, sans-serif" font-size="12" font-weight="bold" fill="#e2e8f0" text-anchor="middle">
                ${timeLabel}
              </text>
            </svg>
          `;

          composites.push({
            input: Buffer.from(labelSvg),
            left: posX,
            top: posY + thumbHeight
          });
        }

        const sheetBuffer = await sharp({
          create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 4,
            background: { r: 15, g: 23, b: 42, alpha: 1 }
          }
        })
          .composite(composites)
          .png()
          .toBuffer();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  compName: comp.name,
                  compId: comp.id,
                  grid: `${cols}x${rows}`,
                  sheetWidth: canvasWidth,
                  sheetHeight: canvasHeight,
                  sampleTimes
                },
                null,
                2
              )
            },
            {
              type: "image" as const,
              data: sheetBuffer.toString("base64"),
              mimeType: "image/png"
            }
          ]
        };
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_preview_layer_isolated
  server.tool(
    "ae_preview_layer_isolated",
    "Temporarily solo a single layer, render a preview frame, and cleanly restore all layer solo switches. Useful for inspecting titles, masks, shapes or particle elements in isolation.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to isolate and preview"),
      time: z.number().min(0).optional().describe("Time in seconds to preview. If omitted, uses current comp playhead time"),
      maxWidth: z.number().int().positive().optional().default(960).describe("Maximum image width in pixels (default 960)")
    },
    async (params) => {
      try {
        const previewDir = getPreviewDir();
        const randId = Math.random().toString(36).slice(2, 9);
        const outputPath = path.join(previewDir, `solo_${Date.now()}_${randId}.png`).replace(/\\/g, "/");

        const aeResult = (await callAE("ae_preview_layer_isolated", {
          compRef: params.compRef,
          layerRef: params.layerRef,
          time: params.time,
          outputPath
        })) as {
          compName: string;
          compId: number;
          layerName: string;
          layerIndex: number;
          time: number;
          width: number;
          height: number;
          outputPath: string;
          method: string;
        };

        await waitForStableFile(outputPath);

        let imgBuffer = await fs.promises.readFile(outputPath);
        let previewWidth = aeResult.width;
        let previewHeight = aeResult.height;

        if (isSharpAvailable) {
          try {
            const meta = await sharp(imgBuffer).metadata();
            if (meta.width && meta.width > params.maxWidth) {
              imgBuffer = await sharp(imgBuffer)
                .resize({ width: params.maxWidth, withoutEnlargement: true })
                .png()
                .toBuffer();
              const newMeta = await sharp(imgBuffer).metadata();
              previewWidth = newMeta.width ?? previewWidth;
              previewHeight = newMeta.height ?? previewHeight;
            }
          } catch (sharpErr) {
            console.error("[ae-bridge] Sharp resize error on solo preview:", sharpErr);
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  compName: aeResult.compName,
                  compId: aeResult.compId,
                  layerName: aeResult.layerName,
                  layerIndex: aeResult.layerIndex,
                  time: aeResult.time,
                  originalWidth: aeResult.width,
                  originalHeight: aeResult.height,
                  previewWidth,
                  previewHeight,
                  captureMethod: aeResult.method
                },
                null,
                2
              )
            },
            {
              type: "image" as const,
              data: imgBuffer.toString("base64"),
              mimeType: "image/png"
            }
          ]
        };
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_set_preview_time
  server.tool(
    "ae_set_preview_time",
    "Move the After Effects composition timeline playhead (current time) to a specific time in seconds.",
    {
      compRef: compRefSchema.optional(),
      time: z.number().min(0).describe("Target playhead time in seconds")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_preview_time", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
