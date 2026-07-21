import assert from "assert";

import {
  HARTHMERE_CONNECTOR_WORLD_MAP_LANDMARKS,
  appendHarthmereConnectorWorldMapLandmarks,
} from "@/pages/api/world_map/landmarks";
import {
  HARTHMERE_CONNECTOR_ROUTE_ANCHORS,
  HARTHMERE_CONNECTOR_WEST_GATE_LANDING,
} from "@/shared/harthmere/harthmere_connector_route";
import { SNAPSHOT_GROVE_LANDMARKS } from "@/shared/harthmere/snapshot_grove_content";

describe("Harthmere connector world-map landmarks", () => {
  const trailhead = SNAPSHOT_GROVE_LANDMARKS.find(
    (landmark) => landmark.id === "harthmere_road_grove_trailhead"
  );
  const westGate = SNAPSHOT_GROVE_LANDMARKS.find(
    (landmark) => landmark.id === "harthmere_road_west_gate"
  );

  it("marks the exact beginning and end of the protected road", () => {
    assert.ok(trailhead);
    assert.ok(westGate);
    assert.deepEqual(
      [trailhead.position[0], trailhead.position[2]],
      HARTHMERE_CONNECTOR_ROUTE_ANCHORS[0]
    );
    assert.deepEqual(
      [westGate.position[0], westGate.position[2]],
      HARTHMERE_CONNECTOR_WEST_GATE_LANDING
    );
  });

  it("publishes both endpoints as visible, important connector pins", () => {
    assert.equal(trailhead?.visibleOnWorldMap, true);
    assert.equal(westGate?.visibleOnWorldMap, true);
    assert.equal(trailhead?.kind, "connector");
    assert.equal(westGate?.kind, "connector");
    assert.deepEqual(
      HARTHMERE_CONNECTOR_WORLD_MAP_LANDMARKS.map((landmark) => [
        landmark.name,
        landmark.importance,
      ]),
      [
        ["Harthmere Road — Grove Trailhead", 1],
        ["Harthmere Road — West Gate", 1],
      ]
    );
  });

  it("appends the endpoint pins independently of mission-marker flags", () => {
    const appended = appendHarthmereConnectorWorldMapLandmarks([]);
    assert.deepEqual(
      appended.map((landmark) => landmark.name),
      ["Harthmere Road — Grove Trailhead", "Harthmere Road — West Gate"]
    );

    const repeated = appendHarthmereConnectorWorldMapLandmarks(appended);
    assert.equal(repeated.length, 2, "endpoint pins should not duplicate");
  });
});
