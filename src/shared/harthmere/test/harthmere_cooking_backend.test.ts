import assert from "assert";
import {
  createHarthmereLiveModeFarmingFoodClientSnapshot,
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import { HARTHMERE_COOKING_RECIPES } from "../mmo_farming_food_stamina";
import {
  HARTHMERE_CARRY_WEIGHT_LIMIT,
  harthmereInventoryCarryWeight,
} from "../mmo_carry_weight";
import { HARTHMERE_DEFAULT_INVENTORY_SLOTS } from "../mmo_inventory_authority";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "../live_mode_readiness";

const ACTOR = "cook_live_actor";
const NOW = 1_770_000_000_000;
let seq = 0;

function envelope(
  payload: Record<string, unknown>,
  nowMs = NOW,
  serverActorItemCounts: Record<string, number> = {},
  serverActorBackpackFreeSlots?: number
): HarthmereLiveModeAuthorityEnvelope {
  seq += 1;
  return {
    requestId: `cook-live-${seq}`,
    idempotencyKey: `cook-live-idem-${seq}`,
    actorId: ACTOR,
    actionKind: "request_farming_action" as HarthmereLiveModeActionKind,
    subsystem: "farming",
    source: "client_request",
    serverReceivedAtMs: nowMs,
    serverTick: seq,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
    serverActorPosition: { x: 0, y: 0, z: 0 },
    serverActorItemCounts,
    serverActorBackpackFreeSlots,
    serverActorGold: serverActorBackpackFreeSlots === undefined ? undefined : 0,
  };
}

function freshState(): HarthmereLiveModeBackendState {
  const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
  state.inventory.items = { raw_meat: 2 };
  return state;
}

function reduce(
  state: HarthmereLiveModeBackendState,
  payload: Record<string, unknown>,
  nowMs = NOW,
  serverActorItemCounts: Record<string, number> = state.inventory.items,
  serverActorBackpackFreeSlots?: number
) {
  return reduceHarthmereLiveModeBackendState(
    state,
    envelope(
      payload,
      nowMs,
      serverActorItemCounts,
      serverActorBackpackFreeSlots
    ),
    nowMs
  );
}

const READY_AT = NOW + 10 * 60_000; // well past the longest (120s) cook time

describe("Harthmere live-mode cooking backend", () => {
  it("enqueues a cook job, reserving ingredients into station state", () => {
    const enq = reduce(freshState(), {
      operation: "cook_enqueue",
      stationId: "ecs:1",
      stationKind: "campfire",
      label: "Campfire",
      recipeId: "grilled_meat",
      count: 1,
    });
    assert.deepEqual(
      enq.summary.warnings.filter((w: string) =>
        w.startsWith("cooking_rejected")
      ),
      []
    );
    const station = enq.state.farming.cooking["ecs:1"];
    assert.ok(station, "station recorded in farming.cooking");
    assert.equal(station.jobs.length, 1);
    assert.equal(station.jobs[0].status, "cooking");
    assert.equal(enq.state.inventory.items.raw_meat, 2);
    const enqueuePlan = enq.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.equal(enqueuePlan?.kind, "inventory_exchange");
    if (enqueuePlan?.kind === "inventory_exchange") {
      assert.equal(enqueuePlan.actorId, ACTOR);
      assert.deepEqual(enqueuePlan.consumeItemStacks, { raw_meat: 1 });
      assert.deepEqual(enqueuePlan.rewardItemStacks, {});
    }

    // Client snapshot projects the station + an in-progress job.
    const snapshot = createHarthmereLiveModeFarmingFoodClientSnapshot(
      enq.state,
      station.jobs[0].startedAtMs + 1
    ) as any;
    assert.equal(snapshot.cookingStations.length, 1);
    assert.equal(snapshot.cookingStations[0].jobs[0].recipeId, "grilled_meat");
    const readySnapshot = createHarthmereLiveModeFarmingFoodClientSnapshot(
      enq.state,
      station.jobs[0].readyAtMs + 1
    ) as any;
    assert.equal(
      readySnapshot.cookingStations[0].jobs[0].status,
      "ready",
      "read-only polling must promote cooking jobs using wall clock time"
    );
    assert.equal(readySnapshot.updatedAtMs, station.jobs[0].readyAtMs + 1);
  });

  it("rejects collecting before the dish is ready", () => {
    const enq = reduce(freshState(), {
      operation: "cook_enqueue",
      stationId: "ecs:1",
      stationKind: "campfire",
      recipeId: "grilled_meat",
      count: 1,
    });
    const jobId = enq.state.farming.cooking["ecs:1"].jobs[0].jobId;
    const early = reduce(
      enq.state,
      { operation: "cook_collect", stationId: "ecs:1", jobId },
      NOW + 1,
      { raw_meat: 1 }
    );
    assert.ok(
      early.summary.warnings.includes("cooking_rejected:not_ready"),
      JSON.stringify(early.summary.warnings)
    );
    assert.equal(early.state.inventory.items.grilled_meat ?? 0, 0);
  });

  it("collects a ready dish, granting outputs + cooking XP and pruning the station", () => {
    const enq = reduce(freshState(), {
      operation: "cook_enqueue",
      stationId: "ecs:1",
      stationKind: "campfire",
      recipeId: "grilled_meat",
      count: 1,
    });
    const jobId = enq.state.farming.cooking["ecs:1"].jobs[0].jobId;
    const collected = reduce(
      enq.state,
      { operation: "cook_collect", stationId: "ecs:1", jobId },
      READY_AT,
      { raw_meat: 1 }
    );
    assert.deepEqual(
      collected.summary.warnings.filter((w: string) =>
        w.startsWith("cooking_rejected")
      ),
      []
    );
    assert.equal(collected.state.inventory.items.grilled_meat ?? 0, 0);
    const collectPlan = collected.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.deepEqual(collectPlan?.rewardItemStacks, { grilled_meat: 1 });
    assert.equal(collected.state.farming.cooking["ecs:1"], undefined);
    assert.ok(
      (collected.state.classMagic.skills.cooking?.xp ?? 0) >=
        HARTHMERE_COOKING_RECIPES.grilled_meat.xp,
      JSON.stringify(collected.state.classMagic.skills.cooking)
    );
  });

  it("advances Carlo's quest only when the campfire skewer is collected", () => {
    const state = freshState();
    state.quests.active.econ_carlo_festival_skewers = {
      source: "snapshot_grove",
      title: "Carlo's Festival Skewers",
      stepId: "econ_carlo_festival_skewers:2:craft",
      progress: 3,
    };
    const enqueued = reduce(
      state,
      {
        operation: "cook_enqueue",
        stationId: "carlo:campfire",
        stationKind: "campfire",
        recipeId: "harthmere_grove_festival_skewer",
        count: 1,
      },
      NOW,
      { grove_festival_skewer_ingredients: 1 }
    );
    assert.equal(
      enqueued.state.quests.active.econ_carlo_festival_skewers.progress,
      3,
      "starting the timer is not the completed craft"
    );
    const jobId =
      enqueued.state.farming.cooking["carlo:campfire"].jobs[0].jobId;
    const collected = reduce(
      enqueued.state,
      {
        operation: "cook_collect",
        stationId: "carlo:campfire",
        jobId,
      },
      READY_AT,
      {}
    );
    const quest = collected.state.quests.active.econ_carlo_festival_skewers;
    assert.equal(quest.progress, 4);
    assert.equal(quest.stepId, "econ_carlo_festival_skewers:3:interact");
    const exchange = collected.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.deepEqual(exchange?.rewardItemStacks, {
      grove_festival_skewer: 1,
    });
  });

  it("end-to-end: collects cooked meat while overweight when one backpack slot is free", () => {
    const beforeCooking = Object.fromEntries(
      Array.from(
        { length: HARTHMERE_DEFAULT_INVENTORY_SLOTS - 1 },
        (_, index) => [`heavy_fixture_${index}`, 1]
      )
    );
    beforeCooking.raw_meat = 1;
    const state = freshState();
    state.inventory.items = { ...beforeCooking };

    const enqueued = reduce(
      state,
      {
        operation: "cook_enqueue",
        stationId: "ecs:overweight-campfire",
        stationKind: "campfire",
        label: "Campfire",
        recipeId: "grilled_meat",
        count: 1,
      },
      NOW,
      beforeCooking
    );
    assert.deepEqual(
      enqueued.summary.warnings.filter((warning) =>
        warning.startsWith("cooking_rejected")
      ),
      []
    );
    const enqueuePlan = enqueued.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.equal(enqueuePlan?.kind, "inventory_exchange");
    if (enqueuePlan?.kind === "inventory_exchange") {
      assert.deepEqual(enqueuePlan.consumeItemStacks, { raw_meat: 1 });
    }

    const afterIngredientReservation = { ...beforeCooking };
    delete afterIngredientReservation.raw_meat;
    assert.equal(
      Object.keys(afterIngredientReservation).length,
      HARTHMERE_DEFAULT_INVENTORY_SLOTS - 1,
      "ingredient reservation should leave one backpack slot free"
    );
    assert.ok(
      harthmereInventoryCarryWeight(afterIngredientReservation) >
        HARTHMERE_CARRY_WEIGHT_LIMIT,
      "fixture must remain overweight after reserving the raw meat"
    );

    const jobId =
      enqueued.state.farming.cooking["ecs:overweight-campfire"].jobs[0].jobId;
    const collected = reduce(
      enqueued.state,
      {
        operation: "cook_collect",
        stationId: "ecs:overweight-campfire",
        jobId,
      },
      READY_AT,
      afterIngredientReservation
    );
    assert.deepEqual(
      collected.summary.warnings.filter((warning) =>
        warning.startsWith("cooking_rejected")
      ),
      []
    );
    const collectPlan = collected.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.equal(collectPlan?.kind, "inventory_exchange");
    if (collectPlan?.kind === "inventory_exchange") {
      assert.deepEqual(collectPlan.rewardItemStacks, { grilled_meat: 1 });
    }
    assert.equal(
      collected.state.farming.cooking["ecs:overweight-campfire"],
      undefined
    );
  });

  it("allows ingredient reservation when a migrated native inventory already exceeds the slot cap", () => {
    const overfullInventory = Object.fromEntries(
      Array.from(
        { length: HARTHMERE_DEFAULT_INVENTORY_SLOTS + 3 },
        (_, index) => [`legacy_alias_${index}`, 1]
      )
    );
    overfullInventory.raw_meat = 50;
    const state = freshState();
    state.inventory.items = { ...overfullInventory };

    const enqueued = reduce(
      state,
      {
        operation: "cook_enqueue",
        stationId: "ecs:captured-campfire",
        stationKind: "campfire",
        label: "Campfire",
        recipeId: "grilled_meat",
        count: 1,
      },
      NOW,
      overfullInventory
    );

    assert.deepEqual(
      enqueued.summary.warnings.filter((warning) =>
        warning.startsWith("cooking_rejected")
      ),
      []
    );
    const exchange = enqueued.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.equal(exchange?.kind, "inventory_exchange");
    if (exchange?.kind === "inventory_exchange") {
      assert.deepEqual(exchange.consumeItemStacks, { raw_meat: 1 });
      assert.deepEqual(exchange.rewardItemStacks, {});
    }
  });

  it("collects into a real free backpack slot when hotbar keys inflate the flattened count", () => {
    const capturedCarriedCounts = Object.fromEntries(
      Array.from({ length: 43 }, (_, index) => [
        `captured_native_item_${index}`,
        1,
      ])
    );
    capturedCarriedCounts.raw_meat = 61;
    const state = freshState();
    state.inventory.items = { ...capturedCarriedCounts };

    const enqueued = reduce(
      state,
      {
        operation: "cook_enqueue",
        stationId: "ecs:captured-free-slot-campfire",
        stationKind: "campfire",
        label: "Campfire",
        recipeId: "grilled_meat",
        count: 1,
      },
      NOW,
      capturedCarriedCounts,
      3
    );
    assert.deepEqual(
      enqueued.summary.warnings.filter((warning) =>
        warning.startsWith("cooking_rejected")
      ),
      []
    );

    const jobId =
      enqueued.state.farming.cooking["ecs:captured-free-slot-campfire"].jobs[0]
        .jobId;
    const collected = reduce(
      enqueued.state,
      {
        operation: "cook_collect",
        stationId: "ecs:captured-free-slot-campfire",
        jobId,
      },
      READY_AT,
      capturedCarriedCounts,
      3
    );

    assert.deepEqual(
      collected.summary.warnings.filter((warning) =>
        warning.startsWith("cooking_rejected")
      ),
      []
    );
    const exchange = collected.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.equal(exchange?.kind, "inventory_exchange");
    if (exchange?.kind === "inventory_exchange") {
      assert.deepEqual(exchange.rewardItemStacks, { grilled_meat: 1 });
    }
  });

  it("cancels a job and refunds the reserved ingredients", () => {
    const enq = reduce(freshState(), {
      operation: "cook_enqueue",
      stationId: "ecs:1",
      stationKind: "campfire",
      recipeId: "grilled_meat",
      count: 1,
    });
    assert.equal(enq.state.inventory.items.raw_meat, 2);
    const jobId = enq.state.farming.cooking["ecs:1"].jobs[0].jobId;
    const cancelled = reduce(
      enq.state,
      { operation: "cook_cancel", stationId: "ecs:1", jobId },
      NOW + 1,
      { raw_meat: 1 }
    );
    assert.equal(cancelled.state.inventory.items.raw_meat, 2);
    const cancelPlan = cancelled.summary.nativeEcsMaterializationPlans?.find(
      (plan) => plan.kind === "inventory_exchange"
    );
    assert.deepEqual(cancelPlan?.rewardItemStacks, { raw_meat: 1 });
    assert.equal(cancelled.state.farming.cooking["ecs:1"], undefined);
  });

  it("spoils uncollected dishes via the reducer's lazy tick (can't be collected late)", () => {
    const enq = reduce(freshState(), {
      operation: "cook_enqueue",
      stationId: "ecs:1",
      stationKind: "campfire",
      recipeId: "grilled_meat",
      count: 1,
    });
    const jobId = enq.state.farming.cooking["ecs:1"].jobs[0].jobId;
    // Three hours later (well past the 1h spoil window) the dish is gone before
    // collect even runs — the station has been pruned.
    const late = reduce(
      enq.state,
      { operation: "cook_collect", stationId: "ecs:1", jobId },
      NOW + 3 * 60 * 60 * 1000,
      { raw_meat: 1 }
    );
    assert.equal(late.state.farming.cooking["ecs:1"], undefined);
    assert.equal(late.state.inventory.items.grilled_meat ?? 0, 0);
    assert.ok(
      late.summary.warnings.some((w: string) =>
        w.startsWith("cooking_rejected")
      ),
      JSON.stringify(late.summary.warnings)
    );
  });

  it("rejects an oven recipe at a campfire station", () => {
    const enq = reduce(
      {
        ...freshState(),
        inventory: { items: { wild_berries: 2, loaf_bread: 1, fresh_milk: 1 } },
        classMagic: {
          ...freshState().classMagic,
          skills: {
            ...freshState().classMagic.skills,
            cooking: { xp: 0, level: 100 },
          },
        },
      } as any,
      {
        operation: "cook_enqueue",
        stationId: "ecs:1",
        stationKind: "campfire",
        recipeId: "berry_tart",
        count: 1,
      }
    );
    assert.ok(
      enq.summary.warnings.includes("cooking_rejected:missing_station:oven"),
      JSON.stringify(enq.summary.warnings)
    );
  });
});
