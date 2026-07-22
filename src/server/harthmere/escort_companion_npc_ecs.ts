import { npcEntity } from "@/server/spawn/spawn_npc";
import { prepareHarthmerePlayerLikeNpcForUniqueAppearance } from "@/server/harthmere/player_like_npc_cosmetics";
import type { ProposedChange } from "@/shared/ecs/change";
import { EntityDescription } from "@/shared/ecs/gen/components";
import type { HarthmereEscortCompanion } from "@/shared/harthmere/mmo_jobs_board_authority";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

export const HARTHMERE_ESCORT_COMPANION_NPC_ECS_VERSION =
  "harthmere-escort-companion-npc-ecs" as const;

function activeEscortCompanion(companion: HarthmereEscortCompanion) {
  return companion.status === "following" || companion.status === "arrived";
}

export function buildHarthmereEscortCompanionNpcProposedChanges(input: {
  companions: readonly HarthmereEscortCompanion[];
  existingIds?: ReadonlySet<BiomesId>;
  nowSeconds: number;
}): ProposedChange[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const changes: ProposedChange[] = [];
  for (const companion of input.companions) {
    if (!activeEscortCompanion(companion)) {
      if (existingIds.has(companion.entityId)) {
        changes.push({ kind: "delete", id: companion.entityId });
      }
      continue;
    }

    const kind = existingIds.has(companion.entityId) ? "update" : "create";
    const base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(
      npcEntity(
        {
          id: companion.entityId,
          typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
          position: [
            companion.position.x,
            companion.position.y,
            companion.position.z,
          ],
          orientation: [0, 0],
          velocity: [0, 0, 0],
          displayName: companion.displayName,
          defaultDialog:
            "Thanks for walking with me. I am trying to reach the road post.",
        },
        input.nowSeconds
      ),
      kind
    );

    // Player-like escorts should render through the same generated player/Grove
    // avatar fallback as business customers and townsfolk, not the Harthmere
    // voxel fallback or one shared default outfit.
    const entity = {
      ...base,
      entity_description: EntityDescription.create({
        text: `${HARTHMERE_ESCORT_COMPANION_NPC_ECS_VERSION} ${companion.displayName} escort companion for ${companion.jobId}`,
      }),
    };
    changes.push({
      kind,
      entity,
    });
  }
  return changes;
}
