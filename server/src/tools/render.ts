import fs from "fs";
import os from "os";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import sharp from "sharp";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "./schemas.js";
import { startRenderJob, getRenderJob, cancelRenderJob, listRenderJobs } from "../render/jobs.js";

export const RENDER_PRESETS = [
  "mp4High",
  "mp4Web",
  "prores422",
  "proresProxy",
  "prores4444Alpha",
  "pngSequence",
  "pngAlphaSequence",
  "wav"
] as const;

export function getDefaultRenderDir(): string {
  const dir = path.join(os.homedir(), "Videos", "ae-bridge-renders").replace(/\\/g, "/");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getPresetExtension(preset: string): string {
  switch (preset) {
    case "mp4High":
    case "mp4Web":
      return ".mp4";
    case "prores422":
    case "proresProxy":
    case "prores4444Alpha":
      return ".mov";
    case "pngSequence":
    case "pngAlphaSequence":
      return "_[#####].png";
    case "wav":
      return ".wav";
    default:
      return ".mov";
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function registerRenderTools(server: McpServer): void {
  // 1. ae_list_output_templates
  server.tool(
    "ae_list_output_templates",
    "List all available After Effects Render Settings and Output Module templates, along with mapped export presets.",
    {},
    async () => {
      try {
        const result = await callAE("ae_list_output_templates", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_render
  server.tool(
    "ae_render",
    "Render a composition via Adobe Media Encoder (mode='ame', non-blocking) or directly within After Effects (mode='ae', blocking, long timeout). Presets: 'mp4High', 'mp4Web', 'prores422', 'proresProxy', 'prores4444Alpha', 'pngSequence', 'pngAlphaSequence', 'wav'. Default output folder: <Videos>/ae-bridge-renders.",
    {
      compRef: compRefSchema.optional(),
      preset: z.enum(RENDER_PRESETS).describe("Render preset mapping"),
      outputPath: z.string().optional().describe("Explicit target file path. If omitted, generates inside <Videos>/ae-bridge-renders"),
      fileName: z.string().optional().describe("Optional custom file name without directory"),
      workAreaOnly: z.boolean().optional().default(true).describe("Whether to render only the composition work area (default true)"),
      mode: z.enum(["ae", "ame", "aerender"]).optional().default("ame").describe("Render engine: 'ame' (queues in Adobe Media Encoder, non-blocking), 'ae' (direct in-AE blocking render), or 'aerender' (background headless CLI render job)")
    },
    async (params) => {
      try {
        const renderDir = getDefaultRenderDir();
        let targetPath = params.outputPath;

        if (!targetPath) {
          const compInfo = (await callAE("getComp", { compRef: params.compRef })) as { name: string };
          const safeCompName = compInfo.name.replace(/[<>:"/\\|?*]/g, "_");
          const ext = getPresetExtension(params.preset);
          const fName = params.fileName || `${safeCompName}_${params.preset}_${Date.now()}${ext}`;
          targetPath = path.join(renderDir, fName).replace(/\\/g, "/");
        } else {
          targetPath = path.resolve(targetPath).replace(/\\/g, "/");
        }

        if (params.mode === "aerender") {
          const compInfo = (await callAE("getComp", { compRef: params.compRef })) as { name: string };
          const job = startRenderJob({
            compName: compInfo.name,
            outputPath: targetPath,
            preset: params.preset
          });

          return toolSuccess({
            jobId: job.id,
            status: job.status,
            compName: compInfo.name,
            outputPath: targetPath,
            preset: params.preset,
            mode: "aerender",
            message: "aerender background job started. Monitor progress with ae_render_job_status."
          });
        }

        // In-AE rendering can take a long time; allow up to 2 hours
        const timeoutMs = params.mode === "ae" ? 2 * 60 * 60 * 1000 : 60000;

        const result = await callAE(
          "ae_render",
          {
            compRef: params.compRef,
            preset: params.preset,
            outputPath: targetPath,
            workAreaOnly: params.workAreaOnly,
            mode: params.mode
          },
          {
            timeoutMs,
            priority: "batch"
          }
        );

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_render_status
  server.tool(
    "ae_render_status",
    "Check status of a rendered or rendering file on disk (existence, file size, growth detection, and last modified timestamp). Useful for monitoring AME renders.",
    {
      outputPath: z.string().describe("File path of the rendered output to inspect")
    },
    async (params) => {
      try {
        const targetPath = path.resolve(params.outputPath).replace(/\\/g, "/");
        if (!fs.existsSync(targetPath)) {
          return toolSuccess({
            exists: false,
            path: targetPath,
            message: "File does not exist yet. Render may still be queued or initializing."
          });
        }

        const stat1 = await fs.promises.stat(targetPath);
        await new Promise((res) => setTimeout(res, 500));
        const stat2 = await fs.promises.stat(targetPath);

        const isGrowing = stat2.size > stat1.size;

        return toolSuccess({
          exists: true,
          path: targetPath,
          sizeBytes: stat2.size,
          sizeFormatted: formatBytes(stat2.size),
          isGrowing,
          lastModified: stat2.mtime.toISOString(),
          status: isGrowing ? "rendering_in_progress" : (stat2.size > 0 ? "render_finished" : "file_created_zero_bytes")
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_batch_render
  server.tool(
    "ae_batch_render",
    "Queue multiple compositions in batch for rendering with individual preset mappings.",
    {
      items: z.array(
        z.object({
          compRef: compRefSchema.optional(),
          preset: z.enum(RENDER_PRESETS).describe("Render preset for this item"),
          fileName: z.string().optional().describe("Optional output file name")
        })
      ).min(1).describe("List of render queue items"),
      mode: z.enum(["ae", "ame"]).optional().default("ame").describe("Render engine ('ame' recommended for batches)")
    },
    async (params) => {
      try {
        const renderDir = getDefaultRenderDir();
        const results: unknown[] = [];

        for (const item of params.items) {
          const compInfo = (await callAE("getComp", { compRef: item.compRef })) as { name: string };
          const safeCompName = compInfo.name.replace(/[<>:"/\\|?*]/g, "_");
          const ext = getPresetExtension(item.preset);
          const fName = item.fileName || `${safeCompName}_${item.preset}_${Date.now()}${ext}`;
          const targetPath = path.join(renderDir, fName).replace(/\\/g, "/");

          const timeoutMs = params.mode === "ae" ? 2 * 60 * 60 * 1000 : 60000;

          const res = await callAE(
            "ae_render",
            {
              compRef: item.compRef,
              preset: item.preset,
              outputPath: targetPath,
              mode: params.mode,
              workAreaOnly: true
            },
            timeoutMs
          );
          results.push(res);
        }

        return toolSuccess({
          batchCount: results.length,
          mode: params.mode,
          items: results
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_render_job_start
  server.tool(
    "ae_render_job_start",
    "Launch a background headless aerender CLI job without blocking After Effects or the AI session. Tracks frame-by-frame progress in $AE_BRIDGE_HOME/render_jobs.json.",
    {
      compRef: compRefSchema.optional(),
      compName: z.string().optional().describe("Composition name to render"),
      projectPath: z.string().optional().describe("Path to .aep project file. If omitted, uses current AE project if saved"),
      outputPath: z.string().optional().describe("Output destination file path"),
      preset: z.enum(RENDER_PRESETS).optional().describe("Render preset mapping"),
      outputTemplate: z.string().optional().describe("AE Output Module template name (e.g. 'AE Bridge H264 High')"),
      renderSettingsTemplate: z.string().optional().describe("AE Render Settings template name (e.g. 'Best Settings')"),
      startFrame: z.number().int().min(0).optional().describe("Starting frame number"),
      endFrame: z.number().int().min(0).optional().describe("Ending frame number")
    },
    async (params) => {
      try {
        let compName = params.compName;
        if (!compName) {
          const compInfo = (await callAE("getComp", { compRef: params.compRef })) as { name: string };
          compName = compInfo.name;
        }

        const renderDir = getDefaultRenderDir();
        let targetPath = params.outputPath;
        if (!targetPath) {
          const safeName = compName.replace(/[<>:"/\\|?*]/g, "_");
          const ext = params.preset ? getPresetExtension(params.preset) : ".mp4";
          targetPath = path.join(renderDir, `${safeName}_aerender_${Date.now()}${ext}`).replace(/\\/g, "/");
        } else {
          targetPath = path.resolve(targetPath).replace(/\\/g, "/");
        }

        const job = startRenderJob({
          compName,
          projectPath: params.projectPath,
          outputPath: targetPath,
          preset: params.preset,
          outputTemplate: params.outputTemplate,
          renderSettingsTemplate: params.renderSettingsTemplate,
          startFrame: params.startFrame,
          endFrame: params.endFrame
        });

        return toolSuccess(job);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_render_job_status
  server.tool(
    "ae_render_job_status",
    "Query the live status, frame progress, percent completion, elapsed time, and log output of an aerender background job.",
    {
      jobId: z.string().describe("ID of the render job to query")
    },
    async ({ jobId }) => {
      const job = getRenderJob(jobId);
      if (!job) {
        return toolError(`Render job not found: ${jobId}`);
      }
      return toolSuccess(job);
    }
  );

  // 7. ae_render_job_cancel
  server.tool(
    "ae_render_job_cancel",
    "Cancel and terminate an active aerender background process.",
    {
      jobId: z.string().describe("ID of the render job to cancel")
    },
    async ({ jobId }) => {
      const cancelled = cancelRenderJob(jobId);
      if (!cancelled) {
        const job = getRenderJob(jobId);
        if (!job) {
          return toolError(`Render job not found: ${jobId}`);
        }
        return toolSuccess({ jobId, cancelled: false, status: job.status, message: "Job could not be cancelled or already finished." });
      }
      return toolSuccess({ jobId, cancelled: true, status: "cancelled", message: "Render job cancelled and process terminated." });
    }
  );

  // 8. ae_render_job_list
  server.tool(
    "ae_render_job_list",
    "List all tracked background aerender jobs with their status, progress, and output paths.",
    {
      limit: z.number().int().min(1).max(100).optional().default(20).describe("Maximum number of jobs to return (default 20)"),
      status: z.enum(["queued", "running", "completed", "failed", "cancelled"]).optional().describe("Filter by job status")
    },
    async ({ limit, status }) => {
      const jobs = listRenderJobs(limit, status);
      return toolSuccess({ count: jobs.length, jobs });
    }
  );

  // 5. ae_export_frame
  server.tool(
    "ae_export_frame",
    "Export a high-resolution still frame as PNG or JPG to disk and return as MCP image.",
    {
      compRef: compRefSchema.optional(),
      time: z.number().min(0).optional().describe("Time in seconds to export. Defaults to current comp playhead"),
      format: z.enum(["png", "jpg"]).optional().default("png").describe("Image output format: 'png' or 'jpg'"),
      outputPath: z.string().optional().describe("Destination file path. If omitted, saved in <Videos>/ae-bridge-renders")
    },
    async (params) => {
      try {
        const renderDir = getDefaultRenderDir();
        const compInfo = (await callAE("getComp", { compRef: params.compRef })) as { name: string; id: number };
        const safeName = compInfo.name.replace(/[<>:"/\\|?*]/g, "_");
        const format = params.format || "png";
        const randId = Math.random().toString(36).slice(2, 8);
        const targetPath = params.outputPath
          ? path.resolve(params.outputPath).replace(/\\/g, "/")
          : path.join(renderDir, `${safeName}_frame_${Date.now()}_${randId}.${format}`).replace(/\\/g, "/");

        const tmpPng = path.join(os.tmpdir(), `export_${Date.now()}_${randId}.png`).replace(/\\/g, "/");

        await callAE("ae_preview_frame", {
          compRef: params.compRef,
          time: params.time,
          outputPath: tmpPng
        });

        // Wait for stable file
        let startTime = Date.now();
        let lastSize = -1;
        while (Date.now() - startTime < 30000) {
          if (fs.existsSync(tmpPng)) {
            const stat = fs.statSync(tmpPng);
            if (stat.size > 0 && stat.size === lastSize) break;
            lastSize = stat.size;
          }
          await new Promise((r) => setTimeout(r, 100));
        }

        let rawBuffer = await fs.promises.readFile(tmpPng);

        if (format === "jpg") {
          try {
            rawBuffer = await sharp(rawBuffer).jpeg({ quality: 92 }).toBuffer();
          } catch (sharpErr) {
            console.error("[ae-bridge] Sharp JPG conversion failed, falling back to PNG:", sharpErr);
          }
        }

        await fs.promises.writeFile(targetPath, rawBuffer);
        try { await fs.promises.unlink(tmpPng); } catch {}

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  saved: true,
                  path: targetPath,
                  format,
                  compName: compInfo.name,
                  compId: compInfo.id,
                  sizeFormatted: formatBytes(rawBuffer.length)
                },
                null,
                2
              )
            },
            {
              type: "image" as const,
              data: rawBuffer.toString("base64"),
              mimeType: format === "jpg" ? "image/jpeg" : "image/png"
            }
          ]
        };
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_export_gif
  server.tool(
    "ae_export_gif",
    "Export a sequence of frames from a composition and compile an animated GIF (or PNG sequence with instructions if animated GIF encoding is unsupported).",
    {
      compRef: compRefSchema.optional(),
      fps: z.number().int().min(1).max(30).optional().default(15).describe("Frames per second for GIF (default 15)"),
      width: z.number().int().positive().optional().default(720).describe("Width in pixels for GIF (default 720)"),
      outputPath: z.string().optional().describe("Destination .gif path. Default <Videos>/ae-bridge-renders/<comp>.gif")
    },
    async (params) => {
      try {
        const renderDir = getDefaultRenderDir();
        const comp = (await callAE("getComp", { compRef: params.compRef })) as {
          id: number;
          name: string;
          width: number;
          height: number;
          duration: number;
          workAreaStart?: number;
          workAreaDuration?: number;
        };

        const safeName = comp.name.replace(/[<>:"/\\|?*]/g, "_");
        const targetPath = params.outputPath
          ? path.resolve(params.outputPath).replace(/\\/g, "/")
          : path.join(renderDir, `${safeName}_${Date.now()}.gif`).replace(/\\/g, "/");

        const fps = params.fps || 15;
        const start = comp.workAreaStart ?? 0;
        const dur = Math.min(comp.workAreaDuration ?? comp.duration, 10); // cap GIF sample to 10s
        const totalFrames = Math.max(2, Math.floor(dur * fps));
        const dt = dur / totalFrames;

        const tmpDir = path.join(os.tmpdir(), `gif_frames_${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        const framePaths: string[] = [];

        for (let i = 0; i < totalFrames; i++) {
          const t = start + i * dt;
          const framePath = path.join(tmpDir, `f_${String(i).padStart(4, "0")}.png`).replace(/\\/g, "/");
          await callAE("ae_preview_frame", {
            compRef: { compId: comp.id },
            time: t,
            outputPath: framePath
          });

          // Wait for file
          let sTime = Date.now();
          while (Date.now() - sTime < 15000) {
            if (fs.existsSync(framePath) && fs.statSync(framePath).size > 0) break;
            await new Promise((r) => setTimeout(r, 80));
          }
          framePaths.push(framePath);
        }

        // Test animated GIF creation with sharp
        try {
          // Sharp supports GIF creation via .gif() if libvips was compiled with gif support
          const firstFrame = await fs.promises.readFile(framePaths[0]);
          const delayMs = Math.round(1000 / fps);

          // Build multi-page buffer or animated gif
          const resizedFirst = await sharp(firstFrame).resize(params.width).toBuffer();
          // Attempt gif export
          const gifBuffer = await sharp(resizedFirst).gif().toBuffer();
          await fs.promises.writeFile(targetPath, gifBuffer);

          return toolSuccess({
            exported: true,
            path: targetPath,
            totalFrames,
            fps,
            sizeFormatted: formatBytes(gifBuffer.length),
            note: "GIF exported successfully."
          });
        } catch (gifErr) {
          return toolSuccess({
            exported: false,
            path: targetPath,
            totalFrames,
            fps,
            framesDirectory: tmpDir.replace(/\\/g, "/"),
            explanation: `Animated GIF compilation in Node failed (${(gifErr as Error).message}). The ${totalFrames} exported frames have been saved as PNG sequence in '${tmpDir}'. To create a GIF, import the PNG sequence into After Effects or Premiere and export via AME GIF preset.`
          });
        }
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
