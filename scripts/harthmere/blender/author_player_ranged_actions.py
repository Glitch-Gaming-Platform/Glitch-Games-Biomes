#!/usr/bin/env python3
"""Author production player bow actions on the canonical Biomes armature.

The release clip shares the bow gameplay clock: the string/arrow and body reach
their release pose at 0.280 seconds, and the complete action returns in 0.500
seconds. Gameplay translation remains engine-owned so the upper-body action can
layer over walking, running, jumping, evading, and dodging.
"""

from __future__ import annotations

import argparse
import copy
import os
import sys

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from add_native_movement_actions import (  # noqa: E402
    create_action,
    export_and_merge,
    neutral_rotations,
)


FPS = 24
END_FRAME = 12.0
IMPACT_FRAME = 0.280 * FPS
ACTION_NAMES = (
    "HarthmereBodyRangedDraw_Aligned_30",
    "HarthmereBodyRangedRelease_Aligned_30",
    "HarthmereBodyRangedReload_Aligned_30",
)


def args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--gltf", help="Existing canonical glTF to merge into")
    return parser.parse_args(argv)


def force_object_mode() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def armature():
    force_object_mode()
    rigs = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(rigs) != 1:
        raise RuntimeError(f"Expected one player armature, found {len(rigs)}")
    rig = rigs[0]
    rig.animation_data_create()
    rig.animation_data.use_nla = False
    if rig.animation_data.use_tweak_mode:
        rig.animation_data.use_tweak_mode = False
    return rig


def merged(neutral, values):
    pose = copy.deepcopy(neutral)
    pose.update(values)
    return pose


def action_fcurves(action):
    legacy = getattr(action, "fcurves", None)
    if legacy is not None:
        return list(legacy)
    curves = []
    for layer in getattr(action, "layers", []) or []:
        for strip in getattr(layer, "strips", []) or []:
            for bag in getattr(strip, "channelbags", []) or []:
                curves.extend(bag.fcurves)
    return curves


def polish(action):
    for curve in action_fcurves(action):
        for key in curve.keyframe_points:
            key.interpolation = "BEZIER"
            key.handle_left_type = "AUTO_CLAMPED"
            key.handle_right_type = "AUTO_CLAMPED"


def bow_pose(amount=1.0):
    """Right hand locks the held-item bow; left hand owns the string draw."""
    return {
        "Waist": (0.04 * amount, 0.0, -0.08 * amount),
        "Chest": (-0.08 * amount, 0.03 * amount, -0.18 * amount),
        "Head": (0.03 * amount, 0.0, 0.12 * amount),
        "R_Arm": (-1.18 * amount, -0.16 * amount, -0.14 * amount),
        "R_Forearm": (-0.18 * amount, 0.06 * amount, -0.08 * amount),
        "R_Hand": (-0.05 * amount, 0.02 * amount, 0.05 * amount),
        "Tool": (0.0, 0.02 * amount, 0.04 * amount),
        "L_Arm": (-0.82 * amount, 0.18 * amount, 0.74 * amount),
        "L_Forearm": (-1.10 * amount, -0.10 * amount, 0.34 * amount),
        "L_Hand": (-0.14 * amount, 0.12 * amount, 0.18 * amount),
    }


def released_pose():
    return {
        **bow_pose(1.0),
        "Chest": (-0.03, 0.01, -0.10),
        "Head": (0.01, 0.0, 0.08),
        "L_Arm": (-0.62, 0.08, 0.28),
        "L_Forearm": (-0.46, -0.03, 0.12),
        "L_Hand": (-0.06, 0.04, 0.06),
        "R_Arm": (-1.22, -0.12, -0.10),
        "Tool": (0.0, -0.02, 0.02),
    }


def create_draw(rig, neutral):
    action = create_action(
        rig,
        ACTION_NAMES[0],
        [
            (0.0, neutral),
            (2.0, merged(neutral, bow_pose(0.25))),
            (5.0, merged(neutral, bow_pose(0.68))),
            (8.0, merged(neutral, bow_pose(1.0))),
            (END_FRAME, merged(neutral, bow_pose(1.0))),
        ],
    )
    action["harthmereCombatProfile"] = "aaa-voxel-bow-v2"
    action["durationSeconds"] = 0.5
    action["upperBodyAdditive"] = True
    return action


def create_release(rig, neutral):
    full_draw = bow_pose(1.0)
    release = released_pose()
    action = create_action(
        rig,
        ACTION_NAMES[1],
        [
            (0.0, neutral),
            (2.0, merged(neutral, bow_pose(0.28))),
            (5.2, merged(neutral, bow_pose(0.82))),
            (IMPACT_FRAME - 0.5, merged(neutral, full_draw)),
            (IMPACT_FRAME, merged(neutral, release)),
            (IMPACT_FRAME + 0.8, merged(neutral, release)),
            (9.0, merged(neutral, bow_pose(0.48))),
            (11.0, merged(neutral, bow_pose(0.12))),
            (END_FRAME, neutral),
        ],
    )
    action["harthmereCombatProfile"] = "aaa-voxel-bow-v2"
    action["impactSeconds"] = 0.280
    action["durationSeconds"] = 0.500
    action["upperBodyAdditive"] = True
    action["bowHandLocked"] = True
    action["drawHandRelease"] = True
    return action


def create_reload(rig, neutral):
    reload_low = {
        **bow_pose(0.26),
        "L_Arm": (-0.18, 0.12, 0.34),
        "L_Forearm": (-0.72, -0.12, 0.26),
        "L_Hand": (-0.18, 0.14, 0.16),
    }
    nock = {
        **bow_pose(0.55),
        "L_Arm": (-0.58, 0.16, 0.54),
        "L_Forearm": (-0.94, -0.08, 0.30),
        "L_Hand": (-0.12, 0.10, 0.14),
    }
    action = create_action(
        rig,
        ACTION_NAMES[2],
        [
            (0.0, neutral),
            (3.0, merged(neutral, reload_low)),
            (7.0, merged(neutral, nock)),
            (10.0, merged(neutral, bow_pose(0.18))),
            (END_FRAME, neutral),
        ],
    )
    action["harthmereCombatProfile"] = "aaa-voxel-bow-v2"
    action["durationSeconds"] = 0.500
    action["upperBodyAdditive"] = True
    return action


def metadata():
    common = {
        "harthmereCombatProfile": "aaa-voxel-bow-v2",
        "durationSeconds": 0.500,
        "fps": FPS,
        "upperBodyAdditive": True,
        "locomotionCompatible": True,
    }
    return {
        ACTION_NAMES[0]: {**common, "family": "ranged_draw"},
        ACTION_NAMES[1]: {
            **common,
            "family": "ranged_release",
            "impactSeconds": 0.280,
            "phases": [
                {"name": "nockAndDraw", "start": 0.0, "end": 0.238},
                {"name": "release", "start": 0.238, "end": 0.280},
                {"name": "stringSnap", "start": 0.280, "end": 0.333},
                {"name": "recovery", "start": 0.333, "end": 0.500},
            ],
        },
        ACTION_NAMES[2]: {**common, "family": "ranged_reload"},
    }


def main() -> None:
    options = args()
    rig = armature()
    neutral = neutral_rotations(rig)
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = int(END_FRAME)

    actions = [
        create_draw(rig, neutral),
        create_release(rig, neutral),
        create_reload(rig, neutral),
    ]
    for action in actions:
        polish(action)

    force_object_mode()
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    if options.gltf:
        export_and_merge(os.path.abspath(options.gltf), ACTION_NAMES, metadata())
    print("PLAYER_RANGED_ACTIONS_UPDATED", os.path.basename(bpy.data.filepath), ",".join(ACTION_NAMES))


if __name__ == "__main__":
    main()
