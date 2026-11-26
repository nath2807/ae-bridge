import fs from "fs";
import path from "path";
import https from "https";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolSuccess, toolError } from "./schemas.js";
import {
  findBlenderExecutable,
  setStoredBlenderPath,
  getHdriDir,
  getBlenderRendersDir
} from "../blender/locator.js";
import {
  startBlenderJob,
  runBlenderSyncJob,
  getJobRecord,
  cancelBlenderJob
} from "../blender/jobs.js";
import {
  sceneSpecSchema,
  validateSceneSpec,
  materialPresetEnum,
  cameraMoveEnum,
  physicsPresetEnum,
  type SceneSpec
} from "../blender/spec.js";

const PRESET_CATALOG = {
  materials: [
    "chrome",
    "gold",
    "brushedAluminum",
    "glass",
    "frostedGlass",
    "glossyPlastic",
    "matteClay",
    "ceramic",
    "rubber",
    "carbonFiber",
    "holographic",
    "neonEmission",
    "liquidMetal",
    "marble"
  ],
  lighting: [
    "studioSoft",
    "studioDramatic",
    "rimNeon",
    "sunset",
    "productWhite",
    "darkLuxury",
    "volumetricBeams"
  ],
  cameraMoves: [
    "orbit",
    "orbitHalf",
    "pushIn",
    "pullOut",
    "craneUp",
    "flyThrough",
    "turntable",
    "heroReveal",
    "dollyZoom"
  ],
  physics: [
    "dropAndBounce",
    "shatter",
    "clothReveal",
    "windFlag",
    "scatterFall"
  ],
  procedural: [
    "cubeGridWave",
    "scatterOnSurface",
    "particleField",
    "rings"
  ]
};

export function registerBlenderTools(server: McpServer): void {
  // 1. blender_status
  server.tool(
    "blender_status",
    "Inspect Blender executable detection, hardware GPU acceleration, active version, and asset folders.",
    {},
    async () => {
      try {
        const binPath = findBlenderExecutable();
        let probeResult: any = null;

        if (binPath) {
          try {
            const probeJob = await runBlenderSyncJob({} as any, "status", {}, 10000);
            probeResult = probeJob;
          } catch (e: any) {
            probeResult = { error: e.message };
          }
        }

        const hdriDir = getHdriDir();
        const hdriFiles = fs.existsSync(hdriDir) ? fs.readdirSync(hdriDir).filter(f => /\.(hdr|exr)$/i.test(f)) : [];

        return toolSuccess({
          installed: !!binPath,
          executablePath: binPath,
          hardware: probeResult?.hardware || null,
          blenderVersion: probeResult?.blenderVersion || null,
          eeveeEngine: probeResult?.eeveeEngine || null,
          hdriFolder: hdriDir,
          availableHdris: hdriFiles,
          rendersFolder: getBlenderRendersDir()
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. blender_set_path
  server.tool(
    "blender_set_path",
    "Explicitly configure and persist the path to the Blender executable in ~/.ae-bridge/state.json.",
    {
      path: z.string().describe("Absolute file path to blender.exe (Windows) or blender (macOS/Linux)")
    },
    async (params) => {
      try {
        setStoredBlenderPath(params.path);
        const resolved = findBlenderExecutable();
        return toolSuccess({
          success: true,
          configuredPath: resolved
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. blender_preview
  server.tool(
    "blender_preview",
    "Render an instant EEVEE GPU single frame preview at 960px width, returning the image directly to the agent for visual inspection.",
    {
      spec: sceneSpecSchema.describe("Scene specification to preview"),
      frame: z.number().int().min(1).optional().describe("Frame number to render (defaults to start frame)"),
      maxWidth: z.number().int().positive().optional().default(960).describe("Maximum preview image width in pixels (default 960)")
    },
    async (params) => {
      try {
        const job = await runBlenderSyncJob(
          params.spec,
          "preview",
          {
            frame: params.frame,
            maxWidth: params.maxWidth || 960
          },
          180000 // 3 minutes timeout
        );

        const imgPath = job.outputPaths?.previewPath;
        if (!imgPath || !fs.existsSync(imgPath)) {
          throw new Error(`Preview render failed: image not found at ${imgPath}`);
        }

        const imgBuffer = fs.readFileSync(imgPath);
        const base64Data = imgBuffer.toString("base64");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  jobId: job.id,
                  previewImage: imgPath,
                  frame: params.frame || params.spec.frames?.start || 1,
                  status: "completed",
                  blenderVersion: job.blenderVersion
                },
                null,
                2
              )
            },
            {
              type: "image" as const,
              data: base64Data,
              mimeType: "image/png"
            }
          ]
        };
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. blender_render
  server.tool(
    "blender_render",
    "Dispatch an asynchronous photoreal Blender 3D render job. Returns immediately with jobId for non-blocking monitoring.",
    {
      spec: sceneSpecSchema.describe("Complete SceneSpec definition")
    },
    async (params) => {
      try {
        const job = startBlenderJob(params.spec, "render");
        return toolSuccess({
          jobId: job.id,
          status: job.status,
          outputDir: job.outputDir,
          totalFrames: job.progress.total,
          engine: params.spec.engine || "eevee",
          quality: params.spec.quality || "final"
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. blender_job_status
  server.tool(
    "blender_job_status",
    "Check live progress percentage, estimated frames, compute hardware, and output file paths for an active or finished Blender render job.",
    {
      jobId: z.string().describe("Unique job ID returned by blender_render")
    },
    async (params) => {
      try {
        const job = getJobRecord(params.jobId);
        if (!job) {
          throw new Error(`Blender job with ID '${params.jobId}' not found.`);
        }

        return toolSuccess({
          jobId: job.id,
          action: job.action,
          status: job.status,
          progress: job.progress,
          hardware: job.hardware || null,
          engine: job.engine || null,
          blenderVersion: job.blenderVersion || null,
          outputDir: job.outputDir,
          outputPaths: job.outputPaths,
          createdAt: job.createdAt,
          completedAt: job.completedAt || null,
          error: job.error || null
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. blender_cancel_job
  server.tool(
    "blender_cancel_job",
    "Abort an in-progress Blender background rendering job and terminate its process.",
    {
      jobId: z.string().describe("Unique job ID to cancel")
    },
    async (params) => {
      try {
        const success = cancelBlenderJob(params.jobId);
        return toolSuccess({
          jobId: params.jobId,
          cancelled: success
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 7. blender_save_blend
  server.tool(
    "blender_save_blend",
    "Build the 3D scene from a SceneSpec and save it as an editable .blend project file for manual user tweaking.",
    {
      spec: sceneSpecSchema.describe("Scene specification to serialize"),
      path: z.string().optional().describe("Destination file path for .blend project. If omitted, saved into render folder")
    },
    async (params) => {
      try {
        const job = await runBlenderSyncJob(
          params.spec,
          "save_blend",
          { blendPath: params.path },
          60000
        );

        return toolSuccess({
          success: true,
          blendPath: job.outputPaths.blendPath,
          blenderVersion: job.blenderVersion
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 8. blender_list_presets
  server.tool(
    "blender_list_presets",
    "List available PBR material shaders, studio lighting rigs, cinematic camera moves, physics simulations, and procedural Geometry Nodes presets.",
    {},
    async () => {
      return toolSuccess(PRESET_CATALOG);
    }
  );

  // 9. blender_3d_title
  server.tool(
    "blender_3d_title",
    "High-level generator: Produce a photoreal 3D title card animation with studio lighting, camera move, and seamless cyclorama floor.",
    {
      text: z.string().describe("Headline title text string"),
      font: z.string().optional().describe("Font family name (e.g. 'Montserrat', 'Inter', 'Cinzel') to search in system fonts"),
      material: materialPresetEnum.default("chrome").describe("PBR material preset ('chrome', 'gold', 'glass', etc.)"),
      lighting: z.string().default("studioDramatic").describe("Lighting preset ('studioDramatic', 'rimNeon', 'darkLuxury')"),
      cameraMove: cameraMoveEnum.default("heroReveal").describe("Cinematic camera trajectory ('heroReveal', 'pushIn', 'orbit')"),
      duration: z.number().min(1).max(30).default(5).describe("Duration in seconds (default 5s)"),
      floor: z.boolean().default(true).describe("Whether to include infinite seamless studio cyclorama backdrop"),
      perCharacter: z.boolean().default(false).describe("Whether to stagger drop individual characters kinetic style")
    },
    async (params) => {
      try {
        const fps = 30;
        const totalFrames = Math.round(params.duration * fps);

        const objects: any[] = [
          {
            id: "Title_Text",
            kind: "text",
            params: {
              text: params.text,
              font: params.font,
              extrude: 0.1,
              bevel: 0.02,
              perCharacter: params.perCharacter
            },
            material: {
              preset: params.material
            },
            transform: {
              location: [0, 0, 0]
            }
          }
        ];

        if (params.floor) {
          objects.push({
            id: "Studio_Floor",
            kind: "floor",
            params: { primitive: "cyclorama" },
            material: {
              preset: "matteClay",
              baseColor: "#E2E8F0",
              roughness: 0.6
            }
          });
        }

        const spec: SceneSpec = {
          frames: { start: 1, end: totalFrames, fps },
          resolution: [1920, 1080],
          engine: "eevee",
          quality: "final",
          lighting: params.lighting,
          objects,
          camera: {
            lens: 50.0,
            sensorWidth: 36.0,
            move: params.cameraMove,
            curve: "smooth"
          },
          passes: ["depth"],
          exportCamera: true
        };

        const job = startBlenderJob(spec, "render");
        return toolSuccess({
          jobId: job.id,
          status: "running",
          spec,
          outputDir: job.outputDir
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 10. blender_logo_reveal
  server.tool(
    "blender_logo_reveal",
    "High-level generator: Import an SVG vector logo, extrude to 3D, apply reflective PBR materials, and render with dynamic reveal animation.",
    {
      svgPath: z.string().describe("Absolute file path to the SVG vector file"),
      material: materialPresetEnum.default("gold").describe("PBR material preset ('gold', 'chrome', 'liquidMetal')"),
      lighting: z.string().default("studioDramatic").describe("Studio lighting rig"),
      style: z.enum(["spinSettle", "riseFromFloor", "lightSweep"]).default("spinSettle").describe("Logo reveal choreography style"),
      duration: z.number().min(1).max(20).default(4).describe("Total duration in seconds")
    },
    async (params) => {
      try {
        const fps = 30;
        const totalFrames = Math.round(params.duration * fps);

        const spec: SceneSpec = {
          frames: { start: 1, end: totalFrames, fps },
          resolution: [1920, 1080],
          engine: "eevee",
          quality: "final",
          lighting: params.lighting,
          objects: [
            {
              id: "Hero_Logo",
              kind: "logoSvg",
              params: {
                svgPath: params.svgPath,
                extrude: 0.08,
                bevel: 0.02,
                style: params.style
              },
              material: {
                preset: params.material
              }
            },
            {
              id: "Studio_Floor",
              kind: "floor",
              params: { primitive: "cyclorama" },
              material: {
                preset: "matteClay",
                baseColor: "#0F172A",
                roughness: 0.8
              }
            }
          ],
          camera: {
            lens: 65.0,
            sensorWidth: 36.0,
            move: "pushIn",
            curve: "smooth"
          },
          passes: ["depth"],
          exportCamera: true
        };

        const job = startBlenderJob(spec, "render");
        return toolSuccess({
          jobId: job.id,
          status: "running",
          outputDir: job.outputDir
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 11. blender_product_shot
  server.tool(
    "blender_product_shot",
    "High-level generator: Import a 3D model (.glb/.gltf/.obj/.fbx) and render an Apple-style commercial turntable or floating orbit showcase.",
    {
      modelPath: z.string().describe("Absolute file path to 3D model file"),
      style: z.enum(["turntable", "heroOrbit", "floatingReveal"]).default("heroOrbit").describe("Showcase trajectory style"),
      background: z.enum(["cyclorama", "transparent"]).default("cyclorama").describe("Background setting"),
      lighting: z.string().default("productWhite").describe("Lighting setup ('productWhite', 'studioDramatic', 'darkLuxury')"),
      duration: z.number().min(1).max(30).default(5).describe("Duration in seconds")
    },
    async (params) => {
      try {
        const fps = 30;
        const totalFrames = Math.round(params.duration * fps);

        const objects: any[] = [
          {
            id: "Product_Model",
            kind: "model",
            params: {
              modelPath: params.modelPath,
              targetSize: 2.2
            }
          }
        ];

        if (params.background === "cyclorama") {
          objects.push({
            id: "Product_Floor",
            kind: "floor",
            params: { primitive: "cyclorama" }
          });
        }

        const camMove = params.style === "turntable" ? "orbit" : (params.style === "heroOrbit" ? "orbitHalf" : "pushIn");

        const spec: SceneSpec = {
          frames: { start: 1, end: totalFrames, fps },
          resolution: [1920, 1080],
          engine: "eevee",
          quality: "final",
          lighting: params.lighting,
          objects,
          camera: {
            lens: 50.0,
            sensorWidth: 36.0,
            move: camMove,
            curve: "smooth"
          },
          passes: ["depth"],
          exportCamera: true
        };

        const job = startBlenderJob(spec, "render");
        return toolSuccess({
          jobId: job.id,
          status: "running",
          outputDir: job.outputDir
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 12. blender_physics_shot
  server.tool(
    "blender_physics_shot",
    "High-level generator: Simulate dynamic physical interactions (dropAndBounce, shatter, clothReveal, scatterFall, windFlag) and render.",
    {
      preset: physicsPresetEnum.describe("Physical simulation preset"),
      text: z.string().optional().describe("Optional text for shatter or drop target"),
      modelPath: z.string().optional().describe("Optional 3D model path to simulate"),
      material: materialPresetEnum.default("chrome").describe("PBR material preset"),
      duration: z.number().min(1).max(20).default(4).describe("Duration in seconds")
    },
    async (params) => {
      try {
        const fps = 30;
        const totalFrames = Math.round(params.duration * fps);

        const objects: any[] = [];
        let targetId = "Hero_Sim_Target";

        if (params.text) {
          objects.push({
            id: targetId,
            kind: "text",
            params: { text: params.text, extrude: 0.12 },
            material: { preset: params.material }
          });
        } else if (params.modelPath) {
          objects.push({
            id: targetId,
            kind: "model",
            params: { modelPath: params.modelPath, targetSize: 1.8 },
            material: { preset: params.material }
          });
        }

        const spec: SceneSpec = {
          frames: { start: 1, end: totalFrames, fps },
          resolution: [1920, 1080],
          engine: "eevee",
          quality: "final",
          lighting: "studioDramatic",
          objects,
          physics: [
            {
              preset: params.preset,
              targetId: objects.length > 0 ? targetId : undefined,
              material: { preset: params.material }
            }
          ],
          camera: {
            lens: 50.0,
            sensorWidth: 36.0,
            move: "pushIn",
            curve: "smooth"
          },
          passes: ["depth"],
          exportCamera: true
        };

        const job = startBlenderJob(spec, "render");
        return toolSuccess({
          jobId: job.id,
          status: "running",
          outputDir: job.outputDir
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 13. blender_hdri_fetch
  server.tool(
    "blender_hdri_fetch",
    "Download CC0 HDRIs from the public Poly Haven API into ~/.ae-bridge/hdri (or list available local and recommended HDRIs).",
    {
      name: z.string().optional().describe("Poly Haven HDRI identifier (e.g. 'studio_small_08', 'aerodynamics_workshop', 'modern_buildings_2'). If omitted, lists available local and popular HDRIs")
    },
    async (params) => {
      try {
        const hdriDir = getHdriDir();
        const localFiles = fs.readdirSync(hdriDir).filter(f => /\.(hdr|exr)$/i.test(f));

        const popularList = [
          "studio_small_08",
          "aerodynamics_workshop",
          "modern_buildings_2",
          "dranger_suburb",
          "autumn_forest_01"
        ];

        if (!params.name) {
          return toolSuccess({
            localHdriFolder: hdriDir,
            downloadedHdris: localFiles,
            recommendedHdris: popularList,
            usage: "Pass name='studio_small_08' to download the 1k/2k HDR map directly into the hdri folder."
          });
        }

        const cleanName = params.name.trim().toLowerCase();
        const targetFile = path.join(hdriDir, `${cleanName}_1k.hdr`).replace(/\\/g, "/");

        if (fs.existsSync(targetFile)) {
          return toolSuccess({
            downloaded: false,
            alreadyExists: true,
            hdriPath: targetFile,
            name: cleanName
          });
        }

        // Direct CDN download from Poly Haven
        const cdnUrl = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${cleanName}_1k.hdr`;

        await new Promise((resolve, reject) => {
          const fileStream = fs.createWriteStream(targetFile);
          https.get(cdnUrl, (res) => {
            if (res.statusCode === 200) {
              res.pipe(fileStream);
              fileStream.on("finish", () => {
                fileStream.close();
                resolve(true);
              });
            } else if (res.statusCode === 301 || res.statusCode === 302) {
              const redirectUrl = res.headers.location;
              if (redirectUrl) {
                https.get(redirectUrl, (redRes) => {
                  redRes.pipe(fileStream);
                  fileStream.on("finish", () => {
                    fileStream.close();
                    resolve(true);
                  });
                }).on("error", reject);
              } else {
                reject(new Error(`Redirect location missing: ${res.statusCode}`));
              }
            } else {
              fileStream.close();
              try { fs.unlinkSync(targetFile); } catch {}
              reject(new Error(`Poly Haven download failed with HTTP status ${res.statusCode}`));
            }
          }).on("error", (e) => {
            try { fs.unlinkSync(targetFile); } catch {}
            reject(e);
          });
        });

        return toolSuccess({
          downloaded: true,
          name: cleanName,
          hdriPath: targetFile,
          folder: hdriDir
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 14. blender_validate_spec
  server.tool(
    "blender_validate_spec",
    "Pre-validate a Blender SceneSpec JSON payload against the full schema before launching a render job, checking object definitions, materials, lighting, and camera paths.",
    {
      spec: z.record(z.any()).describe("SceneSpec dictionary to validate")
    },
    async ({ spec }) => {
      const result = validateSceneSpec(spec);
      return toolSuccess(result);
    }
  );
}
