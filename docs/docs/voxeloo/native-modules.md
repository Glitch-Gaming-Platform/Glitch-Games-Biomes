# Native Voxeloo modules

Voxeloo is split into small C++ libraries with Bazel targets. Consumers should depend on the narrowest package they need; language bindings aggregate selected APIs for TypeScript and Python.

## Module map

| Package           | Responsibility                                                 | Representative contracts                                            |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `voxeloo/common`  | Geometry, boxes, runs, spatial structures, utilities           | Coordinate ordering, iteration, hashing, bounds                     |
| `voxeloo/tensors` | Dense, sparse, and succinct tensor storage and transforms      | Shape, chunking, serialization, typed values                        |
| `voxeloo/biomes`  | Shards, voxel blocks, culling, rasterization, migrations       | 32-voxel shard layout, block decoding, old/new storage conversion   |
| `voxeloo/gaia`    | Terrain maps and lighting, water, muck, and simulation kernels | ECS shard inputs, tensor outputs, incremental terrain updates       |
| `voxeloo/anima`   | Native NPC-support algorithms                                  | Surface extraction from terrain tensors                             |
| `voxeloo/mapping` | Top-down terrain and fluid height maps                         | Filtered maximum heights and tile-coordinate bounds                 |
| `voxeloo/galois`  | Asset and material processing                                  | Deterministic asset transforms consumed by tooling                  |
| `voxeloo/js_ext`  | Emscripten/Embind registrations                                | JavaScript-visible names, ownership, exceptions, normal/SIMD parity |
| `voxeloo/py_ext`  | pybind11 registrations                                         | Python binary types, NumPy shapes and dtypes, exception translation |

## Important invariants

### Tensors and shards

Biomes terrain is organized in 32×32×32 shards. Python tensor conversion accepts NumPy data in `[z, y, x]` order and pads native dimensions to shard-aligned multiples of 32. Raw and compressed serialization must round-trip values and shape consistently.

### Anima surfaces

`voxeloo/anima/find_surfaces.cpp` emits a point when a nonzero terrain voxel has exposed space immediately above it. The uppermost local `y = 31` layer is excluded because the function cannot prove exposure in the neighboring shard. Terrain IDs are preserved in the emitted result.

### Mapping heights

Mapping routines compute the maximum occupied or fluid height for each horizontal cell. Returned height is `y + 1`, so zero remains the no-content sentinel. Terrain filters distinguish block and flora values, offsets are applied to output coordinates, and requests outside the supplied tile fail rather than reading invalid memory.

### Biomes migrations

Migration helpers convert historical run, volume-block, and sparse-block representations into current tensors. Tests protect gaps, trailing empty ranges, occupied values, and absent sparse entries so persisted assets do not silently change during refactors.

### Galois builders and buffers

Galois block indexes require a valid error sampler before they can be built. Missing fallback data must raise an argument error rather than dereferencing an empty sampler. Storage buffers and generated geometry may be empty; their byte views therefore use safe empty data pointers and report zero bytes. Native and pybind tests protect both cases.

### Gaia kernels

Gaia owns the server-side orchestration around native terrain maps and simulation kernels. Native tests protect individual map and kernel behavior; Gaia TypeScript tests protect ECS ingestion, invalidation, scheduling, emitted updates, and service cleanup. See [Gaia](../basics/gaia.md) for the service boundary.

## Native test commands

Run the complete package:

```shell
bazel test //voxeloo/...
```

Useful focused targets include:

```shell
bazel test //voxeloo/anima:find_surfaces_test
bazel test //voxeloo/mapping:heights_test
bazel test //voxeloo/biomes:migration_test
bazel test //voxeloo/gaia/...
```

When changing serialization or bindings, native tests are necessary but not sufficient. Run the boundary tests described in [Bindings and testing](./bindings-and-testing.md).
