// CHAPTER_1_STORY_API
//
// Authenticated projection and mutations for Chapter 1 systems that are not
// native ECS components. Fragment truth never enters this response: every
// ledger row is built by ch1ProjectFragmentForClient().

import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { acquireHarthmereActorStateLock } from "@/server/harthmere/live_mode_actor_state_authority";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import { readCh1NativeInventoryCounts } from "@/server/harthmere/ch1_native_inventory";
import { authorizeHarthmereInventoryTransaction } from "@/server/harthmere/native_inventory_transaction_token";
import { ch1ProjectFragmentForClient } from "@/server/harthmere/ch1_fragment_authority";
import { GameEvent } from "@/server/shared/api/game_event";
import { connectToRedis } from "@/server/shared/redis/connection";
import type { WorldApi } from "@/server/shared/world/api";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { ch1Fragment } from "@/shared/harthmere/ch1_fragment_ledger";
import {
  CH1_AMBIENT_TRIGGER_KINDS,
  ch1EvaluateAmbientTrigger,
  type Ch1AmbientTriggerKind,
} from "@/shared/harthmere/ch1_fragment_triggers";
import { ch1ItemDisplayName } from "@/shared/harthmere/ch1_items";
import { ch1LatentSkill } from "@/shared/harthmere/ch1_latent_skills";
import {
  ch1DocumentPages,
  ch1UnlockedDocumentsFor,
} from "@/shared/harthmere/ch1_documents";
import {
  ch1StageDirections,
  ch1WorldPhaseEffects,
} from "@/shared/harthmere/ch1_staging";
import type { Ch1LiveGateRuntimeState } from "@/shared/harthmere/ch1_live_gate";
import {
  ch1LinkLiveFragments,
  ch1PlayLiveLog,
  ch1RechargeLiveAugur9,
  ch1TriggerLiveFragment,
  ch1UseLiveLatentSkill,
  type Ch1LiveStoryActionResult,
} from "@/shared/harthmere/ch1_live_story";
import type { BiomesId } from "@/shared/ids";
import { HarthmereInventoryTransactionEvent } from "@/shared/ecs/gen/events";
import { countOf, createBag } from "@/shared/game/items";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import { randomUUID } from "node:crypto";
import {
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
  stringifyHarthmereLiveModePlayerPersistenceState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";

const zBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state") }),
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("play_log"), fragmentId: z.string().min(1) }),
  z.object({
    action: z.literal("recharge"),
    itemId: z.string().min(1),
    requestId: z.string().min(8).max(120).optional(),
  }),
  z.object({
    action: z.literal("use_skill"),
    skillId: z.enum([
      "ls_containment_triage",
      "ls_anchor_read",
      "ls_field_calibration",
      "ls_gate_timing",
    ]),
  }),
  z.object({
    action: z.literal("link"),
    fragmentIds: z.array(z.string().min(1)).min(2).max(8),
  }),
  z.object({
    action: z.literal("trigger"),
    fragmentId: z.string().min(1).max(120),
    kind: z.enum(CH1_AMBIENT_TRIGGER_KINDS),
  }),
]);

const zFragment = z.object({
  fragmentId: z.string(),
  title: z.string(),
  type: z.enum(["echo", "overlay", "playback", "reconstruction", "derived"]),
  body: z.string(),
  confidence: z.number().optional(),
  revised: z.boolean(),
});
const zResponse = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  unlocked: z.boolean(),
  cardName: z.string(),
  ledger: z.object({
    linkingUnlocked: z.boolean(),
    consolidated: z.boolean(),
    entries: z.array(zFragment),
  }),
  latentSkills: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      tooltip: z.string(),
      description: z.string(),
      readyAtMs: z.number(),
    })
  ),
  testimonies: z.object({ count: z.number(), total: z.number() }),
  augur9: z.object({
    charge: z.number(),
    shutDown: z.boolean(),
    availableLogs: z.array(
      z.object({
        fragmentId: z.string(),
        title: z.string(),
        chargeCost: z.number(),
        played: z.boolean(),
      })
    ),
  }),
  ending: z.enum(["confess", "contain", "bargain"]).optional(),
  hallrChoice: z.enum(["let_run", "hold_stall"]).optional(),
  lastSkillUse: z
    .object({ skillId: z.string(), usedAtMs: z.number(), result: z.string() })
    .optional(),
  documents: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      attribution: z.string(),
      itemId: z.string().optional(),
      pages: z.array(
        z.object({ heading: z.string().optional(), body: z.string() })
      ),
    })
  ),
  staging: z.array(
    z.object({
      key: z.string(),
      entityId: z.number(),
      displayName: z.string(),
      present: z.boolean(),
      useSeededBody: z.boolean(),
      position: z.tuple([z.number(), z.number(), z.number()]).optional(),
      activity: z.string(),
    })
  ),
  worldPhase: z.array(z.object({ id: z.string(), summary: z.string() })),
});

const globalForChapter1Story = globalThis as typeof globalThis & {
  __chapter1StoryRedis?: ReturnType<typeof connectToRedis>;
};

function storyRedis() {
  return (globalForChapter1Story.__chapter1StoryRedis ??=
    connectToRedis("firehose"));
}

function project(state: ReturnType<typeof parseHarthmereLiveModeBackendState>) {
  const runtime = state.chapter1;
  const stagingInput = {
    flags: runtime.flags,
    ending: runtime.ending,
    hallrChoice: runtime.hallrChoice,
  };
  const staging = ch1StageDirections(stagingInput);
  const entries = [...runtime.ledger.entries]
    .sort((a, b) => b.recoveredAtMs - a.recoveredAtMs)
    .flatMap((entry) => {
      const view = ch1ProjectFragmentForClient({
        fragmentId: entry.fragmentId,
        revised: entry.revised,
        linkingUnlocked: runtime.ledger.linkingUnlocked,
      });
      return view ? [view] : [];
    });
  const latentSkills = runtime.latentSkills.unlocked.flatMap((id) => {
    const skill = ch1LatentSkill(id);
    return skill
      ? [
          {
            id: skill.id,
            name: skill.name,
            tooltip: skill.tooltip,
            description: skill.description,
            readyAtMs: (runtime.latentSkillLastUsedAtMs[id] ?? 0) + 5_000,
          },
        ]
      : [];
  });
  const availableLogs = runtime.availablePlaybackIds.flatMap((fragmentId) => {
    const fragment = ch1Fragment(fragmentId);
    if (!fragment || fragment.type !== "playback") return [];
    return [
      {
        fragmentId,
        title: fragment.title,
        chargeCost: fragment.chargeCost ?? 6,
        played: runtime.augur9.playedLogIds.includes(fragmentId),
      },
    ];
  });
  return {
    ok: true,
    unlocked: runtime.flags.includes("ch1_started"),
    cardName:
      ch1ItemDisplayName("item_grey_card", runtime.flags) ?? "Grey Card",
    ledger: {
      linkingUnlocked: runtime.ledger.linkingUnlocked,
      consolidated: runtime.ledger.consolidated,
      entries,
    },
    latentSkills,
    testimonies: { count: runtime.testimonies.length, total: 12 },
    augur9: {
      charge: runtime.augur9.charge,
      shutDown: runtime.augur9.shutDown,
      availableLogs,
    },
    ending: runtime.ending,
    hallrChoice: runtime.hallrChoice,
    lastSkillUse: runtime.lastLatentSkillUse,
    // Documents are rereadable forever once unlocked. The pages are resolved
    // through ch1DocumentPages() so the field ledger can gain its closing page
    // after the handover without rewriting anything the player already read.
    documents: ch1UnlockedDocumentsFor(runtime.flags).map((doc) => ({
      id: doc.id,
      title: doc.title,
      attribution: doc.attribution,
      ...(doc.itemId ? { itemId: doc.itemId } : {}),
      pages: ch1DocumentPages(doc.id, runtime.flags).map((page) => ({
        ...(page.heading ? { heading: page.heading } : {}),
        body: page.body,
      })),
    })),
    // Per-player stage directions. The shared ECS bodies never move for this;
    // a character whose staged place differs from their seeded body is drawn
    // as a chapter puppet, and `present: false` means "not here, for you".
    staging: staging.map((npc) => ({
      key: npc.key,
      entityId: npc.entityId,
      displayName: npc.displayName,
      present: npc.present,
      useSeededBody: npc.useSeededBody,
      ...(npc.position
        ? { position: [...npc.position] as [number, number, number] }
        : {}),
      activity: npc.activity,
    })),
    worldPhase: ch1WorldPhaseEffects(stagingInput).map((effect) => ({
      id: effect.id,
      summary: effect.summary,
    })),
  } as const;
}

/**
 * Ambient trigger validation.
 *
 * The client reports "I believe a place/sleep/stress trigger fired". It does
 * NOT supply position, health, inventory, or flags — every one of those is read
 * again here from server-owned state before a memory is delivered, exactly like
 * the gate route. A client that lies gets a refusal, not a fragment.
 */
async function evaluateAmbientTrigger(args: {
  worldApi: WorldApi;
  userId: BiomesId;
  runtime: Ch1LiveGateRuntimeState;
  items: Readonly<Record<string, number>>;
  fragmentId: string;
  kind: Ch1AmbientTriggerKind;
  nowMs: number;
}): Promise<Ch1LiveStoryActionResult> {
  const player = await args.worldApi.get(args.userId);
  const position = player?.position()?.v as
    | [number, number, number]
    | undefined;
  const health = player?.health();
  const maxHp = Number(health?.maxHp ?? 0);
  const healthFraction =
    health && Number.isFinite(maxHp) && maxHp > 0
      ? Math.max(0, Math.min(1, Number(health.hp) / maxHp))
      : undefined;

  const evaluation = ch1EvaluateAmbientTrigger({
    fragmentId: args.fragmentId,
    kind: args.kind,
    context: {
      position,
      flags: args.runtime.flags,
      itemIds: Object.entries(args.items)
        .filter(([, count]) => Number(count) > 0)
        .map(([itemId]) => itemId),
      latentSkillIds: args.runtime.latentSkills.unlocked,
      healthFraction,
      recoveredFragmentIds: args.runtime.ledger.entries.map(
        (entry) => entry.fragmentId
      ),
      availablePlaybackIds: args.runtime.availablePlaybackIds,
    },
  });
  if (!evaluation.ok) {
    return { ok: false, runtime: args.runtime, reason: evaluation.reason };
  }
  return ch1TriggerLiveFragment(args.runtime, args.fragmentId, args.nowMs);
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "POST",
    body: zBody,
    response: zResponse,
  },
  async ({
    context: { logicApi, worldApi },
    auth,
    body,
    unsafeRequest,
    unsafeResponse,
  }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    const redis = await storyRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      `authenticated:chapter1-story:${auth.userId}`
    );
    const stateKey = harthmereLiveModePlayerStateKey(actorId);
    if (body.action === "state" || body.action === "sync") {
      const raw = await redis.primary.get(stateKey);
      return project(
        parseHarthmereLiveModeBackendState(raw, actorId, Date.now())
      );
    }

    const lock = await acquireHarthmereActorStateLock(redis.primary, actorId, {
      waitMs: 10_000,
    });
    if (!lock.acquired) {
      const raw = await redis.primary.get(stateKey);
      return {
        ...project(
          parseHarthmereLiveModeBackendState(raw, actorId, Date.now())
        ),
        ok: false,
        reason: "Chapter 1 state is busy; try again.",
      };
    }
    try {
      const nowMs = Date.now();
      const raw = await redis.primary.get(stateKey);
      const state = parseHarthmereLiveModeBackendState(raw, actorId, nowMs);
      const nativePlayer = await worldApi.get(auth.userId);
      const nativeItems = readCh1NativeInventoryCounts(nativePlayer);
      const result =
        body.action === "play_log"
          ? ch1PlayLiveLog(state.chapter1, body.fragmentId, nowMs)
          : body.action === "recharge"
          ? ch1RechargeLiveAugur9(state.chapter1, body.itemId)
          : body.action === "use_skill"
          ? ch1UseLiveLatentSkill(state.chapter1, body.skillId, nowMs)
          : body.action === "trigger"
          ? await evaluateAmbientTrigger({
              worldApi,
              userId: auth.userId,
              runtime: state.chapter1,
              items: nativeItems,
              fragmentId: body.fragmentId,
              kind: body.kind,
              nowMs,
            })
          : ch1LinkLiveFragments(state.chapter1, body.fragmentIds, nowMs);
      if (!result.ok) {
        return { ...project(state), ok: false, reason: result.reason };
      }
      if (result.consumedItemId) {
        const count = nativeItems[result.consumedItemId] ?? 0;
        if (count < 1) {
          return {
            ...project(state),
            ok: false,
            reason: `You do not have ${result.consumedItemId}.`,
          };
        }
      }
      state.chapter1 = result.runtime;
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
        if (result.consumedItemId) {
          const nativeItemId = harthmereNativeBiomesIdForItemId(
            result.consumedItemId
          );
          if (!nativeItemId || !nativePlayer) {
            throw new Error("The recharge item has no native ECS identity.");
          }
          const storage = nativePlayer.harthmereMaterialStorage();
          const transactionInput = {
            id: auth.userId,
            transaction_id: `chapter1:augur9:recharge:${
              body.action === "recharge"
                ? body.requestId ?? randomUUID()
                : randomUUID()
            }`,
            take: createBag(countOf(nativeItemId, 1n)),
            give: createBag(),
            storage_take: createBag(),
            storage_give: createBag(),
            storage_max_slots: Math.max(1, storage?.max_slots ?? 32),
            personal_bank_take: createBag(),
            personal_bank_give: createBag(),
            personal_bank_max_slots: Math.max(
              1,
              storage?.personal_max_slots ?? 24
            ),
            account_bank_take: createBag(),
            account_bank_give: createBag(),
            account_bank_max_slots: Math.max(
              1,
              storage?.account_max_slots ?? 40
            ),
            gold_delta: 0n,
            publish_craft: false,
            station_entity_id: undefined,
            robot_entity_id: undefined,
            robot_energy_delta: 0,
            write_standing: false,
            standing_scope: "",
            standing_likeability: 0,
            standing_legal: 0,
            standing_notoriety: 0,
            standing_notoriety_floor: 0,
          } as const;
          await logicApi.publish(
            new GameEvent(
              auth.userId,
              new HarthmereInventoryTransactionEvent({
                ...transactionInput,
                authorization:
                  authorizeHarthmereInventoryTransaction(transactionInput),
              })
            )
          );
        }
      } catch (error) {
        await redis.primary.set(stateKey, previousSerialized);
        throw error;
      }
      return project(state);
    } finally {
      await lock.release();
    }
  }
);
