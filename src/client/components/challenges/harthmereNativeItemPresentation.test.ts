import assert from "assert";
import { getHarthmereItemDisplay } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { biomesInventoryItemIcon } from "@/client/components/biomes_ui/adapters/inventoryItemPresentation";
import { HARTHMERE_VENDOR_CATALOG } from "@/shared/harthmere/harthmere_vendor_catalog";
import {
  HARTHMERE_CRAFTING_TOOLS,
  ensureHarthmereProductionCraftingCatalogue,
} from "@/shared/harthmere/mmo_crafting_catalogue";
import { HARTHMERE_NATIVE_ITEM_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import {
  HARTHMERE_ENERGY_WEAPONS,
  type HarthmereEnergyWeaponId,
} from "@/shared/harthmere/energy_weapon_catalog";
import {
  HARTHMERE_PREMIUM_WEAPONS,
  HARTHMERE_PREMIUM_WEAPON_VENDOR_STOCK,
} from "@/shared/harthmere/premium_weapon_catalog";
import { getHarthmereItemDefinition } from "@/shared/harthmere/mmo_inventory_authority";
import {
  ensureHarthmereNativeItemCatalogue,
  harthmereBiscuitForItemDefinition,
  harthmereNativePresentationSourceIdForTest,
  mergeHarthmereNativePresentationSource,
} from "@/shared/harthmere/harthmere_native_bikkie_items";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import {
  HARTHMERE_GENERATED_INVENTORY_ICON_URLS,
  harthmereGeneratedInventoryIconUrl,
} from "@/shared/harthmere/generated/harthmere_inventory_icon_manifest";
import { resolveAssetUrlUntyped } from "@/galois/interface/asset_paths";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID } from "@/shared/harthmere/native_road_ahead_contract";
import { harthmereOriginalInventoryIconUrl } from "@/shared/harthmere/original_inventory_icons";
import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";
import { BikkieIds } from "@/shared/bikkie/ids";

describe("Harthmere native item presentation", () => {
  before(() => {
    ensureHarthmereNativeItemCatalogue();
    BikkieRuntime.get().registerBiscuits(
      new Map([
        [
          NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID,
          {
            id: NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID,
            name: "muckwad",
            displayName: "Muckwad",
            galoisPath: "blocks/muckwad",
            terrainName: "muckwad",
            isBlock: true,
            action: "place",
            stackable: 99n,
          } as Biscuit,
        ],
      ])
    );
  });

  it("uses Blender-rendered icons for generic and mismatched inventory items", () => {
    for (const itemId of ["antidote", "iron_ore", "bear_fat"]) {
      const expected = harthmereGeneratedInventoryIconUrl(itemId);
      assert.ok(expected, itemId);
      const display = getHarthmereItemDisplay(itemId);
      assert.ok(display, itemId);
      assert.equal(display.icon, expected, itemId);
    }
  });

  it("resolves generated icons through semantic, numeric, and b:-prefixed native identities", () => {
    for (const [itemId, expectedIcon] of Object.entries(
      HARTHMERE_GENERATED_INVENTORY_ICON_URLS
    )) {
      const nativeId = harthmereNativeBiomesIdForItemId(itemId);
      assert.ok(nativeId, `missing native identity for ${itemId}`);
      assert.equal(harthmereGeneratedInventoryIconUrl(itemId), expectedIcon);
      assert.equal(
        harthmereGeneratedInventoryIconUrl(String(nativeId)),
        expectedIcon,
        `${itemId}: numeric identity`
      );
      assert.equal(
        harthmereGeneratedInventoryIconUrl(`b:${nativeId}`),
        expectedIcon,
        `${itemId}: b:-prefixed identity`
      );
    }
  });

  it("shows generated art for Grey Card and Raw Meat when projected from native ECS stacks", () => {
    for (const itemId of ["item_grey_card", "raw_meat"]) {
      const nativeId = harthmereNativeBiomesIdForItemId(itemId);
      assert.ok(nativeId, itemId);
      const expectedIcon = harthmereGeneratedInventoryIconUrl(itemId);
      assert.ok(expectedIcon, itemId);
      for (const runtimeItemId of [String(nativeId), `b:${nativeId}`]) {
        const display = getHarthmereItemDisplay(runtimeItemId);
        assert.ok(display, runtimeItemId);
        assert.equal(display.icon, expectedIcon, runtimeItemId);
        assert.equal(
          biomesInventoryItemIcon(runtimeItemId),
          expectedIcon,
          `${runtimeItemId}: direct inventory icon resolver`
        );
      }
    }
  });

  it("uses the original mined-voxel cube for Muckwad in inventory and hotbar presentations", () => {
    const expectedIcon = resolveAssetUrlUntyped("icons/blocks/muckwad");
    assert.ok(expectedIcon);
    assert.notEqual(
      expectedIcon,
      harthmereGeneratedInventoryIconUrl("muckwad")
    );

    for (const itemId of [
      "muckwad",
      "muckwad_voxel_block",
      String(NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID),
      `b:${NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID}`,
    ]) {
      assert.equal(biomesInventoryItemIcon(itemId), expectedIcon, itemId);
    }
    assert.equal(getHarthmereItemDisplay("muckwad")?.icon, expectedIcon);
  });

  it("restores the original detailed workstation and furniture icons", () => {
    const cases = [
      ["1534621126189448", "icons/placeables/crafting_stations/log_workbench"],
      ["1485695172010242", "icons/placeables/crafting_stations/oak_kitchen"],
      [
        "7539420629350105",
        "icons/placeables/crafting_stations/oak_tailoring_booth",
      ],
      [
        "4537020877769775",
        "icons/placeables/crafting_stations/stone_thermoblaster",
      ],
      [
        "2443541317223860",
        "icons/placeables/crafting_stations/stone_thermolite",
      ],
      ["4537020877769721", "icons/placeables/arcade_machine"],
      ["record_player", "icons/placeables/record_player"],
      ["boombox", "icons/placeables/boombox"],
      ["bench", "icons/placeables/furniture/bench"],
      [
        "harthmere_station_workbench",
        "icons/placeables/crafting_stations/log_workbench",
      ],
      ["workbench", "icons/placeables/crafting_stations/log_workbench"],
      [
        "harthmere_station_kitchen",
        "icons/placeables/crafting_stations/oak_kitchen",
      ],
      [
        "harthmere_station_tailoring_booth",
        "icons/placeables/crafting_stations/oak_tailoring_booth",
      ],
      [
        "harthmere_station_thermoblaster",
        "icons/placeables/crafting_stations/stone_thermoblaster",
      ],
      [
        "harthmere_station_thermolite",
        "icons/placeables/crafting_stations/stone_thermolite",
      ],
    ] as const;

    for (const [itemId, assetPath] of cases) {
      const expected = resolveAssetUrlUntyped(assetPath);
      assert.ok(expected, itemId);
      assert.equal(harthmereOriginalInventoryIconUrl(itemId), expected, itemId);
      assert.equal(biomesInventoryItemIcon(itemId), expected, itemId);
      assert.notEqual(
        expected,
        harthmereGeneratedInventoryIconUrl(itemId),
        `${itemId}: original art must replace the generic generated machine`
      );
      const nativeId = harthmereNativeBiomesIdForItemId(itemId);
      if (nativeId) {
        assert.equal(
          biomesInventoryItemIcon(`b:${nativeId}`),
          expected,
          `${itemId}: native ECS identity`
        );
      }
    }
  });

  it("replaces only the legacy notebook-style seeds with physical crop-specific art", () => {
    const notebookSeedIds = [
      "7539420629350027",
      "4537020877769703",
      "seed_carrot",
      "1760645252542797",
      "7565606351305683",
      "8772905953047597",
      "4537020877769718",
      "7539420629350033",
      "4537020877769691",
      "1534621126189364",
      "seed_wheat",
    ];

    for (const itemId of notebookSeedIds) {
      const generatedIcon = harthmereGeneratedInventoryIconUrl(itemId);
      assert.ok(generatedIcon, itemId);
      assert.equal(biomesInventoryItemIcon(itemId), generatedIcon, itemId);
      assert.equal(
        harthmereOriginalInventoryIconUrl(itemId),
        undefined,
        `${itemId}: do not restore the notebook icon`
      );
    }

    for (const itemId of [
      "1534621126189373", // Birch Seed
      "1534621126189376", // Oak Seed
      "4537020877769694", // Amanita Spores
    ]) {
      const generatedIcon = harthmereGeneratedInventoryIconUrl(itemId);
      assert.ok(generatedIcon, itemId);
      assert.equal(
        biomesInventoryItemIcon(itemId),
        generatedIcon,
        `${itemId}: non-notebook seed artwork stays on its existing path`
      );
    }
  });

  it("publishes generated inventory art on native biscuits without changing ECS identity", () => {
    ensureHarthmereProductionCraftingCatalogue();
    const definition = getHarthmereItemDefinition("antidote");
    assert.ok(definition);
    const biscuit = harthmereBiscuitForItemDefinition(definition, {
      icon: "donor-icon",
    } as unknown as Biscuit);
    assert.equal(
      biscuit.galoisIcon,
      harthmereGeneratedInventoryIconUrl("antidote")
    );
    assert.equal(biscuit.icon, undefined);
    assert.equal(biscuit.id, harthmereNativeBiomesIdForItemId("antidote"));
  });

  it("gives every Chapter 1 plot item a held and dropped presentation donor", () => {
    for (const item of CH1_ITEMS) {
      assert.ok(
        harthmereNativePresentationSourceIdForTest(item.id),
        `${item.id}: no world presentation donor`
      );
    }
  });

  it("repairs an existing exact item overlay with missing donor mesh attributes", () => {
    const merged = mergeHarthmereNativePresentationSource(
      {
        id: harthmereNativeBiomesIdForItemId("item_augur9_core_cell")!,
        name: "harthmere_item_augur9_core_cell",
        displayName: "Core Cell",
        galoisIcon: "/exact-core-cell-icon.png",
      } as Biscuit,
      {
        id: BikkieIds.powerCell,
        name: "power_cell",
        galoisPath: "items/power_cell",
        meshGaloisPath: "items/power_cell_mesh",
      } as Biscuit
    );
    assert.equal(merged?.galoisPath, "items/power_cell");
    assert.equal(merged?.meshGaloisPath, "items/power_cell_mesh");
    assert.equal(merged?.galoisIcon, "/exact-core-cell-icon.png");
  });

  it("keeps protected premium icon families out of the generated replacement map", () => {
    for (const weapon of HARTHMERE_PREMIUM_WEAPONS) {
      assert.equal(
        HARTHMERE_GENERATED_INVENTORY_ICON_URLS[
          weapon.id as keyof typeof HARTHMERE_GENERATED_INVENTORY_ICON_URLS
        ],
        undefined,
        weapon.id
      );
    }
  });

  it("recovers the authoritative Hoe presentation without changing its native id", () => {
    const display = getHarthmereItemDisplay(HARTHMERE_CRAFTING_TOOLS.hoe);

    assert.ok(display);
    assert.equal(display.id, HARTHMERE_CRAFTING_TOOLS.hoe);
    assert.equal(display.name, "Hoe");
    assert.equal(display.category, "tool");
    assert.equal(display.hotbarEligible, true);
    assert.doesNotMatch(display.icon, /^(?:IT\s*|\?+)$/);
    assert.doesNotMatch(display.name, /^(?:\?+|Biomes Item\b)/i);
  });

  it("recovers authoritative presentation for generated native Harthmere ids", () => {
    const nativeId = harthmereNativeBiomesIdForItemId("iron_longsword");
    assert.ok(nativeId);

    const display = getHarthmereItemDisplay(`b:${nativeId}`);
    assert.ok(display);
    assert.equal(display.id, `b:${nativeId}`);
    assert.equal(display.name, "One-Handed Sword");
    assert.equal(display.category, "weapon");
    assert.equal(
      display.icon,
      "/assets/harthmere/weapon_icons/iron_longsword.png"
    );
    assert.doesNotMatch(display.icon, /^(?:IT\s*|\?+)$/);
  });

  it("uses the authored inventory icon and equipment contract for every premium weapon", () => {
    for (const weapon of HARTHMERE_PREMIUM_WEAPONS) {
      const nativeId = harthmereNativeBiomesIdForItemId(weapon.id);
      assert.ok(nativeId, `missing native id for ${weapon.id}`);
      const display = getHarthmereItemDisplay(`b:${nativeId}`);
      assert.ok(display, `missing native display for ${weapon.id}`);
      assert.equal(display.name, weapon.label, weapon.id);
      assert.equal(display.category, "weapon", weapon.id);
      assert.equal(display.icon, weapon.inventoryIconUrl, weapon.id);
      assert.equal(display.slot, weapon.slot, weapon.id);
      assert.equal(display.hotbarEligible, true, weapon.id);
    }
  });

  it("publishes the authored icon URL on native weapon biscuits instead of a donor icon", () => {
    ensureHarthmereProductionCraftingCatalogue();
    for (const weapon of HARTHMERE_PREMIUM_WEAPONS) {
      const definition = getHarthmereItemDefinition(weapon.id);
      assert.ok(definition, weapon.id);
      const biscuit = harthmereBiscuitForItemDefinition(definition, {
        icon: "donor-icon",
      } as unknown as Biscuit);
      assert.equal(biscuit.galoisIcon, weapon.inventoryIconUrl, weapon.id);
      assert.equal(biscuit.icon, undefined, weapon.id);
    }
  });

  it("stocks every non-restricted premium weapon exactly once at both weapon vendors", () => {
    const generalVendorIds = new Set(
      HARTHMERE_PREMIUM_WEAPON_VENDOR_STOCK.map((stock) => stock.itemId)
    );
    const securityExclusiveIds = new Set(
      HARTHMERE_ENERGY_WEAPONS.map((weapon) => weapon.id)
    );
    assert.equal(
      generalVendorIds.size + securityExclusiveIds.size,
      HARTHMERE_PREMIUM_WEAPONS.length,
      "premium weapon inventory should split cleanly between general and security storefronts"
    );
    for (const offset of [7, 29] as const) {
      const vendor = HARTHMERE_VENDOR_CATALOG[offset];
      assert.ok(vendor, `missing weapon vendor ${offset}`);
      const counts = new Map<string, number>();
      for (const stock of vendor.stocks) {
        if (
          generalVendorIds.has(stock.itemId) ||
          securityExclusiveIds.has(stock.itemId as HarthmereEnergyWeaponId)
        ) {
          counts.set(stock.itemId, (counts.get(stock.itemId) ?? 0) + 1);
        }
      }
      for (const itemId of generalVendorIds) {
        assert.equal(counts.get(itemId), 1, `${vendor.name}: ${itemId}`);
      }
      for (const itemId of securityExclusiveIds) {
        assert.equal(
          counts.get(itemId),
          undefined,
          `${vendor.name} must not stock security-exclusive ${itemId}`
        );
      }
    }
  });

  it("recovers semantic presentation outside the vendor and crafting registries", () => {
    const nativeId = harthmereNativeBiomesIdForItemId("bear_fat");
    assert.ok(nativeId);

    const display = getHarthmereItemDisplay(`b:${nativeId}`);
    assert.ok(display);
    assert.equal(display.id, `b:${nativeId}`);
    assert.equal(display.name, "Bear Fat");
    assert.equal(display.category, "crafting_material");
    assert.doesNotMatch(display.icon, /^(?:IT\s*|\?+)$/);
  });

  it("humanizes every authored semantic native id instead of exposing a placeholder", () => {
    const nativeId = harthmereNativeBiomesIdForItemId("bandage");
    assert.ok(nativeId);

    const display = getHarthmereItemDisplay(`b:${nativeId}`);
    assert.ok(display);
    assert.equal(display.name, "Bandage");
    assert.doesNotMatch(display.name, /^(?:\?+|unknown|Biomes Item\b)/i);
    assert.doesNotMatch(display.icon, /^(?:IT\s*|\?+)$/);
  });

  it("keeps the complete authored native item manifest free of placeholder names", () => {
    for (const [semanticItemId, nativeId] of Object.entries(
      HARTHMERE_NATIVE_ITEM_ID_MANIFEST
    )) {
      const display = getHarthmereItemDisplay(`b:${nativeId}`);
      assert.ok(display, `missing display for ${semanticItemId}`);
      assert.doesNotMatch(
        display.name,
        /^(?:\?+|unknown(?: item)?|Biomes Item\b)/i,
        semanticItemId
      );
      assert.ok(display.icon.trim(), `missing icon for ${semanticItemId}`);
    }
  });

  it("never exposes placeholder labels for numeric native vendor stock", () => {
    const numericStockIds = new Set(
      Object.values(HARTHMERE_VENDOR_CATALOG).flatMap((vendor) =>
        vendor.stocks
          .map((stock) => stock.itemId)
          .filter((itemId) => /^\d+$/.test(itemId))
      )
    );
    assert.ok(numericStockIds.size > 0);

    for (const itemId of numericStockIds) {
      const display = getHarthmereItemDisplay(itemId);
      assert.ok(display, `missing display for native vendor item ${itemId}`);
      assert.doesNotMatch(
        display.name,
        /^(?:\?+|unknown(?: item)?|Biomes Item\b)/i,
        itemId
      );
      assert.doesNotMatch(display.icon, /^(?:IT\s*|\?+)$/, itemId);
    }
  });
});
