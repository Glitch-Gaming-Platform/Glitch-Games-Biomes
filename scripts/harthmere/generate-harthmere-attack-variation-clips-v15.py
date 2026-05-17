#!/usr/bin/env python3
"""Duplicate the v8 aligned GLTF animation clips into named 24-frame attack variation clips.

This does not bloat the binary buffers. It reuses existing samplers/channels and adds
separate animation names so the runtime can explicitly request a concrete variation
instead of repeatedly requesting the same base attack key.
"""
from __future__ import annotations
import copy
import json
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
variant_dir = root / "public/assets/harthmere/gltf/characters/player_body_variants"
if not variant_dir.exists():
    raise SystemExit(f"Missing body variant dir: {variant_dir}")

VARIANTS = {
    "HarthmereBodyWeaponBasic_Aligned_30": [
        "HarthmereBodyWeaponBasic_Variation1_24",
        "HarthmereBodyWeaponBasic_Variation2_24",
        "HarthmereBodyWeaponBasic_Variation3_24",
        "HarthmereBodyWeaponBasic_Variation4_24",
    ],
    "HarthmereBodyWeaponHeavy_Aligned_30": [
        "HarthmereBodyWeaponHeavy_Variation1_24",
        "HarthmereBodyWeaponHeavy_Variation2_24",
        "HarthmereBodyWeaponHeavy_Variation3_24",
        "HarthmereBodyWeaponHeavy_Variation4_24",
    ],
    "HarthmereBodyMagicCast_Aligned_30": [
        "HarthmereBodyMagicCast_Variation1_24",
        "HarthmereBodyMagicCast_Variation2_24",
        "HarthmereBodyMagicCast_Variation3_24",
        "HarthmereBodyMagicCast_Variation4_24",
    ],
    "HarthmereBodyRangedRelease_Aligned_30": [
        "HarthmereBodyRangedRelease_Variation1_24",
        "HarthmereBodyRangedRelease_Variation2_24",
        "HarthmereBodyRangedRelease_Variation3_24",
        "HarthmereBodyRangedRelease_Variation4_24",
    ],
    "HarthmereBodyShieldBash_Aligned_30": [
        "HarthmereBodyShieldBash_Variation1_24",
        "HarthmereBodyShieldBash_Variation2_24",
        "HarthmereBodyShieldBash_Variation3_24",
        "HarthmereBodyShieldBash_Variation4_24",
    ],
    "HarthmereBodyToolUse_Aligned_30": [
        "HarthmereBodyToolUse_Variation1_24",
        "HarthmereBodyToolUse_Variation2_24",
        "HarthmereBodyToolUse_Variation3_24",
        "HarthmereBodyToolUse_Variation4_24",
    ],
}

patched = 0
created = 0
for gltf in sorted(variant_dir.glob("*.gltf")):
    data = json.loads(gltf.read_text(encoding="utf-8"))
    animations = data.get("animations") or []
    by_name = {a.get("name"): a for a in animations if isinstance(a, dict)}
    changed = False
    for base_name, names in VARIANTS.items():
        base = by_name.get(base_name)
        if not base:
            continue
        for i, name in enumerate(names, start=1):
            if name in by_name:
                continue
            clone = copy.deepcopy(base)
            clone["name"] = name
            extras = dict(clone.get("extras") or {})
            extras.update({
                "harthmereAttackVariationVersion": "harthmere-attack-variation-sequencing-v15",
                "sourceClip": base_name,
                "variationIndex": i,
                "frameCount": 24,
                "fps": 24,
            })
            clone["extras"] = extras
            animations.append(clone)
            by_name[name] = clone
            created += 1
            changed = True
    if changed:
        data["animations"] = animations
        gltf.write_text(json.dumps(data, indent=2), encoding="utf-8")
        patched += 1

print(f"PATCHED_GLTF_VARIANTS files={patched} clips_created={created}")
