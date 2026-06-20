/// <reference types="mocha" />

import assert from "assert";

import { resolveHarthmereNpcGroundedFeetY } from "@/client/game/util/harthmere_entity_grounding";

describe("resolveHarthmereNpcGroundedFeetY (kill-target grounding stability)", () => {
  it("grounds to the real surface and caches it", () => {
    const out = resolveHarthmereNpcGroundedFeetY(
      { status: "grounded", feetY: 14 },
      undefined
    );
    assert.equal(out.feetY, 14);
    assert.equal(out.cache, 14);
  });

  it("keeps the last real surface while terrain is not loaded (no pop to authored Y)", () => {
    // The monster already settled on the breach floor at Y=14; its shard then
    // unloads. It must stay at 14, not pop back to the flat authored Y.
    const out = resolveHarthmereNpcGroundedFeetY(
      { status: "not-loaded" },
      14
    );
    assert.equal(out.feetY, 14);
    assert.equal(out.cache, 14);
  });

  it("defers (keeps authored Y) when terrain is not loaded and never grounded", () => {
    const out = resolveHarthmereNpcGroundedFeetY(
      { status: "not-loaded" },
      undefined
    );
    assert.equal(out.feetY, undefined);
    assert.equal(out.cache, undefined);
  });

  it("keeps authored Y on a genuinely surfaceless column without poisoning the cache", () => {
    const out = resolveHarthmereNpcGroundedFeetY(
      { status: "no-surface" },
      14
    );
    assert.equal(out.feetY, undefined);
    assert.equal(out.cache, 14);
  });

  it("re-grounds to a new surface after the column changes height", () => {
    let cache: number | undefined;
    cache = resolveHarthmereNpcGroundedFeetY({ status: "grounded", feetY: 14 }, cache).cache;
    const out = resolveHarthmereNpcGroundedFeetY({ status: "grounded", feetY: 48 }, cache);
    assert.equal(out.feetY, 48);
    assert.equal(out.cache, 48);
  });
});
