#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));
let failures = 0;
function check(name, condition) {
  if (condition) {
    console.log(`OK ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}`);
  }
}
function sectionBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start < 0) return "";
  const end = source.indexOf(endToken, start + startToken.length);
  return source.slice(start, end < 0 ? undefined : end);
}

const assetsPath = "src/client/game/renderers/local_dev/harthmere_assets.ts";
const deployPath = "scripts/glitch/deploy-production-local-redis-smoke-v1.sh";
const assets = exists(assetsPath) ? read(assetsPath) : "";
const deploy = exists(deployPath) ? read(deployPath) : "";
const speedHelper = sectionBetween(assets, "function speedUpHarthmereGroveNpcWanderV153", "const HARTHMERE_ROUTE_POSITION_SAFE_VERSION_V67");
const actorFactory = sectionBetween(assets, "const A = (", "const HARTHMERE_GROVE_NPC_WALK_SPEED_MULTIPLIER_V153");
const routeDistribution = sectionBetween(assets, "function applyHarthmereNpcRouteDistributionV48", "const HARTHMERE_NPC_DISTRIBUTION_V48");

console.log("== Harthmere Grove NPC speed v153 ==");
console.log(`Root: ${root}\n`);

check("Harthmere runtime asset file exists", !!assets);
check("Grove NPC speed multiplier is exactly 1.8", assets.includes("const HARTHMERE_GROVE_NPC_WALK_SPEED_MULTIPLIER_V153 = 1.8;"));
check("speed helper exists", speedHelper.includes("speedUpHarthmereGroveNpcWanderV153"));
check("speed helper only targets townsperson NPC assets", speedHelper.includes('asset.startsWith("townsperson_")'));
check("speed helper leaves wild and underways actors unchanged", speedHelper.includes('districtName.includes("wild")') && speedHelper.includes('districtName.includes("underways")'));
check("speed helper multiplies normalized speed by the 1.8 constant", speedHelper.includes("wander.speed * HARTHMERE_GROVE_NPC_WALK_SPEED_MULTIPLIER_V153"));
check("actor factory applies speed helper after normalizeHarthmereActorWander", actorFactory.includes("speedUpHarthmereGroveNpcWanderV153(") && actorFactory.includes("normalizeHarthmereActorWander(asset, name, district, x, z, wander)"));
check("route distribution preserves already-scaled speed", routeDistribution.includes("speed: wander.speed"));
check("NPC movement still uses swept collision after speed increase", assets.includes("resolveHarthmereNpcWanderPosition") && assets.includes("sweepHarthmereNpcCollisionObstacleV150"));
check("repulsion still cannot push faster NPCs into walls", assets.includes("findHarthmereNpcBodyCollisionObstacleV150(resolvedX, resolvedZ)"));
check("deploy production guardrails run Grove NPC speed test", deploy.includes("test-harthmere-grove-npc-speed-v153.cjs"));

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
