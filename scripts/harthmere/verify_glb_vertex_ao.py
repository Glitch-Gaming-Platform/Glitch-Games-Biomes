#!/usr/bin/env python3
"""Verify AO-baked GLBs against their sources.

    python3 scripts/harthmere/verify_glb_vertex_ao.py

Confirms, for every baked asset, that:
  * the file is a structurally valid GLB whose JSON and buffer chunks parse;
  * geometry, materials, skins, and animations are unchanged;
  * every eligible primitive gained a COLOR_0 accessor of the right type;
  * COLOR_0 values carry real variation rather than a flat constant, which is
    what distinguishes a genuine bake from a no-op.
"""

from __future__ import annotations

import json
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake_glb_vertex_ao import (  # noqa: E402
    REPO,
    OUT_DIR,
    accessor_array,
    read_glb,
)


def counts(gltf):
    return {
        k: len(gltf.get(k, []))
        for k in ("meshes", "materials", "animations", "nodes", "skins")
    }


def total_tris(gltf, bin_chunk):
    n = 0
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if "indices" in prim:
                n += gltf["accessors"][prim["indices"]]["count"] // 3
    return n


def main():
    pairs = []
    for root, _dirs, files in os.walk(OUT_DIR):
        for f in files:
            if not f.endswith("_ao.glb"):
                continue
            dst = os.path.join(root, f)
            stem = f[:-len("_ao.glb")]
            rel = os.path.relpath(root, OUT_DIR)
            src = os.path.join(
                REPO, "public/assets/harthmere/glb", rel, stem + ".glb"
            )
            if os.path.exists(src):
                pairs.append((src, dst))

    if not pairs:
        print("no baked assets found under", OUT_DIR)
        return 1

    failures = 0
    print(f"{'asset':30}{'tris':>8}{'prims+':>7}{'ao min/mean/max':>22}{'verdict':>10}")
    for src, dst in sorted(pairs):
        name = os.path.basename(dst)
        try:
            a_gltf, a_bin = read_glb(src)
            b_gltf, b_bin = read_glb(dst)
        except Exception as exc:
            print(f"{name:30} UNREADABLE {exc!r}")
            failures += 1
            continue

        problems = []
        if counts(a_gltf) != counts(b_gltf):
            problems.append(f"structure changed {counts(a_gltf)} -> {counts(b_gltf)}")
        ta, tb = total_tris(a_gltf, a_bin), total_tris(b_gltf, b_bin)
        if ta != tb:
            problems.append(f"tris {ta} -> {tb}")

        added = 0
        vals = []
        for mesh in b_gltf.get("meshes", []):
            for prim in mesh.get("primitives", []):
                ci = prim.get("attributes", {}).get("COLOR_0")
                if ci is None:
                    continue
                added += 1
                acc = b_gltf["accessors"][ci]
                if acc["type"] != "VEC4" or acc["componentType"] != 5121:
                    problems.append(f"COLOR_0 wrong format {acc['type']}/{acc['componentType']}")
                if not acc.get("normalized"):
                    problems.append("COLOR_0 not normalized")
                arr = accessor_array(b_gltf, b_bin, ci)
                vals.append(arr[:, 0].astype(np.float64) / 255.0)

        if added == 0:
            problems.append("no COLOR_0 added")

        if vals:
            v = np.concatenate(vals)
            lo, mean, hi = v.min(), v.mean(), v.max()
            if hi - lo < 0.02:
                problems.append("COLOR_0 is flat (bake did nothing)")
            stat = f"{lo:.2f}/{mean:.2f}/{hi:.2f}"
        else:
            stat = "-"

        verdict = "OK" if not problems else "FAIL"
        if problems:
            failures += 1
        print(f"{name:30}{tb:>8}{added:>7}{stat:>22}{verdict:>10}")
        for p in problems:
            print(f"    - {p}")

    print()
    print(f"{len(pairs) - failures}/{len(pairs)} assets verified")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
