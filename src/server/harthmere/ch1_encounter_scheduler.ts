import { randomUUID } from "node:crypto";
import {
  CH1_ENCOUNTER_SCHEDULER_LEASE_MS,
  holdsChapter1EncounterSchedulerLease,
  refreshChapter1EncounterSchedulerLease,
} from "@/server/harthmere/ch1_encounter_scheduler_lease";
import {
  ch1SlotClaimKey,
  type Ch1SlotClaim,
} from "@/server/harthmere/ch1_slot_claim";
import { authorizeCh1Warp } from "@/server/harthmere/ch1_warp_token";
import { readCh1NativeInventoryCounts } from "@/server/harthmere/ch1_native_inventory";
import { GameEvent } from "@/server/shared/api/game_event";
import type { LogicApi } from "@/server/shared/api/logic";
import { connectToRedis } from "@/server/shared/redis/connection";
import type { WorldApi } from "@/server/shared/world/api";
import type { LazyEntity } from "@/server/shared/ecs/gen/lazy";
import type { ProposedChange } from "@/shared/ecs/change";
import { NpcState, Position, RigidBody } from "@/shared/ecs/gen/components";
import {
  HarthmereChapter1WarpEvent,
  UpdatePlayerHealthEvent,
} from "@/shared/ecs/gen/events";
import {
  CH1_DUNGEON_ENCOUNTER_NPCS,
  CH1_NINTH_WINTER_LOOP_MS,
  ch1GildedBullBrokenPartIds,
} from "@/shared/harthmere/ch1_dungeon_encounters";
import { log } from "@/shared/logging";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import {
  ch1NativeQuestId,
  ch1NativeQuestStepId,
} from "@/shared/harthmere/ch1_native_quests";
import { isTriggerFired } from "@/server/logic/events/handlers/quest_step_validation";
import { harthmereInventoryCarryWeight } from "@/shared/harthmere/mmo_carry_weight";
import { readCh1NativeRunAdmission } from "@/shared/harthmere/ch1_native_run";
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import { ch1DownedRecoveryDelayMs } from "@/shared/harthmere/ch1_party";
import type { BiomesId } from "@/shared/ids";

export const CH1_ENCOUNTER_SCHEDULER_INTERVAL_MS = 1_000;
export const CH1_NINTH_WINTER_ARENA_RADIUS = 72;

const NINTH_WINTER = CH1_DUNGEON_ENCOUNTER_NPCS.find(
  (npc) => npc.displayName === "The Ninth Winter"
)!;
const GILDED_BULL = CH1_DUNGEON_ENCOUNTER_NPCS.find(
  (npc) => npc.displayName === "The Gilded Bull"
)!;
const NINTH_WINTER_ENTITY_ID = NINTH_WINTER.entityId as BiomesId;
const GILDED_BULL_ENTITY_ID = GILDED_BULL.entityId as BiomesId;
const HAZARD_SAMPLE_MS = 7_000;
const HAZARD_DAMAGE_COOLDOWN_MS = 8_000;
const hazardSamples = new Map<
  BiomesId,
  {
    position: readonly [number, number, number];
    sampledAtMs: number;
    damagedAtMs: number;
  }
>();
const downedSamples = new Map<
  BiomesId,
  { downedAtMs: number; recoveryRequestedAtMs?: number }
>();

function parseClaim(raw: string | null): Ch1SlotClaim | undefined {
  if (!raw) return undefined;
  try {
    const claim = JSON.parse(raw) as Ch1SlotClaim;
    return claim.partyId && claim.runId && Array.isArray(claim.actorIds)
      ? claim
      : undefined;
  } catch {
    return undefined;
  }
}

function distance3(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function activeChapter1StepId(player: {
  challenges(): { in_progress: ReadonlySet<BiomesId> } | undefined;
  triggerState():
    | {
        by_root: ReadonlyMap<BiomesId, ReadonlyMap<BiomesId, string | number>>;
      }
    | undefined;
}) {
  const challenges = player.challenges();
  const triggerState = player.triggerState();
  if (!challenges || !triggerState) return undefined;
  for (const quest of CH1_QUESTS) {
    const challengeId = ch1NativeQuestId(quest.id)!;
    if (!challenges.in_progress.has(challengeId)) continue;
    for (const [index, step] of quest.steps.entries()) {
      const stepId = ch1NativeQuestStepId(quest.id, index)!;
      if (!isTriggerFired(triggerState.by_root.get(challengeId), stepId)) {
        return step.id;
      }
    }
  }
  return undefined;
}

async function applyChapter1PartyHazards(input: {
  dungeonId: "ch1_dungeon_desert" | "ch1_dungeon_winter";
  claim: Ch1SlotClaim;
  worldApi: WorldApi;
  logicApi: LogicApi;
  nowMs: number;
}) {
  let stormHits = 0;
  let iceRecoveries = 0;
  let downedRecoveries = 0;
  const members: Array<{
    id: BiomesId;
    player: LazyEntity;
  }> = [];
  for (const actorId of input.claim.actorIds) {
    const numericId = Number(actorId);
    if (!Number.isSafeInteger(numericId)) continue;
    const id = numericId as BiomesId;
    const player = await input.worldApi.get(id);
    if (player) members.push({ id, player });
  }
  const allPresentMembersDown =
    members.length > 0 &&
    members.every(({ player }) => Number(player.health()?.hp ?? 0) <= 0);
  const recoveryDelayMs = ch1DownedRecoveryDelayMs({
    memberCount: input.claim.actorIds.length,
    allPresentMembersDown,
  });
  const recoveryPosition = ch1ElsewhenSlot(input.dungeonId)?.arrival;

  for (const { id, player } of members) {
    const position = player?.position()?.v;
    const health = player?.health();
    if (!position || !health) continue;
    if (health.hp <= 0) {
      const sample = downedSamples.get(id) ?? { downedAtMs: input.nowMs };
      downedSamples.set(id, sample);
      const recentlyRequested =
        sample.recoveryRequestedAtMs !== undefined &&
        input.nowMs - sample.recoveryRequestedAtMs < HAZARD_DAMAGE_COOLDOWN_MS;
      if (
        recoveryPosition &&
        !recentlyRequested &&
        input.nowMs - sample.downedAtMs >= recoveryDelayMs
      ) {
        const admission = readCh1NativeRunAdmission(player.triggerState());
        if (
          admission?.dungeonId === input.dungeonId &&
          admission.runId === input.claim.runId &&
          admission.partyId === input.claim.partyId
        ) {
          await input.logicApi.publish(
            new GameEvent(
              id,
              new UpdatePlayerHealthEvent({
                id,
                hp: Math.max(1, Math.ceil(health.maxHp * 0.25)),
                damageSource: { kind: "heal" },
              })
            )
          );
          const warpInput = {
            id,
            action: "recover",
            dungeon_id: admission.dungeonId,
            run_id: admission.runId,
            party_id: admission.partyId,
            reset_encounters: false,
            position: [...recoveryPosition] as [number, number, number],
            orientation: [...(player.orientation()?.v ?? [0, 0])] as [
              number,
              number,
            ],
          } as const;
          await input.logicApi.publish(
            new GameEvent(
              id,
              new HarthmereChapter1WarpEvent({
                ...warpInput,
                authorization: authorizeCh1Warp(warpInput),
              })
            )
          );
          downedSamples.set(id, {
            ...sample,
            recoveryRequestedAtMs: input.nowMs,
          });
          downedRecoveries += 1;
        }
      }
      continue;
    }
    downedSamples.delete(id);
    const activeStepId = activeChapter1StepId(player as any);

    if (activeStepId === "d1_the_long_walk") {
      const previous = hazardSamples.get(id);
      if (!previous) {
        hazardSamples.set(id, {
          position: [...position] as [number, number, number],
          sampledAtMs: input.nowMs,
          damagedAtMs: 0,
        });
      } else if (distance3(position, previous.position) >= 2.25) {
        hazardSamples.set(id, {
          position: [...position] as [number, number, number],
          sampledAtMs: input.nowMs,
          damagedAtMs: previous.damagedAtMs,
        });
      } else if (
        input.nowMs - previous.sampledAtMs >= HAZARD_SAMPLE_MS &&
        input.nowMs - previous.damagedAtMs >= HAZARD_DAMAGE_COOLDOWN_MS
      ) {
        await input.logicApi.publish(
          new GameEvent(
            id,
            new UpdatePlayerHealthEvent({
              id,
              hpDelta: -5,
              damageSource: { kind: "fall", distance: 5 },
            })
          )
        );
        hazardSamples.set(id, {
          position: [...position] as [number, number, number],
          sampledAtMs: input.nowMs,
          damagedAtMs: input.nowMs,
        });
        stormHits += 1;
      }
    } else {
      hazardSamples.delete(id);
    }

    const carryLimit =
      activeStepId === "d2_whale_road"
        ? 55
        : activeStepId === "d2_the_breaking_year"
          ? 45
          : undefined;
    if (carryLimit === undefined) continue;
    const target =
      activeStepId === "d2_whale_road"
        ? ([3384.5, 66, -343.5] as const)
        : ([3582.5, 65, -343.5] as const);
    if (distance3(position, target) > 32) continue;
    const carryWeight = harthmereInventoryCarryWeight(
      readCh1NativeInventoryCounts(player)
    );
    const previous = hazardSamples.get(id);
    if (
      carryWeight <= carryLimit ||
      (previous &&
        input.nowMs - previous.damagedAtMs < HAZARD_DAMAGE_COOLDOWN_MS)
    ) {
      continue;
    }
    const admission = readCh1NativeRunAdmission(player.triggerState());
    if (
      !admission ||
      admission.runId !== input.claim.runId ||
      admission.partyId !== input.claim.partyId
    ) {
      continue;
    }
    await input.logicApi.publish(
      new GameEvent(
        id,
        new UpdatePlayerHealthEvent({
          id,
          hpDelta: -15,
          damageSource: { kind: "fall", distance: 12 },
        })
      )
    );
    const carryRecoveryPosition: [number, number, number] =
      activeStepId === "d2_whale_road"
        ? [3309.5, 66, -343.5]
        : [3510.5, 66, -343.5];
    const warpInput = {
      id,
      action: "recover",
      dungeon_id: admission.dungeonId,
      run_id: admission.runId,
      party_id: admission.partyId,
      reset_encounters: false,
      position: carryRecoveryPosition,
      orientation: [...(player.orientation()?.v ?? [0, 0])] as [number, number],
    } as const;
    await input.logicApi.publish(
      new GameEvent(
        id,
        new HarthmereChapter1WarpEvent({
          ...warpInput,
          authorization: authorizeCh1Warp(warpInput),
        })
      )
    );
    hazardSamples.set(id, {
      position: carryRecoveryPosition,
      sampledAtMs: input.nowMs,
      damagedAtMs: input.nowMs,
    });
    iceRecoveries += 1;
  }
  return { stormHits, iceRecoveries, downedRecoveries };
}

async function synchronizeGildedBullDamagePhase(worldApi: WorldApi) {
  const bull = await worldApi.get(GILDED_BULL_ENTITY_ID);
  const health = bull?.health();
  if (!bull || !health || health.maxHp <= 0 || health.hp <= 0) return false;
  const decoded = deserializeNpcCustomState(bull.npcState()?.data);
  const encounter = (decoded.chapter1Encounter ??= {});
  const brokenPartIds = ch1GildedBullBrokenPartIds({
    hp: health.hp,
    maxHp: health.maxHp,
    existing: encounter.brokenPartIds,
  });
  if (brokenPartIds.length === (encounter.brokenPartIds?.length ?? 0)) {
    return false;
  }
  encounter.brokenPartIds = brokenPartIds;
  await worldApi.apply({
    changes: [
      {
        kind: "update",
        entity: {
          id: GILDED_BULL_ENTITY_ID,
          npc_state: NpcState.create({
            data: serializeNpcCustomState(decoded),
          }),
        },
      },
    ],
  });
  return true;
}

/**
 * Owns the Ninth Winter's native ninety-second loop. Anima still owns every
 * movement tick and attack; this scheduler only resets the arena actor to its
 * authored starting transform while preserving damage, exactly as the fiction
 * requires.
 */
export async function runChapter1EncounterSchedulerTick(input: {
  redis: { primary: { get(key: string): Promise<string | null> } };
  worldApi: WorldApi;
  logicApi: LogicApi;
  nowMs: number;
}) {
  const desertClaim = parseClaim(
    await input.redis.primary.get(ch1SlotClaimKey("ch1_dungeon_desert"))
  );
  if (desertClaim) {
    await applyChapter1PartyHazards({
      ...input,
      dungeonId: "ch1_dungeon_desert",
      claim: desertClaim,
    });
    await synchronizeGildedBullDamagePhase(input.worldApi);
  }
  const claim = parseClaim(
    await input.redis.primary.get(ch1SlotClaimKey("ch1_dungeon_winter"))
  );
  if (!claim) return { changed: false, looped: false };
  await applyChapter1PartyHazards({
    ...input,
    dungeonId: "ch1_dungeon_winter",
    claim,
  });

  let partyInArena = false;
  for (const actorId of claim.actorIds) {
    const numericId = Number(actorId);
    if (!Number.isSafeInteger(numericId)) continue;
    const position = (
      await input.worldApi.get(numericId as BiomesId)
    )?.position()?.v;
    if (
      position &&
      distance3(position, NINTH_WINTER.position) <=
        CH1_NINTH_WINTER_ARENA_RADIUS
    ) {
      partyInArena = true;
      break;
    }
  }
  if (!partyInArena) return { changed: false, looped: false };

  const boss = await input.worldApi.get(NINTH_WINTER_ENTITY_ID);
  const health = boss?.health();
  if (!boss || !health || health.hp <= 0) {
    return { changed: false, looped: false };
  }
  const decoded = deserializeNpcCustomState(boss.npcState()?.data);
  const encounter = (decoded.chapter1Encounter ??= {});
  let looped = false;
  if (encounter.cycleStartedAtMs === undefined) {
    encounter.cycleStartedAtMs = input.nowMs;
    encounter.loopCount = 0;
  } else if (
    health.maxHp > 0 &&
    health.hp / health.maxHp > 0.3 &&
    input.nowMs - encounter.cycleStartedAtMs >= CH1_NINTH_WINTER_LOOP_MS
  ) {
    encounter.cycleStartedAtMs = input.nowMs;
    encounter.loopCount = (encounter.loopCount ?? 0) + 1;
    looped = true;
  }

  const entity: ProposedChange = {
    kind: "update",
    entity: {
      id: NINTH_WINTER_ENTITY_ID,
      npc_state: NpcState.create({ data: serializeNpcCustomState(decoded) }),
      ...(looped
        ? {
            position: Position.create({ v: [...NINTH_WINTER.position] }),
            rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          }
        : {}),
    },
  };
  await input.worldApi.apply({ changes: [entity] });
  return { changed: true, looped };
}

/**
 * CHAPTER_1_ENCOUNTER_SCHEDULER_SINGLE_WRITER
 *
 * This scheduler runs inside the WEB process and mutates shared encounter state:
 * the Ninth Winter's loop counter and cycle timestamp, the Gilded Bull's broken
 * parts, hazard damage and downed-player recovery warps. In `Multiple` replica
 * mode every web replica would tick it, so a ninety-second arena loop could be
 * advanced two or three times per second of wall clock and a hazard could bill a
 * player once per replica.
 *
 * The escort scheduler is naturally safe (`ch1EscortAssignmentIsCurrent`
 * short-circuits an unchanged tick into zero writes). This one is not, so it
 * takes an explicit lease and only the holder ticks.
 */
export function startChapter1EncounterScheduler(input: {
  worldApi: WorldApi;
  logicApi: LogicApi;
  enabled?: boolean;
}) {
  const enabled =
    input.enabled ??
    (process.env.HARTHMERE_CHAPTER1_ENCOUNTER_SCHEDULER === "1" ||
      process.env.GLITCH_RUNTIME === "1");
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let leaseHeartbeat: ReturnType<typeof setInterval> | undefined;
  let redisPromise: ReturnType<typeof connectToRedis> | undefined;
  if (!enabled) return { enabled: false, stop: () => void (stopped = true) };
  const redis = () => (redisPromise ??= connectToRedis("firehose"));
  const ownerId = `${process.env.HOSTNAME ?? "web"}:${process.pid}:${randomUUID()}`;
  const run = async () => {
    if (stopped) return;
    try {
      const client = await redis();
      if (await holdsChapter1EncounterSchedulerLease(client, ownerId)) {
        if (!leaseHeartbeat) {
          leaseHeartbeat = setInterval(
            () => {
              void refreshChapter1EncounterSchedulerLease(client, ownerId)
                .then((retained) => {
                  if (!retained && leaseHeartbeat) {
                    clearInterval(leaseHeartbeat);
                    leaseHeartbeat = undefined;
                  }
                })
                .catch((error) => {
                  log.error(
                    "Chapter 1 encounter scheduler lease refresh failed",
                    {
                      error,
                    }
                  );
                });
            },
            Math.floor(CH1_ENCOUNTER_SCHEDULER_LEASE_MS / 3)
          );
          leaseHeartbeat.unref?.();
        }
        await runChapter1EncounterSchedulerTick({
          redis: client,
          worldApi: input.worldApi,
          logicApi: input.logicApi,
          nowMs: Date.now(),
        });
      }
    } catch (error) {
      log.error("Chapter 1 encounter scheduler tick failed", { error });
    } finally {
      if (!stopped) {
        timer = setTimeout(run, CH1_ENCOUNTER_SCHEDULER_INTERVAL_MS);
      }
    }
  };
  timer = setTimeout(run, 0);
  return {
    enabled: true,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (leaseHeartbeat) clearInterval(leaseHeartbeat);
      void redisPromise?.then((client) =>
        client.quit("Chapter 1 encounter scheduler stopped")
      );
    },
  };
}
