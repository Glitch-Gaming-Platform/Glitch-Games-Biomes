# Harthmere Implementation Install README

This README documents the current Harthmere local-dev implementation work, the install/test flow, and the rules that should stay true as the project evolves.

It covers the systems added during the recent Test Driven Game Development pass:

- economy, inventory, vendors, wallets, trading, auction house, banking, mail, recovery
- NPC social behavior, schedules, routes, AI, and third-party AI adapters
- quest/economy integration and quest guidance
- law, crime, reputation, legal state, and social state
- mount and pet ownership systems
- inventory UI guidance, item tooltips, and safe-to-sell warnings
- dialogue cleanup, non-annoying dialogue rules, choice safety, and server-authoritative dialogue contracts
- React 18 / Node 20 dependency cleanup needed for third-party NPC AI packages

The goal is not just to have features. The goal is to have features that are hard to exploit, testable, and safe to expand.

---

## 1. Project assumptions

Primary project path used during this work:

```bash
/Users/devindixon/Development/biomes-game
```

Recommended Node/npm versions used during the dependency cleanup:

```bash
node v20.20.2
npm 10.8.2
```

Use the project root for all commands:

```bash
cd /Users/devindixon/Development/biomes-game
```

This repo does **not** currently expose a plain `npm run build` script. Use `npm run` to inspect available scripts before assuming one exists.

---

## 2. First-time dependency install / refresh

The third-party NPC AI pass added real packages for AI adapters:

- `yuka`
- `behavior3js`
- `recast-navigation`

The dependency cleanup also migrated several React 18 / Node 20 conflict packages:

- `@silevis/reactgrid` to the React 18 compatible line
- `emoji-mart` to v5 split packages
- `react-json-view` to `react18-json-view`
- removed obsolete Stylelint Prettier config packages for Stylelint 15+
- updated Kubernetes/ws-related compatibility targets

Use the guarded install script instead of raw guessing:

```bash
HARTHMERE_PACKAGE_LOCK_ONLY=1 \
bash scripts/harthmere/install-harthmere-ai-deps-v1.sh \
  /Users/devindixon/Development/biomes-game
```

Then run the real install:

```bash
bash scripts/harthmere/install-harthmere-ai-deps-v1.sh \
  /Users/devindixon/Development/biomes-game
```

The installer intentionally does **not** use npm peer-dependency bypass flags. Keep it that way. Do not hide dependency graph problems with force-style install behavior.

After the dependency cleanup, the expected runtime availability check should say:

```text
OK yuka is installed in node_modules
OK behavior3js is installed in node_modules
OK recast-navigation is installed in node_modules
```

---

## 3. Main test command

Run the full Harthmere suite from the project root:

```bash
node scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

Expected result:

```text
SUITE RESULT: PASS
```

This suite now includes town placement, collision, animation, economy, NPC behavior, third-party AI adapters, trading, banking, mail, mount/pet systems, crime/law, quest guidance, and dialogue rule coverage.

---

## 4. Optional live/browser tests

Some tests are static/contract tests. Some browser probes are optional and only run if a live URL is supplied.

Example:

```bash
HARTHMERE_E2E_URL="http://localhost:3000/at/mars" \
node scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs \
  /Users/devindixon/Development/biomes-game
```

If `HARTHMERE_E2E_URL` is not set, live probes may be skipped with an `INFO` message. That is expected.

---

## 5. System map

### Economy and inventory

Important files:

```text
src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx
src/client/components/challenges/LocalDevHarthmereEconomySystem.tsx
src/client/components/challenges/LocalDevHarthmereVendorCatalog.ts
src/client/components/challenges/LocalDevHarthmereEconomyHardening.ts
src/client/components/challenges/LocalDevHarthmereTradeAuctionSystem.tsx
src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx
src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx
```

Coverage added:

- unified vendor catalog
- item catalog and item instance rules
- wallet and currency rules
- dynamic vendor pricing
- vendor stock, vendor gold, restock state
- buying, selling, stolen goods, laundering, buyback-ready transaction history
- auction listing, escrow, expiration, cancellation, sale tax, market history
- player-to-player trade confirmation, lock state, atomic transfer, disconnect cancel
- bank storage, account storage, material deposit, mail attachments, COD, overflow, recovery
- secondary currency policies
- regional markets and trade routes
- inflation monitoring and economy health checks
- tax/fee rounding and quote locking
- item value, repair, salvage, and upgrade formulas
- loot/drop rarity economy
- market UI and anti-scam warnings
- bot/RMT detection, new-player protection, and endgame sinks

Core rule: client-side local-dev economy code is not production authority. The production economy must validate item ownership, currency, prices, permissions, and transaction IDs server-side.

---

### NPC behavior, routes, schedules, and AI

Important files:

```text
src/client/components/challenges/LocalDevHarthmereNpcBehaviorSystem.ts
src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts
src/client/components/challenges/LocalDevHarthmereNpcThirdPartyAiAdapters.ts
```

Coverage added:

- merchant, guard, civilian, peasant, thief, priest, noble, craftsman, service, scholar, and creature AI profiles
- all known NPC offsets covered by role AI
- time-of-day schedules and routes
- behavior tree / FSM / utility AI / GOAP / perception-memory / squad blackboard
- Yuka, Behavior3JS, and recast-navigation adapter layer
- deterministic fallback when third-party packages are unavailable

Third-party AI packages must stay behind dynamic imports. The main AI system should import the local adapter, not top-level import those packages directly.

---

### Quest and dialogue systems

Important files:

```text
src/client/components/challenges/LocalDevHarthmereQuests.tsx
src/client/components/challenges/LocalDevHarthmereDialogueSystem.tsx
src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx
src/client/components/challenges/LocalDevHarthmereDialogueRuleSystem.tsx
src/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem.tsx
src/client/components/challenges/LocalDevHarthmereQuestEconomySystem.ts
```

Coverage added:

- quest reward economy ledger
- duplicate reward prevention
- repeatable quest cooldown/cap rules
- quest item protection and recovery
- quest vendor unlocks
- quest guidance UI contracts
- nearby quest helper
- journal sections
- recommended next quest logic
- map markers, compass markers, search-area markers
- hint escalation
- notice boards
- quest analytics/debug contracts
- dialogue request IDs
- choice idempotency
- combat/NPC death/distance/disconnect interruption rules
- choice revalidation on selection
- hostile NPC restrictions
- transcript/history/journal summaries
- skip and fast-forward support
- consequence warnings
- multiplayer/party consent rules
- localization/accessibility contracts

Important dialogue rule: NPC dialogue must be role/world-facing, not system-facing. Do not put dev/test/debug/game-mechanic explanations into NPC speech.

---

### Law, crime, social state, and reputation

Important files:

```text
src/client/components/challenges/LocalDevHarthmereReputation.tsx
src/client/components/challenges/LocalDevHarthmereCrimeLawSystem.tsx
```

Coverage added:

- likeability, legal standing, notoriety
- merchant pricing effects
- lawful vendor refusal
- criminal/fence support
- guard responses
- theft, pickpocket, lockpick, trespass escalation
- witness and evidence memory
- line-of-sight/noise/lighting/disguise/guard alertness/crowd density modifiers
- fines, confiscation, arrest/jail/community service hooks
- bribes and corrupt guard behavior
- bounties, outlaw state, public enemy escalation, city lockdown

---

### Mount and pet collections

Important file:

```text
src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx
```

Coverage added:

- mount collection
- pet collection
- learned mount/pet unlocks
- binding rules
- hotbar usage
- learned tokens cannot be sold after learning
- mount equipment slots
- pet ability slots
- stable service integration

---

### Inventory guidance and item tooltips

Important file:

```text
src/client/components/challenges/LocalDevHarthmereInventoryGuidance.tsx
```

Coverage added:

- inventory search
- inventory sort
- category filters
- tooltip source
- binding state
- tradeability
- vendor value
- use effect
- cooldown
- equip requirements
- safe-to-sell state
- destroy confirmation
- quest item warning
- durability warning
- stat comparison

---

### Server-authoritative contracts

Important file:

```text
src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx
```

Coverage added:

- server-side item ownership model contract
- wallet authority contract
- trade session contract
- auction escrow contract
- bank/mail storage contract
- quest progress contract
- dialogue choice validation contract
- reputation/legal update contract
- transaction IDs
- idempotency keys
- rollback/recovery
- audit logs
- client spoof rejection

This is still a contract layer. Real production MMO authority must be implemented server-side with database transactions.

---

## 6. Dialogue cleanup rules

The latest dialogue pass added a scanner to block development/test/meta dialogue. NPCs should not say things like:

```text
How do conversations work here?
Dialogue choices are labeled...
local-dev dialogue memory
mission journal
Current lead:
game mechanics
test dialogue
debug dialogue
```

NPCs should talk about their role, their district, the current town situation, their services, their fears, their work, their relationships, and the player’s reputation/legal state.

Bad:

```text
They keep the conversation practical and have room for you.
```

Good:

```text
The quartermaster checks the repair ledger and nods toward the forge. "If your blade is chipped, show me before sunset. Iron is dear this week."
```

---

## 7. How to add a new Harthmere feature safely

Use this checklist:

1. Add or update the system file.
2. Add focused tests under `scripts/harthmere/`.
3. Add the test to `scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs`.
4. Keep local-dev state keys versioned, usually ending in `.v1`.
5. Add reset/debug paths for local-dev state.
6. Add transaction/log paths for any economy or ownership mutation.
7. Do not trust client-side state for production contracts.
8. Do not add NPC dialogue that explains tests, dev state, local-dev systems, or game mechanics.
9. Run the full suite.

---

## 8. Common troubleshooting

### Syntax error in the suite file

Run:

```bash
node -c scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs
```

Then inspect the first 80 lines:

```bash
sed -n '1,80p' scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs
```

Common issue: a test name string with mismatched quotes.

---

### Dependency install fails with ERESOLVE

Do not use peer-dependency bypass flags. Run the audit runner:

```bash
bash scripts/harthmere/run-harthmere-npm-peer-audit-v1.sh \
  /Users/devindixon/Development/biomes-game
```

Then fix the actual incompatible package instead of hiding the resolver issue.

---

### `npm run build` is missing

This repo has `build:deploy`, but not a plain `build` script. Inspect scripts with:

```bash
npm run
```

Use the Harthmere test suite as the main validation command unless a project-specific build/check command is added.

---

### npm audit reports vulnerabilities

Do not run major force upgrades blindly. First capture the report:

```bash
npm audit --json > /tmp/biomes-npm-audit.json
npm audit
```

Then group fixes by direct dependency and patch them deliberately.

---

## 9. Important test groups added during this pass

### Economy foundation

```text
test-harthmere-economy-contracts-v1.cjs
test-harthmere-inventory-contracts-v1.cjs
test-harthmere-vendor-contracts-v1.cjs
test-harthmere-wallet-contracts-v1.cjs
test-harthmere-reputation-economy-contracts-v1.cjs
test-harthmere-gathering-economy-contracts-v1.cjs
test-harthmere-guild-economy-contracts-v1.cjs
test-harthmere-building-economy-contracts-v1.cjs
```

### Item, wallet, vendor, and economy hardening

```text
test-harthmere-item-catalog-v1.cjs
test-harthmere-item-instance-rules-v1.cjs
test-harthmere-item-stack-rules-v1.cjs
test-harthmere-item-storage-routing-v1.cjs
test-harthmere-wallet-currency-v1.cjs
test-harthmere-wallet-source-sink-ledger-v1.cjs
test-harthmere-vendor-source-of-truth-v1.cjs
test-harthmere-vendor-inventory-v1.cjs
test-harthmere-vendor-pricing-v1.cjs
test-harthmere-vendor-stock-state-v1.cjs
test-harthmere-vendor-dialogue-exposure-v1.cjs
test-harthmere-economy-idempotency-v1.cjs
test-harthmere-economy-corrupt-state-recovery-v1.cjs
test-harthmere-economy-transaction-log-integrity-v1.cjs
```

### NPC AI and third-party AI packages

```text
test-harthmere-npc-ai-stack-contract-v1.cjs
test-harthmere-npc-ai-navigation-v1.cjs
test-harthmere-npc-ai-behavior-tree-v1.cjs
test-harthmere-npc-ai-fsm-v1.cjs
test-harthmere-npc-ai-utility-v1.cjs
test-harthmere-npc-ai-goap-planner-v1.cjs
test-harthmere-npc-ai-perception-memory-v1.cjs
test-harthmere-npc-ai-role-coverage-v1.cjs
test-harthmere-npc-ai-simulation-stress-v1.cjs
test-harthmere-npc-ai-third-party-adapters-v1.cjs
test-harthmere-npc-ai-third-party-runtime-availability-v1.cjs
```

### Trading, auction, banking, mail, and recovery

```text
test-harthmere-player-trade-contract-v1.cjs
test-harthmere-auction-listing-escrow-v1.cjs
test-harthmere-auction-expiration-cancel-v1.cjs
test-harthmere-auction-tax-market-history-v1.cjs
test-harthmere-bank-storage-v1.cjs
test-harthmere-shared-account-storage-v1.cjs
test-harthmere-mail-attachments-cod-v1.cjs
test-harthmere-overflow-recovery-v1.cjs
test-harthmere-storage-service-npcs-v1.cjs
test-harthmere-trade-auction-storage-edge-cases-v1.cjs
```

### Dialogue and quest guidance

```text
test-harthmere-dialogue-no-development-meta-v1.cjs
test-harthmere-dialogue-sheet-coverage-v1.cjs
test-harthmere-dialogue-data-driven-nodes-v1.cjs
test-harthmere-dialogue-choice-type-tags-v1.cjs
test-harthmere-dialogue-non-annoying-pacing-v1.cjs
test-harthmere-dialogue-memory-reputation-v1.cjs
test-harthmere-dialogue-skill-class-attribute-v1.cjs
test-harthmere-dialogue-merchant-guard-role-v1.cjs
test-harthmere-dialogue-multiplayer-party-consent-v1.cjs
test-harthmere-dialogue-localization-accessibility-v1.cjs
test-harthmere-dialogue-ambient-cooldown-v1.cjs
test-harthmere-dialogue-server-pipeline-v1.cjs
test-harthmere-dialogue-edge-sheet-rules-v1.cjs
test-harthmere-dialogue-fail-forward-v1.cjs
```

### Mount/pet, inventory guidance, law/crime, and server authority

```text
test-harthmere-mount-collection-v1.cjs
test-harthmere-pet-collection-v1.cjs
test-harthmere-mount-pet-unlock-rules-v1.cjs
test-harthmere-mount-pet-hotbar-v1.cjs
test-harthmere-stable-service-v1.cjs
test-harthmere-inventory-ui-filter-sort-v1.cjs
test-harthmere-item-tooltip-contract-v1.cjs
test-harthmere-item-destroy-confirmation-v1.cjs
test-harthmere-safe-to-sell-ui-v1.cjs
test-harthmere-durability-warning-ui-v1.cjs
test-harthmere-crime-detection-witness-v1.cjs
test-harthmere-theft-pickpocket-lockpick-v1.cjs
test-harthmere-guard-response-levels-v1.cjs
test-harthmere-fine-confiscation-arrest-v1.cjs
test-harthmere-bribe-corrupt-guard-v1.cjs
test-harthmere-bounty-city-lockdown-v1.cjs
test-harthmere-crime-evidence-memory-v1.cjs
test-harthmere-server-inventory-authority-v1.cjs
test-harthmere-server-wallet-authority-v1.cjs
test-harthmere-server-trade-authority-v1.cjs
test-harthmere-server-auction-authority-v1.cjs
test-harthmere-server-mail-bank-authority-v1.cjs
test-harthmere-server-quest-dialogue-authority-v1.cjs
test-harthmere-client-spoof-rejection-v1.cjs
```

---

## 10. Current status

Local-dev gameplay and contract-test coverage is strong. The main remaining gap is production implementation:

- real server-side economic authority
- real database transactions
- true multiplayer concurrency tests
- live browser E2E coverage for all player-facing flows
- admin dashboards for economy/abuse monitoring

Until those exist, treat the current Harthmere systems as a serious local-dev gameplay implementation plus a production contract layer, not as a finished production MMO backend.
