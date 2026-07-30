import assert from "assert";

import { HARTHMERE_BUILDINGS } from "@/shared/harthmere/harthmere_town_buildings";
import { isPointInsideHarthmereBusinessSafeSite } from "@/shared/harthmere/business_customer_simulator";
import {
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
} from "@/shared/harthmere/live_entity_production_seed";
import {
  HARTHMERE_RIVER_CENTRE_WATER_DEPTH,
  HARTHMERE_RIVER_COURSE,
  HARTHMERE_RIVER_EAST_BRIDGE_DECK,
  HARTHMERE_RIVER_FOREST_MARGIN,
  HARTHMERE_RIVER_HALF_WIDTH,
  HARTHMERE_RIVER_MAX_CARVE_DEPTH,
  HARTHMERE_RIVER_POOL_CENTRE,
  HARTHMERE_RIVER_POOL_RADIUS,
  HARTHMERE_RIVER_TRAIL_CROSSINGS,
  harthmereRiverAuthoredBounds,
  harthmereRiverBedMaterialAt,
  harthmereRiverCarveDepthAt,
  harthmereRiverCarvesAirAt,
  harthmereRiverCentrelineDistance,
  harthmereRiverContains,
  harthmereRiverCrossingDeckAt,
  harthmereRiverExcludesVegetation,
  harthmereRiverTouchesAuthoredSpan,
  harthmereRiverWaterDepthAt,
  harthmereRiverWaterLevelAt,
} from "@/shared/harthmere/harthmere_river";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_EXTENSION_GROUND_Y,
} from "@/shared/harthmere/world_extension";

/**
 * HARTHMERE_RIVER — the Brell.
 *
 * Harthmere shipped as a river town with no river: an authored stone bridge
 * whose "center remains open" over dry ground, a road commented "East river
 * road across the bridge into Briarfen", two dock buildings on a dry bank, a
 * gap cut through the east wall to reach the bridge, and NPCs who talk about
 * the toll bridge, the Bridge Tax Riot and the Brell ferry line. The only
 * "water" was `materials.water` scattered 1-in-17 across the Briarfen — and
 * since Biomes has no water *block*, that id fell through to its blue_wool
 * fallback and speckled the wetland with wool.
 *
 * These assertions cover both halves of the fix: that the course clears
 * everything already authored, and that what it writes is real `ShardWater`,
 * deep enough and open enough to fish.
 */

const GROUND_Y = HARTHMERE_EXTENSION_GROUND_Y;
/** `CAVE_OCCLUSION_THRESHOLD` in src/shared/constants.ts. */
const CAVE_OCCLUSION_THRESHOLD = 8;
/** `SHALLOW_WATER` / `DEEP_WATER` in src/shared/loot_tables/predicates.ts. */
const SHALLOW_WATER = 3;
const DEEP_WATER = 16;
/** `HARTHMERE_FOREST_MAX_CANOPY_RADIUS` in harthmere_wilds_forest.ts. */
const FOREST_MAX_CANOPY_RADIUS = 5;

/** Every road in `isHarthmereWideWildsRoad`, transcribed from the shim. */
const WILDS_ROADS: readonly (readonly [number, number, number, number])[] = [
  [192, -209, 392, -209],
  [486, -286, 486, -524],
  [486, -112, 486, 224],
  [392, -209, 116, -209],
  [590, -205, 864, -205],
  [430, -286, 160, -450],
  [590, -250, 790, -440],
  [430, -112, 200, 140],
  [560, -112, 770, 130],
];

function* riverColumns(step = 1) {
  const b = harthmereRiverAuthoredBounds(2);
  for (let x = Math.floor(b.minX); x <= Math.ceil(b.maxX); x += step) {
    for (let z = Math.floor(b.minZ); z <= Math.ceil(b.maxZ); z += step) {
      if (harthmereRiverContains(x, z)) {
        yield [x, z] as const;
      }
    }
  }
}

function onEastBridgeDeck(x: number, z: number) {
  const deck = HARTHMERE_RIVER_EAST_BRIDGE_DECK;
  return x >= deck.x0 && x <= deck.x1 && z >= deck.z0 && z <= deck.z1;
}

describe("Harthmere river (the Brell)", () => {
  describe("course clearance", () => {
    it("never enters any of the 57 authored buildings", () => {
      for (const building of HARTHMERE_BUILDINGS) {
        for (let x = building.x0; x <= building.x1; x += 1) {
          for (let z = building.z0; z <= building.z1; z += 1) {
            assert.equal(
              harthmereRiverContains(x, z),
              false,
              `the river runs through ${building.name} at ${x},${z}`
            );
          }
        }
      }
    });

    it("never enters the walled town", () => {
      for (let x = 392; x <= 590; x += 1) {
        for (let z = -282; z <= -112; z += 1) {
          assert.equal(
            harthmereRiverContains(x, z),
            false,
            `the river runs through the town at ${x},${z}`
          );
        }
      }
    });

    it("runs past the two dock buildings without swallowing them", () => {
      // The docks are supposed to front onto water: close, but outside.
      for (const name of ["river_dock_supply", "dock_warehouse"]) {
        const dock = HARTHMERE_BUILDINGS.find((b) => b.name === name);
        assert.ok(dock, `${name} is missing`);
        let nearest = Infinity;
        for (let x = dock!.x0; x <= dock!.x1; x += 1) {
          for (let z = dock!.z0; z <= dock!.z1; z += 1) {
            nearest = Math.min(nearest, harthmereRiverCentrelineDistance(x, z));
          }
        }
        assert.ok(
          nearest > HARTHMERE_RIVER_HALF_WIDTH,
          `${name} is inside the channel (${nearest.toFixed(1)})`
        );
        assert.ok(
          nearest < 40,
          `${name} is nowhere near the water (${nearest.toFixed(1)})`
        );
      }
    });

    it("does not drown any seeded creature", () => {
      // Outdoor actors in the additive extension are placed by
      // `normalizeHarthmereExtensionOutdoorFeetPosition`, which hard-codes the
      // flat ground Y. One seeded into the channel would stand on the water
      // surface, or inside it.
      const seeds = [
        ...harthmereGroundedMuckMonsterSeedsInTerritory(),
        ...harthmereGroundedLivestockSeedsInTerritory(),
      ];
      for (const seed of seeds) {
        const authoredX =
          Number(seed.position[0]) - HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
        const authoredZ = Number(seed.position[2]);
        assert.equal(
          harthmereRiverContains(authoredX, authoredZ),
          false,
          `${seed.displayName} is standing in the river at ${authoredX},${authoredZ}`
        );
      }
    });

    it("stays out of every business safe site", () => {
      for (const [x, z] of riverColumns(2)) {
        assert.equal(
          isPointInsideHarthmereBusinessSafeSite({
            x: x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
            z,
          }),
          false,
          `the river runs through a business safe site at ${x},${z}`
        );
      }
    });
  });

  describe("crossings", () => {
    it("passes entirely beneath the authored east bridge deck", () => {
      const deck = HARTHMERE_RIVER_EAST_BRIDGE_DECK;
      const centreZ = Math.round((deck.z0 + deck.z1) / 2);
      const columns: number[] = [];
      for (let x = deck.x0 - 20; x <= deck.x1 + 20; x += 1) {
        if (harthmereRiverContains(x, centreZ)) columns.push(x);
      }
      assert.ok(columns.length > 8, "the bridge does not span the river");
      assert.ok(
        columns[0] >= deck.x0 && columns[columns.length - 1] <= deck.x1,
        `channel ${columns[0]}..${
          columns[columns.length - 1]
        } is not inside deck ${deck.x0}..${deck.x1}`
      );
    });

    it("does not carve the east bridge deck away", () => {
      const deck = HARTHMERE_RIVER_EAST_BRIDGE_DECK;
      for (let x = deck.x0; x <= deck.x1; x += 1) {
        for (let z = deck.z0; z <= deck.z1; z += 1) {
          assert.equal(
            harthmereRiverCarvesAirAt(x, 0, z),
            false,
            `the river carved the bridge deck at ${x},${z}`
          );
        }
      }
    });

    it("still runs underneath the bridge deck", () => {
      const deck = HARTHMERE_RIVER_EAST_BRIDGE_DECK;
      const centreZ = Math.round((deck.z0 + deck.z1) / 2);
      let watery = 0;
      for (let x = deck.x0; x <= deck.x1; x += 1) {
        if (harthmereRiverWaterLevelAt(x, -2, centreZ) === 15) watery += 1;
      }
      assert.ok(watery > 6, "no water under the bridge");
    });

    it("decks every wilds road it crosses", () => {
      // A river this long must not sever a route across the map. Every road
      // column that falls inside the channel has to stay walkable.
      for (let i = 0; i < WILDS_ROADS.length; i += 1) {
        const [ax, az, bx, bz] = WILDS_ROADS[i];
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
        for (let s = 0; s <= steps; s += 1) {
          const t = s / Math.max(1, steps);
          const x = Math.round(ax + (bx - ax) * t);
          const z = Math.round(az + (bz - az) * t);
          if (!harthmereRiverContains(x, z)) continue;
          assert.ok(
            harthmereRiverCrossingDeckAt(x, 0, z) !== undefined ||
              onEastBridgeDeck(x, z),
            `road ${i} crosses the river undecked at ${x},${z}`
          );
        }
      }
    });

    it("keeps the water flowing under its own plank crossings", () => {
      for (const { label, segment } of HARTHMERE_RIVER_TRAIL_CROSSINGS) {
        const [ax, az, bx, bz] = segment;
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
        let decked = 0;
        let wet = 0;
        for (let s = 0; s <= steps; s += 1) {
          const t = s / Math.max(1, steps);
          const x = Math.round(ax + (bx - ax) * t);
          const z = Math.round(az + (bz - az) * t);
          if (!harthmereRiverContains(x, z)) continue;
          if (harthmereRiverCrossingDeckAt(x, 0, z)) decked += 1;
          if (harthmereRiverWaterLevelAt(x, -2, z) === 15) wet += 1;
        }
        assert.ok(decked > 0, `${label} has no deck`);
        assert.ok(wet > 0, `${label} dammed the river`);
      }
    });
  });

  describe("channel shape", () => {
    it("shelves from bank to centre rather than cutting a trench", () => {
      // Doc §5.4: the water mesher tapers the surface where a neighbour is air,
      // so a shelving bed is what makes a shoreline read as a shoreline.
      const [cx, cz] = HARTHMERE_RIVER_COURSE[8];
      let previous = -1;
      let increases = 0;
      for (let d = HARTHMERE_RIVER_HALF_WIDTH; d >= 0; d -= 1) {
        const depth = harthmereRiverCarveDepthAt(cx + d, cz);
        assert.ok(depth >= previous, "the bed is not monotonic toward centre");
        if (depth > previous) increases += 1;
        previous = depth;
      }
      assert.ok(increases >= 3, "the cross-section is a trench, not a bed");
    });

    it("holds exactly the intended water column at the centreline", () => {
      const [cx, cz] = HARTHMERE_RIVER_COURSE[8];
      assert.equal(
        harthmereRiverWaterDepthAt(cx, cz),
        HARTHMERE_RIVER_CENTRE_WATER_DEPTH
      );
    });

    it("puts the surface one voxel below the bank top", () => {
      const [cx, cz] = HARTHMERE_RIVER_COURSE[8];
      assert.equal(harthmereRiverWaterLevelAt(cx, 0, cz), 0, "water at bank top");
      assert.equal(harthmereRiverWaterLevelAt(cx, -1, cz), 15, "no surface");
      assert.equal(harthmereRiverCarvesAirAt(cx, 0, cz), true, "capped by grass");
    });

    it("always seals the bed beneath the water", () => {
      for (const [x, z] of riverColumns(3)) {
        const depth = harthmereRiverCarveDepthAt(x, z);
        assert.ok(depth > 0);
        assert.ok(
          harthmereRiverBedMaterialAt(x, -depth, z) !== undefined,
          `no bed under ${x},${z}`
        );
        assert.equal(
          harthmereRiverCarvesAirAt(x, -depth, z),
          false,
          `the bed at ${x},${z} was carved away`
        );
        assert.equal(
          harthmereRiverWaterLevelAt(x, -depth, z),
          0,
          `water inside the bed at ${x},${z}`
        );
      }
    });

    it("never carves deeper than the seeder's declared bound", () => {
      // The seeder skips the water pass for any shard that cannot hold the
      // river, using this constant. If the profile ever outgrew it, whole
      // stretches of the river would silently seed dry.
      for (const [x, z] of riverColumns(3)) {
        assert.ok(
          harthmereRiverCarveDepthAt(x, z) <= HARTHMERE_RIVER_MAX_CARVE_DEPTH,
          `carve at ${x},${z} exceeds the declared max`
        );
      }
    });

    it("never cuts below the flat plane's dirt layer", () => {
      // The seeder turns depth > 6 into stone, and the foundation shards start
      // one shard down; a bed deeper than that would look and behave wrong.
      for (const [x, z] of riverColumns(3)) {
        assert.ok(
          harthmereRiverCarveDepthAt(x, z) <= 6,
          `carve too deep at ${x},${z}`
        );
        assert.ok(GROUND_Y - harthmereRiverCarveDepthAt(x, z) > 0);
      }
    });
  });

  describe("fishing", () => {
    it("is deep enough for normal-depth fish and shallow enough at the banks", () => {
      const [cx, cz] = HARTHMERE_RIVER_COURSE[8];
      const centre = harthmereRiverWaterDepthAt(cx, cz);
      assert.ok(
        centre > SHALLOW_WATER,
        `centre depth ${centre} only rolls the shallow table`
      );
      assert.ok(
        centre < DEEP_WATER,
        "a river must not roll the ocean's deep-water species"
      );
      // Somewhere on the shelf must still be shallow, so both tables are
      // reachable without leaving the bank.
      const depths: number[] = [];
      for (let d = 0; d <= HARTHMERE_RIVER_HALF_WIDTH; d += 1) {
        depths.push(harthmereRiverWaterDepthAt(cx + d, cz));
      }
      assert.ok(
        depths.some((d) => d > 0 && d <= SHALLOW_WATER),
        "no shallow shelf anywhere on the bank"
      );
    });

    it("keeps the sky over the water open so `inOpen` fish can roll", () => {
      // Every fish Fish Food asks for (Koi, Clownfish, Mackerel) is gated on
      // `inOpen`, i.e. skyOcclusion <= CAVE_OCCLUSION_THRESHOLD. A canopy over
      // the water would silently make them unrollable.
      assert.ok(
        HARTHMERE_RIVER_FOREST_MARGIN >= FOREST_MAX_CANOPY_RADIUS,
        "a canopy can reach over the water"
      );
      assert.ok(CAVE_OCCLUSION_THRESHOLD > 0);
      for (const [x, z] of riverColumns(4)) {
        assert.equal(harthmereRiverExcludesVegetation(x, z), true);
        // The exclusion has to extend a full canopy radius past the bank.
        assert.equal(
          harthmereRiverExcludesVegetation(x + FOREST_MAX_CANOPY_RADIUS, z),
          true
        );
      }
    });

    it("offers a wide, still pool in the Briarfen", () => {
      const [px, pz] = HARTHMERE_RIVER_POOL_CENTRE;
      assert.ok(harthmereRiverContains(px, pz));
      assert.ok(
        harthmereRiverWaterDepthAt(px, pz) > SHALLOW_WATER,
        "the pool is a puddle"
      );
      let widest = 0;
      for (
        let x = px - HARTHMERE_RIVER_POOL_RADIUS - 2;
        x <= px + HARTHMERE_RIVER_POOL_RADIUS + 2;
        x += 1
      ) {
        if (harthmereRiverContains(x, pz)) widest += 1;
      }
      assert.ok(
        widest > HARTHMERE_RIVER_HALF_WIDTH * 2 + 4,
        `the pool (${widest} wide) is no wider than the channel`
      );
    });

    it("can be cast into from dry land at every point along its length", () => {
      // A fishing spot nobody can stand beside is not a fishing spot. Walk the
      // course and prove there is always a bank column immediately outside the
      // channel — the flat plane guarantees it is walkable ground.
      for (const [cx, cz] of HARTHMERE_RIVER_COURSE) {
        let bank: readonly [number, number] | undefined;
        for (let r = HARTHMERE_RIVER_HALF_WIDTH; r <= 24 && !bank; r += 1) {
          for (const [dx, dz] of [
            [r, 0],
            [-r, 0],
            [0, r],
            [0, -r],
          ] as const) {
            if (!harthmereRiverContains(cx + dx, cz + dz)) {
              bank = [cx + dx, cz + dz];
              break;
            }
          }
        }
        assert.ok(bank, `no bank beside the river at ${cx},${cz}`);
        // And that bank is close enough to the water to cast from.
        assert.ok(
          harthmereRiverCentrelineDistance(bank![0], bank![1]) <= 24,
          `the bank at ${bank![0]},${bank![1]} is not on the water`
        );
      }
    });

    it("stands the east bridge over open water", () => {
      // The east gate road ends at the bridge, so this is the spot a player
      // reaches first. The deck must have real water beneath it, and dry
      // abutment where it meets the bank.
      const deck = HARTHMERE_RIVER_EAST_BRIDGE_DECK;
      const centreZ = Math.round((deck.z0 + deck.z1) / 2);
      let wet = 0;
      let dry = 0;
      for (let x = deck.x0; x <= deck.x1; x += 1) {
        if (harthmereRiverContains(x, centreZ)) wet += 1;
        else dry += 1;
      }
      assert.ok(wet > 8, `only ${wet} of the deck spans water`);
      assert.ok(dry > 0, "the deck has no abutment on dry ground");
    });
  });

  describe("seeder contract", () => {
    it("early-outs for shards nowhere near the course", () => {
      assert.equal(
        harthmereRiverTouchesAuthoredSpan(100, 132, -100, -68),
        false,
        "the town centre should skip the water pass"
      );
      const b = harthmereRiverAuthoredBounds();
      assert.equal(
        harthmereRiverTouchesAuthoredSpan(
          b.minX,
          b.minX + 31,
          b.minZ,
          b.minZ + 31
        ),
        true
      );
    });

    it("writes nothing at all outside the channel", () => {
      for (const [x, z] of [
        [500, -200],
        [420, -150],
        [200, 0],
        [900, -500],
      ] as const) {
        assert.equal(harthmereRiverContains(x, z), false);
        assert.equal(harthmereRiverCarveDepthAt(x, z), 0);
        assert.equal(harthmereRiverWaterLevelAt(x, -2, z), 0);
        assert.equal(harthmereRiverBedMaterialAt(x, -2, z), undefined);
        assert.equal(harthmereRiverCrossingDeckAt(x, 0, z), undefined);
      }
    });

    it("never writes above the ground plane", () => {
      for (const [x, z] of riverColumns(5)) {
        for (const relY of [1, 2, 5, 12]) {
          assert.equal(harthmereRiverCarvesAirAt(x, relY, z), false);
          assert.equal(harthmereRiverWaterLevelAt(x, relY, z), 0);
          assert.equal(harthmereRiverBedMaterialAt(x, relY, z), undefined);
        }
      }
    });

    it("keeps the course monotonic down the map", () => {
      // A course that doubled back would carve itself twice and read as a lake.
      for (let i = 0; i + 1 < HARTHMERE_RIVER_COURSE.length; i += 1) {
        assert.ok(
          HARTHMERE_RIVER_COURSE[i + 1][1] > HARTHMERE_RIVER_COURSE[i][1],
          `course reverses at node ${i}`
        );
      }
    });
  });
});
