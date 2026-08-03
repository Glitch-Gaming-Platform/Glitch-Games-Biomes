#!/usr/bin/env node
"use strict";

/**
 * One-browser, one-warm-world acceptance for every Harthmere business.
 *
 * This runner does not build, replace, or restart the supplied stack. It uses
 * the real frontend adapter to start/serve/end a shift and limits the native
 * E2E bridge to fixture placement plus authoritative ECS observation.
 */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { chromium } = require("playwright");
const {
  Health,
  Orientation,
  Position,
} = require("../../src/shared/ecs/gen/components");
const { MoveEvent } = require("../../src/shared/ecs/gen/events");
const {
  EntitySerde,
  EventSerde,
  SerializeForServer,
} = require("../../src/shared/ecs/gen/json_serde");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
const {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessCustomerDeparturePoint,
  harthmereBusinessInteriorInteractionPoints,
} = require("../../src/shared/harthmere/business_interior_runtime");
const {
  HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS,
} = require("../../src/shared/harthmere/business_interior_collision_seed");
const {
  harthmereBusinessCraftingStationSeedByOutpost,
} = require("../../src/shared/harthmere/business_crafting_station_seed");
const {
  HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS,
  harthmereBusinessOutpostBusinessId,
} = require("../../src/shared/harthmere/business_customer_simulator");
const { deserializeNpcCustomState } = require("../../src/shared/npc/serde");

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
const animaContainer = process.env.HARTHMERE_E2E_ANIMA_CONTAINER || "";
const animaReadyPort = Number(
  process.env.HARTHMERE_E2E_ANIMA_READY_PORT || 4901
);
const expectedAnimaImageId = process.env.HARTHMERE_E2E_ANIMA_IMAGE_ID || "";
const redisHost = process.env.HARTHMERE_E2E_REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.HARTHMERE_E2E_REDIS_PORT || 6493);
const expectedImageId = process.env.HARTHMERE_E2E_IMAGE_ID || "";
const expectedBuildId = process.env.HARTHMERE_E2E_BUILD_ID || "";
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const actorId = Number(
  process.env.HARTHMERE_BUSINESS_E2E_ACTOR || 8_812_000_000_099_801
);
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120_000);
const selectedOutposts = new Set(
  String(process.env.HARTHMERE_BUSINESS_E2E_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const rows = HARTHMERE_BUSINESS_INTERIORS.filter(
  (row) => selectedOutposts.size === 0 || selectedOutposts.has(row.outpostId)
);
const runId = `${Date.now()}-${process.pid}`;
const artifactsDir = path.resolve(
  process.env.HARTHMERE_E2E_ARTIFACTS_DIR ||
    path.join(root, "artifacts/harthmere-business-live-browser")
);
const reportPath = path.join(artifactsDir, `${runId}-report.json`);
const report = {
  version: "harthmere-business-live-browser-v1",
  runId,
  baseUrl,
  syncBaseUrl,
  stackContainer,
  redisContainer,
  animaContainer,
  expectedImageId,
  expectedAnimaImageId,
  expectedBuildId,
  actorId,
  selectedOutposts: [...selectedOutposts],
  startedAt: new Date().toISOString(),
  lifecycle: {},
  rows: [],
  failures: [],
  browserFailures: [],
};

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

function commandCombined(program, args, options = {}) {
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
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
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

function inspect(container, template) {
  return command("docker", ["inspect", "-f", template, container]);
}

function assertContainerHealthy(container) {
  assert.equal(inspect(container, "{{.State.Status}}"), "running");
  assert.equal(
    inspect(container, "{{.RestartCount}}"),
    "0",
    `${container} must have RestartCount=0`
  );
  assert.equal(
    inspect(container, "{{.State.OOMKilled}}"),
    "false",
    `${container} must have OOMKilled=false`
  );
}

function lifecyclePreflight() {
  assert(controlToken, "HARTHMERE_E2E_CONTROL_TOKEN is required");
  assert(expectedImageId, "HARTHMERE_E2E_IMAGE_ID is required");
  assert(expectedBuildId, "HARTHMERE_E2E_BUILD_ID is required");
  assert(
    animaContainer,
    "HARTHMERE_E2E_ANIMA_CONTAINER is required for native customer movement"
  );
  assert(Number.isSafeInteger(actorId) && actorId > 0, "actor must be numeric");
  assert.equal(rows.length > 0, true, "No business rows selected");
  assertContainerHealthy(stackContainer);
  assertContainerHealthy(redisContainer);
  assertContainerHealthy(animaContainer);
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
  const actualAnimaImageId = inspect(animaContainer, "{{.Image}}");
  if (expectedAnimaImageId) {
    assert.equal(
      actualAnimaImageId,
      expectedAnimaImageId,
      "Unexpected Anima image"
    );
  }
  assert.equal(
    command("docker", [
      "exec",
      animaContainer,
      "/bin/sh",
      "-lc",
      'test "${ANIMA_HFC_WRITES:-0}" = "1" && printf OK',
    ]),
    "OK",
    "Anima must publish native ECS changes through HFC"
  );
  const animaReady = command("docker", [
    "exec",
    animaContainer,
    "/bin/sh",
    "-lc",
    `curl -fsS http://127.0.0.1:${animaReadyPort}/ready`,
  ]);
  assert.equal(animaReady, "OK", "Anima must answer ready before testing");
  const animaStartedAt = inspect(animaContainer, "{{.State.StartedAt}}");
  const animaLifecycle = commandCombined("docker", [
    "logs",
    "--since",
    animaStartedAt,
    animaContainer,
  ]);
  assert(
    animaLifecycle.includes("HFC Bootstrap complete"),
    "Anima HFC bootstrap must complete before testing"
  );
  assert.equal(
    command("docker", [
      "exec",
      stackContainer,
      "printenv",
      "HARTHMERE_NATIVE_ECS_E2E",
    ]),
    "1"
  );
  assert.equal(
    command("docker", [
      "exec",
      stackContainer,
      "printenv",
      "GLITCH_FOCUSED_NATIVE_E2E_STACK",
    ]),
    "1"
  );
  const pong = command("redis-cli", [
    "-h",
    redisHost,
    "-p",
    String(redisPort),
    "--raw",
    "PING",
  ]);
  assert.equal(pong, "PONG", "Redis must answer literal PONG");
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
  const readyEnv = {
    ...process.env,
    HARTHMERE_E2E_URL: baseUrl,
    HARTHMERE_E2E_WEB_PORT: String(new URL(baseUrl).port || 80),
    HARTHMERE_E2E_SYNC_BASE_URL: syncBaseUrl,
    HARTHMERE_E2E_SYNC_PORT: String(new URL(syncBaseUrl).port || 80),
    HARTHMERE_E2E_REDIS_PORT: String(redisPort),
    HARTHMERE_E2E_STACK_CONTAINER: stackContainer,
  };
  command(process.execPath, ["scripts/harthmere/e2e-jump.cjs", "ready"], {
    timeout: timeoutMs,
    env: readyEnv,
  });
  report.lifecycle = {
    actualImageId,
    actualAnimaImageId,
    actualBuildId,
    configuredBuildId,
    animaReady,
    animaHfcBootstrapComplete: true,
    redisPong: pong,
    redisDbsize: dbsize,
    appRestartCount: 0,
    appOomKilled: false,
    redisRestartCount: 0,
    redisOomKilled: false,
    animaRestartCount: 0,
    animaOomKilled: false,
  };
}

function gameUrl() {
  const url = new URL("/at", baseUrl);
  url.searchParams.set("syncBaseUrl", syncBaseUrl);
  url.searchParams.set("harthmere_native_ecs_e2e", "1");
  url.searchParams.set("glitch_auto_play", "1");
  url.searchParams.set("lowMemory", "1");
  url.searchParams.set("resourceCapacityScale", "0.25");
  url.searchParams.set("forceDrawDistance", "32");
  url.searchParams.set("forceRenderScale", "0.5");
  url.searchParams.set("forceGraphicsQuality", "low");
  url.searchParams.set("e2e_run", runId);
  return url.toString();
}

function isIgnoredBrowserNoise(text, source = "") {
  return /chrome-extension:\/\/|twitch\.tv|ttvnw\.net|jtvnw\.net|googlevideo\.com|ERR_ABORTED|MasterPlaylist|no supported source|bluetooth is not allowed/i.test(
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
  const auth = await authResponse.json();
  assert.equal(Number(auth.userId), actorId);
  assert.equal(auth.e2eAdmin, true);
  const page = await context.newPage();
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
      globalThis.__harthmereBusinessInteriors?.version ===
      "harthmere-business-interior-combined-lod-v1",
    undefined,
    { timeout: timeoutMs }
  );
  await page.evaluate(() => globalThis.__harthmereBusinessInteriors.ready());
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
    "Enter Game safety modal must close before business input"
  );
}

async function placePlayer(page, position) {
  const current = await authoritativeEntity(page, actorId);
  const maxHp = Math.max(1, current?.health?.maxHp ?? 100);
  const liveTeleport = await page.evaluate(
    ({ id, position }) => {
      const teleport = globalThis.__harthmereLivePlayerDebug?.teleportTo;
      const result =
        typeof teleport === "function"
          ? teleport({
              x: position[0],
              y: position[1],
              z: position[2],
              name: "businessCustomerE2E",
              reason: "Stream the authoritative business interior district",
            })
          : undefined;
      const resources = globalThis.clientContext?.resources;
      if (!resources) throw new Error("client resources unavailable");
      resources.update("/sim/player", id, (player) => {
        player.position = [...position];
        player.orientation = [0, 0];
        player.velocity = [0, 0, 0];
      });
      resources.update("/scene/local_player", (localPlayer) => {
        localPlayer.player.position = [...position];
        localPlayer.player.orientation = [0, 0];
        localPlayer.player.velocity = [0, 0, 0];
      });
      return result;
    },
    { id: actorId, position }
  );
  if (liveTeleport) {
    assert.equal(
      liveTeleport.teleported,
      true,
      `live player did not stream business ${position.join(",")}`
    );
  }
  await applyChanges(page, {
    kind: "update",
    entity: {
      id: actorId,
      position: Position.create({ v: [...position] }),
      orientation: Orientation.create({ v: [0, 0] }),
      health: Health.create({ hp: maxHp, maxHp }),
      death_info: null,
      iced: null,
    },
  });
  await publish(
    page,
    new MoveEvent({
      id: actorId,
      position: [...position],
      orientation: [0, 0],
      velocity: [0, 0, 0],
    })
  );
  await delay(300);
  await dismissEnterGame(page);
}

async function authoritativeEntity(page, id) {
  const rows = await bridgeCall(page, "getAuthoritative", [id]);
  const serialized = rows?.[0]?.[1];
  return serialized ? EntitySerde.deserialize(serialized, false) : undefined;
}

async function authoritativeEntities(page, ids) {
  const rows = await bridgeCall(page, "getAuthoritative", ids);
  return new Map(
    (rows ?? [])
      .map((row, offset) => [ids[offset], row?.[1]])
      .filter(([, serialized]) => serialized)
      .map(([id, serialized]) => [
        Number(id),
        EntitySerde.deserialize(serialized, false),
      ])
  );
}

function customerState(entity) {
  if (!entity?.npc_state?.data) return undefined;
  return deserializeNpcCustomState(entity.npc_state.data).businessCustomer;
}

async function economyState(page) {
  const body = await page.evaluate(async () => {
    const response = await fetch("/api/harthmere/live_mode_economy_state", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`business_economy_state_http_${response.status}`);
    }
    return await response.json();
  });
  return body.economyState ?? body;
}

async function submitCleanupMutation(page, operation, payload) {
  return page.evaluate(
    async ({ operation, payload }) => {
      const requestId = `business_e2e_cleanup_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      const response = await fetch("/api/harthmere/live_mode", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          requestId,
          idempotencyKey: requestId,
          actionKind: "request_economy_mutation",
          subsystem: "economy",
          clientSentAtMs: Date.now(),
          actorEntityVersion: 1,
          zoneId: "the_grove",
          payload: { operation, ...payload },
          includeSnapshots: ["economyState"],
        }),
      });
      const body = await response.json();
      const backendRejection = body.backendMutation?.warnings?.find(
        (warning) => String(warning).startsWith("economy_rejected:")
      );
      if (!response.ok || body.ok === false || backendRejection) {
        throw new Error(
          backendRejection ??
          body.validation?.errors?.[0] ??
            body.warnings?.[0] ??
            `business_cleanup_http_${response.status}`
        );
      }
      return body;
    },
    { operation, payload }
  );
}

async function cleanupActorBusinessSessions(page, onlyBusinessId) {
  const state = await economyState(page);
  const sessions = Object.values(
    state?.businessSystems?.customerSessions ?? {}
  ).filter(
    (session) =>
      session.status === "active" &&
      String(session.actorId) === String(actorId) &&
      (!onlyBusinessId || session.businessId === onlyBusinessId)
  );
  for (const session of sessions) {
    const record = HARTHMERE_BUSINESS_INTERIORS.find(
      (candidate) =>
        harthmereBusinessOutpostBusinessId(candidate.outpostId) ===
        session.businessId
    );
    assert.ok(
      record,
      `Cannot clean unknown business session ${session.businessId}`
    );
    await placePlayer(
      page,
      harthmereBusinessInteriorInteractionPoints(record).staff
    );
    await submitCleanupMutation(page, "end_business_customer_session", {
      businessId: session.businessId,
      sessionId: session.sessionId,
    });
  }
  if (sessions.length > 0) {
    await waitFor(
      `cleanup ${sessions.length} retained business sessions`,
      () => economyState(page),
      (next) =>
        !Object.values(next?.businessSystems?.customerSessions ?? {}).some(
          (session) =>
            session.status === "active" &&
            String(session.actorId) === String(actorId) &&
            (!onlyBusinessId || session.businessId === onlyBusinessId)
        )
    );
  }
  return sessions.map((session) => session.sessionId);
}

function activeSessionForBusiness(state, businessId) {
  return Object.values(state?.businessSystems?.customerSessions ?? {}).find(
    (session) =>
      session.businessId === businessId && session.status === "active"
  );
}

function currentSessionTicket(session) {
  if (!session) return undefined;
  const served = new Set(session.servedTicketIds ?? []);
  const failed = new Set(session.failedTicketIds ?? []);
  return (session.queue ?? []).find(
    (ticket) => !served.has(ticket.ticketId) && !failed.has(ticket.ticketId)
  );
}

async function waitFor(label, probe, predicate, timeout = timeoutMs) {
  const start = Date.now();
  let last;
  let lastError;
  while (Date.now() - start < timeout) {
    try {
      last = await probe();
      if (await predicate(last)) {
        return { value: last, elapsedMs: Date.now() - start };
      }
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

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function screenshot(page, row, stage) {
  const file = path.join(
    artifactsDir,
    `${String(row.index + 1).padStart(2, "0")}-${row.record.outpostId}-${stage}.png`
  );
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function closeBusinessPanel(page) {
  const close = page.getByRole("button", {
    name: "Close business interface",
  });
  if (await close.count()) await close.click();
}

async function runBusiness(page, record, index) {
  const businessId = harthmereBusinessOutpostBusinessId(record.outpostId);
  const points = harthmereBusinessInteriorInteractionPoints(record);
  const departure = harthmereBusinessCustomerDeparturePoint(record, 0);
  const result = {
    index,
    outpostId: record.outpostId,
    businessType: record.businessType,
    businessId,
    displayName: record.displayName,
    origin: record.assetWorldAnchor,
    desk: record.deskWorldPivot,
    staff: points.staff,
    customer: points.customer,
    departure,
    fixtureCount: record.fixtures.length,
    collisionCount: record.collisionBoxes.length,
    floors: record.footprint.floors,
    phases: [],
    screenshots: [],
  };
  const indexed = { record, index };
  await closeBusinessPanel(page);
  await placePlayer(page, points.staff);
  const activeBoard = await waitFor(
    `${record.outpostId} active counter`,
    () => page.evaluate(() => globalThis.__harthmereBusinessBoardDebug),
    (debug) => debug?.activeBoard?.outpostId === record.outpostId
  );
  assert.equal(activeBoard.value.activeBoard.businessId, businessId);
  const interior = await waitFor(
    `${record.outpostId} combined interior`,
    () =>
      page.evaluate((outpostId) => {
        const bridge = globalThis.__harthmereBusinessInteriors;
        return bridge
          ?.interiors()
          .find((entry) => entry.outpostId === outpostId);
      }, record.outpostId),
    (entry) => entry?.activeLod === "lod0" && entry?.lod0Visible === true
  );
  assert.deepEqual(interior.value.origin, record.assetWorldAnchor);
  assert.deepEqual(interior.value.desk, record.deskWorldPivot);
  assert.deepEqual(interior.value.footprint, record.footprint);
  for (const [lod, bounds] of [
    ["lod0", interior.value.lod0WorldBounds],
    ["lod1", interior.value.lod1WorldBounds],
  ]) {
    assert.ok(bounds, `${record.outpostId} ${lod} world bounds missing`);
    assert.ok(
      bounds.min[0] >= record.assetWorldAnchor[0] - 0.1,
      `${record.outpostId} ${lod} furniture escaped west of the building`
    );
    assert.ok(
      bounds.max[0] <=
        record.assetWorldAnchor[0] + record.footprint.width + 0.1,
      `${record.outpostId} ${lod} furniture escaped east of the building`
    );
    assert.ok(
      bounds.min[2] >= record.assetWorldAnchor[2] - 0.1,
      `${record.outpostId} ${lod} furniture escaped in front of the building`
    );
    assert.ok(
      bounds.max[2] <=
        record.assetWorldAnchor[2] + record.footprint.depth + 0.1,
      `${record.outpostId} ${lod} furniture escaped behind the building`
    );
    assert.ok(
      bounds.min[1] >= record.assetWorldAnchor[1] - 0.1,
      `${record.outpostId} ${lod} furniture fell below the floor`
    );
    assert.ok(
      bounds.max[1] <=
        record.assetWorldAnchor[1] + record.footprint.floors * 4 + 0.1,
      `${record.outpostId} ${lod} furniture escaped above the authored floors`
    );
  }
  assert.equal(interior.value.fixtureCount, record.fixtures.length);
  assert.equal(interior.value.collisionCount, record.collisionBoxes.length);

  const collisionSeeds = HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.filter(
    (seed) => seed.outpostId === record.outpostId
  );
  const collisionEntities = await authoritativeEntities(
    page,
    collisionSeeds.map((seed) => seed.entityId)
  );
  assert.equal(
    collisionEntities.size,
    collisionSeeds.length,
    `${record.outpostId} must materialize every manifest collision proxy`
  );
  for (const seed of collisionSeeds) {
    const proxy = collisionEntities.get(Number(seed.entityId));
    assert.ok(proxy?.collideable, `${seed.collisionSeedId} is not collidable`);
    assert.deepEqual(proxy?.position?.v, seed.position);
    assert.deepEqual(proxy?.size?.v, seed.size);
    assert.equal(proxy?.placeable_component, undefined);
    assert.equal(proxy?.npc_metadata, undefined);
  }
  result.nativeCollisionProxyCount = collisionEntities.size;

  const stationSeed = harthmereBusinessCraftingStationSeedByOutpost(
    record.outpostId
  );
  assert.ok(stationSeed, `${record.outpostId} crafting anchor missing`);
  const stationEntity = await authoritativeEntity(page, stationSeed.entityId);
  assert.deepEqual(stationEntity?.position?.v, stationSeed.position);
  assert.ok(stationEntity?.placeable_component);
  assert.ok(stationEntity?.crafting_station_component);
  assert.equal(
    stationEntity?.collideable,
    undefined,
    `${record.outpostId} visible machine collision must not be duplicated`
  );
  result.craftingInteractionAnchorId = Number(stationSeed.entityId);
  result.screenshots.push(await screenshot(page, indexed, "interior"));

  const retainedEnd = page.getByRole("button", { name: "End shift" });
  if ((await retainedEnd.count()) === 1) {
    await dismissEnterGame(page);
    // This is cleanup for a retained prior run, not the product action under
    // test. World streaming can temporarily leave the loading layer above the
    // already-rendered HUD button, so invoke the same DOM action directly and
    // reserve pointer-action validation for the new shift below.
    await retainedEnd.evaluate((button) => button.click());
    await page.waitForSelector(
      '[data-harthmere-business-shift-status="true"]',
      { state: "detached", timeout: timeoutMs }
    );
  }

  // Re-acquire the station immediately before opening it. The board component
  // intentionally unmounts when streaming briefly loses the local-player
  // position, so retaining an earlier debug object and calling it much later
  // turns an otherwise valid row into `undefined.open` harness noise.
  await placePlayer(page, points.staff);
  await waitFor(
    `${record.outpostId} atomic counter open`,
    () =>
      page.evaluate((outpostId) => {
        const debug = globalThis.__harthmereBusinessBoardDebug;
        if (debug?.activeBoard?.outpostId !== outpostId) return false;
        debug.open();
        return true;
      }, record.outpostId),
    Boolean
  );
  await page.waitForSelector(
    `[data-harthmere-business-interface="true"][data-business-id="${businessId}"]`,
    { timeout: timeoutMs }
  );
  const inWorldShift = page.getByRole("button", { name: "In-World Shift" });
  assert.equal(
    await inWorldShift.count(),
    1,
    "In-world shift tab must be unique"
  );
  await inWorldShift.click();
  assert.equal(
    await page.locator('[data-business-minigame-arena="true"]').count(),
    0,
    "Detached customer card arena must remain retired"
  );
  const start = page.getByRole("button", { name: "Start shift at counter" });
  assert.equal(await start.count(), 1, "Start shift control must be unique");
  result.screenshots.push(await screenshot(page, indexed, "shift-control"));
  await start.click();
  await page.waitForSelector('[data-harthmere-business-shift-status="true"]', {
    timeout: timeoutMs,
  });
  await closeBusinessPanel(page);
  result.screenshots.push(
    await screenshot(page, indexed, "shift-started-behind-counter")
  );

  const serving = await waitFor(
    `${record.outpostId} native customer serving`,
    async () => {
      const state = await economyState(page);
      const session = activeSessionForBusiness(state, businessId);
      const ticket = currentSessionTicket(session);
      const entity = ticket?.entityId
        ? await authoritativeEntity(page, ticket.entityId)
        : undefined;
      return { session, ticket, entity, customer: customerState(entity) };
    },
    (value) =>
      value?.customer?.phase === "serving" &&
      Number.isSafeInteger(value?.ticket?.entityId)
  );
  const {
    session,
    ticket,
    entity: servingEntity,
    customer: servingState,
  } = serving.value;
  const entityId = ticket.entityId;
  result.sessionId = session.sessionId;
  result.ticketId = ticket.ticketId;
  result.entityId = entityId;
  result.correctOfferId = ticket.requestedOfferId;
  result.phases.push("serving");
  assert.equal(servingState?.phase, "serving");
  assert.equal(servingState?.sessionId, session.sessionId);
  assert(
    distance(servingEntity.position.v, points.customer) <= 1.75,
    "Customer must physically reach the audited counter point"
  );
  result.screenshots.push(
    await screenshot(page, indexed, "customer-at-counter")
  );

  const definition =
    HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS[record.businessType];
  const offerIndex = definition.offers.findIndex(
    (candidate) => candidate.offerId === ticket.requestedOfferId
  );
  assert(
    offerIndex >= 0,
    "Requested offer must exist in the business definition"
  );
  const offerDefinition = definition.offers[offerIndex];
  // Use the actual NPC talk surface. The production HAR showed the shift start
  // succeeded but talking to the customer displayed ambient Chit Chat choices,
  // so no serve_business_customer mutation was ever sent. Opening the same
  // game modal as the native F interaction lets the screenshot prove the
  // active ticket overrides ordinary dialogue before the service click.
  await page.evaluate((talkingToNPCId) => {
    const resources = globalThis.clientContext?.reactResources;
    if (!resources) throw new Error("client react resources unavailable");
    resources.set("/game_modal", { kind: "talk_to_npc", talkingToNPCId });
  }, entityId);
  await page.waitForSelector('[data-harthmere-business-customer-talk="true"]', {
    timeout: timeoutMs,
  });
  assert.equal(
    await page.getByRole("button", { name: "Chit Chat" }).count(),
    0,
    "Active customer must not show ordinary Chit Chat"
  );
  assert.equal(
    await page.getByRole("button", { name: "Ask about this place" }).count(),
    0,
    "Active customer must not show ordinary place dialogue"
  );
  for (const definedOffer of definition.offers) {
    assert.equal(
      await page.getByRole("button", { name: definedOffer.label }).count(),
      1,
      `${definedOffer.label} must appear exactly once in customer talk`
    );
  }
  result.screenshots.push(
    await screenshot(page, indexed, "customer-talk-service-options")
  );
  const offer = page.getByRole("button", { name: offerDefinition.label });
  assert.equal(await offer.count(), 1, "Correct talk offer must be unique");
  await offer.click();
  await page.waitForSelector('[data-harthmere-business-customer-talk="true"]', {
    state: "detached",
    timeout: timeoutMs,
  });
  const committed = await waitFor(
    `${record.outpostId} authoritative service commit`,
    async () => {
      const state = await economyState(page);
      return activeSessionForBusiness(state, businessId);
    },
    (nextSession) => nextSession?.servedTicketIds?.includes(ticket.ticketId)
  );
  result.committedServedCount = committed.value.servedTicketIds.length;

  const reacted = await waitFor(
    `${record.outpostId} visible service outcome`,
    async () => {
      const entity = await authoritativeEntity(page, entityId);
      return { entity, state: customerState(entity) };
    },
    (value) =>
      value?.state?.reaction === "success" ||
      value?.state?.reaction === "payment"
  );
  assert.ok(reacted.value.entity, "Customer must remain visible for reaction");
  result.phases.push(reacted.value.state.phase);
  result.screenshots.push(
    await screenshot(page, indexed, "authoritative-service-outcome")
  );

  let lastPosition = servingEntity.position.v;
  let sawReaction = false;
  const departed = await waitFor(
    `${record.outpostId} native departure and safe despawn`,
    async () => {
      const entity = await authoritativeEntity(page, entityId);
      if (!entity) return { removed: true, lastPosition };
      const state = customerState(entity);
      lastPosition = entity.position?.v ?? lastPosition;
      if (state?.reaction === "success" || state?.reaction === "payment") {
        sawReaction = true;
      }
      if (state?.phase && !result.phases.includes(state.phase)) {
        result.phases.push(state.phase);
      }
      return { removed: false, state, position: lastPosition };
    },
    (value) => value.removed === true,
    timeoutMs * 2
  );
  assert.equal(sawReaction, true, "Customer must visibly react to success");
  assert(
    distance(departed.value.lastPosition, departure) <= 1.25,
    "Customer must reach the authored departure point before despawn"
  );
  assert(
    distance(departed.value.lastPosition, points.staff) >= 27,
    "Customer must be safely outside the building before despawn"
  );
  result.safeDespawnPosition = departed.value.lastPosition;
  result.safeDespawnDistance = distance(
    departed.value.lastPosition,
    points.staff
  );
  result.screenshots.push(await screenshot(page, indexed, "departed"));

  const nextServing = await waitFor(
    `${record.outpostId} queue advance`,
    async () => {
      const state = await economyState(page);
      const nextSession = activeSessionForBusiness(state, businessId);
      const nextTicket = currentSessionTicket(nextSession);
      const nextEntity = nextTicket?.entityId
        ? await authoritativeEntity(page, nextTicket.entityId)
        : undefined;
      return {
        session: nextSession,
        ticket: nextTicket,
        customer: customerState(nextEntity),
      };
    },
    (next) =>
      next?.ticket?.entityId !== entityId && next?.customer?.phase === "serving"
  );
  result.nextEntityId = nextServing.value.ticket.entityId;
  result.queueAdvanced = true;
  result.screenshots.push(await screenshot(page, indexed, "queue-advanced"));

  const endShift = page.getByRole("button", { name: "End shift" });
  assert.equal(
    await endShift.count(),
    1,
    "HUD end-shift action must be unique"
  );
  await endShift.click();
  await page.waitForSelector('[data-harthmere-business-shift-status="true"]', {
    state: "detached",
    timeout: timeoutMs,
  });
  await waitFor(
    `${record.outpostId} authoritative shift end`,
    () => economyState(page),
    (state) => !activeSessionForBusiness(state, businessId)
  );
  result.status = "passed";
  return result;
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  lifecyclePreflight();
  const browser = await chromium.launch({
    headless: process.env.HARTHMERE_E2E_HEADLESS !== "0",
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
  let actor;
  try {
    actor = await openActor(browser);
    report.retainedSessionCleanup = await cleanupActorBusinessSessions(
      actor.page
    );
    persistReport();
    const loaded = await actor.page.evaluate(() => ({
      expected: globalThis.__harthmereBusinessInteriors.expectedCount,
      count: globalThis.__harthmereBusinessInteriors.interiors().length,
    }));
    assert.deepEqual(loaded, { expected: 19, count: 19 });
    for (let index = 0; index < rows.length; index += 1) {
      const record = rows[index];
      try {
        const result = await runBusiness(actor.page, record, index);
        report.rows.push(result);
        console.log(
          `PASS ${index + 1}/${rows.length} ${record.outpostId} ` +
            `safe=${result.safeDespawnDistance.toFixed(1)}m`
        );
      } catch (error) {
        const failure = {
          index,
          outpostId: record.outpostId,
          error: error?.stack || String(error),
        };
        report.failures.push(failure);
        try {
          failure.screenshot = await screenshot(
            actor.page,
            { record, index },
            "failure"
          );
        } catch {}
        console.error(`FAIL ${record.outpostId}: ${error?.stack || error}`);
        await closeBusinessPanel(actor.page).catch(() => undefined);
        failure.sessionCleanup = await cleanupActorBusinessSessions(
          actor.page,
          harthmereBusinessOutpostBusinessId(record.outpostId)
        ).catch((cleanupError) => {
          failure.cleanupError = cleanupError?.stack || String(cleanupError);
          return [];
        });
      } finally {
        persistReport();
      }
    }
  } finally {
    await actor?.context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
  assertContainerHealthy(stackContainer);
  assertContainerHealthy(redisContainer);
  assertContainerHealthy(animaContainer);
  assert.equal(
    command("docker", [
      "exec",
      animaContainer,
      "/bin/sh",
      "-lc",
      `curl -fsS http://127.0.0.1:${animaReadyPort}/ready`,
    ]),
    "OK"
  );
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
  report.finishedAt = new Date().toISOString();
  report.passed = report.rows.filter((row) => row.status === "passed").length;
  persistReport();
  assert.equal(
    report.failures.length,
    0,
    `${report.failures.length} business browser rows failed; see ${reportPath}`
  );
  assert.equal(report.passed, rows.length);
  assert.equal(
    report.browserFailures.length,
    0,
    `Unexpected browser errors: ${report.browserFailures.join("\n")}`
  );
  console.log(`PASS ${report.passed}/${rows.length} Harthmere businesses`);
  console.log(`REPORT ${reportPath}`);
}

main().catch((error) => {
  report.finishedAt = new Date().toISOString();
  report.fatal = error?.stack || String(error);
  persistReport();
  console.error(error?.stack || error);
  process.exitCode = 1;
});
