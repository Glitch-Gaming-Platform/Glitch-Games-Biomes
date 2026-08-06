#!/usr/bin/env python3
"""Render quick authored-material turntables for boss screenshot framing QA.

Run through Blender so the final in-game capture can stay focused on scenery:

  blender --background --python scripts/cutscenes/render-boss-turntable.py -- \
    --output /tmp/harthmere-boss-turntable \
    --boss muck_scarred_helix --boss alpha_mucker

These are diagnostics only. Marketing finals still come from
capture-promo-still.cjs and the live cutscene renderer.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ANGLES = (0, 45, 90, 135, 180, 225, 270, 315)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--boss", action="append", default=[])
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            block.remove(item)


def point_at(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)
    return minimum, maximum


def add_area(name: str, location: tuple[float, float, float], energy: float, color: tuple[float, float, float], size: float) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    light.location = location
    bpy.context.scene.collection.objects.link(light)


def render_boss(asset: Path, output: Path) -> None:
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(asset))
    imported = list(bpy.context.scene.objects)
    minimum, maximum = world_bounds(imported)
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    radius = max(size.x, size.y) * 2.15

    camera_data = bpy.data.cameras.new("Turntable Camera")
    camera_data.lens = 58
    camera = bpy.data.objects.new("Turntable Camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera

    add_area("Key", (radius * 0.7, -radius * 0.8, maximum.z * 1.25), radius * 110, (1.0, 0.72, 0.5), radius * 0.75)
    add_area("Fill", (-radius * 0.8, -radius * 0.2, maximum.z * 0.8), radius * 55, (0.3, 0.5, 1.0), radius * 0.9)
    add_area("Rim", (0, radius * 0.8, maximum.z * 1.05), radius * 90, (0.4, 0.85, 1.0), radius * 0.65)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.005, 0.008, 0.015)
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.35

    output.mkdir(parents=True, exist_ok=True)
    target = Vector((center.x, center.y, minimum.z + size.z * 0.48))
    for angle in ANGLES:
        radians = math.radians(angle)
        camera.location = (
            center.x + math.sin(radians) * radius,
            center.y - math.cos(radians) * radius,
            minimum.z + size.z * 0.72,
        )
        point_at(camera, target)
        scene.render.filepath = str(output / f"{asset.stem}-{angle:03d}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    root = args.repo_root.resolve()
    boss_dir = root / "public/assets/harthmere/glb/bosses"
    bosses = args.boss or sorted(path.stem.removesuffix("_world") for path in boss_dir.glob("*_world.glb"))
    for boss in bosses:
        asset = boss_dir / f"{boss}_world.glb"
        if not asset.exists():
            raise SystemExit(f"missing boss GLB: {asset}")
        render_boss(asset, args.output.resolve() / boss)


if __name__ == "__main__":
    main()
