#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const dockerfile = path.join(root, 'Dockerfile.glitch');
const text = fs.readFileSync(dockerfile, 'utf8');

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

ok(text.includes('GLITCH_DOCKER_YARN_SSH_URL_FIX_V73'), 'v73 yarn SSH URL fix marker exists');
ok(text.includes('s#ssh://git@github.com/#https://github.com/#g'), 'Dockerfile rewrites ssh://git@github.com dependencies to HTTPS');
ok(text.includes('s#git@github.com:#https://github.com/#g'), 'Dockerfile rewrites git@github.com: dependencies to HTTPS');
ok(text.includes('git config --system url."https://github.com/".insteadOf "ssh://git@github.com/"'), 'system-level git insteadOf rewrite is configured');
ok(/RUN yarn install --frozen-lockfile --non-interactive --production=false/.test(text), 'yarn frozen install still runs after rewrite');
ok(!/StrictHostKeyChecking=no/.test(text), 'build does not hide the problem by disabling SSH host checking');

if (process.exitCode) process.exit(process.exitCode);
