# Testing Faster — Local and Browser

Every number below is measured in this checkout, not estimated.

## TL;DR

```sh
scripts/harthmere/t.sh ch1        # 196 tests, 4.6 s   (was 8.1 s)
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

The runner derives Redis port `6389` before loading the Redis connection module
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

| Path                                | What                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `.mocharc.fast.json`                | Bootstrap-free mocha config                          |
| `scripts/harthmere/t.sh`            | Test presets, watch mode, scoped typecheck           |
| `scripts/harthmere/e2e-jump.cjs`    | Browser deep links, Cloud Save URL, seeds, readiness |
| `tsconfig.ch1check.json`            | Fast scoped typecheck (~3 s)                         |
| `tsconfig.ch1renderer.json`         | Client-graph typecheck (slow, incremental)           |
| `NATIVE_ECS_BROWSER_E2E_RUNBOOK.md` | The release gate (unchanged)                         |
| `CHAPTER_1_E2E_RUNBOOK.md`          | Chapter 1 browser checklist                          |
