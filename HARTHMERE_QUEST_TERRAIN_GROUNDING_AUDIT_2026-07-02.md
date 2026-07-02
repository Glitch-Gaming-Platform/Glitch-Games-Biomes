# Harthmere Quest / Terrain Grounding Audit — 2026-07-02

**Question:** on the hilly production terrain, are all jobs/quests completable, and do
the quest-relevant items, monsters, and animals appear on the map and sit **above**
the terrain (not buried or floating)?

**Method:** static review of the placement/grounding code + generated map, plus a
**live inspection of production** (install `25f687dd…`) through the running game —
reading actual entity positions from the ECS table and comparing them to the terrain.

---

## Verdict

The grounding **system is architecturally correct and works on the current hilly
terrain** — most things are grounded. There are two concrete risks to close: a small
number of ungrounded/stale positions, and a few NPCs sitting at anomalously high Y.

---

## Grounding system — correct (verified in code)

Every quest-relevant thing is routed through terrain grounding:

- **Muck monsters + livestock (hunted creatures):** seeded through
  `resolveHarthmereProductionMarkerPosition` (`server/harthmere/live_entity_ecs_seed.ts`),
  i.e. the terrain-grounded placement map — not raw authored coordinates.
- **NPCs (quest givers / vendors):** grounded at spawn and continuously during
  navigation (`harthmereNpcGroundedY`, `harthmere_assets.ts`).
- **Quest object markers, gathering nodes, item drops:** grounded at render time by
  the client terrain probe (`harthmere_entity_grounding.ts`).
- The placement-map audit script passes all checks
  (`scripts/harthmere/check-harthmere-production-placement-map.cjs`): jobs-board
  markers, quest markers, BiomesUI map pins, quest pointers, and 3D object markers all
  resolve through the grounded resolver.

## Placement map — 1,434 / 1,440 grounded

| placementMode | count | grounded? |
|---|---|---|
| outdoor_surface | 722 | ✅ |
| cave_spawn | 468 | ✅ |
| indoor_or_cave_floor | 250 | ✅ |
| **fallback_authored_y** | **6** | ❌ uses authored Y |

The 6 ungrounded records are the **three "high vault" exotic-matter deposits**
(antiboron / antihydrogen / antihelium, Y 97–102), each appearing twice (as a
`jobs_board_marker` find-target and an `exotic_matter_deposit`). If the vault floor is
not exactly at the authored Y, these quest-find items will float or bury.

**The generated map was last built on 2026-06-20 (~11 days before HEAD).** If the
production terrain changed since, even the "grounded" records can be stale.

## Live production findings (install `25f687dd…`)

- **Town NPCs are correctly grounded to the hilly terrain** — their Y tracks the hills
  (44 in the low town, ~70 on the rise), not stuck at a single flat Y. No loaded entity
  sits below the local ground band. This confirms the map + grounding match the live
  terrain in the town area.
- **Muck monsters / animals are renderer meshes** (not ECS entities), so they don't
  show in an ECS census — but their spawn positions come from the grounded resolver
  (above), so they inherit the same grounding.
- ⚠️ **A few NPCs sit at anomalously high Y**, well above the ~70 cluster:
  - **Jenny — Y 151 @ (493, −101)** — isolated, with no building/placeable beneath her
    in the loaded set; **likely floating / mis-grounded.**
  - Rosalie — Y 107 @ (534, −114); "Human Being" — Y 90 @ (544, −122); "Kitty Cosmos"
    — Y 90 @ (454, −96). Verify these are on real peaks/rooftops vs floating.

## Map appearance — OK

Quest/job/monster/item markers surface on the BiomesUI map through
`resolveHarthmereProductionMarkerPosition` (verified by the audit script), so they
appear at their grounded positions.

## Completability — OK on wiring

The resolver/marker wiring that quests depend on validates cleanly. Combined with the
already-shipped jobs-board and Road Ahead advancement fixes, the quest/job completion
paths are wired. (Individual per-quest playthrough still benefits from the deploy +
Chrome verification pass noted below.)

---

## Recommended actions (2)

1. **Regenerate the placement map from the CURRENT production terrain** — this
   re-grounds all 1,440 records (including the 6 high-vault deposits) to the live hilly
   terrain and closes the ~11-day staleness gap. Run from an **in-VNet host** (needs
   private Redis `10.0.0.12`, which the assistant sandbox cannot reach):

   ```bash
   HARTHMERE_WORLD_SYNC_REDIS_HOST=10.0.0.12 \
   NODE_OPTIONS=--max-old-space-size=8192 \
   node scripts/harthmere/build-production-terrain-placement-map.cjs --write --stride=8 --margin=64
   node scripts/harthmere/check-harthmere-production-placement-map.cjs
   ```

   Commit the regenerated `src/shared/harthmere/generated/production_terrain_placement_map.ts`
   and deploy.

2. **Verify the high-Y NPCs** (Jenny @151, Rosalie @107, the two @90). If they are not
   on a legitimate peak/rooftop, re-ground them (their spawn positions should route
   through the same resolver / `harthmereNpcGroundedY` path as the town NPCs that are
   correctly grounded).

**Sandbox limit:** a full 1,440-marker comparison against live terrain requires the
in-VNet regeneration above; from here I verified the grounding *system* end-to-end and
spot-checked live positions, which is why the town area checks out and the outliers
above are the specific things to confirm/fix.
