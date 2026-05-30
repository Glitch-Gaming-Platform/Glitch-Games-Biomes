# PERFORMANCE_AND_PLACEMENT — Harthmere / Biomes runtime guide

This document is for the next engineer (human or AI) who has to patch
Harthmere performance or NPC/marker placement. It exists because four
patches in a row (v91, v92, v93, v94) chased the same bug and three of them
fixed the wrong layer. Read this before adding a v95.

> **TL;DR rule that prevents the recurring bug:**
> The local-dev terrain generator returns flat ground (`localDevTerrainHeight`
> always returns `STARTER_TOWN_GROUND_Y = 52`). The **live installed snapshot
> terrain** is **not** flat — it has raised plazas, dock platforms, tavern
> floors, and bank counters at y=58 to y=73. Any code that places an NPC,
> sets a quest marker, or grounds an entity using authored terrain alone
> **will be wrong** at runtime. Use the v94 cluster anchor table
> (`HARTHMERE_NPC_STABLE_ANCHOR_V94`), or measure live with the v90 mission
> audit before introducing new positions.

For the current startup, visual-testing, Redis seeding, and shared
coordinate-source rules, also read:

```text
docs/harthmere/HARTHMERE_TDD_BOOT_AND_TOWN_TESTS.md
```

That guide is the canonical checklist for fast warm starts, when to use
Playwright/live browser checks instead of static render scripts, and how to
avoid invisible, floating, buried, or production-mismatched placements.

---

## 1. The four recurring patterns

Every audit since v84 has surfaced one or more of these. They are the same
bug class, not separate bugs. New patches must address them at the root,
not on the surface.

### Pattern A — Authored Y vs runtime Y mismatch

**Symptom.** NPCs reported as `buried` with `footDelta: -17` (e.g. y=53 NPC
under y=70 live ground). Mission target markers reported as `target delta
-19 blocks` (Whispering Crate marker at y=54 above terrain at y=73).

**Mechanism.** `localDevTerrainHeight()` always returns 52. The legacy NPC
grounding (`harthmereNpcFeetYForAuthoredColumnV91`) reads only the authored
generator, so it confidently returns y=53. But the snapshot drops live
shards at the same world XZ with `groundBlockY=72`. Player walks on the
live shard, NPC sits at the authored Y, NPC is buried.

**Root fix (v94).** Per-NPC stable anchor table seeded from measured live
feet-Y per cluster:

| Cluster | Measured feetY | Examples |
|---|---|---|
| Bakery / Chapel / Mudden / Farm / Orchard | 53 | Maren Dawnloaf, Father Aldren, Nessa Crowe, Old Jory |
| Apothecary / Magic Shop belt | 58 | Luma, Ysabet, Edrin |
| Bank / Services Plaza | 58 | Merl Voss, Anwen, Pellam, Wyne, Perrin |
| Guard Yard / North Gate | 58 | Bram, Hal, Rowan, Tarrow |
| Copper Kettle Tavern | 63 | Garrick, Elowen, Sola, Bela, Kip, Mern |
| Noble Rise / Reeve Hall | 63 | Reeve Caldus, Tax Clerk Iven, Rose |
| Market Board / Plaza fountain | 68 | Toma, Master Osric, Market Board itself |
| Black Anvil / Craftsman Row | 68 | Brann, Forge Apprentice Luth, Garrik Fen |
| River Docks | 73 | Tovin Reed, Ferry Master Wren, River Knots Lookout |

When you add a new NPC, you do **not** trust the authored generator. You
look up the cluster, set the anchor Y to that cluster's feetY, and add the
NPC to `HARTHMERE_NPC_STABLE_ANCHOR_V94`. The check script enforces this.

If the new NPC is somewhere not in any cluster above, **run a v90 mission
audit at that XZ first**, read `targetTerrain.feetY`, and use that value.

### Pattern B — Multiple NPCs collapsing to one column

**Symptom.** Three different NPCs all reported at `[1084, 53, -188]` in the
audit: Tovin Reed, Ferry Master Wren, River Knots Lookout. Same for the
Market Board cluster: Toma, Master Osric Vale, and the Market Board itself
all at `[1010, 58, -219]`.

**Mechanism.** `harthmereNpcSafeAuthoredPositionV89()` searches outward from
each NPC's authored position for the *first* clear column. Because
neighbors have overlapping authored positions, the same "first clear"
spot keeps winning, so every neighbor ends up there.

**Root fix (v94).** A shared `HarthmereNpcClaimSetV94` is passed through
the NPC creation loop in `makeLocalDevNpcChanges`. Each anchored placement
calls into `harthmereResolveCollisionV94` which:
1. Tries the anchor XZ unmodified.
2. If already claimed, applies a deterministic ±2 nudge based on the NPC's
   id offset (eight compass directions, indexed by offset).
3. Retries up to six times before giving up gracefully.

Result: 60 anchored NPCs, 60 unique XZ keys (verified by the check
script).

Crucially, anchored NPCs **bypass** the safe-relocation pass entirely.
That's what was generating the collisions in the first place.

### Pattern C — Wandering enemies dominating diagnostic warnings

**Symptom.** 190 NPCs reported off-ground, but 81/190 (43%) were mucklings,
muckers, and hexers — wandering wilds creatures whose foot-Y changes as
they walk. The real Harthmere bury issue (the 30 named NPCs at y=53 under
y=70 ground) was buried under noise.

**Root fix (v94).** The survey now splits the off-ground list into two
buckets via `isHarthmereWanderingNpcLabelV94`:

- `offGroundCount` — town residents only (the audit target)
- `offGroundWanderingCount` — wilds creatures (separate channel)

The console warning fires on `offGroundCount > 0` always, but only on
`offGroundWanderingCount > 20` (rare placement bug, not motion noise).

**Do not** loosen the wandering tolerance again. Loosening tolerance was
v92's approach and it produced the false-pass-real-fail signal that hid
the actual town bug for two more patch cycles.

### Pattern D — The survey making its own perf cliff

**Symptom.** v90 capture at fps:6, longTaskCount:5496, heapUsed:2.3GB.
793 retained samples after 14 minutes. The diagnostic was contributing.

**Root fix (v94).**
- Retention cap reduced from 180 to 60 samples.
- Default NPC scan radius reduced from 56 to 40.
- Default streaming scan radius reduced from 72 to 56.
- Worst-frames cap reduced from 20 to 12.
- New auto-throttle: if fps stays below 12 for 3 consecutive samples, the
  interval triples until fps recovers above 18.

### Pattern E — Mission markers persisting after completion

**Symptom.** Audit `nearbyAvailable` listed quests that were already
in-progress or completed; the marker pin stayed up.

**Root fix (v94).** The mission system now auto-untracks any tracked
mission whose status moves to `Completed`, and dispatches
`biomes:harthmere-mission-marker-clear` for external HUD layers to pick
up. The `nearby` list now also filters out missions whose ids are in
`active` or `completed`.

---

## 2. The recurring trap: per-coordinate patches

The wrong way to handle a buried NPC is to add a single per-coordinate
override and move on. v91 and v93 did this for Tovin Reed three times.
Every time the next audit found three more buried NPCs in adjacent
clusters, because the patch fixed one coordinate, not the cluster.

**Always:**
1. Run the v90 mission audit and look at the **cluster** of buried NPCs,
   not the worst individual.
2. If the cluster shares a measured `targetTerrain.feetY`, the fix belongs
   in `HARTHMERE_NPC_STABLE_ANCHOR_V94` for the **whole cluster**, not just
   the worst offender.
3. If a quest target marker is off by the same delta as the NPCs in that
   cluster, add the target label to
   `HARTHMERE_QUEST_TARGET_LABEL_CLUSTER_FEET_Y_V94` as well.

---

## 3. The "walking into whitespace" issue

Players reported landscapes loading visibly *after* they enter the camera
frustum. The cause is that the renderer streams shards on first look. The
first ~3 seconds after spawn or fast-travel have no warm cache.

**v94 fix.** `HARTHMERE_PERF_AND_PLACEMENT_PREWARM_V94` exports a ring
descriptor (`ringRadiusMeters: 96`, `probeStrideMeters: 16`,
`teleportPrewarmThresholdMeters: 64`). The renderer queues a fixed shard
pre-warm on spawn and re-runs it if the player teleports more than the
threshold from the last pre-warm origin. The ring is idempotent — re-calls
are no-ops once shards are resident.

When adding new fast-travel destinations: call the pre-warm with the
destination XZ before the player camera engages.

---

## 4. Dialogue authoring rules

The pre-v94 dialog was stock 3-line patter that didn't match NPC
backstories. v94 rewrote dialog for the bible-backed core 14 NPCs (Maren,
Merl, Bram, Mara, Osric, Elowen, Aldren, Reeve, Nessa, Tovin, Maelle,
Garrik Fen, Luth, Hal/Walt, Wren).

**The rule:** if an NPC has a backstory in
`Harthmere_Bellbound_Dragon_Story_Bible (3).md`, their dialog **must**
include at least one specific detail from that backstory (a relative's
name, an age, a profession history, a known secret). Generic
mood-statement dialog is OK only for unnamed walkers and crowd-filler
NPCs.

**Edge cases.** NPCs that are quest-givers may speak in two modes: their
ambient dialog (set in `starterNpc(...)`) and the quest-specific lines
that route through `LocalDevHarthmereQuests`. Both must be consistent
with the bible. The check script verifies that the named-and-stationary
roster has anchors; future work should add a dialogue check that grep's
for at least one bible reference per anchored NPC.

---

## 5. Verification checklist for the next patch

Before shipping v95+:

1. `node scripts/harthmere/check-biomes-harthmere-v94.cjs .` passes.
2. `node scripts/harthmere/check-biomes-harthmere-v90.cjs .` passes.
3. `node scripts/harthmere/check-biomes-harthmere-v87.cjs .` passes.
4. `node scripts/harthmere/check-harthmere-auto-survey-v84.cjs .` passes.
5. Server restart, then in the browser console:
   ```
   window.__harthmereAutoSurveyV84?.clear?.();
   localStorage.removeItem("biomes.localDev.harthmere.questState.v1");
   localStorage.removeItem("biomes.localDev.harthmere.missionEvents.v1");
   localStorage.removeItem("biomes.localDev.harthmere.trackedMissions.v1");
   location.reload();
   ```
6. Run an auto-survey for 5 minutes, then `download()` the JSON.
7. In the JSON, verify:
   - `npcs.offGroundCount` (town) is at or near 0 — anything >2 means a
     missing or wrong cluster anchor.
   - `npcs.offGroundWanderingCount` may be high; that's expected, mucklings
     wander.
   - No `targetFootDelta` over ±4 on any mission target.
   - No two different NPCs at the same `position`.
   - `performance.fps` averages above 18 in town, above 12 in wilds.

If any of those fail, **do not** patch the individual offender. Add the
cluster to the anchor table (or the label to the quest-target Y map) and
re-test.

---

## 6. Quick reference — where things live

| File | What it owns |
|---|---|
| `src/server/shim/main.ts` | NPC seed/spawn, `HARTHMERE_NPC_STABLE_ANCHOR_V94`, claim set, dialogue |
| `src/client/components/challenges/LocalDevHarthmereQuests.tsx` | `QUESTS`, `QUEST_TARGETS`, `HARTHMERE_QUEST_TARGET_LABEL_CLUSTER_FEET_Y_V94` |
| `src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx` | tracked-mission state, auto-untrack on completion, marker-clear events |
| `src/client/components/challenges/SnapshotLiveDiagnosticsV78.tsx` | auto-survey, wandering filter, auto-throttle, mission audit |
| `src/shared/harthmere/town_production_polish_v1.ts` | render budgets, LOD distances, streaming pre-warm |
| `scripts/harthmere/check-biomes-harthmere-v94.cjs` | static invariants for the v94 fixes |

---

## 7. Why this matters

The user paid for v91, v92, and v93 patches that diagnosed correctly but
fixed the wrong layer. Each one was a fresh "looked right, didn't work."
v94 was the first to:

1. Use the **measured** live terrain Y from the v90 audit as ground truth.
2. Bypass safe-relocation for anchored NPCs (the source of stacking).
3. Maintain a collision claim set across the whole NPC seed loop.
4. Override quest-target Y at the transform boundary so markers and NPCs
   match.
5. Filter wandering creatures out of the warning signal.
6. Auto-throttle the survey so it stops being part of the problem.

If a v95 ships and the same audit pattern recurs, that means a step in
this README was skipped. Re-read section 2.
