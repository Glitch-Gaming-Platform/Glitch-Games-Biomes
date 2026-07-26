// CHAPTER_1_STORY_API
//
// Authenticated projection and mutations for Chapter 1 systems that are not
// native ECS components. Fragment truth never enters this response: every
// ledger row is built by ch1ProjectFragmentForClient().

import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { acquireHarthmereActorStateLock } from "@/server/harthmere/live_mode_actor_state_authority";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import { ch1ProjectFragmentForClient } from "@/server/harthmere/ch1_fragment_authority";
import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { ch1Fragment } from "@/shared/harthmere/ch1_fragment_ledger";
import { ch1ItemDisplayName } from "@/shared/harthmere/ch1_items";
import { ch1LatentSkill } from "@/shared/harthmere/ch1_latent_skills";
import {
  ch1LinkLiveFragments,
  ch1PlayLiveLog,
  ch1RechargeLiveAugur9,
} from "@/shared/harthmere/ch1_live_story";
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
  z.object({ action: z.literal("recharge"), itemId: z.string().min(1) }),
  z.object({
    action: z.literal("link"),
    fragmentIds: z.array(z.string().min(1)).min(2).max(8),
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
    cardName: ch1ItemDisplayName("item_grey_card", runtime.flags) ?? "Grey Card",
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
  } as const;
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "POST",
    body: zBody,
    response: zResponse,
  },
  async ({ auth, body, unsafeRequest, unsafeResponse }) => {
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
        ...project(parseHarthmereLiveModeBackendState(raw, actorId, Date.now())),
        ok: false,
        reason: "Chapter 1 state is busy; try again.",
      };
    }
    try {
      const nowMs = Date.now();
      const raw = await redis.primary.get(stateKey);
      const state = parseHarthmereLiveModeBackendState(raw, actorId, nowMs);
      const result =
        body.action === "play_log"
          ? ch1PlayLiveLog(state.chapter1, body.fragmentId, nowMs)
          : body.action === "recharge"
            ? ch1RechargeLiveAugur9(state.chapter1, body.itemId)
            : ch1LinkLiveFragments(state.chapter1, body.fragmentIds, nowMs);
      if (!result.ok) {
        return { ...project(state), ok: false, reason: result.reason };
      }
      if (result.consumedItemId) {
        const count = state.inventory.items[result.consumedItemId] ?? 0;
        if (count < 1) {
          return {
            ...project(state),
            ok: false,
            reason: `You do not have ${result.consumedItemId}.`,
          };
        }
        if (count === 1) delete state.inventory.items[result.consumedItemId];
        else state.inventory.items[result.consumedItemId] = count - 1;
      }
      state.chapter1 = result.runtime;
      state.updatedAtMs = nowMs;
      await redis.primary.set(
        stateKey,
        stringifyHarthmereLiveModePlayerPersistenceState(state)
      );
      return project(state);
    } finally {
      await lock.release();
    }
  }
);
