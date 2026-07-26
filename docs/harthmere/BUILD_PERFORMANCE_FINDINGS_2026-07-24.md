# Build and Typecheck Performance — Findings, 2026-07-24

Measured while adding Chapter 1. Numbers are from this checkout, `tsc 5.x`,
`--extendedDiagnostics`, warm filesystem cache.

## Summary

| Symptom | Measurement |
| --- | --- |
| Program size | **8,195 files** |
| File resolution alone (`--listFilesOnly`) | **22.3 s** |
| Full `./b typecheck` | OOMs below ~8 GB heap; several minutes when it completes |
| Top 5 generated `.ts` files | **~5.5 MB** of object literals |

The bottleneck is **not** file discovery, module resolution, or `skipLibCheck`.
It is a handful of very large generated files whose types TypeScript has to
infer or structurally check.

## The hot spot

```
1,182,979  src/shared/harthmere/generated/production_terrain_placement_map.ts
1,151,294  src/shared/game/medieval/harthmereAssetManifest.generated.ts
1,045,842  src/shared/harthmere/npc_compendium.ts
  942,916  src/client/game/renderers/local_dev/harthmere_assets.ts
  935,262  src/shared/game/medieval/medievalAssetManifest.generated.ts
  711,364  src/shared/harthmere/quest_compendium.ts
  688,103  src/shared/harthmere/live_mode_backend.ts
```

Checking just three of these in isolation costs **3.4 s of check time and
553 MB**. They are a large fraction of the whole-program cost.

### Why they are expensive

`production_terrain_placement_map.ts` ends with:

```ts
export const HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP = {
  /* ~53,000 lines */
} as const satisfies HarthmereProductionTerrainPlacementMap;
```

`as const` forces TypeScript to materialise a deeply-readonly **literal type**
for every string and number in 1.18 MB of data — roughly 20,000 placement
records × ~12 fields — and `satisfies` then structurally checks that giant
inferred type against the interface.

`npc_compendium.ts` (1.05 MB) has no annotation at all, so its type is inferred
from scratch.

### What I measured, and why I did not ship it

Replacing `as const satisfies X` with a plain `: X =` annotation on the
placement map:

| | Memory | Check time |
| --- | --- | --- |
| `as const satisfies` (current) | 425 MB | 0.95 s |
| plain annotation | **335 MB (-21%)** | **0.60 s (-37%)** |

Real and repeatable — but it **fails to compile**:

```
production_terrain_placement_map.ts(34,17): error TS2590:
Expression produces a union type that is too complex to represent.
```

Annotating the array makes TypeScript check ~20,000 elements against a record
type with optional fields and union-typed `purpose`/`placementMode`, and that
blows a different internal limit. I reverted it. Hand-editing a generated file
would also be wrong — the change belongs in the generator.

## Recommended fixes, in order of value

1. **Move the pure-data generated files to `.json`.**
   `resolveJsonModule` is already enabled. A JSON import gets a cheap inferred
   type instead of a literal type, and the consumer casts once:

   ```ts
   import raw from "./production_terrain_placement_map.json";
   export const HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP =
     raw as unknown as HarthmereProductionTerrainPlacementMap;
   ```

   This sidesteps both the `as const` inference cost and the TS2590 ceiling.
   Affects `build-production-terrain-placement-map.cjs`,
   `import_voxel_asset_packs.py`, and `install-harthmere-all-npcs.sh`.

2. **Project references.** Split `shared` / `server` / `client` into composite
   projects. Today every `tsc` run rebuilds the world; with references, editing
   a client file would not re-check the server graph.

3. **Scoped configs for the dev loop.** Shipped with Chapter 1:
   `tsconfig.ch1check.json` checks all Chapter 1 modules and tests in **~3 s**
   versus minutes for the full program. Worth doing per feature area.

## Things that are *not* worth changing

- **`sourceMap: true`** — measured at 553,491 K vs 548,708 K and 3.44 s vs
  3.40 s. Noise. `noEmit` already means no maps are written.
- **`"public/**/*"` in `include`** — looks alarming (32,817 files on disk) but
  TypeScript only admits 2 of them into the program. Not a factor.
- **`skipLibCheck`** — already enabled.
- **`isolatedModules`** — already enabled.

## Note for anyone running tests

`tsconfig.json` configures ts-node with `transpileOnly: true` and `swc: true`.
**`./b test` does not typecheck.** Passing tests say nothing about type
correctness; run `./b typecheck` or a scoped config as well.
