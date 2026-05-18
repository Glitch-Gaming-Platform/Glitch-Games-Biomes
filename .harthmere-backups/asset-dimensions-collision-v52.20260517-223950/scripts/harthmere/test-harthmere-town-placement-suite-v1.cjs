#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const scriptsDir = path.join(root, "scripts/harthmere");

const checks = [
  "test-harthmere-quest-runtime-execution-v47.cjs",
  "test-harthmere-quest-runtime-rewards-authority-v47.cjs",
  "test-harthmere-quest-runtime-fail-abandon-retry-v47.cjs",
  "test-harthmere-quest-runtime-dialogue-journal-map-v47.cjs",
  "test-harthmere-main-quest-spaces-v47.cjs",
  "test-harthmere-main-quest-space-renderer-placement-v47.cjs",
  "test-harthmere-thaedryn-boss-v47.cjs",
  "test-harthmere-wilds-gameplay-loops-v47.cjs",
  "test-harthmere-bible-completion-audit-gate-v47.cjs",

  "test-harthmere-quest-catalog-total-coverage-v46.cjs",
  "test-harthmere-quest-giver-reward-v46.cjs",
  "test-harthmere-quest-activation-timing-v46.cjs",
  "test-harthmere-quest-objective-usecase-v46.cjs",
  "test-harthmere-quest-main-arc-sequence-v46.cjs",
  "test-harthmere-quest-side-catalog-v46.cjs",
  "test-harthmere-quest-state-machine-v46.cjs",
  "test-harthmere-quest-dialogue-contract-v46.cjs",
  "test-harthmere-quest-repeatable-hidden-v46.cjs",
  "test-harthmere-quest-runtime-api-contract-v46.cjs",
  "test-harthmere-quest-bell-tie-coverage-v46.cjs",

  "test-harthmere-npc-remaining-list-v45.cjs",
  "test-harthmere-npc-remaining-story-dialogue-v45.cjs",
  "test-harthmere-npc-remaining-routes-homes-v45.cjs",
  "test-harthmere-npc-remaining-quest-text-v45.cjs",
  "test-harthmere-npc-remaining-face-weapon-stats-inventory-clothing-v45.cjs",
  "test-harthmere-npc-total-coverage-v45.cjs",
  "test-harthmere-npc-runtime-placement-v45.cjs",
  "test-harthmere-npc-compendium-all-named-v44.cjs",
  "test-harthmere-npc-backstory-dialogue-v44.cjs",
  "test-harthmere-npc-routes-homes-v44.cjs",
  "test-harthmere-npc-quest-text-v44.cjs",
  "test-harthmere-npc-face-weapon-stats-inventory-clothing-v44.cjs",
  "test-harthmere-npc-runtime-placement-v44.cjs",
  "test-harthmere-service-buildings-block-build-v43.cjs",
  "test-harthmere-building-enclosure-v43.cjs",
  "test-harthmere-building-stairs-accessibility-v43.cjs",
  "test-harthmere-chapel-rebuild-v43.cjs",
  "test-harthmere-service-interior-buildout-v43.cjs",
  "test-harthmere-regression-fixes-v39.cjs",
  "test-harthmere-residential-slums-block-build-v40.cjs",
  "test-harthmere-residential-slums-housing-v38.cjs",
  "test-harthmere-housing-stone-shell-v42.cjs",
  "test-harthmere-town-collision-regression-v36.cjs",
  "test-harthmere-npc-size-and-social-regression-v36.cjs",
  "test-harthmere-npc-combat-ai-regression-v36.cjs",
  "test-harthmere-craftsman-row-exterior-identity-v34.cjs",
  "test-harthmere-suite-regression-fixes-v33.cjs",
  "test-harthmere-interior-enterability-blocker-fixes-v32.cjs",
  "test-harthmere-all-interior-building-enterability-v31.cjs",
  "test-harthmere-npc-height-expression-v30.cjs",
  "test-harthmere-npc-proportion-clothing-polish-v29.cjs",
  "test-harthmere-option-expression-contract-v26.cjs",
  "test-harthmere-appearance-option-expression-matrix-v25.cjs",
  "test-harthmere-builder-option-expression-matrix-v25.cjs",
  "test-harthmere-player-npc-expression-parity-v25.cjs",
  "test-harthmere-procedural-body-part-expression-v24.cjs",
  "test-harthmere-npc-visual-expression-v23.cjs",
  "test-harthmere-npc-visual-debug-contract-v23.cjs",
  "test-harthmere-retired-appearance-test-compat-v22.cjs",
  "test-harthmere-typescript-scope-final-v21.cjs",
  "test-harthmere-typescript-scope-sanity-v20.cjs",
  "test-harthmere-typescript-full-gate-v19.cjs",
  "test-harthmere-face-shape-scope-and-ts-v18.cjs",
  "test-harthmere-procedural-appearance-field-effect-matrix-v17.cjs",
  "test-harthmere-character-builder-field-effect-matrix-v17.cjs",
  "test-harthmere-procedural-body-face-clothing-behavior-v16.cjs",
  "test-harthmere-procedural-townsperson-full-feature-coverage-v14.cjs",
  "test-harthmere-character-builder-full-feature-coverage-v14.cjs",
  "test-harthmere-force-procedural-townsperson-clothing-v12.cjs",
  "test-harthmere-unified-hud-syntax-v1.cjs",
  "test-harthmere-typescript-syntax-smoke-v1.cjs",
  "test-harthmere-dialogue-no-development-meta-v1.cjs",
  "test-harthmere-dialogue-sheet-coverage-v1.cjs",
  "test-harthmere-dialogue-data-driven-nodes-v1.cjs",
  "test-harthmere-dialogue-choice-type-tags-v1.cjs",
  "test-harthmere-dialogue-non-annoying-pacing-v1.cjs",
  "test-harthmere-dialogue-memory-reputation-v1.cjs",
  "test-harthmere-dialogue-skill-class-attribute-v1.cjs",
  "test-harthmere-dialogue-merchant-guard-role-v1.cjs",
  "test-harthmere-dialogue-multiplayer-party-consent-v1.cjs",
  "test-harthmere-dialogue-localization-accessibility-v1.cjs",
  "test-harthmere-dialogue-ambient-cooldown-v1.cjs",
  "test-harthmere-dialogue-server-pipeline-v1.cjs",
  "test-harthmere-dialogue-edge-sheet-rules-v1.cjs",
  "test-harthmere-dialogue-fail-forward-v1.cjs",
  "test-harthmere-economy-sheet-coverage-v1.cjs",
  "test-harthmere-secondary-currency-policy-v1.cjs",
  "test-harthmere-regional-market-trade-route-v1.cjs",
  "test-harthmere-inflation-monitoring-health-v1.cjs",
  "test-harthmere-tax-fee-rounding-v1.cjs",
  "test-harthmere-item-value-repair-salvage-upgrade-v1.cjs",
  "test-harthmere-loot-drop-rarity-economy-v1.cjs",
  "test-harthmere-market-ui-anti-scam-v1.cjs",
  "test-harthmere-bot-rmt-new-player-endgame-v1.cjs",
  "test-harthmere-player-shop-work-order-services-v1.cjs",
  "test-harthmere-price-quote-lock-v1.cjs",

  "test-harthmere-player-trade-contract-v1.cjs",
  "test-harthmere-auction-listing-escrow-v1.cjs",
  "test-harthmere-auction-expiration-cancel-v1.cjs",
  "test-harthmere-auction-tax-market-history-v1.cjs",
  "test-harthmere-bank-storage-v1.cjs",
  "test-harthmere-shared-account-storage-v1.cjs",
  "test-harthmere-mail-attachments-cod-v1.cjs",
  "test-harthmere-overflow-recovery-v1.cjs",
  "test-harthmere-storage-service-npcs-v1.cjs",
  "test-harthmere-trade-auction-storage-edge-cases-v1.cjs",
  "test-harthmere-npc-ai-stack-contract-v1.cjs",
  "test-harthmere-npc-ai-navigation-v1.cjs",
  "test-harthmere-npc-ai-behavior-tree-v1.cjs",
  "test-harthmere-npc-ai-fsm-v1.cjs",
  "test-harthmere-npc-ai-utility-v1.cjs",
  "test-harthmere-npc-ai-goap-planner-v1.cjs",
  "test-harthmere-npc-ai-perception-memory-v1.cjs",
  "test-harthmere-npc-ai-role-coverage-v1.cjs",
  "test-harthmere-npc-ai-simulation-stress-v1.cjs",
  "test-harthmere-npc-ai-third-party-adapters-v1.cjs",
  "test-harthmere-npc-ai-third-party-navigation-v1.cjs",
  "test-harthmere-npc-ai-third-party-behavior3-v1.cjs",
  "test-harthmere-npc-ai-third-party-yuka-v1.cjs",
  "test-harthmere-npc-ai-third-party-runtime-availability-v1.cjs",
  'test-harthmere-react-json-view-migration-v1.cjs',
  'test-harthmere-emoji-mart-v5-migration-v1.cjs',
  "test-harthmere-stylelint15-prettier-cleanup-v1.cjs",
  "test-harthmere-ai-dependency-install-no-peer-bypass-v1.cjs",
  'test-harthmere-react18-dependency-compat-v2.cjs',
  'test-harthmere-npc-ai-package-compat-v1.cjs',
  'test-harthmere-npc-ai-dependency-install-command-v1.cjs',
  "test-harthmere-npc-ai-adapter-runtime-safety-v1.cjs",
  "test-harthmere-economy-contracts-v1.cjs",
  "test-harthmere-inventory-contracts-v1.cjs",
  "test-harthmere-vendor-contracts-v1.cjs",
  "test-harthmere-wallet-contracts-v1.cjs",
  "test-harthmere-reputation-economy-contracts-v1.cjs",
  "test-harthmere-gathering-economy-contracts-v1.cjs",
  "test-harthmere-guild-economy-contracts-v1.cjs",
  "test-harthmere-building-economy-contracts-v1.cjs",
  "test-harthmere-gathering-authority-v2.cjs",
  "test-harthmere-gathering-behavior-v2.cjs",
  "test-harthmere-building-authority-v2.cjs",
  "test-harthmere-building-behavior-v2.cjs",
  "test-harthmere-item-catalog-v1.cjs",
  "test-harthmere-item-instance-rules-v1.cjs",
  "test-harthmere-item-stack-rules-v1.cjs",
  "test-harthmere-item-storage-routing-v1.cjs",
  "test-harthmere-wallet-currency-v1.cjs",
  "test-harthmere-wallet-source-sink-ledger-v1.cjs",
  "test-harthmere-vendor-source-of-truth-v1.cjs",
  "test-harthmere-vendor-inventory-v1.cjs",
  "test-harthmere-vendor-pricing-v1.cjs",
  "test-harthmere-vendor-stock-state-v1.cjs",
  "test-harthmere-vendor-dialogue-exposure-v1.cjs",
  "test-harthmere-vendor-buy-transaction-v1.cjs",
  "test-harthmere-vendor-sell-transaction-v1.cjs",
  "test-harthmere-vendor-buyback-v1.cjs",
  "test-harthmere-vendor-stolen-goods-v1.cjs",
  "test-harthmere-economy-price-formula-v1.cjs",
  "test-harthmere-economy-supply-demand-v1.cjs",
  "test-harthmere-economy-shortage-surplus-v1.cjs",
  "test-harthmere-economy-idempotency-v1.cjs",
  "test-harthmere-economy-corrupt-state-recovery-v1.cjs",
  "test-harthmere-economy-storage-versioning-v1.cjs",
  "test-harthmere-economy-transaction-log-integrity-v1.cjs",
  "test-harthmere-vendor-live-ui-contract-v1.cjs",
  "test-harthmere-vendor-rapid-click-abuse-v1.cjs",
  "test-harthmere-inventory-full-capacity-v1.cjs",
  "test-harthmere-item-definition-cross-reference-v1.cjs",
  "test-harthmere-economy-balance-smoke-v1.cjs",
  "test-harthmere-economy-no-client-trust-v1.cjs",
  "test-harthmere-mount-collection-v1.cjs",
  "test-harthmere-pet-collection-v1.cjs",
  "test-harthmere-mount-pet-unlock-rules-v1.cjs",
  "test-harthmere-mount-pet-hotbar-v1.cjs",
  "test-harthmere-stable-service-v1.cjs",
  "test-harthmere-inventory-ui-filter-sort-v1.cjs",
  "test-harthmere-item-tooltip-contract-v1.cjs",
  "test-harthmere-item-destroy-confirmation-v1.cjs",
  "test-harthmere-safe-to-sell-ui-v1.cjs",
  "test-harthmere-durability-warning-ui-v1.cjs",
  "test-harthmere-dialogue-edge-cases-v1.cjs",
  "test-harthmere-dialogue-choice-idempotency-v1.cjs",
  "test-harthmere-dialogue-combat-interrupt-v1.cjs",
  "test-harthmere-dialogue-distance-disconnect-v1.cjs",
  "test-harthmere-dialogue-choice-revalidation-v1.cjs",
  "test-harthmere-dialogue-transcript-journal-v1.cjs",
  "test-harthmere-dialogue-consequence-warning-v1.cjs",
  "test-harthmere-quest-guidance-ui-v1.cjs",
  "test-harthmere-nearby-quest-helper-v1.cjs",
  "test-harthmere-quest-map-compass-markers-v1.cjs",
  "test-harthmere-quest-hint-escalation-v1.cjs",
  "test-harthmere-quest-notice-board-v1.cjs",
  "test-harthmere-quest-status-notifications-v1.cjs",
  "test-harthmere-quest-analytics-debug-v1.cjs",
  "test-harthmere-quest-type-contracts-v1.cjs",
  "test-harthmere-crime-detection-witness-v1.cjs",
  "test-harthmere-theft-pickpocket-lockpick-v1.cjs",
  "test-harthmere-guard-response-levels-v1.cjs",
  "test-harthmere-fine-confiscation-arrest-v1.cjs",
  "test-harthmere-bribe-corrupt-guard-v1.cjs",
  "test-harthmere-bounty-city-lockdown-v1.cjs",
  "test-harthmere-crime-evidence-memory-v1.cjs",
  "test-harthmere-server-inventory-authority-v1.cjs",
  "test-harthmere-server-wallet-authority-v1.cjs",
  "test-harthmere-server-trade-authority-v1.cjs",
  "test-harthmere-server-auction-authority-v1.cjs",
  "test-harthmere-server-mail-bank-authority-v1.cjs",
  "test-harthmere-server-quest-dialogue-authority-v1.cjs",
  "test-harthmere-client-spoof-rejection-v1.cjs",
  "test-harthmere-combat-system-integration-v1.cjs",
  "test-harthmere-combat-system-core-v1.cjs",
  "test-harthmere-complete-progression-catalogs-v1.cjs",
  "test-harthmere-complete-abilities-equipment-v1.cjs",
  "test-harthmere-complete-level-skill-loot-v1.cjs",
  "test-harthmere-complete-server-pvp-death-v1.cjs",
  "test-harthmere-complete-runtime-integration-v1.cjs",
  "test-harthmere-live-mode-readiness-contracts-v1.cjs",
  "test-harthmere-live-mode-action-pipelines-v1.cjs",
  "test-harthmere-live-mode-persistence-idempotency-v1.cjs",
  "test-harthmere-live-mode-ui-events-v1.cjs",
  "test-harthmere-live-mode-end-to-end-scenarios-v1.cjs",
  "test-harthmere-live-mode-production-hardening-v1.cjs",
  "test-harthmere-third-party-combat-ai-contracts-v1.cjs",
  "test-harthmere-third-party-combat-ai-behavior-fsm-v1.cjs",
  "test-harthmere-third-party-combat-ai-utility-movement-v1.cjs",
  "test-harthmere-third-party-combat-ai-adapters-v1.cjs",
  "test-harthmere-third-party-combat-ai-navigation-perception-v1.cjs",
  "test-harthmere-third-party-combat-ai-end-to-end-v1.cjs",
  "test-harthmere-third-party-combat-ai-production-hardening-v1.cjs",
  "test-harthmere-combat-animation-polish-regression-static-v1.cjs",
  "test-harthmere-combat-animation-polish-npc-player-runtime-v1.cjs",
  "test-harthmere-combat-animation-polish-magic-vfx-v1.cjs",
  "test-harthmere-combat-animation-polish-weapon-hand-sync-v1.cjs",
  "test-harthmere-combat-animation-polish-variation-motion-v1.cjs",
  "test-harthmere-combat-animation-tip-hilt-direction-v2.cjs",
  "test-harthmere-combat-animation-random-variation-v2.cjs",
  "test-harthmere-combat-animation-left-hand-policy-v2.cjs",
  "test-harthmere-combat-animation-per-frame-attachment-v3.cjs",
  "test-harthmere-combat-animation-impact-frame-sync-v3.cjs",
  "test-harthmere-combat-animation-mechanics-invariant-v3.cjs",
  "test-harthmere-combat-animation-weapon-family-coverage-v3.cjs",
  "test-harthmere-combat-animation-enemy-family-silhouette-v3.cjs",
  "test-harthmere-combat-animation-magic-readability-v3.cjs",
  "test-harthmere-combat-animation-state-cancellation-v3.cjs",
  "test-harthmere-combat-animation-death-respawn-visuals-v3.cjs",
  "test-harthmere-combat-animation-performance-budget-v3.cjs",
  "test-harthmere-combat-animation-browser-snapshot-v3.cjs",
  "test-harthmere-combat-animation-polish-catalog-v1.cjs",
  "test-harthmere-animation-handedness-death-bounds-v12.cjs",
  "test-harthmere-live-animation-scenario-regression-v11.cjs",
  "test-harthmere-body-weapon-aligned-clips-v8.cjs",
  "test-harthmere-animation-world-interaction-v10.cjs",
  "test-harthmere-sword-animation-runtime-v2.cjs",
  "test-harthmere-all-weapon-animation-runtime-v4.cjs",
  "test-harthmere-body-animation-weapon-sync-v5.cjs",
  "test-harthmere-body-weapon-visual-cohesion-v7.cjs",
  "test-harthmere-sword-animation-polish-v3.cjs",
  "test-harthmere-animation-action-chain-v1.cjs",
  "test-harthmere-animation-asset-coverage-v1.cjs",
  "test-harthmere-procedural-solid-asset-collision-v1.cjs",
  "test-harthmere-collision-radius-variants-v1.cjs",
  "test-harthmere-collision-performance-budget-v1.cjs",
  "check-harthmere-market-square-v1.cjs",
  "check-harthmere-player-services-plaza-v1.cjs",
  "check-harthmere-copper-kettle-inn-v1.cjs",
  "check-harthmere-craftsman-row-black-anvil-v1.cjs",
  "check-harthmere-noble-rise-v1.cjs",
  "check-harthmere-river-docks-v1.cjs",
  "check-harthmere-mudden-ward-v1.cjs",
  "check-harthmere-guard-yard-v1.cjs",
  "check-harthmere-old-well-underways-v1.cjs",
  "check-harthmere-temple-green-v1.cjs",
  "check-harthmere-town-collision-placement-v4.cjs",
  "check-harthmere-town-audit-export-v1.cjs",
  "check-harthmere-town-audit-pattern-fixes-v3.cjs",
  "test-harthmere-town-spacing-collision-solid-fixtures-v30.cjs",
  "test-harthmere-town-placement-building-design-v1.cjs",
  "test-harthmere-runtime-navigation-collision-v1.cjs",
  "test-harthmere-uploaded-asset-solid-collision-v1.cjs",
  "test-harthmere-solid-landmark-fixture-collision-v1.cjs",
  "test-harthmere-player-runtime-collision-bridge-v1.cjs",
  "test-harthmere-player-no-vertical-town-collision-by-default-v1.cjs",
  "test-harthmere-interior-room-sanity-v1.cjs",
  "test-harthmere-map-ui-discovery-filter-v1.cjs",
  "test-harthmere-npc-route-graph-v1.cjs",
  "test-harthmere-town-schedules-v1.cjs",
  "test-harthmere-law-restricted-areas-v1.cjs",
  "test-harthmere-danger-zone-communication-v1.cjs",
  "test-harthmere-event-state-mutation-v1.cjs",
  "test-harthmere-visual-readability-audit-v1.cjs",
  "test-harthmere-roof-street-block-cleanup-v5.cjs",
  "test-harthmere-mount-dismount-policy-v1.cjs",
  "test-harthmere-solid-collision-runtime-parity-v1.cjs",
  "test-harthmere-uploaded-asset-collision-shape-sanity-v1.cjs",
  "test-harthmere-player-spawn-and-district-entry-safety-v1.cjs",
  "test-harthmere-town-audit-live-collision-tools-v1.cjs",
  "test-harthmere-town-rule-coverage-completeness-v1.cjs",
  "test-harthmere-fixture-attachment-sanity-v1.cjs",
  "test-harthmere-wall-fixture-attachment-sanity-v1.cjs",
  "check-harthmere-bellbound-town-dungeon-expansion-v1.cjs",
  "check-harthmere-bellbound-missing-details-expansion-v2.cjs",
  "check-harthmere-remaining-interiors-and-dungeon-access-v1.cjs",
  "check-harthmere-building-dungeon-completion-v1.cjs",
  "check-harthmere-interior-expansion-regression-fixes-v2.cjs",
  "test-harthmere-character-builder-release-ui-v1.cjs",
  "test-harthmere-character-builder-all-fields-v1.cjs",
  "test-harthmere-character-builder-clothing-selection-v1.cjs",
  "test-harthmere-character-builder-save-into-game-v1.cjs",
  "test-harthmere-character-builder-edge-cases-v1.cjs",
  "test-harthmere-gathering-remainder-v3.cjs",
  "test-harthmere-building-remainder-v3.cjs",
];

let failed = 0;
console.log("== Harthmere town placement full test suite v1 ==");
console.log(`Root: ${root}`);
console.log("");

for (const file of checks) {
  const fullPath = path.join(scriptsDir, file);
  if (!fs.existsSync(fullPath)) {
    failed += 1;
    console.log(`FAIL missing ${file}`);
    console.log("");
    continue;
  }
  console.log(`---- ${file} ----`);
  const result = spawnSync(process.execPath, [fullPath, root], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    failed += 1;
    console.log(`---- RESULT: FAIL ${file} ----`);
  } else {
    console.log(`---- RESULT: PASS ${file} ----`);
  }
  console.log("");
}

console.log(`SUITE RESULT: ${failed === 0 ? "PASS" : `FAIL (${failed})`}`);
process.exit(failed === 0 ? 0 : 1);


// harthmere-full-animation-runtime-v6
// Full suite includes test-harthmere-full-animation-runtime-v6.cjs

// test-harthmere-creature-social-death-handtracking-v9.cjs

// Added by v13
// test-harthmere-attack-variation-clips-v13.cjs

// Added by visual fixes v14
// test-harthmere-visual-fixes-v14.cjs

// Added by v15
// test-harthmere-attack-variation-sequencing-v15.cjs

// Added by v17
// test-harthmere-attack-variation-polish-v17.cjs

// Added by v18
// test-harthmere-real-visual-animation-validation-v18.cjs

// Added by npc-social-quest-economy-v1: test-harthmere-npc-economy-behavior-v1.cjs

// Added by npc-social-quest-economy-v1: test-harthmere-npc-merchant-social-response-v1.cjs

// Added by npc-social-quest-economy-v1: test-harthmere-npc-crime-response-v1.cjs

// Added by npc-social-quest-economy-v1: test-harthmere-social-state-price-effects-v1.cjs

// Added by npc-social-quest-economy-v1: test-harthmere-quest-reward-economy-v1.cjs

// Added by npc-social-quest-economy-v1: test-harthmere-quest-item-protection-v1.cjs

// Added by npc-social-quest-economy-v1: test-harthmere-quest-repeat-reward-abuse-v1.cjs

// Added by npc-social-quest-economy-v1: test-harthmere-quest-vendor-unlocks-v1.cjs

// Harthmere release visual/TypeScript regression test: test-harthmere-character-builder-visual-polish-v2.cjs
'test-harthmere-typescript-release-blockers-v4.cjs'
'test-harthmere-character-builder-design-preview-v4.cjs'

// Harthmere release visual/TypeScript regression test: test-harthmere-typescript-release-blockers-v3.cjs


// v36 backup cleanup regression: test-harthmere-no-backup-files-v36.cjs

// v37 remaining issue regression coverage
"scripts/harthmere/test-harthmere-all-remaining-issues-v37.cjs";


// HARTHMERE_LIVING_QUARTERS_NPC_DISPERSAL_V48_SUITE
{
  const childProcess = require("child_process");
  const path = require("path");
  const root = process.argv[2] || process.cwd();
  childProcess.execFileSync(
    process.execPath,
    [path.join(root, "scripts/harthmere/test-harthmere-living-quarters-npc-dispersal-v48.cjs"), root],
    { stdio: "inherit" },
  );
}

// HARTHMERE_RENDERER_ANIMATION_SYNTAX_V49_SUITE
{
  const childProcess = require("child_process");
  const path = require("path");
  const root = process.argv[2] || process.cwd();
  childProcess.execFileSync(
    process.execPath,
    [path.join(root, "scripts/harthmere/test-harthmere-renderer-animation-syntax-v49.cjs"), root],
    { stdio: "inherit" },
  );
}
