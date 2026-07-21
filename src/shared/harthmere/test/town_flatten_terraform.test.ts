// Tests for HARTHMERE_TOWN_FLATTEN_TERRAFORM (flat-town fix, 2026-07-14):
// the pure edit math + safety contract behind flattening the Harthmere town
// rectangle to one ground level (audit finding: production terrain under the
// town spans Y 48–86 while the design requires completely flat land).

import assert from "assert";
import {
  HARTHMERE_TOWN_FLATTEN_AIR,
  HARTHMERE_TOWN_FLATTEN_MAX_CARVE_Y,
  HARTHMERE_TOWN_FLATTEN_MIN_FILL_Y,
  HARTHMERE_TOWN_FLATTEN_TARGET_Y,
  harthmereTownFlattenArenaExclusion,
  harthmereTownFlattenAuthoredBounds,
  harthmereTownFlattenChunks,
  harthmereTownFlattenColumnEdits,
  harthmereTownFlattenWorldBounds,
  isHarthmereTownFlattenAuthoredColumn,
  validateHarthmereTownFlattenContract,
} from "@/shared/harthmere/town_flatten_terraform";
import { HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR } from "@/shared/harthmere/bible_quest_live_authority";
import { HARTHMERE_BIBLE_DISTRICTS } from "@/shared/harthmere/harthmere_district_bible_layout";
import { BikkieIds } from "@/shared/bikkie/ids";
import { HARTHMERE_ADDITIVE_TOWN_OFFSET_X } from "@/shared/harthmere/world_extension";

describe("harthmere town flatten terraform", () => {
  it("bounds are the union of the 12 district rectangles", () => {
    const bounds = harthmereTownFlattenAuthoredBounds();
    for (const district of HARTHMERE_BIBLE_DISTRICTS) {
      assert.ok(district.bounds.minX >= bounds.minX);
      assert.ok(district.bounds.maxX <= bounds.maxX);
      assert.ok(district.bounds.minZ >= bounds.minZ);
      assert.ok(district.bounds.maxZ <= bounds.maxZ);
    }
    // World bounds = authored + the additive town X shift (Z unshifted).
    const world = harthmereTownFlattenWorldBounds();
    assert.equal(world.minX, bounds.minX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X);
    assert.equal(world.maxX, bounds.maxX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X);
    assert.equal(world.minZ, bounds.minZ);
    assert.equal(world.maxZ, bounds.maxZ);
  });

  it("safety contract passes: arena hole, road untouched, anchored target", () => {
    const contract = validateHarthmereTownFlattenContract();
    assert.deepEqual(contract.failures, []);
    assert.ok(contract.ok);
    // The dragon arena column must be refused by the flatten predicate even
    // though it sits inside the district union (Old Well / Underways).
    const [x, , z] = HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR;
    assert.equal(isHarthmereTownFlattenAuthoredColumn(x, z), false);
    // A market-core column IS flattened.
    assert.equal(isHarthmereTownFlattenAuthoredColumn(520, -250), true);
    // The connector road far west stays natural.
    assert.equal(isHarthmereTownFlattenAuthoredColumn(128, -209), false);
  });

  it("arena exclusion hole surrounds the anchor by ±16", () => {
    const hole = harthmereTownFlattenArenaExclusion();
    const [x, , z] = HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR;
    assert.deepEqual(hole, {
      minX: x - 16,
      maxX: x + 16,
      minZ: z - 16,
      maxZ: z + 16,
    });
  });

  it("already-flat columns produce zero edits (idempotent re-runs)", () => {
    assert.deepEqual(
      harthmereTownFlattenColumnEdits(500, -200, {
        surfaceY: HARTHMERE_TOWN_FLATTEN_TARGET_Y,
      }),
      []
    );
  });

  it("skips unknown and water columns (rivers keep their beds)", () => {
    assert.deepEqual(
      harthmereTownFlattenColumnEdits(500, -200, { surfaceY: undefined }),
      []
    );
    assert.deepEqual(
      harthmereTownFlattenColumnEdits(500, -200, {
        surfaceY: 70,
        isWater: true,
      }),
      []
    );
  });

  it("carves high columns down to the target and re-caps with grass", () => {
    const surfaceY = HARTHMERE_TOWN_FLATTEN_TARGET_Y + 6;
    const edits = harthmereTownFlattenColumnEdits(500, -200, { surfaceY });
    const carves = edits.filter((edit) => edit.label === "carve");
    const caps = edits.filter((edit) => edit.label === "cap");
    // Six blocks above target produce six carve layers plus one grass cap.
    assert.equal(carves.length, 6);
    assert.ok(
      carves.every(
        (edit) =>
          edit.value === HARTHMERE_TOWN_FLATTEN_AIR &&
          edit.position[1] > HARTHMERE_TOWN_FLATTEN_TARGET_Y
      )
    );
    assert.equal(caps.length, 1);
    assert.equal(caps[0].value, BikkieIds.grass);
    assert.equal(caps[0].position[1], HARTHMERE_TOWN_FLATTEN_TARGET_Y);
  });

  it("fills low columns up to the target with dirt under a grass cap", () => {
    const surfaceY = HARTHMERE_TOWN_FLATTEN_TARGET_Y - 6;
    const edits = harthmereTownFlattenColumnEdits(500, -200, { surfaceY });
    const fills = edits.filter((edit) => edit.label === "fill");
    // Five dirt layers fill the gap below the grass cap.
    assert.equal(fills.length, 5);
    assert.ok(fills.every((edit) => edit.value === BikkieIds.dirt));
    assert.ok(
      fills.every(
        (edit) =>
          edit.position[1] > surfaceY &&
          edit.position[1] < HARTHMERE_TOWN_FLATTEN_TARGET_Y
      )
    );
    assert.equal(edits.filter((edit) => edit.label === "cap").length, 1);
  });

  it("caps runaway columns at the carve/fill safety bounds", () => {
    const tall = harthmereTownFlattenColumnEdits(500, -200, { surfaceY: 200 });
    assert.ok(
      tall
        .filter((edit) => edit.label === "carve")
        .every((edit) => edit.position[1] <= HARTHMERE_TOWN_FLATTEN_MAX_CARVE_Y)
    );
    const deep = harthmereTownFlattenColumnEdits(500, -200, { surfaceY: 10 });
    assert.ok(
      deep
        .filter((edit) => edit.label === "fill")
        .every((edit) => edit.position[1] >= HARTHMERE_TOWN_FLATTEN_MIN_FILL_Y)
    );
  });

  it("chunks tile the world rectangle exactly and resumably", () => {
    const chunks = harthmereTownFlattenChunks(32);
    const bounds = harthmereTownFlattenWorldBounds();
    assert.ok(chunks.length > 0);
    // Every chunk stays inside the rectangle; ids are stable for resume.
    for (const chunk of chunks) {
      assert.ok(chunk.minX >= bounds.minX && chunk.maxX <= bounds.maxX);
      assert.ok(chunk.minZ >= bounds.minZ && chunk.maxZ <= bounds.maxZ);
      assert.equal(chunk.chunkId, `town_flatten:${chunk.minX}:${chunk.minZ}`);
    }
    // The union of chunk columns covers every column of the rectangle.
    const covered = new Set<string>();
    for (const chunk of chunks) {
      for (let x = chunk.minX; x <= chunk.maxX; x++) {
        for (let z = chunk.minZ; z <= chunk.maxZ; z++) {
          covered.add(`${x}:${z}`);
        }
      }
    }
    const expected =
      (bounds.maxX - bounds.minX + 1) * (bounds.maxZ - bounds.minZ + 1);
    assert.equal(covered.size, expected);
  });
});
