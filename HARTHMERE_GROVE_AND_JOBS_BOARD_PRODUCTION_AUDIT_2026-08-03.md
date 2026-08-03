# Grove Quests & Jobs Board — Production Readiness Audit

**Date:** 2026-08-03
**Scope:** the 51-quest Snapshot Grove onboarding catalog and the MMO Jobs Board
(`mmo_jobs_board_authority.ts`) plus its live-mode read/write path and client panel.

**Explicitly out of scope, per request:** Chapter 1 quests, the Road Ahead quest line,
and the Harthmere/Bible quest catalog. Those systems are referenced below only where a
Grove or Jobs Board code path reaches into them.

**Reference contracts applied:** `HARTHMERE_BIOMES_ECS_SOURCE_OF_TRUTH.md`,
`NATIVE_ECS_END_TO_END_TESTING.md`, `docs/docs/basics/gaia.md`,
`docs/docs/basics/anima.md`, `docs/harthmere/TESTING_FASTER.md`.

---

## Status

**Revision 2 (same day).** Three defects fixed and covered by regression tests. One
finding withdrawn. One correction to this document's own advice — see the box under GQ-2,
which is the most important paragraph here.

| ID | Severity | State |
| --- | --- | --- |
| JB-1 | Critical | **Fixed** — auto-seed is now a function of durable state |
| JB-2 | High | **Open** — product/economy decision, not a code defect |
| GQ-1 | High | **Fixed** — all marker surfaces resolve to Rosalyn |
| GQ-2 | Medium | **Fixed** — pins grounded on scanned terrain |
| P-1 | Process | **Fixed** — `t.sh jobs` preset added |
| P-2 / P-3 | Process | Open — noted, not scheduled here |

Both systems were *structurally* sound throughout: catalog data, native id pinning, gate
logic and template data all validated cleanly from the start. Every defect sat at a
**seam** — a validated data layer projected into a runtime reading a *different* source,
or a stateless read reconciled against a durable write. That is also why the pre-existing
suites were green. They were green and correct. They tested the layers, not the seams.

### Test evidence (this checkout, actually executed)

| Command | Before | After |
| --- | --- | --- |
| `t.sh grove` | 83 passing, 1s | **90 passing, 1s** |
| `t.sh grove:live` | 6 passing | 6 passing |
| `t.sh boards:e2e` | 128 passing | 128 passing |
| `t.sh jobs` (new preset) | *did not exist* | **200 passing, 6s** |
| `t.sh quests` | — | 198 passing, 1 pending |
| Combined Grove + jobs batch | 195 passing | **359 passing** |
| Scoped typecheck of changed shared modules + new tests | — | clean |

Each new test was verified to **fail against the pre-fix code**, not merely to pass
against the fixed code. The determinism suite reproduces the original 1959g→51g swap
exactly; the pin-wiring assertion fails the moment a raw `.position` is reintroduced,
while the pre-existing scan stays green beside it.

Seven unrelated failures exist in `progressionTabsNoDummy` / `InventoryTab` /
`BiomesHotbar` when those files are run outside their own preset. They are pre-existing
and untouched by this work — the map-pin one is a `deepEqual` key-presence mismatch
(`ownerQuestId: undefined` present vs absent) in `mapPinnedDestination.ts`, which this
change does not modify, and its `worldPosition` matches exactly.

**One self-inflicted problem, recorded because the lesson is reusable.** The new grounding
assertion was first added to `grove_waypoints_production_wiring.test.ts`. That imports the
~53k-line generated placement map, and the file already contained an I/O-bound scan of
every source file under `src/client` and `src/shared/harthmere` — a test that measured
1.6s against Mocha's 5s ceiling. Together they blew the ceiling and took `t.sh grove` from
1s to 7s with one red test that had nothing to do with either assertion. The grounding
check now lives in `grove_waypoint_grounding.test.ts`; the preset is back to 1s. This is
the same "don't put two heavy things in one lane" rule `TESTING_FASTER.md` already
documents for CPU-bound work — it applies to a heavy data import beside a filesystem walk
too.

### Typechecking — partially verified, and here is exactly how far

`./b test` does not typecheck (ts-node runs `transpileOnly` + swc), so green tests say
nothing about type correctness. That makes this worth stating precisely rather than
waving at.

| Target | Status |
| --- | --- |
| `mmo_jobs_board_authority.ts`, `snapshot_grove_trigger_contract.ts`, and all three new/changed shared test files | **typechecked clean** via an equivalent scoped project |
| `LocalDevSnapshotGroveBibleRuntime.tsx` + its validation test | **not statically typechecked** — see below |
| `t.sh types:grove` | did not complete in ~11 min |

The client file pulls the full client graph, and neither `t.sh types:grove` nor an
equivalent scoped project finished within ~8–11 minutes on this machine — a 4-core
emulated sandbox. The honest reading is "unverified in this environment", not "the lane is
broken"; **run `t.sh types:client` on real hardware before merging.**

What partially compensates: the changes to that file are narrow — one import, two new
functions, a parameter type narrowed from `Vec3` to `SnapshotGroveLandmark` on a
file-private function, and five call sites updated to match. All are exercised at runtime
by `LocalDevSnapshotGroveBibleRuntime.validation.test.ts`, which is in `t.sh quests` and
passes (198 passing). That proves the module loads and behaves; it does not prove type
correctness, and those are different claims.

---

## Findings

### JB-1 · CRITICAL · A job's identity is not stable between the board you read and the job you accept

**Files:** `src/pages/api/harthmere/live_mode_jobs_board_state.ts:67-93`,
`src/shared/harthmere/mmo_jobs_board_authority.ts:3554-3592` (`economyAutoSeedJobs`),
`src/shared/harthmere/live_mode_backend.ts:13793-13826` (accept-seed repair),
`src/client/components/harthmere_jobs_board/jobsBoardLiveAdapter.ts:838, 509, 1082`

The GET state endpoint runs `economy_auto_seed_jobs` in memory on every read and returns
the result without persisting it. That is *correct* per the ECS source-of-truth rule that
a GET must never write. But the seeded job list is not deterministic:

```ts
// mmo_jobs_board_authority.ts:3592
const rng = autoSeedRng((request.nowMs ^ boardSeed) >>> 0);
```

`nowMs` is `Date.now()` on the read path. Job ids, meanwhile, come from a durable counter
(`result.next.nextJobNumber++`), so the *same ids* are reissued with *different content*
on every poll.

Measured directly against `defaultHarthmereJobsBoardState`, two seeds 3.5 seconds apart —
one polling interval:

| jobId | Read at T | Read at T+3.5s |
| --- | --- | --- |
| `harthmere_auto_1` | Bounty: Elite Mucker — **1959g** | Run the Coop Food Parcel — **51g** |
| `harthmere_auto_2` | Run the Coop Food Parcel — 80g | Bounty: Elite Mucker — 1770g |
| `harthmere_auto_3` | Patch the Safe-Zone Fence — 64g | Patch the Safe-Zone Fence — **108g** |
| `harthmere_auto_4` | Escort a Newcomer — 59g | Escort a Newcomer — **81g** |

The client renders these into the "Available" tab and accepts **by `jobId` alone**.
`acceptJobPosting` (`:1446-1506`) validates board, status, deadline, self-issue, cooldown
and seeker cap — but never corroborates template, title, or reward against what the
player was shown.

The write path has a repair for the missing posting:

```ts
// live_mode_backend.ts:13793
if (operation === "accept_job" && requestedJobId && !next.jobsBoard.postings[requestedJobId]) {
  // re-seed the board, then accept
```

That repair re-seeds with the *writer's* `nowMs`, a different RNG stream from the read
that produced the list. So the repair reliably materializes a job at the requested id —
and reliably materializes **the wrong one**.

Player-visible symptom: accept a 1959g elite bounty, receive a 51g delivery. The reverse
is equally reachable and is a gold exploit rather than a disappointment.

**Why no test caught it:** every jobs-board test seeds and asserts inside one reducer
call with one `nowMs`. Nothing crosses the read→accept boundary with two clocks. The
browser E2E installs *exact fixtures* into the isolated Redis world
(`test-harthmere-native-ecs-roundtrip-e2e.cjs:9391`), so it never exercises the
non-deterministic seed either.

### JB-1 · FIXED

The auto-seed RNG is now a pure function of durable state — the board id and the
`nextJobNumber` about to be issued — in `economyAutoSeedJobs`. Three clock inputs were
removed:

| Was | Now |
| --- | --- |
| `autoSeedRng((request.nowMs ^ boardSeed) >>> 0)`, one stream per tick | one stream **per slot**, seeded from `boardSeed : nextJobNumber : attempts` |
| `rotateAutoSeedEntries({ nowMs })`, bucketed per second | `rotateAutoSeedEntries({ rotation: nextJobNumber })` |
| `economyAutoSeedProductionBusinessJobs` ordering seeded on `nowMs` | seeded on `nextJobNumber`; candidates were already sorted by `businessId` |

`autoSeedRotationBucket(nowMs)` is deleted, with a comment in its place so it is not
reintroduced. The board id stays in the seed, so the two physical boards still draw
independently.

**Variety is unaffected, and this was checked rather than assumed.** Variety now comes
from the board *moving* — jobs post, then complete or expire, and the counter advances —
which is what happens in production. Measured on a simulated live board: all six Exotic
Matter templates surface within 50 rounds, the Grove board yields 7 distinct templates,
`hunt_mucker_elite` rotates through 7 distinct coordinates and `npc_delivery_apples`
through 4 distinct pickups.

Four existing tests in `mmo_jobs_board_auto_seed.test.ts` failed after the change. They
were **not** papered over. Three re-seeded a *fresh* board while advancing only the clock —
a loop that, after this fix, asserts the bug rather than the feature. They now advance the
durable board through a `seedLiveBoardRounds` helper, which is a truer simulation of
production than the original loop. The fourth picked `Object.values(postings)[0]` and so
silently depended on draw order; when slot 0 became a monster hunt it could not complete,
because hunts close through the native kill ledger rather than field completion. It now
selects by what it actually exercises.

**Residual, accepted:** `createdAtMs` / `deadlineAtMs` still come from the caller's clock,
so a projected deadline can differ by seconds from the persisted one. That does not affect
job identity and is unavoidable while an unpersisted projection exists.

New coverage: `src/shared/harthmere/test/jobs_board_auto_seed_determinism.test.ts`
(5 cases — one poll apart, widely separated reads, read-projection vs durable write,
variety after the counter advances, and per-board independence).

---

### JB-2 · HIGH · 19 of 20 auto-seed templates mint gold from an issuer with no treasury

**File:** `src/shared/harthmere/mmo_jobs_board_authority.ts:3707-3717`, `:1872`

The auto-seed debits escrow only for `business` issuers:

```ts
if (template.issuerKind === "business") {
  const business = result.economy?.businesses?.[template.issuerId];
  if (!business || business.balanceGold < rewardGold) continue;
  business.balanceGold -= rewardGold;
}
```

The code is candid about the rest:

> Town/guild/NPC issuers have no real treasury yet … so we accept the pre-committed
> escrow as a sanctioned faucet for current.

Measured issuer distribution across `HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES`:

| Issuer kind | Templates | Backed by a treasury? |
| --- | --- | --- |
| guild | 9 | No |
| town | 7 | No |
| npc | 3 | No |
| business | 1 | Yes |

On completion the seeker is credited unconditionally
(`completeJobPosting`, `:1872 result.goldDelta += job.escrowGold`).

Reward ceilings on the unbacked templates:

| Template | Issuer | Max reward |
| --- | --- | --- |
| `exotic_matter_mine_antihydrogen` / `antihelium` / `antiboron` (+3 deep variants) | guild | **5000g** each |
| `hunt_hex_boss` | guild | 4500g |
| `hunt_mucker_alpha` | town | 3600g |
| `hunt_mucker_elite` | town | 2400g |

5000g is `HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD` — the system ceiling. With four slots
refilled per tick and no sink, this is an uncapped inflation source.

This is a known, documented gap rather than an accident. It is listed here because
"documented" and "shippable" are different bars, and the ceilings are at the maximum the
system permits rather than at a tuned value.

**Suggested direction:** either wire town/guild treasuries before launch, or cap unbacked
issuers to a much lower reward band and rate-limit them per actor per day.

---

### GQ-1 · HIGH · Rosalyn offers four fountain lessons; the map sends the player to Jackie

**Files:** `src/shared/harthmere/snapshot_grove_content.ts:1663-1687` (and three siblings),
`src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx:719-720, 2968`

Grove quests have two live data sources. The new catalog
(`grove/grove_quests_fountain.ts`) is the reviewed one. The retired
`SNAPSHOT_GROVE_QUESTS` array is still the one the runtime renders markers from.

The Jackie→Rosalyn reassignment updated the catalog only. Measured drift:

| Quest | `SNAPSHOT_GROVE_QUESTS.giverNpcId` | catalog `start.giverNpcId` |
| --- | --- | --- |
| `fountain_buttons_first` | jackie | **rosalyn** |
| `tools_before_treasure` | jackie | **rosalyn** |
| `fountain_hotbar_and_dropping` | jackie | **rosalyn** |
| `fountain_first_recipe_torch` | jackie | **rosalyn** |

Plus eight `markerId` mismatches — the **opening** and **closing** objective of each of
those four quests still names `npc_jackie` in the snapshot table.

The runtime is split down the middle. The *giver* is read from the catalog, deliberately:

```ts
// :719-720
function snapshotGroveQuestGiverId(quest: SnapshotGroveQuest): string {
  return groveQuest(quest.id)?.start.giverNpcId ?? quest.giverNpcId;
}
```

but the *markers* are read from the snapshot table:

```ts
// :2968
{quest.markerIds.map((markerId, stepIndex) => {
```

Net effect on the first four lessons of the game: Rosalyn offers the quest, the "All
marked stops" list and step pins point at Jackie, and the final "return to your teacher"
objective points at the wrong NPC.

**Why no test caught it:** `grove_engine_contracts.ts` has a rule written for exactly this
failure — ANIMA RULE 2b, `groveValidateTalkStepsPointAtTheirGiver`, whose comment reads
*"a reassignment that updates `start.giverNpcId` and leaves the marker behind produces a
quest one NPC offers while the map arrow sends the player to a different one."* The rule
is correct. It reads `GROVE_QUEST_CATALOG`, which was retargeted. It cannot see the
snapshot table, which was not. `grove_giver_reassignment.test.ts:136-150` asserts the
catalog no longer mentions Jackie — and the catalog does not.

### GQ-1 · FIXED — and the retired array was not touched

The requirement is that those four lessons belong to Rosalyn **only**: she offers them and
every marker surface points at her. The constraint is that `SNAPSHOT_GROVE_QUESTS` — which
carries the original snapshot content — must not be edited.

Both hold. The retarget lives in the resolver the runtime already calls,
`snapshotGroveObjectiveTargetMarkerIds`, which now prefers the catalog's step marker. The
authored array is unchanged, so this cannot reach the four protected snapshot quest trees
(Road Ahead, Busted, Get the Muck Out, Muck vs. Machine) — those are Bikkie biscuits with
their own ids that the Grove catalog cannot express at all, and their pinned-id assertions
still pass.

The retarget is deliberately **conditional**: it fires only when the caller's marker equals
the shipped row. Map-adapter fixtures legitimately pass a quest with custom markers, and an
earlier version of this resolver delegated wholesale and silently moved one objective's
marker onto another's. Comparing against the shipped row keeps both properties.

One surface did not go through that resolver — the "All marked stops" list read
`quest.markerIds` directly — so it now goes through `snapshotGroveQuestStepMarkerIds`.

Measured after the change: all 8 Jackie markers on the four lessons resolve to
`npc_rosalyn`; zero Jackie references remain on those quests through any surface; zero
drift on the other 47 quests; every resolved marker still maps to a real landmark.

**The fix reached completion logic, not just display — and that surfaced a stale test.**
`LocalDevSnapshotGroveBibleRuntime.validation.test.ts` builds its `talk_npc` fixture from
`quest.markerIds[objectiveIndex]` raw, so it was constructing a "talk to Jackie" event.
That audit would have gone green precisely when the player was being sent to the wrong
NPC. The fixture now resolves the marker the same way the runtime does, which is what the
player actually experiences.

New coverage in `grove_giver_reassignment.test.ts`: four cases asserting the property
through the resolver starting from the retired row, that other quests are untouched, that
caller-supplied markers are honoured, and that every resolved marker exists.

---

### GQ-2 · MEDIUM · Two map-pin call sites bypass the Y-datum resolver; 13 quest steps are exposed

**File:** `src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx:2985, 3089`

The Grove landmark table mixes two vertical datums — 83 landmarks at the live marker
height and 25 at the retired authored height. `groveLandmarkWorldPosition` exists to lift
stranded Grove-area landmarks; `snapshot_grove_content.ts` records the incident it
prevents (*"the player at y=70.5 while seeded Grove NPCs were still at y=53, leaving the
mission cast buried under the courtyard"*).

Four of six `pinSnapshotGroveLandmark` call sites in this file resolve correctly:

| Line | Argument | Resolved? |
| --- | --- | --- |
| 931 | `groveLandmarkWorldPosition(activeMarker)` | yes |
| 2438 | `groveLandmarkWorldPosition(marker)` | yes |
| **2985** | `stepMarker.position` | **no** |
| **3089** | `marker.position` | **no** |

Line 2985 is the "All marked stops" step list; line 3089 is the "Pin \<marker\>" button.
Both are player-facing.

15 landmarks are currently stranded, and **13 quest steps across 11 economy quests point
at one**:

`econ_billys_lost_lunch_pail`, `econ_billys_roof_patch_run`,
`econ_gus_fresh_loaves_to_fountain`, `econ_gus_grain_run`,
`econ_fern_water_the_sprout_beds` (×2), `econ_fern_berry_patch_harvest` (×2),
`econ_kit_heavy_parcel_to_crossroads`, `econ_mel_bench_repair`,
`econ_mel_broken_hinge_hunt`, `econ_rin_mushroom_pickup`, `econ_carlo_festival_skewers`

Every one of those pins lands ~17 blocks underground.

**Why no test caught it:** `grove_waypoints_production_wiring.test.ts` scans for the
literal token `landmark.position` and requires the file to import
`SNAPSHOT_GROVE_LANDMARKS`. The test is explicit that this is *"a lint-grade heuristic,
not dataflow analysis"* and that it was deliberately narrowed to `landmark.` to avoid
three false positives. The two live bypasses are named `marker` and `stepMarker`, so the
heuristic passes them — and
`GROVE_UNWIRED_LANDMARK_POSITION_READERS` is currently `[]` with the comment
*"All six are now wired."* That declaration is what is wrong; the sweep is honest about
its own limits.

### GQ-2 · CORRECTION — the remedy first proposed in this document was wrong

> **Revision 1 of this file said: "two-line fix at both call sites", meaning call
> `groveLandmarkWorldPosition`. That would have been a bug, not a fix.**
>
> `groveLandmarkWorldPosition` lifts a landmark out of the retired Y=54 datum onto
> **one flat plane** (`SNAPSHOT_GROVE_LIVE_MARKER_Y` = 71). That plane is only true at the
> fountain plaza. The Grove is hilly, and
> `docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md` names this exact mistake
> under "Do Not Do This": *"do not fix one bad item by adding a magic `+1`, `-17`, `y=54`,
> or `y=70`"*. `ch1_objective_targets.ts` had already been burned by it — Chapter 1
> objectives pointed 21 blocks into the air at Mosslawn and 9 blocks underground at the
> fence line.
>
> Measured against the checked-in placement map: **79 of 108** Grove landmarks have a
> scanned record, and the flat plane disagrees with most of them. Ranger Jane's post is at
> **49** — 22 blocks below the plane. Sil 49, Old Coop 59, Luis's cart 64, Mel's workbench
> 64, Alexis 74, Rin's basket 73.
>
> So the original advice would have replaced a 17-block error with an error of up to 22 —
> and applied it to every landmark those buttons pin, not just the 13 stranded steps.

**The real scope was also larger than revision 1 reported.** It is not "13 quest steps".
Those two call sites never resolved *any* pin, and for non-stranded landmarks the raw
authored value is the same flat 71. Every pin from the "All marked stops" list and the
"Pin \<marker\>" button was ungrounded.

**What was actually done.** `pinSnapshotGroveLandmark` now takes a
`SnapshotGroveLandmark` instead of a `Vec3`, and resolves internally:

```ts
resolveHarthmereProductionMarkerPosition({
  markerId: landmark.id,
  fallback: groveLandmarkWorldPosition(landmark),
})
```

Both steps matter. The lift handles the retired datum; the placement map replaces the
plane with scanned terrain; the lifted value is the *fallback* for the 29 landmarks the
scan does not cover. This is the composition the sanctioned BiomesUI bridge
(`activeBiomesUIMapPinFromMarkerForTest`) already used, so the HUD nav aid and the map pin
for the same marker now agree — which the placement-map doc requires and which they did
**not** do before, even at the two call sites that were "correct".

Narrowing the parameter to a landmark makes the whole bug class unrepresentable: there is
no longer a way to hand that function an unresolved coordinate.

**No marker offset is added.** `ch1_objective_targets.ts` adds `+1` because it places a 3D
prop above the scanned feet-Y. This is a navigation aid, and the BiomesUI map pin consumes
`recommendedPosition` unmodified; adding an offset here would put the HUD and the map one
block apart for the same landmark.

**The wiring scan was widened, and its blind spot named.** The existing check matches the
literal token `landmark.position` — it says so, and was deliberately narrowed to avoid
false positives. The two bypasses were called `marker` and `stepMarker`, so it could not
see them while `GROVE_UNWIRED_LANDMARK_POSITION_READERS` read `[]` with the comment "All
six are now wired." Two new assertions check what reaches the pin rather than one spelling
of one variable, plus a data assertion that the scan is genuinely consulted (≥50 landmarks
resolved, ≥30 disagreeing with the plane, worst delta ≥15 blocks) so a silently
disconnected placement map fails loudly.

---

## Process gaps (not defects, but they are why the above shipped)

**P-1 · The entire Jobs Board is absent from every `t.sh` preset.**
`t.sh boards` covers the four *snapshot request boards* — a different system
(`native_request_boards.ts`). The 21 jobs-board test files
(`mmo_jobs_board_*`, `jobs_board_*`, `harthmere_job_objective`, the client
`harthmere_jobs_board/__tests__` set, the state API test) are in no preset and run only
under `t.sh full`. I ran them manually: 195 passing in ~7s under the fast config.

**FIXED.** `t.sh jobs` now exists (200 passing, ~7s), with a header comment explaining
that it is a different system from `boards` and that it must be run after any change to
the auto-seed path.

**P-2 · The 51-quest Grove E2E does not walk intermediate objectives.**
`snapshot_grove_live_mode_backend.test.ts:325-421` is the "all 51 quests" walk. It accepts
the quest, then force-writes the final state:

```ts
state.quests.active[quest.id] = { ...,  progress: quest.objectives.length };
```

before asserting completion. The test is honest about this — *"Trigger-contract and
runtime suites exercise every intermediate leaf"* — but the effect is that **no automated
tier walks a Grove quest objective-by-objective**. Of 255 authored steps, the accept and
final steps are covered; the middle is covered only by trigger-shape unit tests and the
browser run. It is also `it.skip` unless `HARTHMERE_GROVE_CATALOG_E2E=1`, so `t.sh grove`
does not include it.

**P-3 · Grove quest state is still dual-authority, and the contract says so.**
`GROVE_NON_ECS_OWNED` correctly declares that `acceptedQuestIds`, `completedQuestIds` and
`completedObjectiveIds` still live in live-mode Redis and cloud save alongside native
`Challenges`/`TriggerState`. `GROVE_NON_ECS_TARGET` is `[]`. This is the outstanding
migration and the root enabler of GQ-1: with one authority, a giver reassignment could not
half-apply. Worth naming as the strategic fix behind the tactical ones.

---

## What is clean

Recorded so the next reader does not re-audit it.

- **Grove catalog data.** `groveValidateEngineContracts()` returns `[]`. 51 quests, 255
  steps, 13 fountain lessons. Every step has a pinned native challenge and step id, every
  step index matches its array position, every marker resolves to a landmark, no waypoint
  has Y=0, no quest data carries a forbidden ECS-move key, no quest claims one of the four
  protected snapshot quest ids.
- **Grove rewards.** All 51 quests have a `SNAPSHOT_STRUCTURED_REWARDS` entry, no entry is
  orphaned, no quest has a zero reward, and every authored prose reward string agrees with
  its structured XP and bling values. Rewards are granted exactly once via an idempotent
  economy-ledger key and materialize a native `inventory_exchange` plan.
- **Grove givers.** All 21 givers resolve through
  `HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST`, all are seeded Grove NPCs with
  `seedServerNpc: true`, and none required relocating a shared NPC (ANIMA RULE 2).
- **Grove and Gaia.** Grove quests do not simulate terrain, farming, or growth. No Gaia
  interaction to audit beyond the Y-datum issue in GQ-2.
- **The "practice action" affordance is correctly narrow.** The trigger contract lists
  `snapshot_grove_practice_action` as satisfying 17 of 20 trigger kinds, which looks like a
  universal objective-skip button. It is not: the UI gates the button to
  `SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET`, which contains only `choice`.
  I checked this specifically because it would have been severe.
- **Jobs Board template data.** All 19 business templates have executable requirement
  items, resolving field targets and resolving map markers. All 20 auto-seed templates have
  resolving markers. 38 field targets, all positioned.
- **The read endpoint respects the GET-is-read-only rule.** Despite JB-1, the endpoint does
  not persist, does not tick stamina, and does not adopt identity
  (`allowIdentityWrites: false`). The bug is non-determinism, not an illegal write.
- **Bounty kills are recorded server-side** in the native NPC handler
  (`src/server/logic/events/handlers/npc.ts:668`), not client-asserted.

---

## What remains

**JB-2 is the only launch-blocking item left, and it is a decision rather than a bug.**
19 of 20 auto-seed templates issue from town/guild/npc, none of which has a treasury, with
ceilings at the 5000g system maximum. Either wire those treasuries, or cap unbacked
issuers to a much lower band and rate-limit them per actor per day. The code already names
this as a "sanctioned faucet"; what is missing is a deliberate call on whether that is
acceptable at launch.

**P-2** — no automated tier walks a Grove quest objective-by-objective. The 51-quest E2E
force-writes past the middle of every quest. Of 255 authored steps, accept and final are
covered; the rest rests on trigger-shape unit tests and the browser run.

**P-3** — Grove quest state is still dual-authority. `GROVE_NON_ECS_OWNED` honestly
declares that `acceptedQuestIds` / `completedQuestIds` / `completedObjectiveIds` still live
in live-mode Redis and cloud save beside native `Challenges`. This is the strategic fix
behind GQ-1: with one authority, a giver reassignment could not half-apply, and the
conditional retarget added here would be unnecessary.

---

## Files changed

| File | Change |
| --- | --- |
| `src/shared/harthmere/mmo_jobs_board_authority.ts` | JB-1: durable-state seeding; `autoSeedRotationBucket` removed |
| `src/shared/harthmere/snapshot_grove_trigger_contract.ts` | GQ-1: conditional catalog marker retarget |
| `src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx` | GQ-2: pin helper takes a landmark and grounds it; GQ-1: marked-stops list |
| `src/shared/harthmere/test/jobs_board_auto_seed_determinism.test.ts` | New — 5 cases |
| `src/shared/harthmere/test/grove_giver_reassignment.test.ts` | +4 cases |
| `src/shared/harthmere/test/grove_waypoints_production_wiring.test.ts` | +1 case (pin-argument invariant) |
| `src/shared/harthmere/test/grove_waypoint_grounding.test.ts` | New — 2 cases; separate file so the heavy placement-map import does not share a lane with the filesystem scan |
| `src/shared/harthmere/test/mmo_jobs_board_auto_seed.test.ts` | 4 tests re-based on durable advancement |
| `src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.validation.test.ts` | Fixture resolves the marker instead of reading the retired row |
| `scripts/harthmere/t.sh` | New `jobs` preset |

`SNAPSHOT_GROVE_QUESTS` and the four protected snapshot quest trees are unmodified.

---

## Method note

Findings were derived by loading the real modules under `.mocharc.fast.json` and printing
actual catalog, reward, landmark, template and seed data — not by reading source alone.
The JB-1 table is measured output from two `economyAutoSeedJobs` calls against the same
starting state; the GQ-2 elevation figures are measured against the checked-in production
placement map. Every new assertion was run against the pre-fix code to confirm it fails
there. Temporary probe files were removed.

**Revision 1 of this document recommended the wrong fix for GQ-2** — a flat-plane lift that
the placement-map doc explicitly forbids, and which would have introduced a larger error
than the one it removed. The correction is boxed under GQ-2. The lesson generalises: on the
original map, a landmark's Y is a *scanned* property, never a constant.
