#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.argv[2] || process.cwd();

function ok(msg) {
  console.log(`OK ${msg}`);
}

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}

function exists(p) {
  return fs.existsSync(path.join(root, p));
}

if (!exists("requirements.txt")) {
  fail("requirements.txt exists");
  process.exit(process.exitCode || 1);
}

const requirements = fs.readFileSync(path.join(root, "requirements.txt"), "utf8");
if (/^pygltflib==1\.14\.6/m.test(requirements)) {
  ok("requirements.txt pins pygltflib==1.14.6");
} else {
  fail("requirements.txt pins pygltflib==1.14.6");
}

const candidates = [];
if (process.env.PYTHON) candidates.push(process.env.PYTHON);
candidates.push(path.join(root, ".venv/bin/python"));
candidates.push(path.join(root, "venv/bin/python"));
candidates.push("python3");
candidates.push("python");

let python = null;
for (const candidate of candidates) {
  const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
  if (result.status === 0) {
    python = candidate;
    break;
  }
}

if (!python) {
  fail("Python executable available");
  process.exit(process.exitCode || 1);
}

ok(`Python executable available: ${python}`);

const importResult = spawnSync(
  python,
  ["-c", "import pygltflib; print(getattr(pygltflib, '__version__', 'unknown'))"],
  { encoding: "utf8", cwd: root }
);

if (importResult.status === 0) {
  ok(`pygltflib imports (${importResult.stdout.trim() || "version unknown"})`);
} else {
  fail(`pygltflib imports: ${(importResult.stderr || importResult.stdout).trim()}`);
}

const env = {
  ...process.env,
  PYTHONPATH: `${path.join(root, "src/galois/py/assets")}${process.env.PYTHONPATH ? `:${process.env.PYTHONPATH}` : ""}`,
};

const materializerResult = spawnSync(
  python,
  ["-c", "import impl.materializers; print('materializers ok')"],
  { encoding: "utf8", cwd: root, env }
);

if (materializerResult.status === 0) {
  ok("impl.materializers imports");
} else {
  fail(`impl.materializers imports: ${(materializerResult.stderr || materializerResult.stdout).trim()}`);
}

if (process.exitCode) {
  console.log("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
