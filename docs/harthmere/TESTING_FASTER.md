# Testing Faster — Local and Browser

Every number below is measured in this checkout, not estimated.

## TL;DR

```sh
scripts/harthmere/t.sh ch1        # 196 tests, 4.6 s   (was 8.1 s)
scripts/harthmere/t.sh bible      # 105 tests, 2.9 s   — Bellbound Dragon catalog
scripts/harthmere/t.sh bible:e2e  # all 85 quests / 340 steps, ~10 ms
scripts/harthmere/t.sh quests     # focused quest/container contracts
scripts/harthmere/t.sh ui         #   9 tests, 1.1 s
scripts/harthmere/t.sh icons      # inventory assets, native aliases, UI, types
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

**Do not run the Chapter 1 dungeon traversal beside two TypeScript projects.**
The two memoized flood fills normally fit the five-second test ceiling, but a
July 31 batch ran them while `tsconfig.ch1check.json` and the full client graph
were both compiling. Both traversal assertions timed out even though the same
deterministic paths passed serially. Run one scoped compiler at a time, after
the Mocha batch; parallelizing three CPU-heavy checks makes every lane slower
and creates false timeout failures.

**Do not use the repository-wide `tsc --noEmit` as a Chapter 1 smoke check.**
On July 31 it exhausted a 4 GiB Node heap after nearly a minute while the
documented scoped projects were available. Run `scripts/harthmere/t.sh types`
for shared Chapter 1 code and `scripts/harthmere/t.sh types:client` when client
rendering/UI files changed; each command already supplies the required 8 GiB
heap and avoids paying for unrelated graphs.

**Zod output defaults are required in parsed cutscene types.** A helper that
spreads a validated `CutsceneDef.cast` and appends a new raw anchor must write
the anchor's `required` and `fallback` schema defaults explicitly. Otherwise
TypeScript combines an output shape (defaults required) with an input shape
(defaults optional) and reports two unrelated-looking cast types. This is a
type-shape fix, not another scene revision.

---

## 3. Choosing a lane

| You changed…                               | Run                        | Cost                              |
| ------------------------------------------ | -------------------------- | --------------------------------- |
| Chapter 1 data/logic                       | `t.sh ch1`                 | 4.6 s                             |
| Quest containers, F prompts, world objects | `t.sh quests`              | 0.8 s                             |
| A BiomesUI tab                             | `t.sh ui`                  | 1.1 s                             |
| Inventory icons or item presentation       | `t.sh icons`               | one focused serial release lane   |
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

**Inventory item identity has three player-visible spellings.** Generated icon
catalogues are normally keyed by semantic ids such as `item_grey_card` and
`raw_meat`, but native ECS inventory can project the same stacks as a decimal
Bikkie id or `b:<id>`. An icon test that exercises only the semantic key can be
green while the live inventory falls back to initials. Use `t.sh icons`; its
exhaustive assertion resolves every generated entry through all three forms,
checks every PNG, exercises InventoryTab image rendering, runs the static
startup contract, and then performs the scoped typecheck. Preserve native art
before the initials fallback for items outside the replacement catalogue.

### When the fast preset is not enough

If a suite passes under `full` but fails under fast, it needs the bootstrap —
it imports Bikkie item data, the ECS gen layer, a server handler, or the
trigger engine. That failure _is_ the signal. Run it with `full` and add a note
to the header comment in `t.sh` so the next person doesn't rediscover it.

---

## 4. Browser testing

### Reconcile only when persisted world data changed

A routine application Docker build does **not** require terrain or broad world
reconciliation. Skip those jobs when the release changes only client/server
code, UI, dialogue, quests, tests, or immutable assets. Run reconciliation only
when the release intentionally changes terrain or another persisted authored
world record, such as seeded buildings, roads, NPC identities/positions, or a
reviewed data migration. Reusing reconciliation as a generic image-readiness
step wastes substantial time and resources and can introduce unrelated world
failures into an otherwise application-only release.

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
- **Read dialogue paging state from the element that owns it.** The Chapter 1
  stock-dialogue portal carries `data-chapter1-dialogue-page` on its root; it
  is not a child marker. A descendant lookup made a visible Wake Up dialogue
  wait for two minutes and fail before sending its valid completion request.
- **Do not start duplicate scoped typechecks.** `t.sh gate` already includes
  `tsconfig.ch1check.json`. Run either `t.sh gate`, or an explicit parallel
  batch that omits the separate `t.sh types`; never both at once.
- **Do not use obsolete Mocha bootstrap paths.** The supported single-file
  command is `scripts/harthmere/t.sh file <path>`. Do not invent a direct
  `mocha --require src/server/test/register.ts` command.
- **`./b test <file>` still expands the repository-wide default glob.** It
  launches `src/**{/test/*.ts,/*.test.ts}` plus the requested file, so it is not
  a focused inner-loop command. Use
  `node_modules/.bin/mocha --config .mocharc.fast.json <file>` (equivalently,
  `scripts/harthmere/t.sh file <file>`) for a bootstrap-free single-file run.
- **Ad-hoc esbuild UI harnesses need explicit JSX and exact-import aliases.**
  The CLI `--alias` option rejects subpath names such as `next/dynamic` and
  `@/client/...`; use an `onResolve` plugin for those exact imports. Also point
  the harness build at a tiny tsconfig with `jsx: react-jsx`, or the repository
  `jsx: preserve` setting can leave raw `<...>` syntax in the browser bundle.
- **Focused compiler-API checks must model Next static image imports.** A
  virtual `/public/*` declaration typed as `string` makes every downstream
  `.src` access fail. Use the `StaticImageData` shape (`src`, `height`, and
  `width`) when a narrow client-root typecheck does not load Next's asset
  declarations itself.
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

- **Quiesce browser pages that survived a stack restart before launching a new
  E2E context.** A live `/at` page can reconnect the moment Sync becomes ready
  and immediately resume its Harthmere polling loops. On August 1 that stale
  client saturated the freshly warmed web process while the new E2E page spent
  its entire 120-second navigation budget waiting for `DOMContentLoaded`.
  Navigate old observer/game pages to `about:blank` (or close them), wait for
  their requests to stop, then launch the focused runner. This is separate from
  the lifecycle gate: every service can correctly report `UP` while a surviving
  browser client is still making the test lane non-quiescent.

- **Classify aborted background state reads by payload, not HTTP method.** The
  Chapter 1 gate/progress/story clients use `POST` for read-only state polling.
  A navigation or component teardown can therefore produce `net::ERR_ABORTED`
  on those background requests after every authoritative scenario has passed.
  Treat only `chapter1_progress`/`chapter1_story` requests whose body has
  `action: "state"` (plus the read-only `chapter1_gate` endpoint) as transient.
  Never blanket-allow aborted POSTs: actual progression mutations must remain
  browser-gate failures.

- **Do not waive SwiftShader shader failures when the captured world is
  black.** The focused runner defaults to `--use-angle=swiftshader` for a
  deterministic software lane, but the current macOS Chromium/Three renderer
  can report `Shader Error error:1282 validateStatus:false` and render only the
  HUD. Preserve that failure and screenshot. On a Mac with a usable graphics
  backend, rerun the same unchanged batch with
  `HARTHMERE_E2E_ANGLE=metal`; the launcher omits the unsafe-SwiftShader flag in
  that mode. A successful Metal batch plus the final in-app-browser pass is the
  visual gate. Do not add the shader error to the console allowlist.

- **Chapter 1 marker Y is not always player feet-Y.** Outdoor objectives use
  the production marker convention (one block above scanned feet), while live
  collision settles the player to feet-Y; the July 30 exact-image run reached
  Jackie's correct X/Z at Y=69.875 for marker Y=71 and an exact 3-D warp gate
  timed out. Chapter 1 E2E now keeps X/Z strict and permits only 3.25m of
  vertical settlement, which is still below the Road-House's four-block floor
  separation. Do not flatten hilly-world targets or increase every objective
  radius to compensate for a synchronization assertion.

- **Use the Chapter 1-specific no-video variable.** The runner reads
  `HARTHMERE_E2E_CHAPTER_1_SKIP_VIDEO=1`; the shorter
  `HARTHMERE_E2E_SKIP_VIDEO=1` is ignored. A fast quest-only rerun that uses the
  wrong name silently pays for cutscene video work and invalidates timing
  comparisons.

- **Do not treat the Chapter 1 completion-response listener as a latency
  benchmark.** On the July 30 exact image, `kit_check` sent the correct signed
  challenge/step request and the server returned HTTP 200 at the old 24-second
  listener boundary while mesh generation and background reads were active.
  The focused runner allows 40 seconds for that response, then still requires
  the exact signed native progress and story consequences. Preserve those
  authority assertions instead of shortening the transport wait or replaying
  a completion that already committed.

- **A complete Chapter 1 browser walk must acquire external objective
  inputs through real vendor transactions, but never replace chapter-authored grants.**
  `Gather Parts` correctly rejects a fresh actor without 4 scrap metal, 2 iron
  ingots, and 1 tree resin; the browser must open the real material guide,
  select a normal map/minimap/HUD destination, and buy those canonical items
  through the shipped vendor mutation. A direct inventory or Redis fixture
  masks the exact player-facing failure this gate exists to catch. Tea and the
  AUGUR-9 core cell are different: prior Chapter 1 objectives grant them, so
  the browser gate must require those real grants instead of silently seeding
  replacements. Compute the prior authored grant/consume balance for every
  inventory objective and acquire only the externally sourced remainder.
  The resume/checkpoint replay must use the same rule before applying retained
  objectives; otherwise any checkpoint after `gather_parts` fails before the
  browser starts because it cannot reconstruct the materials already consumed.
  Vendor-bought crafting materials are intentionally deposited into native
  Materials storage. Chapter 1 requirement checks, turn-ins, and the browser
  gate must count and consume both the backpack/hotbar and that storage;
  checking only `inventory.items` recreates the reported “I bought it but the
  quest says it is missing” deadlock.
  Because this focused lane deliberately does not replay the prerequisite robot
  story, it also reconstructs the retained 75-gold starter wallet and the paid
  Work the Board job rewards. That is prerequisite/economy state, not an item
  fixture: every supply still comes from a real vendor transaction and remains
  rejectable for a wrong vendor, bundle, price, or insufficient balance.
  Restore that checkpoint gold in both the live-mode persistence record and
  the native ECS currency bag. Vendor authority reads the native wallet;
  restoring only the legacy record creates a false
  `vendor_rejected:insufficient_gold` failure on a fresh snapshot actor.
  A material-source map pin is scoped to the quest and objective that opened
  it. When that objective completes, require the normal main-story marker to
  replace the vendor/gathering pin; otherwise the HUD can advance while the
  minimap continues pointing at an obsolete supplier.
  For objectives whose evidence belongs to another system (Jobs Board or a
  vendor), Chapter 1 must not register its own world-interaction candidate
  while `blocksChapterInteraction` is true. The owning board/vendor keeps `F`;
  Chapter 1 polls the resulting evidence and auto-completes only when ready.
  When resuming after those already-proven steps, reconstruct their paid-job
  wallet/ledger and supplier transaction evidence as well as the native trigger
  leaves. A trigger-only checkpoint silently removes the money later supply
  objectives legitimately depend on.
  Testimony expressions must resolve to one canonical native ECS actor. Preserve
  the reviewed snapshot appearance/wearing components for witnesses already in
  the May snapshot, seed player-like NPCs only for missing labels, never borrow
  a real player entity, and delete only Chapter 1's known temporary duplicate.

- **Provisioning objectives derive their inventory from the gate contract,
  not `step.inventoryRequirements`.** `provision` and `provision_winter` use
  `ch1ProvisioningFor(...)`, so a generic inventory fixture otherwise sees zero
  requirements and presses `F` against an empty seven/eight-category pack.
  Buy canonical economy identities through their actual suppliers: for example
  `road_ration`, `hearty_stew`, `road_repair_kit`, `field_medkit`, and
  `patched_cloak`. The production classifier must recognize those exact
  outputs too; aliases such as `bread` and `winter_coat` are not proof that the
  items sold or crafted by the live economy can pass the authored checklist.
  Reuse the same gate-derived requirements during resume replay so a checkpoint
  after the pack check retains the supplies required for real gate admission.

- **Do not make Chapter 1 steal `F` from the system that owns the evidence.**
  `take_jobs` must show the normal Jobs Board prompt while three post-acceptance
  Grove completions are still missing, and `meet_the_suppliers` must leave each
  vendor interaction in control while its transaction is missing. Their
  Chapter 1 requirements deliberately set `blocksChapterInteraction` and
  `autoCompleteWhenReady`; the browser gate should install production-shaped
  external evidence, verify every routed supplier target, and wait for signed
  auto-completion. Waiting for a second Chapter 1 prompt recreates the duplicate
  HUD/control bug the integration was designed to remove. The board can render
  through either its dedicated world prompt or the production Unified HUD's
  `Read Jobs Board` button; require a visible built-in control, not one renderer's
  private test id. Close any interactive game renderer before this headless
  campaign: if the focused player enters `icing` or loses challenge components,
  treat that as session/resource contention and prove the external requirement
  reached `ready` before diagnosing Chapter 1 auto-completion.

- **Normalize Chapter 1 actors before page navigation, not after the quest
  checkpoint.** The July 30 reused snapshot allocated a fresh test username to
  an actor at `[3504.82, 65, -360.62]`; Sync correctly detected it outside the
  production bounds and reset it after `take_jobs` had already completed,
  replacing the checkpoint with a default `Local Biomes Player`. Apply the
  canonical safe start, display label, player status, health, and removal of
  NPC-only components before opening `/at`; then require both authoritative and
  local readback before any Chapter 1 fixture. The client can still publish its
  one default create-player row after the preflight, so reassert the same
  normalization once the browser bridge is live and require that second version
  locally. Include Chapter 1 in the focused client-stability/tweaks path so
  ordinary movement publication cannot undo deterministic cross-world warps.

- **Client-context readiness can precede the delayed player-mesh createPlayer
  row.** On the July 30 exact image, the bridge was ready and the actor had been
  normalized twice while the full-screen loader was still waiting on
  `player_mesh`; the eventual bootstrap row restored `Local Biomes Player`,
  changed the route, and aborted a read-only `chapter1_story` state poll even
  though Web returned HTTP 200. Before installing a Chapter 1 checkpoint, wait
  for the loading wrapper to clear and reassert the normalized actor once more.
  Treat only aborted `action: "state"` Chapter 1 polls as transient; an aborted
  objective/completion mutation remains fatal evidence.

- **A reused snapshot actor can still have one queued Anima write after its NPC
  components are removed.** The clean Chapter 1 run allocated an id whose old
  body was wandering near `x=3291`; after the pre-navigation update, Anima
  restored its `npc_state`, remote position, 100 HP, and void-recovery `icing`.
  Once the bridge is live, do not wait for that stale row to become correct on
  its own. Clear `npc_metadata`, `npc_state`, `icing`, and NPC preview state,
  then reapply the complete normalized player row until authoritative and local
  state agree. This remains a test-actor cleanup, never a production NPC move.

- **Clear pending native warp state too.** A reused player can have local state
  at the safe start while its authoritative row still carries `warping_to` for
  an older Grove-fountain recovery. Every normalization write then appears to
  succeed locally and is superseded at authority. Remove `warping_to` with the
  NPC/icing cleanup and continue requiring both authoritative and local
  agreement before installing the checkpoint.

- **An unavailable third-party HLS embed is not a Chapter 1 media failure.** An
  offline Twitch channel near the player reports `Player stopping playback`,
  `MasterPlaylist`, and `ErrorNotAvailable code 404` without including its URL
  in the console line. The request log still identifies the external
  `usher.ttvnw.net` playlist. Treat only that exact embedded-playlist signature
  as transient. Same-origin media HTTP errors, Chapter 1 voice failures, and
  other playback exceptions remain fatal.

- **Temporarily lock deterministic escort fixtures, then restore them.** On a
  fully loaded Anima stack, Iris's queued roaming tick overwrote the E2E move to
  the desert return aperture before the HFC-backed 22-meter escort check read
  it. Writing position alone is therefore a race. Apply native
  `LockedInPlace` with the deterministic escort position, require the same
  authoritative readback used by completion, and restore the actor's prior
  lock state immediately after the signed objective response. Do not increase
  the escort radius or bypass the server requirement.

- **A committed escort lock can trail one queued move.** The focused Breaking
  Year checkpoint wrote Nadia's target position and `LockedInPlace` together,
  but HFC then observed one already-queued Anima movement at her prior camp
  position while retaining the new lock. A deterministic escort fixture must
  reassert the same locked position at a bounded cadence until authority sees
  both fields together, then restore the original lock state after the signed
  completion. A lock bit by itself is not proof that the target position won
  the final write race.

- **A failed focused dungeon run can retain its slot for three minutes.** Gate
  claims intentionally survive short disconnects and refresh every 750 ms, so
  an aborted browser immediately followed by another winter run may receive
  “Another party is inside.” Confirm the prior actor disconnected and wait for
  the exact `harthmere:ch1:slot:<dungeon>` TTL to expire (or release only that
  actor's claim through the normal helper). Do not treat an occupied lease as a
  quest, terrain, or provisioning regression.

- **Close a same-user capture page before opening its replacement.** Local-user
  Sync sessions are exclusive. The July 30 cutscene recorder opened the next
  isolated page first, so the prior page received the stale-session modal,
  shut down renderer/audio, and forced nearly every scene through a poisoned
  retry. Mark the old page as intentional, close it completely, then open and
  load the replacement. For branded software-WebGL stills, register one
  `waitForFunction` on the output element; do not subject the compositor's
  long main-thread frame to the ordinary 30-second gameplay probe timeout.

- **A projected dialogue is mandatory, not a 1.5-second optional probe.** The
  `tell_sil_why` objective correctly rendered its two-page “An Answer Without
  Words” sequence after a loaded-stack delay, but the runner had already
  returned “no dialogue” and was waiting for the choice behind page 1. When the
  state response contains objective dialogue pages, wait the full bounded UI
  budget and fail explicitly if they do not render. Keep the short optional
  probe only for objectives whose server projection contains no dialogue.

- **Budget chained cutscenes as one uninterrupted sequence.** Act 6's `the_word`
  launches consolidation, the revised corridor, and the fourteen-hour intake
  through one playback coordinator, with the next scene requested immediately
  on the prior `finished` event. Waiting for `/scene/cutscene.active === false`
  therefore cannot budget only the scene active when the wait begins. Sum the
  remaining authored shot ceilings from the current sequence member, then add
  the bounded renderer allowance. A visible subtitle inside the next member is
  progress, not a hung director.

- **Thin-ice objectives require an explicit load decision.** The complete July
  30 campaign correctly reached `d2_whale_road`, but the E2E fixture still
  carried every external provisioning item from the Grove. The production
  scheduler therefore applied the authored 15-damage ice failure and recovered
  the player to `[3309.5, 66, -343.5]`; the runner misreported that intentional
  recovery as a synchronized-warp timeout. Before Whale Road (55 lb) and the
  stricter Breaking Year return (45 lb), require the state projection to show
  `cracking`, leave nonessential native Harthmere stacks behind while preserving
  story items and remaining coal, then require the same projection to show
  `holding`. A serialized browser diagnostic prints native `Map` components as
  `{}` and the reused snapshot username may legitimately be `Local Biomes
Player`; neither is evidence that the player entity or quest state was reset.

- **Incremental Chapter 1 leaves are supposed to reject before their final
  visit.** `collect_testimonies` records one of twelve accounts per real
  conversation, and `the_three_answers` records one of three routed speakers.
  A `rejected` response with `N of total` is durable partial progress, not a
  failed objective. The browser gate must follow the server-projected next
  target, prove its prompt/dialogue and exact coordinate, require the native
  leaf to remain unfired on every partial visit, and accept `completed` only on
  the twelfth/third visit.

- **Resume replay must reconstruct every durable partial visit.** A retained
  checkpoint after `collect_testimonies` or `the_three_answers` cannot call the
  live-story reducer once and expect a completed objective: the reducer
  correctly throws `Ch1ObjectiveIncomplete` while banking visits 1–11 or 1–2.
  Replay the full authored route, carry `error.runtime` into the next visit,
  reject an early completion, and require final effects only on the last stop.
  Otherwise a valid late-chapter resume fails before Chromium can exercise the
  product behavior under test.

- **Story conversations staged at a Fracture Gate must outrank gate entry.**
  `say_the_sentence`, `the_three_answers`, `call_the_collapse`, and
  `rooks_rope` deliberately put Halden at an active aperture. Giving the gate
  and story candidates the same dispatcher priority makes registration order
  choose `F — Enter` and hides the conversation. Keep `chapter1Story` above a
  distinct `chapter1Gate` priority; the gate still outranks active tools and
  ordinary ECS objects when no story candidate is present.

- **Build server bundles through `server.webpack.config.cjs`.** The former
  `node -r ts-node/register ... --config server.webpack.config.ts` command now
  crosses the repository's ESM boundary and fails with `exports is not
defined`. Use `NODE_ENV=production NODE_OPTIONS=--openssl-legacy-provider
./node_modules/.bin/webpack --config server.webpack.config.cjs --mode
production`. Keep deployment docs and local full-flow runners on that exact
  command so a copied release recipe cannot fail after the expensive Next
  build.

- **Static runner validators must not assume related source tokens share one
  line.** A deploy-flow validator used `ERR_ABORTED.*api/auth/check`, but the
  browser listener formats that narrow exception across several lines, so the
  validator rejected behavior that was still present. Check the structural
  tokens independently (or use an explicitly multiline pattern) and let the
  executable browser test prove runtime behavior.

- **A mounted quest detail pane is not proof that the newly clicked quest is
  selected.** The Quests tab keeps one detail section mounted while React
  swaps its contents. Waiting only for `biomes-ui-quest-detail` or the shared
  material-section test id can read the previous quest for one frame and
  falsely report a missing item guide (the July 31 Rope failure). Wait for the
  exact `Quest detail: <title>` aria label first, then wait for the specific
  material row before counting its gather/buy/craft choices.

- **A checkpoint write can lead the synchronized quest list by a few frames.**
  After installing a focused native Chapter 1 checkpoint, the Quests tab may
  still show the onboarding rows while the ECS projection catches up. Wait for
  the exact authored quest button before asserting uniqueness or clicking it;
  an immediate count is a sync race, not proof that the quest is missing.

- **Material rows must be selected by their exact data identity, not descendant
  text.** A Rope requirement can appear inside another row's craft inputs, so a
  Playwright `hasText: "Rope"` filter legitimately matches multiple material
  rows even though the dedicated `4 × Rope` row is present. Match the exact
  `data-material-requirement` attribute before opening and auditing its routes.

- **Thin-ice tests must converge the state projection with the native bag
  before comparing weight.** Reading Chapter 1 state can repair a missing plot
  item, while a direct Redis/HFC fixture read may still show the preceding ECS
  version for a frame. Poll both authorities until their bag-only weights agree
  within a small numeric tolerance, then test the cracking/holding decision.
  Do not hide a persistent mismatch; the bounded wait reports both last values.

- **Standalone carry-weight checks must initialize the production item
  catalogue.** The web process registers canonical metadata during normal
  startup, but a focused Node runner otherwise gives Rope and Field Medkits the
  generic 1 lb fallback instead of their authored 0.5 lb weights. Initialize
  the production crafting catalogue before comparing native and projected load;
  do not copy a second weight table into the test.

- **Focused Chapter 1 resets must clear external evidence before replaying
  retained steps.** Supplier transactions from an earlier run can make “Meet
  the Suppliers” ready before the browser reaches it, bypassing the vendor-owned
  `F` state and producing a false wait for the hidden Chapter 1 prompt. Clear
  the Chapter 1 supplier transaction keys first, then reconstruct them only for
  objectives included in `RESUME_AFTER`.

- **Custom Chapter 1 interfaces own completion until their interaction
  finishes.** Pressing `F` on `the_procedure` opens the real four-stage
  Containment Triage dialog; it does not immediately send
  `chapter1_progress:complete`. A browser runner that arms the response and
  simply waits will time out while the healthy product waits for player input.
  Require all four authored controls, advance only the active stage, then await
  the signed completion emitted by the final control. Apply the same rule to
  future objective-specific overlays instead of bypassing them through the API.

- **Decorative renderers must tolerate the positionless warp frame.** After the
  winter dungeon exit, `/scene/local_player` remained allocated for one render
  frame while its `position` was undefined. `chapter1WorldPhase` indexed
  `position[0]`, fatally stopped the main loop, disconnected Sync, and made the
  next Act 6 warp report `version: 0` for two minutes. Check for a complete,
  finite position before distance culling; a world-phase prop or anchor marker
  must skip the transition frame rather than crash gameplay.

- **Per-player staged cast must bridge both rendering and cutscene binding
  when the shared ECS body is outside subscription.** Act 6 correctly staged
  Dr. Ardan at Returnstone while his canonical body remained in Greenlamp, but
  the live-creature bridge dropped positive-id overrides with no subscribed
  base record and the cutscene binder consulted only `/ecs/entity`. The scene
  then cancelled its required role and a transient invalid camera ray reached
  voxel shard encoding. Chapter projection overrides now carry an explicit
  render fallback, the binder applies the same staged position (including
  hidden-state and nearby-role lookup), and the cursor rejects non-finite rays
  before terrain marching. Preserve the canonical positive entity id: this is
  a per-player presentation bridge, not a duplicate NPC or shared-world move.

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

#### Cutscene visual-audit incident log — July 30, 2026

- **Three live attempts maximum per scene.** Camera iteration must not turn into
  another catalog sweep. Make the best source/test correction first, run at
  most three focused live captures for that scene, record any remaining visual
  defect, and continue to the next scene. Runtime injection disables the
  runner's automatic replacement-page retry, so each command is one visible
  attempt and the source can be corrected between attempts. Do not replay
  quests for a third try.

- **Direct cutscene-catalog playback must install the scene's story projection.**
  Positive-ID cast members are normally moved per player by the active Chapter
  1 step. Playing `ch1-the-watch-house`, `ch1-the-case`, or consolidation from
  a catalog page without that projection leaves the actor at its seeded or
  current-save position; the resulting over-shoulder camera can land inside the
  player model or point at an empty room. The E2E bridge now installs the same
  `ch1StageDirections` input for each story beat and holds it against the normal
  one-second projection poll until capture ends.
- **A flashback stage still needs a grounded coordinate.** The old memory stage
  at `[496, 140, -126]` made the client-puppet player fall through the whole
  scene while already-streamed Grove NPCs and terrain fragments appeared to
  float around the camera. Memories now use the measured Greenlamp clinic
  interior floor. Do not replace this with a flat-world Y constant: use a
  canonical grounded/interior anchor from the hilly Harthmere coordinate map.
- **Stream the authored scene, not the seeded NPC.** For a gate reveal or a
  staged conversation, focus priority is story-staged cast, authored
  anchors/ghosts, then authored camera positions; only an unstaged live cast
  falls back to its authoritative ECS position. The opposite order made the
  Fence Line scene stream Jackie's fountain body while its camera was hundreds
  of metres away at the seam.
- **Terrain readiness precedes MediaRecorder.** After the focused player warp,
  require the corresponding terrain shard/seed through
  `chapter1TerrainSnapshot`, then allow one renderer frame. A fixed sleep is not
  readiness evidence and produced empty Ashline and gate captures on software
  WebGL.
- **Recapture only the affected scene IDs.** Use
  `HARTHMERE_E2E_CHAPTER_1_CAPTURE_IDS`; do not replay the Chapter 1 quest
  campaign to verify camera, subtitle, stage, or gate-render changes.
- **Use live frame sequences for iterative cutscene composition.** A July 31
  no-build audit proved that the older production MediaRecorder path can leave
  its promise pending long after the director has reached the scene. Runtime
  injection therefore defaults to `HARTHMERE_E2E_CHAPTER_1_CAPTURE_FORMAT=frames`:
  play the registered definition through the real director, poll
  `/scene/cutscene` cheaply, screenshot only the opening and each new authored
  subtitle, enforce an authored-time watchdog, and build a contact sheet.
  Frequent software-WebGL screenshots stall the renderer and make a 20-second
  scene take minutes. Reserve
  `CAPTURE_FORMAT=video` for the one final exact-source packaging check; do not
  pay video encoding/upload cost for every camera adjustment.
- **Diagnose snapshot-human black silhouettes without rebuilding first.** The
  local player and a synthetic negative-id ghost use the same generated avatar
  shader but different render owners. Inspect the current player's uniforms and
  the runtime renderer's `nativeCutsceneActors` separately. If only the ghost is
  black, update the already-loaded actor's `spatialLighting` and `light`
  uniforms in a temporary browser probe and capture the corrected frame before
  paying for another Next build. Keep that probe opt-in and out of release
  assertions: the durable fix belongs in the synthetic actor update path, and
  one later coordinated artifact build should prove the source correction.
- **Movement animations require a game-rendered cutscene gate.** Blender 5.2
  can report distinct keyed armature poses while the standalone
  `render_native_movement_action.py` still renders Running, Attack, crouch,
  dodge, and roll as the same neutral mesh. A GLTF channel-count pass therefore
  proves asset structure, not visible deformation. Use this fast order:
  `scripts/harthmere/t.sh file src/shared/game/test/movement_actions.test.ts`,
  `scripts/harthmere/t.sh file src/shared/cutscene/test/movement_action_showcase.test.ts`,
  then `node scripts/harthmere/test-native-movement-action-assets.cjs`. The
  asset audit must inspect the hash-addressed GLB selected by
  `asset_versions.json`, require neutral lead-in/recovery timing, and preserve
  `Attack`/`Attack2`. For visual acceptance, run the generated
  `harthmere-movement-action-showcase` through the real cutscene director in
  `clientPuppet` mode with empty commits/placements, capture its six individual
  action frames plus the evade-to-attack transition, and inspect lateral
  direction, forward/back pitch, the full roll, the double-jump burst, limb
  clipping, and return to neutral. Runtime injection is valid only
  when the warm page already contains the movement-action cutscene aliases and
  current animation asset hash; otherwise build the completed batch once and
  use that exact source. Do not accept Blender stills, source GLTF names, or an
  older reachable game image as the final visual gate.
- **One-shot movement input must be latched across low-FPS script ticks.** The
  July 31 production log ran at roughly 8–14 FPS, so a quick desktop X/C tap or
  short joystick pulse could complete its down/up cycle between physics ticks.
  Crouch appeared healthy because it is held, while dodge/evade were silently
  missed. Keep the input-manager press latch and consume it once per player
  tick; consume-and-drop it while motion is locked so modal/cutscene taps never
  replay after control returns. The fast regression belongs in
  `src/client/game/context_managers/input.test.ts`; do not use longer artificial
  key holds to hide the race.
- **Stage movement showcases inside the current observer interest set.** A
  fixed Grove coordinate passed route-distance tests but the exact-image client
  streamed it as floating terrain and sky. For a mutation-free synthetic
  snapshot-avatar, omit the ghost `spawnAt` so binding uses the live player's
  already-loaded position, and use a `trackRole` camera. Preserve the short
  neutral lead-in before each movement emote, then capture only the five
  labeled action frames. `idle` is not a valid cutscene animation token, so do
  not add a fake reset action; the authored clip's neutral endpoint provides
  recovery. This keeps no-build runtime injection useful without mistaking a
  distant camera failure for an animation failure.
- **Load the user avatar before judging a no-build cutscene injection.** The
  fast working order is: open the isolated web origin through
  `/dev/harthmere-visual-auth?username=<unique>&next=<injector>`, let the
  injector's game iframe load `/at?harthmere_native_ecs_e2e=1&syncBaseUrl=<the
isolated sync origin>`, wait for the local-player HUD/name and the observer
  interest set, then register and capture the runtime definition. Before
  accepting frames, require the console line `HARTHMERE_SYNC_URL_RESOLVED` to
  report `trusted_runtime_e2e_override` and the intended local sync port. A
  proxy iframe without that query connected to production sync, while a raw
  `install_id` route without a created local player fell into observer mode;
  both produced valid-looking subtitles over sky with no usable avatar. Do not
  revise animation clips in response to either harness failure.
- **Movement cutscenes need a movement-specific player bridge.** `dodgeLeft`,
  `dodgeRight`, `dodgeForward`, `dodgeBack`, `evade`, and `doubleJump` are
  intentionally not `zEmoteType` values. Sending them through the ordinary
  player-emote path silently drops the action. The cutscene director must start
  the client-only movement-animation state, and actor release must cancel it;
  do not publish a gameplay movement event, spend stamina, or move
  authoritative ECS while rendering a mutation-free showcase.
- **Double jump and evade-cancel tests cross the Native ECS/client boundary.**
  Keep `doubleJump` in the existing `MovementActionEvent` contract so the
  server atomically replicates it and deducts exactly four stamina; it must
  have zero horizontal action distance and no i-frames. Test the shared timing
  with `t.sh file`, but run the handler and interaction rows directly with
  `node_modules/.bin/mocha --config .mocharc.json src/client/game/interact/item_types/attack_destroy_delegate_item_spec.test.ts src/server/logic/test/movement_actions.test.ts`
  because they import ECS/server bootstrap state. The evade attack buffer opens
  only during landing/recovery and must call the existing attack path; never
  create a parallel attack event or alter `Attack`/`Attack2` to make the test
  pass.
- **Player evade is a 5.25-metre lateral roll.** It must never inherit forward
  input and become a dash. Current left/right input selects the side first; a
  just-released key may retain the visible lateral velocity/lean; otherwise the
  previous side is reused deterministically. Keep the replicated movement
  direction on that strict lateral axis and assert the exact `5.25` metre
  integrated distance at both normal and low frame rates.
- **Pose the rendered avatar shell, then inspect a close time sequence.** The
  Blender clip can animate the skinned body beneath a generated/voxel avatar
  shell that does not inherit every rig joint, leaving a labeled wide shot
  visibly neutral. Apply the shared root roll/pitch/lift and restrained scale
  pose to both gameplay and cutscene movement states, while retaining the
  Blender limb animation.
  Validate close frames from the middle of each action plus its neutral
  recovery; a wide contact sheet, clip-name audit, or subtitle alone is not
  visual proof.
- **An arms-only attack can be real but invisible on a generated avatar shell.**
  The Harthmere gameplay attack layer deliberately leaves the lower body under
  locomotion control. For a mutation-free cutscene transition gate, keep the
  real `Attack`/`Attack2` emote underneath, select its full-body layer only for
  the cutscene actor, and add a restrained neutral-ended root wind-up/strike
  fallback. Do not rewrite the production attack path or regenerate its clips
  just to make an unequipped showcase avatar readable.
- **Recheck builders immediately before moving `.next`.** A prior status check
  is not enough in this shared checkout: another task can start `next build`
  while focused tests are running. Run
  `pgrep -fl 'node_modules/.bin/next build'` at the exact mutation boundary,
  coordinate ownership, and reject any artifact whose output directory moved
  during compilation. Keep only the content-addressed cache when restarting a
  quarantined build.
- **A visible `BUILD_ID` does not prove the checkout is quiescent.** On August
  1, one shared build wrote a valid ID and complete static tree, then a second
  unowned `next build` started immediately and removed them again. Check for
  both `next build` and webpack processes before _and after_ reading the ID,
  pause briefly, then require the same ID plus `.next/server` and
  `.next/static` a second time. Never restart a bind-mounted app during that
  interval. If another compiler appears, wait for its owner or completion;
  do not launch a competing build or kill an unowned one.
- **Do not rerecord a completed WebM because browser automation cannot expose
  the page's main-world sink.** First require the
  `biomes-cutscene-video-output` status to be `complete`. Prefer the native E2E
  bridge/local sink; if an isolated browser world hides both `fetch` and that
  bridge, read the completed JSON in bounded chunks below the automation output
  cap and materialize the base64 offline. Never print the whole payload into a
  tool response, and do not spend another scene attempt on an upload-only
  harness limitation.
- **Compare captured cutscene dialogue by authored text, not internal role
  labels.** The director can legitimately project the source role `b` as the
  runtime speaker `You`, and entity-backed roles can use their rendered display
  name. The July 31 sixteen-scene batch rendered the confrontation line but the
  harness rejected it because it compared `b\n<text>` with `You\n<text>`.
  Dialogue completeness now keys on the immutable authored text while the
  manifest still records the visible runtime speaker for visual review.
- **Split software-WebGL cutscene audits into small scene groups.** One browser
  campaign that captured all sixteen scenes eventually caused two non-OOM app
  restarts during cold terrain and renderer pressure. The already-produced
  scene evidence remained useful, but the shared runtime had to recover before
  any final recapture. Keep one browser process per small affected-scene group,
  check lifecycle readiness and restart count between groups, and never turn a
  camera audit into another full quest replay.
- **Capture-only actor setup is not a quest checkpoint.** Keep the clean
  pre-navigation player write, wait for the loading wrapper, reapply once, and
  require the local ECS subscription to match before the scene warp. The full
  Chapter 1 quest lane still requires repeated authoritative-plus-local
  convergence, but making every camera recapture perform those saturated HTTP
  reads caused two consecutive 30-second setup failures before any scene ran.
- **Do not cancel a build into a bind-mounted `.next`.** The July 31 warm
  container mounted the host `.next`; cancelling `next build` removed or
  replaced chunks before the new output was complete, leaving the app with
  static-chunk 500s and no `404.html`. Keep one intact frozen exact-image app
  running, inject pure scene definitions for visual iteration, and perform one
  atomic final build only after all scenes are accepted.
- **A build log pipeline must use `pipefail`.** A July 31 movement-action build
  used `next build 2>&1 | tee ...`; the compiler stopped before writing
  `.next/BUILD_ID`, but `tee` returned zero and made the invocation look green.
  Run the compiler directly, or enable `set -o pipefail` before piping. Always
  require a fresh `BUILD_ID` plus the expected source/asset literals in
  `.next/static` or `.next/server` before starting a runtime. Preserve an
  incomplete directory for diagnosis and rebuild atomically; never launch a
  cutscene or browser gate from a partial `.next` tree.
- **Preflight the capture port and keep the exact-source web process alive.**
  Before opening the browser, run `lsof -nP -iTCP:<port> -sTCP:LISTEN` and
  verify the owner is the intended container or proxy. A stale movement proxy
  on July 31 served an older page chunk even while the new container was
  healthy. Also verify the warm backend still owns live Shim/Logic/Ask/OOB
  listeners before starting a web-only sidecar; a container can remain `Up`
  after those child services have exited. Build and mount `.next` plus
  `dist/web.js` as one atomic pair, then do not restart that web process between
  the accepted frame audit and the one final video capture.
- **Use the existing cutscene lane before any browser boot.** Run
  `scripts/harthmere/t.sh cutscene` for shared definitions and
  `scripts/harthmere/t.sh types` once after the source batch. Iterate camera
  placement with the frame/contact-sheet path, and reserve MediaRecorder plus
  MP4 encoding for the accepted take. This catches schema/choreography defects
  in seconds and avoids paying a production-stack restart for source errors.
- **Deployment order guards must include every intentional authored writer.**
  The July 31 exact-current-source build stopped before compilation because
  `test-production-deploy-local-redis-smoke.cjs` still expected ECS
  reconciliation to be immediately followed by connector materialization.
  Chapter 1 Road-House and Watch House materialization had correctly been
  inserted between them, with the connector still last, so the test was stale
  while production ordering was right. When adding an authored world writer,
  update the order guard in the same batch to assert the complete sequence;
  do not remove the writer or bypass the guard merely to make a build start.
- **Static source guards must inspect the behavior they claim to protect.**
  The same build then stopped because the retaliation guard rejected any
  `npc.label` or `displayName` reference anywhere in `npc/logic.ts`. New boss
  profile and evade selection legitimately read those descriptors before the
  generic attacked-NPC fallback, while the fallback itself remained free of a
  name whitelist. Scope textual guards to the target function or branch
  markers; otherwise unrelated additive logic turns a useful invariant into a
  build blocker and invites removal of correct behavior.
- **Formatter-sensitive source contracts must tolerate line wrapping.** A
  Chapter 1 materializer guard initially required one contiguous error string;
  Prettier wrapped that string without changing behavior and the contract
  failed. Prefer a semantic helper assertion. When a textual guard is the only
  practical option, match the stable tokens with whitespace or `[^]` between
  them rather than pinning formatter output.
- **A first green readiness result is not enough after a disposable Redis cold
  load.** The July 31 isolated exact-source stack reported web, Sync, Redis,
  and all lifecycle services up, then its no-persistence Redis container
  restarted once and lost the snapshot hash/world keys. Host Redis still
  answered `PONG`, but subsequent browser setup failed with fixture errors,
  missing terrain, and connection resets. Before beginning a multi-scene
  batch, verify app/Redis/proxy restart counts are zero, require the snapshot
  hash and representative world keys, then repeat the full readiness contract
  after a short stability window. Any capture after a Redis restart is invalid
  environment evidence, not a scene attempt.
- **Do not persist a snapshot merely because the importer printed its final
  change count.** A Redis restart during import can let the producer eventually
  report all 335,656 submitted changes while leaving an incomplete database;
  Gaia correctly rejected the resulting RDB with 220,158 missing shard
  coordinates. For this large local snapshot, import into uncapped protected
  Redis, stop the app immediately after `shim now running` proves the import
  phase completed and before Anima/Gaia inflate memory, then force `SAVE`.
  Recreate Redis from that RDB to reset restart count and require Gaia readiness
  plus two stable release-gate checks. An importer progress total is not a
  durable-world completeness assertion.
- **Frozen story projection can overwrite audit gates.** The older client
  republishes saved active gates once per second. A focused first-gate audit
  briefly showed the relocated fence gate but then reverted to desert/winter.
  Hold only the requested gate IDs in the disposable browser page for the
  capture duration, then release the interval. Never change shared story state
  merely to make a catalog scene visible.
- **Old test NPCs are not cutscene extras.** The July 31 first-gate sheet showed
  `Admin Robot` and `Grover III`, both abandoned local test entities within the
  shot, even after Chapter 1 projection was isolated. A focused visual page now
  publishes hidden client-only overrides for nearby NPC/robot rows, then lets
  the director's active cast overrides win. Do not delete shared ECS entities
  or mistake test-world residue for Chapter 1 lore.

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

#### Player-bound Hex cutscene capture adds two more readiness gates

`harthmere-hex-fireball-dodge-showcase` binds the real local player, so its
acceptance harness redirects visual auth to `/at` **without a coordinate slug**.
Coordinate `/at/x/y/z/...` routes are observer captures and can leave the hero
unbound. Keep `syncBaseUrl`, `harthmere_native_ecs_e2e=1`, and the unique
`e2e_run` on that direct `/at` URL; never enter through `/`.

An iframe capture page must not retain `contentWindow` while it is still the
initial `about:blank` document. Start the game work from the redirected iframe
load whose URL contains the focused-E2E flag (or reacquire the redirected
window after that signal). An overall timeout is still required, but waiting
three minutes on the original blank Window is a harness bug, not game startup.

After moving `__harthmereLivePlayerDebug` to `[500, 70, -140]`, require all
three terrain samples documented in `docs/cutscenes.md`. Then wait for
`__harthmereProjectileVisuals.loadedIds` to contain `fireball`. The general
renderer and cutscene bridge can be ready before the rebuilt Harthmere asset
renderer has loaded its projectile prototype; capturing at that point records
three correct custom events but no visible Fireball.

For this scene also assert `finishReason: completed`, exactly three projectile
events, and the
`hex-wraith`/`/assets/harthmere/glb/bosses/hex_wraith.glb` puppet identity.
The small `npcs/purple_hexer` NPC is not an acceptable substitute for the Hex
beast graphic. Keep the
director ceiling above the authored duration (currently 18 seconds versus a
15-second timeline); an equal ceiling races the natural-completion tick on
software WebGL and reports `aborted` after the final authored shot.

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

#### Additive Harthmere water preflight

A warm Redis snapshot can predate the additive Harthmere terrain even when the
current source and full deployment seeder are correct. The symptom is a loaded
player, rod, HUD and river-facing camera with no terrain mesh; do not debug the
fishing state machine until the terrain authority is proven. Run the read-only
extension audit first:

```sh
REDIS_HOST=127.0.0.1 REDIS_PORT=6392 \
  node scripts/harthmere/audit-production-extension-terrain.cjs
```

For a narrow live fishing proof on an old local snapshot, pause Gaia before
writing water and seed only the canonical quay neighborhood through the native
admin ECS API:

```sh
HARTHMERE_E2E_CONTROL_TOKEN="$(docker exec <app> printenv HARTHMERE_E2E_CONTROL_TOKEN)" \
HARTHMERE_E2E_BASE_URL=http://127.0.0.1:3047 \
REDIS_HOST=127.0.0.1 REDIS_PORT=6392 \
  node scripts/harthmere/seed-harthmere-fishing-live-fixture.cjs
```

Require the helper's solid-bank readback and `riverWaterLevel: 15`, reload the
browser, and require a terrain mesh before casting. This 3x3 fixture is only a
focused browser aid; production acceptance still requires the complete
extension seeder and audit. Do not start the full Shim terrain reconciliation
for one browser screenshot on a runtime that injects `node --no-opt`: building
thousands of shards there can take hours and competes with Logic/Sync. Resume
Gaia only after the authored `ShardWater` readback, then verify source water
survives its simulation. Use the helper's read-only mode for that post-Gaia
check so the test cannot hide a simulation regression by reseeding the shard
it is trying to inspect:

```sh
HARTHMERE_FISHING_FIXTURE_VERIFY_ONLY=1 \
REDIS_HOST=127.0.0.1 REDIS_PORT=6392 \
  node scripts/harthmere/seed-harthmere-fishing-live-fixture.cjs
```

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

When the warm stack uses non-default names or ports, pass every readiness
override explicitly. `e2e-jump.cjs` intentionally defaults to the standard
3000/3100/6379 topology and `biomes-prod-smoke-app`; setting only the page URL
can therefore report a healthy custom stack as down. A complete custom check
looks like:

```sh
HARTHMERE_E2E_URL=http://127.0.0.1:3047 \
HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:4937 \
HARTHMERE_E2E_REDIS_PORT=6392 \
HARTHMERE_E2E_STACK_CONTAINER=biomes-expression-verified-app \
  node scripts/harthmere/e2e-jump.cjs ready
```

### 4.5 Run one dungeon as one batch, then stop

`HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER` skips retained passing objectives.
`HARTHMERE_E2E_CHAPTER_1_STOP_AFTER` terminates immediately after the repaired
dungeon, so a mechanics change never pays for Act 4/6 or the other dungeon.

Desert batch:

```sh
HARTHMERE_E2E_CHAPTER_1_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=quests \
HARTHMERE_E2E_CHAPTER_1_SKIP_VIDEO=1 \
HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER=ch1_a3_q02_pack_for_it/the_pack_check \
HARTHMERE_E2E_CHAPTER_1_STOP_AFTER=ch1_a3_d1_the_sand_that_remembers/d1_the_long_walk \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Winter batch:

```sh
HARTHMERE_E2E_CHAPTER_1_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=quests \
HARTHMERE_E2E_CHAPTER_1_SKIP_VIDEO=1 \
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
HARTHMERE_E2E_CHAPTER_1_SKIP_VIDEO=1 \
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

Do not confuse “Pointer Lock is unavailable” with “gameplay input is
attached.” An in-app browser can render terrain, animate the held tool, and
expose HUD action buttons while the native input manager remains detached. On
the pointerless path, require `canvas.biomes-canvas` to be focused, the Enter
Game wash to be absent, and one native action to enter its real product state
(for fishing, `.cast-overlay`, `.fishing-casting`, or the later fishing
states). A HUD click with no state transition is a product/input regression,
not a successful browser test. The canvas now attaches input whenever Pointer
Lock is unsupported, not only when the virtual joystick flag is true; keep the
focused `MobileGameplayControls.test.ts` assertion with that behavior. Do not
hide the overlay or mutate page globals to manufacture a pass.

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

Reused visual-test usernames have a second failure mode: more than one local
database identity can share the label, and the friendly `/at/<username>` route
can resolve a different entity than the authenticated session. The page still
shows a signed-in HUD and a held item, but it is an observer client;
`InteractScript` is intentionally not installed and every native item control
appears inert. Prefer the exact numeric ID in `harthmere-visual-auth`, and make
the focused E2E diagnostics prove `syncTargetKind: "localUser"` before clicking
an item action. A username, avatar, or “entered the world” toast is not that
proof.

Fishing readiness must also be owned by the native interaction script, not by
a React overlay side effect. The legacy `SelectionHints` fishing overlay writes
the current `rodItemRef`, but replacement HUDs do not necessarily mount that
component. If `ready_to_cast` starts with an undefined rod ref, the native
script resets itself every frame and both a real canvas hold and the HUD Fish
pulse remain inert. Keep the focused `FishingItemSpec rod ownership` test and
require the interaction script to initialize/repair `rodItemRef` directly from
its `ClickableItemInfo.itemRef`.

Do not validate a short HUD action pulse at one fixed delay. The live Fish
control first waits for the selected hotbar item to render, and a low-frame-rate
browser can begin the native 350 ms hold more than 100 ms after the click. A
single 140 ms or 220 ms snapshot can therefore miss a correct
`.fishing-casting` transition. Start the real click, poll the product state
every 25-50 ms while that click promise is active, require at least one positive
sample, and capture the first positive frame. This proves the transition
without lengthening the product hold or replaying the already-passed catch/XP
scenario.

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

### 4.16 Apply-and-verify materializers must gate the post-commit state

A terrain materializer may count differences before it commits them. Do not
reuse that pre-commit count as the `REQUIRE_CURRENT=1` failure condition when
`APPLY=1` is active. The July 31 Chapter 1 building run successfully committed
1,232 voxel edits and acknowledged both structures, then exited nonzero because
it reported the historical pre-commit count as still pending.

Report both values instead: `pendingEditCount` records the work found, and
`remainingPendingEditCount` is the actual gate. In apply mode the latter is
`pendingEditCount - appliedEditCount`; a failed commit throws before the shared
state acknowledgement. Keep a separate no-apply `REQUIRE_CURRENT=1` readback in
the release evidence when the world mutation is high-risk, but do not make a
successful combined invocation look like a failed deployment.

### 4.17 Exact-image gate captures must hold the audit gate and renderer focus

Direct cutscene playback does not stop the production Fracture Gate prompt from
polling. That prompt republishes the saved player's authoritative active-gate
set every 750 ms. A one-time E2E setter can therefore be correct, then be
replaced while the runner is warping the player or waiting for terrain. The
renderer snapshot will show the saved desert/winter gates instead of the gate
the selected scene actually needs.

For a focused gate cutscene, keep both pieces of client-only audit state pinned
until capture ends:

- republish the scene's exact gate set on a bounded 250 ms interval;
- keep `/scene/local_player` and `/sim/player` at a point inside that gate's
  draw distance so collision recovery or an old player simulation cannot make
  a correctly active aperture look invisible.

Release the hold in `finally`; never change server quest state to make a visual
audit pass. `ch1-first-gate` uses `ch1_gate_fence_sighting`.
`ch1-persistent-gate` is the Act 2 Dry Mouth and uses `ch1_gate_desert`, not the
Act 6 `ch1_gate_prime`. Apply this hold to exact-image playback as well as
no-build runtime injection. The July 31 failure occurred because the runner
only held gates in the runtime-injection branch.

### 4.18 Fast seeded robot-story runs must wait out the real player bootstrap

A fresh authenticated username can receive a local synchronized placeholder
before Sync's authoritative `createPlayer` commit finishes. A focused robot
chapter can seed and complete in seconds, so it can outrun that normal player
bootstrap. When the delayed default row finally commits, the player appears at
the right Chapter 1 staging warp but every challenge and trigger receipt is
empty. A later handoff then times out even though Muck vs. Machine and the dual
Gimme/Chapter 1 unlock were already observed passing.

For focused robot-story browser lanes, delete the disposable visual-test entity
before navigation so any colliding snapshot NPC simulation loses authority and
the normal `createPlayer` bootstrap creates a fresh row/version. Then wait for
the loading wrapper to clear and reassert the normalized authoritative/local
actor before installing any challenge fixture. Repeatedly updating an active
NPC-shaped row is not enough: Anima can keep restoring `npc_state` and its old
remote position. This is a test-speed race; do not weaken the Gimme transition,
replay the whole robot campaign, or add sleeps after individual quest actions.

That eviction also removes the token-gated temporary `admin` role from the
world entity. After `createPlayer` finishes, call `visual_test_auth` again with
`e2eAdmin=1` and the control-token header before any later
`/api/admin/apply_ecs_changes` fixture. A still-valid login cookie is not enough:
admin middleware reads the recreated player's current world roles, and otherwise
the first post-loader fixture fails 401 before the focused scene or quest begins.
The successful auth JSON can precede that role becoming visible to admin
middleware on a production-shaped `HybridWorldApi`. Poll the protected
`/api/admin/ecs/get_with_version` read until it succeeds before applying the
normalization fixture; retrying the fixture three times in a few hundred
milliseconds is still too early and only repeats the same 401.
Do not retain an older bridge-live normalization write between eviction and
that post-bootstrap auth restore. The evicted row has no admin role by design;
normalization belongs once, after the loading wrapper clears and the protected
read proves authorization.

After Muck vs. Machine itself has passed, verify only the remaining Sophia
transition without replaying that chapter:

```sh
HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE=1 \
HARTHMERE_E2E_ROBOT_STORY_CHAPTER_ID=5739496793885069 \
HARTHMERE_E2E_GIMME_SOPHIA_HANDOFF_ONLY=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

This checkpoint seeds the retained post-Muck boundary, publishes only Gimme
Shelter's `TALK_TO_SOPHIA` event, proves the placement objective and marker,
then stops. A renderer message that an unmarked mixed-material root is
`Defaulting to three` is the production-safe stock-material pass, not the
procedural Three.js NPC fallback. Preserve it as a diagnostic transient. The
native player contract is independently locked by the snapshot PlayerMesh
provenance and base-pass coercion tests.

### 4.19 A rendered body is not proof that the correct avatar pipeline ran

The May 16 snapshot has two native character routes: players and player-like
humans use `/api/assets/player_mesh.glb`, while creatures and robots use their
authored Galois/GLTF rigs. A rounded-box Three.js fallback can make an actor
visible while still replacing their identity, clothing, face, skeleton, and
Blender animation compatibility. Cutscene screenshots exposed this as blocky
townsperson stand-ins even though every camera and dialogue assertion passed.

Native-avatar tests must therefore assert provenance as well as visibility:

- real ECS NPC records are transform-only bridge data and always remain in
  `NpcRenderState`;
- human flashback/ghost cast uses the generated snapshot player mesh, never a
  `townsperson_*` procedural constructor;
- animals, Muck creatures, robots, and bosses use `npcs/*` or authored GLB
  assets with their Blender-extended clips;
- a missing or empty native mesh fails the release gate instead of silently
  substituting a different procedural body;
- static runtime life placements cannot create a second person or animal over
  the authoritative ECS actor.

Snapshot-backed browser stacks can also retain focused-run player entities.
Several prior `NativeECS-A-*` users may be parked at the same authored player
stage, which makes a correct two-person cutscene look duplicated or vertically
stacked. Exact-image Chapter 1 capture must hide nearby remote player meshes
for the duration of each scene, preserve the current authenticated player, and
restore the hidden meshes afterward. Do not delete or move the retained ECS
players merely to clean a screenshot, and do not diagnose the extra body as an
NPC fallback until a read-only nearby-player scan rules this contamination out.

Do not repair an invisible NPC by adding another fallback renderer. Fix the
native Bikkie presentation donor, generated player-mesh request, asset load, or
base-pass routing that made the authoritative body invisible.

Cutscene ghost ids are deliberately negative and cannot be fed through a raw
signed `%` when selecting deterministic PlayerMesh appearance variants. In
JavaScript and BigInt, a negative dividend produces a negative remainder. That
turns mixed-radix wearable indices into `undefined` item ids and the generated
player-mesh query crashes before rendering. Normalize the remainder into
`0..variantCount-1` and keep a direct negative-id regression. Do not “fix” this
by assigning a procedural ghost body or by making the asset request ignore an
invalid wearable.

### 4.20 Mobile startup gates and HUD taps need orientation-aware real input

Mobile Safari can have a running renderer behind a loading overlay. The July
31 iPhone trace reached authenticated sync, loaded 2,426 entities, built the
client contexts, and rendered scene frames, but the startup gate still waited
for neighboring combined terrain meshes that low-memory cache churn kept
evicting. For low-memory clients, gate first gameplay on supporting/local
terrain plus collision boxes and let dynamic graphics begin at its 64m
emergency distance. Keep the wider nearby combined-mesh gate and 96m starting
distance on desktop.

Do not treat removal of `.loading-wrapper` alone as proof that mobile gameplay
is ready. Character onboarding or wake-up screens can still cover the joystick
and accept the touch instead. Wait for the mobile gameplay controls themselves
(`data-biomes-mobile-menu`, hotbar, and joystick) and reject any visible
non-gameplay screen before exercising movement.

If the world, HUD, and render frames advance behind a loading overlay, log the
supporting shard's terrain entity, physics boxes, and combined-mesh cache state.
Combined terrain meshes are evictable on low-memory Safari and can disappear
while the world is otherwise playable. Mobile startup should require local
terrain plus collision readiness; desktop should retain the stronger nearby
combined-mesh gate.

`react-joystick-component` binds `pointerdown` to the inner stick button, then
tracks pointer movement on `window`. Dispatching a touch at the outer joystick
group can hit a fullscreen overlay or another child and produce only stray
`pointermove` events. Target the inner `[data-testid="joystick-base"] button`,
pause briefly after `touchStart`, move in several steps, assert nonzero shared
input, and assert release after `touchEnd`. A mouse click is not equivalent.

Run the mobile smoke in both orientations because the minimap controls,
objective card, hotbar, and joystick change their available geometry:

```sh
HARTHMERE_MOBILE_WIDTH=390 HARTHMERE_MOBILE_HEIGHT=844 \
  node scripts/harthmere/test-harthmere-mobile-gameplay-smoke.cjs "$URL"

HARTHMERE_MOBILE_WIDTH=844 HARTHMERE_MOBILE_HEIGHT=390 \
  node scripts/harthmere/test-harthmere-mobile-gameplay-smoke.cjs "$URL"
```

Each pass must require startup completion, advancing render frames, a real
joystick drag, a hotbar tap, Menu and Recipes taps, and bounding-box checks that
the hotbar does not overlap the joystick or objective. For rem-based HUD sizes,
compare computed pixels with the live root font size and viewport cap; fixed
desktop pixel expectations are invalid on the game's scaled phone root.

The July 31 portrait run measured the game root at **5.46px**. That turned an
apparently reasonable `6rem` Menu/Recipes column into a 33px target, placed a
`7.4rem` top offset inside the 94px minimap, and reduced a `19rem` vitals panel
to 104px. For critical mobile geometry, do not merely adjust the rem number:
use viewport percentages with a pixel cap for panels, and pixel/safe-area
offsets for touch targets and collision boundaries. The browser gate must log
the computed rectangles so this failure cannot hide behind source-level CSS
review again.

### 4.21 Chapter 1 world identity and dialogue migrations need compatibility gates

The July 31 live review found three production-shaped defects that static quest
topology did not expose: the Road-House sign occupied the exact doorway anchor,
raw snapshot NPCs remained beside their canonical seeded replacements, and
Chapter 1 regular dialogue used a second centered dark modal instead of the
game's original in-world NPC dialogue presentation.

Keep these rules with any future world/content migration:

- A façade sign, prop, or marker must never share a walkable doorway anchor.
  Unit-test horizontal clearance from the door; a correct label attached to an
  impassable entrance is still a broken location.
- Migrated named NPCs have one canonical ECS identity. Reconciliation should
  inspect only the known legacy IDs, require exact canonical labels and NPC
  metadata, protect player/remote rows, delete the obsolete entity from both
  primary and HFC stores, and verify both deletions. Do not scan and decode the
  entire 300k-entity world to remove five audited IDs.
- Immutable snapshot quest leaves and committed voice recordings can still
  contain a legacy entity ID. Gameplay, maps and new authored quest targets use
  the canonical ID, while claim matching treats the known legacy/canonical pair
  as equivalent and publishes the authored identity expected by the immutable
  trigger. Runtime voice casting keeps the historical actor key so reviewed
  MP3s remain cache hits; never regenerate existing lines merely because the
  ECS entity was migrated.
- Regular Chapter 1 speech must use `TalkDialogModal` and
  `GenericTalkDialogModalStep`, including the original NPC name, subtitle and
  click-to-continue presentation. Choice entry, text input and system warnings
  may remain modal because they are decisions, not ordinary spoken dialogue.

The focused release batch is the Road-House clearance test, named-NPC cleanup
test, server and client legacy-ID claim tests, Chapter 1 dialogue presentation
contract, voice-profile/cache tests, scoped TypeScript, and one exact-current
browser pass. The browser pass must count one Jackie, enter the Road-House
through the doorway, inspect the original dialogue presentation, and then run
the Sophia-only checkpoint. It must not replay the completed quest catalog.

The July 31 `projectile-audit-portal-20260731` runtime exposed a packaging-only
failure after its original validation: `/at` HTML and lifecycle readiness stayed
green while most `/_next/static/*` chunks, the admin fixture pages, and the 404
page were absent. A listening web port is therefore not sufficient for a fresh
browser pass. Before Chromium, request the build manifest, the `/at` page chunk,
and one admin ECS page used by the harness. If the admin page alone is absent,
`HARTHMERE_E2E_DIRECT_WORLD_FIXTURES=1` may use the same Redis/HybridWorld for
test setup and authoritative reads without rebuilding the app. If the client
chunks are absent, stop: no fresh page can install `clientContext`, and that is
an invalid runtime rather than a Chapter 1 product failure.

The restored Chapter 1 dialogue presentation also changed the browser action
contract. The focused runner must wait for
`.npc-quest-view .npc-quest-dialog-container` and the original animated
click-to-continue prompt, then click the in-world dialogue surface. Never
reintroduce or wait for the removed `[data-chapter1-dialogue-next]` button.

### 4.22 Audit projectile visuals through one query-gated in-game batch panel

Do not test a projectile catalog by trying to construct `CustomEvent` objects
from the browser-control evaluator. That evaluator is intentionally read-only
and does not expose DOM event constructors. It can make a correct renderer look
untestable even though the production event path is healthy. It is also wrong
to drive only the player hotbar: several NPC, boss, control, and energy
projectiles are not selectable player actions.

Use the localhost-only native-ECS audit surface instead:

```text
?harthmere_native_ecs_e2e=1&harthmere_projectile_visual_audit=1
```

The panel is mounted only on `localhost`, `127.0.0.1`, or `::1`, dispatches the
real `biomes:harthmere-projectile-visual` event from a real React button, and
divides the current manifest into groups of at most six. Run the complete
catalog in those groups, not one browser invocation per projectile. Keep one
authenticated page, one renderer, and one exact build for the whole campaign.

Before pressing any batch button, require all of the following in the visible
panel:

- the expected manifest version and count;
- `Loaded N/N`, not merely `loadedOrLoading: N`;
- `Failed 0`;
- `Fallbacks: none`.

An HTTP 200 for a GLB, a promise retained in the prototype map, or a visible
loading silhouette is not proof that the authored projectile rendered. The
projectile runtime publishes resolved loaded ids, failed ids, and
`usingFallback` on each active flight specifically so the browser gate can
separate the authored Blender model from the emergency silhouette.

For each group, click once, capture one screenshot while the group is being
repeated briefly, then wait for `Active: none`. Require the spawned counter to
increase by the group size (or a positive multiple of it when the repeat timer
fires) and require the impact counter to catch up before advancing. Very short
effects such as Consecrate can finish before a software-WebGL screenshot is
returned; their loaded-model assertion plus the exact group spawn/impact delta
is the authoritative proof. Do not slow production flight timing merely to
make a test screenshot easier.

Render the audit UI through a portal attached to `document.body`. A fixed panel
inside the ordinary HUD tree can exist in the DOM while remaining visually
behind the game canvas because of an ancestor stacking context. DOM visibility
alone did not catch that defect. Preserve one ready-state screenshot that shows
the panel over the canvas before spending time on the five catalog groups.

Do not repeatedly attempt Pointer Lock or first-person toggles in the software
browser. Headless Chromium can reject Pointer Lock and emit one warning per
retry while leaving projectile behavior completely healthy. Use the panel's
explicit world-space origins/targets and a naturally open camera composition.
Treat pointer-lock warnings, the existing mixed-scene-material diagnostic, and
unrelated legacy FBX n-gon warnings as separate environment/content noise;
`renderer.projectile.asset_failed`, a nonzero failed count, or any active
fallback remains fatal.

The first fresh-player page can also expose the reused-snapshot bootstrap race
as `AssertionError: Should never delete local player!`. Preserve the screenshot,
use the product's **Clear Cache and Refresh** recovery once, re-enter through
`/dev/harthmere-visual-auth`, and continue on the same ready stack. Do not
restart Redis, rebuild, or keep clicking Enter Game against the stopped loop.

Finally, require `.next/BUILD_ID`, `.next/server`, `.next/static`, the exact
audit marker in the built `/at` chunk, two stable `e2e-jump.cjs ready` results,
and zero container restarts before Chromium. A Next command that exits zero
after PWA compilation but leaves only `.next/cache` is a failed build. Stop the
duplicate heavy app stack, quarantine that cache, produce one complete build,
and reuse it for every batch and any follow-up task. Never rebuild between
projectile groups.

### 4.23 Audit attack authority and attack presentation as separate lanes

A health delta does not prove an attack graphic rendered, and a synthetic
projectile flight does not prove Native ECS or Anima accepted the attack. The
July 31 combat audit found both failure modes at once: production evidence
showed NPC damage without a projectile request, while several authored thrown
and magic weapons were being classified by name heuristics as melee.

Run one batched source/integration lane before the browser:

- classify every premium weapon from its authored `profile`, not a display-name
  regex; thrown items must use ranged reach and magic books/focuses must use the
  spell path;
- require every damaging ranged or spell item to resolve a projectile visual;
- test ranged player contact and zero-contact misses separately, because a miss
  has no attacked entity but must still launch a visible projectile;
- exercise Anima projectile hit, miss, 20-second cooldown, ground area, cone,
  and self-area geometry, then serialize the cast through `npc_state`;
- run the full-bootstrap native health handler tests so forged damage, range,
  cooldown, mana, mitigation, and replay rejection are checked by the actual
  server authority.

The final browser lane must then do two things in the same exact build. First,
run every visual-manifest batch through the query-gated projectile panel and
require loaded authored models with zero fallbacks. Second, exercise at least
one real melee exchange and one real Anima ranged cast, recording the visual
spawn/impact counters and the authoritative health result. Do not infer the
second lane from the first, and do not infer a rendered fireball from an NPC
damage record alone.

Treat the full-screen loading wrapper as a stable interaction boundary, not a
single DOM sample. During the July 31 focused chase run, `.loading-wrapper`
disappeared for one render while the visible `Enter Game` button mounted, then
returned and intercepted the click for the entire Playwright timeout. Require
at least one continuous second with no loading wrapper before clicking the
pause overlay. Do not use a forced click: it can dismiss the overlay before the
player/Sync bootstrap is ready and turn a harness race into misleading combat
failures.

Do not abort an authoritative combat wait because Chromium canceled the hashed
`/_next/static/media/avatar-placeholder.*.png` request during a player-card
rerender. Record that GET `net::ERR_ABORTED` as a browser transient in every
focused lane, not only quest/catalog modes. Continue treating failed chunks,
APIs, Sync requests, projectile assets, and non-aborted image failures as
fatal.

For Anima ranged presentation, publish the active cast through the sanitized
client-visible fields on `npc_combat_state` and choose its `castTime` before any
legacy retaliation or generic attack-emote timestamp. A real Hex can resolve
damage without either legacy marker. Gating the presentation on a melee attack
time produces server health damage with no Fireball on screen.

Do not assume the NPC renderer's selector projection contains every combat
component. `NpcMetadataSelector` deliberately admits legacy NPCs that do not
have `npc_state`, but reading `/ecs/c/npc_state` directly is not sufficient:
generated component ID 67 is serialized as `server`, and the Sync serializer
omits server-only components for client targets. In the hardware live-Hex run,
the exact disposable NPC, its label/position/health, and briefly
`npc_combat_state.attack_target` were present in the browser while
`/ecs/c/npc_state` remained absent through the authoritative cast and hit.
The accepted fix projects only the active cast's ability ID, projectile ID,
cast time, aim point, and optional result through `npc_combat_state`. Keep
impact/cooldown selection, paths, threat, schedules, and the rest of
`npc_state` private. Maintain both the renderer contract and the Sync
serialization test proving the public projection crosses to a non-self client
while `npc_state` remains omitted. A client resource lookup alone does not prove
that.

When an Anima simulation is refreshed from the synchronized entity, retain the
public `npc_combat_state` in `SimulatedNpc.updateFromExternal()`. Dropping it
makes every later finish compare against `undefined`, so the same unchanged
cast is republished repeatedly even though `castTime` never changed. The
focused regression must project one cast, feed the synchronized entity back
through `updateFromExternal()`, and require the next `finish()` to return no
update.

The final browser proof must start from known counters, require one new spawn,
observe `Active: <projectile id>`, wait for exactly one matching impact, and
capture multiple frames during travel. The July 31 Fireball gate changed
`Spawned 2 / Impacts 2` to `Spawned 3 / Impacts 3`, observed
`Active: fireball`, and captured three frames about 180 ms apart. A disposable
fixture pinned every 75 ms can race HFC and produce two near-identical pending
casts. The final coordinated pass used a 2,000 ms pin interval and required the
pending and resolved records to share one cast time, one browser spawn, one
impact, and one accepted authority hit.

Pass the isolated Sync origin explicitly on every exact-stack browser URL:
`syncBaseUrl=http://127.0.0.1:<port>`. Before interpreting a zero projectile
counter, prove that the browser has a synchronized local player and the
disposable attacker. A probe with `/sync/createPlayer UNKNOWN`, a failed WebGL
context, or an `UNKNOWN` subscription is an invalid fixture; it cannot prove a
renderer regression or that an NPC was absent from a healthy production client.
Record those failures separately and continue with the hardware-backed browser
session instead of rebuilding the application.

An atomic Next build can replace the `.next` directory while a Docker bind
mount remains attached to the deleted old inode. If the host artifact guard is
green but `/app/.next` is empty or stale, do not rebuild and do not repeatedly
restart the same container. Recreate only the application container with the
same environment, ports, and read-only mounts so it binds the completed host
directory. Leave Redis and the completed artifact trees untouched.

### 4.24 Test universal magic charging as three separate clocks

Magic charging adds a clock before the existing projectile/shape clock. Keep
the four timestamps explicit in every Native ECS/Anima fixture:

- `castTime` starts the charge;
- `releaseTime = castTime + chargeTimeSecs` releases the spell;
- `impactTime = releaseTime + castTimeSecs` resolves projectile/shape contact;
- `cooldownUntil = releaseTime + cooldownSecs` ends cooldown.

Do not reuse `castTime` as the authoritative damage receipt timestamp after
adding charge. The server must reject that pre-release receipt and accept
`releaseTime` once. For ordinary Hex Fireball, require the shared 2–10 second
charge bounds, the existing one-second flight, and the existing 20-second
cooldown as independent assertions.

The client-visible projection must include sanitized
`ranged_attack_charge_time_secs` and `ranged_attack_release_time` fields on
`npc_combat_state`; keep private pathing, schedules, impact lists, and the full
`npc_state` server-only. A browser charge counter without a matching Anima cast
is only a visual test, and an Anima damage record without a browser charge
start/release is only an authority test.

For browser checks, use the query-gated projectile panel's stable test IDs:

- `harthmere-magic-charge-audit-min` for the exact two-second floor;
- `harthmere-magic-charge-audit-max` for the exact ten-second ceiling;
- `harthmere-magic-charge-audit-runtime` for active/started/released counts;
- the existing projectile runtime fields for loaded/failed/spawn/impact and
  fallback status.

Capture monsters and bosses during the active interval, not only at release.
Their production effect is body-scaled gathering light, rings, authored spell
core, and orbiting voxel particles. If a disposable live cast is paused before
activation, record its exact unpause timestamp and schedule the browser frame
inside the known charge window; polling after release proves only the counters.

Treat delayed fixture resolution honestly. If Anima writes `result: hit` more
than the server receipt grace after the planned impact, server authority may
correctly reject the stale damage. Preserve that run as timing/fixture evidence
and use a timely run for the accepted health result; never relax freshness just
to make an overloaded fixture green.

Finally, coordinate `.next` ownership between tasks before a production build.
Checking for a builder only at process start is not enough if another task can
rename the directory later. The build owner must announce the lock, and other
tasks must explicitly wait for release before moving, cleaning, rebuilding, or
restarting. If `.next` was moved during compilation, reject the output even
when Next exits zero: quarantine completed manifests/chunks, retain only the
content-addressed cache if desired, and perform one exclusive replacement
build. Never bless mixed output with the artifact assertion.

### 4.25 Prove magic impacts with separate hit, miss, and framing gates

Do not infer a successful explosion from the ordinary projectile impact
counter. The renderer intentionally counts both misses and hits as resolved
projectile endpoints. A magic-impact browser gate must start from known values
and assert both counters:

- a successful magic batch increments `impactCount` and
  `magicExplosionCount`;
- a miss batch increments `impactCount` while `magicExplosionCount` remains
  unchanged;
- `activeMagicExplosions` rises during the captured flash/core, shockwave, or
  mist frame and returns to zero after the bounded lifetime;
- loaded assets remain complete, failed assets stay zero, and no active flight
  uses a fallback.

Run spell schools in batches, but distinguish a counter proof from useful
visual framing. A projectile endpoint can be valid and offscreen. Capture the
batch once for catalogue/counter coverage, then use one deterministic close
target or a pinned camera/player fixture for the beauty sequence. Do not keep
rebuilding because a correct endpoint was poorly framed.

For a real disposable Hex, stop the fixture shortly after the magic receipt
and impact animation—about 2.2 seconds after impact is enough for the longest
v1 mist tail. Leaving the NPC alive for 10–15 seconds can permit a later melee
strike, player death, and unrelated death-page noise. Preserve an over-held run
as evidence, but use a short clean run for final browser acceptance.

Pointer Lock rejection in in-app Chromium is not an explosion failure. Record
the overlay limitation and rely on the WebGL frame, active spell IDs, exact
impact/explosion deltas, and matching authority receipt. If a close shot is
required, choose a browser environment that can lock the pointer or use the
dedicated camera fixture; do not force-click the overlay or hide it with page
mutation.

### 4.26 Audit boss magic as one 40-attack lifecycle matrix

The eleven live bosses own 55 attacks, of which 40 are magical. Do not test
only one spell per boss or assume the projectile asset family determines
magic. Several valid boss spells reuse physical/energy-looking meshes: Helix
Pulse uses the energy projector and the Choir/Alpha/Root-Crowned seed attacks
use `multi_shot`. Classify charge and hit explosions from the authoritative
attack `damageType`, then use the projectile family only for visual palette and
motion tuning.

Run one pure catalog test before opening a browser. It should assert the exact
shape matrix—7 projectiles, 8 beams, 14 ground AOEs, 8 self-AOEs, and 3 cones—
and prove every row has a bounded 2–10 second charge, a real projectile/shape
asset, and a successful-hit magic-impact profile. Run the existing all-55
Anima and server receipt tests in the same batch; do not create 40 isolated
test invocations.

Giant bosses need a presentation-origin assertion, not merely a larger scale.
Thaedryn (`20 × 14 × 58` m), Ninth Winter (`14 × 13 × 8` m), and Alpha Mucker
(`12 × 14 × 11` m) can hide center-origin VFX inside their meshes. Calculate a
target-facing point on the horizontal elliptical footprint, add a bounded
surface margin, and constrain it before a close target. Use volume-based charge
and projectile scaling with caps; scaling only from the longest axis makes
Thaedryn's 58 m length fill the screen.

For the browser gate, render three production-runtime frames per magic attack:

1. active charge beside the correctly scaled boss body;
2. projectile moving toward the player, or the correct beam/cone/AOE shape;
3. exactly one successful-hit explosion.

Require nonzero changed-pixel scores, no asset failures, real loaded projectile
assets rather than loading silhouettes, approach toward the player for true
projectiles, and one magic-explosion counter increment. Keep the full
11-boss/40-attack result JSON and all eleven sheets; validate them in one pass
with `scripts/harthmere/validate-boss-magic-lifecycle-audit.cjs`.

Do not weaken visibility thresholds when a giant endpoint is offscreen. Use a
wide player-facing camera for charge/path, a target-focused camera for
ground-AOE telegraphs and hit explosions, and a caster-focused camera for
self-AOEs. A cone telegraph may extend to maximum dodge range, but the hit
explosion belongs at the authoritative target, not the far edge of the cone.
This separation fixed the false-zero captures for Ninth Winter and Alpha
Mucker and exposed Vyrahel's genuine cone endpoint bug without another build.

### 4.27 Run the focused Indisworm live matrix once, after the stack is ready

Use `scripts/harthmere/test-harthmere-indisworm-live-browser.cjs` for the final
massive-cavern creature gate. It authenticates a disposable player, creates one
typed Indisworm in Far Hollow, captures all seven phases in one browser, checks
the real poison-spit GLB, verifies server-authoritative damage, audits WebGL2,
and deletes only its own NPC fixture.

Do not launch it merely because ports 3047 and 4937 are listening. First require
`e2e-jump.cjs ready` to report web, logic, Sync, trigger, shim, and Bikkie UP,
and coordinate `.next` ownership with every task sharing the app. A restart or
atomic `.next` replacement during navigation appears as dozens of aborted CSS
and JavaScript chunks, broad HTTP 500s, and a missing client bridge. Classify
that attempt as invalid infrastructure evidence; do not call it an Indisworm or
Three regression, and do not create a fixture until the bridge exists.

The focused verification stack deliberately reports `anima=0`. Keep authority
and presentation explicit instead of pretending it is an autonomous chase
server:

- source/behavior tests prove Anima target selection, movement, melee, ranged
  cooldown, hit/miss, and poison-spit state generation;
- the browser gate writes the same synchronized `npc_state` and public
  `npc_combat_state` shape Anima publishes;
- authoritative ECS velocity/position must select the actual `Walk` and `Run`
  clips and move the entity;
- real logic `UpdateNpcHealthEvent` and `UpdatePlayerHealthEvent` handlers must
  accept the in-range hit, poison receipt, and melee receipt before any phase is
  called green.

Run the static contracts first, then the browser once:

```bash
npx mocha --require ts-node/register/transpile-only \
  --require tsconfig-paths/register \
  src/shared/harthmere/test/indisworm_spawns.test.ts \
  src/shared/harthmere/test/harthmere_native_combat.test.ts \
  src/shared/harthmere/test/premium_projectile_wiring.test.ts

npx mocha --require ts-node/register/transpile-only \
  --require tsconfig-paths/register \
  src/client/game/util/test/three_asset_contract.test.ts

node scripts/harthmere/test-indisworm-assets.cjs

HARTHMERE_E2E_CONTROL_TOKEN="$(docker exec \
  biomes-expression-verified-app printenv HARTHMERE_E2E_CONTROL_TOKEN)" \
HARTHMERE_E2E_BASE_URL=http://127.0.0.1:3047 \
HARTHMERE_E2E_URL='http://127.0.0.1:3047/at?syncBaseUrl=http%3A%2F%2F127.0.0.1%3A4937&glitch_auto_play=1&harthmere_native_ecs_e2e=1&lowMemory=1&resourceCapacityScale=0.25&forceDrawDistance=16&forceRenderScale=0.25&forceGraphicsQuality=low' \
HARTHMERE_E2E_REDIS_PORT=6392 \
HARTHMERE_E2E_BUILD_ID="$(cat .next/BUILD_ID)" \
HARTHMERE_E2E_USERNAME="Indisworm-Live-$(date +%s)" \
HARTHMERE_E2E_TIMEOUT_MS=180000 \
HARTHMERE_E2E_ANGLE=metal \
node scripts/harthmere/test-harthmere-indisworm-live-browser.cjs
```

The runner intentionally upgrades visual capture to 32 m draw distance and
resource scale 0.5 while keeping the exact frozen build and low graphics. At
16 m/0.25 the GLB can load successfully while the 12–14 m NPC root is culled,
which is not an animation failure.

Preserve these fixture rules:

- use the confirmed Far Hollow anchors near player `[972.126, 13, -673.99]`
  and NPC `[984.126, 13, -673.99]`, a fresh username, and a fresh entity ID;
- retain the production seed `displayName` while assigning a separate fixture
  label; changing the seed name before profile resolution can produce type ID
  zero instead of `monster_indisworm`;
- initialize player health, position, and `player_status` before `page.goto`,
  and clear stale `death_info`/icing. Healing after React mounts can briefly
  open the death modal and stop the game loop on reused local identities;
- wait for the typed NPC to reach local ECS before requesting its renderer
  resource, and keep the missing-shard recovery guard while cave terrain loads;
- stop reissuing teleports after authoritative, sim, and scene positions
  converge. Cave collision can settle the frontend within roughly one block of
  the exact ECS point; use a bounded visual tolerance, but keep the server
  attacker at the exact range-valid position;
- face velocity correctly. Westbound velocity with eastbound yaw selects
  `runBackwards` and the `Walk` clip even though speed classification says run;
  require an enabled action whose actual clip is `Run`;
- for close hit/melee phases, avoid overlapping the two human-sized colliders.
  Use a range-valid center distance and allow the bounded frontend collision
  offset without weakening the authoritative server range check;
- first projectile hydration may take over 20 seconds while all 31 prototypes
  resolve. Preserve that real-flight screenshot, then create a fresh resolved
  poison cast for the authority receipt; reusing the old visual cast correctly
  fails the server freshness/replay window;
- require `indisworm_poison_spit` in loaded IDs, `usingFallback: false`, no
  failed projectile IDs, authoritative player HP loss, and the authored
  `RangedAttack` clip;
- require `Idle`, `Walk`, `Run`, `Attack`, `RangedAttack`, `HitReact`, and
  `Death`, plus a visible corpse pose with locomotion stopped and attacks
  cancelled;
- require WebGL2, `glError: 0`, no shader/ANGLE/invalid-program signatures, no
  relevant asset request failures, seven screenshots, a passing JSON report,
  and a final read proving the fresh NPC ID no longer exists.

Do not use the canonical fishing player, quay, or river shard neighborhood for
this gate. Do not restart the app, Redis, or proxy from the creature runner.
The report under `artifacts/harthmere-indisworm-live-browser/<run>/report.json`
is the handoff artifact; failed attempts should remain available as evidence of
the specific readiness or fixture edge case they caught.

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

### Deleted snapshot NPCs and native quest markers

Deleting a legacy snapshot NPC from ECS is only half of the identity migration.
Native quest trigger data can still carry that historical entity id in a
navigation aid. Canonicalize `entity` quest-marker targets before handing them
to `MapManager`; otherwise the quest itself can pass while the browser logs
`No entity found for navigation aid` and silently loses the objective marker.
The focused regression is:

```bash
scripts/harthmere/t.sh file src/shared/harthmere/test/snapshot_grove_quest_navigation_contract.test.ts
```

### Chapter 1 item grants and regular dialogue

A green native trigger is not proof that its paired plot-item grant remains in
usable inventory. Compare the durable Chapter 1 inventory mirror with native
items/hotbar on the state route, move matching overflow stacks back first, and
repair only the remaining deficit with an exactly-once transaction. Chapter 1
objective and repair grants must fail on a full usable inventory instead of
silently entering overflow, because later objectives cannot consume overflow.

Regular Chapter 1 speech remains on `TalkDialogModal` and
`GenericTalkDialogModalStep`. Render it through a portal so the stock talking
state can hide the normal HUD, and disable only the NPC tracking camera for
multi-speaker story pages; otherwise a remote speaker can pull the camera tens
of metres away. A missing requirement must keep the highest-priority Chapter 1
interaction registered and actionable. Let the authenticated completion route
return the precise missing-item reason; disabling the winning candidate makes F
look broken, while removing it lets F fall through to a campfire or station.

Do not treat the durable Chapter 1 inventory mirror as sufficient evidence for
plot-item repair. An older save can have a fired native predecessor leaf (for
example, Wake Up) while the durable objective-effect ledger and mirror never
recorded its tea grant. Derive the minimum currently blocking plot item from the
native fired path, compare it with usable inventory plus overflow, and repair
only the deficit. The focused progress test must cover every Chapter 1 blocking
plot requirement and prove an earlier authored grant exists.

At every linear story boundary, test two authorities together: native ECS must
activate the successor, and the Biomes UI must persist that successor as the
main quest. Merely resolving the successor during render leaves localStorage,
the journal star, HUD and `MapManager.trackingQuestId` on the completed quest.
The boundary table test should iterate every adjacent Chapter 1 quest pair, and
the browser gate should assert the journal, HUD and marker all change after the
same completion.

Every Chapter 1 conversation must end with a short, player-facing handoff that
names both the next task and where to go. Generate this from the authoritative
quest catalog/route state rather than hand-copying dozens of lines; ordered
witness/advisor conversations must name their next live person instead of
skipping to the following catalog step. Dialogue and choice surfaces require an
opaque high-contrast panel and pixel/vw-clamped type. A blurred world plus tiny
white text is not a readable modal even when DOM visibility passes.

Named NPCs sharing an interior need distinct interaction zones. Keep Jackie and
Coretta at least six metres apart, pin route targets to those same posts, and
test that the canonical Snapshot NPC body—not a second Three.js/story body—is
the one being staged. A visual duplicate or two overlapping F prompts is a
failed Chapter 1 gate.

The repository-wide `t.sh full` process can saturate a development machine
after thousands of tests and make unrelated Redis/business tests hit their
5-second defaults. Do not treat a timeout-only cluster as a product regression
or start editing those systems. Collect the failed files and rerun them once in
one fresh full-bootstrap Mocha process with a larger timeout. On July 31, the
full run reached 5,552 passing with 30 timeout-only failures; the single fresh
rerun of those files passed 468/468 in one minute. Record both results.

### Cutscene capture needs terrain availability, not automatic reconciliation

When a Chapter 1 runtime-injection capture reports `hasShardSeed:false` for
every focused camera/cast coordinate, stop the batch. That result means the
selected warm runtime is not serving the required terrain shards to the
capture client; it does not mean sixteen unrelated scene cameras are wrong.
Preserve the report, verify the web/sync pairing and terrain-bearing snapshot,
then rerun only the affected scene ids.

Do not run production reconciliation merely because a cutscene capture cannot
see terrain. If terrain source, shard ids, water, buildings, and overlays did
not change, reconciliation is unnecessary and can consume substantial time and
memory while interrupting the application. Reuse an exact recent image whose
Redis snapshot already contains the terrain, or start a small isolated
terrain-bearing runtime. Reconciliation belongs only to an actual terrain or
world-content migration.
