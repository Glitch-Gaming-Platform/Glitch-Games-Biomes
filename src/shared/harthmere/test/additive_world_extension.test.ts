import assert from "assert";

import {
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS,
  LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA,
} from "@/shared/harthmere/live_entity_helper_quests";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_BELLBINDER_DESCENT,
  HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_EXTENSION_ROAD,
  HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_BASE,
  HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_LIMIT,
  HARTHMERE_EXTENSION_TERRAIN_ID_GRID,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
  HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
  expandWorldAabbForHarthmere,
  harthmereBellbinderDescentFloorBlocks,
  harthmereBellbinderStairLoop,
  harthmereExtensionFoundationShardSpecs,
  harthmereExtensionTerrainEntityIdForShard,
  initialHarthmereWorldAabb,
  isHarthmereExtensionWorldPosition,
  isHarthmereExtensionWorldShardX,
  normalizeHarthmereExtensionOutdoorFeetPosition,
  shouldEnableHarthmereAdditiveWorldExtension,
} from "@/shared/harthmere/world_extension";
import {
  SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS,
  isAuthoredPointInSnapshotSafeZone,
} from "@/shared/harthmere/snapshot_runtime_rules";
import { HARTHMERE_QUEST_CATALOG } from "@/shared/harthmere/quest_compendium";
import {
  HARTHMERE_ESCORT_COMPANION_ENTITY_ID_BASE,
  HARTHMERE_ESCORT_COMPANION_ENTITY_ID_SPAN,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import { getHarthmereQuestResolvedWaypoint } from "@/shared/harthmere/quest_runtime";
import {
  SNAPSHOT_GROVE_NPC_FEET_Y,
  snapshotGroveGroundedPosition,
} from "@/shared/harthmere/snapshot_grove_content";

describe("Harthmere additive world extension", () => {
  it("is enabled by default and only explicit rollback modes disable it", () => {
    assert.equal(shouldEnableHarthmereAdditiveWorldExtension({}), true);
    assert.equal(
      shouldEnableHarthmereAdditiveWorldExtension({
        BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN: "0",
      }),
      true,
      "the retired opt-in flag must not disable normal world content"
    );
    assert.equal(
      shouldEnableHarthmereAdditiveWorldExtension({
        BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET: "1",
      }),
      false
    );
    assert.equal(
      shouldEnableHarthmereAdditiveWorldExtension({
        BIOMES_HARTHMERE_STANDALONE_TOWN: "1",
      }),
      false
    );
  });

  it("only grows the east map edge and never crops existing bounds", () => {
    assert.deepEqual(
      expandWorldAabbForHarthmere({
        v0: [-1792, -256, -1792],
        v1: [1792, 512, 1792],
      }),
      {
        v0: [-1792, -256, -1792],
        v1: [HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X, 512, 1792],
      }
    );
    assert.deepEqual(
      expandWorldAabbForHarthmere({
        v0: [-4096, -512, -4096],
        v1: [3072, 1024, 4096],
      }),
      {
        v0: [-4096, -512, -4096],
        v1: [3072, 1024, 4096],
      }
    );
  });

  it("bootstraps an empty world with the full additive map bounds", () => {
    assert.deepEqual(initialHarthmereWorldAabb(), {
      v0: [-2048, -256, -2048],
      v1: [HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X, 512, 2048],
    });
  });

  it("owns only new east-band terrain shards", () => {
    assert.equal(isHarthmereExtensionWorldShardX(55), false); // X=1760
    assert.equal(isHarthmereExtensionWorldShardX(56), true); // X=1792
    assert.equal(isHarthmereExtensionWorldShardX(79), true); // X=2528
    assert.equal(isHarthmereExtensionWorldShardX(80), false); // X=2560
  });

  it("assigns a stable unique terrain entity id to every reserved grid cell", () => {
    const ids = new Set<number>();
    for (
      let shardY = HARTHMERE_EXTENSION_TERRAIN_ID_GRID.minShardY;
      shardY <= HARTHMERE_EXTENSION_TERRAIN_ID_GRID.maxShardY;
      shardY += 1
    ) {
      for (
        let shardZ = HARTHMERE_EXTENSION_TERRAIN_ID_GRID.minShardZ;
        shardZ <= HARTHMERE_EXTENSION_TERRAIN_ID_GRID.maxShardZ;
        shardZ += 1
      ) {
        for (
          let shardX = HARTHMERE_EXTENSION_TERRAIN_ID_GRID.minShardX;
          shardX <= HARTHMERE_EXTENSION_TERRAIN_ID_GRID.maxShardX;
          shardX += 1
        ) {
          const id = harthmereExtensionTerrainEntityIdForShard(
            shardX,
            shardY,
            shardZ
          );
          assert.ok(id !== undefined);
          assert.ok(id >= HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_BASE);
          assert.ok(id < HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_LIMIT);
          assert.equal(ids.has(id), false, `${shardX}:${shardY}:${shardZ}`);
          ids.add(id);
        }
      }
    }
    assert.equal(ids.size, 9024);
    assert.ok(
      HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_BASE >=
        Number(HARTHMERE_ESCORT_COMPANION_ENTITY_ID_BASE) +
          HARTHMERE_ESCORT_COMPANION_ENTITY_ID_SPAN,
      "terrain ids must remain outside the complete hashed escort id interval"
    );
    assert.equal(
      harthmereExtensionTerrainEntityIdForShard(56, -2, -18),
      harthmereExtensionTerrainEntityIdForShard(56, -2, -18),
      "the same shard coordinate must always retain the same ECS id"
    );
    assert.equal(
      harthmereExtensionTerrainEntityIdForShard(55, 1, -18),
      undefined
    );
  });

  it("covers the complete additive rectangle with a four-shard-deep foundation", () => {
    const specs = harthmereExtensionFoundationShardSpecs();
    const keys = new Set(
      specs.map(({ shardX, shardY, shardZ }) => `${shardX}:${shardY}:${shardZ}`)
    );
    assert.equal(specs.length, 2304);
    assert.equal(keys.size, specs.length);
    for (let shardX = 56; shardX <= 79; shardX += 1) {
      for (let shardZ = -18; shardZ <= 5; shardZ += 1) {
        for (let shardY = -2; shardY <= 1; shardY += 1) {
          assert.ok(keys.has(`${shardX}:${shardY}:${shardZ}`));
        }
      }
    }
  });

  it("keeps every authored snapshot combat spawn outside Grove safe zones", () => {
    const unsafe = SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS.filter((spawn) =>
      isAuthoredPointInSnapshotSafeZone(spawn.authoredPosition)
    );
    assert.deepEqual(unsafe, []);
  });

  it("normalizes only additive outdoor actors to the flat terrain contract", () => {
    assert.deepEqual(
      normalizeHarthmereExtensionOutdoorFeetPosition([1780, 99, -600], 1.5),
      [
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minX + 1.5,
        HARTHMERE_EXTENSION_FEET_Y,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ + 1.5,
      ]
    );
    assert.equal(
      isHarthmereExtensionWorldPosition([
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minX,
        HARTHMERE_EXTENSION_FEET_Y,
        HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ,
      ]),
      true
    );
    assert.equal(
      isHarthmereExtensionWorldPosition([500, 70, -126]),
      false,
      "the original hilly Grove must never use flat Harthmere grounding"
    );
  });

  it("marks the actual generated road start and its north-gate destination", () => {
    assert.deepEqual(HARTHMERE_EXTENSION_ROAD.worldStart, [1792, -209]);
    assert.deepEqual(HARTHMERE_EXTENSION_ROAD.worldWestGate, [1992, -209]);
    assert.deepEqual(HARTHMERE_EXTENSION_ROAD.worldNorthGate, [2100, -284]);
  });

  it("moves every Harthmere quest coordinate and grounds outdoor targets", () => {
    let checked = 0;
    for (const quest of HARTHMERE_QUEST_CATALOG) {
      const targets = [
        { objective: undefined, source: quest.location },
        ...(quest.objectives ?? []).map((objective: any) => ({
          objective,
          source: objective.location,
        })),
      ];
      for (const { objective, source } of targets) {
        if (!source?.waypoint) continue;
        const resolved = getHarthmereQuestResolvedWaypoint(quest.id, objective);
        assert.ok(resolved, `${quest.id}:${objective?.id ?? "location"}`);
        if (!resolved) throw new Error("asserted quest waypoint was missing");
        const authoredX = Number(source.waypoint[0]);
        const authoredY = Number(source.waypoint[1]);
        const authoredZ = Number(source.waypoint[2]);
        assert.equal(resolved[0], authoredX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X);
        assert.equal(resolved[2], authoredZ);
        assert.equal(
          resolved[1],
          authoredY === 0 ? HARTHMERE_EXTENSION_FEET_Y : authoredY,
          `${quest.id}:${objective?.id ?? "location"} Y`
        );
        checked += 1;
      }
    }
    assert.equal(checked, 425);
  });

  it("keeps every negative-Y quest anchor inside the seeded Bellbinder descent", () => {
    const negativeQuestPositions = new Set<string>();
    for (const quest of HARTHMERE_QUEST_CATALOG) {
      const locations = [
        quest.location,
        ...(quest.objectives ?? []).map((objective: any) => objective.location),
      ];
      for (const location of locations) {
        if (location?.waypoint && Number(location.waypoint[1]) < 0) {
          negativeQuestPositions.add(location.waypoint.map(Number).join(","));
        }
      }
    }

    const expected = new Set(
      HARTHMERE_BELLBINDER_DESCENT.authoredQuestFeetPositions.map((position) =>
        position.join(",")
      )
    );
    assert.deepEqual(negativeQuestPositions, expected);
    for (const position of HARTHMERE_BELLBINDER_DESCENT.authoredQuestFeetPositions) {
      assert.ok(
        position[0] >= HARTHMERE_BELLBINDER_DESCENT.authoredBounds.minX &&
          position[0] <= HARTHMERE_BELLBINDER_DESCENT.authoredBounds.maxX
      );
      assert.ok(
        position[2] >= HARTHMERE_BELLBINDER_DESCENT.authoredBounds.minZ &&
          position[2] <= HARTHMERE_BELLBINDER_DESCENT.authoredBounds.maxZ
      );
      const relativeY = position[1] - HARTHMERE_EXTENSION_FEET_Y + 1;
      assert.ok(relativeY >= HARTHMERE_BELLBINDER_DESCENT.minRelativeY);
      assert.ok(relativeY <= HARTHMERE_BELLBINDER_DESCENT.maxRelativeY);
    }
  });

  it("builds a continuous two-block-clear stair to every Bellbound landing", () => {
    const blocks = new Set(
      harthmereBellbinderDescentFloorBlocks().map((position) =>
        position.join(":")
      )
    );
    const stairLoop = harthmereBellbinderStairLoop();
    let previous: readonly [number, number, number] | undefined;
    for (let step = 0; step <= 112; step += 1) {
      const [x, z] = stairLoop[step % stairLoop.length];
      const floorY = HARTHMERE_EXTENSION_GROUND_Y - 1 - step;
      assert.ok(blocks.has(`${x}:${floorY}:${z}`), `missing stair ${step}`);
      assert.ok(
        !blocks.has(`${x}:${floorY + 1}:${z}`),
        `blocked feet at stair ${step}`
      );
      assert.ok(
        !blocks.has(`${x}:${floorY + 2}:${z}`),
        `blocked head at stair ${step}`
      );
      if (previous) {
        assert.equal(
          Math.abs(previous[0] - x) + Math.abs(previous[2] - z),
          1,
          `stair ${step} is horizontally disconnected`
        );
        assert.equal(previous[1] - floorY, 1);
      }
      previous = [x, floorY, z];
    }

    for (const [
      x,
      feetY,
      z,
    ] of HARTHMERE_BELLBINDER_DESCENT.authoredQuestFeetPositions) {
      assert.ok(blocks.has(`${x}:${feetY - 1}:${z}`));
      assert.ok(!blocks.has(`${x}:${feetY}:${z}`));
      assert.ok(!blocks.has(`${x}:${feetY + 1}:${z}`));
    }
  });

  it("does not shift Grove-only quest and NPC coordinates", () => {
    assert.deepEqual(snapshotGroveGroundedPosition([500, 1, -140]), [
      500,
      SNAPSHOT_GROVE_NPC_FEET_Y + 17,
      -140,
    ]);
  });

  it("does not let the retired placement map relocate any marker", () => {
    // This is the property the test exists for: the retired production
    // placement map must never move a helper-quest marker away from where the
    // catalog authored it.
    for (const marker of LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS) {
      assert.deepEqual(
        resolveHarthmereProductionMarkerPosition({
          markerId: marker.id,
          fallback: marker.position,
        }),
        marker.position,
        `${marker.id} was pulled off its authored position`
      );
    }
  });

  it("keeps each marker inside the area it claims to be in", () => {
    // The original assertion here demanded EVERY marker sit east of the old map
    // edge. That was wrong, and it had been failing: the Muck-Scarred Helix
    // belongs to the West Muck Breach, which is deliberately left on the
    // original snapshot map — "hostile breach content remains on the original
    // snapshot map. Harthmere's additive town is safe grassland and must not
    // inherit this Muck territory."
    //
    // "Inside its own area" is the property that was actually wanted, and it is
    // strictly stronger: it catches a marker pointing at the wrong place
    // regardless of which side of the map boundary that place is on.
    const breach = LIVE_ENTITY_HELPER_WEST_MUCK_BREACH_AREA;
    const helix = LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS.find(
      (marker) => marker.areaId === breach.id
    );
    assert.ok(helix, "the West Muck Breach lost its marker");
    assert.ok(
      helix.position[0] >= breach.minX &&
        helix.position[0] <= breach.maxX &&
        helix.position[2] >= breach.minZ &&
        helix.position[2] <= breach.maxZ,
      `${helix.id} at ${JSON.stringify(helix.position)} is outside the West ` +
        `Muck Breach (X ${breach.minX}..${breach.maxX}, Z ${breach.minZ}..` +
        `${breach.maxZ})`
    );
    assert.equal(helix.position[1], breach.groundY);

    // Every OTHER marker belongs to the additive town and must have been
    // shifted east with it.
    for (const marker of LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS) {
      if (marker.areaId === breach.id) {
        continue;
      }
      assert.ok(
        marker.position[0] >= HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
        `${marker.id} sits west of the old map edge but belongs to ` +
          `${marker.areaId} in the additive town`
      );
    }
  });
});
