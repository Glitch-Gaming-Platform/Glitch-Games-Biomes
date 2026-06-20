#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const root = path.resolve(process.argv[2] || ".");
const script = path.join(root, "scripts/glitch/assert-glitch-build-artifacts-current.cjs");
const result = spawnSync(process.execPath, [script, root], { stdio: "inherit" });
process.exit(result.status || 0);
