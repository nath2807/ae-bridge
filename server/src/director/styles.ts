import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { colorSchema, toolSuccess, toolError } from "../tools/schemas.js";
import { getActiveBrandDefaults } from "./brand.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const styleTypographySchema = z.object({
  heading: z.string().describe("Primary heading font family"),
  body: z.string().describe("Secondary body font family"),
  fallbacks: z.array(z.string()).describe("Fallback font family list in preferential order"),
  tracking: z.number().describe("Default letter spacing / tracking value"),
  caseRule: z.enum(["uppercase", "titlecase", "lowercase", "asIs"]).default("asIs").describe("Text capitalization rule")
});

export const stylePaletteSchema = z.object({
  bg: colorSchema.describe("Deep background canvas color"),
  surface: colorSchema.describe("Surface / card / panel color"),
  primary: colorSchema.describe("Dominant brand / hero color"),
  secondary: colorSchema.describe("Supporting balance tone"),
  accent: colorSchema.describe("High-contrast highlight element color"),
  text: colorSchema.describe("Primary readable text color"),
  glow: colorSchema.describe("Luminescent bloom / emissive highlight color")
});

export const styleMotionSchema = z.object({
  curve: z.enum([
    "expoOut",
    "expoInOut",
    "quintOut",
    "backOut",
    "snap",
    "smooth",
    "heavy",
    "elasticOut",
    "linear"
  ]).describe("Signature easing curve used for transitions and animated transforms"),
  durationScale: z.number().min(0.1).max(5).default(1.0).describe("Global speed/duration multiplier"),
  stagger: z.number().min(0).max(2).default(0.06).describe("Default delay offset in seconds between cascaded layers"),
  energy: z.enum(["low", "medium", "high"]).default("medium").describe("Rhythmic pace and kinetic energy level")
});

export const styleParticleSchema = z.object({
  preset: z.string().describe("Particle preset name (e.g. 'dust', 'snow', 'sparkles', 'sparks')"),
  density: z.number().optional().describe("Particle density or count"),
  speed: z.number().optional().describe("Particle velocity factor"),
  blendMode: z.string().optional().describe("Layer blend mode (e.g. 'Screen', 'Add')")
});

export const styleSchema = z.object({
  name: z.string().describe("Unique identifier of the style (camelCase)"),
  title: z.string().optional().describe("Human readable title"),
  description: z.string().describe("High-level aesthetic summary and design rationale"),
  palette: stylePaletteSchema,
  typography: styleTypographySchema,
  motion: styleMotionSchema,
  lighting: z.string().describe("Lighting preset to use (e.g. 'dramatic', 'neonRim', 'softStudio')"),
  camera: z.string().describe("Camera language and movement tendencies"),
  looks: z.array(z.string()).describe("Finishing look stack names (e.g. ['filmGrain', 'bloom'])"),
  textures: z.array(z.string()).describe("Background and overlay textures"),
  particles: styleParticleSchema.optional(),
  do: z.array(z.string()).describe("Mandatory design principles and visual rules"),
  dont: z.array(z.string()).describe("Forbidden design flaws and anti-patterns")
});

export type StyleDefinition = z.infer<typeof styleSchema>;

export function getStylesDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "styles"),
    path.resolve(process.cwd(), "../styles"),
    path.resolve(__dirname, "../../styles"),
    path.resolve(__dirname, "../../../styles")
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }

  const rootStyles = path.resolve(process.cwd(), "styles");
  if (!fs.existsSync(rootStyles)) {
    fs.mkdirSync(rootStyles, { recursive: true });
  }
  return rootStyles;
}

export function getStateFilePath(): string {
  const baseDir = path.join(os.homedir(), ".ae-bridge");
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, "state.json");
}

export function getActiveStyleName(): string {
  const statePath = getStateFilePath();
  try {
    if (fs.existsSync(statePath)) {
      const raw = fs.readFileSync(statePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.activeStyle && typeof parsed.activeStyle === "string") {
        return parsed.activeStyle;
      }
    }
  } catch (err) {
    console.error("[ae-bridge] Failed to read active style from state.json:", err);
  }
  return "minimalPremium";
}

export function setActiveStyleName(name: string): void {
  const statePath = getStateFilePath();
  let stateObj: Record<string, any> = {};
  try {
    if (fs.existsSync(statePath)) {
      stateObj = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    }
  } catch {}
  stateObj.activeStyle = name;
  fs.writeFileSync(statePath, JSON.stringify(stateObj, null, 2), "utf-8");
}

export function loadAllStyles(): StyleDefinition[] {
  const dir = getStylesDir();
  const styles: StyleDefinition[] = [];

  if (!fs.existsSync(dir)) {
    return styles;
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith(".json")) {
      try {
        const fullPath = path.join(dir, file);
        const content = fs.readFileSync(fullPath, "utf-8");
        const parsed = JSON.parse(content);
        const validated = styleSchema.parse(parsed);
        styles.push(validated);
      } catch (err) {
        console.error(`[ae-bridge] Error loading style file ${file}:`, err);
      }
    }
  }

  return styles;
}

export function getStyleByName(name: string): StyleDefinition | null {
  const styles = loadAllStyles();
  const target = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const s of styles) {
    if (s.name.toLowerCase().replace(/[^a-z0-9]/g, "") === target) {
      return s;
    }
  }
  return null;
}

export function getResolvedStyle(name?: string, applyBrand: boolean = false): StyleDefinition {
  const targetName = name || getActiveStyleName();
  let style = getStyleByName(targetName);

  if (!style) {
    const all = loadAllStyles();
    style = all[0] || null;
  }

  if (!style) {
    throw new Error(`Style '${targetName}' not found and no styles available in directory.`);
  }

  // Clone style to avoid modifying loaded in-memory reference
  const resolved: StyleDefinition = JSON.parse(JSON.stringify(style));

  if (applyBrand) {
    const brand = getActiveBrandDefaults();
    resolved.palette.primary = brand.colors.primary;
    resolved.palette.secondary = brand.colors.secondary;
    resolved.palette.accent = brand.colors.accent;
    resolved.palette.bg = brand.colors.background;
    resolved.palette.text = brand.colors.text;

    if (brand.fonts && brand.fonts.heading) {
      resolved.typography.heading = brand.fonts.heading;
    }
    if (brand.fonts && brand.fonts.body) {
      resolved.typography.body = brand.fonts.body;
    }
  }

  return resolved;
}

export function registerStyleTools(server: McpServer): void {
  // 1. ae_list_styles
  server.tool(
    "ae_list_styles",
    "List all available design styles with palettes, motion curves, typography, and active indicator.",
    {},
    async () => {
      try {
        const styles = loadAllStyles();
        const activeName = getActiveStyleName();

        const summary = styles.map((s) => ({
          name: s.name,
          title: s.title || s.name,
          active: s.name.toLowerCase() === activeName.toLowerCase(),
          description: s.description,
          curve: s.motion.curve,
          energy: s.motion.energy,
          lighting: s.lighting,
          palette: s.palette
        }));

        return toolSuccess({
          activeStyle: activeName,
          totalStyles: styles.length,
          styles: summary
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_get_style
  server.tool(
    "ae_get_style",
    "Retrieve complete specification for a design style. If name is omitted, returns the active style. Optionally overlays active brand kit colors and fonts if brand=true.",
    {
      name: z.string().optional().describe("Style identifier (e.g. 'cinematicNoir', 'neonCyber'). If omitted, active style is returned."),
      brand: z.boolean().optional().default(false).describe("If true, master brand kit colors and fonts override style defaults")
    },
    async (params) => {
      try {
        const resolved = getResolvedStyle(params.name, params.brand);
        return toolSuccess(resolved);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_set_active_style
  server.tool(
    "ae_set_active_style",
    "Set the globally active design style used across storyboards, titles, motion curves, and finishing passes. Persisted in ~/.ae-bridge/state.json.",
    {
      name: z.string().describe("Name of the style to activate (e.g. 'cinematicNoir', 'minimalPremium', 'neonCyber')")
    },
    async (params) => {
      try {
        const target = getStyleByName(params.name);
        if (!target) {
          const avail = loadAllStyles().map((s) => s.name);
          throw new Error(`Style '${params.name}' not found. Available styles: ${avail.join(", ")}`);
        }

        setActiveStyleName(target.name);

        return toolSuccess({
          success: true,
          activeStyle: target.name,
          description: target.description,
          curve: target.motion.curve,
          palette: target.palette
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
