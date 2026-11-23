import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { toolSuccess, toolError } from "../tools/schemas.js";
import { getActiveBrandDefaults } from "./brand.js";
import { storyboardSchema, type Storyboard } from "./storyboard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RecipeInputDef {
  type: string;
  default: string | number | boolean;
  description: string;
}

export interface RecipeDefinition {
  name: string;
  description: string;
  duration: number;
  inputs: Record<string, RecipeInputDef>;
  storyboard: any;
}

export function getRecipesDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "recipes"),
    path.resolve(process.cwd(), "../recipes"),
    path.resolve(__dirname, "../../recipes"),
    path.resolve(__dirname, "../../../recipes")
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }

  // Fallback to project root recipes
  return path.resolve(process.cwd(), "recipes");
}

export function loadAllRecipes(): RecipeDefinition[] {
  const dir = getRecipesDir();
  const recipes: RecipeDefinition[] = [];

  if (!fs.existsSync(dir)) {
    return recipes;
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith(".json")) {
      try {
        const fullPath = path.join(dir, file);
        const content = fs.readFileSync(fullPath, "utf-8");
        const parsed = JSON.parse(content) as RecipeDefinition;
        if (parsed.name && parsed.storyboard) {
          recipes.push(parsed);
        }
      } catch (err) {
        console.error(`[ae-bridge] Error loading recipe file ${file}:`, err);
      }
    }
  }

  return recipes;
}

export function getRecipeByName(name: string): RecipeDefinition | null {
  const recipes = loadAllRecipes();
  const target = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const r of recipes) {
    if (r.name.toLowerCase().replace(/[^a-z0-9]/g, "") === target) {
      return r;
    }
  }
  return null;
}

function resolvePlaceholders(template: any, values: Record<string, any>): any {
  if (typeof template === "string") {
    // Exact single placeholder match that should preserve number/boolean type
    const exactMatch = template.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
    if (exactMatch) {
      const key = exactMatch[1];
      if (values[key] !== undefined) {
        return values[key];
      }
    }

    // String interpolation for embedded placeholders
    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
      return values[key] !== undefined ? String(values[key]) : `{{${key}}}`;
    });
  }

  if (Array.isArray(template)) {
    return template.map((item) => resolvePlaceholders(item, values));
  }

  if (template !== null && typeof template === "object") {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(template)) {
      result[k] = resolvePlaceholders(v, values);
    }
    return result;
  }

  return template;
}

export function registerRecipeTools(server: McpServer): void {
  // 1. ae_list_recipes
  server.tool(
    "ae_list_recipes",
    "List all available video production recipes with descriptions, target durations, and required template inputs.",
    {},
    async () => {
      try {
        const recipes = loadAllRecipes();
        const summary = recipes.map((r) => ({
          name: r.name,
          description: r.description,
          duration: r.duration,
          inputs: r.inputs
        }));

        return toolSuccess({
          totalRecipes: summary.length,
          recipes: summary
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_get_recipe
  server.tool(
    "ae_get_recipe",
    "Retrieve the full recipe template definition, description, and inputs schema by recipe name.",
    {
      name: z.string().describe("Recipe name (e.g. 'youtubeIntro', 'logoReveal', 'productLaunch', 'hypePromo', 'socialAd15s', 'kineticTypography', 'eventRecap', 'cinematicTrailer', 'slideshow', 'countdown', 'tutorialIntro', 'lowerThirdPack')")
    },
    async (params) => {
      try {
        const recipe = getRecipeByName(params.name);
        if (!recipe) {
          throw new Error(`Recipe '${params.name}' not found. Use ae_list_recipes to see available recipes.`);
        }
        return toolSuccess(recipe);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_run_recipe
  server.tool(
    "ae_run_recipe",
    "Execute a video recipe in a single tool call. Fills input placeholders, builds all scenes, applies branding, and returns the assembled master composition.",
    {
      name: z.string().describe("Recipe name to execute"),
      inputs: z.record(z.any()).optional().default({}).describe("Map of input values to substitute into the recipe placeholders"),
      compName: z.string().optional().describe("Optional custom name for the resulting composition")
    },
    async (params) => {
      try {
        const recipe = getRecipeByName(params.name);
        if (!recipe) {
          throw new Error(`Recipe '${params.name}' not found. Use ae_list_recipes to view options.`);
        }

        // Merge inputs with default values from recipe definition
        const resolvedValues: Record<string, any> = {};
        if (recipe.inputs) {
          for (const [key, def] of Object.entries(recipe.inputs)) {
            resolvedValues[key] = def.default;
          }
        }
        if (params.inputs) {
          for (const [key, val] of Object.entries(params.inputs)) {
            resolvedValues[key] = val;
          }
        }

        // Deep resolve placeholders
        const populatedStoryboard = resolvePlaceholders(recipe.storyboard, resolvedValues);

        // Validate resolved storyboard
        const validatedStoryboard = storyboardSchema.parse(populatedStoryboard);

        const brandKit = validatedStoryboard.brand !== false ? getActiveBrandDefaults() : null;

        // Execute storyboard assembly in After Effects (up to 10 min timeout)
        const result = await callAE(
          "ae_build_storyboard",
          {
            storyboard: validatedStoryboard,
            compName: params.compName || validatedStoryboard.title,
            brandKit
          },
          600000
        );

        return toolSuccess({
          recipe: recipe.name,
          inputs: resolvedValues,
          result
        });
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
