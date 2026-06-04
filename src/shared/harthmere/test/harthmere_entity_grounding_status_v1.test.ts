// Tests for the tri-state grounding fix (quest items appearing above/below
// ground). The core bug was that when terrain had not streamed in, the grounder
// fell back to a flat authored Y. findHarthmereGroundFeetYWithStatusV1 now
// distinguishes "not-loaded" (defer/hide) from "no-surface" (keep authored Y).

import {
  findHarthmereGroundFeetYWithStatusV1,
  groundHarthmereEntityPositionV1,
  type HarthmereLoadedSamplerV1,
  type HarthmereSolidSamplerV1,
} from "@/shared/harthmere/harthmere_entity_grounding_v1";
import assert from "assert";

// A synthetic world: solid for all y < surfaceY at (x,z); air at/above. Columns
// listed in `unloaded` report not-loaded for every y (terrain not streamed).
function makeWorld(opts: {
  surfaceY: (x: number, z: number) => number | undefined; // undefined => unloaded column
}): { isSolid: HarthmereSolidSamplerV1; isLoaded: HarthmereLoadedSamplerV1 } {
  const isLoaded: HarthmereLoadedSamplerV1 = (x, _y, z) =>
    opts.surfaceY(x, z) !== undefined;
  const isSolid: HarthmereSolidSamplerV1 = (x, y, z) => {
    const s = opts.surfaceY(x, z);
    if (s === undefined) {
      // Mirrors the real bug: unloaded shards read as solid.
      return true;
    }
    return y < s;
  };
  return { isSolid, isLoaded };
}

describe("harthmere grounding tri-state (quest item visibility)", () => {
  it("grounds onto the real surface below the authored hint", () => {
    const { isSolid, isLoaded } = makeWorld({ surfaceY: () => 53 });
    const r = findHarthmereGroundFeetYWithStatusV1(isSolid, isLoaded, 10, 10, {
      hintY: 70, // authored flat Y, well above real surface
    });
    assert.strictEqual(r.status, "grounded");
    assert.strictEqual(r.feetY, 53);
  });

  it("climbs out when the authored hint is buried inside terrain", () => {
    const { isSolid, isLoaded } = makeWorld({ surfaceY: () => 60 });
    const r = findHarthmereGroundFeetYWithStatusV1(isSolid, isLoaded, 1, 1, {
      hintY: 54, // below the surface, i.e. buried
    });
    assert.strictEqual(r.status, "grounded");
    assert.strictEqual(r.feetY, 60);
  });

  it("returns not-loaded (defer) instead of stamping the flat Y when terrain is unstreamed", () => {
    // Entire column unloaded -> old code returned undefined -> caller kept flat
    // authored Y (the float/sink bug). Now it is explicitly not-loaded.
    const { isSolid, isLoaded } = makeWorld({ surfaceY: () => undefined });
    const r = findHarthmereGroundFeetYWithStatusV1(isSolid, isLoaded, 5, 5, {
      hintY: 53,
    });
    assert.strictEqual(r.status, "not-loaded");
    assert.strictEqual(r.feetY, undefined);
  });

  it("returns no-surface when terrain IS loaded but no standable column exists (all air)", () => {
    // Loaded everywhere, but surface is far below the scan budget => genuinely
    // no surface in range; keep authored Y (do NOT mis-label as not-loaded).
    const { isSolid, isLoaded } = makeWorld({ surfaceY: () => -9999 });
    const r = findHarthmereGroundFeetYWithStatusV1(isSolid, isLoaded, 5, 5, {
      hintY: 53,
      maxScanDown: 8,
      maxScanUp: 8,
    });
    assert.strictEqual(r.status, "no-surface");
  });

  it("rejects a cave floor when requireOpenSky is set", () => {
    // Surface at 53, but a solid ceiling 3 blocks above the feet => cave.
    const isLoaded: HarthmereLoadedSamplerV1 = () => true;
    const isSolid: HarthmereSolidSamplerV1 = (_x, y) =>
      y < 53 || (y >= 56 && y <= 70); // ground below 53, ceiling slab 56..70
    const r = findHarthmereGroundFeetYWithStatusV1(isSolid, isLoaded, 0, 0, {
      hintY: 54,
      requireOpenSky: true,
      maxScanDown: 4,
      maxScanUp: 4,
    });
    assert.strictEqual(r.status, "no-surface", "cave floor must be rejected");
  });

  it("grounds (not not-loaded) even if far voxels are unloaded, as long as a real surface is found", () => {
    // Loaded near the hint with a surface at 52; pretend a faraway column query
    // is unloaded — but since a surface IS found, status must be grounded.
    const isLoaded: HarthmereLoadedSamplerV1 = (_x, y) => y > 40; // deep voxels "unloaded"
    const isSolid: HarthmereSolidSamplerV1 = (_x, y) => y < 52;
    const r = findHarthmereGroundFeetYWithStatusV1(isSolid, isLoaded, 0, 0, {
      hintY: 55,
    });
    assert.strictEqual(r.status, "grounded");
    assert.strictEqual(r.feetY, 52);
  });

  it("groundHarthmereEntityPositionV1 keeps the original Y on no surface (no teleport)", () => {
    const { isSolid } = makeWorld({ surfaceY: () => -9999 });
    const pos = groundHarthmereEntityPositionV1(isSolid, [12, 53, -8], {
      maxScanDown: 4,
      maxScanUp: 4,
    });
    assert.deepStrictEqual(pos, [12, 53, -8]);
  });
});
