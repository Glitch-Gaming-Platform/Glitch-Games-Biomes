#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const scriptsDir = path.join(root, "scripts/harthmere");

const checks = [
  "test-harthmere-living-quarters-performance.cjs",
  "test-harthmere-bible-implementation-audit.cjs",
  "test-harthmere-quest-runtime-execution.cjs",
  "test-harthmere-quest-runtime-rewards-authority.cjs",
  "test-harthmere-quest-runtime-fail-abandon-retry.cjs",
  "test-harthmere-quest-runtime-dialogue-journal-map.cjs",
  "test-harthmere-main-quest-spaces.cjs",
  "test-harthmere-main-quest-space-renderer-placement.cjs",
  "test-harthmere-thaedryn-boss.cjs",
  "test-harthmere-wilds-gameplay-loops.cjs",
  "test-harthmere-bible-completion-audit-gate.cjs",

  "test-harthmere-quest-catalog-total-coverage.cjs",
  "test-harthmere-quest-giver-reward.cjs",
  "test-harthmere-quest-activation-timing.cjs",
  "test-harthmere-quest-objective-usecase.cjs",
  "test-harthmere-quest-main-arc-sequence.cjs",
  "test-harthmere-quest-side-catalog.cjs",
  "test-harthmere-quest-state-machine.cjs",
  "test-harthmere-quest-dialogue-contract.cjs",
  "test-harthmere-quest-repeatable-hidden.cjs",
  "test-harthmere-quest-runtime-api-contract.cjs",
  "test-harthmere-quest-bell-tie-coverage.cjs",

  "test-harthmere-npc-remaining-list.cjs",
  "test-harthmere-npc-remaining-story-dialogue.cjs",
  "test-harthmere-npc-remaining-routes-homes.cjs",
  "test-harthmere-npc-remaining-quest-text.cjs",
  "test-harthmere-npc-remaining-face-weapon-stats-inventory-clothing.cjs",
  "test-harthmere-npc-total-coverage.cjs",
  "test-harthmere-npc-runtime-placement.cjs",
  "test-harthmere-npc-compendium-all-named.cjs",
  "test-harthmere-npc-backstory-dialogue.cjs",
  "test-harthmere-npc-routes-homes.cjs",
  "test-harthmere-npc-quest-text.cjs",
  "test-harthmere-npc-face-weapon-stats-inventory-clothing.cjs",
  "test-harthmere-npc-runtime-placement.cjs",
  "test-harthmere-service-buildings-block-build.cjs",
  "test-harthmere-building-enclosure.cjs",
  "test-harthmere-building-stairs-accessibility.cjs",
  "test-harthmere-chapel-rebuild.cjs",
  "test-harthmere-service-interior-buildout.cjs",
  "test-harthmere-regression-fixes.cjs",
  "test-harthmere-residential-slums-block-build.cjs",
  "test-harthmere-residential-slums-housing.cjs",
  "test-harthmere-housing-stone-shell.cjs",
  "test-harthmere-town-collision-regression.cjs",
  "test-harthmere-npc-size-and-social-regression.cjs",
  "test-harthmere-npc-combat-ai-regression.cjs",
  "test-harthmere-craftsman-row-exterior-identity.cjs",
  "test-harthmere-suite-regression-fixes.cjs",
  "test-harthmere-interior-enterability-blocker-fixes.cjs",
  "test-harthmere-all-interior-building-enterability.cjs",
  "test-harthmere-npc-height-expression.cjs",
  "test-harthmere-npc-proportion-clothing-polish.cjs",
  "test-harthmere-option-expression-contract.cjs",
  "test-harthmere-appearance-option-expression-matrix.cjs",
  "test-harthmere-builder-option-expression-matrix.cjs",
  "test-harthmere-player-npc-expression-parity.cjs",
  "test-harthmere-procedural-body-part-expression.cjs",
  "test-harthmere-npc-visual-expression.cjs",
  "test-harthmere-npc-visual-debug-contract.cjs",
  "test-harthmere-retired-appearance-test-compat.cjs",
  "test-harthmere-typescript-scope-final.cjs",
  "test-harthmere-typescript-scope-sanity.cjs",
  "test-harthmere-typescript-full-gate.cjs",
  "test-harthmere-face-shape-scope-and-ts.cjs",
  "test-harthmere-procedural-appearance-field-effect-matrix.cjs",
  "test-harthmere-character-builder-field-effect-matrix.cjs",
  "test-harthmere-procedural-body-face-clothing-behavior.cjs",
  "test-harthmere-procedural-townsperson-full-feature-coverage.cjs",
  "test-harthmere-character-builder-full-feature-coverage.cjs",
  "test-harthmere-force-procedural-townsperson-clothing.cjs",
  "test-harthmere-unified-hud-syntax.cjs",
  "test-harthmere-typescript-syntax-smoke.cjs",
  "test-harthmere-dialogue-no-development-meta.cjs",
  "test-harthmere-dialogue-sheet-coverage.cjs",
  "test-harthmere-dialogue-data-driven-nodes.cjs",
  "test-harthmere-dialogue-choice-type-tags.cjs",
  "test-harthmere-dialogue-non-annoying-pacing.cjs",
  "test-harthmere-dialogue-memory-reputation.cjs",
  "test-harthmere-dialogue-skill-class-attribute.cjs",
  "test-harthmere-dialogue-merchant-guard-role.cjs",
  "test-harthmere-dialogue-multiplayer-party-consent.cjs",
  "test-harthmere-dialogue-localization-accessibility.cjs",
  "test-harthmere-dialogue-ambient-cooldown.cjs",
  "test-harthmere-dialogue-server-pipeline.cjs",
  "test-harthmere-dialogue-edge-sheet-rules.cjs",
  "test-harthmere-dialogue-fail-forward.cjs",
  "test-harthmere-economy-sheet-coverage.cjs",
  "test-harthmere-secondary-currency-policy.cjs",
  "test-harthmere-regional-market-trade-route.cjs",
  "test-harthmere-inflation-monitoring-health.cjs",
  "test-harthmere-tax-fee-rounding.cjs",
  "test-harthmere-item-value-repair-salvage-upgrade.cjs",
  "test-harthmere-loot-drop-rarity-economy.cjs",
  "test-harthmere-market-ui-anti-scam.cjs",
  "test-harthmere-bot-rmt-new-player-endgame.cjs",
  "test-harthmere-player-shop-work-order-services.cjs",
  "test-harthmere-price-quote-lock.cjs",

  "test-harthmere-player-trade-contract.cjs",
  "test-harthmere-auction-listing-escrow.cjs",
  "test-harthmere-auction-expiration-cancel.cjs",
  "test-harthmere-auction-tax-market-history.cjs",
  "test-harthmere-bank-storage.cjs",
  "test-harthmere-shared-account-storage.cjs",
  "test-harthmere-mail-attachments-cod.cjs",
  "test-harthmere-overflow-recovery.cjs",
  "test-harthmere-storage-service-npcs.cjs",
  "test-harthmere-trade-auction-storage-edge-cases.cjs",
  "test-harthmere-npc-ai-stack-contract.cjs",
  "test-harthmere-npc-ai-navigation.cjs",
  "test-harthmere-npc-ai-behavior-tree.cjs",
  "test-harthmere-npc-ai-fsm.cjs",
  "test-harthmere-npc-ai-utility.cjs",
  "test-harthmere-npc-ai-goap-planner.cjs",
  "test-harthmere-npc-ai-perception-memory.cjs",
  "test-harthmere-npc-ai-role-coverage.cjs",
  "test-harthmere-npc-ai-simulation-stress.cjs",
  "test-harthmere-npc-ai-third-party-adapters.cjs",
  "test-harthmere-npc-ai-third-party-navigation.cjs",
  "test-harthmere-npc-ai-third-party-behavior3.cjs",
  "test-harthmere-npc-ai-third-party-yuka.cjs",
  "test-harthmere-npc-ai-third-party-runtime-availability.cjs",
  'test-harthmere-react-json-view-migration.cjs',
  'test-harthmere-emoji-mart-migration.cjs',
  "test-harthmere-stylelint15-prettier-cleanup.cjs",
  "test-harthmere-ai-dependency-install-no-peer-bypass.cjs",
  'test-harthmere-react18-dependency-compat.cjs',
  'test-harthmere-npc-ai-package-compat.cjs',
  'test-harthmere-npc-ai-dependency-install-command.cjs',
  "test-harthmere-npc-ai-adapter-runtime-safety.cjs",
  "test-harthmere-economy-contracts.cjs",
  "test-harthmere-inventory-contracts.cjs",
  "test-harthmere-vendor-contracts.cjs",
  "test-harthmere-wallet-contracts.cjs",
  "test-harthmere-reputation-economy-contracts.cjs",
  "test-harthmere-gathering-economy-contracts.cjs",
  "test-harthmere-guild-economy-contracts.cjs",
  "test-harthmere-building-economy-contracts.cjs",
  "test-harthmere-gathering-authority.cjs",
  "test-harthmere-gathering-behavior.cjs",
  "test-harthmere-building-authority.cjs",
  "test-harthmere-building-behavior.cjs",
  "test-harthmere-item-catalog.cjs",
  "test-harthmere-item-instance-rules.cjs",
  "test-harthmere-item-stack-rules.cjs",
  "test-harthmere-item-storage-routing.cjs",
  "test-harthmere-wallet-currency.cjs",
  "test-harthmere-wallet-source-sink-ledger.cjs",
  "test-harthmere-vendor-source-of-truth.cjs",
  "test-harthmere-vendor-inventory.cjs",
  "test-harthmere-vendor-pricing.cjs",
  "test-harthmere-vendor-stock-state.cjs",
  "test-harthmere-vendor-dialogue-exposure.cjs",
  "test-harthmere-vendor-buy-transaction.cjs",
  "test-harthmere-vendor-sell-transaction.cjs",
  "test-harthmere-vendor-buyback.cjs",
  "test-harthmere-vendor-stolen-goods.cjs",
  "test-harthmere-economy-price-formula.cjs",
  "test-harthmere-economy-supply-demand.cjs",
  "test-harthmere-economy-shortage-surplus.cjs",
  "test-harthmere-economy-idempotency.cjs",
  "test-harthmere-economy-corrupt-state-recovery.cjs",
  "test-harthmere-economy-storage-versioning.cjs",
  "test-harthmere-economy-transaction-log-integrity.cjs",
  "test-harthmere-vendor-live-ui-contract.cjs",
  "test-harthmere-vendor-rapid-click-abuse.cjs",
  "test-harthmere-inventory-full-capacity.cjs",
  "test-harthmere-item-definition-cross-reference.cjs",
  "test-harthmere-economy-balance-smoke.cjs",
  "test-harthmere-economy-no-client-trust.cjs",
  "test-harthmere-mount-collection.cjs",
  "test-harthmere-pet-collection.cjs",
  "test-harthmere-mount-pet-unlock-rules.cjs",
  "test-harthmere-mount-pet-hotbar.cjs",
  "test-harthmere-stable-service.cjs",
  "test-harthmere-inventory-ui-filter-sort.cjs",
  "test-harthmere-item-tooltip-contract.cjs",
  "test-harthmere-item-destroy-confirmation.cjs",
  "test-harthmere-safe-to-sell-ui.cjs",
  "test-harthmere-durability-warning-ui.cjs",
  "test-harthmere-dialogue-edge-cases.cjs",
  "test-harthmere-dialogue-choice-idempotency.cjs",
  "test-harthmere-dialogue-combat-interrupt.cjs",
  "test-harthmere-dialogue-distance-disconnect.cjs",
  "test-harthmere-dialogue-choice-revalidation.cjs",
  "test-harthmere-dialogue-transcript-journal.cjs",
  "test-harthmere-dialogue-consequence-warning.cjs",
  "test-harthmere-quest-guidance-ui.cjs",
  "test-harthmere-nearby-quest-helper.cjs",
  "test-harthmere-quest-map-compass-markers.cjs",
  "test-harthmere-quest-hint-escalation.cjs",
  "test-harthmere-quest-notice-board.cjs",
  "test-harthmere-quest-status-notifications.cjs",
  "test-harthmere-quest-analytics-debug.cjs",
  "test-harthmere-quest-type-contracts.cjs",
  "test-harthmere-crime-detection-witness.cjs",
  "test-harthmere-theft-pickpocket-lockpick.cjs",
  "test-harthmere-guard-response-levels.cjs",
  "test-harthmere-fine-confiscation-arrest.cjs",
  "test-harthmere-bribe-corrupt-guard.cjs",
  "test-harthmere-bounty-city-lockdown.cjs",
  "test-harthmere-crime-evidence-memory.cjs",
  "test-harthmere-server-inventory-authority.cjs",
  "test-harthmere-server-wallet-authority.cjs",
  "test-harthmere-server-trade-authority.cjs",
  "test-harthmere-server-auction-authority.cjs",
  "test-harthmere-server-mail-bank-authority.cjs",
  "test-harthmere-server-quest-dialogue-authority.cjs",
  "test-harthmere-client-spoof-rejection.cjs",
  "test-harthmere-combat-system-integration.cjs",
  "test-harthmere-combat-system-core.cjs",
  "test-harthmere-complete-progression-catalogs.cjs",
  "test-harthmere-complete-abilities-equipment.cjs",
  "test-harthmere-complete-level-skill-loot.cjs",
  "test-harthmere-complete-server-pvp-death.cjs",
  "test-harthmere-complete-runtime-integration.cjs",
  "test-harthmere-live-mode-readiness-contracts.cjs",
  "test-harthmere-live-mode-action-pipelines.cjs",
  "test-harthmere-live-mode-persistence-idempotency.cjs",
  "test-harthmere-live-mode-ui-events.cjs",
  "test-harthmere-live-mode-end-to-end-scenarios.cjs",
  "test-harthmere-live-mode-production-hardening.cjs",
  "test-harthmere-third-party-combat-ai-contracts.cjs",
  "test-harthmere-third-party-combat-ai-behavior-fsm.cjs",
  "test-harthmere-third-party-combat-ai-utility-movement.cjs",
  "test-harthmere-third-party-combat-ai-adapters.cjs",
  "test-harthmere-third-party-combat-ai-navigation-perception.cjs",
  "test-harthmere-third-party-combat-ai-end-to-end.cjs",
  "test-harthmere-third-party-combat-ai-production-hardening.cjs",
  "test-harthmere-combat-animation-polish-regression-static.cjs",
  "test-harthmere-combat-animation-polish-npc-player-runtime.cjs",
  "test-harthmere-combat-animation-polish-magic-vfx.cjs",
  "test-harthmere-combat-animation-polish-weapon-hand-sync.cjs",
  "test-harthmere-combat-animation-polish-variation-motion.cjs",
  "test-harthmere-combat-animation-tip-hilt-direction.cjs",
  "test-harthmere-combat-animation-random-variation.cjs",
  "test-harthmere-combat-animation-left-hand-policy.cjs",
  "test-harthmere-combat-animation-per-frame-attachment.cjs",
  "test-harthmere-combat-animation-impact-frame-sync.cjs",
  "test-harthmere-combat-animation-mechanics-invariant.cjs",
  "test-harthmere-combat-animation-weapon-family-coverage.cjs",
  "test-harthmere-combat-animation-enemy-family-silhouette.cjs",
  "test-harthmere-combat-animation-magic-readability.cjs",
  "test-harthmere-combat-animation-state-cancellation.cjs",
  "test-harthmere-combat-animation-death-respawn-visuals.cjs",
  "test-harthmere-combat-animation-performance-budget.cjs",
  "test-harthmere-combat-animation-browser-snapshot.cjs",
  "test-harthmere-combat-animation-polish-catalog.cjs",
  "test-harthmere-animation-handedness-death-bounds.cjs",
  "test-harthmere-live-animation-scenario-regression.cjs",
  "test-harthmere-body-weapon-aligned-clips.cjs",
  "test-harthmere-animation-world-interaction.cjs",
  "test-harthmere-sword-animation-runtime.cjs",
  "test-harthmere-all-weapon-animation-runtime.cjs",
  "test-harthmere-body-animation-weapon-sync.cjs",
  "test-harthmere-body-weapon-visual-cohesion.cjs",
  "test-harthmere-sword-animation-polish.cjs",
  "test-harthmere-animation-action-chain.cjs",
  "test-harthmere-animation-asset-coverage.cjs",
  "test-harthmere-procedural-solid-asset-collision.cjs",
  "test-harthmere-collision-radius-variants.cjs",
  "test-harthmere-collision-performance-budget.cjs",
  "check-harthmere-market-square.cjs",
  "check-harthmere-player-services-plaza.cjs",
  "check-harthmere-copper-kettle-inn.cjs",
  "check-harthmere-craftsman-row-black-anvil.cjs",
  "check-harthmere-noble-rise.cjs",
  "check-harthmere-river-docks.cjs",
  "check-harthmere-mudden-ward.cjs",
  "check-harthmere-guard-yard.cjs",
  "check-harthmere-old-well-underways.cjs",
  "check-harthmere-temple-green.cjs",
  "check-harthmere-town-collision-placement.cjs",
  "check-harthmere-town-audit-export.cjs",
  "check-harthmere-town-audit-pattern-fixes.cjs",
  "test-harthmere-town-spacing-collision-solid-fixtures.cjs",
  "test-harthmere-town-placement-building-design.cjs",
  "test-harthmere-runtime-navigation-collision.cjs",
  "test-harthmere-uploaded-asset-solid-collision.cjs",
  "test-harthmere-building-asset-size-rules.cjs",
  "test-harthmere-asset-size-collision-footprints.cjs",
  "test-harthmere-uploaded-asset-dimensions.cjs",
  "test-harthmere-solid-landmark-fixture-collision.cjs",
  "test-harthmere-player-runtime-collision-bridge.cjs",
  "test-harthmere-player-no-vertical-town-collision-by-default.cjs",
  "test-harthmere-interior-room-sanity.cjs",
  "test-harthmere-map-ui-discovery-filter.cjs",
  "test-harthmere-npc-route-graph.cjs",
  "test-harthmere-town-schedules.cjs",
  "test-harthmere-law-restricted-areas.cjs",
  "test-harthmere-danger-zone-communication.cjs",
  "test-harthmere-event-state-mutation.cjs",
  "test-harthmere-visual-readability-audit.cjs",
  "test-harthmere-roof-street-block-cleanup.cjs",
  "test-harthmere-mount-dismount-policy.cjs",
  "test-harthmere-solid-collision-runtime-parity.cjs",
  "test-harthmere-uploaded-asset-collision-shape-sanity.cjs",
  "test-harthmere-player-spawn-and-district-entry-safety.cjs",
  "test-harthmere-town-audit-live-collision-tools.cjs",
  "test-harthmere-town-rule-coverage-completeness.cjs",
  "test-harthmere-fixture-attachment-sanity.cjs",
  "test-harthmere-wall-fixture-attachment-sanity.cjs",
  "check-harthmere-bellbound-town-dungeon-expansion.cjs",
  "check-harthmere-bellbound-missing-details-expansion.cjs",
  "check-harthmere-remaining-interiors-and-dungeon-access.cjs",
  "check-harthmere-building-dungeon-completion.cjs",
  "check-harthmere-interior-expansion-regression-fixes.cjs",
  "test-harthmere-character-builder-release-ui.cjs",
  "test-harthmere-character-builder-all-fields.cjs",
  "test-harthmere-character-builder-clothing-selection.cjs",
  "test-harthmere-character-builder-save-into-game.cjs",
  "test-harthmere-character-builder-edge-cases.cjs",
  "test-harthmere-gathering-remainder.cjs",
  "test-harthmere-building-remainder.cjs",
];

let failed = 0;
console.log("== Harthmere town placement full test suite current ==");
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


// harthmere-full-animation-runtime
// Full suite includes test-harthmere-full-animation-runtime.cjs

// test-harthmere-creature-social-death-handtracking.cjs

// Added by current
// test-harthmere-attack-variation-clips.cjs

// Added by visual fixes current
// test-harthmere-visual-fixes.cjs

// Added by current
// test-harthmere-attack-variation-sequencing.cjs

// Added by current
// test-harthmere-attack-variation-polish.cjs

// Added by current
// test-harthmere-real-visual-animation-validation.cjs

// Added by npc-social-quest-economy: test-harthmere-npc-economy-behavior.cjs

// Added by npc-social-quest-economy: test-harthmere-npc-merchant-social-response.cjs

// Added by npc-social-quest-economy: test-harthmere-npc-crime-response.cjs

// Added by npc-social-quest-economy: test-harthmere-social-state-price-effects.cjs

// Added by npc-social-quest-economy: test-harthmere-quest-reward-economy.cjs

// Added by npc-social-quest-economy: test-harthmere-quest-item-protection.cjs

// Added by npc-social-quest-economy: test-harthmere-quest-repeat-reward-abuse.cjs

// Added by npc-social-quest-economy: test-harthmere-quest-vendor-unlocks.cjs

// Harthmere release visual/TypeScript regression test: test-harthmere-character-builder-visual-polish.cjs
'test-harthmere-typescript-release-blockers.cjs'
'test-harthmere-character-builder-design-preview.cjs'

// Harthmere release visual/TypeScript regression test: test-harthmere-typescript-release-blockers.cjs


// current backup cleanup regression: test-harthmere-no-backup-files.cjs

// current remaining issue regression coverage
"scripts/harthmere/test-harthmere-all-remaining-issues.cjs";


// HARTHMERE_LIVING_QUARTERS_NPC_DISPERSAL_SUITE
{
  const childProcess = require("child_process");
  const path = require("path");
  const root = process.argv[2] || process.cwd();
  childProcess.execFileSync(
    process.execPath,
    [path.join(root, "scripts/harthmere/test-harthmere-living-quarters-npc-dispersal.cjs"), root],
    { stdio: "inherit" },
  );
}

// HARTHMERE_RENDERER_ANIMATION_SYNTAX_SUITE
{
  const childProcess = require("child_process");
  const path = require("path");
  const root = process.argv[2] || process.cwd();
  childProcess.execFileSync(
    process.execPath,
    [path.join(root, "scripts/harthmere/test-harthmere-renderer-animation-syntax.cjs"), root],
    { stdio: "inherit" },
  );
}

// HARTHMERE_BRIDGE_WILDS_SUITE
{
  const childProcess = require("child_process");
  const path = require("path");
  const root = process.argv[2] || process.cwd();
  childProcess.execFileSync(
    process.execPath,
    [path.join(root, "scripts/harthmere/test-harthmere-bridge-wilds.cjs"), root],
    { stdio: "inherit" },
  );
}

// HARTHMERE_BRIDGE_LABEL_TDZ_SUITE
{
  const childProcess = require("child_process");
  const path = require("path");
  const root = process.argv[2] || process.cwd();
  childProcess.execFileSync(
    process.execPath,
    [path.join(root, "scripts/harthmere/test-harthmere-town-registry-bridge-label-tdz.cjs"), root],
    { stdio: "inherit" },
  );
}
