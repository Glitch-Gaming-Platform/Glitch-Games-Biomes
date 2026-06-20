import assert from "assert";
import {
  defaultHarthmereMedicalHealthState,
  receiveHarthmereDoctorTreatment,
  useHarthmereMedicalItem,
} from "../mmo_medical_health";

const NOW = 1_700_500_000_000;

describe("mmo_medical_health", () => {
  it("uses medical items to restore health, consume stock, cap at max, and set cooldowns", () => {
    const state = defaultHarthmereMedicalHealthState("player_med_1");
    state.health = 72;
    state.maxHealth = 100;
    state.inventory.health_potion = 1;

    const result = useHarthmereMedicalItem(state, {
      itemId: "health_potion",
      nowMs: NOW,
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.health, 100);
    assert.equal(result.healthDelta, 28);
    assert.equal(result.state.inventory.health_potion ?? 0, 0);
    assert.equal(result.inventoryDeltas.health_potion, -1);
    assert.equal(result.state.consumableCooldowns.potion, NOW + 30_000);
  });

  it("rejects missing, unknown, full-health, cooldown, and dead-patient medical item use", () => {
    let state = defaultHarthmereMedicalHealthState("player_med_1");
    state.health = 50;

    assert.ok(useHarthmereMedicalItem(state, { itemId: "road_ration", nowMs: NOW }).warnings.includes("medical_rejected:not_medical_item"));
    assert.ok(useHarthmereMedicalItem(state, { itemId: "bandage", nowMs: NOW }).warnings.includes("medical_rejected:missing_item"));

    state.inventory.bandage = 1;
    state.health = 100;
    assert.ok(useHarthmereMedicalItem(state, { itemId: "bandage", nowMs: NOW }).warnings.includes("medical_rejected:already_full_health"));

    state.health = 80;
    state.consumableCooldowns.medical = NOW + 1_000;
    assert.ok(useHarthmereMedicalItem(state, { itemId: "bandage", nowMs: NOW }).warnings.includes("medical_rejected:consumable_on_cooldown"));

    state.health = 0;
    state.consumableCooldowns = {};
    assert.ok(useHarthmereMedicalItem(state, { itemId: "bandage", nowMs: NOW }).warnings.includes("medical_rejected:cannot_use_while_dead"));
  });

  it("lets licensed doctors restore health using clinic supplies and patient gold", () => {
    const state = defaultHarthmereMedicalHealthState("player_med_1");
    state.health = 30;
    state.gold = 150;
    state.doctorBusinesses.clinic_1 = {
      businessId: "clinic_1",
      type: "medical_doctor",
      licenseLevel: 3,
      inventory: { field_medkit: 1, medicine: 1 },
      revenueBalanceGold: 20,
      customerSatisfaction: 70,
      reputation: 50,
    };

    const result = receiveHarthmereDoctorTreatment(state, {
      businessId: "clinic_1",
      costGold: 90,
      nowMs: NOW,
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.health, 100);
    assert.equal(result.state.gold, 60);
    assert.equal(result.goldDelta, -90);
    assert.equal(result.state.doctorBusinesses.clinic_1.inventory.field_medkit ?? 0, 0);
    assert.equal(result.state.doctorBusinesses.clinic_1.inventory.medicine ?? 0, 0);
    assert.equal(result.state.doctorBusinesses.clinic_1.revenueBalanceGold, 110);
    assert.deepEqual(result.touchedDoctorBusinessIds, ["clinic_1"]);
  });

  it("rejects doctor treatment without a doctor, license, supplies, gold, or an injured living patient", () => {
    const base = defaultHarthmereMedicalHealthState("player_med_1");
    base.health = 40;
    base.gold = 150;

    assert.ok(receiveHarthmereDoctorTreatment(base, { businessId: "missing", nowMs: NOW }).warnings.includes("medical_rejected:doctor_not_found"));

    const lowLicense = {
      ...base,
      doctorBusinesses: {
        clinic_1: {
          businessId: "clinic_1",
          type: "medical_doctor" as const,
          licenseLevel: 1,
          inventory: { field_medkit: 1, medicine: 1 },
          revenueBalanceGold: 0,
        },
      },
    };
    assert.ok(receiveHarthmereDoctorTreatment(lowLicense, { businessId: "clinic_1", nowMs: NOW }).warnings.includes("medical_rejected:medical_license_required"));

    const outOfStock = {
      ...base,
      doctorBusinesses: {
        clinic_1: {
          businessId: "clinic_1",
          type: "medical_doctor" as const,
          licenseLevel: 2,
          inventory: { field_medkit: 1 } as Record<string, number>,
          revenueBalanceGold: 0,
        },
      },
    };
    assert.ok(receiveHarthmereDoctorTreatment(outOfStock, { businessId: "clinic_1", nowMs: NOW }).warnings.includes("medical_rejected:doctor_missing_supply:medicine"));

    const broke = { ...outOfStock, gold: 1 };
    broke.doctorBusinesses.clinic_1.inventory.medicine = 1;
    assert.ok(receiveHarthmereDoctorTreatment(broke, { businessId: "clinic_1", costGold: 90, nowMs: NOW }).warnings.includes("medical_rejected:insufficient_gold"));

    const full = { ...outOfStock, health: 100 };
    full.doctorBusinesses.clinic_1.inventory.medicine = 1;
    assert.ok(receiveHarthmereDoctorTreatment(full, { businessId: "clinic_1", nowMs: NOW }).warnings.includes("medical_rejected:already_full_health"));

    const dead = { ...outOfStock, health: 0 };
    dead.doctorBusinesses.clinic_1.inventory.medicine = 1;
    assert.ok(receiveHarthmereDoctorTreatment(dead, { businessId: "clinic_1", nowMs: NOW }).warnings.includes("medical_rejected:cannot_treat_dead_patient"));
  });
});
