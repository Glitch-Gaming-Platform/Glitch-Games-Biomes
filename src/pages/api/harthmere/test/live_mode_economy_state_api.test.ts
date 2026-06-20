import assert from "assert";
import { readHarthmereLiveModeEconomyStateForActor } from "../live_mode_economy_state";
import {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
} from "@/shared/harthmere/live_mode_backend";
import { HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS } from "@/shared/harthmere/business_customer_simulator";
import { HARTHMERE_ECONOMY_BUSINESS_TYPES } from "@/shared/harthmere/mmo_economy_authority";

const ACTOR = "player_api_economy_001";
const NOW_MS = 1_700_300_000_000;

describe("live_mode_economy_state API route integration", () => {
  it("reads Redis state and returns the production economy snapshot", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const businessType = HARTHMERE_ECONOMY_BUSINESS_TYPES.general_trader;
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
          return key === harthmereLiveModePlayerStateKey(ACTOR)
            ? JSON.stringify(backend)
            : null;
        },
      },
    };

    const snapshot = await readHarthmereLiveModeEconomyStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(calls, [
      harthmereLiveModePlayerStateKey(ACTOR),
      harthmereLiveModeSharedWorldStateKey(),
    ]);
    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.businesses.api_shop?.businessId, "api_shop");
  });

  it("uses one Redis MGET for actor and shared economy state when available", async () => {
    const backend = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const mgetCalls: string[][] = [];
    const getCalls: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          getCalls.push(key);
          return null;
        },
        mget: async (...keys: string[]) => {
          mgetCalls.push(keys);
          return keys.map((key) =>
            key === harthmereLiveModePlayerStateKey(ACTOR)
              ? JSON.stringify(backend)
              : null
          );
        },
      },
    };

    const snapshot = await readHarthmereLiveModeEconomyStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(mgetCalls, [[
      harthmereLiveModePlayerStateKey(ACTOR),
      harthmereLiveModeSharedWorldStateKey(),
    ]]);
    assert.deepEqual(getCalls, []);
    assert.equal(snapshot.actorId, ACTOR);
  });

  it("omits server-only outpost voxel edits from the client economy snapshot", async () => {
    const sharedBackend = defaultHarthmereLiveModeBackendState(
      "shared_economy",
      NOW_MS
    );
    const bulkyRecord = JSON.parse(
      JSON.stringify(
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_restaurant_redpot
      )
    );
    bulkyRecord.outpostId = "bulky_api_redpot_payload_guard";
    bulkyRecord.buildingId = "bulky_api_redpot_payload_guard";
    const templateEdit = bulkyRecord.materializationPlan.edits[0];
    bulkyRecord.materializationPlan.edits = Array.from(
      { length: 2000 },
      (_, index) => ({
        ...templateEdit,
        position: [
          templateEdit.position[0] + (index % 20),
          templateEdit.position[1],
          templateEdit.position[2] + Math.floor(index / 20),
        ],
      })
    );
    (sharedBackend.economy.production.businessSystems as any).outpostBuildings[
      bulkyRecord.outpostId
    ] = bulkyRecord;
    const rawBackendBytes = Buffer.byteLength(JSON.stringify(sharedBackend));

    const redis = {
      primary: {
        get: async (key: string) => {
          if (key === harthmereLiveModePlayerStateKey(ACTOR)) {
            return null;
          }
          if (key === harthmereLiveModeSharedWorldStateKey()) {
            return JSON.stringify(
              createHarthmereLiveModeSharedWorldState(sharedBackend, NOW_MS)
            );
          }
          return null;
        },
      },
    };

    const snapshot = await readHarthmereLiveModeEconomyStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    const slimRecord = (snapshot.businessSystems as any).outpostBuildings[
      bulkyRecord.outpostId
    ];
    assert.equal(slimRecord.outpostId, bulkyRecord.outpostId);
    assert.deepEqual(
      slimRecord.dashboardAccessPoint.position,
      bulkyRecord.dashboardAccessPoint.position
    );
    assert.equal(slimRecord.materializationPlan.editCount, 2000);
    assert.deepEqual(slimRecord.materializationPlan.edits, []);
    assert.ok(
      Buffer.byteLength(JSON.stringify(snapshot)) < rawBackendBytes / 3
    );
  });

  it("reports legacy outpost validation issues without throwing", async () => {
    const sharedBackend = defaultHarthmereLiveModeBackendState(
      "shared_economy",
      NOW_MS
    );
    const legacyRecord = JSON.parse(
      JSON.stringify(
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_restaurant_redpot
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
          if (key === harthmereLiveModePlayerStateKey(ACTOR)) {
            return null;
          }
          if (key === harthmereLiveModeSharedWorldStateKey()) {
            return JSON.stringify(
              createHarthmereLiveModeSharedWorldState(sharedBackend, NOW_MS)
            );
          }
          return null;
        },
      },
    };

    const snapshot = await readHarthmereLiveModeEconomyStateForActor({
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
