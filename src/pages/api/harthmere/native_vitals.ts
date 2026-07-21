import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { serverDerivedHarthmereUnderwater } from "@/server/harthmere/native_vitals_environment";
import { secondsSinceEpoch } from "@/shared/ecs/config";
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
    // these former browser claims and derives activity/environment itself.
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

export const serverDerivedHarthmereUnderwaterForTest =
  serverDerivedHarthmereUnderwater;

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
  async ({ context: { worldApi, askApi, voxeloo }, auth, body }) => {
    if (!nativeBiomesEcsAuthorityEnabled()) {
      return {
        ok: false,
        action: body.action,
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

    const editor = worldApi.edit();
    const player = await editor.get(auth.userId);
    if (!player) {
      return {
        ok: false,
        action: body.action,
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

    const nowMs = Date.now();
    const health = player.mutableHealth();
    let damage = 0;
    let deathCause: "stamina" | "drowning" | undefined;

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
    } else {
      const position = player.position()?.v;
      const underwater = await serverDerivedHarthmereUnderwater({
        askApi,
        voxeloo,
        position:
          position && position.length >= 3
            ? [position[0], position[1], position[2]]
            : undefined,
        height: player.size()?.v[1],
      });
      const result = applyHarthmereNativeVitalsHeartbeatForTest({
        triggerState: player.mutableTriggerState(),
        health,
        nowMs,
        // Receiving an authenticated heartbeat is the server-side activity
        // lease. A caller can no longer pause survival drain with a false bit.
        gameplayActive: true,
        underwater,
      });
      damage = result.damage;
      deathCause = result.deathCause;
      if (result.hp !== health.hp) {
        const previousHp = health.hp;
        health.hp = result.hp;
        health.lastDamageSource =
          result.deathCause === "drowning"
            ? { kind: "drown" }
            : { kind: "suicide" };
        health.lastDamageAmount = Math.max(0, previousHp - result.hp);
        health.lastDamageTime = secondsSinceEpoch();
      }
    }

    const vitals = readHarthmereNativeVitals(player.triggerState());
    await editor.commit();
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
      damage,
      deathCause,
    };
  }
);
