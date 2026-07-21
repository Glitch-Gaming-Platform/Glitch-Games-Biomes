import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModeQuestClientSnapshot,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";
import { readHarthmerePlayerAndSharedStateStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import type { WorldApi } from "@/server/shared/world/api";
import { HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID } from "@/shared/harthmere/bible_quest_live_authority";
import type { BiomesId } from "@/shared/ids";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeQuestStateResponse = z.object({
  ok: z.boolean(),
  questState: zJsonRecord,
});

const globalForHarthmereLiveModeQuestState = globalThis as typeof globalThis & {
  __harthmereLiveModeQuestStateRedis?: ReturnType<typeof connectToRedis>;
};

function liveModeQuestStateRedis() {
  return (globalForHarthmereLiveModeQuestState.__harthmereLiveModeQuestStateRedis ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeQuestStateForActor(input: {
  redis: {
    primary: {
      get: (key: string) => Promise<string | null>;
      mget?: (...keys: string[]) => Promise<Array<string | null>>;
    };
  };
  actorId: string;
  nowMs: number;
  worldApi?: WorldApi;
}) {
  const stateKey = harthmereLiveModePlayerStateKey(input.actorId);
  const sharedStateKey = harthmereLiveModeSharedWorldStateKey();
  const { rawState, rawSharedState } =
    await readHarthmerePlayerAndSharedStateStrings(
      input.redis.primary,
      stateKey,
      sharedStateKey
    );
  const state = parseHarthmereLiveModeBackendState(
    rawState,
    input.actorId,
    input.nowMs
  );
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    state,
    parseHarthmereLiveModeSharedWorldState(rawSharedState, input.nowMs),
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  if (input.worldApi && state.quests.bible.thaedryn) {
    const boss = await input.worldApi.get(
      HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID as BiomesId
    );
    const health = boss?.health();
    if (health) {
      state.quests.bible.thaedryn = {
        ...state.quests.bible.thaedryn,
        healthPct: Math.max(
          0,
          Math.min(100, (health.hp / Math.max(1, health.maxHp)) * 100)
        ),
      };
    }
  }
  return createHarthmereLiveModeQuestClientSnapshot(state);
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeQuestStateResponse,
  },
  async ({ context: { worldApi }, auth, unsafeRequest, unsafeResponse }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    const redis = await liveModeQuestStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:quest-state-reader",
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );
    const nowMs = Date.now();
    return {
      ok: true,
      questState: await readHarthmereLiveModeQuestStateForActor({
        redis,
        actorId,
        nowMs,
        worldApi,
      }),
    };
  }
);
