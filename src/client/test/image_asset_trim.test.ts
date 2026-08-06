/// <reference types="mocha" />
import assert from "assert";
import fs from "fs";
import path from "path";

// HARTHMERE_IMAGE_ASSET_TRIM (2026-08-04 asset loading audit, finding 12)
//
// The production image copies the whole public tree. Four upstream marketing
// videos accounted for 344 MB of it and were referenced by nothing:
//
//   public/splash/trailer-4k.mp4    134.8 MB
//   public/splash/trailer-4k.webm    84.3 MB
//   public/splash/hero-video.mov     66.8 MB
//   public/splash/hero-video.mp4     58.9 MB
//
// They are now excluded from the build context. The risk of that change is
// exactly one thing: somebody later references one of them and gets a 404 in
// production while it works locally -- the same "works on my machine" shape as
// the localhost-gated bugs in the render audit. This test is the guard.

const root = process.cwd();
const EXCLUDED = [
  "public/splash/trailer-4k.mp4",
  "public/splash/trailer-4k.webm",
  "public/splash/hero-video.mov",
  "public/splash/hero-video.mp4",
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        continue;
      }
      sourceFiles(rel, out);
    } else if (/\.(ts|tsx|js|jsx|css|json)$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

describe("container image asset trim", () => {
  it("excludes the unreferenced marketing videos from the image", () => {
    const ignore = fs.readFileSync(
      path.join(root, "Dockerfile.biomes.dockerignore"),
      "utf8"
    );
    for (const excluded of EXCLUDED) {
      assert.ok(
        ignore.split("\n").some((line) => line.trim() === excluded),
        `${excluded} should be excluded from the production image`
      );
    }
  });

  it("does not exclude anything the application actually references", () => {
    // Whole-tree scan: if any excluded path appears in shipped source, the
    // exclusion is wrong and must be removed rather than the reference.
    const files = [...sourceFiles("src"), ...sourceFiles("public/pwa")].filter(
      // This test necessarily names the excluded paths itself.
      (file) => !file.endsWith("image_asset_trim.test.ts")
    );
    const referenced: string[] = [];
    for (const file of files) {
      const contents = fs.readFileSync(path.join(root, file), "utf8");
      for (const excluded of EXCLUDED) {
        const asUrl = excluded.replace(/^public/, "");
        if (contents.includes(asUrl)) {
          referenced.push(`${file} -> ${asUrl}`);
        }
      }
    }
    assert.deepEqual(
      referenced,
      [],
      `excluded media is referenced by shipped code: ${referenced.join(", ")}`
    );
  });

  it("keeps the splash assets that pages do import", () => {
    // These are the ones the landing, 404 and splash pages need; an over-broad
    // `public/splash/*` exclusion would break them.
    const ignore = fs.readFileSync(
      path.join(root, "Dockerfile.biomes.dockerignore"),
      "utf8"
    );
    for (const kept of [
      "public/splash/home-bg.png",
      "public/splash/biomes-logo.png",
      "public/splash/b-logo.png",
      "public/splash/biomes.svg",
      "public/splash/black.png",
      "public/splash/trailer-poster.png",
      "public/splash/404.png",
    ]) {
      assert.ok(
        !ignore.split("\n").some((line) => line.trim() === kept),
        `${kept} is imported by a page and must ship`
      );
      assert.ok(
        !ignore.includes("public/splash/*"),
        "a wildcard exclusion would take the referenced splash assets with it"
      );
    }
  });

  it("still ships the clothing models the avatar pipeline loads", () => {
    // public/models is 314 MB and looks like a trim candidate, but the modular
    // clothing GLTFs under it are loaded at runtime. Recorded here so the next
    // person does not repeat the analysis.
    const ignore = fs.readFileSync(
      path.join(root, "Dockerfile.biomes.dockerignore"),
      "utf8"
    );
    assert.ok(!ignore.includes("public/models"));
  });
});
