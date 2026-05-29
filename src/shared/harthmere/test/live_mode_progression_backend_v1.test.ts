import assert from "assert";
import {
  createHarthmereProgressionClientSnapshotFromBackendV1,
  defaultHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
  type HarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import { HARTHMERE_BUSINESS_ABILITY_DEFINITIONS_V1 } from "../mmo_class_ability_collectibles_v1";
import {
  HARTHMERE_ECONOMY_BUSINESS_TYPES_V1,
  type HarthmereEconomyBusinessTypeIdV1,
} from "../mmo_economy_authority_v1";
import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAnySubsystemV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "../live_mode_readiness_v1";

const ACTOR = "player_progression_backend_001";
const NOW_MS = 1_700_100_000_000;

let seq = 0;
function envelope(
  actionKind: HarthmereLiveModeActionKindV1,
  subsystem: HarthmereLiveModeAnySubsystemV1,
  payload: Record<string, unknown>
): HarthmereLiveModeAuthorityEnvelopeV1 {
  seq += 1;
  return {
    requestId: `progression_backend_${seq}`,
    idempotencyKey: `progression_backend_${seq}`,
    actorId: ACTOR,
    actionKind,
    subsystem,
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: NOW_MS,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
  };
}

function addBusiness(state: HarthmereLiveModeBackendStateV1, typeId: HarthmereEconomyBusinessTypeIdV1) {
  const def = HARTHMERE_ECONOMY_BUSINESS_TYPES_V1[typeId];
  state.economy.production.businesses[`business_${typeId}`] = {
    businessId: `business_${typeId}`,
    ownerKind: "player",
    ownerId: ACTOR,
    typeId,
    name: `${def.displayName} Backend Test`,
    status: "open",
    licenseClass: def.requiredLicense,
    licenseLevel: def.minimumLicenseLevel,
    regionId: "harthmere_grove",
    inventory: {},
    storageMaxSlots: def.baseStorageSlots,
    employees: [],
    activeContracts: [],
    completedContracts: 0,
    reputation: 0,
    customerSatisfaction: 50,
    sanitationRating: 50,
    safetyRating: 50,
    serviceRadius: 1,
    priceModifiers: {},
    balanceGold: 0,
    debtGold: 0,
    upkeepGoldPerDay: def.baseUpkeepGoldPerDay,
    rentGoldPerDay: 0,
    wageGoldPerDay: 0,
    salesTaxRate: 0,
    lastTickAtMs: NOW_MS,
    createdAtMs: NOW_MS,
    updatedAtMs: NOW_MS,
    flags: {},
  };
}

describe("live_mode progression backend", () => {
  it("chooses classes through the trainer pipeline and seeds class abilities", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    const reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_trainer_unlock", "trainer", { classId: "rogue" }),
      NOW_MS,
    );
    assert.equal(reduced.state.classMagic.classId, "rogue");
    assert.ok(reduced.state.classMagic.knownAbilities.includes("backstab"));
    assert.ok(reduced.summary.touchedModels.includes("class_choice"));
  });

  it("rejects business abilities until the player owns the matching business", () => {
    const ability = Object.values(HARTHMERE_BUSINESS_ABILITY_DEFINITIONS_V1)
      .find((entry) => entry.businessTypeId === "courier")!;
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    state.classMagic.skills.business_operations = { xp: 0, level: 1 };

    const rejected = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_trainer_unlock", "trainer", { abilityId: ability.id }),
      NOW_MS,
    );
    assert.ok(rejected.summary.warnings.some((warning) => warning.includes("business_required:courier")));
    assert.equal(rejected.state.classMagic.knownAbilities.includes(ability.id), false);

    addBusiness(rejected.state, "courier");
    const learned = reduceHarthmereLiveModeBackendStateV1(
      rejected.state,
      envelope("request_trainer_unlock", "trainer", { abilityId: ability.id }),
      NOW_MS,
    );
    assert.equal(learned.state.classMagic.knownAbilities.includes(ability.id), true);
  });

  it("rejects business abilities for closed businesses", () => {
    const ability = Object.values(HARTHMERE_BUSINESS_ABILITY_DEFINITIONS_V1)
      .find((entry) => entry.businessTypeId === "courier")!;
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    state.classMagic.skills.business_operations = { xp: 0, level: 1 };
    addBusiness(state, "courier");
    state.economy.production.businesses.business_courier.status = "closed";
    const reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_trainer_unlock", "trainer", { abilityId: ability.id }),
      NOW_MS,
    );
    assert.ok(reduced.summary.warnings.some((warning) => warning.includes("business_required:courier")));
    assert.equal(reduced.state.classMagic.knownAbilities.includes(ability.id), false);
  });

  it("rejects unknown classes, abilities, and collectibles", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    const badClass = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_trainer_unlock", "trainer", { classId: "time_accountant" }),
      NOW_MS,
    );
    assert.ok(badClass.summary.warnings.includes("class_rejected:unknown_class"));

    const badAbility = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_trainer_unlock", "trainer", { abilityId: "nope_blast" }),
      NOW_MS,
    );
    assert.ok(badAbility.summary.warnings.includes("ability_rejected:unknown_ability"));

    const badCollectible = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_quest_state_update", "quest", { collectibleId: "npc:not_real" }),
      NOW_MS,
    );
    assert.ok(badCollectible.summary.warnings.includes("collectible_rejected:unknown_collectible"));
  });

  it("keeps duplicate ability unlocks idempotent", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    state.classMagic.classId = "warrior";
    state.classMagic.knownAbilities.push("power_strike");
    const reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_trainer_unlock", "trainer", { abilityId: "power_strike" }),
      NOW_MS,
    );
    assert.equal(reduced.state.classMagic.knownAbilities.filter((id) => id === "power_strike").length, 1);
    assert.equal(reduced.summary.warnings.length, 0);
  });

  it("assigns known abilities into explicit loadout slots", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    state.classMagic.knownAbilities.push("basic_strike");
    const reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_loadout_change", "loadout", { slot: "slot_2", abilityId: "basic_strike" }),
      NOW_MS,
    );
    assert.equal(reduced.state.classMagic.loadout.slot_2, "basic_strike");
  });

  it("treats current class starting abilities as known for loadout assignment", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    state.classMagic.classId = "warrior";
    const reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_loadout_change", "loadout", { slot: "slot_0", abilityId: "power_strike" }),
      NOW_MS,
    );
    assert.equal(reduced.state.classMagic.loadout.slot_0, "power_strike");
    assert.equal(reduced.summary.warnings.length, 0);
  });

  it("rejects malformed loadout slots", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    state.classMagic.classId = "warrior";
    const reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_loadout_change", "loadout", { slot: "slot_99", abilityId: "power_strike" }),
      NOW_MS,
    );
    assert.ok(reduced.summary.warnings.includes("loadout_rejected:malformed_slot"));
    assert.equal(reduced.state.classMagic.loadout.slot_99, undefined);
  });

  it("discovers collectibles through the quest update pipeline", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    const reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_quest_state_update", "quest", { collectibleId: "npc:jackie" }),
      NOW_MS,
    );
    assert.equal(reduced.state.collections.discovered["npc:jackie"], NOW_MS);
    const snapshot = createHarthmereProgressionClientSnapshotFromBackendV1(reduced.state);
    assert.ok(snapshot.collections.some((entry) => entry.id === "npc:jackie" && entry.discovered));
  });

  it("keeps collectible discovery timestamps idempotent", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    state.collections.discovered["npc:jackie"] = NOW_MS - 500;
    const reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      envelope("request_quest_state_update", "quest", { collectibleId: "npc:jackie" }),
      NOW_MS,
    );
    assert.equal(reduced.state.collections.discovered["npc:jackie"], NOW_MS - 500);
  });
});
