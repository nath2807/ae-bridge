import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

export function registerScene3dTools(server: McpServer): void {
  // 1. ae_set_3d_renderer
  server.tool(
    "ae_set_3d_renderer",
    "Configure composition 3D rendering engine ('classic' for Classic 3D, 'advanced' for Advanced 3D with extrusions, 'cinema4d' for C4D engine).",
    {
      compRef: compRefSchema.optional(),
      renderer: z.enum(["classic", "advanced", "cinema4d"]).describe("Target 3D rendering engine")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_3d_renderer", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_make_3d
  server.tool(
    "ae_make_3d",
    "Toggle 3D layer switch on one or multiple layers in a composition.",
    {
      compRef: compRefSchema.optional(),
      layerRefs: z.array(layerRefSchema).min(1).describe("List of target layers to toggle 3D"),
      enabled: z.boolean().optional().default(true).describe("Whether 3D should be enabled or disabled")
    },
    async (params) => {
      try {
        const result = await callAE("ae_make_3d", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_set_extrusion
  server.tool(
    "ae_set_extrusion",
    "Set 3D geometric extrusion depth and bevel parameters on text or shape layers (auto-switches comp renderer to Advanced 3D if needed).",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target text or shape layer"),
      depth: z.number().min(0).describe("Extrusion depth in pixels"),
      bevelStyle: z.enum(["none", "angular", "concave", "convex"]).optional().describe("Bevel edge profile style"),
      bevelDepth: z.number().min(0).optional().describe("Bevel edge depth in pixels"),
      holeBevelDepth: z.number().min(0).optional().describe("Bevel depth for interior holes (e.g. letters 'O', 'A')")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_extrusion", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_set_material
  server.tool(
    "ae_set_material",
    "Set 3D physical material options (shadow casting, light reception, ambient, diffuse, specular, shininess, metal, reflection) on any 3D layer.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target 3D layer"),
      castsShadows: z.boolean().optional().describe("Whether layer casts shadows (on/off)"),
      acceptsShadows: z.boolean().optional().describe("Whether layer receives shadows from other objects"),
      acceptsLights: z.boolean().optional().describe("Whether layer is illuminated by scene lights"),
      ambient: z.number().min(0).max(100).optional().describe("Ambient light reflection percentage (0-100)"),
      diffuse: z.number().min(0).max(100).optional().describe("Diffuse light reflection percentage (0-100)"),
      specular: z.number().min(0).max(100).optional().describe("Specular highlight intensity percentage (0-100)"),
      shininess: z.number().min(0).max(100).optional().describe("Specular shininess/roughness percentage (0-100)"),
      metal: z.number().min(0).max(100).optional().describe("Metallic specular reflection percentage (0-100)"),
      reflection: z.number().min(0).max(100).optional().describe("Surface environment reflection intensity percentage (0-100)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_material", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_import_3d_model
  server.tool(
    "ae_import_3d_model",
    "Import an external 3D model (.glb, .gltf, .obj) into the After Effects project and place it in a 3D composition (After Effects 2024+).",
    {
      path: z.string().describe("Absolute file path to the 3D model file (.glb, .gltf, .obj)"),
      compRef: compRefSchema.optional().describe("Optional composition to add the 3D model into"),
      position: z.array(z.number()).min(3).max(3).optional().describe("3D position [x, y, z] in pixels"),
      scale: z.array(z.number()).min(3).max(3).optional().describe("3D scale [x, y, z] percentage")
    },
    async (params) => {
      try {
        const result = await callAE("ae_import_3d_model", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_create_3d_primitive
  server.tool(
    "ae_create_3d_primitive",
    "Create a procedural 3D geometric primitive ('box', 'cylinder', 'plane', 'ring') as an extruded shape layer.",
    {
      compRef: compRefSchema.optional(),
      type: z.enum(["box", "cylinder", "plane", "ring"]).describe("Primitive geometry type"),
      size: z.array(z.number()).min(2).max(3).describe("Dimensions [width, height, depth] in pixels"),
      color: colorSchema.optional().describe("Surface color (hex string or [r, g, b] array)"),
      name: z.string().optional().describe("Custom layer name")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_3d_primitive", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 7. ae_arrange_3d
  server.tool(
    "ae_arrange_3d",
    "Arrange multiple 3D layers in space according to geometric patterns ('grid', 'circle', 'spiral', 'depthStack', 'random', 'helix').",
    {
      compRef: compRefSchema.optional(),
      layerRefs: z.array(layerRefSchema).min(1).describe("Ordered list of 3D layers to arrange"),
      pattern: z.enum(["grid", "circle", "spiral", "depthStack", "random", "helix"]).describe("Spatial arrangement pattern"),
      spacing: z.number().optional().default(200).describe("Distance/spacing between layers in pixels"),
      radius: z.number().optional().default(500).describe("Radius for circular, spiral, or helix patterns")
    },
    async (params) => {
      try {
        const result = await callAE("ae_arrange_3d", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
