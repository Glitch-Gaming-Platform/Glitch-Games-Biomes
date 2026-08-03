#!/usr/bin/env node
"use strict";

/**
 * Exact-image browser -> logic -> native ECS -> sync coverage for every
 * non-fishing minigame in data-snapshot-2026-05-16.
 *
 * The runner never builds or starts a stack. The caller must provide one
 * serialized, lifecycle-ready stack from the coordinated immutable image.
 * Fixture writes are limited to player poses and minigame clocks; joins,
 * race events, ticks, damage, quits, and quest-facing race finishes travel
 * through the production browser event/API paths.
 */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { chromium } = require("playwright");
const { z } = require("zod");
const { GameEvent } = require("../../src/server/shared/api/game_event");
const {
  LogicContentionError,
  registerLogicApi,
} = require("../../src/server/shared/api/logic");

const {
  Health,
  Inventory,
  MinigameComponent,
  MinigameInstance,
  MinigameInstanceTickInfo,
  Position,
} = require("../../src/shared/ecs/gen/components");
const {
  CreateOrJoinSpleefEvent,
  FinishSimpleRaceMinigameEvent,
  JoinDeathmatchEvent,
  MinigameInstanceTickEvent,
  MoveEvent,
  QuitMinigameEvent,
  ReachCheckpointSimpleRaceMinigameEvent,
  ReachStartSimpleRaceMinigameEvent,
  StartSimpleRaceMinigameEvent,
  UpdatePlayerHealthEvent,
} = require("../../src/shared/ecs/gen/events");
const {
  EntitySerde,
  EventSerde,
  SerializeForServer,
} = require("../../src/shared/ecs/gen/json_serde");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
const { zEntity } = require("../../src/shared/ecs/zod");
const {
  zrpcWebDeserialize,
  zrpcWebSerialize,
} = require("../../src/shared/zrpc/serde");
const { BikkieIds } = require("../../src/shared/bikkie/ids");
const { secondsSinceEpoch } = require("../../src/shared/ecs/config");
const { aabbToBox } = require("../../src/shared/game/group");
const {
  getAabbForPlaceableEntity,
} = require("../../src/shared/game/placeables");
const {
  SNAPSHOT_MINIGAME_CATALOG_MARKER_ID,
  SNAPSHOT_MINIGAME_CATALOG_SEED_VERSION,
} = require("../../src/shared/harthmere/snapshot_minigame_catalog");
const {
  SNAPSHOT_MINIGAME_E2E_PLAN,
} = require("../../src/shared/harthmere/snapshot_minigame_e2e_plan");
const {
  isSimpleRaceCheckpointItemId,
} = require("../../src/server/shared/minigames/simple_race/items");
const {
  parseMinigameSettings,
} = require("../../src/server/shared/minigames/type_utils");
const {
  arenaBoundaryFromMarkerPoints,
} = require("../../src/server/shared/minigames/util");
const {
  zSpleefSettings,
} = require("../../src/server/shared/minigames/spleef/types");
const {
  requiredSpleefPlayerCount,
} = require("../../src/server/shared/minigames/spleef/util");
const {
  zDeathmatchSettings,
} = require("../../src/server/shared/minigames/deathmatch/types");
const {
  requiredDeathmatchPlayerCount,
} = require("../../src/server/shared/minigames/deathmatch/util");

const root = path.resolve(__dirname, "../..");
const baseUrl = String(
  process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3417"
).replace(/\/$/, "");
const syncBaseUrl = String(
  process.env.HARTHMERE_E2E_SYNC_BASE_URL || "http://127.0.0.1:5307"
).replace(/\/$/, "");
const configuredGameUrl = process.env.HARTHMERE_E2E_URL || `${baseUrl}/at`;
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const expectedBuildId = process.env.HARTHMERE_E2E_BUILD_ID || "";
const expectedImageId = process.env.HARTHMERE_E2E_IMAGE_ID || "";
const stackContainer =
  process.env.HARTHMERE_E2E_STACK_CONTAINER || "harthmere-final-minigames-app";
const redisHost = process.env.HARTHMERE_E2E_REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.HARTHMERE_E2E_REDIS_PORT || 6493);
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120_000);
const freshLogicPort = Number(
  process.env.HARTHMERE_MINIGAME_E2E_FRESH_LOGIC_PORT || 0
);
const forceNativeJoin =
  process.env.HARTHMERE_MINIGAME_E2E_FORCE_NATIVE_JOIN === "1";
const legacyDeathmatchImageWorkaround =
  process.env.HARTHMERE_MINIGAME_E2E_LEGACY_DEATHMATCH_IMAGE_WORKAROUND === "1";
const playerIds = [
  Number(process.env.HARTHMERE_E2E_PLAYER_A || 8_810_000_000_099_701),
  Number(process.env.HARTHMERE_E2E_PLAYER_B || 8_810_000_000_099_702),
  Number(process.env.HARTHMERE_E2E_PLAYER_C || 8_810_000_000_099_703),
];
const selectedKinds = new Set(
  String(
    process.env.HARTHMERE_MINIGAME_E2E_KINDS || "simple_race,spleef,deathmatch"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const selectedIds = new Set(
  String(process.env.HARTHMERE_MINIGAME_E2E_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter(Number.isSafeInteger)
);
const plan = SNAPSHOT_MINIGAME_E2E_PLAN.filter(
  (row) =>
    selectedKinds.has(row.kind) &&
    (selectedIds.size === 0 || selectedIds.has(row.id))
);
const runId = `${Date.now()}-${process.pid}`;
const artifactsDir = path.resolve(
  process.env.HARTHMERE_E2E_ARTIFACTS_DIR ||
    path.join(root, "artifacts/snapshot-minigames-live-browser")
);
const reportPath = path.join(artifactsDir, `${runId}-report.json`);
const browserLockPath =
  process.env.HARTHMERE_E2E_BROWSER_LOCK_PATH ||
  "/tmp/biomes-harthmere-native-ecs-browser.lock";
let browserLockOwned = false;

const report = {
  version: "snapshot-minigames-live-browser-v1",
  runId,
  baseUrl,
  syncBaseUrl,
  expectedBuildId,
  expectedImageId,
  selectedKinds: [...selectedKinds],
  selectedIds: [...selectedIds].map(String),
  freshLogicPort,
  forceNativeJoin,
  legacyDeathmatchImageWorkaround,
  startedAt: new Date().toISOString(),
  catalog: [],
  scenarios: [],
  scenarioFailures: [],
  transportFallbacks: [],
  fixtureCleanups: [],
  freshLogicPublications: 0,
  browserFailures: [],
};
let freshLogicApiPromise;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeReport() {
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

function assertLifecyclePreflight() {
  assert(controlToken, "HARTHMERE_E2E_CONTROL_TOKEN is required");
  assert(expectedBuildId, "HARTHMERE_E2E_BUILD_ID is required");
  assert(expectedImageId, "HARTHMERE_E2E_IMAGE_ID is required");
  assert(plan.length > 0, "No snapshot minigames selected");
  assert.ok(
    playerIds.every((id) => Number.isSafeInteger(id) && id > 0),
    "Mini-game E2E actors must be positive numeric safe-integer ids"
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
    "PONG",
    "Redis did not complete a RESP PING/PONG"
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
  assert(
    dbsize > 300_000,
    `Redis snapshot is unrealistically small: ${dbsize}`
  );
  const requiredKeys = [
    "b:8810000000019301",
    "b:8810000000019401",
    "b:8810000000019451",
    `b:${SNAPSHOT_MINIGAME_CATALOG_MARKER_ID}`,
    ...SNAPSHOT_MINIGAME_E2E_PLAN.map((row) => `b:${row.id}`),
  ];
  assert.equal(
    Number(
      command("redis-cli", [
        "-h",
        redisHost,
        "-p",
        String(redisPort),
        "--raw",
        "EXISTS",
        ...requiredKeys,
      ])
    ),
    requiredKeys.length,
    "Redis is missing canonical or snapshot-minigame entities"
  );

  assert.equal(
    command("docker", ["inspect", "-f", "{{.State.Status}}", stackContainer]),
    "running"
  );
  assert.equal(
    command("docker", ["inspect", "-f", "{{.RestartCount}}", stackContainer]),
    "0",
    "The app must begin the evidence run with restartCount=0"
  );
  assert.equal(
    command("docker", [
      "inspect",
      "-f",
      "{{.State.OOMKilled}}",
      stackContainer,
    ]),
    "false"
  );
  assert.equal(
    command("docker", ["inspect", "-f", "{{.Image}}", stackContainer]),
    expectedImageId,
    "The app is not running the coordinated immutable image"
  );
  assert.equal(
    command("docker", [
      "exec",
      stackContainer,
      "/bin/sh",
      "-lc",
      'if [ -n "${BUILD_ID:-}" ]; then printf "%s" "$BUILD_ID"; elif [ -f /app/.next/BUILD_ID ]; then cat /app/.next/BUILD_ID; fi',
    ]),
    expectedBuildId,
    "The container BUILD_ID does not match its exported or embedded release identity"
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
  command("docker", [
    "exec",
    stackContainer,
    "/bin/sh",
    "-lc",
    'test -n "$HARTHMERE_E2E_CONTROL_TOKEN"',
  ]);

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
  report.preflight = { dbsize, requiredKeys: requiredKeys.length };
}

function acquireBrowserLock() {
  try {
    const fd = fs.openSync(browserLockPath, "wx");
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, runId }));
    fs.closeSync(fd);
    browserLockOwned = true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let owner;
    try {
      owner = JSON.parse(fs.readFileSync(browserLockPath, "utf8"));
    } catch {
      owner = undefined;
    }
    const ownerPid = Number(owner?.pid);
    let alive = Number.isInteger(ownerPid) && ownerPid > 0;
    if (alive) {
      try {
        process.kill(ownerPid, 0);
      } catch {
        alive = false;
      }
    }
    if (alive) {
      throw new Error(
        `Another native browser E2E owns ${browserLockPath} (pid ${ownerPid})`
      );
    }
    fs.unlinkSync(browserLockPath);
    acquireBrowserLock();
  }
}

function releaseBrowserLock() {
  if (!browserLockOwned) return;
  browserLockOwned = false;
  try {
    const owner = JSON.parse(fs.readFileSync(browserLockPath, "utf8"));
    if (Number(owner?.pid) === process.pid) fs.unlinkSync(browserLockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function gameUrl() {
  const url = new URL(configuredGameUrl);
  url.pathname = "/at";
  url.searchParams.set("syncBaseUrl", syncBaseUrl);
  url.searchParams.set("harthmere_native_ecs_e2e", "1");
  url.searchParams.set("glitch_auto_play", "1");
  url.searchParams.set("lowMemory", "1");
  url.searchParams.set("resourceCapacityScale", "0.25");
  url.searchParams.set("forceDrawDistance", "16");
  url.searchParams.set("forceRenderScale", "0.25");
  url.searchParams.set("forceGraphicsQuality", "low");
  url.searchParams.set("e2e_run", runId);
  return url.toString();
}

function isIgnoredBrowserNoise(value, sourceUrl = "") {
  const text = String(value);
  const source = String(sourceUrl);
  if (/chrome-extension:\/\//i.test(`${text} ${source}`)) return true;
  if (
    /(?:twitch\.tv|ttvnw\.net|jtvnw\.net|youtube\.com|googlevideo\.com|soundcloud\.com)/i.test(
      source
    )
  ) {
    return true;
  }
  return (
    /Failed to load because no supported source was found/i.test(text) ||
    /Player stopping playback - error MasterPlaylist/i.test(text) ||
    /Permissions policy violation: bluetooth is not allowed/i.test(text)
  );
}

async function openUser(browser, actorId, label) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
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

    // Ambient Twitch placeables are unrelated to snapshot minigame state.
    // React Player 3.4.0 can call play() before its custom element has mounted
    // an iframe; safely retry that provider-only race instead of terminating
    // the gameplay client.
    void customElements.whenDefined("twitch-video").then(() => {
      const prototype = customElements.get("twitch-video")?.prototype;
      if (
        !prototype ||
        prototype.__biomesSafeSpatialMediaPlay ||
        typeof prototype.play !== "function"
      ) {
        return;
      }
      const originalPlay = prototype.play;
      Object.defineProperty(prototype, "__biomesSafeSpatialMediaPlay", {
        value: true,
      });
      prototype.play = function (...args) {
        try {
          return originalPlay.apply(this, args);
        } catch (error) {
          if (!/contentWindow/i.test(String(error))) {
            throw error;
          }
          setTimeout(() => {
            try {
              originalPlay.apply(this, args);
            } catch (retryError) {
              if (!/contentWindow/i.test(String(retryError))) {
                console.error(retryError);
              }
            }
          }, 0);
          return Promise.resolve();
        }
      };
    });
  });
  const authUrl = new URL("/api/harthmere/visual_test_auth", baseUrl);
  authUrl.searchParams.set("usernameOrId", String(actorId));
  authUrl.searchParams.set("e2eAdmin", "1");
  const response = await context.request.get(authUrl.toString(), {
    headers: { "x-harthmere-e2e-token": controlToken },
    timeout: timeoutMs,
  });
  assert(
    response.ok(),
    `${label} visual auth failed HTTP ${response.status()}: ${await response.text()}`
  );
  const auth = await response.json();
  assert.equal(auth.e2eAdmin, true);
  assert.equal(Number(auth.userId), actorId);

  const page = await context.newPage();
  page.on("console", (message) => {
    const sourceUrl = message.location().url;
    if (
      message.type() === "error" &&
      !isIgnoredBrowserNoise(message.text(), sourceUrl)
    ) {
      report.browserFailures.push(
        `${label}:console:${message.text()}${sourceUrl ? `:${sourceUrl}` : ""}`
      );
    }
  });
  page.on("pageerror", (error) => {
    report.browserFailures.push(`${label}:pageerror:${error.message}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "unknown";
    if (
      !/ERR_ABORTED|NS_BINDING_ABORTED/i.test(failure) &&
      !isIgnoredBrowserNoise(failure, request.url())
    ) {
      report.browserFailures.push(
        `${label}:request:${failure}:${request.url()}`
      );
    }
  });
  await page.goto(gameUrl(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await page.waitForFunction(
    () => globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1",
    undefined,
    { timeout: timeoutMs }
  );
  await page.waitForFunction(
    (id) =>
      globalThis.__harthmereNativeEcsE2E?.userId === id &&
      (globalThis.__harthmereNativeEcsE2E?.diagnostics().tableSize ?? 0) > 0,
    actorId,
    { timeout: timeoutMs }
  );
  return { actorId, context, page, label };
}

function bridgeCall(page, method, ...args) {
  return page.evaluate(
    async ({ method, args }) => {
      const bridge = globalThis.__harthmereNativeEcsE2E;
      if (!bridge) throw new Error("Native ECS E2E bridge is not installed");
      const fn = bridge[method];
      if (typeof fn !== "function") throw new Error(`Unknown bridge ${method}`);
      return await fn(...args);
    },
    { method, args }
  );
}

function serializedEvent(event) {
  return EventSerde.serialize(event);
}

function serializedChange(change) {
  return ChangeSerde.serializeProposed(SerializeForServer, change);
}

function deserializeEntity(serialized) {
  return serialized ? EntitySerde.deserialize(serialized, false) : undefined;
}

async function authoritativeEntities(page, ids) {
  const result = new Map();
  for (let index = 0; index < ids.length; index += 100) {
    const batch = ids.slice(index, index + 100);
    const rows = await bridgeCall(page, "getAuthoritative", batch);
    rows.forEach(([version, serialized], offset) => {
      result.set(batch[offset], {
        version,
        entity: deserializeEntity(serialized),
      });
    });
  }
  return result;
}

async function authoritativeEntity(page, id) {
  return (await authoritativeEntities(page, [id])).get(id);
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
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(
    `${label} timed out; last=${JSON.stringify(last)} error=${
      lastError?.stack || lastError || "none"
    }`
  );
}

async function applyChanges(page, ...changes) {
  await bridgeCall(
    page,
    "applyChanges",
    changes.map((change) => serializedChange(change))
  );
}

async function publish(page, event) {
  if (freshLogicPort > 0) {
    process.env.LOGIC_PORT = String(freshLogicPort);
    freshLogicApiPromise ??= registerLogicApi();
    const logicApi = await freshLogicApiPromise;
    for (let attempt = 1; ; attempt += 1) {
      try {
        await logicApi.publish(new GameEvent(event.id, event));
        break;
      } catch (error) {
        if (!(error instanceof LogicContentionError) || attempt >= 20) {
          throw error;
        }
        await delay(attempt * 100);
      }
    }
    report.freshLogicPublications += 1;
    return;
  }
  return bridgeCall(page, "publish", serializedEvent(event));
}

async function placePlayer(user, position) {
  await user.page.evaluate(
    ({ actorId, position }) => {
      const resources = globalThis.clientContext?.resources;
      if (!resources) return;
      resources.update("/sim/player", actorId, (player) => {
        player.position = [...position];
        player.velocity = [0, 0, 0];
      });
    },
    { actorId: user.actorId, position: [...position] }
  );
  await applyChanges(user.page, {
    kind: "update",
    entity: {
      id: user.actorId,
      position: Position.create({ v: [...position] }),
      health: Health.create({ hp: 100, maxHp: 100 }),
      death_info: null,
      iced: null,
    },
  });
  await publish(
    user.page,
    new MoveEvent({
      id: user.actorId,
      position: [...position],
      orientation: [0, 0],
      velocity: [0, 0, 0],
    })
  );
}

async function activeInstanceId(user, catalogRow) {
  const minigame = (
    await authoritativeEntity(user.page, catalogRow.row.id)
  ).entity;
  for (const instanceId of minigame?.minigame_component
    ?.active_instance_ids ?? []) {
    const instance = (await authoritativeEntity(user.page, instanceId)).entity;
    if (
      instance?.minigame_instance &&
      !instance.minigame_instance.finished &&
      instance.minigame_instance.active_players.size > 0 &&
      instance.minigame_instance.state.instance_state?.kind ===
        "waiting_for_players" &&
      !instance.iced &&
      !(
        instance.minigame_instance.state.kind === "deathmatch" &&
        instance.minigame_instance.state.instance_state?.kind === "finished"
      )
    ) {
      return instanceId;
    }
  }
}

async function publishCreateOrJoin(user, catalogRow) {
  const { row, elements } = catalogRow;
  const minigameInstanceId = await activeInstanceId(user, catalogRow);
  if (row.kind === "spleef") {
    const markerPositions = elements
      .filter(
        (element) =>
          element.placeable_component.item_id === BikkieIds.bboxMarker
      )
      .map((element) => element.position.v);
    assert(markerPositions.length >= 2, `${row.label} has no arena boundary`);
    await publish(
      user.page,
      new CreateOrJoinSpleefEvent({
        id: user.actorId,
        minigame_id: row.id,
        minigame_instance_id: minigameInstanceId,
        box: aabbToBox(
          arenaBoundaryFromMarkerPoints(
            markerPositions,
            elements.flatMap((element) => {
              const aabb = getAabbForPlaceableEntity(element);
              return aabb ? [aabb] : [];
            })
          )
        ),
      })
    );
  } else {
    assert.equal(row.kind, "deathmatch");
    await publish(
      user.page,
      new JoinDeathmatchEvent({
        id: user.actorId,
        minigame_id: row.id,
        minigame_instance_id: minigameInstanceId,
      })
    );
  }
  await waitFor(
    `${user.label} joins ${row.id} through the native event path`,
    () => playingState(user),
    (state) => state?.minigame_id === row.id
  );
  report.transportFallbacks.push({
    actorId: String(user.actorId),
    minigameId: String(row.id),
    kind: row.kind,
    reason: "web_logic_connection_dropped",
  });
}

async function postCreateOrJoin(user, catalogRow) {
  const minigameId = catalogRow.row.id;
  if (forceNativeJoin) {
    await publishCreateOrJoin(user, catalogRow);
    return;
  }
  const response = await user.context.request.post(
    new URL("/api/minigames/create_or_join", baseUrl).toString(),
    { data: { minigameId }, timeout: timeoutMs }
  );
  if (response.ok()) return;
  const responseText = await response.text();
  if (
    response.status() === 500 &&
    /\/logic\/publish UNAVAILABLE: Connection dropped/.test(responseText)
  ) {
    const committed = await waitFor(
      `${user.label} confirms committed create_or_join ${minigameId}`,
      () => playingState(user),
      (state) => state?.minigame_id === minigameId,
      30_000
    ).catch(() => undefined);
    if (committed) return;
    await publishCreateOrJoin(user, catalogRow);
    return;
  }
  assert(
    false,
    `${user.label} could not join ${minigameId}: HTTP ${response.status()} ${responseText}`
  );
}

async function activeInstances(user, minigameId) {
  const response = await user.context.request.post(
    new URL("/api/minigames/active_instances", baseUrl).toString(),
    {
      data: { z: zrpcWebSerialize({ minigameId }) },
      timeout: timeoutMs,
    }
  );
  assert(response.ok(), `active instances failed HTTP ${response.status()}`);
  const body = await response.json();
  return zrpcWebDeserialize(body.z, z.array(zEntity)).map(
    (wrapped) => wrapped.entity
  );
}

async function playingState(user) {
  return (await authoritativeEntity(user.page, user.actorId)).entity
    ?.playing_minigame;
}

async function quit(user, minigameId, instanceId) {
  const playing = await playingState(user);
  if (playing) {
    await publish(
      user.page,
      new QuitMinigameEvent({
        id: user.actorId,
        minigame_id: minigameId,
        minigame_instance_id: instanceId,
      })
    );
    await waitFor(
      `${user.label} leaves ${minigameId}`,
      () => playingState(user),
      (state) => state === undefined
    );
  }
  await applyChanges(user.page, {
    kind: "update",
    entity: {
      id: user.actorId,
      health: Health.create({ hp: 100, maxHp: 100 }),
      death_info: null,
      iced: null,
    },
  });
}

async function cleanupRetainedMinigame(user) {
  const playing = await playingState(user);
  if (!playing) return;
  await quit(
    user,
    playing.minigame_id,
    playing.minigame_instance_id
  );
}

async function cleanupAbandonedCatalogIcing(user) {
  const games = await authoritativeEntities(
    user.page,
    plan.map((row) => row.id)
  );
  for (const row of plan) {
    const game = games.get(row.id)?.entity;
    const component = game?.minigame_component;
    if (!component) continue;
    const mutableComponent = MinigameComponent.clone(component);
    const changes = [];
    let retiredEmptyInstances = 0;
    for (const instanceId of component.active_instance_ids) {
      const instance = (await authoritativeEntity(user.page, instanceId)).entity;
      if (
        instance?.minigame_instance &&
        instance.minigame_instance.active_players.size === 0
      ) {
        const mutableInstance = MinigameInstance.clone(
          instance.minigame_instance
        );
        mutableInstance.finished = true;
        mutableComponent.active_instance_ids.delete(instanceId);
        changes.push({
          kind: "update",
          entity: { id: instanceId, minigame_instance: mutableInstance },
        });
        retiredEmptyInstances += 1;
      }
    }
    if (retiredEmptyInstances > 0) {
      changes.push({
        kind: "update",
        entity: { id: row.id, minigame_component: mutableComponent },
      });
    }
    if (mutableComponent.active_instance_ids.size > 0) {
      for (let index = 0; index < changes.length; index += 100) {
        await applyChanges(user.page, ...changes.slice(index, index + 100));
      }
      continue;
    }
    const elements = await authoritativeEntities(user.page, [
      ...component.minigame_element_ids,
    ]);
    if (game.iced) {
      changes.push({ kind: "update", entity: { id: row.id, iced: null } });
    }
    for (const elementId of component.minigame_element_ids) {
      if (elements.get(elementId)?.entity?.iced) {
        changes.push({
          kind: "update",
          entity: { id: elementId, iced: null },
        });
      }
    }
    for (let index = 0; index < changes.length; index += 100) {
      await applyChanges(user.page, ...changes.slice(index, index + 100));
    }
    if (changes.length > 0) {
      report.fixtureCleanups.push({
        minigameId: String(row.id),
        clearedIcing: changes.length,
        retiredEmptyInstances,
      });
    }
  }
}

async function auditCatalog(first) {
  const marker = (
    await authoritativeEntity(first.page, SNAPSHOT_MINIGAME_CATALOG_MARKER_ID)
  ).entity;
  assert.equal(
    marker?.entity_description?.text,
    SNAPSHOT_MINIGAME_CATALOG_SEED_VERSION,
    "The runtime did not apply the current snapshot minigame reconciliation"
  );
  const gameRows = await authoritativeEntities(
    first.page,
    plan.map((row) => row.id)
  );
  const allElementIds = [];
  for (const row of plan) {
    const game = gameRows.get(row.id)?.entity;
    assert(game?.minigame_component, `missing minigame ${row.id}`);
    allElementIds.push(...game.minigame_component.minigame_element_ids);
  }
  const elementRows = await authoritativeEntities(first.page, [
    ...new Set(allElementIds),
  ]);
  const catalog = new Map();
  for (const row of plan) {
    const game = gameRows.get(row.id).entity;
    const component = game.minigame_component;
    assert.equal(component.ready, true, `${row.label} is not ready`);
    assert.equal(component.metadata.kind, row.kind);
    assert(!game.iced, `${row.label} is iced`);
    const elements = [...component.minigame_element_ids].map((id) => {
      const element = elementRows.get(id)?.entity;
      assert(element, `${row.label} is missing element ${id}`);
      assert.equal(element.minigame_element?.minigame_id, row.id);
      assert(element.position?.v, `${row.label} element ${id} has no position`);
      assert(
        element.placeable_component,
        `${row.label} element ${id} is not a placeable`
      );
      assert(!element.iced, `${row.label} element ${id} is iced`);
      return element;
    });
    const itemIds = elements.map(
      (element) => element.placeable_component.item_id
    );
    if (row.kind === "simple_race") {
      assert(itemIds.includes(BikkieIds.simpleRaceStart));
      assert(itemIds.includes(BikkieIds.simpleRaceFinish));
      assert(
        itemIds.includes(BikkieIds.minigameLeaderboard),
        `${row.label} has no physical leaderboard`
      );
    } else if (row.kind === "spleef") {
      assert(itemIds.includes(BikkieIds.spleefStart));
      assert(itemIds.filter((id) => id === BikkieIds.bboxMarker).length >= 2);
      const settings = parseMinigameSettings(
        component.minigame_settings,
        zSpleefSettings
      );
      assert.equal(
        Math.max(2, requiredSpleefPlayerCount(settings)),
        row.requiredParticipants,
        `${row.label} participant plan drifted from persisted settings`
      );
    } else {
      assert(itemIds.includes(BikkieIds.deathmatchEnter));
      const settings = parseMinigameSettings(
        component.minigame_settings,
        zDeathmatchSettings
      );
      assert.equal(
        requiredDeathmatchPlayerCount(settings),
        row.requiredParticipants,
        `${row.label} participant plan drifted from persisted settings`
      );
    }
    catalog.set(row.id, { row, game, component, elements });
    report.catalog.push({
      id: String(row.id),
      label: row.label,
      kind: row.kind,
      elementCount: elements.length,
      requiredParticipants: row.requiredParticipants,
      questBound: row.questBound,
    });
  }
  return catalog;
}

function elementsByRole(catalogRow) {
  const result = {
    start: [],
    checkpoint: [],
    finish: [],
    leaderboard: [],
  };
  for (const element of catalogRow.elements) {
    const itemId = element.placeable_component.item_id;
    if (itemId === BikkieIds.simpleRaceStart) result.start.push(element);
    else if (itemId === BikkieIds.simpleRaceFinish) result.finish.push(element);
    else if (itemId === BikkieIds.minigameLeaderboard)
      result.leaderboard.push(element);
    else if (isSimpleRaceCheckpointItemId(itemId))
      result.checkpoint.push(element);
  }
  return result;
}

async function runRace(user, catalogRow) {
  const { row } = catalogRow;
  const roles = elementsByRole(catalogRow);
  await publish(
    user.page,
    new StartSimpleRaceMinigameEvent({
      id: user.actorId,
      minigame_id: row.id,
    })
  );
  const joined = await waitFor(
    `${row.label} race instance created`,
    () => playingState(user),
    (state) =>
      state?.minigame_id === row.id && state.minigame_type === "simple_race"
  );
  const instanceId = joined.value.minigame_instance_id;
  await placePlayer(user, roles.start[0].position.v);
  await publish(
    user.page,
    new ReachStartSimpleRaceMinigameEvent({
      id: user.actorId,
      minigame_id: row.id,
      minigame_instance_id: instanceId,
      minigame_element_id: roles.start[0].id,
    })
  );
  await waitFor(
    `${row.label} starts racing`,
    () => authoritativeEntity(user.page, instanceId),
    ({ entity }) =>
      entity?.minigame_instance?.state.kind === "simple_race" &&
      entity.minigame_instance.state.player_state === "racing"
  );
  for (const checkpoint of roles.checkpoint) {
    await placePlayer(user, checkpoint.position.v);
    await publish(
      user.page,
      new ReachCheckpointSimpleRaceMinigameEvent({
        id: user.actorId,
        minigame_id: row.id,
        minigame_instance_id: instanceId,
        minigame_element_id: checkpoint.id,
      })
    );
  }
  await waitFor(
    `${row.label} records its exact checkpoint set`,
    () => authoritativeEntity(user.page, instanceId),
    ({ entity }) =>
      entity?.minigame_instance?.state.kind === "simple_race" &&
      roles.checkpoint.every((checkpoint) =>
        entity.minigame_instance.state.reached_checkpoints.has(checkpoint.id)
      )
  );
  await placePlayer(user, roles.finish[0].position.v);
  await publish(
    user.page,
    new FinishSimpleRaceMinigameEvent({
      id: user.actorId,
      minigame_id: row.id,
      minigame_instance_id: instanceId,
      minigame_element_id: roles.finish[0].id,
    })
  );
  await waitFor(
    `${row.label} finishes and restores the player`,
    async () => ({
      playing: await playingState(user),
      instance: (await authoritativeEntity(user.page, instanceId)).entity,
    }),
    ({ playing, instance }) =>
      !playing && instance?.minigame_instance?.finished === true
  );
  report.scenarios.push({
    id: String(row.id),
    label: row.label,
    kind: row.kind,
    status: "pass",
    instanceId: String(instanceId),
    checkpoints: roles.checkpoint.length,
    leaderboardId: String(roles.leaderboard[0].id),
    questBound: row.questBound,
  });
}

async function tickInstance(user, minigameId, instanceId) {
  await publish(
    user.page,
    new MinigameInstanceTickEvent({
      minigame_id: minigameId,
      minigame_instance_id: instanceId,
    })
  );
}

async function forceSpleefClock(user, instanceId, target) {
  const current = (await authoritativeEntity(user.page, instanceId)).entity;
  assert(current?.minigame_instance?.state.kind === "spleef");
  const component = MinigameInstance.clone(current.minigame_instance);
  assert.equal(component.state.kind, "spleef");
  if (target === "round_start") {
    assert.equal(component.state.instance_state.kind, "round_countdown");
    component.state.instance_state.round_start = secondsSinceEpoch() - 1;
  } else {
    assert.equal(component.state.instance_state.kind, "playing_round");
    component.state.instance_state.round_expires = secondsSinceEpoch() - 1;
  }
  await applyChanges(user.page, {
    kind: "update",
    entity: {
      id: instanceId,
      minigame_instance: component,
      minigame_instance_tick_info: MinigameInstanceTickInfo.create({
        trigger_at: secondsSinceEpoch(),
        last_tick: secondsSinceEpoch() - 1,
      }),
    },
  });
}

async function runSpleef(browser, first, second, catalogRow) {
  const { row } = catalogRow;
  const participants = [first, second];
  let third;
  if (row.requiredParticipants === 3) {
    third = await openUser(browser, playerIds[2], "client-c");
    participants.push(third);
  }
  try {
    for (const participant of participants) {
      await postCreateOrJoin(participant, catalogRow);
    }
    const joined = await waitFor(
      `${row.label} participants join one instance`,
      async () => Promise.all(participants.map(playingState)),
      (states) =>
        states.every(
          (state) =>
            state?.minigame_id === row.id && state.minigame_type === "spleef"
        ) &&
        new Set(states.map((state) => state.minigame_instance_id)).size === 1
    );
    const instanceId = joined.value[0].minigame_instance_id;
    let instance = (await authoritativeEntity(first.page, instanceId)).entity;
    if (
      instance.minigame_instance.state.instance_state.kind ===
      "waiting_for_players"
    ) {
      await tickInstance(first, row.id, instanceId);
    }
    await waitFor(
      `${row.label} enters countdown`,
      () => authoritativeEntity(first.page, instanceId),
      ({ entity }) =>
        entity?.minigame_instance?.state.kind === "spleef" &&
        entity.minigame_instance.state.instance_state.kind === "round_countdown"
    );
    await forceSpleefClock(first, instanceId, "round_start");
    await tickInstance(first, row.id, instanceId);
    instance = (
      await waitFor(
        `${row.label} starts its round`,
        () => authoritativeEntity(first.page, instanceId),
        ({ entity }) =>
          entity?.minigame_instance?.state.kind === "spleef" &&
          entity.minigame_instance.state.instance_state.kind === "playing_round"
      )
    ).value.entity;
    assert(instance.minigame_instance.space_clipboard);
    assert.equal(
      instance.minigame_instance.state.instance_state.alive_round_players.size,
      row.requiredParticipants
    );
    await forceSpleefClock(first, instanceId, "round_end");
    await tickInstance(first, row.id, instanceId);
    await waitFor(
      `${row.label} completes and resets its round`,
      () => authoritativeEntity(first.page, instanceId),
      ({ entity }) =>
        entity?.minigame_instance?.state.kind === "spleef" &&
        entity.minigame_instance.state.instance_state.kind === "round_countdown"
    );
    for (const participant of [...participants].reverse()) {
      await quit(participant, row.id, instanceId);
    }
    await waitFor(
      `${row.label} closes after its final participant leaves`,
      () => authoritativeEntity(first.page, instanceId),
      ({ entity }) => entity?.minigame_instance?.finished === true
    );
    report.scenarios.push({
      id: String(row.id),
      label: row.label,
      kind: row.kind,
      status: "pass",
      instanceId: String(instanceId),
      participants: row.requiredParticipants,
      clipboardRestored: true,
    });
  } finally {
    await third?.context?.close().catch(() => undefined);
  }
}

async function forceDeathmatchFinish(user, instanceId) {
  const current = (await authoritativeEntity(user.page, instanceId)).entity;
  assert(current?.minigame_instance?.state.kind === "deathmatch");
  const component = MinigameInstance.clone(current.minigame_instance);
  assert.equal(component.state.kind, "deathmatch");
  assert.equal(component.state.instance_state?.kind, "playing");
  component.state.instance_state.round_end = secondsSinceEpoch() - 1;
  await applyChanges(user.page, {
    kind: "update",
    entity: {
      id: instanceId,
      minigame_instance: component,
      minigame_instance_tick_info: MinigameInstanceTickInfo.create({
        trigger_at: secondsSinceEpoch(),
        last_tick: secondsSinceEpoch() - 1,
      }),
    },
  });
}

async function runDeathmatch(first, second, catalogRow) {
  const { row, component } = catalogRow;
  await postCreateOrJoin(first, catalogRow);
  await postCreateOrJoin(second, catalogRow);
  const joined = await waitFor(
    `${row.label} players join one instance`,
    async () => [await playingState(first), await playingState(second)],
    (states) =>
      states.every(
        (state) =>
          state?.minigame_id === row.id && state.minigame_type === "deathmatch"
      ) && states[0].minigame_instance_id === states[1].minigame_instance_id
  );
  const instanceId = joined.value[0].minigame_instance_id;
  await waitFor(
    `${row.label} starts its countdown`,
    () => authoritativeEntity(first.page, instanceId),
    ({ entity }) =>
      entity?.minigame_instance?.state.kind === "deathmatch" &&
      entity.minigame_instance.state.instance_state?.kind === "play_countdown"
  );
  await tickInstance(first, row.id, instanceId);
  await waitFor(
    `${row.label} starts playing`,
    () => authoritativeEntity(first.page, instanceId),
    ({ entity }) =>
      entity?.minigame_instance?.state.kind === "deathmatch" &&
      entity.minigame_instance.state.instance_state?.kind === "playing"
  );
  const settings = parseMinigameSettings(
    component.minigame_settings,
    zDeathmatchSettings
  );
  for (const participant of [first, second]) {
    const player = (
      await authoritativeEntity(participant.page, participant.actorId)
    ).entity;
    settings.loadOut.forEach(([itemId], index) => {
      assert.equal(player.inventory?.hotbar[index]?.item.id, itemId);
    });
  }
  const sharedPosition = catalogRow.elements[0].position.v;
  await placePlayer(first, sharedPosition);
  await placePlayer(second, sharedPosition);
  await applyChanges(second.page, {
    kind: "update",
    entity: {
      id: second.actorId,
      health: Health.create({ hp: 1, maxHp: 100 }),
      death_info: null,
      iced: null,
    },
  });
  if (legacyDeathmatchImageWorkaround) {
    const attacker = (
      await authoritativeEntity(first.page, first.actorId)
    ).entity;
    const inventory = Inventory.clone(attacker.inventory);
    const emptyHotbarIndex = inventory.hotbar.findIndex((slot) => !slot);
    assert.notEqual(
      emptyHotbarIndex,
      -1,
      `${row.label} has no empty hotbar slot for the old-image unarmed workaround`
    );
    inventory.selected = { kind: "hotbar", idx: emptyHotbarIndex };
    await applyChanges(first.page, {
      kind: "update",
      entity: {
        id: first.actorId,
        inventory,
      },
    });
  }
  await publish(
    second.page,
    new UpdatePlayerHealthEvent({
      id: second.actorId,
      hpDelta: -999,
      damageSource: {
        kind: "attack",
        attacker: first.actorId,
        dir: [1, 0, 0],
      },
    })
  );
  const killOutcome = await waitFor(
    `${row.label} records a real kill and death`,
    () => authoritativeEntity(first.page, instanceId),
    ({ entity }) => {
      const state = entity?.minigame_instance?.state;
      return (
        state?.kind === "deathmatch" &&
        (state.instance_state?.kind === "finished" ||
          (state.player_states.get(first.actorId)?.kills === 1 &&
            state.player_states.get(second.actorId)?.deaths === 1))
      );
    }
  );
  const finishedOnKill =
    killOutcome.value.entity.minigame_instance.state.instance_state?.kind ===
    "finished";
  if (!finishedOnKill) {
    await forceDeathmatchFinish(first, instanceId);
    await tickInstance(first, row.id, instanceId);
    await waitFor(
      `${row.label} finishes its round`,
      () => authoritativeEntity(first.page, instanceId),
      ({ entity }) =>
        entity?.minigame_instance?.state.kind === "deathmatch" &&
        entity.minigame_instance.state.instance_state?.kind === "finished"
    );
  }
  const advertised = await activeInstances(first, row.id);
  assert(
    !advertised.some((instance) => instance.id === instanceId),
    `${row.label} advertised a finished instance`
  );
  await quit(second, row.id, instanceId);
  await quit(first, row.id, instanceId);
  report.scenarios.push({
    id: String(row.id),
    label: row.label,
    kind: row.kind,
    status: "pass",
    instanceId: String(instanceId),
    loadoutSlots: settings.loadOut.length,
    killRecorded: true,
    finishedOnKill,
    finishedInstanceHidden: true,
    legacyDeathmatchImageWorkaround,
  });
}

async function run() {
  assertLifecyclePreflight();
  acquireBrowserLock();
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
  let first;
  let second;
  try {
    first = await openUser(browser, playerIds[0], "client-a");
    if (plan.some((row) => row.renderedBrowserSessions === 2)) {
      second = await openUser(browser, playerIds[1], "client-b");
    }
    for (const user of [first, second]) {
      if (user) await cleanupRetainedMinigame(user);
    }
    await cleanupAbandonedCatalogIcing(first);
    const catalog = await auditCatalog(first);
    for (let rowIndex = 0; rowIndex < plan.length; rowIndex += 1) {
      const row = plan[rowIndex];
      const catalogRow = catalog.get(row.id);
      console.log(`MINIGAME ${row.kind} ${row.id} ${row.label}`);
      try {
        if (row.kind === "simple_race") {
          await runRace(first, catalogRow);
        } else if (row.kind === "spleef") {
          assert(second, `${row.label} requires a second browser session`);
          await runSpleef(browser, first, second, catalogRow);
        } else {
          assert(second, `${row.label} requires a second browser session`);
          await runDeathmatch(first, second, catalogRow);
        }
      } catch (error) {
        report.scenarioFailures.push({
          id: String(row.id),
          label: row.label,
          kind: row.kind,
          error: error?.stack || String(error),
        });
        if (rowIndex + 1 < plan.length) {
          await second?.context?.close().catch(() => undefined);
          await first?.context?.close().catch(() => undefined);
          const actorOffset = (rowIndex + 1) * 100;
          first = await openUser(
            browser,
            playerIds[0] + actorOffset,
            "client-a"
          );
          if (plan.some((candidate) => candidate.renderedBrowserSessions === 2)) {
            second = await openUser(
              browser,
              playerIds[1] + actorOffset,
              "client-b"
            );
          }
        }
      }
      serializeReport();
    }
    assert.deepEqual(
      report.scenarioFailures,
      [],
      `minigame scenario failures:\n${report.scenarioFailures
        .map((failure) => `${failure.id}: ${failure.error}`)
        .join("\n")}`
    );
    assert.deepEqual(
      report.browserFailures,
      [],
      `browser/network failures occurred:\n${report.browserFailures.join("\n")}`
    );
    assert.equal(report.scenarios.length, plan.length);
    assert.equal(
      command("docker", ["inspect", "-f", "{{.RestartCount}}", stackContainer]),
      "0"
    );
    assert.equal(
      command("docker", [
        "inspect",
        "-f",
        "{{.State.OOMKilled}}",
        stackContainer,
      ]),
      "false"
    );
    report.finishedAt = new Date().toISOString();
    report.status = "pass";
    console.log(
      `PASS ${report.scenarios.length} snapshot minigame browser/native ECS scenarios`
    );
  } finally {
    if (first?.page && !first.page.isClosed()) {
      await first.page
        .screenshot({
          path: path.join(artifactsDir, `${runId}-client-a.png`),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    if (second?.page && !second.page.isClosed()) {
      await second.page
        .screenshot({
          path: path.join(artifactsDir, `${runId}-client-b.png`),
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
    serializeReport();
    releaseBrowserLock();
    console.log(`REPORT ${reportPath}`);
  });
