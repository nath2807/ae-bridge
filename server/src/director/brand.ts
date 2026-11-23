import fs from "fs";
import os from "os";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { colorSchema, toolSuccess, toolError } from "../tools/schemas.js";

export const brandColorsSchema = z.object({
  primary: colorSchema.describe("Primary brand color (hex or RGB array)"),
  secondary: colorSchema.describe("Secondary / supporting color"),
  accent: colorSchema.describe("High-contrast highlight / accent color"),
  background: colorSchema.describe("Deep background canvas color"),
  text: colorSchema.describe("Primary readable text color")
});

export const brandFontsSchema = z.object({
  heading: z.string().describe("Heading font family or PostScript name"),
  body: z.string().describe("Body typography font family or PostScript name")
});

export const brandKitSchema = z.object({
  name: z.string().describe("Brand or client identity name"),
  colors: brandColorsSchema,
  fonts: brandFontsSchema,
  logoPath: z.string().optional().describe("Absolute file path to brand logo asset (PNG/SVG/AI)"),
  style: z.enum(["minimal", "bold", "luxury", "playful", "tech"]).optional().default("minimal").describe("Overall aesthetic brand tone")
});

export type BrandKit = z.infer<typeof brandKitSchema>;

export const DEFAULT_BRAND_KIT: BrandKit = {
  name: "Default Tech",
  colors: {
    primary: "#3B82F6",
    secondary: "#1E293B",
    accent: "#00E5FF",
    background: "#080C14",
    text: "#F8FAFC"
  },
  fonts: {
    heading: "Montserrat-Bold",
    body: "Inter-Regular"
  },
  style: "tech"
};

export function getBrandConfigPath(): string {
  const baseDir = path.join(os.homedir(), ".ae-bridge");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, "brand.json");
}

export function getStoredBrandKit(): BrandKit | null {
  const p = getBrandConfigPath();
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[ae-bridge] Failed to read brand kit from disk:", err);
  }
  return null;
}

export function getActiveBrandDefaults(): BrandKit {
  return getStoredBrandKit() || DEFAULT_BRAND_KIT;
}

export function registerBrandTools(server: McpServer): void {
  // 1. ae_set_brand_kit
  server.tool(
    "ae_set_brand_kit",
    "Configure and persist the master brand kit (colors, typography, logo, and aesthetic style) stored at ~/.ae-bridge/brand.json. Used by storyboards, title cards, and recipes as default identity values.",
    {
      name: z.string().describe("Brand or client name (e.g. 'Apex Robotics', 'Nova Labs')"),
      colors: brandColorsSchema.describe("Brand color palette (primary, secondary, accent, background, text)"),
      fonts: brandFontsSchema.describe("Brand typography (heading font, body font)"),
      logoPath: z.string().optional().describe("Optional path to vector or high-res logo image file"),
      style: z.enum(["minimal", "bold", "luxury", "playful", "tech"]).optional().default("minimal").describe("Brand aesthetic direction")
    },
    async (params) => {
      try {
        const filePath = getBrandConfigPath();
        const data: BrandKit = {
          name: params.name,
          colors: params.colors,
          fonts: params.fonts,
          logoPath: params.logoPath,
          style: params.style || "minimal"
        };
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
        return toolSuccess({
          saved: true,
          path: filePath.replace(/\\/g, "/"),
          brandKit: data
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_get_brand_kit
  server.tool(
    "ae_get_brand_kit",
    "Retrieve the active brand kit from ~/.ae-bridge/brand.json (or default tech brand kit if none is configured).",
    {},
    async () => {
      try {
        const stored = getStoredBrandKit();
        return toolSuccess({
          isCustom: stored !== null,
          brandKit: stored || DEFAULT_BRAND_KIT
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
