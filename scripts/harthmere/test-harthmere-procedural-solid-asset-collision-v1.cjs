#!/usr/bin/env node
/* HARTHMERE_PROCEDURAL_SOLID_ASSET_COLLISION_V1 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
let ok = true;
function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  if (detail) for (const line of (Array.isArray(detail) ? detail : String(detail).split("\n")).filter(Boolean)) console.log(`  - ${line}`);
}
function readOptional(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf8");
}
function readRequired(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) { fail(`${rel} exists`, `Missing ${full}`); return ""; }
  pass(`${rel} exists`);
  return fs.readFileSync(full, "utf8");
}

console.log("== Harthmere procedural/spawned solid asset collision tests v1 ==");
console.log(`Root: ${root}`);
console.log();

const events = readRequired("src/shared/harthmere/town_events.ts");
const assets = readRequired("src/client/game/renderers/local_dev/harthmere_assets.ts");
const registry = readRequired("src/shared/harthmere/town_registry.ts");
const routes = readOptional("src/shared/harthmere/town_routes.ts");
const all = `${events}\n${assets}\n${registry}\n${routes}`;

if (/HARTHMERE_PROCEDURAL_SOLID_ASSET_COLLISION_V1|proceduralSolidAssetCollision|spawnedSolidCollision/i.test(all)) {
  pass("procedural/spawned solid collision contract marker exists");
} else {
  fail("procedural/spawned solid collision contract marker exists", "Add HARTHMERE_PROCEDURAL_SOLID_ASSET_COLLISION_V1 and route spawned props through the same town collision registry.");
}

const expectedSpawnFamilies = ["barricade", "crate", "cart", "wagon", "coffin", "stall", "table", "fence", "rock", "debris"];
const missingFamilies = expectedSpawnFamilies.filter((family) => !new RegExp(family, "i").test(events + assets));
if (missingFamilies.length === 0) pass("event/procedural catalog covers common spawned solid prop families");
else fail("event/procedural catalog covers common spawned solid prop families", missingFamilies);

if (/blocksPlayer|playerBlocking|solid.*player|town.*collision.*registry/i.test(events)) pass("spawned event props declare player-blocking collision or registry lookup");
else fail("spawned event props declare player-blocking collision or registry lookup", "Event-spawned barricades/crates/carts must not bypass blocksPlayer classification.");

if (/core service roads|service road|activation.*block|cannot.*block|road clearance|lane clearance/i.test(events)) pass("event-spawned props cannot block core service roads");
else fail("event-spawned props cannot block core service roads", "Events must validate spawned props against gate/market/dock/service lanes.");

if (/register.*procedural.*obstacle|add.*procedural.*obstacle|spawned.*obstacle|dynamic.*obstacle|runtime.*obstacle/i.test(assets)) pass("runtime supports adding/removing dynamic procedural obstacles");
else fail("runtime supports adding/removing dynamic procedural obstacles", "Renderer/runtime needs a dynamic obstacle path for spawned solid props.");

if (/despawn|remove.*obstacle|clear.*dynamic|event.*cleanup/i.test(assets + events)) pass("procedural obstacle cleanup/despawn is represented");
else fail("procedural obstacle cleanup/despawn is represented", "Dynamic obstacles need cleanup when events end or props despawn.");

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
