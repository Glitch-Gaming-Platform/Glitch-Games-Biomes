#!/usr/bin/env node
// HARTHMERE_PROD_LOCAL_ASSET_PARITY_V169
// Focused guard for build-artifact policy. Delegates to deploy validator.
const { spawnSync } = require('child_process');
const path = require('path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const res = spawnSync(process.execPath, [path.join(root, 'scripts/glitch/assert-glitch-build-artifacts-current.cjs'), root], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
});
process.exit(res.status ?? 1);
