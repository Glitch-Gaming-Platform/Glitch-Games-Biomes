# Harthmere -> Biomes ECS Source Of Truth

This file is the contract for removing duplicate Harthmere state while keeping
the existing game playable during the merge.

## Rule

Biomes ECS is the sole gameplay authority for native Biomes inventory, hotbar,
wearing, health/death, challenges, and trigger progress. Glitch Cloud Save is
durable only for Harthmere-specific player data that has no native ECS model.
Harthmere live-mode Redis is the transaction/runtime layer for those custom
systems; it must not project a second copy over synchronized native components.

BiomesUI is the UI source of truth. Player-facing Harthmere panels must either
be BiomesUI tabs/surfaces or BiomesUI-styled world interaction modals. Legacy
Harthmere HUD panels can remain mounted only as runtime controllers or no-op
compatibility shims.

Browser localStorage is only the compatibility cache used to build and apply
Glitch Cloud Save payloads. It is not durable authority by itself.

## Current Canonical Boundaries

- Health and death: the synchronized `Health` component and native
  `UpdatePlayerHealthEvent`. Fall and drowning damage are not mirrored into the
  Redis combat reducer while native authority is enabled.
- Inventory, hotbar, and wearing: synchronized `Inventory` and `Wearing`
  components changed only through native inventory events. A hotbar slot owns a
  real stack; BiomesUI also lists that stack in the inventory view without
  cloning it. Harthmere-only string item ids stay in the inventory-loot adapter
  until real Bikkie ids exist.
- Quests: synchronized `Challenges` plus the native trigger-state tree. The
  unified journal reads every native quest through `/challenges/all`; it does
  not maintain a Road Ahead progress mirror. String-only Harthmere quest ids
  remain adapter data and are never hashed or fabricated into ECS ids.
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
  are read-only projections under native authority. Durable changes must be
  sent through the live-mode writer; a GET must never tick stamina, create a
  death, or rewrite actor state.
- Backend player/shared ownership: Redis player records contain only
  actor-owned fields. Production economy, jobs, positioned custom loot,
  gathering-node cooldowns, plot ownership, active construction, completed
  properties, home decorations, free-world placeables, global
  structures/containers, guild state, auctions, robot protection, and quest
  invitations are stored once in the shared-world record and merged for
  reduction. Shared authority schema version 2 replaces stale actor copies so
  a claimed drop or deleted/transferred property cannot be resurrected.
- Actor identity healing: `src/server/harthmere/live_mode_actor_resolution.ts`
  may plan an install/user state adoption, but only the live-mode write
  transaction may move that state and delete the old duplicate key.
- Scheduled backend jobs: server-only schedulers, such as robot energy drain,
  must reduce through shared backend rules. When the system also has a native
  ECS representation, the scheduler must update it after the shared transaction;
  robot battery charge is synchronized into `RobotComponent` so movement,
  overlays, and websocket subscribers do not read a stale second value.

## Duplicate-Write Rules

- Do not write the Harthmere death localStorage key outside
  `harthmereDeathStateStore.ts`.
- Do not write `/ecs/c/health`, `/ecs/c/inventory`, `/ecs/c/wearing`, or
  `/ecs/c/challenges` from a client adapter. Publish the matching native event
  and wait for world-sync invalidation.
- Do not make a new health store or mirror native fall/drowning damage to
  live-mode Redis.
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
- Do not persist shared-world branches in every actor record. Mixed-ownership
  objects must explicitly retain only their actor fields. Plot ownership,
  active projects, properties, decorations, placeables, and positioned drops
  are shared; private jobs-board objective markers remain actor-owned.

## Native Quest and Item ID Rules

- A native quest uses its Bikkie challenge id, trigger ids, and exact Bikkie
  item ids from the authored trigger tree. The Road Ahead contract is recorded
  in `src/shared/harthmere/native_road_ahead_contract.ts` from the
  `data-snapshot-2026-05-16` backup.
- Native reward-choice objects remain `quest_giver` entities. They route through
  `CompleteQuestStepAtEntityEvent`; they are never opened as localStorage
  containers.
- Collection, wearing, crafting, placement, and item-taking progress comes from
  native firehose events emitted by the inventory/logic editors. A UI click is
  not quest progress by itself.
- Custom Harthmere quests may use string ids only inside their server-authority
  and UI adapter. Before migration into native ECS, publish real Bikkie item and
  challenge ids and replace the string objective/reward references. Never hash
  a string into a numeric id.
- Authored story quests should use native challenge ids and exact Bikkie item
  ids. Dynamic jobs-board todos are the deliberate exception: they are runtime
  contracts with server-generated string ids, remain in the shared jobs ledger,
  and are projected into BiomesUI without fabricating ECS challenge ids.

## Communication Contract

- Native ECS changes reach the browser through the existing sync websocket and
  invalidate React resources immediately.
- A Harthmere live-mode mutation returns changed snapshots in its HTTP response;
  the caller applies that response immediately. Polling is fallback hydration,
  not the primary mutation callback.
- Redis player writes are compact. Actor-only mutations skip full shared-world
  comparison/serialization; shared mutations retain WATCH/MULTI ownership and
  compare the shared projection before writing it.
- Authenticated production combat, NPC AI, death, environment damage, revive,
  and respawn requests are rejected by the live-mode HTTP route while native
  authority is enabled. Install-only/offline compatibility can still opt into
  the legacy reducer by explicitly disabling native authority.

## World-system authority rules

- Native NPC `Health` owns damage, death, drops, and `npcKilled` triggers for
  every Harthmere seed. The server validates melee center distance; voxel-edit
  reach is not combat reach.
- Fixed-id Harthmere creatures schedule their seed-reconciler cooldown from the
  native death transaction, preventing a corpse from being recreated as soon as
  ECS expiry removes it.
- Native plant harvests publish one `HarvestPlantEvent`; Gaia creates the native
  `GrabBag`. The retired HTTP harvest bridge is rejected under native authority.
- Custom gathering nodes that do not yet have authored Bikkie resources are
  validated entirely on the server: node location, equipped tool, profession,
  deterministic yield, carry weight, and shared respawn time. Their string-item
  inventory remains a compatibility system until real Bikkie ids are authored.
- Custom positioned drops are shared world state and use a server-read five-block
  pickup radius. Native Bikkie loot continues to use ECS `GrabBag` entities.
- Solid building materialization writes ECS terrain diff and placer components
  atomically. It refuses occupied voxels, refuses unexpected destructive edits,
  does not overwrite non-ground terrain, and marks Redis materialization complete
  only after the ECS write succeeds. Unacknowledged plans retry on read.

## Migration Notes

The bridge deliberately refuses to invent ECS ids for Harthmere-only strings.
That is slower than pretending everything is merged, but it prevents a more
dangerous split-brain state where ECS contains fake ids while live mode and
BiomesUI display real Harthmere content.
