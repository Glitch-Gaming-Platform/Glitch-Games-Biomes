/// <reference types="mocha" />

import assert from "assert";
import { readFileSync } from "fs";
import path from "path";
import {
  GROVE_ITEM_VISUAL_ASSETS,
  GROVE_ITEM_WORLD_PRESENTATION_SCALE,
  getGroveItemVisualAsset,
} from "@/shared/harthmere/grove_item_visual_assets";

interface GlbJson {
  accessors?: Array<{ min?: number[]; max?: number[] }>;
  meshes?: Array<{
    primitives?: Array<{ attributes?: { POSITION?: number } }>;
  }>;
  materials?: Array<{
    name?: string;
    pbrMetallicRoughness?: { baseColorFactor?: number[] };
  }>;
  nodes?: Array<{ name?: string; mesh?: number }>;
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

describe("Grove held and dropped item visuals", () => {
  it("ships Carlo's Blender-authored skewer at real hand scale", () => {
    assert.equal(GROVE_ITEM_WORLD_PRESENTATION_SCALE, 1);
    assert.equal(GROVE_ITEM_VISUAL_ASSETS.length, 1);
    const asset = getGroveItemVisualAsset("grove_festival_skewer");
    assert.ok(asset);

    const gltf = readGlb(asset.assetUrl);
    const nodeNames = new Set((gltf.nodes ?? []).map((node) => node.name));
    assert.ok(nodeNames.has("Skewer_Stick"));
    assert.ok(nodeNames.has("Grilled_Meat_Lower"));
    assert.ok(nodeNames.has("Festival_Pepper_Green"));
    assert.ok(nodeNames.has("Char_Ring_1"));
    assert.ok((gltf.materials?.length ?? 0) >= 7);

    const colors = (gltf.materials ?? []).flatMap(
      (material) =>
        material.pbrMetallicRoughness?.baseColorFactor?.slice(0, 3) ?? []
    );
    assert.ok(colors.some((channel) => channel < 0.1));
    assert.ok(colors.some((channel) => channel > 0.7));
    const stickNode = (gltf.nodes ?? []).find(
      (node) => node.name === "Skewer_Stick"
    );
    assert.notEqual(stickNode?.mesh, undefined);
    const stickSpan = positionSpan({
      ...gltf,
      meshes:
        stickNode?.mesh === undefined ? [] : [gltf.meshes?.[stickNode.mesh] ?? {}],
    });
    assert.ok(stickSpan >= 0.4, `skewer stick is too small: ${stickSpan}`);
    assert.ok(stickSpan <= 0.5, `skewer stick is too large: ${stickSpan}`);

    const itemMeshSource = readFileSync(
      path.join(process.cwd(), "src/client/game/resources/item_mesh.ts"),
      "utf8"
    );
    assert.match(itemMeshSource, /getGroveItemVisualAsset/);
    const nativeBikkieSource = readFileSync(
      path.join(
        process.cwd(),
        "src/shared/harthmere/harthmere_native_bikkie_items.ts"
      ),
      "utf8"
    );
    assert.doesNotMatch(
      nativeBikkieSource,
      /grove_festival_skewer:\s*BikkieIds\.muckerMeat/
    );
    assert.match(
      nativeBikkieSource,
      /itemId:\s*"grove_festival_skewer"[\s\S]*displayName:\s*"Carlo's Festival Skewer"/
    );
  });
});
