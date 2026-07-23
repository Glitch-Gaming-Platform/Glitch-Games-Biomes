#!/usr/bin/env node
"use strict";

/*
 * Production-shaped browser -> logic -> native ECS -> sync E2E.
 *
 * This runner intentionally uses the real browser event queue for gameplay and
 * existing admin APIs only for deterministic fixture setup/readback. A passing
 * HTTP response, debug global, or localStorage mutation is never considered a
 * gameplay success without authoritative ECS and synchronized-client evidence.
 */
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const {
  Acquisition,
  ContainerInventory,
  CreatedBy,
  EntityDescription,
  Expires,
  FarmingPlantComponent,
  GrabBag,
  Health,
  Inventory,
  Label,
  LooseItem,
  NpcMetadata,
  NpcState,
  Position,
  QuestGiver,
  RigidBody,
  SelectedItem,
  Size,
  TriggerState,
  Wearing,
} = require("../../src/shared/ecs/gen/components");
const {
  ConsumptionEvent,
  HarvestPlantEvent,
  InventorySwapEvent,
  InventoryThrowEvent,
  PickUpEvent,
  PlantSeedEvent,
  PokePlantEvent,
  TillSoilEvent,
  UpdateNpcHealthEvent,
  UpdatePlayerHealthEvent,
  WaterPlantsEvent,
} = require("../../src/shared/ecs/gen/events");
const {
  EntitySerde,
  EventSerde,
  SerializeForServer,
} = require("../../src/shared/ecs/gen/json_serde");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
const { zrpcWebSerialize } = require("../../src/shared/zrpc/serde");
const { BikkieIds } = require("../../src/shared/bikkie/ids");
const { secondsSinceEpoch } = require("../../src/shared/ecs/config");
const { anItem } = require("../../src/shared/game/item");
const { countOf, createBag } = require("../../src/shared/game/items");
const {
  PLAYER_HOTBAR_SLOTS,
  PLAYER_INVENTORY_SLOTS,
} = require("../../src/shared/game/inventory");
const {
  harthmereNativeBiomesIdForItemId,
} = require("../../src/shared/harthmere/harthmere_native_item_ids");
const {
  writeHarthmereNativeCombatProgression,
  harthmereNativeNpcCombatProfileForSeed,
} = require("../../src/shared/harthmere/harthmere_native_combat");
const {
  harthmereGroundedMuckMonsterSeedsInTerritory,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  HARTHMERE_GATHERING_AUTHORITY_NODES,
} = require("../../src/shared/harthmere/gathering_node_authority");
const {
  HARTHMERE_BATTLE_MUSIC_PATH,
} = require("../../src/client/game/resources/audio");
const {
  COMBAT_MUSIC_DAMAGE_GRACE_SECONDS,
} = require("../../src/client/game/scripts/audio");
const {
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  HARTHMERE_JOBS_BOARD_LOCATIONS,
  harthmereAutoSeedTemplateRequirementsObtainable,
} = require("../../src/shared/harthmere/mmo_jobs_board_authority");
const {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  parseHarthmereLiveModeSharedWorldState,
} = require("../../src/shared/harthmere/live_mode_backend");
const { connectToRedis } = require("../../src/server/shared/redis/connection");
const {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} = require("../../src/shared/harthmere/harthmere_native_vitals");
const {
  NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
} = require("../../src/shared/harthmere/native_road_ahead_contract");

const root = path.resolve(__dirname, "../..");
const baseUrl = (
  process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");
const configuredGameUrl = process.env.HARTHMERE_E2E_URL || `${baseUrl}/at`;
const combatMusicOnly = process.env.HARTHMERE_E2E_COMBAT_MUSIC_ONLY === "1";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120000);
const acceptanceGateMs = Number(
  process.env.HARTHMERE_E2E_ACCEPTANCE_GATE_MS ||
    (combatMusicOnly ? 10_000 : 2000)
);
const originSyncGateMs = Number(
  process.env.HARTHMERE_E2E_ORIGIN_SYNC_GATE_MS ||
    (combatMusicOnly ? timeoutMs + 30_000 : 1000)
);
const secondClientSyncGateMs = Number(
  process.env.HARTHMERE_E2E_SECOND_SYNC_GATE_MS || 1500
);
const audioLoadGateMs = Number(
  process.env.HARTHMERE_E2E_AUDIO_LOAD_GATE_MS || 20_000
);
const combatMusicRestoreGateMs = Number(
  process.env.HARTHMERE_E2E_COMBAT_MUSIC_RESTORE_GATE_MS ||
    (combatMusicOnly
      ? timeoutMs + 30_000
      : (COMBAT_MUSIC_DAMAGE_GRACE_SECONDS + 3) * 1000)
);
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const combatFixtureSyncGateMs = Number(
  process.env.HARTHMERE_E2E_COMBAT_FIXTURE_SYNC_GATE_MS ||
    (combatMusicOnly ? timeoutMs + 30_000 : secondClientSyncGateMs)
);
const artifactsDir = path.resolve(
  process.env.HARTHMERE_E2E_ARTIFACTS_DIR ||
    path.join(root, "artifacts/harthmere-native-ecs-e2e")
);
const runId = `${Date.now()}-${process.pid}`;

if (!controlToken) {
  console.error("FAIL HARTHMERE_E2E_CONTROL_TOKEN is required");
  process.exit(1);
}

fs.mkdirSync(artifactsDir, { recursive: true });

const report = {
  version: "harthmere-native-ecs-browser-e2e-v1",
  runId,
  baseUrl,
  gameUrl: configuredGameUrl,
  mode: combatMusicOnly ? "combat-music-only" : "full",
  gates: {
    acceptanceGateMs,
    originSyncGateMs,
    secondClientSyncGateMs,
    audioLoadGateMs,
    combatMusicRestoreGateMs,
    combatFixtureSyncGateMs,
  },
  startedAt: new Date().toISOString(),
  scenarios: [],
  browser: { console: [], requests: [], audioAssets: [], failures: [] },
};

function gameUrl() {
  const url = new URL(configuredGameUrl);
  url.searchParams.set("glitch_auto_play", "1");
  url.searchParams.set("harthmere_native_ecs_e2e", "1");
  url.searchParams.set("e2e_run", runId);
  return url.toString();
}

function serializedChange(change) {
  return ChangeSerde.serializeProposed(SerializeForServer, change);
}

function serializedEvent(event) {
  return EventSerde.serialize(event);
}

function deserializeEntity(serialized) {
  return serialized ? EntitySerde.deserialize(serialized, false) : undefined;
}

function stackCount(container, itemId) {
  return (container || []).reduce(
    (total, stack) =>
      stack?.item?.id === itemId ? total + BigInt(stack.count) : total,
    0n
  );
}

function inventoryCount(entity, itemId) {
  const inventory = entity?.inventory;
  return (
    stackCount(inventory?.items, itemId) +
    stackCount(inventory?.hotbar, itemId) +
    stackCount(
      inventory?.overflow ? [...inventory.overflow.values()] : [],
      itemId
    )
  );
}

function bridgeCall(page, method, ...args) {
  return page.evaluate(
    async ({ method, args }) => {
      const bridge = globalThis.__harthmereNativeEcsE2E;
      if (!bridge) {
        throw new Error("Native ECS E2E bridge is not installed");
      }
      const fn = bridge[method];
      if (typeof fn !== "function") {
        throw new Error(`Unknown Native ECS E2E bridge method: ${method}`);
      }
      return await fn(...args);
    },
    { method, args }
  );
}

async function authoritativeEntity(page, id) {
  const [[version, serialized]] = await bridgeCall(page, "getAuthoritative", [
    id,
  ]);
  return { version, entity: deserializeEntity(serialized) };
}

async function localEntity(page, id) {
  const [version, serialized] = await bridgeCall(page, "getLocal", id);
  return { version, entity: deserializeEntity(serialized) };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(label, probe, predicate, gateMs, timeout = timeoutMs) {
  const started = Date.now();
  let last;
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      last = await probe();
      if (predicate(last)) {
        const elapsedMs = Date.now() - started;
        assert(
          elapsedMs <= gateMs,
          `${label} took ${elapsedMs}ms, above gate ${gateMs}ms`
        );
        return { value: last, elapsedMs };
      }
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw new Error(
    `${label} timed out after ${timeout}ms; last=${JSON.stringify(
      last,
      (_key, value) => (typeof value === "bigint" ? `${value}n` : value)
    )}; error=${lastError?.stack || lastError || "none"}`
  );
}

async function applyFixture(page, ...changes) {
  await bridgeCall(page, "applyChanges", changes.map(serializedChange));
}

async function pageJson(page, pathname, init = {}) {
  return page.evaluate(
    async ({ pathname, init }) => {
      const response = await fetch(pathname, {
        ...init,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
      });
      const text = await response.text();
      let body;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { parseError: text.slice(0, 500) };
      }
      return { ok: response.ok, status: response.status, body };
    },
    { pathname, init }
  );
}

async function postLiveMode(page, actionKind, subsystem, payload, targetId) {
  const requestId = `native-ecs-e2e:${runId}:${actionKind}:${Math.random()
    .toString(36)
    .slice(2)}`;
  return pageJson(page, "/api/harthmere/live_mode", {
    method: "POST",
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      targetId,
      actionKind,
      subsystem,
      actorEntityVersion: 1,
      targetEntityVersion: targetId ? 1 : undefined,
      zoneId: "harthmere_native_ecs_e2e",
      clientSentAtMs: Date.now(),
      payload,
      clientClaims: { source: "native_ecs_browser_e2e" },
    }),
  });
}

async function publishAndProve({
  name,
  page,
  event,
  authoritativeProbe,
  authoritativePredicate,
  localProbe,
  localPredicate,
  secondProbe,
  secondPredicate,
}) {
  const eventKind = event.kind;
  const beforeDiagnostics = await bridgeCall(page, "diagnostics");
  const publishStarted = Date.now();
  await bridgeCall(page, "publish", serializedEvent(event));
  const acceptanceMs = Date.now() - publishStarted;
  assert(
    acceptanceMs <= acceptanceGateMs,
    `${name} acceptance took ${acceptanceMs}ms, above ${acceptanceGateMs}ms`
  );

  const authoritative = await waitFor(
    `${name}: authoritative ECS mutation`,
    authoritativeProbe,
    authoritativePredicate,
    acceptanceGateMs
  );
  const local = await waitFor(
    `${name}: originating browser sync`,
    localProbe,
    localPredicate,
    originSyncGateMs
  );
  let second;
  if (secondProbe) {
    second = await waitFor(
      `${name}: second browser sync`,
      secondProbe,
      secondPredicate,
      secondClientSyncGateMs
    );
  }

  const afterDiagnostics = await bridgeCall(page, "diagnostics");
  const beforeCount = beforeDiagnostics.publishedEvents.filter(
    (entry) => entry.kind === eventKind
  ).length;
  const afterCount = afterDiagnostics.publishedEvents.filter(
    (entry) => entry.kind === eventKind
  ).length;
  assert.equal(
    afterCount,
    beforeCount + 1,
    `${name} must publish exactly one ${eventKind}`
  );

  report.scenarios.push({
    name,
    eventKind,
    status: "pass",
    acceptanceMs,
    authoritativeMs: authoritative.elapsedMs,
    originSyncMs: local.elapsedMs,
    secondClientSyncMs: second?.elapsedMs,
  });
}

function attachDiagnostics(page, label) {
  page.on("console", (message) => {
    const text = `${label}:${message.type()}: ${message.text()}`;
    report.browser.console.push(text);
    const unsupportedExtensionAsset =
      text.includes("Fetch API cannot load chrome-extension://") &&
      text.includes('URL scheme "chrome-extension" is not supported');
    const knownMixedSceneMeshFallback =
      text.includes("Found mesh with mix of scene types") &&
      text.includes("Defaulting to base.");
    if (
      message.type() === "error" &&
      !unsupportedExtensionAsset &&
      !knownMixedSceneMeshFallback
    ) {
      report.browser.failures.push(text);
    }
  });
  page.on("request", (request) => {
    const url = request.url();
    if (
      /\/api\/|\/sync(?:\?|$)/.test(url) ||
      url.includes(HARTHMERE_BATTLE_MUSIC_PATH)
    ) {
      report.browser.requests.push({
        client: label,
        method: request.method(),
        url: url.replace(baseUrl, ""),
        at: Date.now(),
      });
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText;
    const abortedLiveModeBuildingPoll =
      errorText === "net::ERR_ABORTED" &&
      url.startsWith(`${baseUrl}/api/harthmere/live_mode_building_state?`);
    if (url.startsWith(baseUrl) && !abortedLiveModeBuildingPoll) {
      report.browser.failures.push(
        `${label}:requestfailed:${request.method()}:${url}:${errorText}`
      );
    }
  });
  page.on("response", (response) => {
    if (response.url().includes(HARTHMERE_BATTLE_MUSIC_PATH)) {
      report.browser.audioAssets.push({
        client: label,
        status: response.status(),
        url: response.url().replace(baseUrl, ""),
        at: Date.now(),
      });
    }
    if (response.url().startsWith(baseUrl) && response.status() >= 500) {
      report.browser.failures.push(
        `${label}:response:${response.status()}:${response.url()}`
      );
    }
  });
}

async function openUser(browser, username, label) {
  console.log(`E2E ${label}: authenticating ${username}`);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const authUrl = new URL("/api/harthmere/visual_test_auth", baseUrl);
  authUrl.searchParams.set("usernameOrId", username);
  authUrl.searchParams.set("e2eAdmin", "1");
  const authResponse = await context.request.get(authUrl.toString(), {
    headers: { "x-harthmere-e2e-token": controlToken },
    timeout: timeoutMs,
  });
  assert(
    authResponse.ok(),
    `${label} visual test auth failed HTTP ${authResponse.status()}: ${await authResponse.text()}`
  );
  const auth = await authResponse.json();
  assert.equal(
    auth.e2eAdmin,
    true,
    `${label} did not receive E2E admin access`
  );

  let focusedCombatPosition;
  if (combatMusicOnly) {
    const combatNode = HARTHMERE_GATHERING_AUTHORITY_NODES.find(
      (node) => node.requiredTool && node.requiredSkill <= 1
    );
    assert(combatNode, "no basic combat-position fixture is authored");
    focusedCombatPosition = [...combatNode.position];
    const applyResponse = await context.request.post(
      new URL("/api/admin/apply_ecs_changes", baseUrl).toString(),
      {
        data: {
          z: zrpcWebSerialize([
            serializedChange({
              kind: "update",
              entity: {
                id: auth.userId,
                position: Position.create({ v: focusedCombatPosition }),
              },
            }),
          ]),
        },
        timeout: timeoutMs,
      }
    );
    assert(
      applyResponse.ok(),
      `${label} pre-navigation combat position failed HTTP ${applyResponse.status()}: ${await applyResponse.text()}`
    );
  }

  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  attachDiagnostics(page, label);
  const response = await page.goto(gameUrl(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  assert(response && response.status() < 500, `${label} game route failed`);
  await page.waitForFunction(
    () =>
      globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1" &&
      Boolean(globalThis.clientContext),
    undefined,
    { timeout: timeoutMs }
  );
  const bridgeUserId = await bridgeCall(page, "diagnostics").then(
    (value) => value.userId
  );
  assert.equal(String(bridgeUserId), String(auth.userId));
  console.log(`E2E ${label}: client context and bridge ready`);
  return {
    context,
    page,
    userId: auth.userId,
    username,
    focusedCombatPosition,
  };
}

async function openSameUserPeer(user, label) {
  const page = await user.context.newPage();
  page.setDefaultTimeout(timeoutMs);
  attachDiagnostics(page, label);
  const response = await page.goto(gameUrl(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  assert(response && response.status() < 500, `${label} game route failed`);
  await page.waitForFunction(
    () => globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1",
    undefined,
    { timeout: timeoutMs }
  );
  assert.equal(
    String(await bridgeCall(page, "diagnostics").then((value) => value.userId)),
    String(user.userId),
    `${label} resolved a different ECS actor`
  );
  return page;
}

function playerInventoryFixture() {
  const items = new Array(PLAYER_INVENTORY_SLOTS);
  items[0] = countOf(BikkieIds.muckyTop, 1n);
  items[1] = countOf(BikkieIds.muckySkirt, 1n);
  items[2] = countOf(BikkieIds.dirt, 5n);
  return Inventory.create({
    items,
    hotbar: new Array(PLAYER_HOTBAR_SLOTS),
    currencies: new Map(),
    overflow: new Map(),
    selected: { kind: "hotbar", idx: 0 },
  });
}

function nativeVitalsFixture() {
  const triggerState = TriggerState.create();
  writeHarthmereNativeVitals(triggerState, {
    mana: 25,
    maxMana: 100,
    stamina: 25,
    maxStamina: 100,
    breath: 15,
    maxBreath: 15,
    lastTickMs: Date.now(),
    migrationVersion: 1,
  });
  return triggerState;
}

async function waitForPlayerFixture(page, userId) {
  return waitFor(
    "fixture synchronized to browser",
    () => localEntity(page, userId),
    ({ entity }) =>
      inventoryCount(entity, BikkieIds.dirt) === 5n &&
      entity?.health?.hp === 50,
    originSyncGateMs
  );
}

const JOBS_BOARD_E2E_FIXTURE_PREFIX = "native_ecs_e2e_job:";

function e2eBoardIdForTemplate(template) {
  return template.boardScope === "harthmere"
    ? HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID
    : HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
}

async function installAllJobsBoardE2EFixtures(actorId) {
  const redis = await connectToRedis("firehose");
  const key = harthmereLiveModeSharedWorldStateKey();
  const nowMs = Date.now();
  const raw = await redis.primary.get(key);
  const defaults = defaultHarthmereLiveModeBackendState(
    `native-ecs-e2e-fixture:${actorId}`,
    nowMs
  );
  const shared =
    parseHarthmereLiveModeSharedWorldState(raw, nowMs) ??
    createHarthmereLiveModeSharedWorldState(defaults, nowMs);
  const jobs = shared.jobsBoard;

  // The browser suite runs against an isolated local Redis world. Remove old
  // fixture postings/todos so reruns stay deterministic without disturbing any
  // normal local jobs that a developer may be inspecting.
  const staleJobIds = new Set(
    Object.keys(jobs.postings).filter((jobId) =>
      jobId.startsWith(JOBS_BOARD_E2E_FIXTURE_PREFIX)
    )
  );
  for (const jobId of staleJobIds) delete jobs.postings[jobId];
  for (const [todoId, todo] of Object.entries(jobs.todos)) {
    if (staleJobIds.has(todo.jobId)) delete jobs.todos[todoId];
  }
  jobs.actorAcceptedJobIds[String(actorId)] = [];
  jobs.actorCooldowns[String(actorId)] = { abuseScore: 0 };

  const templates = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
    (template) =>
      harthmereAutoSeedTemplateRequirementsObtainable(template.requirements)
  );
  const fixtures = templates.map((template, index) => {
    const boardId = e2eBoardIdForTemplate(template);
    const board = jobs.boards[boardId];
    assert(board, `missing jobs board fixture target ${boardId}`);
    const jobId = `${JOBS_BOARD_E2E_FIXTURE_PREFIX}${template.templateId}`;
    const rewardGold = Math.max(5, Number(template.rewardGold.min));
    jobs.postings[jobId] = {
      jobId,
      boardId,
      issuerKind: template.issuerKind,
      issuerId: template.issuerId,
      title: template.title,
      description: template.description,
      kind: template.kind,
      requirements: template.requirements.map((requirement) => ({
        ...requirement,
      })),
      templateId: template.templateId,
      rewardGold,
      escrowGold: rewardGold,
      reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
      status: "open",
      townId: board.townId,
      regionId: board.regionId,
      createdAtMs: nowMs + index,
      deadlineAtMs: nowMs + 24 * 60 * 60 * 1000,
      // The suite abandons each accepted fixture after verifying projection so
      // it can reuse one seeker without mutating unrelated wallet state.
      failurePenaltyGold: 0,
      requiresFieldWork: template.requiresFieldWork,
      mapMarkerId:
        template.mapMarkerId ??
        template.requirements.find((requirement) => requirement.mapMarkerId)
          ?.mapMarkerId,
      targetId:
        template.targetId ??
        template.requirements.find((requirement) => requirement.targetId)
          ?.targetId,
      abuseFlags: [],
      logs: [`native_ecs_e2e_fixture:${runId}`],
      autoPosted: true,
      source: "native_ecs_browser_e2e",
      partyRecommended: template.partyRecommended,
      partyMinSize: template.partyMinSize,
      monsterId: template.monsterId,
      monsterTier: template.monsterTier,
      monsterPowerLevel: template.monsterPowerLevel,
      lootHint: template.lootHint ? [...template.lootHint] : undefined,
    };
    return {
      jobId,
      boardId,
      templateId: template.templateId,
      title: template.title,
      kind: template.kind,
    };
  });

  // Rebuild issuer indexes from the final posting set so accepting/abandoning
  // a fixture follows the exact same reducer path as ordinary production jobs.
  jobs.issuerOpenJobIds = {};
  for (const posting of Object.values(jobs.postings)) {
    if (posting.status !== "open" && posting.status !== "active") continue;
    const issuerKey = `${posting.issuerKind}:${posting.issuerId}`;
    (jobs.issuerOpenJobIds[issuerKey] ??= []).push(posting.jobId);
  }
  shared.updatedAtMs = nowMs;
  await redis.primary.set(key, JSON.stringify(shared));

  return {
    redis,
    key,
    fixtures,
    async clearAcceptCooldown() {
      const latestRaw = await redis.primary.get(key);
      const latest = parseHarthmereLiveModeSharedWorldState(
        latestRaw,
        Date.now()
      );
      assert(latest, "jobs-board E2E shared state disappeared");
      latest.jobsBoard.actorCooldowns[String(actorId)] = { abuseScore: 0 };
      latest.updatedAtMs = Date.now();
      await redis.primary.set(key, JSON.stringify(latest));
    },
    async close() {
      await redis.quit("native ECS jobs-board E2E complete");
    },
  };
}

async function proveAllJobsBoardFrontendNativeEcsRoundTrips(first) {
  const fixture = await installAllJobsBoardE2EFixtures(first.userId);
  try {
    // First prove the request really crosses the native ECS Position gate by
    // trying the frontend accept action before moving the player to the board.
    const firstFixture = fixture.fixtures[0];
    const firstBoard = HARTHMERE_JOBS_BOARD_LOCATIONS[firstFixture.boardId];
    assert(firstBoard, `missing board ${firstFixture.boardId}`);
    const awayPosition = [
      firstBoard.location.x + 20,
      firstBoard.location.y,
      firstBoard.location.z + 20,
    ];
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: awayPosition }),
      },
    });
    await waitFor(
      "jobs-board away-position synchronized",
      () => localEntity(first.page, first.userId),
      ({ entity }) => entity?.position?.v?.[0] === awayPosition[0],
      originSyncGateMs
    );
    await assert.rejects(
      () =>
        bridgeCall(first.page, "jobsBoardFrontendRoundTrip", {
          operation: "accept",
          jobId: firstFixture.jobId,
          boardId: firstFixture.boardId,
          requestId: `jobs_e2e_away:${runId}`,
        }),
      /jobs_board_rejected:/
    );

    for (const expected of fixture.fixtures) {
      const board = HARTHMERE_JOBS_BOARD_LOCATIONS[expected.boardId];
      assert(board, `missing board ${expected.boardId}`);
      const boardPosition = [
        board.location.x,
        board.location.y,
        board.location.z,
      ];
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({ v: boardPosition }),
        },
      });
      await waitFor(
        `${expected.templateId}: native board position synchronized`,
        () => localEntity(first.page, first.userId),
        ({ entity }) =>
          entity?.position?.v?.[0] === boardPosition[0] &&
          entity?.position?.v?.[2] === boardPosition[2],
        originSyncGateMs
      );

      const before = await bridgeCall(
        first.page,
        "jobsBoardFrontendRoundTrip",
        { operation: "fetch" }
      );
      assert(
        before.openJobs.some(
          (job) =>
            job.jobId === expected.jobId &&
            job.templateId === expected.templateId &&
            job.title === expected.title &&
            job.kind === expected.kind
        ),
        `${expected.templateId}: exact fixture was not visible to the frontend`
      );

      const accepted = await bridgeCall(
        first.page,
        "jobsBoardFrontendRoundTrip",
        {
          operation: "accept",
          jobId: expected.jobId,
          boardId: expected.boardId,
          requestId: `jobs_e2e_accept:${runId}:${expected.templateId}`,
        }
      );
      const acceptedJob = accepted.acceptedJobs.find(
        (job) => job.jobId === expected.jobId
      );
      assert.deepEqual(
        acceptedJob,
        expected,
        `${expected.templateId}: accepted frontend job identity changed`
      );
      const todo = accepted.todos.find((row) => row.jobId === expected.jobId);
      assert(todo, `${expected.templateId}: authoritative todo missing`);
      assert.equal(todo.title, expected.title);
      assert.equal(todo.kind, expected.kind);
      assert.equal(todo.status, "active");
      const quest = accepted.quests.find(
        (row) => row.questId === `jobs_board:${todo.todoId}`
      );
      assert(
        quest,
        `${expected.templateId}: frontend quest projection missing`
      );
      assert.equal(quest.title, expected.title);
      assert.equal(quest.kind, expected.kind);
      assert.equal(quest.status, "active");
      const marker = accepted.markers.find(
        (row) =>
          row.jobsBoardJobId === expected.jobId &&
          row.jobsBoardTodoId === todo.todoId
      );
      assert(marker, `${expected.templateId}: frontend map marker missing`);
      assert(
        marker.position.every(Number.isFinite),
        `${expected.templateId}: map marker position is invalid`
      );

      const nativePlayer = await authoritativeEntity(first.page, first.userId);
      assert.deepEqual(
        nativePlayer.entity?.position?.v,
        boardPosition,
        `${expected.templateId}: accept did not use the native ECS board position`
      );

      const abandoned = await bridgeCall(
        first.page,
        "jobsBoardFrontendRoundTrip",
        {
          operation: "abandon",
          jobId: expected.jobId,
          boardId: expected.boardId,
          requestId: `jobs_e2e_abandon:${runId}:${expected.templateId}`,
        }
      );
      assert(
        !abandoned.markers.some((row) => row.jobsBoardJobId === expected.jobId),
        `${expected.templateId}: abandoned marker remained active`
      );
      await fixture.clearAcceptCooldown();
      report.scenarios.push({
        name: `jobs board frontend/native ECS/frontend: ${expected.templateId}`,
        status: "pass",
        jobId: expected.jobId,
        boardId: expected.boardId,
        kind: expected.kind,
        todoId: todo.todoId,
        markerId: marker.mapMarkerId,
      });
    }

    assert.equal(
      fixture.fixtures.length,
      HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.length,
      "every executable production auto-job template must run through E2E"
    );
  } finally {
    await fixture.close();
  }
}

async function proveCombatMusicRoundTrip(first, second, combatPosition) {
  // Spawn a deterministic native NPC fixture and attack it through the same
  // client event used by left-click combat. The server ignores forged HP,
  // derives damage from the selected sword/level, and Anima must retaliate.
  const combatSeed = harthmereGroundedMuckMonsterSeedsInTerritory().find(
    (seed) => seed.areaId !== "road_muckwad_patch"
  );
  assert(combatSeed, "no native combat NPC seed is available");
  const combatProfile = harthmereNativeNpcCombatProfileForSeed(combatSeed);
  const swordId = harthmereNativeBiomesIdForItemId("iron_longsword");
  assert(swordId, "iron longsword has no native Bikkie identity");
  const targetPosition = [
    combatPosition[0] + 2,
    combatPosition[1],
    combatPosition[2],
  ];
  const npcId = await bridgeCall(first.page, "allocateId");
  const combatPlayer = await authoritativeEntity(first.page, first.userId);
  assert(
    combatPlayer.entity?.inventory,
    "combat player has no native inventory"
  );
  const combatInventory = Inventory.clone(combatPlayer.entity.inventory);
  combatInventory.hotbar[0] = countOf(swordId, 1n);
  combatInventory.selected = { kind: "hotbar", idx: 0 };
  const combatTriggerState = TriggerState.clone(
    combatPlayer.entity.trigger_state
  );
  writeHarthmereNativeCombatProgression(combatTriggerState, {
    level: Math.max(5, combatProfile.level),
    migrationVersion: 1,
  });
  const fixtureChanges = [
    {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: combatPosition }),
        inventory: combatInventory,
        selected_item: SelectedItem.create({
          item: combatInventory.hotbar[0],
        }),
        trigger_state: combatTriggerState,
        health: Health.create({ hp: 100, maxHp: 100 }),
      },
    },
    {
      kind: "create",
      entity: {
        id: npcId,
        position: Position.create({ v: targetPosition }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        size: Size.create({ v: [1, 2, 1] }),
        health: Health.create({
          hp: combatProfile.maxHp,
          maxHp: combatProfile.maxHp,
        }),
        npc_state: NpcState.create(),
        npc_metadata: NpcMetadata.create({
          type_id: combatProfile.id,
          created_time: secondsSinceEpoch(),
          spawn_position: targetPosition,
          spawn_orientation: [0, 0],
        }),
        label: Label.create({ text: `E2E ${combatProfile.displayName}` }),
      },
    },
  ];
  if (second) {
    fixtureChanges.splice(1, 0, {
      kind: "update",
      entity: {
        id: second.userId,
        position: Position.create({ v: combatPosition }),
      },
    });
  }
  await applyFixture(first.page, ...fixtureChanges);
  const fixtureSyncs = [
    waitFor(
      "combat fixture synchronized to attacker",
      () => localEntity(first.page, npcId),
      ({ entity }) => entity?.health?.hp === combatProfile.maxHp,
      combatFixtureSyncGateMs
    ),
  ];
  if (second) {
    fixtureSyncs.push(
      waitFor(
        "combat fixture synchronized to observer",
        () => localEntity(second.page, npcId),
        ({ entity }) => entity?.health?.hp === combatProfile.maxHp,
        combatFixtureSyncGateMs
      )
    );
  }
  await Promise.all(fixtureSyncs);
  const preCombatAudio = await waitFor(
    "pre-combat ambient track is selected",
    () => bridgeCall(first.page, "audioDiagnostics"),
    (diagnostics) => ["music", "muck_music"].includes(diagnostics.currentTrack),
    originSyncGateMs
  );
  const preCombatAmbientTrack = preCombatAudio.value.currentTrack;
  const preCombatTransitionCount = preCombatAudio.value.transitions.length;
  const beforeNpcHit = await authoritativeEntity(first.page, npcId);
  await publishAndProve({
    name: "native weapon damage against NPC",
    page: first.page,
    event: new UpdateNpcHealthEvent({
      id: npcId,
      hp: -999,
      damageSource: {
        kind: "attack",
        attacker: first.userId,
        dir: [1, 0, 0],
      },
    }),
    authoritativeProbe: () => authoritativeEntity(first.page, npcId),
    authoritativePredicate: ({ version, entity }) =>
      version > beforeNpcHit.version &&
      entity?.health?.hp < combatProfile.maxHp,
    localProbe: () => localEntity(first.page, npcId),
    localPredicate: ({ entity }) => entity?.health?.hp < combatProfile.maxHp,
    secondProbe: second ? () => localEntity(second.page, npcId) : undefined,
    secondPredicate: second
      ? ({ entity }) => entity?.health?.hp < combatProfile.maxHp
      : undefined,
  });
  const battleMusicEntry = await waitFor(
    "native player attack selects combat music",
    () => bridgeCall(first.page, "audioDiagnostics"),
    (diagnostics) =>
      combatMusicOnly
        ? diagnostics.transitions
            .slice(preCombatTransitionCount)
            .some((transition) => transition.track === "battle_music")
        : diagnostics.currentTrack === "battle_music",
    originSyncGateMs
  );
  report.scenarios.push({
    name: "native combat selects battle music",
    status: "pass",
    originSyncMs: battleMusicEntry.elapsedMs,
    previousTrack: preCombatAmbientTrack,
    npcId: String(npcId),
  });
  let retaliationTransitionStart = preCombatTransitionCount;
  let retaliation;
  if (combatMusicOnly) {
    const outgoingCombatRestoration = await waitFor(
      "outgoing native combat grace restores ambient music",
      () => bridgeCall(first.page, "audioDiagnostics"),
      (diagnostics) => {
        const transitions = diagnostics.transitions.slice(
          preCombatTransitionCount
        );
        const battleIndex = transitions.findIndex(
          (transition) => transition.track === "battle_music"
        );
        return (
          battleIndex >= 0 &&
          transitions
            .slice(battleIndex + 1)
            .some((transition) => transition.track === preCombatAmbientTrack)
        );
      },
      combatMusicRestoreGateMs,
      combatMusicRestoreGateMs + 5_000
    );
    retaliationTransitionStart =
      outgoingCombatRestoration.value.transitions.length;
    const beforeNativePlayerDamage = await authoritativeEntity(
      first.page,
      first.userId
    );
    assert(
      beforeNativePlayerDamage.entity?.health,
      "combat player has no native health"
    );
    const damagedPlayerHealth = Health.clone(
      beforeNativePlayerDamage.entity.health
    );
    const incomingDamage = Math.min(10, damagedPlayerHealth.hp - 1);
    assert(incomingDamage > 0, "combat player cannot receive test damage");
    damagedPlayerHealth.hp -= incomingDamage;
    damagedPlayerHealth.lastDamageSource = {
      kind: "attack",
      attacker: npcId,
      dir: [-1, 0, 0],
    };
    damagedPlayerHealth.lastDamageTime = secondsSinceEpoch();
    damagedPlayerHealth.lastDamageAmount = -incomingDamage;
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        health: damagedPlayerHealth,
      },
    });
    retaliation = await waitFor(
      "native NPC attack damage updates authoritative player health",
      () => authoritativeEntity(first.page, first.userId),
      ({ version, entity }) =>
        version > beforeNativePlayerDamage.version &&
        entity?.health?.hp === damagedPlayerHealth.hp &&
        entity.health.lastDamageSource?.kind === "attack" &&
        entity.health.lastDamageSource.attacker === npcId,
      timeoutMs + 30_000,
      timeoutMs
    );
  } else {
    retaliation = await waitFor(
      "Anima retaliation updates native player health",
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) => entity?.health?.hp < 100,
      15_000,
      20_000
    );
  }
  const retaliationLocal = await waitFor(
    "retaliation reaches HUD health source",
    () => localEntity(first.page, first.userId),
    ({ entity }) => entity?.health?.hp < 100,
    originSyncGateMs
  );
  const retaliationDamageTimeMs =
    retaliationLocal.value.entity?.health?.lastDamageTime * 1000;
  const battleMusicRetaliation = await waitFor(
    "native retaliation keeps combat music selected",
    () => bridgeCall(first.page, "audioDiagnostics"),
    (diagnostics) =>
      combatMusicOnly
        ? diagnostics.transitions
            .slice(retaliationTransitionStart)
            .some((transition) => transition.track === "battle_music")
        : diagnostics.currentTrack === "battle_music",
    originSyncGateMs
  );
  report.scenarios.push({
    name: combatMusicOnly
      ? "native incoming attack damage selects battle music"
      : "Anima native retaliation",
    status: "pass",
    authoritativeMs: retaliation.elapsedMs,
    combatMusicSyncMs: battleMusicRetaliation.elapsedMs,
    npcId: String(npcId),
  });

  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: npcId,
      health: Health.create({ hp: 0, maxHp: combatProfile.maxHp }),
    },
  });
  await waitFor(
    "defeated combat fixture synchronized",
    () => localEntity(first.page, npcId),
    ({ entity }) => entity?.health?.hp === 0,
    originSyncGateMs
  );
  const ambientRestoration = await waitFor(
    "ambient music restores after native combat ends",
    () => bridgeCall(first.page, "audioDiagnostics"),
    (diagnostics) => {
      if (!combatMusicOnly) {
        return diagnostics.currentTrack === preCombatAmbientTrack;
      }
      const transitions = diagnostics.transitions.slice(
        retaliationTransitionStart
      );
      const battleIndex = transitions.findIndex(
        (transition) => transition.track === "battle_music"
      );
      return (
        battleIndex >= 0 &&
        transitions
          .slice(battleIndex + 1)
          .some((transition) => transition.track === preCombatAmbientTrack)
      );
    },
    combatMusicRestoreGateMs,
    combatMusicRestoreGateMs + 5_000
  );
  if (combatMusicOnly) {
    const transitions = ambientRestoration.value.transitions.slice(
      retaliationTransitionStart
    );
    const battleIndex = transitions.findIndex(
      (transition) => transition.track === "battle_music"
    );
    assert(battleIndex >= 0, "combat music transition was not recorded");
    const battleTransition = transitions[battleIndex];
    const ambientTransitions = transitions
      .slice(battleIndex + 1)
      .filter((transition) => transition.track === preCombatAmbientTrack);
    assert(
      ambientTransitions.length > 0,
      "ambient restoration transition was not recorded"
    );
    const firstAmbientTransition = ambientTransitions[0];
    if (Number.isFinite(retaliationDamageTimeMs)) {
      assert(
        !ambientTransitions.some(
          (transition) => transition.atMs < retaliationDamageTimeMs
        ),
        "ambient music interrupted combat before native retaliation"
      );
      assert(
        firstAmbientTransition.atMs >=
          retaliationDamageTimeMs +
            COMBAT_MUSIC_DAMAGE_GRACE_SECONDS * 1000 -
            500,
        "ambient music restored before the retaliation combat grace expired"
      );
    }
    assert(
      firstAmbientTransition.atMs >= battleTransition.atMs,
      "ambient restoration was recorded before combat music"
    );
  }
  report.scenarios.push({
    name: "ambient music restores after native combat",
    status: "pass",
    restoreMs: ambientRestoration.elapsedMs,
    restoredTrack: ambientRestoration.value.currentTrack,
    combatGraceSeconds: COMBAT_MUSIC_DAMAGE_GRACE_SECONDS,
    npcId: String(npcId),
  });
}

function finishFocusedCombatMusicRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused combat music browser E2E (${report.scenarios.length} scenarios)`
  );
}

async function run() {
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

  const suffix = runId.replace(/[^0-9]/g, "").slice(-10);
  let first;
  let second;
  let sameUserPeer;
  try {
    first = await openUser(browser, `NativeECS-A-${suffix}`, "client-a");
    if (!combatMusicOnly) {
      sameUserPeer = await openSameUserPeer(first, "client-a-peer");
      second = await openUser(browser, `NativeECS-B-${suffix}`, "client-b");
    }

    const initial = await authoritativeEntity(first.page, first.userId);
    assert(initial.entity?.position?.v, "E2E player has no native position");
    const position = [...initial.entity.position.v];
    const initialDiagnostics = await bridgeCall(first.page, "diagnostics");
    assert(
      initialDiagnostics.tableSize > 0,
      "world sync completed without hydrating any ECS entities"
    );
    const peerInitial = sameUserPeer
      ? await waitFor(
          "same-user peer world bootstrap",
          () => localEntity(sameUserPeer, first.userId),
          ({ entity }) => Boolean(entity?.position && entity?.inventory),
          secondClientSyncGateMs
        )
      : undefined;
    report.scenarios.push({
      name: "world bootstrap and same-user identity",
      status: "pass",
      hydratedEntityCount: initialDiagnostics.tableSize,
      secondClientSyncMs: peerInitial?.elapsedMs,
    });

    await bridgeCall(first.page, "resumeAudio");
    const audioReady = await waitFor(
      "combat music asset decoded by the browser audio manager",
      () => bridgeCall(first.page, "audioDiagnostics"),
      (diagnostics) =>
        diagnostics.running &&
        diagnostics.loadedTracks.includes("music") &&
        diagnostics.loadedTracks.includes("muck_music") &&
        diagnostics.loadedTracks.includes("battle_music") &&
        ["music", "muck_music"].includes(diagnostics.currentTrack),
      audioLoadGateMs,
      audioLoadGateMs + 5_000
    );
    const ambientTrack = audioReady.value.currentTrack;
    const battleAssetResponse = report.browser.audioAssets.find(
      (entry) =>
        entry.client === "client-a" &&
        entry.url.includes(HARTHMERE_BATTLE_MUSIC_PATH)
    );
    assert(
      battleAssetResponse && battleAssetResponse.status < 400,
      `battle music asset did not load successfully: ${JSON.stringify(
        report.browser.audioAssets
      )}`
    );
    report.scenarios.push({
      name: "combat music asset load and decode",
      status: "pass",
      loadMs: audioReady.elapsedMs,
      assetStatus: battleAssetResponse.status,
      ambientTrack,
      loadedTracks: audioReady.value.loadedTracks,
    });

    if (combatMusicOnly) {
      console.log("E2E combat music: creating native combat fixture");
      assert(first.focusedCombatPosition, "focused combat position is missing");
      await proveCombatMusicRoundTrip(
        first,
        undefined,
        first.focusedCombatPosition
      );
      finishFocusedCombatMusicRun();
      return;
    }

    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        inventory: playerInventoryFixture(),
        wearing: Wearing.create({ items: new Map() }),
        health: Health.create({ hp: 50, maxHp: 100 }),
        trigger_state: nativeVitalsFixture(),
      },
    });
    await applyFixture(second.page, {
      kind: "update",
      entity: {
        id: second.userId,
        position: Position.create({ v: position }),
        inventory: Inventory.create({
          items: new Array(PLAYER_INVENTORY_SLOTS),
          hotbar: new Array(PLAYER_HOTBAR_SLOTS),
          selected: { kind: "hotbar", idx: 0 },
        }),
      },
    });
    await waitForPlayerFixture(first.page, first.userId);

    // Clothing equip uses native InventorySwapEvent and must update both the
    // server Wearing component and the browser's synchronized entity.
    for (const [name, srcIndex, slot, itemId] of [
      ["equip muck top", 0, BikkieIds.top, BikkieIds.muckyTop],
      ["equip muck bottoms", 1, BikkieIds.bottoms, BikkieIds.muckySkirt],
    ]) {
      const before = await authoritativeEntity(first.page, first.userId);
      await publishAndProve({
        name,
        page: first.page,
        event: new InventorySwapEvent({
          player_id: first.userId,
          src_id: first.userId,
          src: { kind: "item", idx: srcIndex },
          dst_id: first.userId,
          dst: { kind: "wearable", key: slot },
          positions: [],
        }),
        authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
        authoritativePredicate: ({ version, entity }) =>
          version > before.version &&
          entity?.wearing?.items.get(slot)?.id === itemId,
        localProbe: () => localEntity(first.page, first.userId),
        localPredicate: ({ entity }) =>
          entity?.wearing?.items.get(slot)?.id === itemId,
        secondProbe: () => localEntity(sameUserPeer, first.userId),
        secondPredicate: ({ entity }) =>
          entity?.wearing?.items.get(slot)?.id === itemId,
      });
    }

    // Hotbar movement and throwing must conserve the native stack and create a
    // synchronized world GrabBag instead of changing only a UI mirror.
    const beforeHotbar = await authoritativeEntity(first.page, first.userId);
    await publishAndProve({
      name: "move voxel stack to hotbar",
      page: first.page,
      event: new InventorySwapEvent({
        player_id: first.userId,
        src_id: first.userId,
        src: { kind: "item", idx: 2 },
        dst_id: first.userId,
        dst: { kind: "hotbar", idx: 0 },
        positions: [],
      }),
      authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
      authoritativePredicate: ({ version, entity }) =>
        version > beforeHotbar.version &&
        entity?.inventory?.hotbar?.[0]?.item?.id === BikkieIds.dirt &&
        inventoryCount(entity, BikkieIds.dirt) === 5n,
      localProbe: () => localEntity(first.page, first.userId),
      localPredicate: ({ entity }) =>
        entity?.inventory?.hotbar?.[0]?.item?.id === BikkieIds.dirt &&
        inventoryCount(entity, BikkieIds.dirt) === 5n,
      secondProbe: () => localEntity(sameUserPeer, first.userId),
      secondPredicate: ({ entity }) =>
        entity?.inventory?.hotbar?.[0]?.item?.id === BikkieIds.dirt,
    });

    const dropIdsBefore = new Set(
      (await bridgeCall(first.page, "findLocalByComponent", "grab_bag")).map(
        ([, serialized]) => deserializeEntity(serialized).id
      )
    );
    const beforeThrow = await authoritativeEntity(first.page, first.userId);
    await bridgeCall(
      first.page,
      "publish",
      serializedEvent(
        new InventoryThrowEvent({
          id: first.userId,
          src: { kind: "hotbar", idx: 0 },
          count: 1n,
          position,
        })
      )
    );
    const thrownPlayer = await waitFor(
      "throw: authoritative inventory debit",
      () => authoritativeEntity(first.page, first.userId),
      ({ version, entity }) =>
        version > beforeThrow.version &&
        inventoryCount(entity, BikkieIds.dirt) === 4n,
      acceptanceGateMs
    );
    const thrownDrop = await waitFor(
      "throw: native GrabBag synchronized",
      async () =>
        (await bridgeCall(first.page, "findLocalByComponent", "grab_bag"))
          .map(([, serialized]) => deserializeEntity(serialized))
          .find((entity) => !dropIdsBefore.has(entity.id)),
      (entity) =>
        entity?.grab_bag &&
        stackCount([...entity.grab_bag.slots.values()], BikkieIds.dirt) === 1n,
      originSyncGateMs
    );
    report.scenarios.push({
      name: "throw voxel creates native world drop",
      eventKind: "inventoryThrowEvent",
      status: "pass",
      authoritativeMs: thrownPlayer.elapsedMs,
      originSyncMs: thrownDrop.elapsedMs,
      dropId: String(thrownDrop.value.id),
    });

    // A Road Ahead-shaped private inventory proves the same native container
    // transaction used by the Clothing Crate/Billy's Toolbag, while using a
    // non-quest dirt item so this fixture cannot forge quest progress.
    const containerId = await bridgeCall(first.page, "allocateId");
    const containerItems = new Array(16);
    containerItems[0] = countOf(BikkieIds.dirt, 2n);
    await applyFixture(first.page, {
      kind: "create",
      entity: {
        id: containerId,
        position: Position.create({ v: position }),
        label: Label.create({ text: "Clothing Crate" }),
        entity_description: EntityDescription.create({
          text: NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
        }),
        created_by: CreatedBy.create({
          id: first.userId,
          created_at: secondsSinceEpoch(),
        }),
        quest_giver: QuestGiver.create(),
        container_inventory: ContainerInventory.create({
          items: containerItems,
        }),
      },
    });
    const beforeContainer = await authoritativeEntity(first.page, containerId);
    await publishAndProve({
      name: "native private container take",
      page: first.page,
      event: new InventorySwapEvent({
        player_id: first.userId,
        src_id: containerId,
        src: { kind: "item", idx: 0 },
        dst_id: first.userId,
        dst: { kind: "item", idx: 5 },
        positions: [
          [
            Math.floor(position[0]),
            Math.floor(position[1]),
            Math.floor(position[2]),
          ],
        ],
      }),
      authoritativeProbe: async () => ({
        container: await authoritativeEntity(first.page, containerId),
        player: await authoritativeEntity(first.page, first.userId),
      }),
      authoritativePredicate: ({ container, player }) =>
        container.version > beforeContainer.version &&
        !container.entity?.container_inventory?.items?.[0] &&
        player.entity?.inventory?.items?.[5]?.item?.id === BikkieIds.dirt,
      localProbe: async () => ({
        container: await localEntity(first.page, containerId),
        player: await localEntity(first.page, first.userId),
      }),
      localPredicate: ({ container, player }) =>
        !container.entity?.container_inventory?.items?.[0] &&
        player.entity?.inventory?.items?.[5]?.item?.id === BikkieIds.dirt,
      secondProbe: async () => ({
        container: await localEntity(sameUserPeer, containerId),
        player: await localEntity(sameUserPeer, first.userId),
      }),
      secondPredicate: ({ container, player }) =>
        !container.entity?.container_inventory?.items?.[0] &&
        player.entity?.inventory?.items?.[5]?.item?.id === BikkieIds.dirt,
    });

    // Native player damage must commit to Health and arrive through sync.
    const beforeDamage = await authoritativeEntity(first.page, first.userId);
    await publishAndProve({
      name: "native player damage and HUD source",
      page: first.page,
      event: new UpdatePlayerHealthEvent({
        id: first.userId,
        hpDelta: -10,
      }),
      authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
      authoritativePredicate: ({ version, entity }) =>
        version > beforeDamage.version && entity?.health?.hp === 40,
      localProbe: () => localEntity(first.page, first.userId),
      localPredicate: ({ entity }) => entity?.health?.hp === 40,
      secondProbe: () => localEntity(sameUserPeer, first.userId),
      secondPredicate: ({ entity }) => entity?.health?.hp === 40,
    });

    // Food, health, and mana recovery all debit the same native stack in the
    // transaction that updates Health/TriggerState.
    for (const consumable of [
      { itemId: "road_ration", action: "eat", proves: "stamina" },
      { itemId: "health_potion", action: "drink", proves: "health" },
      { itemId: "mana_draught", action: "drink", proves: "mana" },
    ]) {
      const nativeId = harthmereNativeBiomesIdForItemId(consumable.itemId);
      assert(nativeId, `missing native id for ${consumable.itemId}`);
      const current = await authoritativeEntity(first.page, first.userId);
      const inventory = Inventory.clone(current.entity.inventory);
      inventory.items[10] = countOf(nativeId, 1n);
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          inventory,
          health: Health.create({ hp: 30, maxHp: 100 }),
          trigger_state: nativeVitalsFixture(),
        },
      });
      await waitFor(
        `${consumable.itemId}: fixture sync`,
        () => localEntity(first.page, first.userId),
        ({ entity }) => entity?.inventory?.items?.[10]?.item?.id === nativeId,
        originSyncGateMs
      );
      const before = await authoritativeEntity(first.page, first.userId);
      const beforeVitals = readHarthmereNativeVitals(
        before.entity.trigger_state
      );
      await publishAndProve({
        name: `consume ${consumable.itemId}`,
        page: first.page,
        event: new ConsumptionEvent({
          id: first.userId,
          item_id: nativeId,
          inventory_ref: { kind: "item", idx: 10 },
          action: consumable.action,
        }),
        authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
        authoritativePredicate: ({ version, entity }) => {
          if (version <= before.version || entity?.inventory?.items?.[10])
            return false;
          const vitals = readHarthmereNativeVitals(entity?.trigger_state);
          if (consumable.proves === "stamina")
            return vitals.stamina > beforeVitals.stamina;
          if (consumable.proves === "mana")
            return vitals.mana > beforeVitals.mana;
          return entity?.health?.hp > before.entity.health.hp;
        },
        localProbe: () => localEntity(first.page, first.userId),
        localPredicate: ({ entity }) => {
          if (entity?.inventory?.items?.[10]) return false;
          const vitals = readHarthmereNativeVitals(entity?.trigger_state);
          if (consumable.proves === "stamina")
            return vitals.stamina > beforeVitals.stamina;
          if (consumable.proves === "mana")
            return vitals.mana > beforeVitals.mana;
          return entity?.health?.hp > before.entity.health.hp;
        },
        secondProbe: () => localEntity(sameUserPeer, first.userId),
        secondPredicate: ({ entity }) => !entity?.inventory?.items?.[10],
      });
    }

    // Every executable production template now crosses the actual frontend
    // adapter, server/native ECS Position gate, authoritative jobs state, and
    // frontend quest + map-marker projection. Exact template identity is
    // asserted on both sides so the wrong-job regression cannot return.
    await proveAllJobsBoardFrontendNativeEcsRoundTrips(first);

    // Authored gathering nodes validate the native Position and selected tool,
    // persist depletion in the backend, and materialize exact yields as native
    // GrabBags. Pickup must then move those exact Bikkie ids into inventory.
    const gatheringNode = HARTHMERE_GATHERING_AUTHORITY_NODES.find(
      (node) => node.requiredTool && node.requiredSkill <= 1
    );
    assert(gatheringNode, "no basic gathering-node fixture is authored");
    const gatheringToolId = harthmereNativeBiomesIdForItemId(
      gatheringNode.requiredTool
    );
    assert(gatheringToolId, "gathering tool has no native Bikkie identity");
    const gatheringPlayer = await authoritativeEntity(first.page, first.userId);
    const gatheringInventory = Inventory.clone(
      gatheringPlayer.entity.inventory
    );
    gatheringInventory.hotbar[0] = countOf(gatheringToolId, 1n);
    gatheringInventory.selected = { kind: "hotbar", idx: 0 };
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: [...gatheringNode.position] }),
        inventory: gatheringInventory,
        selected_item: SelectedItem.create({
          item: gatheringInventory.hotbar[0],
        }),
      },
    });
    await waitFor(
      "gathering position/tool synchronized",
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        entity?.position?.v?.[0] === gatheringNode.position[0] &&
        entity?.inventory?.hotbar?.[0]?.item?.id === gatheringToolId,
      originSyncGateMs
    );
    const dropsBeforeGathering = new Set(
      (await bridgeCall(first.page, "findLocalByComponent", "grab_bag")).map(
        ([, serialized]) => deserializeEntity(serialized).id
      )
    );
    const beforeGatheringInventory = await authoritativeEntity(
      first.page,
      first.userId
    );
    const gatheringResult = await postLiveMode(
      first.page,
      "request_farming_action",
      "farming",
      { operation: "gather_node", nodeId: gatheringNode.id },
      gatheringNode.id
    );
    const gatheringWarnings =
      gatheringResult.body?.backendMutation?.warnings ?? [];
    assert(
      gatheringResult.ok &&
        gatheringResult.body?.ok !== false &&
        gatheringWarnings.includes(
          "gathering_yield_materialized_as_native_ecs_drop"
        ),
      `gathering did not cross the native ECS boundary: ${gatheringWarnings.join(
        ","
      )}`
    );
    const gatheredDrops = await waitFor(
      "gathering native drops synchronized",
      async () =>
        (await bridgeCall(first.page, "findLocalByComponent", "grab_bag"))
          .map(([, serialized]) => deserializeEntity(serialized))
          .filter((entity) => !dropsBeforeGathering.has(entity.id)),
      (entities) => entities.length > 0,
      secondClientSyncGateMs
    );
    const authoredYieldIds = new Set(
      [...gatheringNode.baseYield, ...gatheringNode.rareYield].map((row) =>
        harthmereNativeBiomesIdForItemId(row.itemId)
      )
    );
    for (const drop of gatheredDrops.value) {
      for (const stack of drop.grab_bag.slots.values()) {
        assert(
          authoredYieldIds.has(stack.item.id),
          `gathering minted unauthored item ${stack.item.id}`
        );
      }
      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(new PickUpEvent({ id: first.userId, item: drop.id }))
      );
    }
    const gatheredItemIds = [...authoredYieldIds].filter(Boolean);
    await waitFor(
      "gathering pickup reaches native inventory",
      () => authoritativeEntity(first.page, first.userId),
      ({ version, entity }) =>
        version > beforeGatheringInventory.version &&
        gatheredItemIds.some(
          (itemId) =>
            inventoryCount(entity, itemId) >
            inventoryCount(beforeGatheringInventory.entity, itemId)
        ),
      acceptanceGateMs
    );
    report.scenarios.push({
      name: "authored gathering node to native pickup",
      status: "pass",
      nodeId: gatheringNode.id,
      dropIds: gatheredDrops.value.map((drop) => String(drop.id)),
    });

    await proveCombatMusicRoundTrip(first, second, [...gatheringNode.position]);

    // Put both actors back together before the shared pickup race and harvest
    // fixtures so spatial sync/range is part of the proof, not an accident.
    await applyFixture(
      first.page,
      {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({ v: position }),
        },
      },
      {
        kind: "update",
        entity: {
          id: second.userId,
          position: Position.create({ v: position }),
        },
      }
    );
    await Promise.all([
      waitFor(
        "client A returned to shared race position",
        () => localEntity(first.page, first.userId),
        ({ entity }) => entity?.position?.v?.[0] === position[0],
        originSyncGateMs
      ),
      waitFor(
        "client B returned to shared race position",
        () => localEntity(second.page, second.userId),
        ({ entity }) => entity?.position?.v?.[0] === position[0],
        originSyncGateMs
      ),
    ]);

    // Two independent users race the same native drop. The acquisition record
    // and total inventory delta prove that exactly one transaction won.
    const raceDropId = await bridgeCall(first.page, "allocateId");
    const raceBag = createBag(countOf(BikkieIds.dirt, 3n));
    await applyFixture(first.page, {
      kind: "create",
      entity: {
        id: raceDropId,
        position: Position.create({ v: position }),
        grab_bag: GrabBag.create({ slots: raceBag, mined: false }),
        expires: Expires.create({ trigger_at: secondsSinceEpoch() + 300 }),
        loose_item: LooseItem.create({ item: anItem(BikkieIds.dirt) }),
      },
    });
    await Promise.all([
      waitFor(
        "race drop visible to client A",
        () => localEntity(first.page, raceDropId),
        ({ entity }) => Boolean(entity?.grab_bag),
        secondClientSyncGateMs
      ),
      waitFor(
        "race drop visible to client B",
        () => localEntity(second.page, raceDropId),
        ({ entity }) => Boolean(entity?.grab_bag),
        secondClientSyncGateMs
      ),
    ]);
    const beforeRaceA = inventoryCount(
      (await authoritativeEntity(first.page, first.userId)).entity,
      BikkieIds.dirt
    );
    const beforeRaceB = inventoryCount(
      (await authoritativeEntity(second.page, second.userId)).entity,
      BikkieIds.dirt
    );
    await Promise.allSettled([
      bridgeCall(
        first.page,
        "publish",
        serializedEvent(new PickUpEvent({ id: first.userId, item: raceDropId }))
      ),
      bridgeCall(
        second.page,
        "publish",
        serializedEvent(
          new PickUpEvent({ id: second.userId, item: raceDropId })
        )
      ),
    ]);
    const raceResult = await waitFor(
      "pickup race acquisition",
      () => authoritativeEntity(first.page, raceDropId),
      ({ entity }) => Boolean(entity?.acquisition) && !entity?.grab_bag,
      acceptanceGateMs
    );
    assert(
      [first.userId, second.userId]
        .map(String)
        .includes(String(raceResult.value.entity.acquisition.acquired_by)),
      "pickup race was acquired by an unexpected actor"
    );
    const afterRaceA = inventoryCount(
      (await authoritativeEntity(first.page, first.userId)).entity,
      BikkieIds.dirt
    );
    const afterRaceB = inventoryCount(
      (await authoritativeEntity(second.page, second.userId)).entity,
      BikkieIds.dirt
    );
    assert.equal(
      afterRaceA - beforeRaceA + (afterRaceB - beforeRaceB),
      3n,
      "pickup race must grant one and only one drop stack"
    );
    report.scenarios.push({
      name: "two-user pickup race",
      eventKind: "pickUpEvent",
      status: "pass",
      authoritativeMs: raceResult.elapsedMs,
      acquiredBy: String(raceResult.value.entity.acquisition.acquired_by),
    });

    // Prove the complete physical farming loop with real selected hotbar refs:
    // JS publishes till -> plant -> water, logic validates the tools and creates
    // native state, Gaia advances the crop, then harvest creates the world drop
    // which synchronizes back into the browser-side farming journal.
    const plants = (
      await bridgeCall(
        first.page,
        "findLocalByComponent",
        "farming_plant_component"
      )
    )
      .map(([, serialized]) => deserializeEntity(serialized))
      .filter(
        (entity) => entity?.farming_plant_component?.status === "fully_grown"
      );
    if (plants.length > 0) {
      const referencePlant = plants[0];
      const tillTarget = await bridgeCall(
        first.page,
        "findTillableVoxelNear",
        referencePlant.position.v.map(Math.floor),
        8
      );
      assert(
        tillTarget,
        "no tillable voxel was found near the farming fixture"
      );
      const hoeId = harthmereNativeBiomesIdForItemId("7539420629350046");
      const seedId = harthmereNativeBiomesIdForItemId("seed_carrot");
      const wateringCanId =
        harthmereNativeBiomesIdForItemId("7539420629350045");
      assert(
        hoeId && seedId && wateringCanId,
        "native farming item ids missing"
      );
      const playerBeforeFarm = await authoritativeEntity(
        first.page,
        first.userId
      );
      const farmInventory = Inventory.clone(playerBeforeFarm.entity.inventory);
      farmInventory.hotbar[0] = countOf(hoeId, 1n);
      farmInventory.hotbar[1] = countOf(seedId, 2n);
      farmInventory.hotbar[2] = countOf(wateringCanId, 1n);
      farmInventory.selected = { kind: "hotbar", idx: 0 };
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({
            v: [
              tillTarget.position[0] + 0.5,
              tillTarget.position[1] + 1,
              tillTarget.position[2] + 0.5,
            ],
          }),
          inventory: farmInventory,
          selected_item: SelectedItem.create({ item: farmInventory.hotbar[0] }),
        },
      });

      const voxelBeforeTill = await bridgeCall(
        first.page,
        "farmingVoxelSnapshot",
        tillTarget.position
      );
      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(
          new TillSoilEvent({
            id: first.userId,
            positions: [tillTarget.position],
            shard_ids: [tillTarget.terrainEntityId],
            tool_ref: { kind: "hotbar", idx: 0 },
            occupancy_ids: tillTarget.occupancyId
              ? [tillTarget.occupancyId]
              : [],
          })
        )
      );
      const tilled = await waitFor(
        "native hoe tills a voxel",
        () =>
          bridgeCall(first.page, "farmingVoxelSnapshot", tillTarget.position),
        (snapshot) => snapshot.terrainId !== voxelBeforeTill.terrainId,
        originSyncGateMs,
        timeoutMs
      );

      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(
          new PlantSeedEvent({
            id: tillTarget.terrainEntityId,
            position: tillTarget.position,
            user_id: first.userId,
            seed: { kind: "hotbar", idx: 1 },
            occupancy_id: tillTarget.occupancyId,
            existing_farming_id: undefined,
          })
        )
      );
      const planted = await waitFor(
        "native seed creates synchronized ECS plant",
        async () => {
          const voxel = await bridgeCall(
            first.page,
            "farmingVoxelSnapshot",
            tillTarget.position
          );
          return {
            voxel,
            plant: voxel.farmingId
              ? await authoritativeEntity(first.page, voxel.farmingId)
              : undefined,
          };
        },
        ({ voxel, plant }) =>
          Boolean(
            voxel.farmingId &&
              plant?.entity?.farming_plant_component?.planter === first.userId
          ),
        originSyncGateMs,
        timeoutMs
      );
      const plantedId = planted.value.voxel.farmingId;
      assert(plantedId, "planted voxel did not retain a farming id");

      const dryPlant = FarmingPlantComponent.clone(
        planted.value.plant.entity.farming_plant_component
      );
      dryPlant.status = "growing";
      dryPlant.water_level = 0.2;
      await applyFixture(first.page, {
        kind: "update",
        entity: { id: plantedId, farming_plant_component: dryPlant },
      });

      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(
          new WaterPlantsEvent({
            id: first.userId,
            plant_ids: [plantedId],
            tool_ref: { kind: "hotbar", idx: 2 },
          })
        )
      );
      const watered = await waitFor(
        "watering can mutates native inventory and plant",
        async () => ({
          player: await authoritativeEntity(first.page, first.userId),
          plant: await authoritativeEntity(first.page, plantedId),
        }),
        ({ player, plant }) =>
          Number(player.entity?.inventory?.hotbar?.[2]?.item?.waterAmount) <
            5 &&
          (plant.entity?.farming_plant_component?.water_level > 0 ||
            plant.entity?.farming_plant_component?.player_actions?.some(
              (action) => action.kind === "water"
            )),
        Math.max(5000, originSyncGateMs),
        timeoutMs
      );

      const plantedAuthoritative = await authoritativeEntity(
        first.page,
        plantedId
      );
      const accelerated = FarmingPlantComponent.clone(
        plantedAuthoritative.entity.farming_plant_component
      );
      accelerated.status = "growing";
      accelerated.water_level = 1;
      accelerated.wilt = 0;
      accelerated.last_tick = secondsSinceEpoch() - 14 * 24 * 60 * 60;
      await applyFixture(first.page, {
        kind: "update",
        entity: { id: plantedId, farming_plant_component: accelerated },
      });
      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(new PokePlantEvent({ id: plantedId }))
      );
      const grown = await waitFor(
        "Gaia grows planted crop to maturity",
        () => authoritativeEntity(first.page, plantedId),
        ({ entity }) =>
          entity?.farming_plant_component?.status === "fully_grown",
        Math.max(5000, secondClientSyncGateMs),
        timeoutMs
      );
      const frontendCrop = await waitFor(
        "grown crop returns to JavaScript farming journal",
        () => bridgeCall(first.page, "farmingFrontendSnapshot"),
        (snapshot) =>
          snapshot?.plants?.some(
            (plant) =>
              String(plant.id) === String(plantedId) &&
              plant.status === "fully_grown"
          ),
        originSyncGateMs,
        timeoutMs
      );

      const plantPosition = tillTarget.position;
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({
            v: [
              plantPosition[0] + 0.5,
              plantPosition[1] + 1,
              plantPosition[2] + 0.5,
            ],
          }),
        },
      });
      const dropsBeforeHarvest = new Set(
        (await bridgeCall(first.page, "findLocalByComponent", "grab_bag")).map(
          ([, serialized]) => deserializeEntity(serialized).id
        )
      );
      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(
          new HarvestPlantEvent({
            id: first.userId,
            plant_id: plantedId,
            position: plantPosition.map(Math.floor),
          })
        )
      );
      const queued = await waitFor(
        "harvest action queued in ECS",
        () => authoritativeEntity(first.page, plantedId),
        ({ entity }) =>
          entity?.farming_plant_component?.player_actions?.some(
            (action) => action.kind === "harvest"
          ),
        acceptanceGateMs
      );
      const materialized = await waitFor(
        "Gaia harvest materializes native drop",
        async () => ({
          plant: await authoritativeEntity(first.page, plantedId),
          drops: (
            await bridgeCall(first.page, "findLocalByComponent", "grab_bag")
          )
            .map(([, serialized]) => deserializeEntity(serialized))
            .filter((entity) => !dropsBeforeHarvest.has(entity.id)),
        }),
        ({ plant: plantState, drops }) =>
          !plantState.entity && drops.length > 0,
        Math.max(5000, secondClientSyncGateMs),
        timeoutMs
      );
      report.scenarios.push({
        name: "hotbar voxel farming through native ECS and Gaia",
        eventKinds: [
          "tillSoilEvent",
          "plantSeedEvent",
          "waterPlantsEvent",
          "pokePlantEvent",
          "harvestPlantEvent",
        ],
        status: "pass",
        tilledMs: tilled.elapsedMs,
        plantedMs: planted.elapsedMs,
        wateredMs: watered.elapsedMs,
        grownMs: grown.elapsedMs,
        frontendMs: frontendCrop.elapsedMs,
        queuedMs: queued.elapsedMs,
        materializedMs: materialized.elapsedMs,
      });
    } else if (process.env.HARTHMERE_E2E_ALLOW_NO_RIPE_PLANT === "1") {
      report.scenarios.push({
        name: "hotbar voxel farming through native ECS and Gaia",
        status: "skipped",
        reason: "no synchronized fully-grown plant in minimal test world",
      });
    } else {
      throw new Error(
        "No synchronized fully-grown plant was available; production-shaped E2E requires a farming fixture"
      );
    }

    // Reload and a same-session second page must reconstruct the authoritative
    // player, wearing, inventory, health, and vitals from sync.
    await first.page.reload({
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await first.page.waitForFunction(
      () => globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1",
      undefined,
      { timeout: timeoutMs }
    );
    const reloaded = await waitFor(
      "reconnect reconstructs native player state",
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        Boolean(entity?.inventory) &&
        Boolean(entity?.wearing) &&
        Boolean(entity?.health) &&
        Boolean(entity?.trigger_state),
      secondClientSyncGateMs
    );
    report.scenarios.push({
      name: "same-user reconnect readback",
      status: "pass",
      originSyncMs: reloaded.elapsedMs,
    });

    assert.deepEqual(
      report.browser.failures,
      [],
      `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
    );

    report.finishedAt = new Date().toISOString();
    report.status = "pass";
    console.log(`PASS ${report.scenarios.length} native ECS browser scenarios`);
  } finally {
    if (first?.page) {
      await first.page
        .screenshot({
          path: path.join(artifactsDir, `${runId}-client-a.png`),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    if (second?.page) {
      await second.page
        .screenshot({
          path: path.join(artifactsDir, `${runId}-client-b.png`),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    if (sameUserPeer) {
      await sameUserPeer
        .screenshot({
          path: path.join(artifactsDir, `${runId}-client-a-peer.png`),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    await first?.context?.close().catch(() => undefined);
    await second?.context?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

run()
  .catch((error) => {
    report.finishedAt = new Date().toISOString();
    report.status = "fail";
    report.error = error?.stack || String(error);
    console.error(`FAIL ${report.error}`);
    process.exitCode = 1;
  })
  .finally(() => {
    const reportPath = path.join(artifactsDir, `${runId}-report.json`);
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        report,
        (_key, value) => (typeof value === "bigint" ? `${value}n` : value),
        2
      )
    );
    console.log(`REPORT ${reportPath}`);
  });
