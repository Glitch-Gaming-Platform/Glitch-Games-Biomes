#!/usr/bin/env python3
"""Render the Harthmere inventory icon catalogue in Blender.

Run with:
  blender --background --python scripts/harthmere/blender/generate_inventory_icons.py -- --force

The renderer builds chunky, item-readable miniatures from a shared product-
photography studio. Each image renders at 512px and is downsampled to 256px.
"""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import json
import math
import os
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


REPO = Path(__file__).resolve().parents[3]
TARGETS_PATH = Path(__file__).with_name("inventory_icon_targets.json")
OUTPUT_DIR = REPO / "public/assets/harthmere/inventory_icons/generated"
HIRES_DIR = OUTPUT_DIR / ".hires"

MATERIAL_CACHE: dict[tuple, bpy.types.Material] = {}
ITEM_OBJECTS: list[bpy.types.Object] = []


def cli_args() -> argparse.Namespace:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--only", default="")
    return parser.parse_args(args)


def stable_seed(value: str) -> int:
    return int(hashlib.sha1(value.encode("utf8")).hexdigest()[:12], 16)


def material(
    name: str,
    color: tuple[float, float, float, float],
    metallic: float = 0.0,
    roughness: float = 0.55,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    key = (
        name,
        tuple(round(x, 3) for x in color),
        round(metallic, 2),
        round(roughness, 2),
        emission,
        round(emission_strength, 2),
    )
    if key in MATERIAL_CACHE:
        return MATERIAL_CACHE[key]
    mat = bpy.data.materials.new(name=f"Icon_{name}_{len(MATERIAL_CACHE)}")
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    MATERIAL_CACHE[key] = mat
    return mat


def assign(obj: bpy.types.Object, mat: bpy.types.Material, item: bool = True):
    obj.data.materials.append(mat)
    if item:
        ITEM_OBJECTS.append(obj)
    return obj


def cube(name, loc, scale, mat, bevel=0.08, rot=(0, 0, 0), item=True):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Soft voxel edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return assign(obj, mat, item)


def sphere(name, loc, scale, mat, segments=20, rings=12, item=True):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, location=loc
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return assign(obj, mat, item)


def cylinder(name, loc, radius, depth, mat, vertices=12, rot=(0, 0, 0), item=True):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot
    )
    obj = bpy.context.object
    obj.name = name
    mod = obj.modifiers.new("Edge bevel", "BEVEL")
    mod.width = min(radius * 0.16, 0.08)
    mod.segments = 2
    return assign(obj, mat, item)


def cone(name, loc, r1, r2, depth, mat, vertices=6, rot=(0, 0, 0), item=True):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=r1,
        radius2=r2,
        depth=depth,
        location=loc,
        rotation=rot,
    )
    return assign(bpy.context.object, mat, item)


def torus(name, loc, major, minor, mat, rot=(0, 0, 0), item=True):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=24,
        minor_segments=8,
        location=loc,
        rotation=rot,
    )
    return assign(bpy.context.object, mat, item)


def palette(item_id: str, category: str):
    rng = random.Random(stable_seed(item_id))
    category_hues = {
        "crafting_material": 0.10,
        "food": 0.02,
        "consumable": 0.56,
        "quest_item": 0.74,
        "trade_good": 0.09,
        "tool": 0.58,
        "armor": 0.61,
        "key": 0.12,
        "event_item": 0.82,
        "trophy": 0.04,
    }
    hue = (category_hues.get(category, 0.5) + rng.uniform(-0.07, 0.07)) % 1
    primary = colorsys.hsv_to_rgb(hue, 0.58, 0.72)
    accent = colorsys.hsv_to_rgb((hue + 0.12 + rng.uniform(-0.04, 0.04)) % 1, 0.72, 0.96)
    dark = tuple(max(0.02, c * 0.22) for c in primary)
    return primary, accent, dark


def mats_for(target):
    primary, accent, dark = palette(target["id"], target["category"])
    return {
        "primary": material("primary", (*primary, 1), roughness=0.48),
        "accent": material("accent", (*accent, 1), metallic=0.12, roughness=0.3),
        "dark": material("dark", (*dark, 1), roughness=0.72),
        "wood": material("wood", (0.34, 0.14, 0.055, 1), roughness=0.72),
        "wood_light": material("wood_light", (0.62, 0.31, 0.10, 1), roughness=0.62),
        "steel": material("steel", (0.38, 0.48, 0.58, 1), metallic=0.82, roughness=0.22),
        "gold": material("gold", (0.94, 0.55, 0.08, 1), metallic=0.76, roughness=0.2),
        "paper": material("paper", (0.78, 0.67, 0.43, 1), roughness=0.78),
        "cloth": material("cloth", (*primary, 1), roughness=0.86),
        "leaf": material("leaf", (0.16, 0.48, 0.13, 1), roughness=0.78),
        "bone": material("bone", (0.77, 0.70, 0.55, 1), roughness=0.66),
        "glow": material(
            "glow",
            (*accent, 1),
            roughness=0.16,
            emission=(*accent, 1),
            emission_strength=2.2,
        ),
        "wax": material("wax", (0.55, 0.035, 0.028, 1), roughness=0.54),
        "black": material("black", (0.018, 0.024, 0.035, 1), roughness=0.68),
        "white": material("white", (0.86, 0.88, 0.84, 1), roughness=0.64),
    }


def rune(loc, size, mats, seed):
    rng = random.Random(seed)
    for index in range(3):
        angle = rng.choice([-0.72, -0.35, 0, 0.35, 0.72])
        x = loc[0] + (index - 1) * size * 0.35
        cube(
            "item-specific rune",
            (x, loc[1], loc[2] + rng.uniform(-0.08, 0.08)),
            (size * 0.10, size * 0.06, size * rng.uniform(0.22, 0.45)),
            mats["accent"],
            bevel=0.02,
            rot=(0, angle, 0),
        )


def model_block(m, seed):
    for i, loc in enumerate([(-0.55, 0, -0.35), (0.5, 0.05, -0.25), (0, -0.05, 0.48)]):
        cube("material block", loc, (0.72, 0.58, 0.62), m["primary" if i < 2 else "accent"], 0.12, rot=(0.06 * i, 0.12 * (i - 1), 0.08 * i))
    rune((0, -0.62, 0.1), 0.65, m, seed)


def model_ore(m, seed):
    rng = random.Random(seed)
    for i in range(5):
        sphere("rough ore", (rng.uniform(-0.75, 0.75), rng.uniform(-0.18, 0.18), rng.uniform(-0.75, 0.35)), (rng.uniform(0.42, 0.65),) * 3, m["dark"], segments=8, rings=5)
    for i in range(3):
        cone("ore crystal", (-0.55 + i * 0.55, -0.25, 0.35 + 0.18 * i), 0.24, 0.0, 1.25, m["glow"], vertices=5, rot=(0.1 * i, 0.2 * (i - 1), 0))


def model_ingot(m, seed):
    for i in range(3):
        cube("stacked ingot", ((i - 1) * 0.42, i * 0.08, -0.42 + i * 0.42), (0.72, 0.36, 0.22), m["gold"] if i == 2 else m["steel"], 0.16, rot=(0, 0.08, (-0.08 + i * 0.08)))
    rune((0, -0.42, 0.55), 0.52, m, seed)


def model_crystal(m, seed):
    for i, (x, z, h) in enumerate([(-0.55, -0.3, 1.5), (0.1, 0.05, 2.2), (0.68, -0.35, 1.35)]):
        cone("crystal shard", (x, 0, z), 0.35, 0, h, m["glow"] if i == 1 else m["accent"], vertices=6, rot=(0.05, (-0.2 + i * 0.2), 0))
    torus("crystal setting", (0, 0.08, -0.95), 0.78, 0.13, m["steel"], rot=(math.pi / 2, 0, 0))


def model_seed(m, seed):
    cube("seed pouch", (0, 0.1, -0.25), (0.82, 0.42, 0.95), m["cloth"], 0.28, rot=(0.05, 0.12, -0.08))
    cylinder("pouch tie", (0, -0.36, 0.65), 0.12, 1.1, m["wood_light"], vertices=10, rot=(0, math.pi / 2, 0))
    for i in range(4):
        sphere("large seed", (-0.7 + i * 0.42, -0.55, 0.25 + (i % 2) * 0.18), (0.18, 0.09, 0.28), m["accent"], segments=10, rings=6)
    rune((0, -0.45, -0.18), 0.55, m, seed)


def model_plant(m, seed):
    cylinder("stem", (0, 0, -0.2), 0.13, 2.3, m["leaf"], vertices=9)
    for angle in [0, 1.26, 2.52, 3.78, 5.04]:
        x, z = math.cos(angle) * 0.68, math.sin(angle) * 0.68 + 0.72
        sphere("petal", (x, 0, z), (0.42, 0.16, 0.25), m["primary"], segments=12, rings=7)
    sphere("flower center", (0, -0.1, 0.72), (0.4, 0.2, 0.4), m["accent"], segments=12, rings=7)
    for side in [-1, 1]:
        sphere("leaf", (side * 0.48, 0.03, -0.42), (0.46, 0.12, 0.22), m["leaf"], segments=10, rings=6)


def model_mushroom(m, seed):
    for i, x in enumerate([-0.55, 0.1, 0.62]):
        h = [1.15, 1.7, 1.0][i]
        cylinder("mushroom stem", (x, 0, -0.65 + h / 2), 0.18 + i * 0.03, h, m["bone"], vertices=10)
        sphere("mushroom cap", (x, 0, -0.15 + h), (0.55 + i * 0.05, 0.38, 0.28), m["primary" if i != 1 else "accent"], segments=14, rings=8)


def model_wood(m, seed):
    for i, x in enumerate([-0.5, 0.4]):
        cylinder("cut log", (x, 0, -0.1 + i * 0.25), 0.48, 2.25, m["wood"], vertices=12, rot=(0.12, math.pi / 2, -0.15 + i * 0.22))
        cylinder("cut ring", (x - 0.98, -0.14, -0.1 + i * 0.25), 0.39, 0.08, m["wood_light"], vertices=12, rot=(0.12, math.pi / 2, -0.15 + i * 0.22))
    cylinder("binding rope", (0, -0.55, 0.1), 0.09, 2.1, m["paper"], vertices=10, rot=(0, math.pi / 2, 0))


def model_cloth(m, seed):
    cube("folded textile", (0, 0, -0.35), (1.15, 0.5, 0.55), m["cloth"], 0.18, rot=(0.08, 0, -0.1))
    cube("folded textile", (0.15, -0.08, 0.5), (1.05, 0.45, 0.43), m["primary"], 0.16, rot=(-0.04, 0.08, 0.12))
    for i in range(5):
        sphere("stitch", (-0.7 + i * 0.35, -0.52, 0.48), (0.07, 0.04, 0.07), m["accent"], segments=8, rings=5)


def model_bone(m, seed):
    cylinder("bone shaft", (0, 0, 0), 0.23, 2.25, m["bone"], vertices=10, rot=(0.2, 0.65, -0.25))
    for x, z in [(-0.75, -0.72), (-0.55, -1.0), (0.75, 0.72), (0.55, 1.0)]:
        sphere("bone end", (x, 0, z), (0.34, 0.28, 0.34), m["bone"], segments=12, rings=7)
    cube("hide swatch", (0.45, 0.22, -0.2), (0.75, 0.25, 0.9), m["cloth"], 0.24, rot=(0.1, -0.1, 0.25))


def model_powder(m, seed):
    cube("powder pouch", (0, 0.08, -0.42), (0.95, 0.48, 0.78), m["cloth"], 0.3)
    for i in range(7):
        rng = random.Random(seed + i)
        sphere("powder grain", (rng.uniform(-0.72, 0.72), -0.52, rng.uniform(0.2, 0.9)), (0.12, 0.06, 0.1), m["glow"] if i == 0 else m["accent"], segments=8, rings=5)
    rune((0, -0.5, -0.42), 0.56, m, seed)


def model_potion(m, seed):
    sphere("potion bottle", (0, 0, -0.15), (0.82, 0.5, 1.0), m["glow"], segments=20, rings=12)
    cylinder("bottle neck", (0, 0, 0.82), 0.28, 0.72, m["accent"], vertices=12)
    cylinder("large cork", (0, 0, 1.25), 0.36, 0.42, m["wood_light"], vertices=10)
    torus("bottle band", (0, 0, 0.72), 0.34, 0.08, m["gold"], rot=(0, 0, 0))
    rune((0, -0.52, -0.18), 0.52, m, seed)


def model_food(m, seed, kind):
    if kind == "fish":
        sphere("fish body", (0, 0, 0), (1.3, 0.42, 0.68), m["primary"], segments=16, rings=9)
        cone("tail", (-1.25, 0, 0), 0.72, 0.05, 0.9, m["accent"], vertices=3, rot=(0, math.pi / 2, 0))
        sphere("eye", (0.72, -0.4, 0.28), (0.1, 0.05, 0.1), m["black"], segments=8, rings=5)
    elif kind == "meal":
        sphere("bowl", (0, 0, -0.38), (1.12, 0.65, 0.62), m["wood_light"], segments=18, rings=10)
        sphere("hearty filling", (0, -0.15, 0.05), (0.92, 0.55, 0.38), m["primary"], segments=18, rings=10)
        cylinder("spoon", (0.72, -0.45, 0.68), 0.09, 1.8, m["steel"], vertices=10, rot=(0.2, 0.72, 0))
    elif kind == "bread":
        cube("bread loaf", (0, 0, 0), (1.25, 0.6, 0.8), m["wood_light"], 0.42, rot=(0.06, 0.08, -0.12))
        for i in [-0.52, 0, 0.52]:
            cube("bread score", (i, -0.62, 0.35), (0.08, 0.06, 0.42), m["paper"], 0.03, rot=(0, 0.35, 0))
    elif kind == "meat":
        sphere("meat cut", (0, 0, 0), (1.2, 0.52, 0.85), m["primary"], segments=16, rings=9)
        cylinder("bone", (0.85, 0, 0.18), 0.18, 1.25, m["bone"], vertices=10, rot=(0.1, 0.9, 0))
    elif kind == "banana":
        for i in range(6):
            angle = -0.75 + i * 0.28
            sphere("banana segment", (math.sin(angle) * 1.25, 0, math.cos(angle) * 0.72 - 0.15), (0.34, 0.28, 0.46), m["gold"], segments=12, rings=7)
        cylinder("banana stem", (-0.9, 0, 0.45), 0.1, 0.52, m["wood"], vertices=8, rot=(0, 0.5, 0))
    elif kind == "carrot":
        cone("carrot root", (0, 0, -0.25), 0.72, 0.08, 2.15, m["primary"], vertices=12, rot=(0.08, 0.18, -0.12))
        for angle in [-0.45, 0, 0.45]:
            cone("carrot leaf", (angle * 0.55, 0, 1.02), 0.22, 0.04, 1.05, m["leaf"], vertices=8, rot=(0, angle, 0))
    elif kind == "corn":
        cylinder("corn cob", (0, 0, 0), 0.58, 2.15, m["gold"], vertices=14, rot=(0.05, 0.2, -0.1))
        for side in [-1, 1]:
            cone("corn husk", (side * 0.48, 0.08, -0.15), 0.42, 0.08, 2.0, m["leaf"], vertices=8, rot=(0, side * 0.22, 0))
    elif kind == "berries":
        for i in range(8):
            angle = i * math.tau / 8
            sphere("berry", (math.cos(angle) * 0.62, math.sin(angle) * 0.12, math.sin(angle) * 0.62), (0.36, 0.3, 0.36), m["primary" if i % 3 else "accent"], segments=12, rings=7)
        sphere("berry leaf", (0.35, 0, 0.8), (0.52, 0.12, 0.24), m["leaf"], segments=10, rings=6)
    elif kind == "pumpkin":
        for x in [-0.48, 0, 0.48]:
            sphere("pumpkin lobe", (x, 0, 0), (0.66, 0.62, 0.95), m["primary"], segments=14, rings=8)
        cylinder("pumpkin stem", (0, 0, 0.98), 0.12, 0.5, m["wood"], vertices=8)
    elif kind == "root":
        sphere("root vegetable", (0, 0, -0.08), (0.9, 0.7, 0.92), m["primary"], segments=14, rings=8)
        cone("root tip", (0, 0, -1.05), 0.3, 0.02, 0.7, m["primary"], vertices=10)
        for angle in [-0.35, 0, 0.35]:
            cone("root greens", (angle * 0.55, 0, 0.95), 0.18, 0.03, 0.85, m["leaf"], vertices=8, rot=(0, angle, 0))
    else:
        sphere("fruit", (0, 0, -0.05), (0.98, 0.72, 1.02), m["primary"], segments=18, rings=10)
        cylinder("stem", (0.12, 0, 0.92), 0.1, 0.62, m["wood"], vertices=9, rot=(0.1, -0.25, 0))
        sphere("leaf", (0.55, 0, 0.88), (0.52, 0.12, 0.23), m["leaf"], segments=10, rings=6)


def model_parchment(m, seed, sealed=True):
    cube("thick parchment", (0, 0, 0), (1.12, 0.26, 1.35), m["paper"], 0.12, rot=(0.04, 0.15, -0.1))
    for z in [0.62, 0.25, -0.12]:
        cube("written line", (-0.15, -0.29, z), (0.62, 0.035, 0.045), m["dark"], 0.015, rot=(0, 0, -0.04))
    if sealed:
        cylinder("wax seal", (0.45, -0.36, -0.68), 0.33, 0.12, m["wax"], vertices=16, rot=(math.pi / 2, 0, 0))
        rune((0.45, -0.44, -0.68), 0.3, m, seed)


def model_token(m, seed):
    cylinder("heavy token", (0, 0, 0), 1.12, 0.26, m["gold"], vertices=16, rot=(math.pi / 2, 0, 0))
    cylinder("token inset", (0, -0.18, 0), 0.82, 0.08, m["primary"], vertices=16, rot=(math.pi / 2, 0, 0))
    rune((0, -0.27, 0), 0.92, m, seed)


def model_key(m, seed):
    torus("key bow", (0.72, 0, 0.7), 0.55, 0.16, m["gold"], rot=(math.pi / 2, 0, 0))
    cylinder("key shaft", (-0.15, 0, 0), 0.16, 2.1, m["gold"], vertices=10, rot=(0, 0.72, 0))
    cube("key tooth", (-0.92, 0, -0.62), (0.38, 0.18, 0.18), m["gold"], 0.05)
    cube("key tooth", (-0.62, 0, -0.88), (0.18, 0.18, 0.35), m["gold"], 0.05)


def model_crate(m, seed, chest=False):
    cube("container", (0, 0, -0.05), (1.15, 0.72, 0.95), m["wood"], 0.12, rot=(0.03, 0.08, -0.06))
    for x in [-0.86, 0.86]:
        cube("metal corner", (x, -0.73, -0.05), (0.12, 0.08, 0.92), m["steel"], 0.04)
    cube("container band", (0, -0.76, 0), (1.12, 0.08, 0.12), m["steel"], 0.04)
    if chest:
        torus("chest handle", (0, -0.92, 0.15), 0.36, 0.08, m["gold"], rot=(math.pi / 2, 0, 0))
    rune((0, -0.86, -0.35), 0.52, m, seed)


def model_book(m, seed):
    cube("book cover", (0, 0, 0), (1.12, 0.34, 1.35), m["primary"], 0.12, rot=(0.08, 0.18, -0.12))
    cube("page block", (0.08, -0.18, 0), (0.98, 0.28, 1.22), m["paper"], 0.08, rot=(0.08, 0.18, -0.12))
    cube("book spine", (-1.02, -0.2, 0), (0.17, 0.4, 1.3), m["gold"], 0.06, rot=(0.08, 0.18, -0.12))
    rune((0.15, -0.56, 0), 0.75, m, seed)


def model_furniture(m, seed, kind):
    if kind == "chair":
        cube("seat", (0, 0, -0.1), (0.85, 0.72, 0.18), m["wood_light"], 0.08)
        cube("chair back", (0, 0.55, 0.82), (0.85, 0.16, 0.95), m["wood"], 0.1)
        for x in [-0.65, 0.65]:
            for y in [-0.48, 0.48]:
                cylinder("chair leg", (x, y, -0.92), 0.09, 1.55, m["wood"], vertices=8)
    elif kind == "bed":
        cube("bed frame", (0, 0, -0.45), (1.45, 0.78, 0.2), m["wood"], 0.1, rot=(0, 0, -0.12))
        cube("mattress", (0, -0.05, -0.12), (1.25, 0.7, 0.28), m["cloth"], 0.18, rot=(0, 0, -0.12))
        cube("pillow", (-0.82, -0.1, 0.22), (0.38, 0.56, 0.18), m["white"], 0.18, rot=(0, 0, -0.12))
    elif kind == "table":
        cube("table top", (0, 0, 0.3), (1.35, 0.8, 0.18), m["wood_light"], 0.1, rot=(0, 0, -0.1))
        for x in [-0.95, 0.95]:
            for y in [-0.5, 0.5]:
                cylinder("table leg", (x, y, -0.65), 0.1, 1.65, m["wood"], vertices=8)
    else:
        cube("cabinet body", (0, 0, 0), (1.0, 0.58, 1.35), m["wood"], 0.12, rot=(0.02, 0.08, -0.08))
        for z in [-0.6, 0.05, 0.7]:
            cube("shelf", (0, -0.63, z), (0.85, 0.08, 0.09), m["wood_light"], 0.04)
        rune((0, -0.72, 0), 0.52, m, seed)


def model_machine(m, seed):
    cube("machine base", (0, 0, -0.45), (1.12, 0.72, 0.72), m["steel"], 0.18, rot=(0, 0.1, -0.08))
    cylinder("machine chamber", (0.2, 0, 0.5), 0.62, 1.35, m["primary"], vertices=12)
    torus("machine ring", (0.2, 0, 0.58), 0.65, 0.12, m["gold"])
    for x in [-0.65, 0.9]:
        cylinder("machine pipe", (x, 0, 0.4), 0.12, 1.55, m["steel"], vertices=10)
    sphere("energy core", (0.2, -0.62, 0.5), (0.35, 0.16, 0.35), m["glow"], segments=12, rings=7)


def model_lamp(m, seed):
    cylinder("lamp post", (0, 0, -0.4), 0.14, 1.7, m["steel"], vertices=10)
    cube("lantern", (0, 0, 0.55), (0.62, 0.46, 0.72), m["gold"], 0.16)
    sphere("lantern glow", (0, -0.48, 0.55), (0.42, 0.12, 0.48), m["glow"], segments=12, rings=7)
    cone("lamp roof", (0, 0, 1.28), 0.82, 0.12, 0.5, m["steel"], vertices=4)


def model_frame(m, seed):
    for x in [-1.0, 1.0]:
        cube("picture frame side", (x, 0, 0), (0.14, 0.16, 1.35), m["wood_light"], 0.06)
    for z in [-1.2, 1.2]:
        cube("picture frame edge", (0, 0, z), (1.0, 0.16, 0.14), m["wood_light"], 0.06)
    cube("framed field", (0, 0.16, 0), (0.86, 0.08, 1.05), m["primary"], 0.08)
    rune((0, -0.02, 0), 0.9, m, seed)


def model_fish_trophy(m, seed):
    cube("mounting plaque", (0, 0.22, 0), (1.35, 0.18, 0.82), m["wood"], 0.24)
    sphere("mounted fish", (0.05, -0.28, 0), (1.05, 0.32, 0.5), m["primary"], segments=16, rings=9)
    cone("mounted tail", (-1.02, -0.28, 0), 0.6, 0.04, 0.72, m["accent"], vertices=3, rot=(0, math.pi / 2, 0))
    sphere("fish eye", (0.65, -0.56, 0.2), (0.1, 0.05, 0.1), m["black"], segments=8, rings=5)


def model_candle(m, seed):
    cylinder("thick candle", (0, 0, -0.2), 0.58, 1.75, m["white"], vertices=14)
    for z in [-0.65, -0.2, 0.25]:
        torus("wax ring", (0, 0, z), 0.56, 0.05, m["paper"])
    cone("candle flame", (0, 0, 1.02), 0.34, 0.02, 0.88, m["glow"], vertices=10)
    cylinder("candle base", (0, 0, -1.08), 0.82, 0.18, m["gold"], vertices=14)


def model_armor(m, seed, cloak=False):
    if cloak:
        cone("cloak", (0, 0, -0.1), 1.15, 0.52, 2.6, m["cloth"], vertices=12, rot=(0.04, 0, 0))
        torus("cloak clasp", (0, -0.52, 0.92), 0.28, 0.09, m["gold"], rot=(math.pi / 2, 0, 0))
    else:
        cube("chest armor", (0, 0, 0), (1.0, 0.5, 1.2), m["primary"], 0.28)
        for x in [-0.85, 0.85]:
            sphere("shoulder plate", (x, 0, 0.62), (0.48, 0.42, 0.42), m["steel"], segments=12, rings=7)
        cube("armor belt", (0, -0.54, -0.45), (1.02, 0.08, 0.16), m["gold"], 0.05)


def model_tool(m, seed, kind):
    if kind in {"bucket", "pail"}:
        cone("bucket", (0, 0, -0.2), 0.78, 1.0, 1.55, m["steel"], vertices=14)
        torus("bucket handle", (0, 0, 0.55), 0.95, 0.09, m["wood_light"], rot=(math.pi / 2, 0, 0))
    elif kind == "broom":
        cylinder("broom handle", (0, 0, 0), 0.12, 3.0, m["wood_light"], vertices=10, rot=(0, 0.58, -0.12))
        cone("broom bristles", (-0.8, 0, -1.1), 0.65, 0.28, 1.1, m["paper"], vertices=12, rot=(0, 0.58, -0.12))
    elif kind == "wrench":
        cylinder("wrench handle", (0, 0, 0), 0.19, 2.45, m["steel"], vertices=10, rot=(0, 0.62, -0.1))
        torus("wrench ring", (0.78, 0, 1.02), 0.48, 0.16, m["steel"], rot=(math.pi / 2, 0, 0))
        cube("wrench jaw", (-0.78, 0, -1.0), (0.48, 0.22, 0.16), m["steel"], 0.08, rot=(0, 0.62, -0.1))
    elif kind == "torch":
        cylinder("torch handle", (0, 0, -0.25), 0.16, 2.5, m["wood"], vertices=10, rot=(0, 0.35, -0.08))
        cone("torch flame", (0.55, 0, 0.98), 0.5, 0.05, 1.05, m["glow"], vertices=10, rot=(0, 0.35, -0.08))
        torus("torch collar", (0.4, 0, 0.65), 0.28, 0.1, m["steel"], rot=(0.35, 0, 0))
    elif kind in {"shovel", "spade"}:
        cylinder("shovel handle", (-0.25, 0, 0.1), 0.13, 2.65, m["wood"], vertices=10, rot=(0, 0.4, -0.08))
        cone("shovel blade", (0.55, 0, -1.02), 0.52, 0.22, 0.95, m["steel"], vertices=5, rot=(0, 0.4, -0.08))
    elif kind == "hoe":
        cylinder("hoe handle", (-0.2, 0, 0), 0.13, 2.8, m["wood"], vertices=10, rot=(0, 0.45, -0.08))
        cube("hoe blade", (0.68, 0, 0.95), (0.65, 0.18, 0.2), m["steel"], 0.08, rot=(0, 0.15, -0.08))
    elif kind == "rake":
        cylinder("rake handle", (-0.15, 0, -0.05), 0.12, 2.7, m["wood"], vertices=10, rot=(0, 0.42, -0.08))
        cube("rake bar", (0.7, 0, 1.0), (0.75, 0.16, 0.12), m["steel"], 0.06)
        for i in range(5):
            cylinder("rake tine", (0.15 + i * 0.28, 0, 0.68), 0.045, 0.68, m["steel"], vertices=8)
    elif kind == "hook":
        cylinder("hook handle", (-0.45, 0, -0.45), 0.15, 1.65, m["wood"], vertices=10, rot=(0, 0.55, 0))
        torus("scavenger hook", (0.5, 0, 0.55), 0.66, 0.14, m["steel"], rot=(math.pi / 2, 0, 0))
        cube("hook opening", (0.15, -0.02, 1.0), (0.5, 0.25, 0.38), m["black"], 0.1)
    elif kind == "axe":
        cylinder("axe handle", (-0.25, 0, -0.15), 0.14, 2.65, m["wood"], vertices=10, rot=(0, 0.5, -0.08))
        cube("woodcutter blade", (0.62, 0, 0.88), (0.68, 0.19, 0.48), m["steel"], 0.15, rot=(0, 0.2, -0.08))
    elif kind in {"cleaver", "sickle"}:
        cylinder("tool handle", (-0.55, 0, -0.72), 0.16, 1.25, m["wood"], vertices=10, rot=(0, 0.62, 0))
        cube("wide blade", (0.35, 0, 0.28), (0.72, 0.2, 0.82), m["steel"], 0.16, rot=(0, 0.25, -0.12))
        rune((0.35, -0.24, 0.28), 0.42, m, seed)
    else:
        cylinder("tool handle", (-0.38, 0, -0.55), 0.15, 2.4, m["wood"], vertices=10, rot=(0, 0.58, -0.08))
        cube("tool head", (0.48, 0, 0.74), (0.78, 0.24, 0.38), m["steel"], 0.16, rot=(0, 0.18, -0.08))
        cube("tool accent", (0.75, -0.28, 0.95), (0.32, 0.07, 0.16), m["accent"], 0.04)


def model_weapon(m, seed, kind):
    cylinder("wrapped grip", (-0.58, 0, -0.76), 0.16, 1.18, m["wood"], vertices=10, rot=(0, 0.58, -0.08))
    cube("cross guard", (-0.18, 0, -0.22), (0.7, 0.18, 0.12), m["gold"], 0.08, rot=(0, 0.1, -0.08))
    blade_length = 1.55 if kind == "dagger" else 2.35
    blade_center = 0.45 if kind == "dagger" else 0.78
    cube("hero blade", (blade_center, 0, 0.62), (0.22, 0.12, blade_length / 2), m["steel"], 0.1, rot=(0, 0.58, -0.08))
    cone("blade point", (1.22 if kind == "dagger" else 1.55, 0, 1.62 if kind == "dagger" else 2.12), 0.3, 0.02, 0.72, m["steel"], vertices=4, rot=(0, 0.58, -0.08))
    rune((0.62, -0.16, 0.88), 0.38, m, seed)


def classify(target):
    text = f"{target['id']} {target['name']}".lower()
    category = target["category"]
    if category == "armor": return "cloak" if "cloak" in text else "armor"
    if "knot marker" in text: return "token"
    if category == "key": return "key"
    if category == "trophy": return "trophy"
    if category == "event_item": return "token"
    if category == "weapon": return "weapon:dagger" if "dagger" in text else "weapon:sword"
    if category == "tool":
        for key in ["bucket", "pail", "broom", "wrench", "cleaver", "sickle", "torch", "shovel", "spade", "hoe", "rake", "hook", "axe"]:
            if key in text: return f"tool:{key}"
        return "tool:generic"
    if "seed" in text and "seed mill" not in text: return "seed"
    if "spore" in text: return "mushroom"
    if any(x in text for x in ["log", "lumber", "stripped", "reinforced", "heartwood"]): return "wood"
    if any(x in text for x in ["azalea", "bellflower", "cosmos", "dandelion", "daylily", "lilac", "marigold", "morning glory", "nettle", "orchid", "peace lily", "peacebloom", "peony", "plumeria", "rose", "sakura", "sunflower", "ultra violet", "basic plant"]): return "plant"
    if "fertilizer" in text: return "powder"
    if "candle" in text: return "candle"
    if "photo frame" in text: return "frame"
    if any(x in text for x in ["cell", "bull's core", "utility core", "mana essence"]): return "crystal"
    if "rubber" == target["name"].strip().lower(): return "resource"
    if category in {"food", "consumable"}:
        if any(x in text for x in ["potion", "draught", "medicine", "antidote", "salve", "coffee", "milk", "smoothie", "cola", "vial", "water", "tea", "drink"]): return "potion"
        if any(x in text for x in ["stew", "soup", "meal", "ration", "sashimi", "sandwich", "burger", "popcorn", "tart"]): return "food:meal"
        if any(x in text for x in ["fish", "trout"]): return "food:fish"
        if any(x in text for x in ["bread", "loaf", "toast"]): return "food:bread"
        if any(x in text for x in ["meat", "patty", "skewer"]): return "food:meat"
        if any(x in text for x in ["mushroom", "muckshroom"]): return "mushroom"
        if "banana" in text: return "food:banana"
        if "carrot" in text: return "food:carrot"
        if "corn" in text: return "food:corn"
        if any(x in text for x in ["grape", "raspberry", "strawberry", "berries", "berry"]): return "food:berries"
        if "pumpkin" in text: return "food:pumpkin"
        if any(x in text for x in ["onion", "potato", "radish", "turnip"]): return "food:root"
        return "food:fruit"
    if category == "quest_item":
        if any(x in text for x in ["key", "marker"]): return "key"
        if any(x in text for x in ["token", "coin", "seal", "mark", "badge"]): return "token"
        if any(x in text for x in ["crate", "parcel", "package", "pail", "container"]): return "crate"
        if any(x in text for x in ["vial", "ampoule", "sample", "reagent", "salve", "tea"]): return "potion"
        if any(x in text for x in ["letter", "note", "ledger", "report", "record", "writ", "map", "card", "pass", "folio", "order", "manifest", "notes"]): return "parchment"
        return "proof"
    if category == "trade_good":
        if any(x in text for x in ["coin", "token", "button", "missing piece"]): return "token"
        if any(x in text for x in ["book", "guide", "manual", "primer", "treatise", "sampler", "pages", "ledger", "notes"]): return "book"
        if any(x in text for x in ["crate", "chest", "lockbox", "mailbox", "container", "tray"]): return "crate"
        if "frame" in text: return "frame"
        if "wall mount" in text: return "fish_trophy"
        if any(x in text for x in ["forge", "workbench", "alchemy bench", "repair bench", "machine", "kiln", "thermo", "station", "mill", "stonecutter", "arcade", "dye-o-matic", "record player", "boombox", "loom"]): return "machine"
        if any(x in text for x in ["chair"]): return "furniture:chair"
        if any(x in text for x in ["bed"]): return "furniture:bed"
        if any(x in text for x in ["table", "bench"]): return "furniture:table"
        if any(x in text for x in ["shelf", "cabinet", "wardrobe", "booth", "counter"]): return "furniture:cabinet"
        if any(x in text for x in ["lamp", "lantern", "light", "panel"]): return "lamp"
        if any(x in text for x in ["forge", "bench", "machine", "kiln", "thermo", "station", "mill", "cutter"]): return "machine"
        return "crate"
    if any(x in text for x in ["seed", "spore"]): return "seed" if "spore" not in text else "mushroom"
    if any(x in text for x in ["mushroom", "fungus", "muckshroom"]): return "mushroom"
    if any(x in text for x in ["flower", "leaf", "herb", "moss", "lily", "rose", "orchid", "azalea", "plumeria", "marigold", "nightshade", "nettle", "lotus", "hemp", "flax", "ramie"]): return "plant"
    if any(x in text for x in ["log", "wood", "lumber", "bark", "branch", "willow", "timber", "plank", "pitch"]): return "wood"
    if any(x in text for x in ["capsule", "coolant"]): return "potion"
    if any(x in text for x in ["ingot", "nugget", "metal", "scrap"]): return "ingot"
    if any(x in text for x in ["crystal", "shard", "pearl", "moonstone", "diamond", "emberstone", "core", "garnet", "gem", "essence"]): return "crystal"
    if any(x in text for x in ["ore", "coal"]): return "ore"
    if any(x in text for x in ["brick", "block", "stone", "granite", "limestone", "quartzite", "basalt", "clay", "cobble", "shingle", "asphalt"]): return "block"
    if any(x in text for x in ["cloth", "cotton", "fiber", "fabric", "leather", "hide", "fur", "wool", "linen", "scrap"]): return "cloth"
    if any(x in text for x in ["bone", "fang", "antler", "bristle", "tusk"]): return "bone"
    if any(x in text for x in ["dust", "ash", "flour", "reagent", "extract", "waste", "compost", "grain"]): return "powder"
    return "resource"


def build_model(target, m):
    kind = classify(target)
    seed = stable_seed(target["id"])
    if kind == "block": model_block(m, seed)
    elif kind == "ore": model_ore(m, seed)
    elif kind == "ingot": model_ingot(m, seed)
    elif kind == "crystal": model_crystal(m, seed)
    elif kind == "seed": model_seed(m, seed)
    elif kind == "plant": model_plant(m, seed)
    elif kind == "mushroom": model_mushroom(m, seed)
    elif kind == "wood": model_wood(m, seed)
    elif kind == "cloth": model_cloth(m, seed)
    elif kind == "bone": model_bone(m, seed)
    elif kind == "powder" or kind == "resource": model_powder(m, seed)
    elif kind == "potion": model_potion(m, seed)
    elif kind.startswith("food:"): model_food(m, seed, kind.split(":", 1)[1])
    elif kind == "parchment" or kind == "proof": model_parchment(m, seed, sealed=True)
    elif kind == "token": model_token(m, seed)
    elif kind == "trophy":
        sphere("trophy head", (0, 0, 0.15), (0.92, 0.65, 0.82), m["primary"], segments=14, rings=8)
        for side in [-1, 1]:
            cone("trophy horn", (side * 0.82, 0, 0.72), 0.34, 0.03, 1.1, m["bone"], vertices=8, rot=(0, side * 0.55, 0))
        sphere("trophy eye", (-0.32, -0.62, 0.22), (0.12, 0.06, 0.12), m["glow"], segments=8, rings=5)
        sphere("trophy eye", (0.32, -0.62, 0.22), (0.12, 0.06, 0.12), m["glow"], segments=8, rings=5)
        cube("trophy plaque", (0, 0.12, -1.08), (0.95, 0.32, 0.28), m["wood"], 0.12)
    elif kind == "key": model_key(m, seed)
    elif kind == "crate": model_crate(m, seed, chest="chest" in target["name"].lower())
    elif kind == "book": model_book(m, seed)
    elif kind.startswith("furniture:"): model_furniture(m, seed, kind.split(":", 1)[1])
    elif kind == "machine": model_machine(m, seed)
    elif kind == "lamp": model_lamp(m, seed)
    elif kind == "frame": model_frame(m, seed)
    elif kind == "fish_trophy": model_fish_trophy(m, seed)
    elif kind == "candle": model_candle(m, seed)
    elif kind == "armor": model_armor(m, seed, False)
    elif kind == "cloak": model_armor(m, seed, True)
    elif kind.startswith("tool:"): model_tool(m, seed, kind.split(":", 1)[1])
    elif kind.startswith("weapon:"): model_weapon(m, seed, kind.split(":", 1)[1])
    else: model_powder(m, seed)
    return kind


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_scene(target):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    ITEM_OBJECTS.clear()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.compression = 15
    scene.render.fps = 24
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.color_mode = "RGBA"

    primary, accent, dark = palette(target["id"], target["category"])
    world = scene.world or bpy.data.worlds.new("Icon World")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*tuple(c * 0.08 for c in dark), 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22

    shadow = material("shadow", (0.008, 0.01, 0.015, 0.42), roughness=1)
    sphere(
        "contact shadow",
        (0, 0.65, -1.72),
        (1.35, 0.55, 0.12),
        shadow,
        segments=24,
        rings=10,
        item=False,
    )

    bpy.ops.object.camera_add(location=(6.8, -10.4, 5.8))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 5.8
    camera.data.lens = 62
    look_at(camera, (0, 0, 0.05))
    scene.camera = camera

    lights = [
        ((-4.8, -5.2, 7.5), 1050, 4.2, (1.0, 0.76, 0.55)),
        ((5.5, -4.0, 3.2), 720, 4.0, (0.48, 0.68, 1.0)),
        ((2.2, 3.6, 6.8), 1250, 3.2, (0.7, 0.82, 1.0)),
    ]
    for index, (loc, energy, size, color) in enumerate(lights):
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.object
        light.name = f"Studio light {index}"
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        look_at(light, (0, 0, 0))


def render_target(target, force=False):
    final_path = OUTPUT_DIR / target["file"]
    if final_path.exists() and not force:
        return "skipped", classify(target)
    setup_scene(target)
    mats = mats_for(target)
    kind = build_model(target, mats)

    root = bpy.data.objects.new("Hero composition", None)
    bpy.context.collection.objects.link(root)
    for obj in ITEM_OBJECTS:
        obj.parent = root
    root.rotation_euler = (math.radians(4), math.radians(-8), math.radians(-8))
    if target["category"] in {"tool", "armor"}:
        root.rotation_euler.z = math.radians(-15)

    HIRES_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    hires_path = HIRES_DIR / target["file"]
    scene = bpy.context.scene
    scene.render.filepath = str(hires_path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(hires_path), check_existing=False)
    image.scale(256, 256)
    image.filepath_raw = str(final_path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)
    hires_path.unlink(missing_ok=True)
    return "rendered", kind


def main():
    args = cli_args()
    payload = json.loads(TARGETS_PATH.read_text())
    targets = payload["targets"]
    if args.only:
        needles = [part.strip().lower() for part in args.only.split(",") if part.strip()]
        targets = [
            t
            for t in targets
            if any(needle in f"{t['id']} {t['name']}".lower() for needle in needles)
        ]
    if args.limit:
        targets = targets[: args.limit]
    counts = {"rendered": 0, "skipped": 0}
    kinds = {}
    for index, target in enumerate(targets, 1):
        status, kind = render_target(target, force=args.force)
        counts[status] += 1
        kinds[kind] = kinds.get(kind, 0) + 1
        print(f"[{index}/{len(targets)}] {status}: {target['name']} ({kind})", flush=True)
    print(json.dumps({"targets": len(targets), **counts, "kinds": kinds}, indent=2))


if __name__ == "__main__":
    main()
