/// <reference types="mocha" />

import { harthmereMuckCreatureAssetKeyForLabel } from "@/shared/harthmere/muck_creature_assets";
import assetVersions from "@/galois/interface/gen/asset_versions.json";
import { HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS } from "@/shared/harthmere/live_entity_production_seed";
import assert from "assert";

describe("harthmere muck creature npc assets", () => {
  it("routes Muckers and Hexes to authored creature GLTF assets", () => {
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Road Muckwad 14"),
      "npcs/seedy_muckling"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("West Breach Muckling 1"),
      "npcs/jugger_mucker"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Gravewood Pale Hexer 7"),
      "npcs/purple_hexer"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Watchtower Lesser Hexer 7"),
      "npcs/brown_hexer"
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Indisworm 1"),
      "npcs/indisworm"
    );
  });

  it("does not steal player-like NPCs, robots, or business owners", () => {
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Billy Rhodes"),
      undefined
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("West Muck Breach Sentinel"),
      undefined
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Mucked Restoro Bot"),
      undefined
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Archive Sentential"),
      undefined
    );
    assert.equal(
      harthmereMuckCreatureAssetKeyForLabel("Greenlamp Walk-In Clinic owner"),
      undefined
    );
  });

  it("has an existing asset URL for every production Muck monster seed", () => {
    for (const seed of HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS) {
      const assetKey = harthmereMuckCreatureAssetKeyForLabel(seed.displayName);
      assert.ok(assetKey, `${seed.displayName} should resolve to an asset`);
      assert.ok(
        (assetVersions.paths as Record<string, string | undefined>)[assetKey],
        `${seed.displayName} missing asset URL ${assetKey}`
      );
    }
  });
});
