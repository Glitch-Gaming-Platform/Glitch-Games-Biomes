# Harthmere Living Quarters and Performance Fix v56

This patch addresses the console-log trouble spots where two-story residential/service buildings were incomplete and the renderer was dropping to roughly 1-2 FPS near living-quarter clusters.

## Fixes

- Replaces dense v49 residential/slum shells with larger v56 solid stone/ore wall panels.
- Keeps the design rule intact: rooms still have solid walls, floors, ceilings, upper-story access, stairs, landings, doors, and balcony/deck access.
- Adds extra completion stairs/upper landings/upper doors for multi-story service buildings near the logged coordinates.
- Makes floors, stair treads, upper landings, balcony decks, and doorway clearances non-blocking.
- Shrinks residential wall collision from broad generic `arch_wall_*` blockers to compact panel footprints.
- Thins repeated room decor in optimized runtime mode while preserving structural shells and landmarks.

## Uploaded console coordinates addressed

- `[473.475197305306, 53, -169.80844708458642]` — living-quarters performance hot spot.
- `[473.82486288913174, 53, -186.14483738349657]` — nearby complete two-story building/performance probe.
- `[503.9599363299077, 53, -251.7295916519932]` — incomplete stairs/two-story building.
- `[540.7294585581436, 53, -269.62399114134445]` — incomplete stairs/two-story building and invisible blockers.

## Validation

Run:

```bash
node scripts/harthmere/test-harthmere-living-quarters-performance-v56.cjs /Users/devindixon/Development/biomes-game
```
