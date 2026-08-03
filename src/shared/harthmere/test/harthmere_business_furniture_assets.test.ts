import assert from "assert";
import fs from "fs";
import path from "path";
import {
  HARTHMERE_BUSINESS_FURNITURE_ASSETS,
  harthmereBusinessFurnitureAsset,
} from "../generated/harthmere_business_furniture_manifest";
import { harthmereBiscuitForItemDefinition } from "../harthmere_native_bikkie_items";
import { harthmereNativeBiomesIdForItemId } from "../harthmere_native_item_ids";
import {
  ensureHarthmerePlaceableDecorCatalogue,
  getHarthmerePlaceableDecorSpec,
} from "../mmo_placeable_decor_catalogue";
import { getHarthmereItemDefinition } from "../mmo_inventory_authority";

interface FurnitureManifestEntry {
  itemId: string;
  boxSize: [number, number, number];
  collidableSize: [number, number, number];
  modelBoundsMeters: {
    widthX: number;
    heightY: number;
    depthZ: number;
  };
  assets: { lod0: string; lod1: string };
  iconUrl: string;
}

interface FurnitureManifest {
  items: FurnitureManifestEntry[];
}

const REPO_ROOT = process.cwd();
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  "public/assets/harthmere/manifest/business-furniture-catalogue.json"
);

function publicFile(url: string) {
  assert.ok(url.startsWith("/assets/"), `not a public asset URL: ${url}`);
  return path.join(REPO_ROOT, "public", url.slice(1));
}

function parseGlbJson(file: string) {
  const data = fs.readFileSync(file);
  assert.equal(data.toString("ascii", 0, 4), "glTF", `${file} is not GLB`);
  assert.equal(data.readUInt32LE(4), 2, `${file} is not glTF 2`);
  const jsonLength = data.readUInt32LE(12);
  assert.equal(data.toString("ascii", 16, 20), "JSON");
  return {
    data,
    json: JSON.parse(
      data
        .toString("utf8", 20, 20 + jsonLength)
        .replace(/[\u0000\u0020]+$/g, "")
    ),
  };
}

function assertPngContract(file: string) {
  const data = fs.readFileSync(file);
  assert.deepEqual(
    [...data.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${file} is not PNG`
  );
  assert.equal(data.readUInt32BE(16), 256, `${file} width`);
  assert.equal(data.readUInt32BE(20), 256, `${file} height`);
  assert.equal(data[25], 6, `${file} must be RGBA`);
}

describe("Harthmere Blender business furniture catalogue", () => {
  let manifest: FurnitureManifest;

  before(() => {
    ensureHarthmerePlaceableDecorCatalogue();
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  });

  it("ships all reusable furniture as tiny compressed GLBs with exact icons", () => {
    assert.equal(manifest.items.length, 32);
    assert.equal(
      manifest.items.length,
      Object.keys(HARTHMERE_BUSINESS_FURNITURE_ASSETS).length
    );

    let totalGlbBytes = 0;
    for (const entry of manifest.items) {
      const generated = harthmereBusinessFurnitureAsset(entry.itemId);
      assert.ok(generated, `missing generated lookup for ${entry.itemId}`);
      assert.deepEqual(generated!.boxSize, entry.boxSize);
      assert.deepEqual(generated!.collidableSize, entry.collidableSize);

      assert.ok(entry.modelBoundsMeters.widthX <= entry.boxSize[0]);
      assert.ok(entry.modelBoundsMeters.heightY <= entry.boxSize[1]);
      assert.ok(entry.modelBoundsMeters.depthZ <= entry.boxSize[2]);

      for (const url of [entry.assets.lod0, entry.assets.lod1]) {
        const file = publicFile(url);
        assert.ok(fs.existsSync(file), `missing ${url}`);
        const { data, json } = parseGlbJson(file);
        totalGlbBytes += data.length;
        assert.ok(data.length <= 64 * 1024, `${url} exceeds 64 KiB`);
        assert.ok(
          json.extensionsUsed?.includes("EXT_meshopt_compression"),
          `${url} is not meshopt-compressed`
        );
        assert.equal(json.textures?.length ?? 0, 0, `${url} has textures`);
        assert.equal(json.images?.length ?? 0, 0, `${url} has images`);
        assert.ok(
          (json.materials?.length ?? 0) <= 9,
          `${url} has too many materials`
        );
        const drawCount = (json.meshes ?? []).reduce(
          (count: number, mesh: { primitives?: unknown[] }) =>
            count + (mesh.primitives?.length ?? 0),
          0
        );
        assert.ok(drawCount <= 9, `${url} has ${drawCount} draw primitives`);
      }

      const icon = publicFile(entry.iconUrl);
      assert.ok(fs.existsSync(icon), `missing ${entry.iconUrl}`);
      assertPngContract(icon);
      assert.equal(
        fs.existsSync(
          publicFile(entry.assets.lod0.replace(/\.glb$/, ".raw.glb"))
        ),
        false,
        `${entry.itemId} leaked a raw GLB`
      );
    }
    assert.ok(
      totalGlbBytes <= 512 * 1024,
      `catalogue is ${totalGlbBytes} bytes`
    );
  });

  it("matches native inventory identity, Bikkie placement, and ECS collision order", () => {
    for (const [itemId, asset] of Object.entries(
      HARTHMERE_BUSINESS_FURNITURE_ASSETS
    )) {
      const nativeId = harthmereNativeBiomesIdForItemId(itemId);
      assert.ok(nativeId, `missing native identity for ${itemId}`);
      assert.equal(harthmereBusinessFurnitureAsset(nativeId), asset);

      const spec = getHarthmerePlaceableDecorSpec(itemId);
      assert.ok(spec, `missing placeable decor spec for ${itemId}`);
      assert.deepEqual(asset.boxSize, [
        spec!.footprint.width,
        spec!.footprint.height,
        spec!.footprint.depth,
      ]);

      const definition = getHarthmereItemDefinition(itemId);
      assert.ok(definition, `missing inventory definition for ${itemId}`);
      const biscuit = harthmereBiscuitForItemDefinition(definition!);
      assert.equal(biscuit.id, nativeId);
      assert.equal(biscuit.isPlaceable, true);
      assert.deepEqual(biscuit.boxSize, asset.boxSize);
      assert.deepEqual(biscuit.collidableSize, asset.collidableSize);
      assert.equal(biscuit.placementType, asset.placementType);
      assert.equal(biscuit.galoisIcon, asset.iconUrl);
      if (itemId === "town_cookpot" || itemId === "town_oven_range") {
        assert.equal(
          biscuit.isCraftingStation,
          true,
          `${itemId} must create a native F-interactable crafting station when placed`
        );
      }
    }
  });

  it("keeps the generated geometry manifest synchronous for import-time layouts", () => {
    const generated = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "src/shared/harthmere/generated/harthmere_business_furniture_manifest.ts"
      ),
      "utf8"
    );
    const generator = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "scripts/harthmere/blender/generate_business_furniture_catalogue.py"
      ),
      "utf8"
    );
    for (const source of [generated, generator]) {
      assert.doesNotMatch(source, /from ["']@\/shared\/ids["']/);
      assert.doesNotMatch(source, /harthmere_native_item_ids/);
      assert.match(source, /HARTHMERE_NATIVE_ITEM_ID_MANIFEST/);
    }
  });
});
