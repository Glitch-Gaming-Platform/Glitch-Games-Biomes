import assert from "assert";
import {
  defaultHarthmereLiveModeBackendState,
  parseHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
} from "../live_mode_backend";
import {
  HARTHMERE_DAILY_TASK_MIN_GOLD,
  harthmereDailyTaskXpReward,
} from "../mmo_care_loops";
import type { HarthmereLiveModeAuthorityEnvelope } from "../live_mode_readiness";

const ACTOR = "player_live_care_001";
const NOW = 1_700_600_000_000;

function env(
  payload: Record<string, unknown>
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: `care_live_${Math.random()}`,
    idempotencyKey: `care_live_idem_${Math.random()}`,
    actorId: ACTOR,
    actionKind: "request_care_loop_action",
    subsystem: "care",
    source: "client_request",
    serverReceivedAtMs: NOW,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
  };
}

describe("live_mode_backend — care loop integration", () => {
  it("persists daily care loop rewards through the live backend", () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    const blocked = reduceHarthmereLiveModeBackendState(
      state,
      env({ operation: "daily_check_in", targetId: "garden" }),
      NOW
    );
    assert.ok(
      blocked.summary.warnings.includes("care_rejected:daily_task_not_done")
    );
    assert.equal(blocked.state.inventory.items.seed_carrot, undefined);

    const completed = reduceHarthmereLiveModeBackendState(
      blocked.state,
      env({ operation: "daily_task_completed", targetId: "garden" }),
      NOW
    );
    const result = reduceHarthmereLiveModeBackendState(
      completed.state,
      env({ operation: "daily_check_in", targetId: "garden" }),
      NOW
    );

    assert.equal(result.state.careLoops.daily.streak, 1);
    assert.equal(result.state.inventory.items.seed_carrot, 1);
    assert.ok(result.summary.touchedModels.includes("care_loops"));
    assert.ok(result.summary.touchedModels.includes("care_daily:garden"));
    assert.equal(result.summary.warnings.length, 0);
  });

  it("persists daily check-in gold, XP, and town care through the live backend", () => {
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    const result = reduceHarthmereLiveModeBackendState(
      state,
      env({ operation: "daily_check_in", targetId: "check_in" }),
      NOW
    );

    assert.equal(
      result.state.inventory.gold,
      state.inventory.gold + HARTHMERE_DAILY_TASK_MIN_GOLD
    );
    assert.ok(
      result.state.classMagic.skills.care.xp >=
        harthmereDailyTaskXpReward({ actorLevel: 1 })
    );
    assert.ok(
      result.state.careLoops.townNeeds.happiness >
        state.careLoops.townNeeds.happiness
    );
    assert.ok(result.summary.touchedModels.includes("care_daily:check_in"));
  });

  it("applies restoration materials, town state, and duplicate warnings safely", () => {
    let state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
    state.inventory.items.loaf_bread = 2;
    state.inventory.items.road_ration = 1;

    let result = reduceHarthmereLiveModeBackendState(
      state,
      env({ operation: "restore_project", targetId: "grove_food_satchel" }),
      NOW
    );
    assert.equal(result.state.inventory.items.loaf_bread, undefined);
    assert.equal(result.state.inventory.items.road_ration, undefined);
    assert.equal(result.state.careLoops.projects.grove_food_satchel.stage, 1);

    result = reduceHarthmereLiveModeBackendState(
      result.state,
      env({ operation: "restore_project", targetId: "grove_food_satchel" }),
      NOW
    );
    assert.ok(
      result.summary.warnings.includes(
        "care_rejected:missing_project_materials"
      )
    );
  });

  it("normalizes care loop state when loading older Redis records", () => {
    const parsed = parseHarthmereLiveModeBackendState(
      JSON.stringify({ actorId: ACTOR, inventory: { gold: 10 } }),
      ACTOR,
      NOW
    );

    assert.equal(parsed.careLoops.actorId, ACTOR);
    assert.ok(parsed.careLoops.projects.grove_food_satchel);
    assert.equal(parsed.inventory.gold, 10);
  });
});
