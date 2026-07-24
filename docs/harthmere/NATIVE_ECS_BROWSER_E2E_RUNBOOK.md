# Harthmere Native-ECS Browser E2E Runbook

This runbook records the production-shaped procedure for browser-testing the
full quest and Jobs Board catalog. Keep it current when a browser run exposes
a new harness pitfall. The authoritative catalog checklist and skip evidence
live in `REMAINING_QUEST_BROWSER_COVERAGE.md`.

## Scope

Run these flows serially, in this order:

1. Snapshot Grove: Buttons Before the Road, Tools Before Treasure, and
   Road-Ready Bag Check.
2. The Road Ahead, including the clothing crate and equipping an eligible item.
3. Busted, including every objective and the underwater Water-logged Muck
   Buster container interaction.
4. Get the Muck Out, including every objective, action, requirement, and item.
5. Muck vs. Machine, including every objective, action, requirement, and item.
6. The 48 Snapshot Grove lessons not covered by the recent onboarding pass.
7. The 76 non-starter Bible quests, including hidden, level-, time-, weather-,
   combat-, and Thaedryn encounter paths.
8. The 19 business Jobs Board templates not covered by the recent 20-template
   auto-seeded jobs pass.

The browser gate is complete only when each action travels from the rendered
frontend through the signed server/logic path into native ECS, returns through
sync to the frontend, and is reflected in Cloud Save where that flow uses it.

## Memory-safe local topology

- Build the real production image. Do not substitute a development server.
- Limit production compiler heaps with `BIOMES_BUILD_MAX_OLD_SPACE_MB=6144`.
- Limit the browser runner with `NODE_OPTIONS=--max-old-space-size=3072`.
- Run one Chromium context and one quest suite at a time.
- Batch independent quests with a fresh actor/context per quest and collect all
  failures before exiting. Do not let the first broken lesson suppress evidence
  from the remaining lessons. Keep those contexts serial, not parallel, so the
  failure-collection policy does not violate the memory limit.
- Use the runner's low-memory viewport and graphics settings.
- Keep Anima and Gaia disabled for these quest/UI gates unless a tested step
  explicitly requires their simulation. Keep stream workers enabled because
  the trigger server owns native challenge progression.
- Stop the local app and Redis containers when the run is complete.

## Readiness rules

Do not launch Chromium merely because a public port is open. Wait for the local
stack's own readiness barrier and confirm all required processes are alive:

- web
- sync
- logic
- trigger
- notify

The sync service's public port is WebSocket-only. **Never probe it with `curl`
or another plain HTTP readiness request.** Use a TCP check or a real WebSocket
connection. A plain HTTP request can reach the zRPC WebSocket handler, throw
`res.send is not a function`, terminate sync, and correctly cause the unified
stack to stop every dependent service.

Use HTTP readiness only for services that expose a documented HTTP `/ready`
endpoint, such as trigger/notify metrics ports.

## Browser execution contract

- Authenticate through `visual_test_auth`; do not bypass the player session.
- Load `/at` and wait for the real client bridge, rendered canvas, Bikkie data,
  WebSocket connection, and ECS bootstrap.
- Focused low-memory catalogs mark the product's one-shot partial-terrain
  recovery as already attempted in that isolated browser session. Otherwise
  the intentionally tiny draw distance can trigger a delayed hard reload and
  destroy an in-flight quest action. Do not change the normal player recovery
  behavior globally.
- Keep the missing-player-shard recovery guard recent in that same isolated
  session when teleporting between distant marker fixtures. A catalog test is
  proving authoritative proximity, not asking the renderer to stream the full
  route between two authored locations.
- Wait for the full-screen `.loading-wrapper` to disappear before clicking
  **Enter Game**; the pause button can render while the wrapper still owns
  pointer events.
- Traverse actual NPC dialogue pages and click the visible quest-accept button.
- Verify journal presence with the quest list's quest-specific test id. Do not
  use unscoped title text: the compact objective HUD can contain the same title
  behind the Map & Quests modal and create a false pass.
- Use the numeric native manifest quest id in that test id. The frontend
  intentionally deduplicates compatibility and native projections in favor of
  the native row, so the authored string id is not the rendered journal id.
- Use real keyboard shortcuts and visible UI controls for journal, inventory,
  contextual interactions, containers, Take All, and equipment.
- In headless Chromium, exercise the production embed/no-pointer-lock path and
  explicitly focus the game canvas before keyboard actions. A visible
  `Enter Game` overlay means the test harness does not own gameplay input; it
  is not evidence that a container which works in production lost its F route.
- For a quest card below a long native quest step list, wait for the card to be
  attached and scroll the journal's real list before asserting visibility.
- For a world action that has no deterministic rendered target in the isolated
  fixture, publish the exact frontend GardenHose action only after proving the
  required authored item exists in native inventory.
- If an admin ECS fixture moves the player, also synchronize `/sim/player`
  after the authoritative replica confirms the move. Admin fixture updates do
  not run the ordinary warp controller, and proximity UI reads the simulated
  scene player rather than the raw replicated entity.
- Zero native rigid-body velocity when placing a player at a quest/job marker.
  Assert interaction-range proximity instead of exact floating-point equality,
  because the live controller can integrate a frame between sync reads.
- On a retained production-shaped Docker stack, expose Redis to the host-side
  runner through a local-only relay. The browser/API and the fixture writer
  must use the same Redis world; do not point the runner at a separate default
  localhost Redis instance.
- Retry a reset socket only for idempotent admin ECS `update` fixtures. A
  `create`/`delete` with an unknown response must not be blindly replayed.
- After each objective, verify all applicable layers before continuing:
  1. native TriggerState leaf fired;
  2. native Challenges lifecycle is correct;
  3. the local lesson runtime advanced;
  4. Cloud Save projected the same progress;
  5. the native quest projection returned to the frontend.
- After completion, return to the quest giver, verify completion dialogue, and
  verify the completed lesson disappears from the active journal.

## State-key warning

Snapshot Grove uses two deliberately different browser identifiers:

- persisted localStorage key: `biomes.localDev.snapshotGroveQuestState`
- refresh event: `biomes:local-dev-snapshot-grove-quest-state`

Do not read the event name as a storage key. That returns `undefined` even when
native ECS progression is healthy and creates a false frontend-sync timeout.

## Failure triage

Classify a failure at the first missing boundary:

- Browser action absent: inspect visible UI, focus, modal state, and screenshot.
  On short viewports also check whether a fixed objective panel needs its own
  scroll boundary; a DOM-attached button below the viewport is not usable UI.
- When production HARs show an interaction working, first reproduce the same
  focus/pointer-lock state in the production-shaped harness. Do not rewrite the
  shared product interaction selector solely because a headless run left the
  escape overlay active or failed to focus the canvas.
- Signed request absent/rejected: inspect browser requests and API response.
- Native leaf absent: inspect logic rollback and trigger-worker logs.
- Native leaf present but local runtime stale: inspect sync connection and the
  exact browser persistence/event keys before changing quest logic.
- Local state advanced but Cloud Save stale: inspect live-mode submission and
  server materialization receipt handling.
- Cloud Save/native state correct but journal stale: inspect frontend projection
  and adapter event subscriptions.

If a whole Grove/Bible batch advances its local runtime while the player's
native `Challenges` and `TriggerState` remain empty, treat that as one shared
materialization-boundary failure. Do not patch each quest row. Acceptance and
objective progress must be observed in the same authoritative world state the
frontend sync consumes; an asynchronous logic event followed by an immediate
world read can race a stale replica.

Every failed run must preserve its JSON report and screenshots under
`artifacts/harthmere-native-ecs-e2e/`. Record the exact report path when fixing
the cause, then rerun from a new player identity so stale receipts cannot make a
failure appear to pass.

For a dependent story chain, continue every independently fixtureable chapter
with a fresh actor even when an earlier chapter fails. Also retain a separate
ordered handoff pass, because isolated chapter success does not prove automatic
Road Ahead → Busted → Get the Muck Out → Muck vs. Machine continuation.

Bound every browser/ECS probe and persist an incremental JSON report after each
failed chapter. A saturated WebGL renderer must become one recorded failure,
not an unbounded wait that prevents the rest of the batch from running.
Only invoke a probe predicate after a fresh probe succeeds; otherwise a
retryable ECS/network read can be misreported as a destructuring/type failure.

The production-shaped Redis image is currently Redis 6.0.16. Leaderboard
transactions must therefore be validated against Redis 6 as well as newer
developer installations; do not rely on newer-only `ZADD GT/LT` flags.

## Release discipline

- Browser-test the local production image; do not use production as the normal
  test target.
- A local pass does not authorize a production deployment.
- Do not report a quest as passing from unit/source tests alone. Report exact
  browser objective counts and artifact paths.

## Fast focused-test syntax

The repository `./b test` wrapper selects files with `-p`. Use one brace glob
to batch related files in a single bootstrap:

```bash
NODE_OPTIONS=--max-old-space-size=3072 \
  ./b test -b -p \
  '{src/server/harthmere/test/native_hidden_quest_materialization.test.ts,src/pages/api/harthmere/test/live_mode_api_persistence.test.ts}'
```

Do not append file paths positionally with Mocha `--parallel/--jobs` flags to
this wrapper. That invocation can fall back to the full repository suite. Keep
local full-snapshot browser catalogs serial for memory safety; batch rows inside
the existing runner instead.
