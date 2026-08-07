#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../..");
const baseUrl = (process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3017").replace(/\/$/, "");
const syncBaseUrl = (process.env.HARTHMERE_E2E_SYNC_BASE_URL || "http://127.0.0.1:4907").replace(/\/$/, "");
const token = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const artifactsDir = path.resolve(
  process.env.HARTHMERE_E2E_ARTIFACTS_DIR ||
    path.join(root, "artifacts/grove-all51-visual-state-sweep")
);
const concurrency = Math.max(1, Number(process.env.HARTHMERE_VISUAL_SWEEP_CONCURRENCY || 2));
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(root, "artifacts/grove-quest-audit-manifest-2026-08-07.json"),
    "utf8"
  )
);
const hotfixPath = path.join(
  root,
  "scripts/harthmere/grove-quest-client-hotfix-2026-08-07.js"
);
const runId = `${Date.now()}-${process.pid}`;
const requestedQuestIds = new Set(
  (process.env.HARTHMERE_VISUAL_SWEEP_QUEST_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const questIds = manifest.questIds.filter(
  (questId) => requestedQuestIds.size === 0 || requestedQuestIds.has(questId)
);

function chunks(values, count) {
  return Array.from({ length: count }, (_, worker) =>
    values.filter((_, index) => index % count === worker)
  );
}

async function openWorker(browser, index) {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
  await context.addInitScript({ path: hotfixPath });
  await context.addInitScript(() => {
    localStorage.setItem("settings.hud.keepOverlaysVisible", "true");
    sessionStorage.setItem("biomes.harthmere.partialTerrainRecoveryReloaded", "1");
    sessionStorage.setItem("biomes.world.missingShardRecoveryReloadedAt", String(Date.now()));
  });
  const authUrl = new URL("/api/harthmere/visual_test_auth", baseUrl);
  authUrl.searchParams.set("usernameOrId", `GroveVisualSweep-${runId}-${index}`);
  authUrl.searchParams.set("e2eAdmin", "1");
  const response = await context.request.get(authUrl.toString(), {
    headers: { "x-harthmere-e2e-token": token },
    timeout: 120_000,
  });
  assert(response.ok(), `worker ${index} auth HTTP ${response.status()}`);
  const auth = await response.json();
  const cookies = await context.cookies(baseUrl);
  const sessionId = cookies.find((cookie) => cookie.name === "BSID")?.value;
  assert(sessionId, `worker ${index} missing BSID`);
  await context.addInitScript(
    ({ userId, sessionId }) => {
      const value = JSON.stringify({ userId: String(userId), sessionId, createdAtMs: Date.now() });
      localStorage.setItem("harthmere.biomesAuth", value);
      sessionStorage.setItem("harthmere.biomesAuth", value);
    },
    { userId: auth.userId, sessionId }
  );
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  const url = new URL("/at", baseUrl);
  url.searchParams.set("syncBaseUrl", syncBaseUrl);
  url.searchParams.set("glitch_auto_play", "1");
  url.searchParams.set("harthmere_native_ecs_e2e", "1");
  url.searchParams.set("e2e_run", runId);
  url.searchParams.set("forceDrawDistance", "48");
  url.searchParams.set("forceRenderScale", "0.5");
  url.searchParams.set("forceGraphicsQuality", "low");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(
    () => Boolean(window.clientContext && window.__snapshotGrove && window.__harthmereLivePlayerDebug?.teleportTo),
    undefined,
    { timeout: 120_000 }
  );
  const enter = page.getByRole("button", { name: "Enter Game", exact: true });
  if (await enter.isVisible().catch(() => false)) {
    await enter.click({ timeout: 10_000 }).catch(() => undefined);
  }
  return { context, page };
}

async function setVisualState(page, row, phase) {
  return page.evaluate(
    ({ row, phase }) => {
      const runtime = window.__snapshotGrove;
      const quest = runtime.quests.find((candidate) => candidate.id === row.questId);
      const marker = runtime.landmarks.find((candidate) => candidate.id === row.markerId);
      if (!quest || !marker) throw new Error(`missing runtime ${row.questId}/${row.markerId}`);
      const final = row.objectiveIndex === quest.objectives.length - 1;
      const nextIndex = phase === "completed" ? row.objectiveIndex + 1 : row.objectiveIndex;
      const state = {
        acceptedQuestIds: [row.questId],
        activeQuestId: phase === "completed" && final ? undefined : row.questId,
        activeObjectiveIndex: Math.min(nextIndex, quest.objectives.length - 1),
        objectiveIndexByQuestId:
          phase === "completed" && final
            ? {}
            : { [row.questId]: Math.min(nextIndex, quest.objectives.length - 1) },
        objectiveProgressByQuestId: {},
        completedQuestIds: phase === "completed" && final ? [row.questId] : [],
        completedObjectiveIds: quest.objectives
          .slice(0, phase === "completed" ? row.objectiveIndex + 1 : row.objectiveIndex)
          .map((_, index) => `${row.questId}:${index}:${quest.triggers[index]}`),
        rewards: [],
        updatedAt: Date.now(),
      };
      localStorage.setItem("biomes.localDev.snapshotGroveQuestState", JSON.stringify(state));
      const position = [...(marker.worldPosition ?? marker.position)].map(Number);
      const pin = {
        markerId: marker.id,
        label: marker.label,
        kind: marker.kind ?? "objective",
        worldPosition: position,
        ownerQuestId: row.questId,
        ownerStepId: `${row.questId}:${row.objectiveIndex}`,
        setAtMs: Date.now(),
      };
      localStorage.setItem("biomes_ui_active_map_pin", JSON.stringify(pin));
      window.dispatchEvent(new CustomEvent("biomes:local-dev-snapshot-grove-quest-state"));
      window.dispatchEvent(new CustomEvent("biomes-ui-active-map-pin", { detail: pin }));
      const approach = [position[0] + 4.5, position[1], position[2] + 4.5];
      const result = window.__harthmereLivePlayerDebug.teleportTo({
        x: approach[0],
        y: approach[1],
        z: approach[2],
        reason: "Grove visual state sweep",
        source: "sweep-grove-quest-visual-states",
      });
      const actual = Array.isArray(result?.after) ? result.after : approach;
      const yaw = Math.atan2(-(position[0] - actual[0]), -(position[2] - actual[2]));
      const orientation = [-0.12, yaw];
      const resources = window.clientContext.resources;
      resources.update("/scene/local_player", (localPlayer) => {
        localPlayer.player.position = [...actual];
        localPlayer.player.orientation = [...orientation];
      });
      resources.update("/sim/player", window.clientContext.userId, (player) => {
        player.position = [...actual];
        player.orientation = [...orientation];
        player.velocity = [0, 0, 0];
      });
      return { markerId: marker.id, position, actual };
    },
    { row, phase }
  );
}

async function captureRow(page, row) {
  for (const phase of ["current", "completed"]) {
    await setVisualState(page, row, phase);
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(
        artifactsDir,
        `${runId}-${row.questId}-objective-${String(row.objectiveIndex + 1).padStart(2, "0")}-${phase}.png`
      ),
    });
  }
}

async function worker(browser, questIds, index, failures) {
  const session = await openWorker(browser, index);
  try {
    for (const questId of questIds) {
      const rows = manifest.rows.filter((row) => row.questId === questId);
      for (const row of rows) {
        try {
          await captureRow(session.page, row);
        } catch (error) {
          failures.push({ questId, objectiveIndex: row.objectiveIndex, error: error?.stack || String(error) });
        }
      }
      console.log(`VISUAL ${questId} ${rows.length} objectives`);
    }
  } finally {
    await session.context.close().catch(() => undefined);
  }
}

async function main() {
  assert(token, "HARTHMERE_E2E_CONTROL_TOKEN is required");
  fs.mkdirSync(artifactsDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-webgl",
      "--autoplay-policy=no-user-gesture-required",
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const failures = [];
  try {
    const groups = chunks(questIds, concurrency);
    const results = await Promise.allSettled(
      groups.map((group, index) => worker(browser, group, index + 1, failures))
    );
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") {
        for (const questId of groups[index]) {
          failures.push({
            questId,
            objectiveIndex: -1,
            error: result.reason?.stack || String(result.reason),
          });
        }
      }
    }
  } finally {
    await browser.close();
  }
  const completedQuestIds = questIds.filter(
    (questId) => !failures.some((failure) => failure.questId === questId)
  );
  const report = {
    version: "grove-quest-visual-state-sweep-v1",
    runId,
    candidate: {
      buildId: process.env.HARTHMERE_E2E_BUILD_ID,
      hotfixPath: path.relative(root, hotfixPath),
    },
    scenarios: completedQuestIds.map((questId) => ({
      name: `${questId}: visual state sweep`,
      status: "pass",
      verdict: "visual_state_pass",
      questId,
    })),
    failures,
    status: failures.length ? "fail" : "pass",
  };
  const reportPath = path.join(artifactsDir, `${runId}-report.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`REPORT ${reportPath}`);
  console.log(`${completedQuestIds.length}/${questIds.length} selected quest visual states captured`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
