# SPDX-License-Identifier: GPL-3.0-or-later
"""
Procedural Geometry Nodes Modifier Generator for Blender 4.2 / 5.x.
Builds parametric node networks using modern 4.0+ interface API.
"""

import math
import bpy
from compat import create_geonodes_socket
from materials import build_material


def create_procedural_object(preset="cubeGridWave", name=None, material_spec=None):
    """Instantiates an empty mesh and constructs a Geometry Nodes procedural modifier."""
    preset_lower = preset.lower() if preset else "cubegridwave"
    obj_name = name or f"Procedural_{preset.capitalize()}"

    mesh = bpy.data.meshes.new(f"{obj_name}_Mesh")
    obj = bpy.data.objects.new(obj_name, mesh)
    bpy.context.collection.objects.link(obj)

    # Add Geometry Nodes modifier
    gn_mod = obj.modifiers.new(name="GeometryNodes", type="NODES")
    node_group = bpy.data.node_groups.new(name=f"{obj_name}_Tree", type="GeometryNodeTree")
    gn_mod.node_group = node_group

    # Modern 4.0+ interface socket creation
    create_geonodes_socket(node_group, "Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    create_geonodes_socket(node_group, "Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")

    nodes = node_group.nodes
    links = node_group.links
    nodes.clear()

    input_node = nodes.new("NodeGroupInput")
    input_node.location = (-600, 0)
    output_node = nodes.new("NodeGroupOutput")
    output_node.location = (600, 0)

    # Material setup
    mat = None
    if material_spec:
        mat_name = material_spec.get("name", f"{obj_name}_Mat")
        preset_mat = material_spec.get("preset", "chrome")
        col = material_spec.get("baseColor")
        rough = material_spec.get("roughness")
        mat = build_material(mat_name, preset=preset_mat, base_color=col, roughness=rough)
        obj.data.materials.append(mat)

    if preset_lower == "cubegridwave":
        # 1. Grid of points
        grid_node = nodes.new("GeometryNodeMeshGrid")
        grid_node.location = (-400, 100)
        grid_node.inputs["Size X"].default_value = 8.0
        grid_node.inputs["Size Y"].default_value = 8.0
        grid_node.inputs["Vertices X"].default_value = 16
        grid_node.inputs["Vertices Y"].default_value = 16

        # 2. Instance on points
        inst_node = nodes.new("GeometryNodeInstanceOnPoints")
        inst_node.location = (100, 100)

        # 3. Cube instance
        cube_node = nodes.new("GeometryNodeMeshCube")
        cube_node.location = (-150, -150)
        cube_node.inputs["Size"].default_value = (0.35, 0.35, 0.35)

        links.new(grid_node.outputs["Mesh"], inst_node.inputs["Points"])
        links.new(cube_node.outputs["Mesh"], inst_node.inputs["Instance"])

        # 4. Set material if present
        if mat:
            set_mat = nodes.new("GeometryNodeSetMaterial")
            set_mat.location = (350, 100)
            set_mat.inputs["Material"].default_value = mat
            links.new(inst_node.outputs["Instances"], set_mat.inputs["Geometry"])
            links.new(set_mat.outputs["Geometry"], output_node.inputs["Geometry"])
        else:
            links.new(inst_node.outputs["Instances"], output_node.inputs["Geometry"])

    elif preset_lower == "particlefield":
        # Random distribution of points inside volume cube
        dist_node = nodes.new("GeometryNodeDistributePointsInVolume")
        dist_node.location = (-350, 100)
        dist_node.inputs["Density"].default_value = 0.8

        cube_vol = nodes.new("GeometryNodeMeshCube")
        cube_vol.location = (-550, 100)
        cube_vol.inputs["Size"].default_value = (6.0, 6.0, 4.0)

        inst_node = nodes.new("GeometryNodeInstanceOnPoints")
        inst_node.location = (50, 100)

        sphere_mesh = nodes.new("GeometryNodeMeshIcoSphere")
        sphere_mesh.location = (-200, -150)
        sphere_mesh.inputs["Radius"].default_value = 0.08
        sphere_mesh.inputs["Subdivisions"].default_value = 2

        links.new(cube_vol.outputs["Mesh"], dist_node.inputs["Volume"])
        links.new(dist_node.outputs["Points"], inst_node.inputs["Points"])
        links.new(sphere_mesh.outputs["Mesh"], inst_node.inputs["Instance"])

        if mat:
            set_mat = nodes.new("GeometryNodeSetMaterial")
            set_mat.location = (300, 100)
            set_mat.inputs["Material"].default_value = mat
            links.new(inst_node.outputs["Instances"], set_mat.inputs["Geometry"])
            links.new(set_mat.outputs["Geometry"], output_node.inputs["Geometry"])
        else:
            links.new(inst_node.outputs["Instances"], output_node.inputs["Geometry"])

    elif preset_lower == "rings":
        # Concentric geometric rings
        join_geo = nodes.new("GeometryNodeJoinGeometry")
        join_geo.location = (250, 0)

        radii = [1.2, 2.0, 2.8, 3.6]
        for idx, rad in enumerate(radii):
            circle = nodes.new("GeometryNodeCurvePrimitiveCircle")
            circle.location = (-400, 200 - (idx * 120))
            circle.inputs["Radius"].default_value = rad

            curve_to_mesh = nodes.new("GeometryNodeCurveToMesh")
            curve_to_mesh.location = (-150, 200 - (idx * 120))

            prof_circle = nodes.new("GeometryNodeCurvePrimitiveCircle")
            prof_circle.location = (-400, 100 - (idx * 120))
            prof_circle.inputs["Radius"].default_value = 0.04

            links.new(circle.outputs["Curve"], curve_to_mesh.inputs["Curve"])
            links.new(prof_circle.outputs["Curve"], curve_to_mesh.inputs["Profile Curve"])
            links.new(curve_to_mesh.outputs["Mesh"], join_geo.inputs["Geometry"])

        if mat:
            set_mat = nodes.new("GeometryNodeSetMaterial")
            set_mat.location = (420, 0)
            set_mat.inputs["Material"].default_value = mat
            links.new(join_geo.outputs["Geometry"], set_mat.inputs["Geometry"])
            links.new(set_mat.outputs["Geometry"], output_node.inputs["Geometry"])
        else:
            links.new(join_geo.outputs["Geometry"], output_node.inputs["Geometry"])

    else:
        # Default pass-through
        links.new(input_node.outputs["Geometry"], output_node.inputs["Geometry"])

    return obj
