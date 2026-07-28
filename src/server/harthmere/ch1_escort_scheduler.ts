// HARTHMERE_ESCORT — Chapter 1 dungeon escorts.
//
// This scheduler used to write a player anchor into the companion's Anima
// SCHEDULE (`action: "chapter1_escort_follow"`). The ownership model was right —
// normal NPC physics carried the follow — but a schedule entry cannot express a
// combat policy, a follow distance, a formation slot, a leash, a destination, or
// what happens when the escort dies. It also collided with the quest-giver
// "stay home" branch and with any real authored schedule the NPC had.
//
// It now assigns the single unified `npc_state.escort` record and nothing else.
// Anima owns movement, terrain physics, combat targeting, health, and recovery
// (`@/shared/npc/behavior/escort_tick`).
//
// Combat policy: Iris and Marrow walk the desert dungeon under `defend_leader`,
// so they fight whatever is attacking the player but do not start fights. Dr.
// Sorrel walks the winter dungeon under `fight_muck`, so she additionally engages
// hostile Muck inside a small radius of the player — she is the escort the audit
// asked for, one that "in some cases can fight the Mucking".

import { connectToRedis } from "@/server/shared/redis/connection";
import type { WorldApi } from "@/server/shared/world/api";
import { NpcState } from "@/shared/ecs/gen/components";
import type { ProposedChange } from "@/shared/ecs/change";
import {
  CH1_DUNGEON_ESCORT_NPCS,
  ch1DungeonEscortNpcsForDungeon,
} from "@/shared/harthmere/ch1_dungeon_encounters";
import {
  ch1SlotClaimKey,
  type Ch1SlotClaim,
} from "@/server/harthmere/ch1_slot_claim";
import {
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import {
  buildEscortState,
  type EscortCombatPolicy,
  type EscortState,
} from "@/shared/npc/behavior/escort";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";

const INTERVAL_MS = 1_000;

/**
 * Legacy marker. Retained ONLY so a world seeded by the previous implementation
 * has its stale schedule entry removed on the first tick after this change.
 */
const CH1_LEGACY_ESCORT_SCHEDULE_ACTION = "chapter1_escort_follow";

export const CH1_ESCORT_ASSIGNMENT_PREFIX = "ch1-escort";

function escortActive(
  dungeonId: string,
  applied: readonly string[],
  npcId: number
) {
  if (dungeonId === "ch1_dungeon_desert") {
    return (
      applied.some((key) => key.endsWith("/d1_find_iris")) &&
      !applied.some((key) => key.endsWith("/d1_the_long_walk"))
    );
  }
  return (
    CH1_DUNGEON_ESCORT_NPCS.some(
      (npc) => npc.entityId === npcId && npc.displayName.includes("Sorrel")
    ) &&
    applied.some((key) => key.endsWith("/d2_the_oath")) &&
    !applied.some((key) => key.endsWith("/d2_the_breaking_year"))
  );
}

/**
 * Per-companion combat policy and formation slot.
 *
 * Slots are distinct so the desert pair does not stack into one voxel behind the
 * player; Anima's formation anchor fans them out.
 */
export function ch1EscortAssignmentFor(
  displayName: string,
  index: number
): { combatPolicy: EscortCombatPolicy; formationSlot: number } {
  if (/sorrel/i.test(displayName)) {
    return { combatPolicy: "fight_muck", formationSlot: 0 };
  }
  if (/marrow/i.test(displayName)) {
    return { combatPolicy: "defend_self", formationSlot: 2 };
  }
  return { combatPolicy: "defend_leader", formationSlot: index === 0 ? 1 : 2 };
}

/**
 * True when the stored escort record already matches the assignment we would
 * write, so an unchanged tick emits no ECS change at all. This matters: the
 * previous implementation rewrote entities every second, and a scheduler that
 * writes on every tick will eventually race Anima's own state updates.
 */
export function ch1EscortAssignmentIsCurrent(
  existing: EscortState | undefined,
  desired: EscortState
): boolean {
  return (
    existing !== undefined &&
    existing.leaderId === desired.leaderId &&
    existing.combatPolicy === desired.combatPolicy &&
    existing.formationSlot === desired.formationSlot &&
    existing.assignmentId === desired.assignmentId
  );
}

export async function runChapter1EscortSchedulerTick(input: {
  redis: { primary: { get(key: string): Promise<string | null> } };
  worldApi: WorldApi;
  nowMs: number;
}) {
  const changes: ProposedChange[] = [];
  for (const dungeonId of [
    "ch1_dungeon_desert",
    "ch1_dungeon_winter",
  ] as const) {
    const rawClaim = await input.redis.primary.get(ch1SlotClaimKey(dungeonId));
    const companions = ch1DungeonEscortNpcsForDungeon(dungeonId);
    if (!rawClaim) {
      for (const companion of companions) {
        const entity = await input.worldApi.get(companion.entityId);
        const decoded = deserializeNpcCustomState(entity?.npcState()?.data);
        const hadLegacySchedule = Boolean(
          decoded.schedule?.entries.some(
            (entry) => entry.action === CH1_LEGACY_ESCORT_SCHEDULE_ACTION
          )
        );
        if (!decoded.escort && !hadLegacySchedule) continue;
        if (hadLegacySchedule) decoded.schedule = undefined;
        decoded.escort = undefined;
        changes.push({
          kind: "update",
          entity: {
            id: companion.entityId,
            npc_state: NpcState.create({
              data: serializeNpcCustomState(decoded),
            }),
          },
        });
      }
      continue;
    }
    let claim: Ch1SlotClaim;
    try {
      claim = JSON.parse(rawClaim) as Ch1SlotClaim;
    } catch {
      continue;
    }
    let leaderId: BiomesId | undefined;
    for (const actorId of claim.actorIds ?? []) {
      const candidateId = Number(actorId);
      if (!Number.isSafeInteger(candidateId)) continue;
      const candidate = await input.worldApi.get(candidateId as BiomesId);
      const candidatePosition = candidate?.position()?.v;
      if (candidatePosition) {
        leaderId = candidateId as BiomesId;
        break;
      }
    }
    if (leaderId === undefined) continue;
    const stateRaw = await input.redis.primary.get(
      harthmereLiveModePlayerStateKey(String(leaderId))
    );
    const state = parseHarthmereLiveModeBackendState(
      stateRaw,
      String(leaderId),
      input.nowMs
    );
    for (const [index, companion] of companions.entries()) {
      const active = escortActive(
        dungeonId,
        state.chapter1.appliedObjectiveEffects,
        companion.entityId
      );
      const entity = await input.worldApi.get(companion.entityId);
      if (!entity) continue;
      const decoded = deserializeNpcCustomState(entity.npcState()?.data);
      const hadLegacySchedule = Boolean(
        decoded.schedule?.entries.some(
          (entry) => entry.action === CH1_LEGACY_ESCORT_SCHEDULE_ACTION
        )
      );
      if (!active) {
        if (!decoded.escort && !hadLegacySchedule) continue;
        decoded.escort = undefined;
        if (hadLegacySchedule) decoded.schedule = undefined;
      } else {
        const assignment = ch1EscortAssignmentFor(companion.displayName, index);
        const desired = buildEscortState({
          leaderId,
          combatPolicy: assignment.combatPolicy,
          formationSlot: assignment.formationSlot,
          assignmentId: `${CH1_ESCORT_ASSIGNMENT_PREFIX}:${dungeonId}:${companion.entityId}`,
        });
        if (
          ch1EscortAssignmentIsCurrent(decoded.escort, desired) &&
          !hadLegacySchedule
        ) {
          continue;
        }
        // Preserve Anima's own live fields (status, last-seen, path failure) so a
        // policy refresh never resets an escort mid-fight.
        decoded.escort = decoded.escort
          ? { ...decoded.escort, ...desired, status: decoded.escort.status }
          : desired;
        if (hadLegacySchedule) decoded.schedule = undefined;
      }
      changes.push({
        kind: "update",
        entity: {
          id: companion.entityId,
          npc_state: NpcState.create({
            data: serializeNpcCustomState(decoded),
          }),
        },
      });
    }
  }
  if (changes.length > 0) await input.worldApi.apply({ changes });
  return changes.length;
}

export function startChapter1EscortScheduler(input: {
  worldApi: WorldApi;
  enabled?: boolean;
}) {
  const enabled =
    input.enabled ??
    (process.env.HARTHMERE_CHAPTER1_ESCORT_SCHEDULER === "1" ||
      process.env.GLITCH_RUNTIME === "1");
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let redisPromise: ReturnType<typeof connectToRedis> | undefined;
  if (!enabled) return { enabled: false, stop: () => void (stopped = true) };
  const redis = () => (redisPromise ??= connectToRedis("firehose"));
  const run = async () => {
    if (stopped) return;
    try {
      await runChapter1EscortSchedulerTick({
        redis: await redis(),
        worldApi: input.worldApi,
        nowMs: Date.now(),
      });
    } catch (error) {
      log.error("Chapter 1 escort scheduler tick failed", { error });
    } finally {
      if (!stopped) timer = setTimeout(run, INTERVAL_MS);
    }
  };
  timer = setTimeout(run, 0);
  return {
    enabled: true,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      void redisPromise?.then((client) =>
        client.quit("Chapter 1 escort scheduler stopped")
      );
    },
  };
}
