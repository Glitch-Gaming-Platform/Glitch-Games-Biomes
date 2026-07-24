import assert from "assert";
import { getHarthmereItemDisplay } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { HARTHMERE_VENDOR_CATALOG } from "@/shared/harthmere/harthmere_vendor_catalog";
import { HARTHMERE_CRAFTING_TOOLS } from "@/shared/harthmere/mmo_crafting_catalogue";
import { HARTHMERE_NATIVE_ITEM_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";

describe("Harthmere native item presentation", () => {
  it("recovers the authoritative Hoe presentation without changing its native id", () => {
    const display = getHarthmereItemDisplay(HARTHMERE_CRAFTING_TOOLS.hoe);

    assert.ok(display);
    assert.equal(display.id, `b:${HARTHMERE_CRAFTING_TOOLS.hoe}`);
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
    assert.equal(display.name, "Iron Longsword");
    assert.equal(display.category, "weapon");
    assert.doesNotMatch(display.icon, /^(?:IT\s*|\?+)$/);
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
