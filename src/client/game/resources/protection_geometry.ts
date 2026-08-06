import { toQuads } from "@/cayley/graphics/aabbs";
import { buildQuadIndices } from "@/cayley/graphics/geometry";
import { toLines } from "@/cayley/graphics/rects";
import type { Array3 } from "@/cayley/numerics/arrays";
import { fromArray, makeArray } from "@/cayley/numerics/arrays";
import { concat } from "@/cayley/numerics/manipulate";
import type { AABB, Vec2 } from "@/shared/math/types";
import * as THREE from "three";

// HARTHMERE_CAYLEY_LAZY_LOAD (2026-08-04 asset loading audit, finding 3)
//
// THIS MODULE IS THE ONLY GAMEPLAY-PATH IMPORTER OF THE CAYLEY NUMERICS WASM.
// It must stay that way, and it must only ever be reached through a dynamic
// `import()`. `resources/protection.ts` owns that import; nothing else should
// import this file statically.
//
// Why: `src/gen/cayley/impl/wasm_bundler_bg.wasm` is 5.74 MB (1.11 MB gzipped).
// Webpack is configured with `asyncWebAssembly`, so any module that transitively
// imports it becomes an async module whose evaluation awaits the WASM
// instantiation. `resources/protection.ts` is registered from
// `resources/init.ts`, which meant every player downloaded and instantiated
// 5.74 MB of Rust numerics during boot -- to draw land-claim protection field
// geometry, which most sessions never see at all.
//
// Everything in here is pure geometry: rect/AABB outlines and quad meshes. It
// holds no state, so loading it late is safe; the caller simply has nothing to
// draw until it arrives, and protection fields are cosmetic.

function addTexCoords(vertices: Array3<"F32">) {
  const [n, q, v] = vertices.shape;
  return makeArray("F32", [n, q, v + 2])
    .view()
    .merge(":,:,:-2", vertices)
    .merge(":,:,-2:", [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    ])
    .eval();
}

function addBackFaces(vertices: Array3<"F32">) {
  return concat([vertices, vertices.view().flip([false, true, false]).eval()]);
}

/** Build the protection field mesh geometry for a set of field AABBs. */
export function buildProtectionGeometry(fields: AABB[]) {
  const vertices = addBackFaces(
    addTexCoords(toQuads(fromArray("F32", [fields.length, 2, 3], fields)))
  );
  const indices = buildQuadIndices(vertices.shape[0]);

  // Convert to three.
  const ret = new THREE.BufferGeometry();
  const vbo = new THREE.InterleavedBuffer(vertices.data, 5);
  ret.setAttribute("position", new THREE.InterleavedBufferAttribute(vbo, 3, 0));
  ret.setAttribute("texCoord", new THREE.InterleavedBufferAttribute(vbo, 2, 3));
  ret.setIndex(new THREE.BufferAttribute(indices, 1));
  ret.computeVertexNormals();
  return ret;
}

/**
 * Outline of the union of a set of xz rectangles.
 *
 * Only needed for two or more rectangles; the single-rectangle case is handled
 * without WASM in `protection.ts` (see `singleRectBorder`), which is what the
 * robot placement preview uses.
 */
export function unionRectBorder(interior: [Vec2, Vec2][]): [Vec2, Vec2][] {
  const border = toLines(fromArray("F32", [interior.length, 2, 2], interior));
  return border.js() as [Vec2, Vec2][];
}
