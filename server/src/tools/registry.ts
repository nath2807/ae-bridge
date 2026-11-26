import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { registerCoreTools } from "./core.js";
import { registerCompTools } from "./comps.js";
import { registerLayerTools } from "./layers.js";
import { registerAnimationTools } from "./animation.js";
import { registerEffectTools } from "./effects.js";
import { registerTitleTools } from "./titles.js";
import { registerFootageTools } from "./footage.js";
import { registerEditingTools } from "./editing.js";
import { registerTransitionTools } from "./transitions.js";
import { registerTimeTools } from "./time.js";
import { registerAudioTools } from "./audio.js";
import { registerColorTools } from "./color.js";
import { registerScene3dTools } from "./scene3d.js";
import { registerCameraTools } from "./camera.js";
import { registerLightingTools } from "./lighting.js";
import { registerSceneTools } from "./scenes.js";
import { registerLookTools } from "./looks.js";
import { registerParticleTools } from "./particles.js";
import { registerBackgroundTools } from "./backgrounds.js";
import { registerDistortTools } from "./distort.js";
import { registerRigTools } from "./rigs.js";
import { registerPreviewTools } from "./preview.js";
import { registerQaTools } from "./qa.js";
import { registerProjectTools } from "./project.js";
import { registerRenderTools } from "./render.js";
import { registerFormatTools } from "./formats.js";
import { registerTemplateTools } from "./templates.js";
import { registerAnalysisTools } from "./analysis.js";
import { registerBrandTools } from "../director/brand.js";
import { registerStoryboardTools } from "../director/storyboard.js";
import { registerRecipeTools } from "../director/recipes.js";
import { registerQualityTools } from "./quality.js";
import { registerMotionTools } from "./motion.js";
import { registerStyleTools } from "../director/styles.js";
import { registerFinishingTools } from "./finishing.js";
import { registerReferenceTools } from "./reference.js";
import { registerBlenderTools } from "./blender.js";
import { registerBlenderAETools } from "./blenderAE.js";

export interface ToolModule {
  name: string;
  tag: string;
  register: (server: McpServer) => void;
}

export interface ToolCatalogEntry {
  name: string;
  description: string;
  category: string;
  tag: string;
  params: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: string;
  }>;
}

export const TOOL_MODULES: ToolModule[] = [
  { name: "Core & Health", tag: "core", register: registerCoreTools },
  { name: "Compositions", tag: "comps", register: registerCompTools },
  { name: "Layers & Transform", tag: "layers", register: registerLayerTools },
  { name: "Animation & Keyframes", tag: "animation", register: registerAnimationTools },
  { name: "Effects", tag: "effects", register: registerEffectTools },
  { name: "Titles & Lower Thirds", tag: "titles", register: registerTitleTools },
  { name: "Footage & Media", tag: "footage", register: registerFootageTools },
  { name: "Timeline & Editing", tag: "editing", register: registerEditingTools },
  { name: "Transitions", tag: "transitions", register: registerTransitionTools },
  { name: "Time Remapping & Speed", tag: "time", register: registerTimeTools },
  { name: "Audio Management", tag: "audio", register: registerAudioTools },
  { name: "Color Grading & Looks", tag: "color", register: registerColorTools },
  { name: "3D Layers & Extrusions", tag: "3d", register: registerScene3dTools },
  { name: "Cameras & Motion", tag: "camera", register: registerCameraTools },
  { name: "Lighting & Shading", tag: "lighting", register: registerLightingTools },
  { name: "3D Motion Graphics Scenes", tag: "scenes", register: registerSceneTools },
  { name: "Cinematic Looks & Presets", tag: "looks", register: registerLookTools },
  { name: "Particle Systems", tag: "particles", register: registerParticleTools },
  { name: "Procedural Backgrounds", tag: "backgrounds", register: registerBackgroundTools },
  { name: "Distortion & Glitch", tag: "distort", register: registerDistortTools },
  { name: "Motion & Physics Rigs", tag: "rigs", register: registerRigTools },
  { name: "Vision & Preview", tag: "preview", register: registerPreviewTools },
  { name: "Quality Assurance (QA)", tag: "qa", register: registerQaTools },
  { name: "Project & Checkpoints", tag: "project", register: registerProjectTools },
  { name: "Rendering & Export", tag: "render", register: registerRenderTools },
  { name: "Social Variants & Reframe", tag: "formats", register: registerFormatTools },
  { name: "Essential Graphics & Templates", tag: "templates", register: registerTemplateTools },
  { name: "Asset & Beat Analysis", tag: "analysis", register: registerAnalysisTools },
  { name: "Brand Identity Kit", tag: "brand", register: registerBrandTools },
  { name: "Storyboard & Director", tag: "storyboard", register: registerStoryboardTools },
  { name: "Video Production Recipes", tag: "recipes", register: registerRecipeTools },
  { name: "Render Quality & Standards", tag: "quality", register: registerQualityTools },
  { name: "Motion Language & Easing", tag: "motion", register: registerMotionTools },
  { name: "Design Styles & Aesthetics", tag: "styles", register: registerStyleTools },
  { name: "Finishing Pass & Compositing", tag: "finishing", register: registerFinishingTools },
  { name: "Reference Matching & Palette", tag: "reference", register: registerReferenceTools },
  { name: "Blender 3D Photoreal Engine", tag: "blender", register: registerBlenderTools },
  { name: "Blender AE Compositing & Sync", tag: "blender_ae", register: registerBlenderAETools }
];

let cachedCatalog: ToolCatalogEntry[] | null = null;

export function getToolCatalog(): ToolCatalogEntry[] {
  if (cachedCatalog) return cachedCatalog;

  const catalog: ToolCatalogEntry[] = [];

  for (const mod of TOOL_MODULES) {
    const mockServer: any = {
      tool: (name: string, description: string, schema: any) => {
        const paramList: ToolCatalogEntry["params"] = [];

        try {
          if (schema && typeof schema === "object" && Object.keys(schema).length > 0) {
            const zObj = z.object(schema);
            const jsonSchema = zodToJsonSchema(zObj) as any;
            const props = jsonSchema.properties || {};
            const requiredSet = new Set(jsonSchema.required || []);

            for (const [propName, propDef] of Object.entries<any>(props)) {
              let typeStr = propDef.type || "any";
              if (propDef.enum) {
                typeStr = propDef.enum.map((e: any) => `"${e}"`).join(" | ");
              } else if (propDef.anyOf) {
                typeStr = propDef.anyOf.map((t: any) => t.type || "any").join(" | ");
              }

              paramList.push({
                name: propName,
                type: typeStr,
                required: requiredSet.has(propName),
                description: propDef.description || "",
                default: propDef.default !== undefined ? String(propDef.default) : undefined
              });
            }
          }
        } catch {
          // Schema parse fallback
        }

        catalog.push({
          name,
          description,
          category: mod.name,
          tag: mod.tag,
          params: paramList
        });
      }
    };

    try {
      mod.register(mockServer);
    } catch (err) {
      console.error(`[ae-bridge] Error loading module ${mod.name} for catalog:`, err);
    }
  }

  cachedCatalog = catalog;
  return catalog;
}
