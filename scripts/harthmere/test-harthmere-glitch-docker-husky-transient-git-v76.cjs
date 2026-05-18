#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const dockerfilePath = path.join(root, 'Dockerfile.glitch');
const dockerignorePath = path.join(root, 'Dockerfile.glitch.dockerignore');
const explainPath = path.join(root, 'scripts/glitch/explain-husky-docker-v76.sh');

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

const dockerfile = fs.existsSync(dockerfilePath) ? fs.readFileSync(dockerfilePath, 'utf8') : '';
const dockerignore = fs.existsSync(dockerignorePath) ? fs.readFileSync(dockerignorePath, 'utf8') : '';

ok(dockerfile.includes('GLITCH_DOCKER_HUSKY_TRANSIENT_GIT_V76'), 'v76 transient Git marker exists');
ok(/git init -q \/app/.test(dockerfile), 'Dockerfile creates a temporary Git repo before yarn install');
ok(/git config user\.email "docker@glitch\.local"/.test(dockerfile), 'Dockerfile configures temporary Git identity');
ok(/HUSKY=0 yarn install --frozen-lockfile --non-interactive --production=false/.test(dockerfile), 'Dockerfile still runs normal yarn install with Husky env disabled');
ok(/rm -rf \/app\/\.git \/app\/\.husky/.test(dockerfile), 'Dockerfile removes temporary Git and Husky metadata after install');
ok(!/--ignore-scripts/.test(dockerfile), 'Dockerfile does not disable all package scripts globally');
ok(!/StrictHostKeyChecking=no/.test(dockerfile), 'Dockerfile does not bypass SSH host checking');
ok(!/42b6da5e-4277-4a78-9e75-6bee3e910fad/.test(dockerfile), 'title token is not baked into Dockerfile');
ok(/(^|\n)\.husky($|\n)/.test(dockerignore), 'Docker ignore excludes local Husky hook directory');
ok(fs.existsSync(explainPath), 'adds Husky Docker explanation helper');

const yarnInstallMatches = dockerfile.match(/yarn install --frozen-lockfile --non-interactive --production=false/g) || [];
ok(yarnInstallMatches.length === 1, 'Dockerfile has exactly one yarn install command');

if (process.exitCode) process.exit(process.exitCode);
