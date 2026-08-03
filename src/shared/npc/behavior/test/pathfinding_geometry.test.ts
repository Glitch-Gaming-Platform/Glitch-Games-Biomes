// HARTHMERE_HILL_PATHFINDING — movement graph and path maintenance contracts.
//
// Exercised against a synthetic `canOccupy` predicate rather than a live voxel
// resource graph, so a slope, a step, a sealed corner, and an unreachable shelf
// are all one-line fixtures.

import assert from "assert";

import type { Path } from "@/shared/npc/behavior/pathfinding";
import {
  pathDestination,
  repairPathDestination,
  repairPathDestinationIfConnected,
  type Graph,
} from "@/shared/npc/behavior/pathfinding";
import {
  PATHFINDING_CARDINAL_WEIGHT,
  PATHFINDING_DESTINATION_REPAIR_METERS,
  PATHFINDING_DIAGONAL_WEIGHT,
  PATHFINDING_REBUILD_COOLDOWN_SECONDS,
  PATHFINDING_VERTICAL_WEIGHT,
  diagonalCornerProbes,
  evaluatePathDestination,
  isDiagonalOffset,
  movementOffsetIsTraversable,
  nearestStandingVoxel,
  npcMovementOffsets,
  pathfindingEdgeWeight,
} from "@/shared/npc/behavior/pathfinding_geometry";
import type { Vec3 } from "@/shared/math/types";

const key = (position: Vec3 | readonly number[]) => position.join(",");
const occupancyFrom = (open: ReadonlyArray<Vec3>) => {
  const set = new Set(open.map(key));
  return (position: Vec3) => set.has(key(position));
};

describe("hill pathfinding: movement offsets", () => {
  it("REGRESSION: offers diagonals, which the cardinal-only graph could not", () => {
    // Without diagonals every diagonal step costs an L-shaped detour. On rolling
    // ground that becomes permanent zig-zag plus repeated stuck declarations.
    const offsets = npcMovementOffsets({ onFullBlock: true });
    assert.ok(offsets.some((offset) => isDiagonalOffset(offset)));
    assert.equal(offsets.filter(isDiagonalOffset).length, 4);
  });

  it("keeps diagonals level, so a diagonal never also climbs", () => {
    for (const offset of npcMovementOffsets({ onFullBlock: true })) {
      if (isDiagonalOffset(offset)) {
        assert.equal(offset[1], 0);
      }
    }
  });

  it("preserves the one-block climb rule off a non-full block", () => {
    const offsets = npcMovementOffsets({ onFullBlock: false });
    assert.equal(
      offsets.some((offset) => offset[1] === 1),
      false
    );
    // Descending is still allowed, exactly as before.
    assert.ok(offsets.some((offset) => offset[1] === -1));
  });

  it("offers two-block cardinal hill steps only to an oversized profile", () => {
    const ordinary = npcMovementOffsets({
      onFullBlock: true,
      maxStepHeight: 1,
    });
    const oversized = npcMovementOffsets({
      onFullBlock: true,
      maxStepHeight: 2,
    });
    assert.equal(
      ordinary.some((offset) => Math.abs(offset[1]) === 2),
      false
    );
    assert.ok(oversized.some((offset) => offset[1] === 2));
    assert.ok(oversized.some((offset) => offset[1] === -2));
    assert.equal(
      oversized.some((offset) => isDiagonalOffset(offset) && offset[1] !== 0),
      false
    );
  });

  it("weights diagonals by their true length so A* stays admissible", () => {
    assert.equal(pathfindingEdgeWeight([1, 0, 0]), PATHFINDING_CARDINAL_WEIGHT);
    assert.equal(pathfindingEdgeWeight([1, 0, 1]), PATHFINDING_DIAGONAL_WEIGHT);
    assert.equal(pathfindingEdgeWeight([1, 1, 0]), PATHFINDING_VERTICAL_WEIGHT);
    assert.equal(
      pathfindingEdgeWeight([1, 2, 0]),
      PATHFINDING_VERTICAL_WEIGHT * 2
    );
    assert.ok(PATHFINDING_DIAGONAL_WEIGHT < 2 * PATHFINDING_CARDINAL_WEIGHT);
  });
});

describe("hill pathfinding: diagonal corner clearance", () => {
  it("names the two orthogonal cells a diagonal cuts across", () => {
    assert.deepEqual(diagonalCornerProbes([5, 35, -4], [1, 0, -1]), [
      [6, 35, -4],
      [5, 35, -5],
    ]);
  });

  it("allows a diagonal only when both corners are open", () => {
    const node: Vec3 = [0, 0, 0];
    const offset: Vec3 = [1, 0, 1];
    const openAll = occupancyFrom([
      [1, 0, 1],
      [1, 0, 0],
      [0, 0, 1],
    ]);
    assert.equal(
      movementOffsetIsTraversable({ node, offset, canOccupy: openAll }),
      true
    );
  });

  it("rejects squeezing through the corner where two walls meet", () => {
    // Destination itself is open, but both orthogonal cells are solid. Without
    // this rule an NPC clips diagonally through a sealed corner.
    const sealedCorner = occupancyFrom([[1, 0, 1]]);
    assert.equal(
      movementOffsetIsTraversable({
        node: [0, 0, 0],
        offset: [1, 0, 1],
        canOccupy: sealedCorner,
      }),
      false
    );
  });

  it("does not apply the corner rule to cardinal moves", () => {
    assert.equal(
      movementOffsetIsTraversable({
        node: [0, 0, 0],
        offset: [1, 0, 0],
        canOccupy: occupancyFrom([[1, 0, 0]]),
      }),
      true
    );
  });
});

describe("hill pathfinding: nearest standing voxel", () => {
  it("REGRESSION: a fractional hill Y no longer rounds into solid rock", () => {
    // The defect: a player at Y=34.6 rounds to 35. If 35 is solid the destination
    // node can never be expanded, A* burns its budget, returns undefined, and the
    // NPC falls back to blind direct pursuit into the hillside.
    const canOccupy = occupancyFrom([[10, 34, -400]]);
    assert.deepEqual(
      nearestStandingVoxel({ position: [10.2, 34.6, -400.1], canOccupy }),
      [10, 34, -400]
    );
  });

  it("prefers the exact rounded voxel when it is already standable", () => {
    const canOccupy = occupancyFrom([
      [10, 35, -400],
      [10, 34, -400],
    ]);
    assert.deepEqual(
      nearestStandingVoxel({ position: [10, 34.6, -400], canOccupy }),
      [10, 35, -400]
    );
  });

  it("looks down before up at equal distance, because feet rest on a surface", () => {
    const canOccupy = occupancyFrom([
      [0, 4, 0],
      [0, 6, 0],
    ]);
    assert.deepEqual(
      nearestStandingVoxel({ position: [0, 5, 0], canOccupy }),
      [0, 4, 0]
    );
  });

  it("reports unreachable honestly instead of substituting a solid voxel", () => {
    assert.equal(
      nearestStandingVoxel({ position: [0, 5, 0], canOccupy: () => false }),
      undefined
    );
  });

  it("respects the search bounds so it cannot target a different shelf", () => {
    const canOccupy = occupancyFrom([[0, 40, 0]]);
    assert.equal(
      nearestStandingVoxel({
        position: [0, 5, 0],
        canOccupy,
        searchUp: 3,
        searchDown: 4,
      }),
      undefined
    );
  });
});

describe("hill pathfinding: cached path maintenance", () => {
  const now = 100;

  it("keeps a path whose destination barely moved", () => {
    assert.deepEqual(
      evaluatePathDestination({
        destination: [10, 35, -400],
        targetPosition: [10.5, 35, -400],
        maxDriftMeters: 3,
        nowSeconds: now,
        lastSearchAtSeconds: now - 10,
      }),
      { kind: "keep" }
    );
  });

  it("REGRESSION: repairs the tail instead of discarding the whole route", () => {
    // The old rule threw away every node the moment the player moved 3 m. With a
    // moving player that is a full A* almost every tick, per pursuing NPC.
    const decision = evaluatePathDestination({
      destination: [10, 35, -400],
      targetPosition: [12, 35, -400],
      maxDriftMeters: 3,
      nowSeconds: now,
      lastSearchAtSeconds: now - 10,
    });
    assert.equal(decision.kind, "repair");
    assert.deepEqual(
      decision.kind === "repair" ? decision.destination : undefined,
      [12, 35, -400]
    );
  });

  it("keeps a fractional repair target for terrain-aware resolution", () => {
    const decision = evaluatePathDestination({
      destination: [10, 34, -400],
      searchDestination: [10, 34, -400],
      targetPosition: [11.75, 34.6, -400.25],
      maxDriftMeters: 3,
      nowSeconds: now,
      lastSearchAtSeconds: now - 10,
    });
    assert.equal(decision.kind, "repair");
    assert.deepEqual(
      decision.kind === "repair" ? decision.destination : undefined,
      [11.75, 34.6, -400.25]
    );
  });

  it("rebuilds only once the target has genuinely drifted away", () => {
    assert.equal(
      evaluatePathDestination({
        destination: [10, 35, -400],
        targetPosition: [30, 35, -400],
        maxDriftMeters: 3,
        nowSeconds: now,
        lastSearchAtSeconds: now - 10,
      }).kind,
      "rebuild"
    );
  });

  it("rate limits rebuilds so a sprinting player cannot pin every NPC in A*", () => {
    assert.equal(
      evaluatePathDestination({
        destination: [10, 35, -400],
        targetPosition: [30, 35, -400],
        maxDriftMeters: 3,
        nowSeconds: now,
        lastSearchAtSeconds: now - PATHFINDING_REBUILD_COOLDOWN_SECONDS / 2,
      }).kind,
      "wait_for_cooldown"
    );
  });

  it("REGRESSION: repairs cannot compound past the searched destination", () => {
    // Measured from the last REPAIR, a player moving two metres per tick is
    // always "within repair range", so the tail follows them indefinitely while
    // the route behind it still leads somewhere else entirely. Drift must be
    // measured from where A* actually routed to.
    assert.equal(
      evaluatePathDestination({
        destination: [18, 35, -400], // already repaired several times
        searchDestination: [10, 35, -400], // where A* really went
        targetPosition: [20, 35, -400],
        maxDriftMeters: 3,
        nowSeconds: now,
        lastSearchAtSeconds: now - 10,
      }).kind,
      "rebuild"
    );
  });

  it("still repairs while the target is near the searched destination", () => {
    assert.equal(
      evaluatePathDestination({
        destination: [10, 35, -400],
        searchDestination: [10, 35, -400],
        targetPosition: [12, 35, -400],
        maxDriftMeters: 3,
        nowSeconds: now,
        lastSearchAtSeconds: now - 10,
      }).kind,
      "repair"
    );
  });

  it("builds a first path immediately when there is none", () => {
    assert.equal(
      evaluatePathDestination({
        destination: undefined,
        targetPosition: [1, 2, 3],
        maxDriftMeters: 3,
        nowSeconds: now,
      }).kind,
      "rebuild"
    );
  });

  it("uses a repair radius below one voxel of drift", () => {
    assert.ok(PATHFINDING_DESTINATION_REPAIR_METERS <= 1.5);
  });

  it("repairs a path by swapping only its final node", () => {
    const path: Path = {
      nodes: [
        { position: [0, 0, 0] },
        { position: [1, 0, 0] },
        { position: [2, 0, 0] },
      ],
    };
    const repaired = repairPathDestination(path, [3, 0, 0]);
    assert.equal(repaired.nodes.length, 3);
    assert.deepEqual(repaired.nodes[0].position, [0, 0, 0]);
    assert.deepEqual(pathDestination(repaired), [3, 0, 0]);
    // The original is untouched, so a caller can compare before/after.
    assert.deepEqual(pathDestination(path), [2, 0, 0]);
  });

  it("repairs an empty path into a single-node path", () => {
    assert.deepEqual(repairPathDestination({ nodes: [] }, [1, 2, 3]).nodes, [
      { position: [1, 2, 3] },
    ]);
    assert.equal(pathDestination({ nodes: [] }), undefined);
  });

  it("REGRESSION: refuses a repaired tail that is not a graph edge", () => {
    const path: Path = {
      nodes: [
        { position: [0, 0, 0] },
        { position: [1, 0, 0] },
        { position: [2, 0, 0] },
      ],
    };
    const graph: Graph = {
      closestNode: () => undefined,
      neighbors: () => [[{ weight: 1 }, { position: [2, 0, 0] }]],
    };
    assert.equal(
      repairPathDestinationIfConnected(path, [4, 0, 0], graph, {} as any),
      undefined
    );
    assert.deepEqual(
      pathDestination(
        repairPathDestinationIfConnected(path, [2, 0, 0], graph, {} as any)!
      ),
      [2, 0, 0]
    );
  });
});
