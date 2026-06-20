/// <reference types="mocha" />
/// <reference types="node" />

// current: server-side envelope context tests. The reducer in
// `liveEntityHelperQuestFromEnvelope` builds a
// LiveEntityHelperQuestEntityContext from an authority envelope sent by
// the client. Before current it dropped `hasTalkableDialog`, so a
// Frogberry-style entity (label + default dialog only) that the client UI
// accepted as a quest giver was rejected by the server with
// `live_entity_helper_rejected:ineligible_entity`. These tests pin the
// envelope shape to the new contract.

import assert from "assert";
import {
  HARTHMERE_LIVE_MODE_BACKEND_VERSION,
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "../live_mode_readiness";

const NOW_MS = 1_750_000_000_000;
const ACTOR = "player_v148_001";

let _seq = 0;
function nextId() {
  return `live-helper-req-${++_seq}`;
}

function envelope(
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown>,
  targetId = "frogberry-1"
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: nextId(),
    idempotencyKey: nextId(),
    actorId: ACTOR,
    targetId,
    actionKind,
    subsystem: "quest",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "harthmere_wilderness",
    payload,
    clientClaims: {},
  } as HarthmereLiveModeAuthorityEnvelope;
}

function freshState(): HarthmereLiveModeBackendState {
  return defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
}

function tryAcceptHelperQuest(payload: Record<string, unknown>) {
  return reduceHarthmereLiveModeBackendState(
    freshState(),
    envelope(
      "request_quest_state_update",
      { ...payload, operation: "live_entity_helper_accept" }
    ),
    NOW_MS
  );
}

function warnings(result: ReturnType<typeof tryAcceptHelperQuest>): string[] {
  return result.summary.warnings;
}

describe("live_entity_helper envelope context — current", () => {
  it("accepts a Frogberry-style entity when the envelope only carries label + default dialog", () => {
    const result = tryAcceptHelperQuest({
      entityId: "frogberry-1",
      entityX: 232,
      entityY: 54,
      entityZ: -506,
      entityLabel: "Frogberry",
      defaultDialog: "BEEP BOOP BEEP",
    });
    const rejections = warnings(result).filter(
      (warning) =>
        warning.includes("live_entity_helper_rejected:ineligible_entity") ||
        warning.includes(
          "live_entity_helper_rejected:server_entity_context_required"
        )
    );
    assert.deepEqual(
      rejections,
      [],
      `expected no eligibility rejection, got: ${warnings(result).join(", ")}`
    );
  });

  it("accepts when the client forwards hasTalkableDialog explicitly", () => {
    const result = tryAcceptHelperQuest({
      entityId: "loamhopper-1",
      entityX: 232,
      entityY: 54,
      entityZ: -506,
      entityLabel: "Loamhopper",
      hasTalkableDialog: true,
    });
    const rejections = warnings(result).filter((warning) =>
      warning.includes("live_entity_helper_rejected:ineligible_entity")
    );
    assert.deepEqual(
      rejections,
      [],
      `expected eligibility to pass, got: ${warnings(result).join(", ")}`
    );
  });

  it("accepts when entityDescription is forwarded as the only talkable signal", () => {
    const result = tryAcceptHelperQuest({
      entityId: "wanderer-1",
      entityX: 232,
      entityY: 54,
      entityZ: -506,
      entityLabel: "Wanderer",
      entityDescription:
        "A traveler scouting the Muck edge. Trusts you with a small task.",
    });
    const rejections = warnings(result).filter((warning) =>
      warning.includes("live_entity_helper_rejected:ineligible_entity")
    );
    assert.deepEqual(
      rejections,
      [],
      `expected eligibility to pass, got: ${warnings(result).join(", ")}`
    );
  });

  it("rejects a muck monster envelope even with label + default dialog", () => {
    const result = tryAcceptHelperQuest({
      entityId: "muckling-1",
      entityX: 246,
      entityY: 54,
      entityZ: -506,
      entityLabel: "West Breach Muckling",
      defaultDialog: "It has noticed you.",
    });
    assert.ok(
      warnings(result).some((warning) =>
        warning.includes("live_entity_helper_rejected:ineligible_entity")
      ),
      `muck monster envelope must be rejected, got: ${warnings(result).join(", ")}`
    );
  });

  it("rejects a Jobs Board envelope even when fully fleshed out", () => {
    const result = tryAcceptHelperQuest({
      entityId: "jobs-board-1",
      entityX: 232,
      entityY: 54,
      entityZ: -506,
      entityLabel: "Posting Board",
      hasTalkableDialog: true,
    });
    assert.ok(
      warnings(result).some((warning) =>
        warning.includes("live_entity_helper_rejected:ineligible_entity")
      ),
      `jobs board envelope must be rejected, got: ${warnings(result).join(", ")}`
    );
  });

  it("rejects when the envelope is missing position information", () => {
    const result = tryAcceptHelperQuest({
      entityId: "frogberry-1",
      entityLabel: "Frogberry",
      defaultDialog: "BEEP BOOP BEEP",
    });
    assert.ok(
      warnings(result).some((warning) =>
        warning.includes(
          "live_entity_helper_rejected:server_entity_context_required"
        )
      ),
      `missing position must still trigger a context rejection, got: ${warnings(result).join(", ")}`
    );
  });
});
