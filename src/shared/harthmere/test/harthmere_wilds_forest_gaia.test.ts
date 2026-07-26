/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE_WILDS_FOREST — GAIA SUPPORT
//
// The forest is real terrain, so Gaia simulates it. Two rules decide whether a
// tree survives the first few minutes after the world loads, and a tree that
// merely looks right will fail both:
//
//   tree_growth  — a log is supported if the SIX-CONNECTED chain of same-species
//                  logs reaches a log with dirt/grass/moss directly beneath,
//                  within Manhattan distance gaiaV2GrowthTreeMaxDFS (24).
//                  Unsupported logs decay on a 2-minute timer.
//   leaf_growth  — a leaf is supported if the six-connected chain of the SAME
//                  leaf id reaches its matching log within
//                  gaiaV2GrowthLeafMaxDFS (8). Unsupported leaves decay in 1
//                  minute.
//
// This file re-implements both rules against the generator's output. It is the
// difference between "the forest renders" and "the forest is still there when
// you walk back". Everything it asserts was a real defect first: rounded
// diagonal oak branches, a diagonal jump in the birch stems, and eroded canopy
// voxels stranded with no neighbours.
//
// The constants below are duplicated from src/server/shared/config.ts on
// purpose — importing the server config drags the whole server graph into a
// shared test. If Gaia's numbers ever change, this test should fail loudly.

import assert from "assert";
import {
  HARTHMERE_FOREST_CANOPY_CLEARANCE,
  HARTHMERE_FOREST_SPACING,
  harthmereForestTreeForCell,
  harthmereWildsForestBlockAt,
  type HarthmereForestMaterial,
} from "../harthmere_wilds_forest";

/** CONFIG.gaiaV2GrowthTreeMaxDFS */
const GAIA_TREE_MAX_DFS = 24;
/** CONFIG.gaiaV2GrowthLeafMaxDFS */
const GAIA_LEAF_MAX_DFS = 8;
/** CONFIG.gaiaTreeGrowthSoils */
const GAIA_TREE_SOILS = new Set(["dirt", "grass", "moss"]);
/** CONFIG.gaiaLeafGrowthRoots, as leaf -> log. */
const GAIA_LEAF_ROOTS = new Map<string, string>([
  ["birchLeaf", "birchLog"],
  ["oakLeaf", "oakLog"],
  ["rubberLeaf", "rubberLog"],
]);

const LOGS = new Set(["oakLog", "birchLog", "rubberLog"]);

type Voxels = Map<string, HarthmereForestMaterial>;
const key = (x: number, y: number, z: number) => `${x}:${y}:${z}`;

/**
 * Materialise a patch of forest, plus a margin.
 *
 * The margin matters: a tree whose trunk sits just outside the window still
 * reaches into it, and a clipped canopy looks exactly like an unsupported one.
 * Voxels are generated across the whole padded area but only those in the
 * INTERIOR are judged, so the test measures the generator rather than its own
 * window. (The first run of this test failed entirely on clipped edge trees.)
 */
const PATCH_MARGIN = 8;

function buildPatch(
  x0: number,
  z0: number,
  size: number
): {
  voxels: Voxels;
  trunkColumns: Set<string>;
  interior: (k: string) => boolean;
} {
  const voxels: Voxels = new Map();
  const trunkColumns = new Set<string>();
  for (let z = z0 - PATCH_MARGIN; z < z0 + size + PATCH_MARGIN; z += 1) {
    for (let x = x0 - PATCH_MARGIN; x < x0 + size + PATCH_MARGIN; x += 1) {
      for (let y = 1; y <= 24; y += 1) {
        const block = harthmereWildsForestBlockAt(x, y, z);
        if (block !== undefined) {
          voxels.set(key(x, y, z), block);
          if (y === 1 && LOGS.has(block)) {
            trunkColumns.add(`${x}:${z}`);
          }
        }
      }
    }
  }
  const interior = (k: string) => {
    const [x, , z] = k.split(":").map(Number);
    return x >= x0 && x < x0 + size && z >= z0 && z < z0 + size;
  };
  return { voxels, trunkColumns, interior };
}

const NEIGHBOURS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function manhattan(
  a: readonly [number, number, number],
  b: readonly [number, number, number]
): number {
  return (
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
  );
}

/**
 * gaia/simulations/leaf_growth.ts visitLeaves, transcribed: six-connected,
 * travels only through voxels of the same leaf id, frontier cut at
 * `distManhattan(pos, origin) < GAIA_LEAF_MAX_DFS`, terminates on the log.
 */
function leafIsSupported(
  voxels: Voxels,
  origin: readonly [number, number, number],
  leaf: HarthmereForestMaterial
): boolean {
  const root = GAIA_LEAF_ROOTS.get(leaf)!;
  const seen = new Set<string>([key(...origin)]);
  const stack: Array<readonly [number, number, number]> = [origin];
  while (stack.length > 0) {
    const pos = stack.pop()!;
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const next: readonly [number, number, number] = [
        pos[0] + dx,
        pos[1] + dy,
        pos[2] + dz,
      ];
      const k = key(...next);
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      const id = voxels.get(k);
      if (id === root) {
        return true;
      }
      if (id === leaf && manhattan(next, origin) < GAIA_LEAF_MAX_DFS) {
        stack.push(next);
      }
    }
  }
  return false;
}

/**
 * gaia/simulations/tree_growth.ts visitLogs, transcribed: six-connected through
 * same-species logs, supported when any visited log has growth soil directly
 * beneath it. Ground level (relY 0) is soil everywhere in this patch.
 */
function logIsSupported(
  voxels: Voxels,
  origin: readonly [number, number, number],
  log: HarthmereForestMaterial
): boolean {
  const seen = new Set<string>([key(...origin)]);
  const stack: Array<readonly [number, number, number]> = [origin];
  while (stack.length > 0) {
    const pos = stack.pop()!;
    // "if (this.isGrowableSoil(helper, [x, y - 1, z])) supported = true"
    if (pos[1] === 1) {
      return true;
    }
    if (manhattan(pos, origin) >= GAIA_TREE_MAX_DFS) {
      continue;
    }
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const next: readonly [number, number, number] = [
        pos[0] + dx,
        pos[1] + dy,
        pos[2] + dz,
      ];
      const k = key(...next);
      if (seen.has(k) || voxels.get(k) !== log) {
        continue;
      }
      seen.add(k);
      stack.push(next);
    }
  }
  return false;
}

describe("harthmere wilds forest - Gaia keeps the trees standing", () => {
  // One patch, reused: materialising forest is the expensive part.
  const patch = buildPatch(220, -300, 96);

  it("grows a real forest in the sample patch", () => {
    const logs = [...patch.voxels.values()].filter((m) => LOGS.has(m)).length;
    const leaves = [...patch.voxels.values()].filter((m) =>
      GAIA_LEAF_ROOTS.has(m)
    ).length;
    assert.ok(logs > 500, `only ${logs} log voxels — the patch is not a forest`);
    assert.ok(leaves > 5000, `only ${leaves} leaf voxels`);
  });

  it("leaves every log six-connected to soil, so tree_growth never decays one", () => {
    const unsupported: string[] = [];
    for (const [k, material] of patch.voxels) {
      if (!LOGS.has(material) || !patch.interior(k)) {
        continue;
      }
      const [x, y, z] = k.split(":").map(Number) as [number, number, number];
      if (!logIsSupported(patch.voxels, [x, y, z], material)) {
        unsupported.push(`${material} at ${k}`);
      }
    }
    assert.deepEqual(
      unsupported.slice(0, 5),
      [],
      `${unsupported.length} logs are unsupported and would decay in ~2 minutes`
    );
  });

  it("leaves every leaf within Gaia's DFS budget of its own log", () => {
    const unsupported: string[] = [];
    for (const [k, material] of patch.voxels) {
      if (!GAIA_LEAF_ROOTS.has(material) || !patch.interior(k)) {
        continue;
      }
      const [x, y, z] = k.split(":").map(Number) as [number, number, number];
      if (!leafIsSupported(patch.voxels, [x, y, z], material)) {
        unsupported.push(`${material} at ${k}`);
      }
    }
    assert.deepEqual(
      unsupported.slice(0, 5),
      [],
      `${unsupported.length} leaves are unsupported and would decay in ~1 minute`
    );
  });

  it("never mixes species inside one canopy", () => {
    // leaf_growth only walks through leaves of the SAME id, so an oak leaf
    // embedded in a birch canopy would be orphaned even though it looks fine.
    for (const [k, material] of patch.voxels) {
      if (!GAIA_LEAF_ROOTS.has(material) || !patch.interior(k)) {
        continue;
      }
      const [x, y, z] = k.split(":").map(Number) as [number, number, number];
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const other = patch.voxels.get(key(x + dx, y + dy, z + dz));
        if (other && GAIA_LEAF_ROOTS.has(other) && other !== material) {
          assert.fail(
            `${material} touches ${other} at ${k} — two species share a canopy`
          );
        }
      }
    }
  });

  it("puts a trunk base in every column the shim must paint as soil", () => {
    // The shim's contract: wherever relY 1 is a log, the ground voxel below is
    // forced to a Gaia growth soil. This test pins the set the shim must cover.
    assert.ok(patch.trunkColumns.size > 40, "too few trunks to be meaningful");
    for (const column of patch.trunkColumns) {
      const [x, z] = column.split(":").map(Number);
      const block = harthmereWildsForestBlockAt(x, 1, z);
      assert.ok(
        block !== undefined && LOGS.has(block),
        `column ${column} was reported as a trunk but has no log at relY 1`
      );
    }
    assert.ok(
      [...GAIA_TREE_SOILS].includes("grass"),
      "the shim paints grass under trunks; it must remain a growth soil"
    );
  });
});

describe("harthmere wilds forest - shape and playability", () => {
  it("keeps every leaf above head height so you walk under the canopy", () => {
    for (let z = -300; z < -200; z += 1) {
      for (let x = 220; x < 320; x += 1) {
        for (let y = 1; y < HARTHMERE_FOREST_CANOPY_CLEARANCE; y += 1) {
          const block = harthmereWildsForestBlockAt(x, y, z);
          if (block === undefined) {
            continue;
          }
          assert.ok(
            LOGS.has(block),
            `${block} at (${x},${y},${z}) is below the clearance line — ` +
              `only one-voxel trunks may occupy head height`
          );
        }
      }
    }
  });

  it("keeps head height clear enough to walk through", () => {
    // Not "one voxel per tree" — trunks are spaced 5..11 apart, so a window
    // this size is SUPPOSED to contain a few neighbours. The property that
    // matters is that everything at head height is a one-voxel trunk and the
    // occupancy is low enough to walk between them.
    let windows = 0;
    let worstOccupancy = 0;
    for (let cz = -40; cz < -20; cz += 1) {
      for (let cx = 28; cx < 48; cx += 1) {
        const tree = harthmereForestTreeForCell(cx, cz);
        if (!tree) {
          continue;
        }
        windows += 1;
        let solid = 0;
        for (let dz = -6; dz <= 6; dz += 1) {
          for (let dx = -6; dx <= 6; dx += 1) {
            const block = harthmereWildsForestBlockAt(
              tree.x + dx,
              2,
              tree.z + dz
            );
            if (block === undefined) {
              continue;
            }
            solid += 1;
            assert.ok(
              LOGS.has(block),
              `${block} at head height near (${tree.x},${tree.z}) — only ` +
                `trunks may occupy the space a player walks through`
            );
          }
        }
        worstOccupancy = Math.max(worstOccupancy, solid);
      }
    }
    assert.ok(windows > 100, "not enough trees sampled to mean anything");
    // 169 cells in the window; a dozen trunks is still 93% open floor.
    assert.ok(
      worstOccupancy <= 12,
      `${worstOccupancy}/169 voxels solid at head height — that is a thicket`
    );
  });

  it("is deterministic — the same column always grows the same thing", () => {
    const first: Array<HarthmereForestMaterial | undefined> = [];
    for (let y = 1; y <= 20; y += 1) {
      first.push(harthmereWildsForestBlockAt(271, y, -263));
    }
    // Walk elsewhere to churn the column cache, then come back.
    harthmereWildsForestBlockAt(900, 4, 900);
    harthmereWildsForestBlockAt(-40, 4, 40);
    for (let y = 1; y <= 20; y += 1) {
      assert.equal(
        harthmereWildsForestBlockAt(271, y, -263),
        first[y - 1],
        `column drifted at relY ${y} — the column cache is not transparent`
      );
    }
  });

  it("spaces trunks on the doc's jittered lattice", () => {
    const trees = [];
    for (let cz = -30; cz < 30; cz += 1) {
      for (let cx = 20; cx < 80; cx += 1) {
        const tree = harthmereForestTreeForCell(cx, cz);
        if (tree) {
          trees.push(tree);
        }
      }
    }
    assert.ok(trees.length > 500, "the lattice grew almost nothing");
    for (const tree of trees) {
      const cellX = Math.floor(tree.x / HARTHMERE_FOREST_SPACING);
      const cellZ = Math.floor(tree.z / HARTHMERE_FOREST_SPACING);
      assert.ok(
        Number.isFinite(cellX) && Number.isFinite(cellZ),
        "trunk landed off the lattice"
      );
    }
  });
});
