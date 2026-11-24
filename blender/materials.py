# SPDX-License-Identifier: GPL-3.0-or-later
"""
Original PBR Material Library for Blender 4.2 / 5.x.
Provides production-quality procedural materials and shaders on Principled BSDF.
"""

import bpy
from compat import set_principled_socket_value, get_principled_bsdf_socket


def create_or_get_material(name):
    """Creates a fresh node-enabled material or clears an existing one."""
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    return mat


def build_material(name, preset="chrome", base_color=None, roughness=None, emission_strength=None, custom_params=None):
    """Constructs a complete PBR material from preset specifications."""
    mat = create_or_get_material(name)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Standard Output
    output_node = nodes.new(type="ShaderNodeOutputMaterial")
    output_node.location = (400, 0)

    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    links.new(bsdf.outputs["BSDF"], output_node.inputs["Surface"])

    preset_lower = preset.lower() if preset else "chrome"

    # Default color parsing (RGB or RGBA)
    col = [0.9, 0.9, 0.92, 1.0]
    if base_color:
        if isinstance(base_color, (list, tuple)):
            if len(base_color) == 3:
                col = [float(base_color[0]), float(base_color[1]), float(base_color[2]), 1.0]
            elif len(base_color) >= 4:
                col = [float(base_color[0]), float(base_color[1]), float(base_color[2]), float(base_color[3])]
        elif isinstance(base_color, str) and base_color.startswith("#"):
            hex_str = base_color.lstrip("#")
            if len(hex_str) == 6:
                r = int(hex_str[0:2], 16) / 255.0
                g = int(hex_str[2:4], 16) / 255.0
                b = int(hex_str[4:6], 16) / 255.0
                col = [r, g, b, 1.0]

    # Preset Configurations
    if preset_lower == "chrome":
        set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.95, 0.95, 0.97, 1.0])
        set_principled_socket_value(bsdf, "Metallic", 1.0)
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.04)
        set_principled_socket_value(bsdf, "IOR", 2.5)

    elif preset_lower == "gold":
        gold_col = col if base_color else [1.0, 0.766, 0.336, 1.0]
        set_principled_socket_value(bsdf, "Base Color", gold_col)
        set_principled_socket_value(bsdf, "Metallic", 1.0)
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.08)
        set_principled_socket_value(bsdf, "IOR", 1.35)

    elif preset_lower == "brushedaluminum":
        set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.88, 0.89, 0.91, 1.0])
        set_principled_socket_value(bsdf, "Metallic", 0.95)
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.28)
        set_principled_socket_value(bsdf, "Anisotropic", 0.75)
        set_principled_socket_value(bsdf, "Anisotropic Rotation", 0.25)

    elif preset_lower == "glass":
        set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.98, 0.99, 1.0, 1.0])
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.02)
        set_principled_socket_value(bsdf, "Transmission Weight", 1.0)
        set_principled_socket_value(bsdf, "IOR", 1.52)

    elif preset_lower == "frostedglass":
        set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.95, 0.97, 1.0, 1.0])
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.35)
        set_principled_socket_value(bsdf, "Transmission Weight", 1.0)
        set_principled_socket_value(bsdf, "IOR", 1.48)

    elif preset_lower == "glossyplastic":
        set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.1, 0.45, 0.95, 1.0])
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.12)
        set_principled_socket_value(bsdf, "Specular IOR Level", 0.5)
        set_principled_socket_value(bsdf, "Coat Weight", 0.6)
        set_principled_socket_value(bsdf, "Coat Roughness", 0.03)

    elif preset_lower == "matteclay":
        set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.82, 0.78, 0.74, 1.0])
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.88)
        set_principled_socket_value(bsdf, "Subsurface Weight", 0.15)
        set_principled_socket_value(bsdf, "Subsurface Radius", [0.8, 0.5, 0.3])

    elif preset_lower == "ceramic":
        set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.96, 0.96, 0.98, 1.0])
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.08)
        set_principled_socket_value(bsdf, "Coat Weight", 1.0)
        set_principled_socket_value(bsdf, "Coat Roughness", 0.02)
        set_principled_socket_value(bsdf, "Coat IOR", 1.6)

    elif preset_lower == "rubber":
        set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.08, 0.08, 0.09, 1.0])
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.75)
        set_principled_socket_value(bsdf, "Specular IOR Level", 0.2)

    elif preset_lower == "carbonfiber":
        # Procedural weave texture
        tex_coord = nodes.new(type="ShaderNodeTexCoord")
        tex_coord.location = (-800, 0)
        wave_u = nodes.new(type="ShaderNodeTexWave")
        wave_u.location = (-600, 100)
        wave_u.inputs["Scale"].default_value = 45.0
        wave_v = nodes.new(type="ShaderNodeTexWave")
        wave_v.location = (-600, -150)
        wave_v.wave_type = "BANDS"
        wave_v.bands_direction = "Y"
        wave_v.inputs["Scale"].default_value = 45.0
        mix = nodes.new(type="ShaderNodeMix")
        mix.location = (-350, 0)
        mix.data_type = "RGBA"
        mix.inputs["Factor"].default_value = 0.5
        links.new(tex_coord.outputs["Generated"], wave_u.inputs["Vector"])
        links.new(tex_coord.outputs["Generated"], wave_v.inputs["Vector"])
        links.new(wave_u.outputs["Color"], mix.inputs[6])
        links.new(wave_v.outputs["Color"], mix.inputs[7])

        # Dark composite weave
        dark_fiber = col if base_color else [0.03, 0.03, 0.04, 1.0]
        set_principled_socket_value(bsdf, "Base Color", dark_fiber)
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.35)
        set_principled_socket_value(bsdf, "Coat Weight", 0.9)
        set_principled_socket_value(bsdf, "Coat Roughness", 0.05)
        links.new(mix.outputs[2], bsdf.inputs["Roughness"])

    elif preset_lower == "holographic":
        # Iridescent thin film or procedural color ramp
        has_thin_film = set_principled_socket_value(bsdf, "Thin Film Thickness", 450.0)
        if has_thin_film:
            set_principled_socket_value(bsdf, "Thin Film IOR", 1.45)
            set_principled_socket_value(bsdf, "Metallic", 0.8)
            set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.06)
            set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.95, 0.95, 0.98, 1.0])
        else:
            # Fallback to layer weight / color ramp fresnel
            lw = nodes.new(type="ShaderNodeLayerWeight")
            lw.location = (-400, 100)
            lw.inputs["Blend"].default_value = 0.6
            ramp = nodes.new(type="ShaderNodeValToRGB")
            ramp.location = (-200, 100)
            ramp.color_ramp.elements[0].color = (0.2, 0.8, 1.0, 1.0)
            ramp.color_ramp.elements[1].color = (0.9, 0.1, 0.8, 1.0)
            ramp.color_ramp.elements.new(0.5).color = (0.95, 0.9, 0.2, 1.0)
            links.new(lw.outputs["Facing"], ramp.inputs["Fac"])
            links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
            set_principled_socket_value(bsdf, "Metallic", 0.9)
            set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.08)

    elif preset_lower == "neonemission":
        glow_col = col if base_color else [0.0, 0.94, 1.0, 1.0]
        set_principled_socket_value(bsdf, "Base Color", glow_col)
        set_principled_socket_value(bsdf, "Emission Color", glow_col)
        strength = emission_strength if emission_strength is not None else 8.0
        set_principled_socket_value(bsdf, "Emission Strength", strength)
        set_principled_socket_value(bsdf, "Roughness", 0.1)

    elif preset_lower == "liquidmetal":
        set_principled_socket_value(bsdf, "Base Color", col if base_color else [0.92, 0.93, 0.96, 1.0])
        set_principled_socket_value(bsdf, "Metallic", 1.0)
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.02)
        set_principled_socket_value(bsdf, "Coat Weight", 0.8)
        set_principled_socket_value(bsdf, "Coat Roughness", 0.01)

    elif preset_lower == "marble":
        # Procedural vein noise
        tex_coord = nodes.new(type="ShaderNodeTexCoord")
        tex_coord.location = (-700, 0)
        noise = nodes.new(type="ShaderNodeTexNoise")
        noise.location = (-500, 0)
        noise.inputs["Scale"].default_value = 3.5
        noise.inputs["Detail"].default_value = 8.0
        noise.inputs["Roughness"].default_value = 0.65
        ramp = nodes.new(type="ShaderNodeValToRGB")
        ramp.location = (-250, 0)
        ramp.color_ramp.elements[0].position = 0.4
        ramp.color_ramp.elements[0].color = (0.1, 0.12, 0.15, 1.0) # Dark vein
        ramp.color_ramp.elements[1].position = 0.6
        ramp.color_ramp.elements[1].color = (0.95, 0.95, 0.98, 1.0) # White marble
        links.new(tex_coord.outputs["Generated"], noise.inputs["Vector"])
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.15)
        set_principled_socket_value(bsdf, "Subsurface Weight", 0.12)
        set_principled_socket_value(bsdf, "Subsurface Radius", [0.9, 0.85, 0.8])
        set_principled_socket_value(bsdf, "Coat Weight", 0.5)

    else:
        # Default fallback
        set_principled_socket_value(bsdf, "Base Color", col)
        set_principled_socket_value(bsdf, "Roughness", roughness if roughness is not None else 0.3)

    return mat
