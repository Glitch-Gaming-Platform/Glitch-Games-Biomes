#!/usr/bin/env python3
"""Author the shared gameplay/cutscene expression library in Blender.

The catalog is shared with TypeScript. Each public emote resolves to one of the
clips authored here. Clips contain no horizontal root motion: locomotion stays
owned by player physics, Anima, or cutscene moveTo actions.
"""

import json
import os
import sys
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
sys.path.insert(0, str(SCRIPT_DIR))

from add_native_movement_actions import (  # noqa: E402
    armature,
    create_action,
    export_and_merge,
)


CATALOG_PATH = REPO_ROOT / "src/shared/cutscene/cinematic_expression_catalog.json"


def load_unique_clips():
    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        catalog = json.load(handle)
    clips = {}
    for expression, spec in catalog.items():
        clips.setdefault(
            spec["clip"],
            {
                "expression": expression,
                "motion": spec["motion"],
                "playback": spec["playback"],
            },
        )
    return clips


def abstract_peak(motion):
    pose = {
        "body": (0.0, 0.0, 0.0),
        "head": (0.0, 0.0, 0.0),
        "left_arm": (0.0, 0.0, 0.0),
        "right_arm": (0.0, 0.0, 0.0),
        "left_leg": (0.0, 0.0, 0.0),
        "right_leg": (0.0, 0.0, 0.0),
    }

    if motion in {"sadness", "shame", "defeat", "sighing"}:
        pose.update(
            body=(0.2, 0, 0),
            head=(0.2, 0, 0),
            left_arm=(0.15, 0, -0.08),
            right_arm=(0.15, 0, 0.08),
        )
    elif motion == "depression":
        pose.update(
            body=(0.34, 0, 0),
            head=(0.3, 0, 0),
            left_arm=(0.3, 0, -0.12),
            right_arm=(0.3, 0, 0.12),
            left_leg=(-0.28, 0, 0),
            right_leg=(-0.28, 0, 0),
        )
    elif motion == "crying":
        pose.update(
            body=(0.22, 0, 0),
            head=(0.18, 0, 0),
            left_arm=(-1.45, 0, -0.22),
            right_arm=(-1.45, 0, 0.22),
        )
    elif motion in {"fear", "nervousness", "shivering"}:
        pose.update(
            body=(0.08, 0, 0.08),
            head=(-0.05, 0, -0.08),
            left_arm=(-0.68, 0, -0.25),
            right_arm=(-0.68, 0, 0.25),
            left_leg=(-0.12, 0, -0.05),
            right_leg=(-0.12, 0, 0.05),
        )
    elif motion in {"terror", "cowering"}:
        pose.update(
            body=(0.42, 0, 0),
            head=(0.3, 0, 0),
            left_arm=(-1.2, 0, -0.5),
            right_arm=(-1.2, 0, 0.5),
            left_leg=(-0.72, 0, 0),
            right_leg=(-0.72, 0, 0),
        )
    elif motion == "surprise":
        pose.update(
            body=(-0.08, 0, 0),
            head=(-0.12, 0, 0),
            left_arm=(-0.82, 0, -0.75),
            right_arm=(-0.82, 0, 0.75),
        )
    elif motion == "shock":
        pose.update(
            body=(-0.15, 0, 0),
            head=(-0.18, 0, 0),
            left_arm=(-1.16, 0, -0.88),
            right_arm=(-1.16, 0, 0.88),
            left_leg=(0.2, 0, -0.08),
            right_leg=(-0.15, 0, 0.08),
        )
    elif motion == "recoil":
        pose.update(
            body=(-0.28, 0, 0.12),
            head=(-0.18, 0, -0.16),
            left_arm=(-0.58, 0, -0.48),
            right_arm=(-0.88, 0, 0.32),
            left_leg=(0.28, 0, 0),
            right_leg=(-0.22, 0, 0),
        )
    elif motion == "curiosity":
        pose.update(
            body=(-0.04, 0, 0.08), head=(-0.12, 0, -0.2), right_arm=(-0.58, 0, 0.24)
        )
    elif motion == "thinking":
        pose.update(
            head=(-0.08, 0, 0.16), left_arm=(0.18, 0, -0.08), right_arm=(-1.32, 0, 0.22)
        )
    elif motion == "confusion":
        pose.update(
            head=(-0.08, 0, 0.24),
            left_arm=(-0.75, 0, -0.62),
            right_arm=(-0.75, 0, 0.62),
        )
    elif motion == "uncertainty":
        pose.update(
            body=(0.04, 0, 0.08),
            head=(-0.04, 0, -0.12),
            left_arm=(-0.42, 0, -0.34),
            right_arm=(-0.3, 0, 0.22),
        )
    elif motion in {"embarrassment", "scratchingHead"}:
        pose.update(
            body=(0.12, 0, -0.08), head=(0.16, 0, 0.16), right_arm=(-1.55, 0, 0.24)
        )
    elif motion == "shyness":
        pose.update(
            body=(0.12, 0, 0.12),
            head=(0.12, 0, -0.18),
            left_arm=(0.24, 0, -0.22),
            right_arm=(0.24, 0, 0.22),
        )
    elif motion == "boredom":
        pose.update(
            body=(0.04, 0, -0.06),
            head=(0.12, 0, 0.08),
            left_arm=(-0.3, 0, 0.28),
            right_arm=(-0.3, 0, -0.28),
        )
    elif motion in {"impatience", "footTapping"}:
        pose.update(
            body=(0.02, 0, 0.06), left_leg=(-0.22, 0, 0), right_arm=(-0.25, 0, 0.3)
        )
    elif motion == "annoyance":
        pose.update(
            body=(0.02, 0, -0.06),
            head=(-0.04, 0, 0.1),
            left_arm=(-0.32, 0, 0.34),
            right_arm=(-0.32, 0, -0.34),
        )
    elif motion == "frustration":
        pose.update(
            body=(0.12, 0, 0),
            head=(0.08, 0, 0),
            left_arm=(-1.12, 0, -0.75),
            right_arm=(-1.12, 0, 0.75),
        )
    elif motion == "facepalm":
        pose.update(body=(0.14, 0, 0), head=(0.12, 0, 0), right_arm=(-1.6, 0, 0.14))
    elif motion == "anger":
        pose.update(
            body=(-0.1, 0, 0),
            head=(-0.08, 0, 0),
            left_arm=(-0.58, 0, -0.2),
            right_arm=(-0.58, 0, 0.2),
            left_leg=(-0.12, 0, -0.06),
            right_leg=(-0.12, 0, 0.06),
        )
    elif motion == "fury":
        pose.update(
            body=(-0.2, 0, 0),
            head=(-0.12, 0, 0),
            left_arm=(-1.3, 0, -0.55),
            right_arm=(-1.3, 0, 0.55),
            left_leg=(-0.28, 0, -0.08),
            right_leg=(-0.28, 0, 0.08),
        )
    elif motion == "threatening":
        pose.update(
            body=(-0.18, 0, 0),
            head=(-0.12, 0, 0),
            left_arm=(-0.4, 0, -0.3),
            right_arm=(-1.48, 0, 0.1),
            left_leg=(-0.2, 0, -0.08),
            right_leg=(0.08, 0, 0.08),
        )
    elif motion in {"determined", "ready", "guard"}:
        pose.update(
            body=(-0.08, 0, 0),
            head=(-0.05, 0, 0),
            left_arm=(-0.68, 0, -0.3),
            right_arm=(-0.68, 0, 0.3),
            left_leg=(-0.2, 0, -0.1),
            right_leg=(0.12, 0, 0.1),
        )
    elif motion == "block":
        pose.update(
            body=(-0.14, 0, 0),
            left_arm=(-1.28, 0, -0.52),
            right_arm=(-1.08, 0, 0.45),
            left_leg=(-0.24, 0, -0.08),
            right_leg=(0.14, 0, 0.08),
        )
    elif motion == "tiredness":
        pose.update(
            body=(0.18, 0, 0),
            head=(0.24, 0, 0),
            left_arm=(0.2, 0, -0.08),
            right_arm=(0.2, 0, 0.08),
        )
    elif motion == "exhaustion":
        pose.update(
            body=(0.45, 0, 0),
            head=(0.28, 0, 0),
            left_arm=(-0.6, 0, -0.1),
            right_arm=(-0.6, 0, 0.1),
            left_leg=(-0.28, 0, 0),
            right_leg=(-0.28, 0, 0),
        )
    elif motion == "yawning":
        pose.update(body=(0.08, 0, 0), head=(-0.14, 0, 0), right_arm=(-1.45, 0, 0.18))
    elif motion == "stretching":
        pose.update(
            body=(-0.14, 0, 0),
            head=(-0.18, 0, 0),
            left_arm=(-2.65, 0, -0.22),
            right_arm=(-2.65, 0, 0.22),
        )
    elif motion == "injury":
        pose.update(
            body=(0.08, 0, -0.18),
            head=(0.1, 0, 0.08),
            right_arm=(-0.98, 0, 0.2),
            left_leg=(-0.18, 0, 0),
        )
    elif motion == "limping":
        pose.update(
            body=(0.08, 0, -0.14),
            left_arm=(-0.28, 0, -0.1),
            right_arm=(0.28, 0, 0.1),
            left_leg=(-0.62, 0, 0),
            right_leg=(0.2, 0, 0),
        )
    elif motion == "dizziness":
        pose.update(
            body=(0.1, 0, 0.25),
            head=(-0.08, 0, -0.25),
            left_arm=(-0.5, 0, -0.45),
            right_arm=(-0.5, 0, 0.45),
        )
    elif motion == "relief":
        pose.update(
            body=(0.1, 0, 0),
            head=(0.06, 0, 0),
            left_arm=(0.25, 0, -0.18),
            right_arm=(0.25, 0, 0.18),
        )
    elif motion == "disgust":
        pose.update(
            body=(-0.14, 0, -0.12), head=(-0.1, 0, 0.22), right_arm=(-0.85, 0, 0.62)
        )
    elif motion == "love":
        pose.update(
            head=(-0.04, 0, 0), left_arm=(-1.12, 0, -0.32), right_arm=(-1.12, 0, 0.32)
        )
    elif motion == "flirting":
        pose.update(
            body=(0.02, 0, 0.12), head=(-0.08, 0, -0.16), right_arm=(-1.28, 0, 0.48)
        )
    elif motion == "gratitude":
        pose.update(
            body=(0.15, 0, 0), left_arm=(-0.8, 0, -0.22), right_arm=(-0.8, 0, 0.22)
        )
    elif motion in {"apology", "bow"}:
        pose.update(
            body=(0.52, 0, 0),
            head=(-0.1, 0, 0),
            left_arm=(0.15, 0, -0.08),
            right_arm=(0.15, 0, 0.08),
        )
    elif motion == "salute":
        pose.update(right_arm=(-1.65, 0, 0.14), head=(-0.04, 0, 0))
    elif motion == "kneel":
        pose.update(
            body=(0.12, 0, 0),
            left_leg=(-1.22, 0, 0),
            right_leg=(-0.52, 0, 0),
            left_arm=(0.12, 0, -0.08),
            right_arm=(0.12, 0, 0.08),
        )
    elif motion == "pray":
        pose.update(
            body=(0.08, 0, 0), left_arm=(-1.22, 0, -0.2), right_arm=(-1.22, 0, 0.2)
        )
    elif motion == "meditate":
        pose.update(
            body=(0.08, 0, 0),
            left_arm=(-0.28, 0, -0.3),
            right_arm=(-0.28, 0, 0.3),
            left_leg=(-1.36, 0, -0.4),
            right_leg=(-1.36, 0, 0.4),
        )
    elif motion == "surrender":
        pose.update(
            body=(-0.04, 0, 0), left_arm=(-2.22, 0, -0.38), right_arm=(-2.22, 0, 0.38)
        )
    elif motion == "beckon":
        pose.update(right_arm=(-1.42, 0, 0.18), head=(-0.04, 0, -0.08))
    elif motion == "stop":
        pose.update(right_arm=(-1.5, 0, 0.06), body=(-0.05, 0, 0))
    elif motion == "hug":
        pose.update(
            left_arm=(-1.25, 0, -0.92), right_arm=(-1.25, 0, 0.92), body=(-0.04, 0, 0)
        )
    elif motion == "handshake":
        pose.update(right_arm=(-1.22, 0, 0.4), body=(-0.04, 0, 0.04))
    elif motion == "highFive":
        pose.update(right_arm=(-2.08, 0, 0.2), body=(-0.08, 0, 0))
    elif motion == "thumbsUp":
        pose.update(right_arm=(-1.3, 0, 0.3), head=(-0.04, 0, 0))
    elif motion == "thumbsDown":
        pose.update(right_arm=(-0.48, 0, 0.3), head=(0.04, 0, 0.08))
    elif motion == "taunt":
        pose.update(
            body=(-0.12, 0, 0), left_arm=(-0.9, 0, -0.55), right_arm=(-0.9, 0, 0.55)
        )
    elif motion == "stagger":
        pose.update(
            body=(0.22, 0, -0.35),
            head=(-0.12, 0, 0.18),
            left_arm=(-0.72, 0, -0.2),
            right_arm=(-0.98, 0, 0.28),
            left_leg=(0.3, 0, 0),
            right_leg=(-0.22, 0, 0),
        )
    elif motion == "knockdown":
        pose.update(
            body=(1.42, 0, 0.12),
            head=(-0.28, 0, 0),
            left_arm=(-0.35, 0, -0.25),
            right_arm=(-0.35, 0, 0.25),
            left_leg=(-0.45, 0, 0),
            right_leg=(-0.45, 0, 0),
        )
    elif motion == "getUp":
        pose.update(
            body=(0.42, 0, 0),
            head=(-0.2, 0, 0),
            left_arm=(-0.78, 0, -0.3),
            right_arm=(-0.78, 0, 0.3),
            left_leg=(-0.75, 0, 0),
            right_leg=(-0.35, 0, 0),
        )
    elif motion in {"retreat", "pacing"}:
        pose.update(
            body=(-0.06, 0, 0),
            left_arm=(-0.35, 0, -0.08),
            right_arm=(0.35, 0, 0.08),
            left_leg=(-0.55, 0, 0),
            right_leg=(0.55, 0, 0),
        )
    elif motion == "rally":
        pose.update(
            body=(-0.08, 0, 0), left_arm=(-0.72, 0, -0.3), right_arm=(-2.22, 0, 0.22)
        )
    elif motion == "victory":
        pose.update(
            body=(-0.1, 0, 0), left_arm=(-2.42, 0, -0.38), right_arm=(-2.42, 0, 0.38)
        )
    elif motion == "checkingEquipment":
        pose.update(
            head=(0.08, 0, 0.12), left_arm=(-0.78, 0, -0.24), right_arm=(-0.92, 0, 0.28)
        )
    elif motion == "cleaningWeapon":
        pose.update(
            head=(0.06, 0, 0.08), left_arm=(-1.02, 0, -0.28), right_arm=(-0.75, 0, 0.22)
        )
    return pose


def rig_roles(rig):
    names = [bone.name for bone in rig.pose.bones]

    def exact(*candidates):
        for candidate in candidates:
            if candidate in names:
                return candidate
        return None

    def matches_side(name, side):
        lowered = name.lower()
        if side == "left":
            return (
                lowered.startswith("l_")
                or "_l_" in lowered
                or lowered.endswith("_l")
                or "left" in lowered
            )
        if side == "right":
            return (
                lowered.startswith("r_")
                or "_r_" in lowered
                or lowered.endswith("_r")
                or "right" in lowered
            )
        return True

    def matching(*tokens, side=None):
        for name in names:
            lowered = name.lower()
            if side and not matches_side(name, side):
                continue
            if any(token in lowered for token in tokens):
                return name
        return None

    body = (
        exact("Waist", "Body", "Chest")
        or matching("body", "chest", "waist")
        or names[0]
    )
    chest = exact("Chest", "Body") or body
    head = exact("Head") or matching("head") or body
    left_arm = exact(
        "L_Arm",
        "L_Wing",
        "L_Hand",
        "L_F_Fin",
        "T_L_Arm",
        "F_L_Thigh",
        "F_L_Leg",
    ) or matching(
        "arm", "wing", "hand", "front", "f_fin", "f_thigh", "f_leg", side="left"
    )
    right_arm = exact(
        "R_Arm",
        "R_Wing",
        "R_Hand",
        "R_F_Fin",
        "T_R_Arm",
        "F_R_Thigh",
        "F_R_Leg",
    ) or matching(
        "arm", "wing", "hand", "front", "f_fin", "f_thigh", "f_leg", side="right"
    )
    left_leg = exact(
        "L_Thigh",
        "L_Leg",
        "L_B_UpperThigh",
        "L_B_Fin",
        "B_L_Thigh",
        "B_L_Leg",
        "B_L_Arm",
    ) or matching("thigh", "leg", "back", "b_fin", "b_arm", side="left")
    right_leg = exact(
        "R_Thigh",
        "R_Leg",
        "R_B_UpperThigh",
        "R_B_Fin",
        "B_R_Thigh",
        "B_R_Leg",
        "B_R_Arm",
    ) or matching("thigh", "leg", "back", "b_fin", "b_arm", side="right")
    return {
        "body": body,
        "chest": chest,
        "head": head,
        "left_arm": left_arm,
        "right_arm": right_arm,
        "left_leg": left_leg,
        "right_leg": right_leg,
    }


def mapped_pose(rig, abstract):
    roles = rig_roles(rig)
    result = {}
    for role, rotation in abstract.items():
        bone = roles.get(role)
        if bone:
            # Sparse creature rigs can use one bone for more than one abstract
            # role (for example, a robot body can also be its head). Combine
            # those contributions instead of letting the later role erase the
            # earlier motion and silently export an all-neutral clip.
            prior = result.get(bone, (0.0, 0.0, 0.0))
            result[bone] = tuple(prior[index] + rotation[index] for index in range(3))
    # Character Waist and Chest are separate roots; give both some torso read.
    if roles["body"] == "Waist" and roles["chest"] == "Chest":
        result["Chest"] = tuple(value * 0.72 for value in abstract["body"])
    return result


def scaled_pose(pose, factor, pulse=0.0):
    return {
        name: (
            rotation[0] * factor,
            rotation[1] * factor,
            rotation[2] * factor + pulse,
        )
        for name, rotation in pose.items()
    }


def character_locations(rig, motion, factor):
    names = {bone.name for bone in rig.pose.bones}
    if not {"Chest", "Waist"}.issubset(names):
        return None
    depth = {
        "depression": 0.45,
        "cowering": 0.72,
        "terror": 0.42,
        "exhaustion": 0.48,
        "kneel": 0.72,
        "pray": 0.32,
        "meditate": 0.7,
        "defeat": 0.55,
        "knockdown": 0.85,
        "getUp": 0.4,
    }.get(motion, 0.0)
    if depth <= 0:
        return None
    return {
        "Chest": (0, -2.25 * depth * factor, 0),
        "Waist": (0, 1.4 * depth * factor, 0),
    }


def create_expression_action(rig, clip, motion, playback):
    peak = mapped_pose(rig, abstract_peak(motion))
    lead = scaled_pose(peak, 0.45)
    if playback == "loop":
        alternate = scaled_pose(peak, 0.82, pulse=-0.035)
        frames = [
            (0, peak, character_locations(rig, motion, 1.0)),
            (7, alternate, character_locations(rig, motion, 0.96)),
            (14, peak, character_locations(rig, motion, 1.0)),
            (
                21,
                scaled_pose(peak, 0.88, pulse=0.035),
                character_locations(rig, motion, 0.98),
            ),
            (28, peak, character_locations(rig, motion, 1.0)),
        ]
    elif playback == "hold":
        frames = [
            (0, {}, None),
            (5, lead, character_locations(rig, motion, 0.45)),
            (12, peak, character_locations(rig, motion, 1.0)),
            (24, peak, character_locations(rig, motion, 1.0)),
        ]
    else:
        frames = [
            (0, {}, None),
            (4, lead, character_locations(rig, motion, 0.45)),
            (10, peak, character_locations(rig, motion, 1.0)),
            (18, scaled_pose(peak, 0.35), character_locations(rig, motion, 0.35)),
            (24, {}, None),
        ]
    create_action(rig, clip, frames)


def main():
    blend_path = bpy.data.filepath
    if not blend_path:
        raise RuntimeError("Open a .blend before running this script")
    rig = armature()
    clips = load_unique_clips()
    for clip, spec in clips.items():
        create_expression_action(rig, clip, spec["motion"], spec["playback"])

    bpy.context.scene.render.fps = 24
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    gltf_path = os.path.splitext(blend_path)[0] + ".gltf"
    export_and_merge(gltf_path, tuple(clips.keys()))
    print(
        f"CINEMATIC_EXPRESSIONS_UPDATED {os.path.basename(blend_path)}: "
        f"{len(clips)} clips"
    )


if __name__ == "__main__":
    main()
