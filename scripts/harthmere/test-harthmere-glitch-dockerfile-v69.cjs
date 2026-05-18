#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    failed = true;
  }
}

const dockerfile = read("Dockerfile.glitch");
const runScript = read("scripts/glitch/run-glitch-web.sh");
const prepareScript = read("scripts/glitch/prepare-glitch-image.sh");
const envExample = read(".env.glitch.example");
const leakedToken = "42b6da5e-4277-4a78-9e75-6bee3e910fad";

ok(exists("Dockerfile.glitch"), "Dockerfile.glitch exists");
ok(
  dockerfile.includes("FROM public.ecr.aws/docker/library/node:20-bookworm-slim"),
  "Dockerfile uses the requested Node 20 Bookworm slim base image"
);
ok(dockerfile.includes("GLITCH_TITLE_ID=42de534c-600f-4228-af9e-b69faef94cce"), "Dockerfile sets the Harthmere Glitch title id");
ok(!dockerfile.includes(leakedToken), "Dockerfile does not bake the title token secret");
ok(!runScript.includes(leakedToken), "runtime script does not bake the title token secret");
ok(!prepareScript.includes(leakedToken), "image preparation script does not bake the title token secret");
ok(!envExample.includes(leakedToken), ".env.glitch.example does not bake the title token secret");
ok(dockerfile.includes("HEALTHCHECK"), "Dockerfile has a healthcheck");
ok(runScript.includes("redis-server --daemonize yes"), "runtime starts single-container Redis");
ok(runScript.includes("./b data-snapshot ensure-redis-populated"), "runtime populates Redis from installed snapshot");
ok(runScript.includes("./b run"), "runtime starts the Biomes web service through ./b run");
ok(runScript.includes("--no-watch-ts-deps"), "runtime does not start Bazel watch mode");
ok(prepareScript.includes("./b ts-deps build"), "image build generates TypeScript dependencies");
ok(prepareScript.includes("create_local_fake_snapshot"), "image build creates the local Harthmere snapshot");
ok(exists("scripts/glitch/docker-build-glitch.sh"), "local Docker build helper exists");

process.exit(failed ? 1 : 0);
