#!/usr/bin/env python3
"""Render one authored movement action from the currently open Blender file."""

import math
import os
import sys

import bpy
from mathutils import Vector


def script_args():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) < 2:
        raise RuntimeError(
            "Expected: -- ACTION_NAME OUTPUT_PNG [FRAME] [BOUNDS_ACTION]"
        )
    return (
        args[0],
        os.path.abspath(args[1]),
        int(args[2]) if len(args) > 2 else 7,
        args[3] if len(args) > 3 else None,
    )


def look_at(camera, target):
    camera.rotation_euler = (
        (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    )


def scene_bounds():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(
            evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box
        )
    if not points:
        return Vector((-1, -1, -1)), Vector((1, 1, 1))
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def add_area_light(name, location, energy, size, color):
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    look_at(obj, (0, 0, 0))
    return obj


def configure_scene(action_name, output_path, frame, bounds_action_name=None):
    rig = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    rig.animation_data_create()
    if rig.animation_data.use_tweak_mode:
        rig.animation_data.use_tweak_mode = False
    rig.animation_data.use_nla = False
    action = bpy.data.actions.get(action_name)
    if action is None:
        raise RuntimeError(f"Missing action {action_name!r}")
    rig.animation_data.action = action

    def belongs_to_rig(obj):
        current = obj.parent
        while current is not None:
            if current == rig:
                return True
            current = current.parent
        return any(
            modifier.type == "ARMATURE" and modifier.object == rig
            for modifier in obj.modifiers
        )

    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and not belongs_to_rig(obj):
            obj.hide_render = True

    scene = bpy.context.scene
    scene.frame_set(frame - 1 if frame > 0 else frame + 1)
    scene.frame_set(frame)
    bpy.context.view_layer.update()

    for obj in list(scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    if bounds_action_name:
        bounds_action = bpy.data.actions.get(bounds_action_name)
        if bounds_action is None:
            raise RuntimeError(f"Missing bounds action {bounds_action_name!r}")
        rig.animation_data.action = bounds_action
        scene.frame_set(frame - 1 if frame > 0 else frame + 1)
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        minimum, maximum = scene_bounds()
        rig.animation_data.action = action
        scene.frame_set(frame - 1 if frame > 0 else frame + 1)
        scene.frame_set(frame)
        bpy.context.view_layer.update()
    else:
        minimum, maximum = scene_bounds()
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    radius = max(size.x, size.y, size.z, 0.75)

    camera_data = bpy.data.cameras.new("MovementActionCamera")
    camera = bpy.data.objects.new("MovementActionCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = center + Vector((radius * 1.1, -radius * 1.7, radius * 0.8))
    camera_data.lens = 58
    camera_data.sensor_width = 36
    look_at(camera, center + Vector((0, 0, size.z * 0.03)))
    scene.camera = camera

    key = add_area_light(
        "MovementActionKey",
        center + Vector((radius * 2.0, -radius * 2.0, radius * 2.8)),
        1100,
        radius * 2.2,
        (1.0, 0.82, 0.68),
    )
    look_at(key, center)
    fill = add_area_light(
        "MovementActionFill",
        center + Vector((-radius * 2.1, -radius * 0.4, radius * 1.45)),
        850,
        radius * 2.5,
        (0.55, 0.7, 1.0),
    )
    look_at(fill, center)
    rim = add_area_light(
        "MovementActionRim",
        center + Vector((0, radius * 2.0, radius * 2.2)),
        1000,
        radius * 1.8,
        (0.75, 0.85, 1.0),
    )
    look_at(rim, center)

    world = scene.world or bpy.data.worlds.new("MovementActionWorld")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.018, 0.024, 0.04, 1)
    background.inputs["Strength"].default_value = 0.32

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.filepath = output_path
    available_looks = {
        item.identifier
        for item in scene.view_settings.bl_rna.properties["look"].enum_items
    }
    for look in ("AgX - Medium High Contrast", "Medium High Contrast", "AgX - Punchy"):
        if look in available_looks:
            scene.view_settings.look = look
            break
    scene.render.resolution_percentage = 100
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.render.render()
    rendered = bpy.data.images.get("Render Result")
    if rendered is None:
        raise RuntimeError("Blender did not produce a Render Result")
    rendered.filepath_raw = output_path
    rendered.file_format = "PNG"
    rendered.save()
    print(f"MOVEMENT_ACTION_RENDERED {action_name} {output_path}")


if __name__ == "__main__":
    configure_scene(*script_args())
