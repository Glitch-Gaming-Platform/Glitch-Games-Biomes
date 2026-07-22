# Harthmere Performance And Placement Guide

This guide is the current operating contract for Harthmere placement,
streaming, NPC grounding, quest markers, and performance diagnostics.

The core rule has two coordinate spaces. The original snapshot/Grove terrain is
hilly and must be sampled. The additive Harthmere extension is deliberately
flat at ground Y=52 / feet Y=53. Streets, roofs, indoor floors, water, caves,
and hollows still determine whether a placement is outdoor, indoor, or an
intentional negative-Y dungeon coordinate.

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

## NPC and object grounding

For additive Harthmere town NPCs, use a stable authored X/Z anchor and let the
runtime normalizer set feet Y=53. The old per-cluster Y values were measured on
the retired overlapping snapshot layout and apply only to standalone legacy
mode. When adding a town NPC:

1. Identify a clear intended X/Z near the correct building or road.
2. Add the NPC to `HARTHMERE_NPC_STABLE_ANCHOR`; use the base Y in authored
   data because the additive runtime owns the final Y=53.
3. Add matching quest-target labels to
   the shared transformed marker source when needed.
4. Re-run the coordinate contracts and production grounding gate.

For original-map Grove NPCs/hostiles, use open-sky terrain grounding. For
roofed business NPCs and seeded crafting stations, use nearest-floor grounding
without open sky. Never flatten original-map content to Y=53.

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
3. Run `node scripts/harthmere/check-harthmere-extra-town-offset.cjs`.
4. During deployment, do not skip
   `scripts/harthmere/probe-production-terrain-grounding.cjs`; it repairs and
   reads back every deterministic actor/object family.
5. Restart the server.
6. In the browser console, reset local survey and mission state:

   ```js
   window.__harthmereAutoSurvey?.clear?.();
   localStorage.removeItem("biomes.localDev.harthmere.questState");
   localStorage.removeItem("biomes.localDev.harthmere.missionEvents");
   localStorage.removeItem("biomes.localDev.harthmere.trackedMissions");
   location.reload();
   ```

7. Run an auto-survey for several minutes, then download the JSON.
8. Verify the JSON:
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
