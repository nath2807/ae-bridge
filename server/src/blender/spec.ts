import { z } from "zod";
import { colorSchema } from "../tools/schemas.js";

export const materialPresetEnum = z.enum([
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
]);

export const materialSpecSchema = z.object({
  name: z.string().optional().describe("Unique material identifier"),
  preset: materialPresetEnum.default("chrome").describe("PBR material shader preset"),
  baseColor: colorSchema.optional().describe("Base diffuse or specular tint color (hex or [r,g,b] array)"),
  roughness: z.number().min(0).max(1).optional().describe("Surface microfacet roughness (0.0 mirror to 1.0 matte)"),
  emissionStrength: z.number().min(0).optional().describe("Luminescent emission radiance multiplier"),
  customParams: z.record(z.any()).optional().describe("Additional shader node parameters")
});

export const transformSpecSchema = z.object({
  location: z.array(z.number()).min(3).max(3).optional().describe("World space coordinates [x, y, z] in meters"),
  rotation: z.array(z.number()).min(3).max(3).optional().describe("Euler rotation [rx, ry, rz] in degrees"),
  scale: z.union([z.number(), z.array(z.number()).min(3).max(3)]).optional().describe("Uniform scalar or per-axis scale [sx, sy, sz]")
});

export const keyframeSpecSchema = z.object({
  frame: z.number().int().min(1).describe("Target timeline frame index"),
  location: z.array(z.number()).min(3).max(3).optional(),
  rotation: z.array(z.number()).min(3).max(3).optional(),
  scale: z.union([z.number(), z.array(z.number()).min(3).max(3)]).optional()
});

export const animationSpecSchema = z.object({
  keyframes: z.array(keyframeSpecSchema).default([]).describe("Keyframe animation sequence"),
  curve: z.enum([
    "expoOut",
    "expoInOut",
    "quintOut",
    "backOut",
    "snap",
    "smooth",
    "heavy",
    "elasticOut",
    "linear"
  ]).default("smooth").describe("F-Curve interpolation curve")
});

export const sceneObjectKindEnum = z.enum([
  "text",
  "logoSvg",
  "primitive",
  "model",
  "floor",
  "procedural"
]);

export const sceneObjectSchema = z.object({
  id: z.string().describe("Unique identifier for scene object and AE tracking target"),
  kind: sceneObjectKindEnum.describe("Object generator category"),
  params: z.record(z.any()).default({}).describe("Object specific parameters (e.g. text string, svgPath, modelPath, primitive type)"),
  material: materialSpecSchema.optional().describe("PBR material shader specification"),
  transform: transformSpecSchema.optional().describe("Initial 3D transform placement"),
  animation: animationSpecSchema.optional().describe("Transform keyframe animation definition")
});

export const cameraMoveEnum = z.enum([
  "orbit",
  "orbitHalf",
  "pushIn",
  "pullOut",
  "craneUp",
  "flyThrough",
  "turntable",
  "heroReveal",
  "dollyZoom"
]);

export const cameraSpecSchema = z.object({
  lens: z.number().min(10).max(300).default(50.0).describe("Focal length in millimeters (default 50mm)"),
  sensorWidth: z.number().min(10).max(100).default(36.0).describe("Camera sensor physical horizontal width in mm (default 36mm full-frame)"),
  dof: z.object({
    focus_distance: z.number().optional().describe("Manual focal plane distance in meters"),
    fstop: z.number().min(0.5).max(32).optional().describe("Lens aperture f-number for optical depth of field blur"),
    focus_object: z.string().optional().describe("Target object ID to maintain sharp focus on")
  }).optional().describe("Physical optical depth of field parameters"),
  move: cameraMoveEnum.default("pushIn").describe("Procedural camera trajectory move preset"),
  turntable: z.object({
    radius: z.number().positive().default(5.0).describe("Orbit distance in meters"),
    height: z.number().default(2.0).describe("Camera height in meters"),
    revolutions: z.number().default(1.0).describe("Number of full 360-degree rotations"),
    target: z.array(z.number()).min(3).max(3).default([0, 0, 0]).describe("World-space focus target point [x, y, z]")
  }).optional().describe("Turntable camera orbit parameters"),
  curve: z.string().default("smooth").describe("Named motion curve for camera move easing"),
  keyframes: z.array(z.any()).optional().describe("Custom keyframe overrides if not using procedural move")
});

export const physicsPresetEnum = z.enum([
  "dropAndBounce",
  "shatter",
  "clothReveal",
  "windFlag",
  "scatterFall"
]);

export const physicsSpecSchema = z.object({
  preset: physicsPresetEnum.describe("Physical simulation preset to compute and bake"),
  targetId: z.string().optional().describe("Subject scene object ID to simulate"),
  material: materialSpecSchema.optional().describe("Material specification for simulation shards/bodies")
});

export const sceneSpecSchema = z.object({
  frames: z.object({
    start: z.number().int().min(1).default(1).describe("First frame number"),
    end: z.number().int().min(1).default(90).describe("Last frame number"),
    fps: z.number().int().min(1).max(120).default(30).describe("Timeline playback frame rate")
  }).default({ start: 1, end: 90, fps: 30 }).describe("Frame range and timing specification"),
  resolution: z.array(z.number().int().positive()).min(2).max(2).default([1920, 1080]).describe("Render output frame dimensions [width, height] in pixels"),
  engine: z.enum(["cycles", "eevee"]).default("eevee").describe("Render engine: 'eevee' (Next) for ultra-fast GPU graphics, 'cycles' for path-traced raytracing"),
  quality: z.enum(["preview", "final"]).default("final").describe("Quality tier: 'preview' (fast samples) or 'final' (deep samples & OIDN denoise)"),
  denoiser: z.enum(["optix", "openimagedenoise", "none"]).optional().describe("Denoising backend for Cycles/EEVEE raytracing"),
  world: z.object({
    hdri: z.string().optional().describe("Absolute file path to HDRI environment map (.hdr or .exr)"),
    color: colorSchema.optional().describe("Ambient world background color"),
    strength: z.number().min(0).default(1.0).describe("Environment radiance strength multiplier"),
    rotation: z.number().default(0.0).describe("Z-axis world environment rotation in degrees")
  }).optional().describe("World environment lighting specification"),
  lighting: z.string().default("studioDramatic").describe("Lighting preset ('studioSoft', 'studioDramatic', 'rimNeon', 'sunset', 'productWhite', 'darkLuxury', 'volumetricBeams')"),
  objects: z.array(sceneObjectSchema).default([]).describe("List of 3D objects, typography, models, and primitives in the scene"),
  camera: cameraSpecSchema.default({ lens: 50.0, sensorWidth: 36.0, move: "pushIn", curve: "smooth" }).describe("Physical camera configuration and motion"),
  physics: z.array(physicsSpecSchema).optional().describe("Physical simulations to bake before rendering"),
  passes: z.array(z.string()).default([]).describe("Auxiliary compositor render passes to export (e.g. ['depth', 'mist'])"),
  exportCamera: z.boolean().default(true).describe("Whether to export per-frame camera matrix tracking data to camera.json")
});

export type SceneSpec = z.infer<typeof sceneSpecSchema>;
export type SceneObject = z.infer<typeof sceneObjectSchema>;
export type MaterialSpec = z.infer<typeof materialSpecSchema>;

export function validateSceneSpec(spec: unknown): { valid: boolean; errors?: string[]; spec?: SceneSpec } {
  const result = sceneSpecSchema.safeParse(spec);
  if (result.success) {
    return { valid: true, spec: result.data };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
  };
}
