import {
  resolveRemoteOobFetchUrlV1,
  useSameOriginOobFetchV1,
} from "@/shared/api/oob";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

const userId = 123 as BiomesId;

describe("RemoteOobFetcher URL routing", () => {
  it("keeps production OOB same-origin without a dev user query", () => {
    assert.equal(
      resolveRemoteOobFetchUrlV1({
        hostname: "example.com",
        nodeEnv: "production",
        oobPort: "4700",
        userId,
      }),
      "/sync/oob"
    );
  });

  it("keeps ordinary dev OOB on the configured OOB port", () => {
    assert.equal(
      resolveRemoteOobFetchUrlV1({
        hostname: "localhost",
        nodeEnv: "development",
        oobPort: "4700",
        userId,
      }),
      "http://localhost:4700/sync/oob?u=123"
    );
  });

  it("uses the web same-origin OOB proxy in Glitch and snapshot visual runs", () => {
    for (const options of [
      { nextPublicGlitchRuntime: "1" },
      { nextPublicGlitchLocalAssets: "1" },
      { nextPublicGlitchDisableGcp: "1" },
      { nextPublicBiomesSnapshotMergeMode: "1" },
    ]) {
      assert.equal(
        useSameOriginOobFetchV1({
          hostname: "localhost",
          nodeEnv: "development",
          oobPort: "4700",
          userId,
          ...options,
        }),
        true
      );
      assert.equal(
        resolveRemoteOobFetchUrlV1({
          hostname: "localhost",
          nodeEnv: "development",
          oobPort: "4700",
          userId,
          ...options,
        }),
        "/sync/oob?u=123"
      );
    }
  });
});
