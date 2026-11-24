# SPDX-License-Identifier: GPL-3.0-or-later
"""
Headless Execution Dispatcher and CLI Runner for AE Bridge.
Invoked as: blender -b --factory-startup -P blender/runner.py -- <job.json>
Manages GPU preferences, scene assembly, progress logging, and JSON serialization.
"""

import os
import sys
import json
import traceback

# Add blender directory to sys.path for local module resolution
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

import bpy
from compat import check_version, setup_cycles_devices, get_eevee_engine_id
from scene import build_scene_from_spec
from render import configure_render_settings, render_scene_sequence
from export_camera import export_camera_and_objects


def main():
    version_info = check_version()
    args = sys.argv
    if "--" not in args:
        print("AEB_RESULT " + json.dumps({
            "ok": False,
            "error": "Missing job JSON file argument after '--'",
            "blenderVersion": version_info["version_string"]
        }), flush=True)
        return

    job_json_path = args[args.index("--") + 1]
    if not os.path.exists(job_json_path):
        print("AEB_RESULT " + json.dumps({
            "ok": False,
            "error": f"Job file not found at: {job_json_path}",
            "blenderVersion": version_info["version_string"]
        }), flush=True)
        return

    try:
        with open(job_json_path, "r", encoding="utf-8") as f:
            job = json.load(f)
    except Exception as e:
        print("AEB_RESULT " + json.dumps({
            "ok": False,
            "error": f"Failed to parse job JSON: {e}",
            "traceback": traceback.format_exc(),
            "blenderVersion": version_info["version_string"]
        }), flush=True)
        return

    action = job.get("action", "render")
    spec = job.get("spec", {})
    output_dir = job.get("outputDir", "./output").replace("\\", "/")
    os.makedirs(output_dir, exist_ok=True)

    try:
        if action == "status":
            # Quick probe
            hw = setup_cycles_devices(bpy.context.scene)
            result = {
                "ok": True,
                "blenderVersion": version_info["version_string"],
                "eeveeEngine": get_eevee_engine_id(),
                "hardware": hw
            }
            print("AEB_RESULT " + json.dumps(result), flush=True)
            return

        # 1. Build Scene
        scene_info = build_scene_from_spec(spec)

        if action == "save_blend":
            blend_path = job.get("blendPath") or os.path.join(output_dir, "scene.blend")
            blend_path = os.path.abspath(blend_path)
            os.makedirs(os.path.dirname(blend_path), exist_ok=True)
            bpy.ops.wm.save_as_mainfile(filepath=blend_path)
            print("AEB_RESULT " + json.dumps({
                "ok": True,
                "action": "save_blend",
                "blendPath": blend_path.replace("\\", "/"),
                "blenderVersion": version_info["version_string"]
            }), flush=True)
            return

        if action == "preview":
            # Single frame preview at 960px
            frame = int(job.get("frame", spec.get("frames", {}).get("start", 1)))
            preview_w = int(job.get("maxWidth", 960))
            orig_res = spec.get("resolution", [1920, 1080])
            aspect = orig_res[1] / float(orig_res[0])
            preview_h = int(preview_w * aspect)

            preview_file = os.path.join(output_dir, "preview.png").replace("\\", "/")
            scene = bpy.context.scene
            scene.render.engine = get_eevee_engine_id()
            scene.render.resolution_x = preview_w
            scene.render.resolution_y = preview_h
            scene.render.resolution_percentage = 100
            scene.render.film_transparent = True
            scene.render.image_settings.file_format = "PNG"
            scene.render.image_settings.color_mode = "RGBA"
            scene.render.filepath = preview_file

            scene.frame_set(frame)
            bpy.ops.render.render(write_still=True)

            print("AEB_RESULT " + json.dumps({
                "ok": True,
                "action": "preview",
                "previewPath": preview_file,
                "frame": frame,
                "resolution": [preview_w, preview_h],
                "blenderVersion": version_info["version_string"]
            }), flush=True)
            return

        # 2. Configure Full Render
        frames_spec = spec.get("frames", {})
        start_frame = int(frames_spec.get("start", 1))
        end_frame = int(frames_spec.get("end", 90))
        fps = int(frames_spec.get("fps", 30))
        res = spec.get("resolution", [1920, 1080])
        engine = spec.get("engine", "eevee")
        quality = spec.get("quality", "final")
        passes = spec.get("passes", [])

        render_info = configure_render_settings(
            engine=engine,
            quality=quality,
            resolution=res,
            fps=fps,
            start_frame=start_frame,
            end_frame=end_frame,
            passes=passes,
            output_dir=output_dir
        )

        # 3. Export Camera Tracking data if requested
        camera_json_path = None
        if spec.get("exportCamera", True):
            camera_json_path = os.path.join(output_dir, "camera.json").replace("\\", "/")
            tracked_names = [o.name for o in scene_info["objects"].values()]
            export_camera_and_objects(
                output_json_path=camera_json_path,
                start_frame=start_frame,
                end_frame=end_frame,
                comp_width=res[0],
                comp_height=res[1],
                object_names=tracked_names
            )

        # 4. Render Frame Sequence
        total_rendered = render_scene_sequence(start_frame=start_frame, end_frame=end_frame)

        print("AEB_RESULT " + json.dumps({
            "ok": True,
            "action": "render",
            "framesRendered": total_rendered,
            "outputDir": output_dir,
            "colorDir": render_info["colorPath"],
            "depthDir": os.path.join(output_dir, "depth").replace("\\", "/") if "depth" in passes else None,
            "cameraJson": camera_json_path,
            "hardware": render_info["hardware"],
            "engine": render_info["engine"],
            "blenderVersion": version_info["version_string"]
        }), flush=True)

    except Exception as ex:
        print("AEB_RESULT " + json.dumps({
            "ok": False,
            "error": str(ex),
            "traceback": traceback.format_exc(),
            "blenderVersion": version_info["version_string"]
        }), flush=True)


if __name__ == "__main__":
    main()
