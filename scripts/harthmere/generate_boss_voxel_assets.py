#!/usr/bin/env python3
"""Generate the eleven live Harthmere boss VOX sources and animated GLBs.

Run with Blender, not the system Python:

  blender --background --python scripts/harthmere/generate_boss_voxel_assets.py -- \
    --repo-root "$PWD" --preview-dir /tmp/harthmere-boss-previews

The source silhouettes are built from integer voxels, exported as MagicaVoxel
v150 files, converted to exposed-face meshes, rigidly weighted to a bespoke
armature, and exported with a shared gameplay animation contract plus each
boss's mechanic-specific clips. Runtime meshes are normalized to the default
NPC box (0.6 x 1.8 x 0.6); ECS Size restores the lore-authored world dimensions.
"""

from __future__ import annotations

import argparse
import colorsys
import json
import math
import os
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

import bpy
from mathutils import Vector

# Scratch-built boss modules import this generator for its shared voxel/export
# infrastructure. Preserve the same module object when Blender executes this
# file as __main__ so those modules cannot accidentally load a second registry.
sys.modules.setdefault("generate_boss_voxel_assets", sys.modules[__name__])
_SCRIPT_DIR = str(Path(__file__).resolve().parent)
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)


Vec3 = Tuple[float, float, float]
Cell = Tuple[int, int, int]

FPS = 24
BASE_BOX = (0.6, 0.6, 1.8)  # Blender X/Y/Z; Three receives X/Z/Y.
BOSS_ANIMATION_POLISH_VERSION = "harthmere-boss-animation-polish-v1"

BOSS_STAGGER_CLIPS = (
    "BossStaggerLight",
    "BossStaggerMedium",
    "BossStaggerHeavy",
)

REQUIRED_CLIPS = (
    "Idle",
    "Walk",
    "Run",
    "Sprint",
    "Jump",
    "Fly",
    "Attack",
    "HeavyAttack",
    "RangedAttack",
    "AreaAttack",
    "HitReact",
    "Stunned",
    *BOSS_STAGGER_CLIPS,
    "Roar",
    "PhaseTransition",
    "Summon",
    "Enrage",
    "WipeReset",
    "Death",
)

ASPECT_PRESERVED_ARCHETYPES = frozenset(
    ("gilded_bull", "breach_helix", "failed_year", "thaedryn")
)


@dataclass(frozen=True)
class MaterialSpec:
    rgba: Tuple[int, int, int, int]
    emission: float = 0.0
    metallic: float = 0.0
    roughness: float = 0.8


MATERIALS: Dict[str, MaterialSpec] = {
    "muck_black": MaterialSpec((18, 19, 24, 255), roughness=0.52),
    "muck_deep": MaterialSpec((42, 44, 50, 255), roughness=0.58),
    "muck_gloss": MaterialSpec((24, 29, 35, 255), metallic=0.14, roughness=0.22),
    "muck_hide": MaterialSpec((55, 47, 57, 255), roughness=0.66),
    "scar_red": MaterialSpec((147, 35, 43, 255), emission=0.08),
    "scar_dark": MaterialSpec((84, 24, 38, 255), roughness=0.58),
    "scar_pale": MaterialSpec((126, 45, 61, 255), roughness=0.52),
    "chitin_black": MaterialSpec((28, 25, 36, 255), metallic=0.18, roughness=0.34),
    "toxic_lime": MaterialSpec((154, 229, 52, 255), emission=1.4),
    "toxic_yellow": MaterialSpec((230, 244, 87, 255), emission=1.0),
    "breach_violet": MaterialSpec((78, 39, 126, 255), emission=0.72, roughness=0.28),
    "bronze": MaterialSpec((126, 78, 42, 255), metallic=0.78, roughness=0.3),
    "bronze_dark": MaterialSpec((67, 45, 35, 255), metallic=0.7, roughness=0.36),
    "bronze_aged": MaterialSpec((76, 45, 32, 255), metallic=0.74, roughness=0.38),
    "bronze_mid": MaterialSpec((127, 73, 34, 255), metallic=0.82, roughness=0.27),
    "bronze_worn": MaterialSpec((166, 101, 47, 255), metallic=0.76, roughness=0.31),
    "gold": MaterialSpec((224, 169, 45, 255), metallic=0.88, roughness=0.22),
    "gold_light": MaterialSpec((255, 222, 104, 255), metallic=0.8, roughness=0.2),
    "verdigris": MaterialSpec((53, 139, 126, 255), metallic=0.35, roughness=0.46),
    "core_white": MaterialSpec((255, 247, 191, 255), emission=2.3, roughness=0.25),
    "core_cyan": MaterialSpec((113, 244, 224, 255), emission=2.8, roughness=0.16),
    "core_gold": MaterialSpec((255, 178, 42, 255), emission=2.0, roughness=0.2),
    "sun_iron": MaterialSpec((38, 35, 38, 255), metallic=0.76, roughness=0.3),
    "sun_ivory": MaterialSpec((222, 205, 165, 255), metallic=0.12, roughness=0.5),
    "ice_deep": MaterialSpec((37, 74, 104, 255), metallic=0.08, roughness=0.25),
    "ice": MaterialSpec((115, 190, 212, 255), emission=0.08, roughness=0.18),
    "ice_pale": MaterialSpec((205, 239, 244, 255), emission=0.18, roughness=0.15),
    "ice_black": MaterialSpec((18, 31, 43, 255), metallic=0.12, roughness=0.24),
    "ice_old": MaterialSpec((77, 118, 139, 255), metallic=0.08, roughness=0.3),
    "ice_clear": MaterialSpec((178, 229, 239, 255), emission=0.36, roughness=0.1),
    "winter_blue": MaterialSpec((58, 169, 255, 255), emission=1.7, roughness=0.2),
    "winter_white": MaterialSpec((228, 255, 255, 255), emission=2.6, roughness=0.12),
    "rain_blue": MaterialSpec((68, 156, 190, 255), emission=0.55, roughness=0.16),
    "ash_gray": MaterialSpec((93, 101, 106, 255), roughness=0.88),
    "roof_iron": MaterialSpec((43, 43, 49, 255), metallic=0.62, roughness=0.46),
    "snow": MaterialSpec((232, 239, 235, 255), roughness=0.86),
    "timber_black": MaterialSpec((30, 27, 31, 255), roughness=0.94),
    "timber": MaterialSpec((82, 55, 43, 255), roughness=0.9),
    "cloth_gray": MaterialSpec((77, 77, 85, 255), roughness=0.98),
    "cloth_dark": MaterialSpec((38, 35, 48, 255), roughness=0.98),
    "cloth_brown": MaterialSpec((90, 62, 48, 255), roughness=0.98),
    "cloth_umber": MaterialSpec((70, 44, 38, 255), roughness=0.98),
    "bone": MaterialSpec((205, 194, 162, 255), roughness=0.82),
    "bone_dark": MaterialSpec((115, 104, 89, 255), roughness=0.88),
    "echo_violet": MaterialSpec((160, 89, 255, 255), emission=1.5, roughness=0.2),
    "echo_cyan": MaterialSpec((83, 232, 242, 255), emission=1.8, roughness=0.16),
    "echo_magenta": MaterialSpec((238, 72, 197, 255), emission=1.5, roughness=0.2),
    "mirror": MaterialSpec((188, 204, 221, 255), metallic=0.82, roughness=0.12),
    "indigo": MaterialSpec((39, 31, 88, 255), roughness=0.58),
    "amber": MaterialSpec((188, 96, 39, 255), roughness=0.56),
    "amber_light": MaterialSpec((255, 181, 61, 255), emission=0.75, roughness=0.35),
    "rose_crystal": MaterialSpec((235, 92, 135, 255), emission=1.0, roughness=0.22),
    "slate": MaterialSpec((48, 59, 68, 255), roughness=0.7),
    "river_stone": MaterialSpec((90, 101, 106, 255), roughness=0.76),
    "river_light": MaterialSpec((143, 153, 149, 255), roughness=0.72),
    "wet_slate": MaterialSpec((37, 46, 54, 255), metallic=0.1, roughness=0.38),
    "resonance_amber": MaterialSpec((255, 157, 45, 255), emission=2.0, roughness=0.22),
    "dragon_bronze_dark": MaterialSpec(
        (62, 42, 35, 255), metallic=0.38, roughness=0.42
    ),
    "dragon_bronze": MaterialSpec((126, 82, 47, 255), metallic=0.42, roughness=0.34),
    "dragon_bronze_light": MaterialSpec(
        (183, 126, 72, 255), metallic=0.36, roughness=0.3
    ),
    "river_scale": MaterialSpec((151, 158, 153, 255), metallic=0.08, roughness=0.44),
    "river_scale_pale": MaterialSpec(
        (210, 216, 203, 255), metallic=0.05, roughness=0.38
    ),
    "wing_vellum": MaterialSpec((189, 166, 139, 255), emission=0.05, roughness=0.5),
    "binding_iron": MaterialSpec((48, 47, 52, 255), metallic=0.7, roughness=0.4),
    "bell_gold": MaterialSpec((187, 118, 42, 255), metallic=0.84, roughness=0.24),
    "voice_amber": MaterialSpec((255, 151, 48, 255), emission=2.5, roughness=0.16),
    "river_voice": MaterialSpec((89, 196, 224, 255), emission=1.45, roughness=0.16),
    "wraith_dark": MaterialSpec((41, 27, 63, 255), roughness=0.62),
    "wraith_violet": MaterialSpec((92, 55, 140, 255), emission=0.22, roughness=0.42),
    "ectoplasm": MaterialSpec((149, 235, 197, 255), emission=1.1, roughness=0.2),
    "sigil_white": MaterialSpec((229, 255, 239, 255), emission=2.2, roughness=0.18),
    "bark": MaterialSpec((72, 50, 36, 255), roughness=0.94),
    "bark_light": MaterialSpec((112, 76, 48, 255), roughness=0.92),
    "root_dark": MaterialSpec((43, 34, 28, 255), roughness=0.96),
    "mud": MaterialSpec((80, 65, 48, 255), roughness=0.88),
    "stone": MaterialSpec((103, 105, 101, 255), roughness=0.82),
    "stone_light": MaterialSpec((151, 151, 137, 255), roughness=0.8),
    "muck_orange": MaterialSpec((241, 111, 30, 255), emission=1.35, roughness=0.3),
    "moss": MaterialSpec((75, 116, 57, 255), roughness=0.94),
    "moss_light": MaterialSpec((125, 157, 77, 255), roughness=0.9),
    "corruption": MaterialSpec((174, 25, 48, 255), emission=1.25, roughness=0.28),
}


def _shifted_material(spec: MaterialSpec, kind: str) -> MaterialSpec:
    r, g, b, a = spec.rgba
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if kind == "shadow":
        # Shadows move slightly toward blue/purple instead of becoming gray.
        h = (h + 0.025) % 1.0
        s = min(1.0, s * 1.08 + 0.02)
        v *= 0.58
        emission = spec.emission * 0.86
    else:
        # Highlights move warm and lose a little saturation like painted wear.
        h = (h - 0.018) % 1.0
        s *= 0.82
        v = min(1.0, v * 1.18 + 0.08)
        emission = spec.emission * 1.08
    shifted = colorsys.hsv_to_rgb(h, s, v)
    return MaterialSpec(
        tuple(int(round(channel * 255)) for channel in shifted) + (a,),
        emission=emission,
        metallic=spec.metallic,
        roughness=spec.roughness,
    )


for _base_name, _base_spec in list(MATERIALS.items()):
    if _base_spec.emission < 1.0:
        MATERIALS[f"{_base_name}__shadow"] = _shifted_material(_base_spec, "shadow")
        MATERIALS[f"{_base_name}__highlight"] = _shifted_material(
            _base_spec, "highlight"
        )


@dataclass
class BoneDef:
    pivot: Vec3
    parent: Optional[str] = "Root"


@dataclass
class BossDefinition:
    slug: str
    name: str
    world_size: Vec3  # X width, Y height, Z depth in game coordinates.
    archetype: str
    preview_action: str
    preview_frame: int
    special_clips: Sequence[str]
    build: "callable"


@dataclass
class VoxelBuilder:
    slug: str
    cells: Dict[Cell, Tuple[str, str]] = field(default_factory=dict)
    bones: Dict[str, BoneDef] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.bone("Root", (0, 0, 0), None)

    def bone(self, name: str, pivot: Vec3, parent: Optional[str] = "Root") -> None:
        self.bones[name] = BoneDef(pivot, parent)

    def voxel(self, bone: str, point: Vec3, material: str) -> None:
        if material not in MATERIALS:
            raise KeyError(f"Unknown material {material}")
        cell = tuple(int(round(v)) for v in point)
        self.cells[cell] = (material, bone)

    def box(self, bone: str, center: Vec3, size: Vec3, material: str) -> None:
        mins = [int(math.floor(center[i] - size[i] / 2)) for i in range(3)]
        maxs = [int(math.ceil(center[i] + size[i] / 2)) for i in range(3)]
        for x in range(mins[0], maxs[0]):
            for y in range(mins[1], maxs[1]):
                for z in range(mins[2], maxs[2]):
                    self.voxel(bone, (x, y, z), material)

    def ellipsoid(self, bone: str, center: Vec3, radius: Vec3, material: str) -> None:
        rx, ry, rz = (max(0.51, float(v)) for v in radius)
        for x in range(math.floor(center[0] - rx), math.ceil(center[0] + rx) + 1):
            for y in range(math.floor(center[1] - ry), math.ceil(center[1] + ry) + 1):
                for z in range(
                    math.floor(center[2] - rz), math.ceil(center[2] + rz) + 1
                ):
                    d = (
                        ((x - center[0]) / rx) ** 2
                        + ((y - center[1]) / ry) ** 2
                        + ((z - center[2]) / rz) ** 2
                    )
                    if d <= 1.0:
                        self.voxel(bone, (x, y, z), material)

    def line(
        self,
        bone: str,
        start: Vec3,
        end: Vec3,
        radius: float,
        material: str,
        end_radius: Optional[float] = None,
    ) -> None:
        length = Vector(end).copy()
        length -= Vector(start)
        steps = max(1, int(length.length * 1.8))
        r2 = radius if end_radius is None else end_radius
        for i in range(steps + 1):
            t = i / steps
            p = tuple(start[j] + (end[j] - start[j]) * t for j in range(3))
            r = radius + (r2 - radius) * t
            self.ellipsoid(bone, p, (r, r, r), material)

    def cone(
        self,
        bone: str,
        base: Vec3,
        tip: Vec3,
        radius: float,
        material: str,
    ) -> None:
        self.line(bone, base, tip, radius, material, 0.55)

    def ring_xz(
        self,
        bone: str,
        center: Vec3,
        radius_x: float,
        radius_z: float,
        thickness: float,
        material: str,
        arc: Tuple[float, float] = (0.0, math.tau),
    ) -> None:
        count = max(18, int(max(radius_x, radius_z) * 5))
        for i in range(count + 1):
            angle = arc[0] + (arc[1] - arc[0]) * i / count
            p = (
                center[0] + math.cos(angle) * radius_x,
                center[1],
                center[2] + math.sin(angle) * radius_z,
            )
            self.ellipsoid(bone, p, (thickness, thickness, thickness), material)

    def ring_xy(
        self,
        bone: str,
        center: Vec3,
        radius_x: float,
        radius_y: float,
        thickness: float,
        material: str,
    ) -> None:
        count = max(18, int(max(radius_x, radius_y) * 5))
        for i in range(count):
            angle = math.tau * i / count
            p = (
                center[0] + math.cos(angle) * radius_x,
                center[1] + math.sin(angle) * radius_y,
                center[2],
            )
            self.ellipsoid(bone, p, (thickness, thickness, thickness), material)

    def triangle(
        self,
        bone: str,
        a: Vec3,
        b: Vec3,
        c: Vec3,
        thickness: float,
        material: str,
    ) -> None:
        edge = max((Vector(a) - Vector(b)).length, (Vector(a) - Vector(c)).length)
        steps = max(6, int(edge * 1.4))
        for i in range(steps + 1):
            for j in range(steps + 1 - i):
                u = i / steps
                v = j / steps
                w = 1.0 - u - v
                p = tuple(a[k] * w + b[k] * u + c[k] * v for k in range(3))
                self.ellipsoid(
                    bone,
                    p,
                    (thickness, thickness, thickness),
                    material,
                )

    def spiral(
        self,
        bone: str,
        center: Vec3,
        radius: float,
        height: float,
        turns: float,
        material: str,
        phase: float = 0.0,
        thickness: float = 0.8,
    ) -> None:
        count = max(24, int(turns * 32))
        for i in range(count + 1):
            t = i / count
            angle = phase + math.tau * turns * t
            p = (
                center[0] + math.cos(angle) * radius,
                center[1] + math.sin(angle) * radius,
                center[2] - height / 2 + height * t,
            )
            self.ellipsoid(
                bone,
                p,
                (thickness, thickness, thickness),
                material,
            )

    def crown_spike(
        self,
        bone: str,
        base: Vec3,
        direction: Vec3,
        length: float,
        radius: float,
        material: str,
    ) -> None:
        end = tuple(base[i] + direction[i] * length for i in range(3))
        self.cone(bone, base, end, radius, material)


def add_eye_pair(
    b: VoxelBuilder,
    bone: str,
    center: Vec3,
    spread: float,
    material: str,
    forward_offset: float = -1.0,
) -> None:
    for side in (-1, 1):
        b.ellipsoid(
            bone,
            (center[0] + side * spread, center[1] + forward_offset, center[2]),
            (0.75, 0.75, 0.75),
            material,
        )


def add_bell(
    b: VoxelBuilder,
    bone: str,
    center: Vec3,
    scale: float,
    metal: str,
    glow: str,
) -> None:
    b.ellipsoid(bone, center, (2.0 * scale, 1.6 * scale, 2.2 * scale), metal)
    b.box(
        bone,
        (center[0], center[1], center[2] - 1.7 * scale),
        (5.0 * scale, 4.0 * scale, 1.0 * scale),
        metal,
    )
    b.ellipsoid(
        bone,
        (center[0], center[1], center[2] - 2.4 * scale),
        (0.7 * scale, 0.7 * scale, 0.9 * scale),
        glow,
    )


def add_humanoid(
    b: VoxelBuilder,
    prefix: str,
    at: Vec3,
    scale: float,
    body_material: str,
    trim_material: str,
    skin_material: str,
    parent: str = "Root",
    crooked: float = 0.0,
) -> Dict[str, str]:
    def n(part: str) -> str:
        return f"{prefix}.{part}" if prefix else part

    x, y, z = at
    b.bone(n("Body"), (x, y, z + 8 * scale), parent)
    b.bone(n("Head"), (x + crooked, y, z + 15 * scale), n("Body"))
    b.bone(n("Arm.L"), (x - 3.2 * scale, y, z + 11.5 * scale), n("Body"))
    b.bone(n("Arm.R"), (x + 3.2 * scale, y, z + 11.5 * scale), n("Body"))
    b.bone(n("Leg.L"), (x - 1.6 * scale, y, z + 5.5 * scale), n("Body"))
    b.bone(n("Leg.R"), (x + 1.6 * scale, y, z + 5.5 * scale), n("Body"))
    b.ellipsoid(
        n("Body"),
        (x, y, z + 10 * scale),
        (3.6 * scale, 2.3 * scale, 5.7 * scale),
        body_material,
    )
    b.box(
        n("Body"),
        (x, y - 2.2 * scale, z + 10 * scale),
        (5.0 * scale, 1.0 * scale, 5.5 * scale),
        trim_material,
    )
    b.ellipsoid(
        n("Head"),
        (x + crooked, y - 0.4 * scale, z + 16.3 * scale),
        (2.3 * scale, 2.0 * scale, 2.6 * scale),
        skin_material,
    )
    # Faces stay tiny but intentional: brows, eyes, nose, and mouth are placed
    # on the close-view layer while the head/hair silhouette remains dominant.
    for side in (-1, 1):
        b.ellipsoid(
            n("Head"),
            (x + crooked + side * 0.85 * scale, y - 2.1 * scale, z + 16.8 * scale),
            (0.42 * scale, 0.42 * scale, 0.42 * scale),
            trim_material,
        )
        b.box(
            n("Head"),
            (x + crooked + side * 0.85 * scale, y - 2.15 * scale, z + 17.55 * scale),
            (1.0 * scale, 0.5 * scale, 0.4 * scale),
            trim_material,
        )
    b.ellipsoid(
        n("Head"),
        (x + crooked, y - 2.35 * scale, z + 16.0 * scale),
        (0.48 * scale, 0.5 * scale, 0.7 * scale),
        skin_material,
    )
    b.box(
        n("Head"),
        (x + crooked, y - 2.18 * scale, z + 14.95 * scale),
        (1.3 * scale, 0.5 * scale, 0.4 * scale),
        trim_material,
    )
    b.line(
        n("Arm.L"),
        (x - 3 * scale, y, z + 12 * scale),
        (x - 5.3 * scale, y - 0.5 * scale, z + 6.4 * scale),
        1.05 * scale,
        body_material,
        0.75 * scale,
    )
    b.line(
        n("Arm.R"),
        (x + 3 * scale, y, z + 12 * scale),
        (x + 5.3 * scale, y - 0.5 * scale, z + 6.4 * scale),
        1.05 * scale,
        body_material,
        0.75 * scale,
    )
    b.ellipsoid(
        n("Arm.L"),
        (x - 5.4 * scale, y - 0.6 * scale, z + 5.7 * scale),
        (1.05 * scale, 0.95 * scale, 1.2 * scale),
        skin_material,
    )
    b.ellipsoid(
        n("Arm.R"),
        (x + 5.4 * scale, y - 0.6 * scale, z + 5.7 * scale),
        (1.05 * scale, 0.95 * scale, 1.2 * scale),
        skin_material,
    )
    b.line(
        n("Leg.L"),
        (x - 1.5 * scale, y, z + 6 * scale),
        (x - 1.7 * scale, y, z + 0.7 * scale),
        1.2 * scale,
        body_material,
        0.85 * scale,
    )
    b.line(
        n("Leg.R"),
        (x + 1.5 * scale, y, z + 6 * scale),
        (x + 1.7 * scale, y, z + 0.7 * scale),
        1.2 * scale,
        body_material,
        0.85 * scale,
    )
    # Chunky offset boots keep figures grounded and readable in gameplay views.
    b.box(
        n("Leg.L"),
        (x - 1.7 * scale, y - 0.8 * scale, z + 0.65 * scale),
        (2.2 * scale, 3.0 * scale, 1.4 * scale),
        trim_material,
    )
    b.box(
        n("Leg.R"),
        (x + 1.7 * scale, y - 0.8 * scale, z + 0.65 * scale),
        (2.2 * scale, 3.0 * scale, 1.4 * scale),
        trim_material,
    )
    b.box(
        n("Body"),
        (x, y - 2.45 * scale, z + 8.0 * scale),
        (7.0 * scale, 0.8 * scale, 1.0 * scale),
        trim_material,
    )
    return {
        "body": n("Body"),
        "head": n("Head"),
        "arm_l": n("Arm.L"),
        "arm_r": n("Arm.R"),
        "leg_l": n("Leg.L"),
        "leg_r": n("Leg.R"),
    }


def build_breach_helix_aberration(b: VoxelBuilder) -> None:
    """Build the quest-gated breach predator around its exposed living helix."""

    b.bone("Body", (0, 2, 24))
    b.bone("Carapace.L", (-8, 1, 28), "Body")
    b.bone("Carapace.R", (8, 1, 28), "Body")
    b.bone("Rib.L", (-6, -5, 24), "Body")
    b.bone("Rib.R", (6, -5, 24), "Body")
    b.bone("Helix.A", (0, -4, 25), "Body")
    b.bone("Helix.B", (0, -4, 25), "Body")
    b.bone("Head", (0, -15, 30), "Body")
    b.bone("Jaw", (0, -23, 24), "Head")
    b.bone("Crown", (0, -10, 36), "Head")
    b.bone("Arm.L", (-11, -7, 28), "Body")
    b.bone("Forearm.L", (-18, -12, 21), "Arm.L")
    b.bone("Claw.L", (-24, -18, 13), "Forearm.L")
    b.bone("Arm.R", (10, -5, 30), "Body")
    b.bone("Forearm.R", (17, -11, 27), "Arm.R")
    b.bone("Emitter", (24, -18, 25), "Forearm.R")
    b.bone("Spore.L", (-9, 10, 30), "Body")
    b.bone("Spore.R", (8, 13, 26), "Body")
    b.bone("Tail.1", (0, 14, 21), "Body")
    b.bone("Tail.2", (-2, 26, 15), "Tail.1")
    b.bone("Tail.3", (4, 37, 9), "Tail.2")

    leg_specs = {
        "FL": ((-8, -7, 19), (-15, -13, 11), (-19, -18, 3)),
        "FR": ((8, -7, 18), (14, -15, 10), (18, -20, 3)),
        "BL": ((-8, 8, 17), (-16, 14, 9), (-21, 20, 2)),
        "BR": ((8, 9, 16), (15, 17, 8), (20, 23, 2)),
    }
    for suffix, (hip, knee, foot) in leg_specs.items():
        upper = f"Leg.{suffix}"
        shin = f"Shin.{suffix}"
        claw = f"Foot.{suffix}"
        b.bone(upper, hip, "Body")
        b.bone(shin, knee, upper)
        b.bone(claw, foot, shin)

    # Primary silhouette: low six-limbed breach hunter with an open rib cage.
    b.ellipsoid("Body", (0, 3, 23), (11, 15, 10), "muck_gloss")
    b.ellipsoid("Body", (-2, 5, 25), (8, 12, 9), "muck_hide")
    b.box("Body", (0, 8, 31), (13, 17, 4), "chitin_black")
    b.triangle("Body", (-10, 8, 29), (10, 8, 29), (0, 18, 36), 1.4, "muck_black")
    for y in (-2, 4, 10, 16):
        b.box("Body", (0, y, 34), (11, 2, 2), "scar_dark")
    b.line("Body", (-4, 14, 20), (4, 14, 20), 1.0, "scar_pale")

    # Split carapace exposes the signature double helix instead of hiding it.
    for bone, side in (("Carapace.L", -1), ("Carapace.R", 1)):
        b.ellipsoid(bone, (side * 9, 0, 29), (5, 11, 8), "chitin_black")
        b.triangle(
            bone,
            (side * 6, -9, 24),
            (side * 15, 2, 27),
            (side * 8, 10, 38),
            1.3,
            "muck_deep",
        )
        b.line(bone, (side * 13, -5, 24), (side * 10, 8, 36), 0.9, "scar_red")
        for y, z in ((-5, 27), (2, 35), (8, 29)):
            b.cone(
                bone,
                (side * 12, y, z),
                (side * 17, y + 1, z + 2),
                0.9,
                "bone_dark",
            )
    b.box("Carapace.R", (13, 5, 31), (3, 7, 5), "scar_pale")
    b.line("Carapace.R", (14, 2, 35), (11, 8, 27), 0.7, "breach_violet")

    for bone, side in (("Rib.L", -1), ("Rib.R", 1)):
        for z in (18, 23, 28, 33):
            b.line(
                bone,
                (side * 4, -7, z),
                (side * 12, -10, z - 2),
                0.9,
                "bone_dark",
                0.55,
            )
            b.cone(
                bone,
                (side * 12, -10, z - 2),
                (side * 7, -13, z - 3),
                0.55,
                "scar_pale",
            )

    helix_center = (0, -8, 25)
    b.spiral(
        "Helix.A", helix_center, 4.5, 23, 2.75, "scar_red", phase=0.15, thickness=1.05
    )
    b.spiral(
        "Helix.B",
        helix_center,
        4.5,
        23,
        2.75,
        "toxic_lime",
        phase=math.pi + 0.15,
        thickness=0.95,
    )
    for z in range(15, 37, 3):
        phase = (z - 14) / 23 * math.tau * 2.75 + 0.15
        a = (math.cos(phase) * 4.5, -8 + math.sin(phase) * 4.5, z)
        c = (
            math.cos(phase + math.pi) * 4.5,
            -8 + math.sin(phase + math.pi) * 4.5,
            z,
        )
        b.line("Helix.A", a, c, 0.3, "breach_violet")
    b.ellipsoid("Helix.B", (0, -12, 25), (2.2, 1.1, 5.5), "breach_violet")

    # Flat predatory head, blind left side, clustered right-side breach eyes.
    b.ellipsoid("Head", (0, -16, 31), (8, 8, 6), "muck_black")
    b.triangle("Head", (-8, -19, 32), (8, -19, 32), (0, -10, 40), 1.5, "chitin_black")
    b.box("Head", (0, -23, 27), (12, 8, 6), "muck_deep")
    b.box("Head", (-4, -26, 31), (5, 2, 4), "scar_dark")
    for x, z, size in ((2.0, 33, 1.0), (4.3, 31, 0.8), (5.0, 34, 0.65)):
        b.ellipsoid("Head", (x, -26, z), (size, 0.8, size), "toxic_lime")
    b.line("Head", (-6, -25, 34), (-1, -25, 29), 0.8, "scar_pale")
    b.box("Jaw", (0, -27, 23), (11, 7, 3), "scar_dark")
    b.ellipsoid("Jaw", (0, -28, 24), (4.5, 3, 2.2), "scar_red")
    for x in (-4.5, -2.2, 0, 2.2, 4.5):
        b.cone("Jaw", (x, -29, 25), (x * 1.06, -32, 21), 0.75, "bone")
    for side in (-1, 1):
        b.cone("Crown", (side * 4, -12, 36), (side * 9, -8, 45), 1.2, "scar_red")
    b.cone("Crown", (0, -11, 38), (-2, -6, 48), 1.4, "chitin_black")

    # Left arm is a scar-grown demolition maul; the right is a breach siphon.
    b.line("Arm.L", (-9, -5, 29), (-17, -11, 23), 4.0, "muck_black", 3.2)
    b.ellipsoid("Arm.L", (-12, -7, 28), (4.5, 5, 5), "chitin_black")
    b.line("Forearm.L", (-17, -11, 23), (-23, -17, 15), 4.2, "scar_dark", 3.2)
    b.ellipsoid("Claw.L", (-25, -20, 12), (7, 6, 6), "scar_red")
    b.box("Claw.L", (-25, -23, 13), (10, 5, 5), "chitin_black")
    for tip in ((-32, -27, 10), (-29, -28, 5), (-23, -30, 5)):
        b.cone("Claw.L", (-25, -22, 12), tip, 1.8, "bone_dark")
    b.line("Claw.L", (-29, -19, 16), (-21, -25, 8), 0.9, "scar_pale")

    b.line("Arm.R", (8, -3, 30), (16, -10, 28), 3.2, "muck_hide", 2.6)
    b.line("Forearm.R", (16, -10, 28), (23, -17, 25), 3.0, "chitin_black", 2.3)
    b.ellipsoid("Emitter", (25, -20, 25), (6, 6, 6), "muck_black")
    b.ring_xz("Emitter", (25, -24, 25), 5.0, 5.0, 0.9, "chitin_black")
    b.ring_xz("Emitter", (25, -25, 25), 3.4, 3.4, 0.65, "scar_dark")
    b.ellipsoid("Emitter", (25, -26, 25), (2.2, 1.25, 2.2), "muck_black")
    b.ellipsoid("Emitter", (25, -27, 25), (0.9, 0.7, 0.9), "toxic_lime")
    for angle in range(0, 360, 60):
        radians = math.radians(angle)
        b.cone(
            "Emitter",
            (25 + math.cos(radians) * 4, -22, 25 + math.sin(radians) * 4),
            (25 + math.cos(radians) * 7, -24, 25 + math.sin(radians) * 7),
            0.8,
            "scar_pale" if angle % 120 == 0 else "bone_dark",
        )

    for bone, center, material in (
        ("Spore.L", (-10, 12, 31), "scar_red"),
        ("Spore.R", (9, 15, 27), "breach_violet"),
    ):
        b.ellipsoid(bone, center, (4.5, 5.5, 5.5), "scar_dark")
        for offset in ((-2, -1, 2), (1, 2, 1), (2, -2, -1)):
            b.ellipsoid(
                bone,
                tuple(center[i] + offset[i] for i in range(3)),
                (1.0, 1.0, 1.0),
                material,
            )

    for suffix, (hip, knee, foot) in leg_specs.items():
        upper = f"Leg.{suffix}"
        shin = f"Shin.{suffix}"
        claw = f"Foot.{suffix}"
        side = -1 if suffix.endswith("L") else 1
        b.line(upper, hip, knee, 3.0, "muck_black", 2.2)
        b.ellipsoid(upper, hip, (3.6, 4.0, 3.6), "chitin_black")
        b.ellipsoid(upper, knee, (2.8, 2.8, 2.8), "scar_dark")
        b.line(shin, knee, foot, 2.1, "muck_gloss", 1.3)
        b.line(
            shin,
            (knee[0] + side, knee[1], knee[2] + 1),
            (foot[0] + side, foot[1], foot[2] + 1),
            0.55,
            "toxic_lime",
        )
        for spread in (-2, 0, 2):
            b.cone(
                claw,
                foot,
                (foot[0] + spread + side, foot[1] - 5, 0),
                0.9,
                "bone_dark",
            )

    b.line("Tail.1", (0, 14, 21), (-2, 27, 15), 4.0, "muck_hide", 3.0)
    b.line("Tail.2", (-2, 26, 15), (4, 39, 9), 3.0, "muck_black", 1.8)
    b.cone("Tail.3", (4, 38, 9), (-1, 51, 3), 1.9, "chitin_black")
    for y, z in ((22, 20), (30, 15), (38, 10), (45, 6)):
        b.cone("Tail.2", (1, y, z), (7, y + 1, z + 5), 0.9, "scar_red")


def build_sun_court_guardian(b: VoxelBuilder) -> None:
    """Build the Gilded Bull as a layered, damage-readable temple automaton."""

    b.bone("Body", (0, 0, 17))
    b.bone("Shoulder.L", (-9, -7, 20), "Body")
    b.bone("Shoulder.R", (9, -7, 20), "Body")
    b.bone("Haunch.L", (-8, 10, 18), "Body")
    b.bone("Haunch.R", (8, 10, 18), "Body")
    b.bone("CoreDoor.L", (3, -15, 18), "Body")
    b.bone("CoreDoor.R", (11, -15, 18), "Body")
    b.bone("CoreFrame", (7, -16, 18), "Body")
    b.bone("Emitter", (7, -16, 18), "CoreFrame")
    b.bone("Neck", (0, -13, 21), "Body")
    b.bone("Head", (0, -22, 21), "Neck")
    b.bone("Jaw", (0, -27, 15), "Head")
    b.bone("Crown", (0, -20, 26), "Head")
    b.bone("HornBase.L", (-6, -24, 24), "Head")
    b.bone("HornBase.R", (6, -24, 24), "Head")
    b.bone("Horn.L", (-8, -26, 25), "HornBase.L")
    b.bone("Horn.R", (8, -26, 25), "HornBase.R")
    b.bone("Vent.L", (-8, 5, 23), "Body")
    b.bone("Vent.R", (8, 5, 23), "Body")
    b.bone("Tail.1", (0, 14, 17), "Body")
    b.bone("Tail.2", (0, 22, 14), "Tail.1")
    b.bone("Tail.3", (2, 29, 11), "Tail.2")
    b.bone("TailCharm", (3, 34, 9), "Tail.3")

    leg_specs = {
        "FL": ((-9, -8, 18), (-11, -10, 10), (-10, -12, 4), (-10, -15, 2)),
        "FR": ((9, -8, 18), (11, -10, 10), (10, -12, 4), (10, -15, 2)),
        "BL": ((-8, 9, 16), (-11, 13, 10), (-9, 14, 4), (-9, 13, 2)),
        "BR": ((8, 9, 16), (11, 13, 10), (9, 14, 4), (9, 13, 2)),
    }
    for suffix, (hip, knee, ankle, hoof) in leg_specs.items():
        upper = f"Leg.{suffix}"
        shin = f"Shin.{suffix}"
        hoof_bone = f"Hoof.{suffix}"
        b.bone(upper, hip, "Body")
        b.bone(shin, knee, upper)
        b.bone(hoof_bone, ankle, shin)

    # Primary chassis: low, long, and wedge-heavy so the charge reads at range.
    b.ellipsoid("Body", (0, 1, 16), (9, 16, 6), "sun_iron")
    b.ellipsoid("Body", (0, 0, 18), (8, 15, 6), "bronze_aged")
    b.box("Body", (0, 1, 22), (14, 23, 4), "bronze_mid")
    b.box("Body", (0, 5, 24), (10, 15, 2), "bronze_worn")
    b.triangle("Body", (-7, -11, 22), (7, -11, 22), (0, 8, 27), 1.0, "bronze")
    b.box("Body", (0, 13, 19), (14, 7, 6), "bronze_dark")
    b.box("Body", (0, 14, 22), (11, 5, 3), "bronze_mid")
    for x in (-6, 6):
        b.line("Body", (x, -8, 13), (x, 11, 13), 1.1, "bronze_worn")
        b.line("Body", (x, -6, 11), (x, 9, 11), 0.65, "sun_ivory")
    for y in (-7, 0, 7):
        b.box("Body", (0, y, 24), (11, 1.4, 1.1), "gold")
    b.line("Body", (0, -8, 25), (0, 12, 25), 0.7, "gold_light")
    for x in (-4, 4):
        for y in (-6, 2, 10):
            b.ellipsoid("Body", (x, y, 24.8), (0.7, 0.7, 0.7), "sun_ivory")

    # Exaggerated shoulder armor frames the head and protects the core aperture.
    for bone, side in (("Shoulder.L", -1), ("Shoulder.R", 1)):
        b.ellipsoid(bone, (side * 10, -7, 20), (6, 8, 6), "bronze_mid")
        b.ellipsoid(bone, (side * 11, -8, 21), (3.5, 6, 4.5), "bronze_worn")
        b.triangle(
            bone,
            (side * 15, -13, 17),
            (side * 15, 1, 18),
            (side * 9, -6, 27),
            1.1,
            "bronze_aged",
        )
        b.line(bone, (side * 14, -12, 18), (side * 14, 0, 19), 0.8, "gold")
        b.line(bone, (side * 10, -14, 23), (side * 14, -8, 25), 0.7, "gold_light")
        for y, z in ((-12, 19), (-8, 25), (-2, 20)):
            b.ellipsoid(bone, (side * 14.5, y, z), (0.8, 0.8, 0.8), "sun_ivory")
    # The left shoulder was repaired with an ivory plate and mismatched clamps.
    b.box("Shoulder.L", (-14, -5, 21), (2, 8, 6), "sun_ivory")
    b.box("Shoulder.L", (-15, -8, 23), (1.5, 2, 8), "gold")
    b.line("Shoulder.L", (-15, -8, 18), (-15, -1, 25), 0.65, "bronze_dark")
    # Oxidation is concentrated in recesses, not sprayed uniformly.
    b.line("Shoulder.R", (14, -11, 17), (14, -2, 19), 0.75, "verdigris")
    b.line("Shoulder.R", (12, -5, 25), (14, 0, 21), 0.55, "verdigris")

    for bone, side in (("Haunch.L", -1), ("Haunch.R", 1)):
        b.ellipsoid(bone, (side * 8, 11, 18), (5.5, 7, 6), "bronze_aged")
        b.box(bone, (side * 10, 12, 21), (4, 9, 5), "bronze_mid")
        b.line(bone, (side * 12, 8, 17), (side * 12, 16, 20), 0.8, "gold")
    b.line("Haunch.R", (12, 9, 21), (8, 14, 17), 0.75, "core_cyan")
    b.line("Haunch.R", (11, 12, 23), (9, 15, 20), 0.55, "core_gold")
    b.box("Haunch.L", (-11, 14, 17), (2, 6, 3), "verdigris")

    # Signature feature: a sunburst aperture around the shaved-Weight core.
    core_x = 7.0
    b.ellipsoid("Emitter", (core_x, -16, 18), (3.0, 1.35, 3.0), "core_cyan")
    b.ellipsoid("Emitter", (core_x, -17.2, 18), (1.3, 0.8, 1.3), "core_white")
    b.ring_xz("CoreFrame", (core_x, -16.2, 18), 4.6, 4.6, 0.85, "gold")
    b.ring_xz("CoreFrame", (core_x, -17.0, 18), 3.2, 3.2, 0.55, "core_gold")
    for angle in range(0, 360, 45):
        radians = math.radians(angle)
        start = (
            core_x + math.cos(radians) * 4.2,
            -16.4,
            18 + math.sin(radians) * 4.2,
        )
        end = (
            core_x + math.cos(radians) * 6.1,
            -16.4,
            18 + math.sin(radians) * 6.1,
        )
        b.line("CoreFrame", start, end, 0.6, "gold_light")
    b.triangle("CoreDoor.L", (-1, -16, 13), (5, -17, 18), (-1, -16, 23), 1.2, "bronze")
    b.triangle("CoreDoor.R", (15, -16, 13), (9, -17, 18), (15, -16, 23), 1.2, "bronze")
    b.line("CoreDoor.L", (-1, -17, 13), (5, -17, 18), 0.65, "gold")
    b.line("CoreDoor.R", (15, -17, 13), (9, -17, 18), 0.65, "gold")

    # Neck and compact armored head stay visually separate from the torso.
    b.line("Neck", (0, -12, 20), (0, -20, 21), 5.0, "sun_iron", 4.2)
    for y in (-14, -17, -20):
        b.box("Neck", (0, y, 22), (9, 2, 4), "bronze_worn")
        b.box("Neck", (0, y - 0.8, 23), (6, 1, 1), "gold")
    b.ellipsoid("Head", (0, -22, 21), (7, 8, 6), "bronze_aged")
    b.triangle("Head", (-7, -25, 24), (7, -25, 24), (0, -18, 29), 1.4, "bronze_mid")
    b.box("Head", (0, -27, 18), (11, 7, 6), "sun_iron")
    b.box("Head", (0, -29, 19), (8, 3, 4), "bronze_worn")
    b.box("Head", (0, -27, 24), (13, 3, 3), "gold")
    b.box("Head", (0, -29, 23), (5, 2, 5), "bronze_mid")
    add_eye_pair(b, "Head", (0, -27, 22), 3.1, "core_cyan", -2.0)
    for side in (-1, 1):
        b.box("Head", (side * 3.1, -29.5, 23), (3.6, 1.2, 1.1), "bronze_dark")
        b.line(
            "Head",
            (side * 5.0, -30.2, 24.0),
            (side * 1.4, -30.2, 22.7),
            0.72,
            "gold",
        )
        b.ellipsoid("Head", (side * 2.1, -31, 18), (0.8, 0.8, 0.8), "core_gold")
        b.triangle(
            "Head",
            (side * 6, -23, 23),
            (side * 10, -20, 25),
            (side * 7, -24, 19),
            0.9,
            "bronze_dark",
        )
    b.box("Jaw", (0, -30, 14), (9, 5, 3), "bronze_dark")
    b.box("Jaw", (0, -31, 13), (6, 3, 1.5), "bronze_worn")
    b.cone("Jaw", (-3.5, -31, 14), (-4.5, -33, 12), 0.8, "sun_ivory")
    b.cone("Jaw", (3.5, -31, 14), (4.5, -33, 12), 0.8, "sun_ivory")
    for x in (-3, 0, 3):
        b.box("Jaw", (x, -32, 15), (1, 1, 2), "bronze_dark")
    b.triangle("Crown", (-4, -20, 27), (0, -19, 32), (0, -20, 27), 0.75, "gold")
    b.triangle("Crown", (4, -20, 27), (0, -19, 32), (0, -20, 27), 0.75, "bronze_worn")
    b.line("Crown", (0, -20, 27), (0, -19, 32), 0.65, "core_gold")

    # Breakaway cutting horns are arena-scale weapons; permanent cuffs become stumps.
    for bone, side in (("HornBase.L", -1), ("HornBase.R", 1)):
        b.ellipsoid(bone, (side * 6, -24, 24), (2.8, 2.7, 2.8), "bronze_dark")
        b.ring_xz(bone, (side * 6, -25, 24), 2.7, 2.7, 0.55, "core_gold")
        b.line(bone, (side * 5, -24, 23), (side * 8, -26, 25), 1.8, "gold", 1.45)
    b.line("Horn.L", (-8, -26, 25), (-14, -29, 27), 1.65, "sun_ivory", 1.15)
    b.cone("Horn.L", (-14, -29, 27), (-25, -33, 33), 1.15, "gold_light")
    b.line("Horn.L", (-9, -27, 25), (-14, -30, 28), 0.55, "gold")
    b.line("Horn.R", (8, -26, 25), (14, -29, 27), 1.65, "sun_ivory", 1.15)
    b.cone("Horn.R", (14, -29, 27), (23, -32, 30), 1.15, "gold_light")
    b.box("Horn.R", (23, -32, 30), (2, 2, 2), "sun_iron")
    b.line("Horn.R", (9, -27, 25), (14, -30, 28), 0.55, "gold")

    # Fully segmented piston legs sell construction, weight, and readable gait.
    for suffix, (hip, knee, ankle, hoof) in leg_specs.items():
        upper = f"Leg.{suffix}"
        shin = f"Shin.{suffix}"
        hoof_bone = f"Hoof.{suffix}"
        front = suffix.startswith("F")
        side = -1 if suffix.endswith("L") else 1
        b.line(upper, hip, knee, 3.7 if front else 3.4, "sun_iron", 2.8)
        b.ellipsoid(upper, hip, (4.4, 4.8, 4.1), "bronze_mid")
        b.ellipsoid(upper, knee, (3.4, 3.4, 3.2), "bronze_worn")
        b.ring_xz(upper, knee, 3.5, 3.5, 0.6, "gold")
        b.ellipsoid(upper, knee, (1.25, 1.25, 1.25), "core_cyan")
        b.line(shin, knee, ankle, 2.5, "bronze_aged", 2.0)
        b.line(
            shin,
            (knee[0] + side * 1.8, knee[1], knee[2] + 1),
            (ankle[0] + side * 1.4, ankle[1], ankle[2] + 1),
            0.7,
            "sun_ivory",
        )
        b.line(
            shin,
            (knee[0] - side * 1.2, knee[1] + 0.5, knee[2]),
            (ankle[0] - side * 1.0, ankle[1] + 0.5, ankle[2]),
            0.6,
            "gold_light",
        )
        b.box(shin, (ankle[0], ankle[1], ankle[2] + 1), (4.5, 4.5, 3), "bronze_dark")
        b.box(hoof_bone, hoof, (7 if front else 6.5, 9, 3), "sun_iron")
        b.box(hoof_bone, (hoof[0], hoof[1] - 1.5, 2.8), (6, 5, 1.2), "bronze_worn")
        b.box(hoof_bone, (hoof[0] - 1.8, hoof[1] - 3.4, 1.5), (2.2, 3, 2), "sun_ivory")
        b.box(hoof_bone, (hoof[0] + 1.8, hoof[1] - 3.4, 1.5), (2.2, 3, 2), "sun_ivory")
        b.line(
            hoof_bone,
            (hoof[0] - 2.5, hoof[1] + 1.5, 3),
            (hoof[0] + 2.5, hoof[1] + 1.5, 3),
            0.55,
            "gold",
        )
    b.box("Leg.BR", (12, 12, 12), (2, 5, 4), "sun_ivory")
    b.line("Leg.BR", (13, 10, 14), (13, 14, 10), 0.65, "gold")
    b.line("Shin.FL", (-12, -10, 9), (-10, -12, 4), 0.65, "verdigris")

    # Vents, segmented tail, and counterweight provide secondary motion.
    for bone, side in (("Vent.L", -1), ("Vent.R", 1)):
        b.line(bone, (side * 7, 4, 23), (side * 10, 9, 28), 1.2, "bronze_dark", 0.8)
        b.box(bone, (side * 10, 9, 28), (3, 4, 2), "gold")
        b.ellipsoid(bone, (side * 10, 10, 28), (1.0, 1.0, 1.0), "core_cyan")
    b.line("Tail.1", (0, 14, 17), (0, 23, 14), 2.2, "bronze_dark", 1.7)
    b.box("Tail.1", (0, 19, 16), (4, 3, 4), "bronze_mid")
    b.line("Tail.2", (0, 22, 14), (2, 29, 11), 1.7, "bronze_aged", 1.2)
    b.box("Tail.2", (1, 26, 12), (3, 3, 3), "gold")
    b.line("Tail.3", (2, 29, 11), (3, 34, 9), 1.2, "sun_iron", 0.8)
    b.ring_xz("TailCharm", (3, 35, 9), 3.2, 3.2, 0.75, "gold")
    b.ellipsoid("TailCharm", (3, 35, 9), (1.2, 1.2, 1.2), "core_gold")


def build_failed_year_colossus(b: VoxelBuilder) -> None:
    """Build the stalled ninth year as an Ash Hall roof-beam colossus."""

    b.bone("Body", (0, 2, 32))
    b.bone("YearShell.L", (-9, -2, 36), "Body")
    b.bone("YearShell.R", (9, -2, 36), "Body")
    b.bone("SnowMantle", (0, 5, 47), "Body")
    b.bone("HearthCore", (0, -12, 32), "Body")
    b.bone("Emitter", (0, -14, 32), "HearthCore")
    b.bone("TimeRing", (0, -11, 34), "Body")
    b.bone("Head", (0, -8, 49), "Body")
    b.bone("Jaw", (0, -15, 44), "Head")
    b.bone("Crown", (0, -2, 55), "Head")
    b.bone("Roofbeam.L", (-16, 5, 46), "Body")
    b.bone("Roofbeam.R", (16, 5, 44), "Body")
    b.bone("Arm.L", (-15, -1, 40), "Body")
    b.bone("Forearm.L", (-26, -5, 29), "Arm.L")
    b.bone("Hand.L", (-33, -12, 17), "Forearm.L")
    b.bone("Arm.R", (15, 0, 39), "Body")
    b.bone("Forearm.R", (27, -2, 28), "Arm.R")
    b.bone("Hand.R", (34, -8, 18), "Forearm.R")
    b.bone("Leg.L", (-9, 5, 22), "Body")
    b.bone("Shin.L", (-12, 4, 10), "Leg.L")
    b.bone("Foot.L", (-13, -2, 2), "Shin.L")
    b.bone("Leg.R", (9, 6, 22), "Body")
    b.bone("Shin.R", (12, 6, 10), "Leg.R")
    b.bone("Foot.R", (14, 0, 2), "Shin.R")
    b.bone("Rain.L", (-7, -10, 30), "Body")
    b.bone("Rain.R", (7, -10, 30), "Body")
    for index, x in enumerate((-16, -12, -8, -4, 0, 5, 9, 13, 17), start=1):
        b.bone(f"Crown.{index}", (x, -3, 56), "Crown")

    # Huge arched frame: the Ash Hall has stood up and begun walking.
    b.ellipsoid("Body", (0, 4, 34), (16, 13, 21), "ice_black")
    b.ellipsoid("Body", (0, 1, 36), (13, 11, 19), "ice_old")
    b.box("Body", (0, 7, 47), (27, 11, 6), "timber_black")
    b.box("Body", (0, 8, 29), (29, 8, 5), "timber")
    b.triangle("Body", (-15, 8, 28), (15, 8, 28), (0, 10, 52), 1.4, "roof_iron")
    for x in (-10, -5, 5, 10):
        b.line("Body", (x, -5, 20), (x * 0.75, 10, 51), 1.25, "timber_black")
    for y, z in ((-1, 23), (2, 31), (6, 39), (9, 47)):
        b.box("Body", (0, y, z), (25 - z * 0.12, 2.2, 2.5), "ash_gray")

    # Layered snow and clear ice are separate damage-state shells.
    for bone, side in (("YearShell.L", -1), ("YearShell.R", 1)):
        b.ellipsoid(bone, (side * 10, -2, 37), (8, 10, 17), "ice_old")
        b.triangle(
            bone,
            (side * 4, -11, 23),
            (side * 17, -6, 31),
            (side * 10, 2, 52),
            1.4,
            "ice_clear",
        )
        for z in (26, 34, 42, 50):
            b.cone(
                bone,
                (side * 13, -8, z),
                (side * 18, -10, z - 3),
                1.0,
                "ice_pale",
            )
    b.ellipsoid("SnowMantle", (0, 4, 50), (16, 11, 8), "snow")
    b.triangle("SnowMantle", (-16, -1, 49), (16, -1, 49), (0, 9, 59), 1.2, "ice_pale")
    b.box("SnowMantle", (-8, -5, 44), (8, 3, 9), "snow")
    b.box("SnowMantle", (7, -4, 47), (10, 3, 7), "snow")

    # The chest is not a heart but a dark room holding a failed dawn.
    b.ring_xz("HearthCore", (0, -12, 33), 8.2, 11.0, 1.5, "timber_black")
    b.ring_xz("HearthCore", (0, -13, 33), 6.0, 8.2, 1.1, "ice_clear")
    b.ellipsoid("HearthCore", (0, -13, 33), (5.2, 1.8, 7.2), "ice_black")
    b.ellipsoid("Emitter", (0, -15, 33), (2.8, 1.0, 4.4), "winter_white")
    b.line("Emitter", (0, -15, 28), (0, -15, 38), 0.8, "winter_blue")
    b.ring_xz("TimeRing", (0, -14, 34), 11.0, 13.0, 0.65, "winter_blue")
    for angle in range(0, 360, 45):
        radians = math.radians(angle)
        b.box(
            "TimeRing",
            (math.cos(radians) * 11, -14, 34 + math.sin(radians) * 13),
            (1.4, 1.2, 1.4),
            "winter_white",
        )

    # Faceless ice reliquary beneath the nine unfinished mornings.
    b.ellipsoid("Head", (0, -7, 51), (9, 8, 8), "ice_old")
    b.box("Head", (0, -13, 49), (13, 7, 8), "ice_black")
    b.triangle("Head", (-8, -14, 55), (8, -14, 55), (0, -8, 61), 1.3, "ice_clear")
    b.box("Head", (0, -17, 51), (9, 2, 4), "snow")
    b.line("Head", (-5, -17, 54), (-1, -17, 50), 0.8, "winter_blue")
    b.line("Head", (5, -17, 54), (1, -17, 50), 0.8, "winter_blue")
    b.ellipsoid("Head", (-3, -18, 52), (0.75, 0.75, 0.75), "winter_white")
    b.ellipsoid("Head", (3, -18, 52), (0.75, 0.75, 0.75), "winter_white")
    b.box("Jaw", (0, -18, 44), (10, 5, 3), "timber_black")
    for x in (-4, -2, 0, 2, 4):
        b.cone("Jaw", (x, -19, 44), (x, -20, 39 - abs(x) * 0.25), 0.7, "ice_clear")

    crown_specs = (
        (-16, 10, "timber_black"),
        (-12, 14, "ice_pale"),
        (-8, 11, "roof_iron"),
        (-4, 16, "ice_clear"),
        (0, 19, "winter_white"),
        (5, 13, "timber"),
        (9, 17, "ice_pale"),
        (13, 12, "roof_iron"),
        (17, 15, "ice_clear"),
    )
    for index, (x, length, material) in enumerate(crown_specs, start=1):
        b.crown_spike(
            f"Crown.{index}",
            (x * 0.65, -3, 56),
            (x * 0.008, 0.025, 1),
            length,
            1.35 if index != 5 else 1.7,
            material,
        )
        if index in (2, 5, 7):
            b.ellipsoid(
                f"Crown.{index}",
                (x * 0.65, -3, 56 + length * 0.65),
                (1.4, 1.4, 1.4),
                "winter_blue",
            )

    # Long uneven arms wield pieces of the hall instead of conventional weapons.
    b.line("Arm.L", (-14, 0, 42), (-25, -5, 31), 4.6, "ice_black", 3.4)
    b.ellipsoid("Arm.L", (-16, 0, 42), (5, 5, 5), "ice_old")
    b.line("Forearm.L", (-25, -5, 31), (-33, -11, 18), 3.5, "timber_black", 2.4)
    b.box("Hand.L", (-34, -13, 17), (9, 6, 5), "roof_iron")
    b.line("Hand.L", (-38, -11, 20), (-29, -17, 12), 1.2, "timber_black")
    for spread in (-3, 0, 3):
        b.cone(
            "Hand.L",
            (-36 + spread, -15, 16),
            (-40 + spread * 0.4, -22, 8 + spread),
            1.0,
            "ice_pale",
        )

    b.line("Arm.R", (14, 1, 41), (26, -2, 31), 4.2, "ice_old", 3.1)
    b.line("Forearm.R", (26, -2, 31), (34, -7, 19), 3.2, "ice_clear", 2.2)
    b.ring_xz("Hand.R", (35, -11, 18), 5.0, 5.8, 0.9, "roof_iron")
    b.line("Hand.R", (35, -10, 23), (35, -16, 13), 1.2, "timber")
    b.ellipsoid("Hand.R", (35, -14, 16), (2.2, 1.5, 2.8), "winter_blue")
    for spread in (-3, 0, 3):
        b.cone(
            "Hand.R",
            (35 + spread, -12, 17),
            (41 + spread * 0.35, -18, 9 + spread),
            0.85,
            "ice_old",
        )

    b.line("Roofbeam.L", (-12, 6, 48), (-29, 14, 57), 2.1, "timber_black", 1.5)
    b.line("Roofbeam.L", (-16, 5, 43), (-31, 19, 34), 1.6, "roof_iron", 1.0)
    b.line("Roofbeam.R", (12, 6, 47), (31, 13, 54), 2.2, "timber", 1.4)
    b.line("Roofbeam.R", (15, 6, 41), (29, 20, 31), 1.5, "roof_iron", 0.9)

    for side, upper, shin, foot in (
        (-1, "Leg.L", "Shin.L", "Foot.L"),
        (1, "Leg.R", "Shin.R", "Foot.R"),
    ):
        b.line(upper, (side * 9, 5, 24), (side * 12, 5, 11), 5.0, "ice_black", 3.8)
        b.ellipsoid(upper, (side * 10, 4, 23), (5.5, 6, 7), "ice_old")
        b.line(shin, (side * 12, 5, 11), (side * 14, 0, 3), 3.7, "timber_black", 3.0)
        b.box(foot, (side * 14, -4, 2), (12, 15, 4), "ice_black")
        b.box(foot, (side * 14, -8, 3), (10, 8, 2), "snow")
        for toe in (-3, 0, 3):
            b.cone(
                foot,
                (side * 14 + toe, -10, 2),
                (side * 14 + toe, -16, 0),
                1.1,
                "ice_clear",
            )

    for bone, side in (("Rain.L", -1), ("Rain.R", 1)):
        for index in range(5):
            x = side * (3 + index * 2)
            b.line(
                bone,
                (x, -16, 43 - index * 2),
                (x + side, -17, 28 - index * 3),
                0.45,
                "rain_blue",
            )


def build_first_choir(b: VoxelBuilder) -> None:
    b.bone("Body", (0, 0, 10))
    b.bone("Emitter", (0, -1, 14), "Body")
    crone = add_humanoid(
        b,
        "Singer.A",
        (-10, 2, 0),
        0.92,
        "cloth_umber",
        "bronze_dark",
        "bone",
        "Body",
        crooked=-0.8,
    )
    mason = add_humanoid(
        b,
        "Singer.B",
        (10, 2, 0),
        1.05,
        "stone",
        "cloth_brown",
        "bone_dark",
        "Body",
        crooked=0.3,
    )
    youth = add_humanoid(
        b,
        "Singer.C",
        (0, -10, 0),
        0.84,
        "cloth_gray",
        "echo_cyan",
        "bone",
        "Body",
        crooked=0.2,
    )
    b.cone(crone["head"], (-10, 2, 17), (-10, 3, 23), 2.8, "cloth_umber")
    b.box(crone["body"], (-10, -0.6, 12), (6, 1.2, 3), "bronze")
    b.box(mason["body"], (10, 1, 15), (9, 4, 3), "stone_light")
    b.line(mason["arm_r"], (14, 1, 11), (17, -2, 5), 1.1, "timber", 0.8)
    b.box(mason["arm_r"], (17, -2, 4), (5, 3, 3), "stone")
    b.box(youth["body"], (0, -12.2, 12), (6, 1, 2), "echo_cyan")
    b.cone(youth["head"], (0, -10, 17), (2, -9, 22), 1.2, "cloth_gray")

    for parts, eye, accent in (
        (crone, "echo_magenta", "bronze"),
        (mason, "echo_cyan", "stone_light"),
        (youth, "echo_violet", "echo_cyan"),
    ):
        head_cells = [
            cell for cell, (_, bone) in b.cells.items() if bone == parts["head"]
        ]
        if head_cells:
            cx = sum(p[0] for p in head_cells) / len(head_cells)
            cy = min(p[1] for p in head_cells)
            cz = sum(p[2] for p in head_cells) / len(head_cells)
            add_eye_pair(b, parts["head"], (cx, cy, cz + 0.5), 0.8, eye, -0.8)
        b.box(
            parts["body"],
            (b.bones[parts["body"]].pivot[0], -0.5, 10),
            (1.4, 1.0, 7),
            accent,
        )

    add_bell(b, "Emitter", (0, 0, 15), 1.35, "bronze_dark", "echo_cyan")
    b.ring_xz("Emitter", (0, 3, 15), 7, 7, 0.7, "echo_cyan")
    b.ring_xz("Emitter", (0, 5, 15), 11, 11, 0.55, "echo_violet")
    for p in ((-10, 2, 20), (10, 2, 21), (0, -10, 18)):
        b.line("Emitter", p, (0, 0, 15), 0.45, "echo_cyan")


def build_bellbound_river_dragon(b: VoxelBuilder) -> None:
    """Build Thaedryn as a beautiful, raid-scale river dragon under four bells."""

    b.bone("Body", (0, 10, 28))
    b.bone("Chest", (0, -8, 31), "Body")
    b.bone("Neck.1", (0, -18, 34), "Chest")
    b.bone("Neck.2", (0, -31, 35), "Neck.1")
    b.bone("Neck.3", (0, -43, 33), "Neck.2")
    b.bone("Head", (0, -52, 31), "Neck.3")
    b.bone("Jaw", (0, -63, 25), "Head")
    b.bone("Tongue", (0, -61, 24), "Jaw")
    b.bone("Emitter", (0, -56, 27), "Head")
    b.bone("VoiceRing", (0, -60, 27), "Head")
    b.bone("RiverJet", (0, -66, 27), "Head")
    b.bone("Crown", (0, -48, 38), "Head")
    b.bone("Horn.L", (-6, -48, 37), "Crown")
    b.bone("Horn.R", (6, -48, 37), "Crown")
    b.bone("Wing.L", (-14, 10, 40), "Body")
    b.bone("WingMid.L", (-35, 27, 48), "Wing.L")
    b.bone("WingTip.L", (-29, 58, 30), "WingMid.L")
    b.bone("Wing.R", (14, 10, 40), "Body")
    b.bone("WingMid.R", (35, 27, 48), "Wing.R")
    b.bone("WingTip.R", (29, 58, 30), "WingMid.R")
    b.bone("Tail.1", (0, 35, 24), "Body")
    b.bone("Tail.2", (14, 57, 18), "Tail.1")
    b.bone("Tail.3", (28, 78, 13), "Tail.2")
    b.bone("Tail.4", (18, 98, 9), "Tail.3")
    b.bone("Tail.5", (-7, 118, 5), "Tail.4")
    b.bone("Tail.6", (-10, 139, 4), "Tail.5")
    b.bone("Chain.1", (-13, -7, 30), "Body")
    b.bone("Chain.2", (13, -4, 30), "Body")
    b.bone("Chain.3", (-15, 19, 27), "Body")
    b.bone("Chain.4", (15, 23, 27), "Body")
    b.bone("Bell.1", (-18, -4, 4), "Chain.1")
    b.bone("Bell.2", (18, -1, 4), "Chain.2")
    b.bone("Bell.3", (-21, 23, 4), "Chain.3")
    b.bone("Bell.4", (21, 27, 4), "Chain.4")

    leg_specs = {
        "FL": ((-13, -13, 25), (-20, -20, 15), (-23, -27, 4)),
        "FR": ((13, -13, 25), (20, -20, 15), (23, -27, 4)),
        "BL": ((-15, 26, 22), (-24, 34, 12), (-28, 42, 4)),
        "BR": ((15, 26, 22), (24, 34, 12), (28, 42, 4)),
    }
    for suffix, (hip, knee, foot) in leg_specs.items():
        upper = f"Leg.{suffix}"
        shin = f"Shin.{suffix}"
        claw = f"Claw.{suffix}"
        b.bone(upper, hip, "Body")
        b.bone(shin, knee, upper)
        b.bone(claw, foot, shin)

    # Long river body, broad chest, and pale stone patches establish her beauty.
    b.ellipsoid("Body", (0, 13, 27), (18, 31, 14), "dragon_bronze_dark")
    b.ellipsoid("Body", (0, 7, 30), (15, 27, 12), "dragon_bronze")
    b.ellipsoid("Chest", (0, -8, 31), (16, 19, 13), "dragon_bronze")
    b.ellipsoid("Chest", (0, -13, 31), (12, 15, 11), "river_scale")
    b.triangle(
        "Chest", (-13, -21, 26), (13, -21, 26), (0, 4, 43), 1.8, "river_scale_pale"
    )
    for y, z, width in (
        (-14, 23, 10),
        (-8, 21, 12),
        (-2, 20, 14),
        (5, 19, 15),
        (13, 18, 15),
        (21, 17, 14),
        (29, 16, 12),
    ):
        b.box("Body", (0, y, z), (width, 3, 2.5), "river_scale_pale")
    for y, z, width in (
        (-2, 42, 11),
        (6, 44, 12),
        (15, 45, 12),
        (24, 44, 11),
        (32, 42, 10),
    ):
        b.triangle(
            "Body",
            (-width, y, z - 1),
            (width, y, z - 1),
            (0, y + 4, z + 6),
            1.1,
            "dragon_bronze_light",
        )
    # Old binding scars and one broad pale patch keep the body historical.
    b.line("Chest", (-12, -15, 35), (-5, 2, 25), 0.9, "voice_amber")
    b.line("Chest", (-10, -13, 33), (-3, 0, 39), 0.55, "binding_iron")
    b.ellipsoid("Body", (11, 18, 33), (5, 10, 7), "river_scale_pale")

    # Three neck segments keep sleeping, half-waking, and fully raised poses readable.
    b.line("Neck.1", (0, -12, 34), (0, -25, 36), 9.0, "dragon_bronze", 7.5)
    b.line("Neck.2", (0, -24, 36), (0, -38, 35), 7.5, "river_scale", 6.0)
    b.line("Neck.3", (0, -37, 35), (0, -50, 32), 6.0, "dragon_bronze_dark", 5.0)
    for bone, y, z, width in (
        ("Neck.1", -18, 43, 7),
        ("Neck.1", -24, 44, 6),
        ("Neck.2", -31, 43, 5),
        ("Neck.2", -37, 41, 4),
        ("Neck.3", -44, 39, 3),
    ):
        b.triangle(
            bone,
            (-width, y, z),
            (width, y, z),
            (0, y + 2, z + 6),
            1.0,
            "river_scale_pale",
        )
    for y, z in ((-17, 28), (-23, 27), (-30, 26), (-37, 25), (-44, 24)):
        b.box(
            "Neck.2" if y < -25 else "Neck.1",
            (0, y, z),
            (9, 3, 2),
            "dragon_bronze_light",
        )

    # A long, intelligent river-dragon face rather than a blunt monster muzzle.
    b.ellipsoid("Head", (0, -52, 32), (10, 11, 8), "dragon_bronze")
    b.triangle(
        "Head", (-9, -53, 37), (9, -53, 37), (0, -45, 45), 1.4, "river_scale_pale"
    )
    b.line("Head", (0, -54, 33), (0, -62, 29), 6.0, "dragon_bronze_light", 4.5)
    b.box("Head", (0, -62, 28), (12, 8, 5), "river_scale")
    b.box("Head", (0, -66, 29), (9, 3, 3), "dragon_bronze_dark")
    for side in (-1, 1):
        b.line(
            "Head", (side * 7, -53, 35), (side * 3, -60, 33), 1.0, "river_scale_pale"
        )
        b.ellipsoid("Head", (side * 4.0, -61, 34), (1.0, 0.8, 1.2), "voice_amber")
        b.box("Head", (side * 4.0, -62, 36), (4.5, 1.2, 1.0), "binding_iron")
        b.ellipsoid("Head", (side * 2.5, -68, 30), (0.9, 0.8, 0.8), "river_voice")
    b.box("Jaw", (0, -65, 24), (12, 7, 3), "dragon_bronze_dark")
    b.line("Jaw", (-5, -66, 25), (5, -66, 25), 0.8, "voice_amber")
    for x in (-5, -3, -1, 1, 3, 5):
        b.cone("Jaw", (x, -67, 26), (x, -70, 23), 0.65, "bone")
    b.line("Tongue", (0, -63, 24), (0, -71, 22), 1.1, "scar_pale", 0.7)
    b.line("Tongue", (0, -69, 22), (-2, -74, 21), 0.65, "scar_red")
    b.line("Tongue", (0, -69, 22), (2, -74, 21), 0.65, "scar_red")
    b.ellipsoid("Emitter", (0, -60, 27), (3.8, 2.0, 3.8), "voice_amber")
    b.ring_xz("VoiceRing", (0, -62, 27), 5.0, 5.0, 0.65, "river_voice")
    b.line("RiverJet", (0, -66, 27), (0, -73, 27), 2.8, "river_voice", 1.2)
    b.line("RiverJet", (0, -66, 27), (0, -72, 27), 1.2, "voice_amber", 0.5)
    b.ring_xz("RiverJet", (0, -72, 27), 3.4, 3.4, 0.55, "river_voice")

    for side, bone in ((-1, "Horn.L"), (1, "Horn.R")):
        b.line(
            bone,
            (side * 5, -48, 39),
            (side * 10, -43, 48),
            1.6,
            "river_scale_pale",
            1.1,
        )
        b.cone(
            bone, (side * 10, -43, 48), (side * 15, -34, 53), 1.1, "dragon_bronze_light"
        )
        b.line(bone, (side * 6, -47, 39), (side * 3, -40, 48), 1.0, "bell_gold", 0.65)
    # The right horn carries a centuries-old chip repaired in binding bronze.
    b.box("Horn.R", (14, -35, 52), (3, 3, 3), "binding_iron")

    # Folded cathedral wings make a roofline over the sleeping body.
    for side, root, mid, tip in (
        (-1, "Wing.L", "WingMid.L", "WingTip.L"),
        (1, "Wing.R", "WingMid.R", "WingTip.R"),
    ):
        b.line(root, (side * 13, 4, 40), (side * 37, 25, 51), 3.0, "river_scale", 2.2)
        b.triangle(
            root,
            (side * 12, 5, 40),
            (side * 38, 26, 51),
            (side * 20, 32, 25),
            1.3,
            "wing_vellum",
        )
        b.line(
            mid,
            (side * 37, 25, 51),
            (side * 31, 60, 30),
            2.3,
            "dragon_bronze_dark",
            1.5,
        )
        b.triangle(
            mid,
            (side * 37, 25, 51),
            (side * 31, 60, 30),
            (side * 18, 35, 24),
            1.15,
            "wing_vellum",
        )
        b.line(
            tip, (side * 31, 58, 30), (side * 20, 69, 19), 1.5, "river_scale_pale", 0.9
        )
        for offset in (0, 7, 14):
            b.line(
                mid,
                (side * (34 - offset * 0.35), 28 + offset, 47 - offset * 0.4),
                (side * (20 + offset * 0.1), 38 + offset, 25 - offset * 0.2),
                0.65,
                "bell_gold" if offset == 7 else "dragon_bronze_light",
            )

    # Powerful feet remain elegant through layered scales and long bronze claws.
    for suffix, (hip, knee, foot) in leg_specs.items():
        upper = f"Leg.{suffix}"
        shin = f"Shin.{suffix}"
        claw = f"Claw.{suffix}"
        side = -1 if suffix.endswith("L") else 1
        b.line(upper, hip, knee, 5.0, "dragon_bronze_dark", 3.8)
        b.ellipsoid(upper, hip, (6, 7, 6), "dragon_bronze")
        b.ellipsoid(upper, knee, (4.5, 4.5, 4.5), "river_scale")
        b.line(shin, knee, foot, 3.6, "river_scale_pale", 2.6)
        b.box(shin, (foot[0], foot[1], foot[2] + 3), (7, 8, 5), "dragon_bronze_dark")
        for spread in (-3, 0, 3):
            b.cone(
                claw,
                (foot[0] + spread, foot[1] - 2, foot[2] + 1),
                (foot[0] + spread * 1.25 + side, foot[1] - 11, 0),
                1.0,
                "bell_gold",
            )

    # Coiled river tail fills the chamber and gives every turn secondary motion.
    b.line("Tail.1", (0, 34, 25), (14, 58, 18), 7.0, "dragon_bronze_dark", 5.8)
    b.line("Tail.2", (13, 57, 18), (29, 79, 13), 5.8, "dragon_bronze", 4.4)
    b.line("Tail.3", (28, 78, 13), (18, 99, 9), 4.4, "river_scale", 3.2)
    b.line("Tail.4", (18, 98, 9), (-5, 110, 6), 3.2, "dragon_bronze_light", 2.1)
    b.line("Tail.5", (-5, 109, 6), (-14, 132, 4), 2.1, "river_scale_pale", 1.45)
    b.line("Tail.6", (-14, 131, 4), (-4, 151, 3), 1.45, "dragon_bronze_light", 0.9)
    b.triangle(
        "Tail.6", (-4, 149, 3), (-16, 158, 11), (-13, 156, 0), 1.1, "wing_vellum"
    )
    b.triangle("Tail.6", (-4, 149, 3), (8, 157, 9), (6, 156, 0), 1.1, "river_voice")
    for bone, y, z, side in (
        ("Tail.1", 45, 27, 1),
        ("Tail.2", 67, 22, 1),
        ("Tail.3", 86, 17, -1),
        ("Tail.4", 103, 13, -1),
    ):
        b.cone(
            bone, (side * 8, y, z), (side * 12, y + 2, z + 7), 1.1, "river_scale_pale"
        )

    # Four independent chain-and-bell bones support visible phase progression.
    chain_specs = (
        ("Chain.1", "Bell.1", (-13, -7, 31), (-18, -4, 5)),
        ("Chain.2", "Bell.2", (13, -4, 31), (18, -1, 5)),
        ("Chain.3", "Bell.3", (-15, 19, 28), (-21, 23, 5)),
        ("Chain.4", "Bell.4", (15, 23, 28), (21, 27, 5)),
    )
    for index, (chain, bell, start, end) in enumerate(chain_specs):
        segments = 9
        for segment in range(segments):
            t = segment / (segments - 1)
            center = tuple(start[i] + (end[i] - start[i]) * t for i in range(3))
            b.ring_xz(chain, center, 1.5, 2.0, 0.45, "binding_iron")
        add_bell(b, bell, end, 1.35, "bell_gold", "voice_amber")
        b.line(chain, start, (start[0], start[1], start[2] + 5), 1.0, "voice_amber")


def build_hex_wraith(b: VoxelBuilder) -> None:
    b.bone("Body", (0, 0, 13))
    b.bone("Head", (0, -1, 25), "Body")
    b.bone("Arm.L", (-6, 0, 18), "Body")
    b.bone("Arm.R", (6, 0, 18), "Body")
    b.bone("Emitter", (0, -5, 16), "Body")
    b.bone("Crown", (0, 0, 27), "Head")
    b.bone("Aux.L", (-10, 0, 16), "Body")
    b.bone("Aux.R", (10, 0, 16), "Body")

    for z, rx, ry in ((5, 9, 7), (10, 8, 6), (15, 7, 5), (20, 5, 4)):
        b.ellipsoid(
            "Body",
            (0, 1, z),
            (rx, ry, 4.5),
            "wraith_dark" if z % 10 else "wraith_violet",
        )
    b.ellipsoid("Body", (0, -3, 15), (5, 2, 8), "ectoplasm")
    for z in (10, 14, 18):
        b.ring_xz(
            "Body", (0, 2, z), 5.5, 2.8, 0.55, "sigil_white", (0.1, math.pi - 0.1)
        )

    b.ellipsoid("Head", (0, 0, 25), (6, 5, 6), "wraith_dark")
    b.box("Head", (0, -4, 25), (7, 2, 5), "wraith_violet")
    b.ellipsoid("Head", (0, -5, 25), (2.6, 1.2, 3.5), "ectoplasm")
    b.box("Head", (0, -6, 25), (1, 1, 5), "sigil_white")
    b.cone("Crown", (-4, 0, 28), (-8, 1, 35), 1.3, "wraith_dark")
    b.cone("Crown", (4, 0, 28), (8, 1, 35), 1.3, "wraith_dark")

    b.line("Arm.L", (-5, 0, 20), (-13, -4, 12), 2.0, "wraith_violet", 1.0)
    b.line("Arm.R", (5, 0, 20), (13, -4, 12), 2.0, "wraith_violet", 1.0)
    b.ellipsoid("Arm.L", (-14, -5, 11), (2, 2, 2), "ectoplasm")
    b.ellipsoid("Arm.R", (14, -5, 11), (2, 2, 2), "ectoplasm")
    b.ring_xz("Emitter", (0, 1, 16), 5, 7, 0.55, "sigil_white")

    for bone, side in (("Aux.L", -1), ("Aux.R", 1)):
        for z in (10, 16, 22):
            x = side * (9 + (z % 5))
            b.box(bone, (x, -3, z), (3, 1, 5), "stone")
            b.box(bone, (x, -4, z), (1, 1, 3), "sigil_white")


def build_root_crowned_dead(b: VoxelBuilder) -> None:
    b.bone("Body", (0, 0, 22))
    b.bone("Head", (0, -2, 36), "Body")
    b.bone("Jaw", (0, -7, 33), "Head")
    b.bone("Arm.L", (-10, 0, 28), "Body")
    b.bone("Arm.R", (10, 0, 28), "Body")
    b.bone("Leg.L", (-6, 2, 14), "Body")
    b.bone("Leg.R", (6, 2, 14), "Body")
    b.bone("Crown", (0, 0, 39), "Head")
    b.bone("Emitter", (0, -6, 24), "Body")
    b.bone("Aux.L", (-7, 5, 19), "Body")
    b.bone("Aux.R", (7, 5, 19), "Body")

    b.ellipsoid("Body", (0, 1, 24), (11, 8, 15), "bark")
    b.ellipsoid("Body", (0, -1, 25), (8, 6, 12), "root_dark")
    b.ring_xz("Emitter", (0, -7, 25), 5, 6.5, 1.0, "bone")
    b.ellipsoid("Emitter", (0, -8, 25), (2.4, 1.0, 3.8), "corruption")
    for z in (21, 25, 29):
        b.line("Emitter", (-4, -8.3, z), (4, -8.3, z + 1), 0.65, "bone_dark")
    for x, z in ((-7, 18), (-6, 27), (6, 20), (7, 30), (0, 14)):
        b.ellipsoid("Body", (x, -5, z), (2, 1.5, 2.5), "moss_light")

    b.ellipsoid("Head", (0, -1, 37), (7, 6, 7), "bone_dark")
    b.box("Head", (0, -6, 36), (8, 4, 5), "bark")
    add_eye_pair(b, "Head", (0, -4, 38), 2.7, "corruption", -2.4)
    b.box("Jaw", (0, -8, 33), (8, 4, 2), "bone")

    b.line("Arm.L", (-9, 0, 30), (-21, -3, 16), 3.8, "bark", 2.0)
    b.line("Arm.R", (9, 0, 30), (21, -3, 16), 3.8, "bark_light", 2.0)
    for side, name in ((-1, "Arm.L"), (1, "Arm.R")):
        hand = (side * 22, -4, 15)
        for spread in (-3, 0, 3):
            b.cone(
                name,
                hand,
                (side * (28 + abs(spread)), -8 + abs(spread), 11 + spread),
                1.4,
                "root_dark",
            )
    for name, side in (("Leg.L", -1), ("Leg.R", 1)):
        b.line(name, (side * 6, 2, 16), (side * 9, 5, 2), 4.0, "bark", 2.7)
        b.line(name, (side * 9, 5, 2), (side * 16, -2, 0), 2.2, "root_dark", 0.8)
        b.line(name, (side * 9, 5, 2), (side * 5, 13, 0), 2.2, "root_dark", 0.8)

    # The crown is a literal root throne grown through the old skull.
    for side in (-1, 1):
        b.line("Crown", (side * 2, 0, 40), (side * 10, 1, 49), 2.0, "root_dark", 1.2)
        b.line("Crown", (side * 8, 1, 47), (side * 15, -1, 51), 1.2, "bark")
        b.line("Crown", (side * 7, 1, 46), (side * 9, 5, 54), 1.2, "bark")
    b.cone("Crown", (0, 0, 40), (0, 3, 55), 2.0, "root_dark")
    b.box("Crown", (0, 2, 46), (16, 3, 3), "moss")

    for bone, side in (("Aux.L", -1), ("Aux.R", 1)):
        for i in range(3):
            start = (side * (4 + i * 2), 4 + i * 3, 18 + i * 3)
            end = (side * (10 + i * 4), 11 + i * 3, 2)
            b.line(bone, start, end, 1.2, "root_dark", 0.6)


BOSSES: Sequence[BossDefinition] = (
    BossDefinition(
        "muck_scarred_helix",
        "Muck-Scarred Helix",
        (6.8, 4.8, 8.4),
        "breach_helix",
        "HelixPulse",
        24,
        (
            "BreachStalk",
            "MaulCrush",
            "SiphonVolley",
            "HelixPulse",
            "SporeCast",
            "Burrow",
            "Rupture",
            "BreachCollapse",
        ),
        build_breach_helix_aberration,
    ),
    BossDefinition(
        "gilded_bull",
        "The Gilded Bull",
        (3.9, 2.7, 5.6),
        "gilded_bull",
        "PatrolScan",
        32,
        (
            "PatrolScan",
            "Charge",
            "PillarCrash",
            "HornBreak",
            "SunCoreBeam",
            "HoofQuake",
            "Unbalanced",
            "CoreRupture",
        ),
        build_sun_court_guardian,
    ),
    BossDefinition(
        "ninth_winter",
        "The Ninth Winter",
        (14.0, 13.0, 8.0),
        "failed_year",
        "Idle",
        24,
        (
            "HearthFails",
            "Blizzard",
            "TimeLoop",
            "RoofbeamSweep",
            "YearBreaks",
            "Shatter",
            "Rainfall",
            "MeltDeath",
        ),
        build_failed_year_colossus,
    ),
    BossDefinition(
        "first_choir",
        "The First Choir",
        (4.2, 2.7, 4.2),
        "choir",
        "Idle",
        24,
        ("Chant", "HarmonyBreak"),
        build_first_choir,
    ),
    BossDefinition(
        "thaedryn_bellbound",
        "Thaedryn the Bellbound",
        (20.0, 14.0, 58.0),
        "thaedryn",
        "Idle",
        30,
        (
            "SleeperSweep",
            "SoundCloud",
            "RiverBreath",
            "ChainBreak",
            "HalfWake",
            "WingGust",
            "VeinSummon",
            "BellboundRise",
            "Greeting",
            "Rebind",
            "Slay",
            "Wake",
        ),
        build_bellbound_river_dragon,
    ),
    BossDefinition(
        "hex_wraith",
        "Hex Wraith",
        (2.5, 3.8, 2.5),
        "wraith",
        "Idle",
        24,
        ("Teleport", "HexVolley"),
        build_hex_wraith,
    ),
    BossDefinition(
        "root_crowned_dead",
        "The Root-Crowned Dead",
        (4.5, 5.5, 4.5),
        "colossus",
        "Idle",
        24,
        ("RootEruption", "SpawnRootlings"),
        build_root_crowned_dead,
    ),
)


@dataclass(frozen=True)
class Normalizer:
    min_corner: Vec3
    max_corner: Vec3
    preserve_aspect: bool = False

    def point(self, p: Vec3) -> Vec3:
        extents = tuple(
            max(1e-6, self.max_corner[i] - self.min_corner[i]) for i in range(3)
        )
        centers = tuple(
            (self.min_corner[i] + self.max_corner[i]) * 0.5 for i in range(3)
        )
        if self.preserve_aspect:
            scale = BASE_BOX[2] / extents[2]
            return (
                (p[0] - centers[0]) * scale,
                (p[1] - centers[1]) * scale,
                (p[2] - self.min_corner[2]) * scale,
            )
        return (
            (p[0] - centers[0]) * BASE_BOX[0] / extents[0],
            (p[1] - centers[1]) * BASE_BOX[1] / extents[1],
            (p[2] - self.min_corner[2]) * BASE_BOX[2] / extents[2],
        )


def builder_bounds(builder: VoxelBuilder) -> Tuple[Vec3, Vec3]:
    if not builder.cells:
        raise ValueError(f"{builder.slug} produced no voxels")
    mins = [min(cell[i] for cell in builder.cells) - 0.5 for i in range(3)]
    maxs = [max(cell[i] for cell in builder.cells) + 0.5 for i in range(3)]
    return tuple(mins), tuple(maxs)


def material_order(builder: VoxelBuilder) -> List[str]:
    return list(dict.fromkeys(material for material, _ in builder.cells.values()))


def apply_baked_voxel_shading(builder: VoxelBuilder) -> None:
    """Paint broad value structure into the voxels before dynamic lighting.

    Top/exposed masses receive warm highlights, undersides receive cool shadows,
    and a sparse deterministic wear pass breaks large flat faces. Emissive focal
    materials stay stable so gameplay telegraphs retain their authored color.
    """
    min_corner, max_corner = builder_bounds(builder)
    height = max(1.0, max_corner[2] - min_corner[2])
    occupied = set(builder.cells)
    shaded: Dict[Cell, Tuple[str, str]] = {}
    for cell, (material, bone) in builder.cells.items():
        spec = MATERIALS[material]
        if spec.emission >= 1.0 or "__" in material:
            shaded[cell] = (material, bone)
            continue
        x, y, z = cell
        height_t = (z - min_corner[2]) / height
        exposed_top = (x, y, z + 1) not in occupied
        exposed_bottom = (x, y, z - 1) not in occupied
        exposed_side = any(
            neighbor not in occupied
            for neighbor in ((x + 1, y, z), (x - 1, y, z), (x, y + 1, z), (x, y - 1, z))
        )
        deterministic = abs(x * 73856093 ^ y * 19349663 ^ z * 83492791)
        if exposed_top and height_t > 0.33:
            next_material = f"{material}__highlight"
        elif exposed_bottom or height_t < 0.2:
            next_material = f"{material}__shadow"
        elif exposed_side and deterministic % 29 == 0:
            next_material = (
                f"{material}__highlight"
                if deterministic % 2 == 0
                else f"{material}__shadow"
            )
        else:
            next_material = material
        shaded[cell] = (next_material, bone)
    builder.cells = shaded


def chunk(name: bytes, content: bytes, children: bytes = b"") -> bytes:
    return name + struct.pack("<II", len(content), len(children)) + content + children


def write_vox(builder: VoxelBuilder, output: Path) -> None:
    mins = [min(cell[i] for cell in builder.cells) for i in range(3)]
    maxs = [max(cell[i] for cell in builder.cells) for i in range(3)]
    dimensions = [maxs[i] - mins[i] + 1 for i in range(3)]
    if any(value > 255 for value in dimensions):
        raise ValueError(
            f"{builder.slug} exceeds MagicaVoxel 255-cell dimension: {dimensions}"
        )
    materials = material_order(builder)
    if len(materials) > 255:
        raise ValueError(f"{builder.slug} uses too many palette entries")
    color_index = {name: index + 1 for index, name in enumerate(materials)}
    voxels = bytearray(struct.pack("<I", len(builder.cells)))
    for (x, y, z), (material, _) in sorted(builder.cells.items()):
        voxels.extend(
            struct.pack(
                "BBBB",
                x - mins[0],
                y - mins[1],
                z - mins[2],
                color_index[material],
            )
        )
    rgba = bytearray()
    for index in range(256):
        if index < len(materials):
            rgba.extend(struct.pack("BBBB", *MATERIALS[materials[index]].rgba))
        else:
            rgba.extend(struct.pack("BBBB", 0, 0, 0, 255))
    children = b"".join(
        (
            chunk(b"SIZE", struct.pack("<III", *dimensions)),
            chunk(b"XYZI", bytes(voxels)),
            chunk(b"RGBA", bytes(rgba)),
        )
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(b"VOX " + struct.pack("<I", 150) + chunk(b"MAIN", b"", children))


FACE_DEFS = (
    (
        (1, 0, 0),
        ((0.5, -0.5, -0.5), (0.5, 0.5, -0.5), (0.5, 0.5, 0.5), (0.5, -0.5, 0.5)),
    ),
    (
        (-1, 0, 0),
        ((-0.5, 0.5, -0.5), (-0.5, -0.5, -0.5), (-0.5, -0.5, 0.5), (-0.5, 0.5, 0.5)),
    ),
    (
        (0, 1, 0),
        ((-0.5, 0.5, -0.5), (0.5, 0.5, -0.5), (0.5, 0.5, 0.5), (-0.5, 0.5, 0.5)),
    ),
    (
        (0, -1, 0),
        ((0.5, -0.5, -0.5), (-0.5, -0.5, -0.5), (-0.5, -0.5, 0.5), (0.5, -0.5, 0.5)),
    ),
    (
        (0, 0, 1),
        ((-0.5, -0.5, 0.5), (0.5, -0.5, 0.5), (0.5, 0.5, 0.5), (-0.5, 0.5, 0.5)),
    ),
    (
        (0, 0, -1),
        ((-0.5, 0.5, -0.5), (0.5, 0.5, -0.5), (0.5, -0.5, -0.5), (-0.5, -0.5, -0.5)),
    ),
)


def make_blender_material(slug: str, name: str) -> bpy.types.Material:
    spec = MATERIALS[name]
    material = bpy.data.materials.new(f"{slug}.{name}")
    material.diffuse_color = tuple(channel / 255 for channel in spec.rgba)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled:
        base = tuple(channel / 255 for channel in spec.rgba[:3]) + (1.0,)
        if principled.inputs.get("Base Color"):
            principled.inputs["Base Color"].default_value = base
        if principled.inputs.get("Metallic"):
            principled.inputs["Metallic"].default_value = spec.metallic
        if principled.inputs.get("Roughness"):
            principled.inputs["Roughness"].default_value = spec.roughness
        if principled.inputs.get("Emission Color"):
            principled.inputs["Emission Color"].default_value = base
        elif principled.inputs.get("Emission"):
            principled.inputs["Emission"].default_value = base
        if principled.inputs.get("Emission Strength"):
            principled.inputs["Emission Strength"].default_value = spec.emission
    return material


def create_mesh(
    definition: BossDefinition,
    builder: VoxelBuilder,
    normalizer: Normalizer,
) -> Tuple[bpy.types.Object, Dict[str, List[int]]]:
    materials = material_order(builder)
    material_indices = {name: index for index, name in enumerate(materials)}
    vertices: List[Vec3] = []
    faces: List[Tuple[int, int, int, int]] = []
    face_materials: List[int] = []
    bone_vertices: Dict[str, List[int]] = {}
    cells_by_bone: Dict[str, Dict[Cell, str]] = {}
    for cell, (material, bone) in builder.cells.items():
        cells_by_bone.setdefault(bone, {})[cell] = material

    for bone, cells in cells_by_bone.items():
        weighted = bone_vertices.setdefault(bone, [])
        occupied = set(cells)
        for (x, y, z), material in sorted(cells.items()):
            for (dx, dy, dz), offsets in FACE_DEFS:
                if (x + dx, y + dy, z + dz) in occupied:
                    continue
                start = len(vertices)
                for ox, oy, oz in offsets:
                    vertices.append(normalizer.point((x + ox, y + oy, z + oz)))
                indices = (start, start + 1, start + 2, start + 3)
                faces.append(indices)
                weighted.extend(indices)
                face_materials.append(material_indices[material])

    mesh = bpy.data.meshes.new(f"{definition.slug}.mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(definition.slug, mesh)
    bpy.context.collection.objects.link(obj)
    for material in materials:
        mesh.materials.append(make_blender_material(definition.slug, material))
    for polygon, index in zip(mesh.polygons, face_materials):
        polygon.material_index = index
        polygon.use_smooth = False
    obj["bossId"] = definition.slug
    obj["displayName"] = definition.name
    obj["worldSize"] = list(definition.world_size)
    obj["voxelCount"] = len(builder.cells)
    return obj, bone_vertices


def ensure_bone_definitions(builder: VoxelBuilder) -> None:
    points_by_bone: Dict[str, List[Cell]] = {}
    for point, (_, bone) in builder.cells.items():
        points_by_bone.setdefault(bone, []).append(point)
    for bone, points in points_by_bone.items():
        if bone not in builder.bones:
            pivot = tuple(
                sum(point[i] for point in points) / len(points) for i in range(3)
            )
            builder.bone(bone, pivot)


def create_armature(
    definition: BossDefinition,
    builder: VoxelBuilder,
    normalizer: Normalizer,
) -> bpy.types.Object:
    ensure_bone_definitions(builder)
    armature = bpy.data.armatures.new(f"{definition.slug}.rig")
    armature.display_type = "BBONE"
    obj = bpy.data.objects.new(f"{definition.slug}.Armature", armature)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones: Dict[str, bpy.types.EditBone] = {}
    for name, spec in builder.bones.items():
        bone = armature.edit_bones.new(name)
        pivot = normalizer.point(spec.pivot)
        bone.head = pivot
        bone.tail = (pivot[0], pivot[1], pivot[2] + 0.075)
        bone.use_deform = name != "Root" or any(
            part == name for _, part in builder.cells.values()
        )
        edit_bones[name] = bone
    for name, spec in builder.bones.items():
        if spec.parent and spec.parent in edit_bones:
            edit_bones[name].parent = edit_bones[spec.parent]
            edit_bones[name].use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    obj["bossId"] = definition.slug
    obj["displayName"] = definition.name
    obj["requiredClips"] = json.dumps(REQUIRED_CLIPS)
    obj["specialClips"] = json.dumps(list(definition.special_clips))
    return obj


def bind_mesh(
    mesh_obj: bpy.types.Object,
    armature_obj: bpy.types.Object,
    bone_vertices: Mapping[str, Sequence[int]],
) -> None:
    for bone, indices in bone_vertices.items():
        group = mesh_obj.vertex_groups.new(name=bone)
        group.add(list(indices), 1.0, "REPLACE")
    modifier = mesh_obj.modifiers.new("Boss Armature", "ARMATURE")
    modifier.object = armature_obj
    modifier.use_deform_preserve_volume = False
    mesh_obj.parent = armature_obj
    mesh_obj.matrix_parent_inverse = armature_obj.matrix_world.inverted()


def bones_matching(armature_obj: bpy.types.Object, token: str) -> List[str]:
    return [bone.name for bone in armature_obj.pose.bones if token in bone.name]


def first_bone(armature_obj: bpy.types.Object, names: Sequence[str]) -> Optional[str]:
    available = armature_obj.pose.bones
    for name in names:
        if name in available:
            return name
    return None


Transform = Dict[str, Tuple[float, float, float]]
FramePose = Dict[str, Dict[str, Vec3]]


def pose_entry(
    frames: Dict[int, FramePose],
    frame: int,
    bone: Optional[str],
    *,
    location: Optional[Vec3] = None,
    rotation: Optional[Vec3] = None,
    scale: Optional[Vec3] = None,
) -> None:
    if not bone:
        return
    entry = frames.setdefault(frame, {}).setdefault(bone, {})
    if location is not None:
        entry["location"] = location
    if rotation is not None:
        entry["rotation"] = rotation
    if scale is not None:
        entry["scale"] = scale


def boss_stagger_animation_pose(
    definition: BossDefinition,
    armature_obj: bpy.types.Object,
    name: str,
) -> Tuple[int, Dict[int, FramePose]]:
    """Create a bespoke-rig whole-body stagger for every live boss.

    Bosses intentionally do not execute these clips yet.  They are authored and
    packaged now so later hyper-armor/poise work can select a real loss-of-
    balance animation instead of stretching generic HitReact or Stunned clips.
    """

    severity = name.removeprefix("BossStagger").lower()
    specs = {
        "light": {
            "end": 14,
            "amplitude": 11.0,
            "samples": ((1, 0.0, 0.0), (4, 1.0, -0.025), (8, -0.28, -0.010), (14, 0.0, 0.0)),
        },
        "medium": {
            "end": 30,
            "amplitude": 23.0,
            "samples": ((1, 0.0, 0.0), (6, 0.48, -0.035), (11, 1.0, -0.090),
                        (18, 0.72, -0.125), (24, -0.22, -0.040), (30, 0.0, 0.0)),
        },
        "heavy": {
            "end": 58,
            "amplitude": 39.0,
            "samples": ((1, 0.0, 0.0), (7, 0.42, -0.050), (13, 1.0, -0.145),
                        (25, 0.86, -0.205), (37, -0.34, -0.125),
                        (48, 0.18, -0.045), (58, 0.0, 0.0)),
        },
    }
    spec = specs[severity]
    frames: Dict[int, FramePose] = {}
    names = [bone.name for bone in armature_obj.pose.bones]
    root = first_bone(armature_obj, ("Root",))
    seed = sum((index + 1) * ord(character) for index, character in enumerate(definition.slug))
    side = -1.0 if seed % 2 else 1.0

    def matching(*tokens: str) -> List[str]:
        return [
            bone_name
            for bone_name in names
            if bone_name != root and any(token.lower() in bone_name.lower() for token in tokens)
        ]

    bodies = matching("body", "chest", "torso", "mantle")
    heads = matching("head", "jaw", "neck")
    arms = matching("arm", "forearm", "hand", "claw", "maul", "weapon", "fist")
    legs = matching("leg", "thigh", "knee", "hoof", "foot")
    wings = matching("wing")
    tails = matching("tail")
    secondary = matching(
        "crown",
        "bell",
        "chain",
        "emitter",
        "helix",
        "carapace",
        "spore",
        "cloak",
        "strip",
        "ring",
        "vent",
        "horn",
    )

    # Some highly abstract bosses have no literal Body bone.  The first
    # non-root structural bone still receives the primary recoil.
    if not bodies:
        bodies = [bone_name for bone_name in names if bone_name != root][:1]

    for frame, impulse, vertical in spec["samples"]:
        amplitude = spec["amplitude"]
        pitch = -amplitude * impulse
        roll = amplitude * 0.58 * side * impulse
        lateral = 0.018 * side * impulse * (1.35 if severity == "heavy" else 1.0)
        pose_entry(
            frames,
            frame,
            root,
            location=(0.0, lateral, vertical),
            rotation=(pitch * 0.18, 0.0, roll * 0.16),
        )
        for index, bone in enumerate(bodies):
            phase = 1.0 - min(index, 4) * 0.07
            pose_entry(
                frames,
                frame,
                bone,
                rotation=(pitch * phase, roll * 0.18, roll * phase),
                location=(0.0, lateral * (0.8 + index * 0.08), vertical * 0.35),
            )
        for index, bone in enumerate(heads):
            phase = 1.0 + min(index, 5) * 0.08
            pose_entry(
                frames,
                frame,
                bone,
                rotation=(-pitch * 0.72 * phase, 0.0, -roll * 0.92 * phase),
            )
        for index, bone in enumerate(arms):
            limb_side = -1.0 if (".L" in bone or "_L" in bone or index % 2 == 0) else 1.0
            pose_entry(
                frames,
                frame,
                bone,
                rotation=(pitch * (0.62 + index % 3 * 0.08), roll * 0.18,
                          limb_side * amplitude * 0.82 * impulse),
            )
        for index, bone in enumerate(legs):
            limb_side = -1.0 if (".L" in bone or "_L" in bone or index % 2 == 0) else 1.0
            buckle = abs(impulse) * amplitude * (0.68 if severity == "heavy" else 0.46)
            pose_entry(
                frames,
                frame,
                bone,
                rotation=(buckle, 0.0, limb_side * roll * 0.22),
            )
        for index, bone in enumerate(wings):
            wing_side = -1.0 if index % 2 == 0 else 1.0
            pose_entry(
                frames,
                frame,
                bone,
                rotation=(pitch * 0.18, wing_side * amplitude * 0.75 * impulse,
                          wing_side * roll * 0.48),
            )
        for index, bone in enumerate(tails):
            lag = 1.0 + index * 0.22
            pose_entry(
                frames,
                frame,
                bone,
                rotation=(-pitch * 0.12 * lag, 0.0, -roll * lag),
            )
        for index, bone in enumerate(secondary):
            lag = 0.65 + (index % 4) * 0.12
            pose_entry(
                frames,
                frame,
                bone,
                rotation=(-pitch * 0.12 * lag, roll * 0.08, -roll * lag),
                scale=(1.0 + abs(impulse) * 0.035,) * 3,
            )
    return spec["end"], frames


def breach_helix_animation_pose(
    name: str, armature_obj: bpy.types.Object
) -> Tuple[int, Dict[int, FramePose]]:
    frames: Dict[int, FramePose] = {}
    root = first_bone(armature_obj, ("Root",))
    body = first_bone(armature_obj, ("Body",))
    head = first_bone(armature_obj, ("Head",))
    jaw = first_bone(armature_obj, ("Jaw",))
    maul = first_bone(armature_obj, ("Claw.L",))
    arm_l = first_bone(armature_obj, ("Arm.L",))
    forearm_l = first_bone(armature_obj, ("Forearm.L",))
    arm_r = first_bone(armature_obj, ("Arm.R",))
    forearm_r = first_bone(armature_obj, ("Forearm.R",))
    emitter = first_bone(armature_obj, ("Emitter",))
    voice_ring = first_bone(armature_obj, ("VoiceRing",))
    helix_a = first_bone(armature_obj, ("Helix.A",))
    helix_b = first_bone(armature_obj, ("Helix.B",))
    carapaces = bones_matching(armature_obj, "Carapace.")
    spores = bones_matching(armature_obj, "Spore.")
    tails = bones_matching(armature_obj, "Tail.")
    uppers = {
        suffix: first_bone(armature_obj, (f"Leg.{suffix}",))
        for suffix in ("FL", "FR", "BL", "BR")
    }
    shins = {
        suffix: first_bone(armature_obj, (f"Shin.{suffix}",))
        for suffix in ("FL", "FR", "BL", "BR")
    }
    feet = {
        suffix: first_bone(armature_obj, (f"Foot.{suffix}",))
        for suffix in ("FL", "FR", "BL", "BR")
    }

    def leg_pose(
        frame: int, suffix: str, upper: float, shin: float, foot: float
    ) -> None:
        pose_entry(frames, frame, uppers[suffix], rotation=(upper, 0, 0))
        pose_entry(frames, frame, shins[suffix], rotation=(shin, 0, 0))
        pose_entry(frames, frame, feet[suffix], rotation=(foot, 0, 0))

    def gait(end: int, stride: float, bob: float) -> Tuple[int, Dict[int, FramePose]]:
        for index, frame in enumerate(
            (1, end // 4 + 1, end // 2 + 1, end * 3 // 4 + 1, end)
        ):
            phase = (0, 1, 0, -1, 0)[index]
            pose_entry(frames, frame, root, location=(0, 0, bob if abs(phase) else 0))
            pose_entry(frames, frame, body, rotation=(6, 0, phase * 4))
            for suffix, diagonal in (("FL", 1), ("BR", 1), ("FR", -1), ("BL", -1)):
                swing = stride * phase * diagonal
                leg_pose(frame, suffix, swing, -swing * 0.7, swing * 0.2)
            pose_entry(
                frames, frame, arm_l, rotation=(-stride * phase * 0.45, 0, -phase * 5)
            )
            pose_entry(frames, frame, forearm_l, rotation=(stride * phase * 0.28, 0, 0))
            pose_entry(
                frames, frame, arm_r, rotation=(stride * phase * 0.35, 0, phase * 5)
            )
            pose_entry(
                frames, frame, forearm_r, rotation=(-stride * phase * 0.22, 0, 0)
            )
            pose_entry(frames, frame, head, rotation=(2, phase * 4, -phase * 3))
            for tail_index, tail in enumerate(tails):
                pose_entry(
                    frames, frame, tail, rotation=(0, 0, -phase * (8 + tail_index * 6))
                )
        return end, frames

    if name == "Idle":
        for frame, pulse, yaw in (
            (1, 1.0, -5),
            (16, 1.14, 3),
            (32, 0.94, 8),
            (48, 1.0, -5),
        ):
            pose_entry(
                frames,
                frame,
                body,
                location=(0, 0, 0.025 if frame in (16, 32) else 0),
                scale=(1, 1, 1.025 if frame == 16 else 1),
            )
            pose_entry(frames, frame, head, rotation=(3, yaw, yaw * 0.35))
            pose_entry(frames, frame, jaw, rotation=(5 if frame == 32 else 0, 0, 0))
            pose_entry(
                frames, frame, helix_a, rotation=(0, yaw * 1.8, yaw), scale=(pulse,) * 3
            )
            pose_entry(
                frames,
                frame,
                helix_b,
                rotation=(0, -yaw * 1.8, -yaw),
                scale=(2 - pulse * 0.88,) * 3,
            )
            pose_entry(
                frames, frame, emitter, scale=((1.12 if frame == 16 else 1.0),) * 3
            )
            for index, spore in enumerate(spores):
                pose_entry(
                    frames,
                    frame,
                    spore,
                    rotation=(0, 0, yaw * (0.8 + index * 0.4)),
                    scale=((1.08 if frame == 32 else 1.0),) * 3,
                )
            for index, tail in enumerate(tails):
                pose_entry(
                    frames, frame, tail, rotation=(0, 0, yaw * (1 + index * 0.55))
                )
        return 48, frames
    if name == "Walk":
        return gait(28, 22, 0.025)
    if name == "Run":
        return gait(18, 38, 0.06)
    if name == "Sprint":
        return gait(14, 52, 0.095)
    if name in ("Jump", "Fly"):
        for frame, height, tuck in (
            (1, 0, 0),
            (8, -0.08, -18),
            (16, 0.42, 34),
            (25, 0.28, 24),
            (34, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, 0, height))
            pose_entry(frames, frame, body, rotation=(-tuck * 0.18, 0, 0))
            for suffix in uppers:
                leg_pose(frame, suffix, tuck, -tuck * 0.8, tuck * 0.2)
            pose_entry(frames, frame, arm_l, rotation=(tuck * 0.65, 0, -15))
            pose_entry(frames, frame, arm_r, rotation=(tuck * 0.55, 0, 15))
        return 34, frames
    if name == "Attack":
        for frame, lunge, bite in (
            (1, 0, 0),
            (8, 0.02, -14),
            (14, -0.14, 30),
            (22, -0.06, 12),
            (30, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, lunge, 0))
            pose_entry(frames, frame, head, rotation=(bite * 0.45, 0, 0))
            pose_entry(frames, frame, jaw, rotation=(bite, 0, 0))
            pose_entry(frames, frame, body, rotation=(-bite * 0.12, 0, 0))
        return 30, frames
    if name == "HeavyAttack":
        for frame, windup, slam in (
            (1, 0, 0),
            (10, -44, 0),
            (20, 76, 1),
            (29, 28, 0),
            (40, 0, 0),
        ):
            pose_entry(frames, frame, arm_l, rotation=(windup, 0, -windup * 0.45))
            pose_entry(frames, frame, forearm_l, rotation=(windup * 0.55, 0, 0))
            pose_entry(frames, frame, maul, rotation=(windup * 0.25, 0, -windup * 0.2))
            pose_entry(frames, frame, body, rotation=(-windup * 0.13, 0, windup * 0.08))
            pose_entry(
                frames,
                frame,
                root,
                location=(0, -0.12 if slam else 0, -0.07 if slam else 0),
            )
        return 40, frames
    if name == "RangedAttack":
        for frame, charge, recoil in (
            (1, 1, 0),
            (12, 1.35, -8),
            (23, 2.0, -16),
            (28, 0.7, 18),
            (40, 1, 0),
        ):
            pose_entry(frames, frame, emitter, scale=(charge,) * 3)
            pose_entry(frames, frame, arm_r, rotation=(recoil * 0.28, 0, recoil * 0.35))
            pose_entry(frames, frame, forearm_r, rotation=(-recoil * 0.45, 0, 0))
            pose_entry(
                frames, frame, body, rotation=(-recoil * 0.16, 0, -recoil * 0.14)
            )
            pose_entry(
                frames, frame, helix_b, scale=((1.3 if frame == 23 else 1.0),) * 3
            )
        return 40, frames
    if name == "AreaAttack":
        for frame, spread, pulse in (
            (1, 0, 1),
            (13, 12, 1.25),
            (25, -8, 1.85),
            (36, 8, 1.25),
            (48, 0, 1),
        ):
            pose_entry(
                frames,
                frame,
                body,
                rotation=(0, spread, spread * 0.4),
                scale=(pulse * 0.98, pulse * 0.98, pulse),
            )
            pose_entry(
                frames,
                frame,
                helix_a,
                rotation=(0, spread * 4, spread * 2),
                scale=(pulse,) * 3,
            )
            pose_entry(
                frames,
                frame,
                helix_b,
                rotation=(0, -spread * 4, -spread * 2),
                scale=(pulse,) * 3,
            )
            for index, shell in enumerate(carapaces):
                pose_entry(
                    frames,
                    frame,
                    shell,
                    rotation=(
                        0,
                        (1 if index else -1) * spread * 1.6,
                        (1 if index else -1) * spread,
                    ),
                )
            for index, spore in enumerate(spores):
                pose_entry(
                    frames,
                    frame,
                    spore,
                    scale=((1 + (pulse - 1) * (0.8 + index * 0.2)),) * 3,
                )
        return 48, frames
    if name == "HitReact":
        for frame, recoil in ((1, 0), (5, -18), (11, 12), (19, 0)):
            pose_entry(frames, frame, body, rotation=(recoil, 0, recoil * 0.45))
            pose_entry(frames, frame, head, rotation=(-recoil * 0.8, 0, -recoil * 0.6))
            pose_entry(frames, frame, emitter, scale=((1.2 if frame == 5 else 1),) * 3)
        return 19, frames
    if name == "Stunned":
        for frame, sway in ((1, 0), (14, -13), (28, 16), (43, -9), (58, 0)):
            pose_entry(frames, frame, body, rotation=(10, 0, sway))
            pose_entry(frames, frame, head, rotation=(18, 0, -sway * 1.2))
            pose_entry(frames, frame, maul, rotation=(12, 0, sway * 1.4))
            for index, tail in enumerate(tails):
                pose_entry(
                    frames, frame, tail, rotation=(0, 0, -sway * (1 + index * 0.5))
                )
        return 58, frames
    if name == "Roar":
        for frame, amount in ((1, 0), (12, 25), (25, 48), (38, 30), (52, 0)):
            pose_entry(frames, frame, head, rotation=(-amount * 0.28, 0, 0))
            pose_entry(frames, frame, jaw, rotation=(amount, 0, 0))
            pose_entry(frames, frame, helix_a, scale=(1 + amount / 100,) * 3)
            pose_entry(frames, frame, helix_b, scale=(1 + amount / 120,) * 3)
        return 52, frames
    if name in ("PhaseTransition", "Enrage"):
        for frame, pulse, roll in (
            (1, 1, 0),
            (10, 1.12, -7),
            (20, 1.34, 8),
            (31, 1.18, -5),
            (44, 1, 0),
        ):
            pose_entry(frames, frame, body, rotation=(-8, 0, roll), scale=(pulse,) * 3)
            pose_entry(
                frames,
                frame,
                helix_a,
                rotation=(0, roll * 6, 0),
                scale=(2 - pulse * 0.5,) * 3,
            )
            pose_entry(
                frames,
                frame,
                helix_b,
                rotation=(0, -roll * 6, 0),
                scale=(2 - pulse * 0.5,) * 3,
            )
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
        return 44, frames
    if name == "Summon":
        for frame, raise_amount in ((1, 0), (14, 18), (28, 35), (42, 0)):
            for index, spore in enumerate(spores):
                pose_entry(
                    frames,
                    frame,
                    spore,
                    rotation=(-raise_amount, 0, (index * 2 - 1) * raise_amount),
                    scale=(1 + raise_amount / 60,) * 3,
                )
            pose_entry(frames, frame, body, rotation=(-raise_amount * 0.16, 0, 0))
        return 42, frames
    if name == "WipeReset":
        for frame, sink, scale_value in (
            (1, 0, 1),
            (14, -0.28, 0.82),
            (30, -0.55, 0.65),
            (48, 0.12, 1.08),
            (64, 0, 1),
        ):
            pose_entry(
                frames, frame, root, location=(0, 0, sink), scale=(scale_value,) * 3
            )
        return 64, frames
    if name == "Death":
        for frame, fall, core_scale in (
            (1, 0, 1),
            (14, 12, 1.25),
            (30, 38, 1.8),
            (48, 74, 0.35),
            (68, 88, 0.08),
            (84, 88, 0.08),
        ):
            pose_entry(
                frames,
                frame,
                root,
                rotation=(fall, 0, -fall * 0.18),
                location=(0, 0, -fall * 0.003),
            )
            pose_entry(frames, frame, helix_a, scale=(core_scale,) * 3)
            pose_entry(frames, frame, helix_b, scale=(core_scale,) * 3)
            pose_entry(frames, frame, emitter, scale=(core_scale,) * 3)
            for index, shell in enumerate(carapaces):
                pose_entry(
                    frames,
                    frame,
                    shell,
                    rotation=(
                        0,
                        (1 if index else -1) * fall * 0.7,
                        (1 if index else -1) * fall * 0.5,
                    ),
                )
        return 84, frames
    return 24, frames


def failed_year_animation_pose(
    name: str, armature_obj: bpy.types.Object
) -> Tuple[int, Dict[int, FramePose]]:
    frames: Dict[int, FramePose] = {}
    root = first_bone(armature_obj, ("Root",))
    body = first_bone(armature_obj, ("Body",))
    head = first_bone(armature_obj, ("Head",))
    jaw = first_bone(armature_obj, ("Jaw",))
    emitter = first_bone(armature_obj, ("Emitter",))
    hearth = first_bone(armature_obj, ("HearthCore",))
    time_ring = first_bone(armature_obj, ("TimeRing",))
    mantle = first_bone(armature_obj, ("SnowMantle",))
    shells = bones_matching(armature_obj, "YearShell.")
    crowns = bones_matching(armature_obj, "Crown.")
    roofbeams = bones_matching(armature_obj, "Roofbeam.")
    rains = bones_matching(armature_obj, "Rain.")
    arm_l = first_bone(armature_obj, ("Arm.L",))
    forearm_l = first_bone(armature_obj, ("Forearm.L",))
    hand_l = first_bone(armature_obj, ("Hand.L",))
    arm_r = first_bone(armature_obj, ("Arm.R",))
    forearm_r = first_bone(armature_obj, ("Forearm.R",))
    hand_r = first_bone(armature_obj, ("Hand.R",))
    legs = [first_bone(armature_obj, (name,)) for name in ("Leg.L", "Leg.R")]
    shins = [first_bone(armature_obj, (name,)) for name in ("Shin.L", "Shin.R")]
    feet = [first_bone(armature_obj, (name,)) for name in ("Foot.L", "Foot.R")]

    def gait(end: int, amount: float, bob: float) -> Tuple[int, Dict[int, FramePose]]:
        for index, frame in enumerate((1, end // 2, end)):
            direction = 1 if index % 2 == 0 else -1
            pose_entry(frames, frame, root, location=(0, 0, bob if index == 1 else 0))
            pose_entry(frames, frame, body, rotation=(3, 0, direction * 3))
            for leg_index, leg in enumerate(legs):
                swing = amount * direction * (1 if leg_index == 0 else -1)
                pose_entry(frames, frame, leg, rotation=(swing, 0, 0))
                pose_entry(
                    frames, frame, shins[leg_index], rotation=(-swing * 0.65, 0, 0)
                )
                pose_entry(
                    frames, frame, feet[leg_index], rotation=(swing * 0.18, 0, 0)
                )
            pose_entry(
                frames, frame, arm_l, rotation=(-amount * direction * 0.4, 0, -5)
            )
            pose_entry(frames, frame, arm_r, rotation=(amount * direction * 0.4, 0, 5))
            for beam_index, beam in enumerate(roofbeams):
                pose_entry(
                    frames,
                    frame,
                    beam,
                    rotation=(0, direction * (4 + beam_index * 2), 0),
                )
        return end, frames

    if name == "Idle":
        for frame, breath, sway in ((1, 1, -3), (24, 1.05, 4), (48, 1, -3)):
            pose_entry(
                frames,
                frame,
                body,
                location=(0, 0, 0.02 if frame == 24 else 0),
                scale=(1, 1, breath),
            )
            pose_entry(frames, frame, head, rotation=(3, sway, -sway * 0.3))
            pose_entry(
                frames, frame, emitter, scale=((1.15 if frame == 24 else 1),) * 3
            )
            pose_entry(
                frames,
                frame,
                time_ring,
                rotation=(0, sway * 2, sway),
                scale=(1.04 if frame == 24 else 1,) * 3,
            )
            for index, crown in enumerate(crowns):
                pose_entry(
                    frames,
                    frame,
                    crown,
                    rotation=(0, sway * (index - 4) * 0.12, sway * 0.25),
                )
        return 48, frames
    if name == "Walk":
        return gait(34, 18, 0.025)
    if name == "Run":
        return gait(24, 27, 0.05)
    if name == "Sprint":
        return gait(18, 36, 0.07)
    if name in ("Jump", "Fly"):
        for frame, lift, crouch in (
            (1, 0, 0),
            (10, -0.06, 16),
            (20, 0.28, -20),
            (31, 0, 10),
            (42, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, 0, lift))
            pose_entry(frames, frame, body, rotation=(crouch * 0.25, 0, 0))
            for index, leg in enumerate(legs):
                pose_entry(frames, frame, leg, rotation=(crouch, 0, 0))
                pose_entry(frames, frame, shins[index], rotation=(-crouch * 0.8, 0, 0))
        return 42, frames
    if name == "Attack":
        for frame, sweep in ((1, 0), (12, -38), (24, 70), (36, 18), (48, 0)):
            pose_entry(frames, frame, arm_r, rotation=(sweep, 0, sweep * 0.55))
            pose_entry(frames, frame, forearm_r, rotation=(sweep * 0.55, 0, 0))
            pose_entry(frames, frame, hand_r, rotation=(sweep * 0.3, 0, 0))
            pose_entry(frames, frame, body, rotation=(0, -sweep * 0.12, -sweep * 0.08))
        return 48, frames
    if name == "HeavyAttack":
        for frame, amount, drop in (
            (1, 0, 0),
            (14, -58, 0.02),
            (28, 78, -0.11),
            (42, 22, -0.03),
            (56, 0, 0),
        ):
            pose_entry(frames, frame, arm_l, rotation=(amount, 0, -amount * 0.3))
            pose_entry(frames, frame, forearm_l, rotation=(amount * 0.65, 0, 0))
            pose_entry(frames, frame, hand_l, rotation=(amount * 0.3, 0, 0))
            pose_entry(frames, frame, body, rotation=(amount * 0.12, 0, 0))
            pose_entry(frames, frame, root, location=(0, 0, drop))
        return 56, frames
    if name == "RangedAttack":
        for frame, pulse, recoil in (
            (1, 1, 0),
            (14, 1.35, -6),
            (28, 2.1, -15),
            (34, 0.65, 17),
            (48, 1, 0),
        ):
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
            pose_entry(frames, frame, hearth, scale=(1 + (pulse - 1) * 0.5,) * 3)
            pose_entry(frames, frame, head, rotation=(recoil, 0, 0))
            pose_entry(
                frames, frame, jaw, rotation=(22 if frame in (28, 34) else 0, 0, 0)
            )
            pose_entry(frames, frame, time_ring, rotation=(0, recoil * 2.5, 0))
        return 48, frames
    if name == "AreaAttack":
        for frame, spread, pulse in (
            (1, 0, 1),
            (15, 45, 1.2),
            (30, 78, 1.75),
            (45, 25, 1.3),
            (60, 0, 1),
        ):
            pose_entry(frames, frame, arm_l, rotation=(0, 0, -spread))
            pose_entry(frames, frame, arm_r, rotation=(0, 0, spread))
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
            pose_entry(
                frames,
                frame,
                time_ring,
                rotation=(0, spread * 2, 0),
                scale=(pulse,) * 3,
            )
            for index, shell in enumerate(shells):
                pose_entry(
                    frames,
                    frame,
                    shell,
                    rotation=(
                        0,
                        (1 if index else -1) * spread * 0.2,
                        (1 if index else -1) * spread * 0.12,
                    ),
                )
        return 60, frames
    if name == "HitReact":
        for frame, recoil in ((1, 0), (7, -13), (15, 8), (26, 0)):
            pose_entry(frames, frame, body, rotation=(recoil, 0, recoil * 0.4))
            pose_entry(frames, frame, head, rotation=(-recoil * 0.8, 0, -recoil * 0.6))
            pose_entry(frames, frame, mantle, rotation=(0, recoil * 0.4, recoil * 0.3))
        return 26, frames
    if name == "Stunned":
        for frame, sway in ((1, 0), (18, -8), (36, 10), (54, -6), (72, 0)):
            pose_entry(frames, frame, body, rotation=(8, 0, sway))
            pose_entry(frames, frame, head, rotation=(18, 0, -sway * 1.3))
            pose_entry(frames, frame, time_ring, rotation=(0, sway * 4, sway * 2))
        return 72, frames
    if name == "Roar":
        for frame, open_amount in ((1, 0), (14, 20), (30, 42), (45, 28), (60, 0)):
            pose_entry(frames, frame, head, rotation=(-open_amount * 0.35, 0, 0))
            pose_entry(frames, frame, jaw, rotation=(open_amount, 0, 0))
            pose_entry(frames, frame, emitter, scale=(1 + open_amount / 55,) * 3)
            for beam_index, beam in enumerate(roofbeams):
                pose_entry(
                    frames,
                    frame,
                    beam,
                    rotation=(0, (beam_index * 2 - 1) * open_amount * 0.35, 0),
                )
        return 60, frames
    if name == "PhaseTransition":
        for frame, spin, pulse in (
            (1, 0, 1),
            (20, 90, 0.9),
            (40, 180, 0.65),
            (60, 270, 0.9),
            (80, 360, 1),
        ):
            pose_entry(
                frames, frame, time_ring, rotation=(0, spin, 0), scale=(2 - pulse,) * 3
            )
            pose_entry(
                frames, frame, root, rotation=(0, spin * 0.2, 0), scale=(pulse,) * 3
            )
            pose_entry(frames, frame, emitter, scale=(2 - pulse * 0.5,) * 3)
        return 80, frames
    if name == "Summon":
        for frame, raise_amount in ((1, 0), (18, 45), (38, 82), (58, 25), (76, 0)):
            pose_entry(
                frames, frame, arm_l, rotation=(-raise_amount, 0, -raise_amount * 0.5)
            )
            pose_entry(
                frames, frame, arm_r, rotation=(-raise_amount, 0, raise_amount * 0.5)
            )
            pose_entry(frames, frame, emitter, scale=(1 + raise_amount / 80,) * 3)
            for index, rain in enumerate(rains):
                pose_entry(
                    frames,
                    frame,
                    rain,
                    scale=(1, 1, 1 + raise_amount / 50),
                    rotation=(0, 0, (index * 2 - 1) * raise_amount * 0.2),
                )
        return 76, frames
    if name == "Enrage":
        for frame, shake, pulse in (
            (1, 0, 1),
            (8, -6, 1.15),
            (16, 7, 1.35),
            (24, -5, 1.55),
            (34, 4, 1.25),
            (48, 0, 1),
        ):
            pose_entry(frames, frame, body, rotation=(-6, 0, shake))
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
            pose_entry(frames, frame, mantle, scale=(2 - pulse * 0.5,) * 3)
        return 48, frames
    if name == "WipeReset":
        for frame, scale_value in ((1, 1), (18, 0.82), (36, 0.56), (54, 1.14), (72, 1)):
            pose_entry(frames, frame, root, scale=(scale_value,) * 3)
            pose_entry(frames, frame, time_ring, rotation=(0, (frame - 1) * 7, 0))
        return 72, frames
    if name == "Death":
        for frame, fall, melt in (
            (1, 0, 1),
            (18, 10, 1.08),
            (38, 30, 0.9),
            (62, 62, 0.5),
            (88, 80, 0.18),
            (108, 80, 0.12),
        ):
            pose_entry(
                frames,
                frame,
                root,
                rotation=(fall, 0, -fall * 0.11),
                location=(0, 0, -fall * 0.0025),
                scale=(1.0, 1.0, melt),
            )
            pose_entry(frames, frame, mantle, scale=(melt,) * 3)
            pose_entry(frames, frame, emitter, scale=(2 - melt,) * 3)
            for index, shell in enumerate(shells):
                pose_entry(
                    frames,
                    frame,
                    shell,
                    rotation=(
                        0,
                        (1 if index else -1) * fall * 0.45,
                        (1 if index else -1) * fall * 0.32,
                    ),
                    scale=(melt,) * 3,
                )
        return 108, frames
    return 24, frames


def thaedryn_animation_pose(
    name: str, armature_obj: bpy.types.Object
) -> Tuple[int, Dict[int, FramePose]]:
    frames: Dict[int, FramePose] = {}
    root = first_bone(armature_obj, ("Root",))
    body = first_bone(armature_obj, ("Body",))
    chest = first_bone(armature_obj, ("Chest",))
    necks = [first_bone(armature_obj, (f"Neck.{index}",)) for index in (1, 2, 3)]
    head = first_bone(armature_obj, ("Head",))
    jaw = first_bone(armature_obj, ("Jaw",))
    tongue = first_bone(armature_obj, ("Tongue",))
    emitter = first_bone(armature_obj, ("Emitter",))
    wings = [
        first_bone(armature_obj, (name,))
        for name in (
            "Wing.L",
            "WingMid.L",
            "WingTip.L",
            "Wing.R",
            "WingMid.R",
            "WingTip.R",
        )
    ]
    tails = [first_bone(armature_obj, (f"Tail.{index}",)) for index in range(1, 7)]
    chains = [first_bone(armature_obj, (f"Chain.{index}",)) for index in range(1, 5)]
    bells = [first_bone(armature_obj, (f"Bell.{index}",)) for index in range(1, 5)]
    legs = bones_matching(armature_obj, "Leg.")
    shins = bones_matching(armature_obj, "Shin.")
    claws = bones_matching(armature_obj, "Claw.")

    def neck_pose(frame: int, amount: float, yaw: float = 0) -> None:
        for index, neck in enumerate(necks):
            pose_entry(
                frames,
                frame,
                neck,
                rotation=(
                    amount * (0.3 + index * 0.16),
                    yaw * (0.22 + index * 0.18),
                    -yaw * 0.08,
                ),
            )
        pose_entry(
            frames, frame, head, rotation=(amount * 0.35, yaw * 0.45, -yaw * 0.12)
        )

    def tail_pose(frame: int, amount: float) -> None:
        for index, tail in enumerate(tails):
            pose_entry(
                frames,
                frame,
                tail,
                rotation=(
                    0,
                    amount * (0.04 + index * 0.012),
                    amount * (0.09 + index * 0.012),
                ),
            )

    def gait(end: int, stride: float, bob: float) -> Tuple[int, Dict[int, FramePose]]:
        for index, frame in enumerate((1, end // 2, end)):
            direction = 1 if index % 2 == 0 else -1
            pose_entry(frames, frame, root, location=(0, 0, bob if index == 1 else 0))
            pose_entry(frames, frame, body, rotation=(3, 0, direction * 2))
            for leg_index, leg in enumerate(legs):
                swing = stride * direction * (1 if leg_index % 2 == 0 else -1)
                pose_entry(frames, frame, leg, rotation=(swing, 0, 0))
                if leg_index < len(shins):
                    pose_entry(
                        frames, frame, shins[leg_index], rotation=(-swing * 0.65, 0, 0)
                    )
                if leg_index < len(claws):
                    pose_entry(
                        frames, frame, claws[leg_index], rotation=(swing * 0.18, 0, 0)
                    )
            neck_pose(frame, 3, direction * 3)
            tail_pose(frame, -direction * 7)
        return end, frames

    if name == "Idle":
        for frame, breath, yaw in ((1, 1, -3), (30, 1.035, 2), (60, 1, -3)):
            pose_entry(
                frames,
                frame,
                body,
                location=(0, 0, 0.018 if frame == 30 else 0),
                scale=(1, 1, breath),
            )
            pose_entry(frames, frame, chest, scale=(1, 1, 1.025 if frame == 30 else 1))
            neck_pose(frame, -8 if frame != 30 else -5, yaw)
            pose_entry(frames, frame, jaw, rotation=(3 if frame == 30 else 0, 0, 0))
            pose_entry(
                frames, frame, emitter, scale=((1.12 if frame == 30 else 1),) * 3
            )
            tail_pose(frame, yaw * 1.2)
            for index, bell in enumerate(bells):
                pose_entry(
                    frames, frame, bell, rotation=(0, 0, yaw * (0.3 + index * 0.12))
                )
        return 60, frames
    if name == "Walk":
        return gait(36, 18, 0.018)
    if name == "Run":
        return gait(24, 30, 0.04)
    if name == "Sprint":
        return gait(18, 42, 0.065)
    if name == "Jump":
        for frame, lift, tuck in (
            (1, 0, 0),
            (12, -0.06, 12),
            (24, 0.35, -18),
            (38, 0.18, -8),
            (52, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, 0, lift))
            pose_entry(frames, frame, body, rotation=(tuck * 0.2, 0, 0))
            for leg in legs:
                pose_entry(frames, frame, leg, rotation=(tuck, 0, 0))
            neck_pose(frame, -tuck * 0.25)
        return 52, frames
    if name == "Fly":
        for frame, flap, lift in (
            (1, 18, 0.08),
            (12, -48, 0.24),
            (24, 25, 0.34),
            (36, -36, 0.22),
            (48, 18, 0.08),
        ):
            pose_entry(frames, frame, root, location=(0, 0, lift))
            for index, wing in enumerate(wings):
                side = -1 if index < 3 else 1
                segment = index % 3
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(
                        0,
                        side * flap * (1 - segment * 0.18),
                        side * flap * 0.15,
                    ),
                )
            neck_pose(frame, -6, flap * 0.05)
            tail_pose(frame, -flap * 0.14)
        return 48, frames
    if name == "Attack":
        for frame, lunge, bite in (
            (1, 0, 0),
            (12, 0.03, -15),
            (24, -0.16, 38),
            (36, -0.06, 14),
            (48, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, lunge, 0))
            neck_pose(frame, bite * 0.32)
            pose_entry(frames, frame, jaw, rotation=(bite, 0, 0))
            pose_entry(frames, frame, tongue, rotation=(-bite * 0.2, 0, 0))
        return 48, frames
    if name == "HeavyAttack":
        for frame, sweep in ((1, 0), (16, -45), (32, 86), (50, 30), (68, 0)):
            tail_pose(frame, sweep)
            pose_entry(frames, frame, body, rotation=(0, -sweep * 0.12, -sweep * 0.08))
            pose_entry(frames, frame, root, rotation=(0, -sweep * 0.08, 0))
            neck_pose(frame, -4, sweep * 0.08)
        return 68, frames
    if name == "RangedAttack":
        for frame, charge, recoil in (
            (1, 1, 0),
            (16, 1.35, -8),
            (34, 2.1, -17),
            (42, 0.68, 20),
            (60, 1, 0),
        ):
            pose_entry(frames, frame, emitter, scale=(charge,) * 3)
            neck_pose(frame, recoil * 0.38)
            pose_entry(
                frames, frame, jaw, rotation=(26 if frame in (34, 42) else 0, 0, 0)
            )
            pose_entry(
                frames, frame, tongue, rotation=(-16 if frame in (34, 42) else 0, 0, 0)
            )
        return 60, frames
    if name == "AreaAttack":
        for frame, spread, gust in (
            (1, 0, 0),
            (18, 46, 0),
            (36, 88, 1),
            (52, -24, 0),
            (70, 0, 0),
        ):
            for index, wing in enumerate(wings):
                side = -1 if index < 3 else 1
                segment = index % 3
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(
                        0,
                        side * spread * (1 - segment * 0.16),
                        side * spread * 0.12,
                    ),
                )
            pose_entry(frames, frame, root, location=(0, 0, 0.08 if gust else 0))
            pose_entry(frames, frame, chest, rotation=(-spread * 0.08, 0, 0))
        return 70, frames
    if name == "HitReact":
        for frame, recoil in ((1, 0), (8, -12), (18, 7), (30, 0)):
            pose_entry(frames, frame, body, rotation=(recoil, 0, recoil * 0.35))
            neck_pose(frame, -recoil * 0.55, -recoil * 0.25)
            for index, bell in enumerate(bells):
                pose_entry(
                    frames,
                    frame,
                    bell,
                    rotation=(recoil * 0.2, 0, (index * 2 - 3) * recoil * 0.3),
                )
        return 30, frames
    if name == "Stunned":
        for frame, sway in ((1, 0), (20, -7), (40, 9), (60, -5), (80, 0)):
            pose_entry(frames, frame, body, rotation=(5, 0, sway))
            neck_pose(frame, 12, -sway * 0.6)
            tail_pose(frame, -sway * 1.6)
        return 80, frames
    if name == "Roar":
        for frame, amount in ((1, 0), (18, 22), (38, 46), (58, 30), (78, 0)):
            neck_pose(frame, -amount * 0.35)
            pose_entry(frames, frame, jaw, rotation=(amount, 0, 0))
            pose_entry(frames, frame, emitter, scale=(1 + amount / 55,) * 3)
            for index, bell in enumerate(bells):
                pose_entry(
                    frames,
                    frame,
                    bell,
                    rotation=(0, 0, (index * 2 - 3) * amount * 0.15),
                )
        return 78, frames
    if name == "PhaseTransition":
        for frame, rise, spread in (
            (1, 0, 0),
            (24, 10, 25),
            (50, 24, 55),
            (76, 34, 85),
            (100, 0, 0),
        ):
            neck_pose(frame, -rise)
            pose_entry(
                frames,
                frame,
                chest,
                rotation=(-rise * 0.22, 0, 0),
                location=(0, 0, rise * 0.002),
            )
            for index, wing in enumerate(wings):
                side = -1 if index < 3 else 1
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(0, side * spread * (1 - (index % 3) * 0.15), 0),
                )
            pose_entry(frames, frame, emitter, scale=(1 + rise / 45,) * 3)
        return 100, frames
    if name == "Summon":
        for frame, raise_amount in ((1, 0), (20, 30), (42, 62), (64, 22), (84, 0)):
            neck_pose(frame, -raise_amount * 0.28)
            pose_entry(frames, frame, emitter, scale=(1 + raise_amount / 70,) * 3)
            for index, wing in enumerate(wings):
                side = -1 if index < 3 else 1
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(-raise_amount * 0.15, side * raise_amount * 0.35, 0),
                )
        return 84, frames
    if name == "Enrage":
        for frame, shake, pulse in (
            (1, 0, 1),
            (10, -5, 1.15),
            (20, 6, 1.35),
            (30, -4, 1.55),
            (44, 3, 1.25),
            (60, 0, 1),
        ):
            pose_entry(frames, frame, body, rotation=(-5, 0, shake))
            neck_pose(frame, -14, -shake * 1.3)
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
            tail_pose(frame, shake * 2.5)
        return 60, frames
    if name == "WipeReset":
        for frame, settle in ((1, 0), (24, 12), (50, 25), (76, 10), (100, 0)):
            neck_pose(frame, settle)
            pose_entry(frames, frame, body, rotation=(settle * 0.18, 0, 0))
            for index, wing in enumerate(wings):
                side = -1 if index < 3 else 1
                pose_entry(frames, frame, wing, rotation=(0, side * settle * 0.3, 0))
        return 100, frames
    if name == "Death":
        for frame, fall, core_scale in (
            (1, 0, 1),
            (24, 8, 1.1),
            (52, 24, 1.45),
            (84, 58, 0.55),
            (116, 82, 0.12),
            (140, 82, 0.08),
        ):
            pose_entry(
                frames,
                frame,
                root,
                rotation=(fall, 0, -fall * 0.08),
                location=(0, 0, -fall * 0.002),
            )
            neck_pose(frame, fall * 0.45)
            pose_entry(frames, frame, emitter, scale=(core_scale,) * 3)
            for index, wing in enumerate(wings):
                side = -1 if index < 3 else 1
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(0, side * fall * 0.45, side * fall * 0.08),
                )
            tail_pose(frame, fall * 0.38)
            for index, chain in enumerate(chains):
                pose_entry(
                    frames,
                    frame,
                    chain,
                    rotation=(fall * 0.25, 0, (index * 2 - 3) * fall * 0.2),
                    scale=((1 if frame < 84 else 0.2),) * 3,
                )
        return 140, frames
    return 24, frames


def gilded_bull_animation_pose(
    name: str, armature_obj: bpy.types.Object
) -> Tuple[int, Dict[int, FramePose]]:
    """Author weighty quadruped motion instead of reusing humanoid gestures."""

    frames: Dict[int, FramePose] = {}
    root = first_bone(armature_obj, ("Root",))
    body = first_bone(armature_obj, ("Body",))
    neck = first_bone(armature_obj, ("Neck",))
    head = first_bone(armature_obj, ("Head",))
    jaw = first_bone(armature_obj, ("Jaw",))
    crown = first_bone(armature_obj, ("Crown",))
    emitter = first_bone(armature_obj, ("Emitter",))
    door_l = first_bone(armature_obj, ("CoreDoor.L",))
    door_r = first_bone(armature_obj, ("CoreDoor.R",))
    shoulder_l = first_bone(armature_obj, ("Shoulder.L",))
    shoulder_r = first_bone(armature_obj, ("Shoulder.R",))
    haunch_l = first_bone(armature_obj, ("Haunch.L",))
    haunch_r = first_bone(armature_obj, ("Haunch.R",))
    vent_l = first_bone(armature_obj, ("Vent.L",))
    vent_r = first_bone(armature_obj, ("Vent.R",))
    tail_1 = first_bone(armature_obj, ("Tail.1",))
    tail_2 = first_bone(armature_obj, ("Tail.2",))
    tail_3 = first_bone(armature_obj, ("Tail.3",))
    tail_charm = first_bone(armature_obj, ("TailCharm",))
    horns = bones_matching(armature_obj, "Horn.")
    uppers = {
        suffix: first_bone(armature_obj, (f"Leg.{suffix}",))
        for suffix in ("FL", "FR", "BL", "BR")
    }
    shins = {
        suffix: first_bone(armature_obj, (f"Shin.{suffix}",))
        for suffix in ("FL", "FR", "BL", "BR")
    }
    hooves = {
        suffix: first_bone(armature_obj, (f"Hoof.{suffix}",))
        for suffix in ("FL", "FR", "BL", "BR")
    }

    def leg_pose(
        frame: int, suffix: str, upper: float, shin: float, hoof: float
    ) -> None:
        pose_entry(frames, frame, uppers[suffix], rotation=(upper, 0, 0))
        pose_entry(frames, frame, shins[suffix], rotation=(shin, 0, 0))
        pose_entry(frames, frame, hooves[suffix], rotation=(hoof, 0, 0))

    def gait(
        end: int, stride: float, lift: float, pitch: float
    ) -> Tuple[int, Dict[int, FramePose]]:
        quarter = max(2, end // 4)
        for index, frame in enumerate(
            (1, quarter + 1, quarter * 2 + 1, quarter * 3 + 1, end)
        ):
            phase = (0, 1, 0, -1, 0)[index]
            pose_entry(
                frames,
                frame,
                root,
                location=(0, 0, lift if abs(phase) == 1 else 0),
            )
            pose_entry(
                frames,
                frame,
                body,
                rotation=(pitch + abs(phase) * 1.5, 0, phase * 2.5),
            )
            for suffix, diagonal in (("FL", 1), ("BR", 1), ("FR", -1), ("BL", -1)):
                swing = stride * phase * diagonal
                leg_pose(frame, suffix, swing, -swing * 0.72, swing * 0.28)
            pose_entry(
                frames,
                frame,
                neck,
                rotation=(-pitch * 0.55 - abs(phase), 0, -phase * 1.8),
            )
            pose_entry(frames, frame, head, rotation=(pitch * 0.35, 0, phase * 1.2))
            pose_entry(frames, frame, shoulder_l, rotation=(0, 0, phase * 1.8))
            pose_entry(frames, frame, shoulder_r, rotation=(0, 0, -phase * 1.8))
            pose_entry(frames, frame, haunch_l, rotation=(0, 0, -phase * 1.4))
            pose_entry(frames, frame, haunch_r, rotation=(0, 0, phase * 1.4))
            pose_entry(frames, frame, tail_1, rotation=(0, 0, -phase * 8))
            pose_entry(frames, frame, tail_2, rotation=(0, 0, -phase * 13))
            pose_entry(frames, frame, tail_3, rotation=(0, 0, -phase * 18))
            pose_entry(frames, frame, tail_charm, rotation=(phase * 7, 0, phase * 12))
        return end, frames

    if name == "Idle":
        for frame, breath, scan in (
            (1, 1.0, -3),
            (16, 1.07, 0),
            (32, 1.02, 5),
            (48, 1.0, -3),
        ):
            pose_entry(
                frames,
                frame,
                body,
                location=(0, 0, 0.018 if frame in (16, 32) else 0),
                scale=(1, 1, breath),
            )
            pose_entry(
                frames, frame, neck, rotation=(-2 if frame == 16 else 1, 0, scan * 0.4)
            )
            pose_entry(
                frames,
                frame,
                head,
                rotation=(2 if frame == 32 else 0, scan, scan * 0.25),
            )
            pose_entry(frames, frame, jaw, rotation=(3 if frame == 32 else 0, 0, 0))
            pose_entry(
                frames, frame, emitter, scale=((1.0 if frame in (1, 48) else 1.13),) * 3
            )
            pose_entry(frames, frame, vent_l, rotation=(0, -4 if frame == 16 else 0, 0))
            pose_entry(frames, frame, vent_r, rotation=(0, 4 if frame == 32 else 0, 0))
            pose_entry(frames, frame, tail_1, rotation=(0, 0, scan * 0.9))
            pose_entry(frames, frame, tail_2, rotation=(0, 0, scan * 1.5))
            pose_entry(frames, frame, tail_3, rotation=(0, 0, scan * 2.0))
            pose_entry(frames, frame, tail_charm, rotation=(0, scan, scan * 2.4))
        return 48, frames
    if name == "Walk":
        return gait(24, 22, 0.025, 1.5)
    if name == "Run":
        return gait(16, 36, 0.055, 6)
    if name == "Sprint":
        return gait(12, 48, 0.08, 12)
    if name == "Jump":
        for frame, height, pitch_value in (
            (1, 0, 0),
            (7, -0.08, 10),
            (14, 0.42, -12),
            (22, 0.48, -4),
            (29, 0.03, 12),
            (36, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, 0, height))
            pose_entry(frames, frame, body, rotation=(pitch_value, 0, 0))
            pose_entry(frames, frame, neck, rotation=(-pitch_value * 0.65, 0, 0))
            pose_entry(frames, frame, head, rotation=(-pitch_value * 0.3, 0, 0))
            tucked = 34 if 12 <= frame <= 24 else -18 if frame == 7 else 0
            for suffix in uppers:
                leg_pose(frame, suffix, tucked, -tucked * 0.85, tucked * 0.3)
            pose_entry(frames, frame, tail_1, rotation=(-pitch_value * 0.7, 0, 0))
            pose_entry(frames, frame, tail_2, rotation=(-pitch_value, 0, 0))
        return 36, frames
    if name == "Fly":
        for frame, height, roll in ((1, 0.25, -4), (8, 0.38, 5), (16, 0.25, -4)):
            pose_entry(
                frames, frame, root, location=(0, 0, height), rotation=(-5, 0, roll)
            )
            pose_entry(frames, frame, body, rotation=(-8, 0, -roll * 0.4))
            pose_entry(frames, frame, head, rotation=(10, 0, roll * 0.5))
            for suffix in uppers:
                leg_pose(frame, suffix, 32, -42, 15)
            pose_entry(frames, frame, tail_1, rotation=(8, 0, -roll * 1.5))
            pose_entry(frames, frame, tail_2, rotation=(12, 0, -roll * 2.2))
        return 16, frames
    if name == "Attack":
        for frame, lunge, head_pitch, roll in (
            (1, 0, 0, 0),
            (7, 0.02, 16, -4),
            (13, -0.12, -38, 7),
            (20, -0.05, -12, -3),
            (28, 0, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, lunge, 0))
            pose_entry(frames, frame, body, rotation=(head_pitch * 0.12, 0, roll))
            pose_entry(
                frames, frame, neck, rotation=(head_pitch * 0.28, 0, -roll * 0.6)
            )
            pose_entry(frames, frame, head, rotation=(head_pitch * 0.42, 0, roll))
            pose_entry(
                frames, frame, jaw, rotation=(12 if frame in (13, 20) else 0, 0, 0)
            )
            for suffix in ("FL", "FR"):
                leg_pose(frame, suffix, -head_pitch * 0.25, head_pitch * 0.15, 0)
        return 28, frames
    if name == "HeavyAttack":
        for frame, drop, pitch_value, forward in (
            (1, 0, 0, 0),
            (10, -0.04, -20, 0.03),
            (18, 0.05, 42, -0.18),
            (25, -0.02, 18, -0.08),
            (36, 0, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, forward, drop))
            pose_entry(frames, frame, body, rotation=(pitch_value * 0.12, 0, 0))
            pose_entry(frames, frame, neck, rotation=(pitch_value * 0.25, 0, 0))
            pose_entry(frames, frame, head, rotation=(pitch_value * 0.35, 0, 0))
            pose_entry(
                frames, frame, jaw, rotation=(18 if frame in (18, 25) else 0, 0, 0)
            )
            for suffix in ("FL", "FR"):
                leg_pose(frame, suffix, -pitch_value * 0.3, pitch_value * 0.18, 0)
            for suffix in ("BL", "BR"):
                leg_pose(frame, suffix, pitch_value * 0.12, -pitch_value * 0.08, 0)
        return 36, frames
    if name == "RangedAttack":
        for frame, charge, door, recoil in (
            (1, 1.0, 0, 0),
            (10, 1.25, 12, 6),
            (20, 1.9, 34, 14),
            (24, 0.72, 38, -16),
            (34, 1.0, 0, 0),
        ):
            pose_entry(frames, frame, emitter, scale=(charge, charge, charge))
            pose_entry(frames, frame, door_l, rotation=(0, -door, -door * 0.45))
            pose_entry(frames, frame, door_r, rotation=(0, door, door * 0.45))
            pose_entry(frames, frame, body, rotation=(recoil * 0.28, 0, 0))
            pose_entry(frames, frame, neck, rotation=(-recoil * 0.4, 0, 0))
            pose_entry(frames, frame, head, rotation=(-recoil * 0.25, 0, 0))
            pose_entry(frames, frame, vent_l, rotation=(0, -door * 0.5, 0))
            pose_entry(frames, frame, vent_r, rotation=(0, door * 0.5, 0))
        return 34, frames
    if name == "AreaAttack":
        for frame, lift, slam, pulse in (
            (1, 0, 0, 1.0),
            (12, 0.11, -42, 1.15),
            (20, -0.07, 35, 1.75),
            (28, -0.02, 12, 1.25),
            (38, 0, 0, 1.0),
        ):
            pose_entry(frames, frame, root, location=(0, 0, lift))
            pose_entry(frames, frame, body, rotation=(-slam * 0.25, 0, 0))
            pose_entry(frames, frame, neck, rotation=(slam * 0.35, 0, 0))
            pose_entry(frames, frame, head, rotation=(slam * 0.28, 0, 0))
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            for suffix in ("FL", "FR"):
                leg_pose(frame, suffix, slam, -slam * 0.75, slam * 0.2)
        return 38, frames
    if name == "HitReact":
        for frame, recoil, roll in ((1, 0, 0), (5, 16, -8), (11, -9, 5), (19, 0, 0)):
            pose_entry(frames, frame, body, rotation=(recoil, 0, roll))
            pose_entry(frames, frame, neck, rotation=(-recoil * 0.8, 0, -roll))
            pose_entry(frames, frame, head, rotation=(-recoil * 0.9, 0, -roll * 1.3))
            pose_entry(frames, frame, tail_charm, rotation=(recoil, 0, roll * 2))
        return 19, frames
    if name == "Stunned":
        for frame, sway in ((1, 0), (14, -12), (28, 15), (42, -9), (56, 0)):
            pose_entry(frames, frame, body, rotation=(12, 0, sway))
            pose_entry(frames, frame, neck, rotation=(24, 0, -sway * 0.8))
            pose_entry(frames, frame, head, rotation=(28, 0, -sway * 1.2))
            for suffix, side in (("FL", -1), ("FR", 1), ("BL", -1), ("BR", 1)):
                leg_pose(frame, suffix, 8 + side * sway * 0.35, -12, 4)
            pose_entry(frames, frame, tail_1, rotation=(0, 0, -sway * 1.5))
            pose_entry(frames, frame, tail_2, rotation=(0, 0, -sway * 2.1))
        return 56, frames
    if name == "Roar":
        for frame, open_amount, pulse in (
            (1, 0, 1),
            (10, 24, 1.2),
            (21, 48, 1.65),
            (33, 30, 1.3),
            (44, 0, 1),
        ):
            pose_entry(frames, frame, neck, rotation=(-open_amount * 0.45, 0, 0))
            pose_entry(frames, frame, head, rotation=(-open_amount * 0.3, 0, 0))
            pose_entry(frames, frame, jaw, rotation=(open_amount, 0, 0))
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            pose_entry(frames, frame, vent_l, rotation=(0, -open_amount * 0.4, 0))
            pose_entry(frames, frame, vent_r, rotation=(0, open_amount * 0.4, 0))
        return 44, frames
    if name == "PhaseTransition":
        for frame, open_amount, pulse, spread in (
            (1, 0, 1.0, 0),
            (14, 22, 1.25, 4),
            (27, 42, 1.8, 9),
            (40, 18, 1.35, -5),
            (52, 0, 1.0, 0),
        ):
            pose_entry(
                frames, frame, door_l, rotation=(0, -open_amount, -open_amount * 0.5)
            )
            pose_entry(
                frames, frame, door_r, rotation=(0, open_amount, open_amount * 0.5)
            )
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            pose_entry(frames, frame, shoulder_l, rotation=(0, -spread, -spread))
            pose_entry(frames, frame, shoulder_r, rotation=(0, spread, spread))
            pose_entry(frames, frame, vent_l, rotation=(0, -open_amount * 0.6, 0))
            pose_entry(frames, frame, vent_r, rotation=(0, open_amount * 0.6, 0))
            pose_entry(frames, frame, crown, rotation=(-spread, 0, 0))
        return 52, frames
    if name == "Summon":
        for frame, rise, pulse in (
            (1, 0, 1),
            (14, 0.06, 1.25),
            (28, 0.1, 1.75),
            (42, 0, 1),
        ):
            pose_entry(frames, frame, root, location=(0, 0, rise))
            pose_entry(
                frames, frame, body, rotation=(-8 if frame in (14, 28) else 0, 0, 0)
            )
            pose_entry(
                frames, frame, head, rotation=(-18 if frame in (14, 28) else 0, 0, 0)
            )
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            for suffix in hooves:
                pose_entry(
                    frames,
                    frame,
                    hooves[suffix],
                    rotation=(10 if frame == 28 else 0, 0, 0),
                )
        return 42, frames
    if name == "Enrage":
        for frame, shake, pulse in (
            (1, 0, 1),
            (5, -7, 1.35),
            (9, 7, 1.55),
            (13, -6, 1.75),
            (18, 5, 1.45),
            (28, 0, 1),
        ):
            pose_entry(
                frames, frame, body, rotation=(-8, 0, shake), scale=(1.02, 1.02, 1.02)
            )
            pose_entry(frames, frame, head, rotation=(-22, 0, -shake * 1.6))
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            pose_entry(
                frames, frame, vent_l, rotation=(0, -25 if frame != 28 else 0, shake)
            )
            pose_entry(
                frames, frame, vent_r, rotation=(0, 25 if frame != 28 else 0, -shake)
            )
        return 28, frames
    if name == "WipeReset":
        for frame, height, kneel, pulse in (
            (1, 0, 0, 1),
            (14, -0.13, 30, 0.5),
            (30, -0.16, 38, 0.15),
            (44, -0.05, 12, 1.4),
            (58, 0, 0, 1),
        ):
            pose_entry(frames, frame, root, location=(0, 0, height))
            pose_entry(frames, frame, body, rotation=(kneel * 0.25, 0, 0))
            pose_entry(frames, frame, head, rotation=(kneel, 0, 0))
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            for suffix in uppers:
                leg_pose(frame, suffix, kneel * 0.7, -kneel * 0.8, kneel * 0.2)
        return 58, frames
    if name == "Death":
        for frame, fall, collapse, core_scale in (
            (1, 0, 0, 1),
            (12, 8, 12, 1.2),
            (26, 35, 34, 2.0),
            (42, 68, 55, 0.35),
            (64, 76, 62, 0.08),
            (80, 76, 62, 0.08),
        ):
            pose_entry(
                frames,
                frame,
                root,
                rotation=(fall, 0, -fall * 0.13),
                location=(0, 0, -collapse * 0.003),
            )
            pose_entry(frames, frame, body, rotation=(collapse * 0.2, 0, 0))
            pose_entry(frames, frame, neck, rotation=(collapse * 0.65, 0, 0))
            pose_entry(frames, frame, head, rotation=(collapse * 0.85, 0, 0))
            pose_entry(frames, frame, jaw, rotation=(min(38, collapse), 0, 0))
            pose_entry(
                frames, frame, emitter, scale=(core_scale, core_scale, core_scale)
            )
            pose_entry(
                frames, frame, door_l, rotation=(0, -collapse * 0.7, -collapse * 0.4)
            )
            pose_entry(
                frames, frame, door_r, rotation=(0, collapse * 0.7, collapse * 0.4)
            )
            for suffix, side in (("FL", -1), ("FR", 1), ("BL", -1), ("BR", 1)):
                leg_pose(
                    frame,
                    suffix,
                    collapse * (0.7 + side * 0.05),
                    -collapse * 0.9,
                    collapse * 0.2,
                )
            for index, horn in enumerate(horns):
                pose_entry(
                    frames,
                    frame,
                    horn,
                    rotation=(0, 0, (-1 if index == 0 else 1) * collapse * 0.8),
                    scale=((1 if frame < 42 else 0.15),) * 3,
                )
            pose_entry(
                frames, frame, tail_1, rotation=(collapse * 0.35, 0, collapse * 0.25)
            )
            pose_entry(
                frames, frame, tail_2, rotation=(collapse * 0.55, 0, collapse * 0.35)
            )
            pose_entry(
                frames, frame, tail_3, rotation=(collapse * 0.75, 0, collapse * 0.45)
            )
        return 80, frames
    return 24, frames


def animation_pose(
    name: str,
    armature_obj: bpy.types.Object,
    archetype: str,
) -> Tuple[int, Dict[int, FramePose]]:
    if archetype == "breach_helix":
        return breach_helix_animation_pose(name, armature_obj)
    if archetype == "failed_year":
        return failed_year_animation_pose(name, armature_obj)
    if archetype == "thaedryn":
        return thaedryn_animation_pose(name, armature_obj)
    if archetype == "gilded_bull":
        return gilded_bull_animation_pose(name, armature_obj)
    frames: Dict[int, FramePose] = {}
    root = first_bone(armature_obj, ("Root",))
    body = first_bone(armature_obj, ("Body", "Singer.B.Body", "Singer.A.Body"))
    head = first_bone(
        armature_obj, ("Head", "Singer.A.Head", "Singer.B.Head", "Singer.C.Head")
    )
    jaw = first_bone(armature_obj, ("Jaw",))
    emitter = first_bone(armature_obj, ("Emitter",))
    crown = first_bone(armature_obj, ("Crown",))
    arm_l = first_bone(armature_obj, ("Arm.L", "Singer.A.Arm.L", "Singer.B.Arm.L"))
    arm_r = first_bone(armature_obj, ("Arm.R", "Singer.A.Arm.R", "Singer.B.Arm.R"))
    wings = bones_matching(armature_obj, "Wing.")
    legs = bones_matching(armature_obj, "Leg.")
    tails = bones_matching(armature_obj, "Tail.")
    singers = [
        bone.name
        for bone in armature_obj.pose.bones
        if bone.name.startswith("Singer.") and bone.name.endswith("Body")
    ]

    def gait(end: int, amount: float, bob: float) -> Tuple[int, Dict[int, FramePose]]:
        for index, frame in enumerate((1, end // 2, end)):
            direction = 1 if index % 2 == 0 else -1
            pose_entry(frames, frame, root, location=(0, 0, 0 if index == 0 else bob))
            for leg_index, bone in enumerate(legs):
                pose_entry(
                    frames,
                    frame,
                    bone,
                    rotation=(
                        amount * direction * (1 if leg_index % 2 == 0 else -1),
                        0,
                        0,
                    ),
                )
            for arm_index, bone in enumerate((arm_l, arm_r)):
                pose_entry(
                    frames,
                    frame,
                    bone,
                    rotation=(
                        -amount * 0.65 * direction * (1 if arm_index == 0 else -1),
                        0,
                        0,
                    ),
                )
            for tail_index, bone in enumerate(tails):
                pose_entry(
                    frames,
                    frame,
                    bone,
                    rotation=(0, 0, direction * (8 + tail_index * 5)),
                )
        return end, frames

    if name == "Idle":
        for frame, lift, scale_z in ((1, 0, 1), (24, 0.025, 1.035), (48, 0, 1)):
            pose_entry(
                frames, frame, body, location=(0, 0, lift), scale=(1, 1, scale_z)
            )
            pose_entry(
                frames,
                frame,
                head,
                rotation=(2 if frame == 24 else 0, 0, -2 if frame == 24 else 0),
            )
            pose_entry(
                frames,
                frame,
                emitter,
                scale=(1.1, 1.1, 1.1) if frame == 24 else (1, 1, 1),
            )
            for index, singer in enumerate(singers):
                pose_entry(
                    frames,
                    frame,
                    singer,
                    location=(0, 0, (0.03 + index * 0.008) if frame == 24 else 0),
                )
        return 48, frames
    if name == "Walk":
        return gait(24, 24, 0.035)
    if name == "Run":
        return gait(16, 39, 0.065)
    if name == "Sprint":
        return gait(12, 52, 0.095)
    if name == "Jump":
        for frame, z, body_rot in (
            (1, 0, 0),
            (6, -0.08, 9),
            (13, 0.38, -8),
            (20, 0.5, -3),
            (28, 0, 7),
            (34, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, 0, z))
            pose_entry(frames, frame, body, rotation=(body_rot, 0, 0))
            for leg in legs:
                pose_entry(
                    frames,
                    frame,
                    leg,
                    rotation=(
                        -35 if 10 <= frame <= 22 else 18 if frame == 6 else 0,
                        0,
                        0,
                    ),
                )
        return 34, frames
    if name == "Fly":
        for frame, flap in ((1, 18), (8, -42), (16, 18)):
            pose_entry(frames, frame, root, location=(0, 0, 0.06 if frame == 8 else 0))
            for index, wing in enumerate(wings):
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(0, flap * (1 if index % 2 == 0 else -1), 0),
                )
            if not wings:
                pose_entry(frames, frame, arm_l, rotation=(0, 0, -70 + flap))
                pose_entry(frames, frame, arm_r, rotation=(0, 0, 70 - flap))
        return 16, frames
    if name == "Attack":
        for frame, amount in ((1, 0), (7, -38), (12, 78), (20, 0)):
            pose_entry(
                frames, frame, arm_r, rotation=(amount, -amount * 0.25, amount * 0.4)
            )
            pose_entry(frames, frame, head, rotation=(amount * 0.28, 0, 0))
            pose_entry(frames, frame, jaw, rotation=(-max(0, amount) * 0.35, 0, 0))
            pose_entry(frames, frame, body, rotation=(amount * 0.12, 0, -amount * 0.08))
        return 20, frames
    if name == "HeavyAttack":
        for frame, amount, z in (
            (1, 0, 0),
            (10, -62, 0.05),
            (17, 88, -0.1),
            (25, 30, -0.04),
            (34, 0, 0),
        ):
            pose_entry(
                frames, frame, body, rotation=(amount * 0.32, 0, 0), location=(0, 0, z)
            )
            pose_entry(frames, frame, arm_l, rotation=(amount, 0, -amount * 0.32))
            pose_entry(frames, frame, arm_r, rotation=(amount, 0, amount * 0.32))
            pose_entry(frames, frame, head, rotation=(amount * 0.2, 0, 0))
        return 34, frames
    if name == "RangedAttack":
        for frame, charge, recoil in (
            (1, 1, 0),
            (10, 1.35, -8),
            (17, 1.8, -16),
            (20, 0.72, 15),
            (29, 1, 0),
        ):
            pose_entry(frames, frame, emitter, scale=(charge, charge, charge))
            pose_entry(frames, frame, head, rotation=(recoil, 0, 0))
            pose_entry(
                frames, frame, jaw, rotation=(-25 if 10 <= frame <= 20 else 0, 0, 0)
            )
            pose_entry(
                frames, frame, arm_l, rotation=(0, 0, -35 if frame in (10, 17) else 0)
            )
            pose_entry(
                frames, frame, arm_r, rotation=(0, 0, 35 if frame in (10, 17) else 0)
            )
        return 29, frames
    if name == "AreaAttack":
        for frame, spread, pulse in (
            (1, 0, 1),
            (12, 55, 1.15),
            (20, 82, 1.55),
            (31, 0, 1),
        ):
            pose_entry(frames, frame, arm_l, rotation=(0, 0, -spread))
            pose_entry(frames, frame, arm_r, rotation=(0, 0, spread))
            for index, wing in enumerate(wings):
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(0, spread * (1 if index % 2 == 0 else -1), 0),
                )
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            pose_entry(frames, frame, root, location=(0, 0, 0.12 if frame == 20 else 0))
        return 31, frames
    if name == "HitReact":
        for frame, rot in ((1, 0), (4, -18), (9, 10), (16, 0)):
            pose_entry(frames, frame, body, rotation=(rot, 0, rot * 0.45))
            pose_entry(frames, frame, head, rotation=(rot * 1.3, 0, -rot * 0.5))
        return 16, frames
    if name == "Stunned":
        for frame, sway in ((1, 0), (15, -9), (30, 8), (45, 0)):
            pose_entry(frames, frame, body, rotation=(12, 0, sway))
            pose_entry(frames, frame, head, rotation=(25, 0, -sway * 1.4))
            pose_entry(frames, frame, crown, rotation=(0, sway, 0))
        return 45, frames
    if name == "Roar":
        for frame, open_amount in ((1, 0), (9, 28), (17, 48), (27, 35), (38, 0)):
            pose_entry(frames, frame, head, rotation=(-open_amount * 0.38, 0, 0))
            pose_entry(frames, frame, jaw, rotation=(open_amount, 0, 0))
            pose_entry(frames, frame, body, rotation=(-open_amount * 0.12, 0, 0))
            pose_entry(frames, frame, emitter, scale=(1 + open_amount / 80,) * 3)
        return 38, frames
    if name == "PhaseTransition":
        for frame, pulse, spin in (
            (1, 1, 0),
            (12, 0.88, -10),
            (24, 1.24, 12),
            (38, 1, 0),
        ):
            pose_entry(
                frames,
                frame,
                body,
                scale=(pulse, pulse, pulse),
                rotation=(0, spin, spin),
            )
            pose_entry(frames, frame, crown, rotation=(0, spin * 1.8, 0))
            pose_entry(frames, frame, emitter, scale=(2 - pulse * 0.5,) * 3)
            for index, singer in enumerate(singers):
                pose_entry(
                    frames,
                    frame,
                    singer,
                    rotation=(0, 0, spin * (1 if index % 2 else -1)),
                )
        return 38, frames
    if name == "Summon":
        for frame, raise_amount in ((1, 0), (14, 82), (28, 96), (42, 0)):
            pose_entry(
                frames, frame, arm_l, rotation=(-raise_amount, 0, -raise_amount * 0.45)
            )
            pose_entry(
                frames, frame, arm_r, rotation=(-raise_amount, 0, raise_amount * 0.45)
            )
            pose_entry(frames, frame, emitter, scale=(1 + raise_amount / 100,) * 3)
            for index, singer in enumerate(singers):
                pose_entry(
                    frames,
                    frame,
                    singer,
                    location=(0, 0, 0.1 if frame in (14, 28) else 0),
                    rotation=(0, 0, (index - 1) * raise_amount * 0.2),
                )
        return 42, frames
    if name == "Enrage":
        for frame in (1, 4, 8, 12, 16, 22):
            direction = -1 if frame % 8 == 0 else 1
            pose_entry(
                frames,
                frame,
                body,
                rotation=(-8, 0, direction * 5),
                scale=(1.07, 1.07, 1.07),
            )
            pose_entry(frames, frame, head, rotation=(-18, 0, -direction * 8))
            pose_entry(frames, frame, emitter, scale=(1.45, 1.45, 1.45))
        pose_entry(frames, 30, body, rotation=(0, 0, 0), scale=(1, 1, 1))
        pose_entry(frames, 30, head, rotation=(0, 0, 0))
        pose_entry(frames, 30, emitter, scale=(1, 1, 1))
        return 30, frames
    if name == "WipeReset":
        for frame, z, scale_value in (
            (1, 0, 1),
            (10, -0.15, 0.82),
            (22, 0.18, 1.12),
            (38, 0, 1),
        ):
            pose_entry(
                frames, frame, root, location=(0, 0, z), scale=(scale_value,) * 3
            )
            pose_entry(frames, frame, body, rotation=(20 if frame == 10 else 0, 0, 0))
        return 38, frames
    if name == "Death":
        for frame, rot, z, body_scale in (
            (1, 0, 0, 1),
            (10, 18, -0.03, 1),
            (24, 62, -0.12, 0.96),
            (42, 82, -0.22, 0.9),
            (60, 82, -0.22, 0.9),
        ):
            pose_entry(
                frames, frame, root, rotation=(rot, 0, -rot * 0.13), location=(0, 0, z)
            )
            pose_entry(frames, frame, body, scale=(body_scale,) * 3)
            pose_entry(frames, frame, head, rotation=(rot * 0.3, 0, 0))
            pose_entry(frames, frame, jaw, rotation=(25 if frame >= 24 else 0, 0, 0))
            for wing in wings:
                pose_entry(
                    frames, frame, wing, rotation=(0, -35 if frame >= 24 else 0, 0)
                )
        return 60, frames
    return 24, frames


SPECIAL_BASES: Mapping[str, str] = {
    "BreachStalk": "Walk",
    "MaulCrush": "HeavyAttack",
    "SiphonVolley": "RangedAttack",
    "HelixPulse": "AreaAttack",
    "SporeCast": "Summon",
    "Burrow": "Jump",
    "Rupture": "AreaAttack",
    "BreachCollapse": "Death",
    "PatrolScan": "Idle",
    "Charge": "Sprint",
    "PillarCrash": "HitReact",
    "HornBreak": "HitReact",
    "SunCoreBeam": "RangedAttack",
    "HoofQuake": "AreaAttack",
    "Unbalanced": "Stunned",
    "CoreRupture": "Death",
    "HearthFails": "RangedAttack",
    "Blizzard": "AreaAttack",
    "TimeLoop": "PhaseTransition",
    "RoofbeamSweep": "HeavyAttack",
    "YearBreaks": "Enrage",
    "Shatter": "Enrage",
    "Rainfall": "Summon",
    "MeltDeath": "Death",
    "BellCast": "RangedAttack",
    "BellBreak": "HitReact",
    "Chant": "Summon",
    "HarmonyBreak": "HitReact",
    "Mimic": "PhaseTransition",
    "Teleport": "PhaseTransition",
    "Breath": "RangedAttack",
    "Yield": "Stunned",
    "SleeperSweep": "HeavyAttack",
    "SoundCloud": "RangedAttack",
    "RiverBreath": "RangedAttack",
    "ChainBreak": "HitReact",
    "HalfWake": "PhaseTransition",
    "WingGust": "AreaAttack",
    "VeinSummon": "Summon",
    "BellboundRise": "PhaseTransition",
    "Greeting": "Roar",
    "Wake": "Enrage",
    "Rebind": "Stunned",
    "Slay": "Death",
    "HexVolley": "RangedAttack",
    "LeapSlam": "Jump",
    "Dig": "HeavyAttack",
    "RootEruption": "AreaAttack",
    "SpawnRootlings": "Summon",
}


def special_animation_pose(
    name: str,
    armature_obj: bpy.types.Object,
    archetype: str,
) -> Tuple[int, Dict[int, FramePose]]:
    base = SPECIAL_BASES.get(name, "PhaseTransition")
    end, frames = animation_pose(base, armature_obj, archetype)
    root = first_bone(armature_obj, ("Root",))
    body = first_bone(armature_obj, ("Body",))
    neck = first_bone(armature_obj, ("Neck",))
    head = first_bone(armature_obj, ("Head",))
    jaw = first_bone(armature_obj, ("Jaw",))
    emitter = first_bone(armature_obj, ("Emitter",))
    voice_ring = first_bone(armature_obj, ("VoiceRing",))
    river_jet = first_bone(armature_obj, ("RiverJet",))
    time_ring = first_bone(armature_obj, ("TimeRing",))
    mantle = first_bone(armature_obj, ("SnowMantle",))
    year_shells = bones_matching(armature_obj, "YearShell.")
    rain_bones = bones_matching(armature_obj, "Rain.")
    door_l = first_bone(armature_obj, ("CoreDoor.L",))
    door_r = first_bone(armature_obj, ("CoreDoor.R",))
    front_legs = [
        bone
        for bone in (
            first_bone(armature_obj, ("Leg.FL",)),
            first_bone(armature_obj, ("Leg.FR",)),
        )
        if bone
    ]
    front_shins = [
        bone
        for bone in (
            first_bone(armature_obj, ("Shin.FL",)),
            first_bone(armature_obj, ("Shin.FR",)),
        )
        if bone
    ]
    front_hooves = [
        bone
        for bone in (
            first_bone(armature_obj, ("Hoof.FL",)),
            first_bone(armature_obj, ("Hoof.FR",)),
        )
        if bone
    ]
    horns = bones_matching(armature_obj, "Horn.")
    chains = bones_matching(armature_obj, "Chain.")
    bells = bones_matching(armature_obj, "Bell.")
    wings = bones_matching(armature_obj, "Wing.")
    necks = bones_matching(armature_obj, "Neck.")
    tails = bones_matching(armature_obj, "Tail.")
    singers = [
        bone.name
        for bone in armature_obj.pose.bones
        if bone.name.startswith("Singer.") and bone.name.endswith("Body")
    ]

    if name == "PatrolScan":
        end = 64
        for frame, yaw, lift in (
            (1, -14, 0),
            (16, -24, 0.01),
            (32, 18, 0.03),
            (48, 28, 0.01),
            (64, -14, 0),
        ):
            pose_entry(frames, frame, head, rotation=(3, yaw, yaw * 0.12))
            pose_entry(frames, frame, neck, rotation=(-2, yaw * 0.35, -yaw * 0.08))
            pose_entry(frames, frame, body, location=(0, 0, lift))
            pose_entry(
                frames,
                frame,
                emitter,
                scale=((1.16 if frame in (32, 48) else 1.0),) * 3,
            )
    elif name == "Burrow":
        end = 40
        for frame, z, squash in (
            (1, 0, 1),
            (10, -0.12, 0.9),
            (22, -0.72, 0.68),
            (32, -0.72, 0.68),
            (40, 0, 1),
        ):
            pose_entry(
                frames, frame, root, location=(0, 0, z), scale=(1.08, 1.08, squash)
            )
            for tail_index, tail in enumerate(tails):
                pose_entry(
                    frames,
                    frame,
                    tail,
                    rotation=(
                        0,
                        0,
                        (tail_index + 1) * (18 if frame in (22, 32) else 0),
                    ),
                )
    elif name == "Charge":
        end = 28
        for frame, forward, tilt in (
            (1, 0, 0),
            (7, -0.08, 18),
            (18, -0.5, 26),
            (24, -0.68, 13),
            (28, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, forward, 0))
            pose_entry(frames, frame, body, rotation=(tilt * 0.35, 0, 0))
            pose_entry(frames, frame, neck, rotation=(tilt * 0.25, 0, 0))
            pose_entry(frames, frame, head, rotation=(tilt * 0.3, 0, 0))
            pose_entry(
                frames,
                frame,
                emitter,
                scale=((1.35 if frame in (18, 24) else 1.0),) * 3,
            )
    elif name == "PillarCrash":
        end = 42
        for frame, recoil, roll in (
            (1, 0, 0),
            (8, -14, 0),
            (15, 46, -11),
            (25, -18, 8),
            (34, 9, -4),
            (42, 0, 0),
        ):
            pose_entry(frames, frame, body, rotation=(recoil * 0.35, 0, roll))
            pose_entry(frames, frame, neck, rotation=(-recoil * 0.8, 0, -roll))
            pose_entry(frames, frame, head, rotation=(-recoil, 0, -roll * 1.4))
            pose_entry(frames, frame, root, location=(0, recoil * 0.003, 0))
            for index, horn in enumerate(horns):
                pose_entry(
                    frames,
                    frame,
                    horn,
                    rotation=(0, 0, (-1 if index == 0 else 1) * recoil * 0.55),
                )
    elif name == "HornBreak":
        end = 32
        for index, horn in enumerate(horns):
            pose_entry(frames, 1, horn, scale=(1, 1, 1))
            pose_entry(
                frames,
                13 + index * 5,
                horn,
                rotation=(0, 0, (-1 if index == 0 else 1) * 48),
                scale=(1, 1, 1),
            )
            pose_entry(
                frames,
                20 + index * 5,
                horn,
                rotation=(0, 0, (-1 if index == 0 else 1) * 95),
                location=((-0.16 if index == 0 else 0.16), -0.1, -0.12),
                scale=(0.18, 0.18, 0.18),
            )
            pose_entry(frames, 32, horn, scale=(0.18, 0.18, 0.18))
        pose_entry(frames, 12, emitter, scale=(1.0, 1.0, 1.0))
        pose_entry(frames, 24, emitter, scale=(1.55, 1.55, 1.55))
        pose_entry(frames, 32, emitter, scale=(1.2, 1.2, 1.2))
    elif name == "SunCoreBeam":
        end = 48
        for frame, door, pulse, recoil in (
            (1, 0, 1.0, 0),
            (14, 24, 1.35, 8),
            (26, 48, 2.2, 18),
            (34, 52, 0.65, -20),
            (48, 0, 1.0, 0),
        ):
            pose_entry(frames, frame, door_l, rotation=(0, -door, -door * 0.5))
            pose_entry(frames, frame, door_r, rotation=(0, door, door * 0.5))
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            pose_entry(frames, frame, body, rotation=(recoil * 0.3, 0, 0))
            pose_entry(frames, frame, neck, rotation=(-recoil * 0.45, 0, 0))
            pose_entry(frames, frame, head, rotation=(-recoil * 0.3, 0, 0))
    elif name == "HoofQuake":
        end = 46
        for frame, lift, slam, pulse in (
            (1, 0, 0, 1.0),
            (14, 0.14, -50, 1.2),
            (23, -0.09, 42, 2.0),
            (34, -0.02, 15, 1.3),
            (46, 0, 0, 1.0),
        ):
            pose_entry(frames, frame, root, location=(0, 0, lift))
            pose_entry(frames, frame, body, rotation=(-slam * 0.3, 0, 0))
            pose_entry(frames, frame, head, rotation=(slam * 0.28, 0, 0))
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            for leg in front_legs:
                pose_entry(frames, frame, leg, rotation=(slam, 0, 0))
            for shin in front_shins:
                pose_entry(frames, frame, shin, rotation=(-slam * 0.8, 0, 0))
            for hoof in front_hooves:
                pose_entry(frames, frame, hoof, rotation=(slam * 0.25, 0, 0))
    elif name == "Unbalanced":
        end = 50
        for frame, roll in ((1, 0), (12, -16), (23, 19), (35, -12), (50, 0)):
            pose_entry(frames, frame, body, rotation=(8, 0, roll))
            pose_entry(frames, frame, head, rotation=(20, 0, -roll * 1.3))
            pose_entry(frames, frame, door_l, rotation=(0, -28, -14))
            pose_entry(frames, frame, door_r, rotation=(0, 28, 14))
            pose_entry(frames, frame, emitter, scale=(1.45, 1.45, 1.45))
    elif name == "CoreRupture":
        end = 88
        for frame, pulse, door, horn_scale in (
            (1, 1.0, 0, 1.0),
            (20, 1.35, 24, 1.0),
            (38, 2.6, 58, 0.8),
            (50, 0.18, 76, 0.2),
            (70, 0.05, 82, 0.08),
            (88, 0.05, 82, 0.08),
        ):
            pose_entry(frames, frame, emitter, scale=(pulse, pulse, pulse))
            pose_entry(frames, frame, door_l, rotation=(0, -door, -door * 0.7))
            pose_entry(frames, frame, door_r, rotation=(0, door, door * 0.7))
            for horn in horns:
                pose_entry(frames, frame, horn, scale=(horn_scale,) * 3)
    elif name == "HearthFails":
        end = 64
        for frame, pulse, droop in (
            (1, 1.0, 0),
            (16, 1.35, 8),
            (32, 0.35, 18),
            (48, 1.55, 10),
            (64, 1.0, 0),
        ):
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
            pose_entry(frames, frame, body, rotation=(droop * 0.25, 0, 0))
            pose_entry(frames, frame, head, rotation=(droop * 0.5, 0, 0))
            pose_entry(frames, frame, mantle, scale=(1, 1, 1 - droop * 0.004))
            pose_entry(frames, frame, time_ring, rotation=(0, frame * 3.5, 0))
    elif name == "TimeLoop":
        end = 72 if archetype == "failed_year" else 48
        sequence = (
            (
                (1, 0, 1),
                (18, 90, 0.84),
                (36, 180, 0.55),
                (54, 270, 0.84),
                (72, 360, 1),
            )
            if archetype == "failed_year"
            else (
                (1, 0, 1),
                (12, 90, 0.84),
                (24, 180, 0.55),
                (36, 270, 0.84),
                (48, 360, 1),
            )
        )
        for frame, spin, scale_value in sequence:
            if archetype == "failed_year":
                pose_entry(
                    frames,
                    frame,
                    time_ring,
                    rotation=(0, spin, 0),
                    scale=(2 - scale_value * 0.7,) * 3,
                )
                pose_entry(frames, frame, root, scale=(scale_value,) * 3)
                for index, shell in enumerate(year_shells):
                    pose_entry(
                        frames,
                        frame,
                        shell,
                        rotation=(0, (1 if index else -1) * spin * 0.08, 0),
                    )
            else:
                pose_entry(
                    frames, frame, root, rotation=(0, spin, 0), scale=(scale_value,) * 3
                )
            pose_entry(frames, frame, emitter, scale=(2 - scale_value,) * 3)
    elif name == "YearBreaks":
        end = 76
        for frame, spread, mantle_scale, pulse in (
            (1, 0, 1.0, 1.0),
            (18, 18, 0.92, 1.25),
            (38, 44, 0.72, 1.8),
            (58, 62, 0.45, 1.35),
            (76, 48, 0.32, 1.2),
        ):
            for index, shell in enumerate(year_shells):
                direction = -1 if index == 0 else 1
                pose_entry(
                    frames,
                    frame,
                    shell,
                    rotation=(0, direction * spread, direction * spread * 0.55),
                )
            pose_entry(frames, frame, mantle, scale=(mantle_scale,) * 3)
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
            for index, rain in enumerate(rain_bones):
                pose_entry(
                    frames,
                    frame,
                    rain,
                    scale=(1, 1, 1 + spread / 25),
                    rotation=(0, 0, (index * 2 - 1) * spread * 0.18),
                )
    elif name == "Shatter":
        end = 58 if archetype == "failed_year" else 44
        for frame, pulse in (
            ((1, 1), (15, 1.08), (30, 1.28), (43, 0.72), (58, 1))
            if archetype == "failed_year"
            else ((1, 1), (12, 1.08), (22, 1.24), (30, 0.82), (44, 1))
        ):
            pose_entry(frames, frame, body, scale=(pulse, pulse, pulse))
            pose_entry(frames, frame, emitter, scale=(2.1 - pulse * 0.5,) * 3)
            if archetype == "failed_year":
                for index, shell in enumerate(year_shells):
                    direction = -1 if index == 0 else 1
                    pose_entry(
                        frames,
                        frame,
                        shell,
                        rotation=(
                            0,
                            direction * (pulse - 1) * 120,
                            direction * (pulse - 1) * 85,
                        ),
                        scale=(pulse,) * 3,
                    )
    elif name == "Rainfall":
        end = 72
        for frame, length, sway in (
            (1, 1, 0),
            (18, 1.5, -8),
            (38, 2.4, 10),
            (56, 1.8, -6),
            (72, 1, 0),
        ):
            for index, rain in enumerate(rain_bones):
                pose_entry(
                    frames,
                    frame,
                    rain,
                    scale=(1, 1, length),
                    rotation=(0, 0, sway * (index * 2 - 1)),
                )
            pose_entry(frames, frame, emitter, scale=(1 + (length - 1) * 0.4,) * 3)
    elif name == "MeltDeath":
        end = 116
        for frame, melt, pulse in (
            (1, 1, 1),
            (28, 0.88, 1.3),
            (58, 0.58, 1.8),
            (88, 0.22, 0.5),
            (116, 0.08, 0.1),
        ):
            pose_entry(
                frames,
                frame,
                root,
                scale=(1, 1, melt),
                location=(0, 0, -(1 - melt) * 0.35),
            )
            pose_entry(frames, frame, mantle, scale=(melt,) * 3)
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
            for index, rain in enumerate(rain_bones):
                pose_entry(
                    frames,
                    frame,
                    rain,
                    scale=(1, 1, 1 + (1 - melt) * 3),
                    rotation=(0, 0, (index * 2 - 1) * (1 - melt) * 14),
                )
    elif name == "BellBreak":
        end = 34
        pose_entry(frames, 1, emitter, scale=(1, 1, 1))
        pose_entry(frames, 14, emitter, rotation=(45, 0, 35), scale=(1.2, 1.2, 1.2))
        pose_entry(
            frames,
            22,
            emitter,
            rotation=(95, 20, 70),
            location=(0.1, -0.1, -0.1),
            scale=(0.42, 0.42, 0.42),
        )
        pose_entry(frames, 34, emitter, scale=(0.42, 0.42, 0.42))
    elif name in ("Chant", "HarmonyBreak"):
        end = 48
        for index, singer in enumerate(singers):
            phase = -1 if index % 2 == 0 else 1
            pose_entry(frames, 1, singer, rotation=(0, 0, 0))
            pose_entry(
                frames,
                18,
                singer,
                rotation=(-8, 0, phase * 13),
                location=(0, 0, 0.08 + index * 0.02),
            )
            pose_entry(
                frames,
                32,
                singer,
                rotation=(10 if name == "HarmonyBreak" else -8, 0, -phase * 13),
                location=(0, 0, -0.05 if name == "HarmonyBreak" else 0.08),
            )
            pose_entry(frames, 48, singer, rotation=(0, 0, 0), location=(0, 0, 0))
    elif name == "Mimic":
        end = 36
        for frame, scale_value, offset in (
            (1, 1, 0),
            (12, 0.72, -0.12),
            (23, 1.24, 0.16),
            (36, 1, 0),
        ):
            pose_entry(
                frames, frame, root, scale=(scale_value,) * 3, location=(offset, 0, 0)
            )
            pose_entry(frames, frame, emitter, scale=(2 - scale_value * 0.5,) * 3)
    elif name == "Teleport":
        end = 30
        for frame, scale_value, x in (
            (1, 1, 0),
            (10, 0.05, -0.1),
            (16, 0.05, 0.28),
            (24, 1.12, 0.28),
            (30, 1, 0),
        ):
            pose_entry(
                frames, frame, root, scale=(scale_value,) * 3, location=(x, 0, 0)
            )
    elif name == "Yield":
        end = 52
        for frame, tilt, z in (
            (1, 0, 0),
            (15, 18, -0.05),
            (30, 33, -0.14),
            (52, 33, -0.14),
        ):
            pose_entry(frames, frame, body, rotation=(tilt, 0, 0), location=(0, 0, z))
            pose_entry(frames, frame, head, rotation=(-tilt * 0.6, 0, 0))
            for wing in wings:
                pose_entry(
                    frames, frame, wing, rotation=(0, -22 if frame >= 30 else 0, 0)
                )
    elif name in ("HalfWake", "BellboundRise"):
        end = 108
        multiplier = 0.72 if name == "HalfWake" else 1.0
        for frame, rise, spread in (
            (1, 0, 0),
            (26, 12, 25),
            (54, 25, 55),
            (82, 38, 86),
            (108, 30, 68),
        ):
            for index, neck_part in enumerate(necks):
                pose_entry(
                    frames,
                    frame,
                    neck_part,
                    rotation=(-rise * multiplier * (0.25 + index * 0.12), 0, 0),
                )
            pose_entry(frames, frame, head, rotation=(-rise * multiplier * 0.35, 0, 0))
            pose_entry(frames, frame, body, rotation=(-rise * multiplier * 0.12, 0, 0))
            for wing in wings:
                side = -1 if ".L" in wing else 1
                segment = 0 if wing.endswith(".L") or wing.endswith(".R") else 1
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(0, side * spread * multiplier * (1 - segment * 0.2), 0),
                )
            pose_entry(frames, frame, emitter, scale=(1 + rise / 45,) * 3)
    elif name == "SoundCloud":
        end = 76
        for frame, ring_scale, throat_scale, recoil in (
            (1, 0.02, 1.0, 0),
            (18, 1.35, 1.25, -6),
            (38, 2.4, 1.55, -14),
            (56, 3.2, 0.75, 16),
            (76, 0.02, 1.0, 0),
        ):
            pose_entry(frames, frame, voice_ring, scale=(ring_scale,) * 3)
            pose_entry(frames, frame, emitter, scale=(throat_scale,) * 3)
            for index, neck_part in enumerate(necks):
                pose_entry(
                    frames,
                    frame,
                    neck_part,
                    rotation=(recoil * (0.12 + index * 0.06), 0, 0),
                )
            pose_entry(frames, frame, head, rotation=(recoil * 0.22, 0, 0))
    elif name == "RiverBreath":
        end = 72
        for frame, charge, recoil, ring_scale, jet_length in (
            (1, 1.0, 0, 0.02, 0.02),
            (18, 1.35, -8, 0.45, 0.35),
            (36, 2.1, -18, 1.15, 5.5),
            (48, 0.62, 22, 1.7, 8.0),
            (72, 1.0, 0, 0.02, 0.02),
        ):
            pose_entry(frames, frame, emitter, scale=(charge,) * 3)
            pose_entry(frames, frame, voice_ring, scale=(ring_scale,) * 3)
            pose_entry(
                frames,
                frame,
                river_jet,
                scale=(
                    0.72 if jet_length > 1 else jet_length,
                    0.72 if jet_length > 1 else jet_length,
                    jet_length,
                ),
            )
            for index, neck_part in enumerate(necks):
                pose_entry(
                    frames,
                    frame,
                    neck_part,
                    rotation=(recoil * (0.14 + index * 0.06), 0, 0),
                )
            pose_entry(frames, frame, head, rotation=(recoil * 0.24, 0, 0))
            pose_entry(
                frames, frame, jaw, rotation=(28 if frame in (36, 48) else 0, 0, 0)
            )
    elif name == "Greeting":
        end = 96
        for frame, lower, yaw, pulse in (
            (1, 0, 0, 1),
            (24, 12, -5, 1.15),
            (50, 24, 7, 1.35),
            (74, 18, 0, 1.2),
            (96, 8, 0, 1),
        ):
            for index, neck_part in enumerate(necks):
                pose_entry(
                    frames,
                    frame,
                    neck_part,
                    rotation=(
                        lower * (0.18 + index * 0.08),
                        yaw * (0.2 + index * 0.1),
                        0,
                    ),
                )
            pose_entry(frames, frame, head, rotation=(lower * 0.28, yaw, 0))
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
            pose_entry(frames, frame, body, rotation=(lower * 0.05, 0, 0))
    elif name == "ChainBreak":
        end = 72
        for index, chain in enumerate(chains):
            direction = -1 if index % 2 == 0 else 1
            pose_entry(frames, 1, chain, rotation=(0, 0, 0), scale=(1, 1, 1))
            break_frame = 18 + index * 10
            pose_entry(
                frames,
                break_frame,
                chain,
                rotation=(25, direction * 40, direction * 25),
            )
            pose_entry(
                frames,
                break_frame + 8,
                chain,
                rotation=(70, direction * 80, direction * 65),
                location=(direction * 0.18, 0.1, -0.1),
                scale=(0.18, 0.18, 0.18),
            )
            pose_entry(frames, 72, chain, scale=(0.18, 0.18, 0.18))
            if index < len(bells):
                pose_entry(frames, 1, bells[index], scale=(1, 1, 1))
                pose_entry(
                    frames,
                    break_frame + 8,
                    bells[index],
                    rotation=(90, direction * 55, direction * 80),
                    location=(direction * 0.16, 0.12, -0.18),
                    scale=(0.25, 0.25, 0.25),
                )
                pose_entry(frames, 72, bells[index], scale=(0.25, 0.25, 0.25))
    elif name == "WingGust":
        end = 72 if archetype == "thaedryn" else 34
        sequence = (
            (
                (1, 0),
                (18, 52),
                (36, 96),
                (52, -30),
                (72, 0),
            )
            if archetype == "thaedryn"
            else ((1, 0), (10, 55), (18, 92), (25, -28), (34, 0))
        )
        for frame, spread in sequence:
            for wing in wings:
                side = -1 if ".L" in wing else 1
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(0, side * spread, side * spread * 0.12),
                )
            pose_entry(frames, frame, body, rotation=(-spread * 0.12, 0, 0))
    elif name == "Rebind":
        end = 120
        for frame, z, chain_scale, settle in (
            (1, 0, 0.18, 0),
            (30, 0.04, 0.45, 10),
            (62, -0.05, 0.72, 20),
            (92, -0.12, 1.0, 32),
            (120, -0.12, 1.0, 38),
        ):
            pose_entry(frames, frame, root, location=(0, 0, z))
            for index, chain in enumerate(chains):
                pose_entry(
                    frames,
                    frame,
                    chain,
                    scale=(chain_scale,) * 3,
                    rotation=(-settle * 0.2, 0, (index * 2 - 3) * settle * 0.08),
                )
                if index < len(bells):
                    pose_entry(
                        frames,
                        frame,
                        bells[index],
                        scale=(chain_scale,) * 3,
                        rotation=(settle * 0.2, 0, (index * 2 - 3) * settle * 0.1),
                    )
            for index, neck_part in enumerate(necks):
                pose_entry(
                    frames,
                    frame,
                    neck_part,
                    rotation=(settle * (0.12 + index * 0.05), 0, 0),
                )
            pose_entry(frames, frame, head, rotation=(settle * 0.2, 0, 0))
            pose_entry(frames, frame, emitter, scale=(1.4 - chain_scale * 0.4,) * 3)
    elif name == "Wake":
        end = 140
        for frame, lift, spread, rise in (
            (1, 0, 0, 0),
            (32, 0.05, 28, 14),
            (68, 0.2, 62, 30),
            (104, 0.55, 96, 42),
            (140, 0.9, 72, 34),
        ):
            pose_entry(frames, frame, root, location=(0, 0, lift))
            for index, neck_part in enumerate(necks):
                pose_entry(
                    frames,
                    frame,
                    neck_part,
                    rotation=(-rise * (0.22 + index * 0.1), 0, 0),
                )
            pose_entry(frames, frame, head, rotation=(-rise * 0.32, 0, 0))
            for wing in wings:
                side = -1 if ".L" in wing else 1
                pose_entry(
                    frames,
                    frame,
                    wing,
                    rotation=(0, side * spread, side * spread * 0.1),
                )
            for index, chain in enumerate(chains):
                pose_entry(
                    frames,
                    frame,
                    chain,
                    scale=((1 if frame < 68 else 0.12),) * 3,
                    rotation=(0, 0, (index * 2 - 3) * spread * 0.3),
                )
                if index < len(bells):
                    pose_entry(
                        frames,
                        frame,
                        bells[index],
                        scale=((1 if frame < 68 else 0.18),) * 3,
                    )
            pose_entry(frames, frame, emitter, scale=(1 + rise / 55,) * 3)
    elif name == "LeapSlam":
        end = 42
        for frame, z, pitch in (
            (1, 0, 0),
            (10, -0.08, 22),
            (20, 0.58, -18),
            (29, -0.15, 52),
            (42, 0, 0),
        ):
            pose_entry(frames, frame, root, location=(0, 0, z))
            pose_entry(frames, frame, body, rotation=(pitch, 0, 0))
    elif name == "Dig":
        end = 38
        for frame, pitch, z in (
            (1, 0, 0),
            (9, -45, 0),
            (18, 78, -0.14),
            (27, 45, -0.2),
            (38, 0, 0),
        ):
            pose_entry(
                frames, frame, body, rotation=(pitch * 0.4, 0, 0), location=(0, 0, z)
            )
    elif name in ("RootEruption", "SpawnRootlings"):
        end = 44
        for frame, z, pulse in (
            (1, 0, 1),
            (15, -0.08, 1.05),
            (25, 0.18, 1.28),
            (35, 0.05, 1.12),
            (44, 0, 1),
        ):
            pose_entry(frames, frame, root, location=(0, 0, z))
            pose_entry(frames, frame, emitter, scale=(pulse,) * 3)
            pose_entry(
                frames,
                frame,
                body,
                rotation=(-12 if frame == 15 else 8 if frame == 25 else 0, 0, 0),
            )
    return end, frames


def reset_pose(armature_obj: bpy.types.Object) -> None:
    for bone in armature_obj.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.location = (0, 0, 0)
        bone.rotation_euler = (0, 0, 0)
        bone.scale = (1, 1, 1)


def _add_frame_transform(
    frames: Dict[int, FramePose],
    frame: int,
    bone: Optional[str],
    *,
    location: Optional[Vec3] = None,
    rotation: Optional[Vec3] = None,
    scale: Optional[Vec3] = None,
) -> None:
    """Layer a subtle polish transform over an already-authored pose."""
    if not bone:
        return
    entry = frames.setdefault(frame, {}).setdefault(bone, {})
    if location is not None:
        current = entry.get("location", (0.0, 0.0, 0.0))
        entry["location"] = tuple(current[i] + location[i] for i in range(3))
    if rotation is not None:
        current = entry.get("rotation", (0.0, 0.0, 0.0))
        entry["rotation"] = tuple(current[i] + rotation[i] for i in range(3))
    if scale is not None:
        current = entry.get("scale", (1.0, 1.0, 1.0))
        entry["scale"] = tuple(current[i] * scale[i] for i in range(3))


def polish_boss_action_frames(
    definition: BossDefinition,
    armature_obj: bpy.types.Object,
    name: str,
    frame_end: int,
    frames: Dict[int, FramePose],
) -> Dict[int, FramePose]:
    """Apply a rig-aware final animation pass without replacing bespoke motion.

    The source clips already encode each mechanic. This pass gives every boss
    the production qualities that should be consistent across the roster:
    grounded root motion, head counter-motion, delayed appendages, readable
    anticipation, and exact loop closure for locomotion.
    """

    root = first_bone(armature_obj, ("Root",))
    body = first_bone(
        armature_obj,
        ("Body", "Chest", "Torso", "Singer.B.Body", "Singer.A.Body"),
    )
    head = first_bone(
        armature_obj,
        ("Head", "Neck", "Singer.A.Head", "Singer.B.Head", "Singer.C.Head"),
    )
    names = [bone.name for bone in armature_obj.pose.bones]

    def matching(*tokens: str) -> List[str]:
        return [
            bone_name
            for bone_name in names
            if bone_name not in {root, body, head}
            and any(token.lower() in bone_name.lower() for token in tokens)
        ]

    tails = matching("tail", "chain", "cloak", "strip", "skirt")
    wings = matching("wing", "canopy", "branch", "roofbeam")
    ornaments = matching(
        "crown",
        "bell",
        "ring",
        "helix",
        "spore",
        "shard",
        "horn",
        "carapace",
        "mantle",
        "emitter",
        "core",
        "guard",
    )
    seed = sum((index + 1) * ord(char) for index, char in enumerate(definition.slug))
    side = -1.0 if seed % 2 else 1.0
    base_name = SPECIAL_BASES.get(name, name)
    keyed_frames = sorted(frames)
    if 1 not in frames:
        frames[1] = {}
    if frame_end not in frames:
        frames[frame_end] = {}
    keyed_frames = sorted(frames)

    looping = base_name in {"Idle", "Walk", "Run", "Sprint", "Fly"}
    locomotion = base_name in {"Walk", "Run", "Sprint", "Fly"}
    physical_attack = base_name in {"Attack", "HeavyAttack", "Jump"}
    spell_attack = base_name in {
        "RangedAttack",
        "AreaAttack",
        "Summon",
        "Roar",
        "PhaseTransition",
        "Enrage",
    }
    reaction = base_name in {
        "HitReact",
        "Stunned",
        "BossStaggerLight",
        "BossStaggerMedium",
        "BossStaggerHeavy",
    }

    for frame in keyed_frames:
        t = (frame - 1) / max(1, frame_end - 1)
        phase = math.tau * t
        if looping:
            sway = math.sin(phase)
            lift = 0.5 - 0.5 * math.cos(phase * (2 if locomotion else 1))
            pace = 1.0 if base_name == "Idle" else 1.35 if base_name == "Walk" else 1.8
            _add_frame_transform(
                frames,
                frame,
                root,
                location=(side * sway * 0.006 * pace, 0, lift * 0.012 * pace),
                rotation=(0, sway * 0.55 * pace, side * sway * 0.45 * pace),
            )
            _add_frame_transform(
                frames,
                frame,
                body,
                rotation=(2.2 * pace if locomotion else math.sin(phase * 2) * 1.2,
                          -sway * 1.25 * pace, side * sway * 1.1 * pace),
                scale=(1.0 + lift * 0.008, 1.0 - lift * 0.004, 1.0 + lift * 0.012),
            )
            _add_frame_transform(
                frames,
                frame,
                head,
                rotation=(-1.2 * pace if locomotion else -math.sin(phase * 2) * 0.8,
                          sway * 1.9 * pace, -side * sway * 1.45 * pace),
            )
            for index, bone in enumerate(tails):
                lag = math.sin(phase - 0.45 - index * 0.22)
                _add_frame_transform(
                    frames,
                    frame,
                    bone,
                    rotation=(0, lag * 1.2 * pace, -side * lag * (2.4 + index * 0.35) * pace),
                )
            for index, bone in enumerate(wings):
                wing_side = -1.0 if index % 2 == 0 else 1.0
                _add_frame_transform(
                    frames,
                    frame,
                    bone,
                    rotation=(lift * 1.8 * pace, wing_side * sway * 1.6 * pace,
                              wing_side * lift * 2.0 * pace),
                )
            for index, bone in enumerate(ornaments):
                lag = math.sin(phase - 0.3 - (index % 5) * 0.16)
                _add_frame_transform(
                    frames,
                    frame,
                    bone,
                    rotation=(lag * 0.6, -lag * 0.8, side * lag * 1.15),
                    scale=(1.0 + lift * 0.006,) * 3,
                )
            continue

        envelope = math.sin(math.pi * t)
        follow = math.sin(math.pi * min(1.0, max(0.0, (t - 0.12) / 0.88)))
        if physical_attack:
            windup = -math.sin(math.pi * min(1.0, t / 0.48)) if t <= 0.48 else 0.0
            strike = math.sin(math.pi * min(1.0, max(0.0, (t - 0.32) / 0.42)))
            twist = side * (-4.5 * max(0.0, -windup) + 7.5 * strike)
            _add_frame_transform(
                frames,
                frame,
                root,
                location=(side * envelope * 0.008, strike * -0.018, -strike * 0.012),
                rotation=(strike * 1.3, twist * 0.18, twist * 0.24),
            )
            _add_frame_transform(frames, frame, body, rotation=(-strike * 4.2, twist, twist * 0.35))
            _add_frame_transform(frames, frame, head, rotation=(strike * 3.1, -twist * 0.5, -twist * 0.42))
        elif spell_attack:
            charge = math.sin(math.pi * min(1.0, t / 0.72))
            release = math.sin(math.pi * min(1.0, max(0.0, (t - 0.48) / 0.42)))
            _add_frame_transform(
                frames,
                frame,
                root,
                location=(0, release * -0.008, charge * 0.012),
                rotation=(-release * 1.2, side * charge * 0.7, side * charge * 0.8),
            )
            _add_frame_transform(
                frames,
                frame,
                body,
                rotation=(-charge * 3.0 + release * 4.5, side * charge * 2.1, side * release * 1.6),
                scale=(1.0 + charge * 0.012, 1.0 + charge * 0.012, 1.0 - charge * 0.008),
            )
            _add_frame_transform(frames, frame, head, rotation=(charge * 2.4 - release * 3.4, -side * charge * 2.6, 0))
        elif reaction:
            recoil = math.sin(math.pi * t)
            _add_frame_transform(frames, frame, root, location=(side * recoil * 0.012, 0, -recoil * 0.01))
            _add_frame_transform(frames, frame, body, rotation=(-recoil * 2.5, 0, side * recoil * 3.2))
            _add_frame_transform(frames, frame, head, rotation=(recoil * 2.8, 0, -side * recoil * 4.0))
        elif base_name == "Death":
            collapse = t * t
            _add_frame_transform(frames, frame, root, location=(side * collapse * 0.012, 0, -collapse * 0.018))
            _add_frame_transform(frames, frame, head, rotation=(collapse * 5.0, 0, side * collapse * 5.5))

        secondary_amount = envelope if base_name != "Death" else t
        for index, bone in enumerate(tails):
            lag = secondary_amount * (1.0 + index * 0.1)
            _add_frame_transform(
                frames,
                frame,
                bone,
                rotation=(-follow * 0.8, side * follow * 1.1, -side * lag * (3.0 + index * 0.35)),
            )
        for index, bone in enumerate(wings):
            wing_side = -1.0 if index % 2 == 0 else 1.0
            _add_frame_transform(
                frames,
                frame,
                bone,
                rotation=(follow * 1.8, wing_side * follow * 3.0, wing_side * secondary_amount * 3.6),
            )
        for index, bone in enumerate(ornaments):
            lag = secondary_amount * math.sin(
                math.pi * min(1.0, max(0.0, t - index % 4 * 0.025))
            )
            _add_frame_transform(
                frames,
                frame,
                bone,
                rotation=(lag * 0.8, -side * lag * 1.1, side * lag * 1.6),
                scale=(1.0 + secondary_amount * 0.008,) * 3,
            )

    # Looping clips must return to precisely the same authored pose. Copying
    # frame one after the additive pass removes the tiny end-frame hitch that
    # becomes very obvious on giant bosses and long tails.
    if looping:
        frames[frame_end] = {
            bone: {channel: tuple(value) for channel, value in transform.items()}
            for bone, transform in frames[1].items()
        }
    return frames


def create_action(
    definition: BossDefinition,
    armature_obj: bpy.types.Object,
    name: str,
) -> bpy.types.Action:
    reset_pose(armature_obj)
    if name in BOSS_STAGGER_CLIPS:
        frame_end, frames = boss_stagger_animation_pose(
            definition, armature_obj, name
        )
    elif name in definition.special_clips:
        frame_end, frames = special_animation_pose(
            name, armature_obj, definition.archetype
        )
    else:
        frame_end, frames = animation_pose(name, armature_obj, definition.archetype)
    frames = polish_boss_action_frames(
        definition,
        armature_obj,
        name,
        frame_end,
        frames,
    )
    if definition.archetype == "thaedryn":
        # These meshes are gameplay telegraphs, not permanent facial parts.
        # Keep them collapsed in locomotion and non-ranged actions; their
        # bespoke clips author explicit visible scales above.
        for transient_name in ("VoiceRing", "RiverJet"):
            transient = first_bone(armature_obj, (transient_name,))
            if not transient:
                continue
            for frame in (1, frame_end):
                transform = frames.setdefault(frame, {}).setdefault(transient, {})
                transform.setdefault("scale", (0.02, 0.02, 0.02))
    # Blender derives an Action's exported time span per animated channel.
    # Keying the whole rig at both endpoints prevents an appendage's first or
    # last authored value from being extrapolated through empty anticipation
    # and recovery frames. Existing bespoke endpoint transforms win.
    for bone in armature_obj.pose.bones:
        frames.setdefault(1, {}).setdefault(bone.name, {})
        frames.setdefault(frame_end, {}).setdefault(bone.name, {})
    action = bpy.data.actions.new(name=name)
    action.use_fake_user = True
    action["harthmereAnimationPolishVersion"] = BOSS_ANIMATION_POLISH_VERSION
    action["harthmereAuthoredFps"] = FPS
    action["harthmereClipRole"] = SPECIAL_BASES.get(name, name)
    if name in BOSS_STAGGER_CLIPS:
        action["harthmereProfile"] = f"boss-{name.removeprefix('BossStagger').lower()}-stagger-v1"
        action["harthmereFamily"] = "boss"
        action["harthmereSeverity"] = name.removeprefix("BossStagger").lower()
        action["harthmereAuthoredFps"] = FPS
        action["harthmereRuntimeExecutionEnabled"] = False
    armature_obj.animation_data_create()
    armature_obj.animation_data.action = action
    for frame in sorted(frames):
        reset_pose(armature_obj)
        for bone_name, transform in frames[frame].items():
            bone = armature_obj.pose.bones.get(bone_name)
            if not bone:
                continue
            if "location" in transform:
                bone.location = transform["location"]
            if "rotation" in transform:
                bone.rotation_euler = tuple(
                    math.radians(value) for value in transform["rotation"]
                )
            if "scale" in transform:
                bone.scale = transform["scale"]
            bone.keyframe_insert("location", frame=frame, group=bone_name)
            bone.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
            bone.keyframe_insert("scale", frame=frame, group=bone_name)
    action.frame_start = 1
    action.frame_end = frame_end
    # Blender 5 uses slotted Actions and no longer exposes Action.fcurves.
    # Pose-bone keyframe insertion still creates exportable channels; the GLTF
    # exporter samples them at the scene frame rate, which is what the runtime
    # mixer expects for these deliberately crisp voxel motions.
    reset_pose(armature_obj)
    return action


def clear_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data_collection in (
        bpy.data.meshes,
        bpy.data.armatures,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(data_collection):
            if block.users == 0:
                data_collection.remove(block)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def export_glb(
    definition: BossDefinition,
    mesh_obj: bpy.types.Object,
    armature_obj: bpy.types.Object,
    output: Path,
    world_size: Optional[Vec3] = None,
) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    armature_obj.select_set(True)
    bpy.context.view_layer.objects.active = armature_obj
    if world_size and definition.archetype in ASPECT_PRESERVED_ARCHETYPES:
        uniform_scale = world_size[1] / BASE_BOX[2]
        armature_obj.scale = (uniform_scale,) * 3
    else:
        armature_obj.scale = (
            (
                world_size[0] / BASE_BOX[0],
                world_size[2] / BASE_BOX[1],
                world_size[1] / BASE_BOX[2],
            )
            if world_size
            else (1, 1, 1)
        )
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_materials="EXPORT",
        export_yup=True,
        export_skins=True,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    armature_obj.scale = (1, 1, 1)


def point_camera(camera_obj: bpy.types.Object, target: Vec3) -> None:
    direction = Vector(target) - camera_obj.location
    camera_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(
    name: str, location: Vec3, energy: float, color: Vec3, size: float
) -> bpy.types.Object:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_camera(obj, (0, 0, 1.0))
    return obj


def render_preview(
    definition: BossDefinition,
    armature_obj: bpy.types.Object,
    action: bpy.types.Action,
    output: Path,
) -> None:
    # Convert the normalized runtime box back to the actual lore scale for QA.
    game_width, game_height, game_depth = definition.world_size
    if definition.archetype in ASPECT_PRESERVED_ARCHETYPES:
        armature_obj.scale = (game_height / BASE_BOX[2],) * 3
    else:
        armature_obj.scale = (
            game_width / BASE_BOX[0],
            game_depth / BASE_BOX[1],
            game_height / BASE_BOX[2],
        )
    armature_obj.animation_data.action = action
    bpy.context.scene.frame_set(definition.preview_frame)

    maximum = max(game_width, game_height, game_depth)
    camera_data = bpy.data.cameras.new("HeroCamera")
    camera_data.lens = 62
    camera_obj = bpy.data.objects.new("HeroCamera", camera_data)
    bpy.context.collection.objects.link(camera_obj)
    if definition.archetype == "thaedryn":
        camera_obj.location = (
            maximum * 2.05,
            -maximum * 0.75,
            game_height * 1.05,
        )
    elif definition.archetype == "breach_helix":
        camera_obj.location = (
            maximum * 1.3,
            -maximum * 2.9,
            game_height * 1.0,
        )
    else:
        camera_obj.location = (maximum * 0.95, -maximum * 2.65, game_height * 0.98)
    point_camera(camera_obj, (0, 0, game_height * 0.46))
    bpy.context.scene.camera = camera_obj

    bpy.ops.mesh.primitive_plane_add(size=maximum * 6, location=(0, 0, -0.025))
    ground = bpy.context.object
    ground.name = "Preview Ground"
    ground_mat = bpy.data.materials.new("Preview Ground")
    ground_mat.diffuse_color = (0.018, 0.022, 0.028, 1)
    ground_mat.use_nodes = True
    ground_bsdf = ground_mat.node_tree.nodes.get("Principled BSDF")
    if ground_bsdf:
        ground_bsdf.inputs["Base Color"].default_value = (0.012, 0.016, 0.022, 1)
        ground_bsdf.inputs["Roughness"].default_value = 0.92
    ground.data.materials.append(ground_mat)

    add_area_light(
        "Key",
        (maximum * 0.6, -maximum * 0.8, game_height * 1.25),
        340 * maximum,
        (1.0, 0.72, 0.48),
        maximum * 0.75,
    )
    add_area_light(
        "Fill",
        (-maximum * 0.9, -maximum * 0.2, game_height * 0.8),
        170 * maximum,
        (0.28, 0.48, 1.0),
        maximum * 0.9,
    )
    add_area_light(
        "Rim",
        (0, maximum * 0.8, game_height * 1.05),
        280 * maximum,
        (0.38, 0.82, 1.0),
        maximum * 0.65,
    )

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.filepath = str(output)
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    scene.world.color = (0.004, 0.006, 0.012)
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.7
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    armature_obj.scale = (1, 1, 1)


def render_boss_action_stills(
    definition: BossDefinition,
    armature_obj: bpy.types.Object,
    actions: Mapping[str, bpy.types.Action],
    output_dir: Path,
) -> None:
    action_frames_by_slug: Mapping[str, Sequence[Tuple[str, int]]] = {
        "gilded_bull": (
            ("PatrolScan", 32),
            ("Charge", 18),
            ("HeavyAttack", 18),
            ("SunCoreBeam", 26),
            ("HoofQuake", 23),
            ("HornBreak", 25),
            ("Unbalanced", 23),
            ("CoreRupture", 50),
        ),
        "muck_scarred_helix": (
            ("BreachStalk", 14),
            ("MaulCrush", 20),
            ("SiphonVolley", 23),
            ("HelixPulse", 25),
            ("SporeCast", 28),
            ("Burrow", 22),
            ("Rupture", 25),
            ("BreachCollapse", 48),
        ),
        "ninth_winter": (
            ("HearthFails", 32),
            ("Blizzard", 30),
            ("TimeLoop", 18),
            ("RoofbeamSweep", 28),
            ("YearBreaks", 58),
            ("Shatter", 30),
            ("Rainfall", 38),
            ("MeltDeath", 88),
        ),
        "thaedryn_bellbound": (
            ("SleeperSweep", 32),
            ("SoundCloud", 38),
            ("RiverBreath", 48),
            ("ChainBreak", 56),
            ("HalfWake", 82),
            ("WingGust", 36),
            ("BellboundRise", 82),
            ("Rebind", 92),
            ("Wake", 104),
            ("Slay", 84),
        ),
    }
    action_frames = (
        *action_frames_by_slug.get(definition.slug, ()),
        ("BossStaggerLight", 4),
        ("BossStaggerMedium", 18),
        ("BossStaggerHeavy", 25),
    )
    uniform_scale = definition.world_size[1] / BASE_BOX[2]
    armature_obj.scale = (uniform_scale,) * 3
    scene = bpy.context.scene
    original_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x = 560
    scene.render.resolution_y = 560
    output_dir.mkdir(parents=True, exist_ok=True)
    camera = scene.camera
    maximum = max(definition.world_size)
    if definition.archetype == "thaedryn":
        camera.location = (
            maximum * 2.05,
            -maximum * 0.75,
            definition.world_size[1] * 1.1,
        )
    else:
        camera.location = (
            maximum * 1.15,
            -maximum * 2.5,
            definition.world_size[1] * 0.95,
        )
    point_camera(camera, (0, 0, definition.world_size[1] * 0.47))
    for action_name, frame in action_frames:
        armature_obj.animation_data.action = actions[action_name]
        scene.frame_set(frame)
        scene.render.filepath = str(
            output_dir / f"{definition.slug}_{action_name.lower()}.png"
        )
        bpy.ops.render.render(write_still=True)
    armature_obj.animation_data.action = actions["Idle"]
    scene.frame_set(1)
    scene.render.resolution_x, scene.render.resolution_y = original_resolution
    armature_obj.scale = (1, 1, 1)


def render_silhouette_turns(
    definition: BossDefinition,
    mesh_obj: bpy.types.Object,
    armature_obj: bpy.types.Object,
    output_dir: Path,
) -> None:
    scene = bpy.context.scene
    world_size = definition.world_size
    maximum = max(world_size)
    if definition.archetype in ASPECT_PRESERVED_ARCHETYPES:
        armature_obj.scale = (world_size[1] / BASE_BOX[2],) * 3
    else:
        armature_obj.scale = (
            world_size[0] / BASE_BOX[0],
            world_size[2] / BASE_BOX[1],
            world_size[1] / BASE_BOX[2],
        )
    reset_pose(armature_obj)
    scene.frame_set(1)
    original_materials = list(mesh_obj.data.materials)
    silhouette = bpy.data.materials.get("Silhouette QA") or bpy.data.materials.new(
        "Silhouette QA"
    )
    silhouette.diffuse_color = (0, 0, 0, 1)
    silhouette.use_nodes = True
    bsdf = silhouette.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
        bsdf.inputs["Roughness"].default_value = 1
    for index in range(len(mesh_obj.data.materials)):
        mesh_obj.data.materials[index] = silhouette

    hidden_objects: List[Tuple[bpy.types.Object, bool]] = []
    for obj in scene.objects:
        if obj is mesh_obj or obj is armature_obj or obj is scene.camera:
            continue
        hidden_objects.append((obj, obj.hide_render))
        obj.hide_render = True
    original_world = tuple(scene.world.color)
    original_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    original_exposure = scene.view_settings.exposure
    scene.world.color = (1, 1, 1)
    scene.view_settings.exposure = 2.0
    scene.render.resolution_x = 320
    scene.render.resolution_y = 320
    output_dir.mkdir(parents=True, exist_ok=True)

    camera = scene.camera
    target = (0, 0, world_size[1] * 0.46)
    radius = maximum * (1.35 if definition.archetype == "thaedryn" else 2.75)
    for index, angle in enumerate((0, 90, 180, 270)):
        radians = math.radians(angle)
        camera.location = (
            math.sin(radians) * radius,
            -math.cos(radians) * radius,
            world_size[1] * 0.82,
        )
        point_camera(camera, target)
        scene.render.filepath = str(output_dir / f"{definition.slug}_{angle:03d}.png")
        bpy.ops.render.render(write_still=True)

    for index, material in enumerate(original_materials):
        mesh_obj.data.materials[index] = material
    for obj, was_hidden in hidden_objects:
        obj.hide_render = was_hidden
    scene.world.color = original_world
    scene.view_settings.exposure = original_exposure
    scene.render.resolution_x, scene.render.resolution_y = original_resolution
    armature_obj.scale = (1, 1, 1)


def glb_animation_names(path: Path) -> List[str]:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        return []
    offset = 12
    json_data = None
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            json_data = json.loads(payload.decode("utf-8").rstrip("\x00 \t\r\n"))
            break
    if not json_data:
        return []
    return [animation.get("name", "") for animation in json_data.get("animations", [])]


# These four replacements live in an isolated clean-room module. Import only
# after the shared animation/render helpers are defined: the module installs
# bespoke motion dispatch and contributes definitions without reviving any of
# the deleted legacy builders.
from four_boss_rebuilds import DEFINITIONS as FOUR_BOSS_REBUILD_DEFINITIONS

_all_bosses_by_slug = {
    definition.slug: definition
    for definition in (*BOSSES, *FOUR_BOSS_REBUILD_DEFINITIONS)
}
BOSSES = tuple(
    _all_bosses_by_slug[slug]
    for slug in (
        "muck_scarred_helix",
        "gilded_bull",
        "ninth_winter",
        "failed_apprentice",
        "first_choir",
        "echo_singer",
        "vyrahel_vein_keeper",
        "thaedryn_bellbound",
        "hex_wraith",
        "alpha_mucker",
        "root_crowned_dead",
    )
)


def generate_boss(
    definition: BossDefinition,
    repo_root: Path,
    preview_dir: Optional[Path],
) -> Dict[str, object]:
    clear_scene()
    builder = VoxelBuilder(definition.slug)
    definition.build(builder)
    apply_baked_voxel_shading(builder)
    ensure_bone_definitions(builder)
    min_corner, max_corner = builder_bounds(builder)
    normalizer = Normalizer(
        min_corner,
        max_corner,
        preserve_aspect=definition.archetype in ASPECT_PRESERVED_ARCHETYPES,
    )

    vox_path = (
        repo_root / "src/galois/data/npcs/harthmere_bosses" / f"{definition.slug}.vox"
    )
    glb_path = (
        repo_root / "public/assets/harthmere/glb/bosses" / f"{definition.slug}.glb"
    )
    static_glb_path = (
        repo_root
        / "public/assets/harthmere/glb/bosses"
        / f"{definition.slug}_world.glb"
    )
    write_vox(builder, vox_path)
    mesh_obj, bone_vertices = create_mesh(definition, builder, normalizer)
    armature_obj = create_armature(definition, builder, normalizer)
    bind_mesh(mesh_obj, armature_obj, bone_vertices)

    actions: Dict[str, bpy.types.Action] = {}
    for clip in (*REQUIRED_CLIPS, *definition.special_clips):
        actions[clip] = create_action(definition, armature_obj, clip)
    armature_obj.animation_data.action = actions["Idle"]
    export_glb(definition, mesh_obj, armature_obj, glb_path)
    export_glb(
        definition,
        mesh_obj,
        armature_obj,
        static_glb_path,
        world_size=definition.world_size,
    )
    exported_clips = glb_animation_names(glb_path)
    expected_clips = list(dict.fromkeys((*REQUIRED_CLIPS, *definition.special_clips)))
    missing = [clip for clip in expected_clips if clip not in exported_clips]
    if missing:
        raise RuntimeError(
            f"{definition.slug} GLB missing animations: {missing}; got {exported_clips}"
        )
    if preview_dir:
        render_preview(
            definition,
            armature_obj,
            actions[definition.preview_action],
            preview_dir / f"{definition.slug}.png",
        )
        render_boss_action_stills(
            definition,
            armature_obj,
            actions,
            preview_dir / "actions",
        )
        render_silhouette_turns(
            definition,
            mesh_obj,
            armature_obj,
            preview_dir / "silhouettes",
        )

    return {
        "id": definition.slug,
        "displayName": definition.name,
        "assetUrl": f"/assets/harthmere/glb/bosses/{definition.slug}.glb",
        "staticAssetUrl": f"/assets/harthmere/glb/bosses/{definition.slug}_world.glb",
        "voxSource": str(vox_path.relative_to(repo_root)),
        "worldSize": list(definition.world_size),
        "voxelCount": len(builder.cells),
        "surfaceVertexCount": len(mesh_obj.data.vertices),
        "surfaceTriangleCount": len(mesh_obj.data.polygons) * 2,
        "materialCount": len(material_order(builder)),
        "clips": exported_clips,
        "specialClips": list(definition.special_clips),
        "animationPolishVersion": BOSS_ANIMATION_POLISH_VERSION,
        "rawVoxelBounds": {
            "min": list(min_corner),
            "max": list(max_corner),
        },
        "fileBytes": glb_path.stat().st_size,
    }


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--preview-dir", type=Path)
    parser.add_argument("--only", action="append", default=[])
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    repo_root = args.repo_root.resolve()
    preview_dir = args.preview_dir.resolve() if args.preview_dir else None
    selected = [
        definition
        for definition in BOSSES
        if not args.only or definition.slug in args.only
    ]
    unknown = set(args.only) - {definition.slug for definition in BOSSES}
    if unknown:
        raise SystemExit(f"Unknown boss ids: {sorted(unknown)}")
    metadata = [
        generate_boss(definition, repo_root, preview_dir) for definition in selected
    ]
    manifest_path = repo_root / "public/assets/harthmere/glb/bosses/manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    if len(selected) == len(BOSSES):
        manifest_bosses = metadata
    elif manifest_path.exists():
        existing_manifest = json.loads(manifest_path.read_text())
        replacements = {entry["id"]: entry for entry in metadata}
        manifest_bosses = [
            replacements.pop(entry["id"], entry)
            for entry in existing_manifest.get("bosses", [])
        ]
        manifest_bosses.extend(replacements.values())
    else:
        manifest_bosses = metadata
    manifest_path.write_text(
        json.dumps(
            {
                "version": 3,
                "animationPolishVersion": BOSS_ANIMATION_POLISH_VERSION,
                "generator": "scripts/harthmere/generate_boss_voxel_assets.py",
                "normalizedNpcBox": [BASE_BOX[0], BASE_BOX[2], BASE_BOX[1]],
                "bosses": manifest_bosses,
            },
            indent=2,
        )
        + "\n"
    )
    print(json.dumps({"generated": [entry["id"] for entry in metadata]}, indent=2))


if __name__ == "__main__":
    main()
