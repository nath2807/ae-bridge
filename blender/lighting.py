# SPDX-License-Identifier: GPL-3.0-or-later
"""
Original Photoreal Studio Lighting Rig Generator for Blender 4.2 / 5.x.
Creates multi-point studio area light rigs, volumetric atmospheres, and HDRI image environments.
"""

import math
import os
import bpy


def clear_lights_and_world():
    """Removes existing lights and resets the world background."""
    for obj in list(bpy.data.objects):
        if obj.type == "LIGHT":
            bpy.data.objects.remove(obj, do_unlink=True)

    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("AEB_World")
        bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes.clear()
    return world


def create_light(name, light_type="AREA", location=(0, 0, 3), rotation=(0, 0, 0), energy=200, color=(1, 1, 1), size=1.5):
    """Creates a calibrated studio light with soft area falloff."""
    light_data = bpy.data.lights.new(name=name, type=light_type)
    light_data.energy = energy
    light_data.color = color[:3]

    if light_type == "AREA":
        light_data.shape = "RECTANGLE"
        light_data.size = size
        light_data.size_y = size * 0.75

    light_obj = bpy.data.objects.new(name=name, object_data=light_data)
    light_obj.location = location
    light_obj.rotation_euler = [math.radians(r) for r in rotation]
    bpy.context.collection.objects.link(light_obj)
    return light_obj


def setup_hdri_world(world, hdri_path, strength=1.0, rotation_z=0.0):
    """Sets up an image-based lighting environment from an HDR / EXR map."""
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    out_node = nodes.new(type="ShaderNodeOutputWorld")
    out_node.location = (400, 0)
    bg_node = nodes.new(type="ShaderNodeBackground")
    bg_node.location = (150, 0)
    bg_node.inputs["Strength"].default_value = strength
    links.new(bg_node.outputs["Background"], out_node.inputs["Surface"])

    if hdri_path and os.path.exists(hdri_path):
        env_node = nodes.new(type="ShaderNodeTexEnvironment")
        env_node.location = (-200, 0)
        try:
            env_node.image = bpy.data.images.load(hdri_path)
        except Exception:
            pass

        tex_coord = nodes.new(type="ShaderNodeTexCoord")
        tex_coord.location = (-600, 0)
        mapping = nodes.new(type="ShaderNodeMapping")
        mapping.location = (-400, 0)
        mapping.inputs["Rotation"].default_value[2] = math.radians(rotation_z)

        links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
        links.new(mapping.outputs["Vector"], env_node.inputs["Vector"])
        links.new(env_node.outputs["Color"], bg_node.inputs["Color"])
    else:
        bg_node.inputs["Color"].default_value = (0.02, 0.02, 0.03, 1.0)


def setup_lighting(preset="studioDramatic", world_spec=None):
    """Constructs a complete lighting environment based on the specified preset."""
    world = clear_lights_and_world()
    preset_lower = preset.lower() if preset else "studiodramatic"

    # HDRI / World Setup
    if world_spec and (world_spec.get("hdri") or world_spec.get("color")):
        hdri_path = world_spec.get("hdri")
        str_val = float(world_spec.get("strength", 1.0))
        rot_val = float(world_spec.get("rotation", 0.0))
        setup_hdri_world(world, hdri_path, strength=str_val, rotation_z=rot_val)
    else:
        # Default subtle studio ambient bounce
        nodes = world.node_tree.nodes
        links = world.node_tree.links
        out_node = nodes.new(type="ShaderNodeOutputWorld")
        out_node.location = (300, 0)
        bg_node = nodes.new(type="ShaderNodeBackground")
        bg_node.location = (100, 0)
        bg_node.inputs["Color"].default_value = (0.015, 0.018, 0.025, 1.0)
        bg_node.inputs["Strength"].default_value = 0.5
        links.new(bg_node.outputs["Background"], out_node.inputs["Surface"])

    # Presets
    if preset_lower == "studiosoft":
        # Broad 3-point soft commercial lighting
        create_light("Key_Light", "AREA", location=(2.5, -2.5, 3.2), rotation=(45, 0, 45), energy=350, size=2.5)
        create_light("Fill_Light", "AREA", location=(-3.0, -1.8, 2.0), rotation=(55, 0, -55), energy=120, size=3.0)
        create_light("Rim_Light", "AREA", location=(0.0, 3.2, 2.8), rotation=(-45, 0, 180), energy=250, size=2.0)

    elif preset_lower == "studiodramatic":
        # High-contrast chiseling key with sharp rim kicker
        create_light("Dramatic_Key", "AREA", location=(3.2, -2.0, 2.8), rotation=(40, 15, 55), energy=500, size=1.2)
        create_light("Rim_Kicker", "AREA", location=(-2.8, 2.5, 3.0), rotation=(-35, -20, -145), energy=650, color=(0.85, 0.9, 1.0), size=1.0)
        create_light("Subtle_Fill", "AREA", location=(-2.0, -2.5, 1.0), rotation=(70, 0, -40), energy=40, size=3.0)

    elif preset_lower == "rimneon":
        # Cyberpunk duel-rim electric cyan and hot magenta
        create_light("Rim_Cyan", "AREA", location=(-3.2, 2.8, 2.2), rotation=(-40, 0, -135), energy=600, color=(0.0, 0.95, 1.0), size=1.2)
        create_light("Rim_Magenta", "AREA", location=(3.2, 2.8, 2.2), rotation=(-40, 0, 135), energy=600, color=(1.0, 0.08, 0.55), size=1.2)
        create_light("Top_Soft_Key", "AREA", location=(0.0, -1.5, 3.5), rotation=(30, 0, 0), energy=100, color=(0.7, 0.8, 0.95), size=2.0)

    elif preset_lower == "sunset":
        # Warm golden directional sun with cool sky fill
        create_light("Sun_Warm", "SUN", location=(4.0, -4.0, 3.0), rotation=(48, 20, 45), energy=4.5, color=(1.0, 0.72, 0.38))
        create_light("Sky_Cool_Fill", "AREA", location=(-2.5, -2.0, 3.5), rotation=(55, 0, -50), energy=140, color=(0.4, 0.65, 0.95), size=3.5)

    elif preset_lower == "productwhite":
        # Clean Apple-style studio tabletop lighting
        create_light("Overhead_Softbox", "AREA", location=(0.0, 0.0, 3.8), rotation=(0, 0, 0), energy=450, size=3.5)
        create_light("Side_A", "AREA", location=(2.8, -1.5, 1.8), rotation=(60, 0, 60), energy=200, size=2.0)
        create_light("Side_B", "AREA", location=(-2.8, -1.5, 1.8), rotation=(60, 0, -60), energy=200, size=2.0)

    elif preset_lower == "darkluxury":
        # Deep shadows with grazing golden rim and dark void
        create_light("Gold_Rim_Left", "AREA", location=(-2.5, 2.5, 2.0), rotation=(-35, 0, -135), energy=450, color=(1.0, 0.82, 0.45), size=0.8)
        create_light("Gold_Rim_Right", "AREA", location=(2.5, 2.5, 2.0), rotation=(-35, 0, 135), energy=350, color=(1.0, 0.88, 0.6), size=0.8)
        create_light("Hero_Grazing_Spot", "SPOT", location=(1.2, -2.2, 3.2), rotation=(38, 10, 28), energy=300, color=(0.98, 0.95, 0.9))

    elif preset_lower == "volumetricbeams":
        # God-ray spot beams with atmospheric volume scatter
        create_light("Beam_Spot_1", "SPOT", location=(-2.5, -2.5, 4.5), rotation=(35, 15, -45), energy=1800, size=0.5)
        create_light("Beam_Spot_2", "SPOT", location=(2.5, -2.5, 4.5), rotation=(35, -15, 45), energy=1800, size=0.5)
        create_light("Floor_Bounce", "AREA", location=(0.0, -1.0, 0.5), rotation=(90, 0, 0), energy=80, size=4.0)

        # Add World Volume Scatter
        nodes = world.node_tree.nodes
        links = world.node_tree.links
        out_node = nodes.get("ShaderNodeOutputWorld") or nodes.new(type="ShaderNodeOutputWorld")
        vol_node = nodes.new(type="ShaderNodeVolumeScatter")
        vol_node.location = (150, -150)
        vol_node.inputs["Density"].default_value = 0.04
        vol_node.inputs["Anisotropy"].default_value = 0.65
        links.new(vol_node.outputs["Volume"], out_node.inputs["Volume"])

    else:
        # Standard balanced key
        create_light("Default_Key", "AREA", location=(2.0, -2.5, 3.0), rotation=(45, 0, 35), energy=350, size=2.0)
        create_light("Default_Fill", "AREA", location=(-2.5, -2.0, 2.0), rotation=(55, 0, -50), energy=120, size=2.5)
