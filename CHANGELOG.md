# Changelog

All notable changes to the AE Bridge project are documented in this file.

---

## [1.2.0] - 2026-11-24

### Added
- **Blender 3D Bridge (Step 12):**
  - Headless Blender integration supporting Blender 4.2 through 5.x with automatic GPU compute device selection (Cycles OptiX/CUDA/HIP/Metal & EEVEE Next).
  - Robust compatibility layer (`blender/compat.py`) handling Blender 5.0+ Slotted Action channelbags architecture, dynamic EEVEE engine identifiers, and Principled BSDF socket name differences.
  - Background asynchronous job queue (`startBlenderJob`, `blender_render`, `blender_job_status`, `blender_cancel_job`) with progress streaming (`AEB_PROGRESS`) and disk persistence.
  - 14 procedural PBR material presets (`chrome`, `gold`, `brushedAluminum`, `glass`, `frostedGlass`, `glossyPlastic`, `matteClay`, `ceramic`, `rubber`, `carbonFiber`, `holographic`, `neonEmission`, `liquidMetal`, `marble`).
  - 7 studio cyclorama lighting rigs (`studioSoft`, `studioDramatic`, `rimNeon`, `sunset`, `productWhite`, `darkLuxury`, `volumetricBeams`) and Poly Haven CC0 HDRI caching (`blender_hdri_fetch`).
  - 9 physical camera moves (`orbit`, `orbitHalf`, `pushIn`, `pullOut`, `craneUp`, `flyThrough`, `turntable`, `heroReveal`, `dollyZoom`) with F-curve easing.
  - 3D typography generator with per-character staggered cascade animation and SVG vector logo 3D extrusion (`blender_3d_title`, `blender_logo_reveal`).
  - Physics simulations (`dropAndBounce`, `shatter`, `clothReveal`, `windFlag`, `scatterFall`) and procedural Geometry Node networks (`cubeGridWave`, `scatterOnSurface`, `particleField`, `rings`).
  - Camera tracking matrix and FOV export (`camera.json`) syncing directly into After Effects 3D cameras and tracking null anchors (`ae_import_blender_render`).
  - Normalized Z-depth pass compositing and depth effects (`ae_depth_effects`: camera lens blur, atmospheric fog, color depth mapping).
  - New scene type `"blender3d"` integrated into declarative storyboards (`ae_build_storyboard`).
  - Human handoff tool `blender_save_blend` for saving inspectable `.blend` files.

### Fixed
- **Render Preset Hierarchy & High-Bitrate Template Resolution:**
  - Upgraded template matching order in `ae_render`:
    1. Dedicated templates starting with `"AE Bridge"` matching the preset (`"AE Bridge H264 High"`, `"AE Bridge H264 Web"`).
    2. Bitrate-aware keyword fallback, selecting the highest Mbps for `mp4High` and lowest Mbps for `mp4Web`.
  - Added advisory warning for `mp4High` when falling back to templates under 20 Mbps with guidance to create `"AE Bridge H264 High"`.
  - Output payloads now explicitly include `templateName` and `matchedTemplate`.
  - Fixed JSX script folder path resolution in `ae_reload_tools`.

---

## [1.1.0] - 2026-11-24

### Added
- **High-End Design Engine (Step 11):**
  - Global render quality modes (`ae_set_quality_mode`): `draft` (8bpc, half res) vs `final` (16/32bpc linear, 16-sample motion blur, Advanced 3D renderer).
  - Motion curve language (`ae_apply_motion_curve`): `expoOut`, `expoInOut`, `quintOut`, `backOut` (overshoot), `snap`, `smooth`, `heavy`, `elasticOut`, `linear`.
  - Layer stagger cascade engine (`ae_stagger`) supporting `forward`, `reverse`, `center`, and `random` ordering.
  - 12 comprehensive style packs (`minimalPremium`, `techFuturistic`, `editorialSerif`, `boldPunchy`, `warmEditorial`, `darkLuxury`, `vaporwaveRetro`, `cinematicNoir`, `playfulPop`, `documentaryRaw`, `neonCyber`, `brutalistMonochrome`) controlling fonts, palettes, motion curves, and light wraps.
  - Broadcast compositing finishing pass (`ae_finish_pass` / `ae_remove_finish_pass`) with toggleable FINISH stack: depth haze, light wrap, bloom & glow, halation, chromatic aberration, film grain, and color grading.
  - Image reference extraction and matching (`ae_analyze_reference`, `ae_compare_to_reference`, `ae_create_style_from_reference`) using color quantization and luminance analysis.
  - Automated Art Director review rubric scoring composition hierarchy, rhythm, typography, and finishing on a 0–100 scale.

---

## [1.0.0] - 2026-11-23

### Release Highlights (Steps 1–10)
AE Bridge v1.0.0 delivers a complete, professional-grade Model Context Protocol (MCP) bridge for Adobe After Effects, transforming AI agents into full motion design directors.

### Added
- **Core Bridge Architecture (Steps 1–3):**
  - Stdio MCP server with WebSocket loopback connection to Adobe CEP extension.
  - ExtendScript dispatching layer with safe JSON parameter encoding.
  - Composition management, layers, keyframing, property animation, and basic effects.
- **Typography & Motion Graphics (Step 4):**
  - Kinetic title presets (`blurReveal`, `stomp`, `dramaticRise`, `cinematicGlitch`, `typewriter`, etc.).
  - Broadcast-ready lower third generators with modular styling.
  - Text animators and character-level tracking controls.
- **Footage, Audio & Video Editing (Step 5):**
  - Multi-track media import, automated comp creation, and clip sequence arrangement.
  - Video transitions (cross dissolves, whip pans, glitch cuts, push, zoom, and wipes).
  - Audio keyframe conversion, volume ducking, and fade-in/fade-out envelopes.
- **3D World & Cinematic Looks (Step 6):**
  - Advanced 3D renderer switching (Cinema 4D / Advanced 3D).
  - 3D extruded metallic typography, material properties, and procedural 3D motion graphic scenes.
  - Camera rigs (orbital, dolly, pan) and directional/point lighting presets.
  - Particle emitters (golden embers, sparkles, digital sparks, smoke) and cinematic color grades (vignette, film grain, cinema bars, bleach bypass).
- **Vision Pipeline & Visual Self-Review (Step 7):**
  - High-speed frame capture (`saveFrameToPng` with Render Queue fallback).
  - Multi-frame contact sheets composited with `sharp` and annotated with SVG timestamp overlays.
  - Automated composition QA checks (`ae_qa_check`) detecting bounding collisions, layer clipping, dead space, and static openings.
- **Rendering & Social Formats (Step 8):**
  - Background rendering via Adobe Media Encoder (AME) and direct in-AE export.
  - Social media smart reframe producing 9:16 vertical, 1:1 square, and 4:5 portrait formats.
  - Project management, item organization, reduction, and runtime ExtendScript hot-reloading (`ae_reload_tools`).
- **Director Layer & Recipes (Step 9):**
  - Declarative multi-scene `Storyboard` schema with automatic scene precomp isolation.
  - 12 production-ready video recipes (`youtubeIntro`, `productLaunch`, `hypePromo`, `socialAd15s`, `kineticTypography`, etc.).
  - Master brand kit management (`~/.ae-bridge/brand.json`) and project milestone checkpoints (`ae_checkpoint`).
  - Audio volume peak detection with adaptive standard-deviation thresholding.
- **Release Readiness & Security (Step 10):**
  - Token-based WebSocket authentication (`~/.ae-bridge/token`) with 3-second rejection timeout.
  - Cross-platform CLI (`ae-bridge install`, `ae-bridge doctor`, `ae-bridge config`).
  - 16 automated Vitest unit tests covering schemas, beat detection, and storyboards.
  - Auto-generated complete tools documentation (`docs/tools.md`) documenting all 139 tools.
  - CI/CD release workflows and issue templates.
