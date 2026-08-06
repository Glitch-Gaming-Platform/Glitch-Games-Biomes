/// <reference types="mocha" />
import assert from "assert";
import {
  activeBiomesUIMapPinFromMarkerForTest,
  shouldClearStaleActiveMapPin,
} from "@/client/components/biomes_ui/adapters/mapPinnedDestination";

// HARTHMERE active-pin staleness
// Locks the invariant that a pinned destination is cleared once its landmark is
// gone (completed/abandoned), but never cleared during an empty/loading state.
describe("shouldClearStaleActiveMapPin", () => {
  it("does nothing when there is no pin", () => {
    assert.strictEqual(
      shouldClearStaleActiveMapPin({ pin: undefined, visibleMarkerIds: [] }),
      false
    );
  });

  it("never clears during a loading/empty landmark set (data not hydrated)", () => {
    assert.strictEqual(
      shouldClearStaleActiveMapPin({
        pin: { markerId: "shared_quest_marker:abc" },
        visibleMarkerIds: [],
      }),
      false
    );
  });

  it("keeps the pin while its destination still exists", () => {
    assert.strictEqual(
      shouldClearStaleActiveMapPin({
        pin: { markerId: "jobs_board_target:42" },
        visibleMarkerIds: ["npc_jackie", "jobs_board_target:42"],
      }),
      false
    );
  });

  it("clears the pin once the destination is gone from a populated set", () => {
    assert.strictEqual(
      shouldClearStaleActiveMapPin({
        pin: { markerId: "jobs_board_target:42" },
        visibleMarkerIds: ["npc_jackie", "npc_billy"],
      }),
      true
    );
  });

  it("keeps a quest-owned material source until the objective lifecycle clears it", () => {
    assert.strictEqual(
      shouldClearStaleActiveMapPin({
        pin: {
          markerId: "harthmere_orchard_tree_resin",
          ownerQuestId: "ch1_a1_q03_stand_him_up",
          ownerStepId: "gather_parts",
          worldPosition: [2068, 53, -118],
        },
        visibleMarkerIds: ["npc_jackie", "npc_billy"],
      }),
      false
    );
  });

  it("keeps a synthetic coordinate material pin outside the static landmark registry", () => {
    assert.strictEqual(
      shouldClearStaleActiveMapPin({
        pin: {
          markerId: "material_source:gather:tree_resin:orchard",
          worldPosition: [2068, 53, -118],
        },
        visibleMarkerIds: ["npc_jackie", "npc_billy"],
      }),
      false
    );
  });

  it("resolves a selected source through the production coordinate map", () => {
    const pin = activeBiomesUIMapPinFromMarkerForTest({
      id: "luis_cart",
      label: "Luis's Repair Cart",
      kind: "objective",
      worldPosition: [490, 71, -206],
    });
    assert.deepEqual(pin?.worldPosition, [490, 64, -206]);
  });

  it("preserves exact render and interaction ids for synthetic job pins", () => {
    const pin = activeBiomesUIMapPinFromMarkerForTest({
      id: "jobs_board_marker:delivery_todo",
      label: "Pick up the sealed package",
      kind: "objective",
      worldPosition: [500, 70, -140],
      worldObjectId: "coop_supply_box",
      interactionTargetId: "sealed_package_pickup",
    });
    assert.equal(pin?.worldObjectId, "coop_supply_box");
    assert.equal(pin?.interactionTargetId, "sealed_package_pickup");
  });

  it("recovers exact field-target ids when an older synthetic pin only has the position", () => {
    const pin = activeBiomesUIMapPinFromMarkerForTest({
      id: "jobs_board_marker:security_todo",
      label: "Secure the Marked Trade Route",
      kind: "objective",
      worldPosition: [1455.0714258969656, 46, 90.03012025065367],
    });
    assert.equal(pin?.worldObjectId, "trade_route_watch_marker");
    assert.equal(pin?.interactionTargetId, "trade_route_watch");
  });
});
