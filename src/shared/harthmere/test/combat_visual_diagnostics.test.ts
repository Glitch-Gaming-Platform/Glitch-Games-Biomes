/// <reference types="mocha" />

import assert from "assert";
import {
  evaluateHarthmereCombatVisualDiagnosis,
  harthmereCombatVisualAttackMode,
} from "../combat_visual_diagnostics";
import { getHarthmereEquipmentAnimation } from "../../game/medieval/harthmereEquipmentAnimationManifest.generated";
import { ensureHarthmereProductionCraftingCatalogue } from "../mmo_crafting_catalogue";
import { getHarthmereItemDefinition } from "../mmo_inventory_authority";

describe("combat_visual_diagnostics", () => {
  it("treats empty-handed player and NPC body attacks as first-class contact attacks", () => {
    const playerToNpc = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "player-empty-handed-live-npc",
      attackFamily: "unarmed",
      attackerIsPlayer: true,
      distanceMeters: 1.2,
      actorPositionObserved: true,
      bodyAnimationObserved: true,
      weaponAnimationObserved: false,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -24,
      hudDeltaObserved: true,
      targetAttackable: true,
    });
    const npcToPlayer = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "npc-body-counter-live-player",
      attackFamily: "npc_body",
      targetIsPlayer: true,
      distanceMeters: 1.4,
      actorPositionObserved: true,
      bodyAnimationObserved: true,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -18,
      hudDeltaObserved: true,
      targetAttackable: true,
    });

    assert.equal(harthmereCombatVisualAttackMode("unarmed"), "contact");
    assert.equal(playerToNpc.passed, true, JSON.stringify(playerToNpc));
    assert.equal(npcToPlayer.passed, true, JSON.stringify(npcToPlayer));
    assert.ok(
      playerToNpc.warnings.includes(
        "unarmed attacks do not require sword or weapon debug events"
      )
    );
  });

  it("catches the exact phantom-hit failure: hidden loading state, far melee, and stale HUD", () => {
    const result = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "mucker-hits-after-grove-respawn-from-nowhere",
      attackFamily: "monster_body",
      targetIsPlayer: true,
      rendererReady: true,
      loadingOverlayGone: false,
      actorPositionObserved: true,
      bodyAnimationObserved: false,
      distanceMeters: 44,
      attackerRadiusMeters: 0.8,
      targetRadiusMeters: 0.45,
      contactReachMeters: 1.35,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -100,
      hudDeltaObserved: false,
      targetAttackable: true,
      safeZone: true,
    });

    assert.equal(result.passed, false);
    assert.deepEqual(
      result.failures.sort(),
      [
        "body_attack_animation_missing",
        "contact_range_too_far",
        "hud_delta_missing",
        "loading_overlay_active",
        "safe_zone_damage",
      ].sort()
    );
  });

  it("keeps empty-handed body attacks in contact range instead of old sword sweep range", () => {
    const farFists = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "empty-hand-four-meters-away",
      attackFamily: "unarmed",
      attackerIsPlayer: true,
      distanceMeters: 4,
      attackerRadiusMeters: 0.45,
      targetRadiusMeters: 0.45,
      contactReachMeters: 1.35,
      actorPositionObserved: true,
      bodyAnimationObserved: true,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -1,
      hudDeltaObserved: true,
      targetAttackable: true,
    });
    const closeFists = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "empty-hand-in-contact",
      attackFamily: "unarmed",
      attackerIsPlayer: true,
      distanceMeters: 1.35,
      attackerRadiusMeters: 0.45,
      targetRadiusMeters: 0.45,
      contactReachMeters: 1.35,
      actorPositionObserved: true,
      bodyAnimationObserved: true,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -1,
      hudDeltaObserved: true,
      targetAttackable: true,
    });

    assert.ok(farFists.failures.includes("contact_range_too_far"));
    assert.equal(closeFists.passed, true, JSON.stringify(closeFists));
  });

  it("separates projectile rules from contact rules for Bikkie/ranged attacks", () => {
    const missingProjectileVisual = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "bikkie-ranged-no-projectile-visual",
      attackFamily: "ranged_bikkie",
      attackerIsPlayer: true,
      distanceMeters: 9,
      lineOfSight: true,
      projectileVisualObserved: false,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -12,
      hudDeltaObserved: true,
      targetAttackable: true,
    });
    const tooCloseProjectile = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "bow-fired-inside-contact-range",
      attackFamily: "ranged_weapon",
      distanceMeters: 0.5,
      lineOfSight: true,
      projectileVisualObserved: true,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -8,
      targetAttackable: true,
    });

    assert.equal(missingProjectileVisual.mode, "projectile");
    assert.ok(
      missingProjectileVisual.failures.includes("projectile_visual_missing")
    );
    assert.ok(
      tooCloseProjectile.failures.includes("projectile_range_too_close")
    );
  });

  it("proves the Bikkie hunter bow has a projectile item and animated arrow asset", () => {
    ensureHarthmereProductionCraftingCatalogue();
    const hunterBow = getHarthmereItemDefinition("hunter_bow");
    const arrowBow = getHarthmereEquipmentAnimation("arrow_bow");
    const result = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "hunter-bow-arrow-bow-projectile",
      attackFamily: "ranged_bikkie",
      attackerIsPlayer: true,
      distanceMeters: 9,
      lineOfSight: true,
      projectileVisualObserved: Boolean(
        hunterBow?.stats?.rangedAttack &&
          arrowBow?.animations.includes("ProjectileSpin_24") &&
          arrowBow?.animations.includes("ImpactTwitch_24")
      ),
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -8,
      hudDeltaObserved: true,
      targetAttackable: true,
    });

    assert.equal(hunterBow?.displayName, "Hunter Bow");
    assert.equal(arrowBow?.category, "ranged");
    assert.equal(result.passed, true, JSON.stringify(result));
  });

  it("allows livestock and pets to be attackable while requiring crime or owner penalties", () => {
    const legalHooked = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "livestock-owned-by-someone-else",
      attackFamily: "animal_body",
      attackerIsPlayer: true,
      distanceMeters: 1.1,
      actorPositionObserved: true,
      bodyAnimationObserved: true,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -17,
      hudDeltaObserved: true,
      targetAttackable: true,
      crimeExpected: true,
      crimeOrOwnerPenaltyObserved: true,
    });
    const missingCrime = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "pet-owned-by-someone-else-no-crime",
      attackFamily: "animal_body",
      attackerIsPlayer: true,
      distanceMeters: 1.1,
      actorPositionObserved: true,
      bodyAnimationObserved: true,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -17,
      hudDeltaObserved: true,
      targetAttackable: true,
      crimeExpected: true,
      crimeOrOwnerPenaltyObserved: false,
    });

    assert.equal(legalHooked.passed, true, JSON.stringify(legalHooked));
    assert.ok(missingCrime.failures.includes("crime_or_owner_penalty_missing"));
    assert.ok(!missingCrime.failures.includes("protected_target_damaged"));
  });

  it("protects labels, places, and other non-combatants from taking damage", () => {
    const result = evaluateHarthmereCombatVisualDiagnosis({
      scenario: "label-place-should-not-lose-health",
      attackFamily: "tool",
      attackerIsPlayer: true,
      distanceMeters: 1,
      actorPositionObserved: true,
      weaponAnimationObserved: true,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -1,
      hudDeltaObserved: true,
      targetAttackable: false,
      targetProtected: true,
      allowZeroDamage: true,
    });

    assert.equal(result.passed, false);
    assert.ok(result.failures.includes("protected_target_damaged"));
  });
});
