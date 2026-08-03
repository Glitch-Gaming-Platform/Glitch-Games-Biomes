import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  EntityDescription,
  Label,
  Orientation,
  Position,
  QuestGiver,
} from "@/shared/ecs/gen/components";
import type { Entity } from "@/shared/ecs/gen/entities";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { HARTHMERE_DOCK_FISHING_BOARD } from "@/shared/harthmere/native_request_boards";
import { HARTHMERE_EXTENSION_FEET_Y } from "@/shared/harthmere/world_extension";
import type { BiomesId } from "@/shared/ids";

/**
 * The four snapshot request boards already exist as native ECS placeables. The
 * Harthmere quay duplicate is additive content, so it needs one real ECS
 * position + quest_giver anchor for native AcceptChallenge and
 * CompleteQuestStepAtEntity distance validation. Its visible geometry is owned
 * by the optimized request-board renderer, not by a placeable component.
 */
export const HARTHMERE_REQUEST_BOARD_ECS_SEED_VERSION =
  "harthmere-request-board-ecs-seed-v1" as const;

export function harthmereRequestBoardEcsSeedEntityIds(): BiomesId[] {
  return [HARTHMERE_DOCK_FISHING_BOARD.entityId];
}

function dockFishingBoardEntity(): Entity {
  const [x, z] = HARTHMERE_DOCK_FISHING_BOARD.authoredPosition;
  const world = shiftHarthmereAuthoredPositionToWorld([
    x,
    HARTHMERE_EXTENSION_FEET_Y,
    z,
  ]);
  return {
    id: HARTHMERE_DOCK_FISHING_BOARD.entityId,
    position: Position.create({ v: world }),
    orientation: Orientation.create({ v: [0, Math.PI] }),
    label: Label.create({ text: HARTHMERE_DOCK_FISHING_BOARD.label }),
    entity_description: EntityDescription.create({
      text: `${HARTHMERE_REQUEST_BOARD_ECS_SEED_VERSION} Harthmere quay native fishing request board`,
    }),
    quest_giver: QuestGiver.create({
      concurrent_quests: 1,
      concurrent_quest_dialog:
        "Fresh catches and standing fishing requests are posted here.",
    }),
  };
}

export function buildHarthmereRequestBoardEcsSeedChanges(input: {
  tick: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const entity = dockFishingBoardEntity();
  return [
    {
      kind: existingIds.has(entity.id) ? "update" : "create",
      tick: input.tick,
      entity,
    },
  ];
}

export function buildHarthmereRequestBoardEcsSeedProposedChanges(input: {
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereRequestBoardEcsSeedChanges({
    tick: 1,
    existingIds: input.existingIds,
  }).map((change): ProposedChange => {
    if (change.kind === "delete") {
      return { kind: "delete", id: change.id };
    }
    return change.kind === "create"
      ? { kind: "create", entity: change.entity }
      : { kind: "update", entity: change.entity };
  });
}
