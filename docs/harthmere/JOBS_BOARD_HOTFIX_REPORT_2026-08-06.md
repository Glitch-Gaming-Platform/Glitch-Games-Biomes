# Jobs Board and Grove Hotfix Report — 2026-08-06

## Executive status

This pass used hotfix/source edits and the existing mounted production-shaped
stack. No Next build, image rebuild, app remount, or app restart was performed.

- Mounted build: `warm-20260806191329`
- Mounted image: `sha256:700e7e3e76e9d533e14ec0f8f6d355dcc4f20c4b3b0b898f320205cc8b0ff113`
- Final stack check: app healthy, restart count `0`, OOM `false`, Redis `PONG`
- Business Jobs Board browser batch: all 14 templates passed
- Chapter 1 board/supplier batch: passed
- Rin Grove basket lifecycle: passed
- Gus Grove loaf basket: source and native-materialization tests pass; the
  currently mounted immutable server predates the new item identity, so a live
  rerun requires the next ordinary deployment
- Muck Rake: correct Wooden Hoe donor, protected-region held visibility, and
  native identity are source/unit green; a front live frame exists, while the
  final fitted visual rerun was stopped at wrap-up
- Escort: source/unit behavior is green and one live run proved authoritative
  terrain movement and browser synchronization; the final visible-capture row
  was not completed before wrap-up

This is therefore a completed hotfix implementation with strong Jobs Board
acceptance evidence, plus three explicit deployment/visual sign-off items that
must not be represented as already live-green.

## Errors reported by the player and their fixes

| Reported problem | Root cause | Hotfix |
| --- | --- | --- |
| Jobs Board interaction radius captured the nearby Patron | Board radius was wider than the authored business-space interaction | Reduced the business board interaction radius to `1.75m` in shared authority and the live adapter |
| Sealed package could not be seen at the destination | Field props could disappear while terrain grounding was still `not-loaded`; exact delivery targets were also losing priority | Added exact physical field props, target-id priority, authored-Y fallback while terrain streams, and live F-prompt coverage |
| Buying the Muck Rake changed to another quest instead of advancing the same job | Inventory/tool purchase and job projection refreshed asynchronously, allowing another active objective to win | Made inventory changes synchronous, preserved the current todo through the tool phase, refreshed the exact job snapshot, and moved the map pin to the next step |
| Changing the main quest left “Pick up the sealed package” on the HUD | Main-quest selection and the active navigation pin/HUD objective were updated independently | Main-quest selection now updates the active pin and HUD objective together |
| Muck Rake could not complete; F icon was invisible | Target selection, service-count progress, protected-region held-item filtering, and the original robot-like Muck Buster presentation all contributed | Added exact target priority, service progress accounting, physical prop/prompt handling, protected-region held visibility, and the shipped Wooden Hoe presentation with competing legacy `mesh`/`vox` removed |
| Escort reached the destination but no completion marker appeared | Arrival polling/completion projection did not reliably convert companion arrival into the return-to-board phase | Added escort scheduler polling, destination/arrival projection, completion dialogue, return marker, and reward handoff |
| Escort could not keep up or traverse terrain | Follow pacing was too conservative and the recovery policy treated movement in any direction as progress | Increased close-fast/catch-up pacing, reduced the leash to `32m`, required progress to close the leader gap, retained collision/climb/gravity, and added terrain-validated recovery warp |

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

- Jobs Board fast suite: `237 passing`
- Quest/Grove shared suite: `207 passing`, `1` intentional pending
- Combat/escort suite: `180 passing`
- Native item and world-object materialization batch: `41 passing`
- Scoped typecheck: passed
- Mutable hotfix layer test: passed
- Mutable hotfix TypeScript project: passed
- Mutable stack shell syntax check: passed
- All-jobs native browser contract: passed
- `git diff --check`: passed on the touched hotfix files

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

The mounted app did not expose the mutable-hotfix admin endpoint, so the client
payload was injected by the acceptance harness ahead of the immutable app. No
mutable manifest was applied to the container. The source payload is
`scripts/harthmere/jobs-board-client-hotfix-2026-08-06.js` and is cleanup-safe.

The next normal deployment should include the source changes and then run these
three bounded sign-off rows on the new build:

1. Gus's complete warm-loaf basket pickup/delivery lifecycle, proving the new
   native item id on the deployed server.
2. Muck Rake gameplay held frame plus fitted close review, proving grip and
   orientation on the deployed client.
3. Escort terrain/follow/arrival screenshot row with Anima running the deployed
   shared escort behavior.

Do not rebuild the current mounted stack only to obtain those screenshots.
