#!/usr/bin/env python3
"""Validate every generated Harthmere Galois export in the local bucket."""

import json
from pathlib import Path

import pygltflib


ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = ROOT / "src/galois/data"
BUCKET_ROOT = ROOT / "public/buckets/biomes-static"
MANIFEST = json.loads(
    (DATA_ROOT / "harthmere/used_assets.generated.json").read_text()
)
INDEX = json.loads(
    (
        ROOT / "src/galois/js/interface/gen/asset_versions.json"
    ).read_text()
)["paths"]


def source_path(entry):
    relative = (
        entry["convertedPath"]
        if entry["kind"] in ("obj", "fbx")
        else entry["sourcePath"]
    )
    return (DATA_ROOT / relative).resolve()


def names(values):
    return {value.name for value in values if value.name}


def validate_model(entry, output_path: Path):
    payload = output_path.read_bytes()
    assert payload.startswith(b"glTF"), entry["logicalPath"]
    output = pygltflib.GLTF2().load_from_bytes(payload)
    source = pygltflib.GLTF2().load(str(source_path(entry)))

    for buffer in output.buffers:
        assert buffer.uri is None or buffer.uri.startswith("data:"), (
            entry["logicalPath"],
            buffer.uri,
        )
    for image in output.images:
        assert image.uri is None or image.uri.startswith("data:"), (
            entry["logicalPath"],
            image.uri,
        )

    source_animations = names(source.animations)
    output_animations = names(output.animations)
    assert source_animations <= output_animations, (
        entry["logicalPath"],
        sorted(source_animations - output_animations),
    )

    # Named sockets and bones are runtime contracts. Ordinary decorative node
    # names may be merged by gltfpack, so enforce the attachment vocabulary.
    attachment_names = {
        name
        for name in names(source.nodes)
        if any(
            token in name.lower()
            for token in ("socket", "attach", "hand", "grip", "muzzle")
        )
    }
    assert attachment_names <= names(output.nodes), (
        entry["logicalPath"],
        sorted(attachment_names - names(output.nodes)),
    )

    if output.meshes:
        assert "EXT_meshopt_compression" in (output.extensionsUsed or []), (
            entry["logicalPath"],
            output.extensionsUsed,
        )
    if output.images:
        assert "KHR_texture_basisu" in (output.extensionsUsed or []), (
            entry["logicalPath"],
            output.extensionsUsed,
        )
        assert all(image.mimeType == "image/ktx2" for image in output.images), (
            entry["logicalPath"],
            [image.mimeType for image in output.images],
        )


def main():
    checked_models = 0
    checked_images = 0
    for entry in MANIFEST["entries"]:
        public_path = INDEX.get(entry["logicalPath"])
        assert public_path, entry["logicalPath"]
        output_path = BUCKET_ROOT / public_path
        assert output_path.is_file(), output_path
        if entry["kind"] == "image":
            assert output_path.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"), (
                entry["logicalPath"]
            )
            checked_images += 1
        else:
            validate_model(entry, output_path)
            checked_models += 1
    print(
        f"Validated {checked_models} self-contained GLBs and "
        f"{checked_images} PNG exports."
    )


if __name__ == "__main__":
    main()
