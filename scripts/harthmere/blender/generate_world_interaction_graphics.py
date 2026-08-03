#!/usr/bin/env python3
"""Generate optimized Blender graphics for Harthmere gathering nodes and boards.

The generated GLBs are presentation only. Gathering authority, F interaction,
tool/skill checks, respawn, yields, board proximity, and jobs-board mutations
remain owned by the existing native/server systems.

Coordinate contract:
  Blender X -> world X
  Blender Y -> world Z
  Blender Z -> world height
  One Blender unit -> one world meter
  Every asset is grounded at local Z=0 with a bottom-center pivot.

Run:
  blender --factory-startup --background \
    --python scripts/harthmere/blender/generate_world_interaction_graphics.py -- \
    --repo-root "$PWD" --render-previews
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import struct
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import bpy
from mathutils import Vector


GENERATOR_VERSION = 3
ASSET_VERSION = "harthmere-world-interaction-graphics-blender-v3"


@dataclass(frozen=True)
class GatheringNodeGraphic:
    node_id: str
    display_name: str
    profession: str
    archetype: str
    colors: tuple[tuple[float, float, float], ...]


@dataclass
class BuildContext:
    slug: str
    lod: int
    collection: bpy.types.Collection
    materials: dict[str, bpy.types.Material]
    objects: list[bpy.types.Object]


GATHERING_NODES: tuple[GatheringNodeGraphic, ...] = (
    GatheringNodeGraphic("harthmere_north_iron_vein", "North Road Iron Vein", "mining", "iron_vein", ((0.25, 0.27, 0.29), (0.48, 0.52, 0.55), (0.54, 0.23, 0.10))),
    GatheringNodeGraphic("harthmere_orchard_softwood", "Orchard Softwood Branches", "logging", "softwood_branches", ((0.30, 0.16, 0.07), (0.52, 0.32, 0.12), (0.22, 0.48, 0.20))),
    GatheringNodeGraphic("harthmere_temple_peacebloom", "Temple Peacebloom Bed", "herbalism", "peacebloom", ((0.20, 0.42, 0.20), (0.77, 0.82, 0.72), (0.86, 0.68, 0.28))),
    GatheringNodeGraphic("harthmere_river_fishing_pool", "Bluewater Fishing Pool", "fishing", "fishing_pool", ((0.12, 0.35, 0.52), (0.28, 0.62, 0.72), (0.52, 0.40, 0.20))),
    GatheringNodeGraphic("harthmere_farm_crops", "Farm Crop Row", "farming", "crop_row", ((0.30, 0.19, 0.08), (0.72, 0.60, 0.20), (0.20, 0.55, 0.18))),
    GatheringNodeGraphic("harthmere_mudden_scrap", "Mudden Ward Scrap Pile", "scavenging", "scrap_pile", ((0.20, 0.22, 0.24), (0.48, 0.34, 0.20), (0.62, 0.26, 0.14))),
    GatheringNodeGraphic("harthmere_river_clay", "Riverbank Clay Deposit", "scavenging", "river_clay", ((0.42, 0.24, 0.15), (0.66, 0.39, 0.24), (0.20, 0.48, 0.62))),
    GatheringNodeGraphic("harthmere_old_well_essence", "Old Well Mana Residue", "magical_harvesting", "mana_residue", ((0.22, 0.18, 0.30), (0.42, 0.20, 0.68), (0.62, 0.42, 0.90))),
    GatheringNodeGraphic("harthmere_chapel_relic_dig", "Old Grave Relic Dig", "archaeology", "relic_dig", ((0.30, 0.26, 0.22), (0.67, 0.56, 0.38), (0.73, 0.62, 0.25))),
    GatheringNodeGraphic("harthmere_wolf_carcass", "Road Wolf Carcass", "skinning", "wolf_harvest", ((0.26, 0.25, 0.24), (0.48, 0.43, 0.38), (0.58, 0.18, 0.12))),
    GatheringNodeGraphic("greenmere_oak_grove", "Greenmere Oak Grove", "logging", "oak_grove", ((0.28, 0.14, 0.05), (0.48, 0.28, 0.09), (0.19, 0.43, 0.17))),
    GatheringNodeGraphic("north_pine_stand", "North Greenmere Pine Stand", "logging", "pine_stand", ((0.23, 0.13, 0.06), (0.40, 0.25, 0.10), (0.10, 0.35, 0.19))),
    GatheringNodeGraphic("old_wood_birch_grove", "Old Wood Birch Grove", "logging", "birch_grove", ((0.78, 0.75, 0.67), (0.25, 0.24, 0.22), (0.36, 0.52, 0.22))),
    GatheringNodeGraphic("briarfen_willow_cuttings", "Briarfen Willow Cuttings", "logging", "willow_cuttings", ((0.36, 0.26, 0.12), (0.60, 0.49, 0.27), (0.24, 0.48, 0.28))),
    GatheringNodeGraphic("watchtower_iron_cut", "Watchtower Iron Cut", "mining", "iron_cut", ((0.18, 0.20, 0.22), (0.40, 0.43, 0.46), (0.55, 0.20, 0.08))),
    GatheringNodeGraphic("bandit_ridge_coal_seam", "Bandit Ridge Coal Seam", "mining", "coal_seam", ((0.05, 0.055, 0.06), (0.15, 0.16, 0.17), (0.60, 0.28, 0.08))),
    GatheringNodeGraphic("old_wood_silver_thread", "Old Wood Silver Thread", "mining", "silver_thread", ((0.24, 0.25, 0.27), (0.72, 0.75, 0.78), (0.40, 0.55, 0.68))),
    GatheringNodeGraphic("gravewood_gold_fragment", "Gravewood Gold Fragment", "mining", "gold_fragment", ((0.20, 0.18, 0.15), (0.80, 0.58, 0.12), (0.93, 0.76, 0.22))),
    GatheringNodeGraphic("greenmere_berry_thicket", "Greenmere Berry Thicket", "herbalism", "berry_thicket", ((0.13, 0.40, 0.15), (0.42, 0.10, 0.24), (0.65, 0.18, 0.42))),
    GatheringNodeGraphic("old_wood_mushroom_ring", "Old Wood Mushroom Ring", "herbalism", "mushroom_ring", ((0.34, 0.22, 0.12), (0.70, 0.58, 0.38), (0.55, 0.16, 0.22))),
    GatheringNodeGraphic("briarfen_reed_bed", "Briarfen Reed Bed", "scavenging", "reed_bed", ((0.22, 0.42, 0.20), (0.55, 0.47, 0.18), (0.30, 0.18, 0.09))),
    GatheringNodeGraphic("briarfen_clay_bank", "Briarfen Blackwater Clay Bank", "scavenging", "blackwater_clay", ((0.18, 0.16, 0.14), (0.34, 0.24, 0.20), (0.12, 0.30, 0.36))),
    GatheringNodeGraphic("gravewood_moss_and_nightshade", "Gravewood Moss and Nightshade", "herbalism", "nightshade", ((0.16, 0.34, 0.18), (0.30, 0.12, 0.38), (0.58, 0.24, 0.66))),
    GatheringNodeGraphic("gate_field_flax_row", "Gate Field Flax Row", "farming", "flax_row", ((0.27, 0.20, 0.10), (0.22, 0.48, 0.22), (0.35, 0.48, 0.78))),
    GatheringNodeGraphic("orchard_honey_hive", "Orchard Honey Hive", "farming", "honey_hive", ((0.30, 0.17, 0.07), (0.73, 0.46, 0.10), (0.92, 0.68, 0.16))),
    GatheringNodeGraphic("deer_hunting_trail", "Deer Hunting Trail", "skinning", "deer_harvest", ((0.32, 0.23, 0.16), (0.58, 0.43, 0.30), (0.72, 0.66, 0.52))),
    GatheringNodeGraphic("boar_sounder_harvest", "Boar Sounder Harvest", "skinning", "boar_harvest", ((0.20, 0.15, 0.12), (0.43, 0.28, 0.19), (0.72, 0.64, 0.50))),
    GatheringNodeGraphic("bear_den_harvest", "Black Bear Den Harvest", "skinning", "bear_harvest", ((0.08, 0.07, 0.065), (0.23, 0.18, 0.14), (0.62, 0.52, 0.38))),
    GatheringNodeGraphic("gravewood_zombie_remains", "Bell-Woken Zombie Remains", "monster_harvesting", "zombie_remains", ((0.22, 0.23, 0.20), (0.39, 0.50, 0.22), (0.47, 0.22, 0.16))),
)


JOBS_BOARD_VARIANTS = {
    "blue": (0.10, 0.55, 0.78),
    "amber": (0.88, 0.50, 0.12),
    "rose": (0.72, 0.20, 0.42),
    "green": (0.36, 0.58, 0.14),
    "violet": (0.52, 0.28, 0.72),
}


REQUEST_BOARD_VARIANTS = {
    "fishing": {
        "displayName": "Fishing Board",
        "accent": (0.12, 0.48, 0.72),
    },
    "farming": {
        "displayName": "Farming Bounties",
        "accent": (0.36, 0.62, 0.18),
    },
    "industrial": {
        "displayName": "Industrial Job Board",
        "accent": (0.78, 0.36, 0.10),
    },
    "research": {
        "displayName": "Collective Research Board",
        "accent": (0.45, 0.28, 0.76),
    },
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--render-previews", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    parser.add_argument("--gathering-only", action="store_true")
    parser.add_argument("--request-boards-only", action="store_true")
    return parser.parse_args(argv)


def blender_safe_name(name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_")
    return (safe or "harthmere_asset")[:58]


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def make_material(
    name: str,
    color: tuple[float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.72,
    emission: tuple[float, float, float] | None = None,
    alpha: float = 1.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(blender_safe_name(name))
    material.diffuse_color = (*color, alpha)
    if alpha < 1:
        material.surface_render_method = "DITHERED"
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        metallic_input = bsdf.inputs.get("Metallic") or bsdf.inputs.get(
            "Metallic IOR Level"
        )
        if metallic_input:
            metallic_input.default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Alpha"].default_value = alpha
        if emission:
            emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get(
                "Emission"
            )
            if emission_input:
                emission_input.default_value = (*emission, 1.0)
            strength_input = bsdf.inputs.get("Emission Strength")
            if strength_input:
                strength_input.default_value = 0.35
    return material


def material_set(slug: str, colors: tuple[tuple[float, float, float], ...]) -> dict[str, bpy.types.Material]:
    base, accent, highlight = colors[0], colors[1], colors[2]
    return {
        "base": make_material(f"{slug}_base", base),
        "accent": make_material(f"{slug}_accent", accent),
        "ore": make_material(
            f"{slug}_ore", highlight, metallic=0.16, roughness=0.58
        ),
        "highlight": make_material(f"{slug}_highlight", highlight, emission=highlight),
        "dark": make_material(f"{slug}_dark", tuple(channel * 0.42 for channel in base)),
        "wood": make_material(f"{slug}_wood", (0.30, 0.17, 0.075)),
        "stone": make_material(f"{slug}_stone", (0.34, 0.35, 0.36)),
        "green": make_material(f"{slug}_green", (0.18, 0.42, 0.18)),
        "paper": make_material(f"{slug}_paper", (0.78, 0.66, 0.43)),
        "metal": make_material(f"{slug}_metal", (0.36, 0.38, 0.40), metallic=0.55, roughness=0.42),
        "water": make_material(f"{slug}_water", (0.12, 0.40, 0.58), roughness=0.24, alpha=0.72),
        "bone": make_material(f"{slug}_bone", (0.72, 0.68, 0.55)),
    }


def finish_object(ctx: BuildContext, obj: bpy.types.Object, material_key: str, bevel: float = 0.025) -> bpy.types.Object:
    obj.name = blender_safe_name(obj.name)
    if obj.data:
        obj.data.name = blender_safe_name(f"{obj.name}_mesh")
    obj.data.materials.append(ctx.materials[material_key])
    if bevel > 0 and ctx.lod == 0:
        modifier = obj.modifiers.new(name="Edge_bevel", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    ctx.objects.append(obj)
    return obj


def box(ctx: BuildContext, name: str, dimensions, location, material="base", rotation=(0.0, 0.0, 0.0), bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(ctx, obj, material, bevel)


def cylinder(ctx: BuildContext, name: str, radius: float, depth: float, location, material="base", rotation=(0.0, 0.0, 0.0), vertices: int | None = None, bevel=0.018):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices or (10 if ctx.lod == 0 else 6),
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish_object(ctx, obj, material, bevel)


def cone(ctx: BuildContext, name: str, radius1: float, radius2: float, depth: float, location, material="base", rotation=(0.0, 0.0, 0.0), vertices: int | None = None):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices or (8 if ctx.lod == 0 else 5),
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish_object(ctx, obj, material, 0.015)


def ico(ctx: BuildContext, name: str, radius: float, location, material="base", scale=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(ctx, obj, material, 0.0)


def torus(ctx: BuildContext, name: str, major_radius: float, minor_radius: float, location, material="base", rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=12 if ctx.lod == 0 else 8,
        minor_segments=6 if ctx.lod == 0 else 4,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish_object(ctx, obj, material, 0.0)


def branch(ctx: BuildContext, name: str, start, end, radius: float, material="wood"):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    midpoint = (start_v + end_v) * 0.5
    obj = cylinder(ctx, name, radius, delta.length, midpoint, material, vertices=7 if ctx.lod == 0 else 5)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    return obj


def ground_pad(ctx: BuildContext, material="stone", size=(2.5, 2.0), height=0.16):
    # Gathering landmarks sit directly on the world's terrain. The old solid
    # rectangular pads read as artificial backplates when placed on hills,
    # roads, grass, or mud, so they are intentionally omitted from every LOD.
    return None


def ground_objects_at_origin(ctx: BuildContext) -> None:
    """Keep the remaining silhouette grounded after omitting its old pad."""
    if not ctx.objects:
        return
    minimum_z = scene_bounds(ctx.objects)["min"][2]
    for obj in ctx.objects:
        obj.location.z -= minimum_z


def rock_cluster(ctx: BuildContext, *, count: int, material="stone", accent="accent", tall=False):
    count = count if ctx.lod == 0 else max(3, count // 2)
    for index in range(count):
        angle = index * 2.399
        radius = 0.24 + (index % 3) * 0.21
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius * 0.75
        z = 0.20 + (index % 2) * 0.11
        ico(ctx, f"rock_{index}", 0.32 + (index % 3) * 0.05, (x, y, z), material, (1.0, 0.82, 0.72 + (0.3 if tall else 0.0)))
    veins = 5 if ctx.lod == 0 else 2
    for index in range(veins):
        angle = index * 1.7
        cone(ctx, f"vein_{index}", 0.12, 0.035, 0.52 if tall else 0.36, (math.cos(angle) * 0.42, math.sin(angle) * 0.30, 0.60), accent, rotation=(0.18, 0.22, angle))


def build_logging_node(ctx: BuildContext, archetype: str):
    ground_pad(ctx, "green", (2.4, 1.8), 0.12)
    if archetype == "softwood_branches":
        branches = 8 if ctx.lod == 0 else 4
        for index in range(branches):
            angle = -0.65 + index * (1.3 / max(1, branches - 1))
            y = -0.45 + (index % 3) * 0.32
            branch(ctx, f"orchard_branch_{index}", (-0.85, y, 0.22), (0.85, y + math.sin(angle) * 0.35, 0.38 + (index % 2) * 0.18), 0.075 + (index % 2) * 0.018, "wood")
        for index in range(5 if ctx.lod == 0 else 2):
            ico(ctx, f"leaf_cluster_{index}", 0.18, (-0.55 + index * 0.28, 0.48 - (index % 2) * 0.18, 0.50), "green", (1.0, 0.75, 0.6))
        cylinder(ctx, "resin_jar", 0.12, 0.30, (0.72, -0.48, 0.28), "highlight")
    else:
        bark_material = "paper" if archetype == "birch_grove" else "wood"
        logs = 5 if ctx.lod == 0 else 3
        for index in range(logs):
            y = -0.48 + index * (0.96 / max(1, logs - 1))
            branch(ctx, f"stacked_log_{index}", (-0.78, y, 0.28 + (index % 2) * 0.18), (0.78, y, 0.28 + (index % 2) * 0.18), 0.16, bark_material)
            if archetype == "birch_grove" and ctx.lod == 0:
                for mark in (-0.30, 0.18):
                    torus(ctx, f"birch_mark_{index}_{mark}", 0.17, 0.018, (mark, y, 0.28 + (index % 2) * 0.18), "dark", rotation=(0, math.pi / 2, 0))
        if archetype == "oak_grove":
            cylinder(ctx, "oak_stump", 0.46, 0.46, (0.0, 0.45, 0.23), "wood")
            for index in range(4 if ctx.lod == 0 else 2):
                ico(ctx, f"oak_leaf_{index}", 0.22, (-0.45 + index * 0.3, 0.62, 0.62), "green", (1.0, 0.8, 0.65))
        elif archetype == "pine_stand":
            cone(ctx, "pine_needles", 0.72, 0.05, 1.35, (0.0, 0.38, 0.92), "green")
            for index in range(4 if ctx.lod == 0 else 2):
                cone(ctx, f"pine_cone_{index}", 0.10, 0.06, 0.24, (-0.42 + index * 0.27, -0.55, 0.27), "accent")
        elif archetype == "birch_grove":
            for index in range(3 if ctx.lod == 0 else 1):
                ico(ctx, f"birch_leaf_{index}", 0.20, (-0.35 + index * 0.35, 0.55, 0.55), "green", (1.0, 0.75, 0.55))
        elif archetype == "willow_cuttings":
            for index in range(7 if ctx.lod == 0 else 3):
                angle = -0.85 + index * 0.28
                branch(ctx, f"willow_cutting_{index}", (-0.18, -0.45, 0.18), (math.sin(angle) * 0.85, 0.55, 0.68 + (index % 2) * 0.22), 0.055, "accent")
                ico(ctx, f"willow_leaf_{index}", 0.12, (math.sin(angle) * 0.85, 0.55, 0.72 + (index % 2) * 0.22), "green", (0.55, 1.25, 0.4))


def build_mining_node(ctx: BuildContext, archetype: str):
    ground_pad(ctx, "stone", (2.25, 1.8), 0.14)
    accent = (
        "ore"
        if archetype in {"iron_vein", "iron_cut"}
        else "highlight"
        if archetype in {"silver_thread", "gold_fragment"}
        else "accent"
    )
    rock_cluster(ctx, count=10 if archetype in {"iron_cut", "coal_seam"} else 8, material="dark" if archetype == "coal_seam" else "stone", accent=accent, tall=archetype == "iron_cut")
    if archetype == "coal_seam":
        for index in range(6 if ctx.lod == 0 else 3):
            ico(ctx, f"coal_chunk_{index}", 0.22, (-0.65 + index * 0.25, -0.50 + (index % 2) * 0.22, 0.34), "dark", (1.1, 0.8, 0.7))
    elif archetype == "silver_thread":
        for index in range(5 if ctx.lod == 0 else 2):
            branch(ctx, f"silver_thread_{index}", (-0.72 + index * 0.26, -0.42, 0.28), (-0.48 + index * 0.26, 0.40, 0.68), 0.025, "highlight")
    elif archetype == "gold_fragment":
        for index in range(5 if ctx.lod == 0 else 2):
            ico(ctx, f"gold_fragment_{index}", 0.16, (-0.52 + index * 0.25, 0.05 + (index % 2) * 0.24, 0.62), "highlight", (1.2, 0.7, 0.8))
    elif archetype in {"iron_vein", "iron_cut"}:
        box(ctx, "discarded_pick_head", (0.56, 0.16, 0.12), (0.64, -0.48, 0.33), "metal", rotation=(0.15, 0.1, -0.55), bevel=0.02)


def build_plant_node(ctx: BuildContext, archetype: str):
    if archetype in {"peacebloom", "crop_row", "flax_row"}:
        ground_pad(ctx, "base", (2.5, 1.65), 0.18)
    else:
        ground_pad(ctx, "green", (2.3, 1.85), 0.12)
    if archetype == "peacebloom":
        for index in range(9 if ctx.lod == 0 else 4):
            x = -0.82 + (index % 3) * 0.82
            y = -0.48 + (index // 3) * 0.48
            branch(ctx, f"peacebloom_stem_{index}", (x, y, 0.18), (x, y, 0.60 + (index % 2) * 0.12), 0.025, "green")
            ico(ctx, f"peacebloom_flower_{index}", 0.13, (x, y, 0.65 + (index % 2) * 0.12), "highlight", (1.25, 1.25, 0.45))
    elif archetype in {"crop_row", "flax_row"}:
        rows = 4 if ctx.lod == 0 else 2
        for row in range(rows):
            y = -0.55 + row * (1.1 / max(1, rows - 1))
            box(ctx, f"soil_row_{row}", (2.0, 0.22, 0.12), (0, y, 0.24), "dark", bevel=0.015)
            plants = 6 if ctx.lod == 0 else 3
            for plant in range(plants):
                x = -0.85 + plant * (1.7 / max(1, plants - 1))
                height = 0.55 + ((row + plant) % 2) * 0.16
                branch(ctx, f"crop_stem_{row}_{plant}", (x, y, 0.28), (x, y, height), 0.018, "green")
                material = "highlight" if archetype == "flax_row" else "accent"
                ico(ctx, f"crop_head_{row}_{plant}", 0.09, (x, y, height + 0.06), material, (0.7, 0.7, 1.35))
    elif archetype == "berry_thicket":
        for index in range(8 if ctx.lod == 0 else 4):
            angle = index * 2.2
            ico(ctx, f"berry_bush_{index}", 0.34, (math.cos(angle) * 0.52, math.sin(angle) * 0.38, 0.36 + (index % 2) * 0.18), "green", (1.0, 0.85, 0.8))
        for index in range(14 if ctx.lod == 0 else 5):
            angle = index * 1.9
            ico(ctx, f"berry_{index}", 0.065, (math.cos(angle) * 0.66, math.sin(angle) * 0.48, 0.42 + (index % 3) * 0.18), "highlight")
    elif archetype == "mushroom_ring":
        mushrooms = 12 if ctx.lod == 0 else 6
        for index in range(mushrooms):
            angle = index * math.tau / mushrooms
            radius = 0.72 + (index % 2) * 0.12
            x, y = math.cos(angle) * radius, math.sin(angle) * radius * 0.72
            cylinder(ctx, f"mushroom_stem_{index}", 0.055, 0.25 + (index % 3) * 0.05, (x, y, 0.23), "paper", vertices=7)
            cone(ctx, f"mushroom_cap_{index}", 0.18, 0.04, 0.14, (x, y, 0.42 + (index % 3) * 0.05), "highlight")
    elif archetype == "nightshade":
        rock_cluster(ctx, count=5, material="stone", accent="dark")
        for index in range(8 if ctx.lod == 0 else 4):
            angle = index * 2.0
            x, y = math.cos(angle) * 0.60, math.sin(angle) * 0.42
            branch(ctx, f"nightshade_stem_{index}", (x * 0.35, y * 0.35, 0.18), (x, y, 0.70), 0.025, "green")
            ico(ctx, f"nightshade_bloom_{index}", 0.11, (x, y, 0.75), "highlight", (1.0, 1.0, 0.5))


def build_wetland_node(ctx: BuildContext, archetype: str):
    ground_pad(ctx, "base" if archetype != "fishing_pool" else "stone", (2.5, 2.0), 0.12)
    if archetype == "fishing_pool":
        cylinder(ctx, "water_pool", 0.92, 0.06, (0, 0, 0.17), "water", vertices=16 if ctx.lod == 0 else 10, bevel=0)
        torus(ctx, "stone_pool_rim", 0.98, 0.11, (0, 0, 0.18), "stone")
        branch(ctx, "fishing_rod", (0.55, -0.54, 0.25), (0.78, 0.16, 1.15), 0.035, "wood")
        ico(ctx, "bobber", 0.09, (0.12, 0.22, 0.28), "highlight")
        for index in range(4 if ctx.lod == 0 else 2):
            x = -0.72 + index * 0.48
            branch(ctx, f"pool_reed_{index}", (x, 0.62, 0.18), (x + 0.05, 0.62, 0.82), 0.025, "green")
    elif archetype in {"reed_bed"}:
        reeds = 18 if ctx.lod == 0 else 8
        for index in range(reeds):
            x = -0.90 + (index % 6) * 0.36
            y = -0.55 + (index // 6) * 0.48
            height = 0.70 + (index % 4) * 0.15
            branch(ctx, f"reed_{index}", (x, y, 0.14), (x + 0.03, y, height), 0.023, "green")
            cylinder(ctx, f"reed_head_{index}", 0.045, 0.20, (x + 0.03, y, height + 0.10), "accent", vertices=6, bevel=0)
    elif archetype in {"river_clay", "blackwater_clay"}:
        if archetype == "blackwater_clay":
            cylinder(ctx, "blackwater_patch", 0.90, 0.05, (0, 0, 0.16), "water", vertices=14, bevel=0)
        for index in range(9 if ctx.lod == 0 else 4):
            angle = index * 2.3
            ico(ctx, f"clay_lump_{index}", 0.25, (math.cos(angle) * 0.68, math.sin(angle) * 0.46, 0.28 + (index % 2) * 0.10), "accent", (1.15, 0.85, 0.55))
        box(ctx, "clay_spade", (0.22, 0.10, 0.58), (0.66, -0.42, 0.48), "metal", rotation=(0.2, 0.0, -0.35), bevel=0.018)


def build_scavenging_node(ctx: BuildContext, archetype: str):
    if archetype in {"river_clay", "blackwater_clay", "reed_bed", "fishing_pool"}:
        build_wetland_node(ctx, archetype)
        return
    ground_pad(ctx, "stone", (2.4, 1.9), 0.12)
    if archetype == "scrap_pile":
        for index in range(9 if ctx.lod == 0 else 4):
            angle = index * 1.8
            box(ctx, f"scrap_plate_{index}", (0.45 + (index % 3) * 0.12, 0.18, 0.12), (math.cos(angle) * 0.60, math.sin(angle) * 0.42, 0.24 + (index % 3) * 0.13), "metal", rotation=(0.2, angle, angle * 0.3), bevel=0.015)
        torus(ctx, "scrap_gear", 0.34, 0.08, (0.05, 0.12, 0.64), "accent", rotation=(math.pi / 2, 0, 0))
        branch(ctx, "scavenger_hook", (-0.72, -0.42, 0.20), (0.72, 0.42, 0.88), 0.035, "accent")


def build_special_node(ctx: BuildContext, archetype: str):
    if archetype == "mana_residue":
        ground_pad(ctx, "stone", (2.2, 1.9), 0.16)
        torus(ctx, "mana_well_rim", 0.78, 0.16, (0, 0, 0.36), "stone")
        cylinder(ctx, "mana_pool", 0.67, 0.06, (0, 0, 0.34), "water", vertices=14, bevel=0)
        crystals = 7 if ctx.lod == 0 else 3
        for index in range(crystals):
            angle = index * 2.2
            cone(ctx, f"mana_crystal_{index}", 0.12, 0.02, 0.55 + (index % 3) * 0.16, (math.cos(angle) * 0.55, math.sin(angle) * 0.42, 0.62), "highlight", rotation=(0.18, 0.12, angle))
    elif archetype == "relic_dig":
        ground_pad(ctx, "base", (2.5, 1.9), 0.16)
        box(ctx, "excavation_cut", (1.35, 0.88, 0.10), (0, 0, 0.20), "dark", rotation=(0, 0, 0.10), bevel=0.025)
        for index in range(5 if ctx.lod == 0 else 2):
            box(ctx, f"relic_fragment_{index}", (0.20, 0.12, 0.06), (-0.48 + index * 0.22, -0.05 + (index % 2) * 0.28, 0.31), "highlight", rotation=(0.1, 0.2, index * 0.6), bevel=0.01)
        branch(ctx, "dig_tool_handle", (0.55, -0.62, 0.20), (0.82, 0.35, 0.72), 0.035, "wood")
        box(ctx, "dig_tool_blade", (0.28, 0.18, 0.07), (0.84, 0.42, 0.74), "metal", rotation=(0.25, 0, -0.15), bevel=0.015)
    elif archetype == "honey_hive":
        ground_pad(ctx, "green", (2.2, 1.8), 0.12)
        box(ctx, "hive_stand", (1.45, 1.00, 0.20), (0, 0, 0.25), "wood", bevel=0.035)
        box(ctx, "hive_body", (1.35, 0.85, 1.05), (0, 0, 0.85), "accent", bevel=0.07)
        box(ctx, "hive_roof", (1.60, 1.05, 0.18), (0, 0, 1.48), "wood", rotation=(0, 0.08, 0), bevel=0.035)
        box(ctx, "hive_entry", (0.55, 0.10, 0.12), (0, -0.48, 0.55), "dark", bevel=0.015)
        for index in range(7 if ctx.lod == 0 else 3):
            angle = index * math.tau / 7
            cylinder(ctx, f"honey_cell_{index}", 0.11, 0.04, (math.cos(angle) * 0.28, -0.49, 0.95 + math.sin(angle) * 0.28), "highlight", rotation=(math.pi / 2, 0, 0), vertices=6, bevel=0)
    elif archetype.endswith("harvest") or archetype == "wolf_harvest":
        ground_pad(ctx, "base", (2.65, 2.05), 0.12)
        body_scale = {
            "wolf_harvest": (1.55, 0.70, 0.58),
            "deer_harvest": (1.75, 0.72, 0.56),
            "boar_harvest": (1.55, 0.92, 0.72),
            "bear_harvest": (1.85, 1.05, 0.82),
        }[archetype]
        body_material = "base" if archetype == "bear_harvest" else "accent"
        ico(ctx, "field_dressed_body", 0.58, (-0.15, 0.0, 0.48), body_material, body_scale)
        head_scale = {
            "wolf_harvest": (0.80, 0.60, 0.58),
            "deer_harvest": (0.78, 0.55, 0.54),
            "boar_harvest": (0.95, 0.76, 0.66),
            "bear_harvest": (1.0, 0.84, 0.78),
        }[archetype]
        ico(ctx, "species_head", 0.40, (0.88, 0.02, 0.53), body_material, head_scale)
        snout_scale = (0.70, 0.58, 0.45) if archetype != "boar_harvest" else (0.86, 0.76, 0.50)
        ico(ctx, "species_snout", 0.25, (1.18, -0.02, 0.45), "dark", snout_scale)
        leg_count = 4 if ctx.lod == 0 else 2
        for index in range(leg_count):
            y = -0.34 if index % 2 == 0 else 0.34
            x = -0.58 if index < 2 else 0.25
            branch(
                ctx,
                f"folded_leg_{index}",
                (x, y, 0.43),
                (x - 0.18, y + (-0.28 if y < 0 else 0.28), 0.24),
                0.07 if archetype != "bear_harvest" else 0.10,
                body_material,
            )
        horn_count = 4 if archetype == "deer_harvest" and ctx.lod == 0 else 2
        if archetype == "deer_harvest":
            for index in range(horn_count):
                side = -1 if index % 2 == 0 else 1
                branch(ctx, f"antler_{index}", (0.90, side * 0.18, 0.70), (1.00 + (index // 2) * 0.12, side * (0.55 + (index // 2) * 0.12), 1.02), 0.035, "bone")
        elif archetype == "boar_harvest":
            for side in (-1, 1):
                cone(ctx, f"boar_tusk_{side}", 0.09, 0.02, 0.36, (1.20, side * 0.20, 0.48), "bone", rotation=(0.0, 0.75, side * 0.38))
        elif archetype == "bear_harvest":
            for side in (-1, 1):
                ico(ctx, f"bear_ear_{side}", 0.15, (0.82, side * 0.28, 0.82), body_material, (0.85, 0.62, 0.9))
            for index in range(4 if ctx.lod == 0 else 2):
                ico(ctx, f"bear_claw_{index}", 0.08, (-0.62 + index * 0.16, -0.62, 0.23), "bone", (0.42, 1.15, 0.34))
        else:
            for side in (-1, 1):
                cone(ctx, f"wolf_ear_{side}", 0.16, 0.025, 0.38, (0.82, side * 0.25, 0.83), body_material, rotation=(0.0, 0.0, side * 0.12))
            branch(ctx, "wolf_tail", (-0.78, 0.02, 0.55), (-1.25, 0.32, 0.31), 0.075, body_material)
        box(ctx, "skinning_kit", (0.62, 0.40, 0.32), (-0.72, -0.67, 0.30), "wood", bevel=0.045)
        if ctx.lod == 0:
            box(ctx, "skinning_knife", (0.52, 0.08, 0.045), (-0.05, -0.74, 0.24), "metal", rotation=(0.0, 0.18, 0.0), bevel=0.012)
    elif archetype == "zombie_remains":
        ground_pad(ctx, "stone", (2.4, 1.9), 0.12)
        for index in range(6 if ctx.lod == 0 else 3):
            angle = -0.9 + index * 0.35
            branch(ctx, f"old_bone_{index}", (-0.55 + index * 0.20, -0.35, 0.22), (-0.20 + index * 0.20, 0.35, 0.36 + (index % 2) * 0.15), 0.055, "bone")
        box(ctx, "bell_woken_armor", (0.78, 0.56, 0.18), (0.30, 0.05, 0.34), "metal", rotation=(0.2, 0.25, 0.45), bevel=0.035)
        for index in range(4 if ctx.lod == 0 else 2):
            ico(ctx, f"grave_moss_{index}", 0.20, (-0.55 + index * 0.35, 0.45, 0.30), "highlight", (1.0, 0.8, 0.45))


def build_gathering_node(ctx: BuildContext, node: GatheringNodeGraphic):
    if node.archetype in {"softwood_branches", "oak_grove", "pine_stand", "birch_grove", "willow_cuttings"}:
        build_logging_node(ctx, node.archetype)
    elif node.archetype in {"iron_vein", "iron_cut", "coal_seam", "silver_thread", "gold_fragment"}:
        build_mining_node(ctx, node.archetype)
    elif node.archetype in {"peacebloom", "crop_row", "berry_thicket", "mushroom_ring", "nightshade", "flax_row"}:
        build_plant_node(ctx, node.archetype)
    elif node.archetype in {"fishing_pool", "river_clay", "blackwater_clay", "reed_bed"}:
        build_wetland_node(ctx, node.archetype)
    elif node.archetype == "scrap_pile":
        build_scavenging_node(ctx, node.archetype)
    else:
        build_special_node(ctx, node.archetype)
    ground_objects_at_origin(ctx)


LETTER_PATTERNS: dict[str, tuple[tuple[int, int], ...]] = {
    "J": ((0, 0), (1, 0), (2, 0), (1, 1), (1, 2), (1, 3), (0, 4), (1, 4)),
    "O": ((0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (2, 2), (0, 3), (2, 3), (0, 4), (1, 4), (2, 4)),
    "B": ((0, 0), (1, 0), (0, 1), (2, 1), (0, 2), (1, 2), (0, 3), (2, 3), (0, 4), (1, 4)),
    "S": ((0, 0), (1, 0), (2, 0), (0, 1), (0, 2), (1, 2), (2, 2), (2, 3), (0, 4), (1, 4), (2, 4)),
}


def build_jobs_board(ctx: BuildContext):
    # Preserve the existing landmark scale (about 6.6m wide by 6.5m tall),
    # while replacing the old hundreds-of-boxes runtime hierarchy with one
    # compact shared GLB per color/LOD.
    box(ctx, "board_stone_foot", (3.65, 0.72, 0.18), (0, 0, 0.09), "stone", bevel=0.045)
    for x in (-1.48, 1.48):
        box(ctx, f"board_post_{x}", (0.22, 0.26, 2.75), (x, 0, 1.45), "dark", bevel=0.035)
        box(ctx, f"board_post_cap_{x}", (0.36, 0.40, 0.18), (x, 0, 2.90), "highlight", bevel=0.035)
    box(ctx, "board_back", (3.05, 0.20, 1.85), (0, 0, 1.72), "wood", bevel=0.045)
    box(ctx, "board_inner_face", (2.76, 0.10, 1.55), (0, -0.14, 1.70), "base", bevel=0.025)
    box(ctx, "board_header", (2.20, 0.14, 0.48), (0, -0.20, 2.66), "highlight", bevel=0.035)
    box(ctx, "board_roof", (3.55, 0.86, 0.22), (0, 0, 3.10), "dark", rotation=(0.0, 0.06, 0.0), bevel=0.045)
    box(ctx, "board_roof_trim", (3.25, 0.94, 0.10), (0, -0.02, 3.23), "accent", bevel=0.025)
    if ctx.lod == 0:
        cell = 0.105
        for letter_index, letter in enumerate("JOBS"):
            base_x = -0.72 + letter_index * 0.48
            for cell_index, (col, row) in enumerate(LETTER_PATTERNS[letter]):
                box(ctx, f"letter_{letter}_{cell_index}", (cell, 0.035, cell), (base_x + (col - 1) * cell, -0.29, 2.66 + (2 - row) * cell), "dark", bevel=0.008)
    notices = [
        (-0.92, 1.98, 0.58, 0.58, -0.08),
        (-0.25, 2.02, 0.54, 0.64, 0.05),
        (0.43, 2.00, 0.62, 0.54, -0.04),
        (1.02, 1.88, 0.42, 0.78, 0.08),
        (-0.78, 1.30, 0.72, 0.48, 0.04),
        (0.02, 1.28, 0.62, 0.50, -0.06),
        (0.78, 1.30, 0.64, 0.48, 0.05),
    ]
    if ctx.lod == 1:
        notices = notices[::2]
    for index, (x, z, width, height, rotation) in enumerate(notices):
        material = "paper" if index % 3 else "accent"
        box(ctx, f"posted_notice_{index}", (width, 0.035, height), (x, -0.235, z), material, rotation=(0, rotation, 0), bevel=0.012)
        if ctx.lod == 0:
            for line in range(2):
                box(ctx, f"notice_ink_{index}_{line}", (width * (0.62 - line * 0.1), 0.014, 0.025), (x, -0.263, z + height * 0.16 - line * height * 0.22), "dark", rotation=(0, rotation, 0), bevel=0)
            cylinder(ctx, f"notice_pin_{index}", 0.035, 0.025, (x, -0.275, z + height * 0.35), "highlight", rotation=(math.pi / 2, 0, 0), vertices=8, bevel=0)
    # Small side lantern forms use emissive color only; no runtime PointLight.
    for x in (-1.72, 1.72):
        branch(ctx, f"lantern_arm_{x}", (x, 0, 1.72), (x, -0.45, 2.02), 0.035, "dark")
        box(ctx, f"lantern_{x}", (0.24, 0.22, 0.34), (x, -0.50, 1.82), "highlight", bevel=0.035)

    landmark_scale = Vector((1.80, 1.15, 1.95))
    for obj in ctx.objects:
        obj.location = Vector(
            (
                obj.location.x * landmark_scale.x,
                obj.location.y * landmark_scale.y,
                obj.location.z * landmark_scale.z,
            )
        )
        obj.scale = Vector(
            (
                obj.scale.x * landmark_scale.x,
                obj.scale.y * landmark_scale.y,
                obj.scale.z * landmark_scale.z,
            )
        )


def build_request_board_emblem(ctx: BuildContext, category: str) -> None:
    """One unmistakable, texture-free guild emblem visible from both sides."""
    first_object_index = len(ctx.objects)
    center_z = 3.02
    if category == "fishing":
        ico(ctx, "fishing_fish_body", 0.34, (0.02, 0.0, center_z), "highlight", (1.55, 0.48, 0.72))
        cone(ctx, "fishing_fish_tail", 0.30, 0.02, 0.34, (-0.62, 0.0, center_z), "accent", rotation=(0.0, math.pi / 2, 0.0), vertices=3)
        for side in (-1, 1):
            cylinder(ctx, f"fishing_eye_{side}", 0.055, 0.06, (0.36, side * 0.19, center_z + 0.06), "dark", rotation=(math.pi / 2, 0.0, 0.0), vertices=8, bevel=0)
        for index, z in enumerate((2.70, 2.58)):
            branch(ctx, f"fishing_wave_{index}", (-0.54, 0.0, z), (0.54, 0.0, z + (0.07 if index == 0 else -0.05)), 0.035, "accent")
    elif category == "farming":
        for index, x in enumerate((-0.28, 0.0, 0.28)):
            branch(ctx, f"farming_stalk_{index}", (x, 0.0, 2.64), (x * 0.65, 0.0, 3.34), 0.045, "highlight")
            for grain in range(3 if ctx.lod == 0 else 2):
                grain_z = 3.02 + grain * 0.15
                ico(ctx, f"farming_grain_{index}_{grain}", 0.095, (x * 0.65 + (0.10 if grain % 2 else -0.10), 0.0, grain_z), "accent", (0.65, 0.42, 1.15))
        for side in (-1, 1):
            ico(ctx, f"farming_leaf_{side}", 0.18, (side * 0.34, 0.0, 2.80), "green", (1.35, 0.45, 0.62))
    elif category == "industrial":
        torus(ctx, "industrial_gear_ring", 0.39, 0.095, (0.0, 0.0, center_z), "highlight", rotation=(math.pi / 2, 0.0, 0.0))
        tooth_count = 8 if ctx.lod == 0 else 4
        for index in range(tooth_count):
            angle = index * math.tau / tooth_count
            box(ctx, f"industrial_gear_tooth_{index}", (0.17, 0.18, 0.30), (math.cos(angle) * 0.53, 0.0, center_z + math.sin(angle) * 0.53), "accent", rotation=(0.0, -angle, 0.0), bevel=0.018)
        cylinder(ctx, "industrial_gear_hub", 0.15, 0.24, (0.0, 0.0, center_z), "dark", rotation=(math.pi / 2, 0.0, 0.0), vertices=10, bevel=0.012)
        box(ctx, "industrial_hammer_head", (0.54, 0.20, 0.18), (0.12, 0.0, 2.70), "metal", rotation=(0.0, -0.22, 0.0), bevel=0.025)
        branch(ctx, "industrial_hammer_handle", (-0.36, 0.0, 2.46), (0.30, 0.0, 2.86), 0.055, "wood")
    elif category == "research":
        box(ctx, "research_book_left", (0.62, 0.22, 0.12), (-0.31, 0.0, 2.72), "paper", rotation=(0.0, -0.18, 0.0), bevel=0.025)
        box(ctx, "research_book_right", (0.62, 0.22, 0.12), (0.31, 0.0, 2.72), "paper", rotation=(0.0, 0.18, 0.0), bevel=0.025)
        ico(ctx, "research_flask_body", 0.30, (0.0, 0.0, 3.06), "accent", (1.0, 0.52, 0.86))
        box(ctx, "research_flask_neck", (0.18, 0.20, 0.42), (0.0, 0.0, 3.38), "highlight", bevel=0.018)
        box(ctx, "research_flask_rim", (0.34, 0.24, 0.10), (0.0, 0.0, 3.60), "metal", bevel=0.018)
        if ctx.lod == 0:
            for index, angle in enumerate((0.25, 2.25, 4.35)):
                ico(ctx, f"research_spark_{index}", 0.075, (math.cos(angle) * 0.63, 0.0, 3.30 + math.sin(angle) * 0.28), "highlight", (0.8, 0.45, 1.25))
    else:
        raise ValueError(f"Unknown request-board category: {category}")

    # Build the emblem once, then place a concrete mesh copy on each face. The
    # first smoke preview caught the original at Y=0 inside the header plaque,
    # which made a category board look like a generic blank board.
    front_objects = list(ctx.objects[first_object_index:])
    for index, obj in enumerate(front_objects):
        obj.location.y -= 0.36
        back = obj.copy()
        if obj.data:
            back.data = obj.data.copy()
            back.data.name = blender_safe_name(f"{obj.data.name}_back")
        back.name = blender_safe_name(f"{obj.name}_back_{index}")
        back.location.y += 0.72
        ctx.objects.append(back)


def build_request_board(ctx: BuildContext, category: str) -> None:
    """Large, double-sided request board with category-specific silhouette."""
    box(ctx, "request_board_stone_foot", (4.05, 0.78, 0.20), (0.0, 0.0, 0.10), "stone", bevel=0.045)
    for index, x in enumerate((-1.67, 1.67)):
        box(ctx, f"request_board_post_{index}", (0.25, 0.30, 3.15), (x, 0.0, 1.67), "dark", bevel=0.035)
        box(ctx, f"request_board_post_cap_{index}", (0.42, 0.44, 0.20), (x, 0.0, 3.35), "highlight", bevel=0.035)
    box(ctx, "request_board_back", (3.48, 0.24, 2.18), (0.0, 0.0, 2.00), "wood", bevel=0.045)
    box(ctx, "request_board_roof", (4.12, 0.92, 0.24), (0.0, 0.0, 3.70), "dark", rotation=(0.0, 0.05, 0.0), bevel=0.045)
    box(ctx, "request_board_roof_trim", (3.78, 0.98, 0.11), (0.0, 0.0, 3.83), "accent", bevel=0.025)

    notices = [
        (-1.05, 2.24, 0.64, 0.58, -0.06),
        (-0.34, 2.20, 0.58, 0.66, 0.04),
        (0.36, 2.24, 0.66, 0.56, -0.04),
        (1.07, 2.17, 0.52, 0.72, 0.06),
        (-0.82, 1.48, 0.78, 0.52, 0.04),
        (0.02, 1.45, 0.66, 0.56, -0.05),
        (0.82, 1.48, 0.72, 0.52, 0.05),
    ]
    if ctx.lod == 1:
        notices = notices[::2]
    for face_index, face_sign in enumerate((-1, 1)):
        face_y = face_sign * 0.145
        notice_y = face_sign * 0.275
        box(ctx, f"request_board_face_{face_index}", (3.18, 0.08, 1.88), (0.0, face_y, 1.96), "base", bevel=0.025)
        box(ctx, f"request_board_header_{face_index}", (2.72, 0.10, 0.78), (0.0, face_sign * 0.285, 3.06), "accent", bevel=0.035)
        for index, (x, z, width, height, rotation) in enumerate(notices):
            material = "paper" if index % 3 else "highlight"
            box(ctx, f"request_notice_{face_index}_{index}", (width, 0.035, height), (x, notice_y, z), material, rotation=(0.0, rotation, 0.0), bevel=0.012)
            if ctx.lod == 0:
                for line in range(2):
                    box(ctx, f"request_ink_{face_index}_{index}_{line}", (width * (0.64 - line * 0.10), 0.014, 0.026), (x, face_sign * 0.302, z + height * 0.16 - line * height * 0.22), "dark", rotation=(0.0, rotation, 0.0), bevel=0)
                cylinder(ctx, f"request_pin_{face_index}_{index}", 0.035, 0.025, (x, face_sign * 0.316, z + height * 0.35), "accent", rotation=(math.pi / 2, 0.0, 0.0), vertices=8, bevel=0)

    build_request_board_emblem(ctx, category)
    for x in (-1.90, 1.90):
        branch(ctx, f"request_lantern_arm_{'l' if x < 0 else 'r'}", (x, 0.0, 1.92), (x, -0.48, 2.22), 0.038, "dark")
        box(ctx, f"request_lantern_{'l' if x < 0 else 'r'}", (0.26, 0.24, 0.38), (x, -0.52, 2.00), "highlight", bevel=0.035)

    landmark_scale = Vector((1.60, 1.12, 1.64))
    for obj in ctx.objects:
        obj.location = Vector((obj.location.x * landmark_scale.x, obj.location.y * landmark_scale.y, obj.location.z * landmark_scale.z))
        obj.scale = Vector((obj.scale.x * landmark_scale.x, obj.scale.y * landmark_scale.y, obj.scale.z * landmark_scale.z))


def create_context(slug: str, lod: int, colors: tuple[tuple[float, float, float], ...]) -> BuildContext:
    clear_scene()
    collection = bpy.data.collections.new(blender_safe_name(f"{slug}_lod{lod}"))
    bpy.context.scene.collection.children.link(collection)
    # Unlink default collection when present so selection/export is deterministic.
    default = bpy.data.collections.get("Collection")
    if default and default.name in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.unlink(default)
    return BuildContext(slug, lod, collection, material_set(slug, colors), [])


def move_to_context_collection(ctx: BuildContext) -> None:
    for obj in ctx.objects:
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        ctx.collection.objects.link(obj)


def join_by_material(ctx: BuildContext) -> None:
    move_to_context_collection(ctx)
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in ctx.objects:
        if obj.type != "MESH" or not obj.data.materials:
            continue
        groups.setdefault(obj.data.materials[0].name, []).append(obj)
    joined: list[bpy.types.Object] = []
    for material_name, objects in groups.items():
        if len(objects) == 1:
            objects[0].name = blender_safe_name(f"{ctx.slug}_{material_name}_lod{ctx.lod}")
            joined.append(objects[0])
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        merged = bpy.context.object
        merged.name = blender_safe_name(f"{ctx.slug}_{material_name}_lod{ctx.lod}")
        joined.append(merged)
    ctx.objects = joined


def export_context(ctx: BuildContext, path: Path) -> None:
    join_by_material(ctx)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in ctx.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_yup=True,
    )


def gltfpack_path(repo_root: Path) -> Path:
    candidate = repo_root / "node_modules" / ".bin" / "gltfpack"
    if candidate.exists():
        return candidate
    found = shutil.which("gltfpack")
    if found:
        return Path(found)
    raise RuntimeError("gltfpack 1.2 is required; run npm run assets:install-gltfpack")


def compress_glb(packer: Path, source: Path, output: Path, report: Path) -> None:
    report.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [str(packer), "-i", str(source), "-o", str(output), "-cc", "-ke", "-r", str(report)],
        check=True,
    )
    source.unlink(missing_ok=True)


def inspect_glb(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF":
        raise RuntimeError(f"Invalid GLB header: {path}")
    offset = 12
    gltf: dict[str, Any] | None = None
    while offset + 8 <= len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        payload = raw[offset : offset + length]
        offset += length
        if kind == 0x4E4F534A:
            gltf = json.loads(payload.rstrip(b" \x00").decode("utf8"))
            break
    if gltf is None:
        raise RuntimeError(f"Missing GLB JSON chunk: {path}")
    primitive_count = sum(len(mesh.get("primitives", [])) for mesh in gltf.get("meshes", []))
    return {
        "bytes": len(raw),
        "meshCount": len(gltf.get("meshes", [])),
        "primitiveCount": primitive_count,
        "materialCount": len(gltf.get("materials", [])),
        "textureCount": len(gltf.get("textures", [])),
        "imageCount": len(gltf.get("images", [])),
        "meshoptCompressed": "EXT_meshopt_compression" in gltf.get("extensionsUsed", []),
    }


def scene_bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = [min(point[index] for point in points) for index in range(3)]
    maximum = [max(point[index] for point in points) for index in range(3)]
    return {"min": [round(value, 4) for value in minimum], "max": [round(value, 4) for value in maximum]}


def look_at(obj: bpy.types.Object, target=(0.0, 0.0, 0.8)) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def supported_eevee_engine() -> str:
    enum = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys()
    for candidate in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        if candidate in enum:
            return candidate
    return "BLENDER_WORKBENCH"


def render_preview(ctx: BuildContext, output: Path) -> None:
    scene = bpy.context.scene
    scene.render.engine = supported_eevee_engine()
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(output)
    world = bpy.data.worlds.new(blender_safe_name(f"{ctx.slug}_world"))
    world.color = (0.025, 0.03, 0.04)
    scene.world = world
    bounds = scene_bounds(ctx.objects)
    minimum = Vector(bounds["min"])
    maximum = Vector(bounds["max"])
    center = (minimum + maximum) * 0.5
    largest_extent = max(maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z)
    bpy.ops.object.camera_add(
        location=(
            largest_extent * 1.22,
            -largest_extent * 1.62,
            center.z + largest_extent * 0.78,
        )
    )
    camera = bpy.context.object
    camera.name = blender_safe_name(f"{ctx.slug}_preview_camera")
    look_at(camera, center)
    camera.data.lens = 52
    scene.camera = camera
    for index, (location, energy, size) in enumerate(
        [((3.8, -4.0, 6.0), 850, 4.0), ((-4.0, -2.0, 3.5), 500, 3.0), ((0.0, 4.0, 5.0), 650, 3.0)]
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = blender_safe_name(f"{ctx.slug}_preview_light_{index}")
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        look_at(light, (0.0, 0.0, 0.8))
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)


def build_and_export(
    *,
    slug: str,
    colors: tuple[tuple[float, float, float], ...],
    builder: Callable[[BuildContext], None],
    output_dir: Path,
    packer: Path,
    report_dir: Path,
    preview_dir: Path,
    render_previews: bool,
) -> dict[str, Any]:
    assets: dict[str, Any] = {}
    for lod in (0, 1):
        ctx = create_context(slug, lod, colors)
        builder(ctx)
        bounds = scene_bounds(ctx.objects)
        raw = output_dir / f"{slug}.lod{lod}.raw.glb"
        final = output_dir / (f"{slug}.glb" if lod == 0 else f"{slug}.lod1.glb")
        export_context(ctx, raw)
        compress_glb(packer, raw, final, report_dir / f"{slug}.lod{lod}.txt")
        stats = inspect_glb(final)
        assets[f"lod{lod}"] = {"path": final, "bounds": bounds, **stats}
        if render_previews and lod == 0:
            render_preview(ctx, preview_dir / f"{slug}.png")
    return assets


def relative_url(repo_root: Path, path: Path) -> str:
    return "/" + str(path.relative_to(repo_root / "public")).replace("\\", "/")


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    packer = gltfpack_path(repo_root)
    output_root = repo_root / "public" / "assets" / "harthmere" / "glb"
    preview_dir = repo_root / "output" / "harthmere-world-interaction-graphics" / "previews"
    report_dir = repo_root / "output" / "harthmere-world-interaction-graphics" / "gltfpack-reports"
    selected = set(args.only)
    if args.gathering_only:
        selected.update(node.node_id for node in GATHERING_NODES)
    if args.request_boards_only:
        selected.update(f"request_board_{key}" for key in REQUEST_BOARD_VARIANTS)
    valid = (
        {node.node_id for node in GATHERING_NODES}
        | {f"jobs_board_{key}" for key in JOBS_BOARD_VARIANTS}
        | {f"request_board_{key}" for key in REQUEST_BOARD_VARIANTS}
    )
    unknown = selected - valid
    if unknown:
        raise SystemExit(f"Unknown --only asset(s): {', '.join(sorted(unknown))}")

    manifest: dict[str, Any] = {
        "assetVersion": ASSET_VERSION,
        "generatorVersion": GENERATOR_VERSION,
        "coordinateContract": {
            "unitMeters": 1,
            "pivot": "bottom_center",
            "blenderToWorld": {"x": "worldX", "y": "worldZ", "z": "worldY"},
        },
        "performance": {
            "textures": "none_compact_pbr_colors_only",
            "compression": "EXT_meshopt_compression via gltfpack 1.2 -cc",
            "collision": "interaction_authority_only_no_render_mesh_collision",
            "runtimeLights": 0,
        },
        "authorityBoundary": {
            "authoredGatheringNodes": "server_shared_respawn_static_landmark_no_gaia_plant_tick",
            "plantedCrops": "native_ecs_farming_plant_component_plus_gaia_growth_and_harvest",
            "visualReuseRule": "share_species_silhouette_and_material_not_static_landmark_renderer",
        },
        "gatheringNodeLodPolicy": {"lod0MaxDistanceMeters": 18, "lod1MaxDistanceMeters": 64, "hiddenBeyondMeters": 96},
        "jobsBoardLodPolicy": {"lod0MaxDistanceMeters": 22, "lod1MaxDistanceMeters": 72, "hiddenBeyondMeters": 110},
        "requestBoardLodPolicy": {"lod0MaxDistanceMeters": 22, "lod1MaxDistanceMeters": 72, "hiddenBeyondMeters": 110},
        "gatheringNodes": [],
        "jobsBoardVariants": {},
        "requestBoardVariants": {},
    }

    for node in GATHERING_NODES:
        if selected and node.node_id not in selected:
            continue
        slug = node.node_id
        assets = build_and_export(
            slug=slug,
            colors=node.colors,
            builder=lambda ctx, node=node: build_gathering_node(ctx, node),
            output_dir=output_root / "gathering_nodes" / slug,
            packer=packer,
            report_dir=report_dir / "gathering_nodes",
            preview_dir=preview_dir / "gathering_nodes",
            render_previews=args.render_previews,
        )
        manifest["gatheringNodes"].append(
            {
                "nodeId": node.node_id,
                "displayName": node.display_name,
                "profession": node.profession,
                "archetype": node.archetype,
                "assets": {
                    "lod0": relative_url(repo_root, assets["lod0"]["path"]),
                    "lod1": relative_url(repo_root, assets["lod1"]["path"]),
                },
                "bounds": assets["lod0"]["bounds"],
                "stats": {"lod0": {key: value for key, value in assets["lod0"].items() if key not in {"path", "bounds"}}, "lod1": {key: value for key, value in assets["lod1"].items() if key not in {"path", "bounds"}}},
            }
        )

    for variant, accent in JOBS_BOARD_VARIANTS.items():
        slug = f"jobs_board_{variant}"
        if selected and slug not in selected:
            continue
        colors = ((0.22, 0.12, 0.055), accent, (0.94, 0.68, 0.16))
        assets = build_and_export(
            slug=slug,
            colors=colors,
            builder=build_jobs_board,
            output_dir=output_root / "jobs_boards" / slug,
            packer=packer,
            report_dir=report_dir / "jobs_boards",
            preview_dir=preview_dir / "jobs_boards",
            render_previews=args.render_previews,
        )
        manifest["jobsBoardVariants"][variant] = {
            "accentColor": "#%02x%02x%02x" % tuple(round(channel * 255) for channel in accent),
            "assets": {"lod0": relative_url(repo_root, assets["lod0"]["path"]), "lod1": relative_url(repo_root, assets["lod1"]["path"])},
            "bounds": assets["lod0"]["bounds"],
            "stats": {"lod0": {key: value for key, value in assets["lod0"].items() if key not in {"path", "bounds"}}, "lod1": {key: value for key, value in assets["lod1"].items() if key not in {"path", "bounds"}}},
        }

    for category, spec in REQUEST_BOARD_VARIANTS.items():
        slug = f"request_board_{category}"
        if selected and slug not in selected:
            continue
        accent = spec["accent"]
        colors = ((0.22, 0.12, 0.055), accent, (0.94, 0.72, 0.24))
        assets = build_and_export(
            slug=slug,
            colors=colors,
            builder=lambda ctx, category=category: build_request_board(ctx, category),
            output_dir=output_root / "request_boards" / slug,
            packer=packer,
            report_dir=report_dir / "request_boards",
            preview_dir=preview_dir / "request_boards",
            render_previews=args.render_previews,
        )
        manifest["requestBoardVariants"][category] = {
            "displayName": spec["displayName"],
            "category": category,
            "accentColor": "#%02x%02x%02x" % tuple(round(channel * 255) for channel in accent),
            "assets": {"lod0": relative_url(repo_root, assets["lod0"]["path"]), "lod1": relative_url(repo_root, assets["lod1"]["path"])},
            "bounds": assets["lod0"]["bounds"],
            "stats": {"lod0": {key: value for key, value in assets["lod0"].items() if key not in {"path", "bounds"}}, "lod1": {key: value for key, value in assets["lod1"].items() if key not in {"path", "bounds"}}},
        }

    manifest_path = repo_root / "public" / "assets" / "harthmere" / "manifest" / "world-interaction-graphics.json"
    if selected and manifest_path.exists():
        existing = json.loads(manifest_path.read_text())
        gathered = {entry["nodeId"]: entry for entry in existing.get("gatheringNodes", [])}
        gathered.update({entry["nodeId"]: entry for entry in manifest["gatheringNodes"]})
        variants = dict(existing.get("jobsBoardVariants", {}))
        variants.update(manifest["jobsBoardVariants"])
        request_variants = dict(existing.get("requestBoardVariants", {}))
        request_variants.update(manifest["requestBoardVariants"])
        manifest["gatheringNodes"] = [gathered[node.node_id] for node in GATHERING_NODES if node.node_id in gathered]
        manifest["jobsBoardVariants"] = {key: variants[key] for key in JOBS_BOARD_VARIANTS if key in variants}
        manifest["requestBoardVariants"] = {key: request_variants[key] for key in REQUEST_BOARD_VARIANTS if key in request_variants}
    manifest["summary"] = {
        "gatheringNodeCount": len(manifest["gatheringNodes"]),
        "jobsBoardVariantCount": len(manifest["jobsBoardVariants"]),
        "requestBoardVariantCount": len(manifest["requestBoardVariants"]),
        "glbCount": len(manifest["gatheringNodes"]) * 2 + len(manifest["jobsBoardVariants"]) * 2 + len(manifest["requestBoardVariants"]) * 2,
        "totalBytes": sum(entry["stats"][lod]["bytes"] for entry in manifest["gatheringNodes"] for lod in ("lod0", "lod1")) + sum(entry["stats"][lod]["bytes"] for entry in manifest["jobsBoardVariants"].values() for lod in ("lod0", "lod1")) + sum(entry["stats"][lod]["bytes"] for entry in manifest["requestBoardVariants"].values() for lod in ("lod0", "lod1")),
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest["summary"], indent=2))


if __name__ == "__main__":
    main()
