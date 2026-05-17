#!/usr/bin/env node
/* eslint-disable no-console */
const childProcess = require("child_process");
const path = require("path");

const root = process.argv[2] || process.cwd();
const testPath = path.join(root, "scripts/harthmere/test-harthmere-typescript-scope-final-v21.cjs");

const result = childProcess.spawnSync("node", [testPath, root], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

process.exit(result.status || 0);
