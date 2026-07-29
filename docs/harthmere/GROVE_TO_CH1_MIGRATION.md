# Grove Quests → Chapter 1 Structure

Companion to `BIBLE_TO_CH1_MIGRATION.md`. Converts the 51-quest Snapshot Grove
onboarding catalog to the same typed, native-ECS shape, so all three quest
systems (Chapter 1, Bible, Grove) share one vocabulary and one test strategy.

Also records the reassignment of Jackie's four fountain lessons.

---

## 1. What changed

| | Grove (before) | Grove (now) |
| --- | --- | --- |
| Objective storage | **three parallel arrays** indexed positionally | one object per step |
| Objective identity | none — bare strings | `id` + explicit frozen `index` |
| Ids | hand-maintained manifest | pinned, with derived fallback |
| Unlock | `unlockedBy` evaluated ad hoc | 1 of 3 kinds native, 2 gate-enforced, both declared |
| Waypoints | read `landmark.position` directly | resolver, and all 6 live readers routed through it (§8.2) |
| Engine rules | prose | `grove_engine_contracts.ts`, machine-checked |
| Fast tests | none | 81 tests, ~2 s (see §8) |

### The parallel-array problem

`SnapshotGroveQuest` stored an objective as three positionally-indexed arrays:

```ts
objectives: string[];   // "Use the Grove tracker to pin the Lesson Board."
triggers:   Trigger[];  // "interact"
markerIds:  string[];   // "grove_fountain_lesson_board"
```

Nothing tied index 2 of one to index 2 of the others. A hand-written test
existed solely to assert the three lengths matched, and inserting an objective
meant editing three places in lockstep. They are now one object, so the
invariant is structural rather than asserted.

---

## 2. Unlock model — only one of three kinds is native

```
after                   -> challengeComplete(prerequisite)   NATIVE
giver                   -> undefined                         available
after_fountain_lessons  -> undefined                         GATE-ENFORCED
after_accepted          -> undefined                         GATE-ENFORCED
```

The last two are deliberately not projected:

- **`after_fountain_lessons`** is a COUNT over a set ("any 4 of 13"). Native
  unlock triggers are a boolean tree over specific challenges; expressing it
  would need every 4-subset of 13 — 715 branches — and would need rebuilding
  whenever a lesson is added.
- **`after_accepted`** gates on a quest being STARTED. Unlock triggers fire on
  completion events; acceptance is not expressible at all.

Leaving them unprojected means the native challenge is *available* while the
gate refuses to *offer* it. That split is correct — availability is "the engine
has no objection", offerability is "the fiction is ready" — and
`groveValidateGateEnforcedQuestsHaveConditions` asserts every gate-enforced
quest really is gated, so one cannot silently become open from the first second
of the game.

---

## 3. The Grove coordinate-space bug

The Bible catalog's defect was `Y=0` on 312 of 340 waypoints. Grove's is the
same class with a different mechanism: **the landmark table mixes two vertical
datums.**

```
83 landmarks at Y=71  live marker height (terrain the browser loads)
25 landmarks at Y=54  retired authored height
   of which 10 are Harthmere-extension markers, where 54 is CORRECT
   and 15 are Grove-area markers stranded in the retired space
   of those, 10 are referenced by live quests
```

All 15 stranded rows are `econ_*` — Grove economy content authored later
against the old space. `snapshot_grove_content.ts` records the consequence in
its own header: *"the broken-courtyard logs showed the player at y=70.5 while
seeded Grove NPCs were still at y=53, leaving the mission cast buried under the
courtyard."* A marker 17 blocks under the floor is a browser test that walks
forever.

`grove_waypoints.ts` is the only module that may read `landmark.position`, and
as of §8.2 all six live readers go through it.
It lifts a Grove-area landmark out of the retired space and leaves
Harthmere-extension landmarks alone — lifting those would break the connector
quests in the other direction. `groveValidateWaypointsAreLive` asserts no
shipped waypoint is left behind, in about a second.

---

## 4. Giver reassignment: Jackie → Rosalyn

Four fountain lessons moved:

```
fountain_buttons_first
tools_before_treasure
fountain_hotbar_and_dropping
fountain_first_recipe_torch
```

Jackie keeps her other four Grove quests (jobs-board intro, road signs,
north-gate letter, road graduation).

### Why Rosalyn, and what the first attempt got wrong

The request was to move the quests to a Grove NPC with no quests. The only
literal candidate is the **Mucked Robot** — a corrupted machine in `muck_edges`
that cannot hold a conversation and is the entity the protected Muck vs.
Machine quest resolves around. Unsuitable on both counts.

The first replacement chosen was **Old Coop**, on the reasoning that he is in
`the_grove`, the same area as the fountain. That reasoning was wrong, and the
contract that should have caught it was wrong in the same way: an area-only
check passed him. Old Coop stands **139 blocks** from the fountain; every other
`the_grove` NPC is within 11. The four lessons all open and close at the
fountain, so his post would have turned the game's first tutorial into a long
round trip.

**Rosalyn** is 4 blocks away and her authored role is *"Fountain steward,
welcome-table"*. The lessons stay exactly where they happen.

`groveValidateGiverIsNearQuestOpening` now measures distance rather than
comparing area labels, so this cannot recur.

### Reassignment is not an id swap

Two things travel with a giver and were nearly left behind:

- **The prose.** `hook`, `sampleDialogue` and objective labels named Jackie.
- **The map markers.** The opening and closing objectives pointed at
  `npc_jackie`. Left alone, Rosalyn would offer a quest whose map arrow sends
  the player to Jackie — which reads as broken, not reassigned.

Both are retargeted by the same converter rule, and
`groveValidateTalkStepsPointAtTheirGiver` asserts an opening talk objective
points at its own giver.

### What was NOT touched

Road Ahead, Busted, Get the Muck Out and Muck vs. Machine are Bikkie biscuits
baked into `snapshot_backup.json` with engine-native trigger leaves
(`npcKilled`, `inspect`, `collect`). They are not Grove quests, the Grove
catalog cannot express them, and the converter cannot reach them.
`grove_giver_reassignment.test.ts` pins all four ids as literals and asserts no
Grove quest claims one, is titled like one, or falls in their id range.

---

## 5. File map

```
src/shared/harthmere/grove/
  grove_quest_schema.ts        types + closed unions
  grove_quest_ids.ts           pinned + derived ids (band 8_764_*)
  grove_quest_id_pins.ts       generated: 51 quest, 307 trigger-node pins
  grove_quests_fountain.ts     13    grove_quests_graduation.ts   1
  grove_quests_neighbor.ts      3    grove_quests_story.ts       19
  grove_quests_economy.ts      15
  grove_quest_catalog.ts       assembly, indexes, lesson set, giver index
  grove_quest_gate.ts          pure activation gate
  grove_waypoints.ts           retired-space lifting
  grove_native_quests.ts       Biscuit projection
  grove_engine_contracts.ts    ECS / Gaia / Anima rules
  grove_e2e_playthrough.ts     pure-data 51-quest simulator
```

Id bands, now all disjoint and asserted:

```
8_760_* / 8_761_*  pinned Grove + Bible (harthmere_native_quest_manifest)
8_762_*            Chapter 1 derived
8_763_*            Bible derived
8_764_*            Grove derived
```

---

## 6. Testing

```sh
t.sh grove           # 81 tests
t.sh grove:fountain  # 36 tests — parses 13 of 51 rows
t.sh grove:catalog   # full 51-quest / 255-objective walk (topology only)
t.sh grove:live      # the live-authority rows (was `grove:e2e`)
t.sh types:grove     # scoped typecheck — t.sh grove does NOT typecheck
```

`grove:e2e` is retired: it named the live rows, then briefly named the
pure-data walk, so the habitual command would have run the weaker tier. The
pure-data walk is `grove:catalog`; the live rows are `grove:live`; the browser
run is neither. See §8.1.

The pure-data playthrough catches, without a stack:

- a quest whose prerequisite is never completable
- a graduation needing more lessons than a new player can reach — the worst
  onboarding bug possible, since it dead-ends every account at the fountain
- a quest gated on the acceptance of a quest nobody can accept
- an objective whose marker has no landmark
- a step with no addressable native id (permanent soft-lock)
- the lesson set drifting out of sync with the graduation count

Browser checkpoints come from `seed-grove-quest-step.cjs`, which emits two
integers per completed leaf plus a **live-space** target position.

---

## 7. Results

| | |
| --- | --- |
| `t.sh grove` | 81 passing |
| `t.sh grove:catalog` | 31 passing |
| `t.sh types:grove` | clean |
| `t.sh ch1` / `quests` / `bible` | 319 / 184 / 105, unchanged |
| Quest source | 51 quests in 5 modules, one object per objective |
| Ids moved | none — 51 quest + 307 node pins hold |
| Stranded waypoints | 15 found, 0 shipped |

---

## 8. Follow-up pass: wiring, enforcement, and three corrected claims

A review of the first pass found six gaps. All six were accurate. Three of them
were cases where the work *claimed* more than it delivered, which is worse than
an unfinished item, so those were corrected first.

### 8.1 Corrected claims

**The waypoint test asserted a fix production did not use.** The resolver was
right; six live paths still read `landmark.position` directly, so the
player-facing map could still draw a stranded pin. The contract test is now
scoped ("resolves no waypoint into the retired space") and a separate
`grove_waypoints_production_wiring.test.ts` scans the real call sites.

That scan immediately found **3 bypasses that hand inspection had missed** —
`ch1_objective_targets.ts`, `jobs_board_quest_marker_positions.ts`,
`snapshot_complete_port.ts`. The hand count was 3; the true count was 6. That
gap is the argument for the scan existing.

**`GROVE_NON_ECS_OWNED = []` was false.** Cloud save carries
`acceptedQuestIds`, `completedQuestIds` and `completedObjectiveIds`. The list
now states the real compatibility state; `GROVE_NON_ECS_TARGET` holds the
(still empty) end state, and `groveValidateNonEcsStateIsDeclared` fails if the
declaration and the code disagree in either direction.

**`grove:e2e` named the weakest tier.** It previously meant the live authority
rows, then briefly meant the pure-data walk — so the command reached for by
habit would silently have run the weaker one. The pure-data walk is
`grove:catalog`; `grove:e2e` now exits with an error explaining the three
tiers.

### 8.2 Wiring

All six landmark readers now resolve through `grove_waypoints.ts`, and the
unwired list is empty.

`groveQuestGate` is the enforcement point: `isSnapshotGroveQuestUnlocked` is a
thin delegation and its three-branch switch is gone. `availableQuestsForNpc`
resolves givers through `groveQuestIdsForGiver` — it previously filtered on
`quest.giverNpcId` from the retired array, which meant **the Jackie → Rosalyn
reassignment was invisible to live dialogue** while every catalog test passed.

`grove_gate_enforcement.test.ts` covers the sharp case: because
`after_fountain_lessons` and `after_accepted` are deliberately unprojected,
their native challenges are available from the first second of the game and the
gate is the only thing stopping them. It asserts the engine does not object
(by design), that the gate refuses at zero progress, that one lesson short
still refuses, that non-lesson completions do not count, and that mere
acceptance does not satisfy a completion gate.

### 8.3 Exact requirements folded onto the step

The fourth positional index is retired. `requiredCount` (6), `targetMarkerIds`
(4), `craft` (2) and `inventory` (9) moved from `${questId}:${objectiveIndex}`
tables onto `GroveQuestStep`; the legacy accessors delegate and the tables are
deleted.

Two things worth recording:

- **`requiredCount` has two meanings.** On a single-target step it is a
  QUANTITY from one place ("Gather two practice sticks from the marked
  basket"); on a multi-target step it is how many DISTINCT markers to visit.
  A contract asserting `requiredCount <= targetMarkerIds.length` looks
  obviously right and flagged both quantity objectives as unsatisfiable.
- **`markerId` is not the target list.** Four objectives are multi-target, so
  anything deciding "did the player reach the target" must use
  `groveStepTargetMarkerIds` or they complete on the first of three moss
  patches.

`snapshotGroveObjectiveTargetMarkerIds` reads the step for the OVERRIDE only
and still honours the passed quest for the base case — an earlier wholesale
delegation ignored `quest.markerIds` and moved the first objective's marker
onto the second, which the map-adapter suite caught.

### 8.4 Results

| | |
| --- | --- |
| `t.sh grove` | 81 passing |
| `t.sh bible` / `ch1` / `quests` | 105 / 319 / 184, unchanged |
| `t.sh types:grove` / `types:bible` | clean |
| Landmark readers bypassing the resolver | 6 → 0 |
| Index-keyed requirement tables | 4 → 0 |

### 8.5 Still not proven

Nothing above is a browser-completion test. The pure-data tier proves
topology, ids, gates and waypoint existence. It does **not** prove items
appear, controls work, dialogue completes, exact recipes count, rewards
materialize, or the map renders. `grove:live` and the production browser run
remain required, and Grove quest state is still mirrored outside ECS —
`GROVE_NON_ECS_OWNED` says so.
