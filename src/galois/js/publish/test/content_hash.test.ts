/// <reference types="mocha" />
import { toPublicAssetPath } from "@/galois/publish/static";
import {
  AssetContentPathGuard,
  assetContentHash,
  assetContentHashIsLegacySafe,
  legacyAssetContentHash,
  publishedAssetContentHash,
  useLegacyAssetContentHash,
} from "@/galois/publish/content_hash";
import assert from "assert";
import { createHash } from "crypto";

// HARTHMERE_ASSET_CONTENT_HASH (2026-08-04 asset loading audit, finding 10)
//
// Publication names objects by content hash and then treats those names as
// immutable. The old hash decoded binary payloads as UTF-8 first, so it was a
// hash of a lossy projection: different bytes could produce the same name.

const md5 = (b: Buffer | string) =>
  createHash("md5")
    .update(typeof b === "string" ? Buffer.from(b, "utf8") : b)
    .digest("hex");

const testEnv = (
  values: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv => ({ NODE_ENV: "test", ...values });

describe("published asset content hashing", () => {
  describe("byte exactness", () => {
    it("hashes binary payloads over their raw bytes", () => {
      const data = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0xc8, 0x4d]);
      assert.equal(assetContentHash(data), md5(data));
    });

    it("distinguishes binaries that the legacy hash aliased", () => {
      // Two different invalid-UTF-8 sequences. Both decode to U+FFFD runs, so
      // the legacy hash cannot tell them apart -- this is the actual bug.
      const a = Buffer.from([0xff, 0xfe, 0xfd]);
      const b = Buffer.from([0xfe, 0xff, 0xfc]);

      assert.equal(
        legacyAssetContentHash(a),
        legacyAssetContentHash(b),
        "precondition: the legacy hash aliases these two payloads"
      );
      assert.notEqual(
        assetContentHash(a),
        assetContentHash(b),
        "the corrected hash must separate them"
      );
    });

    it("changes when a single byte inside an invalid-UTF-8 run changes", () => {
      const before = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00]);
      const after = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xfe, 0x00]);
      assert.notEqual(assetContentHash(before), assetContentHash(after));
    });

    it("is stable across calls and independent of Buffer views", () => {
      const backing = Buffer.from([9, 9, 1, 2, 3, 9, 9]);
      const view = backing.subarray(2, 5);
      assert.equal(assetContentHash(view), md5(Buffer.from([1, 2, 3])));
      assert.equal(assetContentHash(view), assetContentHash(view));
    });
  });

  describe("compatibility with already-published names", () => {
    // The migration cost is bounded by this: string payloads (742 JSON + 108
    // GLTF objects in the current index) must keep the exact names they have,
    // so publishing after this change does not churn them.
    for (const sample of [
      "hello",
      '{"kind":"GLTFItemMesh","data":{"kind":"GLB","data":"AAEC"}}',
      "héllo — em dash",
      "ÿþ latin-1 range",
      "",
    ]) {
      it(`preserves the legacy hash for string payload ${JSON.stringify(
        sample.slice(0, 24)
      )}`, () => {
        assert.equal(assetContentHash(sample), legacyAssetContentHash(sample));
      });
    }

    it("preserves the legacy hash for buffers that are valid UTF-8", () => {
      const data = Buffer.from("a valid utf-8 payload — with punctuation");
      assert.equal(assetContentHash(data), legacyAssetContentHash(data));
      assert.equal(assetContentHashIsLegacySafe(data), true);
    });

    it("reports binary payloads as unsafe under the legacy hash", () => {
      assert.equal(
        assetContentHashIsLegacySafe(Buffer.from([0x89, 0xff, 0x00])),
        false
      );
      assert.equal(assetContentHashIsLegacySafe("any string"), true);
    });
  });

  describe("escape hatch", () => {
    it("is off unless explicitly set to 1", () => {
      assert.equal(useLegacyAssetContentHash(testEnv()), false);
      assert.equal(
        useLegacyAssetContentHash(
          testEnv({ BIOMES_LEGACY_ASSET_CONTENT_HASH: "true" })
        ),
        false
      );
      assert.equal(
        useLegacyAssetContentHash(
          testEnv({ BIOMES_LEGACY_ASSET_CONTENT_HASH: "1" })
        ),
        true
      );
    });

    it("selects the legacy hash when set", () => {
      const data = Buffer.from([0xff, 0xfe]);
      assert.equal(
        publishedAssetContentHash(
          data,
          testEnv({ BIOMES_LEGACY_ASSET_CONTENT_HASH: "1" })
        ),
        legacyAssetContentHash(data)
      );
      assert.equal(
        publishedAssetContentHash(data, testEnv()),
        assetContentHash(data)
      );
    });
  });

  describe("content path construction", () => {
    it("keeps the logical path, hash and extension layout", () => {
      const path = toPublicAssetPath("placeables/camping/campfire", {
        extension: "glb",
        data: Buffer.from([1, 2, 3]),
      });
      assert.equal(
        path,
        `asset_data/placeables/camping/campfire.${md5(
          Buffer.from([1, 2, 3])
        )}.glb`
      );
    });

    it("gives changed bytes a different path (publication invariant 4)", () => {
      const a = toPublicAssetPath("icons/items/axe", {
        extension: "png",
        data: Buffer.from([0x89, 0x50, 0xff, 0x01]),
      });
      const b = toPublicAssetPath("icons/items/axe", {
        extension: "png",
        data: Buffer.from([0x89, 0x50, 0xff, 0x02]),
      });
      assert.notEqual(a, b);
    });

    it("gives unchanged bytes the same path (publication invariant 3)", () => {
      const output = { extension: "png", data: Buffer.from([1, 2, 3]) };
      assert.equal(
        toPublicAssetPath("icons/items/axe", output),
        toPublicAssetPath("icons/items/axe", { ...output })
      );
    });
  });

  describe("AssetContentPathGuard", () => {
    it("allows the same payload to claim a path twice", () => {
      const guard = new AssetContentPathGuard();
      guard.claim("asset_data/a.hash.png", "icons/a", Buffer.from([1, 2]));
      guard.claim("asset_data/a.hash.png", "icons/a", Buffer.from([1, 2]));
      assert.equal(guard.size, 1);
    });

    it("throws when two different payloads claim one immutable path", () => {
      const guard = new AssetContentPathGuard();
      guard.claim("asset_data/a.hash.png", "icons/a", Buffer.from([1, 2]));
      assert.throws(
        () =>
          guard.claim("asset_data/a.hash.png", "icons/b", Buffer.from([3, 4])),
        /Content path collision/
      );
    });

    it("names both logical assets in the error so it can be fixed", () => {
      const guard = new AssetContentPathGuard();
      guard.claim("asset_data/x.h.glb", "npcs/first", Buffer.from([1]));
      assert.throws(
        () =>
          guard.claim("asset_data/x.h.glb", "npcs/second", Buffer.from([2])),
        /npcs\/first[\s\S]*npcs\/second/
      );
    });

    it("compares strings and buffers by their bytes", () => {
      const guard = new AssetContentPathGuard();
      guard.claim("asset_data/j.h.json", "indices/a", '{"a":1}');
      guard.claim("asset_data/j.h.json", "indices/a", Buffer.from('{"a":1}'));
      assert.equal(guard.size, 1);
    });
  });
});
