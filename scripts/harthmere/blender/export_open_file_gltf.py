"""Export the CURRENTLY OPEN .blend to a staged glTF. Run via Text > Run Script.

Open `character-animations_expressions.blend` in Blender first, then run this
from the Text Editor (Text menu -> Run Script).

WHY THIS EXISTS
---------------
`export_expression_animations.py` opened the .blend itself and then exported.
That fails, and not because of the Text Editor vs console distinction:
`bpy.ops.wm.open_mainfile()` replaces the whole context, including the screen
association, so by the time the exporter runs `bpy.context.active_object` no
longer resolves:

    File ".../io_scene_gltf2/blender/exp/export.py", line 23, in save
        if bpy.context.active_object is not None:
    AttributeError: 'Context' object has no attribute 'active_object'

Running the export against the already-open file keeps the UI context intact, so
the operator gets the `active_object` it expects.

Writes to tmp/animation_stage/ only. Nothing in src/ is touched here; the
separate .bin is folded back into the embedded shipping format by
`scripts/harthmere/inline_gltf_buffer.py`.
"""

import os

import bpy

REPO = "/Users/devindixon/Development/biomes-game"
STAGE_GLTF = os.path.join(REPO, "tmp/animation_stage/character-animations.gltf")

EXPECT_IN_NAME = "character-animations_expressions"


def main():
    current = bpy.data.filepath
    print(f"[export] open file: {current}")
    if EXPECT_IN_NAME not in os.path.basename(current):
        print(
            f"[export] REFUSING: expected a file named *{EXPECT_IN_NAME}*, "
            "open the re-authored .blend first"
        )
        return

    try:
        bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
    except Exception:
        pass

    # The exporter reads context.active_object; make sure one is set.
    if bpy.context.view_layer.objects.active is None:
        for obj in bpy.data.objects:
            bpy.context.view_layer.objects.active = obj
            break

    # Object mode: exporting from Edit mode can omit or stale mesh data.
    try:
        if bpy.context.object and bpy.context.object.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        pass

    os.makedirs(os.path.dirname(STAGE_GLTF), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=STAGE_GLTF,
        export_format="GLTF_SEPARATE",
        export_animations=True,
        export_skins=True,
        export_apply=False,
    )
    print(f"[export] staged -> {STAGE_GLTF}")
    print("[export] next: python3 scripts/harthmere/inline_gltf_buffer.py")


main()
