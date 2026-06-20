/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  harthmerePropertyMapLandmarksFromBuildingState,
  harthmerePropertyMiniMapPinsForBuildingStateForTest,
} from "../propertyMapMarkers";

describe("Harthmere property map markers current", () => {
  it("returns owned muck-designation land for both world map and HUD minimap feeds", () => {
    const state = {
      ownedPlotIds: ["grove_crossroads_shop_lot"],
      safeZones: {
        grove_crossroads_shop_lot: {
          safeFromMuck: false,
          activatedAtMs: 123,
          area: "the_grove",
        },
      },
      inWorldMarkers: {
        "grove_crossroads_shop_lot:map": {
          markerId: "grove_crossroads_shop_lot:map",
          plotId: "grove_crossroads_shop_lot",
          kind: "map_marker",
          position: [512, 72, -150],
          label: "Watchtower Frontier Shop Lot muck deed",
          createdAtMs: 123,
        },
      },
    };

    const landmarks = harthmerePropertyMapLandmarksFromBuildingState(state as any);
    assert.equal(landmarks.length, 1);
    assert.equal(landmarks[0].id, "property:grove_crossroads_shop_lot");
    assert.equal(landmarks[0].terrainState, "muck");
    assert.deepEqual(landmarks[0].position, [512, 72, -150]);
    assert.ok(landmarks[0].description.includes("Muck designation land"));

    const pins = harthmerePropertyMiniMapPinsForBuildingStateForTest(state as any);
    assert.equal(pins.length, 1);
    assert.equal(pins[0].markerId, "property:grove_crossroads_shop_lot");
    assert.equal(pins[0].terrainState, "muck");
    assert.deepEqual(pins[0].position, landmarks[0].position);
  });

  it("marks terraformed owned land and falls back to the real plot center when marker data is invalid", () => {
    const landmarks = harthmerePropertyMapLandmarksFromBuildingState({
      ownedPlotIds: ["grove_crossroads_shop_lot", "unknown_plot"],
      safeZones: {
        grove_crossroads_shop_lot: {
          safeFromMuck: true,
          activatedAtMs: 456,
          area: "the_grove",
        },
      },
      inWorldMarkers: {
        bad_marker: {
          markerId: "bad_marker",
          plotId: "grove_crossroads_shop_lot",
          kind: "map_marker",
          position: [Number.NaN, 72, -150],
          label: "Bad marker",
          createdAtMs: 456,
        },
      },
    });

    assert.equal(landmarks.length, 1);
    assert.equal(landmarks[0].terrainState, "terraformed");
    assert.ok(landmarks[0].position.every((value) => Number.isFinite(value)));
    assert.ok(landmarks[0].description.includes("Terraformed property land"));
  });

  it("does not show unowned or non-muck-designation plots as property markers", () => {
    assert.deepEqual(
      harthmerePropertyMapLandmarksFromBuildingState({
        ownedPlotIds: [],
        safeZones: {},
        inWorldMarkers: {},
      }),
      []
    );
  });
});
