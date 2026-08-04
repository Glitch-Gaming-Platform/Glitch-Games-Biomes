"""Export the re-authored expression clips into the shipping glTF.

Run headless (this is the reliable path — see NOTE below):

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python scripts/harthmere/blender/export_expression_animations.py

WHAT THIS DOES
--------------
`reauthor_once_expressions.py` wrote its result to a parallel file,
`character-animations_expressions.blend`, and deliberately did not touch the
source. But the artifact the game actually loads is
`src/galois/data/animations/character-animations.gltf`
(`src/galois/js/assets/wearables.ts:59` -> `LoadGLTF("animations/character-animations.gltf")`).

Until that glTF is regenerated, the re-authored clips do not ship: the exported
file still contains the original 0.75 s one-shots.

This script opens the re-authored .blend and writes the glTF in place, backing
up the previous one first.

NOTE ON CONTEXT
---------------
Blender's glTF add-on reads `bpy.context.active_object` during export, which does
not exist when an operator is driven from the interactive Python console — the
export fails with `AttributeError: 'Context' object has no attribute
'active_object'`, and a `temp_override` does not help because the add-on re-reads
the global context internally. Running with `--background --python` gives the
operator a proper context, so use the command above rather than pasting this
into the console.
"""

import os
import shutil
import sys

import bpy

REPO = "/Users/devindixon/Development/biomes-game"
SRC = os.path.join(
    REPO, "src/galois/data/animations/character-animations_expressions.blend"
)
DEST_GLTF = os.path.join(REPO, "src/galois/data/animations/character-animations.gltf")
BACKUP_GLTF = os.path.join(
    REPO, "tmp/animation_backup/character-animations.pre-expressions.gltf"
)
STAGE_GLTF = os.path.join(REPO, "tmp/animation_stage/character-animations.gltf")


def main():
    if not os.path.exists(SRC):
        print(f"[export] missing {SRC}; run reauthor_once_expressions.py first")
        return 1

    bpy.ops.preferences.addon_enable(module="io_scene_gltf2")

    if os.path.exists(DEST_GLTF):
        os.makedirs(os.path.dirname(BACKUP_GLTF), exist_ok=True)
        if not os.path.exists(BACKUP_GLTF):
            shutil.copy2(DEST_GLTF, BACKUP_GLTF)
            print(f"[export] backed up original glTF -> {BACKUP_GLTF}")

    bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False)

    for obj in bpy.data.objects:
        try:
            bpy.context.view_layer.objects.active = obj
            break
        except Exception:
            pass

    # The shipping asset has an EMBEDDED buffer (data URI, no .bin sidecar), so
    # the export must not introduce a sidecar. `GLTF_EMBEDDED` was removed in
    # recent Blender versions, so export separate into a scratch directory and
    # let `inline_gltf_buffer.py` fold the .bin back into a data URI.
    os.makedirs(os.path.dirname(STAGE_GLTF), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=STAGE_GLTF,
        export_format="GLTF_SEPARATE",
        export_animations=True,
        export_skins=True,
        export_apply=False,
    )
    print(f"[export] staged {STAGE_GLTF}")
    print("[export] now run, outside Blender:")
    print("    python3 scripts/harthmere/inline_gltf_buffer.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
