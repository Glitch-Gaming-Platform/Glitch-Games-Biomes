# Harthmere Dungeon Test Access

Use this when testing the dungeon before normal quest triggers, NPCs, and combat encounters are wired.

## Start local Harthmere

```bash
cd /Users/devindixon/Development/biomes-game

HUSKY=0 \
SKIP_PROD_LOAD=true \
SKIP_MISSING_ASSET_CHECK=true \
BIOMES_FORCE_LOCAL_DEV_TOWN=1 \
./b data-snapshot run --no-pip-install
```

The landing page at `http://localhost:3000/` is not the game runtime.

Find the actual runtime URL:

```bash
node scripts/harthmere/find-harthmere-live-runtime-url-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Common runtime URL:

```text
http://localhost:3000/at/Joe
```

## Manual dungeon test anchors

### 1. Chapel Undercroft Test Entrance

```text
District: Temple Green
Approx anchor: x=500.8 z=-137.4
```

Use this to test chapel-to-undercroft readability.

### 2. Old Well Drain Test Entrance

```text
District: Old Well / Underways
Approx anchor: x=413.2 z=-234.6
```

Use this to test the drain/Underways entrance.

### 3. Bellward Halls Debug Start

```text
District: Old Well / Underways
Approx anchor: x=356.0 z=-318.0
```

Use this to test the dungeon staging directly.

## Live browser suite

```bash
HARTHMERE_E2E_URL="http://localhost:3000/at/Joe" \
node scripts/harthmere/test-harthmere-live-browser-regression-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

## Important

These are authored entrance/readability anchors. They do not add NPCs, boss actors, hostile spawns, or outside-world content.
