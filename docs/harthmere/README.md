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

## Cleanup Policy

Do not commit generated browser screenshots, local audit output, Redis dumps, patch bundles,
or one-off backup copies. Use `artifacts/`, `scratch/`, or `scripts/harthmere/.artifacts/`
locally when needed; those paths are ignored by git.
