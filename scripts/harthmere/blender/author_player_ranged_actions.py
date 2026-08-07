#!/usr/bin/env python3
"""Author production player bow and energy-gun actions.

Bow release shares the 0.280-second paid-arrow clock. Energy-gun recoil shares
the ordinary 0.520-second ranged contact clock. Both families keep hips/root
locked so their AAA upper-body silhouettes can layer over locomotion.
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
BOW_END_FRAME = 12.0
BOW_IMPACT_FRAME = 0.280 * FPS
GUN_END_FRAME = 18.0
GUN_IMPACT_FRAME = 0.520 * FPS
ACTION_NAMES = (
    "HarthmereBodyRangedDraw_Aligned_30",
    "HarthmereBodyRangedRelease_Aligned_30",
    "HarthmereBodyRangedReload_Aligned_30",
    "HarthmereBodyBowAim_Aligned_30",
    "HarthmereBodyBowRelease_Aligned_30",
    "HarthmereBodyGunAim_Aligned_30",
    "HarthmereBodyGunFire_Aligned_30",
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


def gun_pose(amount=1.0):
    """Extend the Tool hand toward the target and brace with the off hand."""
    return {
        "Waist": (0.025 * amount, 0.0, -0.055 * amount),
        "Chest": (-0.045 * amount, 0.015 * amount, -0.115 * amount),
        "Head": (0.015 * amount, 0.0, 0.085 * amount),
        "R_Arm": (-1.34 * amount, -0.09 * amount, -0.035 * amount),
        "R_Forearm": (-0.13 * amount, 0.025 * amount, -0.025 * amount),
        "R_Hand": (-0.035 * amount, 0.015 * amount, 0.025 * amount),
        "Tool": (0.0, -0.015 * amount, 0.015 * amount),
        "L_Arm": (-0.58 * amount, 0.12 * amount, 0.34 * amount),
        "L_Forearm": (-0.82 * amount, -0.08 * amount, 0.20 * amount),
        "L_Hand": (-0.10 * amount, 0.08 * amount, 0.10 * amount),
    }


def gun_recoil_pose():
    return {
        **gun_pose(1.0),
        "Chest": (-0.015, 0.02, -0.075),
        "Head": (-0.015, 0.0, 0.065),
        "R_Arm": (-1.20, -0.07, -0.02),
        "R_Forearm": (-0.05, 0.02, -0.015),
        "R_Hand": (-0.02, 0.01, 0.01),
        "Tool": (-0.08, -0.01, 0.025),
        "L_Arm": (-0.52, 0.10, 0.28),
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
            (BOW_END_FRAME, merged(neutral, bow_pose(1.0))),
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
            (BOW_IMPACT_FRAME - 0.5, merged(neutral, full_draw)),
            (BOW_IMPACT_FRAME, merged(neutral, release)),
            (BOW_IMPACT_FRAME + 0.8, merged(neutral, release)),
            (9.0, merged(neutral, bow_pose(0.48))),
            (11.0, merged(neutral, bow_pose(0.12))),
            (BOW_END_FRAME, neutral),
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
            (BOW_END_FRAME, neutral),
        ],
    )
    action["harthmereCombatProfile"] = "aaa-voxel-bow-v2"
    action["durationSeconds"] = 0.500
    action["upperBodyAdditive"] = True
    return action


def create_bow_aim(rig, neutral):
    full_draw = bow_pose(1.0)
    breathe = {
        **full_draw,
        "Chest": (-0.075, 0.028, -0.175),
        "Head": (0.028, 0.0, 0.115),
        "L_Hand": (-0.13, 0.115, 0.19),
    }
    action = create_action(
        rig,
        ACTION_NAMES[3],
        [
            (0.0, merged(neutral, full_draw)),
            (6.0, merged(neutral, breathe)),
            (BOW_END_FRAME, merged(neutral, full_draw)),
        ],
    )
    action["harthmereCombatProfile"] = "aaa-voxel-bow-v3-target-stance"
    action["durationSeconds"] = 0.500
    action["upperBodyAdditive"] = True
    action["targetRequired"] = True
    return action


def create_bow_release(rig, neutral):
    full_draw = bow_pose(1.0)
    release = released_pose()
    quick_redraw = bow_pose(0.72)
    action = create_action(
        rig,
        ACTION_NAMES[4],
        [
            (0.0, merged(neutral, full_draw)),
            (BOW_IMPACT_FRAME - 0.65, merged(neutral, full_draw)),
            (BOW_IMPACT_FRAME, merged(neutral, release)),
            (BOW_IMPACT_FRAME + 0.8, merged(neutral, release)),
            (9.2, merged(neutral, bow_pose(0.38))),
            (BOW_END_FRAME, merged(neutral, quick_redraw)),
        ],
    )
    action["harthmereCombatProfile"] = "aaa-voxel-bow-v3-target-stance"
    action["impactSeconds"] = 0.280
    action["durationSeconds"] = 0.500
    action["upperBodyAdditive"] = True
    action["targetRequired"] = True
    action["bowHandLocked"] = True
    action["drawHandRelease"] = True
    return action


def create_gun_aim(rig, neutral):
    aim = gun_pose(1.0)
    breathe = {
        **aim,
        "Chest": (-0.04, 0.018, -0.108),
        "Head": (0.012, 0.0, 0.08),
        "L_Hand": (-0.095, 0.075, 0.105),
    }
    action = create_action(
        rig,
        ACTION_NAMES[5],
        [
            (0.0, merged(neutral, aim)),
            (6.0, merged(neutral, breathe)),
            (BOW_END_FRAME, merged(neutral, aim)),
        ],
    )
    action["harthmereCombatProfile"] = "aaa-voxel-energy-gun-v1"
    action["durationSeconds"] = 0.500
    action["upperBodyAdditive"] = True
    action["targetRequired"] = True
    action["straightToolArm"] = True
    return action


def create_gun_fire(rig, neutral):
    aim = gun_pose(1.0)
    recoil = gun_recoil_pose()
    overshoot = {
        **gun_pose(0.94),
        "Chest": (-0.055, 0.012, -0.125),
        "R_Arm": (-1.27, -0.08, -0.025),
        "Tool": (0.035, -0.01, 0.005),
    }
    action = create_action(
        rig,
        ACTION_NAMES[6],
        [
            (0.0, merged(neutral, aim)),
            (GUN_IMPACT_FRAME - 0.75, merged(neutral, aim)),
            (GUN_IMPACT_FRAME, merged(neutral, recoil)),
            (GUN_IMPACT_FRAME + 1.0, merged(neutral, recoil)),
            (15.0, merged(neutral, overshoot)),
            (GUN_END_FRAME, merged(neutral, aim)),
        ],
    )
    action["harthmereCombatProfile"] = "aaa-voxel-energy-gun-v1"
    action["impactSeconds"] = 0.520
    action["durationSeconds"] = 0.750
    action["upperBodyAdditive"] = True
    action["targetRequired"] = True
    action["straightToolArm"] = True
    action["recoilAuthored"] = True
    return action


def metadata():
    common = {
        "harthmereCombatProfile": "aaa-voxel-bow-v2",
        "durationSeconds": 0.500,
        "fps": FPS,
        "upperBodyAdditive": True,
        "locomotionCompatible": True,
    }
    gun_common = {
        "harthmereCombatProfile": "aaa-voxel-energy-gun-v1",
        "fps": FPS,
        "upperBodyAdditive": True,
        "locomotionCompatible": True,
        "targetRequired": True,
        "straightToolArm": True,
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
        ACTION_NAMES[3]: {
            **common,
            "harthmereCombatProfile": "aaa-voxel-bow-v3-target-stance",
            "family": "bow_aim",
            "targetRequired": True,
        },
        ACTION_NAMES[4]: {
            **common,
            "harthmereCombatProfile": "aaa-voxel-bow-v3-target-stance",
            "family": "bow_release",
            "impactSeconds": 0.280,
            "targetRequired": True,
        },
        ACTION_NAMES[5]: {
            **gun_common,
            "family": "gun_aim",
            "durationSeconds": 0.500,
        },
        ACTION_NAMES[6]: {
            **gun_common,
            "family": "gun_fire",
            "impactSeconds": 0.520,
            "durationSeconds": 0.750,
            "recoilAuthored": True,
        },
    }


def main() -> None:
    options = args()
    rig = armature()
    neutral = neutral_rotations(rig)
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = int(GUN_END_FRAME)

    actions = [
        create_draw(rig, neutral),
        create_release(rig, neutral),
        create_reload(rig, neutral),
        create_bow_aim(rig, neutral),
        create_bow_release(rig, neutral),
        create_gun_aim(rig, neutral),
        create_gun_fire(rig, neutral),
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
