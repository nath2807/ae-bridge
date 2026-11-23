import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";

export function registerEditingTools(server: McpServer): void {
  // 1. ae_add_footage_to_comp
  server.tool(
    "ae_add_footage_to_comp",
    "Add a footage asset from the project bins into a composition with optional trim, timing, and aspect scaling.",
    {
      compRef: compRefSchema.optional(),
      itemId: z.number().int().describe("Project item ID of the footage or media asset"),
      startTime: z.number().min(0).optional().default(0).describe("Timeline start time in seconds (default 0)"),
      inPoint: z.number().min(0).optional().describe("Optional source in-point trim in seconds"),
      outPoint: z.number().positive().optional().describe("Optional source out-point trim in seconds"),
      fit: z.enum(["none", "fit", "fill", "stretch"]).optional().default("none").describe("Aspect ratio fit mode")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_footage_to_comp", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_trim_layer
  server.tool(
    "ae_trim_layer",
    "Trim a layer's in-point and/or out-point without moving its source content or keyframe timing.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to trim"),
      inPoint: z.number().min(0).optional().describe("New layer in-point time in seconds"),
      outPoint: z.number().positive().optional().describe("New layer out-point time in seconds")
    },
    async (params) => {
      try {
        const result = await callAE("ae_trim_layer", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_split_layer
  server.tool(
    "ae_split_layer",
    "Split a layer into two at a specific point in time (creates a duplicate with matching in/out cuts).",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Layer to split"),
      time: z.number().min(0).describe("Split timestamp in seconds")
    },
    async (params) => {
      try {
        const result = await callAE("ae_split_layer", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_sequence_layers
  server.tool(
    "ae_sequence_layers",
    "Arrange multiple layers back-to-back in timeline order with optional gap or overlap.",
    {
      compRef: compRefSchema.optional(),
      layerRefs: z.array(layerRefSchema).min(1).describe("Ordered array of layer references to sequence"),
      startTime: z.number().min(0).optional().default(0).describe("Start time in seconds for the first clip (default 0)"),
      gap: z.number().optional().default(0).describe("Gap in seconds between clips (negative values create cross-fade overlaps)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_sequence_layers", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_ripple_delete
  server.tool(
    "ae_ripple_delete",
    "Delete a layer from the composition and shift all subsequent layers to close the gap.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to ripple delete")
    },
    async (params) => {
      try {
        const result = await callAE("ae_ripple_delete", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_fit_layer
  server.tool(
    "ae_fit_layer",
    "Scale and center a layer to fit, fill, or stretch to the composition dimensions.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to fit"),
      mode: z.enum(["fit", "fill", "stretch"]).describe("Fitting mode ('fit' preserves aspect, 'fill' crops, 'stretch' skews)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_fit_layer", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 7. ae_build_edit
  server.tool(
    "ae_build_edit",
    "High-level AI timeline builder: construct an entire edited video composition from a structured edit decision list (EDL) in one call.",
    {
      compRef: compRefSchema.optional().describe("Optional existing comp to place the edit into (if omitted, a new comp is created)"),
      name: z.string().optional().describe("Name of the newly created composition (default 'AI Master Edit')"),
      width: z.number().int().positive().optional().default(1920).describe("Composition width in pixels"),
      height: z.number().int().positive().optional().default(1080).describe("Composition height in pixels"),
      frameRate: z.number().positive().optional().default(30).describe("Composition frame rate in fps"),
      clips: z.array(
        z.object({
          itemId: z.number().int().describe("Project footage item ID"),
          sourceIn: z.number().min(0).optional().describe("Source in-point in seconds"),
          sourceOut: z.number().positive().optional().describe("Source out-point in seconds"),
          speed: z.number().optional().default(100).describe("Playback speed percentage (e.g. 100 for normal, 200 for 2x fast-motion, 50 for slow-motion)"),
          transition: z.object({
            type: z.string().describe("Transition type (e.g. 'crossDissolve', 'whipPan', 'zoomIn')"),
            duration: z.number().positive().optional().default(0.5).describe("Transition duration in seconds")
          }).optional().describe("Optional incoming transition from previous clip")
        })
      ).min(1).describe("List of clips in timeline order"),
      musicItemId: z.number().int().optional().describe("Optional background music track footage item ID")
    },
    async (params) => {
      try {
        const result = await callAE("ae_build_edit", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
