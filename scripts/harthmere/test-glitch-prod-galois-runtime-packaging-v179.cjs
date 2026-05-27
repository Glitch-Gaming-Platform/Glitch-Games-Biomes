#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
const dockerfilePath = path.join(root, "Dockerfile.biomes");
const workspacePath = path.join(root, "WORKSPACE.bazel");
const dockerfile = fs.readFileSync(dockerfilePath, "utf8");
const workspace = fs.readFileSync(workspacePath, "utf8");
let failures = 0;

function ok(message) { console.log(`OK    ${message}`); }
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

fileExists("WORKSPACE.bazel", "WORKSPACE.bazel exists");
fileExists("BUILD.bazel", "root BUILD.bazel exists so //:requirements.txt is a Bazel package file");
fileExists("requirements.txt", "requirements.txt exists for rules_python pip_parse");
fileExists("Cargo.lock", "Cargo.lock exists for rules_rust crates_repository cargo_lockfile");
fileExists("Cargo.Bazel.lock", "Cargo.Bazel.lock exists for rules_rust crates_repository lockfile");
fileExists("src/bazel_utils/cpp/BUILD.bazel", "src/bazel_utils/cpp exists for //src/bazel_utils/cpp:clang_format");
fileExists("voxeloo/setup.py", "voxeloo/setup.py exists");
fileExists("voxeloo/py_ext/BUILD.bazel", "voxeloo/py_ext/BUILD.bazel exists");

requireText(
  "WORKSPACE.bazel",
  workspace,
  'requirements = "//:requirements.txt"',
  "WORKSPACE uses //:requirements.txt, so root BUILD.bazel must be packaged"
);
requireText(
  "WORKSPACE.bazel",
  workspace,
  'cargo_lockfile = "//:Cargo.lock"',
  "WORKSPACE uses //:Cargo.lock, so Cargo.lock must be packaged"
);
requireText(
  "WORKSPACE.bazel",
  workspace,
  'lockfile = "//:Cargo.Bazel.lock"',
  "WORKSPACE uses //:Cargo.Bazel.lock, so Cargo.Bazel.lock must be packaged"
);

requireRegex(
  "Dockerfile.biomes",
  dockerfile,
  /COPY --chown=nextjs:nodejs[^\n]*requirements\.txt[^\n]*WORKSPACE\.bazel[^\n]*BUILD\.bazel[^\n]*Cargo\.lock[^\n]*Cargo\.Bazel\.lock[^\n]*\.bazelrc[^\n]*\.bazelversion[^\n]*\.\//,
  "Dockerfile copies all root Bazel/Python/Rust lock files before voxeloo install"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "COPY --chown=nextjs:nodejs src/bazel_utils/ src/bazel_utils/",
  "Dockerfile copies src/bazel_utils before voxeloo install"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "COPY --chown=nextjs:nodejs voxeloo/ voxeloo/",
  "Dockerfile copies voxeloo source before voxeloo install"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "/app/Cargo.lock /app/Cargo.Bazel.lock",
  "Dockerfile chowns Cargo lockfiles for non-root Bazel"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "/app/src",
  "Dockerfile chowns early src/bazel_utils copy for non-root Bazel"
);
requireOrder(
  "Dockerfile.biomes",
  dockerfile,
  "COPY --chown=nextjs:nodejs requirements.txt WORKSPACE.bazel BUILD.bazel Cargo.lock Cargo.Bazel.lock .bazelrc .bazelversion ./",
  "pip install --no-cache-dir --no-build-isolation ./voxeloo",
  "complete Bazel workspace files are copied before pip install ./voxeloo"
);
requireOrder(
  "Dockerfile.biomes",
  dockerfile,
  "COPY --chown=nextjs:nodejs src/bazel_utils/ src/bazel_utils/",
  "pip install --no-cache-dir --no-build-isolation ./voxeloo",
  "src/bazel_utils is copied before pip install ./voxeloo"
);
requireOrder(
  "Dockerfile.biomes",
  dockerfile,
  "USER nextjs",
  "pip install --no-cache-dir --no-build-isolation ./voxeloo",
  "voxeloo still builds as non-root nextjs"
);
requireText(
  "Dockerfile.biomes",
  dockerfile,
  "import docopt, numpy, PIL, pygltflib, jsonschema, stringcase, voxeloo",
  "Dockerfile verifies packaged Python and voxeloo import at build time"
);

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
