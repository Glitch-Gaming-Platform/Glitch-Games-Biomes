/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD0_METERS,
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD1_METERS,
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES,
  HARTHMERE_DESKTOP_ADDITIVE_TOWN_INTERIOR_MAX_LOADED_ASSETS,
  HARTHMERE_MOBILE_ADDITIVE_TOWN_INTERIOR_MAX_LOADED_ASSETS,
  HarthmereAdditiveTownInteriorsRenderer,
  harthmereMobileAdditiveTownInteriorAssets,
  validateHarthmereAdditiveTownInteriorVisualAssets,
} from "../harthmere_additive_town_interiors";
import { HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES } from "@/shared/harthmere/harthmere_additive_town_interiors";
import * as THREE from "three";

describe("Harthmere additive-town optimized interior renderer", () => {
  it("has a catalogue visual for every fixture except native plain campfires", () => {
    assert.deepEqual(validateHarthmereAdditiveTownInteriorVisualAssets(), []);
    assert.equal(
      HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.length -
        HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES.length,
      HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.filter(
        (fixture) => fixture.stationKind === "campfire"
      ).length
    );
  });

  it("uses the accepted near/interior LOD and hide distances", () => {
    assert.equal(HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD0_METERS, 16);
    assert.equal(HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD1_METERS, 28);
  });

  it("renders in the shifted connected-town band rather than at stale shell coordinates", () => {
    for (const fixture of HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES) {
      const xOffset = fixture.worldPosition[0] - fixture.position[0];
      // Decimal authored coordinates such as 527.575 cannot be represented
      // exactly in binary floating point. The transformed position is correct,
      // but subtracting it back can differ from 1600 by ~2e-13.
      assert.ok(
        Math.abs(xOffset - 1600) < 1e-9,
        `${fixture.fixtureId} did not receive the additive-town X offset: ${xOffset}`
      );
      assert.equal(fixture.worldPosition[2], fixture.position[2]);
    }
  });

  it("is registered after the general Harthmere renderer and uses instancing", () => {
    const root = process.cwd();
    const registry = fs.readFileSync(
      path.join(root, "src/client/game/renderers/renderers.ts"),
      "utf8"
    );
    const renderer = fs.readFileSync(
      path.join(
        root,
        "src/client/game/renderers/local_dev/harthmere_additive_town_interiors.ts"
      ),
      "utf8"
    );
    assert.match(
      registry,
      /makeHarthmereAdditiveTownInteriorsRenderer\([\s\S]{0,100}resources,[\s\S]{0,100}clientConfig\.mobileDevice/
    );
    assert.match(renderer, /new THREE\.InstancedMesh/);
    assert.match(
      renderer,
      /mesh\.instanceMatrix\.setUsage\(THREE\.DynamicDrawUsage\)/
    );
    assert.match(renderer, /mesh\.frustumCulled = false/);
    assert.match(renderer, /primitive\.mesh\.dispose\(\)/);
  });

  it("selects no additive-town assets at the native phone-test spawn", () => {
    assert.deepEqual(
      harthmereMobileAdditiveTownInteriorAssets(
        new THREE.Vector3(484.25, 53, -207.5)
      ),
      []
    );
  });

  it("bounds the nearby mobile catalogue and includes the closest fixture", () => {
    const fixture = HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES[0];
    const selected = harthmereMobileAdditiveTownInteriorAssets(
      new THREE.Vector3(...fixture.worldPosition)
    );
    assert.ok(selected.includes(fixture.visualAsset));
    assert.ok(
      selected.length <=
        HARTHMERE_MOBILE_ADDITIVE_TOWN_INTERIOR_MAX_LOADED_ASSETS
    );
    assert.equal(HARTHMERE_MOBILE_ADDITIVE_TOWN_INTERIOR_MAX_LOADED_ASSETS, 4);
    assert.equal(HARTHMERE_DESKTOP_ADDITIVE_TOWN_INTERIOR_MAX_LOADED_ASSETS, 8);
    assert.ok(
      harthmereMobileAdditiveTownInteriorAssets(
        new THREE.Vector3(...fixture.worldPosition),
        HARTHMERE_DESKTOP_ADDITIVE_TOWN_INTERIOR_MAX_LOADED_ASSETS
      ).length <= HARTHMERE_DESKTOP_ADDITIVE_TOWN_INTERIOR_MAX_LOADED_ASSETS
    );
  });

  for (const mobileDevice of [false, true]) {
    it(`does not request the distant furniture catalogue during ${
      mobileDevice ? "mobile" : "desktop"
    } boot`, async () => {
      const camera = new THREE.PerspectiveCamera();
      camera.position.set(484.25, 53, -207.5);
      const resources = {
        get(resourcePath: string) {
          assert.equal(resourcePath, "/scene/camera");
          return { three: camera };
        },
      } as any;
      const requested: string[] = [];
      const renderer = new HarthmereAdditiveTownInteriorsRenderer(
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
