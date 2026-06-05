import assert from "assert";
import {
  getHarthmereBusinessShopfrontV1,
  normalizeHarthmereBusinessEconomySnapshotV1,
} from "../businessInterfaceLiveAdapter";

function openBusiness(id: string, typeId: string) {
  return {
    businessId: id,
    ownerKind: "player" as const,
    ownerId: "owner_x",
    typeId,
    name: `${typeId} Shop`,
    status: "open" as const,
    licenseClass: "basic_trade",
    licenseLevel: 2,
    propertyId: `property_${id}`,
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    inventory: {},
    storageMaxSlots: 12,
    employees: [],
    activeContracts: [],
    completedContracts: 0,
    reputation: 10,
    customerSatisfaction: 70,
    sanitationRating: 70,
    safetyRating: 68,
    serviceRadius: 2,
    priceModifiers: {},
    balanceGold: 100,
    debtGold: 0,
    upkeepGoldPerDay: 5,
    rentGoldPerDay: 3,
    wageGoldPerDay: 0,
    salesTaxRate: 0.06,
    lastTickAtMs: 1_800_000_000_000,
    createdAtMs: 1_800_000_000_000,
    updatedAtMs: 1_800_000_000_000,
    flags: {},
  };
}

describe("business shopfront surfaces BOTH blocks and furnishings", () => {
  it("customer-mode storefrontGoods includes the 5 blocks AND 4 furnishings", () => {
    const snapshot = normalizeHarthmereBusinessEconomySnapshotV1({
      businesses: { biz_clinic: openBusiness("biz_clinic", "medical_doctor") },
    } as any);
    const shop = getHarthmereBusinessShopfrontV1(snapshot, "biz_clinic", "customer");
    const goods = shop.storefrontGoods ?? [];
    // eslint-disable-next-line no-console
    console.log("STOREFRONT_GOODS", JSON.stringify(goods));
    const blocks = goods.filter((g) => g.kind === "block");
    const interior = goods.filter((g) => g.kind === "interior");
    assert.equal(blocks.length, 5, `expected 5 blocks, got ${blocks.length}`);
    assert.equal(
      interior.length,
      4,
      `expected 4 furnishings, got ${interior.length}: ${JSON.stringify(goods)}`
    );
  });
});
