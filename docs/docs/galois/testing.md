# Galois testing

Galois must be tested as a cross-language compiler and delivery pipeline. A TypeScript recipe can typecheck while its Python materializer is missing; Python can materialize an object that has no serializer; a native binding can compile but expose the wrong runtime shape; and a correct file can still be absent from static storage.

## Test layers

| Layer                               | What it proves                                                                                                                             | Main locations                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| DSL generation and graph semantics  | Generated constructors, type conversion, deterministic hashing, traversal, dependency ordering, and program round trips                    | `src/galois/js/lang/test`                                                        |
| Node server and interface contracts | Batch/map graph construction, lazy server lifecycle, runtime export errors, MIME conversion, and argument forwarding                       | `src/galois/js/server/test`, `src/galois/js/interface/**/test`                   |
| Published index contract            | Sorted logical names, content-addressed destination format, and static-prefix URL resolution                                               | `src/galois/js/interface/test`                                                   |
| Python build runtime                | Program execution, materialization errors, LRU behavior, incremental source tracking, shape generation, and legacy map-coordinate behavior | `src/galois/py/assets/test`                                                      |
| Native Galois algorithms            | Terrain IDs, block/flora sampling, index validation, groups, storage buffers, and lighting                                                 | `voxeloo/galois/*_test.cpp`                                                      |
| Python/native boundary              | pybind exports, NumPy layouts, serialization, geometry, validation errors, empty buffers, and all Galois submodules                        | `voxeloo/py_ext/galois_bindings_test.py`                                         |
| TypeScript/WASM boundary            | Runtime exports, tensor and index loading, normal/SIMD parity, native errors, and memory ownership                                         | `src/shared/wasm/test`                                                           |
| Representative export               | End-to-end TypeScript recipe, Node protocol, Python materialization, Voxeloo processing, serialization, and file conversion                | Galois publication dry run in `.github/workflows/galois-ci.yml`                  |
| Runtime player mesh                 | URL/version guards, wearable parsing, caching/resource limits, runtime exporter adapter, and packaged Python availability                  | `src/pages/api/assets/test`, Galois interface tests, deployment packaging guards |
| Remote publication                  | Every path in `asset_versions.json` exists in static storage                                                                               | `./b galois assets check-assets-published`                                       |

## Core commands

Generate the DSL dependencies before TypeScript work:

```shell
./b ts-deps build
```

Run Galois TypeScript lint, builds, and tests:

```shell
./b galois lint
./b galois build
./b galois test
```

Run the Python unit suite with the same interpreter-selection policy used by the runtime builder:

```shell
./b galois test-python
```

The Python environment must contain `requirements.txt` dependencies and the current Voxeloo extension. If necessary:

```shell
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install ./voxeloo
```

Run native and pybind boundary tests:

```shell
bazel test //voxeloo/galois/...
bazel test //voxeloo/py_ext:galois_bindings_test
```

Run runtime WebAssembly and player-mesh API contracts:

```shell
./b test -p 'src/shared/wasm/test/*.test.ts'
./b test -p 'src/pages/api/assets/test/*.test.ts'
```

Exercise a representative cross-language export without uploading:

```shell
./b galois assets publish --dryRun -r '(moss|fishing|tuna|camera)'
```

Verify remote publication only when credentials and network access are available:

```shell
./b galois assets check-assets-published
```

## Required regression cases

### DSL and transport

- Equal graphs deduplicate and serialize deterministically.
- Dependency order survives `toProgram()` and `fromProgram()`.
- Shared dependencies appear once and every dependency index points backward.
- Recursive converters such as skeletons preserve shape.
- Missing or superfluous materializer signatures fail generation.
- Batch framing returns exactly one result per query and rejects early worker exits.

### Materialization and caching

- Every new materializer has success, invalid-input, and serialization coverage.
- File-backed recipes record all source dependencies.
- Incremental cache hits persist across repeated process invocations.
- Source create, modify, and delete transitions invalidate output.
- Incremental and clean builds produce byte-identical results.
- Cache corruption degrades to a rebuild rather than a wrong asset.

### Native and binary data

- Tensor shape, dtype, coordinate order, and serialization round-trip.
- Empty geometry and storage buffers expose safe zero-length views.
- Index builders reject missing fallbacks and malformed IDs.
- C++ and Python exception translation remains catchable.
- Normal and SIMD WebAssembly agree for deterministic runtime operations.
- Native allocations return to the expected baseline after repeated operations.

### Publication and serving

- Logical paths remain unique and sorted.
- Published destinations contain the logical path, content hash, and extension.
- Filtered publication retains untouched index entries.
- Upload failure does not leave a deployable index pointing at a missing object.
- Static-prefix overrides do not alter logical lookup.
- Runtime player-mesh errors fail explicitly, cache keys include all appearance inputs, and output-changing upgrades bump the asset-export version.

## Review rule

Run the narrowest affected suite during iteration, then run every layer crossed by the change. A materializer change that calls Voxeloo and alters a published index needs Python, native/pybind, representative export, and consumer coverage; a TypeScript-only editor change does not automatically need remote publication checks.
