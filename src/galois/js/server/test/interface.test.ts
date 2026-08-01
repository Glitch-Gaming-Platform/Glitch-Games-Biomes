import type { AssetData } from "@/galois/interface/types/data";
import * as l from "@/galois/lang";
import { buildBatch, buildMap } from "@/galois/server/interface";
import type { AssetServer, BuildAssetFn } from "@/galois/server/interface";
import { LazyAssetServer } from "@/galois/server/lazy";
import assert from "assert";

describe("Galois asset server helpers", () => {
  it("encodes batches as an ordered List node", async () => {
    const assets = [l.toStr("first"), l.toStr("second")];
    let captured: l.Asset | undefined;
    const build = (async (query: l.Asset) => {
      captured = query;
      return [];
    }) as unknown as BuildAssetFn;

    await buildBatch(build, assets);

    assert(captured);
    assert(l.isDerived(captured));
    assert.strictEqual(captured.kind, "List");
    assert.deepStrictEqual(captured.deps, assets);
  });

  it("encodes maps as ordered key/value Tuple nodes", async () => {
    const first = l.toI32(1);
    const second = l.toI32(2);
    let captured: l.Asset | undefined;
    const build = (async (query: l.Asset) => {
      captured = query;
      return [];
    }) as unknown as BuildAssetFn;

    await buildMap(build, [
      ["first", first],
      ["second", second],
    ]);

    assert(captured);
    assert(l.isDerived(captured));
    assert.strictEqual(captured.kind, "List");
    assert.strictEqual(captured.deps.length, 2);

    const [firstTuple, secondTuple] = captured.deps;
    assert(l.isDerived(firstTuple));
    assert(l.isDerived(secondTuple));
    assert.strictEqual(firstTuple.kind, "Tuple");
    assert.strictEqual(secondTuple.kind, "Tuple");
    assert.deepStrictEqual(firstTuple.deps, [l.toStr("first"), first]);
    assert.deepStrictEqual(secondTuple.deps, [l.toStr("second"), second]);
  });

  it("creates one backing server and forwards build and stop", async () => {
    let createCount = 0;
    let buildCount = 0;
    let stopCount = 0;
    const result: AssetData = { kind: "GLTF", data: "mesh" };

    const backing: AssetServer = {
      build: (async () => {
        buildCount += 1;
        return result;
      }) as unknown as BuildAssetFn,
      async stop() {
        stopCount += 1;
      },
    };
    const lazy = new LazyAssetServer(() => {
      createCount += 1;
      return backing;
    });

    assert.strictEqual(createCount, 0);
    assert.strictEqual(await lazy.build(l.toStr("one")), result);
    assert.strictEqual(await lazy.build(l.toStr("two")), result);
    await lazy.stop();

    assert.strictEqual(createCount, 1);
    assert.strictEqual(buildCount, 2);
    assert.strictEqual(stopCount, 1);
  });
});
