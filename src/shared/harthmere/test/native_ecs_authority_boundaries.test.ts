import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { BUILDING_SYSTEM_PLOTS } from "@/shared/harthmere/building_system";
import type { HarthmereLiveModeAuthorityEnvelope } from "@/shared/harthmere/live_mode_readiness";
import {
  registerHarthmereItemDefinition,
  registerHarthmereVendorEntry,
} from "@/shared/harthmere/mmo_inventory_authority";
import {
  HARTHMERE_CARRY_WEIGHT_LIMIT,
  harthmereInventoryCarryWeight,
  harthmereInventoryEncumbranceStaminaMultiplier,
} from "@/shared/harthmere/mmo_carry_weight";
import assert from "assert";

const ACTOR = "123456789";
const NOW = 1_784_620_000_000;

function envelope(
  actionKind: HarthmereLiveModeAuthorityEnvelope["actionKind"],
  subsystem: HarthmereLiveModeAuthorityEnvelope["subsystem"],
  payload: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: `native-boundary:${actionKind}:${NOW}`,
    idempotencyKey: `native-boundary:${actionKind}:${NOW}`,
    actorId: ACTOR,
    actionKind,
    subsystem,
    source: "client_request",
    serverActorItemCounts: {},
    serverActorGold: 0,
    serverActorEquipment: {},
    serverActorKnownRecipeIds: [],
    serverActorStanding: {
      scopeId: "harthmere",
      likeability: 0,
      legal: 0,
      notoriety: 0,
      notorietyFloor: 0,
    },
    serverReceivedAtMs: NOW,
    serverTick: NOW,
    actorEntityVersion: 1,
    zoneId: "harthmere",
    payload,
    clientClaims: {},
    ...overrides,
  };
}

describe("Harthmere native ECS authority boundaries", () => {
  it("writes a standing-only law mutation through the signed ECS exchange", () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    state.law.standing.harthmere = {
      likeability: 9_999,
      legal: 9_999,
      notoriety: 9_999,
      notorietyFloor: 9_999,
    };
    const result = reduceHarthmereLiveModeBackendState(
      state,
      envelope("request_law_reputation_mutation", "law", {
        factionId: "harthmere",
        likeabilityDelta: 25,
        legalDelta: -4,
        notorietyDelta: 3,
      }),
      NOW
    );

    assert.deepEqual(result.state.law.standing.harthmere, {
      likeability: 25,
      legal: -4,
      notoriety: 3,
      notorietyFloor: 0,
    });
    const exchange = result.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.equal(exchange?.kind, "inventory_exchange");
    assert.deepEqual(
      exchange?.kind === "inventory_exchange" ? exchange.standing : undefined,
      {
        scopeId: "harthmere",
        likeability: 25,
        legal: -4,
        notoriety: 3,
        notorietyFloor: 0,
      }
    );
  });

  it("claims land with one native wallet debit and a native deed/ACL plan", () => {
    const plot = BUILDING_SYSTEM_PLOTS[0];
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    const startingGold = Math.max(10_000, plot.claimPriceGold + 100);
    const result = reduceHarthmereLiveModeBackendState(
      state,
      envelope(
        "request_property_building_mutation",
        "building",
        { buildingAction: "claim_plot", plotId: plot.plotId },
        { serverActorGold: startingGold }
      ),
      NOW
    );

    const deed = result.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "deed"
    );
    assert.equal(deed?.kind, "deed");
    assert.equal(deed?.kind === "deed" ? deed.plotId : undefined, plot.plotId);
    assert.equal(deed?.kind === "deed" ? deed.ownerActorId : undefined, ACTOR);
    const exchange = result.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.equal(exchange?.kind, "inventory_exchange");
    assert.equal(
      exchange?.kind === "inventory_exchange" ? exchange.goldDelta : 0,
      -plot.claimPriceGold
    );
  });

  it("moves every bank-vault stack through one native inventory exchange", () => {
    const cases = [
      {
        operation: "deposit",
        itemId: "iron_ore",
        expectedConsume: "consumePersonalBankItemStacks",
        expectedReward: "rewardPersonalBankItemStacks",
      },
      {
        operation: "account_deposit",
        itemId: "iron_ore",
        expectedConsume: "consumeAccountBankItemStacks",
        expectedReward: "rewardAccountBankItemStacks",
      },
      {
        operation: "material_deposit",
        itemId: "iron_ore",
        expectedConsume: "consumeMaterialStorageItemStacks",
        expectedReward: "rewardMaterialStorageItemStacks",
      },
    ] as const;

    for (const testCase of cases) {
      const result = reduceHarthmereLiveModeBackendState(
        defaultHarthmereLiveModeBackendState(ACTOR, NOW),
        envelope(
          "request_bank_transaction",
          "bank",
          {
            operation: testCase.operation,
            itemId: testCase.itemId,
            count: 2,
          },
          {
            requestId: `native-boundary:${testCase.operation}:${NOW}`,
            idempotencyKey: `native-boundary:${testCase.operation}:${NOW}`,
            serverActorItemCounts: { [testCase.itemId]: 3 },
            serverActorMaterialStorageItemCounts: {},
            serverActorMaterialStorageMaxSlots: 32,
            serverActorPersonalBankItemCounts: {},
            serverActorPersonalBankMaxSlots: 24,
            serverActorAccountBankItemCounts: {},
            serverActorAccountBankMaxSlots: 40,
          }
        ),
        NOW
      );
      const exchange = result.summary.nativeEcsMaterializationPlans?.find(
        (plan) => plan.kind === "inventory_exchange"
      );
      assert.equal(exchange?.kind, "inventory_exchange");
      if (exchange?.kind !== "inventory_exchange") continue;
      assert.deepEqual(exchange.consumeItemStacks, { [testCase.itemId]: 2 });
      assert.deepEqual(exchange[testCase.expectedReward], {
        [testCase.itemId]: 2,
      });
      assert.deepEqual(exchange[testCase.expectedConsume], {});
    }
  });

  it("materializes one vendor bundle purchase into native ECS and charges its exact price", () => {
    const itemId = "native_vendor_bundle_test_item";
    const vendorId = "native_vendor_bundle_test_vendor";
    registerHarthmereItemDefinition({
      itemId,
      displayName: "Native Vendor Bundle Test Item",
      maxStackSize: 20,
      baseValue: 2,
      binding: "none",
      isQuestItem: false,
      isCurrency: false,
      isConsumable: false,
      isCraftingMaterial: false,
      isSpellTome: false,
      levelRequirement: 1,
      classRestriction: [],
      stats: {},
      tradeable: true,
      weight: 10,
    });
    registerHarthmereVendorEntry({
      vendorId,
      itemId,
      buyPrice: 3,
      sellPrice: 1,
      stock: 3,
      bundleQuantity: 3,
      bundlePrice: 7,
    });

    const result = reduceHarthmereLiveModeBackendState(
      defaultHarthmereLiveModeBackendState(ACTOR, NOW),
      envelope(
        "request_vendor_transaction",
        "vendor",
        {
          vendorId,
          transactionKind: "buy",
          itemId,
          count: 3,
        },
        {
          requestId: `native-boundary:vendor-buy:${NOW}`,
          idempotencyKey: `native-boundary:vendor-buy:${NOW}`,
          serverActorGold: 100,
          serverActorItemCounts: { [itemId]: 2 },
        }
      ),
      NOW
    );

    assert.ok(result.summary.touchedModels.includes("inventory_items"));
    const exchange = result.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.equal(exchange?.kind, "inventory_exchange");
    if (exchange?.kind !== "inventory_exchange") return;
    assert.deepEqual(exchange.rewardItemStacks, { [itemId]: 3 });
    assert.equal(exchange.goldDelta, -7);
    assert.equal(result.state.inventory.items[itemId], 5);
    assert.ok(
      harthmereInventoryCarryWeight(result.state.inventory.items) >
        HARTHMERE_CARRY_WEIGHT_LIMIT
    );
    assert.ok(
      harthmereInventoryEncumbranceStaminaMultiplier(
        result.state.inventory.items
      ) > 1
    );
  });

  it("materializes a vendor material bundle into storage with a full native backpack", () => {
    const fillerItemId = "native_vendor_full_backpack_filler";
    const materialItemId = "native_vendor_material_bundle";
    const vendorId = "native_vendor_material_bundle_vendor";
    registerHarthmereItemDefinition({
      itemId: fillerItemId,
      displayName: "Native Vendor Full Backpack Filler",
      maxStackSize: 1,
      baseValue: 1,
      binding: "none",
      isQuestItem: false,
      isCurrency: false,
      isConsumable: false,
      isCraftingMaterial: false,
      isSpellTome: false,
      levelRequirement: 1,
      classRestriction: [],
      stats: {},
      tradeable: true,
    });
    registerHarthmereItemDefinition({
      itemId: materialItemId,
      displayName: "Native Vendor Material Bundle",
      maxStackSize: 99,
      baseValue: 2,
      binding: "none",
      isQuestItem: false,
      isCurrency: false,
      isConsumable: false,
      isCraftingMaterial: true,
      isSpellTome: false,
      levelRequirement: 1,
      classRestriction: [],
      stats: {},
      tradeable: true,
      category: "materials",
    });
    registerHarthmereVendorEntry({
      vendorId,
      itemId: materialItemId,
      buyPrice: 1,
      sellPrice: 1,
      stock: 8,
      bundleQuantity: 8,
      bundlePrice: 7,
    });

    const result = reduceHarthmereLiveModeBackendState(
      defaultHarthmereLiveModeBackendState(ACTOR, NOW),
      envelope(
        "request_vendor_transaction",
        "vendor",
        {
          vendorId,
          transactionKind: "buy",
          itemId: materialItemId,
          count: 8,
        },
        {
          requestId: `native-boundary:vendor-material-buy:${NOW}`,
          idempotencyKey: `native-boundary:vendor-material-buy:${NOW}`,
          serverActorGold: 100,
          serverActorItemCounts: { [fillerItemId]: 40 },
          serverActorMaterialStorageItemCounts: {},
          serverActorMaterialStorageMaxSlots: 32,
        }
      ),
      NOW
    );

    assert.ok(
      !result.summary.warnings.includes("vendor_rejected:inventory_full"),
      JSON.stringify(result.summary.warnings)
    );
    assert.equal(result.state.inventory.gold, 93);
    assert.equal(result.state.inventory.items[materialItemId] ?? 0, 0);
    assert.equal(result.state.banking.materialStorage[materialItemId], 8);
    const exchange = result.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.equal(exchange?.kind, "inventory_exchange");
    if (exchange?.kind !== "inventory_exchange") return;
    assert.deepEqual(exchange.rewardItemStacks, {});
    assert.deepEqual(exchange.rewardMaterialStorageItemStacks, {
      [materialItemId]: 8,
    });
    assert.equal(exchange.goldDelta, -7);
  });
});
