#!/usr/bin/env python3
"""Author first-class melee, hit-reaction, and death clips for Harthmere creatures.

Run with Blender against one supported ``*_animations.blend`` file. Existing
Hex/Mucker Attack actions are preserved; livestock receives an authored Attack.
Every supported rig receives HitReact and Death, then only those new actions are
merged into the existing GLTF so geometry/material payloads remain untouched.
"""

import os
import sys

import bpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from add_native_movement_actions import (  # noqa: E402
    armature,
    create_action,
    export_and_merge,
    neutral_rotations,
)


SUPPORTED = {
    "hexer_animations.blend": "hex",
    "mossy_mucker_animations.blend": "mucker",
    "big_mucker_animations.blend": "mucker",
    "cobble_mucker_animations.blend": "mucker",
    "stone_mucker_animations.blend": "mucker",
    "tree_mucker_animations.blend": "mucker",
    "cow_animations.blend": "livestock",
    "sheep_animations.blend": "livestock",
    "rabbit_animations.blend": "rabbit",
}


def scaled_pose(pose, scale):
    return {
        name: tuple(value * scale for value in rotation)
        for name, rotation in pose.items()
    }


def hit_react_frames(rig, family):
    neutral = neutral_rotations(rig)
    bones = {bone.name for bone in rig.pose.bones}
    if family == "hex":
        peak = {
            "Head": (-0.3, 0.0, 0.48),
            "R_Hand": (0.35, 0.0, 0.42),
            "L_Hand": (0.35, 0.0, -0.42),
            "R_Cloak_Strips": (0.22, 0.0, 0.36),
            "L_Cloak_Strips": (0.22, 0.0, -0.36),
            "B_Cloak_Strips": (-0.18, 0.0, 0.0),
        }
    elif family in {"livestock", "rabbit"}:
        peak = {"Body": (-0.24, 0.0, 0.3), "Head": (0.42, 0.0, -0.22)}
        for name in bones:
            if "Thigh" in name or name.endswith("_Leg"):
                peak[name] = (0.32, 0.0, 0.12 if name.startswith("L_") else -0.12)
            if "Ear" in name:
                peak[name] = (0.45, 0.0, 0.2 if name.startswith("L_") else -0.2)
    else:
        peak = {"Body": (-0.28, 0.0, 0.34), "Head": (0.38, 0.0, -0.25)}
        for name in bones:
            if "Finger" in name:
                peak[name] = (0.18, 0.0, 0.28 if name.startswith("L_") else -0.28)
    return [
        (0, neutral),
        (2, scaled_pose(peak, 0.45)),
        (5, peak),
        (8, scaled_pose(peak, 0.35)),
        (12, neutral),
    ]


def death_frames(rig, family):
    neutral = neutral_rotations(rig)
    bones = {bone.name for bone in rig.pose.bones}
    if family == "hex":
        fall = {
            "Head": (0.72, 0.0, 1.22),
            "R_Hand": (0.55, 0.0, 0.9),
            "L_Hand": (0.55, 0.0, -0.9),
            "R_Cloak_Strips": (0.5, 0.0, 0.92),
            "L_Cloak_Strips": (0.5, 0.0, -0.92),
            "B_Cloak_Strips": (0.35, 0.0, 0.65),
            "Lantern": (0.5, 0.0, -0.55),
        }
    else:
        fall = {"Body": (0.12, 0.0, 1.42), "Head": (0.55, 0.0, 0.48)}
        for name in bones:
            if (
                "Thigh" in name
                or name.endswith("_Leg")
                or name.endswith("_Foot")
                or "Finger" in name
            ):
                fall[name] = (
                    0.72 if name.startswith("L_") else -0.55,
                    0.0,
                    0.24 if name.startswith("L_") else -0.24,
                )
            if "Ear" in name:
                fall[name] = (0.85, 0.0, 0.35 if name.startswith("L_") else -0.35)
            if name == "Tail":
                fall[name] = (-0.6, 0.0, -0.35)
    return [
        (0, neutral),
        (5, scaled_pose(fall, 0.25)),
        (10, scaled_pose(fall, 0.65)),
        (16, fall),
        (22, fall),
    ]


def livestock_attack_frames(rig, rabbit=False):
    neutral = neutral_rotations(rig)
    if rabbit:
        anticipation = {
            "Body": (0.28, 0.0, 0.0),
            "Head": (-0.22, 0.0, 0.0),
            "L_B_Leg": (-0.72, 0.0, 0.0),
            "R_B_Leg": (-0.72, 0.0, 0.0),
            "L_B_Foot": (0.65, 0.0, 0.0),
            "R_B_Foot": (0.65, 0.0, 0.0),
            "L_Ear": (-0.35, 0.0, 0.08),
            "R_Ear": (-0.35, 0.0, -0.08),
        }
        impact = {
            "Body": (-0.42, 0.0, 0.0),
            "Head": (0.48, 0.0, 0.0),
            "L_F_Leg": (-0.7, 0.0, 0.0),
            "R_F_Leg": (-0.7, 0.0, 0.0),
            "L_B_Leg": (0.5, 0.0, 0.0),
            "R_B_Leg": (0.5, 0.0, 0.0),
            "L_Ear": (0.18, 0.0, 0.12),
            "R_Ear": (0.18, 0.0, -0.12),
        }
        return [
            (0, neutral),
            (3, anticipation),
            (7, impact),
            (11, scaled_pose(impact, 0.35)),
            (14, neutral),
        ]

    anticipation = {
        "Body": (-0.16, 0.0, 0.0),
        "Head": (-0.48, 0.0, 0.0),
        "R_F_Thigh": (0.34, 0.0, 0.0),
        "L_F_Thigh": (0.34, 0.0, 0.0),
        "R_B_Thigh": (-0.24, 0.0, 0.0),
        "L_B_Thigh": (-0.24, 0.0, 0.0),
        "Tail": (0.0, 0.0, 0.35),
    }
    impact = {
        "Body": (0.22, 0.0, 0.0),
        "Head": (0.62, 0.0, 0.0),
        "R_F_Thigh": (-0.58, 0.0, -0.08),
        "L_F_Thigh": (-0.58, 0.0, 0.08),
        "R_B_Thigh": (0.3, 0.0, 0.0),
        "L_B_Thigh": (0.3, 0.0, 0.0),
        "Tail": (0.0, 0.0, -0.48),
    }
    return [
        (0, neutral),
        (5, anticipation),
        (10, impact),
        (15, scaled_pose(impact, 0.35)),
        (20, neutral),
    ]


def main():
    blend_path = bpy.data.filepath
    basename = os.path.basename(blend_path)
    family = SUPPORTED.get(basename)
    if not blend_path or not family:
        raise RuntimeError(f"Unsupported creature animation source: {basename!r}")

    rig = armature()
    action_names = []
    metadata = {}
    if family in {"livestock", "rabbit"}:
        create_action(
            rig,
            "Attack",
            livestock_attack_frames(rig, rabbit=family == "rabbit"),
        )
        action_names.append("Attack")
        metadata["Attack"] = {
            "harthmereProfile": "creature-melee-impact-v1",
            "impactTimeSecs": 7 / 24 if family == "rabbit" else 10 / 24,
            "worldTranslation": "gameplay-physics",
        }

    create_action(rig, "HitReact", hit_react_frames(rig, family))
    create_action(rig, "Death", death_frames(rig, family))
    action_names.extend(["HitReact", "Death"])
    metadata["HitReact"] = {"harthmereProfile": "creature-hit-react-v1"}
    metadata["Death"] = {
        "harthmereProfile": "creature-death-v1",
        "worldTranslation": "gameplay-physics",
    }

    bpy.context.scene.render.fps = 24
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    export_and_merge(
        os.path.splitext(blend_path)[0] + ".gltf",
        tuple(action_names),
        animation_metadata=metadata,
    )
    print(f"CREATURE_COMBAT_ACTIONS_UPDATED {basename}: {', '.join(action_names)}")


if __name__ == "__main__":
    main()
