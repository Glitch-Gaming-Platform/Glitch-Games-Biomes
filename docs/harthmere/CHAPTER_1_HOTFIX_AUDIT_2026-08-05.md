# Chapter 1 hotfix audit — August 5, 2026

**Scope:** the reported Core Cell/map-marker block, apparent AUGUR-9 rename or
quest skip, Jackie interaction ambiguity, cutscene motion/cleanup/regional
music, physical presentation of every Chapter 1 plot item, Recovered/Journal
wayfinding, player-readable labels, and Chapter 1 ownership of the Jobs Board.

**Verdict:** the focused product defects are fixed and have focused live proof,
but Chapter 1 is **not yet fully signed off on the final combined artifact**.
The complete 31-quest/80-objective progression and a clear front-facing visual
review of all fifteen held items remain final-artifact acceptance work.

This document supplements
`CHAPTER_1_PRODUCTION_AUDIT_2026-08-03.md`. It does not convert a focused
hotfix pass into a full production-ready verdict.

## What the supplied HARs showed

### Core Cell and the misleading marker

The Core Cell was not absent. The first HAR showed:

1. `gather_parts` completed;
2. the server granted `item_augur9_core_cell`;
3. the item existed in the player's inventory/hotbar;
4. the next objective was `seat_the_core`, targeting AUGUR-9 near
   `[524, 69, -154]`.

The player followed an older unrelated map destination that survived the
objective transition. It was not a marker for a loose Core Cell in the world.

The corrected player-facing sequence is now explicit:

1. Finish the materials step with Luis.
2. Luis puts the Core Cell in the player's pack.
3. The HUD changes to **Install the Core Cell**.
4. The story handoff replaces an older unrelated pin with AUGUR-9's pin.
5. Approach AUGUR-9 and press `F` to install the cell.

Focused live proof:
`artifacts/harthmere-native-ecs-e2e/1785943737925-36677-report.json`.
The report passes the real grant, HUD/map-pin handoff, and `seat_the_core`
completion.

### No quest skip and no robot rename

The second HAR showed the normal sequence:

- `seat_the_core`;
- `first_log`;
- `walk_the_waterline`.

AUGUR-9 remained the same entity. `Kelm Void` was a generated shop customer,
not a renamed robot. Future diagnosis must correlate labels with entity ids and
the active Chapter 1 challenge before treating an unrelated generated NPC as a
story identity change.

### The Journal marker was routing to the wrong kind of interaction

`journal.har` and `journal_2.har` proved that `open_the_tab` was projected as a
physical `Journal` target with a map marker and range check. The marker led to
the fountain lesson-board area, where a generic `F Read` prompt could appear
without a visible journal item. The player then had to discover BiomesUI and
the `MEM — Recovered` tab independently.

The hotfix makes the ownership explicit:

- the objective reads **Press J to open BiomesUI, then select MEM — Recovered**;
- it publishes no world target and no map marker;
- the HUD's `J` control is persistently ring-highlighted while the step is
  active;
- after BiomesUI opens, `MEM — Recovered` receives a persistent arrow and
  caption;
- mounting the real Recovered tab completes the authenticated native objective;
- no generic world `F` event can complete this UI-owned step.

The supplied HAR also proved that the old physical Read interaction completed
at 19:06:58 and immediately advanced to `take_jobs` at 19:07:00. That was not a
missing prop problem to solve in Blender; it was an interaction-surface bug.

### Chapter 1 now owns the Grove Jobs Board at the correct step

The Jobs Board HAR contained the full generic catalogue while `take_jobs` was
active, including bounties, escorts, deliveries, business work, and the three
Grove jobs intended for Chapter 1. During this step the board now renders only:

1. **Stock the Road Rations Crate**;
2. **Patch the Safe-Zone Fence**;
3. **Clear the Muckwad Patch**.

The panel exposes only `Chapter 1 Jobs` and `Accepted`; posting, safety, and
generic work are hidden until Chapter 1 releases the board. The auto-seeder
primes all three authored templates before generic Grove work. Progress counts
only distinct completed authored templates accepted by this actor after the
quest began, so unrelated, repeated, old, or another player's jobs cannot
advance the chapter.

Chapter 1 jobs also have a separate three-job acceptance allowance. Six
already-active regular jobs no longer make the Chapter 1 panel empty or cause
its authored work to fail the generic seeker cap; the ordinary six-job limit
continues to apply independently to regular work. Only real town auto-postings
with the exact authored template ids qualify, so a player-created posting that
copies an internal template id cannot enter this lane or count toward progress.

### Internal identifiers are not player copy

The second HAR returned the literal failure `You do not have
item_bulls_core.` after the player tried to recharge AUGUR-9. That path now
returns **You do not have The Bull's Core.** Known Chapter 1 item and memory ids
resolve through their authored names before generic identifier prettification,
and the Recovered/Jobs Board surfaces render human labels while retaining ids
only in non-visible data attributes and mutation payloads.

### Jackie was at two coordinates in two authorities

The third HAR showed the Chapter 1 stage placing Jackie at the fence near
`[543, 69, -221]`, while the progress API replaced that target with Jackie's
shared home position near `[485.5, 70, -140.5]`. The player could reach the
visible story body yet miss the interaction-distance test. Generic accepted
quest dialogue could then appear instead of Chapter 1.

The repair applies to all Chapter 1 objective targets:

- staged story NPCs use their authored per-objective position;
- live entities such as AUGUR-9 use their current ECS position;
- the HUD marker, visible staged body, distance check, and `F` interaction use
  the same authority;
- generic Talk on the current Chapter 1 target routes into the Chapter 1
  interaction instead of opening an unrelated accepted quest menu.

The final catalogue sweep found that positional authority alone was not enough:
several `talk_npc` and `dialogue_choice` steps still had no canonical
`targetEntityId`. All 30 NPC dialogue/choice phases now bind the exact entity,
including dynamic testimony and Three Answers stops, reused Grove NPCs, and
Iris, Sorrel, and Hallr inside the Elsewhens. The stock NPC modal and the global
`F` dispatcher use one shared ownership predicate. The live quest runner opens
the ordinary `talk_to_npc` modal for every one of those phases; normal flavor
text, a helper quest, or another accepted quest winning instead of Chapter 1 is
a row failure.

Focused live proof:
`artifacts/harthmere-native-ecs-e2e/1785946881464-55310-report.json`.
The runner deliberately retained the accepted Road Signs quest, approached the
staged Jackie, pressed the real Talk key, and confirmed that the unrelated
Road Signs action was not offered as Jackie's Chapter 1 dialogue.

## Source repairs

### Objective and marker authority

- `src/shared/harthmere/ch1_quests.ts` gives the Core Cell handoff explicit
  pack/AUGUR-9 wording.
- `src/shared/harthmere/ch1_objective_targets.ts` supplies the explicit
  **Install the Core Cell** action and declares authored versus live-entity
  position authority.
- `src/pages/api/harthmere/chapter1_progress.ts` preserves authored staged
  positions rather than replacing them with the shared ECS home.
- `src/client/components/biomes_ui/adapters/mapPinnedDestination.ts` lets a
  Chapter 1 story transition replace a stale unrelated destination.
- `src/client/components/challenges/Chapter1NativeObjectivePrompt.tsx` and
  `TalkToNPCScreen.tsx` share the same Chapter 1 interaction route.
- `src/shared/harthmere/ch1_interaction_surfaces.ts` owns the common NPC-modal
  precedence rule, and the objective-target audit rejects any Chapter 1
  `talk_npc`/`dialogue_choice` step without a canonical entity.

### Cutscene smoothing, cleanup, and music

- `src/shared/cutscene/ch1_scenes.ts` fades the opening shot and uses bounded
  blends instead of abrupt interior hard cuts.
- `src/client/game/scripts/cutscene_director.ts` clears the player's cinematic
  emote/expression during every exit path and immediately requests regional
  music from the visible player position.
- `src/client/game/scripts/audio.ts` restores the Grove theme while the player
  is in the Grove, including the Mucky fence sample, unless a higher-priority
  protected state such as combat owns audio.

All sixteen registered Chapter 1 scenes entered the production director in
`artifacts/harthmere-native-ecs-e2e/1785946983345-56318-report.json`. The first
gate row deliberately seeded `shock`, stopped the scene, and observed both
`emoteType: undefined` and `currentTrack: grove_music`.

That report's final status is red only because replacing/stopping scenes
aborted an in-flight regional MP3 request. The sixteen-scene product scenario
itself passed. The runner now classifies that exact cutscene music transition
as transient; other same-origin audio failures remain fatal. A clean
final-artifact report is still preferred for release evidence.

### Chapter 1 plot-item presentation

The first exact-artifact 15-item batch passed attachment and finite-bounds
assertions, but human review rejected the frames: Core Cell, The Bull's Core,
Case Notes, Grey Card, and the rest were hidden by the same sleeve silhouette.
Structural report:
`artifacts/harthmere-native-ecs-e2e/1785970495767-26663-report.json`.
This was not missing Blender content. Background Blender MCP inspection of
`src/galois/data/items/harthmere_chapter1_items.blend` confirmed 15 distinct,
metric, multi-part, multi-material props with source dimensions around 3–16 cm.
The generic meter-to-voxel plus avatar-socket transform reduced them to roughly
4–7 cm live bounds and tucked them inside the hand mesh.

The grouped source hotfix now applies a Chapter 1-only 3× world-presentation
multiplier, targeting readable 12–21 cm voxel-world silhouettes without
rewriting the GLBs or changing inventory icons. The normal reverse-camera frame
still proves grip context. The generated front/left/right detail frames also
hide only non-item player meshes while preserving the exact live attached item,
so a sleeve can no longer satisfy visual acceptance.

All fifteen plot items now have Blender-authored physical meshes:

- source: `src/galois/data/items/harthmere_chapter1_items.blend`;
- runtime GLBs: `public/assets/harthmere/glb/items/chapter1/`;
- catalogue: `src/shared/harthmere/ch1_item_visual_assets.ts`;
- loader: `src/client/game/resources/item_mesh.ts`.

The local player renderer previously treated an actionless plot item as the
ACL helper's default `destroy` action. In a protected region that suppressed
the held attachment before its GLB was requested. Chapter 1 display-only items
are now allowed through the presentation path without granting a gameplay
action.

Live evidence:
`artifacts/harthmere-native-ecs-e2e/1785948216208-67039-report.json`.
Its product scenario passed:

- 15/15 generated inventory icons loaded at non-zero dimensions;
- 15/15 exact selected item ids reached the live hotbar resource;
- 15/15 authored held meshes attached to the player;
- each attachment contained 4–8 rendered mesh parts.

The overall report is red because a recovered stale-wakeup bootstrap emitted
one `ERR_CONNECTION_CLOSED`. A later attempt to recapture the items with the
front-facing reverse camera failed during visual authentication after the app
was replaced; it has zero gameplay coverage. Therefore the attachment path is
proved, but a clear front-facing visual review of all fifteen items remains an
open acceptance item.

The follow-up runner no longer points a fixed close camera at the avatar's
torso. For each selected item it now traverses the live attached GLB, computes
finite world-space bounds from geometry corners and `matrixWorld`, and creates
an item-specific front/left/right cutscene centered on that box. Each report row
records the mesh/vertex counts, bounds, fitted radius, target, and three camera
positions. This is a test-only hotfix and needs no application rebuild. If a
bounds-framed item is still tiny, clipped, inverted, or off-hand, the evidence
now justifies a scoped Blender source repair for that item rather than another
camera guess.

The August 6 front/left/right review then found a second real shared defect.
Fourteen items reached their exact live attachments with distinct, enlarged
silhouettes, but every detail frame was flat white. The failed-only Iris Button
run proved the same condition in the renderer: all six attached meshes had
`RawShaderMaterial.baseColor = [1, 1, 1]`. Blender/GLB inspection simultaneously
proved that every exported file retained multiple authored non-white
`pbrMetallicRoughness.baseColorFactor` values. The models were therefore not
rewritten. The Chapter 1 item loader now resolves each loaded Three material's
canonical GLTF material index and carries that GLB base-color factor into the
Biomes base-pass material. This is one shared client hotfix for all fifteen
items.

The initial all-item report is
`artifacts/harthmere-native-ecs-e2e/1785976699730-65723-report.json`. It stopped
at Iris Button because the short test-only review scene auto-ended while the
runner waited on a stale fade-overlay opacity. The runner now uses longer
software-WebGL-safe shots with no evidence-free opening fade. The Iris-only
rerun passed cleanly at
`artifacts/harthmere-native-ecs-e2e/1785978123734-74499-report.json`; that report
also records the white runtime material uniforms that justified the loader
repair. A post-compile all-item color review remains required.

Blender preview:
`artifacts/harthmere-native-ecs-e2e/chapter1-blender-held-items-preview.png`.

## Source and runtime gates completed

- Chapter 1 preset: 561 passing plus the production seed gate.
- Cutscene preset: 200 passing.
- Audio tests: 33 passing.
- Held-item/player-attachment focused batch: 7 passing.
- All fifteen Blender assets passed catalogue, bounds, material, and compound
  geometry checks.
- Scoped TypeScript checks passed.
- Runner syntax and `git diff --check` passed.

The August 5 Journal/Jobs Board interaction batch adds:

- `tsconfig.ch1interactions.json`: passed with an 8 GB Node heap and persisted
  incremental build info;
- `tsconfig.ch1check.json`: passed;
- `tsconfig.ch1renderer.json`: passed;
- 137 consolidated Chapter 1 authority/wording/readability/Jobs Board tests:
  passed;
- four static Jobs Board mode/navigation tests: passed;
- 23 native-ECS runner contract tests, including live mesh-bounds item framing,
  NPC modal precedence, and item-detail isolation:
  passed;
- native E2E runner syntax and scoped `git diff --check`: passed.

The August 6 item-color follow-up adds:

- ten focused item/runner tests: passed;
- `tsconfig.ch1renderer.json`: passed after adding the item loader/helper to
  the scoped graph;
- native-ECS runner syntax and scoped `git diff --check`: passed;
- Blender/GLB material audit: all fifteen files retain two or more authored
  materials and at least one non-white canonical base-color factor.

Final live item evidence is the r3 all-item report
`artifacts/harthmere-native-ecs-e2e/1785984861600-27340-report.json` and its
front/left/right contact sheets. All fifteen selected item ids reached the real
player attachment, produced non-empty live bounds and three review angles, and
retained two to five distinct canonical material colors. `whiteOnly` and
`canonicalMissing` are both empty. Human contact-sheet review confirmed every
silhouette is visible at the intended presentation scale, so the earlier
structural-but-white r1/r2 reports are diagnostic history rather than release
evidence.

The checkpointed live quest campaign passed all **31 quests / 80 objectives**.
Evidence is split intentionally so already-green objectives were never
replayed after a later transition or harness defect:

- `1785986025607-32950-report.json`: opening through
  `ch1_a2_q01_the_ledger_opens/sit_for_doc`;
- `1785986992849-37379-report.json`: `open_the_tab` through
  `ch1_a2_q02_work_the_board/meet_the_suppliers`;
- `1785987821772-41381-report.json`: testimony, deduction, and Greenlamp;
- `1785988527163-44169-report.json`: examination through the Dune Threshold;
- `1785990311475-54975-report.json` and
  `1785990639175-55686-report.json`: Salt Market and Cistern Stair;
- `1785991077454-57156-report.json`: Hall of Weights through Iris;
- `1785992722666-67530-report.json`: the real 400-metre Long Walk escort;
- `1785992934709-68058-report.json`: Three Days through Read the Letter;
- `1785993869524-71257-report.json`: winter provisioning, Rook's Rope, and the
  Ice Shelf;
- `1785994090975-71663-report.json`: Longhouse through the Oath;
- `1785994381920-72256-report.json`: final 13 objectives, 67 retained passes,
  aggregate `questCount: 31`, final status `pass`, and zero browser failures.

The campaign exposed and verified two active-pin product defects. Quest-level
fallback anchors reuse one marker id, so id-only dedupe left Cross the Dunes
active after native ECS/HUD advanced to Salt Market. Later, the Long Walk's
async navigation aid resolved after an initial player-position fallback, but
id, label, and step were unchanged, so the wrong coordinates persisted. Pins
now carry quest/step ownership and refresh on step, label, or X/Z destination
change. The exact client artifact `warm-20260806044501` passed the remaining
campaign; app restart count was zero, Redis was retained, and no image rebuild
or Redis/Anima reset was used.

The final campaign also corrected acceptance infrastructure without weakening
product gates: valid vendor bundles repeat until winter counts are met; failed
focused actors release only their own dungeon lease; required escorts travel
under real Anima authority with the server's exact 22-metre arrival rule; and
terrain-resolved pins use the existing 3.25-metre safe-warp tolerance.

Do not replace those scoped checks with `tsc -p tsconfig.json` on this working
tree. The full graph exhausted Node's default 4 GB heap after roughly eleven
minutes without reporting a source error. Use the focused configs first and
reserve the full graph for a properly provisioned release lane.

The focused held-item proof used
`warm-ch1-held-items-hotfix-20260805-r1`, produced with one Next-only compile
and an app-only remount. Server artifacts, Redis, and Anima were not rebuilt or
replaced for that Chapter 1 refresh.

The later combined build `warm-combat-final-hotfix-20260805-r1` finished
healthy with app restart 0/OOM false, retained Redis `PONG` and DBSIZE 338827,
and Anima `/ready=OK`. The user requested immediate wrap before post-build
Chapter 1 browser acceptance, so that build health is not a Chapter 1 gameplay
pass.

## Report-classification rules

Do not flatten every red report into a product failure:

- A scenario that completed all product assertions before a known cleanup
  cancellation is focused product evidence, but the report is not a clean
  release pass.
- Failure during auth, bootstrap, disconnect, or app replacement before the
  scenario begins has zero product coverage.
- A screenshot showing the back of the avatar while an attachment exists is
  structural renderer proof, not sufficient visual-quality approval.
- Do not rerun against an artifact already known to be stale. Wait for the
  exact combined artifact and rerun only the affected acceptance groups.
- Keep groups non-fail-fast: collect all item, quest, cutscene, gate, terrain,
  and cast failures before repairing the batch.
- The current host Redis fixture bridge is
  `biomes-prod-smoke-redis-forward` at `127.0.0.1:6493`. The first final-artifact
  attempt stopped at the retired `6390` default before opening Chromium; it had
  zero product coverage. The runner and fast guide now use `6493`, matching the
  other current Harthmere live runners.

## Final-artifact acceptance

Before changing the production verdict, complete these on one exact final
combined artifact:

- [x] Run the complete 31-quest/80-objective progression in checkpointed
      non-fail-fast batches; final aggregate is 31/80 with zero browser failures.
- [x] Capture all fifteen held items from a clear front-facing third-person
      angle and visually approve scale, orientation, silhouette, and grip.
- [x] Preserve retained cutscene/gate/terrain/cast passes and use one final
      item report plus the objective checkpoint chain instead of replaying
      unaffected groups.
- [x] Prove `open_the_tab` has no world marker, highlights `J` and `MEM`, and
      completes only after the real Recovered tab opens.
- [x] Prove the live Grove Jobs Board shows only the three authored Chapter 1
      jobs during `take_jobs`, then returns to normal after progression.
- [x] Search rendered Chapter 1 text and mutation errors for raw `item_`,
      `frag_`, or `ch1_` identifiers.
- [x] For all 30 NPC dialogue/choice phases, enter through the normal NPC Talk
      modal and require Chapter 1 dialogue/choice to replace ordinary flavor
      text and unrelated quest actions.
- [x] Require app, Redis, and required Anima worker to finish with zero OOM
      kills and zero unexpected restarts.
- [x] Close all Playwright/Chromium processes and explicitly release shared
      artifact/browser ownership.

## August 6 Grove acceptance reopening

The later player HAR/screenshots and the focused live reruns invalidate the
blanket “functional acceptance complete” verdict above for the Grove jobs and
supplier slice. Preserve the earlier 31-quest checkpoint reports as historical
coverage of unaffected objectives, but do not use them to sign off these newly
exposed paths.

Two exact live failures were reproduced:

- `artifacts/harthmere-native-ecs-e2e/1786046681162-37500-report.json`:
  the semantic Muck Rake and Wooden Hoe presentation donor were present in the
  shipped client, but protected-region ACL handling removed the selected tool
  before `itemAttachment.itemMeshInstance.three` existed;
- `artifacts/harthmere-native-ecs-e2e/1786047638912-66886-report.json`:
  Chapter 1 state correctly named `Rin the Forager` and returned Rin's exact
  position/entity, while the world map and minimap retained the generic
  `Meet the Suppliers` pin at `[510, 73, -155]`.

The grouped source hotfix now:

- preserves Muck Rake and Repair Mallet held meshes in protected regions while
  leaving the normal action permission/server validation intact;
- publishes an exact `chapter1_route:*` destination for every current stop in
  `meet_the_suppliers`, `collect_testimonies`, and `the_three_answers`, and
  prevents the generic native quest auto-anchor from overwriting it;
- uses the authored Wooden Hoe donor for the Muck Rake instead of Muck Buster;
- upgrades focused Jobs Board E2E so cleanup and repair require a selected
  native tool, non-empty held mesh, visible field F prompt, server interaction
  receipt, completed todo, board-return marker, turn-in, and native-wallet
  reward; and
- upgrades supplier E2E to perform six real NPC-dialogue vendor transactions
  and verify the map and minimap advance after every transaction.

Focused source evidence after the reopening:

- 110 held-item, map-route, Chapter 1 prompt, Bikkie presentation, and job
  objective tests passed;
- 36 Chapter 1/native browser-runner contract tests passed;
- all Jobs Board native-ECS static contracts passed, including non-fail-fast
  focused cleanup/repair selection and field-use evidence. The final focused
  lane now also starts without each tool, buys it through the real business
  Shopfront, verifies the vendor marker returns to the field target, equips the
  backpack purchase through Inventory, and then proves visible field use;
- `tsconfig.ch1check.json` and `tsconfig.ch1renderer.json` passed;
- runner syntax and scoped `git diff --check` passed.

Remaining live acceptance is intentionally narrow and must run on the source-
coherent final client artifact:

- [ ] six real supplier transactions, each with exact world-map and minimap pin
      progression;
- [ ] Muck Rake front/left/right held-model visual approval;
- [ ] `town_repair_fence` and `town_cleanup_muck_patch` together, non-fail-fast,
      through real vendor purchase, marker return, hotbar equip, field use, and
      final reward.

Current status: **Grove Chapter 1 source hotfixes are focused-green; final live
supplier/tool acceptance is reopened and pending.** Boss-marketing still
composition remains tracked separately in
`docs/harthmere/BOSS_MARKETING_SCREENSHOTS.md`.

## August 6 wrap handoff

The user ended this work before another artifact refresh or browser batch. Do
not convert the source-green verdict above into a live-pass claim.

Final source additions in this task:

- focused repair/cleanup E2E now starts without the required tool, requires the
  exact vendor marker, buys the Muck Rake or Repair Mallet through the real
  business Shopfront, verifies the marker returns to the field objective,
  equips the backpack purchase through Inventory/Hotbar 1, requires a visible
  held mesh, performs the real field `F` interaction, and still requires todo
  completion, board return, turn-in, and native-wallet reward;
- the all-jobs static release contract requires that real purchase/equip/use
  path, so a fixture grant or attached mesh alone cannot satisfy acceptance;
- the fast-testing guide records the same rule and retains non-fail-fast,
  two-job batch execution.

Final focused checks run after those additions:

- 110 held-item, dynamic-route, Chapter 1 prompt, Bikkie presentation, and job
  objective tests passed;
- 30 Chapter 1 native browser-runner contracts passed;
- all Jobs Board native-ECS static contracts passed;
- runner syntax, Prettier, scoped TypeScript checks, and scoped diff checks
  passed.

Runtime/artifact disposition at wrap:

- mounted app build: `warm-20260806191329`, healthy, restart count 0, not OOM
  killed, root HTTP 200;
- the mounted build predates the final held-tool, dynamic-route, Muck Rake
  presentation, and real tool-purchase acceptance source, so it is not a valid
  final artifact for these gates;
- mutable-hotfix support returned `mutable_hotfix_disabled`; no mutable client
  manifest was applied or persisted by this task;
- no new build, app remount, Redis mutation, Anima mutation, or browser launch
  was performed after the user's wrap directive; ownership was explicitly
  released.

Only these affected live gates remain for a later task. Previously passed
Chapter 1 rows should not be replayed:

1. Continue the supplier route from the already-live-green Rin evidence and
   prove the remaining named suppliers (including Gus) through real trade, with
   exact world-map and minimap progression after each transaction.
2. Approve the equipped Muck Rake from readable front/left/right gameplay
   angles and require the model to remain visible in protected regions.
3. Run `town_repair_fence` and `town_cleanup_muck_patch` together,
   non-fail-fast, through real purchase, marker return, hotbar equip, visible
   tool use, server receipt, turn-in, and reward.

Status at handoff: **source and focused contracts pass; final affected live
acceptance is incomplete because the user requested immediate wrap before a
source-coherent client artifact and bounded browser reruns were produced.**

## August 7 latest-image attempt

Registry ordering identified
`glitchgames.azurecr.io/biomes-node:prod-50b9f486-asset-boundary-r2` as the
latest image at the time of the attempt (digest
`sha256:facaf6368667ec1c302e8fd7f542006bcc510c0d15c2f91eb559763d6a6fa358`).
It superseded `prod-50b9f486-retaliation-r1` and natively included the two
bucket assets that the older image omitted.

The intended supplier-only command was nevertheless setup-invalid: it set the
Chapter 1 resume and stop checkpoints but omitted
`HARTHMERE_E2E_CHAPTER_1_FEATURES=quests`. The runner therefore entered the
independent full held-item/cutscene feature matrix and created 61 partial PNGs
with prefix `1786063933379-97830`. PID 97830 and its Chromium group were stopped
once the scope error was identified. Those files have zero supplier acceptance
value and are classified in
`artifacts/harthmere-native-ecs-e2e/asset-boundary-r2-final/INTERRUPTED.json`.
The Muck Rake and repair/cleanup rows were not started afterward.

At explicit runtime release, no browser process or browser lease remained.
Redis was healthy (`PONG`, DBSIZE 340201, restart 0, OOM false), and exact-image
Anima remained ready/restart 0/OOM false. The app lifecycle was healthy, but a
concurrent artifact change had mounted host `.next`, `dist`, and `public` with
BUILD_ID `warm-audio-fps-20260807-r1`; therefore the final app state was no
longer image-native and cannot be cited as `asset-boundary-r2` acceptance.

Verdict remains unchanged: **the three affected live gates are still pending.**
