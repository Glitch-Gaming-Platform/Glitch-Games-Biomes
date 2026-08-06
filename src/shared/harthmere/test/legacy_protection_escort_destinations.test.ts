import assert from "assert";

import { HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS } from "@/shared/harthmere/legacy_protection_escort_destinations";
import {
  HARTHMERE_ESCORT_DESTINATION_MIN_DISTANCE,
  harthmereLegacyProtectionEscortCandidates,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import { harthmereJobsBoardQuestMarkerRuntimePositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";

describe("legacy protection escort destinations", () => {
  it("preserves all 181 names and their 201 materialized field records", () => {
    assert.equal(HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS.length, 181);
    assert.equal(
      new Set(
        HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS.map(
          (destination) => destination.name
        )
      ).size,
      181
    );
    assert.equal(
      HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS.reduce(
        (sum, destination) => sum + destination.fieldRecordCount,
        0
      ),
      201
    );
  });

  it("registers every named destination with readable copy and finite coordinates", () => {
    for (const destination of HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS) {
      const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(
        destination.markerId
      );
      assert.ok(marker, `${destination.name} has no shared map marker`);
      assert.equal(marker!.label, destination.name);
      assert.deepEqual(marker!.position, destination.position);
      assert.ok(
        marker!.position.every(Number.isFinite),
        `${destination.name} has non-finite coordinates`
      );
    }
  });

  it("offers a broad pool of destinations that cannot complete beside the Grove board", () => {
    const board = { x: 501.99486179104775, z: -132.00350672753194 };
    const candidates = harthmereLegacyProtectionEscortCandidates(board);
    assert.ok(candidates.length >= 50, `only ${candidates.length} candidates`);
    for (const destination of candidates) {
      assert.ok(
        Math.hypot(
          destination.position[0] - board.x,
          destination.position[2] - board.z
        ) >= HARTHMERE_ESCORT_DESTINATION_MIN_DISTANCE,
        `${destination.name} is still beside the board`
      );
    }
  });
});
