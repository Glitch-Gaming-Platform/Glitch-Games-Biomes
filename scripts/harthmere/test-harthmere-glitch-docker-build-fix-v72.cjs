#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK ${message}`);
}

const dockerfile = read("Dockerfile.glitch");
const dockerignore = read("Dockerfile.glitch.dockerignore");
const buildScript = exists("scripts/glitch/docker-build-glitch.sh")
  ? read("scripts/glitch/docker-build-glitch.sh")
  : "";

ok(dockerfile.includes("public.ecr.aws/docker/library/node:20-bookworm-slim"), "keeps requested Node 20 Bookworm slim base image");
ok(dockerfile.includes("openssh-client"), "installs openssh-client for git ssh dependency compatibility");
ok(dockerfile.includes("GLITCH_DOCKER_GIT_HTTPS_REWRITE_V72"), "adds v72 GitHub SSH-to-HTTPS rewrite marker");
ok(dockerfile.includes('insteadOf "ssh://git@github.com/"'), "rewrites ssh://git@github.com dependencies to HTTPS");
ok(dockerfile.includes('insteadOf "git@github.com:"'), "rewrites git@github.com shorthand dependencies to HTTPS");
ok(exists("Dockerfile.glitch.dockerignore"), "adds Dockerfile.glitch.dockerignore");
ok(dockerignore.includes("GLITCH_DOCKER_CONTEXT_TRIM_V72"), "dockerignore has v72 context trim marker");
ok(dockerignore.includes(".git/**"), "dockerignore excludes .git history");
ok(dockerignore.includes("node_modules/**"), "dockerignore excludes local node_modules");
ok(dockerignore.includes(".harthmere-backups/**"), "dockerignore excludes Harthmere backups");
ok(dockerignore.includes("*.zip"), "dockerignore excludes archive bundles");
ok(dockerignore.includes(".env.*") && dockerignore.includes("!.env.glitch.example"), "dockerignore excludes env secrets but keeps example env");
ok(exists("scripts/glitch/audit-glitch-docker-context-v72.sh"), "adds Docker context audit helper");
ok(buildScript.includes("DOCKER_BUILDKIT") || buildScript.length === 0, "docker build script enables BuildKit when present");

if (process.exitCode) process.exit(process.exitCode);
