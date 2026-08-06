import assert from "assert";
import { HARTHMERE_BUSINESS_INTERIORS } from "@/shared/harthmere/business_interior_runtime";
import * as THREE from "three";
import {
  HARTHMERE_DESKTOP_BUSINESS_INTERIOR_MAX_LOADED,
  HARTHMERE_MOBILE_BUSINESS_INTERIOR_MAX_LOADED,
  HarthmereBusinessInteriorsRenderer,
  harthmereBusinessInteriorLodForDistance,
  harthmereMobileBusinessInteriorIds,
  prepareHarthmereBusinessInteriorRoot,
} from "../harthmere_business_interiors";

describe("Harthmere combined business interior renderer", () => {
  it("uses the exact 16m/28m LOD contract for all 19 interiors", () => {
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 0),
        "lod0",
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 16),
        "lod0",
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 16.01),
        "lod1",
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 28),
        "lod1",
        record.outpostId
      );
      assert.equal(
        harthmereBusinessInteriorLodForDistance(record, 28.01),
        "hidden",
        record.outpostId
      );
    }
  });

  it("reflects Blender depth into each building's positive world-Z footprint", () => {
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      for (const lod of ["lod0", "lod1"] as const) {
        const root = prepareHarthmereBusinessInteriorRoot(
          record,
          new THREE.Group(),
          lod
        );
        assert.deepEqual(root.position.toArray(), record.assetWorldAnchor);
        assert.deepEqual(root.scale.toArray(), [1, 1, -1]);
        assert.equal(root.visible, false);
        assert.equal(
          root.userData.harthmereBusinessInteriorOutpostId,
          record.outpostId
        );
        assert.equal(root.userData.harthmereBusinessInteriorLod, lod);
      }
    }
  });

  it("uses a one-interior phone cap without changing the desktop cap", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const center = new THREE.Vector3(
      record.assetWorldAnchor[0] + record.footprint.width / 2,
      record.assetWorldAnchor[1],
      record.assetWorldAnchor[2] + record.footprint.depth / 2
    );
    const nearby = harthmereMobileBusinessInteriorIds(center);
    assert.ok(nearby.includes(record.outpostId));
    assert.ok(nearby.length <= HARTHMERE_MOBILE_BUSINESS_INTERIOR_MAX_LOADED);
    assert.equal(HARTHMERE_MOBILE_BUSINESS_INTERIOR_MAX_LOADED, 1);
    assert.equal(HARTHMERE_DESKTOP_BUSINESS_INTERIOR_MAX_LOADED, 2);
    assert.ok(
      harthmereMobileBusinessInteriorIds(
        center,
        HARTHMERE_DESKTOP_BUSINESS_INTERIOR_MAX_LOADED
      ).length <= HARTHMERE_DESKTOP_BUSINESS_INTERIOR_MAX_LOADED
    );
    assert.deepEqual(
      harthmereMobileBusinessInteriorIds(
        new THREE.Vector3(100_000, 100_000, 100_000)
      ),
      []
    );
  });

  for (const mobileDevice of [false, true]) {
    it(`does not request the complete interior catalogue at ${
      mobileDevice ? "mobile" : "desktop"
    } boot`, async () => {
      const camera = new THREE.PerspectiveCamera();
      camera.position.set(100_000, 100_000, 100_000);
      const resources = {
        get(resourcePath: string) {
          assert.equal(resourcePath, "/scene/camera");
          return { three: camera };
        },
      } as any;
      const requested: string[] = [];
      const renderer = new HarthmereBusinessInteriorsRenderer(
        resources,
        async (url) => {
          requested.push(url);
          return { scene: new THREE.Group(), animations: [] } as any;
        },
        mobileDevice
      );

      assert.deepEqual(requested, []);
      renderer.draw({ three: new THREE.Scene() } as any, 0.3);
      await Promise.resolve();
      assert.deepEqual(requested, []);
    });
  }
});
