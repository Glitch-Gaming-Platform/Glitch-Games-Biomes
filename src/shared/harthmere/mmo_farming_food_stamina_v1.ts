export const HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1 =
  "harthmere-farming-food-stamina-v1" as const;

export const HARTHMERE_HALF_DAY_MS_V1 = 12 * 60 * 60 * 1000;
export const HARTHMERE_DEFAULT_MAX_STAMINA_V1 = 100;
export const HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 = 4 * 60;
export const HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1 =
  HARTHMERE_DEFAULT_MAX_STAMINA_V1 / HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1;

export type HarthmereSeedSourceV1 = "vendor" | "world" | "monster";
export type HarthmereSpawnKindV1 = "food" | "animal" | "seed" | "monster";

export interface HarthmereFoodDefinitionV1 {
  itemId: string;
  displayName: string;
  staminaRestore: number;
  healthRestore: number;
  source: "crop" | "animal" | "hunt" | "vendor" | "cooked";
}

export interface HarthmereSeedDefinitionV1 {
  seedItemId: string;
  cropItemId: string;
  displayName: string;
  source: HarthmereSeedSourceV1[];
  growMs: number;
  yieldItemId: string;
  yieldCount: number;
}

export interface HarthmereFarmingPlotV1 {
  plotId: string;
  seedItemId: string;
  cropItemId: string;
  plantedAtMs: number;
  wateredAtMs?: number;
  harvestReadyAtMs: number;
  harvestedAtMs?: number;
}

export interface HarthmereWorldSpawnV1 {
  spawnId: string;
  kind: HarthmereSpawnKindV1;
  itemId?: string;
  hp?: number;
  maxHp?: number;
  depletedAtMs?: number;
  respawnAtMs?: number;
  lastDamagedAtMs?: number;
  lastRegenAtMs?: number;
}

export interface HarthmereFoodStaminaStateV1 {
  stateVersion?: typeof HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1;
  actorId: string;
  stamina: number;
  maxStamina: number;
  lastStaminaTickMs: number;
  deadFromStaminaAtMs?: number;
  inventory: Record<string, number>;
  plots: Record<string, HarthmereFarmingPlotV1>;
  spawns: Record<string, HarthmereWorldSpawnV1>;
}

export interface HarthmereFoodStaminaResultV1 {
  state: HarthmereFoodStaminaStateV1;
  warnings: string[];
  inventoryDeltas: Record<string, number>;
  deathTriggered: boolean;
}

export const HARTHMERE_FOOD_DEFINITIONS_V1: Record<string, HarthmereFoodDefinitionV1> = {
  road_ration: { itemId: "road_ration", displayName: "Road Ration", staminaRestore: 24, healthRestore: 0, source: "vendor" },
  apple_tart: { itemId: "apple_tart", displayName: "Warm Apple Tart", staminaRestore: 18, healthRestore: 4, source: "cooked" },
  fresh_carrot: { itemId: "fresh_carrot", displayName: "Fresh Carrot", staminaRestore: 12, healthRestore: 0, source: "crop" },
  loaf_bread: { itemId: "loaf_bread", displayName: "Loaf Bread", staminaRestore: 20, healthRestore: 0, source: "crop" },
  grilled_meat: { itemId: "grilled_meat", displayName: "Grilled Meat", staminaRestore: 32, healthRestore: 6, source: "animal" },
  river_trout: { itemId: "river_trout", displayName: "River Trout", staminaRestore: 22, healthRestore: 4, source: "hunt" },
  wild_berries: { itemId: "wild_berries", displayName: "Wild Berries", staminaRestore: 10, healthRestore: 0, source: "crop" },
};

export const HARTHMERE_SEED_DEFINITIONS_V1: Record<string, HarthmereSeedDefinitionV1> = {
  seed_wheat: {
    seedItemId: "seed_wheat",
    cropItemId: "wheat",
    displayName: "Wheat Seed",
    source: ["vendor", "world"],
    growMs: 6 * 60 * 60 * 1000,
    yieldItemId: "loaf_bread",
    yieldCount: 2,
  },
  seed_carrot: {
    seedItemId: "seed_carrot",
    cropItemId: "carrot",
    displayName: "Carrot Seed",
    source: ["vendor", "world"],
    growMs: 4 * 60 * 60 * 1000,
    yieldItemId: "fresh_carrot",
    yieldCount: 3,
  },
  seed_muckroot: {
    seedItemId: "seed_muckroot",
    cropItemId: "muckroot",
    displayName: "Muckroot Seed",
    source: ["monster"],
    growMs: 8 * 60 * 60 * 1000,
    yieldItemId: "wild_berries",
    yieldCount: 2,
  },
};

export function defaultHarthmereFoodStaminaStateV1(
  actorId: string,
  nowMs: number,
): HarthmereFoodStaminaStateV1 {
  return {
    stateVersion: HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1,
    actorId,
    stamina: HARTHMERE_DEFAULT_MAX_STAMINA_V1,
    maxStamina: HARTHMERE_DEFAULT_MAX_STAMINA_V1,
    lastStaminaTickMs: nowMs,
    inventory: { road_ration: 2 },
    plots: {},
    spawns: {},
  };
}

function result(
  state: HarthmereFoodStaminaStateV1,
  warnings: string[] = [],
  inventoryDeltas: Record<string, number> = {},
  deathTriggered = false,
): HarthmereFoodStaminaResultV1 {
  return { state, warnings, inventoryDeltas, deathTriggered };
}

function addItem(
  inventory: Record<string, number>,
  itemId: string,
  count: number,
) {
  return { ...inventory, [itemId]: Math.max(0, (inventory[itemId] ?? 0) + count) };
}

function requireItem(
  state: HarthmereFoodStaminaStateV1,
  itemId: string,
  count: number,
  warning: string,
) {
  return (state.inventory[itemId] ?? 0) >= count ? undefined : warning;
}

export function plantHarthmereCropV1(
  state: HarthmereFoodStaminaStateV1,
  input: { plotId: string; seedItemId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const seed = HARTHMERE_SEED_DEFINITIONS_V1[input.seedItemId];
  if (!seed) return result(state, ["farming_rejected:unknown_seed"]);
  if (state.plots[input.plotId] && !state.plots[input.plotId].harvestedAtMs) {
    return result(state, ["farming_rejected:plot_occupied"]);
  }
  const missing = requireItem(state, input.seedItemId, 1, "farming_rejected:missing_seed");
  if (missing) return result(state, [missing]);
  const plot: HarthmereFarmingPlotV1 = {
    plotId: input.plotId,
    seedItemId: input.seedItemId,
    cropItemId: seed.cropItemId,
    plantedAtMs: input.nowMs,
    harvestReadyAtMs: input.nowMs + seed.growMs,
  };
  return result({
    ...state,
    inventory: addItem(state.inventory, input.seedItemId, -1),
    plots: { ...state.plots, [input.plotId]: plot },
  }, [], { [input.seedItemId]: -1 });
}

export function waterHarthmereCropV1(
  state: HarthmereFoodStaminaStateV1,
  input: { plotId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const plot = state.plots[input.plotId];
  if (!plot || plot.harvestedAtMs) return result(state, ["farming_rejected:unknown_active_plot"]);
  return result({
    ...state,
    plots: {
      ...state.plots,
      [input.plotId]: {
        ...plot,
        wateredAtMs: input.nowMs,
        harvestReadyAtMs: Math.max(input.nowMs, plot.harvestReadyAtMs - 60 * 60 * 1000),
      },
    },
  });
}

export function harvestHarthmereCropV1(
  state: HarthmereFoodStaminaStateV1,
  input: { plotId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const plot = state.plots[input.plotId];
  if (!plot) return result(state, ["farming_rejected:unknown_plot"]);
  if (plot.harvestedAtMs) return result(state, ["farming_rejected:already_harvested"]);
  if (input.nowMs < plot.harvestReadyAtMs) return result(state, ["farming_rejected:not_ready"]);
  const seed = HARTHMERE_SEED_DEFINITIONS_V1[plot.seedItemId];
  if (!seed) return result(state, ["farming_rejected:unknown_seed"]);
  return result({
    ...state,
    inventory: addItem(state.inventory, seed.yieldItemId, seed.yieldCount),
    plots: {
      ...state.plots,
      [input.plotId]: { ...plot, harvestedAtMs: input.nowMs },
    },
  }, [], { [seed.yieldItemId]: seed.yieldCount });
}

export function gatherHarthmereSeedV1(
  state: HarthmereFoodStaminaStateV1,
  input: { seedItemId: string; source: HarthmereSeedSourceV1; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const seed = HARTHMERE_SEED_DEFINITIONS_V1[input.seedItemId];
  if (!seed) return result(state, ["farming_rejected:unknown_seed"]);
  if (!seed.source.includes(input.source)) return result(state, ["farming_rejected:invalid_seed_source"]);
  return result({
    ...state,
    inventory: addItem(state.inventory, input.seedItemId, 1),
  }, [], { [input.seedItemId]: 1 });
}

export function huntHarthmereAnimalForFoodV1(
  state: HarthmereFoodStaminaStateV1,
  input: { animalId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const spawn = state.spawns[input.animalId];
  if (!spawn || spawn.kind !== "animal") return result(state, ["hunt_rejected:unknown_animal"]);
  if ((spawn.hp ?? spawn.maxHp ?? 1) > 0) return result(state, ["hunt_rejected:animal_not_killed"]);
  if (spawn.depletedAtMs) return result(state, ["hunt_rejected:already_harvested"]);
  return result({
    ...state,
    inventory: addItem(state.inventory, "raw_meat", 2),
    spawns: {
      ...state.spawns,
      [input.animalId]: {
        ...spawn,
        depletedAtMs: input.nowMs,
        respawnAtMs: input.nowMs + HARTHMERE_HALF_DAY_MS_V1,
      },
    },
  }, [], { raw_meat: 2 });
}

export function cookHarthmereFoodV1(
  state: HarthmereFoodStaminaStateV1,
  input: { rawItemId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  if (input.rawItemId !== "raw_meat") return result(state, ["cooking_rejected:unknown_recipe"]);
  const missing = requireItem(state, "raw_meat", 1, "cooking_rejected:missing_raw_food");
  if (missing) return result(state, [missing]);
  return result({
    ...state,
    inventory: addItem(addItem(state.inventory, "raw_meat", -1), "grilled_meat", 1),
  }, [], { raw_meat: -1, grilled_meat: 1 });
}

export function eatHarthmereFoodV1(
  state: HarthmereFoodStaminaStateV1,
  input: { itemId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const food = HARTHMERE_FOOD_DEFINITIONS_V1[input.itemId];
  if (!food) return result(state, ["food_rejected:not_food"]);
  const missing = requireItem(state, input.itemId, 1, "food_rejected:missing_food");
  if (missing) return result(state, [missing]);
  return result({
    ...state,
    stamina: Math.min(state.maxStamina, state.stamina + food.staminaRestore),
    inventory: addItem(state.inventory, input.itemId, -1),
  }, [], { [input.itemId]: -1 });
}

export function tickHarthmereStaminaV1(
  state: HarthmereFoodStaminaStateV1,
  nowMs: number,
): HarthmereFoodStaminaResultV1 {
  // Stamina is a survival clock, not a sprint meter. It drains slowly so the
  // player has time to notice the HUD, buy/cook/forage food, and recover.
  // Reaching zero is intentionally fatal to make the food economy meaningful.
  const elapsedMs = Math.max(0, nowMs - state.lastStaminaTickMs);
  const drained = (elapsedMs / 60_000) * HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1;
  const nextStamina = Math.max(0, state.stamina - drained);
  const deathTriggered = nextStamina <= 0 && !state.deadFromStaminaAtMs;
  return result({
    ...state,
    stamina: nextStamina,
    lastStaminaTickMs: nowMs,
    deadFromStaminaAtMs: deathTriggered ? nowMs : state.deadFromStaminaAtMs,
  }, deathTriggered ? ["stamina_depleted:death_triggered"] : [], {}, deathTriggered);
}

export function damageHarthmereSpawnV1(
  state: HarthmereFoodStaminaStateV1,
  input: { spawnId: string; damage: number; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const spawn = state.spawns[input.spawnId];
  if (!spawn || (spawn.kind !== "monster" && spawn.kind !== "animal")) {
    return result(state, ["spawn_rejected:unknown_damageable"]);
  }
  const hp = Math.max(0, (spawn.hp ?? spawn.maxHp ?? 1) - Math.max(0, input.damage));
  return result({
    ...state,
    spawns: {
      ...state.spawns,
      [input.spawnId]: {
        ...spawn,
        hp,
        depletedAtMs: hp <= 0 ? input.nowMs : spawn.depletedAtMs,
        respawnAtMs: hp <= 0 ? input.nowMs + HARTHMERE_HALF_DAY_MS_V1 : spawn.respawnAtMs,
        lastDamagedAtMs: input.nowMs,
      },
    },
  });
}

export function tickHarthmereWorldRespawnAndRegenV1(
  state: HarthmereFoodStaminaStateV1,
  nowMs: number,
): HarthmereFoodStaminaResultV1 {
  let changed = false;
  const spawns: Record<string, HarthmereWorldSpawnV1> = {};
  for (const [spawnId, spawn] of Object.entries(state.spawns)) {
    let next = spawn;
    if (spawn.depletedAtMs && spawn.respawnAtMs && nowMs >= spawn.respawnAtMs) {
      next = {
        ...spawn,
        hp: spawn.maxHp,
        depletedAtMs: undefined,
        respawnAtMs: undefined,
        lastRegenAtMs: nowMs,
      };
      changed = true;
    } else if (
      spawn.kind === "monster" &&
      !spawn.depletedAtMs &&
      Number.isFinite(spawn.hp) &&
      Number.isFinite(spawn.maxHp) &&
      Number(spawn.hp) < Number(spawn.maxHp)
    ) {
      const last = spawn.lastRegenAtMs ?? spawn.lastDamagedAtMs ?? nowMs;
      const elapsed = Math.max(0, nowMs - last);
      const heal = (Number(spawn.maxHp) * elapsed) / HARTHMERE_HALF_DAY_MS_V1;
      next = {
        ...spawn,
        hp: Math.min(Number(spawn.maxHp), Number(spawn.hp) + heal),
        lastRegenAtMs: nowMs,
      };
      changed = true;
    }
    spawns[spawnId] = next;
  }
  return result(changed ? { ...state, spawns } : state);
}
