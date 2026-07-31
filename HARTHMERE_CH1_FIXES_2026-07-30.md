# Chapter 1 — audit fixes, 2026-07-30

Companion to `HARTHMERE_CH1_QUEST_AUDIT_2026-07-30.md`. Every gap in that audit
is now closed, plus three larger problems the audit missed and the HAR exposed.

**452 tests pass, 0 fail** across the Chapter 1 surface, the shared Grove/Bible
quest catalogues, the native Bikkie registry and the client HUD/interaction
tests.

---

## What you reported, and what it actually was

### 1. "The tea location doesn't exist"

Confirmed from the HAR before touching anything. `chapter1_progress` returned:

```json
{ "authoredStepId": "the_tea",
  "objective": "Eat what Jackie put in front of you and drink the tea.",
  "targetLabel": "Tea",
  "targetPosition": [418, 53, -237],
  "distance": 27.35 }
```

`[418, 53, -237]` is `rat_crowns_den` — **Teague "Teak" Morrow's spawn**, a
detained Take Terra courier in a muck drain 137 m from the fountain. That is the
second objective in the chapter.

Cause: `ch1_objective_targets.ts` matched the cast with a bare bidirectional
`String.includes`, and `normalized("Tea")` = `"tea"` is inside
`normalized('Teague "Teak" Morrow')` = `"teague teak morrow"`. The correct
`["tea", jackie_post]` alias existed and was unreachable, because the cast scan
ran *before* the alias table.

Three fixes:

- **Whole-token matching.** `containsTokenRun` compares token sequences, not
  characters. Single-token targets must match a whole token and be ≥4 chars, so
  "Tea" can never bind "Teague" but "Dr. Lucien Ardan" still binds Lou.
- **Authored intent first.** Resolution order is now dungeon → exact landmark →
  alias → cast → fuzzy → district. An alias can no longer be shadowed.
- **Apostrophe-safe normalization.** `"Coretta's ledger"` normalized to
  `"coretta s ledger"`, which matched no alias key — so it, and
  `"Jackie's kettle"`, silently fell to the district fallback. Possessives now
  collapse to `corettas`/`jackies`.

There is a regression test asserting the tea never resolves to a cast member.

### 2. "There doesn't appear to be a Jackie's place"

There wasn't one — anywhere. Every Act 1 domestic beat aliased to `jackie_post`,
which is `SNAPSHOT_GROVE_FOUNTAIN_CENTER` (496/-126). "Get out of bed", "drink
the tea", "watch Jackie make the tea", "search the stores" and "sleep in the
road-house" all pointed at the same public plaza tile.

The Grove has no authored architecture at all: the 57 authored buildings are the
Harthmere additive extension, `+1600` in X on a flat Y=52 foundation, half a map
away. Carving voxels into live Grove shards means replacing shards that hold
player edits — the one operation this repo has repeatedly got wrong.

So the road-house is built the way the engine builds furniture that needs
behaviour (world anatomy §4.3.1): **seven real ECS placeables** on the plaza's
north-east arc, via `newPlaceable` and the same create-only reconciler the Grove
race minigame already uses.

| Prop | Placeable | Column | Serves |
|---|---|---|---|
| The Grove Road-House | oak sign | 508/70/-119 | front door, warp target, map pin |
| Jackie's Kettle | campfire | 509/70/-117 | `the_tea`, `notice` |
| Jackie's Breakfast Table | container | 510/70/-119 | `the_tea` |
| Spare Room Cot | container | 512/70/-116 | `wake_up`, `sleep_alone` |
| Road-House Stores | treasure chest | 511/70/-114 | `search_the_stores`, `resume_dosing` |
| Coretta's Ledger | oak sign | 513/70/-119 | `check_corettas_ledger` |
| Grove Watch House | oak sign | 492/70/-134 | `report_or_not`, `read_the_letter`, Act 6 |

`ch1_roadhouse.test.ts` asserts the columns are clear of every existing Grove
landmark with a one-block cordon, that the cluster stays within 12 m of the door,
that every prop stands on the Grove feet datum, and that the seven Act 1/4/5
interior beats resolve into it.

Create-only matters: production re-seeds on every boot, and an `update` would
erase a container's contents each time.

### 3. "I was NOT teleported to the right location"

The chapter began wherever the player was standing when Muck vs. Machine
completed — in your case in muck combat at 27 m from Teak — and then told them to
get out of bed.

Added a `stage` action to `HarthmereChapter1WarpEvent`, published once by
`chapter1_progress` the first time the `wake_up` objective is served. It is the
most restricted warp action in the chapter: Grove-side only, and refused outright
while the player holds a dungeon run admission, so it can never be used to enter
or escape the Elsewhen band.

### 4. "The constant window in the HUD should not be there"

It was a permanent banner printing the quest title, objective text and a live
metre count — duplicating the objective tray and acting as a second, inconsistent
wayfinding system.

Root cause: every Chapter 1 leaf is a bare `harthmereQuestProgress` event
trigger, and an event trigger carries no position. So
`triggerDefDefaults` → `nativeQuestProjectedNavigationAid` — the path Road Ahead,
Busted, Get the Muck Out and Muck vs. Machine all use — had nothing to draw, and
Chapter 1 had no map pin, no minimap pin and no beam.

- **`navigationAid` now ships on every non-dungeon leaf** (62 of 80).
  `{kind: "entity"}` when the objective is a person, so the marker tracks the
  NPC's live position; `{kind: "position"}` otherwise. Dungeon interiors are
  excluded on purpose: the Elsewhen band is warp-only and off the world map, so a
  pin there would beam at a target two kilometres away.
- **The banner is gone.** What remains appears only when the player is in range:
  the `F — <action>` affordance and a server refusal reason. Same as every other
  world interaction.

### 5. "Make sure all locations exist and appear on the map"

Chapter 1 sends the player to eleven locations and pinned **none** of them. The
Grove's own 77 landmarks all flow through `/api/world_map/landmarks`; Chapter 1
anchors lived in `CH1_ANCHORS` and were never exposed.

Added `ch1_map_landmarks.ts` and `appendChapter1WorldMapLandmarks`. Eleven pins:
the road-house, watch house, Coretta's desk, Greenlamp clinic, Ashline, the
Returnstone pad, the Old Bridge, the Old Wood copse, the fence line, and both
dungeon gates. `gate_prime` is deliberately excluded — naming the Act 6 epilogue
aperture on the map would announce the ending (journal §0).

---

## The bigger thing the audit missed: 25 anchors were off the ground

While wiring the map I checked every anchor against the production terrain scan.
**25 of 39 `CH1_ANCHORS` were between 2 and 21 blocks off the surface the browser
actually loads.**

| Anchor | Was | Now | Error |
|---|---|---|---|
| `mosslawn_song_stones` | 71 | 50 | 21 blocks in the air |
| `ranger_jane` | 71 | 50 | 21 in the air |
| `gate_winter` / `muck_scarred_helix` | 54 | 33 | 21 in the air |
| `harthmere_bridge_center` | 71 | 58 | 13 in the air |
| `grove_supply_chest` | 54 | 71 | 17 underground |
| `grove_wishing_well` / `grove_garden_gate` | 54 | 70 | 16 underground |
| `broken_safe_zone_fence` / `gate_fence_sighting` | 71 | 81 | 10 underground |
| `lanternrest_road_inn` / `eastgate_portal_office` | 48 / 66 | 58 / 76 | 10 underground |
| `greenlamp_clinic` | 65 | 71 | 6 underground |
| `ashline_containment_works` | 67 | 73 | 6 underground |
| `returnstone_pad_office` | 41 | 47 | 6 underground |
| …and eleven more between 2 and 7 | | | |

The header comment claimed the anchors came from the placement map; they took X/Z
from it but not the resolved surface height.

This is why the world looked wrong. **Halden Rook was seeded 13 blocks above the
Harthmere bridge. Arbiter Vane 6 blocks under the Returnstone pad. Dr. Ardan 6
blocks under the Greenlamp clinic floor.** Cast placements come straight from
these anchors, so the chapter's antagonist and two of its three faction contacts
were buried or falling.

A second, related bug: `groveLandmarkWorldPosition` lifts a stranded landmark out
of the retired Y=54 datum onto **one flat plane** (Y=71). That is right for the
fountain plaza and wrong everywhere else, because the Grove is hilly — 48 at
Mosslawn, 64 at Luis's cart, 73 at Shutter Cove, 80 at the fence. Chapter 1
objectives at those landmarks inherited the flat plane.

Fixed by routing landmark resolution through
`resolveHarthmereProductionMarkerPosition`, which
`docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md` names as the
documented path for "helper landmarks and other shared marker ids". It resolves
all 77 Grove landmarks, not the 7 Chapter 1 happens to use, and needs no
maintenance. (My first pass hand-baked a 7-entry override table; using the
sanctioned resolver instead was your prompt about the guide.)

`ch1_anchor_grounding.test.ts` recomputes every anchor **and** every objective
target from the scan and fails if any drifts more than 2 blocks.

> Still open: the shared Grove flat-plane datum affects every Grove quest, not
> just Chapter 1. Chapter 1 now resolves correctly around it; fixing
> `grove_waypoints.ts` itself is a wider change and is not in this pass.

---

## Audit gaps closed

### P0

**Dungeon-entry soft-lock.** A gate opened as soon as `highestReachedAct` reached
its act — five objectives before the dungeon quest started. Entering in that
window was unrecoverable: the exit needed retrievals you couldn't get, the dungeon
objectives weren't servable, death warped you back to the arrival, and eviction
didn't fire because your admission was valid. Entry now requires the dungeon's own
challenge to be in progress (`ch1DungeonQuestForDungeonId`).

**Abandon-run exit.** "A retrieval, not a clear" was also the *only* way out, so a
refused exit was indistinguishable from a soft-lock. Added an explicit
`{action: "exit", abandon: true}`: the run is forfeited, **no completion flags are
granted**, encounters reset on re-entry. Refusals now return `canAbandon: true`.

**Escorts were killable.** `ANIMA RULE 3` calls Iris, Marrow and Sorrel
"unkillable, non-negotiable", but the only enforcement was a test grepping
encounter *strings* for their names. They were seeded with ordinary `Health`,
their combat policies walk them into 3×90 HP Salt-Cured Muckers and a 420 HP
Gilded Bull, and Chapter 1 has no escort revive. One dead companion ended the
chapter. Now enforced at the single choke point — `updateNpcHealthEvent` drops
negative deltas for those ids. Healing still applies.

**Marrow was mandatory and optional at once.** `ch1_dungeons.ts` marks the
retrieval `required: false`; `ch1RequiredEscortNpcsForObjective` returned both
desert escorts. Since `d1_the_long_walk` is what sets `ch1_iris_rescued`, and the
exit needs that flag, a lost dog was a soft-lock. Split into
`ch1RequiredEscortNpcsForObjective` (Iris) and
`ch1OptionalEscortNpcsForObjective` (Marrow). The test that encoded the
contradiction was updated to match the design doc.

**Winter exit three steps early.** Winter's three required retrievals all land at
`d2_the_oath`, step 6 of 9, so the retrieval rule alone permitted a legal exit
before the boss, Hallr's choice and the escort out. The exit now also requires the
run's final authored step (`ch1DungeonFinalStepId`).

### P1

**The E2E test validated a model nobody plays.** `ch1_e2e_playthrough.test.ts`
walks `ch1_chapter.ts`, which has no production callers —
`ch1AvailableQuestIds`, `ch1ActUnlocked` and quest-level `requiresFlags` are all
dead in the shipped path. Both dungeon soft-locks were invisible to it by
construction.

Added `ch1_native_path_e2e.test.ts`, which drives the **real** reducer
(`ch1ApplyLiveObjectiveEffects`) through all 80 objectives in native order, with
no `?e2e=1` bypass and no directly-set flags. It asserts every act flag, an
ending, that every consumed item was actually granted earlier, that every item
moved has a native inventory identity, and that **no step falls through to the
district fallback**.

**60% of steps had no verification.** Two of those promised a physical act and
checked nothing: "Take a vial to Doc" and "Give the vial to Dr. Ardan" both now
require possession of `item_ch1_compound_b`. Deliberately possession, not
consumption — `search_the_stores` grants one vial and Act 5's `resume_dosing`
consumes one, so spending it in Act 4 would have created a *new* soft-lock. Both
scenes say the doctors hand it back.

**The twelve testimonies.** `collect_testimonies` assigned all twelve accounts in
one call, so twelve authored one-sentence testimonies shipped in the bundle and
were never read. Collection is now incremental and idempotent — one account per
conversation, with a running count, and the objective only fires on the twelfth.
This needed a new `Ch1ObjectiveIncomplete` signal so the endpoint can **persist
partial progress while refusing the trigger**.

### P2 / P3

- **Coretta and Foreman Calla Ashe had no entity anywhere.** Both were quest
  givers and named dialogue targets; their quests auto-started by accident and
  Calla's "How did you do that?" resolved through the district fallback to a bare
  anchor. Both are now seeded cast with placements, staging and writer notes.
  `how_did_you_do_that` binds Calla's entity at 672/73/-46.
- **`the_word` (Act 6 consolidation)** has `targetLabel: "—"`, which normalizes to
  the empty string, so its alias was unreachable and the scene resolved to the
  town fountain — between two objectives that are both at Lou. Now explicitly at
  Lou.
- **Internal item ids shown to players.** *"You need item_sorrel_field_ledger
  before completing this objective."* Now uses `ch1ItemDisplayName`, passed the
  flag set so the two compounds keep their pre-Act-6 cover names.
- **Hardcoded fallback warp** `[496, 71, -126]` — the fountain at marker height,
  one block above the measured surface — replaced with the shared eviction anchor.
- **Encounter scheduler under multiple replicas.** It runs in the web process and
  mutates shared state (Ninth Winter loop counter, Gilded Bull broken parts,
  hazard damage). In `Multiple` mode every replica ticked it. Now takes a 5 s
  Redis `SET NX PX` lease; only the holder ticks. (The escort scheduler was
  already safe — an unchanged tick emits zero writes.)

### Accepted, documented, not "fixed"

`hear_vane` is ~470 m west at the Returnstone pad during an Act 6 quest whose
district is "The Grove", and Rook's four objectives are across the Harthmere
bridge. `ANIMA RULE 4` forbids relocating a shared NPC per-player, so the honest
options were to move their global spawns (changing their established homes) or to
make them findable. I chose findable: both now have entity-tracking markers and
map pins. The pacing cost is real and is a design call, not a bug.

A fully enclosed road-house *interior* is still a follow-up. It needs a Grove
terrain pass, which is the risky operation this pass deliberately avoided.

---

## Files changed

**New**
- `src/shared/harthmere/ch1_prop_seed.ts` — prop table, opening position
- `src/server/harthmere/ch1_prop_ecs_seed.ts` — create-only placeable seeder
- `src/shared/harthmere/ch1_map_landmarks.ts` — world-map pins
- `src/shared/harthmere/test/ch1_anchor_grounding.test.ts`
- `src/shared/harthmere/test/ch1_roadhouse.test.ts`
- `src/shared/harthmere/test/ch1_native_path_e2e.test.ts`

**Changed**
- `ch1_ids.ts` — 25 anchor heights, road-house + Ashline anchors, 2 NPC offsets
- `ch1_objective_targets.ts` — token matching, resolution order, grounded
  landmarks, alias table, step overrides
- `ch1_native_quests.ts` — `navigationAid` per leaf
- `ch1_quests.ts` — dungeon-quest and final-step lookups
- `ch1_live_story.ts` — testimonies, item requirements, `Ch1ObjectiveIncomplete`
- `ch1_dungeon_encounters.ts` — Marrow split, unkillable set
- `ch1_cast.ts`, `ch1_staging.ts` — Coretta, Calla Ashe
- `ch1_encounter_scheduler.ts` — single-writer lease
- `chapter1_progress.ts` — opening stage warp, display names, partial progress
- `chapter1_gate.ts` — entry guard, abandon exit, final-step gate, fallback warp
- `harthmere_chapter1_warp.ts` — `stage` action
- `npc.ts` — unkillable escorts
- `Chapter1NativeObjectivePrompt.tsx` — banner removed
- `pages/api/world_map/landmarks.ts` — Chapter 1 pins
- `server/shim/main.ts` — prop seeding + fingerprint
- `ch1_remaining_implementation.test.ts` — Marrow assertion corrected

## Verification

```
398 passing  Chapter 1 suites + cutscenes + progress API + client HUD/interaction
 54 passing  Grove / Bible / post-Gimme catalogues (unaffected by the changes)
```

Two pre-existing failures are unrelated and not from this pass:
`live_mode_api_persistence.test.ts` and `HarthmereEnemyHealthBarsHUD.test.ts`
both fail to load under `.mocharc.fast.json` because they need the global setup
in `.mocharc.json`, which itself throws `require is not defined in ES module
scope` at `src/server/test/global_setup.ts:33`. Worth fixing separately — it
means a slice of the server suite currently cannot run at all.

## Recommended before shipping

1. Boot the shim once and confirm the seven props appear (`chapter1Props: 7` in
   the seed log) and that the road-house reads as a place.
2. Walk the corrected anchors in-world — 25 changed, and the scan is stride-8, so
   spot-check Mosslawn, the bridge, the fence line and both gates.
3. Re-run the production grounding probe
   (`scripts/harthmere/probe-production-terrain-grounding.cjs`) so the live cast
   positions are repaired to match the corrected anchors.
