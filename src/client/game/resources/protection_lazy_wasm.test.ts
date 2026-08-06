/// <reference types="mocha" />
import assert from "assert";
import fs from "fs";
import path from "path";

// HARTHMERE_CAYLEY_LAZY_LOAD (2026-08-04 asset loading audit, finding 3)
//
// `src/gen/cayley/impl/wasm_bundler_bg.wasm` is 5.74 MB (1.11 MB gzipped) and
// webpack is configured with `asyncWebAssembly`, so ANY static import chain from
// an eagerly-registered module to `@/cayley/numerics/*` puts that download on
// the boot path. The only gameplay consumer is protection-field geometry, which
// most sessions never render.
//
// These are source contracts because the thing being asserted is a *module
// graph* property: it cannot be observed by calling the functions, only by
// looking at how they are imported. A behavioural test would pass while the
// regression (someone re-adding a top-level cayley import) shipped.

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const CAYLEY_IMPORT = /^import[\s\S]*?from "@\/cayley\//m;

describe("cayley WASM stays off the client boot path", () => {
  it("protection.ts has no static cayley import", () => {
    const source = read("src/client/game/resources/protection.ts");
    assert.doesNotMatch(
      source,
      CAYLEY_IMPORT,
      "resources/protection.ts is registered from resources/init.ts at boot; a " +
        "static cayley import here re-adds 5.74 MB of WASM to startup"
    );
  });

  it("protection.ts reaches the geometry module only through import()", () => {
    const source = read("src/client/game/resources/protection.ts");
    assert.match(
      source,
      /import\(\s*"@\/client\/game\/resources\/protection_geometry"\s*\)/,
      "the geometry module must be dynamically imported"
    );
    assert.doesNotMatch(
      source,
      /^import[\s\S]*?from "@\/client\/game\/resources\/protection_geometry"/m,
      "a static import would defeat the split"
    );
  });

  it("the geometry module is not imported statically by anything else", () => {
    // A single static importer anywhere in the eager graph would undo this.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(root, dir), {
        withFileTypes: true,
      })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
        } else if (/\.tsx?$/.test(entry.name)) {
          const source = read(rel);
          if (
            /^import[\s\S]*?from "@\/client\/game\/resources\/protection_geometry"/m.test(
              source
            )
          ) {
            offenders.push(rel);
          }
        }
      }
    };
    walk("src/client");
    assert.deepEqual(
      offenders,
      [],
      `protection_geometry.ts must only be reached via import(); static importers: ${offenders.join(
        ", "
      )}`
    );
  });

  it("keeps a WASM-free path for the single-rectangle boundary", () => {
    // The robot placement preview redraws while the player moves the robot. It
    // must not wait on a 5.74 MB download to show its outline.
    const source = read("src/client/game/resources/protection.ts");
    assert.match(source, /function singleRectBorder/);
    assert.match(
      source,
      /if \(interior\.length === 1\) \{\s*return \{ interior, border: singleRectBorder\(interior\[0\]\) \};/
    );
  });

  it("re-generates protection resources when the module lands", () => {
    const source = read("src/client/game/resources/protection.ts");
    // The flag resource is the dependency edge that makes the late load visible
    // to already-generated resources.
    assert.match(source, /builder\.addGlobal\("\/protection\/geometry_ready"/);
    assert.match(source, /deps\.get\("\/protection\/geometry_ready"\)/);
    assert.match(
      source,
      /resources\.set\("\/protection\/geometry_ready", \{ ready: true \}\)/
    );
    const types = read("src/client/game/resources/types.ts");
    assert.match(types, /"\/protection\/geometry_ready": PathDef</);
  });

  it("fails soft: a failed import leaves fields undrawn and retryable", () => {
    const source = read("src/client/game/resources/protection.ts");
    assert.match(source, /\.catch\(\(error\) => \{/);
    assert.match(source, /protectionGeometryLoad = undefined;/);
  });

  it("keeps the cayley-dependent geometry in the lazy module", () => {
    const geometry = read("src/client/game/resources/protection_geometry.ts");
    assert.match(geometry, /from "@\/cayley\/graphics\/aabbs"/);
    assert.match(geometry, /export function buildProtectionGeometry/);
    assert.match(geometry, /export function unionRectBorder/);
  });

  it("disposes each generated BufferGeometry, not the shared lazy module", () => {
    const source = read("src/client/game/resources/protection.ts");
    assert.match(source, /bufferGeometry\.dispose\(\)/);
    assert.doesNotMatch(
      source,
      /\bgeometry\.dispose\(\)/,
      "the dynamic-import namespace is not disposable"
    );
  });
});

describe("protection boundary geometry", () => {
  it("produces a closed four-segment outline for one rectangle", async () => {
    // Imported lazily here as well, so this test does not need the WASM either.
    const { getRobotProtectionBoundary } =
      await import("@/client/game/resources/protection");
    const boundary = getRobotProtectionBoundary([
      [
        [10, 0, 20],
        [14, 5, 26],
      ],
    ]);

    assert.deepEqual(boundary.interior, [
      [
        [10, 20],
        [14, 26],
      ],
    ]);
    assert.equal(boundary.border.length, 4);
    // Each segment must start where the previous one ended.
    for (let i = 0; i < boundary.border.length; i += 1) {
      const [, end] = boundary.border[i];
      const [nextStart] = boundary.border[(i + 1) % boundary.border.length];
      assert.deepEqual(end, nextStart);
    }
    // And the outline must cover exactly the rectangle's extent.
    const xs = boundary.border.flatMap(([a, b]) => [a[0], b[0]]);
    const zs = boundary.border.flatMap(([a, b]) => [a[1], b[1]]);
    assert.equal(Math.min(...xs), 10);
    assert.equal(Math.max(...xs), 14);
    assert.equal(Math.min(...zs), 20);
    assert.equal(Math.max(...zs), 26);
  });

  it("returns an empty boundary for no fields", async () => {
    const { getRobotProtectionBoundary } =
      await import("@/client/game/resources/protection");
    assert.deepEqual(getRobotProtectionBoundary([]), {
      interior: [],
      border: [],
    });
  });
});
