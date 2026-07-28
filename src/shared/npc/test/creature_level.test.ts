// HARTHMERE_CREATURE_LEVELING — per-entity progression contracts.
//
// The two properties that matter most are asserted first: level 1 is exactly
// inert (so an existing world is unchanged), and the balance caps hold against
// the measured native numbers (level 3 Hex ~90 damage into a 140 HP player).

import assert from "assert";

import {
  CREATURE_BASE_PROFILE_VERSION,
  CREATURE_LEVEL_SCALING,
  CREATURE_MAX_LEVEL,
  CREATURE_MILESTONE_LEVELS,
  CREATURE_MIN_LEVEL,
  applyCreatureLevelResistance,
  assignCreatureLevel,
  awardCreatureXp,
  buildCreatureProgression,
  creatureLevelMultipliers,
  creatureMilestoneAbilities,
  creatureXpForNextLevel,
  describeCreatureLevel,
  normalizeCreatureLevel,
  readCreatureProgression,
  scaleCreatureCombatStats,
  type ScalableCreatureCombatStats,
} from "@/shared/npc/creature_level";
import type { BiomesId } from "@/shared/ids";

// A production Watchtower Mucker's shared-type baseline.
const MUCKER_BASE: ScalableCreatureCombatStats = {
  maxHp: 550,
  attackDamage: 80,
  attackIntervalSecs: 1.9,
  walkSpeed: 2.2,
  runSpeed: 4.4,
  killXp: 65,
};

describe("creature leveling: the migration is inert", () => {
  it("level 1 multiplies every stat by exactly one", () => {
    const multipliers = creatureLevelMultipliers(1);
    assert.deepEqual(multipliers, {
      hp: 1,
      damage: 1,
      speed: 1,
      attackInterval: 1,
      xp: 1,
      dropBonus: 0,
    });
  });

  it("REGRESSION: an existing creature keeps its authored stats byte for byte", () => {
    // Reinterpreting today's `combatLevel: 4` Hexes as NEW level 4 would buff the
    // whole world a second time, because production HP and damage already encode
    // that tier. Migration must be a no-op.
    assert.deepEqual(scaleCreatureCombatStats(MUCKER_BASE, 1), MUCKER_BASE);
  });

  it("defaults absent progression to level 1 migration", () => {
    assert.deepEqual(readCreatureProgression(undefined), {
      level: 1,
      baseProfileVersion: CREATURE_BASE_PROFILE_VERSION,
      levelSource: "migration",
      xp: 0,
    });
    assert.deepEqual(buildCreatureProgression({ migrate: true }), {
      level: 1,
      baseProfileVersion: CREATURE_BASE_PROFILE_VERSION,
      levelSource: "migration",
      xp: 0,
    });
  });

  it("clamps malformed levels rather than propagating them", () => {
    assert.equal(normalizeCreatureLevel(undefined), CREATURE_MIN_LEVEL);
    assert.equal(normalizeCreatureLevel(Number.NaN), CREATURE_MIN_LEVEL);
    assert.equal(normalizeCreatureLevel(-5), CREATURE_MIN_LEVEL);
    assert.equal(normalizeCreatureLevel(9_999), CREATURE_MAX_LEVEL);
    assert.equal(normalizeCreatureLevel(7.9), 7);
  });
});

describe("creature leveling: scaling curve and balance caps", () => {
  it("scales HP fastest, so a higher level means more time to kill", () => {
    const level10 = creatureLevelMultipliers(10);
    assert.ok(level10.hp > level10.damage);
    assert.equal(
      Number(level10.hp.toFixed(4)),
      Number((1 + CREATURE_LEVEL_SCALING.hpPerLevel * 9).toFixed(4))
    );
  });

  it("keeps damage growth slow because native attacks are already near-lethal", () => {
    // A level 3 Hex deals ~90 into a 140 HP player. At the +7%/level rate it
    // takes level 9 to reach a two-hit kill from a base 80 hit, and the level
    // ramp on the road tops out there deliberately.
    const damageAtNine = scaleCreatureCombatStats(MUCKER_BASE, 9).attackDamage;
    assert.equal(damageAtNine, 125);
    assert.ok(damageAtNine * 2 > 140, "two hits should threaten a 140 HP player");
    assert.ok(damageAtNine < 140, "one hit must never be a full kill");
  });

  it("hard caps movement so a creature can never outrun a sprinting player", () => {
    assert.equal(
      creatureLevelMultipliers(CREATURE_MAX_LEVEL).speed,
      CREATURE_LEVEL_SCALING.maxSpeedMultiplier
    );
    const fastest = scaleCreatureCombatStats(MUCKER_BASE, CREATURE_MAX_LEVEL);
    assert.ok(fastest.runSpeed <= MUCKER_BASE.runSpeed * 1.12 + 1e-9);
  });

  it("improves attack cadence only at milestones, and never past the floor", () => {
    assert.equal(creatureLevelMultipliers(9).attackInterval, 1);
    assert.ok(creatureLevelMultipliers(10).attackInterval < 1);
    assert.ok(
      creatureLevelMultipliers(CREATURE_MAX_LEVEL).attackInterval >=
        CREATURE_LEVEL_SCALING.minAttackIntervalMultiplier
    );
  });

  it("caps XP and drop growth so a high-level pack is not exponential value", () => {
    assert.equal(
      creatureLevelMultipliers(CREATURE_MAX_LEVEL).xp,
      CREATURE_LEVEL_SCALING.maxXpMultiplier
    );
    assert.equal(
      creatureLevelMultipliers(CREATURE_MAX_LEVEL).dropBonus,
      CREATURE_LEVEL_SCALING.maxDropBonus
    );
  });

  it("never scales a zero-damage creature into an attacker", () => {
    // Robot sentinels have attackDamage 0 and must stay harmless at every level.
    const sentinel = scaleCreatureCombatStats(
      { ...MUCKER_BASE, attackDamage: 0 },
      30
    );
    assert.equal(sentinel.attackDamage, 0);
  });

  it("keeps a swing from collapsing to an unreadable interval", () => {
    const fast = scaleCreatureCombatStats(
      { ...MUCKER_BASE, attackIntervalSecs: 0.45 },
      CREATURE_MAX_LEVEL
    );
    assert.ok(fast.attackIntervalSecs >= 0.4);
  });
});

describe("creature leveling: milestones are AI, not numbers", () => {
  it("grants nothing below the first milestone", () => {
    assert.deepEqual(creatureMilestoneAbilities(4), {
      targetRetentionBonusSeconds: 0,
      coordinated: false,
      resistance: 0,
      specialMove: false,
    });
  });

  it("extends lost-sight retention at the retention milestone", () => {
    assert.ok(
      creatureMilestoneAbilities(CREATURE_MILESTONE_LEVELS.targetRetention)
        .targetRetentionBonusSeconds > 0
    );
  });

  it("unlocks coordination, resistance, and a special move in order", () => {
    assert.equal(
      creatureMilestoneAbilities(CREATURE_MILESTONE_LEVELS.coordinated)
        .coordinated,
      true
    );
    assert.ok(
      creatureMilestoneAbilities(CREATURE_MILESTONE_LEVELS.resistance)
        .resistance > 0
    );
    assert.equal(
      creatureMilestoneAbilities(CREATURE_MILESTONE_LEVELS.specialMove)
        .specialMove,
      true
    );
  });

  it("applies resistance only above its milestone and never zeroes a hit", () => {
    assert.equal(applyCreatureLevelResistance(100, 1), 100);
    assert.equal(
      applyCreatureLevelResistance(100, CREATURE_MILESTONE_LEVELS.resistance),
      90
    );
    assert.equal(
      applyCreatureLevelResistance(1, CREATURE_MILESTONE_LEVELS.resistance),
      1
    );
  });
});

describe("creature leveling: assignment is separate from scaling", () => {
  it("prefers an authored level over a region tier", () => {
    assert.deepEqual(
      assignCreatureLevel({ authoredLevel: 9, regionTierLevel: 2 }),
      { level: 9, levelSource: "authored" }
    );
  });

  it("falls back to the region tier, then to migration", () => {
    assert.deepEqual(assignCreatureLevel({ regionTierLevel: 4 }), {
      level: 4,
      levelSource: "region_tier",
    });
    assert.deepEqual(assignCreatureLevel({}), {
      level: 1,
      levelSource: "migration",
    });
  });

  it("marks XP-earning companions distinctly", () => {
    assert.equal(
      assignCreatureLevel({ earnsXp: true, authoredLevel: 3 }).levelSource,
      "earned"
    );
  });
});

describe("creature leveling: earned progression", () => {
  const earned = buildCreatureProgression({
    assignment: { level: 1, levelSource: "earned" },
  });

  it("banks XP and levels an earning creature", () => {
    const after = awardCreatureXp(earned, creatureXpForNextLevel(1));
    assert.equal(after.level, 2);
    assert.equal(after.xp, 0);
  });

  it("carries the remainder across a level boundary", () => {
    const after = awardCreatureXp(earned, creatureXpForNextLevel(1) + 5);
    assert.equal(after.level, 2);
    assert.equal(after.xp, 5);
  });

  it("REGRESSION: refuses to bank XP a fixed-level creature can never spend", () => {
    // Ambient and authored creatures have a designed level. Silently accumulating
    // XP on them would be state that looks meaningful and is not.
    const ambient = buildCreatureProgression({ migrate: true });
    assert.deepEqual(awardCreatureXp(ambient, 10_000), ambient);
  });

  it("stops at the level cap instead of looping", () => {
    const capped = awardCreatureXp(
      { ...earned, level: CREATURE_MAX_LEVEL },
      10_000_000
    );
    assert.equal(capped.level, CREATURE_MAX_LEVEL);
  });

  it("requires more XP for each successive level", () => {
    assert.ok(creatureXpForNextLevel(5) > creatureXpForNextLevel(1));
    assert.ok(creatureXpForNextLevel(20) > creatureXpForNextLevel(5));
  });
});

describe("creature leveling: diagnostics", () => {
  it("names an entity's tier for telemetry", () => {
    assert.equal(
      describeCreatureLevel(
        1234 as BiomesId,
        buildCreatureProgression({
          assignment: { level: 7, levelSource: "authored" },
        })
      ),
      "1234@L7(authored)"
    );
  });
});
