# Harthmere Docs

This folder is the home for Harthmere-specific runbooks, audits, and design notes.
Keep source folders for runtime code and tests; put gameplay/reference documents here.

## Current runbooks

- `HARTHMERE_BIOMES_ECS_SOURCE_OF_TRUTH.md` - canonical one-authority boundary,
  explicit identity manifests, signed native transactions, migration rules,
  and the metadata that may intentionally remain outside ECS.
- `NATIVE_ECS_RESTORATION_2026-07-19.md` - July production bug restoration,
  native authority decisions, regression coverage, and post-deploy acceptance
  checklist.
- `NATIVE_ECS_WORLD_SYSTEMS_IMPLEMENTATION_2026-07-20.md` - implemented jobs,
  loot, gathering/farming, living-entity, robot, property/decor, and terrain
  materialization authority repairs, migration rules, and deployment checks.
- `HARTHMERE_NATIVE_ECS_COMBAT.md` - one-authority native combat, exact NPC and
  item identity, server validation, migration, and verification matrix.
- `HARTHMERE_NATIVE_ECS_VITALS.md` - native health, mana, stamina, breath,
  social standing, gold, consumables, drowning, and Grove respawn authority.
- `HARTHMERE_F_INTERACTION_AUTHORITY.md` - capability-first `F` routing,
  Road Ahead private containers, authored fallback receipts, pending UI, and
  the interaction regression matrix.
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

Native equipment has one authority: `/ecs/c/wearing`. BiomesUI publishes native
inventory swap events and the world-sync socket invalidates the player mesh.
The mesh is generated directly from the full wearing assignment, so top,
bottoms, hat, hair, outerwear, face, ears, neck, feet, and hands can coexist.
Harthmere-only string equipment remains supplemental adapter data and must not
overwrite native slots. Native hotbar stacks likewise stay in
`/ecs/c/inventory.hotbar`; BiomesUI lists them in the backpack view for count
visibility without cloning or projecting the stack.

Native quest metadata never replaces an object's physical capability. The Road
Ahead Clothing Crate and Billy's Toolbag open player-private native ECS
`container_inventory` entities seeded once with the exact snapshot Bikkie
items. Native inventory swaps own taking and storing; the server validates the
matching quest step from the same transfer and advances it without minting a
duplicate reward. Reopening, relogging, or using another browser observes the
same private container, and an emptied container never reseeds.

Containers must preserve the distinction between hidden quest helpers and visible
world objects. Hidden/inactive quest containers must not show an `F` prompt and
must not block movement. Visible crates, chests, boxes, bags, and toolbags should
keep their `F` prompt and open through the normal object-container panel even
when they are quest-related.

All `F` interactions use capability-first routing. Container, plant, GrabBag,
shop, crafting/cooking, door, readable, media/minigame, outfit, and living-NPC
components select the action before labels or quest metadata are considered.
Exactly one central dispatcher candidate wins. Active tools may intentionally
override the world target; targetless farming actions may not. Label-authored
fallback actions such as read, repair, tend, practice, use, and take-photo must
receive a proximity-validated server receipt before quest or toast consequences
run. Repair additionally requires server-observed native equipped-tool proof.

Jobs-board quests have two distinct completion moments: field objective complete
and payout claimed. Field completion must leave the job active/claimable, route
the HUD/BiomesUI/map marker back to the physical jobs board, and show a clear
on-screen completion message. The quest is only fully completed after the player
returns to the board and claims the reward. Delivery drop-offs, repairs, gathers,
cleanups, escorts, and item-only jobs should all use this same routing rule.

Recommended focused regression commands for these areas:

```bash
npx mocha -r ts-node/register -r tsconfig-paths/register \
  src/shared/harthmere/test/harthmere_job_objective.test.ts \
  src/client/components/biomes_ui/adapters/__tests__/jobsBoardQuestMapAdapter.test.ts \
  src/client/components/challenges/harthmereObjectInteractions.wantedBoard.test.ts \
  src/shared/harthmere/test/live_mode_backend.test.ts

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
