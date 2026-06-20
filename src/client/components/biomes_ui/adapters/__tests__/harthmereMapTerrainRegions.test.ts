import assert from "assert";
import {
  HARTHMERE_MAP_TERRAIN_REGIONS_WORLD,
  harthmereMapElevationBandForHeight,
  harthmereMapTerrainRegionsForBounds,
} from "@/client/components/biomes_ui/adapters/harthmereMapTerrainRegions";

describe("harthmere map terrain regions current", () => {
  const bounds = { minX: 200, maxX: 700, minZ: -520, maxZ: 140 };

  it("returns nothing without finite bounds", () => {
    assert.deepEqual(harthmereMapTerrainRegionsForBounds(undefined), []);
  });

  it("always emits a full-canvas land base first", () => {
    const projected = harthmereMapTerrainRegionsForBounds(bounds);
    const base = projected[0];
    assert.equal(base.kind, "land");
    assert.deepEqual(base.shape, { type: "rect", x: 0, y: 0, w: 100, h: 100 });
  });

  it("projects a muck circle to a 0..100 ellipse inside the bounds", () => {
    const projected = harthmereMapTerrainRegionsForBounds(bounds);
    const watchtower = projected.find(
      (region) => region.id === "watchtower_muck_clearing"
    );
    assert.ok(watchtower, "watchtower muck region present");
    assert.equal(watchtower!.shape.type, "ellipse");
    if (watchtower!.shape.type === "ellipse") {
      // center x = (332-200)/500*100 = 26.4, y = (-390 - -520)/660*100 = 19.7
      assert.ok(Math.abs(watchtower!.shape.cx - 26.4) < 0.1);
      assert.ok(Math.abs(watchtower!.shape.cy - 19.7) < 0.2);
      assert.ok(watchtower!.shape.rx > 0 && watchtower!.shape.rx < 50);
    }
  });

  it("projects the river as a polyline with real points", () => {
    const projected = harthmereMapTerrainRegionsForBounds(bounds);
    const river = projected.find((region) => region.id === "river_docks_water");
    assert.ok(river, "river region present");
    assert.equal(river!.kind, "water");
    if (river!.shape.type === "polyline") {
      assert.equal(river!.shape.points.length, 3);
      assert.ok(river!.shape.width > 0);
    } else {
      assert.fail("river should project to a polyline");
    }
  });

  it("covers each authentic terrain kind at least once", () => {
    const kinds = new Set(
      HARTHMERE_MAP_TERRAIN_REGIONS_WORLD.map((region) => region.kind)
    );
    for (const kind of ["town", "water", "muck", "highland", "road", "safe_zone"]) {
      assert.ok(kinds.has(kind as any), `missing terrain kind: ${kind}`);
    }
  });

  it("buckets marker heights into elevation bands", () => {
    assert.equal(harthmereMapElevationBandForHeight(48), "water");
    assert.equal(harthmereMapElevationBandForHeight(53), "low");
    assert.equal(harthmereMapElevationBandForHeight(60), "rolling");
    assert.equal(harthmereMapElevationBandForHeight(80), "highland");
    assert.equal(harthmereMapElevationBandForHeight(undefined), "low");
  });
});
