"""Audit Harthmere combat .blend assets from inside Blender.

Run from Blender's Python console (Scripting workspace):

    exec(open('/Users/devindixon/Development/biomes-game/scripts/harthmere/blender/audit_combat_assets.py').read())

Read-only. It opens each .blend to inspect it and never saves, so the source
files are untouched. Results are written as JSON so they can be diffed between
runs and read outside Blender.
"""

import json
import os

import bpy

REPO = "/Users/devindixon/Development/biomes-game"
OUT = os.path.join(REPO, "tmp", "blender_combat_asset_audit.json")

TARGETS = [
    "src/galois/data/animations/character-animations.blend",
    "src/galois/data/npcs/indisworm.blend",
    "src/galois/data/projectiles/harthmere_premium_projectiles.blend",
    "src/galois/data/projectiles/harthmere_boss_attack_shapes.blend",
    "src/galois/data/npcs/dragon_animations.blend",
    "src/galois/data/npcs/big_mucker_animations.blend",
    "src/galois/data/npcs/hexer_animations.blend",
    "src/galois/data/npcs/tree_mucker_animations.blend",
]


def action_fcurves(action):
    """Return an action's F-curves across both Blender action APIs.

    Blender 4.4 replaced the flat `Action.fcurves` collection with slotted
    actions (layers -> strips -> channelbags). 5.2 removed the legacy attribute
    outright, so reading it raises AttributeError on every action.
    """
    legacy = getattr(action, "fcurves", None)
    if legacy is not None:
        return list(legacy)
    curves = []
    for layer in getattr(action, "layers", []) or []:
        for strip in getattr(layer, "strips", []) or []:
            for bag in getattr(strip, "channelbags", []) or []:
                curves.extend(bag.fcurves)
    return curves


def action_summary(action):
    """Keyframe density tells us whether a clip is authored or a 2-pose stub."""
    fcurves = action_fcurves(action)
    curves = len(fcurves)
    keys = sum(len(fc.keyframe_points) for fc in fcurves)
    try:
        start, end = action.frame_range
    except Exception:
        start, end = 0.0, 0.0
    frames = max(0.0, end - start)
    bones = set()
    for fc in fcurves:
        path = fc.data_path
        if path.startswith('pose.bones["'):
            bones.add(path.split('"')[1])
    return {
        "name": action.name,
        "frame_start": round(start, 2),
        "frame_end": round(end, 2),
        "frames": round(frames, 2),
        "fcurves": curves,
        "keyframes": keys,
        "bones_touched": len(bones),
        # A clip with <= 2 keys per curve is a linear A->B pose, not animation.
        "keys_per_curve": round(keys / curves, 2) if curves else 0,
    }


def inspect(rel_path):
    path = os.path.join(REPO, rel_path)
    if not os.path.exists(path):
        return {"file": rel_path, "error": "missing"}
    bpy.ops.wm.open_mainfile(filepath=path, load_ui=False)

    meshes = []
    tris = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        me = obj.data
        try:
            me.calc_loop_triangles()
            t = len(me.loop_triangles)
        except Exception:
            t = 0
        tris += t
        meshes.append(
            {
                "name": obj.name,
                "tris": t,
                "verts": len(me.vertices),
                "materials": [m.name for m in me.materials if m],
                "uv_layers": len(me.uv_layers),
                "color_attributes": len(getattr(me, "color_attributes", []) or []),
                "shape_keys": len(me.shape_keys.key_blocks) if me.shape_keys else 0,
                "modifiers": [m.type for m in obj.modifiers],
            }
        )

    armatures = [
        {
            "name": obj.name,
            "bones": len(obj.data.bones),
            "bone_names": [b.name for b in obj.data.bones][:80],
        }
        for obj in bpy.data.objects
        if obj.type == "ARMATURE"
    ]

    materials = []
    for mat in bpy.data.materials:
        node_types = []
        if mat.use_nodes and mat.node_tree:
            node_types = sorted({n.type for n in mat.node_tree.nodes})
        materials.append(
            {
                "name": mat.name,
                "use_nodes": mat.use_nodes,
                "node_types": node_types,
                "has_image": "TEX_IMAGE" in node_types,
            }
        )

    return {
        "file": rel_path,
        "total_tris": tris,
        "mesh_count": len(meshes),
        "meshes": meshes,
        "armatures": armatures,
        "material_count": len(materials),
        "materials_with_image_texture": sum(1 for m in materials if m["has_image"]),
        "materials": materials,
        "images": [
            {"name": i.name, "size": list(i.size), "filepath": i.filepath}
            for i in bpy.data.images
            if i.name != "Render Result"
        ],
        "action_count": len(bpy.data.actions),
        "actions": [action_summary(a) for a in bpy.data.actions],
    }


def main():
    results = []
    for rel in TARGETS:
        print("[audit] opening", rel)
        try:
            results.append(inspect(rel))
        except Exception as exc:  # keep going; one bad file shouldn't stop the run
            results.append({"file": rel, "error": repr(exc)})

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as handle:
        json.dump(results, handle, indent=2)
    print("[audit] wrote", OUT)

    for entry in results:
        if "error" in entry:
            print(f"  {entry['file']}: ERROR {entry['error']}")
            continue
        print(
            f"  {os.path.basename(entry['file']):42} "
            f"tris={entry['total_tris']:>8} "
            f"mats={entry['material_count']:>3} "
            f"textured={entry['materials_with_image_texture']:>3} "
            f"actions={entry['action_count']:>3}"
        )


main()
