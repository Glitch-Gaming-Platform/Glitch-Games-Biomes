import { isUsableCursorRay } from "@/client/game/helpers/cursor_ray";
import assert from "assert";

describe("Chapter 1 cutscene cursor-ray resilience", () => {
  it("accepts a finite nonzero camera ray", () => {
    assert.strictEqual(
      isUsableCursorRay([42, 44, -41], [0.2, -0.1, -0.97]),
      true
    );
  });

  it("rejects non-finite and zero rays before voxel marching", () => {
    assert.strictEqual(isUsableCursorRay([NaN, 44, -41], [0, 0, -1]), false);
    assert.strictEqual(
      isUsableCursorRay([42, 44, -41], [0, Infinity, -1]),
      false
    );
    assert.strictEqual(isUsableCursorRay([42, 44, -41], [0, 0, 0]), false);
  });
});
