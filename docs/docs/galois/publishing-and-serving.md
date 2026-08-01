# Publishing and runtime serving

Galois has two delivery paths: static publication for almost all assets, and on-demand generation for customized animated player meshes.

## Static publication

`src/galois/js/publish/scripts/publish.ts` selects the asset namespaces that are public runtime data. The exporter builds each named recipe, converts the tagged result to file bytes, and computes a content hash.

For a logical path such as:

```text
placeables/camping/campfire
```

publication produces a versioned path shaped like:

```text
asset_data/placeables/camping/campfire.<content-hash>.glb
```

The object is uploaded to the `biomes-static` bucket, and `src/galois/js/interface/gen/asset_versions.json` maps the logical path to that exact object. The index is kept sorted for deterministic diffs. `static_asset_host.json` records the default base URL, while `GALOIS_STATIC_PREFIX` can override it at runtime.

Generated source definitions use a separate path: `definitions/*` results are written under `src/shared/asset_defs/gen` and are compiled into the application. These source outputs must be reviewed and deployed with the code that consumes them.

## Publication invariants

1. A logical path maps to one immutable, content-addressed object.
2. The new object must exist before an updated index becomes reachable.
3. Unchanged output must retain the same content path.
4. Changed output must receive a new path; do not overwrite bytes behind an old hash.
5. Partial or filtered publication must preserve untouched index entries.
6. A dry run must execute the real TypeScript/Python/native build path without uploading or rewriting indexes.
7. `check-assets-published` verifies that every indexed object is remotely available; it requires network access and credentials.

Consumers should use `resolveAssetUrl()` or `resolveAssetUrlUntyped()` rather than concatenate bucket paths themselves. Bikkie `galoisPath` and `galoisIcon` values are logical names, not filenames.

## Local asset availability

The web server can ensure indexed assets exist under `public/asset_data` by downloading missing objects from static storage. Local validity is currently existence-based: every indexed destination must be present. Changing this behavior to validate sizes or hashes would be safer but is a separate compatibility and startup-cost decision.

Do not remove an indexed remote object merely because the current index no longer references it. Older deployed clients, cached pages, or a rollback may still request it.

## Runtime player-mesh export

The web registry exposes an `AssetExportsServer` in local, lazy, disabled, or deployment-specific modes. The concrete implementation starts a `PoolAssetServer` over the same Galois Python builder used for offline exports.

The runtime interface currently accepts only:

```text
wearables/animated_player_mesh
```

The request flow is:

1. Parse wearable IDs, hat variants, and skin, eye, and hair palette selections.
2. Resolve Bikkie item metadata and fetch uploaded VOX binaries from the Bakery binary store when required.
3. Convert each equipped item into a Galois wearable descriptor.
4. Build the animated character recipe in a Python worker.
5. Return a GLB through `/api/assets/player_mesh.glb`.
6. Cache by the semantic wearable/color key and the shared asset-export version.

Unsupported paths fail rather than silently returning another asset family. Materialization errors are returned as API failures; a failed generated mesh must not be replaced by a visually unrelated fallback without an explicit product decision.

## Runtime cache versioning

`ASSET_EXPORTS_SERVER_VERSION` is part of player-mesh URLs, semantic cache keys, and cached response validation. Increment it when a change can alter generated player meshes without changing the request's wearable/color inputs, including:

- base body or animation changes;
- wearable composition or slot rules;
- palette application changes;
- GLTF/GLB generation or compression changes;
- default wearable changes;
- materializer fixes that affect output.

The endpoint uses long browser/CDN caching because the version is embedded in the request contract. Failing to bump the version can leave old and new meshes mixed for an extended period.

## Packaging and operations

Production images that generate meshes locally need:

- the Galois TypeScript bundle and `src/galois` data;
- a working Python interpreter and required packages;
- the built `voxeloo` Python extension;
- writable or readable paths expected by the builder;
- enough worker memory for concurrent GLB generation.

Startup and packaging checks should import the full Python dependency set and execute at least one representative dry-run asset. An import-only check does not validate file paths, the batch protocol, or native materialization.
