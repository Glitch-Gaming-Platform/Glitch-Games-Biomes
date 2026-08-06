#!/usr/bin/env python3
"""Author severity-specific stagger actions for Harthmere creature rigs.

The actions replace the single generic HitReact presentation used for every
poise break with three readable reactions whose 24-fps clocks closely track
the native combat windows.
Run this script once per supported NPC animation blend; it saves the editable
source and merges only the three actions into the adjacent animation GLTF.
"""

from __future__ import annotations

import copy
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


FPS = 24
POLISH_VERSION = "harthmere-creature-stagger-animation-polish-v1"
ACTION_SPECS = {
    "StaggerLight": {"end": 10, "impact": 2, "severity": "light"},
    "StaggerMedium": {"end": 23, "impact": 4, "severity": "medium"},
    "StaggerHeavy": {"end": 52, "impact": 7, "severity": "heavy"},
}
SUPPORTED = {
    "mossy_mucker_animations.blend": "mucker",
    "tree_mucker_animations.blend": "mucker",
    "stone_mucker_animations.blend": "mucker",
    "cobble_mucker_animations.blend": "mucker",
    "big_mucker_animations.blend": "mucker",
    "hexer_animations.blend": "hexer",
    "cow_animations.blend": "quadruped",
    "sheep_animations.blend": "quadruped",
    "rabbit_animations.blend": "rabbit",
}


def scaled_pose(pose, amount):
    return {
        bone: tuple(component * amount for component in rotation)
        for bone, rotation in pose.items()
    }


def scaled_locations(locations, amount):
    return {
        bone: tuple(component * amount for component in location)
        for bone, location in locations.items()
    }


def additive_pose(base, offsets):
    result = copy.deepcopy(base)
    for bone, offset in offsets.items():
        current = result.get(bone, (0.0, 0.0, 0.0))
        result[bone] = tuple(current[i] + offset[i] for i in range(3))
    return result


def mucker_peak(bones, severity):
    amount = {"light": 0.48, "medium": 0.78, "heavy": 1.0}[severity]
    pose = {
        "Body": (-0.58, 0.22, 0.68),
        "Head": (0.82, -0.18, -0.94),
        "R_Leg": (0.68, 0.0, -0.22),
        "L_Leg": (0.24, 0.0, 0.34),
    }
    for bone in bones:
        lower = bone.lower()
        if "earring" in lower or "finger" in lower:
            pose[bone] = (-0.18, 0.08, -0.62 if bone.startswith("L") else 0.62)
    return scaled_pose({bone: value for bone, value in pose.items() if bone in bones}, amount)


def hexer_peak(bones, severity):
    amount = {"light": 0.45, "medium": 0.74, "heavy": 1.0}[severity]
    pose = {
        "Head": (-0.68, 0.18, 0.76),
        "R_Hand": (0.72, -0.12, 0.58),
        "L_Hand": (-0.46, 0.10, -0.70),
        "Lantern": (0.84, 0.18, -0.92),
        "R_Cloak_Strips": (0.28, -0.10, -0.72),
        "L_Cloak_Strips": (-0.20, 0.08, 0.64),
        "B_Cloak_Strips": (0.38, 0.0, -0.34),
    }
    return scaled_pose({bone: value for bone, value in pose.items() if bone in bones}, amount)


def quadruped_peak(bones, severity):
    amount = {"light": 0.44, "medium": 0.72, "heavy": 1.0}[severity]
    pose = {
        "Body": (-0.42, 0.24, 0.48),
        "Head": (0.78, -0.12, -0.70),
        "Tail": (-0.24, 0.08, 0.54),
        "R_F_Thigh": (-0.58, 0.0, -0.18),
        "L_F_Thigh": (-0.18, 0.0, 0.28),
        "R_B_Thigh": (0.32, 0.0, -0.20),
        "L_B_Thigh": (0.62, 0.0, 0.24),
        "R_F_Leg": (0.72, 0.0, 0.0),
        "L_F_Leg": (0.34, 0.0, 0.0),
        "R_B_Leg": (-0.38, 0.0, 0.0),
        "L_B_Leg": (-0.62, 0.0, 0.0),
    }
    return scaled_pose({bone: value for bone, value in pose.items() if bone in bones}, amount)


def rabbit_peak(bones, severity):
    amount = {"light": 0.46, "medium": 0.76, "heavy": 1.0}[severity]
    pose = {
        "Body": (-0.54, 0.20, 0.58),
        "Head": (0.72, -0.14, -0.74),
        "L_Ear": (0.72, 0.10, 0.36),
        "R_Ear": (0.48, -0.12, -0.54),
        "Tail": (-0.28, 0.0, 0.42),
        "L_F_Leg": (0.62, 0.0, 0.18),
        "R_F_Leg": (0.30, 0.0, -0.22),
        "L_B_Leg": (-0.76, 0.0, 0.24),
        "R_B_Leg": (-0.42, 0.0, -0.28),
        "L_F_Foot": (-0.34, 0.0, 0.0),
        "R_F_Foot": (-0.18, 0.0, 0.0),
        "L_B_Foot": (0.58, 0.0, 0.0),
        "R_B_Foot": (0.36, 0.0, 0.0),
    }
    return scaled_pose({bone: value for bone, value in pose.items() if bone in bones}, amount)


def peak_pose(family, bones, severity):
    if family == "mucker":
        return mucker_peak(bones, severity)
    if family == "hexer":
        return hexer_peak(bones, severity)
    if family == "quadruped":
        return quadruped_peak(bones, severity)
    return rabbit_peak(bones, severity)


def action_frames(family, bones, neutral, severity):
    peak = peak_pose(family, bones, severity)
    body = "Body" if "Body" in bones else "Head"
    distance = {"light": 0.06, "medium": 0.14, "heavy": 0.28}[severity]
    drop = {"light": 0.015, "medium": 0.06, "heavy": 0.16}[severity]
    peak_location = {body: (-distance, -drop, distance * 0.28)}

    if severity == "light":
        samples = (
            (0, {}, {}),
            (2, peak, peak_location),
            (5, scaled_pose(peak, -0.22), scaled_locations(peak_location, 0.28)),
            (10, {}, {}),
        )
    elif severity == "medium":
        samples = (
            (0, {}, {}),
            (2, scaled_pose(peak, 0.42), scaled_locations(peak_location, 0.32)),
            (4, peak, peak_location),
            (10, scaled_pose(peak, 0.78), scaled_locations(peak_location, 1.18)),
            (16, scaled_pose(peak, -0.18), scaled_locations(peak_location, 0.36)),
            (23, {}, {}),
        )
    else:
        brace = scaled_pose(peak, 0.46)
        samples = (
            (0, {}, {}),
            (3, scaled_pose(peak, 0.38), scaled_locations(peak_location, 0.30)),
            (7, peak, peak_location),
            (16, scaled_pose(peak, 0.88), scaled_locations(peak_location, 1.35)),
            (27, brace, scaled_locations(peak_location, 1.08)),
            (38, scaled_pose(brace, -0.20), scaled_locations(peak_location, 0.42)),
            (46, scaled_pose(brace, 0.20), scaled_locations(peak_location, 0.14)),
            (52, {}, {}),
        )
    return [
        (
            frame,
            additive_pose(neutral, pose),
            {body: (0.0, 0.0, 0.0), **locations},
        )
        for frame, pose, locations in samples
    ]


def main() -> None:
    blend_path = bpy.data.filepath
    basename = os.path.basename(blend_path)
    family = SUPPORTED.get(basename)
    if family is None:
        raise RuntimeError(f"Unsupported creature animation source: {basename}")
    rig = armature()
    bones = {bone.name for bone in rig.pose.bones}
    neutral = neutral_rotations(rig)
    metadata = {}
    for name, spec in ACTION_SPECS.items():
        action = create_action(
            rig,
            name,
            action_frames(family, bones, neutral, spec["severity"]),
        )
        action.frame_start = 0
        action.frame_end = spec["end"]
        action["harthmereAnimationPolishVersion"] = POLISH_VERSION
        action["harthmereFamily"] = family
        action["harthmereSeverity"] = spec["severity"]
        action["harthmereAuthoredFps"] = FPS
        action["harthmereImpactFrame"] = spec["impact"]
        action["harthmereRuntimeExecutionEnabled"] = True
        metadata[name] = {key: value for key, value in action.items()}

    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = max(spec["end"] for spec in ACTION_SPECS.values())
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    gltf_path = os.path.splitext(blend_path)[0] + ".gltf"
    export_and_merge(gltf_path, tuple(ACTION_SPECS), animation_metadata=metadata)
    print(f"CREATURE_STAGGER_ACTIONS_UPDATED {basename}: {', '.join(ACTION_SPECS)}")


if __name__ == "__main__":
    main()
