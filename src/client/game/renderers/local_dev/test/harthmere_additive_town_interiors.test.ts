/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD0_METERS,
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD1_METERS,
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES,
  validateHarthmereAdditiveTownInteriorVisualAssets,
} from "../harthmere_additive_town_interiors";
import { HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES } from "@/shared/harthmere/harthmere_additive_town_interiors";

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
      assert.equal(
        fixture.worldPosition[0] - fixture.position[0],
        1600,
        `${fixture.fixtureId} did not receive the additive-town X offset`
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
      /makeHarthmereAdditiveTownInteriorsRenderer\(resources\)/
    );
    assert.match(renderer, /new THREE\.InstancedMesh/);
    assert.match(
      renderer,
      /mesh\.instanceMatrix\.setUsage\(THREE\.DynamicDrawUsage\)/
    );
    assert.match(renderer, /mesh\.frustumCulled = false/);
  });
});
