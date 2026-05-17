#!/usr/bin/env python3
from __future__ import annotations
import base64
import json
import math
import struct
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
VARIANT_DIR = ROOT / "public/assets/harthmere/gltf/characters/player_body_variants"
VERSION = "harthmere-real-attack-variation-clips-v18"
FRAMES = 24
FPS = 24
TIMES = [i / FPS for i in range(FRAMES)]

VARIATION_SPECS = {
    "HarthmereBodyWeaponBasic_Variation1_24": dict(family="basic", label="wide_forehand", torso=26, spine=-8, shoulder=38, elbow=22, wrist=32, hip=10, step=0.10, lateral=0.03, arc=122),
    "HarthmereBodyWeaponBasic_Variation2_24": dict(family="basic", label="backhand_return", torso=-34, spine=9, shoulder=-42, elbow=-28, wrist=-36, hip=-16, step=0.02, lateral=-0.12, arc=148),
    "HarthmereBodyWeaponBasic_Variation3_24": dict(family="basic", label="forward_lunge_thrust", torso=0, spine=-5, shoulder=12, elbow=-10, wrist=8, hip=0, step=0.20, lateral=0.0, arc=34),
    "HarthmereBodyWeaponBasic_Variation4_24": dict(family="basic", label="low_rising_cut", torso=38, spine=15, shoulder=48, elbow=30, wrist=42, hip=22, step=0.07, lateral=0.09, arc=168),

    "HarthmereBodyWeaponHeavy_Variation1_24": dict(family="heavy", label="overhead_cleave", torso=4, spine=-18, shoulder=58, elbow=34, wrist=50, hip=5, step=0.14, lateral=0.0, arc=178),
    "HarthmereBodyWeaponHeavy_Variation2_24": dict(family="heavy", label="broad_side_sweep", torso=-44, spine=8, shoulder=-54, elbow=-36, wrist=-48, hip=-26, step=0.04, lateral=-0.18, arc=190),
    "HarthmereBodyWeaponHeavy_Variation3_24": dict(family="heavy", label="backhand_crusher", torso=42, spine=11, shoulder=52, elbow=34, wrist=46, hip=24, step=0.04, lateral=0.16, arc=176),
    "HarthmereBodyWeaponHeavy_Variation4_24": dict(family="heavy", label="committed_heavy_lunge", torso=0, spine=-9, shoulder=20, elbow=-18, wrist=12, hip=0, step=0.28, lateral=0.0, arc=58),

    "HarthmereBodyMagicCast_Variation1_24": dict(family="magic", label="palm_burst", torso=0, spine=-4, shoulder=16, elbow=18, wrist=24, hip=0, step=0.03, lateral=0.0, arc=38),
    "HarthmereBodyMagicCast_Variation2_24": dict(family="magic", label="overhead_invocation", torso=18, spine=-14, shoulder=42, elbow=26, wrist=38, hip=8, step=0.04, lateral=0.03, arc=112),
    "HarthmereBodyMagicCast_Variation3_24": dict(family="magic", label="sweeping_sigil", torso=-32, spine=7, shoulder=-44, elbow=-18, wrist=-40, hip=-15, step=0.0, lateral=-0.12, arc=146),
    "HarthmereBodyMagicCast_Variation4_24": dict(family="magic", label="ground_slam_cast", torso=0, spine=20, shoulder=28, elbow=20, wrist=30, hip=0, step=0.08, lateral=0.0, arc=96),

    "HarthmereBodyRangedRelease_Variation1_24": dict(family="ranged", label="square_release", torso=0, spine=-4, shoulder=16, elbow=8, wrist=8, hip=0, step=0.02, lateral=0.0, arc=18),
    "HarthmereBodyRangedRelease_Variation2_24": dict(family="ranged", label="open_release", torso=22, spine=-4, shoulder=26, elbow=10, wrist=10, hip=10, step=0.03, lateral=0.08, arc=28),
    "HarthmereBodyRangedRelease_Variation3_24": dict(family="ranged", label="closed_snap_release", torso=-26, spine=6, shoulder=-24, elbow=-8, wrist=-8, hip=-12, step=0.0, lateral=-0.08, arc=24),
    "HarthmereBodyRangedRelease_Variation4_24": dict(family="ranged", label="lofted_release", torso=0, spine=-12, shoulder=28, elbow=10, wrist=12, hip=0, step=0.04, lateral=0.0, arc=42),

    "HarthmereBodyShieldBash_Variation1_24": dict(family="shield", label="short_jab", torso=-16, spine=-3, shoulder=-24, elbow=-12, wrist=-14, hip=-8, step=0.10, lateral=0.0, arc=28),
    "HarthmereBodyShieldBash_Variation2_24": dict(family="shield", label="hook_bash", torso=-36, spine=8, shoulder=-38, elbow=-22, wrist=-26, hip=-18, step=0.03, lateral=-0.12, arc=108),
    "HarthmereBodyShieldBash_Variation3_24": dict(family="shield", label="rising_bump", torso=-22, spine=15, shoulder=-30, elbow=-16, wrist=-18, hip=-10, step=0.05, lateral=0.04, arc=96),
    "HarthmereBodyShieldBash_Variation4_24": dict(family="shield", label="slam_bash", torso=-12, spine=-10, shoulder=-28, elbow=-16, wrist=-20, hip=-6, step=0.12, lateral=0.0, arc=132),

    "HarthmereBodyToolUse_Variation1_24": dict(family="tool", label="overhead_chop", torso=0, spine=-18, shoulder=48, elbow=30, wrist=42, hip=0, step=0.08, lateral=0.0, arc=160),
    "HarthmereBodyToolUse_Variation2_24": dict(family="tool", label="angled_hack", torso=-28, spine=6, shoulder=-34, elbow=-22, wrist=-30, hip=-12, step=0.03, lateral=-0.10, arc=136),
    "HarthmereBodyToolUse_Variation3_24": dict(family="tool", label="cross_body_pick", torso=32, spine=12, shoulder=40, elbow=26, wrist=34, hip=14, step=0.0, lateral=0.12, arc=148),
    "HarthmereBodyToolUse_Variation4_24": dict(family="tool", label="forward_dig", torso=0, spine=22, shoulder=20, elbow=12, wrist=16, hip=0, step=0.10, lateral=0.0, arc=72),
}

# broad node-name heuristics for your blocky body variants and any future skeletal bodies
NODE_PATTERNS = {
    "right_upper": [["right", "upper", "arm"], ["right", "arm"], ["r_arm"], ["arm.r"], ["townsperson-right-arm"]],
    "right_lower": [["right", "fore"], ["right", "lower", "arm"], ["right", "hand"], ["forearm.r"], ["hand.r"], ["townsperson-right-arm"]],
    "right_hand": [["right", "hand"], ["hand.r"], ["weapon_r"], ["mixamorigright"]],
    "left_upper": [["left", "upper", "arm"], ["left", "arm"], ["l_arm"], ["arm.l"], ["townsperson-left-arm"]],
    "left_lower": [["left", "fore"], ["left", "lower", "arm"], ["left", "hand"], ["forearm.l"], ["hand.l"], ["townsperson-left-arm"]],
    "spine": [["spine"], ["chest"], ["torso"], ["body"], ["townsperson-torso"]],
    "hips": [["hip"], ["pelvis"], ["root"], ["body"], ["townsperson-torso"]],
}

def deg(v: float) -> float:
    return math.radians(v)

def quat_from_euler(x: float, y: float, z: float) -> Tuple[float, float, float, float]:
    # XYZ Euler to quaternion
    cx, sx = math.cos(x / 2), math.sin(x / 2)
    cy, sy = math.cos(y / 2), math.sin(y / 2)
    cz, sz = math.cos(z / 2), math.sin(z / 2)
    qx = sx * cy * cz + cx * sy * sz
    qy = cx * sy * cz - sx * cy * sz
    qz = cx * cy * sz + sx * sy * cz
    qw = cx * cy * cz - sx * sy * sz
    return (qx, qy, qz, qw)

def pose_curve(i: int, impact_frame: int = 12) -> float:
    t = i / (FRAMES - 1)
    if i <= impact_frame:
        x = i / max(1, impact_frame)
        return math.sin(x * math.pi * 0.5)
    x = (i - impact_frame) / max(1, FRAMES - 1 - impact_frame)
    return math.cos(x * math.pi * 0.5)

def find_node(nodes: Sequence[dict], role: str) -> Optional[int]:
    patterns = NODE_PATTERNS[role]
    for pattern in patterns:
        for idx, node in enumerate(nodes):
            name = str(node.get("name", "")).lower().replace("_", "-").replace(".", "-")
            if all(part.lower().replace("_", "-").replace(".", "-") in name for part in pattern):
                return idx
    return None

class GltfWriter:
    def __init__(self, gltf: Path):
        self.gltf = gltf
        self.data = json.loads(gltf.read_text(encoding="utf-8"))
        self.buffers = self.data.setdefault("buffers", [])
        if not self.buffers:
            self.buffers.append({"byteLength": 0})
        self.buffer = self.buffers[0]
        uri = self.buffer.get("uri")
        self.data_uri = False
        if uri and uri.startswith("data:"):
            self.data_uri = True
            b64 = uri.split(",", 1)[1]
            self.bin = bytearray(base64.b64decode(b64))
        else:
            self.bin_path = (gltf.parent / (uri or (gltf.stem + ".bin"))).resolve()
            if self.bin_path.exists():
                self.bin = bytearray(self.bin_path.read_bytes())
            else:
                self.bin = bytearray()
                self.buffer["uri"] = self.bin_path.name
        self.buffer_views = self.data.setdefault("bufferViews", [])
        self.accessors = self.data.setdefault("accessors", [])
        self.animations = self.data.setdefault("animations", [])
        self.nodes = self.data.setdefault("nodes", [])

    def align(self):
        while len(self.bin) % 4:
            self.bin.append(0)

    def add_accessor(self, floats: Sequence[float], gltf_type: str, target: Optional[int] = None) -> int:
        self.align()
        offset = len(self.bin)
        self.bin.extend(struct.pack("<" + "f" * len(floats), *floats))
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(floats) * 4}
        if target is not None:
            view["target"] = target
        view_index = len(self.buffer_views)
        self.buffer_views.append(view)
        comps = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[gltf_type]
        accessor = {
            "bufferView": view_index,
            "byteOffset": 0,
            "componentType": 5126,
            "count": len(floats) // comps,
            "type": gltf_type,
        }
        if gltf_type == "SCALAR":
            accessor["min"] = [min(floats)]
            accessor["max"] = [max(floats)]
        self.accessors.append(accessor)
        return len(self.accessors) - 1

    def write(self):
        self.buffer["byteLength"] = len(self.bin)
        if self.data_uri:
            self.buffer["uri"] = "data:application/octet-stream;base64," + base64.b64encode(self.bin).decode("ascii")
        else:
            self.bin_path.write_bytes(bytes(self.bin))
            self.buffer["uri"] = self.bin_path.name
        self.gltf.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    def add_variation_animation(self, name: str, spec: dict) -> bool:
        node_map = {role: find_node(self.nodes, role) for role in NODE_PATTERNS}
        if node_map.get("right_upper") is None or node_map.get("spine") is None:
            return False
        impact = 12 if "Heavy" not in name else 14
        time_acc = self.add_accessor(TIMES, "SCALAR")
        channels = []
        samplers = []

        def add_rotation(role: str, amp_x: float, amp_y: float, amp_z: float):
            node = node_map.get(role)
            if node is None:
                return
            vals: List[float] = []
            for i in range(FRAMES):
                c = pose_curve(i, impact)
                # More anticipation before impact; return after impact.
                anticipation = -0.35 * math.sin((i / max(1, impact)) * math.pi) if i <= impact else 0
                q = quat_from_euler(deg(amp_x * c), deg(amp_y * c + anticipation * amp_y), deg(amp_z * c))
                vals.extend(q)
            out_acc = self.add_accessor(vals, "VEC4")
            samplers.append({"input": time_acc, "interpolation": "LINEAR", "output": out_acc})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": "rotation"}})

        def add_translation(role: str, x: float, y: float, z: float):
            node = node_map.get(role)
            if node is None:
                return
            vals: List[float] = []
            for i in range(FRAMES):
                c = pose_curve(i, impact)
                vals.extend((x * c, y * c, z * c))
            out_acc = self.add_accessor(vals, "VEC3")
            samplers.append({"input": time_acc, "interpolation": "LINEAR", "output": out_acc})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": "translation"}})

        # Right arm owns weapon. Left arm counters / balances. Spine + hips make the silhouette readable.
        add_rotation("right_upper", spec["shoulder"], spec["torso"] * 0.55, spec["arc"] * 0.18)
        add_rotation("right_lower", spec["elbow"], spec["torso"] * 0.28, spec["arc"] * 0.13)
        add_rotation("right_hand", spec["wrist"], spec["torso"] * 0.20, spec["arc"] * 0.10)
        add_rotation("left_upper", -spec["shoulder"] * 0.28, -spec["torso"] * 0.30, -spec["arc"] * 0.08)
        add_rotation("left_lower", -spec["elbow"] * 0.25, -spec["torso"] * 0.20, -spec["arc"] * 0.05)
        add_rotation("spine", spec["spine"], spec["torso"], spec["torso"] * 0.18)
        add_rotation("hips", 0, spec["hip"], 0)
        add_translation("hips", spec["lateral"], 0, spec["step"])

        if len(channels) < 5:
            return False
        anim = {
            "name": name,
            "samplers": samplers,
            "channels": channels,
            "extras": {
                "harthmereRealVariationVersion": VERSION,
                "frameCount": FRAMES,
                "fps": FPS,
                "family": spec["family"],
                "label": spec["label"],
                "notAClonedBaseClip": True,
                "rightArmChannels": True,
                "bodySilhouetteChannels": True,
            },
        }
        # Replace stale cloned placeholder if present.
        self.animations[:] = [a for a in self.animations if a.get("name") != name]
        self.animations.append(anim)
        return True

if not VARIANT_DIR.exists():
    raise SystemExit(f"Missing body variant dir: {VARIANT_DIR}")

patched_files = 0
created = 0
failed = []
for gltf in sorted(VARIANT_DIR.glob("*.gltf")):
    writer = GltfWriter(gltf)
    made_any = False
    for name, spec in VARIATION_SPECS.items():
        if writer.add_variation_animation(name, spec):
            made_any = True
            created += 1
        else:
            failed.append((gltf.name, name))
    if made_any:
        writer.write()
        patched_files += 1

print(f"PATCHED_REAL_VARIATIONS version={VERSION} files={patched_files} clips={created} failures={len(failed)}")
if failed:
    print("FAILED_SAMPLE", failed[:10])
if patched_files == 0 or created == 0:
    raise SystemExit("No real variation clips were generated; node heuristics did not match the body variant GLTFs.")
