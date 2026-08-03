# Harthmere Business Interior and Furniture Asset Pipeline

## Delivered scope

This pipeline creates the optimized Blender-authored interior decoration for all 19 Harthmere businesses and a reusable native-placeable furniture catalogue. It is the asset foundation for replacing the detached business card mini-games with real in-world service simulations.

The Blender Python generators are the editable source of truth. Do not hand-edit generated GLBs, icons, or manifests.

Primary outputs:

- `public/assets/harthmere/manifest/business-interiors.json` — all 19 businesses, fixture coordinates, collision boxes, customer/staff/queue/entrance points, world anchors, LOD policy, and stair/aisle keep-clear zones.
- `public/assets/harthmere/glb/business_interiors/` — one material-batched LOD0 GLB and one LOD1 GLB per business.
- `public/assets/harthmere/manifest/business-furniture-catalogue.json` — reusable furniture mesh, icon, bounds, surface, placement, ECS, and performance metadata.
- `public/assets/harthmere/glb/business_furniture/` — reusable native-placeable LOD0/LOD1 GLBs.
- `public/assets/harthmere/inventory_icons/business_furniture/` — transparent 256×256 icons rendered from the exact LOD0 furniture meshes.
- `src/shared/harthmere/generated/harthmere_business_furniture_manifest.ts` — semantic/native Bikkie ID asset lookup used by runtime code.
- `output/harthmere-business-interiors/previews/` — visual QA renders for all 19 businesses.
- `docs/harthmere/HARTHMERE_BLENDER_PIPELINE_ISSUES.md` — Blender crash and version-specific failure log. Read this before changing or rerunning the generators.

## Source references

Implementation and later simulation work must read these together:

- `docs/harthmere/HARTHMERE_BUILDING_AND_DECORATION_DESIGN_GUIDE.md`
- `docs/harthmere/HARTHMERE_WILDS_AND_INTERIORS.md`
- `docs/harthmere/PERFORMANCE_AND_PLACEMENT.md`
- `docs/harthmere/TESTING_FASTER.md`
- `docs/harthmere/NATIVE_ECS_END_TO_END_TESTING.md`
- `docs/harthmere/bibles/Harthmere_Medieval_MMO_Town_Design_Bible_Complete.pdf`
- `src/shared/harthmere/business_customer_simulator.ts`
- `src/shared/harthmere/business_outpost_visual_decor.ts`
- `/Users/devindixon/.codex/attachments/7f0254c4-a032-4ca3-a44b-3baa5a888b69/pasted-text.txt`
- `/Users/devindixon/.codex/attachments/fdcc4f1c-63fb-46c4-8312-e8098a492ff5/pasted-text.txt`

## Coordinate contract

- One Blender unit is one meter.
- Blender X maps to world X.
- Blender Y maps to world Z, from the entrance toward the back wall.
- Blender Z maps to world height.
- Combined interiors use the first-floor southwest floor corner as local origin.
- Reusable furniture uses a bottom-center pivot.
- First-floor world conversion is:

  ```text
  world = (originX + localX, originY + 1 + localZ, originZ + localY)
  ```

- Upper-floor furniture uses local Z `4`, which maps to world Y `originY + 5`.
- Native Biomes `boxSize` and `collidableSize` order is `(X width, Y height, Z depth)`. Blender builder dimensions are `(width, depth, height)`; never copy them without reordering.

Standard customer-service points:

| Footprint | Counter center    | Customer          | Staff             | Entrance          |
| --------- | ----------------- | ----------------- | ----------------- | ----------------- |
| 24×20     | `(12.5, 14.5, 0)` | `(12.5, 13.1, 0)` | `(12.5, 16.1, 0)` | `(12.5, -0.5, 0)` |
| 28×22     | `(14.5, 16.5, 0)` | `(14.5, 15.1, 0)` | `(14.5, 18, 0)`   | `(14.5, -0.5, 0)` |

For multi-floor businesses, local X `2..5.5` and local Y `12..19` are protected for the internal stair on the first floor.

## Audited business placements

The desk pivot is the exact world point corresponding to the center of the authored service counter.

| Business                  | Footprint/floors    | Shell origin     | Desk world pivot     | Interior identity                                                                   |
| ------------------------- | ------------------- | ---------------- | -------------------- | ----------------------------------------------------------------------------------- |
| Ashline Containment Works | 28×22 / 1           | `(660,66,-55)`   | `(674.5,67,-38.5)`   | containment desk, Thermoblaster, stabilizers, quarantine cage, tanks, PPE, conveyor |
| North Anchor Repair Shed  | 28×22 / 1, expanded | `(752,62,27)`    | `(766.5,63,43.5)`    | calibration rig, repair bench, diagnostic panel, parts/tool storage                 |
| Glassyard Biome Studio    | 24×20 / 1           | `(1171,45,128)`  | `(1183.5,46,142.5)`  | Dye-O-Matic, palette/drafting tables, swatch wall, sample showroom                  |
| Redoubt Contract Yard     | 28×22 / 2           | `(1438,46,66)`   | `(1452.5,47,82.5)`   | fortified desk, planning rig, armory, threat room, upper war-room suite             |
| Eastgate Portal Office    | 28×22 / 2           | `(1564,65,-147)` | `(1578.5,66,-130.5)` | gate console, fuel inspection, route/cargo boards, portal arch, upper operations    |
| Southplot Rare Foods      | 24×20 / 1           | `(1711,49,-598)` | `(1723.5,50,-583.5)` | harvest scale, seed mill, cold larder, produce bins, drying rack, planter           |
| Cinderlane Tool Forge     | 28×22 / 2           | `(1616,42,-791)` | `(1630.5,43,-774.5)` | forge, anvil, quench trough, blade/material racks, upper repair suite               |
| Moonstall Ward Shop       | 24×20 / 1           | `(1715,26,-916)` | `(1727.5,27,-901.5)` | Thermolite, cauldron, potion/charm shelves, ward circle, anomaly panel              |
| Westtrail Guide Table     | 24×20 / 1           | `(1529,51,-705)` | `(1541.5,52,-690.5)` | map desk, survey camera, expedition table, trail supplies, hazard board             |
| Keylot Property Office    | 24×20 / 1           | `(1217,53,-799)` | `(1229.5,54,-784.5)` | blueprint desk, model home, drafting/signing areas, deed/sample storage             |
| Brightcart General House  | 24×20 / 1           | `(974,52,-944)`  | `(986.5,53,-929.5)`  | stock ledger, trade scale, order/dry-goods shelves, produce and crate display       |
| Ridgecooler Larder        | 28×22 / 1           | `(762,36,-678)`  | `(776.5,37,-661.5)`  | cold counter, ice trough, larder face, hanging cuts, packing/wash benches           |
| Greenlamp Walk-In Clinic  | 28×22 / 1, expanded | `(642,64,-193)`  | `(656.5,65,-176.5)`  | triage, two treatment cots, diagnostics, medicine/records, wash station             |
| Returnstone Pad Office    | 24×20 / 1           | `(30,40,-40)`    | `(42.5,41,-25.5)`    | pad terminal, homestone console, calibration, fuel/tokens, return plinth            |
| Clearbarrel Cleanup Yard  | 24×20 / 1           | `(423,44,-357)`  | `(435.5,45,-342.5)`  | composter, spray station, waste sorting, barrel/reagent/PPE storage                 |
| Hingehall Repair Shop     | 28×22 / 1, expanded | `(415,45,-328)`  | `(429.5,46,-311.5)`  | main and vise benches, parts/tool/broken-object storage, intake and orders          |
| Redpot Service Kitchen    | 28×22 / 1, expanded | `(411,43,-393)`  | `(425.5,44,-376.5)`  | pass counter, range/hearth, prep and cold tables, pantry, wash, dining              |
| Stampspur Courier Office  | 28×22 / 1, expanded | `(737,46,-562)`  | `(751.5,47,-545.5)`  | parcel scale/sorting, lockbox inspection, proof wall, bins/cage/satchels            |
| Lanternrest Road Inn      | 28×22 / 2           | `(592,47,-495)`  | `(606.5,48,-478.5)`  | reception, kitchen/hearth/common room, guest storage, four furnished upper rooms    |

The complete 211-fixture schedule and every local coordinate/size are in `business-interiors.json`. Keep that manifest authoritative instead of duplicating fixture arrays in runtime code.

## Reusable native furniture

These item IDs already participate in Harthmere crafting, vendors, inventory, and free-world/property placement. The Blender catalogue replaces their presentation without creating duplicate identities.

| Item ID                    | Native box size `(X,Y,Z)` | Placement    |
| -------------------------- | ------------------------- | ------------ |
| `business_service_counter` | `2×1×1`                   | floor center |
| `bench`                    | `2×1×1`                   | floor center |
| `table`                    | `2×1×2`                   | floor center |
| `t_table`                  | `2×1×2`                   | floor center |
| `wooden_chair`             | `1×1×1`                   | floor center |
| `padded_chair`             | `1×1×1`                   | floor center |
| `small_bed`                | `2×1×3`                   | floor center |
| `fancy_bed`                | `2×1×3`                   | floor center |
| `shelf`                    | `1×2×1`                   | floor center |
| `display_shelf`            | `1×2×1`                   | floor center |
| `wood_container`           | `1×1×1`                   | floor center |
| `treasure_chest`           | `1×1×1`                   | floor center |
| `cargo_crate`              | `1×1×1`                   | floor center |
| `lockbox`                  | `1×1×1`                   | floor center |
| `wardrobe_storage`         | `2×3×1`                   | floor center |
| `wall_lantern`             | `1×1×1`                   | wall center  |

Native integration:

- `harthmere_native_bikkie_items.ts` keeps the established numeric Bikkie identity, sets `isPlaceable`, native `boxSize`, optimized `collidableSize`, placement type, and the exact Blender-rendered `galoisIcon`.
- `placeables/helpers.ts` resolves these native item IDs to the Blender LOD0 URL before donor mesh or legacy Galois fallback selection.
- Placed furniture remains a normal ECS entity with `placeable_component`, `position`, and `orientation`.
- Native `checkAndOccupyTerrainForPlaceable` remains the collision/terrain occupancy authority. Inventory debit/refund, ACL checks, replay protection, ownership, move/remove, and container-empty checks remain unchanged.
- Gaia simulation is intentionally not added for static furniture. It would add unnecessary ticks and is not the native authority for placeable occupancy. Garden/farming objects should continue using their existing farming/Gaia path where applicable.

Do not render a business's combined static interior and duplicate standalone placeable meshes at the same coordinates. Use the combined GLB for authored business dressing; use the reusable item GLBs for player-owned/custom placements. If a business needs an ECS interaction entity at an already-rendered counter, use an interaction anchor or suppress that entity's duplicate presentation.

## Performance contract

- No image textures in any furniture or interior GLB; compact PBR colors only.
- Meshopt compression via `gltfpack 1.2 -cc`.
- Geometry joined by material, maximum nine materials/draw primitives per combined interior.
- 19 LOD0 + 19 LOD1 combined interiors total `2,197,880` bytes; largest is `106,248` bytes.
- 16 reusable furniture items × two LODs total about `210 KiB`; largest single furniture GLB is under `20 KiB`.
- Combined interiors: LOD0 through 16 m, LOD1 through 28 m, hidden beyond 28 m.
- Static interior clutter is merged into material batches. Collision uses manifest box proxies, never render-mesh triangle collision.
- The native placeable type resource shares one loaded GLTF per Bikkie item type rather than loading a mesh per ECS entity.

## Build and validation

```sh
/opt/homebrew/bin/blender --factory-startup --background \
  --python scripts/harthmere/blender/generate_business_interiors.py -- \
  --repo-root "$PWD" --render-previews

/opt/homebrew/bin/blender --factory-startup --background \
  --python scripts/harthmere/blender/generate_business_furniture_catalogue.py -- \
  --repo-root "$PWD"

node scripts/harthmere/test-business-interior-assets.cjs .

scripts/harthmere/t.sh file \
  src/shared/harthmere/test/harthmere_business_interior_placement.test.ts

scripts/harthmere/t.sh file \
  src/shared/harthmere/test/business_customer_simulator.test.ts

node_modules/.bin/mocha --config .mocharc.json \
  src/shared/harthmere/test/harthmere_business_furniture_assets.test.ts

node_modules/.bin/mocha --config .mocharc.json \
  src/server/logic/test/harthmere_placeable_transaction.test.ts
```

Current accepted validation result:

- 19 businesses
- 211 fixtures
- 178 collision boxes
- 38 interior GLBs
- zero fixture-to-fixture overlaps
- zero protected customer-aisle intrusions
- zero internal-stair intrusions
- 239 verified navigation routes covering entry, queue, counter, exit, fixture approaches, stairs, and upper floors
- all GLBs meshopt-compressed, texture-free, at most nine draw primitives
- all reusable assets resolve through semantic and native numeric IDs
- all icons are exact 256×256 RGBA Blender renders
- the existing 26-test outpost building/navigation suite remains green with the five expanded shells
- the native placeable transaction test passes atomic place/replay/remove and non-empty-container rejection

The asset phase also produced Blender previews for all 19 layouts and a contact-sheet review. Final in-game live-browser acceptance is intentionally assigned to the later simulation integration because combined interiors are not double-instantiated in the current runtime. That later task must use the mandatory all-19 matrix below; Blender preview evidence alone is not live-game evidence.

## Requirements for the later business-simulation overhaul

The later task must use these assets and points to replace each detached/card-style business experience with a real third-person in-world service shift:

1. The player works from the staff side of the real counter in the real business interior.
2. Real ECS/procedural NPCs enter through the real door, follow the protected aisle, join a spatial queue, idle, advance, face the player, and receive service.
3. Dialogue, response choices, timer/patience, payment, inventory requests/offers, XP, reputation, rewards, expressions, look-at, animation, locomotion, audio, time of day, rush hour, and customer cosmetics reuse existing systems.
4. NPCs react to correct, incorrect, timeout, and payment states, then turn around and walk back out through the real door before safe off-screen despawn.
5. Do not spawn customers at the counter, teleport them, remove them in view, use mannequins/debug boxes, or cover the room with a card board.
6. Preserve normal third-person camera control. Keep dialogue/choice/timer UI minimal and spatially grounded.
7. Customer and staff points must stay on opposite sides of the collidable counter. Door, queue, employee, and stair paths must remain clear.
8. Do not regress the corrected Cinderlane stair clearance, the five required 28×22 expansions, furnished upper floors, Redpot's restaurant-only identity, or the zero-overlap layout.
9. Do not rerun already-passed unrelated browser cases from the original mini-game task unless the new runtime overhaul invalidates them. Add focused simulation, navigation, asset, persistence, and all-19 visual/browser coverage for the new business experience.

### Mandatory all-19 mini-game test matrix

“Representative” coverage is not sufficient for the finished business simulation. The later implementation must produce a row-by-row result for every one of the 19 businesses at all three tiers:

1. **Unit/contract tests for all 19:** definition registration, exact outpost/anchor mapping, shift state transitions, queue ordering, patience/timer behavior, offer/request validation, correct/incorrect/timeout/payment outcomes, expressions/animation cues, rewards, XP, reputation, inventory conservation, and safe cleanup.
2. **Native E2E for all 19:** start the real shift through the frontend adapter, create the real ECS customer, observe authoritative path/queue/service state, complete one real transaction, verify reward/inventory/persistence through Logic and Sync, require the customer to reach the exit state, and verify reload/reconnect reconstruction. Include negative cases across the matrix rather than duplicating every negative case 19 times.
3. **Live browser for all 19:** in one exact-image warm stack, visit each real building, prove the combined interior renders at the audited coordinates, see an NPC enter the real door, queue and advance without clipping, face and express during service, complete the interaction, turn around, walk out, and disappear only after safe off-screen despawn. Save a per-business JSON result and visual evidence. Sampling only a few businesses is not acceptance.

Follow `TESTING_FASTER.md`: use `t.sh file`/the fast configuration for pure layout contracts, use the bootstrapped configuration for Bikkie/ECS/server-handler tests, never use parallel Mocha workers for scoped slices, run one compiler lane at a time, keep one exact-image stack warm, use one Chromium context at a time, record image ID/BUILD_ID/restart/OOM/readiness state, batch failures, and resume only failed business IDs instead of replaying green rows.
