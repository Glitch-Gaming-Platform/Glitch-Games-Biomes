/// <reference types="mocha" />

import assert from "assert";
import {
  HARTHMERE_ESCORT_COMPANION_NPC_ECS_VERSION,
  buildHarthmereEscortCompanionNpcProposedChanges,
} from "../escort_companion_npc_ecs";
import type { HarthmereEscortCompanion } from "@/shared/harthmere/mmo_jobs_board_authority";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

const companion: HarthmereEscortCompanion = {
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
    const [change] = buildHarthmereEscortCompanionNpcProposedChanges({
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
        HARTHMERE_ESCORT_COMPANION_NPC_ECS_VERSION
      )
    );
  });

  it("deletes an existing escort NPC when the companion is no longer active", () => {
    const [change] = buildHarthmereEscortCompanionNpcProposedChanges({
      companions: [{ ...companion, status: "completed" }],
      existingIds: new Set([companion.entityId]),
      nowSeconds: 1_800_000_000,
    });
    assert.deepEqual(change, { kind: "delete", id: companion.entityId });
  });

  it("explicitly clears shared cosmetics when updating an active escort", () => {
    const [change] = buildHarthmereEscortCompanionNpcProposedChanges({
      companions: [companion],
      existingIds: new Set([companion.entityId]),
      nowSeconds: 1_800_000_000,
    });
    assert.equal(change.kind, "update");
    if (change.kind !== "update") assert.fail("expected update change");
    assert.equal(change.entity.appearance_component, null);
    assert.equal(change.entity.wearing, null);
  });
});
