# Grove Quest Audit Pause Report — August 7, 2026

## Purpose

This report pauses the Grove quest implementation effort and states, without
credit inflation, what has been changed, what has actually been proved, what
has not been proved, why the work took too long, and how the next run must
cover all 51 Grove quests in one disciplined acceptance pass.

The governing distinction is:

- source code present is not a passing quest;
- a unit test is not a browser interaction;
- a live-authority reducer pass is not visual proof;
- an automated screenshot existing is not human visual approval;
- a quest that passed an older candidate is not automatically green on the
  current candidate.

## Executive verdict

As of the pause:

| Evidence level | Honest status |
| --- | --- |
| Catalog/source enumeration | 51/51 quests represented |
| Fast live-authority catalog | 51/51 passed in the prior authority lane |
| Current fast source/unit suites | `grove`: 100 passing; `quests`: 310 passing, 1 pending |
| Slow physical browser quests ever exercised | 8/51 |
| Slow automated lifecycle completions on any historical candidate | 4/51 |
| Slow automated lifecycle completions on the latest completed v11 batch | 1/51 (`sticky_medicine`) |
| Human-approved, current-candidate visual completions | 0/51 |
| Quests never exercised by the slow physical browser lane | 43/51 |

The latest runner completed `sticky_medicine`, but the sample screenshots have
not all received a human presentation-quality sign-off, and earlier frames
were dark or poorly framed. Therefore the defensible human visual count is
zero, not one.

The four historical automated completions are:

- `painted_path_language` — stale relative to later hotfix changes;
- `safe_sparring_not_pvp` — stale relative to later hotfix changes;
- `lost_found_and_mail` — later regressed/followed a different event path;
- `sticky_medicine` — completed in the latest v11 batch, but visual quality is
  not yet human-approved.

## Exact pause point

The retained local candidate is:

- Web: `http://127.0.0.1:3017`
- Sync: `http://127.0.0.1:4907`
- container: `biomes-prod-smoke-app`
- build ID: `warm-grove-quest-audit-20260807-r2`
- Redis: `biomes-prod-smoke-redis`

Iteration after the retained r2 candidate used the mutable client hotfix rather
than rebuilding Next.

`grove-quest-client-hotfix-2026-08-07.js` was advanced to v12 immediately
before this pause. Its exact authored-event bridge and Cloud repair backoff are
unverified and receive no pass credit in this report.

No implementation or browser run should resume until the acceptance method in
this report is adopted.

## What was accomplished

### 1. A real 51-quest catalog boundary now exists in the fast lane

The fast Grove suites now exercise shared catalog topology, waypoint
resolution, giver mapping, trigger shape, map-pin behavior, and live-authority
progression rather than validating only the originally reported quests.

Latest completed fast results before the unverified v12 edit:

- `scripts/harthmere/t.sh grove`: 100 passing;
- `scripts/harthmere/t.sh quests`: 310 passing, 1 pending;
- focused Grove runtime validation: 33 passing;
- cooking backend: 9 passing;
- Grove hotfix contract: 1 passing;
- tutor prompt UI: 2 passing.

Earlier aggregate evidence also included a `grove:live` lane whose eight test
cases iterate all 51 quest definitions and a broader gate with 541 passing and
1 pending. Those aggregate gates must be rerun after the candidate is frozen;
they are not final release evidence for v12.

### 2. Shared map-pin and guidance behavior was repaired in source

Implemented source behavior includes:

- exact current-objective Grove map pins instead of generic native fallbacks;
- prevention of a native quest writer clearing the active Grove-owned pin;
- production terrain placement resolution for Grove markers;
- action-specific HUD guidance instead of pulsing Bag because prose contains
  words such as “item,” “sample,” or “root”;
- prompt replacement/cleanup after the objective advances;
- map-panel ordering that keeps the current Grove action visible above a long
  native objective panel;
- at most two visible quest offers from Rosalyn at one time.

### 3. Reported quest-specific source defects were addressed

#### Paint Knows Where Eyes Go

- marker and step routing were repaired;
- the objective completion path was corrected so unperformed steps are not
  presented as complete;
- it completed in two older slow browser reports;
- it has not been rerun on the current candidate, so its current status is
  stale, not green.

#### Sparring Is a Promise

- the practice dummy was moved outside the protected Grove combat area;
- the objective now expects real positive combat evidence;
- a Blender-authored softwood practice dummy asset is present;
- it completed in two older slow browser reports;
- it has not been rerun on the current candidate.

#### Nothing Useful Stays Lost

- HUD target highlighting and cleanup were implemented;
- the Mail and Bank Satchel interaction became physically reachable;
- a generic Cloud Save cursor repair was added after observing local/Cloud
  divergence;
- it completed on an older built-r2 report, but the latest v11 run stopped on
  objective 4 because the no-build hotfix emitted a generic event instead of
  the authored `item_grant` event shape;
- the v12 event bridge intended to repair that is untested.

#### Sticky Medicine

- the three samples now have distinct authored locations rather than sharing
  Doc's position;
- source positions are currently:
  - clean sample: `[503, 71, -148]`;
  - mucked sample: `[522, 71, -162]`;
  - sealed sample: `[505, 71, -160]`;
- separate Blender-authored clean, mucked, and sealed sample GLBs exist;
- the latest v11 slow browser run completed all objectives;
- visual framing and presentation still require human approval.

#### Samples for the Chapel

- the sealed sample has a dedicated position and mesh;
- the chapel stone maps to Father Aldren rather than an unrelated NPC;
- map-pin routing was repaired;
- the latest v11 run reached objective 3, then stopped because the retained
  no-build client required an authored `inspect_frame` event in addition to the
  signed world-object receipt;
- the v12 exact-event bridge is untested.

#### Kit's Heavy Parcel to the Crossroads

- a Blender-authored courier parcel stand exists;
- the interaction was moved into a reachable position and given a visible F
  prompt;
- a previous run completed the quest objectives but did not display the exact
  completion acknowledgement;
- a generic completion acknowledgement layer was added with Chapter 1
  precedence protection;
- the latest run never reached gameplay because the fourth fresh Chrome
  context timed out during local client bootstrap. This is setup-invalid, not a
  product verdict.

#### Carlo's Festival Skewers

- a Blender-authored festival skewer GLB exists;
- a stable native item/Bikkie overlay and campfire recipe path were added;
- the recipe was visible and could be queued at the campfire in a prior run;
- a backend defect was found where read-only cooking snapshots used the last
  persisted mutation time, leaving elapsed jobs permanently `cooking`;
- source now ticks cooking presentation with wall-clock time, with a regression
  test;
- the hotfix also promotes elapsed retained-build jobs to `ready`;
- the latest run never reached gameplay because the fifth fresh Chrome context
  timed out during local client bootstrap. The Ready -> Collect -> output ->
  quest progression path remains unproved end to end.

#### Jobs Board and charter board

- Jobs Board offer/turn-in UI and exact pin behavior were implemented;
- a Blender-authored guild charter board asset exists;
- Read the Jobs Board has been exercised repeatedly but has never completed a
  full slow browser row in the stored reports;
- the charter-board quest family has not received complete slow visual
  acceptance.

### 4. Chapter 1 dialogue ownership was repaired in source

Source behavior now gives Chapter 1 visible text precedence only when the
current Chapter 1 world projection targets that exact NPC and uses an NPC
interaction trigger. The normal Grove dialogue is expected to return when the
story moves away.

The retained-build hotfix also attempts to let the exact overlapping Grove
conversation observe compatible talk evidence without replacing the Chapter 1
words on screen.

This is unit-covered, but the complete physical overlap matrix across every
shared Grove/Chapter 1 NPC has not been run and visually approved.

### 5. New graphics and asset mappings exist

The following Blender-authored assets are present:

- `grove_festival_skewer.glb`;
- `grove_clean_root_sample.glb`;
- `grove_mucked_root_sample.glb`;
- `grove_sealed_muck_sample.glb`;
- `grove_courier_parcel_stand.glb`;
- `grove_guild_charter_board.glb`;
- `grove_softwood_practice_dummy.glb`.

The source Blender file is `src/galois/data/items/harthmere_grove_items.blend`.
Runtime mappings were added in `grove_item_visual_assets.ts` and
`grove_quest_visual_assets.ts`.

The files existing and loading is not enough. Their scale, lighting,
silhouette, camera framing, ground contact, and interaction alignment still
need a human-approved in-world frame.

### 6. The Fast Testing guide was materially expanded

`docs/harthmere/TESTING_FASTER.md` now records Grove-specific rules for:

- local production-shaped testing instead of public-site mutation;
- non-fail-fast batches;
- hotfix-first iteration on an already-built candidate;
- all-51 coverage rather than only bug-report quests;
- exact current-objective pins;
- full world-object interaction contracts;
- signed world-object receipts;
- Chapter 1 text/evidence coexistence;
- Cloud Save cursor repair;
- cooking wall-clock readiness;
- transient Grove/muck music request cancellation;
- separate fast authority and slow visual acceptance lanes.

## ECS, Gaia, Bikkie, and Galois assessment

The repository guidance establishes these boundaries:

- ECS stores dynamic state and applies authoritative transactions;
- Logic or a privileged service authorizes gameplay intent;
- Bikkie owns stable authored identity and shared definitions;
- Galois compiles/publishes assets referenced by content;
- Gaia owns continuous natural simulation such as farming, muck, water, and
  growth, not static tutorial props.

### Correct applications so far

- Quest progression, inventory, NPC identity, and current positions remain
  dynamic authority state rather than being put into Bikkie.
- Stable native item identities and shared skewer definitions are treated as
  authored content.
- Static Grove quest props do not acquire an unnecessary Gaia simulation
  dependency.
- The signed live-mode/world-object request remains the authority boundary;
  browser-only practice evidence is not supposed to grant authoritative items.
- Stable IDs were mapped rather than reused for different meanings.

### Incomplete compliance evidence

- The new GLBs use a direct runtime visual manifest rather than a fully proven
  baked Bikkie binary publication flow. The final deployment model, cache/version
  behavior, and active-tray compatibility need explicit sign-off.
- The Bikkie client/server delivery and expected-tray refresh path has not been
  rerun specifically for every new Grove visual/item definition.
- Galois asset publication/versioning has not been proven by a final clean
  publish/dry-run acceptance for the new outputs.
- No Gaia change should be required, but terrain placement still needs a
  production-snapshot visual check because ground height and muck-edge meaning
  come from the world, not from a flat authored Y assumption.
- ECS/native Challenge synchronization is covered by fast authority tests, but
  not yet by physical browser evidence for all 51 rows.

## What remains to be done

### Functional gaps already known

1. Verify or replace the untested v12 exact-event bridge for `item_grant` and
   `interact` after a signed world-object receipt.
2. Prove Lost Mail objective 4 advances local state, native Challenge, Cloud
   Save, and synchronized frontend state exactly once.
3. Prove Chapel objective 3 does the same with the real chapel-stone
   interaction.
4. Complete Kit through visible acknowledgement and one-time reward.
5. Complete Carlo through Ready, Collect, output inventory, native progress,
   Cloud Save, and final acknowledgement.
6. Complete Read the Jobs Board in the slow physical lane.
7. Rerun Paint and Sparring on the frozen current candidate.
8. Exercise the remaining 43 quests in the slow physical lane.

### Visual gaps

1. Reframe all sample, parcel, dummy, board, and skewer captures so the object
   is readable rather than inside terrain, foliage, or a dark camera volume.
2. Confirm every quest object rests on the correct terrain surface and its F
   prompt is attached to the visible object, not an old invisible anchor.
3. Confirm multi-sample quests use separated, semantically correct geography.
4. Confirm every current objective has a readable HUD instruction and exact
   map/minimap pin.
5. Confirm prior-step highlights disappear after progress.
6. Confirm completion copy, reward, journal removal, and pin cleanup are visible.
7. Human-review every current/completed screenshot; automated file existence
   is not visual approval.

### Test infrastructure gaps

1. Fresh Chrome contexts became progressively slower and timed out on Kit and
   Carlo after earlier rows. Setup-invalid rows must retry in isolated processes
   and must not consume product-failure credit.
2. The runner dereferenced `user.page` after `openUser` failed. A guard was
   added, but the complete setup retry policy is not implemented.
3. Hotfix Cloud repair retries could repeatedly hit the API after rejection;
   v12 adds backoff, but it is untested.
4. Static hotfix string assertions did not execute the event bridge and missed
   the wrong event shape.
5. There is no final generated ledger that proves every one of the 51 rows has
   all required evidence artifacts.

## Mistakes and lessons

### Mistake 1: I did not create the 51-row acceptance ledger first

Work began from the reported quests and expanded reactively. That allowed many
shared fixes, but after many hours only eight unique quests had entered the slow
physical lane.

Correction: generate and freeze the full 51-row/step manifest before running a
browser. Progress will be reported from that ledger only.

### Mistake 2: I conflated evidence tiers in status updates

I used “51 passed” for the live-authority catalog while the user was asking
about physical and visual completion. Although technically qualified later,
that framing was misleading.

Correction: every status report will show four separate numbers: static/unit,
authority, automated physical lifecycle, and human visual approval.

### Mistake 3: I repeated a small subset instead of finishing the shared
trigger contracts first

Sixteen stored slow-run reports repeatedly exercised the same eight quests.
The latest two product failures were both one shared event-shape defect.

Correction: prove each trigger family once with executable adapter tests before
the 51-row visual run. Do not start the full run while any trigger family lacks
an authoritative event mapping.

### Mistake 4: The hotfix contract test was too shallow

It checked that strings such as `snapshot_grove_practice_action` existed, not
that an `item_grant` produced `inventory_change` or an `interact` produced
`inspect_frame` after a signed receipt.

Correction: evaluate the hotfix in a DOM/event harness and assert emitted event
payloads, ordering, rejection behavior, idempotency, and cleanup.

### Mistake 5: Product failures and setup failures were mixed

Kit and Carlo were reported in the same failure total as Lost Mail and Chapel,
even though they never reached gameplay because Chrome bootstrap timed out.

Correction: use mutually exclusive verdicts: `pass`, `functional_fail`,
`visual_fail`, `setup_invalid`, and `not_run`. Only the first three are product
verdicts.

### Mistake 6: Visual artifacts were collected without a visual-quality gate

Some screenshots proved a prompt existed but showed a dark player silhouette,
terrain, or foliage instead of a readable quest object.

Correction: automated capture must reject low luminance, camera clipping, absent
asset bounds, hidden prompts, and off-screen HUD. A human contact-sheet review
must approve every quest before “visual pass.”

### Mistake 7: The hotfix became a second implementation instead of a narrow
compatibility layer

Map pins, HUD, world interactions, Cloud repair, cooking projection, and
completion acknowledgement accumulated in one script. This made retained-build
behavior diverge from source and created regressions.

Correction: each hotfix behavior must have one source owner, one executable
parity test, and one removal/bake plan. No untested hotfix edit enters the full
run.

### Mistake 8: I did not freeze a candidate before claiming completion

Older reports showed Paint, Sparring, and Lost Mail complete, but later hotfix
changes altered shared behavior. Those reports became stale.

Correction: after preflight, freeze the build ID, hotfix hash, Bikkie/asset
version, Redis world identity, runner hash, and quest manifest hash. No code
changes occur during the 51-row acceptance pass.

### Mistake 9: I did not make geography and visual semantics first-class
inputs

Distinct marker IDs were treated as sufficient before checking whether samples
were actually at the muck edge, farther in, or visible from a usable camera
ring.

Correction: the generated manifest will contain giver distance, objective
distance, terrain-resolved position, separation from sibling samples, safe-zone
status, and expected visual asset.

### Mistake 10: I did not maintain a reliable progress answer

Repeated percentage estimates were not grounded in a stable ledger and became
less useful as the definition of “passed” tightened.

Correction: no future percentage estimate. Report exact counts in each verdict
category and link the current ledger/report.

## The one-pass method for all 51 quests

“One pass” will mean one frozen-candidate slow acceptance run across every
quest, after cheap preflight has eliminated shared defects. It will not mean
editing between rows or restarting from quest 1 for every discovered common
bug.

### Phase A — generate the complete audit manifest

Generate one machine-readable row per objective with:

- quest ID/title/category/giver;
- objective index/text/trigger;
- exact marker ID and terrain-resolved position;
- expected map/minimap pin;
- expected interaction control and event payload;
- required native item/recipe/equipment;
- expected authored GLB/Bikkie identity;
- safe-zone/combat/cooking/Chapter 1 constraints;
- expected native Challenge cursor, Cloud Save progress, frontend cursor, and
  completion reward.

The generator must fail if any of the 51 quests or any objective is absent.

### Phase B — preflight every shared contract before Chrome

Run non-browser checks over the complete manifest:

1. all marker IDs resolve;
2. all world positions are finite and terrain-grounded;
3. multi-objective resource positions are distinct and semantically separated;
4. every giver maps to a real native ECS identity;
5. every static item/recipe/mesh resolves through the intended Bikkie/Galois
   boundary;
6. every trigger has an executable local event adapter and native progress
   materialization;
7. every cooking objective has recipe, station, ingredients, Ready, Collect,
   and output contracts;
8. every Chapter 1 overlap has both ownership and release assertions;
9. every NPC offer list obeys the two-offer cap without hiding quests forever;
10. every quest has exact completion acknowledgement, reward, journal cleanup,
    and pin cleanup.

No slow run starts until this is green.

### Phase C — executable trigger-family browser probes

Before the catalog, run one focused physical probe for each of the 15 authored
trigger families currently present:

- `talk_npc`;
- `interact`;
- `near_location`;
- `collect`;
- `choice`;
- `open_tab`;
- `item_grant`;
- `item_use`;
- `inventory_change`;
- `place_voxel`;
- `destroy`;
- `photo_post`;
- `craft`;
- `combat`;
- `open_jobs_board`.

The probe generator must derive this list rather than rely on a hand-maintained
count.
Each probe must prove signed action -> native ECS -> Cloud Save -> synchronized
frontend and, where applicable, item/reward materialization.

### Phase D — stabilize the local browser fixture

Use one warm local production-shaped stack and one Chrome process. Each quest
gets a clean actor and clean quest state. A row may retry setup once in an
isolated context/process, but setup failure remains `setup_invalid` and never
becomes a quest failure.

Preflight requirements:

- fixed build ID and hotfix hash;
- fixed active Bikkie/asset version;
- Web and Sync ready;
- Redis world identity recorded;
- one warmed Bikkie/WASM/client load below an agreed threshold;
- no repeating 400/timeout loop before quest 1;
- no pending implementation changes.

### Phase E — one non-fail-fast 51-quest run

For every objective, the runner must require:

1. local state points to the exact quest/objective;
2. map and minimap show the exact authored marker;
3. the required control is visible, readable, in range, and points at the
   visible object/NPC;
4. the player performs the real action;
5. the server accepts the signed/authorized action;
6. native ECS Challenge state advances;
7. Cloud Save/live quest state advances;
8. the synchronized frontend advances and removes old guidance;
9. authored item/recipe/asset output appears where required;
10. current and completed screenshots are captured.

For final completion, also require exact acknowledgement, one-time reward,
journal removal, pin removal/advance, and no stale prompt.

The run continues after product failures and emits one report. It does not edit
code or restart earlier successful rows.

### Phase F — visual acceptance, not screenshot existence

Automatically reject a frame when:

- luminance is below the usable threshold;
- the camera is inside terrain/foliage/object geometry;
- the expected GLB is absent or outside the useful viewport;
- the prompt is hidden, clipped, or owned by another target;
- quest text is unreadable or covered;
- the map/HUD contradicts the current objective.

Then generate contact sheets grouped by quest. Human review marks each quest
`visual_pass` only after every objective frame is approved.

### Phase G — final gates

Only after the 51-row run is complete:

- rerun `grove`, `grove:live`, `quests`, UI, icons, types, and aggregate gate;
- rerun Bikkie/Galois consumer tests for changed item/mesh definitions;
- rerun Chapter 1 overlap tests;
- verify no hotfix/source parity difference;
- record final counts and artifact links.

## Definition of done

The Grove audit is done only when all are true on one frozen candidate:

- 51/51 authority rows pass;
- 51/51 physical lifecycle rows pass;
- 51/51 human visual rows pass;
- 0 setup-invalid rows remain;
- 0 stale map pins/prompts/journal entries remain;
- 0 Chapter 1 ownership conflicts remain;
- every new mesh/item/recipe has Bikkie/Galois/ECS boundary evidence;
- all final aggregate gates pass.

## Current 51-quest ledger

Legend:

- **Current automated complete**: completed in the latest finished v11 slow run.
- **Historical complete / stale**: completed in an older run but must be rerun
  after later shared changes.
- **Partial/failing**: entered the slow lane but has no complete current proof.
- **Not slow-tested**: no stored slow physical row.

### Fountain quests

| Quest | Status |
| --- | --- |
| Buttons Before the Road | Not slow-tested |
| Paint Knows Where Eyes Go | Historical complete / stale |
| Road-Ready Bag Check | Not slow-tested |
| Tools Before Treasure | Not slow-tested |
| Sparring Is a Promise | Historical complete / stale |
| Ready Check at the Fountain | Not slow-tested |
| Nothing Useful Stays Lost | Partial/failing; older completion regressed |
| Words Find the Right Ear | Not slow-tested |
| Food Keeps You Moving | Not slow-tested |
| First Aid Before the Road | Not slow-tested |
| Hands That Know the Hotbar | Not slow-tested |
| Your First Real Recipe | Not slow-tested |
| Trade Is a Promise You Both Sign | Not slow-tested |

### Story quests

| Quest | Status |
| --- | --- |
| Read the Jobs Board | Partial/failing |
| Meet Mira, Grove Land Steward | Not slow-tested |
| Road Signs and Small Lies | Not slow-tested |
| Patch, Claim, Build | Not slow-tested |
| Guilds Are Promises | Not slow-tested |
| Color That Still Points Home | Not slow-tested |
| The Cart That Forgot Its Wheel | Not slow-tested |
| Road-Ready, Not Fancy | Not slow-tested |
| The Moss That Went Quiet | Not slow-tested |
| Songline Under the Lawn | Not slow-tested |
| Sticky Medicine | Current automated complete; human visual approval pending |
| The Cove Keeps Pictures | Not slow-tested |
| Coop's Key Hen | Not slow-tested |
| Tower With a Headache | Not slow-tested |
| Letter for the North Gate | Not slow-tested |
| Antlers for the Watch | Not slow-tested |
| The Toll Ledger Problem | Not slow-tested |
| Samples for the Chapel | Partial/failing at objective 3 |
| The Tone Beneath the Road | Not slow-tested |

### Graduation and neighbor quests

| Quest | Status |
| --- | --- |
| Where the Road Asks for You | Not slow-tested |
| First Mirror Outside the Fountain | Not slow-tested |
| Three Wheels, One Road | Not slow-tested |
| The Path That Listens Back | Not slow-tested |

### Economy quests

| Quest | Status |
| --- | --- |
| Billy's Lost Lunch Pail | Not slow-tested |
| Billy's Roof Patch Run | Not slow-tested |
| Billy's Map Pin Run to Luis | Not slow-tested |
| Merl's Coin Sorting Apprenticeship | Not slow-tested |
| Merl's Vault Inventory Day | Not slow-tested |
| Fresh Loaves to the Fountain | Not slow-tested |
| Gus's Grain Run from the Field | Not slow-tested |
| Water the Sprout Beds | Not slow-tested |
| Fern's Berry Patch Harvest | Not slow-tested |
| Kit's Letters Around the Fountain | Not slow-tested |
| Kit's Heavy Parcel to the Crossroads | Partial; latest row setup-invalid |
| Mel's Bench Repair | Not slow-tested |
| Mel's Broken Hinge Hunt | Not slow-tested |
| Rin's Wild Mushroom Pickup | Not slow-tested |
| Carlo's Festival Skewers | Partial; latest row setup-invalid |

## Evidence locations

Most relevant reports:

- latest completed focused v11 batch:
  `artifacts/grove-audit-hotfix-v11b-r2-recheck-20260807/1786107932424-38179-report.json`;
- v10 focused batch:
  `artifacts/grove-audit-hotfix-v10b-r2-recheck-20260807/1786104378722-21614-report.json`;
- older built-r2 batch 1:
  `artifacts/grove-audit-built-r2-batch1-20260807/1786089595761-58595-report.json`;
- older built-r2 batch 2:
  `artifacts/grove-audit-built-r2-batch2-20260807/1786091412839-59965-report.json`.

Core implementation/evidence files:

- `src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx`;
- `src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.validation.test.ts`;
- `src/shared/harthmere/snapshot_grove_content.ts`;
- `src/shared/harthmere/live_mode_backend.ts`;
- `scripts/harthmere/grove-quest-client-hotfix-2026-08-07.js`;
- `scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs`;
- `docs/harthmere/TESTING_FASTER.md`.

## Resume rule

When work resumes, the first deliverable is the generated 51-quest audit
manifest and executable trigger-family preflight—not another focused visual
rerun. The full slow browser pass begins only after those shared contracts and
the local bootstrap are green and the candidate is frozen.
