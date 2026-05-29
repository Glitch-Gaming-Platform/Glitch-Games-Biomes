import assert from "assert";
import {
  defaultHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import type {
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "../live_mode_readiness_v1";

const ACTOR = "player_live_care_001";
const NOW = 1_700_600_000_000;

function env(payload: Record<string, unknown>): HarthmereLiveModeAuthorityEnvelopeV1 {
  return {
    requestId: `care_live_${Math.random()}`,
    idempotencyKey: `care_live_idem_${Math.random()}`,
    actorId: ACTOR,
    actionKind: "request_care_loop_action",
    subsystem: "quest",
    source: "client_request",
    serverReceivedAtMs: NOW,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
  };
}

describe("live_mode_backend_v1 — care loop integration", () => {
  it("persists daily care loop rewards through the live backend", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW);
    const result = reduceHarthmereLiveModeBackendStateV1(
      state,
      env({ operation: "daily_check_in", targetId: "garden" }),
      NOW,
    );

    assert.equal(result.state.careLoops.daily.streak, 1);
    assert.equal(result.state.inventory.items.seed_carrot, 1);
    assert.ok(result.summary.touchedModels.includes("care_loops"));
    assert.ok(result.summary.touchedModels.includes("care_daily:garden"));
    assert.equal(result.summary.warnings.length, 0);
  });

  it("applies restoration materials, town state, and duplicate warnings safely", () => {
    let state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW);
    state.inventory.items.loaf_bread = 2;
    state.inventory.items.road_ration = 1;

    let result = reduceHarthmereLiveModeBackendStateV1(
      state,
      env({ operation: "restore_project", targetId: "grove_food_satchel" }),
      NOW,
    );
    assert.equal(result.state.inventory.items.loaf_bread, undefined);
    assert.equal(result.state.inventory.items.road_ration, undefined);
    assert.equal(result.state.careLoops.projects.grove_food_satchel.stage, 1);

    result = reduceHarthmereLiveModeBackendStateV1(
      result.state,
      env({ operation: "restore_project", targetId: "grove_food_satchel" }),
      NOW,
    );
    assert.ok(result.summary.warnings.includes("care_rejected:missing_project_materials"));
  });

  it("normalizes care loop state when loading older Redis records", () => {
    const parsed = parseHarthmereLiveModeBackendStateV1(
      JSON.stringify({ actorId: ACTOR, inventory: { gold: 10 } }),
      ACTOR,
      NOW,
    );

    assert.equal(parsed.careLoops.actorId, ACTOR);
    assert.ok(parsed.careLoops.projects.grove_food_satchel);
    assert.equal(parsed.inventory.gold, 10);
  });
});
