# Chapter 1 — End-to-End Test Runbook

Companion to `NATIVE_ECS_BROWSER_E2E_RUNBOOK.md`. Same memory-safe topology,
same readiness rules, same "one Chromium context at a time" discipline. This
file covers only what Chapter 1 adds.

## Live status — August 5, 2026

The focused Core Cell, Jackie, cutscene-exit, and item-attachment defects are
repaired. See `CHAPTER_1_HOTFIX_AUDIT_2026-08-05.md` for exact HAR findings,
source routes, build ownership, and report paths.

Do not describe Chapter 1 as fully passed yet. The remaining current-source
acceptance is:

- the complete 31-quest/80-objective progression on the final combined
  artifact;
- front-facing third-person visual approval of all fifteen held plot items.

The Core Cell player path must be asserted as one handoff, not as unrelated
inventory and marker checks:

1. `gather_parts` grants `item_augur9_core_cell` into native inventory;
2. the HUD says **Install the Core Cell**;
3. the active Chapter 1 pin replaces a stale unrelated pin and targets
   AUGUR-9 near `[524, 69, -154]`;
4. the real `F` interaction completes `seat_the_core`.

For staged NPC objectives, assert that the progress API's target, visible
client puppet, map marker, distance check, and Talk recipient all use the same
authored position. Seed an unrelated accepted quest when checking Jackie so a
generic quest action cannot masquerade as Chapter 1 dialogue.

Run final Chapter 1 groups in one non-fail-fast browser context:

```sh
HARTHMERE_E2E_CHAPTER_1_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=items,quests,cutscenes,gates,terrain,cast \
HARTHMERE_E2E_CHAPTER_1_SKIP_VIDEO=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

`HARTHMERE_E2E_CHAPTER_1_ITEM_IDS` is a diagnostic subset only. Release
acceptance must omit it and exercise all fifteen items. The item batch must
require the exact hotbar selection, a non-empty rendered attachment, and a
front-facing screenshot where scale, orientation, grip, and silhouette can be
judged. Mesh-count success with the item hidden behind the avatar is not visual
approval.

Classify report failures at the boundary where they occur:

- auth/bootstrap/app-replacement failure before a scenario begins: zero
  product coverage;
- all product assertions pass, followed by an expected cutscene music-request
  cancellation: focused product pass, but not a clean release report;
- one group fails: continue the remaining selected groups and repair/rerun the
  failed set as a batch.

## Live status — July 25, 2026

The Chapter 1 **native quest-completion** release gate is closed. The dungeon
**challenge-experience** gate is still open; quest completion, terrain
traversal, and pure state contracts are not substitutes for playing each
authored challenge in the production client. Do not replay retained passes
without a relevant authority, prompt, quest-definition, or dungeon-mechanics
change:

- Road Ahead Clothing Crate and Billy's Toolbag are successful in the supplied
  HAR.
- Busted's physical sunken chest and every authored action from the chest
  through chapter completion pass in
  `artifacts/harthmere-native-ecs-e2e/1784962944155-29904-report.json`.
- Get the Muck Out and Muck vs. Machine already have retained passing browser
  evidence.
- The dedicated J-key Quests UI passes one combined production-browser batch
  in `1784963562747-35318-report.json` (filters, Failed state, detail,
  responsive layout, and Show on Map).
- All **31 Chapter 1 quests and all 80 objectives** complete through the
  production browser prompt and authoritative progress route. The final
  checkpointed run is
  `artifacts/harthmere-native-ecs-e2e/1784986267883-76489-report.json`: 30
  objectives exercised in that run, 50 retained objective passes, zero browser
  failures, and final status `pass`.
- Browser contract/catalog, all 16 scene entries, terrain/cast, and both gate
  families have retained passing reports. Keep those reports as the release
  evidence unless their covered code changes.
- The dungeon survival/stat layer was repaired and rerun as two focused browser
  batches on July 25, 2026. Desert passes in
  `artifacts/harthmere-native-ecs-e2e/1785019042164-46154-report.json`; winter
  passes in `1785019132033-47465-report.json`. Both have zero browser failures
  and record per-objective native HP/stamina/breath plus physical native
  water/fuel/light counts.

Use `scripts/harthmere/t.sh gate` to collect quest/container/UI/type failures
in one local batch. Use `HARTHMERE_E2E_QUESTS_UI_ONLY=1` for the combined UI
browser gate. Do not split those assertions into separate Chromium launches.
The detailed Layer 2 and Layer 3 lists below remain useful regression and art
review checklists, but the user stopped further screenshot/cutscene capture on
July 25 after the existing deliverables were saved. That stopped visual work
is not a reason to replay the completed quest gate.

## Native quest completion gate (closed)

### August 6 hotfix revalidation

The post-HAR interaction/item/map hotfix was revalidated without replaying
already-green objectives. The current retained chain is listed in
`docs/harthmere/CHAPTER_1_HOTFIX_AUDIT_2026-08-05.md`. Its final report is
`artifacts/harthmere-native-ecs-e2e/1785994381920-72256-report.json`:

- final status `pass` with zero browser failures;
- `questCount: 31`, `stepCount: 13`, `retainedPassedStepCount: 67`;
- both dungeons completed with native survival/resource state;
- desert Iris and winter Sorrel escorts completed under real Anima movement;
- final recovered state contains 17 fragments, four latent skills, all twelve
  testimonies, Hallr's choice, and the authored ending.

The final client artifact is `warm-20260806044501`. It was produced by a
Next-only compile and app-only remount; the existing image, Redis world, server
artifact, and standalone Anima process were retained. Future work should resume
from the last exact `questId/stepId` in a report and must not replay the 80-step
chain unless quest authority or progression logic changes.

Run the whole remaining quest family in one browser context:

```sh
HARTHMERE_E2E_CHAPTER_1_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=quests \
HARTHMERE_E2E_SKIP_VIDEO=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

If a late objective blocks the linear family, retain the completed report and
resume after its last passing objective rather than replaying the chapter:

```sh
HARTHMERE_E2E_CHAPTER_1_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=quests \
HARTHMERE_E2E_SKIP_VIDEO=1 \
HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER=ch1_a4_q05_the_man_who_didnt_accuse/show_him \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

The retained 80-objective chain is composed of these reports:

- `1784982537533-46916-report.json` — `wake_up`
- `1784983289793-51283-report.json` — `the_tea`
- `1784984378487-57045-report.json` — `kit_check` and `choose_a_name`
- `1784985254244-70060-report.json` — the next 46 objectives
- `1784986267883-76489-report.json` — the final 30 objectives and aggregate
  `retainedPassedStepCount: 50`

The bridge validates the exact active challenge and step, enforces interaction
distance, and publishes the signed challenge event. The client prompt shares
the central F-key dispatcher at `chapter1Story` priority, polls single-flight,
and prevents overlapping completion requests. Proximity-only objectives
complete automatically after the authoritative route confirms the player is
at their target.

Teak Morrow's quest starts without a giver because the imported production
snapshot has no legacy Sergeant Holt entity. Its first objective still targets
the guaranteed native Teak ECS record, so removing the absent giver fixes the
orphan without weakening the actual interaction requirement.

## Human dialogue expression gate

Chapter 1 dialogue expressions are client presentation state. They must not be
published as NPC emotes or otherwise written into Native ECS, Anima, or Gaia:
doing so would turn one player's dialogue choice into shared world state for
every nearby client. The active page instead resolves the exact local human NPC
entity and publishes a short-lived browser-local cue. NPC rendering applies
expression priority in this order:

1. an active cutscene expression for that exact actor;
2. the active Chapter 1 dialogue-page expression for that exact actor;
3. an ordinary gameplay ECS emote.

The authored catalog currently contains 102 human NPC pages, 5 AUGUR robot
pages, and 28 narration, document, player, or environment pages. Every human
page must have a valid expression. Robot and non-NPC pages must have none.
Dynamic testimony/answer routes and generated exit guidance must preserve the
same rule. AUGUR may retain mechanical cutscene actions such as `getUp`, but it
must not receive emotional facial cues.

Snapshot-player cutscene humans need an additional runtime guard. A generated
avatar can report an active Blender action even when only part of the skeleton
bound, leaving one or both arms in the source T-pose. After the mixer runs, the
renderer therefore applies the cinematic expression's procedural safety pose
to the snapshot rig aliases while preserving their Blender bind quaternions;
absolute Euler replacement on `L_Arm` or `R_Arm` recreates the horizontal-arm
silhouette. The same post-mixer fallback also keeps the facial expression
synchronized. Treat this as a runtime rig-binding fallback: only revise the
Blender source when the cinematic asset validator itself fails, not merely
because a snapshot avatar rejected some tracks.

Entity-bound ghost fallbacks must preserve the canonical positive entity id as
their appearance source. The negative transient puppet id is only render
authority; deriving snapshot cosmetics from it changes skin, hair, and clothing
when the real NPC is outside subscription. Explicit fictional ghosts may still
derive an appearance from their own transient id.

The staged local player also remains a normal human, not a black silhouette.
Cutscene staging samples spatial lighting at the client-puppeted scene position,
and the player shader must never receive a zero sun vector: it normalizes the
direction in GLSL, so `[0, 0, 0]` produces undefined lighting even when base
color and sky visibility are correct. Use the renderer's non-zero fallback
direction during that startup/sky-transition frame.

Synthetic snapshot-player NPCs need the same material refresh independently of
the ordinary player renderer. Their player-skinned materials are created with
zero light uniforms, but the negative ghost is owned by the Harthmere runtime
renderer and never passes through `PlayersRenderer`. Each synthetic actor
record must therefore sample non-dark spatial lighting at its staged position
and update every player-skinned material with that value plus the safe sun
direction. A colored current player in the same frame does not prove the ghost
is lit; inspect the negative actor's own material uniforms or its visible
skin/hair/clothing.

Exact-image capture also isolates the authored cast from retained browser-test
users. A reused snapshot Redis can contain multiple old focused-run players at
the same Chapter 1 stage; the runner hides those nearby remote meshes during
the scene and restores them afterward without deleting or relocating ECS
entities. A release frame must contain each authored human once, plus only the
current player when the shot calls for them.

The production prompt exposes the active cue as
`data-chapter1-dialogue-expression` and the resolved actor as
`data-chapter1-dialogue-actor-id`. The browser-local bridge is
`window.__harthmereNpcDialogueExpression`. The Chapter 1 quest E2E runner
checks all three values against each authored page before advancing dialogue,
so a matching label with the wrong entity id is a failure.

Focused local contract:

```sh
node_modules/.bin/mocha --config .mocharc.fast.json \
  src/shared/harthmere/test/npc_dialogue_expressions.test.ts \
  src/shared/harthmere/test/ch1_dialogue.test.ts \
  src/client/components/challenges/Chapter1NativeObjectivePrompt.test.ts \
  src/shared/cutscene/test/ch1_scenes.test.ts
scripts/harthmere/t.sh types
scripts/harthmere/t.sh ch1
scripts/harthmere/t.sh cutscene
scripts/harthmere/t.sh gate
```

The live production-browser check owns two samples in one warm stack:

- open an ordinary human objective dialogue, confirm the DOM expression and
  exact actor id match the local bridge, and visually confirm that NPC performs
  the expression while the page is active;
- play a human Chapter 1 cutscene beat, confirm the speaking actor performs the
  authored cue without a T-pose, confirm every staged human retains visible
  skin/hair/clothing rather than a black silhouette, confirm the synthetic
  actor's own `spatialLighting` and `light` uniforms are non-zero, then confirm
  the cue clears or yields when the beat ends.

One sample from each path is sufficient for the visual smoke because the full
catalog is covered by the data and E2E assertions. Do not count a robot as the
ordinary-dialogue or cutscene sample, and do not open Chromium before the exact
artifact stack passes `e2e-jump.cjs ready`.

## Layer 1 — headless E2E (runs today, no stack required)

```sh
./b test -p 'src/shared/harthmere/test/ch1_e2e_*.test.ts'
```

Two suites, **45 assertions**, ~3 s.

### `ch1_e2e_playthrough.test.ts` — the whole chapter, start to finish

Drives a real `Ch1PlayerState` from the Muck vs. Machine ignition to the final
choice. No mocked flags: every flag is set by the quest step that legitimately
sets it, and every quest is checked against `ch1AvailableQuestIds()` before it
is allowed to run.

Covers:

- every authored quest is reachable in a single run (no orphans)
- acts advance in order and none is skippable
- all four latent skills unlock
- every quest-referenced cutscene id is registered
- both dungeons complete and charge their time-dilation cost
- the ledger goes **silent** after the Act 4 confrontation and restarts only
  when the player resumes the vials
- the designation is never learned before the ice
- the oath is sworn before the handover; the consolidation fires after it
- Lou's trust exceeds Jackie's at the climax (or the handover is not credible)
- all three endings resolve from the same completed run
- failure modes: under-provisioned entry, wrong-act gate, leaving a retrieval
  behind, double entry, and a quest requiring a flag nothing grants

### `ch1_e2e_dungeon_traversal.test.ts` — physical traversal, puzzles, portals

**Flood-fills the actual voxel field** with a player-sized body (2 tall,
one-block step up/down, swimming in water, climbing stair shafts) starting from
where the portal drops you. This is the test that matters: a graph of connected
volumes can be perfectly valid and still be solid rock.

Covers:

- every volume has a player-sized standable space
- every room is walkable from the arrival
- the exit is walkable (no trapping the player in a one-way gate)
- no prop is embedded inside a solid block
- the Hall of Weights is reachable, has its interaction anchor, and the
  comparative-vs-absolute measurement thesis actually holds numerically
- the containment sequence has no fail state and fits its timer
- the portal open curve: opens, holds, closes exactly once, never flickers

## Live Fracture Gate batch

The portal release gate is one browser batch, not four separate launches. It
must prove both visual and authority behavior in this order:

1. wait for the route's authoritative live-player hook (renderer-ready alone
   is not sufficient);
2. move to the Dry Mouth and verify the production F prompt owns the key;
3. sample `chapter1GateRenderSnapshot()` twice and require the shader animation
   clock to advance while the aperture remains visible/open;
4. capture the entry Mouth with the prompt visible;
5. press F, confirm the native player reaches the desert arrival, then move to
   the far anchor, confirm the return Mouth/prompt, and press F to return;
6. repeat entry and exit for the Long Winter Mouth in the same warm browser.

The test query may bypass only provisioning contents when
`HARTHMERE_NATIVE_ECS_E2E=1` on loopback. The API still re-reads native player
position, gate identity, active-run state, arrival, far anchor, and return
position on the server. Production requests always use the real inventory pack
check and required retrieval check.

Focused local batch:

```sh
node_modules/.bin/mocha --config .mocharc.fast.json \
  src/shared/harthmere/test/ch1_live_gate.test.ts \
  src/shared/harthmere/test/ch1_e2e_dungeon_traversal.test.ts \
  src/shared/harthmere/test/ch1_gate_visual.test.ts
NODE_OPTIONS=--max-old-space-size=8192 \
  node_modules/.bin/tsc -p tsconfig.ch1gate.json
```

Do not rerun completed quest, cloud-save, cutscene, or marketing-image gates
while diagnosing this batch. A failure here owns only portal rendering,
interaction, dungeon streaming, or warp authority.

### July 25 live result

One warm authenticated browser completed the Dry Mouth and Long Winter Mouth
as a single batch:

- each mainland Mouth showed the correct production F prompt;
- F established the matching active dungeon and warped the authoritative
  player to its arrival;
- each far anchor showed the matching return prompt;
- F returned the player and cleared the active run.

The interaction and authority seam passes. The portal art does **not** yet pass
final visual review: its current amber aperture is visibly open and
interactable, but the shader's rotation is too subtle and reads as a glowing
solid doorway instead of an unmistakably spinning fracture. Keep that as a
visual blocker without replaying the already-passing warp flow.

### Production completion authority (July 25 follow-up)

The original native-ECS dungeon runner provisioned retrieval state directly.
That was useful for testing traversal, but it masked two production-only
completion failures:

- ordinary objective completion advanced the signed ECS trigger without first
  applying the authored Chapter 1 reward, fragment, choice, testimony, skill,
  inventory, or companion consequence; and
- the exit gate looked only for inventory item ids even though Iris, Marrow,
  and Sorrel are people represented by durable story flags, not bag items.

The production bridge now applies each objective's durable, idempotent story
effect before publishing its signed ECS progress event and restores the prior
state if publication fails. Dungeon extraction combines actual inventory
retrievals with the rescued/saved/oath story flags. The focused regression
batch must therefore include `ch1_live_story.test.ts` as well as the existing
gate and traversal tests. Never use an E2E provisioning shortcut as evidence
that the same retrieval can be earned and recognized in a normal account.

The live Recovered batch also found one catalog seam that pure fragment tests
did not: `frag_a2_play_the_ninth_signature` says it becomes available when the
ledger opens, but no objective carried that playback id. `open_the_tab` now
delivers it explicitly, allowing the authored three-playback Act 5 link to be
completed through the production journal. Keep a regression on the delivery
trigger; a fragment existing in the catalog is not evidence that a player can
ever obtain it.

- persistent gates hold open indefinitely
- warp admission accepts a legitimate run and rejects everything else
- each gate charges a different Grove-time cost
- no single vendor can satisfy a provisioning check

> **Two real bugs were found by writing these**, both invisible to the unit
> tests: exiting a dungeon set its own act-complete flag (stranding the dungeon
> quest and the closing scene in an act the player could no longer enter), and
> an enclosing room's floor slab sealed the stair shaft carved through it,
> making everything past the winter landing unreachable.

## Dungeon challenge-experience gate (stat layer closed; physical choreography open)

**Permanent coverage rule:** an authored `trigger`, target label, terrain
volume, decor prop, analytics event, or pure state transition does not prove a
live mechanic. A challenge is release-tested only after the production client
has shown its player-facing feedback, consequence, failure/recovery path, and
completion/reward path against authoritative state.

The fast mechanics batch is intentionally one process:

```sh
node_modules/.bin/mocha --config .mocharc.fast.json \
  src/shared/harthmere/test/ch1_augur9_party.test.ts \
  src/shared/harthmere/test/ch1_chapter.test.ts \
  src/shared/harthmere/test/ch1_dungeon_horizon.test.ts \
  src/shared/harthmere/test/ch1_dungeon_terrain.test.ts
```

On July 25 this produced **137 passing assertions in 103 ms**. It proves data,
geometry, AUGUR-9, party, horizon, and chapter-state contracts. It does not
close the live challenge gate.

### July 25 authoritative mechanics result

The two focused batches prove the following without replaying either retained
portal flow or unrelated Chapter 1 objectives:

- desert water decrements `12 -> 0`; light decrements `10 -> 7`; the final
  native stamina snapshot is `61/108`; the Bull route deals 10 HP and the Long
  Walk deals 4 HP; AUGUR-9 ends at charge `58` under the authored 3x heat drain;
- winter fuel decrements `18 -> 0`; the final native stamina snapshot is
  `43/108`; Ash Hall deals 8 HP and the Breaking Year deals 5 HP; AUGUR-9 ends
  at charge `61.208333333333336` under the authored half-speed cold drain;
- the reported survival counters exactly equal the corresponding physical
  native inventory counts after every objective, including three consumed
  lights in the Cistern;
- no objective reports the missing-supplies penalty, and both completion
  reports have `browser.failures: []`;
- Dune Threshold, Ice Shelf, Drowned Longhouse, and Whale Road now require the
  signed interaction route. Their former proximity triggers advanced native
  quest state while bypassing the stat/resource/carry-weight reducer;
- each resource debit and signed quest leaf is submitted in one overlapping
  native logic batch. The stable ECS transaction id makes a contended retry
  exactly-once rather than charging supplies twice.

Current production coverage after that repair:

| Dungeon section     | Proven now                                                                                                                                                                                                    | Still requires implementation plus live browser E2E                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Both whole dungeons | terrain/decor, traversal, gates, quest lifecycle, retrievals, persistent survival HUD contract, exact native resource debits, per-zone native HP/stamina effects, breath authority, and heat/cold AUGUR drain | full physical enemy/follower choreography and player-visible failure/recovery presentation         |
| Dune Threshold      | landscape/route plus signed water/stamina/3x AUGUR consequence                                                                                                                                                | shade interaction and visible exhaustion/death/recovery UX                                         |
| Salt Market         | authored route choice, water/stamina cost, and open-fight damage alternative                                                                                                                                  | physical Mucker battle, collapsing awning world interaction, vertical combat, death/retry and loot |
| Cistern Stair       | three-light debit, water/stamina cost, lit-stair/no-air consequences, native breath/drowning authority                                                                                                        | changing water, full drowning presentation/retry, and sound-hunting Hexer AI                       |
| Hall of Weights     | comparative-measurement contract; wrong instruments rejected; temple balance succeeds; water/stamina and rewards commit                                                                                       | animated instrument disagreement, complete puzzle presentation, and playback purchase UI           |
| Sun Court           | stealth/fight route contract, fight damage/stamina, core only on the fight route                                                                                                                              | Bull detection, three physical phases, breakable pillars/horns, death/retry and physical drop      |
| Seed Vault          | water debit, stamina recovery, retrieval/reward/cutscene state                                                                                                                                                | full-inventory collection UX and in-place cutscene handoff                                         |
| Long Walk           | final water debit, HP/stamina storm consequence, escort/retrieval/portal state                                                                                                                                | Iris/Marrow follower AI, storm visuals, pursuit, companion down/disconnect recovery                |
| Ice Shelf Landing   | signed fuel/stamina/half-speed AUGUR consequence                                                                                                                                                              | warmth HUD art, slow cold-death presentation and recovery                                          |
| Drowned Longhouse   | signed fuel/stamina interval plus native breath authority                                                                                                                                                     | furniture wayfinding, drowning/retry presentation and physical reward pickup                       |
| Hanged Wood         | stealth/fight choice with distinct HP/stamina consequences and fuel debit                                                                                                                                     | sound-driven perception, stealth feedback and physical combat alternative                          |
| Whale Road          | real live inventory carry-weight calculation, 55 lb hard gate, fuel/stamina debit                                                                                                                             | visible cracking, fall/recovery and an item-abandon UI                                             |
| Sorrel's Camp       | fuel debit, stamina recovery, key/ledger and oath state                                                                                                                                                       | locked-door staging and remembered-player presentation in place                                    |
| Ash Hall            | six-fuel debit, feed-hearth/fight-dark consequences, native HP/stamina, Hallr choice state                                                                                                                    | Ninth Winter's three physical phases and visible 90-second reset/year-break choreography           |
| Breaking Year       | 45 lb return gate, final fuel/HP/stamina consequence, escort/extraction state                                                                                                                                 | Sorrel follower AI, collapsing weather/timeline, movement dialogue and disconnect recovery         |

For each unfinished row, test the complete interaction family in one warm
browser batch: success, failure, recovery, UI/vitals feedback, authoritative
state change, reward/inventory effect, and quest advancement. Seed or warp to
the start of each unfinished section; never replay already-passing portal,
save, or earlier quest chains merely to reach it.

## Layer 2 — browser E2E (needs the local stack)

Start the stack exactly as `NATIVE_ECS_BROWSER_E2E_RUNBOOK.md` describes, then
run these flows in one warm-stack campaign. Keep one Chromium context active at
a time for memory safety, but collect and fix the campaign's failures as a
batch instead of rebuilding or restarting after each failed assertion. Gaia
and Anima stay disabled unless a step says otherwise.

Before the first dungeon campaign on an older warm snapshot, run the Elsewhen
terrain preflight from `TESTING_FASTER.md`. All 109 stable Chapter 1 terrain
shards must exist in Native ECS (`create: 0`, with zero missing for each
dungeon), while WorldMetadata must stop at the ordinary Harthmere edge
(`portalOnlyWorldBoundary: true`). Current boots reconcile missing immutable
dungeon shards without advertising the detached Elsewhen band as continuous
world terrain or rewriting pre-existing terrain.

### 1. Ignition

Complete Muck vs. Machine. Confirm:

- the `ch1-ignition` cutscene plays and the robot's optic focuses on the player
- the artifacted playback is the **player's own voice bank**, not a generic NPC
- the `Recovered` journal tab appears, empty, reading "Nothing yet."
- AUGUR-9 becomes a persistent follower-capable NPC, not a quest prop

### 1a. Delegated UI and Jobs Board ownership

Run these in the same non-fail-fast Chapter 1 campaign:

- Finish Doc's examination. The final handoff must say **Press J to open
  BiomesUI, then select MEM — Recovered** and must not contain `Next task:`.
- Inspect the progress response for `open_the_tab`: `targetPosition` is absent,
  `showNavigationAid` is false, and `withinRange` is true. No Chapter 1 world
  prompt or map marker is allowed.
- Confirm the HUD `J` control is visibly highlighted. Press real `J`, confirm
  the `MEM — Recovered` tab is visibly highlighted, click it, and require the
  signed native step to complete.
- At `take_jobs`, open the physical Grove Jobs Board through its real world
  prompt. Require `data-chapter1-jobs-board="take_jobs"`, exactly two tabs
  (`Chapter 1 Jobs`, `Accepted`), and only the three authored Grove titles.
- Complete and turn in the three normal job objectives. Repeated copies,
  generic jobs, jobs completed before the quest, and another actor's jobs must
  not satisfy the `3/3` requirement.
- Repeat with six accepted generic jobs already active. All three authored
  Chapter 1 jobs must remain visible/acceptable; a seventh generic job must
  remain blocked by the regular seeker limit.
- After the objective advances, reopen the board and confirm its ordinary tabs
  and generic catalogue return.
- Trigger the AUGUR-9 recharge-without-item error and require **The Bull's
  Core**, never `item_bulls_core`. Search all rendered Chapter 1 text for raw
  `item_`, `frag_`, and `ch1_` tokens.
- For every `talk_npc` and `dialogue_choice` phase, require a safe integer
  `targetEntityId` matching the visible authored NPC. Open the production
  `talk_to_npc` modal directly and require the Chapter 1 dialogue, choice, or
  signed completion. No normal flavor text, helper quest, business action, or
  unrelated accepted quest may appear. Repeat this for every dynamic testimony
  and Three Answers route stop.
- For all fifteen plot items, require both evidence forms: (1) a normal
  reverse-camera screenshot showing the live grip context, and (2) generated
  front/left/right detail frames with non-item player meshes temporarily hidden
  but the exact live `itemMeshInstance.three` retained. Visually reject repeated
  sleeve/body silhouettes even when mesh counts and bounds pass. Expected live
  silhouettes after the Chapter 1-only presentation multiplier are roughly
  12–21 cm; use Blender MCP to inspect source dimensions before editing assets.

### 2. Portal visual

Preview each gate without walking there:

```text
/at/520/73/-205/-0.15/0.1?hideChrome=1&allowSoftwareWebGL=1
```

Verify against `ch1_fracture_gate_material.ts`:

- silhouette is a **vesica** (two arcs meeting at points), not a circle
- the interior scrolls **inward**
- the rim shows chromatic split (red/blue edges diverge)
- the centre stays genuinely dark — if it looks additive and friendly, the
  blending mode has regressed
- the epilogue gate (`ch1_gate_prime`, `instability: 1.0`) is visibly worse
  than the two the player walked through
- the fence-line seam closes on its own at 90 s and does not flicker

### 3. Dungeon entry and the Elsewhen band

- attempt entry under-provisioned → blocked, with a checklist naming every
  missing line and which Grove NPC supplies it
- provision fully → warp lands on the slot arrival inside the band
- **exploit check**: try to reach the band by walking, flying, warpstone, and
  a stale saved position. All four must fail; the void gap has no terrain and
  `ch1AdmitToElsewhen` evicts to `[496, 71, -126]`
- confirm no terrain shard exists between X 2560 and X 2624

### 4. Dungeon interiors

For each of the 23 volumes:

- floor is solid, walls are solid, enclosed rooms have a ceiling
- open-air volumes have sky
- every doorway is passable without jumping or crouching
- stairs walk cleanly up and down; no jump required (recipe Step 5 checklist)
- water renders in the water pass and appears in generated map tiles
- props are supported and none floats
- enclosed zones are navigable on their authored light plus carried torches
- **escort check**: an NPC follower can path the full route. This is the one
  that needs Anima enabled.

### 5. Puzzles

- **Hall of Weights**: modern instruments must visibly disagree; the temple
  balance beam must resolve; solving unlocks `ls_field_calibration` and the
  ninth-paper playback, and the playback must cost AUGUR-9 core charge
- **Ashline containment**: 45 s timer, expert UI with no tutorial, four stages;
  let it time out once and confirm the player's hands finish it rather than
  failing; all four "how did you do that" replies are variations on _I don't
  know_

### 6. The climax

- the handover is a **player inventory action** with a confirmation prompt
  naming the oath; "Not yet" must be accepted indefinitely with no timer
- the consolidation sequence rewrites six ledger entries, ~4.5 s each, input
  locked, accessibility skip available after 10 s
- the corridor revision must reuse the **exact Act 3 shot list** — diff the two
  captures; if a camera angle changed, the fair-play contract is broken
- the Card renames to `Custodian Key 7` on screen
- verify no client payload carried a fragment `truth` value at any point
  (network tab, `/api/harthmere/*`)

## Layer 3 — capture evidence

Record the two scenes that carry the chapter:

```text
/at/535/78/-155/-0.15/0.1?hideChrome=1&allowSoftwareWebGL=1&cutsceneVideo=ch1-recon-corridor&videoFps=30&videoRun=1
/at/535/78/-155/-0.15/0.1?hideChrome=1&allowSoftwareWebGL=1&cutsceneVideo=ch1-consolidation-revision&videoFps=30&videoRun=1
```

Contact-sheet both before encoding. Reject the take if the opening is blank,
the camera is inside terrain, or a ghost stands in for a bound actor.

## What is deliberately not automated

- **Whether the player feels complicit rather than cheated at the handover.**
  That is the one thing that decides whether the chapter works, and it needs
  real playtesters. If they report feeling tricked, the fix is to strengthen
  Lou's argument, not to weaken the confirmation prompt.
- **The buried surname in Act 5.** Target is a ~10–15% catch rate on
  headphones. Needs human ears at a real mix level.
