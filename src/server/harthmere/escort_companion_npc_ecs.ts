import { npcEntity } from "@/server/spawn/spawn_npc";
import { prepareHarthmerePlayerLikeNpcForUniqueAppearance } from "@/server/harthmere/player_like_npc_cosmetics";
import type { ProposedChange } from "@/shared/ecs/change";
import { EntityDescription, NpcState } from "@/shared/ecs/gen/components";
import type { HarthmereEscortCompanion } from "@/shared/harthmere/mmo_jobs_board_authority";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";
import {
  buildEscortState,
  type EscortCombatPolicy,
} from "@/shared/npc/behavior/escort";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";

export const HARTHMERE_ESCORT_COMPANION_NPC_ECS_VERSION =
  "harthmere-escort-companion-npc-ecs" as const;

export const JOBS_BOARD_ESCORT_ASSIGNMENT_PREFIX = "jobs-board-escort";

/**
 * Jobs-board escorts do not start fights, but they are player escorts and must
 * help when the player or the escort is attacked. `defend_leader` gives them
 * exactly that bounded response without granting proactive proximity aggro.
 * `fight_muck` remains reserved for authored story escorts.
 */
export const JOBS_BOARD_ESCORT_DEFAULT_COMBAT_POLICY: EscortCombatPolicy =
  "defend_leader";

function activeEscortCompanion(companion: HarthmereEscortCompanion) {
  return companion.status === "following" || companion.status === "arrived";
}

function escortNpcStateFor(
  companion: HarthmereEscortCompanion,
  existingState: Uint8Array | undefined,
  combatPolicy: EscortCombatPolicy
) {
  const decoded = deserializeNpcCustomState(existingState);
  const desired = buildEscortState({
    leaderId: companion.actorEntityId as BiomesId,
    combatPolicy,
    assignmentId: `${JOBS_BOARD_ESCORT_ASSIGNMENT_PREFIX}:${companion.jobId}`,
    destination: [
      companion.destination.x,
      companion.destination.y,
      companion.destination.z,
    ],
  });
  // Preserve Anima's own live fields so a policy refresh cannot reset an escort
  // that is mid-catch-up or mid-fight.
  decoded.escort = decoded.escort
    ? { ...decoded.escort, ...desired, status: decoded.escort.status }
    : desired;
  return NpcState.create({ data: serializeNpcCustomState(decoded) });
}

export function buildHarthmereEscortCompanionNpcProposedChanges(input: {
  companions: readonly HarthmereEscortCompanion[];
  existingIds?: ReadonlySet<BiomesId>;
  nowSeconds: number;
  /** Serialized `npc_state` of already-existing companions, keyed by entity id. */
  existingNpcState?: ReadonlyMap<BiomesId, Uint8Array | undefined>;
  combatPolicyFor?: (
    companion: HarthmereEscortCompanion
  ) => EscortCombatPolicy | undefined;
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

    const combatPolicy =
      input.combatPolicyFor?.(companion) ??
      JOBS_BOARD_ESCORT_DEFAULT_COMBAT_POLICY;
    const npcState = escortNpcStateFor(
      companion,
      input.existingNpcState?.get(companion.entityId),
      combatPolicy
    );

    if (existingIds.has(companion.entityId)) {
      // HARTHMERE_ESCORT: only ever patch what this scheduler owns.
      //
      // The previous implementation rebuilt the ENTIRE companion entity once per
      // second — position, health, appearance, dialog — from live-mode Redis. That
      // is why the escort had to be a hard-coded non-combatant: any projection
      // would have clobbered the health, velocity, target, and Anima state that
      // combat produces, and it also meant the companion's position was never
      // terrain-grounded, which floats or buries it on hills. Assigning intent and
      // letting Anima own execution removes both problems.
      const existingState = input.existingNpcState?.get(companion.entityId);
      if (
        existingState &&
        Buffer.compare(
          Buffer.from(existingState),
          Buffer.from(npcState.data)
        ) === 0
      ) {
        continue;
      }
      changes.push({
        kind: "update",
        entity: { id: companion.entityId, npc_state: npcState },
      });
      continue;
    }

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
      "create"
    );

    // Player-like escorts should render through the same generated player/Grove
    // avatar fallback as business customers and townsfolk, not the Harthmere
    // voxel fallback or one shared default outfit.
    changes.push({
      kind: "create",
      entity: {
        ...base,
        npc_state: npcState,
        entity_description: EntityDescription.create({
          text: `${HARTHMERE_ESCORT_COMPANION_NPC_ECS_VERSION} ${companion.displayName} escort companion for ${companion.jobId}`,
        }),
      },
    });
  }
  return changes;
}
