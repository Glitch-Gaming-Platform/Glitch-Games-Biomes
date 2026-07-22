import assert from "assert";

import {
  HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS,
  HARTHMERE_CONNECTOR_WORLD_MAP_LANDMARKS,
  HARTHMERE_EXTENSION_WORLD_MAP_LANDMARKS,
  appendHarthmereConnectorWorldMapLandmarks,
  appendHarthmereExtensionWorldMapLandmarks,
} from "@/pages/api/world_map/landmarks";
import {
  HARTHMERE_CONNECTOR_ROUTE_ANCHORS,
  HARTHMERE_CONNECTOR_TOWN_ENTRANCE,
} from "@/shared/harthmere/harthmere_connector_route";
import { SNAPSHOT_GROVE_LANDMARKS } from "@/shared/harthmere/snapshot_grove_content";
import { HARTHMERE_EXTENSION_ROAD } from "@/shared/harthmere/world_extension";

describe("Harthmere connector world-map landmarks", () => {
  const trailhead = SNAPSHOT_GROVE_LANDMARKS.find(
    (landmark) => landmark.id === "harthmere_road_grove_trailhead"
  );
  const westGate = SNAPSHOT_GROVE_LANDMARKS.find(
    (landmark) => landmark.id === "harthmere_road_west_gate"
  );

  it("marks the exact beginning, boundary handoff, and West Gate", () => {
    assert.ok(trailhead);
    assert.ok(westGate);
    assert.deepEqual(
      [trailhead.position[0], trailhead.position[2]],
      HARTHMERE_CONNECTOR_ROUTE_ANCHORS[0]
    );
    assert.deepEqual(
      [westGate.position[0], westGate.position[2]],
      HARTHMERE_EXTENSION_ROAD.worldWestGate
    );
    assert.deepEqual(
      HARTHMERE_CONNECTOR_TOWN_ENTRANCE,
      HARTHMERE_EXTENSION_ROAD.worldBoundaryHandoff
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

  it("publishes the additive road endpoints and every bible building", () => {
    assert.deepEqual(
      HARTHMERE_EXTENSION_WORLD_MAP_LANDMARKS.map((landmark) => [
        landmark.name,
        [landmark.position[0], landmark.position[2]],
      ]),
      [
        ["Harthmere Extension Road — Map Boundary Start", [1792, -209]],
        ["Harthmere West Gate", [1992, -209]],
        ["Harthmere North Gate — Road End", [2100, -284]],
      ]
    );
    assert.ok(
      HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS.some(
        (landmark) => landmark.name === "Harthmere — Chapel of Saint Verena"
      )
    );
    assert.ok(
      HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS.some(
        (landmark) => landmark.name === "Harthmere — River Warehouse"
      )
    );
    assert.ok(
      HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS.some(
        (landmark) => landmark.name === "Harthmere — Guard Barracks"
      )
    );
    assert.ok(HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS.length >= 39);
    assert.ok(
      HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS.every(
        (landmark) =>
          landmark.position[0] >= 1792 && landmark.position[0] < 2560
      ),
      "every Harthmere district/building pin should live in the additive band"
    );
    assert.ok(
      new Set(
        HARTHMERE_BIBLE_WORLD_MAP_LANDMARKS.map(
          (landmark) => `${landmark.position[0]},${landmark.position[2]}`
        )
      ).size >= 30,
      "Harthmere building pins must retain distinct map coordinates"
    );

    const once = appendHarthmereExtensionWorldMapLandmarks([]);
    const twice = appendHarthmereExtensionWorldMapLandmarks(once);
    assert.equal(
      twice.length,
      once.length,
      "extension pins should not duplicate"
    );
  });
});
