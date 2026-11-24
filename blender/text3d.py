# SPDX-License-Identifier: GPL-3.0-or-later
"""
3D Typography and Kinetic Letterform Generator for Blender 4.2 / 5.x.
Supports font family name resolution, bevel geometry, and per-character stagger animation.
"""

import math
import os
import bpy
from compat import get_action_fcurves
from materials import build_material
from camera import apply_fcurve_easing


def resolve_system_font(font_name=None):
    """Searches Windows, macOS, or Linux font directories for matching .ttf / .otf files."""
    if not font_name:
        return None

    # If already a valid file path
    if os.path.exists(font_name):
        return font_name

    search_dirs = []
    if os.name == "nt":
        win_fonts = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts")
        user_fonts = os.path.join(
            os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts"
        )
        search_dirs.extend([win_fonts, user_fonts])
    elif os.name == "posix":
        search_dirs.extend([
            "/System/Library/Fonts",
            "/Library/Fonts",
            os.path.expanduser("~/Library/Fonts"),
            "/usr/share/fonts",
            "/usr/local/share/fonts",
            os.path.expanduser("~/.local/share/fonts"),
        ])

    target = font_name.lower().replace(" ", "").replace("-", "")

    for s_dir in search_dirs:
        if not os.path.exists(s_dir):
            continue
        try:
            for root, _, files in os.walk(s_dir):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in (".ttf", ".otf"):
                        clean_f = f.lower().replace(" ", "").replace("-", "")
                        if target in clean_f:
                            return os.path.join(root, f)
        except Exception:
            continue

    return None


def create_3d_text(
    text_string,
    font_name=None,
    extrude=0.08,
    bevel_depth=0.02,
    bevel_resolution=4,
    size=1.0,
    material_spec=None,
    per_character=False,
    stagger_delay=3,
    start_frame=1,
    end_frame=60,
    curve="snap"
):
    """Generates 3D extruded typography with optional per-character kinetic animation."""
    font_path = resolve_system_font(font_name)
    loaded_font = None
    if font_path and os.path.exists(font_path):
        try:
            loaded_font = bpy.data.fonts.load(font_path)
        except Exception:
            loaded_font = None

    mat = None
    if material_spec:
        mat_name = material_spec.get("name", "Text_Material")
        preset = material_spec.get("preset", "chrome")
        col = material_spec.get("baseColor")
        rough = material_spec.get("roughness")
        mat = build_material(mat_name, preset=preset, base_color=col, roughness=rough)

    if not per_character:
        # Single consolidated 3D text object
        text_data = bpy.data.curves.new(name="Text_Curve", type="FONT")
        text_data.body = text_string
        text_data.size = size
        text_data.extrude = extrude
        text_data.bevel_depth = bevel_depth
        text_data.bevel_resolution = bevel_resolution
        text_data.align_x = "CENTER"
        text_data.align_y = "CENTER"
        if loaded_font:
            text_data.font = loaded_font

        text_obj = bpy.data.objects.new(name=f"Text_{text_string[:10]}", object_data=text_data)
        text_obj.location = (0, 0, 0)
        bpy.context.collection.objects.link(text_obj)

        if mat:
            text_obj.data.materials.append(mat)

        return [text_obj]

    else:
        # Separate individual characters with staggered cascade animation
        char_objs = []
        total_chars = len(text_string)
        # Approximate kerning width per letter
        letter_spacing = size * 0.75
        start_x = -((total_chars - 1) * letter_spacing) / 2.0

        for idx, char in enumerate(text_string):
            if char == " ":
                continue

            char_data = bpy.data.curves.new(name=f"Char_{char}_Curve", type="FONT")
            char_data.body = char
            char_data.size = size
            char_data.extrude = extrude
            char_data.bevel_depth = bevel_depth
            char_data.bevel_resolution = bevel_resolution
            char_data.align_x = "CENTER"
            char_data.align_y = "CENTER"
            if loaded_font:
                char_data.font = loaded_font

            char_obj = bpy.data.objects.new(name=f"Char_{idx}_{char}", object_data=char_data)
            final_x = start_x + (idx * letter_spacing)
            char_obj.location = (final_x, 0, 0)
            bpy.context.collection.objects.link(char_obj)

            if mat:
                char_obj.data.materials.append(mat)

            # Per-character arrival animation (drop from above with rotation)
            f_start = start_frame + (idx * stagger_delay)
            f_end = min(end_frame, f_start + 25)

            char_obj.location = (final_x, 0, 1.8)
            char_obj.rotation_euler = (math.radians(-45), 0, math.radians(20))
            char_obj.scale = (0.2, 0.2, 0.2)

            char_obj.keyframe_insert(data_path="location", frame=f_start)
            char_obj.keyframe_insert(data_path="rotation_euler", frame=f_start)
            char_obj.keyframe_insert(data_path="scale", frame=f_start)

            char_obj.location = (final_x, 0, 0)
            char_obj.rotation_euler = (0, 0, 0)
            char_obj.scale = (1.0, 1.0, 1.0)

            char_obj.keyframe_insert(data_path="location", frame=f_end)
            char_obj.keyframe_insert(data_path="rotation_euler", frame=f_end)
            char_obj.keyframe_insert(data_path="scale", frame=f_end)

            if char_obj.animation_data and char_obj.animation_data.action:
                for fc in get_action_fcurves(char_obj.animation_data.action):
                    apply_fcurve_easing(fc, curve)

            char_objs.append(char_obj)

        return char_objs
