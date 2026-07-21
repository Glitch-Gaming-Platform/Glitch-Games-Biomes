/// <reference types="mocha" />

import assert from "assert";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
} from "../live_mode_backend";
import type { HarthmereLiveModeAuthorityEnvelope } from "../live_mode_readiness";
import { snapshotGroveLandmarkById } from "../snapshot_grove_content";

const NOW_MS = 1_700_000_000_000;
const ACTOR = "world_object_actor";
let sequence = 0;

function envelope(input: {
  objectId: string;
  interactionKind: string;
  label: string;
  position?: { x: number; y: number; z: number };
  equipped?: string[];
}): HarthmereLiveModeAuthorityEnvelope {
  sequence += 1;
  return {
    requestId: `world-object-${sequence}`,
    idempotencyKey: `world-object-${sequence}`,
    actorId: ACTOR,
    actionKind: "request_care_loop_action",
    subsystem: "care",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: NOW_MS,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    serverActorPosition: input.position,
    serverActorEquippedItemKeys: input.equipped,
    payload: {
      operation: "world_object_interaction",
      objectId: input.objectId,
      interactionKind: input.interactionKind,
      label: input.label,
    },
    clientClaims: {},
  };
}

function positionFor(objectId: string) {
  const landmark = snapshotGroveLandmarkById(objectId);
  assert.ok(landmark, `missing test landmark ${objectId}`);
  return {
    x: landmark.position[0],
    y: landmark.position[1],
    z: landmark.position[2],
  };
}

describe("authoritative authored world-object interactions", () => {
  it("records a faced fallback interaction in server-owned state", () => {
    const objectId = "grove_fountain_lesson_board";
    const result = reduceHarthmereLiveModeBackendState(
      defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS),
      envelope({
        objectId,
        interactionKind: "read",
        label: "Fountain Lesson Board",
        position: positionFor(objectId),
      }),
      NOW_MS
    );

    assert.deepEqual(result.summary.warnings, []);
    assert.equal(
      result.state.careLoops.worldInteractions[objectId]?.kind,
      "read"
    );
    assert.equal(result.state.careLoops.worldInteractions[objectId]?.count, 1);
  });

  it("rejects spoofed roles, labels, and out-of-range requests", () => {
    const objectId = "grove_fountain_lesson_board";
    const initial = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const wrongRole = reduceHarthmereLiveModeBackendState(
      initial,
      envelope({
        objectId,
        interactionKind: "repair",
        label: "Fountain Lesson Board",
        position: positionFor(objectId),
      }),
      NOW_MS
    );
    assert.ok(
      wrongRole.summary.warnings.includes(
        "world_object_rejected:interaction_kind_mismatch"
      )
    );

    const wrongLabel = reduceHarthmereLiveModeBackendState(
      initial,
      envelope({
        objectId,
        interactionKind: "read",
        label: "Billy's Toolbag",
        position: positionFor(objectId),
      }),
      NOW_MS
    );
    assert.ok(
      wrongLabel.summary.warnings.includes(
        "world_object_rejected:label_mismatch"
      )
    );

    const outOfRange = reduceHarthmereLiveModeBackendState(
      initial,
      envelope({
        objectId,
        interactionKind: "read",
        label: "Fountain Lesson Board",
        position: { x: 0, y: 0, z: 0 },
      }),
      NOW_MS
    );
    assert.ok(
      outOfRange.summary.warnings.includes("world_object_rejected:out_of_range")
    );
  });

  it("requires server-observed native repair equipment", () => {
    const objectId = "grove_practice_repair_post";
    const initial = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const missingTool = reduceHarthmereLiveModeBackendState(
      initial,
      envelope({
        objectId,
        interactionKind: "repair",
        label: "Fountain Repair Post",
        position: positionFor(objectId),
        equipped: [],
      }),
      NOW_MS
    );
    assert.ok(
      missingTool.summary.warnings.includes(
        "world_object_rejected:repair_tool_required"
      )
    );

    const repaired = reduceHarthmereLiveModeBackendState(
      initial,
      envelope({
        objectId,
        interactionKind: "repair",
        label: "Fountain Repair Post",
        position: positionFor(objectId),
        equipped: ["repair_mallet"],
      }),
      NOW_MS
    );
    assert.deepEqual(repaired.summary.warnings, []);
    assert.equal(
      repaired.state.careLoops.worldInteractions[objectId]?.kind,
      "repair"
    );
  });

  it("does not let typed stations fall through the generic receipt path", () => {
    const objectId = "grove_fountain_workbench";
    const result = reduceHarthmereLiveModeBackendState(
      defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS),
      envelope({
        objectId,
        interactionKind: "craft",
        label: "Fountain Workbench",
        position: positionFor(objectId),
      }),
      NOW_MS
    );
    assert.ok(
      result.summary.warnings.includes(
        "world_object_rejected:native_or_typed_capability_required"
      )
    );
  });
});
