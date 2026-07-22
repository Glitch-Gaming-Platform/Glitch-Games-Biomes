/// <reference types="mocha" />

import assert from "assert";
import type { BiomesId } from "@/shared/ids";
import {
  harthmereBikkieColorHex,
  harthmereInitialsGlyph,
  harthmereResolveBikkieVisual,
} from "../bikkie_visual_resolver";

describe("bikkie_visual_resolver", () => {
  it("normalizes named Bikkie colors into renderable hex values", () => {
    assert.equal(harthmereBikkieColorHex("electric blue"), "#3f91c8");
    assert.equal(harthmereBikkieColorHex("oak brown"), "#7b5438");
    assert.equal(harthmereBikkieColorHex("simple glass"), "#70b8cf");
    assert.equal(harthmereBikkieColorHex("polished clay"), "#b86b54");
    assert.equal(harthmereBikkieColorHex("cotton fabric"), "#d8d2c4");
    assert.match(harthmereBikkieColorHex("mystery aura"), /^#[0-9a-f]{6}$/);
  });

  it("resolves Galois-backed Bikkie graphics with icon paths and glyphs", () => {
    const visual = harthmereResolveBikkieVisual({
      id: "restaurant:kitchen",
      bikkieId: 1485695172010242 as BiomesId,
      label: "Kitchen",
      kind: "crafting_station",
      colors: ["oak brown", "cream ceramic", "warm copper"],
      galoisPath: "placeables/crafting_stations/oak_kitchen",
    });
    assert.equal(visual.source, "galois_icon");
    assert.equal(
      visual.iconAssetPath,
      "icons/placeables/crafting_stations/oak_kitchen"
    );
    assert.equal(visual.shape, "station");
    assert.equal(visual.glyph, "K");
    assert.match(visual.primaryHex, /^#[0-9a-f]{6}$/);
  });

  it("keeps drive-only catalog assets visible through a procedural fallback contract", () => {
    const visual = harthmereResolveBikkieVisual({
      id: "sweet_corn",
      label: "Sweet Corn",
      kind: "Vegetable",
      visualAsset: "drive://item_meshes/sweet_corn.vox:abc",
      colors: ["sun yellow", "leaf green"],
    });
    assert.equal(visual.source, "drive_asset");
    assert.equal(visual.iconAssetPath, undefined);
    assert.equal(visual.shape, "food");
    assert.equal(visual.procedural.canGenerateWithVoxels, true);
  });

  it("marks Exotic Matter metadata as voxel-generatable crafting blocks", () => {
    const visual = harthmereResolveBikkieVisual({
      id: "stabilized_exotic_matter",
      label: "Stabilized Exotic Matter Block",
      objectMetadata: {
        objectKind: "material",
        physicalForm: "block",
        colors: ["white core", "teal glow", "silver containment"],
        procedural: {
          canGenerateWithVoxels: true,
          suggestedShape: "sealed one-voxel power block",
          emission: "teal field glow",
        },
      },
    });
    assert.equal(visual.source, "procedural_voxel");
    assert.equal(visual.shape, "block");
    assert.equal(visual.procedural.canGenerateWithVoxels, true);
    assert.equal(visual.procedural.emission, "teal field glow");
  });

  it("derives stable short glyphs from player-facing labels", () => {
    assert.equal(harthmereInitialsGlyph("Dye-O-Matic"), "DO");
    assert.equal(harthmereInitialsGlyph("Power Cell"), "PC");
  });
});
