"""Deep-inspect the player dodge / evade / double-jump clips.

    exec(open('/Users/devindixon/Development/biomes-game/scripts/harthmere/blender/audit_movement_action_clips.py').read())

The earlier asset audit established these clips exist and are densely keyed.
This one asks whether they are *right*: does clip length match the gameplay
window, do they carry root motion that would fight code-driven displacement, is
the interpolation eased or linear, and do keys land on the phase boundaries the
gameplay state machine expects.

Read-only. Writes JSON to tmp/movement_action_clip_audit.json.
"""

import json
import os

import bpy

REPO = "/Users/devindixon/Development/biomes-game"
SRC = os.path.join(REPO, "src/galois/data/animations/character-animations.blend")
OUT = os.path.join(REPO, "tmp", "movement_action_clip_audit.json")

# Gameplay windows from PLAYER_MOVEMENT_ACTION_TIMING / PLAYER_ROLL_DODGE_EVENTS.
GAMEPLAY = {
    "DodgeLeft": {"action": "dodge", "duration": 0.50, "control_lock": 0.46,
                  "move": (0.05, 0.42), "iframes": (0.10, 0.28)},
    "DodgeRight": {"action": "dodge", "duration": 0.50, "control_lock": 0.46,
                   "move": (0.05, 0.42), "iframes": (0.10, 0.28)},
    "DodgeForward": {"action": "dodge", "duration": 0.50, "control_lock": 0.46,
                     "move": (0.05, 0.42), "iframes": (0.10, 0.28)},
    "DodgeBack": {"action": "dodge", "duration": 0.50, "control_lock": 0.46,
                  "move": (0.05, 0.42), "iframes": (0.10, 0.28)},
    "EvadeRoll": {"action": "evade", "duration": 0.75, "control_lock": 0.62,
                  "move": (0.10, 0.55), "iframes": (0.15, 0.40)},
    "DoubleJump": {"action": "doubleJump", "duration": 0.50, "control_lock": 0.0,
                   "move": (0.0, 0.0), "iframes": None},
}

ROOT_BONES = {"Waist", "Chest", "Root", "Hips"}


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


def bone_of(path):
    if path.startswith('pose.bones["'):
        return path.split('"')[1]
    return None


def analyse(action, fps):
    curves = fcurves_of(action)
    start, end = action.frame_range
    frames = end - start
    seconds = frames / fps

    interp = {}
    easing_keys = 0
    total_keys = 0
    per_bone = {}
    root_translation = {}
    key_times = set()

    for fc in curves:
        b = bone_of(fc.data_path)
        prop = fc.data_path.rsplit(".", 1)[-1]
        if b:
            per_bone.setdefault(b, set()).add(prop)
        for kp in fc.keyframe_points:
            total_keys += 1
            mode = kp.interpolation
            interp[mode] = interp.get(mode, 0) + 1
            if mode in ("BEZIER", "SINE", "QUAD", "CUBIC", "EXPO", "BACK", "ELASTIC"):
                easing_keys += 1
            key_times.add(round((kp.co[0] - start) / max(frames, 1e-9), 3))
        if b in ROOT_BONES and prop == "location":
            vals = [kp.co[1] for kp in fc.keyframe_points]
            if vals:
                span = max(vals) - min(vals)
                axis = "xyz"[fc.array_index] if fc.array_index < 3 else "?"
                root_translation[f"{b}.{axis}"] = round(span, 4)

    return {
        "frames": round(frames, 2),
        "seconds": round(seconds, 4),
        "curves": len(curves),
        "keyframes": total_keys,
        "bones": len(per_bone),
        "interpolation": interp,
        "eased_fraction": round(easing_keys / total_keys, 3) if total_keys else 0,
        "root_translation_span": root_translation,
        "normalised_key_times": sorted(key_times),
    }


def main():
    bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False)
    fps = bpy.context.scene.render.fps / max(1, bpy.context.scene.render.fps_base)

    report = {"fps": fps, "clips": {}}
    for name, gp in GAMEPLAY.items():
        action = bpy.data.actions.get(name)
        if not action:
            report["clips"][name] = {"error": "missing"}
            continue
        info = analyse(action, fps)
        info["gameplay"] = gp
        info["clip_vs_gameplay_ratio"] = round(info["seconds"] / gp["duration"], 3)
        info["timing_mismatch_ms"] = round((info["seconds"] - gp["duration"]) * 1000, 1)
        report["clips"][name] = info

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(report, fh, indent=2)

    print(f"scene fps = {fps}")
    print(f"{'clip':14}{'clip s':>8}{'game s':>8}{'delta ms':>10}{'ratio':>7}"
          f"{'bones':>7}{'keys':>6}{'eased':>7}  root-motion")
    for name, info in report["clips"].items():
        if "error" in info:
            print(f"{name:14} MISSING")
            continue
        rm = info["root_translation_span"] or "-"
        print(
            f"{name:14}{info['seconds']:>8.3f}{info['gameplay']['duration']:>8.2f}"
            f"{info['timing_mismatch_ms']:>10.0f}{info['clip_vs_gameplay_ratio']:>7.2f}"
            f"{info['bones']:>7}{info['keyframes']:>6}"
            f"{info['eased_fraction']:>7.0%}  {rm}"
        )
    print("wrote", OUT)


main()
