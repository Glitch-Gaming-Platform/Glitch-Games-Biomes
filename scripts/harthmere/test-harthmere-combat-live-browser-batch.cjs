#!/usr/bin/env node
"use strict";

// Serial, non-fail-fast rendered combat acceptance. Each scenario has an
// isolated actor/fixture lifecycle but shares one exact-current app, Anima, and
// external Redis world. A failed child is recorded and the remaining scenarios
// still run so fixes can be grouped into one source batch.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "../..");
const runId = `${Date.now()}-${process.pid}`;
const artifactsDir = path.resolve(
  process.env.HARTHMERE_COMBAT_BATCH_ARTIFACTS_DIR ||
    path.join(root, "artifacts/harthmere-combat-live-browser-batch", runId)
);
fs.mkdirSync(artifactsDir, { recursive: true });

const baseUrl = String(
  process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3417"
).replace(/\/$/, "");
const syncBaseUrl = String(
  process.env.HARTHMERE_E2E_SYNC_BASE_URL || "http://127.0.0.1:5307"
).replace(/\/$/, "");
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
if (!controlToken) {
  throw new Error("HARTHMERE_E2E_CONTROL_TOKEN is required");
}

const common = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=3072",
  HARTHMERE_E2E_BASE_URL: baseUrl,
  HARTHMERE_E2E_SYNC_BASE_URL: syncBaseUrl,
  HARTHMERE_E2E_REDIS_PORT: process.env.HARTHMERE_E2E_REDIS_PORT || "6493",
  HARTHMERE_E2E_STACK_CONTAINER:
    process.env.HARTHMERE_E2E_STACK_CONTAINER ||
    "harthmere-final-minigames-app",
  HARTHMERE_E2E_BUILD_ID:
    process.env.HARTHMERE_E2E_BUILD_ID || "combat-deliberate-20260802-r1",
  HARTHMERE_E2E_TIMEOUT_MS: process.env.HARTHMERE_E2E_TIMEOUT_MS || "180000",
  STRICT_RENDER: "1",
  HEADLESS: process.env.HEADLESS || "1",
};

const scenarios = [
  {
    id: "giant-hill-combat",
    script: "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs",
    env: {
      HARTHMERE_E2E_URL: `${baseUrl}/at`,
      HARTHMERE_E2E_HILL_COMBAT_ONLY: "1",
      HARTHMERE_E2E_HILL_COMBAT_TIMEOUT_MS: "90000",
    },
  },
  {
    id: "ordinary-chase-melee",
    script: "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs",
    env: {
      HARTHMERE_E2E_URL: `${baseUrl}/at`,
      HARTHMERE_E2E_CHASE_ONLY: "1",
    },
  },
  {
    id: "anima-escort",
    script: "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs",
    env: {
      HARTHMERE_E2E_URL: `${baseUrl}/at`,
      HARTHMERE_E2E_ESCORT_ONLY: "1",
    },
  },
  {
    id: "indisworm",
    script: "scripts/harthmere/test-harthmere-indisworm-live-browser.cjs",
    env: {
      HARTHMERE_E2E_URL: `${baseUrl}/at?syncBaseUrl=${encodeURIComponent(
        syncBaseUrl
      )}&glitch_auto_play=1`,
      HARTHMERE_E2E_ARTIFACTS_DIR: path.join(artifactsDir, "indisworm"),
      HARTHMERE_E2E_HEADLESS: process.env.HEADLESS === "0" ? "0" : "1",
    },
  },
];

const results = [];
for (const scenario of scenarios) {
  const startedAt = new Date().toISOString();
  console.log(`BATCH START ${scenario.id}`);
  const result = spawnSync(process.execPath, [scenario.script], {
    cwd: root,
    env: { ...common, ...scenario.env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdoutPath = path.join(artifactsDir, `${scenario.id}.stdout.log`);
  const stderrPath = path.join(artifactsDir, `${scenario.id}.stderr.log`);
  fs.writeFileSync(stdoutPath, result.stdout || "");
  fs.writeFileSync(stderrPath, result.stderr || "");
  const row = {
    id: scenario.id,
    status: result.status === 0 ? "pass" : "fail",
    exitCode: result.status,
    signal: result.signal,
    startedAt,
    finishedAt: new Date().toISOString(),
    stdoutPath,
    stderrPath,
  };
  results.push(row);
  console.log(`BATCH ${row.status.toUpperCase()} ${scenario.id}`);
}

const report = {
  version: "harthmere-combat-live-browser-batch-v1",
  runId,
  baseUrl,
  syncBaseUrl,
  buildId: common.HARTHMERE_E2E_BUILD_ID,
  finishedAt: new Date().toISOString(),
  status: results.every(({ status }) => status === "pass") ? "pass" : "fail",
  results,
};
const reportPath = path.join(artifactsDir, "report.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`COMBAT BATCH REPORT ${reportPath}`);
if (report.status !== "pass") {
  process.exitCode = 1;
}
