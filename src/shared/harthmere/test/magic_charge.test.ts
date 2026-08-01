import {
  HARTHMERE_MAGIC_CHARGE_MAX_SECS,
  HARTHMERE_MAGIC_CHARGE_MIN_SECS,
  harthmereMagicChargeDurationSecs,
  isHarthmereMagicAttack,
} from "@/shared/harthmere/magic_charge";
import assert from "assert";

describe("universal Harthmere magic charge", () => {
  it("classifies authored magic while leaving physical attacks immediate", () => {
    assert.equal(
      isHarthmereMagicAttack({
        damageType: "blunt",
        projectileVisualId: "meteor",
      }),
      false
    );
    assert.equal(
      isHarthmereMagicAttack({ projectileVisualId: "fireball" }),
      true
    );
    assert.equal(isHarthmereMagicAttack({ damageType: "holy" }), true);
    assert.equal(
      harthmereMagicChargeDurationSecs({
        damageType: "physical",
        attackDamage: 150,
      }),
      0
    );
  });

  it("keeps every magic charge between the shared two and ten second constants", () => {
    const weakest = harthmereMagicChargeDurationSecs({
      explicitMagic: true,
    });
    const strongest = harthmereMagicChargeDurationSecs({
      explicitMagic: true,
      ultimate: true,
    });
    assert.equal(weakest, HARTHMERE_MAGIC_CHARGE_MIN_SECS);
    assert.equal(strongest, HARTHMERE_MAGIC_CHARGE_MAX_SECS);
  });

  it("makes more powerful magic take longer to charge", () => {
    const spark = harthmereMagicChargeDurationSecs({
      explicitMagic: true,
      resourceCost: 8,
      cooldownSecs: 3,
    });
    const fireball = harthmereMagicChargeDurationSecs({
      projectileVisualId: "fireball",
      attackDamage: 30,
      cooldownSecs: 20,
    });
    const bossMeteor = harthmereMagicChargeDurationSecs({
      damageType: "gravity",
      projectileVisualId: "meteor",
      attackDamage: 138,
      cooldownSecs: 15,
      attackShape: "ground_aoe",
    });
    const ultimate = harthmereMagicChargeDurationSecs({
      explicitMagic: true,
      resourceCost: 90,
      cooldownSecs: 180,
      ultimate: true,
    });
    assert.ok(spark >= HARTHMERE_MAGIC_CHARGE_MIN_SECS);
    assert.ok(fireball > spark);
    assert.ok(bossMeteor > fireball);
    assert.equal(ultimate, HARTHMERE_MAGIC_CHARGE_MAX_SECS);
  });
});
