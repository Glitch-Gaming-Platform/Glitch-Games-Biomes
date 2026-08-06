#!/usr/bin/env node
"use strict";

/**
 * Exact-image native E2E + live-browser acceptance for Blender gathering nodes
 * and landmark jobs boards. Fixture APIs only place/equip the actor and clear
 * prior test depletion. Harvesting and board opening use the real F path.
 */

if (
  !process.env.GLITCH_REDIS_PORT &&
  !process.env.LOCAL_REDIS_PORT &&
  !process.env.REDIS_PORT
) {
  process.env.GLITCH_REDIS_PORT =
    process.env.HARTHMERE_E2E_REDIS_PORT || "6493";
}
process.env.GLITCH_REDIS_HOST =
  process.env.HARTHMERE_E2E_REDIS_HOST ||
  process.env.GLITCH_REDIS_HOST ||
  "127.0.0.1";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { chromium } = require("playwright");
const {
  acquireBrowserRuntimeLease,
} = require("./browser-runtime-lease.cjs");
const { lookAtOrientation } = require("../../src/shared/cutscene/math");
const {
  Health,
  Inventory,
  Orientation,
  Position,
  SelectedItem,
} = require("../../src/shared/ecs/gen/components");
const { MoveEvent, PickUpEvent } = require("../../src/shared/ecs/gen/events");
const {
  EntitySerde,
  EventSerde,
  SerializeForServer,
} = require("../../src/shared/ecs/gen/json_serde");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
const { countOf } = require("../../src/shared/game/items");
const {
  HARTHMERE_GATHERING_AUTHORITY_NODES,
  harthmereGatheringToolLabel,
} = require("../../src/shared/harthmere/gathering_node_authority");
const {
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
} = require("../../src/client/components/harthmere_jobs_board/jobsBoardLiveAdapter");
const {
  harthmereNativeBiomesIdForItemId,
} = require("../../src/shared/harthmere/harthmere_native_item_ids");
const {
  SNAPSHOT_FISHING_RODS,
} = require("../../src/shared/harthmere/fishing_rods");
const {
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedStateKey,
  harthmereLiveModeSharedWorldStateKey,
  parseHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
  stringifyHarthmereLiveModePlayerPersistenceState,
} = require("../../src/shared/harthmere/live_mode_backend");
const { connectToRedis } = require("../../src/server/shared/redis/connection");

const root = path.resolve(__dirname, "../..");
const baseUrl = String(
  process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3417"
).replace(/\/$/, "");
const syncBaseUrl = String(
  process.env.HARTHMERE_E2E_SYNC_BASE_URL || "http://127.0.0.1:5307"
).replace(/\/$/, "");
const stackContainer =
  process.env.HARTHMERE_E2E_STACK_CONTAINER || "harthmere-final-minigames-app";
const redisContainer =
  process.env.HARTHMERE_E2E_REDIS_CONTAINER ||
  "harthmere-final-minigames-redis";
const redisHost = process.env.HARTHMERE_E2E_REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.HARTHMERE_E2E_REDIS_PORT || 6493);
const expectedImageId = process.env.HARTHMERE_E2E_IMAGE_ID || "";
const expectedBuildId = process.env.HARTHMERE_E2E_BUILD_ID || "";
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const actorId = Number(
  process.env.HARTHMERE_WORLD_GRAPHICS_E2E_ACTOR || 8_812_000_000_099_811
);
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 90_000);
const orchardOnly = process.env.HARTHMERE_E2E_ORCHARD_ONLY === "1";
const noDirectRedisMutation =
  process.env.HARTHMERE_E2E_NO_REDIS_MUTATION === "1";
const runId = `${Date.now()}-${process.pid}`;
const artifactsDir = path.resolve(
  process.env.HARTHMERE_E2E_ARTIFACTS_DIR ||
    path.join(root, "artifacts/harthmere-world-interaction-live-browser")
);
const reportPath = path.join(artifactsDir, `${runId}-report.json`);
let browserRuntimeLease;
const resumeReportPath = process.env.HARTHMERE_E2E_RESUME_REPORT
  ? path.resolve(process.env.HARTHMERE_E2E_RESUME_REPORT)
  : undefined;
const representativeScreenshots = new Set([
  "harthmere_north_iron_vein",
  "harthmere_orchard_softwood",
  "harthmere_temple_peacebloom",
  "harthmere_river_fishing_pool",
  "harthmere_mudden_scrap",
  "old_wood_mushroom_ring",
  "orchard_honey_hive",
  "bear_den_harvest",
  "gravewood_zombie_remains",
]);
const CAPTURED_WOODEN_AXE_BIOMES_ID = 1_534_621_126_189_595;
const report = {
  version: "harthmere-world-interaction-live-browser-v1",
  runId,
  baseUrl,
  syncBaseUrl,
  stackContainer,
  redisContainer,
  expectedImageId,
  expectedBuildId,
  actorId,
  focus: orchardOnly ? "orchard_native_axe" : "full",
  noDirectRedisMutation,
  startedAt: new Date().toISOString(),
  lifecycle: {},
  jobsBoard: {},
  nodes: [],
  interactionCases: [],
  screenshots: [],
  jobsBoardRequests: [],
  browserFailures: [],
  diagnosticFailures: [],
  failures: [],
};

if (resumeReportPath) {
  const previous = JSON.parse(fs.readFileSync(resumeReportPath, "utf8"));
  report.resumeEvidence = {
    reportPath: resumeReportPath,
    buildId: previous.lifecycle?.actualBuildId,
    retainedJobsBoard: previous.jobsBoard?.status === "passed",
    retainedInteractionCases: (previous.interactionCases ?? []).map(
      (entry) => entry.case
    ),
    retainedNodeIds: (previous.nodes ?? []).map((entry) => entry.nodeId),
  };
  if (previous.jobsBoard?.status === "passed") {
    report.jobsBoard = {
      ...previous.jobsBoard,
      retainedFromReport: resumeReportPath,
    };
  }
  report.interactionCases = (previous.interactionCases ?? [])
    .filter((entry) => entry.status === "passed")
    .map((entry) => ({ ...entry, retainedFromReport: resumeReportPath }));
  report.nodes = (previous.nodes ?? [])
    .filter((entry) => entry.status === "passed")
    .map((entry) => ({ ...entry, retainedFromReport: resumeReportPath }));
  report.screenshots = [...(previous.screenshots ?? [])];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: root,
    encoding: "utf8",
    timeout: options.timeout || 30_000,
    env: options.env || process.env,
  });
  assert.equal(
    result.status,
    0,
    `${program} ${args.join(" ")} failed: ${
      result.error?.message || result.stderr || result.stdout || "no output"
    }`
  );
  return result.stdout.trim();
}

function inspect(container, template) {
  return command("docker", ["inspect", "-f", template, container]);
}

function persistReport() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      report,
      (_key, value) => (typeof value === "bigint" ? `${value}n` : value),
      2
    )
  );
}

function lifecyclePreflight() {
  assert(controlToken, "HARTHMERE_E2E_CONTROL_TOKEN is required");
  assert(expectedImageId, "HARTHMERE_E2E_IMAGE_ID is required");
  assert(expectedBuildId, "HARTHMERE_E2E_BUILD_ID is required");
  assert(Number.isSafeInteger(actorId) && actorId > 0, "actor must be numeric");
  for (const container of [stackContainer, redisContainer]) {
    assert.equal(inspect(container, "{{.State.Status}}"), "running");
    assert.equal(inspect(container, "{{.RestartCount}}"), "0");
    assert.equal(inspect(container, "{{.State.OOMKilled}}"), "false");
  }
  const actualImageId = inspect(stackContainer, "{{.Image}}");
  assert.equal(actualImageId, expectedImageId, "Unexpected application image");
  const actualBuildId = command("docker", [
    "exec",
    stackContainer,
    "/bin/sh",
    "-lc",
    'if [ -f /app/.next/BUILD_ID ]; then cat /app/.next/BUILD_ID; else printf "%s" "${BUILD_ID:-}"; fi',
  ]);
  assert.equal(actualBuildId, expectedBuildId, "Unexpected BUILD_ID");
  const configuredBuildId = command("docker", [
    "exec",
    stackContainer,
    "/bin/sh",
    "-lc",
    'printf "%s" "${BUILD_ID:-}"',
  ]);
  assert.equal(
    command("redis-cli", [
      "-h",
      redisHost,
      "-p",
      String(redisPort),
      "--raw",
      "PING",
    ]),
    "PONG"
  );
  const dbsize = Number(
    command("redis-cli", [
      "-h",
      redisHost,
      "-p",
      String(redisPort),
      "--raw",
      "DBSIZE",
    ])
  );
  assert(dbsize > 300_000, `Warm Redis is unrealistically small: ${dbsize}`);
  command(process.execPath, ["scripts/harthmere/e2e-jump.cjs", "ready"], {
    timeout: timeoutMs,
    env: {
      ...process.env,
      HARTHMERE_E2E_URL: baseUrl,
      HARTHMERE_E2E_WEB_PORT: String(new URL(baseUrl).port || 80),
      HARTHMERE_E2E_SYNC_BASE_URL: syncBaseUrl,
      HARTHMERE_E2E_SYNC_PORT: String(new URL(syncBaseUrl).port || 80),
      HARTHMERE_E2E_REDIS_PORT: String(redisPort),
      HARTHMERE_E2E_STACK_CONTAINER: stackContainer,
    },
  });
  report.lifecycle = {
    actualImageId,
    actualBuildId,
    configuredBuildId,
    redisDbsize: dbsize,
    appRestartCount: 0,
    appOomKilled: false,
    redisRestartCount: 0,
    redisOomKilled: false,
  };
}

function gameUrl() {
  const url = new URL("/at", baseUrl);
  url.searchParams.set("syncBaseUrl", syncBaseUrl);
  url.searchParams.set("harthmere_native_ecs_e2e", "1");
  url.searchParams.set("glitch_auto_play", "1");
  url.searchParams.set("lowMemory", orchardOnly ? "0" : "1");
  url.searchParams.set("resourceCapacityScale", orchardOnly ? "1" : "0.25");
  url.searchParams.set("forceDrawDistance", orchardOnly ? "192" : "112");
  url.searchParams.set("forceRenderScale", orchardOnly ? "0.5" : "0.6");
  url.searchParams.set("forceGraphicsQuality", "low");
  url.searchParams.set("e2e_run", runId);
  return url.toString();
}

function isIgnoredBrowserNoise(text, source = "") {
  return /chrome-extension:\/\/|twitch\.tv|ttvnw\.net|jtvnw\.net|googlevideo\.com|ERR_ABORTED|MasterPlaylist|no supported source|bluetooth is not allowed|compute-pressure is not allowed|reactPlayerYouTube|No entity found for navigation aid entityId:8997551883502307/i.test(
    `${text} ${source}`
  );
}

async function openActor(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.route(
    /https?:\/\/[^/]*(?:twitch\.tv|ttvnw\.net|jtvnw\.net)(?:\/|$)/i,
    (route) => route.abort("blockedbyclient")
  );
  await context.addInitScript(() => {
    localStorage.setItem("settings.hud.keepOverlaysVisible", "true");
    sessionStorage.setItem(
      "biomes.harthmere.partialTerrainRecoveryReloaded",
      "1"
    );
    sessionStorage.setItem(
      "biomes.world.missingShardRecoveryReloadedAt",
      String(Date.now())
    );
  });
  const authUrl = new URL("/api/harthmere/visual_test_auth", baseUrl);
  authUrl.searchParams.set("usernameOrId", String(actorId));
  authUrl.searchParams.set("e2eAdmin", "1");
  const authResponse = await context.request.get(authUrl.toString(), {
    headers: { "x-harthmere-e2e-token": controlToken },
    timeout: timeoutMs,
  });
  assert(
    authResponse.ok(),
    `Visual auth failed HTTP ${authResponse.status()}: ${await authResponse.text()}`
  );
  const page = await context.newPage();
  const jobsRequestStarts = new Map();
  page.on("request", (request) => {
    if (request.url().includes("/api/harthmere/live_mode_jobs_board_state")) {
      jobsRequestStarts.set(request, Date.now());
    }
  });
  page.on("response", (response) => {
    const request = response.request();
    if (!request.url().includes("/api/harthmere/live_mode_jobs_board_state")) {
      return;
    }
    report.jobsBoardRequests.push({
      url: request.url(),
      status: response.status(),
      durationMs: Date.now() - (jobsRequestStarts.get(request) ?? Date.now()),
    });
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !isIgnoredBrowserNoise(message.text(), message.location().url)
    ) {
      report.browserFailures.push(
        `console:${message.text()}:${message.location().url || "unknown"}`
      );
    }
  });
  page.on("pageerror", (error) => {
    report.browserFailures.push(`pageerror:${error.message}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "unknown";
    if (!isIgnoredBrowserNoise(failure, request.url())) {
      report.browserFailures.push(`request:${failure}:${request.url()}`);
    }
  });
  await page.goto(gameUrl(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await page.waitForFunction(
    (id) =>
      globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1" &&
      globalThis.__harthmereNativeEcsE2E?.userId === id,
    actorId,
    { timeout: timeoutMs }
  );
  await page.waitForFunction(
    () =>
      globalThis.__harthmereGatheringNodeGraphics?.expectedCount === 29 &&
      globalThis.__harthmereJobsBoardMarkerDebug?.boards().length === 21,
    undefined,
    { timeout: timeoutMs }
  );
  await dismissEnterGame(page);
  return { context, page };
}

function serializedChange(change) {
  return ChangeSerde.serializeProposed(SerializeForServer, change);
}

function serializedEvent(event) {
  return EventSerde.serialize(event);
}

async function bridgeCall(page, method, ...args) {
  return page.evaluate(
    async ({ method, args }) => {
      const bridge = globalThis.__harthmereNativeEcsE2E;
      if (!bridge) throw new Error("Native ECS E2E bridge is unavailable");
      const fn = bridge[method];
      if (typeof fn !== "function") throw new Error(`Unknown bridge ${method}`);
      return await fn(...args);
    },
    { method, args }
  );
}

async function applyChanges(page, ...changes) {
  return bridgeCall(
    page,
    "applyChanges",
    changes.map((change) => serializedChange(change))
  );
}

async function publish(page, event) {
  return bridgeCall(page, "publish", serializedEvent(event));
}

async function authoritativeEntity(page, id) {
  const rows = await bridgeCall(page, "getAuthoritative", [id]);
  const serialized = rows?.[0]?.[1];
  return serialized ? EntitySerde.deserialize(serialized, false) : undefined;
}

async function waitFor(label, probe, predicate, timeout = timeoutMs) {
  const startedAt = Date.now();
  let last;
  let lastError;
  while (Date.now() - startedAt < timeout) {
    try {
      last = await probe();
      if (await predicate(last)) {
        return { value: last, elapsedMs: Date.now() - startedAt };
      }
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    await delay(125);
  }
  throw new Error(
    `${label} timed out; last=${JSON.stringify(last)} error=${
      lastError?.stack || lastError || "none"
    }`
  );
}

async function dismissEnterGame(page) {
  const enterGame = page.getByRole("button", { name: "Enter Game" });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await enterGame.isVisible().catch(() => false))) return;
    await enterGame.evaluate((button) => button.click()).catch(() => undefined);
    await delay(250);
  }
  assert.equal(
    await enterGame.isVisible().catch(() => false),
    false,
    "Enter Game safety modal must close before world-interaction input"
  );
}

async function placePlayer(page, position, lookAt) {
  const orientation = lookAtOrientation(position, lookAt);
  const liveTeleport = await page.evaluate(
    ({ id, position: nextPosition, orientation: nextOrientation }) => {
      const teleport = globalThis.__harthmereLivePlayerDebug?.teleportTo;
      const result =
        typeof teleport === "function"
          ? teleport({
              x: nextPosition[0],
              y: nextPosition[1],
              z: nextPosition[2],
              name: "worldInteractionGraphicsE2E",
              reason: "Stream the authoritative gathering/jobs-board district",
            })
          : undefined;
      const resources = globalThis.clientContext?.resources;
      if (!resources) throw new Error("client resources unavailable");
      resources.update("/sim/player", id, (player) => {
        player.position = [...nextPosition];
        player.orientation = [...nextOrientation];
        player.velocity = [0, 0, 0];
      });
      resources.update("/scene/local_player", (localPlayer) => {
        localPlayer.player.position = [...nextPosition];
        localPlayer.player.orientation = [...nextOrientation];
        localPlayer.player.velocity = [0, 0, 0];
      });
      return result;
    },
    { id: actorId, position, orientation }
  );
  if (liveTeleport) {
    assert.equal(
      liveTeleport.teleported,
      true,
      `live player did not stream target ${position.join(",")}`
    );
  }
  await applyChanges(page, {
    kind: "update",
    entity: {
      id: actorId,
      position: Position.create({ v: [...position] }),
      orientation: Orientation.create({ v: [...orientation] }),
      health: Health.create({ hp: 100, maxHp: 100 }),
      death_info: null,
      iced: null,
    },
  });
  await publish(
    page,
    new MoveEvent({
      id: actorId,
      position: [...position],
      orientation: [...orientation],
      velocity: [0, 0, 0],
    })
  );
  await delay(300);
  await dismissEnterGame(page);
}

async function equip(page, itemIdentity) {
  const entity = await authoritativeEntity(page, actorId);
  assert(entity?.inventory, "native inventory unavailable");
  const inventory = Inventory.clone(entity.inventory);
  inventory.hotbar[0] = undefined;
  inventory.selected = { kind: "hotbar", idx: 0 };
  let selectedItem = SelectedItem.create();
  let nativeItemId;
  if (itemIdentity) {
    nativeItemId =
      typeof itemIdentity === "number"
        ? itemIdentity
        : harthmereNativeBiomesIdForItemId(itemIdentity);
    assert(nativeItemId, `${itemIdentity} has no native Bikkie identity`);
    inventory.hotbar[0] = countOf(nativeItemId, 1n);
    selectedItem = SelectedItem.create({ item: inventory.hotbar[0] });
  }
  await applyChanges(page, {
    kind: "update",
    entity: {
      id: actorId,
      inventory,
      selected_item: selectedItem,
    },
  });
  await waitFor(
    `equip ${itemIdentity || "empty hand"}`,
    () => authoritativeEntity(page, actorId),
    (next) =>
      itemIdentity
        ? next?.inventory?.hotbar?.[0]?.item?.id === nativeItemId
        : !next?.inventory?.hotbar?.[0]
  );
  return nativeItemId;
}

async function clearGatheringDepletion(nodeId) {
  if (noDirectRedisMutation) {
    return;
  }
  const redis = await connectToRedis("firehose");
  const claimKey = `gathering_node_respawn:${nodeId}`;
  try {
    const nowMs = Date.now();
    const playerKey = harthmereLiveModePlayerStateKey(String(actorId));
    const rawPlayer = await redis.primary.get(playerKey);
    const player = parseHarthmereLiveModeBackendState(
      rawPlayer,
      String(actorId),
      nowMs
    );
    delete player.combat.lootClaims[claimKey];
    player.updatedAtMs = nowMs;
    await redis.primary.set(
      playerKey,
      stringifyHarthmereLiveModePlayerPersistenceState(player)
    );

    const sharedKey = harthmereLiveModeSharedWorldStateKey();
    const rawShared = await redis.primary.get(sharedKey);
    const shared = parseHarthmereLiveModeSharedWorldState(rawShared, nowMs);
    if (shared) {
      delete shared.gatheringNodeRespawnAtMs[claimKey];
      shared.updatedAtMs = nowMs;
      await redis.primary.set(sharedKey, JSON.stringify(shared));
    }
    await redis.primary.del(
      harthmereLiveModeSharedStateKey("gathering_node", nodeId)
    );
  } finally {
    await redis.quit(`clear ${nodeId} E2E depletion`);
  }
}

async function screenshot(page, label) {
  const file = path.join(artifactsDir, `${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.screenshots.push(file);
  return file;
}

function nodeApproach(node) {
  return [node.position[0], node.position[1], node.position[2] + 2.6];
}

async function visitNode(page, node, index) {
  const approach = nodeApproach(node);
  await placePlayer(page, approach, [
    node.position[0],
    node.position[1] + 0.65,
    node.position[2],
  ]);
  const visualProbe = () =>
    page.evaluate(
      (nodeId) =>
        globalThis.__harthmereGatheringNodeGraphics
          ?.nodes()
          .find((entry) => entry.nodeId === nodeId),
      node.id
    );
  const visual = orchardOnly
    ? { value: await visualProbe(), elapsedMs: 0 }
    : await waitFor(
        `${node.id} Blender visual`,
        visualProbe,
        (entry) =>
          entry?.visible === true &&
          entry?.grounded === true &&
          entry?.activeLod === "lod0" &&
          entry?.lod0Loaded === true &&
          entry?.growInComplete === true &&
          entry?.fallback === false,
        timeoutMs
      );
  const prompt = page.getByRole("button", { name: `Harvest ${node.name}` });
  await prompt.waitFor({ state: "visible", timeout: timeoutMs });
  const requirement = await prompt.locator("small").innerText();
  if (node.profession === "fishing") {
    assert.match(requirement, /Equip any fishing rod/i);
  } else if (node.requiredTool) {
    assert.match(
      requirement,
      new RegExp(harthmereGatheringToolLabel(node.requiredTool), "i")
    );
  } else {
    assert.match(requirement, /no tool/i);
  }
  assert.match(
    requirement,
    new RegExp(
      `${node.profession.replaceAll("_", " ")} ${node.requiredSkill}`,
      "i"
    )
  );
  const row = {
    index,
    nodeId: node.id,
    name: node.name,
    profession: node.profession,
    requiredTool: node.requiredTool,
    requiredSkill: node.requiredSkill,
    position: [...node.position],
    requirement,
    visual: visual.value,
    status: orchardOnly ? "interaction_ready" : "passed",
  };
  if (representativeScreenshots.has(node.id)) {
    row.screenshot = await screenshot(
      page,
      `${String(index + 1).padStart(2, "0")}-${node.id}-visible-f-prompt`
    );
  }
  report.nodes.push(row);
  console.log(
    `PASS ${orchardOnly ? "interaction prompt" : "visual"} ${index + 1}/29 ${node.id}`
  );
  return { prompt, row };
}

async function pressFAndWait(page, expectedState, pattern) {
  if (orchardOnly) {
    await page.evaluate(() => {
      for (const element of document.querySelectorAll(".loading-wrapper")) {
        element.style.display = "none";
      }
      document.querySelector("canvas.biomes-canvas")?.focus();
    });
  }
  await page.keyboard.press("KeyF");
  const detail = page.locator(
    '[data-testid="harthmere-gathering-node-world-prompt"] small'
  );
  await waitFor(
    `F feedback ${expectedState}`,
    async () => ({
      state: await detail.getAttribute("data-state"),
      text: await detail.innerText(),
    }),
    (value) => value.state === expectedState && pattern.test(value.text)
  );
  return {
    state: await detail.getAttribute("data-state"),
    text: await detail.innerText(),
  };
}

function inventoryCount(entity, itemId) {
  let total = 0n;
  for (const stack of [
    ...(entity?.inventory?.items ?? []),
    ...(entity?.inventory?.hotbar ?? []),
  ]) {
    if (stack?.item?.id === itemId) total += stack.count;
  }
  return total;
}

async function proveToolRejectionAndHarvest(page) {
  const node = HARTHMERE_GATHERING_AUTHORITY_NODES.find(
    (candidate) => candidate.id === "harthmere_orchard_softwood"
  );
  assert(node);
  await clearGatheringDepletion(node.id);
  await visitNode(
    page,
    node,
    HARTHMERE_GATHERING_AUTHORITY_NODES.indexOf(node)
  );
  await equip(page, undefined);
  const dropsBefore = new Set(
    (await bridgeCall(page, "findLocalByComponent", "grab_bag")).map(
      ([, serialized]) => EntitySerde.deserialize(serialized, false).id
    )
  );
  const rejected = await pressFAndWait(page, "error", /Equip an axe/i);
  assert.equal(
    (await bridgeCall(page, "findLocalByComponent", "grab_bag")).filter(
      ([, serialized]) =>
        !dropsBefore.has(EntitySerde.deserialize(serialized, false).id)
    ).length,
    0,
    "missing-tool F press must not mint a drop"
  );
  report.interactionCases.push({
    case: "orchard_missing_axe",
    status: "passed",
    feedback: rejected,
    screenshot: await screenshot(page, "interaction-orchard-missing-axe"),
  });

  // Reproduce the production capture: this snapshot Wooden Axe keeps its
  // native b:<id> identity, while its Bikkie capability is the authoritative
  // proof that it satisfies an axe-gated gathering node.
  await equip(page, CAPTURED_WOODEN_AXE_BIOMES_ID);
  const beforeEntity = await authoritativeEntity(page, actorId);
  const success = await pressFAndWait(
    page,
    "success",
    /Harvested Orchard Softwood Branches/i
  );
  const depletedVisual = await waitFor(
    "orchard authoritative visual depletion",
    () =>
      page.evaluate(
        (nodeId) =>
          globalThis.__harthmereGatheringNodeGraphics
            ?.nodes()
            .find((entry) => entry.nodeId === nodeId),
        node.id
      ),
    (entry) =>
      entry?.depleted === true &&
      entry?.visible === false &&
      Number(entry?.respawnAtMs) > Date.now()
  );
  const drop = await waitFor(
    "orchard F harvest native drop",
    async () =>
      (await bridgeCall(page, "findLocalByComponent", "grab_bag"))
        .map(([, serialized]) => EntitySerde.deserialize(serialized, false))
        .find((entity) => !dropsBefore.has(entity.id)),
    Boolean
  );
  const dropStacks = [...drop.value.grab_bag.slots.values()];
  assert(dropStacks.length > 0, "harvested drop must contain authored items");
  await publish(page, new PickUpEvent({ id: actorId, item: drop.value.id }));
  await waitFor(
    "orchard native pickup reaches inventory",
    () => authoritativeEntity(page, actorId),
    (entity) =>
      dropStacks.some(
        (stack) =>
          inventoryCount(entity, stack.item.id) >
          inventoryCount(beforeEntity, stack.item.id)
      )
  );
  report.interactionCases.push({
    case: "orchard_native_axe_harvest_drop_pickup",
    status: "passed",
    nativeAxeId: String(CAPTURED_WOODEN_AXE_BIOMES_ID),
    feedback: success,
    depletedVisual: depletedVisual.value,
    dropId: String(drop.value.id),
    itemIds: dropStacks.map((stack) => String(stack.item.id)),
    screenshot: await screenshot(page, "interaction-orchard-axe-success"),
  });

  const depleted = await pressFAndWait(
    page,
    "error",
    /depleted and will respawn/i
  );
  report.interactionCases.push({
    case: "orchard_depleted",
    status: "passed",
    feedback: depleted,
  });
}

async function proveNoToolHarvest(page) {
  const node = HARTHMERE_GATHERING_AUTHORITY_NODES.find(
    (candidate) => candidate.id === "harthmere_farm_crops"
  );
  assert(node && !node.requiredTool);
  await clearGatheringDepletion(node.id);
  await visitNode(
    page,
    node,
    HARTHMERE_GATHERING_AUTHORITY_NODES.indexOf(node)
  );
  await equip(page, undefined);
  const success = await pressFAndWait(
    page,
    "success",
    /Harvested Farm Crop Row/i
  );
  report.interactionCases.push({
    case: "farm_no_tool_harvest",
    status: "passed",
    feedback: success,
    screenshot: await screenshot(page, "interaction-farm-no-tool-success"),
  });
}

async function proveAnyFishingRod(page) {
  const node = HARTHMERE_GATHERING_AUTHORITY_NODES.find(
    (candidate) => candidate.id === "harthmere_river_fishing_pool"
  );
  assert(node);
  const alternateRod = SNAPSHOT_FISHING_RODS[0];
  assert(alternateRod, "alternate native fishing rod missing");
  await clearGatheringDepletion(node.id);
  await visitNode(
    page,
    node,
    HARTHMERE_GATHERING_AUTHORITY_NODES.indexOf(node)
  );
  await equip(page, alternateRod.id);
  const success = await pressFAndWait(
    page,
    "success",
    /Harvested Bluewater Fishing Pool/i
  );
  report.interactionCases.push({
    case: "fishing_any_native_rod",
    status: "passed",
    rod: alternateRod.key,
    nativeRodId: String(alternateRod.id),
    feedback: success,
    screenshot: await screenshot(
      page,
      "interaction-fishing-alternate-rod-success"
    ),
  });
}

async function proveSkillRejection(page) {
  const node = HARTHMERE_GATHERING_AUTHORITY_NODES.find(
    (candidate) => candidate.requiredSkill > 1 && candidate.requiredTool
  );
  assert(node);
  await clearGatheringDepletion(node.id);
  await visitNode(
    page,
    node,
    HARTHMERE_GATHERING_AUTHORITY_NODES.indexOf(node)
  );
  await equip(page, node.requiredTool);
  const rejected = await pressFAndWait(
    page,
    "error",
    /profession is not high enough/i
  );
  report.interactionCases.push({
    case: "high_skill_rejection",
    nodeId: node.id,
    requiredSkill: node.requiredSkill,
    status: "passed",
    feedback: rejected,
    screenshot: await screenshot(page, "interaction-high-skill-rejection"),
  });
  await equip(page, undefined);
}

async function proveJobsBoard(page) {
  const board = HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS.find(
    (candidate) => candidate.boardId === "harthmere_town_market_jobs_board"
  );
  assert(board);
  const approach = [board.position.x, board.position.y, board.position.z - 2.5];
  await placePlayer(page, approach, [
    board.position.x,
    board.position.y + 3,
    board.position.z,
  ]);
  const visual = await waitFor(
    "large jobs board Blender visual",
    () =>
      page.evaluate(
        (boardId) =>
          globalThis.__harthmereJobsBoardMarkerDebug
            ?.boards()
            .find((entry) => entry.id === boardId),
        board.boardId
      ),
    (entry) =>
      entry?.visible === true &&
      entry?.activeLod === "lod0" &&
      entry?.lod0Loaded === true &&
      entry?.fallback === false
  );
  const prompt = page.getByRole("button", {
    name: `Read ${board.displayName}`,
  });
  await prompt.waitFor({ state: "visible", timeout: timeoutMs });
  assert.match(await prompt.innerText(), /F[\s\S]*Job Board/i);
  const beforeScreenshot = await screenshot(page, "jobs-board-large-f-prompt");
  const requestCountBeforeF = report.jobsBoardRequests.length;
  await page.keyboard.press("KeyF");
  const panel = page.getByTestId("harthmere-jobs-board-panel");
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  await waitFor(
    "jobs board content loaded",
    async () => ({
      text: await panel.innerText(),
      requests: report.jobsBoardRequests.length,
    }),
    (value) => /Available|My Jobs|Post Job|Safety/i.test(value.text)
  );
  await delay(500);
  assert.equal(
    report.jobsBoardRequests.length,
    Math.max(1, requestCountBeforeF),
    "opening the panel should reuse the already-loaded/in-flight jobs snapshot"
  );
  assert.equal(
    report.jobsBoardRequests.length,
    1,
    "page load plus F-open should issue exactly one jobs-board state request"
  );
  assert(
    report.jobsBoardRequests[0].durationMs < 5_000,
    `jobs-board state took ${report.jobsBoardRequests[0].durationMs}ms`
  );
  const panelScreenshot = await screenshot(
    page,
    "jobs-board-panel-loaded-after-f"
  );
  report.jobsBoard = {
    status: "passed",
    boardId: board.boardId,
    position: board.position,
    visual: visual.value,
    requestCount: report.jobsBoardRequests.length,
    requestDurationMs: report.jobsBoardRequests[0].durationMs,
    promptScreenshot: beforeScreenshot,
    panelScreenshot,
  };
  await page.getByRole("button", { name: "Close jobs board" }).click();
  await panel.waitFor({ state: "detached", timeout: timeoutMs });
}

function safeDiagnosticLabel(value) {
  return String(value)
    .replace(/[^a-z0-9_-]+/gi, "-")
    .slice(0, 90);
}

async function browserDiagnosticSnapshot(page, nodeId) {
  if (!page) return undefined;
  return page
    .evaluate((requestedNodeId) => {
      const nodeRows = globalThis.__harthmereGatheringNodeGraphics?.nodes?.();
      return {
        url: location.href,
        playerPosition:
          globalThis.__harthmereLivePlayerDebug?.getPosition?.() ?? null,
        requestedNode: requestedNodeId
          ? nodeRows?.find((entry) => entry.nodeId === requestedNodeId)
          : undefined,
        visibleNodes: nodeRows?.filter((entry) => entry.visible).slice(0, 8),
        jobsBoard: globalThis.__harthmereJobsBoardDebug
          ? {
              playerPosition:
                globalThis.__harthmereJobsBoardDebug.playerPosition,
              prompt: globalThis.__harthmereJobsBoardDebug.prompt,
            }
          : undefined,
        gatheringPrompt: document
          .querySelector(
            '[data-testid="harthmere-gathering-node-world-prompt"]'
          )
          ?.textContent?.trim(),
        buttons: [...document.querySelectorAll("button")]
          .map(
            (button) => button.getAttribute("aria-label") || button.textContent
          )
          .filter(Boolean)
          .slice(0, 24),
      };
    }, nodeId)
    .catch((error) => ({ diagnosticError: error?.message || String(error) }));
}

async function runDiagnosticStep(page, scope, id, operation, options = {}) {
  try {
    await operation();
    persistReport();
    return true;
  } catch (error) {
    const failure = {
      scope,
      id,
      status: "failed",
      error: error?.stack || String(error),
      diagnostic: await browserDiagnosticSnapshot(page, options.nodeId),
    };
    try {
      failure.screenshot = await screenshot(
        page,
        `failure-${safeDiagnosticLabel(scope)}-${safeDiagnosticLabel(id)}`
      );
    } catch {}
    report.diagnosticFailures.push(failure);
    if (scope === "jobs-board") {
      report.jobsBoard = { status: "failed", failure };
    } else if (scope === "interaction") {
      report.interactionCases.push({ case: id, status: "failed", failure });
    } else if (scope === "node") {
      report.nodes = report.nodes.filter((row) => row.nodeId !== id);
      report.nodes.push({
        nodeId: id,
        name: options.node?.name,
        profession: options.node?.profession,
        requiredTool: options.node?.requiredTool,
        requiredSkill: options.node?.requiredSkill,
        position: options.node ? [...options.node.position] : undefined,
        status: "failed",
        failure,
      });
    }
    persistReport();
    console.error(`FAIL ${scope} ${id}: ${error?.message || error}`);
    return false;
  }
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  browserRuntimeLease = acquireBrowserRuntimeLease({
    runner: "harthmere-world-interaction-live-browser",
    runId,
    baseUrl,
    syncBaseUrl,
    stackContainer,
    redisContainer,
  });
  report.browserRuntimeLane = browserRuntimeLease.laneId;
  lifecyclePreflight();
  const browser = await chromium.launch({
    headless: process.env.HARTHMERE_E2E_HEADLESS !== "0",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  let actor;
  try {
    actor = await openActor(browser);
    if (!orchardOnly && report.jobsBoard.status !== "passed") {
      await runDiagnosticStep(
        actor.page,
        "jobs-board",
        "harthmere_town_market_jobs_board",
        () => proveJobsBoard(actor.page)
      );
    }

    if (
      !report.interactionCases.some(
        (entry) => entry.case === "orchard_native_axe_harvest_drop_pickup"
      )
    ) {
      await runDiagnosticStep(
        actor.page,
        "interaction",
        "orchard_interaction_batch",
        () => proveToolRejectionAndHarvest(actor.page),
        { nodeId: "harthmere_orchard_softwood" }
      );
    }
    if (
      !orchardOnly &&
      !report.interactionCases.some(
        (entry) => entry.case === "farm_no_tool_harvest"
      )
    ) {
      await runDiagnosticStep(
        actor.page,
        "interaction",
        "farm_no_tool_harvest",
        () => proveNoToolHarvest(actor.page),
        { nodeId: "harthmere_farm_crops" }
      );
    }
    if (
      !orchardOnly &&
      !report.interactionCases.some(
        (entry) => entry.case === "fishing_any_native_rod"
      )
    ) {
      await runDiagnosticStep(
        actor.page,
        "interaction",
        "fishing_any_native_rod",
        () => proveAnyFishingRod(actor.page),
        { nodeId: "harthmere_river_fishing_pool" }
      );
    }
    if (
      !orchardOnly &&
      !report.interactionCases.some(
        (entry) => entry.case === "high_skill_rejection"
      )
    ) {
      await runDiagnosticStep(
        actor.page,
        "interaction",
        "high_skill_rejection",
        () => proveSkillRejection(actor.page),
        { nodeId: "harthmere_river_clay" }
      );
    }
    await runDiagnosticStep(actor.page, "cleanup", "clear-active-tool", () =>
      equip(actor.page, undefined)
    );

    if (!orchardOnly) {
      for (
        let index = 0;
        index < HARTHMERE_GATHERING_AUTHORITY_NODES.length;
        index += 1
      ) {
        const node = HARTHMERE_GATHERING_AUTHORITY_NODES[index];
        if (
          !report.nodes.some(
            (row) => row.nodeId === node.id && row.status === "passed"
          )
        ) {
          await runDiagnosticStep(
            actor.page,
            "node",
            node.id,
            () => visitNode(actor.page, node, index),
            { nodeId: node.id, node }
          );
        }
        persistReport();
      }
    }

    const requiredInteractionCases = orchardOnly
      ? [
          "orchard_missing_axe",
          "orchard_native_axe_harvest_drop_pickup",
          "orchard_depleted",
        ]
      : [
          "orchard_missing_axe",
          "orchard_native_axe_harvest_drop_pickup",
          "orchard_depleted",
          "farm_no_tool_harvest",
          "fishing_any_native_rod",
          "high_skill_rejection",
        ];
    const passedInteractionCases = new Set(
      report.interactionCases
        .filter((entry) => entry.status === "passed")
        .map((entry) => entry.case)
    );
    const passedNodeIds = new Set(
      report.nodes
        .filter((row) => row.status === "passed")
        .map((row) => row.nodeId)
    );
    const acceptanceFailures = [];
    if (!orchardOnly && report.jobsBoard.status !== "passed") {
      acceptanceFailures.push("jobs_board");
    }
    for (const interactionCase of requiredInteractionCases) {
      if (!passedInteractionCases.has(interactionCase)) {
        acceptanceFailures.push(`interaction:${interactionCase}`);
      }
    }
    if (!orchardOnly) {
      for (const node of HARTHMERE_GATHERING_AUTHORITY_NODES) {
        if (!passedNodeIds.has(node.id)) {
          acceptanceFailures.push(`node:${node.id}`);
        }
      }
    }
    for (const browserFailure of report.browserFailures) {
      acceptanceFailures.push(`browser:${browserFailure}`);
    }
    report.acceptanceFailures = acceptanceFailures;
    report.status = acceptanceFailures.length ? "failed" : "passed";
    if (acceptanceFailures.length) {
      report.failures.push(
        `Batch completed with ${acceptanceFailures.length} acceptance failures: ${acceptanceFailures.join(", ")}`
      );
    }
  } catch (error) {
    report.status = "failed";
    report.failures.push(error?.stack || String(error));
    try {
      await screenshot(actor?.page, "failure");
    } catch {}
    report.catastrophicFailure = true;
  } finally {
    report.finishedAt = new Date().toISOString();
    persistReport();
    await actor?.context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
  console.log(
    JSON.stringify(
      {
        ok: report.status === "passed",
        reportPath,
        nodeRows: report.nodes.length,
        interactionCases: report.interactionCases.length,
        jobsBoardRequests: report.jobsBoardRequests,
        screenshots: report.screenshots.length,
      },
      null,
      2
    )
  );
  if (report.status !== "passed") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
}).finally(() => browserRuntimeLease?.release());
