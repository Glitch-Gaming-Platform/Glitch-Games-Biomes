// HARTHMERE_HILL_COMBAT — geometry and target-retention contracts.
//
// Every case here is drawn from the July 27 2026 fight HAR: the player stood at
// ~[351.44, 35, -404.28] in the Watchtower Muck while creature feet ranged from
// Y31 to Y48 within 45 m, and their HP went 77 -> 4 -> 0 in about 30 seconds.
// Enemies could kill; what they could not do was engage reliably.

import assert from "assert";

import {
  ATTACK_VERTICAL_REACH_METERS,
  CHASE_LOST_SIGHT_GRACE_SECONDS,
  CHASE_LOST_SIGHT_HUNT_SECONDS,
  LINE_OF_SIGHT_TARGET_HEIGHT_FRACTIONS,
  TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS,
  bodyVerticalGap,
  chaseApproachDecision,
  chaseRepositionYawOffset,
  evaluateChaseTargetRetention,
  horizontalDistance,
  lineOfSightEyeHeight,
  lineOfSightTargetSamples,
  targetIsRidingAttackerBody,
  withinAttackReach,
  withinHorizontalAttackReach,
  withinVerticalAttackReach,
} from "@/shared/npc/behavior/combat_geometry";

const MUCKER_ATTACK_RADIUS = 2.4; // native ambient Mucker
const MUCKER_HEIGHT = 1.2;
const PLAYER_HEIGHT = 1.8;

describe("hill combat: attack reach decomposition", () => {
  it("REGRESSION: a Mucker on a ledge four metres up can no longer be pushed out of range by height alone", () => {
    // The bug: `length(vecToPlayer)` over the full 3D vector. Horizontally the
    // Mucker is adjacent (1 m), but 4 m of hill makes the 3D distance ~4.12,
    // which is outside a 2.4 m attack radius. It walked forever without swinging.
    const horizontal = 1;
    const legacy3dDistance = Math.hypot(horizontal, 4);
    assert.ok(
      legacy3dDistance >
        MUCKER_ATTACK_RADIUS + TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS,
      "fixture must reproduce the old out-of-range read"
    );
    assert.equal(
      withinHorizontalAttackReach({
        horizontalDistance: horizontal,
        verticalGap: 0,
        attackRadius: MUCKER_ATTACK_RADIUS,
      }),
      true
    );
  });

  it("still refuses a strike when the bodies share no vertical plane", () => {
    // The corollary of the fix: horizontal reach must NOT become a licence to hit
    // through a floor. Four metres of separation is four metres, whichever axis.
    assert.equal(
      withinAttackReach({
        horizontalDistance: 1,
        verticalGap: 4,
        attackRadius: MUCKER_ATTACK_RADIUS,
      }),
      false
    );
  });

  it("treats any vertical body overlap as a reachable strike plane", () => {
    // Mucker feet at Y35 (height 1.2) versus a player one step up at Y35.6.
    // Their spans overlap, so the gap is zero even though the feet differ.
    assert.equal(
      bodyVerticalGap({
        attackerFeetY: 35,
        attackerHeight: MUCKER_HEIGHT,
        targetFeetY: 35.6,
        targetHeight: PLAYER_HEIGHT,
      }),
      0
    );
    assert.equal(
      withinAttackReach({
        horizontalDistance: 2,
        verticalGap: 0,
        attackRadius: MUCKER_ATTACK_RADIUS,
      }),
      true
    );
  });

  it("reports the true gap only when the spans are fully disjoint", () => {
    // Mucker top is 35 + 1.2 = 36.2; player feet at 39. Gap = 2.8.
    assert.equal(
      Number(
        bodyVerticalGap({
          attackerFeetY: 35,
          attackerHeight: MUCKER_HEIGHT,
          targetFeetY: 39,
          targetHeight: PLAYER_HEIGHT,
        }).toFixed(4)
      ),
      2.8
    );
  });

  it("allows roughly one voxel of vertical reach and no more", () => {
    assert.equal(
      withinVerticalAttackReach({
        horizontalDistance: 0,
        verticalGap: ATTACK_VERTICAL_REACH_METERS,
        attackRadius: MUCKER_ATTACK_RADIUS,
      }),
      true
    );
    assert.equal(
      withinVerticalAttackReach({
        horizontalDistance: 0,
        verticalGap: ATTACK_VERTICAL_REACH_METERS + 0.01,
        attackRadius: MUCKER_ATTACK_RADIUS,
      }),
      false
    );
  });

  it("keeps the hitbox cushion horizontal, where it was always meant to apply", () => {
    assert.equal(
      withinHorizontalAttackReach({
        horizontalDistance:
          MUCKER_ATTACK_RADIUS + TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS,
        verticalGap: 0,
        attackRadius: MUCKER_ATTACK_RADIUS,
      }),
      true
    );
    assert.equal(
      withinHorizontalAttackReach({
        horizontalDistance:
          MUCKER_ATTACK_RADIUS +
          TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS +
          0.01,
        verticalGap: 0,
        attackRadius: MUCKER_ATTACK_RADIUS,
      }),
      false
    );
  });

  it("measures horizontal distance on X/Z only", () => {
    assert.equal(horizontalDistance([0, 0, 0], [3, 99, 4]), 5);
  });
});

describe("melee contact: attacker body exclusion", () => {
  const giantPosition: [number, number, number] = [10, 20, -30];
  const giantSize: [number, number, number] = [18, 12, 10];

  it("rejects a player standing on an oversized boss's back", () => {
    assert.equal(
      targetIsRidingAttackerBody({
        attackerPosition: giantPosition,
        attackerSize: giantSize,
        targetPosition: [10, 29, -29],
      }),
      true
    );
  });

  it("does not reject a target standing in front at ground level", () => {
    assert.equal(
      targetIsRidingAttackerBody({
        attackerPosition: giantPosition,
        attackerSize: giantSize,
        targetPosition: [10, 20, -36],
      }),
      false
    );
  });

  it("keeps ordinary one-step hill overlap hittable", () => {
    assert.equal(
      targetIsRidingAttackerBody({
        attackerPosition: [0, 0, 0],
        attackerSize: [1, 1.2, 1],
        targetPosition: [0.65, 2, 0],
      }),
      false
    );
  });

  it("does not turn malformed persisted body sizes into a global miss", () => {
    assert.equal(
      targetIsRidingAttackerBody({
        attackerPosition: giantPosition,
        attackerSize: [Number.NaN, 12, 10],
        targetPosition: [10, 29, -29],
      }),
      false
    );
  });
});

describe("hill combat: approach decision", () => {
  const base = {
    attackRadius: MUCKER_ATTACK_RADIUS,
    hasPathNode: true,
  };

  it("attacks when both axes are satisfied", () => {
    assert.equal(
      chaseApproachDecision({ ...base, horizontalDistance: 2, verticalGap: 0 }),
      "attack"
    );
  });

  it("closes distance while still out of horizontal range", () => {
    assert.equal(
      chaseApproachDecision({ ...base, horizontalDistance: 9, verticalGap: 0 }),
      "close"
    );
  });

  it("follows a route up the hill when one exists", () => {
    assert.equal(
      chaseApproachDecision({ ...base, horizontalDistance: 1, verticalGap: 4 }),
      "close"
    );
  });

  it("REGRESSION: repositions instead of grinding into a cliff face with no route", () => {
    // Standing directly underneath a player on a ledge with no path, the old
    // code stopped dead (3D distance was small) and looked like it had given up.
    // Walking straight ahead is equally useless. Circle the base instead.
    assert.equal(
      chaseApproachDecision({
        ...base,
        hasPathNode: false,
        horizontalDistance: 0.5,
        verticalGap: 4,
      }),
      "reposition"
    );
  });

  it("picks a stable strafe direction per entity so it cannot jitter", () => {
    assert.equal(chaseRepositionYawOffset(2), chaseRepositionYawOffset(2));
    assert.notEqual(chaseRepositionYawOffset(2), chaseRepositionYawOffset(3));
  });
});

describe("hill combat: line-of-sight sampling", () => {
  it("samples head, torso, and feet, tallest first", () => {
    const samples = lineOfSightTargetSamples([10, 35, -400], 1.8);
    assert.equal(samples.length, LINE_OF_SIGHT_TARGET_HEIGHT_FRACTIONS.length);
    assert.deepEqual(
      samples.map((sample) => Number(sample[1].toFixed(3))),
      LINE_OF_SIGHT_TARGET_HEIGHT_FRACTIONS.map((fraction) =>
        Number((35 + 1.8 * fraction).toFixed(3))
      )
    );
    // Descending, so the cheap common case (head visible) exits first.
    assert.ok(samples[0][1] > samples[1][1] && samples[1][1] > samples[2][1]);
    // X/Z are untouched: only the height varies.
    assert.ok(
      samples.every((sample) => sample[0] === 10 && sample[2] === -400)
    );
  });

  it("keeps an eye out of the ground for tiny bodies", () => {
    assert.equal(lineOfSightEyeHeight(0.5), 0.5);
    assert.equal(lineOfSightEyeHeight(0.1), 0.5);
    assert.equal(Number(lineOfSightEyeHeight(1.8).toFixed(4)), 1.296);
  });
});

describe("hill combat: target retention", () => {
  const now = 1_000;

  it("refreshes the sighting whenever the target is visible", () => {
    const result = evaluateChaseTargetRetention({
      hasLineOfSight: true,
      nowSeconds: now,
    });
    assert.deepEqual(result, {
      retain: true,
      lastSeenAtSeconds: now,
      reason: "visible",
    });
  });

  it("REGRESSION: one failed ray behind a crest no longer drops the target", () => {
    // This is the aggro flicker from the HAR: crest, lose, reacquire, crest.
    const result = evaluateChaseTargetRetention({
      hasLineOfSight: false,
      nowSeconds: now,
      lastSeenAtSeconds: now - 0.4,
    });
    assert.equal(result.retain, true);
    assert.equal(result.reason, "grace");
    // The original sighting is preserved, so grace cannot be renewed forever.
    assert.equal(result.lastSeenAtSeconds, now - 0.4);
  });

  it("cannot acquire through terrain: never-seen targets drop immediately", () => {
    const result = evaluateChaseTargetRetention({
      hasLineOfSight: false,
      nowSeconds: now,
    });
    assert.equal(result.retain, false);
    assert.equal(result.reason, "never_seen");
  });

  it("hunts the last known position after grace only while it is reachable", () => {
    const afterGrace = now + CHASE_LOST_SIGHT_GRACE_SECONDS + 0.5;
    assert.equal(
      evaluateChaseTargetRetention({
        hasLineOfSight: false,
        nowSeconds: afterGrace,
        lastSeenAtSeconds: now,
        targetReachable: true,
      }).reason,
      "hunting_last_known"
    );
    assert.equal(
      evaluateChaseTargetRetention({
        hasLineOfSight: false,
        nowSeconds: afterGrace,
        lastSeenAtSeconds: now,
        targetReachable: false,
      }).retain,
      false
    );
  });

  it("gives up once both the grace and the hunt window have elapsed", () => {
    const result = evaluateChaseTargetRetention({
      hasLineOfSight: false,
      nowSeconds:
        now + CHASE_LOST_SIGHT_GRACE_SECONDS + CHASE_LOST_SIGHT_HUNT_SECONDS,
      lastSeenAtSeconds: now,
      targetReachable: true,
    });
    assert.equal(result.retain, false);
    assert.equal(result.reason, "lost_timeout");
    assert.equal(result.lastSeenAtSeconds, undefined);
  });

  it("survives clock skew rather than dropping a live fight", () => {
    assert.equal(
      evaluateChaseTargetRetention({
        hasLineOfSight: false,
        nowSeconds: now,
        lastSeenAtSeconds: now + 5,
      }).retain,
      true
    );
  });

  it("honours a milestone-extended grace window", () => {
    const bonus = 1.25;
    assert.equal(
      evaluateChaseTargetRetention({
        hasLineOfSight: false,
        nowSeconds: now + CHASE_LOST_SIGHT_GRACE_SECONDS + 0.5,
        lastSeenAtSeconds: now,
        graceSeconds: CHASE_LOST_SIGHT_GRACE_SECONDS + bonus,
      }).reason,
      "grace"
    );
  });
});
