import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import {
  compRefSchema,
  layerRefSchema,
  propertyPathSchema,
  keyframeItemSchema,
  toolSuccess,
  toolError
} from "./schemas.js";

export function registerAnimationTools(server: McpServer): void {
  // 1. ae_list_properties
  server.tool(
    "ae_list_properties",
    "List animatable properties and groups of a layer in After Effects up to a given depth.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to inspect"),
      path: propertyPathSchema.optional().describe("Optional property or group path to start from"),
      depth: z.number().int().min(1).max(10).optional().default(2).describe("Traversal depth for child groups (default 2)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_list_properties", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_get_property
  server.tool(
    "ae_get_property",
    "Get detailed information, current value, keyframe list, and expression for a property.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      path: propertyPathSchema.describe("Property path (e.g. ['Transform', 'Position'] or shortcut 'position')")
    },
    async (params) => {
      try {
        const result = await callAE("ae_get_property", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_set_property
  server.tool(
    "ae_set_property",
    "Set the static value of an After Effects property (number, array, hex color, boolean, or string).",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      path: propertyPathSchema.describe("Property path (e.g. ['Transform', 'Opacity'] or shortcut 'opacity')"),
      value: z.union([
        z.number(),
        z.string(),
        z.boolean(),
        z.array(z.number())
      ]).describe("Value to assign (scalar, number array, or hex color string)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_property", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_add_keyframes
  server.tool(
    "ae_add_keyframes",
    "Add or update keyframes on a property with professional easing curves (linear, easeIn, easeOut, easyEase, hold, bezier).",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      path: propertyPathSchema.describe("Property path (e.g. ['Transform', 'Position'] or 'scale')"),
      keyframes: z.array(keyframeItemSchema).describe("List of keyframes to set with time, value, and optional easing parameters")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_keyframes", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_remove_keyframes
  server.tool(
    "ae_remove_keyframes",
    "Remove keyframes from an After Effects property by times or clear all keyframes.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      path: propertyPathSchema.describe("Property path"),
      times: z.array(z.number()).optional().describe("Optional array of keyframe times in seconds to delete. If omitted, all keyframes are removed.")
    },
    async (params) => {
      try {
        const result = await callAE("ae_remove_keyframes", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_set_expression
  server.tool(
    "ae_set_expression",
    "Set or remove an expression on an After Effects property. Pass an empty string to remove.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer"),
      path: propertyPathSchema.describe("Property path"),
      expression: z.string().describe("Expression script string to assign, or empty string to disable and remove")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_expression", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 7. ae_animate
  server.tool(
    "ae_animate",
    "Apply quick professional motion presets ('fadeIn', 'fadeOut', 'slideInLeft', 'slideInRight', 'slideInUp', 'slideInDown', 'scalePop', 'spinIn', 'blurIn', 'typewriter') with snappy ease-out curves.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to animate"),
      preset: z.enum([
        "fadeIn",
        "fadeOut",
        "slideInLeft",
        "slideInRight",
        "slideInUp",
        "slideInDown",
        "scalePop",
        "spinIn",
        "blurIn",
        "typewriter"
      ]).describe("Motion graphics animation preset"),
      startTime: z.number().min(0).optional().default(0).describe("Animation start time in seconds (default 0)"),
      duration: z.number().positive().optional().default(0.6).describe("Animation duration in seconds (default 0.6)"),
      options: z.record(z.any()).optional().describe("Optional preset parameters (e.g. { distance: 1920, rotations: 2, blurriness: 80 })")
    },
    async (params) => {
      try {
        const result = await callAE("ae_animate", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 8. ae_describe_property_tree
  server.tool(
    "ae_describe_property_tree",
    "Deeply inspect and introspect a layer's entire property hierarchy: match names, types, current values, expressions, keyframe counts, modification states, and property paths.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer to inspect"),
      path: propertyPathSchema.optional().describe("Optional property or group path to start from (e.g. ['Transform'] or ['Effects'])"),
      maxDepth: z.number().int().min(1).max(10).optional().default(5).describe("Maximum recursion depth (default 5)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_describe_property_tree", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
