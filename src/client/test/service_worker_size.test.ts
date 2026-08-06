/// <reference types="mocha" />
import assert from "assert";
import fs from "fs";
import path from "path";

// HARTHMERE_SERVICE_WORKER_MANIFEST (2026-08-04 asset loading audit, finding 2)
//
// The shipped `public/sw.js` was 6.88 MB (1.93 MB gzipped) of injected precache
// manifest -- every file under public/, hashed, listed, and never used. It is
// downloaded on first load and re-validated after every deploy, so it was pure
// cost on the critical path.
//
// Two guards: the configuration that caused it, and the artifact itself when one
// is present in the working tree.

const root = process.cwd();

// The reviewed production build is ~0.90 MiB: Firebase messaging plus the
// existing push-envelope renderer. A 1.25 MiB ceiling leaves normal dependency
// movement room while still failing far below the former 6.88 MiB public-tree
// manifest regression.
const MAX_SERVICE_WORKER_BYTES = 1.25 * 1024 * 1024;

describe("service worker payload", () => {
  it("disables next-pwa's public-tree manifest glob", () => {
    const config = fs.readFileSync(path.join(root, "next.config.js"), "utf8");
    assert.match(
      config,
      /additionalManifestEntries: \[\]/,
      "next-pwa must not glob the public tree into the service worker"
    );
    assert.match(config, /HARTHMERE_SERVICE_WORKER_MANIFEST/);
  });

  it("keeps the __WB_MANIFEST token that InjectManifest requires", () => {
    // Deleting this token breaks the production build, so it is load-bearing
    // even though nothing reads it.
    const worker = fs.readFileSync(
      path.join(root, "src/client/service_worker.ts"),
      "utf8"
    );
    assert.match(worker, /self\.__WB_MANIFEST/);
  });

  it("does not precache anything without an explicitly scoped manifest", () => {
    const worker = fs.readFileSync(
      path.join(root, "src/client/service_worker.ts"),
      "utf8"
    );
    // Comments discuss precaching deliberately; only real code counts.
    const code = worker
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    assert.doesNotMatch(
      code,
      /precacheAndRoute\s*\(/,
      "precaching an unscoped manifest would push gigabytes of game assets " +
        "into browser cache storage; scope it in next.config.js first"
    );
  });

  it("a built service worker stays small and carries no asset URLs", function () {
    const swPath = path.join(root, "public/sw.js");
    if (!fs.existsSync(swPath)) {
      // Nothing built in this checkout; the configuration guards above still ran.
      this.skip();
      return;
    }
    // `public/sw.js` is a build artifact. One produced before the manifest fix
    // is expected to be huge, and failing on it would just be reporting that the
    // tree has not been rebuilt yet. Only assert against an artifact that was
    // actually built with the current configuration.
    const configuredAt = fs.statSync(path.join(root, "next.config.js")).mtimeMs;
    if (fs.statSync(swPath).mtimeMs < configuredAt) {
      this.skip();
      return;
    }
    const contents = fs.readFileSync(swPath, "utf8");
    const bytes = Buffer.byteLength(contents);
    assert.ok(
      bytes <= MAX_SERVICE_WORKER_BYTES,
      `public/sw.js is ${(bytes / 1e6).toFixed(2)} MB, over the ${(
        MAX_SERVICE_WORKER_BYTES / 1e6
      ).toFixed(
        2
      )} MB ceiling. Rebuild after the manifest fix, or find what pulled a ` +
        `large dependency into the worker.`
    );
    for (const marker of [
      "/assets/harthmere/glb",
      "/assets/harthmere/fbx",
      "/assets/harthmere/audio/mobile/core",
      "/assets/harthmere/audio/sfx",
      "inventory_icons/generated",
      "harthmere/voices",
    ]) {
      assert.ok(
        !contents.includes(marker),
        `public/sw.js lists ${marker}; the precache manifest is unscoped again`
      );
    }
  });
});
