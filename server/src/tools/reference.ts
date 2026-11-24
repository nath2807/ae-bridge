import fs from "fs";
import path from "path";
import { z } from "zod";
import sharp from "sharp";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "./schemas.js";
import { getPreviewDir, waitForStableFile } from "./preview.js";
import { analyzePixels, hexToRgb, type ImageAnalysisMetrics } from "../utils/kmeans.js";
import {
  loadAllStyles,
  getStylesDir,
  styleSchema,
  type StyleDefinition
} from "../director/styles.js";

/**
 * Calculates color difference distance between two hex colors.
 */
function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Finds the closest matching style definition based on visual analysis metrics.
 */
function findClosestStyle(metrics: ImageAnalysisMetrics, allStyles: StyleDefinition[]): StyleDefinition {
  if (allStyles.length === 0) {
    throw new Error("No styles available to compare against.");
  }

  let bestStyle = allStyles[0];
  let bestScore = Infinity;

  for (const style of allStyles) {
    // 1. Color distance between primary and accent
    const primDist = colorDistance(metrics.palette[0] || "#000000", style.palette.primary as string);
    const bgDist = colorDistance(metrics.palette[1] || "#000000", style.palette.bg as string);

    // 2. Luminance alignment
    const styleBgRgb = hexToRgb(style.palette.bg as string);
    const styleBgLum = (0.2126 * styleBgRgb[0] + 0.7152 * styleBgRgb[1] + 0.0722 * styleBgRgb[2]) / 255;
    const lumDiff = Math.abs(metrics.averageLuminance - styleBgLum) * 200;

    const totalScore = primDist + bgDist * 0.8 + lumDiff;
    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestStyle = style;
    }
  }

  return bestStyle;
}

export function registerReferenceTools(server: McpServer): void {
  // 1. ae_analyze_reference
  server.tool(
    "ae_analyze_reference",
    "Analyze a reference image: extracts dominant 6-color palette via k-means clustering, computes average luminance, contrast, saturation, and warm/cool bias, recommends the closest matching built-in style, and generates a ready-to-use custom style JSON.",
    {
      imagePath: z.string().describe("Absolute file path to the reference image (PNG, JPG, WebP)")
    },
    async (params) => {
      try {
        const cleanPath = params.imagePath.replace(/\\/g, "/");
        if (!fs.existsSync(cleanPath)) {
          throw new Error(`Reference image not found at: ${cleanPath}`);
        }

        // Downscale image to max 128x128 for rapid, robust k-means analysis
        const { data, info } = await sharp(cleanPath)
          .resize(128, 128, { fit: "inside" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const pixels: Array<[number, number, number]> = [];
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha > 35) {
            pixels.push([data[i], data[i + 1], data[i + 2]]);
          }
        }

        const metrics = analyzePixels(pixels);
        const allStyles = loadAllStyles();
        const closest = findClosestStyle(metrics, allStyles);

        const customStyle: StyleDefinition = {
          name: "referenceMatch",
          title: "Custom Reference Match",
          description: `Extracted visual aesthetic profile matching reference image (${path.basename(cleanPath)}) with ${metrics.isDark ? "low-key dark" : "high-key bright"} exposure and ${metrics.warmCoolBias > 0.05 ? "warm" : metrics.warmCoolBias < -0.05 ? "cool" : "neutral"} color temperature balance.`,
          palette: {
            bg: metrics.isDark ? (metrics.palette[0] || "#08090C") : "#0F1117",
            surface: metrics.palette[1] || "#161922",
            primary: metrics.palette[2] || "#38BDF8",
            secondary: metrics.palette[3] || "#64748B",
            accent: metrics.palette[4] || "#F43F5E",
            text: metrics.isDark ? "#F8FAFC" : "#0F172A",
            glow: metrics.palette[5] || metrics.palette[2] || "#38BDF8"
          },
          typography: {
            heading: closest.typography.heading,
            body: closest.typography.body,
            fallbacks: closest.typography.fallbacks,
            tracking: closest.typography.tracking,
            caseRule: closest.typography.caseRule
          },
          motion: {
            curve: closest.motion.curve,
            durationScale: closest.motion.durationScale,
            stagger: closest.motion.stagger,
            energy: closest.motion.energy
          },
          lighting: closest.lighting,
          camera: closest.camera,
          looks: closest.looks,
          textures: closest.textures,
          particles: closest.particles,
          do: [
            `Maintain color balance using extracted palette: ${metrics.palette.slice(0, 4).join(", ")}`,
            ...closest.do
          ],
          dont: [
            `Avoid introducing high-saturation hues outside the reference palette range`,
            ...closest.dont
          ]
        };

        return toolSuccess({
          referenceFile: path.basename(cleanPath),
          metrics: {
            dominantPalette: metrics.palette,
            averageLuminance: metrics.averageLuminance,
            contrast: metrics.contrast,
            saturation: metrics.saturation,
            warmCoolBias: metrics.warmCoolBias,
            isDark: metrics.isDark,
            isMonochrome: metrics.isMonochrome
          },
          suggestedClosestStyle: {
            name: closest.name,
            title: closest.title || closest.name,
            description: closest.description
          },
          customStyle
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_compare_to_reference
  server.tool(
    "ae_compare_to_reference",
    "Create a side-by-side composite comparison between a reference image and the current composition render at a given timestamp. Returns visual comparison file for agent review.",
    {
      compRef: compRefSchema.optional(),
      time: z.number().min(0).optional().describe("Timestamp in seconds to capture from comp. If omitted, uses playhead time"),
      imagePath: z.string().describe("Absolute file path to the reference target image")
    },
    async (params) => {
      try {
        const cleanRefPath = params.imagePath.replace(/\\/g, "/");
        if (!fs.existsSync(cleanRefPath)) {
          throw new Error(`Reference image not found at: ${cleanRefPath}`);
        }

        const previewDir = getPreviewDir();
        const randId = Math.random().toString(36).slice(2, 9);
        const compFramePath = path.join(previewDir, `compare_frame_${Date.now()}_${randId}.png`).replace(/\\/g, "/");

        // Render current comp frame
        const aeResult = (await callAE("ae_preview_frame", {
          compRef: params.compRef,
          time: params.time,
          outputPath: compFramePath
        })) as {
          compName: string;
          time: number;
          width: number;
          height: number;
        };

        await waitForStableFile(compFramePath);

        // Normalize heights for side-by-side composite
        const targetHeight = 540;
        const refMeta = await sharp(cleanRefPath).metadata();
        const refAspect = (refMeta.width && refMeta.height) ? (refMeta.width / refMeta.height) : (16 / 9);
        const refWidth = Math.round(targetHeight * refAspect);

        const compMeta = await sharp(compFramePath).metadata();
        const compAspect = (compMeta.width && compMeta.height) ? (compMeta.width / compMeta.height) : (16 / 9);
        const compWidth = Math.round(targetHeight * compAspect);

        const refResized = await sharp(cleanRefPath)
          .resize(refWidth, targetHeight, { fit: "cover" })
          .toBuffer();

        const compResized = await sharp(compFramePath)
          .resize(compWidth, targetHeight, { fit: "cover" })
          .toBuffer();

        const dividerWidth = 8;
        const totalWidth = refWidth + dividerWidth + compWidth;

        // Create composite background canvas
        const compositePath = path.join(previewDir, `side_by_side_${Date.now()}_${randId}.png`).replace(/\\/g, "/");

        const dividerSvg = Buffer.from(
          `<svg width="${dividerWidth}" height="${targetHeight}"><rect width="${dividerWidth}" height="${targetHeight}" fill="#38BDF8"/></svg>`
        );

        await sharp({
          create: {
            width: totalWidth,
            height: targetHeight,
            channels: 4,
            background: { r: 10, g: 12, b: 16, alpha: 1 }
          }
        })
          .composite([
            { input: refResized, left: 0, top: 0 },
            { input: dividerSvg, left: refWidth, top: 0 },
            { input: compResized, left: refWidth + dividerWidth, top: 0 }
          ])
          .png()
          .toFile(compositePath);

        const compositeBuffer = await fs.promises.readFile(compositePath);
        const base64Data = compositeBuffer.toString("base64");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  comparisonFile: compositePath,
                  compName: aeResult.compName,
                  renderTime: aeResult.time,
                  referenceImage: path.basename(cleanRefPath),
                  layout: "Left: Reference | Center: Divider | Right: Current AE Render",
                  dimensions: { width: totalWidth, height: targetHeight }
                },
                null,
                2
              )
            },
            {
              type: "image" as const,
              data: base64Data,
              mimeType: "image/png"
            }
          ]
        };
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_create_style_from_reference
  server.tool(
    "ae_create_style_from_reference",
    "Analyze a reference image and author a new persistent style JSON in the /styles directory conforming to the style schema.",
    {
      imagePath: z.string().describe("Absolute file path to the reference image"),
      name: z.string().regex(/^[a-zA-Z0-9_-]+$/, "Style name must be alphanumeric").describe("Unique style identifier (e.g. 'cyberObsidian', 'sunsetWarmth')")
    },
    async (params) => {
      try {
        const cleanPath = params.imagePath.replace(/\\/g, "/");
        if (!fs.existsSync(cleanPath)) {
          throw new Error(`Reference image not found at: ${cleanPath}`);
        }

        const { data } = await sharp(cleanPath)
          .resize(128, 128, { fit: "inside" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const pixels: Array<[number, number, number]> = [];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 35) {
            pixels.push([data[i], data[i + 1], data[i + 2]]);
          }
        }

        const metrics = analyzePixels(pixels);
        const allStyles = loadAllStyles();
        const closest = findClosestStyle(metrics, allStyles);

        const newStyle: StyleDefinition = {
          name: params.name,
          title: params.name.charAt(0).toUpperCase() + params.name.slice(1).replace(/([A-Z])/g, " $1"),
          description: `Custom style derived from reference image (${path.basename(cleanPath)}) with ${metrics.isDark ? "deep atmospheric contrast" : "clean high-key lighting"}.`,
          palette: {
            bg: metrics.isDark ? (metrics.palette[0] || "#090A0F") : "#0F121A",
            surface: metrics.palette[1] || "#161922",
            primary: metrics.palette[2] || "#38BDF8",
            secondary: metrics.palette[3] || "#64748B",
            accent: metrics.palette[4] || "#F43F5E",
            text: metrics.isDark ? "#F8FAFC" : "#0F172A",
            glow: metrics.palette[5] || metrics.palette[2] || "#38BDF8"
          },
          typography: {
            heading: closest.typography.heading,
            body: closest.typography.body,
            fallbacks: closest.typography.fallbacks,
            tracking: closest.typography.tracking,
            caseRule: closest.typography.caseRule
          },
          motion: {
            curve: closest.motion.curve,
            durationScale: closest.motion.durationScale,
            stagger: closest.motion.stagger,
            energy: closest.motion.energy
          },
          lighting: closest.lighting,
          camera: closest.camera,
          looks: closest.looks,
          textures: closest.textures,
          particles: closest.particles,
          do: [
            `Maintain dominant color harmony matching palette: ${metrics.palette.slice(0, 4).join(", ")}`,
            ...closest.do
          ],
          dont: [
            `Do not inject incompatible saturated colors outside the reference palette gamut`,
            ...closest.dont
          ]
        };

        // Validate with Zod schema
        const validated = styleSchema.parse(newStyle);

        // Save to styles directory
        const stylesDir = getStylesDir();
        const targetPath = path.join(stylesDir, `${params.name}.json`);
        fs.writeFileSync(targetPath, JSON.stringify(validated, null, 2), "utf-8");

        return toolSuccess({
          created: true,
          name: validated.name,
          title: validated.title,
          filePath: targetPath.replace(/\\/g, "/"),
          palette: validated.palette,
          motion: validated.motion
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
