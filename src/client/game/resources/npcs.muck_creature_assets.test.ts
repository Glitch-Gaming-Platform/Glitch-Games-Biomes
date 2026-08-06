/// <reference types="mocha" />

import {
  HARTHMERE_CREATURE_STAGGER_RUNTIME_ASSET_URLS,
  HARTHMERE_INDISWORM_RUNTIME_ASSET_URL,
  harthmereMuckCreatureAssetKeyForLabel,
  harthmereMuckCreatureRuntimeAssetUrl,
} from "@/shared/harthmere/muck_creature_assets";
import assetVersions from "@/galois/interface/gen/asset_versions.json";
import { HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS } from "@/shared/harthmere/live_entity_production_seed";
import assert from "assert";
import fs from "fs";
import path from "path";

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
    assert.equal(
      HARTHMERE_INDISWORM_RUNTIME_ASSET_URL,
      "/assets/harthmere/glb/creatures/indisworm.glb"
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

  it("loads the tracked stagger-polished runtime asset for every ordinary Harthmere creature", () => {
    for (const [assetKey, url] of Object.entries(
      HARTHMERE_CREATURE_STAGGER_RUNTIME_ASSET_URLS
    )) {
      assert.equal(harthmereMuckCreatureRuntimeAssetUrl(assetKey), url);
      assert.ok(
        fs.existsSync(path.join(process.cwd(), "public", url.slice(1))),
        `${assetKey} missing tracked runtime asset ${url}`
      );
    }
    assert.equal(
      harthmereMuckCreatureRuntimeAssetUrl("npcs/indisworm"),
      HARTHMERE_INDISWORM_RUNTIME_ASSET_URL
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
