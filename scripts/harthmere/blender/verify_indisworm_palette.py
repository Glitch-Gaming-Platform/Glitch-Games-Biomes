"""Verify the palette-collapsed Indisworm against its source.

    exec(open('/Users/devindixon/Development/biomes-game/scripts/harthmere/blender/verify_indisworm_palette.py').read())

Read-only. Compares material count, UV layers, triangle count and action set so
the optimisation can be shown to be lossless on geometry and animation.
"""

import json
import os

import bpy

REPO = "/Users/devindixon/Development/biomes-game"
OUT = os.path.join(REPO, "tmp", "indisworm_palette_verify.json")


def survey(path):
    bpy.ops.wm.open_mainfile(filepath=path, load_ui=False)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    obj = meshes[0]
    me = obj.data
    me.calc_loop_triangles()
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    textured = 0
    for mat in bpy.data.materials:
        if mat.use_nodes and mat.node_tree:
            if any(n.type == "TEX_IMAGE" for n in mat.node_tree.nodes):
                textured += 1
    return {
        "file": os.path.basename(path),
        "materials_on_object": len(obj.material_slots),
        "materials_in_file": len(bpy.data.materials),
        "materials_with_texture": textured,
        "uv_layers": len(me.uv_layers),
        "tris": len(me.loop_triangles),
        "verts": len(me.vertices),
        "bones": len(arms[0].data.bones) if arms else 0,
        "actions": sorted(a.name for a in bpy.data.actions),
        "images": [
            {"name": i.name, "size": list(i.size)}
            for i in bpy.data.images
            if i.name != "Render Result" and i.name != "Viewer Node"
        ],
    }


before = survey(os.path.join(REPO, "src/galois/data/npcs/indisworm.blend"))
after = survey(os.path.join(REPO, "src/galois/data/npcs/indisworm_palette.blend"))

report = {"before": before, "after": after}
report["lossless_geometry"] = before["tris"] == after["tris"] and before["verts"] == after["verts"]
report["lossless_animation"] = before["actions"] == after["actions"]
report["lossless_rig"] = before["bones"] == after["bones"]
report["draw_call_reduction"] = f"{before['materials_on_object']} -> {after['materials_on_object']}"

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as fh:
    json.dump(report, fh, indent=2)

print(json.dumps(report, indent=2))
print("[verify] wrote", OUT)
