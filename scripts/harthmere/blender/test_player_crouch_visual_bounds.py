#!/usr/bin/env python3
"""Verify exported crouch poses fit the runtime collision hull."""

import os
import sys

import bpy
from mathutils import Vector


STANDING_GAME_HEIGHT = 1.8
CROUCH_COLLISION_HEIGHT = 1.3
MAX_VISUAL_MARGIN_METERS = 0.015
MAX_FOOT_DRIFT_METERS = 0.02


def input_path():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 1:
        raise RuntimeError("Expected: -- INPUT_GLTF")
    return os.path.abspath(args[0])


def action_bounds(rig, meshes, name, frame):
    action = bpy.data.actions.get(name)
    if action is None:
        raise AssertionError(f"Missing action {name}")
    rig.animation_data.action = action
    bpy.context.scene.frame_set(frame - 1)
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(
            evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box
        )
    return min(point.z for point in points), max(point.z for point in points)


def main():
    bpy.ops.import_scene.gltf(filepath=input_path())
    rig = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    rig.animation_data_create()
    rig.animation_data.use_nla = False
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]

    standing_min, standing_max = action_bounds(rig, meshes, "Idle", 12)
    source_to_game = STANDING_GAME_HEIGHT / (standing_max - standing_min)
    for name in ("CrouchIdle", "CrouchWalking"):
        action = bpy.data.actions[name]
        start, end = (int(value) for value in action.frame_range)
        maximum_visual_height = 0
        maximum_foot_drift = 0
        for frame in range(start, end + 1):
            minimum, maximum = action_bounds(rig, meshes, name, frame)
            visual_height = (maximum - minimum) * source_to_game
            foot_drift = abs(minimum - standing_min) * source_to_game
            maximum_visual_height = max(maximum_visual_height, visual_height)
            maximum_foot_drift = max(maximum_foot_drift, foot_drift)
            if visual_height > CROUCH_COLLISION_HEIGHT + MAX_VISUAL_MARGIN_METERS:
                raise AssertionError(
                    f"{name} frame {frame} visual height "
                    f"{visual_height:.3f} m exceeds the "
                    f"{CROUCH_COLLISION_HEIGHT:.3f} m collision hull"
                )
            if foot_drift > MAX_FOOT_DRIFT_METERS:
                raise AssertionError(
                    f"{name} frame {frame} feet drift {foot_drift:.3f} m "
                    "from the standing ground plane"
                )
        print(
            f"OK {name}: max_visual_height={maximum_visual_height:.3f}m "
            f"max_foot_drift={maximum_foot_drift:.3f}m "
            f"frames={start}-{end}"
        )
    crouch_end = int(bpy.data.actions["Crouch"].frame_range[1])
    minimum, maximum = action_bounds(rig, meshes, "Crouch", crouch_end)
    final_height = (maximum - minimum) * source_to_game
    final_foot_drift = abs(minimum - standing_min) * source_to_game
    if final_height > CROUCH_COLLISION_HEIGHT + MAX_VISUAL_MARGIN_METERS:
        raise AssertionError(
            f"Crouch final visual height {final_height:.3f} m exceeds "
            f"the {CROUCH_COLLISION_HEIGHT:.3f} m collision hull"
        )
    if final_foot_drift > MAX_FOOT_DRIFT_METERS:
        raise AssertionError(
            f"Crouch final feet drift {final_foot_drift:.3f} m from "
            "the standing ground plane"
        )
    print(
        f"OK Crouch transition final frame {crouch_end}: "
        f"visual_height={final_height:.3f}m "
        f"foot_drift={final_foot_drift:.3f}m"
    )
    print("RESULT PASS")


if __name__ == "__main__":
    main()
