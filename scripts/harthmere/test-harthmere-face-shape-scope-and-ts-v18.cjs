#!/usr/bin/env node
/* eslint-disable no-console */
// Compatibility wrapper.
// v18 originally forced one specific expression:
//   harthmereRuntimeFaceShapeMetricsV15(appearance.face)
// That became stale after the correct v21 fix: use `face` where face is scoped,
// use `appearance.face` only where appearance is scoped, and never reference
// either out of scope.
//
// The authoritative scope test is v21.

const childProcess = require("child_process");
const path = require("path");

const root = process.argv[2] || process.cwd();
const testPath = path.join(root, "scripts/harthmere/test-harthmere-typescript-scope-final-v21.cjs");

const result = childProcess.spawnSync("node", [testPath, root], {
  cwd: root,
  stdio: "inherit",
  encoding: "utf8",
});

process.exit(result.status || 0);
