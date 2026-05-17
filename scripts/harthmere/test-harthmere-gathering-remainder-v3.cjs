#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.argv[2] || process.cwd();
const modulePath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereRemainderSystems.ts');
const source = fs.readFileSync(modulePath, 'utf8');

function loadModule() {
  const names = [];
  const transformed = source
    .replace(/^export const ([A-Za-z0-9_]+) =/gm, (_, name) => { names.push(name); return `const ${name} =`; })
    .replace(/^export function ([A-Za-z0-9_]+)\(/gm, (_, name) => { names.push(name); return `function ${name}(`; });
  const sandbox = { module: { exports: {} }, exports: {}, console, Date, Math, JSON, Number, String, Array, Object, Set, Map };
  const exportLine = `\nmodule.exports = { ${Array.from(new Set(names)).join(', ')} };`;
  vm.runInNewContext(transformed + exportLine, sandbox, { filename: modulePath });
  return sandbox.module.exports;
}

const m = loadModule();
let ok = true;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
  }
}

check('remainder system version marker exists', m.HARTHMERE_REMAINDER_SYSTEM_VERSION === 'gathering-building-remainder-v3');
check('mock server boundary is explicit for future live server', m.HARTHMERE_REAL_SERVER_BOUNDARY.includes('mock_authoritative'));

let state = m.createHarthmereRemainderScenarioFixture();
let result = m.completeHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: 'tx_gather_1' });
check('valid mining gather succeeds behaviorally', result.ok === true);
check('mining yield routes into material storage', state.players.alice.inventory.materialStorage.iron_ore === 3);
check('profession XP is awarded on successful gather', state.players.alice.professionXp.mining === 15);
check('tool durability is consumed on successful gather', state.players.alice.tools.pickaxe.durability === 2);
check('gather contract progresses from yielded material', state.players.alice.contracts.blacksmith_iron.progress.iron_ore === 3);
check('shared node depletes and receives respawn timer', state.nodes.iron_vein.gathersRemaining === 0 && state.nodes.iron_vein.respawnAt > state.now);
check('transaction is committed for idempotency', Boolean(state.transactions.tx_gather_1));

result = m.completeHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: 'tx_gather_1' });
check('duplicate gather transaction is rejected', result.ok === false && result.code === 'duplicate_transaction');

state = m.createHarthmereRemainderScenarioFixture();
state.players.alice.position = [99, 0, 99];
result = m.validateHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: 'tx_far' });
check('distance validation rejects far resource nodes', result.ok === false && result.code === 'too_far');

state = m.createHarthmereRemainderScenarioFixture();
state.players.alice.lineOfSightClear = false;
result = m.validateHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: 'tx_los' });
check('line-of-sight validation rejects blocked nodes', result.ok === false && result.code === 'blocked_line_of_sight');

for (const [flag, expected] of [['dead', 'invalid_player_state'], ['stunned', 'invalid_player_state'], ['inCombat', 'invalid_player_state'], ['mounted', 'invalid_player_state'], ['swimming', 'invalid_player_state'], ['flying', 'invalid_player_state']]) {
  state = m.createHarthmereRemainderScenarioFixture();
  state.players.alice.stateFlags[flag] = true;
  result = m.validateHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: `tx_${flag}` });
  check(`player state validation rejects ${flag}`, result.ok === false && result.code === expected);
}

state = m.createHarthmereRemainderScenarioFixture();
delete state.players.alice.tools.pickaxe;
result = m.validateHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: 'tx_no_tool' });
check('missing gathering tool is rejected', result.ok === false && result.code === 'missing_tool');

state = m.createHarthmereRemainderScenarioFixture();
state.players.alice.tools.pickaxe.durability = 0;
result = m.validateHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: 'tx_broken_tool' });
check('broken gathering tool is rejected', result.ok === false && result.code === 'tool_broken');

state = m.createHarthmereRemainderScenarioFixture();
state.players.alice.professionLevels.mining = 1;
result = m.validateHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: 'tx_low_skill' });
check('skill gate rejects underleveled gatherer', result.ok === false && result.code === 'skill_too_low');

state = m.createHarthmereRemainderScenarioFixture();
result = m.completeHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'moonflower', transactionId: 'tx_wrong_phase' });
check('quest resource rejects wrong quest phase', result.ok === false && result.code === 'wrong_quest_phase');
state.players.alice.questPhase = 'moon_1';
result = m.completeHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'moonflower', transactionId: 'tx_quest_phase' });
check('quest resource succeeds in correct phase', result.ok === true);
check('quest resource routes to quest pouch', state.players.alice.inventory.questPouch.quest_moonflower === 1);

state = m.createHarthmereRemainderScenarioFixture();
state.players.alice.inventory.materialStorageLimit = 2;
result = m.completeHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: 'tx_full_storage' });
check('inventory/material storage full blocks gather before deletion', result.ok === false && result.code === 'inventory_full');
check('blocked full-storage gather does not commit transaction', !state.transactions.tx_full_storage);

state = m.createHarthmereRemainderScenarioFixture();
result = m.completeHarthmereGatherScenario(state, { playerId: 'alice', nodeId: 'iron_vein', transactionId: 'tx_interrupted', interruptReason: 'damaged' });
check('damage interruption cancels gather before completion', result.ok === false && result.code === 'gather_interrupted');

state = m.createHarthmereRemainderScenarioFixture();
state.nodes.iron_vein.gathersRemaining = 0;
state.nodes.iron_vein.respawnAt = state.now + 10;
let respawn = m.advanceHarthmereResourceRespawns(state, state.now + 11);
check('resource respawn scheduler restores depleted nodes', respawn.respawned === 1 && state.nodes.iron_vein.gathersRemaining === 1);

const points = [
  { id: 'bad_wall', biome: 'mountain', inWall: true, reachable: true },
  { id: 'bad_biome', biome: 'ocean', reachable: true },
  { id: 'good_mine', biome: 'mountain', reachable: true },
];
const spawns = m.generateHarthmereValidResourceSpawns(points, { category: 'ore', validBiomes: ['mountain'] }, 5);
check('resource spawn manager filters walls, wrong biomes, and unreachable nodes', spawns.length === 1 && spawns[0].id === 'good_mine');

state = m.createHarthmereRemainderScenarioFixture();
for (let i = 0; i < 12; i++) m.updateHarthmereAntiBotRoute(state.players.alice, i % 2 === 0 ? 'iron_vein' : 'copper_vein', state.now + i);
check('anti-bot route scoring flags repetitive routes for review', state.players.alice.antiBot.review === true);

state = m.createHarthmereRemainderScenarioFixture();
const tracking = m.unlockHarthmereResourceTracking(state.players.alice, 'mining', 30);
check('resource tracking unlocks through profession level', tracking.includes('nearby_copper_veins') && tracking.includes('iron_and_silver_veins'));
const icon = m.mapHarthmereResourceIcon('ore', { rare: true, quest: true, dangerous: true });
check('map icons include resource and rare/quest/danger overlays', icon.icon === 'pickaxe' && icon.overlays.length === 3);

const materials = { iron_ore: 3, coal: 1 };
const refined = m.refineHarthmereMaterial({ recipeId: 'iron_bar', station: 'forge', materials });
check('refinement consumes raw materials and produces refined goods', refined.ok && refined.materials.iron_bar === 1 && refined.materials.iron_ore === 0);
check('material quality grades high-skill/high-tool input', m.gradeHarthmereMaterialQuality({ skill: 80, toolQuality: 50, regionBonus: 30 }) === 'mythic');
const buffs = m.applyHarthmereGatheringBuffCaps({ skillBonus: 0.4, toolBonus: 0.4, rareSkillBonus: 0.8, rareBuffBonus: 0.8 });
check('yield and rare bonuses are capped to protect economy', buffs.yieldBonus === 0.5 && buffs.rareRelativeBonus === 1);
const assist = m.resolveHarthmereMountedPetAssist({ mount: 'pack_mule', pet: 'forager' });
check('mount and pet assist grants limited non-automation bonuses', assist.ok && assist.carryCapacity === 50 && assist.rareRelativeBonus > 0);
const badAssist = m.resolveHarthmereMountedPetAssist({ mount: 'pack_mule', afkAutomation: true });
check('mount/pet gathering automation is blocked', badAssist.ok === false && badAssist.code === 'anti_bot_review');

const groupNode = m.createHarthmereGroupResourceNode({ id: 'ancient_worldroot', requiredContributions: 3 });
m.contributeHarthmereGroupResourceNode(groupNode, 'alice', 1);
const groupResult = m.contributeHarthmereGroupResourceNode(groupNode, 'bob', 2);
check('group resource nodes track contributions and eligible players', groupResult.complete === true && groupResult.eligiblePlayers.includes('alice') && groupResult.eligiblePlayers.includes('bob'));

check('corpse harvesting rejects living creatures', m.resolveHarthmereCorpseHarvest({ creatureDead: false, lootEligible: true }).ok === false);
check('corpse harvesting allows dead eligible creatures', m.resolveHarthmereCorpseHarvest({ creatureDead: true, lootEligible: true, yields: [{ itemId: 'wolf_hide', quantity: 1 }] }).ok === true);
check('event resource spawns only when event is active', m.spawnHarthmereEventResource({ requiredEvent: 'meteor', activeEvents: ['meteor'], node: { id: 'meteor_ore' } }).ok === true);
const pvpDrop = m.resolveHarthmerePvPGatheringDeathDrop({ pvpZone: true, materials: { meteor_ore: 8 }, dropRate: 0.25 });
check('PvP gathering death drop rules preserve some materials and drop some', pvpDrop.dropped[0].quantity === 2 && pvpDrop.protected.meteor_ore === 6);

if (!ok) process.exit(1);
console.log('RESULT: PASS');
