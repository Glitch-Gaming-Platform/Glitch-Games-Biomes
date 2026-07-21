# Harthmere Town Flatten Runbook (flat-town fix, 2026-07-14)

> **Deprecated for the connected production town.** Do not run this in-place
> flatten against the original map. Harthmere now uses the additive extension
> documented in `docs/harthmere/ADDITIVE_WORLD_EXTENSION.md`: new terrain at
> X=1792..2559, flat Y=52, with no original terrain replacement. This runbook
> remains only as historical documentation and for isolated legacy snapshots.

## Why

The 2026-07-14 systems audit measured the production terrain under the
Harthmere town rectangle at **surface Y 48–86** (median 66) — the design
requirement is that the town sits on **completely flat land**. Business
outposts level their own pads; the town core never had a terraform pass, and
~400 renderer props default to a flat `GROUND_Y` constant that disagrees with
the measured surface.

## What the fix does

- **Pure edit math** lives in `src/shared/harthmere/town_flatten_terraform.ts`
  (unit tests: `src/shared/harthmere/test/town_flatten_terraform.test.ts`):
  - Flatten area = the union of the 12 district-bible rectangles
    (authored X 380–660, Z −380…−100 → extension X 1980–2260 after the +1600 shift),
    **minus a ±16 protected hole around the Thaedryn arena anchor**
    (authored 640, −268) so the dragon quest's land is never bulldozed.
  - Target level `HARTHMERE_TOWN_FLATTEN_TARGET_Y = 52`, matching the additive
    generator. The Q12 boss stands at feet Y=53.
  - Per column: carve air above 52, backfill dirt below it, re-cap with
    grass. Already-flat columns produce **zero edits** (idempotent);
    water columns are skipped (the river keeps its bed); carve/fill are
    bounded (94 / 46) so no column can demand unbounded work.
- **Apply script** `scripts/harthmere/flatten-harthmere-town-terrain.cjs`
  edits terrain shards directly on the world redis (same machinery as
  `materialize-business-outposts-redis.cjs`), batched and resumable. It
  REFUSES to run if `validateHarthmereTownFlattenContract()` fails.
  This deliberately does **not** go through the live_mode mutation path:
  ~32k columns through the shared-blob WATCH transaction is the contention
  failure mode of the 2026-07-13 audit's finding 4.

## Procedure (in-VNet host)

```bash
# 0. Preconditions: repo at the revision containing this runbook; redis host
#    for the production world; players warned (terrain edits are visible live).

# 1. Dry run — prints column stats + planned edit count, writes NOTHING:
REDIS_HOST=10.0.0.12 node scripts/harthmere/flatten-harthmere-town-terrain.cjs

# 2. Sanity-check the dry-run summary:
#    - columnStats.total ≈ 77k columns considered, most "flat"/"carved"/"filled"
#    - plannedEditCount in the low hundreds of thousands at most
#    - editedShardCount well under 2,000

# 3. Apply:
REDIS_HOST=10.0.0.12 APPLY=1 node scripts/harthmere/flatten-harthmere-town-terrain.cjs

# 4. MANDATORY follow-up — regenerate the placement map so all 1,446 grounded
#    records (quests, NPCs, monsters, interactables) re-anchor to the new
#    surface (this also clears the stale 2026-06-07 map, audit finding Q-3):
HARTHMERE_WORLD_SYNC_REDIS_HOST=10.0.0.12 NODE_OPTIONS=--max-old-space-size=8192 \
  node scripts/harthmere/build-production-terrain-placement-map.cjs --write --stride=8 --margin=64
node scripts/harthmere/check-harthmere-production-placement-map.cjs

# 5. While in the VNet, also clear the other standing world-data items:
#    - rematerialize muck patches as muckwad (July 1 runbook §2)
#    - verify the previously-reported high-Y NPC outliers are gone
```

## Safety properties (enforced by code + tests)

| Property | Where enforced |
|---|---|
| Arena hole: the dragon quest land is never flattened | `isHarthmereTownFlattenAuthoredColumn` + contract check + tests |
| Connector road keeps natural terrain | contract check (`128,-209` outside) |
| Idempotent re-runs | zero edits for already-flat columns (tested) |
| Rivers keep their beds | water columns skipped (tested) |
| Bounded work per column | carve cap 94 / fill floor 46 (tested) |
| Boss anchor and flat level agree (3D combat reach) | contract check #4 |
| Script refuses to run on contract failure | `main()` first statement |

## After-effects to expect

- Renderer buildings/props/NPCs re-ground through the shared probes, so they
  follow the new surface automatically; the placement-map regen (step 4)
  re-anchors everything server-side.
- The flat level matches the renderer's authored `GROUND_Y` era assumption
  much more closely (53.05 authored vs 53 extension feet — the +1600-shift town sits
  higher; do NOT change `GROUND_Y` without re-measuring after the flatten).
