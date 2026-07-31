// HARTHMERE_HILL_COMBAT — end-to-end fight simulation over hilly terrain.
//
// The unit suites each prove one rule. This file plays a whole fight through the
// real decision chain and asserts the OUTCOME, which is the thing the July 27
// 2026 HAR actually disagreed with: a road-pack Hex and Muckling on a slope must
// engage, cross a crest without losing the player, reach a strike plane, and
// land hits — while a second, unrelated pack twenty metres away stays out of it.
//
// It is deliberately terrain-synthetic. The browser gate
// (`HARTHMERE_E2E_HILL_COMBAT_ONLY=1`, see docs/harthmere/
// HARTHMERE_HILL_COMBAT_AND_GROUPS.md) proves the same behaviours against real
// voxels, sync, and rendering; this proves the logic in ~10 ms so a regression is
// caught before a stack boot.

import assert from "assert";

import {
  bodyVerticalGap,
  chaseApproachDecision,
  evaluateChaseTargetRetention,
  horizontalDistance,
  withinAttackReach,
  CHASE_LOST_SIGHT_GRACE_SECONDS,
} from "@/shared/npc/behavior/combat_geometry";
import {
  evaluatePathDestination,
  nearestStandingVoxel,
} from "@/shared/npc/behavior/pathfinding_geometry";
import {
  evaluateGroupAlert,
  groupResponderPlan,
  type CreatureGroupMembership,
  type GroupAlertCandidate,
} from "@/shared/npc/creature_group";
import {
  creatureLevelMultipliers,
  creatureMilestoneAbilities,
  scaleCreatureCombatStats,
} from "@/shared/npc/creature_level";
import {
  HARTHMERE_ROAD_GROUP_MONSTER_SEEDS,
  HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS,
} from "@/shared/harthmere/road_to_harthmere_groups";
import { harthmereCreatureGroupForEntity } from "@/shared/harthmere/creature_groups";
import { harthmereNativeNpcCombatProfileForSeed } from "@/shared/harthmere/harthmere_native_combat";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";

// The measured fight: player at ~[351.44, 35, -404.28], creature feet Y31..Y48
// within 45 m, player max HP 140.
const PLAYER_ID = 9001 as unknown as BiomesId;
const PLAYER_MAX_HP = 140;
const PLAYER_HEIGHT = 1.8;
const MUCKER_HEIGHT = 1.2;
const TICK_SECONDS = 0.25;

/**
 * A two-tier hillside: a lower shelf at Y35 and an upper shelf at Y38, joined by
 * a walkable ramp at X=353. Standing on the shelf edge, a creature below is
 * horizontally adjacent but three metres down — exactly the geometry that used to
 * read as out of range.
 */
function hillsideCanOccupy(position: Vec3): boolean {
  const [x, y, z] = position;
  if (z < -412 || z > -396) return false;
  if (x < 344 || x > 360) return false;
  if (x >= 355) return y >= 38 && y <= 41; // upper shelf
  if (x === 353 || x === 354) return y >= 35 && y <= 41; // ramp
  return y >= 35 && y <= 38; // lower shelf
}

interface Combatant {
  id: BiomesId;
  position: Vec3;
  height: number;
  attackRadius: number;
  attackDamage: number;
  attackIntervalSecs: number;
  runSpeed: number;
  lastSeenAtSeconds?: number;
  lastAttackAtSeconds?: number;
}

function roadPackCombatant(index: number, position: Vec3): Combatant {
  const seed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS[index];
  const profile = harthmereNativeNpcCombatProfileForSeed(seed);
  const scaled = scaleCreatureCombatStats(
    {
      maxHp: profile.maxHp,
      attackDamage: profile.attackDamage,
      attackIntervalSecs: profile.attackIntervalSecs,
      walkSpeed: profile.walkSpeed,
      runSpeed: profile.runSpeed,
      killXp: profile.killXp,
    },
    seed.progressionLevel
  );
  return {
    id: seed.entityId,
    position,
    height: MUCKER_HEIGHT,
    attackRadius: profile.attackDistance,
    attackDamage: scaled.attackDamage,
    attackIntervalSecs: scaled.attackIntervalSecs,
    runSpeed: scaled.runSpeed,
  };
}

/**
 * One Anima tick for one combatant, using the same functions the real chase tick
 * uses. Returns the damage dealt this tick and whether the target was retained.
 */
function simulateTick(input: {
  npc: Combatant;
  playerPosition: Vec3;
  hasLineOfSight: boolean;
  nowSeconds: number;
  hasPathNode: boolean;
}): { damage: number; retained: boolean; approach: string } {
  const { npc } = input;
  const retention = evaluateChaseTargetRetention({
    hasLineOfSight: input.hasLineOfSight,
    nowSeconds: input.nowSeconds,
    lastSeenAtSeconds: npc.lastSeenAtSeconds,
    targetReachable: input.hasPathNode,
  });
  npc.lastSeenAtSeconds = retention.lastSeenAtSeconds;
  if (!retention.retain) {
    return { damage: 0, retained: false, approach: "none" };
  }

  const horizontal = horizontalDistance(npc.position, input.playerPosition);
  const verticalGap = bodyVerticalGap({
    attackerFeetY: npc.position[1],
    attackerHeight: npc.height,
    targetFeetY: input.playerPosition[1],
    targetHeight: PLAYER_HEIGHT,
  });
  const approach = chaseApproachDecision({
    horizontalDistance: horizontal,
    verticalGap,
    attackRadius: npc.attackRadius,
    hasPathNode: input.hasPathNode,
  });

  if (approach !== "attack") {
    // Close along the ramp: move toward the player, climbing where the hillside
    // permits it.
    const step = npc.runSpeed * TICK_SECONDS;
    const dx = input.playerPosition[0] - npc.position[0];
    const dz = input.playerPosition[2] - npc.position[2];
    const length = Math.max(1e-6, Math.hypot(dx, dz));
    const next: Vec3 = [
      npc.position[0] + (dx / length) * step,
      npc.position[1],
      npc.position[2] + (dz / length) * step,
    ];
    const standing = nearestStandingVoxel({
      position: next,
      canOccupy: hillsideCanOccupy,
    });
    npc.position = standing
      ? [next[0], standing[1], next[2]]
      : (npc.position as Vec3);
    return { damage: 0, retained: true, approach };
  }

  const ready =
    npc.lastAttackAtSeconds === undefined ||
    input.nowSeconds - npc.lastAttackAtSeconds >= npc.attackIntervalSecs;
  if (!ready) {
    return { damage: 0, retained: true, approach };
  }
  npc.lastAttackAtSeconds = input.nowSeconds;
  return { damage: npc.attackDamage, retained: true, approach };
}

describe("hill combat E2E: a road-pack Muckling fights up a slope", () => {
  it("REGRESSION: closes, climbs, reaches a strike plane, and lands hits", () => {
    // Player on the upper shelf at Y38; Muckling starts on the lower shelf at
    // Y35, seven metres west. The old 3D range test could not open its 2.4 m
    // attack budget from below the shelf edge.
    const player: Vec3 = [357, 38, -404];
    const npc = roadPackCombatant(1, [348, 35, -404]);

    let dealt = 0;
    let attackedFrom: Vec3 | undefined;
    for (let tick = 0; tick < 80; tick += 1) {
      const now = tick * TICK_SECONDS;
      const result = simulateTick({
        npc,
        playerPosition: player,
        hasLineOfSight: true,
        nowSeconds: now,
        hasPathNode: true,
      });
      if (result.damage > 0) {
        dealt += result.damage;
        attackedFrom ??= [...npc.position] as Vec3;
      }
    }

    assert.ok(
      npc.position[1] >= 38,
      `Muckling never climbed the shelf (Y=${npc.position[1]})`
    );
    assert.ok(dealt > 0, "Muckling never landed a hit on the slope");
    assert.ok(attackedFrom, "no strike position recorded");
    assert.ok(
      withinAttackReach({
        horizontalDistance: horizontalDistance(attackedFrom!, player),
        verticalGap: bodyVerticalGap({
          attackerFeetY: attackedFrom![1],
          attackerHeight: MUCKER_HEIGHT,
          targetFeetY: player[1],
          targetHeight: PLAYER_HEIGHT,
        }),
        attackRadius: npc.attackRadius,
      }),
      "strike landed from outside the reach envelope"
    );
  });

  it("cannot reach a player three metres up with no route", () => {
    // The safety corollary: the horizontal split must not become a licence to hit
    // through a shelf. Standing directly below the edge with no path, the correct
    // behaviour is to reposition, never to strike.
    const player: Vec3 = [357, 38, -404];
    const npc = roadPackCombatant(1, [356.5, 35, -404]);
    const result = simulateTick({
      npc,
      playerPosition: player,
      hasLineOfSight: true,
      nowSeconds: 0,
      hasPathNode: false,
    });
    assert.equal(result.damage, 0);
    assert.equal(result.approach, "reposition");
  });
});

describe("hill combat E2E: crossing a crest", () => {
  it("REGRESSION: keeps the target through a brief crest occlusion", () => {
    // A Muckling at ~4.5 m/s is hidden by a one-block crest for well under a
    // second. The old rule dropped the target on the first failed ray, producing
    // the aggro flicker that reads as "they can't find me".
    const player: Vec3 = [357, 38, -404];
    const npc = roadPackCombatant(1, [349, 35, -404]);
    const occludedTicks = new Set([6, 7, 8]); // ~0.75 s behind the crest

    let everLost = false;
    for (let tick = 0; tick < 40; tick += 1) {
      const result = simulateTick({
        npc,
        playerPosition: player,
        hasLineOfSight: !occludedTicks.has(tick),
        nowSeconds: tick * TICK_SECONDS,
        hasPathNode: true,
      });
      if (!result.retained) everLost = true;
    }
    assert.equal(everLost, false, "target was dropped behind the crest");
  });

  it("still disengages from a player who genuinely escapes and cannot be reached", () => {
    const npc = roadPackCombatant(1, [349, 35, -404]);
    npc.lastSeenAtSeconds = 0;
    const wellPastGrace = CHASE_LOST_SIGHT_GRACE_SECONDS + 1;
    const result = evaluateChaseTargetRetention({
      hasLineOfSight: false,
      nowSeconds: wellPastGrace,
      lastSeenAtSeconds: npc.lastSeenAtSeconds,
      targetReachable: false,
    });
    assert.equal(result.retain, false);
    assert.equal(result.reason, "lost_unreachable");
  });
});

describe("hill combat E2E: group assistance across a hill", () => {
  const now = 100;
  const attacker = {
    position: [357, 38, -404] as Vec3,
    hp: PLAYER_MAX_HP,
    isPlayer: true,
    canBeTargeted: true,
  };

  function membershipFor(seedIndex: number): CreatureGroupMembership {
    return harthmereCreatureGroupForEntity(
      HARTHMERE_ROAD_GROUP_MONSTER_SEEDS[seedIndex].entityId
    )!;
  }

  function damagedMate(seedIndex: number, position: Vec3): GroupAlertCandidate {
    return {
      id: HARTHMERE_ROAD_GROUP_MONSTER_SEEDS[seedIndex].entityId,
      position,
      membership: membershipFor(seedIndex),
      lastDamageSource: { kind: "attack", attacker: PLAYER_ID },
      lastDamageTimeSeconds: now - 1,
      lastDamageAmount: -55,
      alive: true,
    };
  }

  it("REGRESSION: a pack-mate on the far side of a crest still answers the alert", () => {
    // Group 1's members are authored together, so a three-metre shelf between
    // them is not evidence of anything. The old proximity+LOS rule suppressed
    // exactly this case.
    const alert = evaluateGroupAlert({
      recipientId: HARTHMERE_ROAD_GROUP_MONSTER_SEEDS[0].entityId,
      recipientPosition: [349, 35, -404],
      recipientMembership: membershipFor(0),
      candidates: [damagedMate(1, [357, 38, -403])],
      lookupAttacker: (id) => (id === PLAYER_ID ? attacker : undefined),
      nowSeconds: now,
      memorySeconds: 30,
      deAggroDistanceSq: 34 * 34,
    });
    assert.equal(alert?.attackerId, PLAYER_ID);
  });

  it("REGRESSION: the neighbouring road group does not join the fight", () => {
    // Group 2 is a separate encounter. Under the old proximity+name inference,
    // any Mucker inside 18 m joined regardless of which pack it belonged to.
    const groupTwoSeedIndex = 6; // first monster of the second road group
    assert.notEqual(
      membershipFor(groupTwoSeedIndex).groupId,
      membershipFor(0).groupId
    );
    const alert = evaluateGroupAlert({
      recipientId:
        HARTHMERE_ROAD_GROUP_MONSTER_SEEDS[groupTwoSeedIndex].entityId,
      recipientPosition: [349, 35, -404],
      recipientMembership: membershipFor(groupTwoSeedIndex),
      candidates: [damagedMate(1, [350, 35, -404])],
      lookupAttacker: (id) => (id === PLAYER_ID ? attacker : undefined),
      nowSeconds: now,
      memorySeconds: 30,
      deAggroDistanceSq: 34 * 34,
    });
    assert.equal(alert, undefined);
  });

  it("rotates the pack into melee instead of alpha-striking the player", () => {
    // Group 4 is the hardest pack on the road: level 9. Six monsters connecting
    // at once would be an unavoidable kill on a 140 HP player.
    const anchor = HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS[3];
    const monsters = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.filter(
      (seed) => seed.groupId === anchor.groupId
    );
    const plan = groupResponderPlan({
      members: monsters.map((seed, index) => {
        const membership = harthmereCreatureGroupForEntity(seed.entityId)!;
        return {
          id: seed.entityId,
          role: membership.role,
          memberIndex: membership.memberIndex,
          distanceToAttacker: 3 + index,
          alive: true,
        };
      }),
    });

    const engaging = plan.filter((entry) => entry.mode !== "hold");
    const scaledDamage = scaleCreatureCombatStats(
      {
        maxHp: 550,
        attackDamage: 80,
        attackIntervalSecs: 1.9,
        walkSpeed: 2.2,
        runSpeed: 4.4,
        killXp: 65,
      },
      anchor.level
    ).attackDamage;

    assert.ok(engaging.length <= 3, "too many simultaneous melee attackers");
    assert.ok(
      engaging.length * scaledDamage >= PLAYER_MAX_HP,
      "the level 9 pack should still be genuinely dangerous"
    );
    // Ranged and melee responders share the same hard concurrency cap. A Hex
    // may own a flank slot when it ranks inside that cap, but cannot bypass it.
    assert.ok(plan.filter((entry) => entry.mode === "flank").length <= 2);
    // And the overflow waits for a slot rather than joining after a timer while
    // the original responders are still alive.
    const holds = plan.filter((entry) => entry.mode === "hold");
    assert.ok(
      holds.every(
        (entry) => entry.engageDelaySeconds === Number.POSITIVE_INFINITY
      )
    );
  });
});

describe("hill combat E2E: the level ramp is felt, not just stored", () => {
  it("makes each successive road group measurably harder without breaking the caps", () => {
    const profiles = HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.map((anchor) => {
      const seed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.find(
        (candidate) =>
          candidate.groupId === anchor.groupId && candidate.combatKind === "hex"
      )!;
      const base = harthmereNativeNpcCombatProfileForSeed(seed);
      return scaleCreatureCombatStats(
        {
          maxHp: base.maxHp,
          attackDamage: base.attackDamage,
          attackIntervalSecs: base.attackIntervalSecs,
          walkSpeed: base.walkSpeed,
          runSpeed: base.runSpeed,
          killXp: base.killXp,
        },
        anchor.level
      );
    });

    for (let i = 1; i < profiles.length; i += 1) {
      assert.ok(profiles[i].maxHp > profiles[i - 1].maxHp, "HP must ramp");
      assert.ok(
        profiles[i].attackDamage > profiles[i - 1].attackDamage,
        "damage must ramp"
      );
      assert.ok(
        profiles[i].killXp > profiles[i - 1].killXp,
        "reward must ramp with risk"
      );
    }

    // No single hit may kill a full-health player outright, at any road level.
    for (const profile of profiles) {
      assert.ok(
        profile.attackDamage < PLAYER_MAX_HP,
        `a single hit of ${profile.attackDamage} would one-shot a 140 HP player`
      );
    }

    // Speed stays inside the cap, so the hardest pack still cannot outrun a sprint.
    const speedCap = creatureLevelMultipliers(9).speed;
    assert.ok(speedCap <= 1.12);
  });

  it("unlocks retention as an AI milestone rather than a bigger number", () => {
    assert.equal(creatureMilestoneAbilities(3).targetRetentionBonusSeconds, 0);
    assert.ok(creatureMilestoneAbilities(9).targetRetentionBonusSeconds > 0);
  });
});

describe("hill combat E2E: pathfinding under a moving target", () => {
  it("does not rebuild a full route on every tick of a sprint", () => {
    // A player sprinting at ~8 m/s covers 2 m per 0.25 s tick. Under the old
    // 3 m drift rule that is a fresh A* almost every tick, for every pursuer.
    // Mirrors the real caller: `searchDestination` is where A* actually routed
    // to, and only a rebuild moves it. Repairs move the tail only.
    let lastSearchAt: number | undefined = 0;
    let searchDestination: Vec3 = [357, 38, -404];
    let destination: Vec3 | undefined = [357, 38, -404];
    let rebuilds = 0;
    let repairs = 0;
    const ticks = 20;
    for (let tick = 1; tick <= ticks; tick += 1) {
      const now = tick * TICK_SECONDS;
      const target: Vec3 = [357 + tick * 2, 38, -404];
      const decision = evaluatePathDestination({
        destination,
        searchDestination,
        targetPosition: target,
        maxDriftMeters: 3,
        nowSeconds: now,
        lastSearchAtSeconds: lastSearchAt,
      });
      if (decision.kind === "rebuild") {
        rebuilds += 1;
        lastSearchAt = now;
        searchDestination = [target[0], target[1], target[2]];
        destination = [target[0], target[1], target[2]];
      } else if (decision.kind === "repair") {
        repairs += 1;
        destination = decision.destination;
      }
    }

    assert.ok(rebuilds >= 1, "the route must still track a fleeing player");
    assert.ok(rebuilds < ticks, "a rebuild on every tick is the old behaviour");
    assert.ok(repairs > 0, "cheap tail repairs should absorb small drift");
    // REGRESSION: repairs must not compound. Measuring drift from the last
    // REPAIR instead of the last SEARCH let the tail follow the player forever
    // while the route behind it still led forty metres away.
    assert.ok(
      Math.abs(searchDestination[0] - destination![0]) <= 3,
      "a repaired tail drifted beyond its own searched route"
    );
  });
});
