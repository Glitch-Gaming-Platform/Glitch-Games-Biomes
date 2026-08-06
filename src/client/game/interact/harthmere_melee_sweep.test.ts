import { rankHarthmereMeleeSweepHits } from "@/client/game/interact/harthmere_melee_sweep";
import { anItem } from "@/shared/game/item";
import {
  HARTHMERE_UNARMED_HIT_RADIUS,
  harthmereNativeMeleeGeometry,
} from "@/shared/harthmere/harthmere_native_combat";
import { ensureHarthmereNativeItemCatalogue } from "@/shared/harthmere/harthmere_native_bikkie_items";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import type { AABB } from "@/shared/math/types";
import assert from "assert";

function body(
  value: string,
  center: readonly [number, number, number],
  size: readonly [number, number, number] = [1, 2, 1]
) {
  const aabb: AABB = [
    [center[0] - size[0] / 2, center[1], center[2] - size[2] / 2],
    [center[0] + size[0] / 2, center[1] + size[1], center[2] + size[2] / 2],
  ];
  return { value, aabb };
}

describe("Harthmere native melee body sweep", () => {
  before(() => ensureHarthmereNativeItemCatalogue());

  it("hits an off-reticle body crossed by the visible swing", () => {
    const hits = rankHarthmereMeleeSweepHits({
      playerPosition: [0, 0, 0],
      forward: [0, -1],
      reach: 3.43,
      hitRadius: 0.67,
      timingClass: "basic",
      candidates: [body("mucker-side", [2.25, 0, -1.15], [1.4, 1.4, 1.4])],
    });
    assert.deepEqual(
      hits.map(({ value }) => value),
      ["mucker-side"],
      "the body edge, rather than the cursor/center point, owns contact"
    );
  });

  it("rejects bodies behind the player and beyond the hard reach", () => {
    const hits = rankHarthmereMeleeSweepHits({
      playerPosition: [0, 0, 0],
      forward: [0, -1],
      reach: 3.43,
      hitRadius: 0.67,
      timingClass: "basic",
      candidates: [body("behind", [0, 0, 1.1]), body("too-far", [0, 0, -4.1])],
    });
    assert.deepEqual(hits, []);
  });

  it("uses bare-hand radius and exact weapon graphic length boundaries", () => {
    const bare = harthmereNativeMeleeGeometry(undefined);
    const toolId = harthmereNativeBiomesIdForItemId("woodcutters_axe");
    const swordId = harthmereNativeBiomesIdForItemId("iron_longsword");
    const greatSwordId = harthmereNativeBiomesIdForItemId("great_sword");
    assert.ok(bare && toolId && swordId && greatSwordId);
    const tool = harthmereNativeMeleeGeometry(anItem(toolId));
    const sword = harthmereNativeMeleeGeometry(anItem(swordId));
    const greatSword = harthmereNativeMeleeGeometry(anItem(greatSwordId));
    assert.ok(tool && sword && greatSword);

    assert.equal(bare.graphicLength, 0);
    assert.equal(bare.hitRadius, HARTHMERE_UNARMED_HIT_RADIUS);
    assert.ok(bare.reach < tool.reach);
    assert.ok(tool.reach < sword.reach);
    assert.ok(sword.reach < greatSword.reach);
    assert.equal(sword.graphicLength, 1.18);
    assert.equal(greatSword.graphicLength, 1.88);

    const bareBoundary = body("bare-boundary", [0, 0, -2.3], [0.5, 2, 0.5]);
    assert.equal(
      rankHarthmereMeleeSweepHits({
        playerPosition: [0, 0, 0],
        forward: [0, -1],
        reach: bare.reach,
        hitRadius: bare.hitRadius,
        timingClass: "basic",
        candidates: [bareBoundary],
      }).length,
      0
    );
    assert.equal(
      rankHarthmereMeleeSweepHits({
        playerPosition: [0, 0, 0],
        forward: [0, -1],
        reach: tool.reach,
        hitRadius: tool.hitRadius,
        timingClass: "basic",
        candidates: [bareBoundary],
      }).length,
      1
    );

    const swordBoundary = body("sword-boundary", [0, 0, -3.35], [0.5, 2, 0.5]);
    assert.equal(
      rankHarthmereMeleeSweepHits({
        playerPosition: [0, 0, 0],
        forward: [0, -1],
        reach: tool.reach,
        hitRadius: tool.hitRadius,
        timingClass: "basic",
        candidates: [swordBoundary],
      }).length,
      0
    );
    assert.equal(
      rankHarthmereMeleeSweepHits({
        playerPosition: [0, 0, 0],
        forward: [0, -1],
        reach: sword.reach,
        hitRadius: sword.hitRadius,
        timingClass: "basic",
        candidates: [swordBoundary],
      }).length,
      1
    );
  });

  it("chooses one deterministic nearest body instead of duplicating damage", () => {
    const hits = rankHarthmereMeleeSweepHits({
      playerPosition: [0, 0, 0],
      forward: [0, -1],
      reach: 4,
      hitRadius: 0.7,
      timingClass: "heavy",
      candidates: [
        body("far-hex", [-0.4, 0, -3]),
        body("near-mucker", [1.2, 0, -1.6]),
      ],
    });
    assert.deepEqual(
      hits.map(({ value }) => value),
      ["near-mucker", "far-hex"]
    );
  });
});
