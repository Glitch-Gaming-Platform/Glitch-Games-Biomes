import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { BUILDING_SYSTEM_PLOTS } from "@/shared/harthmere/building_system";
import type { HarthmereLiveModeAuthorityEnvelope } from "@/shared/harthmere/live_mode_readiness";
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
});
