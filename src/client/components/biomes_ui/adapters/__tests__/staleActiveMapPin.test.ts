/// <reference types="mocha" />
import assert from "assert";
import { shouldClearStaleActiveMapPin } from "@/client/components/biomes_ui/adapters/mapPinnedDestination";

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
});
