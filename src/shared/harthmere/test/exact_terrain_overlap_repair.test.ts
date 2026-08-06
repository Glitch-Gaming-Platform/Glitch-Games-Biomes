import assert from "assert";

import {
  type HarthmereTerrainBox,
  type HarthmereTerrainIdentityRow,
  harthmereTerrainBoxCrossesOriginalWorldBoundary,
  isHarthmereShardAlignedTerrainBox,
  planHarthmereExactTerrainOverlapRepair,
} from "@/shared/harthmere/exact_terrain_overlap_repair";
import { harthmereExtensionTerrainEntityIdForShard } from "@/shared/harthmere/world_extension";

const SHARD: readonly [number, number, number] = [56, 1, -8];
const CANONICAL_ID = harthmereExtensionTerrainEntityIdForShard(...SHARD)!;
const BOX: HarthmereTerrainBox = {
  v0: [1792, 32, -256],
  v1: [1824, 64, -224],
};

function row(
  id: number,
  box: HarthmereTerrainBox = BOX,
  diffBytes = 0
): HarthmereTerrainIdentityRow {
  return { id, box, diffBytes };
}

describe("Harthmere exact terrain overlap repair", () => {
  it("deletes only a noncanonical entity with an exact canonical twin", () => {
    const plan = planHarthmereExactTerrainOverlapRepair([
      row(CANONICAL_ID, BOX, 41),
      row(1_234_567, BOX, 18),
    ]);
    assert.deepStrictEqual(plan.unsafe, []);
    assert.equal(plan.canonicalConflictGroups, 1);
    assert.deepStrictEqual(plan.candidates, [
      {
        id: 1_234_567,
        box: BOX,
        diffBytes: 18,
        canonicalId: CANONICAL_ID,
        shard: SHARD,
      },
    ]);
  });

  it("is idempotent after the duplicate is removed", () => {
    const plan = planHarthmereExactTerrainOverlapRepair([row(CANONICAL_ID)]);
    assert.deepStrictEqual(plan.candidates, []);
    assert.deepStrictEqual(plan.unsafe, []);
    assert.equal(plan.canonicalConflictGroups, 0);
  });

  it("does not delete noncanonical terrain when the canonical shard is absent", () => {
    const plan = planHarthmereExactTerrainOverlapRepair([row(1_234_567)]);
    assert.deepStrictEqual(plan.candidates, []);
    assert.deepStrictEqual(plan.unsafe, []);
  });

  it("repairs every exact duplicate in one canonical shard", () => {
    const plan = planHarthmereExactTerrainOverlapRepair([
      row(CANONICAL_ID),
      row(1_234_567),
      row(1_234_568),
    ]);
    assert.deepStrictEqual(
      plan.candidates.map(({ id }) => id),
      [1_234_567, 1_234_568]
    );
    assert.equal(plan.canonicalConflictGroups, 1);
  });

  it("refuses to retire a stable Harthmere id placed in another shard's box", () => {
    const conflictingCanonicalId = harthmereExtensionTerrainEntityIdForShard(
      57,
      1,
      -8
    )!;
    const plan = planHarthmereExactTerrainOverlapRepair([
      row(CANONICAL_ID),
      row(conflictingCanonicalId),
    ]);
    assert.deepStrictEqual(plan.candidates, []);
    assert.deepStrictEqual(plan.unsafe, [
      {
        id: conflictingCanonicalId,
        box: BOX,
        reason: "conflicting_canonical_id",
      },
    ]);
  });

  it("rejects a terrain box that physically crosses the map handoff", () => {
    const crossing: HarthmereTerrainBox = {
      v0: [1776, 32, -256],
      v1: [1808, 64, -224],
    };
    assert.ok(harthmereTerrainBoxCrossesOriginalWorldBoundary(crossing));
    const plan = planHarthmereExactTerrainOverlapRepair([
      row(1_234_567, crossing),
    ]);
    assert.deepStrictEqual(plan.candidates, []);
    assert.deepStrictEqual(plan.unsafe, [
      {
        id: 1_234_567,
        box: crossing,
        reason: "crosses_harthmere_boundary",
      },
    ]);
  });

  it("rejects a misaligned terrain box inside the extension grid", () => {
    const misaligned: HarthmereTerrainBox = {
      v0: [1793, 32, -256],
      v1: [1825, 64, -224],
    };
    assert.equal(isHarthmereShardAlignedTerrainBox(misaligned), false);
    const plan = planHarthmereExactTerrainOverlapRepair([
      row(1_234_567, misaligned),
    ]);
    assert.deepStrictEqual(plan.candidates, []);
    assert.deepStrictEqual(plan.unsafe, [
      {
        id: 1_234_567,
        box: misaligned,
        reason: "misaligned_extension_box",
      },
    ]);
  });

  it("does not mistake the adjacent original-world shard for overlap", () => {
    const originalWorldBox: HarthmereTerrainBox = {
      v0: [1760, 32, -256],
      v1: [1792, 64, -224],
    };
    assert.equal(
      harthmereTerrainBoxCrossesOriginalWorldBoundary(originalWorldBox),
      false
    );
    const plan = planHarthmereExactTerrainOverlapRepair([
      row(1_234_567, originalWorldBox),
      row(CANONICAL_ID),
    ]);
    assert.deepStrictEqual(plan.candidates, []);
    assert.deepStrictEqual(plan.unsafe, []);
  });
});
