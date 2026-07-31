# Chapter 1 Quest Audit — 2026-07-30

Full traceability audit of Chapter 1 ("Identity"). No code was changed.

Every quest step was traced through the chain that actually ships:

```
ch1_quests.ts (authored catalog)
  → ch1_native_quests.ts (Bikkie challenge + seq trigger tree)
  → chapter1_progress.ts (authenticated objective authority)
  → harthmere_quest_progress.ts (signed ECS event → trigger fires)
  → Chapter1NativeObjectivePrompt.tsx (the player-facing front door)
```

plus the parallel systems each step depends on: `chapter1_gate.ts`,
`ch1_live_story.ts`, `ch1_dungeon_mechanics.ts`, `ch1_dungeon_encounters.ts`,
`ch1_escort_scheduler.ts`, `ch1_encounter_scheduler.ts`, `ch1_scenes.ts`,
`ch1_objective_targets.ts`, `ch1_dialogue.ts`, and the shim seeder.

## Verdict

**Not production ready.** The architecture is sound and unusually disciplined —
server-authoritative progress, signed events, idempotent effects, real ECS
ownership, no client-trusted progression. The gaps are content and edge-case
gaps, not structural ones.

| # | Severity | Finding |
|---|----------|---------|
| 1 | **P0** | `the_tea` (Act 1, quest 1, step 2) points at Teak Morrow, 137 m away |
| 2 | **P0** | Entering the desert gate before the dungeon quest starts is a permanent soft-lock |
| 3 | **P0** | Iris / Marrow / Sorrel are mandatory escorts, killable, and have no revive path |
| 4 | **P1** | The end-to-end tests validate a progression model the player never touches |
| 5 | **P1** | 48 of 80 steps (60%) are "walk into radius, press F" with no verification |
| 6 | **P1** | Winter dungeon can be legally exited 3 steps early, stranding Act 5 |
| 7 | **P1** | Three named quest givers have no ECS entity: Coretta, Calla Ashe, the Jobs Board |
| 8 | **P2** | Cross-map objective whiplash — Vane at x=42, Rook at x=904, both in "The Grove" acts |
| 9 | **P2** | Consumed-item steps can hard-block with an internal item id shown to the player |
| 10 | **P2** | Authored non-combat dungeon routes are free skips with no mechanic |
| 11 | **P3** | No map / world marker for Chapter 1 objectives |
| 12 | **P3** | `check_corettas_ledger` misses its alias; completion dialogue covers 4 of 80 steps |

## Inventory

**31 quests, 80 steps, 6 acts.** Everything authored exists and resolves:

- All 6 acts have quests and exactly one `actClose` quest each, and each closer
  sets the next act's entry flag. `ch1ValidateActStructure()` is clean.
- All 31 quests project to Bikkie biscuits with stable ids derived from the
  frozen array order, each with a 100-id step block. Reordering is a migration
  and tests guard it.
- All 80 steps produce an `event` leaf keyed to `harthmereQuestProgress` with a
  challengeId+stepId predicate. No step is orphaned.
- Every `fragmentId` referenced by a step resolves in the fragment ledger. **0
  missing.**
- Every `cutsceneId` referenced by a step resolves in `ch1_scenes.ts` and is
  registered in the client cutscene library via `CH1_SCENE_FACTORIES`. **0
  missing.**
- All 4 latent skills referenced by steps exist.
- Both dungeons pass structural validation: 7 zones each, no merchants, no rest
  nodes, ≥3 boss phases, ≥1 required retrieval, authored length in band.
- 12 dungeon encounter NPCs and the Ch1 cast are seeded by the shim, including
  the create-only self-heal path that runs on production snapshot deployments
  (terrain generation disabled, authored content still reconciled).
- Both schedulers (`escort`, `encounter`) are enabled in production —
  `Dockerfile.biomes` sets `GLITCH_RUNTIME=1`.
- Chapter 1 is integrated into the main quest tray with explicit ordering
  against the robot story, Gimme Shelter, and Battery Not Included.

**347 Chapter 1 tests pass, 0 fail.** The findings below are gaps in what is
tested, not regressions.

## Trigger histogram

| Trigger | Count | Actually gated by something? |
|---|---|---|
| `talk_npc` | 16 | No |
| `interact` | 15 | No |
| `dialogue_choice` | 14 | Yes — choice spec validated server-side |
| `minigame` | 8 | Partly — 7 are dungeon resource costs, 1 is a real minigame |
| `collect` | 8 | Only `resume_dosing` requires an item |
| `near_location` | 7 | Auto-completes on proximity (by design) |
| `give_item` | 3 | Only `give_the_ledger` consumes anything |
| `escort` | 3 | 2 of 3 check NPC positions |
| `defeat` | 3 | Only when the player picks the combat route |
| `sleep` | 2 | No — no bed, no sleep required |
| `use_item` | 1 | No — no item required |

---

# P0 — Blockers

## 1. `the_tea` sends the player to Teak Morrow

**Act 1, quest 1, step 2** — the second objective in the chapter.

`ch1_objective_targets.ts` resolves the cast before the alias table, and the
cast match is a bidirectional substring test:

```ts
const cast = CH1_NEW_CAST.find((member) => {
  const name = normalized(member.displayName);
  return target === name || target.includes(name) || name.includes(target);
});
```

`normalized("Tea")` → `"tea"`. `normalized('Teague "Teak" Morrow')` →
`"teague teak morrow"`, which **contains** `"tea"`. So the step resolves to:

```
label=Tea  src=npc  entity=8810000000020506  pos=418/53/-237
```

That is Teak Morrow's spawn. The intended target — `TARGET_ALIASES` has
`["tea", CH1_ANCHORS.jackie_post]` — is never reached, because the alias lookup
runs *after* the cast lookup.

Player experience: wake up in the road-house, then "Eat what Jackie put in front
of you and drink the tea · Tea · **137 m away**", pointing at a detained Take
Terra courier on the far side of town. This is the first thing a new player sees
after the ignition cutscene.

Note this is a class of bug, not one instance. Any short `targetLabel` that is a
substring of any cast display name will collide the same way. Worth ordering
alias-before-cast, or requiring the cast match to be a whole-token match.

## 2. Entering the desert gate before the dungeon quest starts is a permanent soft-lock

Gate visibility and quest activation are decoupled:

- `ch1ActiveDungeonGateIdsFromNativeChallenges` opens `ch1_gate_desert` as soon
  as `highestReachedAct >= 3` — i.e. the moment `ch1_a3_q01_a_button_in_the_sand`
  goes in progress.
- The dungeon quest `ch1_a3_d1_the_sand_that_remembers` only goes in progress
  after `ch1_a3_q02_pack_for_it` completes — 5 objectives later.

In that window the gate is enterable. `chapter1_gate.ts` does not check that the
dungeon challenge is active, and it defeats its own flag check by synthesising
the required flag before calling `ch1EnterGate`:

```ts
chapterState.flags = [
  ...(gate.requiresFlag ? [gate.requiresFlag] : []),
  ...state.chapter1.completionFlags,
];
```

Once inside, there is no way out:

- **Exit** requires `item_first_grain` + `npc_iris_fen`, both of which come from
  `d1_seed_vault` / `d1_the_long_walk`.
- **Those steps are unreachable**, because `activeChapter1ObjectiveForTest` only
  returns leaves of *in-progress* challenges. The active leaf is `provision`,
  `lous_gift`, or `the_pack_check` — all Grove-side, all outside the band.
- **Death** does not help: the encounter scheduler's downed-recovery warps the
  player back to the dungeon arrival, by design.
- **Eviction** does not fire: `illegallyInside` requires invalid admission, and
  this player's admission is valid.
- Even escaping the band by other means leaves `activeDungeonRunId` set forever,
  which pins `interaction: "exit"` and makes `ch1EnterGate` refuse with
  "already inside a gate". The chapter never advances again.

Likelihood is moderated by the pack check — a player who has not done "Pack For
It" often cannot satisfy the provisioning requirements. But a player who
provisions early, or who is carrying a stocked pack from ordinary play, walks
straight into it.

Two candidate mitigations: gate `enter` on the dungeon challenge being in
progress, or add an abandon-run exit that clears the run and warps to
`returnPosition` without requiring retrievals.

## 3. Mandatory escorts are killable with no revive path

`ch1_dungeons.ts` marks Marrow `required: false` and notes **"MUST BE
UNKILLABLE"**. `ch1_dungeon_encounters.ts` disagrees:

```ts
if (objectiveId === "d1_the_long_walk") {
  return CH1_DUNGEON_ESCORT_NPCS.filter((npc) => npc.dungeonId === "ch1_dungeon_desert");
}
```

That returns **both** Iris and Marrow, and `chapter1_progress.ts` refuses the
objective unless both are within 22 m of the aperture. So Marrow is mandatory in
the runtime and optional in the design doc.

Nothing makes any of the three escorts unkillable:

- The shim seeds cast NPCs with `npcEntity(...)` defaults and no invulnerability
  component, no HP override.
- Their escort combat policies put them in fights: Iris `defend_leader`, Marrow
  `defend_self`, Sorrel `fight_muck`.
- `escortStatusFor` returns `"down"` at `hp <= 0`, and there is no revive path
  anywhere in Chapter 1 for escort NPCs — the party revive in `chapter1_gate.ts`
  only covers claim members (players).
- The only "unkillable" enforcement is `ch1ValidateNonCombatants()`, which
  checks that their names do not appear in encounter *strings*. It does not
  touch the ECS.

If Iris or Marrow dies to the Salt-Cured Muckers (3 × 90 HP) or the Gilded Bull
(420 HP), `d1_the_long_walk` becomes permanently unsatisfiable — and since that
step is what sets `ch1_iris_rescued`, the desert exit is also permanently
blocked. Same shape for Sorrel and `d2_the_breaking_year`.

---

# P1 — Major

## 4. The E2E tests validate a model the player never touches

There are two independent progression models:

| | Tested model | Shipped model |
|---|---|---|
| Source | `ch1_chapter.ts` | `ch1_native_quests.ts` + `chapter1_progress.ts` |
| Availability | `ch1AvailableQuestIds`, `requiresFlags`, act flags | linear `challengeComplete` chain over the frozen array index |
| Exercised by | `ch1_e2e_playthrough.test.ts`, `ch1_browser_audit.ts` | the game |

`ch1AvailableQuestIds`, `ch1ActUnlocked`, and `ch1ValidateActStructure` have **no
production callers** — only `ch1_chapter.ts` itself and the browser audit. Which
means quest-level `requiresFlags` is decorative: the native chain unlocks quest
N purely on quest N−1 completing.

`ch1_e2e_playthrough.test.ts` says it catches "a quest that requires a flag
nothing grants" and "a dungeon that cannot be left because a retrieval is
unobtainable". It does catch those *in the narrative model*. It cannot catch
finding #2, because the runtime does not consult that model.

Ordering happens to be consistent today (the array is act-1-through-act-6 and
each act's closer is last in its block), so the linear chain and the act flags
agree. That is a coincidence maintained by convention, not by a test.

The `?e2e=1` bypass compounds this: in E2E mode `activeGateIds` returns both
gates unconditionally and `carriedOut` is synthesised from the required
retrievals, so the browser gate never exercises the real provisioning or
retrieval paths.

## 5. 60% of steps have no gameplay verification

48 of 80 steps complete on "get within 9–20 m, press F". No choice, no mechanic,
no encounter check, no escort check, no item requirement. The ones where the
objective text promises real activity:

| Step | Objective text | Actually required |
|---|---|---|
| `gather_parts` | "Bring Luis what the chassis needs" | nothing |
| `take_jobs` | "Complete jobs for the Grove's businesses" | nothing |
| `meet_the_suppliers` | "Trade with Rin, Fern, Gus, Carlo, Mel, and Luis at least once each" | nothing |
| `collect_testimonies` | "Collect all twelve accounts of the night you arrived" | one press — all 12 granted at once |
| `the_three_answers` | "Hear out Ranger Jane, Arbiter Vane, and Halden Rook" | reach Jane only |
| `provision` | "Gather water, food, cooked rations, forage, torches, repair kits, and field medicine" | nothing (the *gate* checks, the step does not) |
| `provision_winter` | same, harsher | nothing |
| `the_tea` | "Eat what Jackie put in front of you and drink the tea" | nothing, no item |
| `have_it_analysed` | "Take a vial to Doc" | nothing consumed |
| `show_him` | "Give the vial to Dr. Ardan" | nothing consumed |
| `wake_up` / `sleep_alone` | "Get out of bed" / "Sleep in the road-house" | no bed exists; not wired to any sleep system |

`collect_testimonies` is the most costly: `CH1_TESTIMONIES` contains 12 authored
one-sentence accounts attached to named NPCs and locations, and
`ch1ApplyLiveObjectiveEffects` assigns all 12 in a single call. The authored
content is written, shipped in the bundle, and never read by a player. The
quest's own writer note — "the reward is a RECONSTRUCTION the player assembles
themselves" — does not happen.

The `sleep` steps are worth separating out: the client does report sleep
triggers to `chapter1_story` on completion, so the sleep *memory channel* works.
But nothing requires the player to have slept, so Act 1's "establishes the
sleep-fragment channel" beat lands on a button press next to Jackie's post.

## 6. The winter dungeon can be exited three steps early

Winter's required retrievals are Sorrel, the field ledger, and Custodian Key 3.
All three land at `d2_the_oath` — step 6 of 9. So `ch1ExitGate` legally succeeds
before `d2_ash_hall` (the boss), `d2_hallrs_choice`, and
`d2_the_breaking_year`.

The desert does not have this problem: its exit needs `ch1_iris_rescued`, which
only the final step sets.

Consequences of an early winter exit:

- The three remaining steps all target positions inside the Elsewhen band, so
  the chapter cannot advance until the player re-enters.
- Re-entry requires passing the winter pack check again (fuel, food ×2, cooked,
  cold gear, rope, iron). A player who burned supplies getting to Sorrel may not
  be able to re-provision → soft-lock.
- Releasing the slot claim clears Sorrel's escort record, so she stops wherever
  she was standing rather than returning to `sorrels_camp`. On re-entry she may
  be nowhere near her camp volume.
- `activeGateIdsForRuntime` deletes `ch1_gate_winter` once `hallrChoice ===
  "let_run"`, which is correct for the intended flow but interacts badly with
  any exit/re-enter loop around that step.

## 7. Three named quest givers have no ECS entity

`questGiverId()` resolves the giver against `CH1_NEW_CAST` then the native quest
giver manifest. Three fall through to `undefined`:

| Giver | Quests | Status |
|---|---|---|
| **Coretta** | `ch1_a2_q03_the_night_you_came`; her ledger in `ch1_a5_q01` | No entity anywhere. Also the source of `testimony_coretta`. |
| **Foreman Calla Ashe** | `ch1_a4_q02_thirty_one_seconds` | No entity. `how_did_you_do_that` ("Answer Calla Ashe") resolves via district fallback to the Ashline anchor with nobody there. |
| **Jobs Board** | `ch1_a2_q02_work_the_board` | Exists as a Grove landmark, not an entity — fine as a target, but not a giver. |

Two givers are auto-started **on purpose** and correctly documented in the code:
quest 1 (the first objective is "wake up", so a Jackie offer would leave the
player with no active objective) and `ch1_a4_q06_teak` (Holt's old local-dev
entity `8810000000010027` is not guaranteed in the imported snapshot). The three
above are auto-started **by accident** — they happen to work because a
giver-less biscuit auto-starts from its `challengeComplete` unlock, but nobody
decided that, and it means named characters in the writer's-journal cast are
absent from the world.

---

# P2 — Moderate

## 8. Cross-map objective whiplash

`ANIMA RULE 4` correctly forbids Chapter 1 from moving NPC entities — staging is
a projection, never an ECS write, because Ch1 state is per-player and the NPC
set is shared. The consequence is that authored districts and actual objective
positions diverge, sometimes badly:

| Step | Authored district | Resolved position | Note |
|---|---|---|---|
| `hear_vane` | The Grove | `42/71/-30` | ~470 m west, between two Lou scenes at `656/-182`. ~1 km round trip mid-climax. |
| `say_the_sentence` | Old Wood Copse | `904/71/-209` | Rook's post, across the Harthmere bridge, from an aperture at `648/-462`. |
| `rooks_rope` | The Grove | `904/71/-209` | "Rook shows up at the gate uninvited" is a 400 m trip to Harthmere. |
| `come_out` | The Grove | `496/71/-126` | Rook's Act 5 closing scene happens without Rook, who is 400 m away. |

None of these block completion. All of them break the staging the writer's
journal describes, and `hear_vane` in particular lands in the middle of Act 6's
climax.

## 9. Consumed-item steps can hard-block, with an internal id in the message

Two steps consume items:

- `give_the_ledger` consumes `item_sorrel_field_ledger` (granted at `d2_the_oath`)
- `resume_dosing` consumes `item_ch1_compound_b` (granted at `search_the_stores`)

If either item is missing from the native inventory — dropped, lost to a failed
inventory transaction, or destroyed — the objective is refused and there is no
way to re-obtain it. Given this repo's documented history with live-mode
inventory writes (the stackable-zero black hole, the write/read actor mismatch,
the Redis WATCH lost updates), that is not a hypothetical.

The refusal message is also raw:

```ts
reason: `You need ${itemId} before completing this objective.`
```

→ *"You need item_sorrel_field_ledger before completing this objective."*

## 10. Authored non-combat dungeon routes are free skips

`ch1RequiredEncounterNpcsForObjective` only gates on NPC health for the combat
routes:

| Step | Combat route (gated) | Alternate route (not gated) | Authored mechanic |
|---|---|---|---|
| `d1_salt_market` | `fight_open` | `drop_awnings` | drop awnings on enemies |
| `d1_cistern_stair` | — | `lit_stair` / `no_air_shortcut` | finite torches; drownable shortcut |
| `d1_sun_court` | `break_horns` | `stealth_bypass` | pillars break the horns |
| `d2_hanged_wood` | `fight_through` | `silent_path` | sound discipline |
| `d2_longhouse` | — | — | breath as a hard timer |
| `d2_whale_road` | — | — | carry weight makes the ice fail |

The alternate routes are one button press. The mechanics they describe — awning
verticality, sound discipline, breath timers, stealth — do not exist; what
exists is the resource/health cost applied by `ch1_dungeon_mechanics.ts`. Carry
weight is the exception: `d2_whale_road` and `d2_the_breaking_year` genuinely
check it and surface a "cracking" overlay.

Choosing `stealth_bypass` at the Sun Court correctly withholds
`item_bulls_core`, and that item is not a required retrieval — so it is safe,
just uneventful.

`the_procedure` is the one real minigame, via `Chapter1ContainmentTriage`, and
it correctly cannot be failed (it falls through to `hands_finish`).

---

# P3 — Polish

## 11. No map or world marker for Chapter 1 objectives

Because every Ch1 leaf is a bare `harthmereQuestProgress` event trigger with no
position or entity metadata, the generic native quest marker system produces
nothing. The only wayfinding is the HUD prompt's label and metre count. For
targets like "Coretta's ledger" or "Grove suppliers" — abstract labels resolving
to Grove anchors 3 m apart — that is not enough to find anything. It matters most
for the cross-map steps in finding #8.

## 12. Smaller items

- **`check_corettas_ledger` misses its alias.** `normalized("Coretta's ledger")`
  → `"coretta s ledger"`; the alias key is `"corettas ledger"`. No match, so it
  falls through to the district fallback (`jackie_post`) instead of the intended
  `fountain_lesson_board`. The two are ~3 m apart, so it is harmless in practice
  — but it is the same apostrophe-normalisation bug that would bite harder
  elsewhere. `"Jackie's kettle"` misses its alias too and is rescued by a fuzzy
  landmark match.
- **Completion dialogue covers 4 of 80 steps** (`report_or_not`,
  `d2_hallrs_choice`, `the_final_choice`, and their options). Objective dialogue
  covers 63 of 80. The uncovered dramatic beats — `confront`, `hear_him_out`,
  `watch_him_go`, `the_whole_plan`, `the_word` — are carried by cutscenes, and
  those cutscenes do contain the authored lines, so this is a consistency gap
  rather than missing content.
- **`ch1-recon-corridor-revised` and `ch1-recon-intake`** are registered scenes
  that no quest step references. Presumably driven by the consolidation pass;
  worth confirming they are reachable.
- **Hardcoded fallback warp** in `chapter1_gate.ts`:
  `warpPosition = state.chapter1.returnPosition ?? [496, 71, -126]`.
- **Both schedulers run in the web process** with no leader election. Under
  `Multiple` mode with more than one web replica, every replica ticks the
  encounter scheduler and mutates the same Ninth Winter HP / loop counters. The
  escort scheduler is effectively idempotent (`ch1EscortAssignmentIsCurrent`
  short-circuits); the encounter scheduler is not obviously so.

---

# Recommended order

1. **Fix `the_tea`** (finding #1). One-line ordering change in
   `ch1_objective_targets.ts`; it is the second objective in the chapter.
2. **Close the dungeon-entry soft-lock** (finding #2). Require the dungeon
   challenge in progress before `enter`, or add an abandon-run exit.
3. **Make the escorts unkillable, and reconcile Marrow** (finding #3). Decide
   whether Marrow is required — the two source files currently disagree — then
   enforce invulnerability in the ECS rather than in a name-substring test.
4. **Add a native-path E2E test** (finding #4) that drives
   `chapter1_progress.ts` rather than `ch1_chapter.ts`, without the `?e2e=1`
   bypass. Findings #2 and #6 would both have been caught by one.
5. **Gate the winter exit** on the last step, or on the boss (finding #6).
6. **Seed Coretta and Calla Ashe**, and decide what the Jobs Board giver should
   be (finding #7).
7. **Give the 12 testimonies real collection**, and put an item requirement on
   the `give_item` / `use_item` / `collect` steps whose text promises one
   (finding #5). This is the largest body of work and the one that most changes
   how the chapter feels.
8. Everything in P2/P3 as polish.

## Method notes

- 347 Chapter 1 tests were run and all pass:
  `src/shared/harthmere/test/ch1_*.test.ts`,
  `src/shared/cutscene/test/ch1_scenes.test.ts`,
  `src/pages/api/harthmere/test/chapter1_progress.test.ts`,
  `src/server/harthmere/test/ch1_fragment_authority.test.ts`,
  `src/server/harthmere/test/escort_system.test.ts`,
  `src/client/components/challenges/Chapter1NativeObjectivePrompt.test.ts`.
- The per-step traceability table was generated by two throwaway mocha specs
  that import the real modules and dump resolved givers, targets, positions,
  entity ids, mechanics, gates, fragments, cutscenes, and dialogue coverage.
  They are at `tmp/ch1audit/` (gitignored) and can be deleted.
