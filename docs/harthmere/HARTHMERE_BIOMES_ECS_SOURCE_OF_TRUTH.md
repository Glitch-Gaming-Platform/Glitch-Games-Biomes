# Harthmere -> Biomes ECS Source Of Truth

This file is the contract for removing duplicate Harthmere state while keeping
the existing game playable during the merge.

## Rule

Biomes ECS is the gameplay source of truth. Harthmere systems may keep
local-dev adapters and live-mode snapshots only when they project into, or read
from, the Biomes ECS-shaped boundary.

BiomesUI is the UI source of truth. Player-facing Harthmere panels must either
be BiomesUI tabs/surfaces or BiomesUI-styled world interaction modals. Legacy
Harthmere HUD panels can remain mounted only as runtime controllers or no-op
compatibility shims.

## Current Canonical Boundaries

- Health and death: `Health` ECS shape via
  `src/shared/harthmere/harthmere_biomes_ecs_bridge.ts`, with local-dev death
  writes centralized in
  `src/client/components/challenges/harthmereDeathStateStore.ts`.
- Inventory and money: `Inventory` ECS shape via the same bridge. Harthmere gold
  maps to Biomes `BikkieIds.bling`; Harthmere-only string item ids stay in the
  inventory-loot adapter until they have real Bikkie ids.
- Quests: `Challenges` ECS shape via the same bridge. String-only Harthmere
  quest ids require an explicit id map before entering ECS; otherwise they stay
  in the quest adapter and emit warnings.
- UI: `src/client/components/biomes_ui` is the active UI shell. Local-dev
  systems dispatch BiomesUI adapter events instead of rendering duplicate
  gameplay tabs.

## Duplicate-Write Rules

- Do not write the Harthmere death localStorage key outside
  `harthmereDeathStateStore.ts`.
- Do not make a new health store. Project health through
  `createHarthmereBiomesEcsHealth`.
- Do not make a second wallet UI path. Inventory writes emit the BiomesUI wallet
  event so the vitals panel reads one UI contract.
- Do not insert non-Biomes item or quest ids into ECS by hashing or fabricating
  ids. Add real Bikkie/challenge ids or keep them in the adapter with a warning.

## Migration Notes

The bridge deliberately refuses to invent ECS ids for Harthmere-only strings.
That is slower than pretending everything is merged, but it prevents a more
dangerous split-brain state where ECS contains fake ids while live mode and
BiomesUI display real Harthmere content.
