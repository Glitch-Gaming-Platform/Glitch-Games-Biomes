# Galois architecture and data flow

Galois spans authoring tools, generated language bindings, a Node/Python build boundary, native Voxeloo processing, static publication, and a small runtime export adapter. Treating it as only an art directory or only a Python script misses the compatibility contracts between those layers.

## Authoring plane

Raw source content lives under `src/galois/data`. Important families include blocks and glass, flora, wearables, item meshes, NPCs, placeables, icons, animations, audio, maps, and Gaia seed data. Source paths used by recipes are resolved relative to this data workspace.

TypeScript modules under `src/galois/js/assets` define named assets as dependency graphs. The central registry in `src/galois/js/assets/index.ts` combines each category's `getAssets()` result into one logical namespace. Duplicate logical names overwrite earlier entries, so category ownership and unique names are part of review even though the map itself does not reject duplicates.

The editor and viewer are Electron applications over the same recipes and build runtime. They are development surfaces, not production authorities. An asset that renders in an editor still needs export, serialization, publication, and consumer tests.

## Language-definition plane

The asset DSL is defined in Python modules under `src/galois/py/assets/defs`. `gen_ts.py` lowers those definitions through Jinja templates and produces TypeScript types and routine constructors. Bazel owns that generation through `src/galois/py/assets/BUILD.bazel` and `src/galois/js/lang/BUILD.bazel`; `./b ts-deps build` refreshes the generated TypeScript dependency tree used from `src/gen/galois/js/lang`.

Every concrete type or function signature has a materializer key. `gen_ts.py` checks that the generated set and `MATERIALIZATION_MAP` in `impl/materializers.py` agree. A DSL addition is incomplete until its generated TypeScript constructor, Python materializer, serializer when needed, and tests all agree.

## Query and build plane

Each TypeScript asset node contains a type, a materializer kind, ordered dependencies or literal data, and a deterministic hash. Graph traversal deduplicates equal subgraphs by hash and linearizes dependencies before consumers.

`toProgram()` converts the graph into a JSON array:

- literals contain `node`, `kind`, `type`, and `data`;
- derived nodes contain `node`, `kind`, `type`, and dependency indexes;
- dependencies must appear before the node that uses them;
- dependency order is semantic and must not be sorted or normalized casually.

The Node build server has several execution modes:

| Mode               | Behavior                                                            | Primary use                                           |
| ------------------ | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `DevAssetServer`   | Starts one Python builder per request                               | Editing Python materializers with immediate reload    |
| `BatchAssetServer` | Keeps one Python subprocess and serializes requests through a queue | Export tools and each pool worker                     |
| `PoolAssetServer`  | Distributes builds across persistent batch workers                  | Static publication and runtime player-mesh generation |
| `WinAssetServer`   | Uses the packaged Python builder executable                         | Packaged Windows editor/viewer                        |

The batch protocol uses dedicated file descriptors rather than stdin/stdout. Node writes a decimal byte length followed by the JSON program. Python writes one base64-encoded serialized result per request. Standard output and error remain available for diagnostics. A protocol change must update both sides and retain framing tests.

## Python materialization plane

`build.py` reconstructs literal and derived nodes in program order. Each node is dispatched by exact `kind` through `MATERIALIZATION_MAP`. Results are cached in-process by the Python node hash, then the final value is serialized into the JSON-facing `kind` union understood by TypeScript.

Materializers cover pure values as well as file loading, image processing, voxel parsing, GLTF manipulation, wearable composition, tensor operations, terrain and group generation, and native geometry. Many operations delegate to `voxeloo.galois` through pybind11.

There are two independent caches:

- the materialized-value LRU avoids recomputing identical nodes inside a worker;
- the incremental `QueryIndex` records the complete program and source files read during materialization, allowing later publication runs to return the `unchanged` signal.

Neither cache is an authority. Deleting either must make builds slower, not change output. A cache-key or dependency-tracking change therefore requires equivalence tests with incremental mode disabled.

## Output and consumer plane

The Python serializer emits a tagged representation such as `GLB`, `GLTF`, `PNG`, `WEBM`, `TerrainTensor`, `BlockIndex`, `GroupMesh`, or `JSON`. Binary values cross the JSON protocol as base64. TypeScript's `AssetDataMap` is the application-side schema for these tags.

The exporter converts tagged values into files or generated source. Static publication content-hashes exported bytes, uploads immutable objects, and writes the logical path index. Consumers resolve only through the generated index and configured static host.

Some generated binary indexes are loaded by Voxeloo at runtime. For those assets, the serializer, native reader, WebAssembly or pybind bindings, TypeScript declarations, and generated bytes form one compatibility unit.

## Failure semantics

Python materialization failures are serialized as `{kind: "Error", info: [...]}` unless the builder is explicitly run in propagating-error mode. Incremental skips use `{kind: "Signal", info: "unchanged"}`. Exporters convert error results into failed builds and treat only the exact unchanged signal as a skip.

The Node batch server also detects subprocess errors, early exits, closed pipes, and malformed JSON. It must reject the pending request rather than leaving a worker queue permanently occupied.

Related source: `src/galois`, `voxeloo/galois`, `voxeloo/py_ext`, and `src/galois/js/interface/types/data.ts`.
