import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { editWorldWithRetry } from "@/server/shared/world/edit_retry";
import {
  HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION,
  HARTHMERE_GROVE_RESPAWN_POSITION,
  readHarthmereNativeVitals,
  restoreHarthmereNativeVitalsForRespawn,
  tickHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { z } from "zod";

const zBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("heartbeat"),
    // Accepted during a rolling upgrade only. The server deliberately ignores
    // these former browser claims; the scheduler derives activity/environment.
    gameplayActive: z.boolean().optional(),
    underwater: z.boolean().optional(),
  }),
  z.object({ action: z.literal("respawn_grove") }),
]);

const zResponse = z.object({
  ok: z.boolean(),
  action: z.enum(["heartbeat", "respawn_grove"]),
  mana: z.number(),
  maxMana: z.number(),
  stamina: z.number(),
  maxStamina: z.number(),
  breath: z.number(),
  maxBreath: z.number(),
  hp: z.number(),
  maxHp: z.number(),
  damage: z.number(),
  deathCause: z.enum(["stamina", "drowning"]).optional(),
});

function unavailableNativeVitalsResponse(
  action: "heartbeat" | "respawn_grove"
) {
  return {
    ok: false,
    action,
    mana: 0,
    maxMana: 1,
    stamina: 0,
    maxStamina: 1,
    breath: 0,
    maxBreath: 1,
    hp: 0,
    maxHp: 1,
    damage: 0,
  };
}

export function applyHarthmereNativeVitalsHeartbeatForTest(input: {
  triggerState: Parameters<typeof tickHarthmereNativeVitals>[0];
  health: { hp: number; maxHp: number };
  nowMs: number;
  gameplayActive: boolean;
  underwater: boolean;
}) {
  const tick = tickHarthmereNativeVitals(input.triggerState, {
    nowMs: input.nowMs,
    gameplayActive: input.gameplayActive,
    underwater: input.underwater,
    alive: input.health.hp > 0,
  });
  let hp = input.health.hp;
  if (tick.deathCause === "stamina") {
    hp = 0;
  } else if (tick.damage > 0) {
    hp = Math.max(0, hp - tick.damage);
  }
  return { ...tick, hp };
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "POST",
    body: zBody,
    response: zResponse,
  },
  async ({ context: { worldApi }, auth, body }) => {
    if (!nativeBiomesEcsAuthorityEnabled()) {
      return unavailableNativeVitalsResponse(body.action);
    }

    if (body.action === "heartbeat") {
      // The one-per-second server scheduler is the survival authority and ECS
      // sync pushes its changes to the HUD. A browser heartbeat must therefore
      // be a cheap read, not a second terrain scan + competing optimistic write.
      const player = await worldApi.get(auth.userId);
      if (!player) {
        return unavailableNativeVitalsResponse(body.action);
      }
      const health = player.health();
      const vitals = readHarthmereNativeVitals(player.triggerState());
      return {
        ok: true,
        action: body.action,
        mana: vitals.mana,
        maxMana: vitals.maxMana,
        stamina: vitals.stamina,
        maxStamina: vitals.maxStamina,
        breath: vitals.breath,
        maxBreath: vitals.maxBreath,
        hp: health?.hp ?? 0,
        maxHp: health?.maxHp ?? 1,
        damage: 0,
      };
    }

    // Respawn is the only mutating operation left on this route. Keep bounded
    // retries for a normal overlap with combat, consumption, or the scheduler.
    return editWorldWithRetry(
      worldApi,
      async (editor) => {
        const player = await editor.get(auth.userId);
        if (!player) {
          return unavailableNativeVitalsResponse(body.action);
        }

        const nowMs = Date.now();
        const health = player.mutableHealth();
        if (body.action === "respawn_grove") {
          health.hp = health.maxHp;
          health.lastDamageSource = undefined;
          health.lastDamageAmount = undefined;
          health.lastDamageTime = undefined;
          player.setPosition({ v: [...HARTHMERE_GROVE_RESPAWN_POSITION] });
          const vitals = restoreHarthmereNativeVitalsForRespawn(
            player.mutableTriggerState(),
            nowMs
          );
          writeHarthmereNativeVitals(player.mutableTriggerState(), {
            ...vitals,
            migrationVersion: Math.max(
              vitals.migrationVersion,
              HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION
            ),
          });
        }

        const vitals = readHarthmereNativeVitals(player.triggerState());
        return {
          ok: true,
          action: body.action,
          mana: vitals.mana,
          maxMana: vitals.maxMana,
          stamina: vitals.stamina,
          maxStamina: vitals.maxStamina,
          breath: vitals.breath,
          maxBreath: vitals.maxBreath,
          hp: health.hp,
          maxHp: health.maxHp,
          damage: 0,
          deathCause: undefined,
        };
      },
      { maxAttempts: 6 }
    );
  }
);
