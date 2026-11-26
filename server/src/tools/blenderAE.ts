import fs from "fs";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";
import { getJobRecord, startBlenderJob } from "../blender/jobs.js";

export function registerBlenderAETools(server: McpServer): void {
  // 1. ae_import_blender_render
  server.tool(
    "ae_import_blender_render",
    "Import an exported Blender 3D render sequence (color pass + optional depth pass) into After Effects, sync camera trajectory keyframes from camera.json, and bind 3D tracking nulls.",
    {
      jobId: z.string().optional().describe("Blender job ID to import from"),
      folder: z.string().optional().describe("Direct output directory containing color/ and camera.json"),
      compRef: compRefSchema.optional(),
      fps: z.number().positive().optional().describe("Playback frame rate conforming"),
      addDepthPass: z.boolean().default(true).describe("Whether to import and link the normalized Z-depth pass"),
      syncCamera: z.boolean().default(true).describe("Whether to construct an AE 3D camera matching the Blender lens and trajectory"),
      startTime: z.number().min(0).optional().default(0).describe("In-point start time in comp (seconds)")
    },
    async (params) => {
      try {
        let renderFolder: string | null = null;
        if (params.jobId) {
          const job = getJobRecord(params.jobId);
          if (job && job.outputDir) {
            renderFolder = job.outputDir;
          }
        }
        if (!renderFolder && params.folder) {
          renderFolder = params.folder.replace(/\\/g, "/");
        }

        if (!renderFolder || !fs.existsSync(renderFolder)) {
          throw new Error(`Render folder not found. Please specify a valid jobId or folder path: ${renderFolder}`);
        }

        const colorDir = path.join(renderFolder, "color").replace(/\\/g, "/");
        if (!fs.existsSync(colorDir)) {
          throw new Error(`Color pass directory not found at: ${colorDir}`);
        }

        const colorFiles = fs.readdirSync(colorDir).filter((f) => /\.(png|exr|tif|jpg)$/i.test(f)).sort();
        if (colorFiles.length === 0) {
          throw new Error(`No rendered frames found in color directory: ${colorDir}`);
        }
        const firstColorFile = path.join(colorDir, colorFiles[0]).replace(/\\/g, "/");

        let firstDepthFile: string | null = null;
        const depthDir = path.join(renderFolder, "depth").replace(/\\/g, "/");
        if (params.addDepthPass && fs.existsSync(depthDir)) {
          const depthFiles = fs.readdirSync(depthDir).filter((f) => /\.(png|exr|tif)$/i.test(f)).sort();
          if (depthFiles.length > 0) {
            firstDepthFile = path.join(depthDir, depthFiles[0]).replace(/\\/g, "/");
          }
        }

        let cameraData: any = null;
        const camJsonPath = path.join(renderFolder, "camera.json");
        if (params.syncCamera && fs.existsSync(camJsonPath)) {
          try {
            cameraData = JSON.parse(fs.readFileSync(camJsonPath, "utf-8"));
          } catch (eCam) {
            console.warn("[ae-bridge] Warning parsing camera.json:", eCam);
          }
        }

        const result = await callAE("ae_import_blender_render", {
          compRef: params.compRef,
          colorFirstFrame: firstColorFile,
          depthFirstFrame: firstDepthFile,
          cameraData,
          fps: params.fps,
          addDepthPass: params.addDepthPass,
          syncCamera: params.syncCamera,
          startTime: params.startTime || 0
        });

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_depth_effects
  server.tool(
    "ae_depth_effects",
    "Apply cinematic atmospheric depth effects (depth of field optical lens blur, distance fog, or depth mapping) driven by a Blender Z-depth pass layer.",
    {
      compRef: compRefSchema.optional(),
      depthLayerRef: layerRefSchema.describe("Reference to the imported Blender Depth Pass layer"),
      targetLayerRef: layerRefSchema.optional().describe("Target layer to receive optical lens blur (defaults to color pass layer)"),
      effects: z.array(z.enum(["dof", "fog", "colorDepth"])).default(["dof"]).describe("Depth effects to configure"),
      dofRadius: z.number().min(0).max(100).optional().default(15).describe("Maximum optical blur radius for Camera Lens Blur"),
      fogColor: colorSchema.optional().describe("Atmospheric fog tint color")
    },
    async (params) => {
      try {
        const result = await callAE("ae_depth_effects", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_import_3d_asset
  server.tool(
    "ae_import_3d_asset",
    "Import a 3D model asset (glTF/GLB, USD/USDA/USDC/USDZ, FBX, or OBJ) into After Effects or the Blender 3D pipeline with material extraction, lighting, and camera sync.",
    {
      filePath: z.string().describe("Path to local 3D model asset (.glb, .gltf, .usd, .usdz, .fbx, .obj)"),
      compRef: compRefSchema.optional(),
      renderMode: z.enum(["ae_native", "blender"]).optional().default("blender").describe("Import pipeline: 'ae_native' for direct After Effects 3D layer (AE 2024+ for glTF/OBJ) or 'blender' for photoreal PBR rendered sequence with depth pass"),
      materialPreset: z.string().optional().describe("Optional PBR material override for Blender pipeline"),
      cameraMove: z.string().optional().default("turntable").describe("Camera move for Blender pipeline ('turntable', 'pushIn', 'orbit')"),
      frames: z.number().int().min(1).max(300).optional().default(60).describe("Number of frames to render if using Blender pipeline")
    },
    async (params) => {
      try {
        const fullPath = path.resolve(params.filePath).replace(/\\/g, "/");
        if (!fs.existsSync(fullPath)) {
          throw new Error(`3D model file not found at: ${fullPath}`);
        }

        if (params.renderMode === "ae_native") {
          const importRes = await callAE("ae_import_files", {
            files: [fullPath],
            compRef: params.compRef
          });
          return toolSuccess({
            mode: "ae_native",
            file: fullPath,
            result: importRes
          });
        }

        const job = startBlenderJob(
          {
            frames: { start: 1, end: params.frames || 60, fps: 30 },
            resolution: [1920, 1080],
            engine: "eevee",
            quality: "final",
            lighting: "studioDramatic",
            objects: [
              {
                id: "imported_asset",
                kind: "model",
                params: { modelPath: fullPath },
                material: params.materialPreset ? { preset: params.materialPreset as any } : undefined
              }
            ],
            camera: {
              lens: 50.0,
              sensorWidth: 36.0,
              move: (params.cameraMove as any) || "turntable",
              curve: "smooth"
            },
            passes: ["depth"],
            exportCamera: true
          },
          "render"
        );

        return toolSuccess({
          mode: "blender",
          jobId: job.id,
          status: job.status,
          outputDir: job.outputDir,
          message: "3D asset render job started in Blender. Once completed, use ae_import_blender_render to import with depth pass and camera sync."
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
