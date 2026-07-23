import assert from "assert";
import {
  HARTHMERE_TOOL_SOURCES,
  harthmereJobItemSourceDestinationsForAudit,
} from "@/shared/harthmere/harthmere_job_objective";
import { harthmereJobsBoardQuestMarkerRuntimePositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";
import {
  harthmereBusinessToolListings,
  harthmereBusinessToolVendorMarkerId,
} from "@/shared/harthmere/harthmere_business_tool_shop";

function assertFinitePosition(
  position: readonly number[] | undefined,
  label: string
) {
  assert.ok(position, `${label} must resolve to a position`);
  assert.equal(position?.length, 3, `${label} must be a Vec3`);
  assert.ok(
    position?.every((value) => Number.isFinite(value)),
    `${label} must contain finite coordinates`
  );
}

describe("Harthmere item and tool source reachability", () => {
  it("resolves every guided item source to a real map destination", () => {
    for (const source of harthmereJobItemSourceDestinationsForAudit()) {
      if (!source.markerId) {
        assert.equal(source.sourceKind, "quest_grant");
        continue;
      }
      const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(
        source.markerId
      );
      assert.ok(
        marker,
        `${source.itemId} references missing marker ${source.markerId}`
      );
      assertFinitePosition(marker?.position, source.itemId);
      if (source.markerPosition) {
        assert.deepEqual(
          source.markerPosition,
          marker?.position,
          `${source.itemId} direct position must match its shared marker`
        );
      }
    }
  });

  it("resolves every business tool seller and job tool redirect", () => {
    for (const listing of harthmereBusinessToolListings()) {
      const markerId = harthmereBusinessToolVendorMarkerId(listing.toolItemId);
      const marker =
        harthmereJobsBoardQuestMarkerRuntimePositionForId(markerId);
      assert.ok(markerId, `${listing.toolItemId} must name a vendor marker`);
      assert.equal(marker?.source, "business_owner");
      assertFinitePosition(marker?.position, listing.toolItemId);
    }

    for (const source of Object.values(HARTHMERE_TOOL_SOURCES)) {
      const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(
        source.vendorMarkerId
      );
      assert.equal(marker?.source, "business_owner");
      assertFinitePosition(marker?.position, source.toolName);
    }
  });

  it("uses existing forge and clinic owners instead of dead marker ids", () => {
    for (const markerId of [
      "harthmere_owner:npc_outpost_cinderlane_smith",
      "harthmere_owner:npc_outpost_greenlamp_doctor",
    ]) {
      const marker =
        harthmereJobsBoardQuestMarkerRuntimePositionForId(markerId);
      assert.equal(marker?.source, "business_owner");
      assertFinitePosition(marker?.position, markerId);
    }
    assert.equal(
      harthmereJobsBoardQuestMarkerRuntimePositionForId(
        "harthmere_owner:npc_outpost_metalmarket_smith"
      ),
      undefined
    );
    assert.equal(
      harthmereJobsBoardQuestMarkerRuntimePositionForId(
        "harthmere_owner:npc_outpost_clinic_medic"
      ),
      undefined
    );
  });
});
