#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
let failures = 0;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function ok(message) {
  console.log(`OK    ${message}`);
}
function fail(message, detail = "") {
  failures += 1;
  console.error(`FAIL  ${message}`);
  if (detail) console.error(`      ${detail}`);
}
function requireText(name, text, needle, message) {
  if (text.includes(needle)) ok(message);
  else fail(message, `${name} missing: ${needle}`);
}
function requireOrder(name, text, first, second, message) {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  if (a >= 0 && b >= 0 && a < b) ok(message);
  else fail(message, `${name} expected ${JSON.stringify(first)} before ${JSON.stringify(second)}; positions ${a}, ${b}`);
}

const deploy = read("scripts/glitch/deploy-production-local-redis-smoke-v1.sh");
requireText(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "verify_galois_runtime_in_container_v175()",
  "deploy has explicit in-container Galois runtime verifier"
);
requireText(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "docker exec \"$LOCAL_APP_CONTAINER\"",
  "deploy verifies packages inside the built local production container"
);
requireText(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "BIOMES_ASSET_PYTHON",
  "deploy verifies BIOMES_ASSET_PYTHON inside container"
);
requireText(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "test -x \"$PY\"",
  "deploy fails if packaged asset Python is missing or not executable"
);
for (const mod of ["docopt", "numpy", "PIL", "pygltflib", "jsonschema", "stringcase", "voxeloo"]) {
  requireText(
    "deploy-production-local-redis-smoke-v1.sh",
    deploy,
    `\"${mod}\"`,
    `deploy verifies Python import ${mod} in the built container`
  );
}
requireText(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "py/assets/build.py -h",
  "deploy verifies Galois build.py imports successfully inside container"
);
requireText(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "--assetServerMode lazy",
  "deploy verifies documented web process uses lazy asset server"
);
requireText(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "test-glitch-prod-player-mesh-endpoint-v174.cjs",
  "deploy still curls real generated player mesh endpoint before push"
);
requireOrder(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "verify_galois_runtime_in_container_v175",
  "test-glitch-container.cjs",
  "in-container Galois runtime verifier runs before general container smoke"
);
requireOrder(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "test-glitch-prod-player-mesh-endpoint-v174.cjs",
  "push_and_deploy",
  "generated player mesh endpoint smoke is defined before push/deploy function"
);
requireText(
  "deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "test-glitch-prod-galois-runtime-packaging-v175.cjs",
  "deploy source guardrails include v175 in-container verifier test"
);

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
