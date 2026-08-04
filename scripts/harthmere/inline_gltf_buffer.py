#!/usr/bin/env python3
"""Fold a staged .gltf + .bin export back into the embedded shipping format.

    python3 scripts/harthmere/inline_gltf_buffer.py

The shipping `character-animations.gltf` stores its buffer as an embedded
base64 data URI with no `.bin` sidecar. Blender removed the `GLTF_EMBEDDED`
export option in recent versions, so `export_expression_animations.py` writes a
separate .gltf + .bin pair into `tmp/animation_stage/` and this step inlines the
buffer so the asset keeps the exact shape the loader expects.

Refuses to install unless the result actually contains the re-authored clips, so
a failed or stale export cannot silently overwrite a good asset.
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import sys

# This file lives at <repo>/scripts/harthmere/, so climb two levels.
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STAGE = os.path.join(REPO, "tmp/animation_stage/character-animations.gltf")
DEST = os.path.join(REPO, "src/galois/data/animations/character-animations.gltf")
BACKUP = os.path.join(
    REPO, "tmp/animation_backup/character-animations.pre-expressions.gltf"
)

# Clips that must have grown; catalog declares 2.0-2.2 s for these.
EXPECTED_LONGER = {
    "CinematicApology": 1.4,
    "CinematicSad": 1.4,
    "CinematicCurious": 1.4,
    "CinematicEmbarrassed": 1.4,
}
# Clips that must NOT have changed.
EXPECTED_UNCHANGED = {"Idle", "DodgeLeft", "CinematicCower"}


def durations(gltf):
    acc = gltf["accessors"]
    out = {}
    for anim in gltf.get("animations", []):
        longest = 0.0
        for sampler in anim["samplers"]:
            longest = max(longest, acc[sampler["input"]].get("max", [0])[0])
        out[anim.get("name", "?")] = longest
    return out


def main():
    if not os.path.exists(STAGE):
        print(f"missing staged export: {STAGE}")
        print("run export_expression_animations.py in Blender first")
        return 1

    with open(STAGE) as fh:
        gltf = json.load(fh)

    stage_dir = os.path.dirname(STAGE)
    inlined = 0
    for buf in gltf.get("buffers", []):
        uri = buf.get("uri", "")
        if not uri or uri.startswith("data:"):
            continue
        binpath = os.path.join(stage_dir, uri)
        if not os.path.exists(binpath):
            print(f"missing buffer sidecar {binpath}")
            return 1
        with open(binpath, "rb") as fh:
            payload = fh.read()
        buf["uri"] = "data:application/octet-stream;base64," + base64.b64encode(
            payload
        ).decode("ascii")
        buf["byteLength"] = len(payload)
        inlined += 1

    # Images, if any, must also be embedded rather than left as sidecars.
    for img in gltf.get("images", []):
        uri = img.get("uri", "")
        if not uri or uri.startswith("data:"):
            continue
        path = os.path.join(stage_dir, uri)
        if os.path.exists(path):
            with open(path, "rb") as fh:
                data = fh.read()
            ext = os.path.splitext(uri)[1].lower()
            mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
            img["uri"] = f"data:{mime};base64," + base64.b64encode(data).decode("ascii")
            img["mimeType"] = mime

    new_dur = durations(gltf)

    old_dur = {}
    if os.path.exists(BACKUP):
        with open(BACKUP) as fh:
            old_dur = durations(json.load(fh))

    problems = []
    for name, minimum in EXPECTED_LONGER.items():
        got = new_dur.get(name)
        if got is None:
            problems.append(f"{name} missing from export")
        elif got < minimum:
            problems.append(f"{name} is {got:.2f}s, expected >= {minimum:.2f}s")
    for name in EXPECTED_UNCHANGED:
        if name in old_dur and name in new_dur:
            if abs(old_dur[name] - new_dur[name]) > 0.05:
                problems.append(
                    f"{name} changed {old_dur[name]:.2f}s -> {new_dur[name]:.2f}s "
                    "but should be untouched"
                )
    if old_dur and len(new_dur) != len(old_dur):
        problems.append(
            f"animation count changed {len(old_dur)} -> {len(new_dur)}"
        )

    if problems:
        print("REFUSING to install; staged export failed validation:")
        for p in problems:
            print("  -", p)
        return 1

    if os.path.exists(DEST) and not os.path.exists(BACKUP):
        os.makedirs(os.path.dirname(BACKUP), exist_ok=True)
        shutil.copy2(DEST, BACKUP)
        print(f"backed up -> {BACKUP}")

    with open(DEST, "w") as fh:
        json.dump(gltf, fh, separators=(",", ":"))

    print(f"inlined {inlined} buffer(s); installed {DEST}")
    print(f"animations: {len(new_dur)}")
    for name in sorted(set(EXPECTED_LONGER) | EXPECTED_UNCHANGED):
        if name in new_dur:
            was = f"{old_dur[name]:.2f}s -> " if name in old_dur else ""
            print(f"  {name:24} {was}{new_dur[name]:.2f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
