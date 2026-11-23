import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, propertyPathSchema, toolSuccess, toolError } from "./schemas.js";

export const EXPRESSION_CONTROL_TYPES = [
  "slider",
  "angle",
  "checkbox",
  "color",
  "point",
  "point3d",
  "layer",
  "dropdown"
] as const;

export const RIG_PRESETS = [
  "wiggle",
  "smoothWiggle",
  "loop",
  "bounce",
  "elastic",
  "pendulum",
  "orbit",
  "flicker",
  "counter",
  "typeCursor",
  "delayFollow",
  "audioReact",
  "autoFade",
  "lookAt",
  "breathing",
  "scaleToBeat"
] as const;

export function registerRigTools(server: McpServer): void {
  // 1. ae_add_expression_control
  server.tool(
    "ae_add_expression_control",
    "Add an expression control effect to a layer ('slider', 'angle', 'checkbox', 'color', 'point', 'point3d', 'layer', 'dropdown') to drive dynamic rigs and parameters.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to receive the expression control"),
      type: z.enum(EXPRESSION_CONTROL_TYPES).describe("Type of expression control"),
      name: z.string().describe("User-facing label/name of the control"),
      value: z.union([
        z.number(),
        z.boolean(),
        z.string(),
        z.array(z.number())
      ]).optional().describe("Initial control value")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_expression_control", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_link_property
  server.tool(
    "ae_link_property",
    "Create a pick-whip dynamic link connecting targetLayer's property to sourceLayer's property with optional multiplier and offset.",
    {
      compRef: compRefSchema.optional(),
      sourceLayer: layerRefSchema.describe("Source layer being observed"),
      sourcePath: propertyPathSchema.describe("Property path on source layer"),
      targetLayer: layerRefSchema.describe("Target layer receiving the expression"),
      targetPath: propertyPathSchema.describe("Property path on target layer to be driven"),
      multiplier: z.number().optional().default(1).describe("Multiplier scalar for the driven property"),
      offset: z.number().optional().default(0).describe("Constant offset added to the driven property")
    },
    async (params) => {
      try {
        const result = await callAE("ae_link_property", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_apply_rig
  server.tool(
    "ae_apply_rig",
    "Apply a modular dynamic animation expression rig with exposed UI slider controls ('wiggle', 'smoothWiggle', 'loop', 'bounce', 'elastic', 'pendulum', 'orbit', 'flicker', 'counter', 'typeCursor', 'delayFollow', 'audioReact', 'autoFade', 'lookAt', 'breathing', 'scaleToBeat').",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      path: propertyPathSchema.describe("Property path or shortcut (e.g. 'position', 'scale', 'rotation', 'opacity', 'Source Text')"),
      rig: z.enum(RIG_PRESETS).describe("Animation rig algorithm to apply"),
      options: z.object({
        mode: z.enum(["cycle", "pingpong", "offset"]).optional().describe("Loop mode for 'loop' rig"),
        leader: z.string().optional().describe("Leader layer name for 'delayFollow' rig"),
        targetLayer: z.string().optional().describe("Target layer name for 'lookAt' rig"),
        audioLayer: layerRefSchema.optional().describe("Audio layer for 'audioReact' rig"),
        start: z.number().optional().describe("Starting value for 'counter' rig"),
        end: z.number().optional().describe("Ending target value for 'counter' rig"),
        duration: z.number().optional().describe("Count duration in seconds"),
        decimals: z.number().optional().describe("Decimal precision for 'counter' rig"),
        thousandsSeparator: z.boolean().optional().describe("Whether to format numbers with commas"),
        prefix: z.string().optional().describe("Text prefix (e.g. '$')"),
        suffix: z.string().optional().describe("Text suffix (e.g. '%')")
      }).passthrough().optional().describe("Rig-specific configuration options")
    },
    async (params) => {
      try {
        const result = await callAE("ae_apply_rig", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_list_rigs
  server.tool(
    "ae_list_rigs",
    "List all available procedural expression rigs with descriptions, applicable properties, and UI controls added.",
    {},
    async () => {
      try {
        const result = await callAE("ae_list_rigs", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_bake_expression
  server.tool(
    "ae_bake_expression",
    "Bake an active expression into explicit keyframes across the layer duration, then remove the expression for performance and stability.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Layer containing the expression"),
      path: propertyPathSchema.describe("Property path or shortcut with active expression to bake")
    },
    async (params) => {
      try {
        const result = await callAE("ae_bake_expression", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
