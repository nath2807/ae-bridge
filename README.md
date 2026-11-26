# AE Bridge

> The Model Context Protocol (MCP) bridge connecting AI coding agents directly to Adobe After Effects for automated motion graphics, visual effects, and video production.

![AE Bridge Hero](docs/media/hero.gif)

AE Bridge turns AI assistants into professional motion design directors. Instead of pasting manual ExtendScript snippets, AI agents inspect live compositions, build multi-scene motion graphics, apply procedural particles and shaders, animate 3D typography, perform automated QA, critique visuals via contact sheets, and batch render deliverables across aspect ratios.

---

## Architecture

AE Bridge consists of a high-performance Node.js MCP server running over stdio that communicates with an authenticated Adobe CEP extension panel inside After Effects over an isolated local WebSocket connection (`127.0.0.1:8765`), with optional headless Blender 4.2+ / 5.x subprocess orchestration for photoreal 3D rendering.

```mermaid
flowchart TD
    subgraph Agent["AI Agent (Antigravity / Claude / Cursor / VS Code)"]
        LLM["AI Director / Motion Agent"]
    end

    subgraph Server["AE Bridge Server (Node.js 20+)"]
        MCP["MCP Server (stdio)"]
        Auth["Token Auth (~/.ae-bridge/token)"]
        Vision["Vision Pipeline (sharp)"]
        DesignEngine["Design Engine (Styles & Motion)"]
        Recipes["Recipe & Storyboard Engine"]
        BlenderJobs["Blender Job Queue & Async Runner"]
        WSClient["WebSocket Server (127.0.0.1:8765)"]
    end

    subgraph Host["Adobe After Effects (2024+)"]
        CEP["CEP Extension Panel (Chromium/Node)"]
        Dispatcher["ExtendScript Dispatcher (jsx)"]
        AE["After Effects Engine & Render Queue"]
    end

    subgraph BlenderEngine["Blender 4.2+ / 5.x (Headless 3D)"]
        BlenderRunner["blender/runner.py"]
        CyclesEEVEE["Cycles (OptiX/CUDA) / EEVEE Next"]
        Passes["RGBA Sequence + Z-Depth + camera.json"]
    end

    LLM <-->|Model Context Protocol| MCP
    MCP --> DesignEngine
    MCP --> Recipes
    MCP --> Vision
    MCP <--> WSClient
    MCP <-->|Subprocess Spawn| BlenderJobs
    BlenderJobs --> BlenderRunner
    BlenderRunner --> CyclesEEVEE
    CyclesEEVEE --> Passes
    Passes -->|ae_import_blender_render| Dispatcher
    WSClient <-->|Secure WebSocket (Token Handshake)| CEP
    CEP <-->|csInterface.evalScript| Dispatcher
    Dispatcher <-->|DOM & ExtendScript API| AE
```

---

## Core Capabilities

- **Photoreal Blender 3D Bridge (v1.2.0):** Headless Blender 4.2+ / 5.x integration with GPU acceleration (Cycles OptiX/CUDA & EEVEE Next), 14 PBR materials (chrome, gold, glass, carbon fiber, holographic thin film), studio cyclorama lighting, physics simulations (rigid bodies, shatter, cloth reveals), procedural Geometry Nodes, camera tracking sync (`camera.json`), and multi-pass Z-depth compositing in After Effects.
- **High-End Design Engine (v1.1.0):** 12 curated visual style packs (`minimalPremium`, `techFuturistic`, `darkLuxury`, `cinematicNoir`, etc.), named motion curves (`expoOut`, `snap`, `smooth`, `heavy`, `elasticOut`), layer stagger cascading, full broadcast finishing passes (`ae_finish_pass` with bloom, light wrap, film grain, halation, and chromatic aberration), reference image style extraction, and Art Director scored review.
- **Executive Director Layer:** Declarative multi-scene storyboards, 12 pre-built video production recipes (`youtubeIntro`, `productLaunch`, `hypePromo`, `socialAd15s`, etc.), brand kit persistence, and milestone checkpoints.
- **Visual Self-Review & Vision:** Live frame capture, multi-frame contact sheets composited with `sharp`, time-stamped visual progression inspection, and automated composition QA.
- **Motion Graphics & Typography:** Kinetic text presets, text animators, broadcast-quality lower thirds, 3D extruded typography, and animated counters.
- **3D Scenes & Lighting:** Advanced 3D renderer setup, camera rigs with orbital and dolly moves, point/spot/ambient lights, depth of field, and procedural 3D environments.
- **Particle & Shader Effects:** Procedural spark emitters, floating embers, cosmic stars, light sweeps, anamorphic flares, chromatic aberration, and glitch distortions.
- **Cinematic Color & Looks:** One-click film grain, vignette, bleach bypass, cinema bars, LUT application, and adjustment grades.
- **Editing & Timeline:** Multi-track footage assembly, slip editing, speed ramping, time remapping, and audio volume ducking.
- **Export & Social Distribution:** Smart auto-reframe for 9:16 vertical (Reels/TikTok/Shorts), 1:1 square, and 4:5 portrait formats; background rendering via Adobe Media Encoder (AME) or direct in-AE rendering with bitrate-aware template lookup (`AE Bridge H264 High`).

---

## System Requirements

- **Adobe After Effects:** 2024 or higher (v24.0+ / v25.0+ / v27.0+)
- **Node.js:** v20.0.0 or higher
- **Blender (Optional):** v4.2.0 or higher (supports 4.2, 5.0, 5.3+; required only for photoreal 3D rendering and physics simulations)
- **Operating System:** Windows 10/11, macOS 12+ (Apple Silicon or Intel), or Linux (Blender headless)
- **AI Client:** Antigravity, Claude Desktop, Cursor, VS Code (Cline / Roo Code), or any MCP-compliant client

---

## Blender 3D Configuration (Optional)

AE Bridge automatically searches standard installation locations across Windows, macOS, and Linux for Blender 4.2+ and 5.x.

To manually specify or override the Blender binary:
1. **Environment Variable:** Set `BLENDER_PATH` to the absolute path of `blender.exe` (Windows) or `blender` (macOS/Linux).
2. **Via MCP Tool:** Run `blender_set_path` with `{ "path": "<path-to-blender>" }` to persist it in `~/.ae-bridge/state.json`.
3. **Verify:** Run `blender_status` to inspect GPU hardware detection, active engine, and Poly Haven HDRI directory.

## Raw ExtendScript (Opt-in)

`ae_execute_extendscript` is disabled by default. Enable it only when needed by setting `AE_BRIDGE_ALLOW_RAW_SCRIPTS=true` in the MCP server environment. This permits arbitrary code execution inside After Effects; dedicated `ae_*` tools remain available without this setting.

---

## Quick Start (5 Steps)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/nath2807/ae-bridge.git
cd ae-bridge
npm --prefix server install
npm --prefix server run build
```

### 2. Install the CEP Panel
Run the cross-platform CLI installer to set debug flags and register the panel in After Effects:
```bash
# On Windows / macOS
node server/dist/cli.js install
```

### 3. Launch the Extension in After Effects
1. Restart Adobe After Effects.
2. Open **Window > Extensions > AE Bridge**.
3. The panel will display `Connected` as soon as the bridge server starts.

### 4. Verify System Health
Run diagnostics to ensure ports, registry keys, and image libraries are ready:
```bash
node server/dist/cli.js doctor
```

### 5. Configure Your MCP Client
Generate and copy your client's configuration:
```bash
node server/dist/cli.js config --client antigravity
```

---

## MCP Client Configuration

Add the AE Bridge server to your client's configuration file:

### Antigravity (`~/.gemini/antigravity/mcp_config.json`)
```json
{
  "mcpServers": {
    "ae-bridge": {
      "command": "node",
      "args": ["<path-to-ae-bridge>/server/dist/cli.js"]
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "ae-bridge": {
      "command": "node",
      "args": ["<path-to-ae-bridge>/server/dist/cli.js"]
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "ae-bridge": {
      "command": "node",
      "args": ["<path-to-ae-bridge>/server/dist/cli.js"]
    }
  }
}
```

### VS Code (`settings.json`)
```json
{
  "mcp": {
    "servers": {
      "ae-bridge": {
        "command": "node",
        "args": ["<path-to-ae-bridge>/server/dist/cli.js"]
      }
    }
  }
}
```

---

## 14 Example Prompts

1. **Brand Setup:**
   > "Set my brand kit: name 'Nova Labs', primary #00E5FF, secondary #FF148C, accent #D4AF37, background #05060A, text #F5F5F7, style 'tech'."
2. **Channel Opener (Recipe):**
   > "Run the youtubeIntro recipe for a channel called 'CODE & PIXELS' with tagline 'AUTOMATED MOTION'."
3. **Product Launch Intro:**
   > "Create a 10s dark futuristic comp for 'APEX X1'. Add 3D extruded metallic text, dramatic lighting, golden embers particles, and an anamorphic light sweep."
4. **End-to-End Director Workflow:**
   > "Act as director: make a 15-second promo video for our mobile app launch. Plan the storyboard first, build the scenes, run self-review, and export."
5. **Editing & Montage:**
   > "Import all clips from './footage', assemble a sequence with 3-second cuts, add cross dissolves, and color grade with the warmFilmic look."
6. **Title Presets & Typography:**
   > "In a 1920x1080 comp, add a title card 'DISRUPTION' using the dramaticRise preset, and add a lower third for 'Alex Rivera • Principal Architect'."
7. **Social Media Multi-Pack:**
   > "Adapt the 'Summer Campaign' comp into 9:16 vertical and 1:1 square social variants with smart reframing."
8. **Visual Self-Review:**
   > "Generate an 8-frame contact sheet of the master comp and run ae_qa_check to detect any spacing or pacing issues."
9. **Audio Ducking & Beat Sync:**
   > "Detect beats on the soundtrack layer, place comp markers on every beat, and add an animated bounce rig that scales to the rhythm."
10. **Automated Polish:**
    > "Review and polish composition 'Main Title': check visual hierarchy, add camera shake to the climax, and render an mp4High deliverable."
11. **Style + Finish Pass (v1.1):**
    > "Apply the darkLuxury style pack to comp 'Hero Title', stagger child text layers by 4 frames with center order, and apply a rich finishing pass with bloom, film grain, and halation."
12. **Reference Image Matching (v1.1):**
    > "Analyze the color palette and contrast of 'reference.png' with ae_analyze_reference, generate a custom style profile using ae_create_style_from_reference, and apply it to our product showcase comp."
13. **Photoreal 3D Title (v1.2):**
    > "Render a 2-second 3D title for 'NOVA X' in Blender using gold PBR material, studioDramatic lighting, orbit camera move, and import it into After Effects with camera tracking."
14. **3D Physics Simulation (v1.2):**
    > "Create a 3D dropAndBounce physics simulation with brushedAluminum spheres, export the Z-depth pass, and composite it into After Effects with ae_depth_effects optical lens blur."

---

## Known Limitations

- **After Effects Scripting Surface:** ExtendScript controls the native AE Object Model. Some legacy third-party plug-in modal dialogs cannot be dismissed via script.
- **In-AE Blocking Renders:** When rendering directly inside After Effects (`mode: "ae"`), the After Effects UI thread is blocked until rendering completes. For non-blocking export, use `mode: "ame"` with Adobe Media Encoder.
- **Fonts:** Text tools attempt to apply specified fonts; if a specific font family is not installed on the host machine, After Effects falls back to the system default sans-serif font.

---

## Documentation

- [Installation Guide (Windows & macOS)](docs/installation.md)
- [System Architecture](docs/architecture.md)
- [Blender 3D Bridge Guide](docs/blender.md)
- [Design Engine & Styles Guide](docs/styles.md)
- [Video Production Recipes](docs/recipes.md)
- [Storyboard Specification](docs/storyboard.md)
- [Complete Tools Reference (165 Tools)](docs/tools.md)
- [Troubleshooting & FAQ](docs/troubleshooting.md)
- [Contributing Tools](docs/contributing-tools.md)

---

## Roadmap

- [x] v1.0.0 Core bridge, 3D scenes, vision pipeline, director layer, recipes, and social multi-pack
- [x] v1.1.0 High-end design engine: style packs, motion language, finishing passes, reference matching, and Art Director review
- [x] v1.2.0 Blender 3D bridge: photoreal rendering, procedural assets, physics simulations, camera tracking, and depth compositing
- [ ] Direct mogrt parameter binding & spreadsheet autofill
- [ ] Real-time audio waveform peak visualizer
- [ ] GPU-accelerated frame streaming for conversational live review

---

## Contributing

We welcome community contributions! Please review [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before submitting pull requests.

---

## License & Disclaimer

The core AE Bridge repository, Node.js MCP server, tools, and CEP panel are licensed under the [MIT License](LICENSE).

The `/blender` directory contains Python modules that link directly with the Blender Python API (`bpy`) and is licensed under the **GNU General Public License v3.0 or later (GPL-3.0-or-later)** in accordance with Blender's licensing requirements. See [blender/LICENSE](blender/LICENSE) for details.

**Disclaimer:** This project is an independent open-source developer tool. It is not affiliated with, endorsed by, or sponsored by Adobe Inc. or the Blender Foundation. Adobe and After Effects are registered trademarks of Adobe Inc. Blender is a registered trademark of the Blender Foundation.
