/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import { build } from "esbuild";
import { existsSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import {
  HarthmereJobsBoardPanel,
  harthmereJobsBoardColumnCountForWidth,
  nextHarthmereJobsBoardGridIndexForKey,
  nextHarthmereJobsBoardTabForKey,
} from "../HarthmereJobsBoardPanel";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
  normalizeHarthmereJobsBoardSnapshot,
  type HarthmereJobsBoardSnapshot,
} from "../jobsBoardLiveAdapter";

declare global {
  interface Window {
    __jobsBoardEvents: string[];
  }
}

const NOW = 1_800_000_000_000;

function resolveRepoAliasForEsbuild(importPath: string) {
  const basePath = path.join(process.cwd(), "src", importPath.slice(2));
  for (const candidate of [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.json`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return basePath;
}

function nodeBuiltinStubForJobsBoardBrowser(pathName: string) {
  if (pathName === "perf_hooks") {
    return "export const performance = globalThis.performance;";
  }
  if (pathName === "async_hooks") {
    return "export class AsyncLocalStorage { getStore() { return undefined; } run(_store, cb, ...args) { return cb(...args); } enterWith() {} disable() {} }";
  }
  if (pathName === "process") {
    return "export const env = {}; export const argv = []; export const platform = 'test'; export default { env, argv, platform };";
  }
  if (pathName === "os") {
    return "export function platform() { return 'test'; } export function release() { return ''; } export default { platform, release };";
  }
  return "export default {}; export function randomBytes() { return new Uint8Array(); } export function randomUUID() { return 'jobs-board-test-uuid'; }";
}

function jobsBoardBusinessCustomerSimulatorStub() {
  return `
    export const HARTHMERE_BUSINESS_OUTPOSTS = [];
    export function harthmereBusinessOutpostJobsBoardPosition() { return { x: 0, y: 0, z: 0 }; }
    export function harthmereBusinessScaledJobPay() { return 75; }
  `;
}

function jobsBoardBusinessTemplatesStub() {
  return `
    const repairTemplate = {
      templateId: "repair_person_fixture_fix",
      businessType: "repair_maintenance_person",
      label: "Fixture repair",
      title: "Repair the Broken Market Fixture",
      description: "Use repair parts at the marked fixture and verify it is usable again.",
      kind: "repair",
      requirements: [{
        itemId: "repair_part",
        count: 1,
        targetId: "market_fixture",
        targetName: "Market fixture",
        mapMarkerId: "market_fixture_marker",
      }],
      targetId: "market_fixture",
      mapMarkerId: "market_fixture_marker",
      defaultRewardGold: 75,
      defaultDeadlineDays: 3,
      requiresFieldWork: true,
    };
    export const HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES = [repairTemplate];
    export const HARTHMERE_JOBS_BOARD_EXECUTABLE_ITEM_IDS = new Set(["repair_part"]);
    export function harthmereJobsBoardBusinessTemplatesForType(typeId) {
      return HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.filter((template) => !typeId || template.businessType === typeId);
    }
    export function harthmereJobsBoardBusinessTemplateById(templateId) {
      return HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.find((template) => template.templateId === templateId);
    }
    export function isKnownHarthmereJobsBoardExecutableItemId(itemId) {
      return HARTHMERE_JOBS_BOARD_EXECUTABLE_ITEM_IDS.has(itemId);
    }
  `;
}

function jobsBoardMmoAuthorityStub() {
  return `
    export function formatHarthmereJobTimeRemaining(deadlineAtMs, nowMs) {
      if (deadlineAtMs === undefined) return "";
      const remaining = Number(deadlineAtMs) - Number(nowMs ?? Date.now());
      if (!Number.isFinite(remaining) || remaining <= 0) return "Expired";
      const minutes = Math.max(1, Math.floor(remaining / 60000));
      const hours = Math.floor(minutes / 60);
      return hours > 0 ? hours + "h " + (minutes % 60) + "m left" : minutes + "m left";
    }
  `;
}

function harthmereLiveFetchStub() {
  return `
    export async function fetchHarthmereLiveWithTimeout(fetchImpl, input, init) { return fetchImpl(input, init); }
    export async function defaultHarthmereLiveFetch(input, init) { return fetch(input, init); }
    export function prepareHarthmereLiveFetchRequest(input, init = {}) { return { input, init }; }
  `;
}

function localDevHarthmereInventorySystemStub() {
  return `
    export function grantHarthmereJobReward() {}
    export function harthmereInventoryCanAcceptItems() { return true; }
    export function isHarthmereRepairToolEquipped() { return false; }
  `;
}

function galoisAssetPathsStub() {
  return `
    export function assetPaths() { return []; }
    export function resolveAssetUrlUntyped(path) { return String(path); }
  `;
}

function job(jobId: string, title: string, rewardGold: number) {
  return {
    jobId,
    boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    issuerKind: "town" as const,
    issuerId: "harthmere_grove",
    title,
    description: `${title} description`,
    kind: "repair" as const,
    requirements: [
      {
        serviceKind: "repair",
        serviceUnits: 1,
        targetId: `${jobId}_target`,
        mapMarkerId: `${jobId}_marker`,
      },
    ],
    rewardGold,
    escrowGold: rewardGold,
    status: "open" as const,
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    createdAtMs: NOW,
    deadlineAtMs: NOW + 86_400_000,
    requiresFieldWork: true,
    mapMarkerId: `${jobId}_marker`,
    targetId: `${jobId}_target`,
    abuseFlags: [],
    logs: [],
  };
}

function sampleSnapshot(): HarthmereJobsBoardSnapshot {
  const active = {
    ...job("job_active", "Patch the Safe-Zone Fence", 75),
    status: "active" as const,
    acceptedByActorId: "player_a",
  };
  const completed = {
    ...job("job_completed", "Finished Ration Run", 40),
    status: "completed" as const,
    acceptedByActorId: "player_a",
  };
  const postedOpen = {
    ...job("job_posted_open", "Bring Road Planks", 35),
    issuerKind: "player" as const,
    issuerId: "player_a",
  };
  const postedAccepted = {
    ...job("job_posted_accepted", "Carry Market Mail", 30),
    issuerKind: "player" as const,
    issuerId: "player_a",
    status: "active" as const,
    acceptedByActorId: "other_player",
  };
  return normalizeHarthmereJobsBoardSnapshot({
    version: "test",
    actorId: "player_a",
    defaultBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    boards: {
      [HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID]: {
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        displayName: "Harthmere Grove Jobs Board",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        markerId: "harthmere_market_posting_board",
        location: {
          x: 501.99486179104775,
          y: 70,
          z: -132.00350672753194,
          radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
          district: "The Grove",
          landmarkId: "harthmere_market_posting_board",
        },
        acceptedKinds: [
          "gather",
          "delivery",
          "repair",
          "cleanup",
          "hunt",
          "escort",
          "craft",
          "medical",
          "exploration",
          "construction",
          "security",
          "service",
        ],
        requiresPhysicalInteraction: true,
      },
    },
    openJobs: [
      job("job_1", "Bounty: Elite Mucker at the Muck Edge", 100),
      job("job_2", "Clear the Muckwad Patch", 90),
      job("job_3", "Patch the Safe-Zone Fence", 80),
      job("job_4", "Escort a Newcomer to the Road Post", 70),
      job("job_5", "Stock the Road Rations Crate", 60),
    ],
    activeJobs: [active],
    myAcceptedJobs: [active, completed],
    myPostedJobs: [postedOpen, postedAccepted],
    myTodos: [
      {
        todoId: "todo_active",
        jobId: "job_active",
        actorId: "player_a",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        title: active.title,
        todoText: "Repair the marked fence section.",
        status: "completed",
        kind: "repair",
        mapMarkerId: "job_active_marker",
        targetId: "job_active_target",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        dueAtMs: NOW + 86_400_000,
        questBoardTodo: true,
      },
    ],
    walletGold: 500,
    inventoryItems: { road_ration: 3, repair_part: 2 },
    discoveredCollectibles: { "economy:repair_maintenance_person": NOW },
    myBusinesses: [
      {
        businessId: "business_repair",
        typeId: "repair_maintenance_person",
        name: "Pump Fixers",
        balanceGold: 400,
        inventory: {
          road_ration: { itemId: "road_ration", count: 3 },
        },
      },
    ],
    cooldown: { abuseScore: 0 },
    safety: {
      minRewardGold: 5,
      maxRewardGold: 5000,
      maxActivePostingsPerIssuer: 12,
      maxActiveAcceptedPerSeeker: 6,
      requiresPhysicalBoardInteraction: true,
    },
  });
}

describe("HarthmereJobsBoardPanel keyboard support", () => {
  it("covers keyboard base cases and edge cases for grid and tab navigation", () => {
    const baseAndEdgeCases = [
      {
        key: "ArrowRight",
        currentIndex: 0,
        itemCount: 5,
        columns: 3,
        expected: 1,
      },
      {
        key: "ArrowLeft",
        currentIndex: 0,
        itemCount: 5,
        columns: 3,
        expected: 0,
      },
      {
        key: "ArrowDown",
        currentIndex: 1,
        itemCount: 5,
        columns: 3,
        expected: 4,
      },
      {
        key: "ArrowDown",
        currentIndex: 4,
        itemCount: 5,
        columns: 3,
        expected: 4,
      },
      {
        key: "ArrowUp",
        currentIndex: 1,
        itemCount: 5,
        columns: 3,
        expected: 0,
      },
      { key: "Home", currentIndex: 3, itemCount: 5, columns: 3, expected: 0 },
      { key: "End", currentIndex: 1, itemCount: 5, columns: 3, expected: 4 },
      {
        key: "ArrowRight",
        currentIndex: -10,
        itemCount: 5,
        columns: 0,
        expected: 1,
      },
      {
        key: "ArrowRight",
        currentIndex: 0,
        itemCount: 0,
        columns: 3,
        expected: -1,
      },
    ];
    for (const testCase of baseAndEdgeCases) {
      assert.equal(
        nextHarthmereJobsBoardGridIndexForKey(testCase),
        testCase.expected,
        JSON.stringify(testCase)
      );
    }

    assert.equal(harthmereJobsBoardColumnCountForWidth(500), 1);
    assert.equal(harthmereJobsBoardColumnCountForWidth(720), 2);
    assert.equal(harthmereJobsBoardColumnCountForWidth(1024), 3);
    assert.equal(harthmereJobsBoardColumnCountForWidth(Number.NaN), 1);

    assert.equal(
      nextHarthmereJobsBoardTabForKey("available", "ArrowLeft"),
      "safety"
    );
    assert.equal(
      nextHarthmereJobsBoardTabForKey("available", "ArrowRight"),
      "accepted"
    );
    assert.equal(nextHarthmereJobsBoardTabForKey("posted", "PageDown"), "post");
    assert.equal(
      nextHarthmereJobsBoardTabForKey("posted", "PageUp"),
      "accepted"
    );
    assert.equal(
      nextHarthmereJobsBoardTabForKey("posted", "Home"),
      "available"
    );
    assert.equal(nextHarthmereJobsBoardTabForKey("posted", "End"), "safety");
  });

  it("renders the shorter Jobs Board title and accessible action names", () => {
    const html = renderToStaticMarkup(
      <HarthmereJobsBoardPanel
        snapshot={sampleSnapshot()}
        onAcceptJob={() => {}}
        onCompleteJob={() => {}}
        onCancelJob={() => {}}
        onPostJob={() => {}}
      />
    );
    assert.ok(html.includes(">Jobs Board<"));
    assert.equal(html.includes("Harthmere Grove Jobs Board"), false);
    assert.ok(html.includes('data-harthmere-jobs-board-interface="true"'));
    assert.ok(html.includes('data-pointer-lock-policy="unlock-while-open"'));
    assert.ok(html.includes('data-mouse-policy="show-while-open"'));
    assert.ok(
      html.includes('data-keyboard-navigation="roving-grid-tab-trap-enter"')
    );
    assert.ok(
      html.includes('aria-label="Accept Bounty: Elite Mucker at the Muck Edge"')
    );
  });

  it("supports arrow traversal, accept, turn-in, cancel, post, empty-tab, and close flows in a browser", async function () {
    this.timeout(45_000);

    const tempDir = await mkdtemp(
      path.join(tmpdir(), "biomes-jobs-board-keyboard-")
    );
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const componentPath = path
      .join(
        process.cwd(),
        "src/client/components/harthmere_jobs_board/HarthmereJobsBoardPanel.tsx"
      )
      .replace(/\\/g, "/");
    const snapshotJson = JSON.stringify(sampleSnapshot());

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { HarthmereJobsBoardPanel } from "${componentPath}";

        window.__jobsBoardEvents = [];
        const snapshot = ${snapshotJson};
        createRoot(document.getElementById("root")).render(
          <HarthmereJobsBoardPanel
            snapshot={snapshot}
            onAcceptJob={(jobId) => window.__jobsBoardEvents.push("accept:" + jobId)}
            onCompleteJob={(jobId) => window.__jobsBoardEvents.push("complete:" + jobId)}
            onCancelJob={(jobId) => window.__jobsBoardEvents.push("cancel:" + jobId)}
            onPostJob={(payload) => window.__jobsBoardEvents.push("post:" + JSON.stringify(payload))}
            onClose={() => window.__jobsBoardEvents.push("close")}
          />
        );
      `
    );
    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          jsx: "react",
        },
      })
    );

    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      absWorkingDir: process.cwd(),
      nodePaths: [path.join(process.cwd(), "node_modules")],
      platform: "browser",
      format: "iife",
      banner: {
        js: "var process = { env: {}, argv: [], platform: 'test' }; var global = globalThis;",
      },
      jsx: "transform",
      jsxFactory: "React.createElement",
      jsxFragment: "React.Fragment",
      loader: { ".tsx": "tsx", ".ts": "ts" },
      tsconfig: tsconfigPath,
      plugins: [
        {
          name: "stub-local-dev-quests",
          setup(pluginBuild) {
            pluginBuild.onResolve(
              { filter: /business_customer_simulator$/ },
              () => ({
                path: "stub-business-customer-simulator",
                namespace: "jobs-board-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /jobs_board_business_templates$/ },
              () => ({
                path: "stub-jobs-board-business-templates",
                namespace: "jobs-board-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /mmo_jobs_board_authority$/ },
              () => ({
                path: "stub-mmo-jobs-board-authority",
                namespace: "jobs-board-test",
              })
            );
            pluginBuild.onResolve({ filter: /harthmere_live_fetch$/ }, () => ({
              path: "stub-harthmere-live-fetch",
              namespace: "jobs-board-test",
            }));
            pluginBuild.onResolve(
              { filter: /@\/galois\/interface\/asset_paths$/ },
              () => ({
                path: "stub-galois-asset-paths",
                namespace: "jobs-board-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /^(async_hooks|perf_hooks|crypto|process|os)$/ },
              (args) => ({
                path: args.path,
                namespace: "jobs-board-node-stub",
              })
            );
            pluginBuild.onResolve({ filter: /^@\// }, (args) => ({
              path: resolveRepoAliasForEsbuild(args.path),
            }));
            pluginBuild.onResolve(
              { filter: /LocalDevHarthmereQuests$/ },
              () => ({
                path: "stub-local-dev-quests",
                namespace: "jobs-board-test",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-local-dev-quests$/,
                namespace: "jobs-board-test",
              },
              () => ({
                contents:
                  "export function completeHarthmereJobsBoardReadQuest() { return { changed: false, reason: 'test' }; }",
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-business-customer-simulator$/,
                namespace: "jobs-board-test",
              },
              () => ({
                contents: jobsBoardBusinessCustomerSimulatorStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-jobs-board-business-templates$/,
                namespace: "jobs-board-test",
              },
              () => ({
                contents: jobsBoardBusinessTemplatesStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-mmo-jobs-board-authority$/,
                namespace: "jobs-board-test",
              },
              () => ({
                contents: jobsBoardMmoAuthorityStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-harthmere-live-fetch$/,
                namespace: "jobs-board-test",
              },
              () => ({
                contents: harthmereLiveFetchStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-galois-asset-paths$/,
                namespace: "jobs-board-test",
              },
              () => ({
                contents: galoisAssetPathsStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              { filter: /.*/, namespace: "jobs-board-node-stub" },
              (args) => ({
                contents: nodeBuiltinStubForJobsBoardBrowser(args.path),
                loader: "js",
              })
            );
          },
        },
      ],
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 800 },
      });
      const browserErrors: string[] = [];
      page.on("pageerror", (error) =>
        browserErrors.push(error.stack ?? error.message)
      );
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      await page.setContent(`
        <html>
          <head>
            <style>
              body { margin: 0; background: #07101d; color: #e5eefb; font-family: sans-serif; }
              #root { min-height: 100vh; }
            </style>
          </head>
          <body><div id="root"></div></body>
        </html>
      `);
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });
      try {
        await page.waitForSelector(
          "[data-testid='harthmere-jobs-board-panel']"
        );
      } catch (error) {
        assert.fail(
          `Jobs board panel did not mount. Browser errors:\n${
            browserErrors.join("\n") || String(error)
          }`
        );
      }
      assert.equal(
        await page.locator("h2").first().textContent(),
        "Jobs Board"
      );
      assert.equal(
        (await page.textContent("body"))?.includes(
          "Harthmere Grove Jobs Board"
        ),
        false
      );
      assert.equal(
        await page
          .locator("[data-testid='harthmere-jobs-board-panel']")
          .getAttribute("data-pointer-lock-policy"),
        "unlock-while-open"
      );
      assert.equal(
        await page
          .locator("[data-testid='harthmere-jobs-board-panel']")
          .getAttribute("data-keyboard-navigation"),
        "roving-grid-tab-trap-enter"
      );

      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("data-job-action-id") === "job_1"
      );
      await page.getByLabel("Close jobs board").focus();
      await page.keyboard.press("Shift+Tab");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("data-job-action-id") === "job_5"
      );
      await page.keyboard.press("Tab");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Close jobs board"
      );
      await page.locator("[data-job-action-id='job_1']").focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("data-job-action-id")
        ),
        "job_2"
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("data-job-action-id")
        ),
        "job_5"
      );
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("data-job-action-id")
        ),
        "job_5"
      );
      await page.keyboard.press("Home");
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("data-job-action-id")
        ),
        "job_1"
      );
      await page.keyboard.press("End");
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("data-job-action-id")
        ),
        "job_5"
      );
      await page.keyboard.press("ArrowLeft");
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("data-job-action-id")
        ),
        "job_4"
      );
      await page.keyboard.press("Enter");
      await page.keyboard.press("Home");
      await page.keyboard.press("Space");

      await page.keyboard.press("PageDown");
      assert.equal(
        await page
          .getByRole("tab", { name: /My Jobs/ })
          .getAttribute("aria-selected"),
        "true"
      );
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("data-job-action-id") ===
          "job_active"
      );
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("data-job-action-id")
        ),
        "job_active"
      );

      await page.keyboard.press("PageDown");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("data-job-action-id") ===
          "job_posted_open"
      );
      await page.keyboard.press("Space");

      await page.keyboard.press("PageDown");
      await page.waitForFunction(() =>
        document.activeElement
          ?.getAttribute("data-job-action-id")
          ?.startsWith("template:")
      );
      await page.keyboard.press("End");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("data-job-action-id") ===
          "create-posting"
      );
      await page.getByRole("button", { name: "Add item reward" }).click();
      await page
        .getByRole("button", { name: "Add collectible reward" })
        .click();
      await page.getByRole("button", { name: "Create job posting" }).focus();
      await page.keyboard.press("Enter");

      await page.keyboard.press("PageDown");
      assert.equal(
        await page
          .getByRole("tab", { name: "Safety" })
          .getAttribute("aria-selected"),
        "true"
      );
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        () => document.activeElement?.getAttribute("aria-selected") === "true"
      );

      await page.keyboard.press("Escape");

      const events = await page.evaluate(() => window.__jobsBoardEvents);
      assert.equal(events.length, 6);
      assert.deepEqual(events.slice(0, 4), [
        "accept:job_4",
        "accept:job_1",
        "complete:job_active",
        "cancel:job_posted_open",
      ]);
      assert.ok(events[4].startsWith("post:"), events[4]);
      const postedPayload = JSON.parse(events[4].slice("post:".length));
      assert.equal(postedPayload.businessId, "business_repair");
      assert.equal(postedPayload.templateId, "repair_person_fixture_fix");
      assert.deepEqual(postedPayload.rewardItems, [
        { itemId: "road_ration", count: 1 },
      ]);
      assert.deepEqual(postedPayload.rewardCollectibleIds, [
        "economy:repair_maintenance_person",
      ]);
      assert.deepEqual(events.slice(5), ["close"]);
      assert.deepEqual(browserErrors, []);
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps live-container hooks stable from loading to ready and anchors to the physical board", async function () {
    this.timeout(45_000);

    const snapshot = sampleSnapshot();
    snapshot.boards.harthmere_town_market_jobs_board = {
      ...snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID],
      boardId: "harthmere_town_market_jobs_board",
      displayName: "Harthmere Jobs Board",
      townId: "harthmere_town",
      regionId: "harthmere_town_region",
      markerId: "harthmere_town_market_posting_board",
      location: {
        ...snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID].location,
        x: 1046,
        y: 65,
        z: -202,
        district: "Harthmere Town Market",
        landmarkId: "harthmere_town_market_posting_board",
      },
    };

    const tempDir = await mkdtemp(
      path.join(tmpdir(), "biomes-jobs-board-container-")
    );
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const componentPath = path
      .join(
        process.cwd(),
        "src/client/components/harthmere_jobs_board/HarthmereJobsBoardLiveContainer.tsx"
      )
      .replace(/\\/g, "/");
    const snapshotJson = JSON.stringify(snapshot);

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { HarthmereJobsBoardLiveContainer } from "${componentPath}";

        window.__jobsBoardEvents = [];
        const snapshot = ${snapshotJson};
        window.fetch = async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            jobsBoardState: snapshot,
            backendMutation: { warnings: [] },
          }),
        });
        createRoot(document.getElementById("root")).render(
          <HarthmereJobsBoardLiveContainer
            worldContext={{ playerPosition: { x: 1046, y: 65, z: -202 } }}
            onClose={() => window.__jobsBoardEvents.push("close")}
          />
        );
      `
    );
    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          jsx: "react",
        },
      })
    );

    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      absWorkingDir: process.cwd(),
      nodePaths: [path.join(process.cwd(), "node_modules")],
      platform: "browser",
      format: "iife",
      banner: {
        js: "var process = { env: {}, argv: [], platform: 'test' }; var global = globalThis;",
      },
      jsx: "transform",
      jsxFactory: "React.createElement",
      jsxFragment: "React.Fragment",
      loader: { ".tsx": "tsx", ".ts": "ts" },
      tsconfig: tsconfigPath,
      plugins: [
        {
          name: "stub-live-jobs-board-container-deps",
          setup(pluginBuild) {
            pluginBuild.onResolve(
              { filter: /business_customer_simulator$/ },
              () => ({
                path: "stub-business-customer-simulator",
                namespace: "jobs-board-container-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /jobs_board_business_templates$/ },
              () => ({
                path: "stub-jobs-board-business-templates",
                namespace: "jobs-board-container-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /mmo_jobs_board_authority$/ },
              () => ({
                path: "stub-mmo-jobs-board-authority",
                namespace: "jobs-board-container-test",
              })
            );
            pluginBuild.onResolve({ filter: /harthmere_live_fetch$/ }, () => ({
              path: "stub-harthmere-live-fetch",
              namespace: "jobs-board-container-test",
            }));
            pluginBuild.onResolve(
              { filter: /LocalDevHarthmereInventorySystem$/ },
              () => ({
                path: "stub-local-dev-harthmere-inventory-system",
                namespace: "jobs-board-container-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /@\/galois\/interface\/asset_paths$/ },
              () => ({
                path: "stub-galois-asset-paths",
                namespace: "jobs-board-container-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /^(async_hooks|perf_hooks|crypto|process|os)$/ },
              (args) => ({
                path: args.path,
                namespace: "jobs-board-node-stub",
              })
            );
            pluginBuild.onResolve({ filter: /^@\// }, (args) => ({
              path: resolveRepoAliasForEsbuild(args.path),
            }));
            pluginBuild.onResolve({ filter: /useHarthmereJobsBoard$/ }, () => ({
              path: "stub-use-harthmere-jobs-board",
              namespace: "jobs-board-container-test",
            }));
            pluginBuild.onResolve(
              { filter: /LocalDevHarthmereQuests$/ },
              () => ({
                path: "stub-local-dev-quests",
                namespace: "jobs-board-container-test",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-use-harthmere-jobs-board$/,
                namespace: "jobs-board-container-test",
              },
              () => ({
                contents: `
              import * as React from "react";
              const snapshot = ${snapshotJson};
              export function useHarthmereJobsBoard() {
                const [ready, setReady] = React.useState(false);
                React.useEffect(() => {
                  window.__jobsBoardEvents.push(ready ? "ready-render" : "loading-render");
                  if (!ready) {
                    const id = window.setTimeout(() => setReady(true), 20);
                    return () => window.clearTimeout(id);
                  }
                }, [ready]);
                return ready
                  ? { state: snapshot, loading: false, error: undefined, refresh: async () => {} }
                  : { state: undefined, loading: true, error: undefined, refresh: async () => {} };
              }
            `,
                loader: "js",
                resolveDir: process.cwd(),
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-local-dev-quests$/,
                namespace: "jobs-board-container-test",
              },
              () => ({
                contents:
                  "export function completeHarthmereJobsBoardReadQuest() { return { changed: false, reason: 'test' }; }",
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-business-customer-simulator$/,
                namespace: "jobs-board-container-test",
              },
              () => ({
                contents: jobsBoardBusinessCustomerSimulatorStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-jobs-board-business-templates$/,
                namespace: "jobs-board-container-test",
              },
              () => ({
                contents: jobsBoardBusinessTemplatesStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-mmo-jobs-board-authority$/,
                namespace: "jobs-board-container-test",
              },
              () => ({
                contents: jobsBoardMmoAuthorityStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-harthmere-live-fetch$/,
                namespace: "jobs-board-container-test",
              },
              () => ({
                contents: harthmereLiveFetchStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-local-dev-harthmere-inventory-system$/,
                namespace: "jobs-board-container-test",
              },
              () => ({
                contents: localDevHarthmereInventorySystemStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /^stub-galois-asset-paths$/,
                namespace: "jobs-board-container-test",
              },
              () => ({
                contents: galoisAssetPathsStub(),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              { filter: /.*/, namespace: "jobs-board-node-stub" },
              (args) => ({
                contents: nodeBuiltinStubForJobsBoardBrowser(args.path),
                loader: "js",
              })
            );
          },
        },
      ],
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 800 },
      });
      const browserErrors: string[] = [];
      page.on("pageerror", (error) =>
        browserErrors.push(error.stack ?? error.message)
      );
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      await page.setContent(`
        <html>
          <head>
            <style>
              body { margin: 0; background: #07101d; color: #e5eefb; font-family: sans-serif; }
              #root { min-height: 100vh; }
            </style>
          </head>
          <body><div id="root"></div></body>
        </html>
      `);
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });
      await page.waitForSelector("[data-testid='harthmere-jobs-board-panel']");

      const events = await page.evaluate(() => window.__jobsBoardEvents);
      assert.ok(events.includes("loading-render"));
      assert.ok(events.includes("ready-render"));
      assert.deepEqual(
        browserErrors.filter((error) =>
          /Rendered more hooks|hooks than during the previous render/i.test(
            error
          )
        ),
        []
      );

      assert.equal(
        await page
          .locator("[data-testid='harthmere-jobs-board-selector']")
          .count(),
        0
      );
      assert.equal(
        await page.locator("h2").textContent(),
        "Harthmere Jobs Board"
      );
      assert.deepEqual(browserErrors, []);
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
