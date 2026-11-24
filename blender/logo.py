# SPDX-License-Identifier: GPL-3.0-or-later
"""
SVG Vector Logo Import and 3D Extrusion Engine for Blender 4.2 / 5.x.
Imports vector paths, joins components, centers pivot, applies bevels, and coordinates reveal animations.
"""

import math
import os
import bpy
from compat import import_svg_file, get_action_fcurves
from materials import build_material
from camera import apply_fcurve_easing


def import_and_extrude_svg(
    svg_path,
    extrude=0.06,
    bevel_depth=0.015,
    target_scale=1.5,
    material_spec=None,
    reveal_style=None,
    start_frame=1,
    end_frame=60,
    curve="snap"
):
    """Imports an SVG vector asset, converts to extruded 3D geometry, centers, and animates."""
    if not svg_path or not os.path.exists(svg_path):
        raise FileNotFoundError(f"SVG file not found at: {svg_path}")

    # Track existing objects before import
    prior_objs = set(bpy.data.objects)

    # Import curves
    import_svg_file(svg_path)

    new_objs = [o for o in bpy.data.objects if o not in prior_objs and o.type == "CURVE"]
    if not new_objs:
        raise RuntimeError("No curve geometry imported from SVG file.")

    # Select all imported curves
    bpy.ops.object.select_all(action="DESELECT")
    for o in new_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new_objs[0]

    # Join curves into a single object if multiple curves exist
    if len(new_objs) > 1:
        bpy.ops.object.join()

    logo_obj = bpy.context.view_layer.objects.active
    logo_obj.name = "Hero_Logo"

    # Set extrusion and bevel on curve data
    curve_data = logo_obj.data
    curve_data.extrude = extrude
    curve_data.bevel_depth = bevel_depth
    curve_data.bevel_resolution = 3

    # Set origin to geometry center
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

    # Rotate upright (SVG imports flat on XY ground plane)
    logo_obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    # Normalize dimensions to target_scale
    max_dim = max(logo_obj.dimensions.x, logo_obj.dimensions.z, 0.001)
    s_factor = target_scale / max_dim
    logo_obj.scale = (s_factor, s_factor, s_factor)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Center at world origin
    logo_obj.location = (0, 0, target_scale / 2.0)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

    # Material assignment
    if material_spec:
        mat_name = material_spec.get("name", "Logo_Material")
        preset = material_spec.get("preset", "gold")
        col = material_spec.get("baseColor")
        rough = material_spec.get("roughness")
        mat = build_material(mat_name, preset=preset, base_color=col, roughness=rough)
        logo_obj.data.materials.clear()
        logo_obj.data.materials.append(mat)

    # Reveal animations
    if reveal_style:
        dur = max(1, end_frame - start_frame)
        final_loc = (logo_obj.location.x, logo_obj.location.y, logo_obj.location.z)

        if reveal_style == "spinSettle":
            # 360 spin with scale up and settle
            logo_obj.location = final_loc
            logo_obj.rotation_euler = (0, 0, math.radians(-360))
            logo_obj.scale = (0.01, 0.01, 0.01)
            logo_obj.keyframe_insert(data_path="rotation_euler", frame=start_frame)
            logo_obj.keyframe_insert(data_path="scale", frame=start_frame)

            logo_obj.rotation_euler = (0, 0, 0)
            logo_obj.scale = (1.0, 1.0, 1.0)
            logo_obj.keyframe_insert(data_path="rotation_euler", frame=end_frame)
            logo_obj.keyframe_insert(data_path="scale", frame=end_frame)

        elif reveal_style == "riseFromFloor":
            # Rising upward out of ground plane
            logo_obj.location = (final_loc[0], final_loc[1], -1.0)
            logo_obj.keyframe_insert(data_path="location", frame=start_frame)
            logo_obj.location = final_loc
            logo_obj.keyframe_insert(data_path="location", frame=end_frame)

        elif reveal_style == "lightSweep":
            # Subtle rotation drift while light sweeps
            logo_obj.rotation_euler = (0, math.radians(-15), 0)
            logo_obj.keyframe_insert(data_path="rotation_euler", frame=start_frame)
            logo_obj.rotation_euler = (0, math.radians(15), 0)
            logo_obj.keyframe_insert(data_path="rotation_euler", frame=end_frame)

        if logo_obj.animation_data and logo_obj.animation_data.action:
            for fc in get_action_fcurves(logo_obj.animation_data.action):
                apply_fcurve_easing(fc, curve)

    return logo_obj
