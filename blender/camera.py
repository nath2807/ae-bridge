# SPDX-License-Identifier: GPL-3.0-or-later
"""
Cinematic Camera Rig and Trajectory Controller for Blender 4.2 / 5.x.
Creates physical cameras, depth of field optics, and procedural motion paths.
"""

import math
import bpy
from compat import get_action_fcurves


def apply_fcurve_easing(fcurve, curve_name="smooth"):
    """Configures keyframe handles on an F-Curve according to named animation curves."""
    if not fcurve or len(fcurve.keyframe_points) < 2:
        return

    c = curve_name.lower() if curve_name else "smooth"

    if c == "linear":
        for kf in fcurve.keyframe_points:
            kf.interpolation = "LINEAR"
        return

    # Default to BEZIER
    for kf in fcurve.keyframe_points:
        kf.interpolation = "BEZIER"
        kf.handle_left_type = "FREE"
        kf.handle_right_type = "FREE"

    kfs = fcurve.keyframe_points
    first_k = kfs[0]
    last_k = kfs[-1]
    dur = last_k.co[0] - first_k.co[0]
    val_diff = last_k.co[1] - first_k.co[1]

    if dur <= 0:
        return

    if c in ("expoout", "quintout", "snap"):
        # Fast initial velocity, long horizontal landing handle
        inf = 0.88 if c == "expoout" else (0.95 if c == "snap" else 0.78)
        first_k.handle_right[0] = first_k.co[0] + dur * 0.15
        first_k.handle_right[1] = first_k.co[1] + val_diff * 0.4
        last_k.handle_left[0] = last_k.co[0] - dur * inf
        last_k.handle_left[1] = last_k.co[1]

    elif c == "heavy":
        # Slow inertia departure, weighted landing
        first_k.handle_right[0] = first_k.co[0] + dur * 0.55
        first_k.handle_right[1] = first_k.co[1]
        last_k.handle_left[0] = last_k.co[0] - dur * 0.25
        last_k.handle_left[1] = last_k.co[1]

    elif c == "backout":
        # Overshoot landing handle
        first_k.handle_right[0] = first_k.co[0] + dur * 0.25
        first_k.handle_right[1] = first_k.co[1] + val_diff * 0.6
        last_k.handle_left[0] = last_k.co[0] - dur * 0.4
        last_k.handle_left[1] = last_k.co[1] + val_diff * 0.12 # Overshoot peak

    else:
        # Smooth / ease in out
        first_k.handle_right[0] = first_k.co[0] + dur * 0.4
        first_k.handle_right[1] = first_k.co[1]
        last_k.handle_left[0] = last_k.co[0] - dur * 0.4
        last_k.handle_left[1] = last_k.co[1]


def create_camera(name="Hero_Camera", lens=50.0, sensor_width=36.0, dof_params=None):
    """Instantiates a calibrated optical camera and sets it as active scene camera."""
    # Remove existing cameras
    for obj in list(bpy.data.objects):
        if obj.type == "CAMERA":
            bpy.data.objects.remove(obj, do_unlink=True)

    cam_data = bpy.data.cameras.new(name=name)
    cam_data.lens = float(lens)
    cam_data.sensor_width = float(sensor_width)
    cam_data.sensor_fit = "HORIZONTAL"

    # Depth of Field
    if dof_params:
        cam_data.dof.use_dof = True
        if "focus_distance" in dof_params:
            cam_data.dof.focus_distance = float(dof_params["focus_distance"])
        if "fstop" in dof_params:
            cam_data.dof.aperture_fstop = float(dof_params["fstop"])
        if "focus_object" in dof_params:
            target_obj = bpy.data.objects.get(dof_params["focus_object"])
            if target_obj:
                cam_data.dof.focus_object = target_obj

    cam_obj = bpy.data.objects.new(name=name, object_data=cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    return cam_obj


def apply_camera_move(cam_obj, move="pushIn", start_frame=1, end_frame=90, curve="smooth", target_loc=(0, 0, 0)):
    """Applies procedural cinematic trajectories to the camera."""
    move_type = move.lower() if move else "pushin"
    dur = max(1, end_frame - start_frame)

    cam_obj.animation_data_clear()

    # Track to target constraint if not freehand
    target_empty = bpy.data.objects.get("Camera_Target")
    if not target_empty:
        target_empty = bpy.data.objects.new("Camera_Target", None)
        target_empty.empty_display_type = "PLAIN_AXES"
        target_empty.location = target_loc
        bpy.context.collection.objects.link(target_empty)

    track_const = cam_obj.constraints.new(type="TRACK_TO")
    track_const.target = target_empty
    track_const.track_axis = "TRACK_NEGATIVE_Z"
    track_const.up_axis = "UP_Y"

    if move_type == "orbit":
        # 360 degree orbit around center
        radius = 4.5
        height = 1.8
        for f in range(start_frame, end_frame + 1, max(1, dur // 12)):
            t = (f - start_frame) / float(dur)
            angle = t * 2.0 * math.pi
            x = math.sin(angle) * radius
            y = -math.cos(angle) * radius
            cam_obj.location = (x, y, height)
            cam_obj.keyframe_insert(data_path="location", frame=f)

    elif move_type == "orbithalf":
        # 180 degree semi-orbit
        radius = 4.2
        height = 1.6
        for f in range(start_frame, end_frame + 1, max(1, dur // 8)):
            t = (f - start_frame) / float(dur)
            angle = -math.pi * 0.4 + t * math.pi * 0.8
            x = math.sin(angle) * radius
            y = -math.cos(angle) * radius
            cam_obj.location = (x, y, height)
            cam_obj.keyframe_insert(data_path="location", frame=f)

    elif move_type == "pushin":
        # Slow dramatic push in towards subject
        cam_obj.location = (0.0, -5.2, 1.4)
        cam_obj.keyframe_insert(data_path="location", frame=start_frame)
        cam_obj.location = (0.0, -2.8, 1.1)
        cam_obj.keyframe_insert(data_path="location", frame=end_frame)

    elif move_type == "pullout":
        # Reverse reveal pulling out
        cam_obj.location = (0.0, -2.4, 0.9)
        cam_obj.keyframe_insert(data_path="location", frame=start_frame)
        cam_obj.location = (0.0, -5.8, 1.8)
        cam_obj.keyframe_insert(data_path="location", frame=end_frame)

    elif move_type == "craneup":
        # Low pedestal rising up
        cam_obj.location = (0.8, -3.8, 0.2)
        cam_obj.keyframe_insert(data_path="location", frame=start_frame)
        cam_obj.location = (-0.4, -3.2, 3.2)
        cam_obj.keyframe_insert(data_path="location", frame=end_frame)

    elif move_type == "heroreveal":
        # Low dramatic rising angle with slight push
        cam_obj.location = (1.5, -3.5, -0.4)
        cam_obj.keyframe_insert(data_path="location", frame=start_frame)
        cam_obj.location = (0.0, -2.9, 0.9)
        cam_obj.keyframe_insert(data_path="location", frame=end_frame)

    elif move_type == "flythrough":
        # Sweeping fast transit through scene
        cam_obj.location = (-4.0, -4.5, 2.5)
        cam_obj.keyframe_insert(data_path="location", frame=start_frame)
        cam_obj.location = (3.5, 3.0, 1.2)
        cam_obj.keyframe_insert(data_path="location", frame=end_frame)

    elif move_type == "dollyzoom":
        # Vertigo zolly effect: camera pushes forward while lens widens
        cam_obj.location = (0.0, -6.0, 1.2)
        cam_obj.keyframe_insert(data_path="location", frame=start_frame)
        cam_obj.data.lens = 85.0
        cam_obj.data.keyframe_insert(data_path="lens", frame=start_frame)

        cam_obj.location = (0.0, -2.5, 1.2)
        cam_obj.keyframe_insert(data_path="location", frame=end_frame)
        cam_obj.data.lens = 28.0
        cam_obj.data.keyframe_insert(data_path="lens", frame=end_frame)

    elif move_type == "turntable":
        # Static camera position, rotates target object if available
        cam_obj.location = (0.0, -4.2, 1.2)
        cam_obj.keyframe_insert(data_path="location", frame=start_frame)

    else:
        # Default subtle drift
        cam_obj.location = (0.2, -4.2, 1.3)
        cam_obj.keyframe_insert(data_path="location", frame=start_frame)
        cam_obj.location = (-0.2, -3.8, 1.2)
        cam_obj.keyframe_insert(data_path="location", frame=end_frame)

    # Apply curve easing to all generated F-Curves
    if cam_obj.animation_data and cam_obj.animation_data.action:
        for fc in get_action_fcurves(cam_obj.animation_data.action):
            apply_fcurve_easing(fc, curve)
    if cam_obj.data.animation_data and cam_obj.data.animation_data.action:
        for fc in get_action_fcurves(cam_obj.data.animation_data.action):
            apply_fcurve_easing(fc, curve)
