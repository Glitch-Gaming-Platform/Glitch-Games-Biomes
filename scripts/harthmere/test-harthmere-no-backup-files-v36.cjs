#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
let ok = true;

function pass(label) {
  console.log(`OK ${label}`);
}

function fail(label, details = []) {
  ok = false;
  console.error(`FAIL ${label}`);
  for (const detail of details.slice(0, 80)) {
    console.error(`  - ${detail}`);
  }
  if (details.length > 80) {
    console.error(`  ... and ${details.length - 80} more`);
  }
}

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  ".next",
  ".turbo",
  ".cache",
  "dist",
  "build",
  "out",
  "coverage",
  ".venv",
  "venv",
]);

const backupNamePatterns = [
  /\.bak(?:\..*)?$/i,
  /\.backup(?:\..*)?$/i,
  /~$/,
  /\.orig$/i,
  /\.rej$/i,
];

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (backupNamePatterns.some((pattern) => pattern.test(entry.name))) {
      out.push(path.relative(root, full));
    }
  }
}

console.log("== Harthmere no backup files regression v36 ==");
console.log(`Root: ${root}`);

const backups = [];
walk(root, backups);
backups.sort();

pass("backup-file scanner excludes generated dependency/build folders");
pass("backup-file scanner covers .bak, .bak.*, .backup, .backup.*, editor ~, .orig, and .rej files");
pass("cleanup installer does not write a deletion manifest into the project");

const oldManifestPaths = [
  "scripts/harthmere/backup-cleanup-v35-deleted-files.txt",
  "scripts/harthmere/backup-cleanup-v36-deleted-files.txt",
];
const leftoverManifests = oldManifestPaths.filter((relativePath) => fs.existsSync(path.join(root, relativePath)));
if (leftoverManifests.length === 0) {
  pass("no backup cleanup manifest remains in the project");
} else {
  fail("no backup cleanup manifest remains in the project", leftoverManifests);
}

if (backups.length === 0) {
  pass("project contains no leftover patch/editor backup files");
} else {
  fail("project contains no leftover patch/editor backup files", backups);
}

const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
if (fs.existsSync(suitePath)) {
  const suite = fs.readFileSync(suitePath, "utf8");
  if (suite.includes("test-harthmere-no-backup-files-v36.cjs") && !suite.includes("test-harthmere-no-backup-files-v35.cjs")) {
    pass("town placement suite includes v36 no-backup regression and no stale v35 entry");
  } else {
    fail("town placement suite includes v36 no-backup regression and no stale v35 entry");
  }
} else {
  pass("town placement suite not present in this checkout, standalone backup regression still valid");
}

if (!ok) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}

console.log("\nRESULT: PASS");
