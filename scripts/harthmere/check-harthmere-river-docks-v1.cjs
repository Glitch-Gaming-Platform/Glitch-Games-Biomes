#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_RIVER_DOCKS_VERSION/],
  ["fish and fishbone props are registered", /fbx\("food_fish"[\s\S]*fbx\("food_fishbone"/],
  ["Dock Ledger Warehouse shell remains present", /Dock Ledger Warehouse/],
  ["ferry cargo fishing sign exists", /River Docks ferry cargo contracts fishing trainer sign/],
  ["fog lamps and dock bell create river identity", /River Docks fog lamp beside cargo road[\s\S]*River Docks ferry fog lamp at pier head[\s\S]*Dock bell mounted above ferry and flood warning post/],
  ["warehouse roof detail and cargo board exist", /Dock Ledger Warehouse roof dormer facing river[\s\S]*Dock Ledger Warehouse smoke vent[\s\S]*Cargo contracts board outside Dock Ledger Warehouse/],
  ["cargo contract and ferry schedule are supported on board", /Pinned cargo contract supported on warehouse board[\s\S]*Pinned ferry schedule supported on warehouse board/],
  ["cargo handcart and sorted goods exist", /Cargo handcart waiting beside warehouse road[\s\S]*Sorted river goods crate beside warehouse handcart/],
  ["ferry travel marker and skiff proxy exist", /Ferry master water travel sign at pier[\s\S]*Low ferry skiff silhouette tied to pier[\s\S]*Ferry mooring rope tied on pier edge/],
  ["existing core dock planks/cargo remain", /Main dock planks[\s\S]*Ferry dock planks[\s\S]*Whispering crate on dock[\s\S]*River bridge extension/],
  ["dockmaster ledger booth is supported", /Dockmaster ledger booth counter[\s\S]*Dock ledger supported on dockmaster counter[\s\S]*Warehouse key supported on dockmaster counter[\s\S]*Cargo manifest supported on dockmaster counter/],
  ["fish market table has supported fish props", /Fish market cleaning table beside pier[\s\S]*Fresh river fish supported on fish market table[\s\S]*Fishbone scraps supported on fish market table[\s\S]*Fillet knife supported on fish market table/],
  ["fish market floor support and trainer board exist", /Fish guts bucket on floor beside cleaning table[\s\S]*Salt barrel beside fish market table[\s\S]*Fishing trainer and river goods vendor board/],
  ["customs and cargo sorting details exist", /Customs inspection crate on floor[\s\S]*Customs seal supported on inspection crate[\s\S]*Warehouse sorted cargo stack[\s\S]*River ale and lamp-oil barrel stack/],
  ["smuggler contact and contraband stash exist", /Smuggler contact marker table behind cargo[\s\S]*Smuggler signal bottle supported on contact table[\s\S]*River Knots coded note supported on contact table[\s\S]*Contraband false-bottom crate tucked behind cargo/],
  ["dock fire event anchor exists", /Dock fire pitch barrel event anchor[\s\S]*Dock fire bucket-line event notice[\s\S]*Fire bucket on floor beside event notice/],
  ["flood warning and river beast event anchor exist", /Flood warning and river beast sighting board[\s\S]*River beast warning supported on flood board[\s\S]*Flood rescue rope crate on floor[\s\S]*Rescue rope supported on flood rescue crate/],
  ["corpse under bridge clue exists", /Corpse-under-bridge clue box near shadowed pier[\s\S]*Riverbone clue supported on corpse-under-bridge box[\s\S]*Low lantern marking corpse-under-bridge clue/],
  ["Tovin and existing cargo hauler remain", /Tovin Reed dock ledger loop[\s\S]*Cargo hauler walking loop/],
  ["named dockmaster Tovin ledger role is placed", /Dockmaster Tovin Reed cargo contracts and ferry ledger/],
  ["fishing trainer and river vendor are placed", /Fishing trainer gutting river catch[\s\S]*River goods vendor near fish market/],
  ["ferry master and smuggler contact are placed", /Ferry master water travel post[\s\S]*River Knots smuggler contact behind cargo/],
  ["customs guard and flood handler are placed", /Customs guard inspecting sealed crates[\s\S]*Flood rescue rope handler/],
  ["dock animals add life and clue readability", /Dock cat watching fish table[\s\S]*Crow circling corpse-under-bridge clue/],
  ["River Docks watermill remains", /River watermill near docks/],
];

let failed = 0;
for (const [label, pattern] of checks) {
  if (pattern.test(src)) {
    console.log(`OK ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL ${label}`);
  }
}

const forbidden = [
  /River Docks[^\n]+Blocked doorway/i,
  /River Docks[^\n]+Doorway blocker/i,
  /River Docks[^\n]+Entrance blocker/i,
  /River Docks[^\n]+Blocks main pier/i,
];
for (const pattern of forbidden) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL river docks patch introduced an explicitly named blocker");
  }
}

const usedAssets = Array.from(src.matchAll(/\b[PA]\(\s*"([^"]+)"/g)).map((m) => m[1]);
const registered = new Set(Array.from(src.matchAll(/\b(?:gltf|fbx|obj)\(\s*"([^"]+)"/g)).map((m) => m[1]));
const missing = Array.from(new Set(usedAssets.filter((asset) => !registered.has(asset)))).sort();
if (missing.length) {
  failed += 1;
  console.log(`FAIL unregistered placement assets: ${missing.join(", ")}`);
}

if (failed) {
  console.log(`\nRESULT: FAIL (${failed} checks failed)`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
