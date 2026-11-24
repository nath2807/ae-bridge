When working in After Effects, always prefer dedicated ae_ tools (ae_create_title_card, ae_apply_title_preset, ae_add_text_animator, ae_animate, etc). Use ae_execute_extendscript only if no tool exists, and then suggest a new tool to add to the bridge.

## High-End Design Engine & Quality Standards
Every output from ae-bridge must look broadcast-ready by default:
1. **Render Quality Mode**: Always call `ae_set_quality_mode` with mode: `"final"` before rendering or final review. This guarantees 32/16 bpc color depth, linear blending, full resolution, 180 shutter angle, -90 shutter phase, and active motion blur on animated layers.
2. **Finishing Pass**: Apply `ae_finish_pass` to compose a multi-layer finishing stack (depth haze, light wrap, bloom, chromatic aberration, film grain, vignette, and color grade matching the style palette).
3. **Motion Curves & Staggering**: Avoid default linear or unpolished keyframes. Use `ae_apply_motion_curve` with named curves ("expoOut", "expoInOut", "quintOut", "backOut", "snap", "smooth", "heavy", "elasticOut") and cascade multi-layer entrances with `ae_stagger`.
4. **Style Alignment**: Query `ae_get_style` and enforce the active style's palette, typography, motion energy, and strict `do[]` and `dont[]` design rules.

## Art Director Scored Review Rubric
After creating or changing anything visual in After Effects:
1. Run `ae_qa_check` and fix every reported warning or error.
2. Ensure `ae_set_quality_mode` ("final") and `ae_finish_pass` have been applied.
3. Generate an `ae_contact_sheet` (or `ae_preview_frame`) and visually inspect the timeline.
4. Score the output across the **8 Art Director Criteria (1–10 scale)**:
   - **Composition & focal point**: Clear visual hierarchy, rule of thirds, no competing focal points.
   - **Typography**: Font pairing, tracking, leading, safe zones, text animator integration.
   - **Color & contrast**: Palette harmony, luminance contrast, emissive glow balance.
   - **Depth & layering**: Foreground framing/particles, midground subject, background atmosphere.
   - **Lighting**: Key/rim illumination, specular falloff, directional lighting intent.
   - **Motion quality**: Named easing curves, stagger offsets, natural anticipation, motion blur.
   - **Detail & finish**: Texture presence, film grain, bloom threshold, vignette, halation.
   - **Brief match**: Faithfulness to user prompt, brand kit identity, mood, and target duration.
5. **Score Threshold Rule**: Do NOT finish until **every score is ≥ 8** or **3 refinement rounds** are completed.
6. Fix any score under 8 using dedicated `ae_` tools, then re-generate the contact sheet and re-score.
7. Report the final scorecard table with scores and concise rationales in your reply.

## Workflow & Operations
- Save the project with `ae_save_project` after major steps.
- After editing JSX files, call `ae_reload_tools` to hot-reload ExtendScript handlers without restarting After Effects.
- Before rendering, run `ae_qa_check`. Prefer mode `'ame'` for long renders so After Effects stays responsive.

## Director Workflow
For any request to create a full video (intro, promo, ad, trailer, montage, etc.): act as an Executive Director. Follow the pipeline:
status → brand alignment (`ae_get_brand_kit` / `ae_set_brand_kit`) → style selection (`ae_get_style` / `ae_set_active_style`) → asset/beat analysis (`ae_analyze_assets`, `ae_detect_beats`) → storyboard planning (propose scene list in reply first) → checkpoint (`ae_checkpoint`) → build (`ae_build_storyboard` / `ae_run_recipe`) → quality & finish pass (`ae_set_quality_mode`, `ae_finish_pass`) → scored rubric self-review (≥8 threshold) → render (`ae_render`) → report.

## Photoreal 3D with Blender Bridge
For photoreal 3D (chrome/glass/gold objects, product shots, logos with real reflections, physics), use Blender tools. Always `blender_preview` first, review the image with the art director rubric, adjust spec, then `blender_render` final. Composite in AE with `ae_import_blender_render` + `ae_finish_pass`. Keep AE for typography that must stay sharp and editable.
