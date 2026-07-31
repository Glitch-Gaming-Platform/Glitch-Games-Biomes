# Voxeloo bindings and testing

Voxeloo has two language boundaries: Emscripten/Embind for TypeScript and pybind11 for Python. Both expose native allocations and wire formats, so tests cover runtime behavior rather than relying only on successful compilation.

## TypeScript and WebAssembly

`voxeloo/js_ext` registers C++ functions and classes with Embind. The build produces normal and SIMD WebAssembly variants, generated JavaScript loaders, and `.wasm` binaries. Handwritten declarations under `src/shared/wasm/types` and wrappers under `src/shared/wasm` provide the application-facing TypeScript API.

The binding contract test loads both variants with isolated WebAssembly memories and verifies:

- required Anima, Gaia, mapping, shard, tensor, and memory-management exports exist at runtime;
- normal and SIMD builds produce matching shard encoding, tensor boundary hashes, and Anima surface results;
- mapping filters correctly distinguish block and flora terrain and return terrain, water, and muck heights;
- temporary native objects are deleted, with the module leak counter returning to zero after each test.

Run it with:

```shell
./b test -p 'src/shared/wasm/test/*.test.ts'
```

An Embind declaration can compile while its runtime registration is missing or renamed. Keep runtime export assertions when adding APIs, and add a behavioral parity assertion for deterministic functions exposed by both builds.

## Python and pybind11

The Bazel `voxeloo/py_ext:bindings_test` suite loads the actual built extension from runfiles. It is split into core, algorithm, and Galois boundary tests and covers every exported top-level submodule:

- all geometry, run-index, tensor, volume-block, and sparse-block template variants;
- block lists, meshes, voxel meshing, binary shards, NumPy layouts, and every serialization mode;
- noise, procedural primitives, Voronoi, spatial maps, ray rendering, culling, and mesh rasterization;
- Galois CSG, transforms, terrain IDs, block/flora/shape indexes, water geometry, groups, lighting, and storage buffers;
- invalid dimensions, indices, missing fallback data, and other native validation failures translating to Python exceptions.

Run it directly or as part of the full suite:

```shell
bazel test //voxeloo/py_ext:bindings_test
bazel test //voxeloo/...
```

Binary native output must use `bytes`, not Python Unicode. NumPy-returning methods must populate every documented column and must not write outside the allocated array. Python indexers must accept Python's tuple form, registered properties must return Python-convertible types, empty native buffers must expose safe zero-length views, and malformed mesh input must fail before unchecked native access. These requirements are explicit regressions because none is guaranteed by a successful C++ compilation.

## Ownership and exceptions

Embind-created objects generally own C++ heap allocations and expose `delete()`. Use the repository's `using`, `usingAsync`, or `usingAll` helpers for scoped lifetimes. Long-lived services must register cleanup explicitly. A JavaScript wrapper becoming unreachable does not guarantee timely native deletion.

Native validation failures should cross each binding as the documented host-language exception. The pybind tests require invalid tensor input to become `ValueError`; WebAssembly callers should receive a catchable JavaScript error and native error context rather than memory corruption or an unexplained abort.

## Upgrade matrix

For a compiler, Emscripten, pybind11, Bazel rule, NumPy, tensor-format, or native implementation upgrade:

1. Run the existing tests unchanged against the candidate.
2. Run `bazel test //voxeloo/...` for native and Python coverage.
3. Rebuild normal and SIMD WebAssembly artifacts and run `src/shared/wasm/test`.
4. Run Gaia and Anima consumer suites.
5. Compare representative persisted shard and tensor buffers before and after the upgrade.
6. Exercise invalid inputs and exception translation, not only valid calls.
7. Check repeated operations for native leaks and resident-memory growth.
8. Deploy C++, generated loaders, `.wasm` binaries, declarations, and wrappers as one unit.

An intentional wire or numerical behavior change needs a migration note and a new expected-value assertion. Do not weaken parity or round-trip tests merely to make an upgrade pass.
