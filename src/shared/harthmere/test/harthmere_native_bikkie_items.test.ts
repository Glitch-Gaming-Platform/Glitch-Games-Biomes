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
} from "@/shared/harthmere/harthmere_native_id_manifest";
import {
  harthmereNativeBiomesIdForNpcType,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import { allHarthmereNativeNpcCombatProfiles } from "@/shared/harthmere/harthmere_native_combat_catalog";
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
import { HARTHMERE_QUEST_CATALOG } from "@/shared/harthmere/quest_compendium";
import { allCh1NativeQuestBiscuits } from "@/shared/harthmere/ch1_native_quests";
import { zrpcWebDeserialize, zrpcWebSerialize } from "@/shared/zrpc/serde";

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

  it("publishes every authored Grove and Bible quest as a native challenge", () => {
    const quests = allHarthmereNativeQuestBiscuits();
    assert.equal(
      quests.length,
      SNAPSHOT_GROVE_QUESTS.length +
        HARTHMERE_QUEST_CATALOG.length +
        allCh1NativeQuestBiscuits().length
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

  it("covers every authored gathering node and all 79 exact yield identities", () => {
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
    assert.equal(yieldIds.size, 79);
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
      assert.ok(id >= 8_650_000_000_000_000 && id < 8_690_000_000_000_000);
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
      assert.doesNotThrow(() => {
        const decoded = zrpcWebDeserialize(zrpcWebSerialize(biscuit), zBiscuit);
        assert.equal(decoded.id, id);
      }, `${biscuit.name ?? id} must match the frontend Bikkie wire schema`);
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
