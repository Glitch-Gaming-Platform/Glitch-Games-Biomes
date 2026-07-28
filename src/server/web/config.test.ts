import assert from "assert";
import { assetExportWorkerPoolSize } from "@/server/web/config";

describe("web asset export worker pool", () => {
  it("uses all production CPUs by default", () => {
    assert.equal(assetExportWorkerPoolSize(10, {}, "production"), 10);
  });

  it("allows a bounded focused-stack override", () => {
    assert.equal(
      assetExportWorkerPoolSize(
        10,
        { GLITCH_ASSET_EXPORT_WORKERS: "1" },
        "production"
      ),
      1
    );
    assert.equal(
      assetExportWorkerPoolSize(
        4,
        { GLITCH_ASSET_EXPORT_WORKERS: "99" },
        "production"
      ),
      4
    );
  });

  it("ignores invalid overrides", () => {
    assert.equal(
      assetExportWorkerPoolSize(
        8,
        { GLITCH_ASSET_EXPORT_WORKERS: "nope" },
        "development"
      ),
      7
    );
  });
});
