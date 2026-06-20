export const HARTHMERE_MEDICAL_HEALTH_VERSION =
  "harthmere-medical-health" as const;

export interface HarthmereMedicalItemDefinition {
  itemId: string;
  displayName: string;
  healthRestore: number;
  cooldownCategory: string;
  cooldownMs: number;
}

export interface HarthmereDoctorServiceSnapshot {
  businessId: string;
  type: "medical_doctor";
  licenseLevel: number;
  inventory: Record<string, number>;
  revenueBalanceGold: number;
  customerSatisfaction?: number;
  reputation?: number;
}

export interface HarthmereMedicalHealthState {
  stateVersion?: typeof HARTHMERE_MEDICAL_HEALTH_VERSION;
  actorId: string;
  health: number;
  maxHealth: number;
  gold: number;
  inventory: Record<string, number>;
  consumableCooldowns: Record<string, number>;
  doctorBusinesses: Record<string, HarthmereDoctorServiceSnapshot>;
}

export interface HarthmereMedicalHealthResult {
  state: HarthmereMedicalHealthState;
  warnings: string[];
  inventoryDeltas: Record<string, number>;
  goldDelta: number;
  healthDelta: number;
  touchedDoctorBusinessIds: string[];
}

export const HARTHMERE_MEDICAL_ITEM_DEFINITIONS: Record<string, HarthmereMedicalItemDefinition> = {
  bandage: {
    itemId: "bandage",
    displayName: "Bandage",
    healthRestore: 12,
    cooldownCategory: "medical",
    cooldownMs: 10_000,
  },
  minor_healing_salve: {
    itemId: "minor_healing_salve",
    displayName: "Minor Healing Salve",
    healthRestore: 18,
    cooldownCategory: "medical",
    cooldownMs: 12_000,
  },
  medicine: {
    itemId: "medicine",
    displayName: "Medicine",
    healthRestore: 25,
    cooldownCategory: "medical",
    cooldownMs: 15_000,
  },
  health_potion: {
    itemId: "health_potion",
    displayName: "Health Potion",
    healthRestore: 35,
    cooldownCategory: "potion",
    cooldownMs: 30_000,
  },
  field_medkit: {
    itemId: "field_medkit",
    displayName: "Field Medkit",
    healthRestore: 55,
    cooldownCategory: "medical",
    cooldownMs: 45_000,
  },
};

const DOCTOR_TREATMENT_REQUIRED_ITEMS: Record<string, number> = {
  field_medkit: 1,
  medicine: 1,
};

export function defaultHarthmereMedicalHealthState(
  actorId: string,
): HarthmereMedicalHealthState {
  return {
    stateVersion: HARTHMERE_MEDICAL_HEALTH_VERSION,
    actorId,
    health: 100,
    maxHealth: 100,
    gold: 0,
    inventory: {},
    consumableCooldowns: {},
    doctorBusinesses: {},
  };
}

function result(
  state: HarthmereMedicalHealthState,
  warnings: string[] = [],
  inventoryDeltas: Record<string, number> = {},
  goldDelta = 0,
  previousHealth = state.health,
  touchedDoctorBusinessIds: string[] = [],
): HarthmereMedicalHealthResult {
  return {
    state,
    warnings,
    inventoryDeltas,
    goldDelta,
    healthDelta: Math.max(0, state.health - previousHealth),
    touchedDoctorBusinessIds,
  };
}

function maxHealthFor(state: HarthmereMedicalHealthState) {
  return Math.max(1, Number.isFinite(state.maxHealth) ? Math.trunc(state.maxHealth) : 100);
}

function currentHealthFor(state: HarthmereMedicalHealthState) {
  return Math.max(0, Math.min(maxHealthFor(state), Number.isFinite(state.health) ? state.health : 0));
}

function addItem(
  inventory: Record<string, number>,
  itemId: string,
  delta: number,
) {
  const nextCount = Math.max(0, (inventory[itemId] ?? 0) + delta);
  const next = { ...inventory };
  if (nextCount === 0) {
    delete next[itemId];
  } else {
    next[itemId] = nextCount;
  }
  return next;
}

function isOnCooldown(
  state: HarthmereMedicalHealthState,
  def: HarthmereMedicalItemDefinition,
  nowMs: number,
) {
  const expiresAt = state.consumableCooldowns[def.cooldownCategory];
  return expiresAt !== undefined && nowMs < expiresAt;
}

export function useHarthmereMedicalItem(
  state: HarthmereMedicalHealthState,
  input: { itemId: string; nowMs: number },
): HarthmereMedicalHealthResult {
  const previousHealth = currentHealthFor(state);
  const maxHealth = maxHealthFor(state);
  const def = HARTHMERE_MEDICAL_ITEM_DEFINITIONS[input.itemId];
  if (!def) return result(state, ["medical_rejected:not_medical_item"], {}, 0, previousHealth);
  if (previousHealth <= 0) return result(state, ["medical_rejected:cannot_use_while_dead"], {}, 0, previousHealth);
  if (previousHealth >= maxHealth) return result(state, ["medical_rejected:already_full_health"], {}, 0, previousHealth);
  if ((state.inventory[input.itemId] ?? 0) < 1) {
    return result(state, ["medical_rejected:missing_item"], {}, 0, previousHealth);
  }
  if (isOnCooldown(state, def, input.nowMs)) {
    return result(state, ["medical_rejected:consumable_on_cooldown"], {}, 0, previousHealth);
  }

  const nextHealth = Math.min(maxHealth, previousHealth + def.healthRestore);
  return result({
    ...state,
    health: nextHealth,
    maxHealth,
    inventory: addItem(state.inventory, input.itemId, -1),
    consumableCooldowns: {
      ...state.consumableCooldowns,
      [def.cooldownCategory]: input.nowMs + def.cooldownMs,
    },
  }, [], { [input.itemId]: -1 }, 0, previousHealth);
}

export function receiveHarthmereDoctorTreatment(
  state: HarthmereMedicalHealthState,
  input: { businessId: string; costGold?: number; nowMs: number },
): HarthmereMedicalHealthResult {
  const previousHealth = currentHealthFor(state);
  const maxHealth = maxHealthFor(state);
  const doctor = state.doctorBusinesses[input.businessId];
  const costGold = Math.max(0, Math.trunc(input.costGold ?? 90));
  if (!doctor || doctor.type !== "medical_doctor") {
    return result(state, ["medical_rejected:doctor_not_found"], {}, 0, previousHealth);
  }
  if (doctor.licenseLevel < 2) {
    return result(state, ["medical_rejected:medical_license_required"], {}, 0, previousHealth);
  }
  if (previousHealth <= 0) {
    return result(state, ["medical_rejected:cannot_treat_dead_patient"], {}, 0, previousHealth);
  }
  if (previousHealth >= maxHealth) {
    return result(state, ["medical_rejected:already_full_health"], {}, 0, previousHealth);
  }
  if (state.gold < costGold) {
    return result(state, ["medical_rejected:insufficient_gold"], {}, 0, previousHealth);
  }
  for (const [itemId, count] of Object.entries(DOCTOR_TREATMENT_REQUIRED_ITEMS)) {
    if ((doctor.inventory[itemId] ?? 0) < count) {
      return result(state, [`medical_rejected:doctor_missing_supply:${itemId}`], {}, 0, previousHealth);
    }
  }

  const nextDoctorInventory = { ...doctor.inventory };
  for (const [itemId, count] of Object.entries(DOCTOR_TREATMENT_REQUIRED_ITEMS)) {
    const nextCount = Math.max(0, (nextDoctorInventory[itemId] ?? 0) - count);
    if (nextCount === 0) {
      delete nextDoctorInventory[itemId];
    } else {
      nextDoctorInventory[itemId] = nextCount;
    }
  }

  const healAmount = 65 + Math.max(0, doctor.licenseLevel - 2) * 5;
  const nextHealth = Math.min(maxHealth, previousHealth + healAmount);
  const nextDoctor: HarthmereDoctorServiceSnapshot = {
    ...doctor,
    inventory: nextDoctorInventory,
    revenueBalanceGold: doctor.revenueBalanceGold + costGold,
    customerSatisfaction: Math.min(100, (doctor.customerSatisfaction ?? 70) + 2),
    reputation: Math.min(100, (doctor.reputation ?? 50) + 1),
  };

  return result({
    ...state,
    health: nextHealth,
    maxHealth,
    gold: state.gold - costGold,
    doctorBusinesses: {
      ...state.doctorBusinesses,
      [input.businessId]: nextDoctor,
    },
  }, [], {}, -costGold, previousHealth, [input.businessId]);
}
