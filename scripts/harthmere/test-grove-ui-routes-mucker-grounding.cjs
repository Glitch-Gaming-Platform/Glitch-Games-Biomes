#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || process.cwd());
function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const openPrompt = read('src/client/components/biomes_ui/BiomesUIOpenPrompt.tsx');
assert(openPrompt.includes('BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS'), 'Open prompt must declare non-gameplay screen selectors.');
assert(openPrompt.includes('.wake-up-container'), 'Open prompt must hide on wake-up / enter screens.');
assert(openPrompt.includes('.harthmere-wakeup-character-builder'), 'Open prompt must hide on character builder screens.');
assert(openPrompt.includes('MutationObserver'), 'Open prompt must react when enter/builder screens mount/unmount.');
assert(openPrompt.includes('nonGameplayScreenVisible'), 'Open prompt must block rendering when a non-gameplay screen is visible.');

const economy = read('src/shared/harthmere/grove_economy_starter.ts');
assert(economy.includes('GROVE_ECONOMY_STARTER_CIRCULAR_IMPORT_FIX'), 'Economy starter must include the circular-import fix marker.');
assert(!/import\s*\{[\s\S]*SNAPSHOT_GROVE_NPC_FEET_Y[\s\S]*\}\s*from\s*"@\/shared\/harthmere\/snapshot_grove_content"/.test(economy), 'Economy starter must not runtime-import snapshot Grove constants.');
assert(economy.includes('groveEconomyStarterFountainPosition'), 'Economy starter must use its local fountain helper.');

const liveDebug = read('src/shared/harthmere/snapshot_live_debug.ts');
assert(liveDebug.includes('SNAPSHOT_MUCKER_HEXER_UNEVEN_GROUNDING_VERSION'), 'Mucker/Hexer grounding version marker missing.');
assert(liveDebug.includes('SNAPSHOT_MUCKER_HEXER_FLOATING_Y_OFFSET = 17'), 'Mucker/Hexer grounding must preserve uneven terrain by subtracting the measured +17 offset.');
assert(liveDebug.includes('snapshotGroundMuckerOrHexerPosition'), 'Mucker/Hexer grounding helper missing.');
assert(liveDebug.indexOf('snapshotGroundMuckerOrHexerPosition') < liveDebug.indexOf('const shouldGround = snapshotIsLiveFloatingGroveNpcCandidate'), 'Mucker/Hexer grounding must run before Grove flat-grounding.');

const grove = read('src/shared/harthmere/snapshot_grove_content.ts');
assert(grove.includes('SNAPSHOT_GROVE_NPC_ROUTE_VERSION'), 'Grove route version marker missing.');
for (const key of ['billy', 'doc', 'mucked_robot', 'grove_banker_merl', 'mira_thatch', 'carlo_the_cook']) {
  assert(grove.includes(`${key}: {`), `Missing Grove route profile for ${key}.`);
}
assert(grove.includes('snapshotGroveNpcRouteMotion'), 'Grove route motion helper missing.');

const npcs = read('src/client/game/resources/npcs.ts');
assert(npcs.includes('snapshotGroveNpcRouteMotion'), 'NPC renderer must consume Grove named routes.');
assert(npcs.includes('reason: "grove_named_route"'), 'Grove NPC movement must publish a route reason.');
assert(npcs.includes('world: [position[0], position[1], position[2]]'), 'Motion debug output must include corrected Y/world position.');
assert(npcs.includes('harthmere-grove-robot-unique'), 'Robot unique voxel detail marker missing.');
assert(npcs.includes('harthmere-grove-courier-strap'), 'Courier/Billy unique voxel detail marker missing.');

const faces = read('src/shared/harthmere/voxel_faces.ts');
assert(faces.includes('HARTHMERE_GROVE_UNIQUE_NPC_POLISH_VERSION'), 'Unique Grove NPC appearance version marker missing.');
for (const name of ['billy', 'doc', 'mucked_robot', 'nia_guild_clerk', 'grove_banker_merl', 'mira_thatch', 'carlo_the_cook']) {
  assert(faces.includes(name), `Unique appearance profile missing ${name}.`);
}
assert(faces.includes('field_medic_coat'), 'Doc must use field medic clothing.');
assert(faces.includes('tool_hammer'), 'Mira/Fern/Robot must get tool/hammer props where appropriate.');

const inventory = read('src/client/components/biomes_ui/tabs/InventoryTab.tsx');
assert(inventory.includes('inventoryIconLooksLikeImageUrl'), 'Inventory must detect image/icon URLs.');
assert(inventory.includes('buckets'), 'Inventory must render bucket asset URLs as images, not text.');
const banking = read('src/client/components/biomes_ui/tabs/BankingTab.tsx');
assert(banking.includes('renderBankingIcon'), 'Banking must render image/icon URLs through the shared icon renderer.');
assert(banking.includes('buckets'), 'Banking must render bucket asset URLs as images, not text.');

console.log('PASS grove-ui-routes-mucker-grounding');
