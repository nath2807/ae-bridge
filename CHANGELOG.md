# Changelog

All notable changes to the AE Bridge project are documented in this file.

---

## [1.3.0] - 2026-11-26

### Added
- **Protocol v2 Handshake & Self-Healing Reliability:**
  - Upgraded loopback WebSocket wire protocol to Protocol v2 with structured authentication, capabilities negotiation, and version enforcement.
  - Bidirectional ping/pong heartbeats detecting unresponsive panel crashes and auto-healing stale connections.
  - Prioritized single-thread request queue (`system` > `user` > `batch`) with abort controller cancellation and timeout tracking.
  - Structured ExtendScript error propagation capturing exception names, error messages, filenames, and line numbers.
  - Live system status tool `ae_bridge_status` reporting connection health, latency, queue depth, memory consumption, and AE project telemetry.
  - Rotating file logger (`$AE_BRIDGE_HOME/logs/bridge.log`) with size-bounded rotation.
  - Honest CLI doctor (`ae-bridge doctor`) supporting true pass/fail/warn diagnostics, CSXS versions 10–13 registry inspection, non-disruptive `doctor_ping`, and `--json` machine output.
- **Multi-Client Hub & IPC Proxy Architecture:**
  - Single-instance Hub role acquisition using atomic PID lockfiles (`$AE_BRIDGE_HOME/hub.lock`).
  - WebSocket IPC proxy server (`127.0.0.1:8766`) allowing multiple Antigravity agent instances to multiplex through a single After Effects CEP connection.
  - Embedded HTTP REST bridge (`http://127.0.0.1:8766`) exposing `/health`, `/status`, and `/call` endpoints for external scripting and health probes.
- **Dynamic Tool Profiles:**
  - Runtime tool filtering via `AE_BRIDGE_PROFILE` environment variable: `minimal` (~24 tools), `standard` (~85 tools, default), `blender` (~38 tools), and `full` (185 tools).
  - Runtime meta-tools: `ae_search_tools`, `ae_list_profiles`, and `ae_batch` (executing multiple commands in a single network round-trip wrapped in an atomic ExtendScript undo group).
  - Visual QA checks: `ae_qa_check` with optional `includePreview` returning base64 JPEG previews directly in the MCP tool response.
- **Non-Blocking Background Render Engine:**
  - Headless `aerender` spawner running independently of the CEP panel without blocking the After Effects UI.
  - Persistent disk tracker (`$AE_BRIDGE_HOME/render_jobs.json`) with frame-by-frame progress streaming, estimated time remaining, and abortable cancellation.
  - New render tools: `ae_render_job_start`, `ae_render_job_status`, `ae_render_job_cancel`, and `ae_render_job_list`.
  - Updated `ae_render` to support `mode: "aerender"` alongside `"ae"` and `"ame"`.
- **Major Capability Leap (20 New Tools, 185 Total):**
  - Recursive property hierarchy introspection via `ae_describe_property_tree` (ExtendScript + TypeScript).
  - Undo command `ae_undo` (`app.executeCommand(16)`).
  - Declarative JSON Scene Graph interchange: `ae_export_scene_graph` and `ae_apply_scene_graph`.
  - Data-driven versioning and MOGRT automation: `ae_render_mogrt` and `ae_batch_csv_replace` with zero-dependency CSV parsing.
  - Sharp-powered computer vision metrics: `ae_measure_frame` and `ae_measure_comp` computing mean luminance, RMS contrast, Laplacian variance blur detection, clipping analysis, and temporal stability.
  - Kinetic typography and transcription: `ae_transcribe_audio` with Whisper CLI detection and zero-dependency SRT/VTT parsing, and `ae_kinetic_captions` generating word-pop, bounce, and typewriter kinetic typography.
  - Blender engine enhancements: `denoiser` option (`OPENIMAGEDENOISE` / `OPTIX`), procedural `turntable` camera animation, pre-flight schema validator `blender_validate_spec`, and 3D asset import pipeline `ae_import_3d_asset`.
- **UXP Future-Proofing & HostAdapter Abstraction:**
  - Polymorphic `HostAdapter` interface abstracting host execution across CEP and UXP.
  - `CepHostAdapter` wrapping WebSocket lifecycle and ExtendScript ES3 dispatcher.
  - `UxpHostAdapter` modeling Adobe's modern UXP environment: V8 ECMAScript direct execution, `executeAsModal` transaction locking, and manifest network domain permissions.
  - Architectural migration guide `docs/uxp-migration.md`.
- **Antigravity-Native Packaging:**
  - Root plugin manifest `plugin.json` declaring bundled skills, rules, and suggested prompts.
  - First-class Antigravity skills `ae-bridge` and `blender-bridge`.
  - Strict agent execution rules `rules/ae-best-practices.md`.
  - Quick-start guide `docs/antigravity.md` with Mermaid architecture diagrams and slash command recommendations.
- **Mock-AE Test Harness & CI:**
  - In-memory `MockAEPanel` WebSocket client simulating the After Effects CEP runtime.
  - End-to-end integration test suite (`test/mock-integration.test.ts`) enabling fast CI verification without requiring physical After Effects GUI.
  - Headless `bpy` stub testing for Blender Python scripts.
  - Cross-platform packaging scripts `scripts/build-zxp.sh` and `scripts/build-zxp.ps1` with signing documentation in `docs/packaging.md`.

### Fixed
- **B1–B15 Defect Fixes:**
  - Resolved fresh install crash in macOS CLI symlinking (`throwIfNoEntry: false`).
  - Implemented atomic dependency downloads with SHA-256 verification and retry fallback.
  - Replaced dishonest doctor checks with true registry validation across CSXS 10–13 and non-disruptive `doctor_ping`.
  - Fixed hanging requests on socket disconnection or replacement by tracking socket ownership per call.
  - Fixed uncaught WebSocket error crashes during listener teardown.
  - Unified extension folder name canonically as `com.aebridge` across all CLI commands, installation scripts, manifests, and documentation.
  - Fixed Windows junction removal safety to prevent accidental recursive repository deletion.
  - Updated macOS PlayerDebugMode setting to flush `cfprefsd`.
  - Lazy-loaded MCP tool handlers to prevent CLI crashes when optional packages are missing.
  - Fixed direct-run script detection on paths with spaces using `realpathSync(argv[1])`.
  - Added clean shutdown handlers for SIGINT, SIGTERM, and stdin closure with child process termination and lock cleanup.
  - Single source of truth for version metadata read dynamically from `package.json`.
  - Timing-safe authentication token comparison using `crypto.timingSafeEqual`.
  - Restricted WebSocket upgrade origins to local CEP extension origins.
  - Fixed memory leak in preview frame caching via periodic timestamp cleanup.

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
