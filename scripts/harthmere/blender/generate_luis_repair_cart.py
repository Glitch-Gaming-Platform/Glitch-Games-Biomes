#!/usr/bin/env python3
"""Generate Luis's authored Chapter 1 repair cart and a review render.

Run with Blender 5.x:

  blender --background \
    --python scripts/harthmere/blender/generate_luis_repair_cart.py -- \
    --repo-root "$PWD" \
    --preview-dir artifacts/harthmere-luis-repair-cart

The GLB origin is the ground contact point. Blender's Z-up scene is exported
as glTF Y-up, so the game can place the cart directly at the grounded quest
marker without another coordinate convention.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--preview-dir", type=Path)
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def material(name: str, color: tuple[float, float, float, float], metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = 0.72 if metallic == 0 else 0.38
    principled.inputs["Metallic"].default_value = metallic
    return mat


def finish_object(obj: bpy.types.Object, mat, parent, bevel=0.035):
    obj.data.materials.append(mat)
    obj.parent = parent
    obj["harthmereRepairCartPart"] = obj.name
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("Readable bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    return obj


def box(name, dimensions, location, mat, parent, rotation=(0.0, 0.0, 0.0), bevel=0.035):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    return finish_object(obj, mat, parent, bevel)


def cylinder(
    name,
    radius,
    depth,
    location,
    mat,
    parent,
    rotation=(0.0, 0.0, 0.0),
    vertices=16,
    bevel=0.025,
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
    return finish_object(obj, mat, parent, bevel)


def torus(name, major, minor, location, mat, parent, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=24,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish_object(obj, mat, parent, bevel=0.0)


def build_cart() -> bpy.types.Object:
    root = bpy.data.objects.new("LuisRepairCart", None)
    root["harthmereAsset"] = "luis_repair_cart"
    root["harthmereAssetVersion"] = 1
    bpy.context.scene.collection.objects.link(root)

    oak = material("Warm oak", (0.34, 0.13, 0.045, 1.0))
    oak_light = material("Edge-worn oak", (0.58, 0.27, 0.075, 1.0))
    iron = material("Forged iron", (0.075, 0.095, 0.12, 1.0), metallic=0.75)
    steel = material("Tool steel", (0.42, 0.52, 0.59, 1.0), metallic=0.9)
    brass = material("Repair brass", (0.8, 0.48, 0.075, 1.0), metallic=0.7)
    blue = material("Luis blue", (0.055, 0.28, 0.48, 1.0))
    cream = material("Repair flag cream", (0.95, 0.77, 0.36, 1.0))
    rubber = material("Wheel tread", (0.035, 0.04, 0.045, 1.0))

    # Grounded wagon body: broad enough to read at quest-marker distance, but
    # narrow enough to leave Luis's interaction prompt unobstructed.
    box("deck", (2.18, 1.12, 0.22), (0.0, 0.0, 0.86), oak, root, bevel=0.06)
    box("deck-inlay", (1.88, 0.88, 0.08), (0.0, 0.0, 1.02), oak_light, root)
    for side in (-1, 1):
        box(
            "left-rail" if side < 0 else "right-rail",
            (1.98, 0.11, 0.48),
            (-0.04, side * 0.515, 1.23),
            oak_light,
            root,
        )
        for x in (-0.78, 0.0, 0.74):
            box(
                f"rail-post-{side}-{x}",
                (0.1, 0.13, 0.62),
                (x, side * 0.515, 1.18),
                oak,
                root,
            )
    box("tailgate", (0.12, 0.94, 0.5), (-1.02, 0.0, 1.23), oak_light, root)
    box("front-brace", (0.1, 0.94, 0.32), (1.02, 0.0, 1.12), oak, root)

    # Four explicit wheels eliminate the former blocky/debug-cart silhouette.
    for x_name, x in (("rear", -0.72), ("front", 0.72)):
        cylinder(
            f"axle-{x_name}",
            0.075,
            1.64,
            (x, 0.0, 0.52),
            iron,
            root,
            rotation=(math.pi / 2, 0, 0),
            vertices=12,
        )
        for side_name, y in (("left", -0.79), ("right", 0.79)):
            torus(
                f"wheel-{x_name}-{side_name}",
                0.39,
                0.085,
                (x, y, 0.52),
                rubber,
                root,
                rotation=(math.pi / 2, 0, 0),
            )
            cylinder(
                f"wheel-hub-{x_name}-{side_name}",
                0.105,
                0.13,
                (x, y, 0.52),
                brass,
                root,
                rotation=(math.pi / 2, 0, 0),
                vertices=12,
            )
            for index in range(4):
                angle = math.pi * index / 4
                box(
                    f"wheel-spoke-{x_name}-{side_name}-{index}",
                    (0.62, 0.055, 0.055),
                    (x, y, 0.52),
                    iron,
                    root,
                    rotation=(0.0, angle, 0.0),
                    bevel=0.015,
                )

    # Long separated handles make the direction of travel immediately clear.
    for side_name, y in (("left", -0.34), ("right", 0.34)):
        box(
            f"handle-{side_name}",
            (1.52, 0.095, 0.095),
            (1.66, y, 0.78),
            oak_light,
            root,
            rotation=(0.0, -0.08, 0.0),
            bevel=0.03,
        )

    # Repair cargo distinguishes this prop from decorative town wagons.
    box("repair-chest", (0.78, 0.72, 0.48), (-0.5, 0.0, 1.36), blue, root, bevel=0.07)
    box("repair-chest-lid", (0.84, 0.76, 0.13), (-0.5, 0.0, 1.67), iron, root)
    box("repair-chest-band-left", (0.09, 0.78, 0.54), (-0.76, 0.0, 1.39), brass, root)
    box("repair-chest-band-right", (0.09, 0.78, 0.54), (-0.24, 0.0, 1.39), brass, root)
    box("repair-chest-latch", (0.12, 0.08, 0.16), (-0.5, -0.4, 1.46), brass, root)

    for index, (x, y) in enumerate(((0.2, -0.23), (0.43, 0.02), (0.22, 0.27))):
        box(
            f"iron-ingot-{index}",
            (0.48, 0.2, 0.13),
            (x, y, 1.16 + index * 0.08),
            steel,
            root,
            rotation=(0.0, 0.04 * index, 0.12 * (index - 1)),
            bevel=0.045,
        )

    # Oversized wrench and hammer remain readable from third-person distance.
    box(
        "wrench-handle",
        (0.92, 0.11, 0.11),
        (0.47, -0.22, 1.5),
        steel,
        root,
        rotation=(0.0, 0.38, -0.16),
        bevel=0.025,
    )
    torus(
        "wrench-head",
        0.16,
        0.055,
        (0.89, -0.22, 1.66),
        steel,
        root,
        rotation=(math.pi / 2, 0.0, 0.0),
    )
    box("hammer-handle", (0.08, 0.08, 0.76), (0.42, 0.32, 1.48), oak_light, root, rotation=(0.0, 0.35, 0.0))
    box("hammer-head", (0.38, 0.15, 0.15), (0.55, 0.32, 1.83), iron, root, rotation=(0.0, 0.35, 0.0))

    # The flag is an authored repair symbol, not the quest beacon. The engine's
    # existing white/blue beacon remains a separate child and keeps quest state.
    cylinder("repair-flag-pole", 0.045, 1.62, (-0.91, 0.38, 2.06), brass, root, vertices=12)
    box("repair-flag", (0.74, 0.055, 0.44), (-0.56, 0.38, 2.55), cream, root, bevel=0.025)
    box("repair-flag-wrench-stem", (0.42, 0.07, 0.075), (-0.56, 0.345, 2.55), blue, root, rotation=(0.0, 0.45, 0.0), bevel=0.018)
    cylinder("repair-flag-wrench-ring", 0.105, 0.072, (-0.39, 0.345, 2.63), blue, root, rotation=(math.pi / 2, 0.0, 0.0), vertices=12, bevel=0.01)
    return root


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_preview(root: bpy.types.Object, output: Path) -> None:
    ground_mat = material("Preview ground", (0.055, 0.075, 0.09, 1.0))
    box("PreviewGround", (9.0, 9.0, 0.08), (0.2, 0.0, -0.06), ground_mat, None, bevel=0.0)

    bpy.ops.object.light_add(type="AREA", location=(3.8, -4.2, 6.2))
    key = bpy.context.object
    key.name = "PreviewKey"
    key.data.energy = 1050
    key.data.shape = "DISK"
    key.data.size = 4.0
    look_at(key, (0.2, 0.0, 1.1))

    bpy.ops.object.light_add(type="AREA", location=(-4.0, -1.5, 3.4))
    fill = bpy.context.object
    fill.name = "PreviewFill"
    fill.data.energy = 700
    fill.data.size = 3.0
    look_at(fill, (0.0, 0.0, 1.0))

    bpy.ops.object.light_add(type="AREA", location=(1.0, 4.5, 4.8))
    rim = bpy.context.object
    rim.name = "PreviewRim"
    rim.data.energy = 900
    rim.data.size = 2.5
    look_at(rim, (0.0, 0.0, 1.2))

    bpy.ops.object.camera_add(location=(5.2, -6.2, 3.9))
    camera = bpy.context.object
    camera.name = "PreviewCamera"
    camera.data.lens = 53
    look_at(camera, (0.25, 0.0, 1.15))
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.02, 0.03, 0.05)
    scene.render.filepath = str(output)
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.render.render(write_still=True)


def export_glb(root: bpy.types.Object, output: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_extras=True,
        export_yup=True,
    )


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    output = repo_root / "public/assets/harthmere/glb/quest/luis_repair_cart.glb"
    preview_dir = (args.preview_dir or repo_root / "artifacts/harthmere-luis-repair-cart").resolve()
    preview_dir.mkdir(parents=True, exist_ok=True)

    clear_scene()
    root = build_cart()
    export_glb(root, output)
    add_preview(root, preview_dir / "luis-repair-cart-blender-preview.png")
    print(f"HARTHMERE_LUIS_REPAIR_CART_GLB={output}")
    print(f"HARTHMERE_LUIS_REPAIR_CART_PREVIEW={preview_dir / 'luis-repair-cart-blender-preview.png'}")


if __name__ == "__main__":
    main()
