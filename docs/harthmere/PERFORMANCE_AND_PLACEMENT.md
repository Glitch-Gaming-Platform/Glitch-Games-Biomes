# Harthmere Performance And Placement Guide

This guide is the current operating contract for Harthmere placement,
streaming, NPC grounding, quest markers, and performance diagnostics.

The core rule is simple: production terrain is not flat. Streets, roofs,
indoor floors, water, caves, and hollows all affect where content should
appear. New quest items, monsters, map pins, HUD targets, and random spawns
must use the production terrain placement map, not authored `y=0`, old cluster
constants, or one-off coordinate overrides.

See also:

```text
docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md
docs/harthmere/HARTHMERE_TDD_BOOT_AND_TOWN_TESTS.md
```

## Placement Source Of Truth

The generated production placement map lives at:

```text
src/shared/harthmere/generated/production_terrain_placement_map.ts
```

Runtime code should consume it through:

```text
src/shared/harthmere/production_terrain_placement_map.ts
```

Regenerate and check it with:

```bash
NODE_OPTIONS=--max-old-space-size=8192 \
node scripts/harthmere/build-production-terrain-placement-map.cjs \
  --write \
  --stride=8 \
  --margin=64

node scripts/harthmere/check-harthmere-production-placement-map.cjs
```

Current placement rules:

- Fixed quest objectives use `resolveHarthmereQuestObjectivePlacement` or
  `getHarthmereQuestResolvedWaypoint`.
- Jobs-board, business, and live-helper markers use
  `resolveHarthmereProductionMarkerPosition` through their local adapter.
- Random above-ground placement uses `chooseHarthmereQuestOutdoorSpawnPoint`.
- Random cave placement uses `chooseHarthmereQuestCaveSpawnPoint`.
- BiomesUI map markers, HUD/minimap targets, quest pointers, server authority,
  and 3D markers must all consume the same resolved `recommendedPosition`.

## NPC Grounding

Do not trust authored terrain height for production NPCs. Named town residents
use stable anchors seeded from measured production terrain. When adding an NPC:

1. Identify the intended town cluster.
2. Add the NPC to `HARTHMERE_NPC_STABLE_ANCHOR` with the measured feet-Y for
   that cluster.
3. Add matching quest-target labels to
   `HARTHMERE_QUEST_TARGET_LABEL_CLUSTER_FEET_Y` when a marker should share
   the same terrain height.
4. Re-run the Harthmere placement checks and the browser survey before
   shipping.

Anchored NPCs bypass the safe-relocation pass. That relocation pass is useful
for ambient placement, but it can collapse nearby named NPCs onto the same
"first clear" column. The shared `HarthmereNpcClaimSet` keeps anchored NPCs
separated by applying deterministic small nudges only when a claimed XZ would
otherwise collide.

## Diagnostic Buckets

Town residents and wandering wilds creatures are separate diagnostic channels.
Wandering creatures can legitimately move off their initial sample point, so
do not hide town grounding bugs by loosening a global tolerance.

The auto-survey reports:

- `offGroundCount` for town residents.
- `offGroundWanderingCount` for wilds creatures.

Town resident warnings should stay strict. Wandering warnings are useful only
when the count is high enough to suggest a placement or motion bug rather than
normal movement.

## Performance Guardrails

The survey and runtime diagnostics must not create the performance cliff they
are trying to measure.

Current guardrails:

- Keep retained survey samples capped.
- Keep default NPC and streaming scan radii modest.
- Keep worst-frame history capped.
- Auto-throttle survey sampling when frame rate stays low.
- Pre-warm shard rings on spawn and after long fast-travel moves.

Fast-travel destinations should queue the pre-warm ring before the player
camera engages. The pre-warm descriptor lives in
`HARTHMERE_PERF_AND_PLACEMENT_PREWARM`.

## Mission Markers

Mission markers must clear when a mission becomes completed or inactive.

Current behavior:

- Completed missions are auto-untracked.
- `biomes:harthmere-mission-marker-clear` is dispatched for HUD layers.
- Nearby mission lists filter out active and completed ids.
- Marker placement resolves through the production terrain placement map.

## Dialogue Placement And NPC Identity

NPC dialog should match the bible-backed character identity. If a named NPC has
a backstory in `Harthmere_Bellbound_Dragon_Story_Bible (3).md`, their ambient
or quest-specific dialog should include at least one concrete detail from that
backstory.

Generic mood-only dialog is fine for unnamed walkers and crowd filler. It is
not enough for anchored named characters.

## Verification Checklist

Before shipping placement or performance changes:

1. Run `node scripts/harthmere/check-biomes-harthmere.cjs .`.
2. Run `node scripts/harthmere/check-harthmere-auto-survey.cjs .`.
3. Restart the server.
4. In the browser console, reset local survey and mission state:

   ```js
   window.__harthmereAutoSurvey?.clear?.();
   localStorage.removeItem("biomes.localDev.harthmere.questState");
   localStorage.removeItem("biomes.localDev.harthmere.missionEvents");
   localStorage.removeItem("biomes.localDev.harthmere.trackedMissions");
   location.reload();
   ```

5. Run an auto-survey for several minutes, then download the JSON.
6. Verify the JSON:
   - `npcs.offGroundCount` is at or near zero.
   - `npcs.offGroundWanderingCount` is interpreted separately from town
     residents.
   - No mission target has a large `targetFootDelta`.
   - No two different NPCs share the same final `position`.
   - Town and wilds frame rates stay within the expected local-dev ranges.

If a check fails, fix the shared placement source, cluster anchor, terrain
resolver, or marker transform. Do not add a one-coordinate patch for the
individual offender.

## Ownership Map

| File | Responsibility |
|---|---|
| `src/server/shim/main.ts` | NPC seed/spawn, stable anchors, claim set, dialogue |
| `src/client/components/challenges/LocalDevHarthmereQuests.tsx` | Quest definitions, quest targets, target terrain labels |
| `src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx` | Tracked mission state, auto-untrack, marker-clear events |
| `src/client/components/challenges/SnapshotLiveDiagnostics.tsx` | Auto-survey, wandering filter, auto-throttle, mission audit |
| `src/shared/harthmere/town_production_polish.ts` | Render budgets, LOD distances, streaming pre-warm |
| `scripts/harthmere/check-biomes-harthmere.cjs` | Static invariants for the current runtime contract |
