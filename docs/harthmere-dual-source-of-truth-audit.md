# Harthmere — Dual Source-of-Truth Audit

Catalog of every place the same state or data is owned/computed by two independent systems.

## Changes applied so far

- **HP (Tier 1)** — unified: the local combat sim no longer writes HP into the server-authoritative player-status channel (`playerStatusAdapter.ts`).
- **Stamina (Tier 1)** — unified: introduced a shared authority signal `harthmereLiveAuthoritySignal.ts` (`markHarthmereLiveSnapshotSeen` / `harthmereLiveSnapshotPresent`), set whenever the server player-status poll/event lands. The client stamina drain + starvation death (`LocalDevHarthmereFoodStaminaSystem.tsx`) now **defers to the server** whenever a live snapshot is present — killing the "kills you twice" double-death. Logic extracted to the pure, tested `harthmereClientStaminaTickPlanForTest`.
- **Campfire HP heal (Tier 1)** — unified: suppressed while the server owns HP (gated inside `harthmereCampfireWarmthHealDecisionForTest`).
- **Vendor catalog (Tier 3)** — unified: the byte-identical client copy in `LocalDevHarthmereVendorCatalog.ts` was deleted; that module now re-exports the single shared definition in `shared/harthmere/harthmere_vendor_catalog.ts` (legacy type names kept as aliases).
- Tests added/updated: `harthmereLiveAuthoritySignal.test.ts` (new), `LocalDevHarthmereFoodStaminaSystem.test.ts` (stamina-plan + campfire-gating cases).

The remaining items below (mana/gold/level/reputation display, and the full Tier 2 subsystem migration) are **not yet actioned** — see notes per row.

## The core pattern

Harthmere runs **two parallel implementations of the same game**:

- **Client simulations** — 43 `LocalDevHarthmere*.tsx/.ts` files (~46,000 lines) under `src/client/components/challenges/`, each persisting its own state to a `localStorage` key (`biomes.localDev.harthmere.*`).
- **Server authority** — `src/shared/harthmere/live_mode_backend.ts` (~15,000 lines), with a model for each subsystem, exposed through `src/pages/api/harthmere/live_mode_*_state.ts` GET endpoints and mutated via `POST /api/harthmere/live_mode`.

Both compute the same runtime values (HP, stamina, mana, gold, inventory counts, reputation, quest progress, …). The UI joins them through adapters in `src/client/components/biomes_ui/adapters/` (central policy: `liveStateHydrationPolicy.ts`; vitals: `playerStatusAdapter.ts`; inventory/food: `useBiomesUILiveAdapters.ts`). When the two disagree, fallback heuristics pick one — and when the pick flips frame-to-frame you get visible bugs (this is what caused the HP "jumping" bug).

**Important constraint:** the client sims are also (a) the offline / local-dev mode and (b) the instant-feedback + render-bridge layer in live mode. So "one source of truth" should mean *the server owns the value whenever a server snapshot exists; the client sim stops independently owning/ticking it* — not deleting the files outright.

---

## Tier 1 — Live runtime values with two owners (highest impact; these actively conflict)

| Value | Client owner (localStorage key) | Server owner | Join / reconciler | Recommended single source | Status |
|---|---|---|---|---|---|
| **HP** | `LocalDevHarthmereCombat.tsx` (`combatState`) | `live_mode_backend` `combat.hp` → `player_status_state` | `playerStatusAdapter.ts` `shouldPreferFallbackCombatVitals` | **Server** (client = view only) | ✅ Unified — local sim no longer writes HP into the shared status channel |
| **Stamina** | `LocalDevHarthmereFoodStaminaSystem.tsx` (`foodStaminaState`) | `farming.stamina` → `farming_food_state` + `player_status_state.combat.resources.stamina` | `HarthmereUnifiedHUD` `biomesUIVitalsStaminaDisplayForTest` | **Server** (client tick + death now gated on `harthmereLiveSnapshotPresent`) | ✅ Unified — client no longer double-drains or double-kills |
| **Mana** | `LocalDevHarthmereMultiplayerCombatSystem.tsx` (`multiplayerCombatState.mana`) | `combat.resources.mana` → `player_status_state` | `biomesUIVitalsCombatResourceDisplayForTest` | **Server** | ❌ |
| **Death / respawn state** | `LocalDevHarthmereDeathSystem.tsx` (`deathState`, `teleportTarget`) | `combat.deathState` / `lastDeath` → `player_status_state` | `HarthmereUnifiedHUD` `deathScreenActive`; adapter | **Server** (death system already POSTs and re-dispatches the server snapshot for respawn) | ⚠️ Partial — respawn is server-fed, but local death state is still an independent owner |
| **Level / XP** | `LocalDevHarthmereLevelingSystem.tsx` (`levelingState`) | `classMagic` / progression → `progression_state` + `player_status_state.xp/level` | `biomesUIVitalsDisplayFromLiveStatusForTest` | **Server** | ❌ |
| **Gold** | `LocalDevHarthmereInventorySystem` / `LocalDevHarthmereEconomyHardening.ts` (`inventoryState`, `economyState`) | `inventory.gold` → `economy_state` / `player_status_state.gold` | inventory + status adapters | **Server** `inventory.gold` | ❌ |
| **Reputation / standing** | `LocalDevHarthmereReputation.tsx` (`reputation`, `reputationState`) | `reputation` / `standing` → `player_status_state.standing` (also fed by `dialogueLiveModeReputation.ts`) | `HarthmereUnifiedHUD` reputation merge | **Server** | ❌ |

---

## Tier 2 — Subsystem state stores (client sim ↔ server model + endpoint)

Each row is a full parallel state store. Client keys are under `biomes.localDev.harthmere.`; server GET endpoints are under `src/pages/api/harthmere/`.

| Subsystem | Client sim file (key) | Server model | Server GET endpoint | Recommended single source |
|---|---|---|---|---|
| Inventory / loot | `LocalDevHarthmereInventorySystem.tsx`, `LocalDevHarthmereEconomyHardening.ts` (`inventoryState`) | `inventory`, `inventoryLoot` | `live_mode_inventory_loot_state` | Server |
| Food / farming / stamina | `LocalDevHarthmereFoodStaminaSystem.tsx` (`foodStaminaState`) | `farming` | `live_mode_farming_food_state` | Server |
| Economy / vendors | `LocalDevHarthmereEconomySystem.tsx`, `LocalDevHarthmereVendorCatalog.ts` (`economyState`, `vendorStockState`) | `economy` | `live_mode_economy_state` | Server |
| Banking / material storage | `LocalDevHarthmereStorageMailRecoverySystem.tsx` (`storageMailRecoveryState`) | `banking` | `live_mode_bank_state` | Server |
| Building / property | `LocalDevHarthmereBuildingSystem.tsx` (`buildingState`) | `building` | `live_mode_building_state` | Server |
| Guild | `LocalDevHarthmereGuildSystem.tsx` (`guildState`) | `guild` | `live_mode_guild_state` | Server |
| Quests | `LocalDevHarthmereQuests.tsx`, `LocalDevHarthmereQuestRuntime.tsx`, `LocalDevHarthmereQuestEconomySystem.ts` (`questState`, `questEconomyState`) | `quests` | `live_mode_quest_state` | Server |
| Jobs board | (jobs board adapter / rewards `jobsBoardRewardsGranted`) | jobs board | `live_mode_jobs_board_state` | Server |
| Class / skills / progression | `LocalDevHarthmereClassSkillSystem.tsx`, `LocalDevHarthmereLevelingSystem.tsx` (`classSkillState`, `levelingState`) | `classMagic` | `live_mode_progression_state` | Server |
| Daily tasks | `harthmereDailyTasks.ts` | daily | `live_mode_daily_state` | Server |
| Gathering | `LocalDevHarthmereGatheringSystem.tsx` (`gatheringState`) | `farming` / loot claims | (folded into farming/loot) | Server |
| Missions | `LocalDevHarthmereMissionSystem.tsx` (`trackedMissions`, `missionEvents`) | `quests` | `live_mode_quest_state` | Server |
| Trade / auction | `LocalDevHarthmereTradeAuctionSystem.tsx` (`tradeAuctionState`) | economy (partial) | — | Server if a model exists; else client-only is fine |
| NPC AI / entities | `LocalDevHarthmereNpcAiSystem.ts` (`npcAi.memory/decisionLog`), `LocalDevHarthmereMultiplayerCombatSystem.tsx` | `combat.entitySnapshots` | (via live mode combat) | Server for authoritative HP/position; client for animation only |
| Dialogue | `LocalDevHarthmereDialogueSystem.tsx`, `DialogueSafetySystem` (`dialogueMemory`, `dialogueSafety`) | dialogue live mode (`dialogueLiveModeReputation.ts`) | POST live_mode | Server for reputation effects; client for local memory |
| Mount / pet collection | `LocalDevHarthmereMountPetCollections.tsx` (`mountPetCollection`) | — (no clear server model found) | — | Likely client-only already — verify, then declare single |

---

## Tier 3 — Duplicated static data (safe, clear consolidations)

| Data | Location A | Location B | Action |
|---|---|---|---|
| **Vendor catalog** | ~~`client/components/challenges/LocalDevHarthmereVendorCatalog.ts`~~ — client copy **deleted**, now re-exports the shared one | `shared/harthmere/harthmere_vendor_catalog.ts` `HARTHMERE_VENDOR_CATALOG` (single definition) | ✅ Done — client re-exports shared; legacy `HarthmereUnifiedVendor*` type names kept as aliases |

Not duplicated (already single-sourced — good): `HARTHMERE_FOOD_DEFINITIONS` and `HARTHMERE_COOKING_RECIPES` live once in `shared/harthmere/mmo_farming_food_stamina.ts` and are imported by both client and server.

---

## Tier 4 — Within-server duplication (same value in multiple server models)

- **Gold** is stored authoritatively in `inventory.gold` but surfaced/copied into `economy_state`, `player_status_state.gold`, and `inventoryLoot.actors[].gold` (see `ensureInventoryLootActorSynced`, lines ~7902 & ~8085 of `live_mode_backend.ts`). These are kept in sync by copy — acceptable as long as `inventory.gold` remains the sole writer and the others are derived views. Worth asserting that invariant in one place.
- **Stamina** exists in both `farming.stamina` and `combat.resources.stamina` server-side, synced in `applyLiveFarmingAuthorityResult`. Pick `combat.resources.stamina` as canonical and derive the farming view, or vice versa — but only one should be written.

---

## Recommended consolidation order (when you're ready)

1. **Tier 1 vitals** (stamina, mana, death, gold, level, reputation) — apply the same fix already used for HP: in `HarthmereUnifiedHUD` / adapters, when a server snapshot exists, the client sim value is display-only and the client stops ticking/writing it. Gate each client `RuntimeController` (`setInterval` tick) on "no live snapshot present." Lowest risk, kills the visible flicker/conflict bugs. Start with **stamina** (it can currently kill you twice).
2. **Tier 3 vendor catalog** — pure deletion of the duplicate constant; re-export from `shared/`. Safe, do anytime.
3. **Tier 4 within-server** — declare one canonical field per value (gold → `inventory.gold`, stamina → `combat.resources.stamina`) and make the others read-only derivations.
4. **Tier 2 full subsystems** — convert each client sim to a pure view of its server model, one subsystem at a time, behind the existing adapters, each with tests. Keep the sim files as the offline-mode fallback. This is the large, staged work; do **not** delete the 43 sim files wholesale — that removes offline mode and breaks hundreds of imports.

## How to detect "live mode is active" (needed for the gating in step 1)

There is no single `isLiveMode` flag today. The reliable signal is "a server snapshot has been received" — e.g. `useBiomesUIPlayerStatusState()` returned a non-undefined value, or the relevant `fetch*State` succeeded. Introducing one small shared `harthmereLiveSnapshotPresent()` helper and gating every client `RuntimeController` tick on it would centralize the authority decision.
