import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

export function registerLayerTools(server: McpServer): void {
  // 1. ae_add_solid
  server.tool(
    "ae_add_solid",
    "Add a colored solid or adjustment layer to a composition.",
    {
      compRef: compRefSchema.optional(),
      name: z.string().describe("Name of the solid layer"),
      color: colorSchema.describe("Color of the solid layer"),
      width: z.number().int().positive().optional().describe("Width in pixels (defaults to comp width)"),
      height: z.number().int().positive().optional().describe("Height in pixels (defaults to comp height)"),
      adjustment: z.boolean().optional().default(false).describe("Whether to create as an adjustment layer")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_solid", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_add_null
  server.tool(
    "ae_add_null",
    "Add a null object layer to a composition for parenting, rigging, and motion control.",
    {
      compRef: compRefSchema.optional(),
      name: z.string().describe("Name of the null layer")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_null", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_add_text
  server.tool(
    "ae_add_text",
    "Add a text layer with formatting, font, size, fill color, and alignment to a composition.",
    {
      compRef: compRefSchema.optional(),
      text: z.string().describe("Text string content to display"),
      font: z.string().optional().describe("Font family or PostScript font name"),
      fontSize: z.number().positive().optional().default(100).describe("Font size in points (default 100)"),
      fillColor: colorSchema.optional().describe("Text fill color"),
      justification: z.enum(["left", "center", "right"]).optional().describe("Paragraph text alignment"),
      position: z.tuple([z.number(), z.number()]).optional().describe("2D position [x, y] in pixels (defaults to comp center)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_text", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_add_shape
  server.tool(
    "ae_add_shape",
    "Add a parametric shape layer (rectangle, ellipse, star, or polygon) with optional fill, stroke, and roundness.",
    {
      compRef: compRefSchema.optional(),
      name: z.string().describe("Name of the shape layer"),
      shape: z.enum(["rectangle", "ellipse", "star", "polygon"]).describe("Parametric shape geometry"),
      size: z.tuple([z.number(), z.number()]).describe("Shape dimensions [width, height] in pixels"),
      fillColor: colorSchema.optional().describe("Shape fill color"),
      strokeColor: colorSchema.optional().describe("Shape stroke color"),
      strokeWidth: z.number().min(0).optional().describe("Stroke width in pixels"),
      roundness: z.number().min(0).optional().describe("Corner roundness in pixels")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_shape", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_add_camera
  server.tool(
    "ae_add_camera",
    "Add a 3D camera layer to a composition with an optional lens preset and 3D position.",
    {
      compRef: compRefSchema.optional(),
      name: z.string().describe("Name of the camera layer"),
      preset: z.enum(["35mm", "50mm", "85mm"]).optional().describe("Lens focal length preset"),
      position: z.tuple([z.number(), z.number(), z.number()]).optional().describe("Initial 3D position [x, y, z] in pixels")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_camera", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_add_light
  server.tool(
    "ae_add_light",
    "Add a light layer (point, spot, parallel, or ambient) to illuminate 3D layers in a composition.",
    {
      compRef: compRefSchema.optional(),
      name: z.string().describe("Name of the light layer"),
      type: z.enum(["point", "spot", "parallel", "ambient"]).describe("Type of light"),
      color: colorSchema.optional().describe("Color of emitted light"),
      intensity: z.number().optional().describe("Light intensity percentage (default 100)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_light", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 7. ae_list_layers
  server.tool(
    "ae_list_layers",
    "List all layers in a composition with summaries of their types, switches, timing, and parent hierarchy.",
    {
      compRef: compRefSchema.optional()
    },
    async (params) => {
      try {
        const result = await callAE("ae_list_layers", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 8. ae_update_layer
  server.tool(
    "ae_update_layer",
    "Update layer properties including switches, timing, blend mode, label color, and parent link.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to update"),
      name: z.string().optional().describe("New layer name"),
      enabled: z.boolean().optional().describe("Layer visibility switch"),
      solo: z.boolean().optional().describe("Layer solo switch"),
      locked: z.boolean().optional().describe("Layer lock switch"),
      shy: z.boolean().optional().describe("Layer shy switch"),
      threeD: z.boolean().optional().describe("Layer 3D switch"),
      inPoint: z.number().optional().describe("Layer in-point time in seconds"),
      outPoint: z.number().optional().describe("Layer out-point time in seconds"),
      startTime: z.number().optional().describe("Layer start time in seconds"),
      parent: layerRefSchema.nullable().optional().describe("Parent layer reference, or null to unparent"),
      blendMode: z.string().optional().describe("Layer blending mode ('normal', 'add', 'screen', 'multiply', 'overlay', 'softLight', etc.)"),
      label: z.number().int().min(0).max(16).optional().describe("Label color index (0-16)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_update_layer", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 9. ae_set_transform
  server.tool(
    "ae_set_transform",
    "Set static transform values (anchorPoint, position, scale, rotation, opacity) on a layer.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to modify transform on"),
      anchorPoint: z.array(z.number()).optional().describe("Anchor point [x, y] or [x, y, z] in pixels"),
      position: z.array(z.number()).optional().describe("Position [x, y] or [x, y, z] in pixels"),
      scale: z.union([z.number(), z.array(z.number())]).optional().describe("Scale percentage as uniform number or [x, y, z] array"),
      rotation: z.number().optional().describe("Rotation angle in degrees (Z-axis rotation for 3D layers)"),
      rotationX: z.number().optional().describe("X-axis rotation angle in degrees for 3D layers"),
      rotationY: z.number().optional().describe("Y-axis rotation angle in degrees for 3D layers"),
      rotationZ: z.number().optional().describe("Z-axis rotation angle in degrees for 3D layers"),
      orientation: z.tuple([z.number(), z.number(), z.number()]).optional().describe("3D orientation [x, y, z] in degrees"),
      opacity: z.number().min(0).max(100).optional().describe("Opacity percentage (0-100)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_transform", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 10. ae_duplicate_layer
  server.tool(
    "ae_duplicate_layer",
    "Duplicate an existing layer within a composition.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to duplicate")
    },
    async (params) => {
      try {
        const result = await callAE("ae_duplicate_layer", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 11. ae_delete_layer
  server.tool(
    "ae_delete_layer",
    "Delete a layer from a composition.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to delete")
    },
    async (params) => {
      try {
        const result = await callAE("ae_delete_layer", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 12. ae_reorder_layer
  server.tool(
    "ae_reorder_layer",
    "Change the stacking order index of a layer in a composition.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to move"),
      newIndex: z.number().int().positive().describe("Target 1-based index in the layer stack")
    },
    async (params) => {
      try {
        const result = await callAE("ae_reorder_layer", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
