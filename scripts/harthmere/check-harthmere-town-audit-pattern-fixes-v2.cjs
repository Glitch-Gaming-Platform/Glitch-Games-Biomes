#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || process.cwd();
const assetsPath = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(repo, "src/shared/harthmere/town_registry.ts");
const combatPath = path.join(repo, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");

const assets = fs.readFileSync(assetsPath, "utf8");
const registry = fs.readFileSync(registryPath, "utf8");
const combat = fs.readFileSync(combatPath, "utf8");

let failures = 0;
const ok = (msg) => console.log(`OK ${msg}`);
const fail = (msg) => { console.log(`FAIL ${msg}`); failures += 1; };
const has = (text, needle, msg) => text.includes(needle) ? ok(msg) : fail(msg);
const hasRe = (text, re, msg) => re.test(text) ? ok(msg) : fail(msg);

has(assets, 'harthmere-town-audit-pattern-fixes-v2', 'audit pattern fixes v2 marker exists');
has(assets, 'HARTHMERE_TINY_FBX_PROP_SCALE_CAPS', 'tiny FBX food scale caps exist');
has(assets, 'normalizeHarthmerePropPlacementScale(asset, scale)', 'P() normalizes authored prop scale');
hasRe(assets, /fbx\("food_apple",\s*"[^"]+",\s*0\.008\)/, 'apple FBX default scale is corrected');
hasRe(assets, /fbx\("food_fish",\s*"[^"]+",\s*0\.006\)/, 'fish FBX default scale is corrected');
has(assets, 'function harthmerePlayerCollisionObstacles()', 'player collision obstacle list exists');
has(assets, 'serializeHarthmereCollisionObstacle', 'collision serializer exists');
has(assets, 'inspectPlayerAt', 'player collision query exposes detailed inspection');
has(assets, 'playerObstacleCount', 'player collision query exposes obstacle count');
has(assets, 'all non-wilds actors should', 'town actor wander freeze rationale exists');
has(registry, 'harthmere-town-audit-pattern-fixes-v2', 'registry fix marker exists');
has(registry, '/food_|coin|key', 'registry treats food assets as tiny');
has(registry, 'tiny food/hand props should not block movement', 'food assets do not block movement');
has(combat, 'harthmere-town-player-collision-safety-v2', 'player collision safety v2 marker exists');
has(combat, 'useRef', 'player collision safety keeps last safe position');
has(combat, 'resolveHarthmerePlayerCollisionForSnapshot', 'forward arc runtime applies player collision safety');
has(combat, '__harthmerePlayerCollisionStats', 'player collision debug stats exposed');

if (failures) {
  console.log(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
