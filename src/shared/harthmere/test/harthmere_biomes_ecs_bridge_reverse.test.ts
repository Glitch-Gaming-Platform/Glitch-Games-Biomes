/**
 * HARTHMERE_BIOMES_ECS_BRIDGE_REVERSE + HARTHMERE_INVENTORY_DRIFT_REPORT
 * (audit fix, 2026-07-13)
 *
 * Covers the audit finding "the item id bridge is forward-only and lossy":
 * nothing could translate a BiomesId back into the Harthmere catalogue, so
 * cross-authority flows (ECS drops, pickups, reconciliation) could not name
 * items on the Harthmere side, and nothing could detect ECS↔live inventory
 * drift. These tests pin the reverse mapping's round-trip guarantee and the
 * pure drift comparator.
 */

import assert from "assert";
import {
  biomesIdToHarthmereItemId,
  compareHarthmereLiveAndEcsInventories,
  harthmereItemIdHasCuratedBiomesMapping,
  harthmereItemIdToBiomesId,
} from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import type { BiomesId } from "@/shared/ids";

describe("HARTHMERE_BIOMES_ECS_BRIDGE_REVERSE", () => {
  it("assigns distinct exact native ids instead of semantic visual aliases", () => {
    assert.notStrictEqual(
      harthmereItemIdToBiomesId("rough_stone"),
      harthmereItemIdToBiomesId("iron_ore")
    );
    assert.notStrictEqual(
      harthmereItemIdToBiomesId("woodsman_axe"),
      harthmereItemIdToBiomesId("repair_mallet")
    );
    assert.notStrictEqual(
      harthmereItemIdToBiomesId("training_dagger"),
      harthmereItemIdToBiomesId("iron_longsword")
    );
  });

  it("unmapped BiomesIds fall back to the b:<id> namespace", () => {
    const unmapped = 123456789 as BiomesId;
    assert.strictEqual(biomesIdToHarthmereItemId(unmapped), `b:${unmapped}`);
  });

  it("round-trips: harthmereItemIdToBiomesId(biomesIdToHarthmereItemId(x)) === x", () => {
    const samples: BiomesId[] = [
      harthmereItemIdToBiomesId("rough_stone")!,
      harthmereItemIdToBiomesId("woodsman_axe")!,
      harthmereItemIdToBiomesId("muck_rake")!,
      harthmereItemIdToBiomesId("wild_berries")!,
      123456789 as BiomesId, // unmapped → b:<id> namespace
    ];
    for (const biomesId of samples) {
      const harthmereId = biomesIdToHarthmereItemId(biomesId);
      assert.ok(harthmereId, `reverse mapping must name ${biomesId}`);
      assert.strictEqual(
        harthmereItemIdToBiomesId(harthmereId),
        biomesId,
        `round-trip must hold for ${biomesId} (via ${harthmereId})`
      );
    }
  });

  it("recognizes every non-empty item id as an exact native mapping", () => {
    assert.strictEqual(
      harthmereItemIdHasCuratedBiomesMapping("rough_stone"),
      true
    );
    assert.strictEqual(harthmereItemIdHasCuratedBiomesMapping("b:12345"), true);
    assert.strictEqual(
      harthmereItemIdHasCuratedBiomesMapping("harthmere_only_item"),
      true
    );
    assert.strictEqual(
      harthmereItemIdHasCuratedBiomesMapping(undefined),
      false
    );
  });

  it("handles undefined/garbage input safely", () => {
    assert.strictEqual(biomesIdToHarthmereItemId(undefined), undefined);
    assert.strictEqual(biomesIdToHarthmereItemId(NaN as any), undefined);
  });
});

describe("HARTHMERE_INVENTORY_DRIFT_REPORT", () => {
  it("reports no drift when both authorities agree", () => {
    const drift = compareHarthmereLiveAndEcsInventories(
      { rough_stone: 3, wild_berries: 2 },
      new Map<BiomesId, number>([
        [harthmereItemIdToBiomesId("rough_stone")!, 3],
        [harthmereItemIdToBiomesId("wild_berries")!, 2],
      ])
    );
    assert.deepStrictEqual(drift, []);
  });

  it("reports live-ahead and ecs-ahead drift with signed deltas", () => {
    const drift = compareHarthmereLiveAndEcsInventories(
      { rough_stone: 5, wild_berries: 1 },
      new Map<BiomesId, number>([
        [harthmereItemIdToBiomesId("rough_stone")!, 3], // live ahead by 2
        [harthmereItemIdToBiomesId("wild_berries")!, 4], // ecs ahead by 3
      ])
    );
    const byItem = Object.fromEntries(
      drift.map((entry) => [entry.harthmereItemId, entry])
    );
    assert.strictEqual(byItem.rough_stone?.delta, 2);
    assert.strictEqual(byItem.wild_berries?.delta, -3);
  });

  it("compares formerly aliased tools independently", () => {
    const drift = compareHarthmereLiveAndEcsInventories(
      { woodsman_axe: 1, repair_mallet: 7 },
      new Map<BiomesId, number>([
        [harthmereItemIdToBiomesId("woodsman_axe")!, 0],
        [harthmereItemIdToBiomesId("repair_mallet")!, 0],
      ])
    );
    assert.deepStrictEqual(
      drift.map((entry) => entry.harthmereItemId),
      ["woodsman_axe", "repair_mallet"]
    );
  });

  it("accepts plain-object ECS counts keyed by stringified BiomesId", () => {
    const drift = compareHarthmereLiveAndEcsInventories(
      { rough_stone: 2 },
      { [String(harthmereItemIdToBiomesId("rough_stone"))]: 1 }
    );
    assert.strictEqual(drift.length, 1);
    assert.strictEqual(drift[0].delta, 1);
  });
});
