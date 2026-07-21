import { buildHarthmereNativeMuckScarredHelixEntity } from "@/server/harthmere/live_entity_ecs_seed";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { readHarthmereNativeCombatProgression } from "@/shared/harthmere/harthmere_native_combat";
import { HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED } from "@/shared/harthmere/live_entity_production_seed";
import {
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { z } from "zod";

const zResponse = z.object({
  ok: z.boolean(),
  created: z.boolean(),
  defeated: z.boolean(),
  entityId: z.number().optional(),
  error: z.string().optional(),
});

const globalForNativeCombatBoss = globalThis as typeof globalThis & {
  __harthmereNativeCombatBossRedis?: ReturnType<typeof connectToRedis>;
};

function bossRedis() {
  return (globalForNativeCombatBoss.__harthmereNativeCombatBossRedis ??=
    connectToRedis("firehose"));
}

export function hasActiveHarthmereHardBossQuestForTest(
  active: Readonly<Record<string, { questKind?: string; title?: string }>>
) {
  return activeHarthmereHardBossQuest(active) !== undefined;
}

function activeHarthmereHardBossQuest(
  active: Readonly<Record<string, { questKind?: string; title?: string }>>
) {
  return Object.entries(active).find(
    ([, record]) =>
      record.questKind === "hard_boss" ||
      /muck-scarred helix|worthy foe/i.test(record.title ?? "")
  );
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "POST",
    response: zResponse,
  },
  async ({ context: { worldApi }, auth, unsafeRequest }) => {
    if (!nativeBiomesEcsAuthorityEnabled()) {
      return {
        ok: false,
        created: false,
        defeated: false,
        error: "native_ecs_authority_disabled",
      };
    }

    const redis = await bossRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      `user:${auth.userId}`,
      { allowIdentityWrites: false, allowStateAdoptionPlan: false }
    );
    const raw = await redis.primary.get(
      harthmereLiveModePlayerStateKey(actorId)
    );
    const legacy = parseHarthmereLiveModeBackendState(raw, actorId, Date.now());
    const activeQuest = activeHarthmereHardBossQuest(legacy.quests.active);
    if (!activeQuest) {
      return {
        ok: false,
        created: false,
        defeated: false,
        error: "hard_boss_quest_not_active",
      };
    }

    const player = await worldApi.get(auth.userId);
    const progression = readHarthmereNativeCombatProgression(
      player?.triggerState()
    );
    // Snapshot the native kill count when this specific server-owned quest
    // first asks for its encounter. A corpse expiry cannot be used to farm the
    // same quest, while a different future helper quest receives a fresh key.
    const baselineKey = `harthmere:native_combat_boss:${actorId}:${activeQuest[0]}:baseline`;
    await redis.primary.set(baselineKey, String(progression.bossKills), "NX");
    const baseline = Math.max(
      0,
      Math.trunc(Number(await redis.primary.get(baselineKey)) || 0)
    );
    const bossId = HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED.entityId;
    const existing = await worldApi.get(bossId);
    if (existing) {
      return {
        ok: true,
        created: false,
        defeated: (existing.health()?.hp ?? 0) <= 0,
        entityId: bossId,
      };
    }
    // Never recreate a defeated boss merely because its corpse expired. Native
    // bossKills is committed in the same death transaction as XP and drops.
    if (progression.bossKills > baseline) {
      return {
        ok: true,
        created: false,
        defeated: true,
        entityId: bossId,
      };
    }

    const applied = await worldApi.apply({
      changes: [
        {
          kind: "create",
          entity: buildHarthmereNativeMuckScarredHelixEntity(
            secondsSinceEpoch()
          ),
        },
      ],
    });
    return applied.outcome === "success"
      ? { ok: true, created: true, defeated: false, entityId: bossId }
      : {
          ok: false,
          created: false,
          defeated: false,
          entityId: bossId,
          error: "boss_materialization_conflicted",
        };
  }
);
