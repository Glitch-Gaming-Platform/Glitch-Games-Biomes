/// <reference types="mocha" />

import {
  HARTHMERE_AAA_ANIMAL_ASSET_VERSION,
  HARTHMERE_ANIMAL_ASSET_SPECS,
  harthmereAnimalAssetSpeciesForLabel,
  type HarthmereAnimalAssetSpecies,
} from "@/shared/harthmere/harthmere_animal_assets";
import {
  HARTHMERE_COMPENDIUM_ANIMAL_SEEDS,
  harthmereLiveEntitySizeForSeed,
} from "@/shared/harthmere/live_entity_production_seed";
import {
  harthmereNativeNpcBiscuit,
  harthmereNativeNpcCombatProfileForSeed,
} from "@/shared/harthmere/harthmere_native_combat";
import { HARTHMERE_REMAINING_NPCS } from "@/shared/harthmere/npc_compendium";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import { harthmereNativeBiomesIdForNpcType } from "@/shared/harthmere/harthmere_native_item_ids";
import assert from "assert";
import fs from "fs";
import path from "path";

interface AnimalGltfDocument {
  asset?: { generator?: string; version?: string };
  animations?: Array<{
    name?: string;
    channels?: unknown[];
    samplers?: unknown[];
  }>;
  buffers?: Array<{ byteLength?: number; uri?: string }>;
  materials?: Array<{
    pbrMetallicRoughness?: {
      baseColorFactor?: number[];
      metallicFactor?: number;
      roughnessFactor?: number;
    };
  }>;
  meshes?: unknown[];
  skins?: unknown[];
}

function parseGlb(filePath: string): {
  bytes: number;
  document: AnimalGltfDocument;
} {
  const data = fs.readFileSync(filePath);
  assert.equal(data.toString("ascii", 0, 4), "glTF", `${filePath} magic`);
  assert.equal(data.readUInt32LE(4), 2, `${filePath} GLB version`);
  assert.equal(data.readUInt32LE(8), data.length, `${filePath} byte length`);

  let offset = 12;
  while (offset + 8 <= data.length) {
    const length = data.readUInt32LE(offset);
    const type = data.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4e4f534a) {
      return {
        bytes: data.length,
        document: JSON.parse(
          data
            .subarray(offset, offset + length)
            .toString("utf8")
            .replace(/\0+$/g, "")
            .trim()
        ) as AnimalGltfDocument,
      };
    }
    offset += length;
  }
  throw new Error(`${filePath} has no JSON chunk`);
}

const REQUIRED_GAMEPLAY_CLIPS = [
  "Idle",
  "Walk",
  "Run",
  "Attack",
  "HitReact",
  "Death",
] as const;

const PRESERVED_NATIVE_SPECIES = new Set<HarthmereAnimalAssetSpecies>([
  "cow",
  "sheep",
  "rabbit",
]);

describe("Harthmere production animal assets", () => {
  it("keeps cow, sheep, and rabbit native while resolving every other authored animal", () => {
    for (const species of PRESERVED_NATIVE_SPECIES) {
      assert.equal(HARTHMERE_ANIMAL_ASSET_SPECS[species].assetUrl, undefined);
    }

    const animalRows = HARTHMERE_REMAINING_NPCS.filter(
      ({ category }) => category === "animal"
    );
    assert.equal(animalRows.length, 33);
    for (const animal of animalRows) {
      const species = harthmereAnimalAssetSpeciesForLabel(animal.name);
      assert.ok(species, `${animal.name} must resolve to an exact species`);
      if (!PRESERVED_NATIVE_SPECIES.has(species)) {
        assert.ok(
          HARTHMERE_ANIMAL_ASSET_SPECS[species].assetUrl,
          `${animal.name} must use a replacement GLB`
        );
      }
    }
  });

  it("publishes compact, self-contained, PBR skinned GLBs with complete gameplay clips", () => {
    const customAssets = Object.entries(HARTHMERE_ANIMAL_ASSET_SPECS).filter(
      ([, spec]) => Boolean(spec.assetUrl)
    );
    assert.equal(customAssets.length, 26);

    const manifestPath = path.join(
      process.cwd(),
      "public/assets/harthmere/glb/creatures/animals/harthmere-animal-asset-manifest.json"
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      version: number;
      quality: string;
      animals: Record<string, { url: string; clips: string[]; bytes: number }>;
    };
    assert.equal(manifest.version, 1);
    assert.equal(manifest.quality, "production-stylized-pbr");
    assert.equal(Object.keys(manifest.animals).length, customAssets.length);
    assert.ok(
      fs.existsSync(
        path.join(
          process.cwd(),
          "src/galois/data/npcs/harthmere_aaa_animals.blend"
        )
      ),
      "editable Blender source must ship with the runtime exports"
    );

    for (const [species, spec] of customAssets) {
      assert.ok(spec.assetUrl);
      const filePath = path.join(
        process.cwd(),
        "public",
        spec.assetUrl.replace(/^\/+/, "")
      );
      const { bytes, document } = parseGlb(filePath);
      const manifestEntry = manifest.animals[species];
      assert.ok(manifestEntry, `${species} manifest entry`);
      assert.equal(manifestEntry.url, spec.assetUrl);
      assert.equal(manifestEntry.bytes, bytes);
      assert.ok(bytes >= 100 * 1024, `${species} unexpectedly empty`);
      assert.ok(bytes <= 256 * 1024, `${species} exceeds the runtime budget`);
      assert.equal(document.asset?.version, "2.0");
      assert.match(document.asset?.generator ?? "", /Blender/i);
      assert.equal(document.skins?.length, 1, `${species} rig count`);
      assert.ok((document.meshes?.length ?? 0) >= 7, `${species} mesh detail`);
      assert.ok(
        (document.materials?.length ?? 0) >= 2,
        `${species} material separation`
      );
      assert.ok(
        document.materials?.every(({ pbrMetallicRoughness }) =>
          Boolean(pbrMetallicRoughness?.baseColorFactor)
        ),
        `${species} PBR materials`
      );
      assert.ok(
        document.buffers?.every(({ uri }) => uri === undefined),
        `${species} must keep buffers inside the GLB`
      );

      const clips = new Map(
        document.animations?.map((animation) => [animation.name, animation])
      );
      for (const clip of REQUIRED_GAMEPLAY_CLIPS) {
        const animation = clips.get(clip);
        assert.ok(animation, `${species} missing ${clip}`);
        assert.ok(
          (animation.channels?.length ?? 0) >= 24,
          `${species} ${clip} must animate the full rig`
        );
        assert.equal(
          animation.channels?.length,
          animation.samplers?.length,
          `${species} ${clip} channel/sampler parity`
        );
      }
      if (
        ["chicken", "songbird", "pigeon", "crow", "duck", "goose"].includes(
          species
        )
      ) {
        assert.ok(clips.has("Fly"), `${species} missing Fly`);
      }
      assert.deepEqual(
        new Set(manifestEntry.clips),
        new Set(clips.keys()),
        `${species} manifest animation list`
      );
    }
  });

  it("seeds all 30 replacement animals through the livestock ECS/Bikkie/Anima path", () => {
    assert.equal(HARTHMERE_COMPENDIUM_ANIMAL_SEEDS.length, 30);
    assert.equal(
      new Set(HARTHMERE_COMPENDIUM_ANIMAL_SEEDS.map(({ entityId }) => entityId))
        .size,
      HARTHMERE_COMPENDIUM_ANIMAL_SEEDS.length
    );

    for (const seed of HARTHMERE_COMPENDIUM_ANIMAL_SEEDS) {
      const species = seed.species as HarthmereAnimalAssetSpecies;
      const spec = HARTHMERE_ANIMAL_ASSET_SPECS[species];
      assert.ok(spec?.assetUrl, `${seed.displayName} replacement asset`);
      assert.deepEqual(harthmereLiveEntitySizeForSeed(seed), spec.size);
      assert.notDeepEqual(
        harthmereLiveEntitySizeForSeed(seed),
        HARTHMERE_ANIMAL_ASSET_SPECS.sheep.size,
        `${seed.displayName} must not inherit the sheep body`
      );

      const profile = harthmereNativeNpcCombatProfileForSeed(seed);
      assert.equal(profile.galoisPath, spec.galoisFallback);
      assert.deepEqual(profile.boxSize, spec.size);
      assert.deepEqual(
        harthmereNativeNpcBiscuit(profile, {
          boxSize: [9, 9, 9],
        } as Biscuit).boxSize,
        spec.size,
        `${seed.displayName} authored dimensions must beat borrowed presentation metadata`
      );
      assert.equal(profile.behaviorKind, "retaliate");
      assert.deepEqual(profile.aggroTrigger, { kind: "onlyIfAttacked" });
    }
  });

  it("checks in a deterministic native NPC identity for every replacement species", () => {
    for (const [species, spec] of Object.entries(
      HARTHMERE_ANIMAL_ASSET_SPECS
    )) {
      if (!spec.assetUrl) {
        continue;
      }
      const key = `livestock_${species}`;
      const nativeId = harthmereNativeBiomesIdForNpcType(key);
      assert.equal(typeof nativeId, "number", `${key} native id`);
      const profile = harthmereNativeNpcCombatProfileForSeed({
        seedId: `identity-${species}`,
        displayName: species,
        kind: "ambient_livestock",
        species,
        sizeTier: spec.sizeTier,
      });
      assert.equal(profile.key, key);
      assert.equal(profile.id, nativeId);
    }
  });

  it("optimizes chicken without changing the preserved native animal contracts", () => {
    const chicken = HARTHMERE_COMPENDIUM_ANIMAL_SEEDS.find(
      ({ species }) => species === "chicken"
    );
    assert.ok(chicken);
    const profile = harthmereNativeNpcCombatProfileForSeed(chicken);
    assert.equal(profile.galoisPath, "npcs/chicken");
    assert.deepEqual(
      profile.boxSize,
      HARTHMERE_ANIMAL_ASSET_SPECS.chicken.size
    );
    assert.equal(
      HARTHMERE_AAA_ANIMAL_ASSET_VERSION,
      "harthmere-aaa-animal-assets-v1"
    );

    for (const species of PRESERVED_NATIVE_SPECIES) {
      const nativeProfile = harthmereNativeNpcCombatProfileForSeed({
        seedId: `preserved-${species}`,
        displayName: species,
        kind: "ambient_livestock",
        species,
      });
      assert.equal(nativeProfile.boxSize, undefined);
      assert.equal(
        nativeProfile.galoisPath,
        HARTHMERE_ANIMAL_ASSET_SPECS[species].galoisFallback
      );
    }
  });
});
