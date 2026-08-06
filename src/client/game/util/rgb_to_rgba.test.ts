/// <reference types="mocha" />
import {
  expandRgbToRgba,
  isLittleEndian,
} from "@/client/game/util/rgb_to_rgba";
import assert from "assert";

// HARTHMERE_ATLAS_RGBA_EXPANSION (2026-08-04 asset loading audit, finding 13)
//
// Terrain atlas colors must remain byte-exact while the hot conversion moves
// from four byte writes per pixel to one 32-bit write on little-endian hosts.

describe("RGB atlas expansion", () => {
  it("reports a stable platform byte order", () => {
    assert.equal(isLittleEndian(), isLittleEndian());
  });

  it("expands RGB pixels to opaque RGBA byte-for-byte", () => {
    assert.deepEqual(
      [...expandRgbToRgba(Uint8Array.from([1, 2, 3, 250, 128, 0]))],
      [1, 2, 3, 255, 250, 128, 0, 255]
    );
  });

  it("keeps the scalar big-endian fallback visually identical", () => {
    const rgb = Uint8Array.from([10, 20, 30, 40, 50, 60]);
    assert.deepEqual(
      [...expandRgbToRgba(rgb, false)],
      [...expandRgbToRgba(rgb, true)]
    );
  });

  it("does not mutate the fetched RGB payload", () => {
    const rgb = Uint8Array.from([4, 5, 6]);
    expandRgbToRgba(rgb);
    assert.deepEqual([...rgb], [4, 5, 6]);
  });

  it("supports an empty atlas payload", () => {
    assert.deepEqual([...expandRgbToRgba(new Uint8Array())], []);
  });

  it("rejects malformed partial pixels instead of silently truncating", () => {
    assert.throws(
      () => expandRgbToRgba(Uint8Array.from([1, 2, 3, 4])),
      /divisible by 3/
    );
  });
});
