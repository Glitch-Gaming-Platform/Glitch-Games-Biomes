import { newPlaceable } from "@/server/logic/utils/placeables";
import {
  HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS,
  HARTHMERE_GROVE_RACE_MINIGAME_ID,
  HARTHMERE_GROVE_RACE_MINIGAME_LABEL,
  HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS,
} from "@/shared/harthmere/grove_race_minigame_seed";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  CreatedBy,
  MinigameComponent,
  MinigameElement,
  Size,
} from "@/shared/ecs/gen/components";
import type { Entity } from "@/shared/ecs/gen/entities";
import { anItem } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";

function changeKindForSeed(id: BiomesId, existingIds: ReadonlySet<BiomesId>) {
  return existingIds.has(id) ? "update" : "create";
}

function proposedFromChange(change: Change): ProposedChange {
  if (change.kind === "delete") {
    return { kind: "delete", id: change.id };
  }
  if (change.kind === "create") {
    return { kind: "create", entity: change.entity };
  }
  return { kind: "update", entity: change.entity };
}

export function harthmereGroveRaceMinigameSeedIds() {
  return [...HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS];
}

export function buildHarthmereGroveRaceMinigameSeedChanges(input: {
  tick: number;
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const startIds = new Set(
    HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS.filter(
      (seed) => seed.kind === "start"
    ).map((seed) => seed.entityId)
  );
  const checkpointIds = new Set(
    HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS.filter(
      (seed) => seed.kind === "checkpoint"
    ).map((seed) => seed.entityId)
  );
  const endIds = new Set(
    HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS.filter(
      (seed) => seed.kind === "finish"
    ).map((seed) => seed.entityId)
  );
  const elementIds = new Set(
    HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS.map((seed) => seed.entityId)
  );

  const changes: Change[] = [
    {
      kind: changeKindForSeed(
        HARTHMERE_GROVE_RACE_MINIGAME_ID,
        existingIds
      ),
      tick: input.tick,
      entity: {
        id: HARTHMERE_GROVE_RACE_MINIGAME_ID,
        label: { text: HARTHMERE_GROVE_RACE_MINIGAME_LABEL },
        created_by: CreatedBy.create({
          id: HARTHMERE_GROVE_RACE_MINIGAME_ID,
          created_at: input.nowSeconds,
        }),
        minigame_component: MinigameComponent.create({
          metadata: {
            kind: "simple_race",
            checkpoint_ids: checkpointIds,
            start_ids: startIds,
            end_ids: endIds,
          },
          minigame_element_ids: elementIds,
          ready: true,
          game_modified_at: input.nowSeconds,
          stats_changed_at: input.nowSeconds,
        }),
      },
    },
  ];

  for (const seed of HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS) {
    const placeable = newPlaceable({
      id: seed.entityId,
      creatorId: HARTHMERE_GROVE_RACE_MINIGAME_ID,
      position: seed.position,
      orientation: seed.orientation,
      item: anItem(seed.itemId),
      timestamp: input.nowSeconds,
    });
    const entity: Entity = {
      ...placeable,
      size: placeable.size ?? Size.create({ v: [1, 0.2, 1] }),
      minigame_element: MinigameElement.create({
        minigame_id: HARTHMERE_GROVE_RACE_MINIGAME_ID,
      }),
    };
    changes.push({
      kind: changeKindForSeed(seed.entityId, existingIds),
      tick: input.tick,
      entity,
    });
  }

  return changes;
}

export function buildHarthmereGroveRaceMinigameSeedProposedChanges(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  return buildHarthmereGroveRaceMinigameSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChange);
}
