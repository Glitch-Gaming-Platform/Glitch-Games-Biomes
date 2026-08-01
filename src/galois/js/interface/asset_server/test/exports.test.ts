import {
  assetDataToDataWithMimeType,
  InvalidAssetExportServer,
  LazyAssetExportsServer,
} from "@/galois/interface/asset_server/exports";
import type { AssetExportsServer } from "@/galois/interface/asset_server/exports";
import type { AssetDataWithKind } from "@/galois/interface/types/data";
import type { SlotToWearableMap } from "@/shared/api/assets";
import assert from "assert";

const emptyWearables: SlotToWearableMap = new Map();

describe("Galois runtime asset exports", () => {
  it("fails explicitly when runtime exports are disabled", () => {
    const server = new InvalidAssetExportServer();

    assert.throws(() => server.build(), /Asset server not enabled/);
  });

  it("creates the runtime exporter lazily and forwards appearance arguments", async () => {
    let createCount = 0;
    const calls: unknown[][] = [];
    const result: AssetDataWithKind = {
      kind: "GLB",
      data: Buffer.from("mesh").toString("base64"),
    };
    const delegate: AssetExportsServer = {
      async build(...args) {
        calls.push(args);
        return result;
      },
      async stop() {},
    };
    const server = new LazyAssetExportsServer(async () => {
      createCount += 1;
      return delegate;
    });

    assert.strictEqual(createCount, 0);
    assert.strictEqual(
      await server.build(
        "wearables/animated_player_mesh",
        emptyWearables,
        "skin",
        "eyes",
        "hair"
      ),
      result
    );
    assert.strictEqual(
      await server.build("wearables/animated_player_mesh", emptyWearables),
      result
    );

    assert.strictEqual(createCount, 1);
    assert.deepStrictEqual(calls, [
      [
        "wearables/animated_player_mesh",
        emptyWearables,
        "skin",
        "eyes",
        "hair",
      ],
      [
        "wearables/animated_player_mesh",
        emptyWearables,
        undefined,
        undefined,
        undefined,
      ],
    ]);
  });

  it("does not create a lazy exporter merely to stop it", async () => {
    let createCount = 0;
    const server = new LazyAssetExportsServer(async () => {
      createCount += 1;
      throw new Error("should not be created");
    });

    await server.stop();

    assert.strictEqual(createCount, 0);
  });

  it("converts supported response kinds to HTTP bodies and MIME types", () => {
    assert.deepStrictEqual(
      assetDataToDataWithMimeType({ kind: "GLTF", data: "{}" }),
      ["{}", "model/gltf"]
    );

    const glb = Buffer.from("binary glb");
    const [glbData, glbMime] = assetDataToDataWithMimeType({
      kind: "GLB",
      data: glb.toString("base64"),
    });
    assert(Buffer.isBuffer(glbData));
    assert.deepStrictEqual(glbData, glb);
    assert.strictEqual(glbMime, "model/gltf");

    assert.deepStrictEqual(
      assetDataToDataWithMimeType({
        kind: "JSON",
        data: { ready: true },
      } as AssetDataWithKind),
      ['{"ready":true}', "application/json"]
    );
  });

  it("rejects kinds without an explicit HTTP representation", () => {
    assert.throws(
      () =>
        assetDataToDataWithMimeType({
          kind: "PNG",
          data: "base64",
        }),
      /Unimplemented conversion to content type for "PNG"/
    );
  });
});
