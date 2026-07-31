from __future__ import annotations

import math
from pathlib import Path

import bpy
import generate_boss_voxel_assets as core


def add_material(name, rgba, *, emission=0.0, metallic=0.0, roughness=0.8):
    value = core.MaterialSpec(
        rgba, emission=emission, metallic=metallic, roughness=roughness
    )
    core.MATERIALS[name] = value
    if emission < 1.0:
        core.MATERIALS[f"{name}__shadow"] = core._shifted_material(value, "shadow")
        core.MATERIALS[f"{name}__highlight"] = core._shifted_material(
            value, "highlight"
        )


# Clean-room palettes: these names and values are unique to this scratch pass.
add_material("vein_scale_dark", (27, 33, 42, 255), metallic=0.16, roughness=0.36)
add_material("vein_scale", (78, 45, 29, 255), metallic=0.28, roughness=0.42)
add_material("vein_scale_light", (135, 72, 31, 255), metallic=0.22, roughness=0.35)
add_material("vein_crystal", (224, 79, 15, 255), emission=1.45, roughness=0.14)
add_material("vein_crystal_hot", (255, 188, 54, 255), emission=2.1, roughness=0.1)
add_material("vein_membrane", (91, 44, 52, 255), emission=0.04, roughness=0.5)
add_material("vein_slate", (42, 54, 65, 255), metallic=0.08, roughness=0.62)

add_material("alpha_bark_black", (31, 25, 21, 255), roughness=0.96)
add_material("alpha_bark", (70, 48, 31, 255), roughness=0.94)
add_material("alpha_bark_worn", (117, 78, 43, 255), roughness=0.9)
add_material("alpha_sap", (158, 196, 55, 255), emission=1.45, roughness=0.25)
add_material("alpha_heart", (145, 24, 12, 255), emission=1.18, roughness=0.2)
add_material("alpha_leaf_dark", (25, 52, 38, 255), roughness=0.92)
add_material("alpha_leaf", (56, 91, 48, 255), roughness=0.88)
add_material("alpha_muck", (48, 38, 35, 255), metallic=0.08, roughness=0.7)
add_material("alpha_roadstone", (97, 92, 83, 255), roughness=0.78)

add_material("echo_void", (19, 16, 38, 255), metallic=0.18, roughness=0.3)
add_material("echo_mirror", (178, 204, 215, 255), metallic=0.88, roughness=0.08)
add_material("echo_edge", (93, 226, 255, 255), emission=2.2, roughness=0.12)
add_material("echo_memory", (233, 76, 200, 255), emission=1.65, roughness=0.15)
add_material("echo_delay", (106, 78, 212, 255), emission=1.25, roughness=0.2)
add_material("echo_guard", (255, 221, 121, 255), emission=1.55, roughness=0.18)

add_material("apprentice_cloth", (65, 70, 78, 255), roughness=0.98)
add_material("apprentice_cloth_torn", (34, 37, 44, 255), roughness=0.98)
add_material("apprentice_bone", (174, 166, 145, 255), roughness=0.82)
add_material("apprentice_bell", (104, 65, 41, 255), metallic=0.74, roughness=0.38)
add_material("apprentice_bell_edge", (171, 106, 53, 255), metallic=0.82, roughness=0.28)
add_material("apprentice_verdigris", (42, 108, 100, 255), metallic=0.3, roughness=0.44)
add_material("apprentice_voice", (142, 91, 229, 255), emission=1.7, roughness=0.16)
add_material("apprentice_voice_hot", (235, 212, 255, 255), emission=2.8, roughness=0.1)


def build_amber_vein_wyrmling(b):
    """A young, articulate vein-dragon designed around speed and yielding."""
    b.bone("Body", (0, 5, 20))
    b.bone("Chest", (0, -8, 22), "Body")
    b.bone("Neck", (0, -18, 24), "Chest")
    b.bone("Head", (0, -29, 24), "Neck")
    b.bone("Jaw", (0, -37, 19), "Head")
    b.bone("Crown", (0, -25, 30), "Head")
    b.bone("Emitter", (0, -34, 21), "Head")
    b.bone("VeinJet", (0, -42, 20), "Head")
    b.bone("VeinShield.L", (-13, 2, 25), "Body")
    b.bone("VeinShield.R", (13, 2, 25), "Body")
    b.bone("Wing.L", (-10, 7, 27), "Body")
    b.bone("Wing.R", (10, 7, 27), "Body")
    b.bone("WingTip.L", (-22, 17, 25), "Wing.L")
    b.bone("WingTip.R", (22, 17, 25), "Wing.R")
    b.bone("Tail.1", (0, 21, 18), "Body")
    b.bone("Tail.2", (7, 36, 13), "Tail.1")
    b.bone("Tail.3", (2, 50, 8), "Tail.2")
    b.bone("Tail.4", (-7, 61, 5), "Tail.3")

    legs = {
        "FL": ((-10, -10, 18), (-16, -17, 9), (-20, -23, 2)),
        "FR": ((10, -10, 18), (16, -17, 9), (20, -23, 2)),
        "BL": ((-11, 14, 16), (-18, 22, 8), (-23, 29, 2)),
        "BR": ((11, 14, 16), (18, 22, 8), (23, 29, 2)),
    }
    for suffix, (hip, knee, foot) in legs.items():
        b.bone(f"Leg.{suffix}", hip, "Body")
        b.bone(f"Shin.{suffix}", knee, f"Leg.{suffix}")
        b.bone(f"Claw.{suffix}", foot, f"Shin.{suffix}")

    # Primary forms: deep chest, narrow waist, long intelligent head.
    b.ellipsoid("Body", (0, 7, 20), (13, 22, 10), "vein_scale_dark")
    b.ellipsoid("Body", (0, 3, 23), (10, 18, 9), "vein_scale")
    b.ellipsoid("Chest", (0, -9, 22), (12, 14, 10), "vein_scale")
    for y, z, width in ((-12, 16, 8), (-5, 15, 10), (3, 14, 11), (12, 13, 10)):
        b.box("Body", (0, y, z), (width, 3, 2), "vein_scale_light")
    b.line("Neck", (0, -10, 24), (0, -27, 25), 7.0, "vein_scale", 4.8)
    for y, height, side in ((-18, 5, -1), (-8, 7, 1), (3, 8, -1), (14, 6, 1)):
        b.triangle(
            "Body",
            (-3, y - 2, 28),
            (3, y - 2, 28),
            (side * 2, y + 1, 28 + height),
            0.9,
            "vein_crystal",
        )
    b.ellipsoid("Head", (0, -29, 25), (8, 11, 7), "vein_scale")
    b.line("Head", (0, -31, 24), (0, -39, 21), 5.0, "vein_slate", 3.5)
    b.box("Jaw", (0, -39, 18), (11, 8, 3), "vein_scale_dark")
    for x in (-4, -2, 0, 2, 4):
        b.cone("Jaw", (x, -42, 19), (x, -45, 16), 0.7, "vein_crystal_hot")
    for side in (-1, 1):
        b.ellipsoid("Head", (side * 3.2, -38, 27), (1.2, 0.8, 1.2), "vein_crystal_hot")
        b.line(
            "Crown", (side * 4, -27, 30), (side * 9, -20, 40), 1.4, "vein_crystal", 0.7
        )
    b.line("Crown", (0, -25, 31), (-2, -17, 42), 1.2, "vein_scale_light", 0.6)
    b.ellipsoid("Emitter", (0, -36, 21), (3.5, 2.0, 3.5), "vein_crystal")
    b.line("VeinJet", (0, -42, 20), (0, -51, 20), 2.6, "vein_crystal", 1.0)
    b.ring_xz("VeinJet", (0, -50, 20), 3.2, 3.2, 0.6, "vein_crystal_hot")

    # Crystal shoulder shields visibly fold forward during defensive/yield states.
    for bone, side in (("VeinShield.L", -1), ("VeinShield.R", 1)):
        b.triangle(
            bone,
            (side * 7, -3, 27),
            (side * 24, 3, 36),
            (side * 17, 14, 17),
            1.3,
            "vein_crystal",
        )
        b.line(bone, (side * 9, -2, 27), (side * 23, 3, 36), 1.2, "vein_scale_light")
        b.cone(bone, (side * 17, 9, 22), (side * 29, 15, 24), 1.1, "vein_crystal")

    # Small but functional wings: burst-jumps and braking, not adult flight sails.
    for side, root, tip in ((-1, "Wing.L", "WingTip.L"), (1, "Wing.R", "WingTip.R")):
        b.line(root, (side * 8, 8, 28), (side * 22, 20, 30), 2.0, "vein_slate", 1.0)
        b.triangle(
            root,
            (side * 8, 8, 28),
            (side * 23, 20, 30),
            (side * 14, 25, 15),
            0.9,
            "vein_membrane",
        )
        b.line(tip, (side * 22, 20, 30), (side * 16, 31, 17), 1.0, "vein_crystal", 0.55)

    for suffix, (hip, knee, foot) in legs.items():
        side = -1 if suffix.endswith("L") else 1
        b.line(f"Leg.{suffix}", hip, knee, 3.5, "vein_scale_dark", 2.5)
        b.line(f"Shin.{suffix}", knee, foot, 2.4, "vein_scale_light", 1.4)
        b.ellipsoid(f"Shin.{suffix}", knee, (3, 3, 3), "vein_crystal")
        for spread in (-2, 0, 2):
            b.cone(
                f"Claw.{suffix}",
                foot,
                (foot[0] + spread + side, foot[1] - 7, 0),
                0.9,
                "vein_crystal_hot",
            )

    b.line("Tail.1", (0, 20, 19), (8, 37, 13), 5.0, "vein_scale_dark", 3.8)
    b.line("Tail.2", (8, 36, 13), (3, 51, 8), 3.8, "vein_scale", 2.7)
    b.line("Tail.3", (3, 50, 8), (-8, 63, 5), 2.7, "vein_scale_light", 1.6)
    b.cone("Tail.4", (-8, 62, 5), (-3, 75, 2), 1.6, "vein_crystal")


def build_muckheart_walking_tree(b):
    """A giant evil road-uprooting tree animated by a visible Muckheart."""
    b.bone("Trunk", (0, 4, 45))
    b.bone("Heart", (0, -12, 43), "Trunk")
    b.bone("Face", (0, -14, 62), "Trunk")
    b.bone("JawRoot", (0, -20, 53), "Face")
    b.bone("Crown", (0, 5, 77), "Trunk")
    b.bone("Canopy.L", (-24, 4, 78), "Crown")
    b.bone("Canopy.R", (25, 8, 75), "Crown")
    b.bone("Branch.L", (-17, -3, 58), "Trunk")
    b.bone("Branch.R", (18, -1, 61), "Trunk")
    b.bone("Claw.L", (-38, -19, 34), "Branch.L")
    b.bone("Claw.R", (42, -16, 31), "Branch.R")
    b.bone("RootLeg.L", (-12, 11, 27), "Trunk")
    b.bone("RootLeg.R", (13, 13, 25), "Trunk")
    b.bone("RootFoot.L", (-25, 24, 5), "RootLeg.L")
    b.bone("RootFoot.R", (28, 20, 5), "RootLeg.R")
    b.bone("Taproot", (0, 17, 21), "Trunk")
    b.bone("SeedVolley.L", (-25, 1, 74), "Canopy.L")
    b.bone("SeedVolley.R", (27, 5, 72), "Canopy.R")
    b.bone("Cage.L", (-18, -18, 10), "Trunk")
    b.bone("Cage.R", (18, -18, 10), "Trunk")
    b.bone("Cage.Back", (0, 12, 10), "Trunk")

    # Trunk mass and buttress roots establish a tree first, creature second.
    b.ellipsoid("Trunk", (0, 4, 46), (19, 17, 35), "alpha_bark_black")
    b.ellipsoid("Trunk", (-3, 2, 50), (15, 14, 31), "alpha_bark")
    for x, y, z, radius in (
        (-12, 4, 46, 5),
        (10, 8, 53, 4),
        (-6, 13, 32, 5),
        (7, -2, 67, 4),
    ):
        b.line(
            "Trunk",
            (x, y, z - 12),
            (x + 2, y - 1, z + 14),
            radius,
            "alpha_bark_worn",
            max(1.5, radius - 2),
        )
    # Hollow face and jaw are grown into the front, not pasted on as a humanoid head.
    b.ellipsoid("Face", (0, -14, 63), (12, 8, 14), "alpha_bark")
    b.triangle(
        "Face", (-11, -21, 69), (11, -21, 69), (0, -22, 54), 1.8, "alpha_bark_black"
    )
    for side in (-1, 1):
        b.ellipsoid("Face", (side * 5, -22, 66), (2.2, 1.2, 2.8), "alpha_heart")
        b.line(
            "Face",
            (side * 8, -23, 70),
            (side * 2, -24, 67),
            1.0,
            "alpha_bark_black",
            0.55,
        )
        b.line(
            "Face",
            (side * 7, -19, 73),
            (side * 13, -15, 79),
            2.0,
            "alpha_bark_worn",
            0.8,
        )
    b.line("JawRoot", (-10, -23, 54), (0, -27, 48), 2.2, "alpha_bark_black")
    b.line("JawRoot", (10, -23, 54), (0, -27, 48), 2.2, "alpha_bark_black")
    for x in (-8, -4, 0, 4, 8):
        b.cone("JawRoot", (x, -25, 54), (x * 1.1, -29, 49), 1.0, "alpha_roadstone")

    # Signature exposed Muckheart behind split bark ribs.
    b.ellipsoid("Heart", (0, -18, 43), (7, 4, 10), "alpha_heart")
    b.ring_xz("Heart", (0, -20, 43), 10, 14, 1.1, "alpha_sap", (0.25, math.pi - 0.25))
    for z in (34, 40, 46, 52):
        b.line("Trunk", (-13, -17, z), (-5, -22, z + 2), 1.5, "alpha_bark_worn", 0.8)
        b.line("Trunk", (13, -17, z), (5, -22, z + 2), 1.5, "alpha_bark_worn", 0.8)

    # Huge branch arms end in root grapples, supporting slam and grab silhouettes.
    b.line("Branch.L", (-13, -1, 60), (-35, -14, 40), 7.0, "alpha_bark", 3.3)
    b.line("Branch.R", (14, 0, 62), (38, -12, 36), 7.5, "alpha_bark_worn", 3.5)
    for bone, hand, side in (
        ("Claw.L", (-38, -18, 35), -1),
        ("Claw.R", (42, -16, 32), 1),
    ):
        for spread in (-8, -3, 3, 8):
            b.line(
                bone,
                hand,
                (
                    hand[0] + side * 15,
                    hand[1] - 9 + abs(spread) * 0.2,
                    hand[2] + spread,
                ),
                2.2,
                "alpha_bark_black",
                0.7,
            )

    # Two walking root columns plus a dragging taproot preserve enormous weight.
    for bone, foot_bone, side in (
        ("RootLeg.L", "RootFoot.L", -1),
        ("RootLeg.R", "RootFoot.R", 1),
    ):
        b.line(
            bone, (side * 10, 10, 33), (side * 20, 23, 9), 9.0, "alpha_bark_black", 5.0
        )
        b.line(
            foot_bone, (side * 20, 23, 8), (side * 37, 10, 1), 4.5, "alpha_bark", 1.2
        )
        b.line(
            foot_bone, (side * 20, 23, 8), (side * 12, 39, 1), 4.0, "alpha_bark", 1.0
        )
        b.box(foot_bone, (side * 25, 18, 2), (13, 12, 4), "alpha_muck")
    b.line("Taproot", (0, 17, 30), (0, 48, 3), 6.0, "alpha_bark_black", 1.2)
    b.line("Taproot", (0, 46, 3), (-18, 58, 0), 2.6, "alpha_bark", 0.8)
    b.line("Taproot", (0, 46, 3), (18, 60, 0), 2.6, "alpha_bark", 0.8)

    # Asymmetric storm canopy, seed artillery, and stolen road stones.
    for bone, center, radius, material in (
        ("Crown", (0, 7, 83), (20, 15, 13), "alpha_leaf_dark"),
        ("Canopy.L", (-25, 2, 81), (19, 14, 12), "alpha_leaf"),
        ("Canopy.R", (28, 9, 77), (23, 16, 14), "alpha_leaf_dark"),
        ("Canopy.R", (37, 14, 88), (12, 10, 9), "alpha_leaf"),
    ):
        b.ellipsoid(bone, center, radius, material)
    # Exposed crown branches keep the silhouette tree-like instead of reading
    # as a humanoid with a rounded leaf cap.
    for end, radius in (
        ((-42, -2, 94), 3.4),
        ((-24, 11, 102), 3.0),
        ((18, -1, 101), 3.2),
        ((48, 17, 96), 3.6),
    ):
        b.line("Crown", (0, 7, 72), end, radius, "alpha_bark_black", 0.8)
    b.line("Canopy.R", (25, 8, 80), (52, 2, 84), 2.4, "alpha_bark_worn", 0.55)
    b.line("Canopy.L", (-20, 3, 80), (-48, 10, 74), 2.2, "alpha_bark", 0.5)
    for bone, center in (
        ("SeedVolley.L", (-27, -7, 76)),
        ("SeedVolley.R", (31, -5, 73)),
    ):
        for dx, dz in ((-5, 3), (0, 0), (5, 4), (2, -5)):
            b.ellipsoid(
                bone,
                (center[0] + dx, center[1], center[2] + dz),
                (2.3, 2.0, 3.2),
                "alpha_sap",
            )
    for p in ((-18, -10, 32), (16, 12, 28), (26, 5, 51)):
        b.box("Trunk", p, (7, 5, 5), "alpha_roadstone")
    for bone, base, side in (
        ("Cage.L", (-18, -18, 0), -1),
        ("Cage.R", (18, -18, 0), 1),
    ):
        b.line(bone, base, (side * 12, -13, 25), 2.2, "alpha_bark_black", 0.7)
        b.line(bone, (side * 12, -13, 25), (side * 5, -8, 34), 1.3, "alpha_sap", 0.55)
    b.line("Cage.Back", (0, 15, 0), (0, 7, 29), 2.4, "alpha_bark_black", 0.8)
    b.line("Cage.Back", (0, 7, 29), (0, -3, 37), 1.4, "alpha_sap", 0.55)


def build_reflection_predator(b):
    """A non-humanoid resonance predator assembled from copied combat shapes."""
    b.bone("Core", (0, 0, 27))
    b.bone("BellBody", (0, 1, 25), "Core")
    b.bone("Mask.Front", (0, -15, 31), "Core")
    b.bone("Mask.Left", (-14, 2, 30), "Core")
    b.bone("Mask.Right", (14, 5, 28), "Core")
    b.bone("Blade.L", (-16, -4, 23), "Core")
    b.bone("Blade.R", (16, -2, 23), "Core")
    b.bone("Guard", (0, 7, 22), "Core")
    b.bone("Emitter", (0, -5, 28), "Core")
    b.bone("Echo.A", (-22, 10, 18), "Core")
    b.bone("Echo.B", (22, 15, 18), "Core")
    b.bone("TimeRing", (0, 3, 28), "Core")
    b.bone("Skirt.L", (-7, 4, 12), "BellBody")
    b.bone("Skirt.R", (7, 4, 12), "BellBody")

    # Suspended cracked bell/prism: no legs, no ordinary humanoid torso.
    b.ellipsoid("BellBody", (0, 1, 27), (12, 10, 17), "echo_void")
    b.triangle("BellBody", (-11, -2, 32), (11, -2, 32), (0, 3, 49), 1.6, "echo_mirror")
    b.ring_xz("BellBody", (0, 2, 15), 13, 8, 1.4, "echo_mirror", (math.pi, math.tau))
    b.ellipsoid("Core", (0, -4, 28), (5, 3, 7), "echo_memory")
    b.box("Core", (0, -8, 28), (2, 2, 11), "echo_edge")
    # Three masks each represent a copied timing sample.
    for bone, center, tilt_mat in (
        ("Mask.Front", (0, -16, 33), "echo_mirror"),
        ("Mask.Left", (-16, 1, 31), "echo_delay"),
        ("Mask.Right", (16, 4, 29), "echo_edge"),
    ):
        b.ellipsoid(bone, center, (6, 2.5, 8), tilt_mat)
        b.box(bone, (center[0], center[1] - 2, center[2]), (1.4, 1.2, 11), "echo_void")
        b.box(
            bone, (center[0], center[1] - 2, center[2] - 2), (8, 1.2, 1.3), "echo_void"
        )
    # Copied melee limbs are oversized mirrored tuning blades.
    b.line("Blade.L", (-8, -2, 28), (-30, -16, 12), 3.0, "echo_mirror", 1.0)
    b.cone("Blade.L", (-29, -16, 12), (-42, -22, 4), 2.0, "echo_edge")
    b.line("Blade.R", (8, -1, 29), (31, -11, 16), 3.0, "echo_mirror", 1.0)
    b.cone("Blade.R", (30, -11, 16), (43, -17, 8), 2.0, "echo_memory")
    # Copied guard/ranged shapes fold out of the rear shell.
    b.ring_xz("Guard", (0, 10, 25), 14, 17, 1.5, "echo_guard", (0.15, math.pi - 0.15))
    for angle in (-0.75, -0.25, 0.25, 0.75):
        x = math.sin(angle) * 13
        z = 26 + math.cos(angle) * 15
        b.line("Emitter", (0, -7, 28), (x, -20, z), 1.1, "echo_edge", 0.45)
    b.ring_xz("TimeRing", (0, 4, 29), 21, 23, 0.8, "echo_delay")
    b.ring_xy("TimeRing", (0, 3, 29), 25, 18, 0.65, "echo_memory")
    # Delayed afterimages are incomplete silhouettes, not duplicate bodies.
    for bone, side in (("Echo.A", -1), ("Echo.B", 1)):
        b.triangle(
            bone,
            (side * 17, 9, 8),
            (side * 31, 13, 30),
            (side * 20, 23, 46),
            1.0,
            "echo_delay",
        )
        b.line(bone, (side * 21, 12, 23), (side * 37, 5, 10), 1.1, "echo_edge", 0.45)
    # Split resonance skirt reads as hovering propulsion and later damage shards.
    b.triangle("Skirt.L", (-2, 4, 17), (-14, 8, 0), (-3, 15, 5), 1.2, "echo_void")
    b.triangle("Skirt.R", (2, 4, 17), (14, 8, 0), (3, 15, 5), 1.2, "echo_mirror")


def build_broken_bell_apprentice(b):
    """A failed young Bellward suspended inside the binding that killed them."""
    b.bone("Frame", (0, 5, 30))
    b.bone("Yoke.L", (-15, 3, 38), "Frame")
    b.bone("Yoke.R", (15, 3, 38), "Frame")
    b.bone("BellShell.L", (-10, 0, 25), "Frame")
    b.bone("BellShell.R", (10, 0, 25), "Frame")
    b.bone("Body", (0, -5, 25), "Frame")
    b.bone("Head", (-2, -7, 38), "Body")
    b.bone("Jaw", (-2, -12, 34), "Head")
    b.bone("Arm.L", (-8, -5, 28), "Body")
    b.bone("Arm.R", (8, -4, 28), "Body")
    b.bone("BellFist", (19, -11, 19), "Arm.R")
    b.bone("ShardHalo", (0, 4, 43), "Frame")
    b.bone("Emitter", (0, -10, 24), "Body")
    b.bone("Leg.L", (-4, -2, 16), "Body")
    b.bone("Leg.R", (4, 0, 15), "Body")
    b.bone("Chain.L", (-10, 5, 30), "Frame")
    b.bone("Chain.R", (10, 5, 30), "Frame")

    # Huge broken bell frame creates the primary silhouette before the corpse.
    b.line("Frame", (-19, 7, 3), (-17, 5, 45), 3.0, "apprentice_bell", 2.0)
    b.line("Frame", (19, 7, 3), (17, 5, 45), 3.0, "apprentice_bell", 2.0)
    b.line("Frame", (-17, 5, 45), (17, 5, 45), 3.2, "apprentice_bell_edge")
    b.line("Yoke.L", (-14, 4, 42), (-25, 2, 52), 2.5, "apprentice_bell", 0.8)
    b.line("Yoke.R", (14, 4, 42), (23, 6, 49), 2.5, "apprentice_bell_edge", 0.8)
    b.ring_xz(
        "BellShell.L",
        (0, 1, 25),
        19,
        23,
        2.0,
        "apprentice_bell",
        (math.pi * 0.55, math.pi * 1.45),
    )
    b.ring_xz(
        "BellShell.R",
        (0, 1, 25),
        19,
        23,
        2.0,
        "apprentice_bell_edge",
        (-math.pi * 0.45, math.pi * 0.45),
    )
    b.box("BellShell.L", (-13, 0, 6), (12, 7, 4), "apprentice_verdigris")
    b.box("BellShell.R", (12, 0, 7), (10, 7, 4), "apprentice_bell")

    # Young corpse hangs unnaturally within the bell rather than standing normally.
    b.ellipsoid("Body", (0, -5, 26), (7, 5, 12), "apprentice_cloth")
    b.triangle(
        "Body", (-7, -2, 29), (7, -2, 29), (-2, 3, 9), 1.3, "apprentice_cloth_torn"
    )
    b.box("Body", (0, -10, 27), (10, 2, 3), "apprentice_verdigris")
    b.ellipsoid("Head", (-2, -7, 39), (5, 4, 6), "apprentice_bone")
    b.box("Head", (-2, -11, 39), (7, 2, 5), "apprentice_cloth_torn")
    b.triangle(
        "Head", (-8, -5, 42), (4, -5, 45), (-4, 0, 50), 1.5, "apprentice_cloth_torn"
    )
    b.line("Head", (-7, -9, 42), (-2, -12, 36), 0.9, "apprentice_verdigris")
    b.ellipsoid("Head", (-4, -12, 40), (0.9, 0.7, 1.0), "apprentice_voice_hot")
    b.box("Head", (1, -12, 40), (2.8, 1.0, 1.2), "apprentice_cloth_torn")
    b.box("Jaw", (-1, -12, 34), (6, 3, 2), "apprentice_bone")
    # One arm is a conductor's reach, the other terminates in the broken bell.
    b.line("Arm.L", (-6, -5, 30), (-17, -14, 18), 2.3, "apprentice_cloth", 1.1)
    for spread in (-2, 0, 2):
        b.cone(
            "Arm.L",
            (-17, -14, 18),
            (-21 + spread, -19, 14 + spread),
            0.7,
            "apprentice_bone",
        )
    b.line("Arm.R", (6, -4, 30), (16, -9, 22), 3.0, "apprentice_verdigris", 2.0)
    b.ellipsoid("BellFist", (20, -12, 19), (8, 7, 8), "apprentice_bell")
    b.ring_xz("BellFist", (20, -17, 18), 7, 7, 1.2, "apprentice_bell_edge")
    b.ellipsoid("BellFist", (20, -19, 18), (2.2, 1.4, 2.2), "apprentice_voice")
    # Legs are lifted by chains and do not form a standard humanoid stance.
    b.line("Leg.L", (-3, -2, 18), (-10, 6, 5), 2.4, "apprentice_cloth_torn", 1.2)
    b.line("Leg.R", (3, 0, 17), (11, 9, 8), 2.4, "apprentice_cloth", 1.2)
    b.box("Leg.L", (-11, 4, 4), (5, 8, 3), "apprentice_bell")
    b.box("Leg.R", (12, 7, 7), (5, 8, 3), "apprentice_bell")
    # Binding chains and orbiting shards support secondary motion and break phases.
    for bone, side in (("Chain.L", -1), ("Chain.R", 1)):
        for index in range(8):
            b.ring_xz(
                bone,
                (side * (11 + index * 0.7), 4, 39 - index * 4),
                1.3,
                1.7,
                0.4,
                "apprentice_bell",
            )
    for angle in range(0, 360, 45):
        r = math.radians(angle)
        center = (math.cos(r) * 17, 5 + math.sin(r) * 4, 44 + math.sin(r) * 10)
        b.cone(
            "ShardHalo",
            center,
            (center[0] * 1.18, center[1] - 2, center[2] + 4),
            1.2,
            "apprentice_voice",
        )
    b.ellipsoid("Emitter", (0, -11, 25), (3.0, 1.4, 4.5), "apprentice_voice")
    b.ellipsoid("Emitter", (0, -12, 25), (1.3, 0.8, 2.0), "apprentice_voice_hot")
    for side in (-1, 1):
        b.line(
            "Body",
            (side * 2, -12, 29),
            (side * 5, -11, 22),
            0.65,
            "apprentice_voice",
            0.35,
        )


DEFINITIONS = (
    core.BossDefinition(
        "vyrahel_vein_keeper",
        "Vyrahel, the Vein-Keeper",
        (3.8, 2.6, 6.4),
        "vein_wyrmling_scratch",
        "Idle",
        24,
        (
            "VeinProwl",
            "CrystalGuard",
            "VeinBreath",
            "BurrowRush",
            "TailFeint",
            "WingBurst",
            "MercyWindow",
            "Yield",
            "VeinFade",
        ),
        build_amber_vein_wyrmling,
    ),
    core.BossDefinition(
        "alpha_mucker",
        "Alpha Mucker",
        (12.0, 14.0, 11.0),
        "muck_tree_scratch",
        "Idle",
        24,
        (
            "RootMarch",
            "BranchSlam",
            "RoadUproot",
            "SeedBarrage",
            "RootCage",
            "MuckheartPulse",
            "CanopyRage",
            "HeartExposed",
            "Timberfall",
        ),
        build_muckheart_walking_tree,
    ),
    core.BossDefinition(
        "echo_singer",
        "The Echo-Singer",
        (6.2, 5.6, 5.8),
        "echo_predator_scratch",
        "Idle",
        24,
        (
            "Listen",
            "CopyMelee",
            "CopyRanged",
            "CopyGuard",
            "EchoDelay",
            "EssenceDive",
            "MirrorStep",
            "ResonanceOverload",
            "Silence",
        ),
        build_reflection_predator,
    ),
    core.BossDefinition(
        "failed_apprentice",
        "The Failed Apprentice",
        (4.8, 5.6, 3.8),
        "failed_bellward_scratch",
        "Idle",
        24,
        (
            "ChainLurch",
            "BellFist",
            "ShardCast",
            "FailedWard",
            "WrongNote",
            "BellCrack",
            "BindingTear",
            "LastLesson",
            "BellCollapse",
        ),
        build_broken_bell_apprentice,
    ),
)

core.ASPECT_PRESERVED_ARCHETYPES = core.ASPECT_PRESERVED_ARCHETYPES | {
    definition.archetype for definition in DEFINITIONS
}

core.SPECIAL_BASES.update(
    {
        "VeinProwl": "Walk",
        "CrystalGuard": "Stunned",
        "VeinBreath": "RangedAttack",
        "BurrowRush": "Sprint",
        "TailFeint": "HeavyAttack",
        "WingBurst": "Jump",
        "MercyWindow": "PhaseTransition",
        "Yield": "Stunned",
        "VeinFade": "Death",
        "RootMarch": "Walk",
        "BranchSlam": "HeavyAttack",
        "RoadUproot": "AreaAttack",
        "SeedBarrage": "RangedAttack",
        "RootCage": "Summon",
        "MuckheartPulse": "AreaAttack",
        "CanopyRage": "Enrage",
        "HeartExposed": "PhaseTransition",
        "Timberfall": "Death",
        "Listen": "Idle",
        "CopyMelee": "HeavyAttack",
        "CopyRanged": "RangedAttack",
        "CopyGuard": "Stunned",
        "EchoDelay": "Summon",
        "EssenceDive": "Jump",
        "MirrorStep": "PhaseTransition",
        "ResonanceOverload": "Enrage",
        "Silence": "Death",
        "ChainLurch": "Walk",
        "BellFist": "HeavyAttack",
        "ShardCast": "RangedAttack",
        "FailedWard": "AreaAttack",
        "WrongNote": "HitReact",
        "BellCrack": "PhaseTransition",
        "BindingTear": "Enrage",
        "LastLesson": "Summon",
        "BellCollapse": "Death",
    }
)


def _first(armature, *names):
    return core.first_bone(armature, names)


def _pose(frames, frame, bone, **kwargs):
    core.pose_entry(frames, frame, bone, **kwargs)


def vein_wyrmling_pose(name, armature):
    aliases = {
        "VeinProwl": "Walk",
        "CrystalGuard": "Stunned",
        "VeinBreath": "RangedAttack",
        "BurrowRush": "Sprint",
        "TailFeint": "HeavyAttack",
        "WingBurst": "Jump",
        "MercyWindow": "PhaseTransition",
        "Yield": "Yield",
        "VeinFade": "Death",
    }
    action = aliases.get(name, name)
    f = {}
    root, body, chest, neck, head, jaw = (
        _first(armature, n) for n in ("Root", "Body", "Chest", "Neck", "Head", "Jaw")
    )
    emitter = _first(armature, "Emitter")
    vein_jet = _first(armature, "VeinJet")
    shields = [_first(armature, "VeinShield.L"), _first(armature, "VeinShield.R")]
    wings = [
        _first(armature, n) for n in ("Wing.L", "WingTip.L", "Wing.R", "WingTip.R")
    ]
    tails = [_first(armature, f"Tail.{i}") for i in range(1, 5)]
    legs = {s: _first(armature, f"Leg.{s}") for s in ("FL", "FR", "BL", "BR")}
    shins = {s: _first(armature, f"Shin.{s}") for s in legs}
    claws = {s: _first(armature, f"Claw.{s}") for s in legs}

    def tail(frame, amount):
        for i, bone in enumerate(tails):
            _pose(
                f,
                frame,
                bone,
                rotation=(0, amount * (0.08 + i * 0.02), amount * (0.16 + i * 0.04)),
            )

    def gait(end, stride, lift):
        for i, frame in enumerate(
            (1, end // 4 + 1, end // 2 + 1, end * 3 // 4 + 1, end)
        ):
            phase = (0, 1, 0, -1, 0)[i]
            _pose(f, frame, root, location=(0, 0, lift if phase else 0))
            _pose(f, frame, body, rotation=(3 + abs(phase) * 2, 0, phase * 3))
            for suffix, diagonal in (("FL", 1), ("BR", 1), ("FR", -1), ("BL", -1)):
                swing = stride * phase * diagonal
                _pose(f, frame, legs[suffix], rotation=(swing, 0, 0))
                _pose(f, frame, shins[suffix], rotation=(-swing * 0.72, 0, 0))
                _pose(f, frame, claws[suffix], rotation=(swing * 0.2, 0, 0))
            _pose(f, frame, neck, rotation=(-4, phase * 4, -phase * 2))
            _pose(f, frame, head, rotation=(2, phase * 5, phase * 2))
            tail(frame, -phase * 9)
        return end, f

    if action == "Idle":
        for frame, breath, scan in ((1, 1, -3), (24, 1.045, 4), (48, 1, -3)):
            _pose(
                f,
                frame,
                body,
                scale=(1, 1, breath),
                location=(0, 0, 0.02 if frame == 24 else 0),
            )
            _pose(f, frame, neck, rotation=(-5, scan * 0.6, 0))
            _pose(f, frame, head, rotation=(2, scan, scan * 0.25))
            _pose(f, frame, jaw, rotation=(3 if frame == 24 else 0, 0, 0))
            _pose(f, frame, emitter, scale=((1.18 if frame == 24 else 1),) * 3)
            tail(frame, scan * 1.4)
        return 48, f
    if action == "Walk":
        return gait(28, 24, 0.035)
    if action == "Run":
        return gait(18, 38, 0.07)
    if action == "Sprint":
        return gait(14, 52, 0.09)
    if action in ("Jump", "Fly"):
        end = 42 if action == "Jump" else 30
        for frame, height, fold, spread in (
            (1, 0, 0, 10),
            (10, -0.08, 22, -25),
            (20, 0.48, -20, 78),
            (30, 0.24, -8, 38),
            (end, 0, 0, 10),
        ):
            _pose(f, frame, root, location=(0, 0, height))
            _pose(f, frame, body, rotation=(fold * 0.2, 0, 0))
            for i, wing in enumerate(wings):
                side = -1 if i < 2 else 1
                _pose(
                    f,
                    frame,
                    wing,
                    rotation=(0, side * spread * (1 if i % 2 == 0 else 0.7), 0),
                )
            for suffix in legs:
                _pose(f, frame, legs[suffix], rotation=(fold, 0, 0))
            tail(frame, -fold * 0.4)
        return end, f
    if action in ("Attack", "HeavyAttack"):
        heavy = action == "HeavyAttack"
        for frame, lunge, bite, sweep in (
            (1, 0, 0, 0),
            (9, 0.04, -15, -30 if heavy else 0),
            (18, -0.2, 38, 72 if heavy else 8),
            (28, -0.06, 14, 24 if heavy else 0),
            (40, 0, 0, 0),
        ):
            _pose(f, frame, root, location=(0, lunge, 0))
            _pose(f, frame, neck, rotation=(bite * 0.28, sweep * 0.08, 0))
            _pose(f, frame, head, rotation=(bite * 0.35, sweep * 0.12, 0))
            _pose(f, frame, jaw, rotation=(max(0, bite), 0, 0))
            tail(frame, sweep)
        return 40, f
    if action == "RangedAttack":
        for frame, charge, recoil, guard, jet in (
            (1, 1, 0, 0, 0.02),
            (12, 1.4, -8, 12, 0.15),
            (24, 2.25, -20, 28, 5.0),
            (32, 0.55, 24, 35, 7.5),
            (48, 1, 0, 0, 0.02),
        ):
            _pose(f, frame, emitter, scale=(charge,) * 3)
            _pose(
                f,
                frame,
                vein_jet,
                scale=(0.7 if jet > 1 else jet, 0.7 if jet > 1 else jet, jet),
            )
            _pose(f, frame, neck, rotation=(recoil * 0.3, 0, 0))
            _pose(f, frame, head, rotation=(recoil * 0.34, 0, 0))
            _pose(f, frame, jaw, rotation=(32 if frame in (24, 32) else 0, 0, 0))
            for i, shield in enumerate(shields):
                _pose(f, frame, shield, rotation=(0, (-1 if i == 0 else 1) * guard, 0))
        return 48, f
    if action == "AreaAttack":
        for frame, spread, pulse in (
            (1, 0, 1),
            (14, 50, 1.3),
            (26, 92, 1.9),
            (40, 18, 1.2),
            (52, 0, 1),
        ):
            for i, shield in enumerate(shields):
                _pose(f, frame, shield, rotation=(0, (-1 if i == 0 else 1) * spread, 0))
            for i, wing in enumerate(wings):
                _pose(
                    f, frame, wing, rotation=(0, (-1 if i < 2 else 1) * spread * 0.7, 0)
                )
            _pose(f, frame, emitter, scale=(pulse,) * 3)
        return 52, f
    if action in ("HitReact", "Stunned"):
        for frame, recoil in ((1, 0), (9, -18), (22, 12), (42, 0)):
            _pose(f, frame, body, rotation=(recoil, 0, recoil * 0.3))
            _pose(f, frame, neck, rotation=(-recoil * 0.7, 0, -recoil * 0.4))
            _pose(f, frame, head, rotation=(-recoil, 0, -recoil * 0.5))
        return 42, f
    if action == "Yield":
        for frame, lower, shield_fold in (
            (1, 0, 0),
            (18, 18, 25),
            (38, 38, 62),
            (64, 48, 78),
        ):
            _pose(f, frame, root, location=(0, 0, -lower * 0.006))
            _pose(f, frame, body, rotation=(lower * 0.15, 0, 0))
            _pose(f, frame, neck, rotation=(lower * 0.55, 0, 0))
            _pose(f, frame, head, rotation=(lower * 0.72, 0, 0))
            for i, shield in enumerate(shields):
                _pose(
                    f,
                    frame,
                    shield,
                    rotation=(0, (-1 if i == 0 else 1) * shield_fold, 0),
                )
        return 64, f
    if action in ("Roar", "PhaseTransition", "Summon", "Enrage"):
        for frame, rise, pulse in (
            (1, 0, 1),
            (14, -18, 1.35),
            (28, -35, 1.9),
            (44, -12, 1.25),
            (58, 0, 1),
        ):
            _pose(f, frame, neck, rotation=(rise * 0.45, 0, 0))
            _pose(f, frame, head, rotation=(rise * 0.35, 0, 0))
            _pose(f, frame, jaw, rotation=(-rise, 0, 0))
            _pose(f, frame, emitter, scale=(pulse,) * 3)
        return 58, f
    if action == "WipeReset":
        for frame, z, scale in (
            (1, 0, 1),
            (16, -0.12, 0.82),
            (34, 0.12, 1.12),
            (54, 0, 1),
        ):
            _pose(f, frame, root, location=(0, 0, z), scale=(scale,) * 3)
        return 54, f
    if action == "Death":
        for frame, fall, fade in (
            (1, 0, 1),
            (16, 18, 1.2),
            (34, 62, 0.8),
            (58, 86, 0.18),
            (78, 86, 0.05),
        ):
            _pose(
                f,
                frame,
                root,
                rotation=(fall, 0, fall * 0.18),
                location=(0, 0, -fall * 0.003),
            )
            _pose(f, frame, emitter, scale=(fade,) * 3)
            for shield in shields:
                _pose(f, frame, shield, scale=(fade,) * 3)
        return 78, f
    return vein_wyrmling_pose("Idle", armature)


def muck_tree_pose(name, armature):
    aliases = {
        "RootMarch": "Walk",
        "BranchSlam": "HeavyAttack",
        "RoadUproot": "AreaAttack",
        "SeedBarrage": "RangedAttack",
        "RootCage": "Summon",
        "MuckheartPulse": "Roar",
        "CanopyRage": "Enrage",
        "HeartExposed": "PhaseTransition",
        "Timberfall": "Death",
    }
    action = aliases.get(name, name)
    f = {}
    root = _first(armature, "Root")
    trunk = _first(armature, "Trunk")
    heart = _first(armature, "Heart")
    face = _first(armature, "Face")
    jaw = _first(armature, "JawRoot")
    branches = [_first(armature, "Branch.L"), _first(armature, "Branch.R")]
    claws = [_first(armature, "Claw.L"), _first(armature, "Claw.R")]
    legs = [_first(armature, "RootLeg.L"), _first(armature, "RootLeg.R")]
    feet = [_first(armature, "RootFoot.L"), _first(armature, "RootFoot.R")]
    crown = _first(armature, "Crown")
    canopies = [_first(armature, "Canopy.L"), _first(armature, "Canopy.R")]
    seeds = [_first(armature, "SeedVolley.L"), _first(armature, "SeedVolley.R")]
    taproot = _first(armature, "Taproot")
    cages = [
        _first(armature, "Cage.L"),
        _first(armature, "Cage.R"),
        _first(armature, "Cage.Back"),
    ]
    if action == "Idle":
        for frame, sway, pulse in ((1, -2, 1), (30, 3, 1.12), (60, -2, 1)):
            _pose(f, frame, trunk, rotation=(0, 0, sway))
            _pose(f, frame, heart, scale=(pulse,) * 3)
            _pose(f, frame, face, rotation=(0, sway, 0))
            _pose(f, frame, jaw, rotation=(sway * 0.5, 0, 0))
            for i, b in enumerate(canopies):
                _pose(f, frame, b, rotation=(0, 0, (-1 if i == 0 else 1) * sway * 1.8))
        return 60, f
    if action in ("Walk", "Run", "Sprint"):
        end, stride, lift = (
            (40, 16, 0.025)
            if action == "Walk"
            else ((28, 25, 0.045) if action == "Run" else (22, 32, 0.065))
        )
        for i, frame in enumerate(
            (1, end // 4 + 1, end // 2 + 1, end * 3 // 4 + 1, end)
        ):
            phase = (0, 1, 0, -1, 0)[i]
            _pose(f, frame, root, location=(0, 0, lift if phase else 0))
            _pose(f, frame, trunk, rotation=(2 + abs(phase) * 2, 0, phase * 2))
            for j, leg in enumerate(legs):
                _pose(
                    f,
                    frame,
                    leg,
                    rotation=(stride * phase * (1 if j == 0 else -1), 0, 0),
                )
                _pose(
                    f,
                    frame,
                    feet[j],
                    rotation=(-stride * phase * (1 if j == 0 else -1) * 0.4, 0, 0),
                )
            for j, b in enumerate(branches):
                _pose(
                    f,
                    frame,
                    b,
                    rotation=(
                        -stride * phase * (1 if j == 0 else -1) * 0.25,
                        0,
                        phase * (2 if j == 0 else -2),
                    ),
                )
            _pose(f, frame, taproot, rotation=(0, 0, -phase * 6))
        return end, f
    if action in ("Attack", "HeavyAttack"):
        heavy = action == "HeavyAttack"
        end = 54 if heavy else 38
        for frame, wind, slam in (
            (1, 0, 0),
            (14, -55, 0),
            (28, 85, 1),
            (40, 28, 0),
            (end, 0, 0),
        ):
            for j, b in enumerate(branches):
                _pose(
                    f,
                    frame,
                    b,
                    rotation=(
                        wind * (1 if heavy or j == 1 else 0.45),
                        0,
                        (-1 if j == 0 else 1) * abs(wind) * 0.25,
                    ),
                )
            for j, b in enumerate(claws):
                _pose(
                    f,
                    frame,
                    b,
                    rotation=(wind * 0.4, 0, (-1 if j == 0 else 1) * wind * 0.3),
                )
            _pose(f, frame, trunk, rotation=(-wind * 0.12, 0, wind * 0.04))
            _pose(
                f, frame, root, location=(0, -0.12 if slam else 0, -0.08 if slam else 0)
            )
        return end, f
    if action == "RangedAttack":
        for frame, charge, kick in (
            (1, 1, 0),
            (14, 1.3, -18),
            (26, 1.75, 32),
            (38, 0.45, -24),
            (52, 1, 0),
        ):
            for j, b in enumerate(seeds):
                _pose(
                    f,
                    frame,
                    b,
                    scale=(charge,) * 3,
                    rotation=(kick, (-1 if j == 0 else 1) * kick, 0),
                )
            _pose(f, frame, trunk, rotation=(kick * 0.08, 0, 0))
            _pose(f, frame, heart, scale=(1 + abs(kick) / 100,) * 3)
        return 52, f
    if action == "AreaAttack":
        for frame, lift, spread in (
            (1, 0, 0),
            (16, 0.08, -30),
            (32, -0.12, 75),
            (48, -0.04, 24),
            (62, 0, 0),
        ):
            _pose(f, frame, root, location=(0, 0, lift))
            _pose(f, frame, trunk, rotation=(-spread * 0.16, 0, 0))
            for j, leg in enumerate(legs):
                _pose(
                    f,
                    frame,
                    leg,
                    rotation=(spread, 0, (-1 if j == 0 else 1) * spread * 0.2),
                )
                _pose(f, frame, feet[j], rotation=(-spread * 0.5, 0, 0))
            _pose(f, frame, taproot, scale=(1 + abs(spread) / 90,) * 3)
        return 62, f
    if action in ("HitReact", "Stunned"):
        for frame, recoil in ((1, 0), (10, -12), (24, 8), (44, 0)):
            _pose(f, frame, trunk, rotation=(recoil, 0, recoil * 0.45))
            _pose(f, frame, face, rotation=(-recoil, 0, -recoil * 0.5))
            _pose(f, frame, heart, scale=(1 + abs(recoil) / 40,) * 3)
        return 44, f
    if action == "Summon":
        for frame, rise, close in (
            (1, 0.02, 0),
            (14, 0.25, 12),
            (30, 1.0, 48),
            (46, 1.15, 72),
            (66, 0.02, 0),
        ):
            for j, cage in enumerate(cages):
                side = -1 if j == 0 else 1 if j == 1 else 0
                _pose(
                    f,
                    frame,
                    cage,
                    scale=(rise,) * 3,
                    rotation=(-close * 0.35, side * close * 0.25, -side * close * 0.2),
                )
            _pose(f, frame, trunk, rotation=(-close * 0.08, 0, 0))
            _pose(f, frame, heart, scale=(1 + close / 150,) * 3)
        return 66, f
    if action in ("Roar", "PhaseTransition", "Enrage"):
        for frame, open_amount, pulse in (
            (1, 0, 1),
            (16, 24, 1.3),
            (32, 55, 1.9),
            (50, 18, 1.3),
            (66, 0, 1),
        ):
            _pose(f, frame, jaw, rotation=(open_amount, 0, 0))
            _pose(f, frame, heart, scale=(pulse,) * 3)
            _pose(f, frame, trunk, rotation=(-open_amount * 0.1, 0, 0))
            for j, b in enumerate(canopies):
                _pose(
                    f,
                    frame,
                    b,
                    rotation=(
                        0,
                        (-1 if j == 0 else 1) * open_amount * 0.25,
                        (-1 if j == 0 else 1) * open_amount * 0.35,
                    ),
                )
            for j, b in enumerate(branches):
                _pose(
                    f,
                    frame,
                    b,
                    rotation=(
                        -open_amount * 0.35,
                        0,
                        (-1 if j == 0 else 1) * open_amount * 0.45,
                    ),
                )
        return 66, f
    if action in ("Jump", "Fly"):
        for frame, z, tuck in ((1, 0, 0), (12, -0.06, 14), (26, 0.24, -18), (42, 0, 0)):
            _pose(f, frame, root, location=(0, 0, z))
            _pose(f, frame, trunk, rotation=(tuck * 0.2, 0, 0))
            for leg in legs:
                _pose(f, frame, leg, rotation=(tuck, 0, 0))
        return 42, f
    if action == "WipeReset":
        for frame, z, scale in (
            (1, 0, 1),
            (18, -0.18, 0.85),
            (38, 0.1, 1.08),
            (58, 0, 1),
        ):
            _pose(f, frame, root, location=(0, 0, z), scale=(scale,) * 3)
        return 58, f
    if action == "Death":
        for frame, fall, heart_scale in (
            (1, 0, 1),
            (18, 12, 1.4),
            (38, 48, 2.2),
            (66, 82, 0.5),
            (96, 90, 0.08),
        ):
            _pose(
                f,
                frame,
                root,
                rotation=(fall, 0, -fall * 0.14),
                location=(0, 0, -fall * 0.004),
            )
            _pose(f, frame, trunk, rotation=(fall * 0.18, 0, 0))
            _pose(f, frame, heart, scale=(heart_scale,) * 3)
            for j, b in enumerate(canopies):
                _pose(
                    f,
                    frame,
                    b,
                    rotation=(0, 0, (-1 if j == 0 else 1) * fall * 0.7),
                    scale=((1 if frame < 66 else 0.25),) * 3,
                )
        return 96, f
    return muck_tree_pose("Idle", armature)


def echo_predator_pose(name, armature):
    aliases = {
        "Listen": "Idle",
        "CopyMelee": "HeavyAttack",
        "CopyRanged": "RangedAttack",
        "CopyGuard": "Stunned",
        "EchoDelay": "Summon",
        "EssenceDive": "Jump",
        "MirrorStep": "PhaseTransition",
        "ResonanceOverload": "Enrage",
        "Silence": "Death",
    }
    action = aliases.get(name, name)
    f = {}
    root = _first(armature, "Root")
    core_b = _first(armature, "Core")
    body = _first(armature, "BellBody")
    masks = [_first(armature, n) for n in ("Mask.Front", "Mask.Left", "Mask.Right")]
    blades = [_first(armature, "Blade.L"), _first(armature, "Blade.R")]
    guard = _first(armature, "Guard")
    emitter = _first(armature, "Emitter")
    echoes = [_first(armature, "Echo.A"), _first(armature, "Echo.B")]
    ring = _first(armature, "TimeRing")
    skirts = [_first(armature, "Skirt.L"), _first(armature, "Skirt.R")]
    if action == "Idle":
        for frame, z, spin, pulse in (
            (1, 0, -3, 1),
            (24, 0.04, 4, 1.15),
            (48, 0, -3, 1),
        ):
            _pose(f, frame, root, location=(0, 0, z))
            _pose(f, frame, body, rotation=(0, spin, spin * 0.4))
            _pose(f, frame, core_b, scale=(pulse,) * 3)
            _pose(f, frame, ring, rotation=(0, spin * 2, spin))
            for i, m in enumerate(masks):
                _pose(f, frame, m, rotation=(0, spin * (i - 1), (-1 + i) * spin * 0.4))
        return 48, f
    if action in ("Walk", "Run", "Sprint", "Fly"):
        end, amount = (
            (28, 8) if action == "Walk" else ((18, 14) if action == "Run" else (14, 22))
        )
        end = 24 if action == "Fly" else end
        for i, frame in enumerate((1, end // 2, end)):
            d = 1 if i != 1 else -1
            _pose(
                f,
                frame,
                root,
                location=(0, 0, 0.05 if i == 1 else 0),
                rotation=(0, d * amount, 0),
            )
            _pose(f, frame, ring, rotation=(0, d * amount * 3, d * amount))
            for j, e in enumerate(echoes):
                _pose(
                    f,
                    frame,
                    e,
                    location=(((-1 if j == 0 else 1) * 0.08 * d), 0, 0),
                    rotation=(0, 0, (-1 if j == 0 else 1) * amount),
                )
        return end, f
    if action in ("Attack", "HeavyAttack"):
        heavy = action == "HeavyAttack"
        end = 44 if heavy else 30
        for frame, wind in ((1, 0), (10, -48), (20, 96), (32, 24), (end, 0)):
            for j, b in enumerate(blades):
                _pose(
                    f,
                    frame,
                    b,
                    rotation=(
                        wind * (1 if heavy or j == 1 else 0.35),
                        0,
                        (-1 if j == 0 else 1) * wind * 0.4,
                    ),
                )
            _pose(f, frame, body, rotation=(wind * 0.08, 0, wind * 0.05))
            _pose(f, frame, ring, rotation=(0, wind * 1.5, 0))
        return end, f
    if action == "RangedAttack":
        for frame, charge, recoil in (
            (1, 1, 0),
            (12, 1.4, -12),
            (24, 2.3, -24),
            (32, 0.4, 28),
            (46, 1, 0),
        ):
            _pose(f, frame, emitter, scale=(charge,) * 3)
            _pose(f, frame, body, rotation=(recoil * 0.15, 0, 0))
            _pose(f, frame, ring, scale=(1 + abs(recoil) / 30,) * 3)
        return 46, f
    if action == "AreaAttack":
        for frame, spread, pulse in (
            (1, 0, 1),
            (14, 45, 1.25),
            (28, 95, 2.0),
            (44, 20, 1.3),
            (58, 0, 1),
        ):
            _pose(f, frame, ring, scale=(pulse,) * 3, rotation=(0, spread * 2, spread))
            _pose(f, frame, guard, rotation=(0, spread, 0))
            for j, e in enumerate(echoes):
                _pose(
                    f,
                    frame,
                    e,
                    location=(
                        ((-1 if j == 0 else 1) * spread * 0.004),
                        0,
                        spread * 0.002,
                    ),
                    scale=(pulse,) * 3,
                )
        return 58, f
    if action in ("HitReact", "Stunned"):
        for frame, split in ((1, 0), (10, 25), (24, 48), (42, 0)):
            _pose(f, frame, body, scale=(1 - split * 0.006, 1, 1 + split * 0.005))
            for j, m in enumerate(masks):
                _pose(
                    f,
                    frame,
                    m,
                    location=((j - 1) * split * 0.003, 0, 0),
                    rotation=(0, (j - 1) * split, 0),
                )
            _pose(f, frame, guard, scale=(1 + split / 60,) * 3)
        return 42, f
    if action in ("Roar", "PhaseTransition", "Summon", "Enrage"):
        for frame, spin, pulse in (
            (1, 0, 1),
            (12, -30, 1.25),
            (26, 75, 1.9),
            (42, -20, 1.3),
            (56, 0, 1),
        ):
            _pose(f, frame, body, rotation=(0, spin, spin * 0.4), scale=(pulse,) * 3)
            _pose(f, frame, ring, rotation=(spin, spin * 2, spin), scale=(pulse,) * 3)
            for j, e in enumerate(echoes):
                _pose(
                    f,
                    frame,
                    e,
                    rotation=(0, 0, (-1 if j == 0 else 1) * spin),
                    scale=(pulse,) * 3,
                )
        return 56, f
    if action in ("Jump", "Fly"):
        for frame, z, squash in (
            (1, 0, 1),
            (10, -0.08, 0.8),
            (22, 0.4, 1.2),
            (36, 0, 1),
        ):
            _pose(f, frame, root, location=(0, 0, z))
            _pose(
                f,
                frame,
                body,
                scale=(1.1 if squash < 1 else 0.9, 1.1 if squash < 1 else 0.9, squash),
            )
        return 36, f
    if action == "WipeReset":
        for frame, scale in ((1, 1), (14, 0.1), (28, 1.3), (44, 1)):
            _pose(f, frame, root, scale=(scale,) * 3)
        return 44, f
    if action == "Death":
        for frame, collapse, fade in (
            (1, 0, 1),
            (14, 25, 1.3),
            (34, 70, 0.8),
            (58, 120, 0.15),
            (78, 160, 0.03),
        ):
            _pose(
                f,
                frame,
                body,
                scale=(max(0.05, fade), max(0.05, fade), 1 + collapse / 90),
                rotation=(collapse, collapse * 0.5, collapse),
            )
            _pose(f, frame, ring, scale=(1 + collapse / 40,) * 3)
            for m in masks:
                _pose(f, frame, m, scale=(fade,) * 3)
        return 78, f
    return echo_predator_pose("Idle", armature)


def failed_bellward_pose(name, armature):
    aliases = {
        "ChainLurch": "Walk",
        "BellFist": "HeavyAttack",
        "ShardCast": "RangedAttack",
        "FailedWard": "AreaAttack",
        "WrongNote": "HitReact",
        "BellCrack": "PhaseTransition",
        "BindingTear": "Enrage",
        "LastLesson": "Summon",
        "BellCollapse": "Death",
    }
    action = aliases.get(name, name)
    f = {}
    root = _first(armature, "Root")
    frame_b = _first(armature, "Frame")
    body = _first(armature, "Body")
    head = _first(armature, "Head")
    jaw = _first(armature, "Jaw")
    arms = [_first(armature, "Arm.L"), _first(armature, "Arm.R")]
    bell = _first(armature, "BellFist")
    shells = [_first(armature, "BellShell.L"), _first(armature, "BellShell.R")]
    yokes = [_first(armature, "Yoke.L"), _first(armature, "Yoke.R")]
    halo = _first(armature, "ShardHalo")
    emitter = _first(armature, "Emitter")
    legs = [_first(armature, "Leg.L"), _first(armature, "Leg.R")]
    chains = [_first(armature, "Chain.L"), _first(armature, "Chain.R")]
    if action == "Idle":
        for frame, sway, pulse in ((1, -3, 1), (28, 4, 1.15), (56, -3, 1)):
            _pose(f, frame, frame_b, rotation=(0, 0, sway))
            _pose(f, frame, body, rotation=(4, 0, -sway * 0.5))
            _pose(f, frame, head, rotation=(8, sway, -sway))
            _pose(f, frame, halo, rotation=(0, sway * 3, sway * 2))
            _pose(f, frame, emitter, scale=(pulse,) * 3)
            for j, c in enumerate(chains):
                _pose(f, frame, c, rotation=(0, 0, (-1 if j == 0 else 1) * sway * 1.6))
        return 56, f
    if action in ("Walk", "Run", "Sprint", "Fly"):
        end, amount = (
            (34, 14)
            if action == "Walk"
            else ((24, 24) if action == "Run" else (18, 34))
        )
        end = 26 if action == "Fly" else end
        for i, frame in enumerate(
            (1, end // 4 + 1, end // 2 + 1, end * 3 // 4 + 1, end)
        ):
            phase = (0, 1, 0, -1, 0)[i]
            _pose(f, frame, root, location=(0, 0, 0.04 if phase else 0))
            _pose(f, frame, frame_b, rotation=(3, 0, phase * 4))
            _pose(f, frame, body, rotation=(10, 0, -phase * 7))
            for j, l in enumerate(legs):
                _pose(
                    f, frame, l, rotation=(amount * phase * (1 if j == 0 else -1), 0, 0)
                )
            _pose(f, frame, bell, rotation=(0, phase * amount, phase * amount * 0.7))
            _pose(f, frame, halo, rotation=(0, phase * amount * 2, 0))
        return end, f
    if action in ("Attack", "HeavyAttack"):
        heavy = action == "HeavyAttack"
        end = 50 if heavy else 34
        for frame, wind in ((1, 0), (12, -60), (24, 105), (36, 28), (end, 0)):
            _pose(f, frame, arms[1], rotation=(wind, 0, wind * 0.35))
            _pose(f, frame, bell, rotation=(wind * 0.55, 0, wind * 0.7))
            _pose(f, frame, frame_b, rotation=(wind * 0.08, 0, -wind * 0.04))
            _pose(f, frame, body, rotation=(wind * 0.14, 0, wind * 0.08))
            if heavy:
                _pose(f, frame, shells[1], rotation=(0, wind * 0.25, wind * 0.18))
        return end, f
    if action == "RangedAttack":
        for frame, spin, charge in (
            (1, 0, 1),
            (12, -35, 1.25),
            (24, 90, 1.8),
            (34, 160, 0.55),
            (50, 0, 1),
        ):
            _pose(
                f, frame, halo, rotation=(spin, spin * 1.5, spin), scale=(charge,) * 3
            )
            _pose(f, frame, emitter, scale=(charge,) * 3)
            _pose(f, frame, head, rotation=(-spin * 0.08, 0, 0))
        return 50, f
    if action == "AreaAttack":
        for frame, open_amount, pulse in (
            (1, 0, 1),
            (14, 25, 1.25),
            (28, 70, 2),
            (44, 18, 1.3),
            (58, 0, 1),
        ):
            for j, s in enumerate(shells):
                _pose(
                    f,
                    frame,
                    s,
                    rotation=(
                        0,
                        (-1 if j == 0 else 1) * open_amount,
                        (-1 if j == 0 else 1) * open_amount * 0.5,
                    ),
                )
            _pose(f, frame, emitter, scale=(pulse,) * 3)
            _pose(f, frame, frame_b, rotation=(-open_amount * 0.12, 0, 0))
        return 58, f
    if action in ("HitReact", "Stunned"):
        for frame, recoil in ((1, 0), (8, -18), (20, 12), (40, 0)):
            _pose(f, frame, body, rotation=(recoil, 0, recoil * 0.5))
            _pose(f, frame, head, rotation=(-recoil * 1.2, 0, -recoil))
            _pose(f, frame, bell, rotation=(recoil * 1.4, 0, recoil))
        return 40, f
    if action in ("Roar", "PhaseTransition", "Summon", "Enrage"):
        for frame, tear, pulse in (
            (1, 0, 1),
            (14, 20, 1.25),
            (30, 60, 1.9),
            (48, 18, 1.3),
            (64, 0, 1),
        ):
            for j, s in enumerate(shells):
                _pose(
                    f,
                    frame,
                    s,
                    rotation=(
                        0,
                        (-1 if j == 0 else 1) * tear,
                        (-1 if j == 0 else 1) * tear * 0.6,
                    ),
                )
            for j, y in enumerate(yokes):
                _pose(
                    f,
                    frame,
                    y,
                    rotation=(tear * 0.4, 0, (-1 if j == 0 else 1) * tear * 0.7),
                )
            for j, c in enumerate(chains):
                _pose(f, frame, c, rotation=(tear, 0, (-1 if j == 0 else 1) * tear))
            _pose(f, frame, halo, rotation=(tear, tear * 2, tear), scale=(pulse,) * 3)
            _pose(f, frame, emitter, scale=(pulse,) * 3)
            _pose(f, frame, jaw, rotation=(tear * 0.55, 0, 0))
        return 64, f
    if action == "Jump":
        for frame, z, tuck in ((1, 0, 0), (10, -0.08, 18), (22, 0.38, -22), (38, 0, 0)):
            _pose(f, frame, root, location=(0, 0, z))
            _pose(f, frame, frame_b, rotation=(tuck * 0.2, 0, 0))
            [_pose(f, frame, l, rotation=(tuck, 0, 0)) for l in legs]
        return 38, f
    if action == "WipeReset":
        for frame, z, scale in (
            (1, 0, 1),
            (16, -0.15, 0.8),
            (34, 0.12, 1.15),
            (54, 0, 1),
        ):
            _pose(f, frame, root, location=(0, 0, z), scale=(scale,) * 3)
        return 54, f
    if action == "Death":
        for frame, fall, shrink in (
            (1, 0, 1),
            (16, 18, 1.15),
            (36, 52, 0.8),
            (64, 86, 0.25),
            (90, 92, 0.06),
        ):
            _pose(f, frame, frame_b, rotation=(fall, 0, -fall * 0.2))
            _pose(f, frame, body, rotation=(-fall * 0.5, 0, fall * 0.15))
            _pose(f, frame, root, location=(0, 0, -fall * 0.004))
            _pose(f, frame, emitter, scale=(shrink,) * 3)
            for j, s in enumerate(shells):
                _pose(
                    f,
                    frame,
                    s,
                    rotation=(
                        0,
                        (-1 if j == 0 else 1) * fall,
                        (-1 if j == 0 else 1) * fall * 0.7,
                    ),
                    scale=((1 if frame < 64 else 0.25),) * 3,
                )
        return 90, f
    return failed_bellward_pose("Idle", armature)


_original_animation_pose = core.animation_pose
_original_special_pose = core.special_animation_pose


def scratch_animation_pose(name, armature, archetype):
    if archetype == "vein_wyrmling_scratch":
        end, frames = vein_wyrmling_pose(name, armature)
        transient = _first(armature, "VeinJet")
        for frame in (1, end):
            frames.setdefault(frame, {}).setdefault(transient, {}).setdefault(
                "scale", (0.02, 0.02, 0.02)
            )
        return end, frames
    if archetype == "muck_tree_scratch":
        end, frames = muck_tree_pose(name, armature)
        for transient_name in ("Cage.L", "Cage.R", "Cage.Back"):
            transient = _first(armature, transient_name)
            for frame in (1, end):
                frames.setdefault(frame, {}).setdefault(transient, {}).setdefault(
                    "scale", (0.02, 0.02, 0.02)
                )
        return end, frames
    if archetype == "echo_predator_scratch":
        return echo_predator_pose(name, armature)
    if archetype == "failed_bellward_scratch":
        return failed_bellward_pose(name, armature)
    return _original_animation_pose(name, armature, archetype)


def scratch_special_pose(name, armature, archetype):
    if archetype in {
        "vein_wyrmling_scratch",
        "muck_tree_scratch",
        "echo_predator_scratch",
        "failed_bellward_scratch",
    }:
        return scratch_animation_pose(name, armature, archetype)
    return _original_special_pose(name, armature, archetype)


core.animation_pose = scratch_animation_pose
core.special_animation_pose = scratch_special_pose


ACTION_FRAMES = {
    "vyrahel_vein_keeper": (
        ("VeinProwl", 12),
        ("CrystalGuard", 28),
        ("VeinBreath", 24),
        ("BurrowRush", 8),
        ("TailFeint", 18),
        ("WingBurst", 20),
        ("MercyWindow", 28),
        ("Yield", 48),
        ("VeinFade", 58),
    ),
    "alpha_mucker": (
        ("RootMarch", 12),
        ("BranchSlam", 28),
        ("RoadUproot", 32),
        ("SeedBarrage", 26),
        ("RootCage", 46),
        ("MuckheartPulse", 32),
        ("CanopyRage", 32),
        ("HeartExposed", 32),
        ("Timberfall", 66),
    ),
    "echo_singer": (
        ("Listen", 24),
        ("CopyMelee", 20),
        ("CopyRanged", 24),
        ("CopyGuard", 24),
        ("EchoDelay", 26),
        ("EssenceDive", 22),
        ("MirrorStep", 26),
        ("ResonanceOverload", 26),
        ("Silence", 58),
    ),
    "failed_apprentice": (
        ("ChainLurch", 12),
        ("BellFist", 24),
        ("ShardCast", 24),
        ("FailedWard", 28),
        ("WrongNote", 8),
        ("BellCrack", 30),
        ("BindingTear", 30),
        ("LastLesson", 30),
        ("BellCollapse", 64),
    ),
}


def render_actions(definition, armature_obj, actions, output_dir):
    frames = ACTION_FRAMES.get(definition.slug, ())
    if not frames:
        return
    scale = definition.world_size[1] / core.BASE_BOX[2]
    armature_obj.scale = (scale,) * 3
    scene = bpy.context.scene
    old_res = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x = 480
    scene.render.resolution_y = 480
    output_dir.mkdir(parents=True, exist_ok=True)
    maximum = max(definition.world_size)
    camera = scene.camera
    camera.location = (maximum * 1.35, -maximum * 2.5, definition.world_size[1] * 0.95)
    core.point_camera(camera, (0, 0, definition.world_size[1] * 0.48))
    for name, frame in frames:
        armature_obj.animation_data.action = actions[name]
        scene.frame_set(frame)
        scene.render.filepath = str(
            output_dir / f"{definition.slug}_{name.lower()}.png"
        )
        bpy.ops.render.render(write_still=True)
    armature_obj.animation_data.action = actions["Idle"]
    scene.frame_set(1)
    scene.render.resolution_x, scene.render.resolution_y = old_res
    armature_obj.scale = (1, 1, 1)


core.render_boss_action_stills = render_actions


def main():
    output_root = Path("/tmp/harthmere-four-boss-scratch-output")
    preview_root = Path("/tmp/harthmere-four-boss-scratch-previews")
    metadata = []
    for definition in DEFINITIONS:
        metadata.append(
            core.generate_boss(definition, output_root, preview_root / definition.slug)
        )
    print(core.json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
