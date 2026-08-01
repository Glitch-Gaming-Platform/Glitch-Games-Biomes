import { harthmereClassAbilityMagicChargeSeconds } from "@/client/components/challenges/LocalDevHarthmereClassSkillSystem";
import { harthmereLocalCombatMagicChargeSeconds } from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  HARTHMERE_MAGIC_CHARGE_MAX_SECS,
  HARTHMERE_MAGIC_CHARGE_MIN_SECS,
} from "@/shared/harthmere/magic_charge";
import assert from "assert";

describe("Harthmere class magic charge", () => {
  it("charges offensive spells by power while keeping physical abilities immediate", () => {
    const spark = harthmereClassAbilityMagicChargeSeconds("spark");
    const fireball = harthmereClassAbilityMagicChargeSeconds("fireball");
    const meteor = harthmereClassAbilityMagicChargeSeconds("meteor");

    assert.ok(spark >= HARTHMERE_MAGIC_CHARGE_MIN_SECS);
    assert.ok(fireball > spark);
    assert.equal(meteor, HARTHMERE_MAGIC_CHARGE_MAX_SECS);
    assert.equal(harthmereClassAbilityMagicChargeSeconds("basic_strike"), 0);
    assert.ok(
      harthmereLocalCombatMagicChargeSeconds({
        ability: "spark",
        attackDamage: 18,
      }) >= HARTHMERE_MAGIC_CHARGE_MIN_SECS
    );
    assert.equal(
      harthmereLocalCombatMagicChargeSeconds({ ability: "heavy" }),
      0
    );
  });
});
