import assert from "assert";

import {
  HARTHMERE_REQUEST_BOARD_ECS_SEED_VERSION,
  buildHarthmereRequestBoardEcsSeedChanges,
  buildHarthmereRequestBoardEcsSeedProposedChanges,
  harthmereRequestBoardEcsSeedEntityIds,
} from "@/server/harthmere/request_board_ecs_seed";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { HARTHMERE_DOCK_FISHING_BOARD } from "@/shared/harthmere/native_request_boards";
import { HARTHMERE_EXTENSION_FEET_Y } from "@/shared/harthmere/world_extension";

describe("Harthmere request-board ECS seed", () => {
  it("materializes the additive quay board as a native quest interaction anchor", () => {
    const [change] = buildHarthmereRequestBoardEcsSeedChanges({ tick: 7 });
    assert.equal(change.kind, "create");
    if (change.kind !== "create") return;
    const entity = change.entity;
    const [x, z] = HARTHMERE_DOCK_FISHING_BOARD.authoredPosition;
    assert.deepEqual(
      entity.position?.v,
      shiftHarthmereAuthoredPositionToWorld([
        x,
        HARTHMERE_EXTENSION_FEET_Y,
        z,
      ])
    );
    assert.equal(entity.label?.text, "Fishing Board");
    assert.equal(entity.quest_giver?.concurrent_quests, 1);
    assert.match(
      entity.entity_description?.text ?? "",
      new RegExp(HARTHMERE_REQUEST_BOARD_ECS_SEED_VERSION)
    );
    assert.equal(entity.placeable_component, undefined);
    assert.equal(entity.npc_metadata, undefined);
  });

  it("updates the same stable id during a warm-world reconciliation", () => {
    assert.deepEqual(harthmereRequestBoardEcsSeedEntityIds(), [
      HARTHMERE_DOCK_FISHING_BOARD.entityId,
    ]);
    const [change] = buildHarthmereRequestBoardEcsSeedChanges({
      tick: 8,
      existingIds: new Set([HARTHMERE_DOCK_FISHING_BOARD.entityId]),
    });
    assert.equal(change.kind, "update");
    const [proposed] = buildHarthmereRequestBoardEcsSeedProposedChanges({
      existingIds: new Set([HARTHMERE_DOCK_FISHING_BOARD.entityId]),
    });
    assert.equal(proposed.kind, "update");
  });
});
