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

const quests = read('src/client/components/challenges/LocalDevHarthmereQuests.tsx');
assert.ok(quests.includes('const parsedState = parsed ?? {};'), 'quest normalization should normalize parsed once before dereferencing');
assert.ok(quests.includes('const rawCompleted = Array.isArray(parsedState.completed) ? parsedState.completed : [];'), 'quest normalization should read completed from parsedState');
assert.ok(!quests.includes('Array.isArray(parsed?.completed) ? parsed.completed : []'), 'stale parsed.completed ternary should be gone');
assert.ok(!quests.includes('parsed.completed.filter('), 'quest normalization must not directly dereference parsed.completed');

const backend = read('src/shared/harthmere/live_mode_backend.ts');
const respecReducer = block(backend, 'case "request_respec": {', 'case "request_quest_state_update": {');
assert.ok(respecReducer.includes('next.inventory.gold = Math.max(0, next.inventory.gold + respecResult.goldCost);'), 'respec reducer should apply negative goldCost as a wallet delta');
assert.ok(respecReducer.includes('amount: respecResult.goldCost,'), 'respec ledger should store the negative respec fee amount');
assert.ok(!respecReducer.includes('next.inventory.gold - respecResult.goldCost'), 'respec reducer must not subtract a negative cost and award gold');
assert.ok(!respecReducer.includes('amount: -respecResult.goldCost'), 'respec ledger must not invert the respec fee into positive income');

const liveTest = read('src/shared/harthmere/test/live_mode_backend.test.ts');
const respecBlock = block(liveTest, 'describe("reduceHarthmereLiveModeBackendState — respec"', '// ===========================================================================\n// 15.');
assert.ok(respecBlock.includes('e.kind === "respec_fee"'), 'respec test should assert respec_fee ledger entries');
assert.ok(respecBlock.includes('assert.ok((respecFeeEntry?.amount ?? 0) < 0);'), 'respec fee test should require a negative ledger amount');
assert.ok(!respecBlock.includes('e.kind === "auction_sale"'), 'respec test must not expect auction_sale ledger entries');

const buildingBlock = block(liveTest, 'describe("reduceHarthmereLiveModeBackendState — building mutation"', '// ===========================================================================\n// 20.');
assert.ok(buildingBlock.includes('assert.ok(state.building.activeProjects["project_grove_muckstead_cottage_lot"]);'), 'staged construction test should use the real project id helper format');
assert.ok(!buildingBlock.includes('building_project:grove_muckstead_cottage_lot'), 'stale staged construction project id should be gone');
assert.ok(buildingBlock.includes('plotId: "grove_muckstead_cottage_lot"'), 'building test should use the real Grove plot');
assert.ok(buildingBlock.includes('blueprintId: "grove_voxel_cottage_tier_1"'), 'building test should use the real Grove blueprint');

const bankingBlock = block(liveTest, 'describe("reduceHarthmereLiveModeBackendState — production bank expansion"', '// ===========================================================================\n// Banking current carry weight enforcement');
assert.ok(bankingBlock.includes('s.inventory.items = { iron_ore: 10, practice_sword: 1 };'), 'material storage test should use a material and a non-material fixture');
assert.ok(bankingBlock.includes('itemId: "practice_sword"'), 'material rejection should test a genuinely non-material item id');
assert.ok(!bankingBlock.includes('itemId: "iron_sword"'), 'iron_sword includes iron and is intentionally treated as material-like by the fallback matcher');
assert.ok(bankingBlock.includes('bank_rejected:not_material_item'), 'material storage test should still assert non-material rejection');

console.log('PASS typescript-live-tests-fix');
