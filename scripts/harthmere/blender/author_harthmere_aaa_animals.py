"""Author the Harthmere production animal pack in an open Blender session.

This script is intentionally executed through Blender MCP, not through the
Blender command line.  It builds optimized, rigged, stylized-PBR animals,
authors the native NPC animation contract, exports one GLB per species, and
saves the editable source scene.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(
    os.environ.get("HARTHMERE_REPO_ROOT", "/Users/devindixon/Development/biomes-game")
).resolve()
OUTPUT_ROOT = REPO_ROOT / "public/assets/harthmere/glb/creatures/animals"
SOURCE_BLEND = REPO_ROOT / "src/galois/data/npcs/harthmere_aaa_animals.blend"
PREVIEW_PATH = REPO_ROOT / "output/harthmere-aaa-animals/harthmere-aaa-animals.png"
MANIFEST_PATH = OUTPUT_ROOT / "harthmere-animal-asset-manifest.json"

FPS = 24


SPECIES = {
    "chicken": {"family": "bird", "body": (0.43, 0.54, 0.48), "z": 0.57, "colors": (0.78, 0.32, 0.10, 1), "accent": (0.93, 0.10, 0.05, 1), "belly": (0.96, 0.72, 0.32, 1)},
    "deer": {"family": "hoofed", "body": (0.62, 1.26, 0.72), "z": 1.08, "colors": (0.38, 0.16, 0.055, 1), "accent": (0.13, 0.055, 0.025, 1), "belly": (0.72, 0.48, 0.24, 1)},
    "stag": {"family": "hoofed", "body": (0.70, 1.40, 0.82), "z": 1.18, "colors": (0.30, 0.11, 0.035, 1), "accent": (0.09, 0.035, 0.018, 1), "belly": (0.64, 0.39, 0.17, 1)},
    "squirrel": {"family": "rodent", "body": (0.34, 0.62, 0.38), "z": 0.46, "colors": (0.66, 0.18, 0.035, 1), "accent": (0.24, 0.045, 0.012, 1), "belly": (0.95, 0.57, 0.22, 1)},
    "songbird": {"family": "bird", "body": (0.28, 0.40, 0.30), "z": 0.38, "colors": (0.14, 0.36, 0.62, 1), "accent": (0.025, 0.07, 0.16, 1), "belly": (0.88, 0.78, 0.40, 1)},
    "pigeon": {"family": "bird", "body": (0.36, 0.52, 0.40), "z": 0.46, "colors": (0.30, 0.34, 0.42, 1), "accent": (0.12, 0.16, 0.24, 1), "belly": (0.56, 0.60, 0.66, 1)},
    "crow": {"family": "bird", "body": (0.39, 0.60, 0.43), "z": 0.50, "colors": (0.025, 0.032, 0.05, 1), "accent": (0.09, 0.04, 0.14, 1), "belly": (0.08, 0.09, 0.13, 1)},
    "duck": {"family": "bird", "body": (0.42, 0.66, 0.44), "z": 0.44, "colors": (0.22, 0.38, 0.20, 1), "accent": (0.035, 0.12, 0.08, 1), "belly": (0.76, 0.58, 0.22, 1)},
    "goose": {"family": "bird", "body": (0.48, 0.82, 0.50), "z": 0.58, "colors": (0.82, 0.84, 0.80, 1), "accent": (0.16, 0.18, 0.16, 1), "belly": (0.96, 0.96, 0.90, 1)},
    "frog": {"family": "frog", "body": (0.48, 0.58, 0.34), "z": 0.31, "colors": (0.15, 0.46, 0.13, 1), "accent": (0.04, 0.17, 0.045, 1), "belly": (0.53, 0.69, 0.25, 1)},
    "fox": {"family": "canine", "body": (0.50, 1.06, 0.58), "z": 0.70, "colors": (0.78, 0.19, 0.035, 1), "accent": (0.18, 0.035, 0.015, 1), "belly": (0.93, 0.72, 0.46, 1)},
    "otter": {"family": "mustelid", "body": (0.46, 1.12, 0.46), "z": 0.50, "colors": (0.24, 0.105, 0.045, 1), "accent": (0.075, 0.03, 0.014, 1), "belly": (0.58, 0.34, 0.17, 1)},
    "cat": {"family": "feline", "body": (0.42, 0.90, 0.48), "z": 0.61, "colors": (0.20, 0.18, 0.17, 1), "accent": (0.055, 0.05, 0.048, 1), "belly": (0.46, 0.39, 0.31, 1)},
    "mouse": {"family": "rodent", "body": (0.24, 0.42, 0.25), "z": 0.25, "colors": (0.38, 0.32, 0.29, 1), "accent": (0.14, 0.11, 0.10, 1), "belly": (0.66, 0.58, 0.51, 1)},
    "rat": {"family": "rodent", "body": (0.30, 0.58, 0.29), "z": 0.29, "colors": (0.20, 0.19, 0.18, 1), "accent": (0.065, 0.055, 0.05, 1), "belly": (0.48, 0.43, 0.38, 1)},
    "boar": {"family": "boar", "body": (0.72, 1.18, 0.72), "z": 0.72, "colors": (0.25, 0.13, 0.07, 1), "accent": (0.08, 0.035, 0.018, 1), "belly": (0.42, 0.24, 0.12, 1)},
    "badger": {"family": "mustelid", "body": (0.58, 1.02, 0.50), "z": 0.48, "colors": (0.13, 0.12, 0.115, 1), "accent": (0.025, 0.025, 0.025, 1), "belly": (0.58, 0.58, 0.55, 1)},
    "pig": {"family": "boar", "body": (0.68, 1.04, 0.66), "z": 0.65, "colors": (0.76, 0.34, 0.36, 1), "accent": (0.44, 0.12, 0.15, 1), "belly": (0.92, 0.58, 0.58, 1)},
    "dog": {"family": "canine", "body": (0.54, 1.06, 0.62), "z": 0.72, "colors": (0.48, 0.24, 0.08, 1), "accent": (0.12, 0.055, 0.018, 1), "belly": (0.72, 0.50, 0.25, 1)},
    "hound": {"family": "canine", "body": (0.61, 1.18, 0.69), "z": 0.78, "colors": (0.19, 0.16, 0.15, 1), "accent": (0.035, 0.03, 0.03, 1), "belly": (0.38, 0.30, 0.24, 1)},
    "wolf": {"family": "canine", "body": (0.62, 1.18, 0.70), "z": 0.80, "colors": (0.25, 0.28, 0.31, 1), "accent": (0.07, 0.08, 0.10, 1), "belly": (0.48, 0.50, 0.52, 1)},
    "snake": {"family": "snake", "body": (0.26, 1.34, 0.25), "z": 0.20, "colors": (0.12, 0.34, 0.18, 1), "accent": (0.025, 0.11, 0.055, 1), "belly": (0.52, 0.62, 0.22, 1)},
    "bear": {"family": "bear", "body": (0.94, 1.42, 0.92), "z": 0.93, "colors": (0.16, 0.075, 0.032, 1), "accent": (0.045, 0.018, 0.008, 1), "belly": (0.34, 0.18, 0.085, 1)},
    "horse": {"family": "hoofed", "body": (0.76, 1.58, 0.86), "z": 1.28, "colors": (0.38, 0.15, 0.045, 1), "accent": (0.075, 0.027, 0.009, 1), "belly": (0.62, 0.34, 0.14, 1)},
    "spider": {"family": "spider", "body": (0.72, 0.92, 0.40), "z": 0.34, "colors": (0.08, 0.045, 0.07, 1), "accent": (0.30, 0.06, 0.12, 1), "belly": (0.18, 0.08, 0.15, 1)},
    "river_lurker": {"family": "reptile", "body": (0.72, 1.72, 0.48), "z": 0.42, "colors": (0.10, 0.28, 0.17, 1), "accent": (0.025, 0.08, 0.05, 1), "belly": (0.42, 0.52, 0.22, 1)},
}


def clear_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablock in list(bpy.data.collections):
        bpy.data.collections.remove(datablock)
    # Object deletion alone leaves orphaned authored data-blocks in a saved
    # .blend. Purging them makes repeated MCP authoring runs deterministic and
    # prevents the editable source from growing on every regeneration.
    for datablocks in (
        bpy.data.meshes,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.actions,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def material(name: str, color, metallic=0.0, roughness=0.62):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.28
    return mat


def add_uv(name, location, scale, mat, collection, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.materials.append(mat)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)
    bevel = obj.modifiers.new("MicroBevel", "BEVEL")
    bevel.width = min(scale) * 0.055
    bevel.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj


def add_cone(name, location, radius1, radius2, depth, mat, collection, rotation=(0, 0, 0), vertices=12):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.materials.append(mat)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)
    bevel = obj.modifiers.new("EdgeSoftening", "BEVEL")
    bevel.width = min(radius1, max(radius2, radius1 * 0.25)) * 0.08
    bevel.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj


def add_cylinder(name, location, radius, depth, mat, collection, rotation=(0, 0, 0), vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)
    bevel = obj.modifiers.new("EdgeSoftening", "BEVEL")
    bevel.width = radius * 0.18
    bevel.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def create_armature(name: str, bones: dict[str, tuple[tuple[float, float, float], tuple[float, float, float], str | None]], collection):
    data = bpy.data.armatures.new(f"{name}_Rig")
    arm = bpy.data.objects.new(f"{name}_Armature", data)
    collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    made = {}
    for bone_name, (head, tail, parent) in bones.items():
        bone = data.edit_bones.new(bone_name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = made[parent]
        made[bone_name] = bone
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in arm.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.select_set(False)
    return arm


def bone_parent(obj, arm, bone_name):
    world = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def key(pose_bone, frame, rotation=(0, 0, 0), location=(0, 0, 0), scale=(1, 1, 1)):
    pose_bone.rotation_euler = rotation
    pose_bone.location = location
    pose_bone.scale = scale
    pose_bone.keyframe_insert("rotation_euler", frame=frame)
    pose_bone.keyframe_insert("location", frame=frame)
    pose_bone.keyframe_insert("scale", frame=frame)


def make_action(arm, name, frame_end, poses):
    action = bpy.data.actions.new(f"{arm.name}__{name}")
    action.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = action
    for frame, values in poses.items():
        for bone in arm.pose.bones:
            spec = values.get(bone.name, {})
            key(bone, frame, spec.get("r", (0, 0, 0)), spec.get("l", (0, 0, 0)), spec.get("s", (1, 1, 1)))
    # Blender 5.x stores action curves in layered channel bags rather than the
    # legacy Action.fcurves collection. Keyframe insertion still creates the
    # correct Bezier animation data, so no compatibility-only curve walk is
    # required here.
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.action_frame_start = 1
    strip.action_frame_end = frame_end
    strip.blend_type = "REPLACE"
    track.mute = False
    return action


def standard_actions(arm, family):
    legs = [n for n in ("leg_fl", "leg_fr", "leg_bl", "leg_br") if n in arm.pose.bones]
    tail = "tail" if "tail" in arm.pose.bones else None
    head = "head" if "head" in arm.pose.bones else None
    wing_l = "wing_l" if "wing_l" in arm.pose.bones else None
    wing_r = "wing_r" if "wing_r" in arm.pose.bones else None

    idle = {1: {}, 24: {"body": {"l": (0, 0, 0.025)}, **({head: {"r": (0.06, 0, 0.08)}} if head else {}), **({tail: {"r": (0.06, 0.08, 0)}} if tail else {})}, 48: {}}
    if wing_l:
        idle[24][wing_l] = {"r": (0, -0.05, -0.08)}
        idle[24][wing_r] = {"r": (0, 0.05, 0.08)}
    make_action(arm, "Idle", 48, idle)

    walk = {1: {}, 7: {"body": {"l": (0, 0, 0.035)}}, 13: {}, 19: {"body": {"l": (0, 0, 0.035)}}, 25: {}}
    if len(legs) == 4:
        for frame, sign in ((1, 1), (7, 0), (13, -1), (19, 0), (25, 1)):
            walk[frame].update({legs[0]: {"r": (sign * 0.45, 0, 0)}, legs[3]: {"r": (sign * 0.45, 0, 0)}, legs[1]: {"r": (-sign * 0.45, 0, 0)}, legs[2]: {"r": (-sign * 0.45, 0, 0)}})
    elif len(legs) == 2:
        for frame, sign in ((1, 1), (7, 0), (13, -1), (19, 0), (25, 1)):
            walk[frame].update({legs[0]: {"r": (sign * 0.5, 0, 0)}, legs[1]: {"r": (-sign * 0.5, 0, 0)}})
    if tail:
        walk[7][tail] = {"r": (0, 0.12, 0)}
        walk[19][tail] = {"r": (0, -0.12, 0)}
    make_action(arm, "Walk", 25, walk)

    run = {1: {}, 5: {"body": {"l": (0, 0, 0.075), "r": (-0.06, 0, 0)}}, 10: {}, 14: {"body": {"l": (0, 0, 0.075), "r": (-0.06, 0, 0)}}, 19: {}}
    if len(legs) >= 2:
        for frame, sign in ((1, 1), (5, 0), (10, -1), (14, 0), (19, 1)):
            for idx, leg in enumerate(legs):
                run[frame][leg] = {"r": (((sign if idx in (0, 3) else -sign) * 0.75), 0, 0)}
    make_action(arm, "Run", 19, run)

    attack = {1: {}, 5: {"body": {"r": (0.12, 0, 0)}}, 10: {"body": {"r": (-0.20, 0, 0), "l": (0, -0.10, 0)}, **({head: {"r": (-0.48, 0, 0)}} if head else {})}, 15: {"body": {"r": (0.08, 0, 0)}}, 21: {}}
    if wing_l:
        attack[10][wing_l] = {"r": (0, -0.75, -0.35)}
        attack[10][wing_r] = {"r": (0, 0.75, 0.35)}
    make_action(arm, "Attack", 21, attack)

    make_action(arm, "HitReact", 15, {1: {}, 6: {"body": {"r": (0.22, 0, 0), "l": (0, 0.12, 0.04)}, **({head: {"r": (0.28, 0, 0)}} if head else {})}, 15: {}})
    make_action(arm, "Death", 32, {1: {}, 12: {"root": {"r": (0, -0.35, 0.10), "l": (0, 0, -0.05)}}, 24: {"root": {"r": (0, -1.45, 0.16), "l": (0, 0, -0.18)}}, 32: {"root": {"r": (0, -1.57, 0.16), "l": (0, 0, -0.22)}}})

    if wing_l:
        make_action(arm, "Fly", 19, {1: {wing_l: {"r": (0, -0.15, -0.25)}, wing_r: {"r": (0, 0.15, 0.25)}}, 5: {"body": {"l": (0, 0, 0.08)}, wing_l: {"r": (0, -1.05, -0.55)}, wing_r: {"r": (0, 1.05, 0.55)}}, 10: {wing_l: {"r": (0, 0.32, 0.18)}, wing_r: {"r": (0, -0.32, -0.18)}}, 15: {"body": {"l": (0, 0, 0.08)}, wing_l: {"r": (0, -1.05, -0.55)}, wing_r: {"r": (0, 1.05, 0.55)}}, 19: {wing_l: {"r": (0, -0.15, -0.25)}, wing_r: {"r": (0, 0.15, 0.25)}}})


def common_bones(cfg):
    width, length, height = cfg["body"]
    z = cfg["z"]
    front_y = -length * 0.34
    back_y = length * 0.34
    return {
        "root": ((0, 0, 0.02), (0, 0, 0.20), None),
        "body": ((0, 0, z), (0, 0, z + 0.25), "root"),
        "head": ((0, -length * 0.55, z + height * 0.28), (0, -length * 0.70, z + height * 0.40), "body"),
        "tail": ((0, length * 0.46, z + height * 0.12), (0, length * 0.72, z + height * 0.10), "body"),
        "leg_fl": ((-width * 0.28, front_y, z - height * 0.20), (-width * 0.28, front_y, max(0.06, z - height * 0.72)), "body"),
        "leg_fr": ((width * 0.28, front_y, z - height * 0.20), (width * 0.28, front_y, max(0.06, z - height * 0.72)), "body"),
        "leg_bl": ((-width * 0.28, back_y, z - height * 0.20), (-width * 0.28, back_y, max(0.06, z - height * 0.72)), "body"),
        "leg_br": ((width * 0.28, back_y, z - height * 0.20), (width * 0.28, back_y, max(0.06, z - height * 0.72)), "body"),
    }


def build_species(name, cfg):
    collection = bpy.data.collections.new(f"AAA_{name}")
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new(f"{name}_Root", None)
    collection.objects.link(root)
    mats = {
        "body": material(f"{name}_Body", cfg["colors"]),
        "accent": material(f"{name}_Accent", cfg["accent"]),
        "belly": material(f"{name}_Belly", cfg["belly"]),
        "eye": material(f"{name}_Eye", (0.008, 0.01, 0.014, 1), metallic=0.05, roughness=0.20),
        "wet": material(f"{name}_Wet", (0.035, 0.055, 0.045, 1), metallic=0.0, roughness=0.18),
        "horn": material(f"{name}_Horn", (0.52, 0.42, 0.27, 1), roughness=0.48),
    }
    width, length, height = cfg["body"]
    z = cfg["z"]
    family = cfg["family"]

    bones = common_bones(cfg)
    if family == "bird":
        bones["wing_l"] = ((-width * 0.32, 0, z + 0.02), (-width * 0.75, 0.02, z - 0.02), "body")
        bones["wing_r"] = ((width * 0.32, 0, z + 0.02), (width * 0.75, 0.02, z - 0.02), "body")
    arm = create_armature(name, bones, collection)
    arm.parent = root

    parts = []
    body = add_uv(f"{name}_body", (0, 0, z), (width * 0.52, length * 0.52, height * 0.50), mats["body"], collection, 20, 12)
    parts.append((body, "body"))
    belly = add_uv(f"{name}_belly", (0, -length * 0.10, z - height * 0.13), (width * 0.39, length * 0.38, height * 0.34), mats["belly"], collection, 16, 10)
    parts.append((belly, "body"))

    if family == "snake":
        body.scale = (0.72, 1.05, 0.72)
        head = add_uv(f"{name}_head", (0, -length * 0.68, z + 0.03), (width * 0.54, length * 0.16, height * 0.48), mats["body"], collection)
        parts.append((head, "head"))
        for i in range(1, 5):
            seg = add_uv(f"{name}_tail_{i}", (0, length * (0.30 + i * 0.19), z - i * 0.018), (width * (0.44 - i * 0.045), length * 0.18, height * (0.42 - i * 0.04)), mats["body"], collection, 14, 8)
            parts.append((seg, "tail"))
    elif family == "spider":
        head = add_uv(f"{name}_cephalothorax", (0, -length * 0.36, z + 0.02), (width * 0.38, length * 0.30, height * 0.43), mats["accent"], collection)
        parts.append((head, "head"))
        for side in (-1, 1):
            for i, y in enumerate((-0.32, -0.10, 0.13, 0.33)):
                upper = add_cylinder(f"{name}_leg_{side}_{i}_upper", (side * width * 0.62, y * length, z - 0.02), width * 0.055, width * 0.72, mats["accent"], collection, rotation=(0, math.radians(70), math.radians(side * 14)))
                lower = add_cylinder(f"{name}_leg_{side}_{i}_lower", (side * width * 0.94, y * length, z - 0.17), width * 0.045, width * 0.58, mats["accent"], collection, rotation=(0, math.radians(45), math.radians(side * 24)))
                parts.extend(((upper, "body"), (lower, "body")))
    elif family == "bird":
        head_z = z + height * 0.43
        head = add_uv(
            f"{name}_head",
            (0, -length * 0.48, head_z),
            (width * 0.30, length * 0.23, height * 0.31),
            mats["body"],
            collection,
            18,
            10,
        )
        parts.append((head, "head"))
    elif family == "frog":
        head_z = z + height * 0.18
        head = add_uv(
            f"{name}_head",
            (0, -length * 0.38, head_z),
            (width * 0.48, length * 0.34, height * 0.26),
            mats["body"],
            collection,
            18,
            10,
        )
        parts.append((head, "head"))
    else:
        head_z = z + height * (0.26 if family in ("boar", "bear", "mustelid", "frog") else 0.38)
        head = add_uv(f"{name}_head", (0, -length * 0.58, head_z), (width * (0.34 if family != "bear" else 0.40), length * 0.25, height * 0.34), mats["body"], collection, 18, 10)
        parts.append((head, "head"))
        snout = add_uv(f"{name}_muzzle", (0, -length * 0.77, head_z - height * 0.06), (width * 0.22, length * 0.15, height * 0.17), mats["accent"], collection, 14, 8)
        parts.append((snout, "head"))
        nose = add_uv(f"{name}_nose", (0, -length * 0.90, head_z - height * 0.045), (width * 0.13, length * 0.055, height * 0.10), mats["wet"], collection, 12, 8)
        parts.append((nose, "head"))

    if family not in ("snake", "spider"):
        eye_y = -length * (0.54 if family == "bird" else 0.43 if family == "frog" else 0.74)
        eye_z = z + height * (0.48 if family == "bird" else 0.34 if family == "frog" else 0.39)
        eye_x = width * (0.18 if family == "bird" else 0.30 if family == "frog" else 0.22)
        for side in (-1, 1):
            eye = add_uv(f"{name}_eye_{'l' if side < 0 else 'r'}", (side * eye_x, eye_y, eye_z), (width * (0.055 if family == "bird" else 0.075 if family == "frog" else 0.048), length * 0.035, height * (0.065 if family == "frog" else 0.055)), mats["eye"], collection, 12, 8)
            parts.append((eye, "head"))

    if family == "bird":
        beak = add_cone(f"{name}_beak", (0, -length * 0.76, z + height * 0.32), width * 0.12, 0.0, length * 0.28, mats["belly"], collection, rotation=(math.pi / 2, 0, 0), vertices=10)
        parts.append((beak, "head"))
        for side, bone in ((-1, "wing_l"), (1, "wing_r")):
            wing = add_uv(f"{name}_wing_{side}", (side * width * 0.46, 0.02, z), (width * 0.20, length * 0.44, height * 0.34), mats["accent"], collection, 16, 10)
            wing.rotation_euler[1] = side * 0.12
            parts.append((wing, bone))
        for index, side in enumerate((-1, 0, 1)):
            feather = add_cone(
                f"{name}_tail_feather_{index}",
                (side * width * 0.12, length * 0.60, z + height * 0.06 + (1 - abs(side)) * height * 0.08),
                width * 0.095,
                width * 0.025,
                length * (0.42 + (1 - abs(side)) * 0.12),
                mats["accent"],
                collection,
                rotation=(math.pi / 2, 0, side * 0.10),
                vertices=10,
            )
            parts.append((feather, "tail"))
        if name == "chicken":
            comb = add_cone(f"{name}_comb", (0, -length * 0.48, z + height * 0.68), width * 0.12, width * 0.045, height * 0.20, mats["accent"], collection, vertices=8)
            wattle = add_uv(f"{name}_wattle", (0, -length * 0.72, z + height * 0.16), (width * 0.10, length * 0.055, height * 0.13), mats["accent"], collection, 12, 8)
            parts.extend(((comb, "head"), (wattle, "head")))
        if name in ("goose", "duck"):
            neck = add_cylinder(f"{name}_neck", (0, -length * 0.39, z + height * 0.40), width * 0.17, height * 0.72, mats["body"], collection)
            parts.append((neck, "head"))
    elif family in ("canine", "feline", "bear", "mustelid", "rodent", "boar"):
        for side in (-1, 1):
            ear = add_cone(f"{name}_ear_{side}", (side * width * 0.20, -length * 0.58, z + height * 0.68), width * 0.13, 0.0, height * (0.30 if family in ("canine", "feline") else 0.20), mats["accent"], collection, vertices=10)
            parts.append((ear, "head"))
        if family == "boar":
            for side in (-1, 1):
                tusk = add_cone(f"{name}_tusk_{side}", (side * width * 0.18, -length * 0.91, z + height * 0.19), width * 0.055, 0, width * 0.30, mats["horn"], collection, rotation=(math.pi / 2, 0, side * 0.18), vertices=10)
                parts.append((tusk, "head"))
    elif family == "hoofed":
        neck = add_cylinder(f"{name}_neck", (0, -length * 0.39, z + height * 0.35), width * 0.18, height * 0.78, mats["body"], collection, rotation=(math.radians(-18), 0, 0))
        parts.append((neck, "body"))
        for side in (-1, 1):
            ear = add_cone(f"{name}_ear_{side}", (side * width * 0.18, -length * 0.62, z + height * 0.71), width * 0.11, 0, height * 0.30, mats["accent"], collection, vertices=10)
            parts.append((ear, "head"))
        if name in ("deer", "stag"):
            for side in (-1, 1):
                antler = add_cylinder(f"{name}_antler_{side}", (side * width * 0.22, -length * 0.57, z + height * 0.93), width * 0.045, height * (0.62 if name == "stag" else 0.38), mats["horn"], collection, rotation=(0, side * 0.18, side * 0.08), vertices=10)
                branch = add_cylinder(f"{name}_antler_branch_{side}", (side * width * 0.30, -length * 0.59, z + height * 1.02), width * 0.036, height * 0.32, mats["horn"], collection, rotation=(0, side * 0.60, side * 0.18), vertices=10)
                parts.extend(((antler, "head"), (branch, "head")))

    if family not in ("snake", "spider"):
        leg_radius = width * (0.07 if family not in ("bear", "boar") else 0.09)
        leg_depth = max(0.18, z - height * 0.10)
        leg_positions = {"leg_fl": (-width * 0.30, -length * 0.30), "leg_fr": (width * 0.30, -length * 0.30), "leg_bl": (-width * 0.30, length * 0.30), "leg_br": (width * 0.30, length * 0.30)}
        if family == "bird":
            leg_positions = {"leg_fl": (-width * 0.16, 0.04), "leg_fr": (width * 0.16, 0.04)}
        for bone_name, (x, y) in leg_positions.items():
            leg = add_cylinder(f"{name}_{bone_name}", (x, y, leg_depth * 0.50), leg_radius, leg_depth, mats["accent"], collection, vertices=10)
            parts.append((leg, bone_name))
            foot = add_uv(f"{name}_{bone_name}_foot", (x, y - length * 0.055, 0.055), (leg_radius * 1.5, length * 0.10, leg_radius * 0.60), mats["accent"], collection, 12, 8)
            parts.append((foot, bone_name))

    if family not in ("snake", "spider"):
        tail_len = length * (0.65 if name in ("squirrel", "fox", "wolf", "cat", "otter") else 0.42)
        tail_radius = width * (0.15 if name == "squirrel" else 0.09)
        tail = add_cone(f"{name}_tail", (0, length * 0.66, z + height * 0.05), tail_radius, tail_radius * 0.32, tail_len, mats["accent"], collection, rotation=(math.pi / 2, 0, 0), vertices=12)
        parts.append((tail, "tail"))

    if family == "frog":
        for side in (-1, 1):
            thigh = add_uv(f"{name}_thigh_{side}", (side * width * 0.45, length * 0.20, z - height * 0.18), (width * 0.28, length * 0.25, height * 0.22), mats["body"], collection, 14, 8)
            parts.append((thigh, "leg_bl" if side < 0 else "leg_br"))

    if family == "reptile":
        for i in range(5):
            scute = add_cone(f"{name}_scute_{i}", (0, -length * 0.25 + i * length * 0.14, z + height * 0.55), width * 0.09, 0, height * 0.17, mats["accent"], collection, vertices=8)
            parts.append((scute, "body"))

    for obj, bone_name in parts:
        bone_parent(obj, arm, bone_name)
    standard_actions(arm, family)
    arm.animation_data.action = bpy.data.actions.get(f"{arm.name}__Idle")
    arm.animation_data.use_nla = False

    root["harthmere_species"] = name
    root["harthmere_asset_quality"] = "production-stylized-pbr"
    root["harthmere_animation_contract"] = "Idle,Walk,Run,Attack,HitReact,Death"
    return collection, root, arm


def export_collection(collection, root, arm, name):
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    arm.animation_data.action = bpy.data.actions.get(f"{arm.name}__Idle")
    out = OUTPUT_ROOT / f"{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_apply=False,
        export_yup=True,
    )
    return out


def setup_gallery(roots):
    columns = 6
    spacing_x = 3.2
    spacing_y = 3.5
    for index, root in enumerate(roots):
        row, col = divmod(index, columns)
        root.location.x = (col - (columns - 1) / 2) * spacing_x
        root.location.y = row * spacing_y
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 7, -0.03))
    ground = bpy.context.object
    ground.name = "AAA_Animal_Gallery_Ground"
    ground.data.materials.append(
        material("AAA_Gallery_Ground", (0.055, 0.075, 0.095, 1), roughness=0.82)
    )
    bpy.ops.object.camera_add(location=(0, -20, 13))
    camera = bpy.context.object
    camera.name = "AAA_Animal_Gallery_Camera"
    target = Vector((0, 7, 1.1))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 48
    bpy.context.scene.camera = camera
    bpy.ops.object.light_add(type="AREA", location=(-6, -8, 12))
    key_light = bpy.context.object
    key_light.data.energy = 1900
    key_light.data.shape = "DISK"
    key_light.data.size = 7
    key_light.rotation_euler = (math.radians(25), 0, math.radians(-28))
    bpy.ops.object.light_add(type="AREA", location=(8, -2, 8))
    fill = bpy.context.object
    fill.data.energy = 1100
    fill.data.size = 6
    bpy.ops.object.light_add(type="AREA", location=(0, 12, 10))
    rim = bpy.context.object
    rim.data.energy = 1500
    rim.data.size = 8
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 1000
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.context.scene.render.film_transparent = False
    bpy.context.scene.world.color = (0.025, 0.035, 0.055)
    bpy.context.scene.render.filepath = str(PREVIEW_PATH)


def main():
    clear_scene()
    bpy.context.scene.render.fps = FPS
    roots = []
    manifest = {"version": 1, "quality": "production-stylized-pbr", "fps": FPS, "animals": {}}
    for name, cfg in SPECIES.items():
        collection, root, arm = build_species(name, cfg)
        path = export_collection(collection, root, arm, name)
        roots.append(root)
        manifest["animals"][name] = {
            "url": f"/assets/harthmere/glb/creatures/animals/{name}.glb",
            "family": cfg["family"],
            "clips": ["Idle", "Walk", "Run", "Attack", "HitReact", "Death"] + (["Fly"] if cfg["family"] == "bird" else []),
            "source": str(SOURCE_BLEND.relative_to(REPO_ROOT)),
            "bytes": path.stat().st_size,
        }
    setup_gallery(roots)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    SOURCE_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))
    bpy.ops.render.render(write_still=True)
    return {"species": len(SPECIES), "source": str(SOURCE_BLEND), "manifest": str(MANIFEST_PATH), "preview": str(PREVIEW_PATH)}


RESULT = None
if os.environ.get("HARTHMERE_AAA_ANIMALS_SKIP_AUTORUN") != "1":
    RESULT = main()
