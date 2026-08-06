/// <reference types="mocha" />

import assert from "assert";
import { readFileSync } from "fs";
import path from "path";
import {
  CH1_ITEM_WORLD_PRESENTATION_SCALE,
  CH1_ITEM_VISUAL_ASSETS,
  getCh1ItemVisualAsset,
  resolveCh1ItemGltfBaseColor,
} from "@/shared/harthmere/ch1_item_visual_assets";
import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";

interface GlbJson {
  accessors?: Array<{
    min?: number[];
    max?: number[];
  }>;
  meshes?: Array<{
    primitives?: Array<{ attributes?: { POSITION?: number } }>;
  }>;
  materials?: Array<{
    name?: string;
    pbrMetallicRoughness?: { baseColorFactor?: number[] };
  }>;
  nodes?: Array<{ name?: string }>;
}

function readGlb(assetUrl: string): GlbJson {
  const bytes = readFileSync(path.join(process.cwd(), "public", assetUrl));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", assetUrl);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(
    bytes
      .subarray(20, 20 + jsonLength)
      .toString("utf8")
      .replace(/\0+$/g, "")
      .trim()
  ) as GlbJson;
}

function positionSpan(gltf: GlbJson): number {
  const spans: number[] = [];
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessorIndex = primitive.attributes?.POSITION;
      if (accessorIndex === undefined) continue;
      const accessor = gltf.accessors?.[accessorIndex];
      if (!accessor?.min || !accessor.max) continue;
      for (let axis = 0; axis < 3; axis += 1) {
        spans.push(Number(accessor.max[axis]) - Number(accessor.min[axis]));
      }
    }
  }
  return Math.max(...spans);
}

describe("Chapter 1 held and dropped item visuals", () => {
  it("exaggerates metric plot props into a readable voxel-world silhouette", () => {
    assert.equal(CH1_ITEM_WORLD_PRESENTATION_SCALE, 3);
    const itemMeshSource = readFileSync(
      path.join(process.cwd(), "src/client/game/resources/item_mesh.ts"),
      "utf8"
    );
    assert.match(
      itemMeshSource,
      /WORLD_TO_VOX_SCALE \* CH1_ITEM_WORLD_PRESENTATION_SCALE/
    );
    assert.match(
      itemMeshSource,
      /gltf\.parser\.associations\.get\(material\)\?\.materials/
    );
    assert.match(itemMeshSource, /resolveCh1ItemGltfBaseColor/);
    assert.match(
      itemMeshSource,
      /harthmereChapter1ItemCanonicalBaseColor/
    );
    const playerMeshSource = readFileSync(
      path.join(process.cwd(), "src/client/game/resources/player_mesh.ts"),
      "utf8"
    );
    assert.match(
      playerMeshSource,
      /harthmereChapter1ItemCanonicalBaseColor\(\s*obj\.material\s*\)/
    );
    assert.match(playerMeshSource, /baseColor \? \{ baseColor \} : \{\}/);
  });

  it("publishes one Blender-authored GLB for every plot item", () => {
    assert.equal(CH1_ITEM_VISUAL_ASSETS.length, CH1_ITEMS.length);
    for (const item of CH1_ITEMS) {
      const asset = getCh1ItemVisualAsset(item.id);
      assert.ok(asset, item.id);
      const gltf = readGlb(asset.assetUrl);
      assert.ok((gltf.nodes?.length ?? 0) >= 3, `${item.id}: no authored form`);
      assert.ok(
        (gltf.materials?.length ?? 0) >= 2,
        `${item.id}: no authored material separation`
      );
      const colors = (gltf.materials ?? []).map((_, materialIndex) =>
        resolveCh1ItemGltfBaseColor(
          gltf.materials?.[materialIndex]?.name,
          materialIndex,
          gltf.materials,
          [1, 1, 1]
        )
      );
      assert.ok(
        colors.some((color) => color.some((channel) => channel < 0.9)),
        `${item.id}: canonical GLB materials collapsed to white`
      );
      const span = positionSpan(gltf);
      assert.ok(span >= 0.03, `${item.id}: unreadably small source mesh ${span}`);
      assert.ok(span <= 0.16, `${item.id}: oversized source mesh ${span}`);
    }
  });

  it("falls back only when a canonical GLB base-color factor is absent", () => {
    assert.deepEqual(
      resolveCh1ItemGltfBaseColor(
        "Modern coat button",
        0,
        [
          {
            name: "Modern coat button",
            pbrMetallicRoughness: {
              baseColorFactor: [0.08, 0.18, 0.28, 1],
            },
          },
        ],
        [1, 1, 1]
      ),
      [0.08, 0.18, 0.28]
    );
    assert.deepEqual(
      resolveCh1ItemGltfBaseColor(
        undefined,
        undefined,
        undefined,
        [0.2, 0.3, 0.4]
      ),
      [0.2, 0.3, 0.4]
    );
  });

  it("uses the exported material name when a cloned material has no parser association", () => {
    assert.deepEqual(
      resolveCh1ItemGltfBaseColor(
        "Strong tea",
        undefined,
        [
          {
            name: "Tin - warm pewter",
            pbrMetallicRoughness: { baseColorFactor: [0.34, 0.38, 0.4, 1] },
          },
          {
            name: "Strong tea",
            pbrMetallicRoughness: {
              baseColorFactor: [0.19, 0.055, 0.018, 1],
            },
          },
        ],
        [1, 1, 1]
      ),
      [0.19, 0.055, 0.018]
    );
  });

  it("keeps the two unrevealed compounds visually near-identical", () => {
    const a = readGlb(getCh1ItemVisualAsset("item_ch1_compound_a")!.assetUrl);
    const b = readGlb(getCh1ItemVisualAsset("item_ch1_compound_b")!.assetUrl);
    assert.equal(a.nodes?.length, b.nodes?.length);
    assert.equal(a.meshes?.length, b.meshes?.length);
    assert.ok(Math.abs(positionSpan(a) - positionSpan(b)) < 0.001);
  });
});
