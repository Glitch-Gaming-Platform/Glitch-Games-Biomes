import assert from "assert";
import {
  defaultHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
  type HarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "../live_mode_readiness_v1";

const ACTOR = "world_place_actor";
const NOW = 1_770_500_000_000;
let seq = 0;

function envelope(
  payload: Record<string, unknown>,
  nowMs = NOW
): HarthmereLiveModeAuthorityEnvelopeV1 {
  seq += 1;
  return {
    requestId: `world-place-${seq}`,
    idempotencyKey: `world-place-idem-${seq}`,
    actorId: ACTOR,
    actionKind: "request_world_placement" as HarthmereLiveModeActionKindV1,
    subsystem: "building",
    source: "client_request",
    serverReceivedAtMs: nowMs,
    serverTick: seq,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
  };
}

function freshState(): HarthmereLiveModeBackendStateV1 {
  const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW);
  state.inventory.items = { bench: 1 };
  return state;
}

function reduce(
  state: HarthmereLiveModeBackendStateV1,
  payload: Record<string, unknown>,
  nowMs = NOW
) {
  return reduceHarthmereLiveModeBackendStateV1(state, envelope(payload, nowMs), nowMs);
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
    assert.strictEqual(placed.state.placeableWorld.placed[placedIds[0]].itemId, "bench");
    assert.strictEqual(placed.state.inventory.items.bench ?? 0, 0); // consumed
  });

  it("rejects placing an item the player does not hold", () => {
    const blocked = reduce(
      defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW),
      { operation: "place_object", itemId: "bench", x: 0, y: 0, z: 0 }
    );
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
    assert.strictEqual(Object.keys(removed.state.placeableWorld.placed).length, 0);
    assert.strictEqual(removed.state.inventory.items.bench, 1); // returned
  });
});
