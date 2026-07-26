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
const deployPath = "scripts/glitch/deploy-production-local-redis-smoke.sh";
const assets = exists(assetsPath) ? read(assetsPath) : "";
const deploy = exists(deployPath) ? read(deployPath) : "";
const speedHelper = sectionBetween(assets, "function speedUpHarthmereGroveNpcWander", "const HARTHMERE_ROUTE_POSITION_SAFE_VERSION");
const actorFactory = sectionBetween(assets, "const A = (", "const HARTHMERE_GROVE_NPC_WALK_SPEED_MULTIPLIER");
const routeDistribution = sectionBetween(assets, "function applyHarthmereNpcRouteDistribution", "const HARTHMERE_NPC_DISTRIBUTION");

console.log("== Harthmere Grove NPC speed current ==");
console.log(`Root: ${root}\n`);

check("Harthmere runtime asset file exists", !!assets);
check("Non-battle town NPCs walk at their authored speed (multiplier is 1)", assets.includes("const HARTHMERE_GROVE_NPC_WALK_SPEED_MULTIPLIER = 1;"));
check("no accelerated town wander multiplier remains", !/const HARTHMERE_GROVE_NPC_WALK_SPEED_MULTIPLIER = (?!1;)/.test(assets));
check("speed helper exists", speedHelper.includes("speedUpHarthmereGroveNpcWander"));
check("speed helper only targets townsperson NPC assets", speedHelper.includes('asset.startsWith("townsperson_")'));
check("speed helper leaves wild and underways actors unchanged", speedHelper.includes('districtName.includes("wild")') && speedHelper.includes('districtName.includes("underways")'));
check("speed helper still routes through the single multiplier clamp point", speedHelper.includes("wander.speed * HARTHMERE_GROVE_NPC_WALK_SPEED_MULTIPLIER"));
check("actor factory applies speed helper after normalizeHarthmereActorWander", actorFactory.includes("speedUpHarthmereGroveNpcWander(") && actorFactory.includes("normalizeHarthmereActorWander(asset, name, district, x, z, wander)"));
check("route distribution preserves already-scaled speed", routeDistribution.includes("speed: wander.speed"));
check("NPC movement still uses swept collision after speed increase", assets.includes("resolveHarthmereNpcWanderPosition") && assets.includes("sweepHarthmereNpcCollisionObstacle"));
check("repulsion still cannot push faster NPCs into walls", assets.includes("findHarthmereNpcBodyCollisionObstacle(resolvedX, resolvedZ)"));
check("deploy production guardrails run Grove NPC speed test", deploy.includes("test-harthmere-grove-npc-speed.cjs"));

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
