# Harthmere Blender Pipeline Issues

This is the shared failure log for the Harthmere business-interior and reusable-furniture asset pipeline. Read it before rerunning or extending the Blender generators.

## 2026-08-02 — Blender 5.2 background crash from generated object names

- Blender: `5.2.0 LTS` (`fbe6228777e7`), Homebrew launcher at `/opt/homebrew/bin/blender`.
- Command that exposed the issue:

  ```sh
  blender --factory-startup --background \
    --python scripts/harthmere/blender/generate_business_interiors.py -- \
    --repo-root "$PWD" --only glassyard_biome_studio
  ```

- Symptom: Blender terminated without a Python traceback:

  ```text
  libc++abi: terminating due to uncaught exception of type std::out_of_range: stoi: out of range
  ```

- Reproduction point: the Glassyard `Drafting table` generated a leg name ending in a long floating-point coordinate such as `-0.5499999999999999`.
- Cause: Blender reserves dotted numeric suffixes for datablock name deduplication (for example `.001`). In Blender 5.2, a generated name ending in a long decimal fragment can reach the native suffix parser and overflow its integer conversion.
- Fix: all procedural mesh object names pass through `blender_safe_name()`. It removes spaces, periods, and other punctuation and caps names at 58 characters. Coordinate values must not be embedded verbatim in Blender object, mesh, material, collection, or modifier names.
- Do not retry: changing startup preferences, using `--factory-startup`, or disabling previews does not solve this crash. It occurs during scene construction before GLB export.
- Verification gate: run the one-business Glassyard smoke test, then the full 19-business build. A Blender process exit without the final manifest is a failed run even if partial files exist.

## General rules for later tasks

- Use the checked-in procedural generator as the source of truth; do not hand-edit generated GLBs.
- Run a one-business smoke test after any Blender API or geometry-builder change.
- Keep generated names deterministic, punctuation-free, and short.
- Treat `.raw.glb` files as incomplete output. Only compressed GLBs accompanied by the generated manifest and validation report are deliverable.
- Record new Blender crashes here with the exact version, command, last successful stage, root cause, fix, and a clear “do not retry” note.

## 2026-08-02 — Blender 5.2 API and join warnings

- `Material.use_nodes` emits a Blender 6.0 removal warning in Blender 5.2. New materials already expose the Principled BSDF node tree in the installed version, so the generator no longer assigns this deprecated property.
- `bpy.ops.object.join()` emits `Warning: No mesh data to join` for a material batch containing only one mesh. The batcher now leaves singleton groups untouched and only invokes Join for groups with at least two meshes.
- These warnings were non-fatal, but leaving them in the output would hide actionable failures in full 19-business generation logs.

## 2026-08-02 — Preview renderer enum differs in installed Blender 5.2

- Symptom during `--render-previews`:

  ```text
  TypeError: bpy_struct: item.attr = val: enum "BLENDER_EEVEE_NEXT" not found in
  ('BLENDER_EEVEE', 'BLENDER_WORKBENCH', 'CYCLES')
  ```

- Cause: examples and older generators commonly use `BLENDER_EEVEE_NEXT`, but the installed Blender 5.2 LTS build exposes the Eevee engine as `BLENDER_EEVEE`.
- Fix: query the render-engine enum and select the supported Eevee identifier dynamically.
- Do not retry: hard-coding `BLENDER_EEVEE_NEXT` in this workspace fails after GLB export, leaving a run with valid-looking partial assets but no completed preview/manifest stage.

## 2026-08-02 — Full client typecheck currently reaches unrelated combat errors

- Including `src/client/game/resources/placeables/helpers.ts` in a focused furniture `tsc` graph also reaches `LocalDevHarthmereMultiplayerCombatSystem.tsx` through shared client-resource imports.
- The current unrelated diagnostics reject `crosshair_visible_actor_at_impact` and `forward_arc_impact_fallback` against an older three-value impact-source union.
- The broad TypeScript check was still useful: it reported no diagnostics in the furniture files before stopping on those two combat errors. Furniture validation therefore uses Mocha for the runtime/generated/native Bikkie contract and a syntax transpile check for the small client loader edit until the owning combat task repairs its union.
- Do not retry a broad client typecheck expecting this furniture task to clear those combat errors; address the combat union in its owning task, then rerun the normal client typecheck.

## 2026-08-02 — Blender/native bounds axis order was initially transposed

- Blender builders express dimensions as `(width X, depth Y, height Z)`.
- Native Biomes placeable bounds express vectors as `(world X width, world Y height, world Z depth)`.
- The first generated reusable-furniture manifest copied builder dimensions directly, which would have made tables and beds too tall/shallow and shelves too short/deep for native collision.
- Fix: catalogue `boxSize` and `collidableSize` are explicitly reordered to `(width, height, depth)`. `harthmere_business_furniture_assets.test.ts` compares every generated asset against the existing decor catalogue footprint and fails on any future transposition.
- Do not retry: never derive native bounds with `list(asset.dimensions)` or copy `(width, depth, height)` into a Bikkie vector.

## 2026-08-02 — Cinderlane workbench touched the stair keep-clear

- The first full 19-business validation found no fixture overlaps or customer-aisle intrusions, but Cinderlane's `Drawers workbench` overlapped the first-floor stair rectangle by `0.10 m` at its western edge.
- Fix: move the workbench center from local X `7.0` to `7.4`, retaining local Y `12.0`.
- `test-business-interior-assets.cjs` now treats any first-floor collision proxy touching a multi-floor stair keep-clear as a hard failure.
- Do not retry: do not restore Cinderlane's workbench to shared large-zone H without revalidating the stair rectangle.

## 2026-08-02 — Use the correct fast versus bootstrapped test lane

- `TESTING_FASTER.md` requires `scripts/harthmere/t.sh file <path>` or `.mocharc.fast.json` for pure layout/data contracts, but Bikkie/native registry and server-handler tests need the bootstrapped `.mocharc.json` lane.
- The furniture asset contract passes in the bootstrapped lane, and the native placeable transaction handler passes both atomic place/remove and non-empty-container rejection cases.
- The broader native Bikkie suite currently has an unrelated weapon-balance assertion: `iron_longsword` publishes DPS `17.647...` while the test expects DPS above `30`. The furniture-specific placeable test passes in isolation. Do not rerun the whole suite to diagnose furniture placement; route the weapon DPS discrepancy to its owning balance task.
- `scripts/harthmere/t.sh icons` validates all 526 icon routes, 42 protected icons, and 15 objective-proof icons, then currently fails three unrelated UI harness builds because esbuild cannot resolve `@/client/components/harthmere_capacity_messages` even though the source file exists. Do not change furniture assets or duplicate that module to hide the harness alias problem.

## 2026-08-02 — A one-business smoke build used to truncate the full manifest

- `generate_business_interiors.py --only <slug>` originally rebuilt one business and then wrote `business-interiors.json` with only that selected entry.
- Fix: selected builds validate the slug, merge the rebuilt entry into the existing manifest, and preserve canonical 19-business ordering.
- Do not retry: never use an older generator's `--only` mode and then accept the manifest without rerunning the 19-business validator. The validator's first gate is an exact count of 19.

## 2026-08-02 — Blender collection membership requires a datablock name

- Pipeline: `generate_world_interaction_graphics.py` on Blender `5.2.0 LTS`.
- Symptom during the first single-node background build: Python raised a
  `TypeError` from `bpy_prop_collection.__contains__` while testing whether the
  default collection was linked to the scene.
- Cause: Blender 5.2 collection membership expects a datablock name string;
  passing the collection object itself is not accepted.
- Fix: test `default.name in bpy.context.scene.collection.children` before
  unlinking the default collection.
- Do not retry: do not use `if collection in scene.collection.children` in
  Blender 5.2 generators. This was a handled Python failure, not a native
  Blender crash.

## 2026-08-02 — Principled BSDF metallic socket names vary by Blender build

- Pipeline: `generate_world_interaction_graphics.py` on Blender `5.2.0 LTS`.
- Symptom: material creation failed when the generator indexed a Principled
  BSDF input named `Metallic IOR Level`; that socket is not exposed by this
  installed build.
- Cause: Blender versions/builds differ in the labels exposed for Principled
  BSDF metallic controls.
- Fix: query `Metallic` first, then use `Metallic IOR Level` only as a fallback.
  Emission uses the same defensive lookup for `Emission Color` versus
  `Emission`.
- Do not retry: never directly index version-sensitive Principled socket names
  without a supported-name fallback. This was a handled Python failure, not a
  native Blender crash.

## 2026-08-02 — Landmark scaling requires a dependency-graph update before bounds

- Pipeline: `generate_world_interaction_graphics.py`, jobs-board variants.
- Symptom: the rendered preview showed the requested 6.6 m landmark scale, but
  the first selected-build manifest retained the old 3.68 m bounds.
- Cause: object transforms were changed immediately before bounds collection;
  Blender's dependency graph had not been explicitly updated.
- Fix: call `bpy.context.view_layer.update()` before reading transformed object
  bounding boxes. Preview framing is now derived from those bounds as well.
- Do not retry: do not trust a preview alone for scale. Require the manifest
  bounds gate (`width >= 6.5`, `height >= 6.4`) and an in-game screenshot.
