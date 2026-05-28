#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let failed = 0;
function assert(condition, message) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`PASS: ${message}`);
  }
}

const groveEconomy = read('src/shared/harthmere/grove_economy_starter_v1.ts');
const snapshotContent = read('src/shared/harthmere/snapshot_grove_content_v75.ts');
const inventoryTab = read('src/client/components/biomes_ui/tabs/InventoryTab.tsx');
const bankingTab = read('src/client/components/biomes_ui/tabs/BankingTab.tsx');
const liveAdapters = read('src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts');

console.log('== Harthmere shim startup + BiomesUI inventory icon regression v136 ==');

// Startup regression: snapshot_grove_content_v75 appends the economy data, so
// grove_economy_starter_v1 must not value-import back from it during CommonJS
// module evaluation. That was the source of the shim ReferenceError.
assert(/\.\.\.\(GROVE_ECONOMY_STARTER_NPCS_V1|\.\.\.GROVE_ECONOMY_STARTER_NPCS_V1/.test(snapshotContent), 'snapshot Grove content still appends economy NPC data');
assert(snapshotContent.includes('...GROVE_ECONOMY_STARTER_LANDMARKS_V1'), 'snapshot Grove content still appends economy landmark data');
assert(snapshotContent.includes('...GROVE_ECONOMY_STARTER_QUESTS_V1'), 'snapshot Grove content still appends economy quest data');
assert(!/import\s*\{[\s\S]*?\}\s*from\s*["']@\/shared\/harthmere\/snapshot_grove_content_v75["']/.test(groveEconomy), 'grove economy starter has no runtime value import from snapshot_grove_content_v75');
assert(/import\s+type\s*\{[\s\S]*SnapshotGroveQuestV75[\s\S]*\}\s*from\s*["']@\/shared\/harthmere\/snapshot_grove_content_v75["']/.test(groveEconomy), 'grove economy starter keeps only erased type imports from snapshot_grove_content_v75');
assert(!groveEconomy.includes('SNAPSHOT_GROVE_NPC_FEET_Y_V75'), 'grove economy starter no longer reads SNAPSHOT_GROVE_NPC_FEET_Y_V75 during module initialization');
assert(!groveEconomy.includes('snapshotGroveFountainPositionV105'), 'grove economy starter no longer calls snapshotGroveFountainPositionV105 during module initialization');
assert(groveEconomy.includes('GROVE_ECONOMY_AUTHORED_NPC_FEET_Y_V1'), 'grove economy starter has local authored feet-Y constant');
assert(groveEconomy.includes('function groveEconomyFountainPositionV1'), 'grove economy starter has local fountain position helper');

// Inventory icon regression: iconUrl() can return absolute in-app paths such as
// /buckets/... or /_next/static/... . Those must render as <img>, not text in a slot.
const expectedImageRegex = /^(?:https?:\/\/|data:image\/|blob:|\/)/i;
assert(expectedImageRegex.test('/buckets/biomes-bikkie/assets/example.png'), 'test sanity: /buckets paths are image icons');
assert(expectedImageRegex.test('/_next/static/media/icon.png'), 'test sanity: /_next static paths are image icons');
assert(expectedImageRegex.test('https://cdn.example.test/icon.png'), 'test sanity: https paths are image icons');
assert(expectedImageRegex.test('data:image/png;base64,abc'), 'test sanity: data image paths are image icons');
assert(!expectedImageRegex.test('◼'), 'test sanity: glyph placeholders remain glyph icons');

assert(inventoryTab.includes('function isInventoryImageIcon'), 'InventoryTab has a dedicated icon classifier');
assert(inventoryTab.includes('data-inventory-icon-kind="image"'), 'InventoryTab marks rendered image icons for tests');
assert(inventoryTab.includes('data-inventory-icon-kind="glyph"'), 'InventoryTab keeps a glyph fallback for non-image icons');
assert(/return\s+\/\^\(\?:https\?:\\\/\\\/\|data:image\\\/\|blob:\|\\\/\)\/i\.test\(icon\)/.test(inventoryTab), 'InventoryTab treats leading-slash app asset URLs as images');
assert(!inventoryTab.includes('if (item.icon && /^https?:\\/\\//.test(item.icon))'), 'InventoryTab no longer limits image rendering to http-only URLs');

assert(bankingTab.includes('function isBankingImageIcon'), 'BankingTab has a dedicated icon classifier');
assert(bankingTab.includes('data-banking-icon-kind'), 'BankingTab marks rendered bank icons for tests');
assert(bankingTab.includes('renderBankingIcon(item.icon, 18)'), 'BankingTab renders backpack deposit candidate icons through image/glyph helper');
assert(bankingTab.includes('renderBankingIcon(item.icon, 24)'), 'BankingTab renders vault icons through image/glyph helper');
assert(!bankingTab.includes('<span>{item.icon}</span>'), 'BankingTab no longer prints raw item.icon text in backpack rows');
assert(!bankingTab.includes('React.createElement("span", { style: { fontSize: 20 } }, item.icon)'), 'BankingTab no longer prints raw item.icon text in vault slots');
assert(liveAdapters.includes('icon: item.icon'), 'Banking deposit candidates preserve real icon URLs from live ECS items');

if (failed) {
  console.error(`\nRESULT: FAIL (${failed} failed)`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
