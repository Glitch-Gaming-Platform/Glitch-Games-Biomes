#!/usr/bin/env node
const { spawnSync } = require("child_process");
const result = spawnSync("node", ["scripts/glitch/assert-glitch-build-artifacts-current.cjs"], {
  cwd: process.argv[2] || ".",
  stdio: "inherit",
});
process.exit(result.status || 0);
