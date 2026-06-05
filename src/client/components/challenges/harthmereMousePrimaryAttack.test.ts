/// <reference types="mocha" />
import { isHarthmereCombatCreatureNpcTypeV1 } from "@/client/components/challenges/dialogueObjectSemantics";
import { shouldEngageHarthmereMousePrimaryAttackV1 } from "@/client/components/challenges/harthmereMousePrimaryAttackRules";
import { harthmerePvpPlayersInArcV1 } from "@/client/components/challenges/harthmerePvpHitRules";
import { BikkieIds } from "@/shared/bikkie/ids";
import { HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1 } from "@/shared/harthmere/combat_reach_v1";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("harthmere left-mouse primary attack routing", () => {
  const engaged = {
    button: 0,
    pointerLocked: true,
    typingTarget: false,
    hasAttackableTargetNearby: true,
  };

  it("engages on a left click in play with a target nearby", () => {
    assert.equal(shouldEngageHarthmereMousePrimaryAttackV1(engaged), true);
  });

  it("ignores non-left buttons (right/middle break placement/camera, never attack)", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({ ...engaged, button: 2 }),
      false
    );
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({ ...engaged, button: 1 }),
      false
    );
  });

  it("does not attack when the pointer is unlocked (player is in HUD/menus)", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({
        ...engaged,
        pointerLocked: false,
      }),
      false
    );
  });

  it("engages on a game-canvas click even when pointer lock is unavailable in an embed", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({
        ...engaged,
        pointerLocked: false,
        gameplayCanvasTarget: true,
      }),
      true
    );
  });

  it("does not attack when the click originated in a text field", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({
        ...engaged,
        typingTarget: true,
      }),
      false
    );
  });

  it("does not engage combat when nothing attackable is in range (pure mining/building click)", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({
        ...engaged,
        hasAttackableTargetNearby: false,
      }),
      false
    );
  });
});

describe("harthmere player-vs-player mouse swing reach", () => {
  it("hits players at voxel interaction reach but not beyond it", () => {
    const targetId = 42 as BiomesId;
    const cosHalfAngle = Math.cos((135 * Math.PI) / 360);
    assert.deepStrictEqual(
      harthmerePvpPlayersInArcV1({
        origin: [0, 0],
        forward: [1, 0],
        players: [
          {
            id: targetId,
            pos: [HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1, 0],
          },
        ],
        range: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1,
        cosHalfAngle,
      }),
      [targetId]
    );
    assert.deepStrictEqual(
      harthmerePvpPlayersInArcV1({
        origin: [0, 0],
        forward: [1, 0],
        players: [
          {
            id: targetId,
            pos: [HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1 + 0.01, 0],
          },
        ],
        range: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1,
        cosHalfAngle,
      }),
      []
    );
  });
});

describe("harthmere combat-creature talk gate", () => {
  it("classifies muckers/hexers/wildlife (shared dMucker type) as non-talkable creatures", () => {
    assert.equal(isHarthmereCombatCreatureNpcTypeV1(BikkieIds.dMucker), true);
  });

  it("does not classify other NPC types as combat creatures", () => {
    // An arbitrary non-dMucker npc type id stays talkable.
    assert.equal(
      isHarthmereCombatCreatureNpcTypeV1(123456789 as BiomesId),
      false
    );
  });

  it("treats missing npc type as not-a-creature (so genuine NPCs are never suppressed)", () => {
    assert.equal(isHarthmereCombatCreatureNpcTypeV1(undefined), false);
    assert.equal(isHarthmereCombatCreatureNpcTypeV1(null), false);
  });
});
