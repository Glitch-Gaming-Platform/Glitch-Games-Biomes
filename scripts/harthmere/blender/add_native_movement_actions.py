#!/usr/bin/env python3
"""Author native Biomes dodge/evade actions and merge them into existing GLTFs.

Run through Blender so the actions are stored in the source .blend. The GLTF
merge deliberately preserves the existing geometry, materials, and animation
payload byte-for-byte and appends only the newly authored action accessors.
"""

import base64
import copy
import json
import mimetypes
import os
import shutil
import sys
import tempfile
from mathutils import Euler, Quaternion, Vector

import bpy


CHARACTER_ACTIONS = (
    "Crouch",
    "CrouchIdle",
    "CrouchWalking",
    "DodgeLeft",
    "DodgeRight",
    "DodgeForward",
    "DodgeBack",
    "EvadeRoll",
    "DoubleJump",
)

ROLL_DODGE_METADATA = {
    "profile": "harthmere-phased-roll-v2",
    "events": [
        {"name": "DODGE_START", "time": 0.0},
        {"name": "DODGE_ACTIVE", "time": 0.1},
        {"name": "DODGE_IFRAME_START", "time": 0.15},
        {"name": "DODGE_IFRAME_END", "time": 0.4},
        {"name": "DODGE_LANDING", "time": 0.55},
        {"name": "DODGE_RECOVERY", "time": 0.6},
        {"name": "DODGE_END", "time": 0.75},
    ],
    "phases": [
        {"name": "anticipation", "start": 0.0, "end": 0.1},
        {"name": "launch", "start": 0.1, "end": 0.2},
        {"name": "tuck", "start": 0.2, "end": 0.34},
        {"name": "rotation", "start": 0.34, "end": 0.52},
        {"name": "landing", "start": 0.52, "end": 0.62},
        {"name": "recovery", "start": 0.62, "end": 0.75},
    ],
    "worldTranslation": "gameplay-physics",
    "direction": "runtime-root-yaw",
}

NPC_ACTION_BY_FILE = {
    "big_mucker_animations.blend": "MuckerEvade",
    "bird_animations.blend": "WingEvade",
    "buddy_animations.blend": "Evade",
    "cat_animations.blend": "SideLeap",
    "chicken_animations.blend": "WingEvade",
    "chrominer_animations.blend": "RobotEvade",
    "cobble_mucker_animations.blend": "MuckerEvade",
    "cow_animations.blend": "HeavyEvade",
    "dog_animations.blend": "SideLeap",
    "dragon_animations.blend": "Evade",
    "duck_animations.blend": "WingEvade",
    "fish_animations.blend": "SwimBurst",
    "helping_robot_animations.blend": "RobotEvade",
    "hexer_animations.blend": "HexerEvade",
    "mossy_mucker_animations.blend": "MuckerEvade",
    "mouse_animations.blend": "Evade",
    "rabbit_animations.blend": "QuickHop",
    "robot_animations.blend": "RobotEvade",
    "round_robot_animations.blend": "RobotEvade",
    "sheep_animations.blend": "HeavyEvade",
    "stone_mucker_animations.blend": "MuckerEvade",
    "tree_mucker_animations.blend": "MuckerEvade",
    "turtle_animations.blend": "SwimBurst",
}


def armature():
    rigs = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(rigs) != 1:
        raise RuntimeError(f"Expected one armature, found {[obj.name for obj in rigs]}")
    rig = rigs[0]
    rig.animation_data_create()
    if rig.animation_data.use_tweak_mode:
        rig.animation_data.use_tweak_mode = False
    return rig


def reset_pose(rig):
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))
        bone.location = Vector((0.0, 0.0, 0.0))
        bone.scale = Vector((1.0, 1.0, 1.0))


def neutral_rotations(rig):
    # Empty pose dictionaries do not insert keys. That made exported dodge and
    # evade clips begin at their anticipation pose and end before returning to
    # neutral, even though the authoring tables listed neutral endpoints.
    return {bone.name: (0.0, 0.0, 0.0) for bone in rig.pose.bones}


def key_pose(rig, frame, rotations, locations=None, scales=None):
    for bone_name, euler in rotations.items():
        bone = rig.pose.bones.get(bone_name)
        if bone is None:
            continue
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Euler(euler, "XYZ").to_quaternion()
        bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    for bone_name, location in (locations or {}).items():
        bone = rig.pose.bones.get(bone_name)
        if bone is None:
            continue
        bone.location = Vector(location)
        bone.keyframe_insert(data_path="location", frame=frame)
    for bone_name, scale in (scales or {}).items():
        bone = rig.pose.bones.get(bone_name)
        if bone is None:
            continue
        bone.scale = Vector(scale)
        bone.keyframe_insert(data_path="scale", frame=frame)


def create_action(rig, name, frames):
    existing = bpy.data.actions.get(name)
    if existing is not None:
        bpy.data.actions.remove(existing)
    reset_pose(rig)
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data.action = action
    for entry in frames:
        frame, rotations = entry[:2]
        locations = entry[2] if len(entry) > 2 else None
        scales = entry[3] if len(entry) > 3 else None
        key_pose(rig, frame, rotations, locations, scales)
    rig.animation_data.action = action
    return action


def mirrored_pose(sign):
    return {
        "Waist": (0.28, 0.0, -0.38 * sign),
        "Chest": (0.18, 0.0, -0.32 * sign),
        "Head": (-0.08, 0.0, 0.18 * sign),
        "L_Arm": (-0.35, 0.12, 0.65 * sign),
        "R_Arm": (-0.35, -0.12, 0.65 * sign),
        "L_Thigh": (-0.6, 0.0, -0.24 * sign),
        "R_Thigh": (-0.2, 0.0, 0.35 * sign),
        "L_Leg": (0.75, 0.0, 0.0),
        "R_Leg": (0.35, 0.0, 0.0),
    }


def create_character_actions(rig):
    neutral = neutral_rotations(rig)
    neutral_locations = {"Chest": (0, 0, 0), "Waist": (0, 0, 0)}
    crouch = {
        "Waist": (0.18, 0.0, 0.0),
        "Chest": (0.12, 0.0, 0.0),
        "Head": (-0.08, 0.0, 0.0),
        "L_Arm": (-0.22, 0.0, -0.12),
        "R_Arm": (-0.22, 0.0, 0.12),
        "L_Thigh": (-0.92, 0.0, 0.0),
        "R_Thigh": (-0.92, 0.0, 0.0),
        "L_Leg": (1.3, 0.0, 0.0),
        "R_Leg": (1.3, 0.0, 0.0),
        "L_Foot": (-0.38, 0.0, 0.0),
        "R_Foot": (-0.38, 0.0, 0.0),
    }
    # Chest and Waist are separate root bones with opposite local Y axes.
    # Moving Chest toward -Y and Waist toward +Y lowers both roots in world Z;
    # bone-local Z is horizontal on this legacy rig.
    crouch_locations = {"Chest": (0, -2.25, 0), "Waist": (0, 1.4, 0)}
    crouch_breathe = {
        **crouch,
        "Chest": (0.15, 0.0, 0.0),
        "Head": (-0.1, 0.0, 0.0),
    }
    crouch_breathe_locations = {
        "Chest": (0, -2.3, 0),
        "Waist": (0, 1.42, 0),
    }
    crouch_walk_locations = {
        "Chest": (0, -2.25, 0),
        "Waist": (0, 1.23, 0),
    }
    crouch_walk_left = {
        **crouch,
        "L_Arm": (-0.38, 0.0, -0.18),
        "R_Arm": (-0.05, 0.0, 0.18),
        "L_Thigh": (-1.12, 0.0, -0.08),
        "R_Thigh": (-0.68, 0.0, 0.08),
        "L_Leg": (1.48, 0.0, 0.0),
        "R_Leg": (1.02, 0.0, 0.0),
    }
    crouch_walk_right = {
        **crouch,
        "L_Arm": (-0.05, 0.0, -0.18),
        "R_Arm": (-0.38, 0.0, 0.18),
        "L_Thigh": (-0.68, 0.0, -0.08),
        "R_Thigh": (-1.12, 0.0, 0.08),
        "L_Leg": (1.02, 0.0, 0.0),
        "R_Leg": (1.48, 0.0, 0.0),
    }
    create_action(
        rig,
        "Crouch",
        [
            (0, neutral, neutral_locations),
            (
                5,
                {
                    name: tuple(value * 0.55 for value in rotation)
                    for name, rotation in crouch.items()
                },
                {"Chest": (0, -1.25, 0), "Waist": (0, 0.76, 0)},
            ),
            (12, crouch, crouch_locations),
        ],
    )
    create_action(
        rig,
        "CrouchIdle",
        [
            (0, crouch, crouch_locations),
            (12, crouch_breathe, crouch_breathe_locations),
            (24, crouch, crouch_locations),
        ],
    )
    create_action(
        rig,
        "CrouchWalking",
        [
            (0, crouch_walk_left, crouch_walk_locations),
            (6, crouch, crouch_breathe_locations),
            (12, crouch_walk_right, crouch_walk_locations),
            (18, crouch, crouch_breathe_locations),
            (24, crouch_walk_left, crouch_walk_locations),
        ],
    )
    create_action(
        rig,
        "DodgeLeft",
        [
            (0, neutral),
            (3, mirrored_pose(-0.55)),
            (7, mirrored_pose(-1)),
            (11, mirrored_pose(-0.35)),
            (15, neutral),
        ],
    )
    create_action(
        rig,
        "DodgeRight",
        [
            (0, neutral),
            (3, mirrored_pose(0.55)),
            (7, mirrored_pose(1)),
            (11, mirrored_pose(0.35)),
            (15, neutral),
        ],
    )
    create_action(
        rig,
        "DodgeForward",
        [
            (0, neutral),
            (
                3,
                {
                    "Waist": (0.35, 0, 0),
                    "Chest": (0.28, 0, 0),
                    "L_Thigh": (-0.55, 0, 0),
                    "R_Thigh": (-0.55, 0, 0),
                },
            ),
            (
                7,
                {
                    "Waist": (0.62, 0, 0),
                    "Chest": (0.48, 0, 0),
                    "L_Arm": (-0.75, 0, -0.25),
                    "R_Arm": (-0.75, 0, 0.25),
                    "L_Thigh": (-0.8, 0, 0),
                    "R_Thigh": (-0.25, 0, 0),
                },
            ),
            (11, {"Waist": (0.22, 0, 0), "Chest": (0.18, 0, 0)}),
            (15, neutral),
        ],
    )
    create_action(
        rig,
        "DodgeBack",
        [
            (0, neutral),
            (
                3,
                {
                    "Waist": (-0.22, 0, 0),
                    "Chest": (-0.18, 0, 0),
                    "L_Arm": (0.3, 0, -0.3),
                    "R_Arm": (0.3, 0, 0.3),
                },
            ),
            (
                7,
                {
                    "Waist": (-0.48, 0, 0),
                    "Chest": (-0.34, 0, 0),
                    "L_Thigh": (0.3, 0, 0),
                    "R_Thigh": (0.65, 0, 0),
                },
            ),
            (11, {"Waist": (-0.16, 0, 0), "Chest": (-0.12, 0, 0)}),
            (15, neutral),
        ],
    )
    create_action(
        rig,
        "EvadeRoll",
        [
            (
                0,
                neutral,
                neutral_locations,
                {"Chest": (1, 1, 1), "Waist": (1, 1, 1)},
            ),
            (
                3,
                {
                    # Anticipation: hips lead, both legs load, arms tighten,
                    # and the head stays aimed into travel instead of flipping.
                    "Waist": (0.3, 0, 0),
                    "Chest": (0.42, 0, 0),
                    "Head": (-0.08, 0, 0),
                    "L_Arm": (-0.5, 0.08, -0.28),
                    "R_Arm": (-0.5, -0.08, 0.28),
                    "L_Thigh": (-1.0, 0, -0.08),
                    "R_Thigh": (-1.0, 0, 0.08),
                    "L_Leg": (1.28, 0, 0),
                    "R_Leg": (1.28, 0, 0),
                    "L_Foot": (-0.28, 0, 0),
                    "R_Foot": (-0.28, 0, 0),
                },
                {"Chest": (0, -1.25, 0), "Waist": (0, 0.8, 0)},
                {"Chest": (1.04, 0.88, 1.04), "Waist": (1.04, 0.88, 1.04)},
            ),
            (
                5,
                {
                    # Launch: asymmetric push-off and a small stretch make the
                    # horizontal burst feel explosive without becoming a jump.
                    "Waist": (0.72, 0, 0),
                    "Chest": (0.58, 0, 0),
                    "Head": (-0.16, 0, 0),
                    "L_Arm": (-0.95, 0.08, -0.38),
                    "R_Arm": (-0.72, -0.08, 0.32),
                    "L_Thigh": (-0.35, 0, -0.12),
                    "R_Thigh": (-1.12, 0, 0.1),
                    "L_Leg": (0.55, 0, 0),
                    "R_Leg": (1.38, 0, 0),
                },
                {"Chest": (0, -0.45, 0), "Waist": (0, 0.28, 0)},
                {"Chest": (1.02, 1.06, 1.02), "Waist": (1.02, 1.06, 1.02)},
            ),
            (
                8,
                {
                    # Tuck: knees and arms fold around the center of mass while
                    # one elbow and foot remain offset for a readable silhouette.
                    "Waist": (1.42, 0, 0),
                    "Chest": (1.02, 0, 0),
                    "Head": (-0.34, 0, 0),
                    "L_Arm": (-1.28, 0.12, -0.52),
                    "R_Arm": (-1.12, -0.08, 0.34),
                    "L_Thigh": (-1.38, 0, -0.12),
                    "R_Thigh": (-1.16, 0, 0.18),
                    "L_Leg": (1.58, 0, 0),
                    "R_Leg": (1.38, 0, 0),
                    "L_Foot": (-0.38, 0, -0.08),
                    "R_Foot": (-0.24, 0, 0.12),
                },
                {"Chest": (0, -0.25, 0), "Waist": (0, 0.16, 0)},
                {"Chest": (1.03, 1.02, 1.03), "Waist": (1.03, 1.02, 1.03)},
            ),
            (
                12,
                {
                    # Rotation travels hips -> chest -> head. The character is
                    # never a single rigid object spinning at constant speed.
                    "Waist": (2.72, 0, 0),
                    "Chest": (2.02, 0, 0),
                    "Head": (-0.68, 0, 0),
                    "L_Arm": (-1.48, 0.08, -0.58),
                    "R_Arm": (-1.3, -0.1, 0.42),
                    "L_Thigh": (-1.48, 0, -0.16),
                    "R_Thigh": (-1.22, 0, 0.2),
                    "L_Leg": (1.68, 0, 0),
                    "R_Leg": (1.42, 0, 0),
                    "L_Foot": (-0.42, 0, -0.1),
                    "R_Foot": (-0.28, 0, 0.16),
                },
                {"Chest": (0, 0.3, 0), "Waist": (0, -0.2, 0)},
                {"Chest": (1.04, 1.05, 1.04), "Waist": (1.04, 1.05, 1.04)},
            ),
            (
                15,
                {
                    # Landing: one hand leads contact, the feet separate, and
                    # both roots compress before the final rise.
                    "Waist": (0.78, 0, 0),
                    "Chest": (0.62, 0, 0),
                    "Head": (-0.16, 0, 0),
                    "L_Arm": (-1.22, 0.06, -0.62),
                    "R_Arm": (-0.58, -0.05, 0.38),
                    "L_Thigh": (-0.92, 0, -0.12),
                    "R_Thigh": (-1.18, 0, 0.18),
                    "L_Leg": (1.28, 0, 0),
                    "R_Leg": (1.48, 0, 0),
                    "L_Foot": (-0.34, 0, -0.08),
                    "R_Foot": (-0.42, 0, 0.12),
                },
                {"Chest": (0, -1.55, 0), "Waist": (0, 1.0, 0)},
                {"Chest": (1.06, 0.82, 1.06), "Waist": (1.06, 0.82, 1.06)},
            ),
            (
                18,
                neutral,
                neutral_locations,
                {"Chest": (1, 1, 1), "Waist": (1, 1, 1)},
            ),
        ],
    )
    create_action(
        rig,
        "DoubleJump",
        [
            (
                0,
                neutral,
                neutral_locations,
                {"Chest": (1, 1, 1), "Waist": (1, 1, 1)},
            ),
            (
                2,
                {
                    # Airborne anticipation: pull the knees and elbows toward
                    # the center without pretending the character can crouch
                    # against the ground.
                    "Waist": (0.34, 0, 0),
                    "Chest": (0.3, 0, 0),
                    "Head": (-0.12, 0, 0),
                    "L_Arm": (-0.62, 0.08, -0.28),
                    "R_Arm": (-0.62, -0.08, 0.28),
                    "L_Thigh": (-1.05, 0, -0.08),
                    "R_Thigh": (-1.05, 0, 0.08),
                    "L_Leg": (1.35, 0, 0),
                    "R_Leg": (1.35, 0, 0),
                },
                {"Chest": (0, -0.48, 0), "Waist": (0, 0.3, 0)},
                {"Chest": (1.04, 0.9, 1.04), "Waist": (1.04, 0.9, 1.04)},
            ),
            (
                4,
                {
                    # Second launch: hips lead, chest opens, and the limbs
                    # explode outward into a silhouette distinct from Jump.
                    "Waist": (-0.12, 0, 0),
                    "Chest": (-0.2, 0, 0),
                    "Head": (0.08, 0, 0),
                    "L_Arm": (0.28, 0.06, -0.86),
                    "R_Arm": (0.28, -0.06, 0.86),
                    "L_Thigh": (-0.18, 0, -0.38),
                    "R_Thigh": (-0.18, 0, 0.38),
                    "L_Leg": (0.32, 0, 0),
                    "R_Leg": (0.32, 0, 0),
                },
                {"Chest": (0, 0.5, 0), "Waist": (0, -0.32, 0)},
                {"Chest": (0.98, 1.08, 0.98), "Waist": (0.98, 1.08, 0.98)},
            ),
            (
                7,
                {
                    # Overlap: the torso settles before the hands and feet so
                    # the launch does not freeze at its strongest pose.
                    "Waist": (-0.08, 0, 0.08),
                    "Chest": (-0.12, 0, -0.06),
                    "Head": (0.04, 0, 0.03),
                    "L_Arm": (0.08, 0.04, -0.55),
                    "R_Arm": (0.16, -0.04, 0.68),
                    "L_Thigh": (-0.28, 0, -0.24),
                    "R_Thigh": (-0.12, 0, 0.28),
                    "L_Leg": (0.45, 0, 0),
                    "R_Leg": (0.25, 0, 0),
                },
                {"Chest": (0, 0.25, 0), "Waist": (0, -0.16, 0)},
                {"Chest": (1, 1.03, 1), "Waist": (1, 1.03, 1)},
            ),
            (
                10,
                {
                    "Waist": (0.05, 0, 0),
                    "Chest": (0.04, 0, 0),
                    "L_Arm": (-0.08, 0, -0.18),
                    "R_Arm": (-0.04, 0, 0.22),
                    "L_Thigh": (-0.18, 0, -0.08),
                    "R_Thigh": (-0.12, 0, 0.08),
                    "L_Leg": (0.24, 0, 0),
                    "R_Leg": (0.18, 0, 0),
                },
                {"Chest": (0, 0.08, 0), "Waist": (0, -0.05, 0)},
                {"Chest": (1, 1, 1), "Waist": (1, 1, 1)},
            ),
            (
                12,
                neutral,
                neutral_locations,
                {"Chest": (1, 1, 1), "Waist": (1, 1, 1)},
            ),
        ],
    )


def npc_pose_frames(rig, action_name):
    bones = {bone.name for bone in rig.pose.bones}
    body = "Body" if "Body" in bones else "Chest" if "Chest" in bones else "Head"
    head = "Head" if "Head" in bones else body
    legs = [
        name
        for name in bones
        if any(token in name for token in ("Leg", "Thigh", "Foot", "Flipper"))
    ]
    wings = [name for name in bones if "Wing" in name or "Shoulder" in name]
    cloak = [
        name for name in bones if "Cloak" in name or "Hand" in name or "Lantern" in name
    ]
    neutral = neutral_rotations(rig)
    peak = {body: (0.28, 0.0, 0.45), head: (-0.12, 0.0, -0.2)}

    if action_name in ("MuckerEvade", "QuickHop"):
        peak = {body: (-0.34, 0.0, 0.34), head: (0.2, 0.0, -0.18)}
        for index, name in enumerate(legs):
            peak[name] = (
                (-0.85 if index % 2 == 0 else 0.55),
                0.0,
                0.16 * (-1 if index % 2 else 1),
            )
    elif action_name == "RobotEvade":
        peak = {body: (0.42, 0.0, 0.38), head: (-0.25, 0.0, -0.22)}
        for index, name in enumerate(legs):
            peak[name] = (0.45 * (-1 if index % 2 else 1), 0.0, 0.24)
    elif action_name == "SideLeap":
        peak = {body: (-0.2, 0.0, 0.62), head: (0.14, 0.0, -0.28)}
        for index, name in enumerate(legs):
            peak[name] = (
                (-0.75 if index % 2 == 0 else 0.65),
                0.0,
                0.18 * (-1 if index % 2 else 1),
            )
    elif action_name == "HeavyEvade":
        peak = {body: (0.18, 0.0, 0.35), head: (-0.2, 0.0, -0.24)}
        for index, name in enumerate(legs):
            peak[name] = (0.38 * (-1 if index % 2 else 1), 0.0, 0.12)
    elif action_name == "WingEvade":
        peak = {body: (-0.38, 0.0, 0.34), head: (0.22, 0.0, -0.18)}
        for index, name in enumerate(wings):
            peak[name] = (-0.85, 0.0, 1.05 * (-1 if index % 2 else 1))
        for index, name in enumerate(legs):
            peak[name] = (-0.7, 0.0, 0.0)
    elif action_name == "SwimBurst":
        peak = {body: (0.0, 0.0, 0.25), head: (0.0, 0.0, -0.18)}
        for index, name in enumerate(legs):
            peak[name] = (0.0, 0.0, 0.75 * (-1 if index % 2 else 1))
        if "Tail" in bones:
            peak["Tail"] = (0.0, 0.0, 0.9)
    elif action_name == "HexerEvade":
        peak = {head: (-0.18, 0.0, 0.52)}
        for index, name in enumerate(cloak):
            peak[name] = (0.45, 0.0, 0.85 * (-1 if index % 2 else 1))
    elif action_name == "Evade":
        for index, name in enumerate(legs):
            peak[name] = (-0.5 if index % 2 == 0 else 0.4, 0.0, 0.2)

    lead = {
        name: tuple(value * 0.45 for value in rotation)
        for name, rotation in peak.items()
    }
    recovery = {
        name: tuple(value * 0.25 for value in rotation)
        for name, rotation in peak.items()
    }
    return [(0, neutral), (3, lead), (7, peak), (11, recovery), (15, neutral)]


def create_npc_action(rig, action_name):
    create_action(rig, action_name, npc_pose_frames(rig, action_name))


def decode_data_uri(uri):
    prefix, payload = uri.split(",", 1)
    if ";base64" not in prefix:
        raise RuntimeError("Only base64 GLTF data URIs are supported")
    return base64.b64decode(payload)


def encode_data_uri(mime_type, payload):
    return f"data:{mime_type};base64,{base64.b64encode(payload).decode('ascii')}"


def merge_animations(
    existing_path, exported_path, animation_names, animation_metadata=None
):
    with open(existing_path, "r", encoding="utf-8") as handle:
        existing = json.load(handle)
    with open(exported_path, "r", encoding="utf-8") as handle:
        exported = json.load(handle)

    existing_buffer = bytearray(decode_data_uri(existing["buffers"][0]["uri"]))
    exported_uri = exported["buffers"][0]["uri"]
    if exported_uri.startswith("data:"):
        exported_buffer = decode_data_uri(exported_uri)
    else:
        with open(
            os.path.join(os.path.dirname(exported_path), exported_uri), "rb"
        ) as handle:
            exported_buffer = handle.read()

    existing_joint_nodes = {
        joint for skin in existing.get("skins", []) for joint in skin.get("joints", [])
    }
    exported_joint_nodes = {
        joint for skin in exported.get("skins", []) for joint in skin.get("joints", [])
    }

    def nodes_by_name(document, joint_nodes, joints):
        result = {}
        for index, node in enumerate(document.get("nodes", [])):
            name = node.get("name")
            if not name or ((index in joint_nodes) != joints):
                continue
            result.setdefault(name, index)
        return result

    existing_joint_by_name = nodes_by_name(existing, existing_joint_nodes, True)
    existing_non_joint_by_name = nodes_by_name(existing, existing_joint_nodes, False)
    exported_node_by_index = {
        index: node.get("name") for index, node in enumerate(exported.get("nodes", []))
    }
    selected = [
        animation
        for animation in exported.get("animations", [])
        if animation.get("name") in animation_names
    ]
    if {animation.get("name") for animation in selected} != set(animation_names):
        raise RuntimeError(
            f"Export did not contain every requested action: wanted {animation_names}, got {[animation.get('name') for animation in selected]}"
        )

    existing.setdefault("bufferViews", [])
    existing.setdefault("accessors", [])
    existing.setdefault("animations", [])
    existing["animations"] = [
        animation
        for animation in existing["animations"]
        if animation.get("name") not in animation_names
    ]
    copied_views = {}
    copied_accessors = {}

    def append_aligned(payload):
        while len(existing_buffer) % 4:
            existing_buffer.append(0)
        offset = len(existing_buffer)
        existing_buffer.extend(payload)
        return offset

    def copy_view(index):
        if index in copied_views:
            return copied_views[index]
        source = exported["bufferViews"][index]
        start = source.get("byteOffset", 0)
        end = start + source["byteLength"]
        target = copy.deepcopy(source)
        target["buffer"] = 0
        target["byteOffset"] = append_aligned(exported_buffer[start:end])
        copied_views[index] = len(existing["bufferViews"])
        existing["bufferViews"].append(target)
        return copied_views[index]

    def copy_accessor(index):
        if index in copied_accessors:
            return copied_accessors[index]
        target = copy.deepcopy(exported["accessors"][index])
        if "bufferView" in target:
            target["bufferView"] = copy_view(target["bufferView"])
        copied_accessors[index] = len(existing["accessors"])
        existing["accessors"].append(target)
        return copied_accessors[index]

    for source_animation in selected:
        animation = copy.deepcopy(source_animation)
        metadata = (animation_metadata or {}).get(animation.get("name"))
        if metadata:
            animation.setdefault("extras", {}).update(copy.deepcopy(metadata))
        for sampler in animation.get("samplers", []):
            sampler["input"] = copy_accessor(sampler["input"])
            sampler["output"] = copy_accessor(sampler["output"])
        for channel in animation.get("channels", []):
            source_node = channel.get("target", {}).get("node")
            source_name = exported_node_by_index.get(source_node)
            target_lookup = (
                existing_joint_by_name
                if source_node in exported_joint_nodes
                else existing_non_joint_by_name
            )
            if source_name not in target_lookup:
                raise RuntimeError(
                    f"Animation {animation.get('name')} targets unknown node {source_name!r}"
                )
            channel["target"]["node"] = target_lookup[source_name]
        existing["animations"].append(animation)

    existing["buffers"][0]["byteLength"] = len(existing_buffer)
    existing["buffers"][0]["uri"] = encode_data_uri(
        "application/octet-stream", bytes(existing_buffer)
    )
    with open(existing_path, "w", encoding="utf-8") as handle:
        json.dump(existing, handle, indent=2)
        handle.write("\n")


def export_and_merge(gltf_path, animation_names, animation_metadata=None):
    temp_dir = tempfile.mkdtemp(prefix="biomes-movement-actions-")
    nla_states = []
    try:
        for obj in bpy.data.objects:
            if obj.type == "ARMATURE" and obj.animation_data:
                nla_states.append((obj.animation_data, obj.animation_data.use_nla))
                obj.animation_data.use_nla = False
        exported_path = os.path.join(temp_dir, "export.gltf")
        bpy.ops.export_scene.gltf(
            filepath=exported_path,
            export_format="GLTF_SEPARATE",
            export_animations=True,
            export_animation_mode="ACTIONS",
            export_force_sampling=True,
            export_frame_range=True,
            export_cameras=False,
            export_lights=False,
        )
        merge_animations(
            gltf_path,
            exported_path,
            animation_names,
            animation_metadata=animation_metadata,
        )
    finally:
        for animation_data, use_nla in nla_states:
            animation_data.use_nla = use_nla
        shutil.rmtree(temp_dir, ignore_errors=True)


def main():
    blend_path = bpy.data.filepath
    if not blend_path:
        raise RuntimeError("Open a .blend before running this script")
    basename = os.path.basename(blend_path)
    rig = armature()
    if basename == "character-animations.blend":
        create_character_actions(rig)
        action_names = CHARACTER_ACTIONS
        animation_metadata = {"EvadeRoll": ROLL_DODGE_METADATA}
    else:
        action_name = NPC_ACTION_BY_FILE.get(basename)
        if not action_name:
            raise RuntimeError(f"No movement-action profile for {basename}")
        create_npc_action(rig, action_name)
        action_names = (action_name,)
        animation_metadata = None

    bpy.context.scene.render.fps = 24
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    gltf_path = os.path.splitext(blend_path)[0] + ".gltf"
    export_and_merge(
        gltf_path, action_names, animation_metadata=animation_metadata
    )
    print(f"MOVEMENT_ACTIONS_UPDATED {basename}: {', '.join(action_names)}")


if __name__ == "__main__":
    main()
