#!/usr/bin/env node
/* eslint-disable no-console */
// Compatibility wrapper.
// v12 asserted an older source shape where createProceduralTownsperson(placement)
// appeared before prototype lookup. Current code correctly creates a
// proceduralPlacement first so scale/defaultScale survives. v16 is the
// authoritative routing + body/face/clothing test.

const childProcess = require("child_process");
const path = require("path");

const root = process.argv[2] || process.cwd();
const testPath = path.join(root, "scripts/harthmere/test-harthmere-procedural-body-face-clothing-behavior-v16.cjs");

const result = childProcess.spawnSync("node", [testPath, root], {
  cwd: root,
  stdio: "inherit",
  encoding: "utf8",
});

process.exit(result.status || 0);
