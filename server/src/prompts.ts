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

5. HIGH-END FINISHING & QUALITY PASS:
   - Call ae_set_quality_mode with mode: "final" to ensure 32/16 bpc deep color, linear blending, shutter angle 180, shutter phase -90, and motion blur on comp and animated layers.
   - Call ae_finish_pass to apply a professional compositing stack (depth haze, light wrap, bloom & glow, chromatic aberration, film grain, vignette, color grade matching style palette, and atmosphere layers).

6. ART DIRECTOR SCORED RUBRIC & VISUAL REVIEW:
   - Generate an ae_contact_sheet of the master composition to visually inspect timeline progression.
   - Run ae_qa_check to catch overlaps, hidden layers, unparented elements, or missing assets.
   - Check ae_get_style to review active style's do and don't design principles.
   - Evaluate and score the composition across all 8 criteria (1–10 scale):
     1. Composition & focal point (clear visual hierarchy, no competing centers)
     2. Typography (font pairing, tracking, leading, safe zones, text animation)
     3. Color & contrast (palette harmony, contrast ratio, emissive balance)
     4. Depth & layering (foreground elements, midground hero, background atmosphere)
     5. Lighting (specular rim highlights, shadows, directional light intent)
     6. Motion quality (named curves, stagger cascade, natural anticipation, motion blur)
     7. Detail & finish (texture, film grain, bloom threshold, vignette, halation)
     8. Brief match (faithfulness to user intent, brand guidelines, and target duration)
   - RULE: Do not finalize until EVERY score is >= 8 or at most 3 refinement rounds are completed.
   - Refine any deficient area using dedicated ae_ tools (ae_update_scene, ae_apply_motion_curve, ae_stagger, etc.).

7. RENDER & REPORT:
   - If social variants are requested, call ae_create_all_social_variants.
   - Queue or render using ae_render with the requested preset (e.g. 'mp4High').
   - Provide the complete scored review scorecard, comp name, duration, and render status.`
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

2. ART DIRECTOR SCORED RUBRIC & GAP ANALYSIS:
   - Call ae_get_style to inspect active style do/dont design rules.
   - Generate an ae_contact_sheet (count: 6 to 9) to examine visual progression.
   - Score the composition across all 8 criteria (1–10):
     1. Composition & focal point
     2. Typography
     3. Color & contrast
     4. Depth & layering (foreground/mid/background)
     5. Lighting
     6. Motion quality (curves, stagger, motion blur)
     7. Detail & finish (texture, grain, glow)
     8. Brief match
   - Check typography: Is it static? Add text animators (ae_apply_title_preset or ae_add_text_animator).
   - Check motion: Re-ease keyframes using ae_apply_motion_curve and cascade layers with ae_stagger.
   - Check atmosphere: Add background layers (ae_create_background), particles (ae_add_particles), or lighting sweeps (ae_add_light_effect).

3. FINISHING PASS & QUALITY:
   - Run ae_set_quality_mode with mode: "final".
   - Run ae_finish_pass with appropriate level ("subtle", "rich", "extreme") matching the style.

4. EXECUTION & ITERATION:
   - Apply specific high-impact enhancements.
   - Re-score contact sheet. Do not complete until every score is >= 8 or 3 rounds are done.
   - Run ae_checkpoint with a descriptive label (e.g. "polished-master").

5. VERIFICATION:
   - Generate a final ae_contact_sheet to verify improvement.
   - Output the scored rubric table with justifications for each criterion.`
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
