import {
  HARTHMERE_BIKKIE_FOOD_ROWS_V1,
  HARTHMERE_BIKKIE_RECIPE_ROWS_V1,
  HARTHMERE_BIKKIE_SEED_ROWS_V1,
  type HarthmereBikkieItemMetadataV1,
} from "./mmo_bikkie_farming_food_catalog_v1";

export const HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1 =
  "harthmere-farming-food-stamina-v1" as const;

export const HARTHMERE_HALF_DAY_MS_V1 = 12 * 60 * 60 * 1000;
export const HARTHMERE_DEFAULT_MAX_STAMINA_V1 = 100;
/** Real-time survival clock: 100 points of stamina drain over 2 hours of active gameplay.
 *  This is a CONSTANT rate (independent of max stamina), so "every 100 stamina = 2 hours"
 *  holds for every player — a larger max bar simply lasts proportionally longer. */
export const HARTHMERE_STAMINA_MINUTES_PER_100_V1 = 2 * 60;
export const HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1 =
  100 / HARTHMERE_STAMINA_MINUTES_PER_100_V1;
/** Minutes a DEFAULT (100) stamina bar lasts before starvation, derived from the constant
 *  drain rate (= 120 min). Retained for callers/tests that reason about the default bar. */
export const HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 =
  HARTHMERE_DEFAULT_MAX_STAMINA_V1 / HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1;

export type HarthmereSeedSourceV1 = "vendor" | "world" | "monster";
export type HarthmereSpawnKindV1 = "food" | "animal" | "seed" | "monster";
export type HarthmereLivestockSpeciesV1 = "cow" | "goat" | "chicken";
export type HarthmereFoodSourceV1 =
  | "crop"
  | "animal"
  | "hunt"
  | "vendor"
  | "cooked"
  | "livestock"
  | "foraged"
  | "fish"
  | "drink";
export type HarthmereCookingStationKindV1 =
  | "field"
  | "campfire"
  | "cookpot"
  | "oven";
export type HarthmereRecipeTypeV1 = "cooking" | "seed" | "fertilizer";

export interface HarthmereFoodDefinitionV1 {
  itemId: string;
  displayName: string;
  staminaRestore: number;
  source: HarthmereFoodSourceV1;
  edible?: boolean;
  metadata?: HarthmereBikkieItemMetadataV1;
}

export interface HarthmereSeedDefinitionV1 {
  seedItemId: string;
  cropItemId: string;
  displayName: string;
  source: HarthmereSeedSourceV1[];
  growMs: number;
  yieldItemId: string;
  yieldCount: number;
  cropDisplayName?: string;
  requiresSun?: boolean;
  waterIntervalMs?: number;
  deathTimeMs?: number;
  metadata?: HarthmereBikkieItemMetadataV1;
}

export interface HarthmereCookingRecipeV1 {
  recipeId: string;
  displayName: string;
  stationKind: HarthmereCookingStationKindV1;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  cookTimeMs: number;
  xp: number;
  maxBatchCount: number;
  recipeType?: HarthmereRecipeTypeV1;
  metadata?: HarthmereBikkieItemMetadataV1;
}

export interface HarthmereFarmingPlotV1 {
  plotId: string;
  seedItemId: string;
  cropItemId: string;
  plantedAtMs: number;
  wateredAtMs?: number;
  harvestReadyAtMs: number;
  harvestedAtMs?: number;
  /** Set when a crop withered past its deathTimeMs window without being harvested. */
  diedAtMs?: number;
}

export interface HarthmereWorldSpawnV1 {
  spawnId: string;
  kind: HarthmereSpawnKindV1;
  itemId?: string;
  species?: string;
  protected?: boolean;
  isLivestock?: boolean;
  ownerId?: string;
  hp?: number;
  maxHp?: number;
  depletedAtMs?: number;
  respawnAtMs?: number;
  lastDamagedAtMs?: number;
  lastRegenAtMs?: number;
}

export interface HarthmereLivestockV1 {
  livestockId: string;
  species: HarthmereLivestockSpeciesV1;
  ownerId: string;
  health: number;
  hunger: number;
  productItemId: string;
  productReadyAtMs: number;
  lastFedAtMs?: number;
  lastCollectedAtMs?: number;
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
  livestock: Record<string, HarthmereLivestockV1>;
}

export interface HarthmereFoodStaminaResultV1 {
  state: HarthmereFoodStaminaStateV1;
  warnings: string[];
  inventoryDeltas: Record<string, number>;
  deathTriggered: boolean;
}

function optionalBikkieMetadata(
  bikkieId: string,
  displayName: string,
  category: string,
  action: string,
  galoisPath: string,
  visualAsset: string,
): HarthmereBikkieItemMetadataV1 {
  return {
    bikkieId,
    displayName,
    ...(category ? { category } : {}),
    ...(action ? { action } : {}),
    ...(galoisPath ? { galoisPath } : {}),
    ...(visualAsset ? { visualAsset } : {}),
  };
}

function bagFromRows(rows: readonly (readonly [string, number])[]) {
  const bag: Record<string, number> = {};
  for (const [itemId, count] of rows) {
    bag[itemId] = (bag[itemId] ?? 0) + count;
  }
  return bag;
}

const HARTHMERE_LOCAL_FOOD_DEFINITIONS_V1: Record<string, HarthmereFoodDefinitionV1> = {
  road_ration: { itemId: "road_ration", displayName: "Road Ration", staminaRestore: 24, source: "vendor" },
  apple_tart: { itemId: "apple_tart", displayName: "Warm Apple Tart", staminaRestore: 18, source: "cooked" },
  fresh_carrot: { itemId: "fresh_carrot", displayName: "Fresh Carrot", staminaRestore: 12, source: "crop" },
  loaf_bread: { itemId: "loaf_bread", displayName: "Loaf Bread", staminaRestore: 20, source: "crop" },
  grilled_meat: { itemId: "grilled_meat", displayName: "Grilled Meat", staminaRestore: 32, source: "cooked" },
  worker_meal: { itemId: "worker_meal", displayName: "Worker Meal", staminaRestore: 16, source: "cooked" },
  hearty_stew: { itemId: "hearty_stew", displayName: "Hearty Stew", staminaRestore: 38, source: "cooked" },
  berry_tart: { itemId: "berry_tart", displayName: "Wild Berry Tart", staminaRestore: 28, source: "cooked" },
  river_trout: { itemId: "river_trout", displayName: "River Trout", staminaRestore: 22, source: "hunt" },
  wild_berries: { itemId: "wild_berries", displayName: "Wild Berries", staminaRestore: 10, source: "crop" },
  fresh_milk: { itemId: "fresh_milk", displayName: "Fresh Milk", staminaRestore: 14, source: "livestock" },
};

const HARTHMERE_BIKKIE_FOOD_DEFINITIONS_V1: Record<string, HarthmereFoodDefinitionV1> =
  Object.fromEntries(
    HARTHMERE_BIKKIE_FOOD_ROWS_V1
      .filter(([, , , , edible]) => edible)
      .map(([
        itemId,
        displayName,
        staminaRestore,
        source,
        ,
        category,
        action,
        galoisPath,
        visualAsset,
      ]) => [
        itemId,
        {
          itemId,
          displayName,
          staminaRestore,
          source: source as HarthmereFoodSourceV1,
          metadata: optionalBikkieMetadata(
            itemId,
            displayName,
            category,
            action,
            galoisPath,
            visualAsset,
          ),
        },
      ]),
  );

export const HARTHMERE_FOOD_DEFINITIONS_V1: Record<string, HarthmereFoodDefinitionV1> = {
  ...HARTHMERE_LOCAL_FOOD_DEFINITIONS_V1,
  ...HARTHMERE_BIKKIE_FOOD_DEFINITIONS_V1,
};

const HARTHMERE_LOCAL_COOKING_RECIPES_V1: Record<string, HarthmereCookingRecipeV1> = {
  grilled_meat: {
    recipeId: "grilled_meat",
    displayName: "Grilled Meat",
    stationKind: "campfire",
    inputs: { raw_meat: 1 },
    outputs: { grilled_meat: 1 },
    cookTimeMs: 45_000,
    xp: 12,
    maxBatchCount: 10,
  },
  worker_meal: {
    recipeId: "worker_meal",
    displayName: "Worker Meal",
    stationKind: "cookpot",
    inputs: { loaf_bread: 1, fresh_carrot: 1 },
    outputs: { worker_meal: 2 },
    cookTimeMs: 90_000,
    xp: 16,
    maxBatchCount: 8,
  },
  hearty_stew: {
    recipeId: "hearty_stew",
    displayName: "Hearty Stew",
    stationKind: "cookpot",
    inputs: { grilled_meat: 1, fresh_carrot: 2, fresh_milk: 1 },
    outputs: { hearty_stew: 2 },
    cookTimeMs: 120_000,
    xp: 24,
    maxBatchCount: 6,
  },
  berry_tart: {
    recipeId: "berry_tart",
    displayName: "Wild Berry Tart",
    stationKind: "oven",
    inputs: { wild_berries: 2, loaf_bread: 1, fresh_milk: 1 },
    outputs: { berry_tart: 2 },
    cookTimeMs: 150_000,
    xp: 22,
    maxBatchCount: 6,
  },
};

const HARTHMERE_BIKKIE_COOKING_RECIPES_V1: Record<string, HarthmereCookingRecipeV1> =
  Object.fromEntries(
    HARTHMERE_BIKKIE_RECIPE_ROWS_V1.map(([
      recipeId,
      displayName,
      stationKind,
      inputs,
      outputs,
      cookTimeMs,
      xp,
      maxBatchCount,
      recipeType,
      category,
      action,
      galoisPath,
      visualAsset,
    ]) => [
      recipeId,
      {
        recipeId,
        displayName,
        stationKind: stationKind as HarthmereCookingStationKindV1,
        inputs: bagFromRows(inputs),
        outputs: bagFromRows(outputs),
        cookTimeMs,
        xp,
        maxBatchCount,
        recipeType: recipeType as HarthmereRecipeTypeV1,
        metadata: optionalBikkieMetadata(
          recipeId,
          displayName,
          category,
          action,
          galoisPath,
          visualAsset,
        ),
      },
    ]),
  );

export const HARTHMERE_COOKING_RECIPES_V1: Record<string, HarthmereCookingRecipeV1> = {
  ...HARTHMERE_LOCAL_COOKING_RECIPES_V1,
  ...HARTHMERE_BIKKIE_COOKING_RECIPES_V1,
};

export const HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS_V1 = 6 * 60 * 60 * 1000;

const HARTHMERE_LOCAL_SEED_DEFINITIONS_V1: Record<string, HarthmereSeedDefinitionV1> = {
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

const HARTHMERE_BIKKIE_SEED_DEFINITIONS_V1: Record<string, HarthmereSeedDefinitionV1> =
  Object.fromEntries(
    HARTHMERE_BIKKIE_SEED_ROWS_V1.map(([
      seedItemId,
      displayName,
      cropItemId,
      cropDisplayName,
      yieldItemId,
      yieldCount,
      growMs,
      source,
      requiresSun,
      waterIntervalMs,
      deathTimeMs,
      category,
      action,
      galoisPath,
      visualAsset,
    ]) => [
      seedItemId,
      {
        seedItemId,
        cropItemId,
        displayName,
        source: [...source] as HarthmereSeedSourceV1[],
        growMs,
        yieldItemId,
        yieldCount,
        cropDisplayName,
        ...(typeof requiresSun === "boolean" ? { requiresSun } : {}),
        ...(waterIntervalMs > 0 ? { waterIntervalMs } : {}),
        ...(deathTimeMs > 0 ? { deathTimeMs } : {}),
        metadata: optionalBikkieMetadata(
          seedItemId,
          displayName,
          category,
          action,
          galoisPath,
          visualAsset,
        ),
      },
    ]),
  );

export const HARTHMERE_SEED_DEFINITIONS_V1: Record<string, HarthmereSeedDefinitionV1> = {
  ...HARTHMERE_LOCAL_SEED_DEFINITIONS_V1,
  ...HARTHMERE_BIKKIE_SEED_DEFINITIONS_V1,
};

export const HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID_V1: Record<string, HarthmereBikkieItemMetadataV1> =
  Object.fromEntries([
    ...HARTHMERE_BIKKIE_FOOD_ROWS_V1.map(([
      itemId,
      displayName,
      ,
      ,
      ,
      category,
      action,
      galoisPath,
      visualAsset,
    ]) => [itemId, optionalBikkieMetadata(itemId, displayName, category, action, galoisPath, visualAsset)] as const),
    ...HARTHMERE_BIKKIE_SEED_ROWS_V1.map(([
      seedItemId,
      displayName,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      category,
      action,
      galoisPath,
      visualAsset,
    ]) => [seedItemId, optionalBikkieMetadata(seedItemId, displayName, category, action, galoisPath, visualAsset)] as const),
    ...HARTHMERE_BIKKIE_RECIPE_ROWS_V1.map(([
      recipeId,
      displayName,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      category,
      action,
      galoisPath,
      visualAsset,
    ]) => [recipeId, optionalBikkieMetadata(recipeId, displayName, category, action, galoisPath, visualAsset)] as const),
  ]);

export function harthmereFarmingFoodItemDisplayNameV1(
  itemId: string,
): string | undefined {
  return HARTHMERE_FOOD_DEFINITIONS_V1[itemId]?.displayName ??
    HARTHMERE_SEED_DEFINITIONS_V1[itemId]?.displayName ??
    HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID_V1[itemId]?.displayName ??
    Object.values(HARTHMERE_SEED_DEFINITIONS_V1).find(
      (seed) => seed.yieldItemId === itemId || seed.cropItemId === itemId,
    )?.cropDisplayName;
}

const HARTHMERE_LIVESTOCK_FEED_ITEMS_V1 = new Set([
  "seed_wheat",
  "seed_carrot",
  "fresh_carrot",
  "loaf_bread",
  "wild_berries",
  ...Object.keys(HARTHMERE_SEED_DEFINITIONS_V1),
  ...Object.values(HARTHMERE_FOOD_DEFINITIONS_V1)
    .filter((food) => food.source === "crop" || food.source === "foraged")
    .map((food) => food.itemId),
]);

export function isHarthmereLivestockFeedItemV1(itemId: string) {
  return HARTHMERE_LIVESTOCK_FEED_ITEMS_V1.has(itemId);
}

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
    livestock: {},
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

function normalizeCookingCount(count: number | undefined) {
  const value = count ?? 1;
  if (!Number.isFinite(value) || value < 1 || Math.trunc(value) !== value) {
    return undefined;
  }
  return value;
}

function normalizedMaxStaminaV1(
  state: Pick<HarthmereFoodStaminaStateV1, "maxStamina">,
) {
  return Math.max(
    1,
    Number.isFinite(state.maxStamina)
      ? Number(state.maxStamina)
      : HARTHMERE_DEFAULT_MAX_STAMINA_V1,
  );
}

function normalizedStaminaValueV1(
  state: Pick<HarthmereFoodStaminaStateV1, "stamina" | "maxStamina">,
) {
  const maxStamina = normalizedMaxStaminaV1(state);
  const stamina = Number(state.stamina);
  return Math.max(
    0,
    Math.min(maxStamina, Number.isFinite(stamina) ? stamina : maxStamina),
  );
}

function normalizedLastStaminaTickMsV1(
  state: Pick<HarthmereFoodStaminaStateV1, "lastStaminaTickMs">,
  nowMs: number,
) {
  return Number.isFinite(state.lastStaminaTickMs)
    ? Number(state.lastStaminaTickMs)
    : nowMs;
}

function cookingRecipeIdForInput(input: {
  recipeId?: string;
  rawItemId?: string;
}) {
  if (input.recipeId) return input.recipeId;
  if (input.rawItemId === "raw_meat") return "grilled_meat";
  if (input.rawItemId === "7539420629350042") return "753184055201246";
  if (input.rawItemId === "7539420629350036") return "7031555443006367";
  if (input.rawItemId === "5289515835017799") return "7819883493451062";
  return input.rawItemId ?? "";
}

export function plantHarthmereCropV1(
  state: HarthmereFoodStaminaStateV1,
  input: { plotId: string; seedItemId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  if (!input.plotId) return result(state, ["farming_rejected:missing_plot"]);
  const seed = HARTHMERE_SEED_DEFINITIONS_V1[input.seedItemId];
  if (!seed) return result(state, ["farming_rejected:unknown_seed"]);
  const occupying = state.plots[input.plotId];
  if (occupying && !occupying.harvestedAtMs && !occupying.diedAtMs) {
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
  if (plot.wateredAtMs) return result(state, ["farming_rejected:already_watered"]);
  return result({
    ...state,
    plots: {
      ...state.plots,
      [input.plotId]: {
        ...plot,
        wateredAtMs: input.nowMs,
        // Cap the watering bonus to a fraction of the crop's total grow time so a flat 1h
        // shave cannot zero-out (make instantly harvestable) a fast-growing crop whose
        // grow time is under an hour.
        harvestReadyAtMs: Math.max(
          input.nowMs,
          plot.harvestReadyAtMs -
            Math.min(
              60 * 60 * 1000,
              Math.floor(Math.max(0, plot.harvestReadyAtMs - (plot.plantedAtMs ?? input.nowMs)) * 0.25),
            ),
        ),
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
  if (plot.diedAtMs) return result(state, ["farming_rejected:crop_withered"]);
  const seed = HARTHMERE_SEED_DEFINITIONS_V1[plot.seedItemId];
  if (!seed) return result(state, ["farming_rejected:unknown_seed"]);
  // A crop left unharvested past its death window withers and yields nothing. The plot is
  // marked dead so it can be cleared and replanted (mirrors the harvested-plot flow).
  if (
    typeof seed.deathTimeMs === "number" &&
    seed.deathTimeMs > 0 &&
    input.nowMs >= plot.plantedAtMs + seed.deathTimeMs
  ) {
    return result(
      {
        ...state,
        plots: {
          ...state.plots,
          [input.plotId]: { ...plot, diedAtMs: input.nowMs },
        },
      },
      ["farming_rejected:crop_withered"],
    );
  }
  if (input.nowMs < plot.harvestReadyAtMs) return result(state, ["farming_rejected:not_ready"]);
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

export function forageHarthmereFoodSpawnV1(
  state: HarthmereFoodStaminaStateV1,
  input: { spawnId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const spawn = state.spawns[input.spawnId];
  if (!spawn || spawn.kind !== "food") return result(state, ["forage_rejected:unknown_food_spawn"]);
  if (spawn.depletedAtMs) return result(state, ["forage_rejected:spawn_depleted"]);
  const itemId = spawn.itemId ?? "";
  if (!HARTHMERE_FOOD_DEFINITIONS_V1[itemId]) return result(state, ["forage_rejected:not_food"]);
  return result({
    ...state,
    inventory: addItem(state.inventory, itemId, 1),
    spawns: {
      ...state.spawns,
      [input.spawnId]: {
        ...spawn,
        depletedAtMs: input.nowMs,
        respawnAtMs: input.nowMs + HARTHMERE_HALF_DAY_MS_V1,
      },
    },
  }, [], { [itemId]: 1 });
}

export function huntHarthmereAnimalForFoodV1(
  state: HarthmereFoodStaminaStateV1,
  input: { animalId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const spawn = state.spawns[input.animalId];
  if (!spawn || spawn.kind !== "animal") return result(state, ["hunt_rejected:unknown_animal"]);
  if (spawn.isLivestock) return result(state, ["hunt_rejected:livestock_requires_care_action"]);
  if (spawn.protected) return result(state, ["hunt_rejected:protected_species"]);
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

export function feedHarthmereLivestockV1(
  state: HarthmereFoodStaminaStateV1,
  input: { livestockId: string; feedItemId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const livestock = state.livestock[input.livestockId];
  if (!livestock) return result(state, ["livestock_rejected:unknown_livestock"]);
  if (!isHarthmereLivestockFeedItemV1(input.feedItemId)) {
    return result(state, ["livestock_rejected:invalid_feed"]);
  }
  const missing = requireItem(state, input.feedItemId, 1, "livestock_rejected:missing_feed");
  if (missing) return result(state, [missing]);
  // Normalize possibly-corrupt (NaN) persisted values before arithmetic, mirroring the
  // stamina path; without this a NaN health/hunger stays NaN forever and the care gate
  // (`< 25`) silently passes.
  const baseHealth = Number.isFinite(livestock.health) ? livestock.health : 0;
  const baseHunger = Number.isFinite(livestock.hunger) ? livestock.hunger : 0;
  const health = Math.min(100, Math.max(0, baseHealth) + 8);
  const hunger = Math.min(100, Math.max(0, baseHunger) + 35);
  return result({
    ...state,
    inventory: addItem(state.inventory, input.feedItemId, -1),
    livestock: {
      ...state.livestock,
      [input.livestockId]: {
        ...livestock,
        health,
        hunger,
        lastFedAtMs: input.nowMs,
        // Feeding maintains the animal but must NOT shorten the product timer — taking the
        // min let players spam-feed to pull a far-future product ready time earlier.
        productReadyAtMs: livestock.productReadyAtMs,
      },
    },
  }, [], { [input.feedItemId]: -1 });
}

export function collectHarthmereLivestockProductV1(
  state: HarthmereFoodStaminaStateV1,
  input: { livestockId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  const livestock = state.livestock[input.livestockId];
  if (!livestock) return result(state, ["livestock_rejected:unknown_livestock"]);
  // Treat a corrupt (NaN) value as "needs care" rather than letting `NaN < 25` (false)
  // wave the collection through.
  const careHealth = Number.isFinite(livestock.health) ? livestock.health : 0;
  const careHunger = Number.isFinite(livestock.hunger) ? livestock.hunger : 0;
  if (careHealth < 25 || careHunger < 25) {
    return result(state, ["livestock_rejected:animal_needs_care"]);
  }
  if (input.nowMs < livestock.productReadyAtMs) {
    return result(state, ["livestock_rejected:product_not_ready"]);
  }
  return result({
    ...state,
    inventory: addItem(state.inventory, livestock.productItemId, 1),
    livestock: {
      ...state.livestock,
      [input.livestockId]: {
        ...livestock,
        hunger: Math.max(0, livestock.hunger - 15),
        productReadyAtMs: input.nowMs + HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS_V1,
        lastCollectedAtMs: input.nowMs,
      },
    },
  }, [], { [livestock.productItemId]: 1 });
}

export function cookHarthmereFoodV1(
  state: HarthmereFoodStaminaStateV1,
  input: {
    recipeId?: string;
    rawItemId?: string;
    stationKind?: HarthmereCookingStationKindV1;
    count?: number;
    nowMs: number;
  },
): HarthmereFoodStaminaResultV1 {
  const recipeId = cookingRecipeIdForInput(input);
  const recipe = HARTHMERE_COOKING_RECIPES_V1[recipeId];
  if (!recipe) return result(state, ["cooking_rejected:unknown_recipe"]);
  const count = normalizeCookingCount(input.count);
  if (!count) return result(state, ["cooking_rejected:invalid_count"]);
  if (count > recipe.maxBatchCount) return result(state, ["cooking_rejected:batch_too_large"]);
  const stationKind = input.stationKind ?? "campfire";
  if (recipe.stationKind !== "field" && stationKind !== recipe.stationKind) {
    return result(state, [`cooking_rejected:missing_station:${recipe.stationKind}`]);
  }
  for (const [itemId, itemCount] of Object.entries(recipe.inputs)) {
    const warning = itemId === "raw_meat"
      ? "cooking_rejected:missing_raw_food"
      : `cooking_rejected:missing_input:${itemId}`;
    const missing = requireItem(state, itemId, itemCount * count, warning);
    if (missing) return result(state, [missing]);
  }
  let inventory = { ...state.inventory };
  const inventoryDeltas: Record<string, number> = {};
  for (const [itemId, itemCount] of Object.entries(recipe.inputs)) {
    const delta = -itemCount * count;
    inventory = addItem(inventory, itemId, delta);
    inventoryDeltas[itemId] = (inventoryDeltas[itemId] ?? 0) + delta;
  }
  for (const [itemId, itemCount] of Object.entries(recipe.outputs)) {
    const delta = itemCount * count;
    inventory = addItem(inventory, itemId, delta);
    inventoryDeltas[itemId] = (inventoryDeltas[itemId] ?? 0) + delta;
  }
  return result({
    ...state,
    inventory,
  }, [], inventoryDeltas);
}

export function eatHarthmereFoodV1(
  state: HarthmereFoodStaminaStateV1,
  input: { itemId: string; nowMs: number },
): HarthmereFoodStaminaResultV1 {
  if (
    state.deadFromStaminaAtMs !== undefined ||
    normalizedStaminaValueV1(state) <= 0
  ) {
    return result(state, ["food_rejected:stamina_depleted"]);
  }
  const food = HARTHMERE_FOOD_DEFINITIONS_V1[input.itemId];
  if (!food) return result(state, ["food_rejected:not_food"]);
  if (food.edible === false || food.staminaRestore <= 0) {
    return result(state, ["food_rejected:not_edible"]);
  }
  const missing = requireItem(state, input.itemId, 1, "food_rejected:missing_food");
  if (missing) return result(state, [missing]);
  const maxStamina = normalizedMaxStaminaV1(state);
  const lastStaminaTickMs = normalizedLastStaminaTickMsV1(state, input.nowMs);
  // Apply the stamina drain that accrued since the last tick BEFORE crediting the
  // restore, then advance the clock. Otherwise eating discards the pending drain
  // (advancing lastStaminaTickMs to now while adding to the stale stored value), which
  // silently grants up to a full survival-interval of free stamina per meal. Mirrors the
  // drain math in tickHarthmereStaminaV1.
  const elapsedMs = Math.max(0, input.nowMs - lastStaminaTickMs);
  // Constant drain rate so 100 stamina always equals 2 hours of gameplay (see constant).
  const drained = (elapsedMs / 60_000) * HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1;
  const currentStamina = Math.max(0, normalizedStaminaValueV1(state) - drained);
  if (currentStamina <= 0) {
    // Drained to empty before the meal — the player has starved; a subsequent tick
    // formalizes the death. Eating cannot revive from zero.
    return result(state, ["food_rejected:stamina_depleted"]);
  }
  return result({
    ...state,
    stamina: Math.min(maxStamina, currentStamina + food.staminaRestore),
    maxStamina,
    lastStaminaTickMs: Math.max(lastStaminaTickMs, input.nowMs),
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
  const maxStamina = normalizedMaxStaminaV1(state);
  const lastStaminaTickMs = normalizedLastStaminaTickMsV1(state, nowMs);
  const elapsedMs = Math.max(0, nowMs - lastStaminaTickMs);
  // Constant drain rate so 100 stamina always equals 2 hours of gameplay (see constant).
  const drained = (elapsedMs / 60_000) * HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1;
  const nextStamina = Math.max(0, normalizedStaminaValueV1(state) - drained);
  const deathTriggered = nextStamina <= 0 && !state.deadFromStaminaAtMs;
  return result({
    ...state,
    stamina: nextStamina,
    maxStamina,
    lastStaminaTickMs: Math.max(lastStaminaTickMs, nowMs),
    deadFromStaminaAtMs: deathTriggered ? nowMs : state.deadFromStaminaAtMs,
  }, deathTriggered ? ["stamina_depleted:death_triggered"] : [], {}, deathTriggered);
}

export function restoreHarthmereStaminaToFullV1(
  state: HarthmereFoodStaminaStateV1,
  nowMs: number,
): HarthmereFoodStaminaResultV1 {
  const maxStamina = Math.max(
    1,
    Number.isFinite(state.maxStamina)
      ? state.maxStamina
      : HARTHMERE_DEFAULT_MAX_STAMINA_V1,
  );
  return result({
    ...state,
    stamina: maxStamina,
    maxStamina,
    lastStaminaTickMs: nowMs,
    deadFromStaminaAtMs: undefined,
  });
}

export function tickHarthmereStaminaForGameplayV1(
  state: HarthmereFoodStaminaStateV1,
  input: { nowMs: number; gameplayActive: boolean },
): HarthmereFoodStaminaResultV1 {
  if (!input.gameplayActive) {
    // Stamina is only spent while the player is actually in the game world.
    // Menus, onboarding, hidden tabs, and disconnected/restarting clients
    // advance the timestamp without draining so players do not log back into
    // an unavoidable starvation death.
    const lastStaminaTickMs = normalizedLastStaminaTickMsV1(state, input.nowMs);
    return result({
      ...state,
      stamina: normalizedStaminaValueV1(state),
      maxStamina: normalizedMaxStaminaV1(state),
      lastStaminaTickMs: Math.max(lastStaminaTickMs, input.nowMs),
    });
  }
  return tickHarthmereStaminaV1(state, input.nowMs);
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
