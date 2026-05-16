# Harthmere TDD, Boot, and Town Tests

The main Harthmere testing/boot guide lives here:

```text
docs/harthmere/HARTHMERE_TDD_BOOT_AND_TOWN_TESTS.md
```

A copy is also placed under:

```text
src/client/game/README-HARTHMERE-TDD-BOOT-AND-TOWN-TESTS.md
```

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
