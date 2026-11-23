import { z } from "zod";

export const compRefSchema = z
  .object({
    compId: z.number().int().optional().describe("Unique ID of the composition in After Effects"),
    compName: z.string().optional().describe("Name of the composition in After Effects")
  })
  .describe("Reference to a composition (by ID or name). If omitted, the active composition is used.");

export const layerRefSchema = z
  .object({
    layerIndex: z.number().int().optional().describe("1-based index of the layer in the composition"),
    layerName: z.string().optional().describe("Name of the layer in the composition")
  })
  .describe("Reference to a layer (by 1-based index or name)");

export const colorSchema = z
  .union([
    z.array(z.number()).min(3).max(4).describe("RGB or RGBA color array [r, g, b] as 0-1 floats or 0-255 ints"),
    z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Invalid hex color format (e.g. #RGB or #RRGGBB)").describe("Hex color string (e.g. '#FF0000' or '#FFF')")
  ])
  .describe("Color as [r, g, b] array or hex string");

export const propertyPathSchema = z
  .union([
    z.string().describe("Shortcut name or single segment (e.g. 'position', 'scale', 'opacity')"),
    z.array(z.string()).describe("Property path segments (e.g. ['Transform', 'Position'] or ['Effects', 'Gaussian Blur', 'Blurriness'])")
  ])
  .describe("Property path (array of segment strings or shortcut)");

export const keyframeEaseSchema = z
  .enum(["linear", "easeIn", "easeOut", "easyEase", "hold", "bezier"])
  .describe("Easing interpolation type");

export const keyframeItemSchema = z
  .object({
    time: z.number().min(0).describe("Keyframe time in seconds"),
    value: z.union([
      z.number(),
      z.string(),
      z.boolean(),
      z.array(z.number())
    ]).describe("Keyframe value (scalar, array, or string)"),
    ease: keyframeEaseSchema.optional().default("linear").describe("Easing curve preset"),
    easeInInfluence: z.number().min(0.1).max(100).optional().describe("Incoming influence percentage (0.1 - 100)"),
    easeOutInfluence: z.number().min(0.1).max(100).optional().describe("Outgoing influence percentage (0.1 - 100)"),
    easeInSpeed: z.number().optional().describe("Incoming speed value"),
    easeOutSpeed: z.number().optional().describe("Outgoing speed value")
  })
  .describe("Keyframe definition");

export function formatResult(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function toolSuccess(result: unknown) {
  return {
    content: [{ type: "text" as const, text: formatResult(result) }]
  };
}

export function toolError(err: unknown) {
  return {
    content: [{ type: "text" as const, text: (err as Error).message || String(err) }],
    isError: true
  };
}
