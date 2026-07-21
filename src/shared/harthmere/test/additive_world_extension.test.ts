import assert from "assert";

import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_BELLBINDER_DESCENT,
  HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_EXTENSION_ROAD,
  expandWorldAabbForHarthmere,
  harthmereBellbinderDescentFloorBlocks,
  harthmereBellbinderStairLoop,
  initialHarthmereWorldAabb,
  isHarthmereExtensionWorldShardX,
  shouldEnableHarthmereAdditiveWorldExtension,
} from "@/shared/harthmere/world_extension";
import { HARTHMERE_QUEST_CATALOG } from "@/shared/harthmere/quest_compendium";
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
});
