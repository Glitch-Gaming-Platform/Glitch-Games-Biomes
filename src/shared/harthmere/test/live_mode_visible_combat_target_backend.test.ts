/// <reference types="mocha" />
import assert from "assert";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "@/shared/harthmere/live_mode_readiness";

const NOW_MS = 1_760_000_000_000;
const ACTOR = "visible-combat-target-player";

function freshState() {
  const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
  state.classMagic.knownAbilities = ["basic_strike"];
  state.classMagic.loadout = { slot_0: "basic_strike" };
  return state;
}

function envelope(
  actionKind: HarthmereLiveModeActionKind,
  targetId: string,
  clientClaims: Record<string, unknown>,
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {}
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: `visible-combat-${Math.random().toString(36).slice(2)}`,
    idempotencyKey: `visible-combat-idem-${Math.random()
      .toString(36)
      .slice(2)}`,
    actorId: ACTOR,
    targetId,
    actionKind,
    subsystem: "combat",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "harthmere_wilderness",
    payload: { abilityId: "basic_strike" },
    clientClaims,
    serverActorPosition: { x: 0, y: 20, z: 0 },
    ...overrides,
  };
}

function addMismatchedMuckerTarget(
  state: HarthmereLiveModeBackendState,
  targetId: string
) {
  state.combat.entitySnapshots[targetId] = {
    hp: 100,
    maxHp: 100,
    // This stale/seeded position is intentionally far away from the player. The
    // visible mesh position claim is what should be range-checked for this
    // server-muck target class.
    position: { x: 999, y: 54, z: 999 },
    isHostile: true,
    isAlive: true,
    isAttackable: true,
    entityKind: "mux",
    bodyRadius: 0.9,
    level: 1,
  };
}

describe("harthmere live-mode visible combat target backend", () => {
  it("lets a server-muck target use the visible mesh position for melee reach", () => {
    const targetId = "server-muck-combat:visible-position-mucker:1302";
    const start = freshState();
    addMismatchedMuckerTarget(start, targetId);

    const { state, summary } = reduceHarthmereLiveModeBackendState(
      start,
      envelope("request_attack", targetId, {
        source: "crosshair_visible_actor",
        targetPosition: [1, 54, 0],
      }),
      NOW_MS
    );

    assert.ok(
      !summary.warnings.some((warning) =>
        warning.startsWith("combat_rejected:")
      ),
      summary.warnings.join(", ")
    );
    assert.ok(state.combat.entitySnapshots[targetId].hp < 100);
    assert.equal(state.combat.entitySnapshots[targetId].lastAttackerId, ACTOR);
  });

  it("rejects a server-muck visible position claim outside voxel reach", () => {
    const targetId = "server-muck-combat:visible-position-far-mucker:1303";
    const start = freshState();
    addMismatchedMuckerTarget(start, targetId);

    const { state, summary } = reduceHarthmereLiveModeBackendState(
      start,
      envelope("request_attack", targetId, {
        source: "crosshair_visible_actor",
        targetPosition: [40, 54, 0],
      }),
      NOW_MS
    );

    assert.ok(summary.warnings.includes("combat_rejected:target_out_of_range"));
    assert.equal(state.combat.entitySnapshots[targetId].hp, 100);
    assert.equal(
      state.combat.entitySnapshots[targetId].lastAttackerId,
      undefined
    );
  });
});
