/// <reference types="mocha" />
/// <reference types="node" />
//
// The two creature families added on 2026-07-26:
//   1. 20 rabbits, 10 sheep and 5 cows scattered through the Harthmere wilds
//      forest;
//   2. six mixed encounters on the original map, each 1 Hex + 5 Muckers +
//      1 cow + 2 sheep + 3 rabbits.
//
// THE PROPERTY THAT MATTERS MOST IS GROUNDING.
// Harthmere's terrain is dead flat, so its animals only need the known feet Y.
// The original map is hills, and these seeds ship their AUTHORED Y verbatim
// unless the generated placement map has an entry for them — see the fallback
// in harthmereGroundedLivestockSeedsInTerritory. A guessed Y buries or floats
// the whole group, so the tests below check every creature against the June
// production terrain scan rather than trusting the numbers in the seed file.

import assert from "assert";
import {
  HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS,
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS,
  HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS,
  HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS,
  HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS,
  HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereLiveEntitySizeForSeed,
  harthmereOpenWildsMixedGroupPositionIsValid,
  validateHarthmereLiveEntityProductionSeeds,
} from "../live_entity_production_seed";
import {
  HARTHMERE_FOREST_WILDLIFE_COUNTS,
  HARTHMERE_FOREST_WILDLIFE_MIN_SPACING,
  harthmereForestWildlifeColumnIsClear,
  harthmereForestWildlifePlacements,
  harthmereForestWildlifeRegionIsOpen,
  harthmereForestWildlifeTreesNear,
  harthmereValidateForestWildlife,
} from "../harthmere_forest_wildlife";
import { HARTHMERE_PRODUCTION_PLACEMENT_MAP } from "../production_terrain_placement_map";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
  isHarthmereExtensionWorldPosition,
} from "../world_extension";

// ---------------------------------------------------------------------------
// Verified surface columns from the production terrain scan.
//
// Two sources, both real measurements: the 256 outdoor spawn candidates, and
// every placement record the scan resolved to an outdoor surface. Together they
// are the only ground truth available offline for the original map's heights.
// ---------------------------------------------------------------------------

interface SurfaceSample {
  x: number;
  z: number;
  y: number;
}

const SURFACE_SAMPLES: SurfaceSample[] = (() => {
  const map = HARTHMERE_PRODUCTION_PLACEMENT_MAP as unknown as {
    outdoorSpawnPoints: ReadonlyArray<{ position: readonly number[] }>;
    placements: ReadonlyArray<{
      placementMode?: string;
      surfaceFeetY?: number;
      worldPosition?: readonly number[];
    }>;
  };
  const byColumn = new Map<string, SurfaceSample>();
  for (const point of map.outdoorSpawnPoints) {
    byColumn.set(`${point.position[0]}:${point.position[2]}`, {
      x: point.position[0],
      y: point.position[1],
      z: point.position[2],
    });
  }
  for (const record of map.placements) {
    if (
      record.placementMode !== "outdoor_surface" ||
      !record.worldPosition ||
      !Number.isFinite(record.surfaceFeetY)
    ) {
      continue;
    }
    byColumn.set(`${record.worldPosition[0]}:${record.worldPosition[2]}`, {
      x: record.worldPosition[0],
      y: record.surfaceFeetY as number,
      z: record.worldPosition[2],
    });
  }
  return [...byColumn.values()];
})();

function nearestSurfaceSample(
  x: number,
  z: number
): { sample: SurfaceSample; distance: number } | undefined {
  let best: SurfaceSample | undefined;
  let bestDistance = Infinity;
  for (const sample of SURFACE_SAMPLES) {
    const distance = Math.hypot(sample.x - x, sample.z - z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = sample;
    }
  }
  return best ? { sample: best, distance: bestDistance } : undefined;
}

const EXISTING_CREATURE_KINDS = new Set([
  "ambient_muck_monster",
  "ambient_livestock",
]);

// ---------------------------------------------------------------------------
// 1. The Harthmere forest herd
// ---------------------------------------------------------------------------

describe("harthmere forest wildlife", () => {
  it("places exactly 20 rabbits, 10 sheep and 5 cows", () => {
    assert.deepEqual(harthmereValidateForestWildlife(), []);
    assert.equal(HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS.length, 35);
    for (const [species, wanted] of Object.entries(
      HARTHMERE_FOREST_WILDLIFE_COUNTS
    )) {
      const got = HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS.filter(
        (seed) => seed.species === species
      ).length;
      assert.equal(got, wanted, `${species}: ${got} placed, wanted ${wanted}`);
    }
  });

  it("stands every animal on Harthmere's flat ground — never buried, never floating", () => {
    // The additive extension is flat by construction, so this is exact rather
    // than approximate: one known feet Y, no terrain probe, no tolerance.
    for (const seed of HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS) {
      assert.equal(
        seed.position[1],
        HARTHMERE_EXTENSION_FEET_Y,
        `${seed.displayName} is at Y ${seed.position[1]}, not the flat ground`
      );
      assert.ok(
        isHarthmereExtensionWorldPosition(seed.position),
        `${seed.displayName} is outside the additive extension`
      );
      assert.ok(
        seed.position[0] >= HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
        `${seed.displayName} drifted back onto the original map`
      );
    }
  });

  it("never spawns an animal inside a trunk, a bush, or a wall of leaves", () => {
    for (const placement of harthmereForestWildlifePlacements()) {
      assert.ok(
        harthmereForestWildlifeColumnIsClear(
          placement.authoredX,
          placement.authoredZ
        ),
        `${placement.species} at (${placement.authoredX},${placement.authoredZ}) ` +
          `is standing in something solid`
      );
    }
  });

  it("puts every animal genuinely among the trees", () => {
    for (const placement of harthmereForestWildlifePlacements()) {
      const trunks = harthmereForestWildlifeTreesNear(
        placement.authoredX,
        placement.authoredZ
      );
      assert.ok(
        trunks >= 3,
        `${placement.species} at (${placement.authoredX},${placement.authoredZ}) ` +
          `has only ${trunks} trunks nearby — that is a field, not a forest`
      );
    }
  });

  it("keeps the herd out of the town, the roads and the muck", () => {
    for (const placement of harthmereForestWildlifePlacements()) {
      assert.ok(
        harthmereForestWildlifeRegionIsOpen(
          placement.authoredX,
          placement.authoredZ
        ),
        `${placement.species} at (${placement.authoredX},${placement.authoredZ}) ` +
          `is somewhere the forest does not own`
      );
    }
  });

  it("scatters them rather than clumping them", () => {
    const placements = harthmereForestWildlifePlacements();
    let closest = Infinity;
    for (let i = 0; i < placements.length; i += 1) {
      for (let j = i + 1; j < placements.length; j += 1) {
        closest = Math.min(
          closest,
          Math.hypot(
            placements[i].authoredX - placements[j].authoredX,
            placements[i].authoredZ - placements[j].authoredZ
          )
        );
      }
    }
    assert.ok(
      closest >= HARTHMERE_FOREST_WILDLIFE_MIN_SPACING,
      `two animals are ${closest.toFixed(1)} apart`
    );
    // ...and spread across the whole forest, not bunched in one corner.
    const xs = placements.map((p) => p.authoredX);
    const zs = placements.map((p) => p.authoredZ);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 400, "no spread in X");
    assert.ok(Math.max(...zs) - Math.min(...zs) > 500, "no spread in Z");
  });

  it("survives grounding — all 35 actually reach the world", () => {
    const kept = harthmereGroundedLivestockSeedsInTerritory().filter(
      (seed) => seed.areaId === "harthmere_town_wilds_forest"
    );
    assert.equal(
      kept.length,
      35,
      "grounding dropped forest animals; they would never appear"
    );
    for (const seed of kept) {
      assert.equal(seed.position[1], HARTHMERE_EXTENSION_FEET_Y);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. The six mixed encounters
// ---------------------------------------------------------------------------

describe("harthmere scattered mixed encounter groups", () => {
  it("creates six groups of one Hex, five Muckers and six animals", () => {
    assert.equal(HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS.length, 6);
    assert.equal(HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS.length, 36);
    assert.equal(HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS.length, 36);

    for (const location of HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS) {
      const monsters = HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS.filter(
        (seed) => seed.areaId === location.areaId
      );
      const hexes = monsters.filter((seed) => seed.combatKind === "hex");
      assert.equal(hexes.length, 1, `${location.areaId}: expected one Hex`);
      assert.equal(
        monsters.length - hexes.length,
        5,
        `${location.areaId}: expected five Muckers`
      );
      const animals = HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS.filter(
        (seed) => seed.areaId === location.areaId
      );
      for (const [species, wanted] of [
        ["cow", 1],
        ["sheep", 2],
        ["rabbit", 3],
      ] as const) {
        assert.equal(
          animals.filter((seed) => seed.species === species).length,
          wanted,
          `${location.areaId}: expected ${wanted} ${species}`
        );
      }
    }
  });

  it("anchors every group on a column the terrain scan actually measured", () => {
    // Not "near a measured column" — ON one. The anchor Y is a real surface
    // height rather than an estimate, which is the whole basis for trusting it.
    for (const location of HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS) {
      const exact = SURFACE_SAMPLES.find(
        (sample) =>
          sample.x === location.center[0] && sample.z === location.center[2]
      );
      assert.ok(
        exact,
        `${location.areaId} anchor (${location.center[0]},${location.center[2]}) ` +
          `is not a measured surface column`
      );
      assert.equal(
        location.center[1],
        exact.y,
        `${location.areaId} claims Y ${location.center[1]} but the scan ` +
          `measured ${exact.y}`
      );
    }
  });

  it("stands every creature on ground the scan says is flat — not buried, not floating", () => {
    // THE test the hilly-terrain worry demands. For each creature, the nearest
    // measured surface column must agree with the Y it was given. Two voxels of
    // tolerance is the resolution the scan supports; anything worse than that
    // would be a creature sunk into a slope or hovering over one.
    const creatures = [
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS,
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS,
    ];
    assert.equal(creatures.length, 72);
    for (const seed of creatures) {
      const nearest = nearestSurfaceSample(seed.position[0], seed.position[2]);
      assert.ok(nearest, `${seed.displayName} has no surface evidence at all`);
      assert.ok(
        nearest.distance <= 45,
        `${seed.displayName} is ${nearest.distance.toFixed(0)} blocks from the ` +
          `nearest measured column — too far to claim its height is known`
      );
      const delta = Math.abs(nearest.sample.y - seed.position[1]);
      assert.ok(
        delta <= 2,
        `${seed.displayName} sits at Y ${seed.position[1]} but the nearest ` +
          `measured surface is ${nearest.sample.y} — it would be ` +
          `${delta > 0 ? (nearest.sample.y > seed.position[1] ? "buried" : "floating") : "fine"}`
      );
    }
  });

  it("only anchors groups where the scan evidences flat ground", () => {
    // This is the selection rule made explicit, and it is the honest limit of
    // what can be known offline. The scan measured columns sparsely, so the
    // claim is not "the ground under this group is provably level" but "every
    // column the scan measured within 40 blocks agrees on this height to
    // within two voxels". A slope would show up as disagreement here.
    //
    // Exact per-creature heights become available the moment
    // scripts/harthmere/build-production-terrain-placement-map.cjs is re-run
    // against production: these seeds are enumerated by it, and the runtime
    // prefers its recommendedPosition over the authored one.
    for (const location of HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS) {
      const nearby = SURFACE_SAMPLES.filter(
        (sample) =>
          Math.hypot(
            sample.x - location.center[0],
            sample.z - location.center[2]
          ) <= 40 &&
          !(sample.x === location.center[0] && sample.z === location.center[2])
      );
      assert.ok(
        nearby.length >= 1,
        `${location.areaId} has no neighbouring measured column, so its ` +
          `flatness is unevidenced`
      );
      for (const sample of nearby) {
        assert.ok(
          Math.abs(sample.y - location.center[1]) <= 2,
          `${location.areaId} sits at Y ${location.center[1]} but a measured ` +
            `column ${Math.hypot(
              sample.x - location.center[0],
              sample.z - location.center[2]
            ).toFixed(0)} blocks away is at ${sample.y} — this is a slope`
        );
      }
    }
  });

  it("keeps every creature within a few blocks of a measured column", () => {
    // Belt and braces for the hilly-terrain risk: no creature may be so far
    // from measured ground that its height is guesswork.
    const creatures = [
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS,
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS,
    ];
    let worst = 0;
    for (const seed of creatures) {
      const nearest = nearestSurfaceSample(seed.position[0], seed.position[2]);
      worst = Math.max(worst, nearest!.distance);
    }
    assert.ok(
      worst <= 8,
      `a creature is ${worst.toFixed(1)} blocks from the nearest measured ` +
        `column; tighten the group radius`
    );
  });

  it("keeps every group out of muck, safe zones, protected land and Harthmere", () => {
    const creatures = [
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS,
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS,
    ];
    for (const seed of creatures) {
      assert.ok(
        harthmereOpenWildsMixedGroupPositionIsValid(seed.position),
        `${seed.displayName} at ${JSON.stringify(seed.position)} is inside a ` +
          `muck territory, a safe zone, a robot-protected area, a helper-quest ` +
          `exclusion, or the additive Harthmere map`
      );
      assert.ok(
        seed.position[0] < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
        `${seed.displayName} strayed into the additive town or its forest`
      );
    }
  });

  it("stays well clear of every pre-existing hex, mucker, cow, sheep and rabbit", () => {
    const newIds = new Set(
      [
        ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS,
        ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS,
        ...HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS,
      ].map((seed) => seed.seedId)
    );
    const existing = HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.filter(
      (seed) =>
        EXISTING_CREATURE_KINDS.has(seed.kind) && !newIds.has(seed.seedId)
    );
    assert.ok(existing.length > 150, "expected the established creature set");

    for (const location of HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS) {
      for (const other of existing) {
        const distance = Math.hypot(
          other.position[0] - location.center[0],
          other.position[2] - location.center[2]
        );
        assert.ok(
          distance >= HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE,
          `${location.areaId} is only ${distance.toFixed(0)} from ` +
            `${other.displayName}`
        );
      }
    }
  });

  it("spreads the six groups across the map", () => {
    let closest = Infinity;
    const locations = HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS;
    for (let i = 0; i < locations.length; i += 1) {
      for (let j = i + 1; j < locations.length; j += 1) {
        closest = Math.min(
          closest,
          Math.hypot(
            locations[i].center[0] - locations[j].center[0],
            locations[i].center[2] - locations[j].center[2]
          )
        );
      }
    }
    assert.ok(
      closest >= 200,
      `two groups are only ${closest.toFixed(0)} blocks apart`
    );
  });

  it("survives grounding — all 72 actually reach the world", () => {
    const areaIds = new Set(
      HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS.map(
        (location) => location.areaId
      )
    );
    const monsters = harthmereGroundedMuckMonsterSeedsInTerritory().filter(
      (seed) => areaIds.has(seed.areaId)
    );
    const animals = harthmereGroundedLivestockSeedsInTerritory().filter(
      (seed) => areaIds.has(seed.areaId)
    );
    assert.equal(monsters.length, 36, "grounding dropped Muckers or the Hex");
    assert.equal(animals.length, 36, "grounding dropped animals");
  });
});

// ---------------------------------------------------------------------------
// 3. Shared contracts — ids, and what Anima needs
// ---------------------------------------------------------------------------

describe("harthmere new spawns - ids and Anima contract", () => {
  it("keeps the whole production seed set valid", () => {
    assert.deepEqual(validateHarthmereLiveEntityProductionSeeds(), []);
  });

  it("allocates ids clear of Chapter 1 and every other family", () => {
    const offsets = HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.map(
      (seed) => seed.idOffset
    );
    assert.equal(
      new Set(offsets).size,
      offsets.length,
      "two seeds share an idOffset"
    );
    const newSeeds = [
      ...HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS,
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS,
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS,
    ];
    for (const seed of newSeeds) {
      assert.ok(
        seed.idOffset >= 10600,
        `${seed.displayName} at offset ${seed.idOffset} collides with the ` +
          `Chapter 1 band (10500..10599) or an older family`
      );
    }
  });

  it("gives Anima a real body for every new creature", () => {
    // Anima drives these through the ordinary NPC path, so each needs a
    // sensible size, HP and combat disposition. A zero size or missing HP is
    // the difference between a wandering animal and an invisible statue.
    const newSeeds = [
      ...HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS,
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS,
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS,
    ];
    for (const seed of newSeeds) {
      const size = harthmereLiveEntitySizeForSeed(seed);
      assert.equal(size.length, 3, `${seed.displayName} has no size`);
      for (const axis of size) {
        assert.ok(
          Number.isFinite(axis) && axis > 0,
          `${seed.displayName} has a degenerate size ${JSON.stringify(size)}`
        );
      }
      assert.ok(
        (seed.combatHp ?? 0) > 0,
        `${seed.displayName} has no hit points`
      );
      assert.ok(
        Number.isFinite(seed.position[0]) &&
          Number.isFinite(seed.position[1]) &&
          Number.isFinite(seed.position[2]),
        `${seed.displayName} has a non-finite position`
      );
    }
  });

  it("keeps animals passive and only the Hexes hostile-flavoured", () => {
    for (const seed of [
      ...HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS,
      ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_ANIMAL_SEEDS,
    ]) {
      assert.equal(
        seed.combatKind,
        "mux",
        `${seed.displayName} is flagged as a Hex; livestock must not be`
      );
      assert.equal(seed.kind, "ambient_livestock");
    }
    const hexes = HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_MONSTER_SEEDS.filter(
      (seed) => seed.combatKind === "hex"
    );
    assert.equal(hexes.length, 6, "one Hex per group");
  });

  it("is deterministic across repeated evaluation", () => {
    const first = harthmereForestWildlifePlacements().map(
      (p) => `${p.species}:${p.authoredX}:${p.authoredZ}`
    );
    const second = harthmereForestWildlifePlacements().map(
      (p) => `${p.species}:${p.authoredX}:${p.authoredZ}`
    );
    assert.deepEqual(first, second);
    // The forest herd's world position is a pure shift of its authored one.
    for (const seed of HARTHMERE_LIVE_ENTITY_FOREST_WILDLIFE_SEEDS) {
      assert.ok(
        seed.position[0] - HARTHMERE_ADDITIVE_TOWN_OFFSET_X > 0,
        `${seed.displayName} does not unshift into authored space`
      );
    }
  });
});
