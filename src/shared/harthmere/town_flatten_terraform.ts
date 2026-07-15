// HARTHMERE_TOWN_FLATTEN_TERRAFORM (flat-town fix, 2026-07-14)
//
// WHY THIS FILE EXISTS
// --------------------
// The 2026-07-14 systems audit measured the production terrain under the
// Harthmere town rectangle at surface Y 48–86 (median 66) — a ~38-block
// swing — while the design requirement is that the town sits on COMPLETELY
// FLAT land. ~400 renderer props default to a flat GROUND_Y and the town has
// no terraform pass of its own (business outposts DO level their own pads;
// the town core never did).
//
// This module is the PURE half of the fix: given a probe for the current
// surface height of a column, it computes the MINIMAL voxel edits that bring
// the column to the flat target level (carve above, fill below, re-cap with
// grass). Purity matters twice over:
//   1. every branch is unit-testable without redis or the voxel engine, and
//   2. the same edit math is shared by the offline apply script
//      (scripts/harthmere/flatten-harthmere-town-terrain.cjs) and any future
//      admin-tool live_mode operation.
//
// WHY AN OFFLINE SCRIPT INSTEAD OF A LIVE MUTATION
// ------------------------------------------------
// Flattening the full rectangle touches up to ~32k columns. Pushing that
// through the live_mode mutation path would rewrite the shared world blob in
// one transaction — the exact WATCH-contention failure mode audit finding 4
// diagnosed. The apply script instead edits terrain shards directly on the
// world redis (same pattern as materialize-business-outposts-redis.cjs),
// chunked and resumable, with an explicit APPLY=1 arming gate. Run it from
// the in-VNet host, then regenerate the placement map so all 1,446 grounded
// records re-anchor to the new surface (see
// docs/harthmere/TOWN_FLATTEN_RUNBOOK.md).
//
// SAFETY PROPERTIES
// -----------------
//   - The rectangle is the district-bible town envelope only; the wilds, the
//     connector road beyond the gate, and the Wyrm's Bed dragon arena
//     (authored X 640 > 620) are all OUTSIDE it and untouched.
//   - Edits are minimal deltas: already-flat columns produce zero edits, so
//     re-running the script is idempotent.
//   - Water columns are skipped (rivers keep their beds) via the probe's
//     `isWater` flag.

import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";
import { HARTHMERE_BIBLE_DISTRICTS } from "@/shared/harthmere/harthmere_district_bible_layout";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR } from "@/shared/harthmere/bible_quest_live_authority";

export const HARTHMERE_TOWN_FLATTEN_VERSION =
  "harthmere-town-flatten-terraform" as const;

/**
 * The flat town level. 64 is the modal measured surface of the town core
 * (largest bucket in the 2026-06-07 production scan; market plaza measured
 * 65, Grove board 70 — both OUTSIDE this rectangle). Renderer buildings and
 * NPCs re-ground through the shared probes, so they follow the new surface.
 */
export const HARTHMERE_TOWN_FLATTEN_TARGET_Y = 64;

/** How far above the target we carve (highest measured town surface was 86;
 * +8 margin clears overhangs without touching authored structures higher up). */
export const HARTHMERE_TOWN_FLATTEN_MAX_CARVE_Y = 94;

/** How far below the target we backfill when terrain is lower than target.
 * Terrain below (min measured 48) gets solid fill so the new surface never
 * floats over a cavity. */
export const HARTHMERE_TOWN_FLATTEN_MIN_FILL_Y = 46;

export interface HarthmereTownFlattenBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Authored town rectangle: the UNION of the 12 district-bible rectangles
 * (single source of truth for "where the town is"). Recomputed from data so
 * a district edit can never silently leave part of the town un-flattened.
 * NOTE: deliberately NOT HARTHMERE_TOWN_LAYOUT_BOUNDS — that envelope covers
 * the whole connected settlement including the wilds strip and connector
 * road, which must keep their natural terrain.
 */
export function harthmereTownFlattenAuthoredBounds(): HarthmereTownFlattenBounds {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const district of HARTHMERE_BIBLE_DISTRICTS) {
    minX = Math.min(minX, district.bounds.minX);
    maxX = Math.max(maxX, district.bounds.maxX);
    minZ = Math.min(minZ, district.bounds.minZ);
    maxZ = Math.max(maxZ, district.bounds.maxZ);
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * Exclusion hole around the Wyrm's Bed dragon chamber (Thaedryn arena).
 * The user requirement is that the dragon quest's land stays reachable
 * AS AUTHORED — the arena's silhouette terrain, eye-glow channels, and
 * approach must not be bulldozed by the town flatten. The hole is authored
 * coordinates, ±16 blocks around the canonical arena anchor.
 */
export function harthmereTownFlattenArenaExclusion(): HarthmereTownFlattenBounds {
  const [x, , z] = HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR;
  return { minX: x - 16, maxX: x + 16, minZ: z - 16, maxZ: z + 16 };
}

/** Is an authored column inside the flatten area (rectangle minus the arena
 * exclusion hole)? The apply script and tests both use this predicate. */
export function isHarthmereTownFlattenAuthoredColumn(
  x: number,
  z: number
): boolean {
  const bounds = harthmereTownFlattenAuthoredBounds();
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
    return false;
  }
  const hole = harthmereTownFlattenArenaExclusion();
  if (x >= hole.minX && x <= hole.maxX && z >= hole.minZ && z <= hole.maxZ) {
    return false;
  }
  return true;
}

/** The same rectangle in world coordinates (authored + the +512 X shift). */
export function harthmereTownFlattenWorldBounds(): HarthmereTownFlattenBounds {
  const authored = harthmereTownFlattenAuthoredBounds();
  const [minX, , minZ] = shiftHarthmereAuthoredPositionToWorld([
    authored.minX,
    0,
    authored.minZ,
  ]);
  const [maxX, , maxZ] = shiftHarthmereAuthoredPositionToWorld([
    authored.maxX,
    0,
    authored.maxZ,
  ]);
  return { minX, maxX, minZ, maxZ };
}

export interface HarthmereTownFlattenColumnProbe {
  /** Current top-most solid Y for the column, or undefined when unknown. */
  surfaceY: number | undefined;
  /** True when the column's surface is water — skipped (rivers keep beds). */
  isWater?: boolean;
}

export interface HarthmereTownFlattenEdit {
  position: [number, number, number];
  value: BiomesId;
  /** "carve" removes terrain above target; "fill" builds up to it;
   * "cap" re-surfaces the target level with grass. */
  label: "carve" | "fill" | "cap";
}

/** Air/empty voxel value used by the edit pipeline (0 = clear). */
export const HARTHMERE_TOWN_FLATTEN_AIR: BiomesId = 0 as BiomesId;

/**
 * Minimal edits for one column. Zero edits when the column is already flat
 * at the target (idempotency), or when the probe is unknown/water (safety).
 */
export function harthmereTownFlattenColumnEdits(
  x: number,
  z: number,
  probe: HarthmereTownFlattenColumnProbe,
  targetY = HARTHMERE_TOWN_FLATTEN_TARGET_Y
): HarthmereTownFlattenEdit[] {
  if (probe.surfaceY === undefined || probe.isWater) return [];
  const surfaceY = Math.trunc(probe.surfaceY);
  if (surfaceY === targetY) return []; // already flat here
  const edits: HarthmereTownFlattenEdit[] = [];
  if (surfaceY > targetY) {
    // Carve everything above the target down to it, bounded by the carve cap
    // so an authored tall structure far above terrain can never be shaved.
    const top = Math.min(surfaceY, HARTHMERE_TOWN_FLATTEN_MAX_CARVE_Y);
    for (let y = targetY + 1; y <= top; y++) {
      edits.push({
        position: [x, y, z],
        value: HARTHMERE_TOWN_FLATTEN_AIR,
        label: "carve",
      });
    }
  } else {
    // Backfill from just above the old surface to just below the target with
    // dirt, bounded below so a chasm cannot demand unbounded fill.
    const bottom = Math.max(surfaceY + 1, HARTHMERE_TOWN_FLATTEN_MIN_FILL_Y);
    for (let y = bottom; y < targetY; y++) {
      edits.push({
        position: [x, y, z],
        value: BikkieIds.dirt,
        label: "fill",
      });
    }
  }
  // Re-cap the target level with grass so the flat town reads as turf, not
  // exposed dirt/stone (also replaces whatever block was at target level
  // when carving, keeping the surface material uniform).
  edits.push({
    position: [x, targetY, z],
    value: BikkieIds.grass,
    label: "cap",
  });
  return edits;
}

export interface HarthmereTownFlattenChunk {
  chunkId: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Split the world rectangle into resumable apply chunks. The apply script
 * processes one chunk per transaction batch so a crash/stop mid-run loses at
 * most one chunk of work and the run can resume by chunk id.
 */
export function harthmereTownFlattenChunks(
  chunkSize = 32
): HarthmereTownFlattenChunk[] {
  const bounds = harthmereTownFlattenWorldBounds();
  const chunks: HarthmereTownFlattenChunk[] = [];
  for (let x = bounds.minX; x <= bounds.maxX; x += chunkSize) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += chunkSize) {
      const maxX = Math.min(x + chunkSize - 1, bounds.maxX);
      const maxZ = Math.min(z + chunkSize - 1, bounds.maxZ);
      chunks.push({
        chunkId: `town_flatten:${x}:${z}`,
        minX: x,
        maxX,
        minZ: z,
        maxZ,
      });
    }
  }
  return chunks;
}

/**
 * Contract check used by tests + audit scripts: the flatten rectangle must
 * exclude the dragon arena and the connector road, and the target level must
 * sit inside the measured terrain envelope.
 */
export function validateHarthmereTownFlattenContract(): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  const [anchorX, anchorY, anchorZ] = HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR;
  // 1. The dragon arena must be protected by the exclusion hole: the flatten
  //    predicate must refuse the anchor column and its immediate approach.
  if (isHarthmereTownFlattenAuthoredColumn(anchorX, anchorZ)) {
    failures.push("flatten predicate would bulldoze the Thaedryn arena anchor");
  }
  if (isHarthmereTownFlattenAuthoredColumn(anchorX - 8, anchorZ + 8)) {
    failures.push("flatten predicate would bulldoze the arena approach");
  }
  // 2. The connector road's far end (authored 128,-209) is west of the town
  //    rectangle — the road keeps its natural terrain outside the gate.
  if (isHarthmereTownFlattenAuthoredColumn(128, -209)) {
    failures.push("flatten rectangle swallowed the connector road");
  }
  // 3. The target level sits strictly inside the fill/carve caps so every
  //    column terminates.
  if (
    HARTHMERE_TOWN_FLATTEN_TARGET_Y <= HARTHMERE_TOWN_FLATTEN_MIN_FILL_Y ||
    HARTHMERE_TOWN_FLATTEN_TARGET_Y >= HARTHMERE_TOWN_FLATTEN_MAX_CARVE_Y
  ) {
    failures.push("target level must sit strictly inside the fill/carve caps");
  }
  // 4. Cross-module consistency: the boss anchor's ground Y and the flat
  //    town level are the same number — combat reach is 3D, so if these ever
  //    diverge the dragon floats above or sinks below the flattened ground.
  if (anchorY !== HARTHMERE_TOWN_FLATTEN_TARGET_Y) {
    failures.push(
      `arena anchor ground Y (${anchorY}) != flatten target (${HARTHMERE_TOWN_FLATTEN_TARGET_Y})`
    );
  }
  return { ok: failures.length === 0, failures };
}
