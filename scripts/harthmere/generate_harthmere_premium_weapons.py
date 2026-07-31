#!/usr/bin/env python3
"""Generate Harthmere's premium voxel weapon collection with Blender 5.x.

The models follow a constructed-weapon language: layered materials, chamfered
edges, visible fasteners, wraps, ferrules, mechanical parts, shield backs, and
subtle animated presentation points. Every weapon is oriented along +Z with the
grip close to the origin for the Harthmere held-item renderer.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Sequence, Tuple

import bpy
from mathutils import Vector


Vec3 = Tuple[float, float, float]
Color = Tuple[float, float, float, float]


@dataclass(frozen=True)
class WeaponSpec:
    id: str
    label: str
    builder: str
    profile: str
    target_length: float
    idle_clip: str


def spec(
    item_id: str,
    label: str,
    builder: str,
    profile: str,
    target_length: float,
) -> WeaponSpec:
    idle = {
        "melee": "IdleDrawn_24",
        "ranged": "IdleAim_24",
        "magic": "Channel_24",
        "magicBook": "OpenRead_24",
        "thrown": "Ready_24",
        "shield": "IdleGuard_24",
    }[profile]
    return WeaponSpec(item_id, label, builder, profile, target_length, idle)


WEAPONS: Tuple[WeaponSpec, ...] = (
    spec("one_handed_axe", "One-Handed Axe", "axe", "melee", 1.18),
    spec("two_handed_axe", "Two-Handed Axe", "axe", "melee", 1.62),
    spec("double_axe", "Double Axe", "axe", "melee", 1.55),
    spec("golden_double_axe", "Golden Double Axe", "axe", "melee", 1.58),
    spec("small_axe", "Small Axe", "axe", "melee", 0.92),
    spec("golden_small_axe", "Golden Small Axe", "axe", "melee", 0.95),
    spec("steel_dagger", "Dagger", "dagger", "melee", 0.78),
    spec("golden_dagger", "Golden Dagger", "dagger", "melee", 0.8),
    spec("double_headed_hammer", "Double-Headed Hammer", "hammer", "melee", 1.48),
    spec("golden_double_headed_hammer", "Golden Double-Headed Hammer", "hammer", "melee", 1.5),
    spec("iron_longsword", "One-Handed Sword", "sword", "melee", 1.18),
    spec("two_handed_sword", "Two-Handed Sword", "sword", "melee", 1.62),
    spec("colored_two_handed_sword", "Colored Two-Handed Sword", "sword", "melee", 1.63),
    spec("standard_sword", "Standard Sword", "sword", "melee", 1.24),
    spec("golden_sword", "Golden Sword", "sword", "melee", 1.26),
    spec("great_sword", "Great Sword", "sword", "melee", 1.88),
    spec("golden_great_sword", "Golden Great Sword", "sword", "melee", 1.9),
    spec("hunter_bow", "Wooden Bow", "bow", "ranged", 1.38),
    spec("golden_bow", "Golden Bow", "bow", "ranged", 1.4),
    spec("strung_bow", "Strung Bow", "bow", "ranged", 1.36),
    spec("one_handed_crossbow", "One-Handed Crossbow", "crossbow", "ranged", 1.0),
    spec("two_handed_crossbow", "Two-Handed Crossbow", "crossbow", "ranged", 1.45),
    spec("steel_dart", "Dart", "dart", "thrown", 0.62),
    spec("golden_dart", "Golden Dart", "dart", "thrown", 0.64),
    spec("arcane_staff", "Staff", "staff", "magic", 1.72),
    spec("arcane_wand", "Wand", "wand", "magic", 0.86),
    spec("arcane_spellbook_closed", "Spellbook — Closed", "book", "magicBook", 0.76),
    spec("arcane_spellbook_open", "Spellbook — Open", "book", "magicBook", 0.9),
    spec("sealed_scroll", "Scroll", "scroll", "magicBook", 0.72),
    spec("crystal_focus", "Crystal Focus", "focus", "magic", 0.7),
    spec("star_focus", "Star Focus", "focus", "magic", 0.72),
    spec("snowflake_focus", "Snowflake Focus", "focus", "magic", 0.76),
    spec("smoke_bomb", "Smoke Bomb", "smoke", "thrown", 0.58),
    spec("photon_sidearm", "Photon Sidearm", "energy_weapon", "ranged", 0.82),
    spec("pulse_carbine", "Pulse Carbine", "energy_weapon", "ranged", 1.18),
    spec("helix_projector", "Helix Projector", "energy_weapon", "ranged", 1.45),
    spec("nova_cannon", "Nova Cannon", "energy_weapon", "ranged", 1.68),
    spec("singularity_lance", "Singularity Lance", "energy_weapon", "ranged", 1.92),
    spec("round_shield", "Round Shield", "shield", "shield", 1.08),
    spec("barbarian_round_shield", "Barbarian Round Shield", "shield", "shield", 1.08),
    spec("spiked_shield", "Spiked Shield", "shield", "shield", 1.08),
    spec("square_shield", "Square Shield", "shield", "shield", 1.08),
    spec("badge_shield", "Badge Shield", "shield", "shield", 1.08),
    spec("colored_round_shield", "Colored Round Shield", "shield", "shield", 1.08),
    spec("colored_spiked_shield", "Colored Spiked Shield", "shield", "shield", 1.08),
    spec("colored_square_shield", "Colored Square Shield", "shield", "shield", 1.08),
    spec("colored_badge_shield", "Colored Badge Shield", "shield", "shield", 1.08),
)


def rgba(value: int, alpha: float = 1.0) -> Color:
    return (
        ((value >> 16) & 255) / 255.0,
        ((value >> 8) & 255) / 255.0,
        (value & 255) / 255.0,
        alpha,
    )


COLORS = {
    "steel": rgba(0xAEB9C4),
    "edge": rgba(0xEAF4FF),
    "iron": rgba(0x59636E),
    "dark_iron": rgba(0x242A31),
    "gold": rgba(0xD9A52F),
    "gold_bright": rgba(0xFFE08A),
    "brass": rgba(0x9D6C2D),
    "wood": rgba(0x6D4125),
    "wood_light": rgba(0x9B6334),
    "leather": rgba(0x38231C),
    "cloth": rgba(0xA53B35),
    "blue": rgba(0x2F6FA8),
    "blue_bright": rgba(0x6BB8F2),
    "parchment": rgba(0xD8C69B),
    "page_glow": rgba(0xD8F4FF),
    "crystal": rgba(0x69DDF2),
    "crystal_bright": rgba(0xE8FFFF),
    "purple": rgba(0x8B5BD8),
    "frost": rgba(0xBDEEFF),
    "night": rgba(0x142342),
    "fur": rgba(0x8A7564),
    "bone": rgba(0xD8D0B0),
    "black": rgba(0x101318),
    "energy_blue": rgba(0x3B8CFF),
    "energy_cyan": rgba(0x42E8FF),
    "energy_green": rgba(0x5CFF78),
    "energy_orange": rgba(0xFF7A21),
    "energy_white": rgba(0xF7FFFF),
    "energy_violet": rgba(0x8D4DFF),
}


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)


def mat(name: str, color: Color, metallic: float, roughness: float, emission: float = 0.0):
    key = f"weapon-{name}-{color}-{metallic}-{roughness}-{emission}"
    existing = bpy.data.materials.get(key)
    if existing:
        return existing
    value = bpy.data.materials.new(key)
    value.diffuse_color = color
    value.use_nodes = True
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = color
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission
    return value


MATERIALS = {
    "steel": mat("steel", COLORS["steel"], 0.82, 0.24),
    "edge": mat("edge", COLORS["edge"], 0.9, 0.14),
    "iron": mat("iron", COLORS["iron"], 0.74, 0.34),
    "dark_iron": mat("dark-iron", COLORS["dark_iron"], 0.72, 0.42),
    "gold": mat("gold", COLORS["gold"], 0.9, 0.22),
    "gold_bright": mat("gold-bright", COLORS["gold_bright"], 0.86, 0.17, 0.35),
    "brass": mat("brass", COLORS["brass"], 0.72, 0.3),
    "wood": mat("wood", COLORS["wood"], 0.0, 0.72),
    "wood_light": mat("wood-light", COLORS["wood_light"], 0.0, 0.64),
    "leather": mat("leather", COLORS["leather"], 0.0, 0.86),
    "cloth": mat("cloth", COLORS["cloth"], 0.0, 0.8),
    "blue": mat("blue", COLORS["blue"], 0.38, 0.33),
    "blue_bright": mat("blue-bright", COLORS["blue_bright"], 0.3, 0.26, 0.5),
    "parchment": mat("parchment", COLORS["parchment"], 0.0, 0.88),
    "page_glow": mat("page-glow", COLORS["page_glow"], 0.05, 0.26, 1.8),
    "crystal": mat("crystal", COLORS["crystal"], 0.24, 0.14, 1.7),
    "crystal_bright": mat("crystal-bright", COLORS["crystal_bright"], 0.2, 0.12, 2.4),
    "purple": mat("purple", COLORS["purple"], 0.24, 0.28, 1.3),
    "frost": mat("frost", COLORS["frost"], 0.18, 0.17, 1.6),
    "night": mat("night", COLORS["night"], 0.3, 0.36, 0.3),
    "fur": mat("fur", COLORS["fur"], 0.0, 0.96),
    "bone": mat("bone", COLORS["bone"], 0.0, 0.72),
    "black": mat("black", COLORS["black"], 0.1, 0.76),
    "energy_blue": mat("energy-blue", COLORS["energy_blue"], 0.18, 0.15, 2.3),
    "energy_cyan": mat("energy-cyan", COLORS["energy_cyan"], 0.16, 0.13, 2.5),
    "energy_green": mat("energy-green", COLORS["energy_green"], 0.17, 0.14, 2.6),
    "energy_orange": mat("energy-orange", COLORS["energy_orange"], 0.15, 0.17, 2.8),
    "energy_white": mat("energy-white", COLORS["energy_white"], 0.12, 0.1, 3.2),
    "energy_violet": mat("energy-violet", COLORS["energy_violet"], 0.22, 0.14, 2.7),
}


def move_to(obj, collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def bevel(obj, width=0.035, segments=2) -> None:
    if obj.type != "MESH":
        return
    modifier = obj.modifiers.new("CraftedEdge", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"


def finish(obj, collection, root, material, bevel_width=0.035):
    if material:
        obj.data.materials.append(material)
    bevel(obj, bevel_width)
    move_to(obj, collection)
    obj.parent = root
    return obj


def cube(collection, root, name, location: Vec3, scale: Vec3, material, rotation=(0, 0, 0), edge=0.035):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, collection, root, material, min(edge, min(scale) * 0.45))


def axe_wedge(collection, root, name, side, width, height, thickness, z, material):
    inner_x = side * 0.06
    outer_x = side * width
    inner_height = height * 0.27
    outer_height = height * 0.5
    vertices = []
    for y in (-thickness, thickness):
        vertices.extend(
            (
                (inner_x, y, z + inner_height),
                (outer_x, y, z + outer_height),
                (outer_x, y, z - outer_height),
                (inner_x, y, z - inner_height),
            )
        )
    faces = (
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    )
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = root
    if material:
        obj.data.materials.append(material)
    bevel(obj, min(0.045, thickness * 0.35), 2)
    return obj


def cylinder(collection, root, name, location: Vec3, radius, depth, material, vertices=8, rotation=(0, 0, 0), edge=0.025):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, collection, root, material, min(edge, radius * 0.4))


def cone(collection, root, name, location: Vec3, radius, depth, material, vertices=4, rotation=(0, 0, 0), edge=0.025):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, collection, root, material, min(edge, radius * 0.35))


def ico(collection, root, name, location: Vec3, scale: Vec3, material, subdivisions=1, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, collection, root, material, 0.025)


def torus(collection, root, name, location: Vec3, major, minor, material, rotation=(0, 0, 0), segments=16):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=segments,
        minor_segments=4,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, collection, root, material, 0.012)


def between(collection, root, name, start: Vec3, end: Vec3, radius, material, vertices=8):
    a, b = Vector(start), Vector(end)
    direction = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    obj.rotation_mode = "XYZ"
    return finish(obj, collection, root, material, min(0.02, radius * 0.35))


def wrap_grip(collection, root, z0, z1, radius, material=None, turns=6):
    material = material or MATERIALS["leather"]
    for i in range(turns):
        z = z0 + (z1 - z0) * (i + 0.5) / turns
        torus(collection, root, f"GripWrap_{i}", (0, 0, z), radius, 0.018, material, segments=10)


def add_rivets(collection, root, positions: List[Vec3], golden=False):
    material = MATERIALS["gold"] if golden else MATERIALS["brass"]
    for i, position in enumerate(positions):
        ico(collection, root, f"Rivet_{i}", position, (0.035, 0.035, 0.035), material, 1)


def build_axe(specification, collection, root):
    text = specification.id
    golden = "golden" in text
    small = "small" in text
    two_handed = "two_handed" in text or "double_axe" in text
    double = "double_axe" in text
    shaft_length = 1.05 if small else 1.55 if two_handed else 1.28
    head_z = shaft_length * 0.52
    metal = MATERIALS["gold"] if golden else MATERIALS["iron"]
    trim = MATERIALS["gold_bright"] if golden else MATERIALS["steel"]
    cylinder(collection, root, "HaftCore", (0, 0, 0), 0.065 if small else 0.078, shaft_length, MATERIALS["wood"], 8)
    cylinder(collection, root, "LowerFerrule", (0, 0, -shaft_length * 0.45), 0.095, 0.16, MATERIALS["dark_iron"], 8)
    wrap_grip(collection, root, -shaft_length * 0.36, -shaft_length * 0.08, 0.09 if not small else 0.078)
    cube(collection, root, "HeadSocket", (0, 0, head_z), (0.12, 0.13, 0.18), MATERIALS["dark_iron"], edge=0.045)
    blade_width = 0.44 if small else 0.68 if two_handed else 0.56
    blade_height = 0.42 if small else 0.58 if two_handed else 0.5
    axe_wedge(collection, root, "ChoppingBlade", 1, blade_width, blade_height, 0.105, head_z, metal)
    cube(collection, root, "ChoppingEdge", (blade_width, 0, head_z), (0.045, 0.12, blade_height * 0.48), trim, edge=0.025)
    if double:
        axe_wedge(collection, root, "HookBlade", -1, blade_width * 0.9, blade_height * 0.84, 0.1, head_z + 0.03, metal)
        cube(collection, root, "HookEdge", (-blade_width * 0.9, 0, head_z + 0.03), (0.045, 0.115, blade_height * 0.39), trim, edge=0.025)
    else:
        cone(collection, root, "BackSpike", (-0.28 if not small else -0.22, 0, head_z), 0.1, 0.38, trim, 4, rotation=(0, -math.pi / 2, 0))
    add_rivets(collection, root, [(0, -0.14, head_z), (0, 0.14, head_z)], golden)
    if two_handed:
        cube(collection, root, "LangetFront", (0, -0.083, head_z - 0.28), (0.035, 0.018, 0.3), metal, edge=0.014)
        cube(collection, root, "LangetBack", (0, 0.083, head_z - 0.28), (0.035, 0.018, 0.3), metal, edge=0.014)


def build_dagger(specification, collection, root):
    golden = "golden" in specification.id
    trim = MATERIALS["gold"] if golden else MATERIALS["brass"]
    blade = MATERIALS["gold"] if golden else MATERIALS["steel"]
    cube(collection, root, "BladeCore", (0, 0, 0.34), (0.09, 0.035, 0.34), blade, edge=0.035)
    cone(collection, root, "NeedlePoint", (0, 0, 0.76), 0.1, 0.3, MATERIALS["gold_bright"] if golden else MATERIALS["edge"], 4)
    cube(collection, root, "Fuller", (0, -0.04, 0.34), (0.018, 0.012, 0.26), MATERIALS["dark_iron"], edge=0.008)
    cube(collection, root, "OrnateGuard", (0, 0, -0.035), (0.28, 0.06, 0.055), trim, rotation=(0, 0, math.pi / 12), edge=0.035)
    cylinder(collection, root, "Grip", (0, 0, -0.28), 0.065, 0.42, MATERIALS["leather"], 8)
    wrap_grip(collection, root, -0.45, -0.12, 0.075, MATERIALS["cloth"] if golden else MATERIALS["leather"], 5)
    ico(collection, root, "GemPommel", (0, 0, -0.53), (0.11, 0.11, 0.11), MATERIALS["crystal"] if golden else trim, 1)
    add_rivets(collection, root, [(-0.19, 0, -0.035), (0.19, 0, -0.035)], golden)


def build_hammer(specification, collection, root):
    golden = "golden" in specification.id
    metal = MATERIALS["gold"] if golden else MATERIALS["iron"]
    trim = MATERIALS["gold_bright"] if golden else MATERIALS["steel"]
    cylinder(collection, root, "ReinforcedHaft", (0, 0, 0), 0.085, 1.5, MATERIALS["wood"], 8)
    wrap_grip(collection, root, -0.64, -0.18, 0.1, MATERIALS["leather"], 7)
    cylinder(collection, root, "PommelBand", (0, 0, -0.68), 0.115, 0.16, trim, 8)
    cube(collection, root, "HammerNeck", (0, 0, 0.58), (0.16, 0.17, 0.2), MATERIALS["dark_iron"], edge=0.055)
    for side in (-1, 1):
        cube(collection, root, f"HammerFace_{side}", (side * 0.38, 0, 0.62), (0.3, 0.25, 0.27), metal, edge=0.09)
        cube(collection, root, f"StrikingPlate_{side}", (side * 0.7, 0, 0.62), (0.045, 0.27, 0.29), trim, edge=0.03)
        torus(collection, root, f"FaceBand_{side}", (side * 0.4, 0, 0.62), 0.22, 0.028, trim, rotation=(0, math.pi / 2, 0), segments=12)
    cube(collection, root, "TopRune", (0, -0.26, 0.62), (0.14, 0.025, 0.14), MATERIALS["crystal"] if golden else MATERIALS["blue"], rotation=(0, 0, math.pi / 4), edge=0.02)
    add_rivets(collection, root, [(0, -0.18, 0.44), (0, 0.18, 0.44)], golden)


def build_sword(specification, collection, root):
    text = specification.id
    golden = "golden" in text
    great = "great_sword" in text
    two = "two_handed" in text or great
    colored = "colored" in text
    blade_length = 1.34 if great else 1.12 if two else 0.86
    blade_width = 0.17 if great else 0.13 if two else 0.105
    grip_length = 0.62 if great else 0.48 if two else 0.34
    blade_center = grip_length * 0.2 + blade_length * 0.5
    blade_mat = MATERIALS["blue"] if colored else MATERIALS["gold"] if golden else MATERIALS["steel"]
    trim = MATERIALS["gold"] if golden else MATERIALS["brass"]
    cube(collection, root, "Blade", (0, 0, blade_center), (blade_width, 0.045, blade_length * 0.5), blade_mat, edge=0.045)
    edge_material = MATERIALS["gold_bright"] if golden else MATERIALS["edge"]
    cube(collection, root, "EdgeLeft", (-blade_width, 0, blade_center), (0.025, 0.052, blade_length * 0.48), edge_material, edge=0.012)
    cube(collection, root, "EdgeRight", (blade_width, 0, blade_center), (0.025, 0.052, blade_length * 0.48), edge_material, edge=0.012)
    cone(collection, root, "BladePoint", (0, 0, blade_center + blade_length * 0.58), blade_width * 1.22, blade_width * 2.5, edge_material, 4)
    cube(collection, root, "Fuller", (0, -0.052, blade_center), (blade_width * 0.28, 0.012, blade_length * 0.4), MATERIALS["dark_iron"] if not colored else MATERIALS["blue_bright"], edge=0.008)
    guard_width = 0.62 if great else 0.48 if two else 0.38
    cube(collection, root, "Crossguard", (0, 0, -0.02), (guard_width, 0.075, 0.07), trim, rotation=(0, 0, 0.05 if golden else 0), edge=0.04)
    if great:
        for side in (-1, 1):
            cube(collection, root, f"SideLug_{side}", (side * 0.22, 0, 0.2), (0.11, 0.065, 0.07), trim, rotation=(0, 0, side * 0.28), edge=0.03)
    cylinder(collection, root, "GripCore", (0, 0, -grip_length * 0.55), 0.075 if two else 0.065, grip_length, MATERIALS["wood"], 8)
    wrap_grip(collection, root, -grip_length, -0.16, 0.088 if two else 0.078, MATERIALS["cloth"] if colored else MATERIALS["leather"], 8 if two else 5)
    cylinder(collection, root, "GripFerrule", (0, 0, -0.13), 0.1, 0.09, trim, 8)
    ico(collection, root, "Pommel", (0, 0, -grip_length - 0.12), (0.13 if two else 0.11,) * 3, MATERIALS["crystal"] if golden else trim, 1)
    add_rivets(collection, root, [(-guard_width * 0.75, 0, -0.02), (guard_width * 0.75, 0, -0.02)], golden)


def build_bow(specification, collection, root):
    golden = "golden" in specification.id
    strung = specification.id == "strung_bow"
    limb = MATERIALS["gold"] if golden else MATERIALS["wood_light"]
    core = MATERIALS["wood"]
    points_left = [(0, 0, -0.58), (-0.22, 0, -0.36), (-0.35, 0, 0), (-0.26, 0, 0.42), (-0.08, 0, 0.7)]
    points_right = [(0, 0, -0.58), (0.22, 0, -0.36), (0.35, 0, 0), (0.26, 0, 0.42), (0.08, 0, 0.7)]
    for prefix, points in (("Left", points_left), ("Right", points_right)):
        for index in range(len(points) - 1):
            between(collection, root, f"{prefix}Limb_{index}", points[index], points[index + 1], 0.055, core if index in (1, 2) else limb, 7)
    cube(collection, root, "WrappedRiser", (0, 0, 0.02), (0.1, 0.085, 0.24), MATERIALS["leather"], edge=0.04)
    for z in (-0.52, 0.62):
        cylinder(collection, root, f"TipCap_{z}", (0, 0, z), 0.075, 0.12, MATERIALS["gold"] if golden else MATERIALS["bone"], 8)
    string_mat = MATERIALS["gold_bright"] if golden else MATERIALS["edge"]
    between(collection, root, "StringLeft", (-0.0, 0.02, -0.64), (-0.02 if strung else -0.12, -0.02, 0.02), 0.012, string_mat, 4)
    between(collection, root, "StringRight", (-0.02 if strung else -0.12, -0.02, 0.02), (0, 0.02, 0.76), 0.012, string_mat, 4)
    wrap_grip(collection, root, -0.13, 0.17, 0.115, MATERIALS["cloth"] if strung else MATERIALS["leather"], 5)
    add_rivets(collection, root, [(0, -0.1, -0.17), (0, -0.1, 0.2)], golden)


def build_crossbow(specification, collection, root):
    heavy = "two_handed" in specification.id
    stock_length = 1.32 if heavy else 0.9
    limb_width = 0.72 if heavy else 0.5
    cube(collection, root, "Stock", (0, 0, 0.05), (0.1 if heavy else 0.085, 0.1, stock_length * 0.5), MATERIALS["wood"], edge=0.045)
    cube(collection, root, "BoltGroove", (0, -0.105, 0.18), (0.035, 0.018, stock_length * 0.36), MATERIALS["dark_iron"], edge=0.01)
    between(collection, root, "LeftLimb", (0, 0, 0.42), (-limb_width, 0, 0.22), 0.055 if heavy else 0.045, MATERIALS["steel"], 7)
    between(collection, root, "RightLimb", (0, 0, 0.42), (limb_width, 0, 0.22), 0.055 if heavy else 0.045, MATERIALS["steel"], 7)
    between(collection, root, "StringLeft", (-limb_width, -0.01, 0.22), (0, -0.04, 0.08), 0.012, MATERIALS["edge"], 4)
    between(collection, root, "StringRight", (0, -0.04, 0.08), (limb_width, -0.01, 0.22), 0.012, MATERIALS["edge"], 4)
    cube(collection, root, "TriggerHousing", (0, 0.04, -0.18), (0.16, 0.12, 0.16), MATERIALS["dark_iron"], edge=0.045)
    torus(collection, root, "Trigger", (0, -0.13, -0.2), 0.11, 0.018, MATERIALS["brass"], rotation=(math.pi / 2, 0, 0), segments=10)
    torus(collection, root, "FootStirrup", (0, 0, stock_length * 0.52), 0.18 if heavy else 0.13, 0.025, MATERIALS["iron"], rotation=(math.pi / 2, 0, 0), segments=12)
    cylinder(collection, root, "PistolGrip", (0, 0.08, -0.42), 0.065, 0.34, MATERIALS["leather"], 8, rotation=(0.25, 0, 0))
    if heavy:
        for side in (-1, 1):
            cylinder(collection, root, f"WindingGear_{side}", (side * 0.17, 0, -0.02), 0.12, 0.07, MATERIALS["brass"], 10, rotation=(math.pi / 2, 0, 0))


def build_dart(specification, collection, root):
    golden = "golden" in specification.id
    trim = MATERIALS["gold"] if golden else MATERIALS["brass"]
    cylinder(collection, root, "WeightedShaft", (0, 0, 0), 0.035, 0.7, trim if golden else MATERIALS["dark_iron"], 8)
    cone(collection, root, "NeedleTip", (0, 0, 0.48), 0.07, 0.32, MATERIALS["gold_bright"] if golden else MATERIALS["edge"], 4)
    cylinder(collection, root, "BalanceCollar", (0, 0, 0.16), 0.07, 0.12, trim, 8)
    for side in (-1, 1):
        cube(collection, root, f"FlightX_{side}", (side * 0.08, 0, -0.31), (0.08, 0.018, 0.16), MATERIALS["cloth"] if not golden else MATERIALS["gold_bright"], rotation=(0, side * 0.25, 0), edge=0.012)
        cube(collection, root, f"FlightY_{side}", (0, side * 0.08, -0.31), (0.018, 0.08, 0.16), MATERIALS["blue"] if not golden else MATERIALS["gold"], rotation=(side * 0.25, 0, 0), edge=0.012)


def build_staff(specification, collection, root):
    cylinder(collection, root, "StaffShaft", (0, 0, 0), 0.07, 1.52, MATERIALS["wood"], 8)
    wrap_grip(collection, root, -0.55, -0.12, 0.083, MATERIALS["leather"], 7)
    cylinder(collection, root, "LowerFerrule", (0, 0, -0.7), 0.1, 0.18, MATERIALS["brass"], 8)
    for side in (-1, 1):
        between(collection, root, f"CageArm_{side}", (0, 0, 0.58), (side * 0.28, 0, 0.88), 0.045, MATERIALS["brass"], 6)
        between(collection, root, f"CageReturn_{side}", (side * 0.28, 0, 0.88), (side * 0.12, 0, 1.08), 0.035, MATERIALS["steel"], 6)
    ico(collection, root, "CrystalCore", (0, 0, 0.92), (0.18, 0.18, 0.3), MATERIALS["crystal_bright"], 1, rotation=(0.2, 0.4, 0.1))
    torus(collection, root, "RuneRingA", (0, 0, 0.92), 0.34, 0.025, MATERIALS["purple"], rotation=(math.pi / 2, 0.3, 0), segments=14)
    torus(collection, root, "RuneRingB", (0, 0, 0.92), 0.27, 0.02, MATERIALS["crystal"], rotation=(math.pi / 2, -0.3, math.pi / 2), segments=12)
    add_rivets(collection, root, [(0, -0.09, 0.5), (0, 0.09, 0.5)])


def build_wand(specification, collection, root):
    cylinder(collection, root, "SpiralWoodCore", (0, 0, -0.05), 0.045, 0.68, MATERIALS["wood"], 8)
    for i in range(7):
        z = -0.32 + i * 0.09
        angle = i * 0.8
        cube(collection, root, f"SpiralInlay_{i}", (math.cos(angle) * 0.052, math.sin(angle) * 0.052, z), (0.018, 0.018, 0.06), MATERIALS["brass"], rotation=(0, 0, angle), edge=0.008)
    cylinder(collection, root, "SilverFerrule", (0, 0, 0.31), 0.075, 0.15, MATERIALS["steel"], 8)
    ico(collection, root, "GemTip", (0, 0, 0.55), (0.13, 0.13, 0.22), MATERIALS["crystal_bright"], 1, rotation=(0.2, 0.25, 0.1))
    torus(collection, root, "FloatingRune", (0, 0, 0.66), 0.19, 0.018, MATERIALS["purple"], rotation=(math.pi / 2, 0.25, 0), segments=10)
    wrap_grip(collection, root, -0.39, -0.18, 0.06, MATERIALS["leather"], 4)


def book_corner(collection, root, name, x, y, z, material):
    cube(collection, root, name, (x, y, z), (0.08, 0.04, 0.08), material, edge=0.025)


def build_book(specification, collection, root):
    opened = specification.id.endswith("open")
    if opened:
        for side in (-1, 1):
            cube(collection, root, f"PageBlock_{side}", (side * 0.25, 0, 0.04), (0.24, 0.055, 0.34), MATERIALS["parchment"], rotation=(0, side * 0.16, 0), edge=0.035)
            cube(collection, root, f"GlowingPage_{side}", (side * 0.25, -0.06, 0.04), (0.21, 0.012, 0.3), MATERIALS["page_glow"], rotation=(0, side * 0.16, 0), edge=0.008)
        cylinder(collection, root, "Spine", (0, 0.04, 0.04), 0.055, 0.7, MATERIALS["leather"], 8)
        for i in range(5):
            cube(collection, root, f"Glyph_{i}", ((i - 2) * 0.09, -0.085, 0.06 + math.sin(i) * 0.08), (0.025, 0.01, 0.045), MATERIALS["purple"], rotation=(0, 0, i * 0.4), edge=0.006)
        for side in (-1, 1):
            for x in (-0.42, -0.08) if side < 0 else (0.08, 0.42):
                book_corner(collection, root, f"Corner_{side}_{x}", x, 0, -0.27 if x < 0 else 0.27, MATERIALS["brass"])
    else:
        cube(collection, root, "PageBlock", (0, 0, 0.02), (0.34, 0.1, 0.45), MATERIALS["parchment"], edge=0.06)
        cube(collection, root, "FrontCover", (0, -0.13, 0.02), (0.38, 0.045, 0.49), MATERIALS["leather"], edge=0.055)
        cube(collection, root, "BackCover", (0, 0.13, 0.02), (0.38, 0.045, 0.49), MATERIALS["leather"], edge=0.055)
        cylinder(collection, root, "Spine", (-0.39, 0, 0.02), 0.075, 0.98, MATERIALS["dark_iron"], 8)
        cube(collection, root, "RaisedGlyph", (0, -0.18, 0.03), (0.16, 0.025, 0.16), MATERIALS["purple"], rotation=(0, 0, math.pi / 4), edge=0.025)
        cube(collection, root, "Clasp", (0.36, -0.16, 0.02), (0.1, 0.035, 0.12), MATERIALS["brass"], edge=0.025)
        for x in (-0.3, 0.3):
            for z in (-0.4, 0.4):
                book_corner(collection, root, f"Corner_{x}_{z}", x, -0.17, z, MATERIALS["brass"])
    for i, x in enumerate((-0.12, 0, 0.12)):
        cube(collection, root, f"Bookmark_{i}", (x, 0.12, -0.43 - i * 0.03), (0.025, 0.02, 0.16), MATERIALS["cloth"] if i != 1 else MATERIALS["blue"], edge=0.008)


def build_scroll(specification, collection, root):
    cube(collection, root, "Parchment", (0, 0, 0), (0.24, 0.035, 0.42), MATERIALS["parchment"], edge=0.035)
    for z in (-0.46, 0.46):
        cylinder(collection, root, f"EndCap_{z}", (0, 0, z), 0.075, 0.58, MATERIALS["wood_light"], 8, rotation=(0, math.pi / 2, 0))
        cylinder(collection, root, f"MetalCap_{z}", (-0.32, 0, z), 0.09, 0.08, MATERIALS["brass"], 8, rotation=(0, math.pi / 2, 0))
        cylinder(collection, root, f"MetalCapR_{z}", (0.32, 0, z), 0.09, 0.08, MATERIALS["brass"], 8, rotation=(0, math.pi / 2, 0))
    cube(collection, root, "Ribbon", (0, -0.07, -0.12), (0.035, 0.025, 0.38), MATERIALS["cloth"], edge=0.012)
    ico(collection, root, "WaxSeal", (0, -0.1, -0.2), (0.1, 0.035, 0.1), MATERIALS["cloth"], 1)
    for i in range(5):
        cube(collection, root, f"GlowingText_{i}", (0, -0.055, 0.26 - i * 0.12), (0.16 - i * 0.01, 0.008, 0.012), MATERIALS["page_glow"], edge=0.004)


def build_focus(specification, collection, root):
    if specification.id == "crystal_focus":
        for i, (x, y, z, scale) in enumerate(((-0.16, 0, 0, 0.25), (0.14, 0.06, 0.04, 0.22), (0, -0.08, 0.18, 0.3))):
            ico(collection, root, f"Crystal_{i}", (x, y, z), (scale * 0.55, scale * 0.55, scale), MATERIALS["crystal_bright"] if i == 2 else MATERIALS["crystal"], 1, rotation=(i * 0.3, i * 0.25, i * 0.4))
        torus(collection, root, "SilverCage", (0, 0, 0.02), 0.38, 0.025, MATERIALS["steel"], rotation=(math.pi / 2, 0.3, 0), segments=12)
        for i in range(5):
            angle = math.tau * i / 5
            ico(collection, root, f"OrbitChip_{i}", (math.cos(angle) * 0.42, math.sin(angle) * 0.42, 0.02), (0.05, 0.05, 0.09), MATERIALS["crystal"], 1)
    elif specification.id == "star_focus":
        ico(collection, root, "NightCore", (0, 0, 0), (0.24, 0.24, 0.24), MATERIALS["night"], 1)
        for i in range(8):
            angle = math.tau * i / 8
            cone(collection, root, f"StarPoint_{i}", (math.cos(angle) * 0.27, math.sin(angle) * 0.27, 0), 0.09, 0.4 if i % 2 == 0 else 0.28, MATERIALS["gold_bright"] if i % 2 == 0 else MATERIALS["crystal"], 4, rotation=(math.pi / 2, angle + math.pi / 2, 0))
        torus(collection, root, "CelestialOrbit", (0, 0, 0), 0.46, 0.025, MATERIALS["brass"], rotation=(math.pi / 2, 0.4, 0.2), segments=16)
    else:
        ico(collection, root, "FrostCore", (0, 0, 0), (0.18, 0.18, 0.18), MATERIALS["crystal_bright"], 1)
        for i in range(6):
            angle = math.tau * i / 6
            end = (math.cos(angle) * 0.5, math.sin(angle) * 0.5, 0)
            between(collection, root, f"SnowArm_{i}", (0, 0, 0), end, 0.035, MATERIALS["frost"], 4)
            for branch in (-1, 1):
                branch_angle = angle + branch * 0.5
                start = (math.cos(angle) * 0.3, math.sin(angle) * 0.3, 0)
                branch_end = (start[0] + math.cos(branch_angle) * 0.18, start[1] + math.sin(branch_angle) * 0.18, 0)
                between(collection, root, f"SnowBranch_{i}_{branch}", start, branch_end, 0.022, MATERIALS["crystal"], 4)


def build_smoke(specification, collection, root):
    ico(collection, root, "CeramicShell", (0, 0, 0), (0.3, 0.3, 0.32), MATERIALS["black"], 2)
    torus(collection, root, "UpperBand", (0, 0, 0.13), 0.29, 0.035, MATERIALS["iron"], rotation=(math.pi / 2, 0, 0), segments=12)
    torus(collection, root, "LowerBand", (0, 0, -0.13), 0.29, 0.035, MATERIALS["iron"], rotation=(math.pi / 2, 0, 0), segments=12)
    cylinder(collection, root, "ImpactCap", (0, 0, -0.32), 0.14, 0.13, MATERIALS["dark_iron"], 8)
    cylinder(collection, root, "FuseSocket", (0, 0, 0.32), 0.11, 0.15, MATERIALS["brass"], 8)
    between(collection, root, "Fuse", (0, 0, 0.4), (0.12, 0.04, 0.62), 0.025, MATERIALS["cloth"], 6)
    wrap_grip(collection, root, -0.18, 0.18, 0.32, MATERIALS["cloth"], 4)
    for i in range(5):
        angle = math.tau * i / 5
        cylinder(collection, root, f"Vent_{i}", (math.cos(angle) * 0.25, math.sin(angle) * 0.25, 0.18), 0.025, 0.04, MATERIALS["steel"], 6, rotation=(math.pi / 2, 0, angle))


def add_energy_weapon_grip(collection, root, z=-0.28, long=False):
    grip_depth = 0.52 if long else 0.42
    grip_angle = 0.38 if long else 0.46
    cube(collection, root, "InsulatedGripCore", (0, -0.075, z), (0.085 if long else 0.078, 0.09, grip_depth * 0.5), MATERIALS["black"], rotation=(grip_angle, 0, 0), edge=0.035)
    rib_count = 6 if long else 5
    for index in range(rib_count):
        t = (index + 0.5) / rib_count - 0.5
        cube(collection, root, f"GripRib_{index}", (0, -0.075 - math.sin(grip_angle) * t * grip_depth, z + math.cos(grip_angle) * t * grip_depth), (0.095 if long else 0.087, 0.102, 0.018), MATERIALS["leather"], rotation=(grip_angle, 0, 0), edge=0.01)
    torus(collection, root, "TriggerGuard", (0, -0.115, z + grip_depth * 0.42), 0.105, 0.018, MATERIALS["brass"], rotation=(math.pi / 2, 0, 0), segments=10)


def add_energy_weapon_rails(collection, root, z0, z1, width, material):
    for side in (-1, 1):
        cube(collection, root, f"SideRail_{side}", (side * width, 0.0, (z0 + z1) * 0.5), (0.025, 0.13, (z1 - z0) * 0.5), material, edge=0.014)
        for index in range(4):
            z = z0 + (z1 - z0) * (index + 0.5) / 4
            cube(collection, root, f"RailNotch_{side}_{index}", (side * (width + 0.035), -0.13, z), (0.035, 0.018, 0.025), MATERIALS["steel"], edge=0.008)


def build_energy_weapon(specification, collection, root):
    item_id = specification.id
    shell = MATERIALS["dark_iron"]
    frame = MATERIALS["steel"]
    trim = MATERIALS["brass"]

    if item_id == "photon_sidearm":
        glow = MATERIALS["energy_blue"]
        add_energy_weapon_grip(collection, root, z=-0.31)
        cube(collection, root, "CompactReceiver", (0, 0, 0.1), (0.16, 0.13, 0.31), shell, edge=0.055)
        cube(collection, root, "ReceiverArmor", (0, 0.0, 0.13), (0.19, 0.105, 0.2), frame, edge=0.05)
        cylinder(collection, root, "PhotonBarrel", (0, 0, 0.46), 0.085, 0.48, MATERIALS["iron"], 10)
        torus(collection, root, "BlueMuzzleCrown", (0, 0, 0.73), 0.105, 0.028, glow, segments=12)
        cube(collection, root, "TopSight", (0, -0.145, 0.31), (0.035, 0.025, 0.15), trim, edge=0.012)
        cube(collection, root, "CapacitorWindow", (0, -0.145, 0.06), (0.095, 0.018, 0.12), glow, edge=0.018)
        cylinder(collection, root, "RearCell", (0, 0, -0.11), 0.12, 0.13, glow, 10)
        add_rivets(collection, root, [(-0.13, -0.13, 0.05), (0.13, -0.13, 0.05)], False)
        return

    if item_id == "pulse_carbine":
        glow = MATERIALS["energy_cyan"]
        add_energy_weapon_grip(collection, root, z=-0.27, long=True)
        cube(collection, root, "CarbineReceiver", (0, 0, 0.16), (0.2, 0.16, 0.42), shell, edge=0.065)
        cube(collection, root, "ShoulderStock", (0, 0.04, -0.48), (0.18, 0.13, 0.28), MATERIALS["iron"], edge=0.07)
        cube(collection, root, "StockPad", (0, 0.05, -0.76), (0.21, 0.16, 0.055), MATERIALS["leather"], edge=0.035)
        cylinder(collection, root, "BurstBarrel", (0, 0, 0.64), 0.105, 0.62, MATERIALS["steel"], 10)
        for side in (-1, 0, 1):
            cylinder(collection, root, f"PulsePort_{side}", (side * 0.095, -0.03, 0.98), 0.052, 0.13, glow, 8)
        cube(collection, root, "CyanChargeStrip", (0, -0.175, 0.16), (0.13, 0.018, 0.29), glow, edge=0.014)
        add_energy_weapon_rails(collection, root, -0.02, 0.54, 0.22, trim)
        cube(collection, root, "TopCarryRail", (0, 0.0, 0.37), (0.055, 0.2, 0.28), frame, edge=0.025)
        add_rivets(collection, root, [(-0.17, -0.17, -0.06), (0.17, -0.17, -0.06), (-0.17, -0.17, 0.35), (0.17, -0.17, 0.35)], False)
        return

    if item_id == "helix_projector":
        glow = MATERIALS["energy_green"]
        add_energy_weapon_grip(collection, root, z=-0.34, long=True)
        cube(collection, root, "ProjectorReceiver", (0, 0, 0.05), (0.22, 0.18, 0.42), shell, edge=0.07)
        cube(collection, root, "ProjectorStock", (0, 0.05, -0.58), (0.2, 0.14, 0.31), MATERIALS["iron"], edge=0.075)
        cube(collection, root, "StockCheek", (0, -0.13, -0.52), (0.14, 0.045, 0.2), MATERIALS["leather"], edge=0.025)
        for side in (-1, 1):
            cylinder(collection, root, f"TwinEmitter_{side}", (side * 0.13, 0, 0.68), 0.085, 0.9, frame, 10)
            cylinder(collection, root, f"EmitterCore_{side}", (side * 0.13, 0, 0.72), 0.045, 0.84, glow, 8)
        for index, z in enumerate((0.34, 0.58, 0.82, 1.05)):
            torus(collection, root, f"HelixCage_{index}", (0, 0, z), 0.22, 0.025, trim if index % 2 else glow, segments=14)
        for index in range(8):
            angle = index * math.pi / 3
            z = 0.33 + index * 0.1
            between(collection, root, f"HelicalConductor_{index}", (math.cos(angle) * 0.16, math.sin(angle) * 0.16, z), (math.cos(angle + math.pi / 3) * 0.16, math.sin(angle + math.pi / 3) * 0.16, z + 0.12), 0.018, glow, 6)
        cube(collection, root, "GreenPowerCell", (0, -0.19, -0.02), (0.12, 0.025, 0.23), glow, edge=0.018)
        add_energy_weapon_rails(collection, root, -0.18, 0.26, 0.24, trim)
        return

    if item_id == "nova_cannon":
        glow = MATERIALS["energy_orange"]
        add_energy_weapon_grip(collection, root, z=-0.42, long=True)
        cube(collection, root, "SiegeReceiver", (0, 0, 0.02), (0.3, 0.24, 0.5), shell, edge=0.09)
        cube(collection, root, "RecoilStock", (0, 0.06, -0.72), (0.28, 0.19, 0.34), MATERIALS["iron"], edge=0.09)
        cube(collection, root, "ShockPad", (0, 0.07, -1.03), (0.31, 0.21, 0.075), MATERIALS["leather"], edge=0.045)
        cylinder(collection, root, "PlasmaChamber", (0, 0, 0.46), 0.25, 0.48, glow, 12)
        torus(collection, root, "ChamberBraceRear", (0, 0, 0.3), 0.29, 0.045, trim, segments=14)
        torus(collection, root, "ChamberBraceFront", (0, 0, 0.63), 0.29, 0.045, trim, segments=14)
        cylinder(collection, root, "HeavyBarrel", (0, 0, 0.9), 0.17, 0.72, frame, 12)
        torus(collection, root, "OrangeMuzzle", (0, 0, 1.28), 0.2, 0.055, glow, segments=14)
        for side in (-1, 1):
            cube(collection, root, f"HeatFin_{side}", (side * 0.31, 0, 0.77), (0.06, 0.22, 0.32), MATERIALS["iron"], rotation=(0, side * 0.08, 0), edge=0.025)
            between(collection, root, f"ReceiverBrace_{side}", (side * 0.23, 0, -0.35), (side * 0.31, 0, 0.77), 0.035, trim, 7)
        for index in range(5):
            cube(collection, root, f"CoolingVent_{index}", ((index - 2) * 0.105, -0.255, -0.08), (0.035, 0.018, 0.22), glow if index == 2 else MATERIALS["steel"], edge=0.01)
        add_rivets(collection, root, [(-0.25, -0.24, -0.32), (0.25, -0.24, -0.32), (-0.25, -0.24, 0.2), (0.25, -0.24, 0.2)], False)
        return

    glow = MATERIALS["energy_white"]
    violet = MATERIALS["energy_violet"]
    add_energy_weapon_grip(collection, root, z=-0.48, long=True)
    cube(collection, root, "LanceReceiver", (0, 0, -0.08), (0.24, 0.2, 0.52), shell, edge=0.075)
    cube(collection, root, "CounterweightedStock", (0, 0.05, -0.84), (0.22, 0.16, 0.32), MATERIALS["iron"], edge=0.08)
    ico(collection, root, "ContainedSingularity", (0, 0, 0.42), (0.22, 0.22, 0.22), MATERIALS["black"], 2)
    ico(collection, root, "WhiteEventCore", (0, 0, 0.42), (0.085, 0.085, 0.085), glow, 1)
    for index, rotation in enumerate(((0, 0, 0), (math.pi / 2, 0, 0), (0, math.pi / 2, 0))):
        torus(collection, root, f"ContainmentOrbit_{index}", (0, 0, 0.42), 0.31 + index * 0.025, 0.025, violet if index != 1 else glow, rotation=rotation, segments=16)
    cylinder(collection, root, "LanceSpine", (0, 0, 0.92), 0.095, 0.86, frame, 10)
    cylinder(collection, root, "LanceCore", (0, 0, 0.95), 0.045, 0.9, glow, 8)
    for side in (-1, 1):
        between(collection, root, f"FocusingProng_{side}", (side * 0.2, 0, 0.56), (side * 0.12, 0, 1.38), 0.045, MATERIALS["steel"], 8)
        cone(collection, root, f"ProngTip_{side}", (side * 0.12, 0, 1.48), 0.065, 0.26, violet, 5)
    torus(collection, root, "VioletMuzzleGate", (0, 0, 1.36), 0.18, 0.035, violet, segments=16)
    cube(collection, root, "ChargeMeter", (0, -0.215, -0.08), (0.13, 0.022, 0.3), glow, edge=0.016)
    add_energy_weapon_rails(collection, root, -0.48, 0.15, 0.25, violet)
    add_rivets(collection, root, [(-0.2, -0.2, -0.38), (0.2, -0.2, -0.38), (-0.2, -0.2, 0.12), (0.2, -0.2, 0.12)], True)


def shield_disc(collection, root, radius, material, thickness=0.12):
    cylinder(collection, root, "ShieldBody", (0, 0, 0), radius, thickness, material, 20, rotation=(math.pi / 2, 0, 0), edge=0.05)


def build_shield(specification, collection, root):
    text = specification.id
    colored = "colored" in text
    barbarian = "barbarian" in text
    spiked = "spiked" in text
    square = "square" in text
    badge = "badge" in text
    face = MATERIALS["blue"] if colored else MATERIALS["wood"]
    rim = MATERIALS["gold"] if colored else MATERIALS["iron"]
    if square:
        cube(collection, root, "ShieldBody", (0, 0, 0), (0.48, 0.07, 0.62), face, edge=0.08)
        for x in (-0.45, 0.45):
            cube(collection, root, f"EdgeBandX_{x}", (x, -0.08, 0), (0.055, 0.035, 0.58), rim, edge=0.025)
        for z in (-0.58, 0.58):
            cube(collection, root, f"EdgeBandZ_{z}", (0, -0.08, z), (0.45, 0.035, 0.055), rim, edge=0.025)
        for x in (-0.26, 0.26):
            cube(collection, root, f"BoardSeam_{x}", (x, -0.075, 0), (0.012, 0.018, 0.55), MATERIALS["dark_iron"], edge=0.006)
    else:
        shield_disc(collection, root, 0.56, face)
        torus(collection, root, "IronRim", (0, -0.075, 0), 0.52, 0.055, rim, rotation=(math.pi / 2, 0, 0), segments=20)
        for seam_index, angle in enumerate((0, math.pi / 2)):
            cube(collection, root, f"PlankSeam_{seam_index}", (0, -0.073, 0), (0.012, 0.015, 0.46), MATERIALS["dark_iron"], rotation=(0, angle, 0), edge=0.005)
    cylinder(collection, root, "CentralBoss", (0, -0.13, 0), 0.18, 0.16, MATERIALS["steel"] if not colored else MATERIALS["gold_bright"], 12, rotation=(math.pi / 2, 0, 0), edge=0.045)
    if barbarian:
        torus(collection, root, "FurCollar", (0, -0.11, 0), 0.43, 0.09, MATERIALS["fur"], rotation=(math.pi / 2, 0, 0), segments=12)
        for i in range(4):
            angle = math.tau * i / 4 + math.pi / 4
            cone(collection, root, f"BoneTusk_{i}", (math.cos(angle) * 0.42, -0.14, math.sin(angle) * 0.42), 0.07, 0.28, MATERIALS["bone"], 5, rotation=(math.pi / 2, angle, 0))
    if spiked:
        for i in range(8):
            angle = math.tau * i / 8
            cone(collection, root, f"Spike_{i}", (math.cos(angle) * 0.42, -0.23, math.sin(angle) * 0.42), 0.08, 0.34, MATERIALS["steel"], 5, rotation=(math.pi / 2, 0, angle))
    if badge:
        cube(collection, root, "HeraldicBadge", (0, -0.2, 0.02), (0.22, 0.035, 0.3), MATERIALS["gold"] if colored else MATERIALS["brass"], edge=0.07)
        cone(collection, root, "BadgeCrown", (0, -0.21, 0.36), 0.18, 0.24, MATERIALS["gold_bright"] if colored else MATERIALS["steel"], 3)
    # Back construction matters because carried shields are normally seen from behind.
    cube(collection, root, "BackReinforcement", (0, 0.12, 0), (0.4, 0.035, 0.08), MATERIALS["dark_iron"], edge=0.025)
    for x in (-0.24, 0.24):
        torus(collection, root, f"BackStrap_{x}", (x, 0.19, 0), 0.18, 0.035, MATERIALS["leather"], rotation=(math.pi / 2, 0, 0), segments=10)
    cylinder(collection, root, "HandGrip", (0, 0.26, 0), 0.045, 0.42, MATERIALS["leather"], 8, rotation=(0, math.pi / 2, 0))
    add_rivets(collection, root, [(-0.4, -0.13, 0), (0.4, -0.13, 0), (0, -0.13, -0.4), (0, -0.13, 0.4)], colored)


BUILDERS: Dict[str, Callable] = {
    "axe": build_axe,
    "dagger": build_dagger,
    "hammer": build_hammer,
    "sword": build_sword,
    "bow": build_bow,
    "crossbow": build_crossbow,
    "dart": build_dart,
    "staff": build_staff,
    "wand": build_wand,
    "book": build_book,
    "scroll": build_scroll,
    "focus": build_focus,
    "smoke": build_smoke,
    "energy_weapon": build_energy_weapon,
    "shield": build_shield,
}


def animate(root, specification):
    root.animation_data_create()
    action = bpy.data.actions.new(
        f"{specification.id}__{specification.idle_clip}"
    )
    action["harthmereExportClip"] = specification.idle_clip
    root.animation_data.action = action
    root.rotation_mode = "XYZ"
    root.rotation_euler = (0, 0, 0)
    root.scale = (1, 1, 1)
    root.keyframe_insert("rotation_euler", frame=1)
    root.keyframe_insert("scale", frame=1)
    if specification.profile in ("magic", "magicBook"):
        root.rotation_euler.z = math.radians(3)
        root.rotation_euler.y = math.radians(-4)
        root.scale = (1.025, 1.025, 1.025)
    elif specification.profile == "thrown":
        root.rotation_euler.z = math.radians(8)
        root.scale = (1.015, 1.015, 1.015)
    elif specification.profile == "shield":
        root.rotation_euler.y = math.radians(3)
        root.scale = (1.01, 1.01, 1.01)
    else:
        root.rotation_euler.y = math.radians(2)
        root.rotation_euler.z = math.radians(-2)
        root.scale = (1.01, 1.01, 1.01)
    root.keyframe_insert("rotation_euler", frame=13)
    root.keyframe_insert("scale", frame=13)
    root.rotation_euler = (0, 0, 0)
    root.scale = (1, 1, 1)
    root.keyframe_insert("rotation_euler", frame=25)
    root.keyframe_insert("scale", frame=25)


def make_weapon(specification):
    print(f"Building {specification.id}", flush=True)
    collection = bpy.data.collections.new(f"Weapon_{specification.id}")
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new(f"WeaponRoot_{specification.id}", None)
    root.empty_display_type = "ARROWS"
    root["harthmereItemId"] = specification.id
    root["harthmereWeaponProfile"] = specification.profile
    root["harthmereTargetLength"] = specification.target_length
    collection.objects.link(root)
    BUILDERS[specification.builder](specification, collection, root)
    print(f"Built geometry for {specification.id}", flush=True)
    animate(root, specification)
    print(f"Animated {specification.id}", flush=True)
    return collection, root


def select_tree(root):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root


def export_glb(root, path, specification):
    select_tree(root)
    action = root.animation_data.action if root.animation_data else None
    original_action_name = action.name if action else None
    if action:
        action.name = specification.idle_clip
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(path),
            export_format="GLB",
            use_selection=True,
            export_animations=True,
            export_frame_range=True,
            export_yup=True,
            export_apply=False,
            export_materials="EXPORT",
            export_cameras=False,
            export_lights=False,
        )
    finally:
        if action and original_action_name:
            action.name = original_action_name


def triangle_count(root):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in [root, *root.children_recursive]:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def bounds(root):
    points = []
    for obj in [root, *root.children_recursive]:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    return {
        "min": [min(point[i] for point in points) for i in range(3)],
        "max": [max(point[i] for point in points) for i in range(3)],
    }


def look_at(obj, target=(0, 0, 0)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_preview(size):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.world.color = (0.007, 0.009, 0.015)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.25
    bpy.ops.object.camera_add(location=(4.1, -6.3, 3.0))
    camera = bpy.context.object
    camera.data.lens = 60
    look_at(camera)
    scene.camera = camera
    for name, location, energy, color, size_value in (
        ("Key", (3.8, -3.5, 5.2), 420, (0.78, 0.88, 1.0), 3.2),
        ("Rim", (-3.8, 1.5, 3.5), 520, (0.35, 0.58, 1.0), 2.6),
        ("Warm", (1.0, 2.5, -1.8), 300, (1.0, 0.55, 0.28), 2.2),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = f"Preview{name}"
        light.data.energy = energy
        light.data.color = color
        light.data.shape = "DISK"
        light.data.size = size_value
        look_at(light)


def render_preview(root, specification, path, *, transparent=False, size=None):
    for collection in bpy.data.collections:
        if collection.name.startswith("Weapon_"):
            collection.hide_render = collection != root.users_collection[0]
    scene = bpy.context.scene
    previous_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    previous_transparency = scene.render.film_transparent
    if size is not None:
        scene.render.resolution_x = size
        scene.render.resolution_y = size
    scene.render.film_transparent = transparent
    preview_action = root.animation_data.action if root.animation_data else None
    if root.animation_data:
        root.animation_data.action = None
    scene.frame_set(9)
    current_bounds = bounds(root)
    dimensions = [
        current_bounds["max"][axis] - current_bounds["min"][axis]
        for axis in range(3)
    ]
    preview_scale = 3.45 / max(dimensions)
    root.location = (0, 0, 0)
    preview_yaw = {
        "melee": -10,
        "thrown": -12,
        "ranged": -20,
        "magic": -22,
        "magicBook": -20,
        "shield": -18,
    }[specification.profile]
    root.rotation_euler = (
        math.radians(34 if specification.builder == "energy_weapon" else 14),
        math.radians(-38 if specification.builder == "energy_weapon" else preview_yaw),
        math.radians(26 if specification.builder == "energy_weapon" else 14),
    )
    root.scale = (preview_scale, preview_scale, preview_scale)
    bpy.context.view_layer.update()
    framed_bounds = bounds(root)
    frame_center = Vector(
        tuple(
            (framed_bounds["min"][axis] + framed_bounds["max"][axis]) * 0.5
            for axis in range(3)
        )
    )
    root.location -= frame_center
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    root.scale = (1, 1, 1)
    if root.animation_data:
        root.animation_data.action = preview_action
    scene.render.resolution_x, scene.render.resolution_y = previous_resolution
    scene.render.film_transparent = previous_transparency
    for collection in bpy.data.collections:
        collection.hide_render = False


def parse_args(argv: Sequence[str]):
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--preview-size", type=int, default=512)
    parser.add_argument("--skip-previews", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    return parser.parse_args(argv)


def main():
    separator = sys.argv.index("--") + 1 if "--" in sys.argv else len(sys.argv)
    args = parse_args(sys.argv[separator:])
    repo = Path(args.repo_root).resolve()
    output = repo / "public/assets/harthmere/glb/weapons"
    previews = repo / "public/assets/harthmere/weapon_previews"
    icons = repo / "public/assets/harthmere/weapon_icons"
    blend_path = repo / "src/galois/data/weapons/harthmere_premium_weapons.blend"
    output.mkdir(parents=True, exist_ok=True)
    previews.mkdir(parents=True, exist_ok=True)
    icons.mkdir(parents=True, exist_ok=True)
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    selected = [entry for entry in WEAPONS if not args.only or entry.id in args.only]
    unknown = sorted(set(args.only) - {entry.id for entry in WEAPONS})
    if unknown:
        raise ValueError(f"Unknown weapon ids: {', '.join(unknown)}")

    clean_scene()
    setup_preview(args.preview_size)
    generated = []
    columns = 7
    for index, specification in enumerate(selected):
        collection, root = make_weapon(specification)
        bpy.context.view_layer.update()
        path = output / f"{specification.id}.glb"
        print(f"Exporting {specification.id}", flush=True)
        export_glb(root, path, specification)
        print(f"Exported {specification.id}", flush=True)
        if not args.skip_previews:
            print(f"Rendering {specification.id}", flush=True)
            render_preview(root, specification, previews / f"{specification.id}.png")
            render_preview(
                root,
                specification,
                icons / f"{specification.id}.png",
                transparent=True,
                size=256,
            )
            print(f"Rendered {specification.id}", flush=True)
        generated.append(
            {
                "id": specification.id,
                "label": specification.label,
                "builder": specification.builder,
                "profile": specification.profile,
                "targetLength": specification.target_length,
                "idleClip": specification.idle_clip,
                "assetUrl": f"/assets/harthmere/glb/weapons/{specification.id}.glb",
                "previewUrl": f"/assets/harthmere/weapon_previews/{specification.id}.png",
                "inventoryIconUrl": f"/assets/harthmere/weapon_icons/{specification.id}.png",
                "triangleCount": triangle_count(root),
                "bounds": bounds(root),
                "bytes": path.stat().st_size,
            }
        )
        root.location = ((index % columns) * 2.8, (index // columns) * 2.8, 0)
        collection["harthmereWeaponLabel"] = specification.label

    manifest = {
        "version": "harthmere-premium-voxel-weapons-v1",
        "blenderVersion": bpy.app.version_string,
        "count": len(generated),
        "weapons": generated,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
