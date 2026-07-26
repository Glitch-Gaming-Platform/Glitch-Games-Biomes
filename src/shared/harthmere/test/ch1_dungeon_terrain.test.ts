/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import fs from "fs";
import path from "path";
import {
  CH1_DUNGEON_TERRAIN,
  CH1_MIN_DOOR_HEIGHT,
  CH1_MIN_HEADROOM,
  CH1_TERRAIN_MATERIALS,
  ch1DungeonAuthoredToWorld,
  ch1DungeonBlockAt,
  ch1DungeonShardSpecs,
  ch1DungeonTerrain,
  ch1DungeonWaterAt,
  ch1DungeonWorldToAuthored,
  ch1ShouldCarveAirAt,
  ch1ValidateAllDungeonTerrain,
} from "../ch1_dungeon_terrain";
import {
  CH1_DUNGEON_DECOR,
  ch1DecorAssetUrl,
  ch1DecorForDungeon,
  ch1DecorPositionToTerrainAuthored,
  ch1ValidateDungeonDecor,
} from "../ch1_dungeon_decor";
import {
  CH1_ELSEWHEN_SLOTS,
  ch1ElsewhenSlot,
  isInsideCh1ElsewhenBand,
} from "../ch1_elsewhen_region";
import { CH1_DUNGEONS } from "../ch1_dungeons";
import { CH1_DUNGEON_SECTOR_PROOFS } from "../../cutscene/promo_scenes";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

describe("ch1 dungeon terrain - structure", () => {
  it("passes full structural validation", () => {
    assert.deepEqual(ch1ValidateAllDungeonTerrain(), []);
  });

  it("passes decor validation", () => {
    assert.deepEqual(ch1ValidateDungeonDecor(), []);
  });

  it("covers every authored dungeon zone with real terrain", () => {
    // The whole point of this module: a zone that exists in the narrative but
    // has no voxels is a zone the player cannot stand in.
    for (const dungeon of CH1_DUNGEONS) {
      const terrain = ch1DungeonTerrain(dungeon.id);
      assert.ok(terrain, `${dungeon.id} has no terrain`);
      const built = new Set(terrain!.volumes.map((v) => v.zoneId));
      for (const zone of dungeon.zones) {
        assert.ok(
          built.has(zone.id),
          `${dungeon.id}/${zone.id} is authored as a zone but has no volume`
        );
      }
    }
  });

  it("meets the finished-Biomes landscape and structure density bar", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const structures = terrain.landscape.filter((feature) =>
        ["building", "wall", "column"].includes(feature.kind)
      );
      const buildings = terrain.landscape.filter(
        (feature) => feature.kind === "building"
      );
      const natural = terrain.landscape.filter((feature) =>
        ["mound", "tree"].includes(feature.kind)
      );
      assert.ok(
        structures.length >= 25,
        `${terrain.dungeonId}: land reads empty with only ${structures.length} structures`
      );
      assert.ok(
        buildings.length >= 10,
        `${terrain.dungeonId}: lore calls for a settlement, not a flat arena`
      );
      assert.ok(
        natural.length >= 8,
        `${terrain.dungeonId}: needs layered terrain/vegetation silhouettes`
      );

      const featureZones = new Set(
        terrain.landscape.map((feature) => feature.zoneId)
      );
      for (const zoneId of new Set(terrain.volumes.map((v) => v.zoneId))) {
        assert.ok(
          featureZones.has(zoneId),
          `${terrain.dungeonId}/${zoneId}: sector has no authored landmark`
        );
      }
    }
  });

  it("keeps the final winter settlement movement spine flat and continuous", () => {
    // The guide-driven final pass uses road cores and shoulders only as floor
    // replacements. Sampling the lane above ground guards against turning a
    // visual road into a collision lip that blocks the quest route.
    for (const [x0, x1, z] of [
      [292, 295, -80],
      [294, 320, -79],
      [320, 356, -89],
      [356, 416, -65],
      [416, 476, -88],
    ] as const) {
      for (let x = x0; x <= x1; x += 1) {
        assert.equal(
          ch1DungeonBlockAt("ch1_dungeon_winter", x, 1, z),
          undefined,
          `settlement path has a blocking voxel at ${x},1,${z}`
        );
      }
    }
  });

  it("keeps every final-resume camera dolly outside canonical terrain", () => {
    for (const proof of CH1_DUNGEON_SECTOR_PROOFS.filter((candidate) =>
      ["d2-sorrels-camp", "d2-ash-hall", "d2-breaking-year"].includes(
        candidate.id
      )
    )) {
      for (let step = 0; step <= 8; step += 1) {
        const t = step / 8;
        const point = proof.cameraFar.map(
          (value, axis) => value + (proof.cameraNear[axis] - value) * t
        );
        assert.equal(
          ch1DungeonBlockAt(
            proof.dungeonId,
            Math.round(point[0]),
            Math.round(point[1]),
            Math.round(point[2])
          ),
          undefined,
          `${proof.id}: camera dolly intersects terrain at ${point.join(",")}`
        );
      }
    }
  });

  it("uses only materials the server palette actually has", () => {
    const known = new Set<string>(CH1_TERRAIN_MATERIALS);
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      for (const volume of terrain.volumes) {
        assert.ok(known.has(volume.shell), `unknown shell ${volume.shell}`);
        assert.ok(known.has(volume.floor), `unknown floor ${volume.floor}`);
      }
      for (const stair of terrain.stairs) {
        assert.ok(known.has(stair.material), `unknown stair ${stair.material}`);
      }
      for (const basin of terrain.water) {
        assert.ok(known.has(basin.basinFloor));
      }
      for (const feature of terrain.landscape) {
        switch (feature.kind) {
          case "mound":
            assert.ok(known.has(feature.material));
            if (feature.capMaterial) assert.ok(known.has(feature.capMaterial));
            break;
          case "tree":
            assert.ok(known.has(feature.trunkMaterial));
            assert.ok(known.has(feature.leafMaterial));
            if (feature.snowMaterial) assert.ok(known.has(feature.snowMaterial));
            break;
          case "building":
            assert.ok(known.has(feature.wallMaterial));
            assert.ok(known.has(feature.roofMaterial));
            break;
          case "wall":
          case "column":
            assert.ok(known.has(feature.material));
            if (feature.capMaterial) assert.ok(known.has(feature.capMaterial));
            break;
        }
      }
    }
  });

  it("names materials the shim's localDevMaterials() defines", () => {
    // Guards the seam between this module and src/server/shim/main.ts. If a
    // palette key is renamed there, this fails instead of seeding air.
    const shim = fs.readFileSync(
      path.join(REPO_ROOT, "src/server/shim/main.ts"),
      "utf8"
    );
    const start = shim.indexOf("function localDevMaterials()");
    assert.ok(start > 0, "could not find localDevMaterials()");
    const block = shim.slice(start, start + 4000);
    for (const material of CH1_TERRAIN_MATERIALS) {
      assert.ok(
        new RegExp(`\\b${material}\\b`).test(block),
        `material "${material}" is not in localDevMaterials()`
      );
    }
  });
});

describe("ch1 dungeon terrain - coordinate transform", () => {
  it("round-trips authored <-> world", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const local = { x: 100, y: -5, z: 200 };
      const world = ch1DungeonAuthoredToWorld(terrain.dungeonId, local);
      const back = ch1DungeonWorldToAuthored(terrain.dungeonId, world);
      assert.deepEqual(back, local);
    }
  });

  it("never applies an offset twice", () => {
    // Recipe Step 1: "Do not apply the offset twice." A double application
    // would put desert terrain inside the winter slot.
    const desert = ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
      x: 0,
      y: 0,
      z: 0,
    });
    const slot = CH1_ELSEWHEN_SLOTS[0];
    assert.equal(desert[0], slot.minX);
    assert.ok(desert[0] < slot.maxX);
  });

  it("throws for a dungeon with no reserved slot", () => {
    assert.throws(() =>
      ch1DungeonAuthoredToWorld("ch1_dungeon_nope", { x: 0, y: 0, z: 0 })
    );
  });

  it("keeps every volume inside its own slot and the Elsewhen band", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      for (const volume of terrain.volumes) {
        for (const corner of [
          { x: volume.x0, y: volume.y0, z: volume.z0 + 256 },
          { x: volume.x1, y: volume.y1, z: volume.z1 + 256 },
        ]) {
          const world = ch1DungeonAuthoredToWorld(terrain.dungeonId, corner);
          assert.ok(
            isInsideCh1ElsewhenBand(world),
            `${terrain.dungeonId}/${volume.name} escapes the band`
          );
        }
      }
    }
  });

  it("keeps gate arrival and departure warps inside their authored rooms", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const slot = ch1ElsewhenSlot(terrain.dungeonId)!;
      assert.deepEqual(
        ch1DungeonAuthoredToWorld(terrain.dungeonId, terrain.arrival),
        slot.arrival,
        `${terrain.dungeonId}: gate arrival diverged from terrain arrival`
      );
      assert.deepEqual(
        ch1DungeonAuthoredToWorld(terrain.dungeonId, terrain.departure),
        slot.departure,
        `${terrain.dungeonId}: exit portal diverged from terrain departure`
      );
    }
  });
});

describe("ch1 dungeon terrain - voxel queries", () => {
  const desert = ch1DungeonTerrain("ch1_dungeon_desert")!;

  it("builds a floor under every walkable volume", () => {
    for (const volume of desert.volumes) {
      const midX = Math.floor((volume.x0 + volume.x1) / 2);
      const midZ = Math.floor((volume.z0 + volume.z1) / 2);
      const block = ch1DungeonBlockAt(
        "ch1_dungeon_desert",
        midX,
        volume.y0,
        midZ
      );
      assert.ok(
        block !== undefined,
        `${volume.name} has no floor at its centre — the player falls through`
      );
    }
  });

  it("builds walls on the boundary", () => {
    const volume = desert.volumes.find((v) => v.name === "hall_of_weights")!;
    // Sample the z0 wall at mid-X, not the x0 wall at mid-Z. The x0 wall is
    // shared with the cistern (whose shell wins, correctly — adjacent rooms
    // share one wall) and mid-Z is where the doorway is punched.
    const midX = Math.floor((volume.x0 + volume.x1) / 2);
    const wall = ch1DungeonBlockAt(
      "ch1_dungeon_desert",
      midX,
      volume.y0 + 2,
      volume.z0
    );
    assert.equal(wall, volume.shell);
  });

  it("lets an adjacent room own a shared wall without leaving a gap", () => {
    // Two rooms that touch share one wall voxel. Whichever volume claims it,
    // the important thing is that it is SOLID — a gap here is a hole between
    // two rooms that the player can walk through, skipping the doorway.
    const weights = desert.volumes.find((v) => v.name === "hall_of_weights")!;
    const sharedZ = weights.z0 + 4;
    const shared = ch1DungeonBlockAt(
      "ch1_dungeon_desert",
      weights.x0,
      weights.y0 + 2,
      sharedZ
    );
    assert.ok(shared !== undefined, "shared wall must be solid");
  });

  it("carves interior air", () => {
    const volume = desert.volumes.find((v) => v.name === "hall_of_weights")!;
    const midX = Math.floor((volume.x0 + volume.x1) / 2);
    const midZ = Math.floor((volume.z0 + volume.z1) / 2);
    assert.equal(
      ch1ShouldCarveAirAt("ch1_dungeon_desert", midX, volume.y0 + 2, midZ),
      true
    );
    assert.equal(
      ch1DungeonBlockAt("ch1_dungeon_desert", midX, volume.y0 + 2, midZ),
      undefined
    );
  });

  it("roofs enclosed volumes and leaves open-air ones open", () => {
    const enclosed = desert.volumes.find((v) => v.name === "seed_vault")!;
    const midX = Math.floor((enclosed.x0 + enclosed.x1) / 2);
    const midZ = Math.floor((enclosed.z0 + enclosed.z1) / 2);
    assert.ok(
      ch1DungeonBlockAt("ch1_dungeon_desert", midX, enclosed.y1 + 1, midZ) !==
        undefined,
      "an enclosed vault needs a ceiling"
    );

    const open = desert.volumes.find((v) => v.name === "the_long_flat")!;
    const openX = Math.floor((open.x0 + open.x1) / 2);
    const openZ = Math.floor((open.z0 + open.z1) / 2);
    assert.equal(
      ch1DungeonBlockAt("ch1_dungeon_desert", openX, open.y1 + 1, openZ),
      undefined,
      "the Long Walk happens under open sky"
    );
  });

  it("makes exterior sectors real lands instead of roofless box rooms", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const exteriors = terrain.volumes.filter((volume) => volume.openSides);
      assert.ok(
        exteriors.length >= 3,
        `${terrain.dungeonId}: too few exterior lands`
      );
      for (const volume of exteriors) {
        assert.equal(
          volume.openAir,
          true,
          `${volume.name}: open sides need open sky`
        );
        const z = Math.floor((volume.z0 + volume.z1) / 2);
        assert.equal(
          ch1DungeonBlockAt(terrain.dungeonId, volume.x0, volume.y0 + 2, z),
          undefined,
          `${volume.name}: exterior boundary still renders as a rectangular wall`
        );
      }
    }
  });

  it("seeds canonical dunes, snowy ridges, trees, and outdoor water", () => {
    const winter = ch1DungeonTerrain("ch1_dungeon_winter")!;
    assert.ok(desert.landscape.some((feature) => feature.kind === "mound"));
    assert.ok(desert.landscape.some((feature) => feature.kind === "tree"));
    assert.ok(winter.landscape.some((feature) => feature.kind === "mound"));
    assert.ok(
      winter.landscape.some(
        (feature) => feature.kind === "tree" && feature.snowMaterial
      )
    );
    assert.ok(desert.water.some((basin) => basin.name === "salt_market_oasis"));
    assert.ok(
      winter.water.some((basin) => basin.name === "whale_road_north_fjord")
    );
    assert.equal(ch1DungeonBlockAt("ch1_dungeon_desert", 58, 20, -30), "sand");
    assert.equal(ch1DungeonBlockAt("ch1_dungeon_winter", 31, 5, -107), "stone");
  });

  it("punches doorways clean through the shell", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      for (const cut of terrain.cuts) {
        for (let dy = 0; dy < cut.height; dy++) {
          const block = ch1DungeonBlockAt(
            terrain.dungeonId,
            cut.x,
            cut.y + dy,
            cut.z
          );
          assert.equal(
            block,
            undefined,
            `${terrain.dungeonId}/${cut.name}: sealed at height ${dy} — the ` +
              `wall won over the doorway`
          );
          assert.equal(
            ch1ShouldCarveAirAt(terrain.dungeonId, cut.x, cut.y + dy, cut.z),
            true
          );
        }
      }
    }
  });

  it("gives every doorway at least the minimum height", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      for (const cut of terrain.cuts) {
        assert.ok(
          cut.height >= CH1_MIN_DOOR_HEIGHT,
          `${cut.name} is ${cut.height} tall`
        );
      }
    }
  });

  it("gives every volume walkable headroom", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      for (const volume of terrain.volumes) {
        assert.ok(
          volume.y1 - volume.y0 >= CH1_MIN_HEADROOM,
          `${volume.name} headroom is ${volume.y1 - volume.y0}`
        );
      }
    }
  });

  it("puts a basin floor under every water body", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      for (const basin of terrain.water) {
        const midX = Math.floor((basin.x0 + basin.x1) / 2);
        const midZ = Math.floor((basin.z0 + basin.z1) / 2);
        assert.equal(
          ch1DungeonBlockAt(terrain.dungeonId, midX, basin.y0 - 1, midZ),
          basin.basinFloor,
          `${basin.name} has no basin floor — the water drains into the void`
        );
        assert.equal(
          ch1DungeonWaterAt(terrain.dungeonId, midX, basin.y0, midZ),
          true
        );
        assert.equal(
          ch1DungeonWaterAt(terrain.dungeonId, midX, basin.y1 + 4, midZ),
          false
        );
      }
    }
  });

  it("returns nothing for an unknown dungeon", () => {
    assert.equal(ch1DungeonBlockAt("nope", 0, 0, 0), undefined);
    assert.equal(ch1ShouldCarveAirAt("nope", 0, 0, 0), false);
    assert.equal(ch1DungeonWaterAt("nope", 0, 0, 0), false);
  });
});

describe("ch1 dungeon terrain - shard specs", () => {
  it("emits shard specs covering every dungeon", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      const specs = ch1DungeonShardSpecs(terrain.dungeonId);
      assert.ok(specs.length > 0, `${terrain.dungeonId} produced no shards`);
      const keys = specs.map((s) => `${s.shardX}:${s.shardY}:${s.shardZ}`);
      assert.equal(new Set(keys).size, keys.length, "duplicate shard specs");
    }
  });

  it("never emits a shard outside the Elsewhen band", () => {
    for (const terrain of CH1_DUNGEON_TERRAIN) {
      for (const spec of ch1DungeonShardSpecs(terrain.dungeonId)) {
        const blockX = spec.shardX * 32;
        assert.ok(
          blockX >= 2624 && blockX < 3648,
          `${terrain.dungeonId} shard at x=${blockX} is outside the band`
        );
      }
    }
  });

  it("does not emit shards for the other dungeon's slot", () => {
    const desertX = ch1DungeonShardSpecs("ch1_dungeon_desert").map(
      (s) => s.shardX * 32
    );
    const winterX = ch1DungeonShardSpecs("ch1_dungeon_winter").map(
      (s) => s.shardX * 32
    );
    assert.ok(Math.max(...desertX) < Math.min(...winterX) + 512);
    for (const x of desertX) {
      assert.ok(x < 3136, `desert shard at ${x} bleeds into the winter slot`);
    }
  });
});

describe("ch1 dungeon decor - the layer rule", () => {
  it("converts the legacy decor Z index exactly once into terrain space", () => {
    for (const prop of CH1_DUNGEON_DECOR) {
      const terrain = ch1DungeonTerrain(prop.dungeonId)!;
      const volume = terrain.volumes.find((entry) => entry.name === prop.volume)!;
      const authored = ch1DecorPositionToTerrainAuthored(prop.at);
      assert.equal(
        authored.z,
        prop.at.z - 256,
        `${prop.id}: legacy slot-index Z was not centred exactly once`
      );
      assert.ok(
        authored.z > volume.z0 && authored.z < volume.z1,
        `${prop.id}: converted decor Z ${authored.z} misses ${volume.name}`
      );
    }
  });

  it("references only assets that exist on disk", () => {
    for (const prop of CH1_DUNGEON_DECOR) {
      const url = ch1DecorAssetUrl(prop);
      const file = path.join(REPO_ROOT, "public", url.replace(/^\//, ""));
      assert.ok(
        fs.existsSync(file),
        `${prop.id}: missing asset ${url} (expected at ${file})`
      );
    }
  });

  it("never blocks collision", () => {
    // A blocking prop in a one-way dungeon with an escorted NPC is a soft-lock.
    const { CH1_DUNGEON_DECOR_COLLISION } =
      require("../ch1_dungeon_decor") as typeof import("../ch1_dungeon_decor");
    assert.equal(CH1_DUNGEON_DECOR_COLLISION.blocksPlayer, false);
    assert.equal(CH1_DUNGEON_DECOR_COLLISION.blocksNpc, false);
    assert.equal(CH1_DUNGEON_DECOR_COLLISION.category, "none");
  });

  it("dresses both dungeons", () => {
    assert.ok(ch1DecorForDungeon("ch1_dungeon_desert").length >= 8);
    assert.ok(ch1DecorForDungeon("ch1_dungeon_winter").length >= 8);
  });

  it("connects authored decor to the live renderer", () => {
    const renderer = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "src/client/game/renderers/local_dev/harthmere_assets.ts"
      ),
      "utf8"
    );
    assert.match(renderer, /CH1_DUNGEON_DECOR_RENDER_PIPELINE/);
    assert.match(renderer, /CH1_DUNGEON_RUNTIME_PLACEMENTS/);
    assert.match(renderer, /\.\.\.CH1_DUNGEON_RUNTIME_PLACEMENTS/);
    assert.match(
      renderer,
      /ch1DecorPositionToTerrainAuthored\(prop\.at\)/,
      "renderer must centre legacy decor Z before applying the world offset"
    );
    assert.doesNotMatch(
      renderer,
      /CH1_DUNGEON_DECOR[\s\S]{0,240}makeHarthmereNpcAppearanceConfig/,
      "dungeon props must never be routed through the procedural NPC generator"
    );
  });

  it("keeps Chapter 1 humans off the legacy Harthmere appearance generator", () => {
    const shim = fs.readFileSync(
      path.join(REPO_ROOT, "src/server/shim/main.ts"),
      "utf8"
    );
    const start = shim.indexOf("function makeLocalDevChapter1NpcChanges");
    const chapter1SeedBlock = shim.slice(start, start + 3500);
    assert.ok(start > 0, "could not find Chapter 1 NPC seed block");
    assert.doesNotMatch(chapter1SeedBlock, /makeHarthmereNpcAppearanceConfig/);
    assert.match(
      chapter1SeedBlock,
      /prepareHarthmerePlayerLikeNpcForUniqueAppearance/
    );

    const focusedSeeder = fs.readFileSync(
      path.join(REPO_ROOT, "scripts/harthmere/seed-chapter1-native-e2e.cjs"),
      "utf8"
    );
    assert.doesNotMatch(focusedSeeder, /makeHarthmereNpcAppearanceConfig/);
    assert.match(focusedSeeder, /CH1_SEED_CAST_ONLY/);
    assert.match(focusedSeeder, /CH1_SEED_TERRAIN_ONLY/);
  });

  it("lights every enclosed zone", () => {
    const lit = new Set(
      CH1_DUNGEON_DECOR.filter((p) => p.light).map((p) => p.zoneId)
    );
    assert.ok(lit.size >= 4, "dungeons are dark; they need authored light");
  });

  it("supports every prop — nothing floats", () => {
    for (const prop of CH1_DUNGEON_DECOR) {
      assert.ok(
        ["floor", "wall", "ceiling", "on_furniture", "water_surface"].includes(
          prop.support
        ),
        `${prop.id} has no support`
      );
    }
  });

  it("stays inside the memory budget", () => {
    // Chapter 1 must not quietly become a 50 MB download. Unique assets only:
    // duplicate props share geometry at runtime.
    const {
      CH1_DUNGEON_DECOR_UNIQUE_ASSET_BUDGET_BYTES,
      CH1_DUNGEON_DECOR_MAX_UNIQUE_ASSETS,
    } =
      require("../ch1_dungeon_decor") as typeof import("../ch1_dungeon_decor");

    const seen = new Set<string>();
    let totalBytes = 0;
    for (const prop of CH1_DUNGEON_DECOR) {
      const url = ch1DecorAssetUrl(prop);
      if (seen.has(url)) {
        continue;
      }
      seen.add(url);
      const file = path.join(REPO_ROOT, "public", url.replace(/^\//, ""));
      totalBytes += fs.statSync(file).size;
      // OBJ models carry a texture next to them; count it.
      const texture = file.replace(/\.obj$/, ".png");
      if (texture !== file && fs.existsSync(texture)) {
        totalBytes += fs.statSync(texture).size;
      }
    }
    assert.ok(
      seen.size <= CH1_DUNGEON_DECOR_MAX_UNIQUE_ASSETS,
      `${seen.size} unique assets exceeds the ${CH1_DUNGEON_DECOR_MAX_UNIQUE_ASSETS} cap`
    );
    assert.ok(
      totalBytes <= CH1_DUNGEON_DECOR_UNIQUE_ASSET_BUDGET_BYTES,
      `decor payload ${totalBytes} bytes exceeds the ` +
        `${CH1_DUNGEON_DECOR_UNIQUE_ASSET_BUDGET_BYTES} byte budget`
    );
  });

  it("keeps prop scales inside the vetted range for these packs", () => {
    // The business-outpost decor library scales these same packs at 0.28-1.2
    // (business_outpost_visual_decor.ts). A prop at scale 3 reads as a giant
    // raw asset; one at 0.05 disappears.
    for (const prop of CH1_DUNGEON_DECOR) {
      assert.ok(
        prop.scale >= 0.25 && prop.scale <= 1.3,
        `${prop.id}: scale ${prop.scale} is outside the vetted 0.25..1.3 range`
      );
    }
  });
});
