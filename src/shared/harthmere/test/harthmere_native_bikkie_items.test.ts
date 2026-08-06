import type { BakedBiscuitTray } from "@/server/shared/bikkie/registry";
import { conformsWith } from "@/shared/bikkie/core";
import { BikkieIds } from "@/shared/bikkie/ids";
import { zBiscuit, type Biscuit } from "@/shared/bikkie/schema/attributes";
import { bikkie } from "@/shared/bikkie/schema/biomes";
import { HARTHMERE_GATHERING_AUTHORITY_NODES } from "@/shared/harthmere/gathering_node_authority";
import {
  ensureHarthmereNativeItemCatalogue,
  HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION,
  harthmereNativeBiomesIdForItemId,
  withHarthmereNativeBikkieItems,
} from "@/shared/harthmere/harthmere_native_bikkie_items";
import {
  HARTHMERE_NATIVE_ITEM_ID_MANIFEST,
  HARTHMERE_NATIVE_NPC_ID_MANIFEST,
  HARTHMERE_NATIVE_RECIPE_ID_MANIFEST,
} from "@/shared/harthmere/harthmere_native_id_manifest";
import {
  harthmereNativeBiomesIdForNpcType,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import { allHarthmereNativeNpcCombatProfiles } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { listHarthmereProductionVendorEntries } from "@/shared/harthmere/harthmere_vendor_catalog";
import { HARTHMERE_FOOD_DEFINITIONS } from "@/shared/harthmere/mmo_farming_food_stamina";
import { HARTHMERE_MEDICAL_ITEM_DEFINITIONS } from "@/shared/harthmere/mmo_medical_health";
import {
  getHarthmereItemDefinition,
  registerHarthmereItemDefinition,
} from "@/shared/harthmere/mmo_inventory_authority";
import assert from "assert";
import type { BiomesId } from "@/shared/ids";
import { NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID } from "@/shared/harthmere/native_road_ahead_contract";
import { allHarthmereNativeQuestBiscuits } from "@/shared/harthmere/harthmere_native_quests";
import { SNAPSHOT_GROVE_QUESTS } from "@/shared/harthmere/snapshot_grove_content";
import { BIBLE_QUEST_CATALOG as HARTHMERE_QUEST_CATALOG } from "@/shared/harthmere/bible/bible_quest_catalog";
import { allCh1NativeQuestBiscuits } from "@/shared/harthmere/ch1_native_quests";
import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";
import { zrpcWebDeserialize, zrpcWebSerialize } from "@/shared/zrpc/serde";
import { harthmereBusinessToolListings } from "@/shared/harthmere/harthmere_business_tool_shop";
import { harthmereBusinessStorefrontListingsForType } from "@/shared/harthmere/harthmere_business_storefront_goods";
import {
  SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS,
  SNAPSHOT_GROVE_TUTORIAL_RECIPE_IDS,
} from "@/shared/harthmere/snapshot_grove_trigger_contract";
import {
  HARTHMERE_SIMPLE_FISHING_ROD_BIOMES_ID,
  SNAPSHOT_FISHING_RODS,
} from "@/shared/harthmere/fishing_rods";

function tray(contents: ReadonlyMap<number, Biscuit> = new Map()) {
  return {
    id: 1,
    contents: new Map(contents),
    hashes: new Map(),
  } as BakedBiscuitTray;
}

describe("Harthmere exact native Bikkie overlay", function () {
  // Each case rebuilds the complete generated item/quest overlay. Production
  // guardrails run concurrently with other catalog audits, so the default 5s
  // timeout can expire under load even when the same assertion completes in
  // ~2s alone. Keep a bounded catalog-sized timeout instead of weakening any
  // identity or wire-decoding assertion.
  this.timeout(15_000);
  it("publishes the Simple Fishing Rod through the full native fishing action", () => {
    const donor = {
      id: SNAPSHOT_FISHING_RODS[1].id,
      name: "Fishing Rod",
      displayName: "Fishing Rod",
      action: "fish",
      isTool: true,
      stackable: 1n,
      meshGaloisPath: "item_meshes/items/fishing_rod",
    } as Biscuit;
    const augmented = withHarthmereNativeBikkieItems(
      tray(new Map([[donor.id, donor]]))
    );
    const rod = augmented.contents.get(HARTHMERE_SIMPLE_FISHING_ROD_BIOMES_ID);
    assert.ok(rod);
    assert.equal(rod.action, "fish");
    assert.equal(rod.isTool, true);
    assert.equal(rod.hardnessClass, 2);
    assert.equal(rod.acceptsBait, true);
    assert.equal(rod.catchBarSize, 0.25);
    assert.equal(rod.lifetimeDurabilityMs, 600_000);
    assert.equal(rod.meshGaloisPath, donor.meshGaloisPath);
  });
  it("publishes River Trout into the native open-water fishing table", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    const troutId = harthmereNativeBiomesIdForItemId("river_trout");
    assert.ok(troutId);
    const trout = augmented.contents.get(troutId);
    assert.ok(trout);
    assert.equal(trout.isFish, true);
    assert.deepEqual(trout.fishLengthDistribution, {
      mean: 0.45,
      min: 0.15,
    });
    assert.deepEqual(trout.fishConditions, [
      {
        predicates: [
          { kind: "notMuck" },
          { kind: "isNormalDepthWater" },
          { kind: "inOpen" },
        ],
        probability: "common",
      },
      {
        predicates: [
          { kind: "notMuck" },
          { kind: "isShallowWater" },
          { kind: "inOpen" },
        ],
        probability: "uncommon",
      },
    ]);
  });
  it("requires every authored item and NPC identity to be checked in", () => {
    const definitions = new Map(
      ensureHarthmereNativeItemCatalogue().map((definition) => [
        definition.itemId,
        definition,
      ])
    );
    // The inventory registry is process-global and deliberately accepts
    // server-only test fixtures. Drive this native-identity audit from the
    // explicit checked-in manifest, which is the production identity source,
    // rather than treating unrelated registry fixtures as authored content.
    for (const [itemId, biomesId] of Object.entries(
      HARTHMERE_NATIVE_ITEM_ID_MANIFEST
    )) {
      assert.ok(
        definitions.has(itemId) ||
          [...definitions.keys()].some(
            (definedItemId) =>
              harthmereNativeBiomesIdForItemId(definedItemId) === biomesId
          ),
        `${itemId} has no item definition or exact-id alias`
      );
      assert.equal(harthmereNativeBiomesIdForItemId(itemId), biomesId);
    }

    for (const profile of allHarthmereNativeNpcCombatProfiles()) {
      assert.equal(
        HARTHMERE_NATIVE_NPC_ID_MANIFEST[
          profile.key as keyof typeof HARTHMERE_NATIVE_NPC_ID_MANIFEST
        ],
        profile.id
      );
      assert.equal(harthmereNativeBiomesIdForNpcType(profile.key), profile.id);
    }

    assert.equal(
      HARTHMERE_NATIVE_ITEM_ID_MANIFEST.muckwad,
      NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID
    );
    assert.equal(
      HARTHMERE_NATIVE_ITEM_ID_MANIFEST.muckwad_voxel_block,
      NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID
    );
    assert.equal(
      harthmereNativeItemIdForBiomesId(NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID),
      "muckwad"
    );
  });

  it("does not mint native identities for misspelled or renamed content", () => {
    assert.equal(harthmereNativeBiomesIdForItemId("iron_oree"), undefined);
    assert.equal(
      harthmereNativeBiomesIdForNpcType("monster_road_muckwadd"),
      undefined
    );
  });

  it("publishes both Grove tutorial crafts as exact native recipes and items", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    for (const [recipeId, outputItemId] of [
      [
        SNAPSHOT_GROVE_TUTORIAL_RECIPE_IDS.roadTorch,
        SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.roadTorch,
      ],
      [
        SNAPSHOT_GROVE_TUTORIAL_RECIPE_IDS.festivalSkewer,
        SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewer,
      ],
    ] as const) {
      const nativeRecipeId =
        HARTHMERE_NATIVE_RECIPE_ID_MANIFEST[
          recipeId as keyof typeof HARTHMERE_NATIVE_RECIPE_ID_MANIFEST
        ];
      const nativeOutputId = harthmereNativeBiomesIdForItemId(outputItemId);
      assert.ok(nativeRecipeId, `${recipeId} needs a checked-in recipe id`);
      assert.ok(nativeOutputId, `${outputItemId} needs a checked-in item id`);
      assert.equal(augmented.contents.get(nativeRecipeId)?.isRecipe, true);
      assert.ok(augmented.contents.get(nativeOutputId));
    }

    const ingredientId = harthmereNativeBiomesIdForItemId(
      SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewerIngredients
    );
    assert.ok(ingredientId, "festival ingredients need a checked-in item id");
    assert.ok(augmented.contents.get(ingredientId));
  });

  it("publishes every Grove carried quest item through native ECS", () => {
    const breadDonorId = 2_071_428_426_278_062 as BiomesId;
    const augmented = withHarthmereNativeBikkieItems(
      tray(
        new Map([
          [
            breadDonorId,
            {
              id: breadDonorId,
              name: "Bread",
              displayName: "Bread",
              stackable: 99n,
              isDroppable: true,
              galoisPath: "items/bread",
            } as Biscuit,
          ],
        ])
      )
    );

    for (const itemId of Object.values(SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS)) {
      const nativeId = harthmereNativeBiomesIdForItemId(itemId);
      assert.ok(nativeId, `${itemId} needs a checked-in native item id`);
      const definition = getHarthmereItemDefinition(itemId);
      assert.ok(definition, `${itemId} needs an inventory definition`);
      const biscuit = augmented.contents.get(nativeId);
      assert.ok(biscuit, `${itemId} needs a native Bikkie biscuit`);
      assert.ok((biscuit.stackable ?? 0n) > 0n, `${itemId} must be storable`);
    }

    for (const itemId of [
      SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.warmLoafTray,
      SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.heavyParcel,
      SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.boltCrate,
    ]) {
      const nativeId = harthmereNativeBiomesIdForItemId(itemId)!;
      assert.equal(getHarthmereItemDefinition(itemId)?.isQuestItem, true, itemId);
      assert.equal(augmented.contents.get(nativeId)?.isDroppable, undefined, itemId);
    }

    const warmTrayId = harthmereNativeBiomesIdForItemId(
      SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.warmLoafTray
    );
    assert.equal(
      augmented.contents.get(warmTrayId!)?.galoisPath,
      "items/bread"
    );
  });

  it("publishes every Chapter 1 plot item with native quest-item rules", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    for (const item of CH1_ITEMS) {
      const nativeId = harthmereNativeBiomesIdForItemId(item.id);
      assert.ok(nativeId, `${item.id} has no native identity`);
      const biscuit = augmented.contents.get(nativeId);
      assert.ok(biscuit, `${item.id} has no native biscuit`);
      assert.ok((biscuit.stackable ?? 0n) > 0n, `${item.id} is not storable`);
      assert.equal(Boolean(biscuit.isDroppable), item.droppable, item.id);
    }
  });

  it("publishes every authored Grove and Bible quest as a native challenge", () => {
    const quests = allHarthmereNativeQuestBiscuits();

    // This used to compare quests.length against the sum of the three source
    // catalogs. That assertion is tautological — allHarthmereNativeQuestBiscuits
    // IS the concatenation of those three arrays — so the only way it could
    // fail was if a catalog reported a different length on either side of the
    // comparison, which is what happened: an intermittent "167 == 136".
    //
    // The suspected mechanism is mocha's ESM fallback. Under .mocharc.fast.json
    // a test file occasionally fails to parse as CommonJS and Node re-loads it
    // through the ESM loader, which instantiates a SECOND copy of everything it
    // imports. Two copies of a quest catalog disagree, and the failure surfaces
    // wherever the two instances happen to meet.
    //
    // Rather than assert a tautology, check the properties that actually
    // matter, and name the offender if the counts ever disagree again.
    const counts = {
      grove: SNAPSHOT_GROVE_QUESTS.length,
      bible: HARTHMERE_QUEST_CATALOG.length,
      chapter1: allCh1NativeQuestBiscuits().length,
    };
    for (const [catalog, count] of Object.entries(counts)) {
      assert.ok(
        count > 0,
        `the ${catalog} quest catalog is empty — if the other catalogs are ` +
          `populated this is a duplicated-module-instance problem, not a ` +
          `content problem`
      );
    }
    assert.equal(
      quests.length,
      counts.grove + counts.bible + counts.chapter1,
      `published ${quests.length} quests but the catalogs report ` +
        `${JSON.stringify(counts)} — the two sides read different module ` +
        `instances of the same catalog`
    );
    // Stable across calls: catches lazily-mutated or memoised catalogs.
    assert.equal(
      allHarthmereNativeQuestBiscuits().length,
      quests.length,
      "quest publication is not idempotent"
    );
    assert.equal(new Set(quests.map((quest) => quest.id)).size, quests.length);
    const augmented = withHarthmereNativeBikkieItems(tray());
    for (const quest of quests) {
      const biscuit = augmented.contents.get(quest.id);
      assert.ok(biscuit?.isQuest, quest.name);
      assert.ok(biscuit?.trigger, `${quest.name} has no trigger tree`);
      assert.equal(
        conformsWith(bikkie.schema.quests.schema, biscuit),
        true,
        `${quest.name} must be discoverable through /quests`
      );
    }
  });

  it("keeps giver-less hidden discovery quests locked by default", () => {
    const hiddenTitles = new Set([
      "The Buried Bell",
      "The Doorway That Wasn’t",
      "The Singing in the Walls",
    ]);
    const hidden = allHarthmereNativeQuestBiscuits().filter((quest) =>
      hiddenTitles.has(String(quest.displayName))
    );

    assert.equal(hidden.length, hiddenTitles.size);
    for (const quest of hidden) {
      assert.equal(quest.questGiver, undefined);
      assert.equal(quest.unlock?.kind, "event");
      assert.equal((quest.unlock as any).eventKind, "challengeUnlocked");
      assert.equal(
        (quest.unlock as any).predicate?.fields?.[0]?.[1]?.value,
        quest.id
      );
    }
  });

  it("covers every authored gathering node and all 83 exact yield identities", () => {
    const definitions = new Map(
      ensureHarthmereNativeItemCatalogue().map((definition) => [
        definition.itemId,
        definition,
      ])
    );
    const yieldIds = new Set(
      HARTHMERE_GATHERING_AUTHORITY_NODES.flatMap((node) =>
        [...node.baseYield, ...node.rareYield].map((row) => row.itemId)
      )
    );

    assert.equal(HARTHMERE_GATHERING_AUTHORITY_NODES.length, 29);
    assert.equal(yieldIds.size, 83);
    for (const node of HARTHMERE_GATHERING_AUTHORITY_NODES) {
      for (const row of [...node.baseYield, ...node.rareYield]) {
        assert.ok(
          definitions.has(row.itemId),
          `${node.id} is missing ${row.itemId}`
        );
      }
    }

    const exactIds = [...yieldIds].map((itemId) => {
      const id = harthmereNativeBiomesIdForItemId(itemId);
      assert.ok(id, `${itemId} needs an exact native id`);
      assert.ok(Number.isSafeInteger(id));
      assert.ok(id >= 8_650_000_000_000_000 && id < 8_700_000_000_000_000);
      return id;
    });
    assert.equal(new Set(exactIds).size, yieldIds.size);

    const augmented = withHarthmereNativeBikkieItems(tray());
    for (const id of exactIds) {
      const biscuit = augmented.contents.get(id);
      assert.ok(biscuit, `tray is missing native item ${id}`);
      assert.equal(
        conformsWith(bikkie.schema.items.schema, biscuit),
        true,
        `${biscuit.displayName} must be discoverable through /items`
      );
    }
  });

  it("keeps semantically different items distinct", () => {
    assert.notEqual(
      harthmereNativeBiomesIdForItemId("iron_ore"),
      BikkieIds.goldOre
    );
    assert.notEqual(
      harthmereNativeBiomesIdForItemId("iron_ore"),
      harthmereNativeBiomesIdForItemId("gold_ore")
    );
    assert.notEqual(
      harthmereNativeBiomesIdForItemId("woodsman_axe"),
      harthmereNativeBiomesIdForItemId("repair_mallet")
    );
  });

  it("publishes authored furniture and stations as native ECS placeables", () => {
    const definition = ensureHarthmereNativeItemCatalogue().find(
      (entry) =>
        entry.objectMetadata?.sizeVoxels &&
        ["device", "station", "furniture", "garden", "fixture"].includes(
          entry.objectMetadata.objectKind
        )
    );
    assert.ok(definition, "expected at least one authored placeable object");
    const biscuit = withHarthmereNativeBikkieItems(tray()).contents.get(
      harthmereNativeBiomesIdForItemId(definition.itemId)!
    );
    assert.equal(biscuit?.isPlaceable, true);
    assert.deepEqual(biscuit?.boxSize, [
      definition.objectMetadata!.sizeVoxels!.width,
      definition.objectMetadata!.sizeVoxels!.height,
      definition.objectMetadata!.sizeVoxels!.depth,
    ]);
  });

  it("treats legacy Muckwad names as one exact snapshot stack", () => {
    ensureHarthmereNativeItemCatalogue();
    const canonical = getHarthmereItemDefinition("muckwad");
    assert.ok(canonical);
    if (!getHarthmereItemDefinition("muckwad_voxel_block")) {
      registerHarthmereItemDefinition({
        ...canonical,
        itemId: "muckwad_voxel_block",
        displayName: "Muckwad Voxel Block",
      });
    }

    assert.equal(
      harthmereNativeBiomesIdForItemId("muckwad"),
      harthmereNativeBiomesIdForItemId("muckwad_voxel_block")
    );
    assert.doesNotThrow(() => withHarthmereNativeBikkieItems(tray()));
  });

  it("publishes exact native NPC types with damage, aggro, drops, and trigger identity", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    const profiles = allHarthmereNativeNpcCombatProfiles();
    assert.ok(profiles.length > 3);
    assert.equal(
      new Set(profiles.map((profile) => profile.id)).size,
      profiles.length
    );

    for (const profile of profiles) {
      const biscuit = augmented.contents.get(profile.id);
      assert.ok(biscuit, `missing NPC biscuit ${profile.key}`);
      assert.doesNotThrow(
        () => zBiscuit.parse(biscuit),
        `${profile.key} must survive the frontend Bikkie decoder`
      );
      assert.equal(
        conformsWith(bikkie.schema.npcs.types.schema, biscuit),
        true,
        `${profile.key} must conform to /npcs/types`
      );
      assert.equal(
        biscuit.behavior?.damageable?.attackable,
        profile.behaviorKind !== "sentinel"
      );
      assert.equal(
        Boolean(biscuit.behavior?.chaseAttack),
        profile.attackDamage > 0
      );
      assert.equal(
        biscuit.behavior?.questGiver,
        undefined,
        `${profile.key} must omit disabled object-valued behaviors`
      );
      for (const [behaviorName, behavior] of Object.entries(
        biscuit.behavior ?? {}
      )) {
        assert.notEqual(
          typeof behavior,
          "boolean",
          `${profile.key}.${behaviorName} must be an object or absent`
        );
      }
    }
  });

  it("round-trips every generated native biscuit through the frontend wire decoder", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());

    for (const [id, biscuit] of augmented.contents) {
      assert.doesNotThrow(
        () => {
          const decoded = zrpcWebDeserialize(
            zrpcWebSerialize(biscuit),
            zBiscuit
          );
          assert.equal(decoded.id, id);
        },
        `${biscuit.name ?? id} must match the frontend Bikkie wire schema`
      );
    }
  });

  it("adopts an exact native NPC biscuit restored from Redis without overlay hashes", () => {
    const profile = allHarthmereNativeNpcCombatProfiles().find(
      (entry) => entry.key === "robot_sentinel"
    );
    assert.ok(profile);
    const restored = {
      id: profile.id,
      name: `harthmere_npc_${profile.key}`,
      displayName: "Stale Sentinel",
    } as Biscuit;

    const augmented = withHarthmereNativeBikkieItems(
      tray(new Map([[profile.id, restored]]))
    );
    const adopted = augmented.contents.get(profile.id);

    assert.equal(adopted?.name, restored.name);
    assert.equal(adopted?.displayName, profile.displayName);
    assert.ok(
      augmented.hashes
        .get(profile.id)
        ?.startsWith(`${HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION}:npc:`)
    );
  });

  it("still rejects an unrelated biscuit at a native NPC id", () => {
    const profile = allHarthmereNativeNpcCombatProfiles()[0];
    assert.ok(profile);
    const unrelated = {
      id: profile.id,
      name: "unrelated_snapshot_npc",
      displayName: "Unrelated",
    } as Biscuit;

    assert.throws(
      () =>
        withHarthmereNativeBikkieItems(
          tray(new Map([[profile.id, unrelated]]))
        ),
      /collides with unrelated_snapshot_npc/
    );
  });

  it("authors native weapon DPS and durable armor on exact item biscuits", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    const sword = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("iron_longsword")!
    );
    const bow = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("hunter_bow")!
    );
    const armor = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("leather_armor")!
    );

    assert.ok(sword?.dps && sword.dps > 30);
    assert.ok(sword?.lifetimeDurabilityMs);
    assert.equal(sword?.isTool, true);
    assert.ok(bow?.dps && bow.dps > 0);
    assert.equal(armor?.isWearable, true);
    assert.equal(armor?.wearAsTop, true);
    assert.ok(armor?.lifetimeDurabilityMs);
  });

  it("publishes native recovery actions for edible, medical, and mana items only", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    for (const food of Object.values(HARTHMERE_FOOD_DEFINITIONS)) {
      const biscuit = augmented.contents.get(
        harthmereNativeBiomesIdForItemId(food.itemId)!
      );
      assert.ok(biscuit, `missing ${food.itemId}`);
      assert.equal(
        biscuit.isConsumable,
        food.edible === false ? undefined : true,
        `${food.itemId} native consumption contract is wrong`
      );
    }
    for (const medical of Object.values(HARTHMERE_MEDICAL_ITEM_DEFINITIONS)) {
      const biscuit = augmented.contents.get(
        harthmereNativeBiomesIdForItemId(medical.itemId)!
      );
      assert.equal(biscuit?.isConsumable, true, medical.itemId);
      assert.equal(biscuit?.givesHealth, medical.healthRestore, medical.itemId);
    }
    const mana = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("mana_draught")!
    );
    assert.equal(mana?.isConsumable, true);
    assert.equal(mana?.action, "drink");
    assert.equal(
      augmented.contents.get(
        harthmereNativeBiomesIdForItemId("field_revival_scroll")!
      )?.isConsumable,
      undefined,
      "custom revival must not be downgraded to generic eat/drink"
    );
  });

  it("publishes local Harthmere seeds through the native farming contract", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    for (const seedItemId of ["seed_wheat", "seed_carrot", "seed_muckroot"]) {
      const seed = augmented.contents.get(
        harthmereNativeBiomesIdForItemId(seedItemId)!
      );
      assert.equal(seed?.isSeed, true, seedItemId);
      assert.equal(seed?.action, "plant", seedItemId);
      assert.deepEqual(seed?.plantableBlocks, [BikkieIds.tilledSoil]);
      assert.equal(seed?.farming?.kind, "basic", seedItemId);
      assert.ok(
        seed?.farming?.kind === "basic" && seed.farming.dropTable?.length,
        seedItemId
      );
    }
  });

  it("publishes hotbar-ready native farming tools", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    const hoe = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("7539420629350046")!
    );
    const wateringCan = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("7539420629350045")!
    );
    assert.equal(hoe?.isTool, true);
    assert.equal(hoe?.action, "till");
    assert.ok((hoe?.hardnessClass ?? 0) > 0);
    assert.equal(wateringCan?.isTool, true);
    assert.equal(wateringCan?.action, "waterPlant");
    assert.ok((wateringCan?.waterAmount ?? 0) >= 1);
  });

  it("publishes native gathering tool classes for compatible variants", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    const loggingTool = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("woodcutters_axe")!
    );
    const miningTool = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("rusty_pickaxe")!
    );
    const weaponAxe = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("woodsman_axe")!
    );

    assert.equal(loggingTool?.isTool, true);
    assert.equal(loggingTool?.isAxe, true);
    assert.equal(miningTool?.isTool, true);
    assert.equal(miningTool?.isPickaxe, true);
    assert.equal(weaponAxe?.isAxe, true);
  });

  // HARTHMERE_NATIVE_STORABLE_IDENTITY: `maxInventoryStack` is
  // `item.stackable || 0n`, so a biscuit published without `stackable` can
  // never occupy an inventory slot. The native transaction handler then routes
  // the whole grant into the ECS overflow bag, which live mode does not
  // project — the item vanishes on the next Redis rebase while the gold debit
  // stays committed. This is precisely how a bought Hoe charged 22 gold and
  // delivered nothing.
  it("keeps every published Harthmere item physically storable", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    const unstorable: string[] = [];
    for (const definition of ensureHarthmereNativeItemCatalogue()) {
      const id = harthmereNativeBiomesIdForItemId(definition.itemId);
      if (id === undefined) continue;
      const biscuit = augmented.contents.get(id);
      if (!biscuit) continue;
      if ((biscuit.stackable ?? 0n) <= 0n) {
        unstorable.push(`${definition.itemId} (${id})`);
      }
    }
    assert.deepEqual(unstorable, []);
  });

  // A vendor purchase is atomic in ECS: gold out, item in. If the item cannot
  // occupy an inventory slot the player pays and receives nothing, so every
  // sellable listing must resolve to a storable biscuit.
  it("keeps every vendor-sellable item storable", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    const unsellable = new Set<string>();
    for (const entry of listHarthmereProductionVendorEntries()) {
      const id = harthmereNativeBiomesIdForItemId(entry.itemId);
      if (id === undefined) continue;
      const biscuit = augmented.contents.get(id);
      if (!biscuit) continue;
      if ((biscuit.stackable ?? 0n) <= 0n) {
        unsellable.add(`${entry.itemId} (${id})`);
      }
    }
    assert.deepEqual([...unsellable], []);
  });

  it("publishes every business tool as a storable, visible native tool", () => {
    const presentationDonors = new Map<number, Biscuit>();
    for (const id of [
      BikkieIds.axe,
      BikkieIds.pickaxe,
      BikkieIds.muckBuster,
      BikkieIds.camera,
      SNAPSHOT_FISHING_RODS[1].id,
      // The cleanup Muck Rake deliberately borrows the real long-handled
      // Wooden Hoe presentation instead of the robot-like Muck Buster.
      1_534_621_126_189_388 as BiomesId,
    ]) {
      presentationDonors.set(id, {
        id,
        name: `business_tool_presentation_${id}`,
        galoisPath: `items/business_tool_presentation_${id}`,
      } as Biscuit);
    }
    const augmented = withHarthmereNativeBikkieItems(tray(presentationDonors));
    const missing: string[] = [];
    for (const listing of harthmereBusinessToolListings()) {
      const definition = getHarthmereItemDefinition(listing.toolItemId);
      const nativeId = harthmereNativeBiomesIdForItemId(listing.toolItemId);
      const biscuit = nativeId ? augmented.contents.get(nativeId) : undefined;
      if (
        !definition ||
        !nativeId ||
        !biscuit ||
        (biscuit.stackable ?? 0n) <= 0n ||
        biscuit.isTool !== true ||
        !(
          biscuit.icon ||
          biscuit.galoisPath ||
          biscuit.mesh ||
          biscuit.meshGaloisPath ||
          biscuit.vox ||
          biscuit.worldMesh
        )
      ) {
        missing.push(listing.toolItemId);
      }
    }
    assert.deepEqual(missing, []);
  });

  it("keeps every inventory-delivering business storefront good native and storable", () => {
    const augmented = withHarthmereNativeBikkieItems(tray());
    const missing: string[] = [];
    const businessTypes = new Set(
      harthmereBusinessToolListings().map((listing) => listing.businessType)
    );
    for (const businessType of businessTypes) {
      for (const listing of harthmereBusinessStorefrontListingsForType(
        businessType
      )) {
        if (listing.kind === "recipe_book") continue;
        const nativeId = harthmereNativeBiomesIdForItemId(listing.itemId);
        const biscuit = nativeId ? augmented.contents.get(nativeId) : undefined;
        if (!nativeId || !biscuit || (biscuit.stackable ?? 0n) <= 0n) {
          missing.push(`${businessType}:${listing.itemId}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  it("repairs a sparse snapshot biscuit that a farming tool binds to", () => {
    // The live tray carried exactly this record for the Hoe: a name and
    // nothing else. The overlay used to merge only {isTool, action,
    // hardnessClass} on top of it and publish a stack-size-zero item.
    const sparseHoe = {
      id: harthmereNativeBiomesIdForItemId("7539420629350046")!,
      name: "harthmere_7539420629350046",
    } as Biscuit;
    const augmented = withHarthmereNativeBikkieItems(
      tray(new Map([[Number(sparseHoe.id), sparseHoe]]))
    );
    const hoe = augmented.contents.get(sparseHoe.id);
    assert.ok(hoe, "hoe biscuit is published");
    assert.ok(
      (hoe?.stackable ?? 0n) > 0n,
      `hoe must be storable, got stackable=${hoe?.stackable}`
    );
    assert.equal(hoe?.isDroppable, true);
    assert.ok(hoe?.displayName);
    assert.equal(hoe?.isTool, true);
    assert.equal(hoe?.action, "till");
  });

  it("borrows the authored Wooden Hoe art for the vendor Hoe", () => {
    const woodenHoe = {
      id: 1_534_621_126_189_388 as BiomesId,
      name: "woodenHoe",
      displayName: "Wooden Hoe",
      stackable: 1n,
      isDroppable: true,
      galoisPath: "items/wooden_hoe",
      mesh: { hash: "legacy-compact-mesh" },
      vox: { hash: "legacy-compact-vox" },
    } as unknown as Biscuit;
    const sparseHoe = {
      id: harthmereNativeBiomesIdForItemId("7539420629350046")!,
      name: "harthmere_7539420629350046",
    } as Biscuit;
    const augmented = withHarthmereNativeBikkieItems(
      tray(
        new Map([
          [Number(woodenHoe.id), woodenHoe],
          [Number(sparseHoe.id), sparseHoe],
        ])
      )
    );
    const hoe = augmented.contents.get(sparseHoe.id);
    assert.equal(hoe?.galoisPath, "items/wooden_hoe");
    // Borrowing art must never rewrite the donor or the tool's own action.
    assert.equal(hoe?.action, "till");
    assert.equal(augmented.contents.get(woodenHoe.id)?.action, undefined);
  });

  it("renders the equipped Muck Rake as a long-handled hoe, not a Muck Buster robot", () => {
    const woodenHoe = {
      id: 1_534_621_126_189_388 as BiomesId,
      name: "woodenHoe",
      displayName: "Wooden Hoe",
      stackable: 1n,
      isDroppable: true,
      galoisPath: "items/wooden_hoe",
    } as unknown as Biscuit;
    const muckBuster = {
      id: BikkieIds.muckBuster,
      name: "muckBuster",
      displayName: "Muck Buster",
      stackable: 1n,
      isDroppable: true,
      galoisPath: "items/muck_buster",
    } as unknown as Biscuit;
    const augmented = withHarthmereNativeBikkieItems(
      tray(
        new Map([
          [Number(woodenHoe.id), woodenHoe],
          [Number(muckBuster.id), muckBuster],
        ])
      )
    );
    const muckRake = augmented.contents.get(
      harthmereNativeBiomesIdForItemId("muck_rake")!
    );

    assert.equal(muckRake?.galoisPath, "items/wooden_hoe");
    assert.equal(muckRake?.mesh, undefined);
    assert.equal(muckRake?.vox, undefined);
    assert.notEqual(muckRake?.galoisPath, muckBuster.galoisPath);
    assert.equal(muckRake?.displayName, "Muck Rake");
  });

  it("copies only presentation assets while preserving exact wearable ids", () => {
    const visualTop = {
      id: BikkieIds.grassyTop,
      name: "grassyTop",
      displayName: "Grassy Top",
      stackable: 1n,
      isDroppable: true,
      isWearable: true,
      wearAsTop: true,
      galoisPath: "wearables/grassy_top",
      paletteColor: "color_palettes/item_materials:green",
    } as Biscuit;
    const augmented = withHarthmereNativeBikkieItems(
      tray(new Map([[BikkieIds.grassyTop, visualTop]]))
    );
    const apronId = harthmereNativeBiomesIdForItemId("baker_apron")!;
    const apron = augmented.contents.get(apronId);

    assert.ok(apron);
    assert.equal(apron.id, apronId);
    assert.notEqual(apron.id, BikkieIds.grassyTop);
    assert.equal(apron.displayName, "Dawn Loaf Apron");
    assert.equal(apron.wearAsTop, true);
    assert.equal(apron.isWearable, true);
    assert.equal(apron.galoisPath, visualTop.galoisPath);
    assert.equal(apron.paletteColor, visualTop.paletteColor);
  });

  it("preserves explicitly numeric snapshot item ids", () => {
    const exact = {
      id: BikkieIds.pickaxe,
      name: "pickaxe",
      displayName: "Pickaxe",
      stackable: 1n,
      isDroppable: true,
    } as Biscuit;
    const augmented = withHarthmereNativeBikkieItems(
      tray(new Map([[BikkieIds.pickaxe, exact]]))
    );
    assert.strictEqual(augmented.contents.get(BikkieIds.pickaxe), exact);
  });

  it("keeps a dual-purpose snapshot food placeable while adding native eating", () => {
    const redMushroomId = Number("1534621126189838") as BiomesId;
    const exact = {
      id: redMushroomId,
      name: "redMushroom",
      displayName: "Red Mushroom",
      stackable: 99n,
      isDroppable: true,
      action: "place",
    } as Biscuit;
    const augmented = withHarthmereNativeBikkieItems(
      tray(new Map([[redMushroomId, exact]]))
    );
    const ediblePlaceable = augmented.contents.get(redMushroomId);

    assert.equal(ediblePlaceable?.action, "place");
    assert.equal(ediblePlaceable?.isConsumable, true);
  });

  it("adopts an exact authored biscuit at the deterministic native id", () => {
    ensureHarthmereNativeItemCatalogue();
    const itemId = "alcubierre_drive_core";
    const id = harthmereNativeBiomesIdForItemId(itemId)!;
    const exact = {
      id,
      name: "harthmere_alcubierre_drive_core",
      displayName: "Authored Alcubierre Drive Core",
      stackable: 1n,
      isDroppable: true,
      galoisPath: "items/alcubierre_drive_core",
    } as Biscuit;

    const augmented = withHarthmereNativeBikkieItems(
      tray(new Map([[id, exact]]))
    );
    const adopted = augmented.contents.get(id);

    assert.ok(adopted);
    assert.equal(adopted.name, exact.name);
    assert.equal(adopted.galoisPath, exact.galoisPath);
    assert.ok(
      augmented.hashes
        .get(id)
        ?.startsWith(`${HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION}:${itemId}:`)
    );
  });

  it("still rejects an unrelated biscuit at a deterministic native id", () => {
    ensureHarthmereNativeItemCatalogue();
    const itemId = "alcubierre_drive_core";
    const id = harthmereNativeBiomesIdForItemId(itemId)!;
    const unrelated = {
      id,
      name: "unrelated_snapshot_biscuit",
      displayName: "Unrelated",
      stackable: 1n,
      isDroppable: true,
    } as Biscuit;

    assert.throws(
      () => withHarthmereNativeBikkieItems(tray(new Map([[id, unrelated]]))),
      /collides with unrelated_snapshot_biscuit/
    );
  });

  it("can reapply the overlay to an unchanged prior tray", () => {
    const first = withHarthmereNativeBikkieItems(tray());
    const second = withHarthmereNativeBikkieItems(first);
    const ironId = harthmereNativeBiomesIdForItemId("iron_ore")!;
    // Other suites register isolated catalogue fixtures at process scope, so
    // this restart invariant intentionally compares the prior tray rather than
    // assuming a display label that a test fixture may have replaced.
    assert.equal(
      second.contents.get(ironId)?.displayName,
      first.contents.get(ironId)?.displayName
    );
    assert.equal(second.hashes.get(ironId), first.hashes.get(ironId));
  });
});
