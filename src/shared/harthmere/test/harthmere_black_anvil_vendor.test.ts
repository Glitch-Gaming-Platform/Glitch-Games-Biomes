import assert from "assert";
import {
  HARTHMERE_VENDOR_CATALOG,
  createHarthmereProductionVendorEntry,
  type HarthmereVendorProfile,
  type HarthmereVendorStockLine,
} from "../harthmere_vendor_catalog";

function requireVendor(offset: number): HarthmereVendorProfile {
  const vendor = HARTHMERE_VENDOR_CATALOG[offset];
  assert.ok(vendor, `missing Harthmere vendor offset ${offset}`);
  return vendor;
}

function requireStock(
  vendor: HarthmereVendorProfile,
  itemId: string
): HarthmereVendorStockLine {
  const stock = vendor.stocks.find((line) => line.itemId === itemId);
  assert.ok(stock, `${vendor.vendorName} must stock ${itemId}`);
  return stock;
}

describe("Black Anvil vendor catalog", () => {
  it("sells the starter bow and arrow bundle through Forge Apprentice Luth", () => {
    const mainCounter = requireVendor(29);
    const luth = requireVendor(67);

    for (const itemId of ["hunter_bow", "hunting_arrow"]) {
      assert.deepEqual(
        requireStock(luth, itemId),
        requireStock(mainCounter, itemId),
        `${itemId} should use the Black Anvil's canonical bundle and price`
      );
    }
  });

  it("registers Luth's archery stock as one bow and a forty-arrow bundle", () => {
    const luth = requireVendor(67);
    const bow = createHarthmereProductionVendorEntry(
      luth,
      requireStock(luth, "hunter_bow")
    );
    const arrows = createHarthmereProductionVendorEntry(
      luth,
      requireStock(luth, "hunting_arrow")
    );

    assert.deepEqual(
      {
        buyPrice: bow.buyPrice,
        bundleQuantity: bow.bundleQuantity,
        bundlePrice: bow.bundlePrice,
      },
      { buyPrice: 81, bundleQuantity: 1, bundlePrice: 81 }
    );
    assert.deepEqual(
      {
        buyPrice: arrows.buyPrice,
        bundleQuantity: arrows.bundleQuantity,
        bundlePrice: arrows.bundlePrice,
      },
      { buyPrice: 1, bundleQuantity: 40, bundlePrice: 40 }
    );
  });
});
