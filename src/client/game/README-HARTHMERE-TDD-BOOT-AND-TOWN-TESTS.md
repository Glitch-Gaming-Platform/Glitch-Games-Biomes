# Harthmere Game Boot, Testing, and Town TDD Guide

This document explains how to start the Harthmere/Biomes game locally, how to start it when you are running tests, what test suites exist, and why we are using a test-driven development process for town layout, collision, placement, and visual readability.

The important rule is simple:

> If a player can see, touch, enter, walk into, use, or route around something in Harthmere, there should be a test that protects it.

---

## 1. What this guide is for

Harthmere has a lot of authored town content:

- imported assets from `public/assets/harthmere`
- building shells
- market stalls
- lamps, signs, banners, furniture, walls, fences, gates, rocks, trees, and church pieces
- NPCs, animals, service NPCs, quest hooks, law areas, danger zones, routes, schedules, and event props
- runtime collision and browser-only debug helpers

A town can look correct in screenshots while still being broken in play. The bugs we are trying to prevent include:

- walking through visible solid objects
- invisible collision around small or visual-only props
- oversized collision bounds that block roads or doors
- NPCs spawning inside furniture, buildings, benches, or signs
- players spawning inside blockers
- floating lamps, torches, banners, shelves, or fixtures
- disconnected wall/ceiling/anchor props
- events spawning barricades, carts, crates, or debris without collision
- route graphs that allow NPCs to walk through blockers
- browser tests accidentally loading the marketing page instead of the game runtime

These tests exist because manual playtesting alone did not catch those cases reliably.

---

## 2. Normal local game start

Use this when you want to play or visually inspect the game.

```bash
cd /Users/devindixon/Development/biomes-game

HUSKY=0 \
SKIP_PROD_LOAD=true \
SKIP_MISSING_ASSET_CHECK=true \
BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
./b data-snapshot run --no-pip-install
```

Notes:

- `HUSKY=0` prevents Husky from blocking startup when the repo copy does not have a `.git` directory.
- `SKIP_PROD_LOAD=true` avoids loading production data.
- `SKIP_MISSING_ASSET_CHECK=true` prevents local asset experiments from blocking startup.
- `BIOMES_FORCE_LOCAL_DEV_TOWN=1` forces the local dev town path so Harthmere systems are active.
- `--no-pip-install` avoids redoing Python package installation during local iteration.

The root URL is usually not the game runtime:

```text
http://localhost:3000/
```

That page may be the Biomes landing page. The actual playable runtime is usually under an `/at/...` route, for example:

```text
http://localhost:3000/at/harthmere
http://localhost:3000/at/Joe
```

Use the URL finder below when unsure.

---

## 3. Finding the real Harthmere runtime URL

Live browser tests must run against the actual game runtime, not the landing page.

Run:

```bash
cd /Users/devindixon/Development/biomes-game

node scripts/harthmere/find-harthmere-live-runtime-url-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

A correct runtime probe should show some of these as `true`:

```text
hasTownAudit
hasCollisionE2E
hasOverlayAudit
hasStats
hasNpcCollisionObstacles
```

If the probe says the page title is similar to this:

```text
Biomes — Join the community shaping a new world
```

then you are on the marketing/landing page, not the game runtime.

When the finder returns a working URL, run browser tests with that URL:

```bash
HARTHMERE_E2E_URL="http://localhost:3000/at/Joe" \
node scripts/harthmere/test-harthmere-live-browser-regression-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

---

## 4. Starting the game for test work

For static/source tests, the game does not need to be running.

For live browser tests, the game must be running in another terminal.

Terminal 1:

```bash
cd /Users/devindixon/Development/biomes-game

HUSKY=0 \
SKIP_PROD_LOAD=true \
SKIP_MISSING_ASSET_CHECK=true \
BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
./b data-snapshot run --no-pip-install
```

Terminal 2:

```bash
cd /Users/devindixon/Development/biomes-game

node scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

For browser tests, use the real runtime URL:

```bash
HARTHMERE_E2E_URL="http://localhost:3000/at/Joe" \
node scripts/harthmere/test-harthmere-live-browser-regression-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

---

## 4A. Fast AI browser boot checklist

Use this path when an AI agent needs to get into the playable browser quickly
for manual verification, screenshots, or live interaction debugging.

1. Check whether a local web server is already listening:

```bash
cd /Users/devindixon/Development/biomes-game

lsof -i :3000 -sTCP:LISTEN || true
```

If nothing is listening, start Harthmere:

```bash
HUSKY=0 \
SKIP_PROD_LOAD=true \
SKIP_MISSING_ASSET_CHECK=true \
BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
./b data-snapshot run --no-pip-install
```

If Redis is running but the world looks empty or login/player state behaves like
a cold boot, populate Redis from the installed snapshot before starting again:

```bash
./b data-snapshot ensure-redis-populated
```

2. Do not open the root page for game testing. The root page can be the
   marketing/landing page. Find or use the actual runtime URL:

```bash
node scripts/harthmere/find-harthmere-live-runtime-url-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

The usual fast URL is:

```text
http://localhost:3000/at/Joe
```

3. Open that `/at/...` URL in the browser automation surface. For Codex desktop
   sessions, use the Browser plugin / in-app browser and navigate the selected tab
   to the runtime URL. Keep the browser open while testing interaction bugs; do not
   reload between each click unless code changed or the page is stale.

4. Confirm the runtime loaded before testing gameplay:

- the visible page is the game, not `Biomes — Join the community shaping a new world`
- a canvas is visible
- the top HUD/game chrome is visible
- the game is not covered by a Next.js compile-error overlay
- browser console errors are collected before and after the interaction

5. For live tests that need a target position, use the runtime debug hook from
   the browser console when it exists:

```js
window.__harthmereLivePlayerDebug?.teleportTo({ x: 496, y: 70, z: -129 });
```

Reload only if the helper reports a stored teleport but the player does not move
immediately.

6. For voice/dialogue regressions, first run the component-level browser test.
   It does not need the full game server and is faster than trying to hit a crowded
   NPC in-world:

```bash
npm exec -- mocha -- --require ts-node/register/transpile-only --require tsconfig-paths/register \
  src/client/components/challenges/TalkDialogModalStep.browser.test.tsx
```

That test must prove each rendered conversation scene requests and plays audio
once, page clicks continue working, real choices cannot be bypassed, clicking
the mic enters recording, clicking the page stops recording, extra clicks during
transcription do not advance/close, and empty or failed speech-to-text results
leave the conversation clickable.

7. Use the full live browser suite only after the page above is loaded:

```bash
HARTHMERE_E2E_URL="http://localhost:3000/at/Joe" \
node scripts/harthmere/test-harthmere-live-browser-regression-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

If a live in-world interaction cannot be targeted reliably because other
interactables are closer, say that explicitly and keep the component browser test
as the proof for dialog/audio behavior. Do not claim an in-world conversation
passed unless the browser actually opened that NPC dialogue and clicked through
the relevant stages.

---

## 5. Static/source test suite

Run the full static town suite:

```bash
cd /Users/devindixon/Development/biomes-game

node scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

This suite is meant to be fast and repeatable. It checks source files and authored placement rules without needing a browser.

It covers:

- district component coverage
- building shells
- road spacing
- door approach zones
- market lanes
- dock lanes
- player services
- temple/cemetery areas
- Mudden Ward
- Old Well/Underways
- Guard Yard
- River Docks
- Noble Rise
- Copper Kettle
- Craftsman Row
- solid uploaded asset collision contracts
- runtime collision source parity
- player spawn and district entry safety
- fixture attachment sanity
- wall/client fixture attachment sanity
- route graph, schedule, law, danger, event-state, visual-readability, and mount-policy contracts

---

## 6. Live browser/runtime test suite

Run only after the local game server is running and you know the real runtime URL:

```bash
cd /Users/devindixon/Development/biomes-game

HARTHMERE_E2E_URL="http://localhost:3000/at/Joe" \
node scripts/harthmere/test-harthmere-live-browser-regression-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

This suite is stricter than the static suite. It checks browser globals and runtime behavior.

It currently checks:

- the page is not a compile-error overlay
- the page is actually the Harthmere game runtime
- collision helpers are exposed
- collision overlay audit helpers are exposed
- collision performance stats exist
- radius variant runners exist
- procedural/spawned solid collision contracts exist

A failure like this is good and intentional:

```text
Harthmere runtime not loaded
```

It means the test was pointed at the wrong URL, such as the landing page.

A failure like this is also useful:

```text
solid-fixture helper proves actual movement blocking, not metadata-only collision
```

It means the code found collision metadata but did not prove actual movement blocking yet.

---

## 7. Individual useful tests

### Local-dev seed and reconnect coverage

```bash
npx ts-mocha -p tsconfig.json \
  src/server/sync/subscription/test/game_observer.test.ts
```

Protects the local-dev starter town bootstrap used by shim/sync
observers. The tests assert the eager seed path derives Grove NPCs from
`SNAPSHOT_GROVE_NPCS_V75`, includes all 22 seeded Grove NPCs, and keeps
the seeded NPC set present across reconnects instead of disappearing
after a fresh observer subscribes.

With the current local-dev Harthmere seed, the expected bootstrap set is:

- 396 terrain shards
- 70 Harthmere NPCs
- 22 seeded Grove NPCs
- 3 combat NPCs

### Food stamina state migration

```bash
npx ts-mocha -p tsconfig.json \
  src/client/components/challenges/LocalDevHarthmereFoodStaminaSystem.test.ts \
  src/shared/harthmere/test/mmo_farming_food_stamina_v1.test.ts
```

Protects the four-hour full-stamina survival rate, death-at-zero rules,
food restoration, and saved-state migration. The migration check prevents
old local-dev saves from the faster drain version from loading at zero
stamina and instantly killing the player after deploy.

### Biomes map UI coverage

```bash
npx ts-mocha -p tsconfig.json \
  src/client/components/biomes_ui/__tests__/progressionTabsNoDummy.test.tsx \
  src/client/components/biomes_ui/__tests__/MapQuestsTab.browser.test.ts
```

Protects the contained Map & Quests surface: tab classification, marker
labels, geography terrain swatches, center-player math, quest-click
centering helpers, and wheel zoom bounds. The standalone browser
interaction test file is intentionally pending until the local browser
bundling harness can mount the React map reliably under `ts-mocha`.

### Daily checklist and jobs board coverage

```bash
TS_NODE_COMPILER_OPTIONS='{"jsx":"react"}' npx ts-mocha \
  --extension ts --extension tsx --timeout 10000 \
  src/shared/harthmere/test/mmo_care_loops_v1.test.ts \
  src/shared/harthmere/test/live_mode_care_loops_backend_v1.test.ts \
  src/pages/api/harthmere/test/live_mode_daily_state_api.test.ts \
  src/client/components/harthmere_jobs_board/__tests__/proximityGateV141.test.ts \
  src/client/game/renderers/local_dev/test/harthmere_jobs_board_kiosk_placements_v141.test.ts \
  src/client/components/biomes_ui/__tests__/progressionTabsNoDummy.test.tsx
```

Protects the default Today tab, daily check-in rewards, live care-loop
claim path, visible gold HUD total, two physical jobs board locations,
the wider approach prompt radius, and the large voxel kiosk placements
that make the boards obvious in the world.

### Uploaded solid asset collision

```bash
node scripts/harthmere/test-harthmere-uploaded-asset-solid-collision-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Protects against imported Harthmere assets becoming walk-through.

Examples:

- crates
- rocks
- fences
- tables
- beds
- church pieces
- hedges
- towers
- gates

### Solid landmark fixture collision

```bash
node scripts/harthmere/test-harthmere-solid-landmark-fixture-collision-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Protects specific visible fixtures that can look decorative by name but must be solid in game:

- North Gate large flags
- North Gate ground lamps
- Market Square fountain fixtures
- Temple/church/cemetery fixtures

### Runtime navigation and collision

```bash
node scripts/harthmere/test-harthmere-runtime-navigation-collision-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Protects core walking lanes and service routes.

### Fixture attachment sanity

```bash
node scripts/harthmere/test-harthmere-fixture-attachment-sanity-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Protects against floating lamps, torches, candles, chandeliers, and lights without believable support.

### Wall/client fixture attachment sanity

```bash
node scripts/harthmere/test-harthmere-wall-fixture-attachment-sanity-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Protects fixtures that should attach to a wall, side, bracket, post, facade, chapel wall, tunnel wall, or other client object.

This is different from generic support testing. Freestanding signs, plaza banners, laundry cloth, and signal braziers are not wall-mounted fixtures unless they are authored as such.

### Player vertical collision safety

```bash
node scripts/harthmere/test-harthmere-player-no-vertical-town-collision-by-default-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Protects against renderer-authored building/prop AABBs being fed into the vertical player solver by default. That old path can push the avatar upward and leave the player floating or stuck above town.

Horizontal town collision should prevent walking through objects. The legacy vertical bridge should remain opt-in only for debugging:

```js
window.__harthmereEnableVerticalPlayerTownCollision = true;
```

---

## 8. Why we write these tests

We are using test-driven development because town bugs are easy to reintroduce.

A single placement change can accidentally:

- block a road
- clear a road but break an NPC spawn
- fix a collision object but make a visual prop floating
- make a flag solid but accidentally make every banner solid
- make an object pass-through because its name contains `lamp`, `flag`, `sign`, or `banner`
- fix source metadata while the browser runtime still uses stale or missing obstacles

The tests are written to catch those mistakes as soon as possible.

---

## 9. The red/green workflow

Use this process:

1. Write a failing test that describes the exact bug or rule.
2. Confirm the test fails for the right reason.
3. Patch the smallest amount of code or authored placement data.
4. Run the focused test.
5. Run the full town suite.
6. Run browser tests if the bug involves real movement, collision, overlays, or runtime globals.
7. Commit the test and fix together.

Do not weaken a test just to make it pass. If a test is too broad, tighten it so it checks the correct behavior.

Example:

- Bad: make every `banner` solid.
- Good: keep generic banners visual-only, but mark specific North Gate large imported flags as `solid_landmark_fixture`.

Example:

- Bad: accept collision metadata as proof of movement collision.
- Good: require runtime movement probe output with `beforePosition`, `attemptedPosition`, `afterPosition`, and `blockedByMovement`.

---

## 10. What belongs in static tests vs browser tests

### Static/source tests should check:

- files exist
- placement names and districts are correct
- asset references exist on disk
- collision profiles are assigned
- pass-through vs solid contracts are defined
- route graph data exists
- schedules exist
- danger areas have warning metadata
- law/restricted areas have vocabulary and warning markers
- events declare mutations and do not block service roads
- lights and wall fixtures declare believable supports

### Browser/runtime tests should check:

- actual Harthmere runtime loaded
- debug/browser helpers are present
- obstacle export exists in the browser
- collision stats update
- overlay reports compare visible mesh bounds to collision proxies
- movement probes prove blocking behavior
- performance budgets are not exceeded
- radius variants can run against real obstacle data

If a bug only happens while playing, it belongs in browser/runtime tests.

---

## 11. Collision rules

### Solid uploaded assets

Uploaded assets that are visibly physical should block the player unless explicitly made visual-only.

Examples that should block:

- walls
- towers
- gates
- rocks
- trees
- crates
- barrels
- chests
- tables
- counters
- benches
- beds
- fences
- hedges
- church pieces
- large fountain pieces

### Visual-only assets

Visual-only assets should usually not block the player.

Examples:

- small notes
- scrolls
- food
- tiny tabletop props
- decorative signs
- hanging banners
- flags that are purely cloth
- windows
- lamps that are only visual glows

### Solid landmark fixtures

Some assets look decorative by family name but are physically large imported fixtures. These must have explicit collision overrides.

Examples:

- North Gate large imported flags
- North Gate ground lamps/braziers
- Market Square fountain graphics
- Temple/church/cemetery imported pieces

Do not solve these with broad rules. Use targeted classification.

---

## 12. Fixture and attachment rules

If an object floats above the ground, the player should understand why.

Use names that explain support:

```text
mounted on wall bracket
mounted on tunnel wall post
hanging from ceiling beam
supported on counter
grounded in stone fire ring
against chapel wall
attached to gate post
beside Reeve Hall balcony
```

Bad examples:

```text
Temple lantern
Green torchlight breadcrumb
Hanging sign
Wall shelf
```

Better examples:

```text
Temple entry lantern left of healing path mounted on chapel entry wall bracket
Green torchlight breadcrumb toward Underways stair mounted on Underways stair wall post
Black Anvil hanging sign symbol supported below smithy sign
Wall shelf against east chapel wall
```

---

## 13. Browser globals used by live tests

The live tests use these globals when the Harthmere runtime is loaded:

```js
window.__harthmereTownAudit;
window.__harthmereCollisionE2E;
window.__harthmereCollisionOverlayAudit;
window.__harthmereHorizontalPlayerTownCollisionStats;
window.__harthmereNpcCollisionObstacles;
window.__harthmereTownWalkDebug;
window.__harthmereCombatDebug;
window.__harthmereVoxelNpcMotionActorPositionsV193;
window.__harthmereVoxelNpcAnimationAuditV195;
```

Useful console probe:

```js
(() => {
  const keys = [
    "__harthmereTownAudit",
    "__harthmereCollisionE2E",
    "__harthmereCollisionOverlayAudit",
    "__harthmereHorizontalPlayerTownCollisionStats",
    "__harthmereNpcCollisionObstacles",
    "__harthmereTownWalkDebug",
    "__harthmereCombatDebug",
    "__harthmereVoxelNpcMotionActorPositionsV193",
    "__harthmereVoxelNpcAnimationAuditV195",
  ];

  const out = {};
  for (const key of keys) {
    const value = window[key];
    out[key] = {
      exists: Boolean(value),
      type: typeof value,
      keys: value && typeof value === "object" ? Object.keys(value).sort() : [],
      value: key.includes("Stats") ? value : undefined,
    };
  }
  console.table(out);
  return out;
})();
```

---

## 14. Common failure meanings

### `net::ERR_CONNECTION_REFUSED`

The local server is not running or the wrong port is being used.

Start the game first.

### `Harthmere runtime not loaded`

The browser test loaded a page, but not the actual game runtime. Use the URL finder or copy the actual `/at/...` URL after entering the game.

### `missing browser movement helper`

The Harthmere runtime loaded, but the debug/test helper was not exposed from the active code path.

### `obstacleCount: 0`

The helper exists, but the renderer has not exported player collision obstacles yet, or the test is reading stats before running a collision hydration probe.

### `metadata-only collision`

The helper found obstacle metadata but did not prove actual movement blocking.

### Avatar stuck above town

The vertical renderer-authored collision bridge may be pushing the player upward. That bridge should be disabled by default. Horizontal town collision should handle walk-through prevention.

---

## 15. Before committing

Run this sequence:

```bash
cd /Users/devindixon/Development/biomes-game

node scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Run the focused seed/state/UI checks when touching local-dev seeding,
stamina, inventory/food survival, or Biomes map surfaces:

```bash
npx ts-mocha -p tsconfig.json \
  src/server/sync/subscription/test/game_observer.test.ts

npx ts-mocha -p tsconfig.json \
  src/client/components/challenges/LocalDevHarthmereFoodStaminaSystem.test.ts \
  src/shared/harthmere/test/mmo_farming_food_stamina_v1.test.ts

npx ts-mocha -p tsconfig.json \
  src/client/components/biomes_ui/__tests__/progressionTabsNoDummy.test.tsx \
  src/client/components/biomes_ui/__tests__/MapQuestsTab.browser.test.ts

TS_NODE_COMPILER_OPTIONS='{"jsx":"react"}' npx ts-mocha \
  --extension ts --extension tsx --timeout 10000 \
  src/shared/harthmere/test/mmo_care_loops_v1.test.ts \
  src/shared/harthmere/test/live_mode_care_loops_backend_v1.test.ts \
  src/pages/api/harthmere/test/live_mode_daily_state_api.test.ts \
  src/client/components/harthmere_jobs_board/__tests__/proximityGateV141.test.ts \
  src/client/game/renderers/local_dev/test/harthmere_jobs_board_kiosk_placements_v141.test.ts \
  src/client/components/biomes_ui/__tests__/progressionTabsNoDummy.test.tsx
```

Then start the game:

```bash
HUSKY=0 \
SKIP_PROD_LOAD=true \
SKIP_MISSING_ASSET_CHECK=true \
BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
./b data-snapshot run --no-pip-install
```

Find the runtime URL:

```bash
node scripts/harthmere/find-harthmere-live-runtime-url-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Run the live suite:

```bash
HARTHMERE_E2E_URL="http://localhost:3000/at/Joe" \
node scripts/harthmere/test-harthmere-live-browser-regression-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Then manually verify:

- player starts on ground
- player can move
- player cannot walk through North Gate fixtures
- player cannot walk through Market Square fountain graphics
- player cannot walk through Temple/church/cemetery graphics
- roads and service lanes remain walkable
- no major lamps/torches/banners/shelves look disconnected or floating

---

## 16. Maintenance rules

- Keep tests close to the bug they protect.
- Prefer focused tests before broad tests.
- Do not use broad collision rules for narrow visual bugs.
- Keep normal play and test behavior aligned.
- Add browser tests for browser-only failures.
- Add static tests for authoring/data/layout rules.
- Do not accept metadata as proof of movement.
- Preserve older expected placement phrases when adding clearer support wording.
- Keep debug helpers available, but avoid making the player depend on debug-only state.
- If a test is too broad, tighten it instead of deleting it.

---

## 17. Fast startup rules

Use the fastest startup that still proves the thing you are changing.

For source-only rules, do not start the game. Run the focused `ts-mocha` or
`scripts/harthmere/test-*` suite that owns the rule.

For visual placement, start the local game once and keep it running while
iterating:

```bash
HUSKY=0 \
SKIP_PROD_LOAD=true \
SKIP_MISSING_ASSET_CHECK=true \
BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
./b data-snapshot run --no-pip-install
```

Do not flush Redis or force a full reseed unless the change is specifically
about bootstrap data. Persistent local Redis is useful for fast startup and
for catching reconnect/state bugs. If a feature needs shared world state in
production, use an idempotent versioned bootstrap/migration instead of relying
on a clean reseed every launch.

Good fast-start defaults:

- keep one local server running for repeated browser checks
- use `--no-pip-install` during local iteration
- skip production data with `SKIP_PROD_LOAD=true`
- run focused tests first, then broaden only when the surface area warrants it
- use the runtime URL finder instead of repeatedly opening the landing page

Production note: public `NEXT_PUBLIC_*` values are build-time values. If a
startup or placement flag is consumed by the browser bundle, rebuild after
changing it.

---

## 18. Visual testing rules

Use the real browser/runtime when the question is about what a player sees,
where something appears, whether it is grounded, whether a prompt opens, or
whether an interaction radius feels correct.

Use Playwright/live browser checks for:

- marker and item visibility
- board, NPC, object, and encounter grounding
- floating or buried placements
- UI labels, reward text, and debug/developer text leaks
- prompt radius and click-through quest flow
- combat movement, aggro, energy bars, and animation behavior

Static render scripts are useful for asset shape, material, and procedural
animation checks. They are not a substitute for live placement coordinates
because they do not load the complete playable world, player camera, terrain
streaming, Redis-backed state, HUD, or production interaction gates.

When a visual test needs coordinates, open the actual `/at/...` runtime and
measure what the rendered world reports. Do not treat a standalone render or
an authored coordinate table as proof that an object is grounded in the live
terrain.

Always verify the browser loaded the game runtime, not the marketing page:

```bash
node scripts/harthmere/find-harthmere-live-runtime-url-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Then pass the returned `/at/...` URL into visual tests:

```bash
HARTHMERE_E2E_URL="http://localhost:3000/at/Joe" \
node scripts/harthmere/test-harthmere-live-browser-regression-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

### Universal combat visual diagnosis

Most Harthmere attacks are body/contact attacks, not sword events. A passing
combat visual test must prove this chain for both directions:

```text
input/action -> actor position/range gate -> body/tool/projectile animation
  -> combat effect -> health/mana/stamina mutation -> HUD/death-state update
```

Do not require `__harthmereRendererDebug.swordState()` for unarmed NPCs,
animals, muckers, hexes, livestock, pets, or ordinary empty-handed players.
For native live NPCs, use `window.__harthmereVoxelNpcAnimationAuditV195` and
`window.__harthmereVoxelNpcMotionActorPositionsV193`; these are the renderer
signals that show the live ECS actor selected attack/walk/run/idle and where it
was when the range check ran.

For non-NPC live entities, add fixtures that start as real `b:<id>` ECS
records without `npc_metadata`. The backend proof lives in
`src/shared/harthmere/test/live_entity_non_npc_combat_bridge_v1.test.ts` and
must show: ECS conversion, player -> non-NPC damage, non-NPC -> player damage,
HUD/status mutation, death, loot-drop creation, and pickup. The visual proof
uses `window.__harthmereNonNpcCombatAnimationAuditV1`, which is emitted by the
runtime life renderer for animals, muckers, hexes, robots, undead, and other
non-NPC visual actors. This is separate from sword state and accepts
empty-handed body attacks as first-class attack animations.

Contact attacks are valid only at sensible body range: attacker radius plus
target radius plus a small reach allowance. Projectile or Bikkie-ranged attacks
must instead prove line of sight, a maximum range, and a projectile/ranged
visual. Safe zones and protected targets must not lose health. Livestock and
pets are attackable, but attacking/killing one owned by someone else must
produce the law/owner penalty instead of silently blocking the hit.

Run the universal visual probe after starting the local game:

```bash
HARTHMERE_E2E_URL="http://localhost:3000/at/VisualCombatDiagnostics" \
node scripts/harthmere/test-harthmere-universal-combat-visual-diagnostics-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

The visual probe sets `settings.hud.hideReturnToGame=true` before load and
waits for `.loading-wrapper` to disappear. Do the same in new browser tests;
otherwise a screenshot can capture the loading shell or pointer-lock overlay
while the combat debug globals are already present.

---

## 19. Coordinate and placement rules

World positions use `[x, y, z]`:

- `x` and `z` are horizontal map coordinates
- `y` is vertical height
- interaction radii usually compare the player's `x/z` distance to the target
- map markers may use a display height, but physical boards/NPCs/items need a
  grounded gameplay height

The production terrain placement map is the source of truth for Harthmere quest
items, monsters, map pins, HUD targets, quest pointers, and random spawn pools:

```text
docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_V1.md
src/shared/harthmere/production_terrain_placement_map_v1.ts
src/shared/harthmere/generated/production_terrain_placement_map_v1.ts
```

The authored/local terrain helper can return a flat or incomplete height and
may not match the live rendered ground. If the terrain is hilly, stepped,
roofed, underwater, or built from snapshot shards, resolve the placement from
the generated production map before locking it.

Placement source-of-truth rules:

- Prefer one shared registry for a board, NPC, item, encounter, or quest target.
- Client renderer, map marker, proximity gate, server authority, and seed data
  should import that shared source whenever possible.
- If duplication is unavoidable, add drift tests that compare the duplicated
  coordinates.
- Do not use arbitrary Redis/ECS positions as canonical placement proof. Redis
  can store runtime state, but authored placement should come from reviewed
  shared data or an idempotent production seeder.
- Do not move one buried object by hand when a whole cluster shares the same
  terrain mismatch. Fix or document the cluster rule.
- Use `resolveHarthmereQuestObjectivePlacementV1` or
  `getHarthmereQuestResolvedWaypointV47` for fixed quest objectives.
- Use `resolveHarthmereProductionMarkerPositionV1` for shared marker ids such
  as Jobs Board, business, and live-helper landmarks.
- Use `chooseHarthmereQuestOutdoorSpawnPointV1` for random outdoor content and
  `chooseHarthmereQuestCaveSpawnPointV1` for random cave content.
- BiomesUI Map, HUD/minimap, quest pointer, server authority, and 3D markers
  should all consume the same resolved `recommendedPosition`.
- Do not shift authored Harthmere coordinates twice; quest/runtime helpers
  perform the authored-to-world transform before terrain resolution.

Before declaring a placement correct, verify:

- the object is visible from normal player camera distance
- the feet/base are not buried
- the object is not floating
- the player can reach it on foot
- the prompt/interaction radius matches the rendered object
- the minimap/world-map marker points to the same `x/z` column
- production/server authority uses the same target position

For Jobs Boards specifically, the board locations live in the shared jobs board
authority registry and are mirrored by renderer/proximity/server tests. Redis
runtime state should not be the coordinate source for those boards.

---

## 20. Quest, item, and player-facing text rules

Quest targets should be placed from shared marker helpers, not ad hoc inline
coordinates. If a quest spawns an encounter, the encounter should only appear
after the quest is accepted or triggered, and it should spawn inside the
intended danger area.

For item quests:

- verify the item definition exists
- verify the display name is player-facing title text, not `camelCase`,
  `snake_case`, or server/internal IDs
- verify the description is written for players, not developers
- verify the collection/completion rule consumes or checks the actual item
  required by the quest

For reward text:

- tell the player what reward they will get before they accept when possible
- show the completion reward clearly
- avoid debug words such as reducer, fixture, mock, seed, server description,
  test marker, or internal quest id

For combat or helper quests:

- acceptance should create the target condition
- completion should require the actual task, not just visiting the marker
- failure/abandon/cancel should clean up temporary targets when appropriate
- server authority should validate completion for production-facing flows

---

## 21. Universal combat and live-entity visual tests

Combat coverage must prove the same event window contains both the visible
attack animation and the combat mutation. A passing visual diagnosis should
show:

- player-originated body/weapon/tool/projectile animation
- matching combat effect or reducer mutation
- target HP/resource delta
- HUD delta when the player is attacker or target
- current contact range for body/melee attacks, not old chase distance
- line of sight and projectile min/max range for ranged/Bikkie attacks

Empty-handed attacks are first-class body attacks. Do not use sword/weapon
visual events as the proof for fists, animals, muckers, hexes, or other
creature attacks unless that actor has explicit equipment.

The universal visual diagnostic script pins non-NPC animal, mucker, and hex
actors with `lodTier: "always"` so optimized renderer mode still proves native
body attack animation consumption. Keep these diagnostic actors distinct from
robots and places so family-specific checks do not pass through the wrong
actor.

Bikkie projectile coverage currently requires both the gameplay item definition
and the animated projectile asset. `hunter_bow` must exist with ranged attack
stats, and `arrow_bow` must expose projectile/impact animation clips before a
ranged Bikkie diagnostic can pass.
