import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getToolCatalog, ToolCatalogEntry } from "./registry.js";

export type ProfileName = "minimal" | "standard" | "blender" | "full";

export interface ProfileDefinition {
  name: ProfileName;
  description: string;
  tools?: Set<string>;
}

// 1. Minimal Profile: ultra-lightweight essential set (~24 tools)
const MINIMAL_TOOLS = new Set<string>([
  "ae_ping",
  "ae_get_project_info",
  "ae_execute_extendscript",
  "ae_bridge_status",
  "ae_batch",
  "ae_search_tools",
  "ae_list_profiles",
  "ae_create_comp",
  "ae_list_comps",
  "ae_get_comp",
  "ae_update_comp",
  "ae_add_solid",
  "ae_add_text",
  "ae_list_layers",
  "ae_update_layer",
  "ae_set_transform",
  "ae_delete_layer",
  "ae_add_keyframes",
  "ae_add_effect",
  "ae_preview_frame",
  "ae_qa_check",
  "ae_save_project",
  "ae_render",
  "ae_render_status",
  "ae_render_job_status"
]);

// 2. Blender Profile: 3D generation, camera sync, depth pass, and core comp tools (~38 tools)
const BLENDER_TOOLS = new Set<string>([
  ...MINIMAL_TOOLS,
  "blender_status",
  "blender_set_path",
  "blender_preview",
  "blender_render",
  "blender_job_status",
  "blender_cancel_job",
  "blender_save_blend",
  "blender_list_presets",
  "blender_3d_title",
  "blender_logo_reveal",
  "blender_product_shot",
  "blender_physics_shot",
  "blender_hdri_fetch",
  "ae_import_blender_render",
  "ae_depth_effects",
  "ae_contact_sheet",
  "ae_camera_rig",
  "ae_camera_move",
  "ae_setup_lighting",
  "ae_render_job_start",
  "ae_render_job_cancel",
  "ae_render_job_list"
]);

// 3. Standard Profile: comprehensive everyday motion graphics & video editing (~85 tools, default)
const STANDARD_TOOLS = new Set<string>([
  ...MINIMAL_TOOLS,
  "ae_open_comp",
  "ae_precompose",
  "ae_duplicate_comp",
  "ae_delete_item",
  "ae_add_null",
  "ae_add_shape",
  "ae_add_camera",
  "ae_add_light",
  "ae_duplicate_layer",
  "ae_reorder_layer",
  "ae_list_properties",
  "ae_get_property",
  "ae_set_property",
  "ae_remove_keyframes",
  "ae_set_expression",
  "ae_animate",
  "ae_list_installed_effects",
  "ae_set_effect_property",
  "ae_list_layer_effects",
  "ae_remove_effect",
  "ae_create_title_card",
  "ae_create_lower_third",
  "ae_apply_title_preset",
  "ae_add_text_animator",
  "ae_import_files",
  "ae_import_folder",
  "ae_list_footage",
  "ae_replace_footage",
  "ae_add_footage_to_comp",
  "ae_trim_layer",
  "ae_split_layer",
  "ae_sequence_layers",
  "ae_ripple_delete",
  "ae_fit_layer",
  "ae_build_edit",
  "ae_add_transition",
  "ae_list_transitions",
  "ae_set_speed",
  "ae_enable_time_remap",
  "ae_set_audio_level",
  "ae_fade_audio",
  "ae_duck_audio",
  "ae_color_grade",
  "ae_apply_lut",
  "ae_add_adjustment_grade",
  "ae_camera_rig",
  "ae_camera_move",
  "ae_setup_lighting",
  "ae_set_light",
  "ae_create_background",
  "ae_contact_sheet",
  "ae_preview_layer_isolated",
  "ae_set_preview_time",
  "ae_get_layer_bounds",
  "ae_timeline_summary",
  "ae_project_status",
  "ae_organize_project",
  "ae_reload_tools",
  "ae_checkpoint",
  "ae_restore_checkpoint",
  "ae_list_output_templates",
  "ae_export_frame",
  "ae_export_gif",
  "ae_render_job_start",
  "ae_render_job_cancel",
  "ae_render_job_list",
  "ae_create_format_variant",
  "ae_create_all_social_variants",
  "ae_detect_beats",
  "ae_set_brand_kit",
  "ae_get_brand_kit",
  "ae_list_recipes",
  "ae_get_recipe",
  "ae_run_recipe",
  "ae_set_quality_mode",
  "ae_apply_motion_curve",
  "ae_stagger",
  "ae_list_styles",
  "ae_get_style",
  "ae_set_active_style",
  "ae_finish_pass",
  "ae_remove_finish_pass",
  "ae_analyze_reference",
  "ae_compare_to_reference",
  "ae_create_style_from_reference"
]);

export const PROFILE_DEFINITIONS: Record<ProfileName, ProfileDefinition> = {
  minimal: {
    name: "minimal",
    description: "Ultra-lightweight core profile (~24 tools) for basic composition, layer, and render workflows with minimal token overhead.",
    tools: MINIMAL_TOOLS
  },
  standard: {
    name: "standard",
    description: "Balanced motion graphics & video editing profile (~85 tools) covering animation, typography, color, audio, and quality review (default).",
    tools: STANDARD_TOOLS
  },
  blender: {
    name: "blender",
    description: "3D-focused profile (~38 tools) combining Blender photoreal generation, camera sync, depth pass compositing, and core AE tools.",
    tools: BLENDER_TOOLS
  },
  full: {
    name: "full",
    description: "Complete unrestricted tool surface (all 169+ tools) for advanced power users and complete After Effects automation."
  }
};

export function getActiveProfile(): ProfileName {
  const envProfile = (process.env.AE_BRIDGE_PROFILE || "standard").trim().toLowerCase() as ProfileName;
  if (envProfile in PROFILE_DEFINITIONS) {
    return envProfile;
  }
  console.error(`[ae-bridge] Warning: Unknown profile '${envProfile}', falling back to 'standard'.`);
  return "standard";
}

export function isToolAllowedInProfile(toolName: string, profile: ProfileName = getActiveProfile()): boolean {
  // Meta tools and core diagnostics are always accessible in every profile
  if (toolName === "ae_search_tools" || toolName === "ae_list_profiles" || toolName === "ae_bridge_status" || toolName === "ae_batch") {
    return true;
  }

  if (profile === "full") return true;

  const def = PROFILE_DEFINITIONS[profile];
  return def && def.tools ? def.tools.has(toolName) : true;
}

export function createProfileFilter(server: McpServer, profile: ProfileName = getActiveProfile()): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === "tool") {
        return (name: string, ...args: any[]) => {
          if (isToolAllowedInProfile(name, profile)) {
            return (target.tool as any)(name, ...args);
          }
          // Excluded from current profile
          return undefined;
        };
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === "function" ? val.bind(target) : val;
    }
  });
}

export function listProfilesInfo(): {
  activeProfile: ProfileName;
  profiles: Array<{
    name: ProfileName;
    description: string;
    toolCount: number;
    isActive: boolean;
  }>;
} {
  const active = getActiveProfile();
  const catalog = getToolCatalog();
  const totalCount = catalog.length;

  const profiles = (Object.keys(PROFILE_DEFINITIONS) as ProfileName[]).map((pName) => {
    const def = PROFILE_DEFINITIONS[pName];
    const count = pName === "full" ? totalCount : (def.tools ? def.tools.size : totalCount);
    return {
      name: pName,
      description: def.description,
      toolCount: count,
      isActive: pName === active
    };
  });

  return {
    activeProfile: active,
    profiles
  };
}

export function searchToolsInCatalog(params: {
  query?: string;
  tag?: string;
  category?: string;
  limit?: number;
}): Array<{
  name: string;
  description: string;
  category: string;
  tag: string;
  profiles: ProfileName[];
  parameters: Array<{ name: string; type: string; required: boolean; description: string }>;
}> {
  const catalog = getToolCatalog();
  const query = params.query ? params.query.toLowerCase() : "";
  const tag = params.tag ? params.tag.toLowerCase() : "";
  const category = params.category ? params.category.toLowerCase() : "";
  const limit = params.limit && params.limit > 0 ? params.limit : 20;

  const matches: Array<{
    name: string;
    description: string;
    category: string;
    tag: string;
    profiles: ProfileName[];
    parameters: Array<{ name: string; type: string; required: boolean; description: string }>;
  }> = [];

  for (const tool of catalog) {
    if (query) {
      const inName = tool.name.toLowerCase().includes(query);
      const inDesc = tool.description.toLowerCase().includes(query);
      if (!inName && !inDesc) continue;
    }

    if (tag) {
      const inTag = tool.tag.toLowerCase().includes(tag);
      const inCat = tool.category.toLowerCase().includes(tag);
      if (!inTag && !inCat) continue;
    }

    if (category) {
      if (!tool.category.toLowerCase().includes(category)) continue;
    }

    const profiles: ProfileName[] = [];
    if (isToolAllowedInProfile(tool.name, "minimal")) profiles.push("minimal");
    if (isToolAllowedInProfile(tool.name, "blender")) profiles.push("blender");
    if (isToolAllowedInProfile(tool.name, "standard")) profiles.push("standard");
    profiles.push("full");

    matches.push({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      tag: tool.tag,
      profiles,
      parameters: tool.params.map((p) => ({
        name: p.name,
        type: p.type,
        required: p.required,
        description: p.description
      }))
    });

    if (matches.length >= limit) break;
  }

  return matches;
}
