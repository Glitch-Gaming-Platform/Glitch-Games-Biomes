/// <reference types="mocha" />

import {
  harthmereMuckCreatureAssetKeyForLabelV1,
} from "@/shared/harthmere/muck_creature_assets_v1";
import assetVersions from "@/galois/interface/gen/asset_versions.json";
import { HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1 } from "@/shared/harthmere/live_entity_production_seed_v1";
import assert from "assert";

describe("harthmere muck creature npc assets", () => {
  it("routes Muckers and Hexes to authored creature GLTF assets", () => {
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("Road Muckwad 14"),
      "npcs/seedy_muckling"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("West Breach Muckling 1"),
      "npcs/jugger_mucker"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("Gravewood Pale Hexer 7"),
      "npcs/purple_hexer"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("Watchtower Lesser Hexer 7"),
      "npcs/brown_hexer"
    );
  });

  it("does not steal player-like NPCs, robots, or business owners", () => {
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("Billy Rhodes"),
      undefined
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("West Muck Breach Sentinel"),
      undefined
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabelV1("Greenlamp Walk-In Clinic owner"),
      undefined
    );
  });

  it("has an existing asset URL for every production Muck monster seed", () => {
    for (const seed of HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1) {
      const assetKey = harthmereMuckCreatureAssetKeyForLabelV1(
        seed.displayName
      );
      assert.ok(assetKey, `${seed.displayName} should resolve to an asset`);
      assert.ok(
        (assetVersions.paths as Record<string, string | undefined>)[assetKey],
        `${seed.displayName} missing asset URL ${assetKey}`
      );
    }
  });
});
