import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  // 1. director prompt: End-to-end video directing workflow
  server.prompt(
    "director",
    "End-to-end video directing workflow. Guides the AI agent through inspecting the project, applying brand kit identity, planning the storyboard, building scenes, conducting visual self-review, and exporting the final video.",
    {
      goal: z.string().describe("The creative goal or video description (e.g. 'Create a 15s product launch intro for NOVA X')"),
      duration: z.string().optional().describe("Target total duration in seconds or time description (e.g. '15s', '30 seconds')"),
      format: z.string().optional().describe("Target aspect ratio or delivery format (e.g. '16:9', '9:16 vertical', '1:1 square')"),
      brandName: z.string().optional().describe("Brand or client identity name")
    },
    async (args) => {
      const { goal, duration = "15s", format = "16:9", brandName = "Default" } = args;

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `You are the Executive Director for an After Effects video production project.

CREATIVE BRIEF:
• Goal: ${goal}
• Target Duration: ${duration}
• Target Aspect/Format: ${format}
• Brand / Client Identity: ${brandName}

DIRECTOR WORKFLOW GUIDELINES:
Follow this disciplined step-by-step production pipeline:

1. STATUS & CHECKPOINT:
   - Call ae_project_status to inspect open comps, footage, and project state.
   - Call ae_checkpoint to snapshot the project before making modifications.

2. BRAND KIT ALIGNMENT:
   - Call ae_get_brand_kit to check active colors, typography, and styling.
   - If custom brand colors or fonts are needed for this production, update them using ae_set_brand_kit.

3. ASSET & AUDIO INSPECTION:
   - Call ae_analyze_assets to inspect existing footage, audio, or still image assets.
   - If audio/music is present, run ae_detect_beats to find tempo (BPM) and rhythmic peak markers.

4. STORYBOARD PLANNING:
   - Formulate and explain a clear storyboard outline in your reply FIRST (scene list with durations, visual intent, typography, and transitions).
   - Check ae_list_recipes to see if a pre-engineered recipe (e.g. productLaunch, youtubeIntro, hypePromo, socialAd15s) fits the goal.
   - If using a recipe: execute via ae_run_recipe.
   - If custom: build using ae_build_storyboard with scene precomps.

5. VISUAL SELF-REVIEW LOOP:
   - Generate an ae_contact_sheet of the master composition to visually inspect every beat of the timeline.
   - Run ae_qa_check to catch overlaps, hidden layers, unparented elements, or missing assets.
   - Refine any scene using ae_update_scene or direct adjustment tools until the pacing, typography, and motion feel broadcast-ready.

6. RENDER & REPORT:
   - If social variants are requested, call ae_create_all_social_variants.
   - Queue or render using ae_render with the requested preset (e.g. 'mp4High').
   - Provide a final director summary with comp name, duration, and render status.`
            }
          }
        ]
      };
    }
  );

  // 2. polish prompt: Review and improve an existing comp
  server.prompt(
    "polish",
    "Critique, polish, and elevate an existing After Effects composition through automated QA inspection, contact sheet visual review, motion enhancement, and refined pacing.",
    {
      compName: z.string().describe("Name of the composition to review and polish")
    },
    async (args) => {
      const { compName } = args;

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `You are a Senior Motion Graphics Polish and Quality Assurance Director.

TASK:
Audit, critique, and elevate composition "${compName}".

POLISH PROTOCOL:
1. INSPECTION & QA:
   - Run ae_qa_check on "${compName}" to check for dead frames, overlapping elements, or improper transforms.
   - Generate an ae_contact_sheet (count: 6 to 9) to examine the visual progression and color hierarchy.

2. CRITIQUE & GAP ANALYSIS:
   - Check typography: Is it static? Add text animators (ae_apply_title_preset or ae_add_text_animator).
   - Check energy & motion: Add subtle rigs (ae_apply_rig: bounce, wiggle, or camera shake).
   - Check atmosphere: Add background layers (ae_create_background), particles (ae_add_particles), or lighting sweeps (ae_add_light_effect).
   - Check color & finish: Apply cinematic looks or film grain (ae_apply_look).

3. EXECUTION:
   - Apply specific high-impact enhancements.
   - Run ae_checkpoint with a descriptive label (e.g. "pre-polish").

4. VERIFICATION:
   - Generate a new ae_contact_sheet or ae_preview_frame to verify before/after improvement.
   - Summarize changes made and why they improve production quality.`
            }
          }
        ]
      };
    }
  );

  // 3. social-pack prompt: Adapt video for multi-platform delivery
  server.prompt(
    "social-pack",
    "Adapt an existing master composition into channel-ready social formats (9:16 vertical, 1:1 square, 4:5 portrait) with UI-safe typography and batch rendering.",
    {
      compName: z.string().describe("Master composition to convert into social variants"),
      platforms: z.string().optional().describe("Optional target platforms (e.g. 'tiktok,instagram,youtube,linkedin')")
    },
    async (args) => {
      const { compName, platforms = "tiktok, reels, shorts, instagram feed" } = args;

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `You are the Social Media Video Producer.

TASK:
Produce a multi-format social campaign pack from composition "${compName}".
Target Platforms: ${platforms}

SOCIAL PACK WORKFLOW:
1. MASTER INSPECTION:
   - Inspect composition "${compName}" with ae_get_comp to confirm resolution, aspect ratio, and layer hierarchy.

2. VARIANT GENERATION:
   - Call ae_create_all_social_variants with masterComp: "${compName}".
   - This generates:
     • 9:16 (1080x1920) for TikTok, Instagram Reels, and YouTube Shorts.
     • 1:1 (1080x1080) for Square Feed.
     • 4:5 (1080x1350) for Instagram Portrait Feed.

3. REFRAMING & SAFE ZONES:
   - For vertical 9:16 variants, inspect typography position to avoid overlapping platform UI controls (profile badges, sound tags, caption overlays).
   - Reframe key footage subjects using center crop or smart scaling.

4. BATCH EXPORT:
   - Call ae_batch_render with items for each generated social composition using 'mp4High' or 'mp4Web'.
   - Monitor render completion with ae_render_status.
   - Return clean file paths for all exported social deliverables.`
            }
          }
        ]
      };
    }
  );
}
