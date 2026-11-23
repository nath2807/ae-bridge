import fs from "fs";
import os from "os";
import path from "path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { compRefSchema, toolSuccess, toolError } from "./schemas.js";

export function getDefaultProjectsDir(): string {
  const dir = path.join(os.homedir(), "Documents", "ae-bridge-projects").replace(/\\/g, "/");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function registerProjectTools(server: McpServer): void {
  // 1. ae_save_project
  server.tool(
    "ae_save_project",
    "Save the current After Effects project to disk (or Save As if path is specified or project is untitled). Defaults to Documents/ae-bridge-projects/<name>.aep.",
    {
      path: z.string().optional().describe("Destination file path (.aep). If omitted and project is untitled, defaults to Documents/ae-bridge-projects/<name>.aep")
    },
    async (params) => {
      try {
        let savePath = params.path;
        if (!savePath) {
          const status = (await callAE("ae_project_status", {})) as { path: string | null; name: string };
          if (!status.path) {
            const projectsDir = getDefaultProjectsDir();
            const cleanName = (status.name && status.name !== "Untitled")
              ? status.name.replace(/\.aep$/i, "")
              : `Project_${Date.now()}`;
            savePath = path.join(projectsDir, `${cleanName}.aep`).replace(/\\/g, "/");
          }
        }
        const result = await callAE("ae_save_project", { path: savePath });
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_open_project
  server.tool(
    "ae_open_project",
    "Open an existing After Effects project file (.aep) from disk. Warns if the current project has unsaved modifications unless force=true.",
    {
      path: z.string().describe("File path of the .aep project file to open"),
      force: z.boolean().optional().default(false).describe("Set true to discard unsaved changes in current project")
    },
    async (params) => {
      try {
        const cleanP = path.resolve(params.path).replace(/\\/g, "/");
        const result = await callAE("ae_open_project", { path: cleanP, force: params.force });
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_new_project
  server.tool(
    "ae_new_project",
    "Create a new blank After Effects project. Warns if the current project has unsaved changes unless force=true.",
    {
      force: z.boolean().optional().default(false).describe("Set true to discard unsaved changes in current project")
    },
    async (params) => {
      try {
        const result = await callAE("ae_new_project", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_project_status
  server.tool(
    "ae_project_status",
    "Inspect the current project state: saved file path, dirty flag (unsaved changes), counts of comps, footage, and folders, After Effects version, and available 3D renderers.",
    {},
    async () => {
      try {
        const result = await callAE("ae_project_status", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_organize_project
  server.tool(
    "ae_organize_project",
    "Organize project items into clean standard folders: 'Comps', 'Precomps', 'Footage', 'Audio', 'Images', and 'Solids'.",
    {},
    async () => {
      try {
        const result = await callAE("ae_organize_project", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_reduce_project
  server.tool(
    "ae_reduce_project",
    "Reduce the project to only the specified compositions, deleting all unreferenced assets, unused comps, and unused footage.",
    {
      keepComps: z.array(compRefSchema).min(1).describe("List of composition references to preserve")
    },
    async (params) => {
      try {
        const result = await callAE("ae_reduce_project", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 7. ae_reload_tools
  server.tool(
    "ae_reload_tools",
    "Re-evaluate and hot-reload all ExtendScript helper libraries and tool script files in the active CEP panel without restarting After Effects.",
    {},
    async () => {
      try {
        const result = await callAE("ae_reload_tools", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 8. ae_checkpoint
  server.tool(
    "ae_checkpoint",
    "Create a timestamped project backup copy in <project>_checkpoints/<timestamp>_<label>.aep before making destructive changes. The active project remains the original file.",
    {
      label: z.string().describe("Descriptive label for this milestone (e.g. 'before_reframe', 'pre_color_grade', 'v1_client')")
    },
    async (params) => {
      try {
        const defaultProjectsDir = getDefaultProjectsDir();
        const fallbackPath = path.join(defaultProjectsDir, `Project_${Date.now()}.aep`).replace(/\\/g, "/");
        const result = await callAE("ae_checkpoint", {
          label: params.label,
          defaultPath: fallbackPath
        });
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 9. ae_list_checkpoints
  server.tool(
    "ae_list_checkpoints",
    "List all available project checkpoint backups in the project's checkpoints directory sorted newest first.",
    {},
    async () => {
      try {
        const result = await callAE("ae_list_checkpoints", {});
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 10. ae_restore_checkpoint
  server.tool(
    "ae_restore_checkpoint",
    "Open and restore a previously saved project checkpoint file (.aep). Warns if the current project has unsaved modifications unless force=true.",
    {
      file: z.string().describe("Checkpoint file name (e.g. '20261123_212000_v1.aep') or full path"),
      force: z.boolean().optional().default(false).describe("Set true to discard unsaved changes in current project")
    },
    async (params) => {
      try {
        const result = await callAE("ae_restore_checkpoint", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
