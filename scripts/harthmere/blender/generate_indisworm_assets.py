#!/usr/bin/env python3
"""Build the Indisworm source VOX, editable Blender rig, animations, and GLTF/GLB.

Run with Blender 5.x:

  blender --background --python scripts/harthmere/blender/generate_indisworm_assets.py -- \
    --repo-root "$PWD" --preview-dir artifacts/harthmere-indisworm

The game-facing mesh is normalized to the ordinary NPC box. Native ECS Size
restores the human-scale 1.05 x 1.9 x 1.05 metre body in the world.
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import sys
from pathlib import Path
from typing import Dict, Mapping, Sequence, Tuple

import bpy
from mathutils import Vector

HARTHMERE_SCRIPT_DIR = Path(__file__).resolve().parents[1]
if str(HARTHMERE_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(HARTHMERE_SCRIPT_DIR))

from generate_boss_voxel_assets import (  # noqa: E402
    BossDefinition,
    Normalizer,
    VoxelBuilder,
    apply_baked_voxel_shading,
    bind_mesh,
    builder_bounds,
    create_armature,
    create_mesh,
    reset_pose,
    write_vox,
)


Vec3 = Tuple[float, float, float]
FrameTransform = Dict[str, Dict[str, Vec3]]

WORLD_SIZE: Vec3 = (1.05, 1.9, 1.05)
CLIPS = ("Idle", "Walk", "Run", "Attack", "RangedAttack", "HitReact", "Death")


def build_indisworm() -> VoxelBuilder:
    builder = VoxelBuilder("indisworm")
    builder.bone("Tail", (0, 0, 3), "Root")
    builder.bone("Body01", (0, 0, 9), "Tail")
    builder.bone("Body02", (0, 0, 15), "Body01")
    builder.bone("Body03", (0, 0, 21), "Body02")
    builder.bone("Neck", (0, 0, 27), "Body03")
    builder.bone("Head", (0, 0, 34), "Neck")
    builder.bone("AcidSac", (0, -1, 28), "Neck")
    # A non-deforming exported bone used by the client projectile renderer.
    builder.bone("Socket_Mouth", (0, -9, 34), "Head")

    segments = (
        ("Tail", (0.0, 0.4, 3.0), (3.8, 3.4, 4.8)),
        ("Body01", (-0.25, 0.1, 9.0), (5.0, 4.3, 5.0)),
        ("Body02", (0.3, 0.0, 15.0), (5.5, 4.7, 5.1)),
        ("Body03", (-0.2, 0.0, 21.0), (5.6, 4.8, 5.2)),
        ("Neck", (0.0, -0.1, 27.0), (5.3, 4.7, 5.0)),
    )
    for index, (bone, center, radius) in enumerate(segments):
        builder.ellipsoid(bone, center, radius, "muck_hide")
        # Pale ventral bands keep the silhouette readable in low cave light.
        builder.ellipsoid(
            bone,
            (center[0], center[1] - radius[1] * 0.76, center[2] - 0.35),
            (radius[0] * 0.55, 1.35, radius[2] * 0.7),
            "scar_pale",
        )
        # Dorsal armor is deliberately irregular rather than a smooth shell.
        builder.ellipsoid(
            bone,
            (center[0], center[1] + radius[1] * 0.72, center[2] + 0.75),
            (radius[0] * 0.78, 1.45, radius[2] * 0.55),
            "chitin_black",
        )
        builder.ring_xy(
            bone,
            (center[0], center[1], center[2] + radius[2] * 0.35),
            radius[0] * 0.92,
            radius[1] * 0.92,
            0.72,
            "muck_black",
        )
        if index > 0:
            for side in (-1, 1):
                builder.cone(
                    bone,
                    (
                        center[0] + side * radius[0] * 0.72,
                        center[1] + 1.25,
                        center[2] + 0.9,
                    ),
                    (
                        center[0] + side * (radius[0] + 2.3),
                        center[1] + 2.0,
                        center[2] + 1.7,
                    ),
                    1.25,
                    "chitin_black",
                )
        if index in (1, 3, 4):
            side = -1 if index % 2 else 1
            builder.cone(
                bone,
                (center[0] + side * radius[0] * 0.72, center[1] + 2.8, center[2]),
                (
                    center[0] + side * (radius[0] + 1.4),
                    center[1] + 3.7,
                    center[2] + 2.8,
                ),
                1.05,
                "core_cyan" if index == 3 else "toxic_lime",
            )

    # The swollen gland is part of the body-led projectile telegraph.
    builder.ellipsoid("AcidSac", (0, -1.4, 28.2), (3.3, 2.7, 3.1), "toxic_lime")
    builder.ring_xy("AcidSac", (0, -1.4, 28.2), 3.6, 3.0, 0.55, "toxic_yellow")

    builder.ellipsoid("Head", (0, 0, 34), (7.2, 6.7, 7.0), "muck_black")
    builder.ellipsoid("Head", (0, 3.9, 35.3), (6.1, 3.1, 4.9), "chitin_black")
    builder.ellipsoid("Head", (0, -3.7, 31.8), (4.8, 2.1, 3.1), "scar_pale")

    # Carve a deep radial mouth into the forward (-Y) face.
    for cell in list(builder.cells):
        x, y, z = cell
        radial = (x / 5.25) ** 2 + ((z - 34) / 5.25) ** 2
        if y <= -2 and radial <= 1.0 and 27 <= z <= 41:
            del builder.cells[cell]
    builder.ring_xz("Head", (0, -5.9, 34), 5.9, 5.9, 1.35, "scar_red")
    builder.ring_xz("Head", (0, -6.7, 34), 4.55, 4.55, 0.7, "toxic_lime")
    builder.ellipsoid("Head", (0, -2.6, 34), (3.15, 1.15, 3.15), "scar_dark")

    for index in range(16):
        angle = math.tau * index / 16
        radius = 4.65 if index % 2 == 0 else 4.15
        base = (math.cos(angle) * radius, -6.2, 34 + math.sin(angle) * radius)
        tip = (
            math.cos(angle) * (2.15 if index % 2 == 0 else 2.55),
            -8.5,
            34 + math.sin(angle) * (2.15 if index % 2 == 0 else 2.55),
        )
        builder.cone("Head", base, tip, 0.82 if index % 2 == 0 else 0.68, "bone")

    # Blind sensory pits and mineral growths replace ordinary eyes.
    for side in (-1, 1):
        builder.ellipsoid(
            "Head", (side * 4.5, -4.4, 37.1), (1.0, 0.8, 1.0), "scar_dark"
        )
        builder.ellipsoid(
            "Head", (side * 2.9, -5.2, 39.1), (0.72, 0.6, 0.72), "toxic_yellow"
        )
        builder.cone(
            "Head",
            (side * 4.7, 3.6, 38.1),
            (side * 6.4, 5.1, 41.2),
            1.2,
            "core_cyan",
        )

    apply_baked_voxel_shading(builder)
    return builder


def set_transform(bone, transform: Mapping[str, Vec3]) -> None:
    if "location" in transform:
        bone.location = transform["location"]
    if "rotation" in transform:
        bone.rotation_euler = tuple(
            math.radians(value) for value in transform["rotation"]
        )
    if "scale" in transform:
        bone.scale = transform["scale"]


def create_action(
    armature_obj: bpy.types.Object, name: str, frames: Mapping[int, FrameTransform]
):
    reset_pose(armature_obj)
    action = bpy.data.actions.new(name=name)
    action.use_fake_user = True
    action["harthmereCreatureClip"] = name
    armature_obj.animation_data_create()
    armature_obj.animation_data.action = action
    for frame, pose in sorted(frames.items()):
        reset_pose(armature_obj)
        for bone_name, transform in pose.items():
            bone = armature_obj.pose.bones.get(bone_name)
            if not bone:
                continue
            set_transform(bone, transform)
            bone.keyframe_insert("location", frame=frame, group=bone_name)
            bone.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
            bone.keyframe_insert("scale", frame=frame, group=bone_name)
    action.frame_start = min(frames)
    action.frame_end = max(frames)
    reset_pose(armature_obj)
    return action


def wave_pose(
    frame_index: int, frame_count: int, amplitude: float, compression: float = 0.0
):
    phase = math.tau * frame_index / frame_count
    pose: FrameTransform = {
        "Root": {"location": (0, 0, 0.025 * math.sin(phase * 2))},
    }
    chain = ("Tail", "Body01", "Body02", "Body03", "Neck", "Head")
    for index, bone in enumerate(chain):
        sway = math.sin(phase - index * 0.7) * amplitude
        pitch = math.cos(phase - index * 0.55) * amplitude * 0.28
        pose[bone] = {
            "rotation": (pitch, sway, -sway * 0.16),
            "scale": (1.0 + compression * math.sin(phase - index * 0.8), 1.0, 1.0),
        }
    pose["AcidSac"] = {"scale": (1.0, 1.0, 1.0 + 0.045 * math.sin(phase * 2))}
    return pose


def build_actions(armature_obj: bpy.types.Object):
    actions = {}
    actions["Idle"] = create_action(
        armature_obj,
        "Idle",
        {frame: wave_pose(i, 4, 4.5) for i, frame in enumerate((1, 19, 37, 55, 73))},
    )
    actions["Walk"] = create_action(
        armature_obj,
        "Walk",
        {
            frame: wave_pose(i, 4, 10.5, 0.045)
            for i, frame in enumerate((1, 10, 19, 28, 37))
        },
    )
    actions["Run"] = create_action(
        armature_obj,
        "Run",
        {
            frame: wave_pose(i, 4, 17.0, 0.075)
            for i, frame in enumerate((1, 7, 13, 19, 25))
        },
    )
    actions["Attack"] = create_action(
        armature_obj,
        "Attack",
        {
            1: {},
            10: {
                "Body03": {"rotation": (12, -8, 0)},
                "Neck": {"rotation": (18, 10, 0)},
                "Head": {"scale": (0.94, 0.94, 0.96)},
            },
            18: {
                "Body03": {"rotation": (-18, 9, 0)},
                "Neck": {"rotation": (-42, -12, 0)},
                "Head": {"rotation": (-24, 0, 0), "scale": (1.16, 1.12, 1.1)},
            },
            27: {
                "Neck": {"rotation": (14, 7, 0)},
                "Head": {"rotation": (10, 0, 0), "scale": (1.04, 1.04, 1.02)},
            },
            43: {},
        },
    )
    actions["RangedAttack"] = create_action(
        armature_obj,
        "RangedAttack",
        {
            1: {},
            14: {
                "Body01": {"scale": (1.08, 1.08, 0.94)},
                "Body02": {"scale": (1.1, 1.1, 0.91)},
                "Body03": {"rotation": (10, 0, 0)},
                "AcidSac": {"scale": (1.18, 1.18, 1.25)},
            },
            28: {
                "Body01": {"scale": (1.12, 1.12, 0.9)},
                "Body02": {"scale": (1.15, 1.15, 0.86)},
                "Body03": {"rotation": (18, 0, 0)},
                "Neck": {"rotation": (22, 0, 0)},
                "Head": {"rotation": (14, 0, 0), "scale": (1.08, 1.08, 1.05)},
                "AcidSac": {"scale": (1.48, 1.48, 1.62)},
            },
            36: {
                "Body03": {"rotation": (-10, 0, 0)},
                "Neck": {"rotation": (-24, 0, 0)},
                "Head": {"rotation": (-18, 0, 0), "scale": (1.18, 1.14, 1.1)},
                "AcidSac": {"scale": (0.72, 0.72, 0.78)},
            },
            54: {},
        },
    )
    actions["HitReact"] = create_action(
        armature_obj,
        "HitReact",
        {
            1: {},
            7: {
                "Body02": {"rotation": (-9, 16, 6)},
                "Body03": {"rotation": (-12, 20, 8)},
                "Neck": {"rotation": (14, -18, -10)},
                "Head": {"rotation": (18, -24, -12)},
            },
            14: {
                "Body03": {"rotation": (6, -10, -4)},
                "Neck": {"rotation": (-8, 12, 5)},
                "Head": {"rotation": (-10, 14, 7)},
            },
            24: {},
        },
    )
    actions["Death"] = create_action(
        armature_obj,
        "Death",
        {
            1: {},
            18: {
                "Root": {"rotation": (0, 18, -8)},
                "Body02": {"rotation": (10, 16, 8)},
                "Neck": {"rotation": (-14, -12, 8)},
            },
            36: {
                "Root": {"rotation": (0, 52, -22)},
                "Body01": {"rotation": (18, 14, 10)},
                "Body03": {"rotation": (-22, -18, -12)},
                "Head": {"rotation": (24, 20, 18)},
            },
            54: {
                "Root": {"rotation": (0, 82, -34)},
                "Body01": {"rotation": (26, 18, 14)},
                "Body02": {"rotation": (-18, -16, -12)},
                "Body03": {"rotation": (24, 15, 14)},
                "Neck": {"rotation": (-28, -20, -18)},
                "Head": {"rotation": (32, 24, 22), "scale": (0.96, 0.96, 0.92)},
                "AcidSac": {"scale": (0.7, 0.7, 0.62)},
            },
            72: {
                "Root": {"rotation": (0, 86, -36)},
                "Body01": {"rotation": (24, 16, 12)},
                "Body02": {"rotation": (-16, -15, -10)},
                "Body03": {"rotation": (22, 14, 12)},
                "Neck": {"rotation": (-26, -18, -16)},
                "Head": {"rotation": (30, 22, 20), "scale": (0.96, 0.96, 0.92)},
                "AcidSac": {"scale": (0.68, 0.68, 0.6)},
            },
        },
    )
    return actions


def select_rig(mesh_obj, armature_obj):
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    armature_obj.select_set(True)
    bpy.context.view_layer.objects.active = armature_obj


def export_rig(mesh_obj, armature_obj, output: Path, export_format: str):
    output.parent.mkdir(parents=True, exist_ok=True)
    select_rig(mesh_obj, armature_obj)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format=export_format,
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


def embed_gltf_buffer(gltf_path: Path, bin_path: Path, authoring_path: Path):
    source = json.loads(gltf_path.read_text())
    authoring_path.write_text(json.dumps(source, indent=2) + "\n")
    source["buffers"][0][
        "uri"
    ] = "data:application/octet-stream;base64," + base64.b64encode(
        bin_path.read_bytes()
    ).decode(
        "ascii"
    )
    gltf_path.write_text(json.dumps(source, separators=(",", ":")))


def look_at(obj, target: Vec3):
    obj.rotation_euler = (
        (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    )


def render_preview(armature_obj, action, output: Path):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.004, 0.007, 0.009)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -1.0

    armature_obj.animation_data.action = action
    scene.frame_set(28)

    bpy.ops.object.camera_add(location=(2.85, -4.9, 2.15))
    camera = bpy.context.object
    camera.data.lens = 64
    look_at(camera, (0, 0, 0.98))
    scene.camera = camera

    for name, location, energy, color, size in (
        ("CaveKey", (2.8, -2.6, 3.6), 360, (0.68, 0.82, 1.0), 2.4),
        ("ToxicRim", (-2.7, 0.8, 2.8), 280, (0.42, 1.0, 0.18), 2.1),
        ("MouthFill", (0.0, -3.3, 1.45), 110, (0.5, 1.0, 0.34), 1.2),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.color = color
        light.data.shape = "DISK"
        light.data.size = size
        look_at(light, (0, 0, 1.0))

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.025))
    ground = bpy.context.object
    ground.name = "CavePreviewGround"
    material = bpy.data.materials.new("CavePreviewGround")
    material.diffuse_color = (0.025, 0.032, 0.038, 1)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.012, 0.018, 0.022, 1)
        bsdf.inputs["Roughness"].default_value = 0.94
    ground.data.materials.append(material)

    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def parse_args(argv: Sequence[str]):
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--preview-dir", type=Path)
    return parser.parse_args(argv)


def main():
    separator = sys.argv.index("--") + 1 if "--" in sys.argv else len(sys.argv)
    args = parse_args(sys.argv[separator:])
    repo_root = args.repo_root.resolve()
    preview_dir = (
        args.preview_dir.resolve()
        if args.preview_dir
        else repo_root / "artifacts/harthmere-indisworm"
    )
    source_dir = repo_root / "src/galois/data/npcs"

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    definition = BossDefinition(
        slug="indisworm",
        name="Indisworm",
        world_size=WORLD_SIZE,
        archetype="indisworm",
        preview_action="RangedAttack",
        preview_frame=28,
        special_clips=(),
        build=lambda: None,
    )
    builder = build_indisworm()
    min_corner, max_corner = builder_bounds(builder)
    normalizer = Normalizer(min_corner, max_corner)
    mesh_obj, bone_vertices = create_mesh(definition, builder, normalizer)
    armature_obj = create_armature(definition, builder, normalizer)
    bind_mesh(mesh_obj, armature_obj, bone_vertices)
    mesh_obj.name = "Indisworm_Mesh"
    armature_obj.name = "Indisworm_Armature"
    for obj in (mesh_obj, armature_obj):
        if "bossId" in obj:
            del obj["bossId"]
        obj["creatureId"] = "indisworm"
        obj["displayName"] = "Indisworm"
        obj["worldSize"] = list(WORLD_SIZE)
    armature_obj["requiredClips"] = json.dumps(CLIPS)

    actions = build_actions(armature_obj)
    source_dir.mkdir(parents=True, exist_ok=True)
    write_vox(builder, source_dir / "indisworm_mesh.vox")
    # Galois's LoadGLTF materializer reads one source file, so its production
    # input must carry a data-URI buffer. Blender 5.2 exports only separate GLTF;
    # preserve that authoring JSON, then embed its generated BIN deterministically.
    export_rig(mesh_obj, armature_obj, source_dir / "indisworm.gltf", "GLTF_SEPARATE")
    embed_gltf_buffer(
        source_dir / "indisworm.gltf",
        source_dir / "indisworm.bin",
        source_dir / "indisworm_source.gltf",
    )
    export_rig(mesh_obj, armature_obj, source_dir / "indisworm.glb", "GLB")
    bpy.ops.wm.save_as_mainfile(filepath=str(source_dir / "indisworm.blend"))

    preview_path = preview_dir / "indisworm_ranged_attack.png"
    render_preview(armature_obj, actions["RangedAttack"], preview_path)
    report = {
        "id": "indisworm",
        "displayName": "Indisworm",
        "worldSize": list(WORLD_SIZE),
        "clips": list(CLIPS),
        "socket": "Socket_Mouth",
        "voxelCount": len(builder.cells),
        "surfaceTriangleCount": len(mesh_obj.data.polygons) * 2,
        "files": {
            "vox": str((source_dir / "indisworm_mesh.vox").relative_to(repo_root)),
            "gltf": str((source_dir / "indisworm.gltf").relative_to(repo_root)),
            "authoringGltf": str(
                (source_dir / "indisworm_source.gltf").relative_to(repo_root)
            ),
            "glb": str((source_dir / "indisworm.glb").relative_to(repo_root)),
            "blend": str((source_dir / "indisworm.blend").relative_to(repo_root)),
            "preview": str(preview_path.relative_to(repo_root)),
        },
    }
    (preview_dir / "asset-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
