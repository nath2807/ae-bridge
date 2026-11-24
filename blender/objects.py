# SPDX-License-Identifier: GPL-3.0-or-later
"""
Geometric Primitives, Studio Cyclorama Floors, and 3D Asset Import for Blender 4.2 / 5.x.
Normalizes imported meshes, constructs studio backdrops, and manages scene geometry.
"""

import math
import os
import bpy
from materials import build_material


def create_primitive(kind="cube", name=None, size=1.0, location=(0, 0, 0), material_spec=None):
    """Creates a geometric mesh primitive with studio beveling where appropriate."""
    kind_lower = kind.lower() if kind else "cube"
    obj_name = name or f"Primitive_{kind.capitalize()}"

    if kind_lower == "cube":
        bpy.ops.mesh.primitive_cube_add(size=size, location=location)
        obj = bpy.context.active_object
        obj.name = obj_name

    elif kind_lower == "roundedcube":
        bpy.ops.mesh.primitive_cube_add(size=size, location=location)
        obj = bpy.context.active_object
        obj.name = obj_name
        # Add bevel modifier for rounded corners
        bev = obj.modifiers.new(name="Bevel", type="BEVEL")
        bev.width = size * 0.08
        bev.segments = 5
        bpy.ops.object.shade_smooth()

    elif kind_lower == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=size / 2.0, location=location, segments=64, ring_count=32)
        obj = bpy.context.active_object
        obj.name = obj_name
        bpy.ops.object.shade_smooth()

    elif kind_lower == "torus":
        bpy.ops.mesh.primitive_torus_add(
            location=location,
            major_radius=size * 0.6,
            minor_radius=size * 0.2,
            major_segments=48,
            minor_segments=24,
        )
        obj = bpy.context.active_object
        obj.name = obj_name
        bpy.ops.object.shade_smooth()

    elif kind_lower == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(radius=size / 2.0, depth=size, location=location, vertices=48)
        obj = bpy.context.active_object
        obj.name = obj_name
        bev = obj.modifiers.new(name="Bevel", type="BEVEL")
        bev.width = size * 0.03
        bev.segments = 3
        bpy.ops.object.shade_smooth()

    elif kind_lower == "plane":
        bpy.ops.mesh.primitive_plane_add(size=size, location=location)
        obj = bpy.context.active_object
        obj.name = obj_name

    elif kind_lower in ("floor", "cyclorama"):
        obj = create_cyclorama_floor(name=obj_name, width=12.0, depth=10.0, height=5.0)

    else:
        bpy.ops.mesh.primitive_cube_add(size=size, location=location)
        obj = bpy.context.active_object
        obj.name = obj_name

    if material_spec:
        mat_name = material_spec.get("name", f"{obj.name}_Mat")
        preset = material_spec.get("preset", "matteClay")
        col = material_spec.get("baseColor")
        rough = material_spec.get("roughness")
        mat = build_material(mat_name, preset=preset, base_color=col, roughness=rough)
        obj.data.materials.clear()
        obj.data.materials.append(mat)

    return obj


def create_cyclorama_floor(name="Studio_Cyclorama", width=16.0, depth=14.0, height=6.0, curve_radius=2.5):
    """Builds an infinite curved seamless studio cyclorama backdrop."""
    mesh = bpy.data.meshes.new(name=f"{name}_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    # Vertices for flat floor transitioning into a vertical curve
    half_w = width / 2.0
    segments = 12
    verts = []
    faces = []

    # Front floor point
    front_y = -depth / 2.0
    curve_start_y = depth / 2.0 - curve_radius

    # 1. Front floor edge
    verts.append((-half_w, front_y, 0))
    verts.append((half_w, front_y, 0))

    # 2. Curve start edge
    verts.append((-half_w, curve_start_y, 0))
    verts.append((half_w, curve_start_y, 0))
    faces.append((0, 1, 3, 2))

    # 3. Curved arc vertices into vertical wall
    prev_left = 2
    prev_right = 3
    curr_idx = 4

    for i in range(1, segments + 1):
        angle = (math.pi / 2.0) * (i / float(segments))
        y = curve_start_y + math.sin(angle) * curve_radius
        z = (1.0 - math.cos(angle)) * curve_radius

        verts.append((-half_w, y, z))
        verts.append((half_w, y, z))

        faces.append((prev_left, prev_right, curr_idx + 1, curr_idx))
        prev_left = curr_idx
        prev_right = curr_idx + 1
        curr_idx += 2

    # 4. Top vertical wall extension
    wall_top_z = height
    wall_y = curve_start_y + curve_radius
    verts.append((-half_w, wall_y, wall_top_z))
    verts.append((half_w, wall_y, wall_top_z))
    faces.append((prev_left, prev_right, curr_idx + 1, curr_idx))

    mesh.from_pydata(verts, [], faces)
    mesh.update()

    # Smooth shading
    for poly in mesh.polygons:
        poly.use_smooth = True

    # Default soft studio floor material
    mat = build_material("Cyclorama_Mat", preset="matteClay", base_color=[0.92, 0.93, 0.95, 1.0], roughness=0.6)
    obj.data.materials.append(mat)
    return obj


def import_3d_model(filepath, target_size=2.0, center_origin=True, material_spec=None):
    """Imports external GLTF/GLB, OBJ, or FBX model, normalizes scale and centers."""
    if not filepath or not os.path.exists(filepath):
        raise FileNotFoundError(f"3D asset file not found: {filepath}")

    ext = os.path.splitext(filepath)[1].lower()
    prior_objs = set(bpy.data.objects)

    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=filepath)
    elif ext == ".obj":
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=filepath)
        elif hasattr(bpy.ops.import_scene, "obj"):
            bpy.ops.import_scene.obj(filepath=filepath)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=filepath)
    else:
        raise ValueError(f"Unsupported 3D format '{ext}'. Supported: .glb, .gltf, .obj, .fbx")

    new_objs = [o for o in bpy.data.objects if o not in prior_objs and o.type == "MESH"]
    if not new_objs:
        raise RuntimeError(f"No mesh objects found in imported file: {filepath}")

    # Parent all new objects to a root container empty for unified transforms
    root_empty = bpy.data.objects.new("Imported_Model_Root", None)
    root_empty.empty_display_type = "PLAIN_AXES"
    bpy.context.collection.objects.link(root_empty)

    for o in new_objs:
        if not o.parent:
            o.parent = root_empty

    # Compute bounding box
    min_co = [float("inf")] * 3
    max_co = [float("-inf")] * 3

    for o in new_objs:
        for corner in o.bound_box:
            world_corner = o.matrix_world @ bpy.mathutils.Vector(corner) if hasattr(bpy, "mathutils") else corner
            for i in range(3):
                min_co[i] = min(min_co[i], world_corner[i])
                max_co[i] = max(max_co[i], world_corner[i])

    dim_x = max_co[0] - min_co[0]
    dim_y = max_co[1] - min_co[1]
    dim_z = max_co[2] - min_co[2]
    max_dim = max(dim_x, dim_y, dim_z, 0.001)

    scale_factor = target_size / max_dim
    root_empty.scale = (scale_factor, scale_factor, scale_factor)

    if center_origin:
        center_x = (min_co[0] + max_co[0]) / 2.0 * scale_factor
        center_y = (min_co[1] + max_co[1]) / 2.0 * scale_factor
        center_z = (min_co[2] + max_co[2]) / 2.0 * scale_factor
        root_empty.location = (-center_x, -center_y, target_size / 2.0 - center_z)

    # Optional material override
    if material_spec:
        mat_name = material_spec.get("name", "Model_Override_Mat")
        preset = material_spec.get("preset", "chrome")
        col = material_spec.get("baseColor")
        rough = material_spec.get("roughness")
        mat = build_material(mat_name, preset=preset, base_color=col, roughness=rough)
        for o in new_objs:
            o.data.materials.clear()
            o.data.materials.append(mat)

    return root_empty
