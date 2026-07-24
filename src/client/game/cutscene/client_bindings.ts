// HARTHMERE_CUTSCENE_CLIENT_BINDINGS
//
// Adapts the live client world (ECS resources + table) to the pure
// CutsceneWorldIndex the binder consumes. Bikkie integration lives here:
// `nearestNpc.npcTypeId` matches npc_metadata.type_id (the NPC's biscuit id).

import type { ClientTable } from "@/client/game/game";
import type { ClientResources } from "@/client/game/resources/types";
import type {
  CutsceneEntityView,
  CutsceneWorldIndex,
} from "@/shared/cutscene/binding";
import type { CutsceneVec3 } from "@/shared/cutscene/schema";
import { NpcMetadataSelector } from "@/shared/ecs/gen/selectors";
import { getSizeForEntity } from "@/shared/game/entity_sizes";
import type { BiomesId } from "@/shared/ids";
import { dist } from "@/shared/math/linear";

function toView(entity: {
  id: BiomesId;
  label?: { text?: string };
  position?: { v?: readonly number[] };
  orientation?: { v?: readonly number[] };
  health?: { hp?: number };
  npc_metadata?: { type_id?: BiomesId };
}): CutsceneEntityView | undefined {
  if (!entity.position?.v) {
    return undefined;
  }
  let height: number | undefined;
  try {
    const size = getSizeForEntity(entity as never);
    height = size?.[1];
  } catch {
    height = undefined;
  }
  return {
    id: entity.id,
    label: entity.label?.text,
    position: [...entity.position.v] as CutsceneVec3,
    orientation: entity.orientation?.v
      ? ([entity.orientation.v[0], entity.orientation.v[1]] as [number, number])
      : undefined,
    npcTypeId: entity.npc_metadata?.type_id,
    height,
    alive:
      !entity.health ||
      typeof entity.health.hp !== "number" ||
      entity.health.hp > 0,
    isNpc: !!entity.npc_metadata,
  };
}

export function buildCutsceneWorldIndex(
  userId: BiomesId,
  resources: ClientResources,
  table: ClientTable
): CutsceneWorldIndex {
  const scenePlayer = resources.get("/scene/player", userId);
  const playerPosition = [...scenePlayer.position] as CutsceneVec3;
  return {
    playerId: userId,
    playerPosition,
    playerHeight: 1.8,
    entity: (id: number) => {
      const entity = resources.get("/ecs/entity", id as BiomesId);
      return entity ? toView(entity as never) : undefined;
    },
    npcsNear: (position: CutsceneVec3, radius: number) => {
      const views: CutsceneEntityView[] = [];
      for (const entity of table.scan(NpcMetadataSelector.query.all())) {
        const view = toView(entity as never);
        if (!view?.position) {
          continue;
        }
        if (dist(view.position, position) <= radius) {
          views.push(view);
        }
      }
      return views;
    },
  };
}
