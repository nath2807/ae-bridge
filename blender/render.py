# SPDX-License-Identifier: GPL-3.0-or-later
"""
Render Engine Setup and Multi-Pass Compositing Pipeline for Blender 4.2 / 5.x.
Configures Cycles / EEVEE Next, transparent alpha rendering, 16-bit PNG sequences,
and normalized Z-depth pass file output.
"""

import os
import sys
import bpy
from compat import get_eevee_engine_id, setup_color_management, setup_cycles_devices


def configure_render_settings(
    engine="eevee",
    quality="final",
    resolution=(1920, 1080),
    fps=30,
    start_frame=1,
    end_frame=90,
    passes=None,
    output_dir="./renders"
):
    """Configures the scene render engine, passes, resolution, and output file paths."""
    scene = bpy.context.scene
    passes = passes or []

    # 1. Resolution & Framerate
    scene.render.resolution_x = int(resolution[0])
    scene.render.resolution_y = int(resolution[1])
    scene.render.resolution_percentage = 100
    scene.render.fps = int(fps)
    scene.frame_start = int(start_frame)
    scene.frame_end = int(end_frame)

    # 2. Transparent background for AE compositing
    scene.render.film_transparent = True

    # 3. Color Management
    setup_color_management(scene, preferred="AgX")

    # 4. Engine Selection & Tuning
    engine_lower = engine.lower() if engine else "eevee"
    hw_info = {"device_type": "N/A", "device_name": "N/A"}

    if engine_lower == "cycles":
        scene.render.engine = "CYCLES"
        hw_info = setup_cycles_devices(scene)

        if quality == "preview":
            scene.cycles.samples = 24
            scene.cycles.use_denoising = True
        else:
            scene.cycles.samples = 128
            scene.cycles.use_denoising = True
            try:
                scene.cycles.denoiser = "OPENIMAGEDENOISE"
            except Exception:
                pass

        # Ray bounces
        scene.cycles.max_bounces = 8
        scene.cycles.diffuse_bounces = 4
        scene.cycles.glossy_bounces = 4
        scene.cycles.transmission_bounces = 8
        scene.cycles.transparent_max_bounces = 8

    else:
        # EEVEE / EEVEE Next
        eevee_id = get_eevee_engine_id()
        scene.render.engine = eevee_id

        # Modern EEVEE Next settings
        if hasattr(scene, "eevee"):
            eevee = scene.eevee
            if quality == "preview":
                if hasattr(eevee, "taa_render_samples"):
                    eevee.taa_render_samples = 16
            else:
                if hasattr(eevee, "taa_render_samples"):
                    eevee.taa_render_samples = 64
                if hasattr(eevee, "use_raytracing"):
                    eevee.use_raytracing = True

    # 5. Output Format: 16-bit RGBA PNG
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.compression = 15

    # Directory layout:
    # <output_dir>/color/frame_####.png
    # <output_dir>/depth/depth_####.png (if depth pass requested)
    color_dir = os.path.join(output_dir, "color").replace("\\", "/")
    os.makedirs(color_dir, exist_ok=True)
    scene.render.filepath = os.path.join(color_dir, "frame_").replace("\\", "/")

    # 6. Compositor Passes (Normalized Z-Depth)
    if "depth" in passes or "mist" in passes:
        try:
            view_layer = scene.view_layers[0]
            if hasattr(view_layer, "use_pass_z"):
                view_layer.use_pass_z = True

            if hasattr(scene, "node_tree") and scene.node_tree is not None:
                scene.use_nodes = True
                tree = scene.node_tree
                nodes = tree.nodes
                links = tree.links
                nodes.clear()

                # Render Layers input
                rl_node = nodes.new("CompositorNodeRLayers")
                rl_node.location = (0, 0)

                # Composite output for main color sequence
                comp_node = nodes.new("CompositorNodeComposite")
                comp_node.location = (600, 0)
                links.new(rl_node.outputs["Image"], comp_node.inputs["Image"])

                if "depth" in passes and "Depth" in rl_node.outputs:
                    depth_dir = os.path.join(output_dir, "depth").replace("\\", "/")
                    os.makedirs(depth_dir, exist_ok=True)

                    # Normalize depth: Map Range node to scale depth to 0.0 - 1.0
                    map_node = nodes.new("CompositorNodeMapRange")
                    map_node.location = (300, -250)
                    map_node.inputs["From Min"].default_value = 0.5
                    map_node.inputs["From Max"].default_value = 25.0
                    map_node.inputs["To Min"].default_value = 0.0
                    map_node.inputs["To Max"].default_value = 1.0
                    links.new(rl_node.outputs["Depth"], map_node.inputs["Value"])

                    # Separate File Output node for depth pass sequence
                    file_out = nodes.new("CompositorNodeOutputFile")
                    file_out.location = (600, -250)
                    file_out.base_path = depth_dir
                    file_out.format.file_format = "PNG"
                    file_out.format.color_mode = "BW"
                    file_out.format.color_depth = "16"
                    file_out.file_slots[0].path = "depth_"
                    links.new(map_node.outputs["Value"], file_out.inputs[0])
        except Exception as e_comp:
            print(f"[ae-bridge] Warning setting up compositor passes: {e_comp}", file=sys.stderr)

    return {
        "engine": scene.render.engine,
        "hardware": hw_info,
        "colorPath": color_dir,
        "resolution": [scene.render.resolution_x, scene.render.resolution_y],
        "fps": scene.render.fps,
        "frames": [scene.frame_start, scene.frame_end],
    }


def render_scene_sequence(start_frame=1, end_frame=90, on_progress=None):
    """Executes scene rendering frame-by-frame with progress reporting."""
    scene = bpy.context.scene
    total_frames = max(1, end_frame - start_frame + 1)
    rendered_frames = 0
    base_filepath = scene.render.filepath
    color_dir = os.path.dirname(base_filepath)

    for f in range(start_frame, end_frame + 1):
        scene.frame_set(f)
        scene.render.filepath = os.path.join(color_dir, f"frame_{f:04d}").replace("\\", "/")
        bpy.ops.render.render(write_still=True)
        rendered_frames += 1

        if on_progress:
            on_progress(rendered_frames, total_frames)
        else:
            print(f"AEB_PROGRESS {rendered_frames}/{total_frames}", flush=True)

    return rendered_frames
