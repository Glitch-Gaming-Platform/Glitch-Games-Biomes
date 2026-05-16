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
window.__harthmereEnableVerticalPlayerTownCollision = true
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
window.__harthmereTownAudit
window.__harthmereCollisionE2E
window.__harthmereCollisionOverlayAudit
window.__harthmereHorizontalPlayerTownCollisionStats
window.__harthmereNpcCollisionObstacles
window.__harthmereTownWalkDebug
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

