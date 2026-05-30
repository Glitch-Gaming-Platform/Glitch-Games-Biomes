import {
  ensureHarthmereProductionCraftingCatalogueV1,
  HARTHMERE_CRAFTING_STATIONS_V1,
} from "@/shared/harthmere/mmo_crafting_catalogue_v1";
import {
  harthmereResolveBikkieVisualV1,
  type HarthmereResolvedBikkieVisualV1,
} from "@/shared/harthmere/bikkie_visual_resolver_v1";
import {
  getHarthmereCraftingToolV1,
  getHarthmereCraftingStationV1,
  getHarthmereItemDefinitionV1,
  listHarthmereCraftingRecipesV1,
  type HarthmereCraftingOutcomeV1,
  type HarthmereCraftingRecipeV1,
} from "@/shared/harthmere/mmo_inventory_authority_v1";

export interface HarthmereCraftingStationClientJobV1 {
  jobId: string;
  recipeId: string;
  readyAtMs: number;
  status: string;
  outcome?: HarthmereCraftingOutcomeV1;
}

export interface HarthmereCraftingStationClientSnapshotV1 {
  actorId: string;
  stationId?: string;
  stationType?: string;
  stationName: string;
  gold: number;
  inventoryItems: Record<string, number>;
  materialStorage: Record<string, number>;
  knownRecipes: string[];
  skills: Record<string, { level: number; xp?: number }>;
  activeJobs: HarthmereCraftingStationClientJobV1[];
  history: HarthmereCraftingStationClientJobV1[];
  nowMs: number;
}

export interface HarthmereCraftingVisibleRecipeV1 {
  recipe: HarthmereCraftingRecipeV1;
  displayName: string;
  outputName: string;
  stationOk: boolean;
  known: boolean;
  canCraft: boolean;
  missing: string[];
  qualityLabel: string;
  workflowLabel: string;
  outputVisual: HarthmereResolvedBikkieVisualV1;
}

export interface HarthmereCraftingStationSubmitPayloadV1 {
  recipeId?: string;
  count?: number;
  stationId?: string;
  stationType?: string;
  toolItemIds?: string[];
  optionalReagentItemIds?: string[];
  targetItemId?: string;
  workflowStepIds?: string[];
  jobAction?: "instant" | "start" | "complete" | "cancel";
  craftingJobId?: string;
}

export interface HarthmereCraftingStationAdapterV1 {
  isHydrated: () => boolean;
  getSnapshot: () => HarthmereCraftingStationClientSnapshotV1 | undefined;
  getRecipes: () => HarthmereCraftingVisibleRecipeV1[];
  craft: (
    recipeId: string,
    payload?: Omit<HarthmereCraftingStationSubmitPayloadV1, "recipeId">
  ) => Promise<void>;
  startJob: (
    recipeId: string,
    payload?: Omit<
      HarthmereCraftingStationSubmitPayloadV1,
      "recipeId" | "jobAction"
    >
  ) => Promise<void>;
  completeJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
}

export interface CreateHarthmereCraftingStationAdapterOptionsV1 {
  state: HarthmereCraftingStationClientSnapshotV1 | undefined;
  hydrated?: boolean;
  setState?: (
    state: HarthmereCraftingStationClientSnapshotV1 | undefined
  ) => void;
  submit?: (payload: HarthmereCraftingStationSubmitPayloadV1) => Promise<{
    ok: boolean;
    craftingState?: HarthmereCraftingStationClientSnapshotV1;
    warnings?: string[];
  }>;
}

function countAvailable(
  snapshot: HarthmereCraftingStationClientSnapshotV1,
  itemId: string
) {
  return (
    Math.max(0, snapshot.inventoryItems[itemId] ?? 0) +
    Math.max(0, snapshot.materialStorage[itemId] ?? 0)
  );
}

function availableCraftingToolItemIds(
  snapshot: HarthmereCraftingStationClientSnapshotV1
) {
  return Object.keys(snapshot.inventoryItems).filter(
    (itemId) =>
      (snapshot.inventoryItems[itemId] ?? 0) > 0 &&
      Boolean(getHarthmereCraftingToolV1(itemId))
  );
}

function recipeStationOk(
  recipe: HarthmereCraftingRecipeV1,
  snapshot: HarthmereCraftingStationClientSnapshotV1
) {
  if (recipe.requiredStationId)
    return recipe.requiredStationId === snapshot.stationId;
  if (recipe.requiredStationType)
    return recipe.requiredStationType === snapshot.stationType;
  return true;
}

export function formatHarthmereCraftingPlayerLabelV1(
  value: string | undefined
) {
  if (!value) return "";
  return String(value)
    .replace(/^harthmere[_\s-]+/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatHarthmereCraftingWorkflowLabelV1(
  workflowKind: HarthmereCraftingRecipeV1["workflowKind"] | undefined
) {
  switch (workflowKind) {
    case "repair":
      return "Repair";
    case "salvage":
      return "Salvage";
    case "upgrade":
      return "Upgrade";
    case "enchant":
      return "Enchant";
    case "quest_forge":
      return "Quest Forging";
    case "craft":
    case undefined:
      return "Craft";
  }
}

export function formatHarthmereCraftingStationTypeLabelV1(
  stationType: string | undefined
) {
  switch (stationType) {
    case "general":
      return "General Work";
    case "cooking":
      return "Cooking";
    case "dying":
      return "Dye Work";
    case "composting":
      return "Composting";
    default:
      return stationType
        ? formatHarthmereCraftingPlayerLabelV1(stationType)
        : "Crafting";
  }
}

export function formatHarthmereCraftingRecipeNameV1(recipeId: string) {
  ensureHarthmereProductionCraftingCatalogueV1();
  const recipe = listHarthmereCraftingRecipesV1().find(
    (entry) => entry.recipeId === recipeId
  );
  if (recipe) {
    return (
      getHarthmereItemDefinitionV1(recipe.outputItemId)?.displayName ??
      formatHarthmereCraftingPlayerLabelV1(recipe.outputItemId)
    );
  }
  return formatHarthmereCraftingPlayerLabelV1(recipeId);
}

function playerMessageFromCraftingWarning(warning: string) {
  const code = warning.replace(/^crafting_rejected:/, "").split(":")[0];
  switch (code) {
    case "missing_recipe_id":
      return "Choose a recipe first.";
    case "unknown_recipe_id":
      return "That recipe is unavailable.";
    case "recipe_not_known":
      return "Learn this recipe first.";
    case "level_requirement_not_met":
      return "Your level is too low.";
    case "skill_requirement_not_met":
      return "Your skill is too low.";
    case "profession_requirement_not_met":
      return "Your profession level is too low.";
    case "missing_station":
    case "wrong_station_type":
    case "unknown_station_id":
      return "Use the right crafting station.";
    case "tool_not_owned":
    case "missing_tool":
    case "missing_tool_action":
    case "tool_tier_requirement_not_met":
      return "You need the right tool.";
    case "tool_durability_depleted":
      return "That tool needs repair.";
    case "insufficient_material":
      return "You need more materials.";
    case "insufficient_gold":
      return "You need more gold.";
    case "inventory_full":
    case "output_stack_size_exceeded":
    case "crafting_rejected":
      return "Make room in your inventory.";
    case "missing_or_invalid_target_item":
      return "Choose an item to work on.";
    case "target_item_not_owned":
      return "You do not have that item.";
    case "target_item_not_repairable":
      return "That item cannot be repaired.";
    case "quest_crafting_steps_not_completed":
      return "Finish the forging steps first.";
    case "job_not_ready":
      return "This work is not ready yet.";
    case "unknown_active_job":
      return "That work order is no longer active.";
    case "job_actor_mismatch":
      return "That work order belongs to someone else.";
    case "job_cancelled_by_death":
      return "The work was cancelled.";
    case "invalid_job_action":
    case "invalid_count":
    case "prepaid_crafting_inputs_not_allowed":
    case "repair_requires_repair_workflow":
      return "That crafting action is unavailable.";
    case "carry_weight_limit_exceeded":
      return "Your pack is too heavy.";
    default:
      return "Crafting is unavailable right now.";
  }
}

export function formatHarthmereCraftingPlayerErrorV1(warnings?: string[]) {
  const messages = [
    ...new Set(
      (warnings ?? [])
        .filter((warning) => typeof warning === "string" && warning.length > 0)
        .map(playerMessageFromCraftingWarning)
    ),
  ];
  return messages.length > 0
    ? messages.join(" ")
    : "Crafting is unavailable right now.";
}

export function createHarthmereCraftingVisibleRecipesV1(
  snapshot: HarthmereCraftingStationClientSnapshotV1
): HarthmereCraftingVisibleRecipeV1[] {
  ensureHarthmereProductionCraftingCatalogueV1();
  return listHarthmereCraftingRecipesV1()
    .map((recipe) => {
      const missing: string[] = [];
      const stationOk = recipeStationOk(recipe, snapshot);
      const known = snapshot.knownRecipes.includes(recipe.recipeId);
      const toolItemIds = availableCraftingToolItemIds(snapshot);
      if (!known) missing.push("Recipe");
      if (!stationOk) missing.push("Station");
      if (snapshot.gold < (recipe.goldCost ?? 0)) missing.push("Gold");
      for (const input of [...recipe.inputs, ...(recipe.fuelInputs ?? [])]) {
        if (countAvailable(snapshot, input.itemId) < input.count) {
          missing.push(
            getHarthmereItemDefinitionV1(input.itemId)?.displayName ??
              formatHarthmereCraftingPlayerLabelV1(input.itemId)
          );
        }
      }
      if (recipe.requiredSkillId) {
        const level = snapshot.skills[recipe.requiredSkillId]?.level ?? 0;
        if (level < (recipe.requiredSkillLevel ?? 1)) {
          missing.push(
            formatHarthmereCraftingPlayerLabelV1(recipe.requiredSkillId)
          );
        }
      }
      for (const toolId of recipe.requiredToolIds ?? []) {
        if (!toolItemIds.includes(toolId)) {
          missing.push(
            getHarthmereCraftingToolV1(toolId)?.displayName ??
              formatHarthmereCraftingPlayerLabelV1(toolId)
          );
        }
      }
      for (const action of recipe.requiredToolActions ?? []) {
        const hasActionTool = toolItemIds.some(
          (itemId) => getHarthmereCraftingToolV1(itemId)?.action === action
        );
        if (!hasActionTool) missing.push("Tool");
      }
      const outputDefinition = getHarthmereItemDefinitionV1(
        recipe.outputItemId
      );
      const outputName =
        outputDefinition?.displayName ??
        formatHarthmereCraftingPlayerLabelV1(recipe.outputItemId);
      return {
        recipe,
        displayName: formatHarthmereCraftingPlayerLabelV1(recipe.recipeId),
        outputName,
        stationOk,
        known,
        canCraft: missing.length === 0,
        missing,
        qualityLabel:
          recipe.successChance !== undefined
            ? `${Math.round(recipe.successChance * 100)}%`
            : "Reliable",
        workflowLabel: formatHarthmereCraftingWorkflowLabelV1(
          recipe.workflowKind
        ),
        outputVisual: harthmereResolveBikkieVisualV1({
          id: recipe.outputItemId,
          label: outputName,
          kind: outputDefinition?.category,
          objectMetadata: outputDefinition?.objectMetadata,
          bikkieGraphicHints: outputDefinition?.objectMetadata?.bikkieGraphicHints,
        }),
      };
    })
    .filter((entry) => entry.known || entry.stationOk);
}

export function normalizeHarthmereCraftingStationClientSnapshotV1(
  input: Partial<HarthmereCraftingStationClientSnapshotV1> | undefined
): HarthmereCraftingStationClientSnapshotV1 {
  ensureHarthmereProductionCraftingCatalogueV1();
  const stationId =
    input?.stationId ?? HARTHMERE_CRAFTING_STATIONS_V1.workbench;
  const station = getHarthmereCraftingStationV1(stationId);
  return {
    actorId: input?.actorId ?? "",
    stationId,
    stationType: input?.stationType ?? station?.stationType,
    stationName:
      input?.stationName ?? station?.displayName ?? "Crafting Station",
    gold: Math.max(0, Math.trunc(Number(input?.gold ?? 0))),
    inventoryItems: { ...(input?.inventoryItems ?? {}) },
    materialStorage: { ...(input?.materialStorage ?? {}) },
    knownRecipes: [...(input?.knownRecipes ?? [])],
    skills: { ...(input?.skills ?? {}) },
    activeJobs: Array.isArray(input?.activeJobs) ? input!.activeJobs : [],
    history: Array.isArray(input?.history) ? input!.history : [],
    nowMs: Math.max(0, Math.trunc(Number(input?.nowMs ?? Date.now()))),
  };
}

export function createHarthmereCraftingStationAdapterV1({
  state,
  hydrated = true,
  setState,
  submit,
}: CreateHarthmereCraftingStationAdapterOptionsV1): HarthmereCraftingStationAdapterV1 {
  const snapshot = state
    ? normalizeHarthmereCraftingStationClientSnapshotV1(state)
    : undefined;
  const mutate = async (payload: HarthmereCraftingStationSubmitPayloadV1) => {
    if (!submit) return;
    const body = await submit(payload);
    if (!body.ok) {
      throw new Error(formatHarthmereCraftingPlayerErrorV1(body.warnings));
    }
    if (body.craftingState) {
      setState?.(
        normalizeHarthmereCraftingStationClientSnapshotV1(body.craftingState)
      );
    }
  };
  const withStationDefaults = (
    payload: HarthmereCraftingStationSubmitPayloadV1
  ): HarthmereCraftingStationSubmitPayloadV1 => ({
    ...payload,
    stationId: payload.stationId ?? snapshot?.stationId,
    stationType: payload.stationType ?? snapshot?.stationType,
  });
  return {
    isHydrated: () => hydrated,
    getSnapshot: () => snapshot,
    getRecipes: () =>
      snapshot ? createHarthmereCraftingVisibleRecipesV1(snapshot) : [],
    craft: (recipeId, payload = {}) =>
      mutate(
        withStationDefaults({ ...payload, recipeId, jobAction: "instant" })
      ),
    startJob: (recipeId, payload = {}) =>
      mutate(withStationDefaults({ ...payload, recipeId, jobAction: "start" })),
    completeJob: (craftingJobId) =>
      mutate({ craftingJobId, jobAction: "complete" }),
    cancelJob: (craftingJobId) =>
      mutate({ craftingJobId, jobAction: "cancel" }),
  };
}
