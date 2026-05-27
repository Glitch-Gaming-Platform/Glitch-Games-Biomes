#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
const dockerfilePath = path.join(root, "Dockerfile.biomes");
const deployPath = path.join(root, "scripts/glitch/deploy-production-local-redis-smoke-v1.sh");
const dockerfile = fs.readFileSync(dockerfilePath, "utf8");
const deploy = fs.readFileSync(deployPath, "utf8");
let failures = 0;

function ok(message) {
  console.log(`OK    ${message}`);
}
function fail(message, detail = "") {
  failures += 1;
  console.error(`FAIL  ${message}`);
  if (detail) console.error(`      ${detail}`);
}
function fileExists(rel, message) {
  if (fs.existsSync(path.join(root, rel))) ok(message);
  else fail(message, `missing ${rel}`);
}
function requireText(name, text, needle, message) {
  if (text.includes(needle)) ok(message);
  else fail(message, `${name} missing: ${needle}`);
}
function requireRegex(name, text, regex, message) {
  if (regex.test(text)) ok(message);
  else fail(message, `${name} did not match: ${regex}`);
}
function requireOrder(name, text, first, second, message) {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  if (a >= 0 && b >= 0 && a < b) ok(message);
  else fail(message, `${name} expected ${JSON.stringify(first)} before ${JSON.stringify(second)}; positions ${a}, ${b}`);
}

fileExists("BUILD.bazel", "root BUILD.bazel exists for Bazel package // and //:requirements.txt");
fileExists("WORKSPACE.bazel", "WORKSPACE.bazel exists");
fileExists("requirements.txt", "requirements.txt exists");
fileExists("Cargo.lock", "Cargo.lock exists for rules_rust crate_universe");
fileExists("Cargo.Bazel.lock", "Cargo.Bazel.lock exists for rules_rust crate_universe lockfile");
fileExists("src/bazel_utils/cpp/BUILD.bazel", "src/bazel_utils/cpp Bazel package exists for voxeloo generators");
fileExists("voxeloo/setup.py", "voxeloo/setup.py exists");
fileExists("voxeloo/py_ext/BUILD.bazel", "voxeloo/py_ext/BUILD.bazel exists");

requireRegex(
  "Dockerfile.biomes",
  dockerfile,
  /COPY --chown=nextjs:nodejs[^\n]*requirements\.txt[^\n]*WORKSPACE\.bazel[^\n]*BUILD\.bazel[^\n]*Cargo\.lock[^\n]*Cargo\.Bazel\.lock[^\n]*\.bazelrc[^\n]*\.bazelversion[^\n]*\.\//,
  "Dockerfile copies root BUILD.bazel and Rust lockfiles with requirements/workspace files"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "COPY --chown=nextjs:nodejs src/bazel_utils/ src/bazel_utils/",
  "Dockerfile copies src/bazel_utils needed by voxeloo Bazel targets"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "COPY --chown=nextjs:nodejs voxeloo/ voxeloo/",
  "Dockerfile copies voxeloo source"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "/app/Cargo.lock",
  "Dockerfile chowns Rust lockfiles for non-root Bazel build"
);
requireOrder(
  "Dockerfile.biomes",
  dockerfile,
  "COPY --chown=nextjs:nodejs requirements.txt WORKSPACE.bazel BUILD.bazel Cargo.lock Cargo.Bazel.lock .bazelrc .bazelversion ./",
  "pip install --no-cache-dir --no-build-isolation ./voxeloo",
  "Complete Bazel workspace and Rust lockfiles are copied before pip install ./voxeloo"
);
requireOrder(
  "Dockerfile.biomes",
  dockerfile,
  "USER nextjs",
  "pip install --no-cache-dir --no-build-isolation ./voxeloo",
  "pip install ./voxeloo still runs as nextjs, not root"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "import docopt, numpy, PIL, pygltflib, jsonschema, stringcase, voxeloo",
  "Dockerfile verifies Galois Python deps and voxeloo import at image build time"
);
requireText(
  "scripts/glitch/deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "test-glitch-prod-galois-runtime-packaging-v177.cjs",
  "deploy source guardrails include root BUILD.bazel packaging test"
);
requireText(
  "scripts/glitch/deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "verify_galois_runtime_in_container_v175",
  "deploy still verifies Python/voxeloo imports inside built container before push"
);
requireText(
  "scripts/glitch/deploy-production-local-redis-smoke-v1.sh",
  deploy,
  "test-glitch-prod-player-mesh-endpoint-v174.cjs",
  "deploy still curls real generated player mesh endpoint before push"
);

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
