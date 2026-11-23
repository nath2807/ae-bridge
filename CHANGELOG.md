# Changelog

All notable changes to the AE Bridge project are documented in this file.

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
