/// <reference types="mocha" />

import assert from "assert";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
} from "../live_mode_backend";
import type { HarthmereLiveModeAuthorityEnvelope } from "../live_mode_readiness";
import { snapshotGroveLandmarkById } from "../snapshot_grove_content";
import { ensureHarthmereNativeItemCatalogue } from "../harthmere_native_bikkie_items";
import { harthmereNativeBiomesIdForItemId } from "../harthmere_native_item_ids";

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
  before(() => ensureHarthmereNativeItemCatalogue());

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

  it("grants an active Grove pickup once through native ECS", () => {
    const objectId = "econ_billy_lunch_pail";
    const initial = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    initial.quests.active.econ_billys_lost_lunch_pail = {
      stepId: "econ_billys_lost_lunch_pail:2:collect",
      progress: 3,
      source: "snapshot_grove",
      title: "Billy's Lost Lunch Pail",
    };

    const pickedUp = reduceHarthmereLiveModeBackendState(
      initial,
      envelope({
        objectId,
        interactionKind: "gather",
        label: "Billy's Lunch Pail",
        position: positionFor(objectId),
      }),
      NOW_MS
    );

    assert.deepEqual(pickedUp.summary.warnings, []);
    assert.equal(pickedUp.state.inventory.items.billys_lunch_pail, 1);
    assert.ok(
      pickedUp.summary.nativeEcsMaterializationPlans?.some(
        (plan) =>
          plan.kind === "inventory_exchange" &&
          plan.rewardItemStacks.billys_lunch_pail === 1
      )
    );

    const repeated = reduceHarthmereLiveModeBackendState(
      pickedUp.state,
      envelope({
        objectId,
        interactionKind: "gather",
        label: "Billy's Lunch Pail",
        position: positionFor(objectId),
      }),
      NOW_MS + 1
    );
    assert.equal(repeated.state.inventory.items.billys_lunch_pail, 1);
    assert.equal(
      repeated.summary.nativeEcsMaterializationPlans?.filter(
        (plan) => plan.kind === "inventory_exchange"
      ).length ?? 0,
      0
    );
  });

  it("grants Gus's warm loaf tray with a checked-in native identity", () => {
    const objectId = "econ_gus_loaf_tray";
    const initial = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    initial.quests.active.econ_gus_fresh_loaves_to_fountain = {
      stepId: "econ_gus_fresh_loaves_to_fountain:1:collect",
      progress: 2,
      source: "snapshot_grove",
      title: "Fresh Loaves to the Fountain",
    };

    const pickedUp = reduceHarthmereLiveModeBackendState(
      initial,
      envelope({
        objectId,
        interactionKind: "gather",
        label: "Gus's Marked Loaf Basket",
        position: positionFor(objectId),
      }),
      NOW_MS
    );

    assert.deepEqual(pickedUp.summary.warnings, []);
    assert.equal(pickedUp.state.inventory.items.grove_warm_loaf_tray, 1);
    assert.ok(harthmereNativeBiomesIdForItemId("grove_warm_loaf_tray"));
    assert.ok(
      pickedUp.summary.nativeEcsMaterializationPlans?.some(
        (plan) =>
          plan.kind === "inventory_exchange" &&
          plan.rewardItemStacks.grove_warm_loaf_tray === 1
      )
    );
  });
});
