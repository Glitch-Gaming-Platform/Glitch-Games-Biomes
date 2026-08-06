import {
  HARTHMERE_EXTENSION_SHARD_SIZE,
  HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_BASE,
  HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_LIMIT,
  HARTHMERE_EXTENSION_TERRAIN_ID_GRID,
  HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
  harthmereExtensionTerrainEntityIdForShard,
} from "@/shared/harthmere/world_extension";

export const HARTHMERE_EXACT_TERRAIN_OVERLAP_REPAIR_VERSION =
  "harthmere-exact-terrain-overlap-repair-v1" as const;

export type HarthmereTerrainBox = {
  readonly v0: readonly [number, number, number];
  readonly v1: readonly [number, number, number];
};

export type HarthmereTerrainIdentityRow = {
  readonly id: number;
  readonly box: HarthmereTerrainBox;
  readonly diffBytes?: number;
};

export type HarthmereExactTerrainOverlapCandidate =
  HarthmereTerrainIdentityRow & {
    readonly canonicalId: number;
    readonly shard: readonly [number, number, number];
  };

export type HarthmereUnsafeTerrainOverlap = {
  readonly id: number;
  readonly box: HarthmereTerrainBox;
  readonly reason:
    | "crosses_harthmere_boundary"
    | "misaligned_extension_box"
    | "conflicting_canonical_id";
};

const SHARD = HARTHMERE_EXTENSION_SHARD_SIZE;

function isGridCoordinate(value: number, min: number, max: number) {
  return value >= min * SHARD && value < (max + 1) * SHARD;
}

export function harthmereTerrainBoxesEqual(
  left: HarthmereTerrainBox,
  right: HarthmereTerrainBox
) {
  return (
    left.v0.every((value, index) => value === right.v0[index]) &&
    left.v1.every((value, index) => value === right.v1[index])
  );
}

export function isHarthmereShardAlignedTerrainBox(box: HarthmereTerrainBox) {
  return (
    box.v0.every((value) => Number.isInteger(value) && value % SHARD === 0) &&
    box.v1.every((value, index) => value === box.v0[index] + SHARD)
  );
}

export function harthmereTerrainBoxCrossesOriginalWorldBoundary(
  box: HarthmereTerrainBox
) {
  return (
    box.v0[0] < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X &&
    box.v1[0] > HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X
  );
}

export function isHarthmereExactTerrainOverlapAuditRow(
  row: HarthmereTerrainIdentityRow
) {
  if (harthmereTerrainBoxCrossesOriginalWorldBoundary(row.box)) {
    return true;
  }
  const { v0 } = row.box;
  return (
    isGridCoordinate(
      v0[0],
      HARTHMERE_EXTENSION_TERRAIN_ID_GRID.minShardX,
      HARTHMERE_EXTENSION_TERRAIN_ID_GRID.maxShardX
    ) &&
    isGridCoordinate(
      v0[1],
      HARTHMERE_EXTENSION_TERRAIN_ID_GRID.minShardY,
      HARTHMERE_EXTENSION_TERRAIN_ID_GRID.maxShardY
    ) &&
    isGridCoordinate(
      v0[2],
      HARTHMERE_EXTENSION_TERRAIN_ID_GRID.minShardZ,
      HARTHMERE_EXTENSION_TERRAIN_ID_GRID.maxShardZ
    )
  );
}

export function planHarthmereExactTerrainOverlapRepair(
  rows: ReadonlyArray<HarthmereTerrainIdentityRow>
): {
  readonly candidates: HarthmereExactTerrainOverlapCandidate[];
  readonly unsafe: HarthmereUnsafeTerrainOverlap[];
  readonly canonicalConflictGroups: number;
} {
  const groups = new Map<string, HarthmereTerrainIdentityRow[]>();
  const unsafe: HarthmereUnsafeTerrainOverlap[] = [];

  for (const row of rows) {
    if (harthmereTerrainBoxCrossesOriginalWorldBoundary(row.box)) {
      unsafe.push({
        id: row.id,
        box: row.box,
        reason: "crosses_harthmere_boundary",
      });
      continue;
    }
    if (!isHarthmereExactTerrainOverlapAuditRow(row)) {
      continue;
    }
    if (!isHarthmereShardAlignedTerrainBox(row.box)) {
      unsafe.push({
        id: row.id,
        box: row.box,
        reason: "misaligned_extension_box",
      });
      continue;
    }
    const shard = row.box.v0.map((value) => value / SHARD) as [
      number,
      number,
      number,
    ];
    const canonicalId = harthmereExtensionTerrainEntityIdForShard(...shard);
    if (canonicalId === undefined) {
      continue;
    }
    const key = shard.join(":");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const candidates: HarthmereExactTerrainOverlapCandidate[] = [];
  let canonicalConflictGroups = 0;
  for (const [key, group] of groups) {
    const shard = key.split(":").map(Number) as [number, number, number];
    const canonicalId = harthmereExtensionTerrainEntityIdForShard(...shard);
    if (canonicalId === undefined) {
      continue;
    }
    const canonical = group.find((row) => row.id === canonicalId);
    if (!canonical) {
      // The extension audit owns missing canonical terrain. A noncanonical-only
      // shard is not safe to delete because it could create a new world hole.
      continue;
    }
    const conflicts = group.filter((row) => row.id !== canonicalId);
    if (!conflicts.length) {
      continue;
    }
    canonicalConflictGroups += 1;
    for (const row of conflicts) {
      if (
        row.id >= HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_BASE &&
        row.id < HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_LIMIT
      ) {
        unsafe.push({
          id: row.id,
          box: row.box,
          reason: "conflicting_canonical_id",
        });
        continue;
      }
      if (!harthmereTerrainBoxesEqual(row.box, canonical.box)) {
        unsafe.push({
          id: row.id,
          box: row.box,
          reason: "misaligned_extension_box",
        });
        continue;
      }
      candidates.push({
        ...row,
        canonicalId,
        shard,
      });
    }
  }

  candidates.sort((left, right) => left.id - right.id);
  return { candidates, unsafe, canonicalConflictGroups };
}
