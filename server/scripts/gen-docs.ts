import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { registerCoreTools } from "../src/tools/core.js";
import { registerCompTools } from "../src/tools/comps.js";
import { registerLayerTools } from "../src/tools/layers.js";
import { registerAnimationTools } from "../src/tools/animation.js";
import { registerEffectTools } from "../src/tools/effects.js";
import { registerTitleTools } from "../src/tools/titles.js";
import { registerFootageTools } from "../src/tools/footage.js";
import { registerEditingTools } from "../src/tools/editing.js";
import { registerTransitionTools } from "../src/tools/transitions.js";
import { registerTimeTools } from "../src/tools/time.js";
import { registerAudioTools } from "../src/tools/audio.js";
import { registerColorTools } from "../src/tools/color.js";
import { registerScene3dTools } from "../src/tools/scene3d.js";
import { registerCameraTools } from "../src/tools/camera.js";
import { registerLightingTools } from "../src/tools/lighting.js";
import { registerSceneTools } from "../src/tools/scenes.js";
import { registerLookTools } from "../src/tools/looks.js";
import { registerParticleTools } from "../src/tools/particles.js";
import { registerBackgroundTools } from "../src/tools/backgrounds.js";
import { registerDistortTools } from "../src/tools/distort.js";
import { registerRigTools } from "../src/tools/rigs.js";
import { registerPreviewTools } from "../src/tools/preview.js";
import { registerQaTools } from "../src/tools/qa.js";
import { registerProjectTools } from "../src/tools/project.js";
import { registerRenderTools } from "../src/tools/render.js";
import { registerFormatTools } from "../src/tools/formats.js";
import { registerTemplateTools } from "../src/tools/templates.js";
import { registerAnalysisTools } from "../src/tools/analysis.js";
import { registerBrandTools } from "../src/director/brand.js";
import { registerStoryboardTools } from "../src/director/storyboard.js";
import { registerRecipeTools } from "../src/director/recipes.js";
import { registerQualityTools } from "../src/tools/quality.js";
import { registerMotionTools } from "../src/tools/motion.js";
import { registerStyleTools } from "../src/director/styles.js";
import { registerFinishingTools } from "../src/tools/finishing.js";
import { registerReferenceTools } from "../src/tools/reference.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

interface ToolDocEntry {
  name: string;
  description: string;
  category: string;
  params: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: string;
  }>;
}

const CATEGORIES: Array<{ name: string; register: (s: any) => void }> = [
  { name: "Core & Health", register: registerCoreTools },
  { name: "Compositions", register: registerCompTools },
  { name: "Layers & Transform", register: registerLayerTools },
  { name: "Animation & Keyframes", register: registerAnimationTools },
  { name: "Effects", register: registerEffectTools },
  { name: "Titles & Lower Thirds", register: registerTitleTools },
  { name: "Footage & Media", register: registerFootageTools },
  { name: "Timeline & Editing", register: registerEditingTools },
  { name: "Transitions", register: registerTransitionTools },
  { name: "Time Remapping & Speed", register: registerTimeTools },
  { name: "Audio Management", register: registerAudioTools },
  { name: "Color Grading & Looks", register: registerColorTools },
  { name: "3D Layers & Extrusions", register: registerScene3dTools },
  { name: "Cameras & Motion", register: registerCameraTools },
  { name: "Lighting & Shading", register: registerLightingTools },
  { name: "3D Motion Graphics Scenes", register: registerSceneTools },
  { name: "Cinematic Looks & Presets", register: registerLookTools },
  { name: "Particle Systems", register: registerParticleTools },
  { name: "Procedural Backgrounds", register: registerBackgroundTools },
  { name: "Distortion & Glitch", register: registerDistortTools },
  { name: "Motion & Physics Rigs", register: registerRigTools },
  { name: "Vision & Preview", register: registerPreviewTools },
  { name: "Quality Assurance (QA)", register: registerQaTools },
  { name: "Project & Checkpoints", register: registerProjectTools },
  { name: "Rendering & Export", register: registerRenderTools },
  { name: "Social Variants & Reframe", register: registerFormatTools },
  { name: "Essential Graphics & Templates", register: registerTemplateTools },
  { name: "Asset & Beat Analysis", register: registerAnalysisTools },
  { name: "Brand Identity Kit", register: registerBrandTools },
  { name: "Storyboard & Director", register: registerStoryboardTools },
  { name: "Video Production Recipes", register: registerRecipeTools },
  { name: "Render Quality & Standards", register: registerQualityTools },
  { name: "Motion Language & Easing", register: registerMotionTools },
  { name: "Design Styles & Aesthetics", register: registerStyleTools },
  { name: "Finishing Pass & Compositing", register: registerFinishingTools },
  { name: "Reference Matching & Palette", register: registerReferenceTools }
];

function generateDocs(): void {
  console.log("Generating docs/tools.md from tool definitions...");

  const collected: ToolDocEntry[] = [];

  for (const cat of CATEGORIES) {
    const mockServer = {
      tool: (name: string, description: string, schema: any) => {
        const paramList: ToolDocEntry["params"] = [];

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
        } catch (eErr) {
          console.error(`Error parsing schema for tool ${name}:`, eErr);
        }

        collected.push({
          name,
          description,
          category: cat.name,
          params: paramList
        });
      }
    };

    cat.register(mockServer);
  }

  // Group by category
  const grouped: Record<string, ToolDocEntry[]> = {};
  for (const entry of collected) {
    if (!grouped[entry.category]) {
      grouped[entry.category] = [];
    }
    grouped[entry.category].push(entry);
  }

  let md = `# AE Bridge Tools Reference\n\n`;
  md += `Auto-generated reference documentation for all **${collected.length} MCP tools** provided by the AE Bridge server.\n\n`;
  md += `## Table of Contents\n\n`;

  for (const catName of Object.keys(grouped)) {
    const anchor = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    md += `- [${catName}](#${anchor}) (${grouped[catName].length} tools)\n`;
  }
  md += `\n---\n\n`;

  for (const [catName, tools] of Object.entries(grouped)) {
    md += `## ${catName}\n\n`;

    for (const t of tools) {
      md += `### \`${t.name}\`\n\n`;
      md += `${t.description}\n\n`;

      if (t.params.length === 0) {
        md += `*No parameters required.*\n\n`;
      } else {
        md += `| Parameter | Type | Required | Description | Default |\n`;
        md += `|---|---|---|---|---|\n`;
        for (const p of t.params) {
          const reqStr = p.required ? "**Yes**" : "No";
          const defStr = p.default !== undefined ? `\`${p.default}\`` : "-";
          const cleanDesc = p.description.replace(/\|/g, "\\|");
          md += `| \`${p.name}\` | \`${p.type}\` | ${reqStr} | ${cleanDesc} | ${defStr} |\n`;
        }
        md += `\n`;
      }
    }

    md += `---\n\n`;
  }

  const docsDir = path.join(REPO_ROOT, "docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const outputPath = path.join(docsDir, "tools.md");
  fs.writeFileSync(outputPath, md, "utf-8");
  console.log(`✓ Generated ${outputPath} (${collected.length} tools documented across ${Object.keys(grouped).length} categories).`);
}

generateDocs();
