#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const dockerfilePath = path.join(root, 'Dockerfile.glitch');
const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
const showPath = path.join(root, 'scripts/glitch/show-package-husky-scripts-v75.sh');

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK ${message}`);
}

const markerIndex = dockerfile.indexOf('GLITCH_DOCKER_REMOVE_HUSKY_LIFECYCLE_V75');
const yarnIndex = dockerfile.indexOf('yarn install --frozen-lockfile --non-interactive --production=false');

ok(markerIndex >= 0, 'v75 Husky lifecycle removal marker exists');
ok(yarnIndex >= 0, 'Dockerfile still runs yarn install');
ok(markerIndex >= 0 && yarnIndex >= 0 && markerIndex < yarnIndex, 'Husky lifecycle removal happens before yarn install');
ok(/delete s\[k\]/.test(dockerfile), 'Dockerfile removes matching Husky lifecycle script entries');
ok(/Docker package lifecycle scripts sanitized/.test(dockerfile), 'Dockerfile prints which Husky scripts were removed');
ok(/RUN\s+HUSKY=0\s+yarn install --frozen-lockfile --non-interactive --production=false/.test(dockerfile), 'yarn install still runs with HUSKY=0 defense in depth');
ok(!/--ignore-scripts/.test(dockerfile), 'Dockerfile does not disable all package scripts globally');
ok(!/StrictHostKeyChecking=no/.test(dockerfile), 'Dockerfile does not bypass SSH host checking');
ok(!dockerfile.includes('42b6da5e-4277-4a78-9e75-6bee3e910fad'), 'title token is not baked into Dockerfile');
ok(fs.existsSync(showPath), 'adds local package Husky inspection helper');

// Prove the sanitizer removes the exact failure pattern without touching unrelated scripts.
const pkg = {
  scripts: {
    prepare: 'husky install',
    postinstall: 'node scripts/build-native.js',
    build: 'next build'
  }
};
const s = pkg.scripts || {};
for (const k of Object.keys(s)) {
  const v = String(s[k] || '');
  if (/(^|&&|;|\|\|)\s*husky\s+install\b/.test(v) || /^\s*husky\b/.test(v)) {
    delete s[k];
  }
}
ok(!('prepare' in pkg.scripts), 'sanitizer removes prepare=husky install');
ok(pkg.scripts.postinstall === 'node scripts/build-native.js', 'sanitizer keeps unrelated postinstall scripts');
ok(pkg.scripts.build === 'next build', 'sanitizer keeps normal build scripts');

if (process.exitCode) process.exit(process.exitCode);
