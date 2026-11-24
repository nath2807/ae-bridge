# SPDX-License-Identifier: GPL-3.0-or-later
"""
Physics Simulation Rig Generator for Blender 4.2 / 5.x.
Includes Rigid Body dynamics, Cell Fracture shattering, Cloth reveals, and simulation cache baking.
"""

import math
import random
import bpy
from compat import has_cell_fracture_operator
from materials import build_material


def setup_rigid_body_world(start_frame=1, end_frame=90):
    """Initializes and configures the scene Rigid Body World."""
    scene = bpy.context.scene
    if not scene.rigidbody_world:
        bpy.ops.rigidbody.world_add()

    rbw = scene.rigidbody_world
    rbw.point_cache.frame_start = start_frame
    rbw.point_cache.frame_end = end_frame
    rbw.steps_per_second = 120
    rbw.solver_iterations = 20
    return rbw


def create_physics_preset(preset="dropAndBounce", target_obj=None, material_spec=None, start_frame=1, end_frame=90):
    """Configures physical simulations from presets and prepares bake caches."""
    preset_lower = preset.lower() if preset else "dropandbounce"
    rbw = setup_rigid_body_world(start_frame, end_frame)

    # 1. Passive Ground Collider
    floor_obj = bpy.data.objects.get("Physics_Floor")
    if not floor_obj:
        bpy.ops.mesh.primitive_plane_add(size=14.0, location=(0, 0, 0))
        floor_obj = bpy.context.active_object
        floor_obj.name = "Physics_Floor"
        mat = build_material("Floor_Mat", preset="matteClay", base_color=[0.85, 0.85, 0.88, 1.0], roughness=0.5)
        floor_obj.data.materials.append(mat)

    bpy.context.view_layer.objects.active = floor_obj
    bpy.ops.rigidbody.object_add(type="PASSIVE")
    floor_obj.rigid_body.collision_shape = "BOX"
    floor_obj.rigid_body.restitution = 0.6
    floor_obj.rigid_body.friction = 0.5

    created_objs = []

    if preset_lower == "dropandbounce":
        # Target object or hero cube drops and bounces on floor
        obj = target_obj
        if not obj:
            bpy.ops.mesh.primitive_cube_add(size=1.2, location=(0, 0, 3.2))
            obj = bpy.context.active_object
            obj.name = "Bouncing_Cube"
            bev = obj.modifiers.new("Bevel", "BEVEL")
            bev.width = 0.08
            bev.segments = 4
            bpy.ops.object.shade_smooth()
            if material_spec:
                mat = build_material("Drop_Mat", **material_spec)
                obj.data.materials.append(mat)

        obj.location = (0, 0, 3.5)
        obj.rotation_euler = (math.radians(25), math.radians(18), math.radians(12))

        bpy.context.view_layer.objects.active = obj
        bpy.ops.rigidbody.object_add(type="ACTIVE")
        obj.rigid_body.mass = 2.5
        obj.rigid_body.restitution = 0.75 # Bouncy
        obj.rigid_body.friction = 0.35
        created_objs.append(obj)

    elif preset_lower == "scatterfall":
        # Multi-object dynamic drop cascade
        shapes = ["cube", "sphere", "cylinder"]
        for i in range(16):
            sh = random.choice(shapes)
            rx = random.uniform(-1.8, 1.8)
            ry = random.uniform(-1.8, 1.8)
            rz = random.uniform(2.5, 6.0)
            sz = random.uniform(0.35, 0.6)

            if sh == "cube":
                bpy.ops.mesh.primitive_cube_add(size=sz, location=(rx, ry, rz))
            elif sh == "sphere":
                bpy.ops.mesh.primitive_uv_sphere_add(radius=sz / 2.0, location=(rx, ry, rz))
            else:
                bpy.ops.mesh.primitive_cylinder_add(radius=sz / 2.0, depth=sz, location=(rx, ry, rz))

            s_obj = bpy.context.active_object
            s_obj.name = f"Scatter_Obj_{i}"
            s_obj.rotation_euler = (random.random() * 6.28, random.random() * 6.28, random.random() * 6.28)
            bpy.ops.rigidbody.object_add(type="ACTIVE")
            s_obj.rigid_body.mass = 1.0
            s_obj.rigid_body.restitution = 0.65
            s_obj.rigid_body.friction = 0.4

            # Alternate vibrant colors
            m_col = [random.uniform(0.1, 0.9), random.uniform(0.1, 0.9), random.uniform(0.1, 0.9), 1.0]
            mat = build_material(f"Scatter_Mat_{i}", preset="glossyPlastic", base_color=m_col, roughness=0.15)
            s_obj.data.materials.append(mat)
            created_objs.append(s_obj)

    elif preset_lower == "shatter":
        # Cell fracture or explode modifier fallback
        obj = target_obj
        if not obj:
            bpy.ops.mesh.primitive_cube_add(size=1.4, location=(0, 0, 1.5))
            obj = bpy.context.active_object
            obj.name = "Shatter_Target"
            mat = build_material("Shatter_Mat", preset="glass")
            obj.data.materials.append(mat)

        if has_cell_fracture_operator():
            try:
                bpy.context.view_layer.objects.active = obj
                bpy.ops.object.add_fracture_cell_objects(
                    source_limit=25,
                    margin=0.002,
                    material_index=0
                )
                # Fracture creates a group of shards; hide original
                obj.hide_render = True
                obj.hide_viewport = True
                # Make shards dynamic rigid bodies
                for o in bpy.context.selected_objects:
                    if o != obj and o.type == "MESH":
                        bpy.context.view_layer.objects.active = o
                        bpy.ops.rigidbody.object_add(type="ACTIVE")
                        o.rigid_body.mass = 0.5
                        o.rigid_body.restitution = 0.4
                        created_objs.append(o)
            except Exception:
                pass
        else:
            # Explode modifier fallback
            obj.location = (0, 0, 1.5)
            part_mod = obj.modifiers.new("Explode_Particles", "PARTICLE_SYSTEM")
            ps = obj.particle_systems[0].settings
            ps.count = 40
            ps.frame_start = start_frame + 10
            ps.frame_end = start_frame + 12
            ps.lifetime = 100
            ps.normal_factor = 3.5

            exp_mod = obj.modifiers.new("Explode", "EXPLODE")
            created_objs.append(obj)

    elif preset_lower == "clothreveal":
        # Cloth plane draped over hero object, pulled away by wind/gravity
        hero = target_obj
        if not hero:
            bpy.ops.mesh.primitive_cube_add(size=1.2, location=(0, 0, 0.6))
            hero = bpy.context.active_object
            hero.name = "Cloth_Hero"

        # Enable collision on hero
        col_mod = hero.modifiers.new("Collision", "COLLISION")

        # Cloth sheet
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=32, y_subdivisions=32, size=3.2, location=(0, 0, 1.8))
        cloth_obj = bpy.context.active_object
        cloth_obj.name = "Silk_Cloth"
        cloth_mod = cloth_obj.modifiers.new("Cloth", "CLOTH")
        cloth_mod.settings.quality = 5
        cloth_mod.settings.mass = 0.15
        cloth_mod.collision_settings.use_collision = True

        # Silk material
        silk_mat = build_material("Silk_Mat", preset="glossyPlastic", base_color=[0.95, 0.1, 0.3, 1.0], roughness=0.3)
        cloth_obj.data.materials.append(silk_mat)
        bpy.ops.object.shade_smooth()

        # Wind force field to blow cloth off
        bpy.ops.object.effector_add(type="WIND", location=(-2.5, -2.5, 1.5))
        wind = bpy.context.active_object
        wind.rotation_euler = (math.radians(65), 0, math.radians(-45))
        wind.field.strength = 180.0

        created_objs.extend([hero, cloth_obj, wind])

    elif preset_lower == "windflag":
        # Pinned cloth flag flapping in breeze
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=24, y_subdivisions=16, size=2.0, location=(0, 0, 1.5))
        flag = bpy.context.active_object
        flag.name = "Wind_Flag"
        flag.rotation_euler = (math.radians(90), 0, 0)
        bpy.ops.object.transform_apply(rotation=True)

        # Pin left vertices
        vg = flag.vertex_groups.new(name="Pin_Group")
        for v in flag.data.vertices:
            if v.co.x < -0.9:
                vg.add([v.index], 1.0, "REPLACE")

        cloth_mod = flag.modifiers.new("Cloth", "CLOTH")
        cloth_mod.settings.vertex_group_mass = "Pin_Group"

        # Wind force
        bpy.ops.object.effector_add(type="WIND", location=(-3.0, 0, 1.5))
        wind = bpy.context.active_object
        wind.rotation_euler = (0, math.radians(90), 0)
        wind.field.strength = 80.0
        wind.field.flow = 1.2

        created_objs.extend([flag, wind])

    return created_objs


def bake_physics_simulation(start_frame=1, end_frame=90):
    """Bakes the simulation caches into disk/memory for deterministic rendering."""
    try:
        # Override context for bake operator
        for scene in bpy.data.scenes:
            if scene.rigidbody_world and scene.rigidbody_world.point_cache:
                scene.frame_start = start_frame
                scene.frame_end = end_frame
                bpy.ops.ptcache.bake_all(bake=True)
    except Exception:
        pass
