#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function ok(label) { console.log(`OK ${label}`); }
function fail(label) { console.error(`FAIL ${label}`); process.exitCode = 1; }
function expect(label, condition) { condition ? ok(label) : fail(label); }
function has(text, needle) { return text.includes(needle); }

const shim = read("src/server/shim/main.ts");
const players = read("src/server/logic/utils/players.ts");
const runtime = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const bridge = read("src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx");

expect("server has Grove/Harthmere separation marker", has(shim, "HARTHMERE_GROVE_SEPARATION_V72"));
expect("server offset applies when FORCE_LOCAL_DEV_TOWN is used", /BIOMES_FORCE_LOCAL_DEV_TOWN\s*===\s*["']1["']/.test(shim));
expect("server exposes legacy standalone escape hatch", has(shim, "BIOMES_HARTHMERE_STANDALONE_TOWN"));
expect("server terrain seed log reports shifted x range", has(shim, "STARTER_TOWN_WILDS_X0 + harthmereExtraTownOffsetXV1()"));
expect("player spawn offset applies when FORCE_LOCAL_DEV_TOWN is used", has(players, "HARTHMERE_GROVE_SEPARATION_PLAYER_SPAWN_V72") && /BIOMES_FORCE_LOCAL_DEV_TOWN\s*===\s*["']1["']/.test(players));
expect("player starter-town safe bounds are offset-aware", has(players, "const offsetX = shouldOffsetLocalDevStarterTownSpawnV1()"));
expect("client runtime offset applies when FORCE_LOCAL_DEV_TOWN is used", has(runtime, "HARTHMERE_GROVE_SEPARATION_RUNTIME_V72") && /BIOMES_FORCE_LOCAL_DEV_TOWN\s*===\s*["']1["']/.test(runtime));
expect("client snapshot-built policy applies in FORCE_LOCAL_DEV_TOWN mode", has(runtime, "NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN") && has(runtime, "BIOMES_FORCE_LOCAL_DEV_TOWN"));
expect("Jackie dialogue uses production copy marker", has(bridge, "SNAPSHOT_MISSION_BRIDGE_PRODUCTION_COPY_V72"));
expect("Jackie dialogue keeps Road Ahead quest wording", has(bridge, "Road Ahead: Meet Jackie") && has(bridge, "Now, approach Jackie in the Grove"));
expect("Jackie dialogue removed debug/compatibility wording", !/Compatibility bridge|dead bark|snapshot task bridge|imported snapshot task records are not driving|Snapshot Starter Task|Source:|Start:/.test(bridge));
expect("Jackie map action is production-facing", has(bridge, "Mark Jackie on map") && has(bridge, "Ask about the road"));

if (process.exitCode) {
  console.error("v72 Grove/Harthmere separation + production quest check failed");
  process.exit(process.exitCode);
}
console.log("v72 Grove/Harthmere separation + production quest check passed");
