#!/usr/bin/env python3
"""Validate that every player combo step owns a distinct Tool-bone path.

Run with Blender so pose evaluation matches the authored source exactly::

    blender --background src/galois/data/animations/character-animations.blend \
      --python scripts/harthmere/blender/validate_player_combo_weapon_paths.py

The stock character faces along the armature's horizontal Y axis.  The Tool
bone tail therefore gives a stable sword-tip proxy for comparing side-to-side
travel and vertical travel without depending on a particular held-item mesh.
"""

from __future__ import annotations

import bpy


EXPECTED_PROFILE = "aaa-voxel-sword-v4-distinct-trajectory-combo"
EXPECTED_VERSION = "harthmere-player-combo-animation-polish-v4-trajectories"


def armature() -> bpy.types.Object:
    rigs = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(rigs) != 1:
        raise RuntimeError(f"Expected one armature, found {[obj.name for obj in rigs]}")
    rig = rigs[0]
    rig.animation_data_create()
    return rig


def tool_tail(rig: bpy.types.Object, frame: int) -> tuple[float, float, float]:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    point = rig.matrix_world @ rig.pose.bones["Tool"].tail
    return (float(point.x), float(point.y), float(point.z))


def validate_path(step: int, lateral: float, vertical: float) -> bool:
    if step == 1:
        return lateral < -1.25 and abs(lateral) > abs(vertical) * 1.6
    if step == 2:
        return lateral > 1.25 and abs(lateral) > abs(vertical) * 1.6
    if step == 3:
        return vertical < -1.8 and abs(vertical) > abs(lateral) * 1.7
    return vertical > 1.4 and abs(vertical) > abs(lateral) * 1.6


def main() -> None:
    rig = armature()
    failures: list[str] = []
    rows: list[str] = []
    for family, windup_frame, impact_frame, follow_frame in (
        ("Basic", 3, 6, 8),
        ("Heavy", 6, 10, 14),
    ):
        for step in range(1, 5):
            name = f"HarthmereBodyWeapon{family}_Variation{step}_24"
            action = bpy.data.actions.get(name)
            if action is None:
                failures.append(f"missing {name}")
                continue
            rig.animation_data.action = action
            windup = tool_tail(rig, windup_frame)
            contact = tool_tail(rig, impact_frame)
            follow = tool_tail(rig, follow_frame)
            lateral = follow[1] - windup[1]
            vertical = follow[2] - windup[2]
            passed = validate_path(step, lateral, vertical)
            metadata_ok = (
                action.get("harthmereCombatProfile") == EXPECTED_PROFILE
                and action.get("harthmereAnimationPolishVersion") == EXPECTED_VERSION
                and action.get("comboStep") == step
                and isinstance(action.get("weaponArc"), str)
            )
            if not passed:
                failures.append(
                    f"{name} path lateral={lateral:.3f} vertical={vertical:.3f}"
                )
            if not metadata_ok:
                failures.append(f"{name} metadata")
            rows.append(
                f"{name}: lateral={lateral:.3f} vertical={vertical:.3f} "
                f"contact=({contact[0]:.3f},{contact[1]:.3f},{contact[2]:.3f})"
            )
    print("\n".join(rows))
    if failures:
        raise RuntimeError("COMBO_PATH_VALIDATION_FAILED " + "; ".join(failures))
    print("COMBO_PATH_VALIDATION_PASS")


if __name__ == "__main__":
    main()
