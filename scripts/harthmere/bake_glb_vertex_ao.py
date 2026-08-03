#!/usr/bin/env python3
"""Bake per-vertex ambient occlusion into combat GLBs as COLOR_0.

    python3 scripts/harthmere/bake_glb_vertex_ao.py --bosses --projectiles
    python3 scripts/harthmere/bake_glb_vertex_ao.py path/to/asset.glb

WHY
---
Every boss and projectile ships with zero textures and flat per-material colour.
Voxel forms are blocky, so with no contact shadowing in crevices a
119k-triangle dragon reads no deeper than a 19k one, and a projectile reads as a
flat blob rather than a lit object moving through space.

Baked AO is the highest-value fix for this art style. Writing it to a COLOR_0
vertex-colour attribute rather than a texture suits voxel geometry: no UV
unwrap, no texture memory, it survives skinning, and glTF-compliant renderers
(three.js GLTFLoader included) multiply COLOR_0 into base colour automatically.
No client shader or material change is required.

WHY NOT BLENDER
---------------
Blender's glTF add-on reads `bpy.context.object` during import and
`context.active_object` during export. Neither exists when an operator is driven
from the Python console, and a context override does not fix it because the
add-on re-reads the global context internally. Doing the work directly against
the glTF binary is deterministic, scriptable in CI, and needs no GUI session.

METHOD
------
Occlusion is estimated with a uniform voxel grid over the mesh: for each vertex,
step a short ray along each of N hemisphere directions and test whether any
triangle-occupied cell is entered. On blocky voxel geometry this matches a true
raycast closely while staying fast in numpy.

SAFETY
------
Reads shipping assets and writes to `tmp/ao_out/`. Sources are never modified.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import struct
import sys
import time

import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(REPO, "tmp", "ao_out")

AO_SAMPLES = 24
# Ray length as a fraction of the bounding box. Deliberately short: this is a
# contact-shadow term, not global shadowing. Long rays make every concave region
# hit something and flatten the model into uniform mud.
AO_DISTANCE_FRACTION = 0.035
AO_MIN = 0.55  # never fully black; a pure black cavity reads as a hole
# Strength of the occlusion term. Tuned so a typical boss lands near a 0.85 mean
# — visible depth in crevices while flat surfaces stay at full brightness.
AO_STRENGTH = 0.55
GRID_RES = 128  # occupancy grid resolution on the longest axis
# Rays start this many cells off the surface. Without enough clearance a ray
# immediately re-enters the cell holding its own vertex and reports a hit,
# which reads as ~90% occlusion on every asset regardless of shape.
AO_ORIGIN_CELLS = 2.0
AO_SKIP_CELLS = 2  # ignore the first steps for the same reason

COMPONENT_TYPES = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
COMPONENT_SIZES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
TYPE_COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

BOSSES = [
    "muck_scarred_helix", "gilded_bull", "ninth_winter", "failed_apprentice",
    "first_choir", "echo_singer", "vyrahel_vein_keeper", "thaedryn_bellbound",
    "hex_wraith", "alpha_mucker", "root_crowned_dead",
]
PROJECTILES = [
    "fireball", "hex_bolt", "indisworm_poison_spit", "life_drain",
    "lightning_bolt", "meteor", "nova_cannon_bolt", "entangling_roots",
    "helix_projector_beam", "thaedryn_resonance", "aimed_shot", "quick_shot",
]


# ---------------------------------------------------------------- GLB parsing

def read_gltf_json(path):
    """Read a .gltf whose single buffer is an embedded base64 data URI.

    The Indisworm ships in this form rather than as a GLB, so supporting it is
    what lets the cave worm receive the same treatment as the bosses.
    """
    with open(path, "r") as fh:
        gltf = json.load(fh)
    buffers = gltf.get("buffers", [])
    if not buffers:
        return gltf, bytearray()
    uri = buffers[0].get("uri", "")
    if not uri.startswith("data:"):
        raise ValueError(f"{path}: external buffer not supported")
    import base64

    payload = uri.split(",", 1)[1]
    return gltf, bytearray(base64.b64decode(payload))


def write_gltf_json(path, gltf, bin_chunk):
    import base64

    gltf = json.loads(json.dumps(gltf))
    encoded = base64.b64encode(bytes(bin_chunk)).decode("ascii")
    gltf["buffers"][0]["uri"] = "data:application/octet-stream;base64," + encoded
    gltf["buffers"][0]["byteLength"] = len(bin_chunk)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(gltf, fh, separators=(",", ":"))


def read_asset(path):
    if path.lower().endswith(".gltf"):
        return read_gltf_json(path)
    return read_glb(path)


def write_asset(path, gltf, bin_chunk):
    if path.lower().endswith(".gltf"):
        return write_gltf_json(path, gltf, bin_chunk)
    return write_glb(path, gltf, bin_chunk)


def read_glb(path):
    with open(path, "rb") as fh:
        magic, version, _length = struct.unpack("<III", fh.read(12))
        if magic != 0x46546C67:
            raise ValueError(f"{path}: not a GLB")
        gltf, bin_chunk = None, b""
        while True:
            header = fh.read(8)
            if len(header) < 8:
                break
            clen, ctype = struct.unpack("<II", header)
            data = fh.read(clen)
            if ctype == 0x4E4F534A:
                gltf = json.loads(data)
            elif ctype == 0x004E4942:
                bin_chunk = data
        if gltf is None:
            raise ValueError(f"{path}: no JSON chunk")
        return gltf, bytearray(bin_chunk)


def write_glb(path, gltf, bin_chunk):
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    binp = bytes(bin_chunk)
    binp += b"\x00" * ((4 - len(binp) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binp)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, total))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A))
        fh.write(js)
        fh.write(struct.pack("<II", len(binp), 0x004E4942))
        fh.write(binp)


def accessor_array(gltf, bin_chunk, index):
    acc = gltf["accessors"][index]
    count = acc["count"]
    ncomp = TYPE_COUNTS[acc["type"]]
    ctype = acc["componentType"]
    fmt = COMPONENT_TYPES[ctype]
    csize = COMPONENT_SIZES[ctype]
    bv = gltf["bufferViews"][acc["bufferView"]]
    base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = bv.get("byteStride") or (csize * ncomp)
    raw = np.frombuffer(bytes(bin_chunk), dtype=np.uint8)
    out = np.empty((count, ncomp), dtype=np.dtype(fmt))
    item = csize * ncomp
    for i in range(count):
        off = base + i * stride
        out[i] = np.frombuffer(raw[off:off + item].tobytes(), dtype=np.dtype("<" + fmt))
    return out


# ------------------------------------------------------------------ AO solver

def hemisphere_dirs(count, seed=20260803):
    rng = np.random.default_rng(seed)
    i = np.arange(count)
    u = (i + rng.random(count)) / count
    cos_t = np.sqrt(1.0 - u)
    sin_t = np.sqrt(np.maximum(0.0, 1.0 - cos_t ** 2))
    phi = 2.0 * math.pi * rng.random(count)
    return np.stack([sin_t * np.cos(phi), sin_t * np.sin(phi), cos_t], axis=1)


def build_occupancy(positions, tris, res):
    lo = positions.min(axis=0)
    hi = positions.max(axis=0)
    extent = hi - lo
    longest = float(extent.max()) or 1.0
    cell = longest / res
    dims = np.maximum(np.ceil(extent / cell).astype(int) + 1, 1)
    grid = np.zeros(tuple(dims), dtype=bool)

    # Mark cells containing triangle vertices and edge midpoints. On voxel
    # geometry, faces are small relative to cell size so this closely
    # approximates full triangle rasterisation at a fraction of the cost.
    a, b, c = positions[tris[:, 0]], positions[tris[:, 1]], positions[tris[:, 2]]
    samples = np.concatenate(
        [a, b, c, (a + b) * 0.5, (b + c) * 0.5, (a + c) * 0.5, (a + b + c) / 3.0]
    )
    idx = np.clip(((samples - lo) / cell).astype(int), 0, dims - 1)
    grid[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    return grid, lo, cell, dims


def compute_ao(positions, normals, tris, samples=AO_SAMPLES, occupancy=None, extent=None):
    """Occlude `positions` against `occupancy`, which may cover the whole asset.

    The grid is passed in rather than built here so that every primitive of a
    multi-part asset is occluded by all the others. Building it per primitive
    made each part self-occlude only, which on assets like `fireball.glb`
    (14 separate convex shells) produced a flat 0% occlusion result.
    """
    if occupancy is None:
        occupancy = build_occupancy(positions, tris, GRID_RES)
    grid, lo, cell, dims = occupancy
    if extent is None:
        extent = float((positions.max(axis=0) - positions.min(axis=0)).max()) or 1.0
    max_dist = extent * AO_DISTANCE_FRACTION
    steps = max(3, int(max_dist / cell))

    dirs = hemisphere_dirs(samples)

    # Orthonormal frame per vertex, Z aligned to the normal.
    n = normals / np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-9)
    helper = np.where(np.abs(n[:, 2:3]) < 0.9, np.array([0.0, 0.0, 1.0]), np.array([1.0, 0.0, 0.0]))
    t = np.cross(n, helper)
    t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-9)
    b = np.cross(n, t)

    origin = positions + n * (cell * AO_ORIGIN_CELLS)
    occl = np.zeros(len(positions), dtype=np.float32)

    for d in dirs:
        wd = t * d[0] + b * d[1] + n * d[2]
        hit = np.zeros(len(positions), dtype=bool)
        for s in range(AO_SKIP_CELLS, steps + 1):
            p = origin + wd * (cell * s)
            idx = ((p - lo) / cell).astype(int)
            inside = np.all((idx >= 0) & (idx < dims), axis=1)
            probe = np.zeros(len(positions), dtype=bool)
            ii = idx[inside]
            probe[inside] = grid[ii[:, 0], ii[:, 1], ii[:, 2]]
            hit |= probe
        occl += hit.astype(np.float32)

    occl /= float(samples)
    ao = 1.0 - occl * AO_STRENGTH
    return np.clip(ao, AO_MIN, 1.0)


# --------------------------------------------------------------------- driver

def add_color0(gltf, bin_chunk, prim, ao):
    """Append a COLOR_0 accessor holding the AO term as unsigned-byte RGBA."""
    rgba = np.empty((len(ao), 4), dtype=np.uint8)
    v = np.clip(ao * 255.0 + 0.5, 0, 255).astype(np.uint8)
    rgba[:, 0] = v
    rgba[:, 1] = v
    rgba[:, 2] = v
    rgba[:, 3] = 255

    raw = rgba.tobytes()
    pad = (4 - len(bin_chunk) % 4) % 4
    bin_chunk.extend(b"\x00" * pad)
    offset = len(bin_chunk)
    bin_chunk.extend(raw)

    gltf.setdefault("bufferViews", []).append(
        {"buffer": 0, "byteOffset": offset, "byteLength": len(raw), "target": 34962}
    )
    bv_index = len(gltf["bufferViews"]) - 1
    gltf.setdefault("accessors", []).append(
        {
            "bufferView": bv_index,
            "componentType": 5121,
            "normalized": True,
            "count": len(ao),
            "type": "VEC4",
        }
    )
    prim["attributes"]["COLOR_0"] = len(gltf["accessors"]) - 1
    if gltf.get("buffers"):
        gltf["buffers"][0]["byteLength"] = len(bin_chunk)


def process(src, dst):
    gltf, bin_chunk = read_asset(src)

    # First pass: gather every primitive so the occupancy grid covers the whole
    # asset. Parts must be able to shadow each other, not just themselves.
    parts = []
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            attrs = prim.get("attributes", {})
            if "POSITION" not in attrs or "indices" not in prim:
                continue
            if "COLOR_0" in attrs:
                continue  # already has vertex colour; don't clobber authored data
            positions = accessor_array(gltf, bin_chunk, attrs["POSITION"]).astype(np.float64)
            idx = accessor_array(gltf, bin_chunk, prim["indices"]).astype(np.int64).reshape(-1)
            tris = idx.reshape(-1, 3)
            if "NORMAL" in attrs:
                normals = accessor_array(gltf, bin_chunk, attrs["NORMAL"]).astype(np.float64)
            else:
                normals = np.zeros_like(positions)
                a, b, c = positions[tris[:, 0]], positions[tris[:, 1]], positions[tris[:, 2]]
                fn = np.cross(b - a, c - a)
                for k in range(3):
                    np.add.at(normals, tris[:, k], fn)
            parts.append((prim, positions, normals, tris))

    if not parts:
        write_asset(dst, gltf, bin_chunk)
        return {"primitives": 0, "vertices": 0, "occluded_fraction": 0.0,
                "out_bytes": os.path.getsize(dst)}

    all_pos = np.concatenate([p[1] for p in parts])
    offset = 0
    all_tris = []
    for _prim, positions, _n, tris in parts:
        all_tris.append(tris + offset)
        offset += len(positions)
    all_tris = np.concatenate(all_tris)

    occupancy = build_occupancy(all_pos, all_tris, GRID_RES)
    extent = float((all_pos.max(axis=0) - all_pos.min(axis=0)).max()) or 1.0

    total_verts = 0
    total_occ = 0.0
    prim_count = 0
    for prim, positions, normals, tris in parts:
        ao = compute_ao(positions, normals, tris, occupancy=occupancy, extent=extent)
        add_color0(gltf, bin_chunk, prim, ao)
        total_verts += len(ao)
        total_occ += float((ao < 0.95).sum())
        prim_count += 1

    write_asset(dst, gltf, bin_chunk)
    return {
        "primitives": prim_count,
        "vertices": total_verts,
        "occluded_fraction": round(total_occ / max(1, total_verts), 3),
        "out_bytes": os.path.getsize(dst),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--bosses", action="store_true")
    ap.add_argument("--projectiles", action="store_true")
    args = ap.parse_args(argv)

    jobs = []
    if args.bosses:
        jobs += [
            (f"public/assets/harthmere/glb/bosses/{b}.glb", f"bosses/{b}_ao.glb")
            for b in BOSSES
        ]
    if args.projectiles:
        jobs += [
            (f"public/assets/harthmere/glb/projectiles/{p}.glb", f"projectiles/{p}_ao.glb")
            for p in PROJECTILES
        ]
    for p in args.paths:
        base = os.path.basename(p)
        ext = ".gltf" if base.lower().endswith(".gltf") else ".glb"
        jobs.append((p, base[: -len(ext)] + "_ao" + ext))

    report = []
    for rel_src, rel_dst in jobs:
        src = rel_src if os.path.isabs(rel_src) else os.path.join(REPO, rel_src)
        dst = os.path.join(OUT_DIR, rel_dst)
        if not os.path.exists(src):
            print(f"  SKIP missing {rel_src}")
            continue
        t0 = time.time()
        try:
            st = process(src, dst)
            st.update(
                src=rel_src,
                dst=os.path.relpath(dst, REPO),
                seconds=round(time.time() - t0, 1),
                src_bytes=os.path.getsize(src),
            )
            print(
                f"  OK   {os.path.basename(rel_src):34} "
                f"prims={st['primitives']:>3} verts={st['vertices']:>7} "
                f"occluded={st['occluded_fraction']:.1%} "
                f"{st['src_bytes']/1e6:.1f}->{st['out_bytes']/1e6:.1f}MB "
                f"{st['seconds']}s"
            )
            report.append(st)
        except Exception as exc:
            print(f"  FAIL {rel_src}: {exc!r}")
            report.append({"src": rel_src, "error": repr(exc)})

    out = os.path.join(REPO, "tmp", "ao_bake_report.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as fh:
        json.dump(report, fh, indent=2)
    print("wrote", os.path.relpath(out, REPO))
    return 0 if all("error" not in r for r in report) else 1


if __name__ == "__main__":
    sys.exit(main())
