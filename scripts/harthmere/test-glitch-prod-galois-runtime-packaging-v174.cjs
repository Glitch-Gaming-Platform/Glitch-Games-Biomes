#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
let failures = 0;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function ok(message) {
  console.log(`OK    ${message}`);
}
function fail(message, detail = "") {
  failures += 1;
  console.error(`FAIL  ${message}`);
  if (detail) console.error(`      ${detail}`);
}
function requireFile(rel) {
  if (exists(rel)) ok(`${rel} exists`);
  else fail(`${rel} exists`);
}
function requireText(name, text, needle, message) {
  if (text.includes(needle)) ok(message);
  else fail(message, `${name} missing: ${needle}`);
}
function forbidText(name, text, needle, message) {
  if (!text.includes(needle)) ok(message);
  else fail(message, `${name} still contains: ${needle}`);
}

requireFile("requirements.txt");
requireFile("WORKSPACE.bazel");
requireFile(".bazelrc");
requireFile(".bazelversion");
requireFile("Cargo.lock");
requireFile("Cargo.Bazel.lock");
requireFile("src/bazel_utils/cpp/BUILD.bazel");
requireFile("voxeloo/setup.py");
requireFile("voxeloo/py_ext/BUILD.bazel");
requireFile("src/galois/py/assets/build.py");

const dockerfile = read("Dockerfile.biomes");
requireText("Dockerfile.biomes", dockerfile, "python3-pip", "Dockerfile installs pip for Galois Python deps");
requireText("Dockerfile.biomes", dockerfile, "python3-venv", "Dockerfile installs venv support");
requireText("Dockerfile.biomes", dockerfile, "python3-dev", "Dockerfile installs Python headers for voxeloo/pybind");
requireText("Dockerfile.biomes", dockerfile, "clang", "Dockerfile installs clang required by .bazelrc");
requireText("Dockerfile.biomes", dockerfile, "git", "Dockerfile installs git for Bazel git_repository dependencies");
requireText("Dockerfile.biomes", dockerfile, "bazelisk-linux-amd64", "Dockerfile installs Bazelisk");
requireText("Dockerfile.biomes", dockerfile, "ln -sf /usr/local/bin/bazelisk /usr/local/bin/bazel", "Dockerfile exposes Bazelisk as bazel");
if (/COPY --chown=nextjs:nodejs[^\n]*requirements\.txt[^\n]*WORKSPACE\.bazel[^\n]*BUILD\.bazel[^\n]*Cargo\.lock[^\n]*Cargo\.Bazel\.lock[^\n]*\.bazelrc[^\n]*\.bazelversion[^\n]*\.\//.test(dockerfile)) {
  ok("Dockerfile copies complete Bazel/Python/Rust workspace files");
} else {
  fail("Dockerfile copies complete Bazel/Python/Rust workspace files", "Dockerfile.biomes must copy requirements.txt WORKSPACE.bazel BUILD.bazel Cargo.lock Cargo.Bazel.lock .bazelrc .bazelversion before pip install ./voxeloo");
}
requireText("Dockerfile.biomes", dockerfile, "COPY --chown=nextjs:nodejs src/bazel_utils/ src/bazel_utils/", "Dockerfile copies src/bazel_utils needed by voxeloo Bazel targets");
requireText("Dockerfile.biomes", dockerfile, "COPY --chown=nextjs:nodejs voxeloo/ voxeloo/", "Dockerfile copies voxeloo source");
requireText("Dockerfile.biomes", dockerfile, "python3 -m venv /opt/biomes-python", "Dockerfile creates packaged Python venv");
requireText("Dockerfile.biomes", dockerfile, "pip install --no-cache-dir -r requirements.txt", "Dockerfile installs requirements.txt into packaged venv");
requireText("Dockerfile.biomes", dockerfile, "pip install --no-cache-dir --no-build-isolation ./voxeloo", "Dockerfile installs native voxeloo Python extension");
requireText("Dockerfile.biomes", dockerfile, "BIOMES_ASSET_PYTHON=/opt/biomes-python/bin/python", "Dockerfile points Galois asset builder at packaged Python");
requireText("Dockerfile.biomes", dockerfile, "import docopt, numpy, PIL, pygltflib, jsonschema, stringcase, voxeloo", "Dockerfile verifies Galois imports at image build time");
forbidText("Dockerfile.biomes", dockerfile, "packaged player mesh assets instead of invoking the unavailable local builder", "Dockerfile no longer documents local builder as unavailable");

const serverTs = read("src/galois/js/server/server.ts");
requireText("src/galois/js/server/server.ts", serverTs, "BIOMES_ASSET_PYTHON", "Galois server honors BIOMES_ASSET_PYTHON");
requireText("src/galois/js/server/server.ts", serverTs, "py/assets/build.py", "Galois server launches Python build.py");

const deploy = read("scripts/glitch/deploy-production-local-redis-smoke-v1.sh");
requireText("deploy-production-local-redis-smoke-v1.sh", deploy, "test-glitch-prod-galois-runtime-packaging-v174.cjs", "deploy source checks include Galois runtime packaging test");
requireText("deploy-production-local-redis-smoke-v1.sh", deploy, "test-glitch-prod-player-mesh-endpoint-v174.cjs", "deploy local smoke curls real generated player mesh endpoint before push");

const req = read("requirements.txt");
for (const dep of ["docopt", "numpy", "Pillow", "pygltflib", "stringcase", "jsonschema"]) {
  requireText("requirements.txt", req, dep, `requirements.txt contains ${dep}`);
}

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
