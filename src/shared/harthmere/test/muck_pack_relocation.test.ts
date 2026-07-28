import assert from "assert";

import {
  HARTHMERE_MOSSY_MUCKLING_ANCHOR,
  HARTHMERE_MOSSY_MUCKLING_COUNT,
  HARTHMERE_MOSSY_MUCKLING_NAME,
  HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS,
  HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID,
  HARTHMERE_RELOCATED_MUCK_PACK_ANCHORS,
  HARTHMERE_RELOCATED_MUCK_PACK_RADIUS,
  HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_AREA_ID,
  HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_LOCATION,
  HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereLiveEntityIsGuardedWildlife,
  harthmereLiveEntityIsOpenWildsMixedGroup,
  harthmereMeasuredMuckColumnPoolSizes,
  harthmereOpenWildsGroundingPositionIsValidForSeed,
  harthmereOpenWildsMixedGroupPositionIsValid,
} from "@/shared/harthmere/live_entity_production_seed";
import { BUILDING_SYSTEM_PLOTS } from "@/shared/harthmere/building_system";
import { isPointInsideHarthmereBusinessSafeSite } from "@/shared/harthmere/business_customer_simulator";
import { HARTHMERE_MUCK_CONTAINMENT_AREAS } from "@/shared/harthmere/harthmere_muck_monster_containment";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import { NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION } from "@/shared/harthmere/native_road_ahead_contract";
import { HARTHMERE_PRODUCTION_PLACEMENT_MAP } from "@/shared/harthmere/production_terrain_placement_map";
import { HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X } from "@/shared/harthmere/world_extension";

/**
 * HARTHMERE_MUCK_PACK_RELOCATION — regression coverage for the 2026-07-28 live
 * report, reproduced from `mukcig_movie.har`: the player was standing at
 * [349.4, 39, -378.7] and died at [337.594, 26, -391.652] to "a Old Wood Mucker",
 * inside the Watchtower Muck Clearing they had been sent to for their first
 * fight. Two separate problems met on that one column.
 *
 *   1. `harthmereGroundedMuckMonsterSeedsInTerritory` pooled all ~100 authored
 *      Muck monsters and scattered them over every non-safe Muck containment
 *      area. Six areas, but only FOUR distinct centres — the Watchtower and Old
 *      Wood zones are nested pairs sharing a centre — so the pool collapsed to
 *      four points at ~25 monsters each. Thirty-two hostiles from EIGHT families
 *      (Watchtower Mucker, Watchtower Clearing Mucker/Hexer, Old Wood Mucker,
 *      Old Wood Copse Mucker, West Breach Muckling, Gravewood Pale Muckling,
 *      Road Muckwad) sat within 60 blocks of that death column.
 *
 *   2. "Get the Muck Out" asks for six *Mossy* Mucklings, and no creature in the
 *      world carried that name. Its marker pointed into the same crowd.
 */

const HAR_DEATH_COLUMN = [337.594, 26, -391.652] as const;

function xzDistance(
  a: readonly number[],
  b: readonly number[] | { [index: number]: number }
) {
  return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[2]) - Number(b[2]));
}

function everyCreature() {
  return [
    ...harthmereGroundedMuckMonsterSeedsInTerritory(),
    ...harthmereGroundedLivestockSeedsInTerritory(),
  ];
}

function relocatedGuardedWildlifeAnchor() {
  const location = HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS.find(
    (candidate) =>
      candidate.areaId === HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID
  );
  assert.ok(location);
  return location.center;
}

function allRelocationAnchors() {
  return [
    ...HARTHMERE_RELOCATED_MUCK_PACK_ANCHORS.map((anchor) => anchor.center),
    HARTHMERE_MOSSY_MUCKLING_ANCHOR,
    relocatedGuardedWildlifeAnchor(),
    HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_LOCATION.center,
  ];
}

function insideBuildingPlot(position: readonly number[]) {
  return BUILDING_SYSTEM_PLOTS.some(
    (plot) =>
      Number(position[0]) >= plot.bounds.xMin &&
      Number(position[0]) <= plot.bounds.xMax &&
      Number(position[2]) >= plot.bounds.zMin &&
      Number(position[2]) <= plot.bounds.zMax
  );
}

describe("HARTHMERE_MUCK_PACK_RELOCATION: the Watchtower clearing holds one pack", () => {
  it("leaves exactly one family of hostiles around the HAR death column", () => {
    const near = harthmereGroundedMuckMonsterSeedsInTerritory().filter(
      (seed) => xzDistance(HAR_DEATH_COLUMN, seed.position) <= 60
    );
    const families = new Set(
      near.map((seed) => seed.displayName.replace(/\s+\d+$/, ""))
    );
    assert.deepEqual([...families], ["Watchtower Muckling"]);
    // The pack itself, and nothing else. Was 32 from eight families.
    assert.equal(near.length, 14);
  });

  it("moves every cow, sheep and rabbit out of the HAR fight area", () => {
    const near = everyCreature().filter(
      (seed) => xzDistance(HAR_DEATH_COLUMN, seed.position) <= 60
    );
    assert.equal(near.length, 14);
    assert.ok(near.every((seed) => seed.kind === "ambient_muck_monster"));
    assert.deepEqual(
      [...new Set(near.map((seed) => seed.areaId))],
      ["watchtower_muck_patch"]
    );
  });

  it("keeps that pack a Muckling family with no Hexer in it", () => {
    const pack = harthmereGroundedMuckMonsterSeedsInTerritory().filter(
      (seed) => seed.areaId === "watchtower_muck_patch"
    );
    assert.equal(pack.length, 14);
    for (const seed of pack) {
      assert.match(seed.displayName, /^Watchtower Muckling \d+$/);
      assert.equal(seed.combatKind, "mux");
      // Still inside its own Muck territory — this is an authored danger zone,
      // not a relocation.
      assert.ok(muckMonsterAreaForPosition(seed.position, 1.5));
    }
  });

  it("stands every member of that pack on a column the terrain scan measured", () => {
    const measured = new Set(
      HARTHMERE_PRODUCTION_PLACEMENT_MAP.placements
        .filter((placement) => placement.placementMode === "outdoor_surface")
        .map(
          (placement) =>
            `${placement.recommendedPosition[0]}|${placement.recommendedPosition[1]}|${placement.recommendedPosition[2]}`
        )
    );
    const pack = harthmereGroundedMuckMonsterSeedsInTerritory().filter(
      (seed) => seed.areaId === "watchtower_muck_patch"
    );
    for (const seed of pack) {
      assert.ok(
        measured.has(
          `${seed.position[0]}|${seed.position[1]}|${seed.position[2]}`
        ),
        `${seed.displayName} at ${JSON.stringify(
          seed.position
        )} is not a measured surface column`
      );
    }
    // The ground here is genuinely uneven: a single shared Y would bury or float
    // most of the pack, which is the whole reason these are authored one by one.
    const feetYs = pack.map((seed) => Number(seed.position[1]));
    assert.ok(Math.max(...feetYs) - Math.min(...feetYs) >= 5);
  });
});

describe("HARTHMERE_MUCK_PACK_RELOCATION: each family sits in its own territory", () => {
  it("never lets two authored families share one containment area", () => {
    // This is the exact shape of the original bug: the map-wide pool put eight
    // different authored areaIds inside the Watchtower zone at once.
    const occupants = new Map<string, Set<string>>();
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory()) {
      // The guarded pockets are authored as small nested encounters inside a
      // territory and are meant to sit alongside its resident family.
      if (harthmereLiveEntityIsGuardedWildlife(seed)) continue;
      const area = muckMonsterAreaForPosition(seed.position, 1.5);
      if (!area) continue;
      const families = occupants.get(area.id) ?? new Set<string>();
      families.add(seed.areaId);
      occupants.set(area.id, families);
    }
    for (const [areaId, families] of occupants) {
      assert.equal(
        families.size,
        1,
        `${areaId} holds several authored families: ${[...families].join(", ")}`
      );
    }
  });

  it("has more measured columns than members in every populated Muck area", () => {
    const pools = harthmereMeasuredMuckColumnPoolSizes();
    const demand = new Map<string, number>();
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory()) {
      // Only the families that go through the measured-column spread. Authored
      // packs, relocated packs and the guarded pockets all keep their own
      // authored positions and never draw from a pool.
      if (
        seed.authoredMuckPack ||
        seed.wildsRelocatedPack ||
        harthmereLiveEntityIsGuardedWildlife(seed) ||
        harthmereLiveEntityIsOpenWildsMixedGroup(seed)
      ) {
        continue;
      }
      if (!muckMonsterAreaForPosition(seed.position, 1.5)) continue;
      demand.set(seed.areaId, (demand.get(seed.areaId) ?? 0) + 1);
    }
    for (const [areaId, members] of demand) {
      assert.ok(
        (pools[areaId] ?? 0) >= members,
        `${areaId} needs ${members} measured columns but has ${
          pools[areaId] ?? 0
        }; the spread would fall back to the flat Muck floor and bury them`
      );
    }
  });

  it("never seats two monsters on the same column", () => {
    const seen = new Map<string, string>();
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory()) {
      const key = `${seed.position[0]}|${seed.position[2]}`;
      const other = seen.get(key);
      assert.ok(
        other === undefined,
        `${seed.displayName} shares a column with ${other}`
      );
      seen.set(key, seed.displayName);
    }
  });
});

describe("HARTHMERE_MUCK_PACK_RELOCATION: the relocated packs are legally placed", () => {
  it("puts every relocated anchor outside protection, Muck and the additive town", () => {
    for (const anchor of allRelocationAnchors()) {
      assert.ok(
        harthmereOpenWildsMixedGroupPositionIsValid(anchor),
        `${JSON.stringify(anchor)} is not a valid open-Wilds position`
      );
      assert.ok(Number(anchor[0]) < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X);
    }
  });

  it("anchors every relocated pack on a measured surface column", () => {
    const measured = new Map<string, number>();
    for (const placement of HARTHMERE_PRODUCTION_PLACEMENT_MAP.placements) {
      if (placement.placementMode !== "outdoor_surface") continue;
      if (typeof placement.surfaceFeetY !== "number") continue;
      measured.set(
        `${Math.round(placement.worldPosition[0])}|${Math.round(
          placement.worldPosition[2]
        )}`,
        placement.surfaceFeetY
      );
    }
    for (const point of HARTHMERE_PRODUCTION_PLACEMENT_MAP.outdoorSpawnPoints) {
      const key = `${Math.round(point.position[0])}|${Math.round(
        point.position[2]
      )}`;
      if (!measured.has(key)) measured.set(key, point.position[1]);
    }
    for (const anchor of allRelocationAnchors()) {
      const key = `${Math.round(Number(anchor[0]))}|${Math.round(
        Number(anchor[2])
      )}`;
      assert.equal(
        measured.get(key),
        Number(anchor[1]),
        `${JSON.stringify(anchor)} is not a measured surface column`
      );
    }
  });

  it("keeps every relocated member eligible for exact production grounding", () => {
    const relocated = everyCreature().filter(
      (seed) =>
        seed.wildsRelocatedPack ||
        seed.areaId === HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID ||
        seed.areaId === HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_AREA_ID
    );
    assert.equal(relocated.length, 64);
    for (const seed of relocated) {
      assert.ok(
        harthmereOpenWildsGroundingPositionIsValidForSeed(seed, seed.position),
        `${seed.seedId} cannot be accepted by the production grounding pass`
      );
    }
  });

  it("keeps every relocated member out of protected businesses and building plots", () => {
    const relocated = everyCreature().filter(
      (seed) =>
        seed.wildsRelocatedPack ||
        seed.areaId === HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID ||
        seed.areaId === HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_AREA_ID
    );
    assert.equal(relocated.length, 64);
    for (const seed of relocated) {
      const point = { x: seed.position[0], z: seed.position[2] };
      assert.ok(
        !isPointInsideHarthmereBusinessSafeSite(point),
        `${seed.seedId} is inside a protected business site`
      );
      assert.ok(
        !insideBuildingPlot(seed.position),
        `${seed.seedId} is inside an authored building plot`
      );
    }
  });

  it("keeps relocated anchors clear of every other creature and of each other", () => {
    const anchors = allRelocationAnchors();
    const relocatedIds = new Set(
      everyCreature()
        .filter(
          (seed) =>
            seed.wildsRelocatedPack ||
            seed.areaId === HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID ||
            seed.areaId === HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_AREA_ID
        )
        .map((seed) => String(seed.entityId))
    );
    for (const anchor of anchors) {
      for (const seed of everyCreature()) {
        if (relocatedIds.has(String(seed.entityId))) continue;
        assert.ok(
          xzDistance(anchor, seed.position) >=
            HARTHMERE_SCATTERED_MIXED_GROUP_MIN_CREATURE_DISTANCE,
          `${JSON.stringify(anchor)} is only ${xzDistance(
            anchor,
            seed.position
          ).toFixed(1)} from ${seed.displayName}`
        );
      }
      for (const other of anchors) {
        if (other === anchor) continue;
        assert.ok(
          xzDistance(anchor, other) >= 80,
          `${JSON.stringify(anchor)} and ${JSON.stringify(other)} are too close`
        );
      }
    }
  });

  it("never puts a relocated creature on a Mucker or Hexer column", () => {
    const creatures = everyCreature();
    const relocated = creatures.filter(
      (seed) =>
        seed.wildsRelocatedPack ||
        seed.areaId === HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID ||
        seed.areaId === HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_AREA_ID
    );
    const hostiles = creatures.filter(
      (seed) => seed.kind === "ambient_muck_monster"
    );
    for (const seed of relocated) {
      for (const hostile of hostiles) {
        if (seed.entityId === hostile.entityId) continue;
        assert.notEqual(
          `${Math.floor(seed.position[0])}|${Math.floor(seed.position[2])}`,
          `${Math.floor(hostile.position[0])}|${Math.floor(
            hostile.position[2]
          )}`,
          `${seed.displayName} shares a column with ${hostile.displayName}`
        );
      }
    }
  });

  it("preserves the relocated families' ids, counts and Hexer composition", () => {
    const monsters = harthmereGroundedMuckMonsterSeedsInTerritory();
    const expected: ReadonlyArray<[string, number, number]> = [
      // areaId, total members, Hexers
      ["road_muckwad_patch", 15, 3],
      ["watchtower_muck_clearing", 14, 2],
      ["old_wood_mucker_copse", 14, 2],
    ];
    for (const [areaId, total, hexers] of expected) {
      const family = monsters.filter((seed) => seed.areaId === areaId);
      assert.equal(family.length, total, `${areaId} member count`);
      assert.equal(
        family.filter((seed) => seed.combatKind === "hex").length,
        hexers,
        `${areaId} Hexer count`
      );
      for (const seed of family) {
        assert.ok(
          seed.wildsRelocatedPack,
          `${seed.seedId} not marked relocated`
        );
        assert.ok(
          !muckMonsterAreaForPosition(seed.position, 1.5),
          `${seed.displayName} is still in Muck territory`
        );
      }
      // Contiguous id band, unchanged from before the move.
      const offsets = family.map((seed) => seed.idOffset).sort((a, b) => a - b);
      for (let i = 1; i < offsets.length; i += 1) {
        assert.equal(offsets[i], offsets[i - 1] + 1, `${areaId} id band`);
      }
    }
  });

  it("keeps each relocated sub-pack inside its own footprint", () => {
    const monsters = harthmereGroundedMuckMonsterSeedsInTerritory();
    for (const anchor of HARTHMERE_RELOCATED_MUCK_PACK_ANCHORS) {
      const members = monsters.filter(
        (seed) =>
          seed.idOffset >= anchor.firstOffset &&
          seed.idOffset < anchor.firstOffset + anchor.count
      );
      assert.equal(members.length, anchor.count, `${anchor.areaLabel} size`);
      for (const seed of members) {
        assert.ok(
          xzDistance(anchor.center, seed.position) <=
            HARTHMERE_RELOCATED_MUCK_PACK_RADIUS,
          `${seed.displayName} left the ${anchor.areaLabel} footprint`
        );
        // Shared anchor Y is only safe because the footprint is inside the
        // verified-flat band asserted above.
        assert.equal(Number(seed.position[1]), Number(anchor.center[1]));
      }
    }
  });

  it("moves the guarded pocket and its herd out of the Watchtower clearing together", () => {
    const watchtower = HARTHMERE_MUCK_CONTAINMENT_AREAS.find(
      (area) => area.id === "watchtower_muck_clearing"
    );
    assert.ok(watchtower);
    const pocket = everyCreature().filter(
      (seed) => seed.areaId === HARTHMERE_RELOCATED_GUARDED_WILDLIFE_AREA_ID
    );
    // Four guards plus a five-animal herd.
    assert.equal(pocket.length, 9);
    for (const seed of pocket) {
      assert.ok(
        xzDistance(watchtower!.center, seed.position) > watchtower!.radius,
        `${seed.displayName} is still inside the Watchtower clearing`
      );
      assert.ok(harthmereOpenWildsMixedGroupPositionIsValid(seed.position));
    }
  });

  it("moves the six ordinary Watchtower livestock to their own empty meadow", () => {
    const animals = harthmereGroundedLivestockSeedsInTerritory().filter(
      (seed) => seed.areaId === HARTHMERE_RELOCATED_WATCHTOWER_LIVESTOCK_AREA_ID
    );
    assert.equal(animals.length, 6);
    assert.deepEqual(
      Object.fromEntries(
        ["cow", "sheep", "rabbit"].map((species) => [
          species,
          animals.filter((seed) => seed.species === species).length,
        ])
      ),
      { cow: 2, sheep: 2, rabbit: 2 }
    );
    for (const animal of animals) {
      assert.ok(harthmereOpenWildsMixedGroupPositionIsValid(animal.position));
      assert.ok(xzDistance(HAR_DEATH_COLUMN, animal.position) > 60);
    }
  });
});

describe("HARTHMERE_MOSSY_MUCKLING_HUNT", () => {
  it("seeds a real, findable Mossy Muckling pack", () => {
    const pack = harthmereGroundedMuckMonsterSeedsInTerritory().filter((seed) =>
      seed.displayName.startsWith(HARTHMERE_MOSSY_MUCKLING_NAME)
    );
    assert.equal(pack.length, HARTHMERE_MOSSY_MUCKLING_COUNT);
    for (const seed of pack) {
      // A starter Whacker hunt must not hide a Hexer in the objective count.
      assert.equal(seed.combatKind, "mux");
      assert.ok(
        xzDistance(HARTHMERE_MOSSY_MUCKLING_ANCHOR, seed.position) <= 5
      );
    }
  });

  it("points the quest marker at that pack rather than the Watchtower crowd", () => {
    assert.deepEqual(
      [...NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION],
      [...HARTHMERE_MOSSY_MUCKLING_ANCHOR].map(Number)
    );
    const near = harthmereGroundedMuckMonsterSeedsInTerritory().filter(
      (seed) =>
        xzDistance(
          NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION,
          seed.position
        ) <= 20
    );
    assert.equal(near.length, HARTHMERE_MOSSY_MUCKLING_COUNT);
    for (const seed of near) {
      assert.ok(seed.displayName.startsWith(HARTHMERE_MOSSY_MUCKLING_NAME));
    }
  });

  it("keeps the pack out of the Grove and Harthmere safe rings", () => {
    for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory().filter(
      (seed) => seed.displayName.startsWith(HARTHMERE_MOSSY_MUCKLING_NAME)
    )) {
      assert.ok(harthmereOpenWildsMixedGroupPositionIsValid(seed.position));
    }
  });
});
