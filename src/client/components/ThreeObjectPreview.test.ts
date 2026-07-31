/// <reference types="mocha" />

import { objectPreviewRenderScale } from "@/client/components/object_preview_render_scale";
import assert from "assert";

describe("object preview render scale", () => {
  it("caps low-memory/mobile previews at 1x", () => {
    assert.equal(
      objectPreviewRenderScale({
        devicePixelRatio: 3,
        lowMemory: true,
      }),
      1
    );
  });

  it("preserves normal desktop Retina previews", () => {
    assert.equal(
      objectPreviewRenderScale({
        devicePixelRatio: 2,
        lowMemory: false,
      }),
      2
    );
  });

  it("honors an explicit render scale on every device", () => {
    assert.equal(
      objectPreviewRenderScale({
        renderScale: 0.5,
        devicePixelRatio: 3,
        lowMemory: true,
      }),
      0.5
    );
  });
});
