"""Inspect the channel makeup of the `once` expression clips before re-authoring.

    exec(open('/Users/devindixon/Development/biomes-game/scripts/harthmere/blender/inspect_once_clip_channels.py').read())

Read-only. Reports which bones and which transform channels each one-shot
expression drives, and the raw key times, so the re-author pass can extend them
correctly rather than guessing at the rig.
"""

import json
import os

import bpy

REPO = "/Users/devindixon/Development/biomes-game"
SRC = os.path.join(REPO, "src/galois/data/animations/character-animations.blend")
CATALOG = os.path.join(REPO, "src/shared/cutscene/cinematic_expression_catalog.json")
OUT = os.path.join(REPO, "tmp", "once_clip_channels.json")


def fcurves_of(action):
    legacy = getattr(action, "fcurves", None)
    if legacy is not None:
        return list(legacy)
    out = []
    for layer in getattr(action, "layers", []) or []:
        for strip in getattr(layer, "strips", []) or []:
            for bag in getattr(strip, "channelbags", []) or []:
                out.extend(bag.fcurves)
    return out


def main():
    catalog = json.load(open(CATALOG))
    once_clips = sorted(
        {
            spec["clip"]
            for spec in catalog.values()
            if spec["playback"] == "once"
        }
    )
    bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False)
    fps = bpy.context.scene.render.fps / max(1, bpy.context.scene.render.fps_base)

    report = {"fps": fps, "clips": {}}
    bone_union = {}
    prop_union = {}

    for name in once_clips:
        action = bpy.data.actions.get(name)
        if not action:
            report["clips"][name] = {"error": "missing"}
            continue
        fcs = fcurves_of(action)
        chans = {}
        times = set()
        for fc in fcs:
            path = fc.data_path
            bone = path.split('"')[1] if path.startswith('pose.bones["') else "<object>"
            prop = path.rsplit(".", 1)[-1]
            chans.setdefault(bone, set()).add(prop)
            bone_union[bone] = bone_union.get(bone, 0) + 1
            prop_union[prop] = prop_union.get(prop, 0) + 1
            for kp in fc.keyframe_points:
                times.add(round(kp.co[0], 2))
        start, end = action.frame_range
        report["clips"][name] = {
            "frame_start": round(start, 2),
            "frame_end": round(end, 2),
            "seconds": round((end - start) / fps, 3),
            "curves": len(fcs),
            "key_times": sorted(times),
            "bones": {b: sorted(p) for b, p in chans.items()},
        }

    report["bone_union"] = bone_union
    report["prop_union"] = prop_union

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(report, fh, indent=2)

    print(f"fps={fps}  once clips: {len(once_clips)}")
    print("bones driven across all once clips:", sorted(bone_union))
    print("transform channels used:", sorted(prop_union))
    sample = next(
        (n for n in once_clips if "error" not in report["clips"].get(n, {})), None
    )
    if sample:
        s = report["clips"][sample]
        print(f"\nsample {sample}: {s['seconds']}s frames {s['frame_start']}-{s['frame_end']}")
        print("  key times:", s["key_times"])
        for b, props in s["bones"].items():
            print(f"    {b:16} {props}")
    print("wrote", OUT)


main()
