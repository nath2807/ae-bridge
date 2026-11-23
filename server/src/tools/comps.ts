import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

export function registerCompTools(server: McpServer): void {
  // 1. ae_create_comp
  server.tool(
    "ae_create_comp",
    "Create a new composition in After Effects with custom dimensions, duration, and frame rate.",
    {
      name: z.string().describe("Name of the new composition"),
      width: z.number().int().positive().optional().default(1920).describe("Width in pixels (default 1920)"),
      height: z.number().int().positive().optional().default(1080).describe("Height in pixels (default 1080)"),
      duration: z.number().positive().optional().default(10).describe("Duration in seconds (default 10)"),
      frameRate: z.number().positive().optional().default(30).describe("Frame rate in fps (default 30)"),
      pixelAspect: z.number().positive().optional().default(1).describe("Pixel aspect ratio (default 1.0)"),
      bgColor: colorSchema.optional().describe("Background color of the composition")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_comp", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_list_comps
  server.tool(
    "ae_list_comps",
    "List all compositions in the current After Effects project with their dimensions and layer counts.",
    {},
    async () => {
      try {
        const result = await callAE("ae_list_comps", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_get_comp
  server.tool(
    "ae_get_comp",
    "Get detailed composition settings, dimensions, frame rate, and summaries of all layers.",
    {
      compRef: compRefSchema.optional()
    },
    async (params) => {
      try {
        const result = await callAE("ae_get_comp", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_update_comp
  server.tool(
    "ae_update_comp",
    "Update settings of an existing composition such as dimensions, duration, frame rate, or work area.",
    {
      compRef: compRefSchema.optional(),
      name: z.string().optional().describe("New composition name"),
      width: z.number().int().positive().optional().describe("New width in pixels"),
      height: z.number().int().positive().optional().describe("New height in pixels"),
      duration: z.number().positive().optional().describe("New duration in seconds"),
      frameRate: z.number().positive().optional().describe("New frame rate in fps"),
      pixelAspect: z.number().positive().optional().describe("New pixel aspect ratio"),
      bgColor: colorSchema.optional().describe("New background color"),
      workAreaStart: z.number().min(0).optional().describe("Work area start time in seconds"),
      workAreaDuration: z.number().positive().optional().describe("Work area duration in seconds")
    },
    async (params) => {
      try {
        const result = await callAE("ae_update_comp", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_open_comp
  server.tool(
    "ae_open_comp",
    "Open a composition in the active After Effects viewer panel.",
    {
      compRef: compRefSchema.optional()
    },
    async (params) => {
      try {
        const result = await callAE("ae_open_comp", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_precompose
  server.tool(
    "ae_precompose",
    "Precompose selected layers into a new nested composition within After Effects.",
    {
      compRef: compRefSchema.optional(),
      layerRefs: z.array(layerRefSchema).describe("List of layer references to precompose"),
      name: z.string().describe("Name of the new precomposition"),
      moveAllAttributes: z.boolean().optional().default(true).describe("Move all attributes into new comp (default true)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_precompose", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 7. ae_duplicate_comp
  server.tool(
    "ae_duplicate_comp",
    "Duplicate an existing composition in the project with an optional new name.",
    {
      compRef: compRefSchema.optional(),
      newName: z.string().optional().describe("Optional new name for the duplicated composition")
    },
    async (params) => {
      try {
        const result = await callAE("ae_duplicate_comp", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 8. ae_delete_item
  server.tool(
    "ae_delete_item",
    "Delete a project item (composition, footage, or folder) from After Effects by its item ID.",
    {
      itemId: z.number().int().describe("ID of the project item to delete")
    },
    async (params) => {
      try {
        const result = await callAE("ae_delete_item", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
