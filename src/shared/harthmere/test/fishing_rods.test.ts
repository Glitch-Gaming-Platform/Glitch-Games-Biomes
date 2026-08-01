import assert from "assert";

import {
  ALL_FISHING_ROD_BIOMES_IDS,
  HARTHMERE_SIMPLE_FISHING_ROD_BIOMES_ID,
  SNAPSHOT_FISHING_RODS,
  hasFishingRodIdentity,
  isFishingRodItemId,
} from "@/shared/harthmere/fishing_rods";

describe("Harthmere fishing rod identities", () => {
  it("recognizes every snapshot rod in decimal and b: forms", () => {
    assert.equal(SNAPSHOT_FISHING_RODS.length, 5);
    for (const rod of SNAPSHOT_FISHING_RODS) {
      assert.equal(isFishingRodItemId(String(rod.id)), true, rod.displayName);
      assert.equal(isFishingRodItemId(`b:${rod.id}`), true, rod.displayName);
    }
  });

  it("recognizes the semantic and native Simple Fishing Rod", () => {
    assert.equal(isFishingRodItemId("simple_fishing_rod"), true);
    assert.equal(
      isFishingRodItemId(String(HARTHMERE_SIMPLE_FISHING_ROD_BIOMES_ID)),
      true
    );
    assert.equal(ALL_FISHING_ROD_BIOMES_IDS.size, 6);
  });

  it("does not accept rod-like labels or unrelated tools", () => {
    assert.equal(isFishingRodItemId("fishing_rod_upgrade"), false);
    assert.equal(isFishingRodItemId("muck_buster"), false);
    assert.equal(isFishingRodItemId(undefined), false);
  });

  it("finds rods across semantic and native inventory projections", () => {
    assert.equal(
      hasFishingRodIdentity({ itemIds: ["b:5920729553733598"] }),
      true
    );
    assert.equal(
      hasFishingRodIdentity({
        itemIds: ["rusty_pickaxe"],
        biomesItemIds: [SNAPSHOT_FISHING_RODS[4].id],
      }),
      true
    );
    assert.equal(hasFishingRodIdentity({ itemIds: ["rusty_pickaxe"] }), false);
  });
});
