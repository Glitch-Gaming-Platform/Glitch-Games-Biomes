/// <reference types="mocha" />
import {
  hasSharedGltf,
  loadSharedGltf,
  loadSharedGltfWithRetry,
  resetSharedGltfCacheForTest,
  sharedGltfCacheStats,
} from "@/client/game/util/gltf_prototype_cache";
import assert from "assert";
import fs from "fs";
import path from "path";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// HARTHMERE_GLTF_PROTOTYPE_CACHE (2026-08-04 asset loading audit, finding 6)
//
// The bug being locked down: `/scene/npc/mesh` is keyed by entity id, so N
// entities sharing one asset produced N loads, N parses and N GPU uploads. These
// tests assert the dedupe, the one-time preparation, and -- just as important --
// that a failure is NOT cached, because the previous per-entity code recovered
// from transient failures by simply trying again on the next entity.

function fakeGltf(tag: string): GLTF {
  // Minimal structural stand-in: the cache never touches three.js internals, it
  // only stores and hands back whatever the loader produced.
  return {
    scene: { userData: {} as Record<string, unknown>, name: tag },
    scenes: [],
    animations: [],
    cameras: [],
    asset: {},
    parser: undefined,
    userData: {},
  } as unknown as GLTF;
}

describe("shared GLTF prototype cache", () => {
  beforeEach(() => resetSharedGltfCacheForTest());
  afterEach(() => resetSharedGltfCacheForTest());

  it("loads a URL once no matter how many entities ask for it", async () => {
    let loads = 0;
    const load = async (url: string) => {
      loads += 1;
      return fakeGltf(url);
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        loadSharedGltf("/assets/mucker.glb", { load })
      )
    );

    assert.equal(loads, 1, "twenty muckers must produce one parse");
    for (const result of results) {
      assert.equal(result, results[0], "every caller shares one prototype");
    }
    assert.deepEqual(sharedGltfCacheStats(), {
      resident: 1,
      loads: 1,
      hits: 19,
      failures: 0,
    });
  });

  it("coalesces concurrent requests that arrive before the first resolves", async () => {
    let loads = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const load = async (url: string) => {
      loads += 1;
      await gate;
      return fakeGltf(url);
    };

    const a = loadSharedGltf("/assets/boss.glb", { load });
    const b = loadSharedGltf("/assets/boss.glb", { load });
    assert.equal(loads, 1, "the second caller must join the in-flight load");
    release!();
    assert.equal(await a, await b);
  });

  it("runs asset-level preparation exactly once", async () => {
    let prepared = 0;
    const load = async (url: string) => fakeGltf(url);
    const prepare = (gltf: GLTF) => {
      prepared += 1;
      (gltf.scene.userData as Record<string, unknown>).prepared = true;
    };

    const first = await loadSharedGltf("/assets/npc.glb", { load, prepare });
    await loadSharedGltf("/assets/npc.glb", { load, prepare });
    await loadSharedGltf("/assets/npc.glb", { load, prepare });

    assert.equal(prepared, 1);
    assert.equal(first.scene.userData.prepared, true);
  });

  it("never hands out a prototype before preparation has run", async () => {
    // Rule 2 of the cache contract: a caller must not be able to observe an
    // unprepared prototype, or an NPC would render with the wrong material for
    // one frame.
    const load = async (url: string) => fakeGltf(url);
    const gltf = await loadSharedGltf("/assets/ordered.glb", {
      load,
      prepare: (loaded) => {
        (loaded.scene.userData as Record<string, unknown>).material = "player";
      },
    });
    assert.equal(gltf.scene.userData.material, "player");
  });

  it("keeps variants of the same URL separate", async () => {
    const load = async (url: string) => fakeGltf(url);
    const a = await loadSharedGltf("/assets/shared.glb", {
      load,
      variant: "boss",
      prepare: (g) => ((g.scene.userData as any).kind = "boss"),
    });
    const b = await loadSharedGltf("/assets/shared.glb", {
      load,
      variant: "creature",
      prepare: (g) => ((g.scene.userData as any).kind = "creature"),
    });
    assert.notEqual(a, b);
    assert.equal(a.scene.userData.kind, "boss");
    assert.equal(b.scene.userData.kind, "creature");
    assert.equal(sharedGltfCacheStats().loads, 2);
  });

  it("does not cache failures, so a later entity can still succeed", async () => {
    let attempt = 0;
    const load = async (url: string) => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("transient 503");
      }
      return fakeGltf(url);
    };

    await assert.rejects(
      () => loadSharedGltf("/assets/flaky.glb", { load }),
      /transient 503/
    );
    assert.equal(hasSharedGltf("/assets/flaky.glb"), false);

    const recovered = await loadSharedGltf("/assets/flaky.glb", { load });
    assert.ok(recovered);
    assert.equal(sharedGltfCacheStats().failures, 1);
    assert.equal(sharedGltfCacheStats().resident, 1);
  });

  it("propagates the failure to every caller waiting on it", async () => {
    const load = async () => {
      throw new Error("boom");
    };
    const a = loadSharedGltf("/assets/broken.glb", { load });
    const b = loadSharedGltf("/assets/broken.glb", { load });
    await assert.rejects(() => a, /boom/);
    await assert.rejects(() => b, /boom/);
  });

  it("passes the retry policy through to the loader", async () => {
    let attempts = 0;
    const load = async (url: string) => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("retry me");
      }
      return fakeGltf(url);
    };
    const result = await Promise.all([
      loadSharedGltfWithRetry("/assets/retry.glb", {
        attempts: 2,
        delayMs: 0,
        load,
      }),
      loadSharedGltfWithRetry("/assets/retry.glb", {
        attempts: 2,
        delayMs: 0,
        load,
      }),
    ]);
    assert.equal(
      attempts,
      2,
      "one shared load should make exactly two attempts"
    );
    assert.equal(result[0], result[1]);
  });

  it("evicts a prototype when one-time preparation fails", async () => {
    const load = async (url: string) => fakeGltf(url);
    await assert.rejects(
      () =>
        loadSharedGltf("/assets/bad-prepare.glb", {
          load,
          prepare: () => {
            throw new Error("bad material setup");
          },
        }),
      /bad material setup/
    );
    assert.equal(hasSharedGltf("/assets/bad-prepare.glb"), false);
    assert.ok(await loadSharedGltf("/assets/bad-prepare.glb", { load }));
  });

  it("reports residency for diagnostics", async () => {
    const load = async (url: string) => fakeGltf(url);
    await loadSharedGltf("/a.glb", { load });
    await loadSharedGltf("/b.glb", { load });
    assert.equal(sharedGltfCacheStats().resident, 2);
    assert.equal(hasSharedGltf("/a.glb"), true);
    assert.equal(hasSharedGltf("/missing.glb"), false);
  });
});

// Source contracts. The behavioural tests above cannot reach into
// resources/npcs.ts without a full client context, but the regression that
// matters is precisely "somebody called loadGltf directly again", which is
// visible in the source.
describe("entity-keyed NPC mesh branches use the shared prototype cache", () => {
  const npcs = fs.readFileSync(
    path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
    "utf8"
  );

  const branches: Array<[string, string]> = [
    ["snapshot Grove NPCs", "makeSnapshotGroveNpcAssetMesh"],
    ["muck creatures", "makeHarthmereMuckCreatureNpcAssetMesh"],
    ["boss visuals", "makeHarthmereBossNpcAssetMesh"],
  ];

  for (const [label, fn] of branches) {
    it(`${label} load through loadSharedGltf`, () => {
      const start = npcs.indexOf(`function ${fn}(`);
      assert.ok(start > 0, `${fn} not found`);
      const body = npcs.slice(start, npcs.indexOf("\n}\n", start));
      assert.match(
        body,
        /loadSharedGltf(WithRetry)?\(/,
        `${fn} must not call the loader directly; see gltf_prototype_cache.ts`
      );
      assert.doesNotMatch(body, /await loadGltf(WithRetry)?\(/);
    });
  }

  it("keeps the per-entity clone step that makes sharing safe", () => {
    // If this ever stops cloning, sharing a prototype becomes a correctness bug
    // rather than an optimization: every NPC would share one transform.
    assert.match(
      npcs,
      /export function makeMixedNpcMesh[\s\S]{0,200}SkeletonUtils\.clone\(gltfToThree\(gltf\)\)/
    );
  });

  it("does not dispose shared prototypes", () => {
    // gltfDispose on a shared prototype would free geometry still referenced by
    // live clones. The type-mesh path owns its own disposable GLTF; the shared
    // branches must not.
    for (const [, fn] of branches) {
      const start = npcs.indexOf(`function ${fn}(`);
      const body = npcs.slice(start, npcs.indexOf("\n}\n", start));
      assert.doesNotMatch(body, /gltfDispose/);
    }
  });

  it("shares clothing GLBs across wearers", () => {
    const playerMesh = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/resources/player_mesh.ts"),
      "utf8"
    );
    const start = playerMesh.indexOf(
      "async function loadHarthmerePlayerClothingModel("
    );
    assert.ok(start > 0);
    const body = playerMesh.slice(start, playerMesh.indexOf("\n}\n", start));
    assert.match(body, /loadSharedGltf\(/);
    assert.match(body, /SkeletonUtils\.clone/);
  });
});
