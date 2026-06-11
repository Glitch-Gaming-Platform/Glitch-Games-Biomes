# Harthmere TDD, Boot, and Town Tests

The main Harthmere testing/boot guide lives here:

```text
docs/harthmere/HARTHMERE_TDD_BOOT_AND_TOWN_TESTS.md
```

A copy is also placed under:

```text
src/client/game/README-HARTHMERE-TDD-BOOT-AND-TOWN-TESTS.md
```

Read that guide before changing startup, visual tests, placement
coordinates, quest markers, Jobs Board positions, NPC/object grounding,
Redis seeding, or player-facing quest text. It documents the current rules
for fast warm starts, when to use the live browser instead of static render
scripts, how `[x, y, z]` coordinates map to terrain, and how to avoid
invisible, floating, buried, or mismatched production placements.

For future AI/browser sessions, go straight to section `4A. Fast AI browser
boot checklist` in the main guide. It documents the fastest path from this repo
to a playable `/at/...` browser runtime, the Redis warm-start command, the
runtime URL finder, and the voice/dialogue browser test that catches repeat
audio and click-freeze regressions.

For terrain-correct quest items, monsters, HUD targets, BiomesUI map pins, and
quest pointers, also read:

```text
docs/harthmere/HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_V1.md
```

That guide explains how to regenerate the production terrain placement map from
Azure/Redis read-only data and which resolver to use before placing anything on
the map.

Start normal local Harthmere:

```bash
HUSKY=0 \
SKIP_PROD_LOAD=true \
SKIP_MISSING_ASSET_CHECK=true \
BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
./b data-snapshot run --no-pip-install
```

Run the static town test suite:

```bash
node scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Run the focused local-dev seed, stamina migration, and Biomes map UI
checks:

```bash
npx ts-mocha -p tsconfig.json \
  src/server/sync/subscription/test/game_observer.test.ts

npx ts-mocha -p tsconfig.json \
  src/client/components/challenges/LocalDevHarthmereFoodStaminaSystem.test.ts \
  src/shared/harthmere/test/mmo_farming_food_stamina_v1.test.ts

npx ts-mocha -p tsconfig.json \
  src/client/components/biomes_ui/__tests__/progressionTabsNoDummy.test.tsx \
  src/client/components/biomes_ui/__tests__/MapQuestsTab.browser.test.ts
```

Run the focused daily check-in and physical jobs board coverage:

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

The local-dev seed tests assert the shim/sync bootstrap path includes the
full seeded town set, including the 22 Grove NPCs, and keeps them present
across reconnects. The map browser interaction file is currently a
pending harness while the standalone browser bundler is stabilized; the
pure render/helper map coverage still runs.

Find the actual Harthmere runtime URL for browser tests:

```bash
node scripts/harthmere/find-harthmere-live-runtime-url-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Run live browser tests with the real `/at/...` runtime URL:

```bash
HARTHMERE_E2E_URL="http://localhost:3000/at/Joe" \
node scripts/harthmere/test-harthmere-live-browser-regression-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Read the full guide before changing Harthmere placement, collision, fixtures, route graphs, schedules, map rules, law areas, event-state mutations, or browser runtime test helpers.
