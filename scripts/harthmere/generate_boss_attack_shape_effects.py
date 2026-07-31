#!/usr/bin/env python3
"""Generate reusable, animated boss attack-shape graphics in Blender 5.x.

The assets follow the Harthmere premium-projectile art rules: readable in less
than 0.2 seconds, layered core/shell/glow construction, a strong silhouette,
low geometry cost, emissive accents, and a baked 24-frame pulse loop. Runtime
color tinting gives each of the 45 boss attacks its authored damage identity.

All directional effects point along local +Z. Ground and radial effects lie on
Blender's XY floor plane (exported by glTF as a Three.js Y-up ground plane).
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


Color = Tuple[float, float, float, float]
Vec3 = Tuple[float, float, float]


@dataclass(frozen=True)
class ShapeSpec:
    shape: str
    label: str
    builder: str
    base_radius: float
    base_length: float


SHAPES: Tuple[ShapeSpec, ...] = (
    ShapeSpec("beam", "Boss Beam", "beam", 0.22, 1.0),
    ShapeSpec("cone", "Boss Cone", "cone", 0.62, 1.0),
    ShapeSpec("ground_aoe", "Boss Ground Area", "ground_aoe", 1.0, 1.0),
    ShapeSpec("self_aoe", "Boss Radial Area", "self_aoe", 1.0, 1.0),
)


def rgba(value: int, alpha: float = 1.0) -> Color:
    return (
        ((value >> 16) & 255) / 255.0,
        ((value >> 8) & 255) / 255.0,
        (value & 255) / 255.0,
        alpha,
    )


def material(name: str, color: Color, emission: float, alpha: float = 1.0):
    value = bpy.data.materials.new(f"boss-shape-{name}")
    value.diffuse_color = (color[0], color[1], color[2], alpha)
    value.use_nodes = True
    value.surface_render_method = "DITHERED" if alpha < 1.0 else "DITHERED"
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.24
        bsdf.inputs["Metallic"].default_value = 0.08
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = color
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
    return value


MATERIALS = {
    "primary": material("primary", rgba(0x7048E8), 1.7, 0.82),
    "secondary": material("secondary", rgba(0x55D9FF), 2.4, 0.9),
    "accent": material("accent", rgba(0xFFF6C2), 3.2, 0.96),
    "shell": material("shell", rgba(0x25184F), 0.55, 0.58),
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


def move_to(obj, collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def finish(obj, collection, root, mat, bevel_width=0.012):
    if obj.type == "MESH" and mat:
        obj.data.materials.append(mat)
    if obj.type == "MESH" and bevel_width > 0:
        modifier = obj.modifiers.new("ShapeChamfer", "BEVEL")
        modifier.width = bevel_width
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
    move_to(obj, collection)
    obj.parent = root
    return obj


def cylinder(
    collection,
    root,
    name: str,
    location: Vec3,
    radius: float,
    depth: float,
    mat,
    vertices=10,
    rotation=(0, 0, 0),
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, collection, root, mat, min(0.012, radius * 0.25))


def cone(
    collection,
    root,
    name: str,
    location: Vec3,
    radius1: float,
    radius2: float,
    depth: float,
    mat,
    vertices=12,
):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, collection, root, mat, 0.012)


def torus(
    collection,
    root,
    name: str,
    location: Vec3,
    major: float,
    minor: float,
    mat,
    rotation=(0, 0, 0),
    segments=20,
):
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
    return finish(obj, collection, root, mat, min(0.009, minor * 0.35))


def cube(
    collection,
    root,
    name: str,
    location: Vec3,
    scale: Vec3,
    mat,
    rotation=(0, 0, 0),
):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, collection, root, mat, min(0.012, min(scale) * 0.3))


def ico(collection, root, name: str, location: Vec3, scale: Vec3, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, collection, root, mat, 0.01)


def between(collection, root, name: str, start: Vec3, end: Vec3, radius, mat):
    a = Vector(start)
    b = Vector(end)
    direction = b - a
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=6,
        radius=radius,
        depth=direction.length,
        location=(a + b) * 0.5,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(
        direction.normalized()
    )
    obj.rotation_mode = "XYZ"
    return finish(obj, collection, root, mat, min(0.008, radius * 0.28))


def build_beam(_spec, collection, root):
    cylinder(collection, root, "BeamCore", (0, 0, 0.5), 0.075, 1.0, MATERIALS["accent"], 8)
    cylinder(collection, root, "BeamShell", (0, 0, 0.5), 0.145, 0.98, MATERIALS["shell"], 10)
    for index, z in enumerate((0.08, 0.31, 0.55, 0.79, 0.96)):
        torus(
            collection,
            root,
            f"BeamFocusRing_{index}",
            (0, 0, z),
            0.19 if index in (0, 4) else 0.16,
            0.018,
            MATERIALS["secondary" if index % 2 else "primary"],
            segments=14,
        )
    for index, angle in enumerate((0, math.pi / 2, math.pi, math.pi * 1.5)):
        x = math.cos(angle) * 0.17
        y = math.sin(angle) * 0.17
        between(
            collection,
            root,
            f"BeamRail_{index}",
            (x * 0.45, y * 0.45, 0.06),
            (x, y, 0.94),
            0.018,
            MATERIALS["primary"],
        )
    cone(collection, root, "BeamImpactPoint", (0, 0, 1.06), 0.18, 0.0, 0.22, MATERIALS["accent"], 8)


def build_cone(_spec, collection, root):
    cone(collection, root, "ConeEnergyShell", (0, 0, 0.5), 0.045, 0.6, 1.0, MATERIALS["shell"], 12)
    cone(collection, root, "ConeBrightCore", (0, 0, 0.5), 0.025, 0.28, 1.0, MATERIALS["primary"], 10)
    for ring_index, (z, radius) in enumerate(((0.18, 0.13), (0.42, 0.28), (0.68, 0.43), (0.94, 0.58))):
        torus(
            collection,
            root,
            f"ConeReadabilityRing_{ring_index}",
            (0, 0, z),
            radius,
            0.018 if ring_index < 3 else 0.026,
            MATERIALS["secondary" if ring_index % 2 else "primary"],
            segments=16,
        )
    for index in range(8):
        angle = math.tau * index / 8
        x = math.cos(angle)
        y = math.sin(angle)
        between(
            collection,
            root,
            f"ConeEdgeRail_{index}",
            (x * 0.035, y * 0.035, 0.02),
            (x * 0.6, y * 0.6, 1.0),
            0.016,
            MATERIALS["accent" if index % 2 == 0 else "secondary"],
        )


def add_floor_runes(collection, root, prefix: str, radius: float, count: int):
    for index in range(count):
        angle = math.tau * index / count
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius
        cube(
            collection,
            root,
            f"{prefix}Rune_{index}",
            (x, y, 0.035),
            (0.13, 0.035, 0.025),
            MATERIALS["accent" if index % 3 == 0 else "secondary"],
            rotation=(0, 0, angle),
        )


def build_ground_aoe(_spec, collection, root):
    for index, radius in enumerate((0.24, 0.5, 0.76, 0.98)):
        torus(
            collection,
            root,
            f"GroundWarningRing_{index}",
            (0, 0, 0.025 + index * 0.004),
            radius,
            0.024 if index == 3 else 0.014,
            MATERIALS["accent" if index == 3 else "primary" if index % 2 else "secondary"],
            segments=24,
        )
    add_floor_runes(collection, root, "Ground", 0.72, 12)
    ico(collection, root, "GroundFocus", (0, 0, 0.07), (0.11, 0.11, 0.11), MATERIALS["accent"])
    for index in range(8):
        angle = math.tau * index / 8
        between(
            collection,
            root,
            f"GroundRadial_{index}",
            (math.cos(angle) * 0.16, math.sin(angle) * 0.16, 0.02),
            (math.cos(angle) * 0.9, math.sin(angle) * 0.9, 0.02),
            0.012,
            MATERIALS["shell"],
        )


def build_self_aoe(_spec, collection, root):
    ico(collection, root, "RadialCore", (0, 0, 0.18), (0.13, 0.13, 0.18), MATERIALS["accent"])
    for index, radius in enumerate((0.34, 0.64, 0.96)):
        torus(
            collection,
            root,
            f"RadialWave_{index}",
            (0, 0, 0.04 + index * 0.025),
            radius,
            0.025 if index == 2 else 0.018,
            MATERIALS["secondary" if index % 2 else "primary"],
            segments=24,
        )
    for index in range(12):
        angle = math.tau * index / 12
        start = (math.cos(angle) * 0.17, math.sin(angle) * 0.17, 0.09)
        end = (
            math.cos(angle) * (0.86 if index % 2 else 1.0),
            math.sin(angle) * (0.86 if index % 2 else 1.0),
            0.12 + (index % 3) * 0.08,
        )
        between(
            collection,
            root,
            f"RadialBurst_{index}",
            start,
            end,
            0.018,
            MATERIALS["accent" if index % 3 == 0 else "primary"],
        )
    add_floor_runes(collection, root, "Radial", 0.72, 8)


BUILDERS: Dict[str, Callable] = {
    "beam": build_beam,
    "cone": build_cone,
    "ground_aoe": build_ground_aoe,
    "self_aoe": build_self_aoe,
}


def animate(root, spec: ShapeSpec):
    root.animation_data_create()
    action = bpy.data.actions.new(f"{spec.shape}__PulseLoop_24")
    action["harthmereExportClip"] = "PulseLoop_24"
    root.animation_data.action = action
    root.rotation_mode = "XYZ"
    for frame, scale, rotation in (
        (1, 0.96, 0.0),
        (7, 1.035, 0.06),
        (13, 1.0, 0.12),
        (19, 1.055, 0.18),
        (25, 0.96, 0.24),
    ):
        root.scale = (scale, scale, scale)
        root.rotation_euler = (0, 0, rotation)
        root.keyframe_insert("scale", frame=frame)
        root.keyframe_insert("rotation_euler", frame=frame)
    # Blender 5.x stores newly keyed actions in layered slots instead of the
    # legacy Action.fcurves collection. The default Bezier interpolation gives
    # the desired eased pulse and exports correctly through glTF.


def make_shape(spec: ShapeSpec):
    collection = bpy.data.collections.new(f"BossAttackShape_{spec.shape}")
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new(f"BossAttackShapeRoot_{spec.shape}", None)
    root.empty_display_type = "ARROWS"
    root["harthmereBossAttackShape"] = spec.shape
    root["harthmereBaseRadius"] = spec.base_radius
    root["harthmereBaseLength"] = spec.base_length
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


def export_glb(root, path: Path):
    select_tree(root)
    action = root.animation_data.action if root.animation_data else None
    original_name = action.name if action else None
    if action:
        action.name = "PulseLoop_24"
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


def triangle_count(root) -> int:
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


def setup_preview(size: int):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.world.color = (0.004, 0.006, 0.012)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.15
    bpy.ops.object.camera_add(location=(3.7, -5.8, 3.6))
    camera = bpy.context.object
    camera.data.lens = 58
    look_at(camera, (0, 0, 0.35))
    scene.camera = camera
    for name, location, energy, color, size_value in (
        ("Key", (3.8, -3.0, 5.2), 520, (0.68, 0.82, 1.0), 3.0),
        ("Rim", (-4.0, 1.4, 3.5), 650, (0.42, 0.28, 1.0), 2.5),
        ("Warm", (1.1, 3.2, 1.0), 340, (1.0, 0.7, 0.3), 2.2),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = f"Preview{name}"
        light.data.energy = energy
        light.data.color = color
        light.data.shape = "DISK"
        light.data.size = size_value
        look_at(light, (0, 0, 0.3))


def render_preview(root, spec: ShapeSpec, path: Path):
    for collection in bpy.data.collections:
        if collection.name.startswith("BossAttackShape_"):
            collection.hide_render = collection != root.users_collection[0]
    scene = bpy.context.scene
    action = root.animation_data.action if root.animation_data else None
    if root.animation_data:
        root.animation_data.action = None
    root.location = (0, 0, 0)
    root.rotation_euler = (
        math.radians(10 if spec.shape in ("beam", "cone") else 0),
        math.radians(-18 if spec.shape in ("beam", "cone") else 0),
        math.radians(16),
    )
    root.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    current = bounds(root)
    dimensions = [current["max"][axis] - current["min"][axis] for axis in range(3)]
    scale = 3.0 / max(dimensions)
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    framed = bounds(root)
    center = Vector(
        tuple((framed["min"][axis] + framed["max"][axis]) * 0.5 for axis in range(3))
    )
    root.location -= center
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    root.scale = (1, 1, 1)
    if root.animation_data:
        root.animation_data.action = action
    for collection in bpy.data.collections:
        collection.hide_render = False


def parse_args(argv: Sequence[str]):
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--preview-size", type=int, default=512)
    parser.add_argument("--skip-previews", action="store_true")
    return parser.parse_args(argv)


def main():
    separator = sys.argv.index("--") + 1 if "--" in sys.argv else len(sys.argv)
    args = parse_args(sys.argv[separator:])
    repo = Path(args.repo_root).resolve()
    output = repo / "public/assets/harthmere/glb/boss_attack_shapes"
    previews = repo / "public/assets/harthmere/boss_attack_shape_previews"
    blend_path = repo / "src/galois/data/projectiles/harthmere_boss_attack_shapes.blend"
    output.mkdir(parents=True, exist_ok=True)
    previews.mkdir(parents=True, exist_ok=True)
    blend_path.parent.mkdir(parents=True, exist_ok=True)

    clean_scene()
    setup_preview(args.preview_size)
    generated = []
    for index, spec in enumerate(SHAPES):
        print(f"Building {spec.shape}", flush=True)
        collection, root = make_shape(spec)
        bpy.context.view_layer.update()
        glb_path = output / f"{spec.shape}.glb"
        export_glb(root, glb_path)
        if not args.skip_previews:
            render_preview(root, spec, previews / f"{spec.shape}.png")
        generated.append(
            {
                "shape": spec.shape,
                "label": spec.label,
                "baseRadius": spec.base_radius,
                "baseLength": spec.base_length,
                "animationClip": "PulseLoop_24",
                "assetUrl": f"/assets/harthmere/glb/boss_attack_shapes/{spec.shape}.glb",
                "previewUrl": f"/assets/harthmere/boss_attack_shape_previews/{spec.shape}.png",
                "triangleCount": triangle_count(root),
                "bounds": bounds(root),
                "bytes": glb_path.stat().st_size,
            }
        )
        root.location = ((index % 2) * 3.0, (index // 2) * 3.0, 0)
        collection["harthmereBossAttackShapeLabel"] = spec.label

    manifest = {
        "version": "harthmere-boss-attack-shapes-v1",
        "blenderVersion": bpy.app.version_string,
        "count": len(generated),
        "shapes": generated,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
