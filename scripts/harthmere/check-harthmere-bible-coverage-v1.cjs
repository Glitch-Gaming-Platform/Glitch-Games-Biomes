#!/usr/bin/env node
/*
 * Harthmere Bible Coverage + District Identity Audit Checker
 *
 * Static audit for the local-dev Harthmere town runtime placement file.
 * Default mode reports coverage and exits 0 unless the audit itself cannot run
 * or the placement file is structurally broken. Use --strict or
 * HARTHMERE_BIBLE_AUDIT_STRICT=1 to turn TODO/WARN items into failures.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const strict = args.includes('--strict') || process.env.HARTHMERE_BIBLE_AUDIT_STRICT === '1';
const verbose = args.includes('--verbose') || process.env.HARTHMERE_BIBLE_AUDIT_VERBOSE === '1';
const rootArg = args.find((arg) => !arg.startsWith('-'));
const root = path.resolve(rootArg || process.cwd());

const runtimePath = path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts');
const manifestPath = path.join(root, 'src/shared/game/medieval/harthmereAssetManifest.generated.ts');

let hardFailed = false;
let warned = false;
let okCount = 0;
let warnCount = 0;
let failCount = 0;
const todos = [];

function readRequired(file, label) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`missing ${label}: ${file}`);
    return '';
  }
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function toRegex(pattern) {
  if (pattern instanceof RegExp) {
    return pattern;
  }
  return new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function pass(message) {
  okCount += 1;
  console.log(`OK ${message}`);
}

function todo(message, hint) {
  warnCount += 1;
  warned = true;
  const suffix = hint ? ` — ${hint}` : '';
  console.log(`WARN ${message}${suffix}`);
  todos.push(`${message}${suffix}`);
}

function fail(message) {
  failCount += 1;
  hardFailed = true;
  console.error(`FAIL ${message}`);
}

function expect(condition, message, hint) {
  if (condition) {
    pass(message);
  } else {
    todo(message, hint);
  }
}

function expectCritical(condition, message, hint) {
  if (condition) {
    pass(message);
  } else if (strict) {
    fail(`${message}${hint ? ` — ${hint}` : ''}`);
  } else {
    todo(message, hint);
  }
}

function anyText(haystack, patterns) {
  return patterns.some((pattern) => toRegex(pattern).test(haystack));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function extractQuoted(line) {
  return Array.from(line.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)).map((match) => match[1]);
}

function collectPlacementFacts(runtime) {
  const placements = [];
  const lines = runtime.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const call = line.match(/^\.{0,3}\s*([PA])\(\s*"([^"]+)"/);
    if (call) {
      const strings = extractQuoted(line);
      placements.push({
        kind: call[1] === 'A' ? 'actor' : 'prop',
        asset: strings[0] || '',
        name: strings[1] || '',
        district: strings[2] || '',
        line: i + 1,
        text: line,
      });
      continue;
    }
    const row = line.match(/^\.{0,3}\s*row\(\s*"([^"]+)"/);
    if (row) {
      const strings = extractQuoted(line);
      placements.push({
        kind: 'row',
        asset: strings[0] || '',
        district: strings[1] || '',
        name: strings[2] || '',
        line: i + 1,
        text: line,
      });
    }
  }

  const shellRegex = /createBuildingShell\(\{([\s\S]*?)\}\)/g;
  for (const match of runtime.matchAll(shellRegex)) {
    const body = match[1];
    const name = (body.match(/name:\s*"([^"]+)"/) || [])[1] || '';
    const district = (body.match(/district:\s*"([^"]+)"/) || [])[1] || '';
    if (name || district) {
      placements.push({
        kind: 'building',
        asset: 'building_shell',
        name,
        district,
        line: runtime.slice(0, match.index).split(/\r?\n/).length,
        text: `createBuildingShell ${name} ${district}`,
      });
    }
  }

  return placements;
}

function placementHay(placements) {
  return normalize(
    placements.map((p) => `${p.kind} ${p.asset} ${p.name} ${p.district}`).join(' '),
  );
}

function placementHas(placements, patterns) {
  const hay = placementHay(placements);
  return anyText(hay, patterns);
}

function districtHas(placements, district, patterns) {
  const hay = normalize(
    placements
      .filter((p) => normalize(p.district).includes(normalize(district)))
      .map((p) => `${p.kind} ${p.asset} ${p.name} ${p.district}`)
      .join(' '),
  );
  return anyText(hay, patterns);
}

function districtCount(placements, district) {
  return placements.filter((p) => normalize(p.district).includes(normalize(district))).length;
}

function extractRegisteredAssets(runtime) {
  return new Set(Array.from(runtime.matchAll(/\b(?:gltf|fbx|obj)\(\s*"([^"]+)"/g)).map((m) => m[1]));
}

function usedStaticAssets(placements) {
  return new Set(
    placements
      .filter((p) => p.kind === 'actor' || p.kind === 'prop' || p.kind === 'row')
      .map((p) => p.asset)
      .filter(Boolean),
  );
}

function printHeader(title) {
  console.log('');
  console.log(`== ${title} ==`);
}

const runtime = readRequired(runtimePath, 'Harthmere runtime placement file');
const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
const placements = collectPlacementFacts(runtime);
const districts = unique(placements.map((p) => p.district).filter(Boolean));
const registeredAssets = extractRegisteredAssets(runtime);
const usedAssets = usedStaticAssets(placements);
const missingUsedAssets = Array.from(usedAssets).filter((key) => !registeredAssets.has(key));

console.log('Harthmere Bible Coverage + District Identity Audit v1');
console.log(`Repo: ${root}`);
console.log(`Mode: ${strict ? 'STRICT' : 'report'}`);
console.log(`Runtime: ${runtimePath}`);

printHeader('Structural audit');
expectCritical(runtime.includes('HARTHMERE_V9_FULL_TOWN_REBUILD_START'), 'runtime contains full town rebuild marker', 'Expected the current Harthmere placement pass to be present.');
expectCritical(placements.length >= 250, `runtime has substantial placement coverage (${placements.length} parsed placements)`, 'Expected at least 250 static placement records for the town/wilds pass.');
expectCritical(districts.length >= 18, `runtime has many distinct districts/zones (${districts.length})`, 'District strings should be present on props, actors, rows, and shells.');
expectCritical(registeredAssets.size >= 120, `runtime has a large registered asset set (${registeredAssets.size})`, 'The checker needs a populated ASSETS registry.');
expectCritical(missingUsedAssets.length === 0, 'all directly used static placement assets are registered', missingUsedAssets.slice(0, 20).join(', '));

if (verbose && missingUsedAssets.length) {
  console.log(`Missing asset keys: ${missingUsedAssets.join(', ')}`);
}

printHeader('Bible district coverage');
const requiredDistricts = [
  ['North Gate', ['north gate', 'gate tower', 'toll', 'stable']],
  ['Market Square', ['market square', 'bridge fountain', 'stall', 'notice']],
  ['Player Services', ['player services', 'bank', 'courier', 'auction', 'storage']],
  ['Craftsman Row', ['craftsman row', 'black anvil', 'anvil', 'forge', 'workbench']],
  ['Copper Kettle', ['copper kettle', 'tavern', 'bar', 'dice', 'hearth']],
  ['Temple Green', ['temple green', 'chapel', 'candle', 'grave', 'resurrection']],
  ['Noble Rise', ['noble rise', 'reeve hall', 'tax', 'balcony', 'clerk']],
  ['River Docks', ['river docks', 'dock', 'ferry', 'cargo', 'fish']],
  ['Mudden Ward', ['mudden ward', 'drain', 'laundry', 'hideout', 'rat']],
  ['Guard Yard', ['guard yard', 'bounty', 'training', 'dummy', 'barracks']],
  ['Old Well', ['old well', 'old drain', 'underways', 'hatch', 'marker']],
  ['Residential District', ['residential district', 'cottage', 'family', 'bed']],
  ['Farm / Orchard', ['farm', 'orchard', 'windmill', 'crop', 'animal']],
  ['Building / Repair', ['building plot', 'repair', 'foundation', 'property']],
  ['Gathering', ['gathering node', 'iron vein', 'fishing', 'herb', 'scrap']],
];

for (const [label, patterns] of requiredDistricts) {
  const count = districtCount(placements, label.split(' / ')[0]);
  const hasIdentity = placementHas(placements, patterns);
  expectCritical(count > 0 || hasIdentity, `${label} exists in placement coverage`, `Add district-tagged placements or landmark props for ${label}.`);
  expect(count >= 3 || hasIdentity, `${label} has more than token visual identity`, `Current parsed count is ${count}. Add landmark/service/prop anchors.`);
}

printHeader('Core named NPC coverage');
const coreNpcs = [
  ['Sergeant Bram Holt', ['sergeant bram', 'bram holt']],
  ['Mara Thistle', ['mara thistle']],
  ['Elowen Pike', ['elowen pike']],
  ['Master Osric Vale', ['osric vale', 'master osric']],
  ['Father Aldren', ['father aldren']],
  ['Nessa Crowe', ['nessa crowe']],
  ['Tovin Reed', ['tovin reed']],
  ['Reeve Caldus Merrow', ['reeve caldus', 'caldus merrow']],
  ['Ysabet Fenlow', ['ysabet fenlow']],
  ['Edrik Vane', ['edrik vane']],
  ['Banker Merl Voss', ['banker merl', 'merl voss']],
  ['Courier Anwen', ['courier anwen']],
  ['Auction Clerk Pell', ['auction clerk pell', 'clerk pell']],
];
for (const [name, patterns] of coreNpcs) {
  expect(placementHas(placements, patterns), `${name} is placed or explicitly named`, `Add a named actor placement with district, appearance, and role props.`);
}

printHeader('Major service coverage');
const services = [
  ['Bank access', ['bank teller', 'vault chest', 'deposit chest']],
  ['Mail / courier access', ['courier anwen', 'courier parcel', 'mail loop', 'courier cart']],
  ['Auction / trade board', ['auction clerk', 'auction', 'trade board', 'market ledger']],
  ['Storage steward / storage', ['storage shelf', 'storage steward', 'deposit chest']],
  ['Guild registrar', ['guild registrar', 'guild counter', 'guild creation']],
  ['Cosmetic wardrobe mirror', ['wardrobe mirror', 'cosmetic mirror', 'wardrobe station']],
  ['Inn bind/rested XP marker', ['bind point', 'rested xp', 'room rental', 'innkeeper']],
  ['Healer / resurrection', ['resurrection', 'healer', 'blessing', 'condition cleansing', 'chapel loop']],
  ['Repair / blacksmith service', ['repair', 'black anvil', 'smithy', 'anvil', 'weapon stand']],
  ['Crafting order board', ['crafting order', 'work order', 'profession trainer']],
  ['Bounty board / guard service', ['bounty table', 'bounty board', 'guard yard']],
  ['Stable / mount service', ['stable', 'horse', 'stable yard office']],
  ['Ferry / boat travel', ['ferry dock', 'ferry lantern', 'boat travel', 'ferry master']],
  ['Fence / black market route', ['fence vendor', 'hidden shack', 'hideout', 'smuggler']],
];
for (const [label, patterns] of services) {
  expect(placementHas(placements, patterns), `${label} has a visible anchor`, `Add a prop, named NPC, sign, or station matching this MMO service.`);
}

printHeader('District landmark identity');
const landmarks = [
  ['North Gate landmark', 'North Gate', ['tower', 'ironbound door', 'watch banner', 'brazier']],
  ['Market Square landmark', 'Market Square', ['bridge fountain', 'fountain lamp', 'quest and notice']],
  ['Player Services landmark', 'Player Services', ['player services hall', 'vault', 'bank teller', 'ledger']],
  ['Craftsman Row landmark', 'Craftsman Row', ['black anvil', 'main anvil', 'forge', 'weapon stand']],
  ['Copper Kettle landmark', 'Copper Kettle', ['copper kettle', 'bar', 'hearth', 'dice table', 'stage']],
  ['Temple Green landmark', 'Temple Green', ['chapel', 'bell', 'vigil', 'pulpit', 'grave']],
  ['Noble Rise landmark', 'Noble Rise', ['reeve hall', 'balcony', 'tax', 'document shelf']],
  ['River Docks landmark', 'River Docks', ['dock planks', 'ferry', 'warehouse', 'watermill', 'cargo']],
  ['Mudden Ward landmark', 'Mudden Ward', ['mudden', 'drain', 'wash', 'laundry', 'hideout']],
  ['Guard Yard landmark', 'Guard Yard', ['dummy', 'bounty', 'training', 'banner']],
  ['Old Well / Underways landmark', 'Old Well', ['old drain', 'hatch', 'underways', 'marker']],
];
for (const [label, district, patterns] of landmarks) {
  expect(districtHas(placements, district, patterns) || placementHas(placements, patterns), `${label} is readable`, `Strengthen landmark props/signage for ${district}.`);
}

printHeader('Building shell coverage');
const buildings = [
  ['Dawn Loaf Bakery', ['dawn loaf bakery']],
  ['Brindle Provision House', ['brindle provision house']],
  ['Player Services Hall', ['player services hall']],
  ['Black Anvil Smithy', ['black anvil smithy']],
  ['Carpenter and Tailor Workshop', ['carpenter and tailor workshop']],
  ['Green Mortar Apothecary', ['green mortar apothecary']],
  ['Wyrm and Candle Magic Shop', ['wyrm and candle magic shop']],
  ['Copper Kettle Inn', ['copper kettle inn']],
  ['Reeve Hall', ['reeve hall']],
  ['Dock Ledger Warehouse', ['dock ledger warehouse']],
  ['Mudden Lean-To Home', ['mudden lean to home', 'mudden lean-to home']],
  ['Mudden Wash House', ['mudden wash house']],
  ['Roadside Family Cottage', ['roadside family cottage']],
  ['Guard Barracks', ['guard barracks']],
  ['Stable Yard Office', ['stable yard office']],
];
for (const [label, patterns] of buildings) {
  expect(placementHas(placements, patterns), `${label} building shell exists`, `Add createBuildingShell entry or explicit architecture props.`);
}

printHeader('Architecture and wayfinding asset identity');
const assetIdentity = [
  ['roof variety', ['roof high gable', 'roof flat', 'church roof', 'roof blue']],
  ['wall/window/door variety', ['wall_window', 'wall_entrance', 'door', 'window']],
  ['chimney/roof detail opportunity', ['chimney', 'smoke', 'hearth']],
  ['banner/signage coverage', ['banner', 'sign', 'kiosk', 'notice']],
  ['lighting coverage', ['lamp', 'lantern', 'torch', 'candle']],
  ['furniture/interior coverage', ['table', 'chair', 'shelf', 'bench', 'bed', 'bar']],
  ['cargo/storage coverage', ['crate', 'barrel', 'box', 'chest', 'bag']],
  ['crafting/equipment coverage', ['anvil', 'workbench', 'weaponstand', 'rack', 'sword', 'shield']],
  ['temple/cemetery coverage', ['church', 'tombstone', 'grave', 'pulpit', 'candlestick']],
  ['dock/smuggling coverage', ['dock', 'rope', 'chain', 'cargo', 'whispering crate']],
];
for (const [label, patterns] of assetIdentity) {
  expect(anyText(normalize(runtime), patterns), `${label} is represented`, `Use more curated assets from the manifest for this category.`);
}

printHeader('Event and live-ops anchor coverage');
const eventAnchors = [
  ['Market fair / notice / crowd events', ['quest and notice kiosk', 'market wayfinding', 'stall', 'public stocks', 'harvest fair']],
  ['Gate toll / caravan / inspection events', ['toll clerk desk', 'traveler wagon', 'gate patrol', 'watch sentry']],
  ['Inn social / stage / brawl events', ['dice table', 'stage banner', 'bar corner', 'tavern loop']],
  ['Forge accident / work order events', ['forge', 'workbench', 'weapon stand', 'tool rack']],
  ['Temple vigil / funeral / crypt events', ['vigil', 'fresh grave', 'grave marker', 'chapel loop']],
  ['Noble tax / protest / balcony events', ['tax clerk', 'reeve hall balcony', 'tax chest', 'noble guard']],
  ['Dock flood / fire / smuggling events', ['whispering crate', 'ferry dock', 'cargo chain', 'dock watch']],
  ['Mudden riot / tunnel / rat events', ['old drain', 'hidden shack', 'mudden ward dog', 'drain rat']],
  ['Guard training / bounty / invasion events', ['training dummy', 'bounty table', 'guard patrol around yard']],
  ['Old Well / Underways reveal events', ['old drain iron hatch', 'underways warning torch', 'old drain marker']],
];
for (const [label, patterns] of eventAnchors) {
  expect(placementHas(placements, patterns), `${label} has an anchor`, `Add a lightweight, non-blocking event marker/prop cluster.`);
}

printHeader('Movement and placement sanity signals');
const actorDoorwayHazards = placements.filter((p) => p.kind === 'actor' && /door|entrance|threshold/i.test(`${p.name} ${p.district}`));
expect(actorDoorwayHazards.length === 0, 'no actor placement is explicitly named as standing in a doorway/threshold', actorDoorwayHazards.map((p) => `${p.name}@${p.line}`).join(', '));
const supportedPropEvidence = placements.filter((p) => /(on floor|on table|supported|against wall|beside|mounted|leaning|fixed to wall|on rack|on counter|by .* wall|near|beside)/i.test(p.name)).length;
expect(supportedPropEvidence >= 60, `interior/small prop support language is common (${supportedPropEvidence} supported-placement names)`, 'Name supported props clearly so future audits catch floating/clipping mistakes.');
expect(runtime.includes('wander'), 'NPC actor wander hooks are visible to audit', 'Actor movement should remain discoverable in the runtime placement/update code.');
expect(anyText(runtime, ['harthmereNpcCollisionObstacles', 'lastSafePosition', 'renderer.npc_wall_collision.blocked']), 'NPC wall-collision guard is installed', 'Apply the NPC wall-collision patch before relying on roaming crowd loops.');

printHeader('Asset manifest availability');
if (manifest) {
  expect(manifest.includes('HARTHMERE_ALL_ASSETS'), 'generated Harthmere asset manifest is present', 'Run the Harthmere asset importer if missing.');
  const manifestAssetCount = (manifest.match(/"key":/g) || []).length;
  expect(manifestAssetCount >= 1000, `generated asset manifest is broad (${manifestAssetCount} indexed assets)`, 'The town refinement pass should use curated assets from the full manifest.');
  expect(anyText(manifest, ['Roof', 'roof', 'Church', 'Tavern', 'Market', 'Door', 'Window']), 'manifest includes architecture/shop categories useful for district identity', 'Review public/assets/harthmere/manifest files for additional curated props.');
} else {
  todo('generated Harthmere asset manifest is present', 'src/shared/game/medieval/harthmereAssetManifest.generated.ts was not found.');
}

console.log('');
console.log('== Summary ==');
console.log(`Parsed placements: ${placements.length}`);
console.log(`Parsed actors: ${placements.filter((p) => p.kind === 'actor').length}`);
console.log(`Parsed props/rows/buildings: ${placements.filter((p) => p.kind !== 'actor').length}`);
console.log(`Districts/zones: ${districts.length}`);
console.log(`Registered runtime assets: ${registeredAssets.size}`);
console.log(`Used static assets: ${usedAssets.size}`);
console.log(`Checks OK: ${okCount}`);
console.log(`Warnings/TODOs: ${warnCount}`);
console.log(`Failures: ${failCount}`);

if (todos.length) {
  console.log('');
  console.log('Top TODOs:');
  for (const item of todos.slice(0, 15)) {
    console.log(`- ${item}`);
  }
  if (todos.length > 15) {
    console.log(`- ...and ${todos.length - 15} more. Run with --verbose to inspect raw placement data if needed.`);
  }
}

if (verbose) {
  console.log('');
  console.log('District list:');
  for (const district of districts) {
    console.log(`- ${district}: ${districtCount(placements, district)}`);
  }
}

const strictFailed = strict && warned;
console.log('');
if (hardFailed || strictFailed) {
  console.error(`RESULT: FAIL${strictFailed && !hardFailed ? ' (strict mode treats warnings as failures)' : ''}`);
  process.exit(1);
}
console.log(warned ? 'RESULT: PASS_WITH_WARNINGS' : 'RESULT: PASS');
