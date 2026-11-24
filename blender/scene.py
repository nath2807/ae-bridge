# SPDX-License-Identifier: GPL-3.0-or-later
"""
Master Scene Builder for Blender 4.2 / 5.x.
Parses SceneSpec definitions, clears defaults, sets metric units, and coordinates all submodules.
"""

import bpy
from materials import build_material
from lighting import setup_lighting
from camera import create_camera, apply_camera_move
from text3d import create_3d_text
from logo import import_and_extrude_svg
from objects import create_primitive, import_3d_model
from physics import create_physics_preset, bake_physics_simulation
from procedural import create_procedural_object
from motion import animate_object_transform


def clear_scene_completely():
    """Wipes out all objects, meshes, curves, materials, and worlds from the session."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for col in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.images):
        for item in list(col):
            try:
                col.remove(item, do_unlink=True)
            except Exception:
                pass


def build_scene_from_spec(spec):
    """Builds an entire 3D photoreal scene from a declarative SceneSpec dictionary."""
    clear_scene_completely()

    scene = bpy.context.scene
    # Set units to standard metric
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    frames_spec = spec.get("frames", {})
    start_frame = int(frames_spec.get("start", 1))
    end_frame = int(frames_spec.get("end", 90))
    fps = int(frames_spec.get("fps", 30))

    scene.frame_start = start_frame
    scene.frame_end = end_frame
    scene.render.fps = fps

    # 1. Lighting & World
    lighting_preset = spec.get("lighting", "studioDramatic")
    world_spec = spec.get("world", {})
    setup_lighting(preset=lighting_preset, world_spec=world_spec)

    # 2. Camera Setup
    cam_spec = spec.get("camera", {})
    lens = float(cam_spec.get("lens", 50.0))
    dof_spec = cam_spec.get("dof")
    cam_obj = create_camera(name="Hero_Camera", lens=lens, dof_params=dof_spec)

    cam_move = cam_spec.get("move", "pushIn")
    cam_curve = cam_spec.get("curve", "smooth")
    apply_camera_move(cam_obj, move=cam_move, start_frame=start_frame, end_frame=end_frame, curve=cam_curve)

    created_objects = {}

    # 3. Objects Construction
    objects_list = spec.get("objects", [])
    for obj_spec in objects_list:
        obj_id = obj_spec.get("id", "Obj")
        kind = obj_spec.get("kind", "primitive")
        params = obj_spec.get("params", {})
        mat_spec = obj_spec.get("material")

        built_obj = None

        if kind == "text":
            text_str = params.get("text", "AE BRIDGE")
            font_name = params.get("font")
            extrude = float(params.get("extrude", 0.08))
            bevel = float(params.get("bevel", 0.02))
            per_char = bool(params.get("perCharacter", False))
            objs = create_3d_text(
                text_string=text_str,
                font_name=font_name,
                extrude=extrude,
                bevel_depth=bevel,
                material_spec=mat_spec,
                per_character=per_char,
                start_frame=start_frame,
                end_frame=end_frame
            )
            built_obj = objs[0] if objs else None

        elif kind == "logosvg":
            svg_path = params.get("svgPath")
            extrude = float(params.get("extrude", 0.06))
            bevel = float(params.get("bevel", 0.015))
            reveal = params.get("style")
            built_obj = import_and_extrude_svg(
                svg_path=svg_path,
                extrude=extrude,
                bevel_depth=bevel,
                material_spec=mat_spec,
                reveal_style=reveal,
                start_frame=start_frame,
                end_frame=end_frame
            )

        elif kind in ("primitive", "floor"):
            p_kind = params.get("primitive", kind)
            p_size = float(params.get("size", 1.0))
            built_obj = create_primitive(
                kind=p_kind,
                name=obj_id,
                size=p_size,
                material_spec=mat_spec
            )

        elif kind == "model":
            m_path = params.get("modelPath")
            m_size = float(params.get("targetSize", 2.0))
            built_obj = import_3d_model(
                filepath=m_path,
                target_size=m_size,
                material_spec=mat_spec
            )

        elif kind == "procedural":
            proc_preset = params.get("preset", "cubeGridWave")
            built_obj = create_procedural_object(
                preset=proc_preset,
                name=obj_id,
                material_spec=mat_spec
            )

        if built_obj:
            built_obj.name = obj_id
            created_objects[obj_id] = built_obj

            # Apply Transform
            if "transform" in obj_spec:
                tf = obj_spec["transform"]
                if "location" in tf:
                    loc = tf["location"]
                    built_obj.location = (float(loc[0]), float(loc[1]), float(loc[2]))
                if "rotation" in tf:
                    rot = tf["rotation"]
                    import math
                    built_obj.rotation_euler = (
                        math.radians(float(rot[0])),
                        math.radians(float(rot[1])),
                        math.radians(float(rot[2])),
                    )
                if "scale" in tf:
                    sc = tf["scale"]
                    if isinstance(sc, (int, float)):
                        built_obj.scale = (float(sc), float(sc), float(sc))
                    elif isinstance(sc, (list, tuple)) and len(sc) >= 3:
                        built_obj.scale = (float(sc[0]), float(sc[1]), float(sc[2]))

            # Apply Animation
            if "animation" in obj_spec:
                kfs = obj_spec["animation"].get("keyframes", [])
                c_name = obj_spec["animation"].get("curve", "smooth")
                animate_object_transform(built_obj, kfs, curve=c_name)

    # 4. Physics Simulations
    physics_list = spec.get("physics", [])
    if physics_list:
        for p_item in physics_list:
            p_preset = p_item.get("preset", "dropAndBounce")
            p_target = created_objects.get(p_item.get("targetId"))
            p_mat = p_item.get("material")
            create_physics_preset(
                preset=p_preset,
                target_obj=p_target,
                material_spec=p_mat,
                start_frame=start_frame,
                end_frame=end_frame
            )
        bake_physics_simulation(start_frame=start_frame, end_frame=end_frame)

    return {
        "camera": cam_obj,
        "objects": created_objects,
        "frames": [start_frame, end_frame],
        "fps": fps
    }
