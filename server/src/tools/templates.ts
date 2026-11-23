import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, layerRefSchema, propertyPathSchema, colorSchema, toolSuccess, toolError } from "./schemas.js";
import { getDefaultRenderDir, RENDER_PRESETS } from "./render.js";

export function registerTemplateTools(server: McpServer): void {
  // 1. ae_add_to_essential_graphics
  server.tool(
    "ae_add_to_essential_graphics",
    "Add a property (source text, color, slider, position, scale, opacity) from a layer into the composition's Essential Graphics panel for template packaging.",
    {
      compRef: compRefSchema.optional(),
      layerRef: layerRefSchema.describe("Target layer containing the property"),
      path: propertyPathSchema.describe("Path to animatable property (e.g. ['Text', 'Source Text'] or 'opacity')"),
      label: z.string().optional().describe("Display label in Essential Graphics panel (defaults to property name)")
    },
    async (params) => {
      try {
        const result = await callAE("ae_add_to_essential_graphics", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_export_mogrt
  server.tool(
    "ae_export_mogrt",
    "Export a composition packaged with Essential Graphics controls as a Motion Graphics Template (.mogrt) for Premiere Pro.",
    {
      compRef: compRefSchema.optional(),
      outputPath: z.string().optional().describe("Target .mogrt file path. Defaults to <Videos>/ae-bridge-renders/<compName>.mogrt")
    },
    async (params) => {
      try {
        const comp = (await callAE("getComp", { compRef: params.compRef })) as { name: string };
        const safeName = comp.name.replace(/[<>:"/\\|?*]/g, "_");
        const defaultDir = getDefaultRenderDir();
        const targetPath = params.outputPath
          ? path.resolve(params.outputPath).replace(/\\/g, "/")
          : path.join(defaultDir, `${safeName}.mogrt`).replace(/\\/g, "/");

        const result = await callAE("ae_export_mogrt", {
          compRef: params.compRef,
          outputPath: targetPath
        });
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_replace_text_batch
  server.tool(
    "ae_replace_text_batch",
    "Perform atomic batch text replacement across multiple text layers within a composition in a single operation.",
    {
      compRef: compRefSchema.optional(),
      replacements: z.array(
        z.object({
          layerRef: layerRefSchema.describe("Target text layer"),
          text: z.string().describe("New text content to insert")
        })
      ).min(1).describe("List of text layer replacements")
    },
    async (params) => {
      try {
        const result = await callAE("ae_replace_text_batch", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_generate_versions
  server.tool(
    "ae_generate_versions",
    "Data-driven versioning: duplicate a master composition per row, apply text and color overrides, organize into a 'Versions' folder, and optionally queue all versions for rendering.",
    {
      compRef: compRefSchema.optional(),
      rows: z.array(
        z.object({
          suffix: z.string().describe("Suffix identifier for generated comp (e.g. 'clientA', 'es_ES')"),
          texts: z.record(z.string()).describe("Map of layer names to replacement text strings"),
          colors: z.record(colorSchema).optional().describe("Map of layer names to replacement color overrides")
        })
      ).min(1).describe("Data rows to generate versions for"),
      render: z.object({
        preset: z.enum(RENDER_PRESETS).describe("Render preset to queue versions for export")
      }).optional().describe("Optional rendering configuration to queue all versions")
    },
    async (params) => {
      try {
        const result = (await callAE("ae_generate_versions", {
          compRef: params.compRef,
          rows: params.rows
        })) as {
          folder: string;
          folderId: number;
          totalGenerated: number;
          versions: Array<{ compId: number; compName: string; suffix: string }>;
        };

        let renderSummary: unknown = null;

        if (params.render && params.render.preset && result.versions && result.versions.length) {
          const renderDir = getDefaultRenderDir();
          const queuedItems = [];
          for (const v of result.versions) {
            const outPath = path.join(renderDir, `${v.compName}_${params.render.preset}.mov`).replace(/\\/g, "/");
            const rRes = await callAE("ae_render", {
              compRef: { compId: v.compId },
              preset: params.render.preset,
              outputPath: outPath,
              mode: "ame",
              workAreaOnly: true
            });
            queuedItems.push(rRes);
          }
          renderSummary = {
            totalQueued: queuedItems.length,
            preset: params.render.preset,
            items: queuedItems
          };
        }

        return toolSuccess({
          ...result,
          ...(renderSummary ? { renders: renderSummary } : {})
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
