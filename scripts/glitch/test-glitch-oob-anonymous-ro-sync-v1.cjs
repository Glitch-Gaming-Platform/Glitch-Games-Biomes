#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const oobPath = path.join(root, "src/server/oob/oob.ts");
const dockerPath = path.join(root, "Dockerfile.biomes");
const runnerPath = path.join(root, "scripts/glitch/run-glitch-local-game-stack-v92.sh");
const deployPath = path.join(root, "scripts/glitch/deploy-production-local-redis-smoke-v1.sh");

let failures = 0;
function ok(label, condition, detail = "") {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`     ${detail}`);
  }
}
function read(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (error) {
    failures += 1;
    console.error(`FAIL read ${p}: ${error.message}`);
    return "";
  }
}

const oob = read(oobPath);
const dockerfile = read(dockerPath);
const runner = read(runnerPath);
const deploy = read(deployPath);

ok("OOB anonymous policy helper exists", oob.includes("function permitAnonymousOobRequests"));
ok("OOB anonymous policy honors explicit PERMIT_ANONYMOUS", oob.includes('truthyEnv(process.env.PERMIT_ANONYMOUS)'));
ok("OOB anonymous policy honors RO_SYNC like websocket sync", oob.includes('truthyEnv(process.env.RO_SYNC)'));
ok("OOB production auth error uses shared anonymous policy", /ok\(\s*permitAnonymousOobRequests\(\)\s*&&\s*!clientCheckUserId\s*\)/.test(oob));
ok("OOB production still rejects mismatched authenticated user ids", oob.includes("ok(!clientCheckUserId || clientCheckUserId === auth.auth.userId)"));
ok("production Docker runtime enables RO_SYNC", /ENV\s+RO_SYNC=1/.test(dockerfile));
ok("single-container runtime defaults RO_SYNC on", runner.includes('export RO_SYNC="${RO_SYNC:-1}"'));
ok("production deploy guardrails include OOB anonymous RO sync test", deploy.includes("test-glitch-oob-anonymous-ro-sync-v1.cjs"));

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: PASS");
