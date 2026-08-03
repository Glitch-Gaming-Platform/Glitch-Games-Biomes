import {
  makeEventHandler,
  newId,
  newIds,
  RollbackError,
} from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import {
  queryForRelevantEntities,
  queryForTerrainInBox,
} from "@/server/logic/events/space_clipboard";
import { killPlayer } from "@/server/logic/utils/players";
import { handleSpleefCreateNew } from "@/server/shared/minigames/spleef/util";
import { instanceOfStateKind } from "@/server/shared/minigames/type_utils";
import { addPlayerToMinigameInstance } from "@/server/shared/minigames/util";
import { boxToAabb } from "@/shared/game/group";
import { dist } from "@/shared/math/linear";

export const SPLEEF_TAG_MAX_DISTANCE = 5;

const createOrJoinSpleefEventHandler = makeEventHandler(
  "createOrJoinSpleefEvent",
  {
    prepareInvolves: (event) => ({
      terrain: queryForTerrainInBox(event.box),
      minigame: q
        .id(event.minigame_id)
        .with("minigame_component")
        .includeIced(),
    }),
    prepare: ({ terrain, minigame }, event, { voxeloo }) => ({
      terrainRelevantEntityIds: queryForRelevantEntities(
        voxeloo,
        terrain,
        boxToAabb(event.box)
      ),
      minigameCreatorId: minigame.created_by?.id,
      minigameElementIds: [...minigame.minigame_component.minigame_element_ids],
    }),
    involves: (
      event,
      { terrainRelevantEntityIds, minigameElementIds, minigameCreatorId }
    ) => ({
      player: q.id(event.id),
      minigame: q
        .id(event.minigame_id)
        .with("minigame_component")
        .includeIced(),
      newInstanceId: newId(),
      newStashEntityId: newId(),
      minigameInstance:
        event.minigame_instance_id &&
        q.id(event.minigame_instance_id).with("minigame_instance"),
      minigameElements: q.ids(minigameElementIds).with("minigame_element"),
      minigameCreator: q.optional(minigameCreatorId)?.includeIced(),
      stashId: newId(),
      terrain: queryForTerrainInBox(event.box),
      terrainRelevantEntities: q.ids(terrainRelevantEntityIds),
      clonedRelevantEntityIds: newIds(terrainRelevantEntityIds.length),
    }),
    apply: (
      {
        player,
        minigame,
        newInstanceId,
        newStashEntityId,
        minigameInstance,
        stashId,
        terrainRelevantEntities,
        clonedRelevantEntityIds,
        minigameElements,
        minigameCreator,
        terrain,
      },
      event,
      context
    ) => {
      if (minigameInstance) {
        addPlayerToMinigameInstance(
          {
            player,
            minigame,
            minigameInstance,
            minigameCreator,
            minigameElements,
            stashEntityId: newStashEntityId,
          },
          context
        );
      } else {
        handleSpleefCreateNew(
          {
            player,
            minigame,
            minigameElements,
            minigameCreator,
            stashEntityId: newStashEntityId,
            newInstanceId: newInstanceId,
          },
          {
            aabb: boxToAabb(event.box),
            clonedRelevantEntityIds,
            relevantEntities: terrainRelevantEntities,
            spaceEntityId: stashId,
            terrain,
          },

          context
        );
      }
    },
  }
);

const hitPlayerEventHandler = makeEventHandler("tagMinigameHitPlayerEvent", {
  involves: (event) => ({
    player: q.id(event.id).with("playing_minigame", "position"),
    minigame: q.id(event.minigame_id).with("minigame_component").includeIced(),
    minigameInstance:
      event.minigame_instance_id &&
      q.id(event.minigame_instance_id).with("minigame_instance"),
    hitPlayer: q.id(event.hit_player_id).with("playing_minigame", "position"),
  }),
  apply: (
    { player, minigame, minigameInstance, hitPlayer },
    event,
    context
  ) => {
    if (
      player.playingMinigame().minigame_instance_id !== minigameInstance.id ||
      player.playingMinigame().minigame_id !== minigame.id ||
      hitPlayer.playingMinigame().minigame_instance_id !== minigameInstance.id
    ) {
      throw new RollbackError("Players are not in this Spleef round");
    }
    const spleef = instanceOfStateKind(minigameInstance, "spleef");
    if (spleef.state.instance_state.kind !== "playing_round") {
      throw new RollbackError("Not playing a Spleef round");
    }
    if (spleef.state.instance_state.tag_round_state?.it_player !== player.id) {
      throw new RollbackError("Player is not it");
    }
    if (player.id === hitPlayer.id) {
      throw new RollbackError("Cannot tag yourself");
    }
    if (
      !spleef.state.instance_state.alive_round_players.has(player.id) ||
      !spleef.state.instance_state.alive_round_players.has(hitPlayer.id)
    ) {
      throw new RollbackError("Tag participants must be alive");
    }
    if (
      dist(player.position().v, hitPlayer.position().v) >
      SPLEEF_TAG_MAX_DISTANCE
    ) {
      throw new RollbackError("Tagged player is too far away");
    }

    killPlayer(
      hitPlayer,
      {
        kind: "attack",
        attacker: player.id,
        dir: undefined,
      },
      minigame,
      minigameInstance,
      context
    );
  },
});

export const spleefHandlers = [
  createOrJoinSpleefEventHandler,
  hitPlayerEventHandler,
];
