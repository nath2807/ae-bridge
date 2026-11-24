# SPDX-License-Identifier: GPL-3.0-or-later
"""
Camera & Object Transform Export Pipeline for After Effects Bridge.
Captures per-frame camera matrices and object world coordinates, serializing to camera.json
for seamless 3D spatial alignment in After Effects compositions.
"""

import json
import math
import bpy


def export_camera_and_objects(
    output_json_path,
    start_frame=1,
    end_frame=90,
    comp_width=1920,
    comp_height=1080,
    scale_px_per_m=100.0,
    object_names=None
):
    """Bakes camera optics and object coordinates across frame ranges and exports JSON."""
    scene = bpy.context.scene
    cam_obj = scene.camera

    if not cam_obj:
        return None

    tracked_objs = []
    if object_names:
        for name in object_names:
            o = bpy.data.objects.get(name)
            if o and o != cam_obj:
                tracked_objs.append(o)

    data = {
        "metadata": {
            "startFrame": start_frame,
            "endFrame": end_frame,
            "fps": scene.render.fps,
            "compWidth": comp_width,
            "compHeight": comp_height,
            "scalePxPerM": scale_px_per_m,
            "blenderVersion": bpy.app.version_string,
        },
        "camera": {
            "name": cam_obj.name,
            "sensorWidth": cam_obj.data.sensor_width,
            "sensorHeight": cam_obj.data.sensor_height,
            "frames": {},
        },
        "objects": {},
    }

    for o in tracked_objs:
        data["objects"][o.name] = {"frames": {}}

    orig_frame = scene.frame_current

    try:
        for f in range(start_frame, end_frame + 1):
            scene.frame_set(f)
            bpy.context.view_layer.update()

            # Camera matrix evaluation
            cam_eval = cam_obj.evaluated_get(bpy.context.view_layer.depsgraph)
            mat = cam_eval.matrix_world
            loc = mat.to_translation()
            rot_euler = mat.to_euler("XYZ")

            lens = cam_eval.data.lens
            sensor_w = cam_eval.data.sensor_width

            # Convert Blender to After Effects coordinates:
            # Blender: +X Right, +Y Forward/Depth, +Z Up (meters)
            # After Effects: +X Right, +Y Down, +Z Forward into scene (pixels, origin at comp center)
            ae_cam_x = (comp_width / 2.0) + (loc.x * scale_px_per_m)
            ae_cam_y = (comp_height / 2.0) - (loc.z * scale_px_per_m)
            ae_cam_z = -(loc.y * scale_px_per_m)

            # AE Camera Zoom in pixels: (comp_width / sensor_width) * lens
            ae_zoom = (float(comp_width) / float(sensor_w)) * float(lens)

            # Forward viewing vector (-Z in Blender camera local space)
            forward_vec = mat.to_3x3() @ bpy.mathutils.Vector((0, 0, -1)) if hasattr(bpy, "mathutils") else (0, 1, 0)
            target_dist = 5.0 # meters forward
            poi_blender_x = loc.x + (forward_vec[0] * target_dist)
            poi_blender_y = loc.y + (forward_vec[1] * target_dist)
            poi_blender_z = loc.z + (forward_vec[2] * target_dist)

            ae_poi_x = (comp_width / 2.0) + (poi_blender_x * scale_px_per_m)
            ae_poi_y = (comp_height / 2.0) - (poi_blender_z * scale_px_per_m)
            ae_poi_z = -(poi_blender_y * scale_px_per_m)

            data["camera"]["frames"][str(f)] = {
                "blender": {
                    "position": [round(loc.x, 5), round(loc.y, 5), round(loc.z, 5)],
                    "rotationDeg": [
                        round(math.degrees(rot_euler.x), 3),
                        round(math.degrees(rot_euler.y), 3),
                        round(math.degrees(rot_euler.z), 3),
                    ],
                    "lens": round(lens, 2),
                },
                "afterEffects": {
                    "position": [round(ae_cam_x, 2), round(ae_cam_y, 2), round(ae_cam_z, 2)],
                    "pointOfInterest": [round(ae_poi_x, 2), round(ae_poi_y, 2), round(ae_poi_z, 2)],
                    "zoom": round(ae_zoom, 2),
                    "rotationX": round(math.degrees(rot_euler.x) - 90, 2),
                    "rotationY": round(-math.degrees(rot_euler.z), 2),
                    "rotationZ": round(math.degrees(rot_euler.y), 2),
                },
            }

            # Tracked scene objects
            for o in tracked_objs:
                o_eval = o.evaluated_get(bpy.context.view_layer.depsgraph)
                o_mat = o_eval.matrix_world
                o_loc = o_mat.to_translation()
                o_rot = o_mat.to_euler("XYZ")

                o_ae_x = (comp_width / 2.0) + (o_loc.x * scale_px_per_m)
                o_ae_y = (comp_height / 2.0) - (o_loc.z * scale_px_per_m)
                o_ae_z = -(o_loc.y * scale_px_per_m)

                data["objects"][o.name]["frames"][str(f)] = {
                    "blenderPosition": [round(o_loc.x, 5), round(o_loc.y, 5), round(o_loc.z, 5)],
                    "afterEffectsPosition": [round(o_ae_x, 2), round(o_ae_y, 2), round(o_ae_z, 2)],
                }

    finally:
        scene.frame_set(orig_frame)

    with open(output_json_path, "w", encoding="utf-8") as f_out:
        json.dump(data, f_out, indent=2)

    return data
