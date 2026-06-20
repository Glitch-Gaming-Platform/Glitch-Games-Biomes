/// <reference types="mocha" />
import assert from "assert";
import { resolveSharedQuestMarkerPosition } from "@/client/components/biomes_ui/adapters/questInviteAdapter";
import {
  harthmereJobsBoardQuestMarkerPositions,
} from "@/shared/harthmere/jobs_board_quest_marker_positions";

// HARTHMERE shared-quest landmark fallback
// Locks the invariant that an accepted shared quest still produces an on-map
// landmark even when the server omits markerWorldPosition, by falling back to
// the quest's firstMarkerId in the known marker table.
describe("resolveSharedQuestMarkerPosition", () => {
  it("prefers the explicit markerWorldPosition when present", () => {
    assert.deepStrictEqual(
      resolveSharedQuestMarkerPosition({
        markerWorldPosition: [1, 2, 3],
        firstMarkerId: "anything",
      }),
      [1, 2, 3]
    );
  });

  it("falls back to firstMarkerId's known position when markerWorldPosition is absent", () => {
    const known = harthmereJobsBoardQuestMarkerPositions()[0];
    assert.ok(known, "expected at least one known marker position");
    const resolved = resolveSharedQuestMarkerPosition({
      firstMarkerId: known.markerId,
    });
    assert.deepStrictEqual(resolved, [
      known.position[0],
      known.position[1],
      known.position[2],
    ]);
  });

  it("returns undefined when neither a position nor a resolvable marker id exists", () => {
    assert.strictEqual(
      resolveSharedQuestMarkerPosition({
        firstMarkerId: "definitely_not_a_real_marker_id_zzz",
      }),
      undefined
    );
    assert.strictEqual(resolveSharedQuestMarkerPosition({}), undefined);
  });
});
