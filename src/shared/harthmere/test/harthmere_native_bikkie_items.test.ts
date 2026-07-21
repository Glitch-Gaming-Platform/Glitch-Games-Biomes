import type { BakedBiscuitTray } from "@/server/shared/bikkie/registry";
import { conformsWith } from "@/shared/bikkie/core";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import { bikkie } from "@/shared/bikkie/schema/biomes";
import { HARTHMERE_GATHERING_AUTHORITY_NODES } from "@/shared/harthmere/gathering_node_authority";
import {
  ensureHarthmereNativeItemCatalogue,
  HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION,
  harthmereNativeBiomesIdForItemId,
  withHarthmereNativeBikkieItems,
} from "@/shared/harthmere/harthmere_native_bikkie_items";
import { allHarthmereNativeNpcCombatProfiles } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { HARTHMERE_FOOD_DEFINITIONS } from "@/shared/harthmere/mmo_farming_food_stamina";
import { HARTHMERE_MEDICAL_ITEM_DEFINITIONS } from "@/shared/harthmere/mmo_medical_health";
import {
  getHarthmereItemDefinition,
  registerHarthmereItemDefinition,
} from "@/shared/harthmere/mmo_inventory_authority";
import assert from "assert";
import type { BiomesId } from "@/shared/ids";

function tray(contents: ReadonlyMap<number, Biscuit> = new Map()) {
  return {
    id: 1,
    contents: new Map(contents),
    hashes: new Map(),
  } as BakedBiscuitTray;
}

describe("Harthmere exact native Bikkie overlay", () => {
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
    }
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
