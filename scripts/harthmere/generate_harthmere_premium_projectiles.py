#!/usr/bin/env python3
"""Generate Harthmere's premium projectile collection in Blender 5.x.

This is a clean rebuild of the projectile art library. The models use the same
crafted voxel language as the premium weapon set: strong silhouettes, layered
materials, bevels, visible construction, controlled emissive accents, and one
repeatable flight-loop action per asset. All projectiles face +Z because the
runtime aligns +Z to the flight tangent.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Sequence, Tuple

import bpy
from mathutils import Vector


Vec3 = Tuple[float, float, float]
Color = Tuple[float, float, float, float]


@dataclass(frozen=True)
class ProjectileSpec:
    id: str
    label: str
    family: str
    builder: str
    target_size: float


PROJECTILES: Tuple[ProjectileSpec, ...] = (
    ProjectileSpec("hunter_bow_shot", "Hunter Bow Shot", "physical", "hunter_arrow", 1.0),
    ProjectileSpec("quick_shot", "Quick Shot", "physical", "quick_arrow", 1.42),
    ProjectileSpec("aimed_shot", "Aimed Shot", "physical", "aimed_arrow", 1.78),
    ProjectileSpec("multi_shot", "Multi-Shot", "physical", "multi_arrow", 1.65),
    ProjectileSpec("bandit_archer_shot", "Bandit Hedge Archer Shot", "physical", "bandit_arrow", 1.48),
    ProjectileSpec("ranged_shot", "Ranged Shot", "physical", "ranged_arrow", 1.52),
    ProjectileSpec("spark", "Spark", "arcane", "spark", 0.72),
    ProjectileSpec("fireball", "Fireball", "fire", "fireball", 0.96),
    ProjectileSpec("meteor", "Meteor", "fire", "meteor", 1.36),
    ProjectileSpec("lightning_bolt", "Lightning Bolt", "lightning", "lightning", 1.62),
    ProjectileSpec("holy_light", "Holy Light", "holy", "holy_lance", 1.18),
    ProjectileSpec("smite", "Smite", "holy", "smite", 1.28),
    ProjectileSpec("judgment", "Judgment", "holy", "judgment", 1.15),
    ProjectileSpec("consecrate", "Consecrate", "holy", "consecrate", 1.22),
    ProjectileSpec("life_drain", "Life Drain", "dark", "life_drain", 1.05),
    ProjectileSpec("entangling_roots", "Entangling Roots", "nature", "roots", 1.08),
    ProjectileSpec("indisworm_poison_spit", "Indisworm Poison Spit", "nature", "poison_spit", 0.92),
    ProjectileSpec("mocking_verse", "Mocking Verse", "sonic", "verse", 1.0),
    ProjectileSpec("curse_of_weakness", "Curse of Weakness", "dark", "curse", 1.0),
    ProjectileSpec("hunters_mark", "Hunter's Mark", "mark", "mark", 0.92),
    ProjectileSpec("polymorph", "Polymorph", "arcane", "polymorph", 0.96),
    ProjectileSpec("fear", "Fear", "dark", "fear", 1.12),
    ProjectileSpec("charm", "Charm", "arcane", "charm", 0.95),
    ProjectileSpec("hex_bolt", "Hex Caster Bolt", "hex", "hex", 1.08),
    ProjectileSpec("thaedryn_resonance", "Thaedryn Resonance Shard", "boss", "resonance", 1.5),
    ProjectileSpec("photon_sidearm_pulse", "Photon Sidearm Pulse", "energy", "energy", 0.72),
    ProjectileSpec("pulse_carbine_burst", "Pulse Carbine Burst", "energy", "energy", 0.84),
    ProjectileSpec("helix_projector_beam", "Helix Projector Beam", "energy", "energy", 1.05),
    ProjectileSpec("nova_cannon_bolt", "Nova Cannon Bolt", "energy", "energy", 1.52),
    ProjectileSpec("singularity_lance_beam", "Singularity Lance Beam", "gravity", "energy", 1.72),
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
    "edge": rgba(0xF4FAFF),
    "iron": rgba(0x4C5662),
    "dark_iron": rgba(0x1D232A),
    "gold": rgba(0xD6A52E),
    "gold_bright": rgba(0xFFF0A0),
    "brass": rgba(0x8F642C),
    "wood": rgba(0x6B4026),
    "wood_light": rgba(0xA36A38),
    "leather": rgba(0x34231D),
    "linen": rgba(0xD8D2BB),
    "red_cloth": rgba(0xA13C34),
    "blue": rgba(0x347EB7),
    "cyan": rgba(0x73E8FF),
    "white": rgba(0xF5FFFF),
    "arcane": rgba(0x8366E8),
    "arcane_dark": rgba(0x32265E),
    "fire": rgba(0xFF6A16),
    "fire_hot": rgba(0xFFF0A5),
    "ember": rgba(0xA92912),
    "rock": rgba(0x302C2C),
    "holy": rgba(0xFFE36D),
    "holy_white": rgba(0xFFFDE5),
    "blood": rgba(0xB53D62),
    "shadow": rgba(0x21152E),
    "purple": rgba(0x8C4ED8),
    "green": rgba(0x5FB94D),
    "green_bright": rgba(0xC9FF78),
    "root": rgba(0x5D3B24),
    "pink": rgba(0xFF5DA8),
    "pink_light": rgba(0xFFD0E7),
    "teal": rgba(0x55D9C4),
    "wool": rgba(0xE7E3D1),
    "bell": rgba(0xA66B2A),
    "bell_dark": rgba(0x493321),
    "energy_blue": rgba(0x3B8CFF),
    "energy_green": rgba(0x5CFF78),
    "energy_orange": rgba(0xFF7A21),
    "energy_violet": rgba(0x8D4DFF),
    "electric_blue": rgba(0xBDF7FF),
    "molten": rgba(0xFFB229),
    "poison_dark": rgba(0x173B2B),
    "void": rgba(0x0A0714),
    "rose": rgba(0xFF87BD),
}


def material(name: str, color: Color, metallic=0.0, roughness=0.5, emission=0.0):
    key = f"premium-projectile-{name}"
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
    "steel": material("steel", COLORS["steel"], 0.82, 0.23),
    "edge": material("edge", COLORS["edge"], 0.88, 0.12, 0.2),
    "iron": material("iron", COLORS["iron"], 0.72, 0.34),
    "dark_iron": material("dark-iron", COLORS["dark_iron"], 0.65, 0.42),
    "gold": material("gold", COLORS["gold"], 0.88, 0.2),
    "gold_bright": material("gold-bright", COLORS["gold_bright"], 0.8, 0.14, 0.4),
    "brass": material("brass", COLORS["brass"], 0.68, 0.3),
    "wood": material("wood", COLORS["wood"], 0.0, 0.72),
    "wood_light": material("wood-light", COLORS["wood_light"], 0.0, 0.62),
    "leather": material("leather", COLORS["leather"], 0.0, 0.86),
    "linen": material("linen", COLORS["linen"], 0.0, 0.8),
    "red_cloth": material("red-cloth", COLORS["red_cloth"], 0.0, 0.78),
    "blue": material("blue", COLORS["blue"], 0.32, 0.3, 0.15),
    "cyan": material("cyan", COLORS["cyan"], 0.18, 0.15, 0.8),
    "white": material("white", COLORS["white"], 0.08, 0.12, 0.7),
    "arcane": material("arcane", COLORS["arcane"], 0.24, 0.2, 1.0),
    "arcane_dark": material("arcane-dark", COLORS["arcane_dark"], 0.32, 0.35, 0.2),
    "fire": material("fire", COLORS["fire"], 0.06, 0.2, 0.8),
    "fire_hot": material("fire-hot", COLORS["fire_hot"], 0.04, 0.12, 1.15),
    "ember": material("ember", COLORS["ember"], 0.12, 0.4, 0.55),
    "rock": material("rock", COLORS["rock"], 0.0, 0.86),
    "holy": material("holy", COLORS["holy"], 0.42, 0.18, 0.95),
    "holy_white": material("holy-white", COLORS["holy_white"], 0.12, 0.1, 1.05),
    "blood": material("blood", COLORS["blood"], 0.18, 0.26, 0.8),
    "shadow": material("shadow", COLORS["shadow"], 0.28, 0.46, 0.15),
    "purple": material("purple", COLORS["purple"], 0.2, 0.24, 1.0),
    "green": material("green", COLORS["green"], 0.08, 0.38, 0.35),
    "green_bright": material("green-bright", COLORS["green_bright"], 0.12, 0.18, 1.1),
    "root": material("root", COLORS["root"], 0.0, 0.84),
    "pink": material("pink", COLORS["pink"], 0.16, 0.22, 1.1),
    "pink_light": material("pink-light", COLORS["pink_light"], 0.08, 0.16, 1.25),
    "teal": material("teal", COLORS["teal"], 0.18, 0.18, 1.1),
    "wool": material("wool", COLORS["wool"], 0.0, 0.92),
    "bell": material("bell", COLORS["bell"], 0.82, 0.28),
    "bell_dark": material("bell-dark", COLORS["bell_dark"], 0.65, 0.45),
    "energy_blue": material("energy-blue", COLORS["energy_blue"], 0.16, 0.12, 1.4),
    "energy_green": material("energy-green", COLORS["energy_green"], 0.14, 0.13, 1.45),
    "energy_orange": material("energy-orange", COLORS["energy_orange"], 0.12, 0.16, 1.5),
    "energy_violet": material("energy-violet", COLORS["energy_violet"], 0.18, 0.13, 1.5),
    "electric_blue": material("electric-blue", COLORS["electric_blue"], 0.08, 0.08, 1.7),
    "molten": material("molten", COLORS["molten"], 0.06, 0.16, 1.45),
    "poison_dark": material("poison-dark", COLORS["poison_dark"], 0.04, 0.56, 0.12),
    "void": material("void", COLORS["void"], 0.18, 0.58, 0.06),
    "rose": material("rose", COLORS["rose"], 0.1, 0.18, 1.4),
}


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)


def move_to(obj, collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def bevel(obj, width=0.025, segments=2) -> None:
    if obj.type != "MESH":
        return
    modifier = obj.modifiers.new("PremiumChamfer", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"


def finish(obj, collection, root, mat, edge=0.025):
    if mat:
        obj.data.materials.append(mat)
    bevel(obj, edge)
    move_to(obj, collection)
    obj.parent = root
    return obj


def cube(collection, root, name, location: Vec3, scale: Vec3, mat, rotation=(0, 0, 0), edge=0.025):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, collection, root, mat, min(edge, min(scale) * 0.42))


def cylinder(collection, root, name, location: Vec3, radius, depth, mat, vertices=8, rotation=(0, 0, 0), edge=0.018):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, collection, root, mat, min(edge, radius * 0.36))


def cone(collection, root, name, location: Vec3, radius, depth, mat, vertices=6, rotation=(0, 0, 0), edge=0.018):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, collection, root, mat, min(edge, radius * 0.3))


def ico(collection, root, name, location: Vec3, scale: Vec3, mat, subdivisions=1, rotation=(0, 0, 0), edge=0.018):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, collection, root, mat, edge)


def torus(collection, root, name, location: Vec3, major, minor, mat, rotation=(0, 0, 0), segments=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=segments, minor_segments=4, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, collection, root, mat, min(0.012, minor * 0.4))


def between(collection, root, name, start: Vec3, end: Vec3, radius, mat, vertices=6):
    a, b = Vector(start), Vector(end)
    direction = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    obj.rotation_mode = "XYZ"
    return finish(obj, collection, root, mat, min(0.016, radius * 0.34))


def prism_xz(collection, root, name, points, thickness, mat, edge=0.02, location=(0, 0, 0)):
    vertices = [(x, -thickness, z) for x, z in points] + [(x, thickness, z) for x, z in points]
    count = len(points)
    faces = [tuple(range(count)), tuple(range(count, count * 2))[::-1]]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    collection.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(mat)
    bevel(obj, edge, 2)
    return obj


def prism_xy(collection, root, name, points, thickness, mat, edge=0.02, location=(0, 0, 0)):
    """Create a face-on glyph whose normal follows the projectile's +Z axis."""
    vertices = [(x, y, -thickness) for x, y in points] + [(x, y, thickness) for x, y in points]
    count = len(points)
    faces = [tuple(range(count)), tuple(range(count, count * 2))[::-1]]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    collection.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(mat)
    bevel(obj, edge, 2)
    return obj


def wake_shards(collection, root, prefix, material_value, *, count=3, radius=0.12, start_z=-0.24, spacing=0.16):
    """Add a restrained directional wake that stays readable at gameplay scale."""
    for index in range(count):
        angle = (math.tau * index / max(1, count)) + 0.35
        distance = radius * (0.72 + index * 0.12)
        x = math.cos(angle) * distance
        y = math.sin(angle) * distance
        z = start_z - index * spacing
        cone(
            collection,
            root,
            f"{prefix}Wake_{index}",
            (x, y, z),
            max(0.035, radius * (0.52 - index * 0.08)),
            max(0.14, spacing * (1.25 + index * 0.18)),
            material_value,
            5,
            rotation=(math.pi, 0, angle),
            edge=0.009,
        )


def rivets(collection, root, positions, mat=None, radius=0.025):
    for index, position in enumerate(positions):
        ico(collection, root, f"Rivet_{index}", position, (radius,) * 3, mat or MATERIALS["brass"], 1, edge=radius * 0.4)


def arrow_base(collection, root, *, shaft, head, trim, fletching, length=1.5, heavy=False, dirty=False):
    tail = -length * 0.48
    tip = length * 0.52
    shaft_radius = 0.035 if not heavy else 0.05
    cylinder(collection, root, "Shaft", (0, 0, -0.02), shaft_radius, length * 0.78, MATERIALS["wood"] if dirty else shaft, 8)
    cylinder(collection, root, "HeadCollar", (0, 0, tip - 0.33), shaft_radius * 1.55, 0.13, trim, 8)
    prism_xz(
        collection,
        root,
        "ForgedArrowhead",
        [(-0.16 if heavy else -0.12, tip - 0.3), (0, tip), (0.16 if heavy else 0.12, tip - 0.3), (0, tip - 0.22)],
        0.055 if heavy else 0.04,
        head,
        0.025,
    )
    prism_xz(collection, root, "HeadEdgeLeft", [(-0.16 if heavy else -0.12, tip - 0.3), (0, tip), (-0.025, tip - 0.22)], 0.062 if heavy else 0.047, MATERIALS["edge"] if not dirty else MATERIALS["steel"], 0.012)
    for side in (-1, 1):
        prism_xz(
            collection,
            root,
            f"Fletching_{side}",
            [(0, tail + 0.03), (side * 0.14, tail + 0.17), (side * 0.12, tail + 0.38), (0, tail + 0.28)],
            0.025,
            fletching,
            0.012,
        )
        cube(collection, root, f"FletchingRib_{side}", (side * 0.055, 0, tail + 0.21), (0.012, 0.035, 0.13), trim, rotation=(0, side * 0.18, 0), edge=0.006)
    for binding_index, z in enumerate((tail + 0.31, tip - 0.42)):
        torus(collection, root, f"Binding_{binding_index}", (0, 0, z), shaft_radius * 1.42, 0.012, MATERIALS["leather"] if dirty else trim, segments=8)


def build_hunter_arrow(spec, collection, root):
    arrow_base(collection, root, shaft=MATERIALS["wood_light"], head=MATERIALS["steel"], trim=MATERIALS["brass"], fletching=MATERIALS["linen"], length=1.05)
    ico(collection, root, "HunterNock", (0, 0, -0.53), (0.05, 0.05, 0.075), MATERIALS["green"], 1)


def build_quick_arrow(spec, collection, root):
    arrow_base(collection, root, shaft=MATERIALS["steel"], head=MATERIALS["edge"], trim=MATERIALS["cyan"], fletching=MATERIALS["blue"], length=1.42)
    for side in (-1, 1):
        prism_xz(collection, root, f"WindVane_{side}", [(0, -0.45), (side * 0.18, -0.3), (side * 0.08, 0.12), (0, 0.2)], 0.018, MATERIALS["cyan"], 0.008)
    wake_shards(collection, root, "Quick", MATERIALS["cyan"], count=2, radius=0.09, start_z=-0.58, spacing=0.16)


def build_aimed_arrow(spec, collection, root):
    arrow_base(collection, root, shaft=MATERIALS["dark_iron"], head=MATERIALS["steel"], trim=MATERIALS["gold"], fletching=MATERIALS["red_cloth"], length=1.78, heavy=True)
    for ring_index, (z, radius) in enumerate(((-0.05, 0.16), (0.22, 0.13), (0.46, 0.1))):
        torus(collection, root, f"ChargeRing_{ring_index}", (0, 0, z), radius, 0.018, MATERIALS["gold_bright"], segments=12)
    cube(collection, root, "CrystalChannel", (0, -0.06, 0.12), (0.025, 0.012, 0.32), MATERIALS["cyan"], edge=0.008)
    ico(collection, root, "AimedFocus", (0, 0, 0.92), (0.055, 0.055, 0.1), MATERIALS["gold_bright"], 1)


def build_multi_arrow(spec, collection, root):
    # Three strong silhouettes read as a volley without turning into a noisy
    # cage at combat distance (the previous five-arrow bundle was nearly at
    # the entire per-projectile triangle budget by itself).
    offsets = ((0, 0, 0.05), (-0.3, 0.02, -0.1), (0.3, -0.02, -0.1))
    colors = (MATERIALS["linen"], MATERIALS["blue"], MATERIALS["red_cloth"])
    for index, ((x, y, z), feathers) in enumerate(zip(offsets, colors)):
        subroot = bpy.data.objects.new(f"VolleyArrow_{index}", None)
        collection.objects.link(subroot)
        subroot.parent = root
        subroot.location = (x, y, z)
        subroot.rotation_euler = (y * 0.6, -x * 0.32, 0)
        arrow_base(collection, subroot, shaft=MATERIALS["wood_light"], head=MATERIALS["steel"], trim=MATERIALS["brass"], fletching=feathers, length=1.25)
    torus(collection, root, "VolleyWindRing", (0, 0, -0.2), 0.48, 0.018, MATERIALS["green_bright"], rotation=(0.2, 0.1, 0), segments=14)
    for side in (-1, 1):
        between(collection, root, f"VolleyGuide_{side}", (side * 0.1, 0, -0.3), (side * 0.38, 0, 0.42), 0.018, MATERIALS["green_bright"], 5)


def build_bandit_arrow(spec, collection, root):
    arrow_base(collection, root, shaft=MATERIALS["wood"], head=MATERIALS["iron"], trim=MATERIALS["dark_iron"], fletching=MATERIALS["red_cloth"], length=1.48, dirty=True)
    for index, z in enumerate((-0.24, -0.17, -0.1)):
        torus(collection, root, f"RopeBinding_{index}", (0, 0, z), 0.056, 0.014, MATERIALS["leather"], segments=8)
    cone(collection, root, "CruelBarb", (-0.14, 0, 0.52), 0.055, 0.24, MATERIALS["iron"], 4, rotation=(0, -0.8, 0))


def build_ranged_arrow(spec, collection, root):
    # A compact crossbow quarrel, deliberately stouter than the bow arrows.
    cylinder(collection, root, "QuarrelShaft", (0, 0, -0.02), 0.052, 1.05, MATERIALS["dark_iron"], 8)
    prism_xz(collection, root, "QuarrelHead", [(-0.16, 0.26), (0, 0.72), (0.16, 0.26), (0, 0.38)], 0.07, MATERIALS["steel"], 0.025)
    prism_xz(collection, root, "QuarrelEdge", [(-0.05, 0.34), (0, 0.67), (0.05, 0.34)], 0.078, MATERIALS["edge"], 0.01)
    for side in (-1, 1):
        prism_xz(collection, root, f"QuarrelFin_{side}", [(0, -0.54), (side * 0.18, -0.4), (side * 0.14, -0.2), (0, -0.3)], 0.03, MATERIALS["blue"], 0.012)
    torus(collection, root, "GuideRing", (0, 0, 0.02), 0.13, 0.018, MATERIALS["cyan"], segments=12)


def build_spark(spec, collection, root):
    ico(collection, root, "SparkCore", (0, 0, 0.1), (0.16, 0.16, 0.24), MATERIALS["white"], 2, rotation=(0.3, 0.2, 0.1))
    points = (
        (0.38, 0.02, 0.1), (-0.38, -0.02, 0.1),
        (0.02, 0.34, 0.08), (-0.02, -0.34, 0.08),
        (0.08, 0.02, 0.48), (-0.06, -0.02, -0.38),
    )
    for index, point in enumerate(points):
        between(collection, root, f"SparkRay_{index}", (0, 0, 0.1), point, 0.026 if index < 4 else 0.032, MATERIALS["electric_blue"] if index % 2 == 0 else MATERIALS["arcane"], 4)
        ico(collection, root, f"SparkPoint_{index}", point, (0.045, 0.045, 0.065), MATERIALS["white"], 1)
    torus(collection, root, "BrokenArc", (0, 0, 0.06), 0.28, 0.014, MATERIALS["arcane"], rotation=(0.55, 0.28, 0.2), segments=10)


def build_fireball(spec, collection, root):
    ico(collection, root, "WhiteHotCore", (0, 0, 0.15), (0.22, 0.22, 0.3), MATERIALS["fire_hot"], 2)
    ico(collection, root, "EmberMantle", (0, 0, 0.1), (0.33, 0.31, 0.37), MATERIALS["ember"], 1, rotation=(0.2, 0.4, 0.1), edge=0.025)
    for index, angle in enumerate(range(0, 360, 45)):
        rad = math.radians(angle)
        ico(collection, root, f"LavaShell_{index}", (math.cos(rad) * 0.27, math.sin(rad) * 0.25, 0.08 + (index % 2) * 0.08), (0.11, 0.11, 0.17), MATERIALS["molten"] if index % 3 == 0 else MATERIALS["fire"], 1)
    for index, (x, y, z, size) in enumerate(((0.16, 0.05, -0.32, 0.16), (-0.12, 0.12, -0.4, 0.13), (0.05, -0.16, -0.48, 0.1), (-0.08, -0.05, -0.58, 0.07))):
        cone(collection, root, f"FlameTongue_{index}", (x, y, z), size, size * 2.4, MATERIALS["fire"] if index < 2 else MATERIALS["ember"], 5, rotation=(math.pi, 0, 0))
    wake_shards(collection, root, "Fire", MATERIALS["fire"], count=3, radius=0.15, start_z=-0.34, spacing=0.16)
    torus(collection, root, "HeatBand", (0, 0, 0.1), 0.37, 0.018, MATERIALS["fire_hot"], rotation=(0.25, 0.35, 0), segments=14)


def build_meteor(spec, collection, root):
    ico(collection, root, "MeteorStone", (0, 0, 0.12), (0.48, 0.42, 0.58), MATERIALS["rock"], 2, rotation=(0.3, 0.4, 0.2), edge=0.035)
    ico(collection, root, "MoltenLeadingFace", (0, 0, 0.56), (0.31, 0.28, 0.16), MATERIALS["molten"], 1, rotation=(0.1, 0.2, 0.1), edge=0.025)
    for index, (a, b) in enumerate((((-0.35, -0.1, 0.12), (0.22, 0.08, 0.5)), ((-0.18, 0.38, -0.1), (0.25, -0.25, 0.2)), ((0.1, -0.36, -0.18), (0.3, 0.2, 0.02)))):
        between(collection, root, f"LavaCrack_{index}", a, b, 0.035, MATERIALS["fire_hot"], 4)
    for index, (x, y, z, scale) in enumerate(((0.22, 0.1, -0.52, 0.18), (-0.26, -0.12, -0.62, 0.15), (0.1, -0.2, -0.78, 0.1), (-0.08, 0.16, -0.92, 0.07))):
        ico(collection, root, f"BreakawayRock_{index}", (x, y, z), (scale, scale * 0.8, scale * 1.1), MATERIALS["rock"], 1, rotation=(index * 0.4, index * 0.2, 0.1))
        cone(collection, root, f"BreakawayFlame_{index}", (x, y, z - scale * 1.4), scale * 0.7, scale * 2.0, MATERIALS["fire"], 5, rotation=(math.pi, 0, 0))
    wake_shards(collection, root, "Meteor", MATERIALS["molten"], count=4, radius=0.24, start_z=-0.54, spacing=0.2)


def build_lightning(spec, collection, root):
    points = ((0, 0, -0.72), (0.12, -0.04, -0.45), (-0.09, 0.03, -0.18), (0.15, 0.02, 0.12), (-0.05, -0.03, 0.42), (0, 0, 0.78))
    for index, (a, b) in enumerate(zip(points, points[1:])):
        between(collection, root, f"BoltSegment_{index}", a, b, 0.065 if index in (1, 2) else 0.05, MATERIALS["holy_white"] if index % 2 == 0 else MATERIALS["cyan"], 4)
        between(collection, root, f"BoltCore_{index}", a, b, 0.022, MATERIALS["electric_blue"], 4)
    branches = (((0.12, -0.04, -0.45), (0.38, 0.06, -0.2)), ((-0.09, 0.03, -0.18), (-0.38, -0.08, 0.05)), ((0.15, 0.02, 0.12), (0.42, 0.12, 0.35)), ((-0.05, -0.03, 0.42), (-0.3, 0.06, 0.62)))
    for index, (a, b) in enumerate(branches):
        between(collection, root, f"LightningBranch_{index}", a, b, 0.028, MATERIALS["cyan"], 4)
        ico(collection, root, f"BranchSpark_{index}", b, (0.055, 0.055, 0.07), MATERIALS["white"], 1)
    wake_shards(collection, root, "Lightning", MATERIALS["electric_blue"], count=2, radius=0.12, start_z=-0.65, spacing=0.2)


def build_holy_lance(spec, collection, root):
    prism_xz(collection, root, "RadiantLance", [(-0.1, -0.52), (-0.16, 0.2), (0, 0.62), (0.16, 0.2), (0.1, -0.52), (0, -0.66)], 0.055, MATERIALS["holy_white"], 0.028)
    prism_xz(collection, root, "GoldenSpine", [(-0.025, -0.48), (0, 0.52), (0.025, -0.48)], 0.065, MATERIALS["holy"], 0.01)
    torus(collection, root, "SanctifiedHalo", (0, 0, 0.02), 0.34, 0.025, MATERIALS["gold_bright"], segments=16)
    for side in (-1, 1):
        prism_xz(collection, root, f"FeatherWing_{side}", [(0, -0.18), (side * 0.28, -0.03), (side * 0.38, 0.18), (side * 0.13, 0.1)], 0.025, MATERIALS["holy_white"], 0.014)
    wake_shards(collection, root, "HolyLight", MATERIALS["holy"], count=2, radius=0.12, start_z=-0.5, spacing=0.2)


def build_smite(spec, collection, root):
    prism_xz(collection, root, "DivineSpear", [(-0.08, -0.48), (-0.12, 0.3), (0, 0.68), (0.12, 0.3), (0.08, -0.48), (0, -0.64)], 0.06, MATERIALS["holy_white"], 0.025)
    cube(collection, root, "SmiteCrossbar", (0, 0, -0.16), (0.35, 0.07, 0.065), MATERIALS["gold"], edge=0.035)
    for side in (-1, 1):
        cone(collection, root, f"CrossbarRay_{side}", (side * 0.4, 0, -0.16), 0.07, 0.25, MATERIALS["holy"], 4, rotation=(0, side * math.pi / 2, 0))
    torus(collection, root, "SmiteRuneRing", (0, 0, 0.08), 0.29, 0.018, MATERIALS["holy"], rotation=(0.35, 0.2, 0), segments=12)
    ico(collection, root, "SmiteFocus", (0, 0, 0.7), (0.06, 0.06, 0.1), MATERIALS["gold_bright"], 1)


def build_judgment(spec, collection, root):
    cube(collection, root, "JudgmentHead", (0, 0, 0.22), (0.36, 0.11, 0.2), MATERIALS["gold"], edge=0.065)
    cube(collection, root, "RadiantFace", (0, -0.13, 0.22), (0.28, 0.025, 0.13), MATERIALS["holy_white"], edge=0.025)
    cylinder(collection, root, "JudgmentHaft", (0, 0, -0.28), 0.06, 0.68, MATERIALS["bell_dark"], 8)
    torus(collection, root, "JudgmentSeal", (0, -0.16, 0.22), 0.17, 0.025, MATERIALS["gold_bright"], rotation=(math.pi / 2, 0, 0), segments=12)
    rivets(collection, root, [(-0.25, -0.13, 0.22), (0.25, -0.13, 0.22)], MATERIALS["holy_white"], 0.03)
    wake_shards(collection, root, "Judgment", MATERIALS["holy"], count=2, radius=0.13, start_z=-0.44, spacing=0.2)


def build_consecrate(spec, collection, root):
    # Consecrate descends along local +Z, so the seal must face +Z. The old
    # XZ-oriented token arrived edge-on and lost the entire rune at impact.
    cylinder(collection, root, "DescendingSeal", (0, 0, 0.02), 0.42, 0.12, MATERIALS["gold"], 16, edge=0.035)
    cylinder(collection, root, "WhiteSealFace", (0, 0, 0.09), 0.32, 0.03, MATERIALS["holy_white"], 16, edge=0.015)
    torus(collection, root, "OuterHolyRing", (0, 0, 0.12), 0.48, 0.028, MATERIALS["gold_bright"], segments=16)
    for index in range(8):
        angle = math.tau * index / 8
        start = (math.cos(angle) * 0.2, math.sin(angle) * 0.2, 0.14)
        end = (math.cos(angle) * 0.38, math.sin(angle) * 0.38, 0.14)
        between(collection, root, f"SunRay_{index}", start, end, 0.027, MATERIALS["holy"], 4)
    prism_xy(collection, root, "CentralCross", [(-0.06, -0.22), (-0.06, -0.06), (-0.2, -0.06), (-0.2, 0.06), (-0.06, 0.06), (-0.06, 0.24), (0.06, 0.24), (0.06, 0.06), (0.2, 0.06), (0.2, -0.06), (0.06, -0.06), (0.06, -0.22)], 0.155, MATERIALS["gold_bright"], 0.015)


def build_life_drain(spec, collection, root):
    ico(collection, root, "SoulVoid", (0, 0, 0.15), (0.23, 0.23, 0.34), MATERIALS["void"], 2, rotation=(0.2, 0.3, 0.1))
    ico(collection, root, "BloodSoulCore", (0, 0, 0.22), (0.13, 0.13, 0.23), MATERIALS["rose"], 1, rotation=(0.2, 0.3, 0.1))
    for strand in (-1, 1):
        points = []
        for index in range(8):
            z = -0.55 + index * 0.16
            angle = index * 0.85 + (math.pi if strand < 0 else 0)
            points.append((math.cos(angle) * 0.24, math.sin(angle) * 0.24, z))
        for index, (a, b) in enumerate(zip(points, points[1:])):
            between(collection, root, f"SoulHelix_{strand}_{index}", a, b, 0.025, MATERIALS["purple"] if strand < 0 else MATERIALS["blood"], 5)
    for index, z in enumerate((-0.42, -0.12, 0.2, 0.48)):
        ico(collection, root, f"CapturedSoul_{index}", (0.24 * (-1 if index % 2 else 1), 0.08 * (index - 1.5), z), (0.055, 0.055, 0.08), MATERIALS["pink_light"], 1)
    wake_shards(collection, root, "Soul", MATERIALS["blood"], count=3, radius=0.13, start_z=-0.5, spacing=0.15)


def build_roots(spec, collection, root):
    ico(collection, root, "RootSeed", (0, 0, 0.18), (0.24, 0.22, 0.3), MATERIALS["root"], 1, rotation=(0.2, 0.4, 0.1), edge=0.03)
    ico(collection, root, "SeedHeart", (0, 0, 0.27), (0.11, 0.1, 0.13), MATERIALS["green_bright"], 1)
    for index in range(6):
        angle = math.tau * index / 6
        middle = (math.cos(angle) * 0.23, math.sin(angle) * 0.23, -0.08)
        end = (math.cos(angle + 0.25) * 0.42, math.sin(angle + 0.25) * 0.42, -0.48 + (index % 2) * 0.1)
        between(collection, root, f"RootArmA_{index}", (0, 0, 0.06), middle, 0.045, MATERIALS["root"], 6)
        between(collection, root, f"RootArmB_{index}", middle, end, 0.032, MATERIALS["green"], 5)
        cone(collection, root, f"Thorn_{index}", end, 0.05, 0.18, MATERIALS["green_bright"], 4, rotation=(0.6, angle, 0))
    torus(collection, root, "NatureRune", (0, 0, 0.12), 0.32, 0.017, MATERIALS["green_bright"], rotation=(0.3, 0.2, 0), segments=12)


def build_poison_spit(spec, collection, root):
    ico(collection, root, "PoisonCore", (0, 0, 0.19), (0.2, 0.19, 0.34), MATERIALS["green_bright"], 2)
    ico(collection, root, "VenomShadow", (0, 0, 0.04), (0.29, 0.26, 0.38), MATERIALS["poison_dark"], 1, rotation=(0.2, 0.4, 0.1), edge=0.025)
    for index in range(6):
        angle = math.tau * index / 9
        radius = 0.21 + (index % 2) * 0.035
        ico(collection, root, f"VenomLobe_{index}", (math.cos(angle) * radius, math.sin(angle) * radius, 0.09 + (index % 2) * 0.12), (0.11, 0.1, 0.16), MATERIALS["green"] if index % 2 else MATERIALS["teal"], 1)
    for index, (x, y, z, scale) in enumerate(((0.14, 0.02, -0.28, 0.13), (-0.12, 0.1, -0.38, 0.11), (0.04, -0.14, -0.48, 0.09), (-0.05, -0.04, -0.58, 0.065))):
        ico(collection, root, f"VenomDroplet_{index}", (x, y, z), (scale, scale, scale * 1.35), MATERIALS["green_bright"] if index < 2 else MATERIALS["green"], 1)
    torus(collection, root, "VenomMembrane", (0, 0, 0.09), 0.34, 0.016, MATERIALS["teal"], rotation=(0.45, -0.2, 0.2), segments=14)
    for index in range(5):
        angle = math.tau * index / 5 + 0.3
        ico(collection, root, f"ToxicBubble_{index}", (math.cos(angle) * 0.38, math.sin(angle) * 0.38, -0.08 + index * 0.07), (0.045, 0.045, 0.055), MATERIALS["white"] if index == 0 else MATERIALS["green_bright"], 1)


def build_verse(spec, collection, root):
    torus(collection, root, "NoteHead", (0.1, 0, -0.12), 0.2, 0.065, MATERIALS["pink"], rotation=(math.pi / 2, 0, 0), segments=12)
    cylinder(collection, root, "NoteStem", (0.22, 0, 0.24), 0.04, 0.68, MATERIALS["gold"], 8)
    prism_xz(collection, root, "NoteFlag", [(0.2, 0.48), (0.5, 0.38), (0.42, 0.16), (0.2, 0.24)], 0.05, MATERIALS["purple"], 0.022)
    for index, radius in enumerate((0.34, 0.5)):
        torus(collection, root, f"SoundWave_{index}", (0, 0, -0.04 - index * 0.11), radius, 0.017, MATERIALS["pink_light"] if index == 0 else MATERIALS["arcane"], rotation=(0.42 + index * 0.24, 0.1, 0), segments=14)
    wake_shards(collection, root, "Verse", MATERIALS["rose"], count=2, radius=0.11, start_z=-0.44, spacing=0.18)


def build_curse(spec, collection, root):
    ico(collection, root, "WeaknessCore", (0, 0, 0.06), (0.2, 0.18, 0.28), MATERIALS["void"], 1, rotation=(0.3, 0.2, 0.1))
    prism_xz(collection, root, "BrokenCrown", [(-0.38, -0.05), (-0.28, 0.28), (-0.1, 0.1), (0, 0.36), (0.12, 0.08), (0.32, 0.26), (0.38, -0.08), (0, -0.22)], 0.055, MATERIALS["purple"], 0.025)
    for side in (-1, 1):
        torus(collection, root, f"BrokenChain_{side}", (side * 0.31, 0, -0.26), 0.11, 0.025, MATERIALS["dark_iron"], rotation=(0.3, 0.5, side * 0.3), segments=8)
    prism_xz(collection, root, "CrackRune", [(-0.03, -0.3), (0.08, -0.08), (-0.02, 0.04), (0.09, 0.28), (0, 0.18), (-0.08, -0.02)], 0.07, MATERIALS["pink_light"], 0.01)
    wake_shards(collection, root, "Curse", MATERIALS["purple"], count=3, radius=0.13, start_z=-0.32, spacing=0.14)


def build_mark(spec, collection, root):
    prism_xz(collection, root, "MarkArrowhead", [(-0.28, -0.26), (0, 0.44), (0.28, -0.26), (0, -0.1)], 0.055, MATERIALS["red_cloth"], 0.03)
    ico(collection, root, "HunterEye", (0, -0.075, -0.02), (0.16, 0.035, 0.1), MATERIALS["gold_bright"], 1)
    ico(collection, root, "EyePupil", (0, -0.12, -0.02), (0.055, 0.018, 0.055), MATERIALS["shadow"], 1)
    torus(collection, root, "TargetRing", (0, 0, -0.04), 0.42, 0.021, MATERIALS["pink"], rotation=(0.2, 0.15, 0), segments=16)
    for reticle_index, angle in enumerate((0, math.pi / 2, math.pi, math.pi * 1.5)):
        start = (math.cos(angle) * 0.38, math.sin(angle) * 0.38, -0.04)
        end = (math.cos(angle) * 0.53, math.sin(angle) * 0.53, -0.04)
        between(collection, root, f"Reticle_{reticle_index}", start, end, 0.025, MATERIALS["gold"], 4)


def build_polymorph(spec, collection, root):
    ico(collection, root, "TransformationCore", (0, 0, 0.08), (0.17, 0.17, 0.24), MATERIALS["rose"], 1)
    for index, (x, y, z, scale) in enumerate(((-0.22, 0, 0.02, 0.18), (0.22, 0.02, 0.04, 0.16), (0, 0.16, -0.05, 0.17), (0, -0.14, 0.14, 0.15), (0.08, 0.05, -0.22, 0.13))):
        ico(collection, root, f"WoolCloud_{index}", (x, y, z), (scale, scale, scale), MATERIALS["wool"], 1, edge=0.025)
    for side in (-1, 1):
        cone(collection, root, f"TinyHorn_{side}", (side * 0.18, 0, 0.26), 0.045, 0.18, MATERIALS["gold"], 5, rotation=(0, side * 0.45, 0))
    ico(collection, root, "SheepFace", (0, -0.18, 0.02), (0.13, 0.035, 0.1), MATERIALS["shadow"], 1)
    for side in (-1, 1):
        ico(collection, root, f"SheepEye_{side}", (side * 0.045, -0.22, 0.045), (0.014, 0.01, 0.014), MATERIALS["white"], 1)
    torus(collection, root, "TransformationRune", (0, 0, 0.03), 0.4, 0.018, MATERIALS["teal"], rotation=(0.4, 0.2, 0), segments=14)


def build_fear(spec, collection, root):
    prism_xz(collection, root, "FearMask", [(-0.32, 0.2), (-0.2, 0.42), (0, 0.52), (0.2, 0.42), (0.32, 0.2), (0.22, -0.26), (0.08, -0.42), (0, -0.28), (-0.08, -0.42), (-0.22, -0.26)], 0.09, MATERIALS["shadow"], 0.045)
    for side in (-1, 1):
        prism_xz(collection, root, f"Horn_{side}", [(side * 0.18, 0.3), (side * 0.44, 0.58), (side * 0.34, 0.18)], 0.07, MATERIALS["purple"], 0.025)
        ico(collection, root, f"Eye_{side}", (side * 0.12, -0.11, 0.12), (0.065, 0.022, 0.045), MATERIALS["pink_light"], 1)
    prism_xz(collection, root, "MouthVoid", [(-0.12, -0.14), (0, -0.28), (0.12, -0.14), (0, -0.08)], 0.105, MATERIALS["arcane_dark"], 0.01)
    torus(collection, root, "DreadAura", (0, 0, 0.06), 0.48, 0.024, MATERIALS["purple"], rotation=(0.35, 0.15, 0), segments=14)
    wake_shards(collection, root, "Dread", MATERIALS["void"], count=3, radius=0.16, start_z=-0.34, spacing=0.16)


def build_charm(spec, collection, root):
    prism_xz(collection, root, "HeartGem", [(0, -0.4), (-0.34, -0.02), (-0.3, 0.24), (-0.12, 0.34), (0, 0.2), (0.12, 0.34), (0.3, 0.24), (0.34, -0.02)], 0.09, MATERIALS["pink"], 0.04)
    prism_xz(collection, root, "HeartHighlight", [(-0.06, -0.22), (-0.22, -0.02), (-0.18, 0.16), (-0.08, 0.2), (0.02, 0.08)], 0.105, MATERIALS["pink_light"], 0.012)
    for side in (-1, 1):
        prism_xz(collection, root, f"CharmWing_{side}", [(side * 0.22, 0.08), (side * 0.5, 0.26), (side * 0.42, 0.02), (side * 0.24, -0.08)], 0.04, MATERIALS["gold_bright"], 0.02)
    torus(collection, root, "CharmOrbit", (0, 0, 0), 0.46, 0.018, MATERIALS["arcane"], rotation=(0.45, 0.2, 0), segments=14)
    ico(collection, root, "CharmFocus", (0, 0, 0.42), (0.055, 0.055, 0.09), MATERIALS["pink_light"], 1)


def build_hex(spec, collection, root):
    ico(collection, root, "HexEye", (0, 0, 0.12), (0.22, 0.18, 0.3), MATERIALS["green_bright"], 1, rotation=(0.2, 0.3, 0.1))
    ico(collection, root, "HexPupil", (0, -0.17, 0.12), (0.07, 0.025, 0.12), MATERIALS["shadow"], 1)
    for index in range(6):
        angle = math.tau * index / 6
        start = (math.cos(angle) * 0.17, math.sin(angle) * 0.17, -0.08)
        end = (math.cos(angle + 0.28) * 0.42, math.sin(angle + 0.28) * 0.42, 0.12 + (index % 2) * 0.18)
        between(collection, root, f"ThornCage_{index}", start, end, 0.035, MATERIALS["purple"], 5)
        cone(collection, root, f"HexThorn_{index}", end, 0.055, 0.2, MATERIALS["green_bright"], 4, rotation=(0.7, angle, 0))
    torus(collection, root, "HexSeal", (0, 0, 0.1), 0.45, 0.021, MATERIALS["arcane"], rotation=(0.5, 0.2, 0), segments=12)
    wake_shards(collection, root, "Hex", MATERIALS["green_bright"], count=2, radius=0.14, start_z=-0.34, spacing=0.2)


def build_resonance(spec, collection, root):
    prism_xz(collection, root, "BellShard", [(-0.34, -0.48), (-0.44, 0.18), (-0.26, 0.52), (0.08, 0.62), (0.34, 0.36), (0.28, -0.4), (0, -0.62)], 0.13, MATERIALS["bell"], 0.065)
    prism_xz(collection, root, "BellRim", [(-0.34, -0.48), (0, -0.62), (0.28, -0.4), (0.2, -0.32), (0, -0.48), (-0.28, -0.36)], 0.15, MATERIALS["gold_bright"], 0.028)
    for index, (a, b) in enumerate((((-0.18, -0.24, -0.12), (0.14, -0.14, 0.38)), ((0.08, 0.14, -0.38), (0.2, 0.08, 0.24)))):
        between(collection, root, f"ResonanceCrack_{index}", a, b, 0.035, MATERIALS["fire_hot"], 4)
    cylinder(collection, root, "BellClapper", (0, 0, -0.35), 0.07, 0.38, MATERIALS["bell_dark"], 8)
    ico(collection, root, "ClapperWeight", (0, 0, -0.58), (0.12, 0.12, 0.12), MATERIALS["gold"], 1)
    for index, radius in enumerate((0.52, 0.68)):
        torus(collection, root, f"ResonanceRing_{index}", (0, 0, -0.02), radius, 0.03, MATERIALS["gold_bright"] if index == 0 else MATERIALS["fire"], rotation=(0.35 + index * 0.28, 0.15, index * 0.4), segments=16)
    for index in range(5):
        angle = math.tau * index / 5
        ico(collection, root, f"OrbitingBellChip_{index}", (math.cos(angle) * 0.58, math.sin(angle) * 0.58, -0.02 + (index % 2) * 0.18), (0.07, 0.05, 0.12), MATERIALS["bell"], 1, rotation=(index * 0.4, index * 0.3, 0.2))
    ico(collection, root, "ResonanceFocus", (0, 0, 0.62), (0.07, 0.07, 0.11), MATERIALS["fire_hot"], 1)


def build_energy_projectile(spec, collection, root):
    if spec.id == "photon_sidearm_pulse":
        cylinder(collection, root, "PhotonNeedle", (0, 0, 0.02), 0.055, 0.78, MATERIALS["energy_blue"], 8)
        cone(collection, root, "PhotonTip", (0, 0, 0.5), 0.1, 0.34, MATERIALS["white"], 6)
        for index, z in enumerate((-0.28, -0.06, 0.17)):
            torus(collection, root, f"CoherenceRing_{index}", (0, 0, z), 0.11 + index * 0.018, 0.014, MATERIALS["cyan"], segments=12)
        for side in (-1, 1):
            prism_xz(collection, root, f"BlueFin_{side}", [(0, -0.35), (side * 0.13, -0.2), (side * 0.08, 0.08), (0, 0.16)], 0.02, MATERIALS["energy_blue"], 0.008)
        wake_shards(collection, root, "Photon", MATERIALS["energy_blue"], count=2, radius=0.075, start_z=-0.38, spacing=0.17)
        return

    if spec.id == "pulse_carbine_burst":
        offsets = (-0.15, 0, 0.15)
        for index, x in enumerate(offsets):
            cylinder(collection, root, f"BurstPulse_{index}", (x, 0, 0.05 - abs(index - 1) * 0.12), 0.06, 0.78, MATERIALS["cyan"] if index != 1 else MATERIALS["white"], 8)
            cone(collection, root, f"BurstTip_{index}", (x, 0, 0.54 - abs(index - 1) * 0.12), 0.095, 0.3, MATERIALS["white"], 6)
            torus(collection, root, f"BurstRing_{index}", (x, 0, -0.2 - abs(index - 1) * 0.12), 0.1, 0.015, MATERIALS["energy_blue"], segments=10)
        between(collection, root, "BurstLinkLeft", (-0.15, 0, -0.06), (0, 0, 0.06), 0.018, MATERIALS["cyan"], 6)
        between(collection, root, "BurstLinkRight", (0, 0, 0.06), (0.15, 0, -0.06), 0.018, MATERIALS["cyan"], 6)
        wake_shards(collection, root, "Burst", MATERIALS["cyan"], count=2, radius=0.12, start_z=-0.42, spacing=0.17)
        return

    if spec.id == "helix_projector_beam":
        cylinder(collection, root, "HelixAxis", (0, 0, 0), 0.045, 1.2, MATERIALS["white"], 8)
        for strand in (0, math.pi):
            points = []
            for index in range(11):
                z = -0.52 + index * 0.104
                angle = strand + index * math.pi / 2.5
                points.append((math.cos(angle) * 0.18, math.sin(angle) * 0.18, z))
            for index in range(len(points) - 1):
                between(collection, root, f"HelixStrand_{strand}_{index}", points[index], points[index + 1], 0.028, MATERIALS["energy_green"] if strand == 0 else MATERIALS["green_bright"], 6)
        for index, z in enumerate((-0.42, -0.14, 0.14, 0.42)):
            torus(collection, root, f"HelixFieldRing_{index}", (0, 0, z), 0.22, 0.014, MATERIALS["green_bright"], segments=12)
        cone(collection, root, "HelixPenetrator", (0, 0, 0.7), 0.14, 0.4, MATERIALS["white"], 6)
        wake_shards(collection, root, "Helix", MATERIALS["energy_green"], count=2, radius=0.13, start_z=-0.58, spacing=0.21)
        return

    if spec.id == "nova_cannon_bolt":
        ico(collection, root, "NovaPlasmaCore", (0, 0, 0.08), (0.28, 0.28, 0.42), MATERIALS["fire_hot"], 2)
        ico(collection, root, "NovaDenseShell", (0, 0, -0.02), (0.4, 0.4, 0.48), MATERIALS["energy_orange"], 1)
        for index, rotation in enumerate(((0, 0, 0), (math.pi / 2, 0, 0), (0, math.pi / 2, 0))):
            torus(collection, root, f"NovaContainmentRing_{index}", (0, 0, 0), 0.43 + index * 0.035, 0.025, MATERIALS["gold_bright"] if index == 1 else MATERIALS["fire"], rotation=rotation, segments=16)
        for index in range(6):
            angle = math.tau * index / 6
            cone(collection, root, f"NovaWake_{index}", (math.cos(angle) * 0.28, math.sin(angle) * 0.28, -0.42), 0.085, 0.48, MATERIALS["fire"], 5, rotation=(math.pi, 0, angle))
        cone(collection, root, "NovaImpactNose", (0, 0, 0.58), 0.25, 0.45, MATERIALS["fire_hot"], 8)
        ico(collection, root, "NovaLeadingFocus", (0, 0, 0.8), (0.09, 0.09, 0.13), MATERIALS["white"], 1)
        return

    cylinder(collection, root, "SingularityWhiteLance", (0, 0, 0.15), 0.07, 1.45, MATERIALS["white"], 10)
    ico(collection, root, "GravityCore", (0, 0, -0.28), (0.3, 0.3, 0.3), MATERIALS["shadow"], 2)
    ico(collection, root, "EventHorizon", (0, 0, -0.28), (0.11, 0.11, 0.11), MATERIALS["white"], 1)
    for index, rotation in enumerate(((0.25, 0, 0), (math.pi / 2, 0.35, 0), (0, math.pi / 2, 0.55))):
        torus(collection, root, f"GravityOrbit_{index}", (0, 0, -0.28), 0.42 + index * 0.04, 0.025, MATERIALS["energy_violet"] if index != 1 else MATERIALS["white"], rotation=rotation, segments=18)
    for side in (-1, 1):
        between(collection, root, f"LanceFork_{side}", (side * 0.2, 0, -0.02), (side * 0.11, 0, 0.78), 0.035, MATERIALS["energy_violet"], 7)
        cone(collection, root, f"LanceForkTip_{side}", (side * 0.11, 0, 0.9), 0.06, 0.28, MATERIALS["white"], 6)
    for index, z in enumerate((0.05, 0.32, 0.59)):
        torus(collection, root, f"LanceFocusRing_{index}", (0, 0, z), 0.18 - index * 0.025, 0.014, MATERIALS["energy_violet"], segments=14)
    cone(collection, root, "LancePoint", (0, 0, 1.02), 0.12, 0.42, MATERIALS["white"], 8)
    wake_shards(collection, root, "Gravity", MATERIALS["energy_violet"], count=3, radius=0.18, start_z=-0.6, spacing=0.2)


BUILDERS: Dict[str, Callable] = {
    "hunter_arrow": build_hunter_arrow,
    "quick_arrow": build_quick_arrow,
    "aimed_arrow": build_aimed_arrow,
    "multi_arrow": build_multi_arrow,
    "bandit_arrow": build_bandit_arrow,
    "ranged_arrow": build_ranged_arrow,
    "spark": build_spark,
    "fireball": build_fireball,
    "meteor": build_meteor,
    "lightning": build_lightning,
    "holy_lance": build_holy_lance,
    "smite": build_smite,
    "judgment": build_judgment,
    "consecrate": build_consecrate,
    "life_drain": build_life_drain,
    "roots": build_roots,
    "poison_spit": build_poison_spit,
    "verse": build_verse,
    "curse": build_curse,
    "mark": build_mark,
    "polymorph": build_polymorph,
    "fear": build_fear,
    "charm": build_charm,
    "hex": build_hex,
    "resonance": build_resonance,
    "energy": build_energy_projectile,
}


def animate(root, spec):
    root.animation_data_create()
    action = bpy.data.actions.new(f"{spec.id}__FlightLoop_24")
    action["harthmereExportClip"] = "FlightLoop_24"
    root.animation_data.action = action
    root.rotation_mode = "XYZ"
    root.rotation_euler = (0, 0, 0)
    root.scale = (1, 1, 1)
    root.keyframe_insert("rotation_euler", frame=1)
    root.keyframe_insert("scale", frame=1)
    family_spin = {
        "physical": 0.08,
        "fire": 0.65,
        "lightning": 0.22,
        "holy": 0.35,
        "dark": 0.75,
        "nature": 0.3,
        "sonic": 0.5,
        "mark": 0.25,
        "arcane": 0.7,
        "hex": 0.85,
        "boss": 0.55,
        "energy": 0.4,
        "gravity": 0.9,
    }[spec.family]
    magical = spec.family != "physical"
    root.rotation_euler = (
        0.018 if magical else 0.006,
        -0.024 if magical else 0.004,
        family_spin,
    )
    radial_pulse = 1.045 if magical else 1.008
    longitudinal_pulse = 1.018 if magical else 1.003
    if spec.family in {"fire", "energy", "gravity", "lightning"}:
        longitudinal_pulse = 1.065
    root.scale = (radial_pulse, radial_pulse, longitudinal_pulse)
    root.keyframe_insert("rotation_euler", frame=13)
    root.keyframe_insert("scale", frame=13)
    root.rotation_euler = (0, 0, family_spin * 2)
    root.scale = (1, 1, 1)
    root.keyframe_insert("rotation_euler", frame=25)
    root.keyframe_insert("scale", frame=25)


def make_projectile(spec):
    collection = bpy.data.collections.new(f"Projectile_{spec.id}")
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new(f"ProjectileRoot_{spec.id}", None)
    root.empty_display_type = "ARROWS"
    root["harthmereProjectileId"] = spec.id
    root["harthmereProjectileFamily"] = spec.family
    root["harthmereTargetSize"] = spec.target_size
    collection.objects.link(root)
    BUILDERS[spec.builder](spec, collection, root)
    animate(root, spec)
    return collection, root


def select_tree(root):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root


def export_glb(root, path):
    select_tree(root)
    action = root.animation_data.action if root.animation_data else None
    original_name = action.name if action else None
    if action:
        action.name = "FlightLoop_24"
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
        if action and original_name:
            action.name = original_name


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
        "min": [min(point[axis] for point in points) for axis in range(3)],
        "max": [max(point[axis] for point in points) for axis in range(3)],
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
    scene.world.color = (0.004, 0.006, 0.012)
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.004, 0.006, 0.014, 1)
        background.inputs["Strength"].default_value = 0.16
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.1
    bpy.ops.object.camera_add(location=(4.4, -6.8, 3.1))
    camera = bpy.context.object
    camera.data.lens = 62
    look_at(camera)
    scene.camera = camera
    for name, location, energy, color, size_value in (
        ("Key", (3.7, -3.2, 5.4), 520, (0.78, 0.88, 1.0), 3.0),
        ("Rim", (-4.2, 1.8, 3.7), 610, (0.36, 0.62, 1.0), 2.5),
        ("Warm", (1.4, 3.0, -1.6), 360, (1.0, 0.5, 0.24), 2.2),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = f"Preview{name}"
        light.data.energy = energy
        light.data.color = color
        light.data.shape = "DISK"
        light.data.size = size_value
        look_at(light)


def render_preview(root, spec, path, *, transparent=False, size=None):
    for collection in bpy.data.collections:
        if collection.name.startswith("Projectile_"):
            collection.hide_render = collection != root.users_collection[0]
    scene = bpy.context.scene
    previous_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    previous_transparency = scene.render.film_transparent
    if size is not None:
        scene.render.resolution_x = size
        scene.render.resolution_y = size
    scene.render.film_transparent = transparent
    action = root.animation_data.action if root.animation_data else None
    if root.animation_data:
        root.animation_data.action = None
    root.location = (0, 0, 0)
    root.rotation_euler = (math.radians(16), math.radians(-18), math.radians(14))
    root.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    current = bounds(root)
    dimensions = [current["max"][axis] - current["min"][axis] for axis in range(3)]
    scale = 3.55 / max(dimensions)
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    framed = bounds(root)
    center = Vector(tuple((framed["min"][axis] + framed["max"][axis]) * 0.5 for axis in range(3)))
    root.location -= center
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    root.scale = (1, 1, 1)
    if root.animation_data:
        root.animation_data.action = action
    scene.render.resolution_x, scene.render.resolution_y = previous_resolution
    scene.render.film_transparent = previous_transparency
    for collection in bpy.data.collections:
        collection.hide_render = False


def parse_args(argv: Sequence[str]):
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--preview-size", type=int, default=512)
    parser.add_argument("--only", action="append", default=[])
    parser.add_argument("--skip-previews", action="store_true")
    return parser.parse_args(argv)


def main():
    separator = sys.argv.index("--") + 1 if "--" in sys.argv else len(sys.argv)
    args = parse_args(sys.argv[separator:])
    repo = Path(args.repo_root).resolve()
    output = repo / "public/assets/harthmere/glb/projectiles"
    previews = repo / "public/assets/harthmere/projectile_previews"
    weapon_icons = repo / "public/assets/harthmere/weapon_icons"
    blend_path = repo / "src/galois/data/projectiles/harthmere_premium_projectiles.blend"
    output.mkdir(parents=True, exist_ok=True)
    previews.mkdir(parents=True, exist_ok=True)
    weapon_icons.mkdir(parents=True, exist_ok=True)
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    selected = [entry for entry in PROJECTILES if not args.only or entry.id in args.only]
    unknown = sorted(set(args.only) - {entry.id for entry in PROJECTILES})
    if unknown:
        raise ValueError(f"Unknown projectile ids: {', '.join(unknown)}")

    clean_scene()
    setup_preview(args.preview_size)
    generated = []
    columns = 6
    for index, spec in enumerate(selected):
        print(f"Building {spec.id}", flush=True)
        collection, root = make_projectile(spec)
        bpy.context.view_layer.update()
        glb_path = output / f"{spec.id}.glb"
        export_glb(root, glb_path)
        if not args.skip_previews:
            render_preview(root, spec, previews / f"{spec.id}.png")
            if spec.id == "hunter_bow_shot":
                render_preview(
                    root,
                    spec,
                    weapon_icons / "hunting_arrow.png",
                    transparent=True,
                    size=256,
                )
        generated.append(
            {
                "id": spec.id,
                "label": spec.label,
                "family": spec.family,
                "builder": spec.builder,
                "targetSize": spec.target_size,
                "flightClip": "FlightLoop_24",
                "assetUrl": f"/assets/harthmere/glb/projectiles/{spec.id}.glb",
                "previewUrl": f"/assets/harthmere/projectile_previews/{spec.id}.png",
                "triangleCount": triangle_count(root),
                "bounds": bounds(root),
                "bytes": glb_path.stat().st_size,
            }
        )
        root.location = ((index % columns) * 2.8, (index // columns) * 2.8, 0)
        collection["harthmereProjectileLabel"] = spec.label
        print(f"Rendered {spec.id}", flush=True)

    manifest = {
        "version": "harthmere-premium-projectiles-v3",
        "blenderVersion": bpy.app.version_string,
        "count": len(generated),
        "projectiles": generated,
    }
    manifest_path = output / "manifest.json"
    if args.only and manifest_path.exists():
        existing = json.loads(manifest_path.read_text())
        merged = {entry["id"]: entry for entry in existing.get("projectiles", [])}
        merged.update({entry["id"]: entry for entry in generated})
        ordered_ids = [entry.id for entry in PROJECTILES]
        manifest["projectiles"] = [merged[entry_id] for entry_id in ordered_ids if entry_id in merged]
        manifest["count"] = len(manifest["projectiles"])
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    # A focused --only generation must not replace the complete Blender master
    # with a one-projectile scene. Full catalog generation still refreshes it.
    if not args.only:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
