/// <reference types="mocha" />
import assert from "assert";
import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  shouldCompressHttpResponses,
} = require("@/../config/http_compression.cjs") as {
  shouldCompressHttpResponses: (env?: Record<string, string>) => boolean;
};

// HARTHMERE_ASSET_TRANSPORT_COMPRESSION (2026-08-04 asset loading audit)
//
// The regression this guards is specific: `compress: !isProd` meant the ONE
// environment that needs origin compression (production, `next start`, no
// nginx) was the one environment that did not get it. A test that only exercises
// the development branch would have stayed green through the entire outage, so
// every case below names its environment explicitly.
describe("HTTP response compression", () => {
  it("compresses in production, which is where the origin has no proxy", () => {
    assert.equal(shouldCompressHttpResponses({ NODE_ENV: "production" }), true);
  });

  it("compresses in development too, so local numbers resemble production", () => {
    assert.equal(shouldCompressHttpResponses({ NODE_ENV: "development" }), true);
    assert.equal(shouldCompressHttpResponses({}), true);
    assert.equal(shouldCompressHttpResponses(), true);
  });

  it("only defers to a proxy via the explicit opt-in flag", () => {
    assert.equal(
      shouldCompressHttpResponses({
        NODE_ENV: "production",
        BIOMES_ORIGIN_HAS_COMPRESSING_PROXY: "1",
      }),
      false
    );
    // Anything other than the exact "1" must keep compressing: a half-set or
    // typo'd env var must fail safe (compressed), not silently fail open.
    assert.equal(
      shouldCompressHttpResponses({
        NODE_ENV: "production",
        BIOMES_ORIGIN_HAS_COMPRESSING_PROXY: "true",
      }),
      true
    );
  });

  it("is what next.config.js actually wires up", () => {
    // next.config.js cannot be imported here without evaluating next-pwa and the
    // whole webpack config, so pin the wiring as a source contract instead.
    const config = fs.readFileSync(
      path.join(process.cwd(), "next.config.js"),
      "utf8"
    );
    assert.match(config, /require\("\.\/config\/http_compression\.cjs"\)/);
    assert.match(config, /compress: shouldCompressHttpResponses\(process\.env\)/);
    assert.doesNotMatch(
      config,
      /compress:\s*!isProd/,
      "compress must not be re-tied to NODE_ENV; see config/http_compression.cjs"
    );
  });
});
