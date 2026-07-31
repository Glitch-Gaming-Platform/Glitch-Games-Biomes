import assert from "assert";
import { getHarthmereItemDisplay } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { HARTHMERE_VENDOR_CATALOG } from "@/shared/harthmere/harthmere_vendor_catalog";
import {
  HARTHMERE_CRAFTING_TOOLS,
  ensureHarthmereProductionCraftingCatalogue,
} from "@/shared/harthmere/mmo_crafting_catalogue";
import { HARTHMERE_NATIVE_ITEM_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import { HARTHMERE_ENERGY_WEAPONS } from "@/shared/harthmere/energy_weapon_catalog";
import {
  HARTHMERE_PREMIUM_WEAPONS,
  HARTHMERE_PREMIUM_WEAPON_VENDOR_STOCK,
} from "@/shared/harthmere/premium_weapon_catalog";
import { getHarthmereItemDefinition } from "@/shared/harthmere/mmo_inventory_authority";
import { harthmereBiscuitForItemDefinition } from "@/shared/harthmere/harthmere_native_bikkie_items";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import {
  HARTHMERE_GENERATED_INVENTORY_ICON_URLS,
  harthmereGeneratedInventoryIconUrl,
} from "@/shared/harthmere/generated/harthmere_inventory_icon_manifest";

describe("Harthmere native item presentation", () => {
  it("uses Blender-rendered icons for generic and mismatched inventory items", () => {
    for (const itemId of ["antidote", "iron_ore", "bear_fat"]) {
      const expected = harthmereGeneratedInventoryIconUrl(itemId);
      assert.ok(expected, itemId);
      const display = getHarthmereItemDisplay(itemId);
      assert.ok(display, itemId);
      assert.equal(display.icon, expected, itemId);
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
          securityExclusiveIds.has(stock.itemId)
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
