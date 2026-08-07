import {
  HARTHMERE_BIKKIE_FOOD_ROWS,
  HARTHMERE_BIKKIE_RECIPE_ROWS,
  HARTHMERE_BIKKIE_SEED_ROWS,
  type HarthmereBikkieItemMetadata,
} from "./mmo_bikkie_farming_food_catalog";
import {
  harthmereInventoryEncumbranceStaminaMultiplier,
} from "./mmo_carry_weight";
import {
  harthmereDeterministicYieldCount,
  harthmereSublevelEfficiencyMultiplier,
  harthmereSublevelPotencyMultiplier,
  harthmereSublevelYieldMultiplier,
} from "./harthmere_sublevel_benefits";

export const HARTHMERE_FARMING_FOOD_STAMINA_VERSION =
  "harthmere-farming-food-stamina" as const;

export const HARTHMERE_HALF_DAY_MS = 12 * 60 * 60 * 1000;
export const HARTHMERE_DEFAULT_MAX_STAMINA = 100;
/** Real-time survival clock: 100 points of stamina drain over 2 hours of active gameplay.
 *  This is a CONSTANT rate (independent of max stamina), so "every 100 stamina = 2 hours"
 *  holds for every player — a larger max bar simply lasts proportionally longer. */
export const HARTHMERE_STAMINA_MINUTES_PER_100 = 2 * 60;
export const HARTHMERE_STAMINA_DRAIN_PER_MINUTE =
  100 / HARTHMERE_STAMINA_MINUTES_PER_100;
/** Minutes a DEFAULT (100) stamina bar lasts before starvation, derived from the constant
 *  drain rate (= 120 min). Retained for callers/tests that reason about the default bar. */
export const HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES =
  HARTHMERE_DEFAULT_MAX_STAMINA / HARTHMERE_STAMINA_DRAIN_PER_MINUTE;

export type HarthmereSeedSource = "vendor" | "world" | "monster";
export type HarthmereSpawnKind = "food" | "animal" | "seed" | "monster";
export type HarthmereLivestockSpecies = "cow" | "goat" | "chicken";
export type HarthmereFoodSource =
  | "crop"
  | "animal"
  | "hunt"
  | "vendor"
  | "cooked"
  | "livestock"
  | "foraged"
  | "fish"
  | "drink";
export type HarthmereCookingStationKind =
  | "field"
  | "campfire"
  | "cookpot"
  | "oven";
export type HarthmereRecipeType = "cooking" | "seed" | "fertilizer";

export interface HarthmereFoodDefinition {
  itemId: string;
  displayName: string;
  staminaRestore: number;
  source: HarthmereFoodSource;
  edible?: boolean;
  metadata?: HarthmereBikkieItemMetadata;
}

export interface HarthmereSeedDefinition {
  seedItemId: string;
  cropItemId: string;
  displayName: string;
  source: HarthmereSeedSource[];
  growMs: number;
  yieldItemId: string;
  yieldCount: number;
  cropDisplayName?: string;
  requiresSun?: boolean;
  waterIntervalMs?: number;
  deathTimeMs?: number;
  metadata?: HarthmereBikkieItemMetadata;
}

export interface HarthmereCookingRecipe {
  recipeId: string;
  displayName: string;
  stationKind: HarthmereCookingStationKind;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  cookTimeMs: number;
  xp: number;
  maxBatchCount: number;
  requiredSkillLevel: number;
  recipeType?: HarthmereRecipeType;
  metadata?: HarthmereBikkieItemMetadata;
}

/** A single timer-based cooking job sitting in one station's FIFO queue.
 *  Ingredients are reserved (removed from inventory) at enqueue time; the
 *  start/ready timestamps are stamped deterministically at enqueue so the
 *  queue resumes identically across logout/reload. */
export type HarthmereCookingJobStatus = "pending" | "cooking" | "ready";
export interface HarthmereCookingJob {
  jobId: string;
  recipeId: string;
  count: number;
  status: HarthmereCookingJobStatus;
  enqueuedAtMs: number;
  startedAtMs: number;
  readyAtMs: number;
  /** Skill is captured at enqueue so a queued job remains deterministic. */
  cookingSkillLevel?: number;
  /** Inputs removed from inventory at enqueue; refunded if the job is cancelled. */
  reservedInputs: Record<string, number>;
}

/** Per-physical-station cooking state: one active job + a FIFO queue, keyed in
 *  state.cooking by a stable station id (placed-placeable ECS id or named landmark). */
export interface HarthmereCookingStationState {
  stationId: string;
  stationKind: HarthmereCookingStationKind;
  label?: string;
  jobs: HarthmereCookingJob[];
}

export interface HarthmereFarmingPlot {
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

export interface HarthmereWorldSpawn {
  spawnId: string;
  kind: HarthmereSpawnKind;
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

export interface HarthmereLivestock {
  livestockId: string;
  species: HarthmereLivestockSpecies;
  ownerId: string;
  health: number;
  hunger: number;
  productItemId: string;
  productReadyAtMs: number;
  lastFedAtMs?: number;
  lastCollectedAtMs?: number;
}

export interface HarthmereFoodStaminaState {
  stateVersion?: typeof HARTHMERE_FARMING_FOOD_STAMINA_VERSION;
  actorId: string;
  stamina: number;
  maxStamina: number;
  lastStaminaTickMs: number;
  deadFromStaminaAtMs?: number;
  inventory: Record<string, number>;
  plots: Record<string, HarthmereFarmingPlot>;
  spawns: Record<string, HarthmereWorldSpawn>;
  livestock: Record<string, HarthmereLivestock>;
  /** Timer-based cooking queues keyed by physical station id. */
  cooking: Record<string, HarthmereCookingStationState>;
}

export interface HarthmereFoodStaminaResult {
  state: HarthmereFoodStaminaState;
  warnings: string[];
  inventoryDeltas: Record<string, number>;
  deathTriggered: boolean;
  /** Cooking XP earned when a cook job is collected (granted by the reducer). */
  cookingXpDelta?: number;
}

function optionalBikkieMetadata(
  bikkieId: string,
  displayName: string,
  category: string,
  action: string,
  galoisPath: string,
  visualAsset: string,
): HarthmereBikkieItemMetadata {
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

const HARTHMERE_LOCAL_FOOD_DEFINITIONS: Record<
  string,
  HarthmereFoodDefinition
> = {
  road_ration: {
    itemId: "road_ration",
    displayName: "Road Ration",
    staminaRestore: 24,
    source: "vendor",
    edible: true,
  },
  apple_tart: {
    itemId: "apple_tart",
    displayName: "Warm Apple Tart",
    staminaRestore: 18,
    source: "cooked",
    edible: true,
  },
  fresh_carrot: {
    itemId: "fresh_carrot",
    displayName: "Fresh Carrot",
    staminaRestore: 12,
    source: "crop",
    edible: true,
  },
  loaf_bread: {
    itemId: "loaf_bread",
    displayName: "Loaf Bread",
    staminaRestore: 20,
    source: "cooked",
    edible: true,
  },
  grilled_meat: {
    itemId: "grilled_meat",
    displayName: "Grilled Meat",
    staminaRestore: 32,
    source: "cooked",
    edible: true,
  },
  worker_meal: {
    itemId: "worker_meal",
    displayName: "Worker Meal",
    staminaRestore: 16,
    source: "cooked",
    edible: true,
  },
  hearty_stew: {
    itemId: "hearty_stew",
    displayName: "Hearty Stew",
    staminaRestore: 38,
    source: "cooked",
    edible: true,
  },
  berry_tart: {
    itemId: "berry_tart",
    displayName: "Wild Berry Tart",
    staminaRestore: 28,
    source: "cooked",
    edible: true,
  },
  river_trout: {
    itemId: "river_trout",
    displayName: "River Trout",
    staminaRestore: 22,
    source: "fish",
    edible: false,
  },
  wild_berries: {
    itemId: "wild_berries",
    displayName: "Wild Berries",
    staminaRestore: 10,
    source: "foraged",
    edible: true,
  },
  fresh_milk: {
    itemId: "fresh_milk",
    displayName: "Fresh Milk",
    staminaRestore: 14,
    source: "drink",
    edible: true,
  },
};

function isHarthmereFoodRowPlayerEdible(input: {
  displayName: string;
  staminaRestore: number;
  source: string;
  catalogEdible: boolean;
  category: string;
  action: string;
}) {
  if (!input.catalogEdible || input.staminaRestore <= 0) return false;
  const source = input.source.toLowerCase();
  const category = input.category.toLowerCase();
  const action = input.action.toLowerCase();
  const text = `${input.displayName} ${category} ${action}`.toLowerCase();
  if (/\b(raw|uncooked)\b/.test(text)) return false;
  if (/wheat|grain/.test(text) && source !== "cooked") return false;
  if (source === "cooked" || source === "drink") return true;
  if (action === "drink") return true;
  if (source === "fish" && !/baked|cooked|roasted|sashimi|sandwich/.test(text))
    return false;
  if (action === "eat") return true;
  if (/fruit|berry|vegetable|mushroom/.test(category)) return true;
  if (source === "foraged" && /mushroom|berry|carrot|turnip|radish/.test(text))
    return true;
  return false;
}

function isHarthmereFoodDefinitionPlayerEdible(
  food: HarthmereFoodDefinition
) {
  if (food.staminaRestore <= 0) return false;
  if (food.edible !== false) return true;
  const metadata = food.metadata;
  const action = String(metadata?.action ?? "").toLowerCase();
  const source = String(food.source ?? "").toLowerCase();
  const text = `${food.displayName} ${food.source} ${
    metadata?.category ?? ""
  } ${action}`.toLowerCase();
  if (/\b(raw|uncooked)\b/.test(text)) return false;
  if (/wheat|grain/.test(text) && source !== "cooked") return false;
  if (source === "fish" && !/baked|cooked|roasted|sashimi|sandwich/.test(text))
    return false;
  return (
    action === "eat" ||
    action === "drink" ||
    source === "cooked" ||
    source === "drink" ||
    /fruit|berry|vegetable|mushroom/.test(text)
  );
}

const HARTHMERE_BIKKIE_FOOD_DEFINITIONS: Record<string, HarthmereFoodDefinition> =
  Object.fromEntries(
    HARTHMERE_BIKKIE_FOOD_ROWS
      .map(([
        itemId,
        displayName,
        staminaRestore,
        source,
        edible,
        category,
        action,
        galoisPath,
        visualAsset,
      ]) => {
        const playerEdible = isHarthmereFoodRowPlayerEdible({
          displayName,
          staminaRestore,
          source,
          catalogEdible: edible,
          category,
          action,
        });
        return [
          itemId,
          {
            itemId,
            displayName,
            staminaRestore,
            source: source as HarthmereFoodSource,
            edible: playerEdible,
            metadata: optionalBikkieMetadata(
              itemId,
              displayName,
              category,
              action,
              galoisPath,
              visualAsset,
            ),
          },
        ];
      }),
  );

export const HARTHMERE_FOOD_DEFINITIONS: Record<string, HarthmereFoodDefinition> = {
  ...HARTHMERE_LOCAL_FOOD_DEFINITIONS,
  ...HARTHMERE_BIKKIE_FOOD_DEFINITIONS,
};

const HARTHMERE_LOCAL_COOKING_RECIPES: Record<string, HarthmereCookingRecipe> = {
  harthmere_grove_festival_skewer: {
    recipeId: "harthmere_grove_festival_skewer",
    displayName: "Carlo's Festival Skewer",
    stationKind: "campfire",
    inputs: { grove_festival_skewer_ingredients: 1 },
    outputs: { grove_festival_skewer: 1 },
    cookTimeMs: 45_000,
    xp: 12,
    maxBatchCount: 5,
    requiredSkillLevel: 1,
  },
  grilled_meat: {
    recipeId: "grilled_meat",
    displayName: "Grilled Meat",
    stationKind: "campfire",
    inputs: { raw_meat: 1 },
    outputs: { grilled_meat: 1 },
    cookTimeMs: 45_000,
    xp: 12,
    maxBatchCount: 10,
    requiredSkillLevel: 1,
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
    requiredSkillLevel: 10,
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
    requiredSkillLevel: 20,
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
    requiredSkillLevel: 35,
  },
};

const HARTHMERE_BIKKIE_COOKING_RECIPES: Record<string, HarthmereCookingRecipe> =
  Object.fromEntries(
    HARTHMERE_BIKKIE_RECIPE_ROWS.map(([
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
        stationKind: stationKind as HarthmereCookingStationKind,
        inputs: bagFromRows(inputs),
        outputs: bagFromRows(outputs),
        cookTimeMs,
        xp,
        maxBatchCount,
        requiredSkillLevel:
          recipeType !== "cooking"
            ? 1
            : stationKind === "oven"
              ? 35
              : stationKind === "cookpot"
                ? Math.max(10, Math.min(20, Math.ceil(xp / 2)))
                : 1,
        recipeType: recipeType as HarthmereRecipeType,
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

export const HARTHMERE_COOKING_RECIPES: Record<string, HarthmereCookingRecipe> = {
  ...HARTHMERE_LOCAL_COOKING_RECIPES,
  ...HARTHMERE_BIKKIE_COOKING_RECIPES,
};

export const HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS = 6 * 60 * 60 * 1000;

const HARTHMERE_LOCAL_SEED_DEFINITIONS: Record<string, HarthmereSeedDefinition> = {
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

/** Some authored Bikkie water intervals are nonsensical (hundreds-to-millions of
 *  days — clearly bad data). Clamp every seed's interval into a sane band so the
 *  field is meaningful for the watering mechanic and the UI. */
export const HARTHMERE_FARM_MIN_WATER_INTERVAL_MS = 30 * 60 * 1000; // 30 min
export const HARTHMERE_FARM_MAX_WATER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
function clampWaterIntervalMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(
    HARTHMERE_FARM_MAX_WATER_INTERVAL_MS,
    Math.max(HARTHMERE_FARM_MIN_WATER_INTERVAL_MS, Math.round(value)),
  );
}

const HARTHMERE_BIKKIE_SEED_DEFINITIONS: Record<string, HarthmereSeedDefinition> =
  Object.fromEntries(
    HARTHMERE_BIKKIE_SEED_ROWS.map(([
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
        source: [...source] as HarthmereSeedSource[],
        growMs,
        yieldItemId,
        yieldCount,
        cropDisplayName,
        ...(typeof requiresSun === "boolean" ? { requiresSun } : {}),
        ...(clampWaterIntervalMs(waterIntervalMs) > 0
          ? { waterIntervalMs: clampWaterIntervalMs(waterIntervalMs) }
          : {}),
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

export const HARTHMERE_SEED_DEFINITIONS: Record<string, HarthmereSeedDefinition> = {
  ...HARTHMERE_LOCAL_SEED_DEFINITIONS,
  ...HARTHMERE_BIKKIE_SEED_DEFINITIONS,
};

export const HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID: Record<string, HarthmereBikkieItemMetadata> =
  Object.fromEntries([
    ...HARTHMERE_BIKKIE_FOOD_ROWS.map(([
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
    ...HARTHMERE_BIKKIE_SEED_ROWS.map(([
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
    ...HARTHMERE_BIKKIE_RECIPE_ROWS.map(([
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

export function harthmereFarmingFoodItemDisplayName(
  itemId: string,
): string | undefined {
  return HARTHMERE_FOOD_DEFINITIONS[itemId]?.displayName ??
    HARTHMERE_SEED_DEFINITIONS[itemId]?.displayName ??
    HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID[itemId]?.displayName ??
    Object.values(HARTHMERE_SEED_DEFINITIONS).find(
      (seed) => seed.yieldItemId === itemId || seed.cropItemId === itemId,
    )?.cropDisplayName;
}

const HARTHMERE_LIVESTOCK_FEED_ITEMS = new Set([
  "seed_wheat",
  "seed_carrot",
  "fresh_carrot",
  "loaf_bread",
  "wild_berries",
  ...Object.keys(HARTHMERE_SEED_DEFINITIONS),
  ...Object.values(HARTHMERE_FOOD_DEFINITIONS)
    .filter((food) => food.source === "crop" || food.source === "foraged")
    .map((food) => food.itemId),
]);

export function isHarthmereLivestockFeedItem(itemId: string) {
  return HARTHMERE_LIVESTOCK_FEED_ITEMS.has(itemId);
}

export function defaultHarthmereFoodStaminaState(
  actorId: string,
  nowMs: number,
): HarthmereFoodStaminaState {
  return {
    stateVersion: HARTHMERE_FARMING_FOOD_STAMINA_VERSION,
    actorId,
    stamina: HARTHMERE_DEFAULT_MAX_STAMINA,
    maxStamina: HARTHMERE_DEFAULT_MAX_STAMINA,
    lastStaminaTickMs: nowMs,
    inventory: { road_ration: 2 },
    plots: {},
    spawns: {},
    livestock: {},
    cooking: {},
  };
}

function result(
  state: HarthmereFoodStaminaState,
  warnings: string[] = [],
  inventoryDeltas: Record<string, number> = {},
  deathTriggered = false,
): HarthmereFoodStaminaResult {
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
  state: HarthmereFoodStaminaState,
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

function normalizedMaxStamina(
  state: Pick<HarthmereFoodStaminaState, "maxStamina">,
) {
  return Math.max(
    1,
    Number.isFinite(state.maxStamina)
      ? Number(state.maxStamina)
      : HARTHMERE_DEFAULT_MAX_STAMINA,
  );
}

function normalizedStaminaValue(
  state: Pick<HarthmereFoodStaminaState, "stamina" | "maxStamina">,
) {
  const maxStamina = normalizedMaxStamina(state);
  const stamina = Number(state.stamina);
  return Math.max(
    0,
    Math.min(maxStamina, Number.isFinite(stamina) ? stamina : maxStamina),
  );
}

function normalizedLastStaminaTickMs(
  state: Pick<HarthmereFoodStaminaState, "lastStaminaTickMs">,
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

export function plantHarthmereCrop(
  state: HarthmereFoodStaminaState,
  input: {
    plotId: string;
    seedItemId: string;
    nowMs: number;
    /** Whether the target plot gets sun. Defaults to sunny when unknown, so this
     *  only rejects when the caller explicitly reports shade for a sun crop. */
    plotHasSun?: boolean;
    farmingSkillLevel?: number;
  },
): HarthmereFoodStaminaResult {
  if (!input.plotId) return result(state, ["farming_rejected:missing_plot"]);
  const seed = HARTHMERE_SEED_DEFINITIONS[input.seedItemId];
  if (!seed) return result(state, ["farming_rejected:unknown_seed"]);
  // A sun-loving crop cannot be planted in a shaded plot.
  if (seed.requiresSun === true && input.plotHasSun === false) {
    return result(state, ["farming_rejected:requires_sun"]);
  }
  const occupying = state.plots[input.plotId];
  if (occupying && !occupying.harvestedAtMs && !occupying.diedAtMs) {
    return result(state, ["farming_rejected:plot_occupied"]);
  }
  const missing = requireItem(state, input.seedItemId, 1, "farming_rejected:missing_seed");
  if (missing) return result(state, [missing]);
  const plot: HarthmereFarmingPlot = {
    plotId: input.plotId,
    seedItemId: input.seedItemId,
    cropItemId: seed.cropItemId,
    plantedAtMs: input.nowMs,
    harvestReadyAtMs:
      input.nowMs +
      Math.max(
        1,
        Math.round(
          seed.growMs *
            harthmereSublevelEfficiencyMultiplier(input.farmingSkillLevel ?? 1),
        ),
      ),
  };
  return result({
    ...state,
    inventory: addItem(state.inventory, input.seedItemId, -1),
    plots: { ...state.plots, [input.plotId]: plot },
  }, [], { [input.seedItemId]: -1 });
}

export function waterHarthmereCrop(
  state: HarthmereFoodStaminaState,
  input: { plotId: string; nowMs: number },
): HarthmereFoodStaminaResult {
  const plot = state.plots[input.plotId];
  if (!plot || plot.harvestedAtMs) {
    return result(state, ["farming_rejected:unknown_active_plot"]);
  }
  if (plot.diedAtMs) return result(state, ["farming_rejected:crop_withered"]);
  // Watering is REPEATABLE (you tend a crop over its life). Recording the latest
  // watering is what earns the full-harvest yield — an unwatered crop still grows
  // on rain/soil moisture but yields less (see harvestHarthmereCrop). It does
  // not change the grow timer, so watering can never make a crop instantly ripe.
  return result({
    ...state,
    plots: {
      ...state.plots,
      [input.plotId]: { ...plot, wateredAtMs: input.nowMs },
    },
  });
}

export function harvestHarthmereCrop(
  state: HarthmereFoodStaminaState,
  input: { plotId: string; nowMs: number; farmingSkillLevel?: number },
): HarthmereFoodStaminaResult {
  const plot = state.plots[input.plotId];
  if (!plot) return result(state, ["farming_rejected:unknown_plot"]);
  if (plot.harvestedAtMs) return result(state, ["farming_rejected:already_harvested"]);
  if (plot.diedAtMs) return result(state, ["farming_rejected:crop_withered"]);
  const seed = HARTHMERE_SEED_DEFINITIONS[plot.seedItemId];
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
  // Watering pays off at harvest: a tended (watered) crop yields its full count;
  // an unwatered crop still produces, but a reduced harvest (never below 1).
  const watered = typeof plot.wateredAtMs === "number";
  const baseYieldCount = watered
    ? seed.yieldCount
    : Math.max(1, Math.ceil(seed.yieldCount / 2));
  const yieldCount = harthmereDeterministicYieldCount({
    baseCount: baseYieldCount,
    multiplier: harthmereSublevelYieldMultiplier(input.farmingSkillLevel ?? 1),
    seed: `${input.plotId}:${plot.plantedAtMs}:${seed.yieldItemId}`,
  });
  return result({
    ...state,
    inventory: addItem(state.inventory, seed.yieldItemId, yieldCount),
    plots: {
      ...state.plots,
      [input.plotId]: { ...plot, harvestedAtMs: input.nowMs },
    },
  }, [], { [seed.yieldItemId]: yieldCount });
}

export function gatherHarthmereSeed(
  state: HarthmereFoodStaminaState,
  input: { seedItemId: string; source: HarthmereSeedSource; nowMs: number },
): HarthmereFoodStaminaResult {
  const seed = HARTHMERE_SEED_DEFINITIONS[input.seedItemId];
  if (!seed) return result(state, ["farming_rejected:unknown_seed"]);
  if (!seed.source.includes(input.source)) return result(state, ["farming_rejected:invalid_seed_source"]);
  return result({
    ...state,
    inventory: addItem(state.inventory, input.seedItemId, 1),
  }, [], { [input.seedItemId]: 1 });
}

export function forageHarthmereFoodSpawn(
  state: HarthmereFoodStaminaState,
  input: { spawnId: string; nowMs: number },
): HarthmereFoodStaminaResult {
  const spawn = state.spawns[input.spawnId];
  if (!spawn || spawn.kind !== "food") return result(state, ["forage_rejected:unknown_food_spawn"]);
  if (spawn.depletedAtMs) return result(state, ["forage_rejected:spawn_depleted"]);
  const itemId = spawn.itemId ?? "";
  if (!HARTHMERE_FOOD_DEFINITIONS[itemId]) return result(state, ["forage_rejected:not_food"]);
  return result({
    ...state,
    inventory: addItem(state.inventory, itemId, 1),
    spawns: {
      ...state.spawns,
      [input.spawnId]: {
        ...spawn,
        depletedAtMs: input.nowMs,
        respawnAtMs: input.nowMs + HARTHMERE_HALF_DAY_MS,
      },
    },
  }, [], { [itemId]: 1 });
}

export function huntHarthmereAnimalForFood(
  state: HarthmereFoodStaminaState,
  input: { animalId: string; nowMs: number; trackingSkillLevel?: number },
): HarthmereFoodStaminaResult {
  const spawn = state.spawns[input.animalId];
  if (!spawn || spawn.kind !== "animal") return result(state, ["hunt_rejected:unknown_animal"]);
  if (spawn.isLivestock) return result(state, ["hunt_rejected:livestock_requires_care_action"]);
  if (spawn.protected) return result(state, ["hunt_rejected:protected_species"]);
  if ((spawn.hp ?? spawn.maxHp ?? 1) > 0) return result(state, ["hunt_rejected:animal_not_killed"]);
  if (spawn.depletedAtMs) return result(state, ["hunt_rejected:already_harvested"]);
  const meatCount = harthmereDeterministicYieldCount({
    baseCount: 2,
    multiplier: harthmereSublevelYieldMultiplier(
      input.trackingSkillLevel ?? 1
    ),
    seed: `${input.animalId}:${input.nowMs}`,
  });
  return result({
    ...state,
    inventory: addItem(state.inventory, "raw_meat", meatCount),
    spawns: {
      ...state.spawns,
      [input.animalId]: {
        ...spawn,
        depletedAtMs: input.nowMs,
        respawnAtMs: input.nowMs + HARTHMERE_HALF_DAY_MS,
      },
    },
  }, [], { raw_meat: meatCount });
}

export function feedHarthmereLivestock(
  state: HarthmereFoodStaminaState,
  input: { livestockId: string; feedItemId: string; nowMs: number },
): HarthmereFoodStaminaResult {
  const livestock = state.livestock[input.livestockId];
  if (!livestock) return result(state, ["livestock_rejected:unknown_livestock"]);
  if (!isHarthmereLivestockFeedItem(input.feedItemId)) {
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

export function collectHarthmereLivestockProduct(
  state: HarthmereFoodStaminaState,
  input: { livestockId: string; nowMs: number },
): HarthmereFoodStaminaResult {
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
        productReadyAtMs: input.nowMs + HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS,
        lastCollectedAtMs: input.nowMs,
      },
    },
  }, [], { [livestock.productItemId]: 1 });
}

export function cookHarthmereFood(
  state: HarthmereFoodStaminaState,
  input: {
    recipeId?: string;
    rawItemId?: string;
    stationKind?: HarthmereCookingStationKind;
    count?: number;
    nowMs: number;
    cookingSkillLevel?: number;
  },
): HarthmereFoodStaminaResult {
  const recipeId = cookingRecipeIdForInput(input);
  const recipe = HARTHMERE_COOKING_RECIPES[recipeId];
  if (!recipe) return result(state, ["cooking_rejected:unknown_recipe"]);
  const count = normalizeCookingCount(input.count);
  if (!count) return result(state, ["cooking_rejected:invalid_count"]);
  const cookingSkillLevel = Math.max(
    1,
    Math.min(100, Math.trunc(input.cookingSkillLevel ?? 1))
  );
  if (cookingSkillLevel < recipe.requiredSkillLevel) {
    return result(state, [
      `cooking_rejected:skill_level_required:${recipe.requiredSkillLevel}`,
    ]);
  }
  const skilledBatchCap = Math.max(
    recipe.maxBatchCount,
    Math.floor(
      recipe.maxBatchCount *
        harthmereSublevelYieldMultiplier(cookingSkillLevel)
    )
  );
  if (count > skilledBatchCap) return result(state, ["cooking_rejected:batch_too_large"]);
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

// ---------------------------------------------------------------------------
// Timer-based, per-physical-station cooking
// ---------------------------------------------------------------------------
//
// cookHarthmereFood above is the legacy INSTANT path (kept for back-compat).
// The functions below implement queued cooking: ingredients are reserved on
// enqueue, one job cooks at a time per station, additional jobs queue (FIFO)
// and auto-start as the active one finishes, and finished food waits at the
// station until collected. All timestamps are stamped at enqueue/cancel so the
// queue resumes deterministically across logout/reload; tickHarthmereCooking
// only recomputes job *status* from the clock.

/** Shortest/longest real cook time. Authored cookTimeMs is mapped into this band. */
export const HARTHMERE_COOK_DURATION_MIN_MS = 20_000;
export const HARTHMERE_COOK_DURATION_MAX_MS = 120_000;
/** Max simultaneously pending+cooking jobs per station (ready jobs do not count). */
export const HARTHMERE_COOK_QUEUE_CAP = 5;
/** Hard cap on TOTAL jobs per station (incl. uncollected `ready` dishes). Bounds
 *  state growth when finished dishes are never collected. */
export const HARTHMERE_COOK_STATION_JOBS_MAX = 20;
/** A finished dish left uncollected in the pot spoils and disappears after this
 *  long. This also auto-cleans orphaned stations (e.g. a placed campfire that was
 *  destroyed): every job eventually finishes, then spoils, then the station is
 *  pruned — no ECS reconciliation needed. */
export const HARTHMERE_COOK_SPOIL_MS = 60 * 60 * 1000;

/** Authored cook-time corpus, computed once, used to normalize durations. */
const HARTHMERE_COOK_TIME_CORPUS = (() => {
  const times = Object.values(HARTHMERE_COOKING_RECIPES)
    .map((recipe) => Number(recipe.cookTimeMs))
    .filter((t) => Number.isFinite(t) && t > 0);
  return {
    min: times.length ? Math.min(...times) : 0,
    max: times.length ? Math.max(...times) : 0,
  };
})();

/** Maps a recipe's authored cookTimeMs into the [20s, 120s] band (clamp-linear
 *  across the recipe corpus), then multiplies by the batch count. Monotonic in
 *  cookTimeMs so harder recipes always take at least as long. */
export function scaleHarthmereCookDurationMs(
  cookTimeMs: number,
  count: number,
  cookingSkillLevel = 1,
): number {
  const safeCount = Math.max(1, Math.trunc(Number(count) || 1));
  const { min, max } = HARTHMERE_COOK_TIME_CORPUS;
  const t = Number(cookTimeMs);
  const frac =
    !Number.isFinite(t) || max <= min
      ? 0
      : (Math.max(min, Math.min(max, t)) - min) / (max - min);
  const base =
    HARTHMERE_COOK_DURATION_MIN_MS +
    frac *
      (HARTHMERE_COOK_DURATION_MAX_MS - HARTHMERE_COOK_DURATION_MIN_MS);
  return (
    Math.round(base * harthmereSublevelEfficiencyMultiplier(cookingSkillLevel)) *
    safeCount
  );
}

function cookDurationForJob(job: HarthmereCookingJob): number {
  const recipe = HARTHMERE_COOKING_RECIPES[job.recipeId];
  return recipe
    ? scaleHarthmereCookDurationMs(
        recipe.cookTimeMs,
        job.count,
        job.cookingSkillLevel
      )
    : Math.max(0, job.readyAtMs - job.startedAtMs);
}

/** Recomputes each job's status from the clock and FIFO position. The frontmost
 *  not-yet-ready job is "cooking", later not-ready jobs are "pending", and any
 *  job whose readyAtMs has elapsed is "ready". Mutates the given station's jobs. */
function tickStationJobs(
  station: HarthmereCookingStationState,
  nowMs: number,
): void {
  let sawActive = false;
  for (const job of station.jobs) {
    if (job.readyAtMs <= nowMs) {
      job.status = "ready";
    } else if (!sawActive) {
      job.status = "cooking";
      sawActive = true;
    } else {
      job.status = "pending";
    }
  }
}

function jobHasSpoiled(
  job: HarthmereCookingJob,
  nowMs: number,
): boolean {
  return (
    job.status === "ready" &&
    nowMs - job.readyAtMs >=
      HARTHMERE_COOK_SPOIL_MS *
        harthmereSublevelPotencyMultiplier(job.cookingSkillLevel)
  );
}

/** Recomputes statuses, drops spoiled (uncollected > spoil window) dishes, and
 *  returns undefined when the station has no jobs left (so the caller prunes it).
 *  Operates on a fresh copy — never mutates the input. */
function settleStation(
  station: HarthmereCookingStationState,
  nowMs: number,
): HarthmereCookingStationState | undefined {
  const cloned: HarthmereCookingStationState = {
    ...station,
    jobs: station.jobs.map((job) => ({ ...job })),
  };
  tickStationJobs(cloned, nowMs);
  const jobs = cloned.jobs.filter((job) => !jobHasSpoiled(job, nowMs));
  if (jobs.length === 0) {
    return undefined;
  }
  return { ...cloned, jobs };
}

/** Pure projection over the whole station map: refresh statuses, expire spoiled
 *  dishes, and prune empty stations. No timestamp mutation. */
export function tickHarthmereCooking(
  cooking: Record<string, HarthmereCookingStationState>,
  nowMs: number,
): Record<string, HarthmereCookingStationState> {
  const next: Record<string, HarthmereCookingStationState> = {};
  for (const [stationId, station] of Object.entries(cooking ?? {})) {
    const settled = settleStation(station, nowMs);
    if (settled) {
      next[stationId] = settled;
    }
  }
  return next;
}

/** Re-chains the start/ready timestamps of pending jobs after a removal, leaving
 *  already-cooking and finished (ready) jobs untouched. The first surviving
 *  pending job restarts at the cursor (nowMs, or the end of the kept active job). */
function rebaseStationChain(
  jobs: HarthmereCookingJob[],
  nowMs: number,
): HarthmereCookingJob[] {
  let cursor = nowMs;
  return jobs.map((job) => {
    if (job.status === "ready" || job.readyAtMs <= nowMs) {
      cursor = Math.max(cursor, job.readyAtMs);
      return job;
    }
    if (job.status === "cooking") {
      cursor = job.readyAtMs;
      return job;
    }
    const startedAtMs = cursor;
    const readyAtMs = startedAtMs + cookDurationForJob(job);
    cursor = readyAtMs;
    return { ...job, startedAtMs, readyAtMs };
  });
}

function cookingResult(
  state: HarthmereFoodStaminaState,
  warnings: string[],
  inventory?: Record<string, number>,
  cooking?: Record<string, HarthmereCookingStationState>,
  inventoryDeltas: Record<string, number> = {},
  cookingXpDelta?: number,
): HarthmereFoodStaminaResult {
  const next: HarthmereFoodStaminaResult = {
    state:
      inventory || cooking
        ? {
            ...state,
            inventory: inventory ?? state.inventory,
            cooking: cooking ?? state.cooking,
          }
        : state,
    warnings,
    inventoryDeltas,
    deathTriggered: false,
  };
  if (cookingXpDelta !== undefined) {
    next.cookingXpDelta = cookingXpDelta;
  }
  return next;
}

/** Queues a recipe at a station: validates the recipe/station/count/queue,
 *  reserves the ingredients from inventory, and appends a job with deterministic
 *  chain timestamps (start = max(now, tail.readyAtMs)). */
export function enqueueHarthmereCook(
  state: HarthmereFoodStaminaState,
  input: {
    stationId: string;
    stationKind?: HarthmereCookingStationKind;
    label?: string;
    recipeId: string;
    count?: number;
    nowMs: number;
    cookingSkillLevel?: number;
  },
): HarthmereFoodStaminaResult {
  if (!input.stationId) {
    return cookingResult(state, ["cooking_rejected:missing_station_id"]);
  }
  const recipe = HARTHMERE_COOKING_RECIPES[input.recipeId];
  if (!recipe) return cookingResult(state, ["cooking_rejected:unknown_recipe"]);
  const count = normalizeCookingCount(input.count);
  if (!count) return cookingResult(state, ["cooking_rejected:invalid_count"]);
  const cookingSkillLevel = Math.max(
    1,
    Math.min(100, Math.trunc(input.cookingSkillLevel ?? 1))
  );
  if (cookingSkillLevel < recipe.requiredSkillLevel) {
    return cookingResult(state, [
      `cooking_rejected:skill_level_required:${recipe.requiredSkillLevel}`,
    ]);
  }
  const skilledBatchCap = Math.max(
    recipe.maxBatchCount,
    Math.floor(
      recipe.maxBatchCount *
        harthmereSublevelYieldMultiplier(cookingSkillLevel)
    )
  );
  if (count > skilledBatchCap) {
    return cookingResult(state, ["cooking_rejected:batch_too_large"]);
  }
  const stationKind = input.stationKind ?? "campfire";
  if (recipe.stationKind !== "field" && stationKind !== recipe.stationKind) {
    return cookingResult(state, [
      `cooking_rejected:missing_station:${recipe.stationKind}`,
    ]);
  }
  const existing = state.cooking?.[input.stationId];
  const jobs = existing ? existing.jobs.map((job) => ({ ...job })) : [];
  const queuedCount = jobs.filter((job) => job.status !== "ready").length;
  if (
    queuedCount >= HARTHMERE_COOK_QUEUE_CAP ||
    jobs.length >= HARTHMERE_COOK_STATION_JOBS_MAX
  ) {
    return cookingResult(state, ["cooking_rejected:queue_full"]);
  }
  // Reservations were already removed from inventory, so availability is just a
  // check against the current inventory.
  for (const [itemId, itemCount] of Object.entries(recipe.inputs)) {
    const warning =
      itemId === "raw_meat"
        ? "cooking_rejected:missing_raw_food"
        : `cooking_rejected:missing_input:${itemId}`;
    const missing = requireItem(state, itemId, itemCount * count, warning);
    if (missing) return cookingResult(state, [missing]);
  }
  let inventory = { ...state.inventory };
  const inventoryDeltas: Record<string, number> = {};
  const reservedInputs: Record<string, number> = {};
  for (const [itemId, itemCount] of Object.entries(recipe.inputs)) {
    const amount = itemCount * count;
    inventory = addItem(inventory, itemId, -amount);
    inventoryDeltas[itemId] = (inventoryDeltas[itemId] ?? 0) - amount;
    reservedInputs[itemId] = amount;
  }
  const tailReadyAtMs = jobs.length
    ? jobs[jobs.length - 1].readyAtMs
    : input.nowMs;
  const startedAtMs = Math.max(input.nowMs, tailReadyAtMs);
  const readyAtMs =
    startedAtMs +
    scaleHarthmereCookDurationMs(
      recipe.cookTimeMs,
      count,
      cookingSkillLevel
    );
  jobs.push({
    jobId: `${input.stationId}::${input.recipeId}::${input.nowMs}::${jobs.length}`,
    recipeId: input.recipeId,
    count,
    status: "pending",
    enqueuedAtMs: input.nowMs,
    startedAtMs,
    readyAtMs,
    cookingSkillLevel,
    reservedInputs,
  });
  const cooking = { ...(state.cooking ?? {}) };
  const station: HarthmereCookingStationState = {
    stationId: input.stationId,
    stationKind,
    label: input.label ?? existing?.label,
    jobs,
  };
  // settle also clears any sibling dishes that spoiled while away; the freshly
  // enqueued job keeps the station non-empty.
  cooking[input.stationId] = settleStation(station, input.nowMs) ?? station;
  return cookingResult(state, [], inventory, cooking, inventoryDeltas);
}

/** Collects a finished (ready) job's outputs into inventory, returns the
 *  cooking XP to award, and prunes the station once its last job is gone. */
export function collectHarthmereCook(
  state: HarthmereFoodStaminaState,
  input: { stationId: string; jobId: string; nowMs: number },
): HarthmereFoodStaminaResult {
  const existing = state.cooking?.[input.stationId];
  if (!existing) return cookingResult(state, ["cooking_rejected:unknown_station"]);
  const jobs = existing.jobs.map((job) => ({ ...job }));
  const staged: HarthmereCookingStationState = { ...existing, jobs };
  tickStationJobs(staged, input.nowMs);
  const job = jobs.find((candidate) => candidate.jobId === input.jobId);
  if (!job) return cookingResult(state, ["cooking_rejected:unknown_job"]);
  if (job.status !== "ready") {
    return cookingResult(state, ["cooking_rejected:not_ready"]);
  }
  const recipe = HARTHMERE_COOKING_RECIPES[job.recipeId];
  if (!recipe) return cookingResult(state, ["cooking_rejected:unknown_recipe"]);
  let inventory = { ...state.inventory };
  const inventoryDeltas: Record<string, number> = {};
  for (const [itemId, itemCount] of Object.entries(recipe.outputs)) {
    const amount = itemCount * job.count;
    inventory = addItem(inventory, itemId, amount);
    inventoryDeltas[itemId] = (inventoryDeltas[itemId] ?? 0) + amount;
  }
  const remaining = jobs.filter((candidate) => candidate.jobId !== input.jobId);
  const cooking = { ...(state.cooking ?? {}) };
  // Removing a finished (past) job never frees the cooking slot earlier, so no
  // rebase is needed — later jobs keep their fixed timestamps.
  const settled = remaining.length
    ? settleStation({ ...staged, jobs: remaining }, input.nowMs)
    : undefined;
  if (settled) {
    cooking[input.stationId] = settled;
  } else {
    delete cooking[input.stationId];
  }
  return cookingResult(
    state,
    [],
    inventory,
    cooking,
    inventoryDeltas,
    recipe.xp * job.count,
  );
}

/** Cancels a job. A pending/cooking job refunds its reserved ingredients and
 *  re-chains the remaining pending jobs earlier. A finished (ready) dish is
 *  DISCARDED instead because its ingredients were already cooked. */
export function cancelHarthmereCook(
  state: HarthmereFoodStaminaState,
  input: { stationId: string; jobId: string; nowMs: number },
): HarthmereFoodStaminaResult {
  const existing = state.cooking?.[input.stationId];
  if (!existing) return cookingResult(state, ["cooking_rejected:unknown_station"]);
  const jobs = existing.jobs.map((job) => ({ ...job }));
  const staged: HarthmereCookingStationState = { ...existing, jobs };
  tickStationJobs(staged, input.nowMs);
  const job = jobs.find((candidate) => candidate.jobId === input.jobId);
  if (!job) return cookingResult(state, ["cooking_rejected:unknown_job"]);
  const isReady = job.status === "ready";
  let inventory = { ...state.inventory };
  const inventoryDeltas: Record<string, number> = {};
  if (!isReady) {
    // Refund reserved inputs for a not-yet-finished dish. A ready dish's inputs
    // are already consumed into the food, so discarding it refunds nothing.
    for (const [itemId, amount] of Object.entries(job.reservedInputs)) {
      inventory = addItem(inventory, itemId, amount);
      inventoryDeltas[itemId] = (inventoryDeltas[itemId] ?? 0) + amount;
    }
  }
  const remaining = jobs.filter((candidate) => candidate.jobId !== input.jobId);
  const cooking = { ...(state.cooking ?? {}) };
  // Removing a finished (ready) job never frees the cooking slot earlier, so
  // only re-chain when an active/pending job was removed.
  const nextJobs = isReady
    ? remaining
    : rebaseStationChain(remaining, input.nowMs);
  const settled = nextJobs.length
    ? settleStation({ ...staged, jobs: nextJobs }, input.nowMs)
    : undefined;
  if (settled) {
    cooking[input.stationId] = settled;
  } else {
    delete cooking[input.stationId];
  }
  return cookingResult(state, [], inventory, cooking, inventoryDeltas);
}

export function eatHarthmereFood(
  state: HarthmereFoodStaminaState,
  input: { itemId: string; nowMs: number },
): HarthmereFoodStaminaResult {
  if (
    state.deadFromStaminaAtMs !== undefined ||
    normalizedStaminaValue(state) <= 0
  ) {
    return result(state, ["food_rejected:stamina_depleted"]);
  }
  const food = HARTHMERE_FOOD_DEFINITIONS[input.itemId];
  if (!food) return result(state, ["food_rejected:not_food"]);
  if (!isHarthmereFoodDefinitionPlayerEdible(food)) {
    return result(state, ["food_rejected:not_edible"]);
  }
  const missing = requireItem(state, input.itemId, 1, "food_rejected:missing_food");
  if (missing) return result(state, [missing]);
  const maxStamina = normalizedMaxStamina(state);
  const lastStaminaTickMs = normalizedLastStaminaTickMs(state, input.nowMs);
  // Apply the stamina drain that accrued since the last tick BEFORE crediting the
  // restore, then advance the clock. Otherwise eating discards the pending drain
  // (advancing lastStaminaTickMs to now while adding to the stale stored value), which
  // silently grants up to a full survival-interval of free stamina per meal. Mirrors the
  // drain math in tickHarthmereStamina.
  const elapsedMs = Math.max(0, input.nowMs - lastStaminaTickMs);
  // Constant base drain rate so 100 stamina always equals 2 hours of gameplay (see
  // constant), accelerated by carry-weight encumbrance — mirrors tickHarthmereStamina.
  const encumbrance = harthmereInventoryEncumbranceStaminaMultiplier(
    state.inventory
  );
  const drained =
    (elapsedMs / 60_000) * HARTHMERE_STAMINA_DRAIN_PER_MINUTE * encumbrance;
  const currentStamina = Math.max(0, normalizedStaminaValue(state) - drained);
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

export function tickHarthmereStamina(
  state: HarthmereFoodStaminaState,
  nowMs: number,
): HarthmereFoodStaminaResult {
  // Stamina is a survival clock, not a sprint meter. It drains slowly so the
  // player has time to notice the HUD, buy/cook/forage food, and recover.
  // Reaching zero is intentionally fatal to make the food economy meaningful.
  const maxStamina = normalizedMaxStamina(state);
  const lastStaminaTickMs = normalizedLastStaminaTickMs(state, nowMs);
  const elapsedMs = Math.max(0, nowMs - lastStaminaTickMs);
  // Constant base drain rate so 100 stamina always equals 2 hours of gameplay (see
  // constant), then accelerated by carry-weight encumbrance: each pound over the limit
  // compounds the drain (see harthmereEncumbranceStaminaMultiplier).
  const encumbrance = harthmereInventoryEncumbranceStaminaMultiplier(
    state.inventory
  );
  const drained =
    (elapsedMs / 60_000) * HARTHMERE_STAMINA_DRAIN_PER_MINUTE * encumbrance;
  const nextStamina = Math.max(0, normalizedStaminaValue(state) - drained);
  const deathTriggered = nextStamina <= 0 && !state.deadFromStaminaAtMs;
  return result({
    ...state,
    stamina: nextStamina,
    maxStamina,
    lastStaminaTickMs: Math.max(lastStaminaTickMs, nowMs),
    deadFromStaminaAtMs: deathTriggered ? nowMs : state.deadFromStaminaAtMs,
  }, deathTriggered ? ["stamina_depleted:death_triggered"] : [], {}, deathTriggered);
}

export function restoreHarthmereStaminaToFull(
  state: HarthmereFoodStaminaState,
  nowMs: number,
): HarthmereFoodStaminaResult {
  const maxStamina = Math.max(
    1,
    Number.isFinite(state.maxStamina)
      ? state.maxStamina
      : HARTHMERE_DEFAULT_MAX_STAMINA,
  );
  return result({
    ...state,
    stamina: maxStamina,
    maxStamina,
    lastStaminaTickMs: nowMs,
    deadFromStaminaAtMs: undefined,
  });
}

export function tickHarthmereStaminaForGameplay(
  state: HarthmereFoodStaminaState,
  input: { nowMs: number; gameplayActive: boolean },
): HarthmereFoodStaminaResult {
  if (!input.gameplayActive) {
    // Stamina is only spent while the player is actually in the game world.
    // Menus, onboarding, hidden tabs, and disconnected/restarting clients
    // advance the timestamp without draining so players do not log back into
    // an unavoidable starvation death.
    const lastStaminaTickMs = normalizedLastStaminaTickMs(state, input.nowMs);
    return result({
      ...state,
      stamina: normalizedStaminaValue(state),
      maxStamina: normalizedMaxStamina(state),
      lastStaminaTickMs: Math.max(lastStaminaTickMs, input.nowMs),
    });
  }
  return tickHarthmereStamina(state, input.nowMs);
}

export function damageHarthmereSpawn(
  state: HarthmereFoodStaminaState,
  input: { spawnId: string; damage: number; nowMs: number },
): HarthmereFoodStaminaResult {
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
        respawnAtMs: hp <= 0 ? input.nowMs + HARTHMERE_HALF_DAY_MS : spawn.respawnAtMs,
        lastDamagedAtMs: input.nowMs,
      },
    },
  });
}

export function tickHarthmereWorldRespawnAndRegen(
  state: HarthmereFoodStaminaState,
  nowMs: number,
): HarthmereFoodStaminaResult {
  let changed = false;
  const spawns: Record<string, HarthmereWorldSpawn> = {};
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
      const heal = (Number(spawn.maxHp) * elapsed) / HARTHMERE_HALF_DAY_MS;
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
