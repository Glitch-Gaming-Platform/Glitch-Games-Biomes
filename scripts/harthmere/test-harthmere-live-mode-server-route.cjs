#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function pass(message) {
  console.log(`OK ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (condition) {
    pass(message);
  } else {
    fail(message);
  }
}

function includesAll(text, label, values) {
  for (const value of values) {
    assert(text.includes(value), `${label} includes ${value}`);
  }
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const routePath = path.join(root, "src/pages/api/harthmere/live_mode.ts");
const readinessPath = path.join(
  root,
  "src/shared/harthmere/live_mode_readiness.ts"
);

console.log(
  "==> Running test-harthmere-live-mode-server-route.cjs against " + root
);

assert(fs.existsSync(routePath), "live-mode server API route exists");
assert(fs.existsSync(readinessPath), "live-mode readiness module exists");

const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";
const readiness = fs.existsSync(readinessPath)
  ? fs.readFileSync(readinessPath, "utf8")
  : "";

includesAll(route, "route marker/auth", [
  "HARTHMERE_LIVE_MODE_SERVER_ROUTE",
  "biomesApiHandler",
  "auth: \"required\"",
  "body: zLiveModeRequest",
  "response: zLiveModeResponse",
]);

includesAll(route, "shared authority contracts", [
  "validateHarthmereLiveModeAuthorityEnvelope",
  "buildHarthmereLiveModePersistenceMutationPlan",
  "createHarthmereLiveModeEvent",
  "createHarthmereLiveModeUiEvent",
]);

includesAll(route, "server hook implementations", [
  "wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelope",
  "persist_buildHarthmereLiveModePersistenceMutationPlan_inside_database_transaction",
  "publish_createHarthmereLiveModeEvent_to_server_event_stream",
  "deliver_createHarthmereLiveModeUiEvent_from_server_outbox",
  "route_real_attacks_abilities_xp_loot_death_respawn_through_shared_rules",
]);

includesAll(route, "production Redis persistence", [
  "connectToRedis(\"firehose\")",
  "harthmere:live_mode:current:idempotency",
  "harthmere:live_mode:current:events",
  "harthmere:live_mode:current:ui_outbox",
  "redis.primary.set(",
  "\"EX\"",
  "\"NX\"",
  "tx.xadd(",
]);

includesAll(route, "idempotency replay response", [
  "duplicate: true",
  "replayed: true",
  "JSON.parse(previous)",
]);

includesAll(route, "server-owned actor identity", [
  "async ({ auth: { userId }, body })",
  "const actorId = String(userId)",
  "actorId,",
]);

const requestSchemaStart = route.indexOf("const zLiveModeRequest = z.object({");
const requestSchemaEnd = route.indexOf("});", requestSchemaStart);
const requestSchema =
  requestSchemaStart >= 0 && requestSchemaEnd >= 0
    ? route.slice(requestSchemaStart, requestSchemaEnd)
    : route;
assert(!requestSchema.includes("actorId"), "request body cannot supply actorId");
assert(!route.includes("localStorage"), "server route does not use localStorage");
const handlerValidationIndex = route.indexOf(
  "const validation = validateHarthmereLiveModeAuthorityEnvelope(envelope)"
);
assert(
  handlerValidationIndex >= 0 &&
    handlerValidationIndex <
      route.indexOf(
        "persist_buildHarthmereLiveModePersistenceMutationPlan_inside_database_transaction",
        handlerValidationIndex
      ),
  "authority validation happens before persistence"
);
assert(route.includes("persisted: false"), "invalid requests are not persisted");
assert(route.includes("persisted: true"), "valid requests are persisted");

includesAll(readiness, "test manifest", [
  "HARTHMERE_LIVE_MODE_TDD_TESTS",
  "test-harthmere-live-mode-server-route.cjs",
]);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
