# Jobs Board and Grove Hotfix Report — 2026-08-06

## Executive status

The August 7 UTC capture reopened the Repair Mallet and escort rows. Earlier
source/unit and partial browser evidence did **not** prove those player paths,
and this report no longer represents them as live-green.

The grouped source hotfix now covers the confirmed gaps from all three August
6/7 captures:

- a successful business tool purchase requests and broadcasts the authoritative
  Jobs Board snapshot in the same response as inventory and economy;
- a completed tool-buy pin stays on the same todo and advances to the next unmet
  item source before the field target;
- every escort acceptance chooses a fresh destination from the supplied valid
  landmark list instead of reusing the posting's seed-time destination;
- an escort at extreme separation uses the existing terrain-validated recovery
  warp even when tiny path progress would otherwise keep it stranded.
- a business board no longer owns `F` from across the room or while it is
  off-camera, so a faced patron/worker can still be talked to;
- a Jobs Board mutation merges the response's native inventory before caching
  and broadcasting quest state, so a physical parcel/tool/item pickup advances
  the marker without a reset;
- the focused browser runner clears every retained stack, accepts one gather
  granting multiple units, and performs the required return-board hand-in
  instead of expecting gather jobs to auto-complete at the source.

No Next build or image build was performed for these edits. Source tests are
green. Live acceptance must be reported separately against the latest image,
`glitchgames.azurecr.io/biomes-node:prod-50b9f486-asset-boundary-r2` (digest
`sha256:facaf6368667ec1c302e8fd7f542006bcc510c0d15c2f91eb559763d6a6fa358`).
Until that image or a later deployment contains the new source, the new Repair
Mallet and escort fixes are implemented but not deployed.

## Errors reported by the player and their fixes

| Reported problem                                                                         | Root cause                                                                                                                                                                                   | Hotfix                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jobs Board interaction radius captured the nearby Patron                                 | The `9m` board radius covered most of the interior, and the off-camera board still registered a high-priority `F` candidate                                                                   | Reduced the physical board radius to `3.25m` and register its keyboard candidate only while the board prompt is projected in view; the clickable fallback remains available                                                  |
| Sealed package could not be seen at the destination                                      | Field props could disappear while terrain grounding was still `not-loaded`; exact delivery targets were also losing priority                                                                 | Added exact physical field props, target-id priority, authored-Y fallback while terrain streams, and live F-prompt coverage                                                                                                 |
| Buying the Muck Rake or Repair Mallet did not advance the same quest/map without a reset | The business mutation requested inventory/economy snapshots but omitted `jobsBoardState`; the active-pin handoff then selected the first same-todo landmark rather than the next unmet phase | Business tool purchases now request and broadcast `jobsBoardState`; same-todo handoff explicitly prioritizes missing tool, then missing item source, then field/return target                                               |
| Changing the main quest left “Pick up the sealed package” on the HUD                     | Main-quest selection and the active navigation pin/HUD objective were updated independently                                                                                                  | Main-quest selection now updates the active pin and HUD objective together                                                                                                                                                  |
| Muck Rake could not complete; F icon was invisible                                       | Target selection, service-count progress, protected-region held-item filtering, and the original robot-like Muck Buster presentation all contributed                                         | Added exact target priority, service progress accounting, physical prop/prompt handling, protected-region held visibility, and the shipped Wooden Hoe presentation with competing legacy `mesh`/`vox` removed               |
| Escort reached the destination but no completion marker appeared                         | The companion remained far behind, so server authority correctly kept the job in `following` rather than projecting a false completion marker                                                | Retained authoritative arrival, but added an extreme-separation recovery condition so the terrain-validated warp brings the companion back into the arrival radius and allows the next scheduler tick to publish completion |
| Escort repeatedly used the same destination                                              | Destination randomization ran when the shared posting was auto-seeded, so all later acceptances inherited the same valid marker                                                              | Destination is now selected on every acceptance from the supplied 96–900m valid list, deterministically keyed by acceptance identity and excluding the previous marker when alternatives exist                              |
| Escort could not keep up or traverse terrain                                             | Follow pacing and path-failure recovery existed, but small reported progress could indefinitely suppress recovery while the companion was many leash lengths behind                          | Retained native terrain/collision movement and catch-up pacing; added a hard recovery threshold at three `32m` leash lengths, still disabled in combat and still resolved through standable terrain before movement         |
| Stock the Road showed an invisible/non-working source                                     | Production ran an older bundle, and the first acceptance harness also retained duplicate berry stacks and expected one unit per `F` even when the real source granted all six                  | Current source renders the visible berry thicket; the live adapter uses fresh native inventory; the runner clears all backpack/hotbar duplicates, accepts multi-unit grants, verifies the board-return marker, then turns in and checks reward                 |

## August 7 UTC production HAR `1786075834394`

Source files:

- `/Users/devindixon/Downloads/www.glitch.fun-1786075834394.har`
- `/Users/devindixon/Downloads/www.glitch.fun-1786075834394.log`

The captured production page used build
`50b9f486f2201c5cee492c3c1184460f0814d7da`, which predates the current source
hotfixes. The HAR contained no same-origin HTTP `4xx` or `5xx`; the failed
LinkedIn/YouTube requests were third-party aborts. The only console findings
were an unexpanded Aegis object and one `52ms` timer warning.

Confirmed gameplay findings:

1. Run the Coop was accepted as `harthmere_auto_14`, but the capture contained
   no successful sealed-package interaction. The screenshot shows `F Open
   Clearbarrel Cleanup Yard Business Board` owning the input while `F Talk` is
   visibly available on Keeper Mab Crock. The source hotfix narrows and
   view-gates board ownership. The live physical pickup row subsequently proved
   the sealed package entered the native hotbar; it also exposed that the
   response's fresh inventory was dispatched after an inventory-stale Jobs
   snapshot. The adapter now merges that inventory before state publication.
2. Stock the Road was accepted as `harthmere_auto_16`. The HAR recorded nine
   `world_object_interaction` calls for `grove_garden_edge_berries`, each
   followed by `complete_job_quest`, while production remained at `0/6`. The
   source contract is now explicit: the resource interaction grants native
   berries, the job remains active, six owned berries route the marker to the
   Grove board, and only board hand-in consumes them and pays the reward. There
   is no forge recipe in this authored job.
3. The production Shopfront still displayed the old robot-like Muck Buster art
   for Muck Rake. Current source uses the shipped iron-hoe icon and Wooden Hoe
   held GLTF. Because both correct assets already exist, Blender was not used.
4. Repeated spawn concern is separated by type: Run the Coop intentionally has
   the fixed visible pickup `coop_supply_box`, while its supplied drop-off list
   rotates; escorts rotate supplied protection-field destinations on every
   acceptance. Two retained real escort runs used different destination ids and
   positions.

Focused live Stock evidence on mounted build
`warm-grove-quest-audit-20260807-r1` proved a visible thicket, real `F Gather`,
native inventory reaching `6/6`, the source disappearing, and the map/HUD
returning to the Jobs Board. The first attempt stopped before hand-in because
the test actor retained duplicate berry stacks; that is harness evidence, not a
production pass for payment. The corrected full row must be the artifact cited
for final turn-in/reward acceptance.

## August 7 UTC HAR/log findings and exact fixes

Source files:

- `/Users/devindixon/Downloads/www.glitch.fun-1786062423112.har`
- `/Users/devindixon/Downloads/www.glitch.fun-1786062423116.log`

Confirmed product defects:

1. `harthmere_auto_20` (repair) was accepted at `2026-08-07T00:21:17.129Z`.
   The Repair Mallet purchase posted at `00:23:19.589Z` and returned HTTP 200.
   Inventory changed at `00:23:21.104Z` and again at `00:23:21.317Z`, and the
   operation emitted its success event at `00:23:21.257Z`. No corresponding
   Jobs Board progress/state event followed. The player then repeatedly opened
   the map and selected markers until resetting the quest. Fix: include and
   broadcast `jobsBoardState` from the successful business mutation.
2. After the tool-source marker disappears, the client used array order to pick
   the first remaining same-todo marker. Accepted field markers are assembled
   before item-source markers, so a repair requiring three Softwood Logs could
   skip the material phase. Fix: phase-aware same-todo marker priority.
3. The captured player inventory contains `repair_mallet: 1`, proving the sale
   completed. The selected mallet still needs a deployed live held-mesh and
   field-use acceptance row; inventory success alone is not visual proof.
4. `harthmere_auto_11` (escort) was accepted at `00:21:24.435Z`. The retained
   posting contains one long-lived
   `escort_destination:legacy_protection_field:2799804955443533` entry shared
   by repeated actors. Fix: assign a fresh supplied-list destination at each
   acceptance and update the posting, requirement, companion, todo, and map from
   that one authoritative selection.
5. The current escort remained in `following` with the companion around
   `[-92.26, 30.7, 28.23]` and its destination around
   `[-234.70, 25, 80.08]`. A completion marker would have been false while the
   companion was still roughly 151m away. Fix: extreme-distance recovery so the
   companion can catch up over difficult terrain and actually reach authority's
   arrival state.

Additional captured errors retained for separate follow-up:

- `Removing navigation aid for missing entity` for entity
  `8997551883502307` occurred before and after reload. This is a stale/missing
  entity-aid cleanup signal, not evidence that the repair or escort completed.
- `Player is stuck in void` at `[319.5647, 56.4014, -99.6213]`, followed by a
  missing-terrain reload at `00:26:57.120Z`. The terrain key was
  `[9,1,-4](25090104)/undefined`.
- Repeated 3–14 FPS warnings and business long-task telemetry occurred around
  `business_outpost_repair_hingehall`. These remain performance defects and are
  not reclassified as quest-state failures.
- The Aegis `[object Object]` message lacks actionable payload detail.
  Google/LinkedIn aborts and capture-end status-0 requests are third-party or
  capture noise rather than successful/failed Jobs Board authority calls.

## Additional defects found in the HARs and grouped browser batch

1. Eight authored actions on crate/basket/bin/shelf nouns were incorrectly
   routed to generic container UI. The dispatch now follows the authored
   interaction capability (`use`, `gather`, and so on), not the noun shape.
   This shared fix covers business jobs and Grove objects, including Gus's and
   Rin's baskets.
2. Clinic Delivery Lockbox and Inn Linen Shelf disappeared when terrain had
   not streamed. Renderer and overlay placement now use authored feet-Y until
   real grounding is available.
3. The Muck Rake used the Muck Buster's squat robot-like visual. It now borrows
   the exact shipped Wooden Hoe GLTF. Offline inspection measured one mesh,
   2,296 vertices, dimensions `10 x 14 x 35`, and a longest/second-axis ratio
   of `2.5`.
4. Gus's warm-loaf pickup produced HTTP 500 because
   `grove_warm_loaf_tray` had no checked-in native item identity. Added native
   identities and inventory/Bikkie definitions for the warm loaf tray, heavy
   parcel, and bolt crate so the same defect cannot recur on the related Grove
   carrying quests.
5. Recycled visual-test player ids could retain `npc_state`/NPC components.
   Focused Jobs, Chapter 1, held-tool, and escort rows now evict and normalize
   the actor before gameplay fixtures.
6. `/api/upload/wake_up` returned HTTP 413 for payloads over 1 MB and caused a
   parser/error cascade. The no-op report endpoint now returns before sending
   the oversized body.
7. HAR status-0 requests at capture end were pending/capture cutoff, not HTTP
   product failures. YouTube/ad-origin aborts were third-party noise. Low FPS
   warnings (1–7 FPS) were retained as performance evidence, not reclassified
   as quest-state failures.
8. Global browser locking serialized independent groups. The runner now uses
   lane-aware runtime leases while still serializing tests that mutate the same
   app/Sync/Redis fixture lane.

## Shared coverage beyond the original jobs

The fixes were deliberately placed at shared seams where possible:

- Authored object interaction dispatch applies to every Jobs Board and Grove
  object, not just the eight objects that failed the first browser batch.
- Authored-Y streaming fallback applies to all registered field targets.
- Main-quest/pin/HUD synchronization applies to all projected jobs.
- Synchronous inventory/job handoff applies to every tool- or item-gated job.
- Escort locomotion/recovery applies to Jobs Board escorts and other users of
  the shared escort behavior.
- Native carried-item identity coverage now includes all currently declared
  `SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS`.
- Chapter 1-only jobs remain time-gated and filtered separately from regular
  board postings; the Chapter 1 board and all six supplier transactions passed
  their retained browser batch.

## Test evidence

### Completed automated gates

- New focused red-to-green batch: `136 passing / 5 failing` before the grouped
  fix, then `141 passing / 0 failing`
- Jobs Board fast suite after the final inventory merge fix: `241 passing`
- Business board/NPC input ownership batch: `27 passing`
- Quest and world-object regression preset: `265 passing`, `1` intentional pending
- Native E2E runner syntax: passed
- All-jobs browser release contract: all checks passed
- Business adapter/deployed-envelope suite: `44 passing`
- Complete escort policy/scheduler/ECS batch: `64 passing`
- Repair/Muck held-item, equip, presentation, and local-purchase batch:
  `36 passing`
- Scoped Chapter 1 typecheck: passed
- `git diff --check`: passed

Retained earlier gates:

- Quest/Grove shared suite: `207 passing`, `1` intentional pending
- Combat/escort suite: `180 passing`
- Native item and world-object materialization batch: `41 passing`
- Mutable hotfix layer test: passed
- Mutable hotfix TypeScript project: passed
- Mutable stack shell syntax check: passed
- All-jobs native browser contract: passed

The final broad `t.sh gate` was stopped at the user's wrap-up instruction. It
had reached `431 passing`, `1 pending`, and the robot-story browser contract had
passed, but it is not recorded as a completed full gate.

### Completed live browser evidence

- All 14 business templates:
  `artifacts/harthmere-native-ecs-e2e/1786050363013-82664-report.json`
- Chapter 1 Jobs Board and all six supplier routes:
  `artifacts/harthmere-native-ecs-e2e/1786038194769-64037-report.json`
- Rin's complete Grove mushroom pickup lifecycle:
  `artifacts/harthmere-native-ecs-e2e/1786052989815-99607-report.json`
- Muck Rake front held view:
  `artifacts/harthmere-native-ecs-e2e/1786052526145-97689-muck-rake-held-front.png`
- Escort diagnostic run that proved authoritative movement/browser sync before
  the visible-animation assertion:
  `artifacts/harthmere-native-ecs-e2e/1786053697045-4908-report.json`
- Two real escort acceptances with different supplied destinations and Anima
  movement:
  `artifacts/harthmere-native-ecs-e2e/warm-jobs-har-20260807-r3-escort-real-1/1786075547294-11393-report.json`
  and
  `artifacts/harthmere-native-ecs-e2e/warm-jobs-har-20260807-r3-escort-real-2/1786075967521-12906-report.json`
- Repair Mallet purchase, marker handoff, selected held mesh, real `F Repair`,
  completion and reward:
  `artifacts/harthmere-native-ecs-e2e/warm-jobs-har-20260807-r3-repair-canvas-hotfix/1786074767492-8182-report.json`
- Cleanup/Muck Rake purchase, marker handoff, held tool, real field cleanup,
  completion and reward:
  `artifacts/harthmere-native-ecs-e2e/warm-jobs-har-20260807-r3-final2/1786071689668-97932-report.json`
- Stock the Road complete real lifecycle on mounted
  `warm-grove-quest-audit-20260807-r1`: visible berry thicket, real gather,
  `6/6` board-return handoff, board completion, and gold `0 -> 35`, with no
  browser failures. The real thicket granted a stack of 12; the reward frame
  shows 6 remaining after the board consumed the exact required 6:
  `artifacts/harthmere-native-ecs-e2e/warm-grove-quest-audit-r1-stock-road-full-r3/1786081757171-44564-report.json`

### Important business screenshots

- Sealed package/clinic delivery:
  `artifacts/harthmere-native-ecs-e2e/1786050363013-82664-native_ecs_e2e_job-courier_medicine_delivery-field-tool-use.png`
- Farm Supply Crate authored delivery action:
  `artifacts/harthmere-native-ecs-e2e/1786050363013-82664-native_ecs_e2e_job-farm_crop_harvest-field-tool-use.png`
- Inn Linen Shelf streaming fallback:
  `artifacts/harthmere-native-ecs-e2e/1786050363013-82664-native_ecs_e2e_job-hospitality_room_reset-field-tool-use.png`
- Repair tool/field use:
  `artifacts/harthmere-native-ecs-e2e/1786050363013-82664-native_ecs_e2e_job-repair_person_fixture_fix-field-tool-use.png`

## Deployment and sign-off notes

The latest image is the acceptance baseline, but it was created before the new
HAR-driven source edits in this section. Do not claim an image pass proves these
new fixes unless its build contains them. No mutable client manifest was applied
for this pass.

Required bounded live rows after deployment:

1. Accept the Repair Mallet job, buy one real mallet, and prove without reset
   that inventory, objective text, world-map pin, and minimap pin remain on the
   same todo and advance to Softwood Logs or the field target as appropriate.
2. Move/select the native Repair Mallet, prove a non-empty first/third-person
   held mesh in the Grove, use it at the marked fence, and prove completion and
   return-to-board reward.
3. Accept the same reusable escort posting twice with separate actors or
   sequential releases; prove two different supplied-list destinations, normal
   terrain traversal/catch-up, extreme-separation recovery, authoritative
   arrival, completion dialogue, and the return marker.
4. Retain the earlier Muck Rake, sealed-package, Chapter 1 time-window, supplier,
   and all-business-template rows in the same non-fail-fast campaign. A failure
   in one row must not prevent the remaining rows from running.

### Run the Coop focused recheck on `warm-grove-quest-audit-20260807-r3`

No build, compile, remount, Redis reset, or app restart was performed for this
recheck. The mounted app remained healthy (`restart=0`, `OOM=false`, web `200`,
Sync `200`, Redis `PONG`).

The build-only row corrected the earlier stale source selection: the accepted
job started at `coop_supply_box`, grounded at `[384,59,-198]`. It exposed two
remaining shared-boundary defects:

1. The visible marker was grounded at Y=59 while the static interaction
   candidate remained at its legacy authored Y=71, so the 3.5m vertical gate
   suppressed the F prompt. The shared world-object selector now replaces an
   exact active target's candidate position with the grounded active-pin pose.
2. The real pickup granted the native sealed package and wrote the durable
   `delivery_parcel_picked_up` receipt, but a stale live-mode inventory mirror
   let later map/HUD projections revert to the pickup phase. Both server and
   client phase resolvers now recognize that durable receipt. The no-build
   payload additionally carries the logical `sealed_package` id, explicitly
   hands the persisted UI pin/objective to the satchel, hands it back to the
   Jobs Board after delivery, and clears the completed job pin/objective after
   payout.

Focused source/contract evidence:

- job objective unit file: `41 passing`
- Jobs Board map adapter file: `28 passing`
- world-object interaction file: `16 passing`
- native all-jobs browser contract: passed
- hotfix and runner syntax checks: passed

Final no-build browser acceptance, with the client payload injected into the
unchanged mounted build:

- report:
  `artifacts/harthmere-native-ecs-e2e/warm-grove-quest-audit-r3-run-coop-hotfix-v7/1786106121305-27882-report.json`
- visible grounded pickup and owning `F Inspect Box`:
  `artifacts/harthmere-native-ecs-e2e/warm-grove-quest-audit-r3-run-coop-hotfix-v7/1786106121305-27882-npc_delivery_apples-visible-sealed-package-pickup.png`
- sealed package in native inventory plus visible delivery objective/marker
  handoff to Mail and Bank Satchel:
  `artifacts/harthmere-native-ecs-e2e/warm-grove-quest-audit-r3-run-coop-hotfix-v7/1786106121305-27882-npc_delivery_apples-pickup-to-dropoff-marker.png`
- native parcel consumption, return/turn-in, reward `0 -> 45 gold`, and cleared
  stale job objective/pin:
  `artifacts/harthmere-native-ecs-e2e/warm-grove-quest-audit-r3-run-coop-hotfix-v7/1786106121305-27882-npc_delivery_apples-reward-paid.png`

The final row passed both scenarios and now fails if the visible objective does
not change from pickup to delivery or if the paid job leaves its objective/pin
behind. This is acceptance evidence for the mounted build **plus injected
no-build hotfix v2**. It is not evidence that the immutable build alone contains
the source changes. The mutable-hotfix endpoint is disabled on this stack, so a
normal uninjected player session still requires this payload to be applied by
the production hotfix mechanism (preferred) or the source changes to enter a
later bundle.
