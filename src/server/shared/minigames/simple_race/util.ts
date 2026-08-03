import { addToast } from "@/client/components/toast/helpers";
import type { ClientContextSubset } from "@/client/game/context";
import type {
  ClientResourceDeps,
  ClientResources,
} from "@/client/game/resources/types";
import { RollbackError } from "@/server/logic/events/core";
import type { QueriedEntityWith } from "@/server/logic/events/query";
import { isSimpleRaceCheckpointItemId } from "@/server/shared/minigames/simple_race/items";
import { BikkieIds } from "@/shared/bikkie/ids";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import type {
  ReadonlyMinigameComponent,
  ReadonlyMinigameInstance,
} from "@/shared/ecs/gen/components";
import {
  FinishSimpleRaceMinigameEvent,
  ReachCheckpointSimpleRaceMinigameEvent,
  ReachStartSimpleRaceMinigameEvent,
} from "@/shared/ecs/gen/events";
import type { BiomesId } from "@/shared/ids";
import { dist } from "@/shared/math/linear";
import { fireAndForget } from "@/shared/util/async";
import { ok } from "assert";

export const SIMPLE_RACE_ELEMENT_INTERACTION_DISTANCE = 8;

export function assertValidSimpleRaceElement(
  minigame: QueriedEntityWith<"id" | "minigame_component">,
  player: QueriedEntityWith<"id" | "position">,
  element: QueriedEntityWith<
    "id" | "minigame_element" | "placeable_component" | "position"
  >,
  expected: "start" | "checkpoint" | "finish"
) {
  const component = minigame.minigameComponent();
  if (component.metadata.kind !== "simple_race") {
    throw new RollbackError("Not a simple race");
  }
  if (
    element.minigameElement().minigame_id !== minigame.id ||
    !component.minigame_element_ids.has(element.id)
  ) {
    throw new RollbackError("Element does not belong to this race");
  }
  const itemId = element.placeableComponent().item_id;
  if (!(
    (expected === "start" && itemId === BikkieIds.simpleRaceStart) ||
    (expected === "finish" && itemId === BikkieIds.simpleRaceFinish) ||
    (expected === "checkpoint" && isSimpleRaceCheckpointItemId(itemId))
  )) {
    throw new RollbackError(`Element is not a race ${expected}`);
  }
  if (
    dist(player.position().v, element.position().v) >
    SIMPLE_RACE_ELEMENT_INTERACTION_DISTANCE
  ) {
    throw new RollbackError("Player is too far from race element");
  }
}

export function simpleRaceNotReadyReason(
  component: ReadonlyMinigameComponent
): string | undefined {
  const md = component.metadata;
  if (md.kind !== "simple_race") {
    return "Invalid minigame";
  }

  if (md.start_ids.size === 0) {
    return "Missing start line";
  }

  if (md.end_ids.size === 0) {
    return "Missing finish line";
  }
}

export function handleSimpleRaceReachCheckpoint(
  minigameInstance: QueriedEntityWith<"minigame_instance" | "id">,
  minigameElement: QueriedEntityWith<"id">
) {
  const md = minigameInstance.mutableMinigameInstance();
  ok(md.state.kind === "simple_race");
  if (
    md.state.player_state === "waiting" ||
    md.state.reached_checkpoints.has(minigameElement.id)
  ) {
    return;
  }

  md.state.reached_checkpoints.set(minigameElement.id, {
    time: secondsSinceEpoch(),
  });
}

export async function finishRace(
  deps: ClientContextSubset<
    "events" | "gardenHose" | "userId" | "audioManager"
  >,
  minigameId: BiomesId,
  minigameInstanceId: BiomesId,
  minigameElementId: BiomesId
) {
  deps.audioManager.playSound("checkpoint_reached");
  await deps.events.publish(
    new FinishSimpleRaceMinigameEvent({
      id: deps.userId,
      minigame_id: minigameId,
      minigame_instance_id: minigameInstanceId,
      minigame_element_id: minigameElementId,
    })
  );

  deps.gardenHose.publish({
    kind: "minigame_simple_race_finish",
    minigameId,
    minigameInstanceId,
  });
}

export async function reachRaceStart(
  deps: ClientContextSubset<
    "events" | "gardenHose" | "userId" | "audioManager"
  >,
  minigameId: BiomesId,
  minigameInstanceId: BiomesId,
  minigameElementId: BiomesId
) {
  deps.audioManager.playSound("checkpoint_reached");
  await deps.events.publish(
    new ReachStartSimpleRaceMinigameEvent({
      id: deps.userId,
      minigame_id: minigameId,
      minigame_instance_id: minigameInstanceId,
      minigame_element_id: minigameElementId,
    })
  );
}

export function reachCheckpointEagerly(
  deps: ClientContextSubset<
    "resources" | "events" | "table" | "userId" | "audioManager"
  >,
  minigameId: BiomesId,
  minigameInstanceId: BiomesId,
  checkpointId: BiomesId
) {
  const currentMinigame = deps.table.get(minigameId)?.minigame_component;
  const currentInstance = deps.table.get(minigameInstanceId)?.minigame_instance;
  if (currentInstance && currentInstance.state.kind === "simple_race") {
    deps.table.layers.eagerApply({
      kind: "update",
      entity: {
        id: minigameInstanceId,
        minigame_instance: {
          ...currentInstance,
          state: {
            ...currentInstance.state,
            reached_checkpoints: new Map([
              ...currentInstance.state.reached_checkpoints.entries(),
              [checkpointId, { time: secondsSinceEpoch() }],
            ]),
          },
        },
      },
    });

    if (!currentInstance.state.reached_checkpoints.has(checkpointId)) {
      const totalCount =
        currentMinigame?.metadata.kind === "simple_race"
          ? (currentMinigame?.metadata.checkpoint_ids.size ?? 0)
          : 0;
      const amt = currentInstance.state.reached_checkpoints.size + 1;
      addToast(deps.resources, {
        id: checkpointId,
        kind: "basic",
        message: `Checkpoint Cleared (${amt}/${totalCount})`,
      });
      deps.audioManager.playSound("checkpoint_reached");
    }
  }

  deps.resources.invalidate("/scene/placeable/mesh", checkpointId);

  fireAndForget(
    deps.events.publish(
      new ReachCheckpointSimpleRaceMinigameEvent({
        id: deps.userId,
        minigame_id: minigameId,
        minigame_element_id: checkpointId,
        minigame_instance_id: minigameInstanceId,
      })
    )
  );
}

// Returns false if not in minigame
export function checkpointHasBeenReached(
  deps: ClientContextSubset<"userId">,
  checkpointId: BiomesId,
  resources: ClientResourceDeps | ClientResources
) {
  const activeMinigame = resources.get("/ecs/c/playing_minigame", deps.userId);
  if (!activeMinigame) {
    return false;
  }

  const activeInstance = resources.get(
    "/ecs/c/minigame_instance",
    activeMinigame.minigame_instance_id
  );

  const state = activeInstance?.state;
  return (
    state?.kind === "simple_race" && state.reached_checkpoints.has(checkpointId)
  );
}

export function reachedAllCheckpoints(
  minigame: ReadonlyMinigameComponent,
  minigameInstance: ReadonlyMinigameInstance
) {
  return (
    minigame.metadata.kind === "simple_race" &&
    minigameInstance.state.kind === "simple_race" &&
    [...minigame.metadata.checkpoint_ids].every((checkpointId) =>
      minigameInstance.state.kind === "simple_race"
        ? minigameInstance.state.reached_checkpoints.has(checkpointId)
        : false
    )
  );
}
