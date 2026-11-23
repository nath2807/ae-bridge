import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, toolSuccess, toolError } from "./schemas.js";

export function registerCameraTools(server: McpServer): void {
  // 1. ae_camera_rig
  server.tool(
    "ae_camera_rig",
    "Build a professional cinematography camera rig in a composition (creates camera if missing, attached to a 3D null controller for orbital and dolly maneuvers).",
    {
      compRef: compRefSchema.optional(),
      cameraRef: layerRefSchema.optional().describe("Optional reference to an existing camera layer"),
      type: z.enum(["orbitNull", "twoNode"]).optional().default("orbitNull").describe("Rig architecture")
    },
    async (params) => {
      try {
        const result = await callAE("ae_camera_rig", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_camera_move
  server.tool(
    "ae_camera_move",
    "Execute an authored 3D camera cinematic move ('orbit', 'orbitHalf', 'dollyIn', 'dollyOut', 'truckLeft', 'truckRight', 'craneUp', 'craneDown', 'pushIn', 'flyThrough', 'spiral', 'parallaxDrift', 'dutchRoll', 'whipTo').",
    {
      compRef: compRefSchema.optional(),
      cameraRef: layerRefSchema.optional(),
      move: z.enum([
        "orbit",
        "orbitHalf",
        "dollyIn",
        "dollyOut",
        "truckLeft",
        "truckRight",
        "craneUp",
        "craneDown",
        "pushIn",
        "flyThrough",
        "spiral",
        "parallaxDrift",
        "dutchRoll",
        "whipTo"
      ]).describe("Camera motion preset"),
      startTime: z.number().min(0).optional().default(0).describe("Timeline start time in seconds (default 0)"),
      duration: z.number().positive().optional().default(4).describe("Move duration in seconds (default 4)"),
      amount: z.number().optional().default(1).describe("Movement intensity / speed multiplier (default 1.0)"),
      options: z.record(z.any()).optional().describe("Additional move options (e.g. targetLayer for 'whipTo')")
    },
    async (params) => {
      try {
        const result = await callAE("ae_camera_move", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_camera_look_at
  server.tool(
    "ae_camera_look_at",
    "Dynamically bind camera Point of Interest (look-at target) to a 3D layer using an automated expression link.",
    {
      compRef: compRefSchema.optional(),
      cameraRef: layerRefSchema.optional(),
      targetLayer: layerRefSchema.describe("Target layer for camera to track and look at")
    },
    async (params) => {
      try {
        const result = await callAE("ae_camera_look_at", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_set_depth_of_field
  server.tool(
    "ae_set_depth_of_field",
    "Configure camera optical depth of field (DoF), aperture, blur level, and optional dynamic focal tracking to a subject layer.",
    {
      compRef: compRefSchema.optional(),
      cameraRef: layerRefSchema.optional(),
      enabled: z.boolean().optional().default(true).describe("Enable or disable depth of field"),
      focusLayer: layerRefSchema.optional().describe("Optional target layer to automatically track focal plane distance to"),
      aperture: z.number().min(0).optional().describe("Lens aperture in pixels (higher = shallower depth of field / more blur)"),
      blurLevel: z.number().min(0).max(500).optional().describe("Bokeh blur level percentage (default 100%)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_set_depth_of_field", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_add_camera_shake
  server.tool(
    "ae_add_camera_shake",
    "Add organic handheld camera shake or action tremor using a continuous procedural expression on the camera rig.",
    {
      compRef: compRefSchema.optional(),
      cameraRef: layerRefSchema.optional(),
      amount: z.number().optional().default(5).describe("Camera shake displacement magnitude in pixels (default 5)"),
      frequency: z.number().optional().default(1.5).describe("Camera shake oscillations per second in Hz (default 1.5)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_camera_shake", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
