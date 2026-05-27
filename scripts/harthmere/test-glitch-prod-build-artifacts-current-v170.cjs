#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const root = process.argv[2] || process.cwd();
const res = spawnSync(process.execPath, ['scripts/glitch/assert-glitch-build-artifacts-current.cjs', root], { cwd: root, stdio: 'inherit' });
process.exit(res.status ?? 1);
