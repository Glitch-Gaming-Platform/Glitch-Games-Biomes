"""Audit the ~71 cinematic expression clips for transition quality.

    exec(open('/Users/devindixon/Development/biomes-game/scripts/harthmere/blender/audit_expression_clips.py').read())

Blending is only half of a smooth transition. The other half is the clip itself:
if an expression's first frame is far from the idle pose, even a perfect
crossfade has to travel a long way in a short time and reads as a lurch.

For every Cinematic* action this measures:
  * frame count and keyframe density;
  * how far its first pose sits from the Idle rest pose (the "entry gap");
  * whether the clip starts and ends near the same pose, which decides whether
    a loop or hold settles cleanly;
  * interpolation modes, since linear keys read as robotic.

Read-only; writes JSON to tmp/expression_clip_audit.json.
"""

import json
import math
import os

import bpy

REPO = "/Users/devindixon/Development/biomes-game"
SRC = os.path.join(REPO, "src/galois/data/animations/character-animations.blend")
OUT = os.path.join(REPO, "tmp", "expression_clip_audit.json")


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


def pose_at(action, frame):
    """Sample every bone channel of an action at a frame, without evaluating."""
    pose = {}
    for fc in fcurves_of(action):
        if not fc.data_path.startswith('pose.bones["'):
            continue
        key = (fc.data_path, fc.array_index)
        try:
            pose[key] = fc.evaluate(frame)
        except Exception:
            pass
    return pose


def pose_distance(a, b, identity):
    """RMS difference over shared channels, ignoring channels absent in both.

    Rotation channels are compared against the identity quaternion default so a
    missing channel does not read as a large difference.
    """
    keys = set(a) | set(b)
    if not keys:
        return 0.0
    total = 0.0
    for k in keys:
        default = identity.get(k[0].rsplit(".", 1)[-1], 0.0)
        if k[1] == 0 and k[0].endswith("rotation_quaternion"):
            default = 1.0
        if k[0].endswith("scale"):
            default = 1.0
        total += (a.get(k, default) - b.get(k, default)) ** 2
    return math.sqrt(total / len(keys))


IDENTITY = {"location": 0.0, "rotation_quaternion": 0.0, "rotation_euler": 0.0, "scale": 1.0}


def main():
    bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    fps = bpy.context.scene.render.fps / max(1, bpy.context.scene.render.fps_base)

    idle = bpy.data.actions.get("Idle")
    idle_pose = pose_at(idle, idle.frame_range[0]) if idle else {}

    rows = []
    for action in bpy.data.actions:
        if not action.name.startswith("Cinematic"):
            continue
        fcs = fcurves_of(action)
        if not fcs:
            continue
        start, end = action.frame_range
        keys = sum(len(fc.keyframe_points) for fc in fcs)
        interp = {}
        for fc in fcs:
            for kp in fc.keyframe_points:
                interp[kp.interpolation] = interp.get(kp.interpolation, 0) + 1
        bones = {
            fc.data_path.split('"')[1]
            for fc in fcs
            if fc.data_path.startswith('pose.bones["')
        }
        first = pose_at(action, start)
        last = pose_at(action, end)
        rows.append(
            {
                "name": action.name,
                "frames": round(end - start, 2),
                "seconds": round((end - start) / fps, 3),
                "curves": len(fcs),
                "keyframes": keys,
                "keys_per_curve": round(keys / len(fcs), 2),
                "bones": len(bones),
                "entry_gap_from_idle": round(pose_distance(first, idle_pose, IDENTITY), 4),
                "start_end_gap": round(pose_distance(first, last, IDENTITY), 4),
                "interpolation": interp,
                "linear_fraction": round(
                    interp.get("LINEAR", 0) / max(1, keys), 3
                ),
                "constant_fraction": round(
                    interp.get("CONSTANT", 0) / max(1, keys), 3
                ),
            }
        )

    rows.sort(key=lambda r: -r["entry_gap_from_idle"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump({"fps": fps, "clips": rows}, fh, indent=2)

    print(f"fps={fps}  expression clips found: {len(rows)}")
    print(f"{'clip':30}{'secs':>7}{'keys':>6}{'k/c':>6}{'bones':>7}{'entry':>9}{'loopgap':>9}{'linear':>8}")
    for r in rows[:20]:
        print(
            f"{r['name'][:30]:30}{r['seconds']:>7.2f}{r['keyframes']:>6}"
            f"{r['keys_per_curve']:>6}{r['bones']:>7}"
            f"{r['entry_gap_from_idle']:>9.3f}{r['start_end_gap']:>9.3f}"
            f"{r['linear_fraction']:>8.0%}"
        )
    if rows:
        gaps = [r["entry_gap_from_idle"] for r in rows]
        print(f"\nentry gap  min={min(gaps):.3f}  median={sorted(gaps)[len(gaps)//2]:.3f}  max={max(gaps):.3f}")
        lin = [r for r in rows if r["linear_fraction"] > 0.5]
        print(f"clips majority-LINEAR: {len(lin)}")
        thin = [r for r in rows if r["keys_per_curve"] < 2.5]
        print(f"clips under 2.5 keys/curve: {len(thin)} {[r['name'] for r in thin][:8]}")
    print("wrote", OUT)


main()
