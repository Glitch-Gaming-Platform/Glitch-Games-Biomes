import assert from "assert";

import { harthmereTownSurfaceMaterialAt } from "@/shared/harthmere/harthmere_town_surface";

describe("Harthmere town surface style", () => {
  it("keeps the connector and civic arteries continuously walkable", () => {
    for (let x = 192; x <= 612; x += 4) {
      assert.ok(
        harthmereTownSurfaceMaterialAt(x, -209),
        `missing east-west road surface at ${x},-209`
      );
    }
    for (let z = -292; z <= -126; z += 4) {
      assert.ok(
        harthmereTownSurfaceMaterialAt(486, z),
        `missing north-south road surface at 486,${z}`
      );
    }
  });

  it("uses varied cobbles in Market Square instead of one stone fill", () => {
    const materials = new Set<string>();
    for (let x = 460; x <= 512; x += 1) {
      for (let z = -235; z <= -183; z += 1) {
        const material = harthmereTownSurfaceMaterialAt(x, z);
        if (material) materials.add(material);
      }
    }
    assert.ok(materials.has("stonePolished"));
    assert.ok(materials.has("cobblestone"));
    assert.ok(materials.has("cobblestoneBrick"));
    assert.ok(materials.has("gravel"));
  });

  it("does not turn Player Services into a district-sized stone slab", () => {
    let surfaced = 0;
    let openGround = 0;
    const materials = new Set<string>();
    for (let x = 500; x <= 570; x += 1) {
      for (let z = -242; z <= -214; z += 1) {
        const material = harthmereTownSurfaceMaterialAt(x, z);
        if (material) {
          surfaced += 1;
          materials.add(material);
        } else {
          openGround += 1;
        }
      }
    }
    assert.ok(
      openGround / (openGround + surfaced) > 0.25,
      JSON.stringify({ openGround, surfaced })
    );
    assert.ok(materials.size >= 5, JSON.stringify([...materials]));
  });

  it("grades maintained roads from cobbles into gravel shoulders", () => {
    assert.notStrictEqual(harthmereTownSurfaceMaterialAt(520, -210), "gravel");
    assert.strictEqual(harthmereTownSurfaceMaterialAt(520, -204), "gravel");
    assert.strictEqual(harthmereTownSurfaceMaterialAt(520, -196), undefined);
  });
});
