/// <reference types="mocha" />

import {
  HARTHMERE_MELEE_HIT_SPARK_DURATION_SECONDS,
  harthmereMeleeHitSparkContactPosition,
  harthmereMeleeHitSparkPresentation,
  shouldShowHarthmereMeleeHitSpark,
} from "@/client/game/renderers/melee_hit_spark_effect";
import type { ReadonlyEmote } from "@/shared/ecs/gen/components";
import assert from "assert";
import fs from "fs";
import path from "path";

function emote(
  emoteType: ReadonlyEmote["emote_type"],
  start = 10,
  expiry = 11
): ReadonlyEmote {
  return {
    emote_type: emoteType,
    emote_start_time: start,
    emote_expiry_time: expiry,
    rich_emote_components: undefined,
    emote_nonce: undefined,
  };
}

describe("confirmed melee hit spark", () => {
  it("is visible for exactly 0.2 seconds", () => {
    assert.equal(HARTHMERE_MELEE_HIT_SPARK_DURATION_SECONDS, 0.2);
    assert.equal(harthmereMeleeHitSparkPresentation(0).visible, true);
    assert.equal(harthmereMeleeHitSparkPresentation(0.1).visible, true);
    assert.ok(harthmereMeleeHitSparkPresentation(0.199).opacity > 0);
    assert.deepEqual(harthmereMeleeHitSparkPresentation(0.2), {
      visible: false,
      opacity: 0,
      scale: 1,
    });
    assert.equal(harthmereMeleeHitSparkPresentation(0.25).visible, false);
  });

  it("places the spark on the attacker-facing target surface", () => {
    assert.deepEqual(
      harthmereMeleeHitSparkContactPosition({
        center: [10, 2, 5],
        bodyHeight: 2,
        damageDirection: [1, 0, 0],
      }),
      [9.72, 2.26, 5]
    );
    assert.deepEqual(
      harthmereMeleeHitSparkContactPosition({
        center: [10, 2, 5],
        bodyHeight: 2,
        damageDirection: [0, 0, 1],
      }),
      [10, 2.26, 4.72]
    );
  });

  it("accepts confirmed player light and heavy melee hits", () => {
    for (const type of ["attack1", "attack2"] as const) {
      assert.equal(
        shouldShowHarthmereMeleeHitSpark({
          damageSource: { kind: "attack", attacker: 123, dir: [1, 0, 0] },
          damageTime: 10.5,
          attackerIsPlayer: true,
          attackerEmote: emote(type),
        }),
        true,
        type
      );
    }
  });

  it("rejects misses, ranged/magic attacks, NPC attacks, and non-attack damage", () => {
    const base = {
      damageSource: {
        kind: "attack" as const,
        attacker: 123,
        dir: [1, 0, 0] as [number, number, number],
      },
      damageTime: 10.5,
      attackerIsPlayer: true,
      attackerEmote: emote("attack1"),
    };
    assert.equal(
      shouldShowHarthmereMeleeHitSpark({ ...base, damageTime: undefined }),
      false,
      "no accepted damage timestamp"
    );
    assert.equal(
      shouldShowHarthmereMeleeHitSpark({
        ...base,
        attackerEmote: emote("rangedRelease"),
      }),
      false,
      "ranged release"
    );
    assert.equal(
      shouldShowHarthmereMeleeHitSpark({
        ...base,
        attackerEmote: emote("magicCast"),
      }),
      false,
      "magic cast"
    );
    assert.equal(
      shouldShowHarthmereMeleeHitSpark({ ...base, attackerIsPlayer: false }),
      false,
      "NPC attack"
    );
    assert.equal(
      shouldShowHarthmereMeleeHitSpark({ ...base, damageTime: 12 }),
      false,
      "damage outside the melee emote"
    );
    assert.equal(
      shouldShowHarthmereMeleeHitSpark({
        ...base,
        damageSource: { kind: "fire", attacker: 123 },
      }),
      false,
      "non-attack damage"
    );
  });

  it("is text-free and wired to NPC and remote-player health presentation", () => {
    const effectRuntime = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/game/renderers/melee_hit_spark_effect.ts"
      ),
      "utf8"
    );
    const npcRuntime = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
      "utf8"
    );
    const playerRuntime = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/renderers/players.ts"),
      "utf8"
    );
    assert.match(effectRuntime, /containsText: false/);
    assert.doesNotMatch(effectRuntime, /fillText|strokeText/);
    assert.match(npcRuntime, /shouldShowHarthmereMeleeHitSpark/);
    assert.match(npcRuntime, /health\.lastDamageTime/);
    assert.match(npcRuntime, /\/ecs\/c\/player_status/);
    assert.match(playerRuntime, /shouldShowHarthmereMeleeHitSpark/);
    assert.match(playerRuntime, /health\?\.lastDamageTime/);
    assert.match(playerRuntime, /attacker\?\.player_status/);
  });
});
