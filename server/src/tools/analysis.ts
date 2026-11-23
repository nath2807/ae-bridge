import fs from "fs";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import sharp from "sharp";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";
import { getPreviewDir, waitForStableFile } from "./preview.js";

let isSharpAvailable = true;
try {
  if (typeof sharp !== "function") {
    isSharpAvailable = false;
  }
} catch {
  isSharpAvailable = false;
}

export interface AssetMetadata {
  id: number;
  name: string;
  kind: "comp" | "video" | "image" | "audio";
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  hasAudio: boolean;
  hasVideo: boolean;
  midTime: number;
  filePath: string | null;
}

export function registerAnalysisTools(server: McpServer): void {
  // 1. ae_analyze_assets
  server.tool(
    "ae_analyze_assets",
    "Inspect footage, audio, and visual assets in the After Effects project. Returns detailed metadata (durations, resolutions, audio channels) and a composited contact sheet grid displaying the middle frame of all visual assets with labels.",
    {
      itemIds: z.array(z.number().int()).optional().describe("Optional list of specific project item IDs to inspect"),
      folderName: z.string().optional().describe("Optional project bin/folder name to filter assets by (e.g. 'Footage', 'Audio')")
    },
    async (params) => {
      try {
        const result = (await callAE("ae_analyze_assets", {
          itemIds: params.itemIds,
          folderName: params.folderName
        })) as { totalAssets: number; assets: AssetMetadata[] };

        const visualAssets = (result.assets || []).filter(
          (a) => a.kind === "video" || a.kind === "image" || a.kind === "comp"
        );

        if (visualAssets.length === 0) {
          return toolSuccess({
            totalAssets: result.totalAssets,
            assets: result.assets,
            note: "No visual assets found to generate a contact sheet."
          });
        }

        const previewDir = getPreviewDir();
        const samplesToRender = visualAssets.map((asset) => {
          const randId = Math.random().toString(36).slice(2, 9);
          const outPath = path.join(previewDir, `asset_${asset.id}_${Date.now()}_${randId}.png`).replace(/\\/g, "/");
          return {
            itemId: asset.id,
            time: asset.midTime || 0,
            outputPath: outPath,
            name: asset.name,
            asset
          };
        });

        await callAE("ae_sample_asset_frames", {
          samples: samplesToRender.map((s) => ({
            itemId: s.itemId,
            time: s.time,
            outputPath: s.outputPath
          }))
        });

        const frameBuffers: Array<{ name: string; asset: AssetMetadata; buffer: Buffer }> = [];
        for (const s of samplesToRender) {
          try {
            await waitForStableFile(s.outputPath, 15000);
            const buf = await fs.promises.readFile(s.outputPath);
            frameBuffers.push({ name: s.name, asset: s.asset, buffer: buf });
          } catch (eWait) {
            console.error(`[ae-bridge] Warning: Could not sample frame for asset ${s.itemId} (${s.name}):`, eWait);
          }
        }

        if (frameBuffers.length === 0 || !isSharpAvailable) {
          if (frameBuffers.length > 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(result, null, 2)
                },
                {
                  type: "image" as const,
                  data: frameBuffers[0].buffer.toString("base64"),
                  mimeType: "image/png"
                }
              ]
            };
          }
          return toolSuccess(result);
        }

        // Composite contact sheet grid
        const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(frameBuffers.length))));
        const rows = Math.ceil(frameBuffers.length / cols);
        const cellWidth = 360;
        const thumbHeight = 202; // 16:9 aspect ratio standard
        const labelHeight = 32;
        const cellTotalHeight = thumbHeight + labelHeight;

        const canvasWidth = cellWidth * cols;
        const canvasHeight = cellTotalHeight * rows;

        const composites: Array<{ input: Buffer; left: number; top: number }> = [];

        for (let idx = 0; idx < frameBuffers.length; idx++) {
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

          const labelClean = item.name.length > 34 ? `${item.name.slice(0, 31)}...` : item.name;
          const durationStr = item.asset.duration > 0 ? `${item.asset.duration.toFixed(1)}s` : "still";
          const resStr = `${item.asset.width}x${item.asset.height}`;
          const subText = `${item.asset.kind.toUpperCase()} • ${resStr} • ${durationStr}`;

          const labelSvg = `
            <svg width="${cellWidth}" height="${labelHeight}">
              <rect width="100%" height="100%" fill="#0f172a" />
              <rect x="0" y="0" width="100%" height="1" fill="#334155" />
              <text x="10" y="15" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#f8fafc">
                ${escapeXml(labelClean)}
              </text>
              <text x="10" y="27" font-family="monospace, sans-serif" font-size="9" fill="#94a3b8">
                ${escapeXml(subText)}
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
                  totalAssets: result.totalAssets,
                  visualAssetsSampled: frameBuffers.length,
                  grid: `${cols}x${rows}`,
                  assets: result.assets
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

  // 2. ae_preview_clip
  server.tool(
    "ae_preview_clip",
    "Sample a specific footage item or video asset across its full duration, producing a multi-frame contact sheet grid labeled with timestamps.",
    {
      itemId: z.number().int().describe("Project item ID of the video or footage asset"),
      count: z.number().int().min(2).max(16).optional().default(6).describe("Number of frames to sample evenly across duration (default 6)")
    },
    async (params) => {
      try {
        const analyzeRes = (await callAE("ae_analyze_assets", {
          itemIds: [params.itemId]
        })) as { totalAssets: number; assets: AssetMetadata[] };

        if (!analyzeRes.assets || analyzeRes.assets.length === 0) {
          throw new Error(`Project item with ID ${params.itemId} not found.`);
        }

        const asset = analyzeRes.assets[0];
        const count = params.count || 6;
        const dur = asset.duration > 0 ? asset.duration : 1;
        const fps = asset.frameRate > 0 ? asset.frameRate : 30;
        const frameDur = 1 / fps;
        const maxT = Math.max(0, dur - frameDur);

        const sampleTimes: number[] = [];
        for (let i = 0; i < count; i++) {
          const t = (i / (count - 1)) * maxT;
          sampleTimes.push(Number(t.toFixed(3)));
        }

        const previewDir = getPreviewDir();
        const samples = sampleTimes.map((t) => {
          const randId = Math.random().toString(36).slice(2, 9);
          const outPath = path.join(previewDir, `clip_${asset.id}_${Date.now()}_${randId}.png`).replace(/\\/g, "/");
          return {
            itemId: asset.id,
            time: t,
            outputPath: outPath
          };
        });

        await callAE("ae_sample_asset_frames", { samples });

        const frameBuffers: Array<{ time: number; buffer: Buffer }> = [];
        for (const s of samples) {
          await waitForStableFile(s.outputPath, 20000);
          const buf = await fs.promises.readFile(s.outputPath);
          frameBuffers.push({ time: s.time, buffer: buf });
        }

        if (!isSharpAvailable) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    name: asset.name,
                    id: asset.id,
                    duration: asset.duration,
                    sampleTimes,
                    warning: "sharp is not available; displaying first frame."
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

        const cols = count <= 4 ? count : 3;
        const rows = Math.ceil(count / cols);
        const cellWidth = 400;
        const aspect = (asset.width && asset.height) ? asset.width / asset.height : 16 / 9;
        const thumbHeight = Math.max(1, Math.round(cellWidth / aspect));
        const labelHeight = 28;
        const cellTotalHeight = thumbHeight + labelHeight;

        const canvasWidth = cellWidth * cols;
        const canvasHeight = cellTotalHeight * rows;

        const composites: Array<{ input: Buffer; left: number; top: number }> = [];

        for (let idx = 0; idx < frameBuffers.length; idx++) {
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

          const frameNum = Math.round(item.time * fps);
          const timeLabel = `${item.time.toFixed(2)}s  (frame ${frameNum})`;

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
                  assetName: asset.name,
                  assetId: asset.id,
                  duration: asset.duration,
                  grid: `${cols}x${rows}`,
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

  // 3. ae_detect_beats
  server.tool(
    "ae_detect_beats",
    "Perform volume peak detection and rhythmic beat analysis on an audio track. Estimates BPM, extracts beat timestamps using adaptive standard-deviation thresholding, and optionally creates After Effects comp markers on every detected beat.",
    {
      itemId: z.number().int().optional().describe("Optional project item ID of audio footage asset"),
      compRef: compRefSchema.optional().describe("Composition reference containing the audio layer"),
      layerRef: layerRefSchema.optional().describe("Audio layer reference within the composition"),
      sensitivity: z.number().min(0.0).max(1.0).optional().default(0.5).describe("Beat detection sensitivity (0.0 to 1.0, default 0.5)"),
      minGap: z.number().min(0.05).max(2.0).optional().default(0.25).describe("Minimum time gap in seconds between consecutive beats (default 0.25)"),
      addMarkers: z.boolean().optional().default(true).describe("Whether to automatically add After Effects comp markers at each detected beat (default true)")
    },
    async (params) => {
      try {
        const res = await callAE("ae_detect_beats", {
          itemId: params.itemId,
          compRef: params.compRef,
          layerRef: params.layerRef,
          sensitivity: params.sensitivity ?? 0.5,
          minGap: params.minGap ?? 0.25,
          addMarkers: params.addMarkers ?? true
        });
        return toolSuccess(res);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}
