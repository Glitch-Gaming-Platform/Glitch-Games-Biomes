import assert from "assert";
import {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import { buildingSystemPlotById } from "../building_system";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "../live_mode_readiness";

const ACTOR = "world_place_actor";
const NOW = 1_770_500_000_000;
let seq = 0;

function envelope(
  payload: Record<string, unknown>,
  nowMs = NOW,
  serverActorPosition?: { x: number; y: number; z: number }
): HarthmereLiveModeAuthorityEnvelope {
  seq += 1;
  return {
    requestId: `world-place-${seq}`,
    idempotencyKey: `world-place-idem-${seq}`,
    actorId: ACTOR,
    actionKind: "request_world_placement" as HarthmereLiveModeActionKind,
    subsystem: "building",
    source: "client_request",
    serverActorPosition,
    serverReceivedAtMs: nowMs,
    serverTick: seq,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
  };
}

function freshState(): HarthmereLiveModeBackendState {
  const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW);
  state.inventory.items = { bench: 1 };
  return state;
}

function reduce(
  state: HarthmereLiveModeBackendState,
  payload: Record<string, unknown>,
  nowMs = NOW
) {
  const objectId =
    typeof payload.objectId === "string" ? payload.objectId : undefined;
  const existingPosition = objectId
    ? state.placeableWorld.placed[objectId]?.position
    : undefined;
  const requestedPosition =
    typeof payload.x === "number" &&
    typeof payload.y === "number" &&
    typeof payload.z === "number"
      ? { x: payload.x, y: payload.y, z: payload.z }
      : undefined;
  return reduceHarthmereLiveModeBackendState(
    state,
    envelope(payload, nowMs, existingPosition ?? requestedPosition),
    nowMs
  );
}

describe("Harthmere live-mode free-world placement backend", () => {
  it("places a held item on the terrain, consuming it from inventory", () => {
    const placed = reduce(freshState(), {
      operation: "place_object",
      itemId: "bench",
      x: 12,
      y: 0,
      z: 8,
    });
    assert.deepEqual(
      placed.summary.warnings.filter((w: string) =>
        w.startsWith("world_placement_rejected")
      ),
      []
    );
    const placedIds = Object.keys(placed.state.placeableWorld.placed);
    assert.strictEqual(placedIds.length, 1);
    assert.strictEqual(
      placed.state.placeableWorld.placed[placedIds[0]].itemId,
      "bench"
    );
    assert.strictEqual(placed.state.inventory.items.bench ?? 0, 0); // consumed
  });

  it("rejects placing an item the player does not hold", () => {
    const blocked = reduce(defaultHarthmereLiveModeBackendState(ACTOR, NOW), {
      operation: "place_object",
      itemId: "bench",
      x: 0,
      y: 0,
      z: 0,
    });
    assert.ok(
      blocked.summary.warnings.includes(
        "world_placement_rejected:missing_placeable_item"
      ),
      JSON.stringify(blocked.summary.warnings)
    );
  });

  it("removes a placed object and returns it to inventory", () => {
    const placed = reduce(freshState(), {
      operation: "place_object",
      itemId: "bench",
      x: 5,
      y: 0,
      z: 5,
    });
    const objectId = Object.keys(placed.state.placeableWorld.placed)[0];
    const removed = reduce(placed.state, {
      operation: "remove_object",
      objectId,
    });
    assert.strictEqual(
      Object.keys(removed.state.placeableWorld.placed).length,
      0
    );
    assert.strictEqual(removed.state.inventory.items.bench, 1); // returned
  });

  it("requires a server-read actor position and a nearby target", () => {
    const missingPosition = reduceHarthmereLiveModeBackendState(
      freshState(),
      envelope(
        { operation: "place_object", itemId: "bench", x: 0, y: 0, z: 0 },
        NOW,
        undefined
      ),
      NOW
    );
    assert.ok(
      missingPosition.summary.warnings.includes(
        "world_placement_rejected:actor_position_unverified"
      )
    );

    const remote = reduceHarthmereLiveModeBackendState(
      freshState(),
      envelope(
        { operation: "place_object", itemId: "bench", x: 0, y: 0, z: 0 },
        NOW,
        { x: 50, y: 0, z: 50 }
      ),
      NOW
    );
    assert.ok(
      remote.summary.warnings.includes(
        "world_placement_rejected:target_out_of_range"
      )
    );
  });

  it("shares placeables and blocks placement on another actor's claimed plot", () => {
    const placed = reduce(freshState(), {
      operation: "place_object",
      itemId: "bench",
      x: 12,
      y: 0,
      z: 8,
    });
    const other = mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      defaultHarthmereLiveModeBackendState("other_actor", NOW),
      createHarthmereLiveModeSharedWorldState(placed.state, NOW),
      NOW
    );
    assert.equal(Object.keys(other.placeableWorld.placed).length, 1);

    const plot = buildingSystemPlotById("grove_crossroads_shop_lot")!;
    other.inventory.items.bench = 1;
    other.building.plotOwners[plot.plotId] = "foreign_owner";
    const blocked = reduceHarthmereLiveModeBackendState(
      other,
      envelope(
        {
          operation: "place_object",
          itemId: "bench",
          x: plot.bounds.xMin,
          y: plot.groundY + 1,
          z: plot.bounds.zMin,
        },
        NOW,
        {
          x: plot.bounds.xMin,
          y: plot.groundY + 1,
          z: plot.bounds.zMin,
        }
      ),
      NOW
    );
    assert.ok(
      blocked.summary.warnings.includes(
        "world_placement_rejected:foreign_plot_overlap"
      )
    );
  });
});
