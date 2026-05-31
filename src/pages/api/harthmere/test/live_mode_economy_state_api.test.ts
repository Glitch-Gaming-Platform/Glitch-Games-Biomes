import assert from "assert";
import { readHarthmereLiveModeEconomyStateForActorV1 } from "../live_mode_economy_state";
import {
  createHarthmereLiveModeSharedWorldStateV1,
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeSharedWorldStateKeyV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1 } from "@/shared/harthmere/business_customer_simulator_v1";
import { HARTHMERE_ECONOMY_BUSINESS_TYPES_V1 } from "@/shared/harthmere/mmo_economy_authority_v1";

const ACTOR = "player_api_economy_001";
const NOW_MS = 1_700_300_000_000;

describe("live_mode_economy_state API route integration", () => {
  it("reads Redis state and returns the production economy snapshot", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    const businessType = HARTHMERE_ECONOMY_BUSINESS_TYPES_V1.general_trader;
    backend.economy.production.businesses.api_shop = {
      businessId: "api_shop",
      ownerKind: "player",
      ownerId: ACTOR,
      typeId: "general_trader",
      name: "API Shop",
      status: "open",
      licenseClass: businessType.requiredLicense,
      licenseLevel: businessType.minimumLicenseLevel,
      regionId: "harthmere_grove",
      inventory: { river_reed: { itemId: "river_reed", count: 3 } },
      storageMaxSlots: businessType.baseStorageSlots,
      employees: [],
      activeContracts: [],
      completedContracts: 0,
      reputation: 0,
      customerSatisfaction: 50,
      sanitationRating: 50,
      safetyRating: 50,
      serviceRadius: 1,
      priceModifiers: {},
      balanceGold: 250,
      debtGold: 0,
      upkeepGoldPerDay: businessType.baseUpkeepGoldPerDay,
      rentGoldPerDay: 0,
      wageGoldPerDay: 0,
      salesTaxRate: 0,
      lastTickAtMs: NOW_MS,
      createdAtMs: NOW_MS,
      updatedAtMs: NOW_MS,
      flags: {},
    };
    const calls: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          calls.push(key);
          return key === harthmereLiveModePlayerStateKeyV1(ACTOR)
            ? JSON.stringify(backend)
            : null;
        },
      },
    };

    const snapshot = await readHarthmereLiveModeEconomyStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(calls, [
      harthmereLiveModePlayerStateKeyV1(ACTOR),
      harthmereLiveModeSharedWorldStateKeyV1(),
    ]);
    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.businesses.api_shop?.businessId, "api_shop");
  });

  it("reports legacy outpost validation issues without throwing", async () => {
    const sharedBackend = defaultHarthmereLiveModeBackendStateV1(
      "shared_economy",
      NOW_MS
    );
    const legacyRecord = JSON.parse(
      JSON.stringify(
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1.outpost_restaurant_redpot
      )
    );
    legacyRecord.outpostId = "legacy_api_redpot_without_validation_arrays";
    legacyRecord.buildingId = "legacy_api_redpot_without_validation_arrays";
    delete legacyRecord.buildingStyleKit.styleNotes;
    delete legacyRecord.interiorFixtures;
    delete legacyRecord.materializationPlan.edits;
    (sharedBackend.economy.production.businessSystems as any).outpostBuildings[
      legacyRecord.outpostId
    ] = legacyRecord;

    const redis = {
      primary: {
        get: async (key: string) => {
          if (key === harthmereLiveModePlayerStateKeyV1(ACTOR)) {
            return null;
          }
          if (key === harthmereLiveModeSharedWorldStateKeyV1()) {
            return JSON.stringify(
              createHarthmereLiveModeSharedWorldStateV1(sharedBackend, NOW_MS)
            );
          }
          return null;
        },
      },
    };

    const snapshot = await readHarthmereLiveModeEconomyStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.ok(
      snapshot.balanceWarnings.some((warning) =>
        warning.includes("legacy_api_redpot_without_validation_arrays")
      )
    );
    assert.ok(
      snapshot.balanceWarnings.some((warning) =>
        warning.includes("outpost_style_kit_missing_style_notes")
      )
    );
  });
});
