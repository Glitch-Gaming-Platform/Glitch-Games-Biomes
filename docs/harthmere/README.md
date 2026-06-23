# Harthmere Docs

This folder is the home for Harthmere-specific runbooks, audits, and design notes.
Keep source folders for runtime code and tests; put gameplay/reference documents here.

## Current runbooks

- `HARTHMERE_TDD_BOOT_AND_TOWN_TESTS.md` - local boot, testing, placement, and town TDD rules.
- `PERFORMANCE_AND_PLACEMENT.md` - runtime placement and performance guidance.
- `HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP.md` - terrain placement map generation and resolver rules.
- `HARTHMERE_LIVE_MODE_READINESS.md` - live-mode authority, mutation, audit, and UI event contracts.
- `HARTHMERE_COMBAT_IMPLEMENTATION_REVIEW.md` - current combat implementation status and production gaps.
- `HARTHMERE_COMPLETE_COMBAT_PROGRESSION.md` - shared combat, progression, ability, equipment, loot, PvP, and death rules.
- `HARTHMERE_THIRD_PARTY_COMBAT_AI.md` - third-party combat AI adapter boundaries and fallback behavior.
- `GLITCH_HARTHMERE_STARTUP_README.md` - Glitch startup notes.
- `GLITCH_SNAPSHOT_MERGE.md` - snapshot merge runbook.
- `HARTHMERE_INSTALL_README.md` - install notes.

## Live-Mode Verification Notes

Production full-flow tests can intentionally write persistent live state. When
testing property, home, or business construction on production, use a clearly
throwaway install id and record that the run will leave terrain/property/business
state in the shared live world. A complete construction verification should cover
the full progression, not isolated API calls:

- claim a home plot,
- start the selected home blueprint,
- contribute every construction stage through completion,
- confirm the completed property exposes storage/access state,
- claim a business plot,
- place the business blueprint,
- start the business,
- run at least one business cycle,
- collect revenue.

Live construction can depend on materials that are not yet grantable through the
public loot-roll API in the currently deployed server. If a production audit has
to seed a throwaway actor to complete the run, seed only that throwaway actor's
material storage and document the reason in the test notes. Do not treat seeded
material state as proof that normal loot/vendor acquisition works.

Equipment visuals have two authority layers. The production backend stores
Harthmere item ids such as `baker_apron` and `field_trousers` in
`inventoryLootState.actor.equipment`; the frontend must project those ids to real
Biomes wearable ids and write them into `/ecs/c/wearing` so the player mesh and
player-like NPC mesh can render the clothing. Hotbar visuals follow the same
pattern: Harthmere hotbar shortcuts must be projected into `/ecs/c/inventory`
`hotbar` entries so the selected item renders in hand. Backend equipment success
alone is not enough to prove body/hand visuals.

Containers must preserve the distinction between hidden quest helpers and visible
world objects. Hidden/inactive quest containers must not show an `F` prompt and
must not block movement. Visible crates, chests, boxes, bags, and toolbags should
keep their `F` prompt and open through the normal object-container panel even
when they are quest-related.

Recommended focused regression commands for these areas:

```bash
npx mocha -r ts-node/register -r tsconfig-paths/register \
  src/client/components/challenges/harthmereInventoryBiomesUIActions.test.ts \
  src/shared/harthmere/test/harthmere_biomes_ecs_bridge.test.ts

npx mocha -r ts-node/register -r tsconfig-paths/register \
  src/client/game/scripts/playerHarthmereHiddenContainerCollision.test.ts \
  src/client/game/scripts/overlaysPlaceableCraftingStationFallback.test.ts \
  src/client/components/challenges/harthmereObjectContainers.transfer.test.ts \
  src/client/components/challenges/harthmereContainerTransferInteraction.test.ts

npx mocha -r ts-node/register -r tsconfig-paths/register \
  src/shared/harthmere/test/building_system.test.ts \
  src/shared/harthmere/test/building_plots_frontier.test.ts \
  src/shared/harthmere/test/building_system_owned_safe_zone.test.ts \
  src/shared/harthmere/test/mmo_building_authority.test.ts
```

## Cleanup Policy

Do not commit generated browser screenshots, local audit output, Redis dumps, patch bundles,
or one-off backup copies. Use `artifacts/`, `scratch/`, or `scripts/harthmere/.artifacts/`
locally when needed; those paths are ignored by git.
