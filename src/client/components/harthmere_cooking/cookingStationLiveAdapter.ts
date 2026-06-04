import type { HarthmereCookStationKindV1 } from "@/shared/harthmere/object_interaction_semantics_v1";
import {
  HARTHMERE_COOKING_RECIPES_V1,
  harthmereFarmingFoodItemDisplayNameV1,
  scaleHarthmereCookDurationMsV1,
  type HarthmereCookingJobStatusV1,
  type HarthmereCookingRecipeV1,
} from "@/shared/harthmere/mmo_farming_food_stamina_v1";

// Client-side projection + submit adapter for the timer-based cooking station
// panel. Mirrors craftingStationLiveAdapter.ts: pure helpers compute the visible
// recipe list (have-vs-need), per-station job/progress view, and player-facing
// warning messages, while the adapter factory turns enqueue/collect/cancel into
// backend submissions.

export interface HarthmereCookJobClientV1 {
  jobId: string;
  recipeId: string;
  displayName: string;
  count: number;
  status: HarthmereCookingJobStatusV1;
  startedAtMs: number;
  readyAtMs: number;
  progress: number;
  outputs: Record<string, number>;
}

export interface HarthmereCookStationClientV1 {
  stationId: string;
  stationKind: HarthmereCookStationKindV1 | string;
  label?: string;
  jobs: HarthmereCookJobClientV1[];
}

export interface HarthmereCookSnapshotV1 {
  inventory: Record<string, number>;
  stations: HarthmereCookStationClientV1[];
  availableStationKinds: string[];
  updatedAtMs: number;
}

export interface HarthmereCookIngredientLineV1 {
  itemId: string;
  name: string;
  need: number;
  have: number;
  enough: boolean;
}

export interface HarthmereCookVisibleRecipeV1 {
  recipe: HarthmereCookingRecipeV1;
  recipeId: string;
  displayName: string;
  outputItemId: string;
  outputName: string;
  outputCount: number;
  ingredients: HarthmereCookIngredientLineV1[];
  outputs: Record<string, number>;
  stationOk: boolean;
  canCook: boolean;
  missing: string[];
  maxCookable: number;
  durationMs: number;
}

export function formatHarthmereCookItemNameV1(itemId: string): string {
  const name = harthmereFarmingFoodItemDisplayNameV1(itemId);
  if (name && name !== itemId) {
    return name;
  }
  return itemId
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** "field" recipes need no station and cook anywhere; otherwise the recipe's
 *  station kind must match the station the player opened. */
export function harthmereCookRecipeStationOkV1(
  recipe: HarthmereCookingRecipeV1,
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
export function harthmereCookMaxCookableV1(
  recipe: HarthmereCookingRecipeV1,
  inventory: Record<string, number>
): number {
  let max = recipe.maxBatchCount;
  for (const [itemId, count] of Object.entries(recipe.inputs)) {
    if (count > 0) {
      max = Math.min(max, Math.floor(countAvailable(inventory, itemId) / count));
    }
  }
  return Math.max(0, max);
}

function primaryOutputV1(recipe: HarthmereCookingRecipeV1): {
  itemId: string;
  count: number;
} {
  const [itemId, count] = Object.entries(recipe.outputs)[0] ?? ["", 0];
  return { itemId, count };
}

function visibleRecipeV1(
  recipe: HarthmereCookingRecipeV1,
  inventory: Record<string, number>,
  stationKind: string,
  count = 1
): HarthmereCookVisibleRecipeV1 {
  const stationOk = harthmereCookRecipeStationOkV1(recipe, stationKind);
  const missing: string[] = [];
  if (!stationOk) {
    missing.push("Station");
  }
  const ingredients: HarthmereCookIngredientLineV1[] = Object.entries(
    recipe.inputs
  ).map(([itemId, need]) => {
    const scaledNeed = need * Math.max(1, count);
    const have = countAvailable(inventory, itemId);
    const enough = have >= scaledNeed;
    if (!enough) {
      missing.push(formatHarthmereCookItemNameV1(itemId));
    }
    return {
      itemId,
      name: formatHarthmereCookItemNameV1(itemId),
      need: scaledNeed,
      have,
      enough,
    };
  });
  const output = primaryOutputV1(recipe);
  return {
    recipe,
    recipeId: recipe.recipeId,
    displayName: recipe.displayName,
    outputItemId: output.itemId,
    outputName: formatHarthmereCookItemNameV1(output.itemId),
    outputCount: output.count * Math.max(1, count),
    ingredients,
    outputs: recipe.outputs,
    stationOk,
    canCook: missing.length === 0,
    missing,
    maxCookable: harthmereCookMaxCookableV1(recipe, inventory),
    durationMs: scaleHarthmereCookDurationMsV1(recipe.cookTimeMs, count),
  };
}

/** Recipes cookable at the opened station (its kind + station-less field
 *  recipes), each with have-vs-need ingredient lines. */
export function createHarthmereCookVisibleRecipesV1(
  inventory: Record<string, number>,
  stationKind: string
): HarthmereCookVisibleRecipeV1[] {
  return Object.values(HARTHMERE_COOKING_RECIPES_V1)
    .filter((recipe) => harthmereCookRecipeStationOkV1(recipe, stationKind))
    .map((recipe) => visibleRecipeV1(recipe, inventory, stationKind))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Detailed have-vs-need for a single recipe at a chosen batch count (drives the
 *  recipe-detail / ingredient-fill pane and the Cook button's enabled state). */
export function harthmereCookRecipeDetailV1(
  recipeId: string,
  inventory: Record<string, number>,
  stationKind: string,
  count = 1
): HarthmereCookVisibleRecipeV1 | undefined {
  const recipe = HARTHMERE_COOKING_RECIPES_V1[recipeId];
  if (!recipe) {
    return undefined;
  }
  return visibleRecipeV1(recipe, inventory, stationKind, count);
}

export function harthmereCookStationJobsV1(
  snapshot: HarthmereCookSnapshotV1 | undefined,
  stationId: string
): HarthmereCookJobClientV1[] {
  return (
    snapshot?.stations.find((station) => station.stationId === stationId)
      ?.jobs ?? []
  );
}

export function playerMessageFromCookingWarningV1(warning: string): string {
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
    case "queue_full":
      return "This station's queue is full — collect or cancel a dish first.";
    case "missing_raw_food":
    case "missing_input":
      return "You don't have the ingredients for that.";
    case "not_ready":
      return "That dish isn't ready yet.";
    case "collect_only":
      return "That dish is done — collect it instead.";
    case "carry_weight_limit_exceeded":
      return "Your pack is too heavy to take that.";
    case "unknown_station":
    case "unknown_job":
      return "That cooking job is no longer here.";
    default:
      return "Cooking is unavailable right now.";
  }
}

export function formatHarthmereCookingPlayerErrorV1(
  warnings?: string[]
): string {
  const messages = [
    ...new Set(
      (warnings ?? [])
        .filter((w) => typeof w === "string" && w.length > 0)
        .map(playerMessageFromCookingWarningV1)
    ),
  ];
  return messages.length > 0
    ? messages.join(" ")
    : "Cooking is unavailable right now.";
}

export interface HarthmereCookingAdapterV1 {
  isHydrated: () => boolean;
  getInventory: () => Record<string, number>;
  getRecipes: () => HarthmereCookVisibleRecipeV1[];
  getRecipeDetail: (
    recipeId: string,
    count?: number
  ) => HarthmereCookVisibleRecipeV1 | undefined;
  getJobs: () => HarthmereCookJobClientV1[];
  enqueueCook: (recipeId: string, count?: number) => Promise<void>;
  collectCook: (jobId: string) => Promise<void>;
  cancelCook: (jobId: string) => Promise<void>;
}

export interface CreateHarthmereCookingAdapterOptionsV1 {
  snapshot: HarthmereCookSnapshotV1 | undefined;
  hydrated?: boolean;
  stationId: string;
  stationKind: HarthmereCookStationKindV1 | string;
  label?: string;
  submit?: (
    operation: "cook_enqueue" | "cook_collect" | "cook_cancel",
    payload: Record<string, unknown>
  ) => Promise<{ ok: boolean; warnings?: string[] }>;
}

export function createHarthmereCookingAdapterV1({
  snapshot,
  hydrated = true,
  stationId,
  stationKind,
  label,
  submit,
}: CreateHarthmereCookingAdapterOptionsV1): HarthmereCookingAdapterV1 {
  const inventory = snapshot?.inventory ?? {};
  const mutate = async (
    operation: "cook_enqueue" | "cook_collect" | "cook_cancel",
    payload: Record<string, unknown>
  ) => {
    if (!submit) return;
    const body = await submit(operation, payload);
    if (!body.ok) {
      throw new Error(formatHarthmereCookingPlayerErrorV1(body.warnings));
    }
  };
  return {
    isHydrated: () => hydrated,
    getInventory: () => inventory,
    getRecipes: () => createHarthmereCookVisibleRecipesV1(inventory, stationKind),
    getRecipeDetail: (recipeId, count = 1) =>
      harthmereCookRecipeDetailV1(recipeId, inventory, stationKind, count),
    getJobs: () => harthmereCookStationJobsV1(snapshot, stationId),
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
