import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callAE } from "../bridge.js";
import { toolSuccess, toolError } from "./schemas.js";

export function registerFootageTools(server: McpServer): void {
  // 1. ae_import_files
  server.tool(
    "ae_import_files",
    "Import one or more media files (video, audio, image, image sequence) into the After Effects project.",
    {
      paths: z.array(z.string()).min(1).describe("Array of absolute file paths to import"),
      folderName: z.string().optional().describe("Optional project folder name to organize imported files into (created if missing)"),
      asSequence: z.boolean().optional().default(false).describe("Whether to import files as a numbered image sequence")
    },
    async (params) => {
      try {
        const result = await callAE("ae_import_files", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 2. ae_import_folder
  server.tool(
    "ae_import_folder",
    "Import all supported media files from a local directory into a dedicated After Effects project bin folder.",
    {
      folderPath: z.string().describe("Absolute path to the local directory to import"),
      extensions: z.array(z.string()).optional().default(["mp4", "mov", "png", "jpg", "wav", "mp3", "psd", "ai"]).describe("File extension filters (default: video, audio, graphics)"),
      recursive: z.boolean().optional().default(false).describe("Whether to recursively scan nested subdirectories")
    },
    async (params) => {
      try {
        const result = await callAE("ae_import_folder", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 3. ae_list_footage
  server.tool(
    "ae_list_footage",
    "List all footage, media assets, and solids currently in the After Effects project with resolution, duration, and file paths.",
    {
      filter: z.string().optional().describe("Optional case-insensitive search filter for footage name or file path")
    },
    async (params) => {
      try {
        const result = await callAE("ae_list_footage", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 4. ae_interpret_footage
  server.tool(
    "ae_interpret_footage",
    "Modify footage interpretation settings including frame rate conforming, alpha mode, and looping.",
    {
      itemId: z.number().int().describe("Project item ID of the footage item to interpret"),
      conformFrameRate: z.number().positive().optional().describe("Conform footage playback frame rate in fps (e.g. 24, 29.97, 60)"),
      alphaMode: z.enum(["straight", "premultiplied", "ignore"]).optional().describe("Alpha channel interpretation"),
      loop: z.number().int().min(1).optional().describe("Number of times to loop playback")
    },
    async (params) => {
      try {
        const result = await callAE("ae_interpret_footage", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 5. ae_replace_footage
  server.tool(
    "ae_replace_footage",
    "Replace a footage item's source file with a new file path while preserving all timeline uses and layer edits.",
    {
      itemId: z.number().int().describe("Project item ID of the footage to replace"),
      newPath: z.string().describe("Absolute path to the replacement file")
    },
    async (params) => {
      try {
        const result = await callAE("ae_replace_footage", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );

  // 6. ae_create_comp_from_footage
  server.tool(
    "ae_create_comp_from_footage",
    "Create a new composition from one or multiple footage items, optionally sequencing them sequentially.",
    {
      itemIds: z.array(z.number().int()).min(1).describe("Array of project footage item IDs to add to the new comp"),
      name: z.string().optional().describe("Composition name (defaults to first footage item name + ' Comp')"),
      sequence: z.boolean().optional().default(false).describe("Whether to sequence layers back-to-back in timeline order"),
      useFootageSettings: z.boolean().optional().default(true).describe("Whether to inherit composition dimensions and framerate from the lead footage")
    },
    async (params) => {
      try {
        const result = await callAE("ae_create_comp_from_footage", params);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    }
  );
}
