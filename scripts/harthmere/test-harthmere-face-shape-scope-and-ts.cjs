#!/usr/bin/env node
/* eslint-disable no-console */
// Compatibility wrapper.
// current originally forced one specific expression:
//   harthmereRuntimeFaceShapeMetrics(appearance.face)
// That became stale after the correct current fix: use `face` where face is scoped,
// use `appearance.face` only where appearance is scoped, and never reference
// either out of scope.
//
// The authoritative scope test is current.

const childProcess = require("child_process");
const path = require("path");

const root = process.argv[2] || process.cwd();
const testPath = path.join(root, "scripts/harthmere/test-harthmere-typescript-scope-final.cjs");

const result = childProcess.spawnSync("node", [testPath, root], {
  cwd: root,
  stdio: "inherit",
  encoding: "utf8",
});

process.exit(result.status || 0);
