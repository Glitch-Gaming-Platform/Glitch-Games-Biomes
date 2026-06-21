# Harthmere -> Biomes ECS Source Of Truth

This file is the contract for removing duplicate Harthmere state while keeping
the existing game playable during the merge.

## Rule

Biomes ECS is the gameplay model boundary, and Glitch Cloud Save is the durable
source of truth for player-owned Harthmere information. Harthmere live-mode Redis
state is the runtime transaction/cache layer: it validates gameplay writes and
serves read projections, but it can be rebuilt when Redis resets.

BiomesUI is the UI source of truth. Player-facing Harthmere panels must either
be BiomesUI tabs/surfaces or BiomesUI-styled world interaction modals. Legacy
Harthmere HUD panels can remain mounted only as runtime controllers or no-op
compatibility shims.

Browser localStorage is only the compatibility cache used to build and apply
Glitch Cloud Save payloads. It is not durable authority by itself.

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
- Cloud Save: `src/client/game/glitch/harthmere_glitch_bridge.ts` stores
  `glitchCloudSave` player snapshots. On boot, the latest valid Glitch Cloud Save
  is allowed to restore even when Redis still has runtime state, because Redis is
  resettable and Cloud Save is the durable player record.
- Backend gameplay writes: `src/pages/api/harthmere/live_mode.ts` validates a
  `HarthmereLiveModeAuthorityEnvelope`, reduces it through
  `reduceHarthmereLiveModeBackendState`, then persists player/shared Redis state
  in one WATCH/MULTI transaction for the active runtime.
- Backend state reads: `src/pages/api/harthmere/live_mode_*_state.ts` endpoints
  are read-only projections. Derived repairs, stamina ticks, jobs-board seeds,
  and bank loan consequences can appear in the returned snapshot, but durable
  changes must be sent back through the live-mode writer.
- Actor identity healing: `src/server/harthmere/live_mode_actor_resolution.ts`
  may plan an install/user state adoption, but only the live-mode write
  transaction may move that state and delete the old duplicate key.
- Scheduled backend jobs: server-only schedulers, such as robot energy drain,
  must reduce through shared backend rules and write only backend shared state.
  They are part of the backend runtime authority, not client/local UI state.

## Duplicate-Write Rules

- Do not write the Harthmere death localStorage key outside
  `harthmereDeathStateStore.ts`.
- Do not make a new health store. Project health through
  `createHarthmereBiomesEcsHealth`.
- Do not make a second wallet UI path. Inventory writes emit the BiomesUI wallet
  event so the vitals panel reads one UI contract.
- Do not insert non-Biomes item or quest ids into ECS by hashing or fabricating
  ids. Add real Bikkie/challenge ids or keep them in the adapter with a warning.
- Do not persist gameplay changes from GET/read endpoints.
- Do not let live-mode Redis block a valid Glitch Cloud Save restore on boot.
- Do not treat browser localStorage alone as durable authority; it must be backed
  by Glitch Cloud Save.
- Do not copy duplicate install/user Redis player_state blobs outside the
  live-mode transaction; move-and-delete adoption belongs to the writer.

## Migration Notes

The bridge deliberately refuses to invent ECS ids for Harthmere-only strings.
That is slower than pretending everything is merged, but it prevents a more
dangerous split-brain state where ECS contains fake ids while live mode and
BiomesUI display real Harthmere content.
