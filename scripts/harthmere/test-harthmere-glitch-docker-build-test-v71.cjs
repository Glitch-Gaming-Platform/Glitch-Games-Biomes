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
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

const runScript = read("scripts/glitch/docker-test-glitch.sh");
const smokeScript = read("scripts/glitch/test-glitch-container.cjs");
const leakedTokenFragment = "42b6da5e-4277-4a78-9e75-6bee3e910fad";

ok(exists("scripts/glitch/docker-test-glitch.sh"), "Docker build/run smoke test helper exists");
ok(exists("scripts/glitch/test-glitch-container.cjs"), "Glitch container API smoke test exists");
ok(runScript.includes("Dockerfile.glitch"), "Docker smoke helper builds Dockerfile.glitch");
ok(runScript.includes("GLITCH_TEST_INSTALL_ID") && runScript.includes("f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7"), "Docker smoke helper defaults to the provided test install id");
ok(runScript.includes("GLITCH_TITLE_TOKEN is required"), "Docker smoke helper requires token at runtime instead of committing it");
ok(!runScript.includes(leakedTokenFragment), "Docker smoke helper does not contain the title token secret");
ok(!smokeScript.includes(leakedTokenFragment), "container smoke test does not contain the title token secret");
ok(smokeScript.includes('post("claimSession"'), "container smoke test validates and claims a Glitch session");
ok(smokeScript.includes("validated Glitch username is returned"), "container smoke test verifies username identity binding");
ok(smokeScript.includes("validated Glitch user id is returned"), "container smoke test verifies Glitch user id binding");
ok(smokeScript.includes("newer login disconnects older idle session"), "container smoke test verifies older idle session disconnect");
ok(smokeScript.includes('\"storeSave\"'), "container smoke test exercises cloud save write");
ok(smokeScript.includes('\"listSaves\"'), "container smoke test exercises cloud save list");
ok(smokeScript.includes('\"submitProgression\"'), "container smoke test exercises timer/progression submit");
ok(smokeScript.includes('\"leaderboard\"'), "container smoke test exercises leaderboard fetch");
ok(smokeScript.includes('\"playerAchievements\"'), "container smoke test exercises achievements fetch");

process.exit(failed ? 1 : 0);
