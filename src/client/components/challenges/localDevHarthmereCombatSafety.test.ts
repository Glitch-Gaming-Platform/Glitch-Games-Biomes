import assert from "assert";
import {
  harthmereLocalCombatDamageGate,
  harthmereLocalCombatHasLineOfSight,
  isHarthmereLocalCombatSafeZonePosition,
} from "./localDevHarthmereCombatSafety";

describe("local-dev Harthmere combat safety", () => {
  const npc = { attackRange: 1.8, movementSpeed: 3.2 };

  it("treats The Grove respawn and town core as safe from monster damage", () => {
    assert.equal(
      isHarthmereLocalCombatSafeZonePosition([496, 70, -126]),
      true
    );
    assert.equal(
      isHarthmereLocalCombatSafeZonePosition([612, 60, -245]),
      true
    );
    assert.equal(
      isHarthmereLocalCombatSafeZonePosition([333, 54, -390]),
      false
    );
  });

  it("blocks monster damage in safe zones and during respawn protection", () => {
    assert.equal(
      harthmereLocalCombatDamageGate({
        npc,
        npcPosition: [497, 70, -126],
        playerPosition: [496, 70, -126],
        playerHp: 65,
        playerCombatState: "idle",
      }).reason,
      "safe_zone"
    );
    assert.equal(
      harthmereLocalCombatDamageGate({
        npc,
        npcPosition: [0, 54, 0],
        playerPosition: [1, 54, 0],
        playerHp: 65,
        playerCombatState: "protected_after_respawn",
      }).reason,
      "player_protected"
    );
  });

  it("requires actual current melee range instead of virtual chase distance", () => {
    const far = harthmereLocalCombatDamageGate({
      npc,
      npcPosition: [0, 54, 0],
      playerPosition: [18, 54, 0],
      playerHp: 100,
      playerCombatState: "idle",
      targetRadius: 1.15,
    });
    assert.equal(far.canDamage, false);
    assert.equal(far.reason, "target_out_of_range");

    const close = harthmereLocalCombatDamageGate({
      npc,
      npcPosition: [0, 54, 0],
      playerPosition: [2.2, 54, 0],
      playerHp: 100,
      playerCombatState: "idle",
      targetRadius: 1.15,
    });
    assert.equal(close.canDamage, true);
    assert.equal(close.reason, "actual_melee_contact");
  });

  it("requires line of sight for local combat damage", () => {
    assert.equal(
      harthmereLocalCombatHasLineOfSight([0, 54, 0], [28, 54, 0]),
      true
    );
    assert.equal(
      harthmereLocalCombatHasLineOfSight([0, 54, 0], [28.1, 54, 0]),
      false
    );
    assert.equal(
      harthmereLocalCombatHasLineOfSight([0, 54, 0], [40, 54, 0]),
      false
    );
    assert.equal(
      harthmereLocalCombatDamageGate({
        npc,
        npcPosition: [0, 54, 0],
        playerPosition: [2, 54, 0],
        playerHp: 100,
        playerCombatState: "idle",
        lineOfSight: false,
      }).reason,
      "no_line_of_sight"
    );
  });
});
