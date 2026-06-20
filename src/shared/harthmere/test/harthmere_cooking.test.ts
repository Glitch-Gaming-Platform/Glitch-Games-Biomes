import assert from "assert";
import {
  HARTHMERE_COOKING_RECIPES,
  HARTHMERE_COOK_DURATION_MAX_MS,
  HARTHMERE_COOK_DURATION_MIN_MS,
  HARTHMERE_COOK_QUEUE_CAP,
  HARTHMERE_COOK_SPOIL_MS,
  HARTHMERE_COOK_STATION_JOBS_MAX,
  cancelHarthmereCook,
  collectHarthmereCook,
  defaultHarthmereFoodStaminaState,
  enqueueHarthmereCook,
  scaleHarthmereCookDurationMs,
  tickHarthmereCooking,
  type HarthmereFoodStaminaState,
} from "../mmo_farming_food_stamina";

const NOW = 1_700_400_000_000;

function baseState(
  inventory: Record<string, number>,
): HarthmereFoodStaminaState {
  return {
    ...defaultHarthmereFoodStaminaState("player_cook", NOW),
    inventory: { ...inventory },
    cooking: {},
  };
}

const GRILLED_DURATION = scaleHarthmereCookDurationMs(
  HARTHMERE_COOKING_RECIPES.grilled_meat.cookTimeMs,
  1,
);

describe("harthmere cooking — duration scaler", () => {
  it("clamps every recipe into the 20s–120s band", () => {
    for (const recipe of Object.values(HARTHMERE_COOKING_RECIPES)) {
      const ms = scaleHarthmereCookDurationMs(recipe.cookTimeMs, 1);
      assert.ok(
        ms >= HARTHMERE_COOK_DURATION_MIN_MS &&
          ms <= HARTHMERE_COOK_DURATION_MAX_MS,
        `${recipe.recipeId} -> ${ms}ms out of band`,
      );
    }
  });

  it("maps the corpus min to 20s and max to 120s, and clamps beyond", () => {
    const times = Object.values(HARTHMERE_COOKING_RECIPES).map(
      (r) => r.cookTimeMs,
    );
    const min = Math.min(...times);
    const max = Math.max(...times);
    assert.equal(
      scaleHarthmereCookDurationMs(min, 1),
      HARTHMERE_COOK_DURATION_MIN_MS,
    );
    assert.equal(
      scaleHarthmereCookDurationMs(max, 1),
      HARTHMERE_COOK_DURATION_MAX_MS,
    );
    assert.equal(
      scaleHarthmereCookDurationMs(min - 9999, 1),
      HARTHMERE_COOK_DURATION_MIN_MS,
    );
    assert.equal(
      scaleHarthmereCookDurationMs(max + 9999, 1),
      HARTHMERE_COOK_DURATION_MAX_MS,
    );
  });

  it("multiplies by batch count and is monotonic in cook time", () => {
    assert.equal(
      scaleHarthmereCookDurationMs(60_000, 3),
      scaleHarthmereCookDurationMs(60_000, 1) * 3,
    );
    assert.ok(
      scaleHarthmereCookDurationMs(30_000, 1) <=
        scaleHarthmereCookDurationMs(90_000, 1),
    );
  });
});

describe("harthmere cooking — enqueue", () => {
  it("reserves ingredients and starts the first job cooking", () => {
    const result = enqueueHarthmereCook(baseState({ raw_meat: 3 }), {
      stationId: "s1",
      stationKind: "campfire",
      recipeId: "grilled_meat",
      count: 1,
      nowMs: NOW,
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.inventory.raw_meat, 2);
    const station = result.state.cooking.s1;
    assert.equal(station.jobs.length, 1);
    const job = station.jobs[0];
    assert.equal(job.status, "cooking");
    assert.deepEqual(job.reservedInputs, { raw_meat: 1 });
    assert.equal(job.startedAtMs, NOW);
    assert.equal(job.readyAtMs, NOW + GRILLED_DURATION);
  });

  it("rejects when ingredients are missing (incl. already-reserved)", () => {
    const empty = enqueueHarthmereCook(baseState({}), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    assert.ok(empty.warnings.includes("cooking_rejected:missing_raw_food"));

    const noVeg = enqueueHarthmereCook(baseState({}), {
      stationId: "s1",
      stationKind: "cookpot",
      recipeId: "worker_meal",
      nowMs: NOW,
    });
    assert.ok(
      noVeg.warnings.includes("cooking_rejected:missing_input:loaf_bread"),
    );

    // Only one raw_meat: first job reserves it, second has nothing left.
    const first = enqueueHarthmereCook(baseState({ raw_meat: 1 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    const second = enqueueHarthmereCook(first.state, {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW + 1,
    });
    assert.ok(second.warnings.includes("cooking_rejected:missing_raw_food"));
  });

  it("rejects over-batch and station-kind mismatch", () => {
    const tooBig = enqueueHarthmereCook(baseState({ raw_meat: 99 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      count: HARTHMERE_COOKING_RECIPES.grilled_meat.maxBatchCount + 1,
      nowMs: NOW,
    });
    assert.ok(tooBig.warnings.includes("cooking_rejected:batch_too_large"));

    const wrongStation = enqueueHarthmereCook(
      baseState({ loaf_bread: 5, fresh_carrot: 5 }),
      {
        stationId: "s1",
        stationKind: "campfire",
        recipeId: "worker_meal",
        nowMs: NOW,
      },
    );
    assert.ok(
      wrongStation.warnings.includes(
        "cooking_rejected:missing_station:cookpot",
      ),
    );
  });

  it("rejects once the station queue is full", () => {
    let state = baseState({ raw_meat: 5 });
    for (let i = 0; i < HARTHMERE_COOK_QUEUE_CAP; i++) {
      const r = enqueueHarthmereCook(state, {
        stationId: "s1",
        recipeId: "grilled_meat",
        nowMs: NOW + i,
      });
      assert.deepEqual(r.warnings, [], `enqueue ${i} should succeed`);
      state = r.state;
    }
    const overflow = enqueueHarthmereCook(state, {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW + 100,
    });
    assert.ok(overflow.warnings.includes("cooking_rejected:queue_full"));
  });

  it("caps total jobs per station so uncollected dishes can't grow unbounded", () => {
    // Each enqueue happens after the previous finishes, so prior jobs become
    // `ready` (uncollected) and don't count toward the non-ready queue cap —
    // exercising the separate total-jobs backstop.
    const step = GRILLED_DURATION + 1000;
    let state = baseState({ raw_meat: HARTHMERE_COOK_STATION_JOBS_MAX + 1 });
    for (let i = 0; i < HARTHMERE_COOK_STATION_JOBS_MAX; i++) {
      const r = enqueueHarthmereCook(state, {
        stationId: "s1",
        recipeId: "grilled_meat",
        nowMs: NOW + i * step,
      });
      assert.deepEqual(r.warnings, [], `enqueue ${i} should succeed`);
      state = r.state;
    }
    assert.equal(
      state.cooking.s1.jobs.length,
      HARTHMERE_COOK_STATION_JOBS_MAX,
    );
    const overflow = enqueueHarthmereCook(state, {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW + HARTHMERE_COOK_STATION_JOBS_MAX * step,
    });
    assert.ok(overflow.warnings.includes("cooking_rejected:queue_full"));
  });

  it("chains a second job to start when the first finishes", () => {
    const first = enqueueHarthmereCook(baseState({ raw_meat: 2 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    const second = enqueueHarthmereCook(first.state, {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW + 1,
    });
    const [job1, job2] = second.state.cooking.s1.jobs;
    assert.equal(job1.status, "cooking");
    assert.equal(job2.status, "pending");
    assert.equal(job2.startedAtMs, job1.readyAtMs);
    assert.equal(job2.readyAtMs, job1.readyAtMs + GRILLED_DURATION);
  });
});

describe("harthmere cooking — tick", () => {
  it("promotes pending → cooking → ready and is reload-deterministic", () => {
    const first = enqueueHarthmereCook(baseState({ raw_meat: 2 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    const enqueued = enqueueHarthmereCook(first.state, {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW + 1,
    }).state.cooking;

    const midway = tickHarthmereCooking(enqueued, NOW + GRILLED_DURATION + 1);
    assert.equal(midway.s1.jobs[0].status, "ready");
    assert.equal(midway.s1.jobs[1].status, "cooking");

    const done = tickHarthmereCooking(enqueued, NOW + 2 * GRILLED_DURATION + 1);
    assert.equal(done.s1.jobs[0].status, "ready");
    assert.equal(done.s1.jobs[1].status, "ready");

    // Simulate logout/reload: serialize, re-tick at the same clock → identical.
    const reloaded = JSON.parse(JSON.stringify(enqueued));
    const afterReload = tickHarthmereCooking(
      reloaded,
      NOW + GRILLED_DURATION + 1,
    );
    assert.deepEqual(afterReload.s1.jobs, midway.s1.jobs);
  });

  it("spoils an uncollected dish after the spoil window and prunes the station", () => {
    const cooking = enqueueHarthmereCook(baseState({ raw_meat: 1 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    }).state.cooking;

    const readyAt = NOW + GRILLED_DURATION;
    // Just before the spoil window elapses: still collectable.
    const fresh = tickHarthmereCooking(
      cooking,
      readyAt + HARTHMERE_COOK_SPOIL_MS - 1,
    );
    assert.ok(fresh.s1);
    assert.equal(fresh.s1.jobs[0].status, "ready");

    // Past the spoil window: the dish disappears and the station is pruned.
    const spoiled = tickHarthmereCooking(
      cooking,
      readyAt + HARTHMERE_COOK_SPOIL_MS + 1,
    );
    assert.equal(spoiled.s1, undefined);
  });

  it("auto-cleans an orphaned station once every queued dish finishes and spoils", () => {
    // Two queued dishes nobody ever collects (e.g. the placed station was
    // destroyed). After both finish AND spoil, the station prunes itself with
    // no ECS reconciliation needed.
    let state = baseState({ raw_meat: 2 });
    state = enqueueHarthmereCook(state, {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    }).state;
    state = enqueueHarthmereCook(state, {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW + 1,
    }).state;
    // Second dish is ready at ~NOW + 2*duration; give it a full spoil window.
    const wayLater = tickHarthmereCooking(
      state.cooking,
      NOW + 2 * GRILLED_DURATION + HARTHMERE_COOK_SPOIL_MS + 1,
    );
    assert.equal(wayLater.s1, undefined);
  });
});

describe("harthmere cooking — collect", () => {
  it("rejects collecting before the job is ready", () => {
    const enq = enqueueHarthmereCook(baseState({ raw_meat: 1 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    const jobId = enq.state.cooking.s1.jobs[0].jobId;
    const early = collectHarthmereCook(enq.state, {
      stationId: "s1",
      jobId,
      nowMs: NOW + 1,
    });
    assert.ok(early.warnings.includes("cooking_rejected:not_ready"));
  });

  it("adds outputs, awards xp, and prunes the emptied station", () => {
    const enq = enqueueHarthmereCook(baseState({ raw_meat: 1 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    const jobId = enq.state.cooking.s1.jobs[0].jobId;
    const collected = collectHarthmereCook(enq.state, {
      stationId: "s1",
      jobId,
      nowMs: NOW + GRILLED_DURATION,
    });
    assert.deepEqual(collected.warnings, []);
    assert.equal(collected.state.inventory.grilled_meat, 1);
    assert.equal(
      collected.cookingXpDelta,
      HARTHMERE_COOKING_RECIPES.grilled_meat.xp,
    );
    assert.equal(collected.state.cooking.s1, undefined);
  });

  it("blocks collection that would exceed the carry-weight limit", () => {
    // 5 steel swords = 25 lb (at the limit). raw_meat is reserved away on
    // enqueue; collecting grilled_meat (+1 lb) would push past 25.
    const enq = enqueueHarthmereCook(
      baseState({ steel_sword: 5, raw_meat: 1 }),
      { stationId: "s1", recipeId: "grilled_meat", nowMs: NOW },
    );
    const jobId = enq.state.cooking.s1.jobs[0].jobId;
    const blocked = collectHarthmereCook(enq.state, {
      stationId: "s1",
      jobId,
      nowMs: NOW + GRILLED_DURATION,
    });
    assert.ok(
      blocked.warnings.includes(
        "cooking_rejected:carry_weight_limit_exceeded",
      ),
    );
    assert.equal(blocked.state.inventory.grilled_meat ?? 0, 0);
    assert.ok(blocked.state.cooking.s1, "job should remain for later collection");
  });
});

describe("harthmere cooking — cancel", () => {
  it("refunds a pending job and keeps the active one", () => {
    const first = enqueueHarthmereCook(baseState({ raw_meat: 2 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    const second = enqueueHarthmereCook(first.state, {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW + 1,
    });
    const job2Id = second.state.cooking.s1.jobs[1].jobId;
    const cancelled = cancelHarthmereCook(second.state, {
      stationId: "s1",
      jobId: job2Id,
      nowMs: NOW + 2,
    });
    assert.deepEqual(cancelled.warnings, []);
    assert.equal(cancelled.state.inventory.raw_meat, 1); // one refunded
    assert.equal(cancelled.state.cooking.s1.jobs.length, 1);
    assert.equal(cancelled.state.cooking.s1.jobs[0].status, "cooking");
  });

  it("re-chains a pending job to start now when the active job is cancelled", () => {
    const first = enqueueHarthmereCook(baseState({ raw_meat: 2 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    const second = enqueueHarthmereCook(first.state, {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW + 1,
    });
    const job1Id = second.state.cooking.s1.jobs[0].jobId;
    const cancelNow = NOW + 5;
    const cancelled = cancelHarthmereCook(second.state, {
      stationId: "s1",
      jobId: job1Id,
      nowMs: cancelNow,
    });
    const job = cancelled.state.cooking.s1.jobs[0];
    assert.equal(cancelled.state.cooking.s1.jobs.length, 1);
    assert.equal(job.startedAtMs, cancelNow);
    assert.equal(job.readyAtMs, cancelNow + GRILLED_DURATION);
    assert.equal(job.status, "cooking");
  });

  it("shifts later pending jobs earlier when a middle pending job is cancelled", () => {
    let state = baseState({ raw_meat: 3 });
    for (let i = 0; i < 3; i++) {
      state = enqueueHarthmereCook(state, {
        stationId: "s1",
        recipeId: "grilled_meat",
        nowMs: NOW + i,
      }).state;
    }
    const [job1, job2] = state.cooking.s1.jobs;
    const cancelled = cancelHarthmereCook(state, {
      stationId: "s1",
      jobId: job2.jobId,
      nowMs: NOW + 2,
    });
    const remaining = cancelled.state.cooking.s1.jobs;
    assert.equal(remaining.length, 2);
    // job1 (cooking) unchanged; job3 now chains directly off job1.
    assert.equal(remaining[0].jobId, job1.jobId);
    assert.equal(remaining[0].startedAtMs, NOW);
    assert.equal(remaining[1].startedAtMs, job1.readyAtMs);
  });

  it("discards a ready dish without refunding (escape hatch), and prunes the station", () => {
    const enq = enqueueHarthmereCook(baseState({ raw_meat: 1 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    const jobId = enq.state.cooking.s1.jobs[0].jobId;
    // Discarding a finished dish removes it but does NOT refund the ingredients
    // (they were already cooked). raw_meat was reserved to 0 on enqueue.
    const discarded = cancelHarthmereCook(enq.state, {
      stationId: "s1",
      jobId,
      nowMs: NOW + GRILLED_DURATION,
    });
    assert.deepEqual(discarded.warnings, []);
    assert.equal(discarded.state.cooking.s1, undefined);
    assert.equal(discarded.state.inventory.raw_meat ?? 0, 0); // not refunded
    assert.equal(discarded.state.inventory.grilled_meat ?? 0, 0); // not collected
  });

  it("cancelling a not-yet-ready job refunds and prunes", () => {
    const enq = enqueueHarthmereCook(baseState({ raw_meat: 1 }), {
      stationId: "s1",
      recipeId: "grilled_meat",
      nowMs: NOW,
    });
    const jobId = enq.state.cooking.s1.jobs[0].jobId;
    const pruned = cancelHarthmereCook(enq.state, {
      stationId: "s1",
      jobId,
      nowMs: NOW + 1,
    });
    assert.deepEqual(pruned.warnings, []);
    assert.equal(pruned.state.cooking.s1, undefined);
    assert.equal(pruned.state.inventory.raw_meat, 1); // refunded
  });
});
