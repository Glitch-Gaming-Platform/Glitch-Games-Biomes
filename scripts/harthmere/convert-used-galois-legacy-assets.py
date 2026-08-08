#!/usr/bin/env python3
"""Batch-convert the used Harthmere OBJ/FBX sources to GLB with Blender."""

import argparse
import json
import sys
import traceback
from pathlib import Path

import bpy


def script_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--data-root", required=True)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.curves,
        bpy.data.armatures,
        bpy.data.actions,
    ):
        for value in list(collection):
            if value.users == 0:
                collection.remove(value)


def convert(entry, data_root: Path, force: bool):
    source = (data_root / entry["sourcePath"]).resolve()
    output = (data_root / entry["convertedPath"]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if not force and output.exists() and output.stat().st_mtime >= source.stat().st_mtime:
        print(f"SKIP {entry['logicalPath']}")
        return

    clear_scene()
    if entry["kind"] == "obj":
        bpy.ops.wm.obj_import(filepath=str(source))
    elif entry["kind"] == "fbx":
        bpy.ops.import_scene.fbx(filepath=str(source), use_anim=True)
    else:
        raise ValueError(f"Unsupported legacy kind: {entry['kind']}")

    if not bpy.context.scene.objects:
        raise RuntimeError(f"No objects imported from {source}")

    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_yup=True,
        export_animations=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_skins=True,
        export_morph=True,
        export_cameras=False,
        export_lights=False,
    )
    print(f"WROTE {entry['logicalPath']} -> {output}")


def main():
    args = script_args()
    manifest_path = Path(args.manifest).resolve()
    data_root = Path(args.data_root).resolve()
    manifest = json.loads(manifest_path.read_text())
    entries = [
        entry
        for entry in manifest["entries"]
        if entry["kind"] in ("obj", "fbx")
    ]

    failures = []
    for index, entry in enumerate(entries, start=1):
        print(f"[{index}/{len(entries)}] {entry['logicalPath']}")
        try:
            convert(entry, data_root, args.force)
        except Exception as error:  # Blender reports importer errors dynamically.
            failures.append((entry["logicalPath"], str(error)))
            traceback.print_exc()

    if failures:
        print("Legacy conversion failures:", file=sys.stderr)
        for logical_path, error in failures:
            print(f"  {logical_path}: {error}", file=sys.stderr)
        raise SystemExit(1)
    print(f"Converted {len(entries)} used legacy assets.")


if __name__ == "__main__":
    main()
