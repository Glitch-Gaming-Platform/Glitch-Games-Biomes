import {
  HARTHMERE_COOKING_RECIPES_V1,
  HARTHMERE_FOOD_DEFINITIONS_V1,
  HARTHMERE_SEED_DEFINITIONS_V1,
  harthmereFarmingFoodItemDisplayNameV1,
  isHarthmereLivestockFeedItemV1,
} from "@/shared/harthmere/mmo_farming_food_stamina_v1";

export type FarmingFoodActionKindV1 =
  | "eat_best_food"
  | "cook_raw_meat"
  | "cook_worker_meal"
  | "cook_hearty_stew"
  | "cook_berry_tart"
  | "gather_seed"
  | "plant_seed"
  | "water_plot"
  | "harvest_plot"
  | "forage_food"
  | "hunt_animal"
  | "feed_livestock"
  | "collect_livestock_product"
  | `cook_recipe:${string}`;

export interface FarmingFoodInterfaceActionV1 {
  id: FarmingFoodActionKindV1;
  label: string;
  operation: string;
  payload: Record<string, unknown>;
  disabled?: boolean;
  blockedReason?: string;
}

export interface FarmingFoodInterfaceModelV1 {
  hydrated: boolean;
  stamina: number;
  maxStamina: number;
  plots: any[];
  livestock: any[];
  wildlife: any[];
  inventory: Record<string, number>;
  actions: FarmingFoodInterfaceActionV1[];
}

export type FarmingFoodQuickActionKeyV1 = "KeyF" | "KeyR" | "KeyT";

const COOKING_RECIPE_ACTION_IDS_V1: Record<string, FarmingFoodActionKindV1> = {
  grilled_meat: "cook_raw_meat",
  worker_meal: "cook_worker_meal",
  hearty_stew: "cook_hearty_stew",
  berry_tart: "cook_berry_tart",
};

const COOKING_ACTION_PRIORITY_V1: FarmingFoodActionKindV1[] = [
  "cook_raw_meat",
  "cook_hearty_stew",
  "cook_berry_tart",
  "cook_worker_meal",
];

function count(snapshot: any, itemId: string) {
  return Math.max(0, Math.trunc(Number(snapshot?.inventory?.[itemId] ?? 0)));
}

function bestFoodItemId(snapshot: any) {
  return Object.keys(HARTHMERE_FOOD_DEFINITIONS_V1)
    .filter((itemId) => {
      const food = HARTHMERE_FOOD_DEFINITIONS_V1[itemId];
      return count(snapshot, itemId) > 0 &&
        food.edible !== false &&
        food.staminaRestore > 0;
    })
    .sort((a, b) =>
      HARTHMERE_FOOD_DEFINITIONS_V1[b].staminaRestore -
      HARTHMERE_FOOD_DEFINITIONS_V1[a].staminaRestore
    )[0];
}

function firstSeedItemId(snapshot: any) {
  return Object.keys(HARTHMERE_SEED_DEFINITIONS_V1).find(
    (itemId) => count(snapshot, itemId) > 0
  );
}

function nextPlotId(snapshot: any) {
  const existing = new Set((snapshot?.plots ?? []).map((plot: any) => String(plot?.plotId ?? "")));
  for (let index = 1; index <= 24; index += 1) {
    const candidate = `farm_plot_${String(index).padStart(3, "0")}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `farm_plot_${Date.now()}`;
}

function firstActivePlot(snapshot: any) {
  return (snapshot?.plots ?? []).find((plot: any) => !plot?.harvestedAtMs);
}

function firstReadyPlot(snapshot: any) {
  return (snapshot?.plots ?? []).find(
    (plot: any) => !plot?.harvestedAtMs && plot?.ready === true
  );
}

function plotIdForFarmingAction(plot: any) {
  return String(plot?.plotId ?? plot?.cropId ?? "");
}

function firstFeedItemId(snapshot: any) {
  return Object.keys(snapshot?.inventory ?? {}).find(
    (itemId) => count(snapshot, itemId) > 0 && isHarthmereLivestockFeedItemV1(itemId)
  );
}

function availableCookingStations(snapshot: any) {
  const stations = Array.isArray(snapshot?.availableCookingStations)
    ? snapshot.availableCookingStations.map((station: any) => String(station))
    : ["campfire"];
  return new Set(stations);
}

function cookingIngredientName(itemId: string) {
  return harthmereFarmingFoodItemDisplayNameV1(itemId) ??
    itemId.replace(/_/g, " ");
}

function missingCookingInput(snapshot: any, inputs: Record<string, number>) {
  return Object.entries(inputs).find(
    ([itemId, needed]) => count(snapshot, itemId) < needed
  )?.[0];
}

export function buildFarmingFoodInterfaceModelForTest(
  snapshot: any,
  hydrated = true,
): FarmingFoodInterfaceModelV1 {
  const safeSnapshot = snapshot ?? {};
  const plots = Array.isArray(safeSnapshot.plots) ? safeSnapshot.plots : [];
  const livestock = Array.isArray(safeSnapshot.livestock) ? safeSnapshot.livestock : [];
  const wildlife = Array.isArray(safeSnapshot.wildlife) ? safeSnapshot.wildlife : [];
  const foodItemId = bestFoodItemId(safeSnapshot);
  const seedItemId = firstSeedItemId(safeSnapshot);
  const activePlot = firstActivePlot(safeSnapshot);
  const readyPlot = firstReadyPlot(safeSnapshot);
  const feedItemId = firstFeedItemId(safeSnapshot);
  const livestockTarget = livestock[0];
  const updatedAtMs = Number(safeSnapshot.updatedAtMs);
  const collectableLivestock = livestock.find((animal: any) =>
    animal?.productReady === true ||
    (Number.isFinite(updatedAtMs) && Number(animal?.productReadyAtMs) <= updatedAtMs)
  );
  const harvestableWildlife = wildlife.find((animal: any) => animal?.harvestable === true);
  const seedSpawn = Array.isArray(safeSnapshot.seedSpawns)
    ? safeSnapshot.seedSpawns.find((spawn: any) => !spawn?.depletedAtMs)
    : undefined;
  const forageSpawn = Array.isArray(safeSnapshot.foodSpawns)
    ? safeSnapshot.foodSpawns.find((spawn: any) => !spawn?.depletedAtMs)
    : undefined;
  const stations = availableCookingStations(safeSnapshot);
  const cookingActions = Object.values(HARTHMERE_COOKING_RECIPES_V1)
    .map((recipe): FarmingFoodInterfaceActionV1 => {
      const missingInput = missingCookingInput(safeSnapshot, recipe.inputs);
      const stationAvailable = recipe.stationKind === "field" || stations.has(recipe.stationKind);
      const id = COOKING_RECIPE_ACTION_IDS_V1[recipe.recipeId] ??
        (`cook_recipe:${recipe.recipeId}` as FarmingFoodActionKindV1);
      return {
        id,
        label: `Cook ${recipe.displayName}`,
        operation: "cook_food",
        payload: {
          recipeId: recipe.recipeId,
          rawItemId: recipe.recipeId === "grilled_meat" ? "raw_meat" : undefined,
          stationKind: recipe.stationKind,
          count: 1,
        },
        disabled: !!missingInput || !stationAvailable,
        blockedReason: !stationAvailable
          ? `Needs ${recipe.stationKind}.`
          : missingInput
            ? `Needs ${cookingIngredientName(missingInput)}.`
            : undefined,
      };
    });

  const actions: FarmingFoodInterfaceActionV1[] = [
    {
      id: "eat_best_food",
      label: foodItemId ? `Eat ${HARTHMERE_FOOD_DEFINITIONS_V1[foodItemId].displayName}` : "Eat Food",
      operation: "eat_food",
      payload: { itemId: foodItemId ?? "" },
      disabled: !foodItemId,
      blockedReason: foodItemId ? undefined : "No stamina food in backpack.",
    },
    ...cookingActions,
    {
      id: "gather_seed",
      label: seedSpawn?.seedItemId && HARTHMERE_SEED_DEFINITIONS_V1[seedSpawn.seedItemId]
        ? `Gather ${HARTHMERE_SEED_DEFINITIONS_V1[seedSpawn.seedItemId].displayName}`
        : "Gather Seed",
      operation: "gather_seed",
      payload: {
        seedItemId: seedSpawn?.seedItemId ?? "",
        source: seedSpawn?.source ?? "world",
      },
      disabled: !seedSpawn,
      blockedReason: seedSpawn ? undefined : "No seed source selected.",
    },
    {
      id: "plant_seed",
      label: seedItemId ? `Plant ${HARTHMERE_SEED_DEFINITIONS_V1[seedItemId].displayName}` : "Plant Seed",
      operation: "plant",
      payload: { plotId: nextPlotId(safeSnapshot), seedItemId: seedItemId ?? "" },
      disabled: !seedItemId,
      blockedReason: seedItemId ? undefined : "No seed in backpack.",
    },
    {
      id: "water_plot",
      label: "Water Plot",
      operation: "water",
      payload: { plotId: plotIdForFarmingAction(activePlot) },
      disabled: !activePlot || !!activePlot.wateredAtMs,
      blockedReason: !activePlot
        ? "No active plot."
        : activePlot.wateredAtMs
          ? "Plot is already watered."
          : undefined,
    },
    {
      id: "harvest_plot",
      label: "Harvest Plot",
      operation: "harvest",
      payload: { plotId: plotIdForFarmingAction(readyPlot) },
      disabled: !readyPlot,
      blockedReason: readyPlot ? undefined : "No crop is ready.",
    },
    {
      id: "forage_food",
      label: "Forage Food",
      operation: "forage_food",
      payload: {
        spawnId: forageSpawn?.spawnId ?? "",
        itemId: forageSpawn?.itemId ?? "wild_berries",
      },
      disabled: !forageSpawn,
      blockedReason: forageSpawn ? undefined : "No food spawn selected.",
    },
    {
      id: "hunt_animal",
      label: harvestableWildlife ? `Skin ${String(harvestableWildlife.species ?? "Animal")}` : "Skin Wild Animal",
      operation: "hunt_animal",
      payload: { animalId: harvestableWildlife?.animalId ?? "" },
      disabled: !harvestableWildlife,
      blockedReason: harvestableWildlife ? undefined : "No defeated legal wildlife nearby.",
    },
    {
      id: "feed_livestock",
      label: livestockTarget ? `Feed ${String(livestockTarget.species ?? "Livestock")}` : "Feed Livestock",
      operation: "feed_livestock",
      payload: {
        livestockId: livestockTarget?.livestockId ?? "",
        feedItemId: feedItemId ?? "",
      },
      disabled: !livestockTarget || !feedItemId,
      blockedReason: !livestockTarget
        ? "No livestock selected."
        : feedItemId
          ? undefined
          : "No livestock feed in backpack.",
    },
    {
      id: "collect_livestock_product",
      label: collectableLivestock ? `Collect ${String(collectableLivestock.productItemId ?? "Product")}` : "Collect Livestock Product",
      operation: "collect_livestock_product",
      payload: { livestockId: collectableLivestock?.livestockId ?? "" },
      disabled: !collectableLivestock,
      blockedReason: livestockTarget ? "No livestock product is ready." : "No livestock selected.",
    },
  ];

  return {
    hydrated,
    stamina: Math.max(0, Math.trunc(Number(safeSnapshot.stamina ?? 0))),
    maxStamina: Math.max(1, Math.trunc(Number(safeSnapshot.maxStamina ?? 100))),
    plots,
    livestock,
    wildlife,
    inventory: { ...(safeSnapshot.inventory ?? {}) },
    actions,
  };
}

const FIELD_ACTION_PRIORITY_V1: FarmingFoodActionKindV1[] = [
  "harvest_plot",
  "forage_food",
  "collect_livestock_product",
  "feed_livestock",
  "hunt_animal",
  "water_plot",
  "plant_seed",
  "gather_seed",
];

function firstEnabledAction(
  model: FarmingFoodInterfaceModelV1,
  actionIds: FarmingFoodActionKindV1[],
) {
  return actionIds
    .map((actionId) => model.actions.find((action) => action.id === actionId))
    .find((action): action is FarmingFoodInterfaceActionV1 => !!action && !action.disabled);
}

export function farmingFoodQuickActionForKeyV1(
  model: FarmingFoodInterfaceModelV1,
  code: string,
): FarmingFoodInterfaceActionV1 | undefined {
  if (!model.hydrated) return undefined;
  if (code === "KeyF") {
    return firstEnabledAction(model, FIELD_ACTION_PRIORITY_V1);
  }
  if (code === "KeyR") {
    return firstEnabledAction(model, ["eat_best_food"]);
  }
  if (code === "KeyT") {
    return firstEnabledAction(model, COOKING_ACTION_PRIORITY_V1) ??
      model.actions.find((action) => action.operation === "cook_food" && !action.disabled);
  }
  return undefined;
}
