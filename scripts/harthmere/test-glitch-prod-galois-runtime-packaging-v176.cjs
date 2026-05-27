#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
const dockerfile = fs.readFileSync(path.join(root, "Dockerfile.biomes"), "utf8");
const deploy = fs.readFileSync(path.join(root, "scripts/glitch/deploy-production-local-redis-smoke-v1.sh"), "utf8");
let failures = 0;

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

requireText(
  "Dockerfile.biomes",
  dockerfile,
  "voxeloo's Bazel/rules_python build refuses to run as root",
  "Dockerfile documents why voxeloo must build as non-root"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "chown -R nextjs:nodejs /opt/biomes-python",
  "Dockerfile hands packaged Python venv to nextjs before pip installs"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "ENV HOME=/home/nextjs",
  "Dockerfile sets non-root HOME for Bazel/rules_python"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "ENV BAZELISK_HOME=/home/nextjs/.cache/bazelisk",
  "Dockerfile gives Bazelisk a non-root cache"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "ENV TEST_TMPDIR=/home/nextjs/.cache/bazel-tmp",
  "Dockerfile gives Bazel a non-root temp/cache location"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "USER nextjs",
  "Dockerfile switches to nextjs before building voxeloo"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "USER root",
  "Dockerfile switches back to root before later image assembly steps"
);
requireOrder(
  "Dockerfile.biomes",
  dockerfile,
  "USER nextjs",
  "pip install --no-cache-dir --no-build-isolation ./voxeloo",
  "voxeloo pip build runs after USER nextjs, not as root"
);
requireOrder(
  "Dockerfile.biomes",
  dockerfile,
  "pip install --no-cache-dir --no-build-isolation ./voxeloo",
  "USER root",
  "Dockerfile switches back to root only after voxeloo is installed"
);
requireOrder(
  "Dockerfile.biomes",
  dockerfile,
  "import docopt, numpy, PIL, pygltflib, jsonschema, stringcase, voxeloo",
  "USER root",
  "voxeloo import verification happens before returning to root"
);
requireText(
  "scripts/glitch/deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "test-glitch-prod-galois-runtime-packaging-v176.cjs",
  "deploy source guardrails include v176 non-root voxeloo build test"
);

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
