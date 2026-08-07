// HARTHMERE_ESCORT — follow, formation, combat policy, and recovery contracts.
//
// The audit's finding was blunt: the committed jobs-board escort could follow but
// could NOT fight, because its reconstructed snapshot hard-coded
// `isAttackable: false`, `combatProtection: "friendly_noncombatant"`,
// `retaliatesWhenAttacked: false`, and `aggroRange: 0`, and the reducer suppressed
// attacks whenever `escortJobId` was set. Combat capability is now a policy, and
// restricting targets is as much a part of it as enabling them.

import assert from "assert";

import {
  ESCORT_ARRIVE_RADIUS,
  ESCORT_CATCH_UP_RUN_SPEED_MULTIPLIER,
  ESCORT_CLOSE_FAST_RUN_SPEED_MULTIPLIER,
  ESCORT_DEFAULT_FOLLOW_DISTANCE,
  ESCORT_DEFAULT_LEASH_DISTANCE,
  ESCORT_DEFEND_RADIUS,
  ESCORT_DESTINATION_ARRIVE_RADIUS,
  ESCORT_FOLLOW_RUN_SPEED_MULTIPLIER,
  ESCORT_HARD_WARP_LEASH_MULTIPLIER,
  ESCORT_PROGRESS_DISTANCE_METERS,
  ESCORT_STUCK_GRACE_SECONDS,
  ESCORT_WARP_PATH_FAILURE_SECONDS,
  buildEscortState,
  escortFormationAnchor,
  escortLocomotionDecision,
  escortPathProgress,
  escortShouldWarp,
  escortStatusFor,
  evaluateEscortCombatTarget,
  type EscortHostileCandidate,
} from "@/shared/npc/behavior/escort";
import type { BiomesId } from "@/shared/ids";

const id = (value: number) => value as unknown as BiomesId;
const LEADER = id(500);

function hostile(
  overrides: Partial<EscortHostileCandidate> = {}
): EscortHostileCandidate {
  return {
    id: id(1),
    isMuck: true,
    hostile: true,
    alive: true,
    attackingLeader: false,
    attackingEscort: false,
    distanceToEscort: 5,
    distanceToLeader: 5,
    ...overrides,
  };
}

describe("escort: formation", () => {
  it("stands behind the leader in slot 0", () => {
    // Leader yaw 0 faces -Z, so "behind" is +Z.
    const anchor = escortFormationAnchor({
      leaderPosition: [10, 35, -400],
      leaderYawRadians: 0,
      followDistance: 3,
      formationSlot: 0,
    });
    assert.equal(Number(anchor[0].toFixed(4)), 10);
    assert.equal(Number(anchor[2].toFixed(4)), -397);
  });

  it("copies the leader's Y so Anima's ground physics settle the escort", () => {
    // The old scheduler wrote positions straight into ECS with no terrain
    // grounding, which floats or buries a companion on hills.
    assert.equal(
      escortFormationAnchor({
        leaderPosition: [0, 71, 0],
        leaderYawRadians: 1.1,
        followDistance: 3,
        formationSlot: 2,
      })[1],
      71
    );
  });

  it("fans distinct slots apart so a party does not stack in one voxel", () => {
    const anchors = [0, 1, 2, 3].map((slot) =>
      escortFormationAnchor({
        leaderPosition: [0, 0, 0],
        leaderYawRadians: 0,
        followDistance: 3,
        formationSlot: slot,
      })
    );
    const keys = new Set(anchors.map((anchor) => anchor.join(",")));
    assert.equal(keys.size, anchors.length);
  });

  it("rotates the whole formation with the leader", () => {
    const facingPlusX = escortFormationAnchor({
      leaderPosition: [0, 0, 0],
      leaderYawRadians: -Math.PI / 2,
      followDistance: 4,
      formationSlot: 0,
    });
    assert.equal(Number(facingPlusX[0].toFixed(4)), -4);
    assert.equal(Number(facingPlusX[2].toFixed(4)), 0);
  });

  it("wraps an out-of-range slot instead of producing NaN", () => {
    const anchor = escortFormationAnchor({
      leaderPosition: [0, 0, 0],
      leaderYawRadians: 0,
      followDistance: 3,
      formationSlot: 99,
    });
    assert.ok(anchor.every((value) => Number.isFinite(value)));
  });
});

describe("escort: follow pacing", () => {
  const base = {
    distanceToLeader: 4,
    leashDistance: ESCORT_DEFAULT_LEASH_DISTANCE,
  };

  it("holds station inside the slot", () => {
    assert.deepEqual(
      escortLocomotionDecision({ ...base, distanceToFormationAnchor: 0.5 }),
      { action: "hold", runSpeedMultiplier: 0 }
    );
  });

  it("runs while closing small gaps so it never drops into a walk animation", () => {
    const decision = escortLocomotionDecision({
      ...base,
      distanceToFormationAnchor: ESCORT_ARRIVE_RADIUS + 0.5,
    });
    assert.deepEqual(decision, {
      action: "follow",
      runSpeedMultiplier: ESCORT_FOLLOW_RUN_SPEED_MULTIPLIER,
    });
  });

  it("accelerates above authored run speed once out of formation", () => {
    assert.deepEqual(
      escortLocomotionDecision({ ...base, distanceToFormationAnchor: 12 }),
      {
        action: "close_fast",
        runSpeedMultiplier: ESCORT_CLOSE_FAST_RUN_SPEED_MULTIPLIER,
      }
    );
  });

  it("switches to near-player-sprint catch-up past the leash", () => {
    assert.deepEqual(
      escortLocomotionDecision({
        ...base,
        distanceToLeader: ESCORT_DEFAULT_LEASH_DISTANCE + 1,
        distanceToFormationAnchor: 60,
      }),
      {
        action: "catch_up",
        runSpeedMultiplier: ESCORT_CATCH_UP_RUN_SPEED_MULTIPLIER,
      }
    );
    assert.ok(
      ESCORT_CATCH_UP_RUN_SPEED_MULTIPLIER > 2,
      "catch-up pace must exceed player sprint after terrain/collision losses"
    );
  });

  it("stops on arrival at the destination, which the leash cannot override", () => {
    assert.deepEqual(
      escortLocomotionDecision({
        ...base,
        distanceToFormationAnchor: 40,
        destinationDistance: ESCORT_DESTINATION_ARRIVE_RADIUS - 0.1,
      }),
      { action: "arrived", runSpeedMultiplier: 0 }
    );
  });
});

describe("escort: combat policy", () => {
  it("REGRESSION: a noncombatant escort never acquires a target", () => {
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "noncombatant",
        candidates: [hostile({ attackingEscort: true, attackingLeader: true })],
      }),
      undefined
    );
  });

  it("defend_self fights only what is hitting the escort", () => {
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "defend_self",
        candidates: [hostile({ id: id(2), attackingEscort: true })],
      }),
      id(2)
    );
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "defend_self",
        candidates: [hostile({ id: id(3), attackingLeader: true })],
      }),
      undefined
    );
  });

  it("defend_leader additionally fights what is hitting the player", () => {
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "defend_leader",
        candidates: [hostile({ id: id(4), attackingLeader: true })],
      }),
      id(4)
    );
  });

  it("fight_muck engages hostile Muck near the leader — the capability the audit found missing", () => {
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "fight_muck",
        candidates: [
          hostile({ id: id(5), distanceToLeader: ESCORT_DEFEND_RADIUS - 1 }),
        ],
      }),
      id(5)
    );
  });

  it("fight_muck ignores Muck outside the defend radius, so it never wanders off", () => {
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "fight_muck",
        candidates: [
          hostile({ id: id(6), distanceToLeader: ESCORT_DEFEND_RADIUS + 5 }),
        ],
      }),
      undefined
    );
  });

  it("never attacks livestock or civilians, at any policy", () => {
    // An escort that can hit a grazing cow or a townsperson is a griefing tool.
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "fight_muck",
        candidates: [
          hostile({
            id: id(7),
            isMuck: false,
            hostile: false,
            distanceToLeader: 1,
          }),
        ],
      }),
      undefined
    );
  });

  it("prioritises self-defence over defending the leader", () => {
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "fight_muck",
        candidates: [
          hostile({ id: id(8), attackingLeader: true, distanceToEscort: 2 }),
          hostile({ id: id(9), attackingEscort: true, distanceToEscort: 9 }),
        ],
      }),
      id(9)
    );
  });

  it("ignores corpses", () => {
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "fight_muck",
        candidates: [
          hostile({ id: id(10), alive: false, distanceToLeader: 1 }),
        ],
      }),
      undefined
    );
  });

  it("breaks ties on the lowest id so two escorts agree", () => {
    assert.equal(
      evaluateEscortCombatTarget({
        policy: "defend_leader",
        candidates: [
          hostile({ id: id(21), attackingLeader: true, distanceToEscort: 4 }),
          hostile({ id: id(20), attackingLeader: true, distanceToEscort: 4 }),
        ],
      }),
      id(20)
    );
  });
});

describe("escort: recovery", () => {
  const NOW = 500;

  it("REGRESSION: never warps merely because it is slow", () => {
    // The committed escort's 5,000 m leash was the absence of a catch-up policy.
    // A warp must require BOTH a broken leash and sustained navigation failure.
    assert.equal(
      escortShouldWarp({
        distanceToLeader:
          ESCORT_DEFAULT_LEASH_DISTANCE *
          (ESCORT_HARD_WARP_LEASH_MULTIPLIER - 1),
        leashDistance: ESCORT_DEFAULT_LEASH_DISTANCE,
        pathFailingSinceSeconds: undefined,
        nowSeconds: NOW,
        inCombat: false,
      }),
      false
    );
  });

  it("warps after sustained path failure beyond the leash", () => {
    assert.equal(
      escortShouldWarp({
        distanceToLeader: 200,
        leashDistance: ESCORT_DEFAULT_LEASH_DISTANCE,
        pathFailingSinceSeconds: NOW - ESCORT_WARP_PATH_FAILURE_SECONDS,
        nowSeconds: NOW,
        inCombat: false,
      }),
      true
    );
  });

  it("warps at extreme separation even while path progress is still being reported", () => {
    assert.equal(
      escortShouldWarp({
        distanceToLeader:
          ESCORT_DEFAULT_LEASH_DISTANCE * ESCORT_HARD_WARP_LEASH_MULTIPLIER,
        leashDistance: ESCORT_DEFAULT_LEASH_DISTANCE,
        pathFailingSinceSeconds: undefined,
        nowSeconds: NOW,
        inCombat: false,
      }),
      true
    );
  });

  it("never warps inside the leash", () => {
    assert.equal(
      escortShouldWarp({
        distanceToLeader: 5,
        leashDistance: ESCORT_DEFAULT_LEASH_DISTANCE,
        pathFailingSinceSeconds: NOW - 100,
        nowSeconds: NOW,
        inCombat: false,
      }),
      false
    );
  });

  it("never warps out of a fight it was assigned to", () => {
    assert.equal(
      escortShouldWarp({
        distanceToLeader: 200,
        leashDistance: ESCORT_DEFAULT_LEASH_DISTANCE,
        pathFailingSinceSeconds: NOW - 100,
        nowSeconds: NOW,
        inCombat: true,
      }),
      false
    );
  });

  it("REGRESSION: being outside the leash is not itself path failure", () => {
    const first = escortPathProgress({
      catchingUp: true,
      position: [0, 35, 0],
      nowSeconds: NOW,
    });
    const moving = escortPathProgress({
      catchingUp: true,
      position: [ESCORT_PROGRESS_DISTANCE_METERS, 35, 0],
      nowSeconds: NOW + ESCORT_STUCK_GRACE_SECONDS + 1,
      ...first,
    });
    assert.equal(moving.pathFailingSinceSeconds, undefined);
    assert.equal(
      moving.lastProgressAtSeconds,
      NOW + ESCORT_STUCK_GRACE_SECONDS + 1
    );
  });

  it("marks failure only after sustained lack of movement", () => {
    const first = escortPathProgress({
      catchingUp: true,
      position: [0, 35, 0],
      nowSeconds: NOW,
    });
    const stuck = escortPathProgress({
      catchingUp: true,
      position: [0.1, 35, 0.1],
      nowSeconds: NOW + ESCORT_STUCK_GRACE_SECONDS,
      ...first,
    });
    assert.equal(
      stuck.pathFailingSinceSeconds,
      NOW + ESCORT_STUCK_GRACE_SECONDS
    );
  });

  it("marks sideways obstacle movement as failure when the leader gap does not close", () => {
    const first = escortPathProgress({
      catchingUp: true,
      position: [0, 35, 0],
      distanceToLeader: 40,
      nowSeconds: NOW,
    });
    const blocked = escortPathProgress({
      catchingUp: true,
      position: [3, 35, 0],
      distanceToLeader: 41,
      nowSeconds: NOW + ESCORT_STUCK_GRACE_SECONDS,
      ...first,
    });
    assert.equal(
      blocked.pathFailingSinceSeconds,
      NOW + ESCORT_STUCK_GRACE_SECONDS
    );
  });
});

describe("escort: status and defaults", () => {
  it("reports fighting above every locomotion state", () => {
    assert.equal(
      escortStatusFor({
        hasCombatTarget: true,
        alive: true,
        action: "catch_up",
      }),
      "fighting"
    );
  });

  it("reports down when the escort dies", () => {
    assert.equal(
      escortStatusFor({
        hasCombatTarget: true,
        alive: false,
        action: "follow",
      }),
      "down"
    );
  });

  it("maps locomotion to arrived / catching_up / following", () => {
    const alive = { hasCombatTarget: false, alive: true } as const;
    assert.equal(escortStatusFor({ ...alive, action: "arrived" }), "arrived");
    assert.equal(
      escortStatusFor({ ...alive, action: "catch_up" }),
      "catching_up"
    );
    assert.equal(escortStatusFor({ ...alive, action: "hold" }), "following");
  });

  it("defaults a new assignment to a safe, noncombatant escort", () => {
    const state = buildEscortState({ leaderId: LEADER });
    assert.equal(state.combatPolicy, "noncombatant");
    assert.equal(state.status, "following");
    assert.equal(state.followDistance, ESCORT_DEFAULT_FOLLOW_DISTANCE);
    assert.equal(state.leashDistance, ESCORT_DEFAULT_LEASH_DISTANCE);
    assert.equal(state.formationSlot, 0);
  });

  it("clamps nonsense follow and leash values", () => {
    const state = buildEscortState({
      leaderId: LEADER,
      followDistance: -4,
      leashDistance: 0,
      formationSlot: -2,
    });
    assert.ok(state.followDistance > 0);
    assert.ok(state.leashDistance >= 4);
    assert.equal(state.formationSlot, 0);
  });

  it("copies the destination rather than aliasing the caller's array", () => {
    const destination: [number, number, number] = [1, 2, 3];
    const state = buildEscortState({ leaderId: LEADER, destination });
    destination[0] = 99;
    assert.deepEqual(state.destination, [1, 2, 3]);
  });
});
