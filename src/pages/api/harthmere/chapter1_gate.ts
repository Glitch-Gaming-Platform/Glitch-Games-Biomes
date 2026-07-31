// CHAPTER_1_FRACTURE_GATE_API
//
// Authenticated authority for entering and leaving Chapter 1 Elsewhen slots.
// The client may render a Mouth and request an interaction, but it never
// supplies position, quest progress, inventory, destination, or return point.
// All of those are read again from server-owned state before a warp is issued.

import { GameEvent } from "@/server/shared/api/game_event";
import { randomUUID } from "node:crypto";
import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import { acquireHarthmereActorStateLock } from "@/server/harthmere/live_mode_actor_state_authority";
import {
  HarthmereChapter1WarpEvent,
  UpdatePlayerHealthEvent,
} from "@/shared/ecs/gen/events";
import { authorizeCh1Warp } from "@/server/harthmere/ch1_warp_token";
import { readCh1NativeInventoryCounts } from "@/server/harthmere/ch1_native_inventory";
import {
  claimCh1Slot,
  ch1SlotClaimKey,
  refreshCh1Slot,
  releaseCh1Slot,
  type Ch1SlotClaim,
} from "@/server/harthmere/ch1_slot_claim";
import {
  ch1EnterGate,
  ch1ExitGate,
  ch1InitialPlayerState,
} from "@/shared/harthmere/ch1_chapter";
import { ch1Dungeon } from "@/shared/harthmere/ch1_dungeons";
import {
  ch1DungeonFinalStepId,
  ch1DungeonQuestForDungeonId,
} from "@/shared/harthmere/ch1_quests";
import { ch1NativeQuestId } from "@/shared/harthmere/ch1_native_quests";
import { ch1ObjectiveTarget } from "@/shared/harthmere/ch1_objective_targets";
import { isTriggerFired } from "@/server/logic/events/handlers/quest_step_validation";
import { activeChapter1ObjectiveForTest } from "@/pages/api/harthmere/chapter1_progress";
import { ch1InitialDungeonSurvivalState } from "@/shared/harthmere/ch1_dungeon_mechanics";
import {
  CH1_ELSEWHEN_EVICTION_ANCHOR,
  ch1AdmitToElsewhen,
  ch1ElsewhenSlot,
  isInsideCh1ElsewhenBand,
} from "@/shared/harthmere/ch1_elsewhen_region";
import {
  ch1Gate,
  ch1GroveSideElapsedSummary,
  ch1ProvisioningFor,
} from "@/shared/harthmere/ch1_fracture_gates";
import {
  CH1_EXIT_INTERACTION_RADIUS,
  CH1_GATE_INTERACTION_RADIUS,
  ch1ActiveDungeonGateIdsFromNativeChallenges,
  ch1LiveRetrievalIds,
  ch1ProvisioningCarriedFromInventory,
} from "@/shared/harthmere/ch1_live_gate";
import {
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
  stringifyHarthmereLiveModePlayerPersistenceState,
} from "@/shared/harthmere/live_mode_backend";
import { readCh1NativeRunAdmission } from "@/shared/harthmere/ch1_native_run";
import { CH1_FLAGS } from "@/shared/harthmere/ch1_ids";
import { z } from "zod";
import { log } from "@/shared/logging";
import type { WorldApi } from "@/server/shared/world/api";
import { zBiomesId, type BiomesId } from "@/shared/ids";

const zVec3 = z.tuple([z.number(), z.number(), z.number()]);
const zBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state") }),
  z.object({ action: z.literal("enter"), gateId: z.string().min(1).max(80) }),
  // `abandon` forfeits the run instead of requiring the retrievals. See the
  // CHAPTER_1_ABANDON_RUN note at the exit branch.
  z.object({ action: z.literal("exit"), abandon: z.boolean().optional() }),
  z.object({ action: z.literal("revive"), targetId: zBiomesId }),
  // Explicit, single-flight eviction. `state` only REPORTS an illegal
  // position; publishing a warp from a poll would fire one per poll tick.
  z.object({ action: z.literal("admission") }),
]);
const zQuery = z.object({ e2e: z.enum(["1"]).optional() });
const zResponse = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  activeGateIds: z.array(z.string()),
  activeDungeonRunId: z.string().optional(),
  activeDungeonInstanceId: z.string().optional(),
  interaction: z.enum(["none", "enter", "exit"]),
  gateId: z.string().optional(),
  gateName: z.string().optional(),
  dungeonName: z.string().optional(),
  targetPosition: zVec3.optional(),
  distance: z.number().optional(),
  withinRange: z.boolean().optional(),
  actionLabel: z.string().optional(),
  warpPosition: zVec3.optional(),
  survival: z
    .object({
      resourceKey: z.enum(["water", "fuel"]),
      resourceInitial: z.number(),
      resourceRemaining: z.number(),
      lightInitial: z.number(),
      lightRemaining: z.number(),
      lastOutcome: z.string().optional(),
    })
    .optional(),
  /** Delivered on exit only. The dread beat, never a planning input. */
  elapsedSummary: z.string().optional(),
  /** True when the player was standing somewhere they are not admitted. */
  evicted: z.boolean().optional(),
  /** The exit was refused but forfeiting the run is available. */
  canAbandon: z.boolean().optional(),
  /** The run was forfeited; no completion flags were granted. */
  abandoned: z.boolean().optional(),
  party: z
    .array(
      z.object({
        id: zBiomesId,
        name: z.string(),
        hp: z.number(),
        maxHp: z.number(),
        distance: z.number(),
        downed: z.boolean(),
        reviveAvailable: z.boolean(),
      })
    )
    .optional(),
});

type GateResponse = z.infer<typeof zResponse>;
type Vec3 = [number, number, number];

const globalForChapter1Gate = globalThis as typeof globalThis & {
  __chapter1GateRedis?: ReturnType<typeof connectToRedis>;
};

function chapter1GateRedis() {
  return (globalForChapter1Gate.__chapter1GateRedis ??=
    connectToRedis("firehose"));
}

function distance3(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function parseSlotClaim(raw: string | null): Ch1SlotClaim | undefined {
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

async function chapter1PartyView(input: {
  worldApi: WorldApi;
  claim?: Ch1SlotClaim;
  actorId: BiomesId;
  actorPosition: readonly number[];
}) {
  if (!input.claim) return undefined;
  const ids = input.claim.actorIds
    .map(Number)
    .filter((id) => Number.isSafeInteger(id)) as BiomesId[];
  const entities = await input.worldApi.get(ids);
  return entities.flatMap((entity) => {
    const position = entity?.position()?.v;
    const health = entity?.health();
    if (!entity || !position || !health) return [];
    const distance = distance3(input.actorPosition, position);
    return [
      {
        id: entity.id,
        name: entity.label()?.text ?? `Party member ${entity.id}`,
        hp: Number(health.hp),
        maxHp: Number(health.maxHp),
        distance,
        downed: Number(health.hp) <= 0,
        reviveAvailable:
          Number(entity.id) !== input.actorId &&
          Number(health.hp) <= 0 &&
          distance <= 5,
      },
    ];
  });
}

/**
 * The browser dungeon test may bypass only the pack contents, never position,
 * gate identity, active-run state, destination, or exit anchor. Requiring both
 * the server's explicit native-ECS mode and a loopback Host keeps this branch
 * unreachable in a normal deployment even if a player appends ?e2e=1.
 */
function focusedE2EMode(
  requested: boolean,
  hostHeader: string | string[] | undefined
) {
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const hostname = host?.split(":")[0]?.toLowerCase();
  return (
    requested &&
    process.env.HARTHMERE_NATIVE_ECS_E2E === "1" &&
    (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1")
  );
}

function e2eProvisioning(gateId: string) {
  const check = ch1ProvisioningFor(gateId);
  return Object.fromEntries(
    (check?.requirements ?? []).map((requirement) => [
      requirement.key,
      requirement.quantity,
    ])
  );
}

function activeGateIds(
  challenges:
    | {
        in_progress: ReadonlySet<number>;
        complete: ReadonlySet<number>;
      }
    | undefined,
  e2e: boolean
) {
  if (e2e) return ["ch1_gate_desert", "ch1_gate_winter"];
  if (!challenges) return [];
  return ch1ActiveDungeonGateIdsFromNativeChallenges({
    inProgress: challenges.in_progress,
    complete: challenges.complete,
  });
}

function activeGateIdsForRuntime(
  base: readonly string[],
  runtime: { flags: readonly string[]; hallrChoice?: "let_run" | "hold_stall" }
) {
  const ids = new Set(base);
  if (runtime.hallrChoice === "let_run") ids.delete("ch1_gate_winter");
  if (runtime.flags.includes(CH1_FLAGS.complete)) ids.add("ch1_gate_prime");
  return [...ids];
}

/**
 * CHAPTER_1_GATE_STORY_PREEMPTION
 *
 * Five authored beats put a character AT a Mouth and then ask the player to
 * talk to them:
 *
 *   the_footprints      Rook at the Old Wood aperture
 *   say_the_sentence    Rook at the Old Wood aperture
 *   the_flinch          Jackie waiting at the return aperture
 *   call_the_collapse   Rook, who must watch the gate close
 *   rooks_rope          Rook at the Cold Gate with a coil of rope
 *
 * All five are correct staging — the scene only works at the aperture. But the
 * gate also offers its own "F — Enter <dungeon>" there, and the two prompts
 * then race. The F-priority table already ranks story above gate, yet the two
 * prompts poll on different intervals, so there is a window where the gate has
 * refreshed and the story objective has not. In that window the gate owns F and
 * renders its banner, which is exactly what live testing hit at
 * `say_the_sentence` — and four more instances were waiting in Acts 3, 4 and 5.
 *
 * Losing a race is the wrong model for this. While a story objective is staged
 * at a Mouth, the Mouth should not be offering entry at all. Deciding that HERE
 * rather than in the client means the HUD, the F dispatcher, the browser E2E and
 * the API all read one answer instead of three.
 *
 * Dungeon-interior objectives cannot trigger this: their targets resolve inside
 * the Elsewhen band, kilometres from any Grove-side gate.
 */
const CH1_GATE_STORY_PREEMPT_RADIUS = CH1_GATE_INTERACTION_RADIUS + 4;

export function storyPreemptedGateId(input: {
  player: {
    challenges(): { in_progress: ReadonlySet<BiomesId> } | undefined;
    triggerState():
      | {
          by_root: ReadonlyMap<BiomesId, ReadonlyMap<BiomesId, string | number>>;
        }
      | undefined;
  };
  activeGateIds: readonly string[];
}): string | undefined {
  const challenges = input.player.challenges();
  const triggerState = input.player.triggerState();
  if (!challenges || !triggerState) return undefined;
  const active = activeChapter1ObjectiveForTest({
    inProgress: challenges.in_progress,
    fired: (challengeId, stepId) =>
      isTriggerFired(triggerState.by_root.get(challengeId), stepId),
  });
  if (!active) return undefined;
  const target = ch1ObjectiveTarget(active.quest.id, active.stepIndex);
  if (!target || target.source === "dungeon") return undefined;
  for (const gateId of input.activeGateIds) {
    const gate = ch1Gate(gateId);
    if (!gate?.enterable) continue;
    if (
      distance3(target.position, gate.position) <=
      CH1_GATE_STORY_PREEMPT_RADIUS
    ) {
      return gateId;
    }
  }
  return undefined;
}

function interactionState(input: {
  position: Vec3;
  activeGateIds: readonly string[];
  activeDungeonRunId?: string;
  activeGateId?: string;
  /** A story objective is staged on this gate; it must not offer entry. */
  storyPreemptedGateId?: string;
  survival?: {
    resourceKey: "water" | "fuel";
    resourceInitial: number;
    resourceRemaining: number;
    lightInitial: number;
    lightRemaining: number;
    lastOutcome?: string;
  };
}): GateResponse {
  if (input.activeDungeonRunId) {
    const dungeon = ch1Dungeon(input.activeDungeonRunId);
    const gate = dungeon ? ch1Gate(dungeon.gateId) : undefined;
    const slot = ch1ElsewhenSlot(input.activeDungeonRunId);
    if (!dungeon || !gate || !slot) {
      return {
        ok: false,
        reason: "The active dungeon run no longer has a valid gate and slot.",
        activeGateIds: [...input.activeGateIds],
        activeDungeonRunId: input.activeDungeonRunId,
        interaction: "none",
      };
    }
    const distance = distance3(input.position, slot.departure);
    return {
      ok: true,
      activeGateIds: [...input.activeGateIds],
      activeDungeonRunId: input.activeDungeonRunId,
      interaction: "exit",
      gateId: gate.id,
      gateName: gate.name,
      dungeonName: dungeon.name,
      targetPosition: [...slot.departure],
      distance,
      withinRange: distance <= CH1_EXIT_INTERACTION_RADIUS,
      actionLabel: `Return through ${gate.harthmereName}`,
      survival: input.survival,
    };
  }

  const candidates = input.activeGateIds
    .filter((gateId) => gateId !== input.storyPreemptedGateId)
    .map((gateId) => ch1Gate(gateId))
    .filter((gate) => gate?.enterable && gate.dungeonId)
    .map((gate) => ({
      gate: gate!,
      distance: distance3(input.position, gate!.position),
    }))
    .sort((a, b) => a.distance - b.distance);
  const nearest = candidates[0];
  if (!nearest) {
    return {
      ok: true,
      activeGateIds: [...input.activeGateIds],
      interaction: "none",
    };
  }
  const dungeon = ch1Dungeon(nearest.gate.dungeonId!);
  return {
    ok: true,
    activeGateIds: [...input.activeGateIds],
    interaction: "enter",
    gateId: nearest.gate.id,
    gateName: nearest.gate.name,
    dungeonName: dungeon?.name,
    targetPosition: [...nearest.gate.position],
    distance: nearest.distance,
    withinRange: nearest.distance <= CH1_GATE_INTERACTION_RADIUS,
    actionLabel: `Enter ${dungeon?.name ?? nearest.gate.harthmereName}`,
  };
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "POST",
    query: zQuery,
    body: zBody,
    response: zResponse,
  },
  async ({
    context: { logicApi, worldApi },
    auth,
    query,
    body,
    unsafeRequest,
    unsafeResponse,
  }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    const player = await worldApi.get(auth.userId);
    const position = player?.position()?.v;
    if (!player || !position) {
      return {
        ok: false,
        reason: "The native player position is not synchronized yet.",
        activeGateIds: [],
        interaction: "none" as const,
      };
    }
    const e2e = focusedE2EMode(query.e2e === "1", unsafeRequest.headers.host);
    const gates = activeGateIds(player.challenges(), e2e);
    const redis = await chapter1GateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      `authenticated:chapter1-gate:${auth.userId}`
    );
    const nativeActorId = String(auth.userId);
    const partyId = player.playerCurrentTeam()?.team_id
      ? `team:${player.playerCurrentTeam()!.team_id}`
      : `solo:${nativeActorId}`;
    const stateKey = harthmereLiveModePlayerStateKey(actorId);

    if (body.action === "state") {
      const raw = await redis.primary.get(stateKey);
      const state = parseHarthmereLiveModeBackendState(
        raw,
        actorId,
        Date.now()
      );
      const worldGates = activeGateIdsForRuntime(gates, state.chapter1);
      const projected = interactionState({
        position: [...position],
        activeGateIds: worldGates,
        activeDungeonRunId: state.chapter1.activeDungeonRunId,
        activeGateId: state.chapter1.activeGateId,
        survival: state.chapter1.dungeonSurvival,
        storyPreemptedGateId: storyPreemptedGateId({
          player,
          activeGateIds: worldGates,
        }),
      });
      const slotClaim = state.chapter1.activeDungeonRunId
        ? parseSlotClaim(
            await redis.primary.get(
              ch1SlotClaimKey(state.chapter1.activeDungeonRunId)
            )
          )
        : undefined;
      const party = await chapter1PartyView({
        worldApi,
        claim: slotClaim,
        actorId: auth.userId,
        actorPosition: position,
      });
      const slotClaimAlive =
        !state.chapter1.activeDungeonRunId ||
        (!!state.chapter1.activeDungeonPartyId &&
          (await refreshCh1Slot(
            redis,
            state.chapter1.activeDungeonRunId,
            state.chapter1.activeDungeonPartyId,
            nativeActorId
          )));
      const admission = ch1AdmitToElsewhen({
        position: [...position],
        activeDungeonRunId: state.chapter1.activeDungeonRunId,
      });
      const nativeAdmission = readCh1NativeRunAdmission(player.triggerState());
      const nativeAdmissionMatches =
        !!nativeAdmission &&
        nativeAdmission.dungeonId === state.chapter1.activeDungeonRunId &&
        nativeAdmission.runId === state.chapter1.activeDungeonInstanceId &&
        nativeAdmission.partyId === state.chapter1.activeDungeonPartyId;
      if (
        isInsideCh1ElsewhenBand(position) &&
        (!admission.allowed || !nativeAdmissionMatches || !slotClaimAlive)
      ) {
        return {
          ...projected,
          party,
          ok: false,
          evicted: true,
          reason: admission.allowed
            ? "The native dungeon admission or party slot expired."
            : admission.reason,
        };
      }
      return { ...projected, party };
    }

    if (body.action === "revive") {
      const raw = await redis.primary.get(stateKey);
      const state = parseHarthmereLiveModeBackendState(
        raw,
        actorId,
        Date.now()
      );
      const dungeonId = state.chapter1.activeDungeonRunId;
      const runId = state.chapter1.activeDungeonInstanceId;
      const activePartyId = state.chapter1.activeDungeonPartyId;
      const worldGates = activeGateIdsForRuntime(gates, state.chapter1);
      const current = interactionState({
        position: [...position],
        activeGateIds: worldGates,
        activeDungeonRunId: dungeonId,
        activeGateId: state.chapter1.activeGateId,
        survival: state.chapter1.dungeonSurvival,
        storyPreemptedGateId: storyPreemptedGateId({
          player,
          activeGateIds: worldGates,
        }),
      });
      if (!dungeonId || !runId || !activePartyId) {
        return {
          ...current,
          ok: false,
          reason: "Revival is available only inside an active party run.",
        };
      }
      const claim = parseSlotClaim(
        await redis.primary.get(ch1SlotClaimKey(dungeonId))
      );
      if (
        !claim ||
        claim.partyId !== activePartyId ||
        claim.runId !== runId ||
        !claim.actorIds.includes(String(auth.userId)) ||
        !claim.actorIds.includes(String(body.targetId)) ||
        body.targetId === auth.userId
      ) {
        return {
          ...current,
          ok: false,
          reason: "That player is not a downed member of this dungeon party.",
        };
      }
      const target = await worldApi.get(body.targetId);
      const targetPosition = target?.position()?.v;
      const targetHealth = target?.health();
      const targetAdmission = readCh1NativeRunAdmission(target?.triggerState());
      const actorAdmission = readCh1NativeRunAdmission(player.triggerState());
      if (
        !target ||
        !targetPosition ||
        !targetHealth ||
        targetHealth.hp > 0 ||
        distance3(position, targetPosition) > 5 ||
        actorAdmission?.runId !== runId ||
        targetAdmission?.runId !== runId ||
        actorAdmission?.partyId !== activePartyId ||
        targetAdmission?.partyId !== activePartyId
      ) {
        return {
          ...current,
          ok: false,
          reason:
            "Move within 5m of a downed admitted teammate to revive them.",
          party: await chapter1PartyView({
            worldApi,
            claim,
            actorId: auth.userId,
            actorPosition: position,
          }),
        };
      }
      await logicApi.publish(
        new GameEvent(
          auth.userId,
          new UpdatePlayerHealthEvent({
            id: body.targetId,
            hp: Math.max(1, Math.ceil(targetHealth.maxHp * 0.25)),
            damageSource: { kind: "heal" },
          })
        )
      );
      return {
        ...current,
        ok: true,
        party: await chapter1PartyView({
          worldApi,
          claim,
          actorId: auth.userId,
          actorPosition: position,
        }),
      };
    }

    const lock = await acquireHarthmereActorStateLock(redis.primary, actorId, {
      waitMs: 10_000,
    });
    if (!lock.acquired) {
      return {
        ok: false,
        reason: "The player state is busy; try the gate again.",
        activeGateIds: gates,
        interaction: "none" as const,
      };
    }

    try {
      const nowMs = Date.now();
      const raw = await redis.primary.get(stateKey);
      const state = parseHarthmereLiveModeBackendState(raw, actorId, nowMs);
      const worldGates = activeGateIdsForRuntime(gates, state.chapter1);
      const current = interactionState({
        position: [...position],
        activeGateIds: worldGates,
        activeDungeonRunId: state.chapter1.activeDungeonRunId,
        activeGateId: state.chapter1.activeGateId,
        survival: state.chapter1.dungeonSurvival,
        storyPreemptedGateId: storyPreemptedGateId({
          player,
          activeGateIds: worldGates,
        }),
      });

      let warpPosition: Vec3;
      let elapsedSummary: string | undefined;
      let evicted = false;
      let warpAction: "enter" | "exit" | "evict";
      let warpDungeonId = "";
      let warpRunId = "";
      let warpPartyId = partyId;
      let resetEncounters = false;
      let claimToRollback:
        | { dungeonId: string; partyId: string; actorId: string }
        | undefined;
      let releaseAfterPublish:
        | { dungeonId: string; partyId: string; actorId: string }
        | undefined;

      const admission = ch1AdmitToElsewhen({
        position: [...position],
        activeDungeonRunId: state.chapter1.activeDungeonRunId,
      });
      const admissionReason = admission.allowed ? undefined : admission.reason;
      const nativeAdmission = readCh1NativeRunAdmission(player.triggerState());
      const nativeAdmissionMatches =
        !!nativeAdmission &&
        nativeAdmission.dungeonId === state.chapter1.activeDungeonRunId &&
        nativeAdmission.runId === state.chapter1.activeDungeonInstanceId &&
        nativeAdmission.partyId === state.chapter1.activeDungeonPartyId;
      const illegallyInside =
        isInsideCh1ElsewhenBand(position) &&
        (!admission.allowed || !nativeAdmissionMatches);

      if (body.action === "admission" || illegallyInside) {
        if (!illegallyInside) {
          return { ...current, ok: true };
        }
        // Warpstone, stale saved position, admin teleport, a party member who
        // never entered: all the same answer. There is no "close enough"
        // branch here on purpose.
        evicted = true;
        warpAction = "evict";
        warpPosition = state.chapter1.returnPosition
          ? [...state.chapter1.returnPosition]
          : [...(CH1_ELSEWHEN_EVICTION_ANCHOR as Vec3)];
        warpDungeonId = state.chapter1.activeDungeonRunId ?? "";
        warpRunId = state.chapter1.activeDungeonInstanceId ?? "";
        warpPartyId = state.chapter1.activeDungeonPartyId ?? partyId;
        if (warpDungeonId && state.chapter1.activeDungeonPartyId) {
          releaseAfterPublish = {
            dungeonId: warpDungeonId,
            partyId: state.chapter1.activeDungeonPartyId,
            actorId: nativeActorId,
          };
        }
        state.chapter1 = {
          ...state.chapter1,
          activeDungeonRunId: undefined,
          activeDungeonInstanceId: undefined,
          activeDungeonPartyId: undefined,
          activeGateId: undefined,
          activeRunStartedMs: undefined,
          returnPosition: undefined,
          dungeonSurvival: undefined,
        };
      } else if (body.action === "enter") {
        if (
          current.interaction !== "enter" ||
          current.gateId !== body.gateId ||
          !current.withinRange ||
          !worldGates.includes(body.gateId)
        ) {
          return {
            ...current,
            ok: false,
            reason: "Move to the open Mouth before entering it.",
          };
        }
        // CHAPTER_1_DUNGEON_ENTRY_GUARD
        //
        // Gate visibility and dungeon-quest activation were decoupled. A gate
        // opens as soon as `highestReachedAct` reaches its act, which happens
        // when the FIRST quest of that act goes in progress — five objectives
        // before the dungeon quest itself starts. A player who provisioned early
        // could walk in during that window and be trapped permanently: the exit
        // needs retrievals they cannot obtain, the dungeon objectives are not
        // servable because their challenge is not in progress, death warps them
        // back to the arrival, and eviction does not fire because their
        // admission is legitimately valid.
        //
        // The dungeon's own challenge being in progress is the precondition that
        // was missing, so require it here rather than inferring it from an act.
        const gateForEntry = ch1Gate(body.gateId);
        const dungeonQuest = gateForEntry?.dungeonId
          ? ch1DungeonQuestForDungeonId(gateForEntry.dungeonId)
          : undefined;
        const dungeonChallengeId = dungeonQuest
          ? ch1NativeQuestId(dungeonQuest.id)
          : undefined;
        if (
          dungeonChallengeId !== undefined &&
          !player.challenges()?.in_progress.has(dungeonChallengeId)
        ) {
          return {
            ...current,
            ok: false,
            reason: `${
              dungeonQuest?.title ?? "The expedition"
            } has not begun. Finish the preparations before going through.`,
          };
        }
        const gate = ch1Gate(body.gateId)!;
        const chapterState = ch1InitialPlayerState();
        chapterState.flags = [
          ...(gate.requiresFlag ? [gate.requiresFlag] : []),
          ...state.chapter1.completionFlags,
        ];
        const carried = e2e
          ? e2eProvisioning(body.gateId)
          : ch1ProvisioningCarriedFromInventory(
              readCh1NativeInventoryCounts(player)
            );
        const entered = ch1EnterGate({
          state: chapterState,
          gateId: body.gateId,
          carried,
        });
        if (!entered.ok) {
          const missing = entered.provisioning?.missing
            .map((item) => `${item.label} ${item.have}/${item.need}`)
            .join(", ");
          return {
            ...current,
            ok: false,
            reason: missing ? `Pack check failed: ${missing}` : entered.reason,
          };
        }
        const slotClaim = await claimCh1Slot(redis, {
          dungeonId: entered.dungeonId,
          partyId,
          runId: randomUUID(),
          actorId: nativeActorId,
          nowMs,
        });
        if (!slotClaim.ok || !slotClaim.claim) {
          return {
            ...current,
            ok: false,
            reason:
              "Another party is inside; the aperture will not open onto an " +
              "occupied past.",
          };
        }
        claimToRollback = {
          dungeonId: entered.dungeonId,
          partyId,
          actorId: nativeActorId,
        };
        warpAction = "enter";
        warpDungeonId = entered.dungeonId;
        warpRunId = slotClaim.claim.runId;
        warpPartyId = partyId;
        resetEncounters = slotClaim.created;
        state.chapter1 = {
          ...state.chapter1,
          activeDungeonRunId: entered.dungeonId,
          activeDungeonInstanceId: slotClaim.claim.runId,
          activeDungeonPartyId: partyId,
          activeGateId: body.gateId,
          activeRunStartedMs: slotClaim.claim.startedMs,
          returnPosition: [...position],
          dungeonSurvival: ch1InitialDungeonSurvivalState({
            dungeonId: entered.dungeonId as
              | "ch1_dungeon_desert"
              | "ch1_dungeon_winter",
            carried,
          }),
        };
        warpPosition = [...entered.arrival];
      } else {
        if (current.interaction !== "exit" || !current.withinRange) {
          return {
            ...current,
            ok: false,
            reason: "Reach the far anchor before leaving Elsewhen.",
          };
        }
        const dungeon = ch1Dungeon(state.chapter1.activeDungeonRunId!)!;
        const chapterState = ch1InitialPlayerState();
        chapterState.flags = [...state.chapter1.completionFlags];
        chapterState.activeDungeonRunId = state.chapter1.activeDungeonRunId;
        chapterState.activeRunStartedMs = state.chapter1.activeRunStartedMs;
        // CHAPTER_1_DUNGEON_RUN_COMPLETION
        //
        // The retrieval check is necessary but not sufficient. Winter's three
        // required retrievals all land at `d2_the_oath` (step 6 of 9), so the
        // retrieval rule alone permitted a legal exit before the boss, Hallr's
        // choice and the escort out — three objectives that can only be done
        // inside the band. Require the run's final authored step as well.
        const finalStepId = ch1DungeonFinalStepId(dungeon.id);
        const runFinished =
          finalStepId === undefined ||
          state.chapter1.appliedObjectiveEffects.some((key) =>
            key.endsWith(`/${finalStepId}`)
          );
        if (!runFinished && body.abandon !== true) {
          return {
            ...current,
            ok: false,
            reason:
              "You are not finished in here yet. Something still has to come " +
              "back with you.",
            canAbandon: true,
          };
        }
        const exited = ch1ExitGate({
          state: chapterState,
          carriedOut: e2e
            ? dungeon.retrievals
                .filter((retrieval) => retrieval.required)
                .map((retrieval) => retrieval.id)
            : ch1LiveRetrievalIds(state.chapter1, state.inventory.items),
          nowMs,
        });
        if (!exited.ok) {
          // CHAPTER_1_ABANDON_RUN
          //
          // "A dungeon is a retrieval, not a clear" is the right rule and it
          // stays the default. But it was also the ONLY way out, which made a
          // refused exit indistinguishable from a soft-lock: any state where the
          // required retrievals became unobtainable — a dead escort, an
          // inventory transaction that dropped a key item, entry before the
          // quest activated — stranded the player in an unreachable band with no
          // recourse but an admin teleport.
          //
          // Abandoning is deliberately expensive rather than impossible: the run
          // is forfeited, no completion flags are granted, and the dungeon's
          // encounters reset on the next entry. The player keeps their body.
          if (body.abandon !== true) {
            return {
              ...current,
              ok: false,
              reason: exited.reason,
              canAbandon: true,
            };
          }
          warpAction = "exit";
          warpDungeonId = dungeon.id;
          warpRunId = state.chapter1.activeDungeonInstanceId ?? "";
          warpPartyId = state.chapter1.activeDungeonPartyId ?? partyId;
          if (state.chapter1.activeDungeonPartyId) {
            releaseAfterPublish = {
              dungeonId: dungeon.id,
              partyId: state.chapter1.activeDungeonPartyId,
              actorId: nativeActorId,
            };
          }
          warpPosition = state.chapter1.returnPosition ?? [
            ...(CH1_ELSEWHEN_EVICTION_ANCHOR as Vec3),
          ];
          state.chapter1 = {
            ...state.chapter1,
            activeDungeonRunId: undefined,
            activeDungeonInstanceId: undefined,
            activeDungeonPartyId: undefined,
            activeGateId: undefined,
            activeRunStartedMs: undefined,
            returnPosition: undefined,
            dungeonSurvival: undefined,
            // No completionFlags. Abandoning is not completing.
          };
          state.updatedAtMs = nowMs;
          const abandonPrevious =
            raw ??
            stringifyHarthmereLiveModePlayerPersistenceState(
              parseHarthmereLiveModeBackendState(undefined, actorId, nowMs)
            );
          try {
            await redis.primary.set(
              stateKey,
              stringifyHarthmereLiveModePlayerPersistenceState(state)
            );
            const abandonOrientation = player.orientation()?.v ?? [0, 0];
            const abandonWarpInput = {
              id: auth.userId,
              action: warpAction,
              dungeon_id: warpDungeonId,
              run_id: warpRunId,
              party_id: warpPartyId,
              reset_encounters: false,
              position: warpPosition,
              orientation: [...abandonOrientation] as [number, number],
            } as const;
            await logicApi.publish(
              new GameEvent(
                auth.userId,
                new HarthmereChapter1WarpEvent({
                  ...abandonWarpInput,
                  authorization: authorizeCh1Warp(abandonWarpInput),
                })
              )
            );
          } catch (error) {
            await redis.primary.set(stateKey, abandonPrevious);
            throw error;
          }
          if (releaseAfterPublish) {
            try {
              await releaseCh1Slot(
                redis,
                releaseAfterPublish.dungeonId,
                releaseAfterPublish.partyId,
                releaseAfterPublish.actorId
              );
            } catch (error) {
              log.error("Failed to release abandoned Chapter 1 slot", {
                error,
                releaseAfterPublish,
              });
            }
          }
          return {
            ...current,
            ok: true,
            abandoned: true,
            reason:
              "You came back out with nothing. The Mouth is still open when " +
              "you are ready to try again.",
            activeDungeonRunId: undefined,
            activeDungeonInstanceId: undefined,
            warpPosition,
          };
        }
        // The dread beat, delivered here and only here.
        if (state.chapter1.activeGateId && state.chapter1.activeRunStartedMs) {
          elapsedSummary = ch1GroveSideElapsedSummary(
            state.chapter1.activeGateId,
            Math.max(0, nowMs - state.chapter1.activeRunStartedMs)
          );
        }
        warpAction = "exit";
        warpDungeonId = dungeon.id;
        warpRunId = state.chapter1.activeDungeonInstanceId ?? "";
        warpPartyId = state.chapter1.activeDungeonPartyId ?? partyId;
        if (state.chapter1.activeDungeonPartyId) {
          releaseAfterPublish = {
            dungeonId: dungeon.id,
            partyId: state.chapter1.activeDungeonPartyId,
            actorId: nativeActorId,
          };
        }
        // Was a hardcoded [496, 71, -126] — the fountain centre at MARKER height,
        // one block above the surface the scan measures there. Use the shared
        // eviction anchor, which is the one position this chapter guarantees is
        // outside the band and on the ground.
        warpPosition =
          state.chapter1.returnPosition ?? [
            ...(CH1_ELSEWHEN_EVICTION_ANCHOR as Vec3),
          ];
        state.chapter1 = {
          ...state.chapter1,
          activeDungeonRunId: undefined,
          activeDungeonInstanceId: undefined,
          activeDungeonPartyId: undefined,
          activeGateId: undefined,
          activeRunStartedMs: undefined,
          returnPosition: undefined,
          dungeonSurvival: undefined,
          completionFlags: [
            ...new Set([
              ...state.chapter1.completionFlags,
              ...exited.completionFlags,
            ]),
          ],
        };
      }

      state.updatedAtMs = nowMs;
      const previousSerialized =
        raw ??
        stringifyHarthmereLiveModePlayerPersistenceState(
          parseHarthmereLiveModeBackendState(undefined, actorId, nowMs)
        );
      try {
        await redis.primary.set(
          stateKey,
          stringifyHarthmereLiveModePlayerPersistenceState(state)
        );
        const orientation = player.orientation()?.v ?? [0, 0];
        const warpInput = {
          id: auth.userId,
          action: warpAction,
          dungeon_id: warpDungeonId,
          run_id: warpRunId,
          party_id: warpPartyId,
          reset_encounters: resetEncounters,
          position: warpPosition,
          orientation: [...orientation] as [number, number],
        } as const;
        await logicApi.publish(
          new GameEvent(
            auth.userId,
            new HarthmereChapter1WarpEvent({
              ...warpInput,
              authorization: authorizeCh1Warp(warpInput),
            })
          )
        );
      } catch (error) {
        // A failed event publish must not leave a player marked inside a slot
        // they never reached (or outside one they never left).
        await redis.primary.set(stateKey, previousSerialized);
        if (claimToRollback) {
          await releaseCh1Slot(
            redis,
            claimToRollback.dungeonId,
            claimToRollback.partyId,
            claimToRollback.actorId
          );
        }
        throw error;
      }
      if (releaseAfterPublish) {
        try {
          await releaseCh1Slot(
            redis,
            releaseAfterPublish.dungeonId,
            releaseAfterPublish.partyId,
            releaseAfterPublish.actorId
          );
        } catch (error) {
          // The native exit already committed. Never restore an in-dungeon
          // Redis state after that point; the TTL remains the final fallback.
          log.error("Failed to release Chapter 1 slot membership", {
            error,
            releaseAfterPublish,
          });
        }
      }

      return {
        ...current,
        ok: !evicted,
        ...(evicted ? { evicted: true, reason: admissionReason } : {}),
        ...(elapsedSummary ? { elapsedSummary } : {}),
        activeDungeonRunId: state.chapter1.activeDungeonRunId,
        activeDungeonInstanceId: state.chapter1.activeDungeonInstanceId,
        warpPosition,
      };
    } finally {
      await lock.release();
    }
  }
);
