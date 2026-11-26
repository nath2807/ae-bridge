---
name: ae-bridge
description: Comprehensive automation guide for Adobe After Effects via the AE Bridge MCP server. Covers connection diagnostics, tool selection, standard production pipelines (comp -> layers -> animation curves -> finish pass -> vision QA -> render), profile management, atomic batch execution (ae_batch), and ExtendScript error recovery.
---

# AE Bridge: After Effects Automation Skill

AE Bridge connects AI agents directly to Adobe After Effects over a high-performance, authenticated loopback WebSocket.

## 1. Pre-Flight Connection Check

Before performing any mutating operations or creating comps, **always check the bridge connection**:

```json
// Call ae_bridge_status
{}
```

Ensure `connected: true`. If `connected: false`:
1. Verify that Adobe After Effects is running.
2. Confirm that the **AE Bridge** panel (`Window > Extensions > AE Bridge`) is open.
3. If still disconnected, run `ae-bridge doctor` or inspect `$AE_BRIDGE_HOME/logs/bridge.log`.

---

## 2. Tool Profiles & Environment Selection

AE Bridge v1.3.0 supports dynamic tool profiles via the `AE_BRIDGE_PROFILE` environment variable:
- `minimal` (~24 tools): Core comps, layers, text, basic transforms, and render. Ideal for lightweight context windows.
- `standard` (~85 tools, default): Full layer generation, motion curves, styles, finish pass, audio, and render.
- `blender` (~38 tools): Dedicated 3D scene authoring, Blender rendering, and AE camera sync.
- `full` (185 tools): Complete access including computer vision metrics, scene graph serialization, MOGRT data replacement, and kinetic typography.

To search for tools in runtime:
```json
// Call ae_search_tools
{ "query": "curve" }
```

---

## 3. The Standard Production Pipeline

Follow this 7-step pipeline when authoring motion graphics from scratch:

```
[1. Project & Comp] -> [2. Layers & Assets] -> [3. Animation & Curves] -> [4. Style & Finish]
        -> [5. Scene Graph] -> [6. Vision QA Check] -> [7. Non-Blocking Render]
```

### Step 1: Project & Composition Setup
- Inspect project: `ae_get_project_info`
- Create composition:
  ```json
  // Call ae_create_comp
  {
    "compName": "TitleSequence_Main",
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "duration": 5.0
  }
  ```

### Step 2: Layer Construction
- Background: `ae_add_solid` with deep cinematic or brand hex color.
- Typography: `ae_add_text` with font family, size, color, and tracking.
- Vector & Accents: `ae_create_shape` or `ae_import_file`.

### Step 3: Animation & Kinetic Motion Curves
- Set keyframes: `ae_set_keyframe` on Position, Scale, or Opacity.
- Apply natural motion curves: **never leave default linear interpolation**.
  - `snappy`: Fast explosive burst with smooth ease-out.
  - `smooth`: Symmetrical broadcast ease.
  - `bounce`: Elastic organic rebound.
- Stagger multi-element entrances: `ae_stagger_layers`.

### Step 4: Styling & Finish Pass
- Apply cohesive palettes: `ae_apply_style` (e.g. `tech-cyber`, `warm-editorial`, `bold-hyper`).
- Enhance depth and filmic quality:
  ```json
  // Call ae_finish_pass
  {
    "compName": "TitleSequence_Main",
    "recipe": "rich"
  }
  ```

### Step 5: Declarative Scene Graph Interchange
- To inspect or snapshot the entire comp hierarchy:
  ```json
  // Call ae_export_scene_graph
  { "compName": "TitleSequence_Main" }
  ```
- To duplicate or reproduce comps programmatically: `ae_apply_scene_graph`.

### Step 6: Optical Quality Assurance & Vision Metrics
- Run automated QA audit:
  ```json
  // Call ae_qa_check
  {
    "compName": "TitleSequence_Main",
    "includePreview": true
  }
  ```
- Quantify optical metrics (mean luminance, RMS contrast, blur score, clipping):
  ```json
  // Call ae_measure_comp
  {
    "compName": "TitleSequence_Main",
    "sampleCount": 5
  }
  ```

### Step 7: Non-Blocking Background Render
- For compositions longer than 5 seconds or with heavy 3D passes, use non-blocking background rendering:
  ```json
  // Call ae_render_job_start
  {
    "compName": "TitleSequence_Main",
    "outputPath": "C:/Projects/Renders/Title_Main.mp4",
    "preset": "mp4High"
  }
  ```
- Poll render progress asynchronously: `ae_render_job_status`.

---

## 4. Atomic Execution with `ae_batch`

When executing multiple operations, bundle them into a single `ae_batch` call. This executes all commands in a single network round-trip and wraps them inside an atomic ExtendScript undo group:

```json
// Call ae_batch
{
  "calls": [
    { "tool": "ae_create_comp", "params": { "compName": "BatchComp", "duration": 5 } },
    { "tool": "ae_add_solid", "params": { "compName": "BatchComp", "name": "BG", "color": [0.05, 0.05, 0.08] } },
    { "tool": "ae_add_text", "params": { "compName": "BatchComp", "text": "AE BRIDGE v1.3", "fontSize": 72 } }
  ]
}
```

---

## 5. ExtendScript Pitfalls & Error Recovery

1. **1-Based Indexing:** In After Effects ExtendScript, comp layers and item collections are 1-based (Layer 1 is index 1, not 0).
2. **Property Name Navigation:** Never guess property paths or effect parameter names. Call `ae_describe_property_tree` to recursively inspect the property hierarchy of any layer or effect.
3. **Modal Dialogs:** If After Effects has an open modal dialog (e.g. preferences, save prompt), WebSocket calls will time out. Ensure AE is idle.
4. **Undo Cleanliness:** Use `ae_undo` (`app.executeCommand(16)`) if an unhandled mutation needs clean rollback.
