---
name: blender-bridge
description: Comprehensive orchestration guide for headless 3D rendering with Blender and compositing in Adobe After Effects. Covers scene spec authoring, PBR materials, turntable camera animations, camera sync, depth pass compositing, and headless render troubleshooting.
---

# Blender Bridge: 3D Scene Orchestration & AE Compositing

Blender Bridge provides automated, headless 3D scene generation in Blender (4.2+) and seamless compositing into Adobe After Effects.

## 1. Prerequisites & Engine Detection

Blender Bridge requires:
1. Blender 4.2+ installed and accessible via `BLENDER_PATH` or system `PATH`.
2. GPU acceleration configured (OptiX, CUDA, Metal, or HIP).

Before launching renders:
- Inspect Blender installation and hardware: `blender_status`
- Validate scene specifications before submitting long renders: `blender_validate_spec`

---

## 2. Authoring Scene Specifications

A Blender scene is declared via a JSON `SceneSpec`.

### Key Elements of a SceneSpec:
- `engine`: `"CYCLES"` or `"BLENDER_EEVEE_NEXT"` (Blender 4.2+ uses EEVEE Next).
- `samples`: Render samples (e.g. 64 for preview, 256 for final).
- `denoiser`: `"OPENIMAGEDENOISE"` or `"OPTIX"` for artifact-free renders.
- `duration_frames` and `fps`: Match your After Effects composition (typically 30 fps).
- `models`: Primitive meshes, 3D text, or imported assets (.glb, .obj, .svg).
- `materials`: Principled BSDF PBR materials (base_color, metallic, roughness, emission).
- `lighting`: 3-point key/fill/rim lighting or HDRI environment maps.
- `camera`: Camera focal length, positioning, depth of field, and movement.
- `passes`: Set `depth: true` to generate a normalized Z-depth pass.

### Example: 360-Degree Turntable Product Showcase
```json
{
  "compName": "Blender_Turntable_Comp",
  "spec": {
    "fps": 30,
    "duration_frames": 150,
    "resolution": [1920, 1080],
    "engine": "CYCLES",
    "samples": 128,
    "denoiser": "OPENIMAGEDENOISE",
    "passes": { "depth": true },
    "models": [
      {
        "type": "cube",
        "name": "ProductBox",
        "position": [0, 0, 1],
        "scale": [1.5, 1.5, 1.5],
        "material": {
          "base_color": [0.1, 0.4, 0.9, 1.0],
          "metallic": 0.8,
          "roughness": 0.2
        }
      }
    ],
    "lighting": {
      "type": "three_point",
      "key_intensity": 1500,
      "fill_intensity": 600,
      "rim_intensity": 2000
    },
    "camera": {
      "movement": {
        "type": "turntable",
        "radius": 5.0,
        "height": 2.0,
        "target": [0, 0, 1]
      }
    }
  }
}
```

---

## 3. Pre-Flight Validation & Asynchronous Rendering

1. **Validate First:**
   ```json
   // Call blender_validate_spec
   { "spec": { ... } }
   ```
   Check `valid: true`. If `false`, address reported syntax and parameter errors.

2. **Submit Background Render Job:**
   ```json
   // Call blender_render_job_start
   {
     "spec": { ... },
     "outputPath": "C:/Projects/Renders/BlenderTurntable/frame_####.png"
   }
   ```
   Returns `jobId`.

3. **Monitor Progress:**
   ```json
   // Call blender_job_status
   { "jobId": "job-12345" }
   ```
   Tracks rendered frames and percentage completion.

---

## 4. Compositing in After Effects with Depth Pass & Camera Sync

Once the Blender render is finished, import and composite the footage into After Effects:

```json
// Call ae_import_blender_render
{
  "compName": "VFX_Compositing_Main",
  "folderPath": "C:/Projects/Renders/BlenderTurntable",
  "syncCamera": true,
  "depthPass": true
}
```

### What `ae_import_blender_render` Performs:
1. **Footage Import:** Imports beauty pass frame sequence into the AE project.
2. **3D Camera Sync:** Creates an AE 3D Camera layer matching Blender's exact focal length, position keyframes, and orientation vectors.
3. **Z-Depth Pass Setup:** Imports the normalized depth pass and links it to After Effects' `Camera Lens Blur` effect on the beauty pass layer for realistic optical bokeh and depth of field.

---

## 5. Troubleshooting Headless Blender Renders

- **EEVEE Engine Names:** In Blender 4.2+, EEVEE was rewritten as EEVEE Next. AE Bridge handles this automatically (`BLENDER_EEVEE_NEXT` vs `BLENDER_EEVEE`).
- **CPU-Only Fallback:** If Cycles GPU rendering encounters driver errors, verify GPU status with `blender_status`. Cycles will automatically fall back to CPU with multithreading.
- **Missing SVG Importer:** Blender 4.0+ moved SVG import into an extension. AE Bridge includes built-in curve geometry conversion.
