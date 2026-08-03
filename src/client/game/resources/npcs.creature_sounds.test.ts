import assert from "assert";
import fs from "fs";
import path from "path";

describe("native NPC creature sound wiring", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
    "utf8"
  );

  it("starts idle timers from stationary gameplay state, not only animation blend weights", () => {
    assert.match(source, /harthmereCreatureIdleSoundEligible\(\{/);
    assert.match(source, /combatTargetActive: targetId !== undefined/);
    assert.match(source, /horizontalSpeed: Math\.hypot\(/);
    assert.match(
      source,
      /idleSpeedThreshold: HARTHMERE_NPC_BODY_LOCOMOTION_DEADZONE_SPEED/
    );
  });

  it("keeps attack counts across slower attack intervals and lazy-loads generated clips", () => {
    const attackEffects = source.slice(
      source.indexOf("private tickOnAttackEffects"),
      source.indexOf("private lastDamageAnimationTime")
    );
    assert.doesNotMatch(attackEffects, /> 10_000/);
    assert.match(attackEffects, /this\.harthmereCreatureAttackCount \+= 1/);
    assert.match(source, /this\.audioManager\.playPathAt\(/);
  });
});
