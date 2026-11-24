# SPDX-License-Identifier: GPL-3.0-or-later
"""
Blender 4.2 / 5.x API Defensive Compatibility Layer.
Wraps engine identifiers, shader socket naming variations, color management,
hardware acceleration discovery, SVG import, and Geometry Nodes interfaces.
"""

import sys
import bpy


def check_version(min_version=(4, 2, 0)):
    """Verifies that Blender version meets minimum requirement (4.2+)."""
    current = bpy.app.version
    ver_str = bpy.app.version_string
    if current < min_version:
        min_str = ".".join(str(x) for x in min_version)
        raise RuntimeError(
            f"Blender version {ver_str} is below minimum supported version {min_str}."
        )
    return {
        "version": current,
        "version_string": ver_str,
        "major": current[0],
        "minor": current[1],
        "patch": current[2] if len(current) > 2 else 0,
    }


def get_eevee_engine_id():
    """Detects the correct EEVEE engine identifier in Blender 4.2 / 5.x.

    In Blender 4.2 EEVEE Next was named 'BLENDER_EEVEE_NEXT'.
    In Blender 5.x it is named 'BLENDER_EEVEE'.
    """
    try:
        enum_items = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
        ids = [item.identifier for item in enum_items]
        if "BLENDER_EEVEE" in ids:
            return "BLENDER_EEVEE"
        if "BLENDER_EEVEE_NEXT" in ids:
            return "BLENDER_EEVEE_NEXT"
        if ids:
            return ids[0]
    except Exception:
        pass
    return "BLENDER_EEVEE"


SOCKET_FALLBACKS = {
    "Base Color": ["Base Color", "Color"],
    "Specular IOR Level": ["Specular IOR Level", "Specular", "Specular Level"],
    "Emission Color": ["Emission Color", "Emission", "Emission Tint"],
    "Emission Strength": ["Emission Strength", "Emission"],
    "Transmission Weight": ["Transmission Weight", "Transmission"],
    "Coat Weight": ["Coat Weight", "Coat"],
    "Coat Roughness": ["Coat Roughness"],
    "Coat Tint": ["Coat Tint"],
    "Coat IOR": ["Coat IOR"],
    "Thin Film Thickness": ["Thin Film Thickness"],
    "Thin Film IOR": ["Thin Film IOR"],
    "Roughness": ["Roughness"],
    "Metallic": ["Metallic"],
    "IOR": ["IOR"],
    "Alpha": ["Alpha"],
}


def get_principled_bsdf_socket(node, socket_name):
    """Safely retrieves an input socket from a Principled BSDF node with fallbacks."""
    if not node or not hasattr(node, "inputs"):
        return None

    # 1. Direct lookup
    if socket_name in node.inputs:
        return node.inputs[socket_name]

    # 2. Lookup known synonym fallbacks
    fallbacks = SOCKET_FALLBACKS.get(socket_name, [])
    for fb in fallbacks:
        if fb in node.inputs:
            return node.inputs[fb]

    # 3. Case-insensitive lookup
    lower_target = socket_name.lower().replace(" ", "").replace("_", "")
    for inp in node.inputs:
        curr = inp.name.lower().replace(" ", "").replace("_", "")
        if curr == lower_target:
            return inp

    return None


def set_principled_socket_value(node, socket_name, value):
    """Sets socket value safely, skipping and logging if not available in current Blender build."""
    sock = get_principled_bsdf_socket(node, socket_name)
    if sock is None:
        return False
    try:
        sock.default_value = value
        return True
    except Exception as err:
        sys.stderr.write(f"[compat] Warning setting socket '{socket_name}': {err}\n")
        return False


def setup_color_management(scene, preferred="AgX"):
    """Configures modern OCIO color management with graceful fallbacks."""
    if not hasattr(scene, "view_settings"):
        return "Unknown"

    vs = scene.view_settings
    # Check available view transforms
    available = []
    try:
        if hasattr(vs, "bl_rna") and "view_transform" in vs.bl_rna.properties:
            enum_items = vs.bl_rna.properties["view_transform"].enum_items
            available = [e.identifier for e in enum_items]
    except Exception:
        pass

    candidates = [preferred, "AgX", "Filmic", "Standard"]
    for c in candidates:
        if not available or c in available:
            try:
                vs.view_transform = c
                return c
            except Exception:
                continue

    return getattr(vs, "view_transform", "Standard")


def setup_cycles_devices(scene):
    """Detects and activates optimal GPU compute device for Cycles in headless mode.

    Attempts OPTIX -> CUDA -> HIP -> ONEAPI -> METAL -> CPU.
    """
    cprefs = None
    try:
        addon = bpy.context.preferences.addons.get("cycles")
        if addon:
            cprefs = addon.preferences
    except Exception:
        cprefs = None

    if not cprefs:
        scene.cycles.device = "CPU"
        return {"device_type": "CPU", "device_name": "CPU Fallback"}

    # Refresh hardware device list
    if hasattr(cprefs, "refresh_devices"):
        try:
            cprefs.refresh_devices()
        except Exception:
            pass
    elif hasattr(cprefs, "get_devices"):
        try:
            cprefs.get_devices()
        except Exception:
            pass

    devices = getattr(cprefs, "devices", [])
    device_priorities = ["OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"]

    for d_type in device_priorities:
        matching = [d for d in devices if getattr(d, "type", "") == d_type]
        if matching:
            try:
                cprefs.compute_device_type = d_type
                # Enable only matching GPU devices
                for d in devices:
                    d.use = getattr(d, "type", "") == d_type
                scene.cycles.device = "GPU"
                chosen_name = matching[0].name
                return {
                    "device_type": d_type,
                    "device_name": chosen_name,
                    "count": len(matching),
                }
            except Exception as e:
                sys.stderr.write(f"[compat] Failed setting device type {d_type}: {e}\n")

    # Fallback to CPU
    try:
        cprefs.compute_device_type = "NONE"
        for d in devices:
            d.use = getattr(d, "type", "") == "CPU"
    except Exception:
        pass
    scene.cycles.device = "CPU"
    return {"device_type": "CPU", "device_name": "CPU"}


def import_svg_file(filepath):
    """Imports SVG vectors via either import_curve.svg or wm.svg_import."""
    if hasattr(bpy.ops.import_curve, "svg"):
        return bpy.ops.import_curve.svg(filepath=filepath)
    if hasattr(bpy.ops.wm, "svg_import"):
        return bpy.ops.wm.svg_import(filepath=filepath)
    raise RuntimeError("No SVG import operator found in this Blender build.")


def has_cell_fracture_operator():
    """Checks whether Cell Fracture operator is available."""
    return hasattr(bpy.ops.object, "add_fracture_cell_objects")


def get_action_fcurves(action):
    """Retrieves all F-Curves from an Action, supporting both legacy Actions (Blender 4.x)
    and new Layered Actions (Blender 5.0+ Slotted / Layered Action Architecture).
    """
    if not action:
        return []

    # 1. Legacy 4.x direct fcurves attribute
    if hasattr(action, "fcurves"):
        try:
            return list(action.fcurves)
        except Exception:
            pass

    # 2. Blender 5.x Layered Action Architecture
    fcurves = []
    if hasattr(action, "layers"):
        try:
            for layer in action.layers:
                if hasattr(layer, "strips"):
                    for strip in layer.strips:
                        if hasattr(strip, "channelbags"):
                            for cb in strip.channelbags:
                                if hasattr(cb, "fcurves"):
                                    fcurves.extend(list(cb.fcurves))
        except Exception:
            pass

    return fcurves


def create_geonodes_socket(node_group, name, in_out="INPUT", socket_type="NodeSocketFloat"):
    """Defines a Geometry Nodes socket using the 4.0+ interface API."""
    if hasattr(node_group, "interface"):
        return node_group.interface.new_socket(
            name=name, in_out=in_out, socket_type=socket_type
        )
    # Legacy fallback for older groups
    if in_out == "INPUT" and hasattr(node_group, "inputs"):
        return node_group.inputs.new(socket_type, name)
    elif in_out == "OUTPUT" and hasattr(node_group, "outputs"):
        return node_group.outputs.new(socket_type, name)
    return None
