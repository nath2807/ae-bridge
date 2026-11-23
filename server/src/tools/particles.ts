import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";

export const PARTICLE_PRESETS = [
  "dust",
  "sparks",
  "snow",
  "rain",
  "bokeh",
  "embers",
  "confetti",
  "magicTrail",
  "explosion",
  "starfield"
] as const;

export function registerParticleTools(server: McpServer): void {
  // 1. ae_add_particles
  server.tool(
    "ae_add_particles",
    "Generate a procedural particle system solid layer using CC Particle World / Systems II (or Trapcode Particular if installed and requested). Presets: 'dust', 'sparks', 'snow', 'rain', 'bokeh', 'embers', 'confetti', 'magicTrail', 'explosion', 'starfield'.",
    {
      compRef: compRefSchema.optional(),
      preset: z.enum(PARTICLE_PRESETS).describe("Particle physics and aesthetic preset"),
      color: colorSchema.optional().describe("Primary tint color for birth/sparks"),
      amount: z.number().min(0.1).max(20).optional().default(1).describe("Particle quantity multiplier (default 1)"),
      startTime: z.number().min(0).optional().default(0).describe("In-point time on comp timeline (seconds)"),
      duration: z.number().positive().optional().describe("Duration in seconds (default: remaining comp length)"),
      options: z.object({
        followLayer: z.string().optional().describe("Name of layer for emitter to follow via expression (for 'magicTrail')"),
        time: z.number().optional().describe("Burst instant in seconds (for 'explosion')"),
        preferPlugin: z.boolean().optional().default(false).describe("Prefer Trapcode Particular if installed")
      }).optional().describe("Additional configuration options")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_particles", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_list_particle_presets
  server.tool(
    "ae_list_particle_presets",
    "List all available particle presets with physics descriptions, particle types, and recommended usage.",
    {},
    async () => {
      try {
        const result = await callAE("ae_list_particle_presets", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
