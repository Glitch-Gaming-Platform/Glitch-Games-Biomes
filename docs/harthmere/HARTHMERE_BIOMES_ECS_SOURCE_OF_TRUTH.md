# Harthmere -> Biomes ECS Source Of Truth

This file is the contract for removing duplicate Harthmere state while keeping
the existing game playable during the merge.

## Rule

Biomes ECS is the sole gameplay authority for every physical or authored
Harthmere value: inventory, hotbar, equipment, player wallet, banked item
stacks, health/death, mana/stamina/breath, current standing, authored quests,
NPCs, transforms, containers, plants, terrain, deeds/ACLs, placeables, and
robot battery. Glitch Cloud Save and live-mode Redis are durable only for
Harthmere-specific contracts, timers, simulations, and financial metadata that
have no native ECS model. They must not project a competing copy over a native
component.

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
- Inventory, hotbar, wearing, wallet, and banked stacks: synchronized
  `Inventory`, `Wearing`, and `HarthmereMaterialStorage` components. The signed,
  replay-protected `HarthmereInventoryTransactionEvent` atomically changes the
  backpack, gold, material storage, personal bank, account bank, current
  standing, recipe grants, and robot recharge when one Harthmere operation
  spans those channels. A hotbar slot owns a real stack; BiomesUI lists that
  same stack in the inventory view without cloning it.
- Quests: all authored Grove and Bible quests are explicit Bikkie challenges
  with native challenge and step ids. `Challenges`, the native trigger tree,
  inventory/firehose events, and signed custom objective events own progress.
  Browser storage is applied only after the server accepts progress. Dynamic
  jobs-board contracts remain runtime Redis records and are projected into the
  journal without inventing challenge ids.
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
  actor-owned custom metadata. Production economy, jobs, gathering cooldowns,
  construction schedules, property finance, guild state, auctions, robot-area
  policy, and quest invitations are stored once in the appropriate player or
  shared record. Physical loot is a native `GrabBag`; physical plot ownership
  and build access are a native deed/ACL/protection entity; placed objects are
  native placeables. Shared authority schema version 2 replaces stale actor
  copies so retired metadata cannot resurrect a claimed drop, transferred
  property, or removed object.
- Actor identity healing: `src/server/harthmere/live_mode_actor_resolution.ts`
  may plan an install/user state adoption, but only the live-mode write
  transaction may move that state and delete the old duplicate key.
- Scheduled backend jobs: server-only schedulers must update the native
  component first whenever the state has an ECS representation. Robot drain
  advances `RobotComponent` and then derives Redis protection-area policy and
  display metadata. Player survival is ticked from server-read ECS position and
  terrain even when no HUD component is mounted.

## Explicit Native Ids And Transaction Boundaries

- `harthmere_native_id_manifest.ts` checks in permanent item, NPC, and recipe
  ids. `harthmere_native_quest_manifest.ts` checks in every authored challenge
  and step id. Runtime hashing is not an identity source.
- `harthmere_native_bikkie_items.ts` publishes exact item, NPC, recipe, and
  challenge biscuits. Presentation may be borrowed from the May 16 snapshot,
  but identity and gameplay semantics may not be aliased.
- `HarthmereInventoryTransactionEvent`, `HarthmerePlaceableTransactionEvent`,
  and `HarthmereQuestProgressEvent` are server-authorized and replay-protected.
  A failure rolls back every involved ECS component and does not write a replay
  receipt.
- `HarthmereEcsTransactionLedger` protects idempotency across retries. Material,
  personal, and account vault stacks live in `HarthmereMaterialStorage`; bank
  tiers, fees, loans, and transaction-log text remain custom metadata.
- Authored placeables use native `PlaceableComponent`, terrain occupancy,
  ownership, and ACL checks. Plot claims materialize native `DeedComponent`,
  `AclComponent`, `Protection`, and bounds; finance and construction workflow
  remain Redis metadata.

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
- Do not insert non-Biomes item, NPC, recipe, or quest ids into ECS by hashing or
  fabricating ids. Add an explicit checked-in manifest entry and its authored
  Bikkie contract.
- Do not persist gameplay changes from GET/read endpoints.
- Do not let live-mode Redis block a valid Glitch Cloud Save restore on boot.
- Do not treat browser localStorage alone as durable authority; it must be backed
  by Glitch Cloud Save.
- Do not copy duplicate install/user Redis player_state blobs outside the
  live-mode transaction; move-and-delete adoption belongs to the writer.
- Do not persist native physical state in shared-world Redis branches. Redis may
  retain the contract/outbox record needed to materialize or account for a
  native entity, but the entity, item stack, transform, health, container,
  deed/ACL, or terrain edit is authoritative only after ECS commits it.

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
- Every authored story/tutorial quest uses its checked-in challenge id, step
  ids, exact item ids, and exact NPC/entity ids. Thaedryn is a native NPC with
  native `Health`; the custom Bible state machine retains only story-choice
  metadata.
- Dynamic jobs-board todos are the deliberate exception: they are runtime
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
- Authored gathering nodes are validated entirely on the server: node location,
  equipped tool, profession, deterministic yield, legality, and shared respawn
  time. All 79 yield identities are explicit Bikkie ids and materialize as
  native `GrabBag` entities.
- Positioned-drop metadata is a retryable shared outbox, while the physical drop
  is a native `GrabBag`. Stable allocation and exact-content checks prevent a
  stale receipt from adopting an unrelated entity.
- Solid building materialization writes ECS terrain diff and placer components
  atomically. It refuses occupied voxels, refuses unexpected destructive edits,
  does not overwrite non-ground terrain, and marks Redis materialization complete
  only after the ECS write succeeds. Unacknowledged plans retry on read.

## Systems Intentionally Outside ECS

Redis may continue to own dynamic job contracts, business simulation and
staffing, auction listings/order books, loans/insurance/taxes/accounting,
guild/mail metadata, construction schedules and finance, quest invitations,
robot protection-area policy, and crafting/cooking timers. Their physical
effects still cross a signed native boundary: item/currency changes use the
inventory transaction, spawned loot uses native `GrabBag`, ownership uses
deeds/ACLs, and placed output uses native placeables or terrain edits.

Legacy browser-authored farming, livestock, combat, container, equipment, and
quest mutation routes remain closed in native mode. A disabled legacy route is
not a fallback authority. Native crops use plant events, ambient animals use
native NPC health/drops, and any future livestock product timer must identify a
real native animal and exchange feed/products through native inventory before
the feature is exposed.

## Migration Notes

Versioned migration is additive and idempotent. It copies legacy backpack,
wearing, recipe ownership, gold, vitals, material storage, personal bank, and
account bank data only when native migration versions require it. Runtime
mutations never repair ECS from a stale Redis projection. Unresolved or renamed
identities fail migration instead of creating a substitute id.
