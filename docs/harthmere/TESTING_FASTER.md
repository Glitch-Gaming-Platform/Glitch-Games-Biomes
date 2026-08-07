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
scripts/harthmere/t.sh perf       # 38 tests, 0.03 s — FPS frame path + polling/save/telemetry
scripts/harthmere/t.sh combat     # 103 tests, 0.14 s — melee acquisition, VFX, monster speed
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

**Isolate full-suite failures with the full bootstrap.** On August 5 a
seven-minute full run reported one `harthmere_npc_hit` reach failure after
7,037 passes. `t.sh file` was not a valid diagnostic for that server/ECS row:
all 36 tests failed earlier because the fast lane intentionally omits `CONFIG`.
The same file under pinned Node 24 and `.mocharc.json` passed 36/36. Use:

```sh
PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH" \
NODE_OPTIONS=--no-experimental-strip-types \
node_modules/.bin/mocha --config .mocharc.json <file>
```

Keep the original full failure recorded as an order/shared-state flake until a
subsequent complete run is green; do not misclassify the fast preset's missing
bootstrap as the product defect.

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

| You changed…                                | Run                        | Cost                              |
| ------------------------------------------- | -------------------------- | --------------------------------- |
| Chapter 1 data/logic                        | `t.sh ch1`                 | 4.6 s                             |
| Quest containers, F prompts, world objects  | `t.sh quests`              | 0.8 s                             |
| A BiomesUI tab                              | `t.sh ui`                  | 1.1 s                             |
| Inventory icons or item presentation        | `t.sh icons`               | one focused serial release lane   |
| Quest/container/UI handoff                  | `t.sh gate`                | one Mocha startup + one typecheck |
| Cutscene defs or the generator              | `t.sh cutscene`            | 2.9 s                             |
| FPS, polling, cloud-save, telemetry changes | `t.sh perf`                | one focused Mocha + static guards |
| One file, tight loop                        | `t.sh watch ch1`           | ~1 s per save                     |
| Types (the thing `./b test` never checks)   | `t.sh types`               | ~3 s                              |
| Server handlers, Bikkie, ECS gen, triggers  | `t.sh full`                | minutes                           |
| Anything shipping to players                | `t.sh full` + browser gate | —                                 |

### The one thing that will bite you

**`./b test` does not typecheck.** `tsconfig.json` configures ts-node with
`transpileOnly: true` and `swc: true`. Green tests say nothing about type
correctness. Run `t.sh types` too — it is 3 seconds.

For the final FPS response, run `t.sh perf` first. It checks static Harthmere
matrix freezing, renderer frame setup, dynamic-quality throttling, Chapter One
poll dedupe/event refresh, compact cloud-save responses, and bounded telemetry
outbox draining in one warm lane. Then run `t.sh types:client`; the performance
preset deliberately does not duplicate that compiler process.

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

Worked example, reconfirmed 2026-08-04:
`src/client/game/interact/item_types/attack_destroy_delegate_item_spec.test.ts`
reports **12 passing / 5 failing** through `t.sh file` / `.mocharc.fast.json` and
**17 passing** with `.mocharc.json`. It builds real items and resolves block
destruction hardness, so it needs Bikkie. It is therefore excluded from the
`combat` preset with a note in `t.sh` rather than being "fixed" by weakening its
assertions.

### 3.1 The two lanes added by the 2026-08-03 captured-session pass

`t.sh combat` exists because of a specific, embarrassing gap. A 374-second
production capture proved that melee had been broken in the shipped build the
whole time, and **every existing suite was green**. The proof was in the client's
own `/api/cval_logging` payload:

```text
"events": { "moveEvent": 6369, "emoteEvent": 21, "updatePlayerHealthEvent": 2 }
```

21 swing emotes. Zero `updateNpcHealthEvent`. The player attacked repeatedly for
six minutes and the cursor never once produced a target.

Nothing caught it because the broken seams were all _configuration-shaped_, not
logic-shaped, and each looked correct in isolation:

- melee acquisition depended on `nativeBiomesEcsAuthorityEnabled()`, which is on
  by default in production and off in most test setups;
- the projectile/magic-charge VFX layer was gated on
  `shouldRenderHarthmereRuntimeAssets()`, which is **true on localhost and false
  in production** — so it worked perfectly on every developer machine;
- a native item with an unresolvable combat profile failed _closed_, silently
  disarming the player.

The lesson for new tests: **assert the production configuration explicitly.** A
test that only ever runs the localhost branch of an environment gate is proving
the branch you are not shipping. Where a full behavioural test would need a
renderer, a spatial index and a camera, a source contract that pins the _shape_
of the gate is still worth having — that is what
`overlaysFrameBudget.test.ts`, `cursorNativeMeleeAimAssist.test.ts` and
`harthmere_combat_vfx_always_on.test.ts` are.

A follow-up sweep of every environment gate in `src/client` and `src/shared`
found two more subsystems shipping dead for the same reason: the local player's
third-person weapon rig (animated every frame by its own rAF loop, into a group
that never reached a scene) and the terrain shard pre-warm ring (documented as a
shipped guardrail, gated on localhost since the day it was written). Full sweep
and verdicts: `HARTHMERE_RENDER_PERF_AUDIT_2026-08-03.md` § A.1.

The shape to grep for, when you suspect more of these:

```sh
grep -rn 'hostname === "localhost"' src/client src/shared
grep -rn 'getItem(.*) === "1"'      src/client src/shared
grep -rn 'NODE_ENV.*production'     src/client src/shared
```

Then ask of each hit: _is the thing behind this gate actually a dev tool?_ A
diagnostic overlay is. A projectile, a held weapon and a terrain streaming
optimisation are not.

Both lanes are pure-data and stay in the fast preset:

```sh
scripts/harthmere/t.sh perf     # 38 tests, 0.03 s
scripts/harthmere/t.sh combat   # 90 tests, 0.14 s
```

### 3.2 Grove onboarding audits are a three-tier batch

Do not call a Grove quest fixed because its marker id exists or its synthetic
completion fixture passes. The August 6, 2026 onboarding audit found five
player-facing failures while the original catalog, live-authority, quest, UI,
and marker suites were green. Use all three tiers, serially:

```sh
# Collect every failure; do not stop at the first red lane.
failures=""
for scope in grove grove:live quests ui icons types; do
  scripts/harthmere/t.sh "$scope" || failures="$failures $scope"
done
printf 'failed lanes:%s\n' "$failures"

# Then run the all-onboarding browser batch on one warm stack.
HARTHMERE_E2E_SNAPSHOT_GROVE_ONBOARDING_ONLY=1 \
HARTHMERE_E2E_FAST_GROVE_CATALOG=0 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Fix the collected report as one source batch, rerun only the failed focused
lanes, then rerun the complete six-lane batch once. Never start these scoped
Mocha/typecheck lanes in parallel; they compete for the same TypeScript startup
and turn deterministic tests into timeout noise.

The three Grove tiers prove different things:

1. `grove` proves catalog topology, gates, giver assignment, and waypoint
   resolution.
2. `grove:live` proves all 51 authored rows can advance through the live
   authority reducer.
3. the browser batch proves the player can see, understand, and perform every
   onboarding step. Capture an accepted-state frame, a current-step frame, and
   an after-completion frame for every objective; a final quest-complete frame
   alone is not sufficient.

Apply systemic fixes at the shared seam and audit every quest against them:

- `interact` means an explicit F/use/inspect action. Never accept
  `start_collide_entity` or `start_collide_placeable` as proof. The captured
  Taye HAR showed the paint objective completing from collision without a
  deliberate inspection.
- In Snapshot Grove Cloud Save records, `objectiveIndex` is completion evidence
  for the objective just submitted. The current cursor is `stepId`, then
  `progress - 1`; readers that prefer `objectiveIndex` make the journal and map
  lag one step and can display the wrong crossed-off task.
- Every active quest must persist an owned current-step destination for the
  HUD/minimap, advance that destination with the objective, and clear it on
  completion. A landmark row or optional “Show on map” action does not prove
  automatic guidance.
- A highlighted HUD target must be a valid completion path for that objective,
  and `TutorialDirector` must clear it on the next `stepId`. Test the current
  step and the immediately following step so controls do not keep glowing.
- A cooking objective must use the cooking station catalogue and authoritative
  `cook_collect` result. Enqueueing a timer or publishing a synthetic craft
  event is not completion. Assert the exact station kind, inputs, output,
  recipe id, and next quest cursor.
- An exact inventory icon is not a world mesh. A custom Grove item needs a
  semantic Bikkie definition, a Blender-authored held/drop GLB, a runtime asset
  mapping, and a regression asserting it does not borrow an unrelated donor
  mesh.
- A procedural Grove prop is not an ECS container. If the overlay has only a
  landmark `objectId` and no real container entity, exact authored semantics
  must route it through the signed `world_object_interaction` receipt (`read`,
  `inspect`, `gather`, `use`, or `practice`). Calling `/native_container` with
  an invalid entity produces the misleading “move closer” loop seen at Kit's
  parcel stand. Audit every Grove objective marker and require zero synthetic
  props to resolve to `open_container`.
- Collectibles with different story meaning need different marker ids,
  positions, labels, and visible props even when they temporarily share one
  inventory item id. In particular, clean, mucked, and sealed samples must not
  reuse a generic muck patch or the same world column; test pairwise positions
  and the current-step map pin.
- Keep the ECS/Bikkie/Gaia boundary explicit during Grove repairs. Quest
  progress and per-player inventory remain authoritative ECS/event state;
  stable item identity, recipe defaults, and shared presentation belong in the
  Bikkie overlay; static non-farming quest props must not acquire a Gaia
  dependency. When a code-authored Bikkie item or recipe changes effective
  output, bump `HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION` so `/api/bikkie`
  clients cannot reuse an immutable response from the prior overlay.
- A combat tutorial may advance only from resolved damaging contact, never
  from animation start, proximity, collision, or a generic click. Browser E2E
  must use the real Mouse0 route, assert the exact target offset/name and
  positive damage event, then prove native ECS, Cloud Save, and frontend quest
  projections all advance. Keep any compatibility mouse bridge gated to the
  exact active tutorial objective and melee reach so mining/building clicks do
  not become attacks.
- An NPC with many offers must expose a bounded window without making later
  quests unreachable. Test both the maximum visible count and that accepting or
  completing one offer reveals the next queued row.

Keep `scripts/harthmere/check-biomes-ui-tutorial-runtime.cjs` alias-aware. Do
not patch one compiled `require()` string: authored cue code imports shared
Grove modules through `@/`, and a checker that crashes before its first
assertion is harness failure, not product evidence.

For application-code iterations, use the existing mutable hotfix/warm-stack
path below. A new immutable GLB is an asset-boundary change: create and inspect
it through Blender MCP, test it from `public`, and perform at most one final
asset/package refresh after the complete source batch. Do not rebuild the image
for each TypeScript/UI correction.

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

- **Do not test source changes against old artifacts. Prefer a warm-stack
  hotfix when image contents did not change.** Record the base image digest and
  server/client build ID before E2E. For application-only changes, build only
  the affected bundle, refresh the bind-mounted app with
  `refresh-warm-local-stack.cjs`, and hot-copy the current `dist` tree into any
  standalone server process (such as Anima) before restarting that process.
  Preserve Redis. Rebuild the Docker image only when dependencies, native
  artifacts, operating-system packages, or image-owned files changed. If an
  image rebuild is required, do it once after the complete fix batch and run
  every affected checkpoint against that exact image and build ID.
- **Read dialogue paging state from the element that owns it.** The Chapter 1
  stock-dialogue portal carries `data-chapter1-dialogue-page` on its root; it
  is not a child marker. A descendant lookup made a visible Wake Up dialogue
  wait for two minutes and fail before sending its valid completion request.
- **Do not start duplicate scoped typechecks.** `t.sh gate` already includes
  `tsconfig.ch1check.json`. Run either `t.sh gate`, or an explicit parallel
  batch that omits the separate `t.sh types`; never both at once.
- **Run production/server builds with the Node version pinned by `.nvmrc`.**
  This repository is on Node 24 (`.nvmrc` currently pins `24.18.1`), but a
  desktop shell can still resolve `node` to v20. `next build` may get far
  enough to waste minutes before server webpack fails with
  `experiments.typescript requires Node.js >= 22.6` / missing
  `module.stripTypeScriptTypes`. Print `node --version` before the expensive
  build and switch the PATH/runtime once; do not restart the client build.
- **Pin `linux/amd64` when packaging `Dockerfile.biomes` on Apple Silicon.**
  The production image intentionally installs audited AMD64-only Bazelisk,
  Node/native modules, and runtime dependencies. An unqualified Docker Desktop
  build on an ARM host can select `linux/arm64`, get as far as the Bazel setup,
  and then fail under Rosetta with a missing x86-64 loader. Before packaging,
  inspect the last accepted image architecture and run
  `docker build --platform linux/amd64 -f Dockerfile.biomes ...`. Do not count
  or retry an ARM candidate; it never packaged the application artifacts.
- **Preflight `GLITCH_TITLE_TOKEN` before building a local Glitch image.** The
  unified launcher exits immediately when the token is absent, even when the
  code under test uses a `local-*` install identity. Verify that the secret is
  available without printing it before spending minutes on Next, webpack, and
  Docker. Never copy the token into source, command output, or test artifacts.
- **Give isolated stacks their own complete readiness contract.** When a
  source-exact stack runs beside the release-gate stack, publish unique web,
  sync, and Redis ports and pass all three to `e2e-jump.cjs ready` together
  with the isolated container name. Checking web on the new port while leaving
  sync/Redis defaults pointed at the old stack mixes evidence across images.
- **A running unified container is not proof that its child services are
  alive.** The launcher process can remain running in a listener wait loop
  after Shim or another child has already exited. Do not accept `docker ps`, a
  bare TCP listener, or the container state as readiness. Require
  `e2e-jump.cjs ready` to see Web plus the per-service lifecycle endpoints for
  Logic, Sync, Trigger, Shim, and Bikkie before opening a browser.
- **Bootstrap a fresh external Redis with the focused production topology,
  not the ordinary shim/memory preset.** The ordinary preset can still reach
  `loadBakedTrayFromProd` and fail on a local machine without GCloud even when
  the no-cloud flags are present. For an exact-image browser lane, use the
  release-gate Redis/HFC modes (`redis2`, `hfc-hybrid`, Redis chat/firehose and
  Bikkie cache), `GLITCH_FOCUSED_NATIVE_E2E_STACK=1`, and the no-cloud/skip-prod
  flags. Run one explicit bootstrap job with
  `GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1`, `GLITCH_POPULATE_SNAPSHOT_REDIS=1`, and
  `GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1`; stop that job before starting the app,
  then require the installed snapshot hash, a realistic DB size, and all three
  canonical seed keys. Never let an ordinary app replica populate or flush an
  external Redis implicitly.
- **Glitch web play links do not forward arbitrary query parameters.** A live
  `/games/<title>/play?invite_code=...` check kept the parameter on the Glitch
  parent page, but the Biomes iframe received only Glitch-owned launch fields
  (`install_id` and `glitch_auto_play`) and `document.referrer` was reduced to
  `https://www.glitch.fun/`. Do not hide this platform failure behind a manual
  code-entry field: the player-invite requirement is a one-click Glitch URL.
  Acceptance must prove `invite_code` reaches the game iframe and triggers the
  automatic post-Wake-Up join. If Glitch still drops it, report the platform
  handoff as blocked instead of changing the requested player experience.
- **Invite rotation must revoke the previous record, not only replace the
  inviter's active-code pointer.** Otherwise **New Code** appears to rotate the
  invitation while the old code remains joinable until its one-hour TTL. Keep
  a lifecycle test that creates, rotates, and proves the prior code returns
  `INVITE_NOT_FOUND`.
- **Invite idempotency needs an atomic claim immediately before the warp.** A
  separate `hasClaim` then `setClaim` sequence lets two simultaneous Wake Up
  retries both publish a warp. Acquire the Redis claim with `SET ... NX EX`,
  return `already_joined` to the loser, and release the claim if publishing the
  warp fails so a real retry remains possible. Validate player readiness and
  destination restrictions before acquiring the claim, or a temporary failure
  can consume the invite without ever moving the player.
- **Do not use obsolete Mocha bootstrap paths.** The supported single-file
  command is `scripts/harthmere/t.sh file <path>`. Do not invent a direct
  `mocha --require src/server/test/register.ts` command.
- **A scoped typecheck that includes test files must include the test globals.**
  Put `"types": ["node", "mocha"]` in that scoped tsconfig. Hundreds of
  `Cannot find name 'describe'/'it'` diagnostics are a harness defect, not
  evidence that application code is broken; fix the scoped program before
  interpreting its remaining diagnostics.
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
  HARTHMERE_E2E_REDIS_PORT=6493 \
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

- **A standalone Anima process needs its own explicit ready signal.** The app
  lifecycle gate can be green while a separate Anima container is still loading
  its replica. After a server-bundle hotfix, require the new build ID in Anima's
  logs, require host/app/Anima `dist/anima.js` SHA-256 equality, and wait for
  both `anima now running` and `HFC Bootstrap complete`; increasing
  `Loaded ... entities` messages are still bootstrap, not test readiness. A
  retained worker with no `/app/dist` bind can answer from the right Redis and
  still run stale movement code from its base image, producing a false product
  failure at an old collision boundary.

- **Quiesce browser pages that survived a stack restart before launching a new
  E2E context.** A live `/at` page can reconnect the moment Sync becomes ready
  and immediately resume its Harthmere polling loops. On August 1 that stale
  client saturated the freshly warmed web process while the new E2E page spent
  its entire 120-second navigation budget waiting for `DOMContentLoaded`.
  Navigate old observer/game pages to `about:blank` (or close them), wait for
  their requests to stop, then launch the focused runner. This is separate from
  the lifecycle gate: every service can correctly report `UP` while a surviving
  browser client is still making the test lane non-quiescent.

- **Respect the runtime-scoped browser lease.** Production-shaped runners use
  `scripts/harthmere/browser-runtime-lease.cjs`. One lease-owning process may
  open multiple Chromium instances or contexts for multiplayer. Acquisitions
  are reference-counted in that process, so closing one browser keeps the lane
  reserved until its final sibling closes. All Harthmere `chromium.launch`
  scripts are statically required to use the lease directly or through
  `leasePlaywright` / `resolvePlaywright`.

  A second process targeting the same web/Sync endpoints waits on the same
  atomic lane directory; optional container-name omissions therefore cannot
  split one runtime into two locks. Truly isolated stacks receive different
  hashed lanes and may run concurrently; set
  `HARTHMERE_E2E_BROWSER_RUNTIME_LANE` manually only when the runtime really is
  isolated. A manual lane label does not override endpoint collision
  detection: two labels that still point at the same web/Sync endpoints
  serialize. Never delete a live lease or kill its owner to start yours. During
  migration the lease also waits for the old
  `/tmp/biomes-harthmere-native-ecs-browser.lock`. Multiplayer combat should
  open its second client inside the same lease-owning process and close it
  during cleanup.

- **Classify media cancellation only in a lane that does not test that media.**
  Chromium may cancel the current ambient `.webm` or authored ambient `.mp3`
  when a newly authenticated hill/retaliation page changes tracks. Those
  non-audio gates record only those exact same-origin GETs plus
  `net::ERR_ABORTED` as transient. Do not generalize the allowance to other
  errors, asset families, or the combat-music gate, where loading and playback
  are acceptance evidence.

- **Do not replay unrelated giant traversal while iterating on retaliation.**
  `HARTHMERE_E2E_RETALIATION_ONLY=1` is the smallest real-browser slice: two
  synchronized players, the complete first authored road pack, and one
  unrelated-group negative control. Solitary rotation is a deterministic unit
  gate by default; set `HARTHMERE_E2E_RETALIATION_SOLO_ROTATION=1` only for the
  optional terrain/LOS diagnostic. The broader
  `HARTHMERE_E2E_HILL_COMBAT_SKIP_GIANT=1` lane still runs ledge and crest while
  skipping only the independent Helix locomotion row. Omit both flags for
  giant-locomotion changes and the complete hill-combat release batch.

- **Own every precondition of a real combat event.** `UpdateNpcHealthEvent`
  does not trust the requested HP delta: Logic validates the authoritative
  selected item, level, cadence, reach, player health, and native combat rules.
  A retained visual-auth player may have last selected a camera, tool, or other
  non-combat item, which makes a valid retaliation fixture look like an Anima
  timeout. The multiplayer retaliation lane stages a `training_dagger`, proves
  the real event, and restores the player's inventory, selected item, trigger
  state, health, and position. Do not depend on ambient player inventory state
  and do not replace the real event with a direct Health mutation in this gate.

- **A fixture outside the current subscription cannot synchronize before the
  player moves to it.** Create the collideable floor authoritatively, move the
  frontend-owned player into the fixture column, wait for the floor in local
  ECS, then reassert the player pose after collision data arrives. Waiting for
  local version > 0 while the actor remains at the safe-start column is a
  guaranteed harness timeout, not a Sync or combat failure.

- **Freshly allocated NPC ids can turn a post-restart Anima test into a shard
  lease lottery.** If Health admin writes advance but `npc_state`, movement, and
  public combat state remain completely untouched, the fixture never entered
  Anima; no targeting decision occurred. The retaliation-only lane temporarily
  uses the complete already-authored first road pack plus the negative-control
  and optional solo identities that are present in the managed world, then
  restores their canonical ECS entities and clears any test-created
  presentation components. Do not retry random ids until one happens to land on
  a held shard, and do not classify zero Anima-owned writes as an aggro failure.

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
  For a focused visual proof of this handoff, run only the `quests` feature at
  `gather_parts` with
  `HARTHMERE_E2E_CHAPTER_1_MATERIAL_VISUAL_CAPTURE=1`. The runner writes one
  screenshot while the selected material source is centered on the real Map
  (including its world coordinates) and one after the actor reaches Luis's
  visible repair cart, before the turn-in removes that objective prop. Do not
  enable the default Chapter 1 feature set for this check: that also pays for
  every cutscene, dungeon-terrain, cast, gate, and branded-still audit.
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
  external evidence, verify every still-missing routed supplier target, and wait
  for signed auto-completion. The objective can legitimately begin with nonzero
  supplier progress because purchases made by earlier Chapter 1 objectives are
  real vendor transactions; follow the live `targetLabel` and require monotonic
  progress instead of assuming Rin is always index zero. Waiting for a second
  Chapter 1 prompt recreates the duplicate HUD/control bug the integration was
  designed to remove. The board can render through either its dedicated world
  prompt or the production Unified HUD's `Read Jobs Board` button; require a
  visible built-in control, not one renderer's private test id. Close any
  interactive game renderer before this headless campaign: if the focused player
  enters `icing` or loses challenge components, treat that as session/resource
  contention and prove the external requirement reached `ready` before
  diagnosing Chapter 1 auto-completion.

- **Promoted Chapter 1 cast members keep their canonical ECS identity.**
  AUGUR-9 is the existing Mucked Robot, not a second seeded robot. Its
  authoritative ECS label remains `Mucked Robot`; the Chapter 1 projection
  presents `AUGUR-9` only after the chapter starts. Native-cast browser checks
  must prove that canonical entity, position, and NPC metadata exist without
  rewriting the shared label. Presentation tests separately prove the
  per-player staged name. The focused cast seeder must continue to exclude all
  promoted actors.

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

- **Do not lock or teleport Chapter 1 companions for release acceptance.** The
  old deterministic shortcut raced Anima's legitimate escort tick and proved
  only that an admin update could momentarily place the NPC inside the 22-metre
  gate. The release row must keep Anima authoritative, wait for the companion's
  real position to reach the authored radius, and budget for the full journey.
  Position fixtures remain appropriate for isolated source diagnosis, but are
  not quest-completion evidence.

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
defined`. Use `NODE_ENV=production NODE_OPTIONS=
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

- **A promoted quest NPC's unconditional stage is its shared pre-quest home.**
  On August 1, Jackie's canonical ECS seed was moved from the May snapshot's
  Road Ahead post to the Chapter 1 road-house. The chapter projection then
  returned that road-house position even with `unlocked: false`, so a new
  player walking up the Grove stores could no longer find the native quest
  giver. Recover historical homes from the installed `snapshot_backup.json`
  entity (`npc_metadata.spawn_position`), not from a later story anchor. Keep
  the first stage direction of every `promotesExistingEntity` cast member on
  `kind: "seeded"`; add conditional per-player directions for chapter start,
  active objective, flags, and endings. The focused gate is the Chapter 1
  staging unit suite plus the owning NPC seed test. Do not pay for a browser
  run while this data/phase contract is still changing.

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
- **A source toast is not inventory proof, and cached job state is not progress
  proof.** The August 5 Grove retest showed `Gathered Garden Edge Berries` even
  though the fallback landmark issued no native inventory exchange; the Jobs
  Board snapshot then kept its old `inventoryItems`, so the map pin never moved.
  For a label-authored job source, require one server-validated world-object
  receipt, an actor-bound native `inventory_exchange`, the returned live
  inventory snapshot, and a source-to-board marker transition driven by that
  freshest snapshot. Also assert that source interaction does not call
  `complete_job_quest` or show the expected missing-items rejection toast.
- **Delivery pickup randomization may choose only physical F targets.** The same
  retest assigned Run the Coop an abstract business-outpost navigation marker,
  leaked its underscore id into the map label, and left no object to pick up.
  Preserve an authored pickup such as `coop_supply_box`; otherwise draw only
  from registered Grove props or Jobs Board field-target/work-station props.
  The browser proof must show the human registry label, the visible object and
  F prompt, the parcel in native inventory, and the marker advancing to the
  drop-off. A finite coordinate or resolvable map marker alone is insufficient.
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
- **A visible job tool is not acceptance evidence by itself.** Protected-region
  ACLs may block a tool action, but they must not erase the selected Muck Rake or
  Repair Mallet from the player's hands. After any held-tool rendering fix, run
  the cleanup and repair jobs together with
  `HARTHMERE_E2E_ONLY_JOB_TEMPLATE_IDS=town_repair_fence,town_cleanup_muck_patch`
  with `HARTHMERE_E2E_REAL_JOB_TOOL_PURCHASE=1` and
  `HARTHMERE_E2E_JOBS_KEEP_GOING=1`. Start each row without its required tool;
  require the accepted job to mark the exact vendor, buy the tool through the
  real Shopfront, require the map marker to return to the field objective, move
  the purchased backpack item into Hotbar 1 through the real Inventory UI, and
  only then require the exact tool in native `selected_item`, a non-empty held
  mesh, the visible field `F` prompt, a server-owned world-interaction receipt,
  the todo becoming completed, the active destination moving back to the Jobs
  Board, successful turn-in, and native-wallet reward. Do not sign off from an
  inventory icon, donor-id unit test, local equipment projection, attached mesh,
  or direct fixture grant alone.
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
  server atomically replicates it and deducts exactly ten survival stamina; it must
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
- **A wrapper failure does not prove its compiler has exited.** On August 2,
  one `./b build next` caller returned an ENOENT for
  `.next/server/pages-manifest.json`, but process inspection showed another
  authorized deployment still owned a live `node .../next build --webpack`
  child and the partial tree. Before quarantining, deleting, or restarting
  `.next`, inspect the full process tree for the build launcher, `next build`,
  and Webpack. Wait for every owner to exit, coordinate an explicit release,
  then re-check `BUILD_ID`, `server/pages-manifest.json`, `server`, and
  `static`. Never clean a partial tree while any compiler remains active; that
  creates a second writer and corrupts both artifacts.
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
- **A helper's final endpoint smoke is not permission to skip the retained-stack
  stability gate.** On August 2, `--skip-build --local-smoke --keep-local`
  finished its root, auth/session, and player-mesh checks, then the disposable
  no-persistence Redis container restarted once under `unless-stopped`. The
  helper still printed `Local production image smoke passed`, but Redis had
  lost the snapshot and chat's consumer group; Web then shut down with
  `NOGROUP`. Before any feature browser, hold the stack for a short stability
  window and repeat full lifecycle readiness. Require app and Redis restart
  counts `0`, Redis `PONG`, the installed snapshot hash, a realistic DB size,
  and the three canonical Grove seed keys. If Redis restarted, discard the
  browser attempt and recreate the disposable snapshot; never let a healthy
  TCP port or stale lifecycle log override the restart evidence. The local
  smoke helper now enforces this again immediately before its final pass.
- **Redis Docker health is not a literal readiness assertion.** The stock
  `redis-cli ping` health command exits successfully while Redis is still
  returning `LOADING Redis is loading the dataset in memory`; a replacement
  1.9 GiB RDB was therefore marked healthy before `DBSIZE` was even numeric.
  Before validating hashes or opening Chromium, require the command output to
  equal exactly `PONG`. Treat `LOADING`, blank output, or any error string as
  not ready even when Docker reports `healthy`.
- **A 16.56 GiB Docker VM has capacity for one full 335k-world lane.** On
  August 2, several isolated exact-image tasks correctly chose unique networks,
  ports, containers and Redis databases, but starting them together consumed
  roughly 9 GiB in Redis plus 4.3 GiB in app/maintenance processes. One Redis
  was OOM-killed before any browser opened. Isolation prevents state collision;
  it does not create memory. Serialize heavy lanes. Before handing off the
  runtime token, stop the app/maintenance role first, issue `SAVE` to a healthy
  Redis, retain its container/RDB, then stop the forwarder and Redis. A force
  stop of a launcher can report exit 137 without `OOMKilled`; record both
  fields instead of treating the exit code alone as an OOM. On resume, recreate
  or restart the assigned lane, require literal PONG, full lifecycle readiness,
  and app/Redis `RestartCount=0`. Every screenshot or gameplay assertion made
  before that fresh lifecycle is invalid environment evidence. Never delete a
  neighboring task's lane to make room, and never start a second full lane
  while the current owner is still reconciling or testing.
- **Do not hide restart-gate failures behind a later standalone readiness
  pass.** A combined `set -e` preflight correctly stopped at
  `Redis RestartCount != 0` and printed nothing, then a separately invoked
  `e2e-jump.cjs ready` went green because that helper checks services, not
  historical restarts. Print the app/Redis restart counts, snapshot hash,
  database size, canonical keys, and literal PONG before invoking readiness,
  and require all of them in the same accepted record. If the browser lock was
  acquired before a Redis replacement/restart, that run is invalid even if it
  finishes later; coordinate with its owner and rerun only the affected slice
  after a zero-restart second stability window.
- **Manual exact-image recreation must preserve the browser authorization
  contract.** Recreating only the web role with the right image, Redis, ports,
  and control token but `HARTHMERE_NATIVE_ECS_E2E=0` makes
  `/api/harthmere/visual_test_auth` correctly return HTTP 401
  (`Native ECS E2E access is disabled`). Before Chromium, inspect the active
  container and require both `HARTHMERE_NATIVE_ECS_E2E=1` and a nonempty
  `HARTHMERE_E2E_CONTROL_TOKEN`; retrieve the token without printing it. An
  auth 401 before page navigation is an environment failure with zero gameplay
  coverage. Preserve Redis, correct only the app role, and repeat the complete
  readiness/hash/restart gate instead of replaying or diagnosing the feature.
- **Never remove the retained app before the replacement container has been
  created successfully.** On August 2, a manual warm-artifact recreation read
  Docker's environment list into repeated `--env` arguments, retained the
  trailing blank line as an empty argument, removed the stopped app, and then
  failed `docker run` with `invalid environment variable`. Filter empty entries
  and use `docker create` under a temporary name first. Verify its image,
  mounts, environment contract, and port plan; only then remove/rename the old
  app and start the replacement. Redis survived this incident, but deleting the
  only copy of the app configuration turned a one-line client mount into an
  unnecessary manual reconstruction. Prefer the explicit launcher environment
  over cloning a container's full `Config.Env` whenever possible.
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
  capture duration, then release the interval. Gate visibility begins before
  the opening animation advances, so wait for both `visible` and a positive
  aperture instead of sampling the first mesh frame. Never change shared story
  state merely to make a catalog scene visible.
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
  three-minute browser bootstrap timeout. Docker Desktop does not route host
  traffic directly to a Linux container's bridge IP; expose the Redis test
  container on `127.0.0.1` or use the documented published-port `socat` sidecar,
  then require `redis-cli ... PING` to return `PONG`. Never substitute a host
  process that forwards to the transient container IP. Production does not use
  this desktop bridge: the app reaches the private Redis VM through its VNet,
  and the deployment gate must still pass the same RESP/write/persistence
  health checks before image push and before a new revision. Sync remains
  TCP-only — never curl the sync/WebSocket port;
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

- **Signed warp authorization must cover the transition, not camera float
  representation.** The August 2 exact-image Chapter One gate returned HTTP 200,
  but Logic rejected its signed warp with `Chapter 1 warp authorization failed`.
  Redis, Web, Logic, and Sync were healthy. The signed Web input carried camera
  orientation `[0.02, 3.15]`; the Logic-side event carried `[0, 3]`. Orientation
  only controls the view after arrival, so token version 2 signs the player,
  action, dungeon, run, party, encounter-reset flag, and exact destination while
  deliberately excluding orientation. Regressions must prove that a transported
  orientation still validates and that any destination or transition change is
  rejected. A browser gate that expects a signed event must also scan Logic logs
  for authorization rollback; an HTTP response alone is not commit evidence.

- **Pointerless desktop is not mobile.** Headless Chromium intentionally runs
  without a durable Pointer Lock during most catalog tests, but that capability
  gap must not mount touch joysticks, the hold-to-crouch button, mobile action
  prompts, or the mobile hotbar in a desktop viewport. Use
  `HARTHMERE_E2E_DESKTOP_CONTROLS_ONLY=1` for desktop screenshot evidence; the
  runner keeps Pointer Lock capability visible and asserts that both mobile HUD
  markers are absent. The product's pointerless desktop fallback still attaches
  mouse/keyboard input and suppresses the lock overlay independently. Only an
  actual touch device or mobile/tablet UA enables the virtual joystick. If the
  stale Wake Up bootstrap screen is still visible, let the documented
  post-bootstrap normalization/reload clear it before clicking the desktop
  `Enter Game` overlay; the two full-screen layers can coexist briefly, but the
  onboarding layer correctly owns pointer events during that interval.
  Desktop evidence uses the bounded 48 m / 0.5 render profile and returns the
  player to the Grove center before capture; do not use the final diagnostic
  position from a gate or dungeon test as the release screenshot.

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

For a boss or other large-subject still, run
`scripts/cutscenes/preflight-boss-promo-angles.cjs` before the browser. In the
common all-boss case use `--recommended --strict`; this evaluates only the
logged first candidate for each boss instead of paying for every bracket. For
Elsewhen scenes the preflight converts the dolly and subject sightlines back to
authored dungeon voxels, rejecting walls, roofs, lintels, and columns offline.
Generate all presets only after a recommended candidate fails visual review. In the
live generator, use `--camera-preset` with a unique `--output-dir`; this keeps
raw/branded/HAR/metadata evidence together and avoids a rebuild for each angle.
A live capture also checks 17 eased camera positions and three subject
sightlines against streamed terrain tensors before saving. A missing tensor is
a readiness wait; a solid hit is an immediate composition failure. This turns
camera-in-terrain mistakes into a short failed row instead of a completed bad
PNG.
After the four coordinate families pass, use one warm
`cutscenePromoBatch=boss-marketing&bossCameraPlan=recommended` page. This keeps
the renderer and authenticated observer warm while still applying the
scene-specific first choice, persisting every branded/raw pair before moving
on. Do not use the eleven-scene batch as the initial visual preflight.
A passing floor proof is not a passing horizon. The marketing gate must also
wait for the camera-facing terrain view corridor (center/left/right at bounded
depths) so a loaded foreground shard cannot hide unfinished combined meshes.
Do not increase draw distance until a read-only terrain survey distinguishes
missing world data from client mesh readiness.

### 4.4 Keep the stack warm

Restarting the stack per test is the single biggest browser-loop cost. Start it
once and keep it; use a fresh browser context (not a fresh stack) per case. The
runbook's memory rules still apply: one Chromium context at a time, serial not
parallel, `NODE_OPTIONS=--max-old-space-size=3072`.

The local production launcher now gives Redis and the web app an
`unless-stopped` restart policy, a real health check, and a 15-minute default
idle window for native E2E. For focused native browser gates it waits only for
`web logic sync trigger shim bikkie`. Override that set with the space-delimited
`LOCAL_STACK_READY_SERVICES` variable when a specialized gate needs more.

Do not co-locate that browser stack with Anima and Gaia in a 16 GiB Docker VM.
The August 2 platform candidate loaded all 262,253 terrain shards with zero
holes, then the unified container was OOM-killed because Web/Sync and native
simulation shared the same memory budget. Production already uses separate web
and simulation Container Apps. The local smoke now mirrors that boundary in
phases: it boots the web role and snapshots Redis, stops web, runs the **same
immutable image ID** as a dedicated simulation role with a tiny same-image asset
server, requires the aggregate `anima=1 gaia=1` readiness marker and zero
restarts/OOM, then restores the web role without flushing Redis for browser
tests. The simulation phase uses the production 900-attempt startup allowance;
the full Gaia terrain map can take more than two minutes under AMD64 emulation.

`HARTHMERE_NATIVE_ECS_E2E=1` also defaults
`GLITCH_FOCUSED_NATIVE_E2E_STACK=1`. That topology embeds Ask's RPC/indexes in
the already-required Logic replica and does not start separate Ask, Chat, OOB,
Sidefx, or Notify processes. The current full stack measured 12.8 GiB in the
app container; the omitted processes accounted for roughly 6 GiB of RSS
(including ~2.5 GiB Ask and ~2.3 GiB Sidefx). Set
`GLITCH_FOCUSED_NATIVE_E2E_STACK=0` only for a specialized web-role gate that
explicitly needs those services; native simulation remains a separate phase.

Focused stacks also start Trigger beside Sync. Both services independently
hydrate the same 300k+ entity snapshot and neither requires the other's
listener, so serializing them added an entire second multi-minute bootstrap to
every cold browser batch. Their existing metrics readiness and Redis
consumer-group gates still run before Chromium starts; only the independent
work is overlapped. Full production rehearsals retain their historical stream-
worker ordering.

#### Serialize exact-image browser lanes on a 16 GiB Docker host

Do not boot several production-shaped snapshot stacks in parallel merely
because their ports and Docker networks do not overlap. On the August 2 exact
image, three 335k-entity Redis containers consumed roughly 9 GiB before their
apps finished hydrating; the additional app/maintenance processes pushed a
16.56 GiB Docker VM into a real Redis OOM kill. Port isolation prevented data
cross-talk, but it did not provide memory isolation. Evidence collected before
that OOM, or after a container auto-restart, is invalid.

Use one heavy runtime lane at a time:

1. bootstrap and warm one external Redis;
2. require app and Redis `RestartCount=0` and `OOMKilled=false`;
3. run every serial slice assigned to that image/Redis pair;
4. quiesce the app and browser;
5. if Redis was launched with `--save '' --appendonly no`, run a synchronous
   `redis-cli SAVE` before stopping it so the retained container can restore
   `/data/dump.rdb` instead of silently becoming empty;
6. only then release the memory token to the next lane.

#### Supported warm-Redis application refresh

Bootstrap the expensive world only once. The ordinary retained-stack command
is still the initial setup:

```bash
export HARTHMERE_NATIVE_ECS_E2E=1
export HARTHMERE_E2E_CONTROL_TOKEN="$(openssl rand -hex 32)"
export GLITCH_IDLE_SESSION_MS=900000
export SMOKE_TIMEOUT_SECONDS=1800
export HARTHMERE_SKIP_LIVE_ENTITY_BROWSER_SMOKE=1

scripts/glitch/deploy-production-local-redis-smoke.sh \
  --local-smoke --keep-local \
  --tag "warm-e2e-$(date -u +%Y%m%d%H%M%S)"
```

After that first import, do **not** run `--local-smoke` again for each source
fix. That launcher intentionally removes its disposable app and Redis before a
new smoke boot, so `--skip-build --local-smoke --keep-local` still replaces the
world. Refresh only the app against the retained Redis instead:

```bash
# Build both application outputs serially, then replace only the app container.
scripts/glitch/refresh-warm-local-stack.cjs --build all

# If another coordinated task already produced and released .next/dist/public:
scripts/glitch/refresh-warm-local-stack.cjs --build none
```

The defaults use `biomes-prod-smoke-app` and `biomes-prod-smoke-redis`. Pass
`--app <name> --redis <name>` for an isolated named lane. `--dry-run` performs
the ownership, artifact, app, network, and Redis validation without creating or
stopping a container. The helper:

1. refuses to continue while another Next/server compiler owns the outputs;
2. requires stable `.next/BUILD_ID`, `.next/server`, `.next/static`,
   `dist/web.js`, and `public` trees;
3. requires the retained Redis to be the same running, zero-restart,
   non-OOM-killed container with literal `PONG`, the installed snapshot hash, a
   realistic database size, and all three canonical seed keys;
4. copies the current app environment but forcibly sets external Redis mode,
   `GLITCH_POPULATE_SNAPSHOT_REDIS=0`,
   `GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=0`, and
   `GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=0`;
5. bind-mounts the completed `.next`, `dist`, and `public` trees read-only;
6. creates and verifies the replacement app before stopping the current one;
7. restores the previous app automatically if lifecycle, HTTP, Sync, or Redis
   readiness does not return before the timeout; and
8. verifies the Redis container identity and world contract again after the
   application is ready.

`e2e-jump.cjs ready` now accepts
`HARTHMERE_E2E_REDIS_CONTAINER=<name>`, so Docker-only Redis does not need a
host port or a second database merely for readiness. The browser/API, fixture
writer, and replacement app still must all use that one named world.

This shortcut is for client/server bundle changes. If the change touches the
Docker image, launcher, Redis bootstrap, reconciliation, service topology, or
runtime dependencies outside the mounted trees, build a new exact candidate
image and test it intact. You may still attach that exact replacement app to a
materialized external Redis with population and flush disabled, but do not mix
new bundles with incompatible old launcher scripts.

Run the static safety contract after changing the helper:

```bash
node scripts/glitch/test-refresh-warm-local-stack.cjs .
```

#### No-image mutable code hotfixes

Once a production image contains the mutable-hotfix watcher and browser
bootstrap, later application-code repairs do not need another Docker, Next, or
server-Webpack rebuild. The active manifest is stored in Redis, every web and
simulation replica polls it, and each replica applies only a manifest matching
its current build id and role.

Use the two payload surfaces deliberately:

- Backend and Next-server repairs use `writeFile`, `replace`, `deleteFile`, or
  `mkdir` against the files already in the container. File operations are
  atomic and roll back in reverse order if a later operation fails. Set
  `restart.exitProcess: true`; the watcher exits, the stack supervisor fails the
  container, and the platform restarts that replica. Startup reapplies the
  persisted patch before launching services, records the applied hash, and does
  not enter a restart loop.
- Browser repairs use `client.script` / `client.scriptBase64` and optional
  `client.style` / `client.styleBase64`. A no-store script runs before the
  immutable Next application, then the live client polls the public descriptor
  and loads a new hash-addressed script when the manifest changes. This avoids
  overwriting a `/_next/static` URL that the browser is allowed to cache for a
  year. A client patch can register cleanup with
  `window.__biomesGlitchMutableHotfix.registerCleanup(fn)`.

Every production manifest should include:

- `compatibleBuildIds`: normally the exact current `.next/BUILD_ID`;
- `targetRoles`: `web`, `simulation`, or both, never an accidental global
  default for a role-specific backend file;
- `expiresAt`: a short UTC expiry;
- `expectCount` and preferably `expectedPreviousSha256` / `expectedSha256` for
  compiled-file replacements; and
- a reviewed rollback manifest containing the original bytes. Clearing Redis
  stops future/client application but cannot reconstruct a backend file that
  was already changed.

Example combined web/backend repair:

```json
{
  "version": "combat-hotfix-2026-08-06-v1",
  "createdAt": "2026-08-06T18:00:00Z",
  "expiresAt": "2026-08-07T18:00:00Z",
  "compatibleBuildIds": ["<exact-build-id>"],
  "targetRoles": ["web"],
  "operations": [
    {
      "type": "replace",
      "path": "dist/web.js",
      "search": "<exact-old-compiled-text>",
      "replace": "<reviewed-new-compiled-text>",
      "expectCount": 1,
      "expectedPreviousSha256": "<old-file-sha256>",
      "expectedSha256": "<new-file-sha256>"
    }
  ],
  "client": {
    "script": "window.__combatEmergencyGuard = true;",
    "style": ".broken-control { pointer-events: none; }",
    "reload": "on-change"
  },
  "restart": { "exitProcess": true, "delayMs": 1000 }
}
```

Apply and persist through `/api/admin/mutable_hotfix` with the existing hotfix
token and `action: "apply_and_persist"`. The API now applies successfully
before activating the Redis manifest, so a failed replacement is not left as a
poisoned startup patch. Role-mismatched replicas skip the local operation but
still observe the activated manifest; matching replica watchers apply it and
restart themselves. A client-only manifest normally uses `operations: []` and
omits `restart`.

Run only the focused source checks while authoring this lane; do not rebuild
`.next`, `dist`, or the image:

```bash
PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH" \
NODE_OPTIONS=--no-experimental-strip-types \
  node scripts/glitch/test-mutable-hotfix-layer.cjs

PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH" \
NODE_OPTIONS=--max-old-space-size=8192 \
  node_modules/.bin/tsc -p tsconfig.mutablehotfix.json --pretty false

bash -n scripts/glitch/run-glitch-local-game-stack.sh
```

The executable contract covers atomic rollback, build compatibility, apply-
before-persist ordering, browser script/style replacement and cleanup, startup
restart suppression, and the per-replica watcher wiring. Live verification
must additionally show one applied-version/hash log per matching replica, the
unchanged base build id, healthy lifecycle endpoints after backend restarts,
and the expected `biomes:mutable-hotfix-applied` browser event.

A create-only full-topology reconciliation can also be CPU-bound for more than
ten minutes under AMD64/Rosetta before lifecycle services start. Constant CPU,
flat memory, and unchanged restart counts are progress, not a hang. A focused
original-world mode may skip that additive edge pass only when the exact test
fixture is wholly inside imported terrain and full-topology acceptance remains
assigned to another serialized lane. Never make that substitution implicitly.

For a retained warm Redis that is missing the entire additive band, native ARM
maintenance can partition the create-only terrain work without changing normal
runtime behavior. Run disjoint workers with the same positive
`BIOMES_HARTHMERE_TERRAIN_PARTITION_COUNT`, unique zero-based
`BIOMES_HARTHMERE_TERRAIN_PARTITION_INDEX` values, and
`BIOMES_HARTHMERE_TERRAIN_PARTITION_ONLY=1`. Each stable sorted-ID partition
writes only its own missing shards and deliberately does not stamp the overall
seed marker. After every worker exits, run one ordinary unpartitioned
reconciliation to verify completeness, install shared authored content, and
stamp the final fingerprint.

When shell-checking a generated entity list, remember that zsh does not split a
scalar on spaces by default. `for id in $ids` can send one giant Redis key and
falsely report `0/N` entities. Prefer a Node argument array (as the snapshot
minigame runner does), a real shell array, or explicit zsh `${=ids}` expansion.

#### Snapshot minigame exact-image gate

The dedicated runner inventories all 74 non-fishing snapshot definitions,
executes every race through start/checkpoints/finish, runs every Spleef arena
through multiplayer countdown/play/clipboard reset, runs all Deathmatches
through loadout/kill/finish, and verifies finished Deathmatch instances are no
longer advertised. It uses two rendered low-memory sessions; the historical
20x20 Spleef row opens one additional session because its persisted setting
requires three players.

Run type slices serially against the same warm, restart-count-zero stack:

```sh
set -a
. /tmp/<lane>.env # chmod 600; contains the fresh control token
set +a

COMMON_MINIGAME_E2E_ENV=(
  HARTHMERE_E2E_BASE_URL=http://127.0.0.1:<web>
  HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:<sync>
  HARTHMERE_E2E_URL=http://127.0.0.1:<web>/at
  HARTHMERE_E2E_REDIS_PORT=<redis>
  HARTHMERE_E2E_STACK_CONTAINER=<app-container>
  HARTHMERE_E2E_IMAGE_ID=sha256:<full-image-id>
  HARTHMERE_E2E_BUILD_ID=<embedded-build-id>
)

env "${COMMON_MINIGAME_E2E_ENV[@]}" \
  HARTHMERE_MINIGAME_E2E_KINDS=simple_race \
  node scripts/harthmere/test-snapshot-minigames-live-browser.cjs
env "${COMMON_MINIGAME_E2E_ENV[@]}" \
  HARTHMERE_MINIGAME_E2E_KINDS=spleef \
  node scripts/harthmere/test-snapshot-minigames-live-browser.cjs
env "${COMMON_MINIGAME_E2E_ENV[@]}" \
  HARTHMERE_MINIGAME_E2E_KINDS=deathmatch \
  node scripts/harthmere/test-snapshot-minigames-live-browser.cjs
```

The runner refuses to start Chromium unless Redis answers real `PING/PONG`,
the canonical snapshot/minigame keys exist, `e2e-jump.cjs ready` sees every
focused service, the container image and embedded BUILD_ID match the released
values, and the app has never restarted or been OOM-killed. It never builds or
starts a stack.

If a long type slice stops after some rows have already passed, preserve its
JSON report and resume only the missing IDs with
`HARTHMERE_MINIGAME_E2E_IDS=<comma-separated-ids>`. Do not throw away valid
per-row evidence by rerunning the whole slice. Snapshot worlds can also contain
ambient Twitch media near a race endpoint; React Player 3.4.0 may call the
provider's `play()` before its iframe exists. Product code defers autoplay by
one animation frame, while the exact-image runner applies the equivalent safe
retry when validating an older coordinated image. External provider failures
remain excluded from minigame browser failures, but local resource errors and
all other page exceptions still fail the run.

A timed-out `create_or_join` response is not proof that Logic rejected the
event. The event can commit before Web loses its Logic connection, leaving the
retained test actor in an active instance and its clipboard elements iced.
After that exact transport error, the runner first checks the actor's
authoritative `playing_minigame`: if it matches the requested game, the join
committed and the scenario continues without publishing a duplicate event.
If it did not commit, the runner publishes the same authoritative
`CreateOrJoinSpleefEvent` or `JoinDeathmatchEvent` through the rendered
client's native event channel and records that transport fallback in the JSON
report. This avoids a duplicate web request while still exercising the real
Logic handler; the shared web convenience route must already have at least one
green scenario in the retained evidence. Resume with the same actor IDs: the
runner quits any retained active instance before auditing the catalog, then
runs only the IDs selected above. Do not blindly retry `create_or_join`, and do
not repair the iced element directly; both can hide whether the production
quit/reset path restored the clipboard.

On a long-lived full local container, lazy asset workers and Web background
scans can consume enough CPU that both Web and Sync lose their Logic publish
call even though Docker did not restart or OOM. After retaining at least one
green shared-web-route scenario, do not pause Web or its asset workers: a
brief CPU pause does not repair an already-broken zRPC channel. Expose the
running Logic RPC port through a tiny forwarder, then resume the unfinished
IDs with a fresh repository `LogicApi` client:

```sh
docker run -d --name <lane>-logic-forward --network <lane>-net \
  -p 127.0.0.1:6504:6504 alpine/socat \
  TCP-LISTEN:6504,fork,reuseaddr TCP:<app-container>:3504

LOGIC_PORT=6504 \
HARTHMERE_MINIGAME_E2E_FRESH_LOGIC_PORT=6504 \
HARTHMERE_MINIGAME_E2E_FORCE_NATIVE_JOIN=1 \
HARTHMERE_MINIGAME_E2E_IDS=<unfinished-ids> \
  node scripts/harthmere/test-snapshot-minigames-live-browser.cjs
```

The rendered clients still observe and assert the authoritative ECS state;
only their native event publications use the fresh supported Logic connection.
The runner records the publication count and transport fallbacks in its JSON
report. A fresh client can receive Logic's explicit `Too much contention`
non-commit outcome when rendered clients are concurrently writing movement to
the same actor. Retry only that typed outcome with bounded backoff. Do not
freeze rendered Chromium pages around the transaction: freezing pauses Sync
heartbeats, the server ices the disconnected actor, and `IcedSideEffect`
removes it from the minigame. Never use this mode for the first shared
Web/browser route proof.

An interrupted Spleef join can leave a catalog element iced after its instance
has already disappeared. Catalog reconciliation intentionally does not rewrite
live runtime state. Before its catalog audit, the browser runner clears stale
icing only for a selected game whose authoritative `active_instance_ids` set
is empty, and records the cleanup in the report. It must never clear icing
while any instance is active.

Resume batches must not re-audit unrelated catalog rows or fail fast on the
first broken game. The snapshot-minigame runner audits only the selected IDs,
records per-row failures, rotates to fresh numeric actors after a failed row,
and completes the rest of the selected batch before returning a combined
failure report. Fix that report as one batch, then resume only its failed IDs.

Deathmatches with a one-kill limit can transition directly from the lethal
native damage event to `finished`, clearing transient `player_states` before a
browser poll observes the intermediate kill/death counters. Accept either the
counter state or the immediate finished state, record `finishedOnKill`, and do
not force a second finish tick after the match already ended.

The imported Deathmatch settings still issue legacy Bikkie weapons such as
Mega Axe while Harthmere players carry a migrated native-combat progression.
Do not interpret a rejected synthetic damage event as a broken match state or
retry all maps individually. The shared player-damage handler must treat a
native-catalogue item without a combat profile as non-combat, but derive a
legacy item's authoritative damage, reach, and interval from the selected ECS
item. Cover that compatibility boundary once in the Deathmatch integration
test, lower the browser fixture target to one HP, and run every failed map in
one resume batch. An immutable older image may use the runner's explicit
`HARTHMERE_MINIGAME_E2E_LEGACY_DEATHMATCH_IMAGE_WORKAROUND=1` unarmed shim to
prove round scoring/cleanup, but that evidence does not replace a browser run
against the rebuilt handler with the authored loadout still selected.

An auto-finished Deathmatch can clear `playing_minigame` before runner cleanup.
That does not mean the disposable actor is ready for reuse: always restore its
health, death marker, and iced state even when no explicit quit event is
needed. Otherwise the first two passes contaminate every later row in a batch.

If Sync disconnects before a Spleef quit, the participant may already be iced.
The quit handler's prepare query must include iced players just like its main
query; otherwise the event never reaches stash/clipboard restoration and the
arena remains locked for every later batch. Reproduce this with one iced-player
quit integration test, fix the shared query once, then resume all affected
arenas together. Do not manually unice production participants as the product
fix; unicing a disposable actor is only an old-image fixture recovery step.

Repeated Deathmatch deaths can also reopen the stock death modal before an old
render tree has fully settled. Key `DeathModal` by the authoritative game-modal
resource version so each death/revive lifecycle remounts its hook chain. A
React hook-dependency exception after otherwise green scoring is still a
browser failure; keep the completed gameplay rows, fix the shared modal, and
require one post-build repeated-death browser gate rather than replaying every
map.

Do not reuse an unfinished minigame instance whose authoritative
`active_players` map is empty. Interrupted batches can leave such a stale
`playing` instance behind; the first actor must create a fresh instance and the
second actor may then join that new instance.

Nonempty is not sufficient either: a retained participant can leave a stale
instance in `playing`. Reuse only an instance whose authoritative state is
`waiting_for_players`; never attach a resume actor to a playing round.

Before a selected resume batch, retire stale instances whose authoritative
`active_players` map is empty: mark the instance finished and remove its ID
from the parent minigame. This cleanup is safe only for zero-player instances;
never retire an instance that still has a participant.

#### Chapter 1 Elsewhen terrain preflight

The Chapter 1 quest and dungeon browser lanes require the 109 authored
Elsewhen terrain shards in Native ECS. Current production-shaped boots create
any missing Chapter 1 shard IDs even when broad Harthmere town terrain
generation is disabled; existing terrain is never overwritten.

For a warm stack created before that reconciliation was installed, inventory
the dedicated shard set without changing state:

```sh
GLITCH_REDIS_PORT=6493 CH1_SEED_TERRAIN_ONLY=1 \
  node scripts/harthmere/seed-chapter1-native-e2e.cjs
```

If the report shows missing rows, install the complete set once, in bounded
batches, while preserving the warm Redis snapshot:

```sh
GLITCH_REDIS_PORT=6493 APPLY=1 CH1_SEED_TERRAIN_ONLY=1 \
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

That warm-mount shortcut is valid only while the base image's launcher/scripts
remain compatible with the mounted outputs. On August 2, an old r3 image was
started with a newer `.next` and `dist` after the deployment also changed the
water/startup launcher path. Even with `GLITCH_POPULATE_SNAPSHOT_REDIS=0`, the
mixed stack entered authored-content synchronization, repopulated the
disposable Redis snapshot, and began another startup cycle. If the change set
touches Docker, startup scripts, reconciliation, Redis bootstrap, or service
topology, do not combine old image scripts with new bundles. Wait for the exact
candidate image and test it intact. Reserve warm mounts for client-only or
bundle-only fixes whose launcher compatibility has been explicitly proved.

The additive Harthmere extension is now default-on. Setting the retired
`BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=0` does not disable its startup sync and is
not a valid focused-test shortcut. For an explicitly Grove-only diagnostic,
use `BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET=1` (and the matching
`NEXT_PUBLIC_` switch when rebuilding the client). Record that topology in the
report: it can validate original-Grove quests such as Road Ahead, but it cannot
sign off Harthmere-town terrain, water, NPCs, or fishing. Prefer the full exact
image whenever its additive reconciliation is already materialized.

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

The runner derives Redis port `6493` before loading the Redis connection module
when the web base URL uses port `3017`. That is the current host-only
`biomes-prod-smoke-redis-forward` bridge; the retained Redis container itself
does not publish `6379` to the host. Confirm `redis-cli -h 127.0.0.1 -p 6493
PING` before a long campaign. Do not add another command-line Redis override to
every invocation; the module captures its port during import, so a late
override is ineffective. A report that fails this preflight has zero product
coverage and should not trigger an app rebuild.

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

The same rule applies to Web Audio. An embed may expose Pointer Lock and reject
every request, so `pointerlockchange` is not a reliable first audio gesture and
the five-second pointerless fallback is too late to satisfy browser autoplay
policy. The canvas click must call `audioManager.resumeAudio()` synchronously
before requesting Pointer Lock. In a captured HAR, require at least the
selected background-track request (or prove it was already decoded through
`audioDiagnostics.loadedTracks`); creature-idle `.webm` requests alone do not
prove background music started. For environmental priority, combat and authored
dungeon music override cave music, a minigame may suppress the cave replacement,
and cave music otherwise replaces the Muck exploration bed. Keep both the
`audio.test.ts` Muck-cave assertion and the `MobileGameplayControls.test.ts`
gesture-order assertion when changing this path.

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

For ordinary photo-flow coverage that is not changing keyboard input, the
visible `Exit Camera` button is acceptable no-pointer-lock cleanup. It must not
be used as evidence that the displayed `X` shortcut works. The August 2 Road
Ahead audit found the HUD rendering `X — Exit Camera` while the hotbar handler
accepted only `Delete`; the browser runner clicked the button and mislabeled
the scenario as an X pass. A camera-shortcut gate must focus
`canvas.biomes-canvas`, press physical `KeyX`, require the exit HUD to hide,
require authoritative camera mode to return to normal, and require selection
to leave the camera slot. Do not click the button in that scenario, do not
publish an exit event fallback, and do not waive the key because Pointer Lock
was released—the camera exit handler is deliberately a pointer-lock-independent
recovery path.

Keep camera-shortcut failures bounded and evidence-rich. Before pressing
`KeyX`, install capture- and bubble-phase observers; after the key, record the
active element, whether the event reached both phases, whether an earlier
handler called `preventDefault`, the live `/hotbar/selection` kind/ref/mode,
and whether `.camera-exit-button` is still visible. Fail within ten seconds
with that diagnostic. A two- or three-minute locator timeout proves only that
the button stayed visible and hides whether the key was swallowed, the HotBar
listener was absent, or the selection was no longer `camera`.

Do not put a replacement-HUD recovery key only in a legacy component. The
August 2 key probe showed `KeyX` reaching document capture and bubble with a
live camera selection, but `defaultPrevented` stayed false because `HotBar` is
not mounted when `replaceLegacyBiomesUI` is active. The listener must live in
`InGameCameraHUD`, the component that renders the Exit Camera control in both
HUD modes. Keep the old HotBar handler for legacy UI compatibility, but require
the camera-only selection guard in both places. `X` is now deliberately free
in ordinary gameplay; movement uses `E` for Dodge and `Q` for Evade. Do not
mistake the camera-only `KeyX` escape hatch for a general movement binding.

Treat `ReactResources.use(...)` as a render-only hook, not a convenient resource
getter. The next exact-image pass showed `KeyX` reaching the new HUD listener
and becoming `defaultPrevented`, yet `/hotbar/index` recorded zero writes. The
shared camera action called `reactResources.use("/scene/local_player")` from the
document key handler, so React aborted the action before selection changed. Any
helper callable from a key, click, timer, promise, or ECS callback must use
`reactResources.get(...)`; reserve `use(...)` for component/hook render bodies.
For camera regressions, trace `/hotbar/index` writes and inventory slot actions
in the same ten-second key diagnostic. A prevented event alone does not prove
the player-facing action completed.

Do not import a large component merely to unit-test one event action. Importing
`HotBar.tsx` in the bootstrap-free camera test pulled `NormalSlot`, inventory
icons, and `/public/hud/default-challenge-icon.png` into Node, failing before one
assertion ran. Extract event-safe behavior into a dependency-light module and
test that module directly; keep a static contract proving the component imports
it. Classify a missing static-image module during Mocha collection as a test
boundary error, not as a camera, inventory, or asset regression.

An authenticated `/at/x/y/z/...` tab is not a safe Grove-NPC observer. The
coordinate slug intentionally selects observer mode, while a retained player
cookie can still make the client believe that synchronized player is local;
Sync then removes it from the observer subscription and the client correctly
raises `Should never delete local player!`. Use `anon=1` for coordinate-only
NPC/terrain observation, or keep the authenticated player route slug-free and
move the player through the approved fixture path. Do not clear Redis, restart
the stack, or diagnose the NPC because an authenticated observer URL mixed two
incompatible identities. Also keep only one heavy game tab in the in-app
browser: parallel authenticated and observer WebGL clients can exhaust the
browser-control connection even while the app remains healthy.

Do not let a quest-step wait hide actor replacement for the full feature
timeout. The August 2 Road Ahead run had already proved Billy's real toolbag
and Pick transfer, then waited 180 seconds for `Return Billy's Pick`; the final
diagnostic showed that the actor no longer had the quest in `in_progress` or
`complete`, and its trigger roots were empty. Every authoritative quest-action
wait must treat that state as an immediate actor-continuity failure and report
the actor id, icing state, and trigger-root count. Preserve the last passed
checkpoint and resume there with a fresh actor. Do not replay earlier quest
stages, and do not misclassify the resulting timeout as a bad prompt, NPC, or
quest trigger until the actor row itself has been proven continuous.

For a claim immediately after a prop/container interaction, never treat a
fire-and-forget MoveEvent as proof that the player has returned to the NPC.
The August 2 focused Road Ahead resume moved the browser simulation to Billy's
toolbag, published a return MoveEvent, and immediately sent `Return Billy's
Pick`; Logic correctly rolled it back with `Talking distance is too large`
while the harness waited on trigger state. Before every
`CompleteQuestStepAtEntityEvent`, place the browser-owned `/sim/player`, publish
the matching MoveEvent, and wait until both authoritative ECS and the scene
player are within `gameMaxTalkDistance` of the exact claim entity. A rollback
log is a failed action, not a reason to keep polling for the success state.

Classify the local profile-picture fallback consistently for both response and
request-failure paths. The local stack has no production social bucket proxy,
so `GET /buckets/biomes-social/<id>/profile_pic/...` may either return 404 or be
aborted while React replaces the image with `avatar-placeholder`. Both are
expected transients when—and only when—the method is GET and the pathname
matches that exact profile-picture shape. Do not let an `ERR_ABORTED` avatar
request terminate a feature run after the equivalent 404 was already accepted;
all other same-origin failed requests remain fatal.

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

### 4.28 Prove melee at the authored contact frame, not at button-down or re-entry

Treat one melee swing as a bounded receipt shared by animation, Anima, and the
logic server. The receipt must identify one target, one attack start, one impact
time, one impact point, the strike volume, and the final hit/miss/cancel result.
Use the same `attackTime` for the public Attack emote and the damage event. A
pending wind-up must be cancelled when the target changes, leaves horizontal or
body-aware vertical reach, leaves facing, loses terrain line of sight, dies,
enters protection, or the attacker evades. Allow only a short coarse-tick grace
around impact; a swing that is seconds old must expire instead of landing when
the player later returns.

Commit the NPC's `npc_state` receipt before publishing its damage event. Running
state apply and event publish in one `Promise.allSettled` creates a real race:
the health handler can receive a legitimate hit while it still sees the prior
swing. Preserve independent failure attempts, but make event delivery wait for
all state chunks to settle. The server then validates target identity, swing
timestamp, impact point, result, freshness, replay, facing, horizontal reach,
body vertical gap, and the recorded line-of-sight decision before applying
damage. Test the ledge-overlap and through-floor cases separately; raising one
3D radius to make hills pass is not acceptable.

Player attacks follow the same presentation boundary. Start the body/weapon
animation immediately, resolve damage at that weapon class's authored impact
frame, and re-sample melee candidates at impact so a target that stepped out is
not hit from the button-down snapshot. Cover unarmed, one-handed melee, heavy,
tools, ranged, and magic timing. Cancelling or unselecting a weapon must clear
the pending impact timer. The native NPC renderer should use the raw ECS
position/orientation during the short attack window; ordinary 0.8-second network
interpolation can otherwise leave the visible creature behind the validated
hitbox even when authority is correct.

Creature animation acceptance has three layers:

- edit the tracked Blender source and merge the resulting action into the
  tracked GLTF; changing only one of those files leaves regeneration or runtime
  stale;
- statically require `Attack`, `HitReact`, and `Death` with nonzero channels and
  durations for every Hex, Mucker, cow, sheep, and rabbit rig, and record the
  livestock impact frame used by combat tuning;
- use Blender contact-frame renders only as authoring QA. The final evidence is
  the exact-current-source game renderer performing a real receipt-backed melee
  exchange with before/contact/after screenshots and authoritative health.

Do not run a Bikkie/ECS-importing combat file under the bootstrap-free
`t.sh file` lane and interpret missing item hardness, unknown NPC types, or
misclassified premium weapons as product failures. This exact mistake produces
`Uncached lookup by schema` warnings and can make unrelated terrain assertions
fail later in the same process. Pure geometry/timing/controller files belong in
the fast lane; native item catalogues, generated ECS events, and health handlers
belong in `scripts/harthmere/t.sh full` under the `.nvmrc` runtime.

Do not cold-start the complete additive-town Shim reconciliation merely to run
the focused hill-melee fixture. The production image's AMD64-emulated
`node --no-opt` process can remain CPU-bound after `Loaded WASM` for longer than
the 15-minute readiness contract while it builds thousands of unrelated horizon
shards. Reuse the populated warm Redis snapshot, set the explicit additive-town
rollback flag only on the disposable focused web/Anima test topology, and let
the E2E create its deterministic floor, ledge, crest, and NPC rows through the
signed admin ECS path. This is a fixture-lane optimization, not production
terrain acceptance. A 337k-entity local Anima scan can also take more than the
old hardcoded 75-second hill-combat ceiling under emulation; set
`HARTHMERE_E2E_HILL_COMBAT_TIMEOUT_MS` for the bounded functional run while
leaving every acquisition, range, line-of-sight, animation, and HP predicate
unchanged. Never enable performance assertions for that extended functional
rerun.

### 4.29 Low-FPS projectile and giant-audio evidence must follow presentation, not requests

A `200` or `304` for a projectile GLB or sound file proves only that the client
requested an asset. It does not prove that the player saw or heard the attack.
The August 2 Helix capture loaded Fireball, Life Drain, Helix Projector Beam,
Entangling Roots, and `giant_boss_stomp.webm` successfully while the user still
reported missing projectiles and footsteps. Correlate HAR timestamps with the
public ranged cast, renderer counters, authoritative HP change, and an actual
captured frame or audible playback profile.

Do not use the renderer's capped particle delta as the authoritative projectile
clock. At 1 FPS, adding only 50 ms to a one-second projectile per rendered frame
puts visible contact roughly twenty seconds behind Anima damage. Advance charge,
projectile, and attack-shape lifecycle progress with wall time; retain the small
delta only for mixers, trails, and particle integration. When a synchronized
release arrives late, calculate the remaining interval from
`releaseTime + impactDelay - now`. If impact already happened, resolve the
travel/shape immediately into a persistent impact effect instead of replaying a
fresh full-duration projectile after health changed. Keep a direct runtime test
that advances a hostile projectile by one one-second frame; event/asset tests do
not cover this failure.

Generated Harthmere audio paths bypass Galois `AudioAssetType`, including the
normal `footsteps` volume multiplier. The generic `playPathAt` defaults
(`refDistance = 2`, ordinary effects gain) can therefore make a full-scale boss
stomp nearly inaudible at 15–25 metres even when the clip itself peaks at 0 dB.
Pass an explicit giant profile with a boss-sized reference distance, bounded
volume boost, arena-scale maximum distance, and gentler rolloff. Test the
profile and the calling path; do not regenerate a louder clip to compensate for
incorrect spatial attenuation.

For sub-second visual effects, do not measure lifetime solely by counting
`requestAnimationFrame` callbacks in a browser-control tab. A visible automation
tab can still deliver rAF at roughly 1 Hz, which made the correct wall-clock
0.2-second melee spark appear to measure 0.985 seconds in the first August 7
boss-audio harness row. Drive the production effect's own wall-time `tick()`
with a short timer for the duration assertion, preserve a rendered peak frame,
and separately report the page's rAF cadence when frame delivery itself is the
question. The corrected live row measured 0.209 seconds with no text.

Finally, “the boss has five attacks” needs two different gates. Parse the real
GLB and require the body clip for all five catalog entries, then run one
selection encounter that opens authored range and health phases and observes
all five ability IDs in order. A catalog-length assertion alone does not prove
that round-robin selection can reach the close-range move or the low-health
finisher. Conversely, a short full-health long-range browser fight is not
evidence that those phase-gated moves are missing.

### 4.30 A staged NPC is one presentation contract, not only a moved mesh

Chapter One NPC positions are per-player projections over shared ECS entities.
Testing only the renderer override can leave four contradictory truths in one
client: the body at the quest location, the nameplate at the shared spawn, the
nearby `F — Talk` selector at the shared spawn, and the objective marker at a
static cast placement. The August 2 Jackie report exposed that split: the
Chapter One state correctly projected canonical Jackie to the road-house while
the shared starter body remained the input to overlay and proximity scans. A
player could therefore see a name without the expected body, interact with the
wrong location, or interpret the two positions as two Jackies.

Route every NPC presentation consumer through one resolver: renderer body,
nameplate, cursor/proximity Talk, combat/interaction registry, cutscene binding,
and objective target. Merge exact canonical entities into spatial scans when a
projection moves them into range, remove the old shared position from that
player's candidate set, and honor `hidden` for intentionally absent/ending
states. Before Chapter One, the shared original Jackie remains visible and
talkable for Road Ahead; after the chapter starts, the same entity id appears
exactly once at the current staged location. Never delete or globally move the
shared body to solve a per-player story transition.

The projected body can be inside the player's view while the shared ECS body
is outside Sync's local subscription. A renderer ghost alone is insufficient:
the nearby-Talk scan then has no entity to classify and the player sees Jackie
without an `F Talk` prompt. OOB-fetch only the explicit positive projected ids,
cache their canonical read-only entity for the overlay scan, and mark that
overlay as projected-talkable. Do not broaden the subscription or invent a
second NPC. Live acceptance must exercise Talk at a stage far enough from the
shared post to cross this boundary.

**Special `F Talk` rule for projected bodies:** a positive-id projection ghost
is not an ECS raycast target. The cursor therefore commonly reports the terrain
immediately behind the visible body, and the ordinary terrain-hit branch stops
generic nearby-NPC fallbacks by design. Recover `F Talk` only after the normal
authored-object selector fails, only for an explicit non-hidden projected NPC,
and only when that projected position is within the terrain hit's bounded
inspection depth. Keep the normal facing/radius score and return the canonical
entity id with `projectedTalkable`; never let every nearby NPC leak a prompt
through walls or aimed terrain. Unit-test projected/non-projected and in-depth/
behind-depth cases, then live-test the same visible body, canonical id, and one
`F Talk` overlay together. A screenshot of the nameplate is not sufficient.

Also keep the disposable audit actors unique and clean them up or use a new
username after an interrupted run. A prior browser actor left standing at the
same projection post can legitimately win the direct player ray and show
`F View Profile` instead of Jackie's prompt. That is fixture contamination, not
permission to weaken player-overlay priority. The matrix must diagnose the
current cursor target and projected record together so a stale actor cannot be
misreported as another NPC projection failure. For known disposable actors,
pass their numeric ids through
`HARTHMERE_E2E_CHAPTER_1_NPC_CLEANUP_PLAYER_IDS=<id,id>`; the runner deletes
only those explicit rows after the new authenticated actor is ready and rejects
an attempt to delete the active actor. Never scan-and-delete ordinary players.

Reuse a known audit username when its generated player mesh is already warm.
On August 2, four uncached `/api/assets/player_mesh.glb` requests each took
roughly 93–99 seconds in the emulated exact-image stack. Client context and Sync
were healthy, but the full-screen loading wrapper correctly remained while the
meshes were computing and outlived the 120-second browser gate. Creating a new
username for the retry repeated the same delay with a new appearance. Preserve
the failed report, let the exact app finish and cache the requested meshes, then
rerun the affected slice with the same known actor. Do not remove the loading-
wrapper gate, increase every timeout, or treat client-context readiness alone as
gameplay readiness.

The same rule applies to returning characters. Sergeant Holt's canonical body
belongs at Harthmere's North Gate for players who are not giving the Chapter
One statement. Globally moving that ECS entity to the Grove watch house fixes
one scene by breaking every North Gate quest. Keep the shared body at its
authored post and project the same canonical id to the watch house only for the
player whose active step is `report_or_not`; the projected body, label, Talk
selector, dialogue-expression identity and objective target must all move
together. Jackie is held on Teak's evidence whether the player reports her or
withholds the accusation, so `jackieExpelled` and the live statement step—not
only `jackieReported`—own her watch-house staging.

The exhaustive fast test must replay accumulated authored flags in quest order.
Checking every late objective with only `ch1_started` creates impossible states
and correctly reports actors such as Lou absent. For each real objective state,
require every cast-targeted objective to point at the staged body, every present
cast id to yield one presentation, and every absent cast id to yield zero.

Visual fallback is part of the same contract. A successful GLB request proves
neither that a body entered the correct render pass nor that an
off-subscription puppet retained the intended character. Preserve archived
snapshot assets for promoted actors such as Jackie, native robot/animal models
for AUGUR-9 and Marrow, and deterministic role-authored clothing for seeded
player-like humans. Do not let numeric-id random fallback assign novelty hats
or unrelated costumes to serious story cast. Live acceptance should capture
one serial screenshot per distinct authored stage, count the canonical id once,
confirm the Talk prompt at the visible body, and review body, hair, clothing,
scale, lighting, and ground contact—not merely the floating label or HTTP 200.
Use the source-backed `chapter1NpcAuditCatalog` / `chapter1PrepareNpcAudit`
bridge matrix for that final pass. It enumerates legacy Road Ahead Jackie, each
distinct Chapter One stage and ending absence, all thirteen canonical cast
members, returning Holt, twelve testimony witnesses, six suppliers, and the
remaining named quest givers. Do not hand-author a partial flag set in the
browser or run one new Chromium process per NPC.

Run that matrix in one authenticated browser process with
`HARTHMERE_E2E_CHAPTER_1_NPC_AUDIT_ONLY=1`. The runner uses the production
projection bridge, moves one disposable player through every authored stage,
requires one record per canonical id, proves ending absences, binds the nearby
Talk target to that same id, opens starter Jackie's real Road Ahead dialogue,
and writes serial screenshots for every stage and shared quest NPC. Do not
replace this with a label-only DOM loop or a separate browser per character.
If infrastructure or the runner fails after a screenshot-backed stage has
passed, set `HARTHMERE_E2E_CHAPTER_1_NPC_RESUME_AFTER=<scenario-id>` and resume
at the next source-catalog row. The runner validates the checkpoint against the
catalog before skipping anything; never hand-edit the remaining stage list.

When a focused Road Ahead run finishes the last quest transition, React can
unmount the quest tracker while its hashed `quest-main.*.png` icon request is
still in flight. Chromium reports that one same-origin image as
`net::ERR_ABORTED`; record it as teardown/transient only in robot-story mode.
Do not broadly ignore `/_next/static` failures: script chunks, styles, other
media, non-aborted responses, and the same icon outside this unmount boundary
remain failures.

### 4.31 A giant combat hitbox is not a viable hill-walking body

Keep an oversized boss's authored ECS `size` as the authority for rendering,
combat reach, projectiles, targeting, and damage. Do not also use the entire
six-to-fifty-eight-metre box as its terrain-walking body. On uneven ground, one
raised voxel beneath a tail, wing, or distant limb makes that full AABB already
intersect terrain; physics enters escape mode before forward movement, the
rigid-body velocity remains near zero, and the renderer correctly—but
misleadingly—selects Idle even though Anima is trying to chase.

Derive a bounded central locomotion core for oversized walking NPCs. Preserve
full height, keep at least a one-metre footprint, cap the horizontal core so it
still collides with walls, and allow at most a two-block cardinal hill step for
truly giant bodies. Ordinary creatures retain the one-block profile. The A*
graph and the physics climb probe must use the same maximum step height;
changing only one side creates routes the body cannot execute or body movement
the planner never requests. Synthetic acceptance must prove a Helix-sized body
crosses a two-block rolling hill and remains stopped by a taller cliff.

Orientation is a separate persisted-data invariant. Repair every non-finite
pitch/yaw before behavior runs, reject malformed rotate targets and timing
inputs, and make `SimulatedNpc.setOrientation` a final finite write boundary.
Flying/swimming NPCs should derive facing from the newly integrated velocity
only when that vector is finite and nonzero. HFC quarantine is still required
for rolling-revision safety, but a green product gate must prove Anima no longer
creates the malformed component in the first place.

Finally, test the actual animation decision, not only that a GLB contains
`Walk`. Uphill collision conversion can produce a finite horizontal speed below
the player animation system's historical 0.5 m/s idle threshold. NPC rendering
uses its existing 0.06 m/s anti-jitter deadzone as the locomotion threshold, so
slow uphill progress selects and advances Walk while stationary bodies remain
Idle. Run the focused source lane before any image build:

```bash
./b test -b \
  src/shared/npc/test/ground_locomotion.test.ts \
  src/shared/npc/test/motion_safety.test.ts \
  src/shared/npc/test/simulated_combat_state.test.ts \
  src/shared/npc/behavior/test/pathfinding_geometry.test.ts \
  src/shared/physics/movement.test.ts \
  src/server/anima/test/shared_behavior_contracts.test.ts \
  src/client/game/util/test/animations_locomotion.test.ts \
  --timeout 30000
```

The exact-image browser gate must then observe one real oversized boss move
across authored uneven terrain, report finite ECS orientation/position/velocity,
select Walk or Run while displacement is increasing, remain blocked by the
cliff fixture, and retain the full combat-sized hit volume. A static Blender
walk render or a source-only velocity assertion does not satisfy that gate.

Do **not** cold-start that full hill-combat browser gate on the 16.56 GiB
Docker VM with a private 335k-world Redis, the unified Web/Logic/Sync/Bikkie
stack, Anima, and Chromium all resident. The August 2 exact-image attempt was
fully lifecycle-ready with `RestartCount=0` and `OOMKilled=false`, and Anima
completed its 305,906-entity scan, but Redis was OOM-killed immediately after
the browser created the deterministic hill fixtures. Disabling unrelated
stream workers and lowering Web/Anima heaps did not create enough safe
headroom; lowering the shared service heap far enough to fit instead put Logic
into sustained garbage-collection thrash during its snapshot bootstrap.

On that host, stop after the already-green focused movement/combat contracts
and exact-source renderer captures, record the exact-image browser gate as
resource-constrained rather than failed, and do not rerun passed suites while
tuning containers. Run the remaining integrated gate only against an
already-warm shared world that does not require another Redis copy, or on a
larger Docker host. Any run in which Redis or the app is OOM-killed is invalid
environment evidence even if screenshots or partial ECS assertions were
produced before the kill.

### 4.32 Read a production capture from the cvals, not from the FPS overlay

Recorded 2026-08-03, from a 374-second `www.glitch.fun` HAR + console capture.

A HAR is 63 MB of mostly base64 and the console is mostly third-party noise. The
three signals that were actually worth extracting, in order of value:

**1. `POST /api/cval_logging` is the whole client state in one request.** Its
body carries the table sizes, the event tally, the GPU classification and the
memory counters. It answered more questions than the rest of the capture
combined:

```text
"events": { "moveEvent": 6369, "emoteEvent": 21, "updatePlayerHealthEvent": 2 }
"indexes": { "position_selector": 2932, "collideable_selector": 1217,
             "label_selector": 834, "placeable_selector": 548,
             "npc_metadata_selector": 159 }
"capabilities": { "gpu": { "fps": 556, "gpu": "apple m1 max", "tier": 3 } }
```

An **absent** event name is evidence. `updateNpcHealthEvent` never appearing next
to 21 `emoteEvent`s is a complete proof that melee never acquired a target — far
stronger than any number of screenshots of a creature not taking damage.

**2. Request cadence tells you what is polling you to death.** Group by URL and
take the median inter-arrival gap rather than the count:

```text
chapter1_gate      n=126  medgap 0.78 s   medtime  92 ms
chapter1_progress  n=105  medgap 1.03 s   medtime  98 ms
chapter1_story     n=66   medgap 2.00 s   medtime  98 ms
voicePoll          n=159  medgap 1.93 s   medtime 1528 ms  ← near-continuous in flight
```

**3. The console violation _pattern_, not its text.** Chrome elides the duration
(`took <N>ms`), so an individual line says nothing. A continuous unbroken run of
`'requestAnimationFrame' handler took <N>ms` means the frame loop never
recovered; a burst of `'message' handler took <N>ms` means worker traffic
(terrain meshing) is landing on the main thread.

Two traps this capture set:

- **The HAR was truncated mid-entry.** `json.load` fails on the whole file. Scan
  top-level `entries[]` objects with a brace/string-state counter and parse them
  individually, keeping the ones that succeed — 974 usable entries out of a file
  that would not load at all otherwise.
- **A tier-3 GPU classification is not an all-clear.** This session was correctly
  detected as an M1 Max at tier 3 and still ran at 2–14 FPS. Confirming the GPU
  tier only rules the tier out; it does not make the problem GPU-shaped. Prefer
  `renderIntervalMs` vs `cpuTimeMs` for that question.

---

## 5. Suggested loop

```
edit ──► t.sh watch <preset>        (~1 s, continuous)
     └─► t.sh gate                  (batched changed-surface handoff)
     └─► t.sh full                  (minutes, before a PR)
     └─► refresh-warm-local-stack   (replace app, retain Redis world)
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
| `scripts/glitch/refresh-warm-local-stack.cjs`          | Replace app artifacts while retaining one Redis      |
| `scripts/glitch/test-refresh-warm-local-stack.cjs`     | No-reseed/no-flush warm-refresh contract             |
| `scripts/harthmere/seed-get-muck-out-browser-step.cjs` | Focus Get the Muck Out recipe/hunt steps             |
| `tsconfig.ch1check.json`                               | Fast scoped typecheck (~3 s)                         |
| `tsconfig.biblecheck.json`                             | Bible catalog typecheck (~13-15 s)                   |
| `scripts/harthmere/seed-bible-quest-step.cjs`          | Jump to any Bible objective, grounded coords         |
| `docs/harthmere/BIBLE_TO_CH1_MIGRATION.md`             | Why the Bible catalog is shaped like Chapter 1       |
| `tsconfig.ch1renderer.json`                            | Client-graph typecheck (slow, incremental)           |
| `NATIVE_ECS_BROWSER_E2E_RUNBOOK.md`                    | The release gate (unchanged)                         |
| `CHAPTER_1_E2E_RUNBOOK.md`                             | Chapter 1 browser checklist                          |
| `HARTHMERE_RENDER_PERF_AUDIT_2026-08-03.md`            | Ranked render/runtime findings + remediation log     |
| `docs/harthmere/PERFORMANCE_AND_PLACEMENT.md`          | Production FPS baselines and frame-loop guardrails   |

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
tells the player exactly where to go without a mechanical `Next task:` prefix.
Generate this from the authoritative quest catalog/route state rather than
hand-copying dozens of lines; ordered
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

## Fork platform-upgrade fast lanes — 2026-08-01

These lanes validate the production fork's Node 24/uWebSockets, TypeScript 6,
Bazel 9, Emscripten 6, gltfpack/KTX2, WebGPU probe, and Redis 8.8.1 boundaries
without starting the full browser catalog after every edit.

### Node 24 test and zRPC boundary

Use the repository launchers for TypeScript tests. On Node 22+ they pass
`--no-experimental-strip-types`, keeping `ts-node`, `tsconfig-paths`, and the
configured CommonJS transform authoritative instead of letting Node 24 consume
test files before the `@/` alias hook runs. The fast launcher omits that unknown
flag on a transitional Node 20 developer shell; the production build and final
platform gate still use the repository's Node 24 pin.

`uWebSockets.js` must remain on the pinned Node-24-capable release. Verify the
native ABI and all three zRPC transports after changing Node or the addon:

```bash
node -e 'const u=require("uWebSockets.js"); console.log(process.versions.modules, typeof u.App)'
./b test -p 'src/server/shared/zrpc/test/zrpc.test.ts' \
  --grep 'Can handle a simple RPC'
```

Run `scripts/harthmere/t.sh full` under the exact `.nvmrc` runtime. On August 2,
a production Next build refreshed `node_modules`, then a Node 20 shell launched
the broad suite. `uWebSockets.js` rejected ABI 115 before Mocha ran one test,
even though the client build and focused tests were healthy. The launcher now
selects `$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin` for `full` before it sets
Node options or imports the native zRPC server. Treat an ABI-load exception as
a test-runtime failure with zero suite coverage; do not rebuild the product or
debug the feature. Focused presets remain usable on transitional Node 20 when
they do not import that native server boundary.

### Redis 8.8.1 is the exact server target

Production game-world Redis is the private `biomes-redis-prod` VM on Redis
8.8.1. Local tests must use that exact patch; Homebrew Redis 7 or Ubuntu's
default package is not an equivalent gate. The production VM remains RDB-only,
12 GB/noeviction, and private to the application subnet. Local containers are
disposable and intentionally do not copy those persistence/network settings.

Start one isolated server and reuse it for both protocol passes:

```bash
docker run --rm -d --name biomes-redis88-upgrade-test \
  -p 127.0.0.1:6388:6379 \
  redis:8.8.1-alpine redis-server --save '' --appendonly no

REDIS_TESTS=1 REDIS_TESTS_PORT=6388 \
  ./b test -b -p \
  'src/**/{world,firehose,chat,discovery,distributed_notifier,election,pubsub}/{/test/*.ts,/*.test.ts}' \
  --timeout 15000

BIOMES_REDIS_PROTOCOL=2 REDIS_TESTS=1 REDIS_TESTS_PORT=6388 \
  ./b test -b -p \
  'src/**/{world,firehose,chat,discovery,distributed_notifier,election,pubsub}/{/test/*.ts,/*.test.ts}' \
  --timeout 15000
```

RESP3 is the normal ioredis 6 path. RESP2 is an incident rollback, not the
default. A failure in either lane is an upgrade defect; do not weaken Lua,
stream, HFC, or persistence assertions to make it green.

The August 2 upgrade rehearsal exposed a persisted-data edge case that belongs
in this lane. The legacy `Chirp` NPC biscuit encodes
`oscillate: { periodSeconds: 0, strength: 0 }`; treating that as a normal period
used to evaluate `sin(Infinity) * 0`, publish a `NaN` Y position through HFC,
and terminate Sync, Web, Logic, Anima, and Gaia when current Zod decoded it.
Zero/non-finite oscillator inputs now mean disabled, and HFC independently
quarantines malformed components on writes, bootstrap reads, and live pub/sub
from an older rolling-revision writer. Keep both focused gates:

```bash
scripts/harthmere/t.sh file src/shared/npc/behavior/test/fly.test.ts

REDIS_TESTS=1 REDIS_TESTS_PORT=6388 \
  ./b test -b -p 'src/server/shared/world/hfc/test/hfc.test.ts' \
  --timeout 15000
```

The HFC test intentionally preserves valid sibling components when it drops a
bad position. A green test must not be obtained by discarding the whole entity
update or by allowing a decode exception to stop the subscription.

Static deployment guards:

```bash
node scripts/glitch/test-production-redis8-stream-compat.cjs .
node scripts/glitch/test-production-deploy-local-redis-smoke.cjs .
```

### WASM, ECS, Anima, and Gaia

Run these in order so a generated-WASM failure is isolated before the larger
server suites:

```bash
bazelisk build //src:all_ts_deps --ui_event_filters=-debug
./b --no-check-ts-deps ts-deps build
./b test -p 'src/shared/wasm/test/*.test.ts'
bazelisk test //voxeloo/... //ecs:ecs_ast_test //ecs:ts_test \
  --test_output=errors --ui_event_filters=-debug
./b test -p '{src/server/gaia/**/*.test.ts,src/server/anima/**/*.test.ts}' \
  --timeout 10000
```

ECS, Anima, and Gaia do not have a separate package version. Their upgrade gate
is compatibility of generated component IDs, wire formats, regular/HFC writes,
sharding, terrain buffers, `npc_state`, and persisted data.

### gltfpack, KTX2, and Three assets

```bash
npm run assets:install-gltfpack
npm run assets:sync-three-transcoders
./b galois test-python
./b test -b -p 'src/client/game/util/test/three_asset_contract.test.ts' \
  --timeout 30000
```

The native gltfpack test must prove `EXT_meshopt_compression`,
`KHR_texture_basisu`, and an embedded `image/ktx2`. The npm/WebAssembly
gltfpack executable is not a valid KTX2 test because it is compiled without
BasisU.

### WebGPU without replacing WebGL2

```bash
./b test -b -p 'src/client/renderer/webgpu_probe.test.ts'
```

For a browser capability smoke, add `webgpuProbe=1` to the local game URL and
inspect `game:capabilities:webgpu`. `smoke-passed` proves Three initialized an
actual WebGPU backend and rendered a tiny stock-material scene. It does not
prove the custom Biomes raw-GLSL/MRT pipeline is WebGPU-compatible; production
game rendering must remain WebGL2 until that full port is separately tested.

### Consolidated platform gate

After focused lanes are green, run one TypeScript check and one set of builds:

```bash
NODE_OPTIONS=--max-old-space-size=6144 \
  node_modules/.bin/tsc -p tsconfig.json --pretty false

BIOMES_BUILD_ID=platform-upgrade-validation-YYYYMMDD \
  NEXT_TELEMETRY_DISABLED=1 ./b build next
BIOMES_BUILD_ID=platform-upgrade-validation-YYYYMMDD ./b build server

scripts/harthmere/t.sh full
```

The concrete local build id keeps Next and server Webpack on the same artifact
identity even when the workspace starts without `.next/BUILD_ID`. The full
suite is the final non-browser gate; focused lanes do not replace it.

### One immutable candidate for smoke and any later deployment

The production smoke artifact and the eventual deploy artifact must be the
same Docker image ID. Build once only after source, generated assets, `.next`,
and `dist` are final:

```bash
TAG=platform-upgrade-validation-YYYYMMDD-r1
scripts/glitch/deploy-production-local-redis-smoke.sh \
  --local-smoke --keep-local --tag "$TAG"

docker image inspect "biomes-node:local-$TAG" --format '{{.Id}}'
docker image inspect "glitchgames.azurecr.io/biomes-node:$TAG" --format '{{.Id}}'
docker inspect biomes-prod-smoke-app --format '{{.Image}}'
```

All three IDs must match. Run Chapter One and WebGL/WebGPU checks against the
still-running `biomes-prod-smoke-app` container. If a test fails, the candidate
is rejected: fix the source, create a new tag, rebuild once, and repeat. Never
repair a failed image in place or reuse its immutable tag.

If production deployment is later and separately authorized, reuse the tested
local image without rebuilding:

```bash
scripts/glitch/deploy-production-local-redis-smoke.sh \
  --skip-build --push --tag "$TAG"
```

Before that command, re-check that both local tags still resolve to the
recorded image ID. A source rebuild between smoke and push invalidates the
candidate even if the textual tag is unchanged. Running the local command
without `--push` never creates an Azure revision or changes traffic.

Do not rebuild Next, Webpack, Docker, or generated WASM concurrently. Reuse one
warm lane, then run Chapter One browser tests serially. None of these local
commands authorizes an Azure revision, Redis change, restart, image push, or
production deployment.

## Harthmere town repair: persisted-world gate before Chromium

The August 2 Harthmere HAR investigation showed that a visually black or empty
district is not automatically a missing surface shard. The Player Services and
Copper Kettle capture had a fully solid Y=52 surface; the defect was authored
content: district-sized single-material stone rectangles, flat colored-wool
roofs, and ten random persisted `Local Dev Townsperson` rows. Do not infer a
missing shard merely because `/sync/oob` did not include that Y band—the initial
terrain may have arrived over live sync.

After preserve-overlays terrain maintenance and content reconciliation, run the
read-only town repair audit before opening Chromium:

```bash
REDIS_HOST=<isolated-redis-container> REDIS_PORT=6379 \
  node scripts/harthmere/audit-harthmere-town-repair.cjs
```

Require `HARTHMERE_TOWN_REPAIR_READY`. The helper verifies all of these against
persisted tensors/entities:

- Player Services/Copper Kettle has open grass courts and at least five surface
  materials rather than one dominant stone slab.
- The Brass Scale Bank, Black Anvil Smithy, Copper Kettle Inn, and Mail Post
  House have stepped shingle/thatch roofs and no old colored-wool roof blocks.
- The canonical Brell source voxel at `[2214, 51, -174]` is still water level
  `15`.
- The ten production-audited generic townsperson IDs and the old persistent
  business-customer band are absent; customer-only patrons remain session-only.
- A complete Redis scan finds no `Local Dev Townsperson` or
  `Local Dev Walking Townsperson` fallback labels.

The production reconciliation now runs
`repair-harthmere-town-production.cjs` on every deployment, including ordinary
`additive` deployments. This is required because additive terrain maintenance
does not rewrite existing persisted shard seeds. The targeted repair restores
the complete canonical seed for only the 14 affected town shards, applies the
reviewed surface/roof overrides, preserves mutable overlays, and retires only
the audited generic/customer IDs. Its fatal audit runs after every downstream
terrain writer. The deployment town gate sets
`HARTHMERE_TOWN_REPAIR_SKIP_WATER=1` because authored water has a separate
deployment gate; manual full-world audits should continue to check water.
Even the targeted-terrain deployment path that skips broad outpost/ECS work
runs this repair in `HARTHMERE_TOWN_REPAIR_ONLY=1` mode before promotion.

Run the helper again after Gaia has started and settled. A pre-Gaia `15` is not
enough if simulation later zeroes `shard_water`. Then use one anonymous,
low-memory in-app-browser observer for the final visual gate: town HAR
coordinates first, the Brell second, and no other heavy game tab.

Do not start one production-shaped Redis/app pair per task on a 16 GiB Docker
VM. Each restored Redis used roughly 2–3 GiB before application hydration; four
simultaneous lanes exceeded the VM and OOM-killed an otherwise unrelated Redis.
Serialize heavy lanes, retain stopped containers/RDBs between turns, and reject
all evidence collected after any app or Redis restart. A literal `PONG`, exact
DB size/hash, `RestartCount=0`, and `OOMKilled=false` belong in the same accepted
lifecycle record.

## Creature grounding must respect authored encounter volumes

The August 2 consolidated rollout reached the final creature-grounding pass and
then rejected 64 valid encounters: four remote-corner apex bosses and all 60
cavern Indisworms. The generic repair projected every non-town creature onto a
colliding outdoor surface. That rule cannot validate an underground authored
cave position, and the remote production spawn points can be outside the
terrain-shard domain scanned by the repair.

`reconcile-production-live-creature-grounding.cjs` now treats these two classes
as authored encounter positions. Cavern creatures must remain inside their
declared cave bounds; remote-corner bosses must remain at their audited apex
spawn. Their position, respawn anchor, health, size, and expiry state are still
repaired and read back, but they are not required to pass the town/open-surface
footprint probe. Ordinary Muckers, Hexes, wildlife, livestock, and bandits keep
the full terrain-support check.

Do not promote by treating canonical position and size as sufficient creature
evidence. In the August 2 r2 follow-up, all cavern rows remained at the correct
authored coordinates and human-sized dimensions, but the skipped final repair
left 17 production creatures at zero health with `expires` set. Those rows are
correctly absent from the rendered world. Before visual inspection, run the
reconciler once with `APPLY=0` and require all of the following:

- `repairPlanned: 0`;
- `repairPlannedByFamily.cavernIndisworms: 0`;
- `unresolvedAfterReadback: 0`;
- `unresolvedByFamily.cavernIndisworms: 0`.

If the only reasons are `dead_or_missing_health` or `live_entity_expiring`, run
the exact released reconciler with `APPLY=1`, require a clean `APPLY=0`
readback, and checkpoint Redis before opening the single browser observer. A
valid ECS position for a dead/expiring NPC is persistence evidence, not visual
evidence.

For an isolated cloned snapshot that intentionally lacks unrelated authored
terrain, scope the repair/readback to known entity IDs instead of weakening the
terrain-support rules or fabricating terrain for other families:

```sh
HARTHMERE_CREATURE_GROUNDING_SEED_IDS=8810000000019461,8810000000019464,8810000000021021,8810000000021022 \
APPLY=1 node scripts/harthmere/reconcile-production-live-creature-grounding.cjs
```

Repeat with `APPLY=0` and require both repair and unresolved counts to be zero.
The filter is opt-in and must never be set for the production all-family gate.

## Combat HARs: measure decisions, not request volume

The August 2 fight captures showed why a combat complaint cannot be closed by
proving that attack assets loaded or that a cooldown exists. The useful evidence
was the timestamped combat state embedded in the save traffic: basic attacks
were reaching impact in roughly 220 ms, the mouse path applied damage on
button-down while the keyed path waited for a timer, and a struck NPC could run
an immediate counterattack in the same call stack before its real-time AI ever
entered `windup`. That combination made correct contact validation still feel
unfair and unskilled.

Use the deliberate-combat contract when auditing or changing attacks:

1. assert one shared `windup -> impact -> recovery` timeline for body, weapon,
   damage, movement commitment, cooldown, and debug telemetry;
2. use fake timers to prove HP/events do not change one millisecond before the
   impact frame;
3. re-sample target position, range, facing, height, and line of sight at impact
   rather than treating button-down aim as a hit reservation;
   lock directional-melee yaw at windup, reject a player who moves behind that
   cone, and reject feet-level melee against a player standing on the attacker's
   upper body/back even when a giant full-body AABB overlaps them;
4. prove an enemy retaliation enters the AI brain and completes a visible
   windup; never keep a same-frame counterattack shortcut beside the state
   machine;
5. test special-movement costs against the existing survival stamina bar;
   dodge, evade, and double jump subtract immediate extra stamina, while the
   bar keeps its ordinary active-play decline and never regenerates with time;
   ordinary attacks add no stamina cost, and food remains the living-player
   replenishment path;
6. preserve distinct weapon identity: light, heavy, ranged, and magic attacks
   must differ in windup, recovery, movement reduction, and resource cost—not
   only damage;
7. for bosses and Indisworms, assert both the individual attack telegraph and
   the full cadence/recovery opening. A long cooldown does not repair a strike
   whose tell is too short.

Do not infer combat cadence from repeated audio/GLB requests. Browsers normally
cache those assets, so a HAR may show only the first load even when several
attacks occurred. Likewise, `live_mode_player_status_state` can be a delayed
projection; if it reports `staminaPersisted=false`, use the ECS TriggerState and
the accepted server transaction as stamina evidence. Never conclude that
stamina was spent merely because the visible bar happened to remain constant.

For this class of change, run the timing/profile tests and only the specific
server attack cases that failed. Do not repeat an already-green image or full
world suite. Browser acceptance still needs one real fight capture showing the
tell, a successful timed evade, a whiff after the target leaves the active
frame, and a punishable recovery. If the 16 GiB Docker host cannot hold the
required exact-image world without an OOM/restart, record that resource limit,
retain the source/unit/type evidence, and do not manufacture acceptance by
starting another full Redis/app lane.

For native player-attack acceptance, do not place the test player at the
canonical Grove start near `[484.25, 53, -207.51]`: that location is protected,
so server authority correctly suppresses damage even when the browser attack
input reaches the native ECS path. Derive the combat fixture from a
exact-world fixture already used by the native round-trip harness rather than
guessing an arbitrary coordinate. During the August 3, 2026 acceptance run,
both the nominal hill point `[895, 62, -197]` and a live-entity seed near
`[233.259, 30, -515.621]` rendered with the camera inside occluding snapshot
terrain. The exact-world basic gathering-node fixture at `[2103, 53, -270]`,
with the target at `[2105, 53, -270]`, was open and produced authoritative
damage. Reload the client so its simulation starts at the authoritative fixture
position, verify that the HUD does not show `Protected Area`, and capture the
rendered view before attacking. An injected `UpdateNpcHealthEvent` proves only
the health handler; it does not prove the keyboard or HUD attack path. Browser
acceptance must originate from a real rendered key/button action and must
observe the target's authoritative ECS health decrease. Record the selected
native item before interpreting the HAR: `muckBusterRedux` is a placeable
muck-clearing tool, so its `place_object` request is expected and is not a
failed weapon event. Select a real native weapon before the attack action.
The direct-ray baseline still places the target on the actual camera ray and
confirms the crosshair has entered its attack state before input. It is not the
complete melee gate: a second row must move the reticle deliberately outside
the target while keeping the rendered hand/weapon path across the target's
visible body. That row passes only when the native ECS HP decreases and the
client publishes exactly one `updateNpcHealthEvent`. Biomes yaw `0` faces
negative Z, yaw `Math.PI / 2` faces negative X, and yaw `-Math.PI / 2` faces
positive X. Verify target geometry before blaming the health handler. Reuse an
already-owned warm lane, wait for any coordinated
artifact refresh to finish, and require the expected build ID, lifecycle
readiness, literal Redis `PONG`, the E2E jump-control readiness marker, and zero
container restarts/OOM kills. If a refreshed production-style `.next` artifact
omits the static `/dev/harthmere-visual-auth` page, do not treat its 500 as a
combat failure or rebuild the lane blindly; authenticate through the E2E API,
preserve the browser cookie/storage session, and navigate directly to
`/at/<username>` before repeating the acceptance action.

On a retained production-sized world, do not wait for `.loading-wrapper` to
disappear before placing the authenticated combat actor. A reused actor can be
dead, warped, or standing in an unsubscribed/unloaded shard; the production
client correctly keeps the loading gate visible there, so an overlay-first
runner times out before it ever applies the fixture that would make the client
ready. Use this order instead:

1. authenticate, but do not create or navigate the page yet;
2. use the authenticated request context and signed
   `/api/admin/apply_ecs_changes` path to write the authoritative safe
   position/orientation, live health, zero velocity, cleared death/icing/warp
   state, and default movement state;
3. navigate to the exact build and wait only for `clientContext` and the native
   ECS E2E bridge;
4. disable ordinary player-position publishing for the deterministic fixture;
5. reconcile the same authoritative pose through the bridge and mirror it into
   `/sim/player` and `/scene/local_player`;
6. only then wait for the loading overlay to remain absent, the canvas to be
   visible, and rendered frames to advance.

The August 7, 2026 audio/FPS acceptance run first waited for the overlay and
burned the full 120-second browser timeout even though authentication, Sync,
the ECS bridge, WebGL, and client contexts were healthy. A later attempt moved
the actor only after the bridge existed, but that was still too late: the
initial terrain subscription had already been selected from the stale pose.
Treat both reports as test-harness ordering failures, not game regressions.
Keep the pre-navigation authoritative fixture plus bridge reconciliation in
`test-harthmere-native-player-attack-live-browser.cjs` so future focused runs
neither restart the warm stack nor repeat the false wait.
Do not copy a coordinate from an older retained snapshot without checking the
exact current world. In the August 7 r2 world, `[895, 62, -197]` rendered,
remained outside protection, and produced the green melee/FPS row when written
before page creation. The older exact-world gathering fixture at
`[2103, 53, -270]` returned a terrain entity with an undefined shard payload in
that same retained snapshot and correctly triggered `ClientInVoid`. Preserve
the client-error terrain diagnostics when choosing a new fixture: a position is
valid only when its supporting shard contains materialized terrain, the loading
gate clears, and the HUD is not protected.

Audio acceptance must inspect the sound runtime, not merely the projectile
animation or an asset request. For melee, require an authoritative HP decrease,
an incremented `confirmedMeleeHitCount`, the expected `lastRequestedId`, and a
zero pending queue after Web Audio unlock. For projectile audit batches,
require `requestedPlayCount` to advance and `pendingRequestCount` to return to
zero after the visual lifecycle settles. A cancelled outgoing music fetch such
as `audio/music-*` or `audio/muck-music-*` during region-track handoff is a
transient request abort, not a failed combat sound effect; classify it as such
instead of failing an otherwise green attack row.

Keep terrain-dependent and terrain-independent browser gates separate. A real
melee row still requires a cleared loading gate, visible canvas/crosshair, and
authoritative target HP loss. The projectile lifecycle/audio catalog can run
behind a terrain loading gate when all of the following are independently
true: the native ECS bridge exists, render frames advance, the projectile audit
panel is mounted, Web Audio reports running, and every visual batch settles.
Use `HARTHMERE_E2E_ATTACK_PROJECTILE_AUDIO_ONLY=1` for that bounded gate. It
must still require every batch's `requestedPlayCount` increment and zero
pending sound queue; it merely prevents an undefined terrain-shard payload from
being mislabeled as a projectile or sound regression.

The August 4, 2026 rendered-input batch exposed two more failure modes that a
green health-handler test cannot catch:

- **Do not reuse the generic cursor predicate for the native-NPC metadata
  pass.** The generic pass intentionally excludes `npc_metadata` entities so
  their latency-smoothed rendered body is tested once by the metadata pass. If
  that same predicate is passed into `traceNpcMetadataCursorHits`, every native
  NPC is rejected by both paths and the crosshair can never enter attack state.
  Keep a unit contract proving one native NPC is excluded from the generic pass
  and accepted by the metadata pass, then require the rendered crosshair and an
  authoritative HP decrease in the browser.
- **Prove the canvas owns the click before calling it combat input.** In a
  desktop browser that advertises Pointer Lock but cannot retain it, the
  centered escape menu can leave `Give Feedback` over the game. A coordinate
  click then opens the report textarea while the test misleadingly records a
  mouse event. For the supported pointerless-desktop lane, remove
  `document.exitPointerLock` in an init script before React mounts so
  `BiomesView` attaches focused canvas input and `EscGameMenu` stays absent.
  Immediately before every attack, require `/game_modal.kind === "empty"`, no
  visible `.esc-game-controls` or report dialog, and
  `document.elementFromPoint(canvasCenter)` to be the gameplay canvas. Keep the
  feedback modal closed for the entire batch; fail the row instead of forcing a
  click through UI.

The August 5 off-reticle Mucker capture added a third acquisition rule. The
HAR/cval stream contained only one `updateNpcHealthEvent`: the single direct
cursor hit. Later weapon animations visibly crossed the Mucker body but never
published a damage event. The product seam was target acquisition, not server
damage. Native melee now resolves in this order: valid lock, direct cursor body,
then one nearest unobstructed rendered-body intersection in the horizontal
hand/weapon sweep. The fallback uses the smoothed rendered NPC position mapped
back to the exact ECS id when the renderer registry is present. On real attack
input it also scans the small nearby native-NPC ECS sphere, because a freshly
streamed body can be rendered and authoritative before the optional debug
registry publishes it. That scan is never run from the per-frame idle tick. The
target AABB, selected item's authoritative reach, authored premium
`targetLength` when available, bare-hand path radius, and terrain line of sight
remain the final gates. It does not reuse the voxel-edit radius, does not hit a
body wholly behind the player, does not hit through terrain, and does not turn
one swing into multiple server cadence advances. Keep separate direct-ray,
off-reticle body-edge, registry-absent ECS-body, behind-player, blocked-body,
and just-outside-reach rows.

Do not place the off-reticle fixture inside a tree or wall and then interpret
the expected line-of-sight rejection as an acquisition failure. Capture the
before frame and prove the target body is visibly clear of terrain. In a shared
Anima world, reset both the rendered player pose and the target position
immediately before every bare-hand/tool/weapon boundary press; a hostile fixture
can otherwise walk toward or push the player until the nominal outside boundary
has become an inside hit. The canonical runner probes bounded cardinal and
diagonal lanes with the longer selected item and uses the first lane where the
real crosshair can see the body; it then switches to the shorter item at the
same measured placement. Do not restore the old fixed `+X` coordinates beside
the retained Muck tree.

The focused runner that enforces those rules is:

```sh
HARTHMERE_E2E_CONTROL_TOKEN=<redacted-token> \
HARTHMERE_E2E_BASE_URL=http://127.0.0.1:3017 \
HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:4907 \
HARTHMERE_E2E_HEADLESS=0 \
  node scripts/harthmere/test-harthmere-native-player-attack-live-browser.cjs
```

It runs every player-attack edge serially without stopping on the first failure,
uses admin ECS only for fixture setup/readback, saves a screenshot for every
row, drives all attacks through real rendered mouse/keyboard input, runs the
full projectile/charge panel, and records the authoritative HP result. Reports
are written under `artifacts/harthmere-native-player-attack/`.

The same run samples the real renderer for twelve seconds before combat. Treat
the captured 16.7 FPS session as a regression: the gate requires at least 30
median FPS and records frame, CPU, GPU, render-scale, effective draw distance,
requested adaptive draw distance, and renderer evidence. A sub-30 baseline is
a recorded release failure, not permission to stop the selected scenario
matrix. Continue through every requested attack/projectile row, then return the
aggregate failures in one report.

The August 4 cow/inventory capture adds four rules to that gate:

- A truncated HAR is still evidence. Scan every complete entry before the
  truncated tail and correlate it with the console clock. In this capture there
  was no `updateNpcHealthEvent`, inventory throw event, or
  `request_inventory_item_action`; the failure happened before server
  authority. Do not patch the health reducer or inventory backend when the
  initiating event never existed.
- A follow-up attack pressed during commitment must retain the entity under the
  crosshair at that press. Do not discard early presses, reacquire the cursor at
  recovery, or let a later click overwrite the first queued target. The live
  matrix must hit cow one, acquire cow two during recovery, press attack before
  commitment ends, and observe cow two's authoritative HP decrease without a
  second fresh click after recovery.
- Test fluid transitions with real keys: `E` dodge, `Q` evade, and Space jump.
  An attack pressed during committed movement must begin immediately and deal
  damage without cancelling the lower-body movement; dodge and evade must each
  accept a new action at the exact 0.5-second cooldown while rejecting an
  earlier repeat. Wait for the first replicated `movement_state` before testing
  the early second press—otherwise its normal server echo can be mistaken for a
  new action. Keep the airborne animation contract too: jump/fall owns the legs
  while attack owns the upper body.
- Inventory acceptance is UI-to-authority, not a button-presence test. Open the
  rendered Inventory tab, select a deterministic ordinary stack, click Drop 1,
  Destroy, and Drop All, and assert authoritative counts `4 -> 3 -> 2 -> 0`.
  Drop must also create a physical local-ECS grab bag. Keep quest items disabled
  and route Redis-backed appendix refs by item id rather than their synthetic
  grid index. After closing Inventory, Chromium's post-exit Pointer Lock
  cooldown must stop timer retries; a fresh user gesture may retry later, but
  the feedback modal must remain closed.

The August 4 battle-performance capture adds a separate evidence and recovery
gate:

- Salvage every complete HAR entry before a malformed or truncated tail. The
  complete portion showed successful network responses, while the console log
  recorded 256 `GL_INVALID_OPERATION` draw failures, 671 long animation-frame
  handlers, and reported battle frame rates of 2–14 FPS. Treat that combination
  as a renderer failure first, not as proof of an NPC range or combat-authority
  defect.
- An unmarked scene containing both ordinary and raw shader materials must stay
  on the normal Three.js pass. Only a root explicitly marked as a coerced player
  base scene may enter the MRT/base pass. Reproducing the missing-fragment-output
  error is a release blocker even when combat still eventually applies damage.
- Do not eagerly materialize the complete premium projectile catalogue at game
  startup. Load the selected projectile on demand and retain bounded fallback
  diagnostics; battle entry must not compile every unrelated projectile.
- Dynamic quality may use a 24-sample emergency window when median frame time is
  at least 50 ms, but that short window is reduction-only. Quality increases
  still require the full stable sample window so a momentary recovery cannot
  cause oscillation.
- Capture the effective and requested draw distances separately. The headed
  Apple M1 Max run measured 27.78 median FPS with 26.5 ms CPU and 4.535 ms GPU
  time while the effective Harthmere radius remained pinned at 192 m. That is a
  CPU-distance failure, not a reason to lower render scale. The corrected
  desktop auto floor is 96 m; explicit Low/Safe modes and the mobile emergency
  ladder remain separate contracts.
- Do not use a baseline FPS assertion that throws before the selected rows.
  Append the performance failure to the report, capture the baseline
  screenshot, and continue. Row-level failures remain isolated by
  `runScenario`, so an arrow performance miss must still preserve its asset,
  socket-origin, projectile, impact, and authoritative damage evidence.
- The arrow row must prove the exact `hunter_bow_shot` asset loaded without a
  fallback, the held bow exposed `ArrowSocket`, and the projectile origin was
  near that socket. A generic projectile spawn or a local catalogue lookup is
  not sufficient evidence.
- A paid physical bow receipt deals exactly 5 authoritative HP. Do not pass
  that fixed value through ranged stats, criticals, sublevel potency,
  attacker/target level factors, creature resistance, armor, defense, evasion,
  or shield mitigation. Those systems still apply to melee, magic, thrown, and
  energy attacks. Live acceptance must assert the exact HP delta as well as one
  backpack-arrow debit; merely observing some damage is insufficient.
- A player root can become mixed **after** its initial material-coercion pass.
  The August 5 continuation logged unresolved native item
  `8761900000000001`, its procedural `MeshStandardMaterial` fallback, the
  marked player root defaulting to the MRT/base pass, 256 missing-fragment
  output errors, 299 long animation-frame handlers, and 2–14 FPS in that exact
  order. When testing a renderer-material fix, select both a generic missing
  item and Spikefish through the real hotbar attachment path after the avatar
  is already mounted. Traverse every fallback descendant, require generated
  base-pass materials only, reject stock materials, and reject any new
  `base,three` player-root diagnostic. A green test that checks only the
  initial avatar body is incomplete.
- Keep the late-attachment performance row non-fail-fast. Record the baseline
  FPS/WebGL failure, then continue jump attack, stagger, projectile, exclusion,
  and weapon-in-hand rows. Otherwise the first renderer error hides combat
  failures and repeats the false-green pattern this guide is meant to prevent.
- A rigged held bow needs skeleton-aware cloning at both runtime stages: the
  parsed GLTF scene to the cached template, and the cached template to the
  equipped instance. Ordinary `Object3D.clone()` can leave SkinnedMesh
  skeletons pointing outside the cloned hierarchy; the headed symptom is an
  `applyBoneTransform`/`matrixWorld` page error, the old weapon remaining in
  hand, and the Unexpected Error modal before release. Test the exact packaged
  `hunter_bow.glb`, require every cloned skeleton bone to exist, call
  `computeBoundingSphere()` without throwing, and then prove the rendered
  equip/release path. Held skinned segments may disable their own frustum
  bounds because the player entity is already culled as one renderable.

The same battle-flow gate now owns the fight-only four-hit combo and held-heavy
contract. Do not validate these from constants or animation names alone:

- Hits 1–4 share one budget across light and heavy input. Each hit must expose a
  different packaged `HarthmereBodyWeaponBasic_VariationN_24` or matching Heavy
  variation, link only after the current gameplay contact (250 ms light,
  417 ms heavy), and preserve that contact exactly once. A fifth press is
  retained but must not start until the fourth hit's full commitment plus the
  three-second combo cooldown.
- Ranged and magic releases do not enter the four directional-swing budget.
  Their own launch/cast clocks remain authoritative and must not acquire a
  melee `combatCombo` merely because they have an attackable target.
- Buffer the next real press before taking a screenshot. A synchronous headed
  capture can consume most of the 250 ms light contact link; placing screenshots
  between hit starts manufactures a false recovery pause in an otherwise valid
  chain. Capture the chain after all four follow-up inputs are committed.
- Holding primary for at least 220 ms promotes that one press to Heavy. Require
  `damageMultiplier: 1.5`, the matching Heavy variation, a runtime clock exactly
  matching the authored frame-10 0.417 s contact / frame-26 1.083 s full clock,
  and no extra Basic hit when the button is released.
- Combo state belongs to the player instance. Cow A dying, despawning, or
  leaving range may not swallow a valid buffered Cow B press; another player's
  variation history may not affect the local chain. Death, respawn, warp, and
  combat-context timeout reset the chain.
- Mining outside combat remains the ordinary DiggingTool/destroy path: it does
  not increment the combo, start the three-second cooldown, or select a combat
  variation. A mining tool aimed at an attackable NPC is still a combat attack
  and must keep that exact selected tool visual.
- The sole equipped-item visual is `PlayerMesh.itemAttachment` on the animated
  Tool/hand path. Cycle sword, axe, pickaxe, shovel, ranged, magic, ordinary
  non-tool, and empty slots; require zero or one attachment child as expected
  and `deprecatedWorldSpaceWeaponPresent: false`. The screenshot regression is
  the gray trailing sword at the player's lower right—never hide all tools to
  make it disappear.
- A Native ECS inventory fixture is not selected until both authorities agree:
  update the ECS `inventory.selected`/`selected_item` pair and the local
  `/hotbar/index`, then wait for `/hotbar/selection`. Updating only ECS leaves
  the rendered attachment and `InteractScript` on the prior slot; this can make
  a sword click classify as ranged and falsely fail every later combat row.
- `UpdateNpcHealthEvent` and `UpdatePlayerHealthEvent` carry only the requested
  basic/heavy timing class. The server still derives the selected item, range,
  level, damage, and cadence. Its per-player TriggerState authority permits four
  contact-linked melee hits, applies the 1.5x Heavy multiplier, and rejects a
  fifth hit until the three-second post-chain cooldown. Do not restore the
  legacy item interval between hits 1–4 or trust the client-provided HP delta.
- Failed-only runs must include prerequisites used for comparison. The held
  Heavy and rapid-double-click rows automatically include the direct single-hit
  baseline; a missing baseline is a setup failure, not combat evidence.
- Projectile assets are lazy. Require a nonempty manifest, zero failed assets,
  and zero fallbacks before pressing the audit buttons, but do not wait for
  `loadedCount === manifestCount` before the buttons have requested their
  batches. The audit buttons themselves exercise loading. Revive/recenter the
  deterministic player before every audit row so a long prior inventory row or
  environmental death overlay cannot cover the panel.
- The audit panel must enable its controls when the manifest is registered and
  `failedIds` is empty. Requiring `loadedCount === manifestCount` deadlocks lazy
  loading because disabled buttons cannot request their own GLB batches.
- Magic charge/cast gesture bridges own only emotes and animation telemetry.
  They must never overwrite `LocalPlayer.attackInfo`; doing so blocks the native
  release from starting its authoritative attack, loops the charge every visual
  recovery, and produces a visible charge with no projectile or damage.

Run the focused source batch before compiling:

```sh
node_modules/.bin/mocha --config .mocharc.json \
  src/shared/game/test/movement_actions.test.ts \
  src/server/logic/test/movement_actions.test.ts \
  src/client/game/interact/item_types/attack_destroy_delegate_item_spec.test.ts \
  src/client/components/challenges/HarthmereProjectileVisualAuditPanel.test.ts \
  src/client/components/challenges/HarthmereUnifiedHUDStanding.test.ts \
  src/client/game/util/player_animations_airborne_attack.test.ts \
  src/shared/harthmere/test/player_combat_combo_and_equipment.test.ts \
  src/shared/harthmere/test/premium_projectile_wiring.test.ts \
  src/client/components/challenges/harthmereInventoryBiomesUIActions.test.ts \
  src/client/components/contexts/PointerLockContext.test.ts \
  src/shared/harthmere/test/native_player_attack_live_browser_runner_contract.test.ts
```

Only after that batch and the shared full source gate are green should the lane
compile once. A known READY dependency/base image may be passed to the warm
refresh instead of rebuilding Docker layers; verify the tag resolves to the
expected immutable image ID before use. The August 4 READY base was
`biomes-node:local-49bde1ef-mobile-camera-catalogue-20260804-r3` =
`sha256:93b77502eb933c5b4f28ab828806d4e79de12de1f40dc3af1e0de3a83c9d7119`:

```sh
docker image inspect \
  biomes-node:local-49bde1ef-mobile-camera-catalogue-20260804-r3 \
  --format '{{.Id}}'

node scripts/glitch/refresh-warm-local-stack.cjs \
  --image biomes-node:local-49bde1ef-mobile-camera-catalogue-20260804-r3 \
  --build all
```

The image is only a dependency/runtime fast path. Current `.next`, `dist`, and
`public` artifacts still must share one new build ID, remain stable during the
swap, and pass the authenticated exact `/at` readiness probe before browser
acceptance. Never call an old READY image current product evidence by itself.

When the compiled artifacts are already current but the retained app was
started with native browser control disabled, do an app-only recreate instead
of rebuilding. `--inherit-env` copies named values from the helper process and
never prints their values; use it for the control token rather than putting the
secret in command-line arguments:

```sh
HARTHMERE_NATIVE_ECS_E2E=1 \
HARTHMERE_E2E_CONTROL_TOKEN="$(openssl rand -hex 32)" \
node scripts/glitch/refresh-warm-local-stack.cjs \
  --image biomes-node:local-49bde1ef-mobile-camera-catalogue-20260804-r3 \
  --build none \
  --inherit-env HARTHMERE_NATIVE_ECS_E2E \
  --inherit-env HARTHMERE_E2E_CONTROL_TOKEN
```

After the swap, verify the build ID and `dist/shim.js` hash are unchanged, the
image ID is still exact, Redis identity/size/hash are unchanged, and the app has
restart count zero and was not OOM-killed before opening Chromium.

Test the 30%-slower monster requirement as a separate Anima movement row. The
player-input runner above proves targeting and damage; it does not run the NPC
simulator. Reuse the already-authoritative same-world Anima container, require
`/ready` to return `OK`, `HFC Bootstrap complete`, restart count 0, and
`OOMKilled=false`, then run only the ordinary chase slice:

```sh
HARTHMERE_E2E_CHASE_ONLY=1 \
HARTHMERE_E2E_BASE_URL=http://127.0.0.1:3017 \
HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:4907 \
HARTHMERE_E2E_URL=http://127.0.0.1:3017/at \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

That row measures authoritative displacement over elapsed wall time, requires
the creature to climb the uneven-step fixture, synchronizes the final pose to
the rendered actor, and rejects movement above
`HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND` (currently `7.6 * 0.7 =
5.32 m/s`, plus only the fixture's bounded sampling tolerance). It also rejects
an effective speed below `2.25 * 0.7 = 1.575 m/s` after the small hill/poll
tolerance, so a stuck or snail-paced NPC cannot satisfy the row merely by
moving once. Its direct
one-point NPC provocation is valid only for entering the Anima chase state; it
must never be cited as player-attack acceptance. Stop and release the shared
Anima container immediately after this bounded row instead of running the full
memory-heavy combat matrix.

On the production-sized retained world, AMD64-emulated Anima may revisit one
new fixture only every several seconds. The chase row therefore allows a
bounded 60-second observation and accepts a routed path around the step instead
of requiring a straight-X crossing. It still requires real displacement,
approach, vertical climb, authoritative/local/rendered agreement, and the hard
5.32 m/s ceiling. Treat its wall-clock `effectiveChaseSpeed` as an observed
loaded-stack value; the exact `0.7` command multiplier and scaled speed floor
remain unit-contract assertions, because scheduler idle time is not movement
speed.

Focused browser actors must be alive and standing on loaded terrain before an
input or chase timer begins. Seed chase-only users at the known-safe start before
navigation, use the bounded low-memory render profile, and keep
`permitVoidMovement=false`: the production controller deliberately freezes
physics while nearby shards load. Setting it true can drop the visual actor to
the world floor, apply fall death, and turn every later attack or speed timeout
into a harness failure. For player-attack runs, clear `death_info`, restore full
native health and zero rigid-body velocity, wait for that revived row to reach
the synchronized client, and only then place the rendered actor at the combat
fixture.

When attaching a standalone exact-current Anima bundle to a retained focused
web/Redis lane, point both `SHIM_SERVICE_HOST`/`SHIM_SERVICE_PORT` and
`LOGIC_SERVICE_HOST`/`LOGIC_SERVICE_PORT` at that web container. Redis and HFC
can be healthy while Anima remains in `creatingContext` if either RPC endpoint
silently falls back to localhost. For a warm artifact refresh, the replacement
container's `BUILD_ID` must be the mounted `.next/BUILD_ID`; copying the stale
source-container value makes an exact-current client/server mount look like the
old image and invalidates lifecycle evidence.

Focused combat stacks can explicitly disable stream workers, Anima, or Gaia in
the unified app while a required simulator runs as its own container. Readiness
must inspect those enable flags before requiring in-container `/ready` probes.
Requiring Trigger from a container with `GLITCH_ENABLE_STREAM_WORKERS=0` leaves
a healthy reduced topology in a false wait and can eventually roll back a valid
warm refresh. This exception is topology-specific: quest progression still
requires Trigger, and a complete farming/world-simulation gate still requires
Gaia.

Collect independent rendered combat failures before editing. Run
`scripts/harthmere/test-harthmere-combat-live-browser-batch.cjs`; it executes
the giant/hill, ordinary chase/melee, Anima escort, and Indisworm slices
serially against one warm world, persists each child log, and does not stop
after the first failure. The escort row must prove native assignment, Anima
movement, Sync readback, and rendered Walk/Run rather than teleporting the
companion. Make one grouped source/test/doc fix from that report, then rerun
only the failed slices rather than replaying green scenarios.

The first exact-current batch exposed four fixture mistakes worth preserving:

- Do not give a visual-auth player an artificial maximum health value. The
  normal player-status authority restores the real maximum, and waiting for the
  impossible fixture can leave void/death recovery free to move the actor. Fill
  the existing native health component to its real maximum, prove one strike,
  and refill that same component between independent assertions.
- A server `MoveEvent` is not enough for a browser-owned player. Update
  `/sim/player` before publishing the matching move or the next local movement
  tick can overwrite the authoritative pose and move the Sync subscription away
  from a newly created combat fixture.
- NPC mesh/render-state generation can race entity deletion or a Sync-radius
  transition. A missing `npc_metadata` component during generation is a clean
  unrenderable cache miss, not an assertion failure that should poison the
  resource and abort an unrelated browser scenario.
- When live Anima owns `rigid_body`, a single manual velocity update is only a
  transient sample. For an authored Walk/Run mixer probe, hold the bounded
  authoritative test velocity long enough for the clip to blend, then release
  it and separately prove Anima-owned movement and attacks. Do not disable the
  simulator merely to make an animation assertion easier.

On the 16.56 GiB Docker host, do not repeat the full-snapshot standalone-Anima
combat matrix after the simulator reaches its memory ceiling. The August 3
exact-current run retained one 340k-key Redis and one focused app, then attached
Anima to the same world. At a 2,048 MB V8 heap Anima aborted after roughly eleven
minutes with `Reached heap limit`; app and Redis remained restart-zero and were
not OOM-killed. A single bounded retry at 3,072 MB kept Anima alive but raised
its resident memory above 4.6 GiB, leaving the complete lane near the 16.56 GiB
VM limit; new boss, Mucker, escort, and Indisworm fixtures still did not receive
an Anima state update inside their 12–90 second acceptance windows. Treat this
as invalid simulator acceptance, preserve the source/unit/type and already
captured renderer evidence, stop Anima, and move on. Do not start another Redis,
raise the heap again, or weaken gameplay assertions to manufacture a pass.

For an Indisworm retry where GLB, Idle, Walk, HitReact, and Run already passed,
set `HARTHMERE_E2E_INDISWORM_DAMAGE_ONLY=1`. The runner keeps the real Sync and
renderer setup but skips those green animation assertions and resumes at the
live Anima ranged/melee authority boundary. This flag is a no-repeat test mode,
not a substitute for the full first run.

### 4.32 Business customers require a real same-world Anima process

A focused web container with `GLITCH_ENABLE_ANIMA=0` can still create and render
a native business-customer ECS entity. That is not movement acceptance: without
a same-world Anima process consuming the entity and publishing HFC updates, the
customer remains in `entering` with a computed route but a stationary position.
The business browser runner must therefore require a separate Anima container,
`RestartCount=0`, `OOMKilled=false`, `ANIMA_HFC_WRITES=1`, and a literal `OK`
from Anima's `/ready` endpoint before and after the matrix. Gaia is required
only for a business row whose transaction actually participates in farming or
plant simulation; it is not customer locomotion authority.

On a loaded warm world, Anima's generic `/ready` can become `OK` before the HFC
subscription finishes bootstrapping. Wait for both service readiness and the
explicit `HFC Bootstrap complete` lifecycle line before starting a customer
session. Starting in the gap can produce misleading partial-state evidence.

Business customer routes cross a combined interior whose visible floor and
furniture collision are native ECS proxies, not terrain graph voxels. The
August 4 full 19-row batch proved that terrain A* could author a plausible route
while ordinary ground physics left customers motionless at curbs, graph-height
seams, or the exterior spawn. The shipped customer locomotion is therefore a
bounded authoritative Anima interpolation along the audited doorway, queue,
counter, and departure waypoints. It remains speed-capped and visible on every
tick; it is not a one-frame teleport to the counter. Prove all 19 entrance and
departure routes through the focused logic matrix before browser work, and keep
ordinary NPC locomotion on the normal physics path.

Business-customer phase transitions are HFC authority. Do not write a mixed
`npc_state` plus `expires` update only through regular ECS: the stale HFC
`npc_state` wins merged reads, so aborted customers remain `entering` and later
test sessions collide with them. Partition every existing-customer update with
the native HFC classifier: `npc_state`/`emote` to HFC, `expires` to RC, and
normal create/delete operations through the HybridWorldApi. Before retrying a
failed browser row, confirm prior aborted session customers reached
`cancelled`/`despawn_ready` or were removed; do not stack a new session on stale
fixtures and misdiagnose collision escape as pathfinding failure.

New native NPCs can briefly arrive in Anima through a partial HFC view. A
simulator cache must refresh authoritative NPC type and size when the complete
external state arrives; otherwise the entity can retain fallback locomotion
despite correct later ECS metadata. Also validate the positive fixed duration
at the final per-NPC tick boundary, not only when the batch starts. A late
entity must never run physics with `dtSecs=0`.

For audited customer routes, author the create orientation toward the first
waypoint and set spawn jitter to zero. Materialize only the lead ticket at the
audited doorway; later tickets remain economy queue records until promotion.
When a previous shift is still walking away from the same route, defer the new
customer create until that route clears. Do not move the audited building
anchors or create several colliding bodies outside the door.

Do not let an expired business session retain `waiting` tickets with queued or
approaching spatial phases. Expiry, passive tick expiry, and manual end must all
close the queue authoritatively: waiting tickets become `left`/`cancelled`, the
current ticket is cleared, and the end timestamp is recorded. ECS should still
defend against older persisted state by treating non-active sessions as
cancelled. Before creating a replacement shift's NPCs, defer the whole create
batch while any customer from another session for that same outpost remains on
the route. Checking only the spawn point misses collisions farther along the
shared entrance aisle.

If a routed customer remains in `entering`, inventory the actor-owned session,
authoritative `npc_state`, waypoint index, and Anima lifecycle before changing
terrain. A route whose index never advances is an authority/materialization
failure; a route whose position advances but UI never reaches `serving` is a
projection failure. Batch the evidence across the affected businesses, make
one lifecycle fix, then rerun only failed business IDs.

The current server Webpack TypeScript loader requires Node 22.6 or newer. If a
host Node 20 build fails before source compilation, run it once with the
workspace Node runtime on `PATH`; repeated host-runtime retries provide no new
evidence.

Smoke one business through entrance, service, departure, and safe despawn.
After that passes, run all 19 rows serially in one browser context and one warm
world. Persist each row immediately. If the batch exposes failures, fix them as
one group and rerun only the failed `HARTHMERE_BUSINESS_E2E_IDS`; never replay
already-green original mini-games or business rows.

The combined-interior renderer is streamed, not eager. At the Grove start it
can correctly report zero loaded business interiors; desktop keeps at most two
nearby interiors resident. Do not restore a runner preflight that requires all
19 GLBs before row one. Require the manifest `expectedCount` to remain 19 and
the loaded/loading counts to stay bounded, then teleport per row and wait for
that exact outpost's visible LOD0 before checking transformed bounds. The old
eager-count assertion failed before any business action and provided zero
gameplay coverage.

For combined Blender interiors, testing only manifest fixture coordinates is
insufficient. Blender's Y-up glTF export can change the sign of the authored
depth axis even when every manifest coordinate and preview is correct. Parse
the actual compressed GLB node/accessor bounds for every LOD, apply the exact
runtime root transform, and assert the resulting world AABB remains inside the
audited native shell. Expose the same transformed world bounds through the
browser debug bridge and require them in each live row; this catches entire
catalogues rendered outside or above buildings without inspecting fixtures one
at a time.

Keep standalone contract scripts separate from Mocha. `t.sh file` accepts test
files loaded by Mocha; a script that interprets `process.argv[2]` as its repo
root must be invoked with `node scripts/...`. Mixing it into the Mocha file
list makes the script consume Mocha's `--config` argument and creates a harness
failure before product assertions run.

### 4.33 Business-panel controls must stay dependency-light

Do not import the spatial business HUD merely to render or unit-test the shift
start/end control. The spatial HUD legitimately depends on ClientContext, THREE
projection, native NPC state, and game resources; pulling it into the panel
also pulls pathfinding, generated Galois shapes, renderer code, and msgpack into
an otherwise small rendered-component test. This first failed at generated
`shapes`, then at the browser test's fake Buffer implementation.

Keep `HarthmereBusinessShiftControlPane` in its own React-and-adapter-only
module. The full panel can then be bundled and browser-smoked without game
renderer stubs, while the actual spatial HUD remains covered by exact-image
browser evidence. When a rendered component imports `/public` assets or Bikkie
data, run the whole affected file batch through `./b test <files...>`; do not
mix it into `t.sh file`. If only one row failed after a completed batch, rerun
that named row with `--grep` instead of replaying the green files.

### 4.34 Preserve request identity when reading versioned ECS batches

`/api/admin/ecs/get_with_version` returns one `[version, entity]` tuple for
each requested ID, in request order. The first tuple member is a resource
version, not the entity ID. Never build an entity map with that version as the
key: multiple entities can legitimately share a version and silently collapse
inside a Map, creating false missing-entity failures.

When a bridge exposes only these ordered tuples, map each response row back to
the original request by offset (`ids[offset]`) and use the tuple's second
member as the entity. Add that exact mapping to the runner's static contract.
If a batched authority check reports fewer rows than were seeded while startup
logs prove the complete seed family was reconciled, inspect response identity
mapping before rebuilding, reseeding, or changing product collision code.

### 4.35 Hybrid ECS creates must explicitly initialize HFC authority

Splitting only update deltas is insufficient for a native NPC created through
`HybridWorldApi`. A mixed create sent to the hybrid API is persisted in regular
ECS, but that does not guarantee a corresponding HFC hash. The NPC can render
and appear in economy/session state while Anima sees no position or NPC state
and never simulates it.

For session-only native NPCs, apply the complete create to regular ECS first,
then publish the create's HFC-classified components as an HFC update. Preserve
that order so Sync never observes an HFC-only entity. Delete explicitly from
both stores. Unit-test the actual apply helper with a HybridWorldApi and assert
the ordered RC-create/HFC-update calls; checking only the generated create's
component list does not prove the components reached both authorities.

Also normalize both sides of actor/session identity comparisons in cleanup
harnesses. A string-vs-number comparison can silently retain every failed
session, leaving dozens of native customers for Anima to simulate and turning
the next route test into contaminated evidence.

Cleanup must still satisfy the same proximity validation as normal gameplay.
For a retained multi-business actor, move through each business's audited staff
point before ending that session. Inspect backend mutation warnings even when
HTTP and the top-level response are successful; `economy_rejected:*` means the
cleanup did not happen and must fail the harness immediately.

## Business route geometry: contracts over the authored plan, not the world

The 19-business in-world simulation added a class of contract worth calling out
because it is cheap and catches a category that browser evidence historically
had to find the expensive way.

`business_route_clearance.ts` and `business_aisle_keep_out.ts` assert over the
**authored materialization plan and seed tables** — the same data the seeder and
any reconciliation replay consume. So they run in `.mocharc.fast.json` with no
server bootstrap, complete in well under a second for all 19 businesses, and a
green result means the _shipped_ world is walkable rather than that a fixture
was well-formed.

Two modelling rules, both learned by getting them wrong first:

- **Collapse the edit stream last-write-wins before asking whether a voxel is
  solid.** Dressing passes genuinely repaint voxels the shell already wrote.
  Treating "some edit touched this position" as solid reports phantom walls and
  misses real ones; the first version of the clearance checker declared the
  Ashline door blocked at a row where a later pass had cleared it.
- **A one-voxel step is walkable** (`maxStepHeight` is 1 for ordinary bodies).
  Ignoring that reported every raised porch in Harthmere as impassable — six of
  nineteen businesses failed for porch decking, burying the three real
  obstructions. Carry foot level forward along the route, and require authored
  solid support for any level _above_ the reference, or the model floats bodies
  upward over open ground and cheerfully reports walls as walkable.

### `./b test` still does not typecheck — and here it mattered

The aisle sweep's generic constraint was wrong in three successive ways while
every runtime assertion stayed green: ECS `Change` carries `ReadonlyPosition`
over a `ReadonlyVec3f`, an `Update` is a delta whose components may be `null`,
and a `Delete` has no `entity` key at all (which trips weak-type detection).
None of that is visible to Mocha under `transpileOnly`.

When the scoped project (`tsconfig.businessoverhaul.json`) is too slow for the
edit loop, a **signature-mirror file** is a good stand-in: a tiny module that
calls the new API exactly the way the real caller does, compiled under a
throwaway config containing only that file. It typechecks the contract in a few
seconds instead of minutes. Delete it afterwards; it is scaffolding, not a test.

### 4.36 Business minigame choices must be tested through NPC talk

A green `start_business_customer_session` request does not prove the minigame
is playable. The Greenlamp production HAR on 2026-08-03 showed a committed
shift followed by the ordinary NPC dialogue surface, so the player could never
emit `serve_business_customer`.

- Keep the always-visible spatial customer HUD status-only.
- Open the actual `talk_to_npc` surface for the authoritative current ticket.
- Assert the business service offers appear exactly once and generic `Chit
Chat` / `Ask about this place` actions do not appear.
- Capture separate screenshots for shift start behind the counter, customer at
  counter, talk choices, committed reaction, departure and safe despawn.
- The correct offer must not be visually marked from the authoritative
  `requestedOfferId`; that would make the minigame answer itself.
- HAR acceptance must include `serve_business_customer`, not just
  `start_business_customer_session`.

### 4.37 Do not let a slow materializer rewrite Anima-owned progress

Business customer economy/session ticks and Anima operate at different
cadences. The session materializer owns assignment, phase, reaction and route
intent; Anima owns the per-tick waypoint index and movement progress. Rewriting
the whole custom `npc_state` every time the economy is polled can appear
harmless in unit tests while resetting a live customer at the same doorway
forever.

- Treat unchanged materialization as a literal no-op, not an identical HFC
  update.
- Preserve `waypointIndex`, `progressPosition` and `progressAtSeconds` when the
  authoritative route phase is unchanged. Preserve legacy `pathfinding` data
  only for rolling-version compatibility; current customer locomotion does not
  consult the terrain path graph.
- Reset movement progress only on a real route/phase transition.
- Edge-trigger reaction emotes and expiry timers; repeated polling must not
  restart either one.
- Test this by injecting Anima-advanced state, running another materialization
  pass, and asserting that no ECS change is proposed.

### 4.38 Shared quests and item transfers require conservation across replicas

A single app process is not valid evidence for quest sharing. Run the inviter
and invitee mutations as separate stateless replica calls against one shared
Redis world record. Invite, accept, and progress must each escalate Redis
`WATCH` to the shared-world key, and a subsequent read through the other
replica must project the same canonical objective state. Two private Redis
copies only prove two isolated single-player sessions and must not be counted.

Quest invitations may only originate from a challenge the inviter already has
`in_progress`. Resolve native challenge IDs back to the authored Grove/Bible
quest identity on the server, and derive title, area, objective, reward,
invite ID, and shared-party ID from server-owned data. Never accept an
`available` challenge or client-authored metadata as invitation authority.
Acceptance must materialize the invitee's native challenge, and each approved
native quest-progress plan must be replay-safely fanned out to every numeric
ECS party member. The shared Redis record remains the cross-replica journal
projection; Anima and Gaia are not alternate quest authorities.

Inventory handoff tests must assert conservation, not only a successful event:

- move an offered trade stack to another slot before both players accept, then
  assert the exact quantities reached the opposite inventories;
- reject bound/equipped transfer candidates before they enter an offer;
- mail only the requested count inside the parcel, reject zero counts, and
  reject arbitrary containers presented as mailboxes.

The live trade opener must not treat a delayed Sync projection as a rejected
server mutation. On August 3, 2026, the native handler created one trade entity
and wrote the same `active_trades` entry to both players, but the initiating
browser's ten-second local-resource poll timed out under snapshot load. Inspect
authoritative Redis/OOB state before editing the handler or replaying the full
suite. The supported client path polls normal Sync first, then performs one
same-origin authenticated OOB read of the initiating player and accepts only a
new trade ID with the requested partner. This fallback discovers committed ECS
state; it must never manufacture a client-only trade or reuse a known trade ID.
Keep the Trade screen's explicit loading/not-found returns so the OOB fetch of
the non-spatial trade entity has time to complete.

These native handler rows import Bikkie/ECS server state. `t.sh file` omits the
global `CONFIG` and Bikkie bootstrap by design, so its `CONFIG is not defined`
failure is a harness signal, not product evidence. Run the smallest filtered
`scripts/harthmere/t.sh full --grep ...` batch for those rows and keep the pure
quest/adapter/Redis contracts on the fast preset.

### 4.39 Iced snapshot placeables are not physical obstacles

Warm snapshot Redis can retain an iced entity's previous `collideable` and
`placeable_component` data even though Sync correctly treats the entity as
logically deleted. Collision queries must reject `iced` before resolving any
shape, or native Anima NPCs can stop against an invisible server-only body.

Do not use an ECS `size` of zero to dismiss a placeable as harmless. Placeable
collision comes from the Bikkie item's collidable bounds. When a moving NPC has
a valid A* route and finite velocity but an unchanged position, batch-inspect
nearby terrain and entities, resolve every placeable item ID, and record
`iced`, item bounds and collision eligibility together.

### 4.40 Recreate a retained exact-image lane from one captured specification

The 2026-08-03 business pass lost substantial time to three avoidable runtime
setup mistakes after the source batch was already green.

- Next 16 must be invoked with `next build --webpack` for this repository. Use
  `set -e` (or an equivalent checked runner) around the complete Next, server
  webpack, artifact-current, and Docker sequence. Never let a failed client
  build continue into packaging.
- A Docker `--env-file` is data, not a shell script. Do not `source` it: values
  such as `NODE_OPTIONS=--trace-uncaught --trace-warnings ...` can be split and
  executed by the shell. Pass it directly to Docker and retrieve individual
  secrets without printing them using a parser or `docker exec printenv`.
- Before replacing a retained app or companion service, capture its complete
  image, command, network, ports, mounts, and environment. Diff the proposed
  replacement against that specification once. For a separate Anima container
  in this lane, the required overrides included the app hostname for
  `SHIM_SERVICE_HOST` and `LOGIC_SERVICE_HOST`, plus an absolute local
  `GALOIS_STATIC_PREFIX` served by the app. Missing the first made Anima wait on
  itself; missing the second made asset loading fail on a relative URL.
- A bind mount follows the directory inode that existed when Docker created the
  container. If a later build atomically replaces the host `.next` directory,
  `/app/.next` can become empty inside the retained app even though the new host
  `.next/BUILD_ID` exists. The already-running server and browser cache can keep
  enough old code alive for HTTP and `e2e-jump.cjs ready` to remain green, so
  readiness alone does not detect this stale-artifact state. Before Chromium,
  require non-empty host and in-container `BUILD_ID` files with matching values.
  Repair an orphaned mount with `refresh-warm-local-stack.cjs --build none`, but
  only after its ownership gate reports no active compiler; never kill or race
  another task's build to force an exact-current browser row.
- Run the full preflight before Chromium: exact app/Anima image, packaged
  `BUILD_ID`, app/Redis/Anima `RestartCount=0`, `OOMKilled=false`, literal Redis
  `PONG`, realistic `DBSIZE`, app child-service readiness, Anima `/ready=OK`,
  and `HFC Bootstrap complete`. Do not count a browser row begun before all of
  them pass.
- **Lifecycle health does not prove the game page can server-render.** On
  August 4, 2026, build `warm-20260804131740` passed HTTP `/`, Sync, Redis, all
  lifecycle services, matching host/container Shim hashes, restart/OOM checks,
  and Anima readiness. The first authenticated `/at` request still returned
  HTTP 500 because its lazy page import evaluated the additive-town interior
  catalogue and threw `mail_post_house:mail_outgoing has no safe interior
slot`. No business row ran. Before releasing any browser window, authenticate
  the intended E2E actor and require the exact production game URL (`/at` plus
  its real query parameters) to return a successful page and install its
  expected browser bridge. A root-page `200`, importing only the server Shim,
  or requiring the Next page wrapper without executing SSR is insufficient.
  Preserve this as a setup-only failure, close Chromium, and repair the import
  contract once; do not spend another three-minute bridge timeout retrying the
  unchanged artifact.
- **Environment-sensitive generated catalogues need a production-import test.**
  The Mail Post layout had ordinary unit coverage under the test environment,
  including a fixture-count assertion, yet the compiled production SSR import
  selected a different safe-slot result and threw. Any module that constructs
  and validates a complete catalogue at import time must have one focused test
  under the production environment used by Next/server webpack. The test must
  import the exact shared module and require every generated fixture to place;
  a source-only test under Mocha's default environment does not cover this
  startup boundary.
- **Keep authored catalogue choices out of optimized fallback searches, but do
  not make them fatal.** The production bundles have both skipped a valid Mail
  Post authored candidate and judged an authored candidate unsafe while the
  source suite was green. Validate the authored slot in its own direct branch.
  If it fails the exact shell/door/stair/partition/circulation/AABB rules, run
  the deterministic coarse/dense search with those same rules; do not omit the
  fixture, waive overlap, or throw before fallback. A forced-dense regression
  must bypass authored coordinates and place the complete plan. The release
  proof remains the compiled production import and an authenticated exact
  `/at` request; adding logging can change optimization and is not proof that
  the uninstrumented artifact is safe.
- If the user ends the pass before the browser matrix runs, state that plainly.
  Green source contracts and a valid image are not live acceptance.

### 4.41 Request-board graphics and F-key browser tests

The 2026-08-03 request-board pass exposed several traps that future board tests
must avoid:

- The four original Fishing, Farming, Industrial, and Collective Research
  boards are snapshot NPC/quest-giver entities, not ordinary placeables. Keep
  their native entity IDs, `quest_giver`, collision, challenge triggers, and
  reward authority live; suppress only the legacy NPC body when the dedicated
  Blender renderer owns the visual. A placeable-only audit will miss the old
  bot/player meshes and can produce double rendering.
- Test interaction ownership, not merely prompt existence. At Rolland Pond the
  nearby Pondy Bot's `Feed` candidate previously won the same F key, so the HAR
  contained no request-board API/quest activity even though a "Fishing Board"
  label was visible. The live gate must record the dispatcher-selected
  `harthmere:request-board:*` candidate, press the real F key, and observe the
  native `talk_to_npc` quest modal for the exact board entity.
- The Harthmere quay Fishing Board is a second physical entity for the original
  Fishing Board catalogue. Browser and server claim validation must accept the
  two IDs as equivalent while publishing the canonical authored request target
  to the trigger engine. Test both physical anchors; passing only the snapshot
  board does not prove the quay board.
- Renderer changes made after a successful client build make that warm artifact
  stale even when the server and tests are still green. Freeze source, rebuild
  the client once, and prove the host and container report the same
  `.next/BUILD_ID` before Chromium. Reloading cannot add a renderer branch that
  is absent from the mounted bundle.
- Matching `BUILD_ID` text alone is insufficient after an in-place warm refresh.
  Also require `/app/.next/server/pages`, the target page HTML/chunk, and
  `/app/.next/static` to exist from inside the running container. On August 3
  the server process retained opened files and answered basic HTTP while its
  bind mount showed an empty `/app/.next`; `/dev/harthmere-visual-auth` then
  returned 500 and game pages stalled mid-load. Recreate only the app container
  against the finished artifacts when the build replaced the directory inode.
- A retained stack on custom ports must pass every readiness override. For the
  final-minigames lane this means web `3417`, Sync `5307`, Redis `6493`, app
  `harthmere-final-minigames-app`, and Redis
  `harthmere-final-minigames-redis`. Running bare `e2e-jump.cjs ready` probes
  `3000/3100/6379` and reports a false failure.
- Run all five physical board locations in one authenticated browser context
  and continue collecting failures instead of stopping at the first red row.
  For every row retain: exact image/BUILD_ID, board ID/category/coordinates,
  visible LOD with no fallback, selected F candidate, opened native quest
  surface, browser/network failures, and a screenshot. Rerun only failed rows.
- Before that one context opens, quiesce every earlier software-WebGL page using
  the same app. A second authenticated/observer game tab can leave CDP screen
  capture and DOM inspection timing out while lifecycle and HTTP checks remain
  green. Close only the stale browser contexts, retain the warm stack, and
  retry with one low-memory game tab; do not diagnose the board renderer from a
  browser-control timeout.

### 4.42 Tool-gated gathering, voice 409s, and focused Sync startup

The August 4, 2026 Orchard Softwood incident combined three independent
failures that looked like one broken F-key interaction. Preserve these checks
as separate lanes:

- Native equipment identity is not the same thing as a gameplay requirement.
  Keep the lossless selected item as `b:<BiomesId>`, then have the server
  project trusted Bikkie capabilities such as `isAxe`, `isPickaxe`, or
  `action: fish` into the requirement keys used by gathering authority. Do not
  require an ordinary Wooden Axe to have the exact semantic ID
  `woodcutters_axe`. Test the captured numeric native item, every node gated by
  that tool class, and the no-tool rejection. Prompts should name the compatible
  class (for example, "an axe"), not an internal specialist-item key.
- Group HAR failures by operation before changing a successful gameplay API.
  In this incident the gather request returned HTTP 200; all thirty HTTP 409s
  belonged to voice packet, poll, and heartbeat operations. A voice join can
  itself return HTTP 200 with a room whose state is `closed`. Treat only
  `state: active` as usable, discard the stale cached room/token, and discover
  or create another active room before starting timers. Keep create, list,
  join, and packet fields exact to the Glitch voice contract; undocumented
  compatibility fields make it harder to distinguish a stale room from a bad
  request.
- A focused native-ECS URL must activate the trusted runtime Sync resolver even
  when the production bundle was not built with Glitch-local environment
  flags. Before gameplay assertions, require
  `HARTHMERE_SYNC_URL_RESOLVED` to name `trusted_runtime_e2e_override` and the
  intended local Sync port. Repeated `wss://api*.biomes.gg` attempts or close
  code 1006 mean the browser never reached the local world; fail the shared
  browser context once instead of recording every node as a gameplay failure.
- Keep rendering acceptance separate from interaction-authority acceptance. A
  retained world can expose the real F prompt and production interaction bridge
  while its software-rendered client remains behind the terrain loading layer.
  For a failed-only authority row, the harness may hide only that browser DOM
  overlay and press the real F key, but it must still require server feedback,
  a native drop, authoritative pickup, and depletion. Record the marker's
  `groundStatus`/visibility as not accepted and do not call that run visual or
  terrain proof. The August 4 Orchard rerun used this bounded distinction after
  both headless and headed clients remained `not-loaded`; its action E2E still
  proved the captured Wooden Axe harvested and picked up the authored drop.
- An atomic rebuild can leave the first replacement app attached to an
  incompatible artifact-directory inode even when host/container `BUILD_ID`
  text and `dist/shim.js` bytes match. First prove the reported startup
  invariant passes from source and the finished bundle. After the owning
  refresh exits or rolls back, run exactly one
  `refresh-warm-local-stack.cjs --build none` to recreate only the app mounts;
  do not compile again. Require matching host/container `BUILD_ID` and Shim
  SHA-256, HTTP and Sync readiness, Redis `PONG` and realistic `DBSIZE`, all
  lifecycle services, and zero restart/OOM state before releasing the shared
  browser window.

### Failed-only native player-attack reruns

After the full non-fail-fast player-attack matrix has collected every failure,
rerun only the failed scenario names by separating exact names with `|` in
`HARTHMERE_E2E_ATTACK_SCENARIOS`. Set
`HARTHMERE_E2E_ATTACK_SKIP_PROJECTILE_CATALOG=1` and
`HARTHMERE_E2E_ATTACK_SKIP_PERFORMANCE=1` when those lanes already passed.
The runner recenters the pointer and restores the authoritative/local player
pose before each selected row; do not add a mouse move between target acquisition
and mouse-down because the supported pointerless browser path treats it as camera
input. The feedback modal and Escape overlay checks still run before every click.
Scenario cleanup is part of the row boundary: wait until every deleted fixture is
absent from authoritative ECS, local ECS, `cursor.attackableEntities`, and the
current cursor hit before constructing the next row. An acknowledged delete API
call alone is not enough; a stale rendered NPC can otherwise steal the next
ranged or magic crosshair and create a false product failure.
If an older interrupted run already leaked fixture IDs into the retained world,
pass those numeric IDs through
`HARTHMERE_E2E_ATTACK_PREFLIGHT_CLEANUP_IDS=id1,id2`. The runner applies the
same authoritative/local/cursor absence gate before creating any new scenario;
do not hide a real world NPC behind this option.

### Physical iPhone origin and cache gate

Use the normal LAN web server for physical-phone acceptance. For the retained
3017/4907 stack, enter through visual auth and send the game to:

```text
http://192.168.0.204:3017/at?syncBaseUrl=http%3A%2F%2F192.168.0.204%3A4907&glitch_auto_play=1
```

Do not use the temporary port-3205 AAC proxy for gameplay stability, memory,
reload, or crash acceptance. That experiment overwrites every upstream response
with `Cache-Control: private, no-store, max-age=0` and does not forward WebSocket
`Upgrade`. It therefore produces both of these false failure shapes:

- same-origin `/sync` opens and receives an immediate TCP FIN unless the URL
  explicitly bypasses it with direct port 4907; and
- chunks, models, textures, audio, and API data are continually refetched. On
  the physical iPhone, WebKit resource ids advanced by thousands in seconds and
  WebContent was killed at its ~1.5 GB high-water limit.

Mobile `.m4a` music is selected by the client source and served by the regular
web app, so cache-bypass is not part of the current phone path. Before accepting
a memory result, record all of the following:

1. the exact page origin is the regular web port, not an ad hoc proxy;
2. static responses retain the app's production cache headers;
3. the direct or same-origin Sync handshake remains open;
4. the WebContent PID is stable for the whole observation window; and
5. device syslog contains no `killing_highwater_process`, memory-highwater
   jetsam, reload loop, or context-loss loop.

The August 7 physical combat pass added these harness guardrails:

- The native ECS browser bridge is intentionally localhost-only. A physical
  phone on the required LAN origin must use the complete visual-auth cookie set
  (`BDID`, `BUID`, and `BSID`) from the host for authenticated admin fixture
  writes/readback. Keep gameplay input on trusted device touches; do not add the
  localhost bridge query flag to make a LAN test wait for an impossible global.
- Do not interpolate `await response.text()` into an assertion message whose
  condition may pass. JavaScript evaluates the message eagerly and consumes the
  successful response body before the harness reads its JSON. Read error text
  only inside the failing branch.
- Verify `globalThis.__NEXT_DATA__.buildId` in the phone document. Do not infer
  the loaded client build from a retained container tag or an old mounted inode;
  the August 7 phone loaded `warm-grove-quest-audit-20260807-r3` while the
  retained-container note still identified r2.
- A SafariDriver `invalid session id` after trusted page activity is an
  automation-bridge failure. Replace only the Mac-side session, preserve the
  warm app/Redis stack, and ensure fixture IDs are persisted as soon as they are
  allocated so `finally` can delete them even if local ECS synchronization
  fails.
- Do not run FPS acceptance while an expired Instruments/xctrace recording is
  still attached or while the device reports elevated thermal pressure. Stop
  the stale trace, use a filtered device log, record thermal state, wait through
  the post-load warmup, and then collect the required 20-second idle and
  20-second multi-enemy samples. The first August 7 sample ran at 3-4 FPS while
  a four-minute Activity Monitor trace had remained attached for more than
  twenty minutes; that row is instrumentation-confounded, not a product
  baseline.
- When enabling the built-in Performance API timing scopes on a live page,
  clear completed `measure` entries only. Do **not** call
  `performance.clearMarks()` while the renderer is active: an in-flight
  `PerformanceTimer` may already own `renderInterval-begin`, and deleting that
  mark makes its next `stop()` throw `No mark named 'renderInterval-begin'
exists`, replacing the game with the Unexpected Error overlay. The August 7
  timing row before that exception remained useful, but its subsequent combat
  row was harness-invalid.
- Reuse one stable physical-device test username. Timestamped usernames leave
  a persistent player ECS row after every run; the August 7 harness accumulated
  eight player meshes at one arena, adding measured player-render and remote
  animation cost to every later baseline. Before the next run, scan the admin
  `players` filter, delete only stale `PhysicalIPhoneFight-*` rows, wait for
  authoritative absence, and keep fixture cleanup in `finally`.
- A filtered `idevicesyslog` shell can remain present after the USB stream has
  emitted `[disconnected:<udid>]` and stopped appending. Before treating the
  device log as acceptance evidence, require its modification time and
  timestamps to advance through the exact sample window. Restart only the
  logger if they do not. An empty time-window query is a telemetry gap, not
  proof that WebContent avoided jetsam, high-water termination, GPU context
  loss, or thermal pressure.
- A physical runner result produced with `HARTHMERE_IOS_OBSERVE_ONLY=1` is a
  functional/evidence pass only when trusted input still causes positive
  server-authoritative damage. Observation mode may relax FPS and soak-duration
  thresholds, but it must never skip input, HP, build, readiness, or page-error
  assertions. The August 7 no-diagnostics row exposed the old mistake by
  reporting `status: pass` after a trusted touch caused zero damage; preserve
  that row only as performance evidence and keep authoritative damage mandatory
  in the runner.
- SafariDriver diagnostics have two switches: the session capability and the
  server process's global `--diagnose` flag. Setting only
  `safari:diagnose: false` does not undo a server launched with `--diagnose`.
  FPS acceptance must run a plain `safaridriver -p <port>` process and keep
  diagnostic collection opt-in. Bound `POST /session` independently (45 seconds
  in the physical-fight runner); its native connection path can otherwise hang
  beyond the general WebDriver command timeout.
- Filter `idevicesyslog` by complete process/message patterns. A loose token such
  as `connected:` also matches unrelated daemon payload fields and floods the
  logger, which adds host/USB noise and hides the relevant WebContent lines.
  Require an exact stream marker or the exact jetsam, context-loss, thermal, and
  WebContent state messages needed for the acceptance question.

For dialogue/expression memory work, also record the exact character action
graph before and after the change. The August 5 iPhone regression had 119
actions / 5,712 cloned tracks per NPC and 314 actions / 7,536 tracks per player
while only idle was visible. A valid mobile fix must show non-idle actions absent
before use, present during the authored beat, and uncached after their blend
returns to zero. Desktop should still expose its eager actions.

Do not use a stale `.ips` file as the crash attribution. Match the current game
tab to its WebContent PID from the normal-origin resource log, then require the
same PID in `memorystatus: killing process`, `killing_highwater_process`, and
the RunningBoard `jetsam(1) memory-highwater(2)` exit. A report with a different
victim process is unrelated even when its filename date is recent.

For one-shot expression acceptance, inspect the action after the authored clip
duration. On iOS it must remain on its final frame without another `reset()`;
the guard is timestamp-based because WebKit may leave Three.js `paused=false`
after `isRunning()` becomes false. Mouse/desktop playback is not evidence for
this WebKit state transition.

One representative physical expression plus the focused shared-animation
contract can validate the common completion mechanism used by the 71-expression
catalogue; it does not mean every authored dialogue sequence was traversed.
Record the exact expression name, duration, final `time`, `paused`,
`isRunning()`, and a later unchanged sample. Separately record whether the
intended quest dialogue actually opened. On August 5 the test identity had The
Road Ahead in progress, but F opened Jackie's default line, so that run proved
the shared Jackie expression path and did not prove the complete multi-page
Road Ahead flow.

For real-touch WebDriver actions, use W3C pointer actions with
`pointerType: "touch"`, then release the action source before starting the next
finger. A discrete contextual F action must fire on touch-down: an interaction
candidate can disappear and unmount the button before iOS delivers touch-up.
Do not accept mouse click/drag as evidence for joystick movement, held mining,
camera turning, F, or hotbar gestures.

Also do not accept a successful SafariDriver `/actions` response as proof that
iOS received a touch. In the August 5 dialogue session, a touch pointer sequence
returned success while the page observed only `pointermove`; it received no
`pointerdown`, `pointerup`, `touchstart`, `touchmove`, or `touchend`, and player
orientation did not change. Install a temporary capture-phase event probe and
verify event types, touch identifier continuity, cancellation, and the gameplay
state transition. If the trusted touch sequence is absent, mark the automation
row invalid and use a manual physical touch or another trusted device path.

Do not assume a complete iOS pointer/touch sequence will synthesize `click`.
The physical iPhone produced trusted `pointerdown`, `touchstart`, `pointerup`,
and `touchend` on the BiomesUI, Recipes, and Invite Close buttons without a
subsequent click, leaving all three overlays open. Transient phone controls that
unmount or dismiss UI must perform their discrete action on captured touch
`pointerdown`; retain `onClick` for desktop and keyboard activation, and guard
against a duplicate synthesized touch click. Verify this with a real-touch A/B,
not `element.click()` alone.

Long multi-step W3C gestures can wedge SafariDriver's action-release command
even while the game WebContent process remains alive and rendering. Treat that
as an automation-bridge failure only after independently checking the exact
WebContent PID with sysmon/syslog. Release each action source promptly, prefer
short bounded moves, and restart only the Mac-side SafariDriver bridge when the
page PID is still healthy. Do not label that transport stall a game crash.

For the orientation row, rotate the physical device and query actual CSS
geometry; do not rely on a desktop preset. The iPhone 12 mini measured
`812 x 311` in `landscape-secondary`, which bypassed a `max-width: 768px`
compact-phone rule while still having only 311 pixels of height. Require the
landscape-specific mobile media contract and record rectangles for vitals,
Menu/Recipes/Invite, objective, minimap, joystick, C/Jump/Primary/Place, and the
hotbar. Reject any overlap or off-screen rectangle. The hotbar may intentionally
show only five slots when the remaining slots stay reachable through its native
horizontal pan.

### Business customer F-arbitration incident

The August 4 business HAR contains a successful
`start_business_customer_session` and continued 200 polling, but no
`serve_business_customer` mutation. The failure was before server authority:
the nearby business board registered at priority 15,000 while ordinary native
NPC talk registered at 10,000, so real F reopened BusinessUI instead of talking
to the customer.

Do not repeat the test mistake that hid this. The former business browser runner
wrote `/game_modal = { kind: "talk_to_npc" }` directly; that proved only the
dialog renderer and skipped the keyboard dispatcher and candidate priority.
Every business live row must require the visible current-customer card's
`harthmere:business-customer:<entityId>` candidate to own F, press the real
`KeyF`, assert the management panel stays closed, and only then accept the
business-service conversation. Ordinary NPCs must still lose to a deliberately
targeted board; only the visible serving customer registered to the actor's
active shift receives the higher interaction priority.

The August 5 failed-only Eastgate run also showed why cursor inspection cannot
be the sole business-service path. The authoritative customer reached
`serving`, the synchronized patience bar counted down, and the customer card was
plainly visible, but the moving NPC never produced a stable reticle candidate
before the timeout. Do not require pixel-perfect camera aim at a customer who is
already standing at the service point. Keep cursor Talk as a fallback, but let
the visible serving customer's card register the same real F action directly.
Queued, absent, and off-screen customers must not register that action.

The first direct-card retry exposed a second projection trap. The exact ticket's
authoritative patience value decreased, which can happen only after the server
validates that native customer in `serving`, while the browser's streamed ECS
copy still rendered `Entering`. Gating F only on that local `npc_state` hid the
action for the entire patience window and advanced to later customers. For the
current ticket, accept either synchronized serving source: live native ECS or
the economy snapshot's `spatialPhase`, which the tick API updates only after
validating the exact ticket/entity pair. Continue requiring a materialized,
visible entity, and never grant the action to a non-current queue ticket.

The next retained-world retry failed before talk because an ended customer was
still occupying Eastgate's shared spawn. A read-only RC/HFC audit showed the
root cause: the customer had a newer private `progressAtSeconds` and nonzero
route velocity, but its synchronized position never advanced. Anima applied a
kinematic step locally, then `updateFromExternal()` refreshed that simulator
from a lagging same-phase HFC table row before the table observed the write, so
the same first step repeated forever. This left a pruned-session orphan that
blocked the next shift.

For the same business session, ticket, and phase, merge external authority but
preserve local route fields and HFC movement components when local
`progressAtSeconds` is at least as new as the external projection. A phase
transition must still replace local movement immediately. Test both halves:
an older same-phase projection cannot rewind position/waypoint progress, while
an external `entering -> cancelled` transition must take effect. Do not work
around this with direct Redis deletion or by disabling spawn collision.

Also assert navigation state instead of inferring it from panel presence. Both
the first open and a close/reopen cycle must mark **Overview** selected before
the runner explicitly chooses **In-World Shift**. A direct deep-link to the
shift tab is not evidence for the player-facing board-open contract.

Customer patience is part of the live minigame, not a hidden economy field.
Render one accessible countdown bar on every materialized waiting customer's
world card, using the ticket's authored `patience` as max and the current
authoritative `patienceRemaining` as value. The browser gate must wait for the
same ticket's visible value and economy value to decrease together, capture the
bar before service, and keep the urgency text/colors player-readable. Do not
fake a CSS animation independent of authority, and do not require later queue
tickets to count down before they become the current customer—the server resets
their patience when they advance to the front.

The August 5 Eastgate smoke exposed a scheduler-specific trap after the bar
first rendered correctly at 34/34: the authoritative value never changed. The
reducer already derived remaining patience from `arrivedAtMs`, but the HUD's
two-second interval depended on the live adapter object. State/world-context
updates recreate that adapter, so normal render churn could clear and restart
the interval forever before its first callback. Keep the current adapter in a
ref, key the interval only by business/session identity, reconcile once
immediately, and prevent overlapping requests. A bar that starts at the right
value is not accepted until the same ticket's rendered and authoritative values
decrease together.

The next Eastgate failed-only run proved the countdown must not start at shift
creation. Two customers timed out while still walking the authored entrance
route, and the third was still `approaching_counter`. Keep queue arrival time
separate from `patienceStartedAtMs`: server-validated ECS evidence for the exact
current ticket must show `serving` at the counter before the first tick starts
patience. Later validated ticks decrement from that service timestamp. Never
charge the player for NPC path length, streaming delay, or worker scheduling.

One headed Playwright retry closed its page during initial `/at` navigation
before row one, while app/Redis/Anima stayed healthy and Chromium produced no
crash report. Do not repeat that launch as gameplay evidence. Record it as a
setup-only failure, verify zero rows ran, use the runner's stable headless path
for authoritative input/state acceptance, and inspect its captured screenshots
through the in-app browser. This does not permit direct modal injection or
scripted economy shortcuts; real F and the native customer remain mandatory.

Repeated Eastgate failed-only runs can reveal a retained-route poison rather
than a new customer-create failure. Read the exact prior ticket entity IDs
through `RedisWorld` without mutation. One August 5 run found an hour-old
inactive customer still `cancelled` at waypoint 0 on the shared exterior spawn;
the collision-safe materializer correctly deferred every replacement customer.
Inactive customers cancelled before entering should be deleted at that exterior
spawn, because no player-visible departure remains to preserve. A cancelled
customer already moving through the shop must instead preserve waypoints,
waypoint index, and progress so reconciliation ticks cannot reset it to the
door. Do not purge broad NPC ranges or disable spawn-clearance checks.

Business acceptance is not a combat row. One Eastgate retry passed the fresh
Overview assertion, then the disposable actor died while Playwright was
clicking Close; the death modal hid the button and the failure screenshot read
“passed away after falling asleep.” That player-facing phrase maps to the
native-vitals `suicide` reason used for zero stamina. It is not evidence of a
nearby world attack. Do not accept forced DOM clicks through a death modal,
disable world combat globally, or call that race a business close-button
defect.

An attempted harness fix raised the actor to 1,000,000 HP, but the native
level-stat authority correctly normalized a fresh level-one actor back to
100/100 before row one. Do not repeat that false precondition. At every row
boundary, clone the actor's authoritative `TriggerState`, refill native stamina
and breath, clear underwater state, set the vitals tick timestamp to now, and
restore health only to the actor's real level-owned maximum. Keep the placement
boundary open for the additional bounded stability window; require positive
health and stamina, no death marker, and the exact business position before UI
input. A reused actor can still receive an already-queued respawn after the
first sample, so retire it if that delayed window moves it back to the Grove.

The shared NPC dialog normally hides action buttons until its typewriter
completes. Business service is a timed exception: its request and choices must
share one dialog step and set `revealActionsImmediately`, so the player can act
while the request text types. Do not press F a second time in the live runner;
that can select or dismiss the first visible action and creates false evidence.
Wait for the first authored offer to be visible, then assert the complete offer
set. Do not set internal `typingComplete`, inject action callbacks, add a
`{break}` between request and actions, or skip the player-visible request.

An August 5 production HAR exposed a stronger readiness split: native ECS had
the exact customer at the service point and the server started the patience
clock, but the durable economy ticket remained `entering`. The generic F talk
surface then opened a business dialog with no service choices and only “Stay
behind the counter and let them reach the service point” until patience hit
zero. When exact native session/ticket/position evidence is ready, persist the
ticket phase as `serving` before starting patience. Client HUD, talk registry,
and dialog must consume one effective phase where either synchronized serving
source wins for the current ticket; never show `F Talk` beside an `Entering`
status. Customer route travel remains free, but after service readiness every
generated and skill-adjusted countdown is capped at 30 seconds. Live acceptance
must assert durable serving, a visible maximum no greater than 30, service
choices after real F, and matching authoritative countdown values.

A rendered business panel is not yet a safe player-click boundary if the
full-screen world `.loading-wrapper` can return while `createPlayer` finishes.
Before clicking Close or selecting the shift tab, require the wrapper to remain
absent continuously for one second. This is a harness prerequisite, not license
to force a DOM click through a loading layer. The final August 5 run proved the
boundary by completing Ashline, North Biome Repair, and Glassyard without the
old intercepted-click failure.

If a user stops a non-fail-fast browser matrix, close Chromium and preserve the
partial report, but classify the result explicitly: completed passes, failures
that occurred before the stop, and rows that never began. A shutdown can make
the recovery loop append `Target page, context or browser has been closed` for
every remaining row. Those are interruption artifacts, not product failures.
Never quote the aggregate failure count without separating unrun rows.

The final customer-service UI needs a result gate, not merely a successful
`serve_business_customer` response. One August 5 HAR proved the server paid 33
gold (wallet 153→186), but the dialog closed before showing any verdict or
reward. For every answer, keep the modal open until it visibly says Correct or
Incorrect, names the expected service on failure, and shows gold plus business
points (and any service XP/social/unlock rewards). Exercise both branches in
the live browser before accepting the surface.

Do not pass a polling customer target directly into typewriter dialog copy.
`patienceRemaining` changes every two seconds; if that live object recomputes
`dialogText`, translation state clears and the same sentence visibly starts
over. Freeze the exact ticket/request when the modal opens. The world customer
card owns the changing timer; the decision modal owns immutable puzzle text and
then immutable result text.

The current shift contract is exactly ten customers with patience values
`30,28,26,24,22,20,18,16,14,12`. Assert the entire sequence in authority tests.
For live acceptance, prove the queue contains ten, capture a correct result and
an incorrect result, then use the existing leave-business path to end the
remaining queue safely. This gives the new UI/authority coverage without
turning the 19-business smoke into a 190-customer multi-hour run.

### Mobile AAC asset-only gate (no browser required)

Adding or refreshing mobile AAC variants is a deterministic asset task. Do not
block it on a connected phone or repeat the full Safari acceptance matrix when
the playback graph and selection policy have not changed. Run:

```bash
# Generate missing variants; --force replaces existing outputs.
node scripts/harthmere/generate-mobile-audio-variants.cjs \
  --all --concurrency=12

# Probe all 3,117 outputs for AAC-LC, 48 kHz, channels and duration.
node scripts/harthmere/generate-mobile-audio-variants.cjs \
  --all --check --concurrency=12

# Harthmere manifest plus original/mobile SFX pairing.
node -r ts-node/register -r tsconfig-paths/register \
  scripts/harthmere/validate-harthmere-sound-effects.ts

# Committed speech manifest, source MP3 and mobile AAC pairing.
node scripts/harthmere/check-harthmere-npc-voice-recordings.cjs

node_modules/.bin/mocha --config .mocharc.fast.json \
  src/client/game/util/mobile_audio_variants.test.ts \
  src/client/game/util/mobile_audio_asset_contract.test.ts \
  src/client/game/context_managers/audio_manager.test.ts \
  src/client/components/system/VoiceChat.test.ts \
  src/server/shared/test/npc_voice_audio_cache.test.ts \
  src/pages/api/voices/test/text_to_speech_cache.test.ts \
  src/pages/api/voices/test/voice_api_schema.test.ts

node_modules/.bin/tsc -p tsconfig.ch1renderer.json --noEmit
git diff --check
```

Acceptance requires originals to remain, all declared variants to exist, zero
codec/duration failures, source fallback coverage, desktop source-path coverage,
and aggregate byte reduction. A few sub-second core AAC files may be larger
than Opus because of M4A container overhead; Android continues selecting Opus
for those. Judge the core family in aggregate, not file-by-file.

After generating or replacing NPC voice MP3s, rerun the mobile generator so the
manifest receives fresh `mobilePath`/`mobileBytes` values. Runtime-generated TTS
without a committed catalogue line is allowed to remain provider-native MP3;
it must not fail merely because no AAC sidecar exists.

### Airborne attacks and held-item reach (August 5)

A visible airborne swing is not proof of a jump attack. The canonical rendered
input row must press real Space, then real primary input, prove `onGround=false`
while the attack upper body is active, and finally prove authoritative target
HP changed. Repeat for double jump. A double jump can lift the camera above the
target for a few frames even though the player is still in the same close fight;
the client may retain only the last valid aimed target for a bounded 0.75-second
airborne grace. The target must still exist, be alive, be unprotected, and be
inside the selected item's authoritative reach. After 0.75 seconds, a stale
target must become a whiff. Never accept animation, stamina use, or a damage
number drawn by the client without the ECS HP change.

Melee reach is selected-item authority. Test it as adjacent just-inside and
just-outside pairs, not one arbitrary distance:

- bare hand: 1.75 units;
- legacy held gathering tool: 2.75 units;
- premium melee weapon: authored `targetLength` plus 2.25 units of arm/body
  extension, clamped to 2.8–4.5 units;
- ranged and spell rules remain on their dedicated contracts.

The server must derive the profile from the selected ECS item. A forged event
cannot name a longer weapon or supply a larger radius. For live coverage, prove
bare hand misses where the tool reaches, the tool misses where the one-handed
sword reaches, and the sword misses where the great sword reaches. Run those
boundary pairs with the target on the real crosshair. The separate dedicated
off-reticle row proves the selected sword's visible swing can hit a body outside
the cursor; do not duplicate that fixture inside every distance comparison.
Repeat blocker, behind-player, and target-leaves-before-contact checks so
graphic-derived reach never turns into through-wall or remote damage.
Reset the player and hostile target immediately before each press and record
their measured positions; authored spawn coordinates are not proof that Anima
left the fixture there.

### Chapter 1 marker, dialogue, and plot-item hotfix lessons (August 5)

- Read the HAR as an objective transition. `gather_parts` can grant the Core
  Cell correctly while the UI still retains an older destination. Assert the
  native grant, HUD objective, active marker id/position, and subsequent
  `seat_the_core` interaction together. A player reaching a marker with no
  world pickup does not prove the granted inventory item is missing.
- Generated shop/customer names are not story identity evidence. Correlate the
  entity id and active Chapter 1 step before concluding that AUGUR-9 renamed or
  the quest skipped.
- Staged NPC objectives need an explicit position authority. Never overwrite an
  authored story post with the shared ECS home and then use that replacement
  for the distance check. Marker, puppet, prompt, and Talk routing must share
  the authored post.
- Test Jackie with another accepted quest present. The correct result is the
  Chapter 1 choice; the generic quest action must not appear merely because the
  same NPC has an ordinary dialogue menu.
- Generalize that collision test across the catalogue. Every `talk_npc` and
  `dialogue_choice` objective must resolve a canonical `targetEntityId`, and
  both the global `F` candidate and `TalkToNPCScreen` must consult the same
  ownership predicate. In the live quest campaign, open the ordinary
  `talk_to_npc` modal for every NPC phase; require the Chapter 1
  dialogue/choice/completion surface, not a helper quest, default flavor text,
  business dialog, or unrelated accepted quest. Dynamic routes must repeat the
  check at every testimony/Three Answers stop, not only the first NPC.
- Actionless plot items can be hidden by a generic ACL helper that defaults a
  missing action to `destroy`. Presentation-only Chapter 1 props still need to
  reach the held-mesh loader in protected regions; this grants no gameplay
  action.
- Separate structural and visual item proof. Require exact selection and a
  non-empty attached GLB for all fifteen items, then use the real reverse-camera
  input for a front-facing screenshot. A back view can prove attachment while
  remaining unsuitable for scale/grip approval.
- Frame held-item review cameras from the live attached mesh bounds. Traverse
  the selected `itemMeshInstance.three`, transform each geometry bounding-box
  corner through `matrixWorld`, and derive the target/radius from that finite
  world box. A fixed torso target can pass attachment checks while rendering a
  Core Cell or Case Notes too small to judge. Save the bounds and camera vectors
  in the report so a later task can distinguish a camera failure from a Blender
  scale/origin failure without recapturing all fifteen items.
- Give software-WebGL item-review scenes enough authored time to reach every
  camera, and do not add an opening fade that supplies no item evidence. The
  August 6 failed-only run reached the live Iris Button attachment, then the
  4.8-second review scene auto-ended while the runner was still waiting on a
  stale DOM fade opacity. Use long test-only shots, gate on the real waypoint
  camera, and rerun only the affected item id; this is a harness hotfix and
  does not require a Next rebuild.
- A finite attached bound is structural evidence, not visual approval. The
  August 5 all-item batch passed while every detail frame showed the avatar's
  sleeve instead of the selected prop. Review the PNGs. Keep one normal
  reverse-camera grip frame, then hide only non-item player meshes for the
  generated front/left/right detail frames; preserve the exact live
  `itemMeshInstance.three` and fail if no body mesh was isolated. If all items
  share one sleeve silhouette, inspect the Blender source dimensions before
  rebuilding assets. Metric, distinct GLBs that become 4–7 cm after the avatar
  socket need a shared presentation-scale hotfix, not fifteen asset rewrites.
- Keep the Chapter 1 browser matrix non-fail-fast. A red wrapper report can
  contain passed product groups plus a cleanup or bootstrap failure. Record the
  boundary precisely, continue all groups when the runtime remains valid, and
  rerun only affected groups on the exact final artifact.

### Chapter 1 delegated-interaction audit (August 5)

Do not assume every Chapter 1 objective should own a map marker and `F` prompt.
Audit each step against exactly one interaction surface:

- `open_the_tab` is owned by BiomesUI. It must publish no world target or map
  marker, highlight `J`, queue a highlight for `MEM — Recovered`, and complete
  when the real Recovered tab mounts.
- `take_jobs` is owned by the physical Grove Jobs Board until three authored
  jobs are complete. The board keeps its normal world prompt, but the open
  panel must replace generic content with the three Chapter 1 templates.
- every other Chapter 1 step is owned by the high-priority Chapter 1 world
  candidate unless its evidence requirement deliberately delegates to another
  existing surface such as a supplier transaction.

The HAR classification is important. A player standing at a marker beside an
invisible `F Read` prompt can mean the objective was incorrectly modeled as a
world object; do not immediately rebuild a prop in Blender. Compare the active
step, `targetLabel`, `showNavigationAid`, interaction owner, and completion
request first.

A repeated quest-level marker id does not make the persisted destination
current. Location-less fallback anchors may intentionally keep
`native_quest:<questId>:<questId>` across several leaves, while their label and
resolved world position change. On every native objective handoff, compare the
stored pin's `ownerStepId` and player-facing label as well as its marker id; if
the objective changed, rewrite the complete pin. Also compare X/Z: an async
native navigation aid can replace an initial player-position fallback without
changing the marker id, label, or objective. Compare horizontal coordinates
only because collision grounding may legitimately alter Y by a few metres, and
use the chapter's existing 3.25-metre safe-warp tolerance for horizontal terrain
resolution. The winter Longhouse pin landed 1.06 m from its authored marker;
the Ash Hall safe approach was offset two metres on both axes (2.83 m total).
Both preserved the exact quest id and label and were valid navigation.
The August 6 dungeon run
otherwise left “Cross the Dunes” pinned at `[496, 69.875, -126]` after native
ECS, the marker list, and the HUD had all advanced to “The Salt Market” at
`[2692.5, 81, -307.5]`.

Checkpointed Chapter 1 acceptance must also judge progression from the exact
native `currentStepId` and HUD objective. Do not require a map pin for
BiomesUI-owned steps such as `open_the_tab`. Treat a canceled request as
transient only when it is the exact same-origin hashed `quest-main` icon being
unmounted or the canonical hashed world-theme `music-1` WebM being replaced
during a Chapter 1 transition; broad `ERR_ABORTED` suppression hides real
network failures.

Release a failed focused actor's Chapter 1 slot before launching its checkpoint
continuation. The production lease correctly survives a disconnect for three
minutes, but that safety window makes a new test actor receive “another party
is inside.” Cleanup must release the exact failed actor from the exact dungeon
claim and clear only that actor's persisted active-run fields. Never delete all
slot keys or reset Redis to make the next test pass.

A 400-metre escort is not a 40-second interaction transition. Do not teleport
or lock a companion at the extraction point to make the gate pass: that races
Anima, bypasses terrain/pathfinding/combat recovery, and can be overwritten by
the legitimate escort tick. Move the player through the production objective,
then give the required companion a bounded three-minute window to reach the
same authoritative 22-metre completion radius. Region-music replacement may
cancel only the exact hashed `music-1` or `muck-music-1` WebM request; keep all
other audio/network aborts release-failing.

Vendor acquisition must buy enough valid vendor bundles, not exactly one test
bundle and not an arbitrary item count. The desert checklist's food requirement
fit inside one 16-ration bundle, while winter requires 20; one bundle leaves it
short, but asking the vendor for an ad-hoc count of 20 correctly returns
`invalid_vendor_bundle_count`. Derive `missing` from native inventory and buy
`ceil(missing / bundleCount)` real bundles.

Keep internal ids out of player copy. Exact ids are allowed in data attributes,
logs, tests, Redis, and mutation payloads. Titles, descriptions, error reasons,
button text, option text, and HUD objectives must use authored labels. Add a
catalog-wide test for raw `item_`, `frag_`, and `ch1_` tokens, then test the
specific failed mutation path from the HAR; a clean catalogue cannot protect a
server-generated error string.

Fill the account's normal accepted-job allowance before the Chapter 1 board
test. The three authored town auto-postings must remain visible and acceptable
through their own three-job lane, while a seventh generic job must still be
rejected. Match the full posting authority (`town`, `harthmere_grove`,
`autoPosted`, exact template id), not the template id alone; otherwise a
player-authored imitation can bypass the normal cap or count as story evidence.

Use the focused batch before any browser or build:

```bash
NODE_OPTIONS="--max-old-space-size=8192" \
  node_modules/.bin/tsc -p tsconfig.ch1interactions.json --pretty false

NODE_OPTIONS="--max-old-space-size=8192" \
  node_modules/.bin/tsc -p tsconfig.ch1check.json --pretty false

NODE_OPTIONS="--max-old-space-size=8192" \
  node_modules/.bin/tsc -p tsconfig.ch1renderer.json --pretty false

node_modules/.bin/mocha --config .mocharc.fast.json --timeout 30000 \
  src/shared/harthmere/test/ch1_dialogue.test.ts \
  src/shared/harthmere/test/ch1_objective_audit_fixes.test.ts \
  src/shared/harthmere/test/ch1_objective_evidence_and_world.test.ts \
  src/shared/harthmere/test/harthmere_readable_names.test.ts \
  src/shared/harthmere/test/ch1_live_story.test.ts \
  src/shared/harthmere/test/mmo_jobs_board_auto_seed.test.ts \
  src/client/components/challenges/Chapter1NativeObjectivePrompt.test.ts
```

The first `tsconfig.ch1interactions.json` run builds
`tmp/ch1interactions.tsbuildinfo`; later runs reuse it. On August 5 a direct
repository-wide `tsc -p tsconfig.json` exhausted the default 4 GB heap after
about eleven minutes. That is a test-lane failure, not evidence to edit product
code or start a full rebuild.

### Combat lock-on and production FPS acceptance (August 5)

The `last_battle` production capture established a repeatable false-green risk:
the game renderer can be healthy while hidden UI previews continue driving
their own WebGL/requestAnimationFrame loops. In that capture six
`ThreeObjectPreview` renderers appeared immediately before FPS fell to 3 and
Chrome reported 855 long requestAnimationFrame handlers. A source test or root
HTTP probe does not cover this failure.

Run the lock-on/FPS browser batch with the real rendered canvas and these rules:

1. Wait until `.loading-wrapper` is absent continuously, the feedback modal is
   closed, the canvas is visible, and the player/NPC projections are current.
2. Open and close inventory/character/social preview surfaces before combat.
   Hidden previews must release their WebGL renderer and stop full-rate RAF work;
   only a currently visible preview may own a preview renderer.
3. Press real `Tab`. Assert
   `window.__harthmereCombatLockOnDebug.active === true`, record the exact
   target offset/entity id/label/world position/sequence, and capture the subtle
   target ring on the same rendered enemy. A second real `Tab` must release it.
4. Initial acquisition must prefer an eligible visible target near screen
   center, with distance/threat/boss weighting. Civilians, merchants, passive
   actors, dead actors, and out-of-range actors are never valid targets.
5. While locked, prove the camera smoothly frames both player and target, the
   player faces the target, W/S advance/retreat, and A/D strafe around it. Wheel
   switching under pointer lock must select the next target in screen order and
   must not also change the hotbar.
6. Use real primary input for standing, running, jump, double-jump, dodge, evade,
   and roll attacks. Lock-on may aim the chosen target, but it never bypasses the
   selected item's server-authoritative reach, line-of-sight, protection, health,
   ammo/mana, or paid-release receipt checks. Prove the hit with authoritative
   ECS HP and inventory changes.
7. Kill, despawn, occlude, and move the target beyond hold range. Brief camera
   crossings receive only the 1.25-second grace; invalid/dead/missing targets
   auto-release. A stale lock must not swallow a valid attack on the next cow.
8. Keep the complete matrix non-fail-fast. Separate product failures from setup,
   authentication, stale-artifact, loading-overlay, or duplicate-session errors.

For performance evidence, collect at least 20 seconds before combat and 20
seconds during a multi-enemy fight after preview surfaces were exercised. Record
FPS percentiles, long-frame count, active WebGL renderer names, console/page
errors, and Chapter 1/Glitch request counts. The August 5 hotfix target is no
hidden `ThreeObjectPreview` RAF loops, no duplicate Glitch bridge timer stack,
and materially fewer Chapter 1 state POSTs; outer `www.glitch.fun` ads/YouTube
work must be reported separately because it is not game-source work.

Two additional false-attribution guards came from the final Chrome rerun:

- A restricted or detached Chrome document can reject Pointer Lock with
  `WrongDocumentError: The root document of this element is not valid for
pointer lock.` Treat that as terminal for the current gesture, focus the
  canvas, and stop the 125 ms retry timer. Retrying for five seconds creates a
  console/main-thread flood and makes a setup limitation look like a combat
  frame defect.
- Record host CPU pressure beside the FPS sample. On August 5 the direct local
  game had exactly one `game` WebGL renderer and no preview renderers, while a
  forced `low`-quality A/B remained at 14 FPS. The host simultaneously had the
  Docker VM, another Chrome renderer, Codex, Claude, a React test, and three
  snapshot scans consuming sustained CPU. That run is valid input/functional
  evidence but not a valid graphics-quality comparison. Do not respond by
  globally downgrading bloom, SSAO, flora, or entity limits when the low preset
  produces no improvement; first repeat the same 20-second sample after
  unrelated compilers/scanners release the host.

Tab lock ownership is also a module-load contract. The production key path must
install before replacement-HUD focus listeners, call the same lock state
machine as the React controller, and stop propagation only for an accepted
unmodified `Tab`. A green React-hook unit test is insufficient if a real canvas
`Tab` never publishes `window.__harthmereCombatLockOnDebug`.

The August 6 lock/fight capture (`www.glitch.fun-1786021341741`) added four
specific acceptance rules:

- Do not feed the camera raw 10-12.5 Hz ECS target steps. Reset the smoothed
  target only on a new lock, then filter same-target movement every rendered
  frame and bound yaw/pitch angular velocity. Sample camera yaw while holding
  A/D around one stationary Mucker; reject direction reversals or single-frame
  turns above the configured rate.
- While lock-on owns orientation, free-look input must not write an orientation
  first and then be corrected by lock-on in the same frame. Confirm free look
  resumes immediately after the second real `Tab` releases the lock.
- Circle behind a Mucker/Hex during its visible windup and record player HP,
  the committed cast yaw, and the eventual receipt result. A rear whiff is not
  proven by animation alone; authoritative HP must remain unchanged. Repeat at
  night, where an old 175-degree override used to make flank/rear avoidance
  impractical.
- Creature ease-of-hit is a horizontal combat AABB allowance, not a collision
  resize or extra weapon reach. Test the same just-outside edge against a
  native creature and a player-like NPC: the creature receives the 0.18 m
  allowance on both client selection and server validation, while the
  player-like body remains exact. Floor/ceiling separation must remain
  unchanged.

For FPS, record the effective dynamic draw distance rather than only the chosen
quality label. This capture stayed at 128 m and render scale 1 while reporting
210 low-FPS samples (median 12), 1,337 long RAF handlers, 1,098-1,178 live block
meshes, roughly 204 MB of flora vertex buffers, and 1.5-1.6 GB JS heap. The
desktop emergency floor is now 96 m; validate that sustained sub-24 FPS can
reach it and compare retained terrain/heap after stabilization. A green HAR
status table is not performance evidence—the capture had only two failed
requests, both unrelated advertising beacons.

### Fast business-result hotfix lane (August 5–6)

For correct/incorrect business feedback changes, do not rerun 190 customer
interactions. Run the complete affected unit/E2E batch once, fix the full
failure list, rerun failed tests only, then use one representative business row
because all 19 businesses share the same result dialog and economy authority.
That live row must cover one correct answer, one incorrect answer, explicit
reward values, stable copy across the two-second poll boundary, the immediate
Continue action, three-second automatic advancement, the complete ten-customer
`30..12` timer ladder, native departure, and shift termination by leaving.

Do not serialize the previous NPC's full exterior walk before interacting with
the next customer; monitor departure concurrently or the harness itself burns
the next customer's fast timer. Before retrying a native-movement failure,
require the dedicated Anima `/ready` probe, HFC bootstrap marker, bounded CPU,
and a progressing authoritative position. A hung focused worker is setup
evidence, not permission to weaken movement assertions or repeat the same run.

### Grove and Jobs Board stale-evidence hotfix lessons (August 5)

- Treat every asynchronous Grove callback as evidence for one exact objective
  generation. Capture both the objective index and authored trigger before the
  async boundary, compare them again immediately before mutation, and send them
  to server authority. The server must reject `arrived_at_marker` for anything
  except `near_location`; otherwise a delayed arrival callback can complete the
  next `collect` step, as the Billy lunch-pail HAR demonstrated.
- Audit the whole Grove catalogue, not only the reported quest. A regression
  test must try mismatched trigger evidence against every authored objective so
  another adjacent `near_location -> collect`, `interact -> talk_npc`, or
  inventory transition cannot inherit the same race.
- An escort destination needs a minimum route distance from its board. A valid
  marker eight metres from the spawn is not a valid escort. Resolve the
  destination through the shared marker registry, assert the map/quest copy use
  the same human name, and prove the companion's arrival response is delivered
  once before the quest routes back to the board.
- Preserve the exact synthetic marker id across the Jobs Board quest and map
  adapters. For material jobs, test the complete player path: missing item ->
  locatable source marker -> freshest authoritative inventory -> return-board
  marker. Descriptive source copy without an exact marker-id match is another
  false green for “Show on map.”
- Reuse `harthmereMaterialAcquisitionPlan` for item requirements that lack a
  Jobs Board-specific override. Catalog tests must reject the generic
  “gathering, crafting, vendors, or loot” fallback and require a finite marker
  id or position for every auto-seeded and business-template item job.
- Keep small live-response event tests out of the full BiomesUI adapter import
  graph. The fast single-file lane does not install Next's `/public/*` image
  loader, so importing inventory icons can fail before the event test runs.
  Test the response dispatcher in its own file; use the documented `ui`/`icons`
  lane when the rendered adapter or static assets are actually under test.
- Do not start the live browser while an existing warm-stack refresh is between
  its static-asset swap and lifecycle restart. During the August 5 rerun, SSR
  returned the new page while several referenced Next.js chunks returned HTTP
  400, leaving Chrome on the Biomes loader. Require web, logic, sync, trigger,
  shim, and bikkie to report ready; require the root HTTP probe and native sync
  port to pass; then reload the page once so its HTML and chunk build ids come
  from the same completed refresh. A chunk-400 loader stall during that window
  is setup evidence, not a Grove/Jobs Board product regression and not a reason
  to launch another rebuild or clear retained Redis state.

### Grove Chapter 1 completion and supplier hotfix lessons (August 6)

The `www.glitch.fun-1786020403994.har` capture and the 07:40–07:52 Grove
screenshots exposed one connected failure family. Keep these checks together:

- A successful fallback-world `F` response is not an item grant. Garden Edge
  Berries must produce one actor-bound native `inventory_exchange`, refresh the
  returned live inventory snapshot, keep the Road Rations todo active at the
  source, and move its map destination back to the Jobs Board only after six
  berries exist. Never call `complete_job_quest` from the berry source.
- Tool ownership in live mode comes from the latest server inventory and
  equipment snapshot. Reading only the local fallback bag leaves “Buy Muck
  Rake” pinned after a successful purchase. Test both the owned and removed
  snapshots; the map must advance and regress respectively.
- The Chapter 1 board is a separate three-job lane. While `take_jobs` is
  active, render only the three exact auto-posted Grove templates, even when
  the player has reached the ordinary accepted-job cap. A fourth Chapter 1
  accept must show a human message instead of `chapter1_active_job_limit`.
- `meet_the_suppliers` delegates completion to the real vendor transaction,
  but the stock NPC modal must still show one explicit Chapter 1 “Trade with
  <name>” action. Do not let tutorial quests, helper work, generated chatter,
  or ambient dialogue obscure what counts. Route Rin, Fern, Gus, Carlo, Mel,
  and Luis from the authoritative next-missing transaction and require the map
  target to advance after each purchase or sale.
- The native trigger marker is only a generic anchor for a multi-person route.
  During `meet_the_suppliers`, `collect_testimonies`, and `the_three_answers`,
  publish the authenticated current route stop as a distinct active pin owned
  by the same quest and step. The ordinary auto-destination effect must preserve
  that exact pin rather than rewriting it to “Meet the Suppliers” or another
  generic step anchor. Browser acceptance must match the NPC label, X/Z target,
  world-map pin, and minimap marker at every stop.
- A direct cast name follows the per-player staged body. Generic Jackie/Doc
  targets must not resolve to an old static landmark after staging moves the
  visible actor. Step-specific authored posts still win for cinematic beats.
- Deduplicate helper quest projections by objective kind, not giver entity.
  Two NPCs offering the same Muck Breach Boss objective should produce one
  journal row while distinct food/water, exotic-matter, and boss objectives
  remain separate.
- A visible interaction needs a visible object. The Garden Edge resource must
  be a broad, waist-high berry thicket above the flower bed; four ground-level
  stones are not acceptable visual evidence. Likewise, both the shop icon and
  the equipped first/third-person Muck Rake must use a readable long-handled
  rake/hoe presentation. Changing only the icon is insufficient: the native
  Bikkie presentation donor must be the authored Wooden Hoe, never the squat
  robot-like Muck Buster.
- Protected-region ACLs may forbid a cleanup/repair action, but they must not
  remove the selected Muck Rake or Repair Mallet from the held-item renderer.
  Test visibility and usability separately: require a non-empty attached mesh,
  then use the exact tool at its marked field prop and require the native server
  receipt, completed todo, board-return pin, turn-in, and wallet reward.
- Custom Grove/Jobs Board completions need the same feedback quality as native
  level-up/quest stingers. Queue a four-second celebration, show the quest
  title and human-readable rewards, and deduplicate only the same completion
  id so simultaneous legitimate completions play serially.
- Reward copy may contain semantic ids internally, but the banner, journal,
  HUD, dialogue, errors, buttons, and tooltips may not expose `item_`, `ch1_`,
  raw numeric/Bikkie ids, or rejection tokens.

Run the source gate as one non-fail-fast batch. If it reports a short failure
list, retain all passing rows and rerun only those exact tests:

```bash
scripts/harthmere/t.sh quests
scripts/harthmere/t.sh ui
scripts/harthmere/t.sh icons
scripts/harthmere/t.sh ch1

NODE_OPTIONS=--max-old-space-size=8192 \
  node_modules/.bin/tsc -p tsconfig.ch1interactions.json --pretty false
NODE_OPTIONS=--max-old-space-size=8192 \
  node_modules/.bin/tsc -p tsconfig.ch1check.json --pretty false
NODE_OPTIONS=--max-old-space-size=8192 \
  node_modules/.bin/tsc -p tsconfig.ch1renderer.json --pretty false
```

This batch changes client/Next API code and immutable public assets only. Use
one exact-public-env `refresh-warm-local-stack.cjs --build next`, retain Redis
and Anima, and do not build an image or reconcile terrain. Live acceptance is
one warm, non-fail-fast context covering the three jobs, all six suppliers,
Doc/Jackie override controls, berry visibility/grant, tool purchase marker
handoff, rejection toast, journal uniqueness, and completion celebration.
For `meet_the_suppliers`, fixture-injected `vendorTransactions` are checkpoint
setup only and are not acceptance evidence. The browser must open each real NPC
dialogue, show `Trade with <name>`, open the vendor panel, complete a real buy
or sale, and then prove the active world-map and minimap pin advances to the
next supplier.

For a bounded Chapter 1 supplier rerun, `RESUME_AFTER` and `STOP_AFTER` do not
by themselves suppress the runner's independent item, catalog, cutscene, gate,
terrain, and cast matrices. Always set the feature filter as well:

```bash
HARTHMERE_E2E_CHAPTER_1_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=quests \
HARTHMERE_E2E_CHAPTER_1_SKIP_VIDEO=1 \
HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER=ch1_a2_q02_work_the_board/take_jobs \
HARTHMERE_E2E_CHAPTER_1_STOP_AFTER=ch1_a2_q02_work_the_board/meet_the_suppliers \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

If the first new artifact is named `chapter-1-held-item-*`, the supplier run is
mis-scoped: interrupt it immediately, preserve the partial files as
setup-invalid evidence, and restart only after adding
`HARTHMERE_E2E_CHAPTER_1_FEATURES=quests`. Do not wait for the unrelated visual
matrix to finish and do not count any partial captures as supplier acceptance.

### Jobs Board parcel, gather, and business-input hotfix lessons (August 7)

Keep these as one non-fail-fast acceptance batch because they share the same
inventory -> quest projection -> map handoff boundary:

- A successful physical pickup can update native inventory in the same response
  as Jobs Board state. Normalize the Jobs snapshot, then merge the response's
  `inventoryLootState` before caching it or dispatching the Jobs Board update.
  Dispatching the stale snapshot first can immediately re-pin the parcel/tool
  source even though the item is already visible in the native hotbar.
- Do not let a test fixture overwrite an authored fixed pickup. Run the Coop
  always starts at `coop_supply_box`; only its supplied drop-off destination is
  randomized. Fixture defaults use nullish assignment so an authored pickup id
  survives.
- A gathering interaction may grant more than one unit. Record native inventory
  before `F`, require a positive delta afterward, and stop interacting as soon
  as authority reaches the requirement. Trying to approach a correctly hidden
  depleted source again is a harness failure, not evidence that the prop is
  missing.
- Reused actors can retain the same item in backpack and hotbar. Exact inventory
  reset must remove every matching stack, not return after the first match, or
  a six-gather row can begin with hidden progress and produce a false count.
- Gathering six berries does not complete Stock the Road at the source. Require
  the visible thicket, native count, source removal, world-map and minimap
  handoff to `harthmere_market_posting_board`, then move to that board, turn in,
  verify item consumption and native wallet reward. This job has no forge
  recipe.
- A business board owns keyboard input only while its physical prompt is in the
  player's view and within the bounded interaction radius. Keep the clickable
  fallback for discovery, but test a patron and worker beside the board: faced
  `F Talk` must win when the board is off-camera or outside `3.25m`.
- Do not infer that a production screenshot contains the current source. Record
  the page build id from the HAR. The August 7 capture used
  `50b9f486f2201c5cee492c3c1184460f0814d7da`, which still contained the old
  robot Muck Rake art. Source/unit proof is not deployed visual acceptance.

Run `scripts/harthmere/t.sh jobs`, the business-interaction focused tests, the
quest/world-object preset, runner syntax, and the all-jobs static browser
contract as one batch. Allow all commands to finish and fix the complete list
before rerunning. The live rows may run in separate Chromium groups, but tests
that mutate the same app/sync/Redis fixture lane must retain the lane lease;
different browser processes do not make shared actor/Redis mutations isolated.

### Business counter, stuck selection, and camera hotfix (August 6)

The `www.glitch.fun-1786040259819.har` capture connected three apparently
separate symptoms. Treat them as one business-interaction acceptance batch:

- A customer's spatial phase does not prove where the player is standing. Do
  not render “Stay behind the counter” from `entering` or
  `approaching_counter`; report the customer's movement instead. The backend
  remains the authority for an actual wrong-side service attempt.
- The authoritative player position is the centre of a collision capsule, not
  the visible feet. Counter-sidedness needs a small body/contact tolerance.
  Keep the real customer point, queue slots, doorway, and far wall rejected for
  every one of the 19 audited interiors.
- A background `tick_business_customer_session` may not own the foreground
  business-action queue. The capture had one tick blocked/unsent for roughly
  30 seconds and the subsequent `serve_business_customer` blocked/unsent for
  another roughly 30 seconds, leaving the button on “Working…”. Permit only one
  tick in flight, put it on its own serial scope, abort it after 5 seconds, and
  bound a foreground service attempt to 8 seconds. A timeout must clear the
  pending button and show a human retry message.
- A fixed service-counter conversation should not continuously retarget the
  third-person NPC camera while ECS position updates arrive. Business question
  and result dialogs opt out of NPC camera focus; ordinary NPC conversations
  retain their existing camera behavior.
- A served customer turns toward the first exit waypoint before translating.
  The authored departure lies roughly twelve metres outside the door; after
  the customer has visibly walked eight metres outside, snap the final
  off-screen four-metre segment to the exact departure anchor. This prevents a
  reduced far-NPC tick rate from leaving an active shift blocked on an
  invisible departing body while preserving exact safe-despawn evidence.
- A focused browser actor intentionally teleports across distant business
  districts. Keep the product's recent missing-shard recovery marker armed for
  that test tab, just as the native-ECS catalog runner does; otherwise the
  player controller can erase the marker after one loaded district and hard
  reload a healthy board interaction back to `/at` while the next terrain ring
  catches up. A loader timeout after the real panel opened is setup evidence,
  not a business-service failure.
- Require the initial gameplay loader to clear before the first business row.
  If both a retained interior position and a freshly created canonical-start
  actor report `presentTerrain: undefined` and stall at `terrain_meshing`, the
  retained world is not a valid browser fixture. Do not loop customer tests,
  hide the loading wrapper, or misreport that as a business interaction
  failure; repair or replace the terrain-bearing snapshot first.

Run all affected files in one Mocha process and keep Mocha's default
non-fail-fast behavior. The bootstrap-free lane cannot load the UI image shim
for `businessInterfaceLiveAdapter.test.ts`; a `default-challenge-icon.png`
module error means zero tests were collected and must be rerun under the normal
bootstrapped config, not counted as a product failure or worked around by
dropping that file.

### All-Grove quest guidance and visual audit lane (August 7)

Do not validate a Grove repair only on the quest named in a bug report. The 51
quests share the same offer queue, objective reducer, map pin, contextual HUD,
native challenge projection, and completion handoff, so one bad adapter can
strand many unrelated rows. The fast `grove` preset must include the per-state
catalog contract as well as topology/waypoint tests; the `quests`/`gate` lanes
must include the active-pin and rendered Map-panel contracts. A new quest then
inherits the same accept, monotonic progress, marker cleanup, reward
idempotency, and exact-current-pin checks automatically.

Before opening Chrome, regenerate
`artifacts/grove-quest-audit-manifest-2026-08-07.json` with
`node scripts/harthmere/write-grove-quest-audit-manifest.cjs`. It must contain
exactly 51 quests, 255 objective rows, and every currently authored trigger
family. Each row is the single source for the native quest/step ids, giver ECS
identity, exact marker and grounded pose, target list, completion event, signed
world-receipt requirement, item/recipe identities, Chapter 1 dialogue policy,
structured reward, acknowledgement copy, and current/completed screenshots.
The browser runner must refuse to start when this manifest is incomplete or
drifts from the catalog.

Run the executable retained-build hotfix contract before a browser batch. A
string grep is insufficient: the test must press F against an exact native
prompt and prove `collect`, `item_grant`, and `interact` cross the signed
world-object endpoint, emit the authored local event shape, and publish native
Grove evidence only after success. It must also prove ordered Cloud cursor
repair, Chapter 1 precedence/release, completion acknowledgement, and cooking
Ready promotion.

Run tests and fixes in batches. Let every test in a batch report before editing,
group failures by their shared boundary, fix the complete group, and rerun that
group before expanding the catalog. Do not launch 51 slow visual rows after the
first row already proves a shared pin or dialogue defect; keep the completed
evidence, repair the common cause, then continue with fresh actors.

The physical browser tier uses the production-shaped local stack, never the
public site. A public HAR/screenshot is baseline evidence only. Record the local
BUILD_ID, web/Sync readiness, and Redis world identity before the first row.
Prefer the client mutable-hotfix/script lane for a browser-only repair on an
already-built candidate; keep the BUILD_ID unchanged and back-port the exact
change plus unit tests into source. Rebuild Next once only when the behavior
cannot be represented safely by the hotfix layer.

Every slow visual quest row gets a fresh actor/context. Reusing one actor lets
death state, accepted quests, inventory, native `Challenges`, or a prior NPC
projection leak into the next row. Focused setup may retire other quests from
the same giver so the requested row is visible under the shipped two-offer cap,
but it must not raise the cap or change product ordering. Each retired quest
still needs its own independent browser row.

The row verdicts are mutually exclusive: `physical_pass`, `functional_fail`,
`visual_fail`, `setup_invalid`, and `not_run`. A timeout inside `openUser` or
before the world-bootstrap checkpoint is `setup_invalid`, never a quest
failure. Close the failed WebGL context, retry setup once with a new actor, and
continue the non-fail-fast batch. Leaking failed contexts caused the fourth and
fifth rows of the August 7 batch to time out before gameplay and made Kit and
Carlo look broken without testing either quest.

Freeze the candidate before the all-51 run: record the mounted BUILD_ID,
hotfix SHA-256, runner SHA-256, audit-manifest SHA-256, active Bikkie/asset
version, Web/Sync endpoints, and Redis world identity. No source or hotfix edit
is allowed during that pass. An older quest pass becomes stale whenever a
shared candidate hash changes.

Treat quest geography as a product contract, not decoration. Resolve every
Grove marker through the checked-in production terrain placement map; the
fountain's flat Y=71 plane is not valid at Mosslawn, the muck edge, Luis's
cart, or the chapel. Resource landmarks must have unique world positions. If
the copy says "at the muck edge", "further in", "lost", or names a route, the
pickup must require meaningful travel from the giver rather than spawning at
their feet. Keep one spatial test for the whole resource catalog and focused
distance/separation assertions for multi-sample quests such as Sticky Medicine
and Samples for the Chapel.

Chapter 1 dialogue ownership is time- and target-scoped. While the active
Chapter 1 projection names an NPC with a `talk_npc`/`dialogue_choice` trigger,
that story copy must preempt Grove offers, ambient chatter, and native quest
text. During `meet_the_suppliers`, the Chapter 1 trade instruction also wins.
As soon as the projection moves to another target or leaves that phase, normal
Grove dialogue must return. Test both halves; an assertion that Chapter 1 can
override without proving it releases the NPC merely trades one dialogue leak
for another. Mutable hotfix bridges must wait for the normal Chapter 1 routing
effect and must never advance Grove talk objectives while Chapter 1 owns the
modal.

For every objective, require all of the following before counting it:

- the local Grove state names the requested quest and exact objective index;
- the active map pin names the authored current marker, not a generic native
  `Talk to Jackie` fallback;
- a native quest writer cannot clear or overwrite that Grove-owned pin while
  the Grove quest remains active;
- the control needed for the current trigger is visible, highlighted, enabled
  only in range, and stops highlighting after authoritative progress;
- the action reaches native ECS, Cloud Save/live state, and the synchronized
  frontend projection;
- the `current` and `completed` screenshots are captured, and any authored GLB
  marker reports `visible` plus `authoredAssetLoaded` before its visual frame;
- the final giver acknowledgement removes the completed journal row and grants
  each structured reward exactly once.

HUD guidance must name an action the player can actually perform now. An
`open_tab` mail step may pulse Mail, an equipment step may pulse Bag, and a
recipe step may pulse Craft; a world `collect`/`item_grant`/`interact` step must
not pulse Bag merely because its prose contains “sample”, “item”, or “root”.
The next objective must replace or clear the prior pulse, and a hotfix must
de-duplicate the source prompt rather than stacking a second copy over it.

When a mutable hotfix moves a world quest object, move the complete interaction
contract: map pin, rendered/authored group, proximity target, visible F prompt,
and the action event. A screenshot of the relocated mesh is insufficient if
the old invisible interaction anchor still owns F. The focused browser row must
approach from a safe viewing ring, assert the exact marker's prompt, press F,
and prove native ECS plus persisted progression before the move is accepted.
The hotfix action must use the signed `world_object_interaction` receipt; a
client-only `snapshot_grove_practice_action` can cross off the lesson without
granting the native quest item and will strand the following recipe/handoff.
After that receipt succeeds, publish the matching GardenHose Grove evidence so
the local lesson and native Challenge consume the same authenticated action.
Do not publish it before or after a rejected receipt.

Cloud Save repair is a cursor repair, not only a completion repair. Compare the
active local objective with the persisted `active[questId].progress`, then
replay each missing authored objective in order with its exact trigger evidence
before attempting completion. A one-step local lead such as Lost Mail must not
remain crossed off locally while Cloud Save still points at the prior step, and
a multi-step stale tab must not jump over the server's prior-objective guard.

Cooking readiness is wall-clock state. Read-only farming/food snapshots must
tick queued jobs with the current time rather than the last persisted mutation
time; otherwise a finished campfire recipe remains `cooking` forever until an
unrelated write occurs. Browser tests must poll through `Ready`, click
`Collect`, and verify the output plus quest evidence. An immediate `Queued` or
`Working` screenshot alone is not completion proof.

Chapter 1 owning an NPC's visible dialogue does not erase compatible Grove
talk evidence. Keep Chapter 1 copy on screen, but let the exact overlapping
Grove connector step observe that same NPC conversation in the background.
Blocking the Grove event to protect the text makes Luis/Father Aldren handoffs
uncompletable; replacing the Chapter 1 text to advance Grove is equally wrong.

When the native Road Ahead panel and a Grove contextual action coexist, render
the Grove card first. Appending it below a long native objective list can make
the action technically mounted but clipped below the viewport, which is still
an uncompletable quest. The rendered Map test must assert both panels exist and
that the Grove action precedes the native active-quest panel.

The exhaustive acceptance is two complementary browser passes: a fast all-51
authority catalog and slow visual groups with
`HARTHMERE_E2E_FAST_GROVE_CATALOG=0`. Slow groups must continue after a failed
quest and emit one report containing all failures. Unit/catalog/live-authority
success is not a substitute for the slow physical rows; conversely,
screenshots without native ECS and persistence checks are not completion
evidence.

Catalog warps can cross the Grove/muck music boundary while the prior track is
still fetching. A same-origin GET for hashed `music-1` or `muck-music-1` ending
in `net::ERR_ABORTED` is a normal audio handoff and belongs in browser
transients for Grove/Bible catalog runs; it must not abort an authoritative
quest wait. Other failed audio requests remain fatal unless their lane has an
equally specific reviewed transition rule.

### Delivery pickup handoff gate (August 7)

A Jobs Board delivery is not green merely because F creates the parcel or an
adapter returns the next marker. At every pickup transition, assert all of the
following in one bounded row:

- the rendered pickup and interaction candidate share the exact grounded
  active-pin pose, including Y; a matching X/Z with a legacy authored Y can
  silently fail the vertical interaction gate;
- the visible F prompt owns the intended pickup object;
- native inventory count and the transaction ledger both increase;
- the world-map/minimap destination advances to the recipient;
- the visible HUD objective changes from pickup copy to delivery copy;
- delivery consumes the native parcel, then the marker returns to the board;
- payout changes the native wallet and removes the completed job objective and
  pin rather than leaving either one over the next main quest.

Native inventory and the live-mode inventory mirror are separate clocks. Use
the durable `delivery_parcel_picked_up` receipt as the phase fallback so a GET
poll cannot move the player back to the source after a successful native
exchange. When a no-build payload is under test, label the report as
`mounted-build + injected hotfix`; a passing injected row does not prove that
the immutable client contains the fix.

### Grove visual evidence is a complete ledger

The 51 Grove quests contain 255 objectives. A visual release claim requires a
`current` and `completed` browser frame for every objective, plus a passing
physical lifecycle scenario for every selected quest. After a physical batch,
run:

```sh
node scripts/harthmere/audit-grove-quest-visuals.cjs \
  --artifacts-dir artifacts/<physical-batch>
```

The visual auditor rejects missing, undersized, effectively black/white,
implausibly blank, and unchanged current/completed frames. It also writes one
contact sheet per quest. Automated image checks are a preflight only: review
every contact sheet for camera placement, clipping, legibility, authored prop
quality, marker clarity, and HUD state before recording a human visual pass.
