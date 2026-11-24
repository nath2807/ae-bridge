# SPDX-License-Identifier: GPL-3.0-or-later
"""
Keyframe Transform and Stagger Animation Utilities for Blender 4.2 / 5.x.
Provides keyframe sequencing and cascading layer offsets.
"""

import math
import bpy
from camera import apply_fcurve_easing
from compat import get_action_fcurves


def animate_object_transform(
    obj,
    keyframes,
    curve="smooth"
):
    """Animates location, rotation, or scale across keyframe specifications.

    keyframes: [{ frame, location?, rotation?, scale? }]
    """
    if not obj or not keyframes:
        return

    for kf in keyframes:
        f = int(kf.get("frame", 1))

        if "location" in kf:
            loc = kf["location"]
            obj.location = (float(loc[0]), float(loc[1]), float(loc[2]))
            obj.keyframe_insert(data_path="location", frame=f)

        if "rotation" in kf:
            rot = kf["rotation"]
            obj.rotation_euler = (
                math.radians(float(rot[0])),
                math.radians(float(rot[1])),
                math.radians(float(rot[2])),
            )
            obj.keyframe_insert(data_path="rotation_euler", frame=f)

        if "scale" in kf:
            sc = kf["scale"]
            if isinstance(sc, (int, float)):
                obj.scale = (float(sc), float(sc), float(sc))
            elif isinstance(sc, (list, tuple)) and len(sc) >= 3:
                obj.scale = (float(sc[0]), float(sc[1]), float(sc[2]))
            obj.keyframe_insert(data_path="scale", frame=f)

    # Apply curve easing to all affected F-Curves
    if obj.animation_data and obj.animation_data.action:
        for fcurve in get_action_fcurves(obj.animation_data.action):
            apply_fcurve_easing(fcurve, curve)


def stagger_objects(
    objects,
    delay_frames=3,
    start_frame=1,
    order="forward"
):
    """Cascades existing animation actions on an array of objects by frame offsets."""
    if not objects:
        return

    count = len(objects)
    offsets = []

    if order == "reverse":
        for i in range(count):
            offsets.append((count - 1 - i) * delay_frames)
    elif order == "center":
        center_idx = (count - 1) / 2.0
        for i in range(count):
            offsets.append(int(abs(i - center_idx) * delay_frames))
    else:
        for i in range(count):
            offsets.append(i * delay_frames)

    for idx, obj in enumerate(objects):
        if not obj.animation_data or not obj.animation_data.action:
            continue
        shift = offsets[idx]
        if shift == 0:
            continue
        for fcurve in get_action_fcurves(obj.animation_data.action):
            for kp in fcurve.keyframe_points:
                kp.co[0] += shift
                kp.handle_left[0] += shift
                kp.handle_right[0] += shift
