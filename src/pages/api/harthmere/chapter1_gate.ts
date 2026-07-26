// CHAPTER_1_FRACTURE_GATE_API
//
// Authenticated authority for entering and leaving Chapter 1 Elsewhen slots.
// The client may render a Mouth and request an interaction, but it never
// supplies position, quest progress, inventory, destination, or return point.
// All of those are read again from server-owned state before a warp is issued.

import { GameEvent } from "@/server/shared/api/game_event";
import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import { acquireHarthmereActorStateLock } from "@/server/harthmere/live_mode_actor_state_authority";
import { WarpHomeEvent } from "@/shared/ecs/gen/events";
import {
  ch1EnterGate,
  ch1ExitGate,
  ch1InitialPlayerState,
} from "@/shared/harthmere/ch1_chapter";
import { ch1Dungeon } from "@/shared/harthmere/ch1_dungeons";
import { ch1InitialDungeonSurvivalState } from "@/shared/harthmere/ch1_dungeon_mechanics";
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import {
  ch1Gate,
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
import { z } from "zod";

const zVec3 = z.tuple([z.number(), z.number(), z.number()]);
const zBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state") }),
  z.object({ action: z.literal("enter"), gateId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("exit") }),
]);
const zQuery = z.object({ e2e: z.enum(["1"]).optional() });
const zResponse = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  activeGateIds: z.array(z.string()),
  activeDungeonRunId: z.string().optional(),
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

function interactionState(input: {
  position: Vec3;
  activeGateIds: readonly string[];
  activeDungeonRunId?: string;
  activeGateId?: string;
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
    const stateKey = harthmereLiveModePlayerStateKey(actorId);

    if (body.action === "state") {
      const raw = await redis.primary.get(stateKey);
      const state = parseHarthmereLiveModeBackendState(
        raw,
        actorId,
        Date.now()
      );
      return interactionState({
        position: [...position],
        activeGateIds: gates,
        activeDungeonRunId: state.chapter1.activeDungeonRunId,
        activeGateId: state.chapter1.activeGateId,
        survival: state.chapter1.dungeonSurvival,
      });
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
      const current = interactionState({
        position: [...position],
        activeGateIds: gates,
        activeDungeonRunId: state.chapter1.activeDungeonRunId,
        activeGateId: state.chapter1.activeGateId,
        survival: state.chapter1.dungeonSurvival,
      });

      let warpPosition: Vec3;
      if (body.action === "enter") {
        if (
          current.interaction !== "enter" ||
          current.gateId !== body.gateId ||
          !current.withinRange ||
          !gates.includes(body.gateId)
        ) {
          return {
            ...current,
            ok: false,
            reason: "Move to the open Mouth before entering it.",
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
          : ch1ProvisioningCarriedFromInventory(state.inventory.items);
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
        state.chapter1 = {
          ...state.chapter1,
          activeDungeonRunId: entered.dungeonId,
          activeGateId: body.gateId,
          activeRunStartedMs: nowMs,
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
          return { ...current, ok: false, reason: exited.reason };
        }
        warpPosition = state.chapter1.returnPosition ?? [496, 71, -126];
        state.chapter1 = {
          ...state.chapter1,
          activeDungeonRunId: undefined,
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
      await redis.primary.set(
        stateKey,
        stringifyHarthmereLiveModePlayerPersistenceState(state)
      );
      try {
        await logicApi.publish(
          new GameEvent(
            auth.userId,
            new WarpHomeEvent({
              id: auth.userId,
              position: warpPosition,
              reason: "admin",
            })
          )
        );
      } catch (error) {
        // A failed event publish must not leave a player marked inside a slot
        // they never reached (or outside one they never left).
        await redis.primary.set(stateKey, previousSerialized);
        throw error;
      }

      return {
        ...current,
        ok: true,
        activeDungeonRunId: state.chapter1.activeDungeonRunId,
        warpPosition,
      };
    } finally {
      await lock.release();
    }
  }
);
