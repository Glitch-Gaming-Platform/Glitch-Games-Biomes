/// <reference types="mocha" />

import {
  PROMO_CAMERA_DOLLY_SAMPLES,
  PROMO_CAMERA_SIGHTLINE_SAMPLES,
  PROMO_TERRAIN_VIEW_FAR_METERS,
  promoCameraDollySamples,
  promoCameraSightlineSamples,
  promoTerrainViewColumns,
} from "@/shared/cutscene/promo_terrain_view";
import assert from "assert";

describe("promo terrain view corridor", () => {
  it("shares exact eased dolly and bounded sightline samples across preflights", () => {
    const spec = {
      cameraFar: [0, 10, 0] as [number, number, number],
      cameraNear: [8, 8, 0] as [number, number, number],
      target: [20, 6, 0] as [number, number, number],
      bossBodyRadius: 4,
    };
    const dolly = promoCameraDollySamples(spec);
    const sightlines = promoCameraSightlineSamples(spec);
    assert.equal(dolly.length, PROMO_CAMERA_DOLLY_SAMPLES);
    assert.deepEqual(dolly[0], spec.cameraFar);
    assert.deepEqual(dolly[dolly.length - 1], spec.cameraNear);
    assert.equal(sightlines.length, PROMO_CAMERA_SIGHTLINE_SAMPLES);
    assert.ok(
      sightlines.every(
        ({ distance, checkUntil }) =>
          checkUntil === Math.max(0, distance - spec.bossBodyRadius * 0.75)
      )
    );

    const silhouette = promoCameraSightlineSamples({
      ...spec,
      sightlineTargets: [
        [20, 2, 0],
        [20, 6, 0],
        [20, 10, 0],
      ],
    });
    assert.equal(silhouette.length, PROMO_CAMERA_SIGHTLINE_SAMPLES * 3);
    assert.deepEqual(
      [...new Set(silhouette.map(({ target }) => target[1]))],
      [2, 6, 10]
    );
  });

  it("samples center and lateral lanes through the full marketing view", () => {
    const columns = promoTerrainViewColumns({
      camera: [0, 10, 0],
      target: [10, 5, 0],
      verticalFov: 40,
    });
    assert.equal(columns.length, 12);
    assert.deepEqual(
      [...new Set(columns.map((column) => column.depth))],
      [32, 64, 96, PROMO_TERRAIN_VIEW_FAR_METERS]
    );
    assert.deepEqual(
      [...new Set(columns.map((column) => column.lane))],
      [-0.55, 0, 0.55]
    );
    assert.ok(columns.every((column) => column.point[1] === 5));
    assert.ok(columns.every((column) => column.point[0] > 0));
    assert.ok(
      columns.every(
        (column) => Math.hypot(column.point[0], column.point[2]) <= 128
      ),
      "the default view corridor must remain inside the 128m observer radius"
    );
  });

  it("rotates lateral lanes with the camera-to-target direction", () => {
    const columns = promoTerrainViewColumns({
      camera: [10, 4, 10],
      target: [10, 4, 0],
      verticalFov: 35,
      farMeters: 64,
    });
    const far = columns.filter((column) => column.depth === 64);
    assert.equal(far.length, 3);
    assert.ok(far.every((column) => column.point[2] < 10));
    assert.ok(far.some((column) => column.point[0] < 10));
    assert.ok(far.some((column) => column.point[0] > 10));
  });
});
