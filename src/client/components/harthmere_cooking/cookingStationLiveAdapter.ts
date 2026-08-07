import { harthmerePlayerCapacityMessage } from "@/client/components/harthmere_capacity_messages";
import type { HarthmereCookStationKind } from "@/shared/harthmere/object_interaction_semantics";
import {
  HARTHMERE_COOKING_RECIPES,
  harthmereFarmingFoodItemDisplayName,
  scaleHarthmereCookDurationMs,
  type HarthmereCookingJobStatus,
  type HarthmereCookingRecipe,
} from "@/shared/harthmere/mmo_farming_food_stamina";
import { harthmereSublevelYieldMultiplier } from "@/shared/harthmere/harthmere_sublevel_benefits";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";

// Client-side projection + submit adapter for the timer-based cooking station
// panel. Mirrors craftingStationLiveAdapter.ts: pure helpers compute the visible
// recipe list (have-vs-need), per-station job/progress view, and player-facing
// warning messages, while the adapter factory turns enqueue/collect/cancel into
// backend submissions.

export interface HarthmereCookJobClient {
  jobId: string;
  recipeId: string;
  displayName: string;
  count: number;
  status: HarthmereCookingJobStatus;
  startedAtMs: number;
  readyAtMs: number;
  progress: number;
  outputs: Record<string, number>;
}

export interface HarthmereCookStationClient {
  stationId: string;
  stationKind: HarthmereCookStationKind | string;
  label?: string;
  jobs: HarthmereCookJobClient[];
}

export interface HarthmereCookSnapshot {
  inventory: Record<string, number>;
  stations: HarthmereCookStationClient[];
  availableStationKinds: string[];
  cookingSkillLevel?: number;
  updatedAtMs: number;
}

type NativeCookingInventoryLike = {
  items?: Array<
    | { item: { id: number }; count: bigint | number }
    | null
    | undefined
  >;
  hotbar?: Array<
    | { item: { id: number }; count: bigint | number }
    | null
    | undefined
  >;
};

/**
 * Native ECS owns cooking ingredients in production mode. The farming-food
 * snapshot still carries a legacy Redis inventory for old saves, so project
 * every native-backed recipe input over that mirror before deciding whether
 * the Cook button is enabled. This prevents a real ingredient in the backpack
 * from being rendered as "missing" (Carlo's Grove skewer regression).
 */
export function projectNativeHarthmereCookingInventory(
  legacyInventory: Record<string, number>,
  nativeInventory: NativeCookingInventoryLike | undefined
): Record<string, number> {
  if (!nativeInventory) return { ...legacyInventory };
  const nativeCounts: Record<string, number> = {};
  for (const stack of [
    ...(nativeInventory.items ?? []),
    ...(nativeInventory.hotbar ?? []),
  ]) {
    if (!stack) continue;
    const itemId = harthmereNativeItemIdForBiomesId(stack.item.id);
    if (!itemId) continue;
    nativeCounts[itemId] =
      (nativeCounts[itemId] ?? 0) + Math.max(0, Number(stack.count));
  }
  const next = { ...legacyInventory };
  const nativeBackedRecipeInputs = new Set(
    Object.values(HARTHMERE_COOKING_RECIPES).flatMap((recipe) =>
      Object.keys(recipe.inputs)
    )
  );
  for (const itemId of nativeBackedRecipeInputs) {
    // Only overwrite ids represented by the curated native manifest. Unknown
    // legacy-only ingredients remain readable from the Redis snapshot.
    if (harthmereNativeBiomesIdForItemId(itemId) === undefined) continue;
    next[itemId] = nativeCounts[itemId] ?? 0;
  }
  return next;
}

export interface HarthmereCookIngredientLine {
  itemId: string;
  name: string;
  need: number;
  have: number;
  enough: boolean;
}

export interface HarthmereCookVisibleRecipe {
  recipe: HarthmereCookingRecipe;
  recipeId: string;
  displayName: string;
  outputItemId: string;
  outputName: string;
  outputCount: number;
  ingredients: HarthmereCookIngredientLine[];
  outputs: Record<string, number>;
  stationOk: boolean;
  canCook: boolean;
  missing: string[];
  maxCookable: number;
  durationMs: number;
}

export function formatHarthmereCookItemName(itemId: string): string {
  const name = harthmereFarmingFoodItemDisplayName(itemId);
  if (name && name !== itemId) {
    return name;
  }
  if (/^\d{6,}$/.test(itemId)) {
    return `Ingredient ${itemId.slice(-4)}`;
  }
  return itemId
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isHarthmereCookingStationRecipeVisible(
  recipe: HarthmereCookingRecipe
): boolean {
  return !recipe.recipeType || recipe.recipeType === "cooking";
}

/** "field" recipes need no station and cook anywhere; otherwise the recipe's
 *  station kind must match the station the player opened. */
export function harthmereCookRecipeStationOk(
  recipe: HarthmereCookingRecipe,
  stationKind: string
): boolean {
  return recipe.stationKind === "field" || recipe.stationKind === stationKind;
}

function countAvailable(
  inventory: Record<string, number>,
  itemId: string
): number {
  return Math.max(0, Math.trunc(Number(inventory[itemId] ?? 0)));
}

/** Most batches cookable right now from the current inventory (ignores anything
 *  already reserved by queued jobs, since reservations are removed from the
 *  inventory the snapshot reports). Capped at the recipe's maxBatchCount. */
export function harthmereCookMaxCookable(
  recipe: HarthmereCookingRecipe,
  inventory: Record<string, number>,
  cookingSkillLevel = 1
): number {
  let max = Math.max(
    recipe.maxBatchCount,
    Math.floor(
      recipe.maxBatchCount *
        harthmereSublevelYieldMultiplier(cookingSkillLevel)
    )
  );
  for (const [itemId, count] of Object.entries(recipe.inputs)) {
    if (count > 0) {
      max = Math.min(max, Math.floor(countAvailable(inventory, itemId) / count));
    }
  }
  return Math.max(0, max);
}

function primaryOutput(recipe: HarthmereCookingRecipe): {
  itemId: string;
  count: number;
} {
  const [itemId, count] = Object.entries(recipe.outputs)[0] ?? ["", 0];
  return { itemId, count };
}

function visibleRecipe(
  recipe: HarthmereCookingRecipe,
  inventory: Record<string, number>,
  stationKind: string,
  count = 1,
  cookingSkillLevel = 1
): HarthmereCookVisibleRecipe {
  const stationOk = harthmereCookRecipeStationOk(recipe, stationKind);
  const missing: string[] = [];
  if (!stationOk) {
    missing.push("Station");
  }
  if (cookingSkillLevel < recipe.requiredSkillLevel) {
    missing.push(`Cooking level ${recipe.requiredSkillLevel}`);
  }
  const ingredients: HarthmereCookIngredientLine[] = Object.entries(
    recipe.inputs
  ).map(([itemId, need]) => {
    const scaledNeed = need * Math.max(1, count);
    const have = countAvailable(inventory, itemId);
    const enough = have >= scaledNeed;
    if (!enough) {
      missing.push(formatHarthmereCookItemName(itemId));
    }
    return {
      itemId,
      name: formatHarthmereCookItemName(itemId),
      need: scaledNeed,
      have,
      enough,
    };
  });
  const output = primaryOutput(recipe);
  return {
    recipe,
    recipeId: recipe.recipeId,
    displayName: recipe.displayName,
    outputItemId: output.itemId,
    outputName: formatHarthmereCookItemName(output.itemId),
    outputCount: output.count * Math.max(1, count),
    ingredients,
    outputs: recipe.outputs,
    stationOk,
    canCook: missing.length === 0,
    missing,
    maxCookable: harthmereCookMaxCookable(
      recipe,
      inventory,
      cookingSkillLevel
    ),
    durationMs: scaleHarthmereCookDurationMs(
      recipe.cookTimeMs,
      count,
      cookingSkillLevel
    ),
  };
}

/** Recipes cookable at the opened station (its kind + station-less field
 *  recipes), each with have-vs-need ingredient lines. */
export function createHarthmereCookVisibleRecipes(
  inventory: Record<string, number>,
  stationKind: string,
  cookingSkillLevel = 1
): HarthmereCookVisibleRecipe[] {
  return Object.values(HARTHMERE_COOKING_RECIPES)
    .filter(
      (recipe) =>
        isHarthmereCookingStationRecipeVisible(recipe) &&
        harthmereCookRecipeStationOk(recipe, stationKind)
    )
    .map((recipe) =>
      visibleRecipe(recipe, inventory, stationKind, 1, cookingSkillLevel)
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Detailed have-vs-need for a single recipe at a chosen batch count (drives the
 *  recipe-detail / ingredient-fill pane and the Cook button's enabled state). */
export function harthmereCookRecipeDetail(
  recipeId: string,
  inventory: Record<string, number>,
  stationKind: string,
  count = 1,
  cookingSkillLevel = 1
): HarthmereCookVisibleRecipe | undefined {
  const recipe = HARTHMERE_COOKING_RECIPES[recipeId];
  if (!recipe) {
    return undefined;
  }
  return visibleRecipe(
    recipe,
    inventory,
    stationKind,
    count,
    cookingSkillLevel
  );
}

export function harthmereCookStationJobs(
  snapshot: HarthmereCookSnapshot | undefined,
  stationId: string
): HarthmereCookJobClient[] {
  return (
    snapshot?.stations.find((station) => station.stationId === stationId)
      ?.jobs ?? []
  );
}

export function playerMessageFromCookingWarning(warning: string): string {
  const capacityMessage = harthmerePlayerCapacityMessage(warning);
  if (capacityMessage) return capacityMessage;
  const code = warning.replace(/^cooking_rejected:/, "").split(":")[0];
  switch (code) {
    case "unknown_recipe":
      return "That recipe is unavailable.";
    case "invalid_count":
      return "Choose a valid amount.";
    case "batch_too_large":
      return "That is more than this recipe can cook at once.";
    case "missing_station":
    case "missing_station_id":
      return "Use the right cooking station.";
    case "missing_raw_food":
    case "missing_input":
      return "You don't have the ingredients for that.";
    case "not_ready":
      return "That dish isn't ready yet.";
    case "collect_only":
      return "That dish is done — collect it instead.";
    case "unknown_station":
    case "unknown_job":
      return "That cooking job is no longer here.";
    default:
      return "Cooking is unavailable right now.";
  }
}

export function formatHarthmereCookingPlayerError(
  warnings?: string[]
): string {
  const messages = [
    ...new Set(
      (warnings ?? [])
        .filter((w) => typeof w === "string" && w.length > 0)
        .map(playerMessageFromCookingWarning)
    ),
  ];
  return messages.length > 0
    ? messages.join(" ")
    : "Cooking is unavailable right now.";
}

export interface HarthmereCookingAdapter {
  isHydrated: () => boolean;
  getInventory: () => Record<string, number>;
  getRecipes: () => HarthmereCookVisibleRecipe[];
  getRecipeDetail: (
    recipeId: string,
    count?: number
  ) => HarthmereCookVisibleRecipe | undefined;
  getJobs: () => HarthmereCookJobClient[];
  enqueueCook: (recipeId: string, count?: number) => Promise<void>;
  collectCook: (jobId: string) => Promise<void>;
  cancelCook: (jobId: string) => Promise<void>;
}

export interface CreateHarthmereCookingAdapterOptions {
  snapshot: HarthmereCookSnapshot | undefined;
  hydrated?: boolean;
  stationId: string;
  stationKind: HarthmereCookStationKind | string;
  label?: string;
  submit?: (
    operation: "cook_enqueue" | "cook_collect" | "cook_cancel",
    payload: Record<string, unknown>
  ) => Promise<{ ok: boolean; warnings?: string[] }>;
}

export function createHarthmereCookingAdapter({
  snapshot,
  hydrated = true,
  stationId,
  stationKind,
  label,
  submit,
}: CreateHarthmereCookingAdapterOptions): HarthmereCookingAdapter {
  const inventory = snapshot?.inventory ?? {};
  const cookingSkillLevel = snapshot?.cookingSkillLevel ?? 1;
  const mutate = async (
    operation: "cook_enqueue" | "cook_collect" | "cook_cancel",
    payload: Record<string, unknown>
  ) => {
    if (!submit) return;
    const body = await submit(operation, payload);
    if (!body.ok) {
      throw new Error(formatHarthmereCookingPlayerError(body.warnings));
    }
  };
  return {
    isHydrated: () => hydrated,
    getInventory: () => inventory,
    getRecipes: () =>
      createHarthmereCookVisibleRecipes(
        inventory,
        stationKind,
        cookingSkillLevel
      ),
    getRecipeDetail: (recipeId, count = 1) =>
      harthmereCookRecipeDetail(
        recipeId,
        inventory,
        stationKind,
        count,
        cookingSkillLevel
      ),
    getJobs: () => harthmereCookStationJobs(snapshot, stationId),
    enqueueCook: (recipeId, count = 1) =>
      mutate("cook_enqueue", {
        stationId,
        stationKind,
        label,
        recipeId,
        count,
      }),
    collectCook: (jobId) => mutate("cook_collect", { stationId, jobId }),
    cancelCook: (jobId) => mutate("cook_cancel", { stationId, jobId }),
  };
}
