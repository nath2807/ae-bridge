import fs from "fs";
import os from "os";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import sharp from "sharp";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "./schemas.js";
import { getPreviewDir, waitForStableFile } from "./preview.js";

export interface FrameMetrics {
  width: number;
  height: number;
  meanBrightness: number; // 0 - 255
  rmsContrast: number; // RMS contrast
  blurScore: number; // Laplacian variance (higher = sharper, < 100 often blurry)
  clipping: {
    blackPercent: number; // percentage of pixels with brightness <= 5
    whitePercent: number; // percentage of pixels with brightness >= 250
  };
  dominantColors: Array<{ r: number; g: number; b: number; percent: number }>;
}

export async function analyzeFrameBuffer(buffer: Buffer): Promise<FrameMetrics> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1920;
  const height = metadata.height || 1080;

  // Extract raw RGB pixels
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const channels = info.channels;

  let totalLuminance = 0;
  const luminances: number[] = new Array(pixelCount);
  let blackCount = 0;
  let whiteCount = 0;

  // Color buckets (downsampled 4x4x4 grid)
  const colorBuckets = new Map<number, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Standard perceptual luminance formula
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    luminances[i] = lum;
    totalLuminance += lum;

    if (lum <= 5) blackCount++;
    if (lum >= 250) whiteCount++;

    // Color quantization
    const qr = Math.floor(r / 64) * 64 + 32;
    const qg = Math.floor(g / 64) * 64 + 32;
    const qb = Math.floor(b / 64) * 64 + 32;
    const bucketKey = (qr << 16) | (qg << 8) | qb;
    const existing = colorBuckets.get(bucketKey);
    if (existing) {
      existing.count++;
    } else {
      colorBuckets.set(bucketKey, { r: qr, g: qg, b: qb, count: 1 });
    }
  }

  const meanBrightness = totalLuminance / pixelCount;

  // Compute RMS contrast
  let sumSqDiff = 0;
  for (let i = 0; i < pixelCount; i++) {
    const diff = luminances[i] - meanBrightness;
    sumSqDiff += diff * diff;
  }
  const rmsContrast = Math.sqrt(sumSqDiff / pixelCount);

  // Compute Laplacian variance for blur detection on grayscale
  // Simple discrete 3x3 Laplacian filter kernel
  const w = info.width;
  const h = info.height;
  let laplacianSum = 0;
  let laplacianSumSq = 0;
  let edgeCount = 0;

  // Sample interior pixels (skip boundary to avoid bounds check)
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const idx = y * w + x;
      const center = luminances[idx];
      const top = luminances[idx - w];
      const bottom = luminances[idx + w];
      const left = luminances[idx - 1];
      const right = luminances[idx + 1];

      const lap = Math.abs(top + bottom + left + right - 4 * center);
      laplacianSum += lap;
      laplacianSumSq += lap * lap;
      edgeCount++;
    }
  }

  const lapMean = edgeCount > 0 ? laplacianSum / edgeCount : 0;
  const blurScore = edgeCount > 0 ? Math.round((laplacianSumSq / edgeCount - lapMean * lapMean) * 10) / 10 : 0;

  // Dominant colors (top 3)
  const sortedColors = Array.from(colorBuckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((c) => ({
      r: c.r,
      g: c.g,
      b: c.b,
      percent: Math.round((c.count / pixelCount) * 1000) / 10
    }));

  return {
    width,
    height,
    meanBrightness: Math.round(meanBrightness * 10) / 10,
    rmsContrast: Math.round(rmsContrast * 10) / 10,
    blurScore,
    clipping: {
      blackPercent: Math.round((blackCount / pixelCount) * 1000) / 10,
      whitePercent: Math.round((whiteCount / pixelCount) * 1000) / 10
    },
    dominantColors: sortedColors
  };
}

export function registerVisionTools(server: McpServer): void {
  // 1. ae_measure_frame
  server.tool(
    "ae_measure_frame",
    "Perform optical computer vision analysis on a rendered composition frame: mean brightness, RMS contrast, perceptual blur detection, clipping percentages, and dominant colors.",
    {
      compRef: compRefSchema.optional(),
      time: z.number().min(0).optional().describe("Time in seconds to measure. If omitted, uses current comp playhead time"),
      imagePath: z.string().optional().describe("Optional path to an existing image file on disk to analyze directly")
    },
    async (params) => {
      try {
        let buffer: Buffer;

        if (params.imagePath && fs.existsSync(params.imagePath)) {
          buffer = await fs.promises.readFile(params.imagePath);
        } else {
          const previewDir = getPreviewDir();
          const randId = Math.random().toString(36).slice(2, 9);
          const outPath = path.join(previewDir, `vision_${Date.now()}_${randId}.png`).replace(/\\/g, "/");

          await callAE("ae_preview_frame", {
            compRef: params.compRef,
            time: params.time,
            outputPath: outPath
          });

          await waitForStableFile(outPath, 5000);
          buffer = await fs.promises.readFile(outPath);
        }

        const metrics = await analyzeFrameBuffer(buffer);
        return toolSuccess({
          time: params.time !== undefined ? params.time : "current_playhead",
          metrics,
          assessment: {
            exposure: metrics.meanBrightness < 30 ? "underexposed" : metrics.meanBrightness > 220 ? "overexposed" : "normal",
            contrast: metrics.rmsContrast < 25 ? "low_contrast" : metrics.rmsContrast > 70 ? "high_contrast" : "balanced",
            sharpness: metrics.blurScore < 50 ? "blurry_or_flat" : metrics.blurScore < 150 ? "moderate_detail" : "sharp"
          }
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_measure_comp
  server.tool(
    "ae_measure_comp",
    "Evaluate temporal optical stability and dynamic range across multiple sample times of a composition, flagging flicker, clipped frames, and contrast drops.",
    {
      compRef: compRefSchema.optional(),
      sampleCount: z.number().int().min(2).max(20).optional().default(5).describe("Number of sample points across composition duration (default 5)")
    },
    async (params) => {
      try {
        const comp = (await callAE("getComp", { compRef: params.compRef })) as {
          id: number;
          name: string;
          duration: number;
          width: number;
          height: number;
        };

        const count = params.sampleCount || 5;
        const dur = comp.duration || 10;
        const previewDir = getPreviewDir();
        const frameResults: Array<{ time: number; metrics: FrameMetrics }> = [];
        const warnings: string[] = [];

        for (let i = 0; i < count; i++) {
          const t = Math.round((i / (count - 1)) * (dur - 0.05) * 100) / 100;
          const randId = Math.random().toString(36).slice(2, 9);
          const outPath = path.join(previewDir, `vision_comp_${comp.id}_${Date.now()}_${randId}.png`).replace(/\\/g, "/");

          await callAE("ae_preview_frame", {
            compRef: { compId: comp.id },
            time: t,
            outputPath: outPath
          });

          await waitForStableFile(outPath, 5000);
          const buf = await fs.promises.readFile(outPath);
          const m = await analyzeFrameBuffer(buf);
          frameResults.push({ time: t, metrics: m });

          if (m.clipping.whitePercent > 20) {
            warnings.push(`Severe overexposure / blown highlights (${m.clipping.whitePercent}%) at time ${t}s`);
          }
          if (m.clipping.blackPercent > 80) {
            warnings.push(`Pitch black / crushed shadow frame (${m.clipping.blackPercent}%) at time ${t}s`);
          }
          if (m.rmsContrast < 15) {
            warnings.push(`Extremely low visual contrast (${m.rmsContrast}) at time ${t}s`);
          }
        }

        // Compute temporal flicker variance across luminance
        const luminances = frameResults.map((f) => f.metrics.meanBrightness);
        const meanLum = luminances.reduce((a, b) => a + b, 0) / luminances.length;
        const lumVariance =
          luminances.reduce((acc, val) => acc + Math.pow(val - meanLum, 2), 0) / luminances.length;

        if (lumVariance > 1200) {
          warnings.push(`High temporal luminance fluctuation (variance ${Math.round(lumVariance)}) detected across frames`);
        }

        return toolSuccess({
          compName: comp.name,
          sampleCount: count,
          averageBrightness: Math.round(meanLum * 10) / 10,
          luminanceTemporalVariance: Math.round(lumVariance * 10) / 10,
          warnings,
          frames: frameResults
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
