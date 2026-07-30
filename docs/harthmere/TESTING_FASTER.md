# Testing Faster — Local and Browser

Every number below is measured in this checkout, not estimated.

## TL;DR

```sh
scripts/harthmere/t.sh ch1        # 196 tests, 4.6 s   (was 8.1 s)
scripts/harthmere/t.sh bible      # 105 tests, 2.9 s   — Bellbound Dragon catalog
scripts/harthmere/t.sh bible:e2e  # all 85 quests / 340 steps, ~10 ms
scripts/harthmere/t.sh quests     # focused quest/container contracts
scripts/harthmere/t.sh ui         #   9 tests, 1.1 s
scripts/harthmere/t.sh gate       # quest + UI + client config + contract + types
scripts/harthmere/t.sh watch ch1  # re-runs on save
scripts/harthmere/t.sh types      # scoped typecheck, ~3 s
scripts/harthmere/t.sh types:stack # Ask/Logic focused-stack wiring
```

```sh
node scripts/harthmere/e2e-jump.cjs ready            # is the stack up?
node scripts/harthmere/e2e-jump.cjs url busted_chest # spawn AT the bug
node scripts/harthmere/e2e-jump.cjs seed busted_chest # skip the prior steps
node scripts/harthmere/e2e-jump.cjs cloud-save-url <install-id>
```

---

## 1. What was actually slow

I profiled before changing anything. Three findings, in order of impact.

### 1.1 Every run paid a server bootstrap it didn't need

`.mocharc.json` requires `src/server/test/global_setup.ts`, which calls
`serverTestInit()` and `prepareBikkieForTest()` on **every** mocha invocation.

For a pure-data suite that never touches a server or Bikkie, that is pure tax:

|                                       | Before | After      |      |
| ------------------------------------- | ------ | ---------- | ---- |
| One file (`ch1_gate_visual`, 7 tests) | 2.85 s | **0.68 s** | 4.2× |
| One file (`ch1_live_fixes`, 14 tests) | 3.73 s | **1.19 s** | 3.1× |

The tests themselves ran in **3 ms**. Everything else was startup.

`.mocharc.fast.json` drops the bootstrap. **All 196 Chapter 1 tests pass under
it** — none of them needed the server or Bikkie.

### 1.2 A quadratic BFS in my own E2E test

`ch1_e2e_dungeon_traversal` took 3 s — most of the whole Chapter 1 suite. Two
causes, both mine:

- `queue.shift()` in the flood fill. `Array.shift()` is O(n), making the BFS
  quadratic. Replaced with a head index.
- The fill re-ran from scratch in each of three tests, and each "is this room
  reachable" check rescanned the whole volume. Both are deterministic, so both
  are now memoized per dungeon.

3 s → **1 s**, with no assertion weakened.

### 1.3 Full suite

|                             | Before | After      |
| --------------------------- | ------ | ---------- |
| Chapter 1 suite (196 tests) | 8.06 s | **4.15 s** |

---

## 2. What did NOT work — don't retry it

**`--parallel` is slower here.** Each worker re-pays ts-node startup, which is
the dominant cost:

|                | Serial     | Parallel (4 jobs) |
| -------------- | ---------- | ----------------- |
| 196-test slice | 4.15 s     | 5.90 s            |
| 323-test slice | **4.95 s** | 5.93 s            |

Parallelism only pays once a slice is big enough to amortise 4× startup — in
this repo that means the `full` preset, not the scoped ones.

**`sourceMap: false`** — measured at noise level (3.44 s vs 3.40 s check time).
`noEmit` already means no maps are written. Not worth touching.

---

## 3. Choosing a lane

| You changed…                               | Run                        | Cost                              |
| ------------------------------------------ | -------------------------- | --------------------------------- |
| Chapter 1 data/logic                       | `t.sh ch1`                 | 4.6 s                             |
| Quest containers, F prompts, world objects | `t.sh quests`              | 0.8 s                             |
| A BiomesUI tab                             | `t.sh ui`                  | 1.1 s                             |
| Quest/container/UI handoff                 | `t.sh gate`                | one Mocha startup + one typecheck |
| Cutscene defs or the generator             | `t.sh cutscene`            | 2.9 s                             |
| One file, tight loop                       | `t.sh watch ch1`           | ~1 s per save                     |
| Types (the thing `./b test` never checks)  | `t.sh types`               | ~3 s                              |
| Server handlers, Bikkie, ECS gen, triggers | `t.sh full`                | minutes                           |
| Anything shipping to players               | `t.sh full` + browser gate | —                                 |

### The one thing that will bite you

**`./b test` does not typecheck.** `tsconfig.json` configures ts-node with
`transpileOnly: true` and `swc: true`. Green tests say nothing about type
correctness. Run `t.sh types` too — it is 3 seconds.

### When the fast preset is not enough

If a suite passes under `full` but fails under fast, it needs the bootstrap —
it imports Bikkie item data, the ECS gen layer, a server handler, or the
trigger engine. That failure _is_ the signal. Run it with `full` and add a note
to the header comment in `t.sh` so the next person doesn't rediscover it.

---

## 4. Browser testing

The runbook's serial full-chain walk is the right **release gate** and the
wrong **inner loop**. The slow parts are not the browser:

1. rebuilding/restarting the stack between iterations, and
2. replaying the whole quest chain to reach the step you changed.

`scripts/harthmere/e2e-jump.cjs` attacks both.

### 4.0 Incident log: do not repeat the July 27/29 environment mistakes

These mistakes extended one Chapter 1 verification pass by hours. Treat this
as an operational checklist, not background history:

- **Do not test source changes against an old production image.** Record the
  image tag and digest before starting E2E. Rebuild once after the complete
  fix batch, replace the local smoke container once, then run all affected
  checkpoints against that exact image.
- **Do not start duplicate scoped typechecks.** `t.sh gate` already includes
  `tsconfig.ch1check.json`. Run either `t.sh gate`, or an explicit parallel
  batch that omits the separate `t.sh types`; never both at once.
- **Do not use obsolete Mocha bootstrap paths.** The supported single-file
  command is `scripts/harthmere/t.sh file <path>`. Do not invent a direct
  `mocha --require src/server/test/register.ts` command.
- **Do not use a bare `next dev` or `next start` process as the game browser
  harness.** The `/at` route and `/api/harthmere/visual_test_auth` require the
  initialized Biomes web context; a standalone Next process leaves
  `req.context.sessionStore` undefined and can spend minutes compiling before
  failing during authentication or server-side props. Use one exact-source
  production image and the documented unified/warm stack, wait for the complete
  `e2e-jump.cjs ready` contract, and only then open the browser.
- **Use real touch input for mobile-only controls.** A mouse `click()` is not a
  valid substitute for a phone tap when the control intentionally cancels
  compatibility mouse events to prevent an accidental primary attack. Launch
  a mobile context with touch + mobile UA, use `tap()` for buttons, and dispatch
  touch start/move/end for joystick drags.
- **Do not assert responsive `rem` widths with desktop pixel constants.** The
  game scales the root font on phone viewports. Compare the computed width to
  the authored `rem` value times the live root font size (and viewport cap), or
  assert the mobile class plus a relative width increase.
- **A failed or interrupted dungeon browser leaves the one-party slot claimed
  for up to three minutes.** Before rerunning, inspect
  `harthmere:ch1:slot:<dungeonId>` and its TTL. Prefer a clean product exit;
  otherwise wait for expiry or perform an explicitly scoped test cleanup.
  Do not mistake `Another party is inside` for a new gameplay regression.
- **Wait for both halves of a signed portal warp.** Authoritative ECS can show
  the slot arrival before the browser consumes `WarpHomeEvent`. A test that
  immediately teleports to the next objective races the legitimate portal
  warp and is invalid. Gate E2E must wait for authoritative position and the
  live `/scene/local_player` or `/sim/player` position.
- **Do not switch between Docker and host-native stacks mid-batch.** Pick one
  owner for ports 3017/4907 and verify it with `docker ps`, `lsof`, and the
  image digest. Mixed ownership produced disappearing containers, stale
  sessions, and misleading network failures.
- **Do not run one checkpoint, fix one symptom, and rebuild again.** Run the
  desert and winter slices in one non-fail-fast batch, save both reports,
  group failures by root cause, apply one fix batch, and rebuild once.
- **When an interrupted tool session becomes unknown, inspect OS/container
  state before restarting anything.** The process may still own Redis or game
  ports even though the tool session id is gone.

July 29 robot-story follow-up added four more concrete traps:

- **`e2e-jump.cjs ready` derives the web port from `HARTHMERE_E2E_URL`, not
  `HARTHMERE_E2E_BASE_URL`.** Setting only the base URL made a healthy `3017`
  stack print `DOWN web :3000`. Use the complete readiness contract:

  ```sh
  HARTHMERE_E2E_STACK_CONTAINER=<container> \
  HARTHMERE_E2E_URL=http://127.0.0.1:3017/at \
  HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:4907 \
  HARTHMERE_E2E_REDIS_PORT=6390 \
    node scripts/harthmere/e2e-jump.cjs ready
  ```

- **A fresh test username is not proof of a clean player entity in a reused
  snapshot Redis world.** An allocated id can still belong to a disposable
  snapshot NPC. The July 29 failure kept the authoritative actor near
  `x=3517`, while Sync correctly reset the browser to the Grove; quest targets
  were then created outside the browser subscription and never appeared. A
  focused robot-story run now first moves the actor to the production-shaped
  stack's canonical safe start `[484.24980838010384, 53,
-207.51197432867897]` and clears `npc_metadata`/`npc_state`, then waits for
  that exact local pose before creating targets. Do not substitute the visible
  fountain surface `[496, 70, -126]`: collision/warp recovery can legitimately
  return it to the canonical start, turning an exact-pose assertion into a
  two-minute timeout. Other reusable focused actors must do the same kind of
  stable-position normalization before relying on their current position.

- **The exact-image cold boot can legitimately spend several minutes loading
  a large reused Redis world.** This run loaded roughly 300,000 entities before
  Sync became ready. Do not launch Chromium when TCP alone is up, and do not
  restart the container while entity counts are still increasing. Wait until
  `e2e-jump.cjs ready` reports web, Sync, Redis, and every required lifecycle
  service as `UP`; subsequent browser batches should reuse that warm stack.

- **Focused robot-story fixtures can cancel background Chapter 1 polling while
  replacing the actor state.** Chromium reports the canceled
  `chapter1_progress`, `chapter1_story`, `chapter1_gate?e2e=1`, or queued
  Chapter 1 voice request as `net::ERR_ABORTED` even when the server completed
  the API with HTTP 200. Treat only those exact same-origin requests as focused
  robot-story transients. Keep other failed requests fatal; a 4xx/5xx response
  or a non-aborted Chapter 1 request is still product evidence.

Jobs Board catalog follow-up on July 29 added two more mandatory preflights:

- **Normalize a Jobs Board browser actor before moving it.** A new username in
  a reused snapshot selected entity `1033646919295501`, which still had
  `npc_state`; NPC steering held it near `[3320, 65, -333]` while the test
  waited for a board warp. The runner now clears NPC-only components and proves
  the authoritative row is a player before installing/running the catalog.
  Do not diagnose the resulting movement timeout as a Jobs Board regression.
- **Repeated service jobs require repeated real interactions, each with a new
  idempotency key.** `Clear the Muckwad Patch` requires five server-owned
  interaction receipts after acceptance. The old browser harness performed no
  visible F interaction for Grove landmarks, while the client reused the first
  completion request id and could replay its expected `0/5` rejection forever.
  The player path now sends a distinct completion attempt for each F action;
  the catalog resolves both shared Grove landmarks and business field targets,
  presses F the authored number of times, and waits for every receipt.
- **Do not reinterpret item-source map markers as hand-in objects.** The first
  post-fix catalog run tried to press `F Gather` at Garden Edge Berries for the
  road-rations job. That marker tells the player where to obtain the six
  berries; native inventory is the completion evidence. Only registered field
  targets and repeated service requirements should enter the physical F helper.
- **Accepting a job must not steal the player's existing main-quest pin.** The
  runner cannot wait for automatic pin replacement: the UI deliberately keeps
  the player's current Road Ahead destination. For a pin-gated Grove service
  prop, the E2E must open Quests with `J`, select the accepted job, click
  `Show on map`, prove that destination became active, then return to gameplay.
  This is the real player path and does not mutate localStorage.
- **A focused all-jobs stack with `GLITCH_ENABLE_ANIMA=0` cannot wait for an
  escort to walk itself.** Production escort movement belongs to native
  ECS/Anima; the Jobs Board scheduler mirrors the companion's authoritative ECS
  position and completes arrival. The focused browser gate must prove companion
  assignment/materialization, place that native ECS companion at the authored
  destination (the same boundary the scheduler unit uses), then prove scheduler
  completion and payout. Do not classify a no-Anima movement timeout as an
  escort gameplay failure, and do not weaken production to Redis-only movement.
- **Physical repair semantics and job requirements must agree.** A visible
  repair prompt is server-rejected unless a repair tool is equipped. The
  business catalog had two repair targets whose templates supplied parts but
  did not declare or explain the tool: `biome_repair_anchor_patch` and
  `repair_person_fixture_fix`. The field-target test now audits every business
  template label and requires any target resolving to `repair` to declare
  `requiredToolAction: repair` and tell the player to equip the tool.
- **A bounty marker is navigation, not kill evidence.** The public catalog
  reached the exact Elite Mucker marker and then called `completeQuest`, but
  the native authority correctly rejected it with
  `wrong_quest_target:muck_bounty_elite_mucker`: no post-accept kill existed in
  the player's server-owned TriggerState ledger. The catalog must attack the
  exact ranked production entity id, wait for its player-attributed native kill
  receipt, return to the authored map marker's eight-metre submission zone, and
  only then submit the objective. A ranked creature can stand or patrol more
  than eight metres from that marker, so submitting directly at the corpse can
  correctly fail `field_target_out_of_range`. On a reused exact-image world,
  revive that same fixed-id entity's combat row if its corpse is still inside
  the respawn window; never substitute a synthetic or different creature id.
- **Ground each bounty attack approach independently.** A ranked NPC's grounded
  feet Y is valid for its exact X/Z column, not automatically for a player two
  metres beside it. Reusing the creature Y for the neighboring Hex approach
  made the actor fall 22 metres and reset to the Grove before the kill receipt.
  Probe the candidate approach columns with the shared terrain grounder and use
  the first loaded, standable result. After a late fail-fast catalog error,
  resume the remaining public batch with `HARTHMERE_E2E_JOBS_RESUME_AT`; retain
  the earlier passing report rather than replaying already-green lifecycles.
- **Use the established live-player relocation helper for every Jobs Board
  warp, not only robot/Grove catalog fixtures.** On the current-source warm
  stack, the Hex bounty passed end to end. Before the next Harthmere mining job,
  two retryable jobs-board reads returned 504 while direct `/sim/player` plus
  ECS placement sat on sparse terrain; fall recovery moved the actor back to
  the Grove, so the later accept correctly rejected `must_be_at_jobs_board`.
  Jobs Board movement now uses `moveSnapshotGrovePlayer`, which moves camera,
  simulation, interest set, authoritative ECS, movement publication, nonlethal
  fixture health, and the temporary pose pin as one established path. Focused
  public and business catalogs may also abort exact background Chapter 1
  progress/story/gate polls during those relocations; classify only those exact
  `net::ERR_ABORTED` requests as transients, never a 4xx/5xx response.
- **Ground underground Jobs Board fixture feet before teleporting.** The first
  five current-source Exotic Matter jobs passed, including two Deep Spindle
  deposits. The third deep marker resolved to the cave's lower edge at Y=-36;
  placing the player exactly there opened DeathModal and exposed a React hook
  exception before the job action. The catalog now asks the existing
  `groundedHarthmerePosition` bridge for the nearest standable feet position at
  the same X/Z with `requireOpenSky: false`, then uses the stable relocation
  helper. If the terrain is not yet loaded it retains the established live
  relocation fallback. Do not add a cave-specific Y constant or reinterpret
  the map marker; objective authority remains the exact target and horizontal
  completion radius.
- **A native tool fixture must also refresh the client equipment projection.**
  Directly writing `Inventory.selected` and `selected_item` correctly gives the
  live-mode server authoritative repair/cleanup evidence, but it bypasses the
  player's Inventory UI. On July 29 the repair receipt therefore succeeded
  while the same visible F handler returned before submitting its Jobs Board
  completion because its local display projection still had an empty main
  hand. Fixture setup now aligns that client projection and dispatches the
  canonical inventory-change event; the server still independently validates
  the native selected item for both mutations. Product tool checks also prefer
  the server-reported live equipment snapshot once live authority is active,
  preventing stale local equipment after a real equip or unequip. Do not weaken
  the server gate or count the local projection itself as completion evidence.
- **Aim at a procedural prop's body, not the terrain beneath it.** The security
  watch post is a narrow, tall prop. The browser harness faced its authored
  anchor at `Y - 0.25`, so the cursor ray hit the ground before the post and
  clipped the proximity selector's allowed distance; the correct permanent
  prop existed, but `F Report Patrol` never appeared. Jobs Board interactions
  now face roughly chest height and retain a bounded overlay-refresh window.
  Keep failure diagnostics showing the last inspectable/overlay snapshot so a
  future missing prompt can be separated from placement, facing, and loading
  failures without replaying previously passed jobs.
- **Try a close stance before declaring a narrow prop unreachable.** The
  security post still produced a one-metre terrain cursor hit after the camera
  aimed at its body. The world-object fallback deliberately clips ordinary
  candidates to that hit depth, while the first catalog stance was 2.25 metres
  away. Jobs Board E2E now tries 0.65-metre cardinal stances before the ordinary
  approaches, matching what a player can do around a slim post without
  changing the product's occlusion policy or the server's authoritative range.
- **Retained test actors can physically shadow a resumed prop.** A failed
  security-post run left `NativeECS-A-6631575250` standing on the final
  approach. The next actor's cursor selected that old player and showed
  `F View Profile / G Follow` instead of the post action. Production now lets a
  tightly faced nearby world object beat an overlapping player-profile prompt,
  matching the existing object-over-NPC rule. The browser harness also moves
  only encountered `NativeECS-A-*` blockers out of the interaction cone; it
  never deletes or repositions ordinary players. Retain passed reports, but do
  not assume failed-run player positions are harmless fixture state.
- **Re-inventory active exact-image containers immediately before Chromium.**
  During this continuation the canonical Jobs Board v2 stack started on
  3017/4907 while an older 3047 stack remained active. Running both unified
  stacks exhausted Docker memory and the older one was OOM-killed after the
  browser exited. Do not rebuild or restart blindly: select the canonical warm
  container, require full lifecycle readiness, and leave the obsolete stopped
  container stopped. One browser lane also implies one heavy unified stack.
- **Ground the overlay candidate with the same live surface as its rendered
  prop.** The Redoubt target was authored at Y=46, but authoritative player
  placement at its exact X/Z resolved to the built apron at Y=53. The marker
  renderer already moved the visible post to Y=53; the overlay candidate stayed
  at Y=46 and rejected the correctly grounded player on its 3.5-metre vertical
  gate. Every permanent Jobs Board field target now uses the renderer's shared
  live grounder before entering overlay selection. When finishing a catalog on
  an already-built pre-fix image, the runner may use
  `HARTHMERE_E2E_ALLOW_PRE_DYNAMIC_FIELD_TARGET_IMAGE=1` only after proving the
  mismatch exceeds 3.5 metres; every such server-authoritative compatibility
  interaction is listed in `report.gates.preDynamicFieldTargetFallbacks` and is
  not evidence that the old image rendered the repaired prompt.
- **A visible prompt does not prove the key reached its handler.** On the
  retained farm-crate row the correct `F Deliver Crop Bundles` prompt rendered,
  but one `KeyF` produced no server receipt for two minutes. The catalog now
  retries the same real keyboard path up to three times, reasserting player pose
  and facing between attempts. A pre-fix-image compatibility interaction is
  allowed only after all three visible-prompt attempts lack a receipt, and is
  recorded with reason `visible_prompt_no_receipt_after_three_keypresses`.
  Current-source release evidence must still come from the repaired prompt/key
  path; never silently convert a missed key into a pass.

Retained failure evidence:

- `artifacts/harthmere-native-ecs-e2e/1785360953074-3012-report.json`
  (stale snapshot NPC/player collision prevented the first board warp);
- `artifacts/harthmere-native-ecs-e2e/1785361417997-4732-report.json`
  (first two public jobs passed; repeated cleanup exposed missing service-unit
  fixture actions and the client idempotency-key defect);
- `artifacts/harthmere-native-ecs-e2e/1785363796088-12398-report.json`
  (the harness incorrectly treated an item-source marker as a hand-in object);
- `artifacts/harthmere-native-ecs-e2e/1785364128630-13433-report.json`
  (the cleanup prop was not visible without its player-selected job pin);
- `artifacts/harthmere-native-ecs-e2e/1785364938213-15638-report.json`
  (the harness incorrectly waited for accepting work to steal the existing
  Road Ahead main-quest pin);
- `artifacts/harthmere-native-ecs-e2e/1785365643049-16252-report.json`
  (five complete public lifecycles passed; focused stack omitted Anima, so the
  native escort companion never received production movement evidence);
- `artifacts/harthmere-native-ecs-e2e/1785366910603-19948-report.json`
  (first business lifecycle passed; the next physical repair target exposed a
  missing repair-tool requirement shared by two business templates);
- `artifacts/harthmere-native-ecs-e2e/1785367569323-21209-report.json`
  (six public lifecycles plus escort passed; the first bounty exposed that the
  harness had navigation evidence but no exact native kill receipt);
- `artifacts/harthmere-native-ecs-e2e/1785368143238-25380-report.json`
  (the exact ranked kill and native receipt passed, then objective submission
  from the creature's position exposed the marker-radius return requirement);
- `artifacts/harthmere-native-ecs-e2e/1785368957680-28751-report.json`
  (the first seven public jobs, including the Elite Mucker kill, passed; the
  Hex approach reused the creature column's Y and the actor fell/reset before
  the player-attributed kill receipt);
- `artifacts/harthmere-native-ecs-e2e/1785381426210-68479-report.json`
  (the first remaining Hex bounty passed; retryable background 504s then
  exposed direct Jobs Board movement losing its board pose to fall recovery
  before the next Harthmere job accept);
- `artifacts/harthmere-native-ecs-e2e/1785381897488-71998-report.json`
  (five remaining Exotic Matter lifecycles passed; the final Deep Spindle
  marker placed the fixture at a non-standable cave-floor edge and opened the
  Death modal before the objective action).
- `artifacts/harthmere-native-ecs-e2e/1785382677802-73108-report.json`
  (the server accepted the visible repair and recorded its native receipt, but
  the fixture had bypassed the client equipment projection, so the F handler
  never submitted the matching Jobs Board completion).
- `artifacts/harthmere-native-ecs-e2e/1785383342964-74305-report.json`
  (the repaired anchor and design-studio jobs passed; the next narrow security
  post exposed the harness aiming below the prop and clipping its own prompt
  selection against the terrain hit).
- `artifacts/harthmere-native-ecs-e2e/1785383966315-75250-report.json`
  (the canonical v2 stack confirmed the cursor still hit terrain at one metre;
  the original 2.25-metre stance was outside the fallback's clipped radius).
- `artifacts/harthmere-native-ecs-e2e/1785384149065-75483-report.json`
  (a retained failed-run E2E player physically occupied the security-post
  approach and its profile overlay shadowed the job prop).
- `artifacts/harthmere-native-ecs-e2e/1785384459161-75859-report.json`
  (after stale actors were displaced, Redis proved the real blocker: the actor
  stood at Y=53 beside a target whose overlay candidate remained at Y=46).
- `artifacts/harthmere-native-ecs-e2e/1785384959691-76734-report.json`
  (security and portal-fuel passed; the farm crate rendered its correct prompt,
  but one keyboard attempt produced no server interaction receipt).

- **`node --check` does not catch missing runtime destructured imports.** The
  July 29 marker assertion referenced
  `NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION` without adding it to the CJS
  `require(...)` destructuring. Syntax and the static action-family contract
  both passed; the browser found the `ReferenceError` only after replaying the
  quest. When adding a new shared constant to the E2E runner, search for both
  its use and its import name before launching Chromium. Keep the failed report
  so a late harness error is not confused with a gameplay regression.

- **A world object created at a quest marker will not synchronize to a browser
  still standing hundreds of meters away.** The robot placement event and
  quest step succeeded, but the July 29 harness waited two minutes for the
  placed robot in a client whose subscription was still at the Grove start,
  roughly 230 meters from the Watchtower clearing. A physical E2E must move
  both `/sim/player` and authoritative `Position` to the marker first, wait for
  the local/scene poses, then perform the placement. Do not “fix” this by
  enlarging draw distance or weakening the mesh assertion—the player following
  the marker is part of the functionality being tested.

- **Use the existing Harthmere terrain grounder; never derive placement Y from
  an authored zone or a settled browser pose.** The canonical path is
  `groundHarthmereLiveEntityFeetYWithStatus` →
  `findHarthmereGroundFeetY`, with open-sky terrain checks and explicit
  `not-loaded` handling. The E2E bridge exposes that path as
  `groundedHarthmerePosition`. First stream the marker X/Z, wait until the
  grounder returns `grounded` for both approach and object columns, then use
  those exact positions. The July 29 attempts using authored Y=54 and later the
  player's settled Y=37 duplicated an existing system and were incorrect—the
  robot's column can have a different surface than the player's approach
  column.

- **A prompt assertion must prove which entity owns the prompt.** The first
  robot-setup rerun reached the placed robot, canonical mesh, setup objective,
  and marker, but then searched the DOM for any overlay containing Talk and
  Settings. A nearby NPC could own Talk while the direct native fixture had not
  mirrored the local placement-preview cleanup, and a post-placement approach
  reused the robot column's Y. The focused flow now clears only the local tail
  that the real primary-click placement path clears after `EndPlaceRobotEvent`,
  grounds every approach X/Z through `groundedHarthmerePosition`, and requires
  `/overlays` to report the placed robot's exact entity id before asserting one
  Talk and one Settings action. Do not infer interaction success from generic
  text elsewhere on screen.

- **Use the established live-player relocation helper for sparse terrain.** A
  later rerun correctly grounded the interaction column and synchronized both
  authoritative and local ECS at `[332, 38, -388.25]`, but direct `/sim/player`
  mutation let collision/fall recovery respawn the rendered player at the
  fountain. `moveSnapshotGrovePlayer` already solves this exact production-
  shaped test problem: it uses the product live-player teleport hook, persists
  the accepted pose, zeros velocity, gives the fixture nonlethal health,
  republishes movement, reasserts the scene, and pins only while the real
  interaction runs. Reuse it for distant robot interactions; do not create a
  third teleport/physics path.

- **Reconcile the robot id at the real post-placement interaction.** A reused
  snapshot world can briefly expose more than one owner-matched robot around a
  direct native placement, so the first `robot_component` scan is not a stable
  final identity. The July 29 evidence already showed the real cursor on
  `Biomes Bot` with exactly `F Talk / G Settings`, but the harness rejected it
  against its earlier id. After `EndPlaceRobotEvent`, accept only the inspected
  entity that authoritatively has `robot_component`, is created by the current
  user, is at the placement position, and routes to `npcs/helping_robot`; use
  that reconciled id for G, naming, and progression assertions.

- **Do not re-read already-proven robot invariants inside the prompt poll.** The
  next run showed the expected placed id and inspected id were both
  `1456753058260464`, with exactly `F Talk / G Settings`; a redundant group of
  ownership/mesh/position reads still rejected it because those reads can land
  on different HFC ticks. Placement already proves owner, `robot_component`,
  marker position, and `npcs/helping_robot`, while Settings itself is owner-
  gated. The final prompt poll should require the exact established entity id
  and exact actions, then move on to the G and naming behavior.

- **Resume durable state instead of replaying passed robot chapters.** Set
  `HARTHMERE_E2E_ROBOT_SETUP_CONTINUE_ONLY=1` together with
  `HARTHMERE_E2E_USERNAME_A=<saved actor>` and
  `HARTHMERE_E2E_ROBOT_SETUP_ROBOT_ID=<saved robot>` after the report has proven
  Muck vs. Machine, Gimme Shelter's Sophia handoff, placement, grounding, and
  mesh. The continuation lane refuses to reseed or normalize the actor. It
  requires that prior state, finds the already placed owner robot, and tests
  only the unfinished exact prompt, G→Settings, F→name, setup completion, map
  marker, and Chapter 1 main-quest handoff.

  Restore the browser-owned live player to the saved authoritative checkpoint
  before scanning its local `robot_component` interest set. A resumed actor can
  initially render at Grove spawn while ECS remains beside the Muck robot; a
  pre-warp local scan then returns no robot even though placement already
  passed. This is subscription setup, not a reason to replay placement.

  Take the numeric actor id and reconciled robot id from the same retained
  interaction report. Do not combine an actor from a later Redis inspection
  with an earlier pre-settlement robot id merely because both rows occupy the
  placement coordinate. The July 29 continuation retries mixed actor
  `8318790406490185` with robot `7524949572471247`, while the retained prompt
  proof belonged to actor `696678023605168` and reconciled robot
  `1456753058260464`; the mixed pair selected an overlapping non-owned robot
  and displayed only `F Talk`. Authenticate the retained actor by numeric id,
  verify the robot's `created_by` matches it, and never move either durable
  entity just to make cursor selection easier.

- **Local browser E2E tests functionality, not machine performance.** Docker
  scheduling, host load, software WebGL, asset work, and Redis size vary by
  computer. The July 29 run completed Muck vs. Machine, started Gimme Shelter
  and Chapter 1, then observed Sophia's correct authoritative handoff in 2.295
  seconds and 4.926 seconds on two runs. Rejecting that state because it crossed
  a 2-second budget was a harness mistake. The browser harness now records all
  timings but does not fail latency budgets by default. Its long operation and
  scenario timeouts remain hang guards: an extremely slow or missing state
  still times out and fails functionally.

  Run a latency benchmark only by explicit opt-in:

  ```sh
  HARTHMERE_E2E_PERFORMANCE_ASSERTIONS=1 \
    node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
  ```

  Never use that flag for ordinary local functionality sign-off. Do not change
  gameplay code, rebuild, or widen production behavior because a local timing
  number varies. A missing placement step, marker, robot, quest transition, or
  Chapter 1 continuation remains a functional failure regardless of timing.

- **Do not let the per-probe guard reintroduce a local performance gate.** A
  July 29 focused rerun had no browser failure and had already completed the
  first Muck vs. Machine leaf, but its next authoritative read exceeded the
  generic 30-second operation guard while the exact-image container was using
  roughly 629% CPU and generating local meshes. That is not evidence that
  “Meet with Sophia” failed. Robot-story functionality runs now use the same
  120-second per-probe ceiling as the other large snapshot batches; the full
  scenario timeout remains the hang guard. Keep the shorter 30-second probe
  guard for ordinary small batches.

The failed reports that established these rules are retained as:

- `artifacts/harthmere-native-ecs-e2e/1785347251435-63200-report.json`
  (stale NPC/player identity put targets outside the subscription);
- `artifacts/harthmere-native-ecs-e2e/1785347709825-63617-report.json`
  (functional progression passed; the old harness incorrectly failed a local
  timing budget by 295 ms);
- `artifacts/harthmere-native-ecs-e2e/1785348075881-65269-report.json`
  (warm repeat of the same correct fan-out at 4.926 seconds, establishing that
  local functionality runs must not enforce performance budgets);
- `artifacts/harthmere-native-ecs-e2e/1785348246642-66079-report.json`
  (focused actor replacement canceled a successful background Chapter 1 gate
  poll with `net::ERR_ABORTED`; server logs recorded HTTP 200);
- `artifacts/harthmere-native-ecs-e2e/1785348485548-67571-report.json`
  (the fountain anchor was legitimately corrected to the canonical stack
  start, so the exact-pose fixture waited for two minutes);
- `artifacts/harthmere-native-ecs-e2e/1785349165588-71333-report.json`
  (the functional flow reached the placement marker assertion, where a missing
  CJS destructured import caused a harness `ReferenceError`);
- `artifacts/harthmere-native-ecs-e2e/1785349541117-72164-report.json`
  (robot placement and quest progress passed, but the browser remained at the
  Grove and could not stream the robot created at the Watchtower marker);
- `artifacts/harthmere-native-ecs-e2e/1785350098467-73139-report.json`
  (the player reached the correct Watchtower X/Z but live physics settled at
  Y=37 instead of the authored zone metadata Y=54);
- `artifacts/harthmere-native-ecs-e2e/1785352454911-80916-report.json`
  (placement, quest progression, and canonical mesh passed; the harness then
  failed to prove the placed robot itself owned the Talk/Settings prompt);
- `artifacts/harthmere-native-ecs-e2e/1785353798079-85558-report.json`
  (no browser failure; one authoritative read hit the generic 30-second probe
  ceiling while the local exact-image stack was CPU-saturated);
- `artifacts/harthmere-native-ecs-e2e/1785354356872-86501-report.json`
  (canonical ground and ECS pose passed, but direct simulation mutation fell
  through sparse local terrain and respawned the rendered player at Grove);
- `artifacts/harthmere-native-ecs-e2e/1785355178445-87633-report.json`
  (real robot overlay rendered exactly one Talk and one Settings, but the
  harness compared it to an earlier pre-settlement robot id);
- `artifacts/harthmere-native-ecs-e2e/1785356171988-90582-report.json`
  (expected and inspected robot ids matched and the exact prompt rendered; a
  redundant multi-read validation layer rejected the already-proven state);
- `artifacts/harthmere-native-ecs-e2e/1785357496953-92584-report.json`
  (resume-only lane scanned the Grove-spawn subscription before restoring the
  saved Muck approach pose, so the already placed robot was not local yet).

The release report must distinguish product failures from environment failures
and must list the exact report path, image tag/digest, and slot-cleanup state.

### 4.0 Do not confuse contract coverage with live experience coverage

Chapter 1 dungeon data can describe a battle, escort, puzzle, attrition rule,
or failure consequence while the production client only exposes the matching
quest trigger. A green pure-data suite proves the contract it asserts; it does
not prove the player saw or felt the mechanic.

Audit dungeon work in two batches:

1. run the complete fast contract slice once;
2. in one warm authenticated browser, jump to the start of every unfinished
   zone and exercise success, failure, recovery, HUD feedback, authoritative
   consequence, reward, and quest advancement.

Record passed zones and exclude them from the next browser batch. If a zone's
signature mechanic has no production client/server implementation, stop
calling it "tested" and record it as an implementation gap; do not burn time
replaying the portal or quest chain around it.

### 4.1 Spawn at the thing under test

The observer route parses the first three slug segments as coordinates, so you
can spawn AT a checkpoint instead of walking there:

```sh
node scripts/harthmere/e2e-jump.cjs url busted_chest
# http://localhost:3000/at/528.5/67/-96.5/-0.85/0?hideChrome=1&allowSoftwareWebGL=1
```

Every checkpoint's coordinates come from a shipped contract
(`NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC`, `CH1_ANCHORS`, the generated
placement map) and the source is printed next to it, so the test targets cannot
drift away from the content they test.

`e2e-jump.cjs list` shows all of them: the prologue chain, every Chapter 1 act
beat, both gates, and both dungeon arrivals.

### 4.2 Skip the prerequisite steps

Walking Road Ahead to reach a Busted bug costs many minutes per iteration.
`e2e-jump.cjs seed <checkpoint>` prints the state-advance payload instead:

```sh
node scripts/harthmere/e2e-jump.cjs seed busted_chest
```

It is **print-only by design** — review it, then POST it through the live-mode
writer yourself. A GET must never mutate state (that rule is in the ECS
source-of-truth doc and it exists because a read endpoint once ticked stamina).

### 4.3 Check readiness correctly

```sh
node scripts/harthmere/e2e-jump.cjs ready
```

The helper uses the cheapest probe that is safe for each service:

- web must answer HTTP with `200`, `401`, or `403`;
- Redis must answer a real RESP `PING`; a TCP proxy can remain listening after
  its Redis upstream is removed, so connect-only produced a false green and a
  three-minute browser bootstrap timeout. Sync remains TCP-only — never curl
  the sync/WebSocket port;
- after the external web check, the helper enters the current unified-app
  container once and checks the remaining required services' metrics `/ready`
  endpoints (logic, sync, trigger, shim, and Bikkie). Those endpoints turn
  green only after registry/bootstrap completion. Web is not probed twice: its
  external origin already proves both the process and the port mapping.

Do not restore whole-log lifecycle scraping. Asset-heavy browser sessions can
produce more than 32 MB of request logs; on July 26 that overflowed the helper
and reported `container-logs` even while the stack was healthy. Internal ready
probes are bounded, belong to the current container generation automatically,
and cannot combine stale lifecycle rows with newly opened sockets. A listening
sync or HTTP port alone is still insufficient: the measured production stack
accepts traffic well before every service registry is ready.

The bounds include host scheduling headroom: 10 seconds for the external web
probe and 20 seconds for the one `docker exec` that checks all internal ready
ports in parallel (each internal HTTP request gets five seconds). The amd64
production image and Chromium can briefly starve a three-second probe on Apple
Silicon even though every service is healthy.

Focused physical-interaction tests must also use short, local pose gates. A
bad camera anchor is deterministic once collision settles; waiting the global
two-minute scenario timeout only hides that the fixture itself is wrong. The
Busted chest now gives player/chest synchronization and obstructed-cursor
prompt routing 20 seconds each, then prints the authoritative and live scene
poses so the anchor can be corrected without replaying the quest.

After stack readiness, wait for the in-page game readiness signal before
asserting on gameplay; React mounting alone does not prove that ECS resources
and the route's player or observer streaming authority are ready.

Never point a focused E2E run at the bare site root. `/` is a splash route that
redirects to `/at` while dropping `syncBaseUrl`, `e2e_run`, and the native-ECS
flag; the page can look healthy while connecting to remote Sync and waiting
forever for the local actor hook. The shared runner normalizes `/` to `/at`
before adding query parameters. Keep that normalization in the harness instead
of relying on every shell invocation to remember the route suffix.

The unified launcher's listener watchdog is controlled by
`GLITCH_STACK_TCP_WAIT_TRIES`, not `GLITCH_STACK_HTTP_READY_WAIT_TRIES`.
Raising only the latter does not protect web startup. A restored 300k+ entity
world exceeded the old five-minute TCP default and the launcher killed a
healthy logic/sync bootstrap before web opened its socket. Focused native E2E
now defaults the TCP wait to 1,800 one-second probes (30 minutes); this changes
only the maximum failure bound and adds no delay once the listener is ready.

#### Promo/cutscene readiness is a three-part contract

Do not open a raw `/at/...?...cutscenePromo...` or
`cutscenePromoBatch=...` URL in a fresh browser. An observer page can render a
WebGL frame while still showing **Login to Play**. That is not capture-ready.
After visual auth, `/at/` is still an observer client rather than a gameplay
player, so the correct authority is `ClientIo.swapSyncTarget` through
`__biomesObserverStreamingDebug`. A gameplay route instead uses
`__harthmereLivePlayerDebug.teleportTo`. Without the hook appropriate to the
route, the result is empty sky or an old nearby shard even though
`__biomesCaptureReady` is true.

Always generate the gated URL:

```sh
node scripts/harthmere/e2e-jump.cjs promo-batch-url chapter1-visual-repair \
  --captureRun=6
```

The returned URL enters through `/dev/harthmere-visual-auth`, establishes the
local test player, and redirects to the exact warm-batch observer URL. The
capture code then waits for all three signals, in this order:

1. stack lifecycle is ready (`e2e-jump.cjs ready`);
2. the engine renderer publishes `__biomesCaptureReady`;
3. the route's authoritative streaming hook publishes
   `biomes:promo-streaming-ready`, then confirms the interest set moved before
   the cutscene begins: player teleport on gameplay routes, observer sync-target
   swap on `/at/` routes.

**Permanent regression rule:** never use a fixed sleep or fixed timeout as
evidence that player/observer streaming is ready. Renderer readiness commonly
arrives first. Capture waits on the authoritative ready event; the browser
harness may still have an overall timeout so a broken run terminates, but that
timeout is only a failure ceiling and never a readiness signal.

Treat **Login to Play**, a missing route-appropriate hook, or an unconfirmed
interest-set move as a hard pre-capture failure. Do not weaken that guard and do
not keep reloading the raw URL. Fix authentication/entry once, then resume the
batch. The failed Chapter 1 run on July 25, 2026 stopped before overwriting any
PNGs; that safe failure is now preserved by source assertions in
`promo_scenes.test.ts` so future test work does not repeat it.

The visual-auth bridge must install both halves of the test session before it
redirects: the HttpOnly auth cookies for HTTP and `harthmere.biomesAuth` for the
sync WebSocket upgrade. A page showing **Observing Location** after visual auth
means the mirror was not installed; do not wait longer or reload it repeatedly.
The bridge now receives the newly created session id from the already-gated
visual-test endpoint and writes the mirror before `/at` mounts.

When a density pass changes structures, run the camera-to-terrain contract in
the fast visual batch before opening the browser. Test the complete dolly, not
only its endpoints. Resume with a group containing only unfinished scenes (for
example `chapter1-winter-final-resume`); never repay already-written captures
because one later composition intersected a new wall.

### 4.4 Keep the stack warm

Restarting the stack per test is the single biggest browser-loop cost. Start it
once and keep it; use a fresh browser context (not a fresh stack) per case. The
runbook's memory rules still apply: one Chromium context at a time, serial not
parallel, `NODE_OPTIONS=--max-old-space-size=3072`.

The local production launcher now gives Redis and the unified app an
`unless-stopped` restart policy, a real health check, and a 15-minute default
idle window for native E2E. For focused native browser gates it waits only for
`web logic sync trigger shim bikkie`; unrelated workers can finish warming in
the background. Override that set with the space-delimited
`LOCAL_STACK_READY_SERVICES` variable when a specialized gate needs more.

On the next rebuilt stack, `HARTHMERE_NATIVE_ECS_E2E=1` also defaults
`GLITCH_FOCUSED_NATIVE_E2E_STACK=1`. That topology embeds Ask's RPC/indexes in
the already-required Logic replica and does not start separate Ask, Chat, OOB,
Sidefx, or Notify processes. The current full stack measured 12.8 GiB in the
app container; the omitted processes accounted for roughly 6 GiB of RSS
(including ~2.5 GiB Ask and ~2.3 GiB Sidefx). The current warm stack is left
untouched; measure the focused topology after the next image build rather than
restarting just to adopt it. Set `GLITCH_FOCUSED_NATIVE_E2E_STACK=0` for a full
local rehearsal or any gate that explicitly needs those services.

Focused stacks also start Trigger beside Sync. Both services independently
hydrate the same 300k+ entity snapshot and neither requires the other's
listener, so serializing them added an entire second multi-minute bootstrap to
every cold browser batch. Their existing metrics readiness and Redis
consumer-group gates still run before Chromium starts; only the independent
work is overlapped. Full production rehearsals retain their historical stream-
worker ordering.

#### Chapter 1 Elsewhen terrain preflight

The Chapter 1 quest and dungeon browser lanes require the 109 authored
Elsewhen terrain shards in Native ECS. Current production-shaped boots create
any missing Chapter 1 shard IDs even when broad Harthmere town terrain
generation is disabled; existing terrain is never overwritten.

For a warm stack created before that reconciliation was installed, inventory
the dedicated shard set without changing state:

```sh
GLITCH_REDIS_PORT=6390 CH1_SEED_TERRAIN_ONLY=1 \
  node scripts/harthmere/seed-chapter1-native-e2e.cjs
```

If the report shows missing rows, install the complete set once, in bounded
batches, while preserving the warm Redis snapshot:

```sh
GLITCH_REDIS_PORT=6390 APPLY=1 CH1_SEED_TERRAIN_ONLY=1 \
  node scripts/harthmere/seed-chapter1-native-e2e.cjs
```

Rerun the read-only command and require `create: 0`, both per-dungeon `missing`
counts to be zero, `portalOnlyWorldBoundary: true`, and
`repairRetiredElsewhenBoundary: false` before launching the dungeon campaign.
WorldMetadata must end at the ordinary Harthmere edge (X=2560); the detached
Elsewhen shards beyond it are reachable only through signed fracture-gate
warps. An open web port is not evidence that either dungeon's terrain or its
authoritative sync bounds are present.

When a production-shaped container is recreated manually, the browser runner
does not inherit its control token or Redis port automatically. Export
`HARTHMERE_E2E_CONTROL_TOKEN` from the active container without printing it,
and set all Redis host/port aliases to the warm snapshot before launching the
batch. A missing token fails before Chromium opens; an omitted port silently
targets the historical 6389 default and wastes a run on the wrong environment.

Treat these as executable preconditions, not notes: require a nonempty token,
`PING` the selected Redis port, verify the active image tag, and require the web
runtime endpoint before changing world state. Also read `WorldMetadataId`
through `RedisWorld` and require a `world_metadata` component whose east edge is
X=2560. A Redis `DBSIZE` or TCP success is insufficient: on July 27 DB 0 held
336,849 entities while the metadata ID had been overwritten by a temporary
Mucker fixture.

That overwrite exposed a second hard rule. Test fixtures must obtain entity IDs
through the ECS-collision-aware allocator, never the raw database allocator.
The raw `/api/admin/allocate_id` path once returned the occupied
`WorldMetadataId`; creating and killing a fixture at that ID let the respawn
service replace world metadata with a D-Mucker. The route now filters every
candidate through authoritative `worldApi.has`. Keep the focused allocator
unit test and do not bypass it with a locally invented fixture ID.

When remapping a deterministic NPC ID from one authored family to another, an
ECS update is not a complete migration. Components absent from the new entity
payload remain on the old row. The Chapter 1 cast/bandit collision left
`expires`, prisoner locks, and old Anima movement state attached to correctly
renamed actors. Reclaim those IDs with an explicit delete followed by create,
then verify label, spawn position, health, and the absence of stale components.

Detached Elsewhen bounds apply to Anima as well as player collision. NPC tick
logic must test an actor inside a Chapter 1 slot against that slot's local AABB;
testing every NPC only against ordinary WorldMetadata kills escorts and bosses
as `outOfWorldBounds` even though their portal-only terrain is valid. Keep both
the positive slot assertion and the negative unassigned-gap assertion in the
fast Chapter 1 suite.

Large warm worlds need a world-size-aware readiness budget. The July 27 stack
had to index more than 300,000 entities and became healthy after the original
three-minute container-swap loop expired. When logs show the indexed entity
count increasing and the container remains running, continue the same bounded
readiness poll; do not restart a healthy bootstrap or rebuild the image. The
post-ready browser gate still decides whether the stack is usable.

Do not create a second full-snapshot Redis/app pair merely to isolate a long
catalog on a memory-constrained workstation. The July 28 Bible attempt loaded
the 335k-entity snapshot twice and the isolated Redis was OOM-killed with exit
137 during final Sync/Trigger indexing. Reuse the already-ready production
stack, cache unrelated read-only HUD polls in the focused browser harness, and
retain completed row IDs instead. A second stack is only cheaper when memory
headroom has been measured before importing the snapshot.

NPC catalog fixtures must wait for `.npc-quest-dialog-container` to mount
before dispatching a snapshot-refresh event. Setting `/game_modal` schedules
React work but does not prove that the talk hook has registered its listener;
refreshing immediately can lose the event and falsely report a missing offer.
After refresh, prove the target offer against the returned authoritative
snapshot before waiting on its rendered button. This separates server
activation defects from React timing failures in seconds.

Start focused Web only after Logic RPC is listening. On the July 26 warm-stack
repair, Logic still had to index 335,834 entities; opening Web earlier cached a
failed Logic channel and made the first browser page wait several additional
minutes even though the remaining services were healthy. The focused launcher
now waits for port 3504 before binding Web. Full production rehearsals retain
early ingress because their availability contract is different.

The focused Shim starts with `--bootstrapMode empty` and skips its player
spatial observer. In this topology every gameplay authority already uses
Redis/HFC, while separate Chat/Notify/OOB processes are intentionally omitted;
loading the complete ECS snapshot into Shim's unused in-memory world and chat
indexes only delayed Logic/Sync/Trigger startup. Full unified rehearsals keep
Shim's normal synchronized bootstrap.

For Chapter 1 portal work, compile and test the entire seam together with
`tsconfig.ch1gate.json` plus the three-file fast Mocha batch documented in the
Chapter 1 runbook. Do not use the broader Chapter 1 config as the inner loop:
it intentionally includes cloud-save draft work, so an unrelated persistence
type error can hide whether the portal/API/HUD change itself compiles. The live
browser loop is also one warm pass covering both gates and both directions.

For the production inner loop, bind-mount the checkout's built `.next` and
`dist` directories read-only into the already-running app container. Rebuild
only the client/server output that changed, restart the app container once,
and preserve the Redis container. This avoids rebuilding and loading a
multi-gigabyte Docker image after every fix. Once the browser campaign is
green, package those exact validated outputs into one final image; do not make
an image rebuild part of every browser iteration.

Do not replace or delete the bind-mounted `.next` directory while the app
container is running. Docker keeps the old directory inode mounted, so a new
host directory with the same path can look complete to the shell while the
container still sees an empty or stale tree. Before restarting the warm app,
verify `.next/BUILD_ID`, `.next/server`, and `.next/static` both on the host and
through the existing mount. Build or copy contents in place; if the directory
inode was replaced, recreate only the app container against the finished
build. Repeated browser reloads cannot repair a stale bind mount.

The July 25 Chapter 1 packaging run measured why this matters. Even with the
dependency layers cached, Docker transferred a **695.77 MB** build context,
then spent about **32.4 s** copying `public/buckets`, **12.4 s** copying
`public/assets`, and **36.4 s** exporting layers. None of that work was related
to the small quest/state patch under test. Treat a full image build as the
single packaging gate after the warm browser batch. A future stack change
should split immutable public assets into a reusable base layer (or use a
purpose-built slim context); until then, rebuilding per assertion is a known
test-stack defect, not a valid debugging loop.

Artifact validation must also stream across bundles instead of concatenating
the entire `dist/` and `.next/` trees. The old checker could exceed V8's string
limit, catch the resulting error as if one file were unreadable, and then
falsely report a marker missing from `dist/web.js`. The checker now scans each
bounded file independently and retains only the set of matched needles.

### 4.5 Run one dungeon as one batch, then stop

`HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER` skips retained passing objectives.
`HARTHMERE_E2E_CHAPTER_1_STOP_AFTER` terminates immediately after the repaired
dungeon, so a mechanics change never pays for Act 4/6 or the other dungeon.

Desert batch:

```sh
HARTHMERE_E2E_CHAPTER_1_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=quests \
HARTHMERE_E2E_SKIP_VIDEO=1 \
HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER=ch1_a3_q02_pack_for_it/the_pack_check \
HARTHMERE_E2E_CHAPTER_1_STOP_AFTER=ch1_a3_d1_the_sand_that_remembers/d1_the_long_walk \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Winter batch:

```sh
HARTHMERE_E2E_CHAPTER_1_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=quests \
HARTHMERE_E2E_SKIP_VIDEO=1 \
HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER=ch1_a5_q03_pack_for_the_cold/rooks_rope \
HARTHMERE_E2E_CHAPTER_1_STOP_AFTER=ch1_a5_d2_the_long_winter_mouth/d2_the_breaking_year \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

The runner derives Redis port `6390` before loading the Redis connection module
when the web base URL uses port `3017`. Do not add another command-line Redis
override to every invocation; the module captures its port during import, so a
late override is ineffective.

Focused dungeon fixtures must seed canonical native ECS inventory as well as
the Redis read model: `clean_water`, `coal`, and `wall_lantern`. Redis-only
aliases such as `water`, `fuel`, or `torch` are not a valid production fixture.
The next native status projection replaces them from ECS, which previously
made supplies appear to vanish halfway through a healthy run. The provisioning
matcher also understands legacy `b:<BiomesId>` spellings, but tests should use
canonical semantic ids whenever one exists.

Every stat-bearing dungeon leaf must use the signed Chapter 1 completion route.
A native `near_location` leaf completes before the route can apply water, fuel,
light, health, stamina, carry-weight, or AUGUR consequences. The fast mechanics
test now rejects any dungeon mechanic accidentally authored that way.

### 4.6 Checkpoint a long quest family instead of replaying it

The Chapter 1 quest gate is linear: one blocked objective prevents every later
objective from being exercised. The runner writes a report after each
completed objective and can resume after the last retained pass:

```sh
HARTHMERE_E2E_CHAPTER_1_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=quests \
HARTHMERE_E2E_SKIP_VIDEO=1 \
HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER=ch1_a4_q05_the_man_who_didnt_accuse/show_him \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

A resume checkpoint must reconstruct **both** halves of production state:
native challenge/trigger progress and the durable Chapter 1 live-mode slice
(inventory grants/consumes, fragments, choices, flags, skills, and testimony).
Seeding only the trigger map previously let resumed tests reach objectives with
an impossible empty ledger. The runner now persists every passed authored leaf
to its report immediately and rebuilds live story state through the requested
checkpoint, so a later infrastructure failure never requires replaying an
already-green objective.

Do not turn synchronized fixture warps into microbenchmarks. The local
software-WebGL path crosses browser simulation, admin ECS write, logic,
firehose, and subscription state; July 25 measured a correct 9.5-second warp.
The 15-second gate adds no delay to faster runs and prevents valid state from
being rejected by the old 8-second assertion.

Use that same 15-second failure ceiling for deterministic quest-target fixture
creation. A July 26 warm-stack run delivered a correct target through the same
admin ECS -> Logic -> Firehose -> Sync -> browser path in 12.16 seconds; the
former 10-second target gate rejected it before any quest action ran. This is a
maximum bound, not a fixed sleep, so faster deliveries still continue at once.
The robot-story batch now applies that ceiling to all origin-sync fixtures,
including the initial player fixture; leaving the generic one-second gate in
place caused a correct 1.88-second synchronization to fail before Road Ahead
started.

Resume seeding marks no-giver quests `in_progress` and giver-backed quests
`available`, matching their production start contracts. The browser still
completes every remaining objective through the real prompt and API route; it
does not mark the remaining steps complete behind the test's back.

Run the remaining objective family in one Chromium context. If it stops, fix
all failures found in that batch, retain every completed checkpoint, and
resume once. The prompt poller is deliberately single-flight and completion
uses a synchronous busy ref so slow production requests cannot overlap and
double-submit. Reports include the route action, challenge id, and step id so
a timeout says which authority request failed rather than only saying that a
button stayed visible.

Storage-container cells are icon-first. Item names appear in hover tooltips,
not as permanently rendered text, so browser gates must not wait for a label
such as `T-Shirt` to become visible after the container opens. Assert one
visible non-empty cell icon per authored item, then prove the exact item ids
through the authoritative inventory delta. The July 26 Road Ahead failure
screenshot showed all six correct clothing icons while the obsolete text
locator waited for two minutes. For the Clothing Crate, do not use Take All as
the release proof: click-transfer one of the three tops and one of the three
bottoms, require both choice leaves to fire, and assert the four unchosen
variants remain in the crate. Billy's single-item toolbag can still use Take
All.

The BiomesUI backpack follows the same visual pattern but exposes each item as
an accessible button named with the player-facing label (and optional `xN`
count). Road Ahead deliberately has three buttons named `T-Shirt` and three
named `Jeans`, so `.first()` is not a stable selector after Take All. Resolve
one eligible item from authoritative inventory and select its exact
`data-inventory-ref="item:<index>"`; then prove that exact ID reached Wearing.
The quest requires one top and one bottom to be equipped. Keep the separate
container assertion that all six authored variants are present and transfer,
but do not equip every cosmetic variant or replay the quest per variant.

If Road Ahead has passed through `Return to Billy with your new clothing`, use
the checkpoint below for Billy's Toolbag onward. It seeds the exact prior
trigger leaves plus their 210 XP, so final level/stat assertions remain honest
without replaying the clothing crate:

```sh
HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE=1 \
HARTHMERE_E2E_ROBOT_STORY_CHAPTER_ID=6193612340426932 \
HARTHMERE_E2E_ROAD_AHEAD_TOOLBAG_ONWARD=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Before sending an in-world `F` interaction after a modal/dialogue sequence,
focus `canvas.biomes-canvas`, the pointer-lock manager's authoritative target.
Do not use `canvas.first()`; inventory/profile previews can render an earlier
off-screen Three.js canvas that accepts focus but never receives gameplay
shortcuts. A visible prompt proves proximity and facing, but
headless Chromium may still leave keyboard focus on the closed inventory UI.
The same rule applies after entering Camera mode: refocus the canvas before the
`F` selfie flip. If the toolbag, pick return, Robot Shell, and Camera reward are
already green, resume at the selfie with the exact prior 270 XP and required
inventory instead of replaying them:

```sh
HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE=1 \
HARTHMERE_E2E_ROBOT_STORY_CHAPTER_ID=6193612340426932 \
HARTHMERE_E2E_ROAD_AHEAD_SELFIE_ONWARD=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Focused headless mode deliberately removes Pointer Lock. The camera HUD only
registers its top-priority `F` world-interaction candidate while Pointer Lock is
held, so a nearby NPC candidate can consume `F` before HotBar's bubble listener
receives it. The runner attempts the real key for five seconds. Only when it
also proves `document.exitPointerLock` is absent may it publish the exact
production `ChangeCameraModeEvent` through the browser event queue. Do not add
a second global timeout waiting for synchronized `player_behavior`: the
authoritative quest input is the validated `/api/upload/photo` payload and its
`postPhoto` firehose event with `cameraMode: "selfie"`. Continue immediately to
that upload, quest-leaf, XP, and completion proof. Never use this fallback in a
pointer-lock-capable browser; a real key failure there is a product regression.

After the selfie upload has fired its native photo leaf, use the final-handoff
checkpoint instead of replaying Camera mode. It carries the proven 285 XP and
Robot Shell, then runs only Jackie's final handoff, completion bonus, and level
UI assertions:

```sh
HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE=1 \
HARTHMERE_E2E_ROBOT_STORY_CHAPTER_ID=6193612340426932 \
HARTHMERE_E2E_ROAD_AHEAD_FINAL_HANDOFF_ONLY=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Use the visible `Exit Camera` button for no-pointer-lock cleanup. It exercises
the supported recovery control without letting a capture-phase keyboard
listener turn a completed photo objective into a two-minute `X` timeout.

Level-stat verification must remain mounted for several client ticks after the
server award. `PlayerScript.updateMaxHealth()` is another authoritative writer:
its base must come from native progression before adding equipment modifiers.
A hard-coded `100 + modifier` can make the trigger transaction briefly write
140 HP and then silently reset it to 100 before the browser assertion. The
release gate therefore checks the settled ECS Health value and the Skills UI,
not only the immediate XP/level delta.

### 4.7 Batch browser assertions in one context

Do not turn one UI surface into five separate browser invocations. The focused
quest-journal gate runs J-key navigation, all status filters, Failed counts,
quest detail, the 720px responsive stack, and Show on Map in one authenticated
production-browser session:

```sh
HARTHMERE_E2E_QUESTS_UI_ONLY=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

The retained July 25 pass is
`artifacts/harthmere-native-ecs-e2e/1784963562747-35318-report.json` (33 seconds,
two scenarios, zero browser/network failures). The Busted chest-onward pass is
recorded at scenario level in
`artifacts/harthmere-native-ecs-e2e/1784962944155-29904-report.json`; every
authored Busted action passed. Its final red status came only from three known
local profile-picture 404s, now classified by URL as transients instead of
anonymous console failures. Do not replay Busted merely to obtain a green
timestamp.

Do not run `next build` and `next dev` against the same checkout — both write
`.next` and a mixed tree produces `Cannot find module './undefined'` errors
that no amount of reloading will fix.

When a browser case targets an actor seeded directly in Redis/ECS, authenticate
the visual-test bridge with the actor's numeric Biomes ID, not only its label.
Username lookup goes through the user database; if that database does not
contain the Redis-seeded actor, the bridge can create a second "shadow" player
with the same requested name. The UI then looks authenticated but shows the
wrong quest state. A numeric ID binds the HTTP cookie and sync-session mirror
to the exact authoritative actor. The browser gate must compare the visible
quest/state to the seed before making assertions; do not clear caches or replay
the test until that identity check passes.

### 4.8 Cloud Save rollout gate (one browser batch)

Generate the local URL instead of assembling it by hand:

```sh
HARTHMERE_E2E_URL=http://127.0.0.1:3017 \
HARTHMERE_E2E_SYNC_PORT=4907 \
  node scripts/harthmere/e2e-jump.cjs cloud-save-url <install-id>
```

The emitted URL always includes `harthmere_native_ecs_e2e=1`,
`syncBaseUrl=http://127.0.0.1:4907`, and `glitch_auto_play=1`. They are one
local-test contract. Omitting the sync override makes the 3017 browser build
try its fallback web-port-plus-one endpoint and enter a long WebSocket 1006
reconnect loop; the page can look mounted while Cloud Save and ECS bootstrap
are still unusable.

Run restore, simulated rollout, and guest exclusion in one warm-stack batch:

1. Open the non-guest URL once and verify visible level, gold, inventory, and
   quest state. Do not replay completed quest objectives.
2. Copy the one Redis `player_state:<stable-game-actor>` value to a temporary
   test-only Redis key, delete only that actor key, and reload the same URL.
3. Verify `listSaves` re-created the actor with
   `rehydratedFromCloudSaveVersion`, then verify the same visible HUD/inventory/
   quest values. Restore the temporary backup only if the gate fails; delete
   the backup after a pass.
4. Navigate the same browser to the guest install and verify the session says
   `guest: true`, `cloud_save: false`, with no `listSaves` or `storeSave` call.

Cloud Save payload validation is batched with this gate. The live decoded
Glitch limit is **50 MB**; the older pasted document's 10 MB value is stale.
The proxy's 72 MB JSON parser ceiling only supplies Base64 and envelope
headroom—the decoded payload validator still rejects anything above 50 MB.

An existing slot-0 `is_conflicted: true` record is not permission to choose a
winner. A 409 should pause autosave and be reported as an existing user
conflict. Never turn the rollout gate into a destructive conflict-resolution
test.

If live `listSaves` exceeds the upstream timeout, stop the destructive portion
of the gate immediately and restore the temporary Redis backup. The July 25
gate observed two 10-second HTTP 504 timeouts from Glitch; it restored both
actor records and removed the backup keys instead of retrying indefinitely.

### 4.9 Reclaim project build space without damaging other work

Large local release loops can leave tens of gigabytes in this checkout's
`.next/cache`, `node_modules/.cache`, stopped `biomes-*` containers, and BuildKit
records descended from Biomes image builds. Prune only those project-owned
records while preserving the active app, Redis, proxy, current images, source
assets, and all non-Biomes Docker state.

Do not use a global Docker prune as a convenience shortcut. First identify the
active container/image ancestry and the Biomes build-record IDs, then remove
only stopped project containers, superseded project images, and non-shared
BuildKit records from that ancestry. The July 25 cleanup reclaimed 98.94 GB of
BuildKit cache and raised free disk from 4.2 GB to 117 GB without restarting the
validated warm stack.

### 4.10 Wait for ECS readiness, not merely HTTP completion

Native object creation has two independently scheduled success points: the API
can return after materializing an entity while the browser is still waiting for
that entity's ECS components over sync. A fixed delay, or opening a modal as
soon as HTTP returns, produces intermittent empty UI even though the server is
correct.

For native containers, wait until the exact private container id has a client
`/ecs/c/container_inventory` component before opening StorageContainer. Keep
the product wait bounded (15 seconds) so a broken sync path surfaces a real
error. The focused browser assertion allows up to 30 seconds because that gate
covers API materialization **plus** ECS delivery under the software-WebGL local
stack; it still requires the visible Water-logged Muck Buster and real Take All
button, so the larger budget does not weaken acceptance.

The retained green proof is
`artifacts/harthmere-native-ecs-e2e/1785051944333-63437-report.json` (37 focused
Busted scenarios). Do not replay it unless the quest-container overlay,
native-container API, ECS sync, StorageContainer, or Busted authority contract
changes.

A Redis-only restart can leave DB 3 empty while the already-running Bikkie
service and game processes still hold the loaded snapshot tray. Do not rebuild,
restart the app, or reload the 1.2 GB world merely to let the host-side E2E
inspect quest trigger trees. The robot-story runner first reads Redis and, only
when that tray is empty, streams the `bikkie` entry from
`snapshot_backup.json` into its own in-process `BikkieRuntime`. This fallback is
read-only: it must never save the tray or mutate the shared warm Redis.

### 4.11 Sweep old quest props without waiting for full snapshot hydration

The focused empty-Shim stack intentionally reaches gameplay before Sync has
hydrated all 335k snapshot entities. An old quest prop may therefore exist in
authoritative Redis while being absent from the focused client's initial table;
waiting longer or repeatedly teleporting the player does not make that a useful
inner-loop test.

For prop-model F-prompt sweeps, read and validate the exact authoritative source
first. If that source is not synchronized, create a temporary nearby ECS entity
with the source's unchanged label, placeable item, quest-giver, dialogue, and
placement components; exercise the real overlay/input path, then delete the
fixture immediately. Record both the shipped source id and whether the sync
fixture was needed. This preserves content identity while avoiding a full-stack
hydration wait. Do not use this fallback for reward/progression assertions:
those still target the immutable shipped entity, as the Spare Robot Parts gate
does.

### 4.12 Batch Bible rows without repeating shared three-minute failures

Bible and cross-map Grove markers can carry `Y=0` as an unresolved authored map
height even though the live terrain is near `Y=53`. The production teleport
hook already chooses a safe default height when Y is omitted. The browser
runner must reuse the hook's returned `after` pose for the ECS fixture and
movement event; writing the original zero afterward strands the player below
terrain and turns every row into a three-minute movement timeout.

The Bible fixture's frontend refresh is a read-only operation. Retry only
`harthmere_live_fetch_timeout`, with a small bounded backoff, rather than
failing a quest because a saturated warm Redis/API read exceeded one browser
fetch. Do not retry assertions, dialogue actions, quest mutations, or unknown
errors under this rule.

Run the 76 rows as ten serial groups (eight IDs per group, four in the final
group), retain each checkpoint report, and aggregate failures before changing
code. Verify the first full group after a shared runner repair before launching
the remaining nine; this still tests in batches but prevents one common defect
from consuming the whole catalog timeout budget. A wrapper loop must propagate
SIGINT instead of treating exit 130 as an ordinary failed group and starting
the next batch.

#### Do the catalog walk at tier 1 and 2 first

Most of what those ten browser groups used to discover is now decidable from
authored data. Run these before opening a browser:

```sh
scripts/harthmere/t.sh bible        # 105 tests, ~2.9 s wall
scripts/harthmere/t.sh bible:e2e    # all 85 quests, 340 steps, ~10 ms
scripts/harthmere/t.sh types:bible  # ~13-15 s; t.sh bible does NOT typecheck
```

`bible_waypoints.test.ts` asserts that **no** shipped waypoint resolves to
`Y=0`, across all 340. That is the specific defect this section was written
about, and it now fails in about a second instead of costing three minutes per
affected row. `bible_e2e_playthrough.test.ts` additionally proves every quest
is reachable, every prerequisite chain terminates, every objective has an
addressable native step id, and the Q1–Q12 spine cannot be played out of order.

The browser tier's remaining job is the physical interactions those cannot
cover: prompts, dialogue buttons, real movement, and authoritative mutation.
Seed straight to the row instead of replaying:

```sh
node scripts/harthmere/seed-bible-quest-step.cjs <questId> [stepId]
node scripts/harthmere/seed-bible-quest-step.cjs --arc main   # list with grounded coords
```

Because Bible progress is now native `Challenges`/`TriggerState`, a checkpoint
is two integers per completed leaf — the seeder emits them, and its
`targetWorldPosition` is already grounded, so the strand described above cannot
be reintroduced by the fixture. It is print-only by design: review, then POST
it through the live-mode writer. A GET must never mutate state.

### 4.13 Test Recipes-key ownership and location-less markers as one UI seam

The July 26 production HAR made the `R` failure deterministic: immediately
after the key press the game fetched `live_mode_daily_state`, proving the
replacement tab rail captured `KeyR` and opened Today before native
`ShortcutsHUD` could open Recipes. `R` now has one owner everywhere: the native
Recipes/handcraft modal. Today has no direct key; the replacement HUD says
`Open Recipes`, farming quick actions do not consume `R`, and the map uses
`Home`/`End` for center/reset instead of advertising another `R` binding.

Keep the recipes-only shortcut controller mounted in replacement mode. The
full legacy shortcut controller would revive E/I/M/C/V/O conflicts, while
hiding it entirely makes Busted's `Handcraft 0/8 Muck Busters` instruction
impossible. A browser acceptance check is one key press: the authoritative
result is a visible dialog named `Recipes`, not a Today-tab fetch or a merely
highlighted tutorial cue.

Location-less native objectives still require a map row. Resolve them in this
order: the exact active aid; any live aid for the same quest; the nearest
authored adjacent NPC/position (next contact before previous); the quest giver;
then the player's current position as an honest “can be completed here” anchor.
Original-snapshot quest-giver biscuits frequently have no `beamPosition`, so a
quest-giver-only fallback is not sufficient. Also fingerprint
`MapManager.localNavigationAids`: it mutates the same `Map` in place after async
NPC/entity resolution, and React memoization by Map identity alone leaves the
map panel stale until reload.

For fast tests, keep shortcut ownership and navigation-aid revision helpers in
data-only modules. Importing `ShortcutsHUD` or the full live adapter under
`.mocharc.fast.json` pulls PNG assets that intentionally need the normal test
bootstrap. Run pure key/marker contracts in one fast batch; use the normal
Mocha bootstrap only for the narrow rendered-component assertions that need
client assets.

**Recorded mishap (2026-07-29, material-guidance batch):** do not mix one
asset-importing rendered component test into a `.mocharc.fast.json` batch of
pure shared tests. The missing `/public/...png` require aborts module loading
before any assertions run, so the whole batch produces no useful pass/fail
signal. Split it up front: shared/data tests in one fast process, rendered
client tests in one normal-bootstrap process.

For that rendered process, use `./b test -p '<brace-glob>' ...`; it supplies
the required `TS_NODE_COMPILER_OPTIONS={"module":"commonjs"}` and
`MOCHA_TEST=1`. Calling `mocha --config .mocharc.json` directly under the
current Node runtime loads `global_setup.ts` as ESM and fails at its
`require.extensions` asset hook before any tests execute.

**Recorded mishaps (2026-07-29, current-source live-browser retest):**

- Do not name a zsh shell variable `status`; zsh reserves it as read-only. A
  Redis-clone readiness loop that assigns `status=...` exits before the copy is
  made. Use a descriptive name such as `bgsave_result`.
- Do not launch asset-importing TypeScript tests with raw
  `node -r ts-node/register... mocha`. That bypasses the repository's
  CommonJS test environment and loads `global_setup.ts` as ESM, failing at
  `require.extensions` before any assertion. Use the documented
  `./b test -p '<brace-glob>'` wrapper; the corrected material batch passed 11
  assertions in one process.

### 4.14 Focus recipe and hunt objectives without replaying the story

When a browser repair targets Get the Muck Out's recipe or Muckling steps, do
not replay Road Ahead, Busted, or the opening Moe dialogue. Create one ordinary
visual-test player, then move that exact numeric actor to the unfinished step:

```sh
GLITCH_REDIS_PORT=<active-redis-port> \
  node scripts/harthmere/seed-get-muck-out-browser-step.cjs \
    <player-id> craft

GLITCH_REDIS_PORT=<active-redis-port> \
  node scripts/harthmere/seed-get-muck-out-browser-step.cjs \
    <player-id> mucklings
```

The fixture marks only predecessor leaves as fired and leaves the target leaf
unfinished. Authenticate the browser with the same numeric player id, wait for
the authoritative player/HUD-ready state, and then test the visible prompt,
map marker, synchronized NPCs, and gameplay mutation. Renderer readiness or a
fixed timeout is not player readiness; starting assertions before the live
player hook arrives repeats the same false failure across every test surface.

The matching automated regression stops after the production Muckling leaf:

```sh
HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE=1 \
HARTHMERE_E2E_ROBOT_STORY_CHAPTER_ID=817959262145055 \
HARTHMERE_E2E_GET_MUCK_OUT_RECIPE_HUNT_ONLY=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

It still performs the two opening claims through the real browser, observes
the persistent Recipes hint, crafts the Whacker, verifies the hunt is the active
map/minimap destination with six live Mossy Mucklings outside protected areas,
rejects an unrelated NPC type, kills both restored production Muckling families,
and audits quest plus combat XP. It deliberately does not replay the ten
already-green objectives after the hunt.

For a grouped Mucker-statue inscription repair, skip the recipe, hunt, later
NPC handoffs, race, and reward crate. The focused checkpoint seeds only the six
completed predecessor leaves, then requires the real four canonical snapshot
plates to expose `F Read`, complete through their authored dialogue buttons,
and advance the exact native trigger ids:

```sh
HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE=1 \
HARTHMERE_E2E_ROBOT_STORY_CHAPTER_ID=817959262145055 \
HARTHMERE_E2E_GET_MUCK_OUT_INSCRIPTIONS_ONLY=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Do not substitute a nearby duplicate inscription or synthetic NPC target in
this gate. The production defect is specifically that each canonical plate is
embedded in parent statue geometry, so its own group can be the nearer cursor
hit and occluder. The browser proof must target source ids `6372088708496489`,
`3581242026396485`, `7136298330826795`, and `6644971495189655`.

The May 2026 quest biscuit exact-matches the legacy Mossy Muckling type, while
the restored world visibly spawns West Breach and Gravewood Pale Mucklings.
Compatibility belongs only on this exact quest leaf. Keep the original event
predicate unchanged for every other `npcKilled` objective, and make the E2E
kill at least one restored type so a legacy-only synthetic fixture cannot pass
while production enemies fail to count.

Place the marker at a production-grounded cluster containing at least six
compatible live entities, not at an old authored area center. Verify both the
map row and authoritative ECS rows (label, type id, position, and positive
health). A source seed list alone does not prove the warm world actually
materialized those enemies.

Restored Mucklings also award normal combat XP. The quest E2E must account for
that separately from per-step quest XP: two production kills can legitimately
change progression by combat XP plus the one-shot quest award. Do not weaken
the total-XP assertion or mistake the combat award for duplicate quest XP.

After a client or trigger repair, validate the exact built marker in `.next`
and `dist`. Webpack's persistent server cache can report a successful build
while reusing a stale bundle; rerun the server bundle with `--no-cache` when
the expected symbol is absent. Keep `.next`, `dist`, and `public` bind-mounted
read-only into the warm app container so this swap never requires rebuilding
the full image or replacing Redis.

The focused software-WebGL stack has capacity for one browser campaign, not an
interactive in-app renderer plus a second headless release gate. Close the live
inspection tabs before starting the automated browser batch. July 27 proved
that leaving both renderers active let background live-mode reads reach 14–17
seconds and prevented the second client from installing its ready bridge within
120 seconds, even though the web and sync ports stayed healthy. This is
resource contention, not permission to increase every timeout or rerun passed
quest actions.

### 4.15 Route restored combat quests by quest id plus step id

Original-snapshot combat biscuits can reuse a trigger leaf id across unrelated
quests. `Combat · Seedy Sappers` and `Combat · Juggment Day`, for example, both
use step `8176836229585103` while requiring different enemy families. Never add
enemy compatibility or an inferred marker by trigger id alone. Use the
composite `(questId, triggerId)` in the server matcher, client map adapter, and
test fixture, and include a negative cross-quest assertion.

Before choosing a marker, batch-inventory the grounded production seeds by
native type and rendered creature family. The marked pack must contain enough
live targets to finish the objective. When one pack is intentionally smaller
than the required count, advance the marker from the first pack to the next
using authoritative leaf progress; the eight-Juggermucker route points at its
first verified four-pack until `4/8`, then at the second four-pack. This is
faster and more
honest than adding synthetic enemies or leaving the marker on an exhausted
location.

Keep dungeon fights out of this compatibility table. Dungeon encounters are
linear, scoped lands with their own objective routing; adding mainland world-
map pins for those fights creates a second, conflicting navigation authority.

After a warm app restart, open TCP ports are only a process-liveness signal.
Web can accept the socket while Logic is still loading the Redis entity index,
and the first `/api/harthmere/visual_test_auth` request may reset. The browser
runner now retries that authoritative auth endpoint with bounded attempts under
the existing global timeout, then continues to the live-player hook. Do not add
a fixed sleep or rerun a quest batch after this pre-action readiness failure;
no gameplay assertion has started until visual auth succeeds.

During the same warm-start window Chromium can abort one initial `POST
/sync/oob` while replacing its startup subscription. The legacy combat runner
records that exact `net::ERR_ABORTED` as transient and continues only while its
marker, authoritative actor, and live-pack gates still succeed. Broader OOB
errors remain fatal, and a persistent sync problem still times out the real
functional assertion.

The freshly loaded client may also cancel its best-effort `POST
/api/client_error` telemetry request during that same startup navigation. The
legacy combat runner treats only that exact aborted telemetry request as a
transient; the marker and live-enemy assertions remain authoritative, and all
other failed same-origin requests remain fatal.

Marker-only combat audits do not inspect placeable rendering. In low-memory
mode, synchronizing a distant production pack can surface an unrelated
`/init/scene/placeable/mesh` resource assertion from nearby scenery. That exact
console error is transient only in marker-only mode; the same error stays fatal
for combat and ordinary gameplay runs, while the marker and synchronized NPC
row gates still have to pass.

The four-route legacy combat batch intentionally teleports one low-memory
client among distant production packs. Its frontend marker/entity sync gate is
20 seconds rather than the one-second ordinary-origin SLO; a July 27 warm
restart measured the first valid marker at 13.4 seconds. This remains a bounded
gate, but it prevents a correct cross-world synchronization from being reported
as a quest failure.

If an earlier routed quest has already passed before a later live-pack audit
finds drift, resume the same batch without replaying it:

```sh
HARTHMERE_E2E_LEGACY_COMBAT_ROUTES_ONLY=1 \
HARTHMERE_E2E_LEGACY_COMBAT_RESUME_AT=7520814984799849 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

The resume value is the first quest that still needs coverage, not the last
passing quest.

Synthetic kill targets in this marker/compatibility batch use one HP. Their
purpose is to emit one real authoritative `npcKilled` event for the restored
type, not to measure weapon DPS. A ten-HP fixture requires two unarmed hits;
firing the second immediately tests attack cooldown instead and can stall a
correct quest behind an intentionally rejected hit.

For a final map/content audit that must not replay passed combat, use the
marker-only mode:

```sh
HARTHMERE_E2E_LEGACY_COMBAT_MARKERS_ONLY=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

One browser actor activates all four quests serially, verifies each exact map
projection, moves through every production pack, and requires the synchronized
live enemy count. Juggement Day receives an unfinished `4/8` fixture payload so
its second marker is checked without emitting kills or completing the leaf.
The marker-only assertion does not require the routed quest to replace Road
Ahead as the selected main quest: it requires the quest to be in progress and
its map marker to remain available, which is the switching-quests contract.

---

## 5. Suggested loop

```
edit ──► t.sh watch <preset>        (~1 s, continuous)
     └─► t.sh gate                  (batched changed-surface handoff)
     └─► t.sh full                  (minutes, before a PR)
     └─► e2e-jump url <checkpoint>  (seconds, when it must be seen)
     └─► full browser gate          (release only)
```

The rule of thumb: **push verification down**. A physical traversal bug caught
by a 1-second voxel flood fill is a bug you never spend twenty minutes
reproducing in a browser. The two dungeon bugs found this way — an act flag set
on the wrong event, and a floor slab sealing a stair shaft — would each have
cost a full stack boot plus a manual walk to discover.

## 6. Files

| Path                                                   | What                                                 |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `.mocharc.fast.json`                                   | Bootstrap-free mocha config                          |
| `scripts/harthmere/t.sh`                               | Test presets, watch mode, scoped typecheck           |
| `scripts/harthmere/e2e-jump.cjs`                       | Browser deep links, Cloud Save URL, seeds, readiness |
| `scripts/harthmere/seed-get-muck-out-browser-step.cjs` | Focus Get the Muck Out recipe/hunt steps             |
| `tsconfig.ch1check.json`                               | Fast scoped typecheck (~3 s)                         |
| `tsconfig.biblecheck.json`                             | Bible catalog typecheck (~13-15 s)                   |
| `scripts/harthmere/seed-bible-quest-step.cjs`          | Jump to any Bible objective, grounded coords         |
| `docs/harthmere/BIBLE_TO_CH1_MIGRATION.md`             | Why the Bible catalog is shaped like Chapter 1       |
| `tsconfig.ch1renderer.json`                            | Client-graph typecheck (slow, incremental)           |
| `NATIVE_ECS_BROWSER_E2E_RUNBOOK.md`                    | The release gate (unchanged)                         |
| `CHAPTER_1_E2E_RUNBOOK.md`                             | Chapter 1 browser checklist                          |
