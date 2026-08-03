/// <reference types="mocha" />
import { getWebGlRendererInfo } from "@/client/renderer/webgl_renderer_info";
import assert from "assert";

function fakeContext({
  debugExtension = true,
}: {
  debugExtension?: boolean;
} = {}) {
  const values = new Map<number, string>([
    [1, "Masked renderer"],
    [2, "Masked vendor"],
    [3, "Actual renderer"],
    [4, "Actual vendor"],
  ]);
  return {
    RENDERER: 1,
    VENDOR: 2,
    getParameter: (parameter: number) => values.get(parameter),
    getExtension: () =>
      debugExtension
        ? {
            UNMASKED_RENDERER_WEBGL: 3,
            UNMASKED_VENDOR_WEBGL: 4,
          }
        : null,
  } as unknown as WebGL2RenderingContext;
}

describe("WebGL renderer diagnostics", () => {
  it("reports the unmasked active renderer separately from masked values", () => {
    assert.deepEqual(getWebGlRendererInfo(fakeContext()), {
      renderer: "Actual renderer",
      vendor: "Actual vendor",
      maskedRenderer: "Masked renderer",
      maskedVendor: "Masked vendor",
    });
  });

  it("falls back to masked renderer information when privacy blocks the extension", () => {
    assert.deepEqual(
      getWebGlRendererInfo(fakeContext({ debugExtension: false })),
      {
        renderer: "Masked renderer",
        vendor: "Masked vendor",
        maskedRenderer: "Masked renderer",
        maskedVendor: "Masked vendor",
      }
    );
  });
});
