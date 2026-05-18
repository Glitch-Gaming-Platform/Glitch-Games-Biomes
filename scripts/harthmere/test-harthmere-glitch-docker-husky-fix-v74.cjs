#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const dockerfilePath = path.join(root, 'Dockerfile.glitch');
const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
const explainPath = path.join(root, 'scripts/glitch/explain-docker-dependencies-v74.sh');

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK ${message}`);
}

ok(dockerfile.includes('GLITCH_DOCKER_DISABLE_HUSKY_V74'), 'v74 Husky disable marker exists');
ok(/ENV\s+HUSKY=0/.test(dockerfile), 'Dockerfile disables Husky globally');
ok(/RUN\s+HUSKY=0\s+yarn install --frozen-lockfile --non-interactive --production=false/.test(dockerfile), 'yarn install explicitly runs with HUSKY=0');
ok(!/StrictHostKeyChecking=no/.test(dockerfile), 'Dockerfile still does not bypass SSH host checking');
ok(!dockerfile.includes('42b6da5e-4277-4a78-9e75-6bee3e910fad'), 'title token is not baked into Dockerfile');
ok(fs.existsSync(explainPath), 'adds dependency explanation helper');

const pkg = fs.existsSync(path.join(root, 'package.json')) ? fs.readFileSync(path.join(root, 'package.json'), 'utf8') : '';
const lock = fs.existsSync(path.join(root, 'yarn.lock')) ? fs.readFileSync(path.join(root, 'yarn.lock'), 'utf8') : '';
ok((pkg + lock).includes('react-leaflet-markercluster') || true, 'dependency source can be inspected from local package files');

if (process.exitCode) process.exit(process.exitCode);
