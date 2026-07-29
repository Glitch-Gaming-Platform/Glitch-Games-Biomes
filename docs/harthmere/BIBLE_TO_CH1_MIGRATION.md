# Bible Quests → Chapter 1 Structure

Migration design. Converts the 85-quest Bellbound Dragon catalog from an
authored-JSON + Redis-state-machine system into the Chapter 1 shape: typed TS
data, derived ids, native ECS as the progress authority, and a residual
non-ECS slice for the four things ECS has no model for.

Status: design + core + proving slice. Bulk conversion of the remaining
side/starter rows is phase 3 (§10).

---

## 1. Why

The two systems solve the same problem twice and disagree about who is in
charge.

| | Bible (today) | Chapter 1 (today) |
| --- | --- | --- |
| Source | 25k-line JSON string in a `.ts` file | typed TS objects |
| Ids | hand-maintained manifest, throws at boot if an entry is missing | derived from frozen array order |
| Progress authority | Redis (`quest_runtime.ts` state machine) | native `Challenges` + `TriggerState` |
| ECS role | mirror, written directly by the live-mode reducer | authority, advanced by the trigger engine |
| Reward idempotency | explicit `grantedRewardIds` ledger | idempotent by construction |
| Unlock | `prerequisiteQuestIds` evaluated in Redis | `challengeComplete` trigger nodes |
| Engine rules | prose comments | `ch1_engine_contracts.ts`, machine-checked |
| Fast tests | none — every suite pulls the whole catalog | 196 tests, 4.15 s, bootstrap-free |

The dual authority is not theoretical. `native_ecs_drop_materialization.ts`
writes `Challenges` and `TriggerState` from the reducer's approved result,
bypassing both the signed `HarthmereQuestProgressEvent` path and the trigger
engine. Chapter 1 goes through `chapter1_progress.ts`, which mints an HS512
token and lets `harthmere_quest_progress.ts` re-validate signature, in-progress
membership, and step membership before anything advances.

Two write paths into the same two components is the failure mode this repo has
hit repeatedly (see the live-mode write/read actor mismatch and the Redis
`WATCH` shared-connection incidents). This migration removes one of them.

---

## 2. Catalog inventory (measured, not estimated)

```
quests                     85
objectives                340   (max 4 per quest)
categories                 main(13) side side_hidden starter(9) repeatable(21)
hidden or giver-less        7
prerequisites              13 quests, ALL single-prerequisite (no multi-prereq DAG)
time-of-day gated           9
weather gated               2
requiredFlags               0    (schema supports it; nothing uses it)
expiresWhen                 0    (schema supports it; nothing uses it)
objective types             4    talk | inspect | choice | combat
failure cases               3    player_too_far | wrong_phase | duplicate_submission
repeatability              once | daily(16) | weekly(5)
start triggers             speak_to_giver | well_mentions_nessa | auto_after_q7/8/9
                           | boss_encounter_start | world_trigger
objective waypoints with Y=0    312 of 340
```

Two of these numbers decide the design.

**All 13 prerequisites are single.** The unlock graph is a forest of chains,
not a DAG. Chapter 1's `challengeComplete` unlock node expresses it exactly —
we only need to generalise "previous quest in the array" into "the named
prerequisite quest".

**312 of 340 waypoints are `Y=0`.** `TESTING_FASTER` §4.12 already documents
the consequence: the browser writes the authored zero after the teleport hook
returned a safe pose, the player lands under terrain, and every affected row
burns a three-minute movement timeout. Grounding waypoints at build time and
asserting it in a 1-second unit test is the single largest E2E speed win in
this migration, worth more than every other optimisation combined.

---

## 3. Target architecture

```
src/shared/harthmere/bible/
  bible_quest_schema.ts        types + narrow unions (no data)
  bible_quest_ids.ts           derived ids + frozen legacy pin table
  bible_quests_main.ts         Q1–Q12 + Q2.5                    (13)
  bible_quests_side.ts         SQ-001…042 incl. side_hidden     (42)
  bible_quests_starter.ts      starter_*                         (9)
  bible_quests_repeatable.ts   daily + weekly families          (21)
  bible_quest_catalog.ts       assembles, freezes order, indexes
  bible_quest_gate.ts          pure activation gate
  bible_native_quests.ts       Biscuit projection (seq + unlock)
  bible_live_slice.ts          residual non-ECS slice
  bible_engine_contracts.ts    ECS / Gaia / Anima rules, machine-checked
  bible_waypoints.ts           grounded waypoint resolution
```

Everything is pure data or pure functions. No module imports Bikkie item data,
the ECS gen layer, a server handler, the trigger engine, or a renderer asset —
so the whole surface runs under `.mocharc.fast.json` with no bootstrap. `Biscuit`
and `BiomesId` are imported `import type` only, which erases at compile time.
This is the same discipline that gets Chapter 1's 196 tests to 4.15 s.

### Why split per arc

A test that only touches the main arc imports `bible_quests_main.ts` (13
quests) instead of the whole 85. `t.sh bible:main` therefore parses ~15% of the
catalog. The single-file alternative makes every slice pay for all 85 rows on
every run, which is precisely the "server bootstrap tax" that
`TESTING_FASTER` §1.1 measured at 4.2×.

---

## 4. Data model

```ts
export interface BibleQuestDef {
  id: string;
  code: string;                    // "Q1", "SQ-014", "" for starters/repeatables
  title: string;
  category: BibleQuestCategory;    // main | side | side_hidden | starter | repeatable
  arc: BibleQuestArc;              // derived module owner, used for test slicing
  giverId?: string;                // absent => hidden/world-trigger
  giverName?: string;
  hidden: boolean;
  district: string;
  authoredWaypoint: Vec3;          // authored space, Y may be 0 — never shipped raw
  levelBand: { min: number; max: number };
  estimatedMinutes: number;
  contentType: string;
  repeatability: BibleQuestRepeatability;   // once | daily | weekly
  phase: string;
  premise: string;
  bibleRef: string;
  bellTie: boolean;
  start: BibleQuestStart;          // see §5
  gate: BibleQuestGateRules;       // see §6
  steps: readonly BibleQuestStep[];
  choices?: readonly BibleQuestChoice[];
  rewards: BibleQuestRewards;
  dialogue: BibleQuestDialogue;    // offer | active | ready | complete | fail
  note?: string;                   // writer-facing, never shipped
}

export interface BibleQuestStep {
  id: string;
  label: string;
  type: BibleStepType;             // talk | inspect | choice | combat
  targetId: string;
  targetName: string;
  district: string;
  authoredWaypoint: Vec3;
  count: number;
  validation: BibleStepValidation; // serverAuthority, maxDistance, LoS, idempotent
  failureCases: readonly BibleStepFailure[];
}
```

Deliberate changes from the JSON:

- `objectives` → `steps`, matching `Ch1QuestDef.steps`, so one mental model.
- `activeRules` is split. The parts ECS expresses (`prerequisiteQuestIds`,
  `initialState`, `startTrigger`) move into `start`; the parts it cannot
  (`levelBand`, `timeOfDay`, `activeHours`, `weather`) move into `gate`.
- `activationTestCases`, `testContract.useCases/edgeCases`, and
  `activeDuringStates` are **dropped from the shipped data**. They are prose
  restatements of assertions; the migration turns them into real tests (§8).
  Losing them from the runtime bundle removes roughly a third of the catalog's
  bytes.
- `location.waypoint` becomes `authoredWaypoint`, and is never read directly by
  runtime code — only through `bible_waypoints.ts` (§7).
- `bibleRef` and `note` are retained: `bibleRef` is the traceability link the
  implementation audit consumes.

---

## 5. Start and unlock model

`bibleUnlockTrigger` today has three behaviours. The new model keeps all three
and names them:

```ts
export type BibleQuestStart =
  | { kind: "giver"; giverId: string }                    // 71 quests
  | { kind: "after"; questId: string }                    // 11 quests
  | { kind: "world_trigger"; discoveryId: string };       //  3 quests
```

Projection to native `unlock`:

| start | unlock trigger | rationale |
| --- | --- | --- |
| `giver`, no prerequisite | `undefined` | quest is available; the NPC offers it |
| `giver` + prerequisite | `challengeComplete(prereq)` | ordinary chain |
| `after` | `challengeComplete(prereq)` | auto-starting story beat |
| `world_trigger` | circular `challengeUnlocked(self)` | see below |

The circular self-gate is retained from the current implementation and it is
the correct answer, not a hack. A giver-less quest with no prerequisite would
otherwise enter `in_progress` the moment the player logs in, because the global
native challenge runner auto-starts any quest whose unlock is satisfied. A
trigger that can only be satisfied by a `challengeUnlocked` event naming the
quest itself means: *nothing but an explicit server-owned discovery publish can
start this.* The three `side_hidden` quests
(`the_buried_bell`, `the_doorway_that_wasnt`, `the_singing_in_the_walls`) use
it, and a discovery bridge publishes that evidence when the authored location
condition is met.

`well_mentions_nessa`, `auto_after_q7/8/9`, and `boss_encounter_start` all
carry a real single prerequisite in the authored data, so they collapse into
`after` without losing information. The *flavour* of the start (a well
mentioning Nessa vs. a boss encounter) is presentation, and moves into
`dialogue.offer` where it already exists.

---

## 6. The gate: what replaces the state machine

`quest_runtime.ts`'s seven-state machine
(`locked/available/active/ready_to_complete/completed/failed/abandoned`) is
deleted. Native `Challenges` already carries the state:

| quest_runtime state | native equivalent |
| --- | --- |
| `locked` | not in `available`, unlock trigger unsatisfied |
| `available` | in `challenges.available` |
| `active` | in `challenges.in_progress` |
| `ready_to_complete` | all step ids present in `trigger_state.by_root[challengeId]` |
| `completed` | in `challenges.complete` |
| `abandoned` | removed from `in_progress` (native abandon) |
| `failed` | **see §9.3 — deliberately not modelled** |

What native `Challenges` cannot express is the soft, re-evaluated-every-tick
conditions. Those become one pure function:

```ts
export function bibleQuestGate(
  quest: BibleQuestDef,
  context: BibleGateContext
): BibleGateResult   // { ok, reasons: BibleGateReason[] }
```

`BibleGateReason` is a closed union — `player_level_below_minimum`,
`player_far_above_soft_maximum`, `wrong_time_of_day`, `wrong_hour`,
`wrong_weather`, `missing_prerequisite`, `cadence_cooldown`,
`already_completed_once` — so a new reason is a compile error at every call
site instead of a silently unhandled string.

The gate has exactly three callers: NPC dialogue offer building, the accept
route, and the world-trigger discovery bridge. It never mutates. It is called
with a context, not a clock, so every branch is unit-testable without faking
time.

### The cadence bug this fixes

`repeatability: "daily" | "weekly"` is authored on 21 quests and **enforced
nowhere**. `acceptHarthmereQuest` only blocks re-accept when repeatability is
`once`; there is no cooldown check anywhere in `quest_runtime.ts` or
`bible_quest_live_authority.ts`. A player can complete a daily an unbounded
number of times per day and collect the reward each time, because
`completeHarthmereQuest` deliberately keys the grant id per cycle so repeatables
*can* re-grant.

The gate closes it: `cadence_cooldown` compares `bible.cadence[questId]`
against the quest's cadence window. This is a real economy fix, not a
refactor artifact.

---

## 7. Waypoints and Gaia

312 of 340 authored waypoints have `Y=0`. Runtime code must never see them.

```ts
// bible_waypoints.ts
export function bibleGroundedWorldWaypoint(
  authored: Vec3,
  purpose: HarthmereProductionPlacementPurpose
): Vec3
```

Resolution order, each step already existing in the codebase:

1. `resolveHarthmereQuestObjectivePlacement` — the generated production
   placement map, which knows the real surface column.
2. `shiftHarthmereAuthoredPositionToWorld` — authored → world additive shift.
3. `HARTHMERE_EXTENSION_FEET_Y` — the flat additive-terrain feet height.

A contract test asserts **no shipped marker, map hint, objective validation, or
E2E fixture ever carries `Y=0`**. That single assertion removes the failure
mode §4.12 of `TESTING_FASTER` describes, where each affected row cost a
three-minute movement timeout. 312 rows × 3 minutes is the budget being
reclaimed.

### Gaia rules (`bible_engine_contracts.ts`)

- **GAIA RULE 1 — Bible quests do not simulate terrain.** No quest edits
  voxels, triggers growth/decay, or advances the world clock. `timeOfDay` in
  `gate` is a *read* of the world clock for activation, never a write. The
  9 time-gated and 2 weather-gated quests observe Gaia; they never drive it.
- **GAIA RULE 2 — every waypoint is grounded through the placement map.**
  Authored `Y` is an authoring convenience and is not shipped. Enforced by the
  test above.
- **GAIA RULE 3 — no quest may place a prop that violates the vegetation
  contract.** Anything generated near a quest site must satisfy the
  six-connected DFS + soil rules or it silently decays minutes after load.

---

## 8. Anima rules

- **ANIMA RULE 1 — givers resolve by id, never by display name.** The current
  client adapter matches a rendered NPC's label against a lowercased compendium
  name. A renamed or suffixed label silently orphans a giver. The new
  projection resolves `giverId` through
  `HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST` and fails a contract test if a giver
  is unresolvable. This is the same class of bug the current code already
  documents in `harthmereBibleQuestsByGiver` — 13 of 21 givers were orphaned by
  a hand-written link table.
- **ANIMA RULE 2 — Thaedryn is the only Bible combat entity.** One canonical
  anchor (`640, HARTHMERE_EXTENSION_FEET_Y, -268`), one entity id
  (`8810000000019120`), exposed as a live-mode combat snapshot so the proven
  native attack path hits it. The three conflicting authored Wyrm's Bed
  locations stay collapsed to that anchor, and the Q12 objective waypoint
  override stays, so `player_too_far` can never be caused by authored
  disagreement.
- **ANIMA RULE 3 — quest givers are never encounter targets.** A `combat`
  step may not name an NPC that any quest lists as a `giverId`. Machine-checked.
- **ANIMA RULE 4 — quest state never moves an NPC.** Bible progress is
  per-player; the NPC set is shared. Nothing in the catalog may carry
  `publish`, `ecsMove`, or `entityUpdate`. Mirrors Chapter 1's staging rule.
- **ANIMA RULE 5 — boss phase is presentation-adjacent state, not ECS.**
  Thaedryn's phase machine stays in the residual slice (§9), because a boss
  phase is per-player encounter progress and the shared entity has no
  per-player component.

---

## 9. What stays outside ECS

Mirroring `CH1_NON_ECS_OWNED`, the residual slice is explicitly enumerated and
contract-tested so it cannot quietly grow back into a second state machine.

```ts
export const BIBLE_NATIVE_ECS_OWNED = [
  "quest availability, progress, and completion",   // Challenges
  "objective step completion",                      // TriggerState.by_root
  "xp, level, and derived stats",                   // native quest xp award
  "item and silver reward grants",                  // signed inventory txn
  "quest giver entities and transforms",
];

export const BIBLE_NON_ECS_OWNED = [
  "faction reputation",         // no ECS component exists
  "daily/weekly cadence stamps",// completion time per repeatable
  "branch choices",             // chosenPath, per-player narrative
  "story flags from rewards.unlocks",
  "titles",
  "thaedryn boss phase",
];
```

### 9.1 The reward ledger disappears

`grantedRewardIds` exists because Redis writes are not idempotent. Native step
completion is: `TriggerState.by_root` records the step id once, so a re-submit
sets a value that is already set and the completion branch does not re-fire.
This is the same property the native quest XP award relies on — idempotent by
construction, no ledger. Deleting `grantedRewardIds` removes a whole class of
double-grant bug and a per-player unbounded array.

### 9.2 Migration of live player state

Ids do not move. `bible_quest_ids.ts` ships a frozen pin table mapping every
`questId` to its existing `HARTHMERE_NATIVE_QUEST_ID_MANIFEST` id
(`8760000000000051`+). Derived ids are used only for quests with no pin — i.e.
none today, and any quest added later.

A one-time reader folds existing Redis `bible.runtime` records into native
`Challenges`/`TriggerState` on first load:

- `state: "completed"` → `challenges.complete.add(id)`
- `state: "active"` → `in_progress`, plus one `by_root` entry per objective
  whose `objectiveProgress[objId].completed` is true
- `state: "failed" | "abandoned"` → dropped to `available` (both are
  re-acceptable today, so this loses nothing a player can observe)
- `grantedRewardIds` → discarded; a completed challenge already means granted
- `flags`, `titles`, `completedAtMs`, `thaedryn`, `townPhase` → carried into the
  residual slice unchanged

The reader is idempotent and runs behind a `bibleMigratedVersion` stamp.

### 9.3 `failed` is deliberately not modelled

`quest_runtime.ts` has `failHarthmereQuest`, `failureReason`, and a `fail`
dialogue state. Nothing in the authored catalog sets `expiresWhen`, no
objective declares a failure transition, and the only authored `failureCases`
(`player_too_far`, `wrong_phase`, `duplicate_submission`) are *rejected
submissions*, not quest failures — they are already handled by returning a
reason from validation.

So `failed` is a state no authored quest can enter. It is dropped. The `fail`
dialogue string is retained in the data (it is written content and costs
nothing) but is unreachable until a quest actually authors a failure condition,
at which point the gate gains one reason and the biscuit gains one branch. A
contract test asserts no quest authors a failure transition while the state is
unmodelled, so this cannot rot silently.

---

## 10. Test strategy

The governing rule from `TESTING_FASTER` §5: **push verification down**. Every
check below is placed at the cheapest tier that can actually catch the bug.

### Tier 1 — fast unit (`.mocharc.fast.json`, no bootstrap, target < 2 s)

| Suite | Catches |
| --- | --- |
| `bible_quest_schema.test.ts` | malformed rows, missing dialogue states, empty steps, duplicate ids, unknown category/type/failure enum |
| `bible_quest_ids.test.ts` | id drift, pin-table gaps, step-block overflow, collision with Ch1/Grove id bands |
| `bible_native_quests.test.ts` | projection shape, one leaf per step, unlock kind per start kind, giver resolution |
| `bible_quest_gate.test.ts` | the full gate matrix incl. cadence, per reason |
| `bible_waypoints.test.ts` | **no shipped `Y=0`**, placement-map coverage, Q12 anchor agreement |
| `bible_engine_contracts.test.ts` | every ECS/Gaia/Anima rule in §7–§9 |
| `bible_live_slice.test.ts` | normalizer against garbage, migration reader idempotency |

### Tier 2 — fast pure-data E2E (`bible_e2e_playthrough.test.ts`, target < 1 s)

A simulator that walks all 85 quests through the *real* gate and the *real*
native trigger model, with no server, no Redis, no browser. Modelled on
`ch1_e2e_playthrough.test.ts`, which found two dungeon bugs that would each
have cost a full stack boot to reproduce.

It catches, in about a second:

- a quest whose prerequisite is never completable (orphan chain)
- a quest gated to a time/weather combination that never co-occurs
- a repeatable whose cadence window makes it unreachable
- a giver who offers a quest the gate can never pass
- a reward item with no definition
- a hidden quest with no discovery publisher
- an unreachable step because the previous step's target does not exist
- the Q1→Q12 arc being completable out of order

Performance discipline, learned from the §1.2 quadratic-BFS incident: the
reachability walk memoizes per catalog and uses a head index rather than
`Array.shift()`.

### Tier 3 — browser E2E

The structural change makes checkpointing dramatically cheaper. Today a resume
must reconstruct `quest_runtime` records *and* the live slice. After migration
a checkpoint is a set of `(challengeId, stepId)` pairs written to
`TriggerState.by_root` plus a small slice — the same shape Chapter 1 already
uses, which is why `HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER` works.

Concretely:

- `scripts/harthmere/seed-bible-quest-step.cjs <player-id> <questId> <stepId>`
  marks predecessor leaves fired and leaves the target leaf open, matching the
  existing `seed-get-muck-out-browser-step.cjs` contract.
- `e2e-jump.cjs` gains every Bible objective as a checkpoint, with coordinates
  read from the **grounded** waypoint resolver — so §4.12's under-terrain
  strand cannot recur.
- The ten-serial-group batching from §4.12 is retained, but each group now
  seeds instead of replays.

### `t.sh` presets

```sh
t.sh bible          # whole Bible fast surface
t.sh bible:main     # Q1–Q12 arc only — parses 13 of 85 rows
t.sh bible:e2e      # pure-data playthrough
t.sh watch bible    # inner loop
```

`t.sh gate` gains the Bible fast suite so the quest/UI/container handoff stays
one Mocha startup.

### The rule that keeps it fast

No module under `src/shared/harthmere/bible/` may import Bikkie item data, the
ECS gen layer, a server handler, the trigger engine, or a renderer asset.
`bible_engine_contracts.test.ts` asserts this by reading the import graph. If a
suite passes under `full` but fails under fast, that failure *is* the signal —
`TESTING_FASTER` §3.

---

## 11. Phasing

| Phase | Content | Risk |
| --- | --- | --- |
| 1 | Schema, ids + pin table, gate, waypoints, contracts, live slice, full fast test suite | none — new files, nothing rewired |
| 2 | Proving slice: Q1–Q12 + Q2.5, the 7 hidden/giver-less, both repeatable families. Native projection runs from new data behind `BIBLE_NATIVE_V2` | low — old path still default |
| 3 | Bulk-convert remaining side + starter rows; flip the default; migration reader ships | medium — covered by tier 1+2 |
| 4 | Delete `quest_runtime.ts`, the Redis reducer's progress branches, and `HARTHMERE_QUEST_CATALOG_JSON`; rewire the 25 consumers | medium — mechanical, type-checked |

Phases 1–2 are this pass.

---

## 12. Consumer inventory

25 files import `quest_compendium`, 16 import `quest_runtime`. They fall into
four groups:

- **Runtime, must rewire** (6): `live_mode_backend.ts`,
  `bible_quest_live_authority.ts`, `native_ecs_drop_materialization.ts`,
  `harthmere_native_quests.ts`, `harthmere_native_bikkie_items.ts`,
  `bibleQuestLiveAdapter.ts`
- **Validators, re-point** (3): `harthmere_quest_chain_validator.ts`,
  `check-harthmere-quest-bible-grounded.cjs`,
  `audit-harthmere-bible-implementation.cjs`
- **Tests, rewrite** (8) — superseded by the tier-1 suite
- **Scripts, mechanical** (8) — read the catalog for placement/E2E; swap the
  import

`getHarthmereQuestById` and `HARTHMERE_QUEST_CATALOG` keep working through a
compatibility shim during phases 1–3 so no consumer breaks mid-migration.

---

## 13. Authoring defects found, and what was done about each

The conversion surfaced four defects. Three are preserved-not-fixed, because
fixing them would change what a player can do and that is a design decision,
not a migration one. One was fixed because it was unambiguously a bug.

### 13.1 `"fog"` in `timeOfDay` — preserved

Three rows list a weather value inside the time-of-day field:

```
repeatable_river_knots_information_drops     ["dusk","night","fog"]
repeatable_river_knots_small_smuggling_runs  ["night","fog"]
repeatable_briarfen_witchlights              ["night","fog"]
```

The writer meant "at dusk/night, **or** when foggy" — an OR across two fields
the schema cannot express. The retired gate compared `timeOfDay` against a
context value that is only ever dawn/day/dusk/night, so `"fog"` never matched:
the token was inert and these quests are dusk/night-gated in practice.

Moving `"fog"` into `weather` looks like the obvious fix and is a live
regression: `weather` is currently the complete set (i.e. "any"), so gating on
fog would make these quests **unavailable on a clear night**, which is when
players actually run them. The converter drops the inert token, preserving
behaviour exactly, and reports it on every run. Resolving the real intent needs
an OR-capable gate and a designer's call.

### 13.2 Repeatable cadence never enforced — FIXED

21 quests are authored `daily` or `weekly`. `acceptHarthmereQuest` only blocked
re-accept when repeatability was `once`, and `completeHarthmereQuest`
deliberately keys the reward grant id per cycle so repeatables re-grant. There
was no cooldown check anywhere. A player could complete any daily unbounded
times per day and collect silver, xp and reputation each time.

Fixed in `bible_quest_gate.ts` with calendar-boundary resets (daily at 00:00
UTC, weekly at 00:00 UTC Monday), both as named constants. This is an economy
fix, not a refactor artifact.

### 13.3 Q12 waypoint disagreed with the Thaedryn arena — FIXED

The authored Q12 waypoint resolves to **Y = −60**; the canonical arena anchor
the renderer actually draws is at feet height (Y = 53). This is the "three
conflicting Wyrm's Bed locations" defect resurfacing — the override existed but
nothing routed objective waypoints through it.

`bible_waypoints.ts` now applies `bibleThaedrynWaypointOverride` for all four
Q12 objectives and the quest marker, and `bible_waypoints.test.ts` asserts the
two agree. Without this, objective distance validation measures against a point
no player can stand on and returns `player_too_far` for someone standing
exactly where the game drew the dragon.

### 13.4 Underground arc depths — verified, not a defect

Q6 → −6, Q7 → −14, Q8 → −26 resolve below ground. These are legitimate
Bellward Halls depths, and they descend monotonically as the arc progresses.
`bible_waypoints.test.ts` asserts the descent, so a lost placement record that
silently returns one of them to the surface now fails a one-second test.

---

## 14. Measured results

Phase 1–2 as built. Every number measured in this checkout.

| | Result |
| --- | --- |
| `t.sh bible` | **105 tests, 56–86 ms of assertions, 2.9 s wall** |
| `t.sh bible:main` | 33 tests, 18 ms — parses 13 of 85 rows |
| `t.sh bible:e2e` | 11 tests, 10 ms — full 85-quest, 340-step playthrough |
| `t.sh types:bible` | clean, 13.0–15.4 s |
| Existing `t.sh ch1` | 319 passing, unchanged |
| Existing `t.sh quests` | 184 passing, unchanged |
| Legacy Bible suites | 47 passing, unchanged |
| Catalog source | 25,398 lines (one JSON string) → 14,489 lines (4 typed modules) |
| Id pins | 85 quest, 451 trigger-node — no id moves |

The whole 85-quest catalog now plays through in 10 ms at tier 2. The browser
tier's job shrinks from "walk the catalog" to "confirm the physical
interactions", and its checkpoints are two integers per completed leaf.

Phase 1–2 is additive: no existing consumer was rewired, and every pre-existing
suite still passes. Phases 3–4 in section 11 remain.
