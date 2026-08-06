/// <reference types="mocha" />

import {
  shouldRenderThreeObjectPreview,
  threeObjectPreviewDeltaSeconds,
} from "@/client/components/ThreeObjectPreview";
import assert from "assert";
import fs from "fs";
import path from "path";

describe("ThreeObjectPreview performance lifecycle", () => {
  it("renders only while the preview is visible, intersecting, and laid out", () => {
    assert.equal(
      shouldRenderThreeObjectPreview({
        documentVisible: true,
        intersecting: true,
        hasLayout: true,
      }),
      true
    );
    for (const hidden of [
      { documentVisible: false, intersecting: true, hasLayout: true },
      { documentVisible: true, intersecting: false, hasLayout: true },
      { documentVisible: true, intersecting: true, hasLayout: false },
    ]) {
      assert.equal(shouldRenderThreeObjectPreview(hidden), false);
    }
  });

  it("uses a bounded manual frame delta instead of one THREE.Clock per preview", () => {
    assert.equal(threeObjectPreviewDeltaSeconds(undefined, 1_000), 0);
    assert.equal(threeObjectPreviewDeltaSeconds(1_000, 1_016), 0.016);
    assert.equal(threeObjectPreviewDeltaSeconds(1_000, 2_000), 0.1);
    assert.equal(threeObjectPreviewDeltaSeconds(2_000, 1_000), 0);
  });

  it("does not allocate a renderer before visibility or keep hidden previews on RAF", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/client/components/ThreeObjectPreview.tsx"),
      "utf8"
    );
    assert.doesNotMatch(source, /new THREE\.Clock\(/);
    assert.match(source, /this\.intersecting = false/);
    assert.match(source, /new IntersectionObserver/);
    assert.match(source, /setTimeout\(this\.renderFrame, 250\)/);
    assert.match(source, /this\.shutdownRenderer\(\)/);
  });
});
