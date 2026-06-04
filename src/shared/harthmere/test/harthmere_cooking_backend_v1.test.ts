import assert from "assert";
import {
  createHarthmereLiveModeFarmingFoodClientSnapshotV1,
  defaultHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
  type HarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import { HARTHMERE_COOKING_RECIPES_V1 } from "../mmo_farming_food_stamina_v1";
import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "../live_mode_readiness_v1";

const ACTOR = "cook_live_actor";
const NOW = 1_770_000_000_000;
let seq = 0;

function envelope(
  payload: Record<string, unknown>,
  nowMs = NOW
): HarthmereLiveModeAuthorityEnvelopeV1 {
  seq += 1;
  return {
    requestId: `cook-live-${seq}`,
    idempotencyKey: `cook-live-idem-${seq}`,
    actorId: ACTOR,
    actionKind: "request_farming_action" as HarthmereLiveModeActionKindV1,
    subsystem: "farming",
    source: "client_request",
    serverReceivedAtMs: nowMs,
    serverTick: seq,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
  };
}

function freshState(): HarthmereLiveModeBackendStateV1 {
  const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW);
  state.inventory.items = { raw_meat: 2 };
  return state;
}

function reduce(
  state: HarthmereLiveModeBackendStateV1,
  payload: Record<string, unknown>,
  nowMs = NOW
) {
  return reduceHarthmereLiveModeBackendStateV1(state, envelope(payload, nowMs), nowMs);
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
      enq.summary.warnings.filter((w: string) => w.startsWith("cooking_rejected")),
      [],
    );
    const station = enq.state.farming.cooking["ecs:1"];
    assert.ok(station, "station recorded in farming.cooking");
    assert.equal(station.jobs.length, 1);
    assert.equal(station.jobs[0].status, "cooking");
    assert.equal(enq.state.inventory.items.raw_meat, 1); // one reserved

    // Client snapshot projects the station + an in-progress job.
    const snapshot = createHarthmereLiveModeFarmingFoodClientSnapshotV1(
      enq.state,
    ) as any;
    assert.equal(snapshot.cookingStations.length, 1);
    assert.equal(snapshot.cookingStations[0].jobs[0].recipeId, "grilled_meat");
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
    );
    assert.ok(
      early.summary.warnings.includes("cooking_rejected:not_ready"),
      JSON.stringify(early.summary.warnings),
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
    );
    assert.deepEqual(
      collected.summary.warnings.filter((w: string) =>
        w.startsWith("cooking_rejected"),
      ),
      [],
    );
    assert.equal(collected.state.inventory.items.grilled_meat, 1);
    assert.equal(collected.state.farming.cooking["ecs:1"], undefined);
    assert.ok(
      (collected.state.classMagic.skills.cooking?.xp ?? 0) >=
        HARTHMERE_COOKING_RECIPES_V1.grilled_meat.xp,
      JSON.stringify(collected.state.classMagic.skills.cooking),
    );
  });

  it("cancels a job and refunds the reserved ingredients", () => {
    const enq = reduce(freshState(), {
      operation: "cook_enqueue",
      stationId: "ecs:1",
      stationKind: "campfire",
      recipeId: "grilled_meat",
      count: 1,
    });
    assert.equal(enq.state.inventory.items.raw_meat, 1);
    const jobId = enq.state.farming.cooking["ecs:1"].jobs[0].jobId;
    const cancelled = reduce(
      enq.state,
      { operation: "cook_cancel", stationId: "ecs:1", jobId },
      NOW + 1,
    );
    assert.equal(cancelled.state.inventory.items.raw_meat, 2); // refunded
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
    );
    assert.equal(late.state.farming.cooking["ecs:1"], undefined);
    assert.equal(late.state.inventory.items.grilled_meat ?? 0, 0);
    assert.ok(
      late.summary.warnings.some((w: string) =>
        w.startsWith("cooking_rejected"),
      ),
      JSON.stringify(late.summary.warnings),
    );
  });

  it("rejects an oven recipe at a campfire station", () => {
    const enq = reduce(
      { ...freshState(), inventory: { items: { wild_berries: 2, loaf_bread: 1, fresh_milk: 1 } } } as any,
      {
        operation: "cook_enqueue",
        stationId: "ecs:1",
        stationKind: "campfire",
        recipeId: "berry_tart",
        count: 1,
      },
    );
    assert.ok(
      enq.summary.warnings.includes("cooking_rejected:missing_station:oven"),
      JSON.stringify(enq.summary.warnings),
    );
  });
});
