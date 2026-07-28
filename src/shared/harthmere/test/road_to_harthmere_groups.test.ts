// HARTHMERE_ROAD_TO_HARTHMERE_GROUPS — composition, placement, and identity.
//
// These assert against the REAL seed set, not a fixture, so a future edit to the
// road anchors, the muck territories, the safe areas, or the id bands fails here
// rather than in a browser.

import assert from "assert";

import {
  HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION,
  HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS,
  HARTHMERE_ROAD_GROUP_ANIMAL_TERRAIN_FEET_Y,
  HARTHMERE_ROAD_GROUP_MONSTER_COMPOSITION,
  HARTHMERE_ROAD_GROUP_MONSTER_SEEDS,
  HARTHMERE_ROAD_GROUP_MONSTER_TERRAIN_FEET_Y,
  HARTHMERE_ROAD_GROUP_SEEDS,
  HARTHMERE_ROAD_GROUP_TERRAIN_SAMPLE,
  HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS,
  ROAD_GROUP_FOOTPRINT_RADIUS,
  ROAD_GROUP_HEX_COMBAT_LEVEL,
  ROAD_GROUP_HEX_NAME,
  ROAD_GROUP_LEASH_RADIUS,
  ROAD_GROUP_MUCKLING_COMBAT_LEVEL,
  ROAD_GROUP_MUCKLING_NAME,
  ROAD_GROUP_SHOULDER_OFFSET,
  isHarthmereRoadGroupAreaId,
  roadGroupCenter,
} from "@/shared/harthmere/road_to_harthmere_groups";
import {
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereOpenWildsMixedGroupPositionIsValid,
  validateHarthmereLiveEntityProductionSeeds,
} from "@/shared/harthmere/live_entity_production_seed";
import {
  harthmereCreatureGroupForEntity,
  harthmereCreatureGroupMembers,
  validateHarthmereCreatureGroups,
} from "@/shared/harthmere/creature_groups";
import {
  harthmereNativeNpcCombatProfileForSeed,
  harthmereNativeNpcTypeKeyForSeed,
} from "@/shared/harthmere/harthmere_native_combat";
import { HARTHMERE_NATIVE_NPC_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import { HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X } from "@/shared/harthmere/world_extension";
import { scaleCreatureCombatStats } from "@/shared/npc/creature_level";

const GROUP_COUNT = 4;
const MONSTERS_PER_GROUP = 6;
const ANIMALS_PER_GROUP = 7;
const MEMBERS_PER_GROUP = MONSTERS_PER_GROUP + ANIMALS_PER_GROUP;

describe("road to Harthmere groups: composition", () => {
  it("ships exactly four groups", () => {
    assert.equal(HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.length, GROUP_COUNT);
  });

  it("each group is 2 Hexes, 4 Mucklings, 1 cow, 2 sheep, and 4 rabbits", () => {
    assert.equal(
      HARTHMERE_ROAD_GROUP_MONSTER_COMPOSITION.filter((k) => k === "hex").length,
      2
    );
    assert.equal(
      HARTHMERE_ROAD_GROUP_MONSTER_COMPOSITION.filter((k) => k === "muckling")
        .length,
      4
    );
    assert.equal(
      HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION.filter((k) => k === "cow").length,
      1
    );
    assert.equal(
      HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION.filter((k) => k === "sheep").length,
      2
    );
    assert.equal(
      HARTHMERE_ROAD_GROUP_ANIMAL_COMPOSITION.filter((k) => k === "rabbit")
        .length,
      4
    );
  });

  it("REGRESSION: the 2-of-6 Hex split is authored, not derived from hexEvery", () => {
    // The existing mixed-group machinery splits monsters with `hexEvery`, which
    // can only express "every Nth is a Hex". No value of hexEvery produces this
    // composition, which is why road groups carry an explicit list.
    for (const anchor of HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS) {
      const monsters = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.filter(
        (seed) => seed.groupId === anchor.groupId
      );
      assert.equal(monsters.filter((s) => s.combatKind === "hex").length, 2);
      assert.equal(monsters.filter((s) => s.combatKind === "mux").length, 4);
    }
  });

  it("adds 52 living creatures in total", () => {
    assert.equal(HARTHMERE_ROAD_GROUP_SEEDS.length, GROUP_COUNT * MEMBERS_PER_GROUP);
    assert.equal(HARTHMERE_ROAD_GROUP_SEEDS.length, 52);
  });
});

describe("road to Harthmere groups: placement", () => {
  it("spaces the anchors evenly along the route", () => {
    assert.deepEqual(
      HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.map((a) => a.routeFraction),
      [0.2, 0.4, 0.6, 0.8]
    );
    const xs = HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.map(
      (a) => a.centerline[0]
    );
    for (let i = 1; i < xs.length; i += 1) {
      assert.ok(xs[i] > xs[i - 1], "anchors must advance along the road");
    }
  });

  it("offsets every group onto a shoulder and alternates sides", () => {
    const signs = HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.map((a) =>
      Math.sign(a.shoulderOffsetZ)
    );
    assert.deepEqual(signs, [1, -1, 1, -1]);
    for (const anchor of HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS) {
      assert.equal(
        Math.abs(anchor.shoulderOffsetZ),
        ROAD_GROUP_SHOULDER_OFFSET
      );
      assert.equal(
        roadGroupCenter(anchor)[2],
        anchor.centerline[2] + anchor.shoulderOffsetZ
      );
    }
  });

  it("leaves a clear travel lane: no creature sits on the centreline", () => {
    for (const seed of HARTHMERE_ROAD_GROUP_SEEDS) {
      const anchor = HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.find(
        (candidate) => candidate.groupId === seed.groupId
      )!;
      const offsetFromRoad = Math.abs(seed.position[2] - anchor.centerline[2]);
      assert.ok(
        offsetFromRoad >= ROAD_GROUP_SHOULDER_OFFSET - ROAD_GROUP_FOOTPRINT_RADIUS,
        `${seed.seedId} strayed onto the road centreline (${offsetFromRoad.toFixed(2)}m)`
      );
    }
  });

  it("keeps every member inside its encounter footprint", () => {
    for (const seed of HARTHMERE_ROAD_GROUP_SEEDS) {
      const anchor = HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.find(
        (candidate) => candidate.groupId === seed.groupId
      )!;
      const center = roadGroupCenter(anchor);
      const distance = Math.hypot(
        seed.position[0] - center[0],
        seed.position[2] - center[2]
      );
      assert.ok(
        distance <= ROAD_GROUP_FOOTPRINT_RADIUS + 0.01,
        `${seed.seedId} is ${distance.toFixed(2)}m from its group centre`
      );
    }
  });

  it("grounds every member independently from the production-shaped terrain scan", () => {
    assert.equal(
      HARTHMERE_ROAD_GROUP_TERRAIN_SAMPLE.productionRevision,
      "biomes-node-vnet--0000199"
    );
    for (let groupIndex = 0; groupIndex < GROUP_COUNT; groupIndex += 1) {
      const anchor = HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS[groupIndex];
      const monsters = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.filter(
        (seed) => seed.groupId === anchor.groupId
      );
      const animals = HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS.filter(
        (seed) => seed.groupId === anchor.groupId
      );
      assert.deepEqual(
        monsters.map((seed) => seed.position[1]),
        [...HARTHMERE_ROAD_GROUP_MONSTER_TERRAIN_FEET_Y[groupIndex]]
      );
      assert.deepEqual(
        animals.map((seed) => seed.position[1]),
        [...HARTHMERE_ROAD_GROUP_ANIMAL_TERRAIN_FEET_Y[groupIndex]]
      );
      assert.ok(
        [...monsters, ...animals].every(
          (seed) => Math.abs(seed.position[1] - anchor.centerline[1]) <= 2
        ),
        `${anchor.groupId} contains an implausible canopy/roof placement`
      );
    }
  });

  it("clears every safe zone, muck territory, robot area, and helper exclusion", () => {
    for (const seed of HARTHMERE_ROAD_GROUP_SEEDS) {
      assert.ok(
        harthmereOpenWildsMixedGroupPositionIsValid(seed.position),
        `${seed.seedId} fails the open-wilds validity gate`
      );
    }
  });

  it("stays on the original map, west of the additive extension", () => {
    for (const seed of HARTHMERE_ROAD_GROUP_SEEDS) {
      assert.ok(seed.position[0] < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X);
    }
  });
});

describe("road to Harthmere groups: seed integration", () => {
  it("passes the whole-world seed validation gate", () => {
    assert.deepEqual(validateHarthmereLiveEntityProductionSeeds(), []);
  });

  it("uses id offsets and entity ids that collide with nothing", () => {
    const offsets = HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.map((s) => s.idOffset);
    const ids = HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.map((s) => s.entityId);
    assert.equal(new Set(offsets).size, offsets.length);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("REGRESSION: survives grounding without being scattered by muck redistribution", () => {
    // Ordinary muck monsters are deterministically redistributed across every
    // non-safe muck region. Without the open-wilds gate, each road Hex and
    // Muckling would be teleported into an unrelated region, stranding its cow,
    // sheep, and rabbits alone on the roadside.
    const groundedMonsters = harthmereGroundedMuckMonsterSeedsInTerritory();
    const groundedAnimals = harthmereGroundedLivestockSeedsInTerritory();
    for (const seed of HARTHMERE_ROAD_GROUP_MONSTER_SEEDS) {
      const grounded = groundedMonsters.find((g) => g.entityId === seed.entityId);
      assert.ok(grounded, `${seed.seedId} was dropped at grounding`);
      assert.deepEqual(
        grounded!.position,
        seed.position,
        `${seed.seedId} was moved away from its group`
      );
    }
    for (const seed of HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS) {
      const grounded = groundedAnimals.find((g) => g.entityId === seed.entityId);
      assert.ok(grounded, `${seed.seedId} was dropped at grounding`);
      assert.deepEqual(
        grounded!.position,
        seed.position,
        `${seed.seedId} lost its sampled terrain feet Y`
      );
    }
  });

  it("shares one native NPC type per creature kind, with a checked-in id", () => {
    // A per-group display name would need a per-group manifest entry, and a
    // missing entry emits a biscuit with an undefined id, which fails the Bikkie
    // overlay and blocks a clean server boot.
    const keys = new Set(
      HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.map(harthmereNativeNpcTypeKeyForSeed)
    );
    assert.deepEqual(
      [...keys].sort(),
      ["monster_road_pack_hex", "monster_road_pack_muckling"]
    );
    for (const key of keys) {
      assert.ok(
        key in HARTHMERE_NATIVE_NPC_ID_MANIFEST,
        `${key} has no checked-in native NPC id`
      );
    }
    for (const seed of HARTHMERE_ROAD_GROUP_SEEDS) {
      assert.ok(
        harthmereNativeNpcCombatProfileForSeed(seed).id,
        `${seed.seedId} resolved an undefined native NPC id`
      );
    }
  });

  it("names creatures from the shared display names", () => {
    for (const seed of HARTHMERE_ROAD_GROUP_MONSTER_SEEDS) {
      const expected =
        seed.combatKind === "hex" ? ROAD_GROUP_HEX_NAME : ROAD_GROUP_MUCKLING_NAME;
      assert.ok(seed.displayName.startsWith(expected), seed.displayName);
    }
  });
});

describe("road to Harthmere groups: levels", () => {
  it("ramps difficulty west to east along the road", () => {
    assert.deepEqual(
      HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.map((a) => a.level),
      [2, 3, 4, 5]
    );
  });

  it("levels the monsters and leaves the livestock at level 1", () => {
    for (const seed of HARTHMERE_ROAD_GROUP_MONSTER_SEEDS) {
      const anchor = HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.find(
        (candidate) => candidate.groupId === seed.groupId
      )!;
      assert.equal(seed.progressionLevel, anchor.level);
    }
    for (const seed of HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS) {
      assert.equal(seed.progressionLevel, 1, `${seed.seedId} is not level 1`);
    }
  });

  it("REGRESSION: never drives combatLevel from the difficulty ramp", () => {
    // `combatLevel` selects the shared type's base damage/HP curve;
    // `progressionLevel` is this entity's progression on top of it. Driving both
    // from the ramp buffs each creature twice — with `monsterDamage()`'s x5
    // multiplier that pushed a single Hex hit past a 140 HP player's whole bar.
    for (const seed of HARTHMERE_ROAD_GROUP_MONSTER_SEEDS) {
      assert.equal(
        seed.combatLevel,
        seed.combatKind === "hex"
          ? ROAD_GROUP_HEX_COMBAT_LEVEL
          : ROAD_GROUP_MUCKLING_COMBAT_LEVEL,
        `${seed.seedId} uses a non-baseline combatLevel`
      );
    }
    // The last group proves the two fields really do diverge.
    const hardest = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.filter(
      (seed) => seed.groupId === "road_to_harthmere_group_4"
    );
    assert.ok(hardest.every((seed) => seed.progressionLevel === 5));
    assert.ok(hardest.some((seed) => seed.combatLevel !== seed.progressionLevel));

    const rabbit = HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS.find(
      (seed) => seed.species === "rabbit"
    )!;
    assert.equal(rabbit.combatLevel, 1);
    assert.equal(rabbit.progressionLevel, 1);
  });

  it("BALANCE GATE: no road creature can one-shot a full-health player", () => {
    // Native damage is already severe (a combatLevel 3 Hex deals ~90 into a
    // 140 HP player). This is the ceiling that fixes the ramp at level 5.
    const PLAYER_MAX_HP = 140;
    for (const seed of HARTHMERE_ROAD_GROUP_MONSTER_SEEDS) {
      const profile = harthmereNativeNpcCombatProfileForSeed(seed);
      const damage = scaleCreatureCombatStats(
        {
          maxHp: profile.maxHp,
          attackDamage: profile.attackDamage,
          attackIntervalSecs: profile.attackIntervalSecs,
          walkSpeed: profile.walkSpeed,
          runSpeed: profile.runSpeed,
          killXp: profile.killXp,
        },
        seed.progressionLevel
      ).attackDamage;
      assert.ok(
        damage < PLAYER_MAX_HP,
        `${seed.seedId} hits for ${damage}, which one-shots a ${PLAYER_MAX_HP} HP player`
      );
    }
  });
});

describe("road to Harthmere groups: group identity", () => {
  it("registers all 13 members of every group under one id", () => {
    for (const anchor of HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS) {
      const members = harthmereCreatureGroupMembers(`harthmere:${anchor.groupId}`);
      assert.equal(
        members.length,
        MEMBERS_PER_GROUP,
        `${anchor.groupId} has ${members.length} members`
      );
      assert.equal(
        new Set(members.map((m) => m.membership.memberIndex)).size,
        MEMBERS_PER_GROUP
      );
    }
  });

  it("gives Hexes the ranged role, Mucklings melee, and animals prey", () => {
    for (const seed of HARTHMERE_ROAD_GROUP_MONSTER_SEEDS) {
      const membership = harthmereCreatureGroupForEntity(seed.entityId)!;
      assert.equal(
        membership.role,
        seed.combatKind === "hex" ? "ranged" : "melee"
      );
      assert.equal(membership.assistFaction, "muck");
    }
    for (const seed of HARTHMERE_ROAD_GROUP_ANIMAL_SEEDS) {
      const membership = harthmereCreatureGroupForEntity(seed.entityId)!;
      assert.equal(membership.role, "prey");
      assert.equal(membership.assistFaction, "livestock");
    }
  });

  it("puts combatants ahead of prey in the responder ordering", () => {
    const members = harthmereCreatureGroupMembers(
      `harthmere:${HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS[0].groupId}`
    );
    const firstPrey = members.findIndex((m) => m.membership.role === "prey");
    const lastCombatant = members
      .map((m) => m.membership.role)
      .lastIndexOf("melee");
    assert.ok(firstPrey > lastCombatant);
  });

  it("gives every member the same leash radius", () => {
    for (const seed of HARTHMERE_ROAD_GROUP_SEEDS) {
      assert.equal(
        harthmereCreatureGroupForEntity(seed.entityId)!.leashRadius,
        ROAD_GROUP_LEASH_RADIUS
      );
    }
  });

  it("keeps the four groups distinct so they cannot merge into one swarm", () => {
    const ids = new Set(
      HARTHMERE_ROAD_GROUP_SEEDS.map(
        (seed) => harthmereCreatureGroupForEntity(seed.entityId)!.groupId
      )
    );
    assert.equal(ids.size, GROUP_COUNT);
  });

  it("passes the world-wide group validation gate", () => {
    assert.deepEqual(validateHarthmereCreatureGroups(), []);
  });

  it("recognises road area ids", () => {
    assert.equal(isHarthmereRoadGroupAreaId("road_to_harthmere_group_1"), true);
    assert.equal(isHarthmereRoadGroupAreaId("west_muck_breach"), false);
  });
});
