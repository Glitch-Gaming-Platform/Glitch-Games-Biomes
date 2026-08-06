#!/usr/bin/env python3
"""Author future humanoid-NPC stagger clips without enabling runtime playback.

The character animation library is shared by players and player-like NPCs, so
these clips use explicit ``Npc`` names.  Runtime selection intentionally stays
disabled until the NPC stagger authority is implemented in a later change.

Run with Blender::

    blender --background src/galois/data/animations/character-animations.blend \
      --python scripts/harthmere/blender/author_future_stagger_actions.py -- \
      --gltf src/galois/data/animations/character-animations.gltf
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
    armature,
    create_action,
    export_and_merge,
    neutral_rotations,
)


FPS = 24
NPC_STAGGER_ACTIONS = (
    "NpcStaggerLight",
    "NpcStaggerMedium",
    "NpcStaggerHeavy",
)


def args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--gltf",
        default="src/galois/data/animations/character-animations.gltf",
        help="Existing character glTF whose animation library will be extended",
    )
    return parser.parse_args(argv)


def additive_pose(base, offsets):
    pose = copy.deepcopy(base)
    for bone, offset in offsets.items():
        current = pose.get(bone, (0.0, 0.0, 0.0))
        pose[bone] = tuple(current[axis] + offset[axis] for axis in range(3))
    return pose


def scaled_pose(offsets, amount):
    return {
        bone: tuple(component * amount for component in rotation)
        for bone, rotation in offsets.items()
    }


def stagger_specs():
    """Return frame-exact full-body reaction poses for each future clip.

    Every reaction includes the guide's impact, balance loss, weapon drop, foot
    response, and controlled recovery.  The heavy pose is intentionally a
    stagger rather than a death/knockdown silhouette.
    """

    light_peak = {
        "Chest": (-0.30, 0.12, -0.22),
        "Head": (-0.46, -0.06, 0.28),
        "Waist": (0.12, -0.10, 0.16),
        "R_Arm": (0.28, 0.10, 0.34),
        "R_Forearm": (-0.42, 0.06, -0.18),
        "R_Hand": (0.12, 0.08, -0.14),
        "L_Arm": (-0.18, -0.08, -0.30),
        "L_Forearm": (-0.34, 0.0, 0.08),
        "L_Hand": (-0.08, 0.0, 0.12),
        "Tool": (0.30, 0.10, -0.24),
        "R_Thigh": (-0.18, 0.04, 0.12),
        "L_Thigh": (0.12, -0.04, -0.10),
        "R_Leg": (0.26, 0.0, 0.0),
        "L_Leg": (0.12, 0.0, 0.0),
        "R_Foot": (-0.08, 0.0, 0.04),
        "L_Foot": (0.06, 0.0, -0.03),
    }
    medium_peak = {
        "Chest": (-0.58, 0.22, -0.42),
        "Head": (-0.72, -0.12, 0.46),
        "Waist": (0.28, -0.16, 0.32),
        "R_Arm": (0.56, 0.18, 0.68),
        "R_Forearm": (-0.72, 0.08, -0.32),
        "R_Hand": (0.22, 0.12, -0.24),
        "L_Arm": (-0.42, -0.14, -0.58),
        "L_Forearm": (-0.64, 0.0, 0.18),
        "L_Hand": (-0.16, 0.0, 0.22),
        "Tool": (0.58, 0.18, -0.46),
        "R_Thigh": (-0.54, 0.08, 0.24),
        "L_Thigh": (-0.20, -0.08, -0.18),
        "R_Leg": (0.82, 0.0, 0.0),
        "L_Leg": (0.38, 0.0, 0.0),
        "R_Foot": (-0.24, 0.0, 0.08),
        "L_Foot": (-0.08, 0.0, -0.06),
    }
    heavy_peak = {
        "Chest": (-0.92, 0.34, -0.62),
        "Head": (-1.04, -0.20, 0.68),
        "Waist": (0.52, -0.22, 0.48),
        "R_Arm": (0.94, 0.30, 0.96),
        "R_Forearm": (-1.00, 0.14, -0.46),
        "R_Hand": (0.34, 0.18, -0.34),
        "L_Arm": (-0.76, -0.22, -0.88),
        "L_Forearm": (-0.92, 0.0, 0.30),
        "L_Hand": (-0.26, 0.0, 0.34),
        "Tool": (0.88, 0.26, -0.72),
        "R_Thigh": (-0.98, 0.12, 0.36),
        "L_Thigh": (-0.74, -0.12, -0.30),
        "R_Leg": (1.28, 0.0, 0.0),
        "L_Leg": (1.06, 0.0, 0.0),
        "R_Foot": (-0.40, 0.0, 0.12),
        "L_Foot": (-0.30, 0.0, -0.10),
    }
    heavy_brace = {
        **scaled_pose(heavy_peak, 0.48),
        "Chest": (-0.44, -0.16, 0.28),
        "Head": (-0.28, 0.10, -0.24),
        "Waist": (0.34, 0.12, -0.22),
        "R_Arm": (0.46, -0.12, 0.34),
        "L_Arm": (-0.36, 0.10, -0.30),
        "Tool": (0.48, -0.10, -0.38),
    }

    return {
        "NpcStaggerLight": {
            "end": 12,
            "poses": ((0, {}, {}), (3, light_peak, (-0.05, -0.12, 0.025)),
                      (6, scaled_pose(light_peak, -0.28), (-0.015, -0.04, -0.01)),
                      (12, {}, {})),
            "impact": 3,
            "profile": "humanoid-npc-light-stagger-v1",
        },
        "NpcStaggerMedium": {
            "end": 28,
            "poses": ((0, {}, {}), (4, scaled_pose(medium_peak, 0.42), (-0.05, -0.16, 0.04)),
                      (8, medium_peak, (-0.14, -0.34, 0.09)),
                      (16, scaled_pose(medium_peak, 0.70), (-0.20, -0.44, 0.13)),
                      (22, scaled_pose(medium_peak, -0.20), (-0.07, -0.14, 0.02)),
                      (28, {}, {})),
            "impact": 8,
            "profile": "humanoid-npc-medium-stagger-v1",
        },
        "NpcStaggerHeavy": {
            "end": 54,
            "poses": ((0, {}, {}), (5, scaled_pose(heavy_peak, 0.38), (-0.08, -0.24, 0.06)),
                      (11, heavy_peak, (-0.24, -0.66, 0.16)),
                      (22, scaled_pose(heavy_peak, 0.84), (-0.38, -1.02, 0.24)),
                      (32, heavy_brace, (-0.30, -0.86, 0.18)),
                      (43, scaled_pose(heavy_brace, 0.48), (-0.12, -0.38, 0.07)),
                      (54, {}, {})),
            "impact": 11,
            "profile": "humanoid-npc-heavy-stagger-v1",
        },
    }


def create_stagger_action(rig, name, spec, neutral):
    base_locations = {"Chest": (0.0, 0.0, 0.0), "Waist": (0.0, 0.0, 0.0)}
    frames = []
    for frame, offsets, movement in spec["poses"]:
        locations = copy.deepcopy(base_locations)
        if movement:
            back, drop, lateral = movement
            # Both root bones contribute to the silhouette on this legacy rig.
            locations["Chest"] = (back, drop, lateral)
            locations["Waist"] = (back * 0.55, -drop * 0.62, -lateral * 0.55)
        frames.append((frame, additive_pose(neutral, offsets), locations))
    action = create_action(rig, name, frames)
    action.frame_start = 0
    action.frame_end = spec["end"]
    action["harthmereProfile"] = spec["profile"]
    action["harthmereFamily"] = "npc"
    action["harthmereSeverity"] = name.removeprefix("NpcStagger").lower()
    action["harthmereAuthoredFps"] = FPS
    action["harthmereImpactFrame"] = spec["impact"]
    action["harthmereRuntimeExecutionEnabled"] = False
    return action


def main() -> None:
    options = args()
    blend_path = bpy.data.filepath
    if not blend_path or os.path.basename(blend_path) != "character-animations.blend":
        raise RuntimeError("Open the canonical character-animations.blend file")
    rig = armature()
    neutral = neutral_rotations(rig)
    specs = stagger_specs()
    for name in NPC_STAGGER_ACTIONS:
        create_stagger_action(rig, name, specs[name], neutral)
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = max(spec["end"] for spec in specs.values())
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    metadata = {
        name: {
            "harthmereProfile": specs[name]["profile"],
            "harthmereFamily": "npc",
            "harthmereSeverity": name.removeprefix("NpcStagger").lower(),
            "harthmereAuthoredFps": FPS,
            "harthmereImpactFrame": specs[name]["impact"],
            "harthmereRuntimeExecutionEnabled": False,
        }
        for name in NPC_STAGGER_ACTIONS
    }
    export_and_merge(options.gltf, NPC_STAGGER_ACTIONS, animation_metadata=metadata)
    print("FUTURE_NPC_STAGGER_ACTIONS_UPDATED " + ", ".join(NPC_STAGGER_ACTIONS))


if __name__ == "__main__":
    main()
