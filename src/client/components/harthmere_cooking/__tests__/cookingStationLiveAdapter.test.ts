import assert from "assert";
import {
  createHarthmereCookVisibleRecipesV1,
  createHarthmereCookingAdapterV1,
  formatHarthmereCookItemNameV1,
  formatHarthmereCookingPlayerErrorV1,
  harthmereCookMaxCookableV1,
  harthmereCookRecipeDetailV1,
  isHarthmereCookingStationRecipeVisibleV1,
  harthmereCookStationJobsV1,
  playerMessageFromCookingWarningV1,
  type HarthmereCookSnapshotV1,
} from "../cookingStationLiveAdapter";
import {
  HARTHMERE_COOKING_RECIPES_V1,
  scaleHarthmereCookDurationMsV1,
} from "@/shared/harthmere/mmo_farming_food_stamina_v1";

describe("cookingStationLiveAdapter — recipe projection", () => {
  it("only lists recipes cookable at the opened station (kind + field recipes)", () => {
    const recipes = createHarthmereCookVisibleRecipesV1(
      { raw_meat: 3 },
      "campfire",
    );
    const ids = recipes.map((r) => r.recipeId);
    assert.ok(ids.includes("grilled_meat"), "campfire shows grilled_meat");
    assert.ok(!ids.includes("worker_meal"), "campfire hides cookpot recipes");
    assert.ok(!ids.includes("berry_tart"), "campfire hides oven recipes");
    // Any station-less cooking recipe is cookable everywhere.
    const fieldRecipe = Object.values(HARTHMERE_COOKING_RECIPES_V1).find(
      (r) =>
        r.stationKind === "field" &&
        isHarthmereCookingStationRecipeVisibleV1(r),
    );
    if (fieldRecipe) {
      assert.ok(ids.includes(fieldRecipe.recipeId), "field recipes show anywhere");
    }
  });

  it("hides seed and fertilizer recipes from cooking station lists", () => {
    const recipes = createHarthmereCookVisibleRecipesV1({}, "campfire");
    assert.ok(recipes.length > 0);
    assert.equal(
      recipes.some((recipe) => recipe.recipe.recipeType === "seed"),
      false,
      "campfires should not show seed recipes"
    );
    assert.equal(
      recipes.some((recipe) => recipe.recipe.recipeType === "fertilizer"),
      false,
      "campfires should not show fertilizer recipes"
    );
    assert.equal(
      recipes.some((recipe) => /seed|fertilizer/i.test(recipe.displayName)),
      false,
      "campfires should not read like a farming bench"
    );
  });

  it("computes have-vs-need and canCook from inventory", () => {
    const none = createHarthmereCookVisibleRecipesV1({}, "campfire").find(
      (r) => r.recipeId === "grilled_meat",
    );
    assert.ok(none);
    assert.equal(none!.canCook, false);
    assert.ok(none!.missing.length > 0);
    assert.equal(none!.ingredients[0].enough, false);

    const ready = createHarthmereCookVisibleRecipesV1(
      { raw_meat: 2 },
      "campfire",
    ).find((r) => r.recipeId === "grilled_meat");
    assert.ok(ready);
    assert.equal(ready!.canCook, true);
    assert.deepEqual(ready!.missing, []);
    assert.equal(ready!.ingredients[0].have, 2);
  });

  it("caps maxCookable by ingredients and recipe batch limit", () => {
    const recipe = HARTHMERE_COOKING_RECIPES_V1.grilled_meat;
    assert.equal(harthmereCookMaxCookableV1(recipe, { raw_meat: 5 }), 5);
    assert.equal(
      harthmereCookMaxCookableV1(recipe, { raw_meat: 9999 }),
      recipe.maxBatchCount,
    );
    assert.equal(harthmereCookMaxCookableV1(recipe, {}), 0);
  });

  it("shortens unknown numeric item ids for player-facing ingredient names", () => {
    assert.equal(formatHarthmereCookItemNameV1("1534621126189406"), "Ingredient 9406");
  });

  it("scales ingredient need and duration with batch count in the detail view", () => {
    const detail = harthmereCookRecipeDetailV1(
      "grilled_meat",
      { raw_meat: 5 },
      "campfire",
      3,
    );
    assert.ok(detail);
    assert.equal(detail!.ingredients[0].need, 3);
    assert.equal(detail!.outputCount, 3);
    assert.equal(
      detail!.durationMs,
      scaleHarthmereCookDurationMsV1(
        HARTHMERE_COOKING_RECIPES_V1.grilled_meat.cookTimeMs,
        3,
      ),
    );
  });

  it("projects station jobs from the snapshot", () => {
    const snapshot: HarthmereCookSnapshotV1 = {
      inventory: {},
      availableStationKinds: ["campfire"],
      updatedAtMs: 0,
      stations: [
        {
          stationId: "s1",
          stationKind: "campfire",
          jobs: [
            {
              jobId: "j1",
              recipeId: "grilled_meat",
              displayName: "Grilled Meat",
              count: 1,
              status: "cooking",
              startedAtMs: 0,
              readyAtMs: 100,
              progress: 0.5,
              outputs: { grilled_meat: 1 },
            },
          ],
        },
      ],
    };
    assert.equal(harthmereCookStationJobsV1(snapshot, "s1").length, 1);
    assert.equal(harthmereCookStationJobsV1(snapshot, "missing").length, 0);
  });
});

describe("cookingStationLiveAdapter — warnings", () => {
  it("maps cooking_rejected codes to player-facing messages", () => {
    assert.match(
      playerMessageFromCookingWarningV1("cooking_rejected:queue_full"),
      /queue is full/i,
    );
    assert.match(
      playerMessageFromCookingWarningV1(
        "cooking_rejected:carry_weight_limit_exceeded",
      ),
      /too heavy/i,
    );
    assert.match(
      playerMessageFromCookingWarningV1("cooking_rejected:missing_input:fresh_carrot"),
      /ingredients/i,
    );
    assert.match(
      playerMessageFromCookingWarningV1("cooking_rejected:collect_only"),
      /collect it/i,
    );
    assert.equal(
      formatHarthmereCookingPlayerErrorV1([
        "cooking_rejected:not_ready",
        "cooking_rejected:not_ready",
      ]),
      "That dish isn't ready yet.",
    );
  });
});

describe("cookingStationLiveAdapter — submit envelopes", () => {
  function harness(submitResult: { ok: boolean; warnings?: string[] }) {
    const calls: Array<{ operation: string; payload: Record<string, unknown> }> =
      [];
    const adapter = createHarthmereCookingAdapterV1({
      snapshot: {
        inventory: { raw_meat: 5 },
        stations: [],
        availableStationKinds: ["campfire"],
        updatedAtMs: 0,
      },
      stationId: "ecs:42",
      stationKind: "campfire",
      label: "Gus's Oven",
      submit: async (operation, payload) => {
        calls.push({ operation, payload });
        return submitResult;
      },
    });
    return { adapter, calls };
  }

  it("sends enqueue/collect/cancel with station-scoped payloads", async () => {
    const { adapter, calls } = harness({ ok: true });
    await adapter.enqueueCook("grilled_meat", 2);
    await adapter.collectCook("job-1");
    await adapter.cancelCook("job-2");
    assert.deepEqual(calls[0], {
      operation: "cook_enqueue",
      payload: {
        stationId: "ecs:42",
        stationKind: "campfire",
        label: "Gus's Oven",
        recipeId: "grilled_meat",
        count: 2,
      },
    });
    assert.deepEqual(calls[1], {
      operation: "cook_collect",
      payload: { stationId: "ecs:42", jobId: "job-1" },
    });
    assert.deepEqual(calls[2], {
      operation: "cook_cancel",
      payload: { stationId: "ecs:42", jobId: "job-2" },
    });
  });

  it("throws a player-facing error when the backend rejects", async () => {
    const { adapter } = harness({
      ok: false,
      warnings: ["cooking_rejected:queue_full"],
    });
    await assert.rejects(
      () => adapter.enqueueCook("grilled_meat", 1),
      /queue is full/i,
    );
  });
});
