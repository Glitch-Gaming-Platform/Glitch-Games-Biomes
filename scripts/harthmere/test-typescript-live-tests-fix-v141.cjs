#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function block(src, marker, nextMarker) {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `missing marker: ${marker}`);
  const end = nextMarker ? src.indexOf(nextMarker, start + marker.length) : -1;
  return src.slice(start, end >= 0 ? end : undefined);
}

const adapters = read('src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts');
assert.ok(adapters.includes('return (instanceIds ?? []).flatMap((instanceId, index): InventoryUiItem[] =>'), 'instance records should use typed flatMap instead of returning nulls');
assert.ok(!adapters.includes('.filter((item): item is InventoryUiItem => !!item)'), 'stale nullable InventoryUiItem filter should be gone');
assert.ok(adapters.includes('const count = Math.max(1, Math.trunc(Number(instance.quantity ?? 1) || 1));'), 'instance item count should be normalized before returning InventoryUiItem');

const quests = read('src/client/components/challenges/LocalDevHarthmereQuests.tsx');
assert.ok(quests.includes('const rawCompleted = Array.isArray(parsed?.completed) ? parsed.completed : [];'), 'quest state normalization should guard parsed.completed before filtering');
assert.ok(!quests.includes('parsed.completed.filter('), 'quest state normalization must not dereference parsed after optional guard');

const liveTest = read('src/shared/harthmere/test/live_mode_backend_v1.test.ts');
const respecBlock = block(liveTest, 'describe("reduceHarthmereLiveModeBackendStateV1 — respec"', '// ===========================================================================\n// 15.');
assert.ok(respecBlock.includes('e.kind === "respec_fee"'), 'respec test should assert respec_fee ledger entries');
assert.ok(!respecBlock.includes('e.kind === "auction_sale"'), 'respec test must not expect auction_sale ledger entries');

const guildBlock = block(liveTest, 'describe("reduceHarthmereLiveModeBackendStateV1 — guild mutation"', '// ===========================================================================\n// 17.');
assert.ok(guildBlock.includes('operation: "create_guild"'), 'guild tests should use authoritative create_guild operation');
assert.ok(guildBlock.includes('operation: "treasury_deposit"'), 'guild treasury tests should use authoritative treasury_deposit operation');
assert.ok(guildBlock.includes('operation: "guild_bank_withdraw"'), 'guild carry-weight edge test should use authoritative guild bank withdraw');
assert.ok(!guildBlock.includes('role: "member"'), 'stale direct role mutation test should be gone');
assert.ok(!guildBlock.includes('treasuryDelta'), 'stale treasuryDelta mutation test should be gone');
assert.ok(!guildBlock.includes('projectContribution'), 'stale projectContribution mutation test should be gone');

const buildingBlock = block(liveTest, 'describe("reduceHarthmereLiveModeBackendStateV1 — building mutation"', '// ===========================================================================\n// 20.');
assert.ok(buildingBlock.includes('plotId: "grove_muckstead_cottage_lot"'), 'building tests should use a real Grove plot id');
assert.ok(buildingBlock.includes('blueprintId: "grove_voxel_cottage_tier_1"'), 'building tests should use a real Grove blueprint id');
assert.ok(buildingBlock.includes('buildingAction: "start_construction"'), 'building tests should cover staged construction');
assert.ok(!buildingBlock.includes('plot_res_1'), 'stale fake plot id should be gone');
assert.ok(!buildingBlock.includes('propertyStatus'), 'stale direct propertyStatus mutation should be gone');
assert.ok(!buildingBlock.includes('buildingProgressDelta'), 'stale buildingProgressDelta mutation should be gone');

assert.ok(liveTest.includes('stats: { weight: 2 }'), 'iron_ore fixture should define explicit carry weight');
assert.ok(liveTest.includes('stats: { weight: 1 }'), 'health_potion fixture should define explicit carry weight');
assert.ok(liveTest.includes('stats: { attack: 10, weight: 5 }'), 'iron_sword fixture should define explicit carry weight');
assert.ok(liveTest.includes('craftState.classMagic.knownRecipes = ["recipe_iron_sword"];'), 'crafting overweight test must know the recipe before expecting a weight rejection');
assert.ok(liveTest.includes('craftState.inventory.items = { iron_sword: 5, iron_ore: 3 };'), 'crafting overweight test should actually exceed the carry limit after craft projection');

console.log('PASS typescript-live-tests-fix-v141');
