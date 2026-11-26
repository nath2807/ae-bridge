# Prompts & Workflows Reference

AE Bridge registers specialized MCP prompts designed for complex multi-step creative workflows.

---

## 1. `director` (Executive Video Director)

Guides the agent through the complete lifecycle of a video project:
1. **Status & Checkpoint**: Runs `ae_project_status` and creates a snapshot with `ae_checkpoint`.
2. **Brand Kit Alignment**: Queries `ae_get_brand_kit` and applies client colors/typography.
3. **Asset & Audio Inspection**: Runs `ae_analyze_assets` and `ae_detect_beats`.
4. **Storyboard Planning**: Selects recipes from `ae_list_recipes` or builds custom scene precomps with `ae_build_storyboard`.
5. **Finishing Pass**: Applies 32-bpc linear blending, motion blur, and compositing effects via `ae_finish_pass`.
6. **Art Director Rubric**: Generates an `ae_contact_sheet`, runs `ae_qa_check`, and scores across all 8 design criteria (1-10).
7. **Render & Delivery**: Exports master renders and social variants via `ae_render`.

---

## 2. `polish` (Senior Motion Graphics Polish)

Designed to elevate an existing composition:
1. Generates an `ae_contact_sheet` to inspect visual cadence.
2. Runs `ae_qa_check` to detect overlaps, hidden layers, or unparented elements.
3. Enhances motion curves with `ae_apply_motion_curve` and `ae_stagger`.
4. Applies finishing grades with `ae_finish_pass`.
