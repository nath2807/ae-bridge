# Blender 3D Bridge Guide

The **Blender Bridge** enables AI agents to generate photoreal 3D titles, animated vector logos, physics simulations, and procedural geometry in Blender (v4.2+ / 5.x) and composite them seamlessly into Adobe After Effects with full 3D camera tracking and depth-of-field effects.

> [!NOTE]
> The Python modules in `/blender` interact directly with Blender's `bpy` C-API and are licensed under the **GNU General Public License v3.0 or later (GPL-3.0-or-later)**. The Node.js MCP server, tools, and After Effects CEP panel remain under the permissive **MIT License**.

---

## 1. Setup & Configuration

### Supported Versions
- **Minimum Supported:** Blender 4.2 LTS
- **Recommended / Tested:** Blender 5.0, 5.3 LTS
- **Engines:** Cycles (OptiX, CUDA, HIP, oneAPI, Metal) and EEVEE Next (`BLENDER_EEVEE` / `BLENDER_EEVEE_NEXT`).

### Automatic Executable Discovery
AE Bridge automatically searches standard platform paths on startup:
- **Windows:** `C:/Program Files/Blender Foundation/Blender 5.3/blender.exe`, `Blender 5.*/`, `Blender 4.*/`, and local AppData.
- **macOS:** `/Applications/Blender.app/Contents/MacOS/Blender`, `~/Applications/Blender.app/`.
- **Linux:** `/usr/bin/blender`, `/usr/local/bin/blender`, `snap/bin/blender`.

### Manual Configuration
You can explicitly configure the binary location using either method:
1. **Environment Variable:**
   ```bash
   # Windows (PowerShell)
   $env:BLENDER_PATH = "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe"

   # macOS / Linux
   export BLENDER_PATH="/Applications/Blender.app/Contents/MacOS/Blender"
   ```
2. **Via MCP Tool:**
   Call `blender_set_path` with `{ "path": "<absolute-path-to-blender>" }`. The path is persisted in `~/.ae-bridge/state.json`.

### GPU Acceleration & Verification
Run the `blender_status` tool to verify your setup:
```json
{
  "installed": true,
  "executablePath": "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe",
  "hardware": {
    "device_type": "OPTIX",
    "device_name": "NVIDIA GeForce RTX 4050 Laptop GPU",
    "count": 1
  },
  "blenderVersion": "5.3.0",
  "hdriFolder": "~/.ae-bridge/hdri",
  "rendersFolder": "~/Videos/ae-bridge-renders/blender"
}
```

### Poly Haven CC0 HDRI Environment Maps
Fetch high-dynamic-range lighting maps using `blender_hdri_fetch`:
```json
{
  "name": "studio_small_08"
}
```
Popular built-in maps include `studio_small_08`, `aerodynamics_workshop`, `modern_buildings_2`, `dranger_suburb`, and `autumn_forest_01`. Downloaded HDRIs are cached in `~/.ae-bridge/hdri`.

---

## 2. Scene Specification (`SceneSpec`)

Blender jobs are driven by declarative JSON specifications:

```json
{
  "frames": { "start": 1, "end": 60, "fps": 30 },
  "resolution": [1920, 1080],
  "engine": "eevee",
  "quality": "final",
  "lighting": "studioDramatic",
  "objects": [
    {
      "id": "Hero_Title",
      "kind": "text",
      "params": {
        "text": "NOVA 3D",
        "extrude": 0.12,
        "bevel": 0.02,
        "perCharacter": true
      },
      "material": {
        "preset": "gold",
        "roughness": 0.15
      },
      "transform": {
        "location": [0, 0, 0]
      }
    }
  ],
  "camera": {
    "lens": 50.0,
    "sensorWidth": 36.0,
    "move": "orbit",
    "curve": "smooth"
  },
  "passes": ["depth"],
  "exportCamera": true
}
```

---

## 3. Presets Catalog

### 14 PBR Materials
| Preset | Description | Key Properties |
| :--- | :--- | :--- |
| `chrome` | Mirror-finish reflective metal | Metallic: 1.0, Roughness: 0.04 |
| `gold` | Rich 24k polished gold | Base: `#FFD700`, Metallic: 1.0, Roughness: 0.12 |
| `brushedAluminum` | Anisotropic machined metal | Metallic: 0.95, Roughness: 0.28, Anisotropic: 0.6 |
| `glass` | Pure dielectric refractive glass | Transmission: 1.0, IOR: 1.52, Roughness: 0.02 |
| `frostedGlass` | Translucent architectural glass | Transmission: 1.0, IOR: 1.48, Roughness: 0.35 |
| `glossyPlastic` | High-gloss polymer | Specular: 0.6, Roughness: 0.08 |
| `matteClay` | Soft studio clay | Diffuse, Roughness: 0.85 |
| `ceramic` | Smooth porcelain | Subsurface scattering, Clearcoat: 0.9 |
| `rubber` | Non-reflective industrial rubber | Base: `#18181B`, Roughness: 0.75 |
| `carbonFiber` | Twill-weave composite | Clearcoat: 0.8, Dual roughness layers |
| `holographic` | Iridescent thin film | Thin Film Thickness: 420nm, IOR: 1.33 |
| `neonEmission` | Vibrant glow emitter | Emission Strength: 8.0, Base color |
| `liquidMetal` | Fluid chrome Mercury look | Metallic: 1.0, Roughness: 0.01 |
| `marble` | Veined architectural stone | Subsurface radius, Procedural vein texture |

### 7 Studio Lighting Rigs
- **`studioSoft`**: Three-point softbox setup with large area diffusers (ideal for clean product showcases).
- **`studioDramatic`**: High-contrast rim-lit studio with deep shadows and specular kickers.
- **`rimNeon`**: Cyberpunk dual-tone edge lighting with cyan key and magenta rim.
- **`sunset`**: Warm golden hour directional sun (3200K) with cool ambient skylight.
- **`productWhite`**: Commercial packshot illumination with seamless white cyclorama.
- **`darkLuxury`**: Moody low-key setup with focused top spot and subtle gold bounce.
- **`volumetricBeams`**: Atmospheric spotlight beams through procedural scatter volume.

### 9 Physical Camera Moves
- `orbit`: Smooth 360° circular trajectory keeping target at center.
- `orbitHalf`: 180° semi-circular sweep with cinematic ease-out.
- `pushIn`: Forward dolly movement toward hero subject.
- `pullOut`: Backward dolly reveal establishing environment.
- `craneUp`: Ascending crane jib movement looking down.
- `flyThrough`: High-speed camera pass piercing through scene geometry.
- `turntable`: Stationary camera observing rotating stage.
- `heroReveal`: Low-angle ascending boom with tilt up.
- `dollyZoom`: Vertigo effect dynamically balancing focal length and distance.

### 5 Physics Presets
- `dropAndBounce`: Rigid-body gravity drop with bounciness and ground dampening.
- `shatter`: Voronoi cell fracture impact on collision.
- `clothReveal`: Silk/fabric draping and falling away from 3D logo or product.
- `windFlag`: Pinned cloth simulation driven by procedural turbulent wind field.
- `scatterFall`: Multiple objects cascading and settling onto floor.

### 4 Procedural Geometry Nodes
- `cubeGridWave`: Undulating matrix grid of rounded cubes with sinusoidal offset.
- `scatterOnSurface`: Weighted point scattering for organic debris or gems.
- `particleField`: 3D floating volume constellation with random drifting vectors.
- `rings`: Concentric orbital gyro rings rotating on alternating axes.

---

## 4. After Effects Import & Compositing

### Sequence Import & Camera Tracking
When a render job finishes, call `ae_import_blender_render`:
```json
{
  "jobId": "job_1795497655548_t1qzj6m",
  "compRef": { "compName": "Master Comp" },
  "syncCamera": true,
  "addDepthPass": true
}
```

This ExtendScript handler automatically:
1. Imports the 16-bit RGBA PNG image sequence with alpha transparency (`color/frame_####.png`).
2. Conforms footage frame rate to match composition fps.
3. Parses `camera.json` and creates a matching 3D **`Blender Camera`** with baked position, rotation, and focal length zoom keyframes.
4. Generates 3D null tracking anchors for each tracked 3D object (e.g. `Blender_Title_Text`).

### Z-Depth Optical Effects (`ae_depth_effects`)
Apply depth of field or atmospheric perspective using the normalized depth pass:
```json
{
  "compRef": { "compName": "Master Comp" },
  "depthLayerRef": { "layerName": "Blender Depth Pass" },
  "effects": ["dof", "fog"],
  "dofRadius": 18,
  "fogColor": "#05060A"
}
```

---

## 5. Troubleshooting & FAQ

### 1. CPU-Only Rendering
- **Symptom:** Renders take longer than expected; `blender_status` reports `device_type: "CPU"`.
- **Fix:** In Blender GUI, open **Edit > Preferences > System > Cycles Render Devices**. Ensure **OptiX** (NVIDIA RTX) or **CUDA** is checked, and select your GPU. AE Bridge activates OptiX/CUDA automatically, but your GPU driver must be up to date.

### 2. Missing Frames / Still Overwrite
- **Symptom:** Only a single `frame_.png` exists in the output folder.
- **Fix:** In Blender headless rendering, `render_scene_sequence()` must format filenames explicitly per frame (`frame_0001.png`, `frame_0002.png`). AE Bridge v1.2.0 formats 4-digit padded frame sequences automatically.

### 3. EEVEE Engine Identifier Errors
- **Symptom:** `ValueError: enum "BLENDER_EEVEE_NEXT" not found in ('BLENDER_EEVEE', ...)`.
- **Fix:** Blender 5.x renamed EEVEE Next back to `'BLENDER_EEVEE'`. `blender/compat.py` dynamically queries `bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items` and selects the correct identifier for your installed Blender version.

### 4. SVG Vector Logo Import Fails
- **Symptom:** `AttributeError: '_RestrictedContext' object has no attribute 'svg_import'` or missing operator.
- **Fix:** In Blender 5.x, SVG import has transitioned to modular extensions. `compat.import_svg_file()` handles both `bpy.ops.import_curve.svg` and `bpy.ops.wm.svg_import` with fallback curve generation.
