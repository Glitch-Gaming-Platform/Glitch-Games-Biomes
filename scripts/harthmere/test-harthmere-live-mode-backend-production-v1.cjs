#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function check(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  }
}

function includesAll(source, label, values) {
  for (const value of values) {
    check(source.includes(value), `${label} includes ${value}`);
  }
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const backendPath = path.join(root, "src/shared/harthmere/live_mode_backend_v1.ts");
const routePath = path.join(root, "src/pages/api/harthmere/live_mode.ts");
const readinessPath = path.join(root, "src/shared/harthmere/live_mode_readiness_v1.ts");

console.log("== Harthmere live-mode backend production v1 ==");

check(fs.existsSync(backendPath), "production backend reducer exists");
check(fs.existsSync(routePath), "live-mode route exists");
check(fs.existsSync(readinessPath), "readiness contracts exist");

const backend = fs.readFileSync(backendPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const readiness = fs.readFileSync(readinessPath, "utf8");

includesAll(backend, "backend state models", [
  "HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1",
  "inventory",
  "economy",
  "guild",
  "law",
  "classMagic",
  "quests",
  "property",
  "farming",
  "combat",
]);

includesAll(backend, "production mutation actions", [
  "request_inventory_mutation",
  "request_vendor_transaction",
  "request_auction_post",
  "request_auction_settle",
  "request_bank_transaction",
  "request_mail_transaction",
  "request_guild_mutation",
  "request_law_reputation_mutation",
  "request_magic_progress",
  "request_quest_state_update",
  "request_property_building_mutation",
  "request_crafting",
  "request_farming_action",
  "request_attack",
  "request_loot_claim",
  "request_death_transition",
  "request_respawn",
]);

includesAll(backend, "server-side safety primitives", [
  "recordDelta",
  "Math.max(0",
  "Math.min(250",
  "payloadRecord",
  "touchedModels",
  "sharedStateKeys",
  "harthmereLiveModePlayerStateKeyV1",
  "harthmereLiveModeLedgerStreamKeyV1",
]);

includesAll(route, "route persistence wiring", [
  "parseHarthmereLiveModeBackendStateV1",
  "reduceHarthmereLiveModeBackendStateV1",
  "backendMutation",
  "harthmereLiveModePlayerStateKeyV1",
  "harthmereLiveModeLedgerStreamKeyV1",
  "tx.set(playerStateKey",
  "tx.xadd(",
  "\"NX\"",
]);

includesAll(route, "route accepts production gameplay subsystems", [
  '"inventory"',
  '"economy"',
  '"guild"',
  '"law"',
  '"magic"',
  '"quest"',
  '"vendor"',
  '"auction"',
  '"bank"',
  '"mail"',
  '"property"',
  '"crafting"',
  '"farming"',
  '"building"',
]);

check(!backend.includes("localStorage"), "backend reducer does not use localStorage");
check(!route.includes("localStorage"), "live-mode route does not use localStorage");
check(
  readiness.includes("HarthmereLiveModeProductionSubsystemV1") &&
    readiness.includes("HarthmereLiveModeAnySubsystemV1"),
  "readiness contracts include production subsystem union"
);
check(
  readiness.includes("test-harthmere-live-mode-backend-production-v1.cjs"),
  "backend production test is in the readiness manifest"
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
