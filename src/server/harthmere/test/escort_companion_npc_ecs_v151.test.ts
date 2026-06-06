/// <reference types="mocha" />

import assert from "assert";
import {
  HARTHMERE_ESCORT_COMPANION_NPC_ECS_VERSION_V151,
  buildHarthmereEscortCompanionNpcProposedChangesV151,
} from "../escort_companion_npc_ecs_v151";
import type { HarthmereEscortCompanionV151 } from "@/shared/harthmere/mmo_jobs_board_authority_v1";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

const companion: HarthmereEscortCompanionV151 = {
  companionId: "escort_companion:job:actor",
  entityId: 8_810_000_000_030_123 as any,
  jobId: "job",
  actorId: "actor",
  displayName: "Newcomer",
  status: "following",
  position: { x: 501, y: 70, z: -132 },
  destination: { x: 540, y: 70, z: -180 },
  destinationTargetId: "old_grove_road_post",
  destinationMarkerId: "old_grove_road_post",
  createdAtMs: 1_800_000_000_000,
  updatedAtMs: 1_800_000_000_000,
};

describe("Harthmere escort companion NPC ECS materialization", () => {
  it("creates a normal player-like human NPC entity for active escorts", () => {
    const [change] = buildHarthmereEscortCompanionNpcProposedChangesV151({
      companions: [companion],
      nowSeconds: 1_800_000_000,
    });
    assert.equal(change.kind, "create");
    if (change.kind !== "create") assert.fail("expected create change");
    assert.equal(change.entity.id, companion.entityId);
    assert.equal(
      change.entity.npc_metadata?.type_id,
      LOCAL_DEV_HUMAN_NPC_TYPE_ID
    );
    assert.equal(change.entity.label?.text, "Newcomer");
    assert.deepEqual(change.entity.position?.v, [501, 70, -132]);
    assert.equal(
      change.entity.appearance_component,
      undefined,
      "escort should use renderer's generated player/Grove avatar fallback"
    );
    assert.equal(change.entity.wearing, undefined);
    assert.ok(
      change.entity.entity_description?.text.includes(
        HARTHMERE_ESCORT_COMPANION_NPC_ECS_VERSION_V151
      )
    );
  });

  it("deletes an existing escort NPC when the companion is no longer active", () => {
    const [change] = buildHarthmereEscortCompanionNpcProposedChangesV151({
      companions: [{ ...companion, status: "completed" }],
      existingIds: new Set([companion.entityId]),
      nowSeconds: 1_800_000_000,
    });
    assert.deepEqual(change, { kind: "delete", id: companion.entityId });
  });
});
