import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { TOOL_MODULES } from "../src/tools/registry.js";

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

function generateDocs(): void {
  console.log("Generating docs/tools.md from tool definitions...");

  const collected: ToolDocEntry[] = [];

  for (const mod of TOOL_MODULES) {
    const mockServer: any = {
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
          category: mod.name,
          params: paramList
        });
      }
    };

    mod.register(mockServer);
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

  const outPath = path.join(docsDir, "tools.md");
  fs.writeFileSync(outPath, md, "utf-8");
  console.log(`✓ Generated ${outPath} (${collected.length} tools documented across ${Object.keys(grouped).length} categories).`);
}

generateDocs();
