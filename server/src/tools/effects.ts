import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";

export function registerEffectTools(server: McpServer): void {
  // 1. ae_list_installed_effects
  server.tool(
    "ae_list_installed_effects",
    "List all installed After Effects plugins and effects with display names, matchNames, and categories.",
    {
      filter: z.string().optional().describe("Case-insensitive keyword to filter effect names, matchNames, or categories")
    },
    async (params) => {
      try {
        const result = await callAE("ae_list_installed_effects", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_add_effect
  server.tool(
    "ae_add_effect",
    "Add an effect to a layer in After Effects and optionally initialize its property values.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      effect: z.string().describe("Effect display name or matchName (e.g. 'Gaussian Blur' or 'ADBE Gaussian Blur 2')"),
      properties: z.record(z.any()).optional().describe("Initial property values to assign (e.g. { 'Blurriness': 25 })")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_effect", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_set_effect_property
  server.tool(
    "ae_set_effect_property",
    "Set the value of an effect parameter on a layer (supports numbers, arrays, booleans, and colors).",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      effect: z.union([z.string(), z.number()]).describe("Effect display name, matchName, or 1-based index"),
      property: z.string().describe("Property name on the effect (e.g. 'Blurriness' or 'Color')"),
      value: z.union([
        z.number(),
        z.string(),
        z.boolean(),
        z.array(z.number())
      ]).describe("Value to assign (scalar, array, or hex color)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_effect_property", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_list_layer_effects
  server.tool(
    "ae_list_layer_effects",
    "List all effects applied to a layer including their enabled state and current parameter values.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer")
    },
    async (params) => {
      try {
        const result = await callAE("ae_list_layer_effects", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_remove_effect
  server.tool(
    "ae_remove_effect",
    "Remove an effect from a layer by name or 1-based index.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      effect: z.union([z.string(), z.number()]).describe("Effect name, matchName, or 1-based index to remove")
    },
    async (params) => {
      try {
        const result = await callAE("ae_remove_effect", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
