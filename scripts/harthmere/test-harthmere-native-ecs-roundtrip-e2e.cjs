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
const { z } = require("zod");

const {
  Acquisition,
  Challenges,
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
  MinigameComponent,
  MinigameInstance,
  NpcMetadata,
  NpcState,
  PlayingMinigame,
  Position,
  QuestGiver,
  RecipeBook,
  RigidBody,
  SelectedItem,
  Size,
  Stashed,
  TriggerState,
  Wearing,
} = require("../../src/shared/ecs/gen/components");
const {
  CompleteQuestStepAtEntityEvent,
  ConsumptionEvent,
  FinishSimpleRaceMinigameEvent,
  HarvestPlantEvent,
  InventoryCraftEvent,
  InventorySwapEvent,
  InventoryThrowEvent,
  MoveEvent,
  PickUpEvent,
  PlacePlaceableEvent,
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
const { zEntity } = require("../../src/shared/ecs/zod");
const {
  zrpcWebDeserialize,
  zrpcWebSerialize,
} = require("../../src/shared/zrpc/serde");
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
  HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND,
} = require("../../src/shared/npc/behavior/chase_attack");
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
  harthmereJobsBoardQuestMarkerRuntimePositionForId,
} = require("../../src/shared/harthmere/jobs_board_quest_marker_positions");
const {
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  parseHarthmereLiveModeSharedWorldState,
} = require("../../src/shared/harthmere/live_mode_backend");
const { connectToRedis } = require("../../src/server/shared/redis/connection");
const {
  RedisBikkieStorage,
} = require("../../src/server/shared/bikkie/storage/redis");
const {
  isTriggerFired,
} = require("../../src/server/logic/events/handlers/quest_step_validation");
const { BikkieRuntime } = require("../../src/shared/bikkie/active");
const {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} = require("../../src/shared/harthmere/harthmere_native_vitals");
const {
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
  NATIVE_ROAD_AHEAD_QUEST_ID,
  NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
  NATIVE_ROBOT_STORY_FINAL_HANDOFFS,
  NATIVE_ROBOT_STORY_ITEM_IDS,
  NATIVE_ROBOT_STORY_QUEST_IDS,
} = require("../../src/shared/harthmere/native_road_ahead_contract");

const NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS = [
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
];
const BUSTED_WATERLOGGED_DELIVERY_STEP_ID = 1250712772360777;
const BUSTED_MUCKWAD_STEP_ID = 3014114416679179;
const BUSTED_MUCK_BUSTER_STEP_ID = 6113676978673631;
const BUSTED_PLACE_MUCK_BUSTER_STEP_ID = 7945988417612118;
const BUSTED_COLLECT_LOG_TYPE_STEP_ID = 8417331412810011;
const BUSTED_WOODEN_AXE_STEP_ID = 7368524338732157;
const BUSTED_OAK_LOG_STEP_ID = 5355669237856170;
const GET_MUCK_OUT_WOODEN_WHACKER_STEP_ID = 2465592451503042;
const GET_MUCK_OUT_MUCKLING_STEP_ID = 4794743509650569;
const GET_MUCK_OUT_RACE_STEP_ID = 6297666130307789;
const MOSSY_MUCKLING_TYPE_ID = 2992752380341653;
const WRONG_MUCKLING_TYPE_ID = 8997551883502313;
const OAK_LOG_ITEM_ID = 4537020877770174;

let nativeRobotStoryBikkieTray;

function triggerChildren(trigger) {
  return ["all", "any", "seq", "variant"].includes(trigger?.kind)
    ? trigger.triggers || []
    : [];
}

function visitTriggerTree(trigger, visitor) {
  visitor(trigger);
  for (const child of triggerChildren(trigger)) {
    visitTriggerTree(child, visitor);
  }
}

function triggerTreeNodeIds(trigger) {
  const ids = [];
  visitTriggerTree(trigger, (node) => ids.push(node.id));
  return ids;
}

async function loadNativeRobotStoryBikkieTray() {
  const redis = await connectToRedis("bikkie");
  const storage = new RedisBikkieStorage(redis);
  try {
    const tray = await storage.load();
    assert(tray.contents.size > 0, "native robot story Bikkie tray is empty");
    const runtime = new BikkieRuntime();
    runtime.registerBiscuits(tray.contents);
    global.bikkieRuntime = runtime;
    for (const questId of NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS) {
      const quest = tray.contents.get(questId);
      assert(quest?.isQuest, `missing native robot story quest ${questId}`);
      assert(
        quest.trigger,
        `native robot story quest ${questId} has no trigger`
      );
    }
    nativeRobotStoryBikkieTray = tray;
    report.scenarios.push({
      name: "snapshot-authored robot story trigger trees loaded",
      status: "pass",
      quests: NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS.map((questId) => {
        const quest = tray.contents.get(questId);
        return {
          questId: String(questId),
          title: quest.displayName,
          triggerNodeIds: triggerTreeNodeIds(quest.trigger).map(String),
        };
      }),
    });
    return tray;
  } finally {
    await storage.stop();
  }
}

const root = path.resolve(__dirname, "../..");
const baseUrl = (
  process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");
const configuredGameUrl = process.env.HARTHMERE_E2E_URL || `${baseUrl}/at`;
const combatMusicOnly = process.env.HARTHMERE_E2E_COMBAT_MUSIC_ONLY === "1";
const chaseOnly = process.env.HARTHMERE_E2E_CHASE_ONLY === "1";
const exhaustiveRobotStory =
  process.env.HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE === "1";
const robotStoryOnly =
  process.env.HARTHMERE_E2E_ROBOT_STORY_ONLY === "1" || exhaustiveRobotStory;
const jobsOnly = process.env.HARTHMERE_E2E_JOBS_ONLY === "1";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120000);
const acceptanceGateMs = Number(
  process.env.HARTHMERE_E2E_ACCEPTANCE_GATE_MS ||
    (combatMusicOnly || chaseOnly ? 10_000 : 2000)
);
const originSyncGateMs = Number(
  process.env.HARTHMERE_E2E_ORIGIN_SYNC_GATE_MS ||
    (combatMusicOnly || chaseOnly ? timeoutMs + 30_000 : 1000)
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
    (combatMusicOnly || chaseOnly ? timeoutMs + 30_000 : secondClientSyncGateMs)
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
  mode: chaseOnly
    ? "chase-only"
    : combatMusicOnly
    ? "combat-music-only"
    : exhaustiveRobotStory
    ? "robot-story-exhaustive"
    : robotStoryOnly
    ? "robot-story-only"
    : jobsOnly
    ? "jobs-only"
    : "full",
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
  browser: {
    console: [],
    requests: [],
    audioAssets: [],
    transients: [],
    failures: [],
  },
};

function gameUrl() {
  const url = new URL(configuredGameUrl);
  const localBaseUrl = new URL(baseUrl);
  if (
    localBaseUrl.hostname === "127.0.0.1" ||
    localBaseUrl.hostname === "localhost"
  ) {
    url.searchParams.set("syncBaseUrl", baseUrl);
  }
  url.searchParams.set("glitch_auto_play", "1");
  url.searchParams.set("harthmere_native_ecs_e2e", "1");
  url.searchParams.set("e2e_run", runId);
  if (robotStoryOnly || jobsOnly) {
    url.searchParams.set("lowMemory", "1");
    url.searchParams.set("resourceCapacityScale", "0.25");
    url.searchParams.set("forceDrawDistance", "16");
    url.searchParams.set("forceRenderScale", "0.25");
    url.searchParams.set("forceGraphicsQuality", "low");
  }
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

function distance3(a, b) {
  return Math.hypot(
    Number(a?.[0] ?? 0) - Number(b?.[0] ?? 0),
    Number(a?.[1] ?? 0) - Number(b?.[1] ?? 0),
    Number(a?.[2] ?? 0) - Number(b?.[2] ?? 0)
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

async function jobsBoardFetchWithRetry(page, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await bridgeCall(page, "jobsBoardFrontendRoundTrip", {
        operation: "fetch",
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.includes("Jobs board state request failed: 5") ||
        message.includes("harthmere_live_fetch_timeout");
      if (!retryable || attempt === 4) {
        throw error;
      }
      report.browser.transients.push(
        `jobs-board-fetch-retry:${label}:attempt=${attempt}:${message}`
      );
      await delay(attempt * 1000);
    }
  }
  throw lastError;
}

async function authoritativeEntity(page, id) {
  const response = await page
    .context()
    .request.post(
      new URL("/api/admin/ecs/get_with_version", baseUrl).toString(),
      {
        data: { z: zrpcWebSerialize([id]) },
        timeout: timeoutMs,
      }
    );
  assert(
    response.ok(),
    `authoritative ECS read failed HTTP ${response.status()}: ${await response.text()}`
  );
  const body = await response.json();
  assert.equal(typeof body.z, "string", "authoritative ECS read was not zRPC");
  const [[version, wrapped]] = zrpcWebDeserialize(
    body.z,
    z.array(z.tuple([z.number(), zEntity.optional()]))
  );
  return { version, entity: wrapped?.entity };
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
  const response = await page
    .context()
    .request.post(new URL("/api/admin/apply_ecs_changes", baseUrl).toString(), {
      data: {
        z: zrpcWebSerialize(changes.map(serializedChange)),
      },
      timeout: timeoutMs,
    });
  assert(
    response.ok(),
    `ECS fixture apply failed HTTP ${response.status()}: ${await response.text()}`
  );
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

async function publishFrontendMove(page, userId, position) {
  const startedAt = Date.now();
  await bridgeCall(
    page,
    "publish",
    serializedEvent(
      new MoveEvent({
        id: userId,
        position: [...position],
        orientation: [0, 0],
        velocity: [0, 0, 0],
      })
    )
  );
  return { elapsedMs: Date.now() - startedAt };
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
    const isolatedRobotStoryMissingNavigationTarget =
      robotStoryOnly && text.includes("No entity found for navigation aid");
    const recoveredJobsOnlySyncDisconnect =
      jobsOnly &&
      (text.includes("Showing disconnected from game") ||
        ((text.includes("Could not publish events") ||
          text.includes("Error during fire and forget")) &&
          text.includes("/sync/publish CANCELLED") &&
          text.includes("reconnect due to Connection timeout")));
    if (recoveredJobsOnlySyncDisconnect) {
      report.browser.transients.push(text);
    }
    if (
      message.type() === "error" &&
      !unsupportedExtensionAsset &&
      !knownMixedSceneMeshFallback &&
      !isolatedRobotStoryMissingNavigationTarget &&
      !recoveredJobsOnlySyncDisconnect
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
      let jobsBoardMutation;
      if (
        request.method() === "POST" &&
        url.startsWith(`${baseUrl}/api/harthmere/live_mode`)
      ) {
        try {
          const body = request.postDataJSON();
          if (body?.actionKind === "request_jobs_board_mutation") {
            jobsBoardMutation = {
              requestId: body.requestId,
              targetId: body.targetId,
              payload: body.payload,
            };
          }
        } catch {
          // A malformed request will be reported by the API response. Keep
          // diagnostics best-effort so request observation never changes E2E.
        }
      }
      report.browser.requests.push({
        client: label,
        method: request.method(),
        url: url.replace(baseUrl, ""),
        at: Date.now(),
        ...(jobsBoardMutation ? { jobsBoardMutation } : {}),
      });
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText;
    const abortedLiveModeBuildingPoll =
      errorText === "net::ERR_ABORTED" &&
      url.startsWith(`${baseUrl}/api/harthmere/live_mode_building_state?`);
    const recoveredFocusedAvatarAbort =
      (jobsOnly || robotStoryOnly) &&
      errorText === "net::ERR_ABORTED" &&
      url.includes("/_next/static/media/avatar-placeholder.");
    const recoveredJobsOnlyAbortedRequest =
      jobsOnly &&
      errorText === "net::ERR_ABORTED" &&
      (url.includes("/_next/static/media/avatar-placeholder.") ||
        /^\/api\/harthmere\/live_mode_[a-z_]+_state\?/.test(
          url.slice(baseUrl.length)
        ) ||
        (request.method() === "POST" &&
          url.startsWith(`${baseUrl}/api/harthmere/live_mode?`)));
    if (url.startsWith(baseUrl)) {
      const diagnostic = `${label}:requestfailed:${request.method()}:${url}:${errorText}`;
      if (recoveredFocusedAvatarAbort || recoveredJobsOnlyAbortedRequest) {
        report.browser.transients.push(diagnostic);
      } else if (!abortedLiveModeBuildingPoll) {
        report.browser.failures.push(diagnostic);
      }
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
  const failureBaseline = report.browser.failures.length;
  const context = await browser.newContext({
    viewport:
      robotStoryOnly || jobsOnly
        ? { width: 800, height: 600 }
        : { width: 1440, height: 900 },
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
  if (robotStoryOnly || jobsOnly) {
    // The isolated production-bundle harness can receive one initial Bikkie
    // notifier refresh after the first context is ready. Let that navigation
    // finish, then prove the replacement page installed the same bridge before
    // applying or publishing any ECS fixtures.
    await page.waitForTimeout(20_000);
    await page.waitForFunction(
      () =>
        globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1" &&
        Boolean(globalThis.clientContext),
      undefined,
      { timeout: timeoutMs }
    );
    // Navigation-aborted telemetry requests from the replaced context are not
    // failures of the stable browser/ECS session exercised below.
    report.browser.failures.splice(failureBaseline);
  }
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

function nativeRobotStoryHandoffFixture(entity, handoff, completedQuestIds) {
  const challenges = Challenges.create();
  for (const questId of completedQuestIds) {
    challenges.complete.add(questId);
    challenges.started_at.set(questId, secondsSinceEpoch() - 10);
    challenges.finished_at.set(questId, secondsSinceEpoch() - 5);
  }
  challenges.in_progress.add(handoff.questId);
  challenges.started_at.set(handoff.questId, secondsSinceEpoch());

  const triggerState = TriggerState.clone(entity.trigger_state);
  for (const questId of NATIVE_ROBOT_STORY_QUEST_IDS) {
    triggerState.by_root.delete(questId);
  }
  triggerState.by_root.set(
    handoff.questId,
    new Map(
      handoff.prerequisiteTriggerIds.map((stepId, index) => [
        stepId,
        secondsSinceEpoch() - handoff.prerequisiteTriggerIds.length + index,
      ])
    )
  );
  return { challenges, triggerState };
}

function serializedTriggerStepIsFired(entity, questId, stepId) {
  return isTriggerFired(entity?.trigger_state?.by_root.get(questId), stepId);
}

function recipeBookHas(entity, recipeId) {
  const recipes = entity?.recipe_book?.recipes;
  return (
    recipes?.has(String(recipeId)) ||
    [...(recipes?.values() ?? [])].some((item) => item.id === recipeId)
  );
}

function inventoryRefForItem(entity, itemId) {
  const inventory = entity?.inventory;
  for (let idx = 0; idx < (inventory?.items?.length ?? 0); idx += 1) {
    if (inventory.items[idx]?.item?.id === itemId) {
      return { kind: "item", idx };
    }
  }
  for (let idx = 0; idx < (inventory?.hotbar?.length ?? 0); idx += 1) {
    if (inventory.hotbar[idx]?.item?.id === itemId) {
      return { kind: "hotbar", idx };
    }
  }
}

function withoutInventoryItem(entity, itemId) {
  const inventory = Inventory.clone(entity.inventory);
  inventory.items = inventory.items.map((slot) =>
    slot?.item?.id === itemId ? undefined : slot
  );
  inventory.hotbar = inventory.hotbar.map((slot) =>
    slot?.item?.id === itemId ? undefined : slot
  );
  for (const [key, slot] of inventory.overflow) {
    if (slot?.item?.id === itemId) inventory.overflow.delete(key);
  }
  return inventory;
}

function rewardEntries(reward) {
  return [...(reward?.values() ?? [])].map(({ item, count }) => ({
    itemId: item.id,
    count: BigInt(count),
    isRecipe: Boolean(
      nativeRobotStoryBikkieTray?.contents.get(item.id)?.isRecipe
    ),
  }));
}

function requiredEntries(itemsToTake) {
  return (itemsToTake ?? []).map(([itemId, count]) => ({
    itemId,
    count: BigInt(count),
  }));
}

function questFromFrontend(snapshot, questId) {
  return snapshot.quests.find((quest) => quest.questId === String(questId));
}

async function waitForFrontendQuestStep(page, questId, stepId, label) {
  return waitFor(
    `${label}: exact authored objective reaches frontend`,
    () => bridgeCall(page, "nativeQuestFrontendSnapshot"),
    (snapshot) => {
      const quest = questFromFrontend(snapshot, questId);
      return (
        snapshot.activeQuestId === String(questId) &&
        snapshot.mainQuestId === String(questId) &&
        quest?.status === "active" &&
        quest.currentStepId === String(stepId) &&
        quest.steps.some(
          (step) => step.id === String(stepId) && step.done === false
        )
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

async function waitForFrontendObjectiveIncludes(page, questId, text, label) {
  return waitFor(
    `${label}: objective progress reaches frontend`,
    () => bridgeCall(page, "nativeQuestFrontendSnapshot"),
    (snapshot) =>
      questFromFrontend(snapshot, questId)?.objective?.includes(text),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

async function publishAndWaitForQuestStep({
  first,
  sameUserPeer,
  questId,
  step,
  event,
  label,
}) {
  const beforeDiagnostics = await bridgeCall(first.page, "diagnostics");
  const beforeCount = beforeDiagnostics.publishedEvents.filter(
    (entry) => entry.kind === event.kind
  ).length;
  const startedAt = Date.now();
  await bridgeCall(first.page, "publish", serializedEvent(event));
  const acceptanceMs = Date.now() - startedAt;
  const authoritative = await waitFor(
    `${label}: authoritative trigger progression`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      serializedTriggerStepIsFired(entity, questId, step.id) ||
      entity?.challenges?.complete.has(questId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const local = await waitFor(
    `${label}: progression synchronizes to frontend ECS`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      serializedTriggerStepIsFired(entity, questId, step.id) ||
      entity?.challenges?.complete.has(questId),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  let peer;
  if (sameUserPeer) {
    peer = await waitFor(
      `${label}: progression synchronizes to peer frontend ECS`,
      () => localEntity(sameUserPeer, first.userId),
      ({ entity }) =>
        serializedTriggerStepIsFired(entity, questId, step.id) ||
        entity?.challenges?.complete.has(questId),
      Math.max(secondClientSyncGateMs, 10_000),
      timeoutMs
    );
  }
  const afterDiagnostics = await bridgeCall(first.page, "diagnostics");
  const afterCount = afterDiagnostics.publishedEvents.filter(
    (entry) => entry.kind === event.kind
  ).length;
  assert.equal(
    afterCount,
    beforeCount + 1,
    `${label} must publish exactly one ${event.kind}`
  );
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    triggerKind: step.kind,
    eventKind: event.kind,
    acceptanceMs,
    authoritativeMs: authoritative.elapsedMs,
    originSyncMs: local.elapsedMs,
    peerSyncMs: peer?.elapsedMs,
  });
  return authoritative.value.entity;
}

async function createQuestTarget(first, targetTypeId, position, index) {
  const targetId = await bridgeCall(first.page, "allocateId");
  const targetPosition = [
    position[0] + 1,
    position[1],
    position[2] + index * 0.01,
  ];
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: targetId,
      position: Position.create({ v: targetPosition }),
      npc_metadata: NpcMetadata.create({
        type_id: targetTypeId,
        created_time: secondsSinceEpoch(),
        spawn_position: targetPosition,
        spawn_orientation: [0, 0],
      }),
      label: Label.create({ text: `E2E quest target ${targetTypeId}` }),
    },
  });
  await waitFor(
    `quest target ${targetTypeId} synchronized`,
    () => localEntity(first.page, targetId),
    ({ entity }) => entity?.npc_metadata?.type_id === targetTypeId,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  return targetId;
}

async function createRobotStoryTargets(first, position, questTriggers) {
  const targetTypeIds = new Set();
  for (const trigger of questTriggers) {
    visitTriggerTree(trigger, (node) => {
      if (node.kind === "challengeClaimRewards") {
        targetTypeIds.add(node.returnNpcTypeId);
      }
    });
  }
  const targets = new Map();
  let index = 0;
  for (const targetTypeId of targetTypeIds) {
    targets.set(
      targetTypeId,
      await createQuestTarget(first, targetTypeId, position, index++)
    );
  }
  return targets;
}

async function createAndPickupItem(first, position, itemId, count, label) {
  const before = await authoritativeEntity(first.page, first.userId);
  const beforeCount = inventoryCount(before.entity, itemId);
  const dropId = await bridgeCall(first.page, "allocateId");
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: dropId,
      position: Position.create({ v: [...position] }),
      grab_bag: GrabBag.create({
        slots: createBag(countOf(itemId, BigInt(count))),
        mined: true,
      }),
      expires: Expires.create({ trigger_at: secondsSinceEpoch() + 300 }),
      loose_item: LooseItem.create({ item: anItem(itemId) }),
    },
  });
  await waitFor(
    `${label}: pickup fixture reaches frontend`,
    () => localEntity(first.page, dropId),
    ({ entity }) => Boolean(entity?.grab_bag),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(new PickUpEvent({ id: first.userId, item: dropId }))
  );
  await waitFor(
    `${label}: pickup reaches authoritative inventory`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, itemId) >= beforeCount + BigInt(count),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await waitFor(
    `${label}: pickup reaches frontend inventory`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, itemId) >= beforeCount + BigInt(count),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

function recipeProducing(itemId) {
  return [...nativeRobotStoryBikkieTray.contents.values()].find(
    (biscuit) =>
      biscuit.isRecipe &&
      biscuit.output?.some(([outputId]) => outputId === itemId)
  );
}

async function ensureRecipeInputs(first, position, recipe, label) {
  const current = await authoritativeEntity(first.page, first.userId);
  for (const [itemId, count] of recipe.input ?? []) {
    const missing = BigInt(count) - inventoryCount(current.entity, itemId);
    if (missing > 0n) {
      await createAndPickupItem(
        first,
        position,
        itemId,
        missing,
        `${label}: acquire crafting input ${itemId}`
      );
    }
  }
}

async function craftRecipeOnce(first, position, recipe, outputItemId, label) {
  await waitFor(
    `${label}: recipe is unlocked`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => recipeBookHas(entity, recipe.id),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await ensureRecipeInputs(first, position, recipe, label);
  const before = await authoritativeEntity(first.page, first.userId);
  const beforeOutput = inventoryCount(before.entity, outputItemId);
  const outputCount = BigInt(
    recipe.output.find(([itemId]) => itemId === outputItemId)?.[1] ?? 0
  );
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new InventoryCraftEvent({
        id: first.userId,
        recipe: anItem(recipe.id),
        slot_refs: [],
      })
    )
  );
  await waitFor(
    `${label}: craft mutates authoritative inventory`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, outputItemId) >= beforeOutput + outputCount,
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await waitFor(
    `${label}: crafted output reaches frontend inventory`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, outputItemId) >= beforeOutput + outputCount,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

async function performQuestClaimStep({
  first,
  sameUserPeer,
  position,
  targets,
  questId,
  step,
}) {
  const label = `${
    nativeRobotStoryBikkieTray.contents.get(questId).displayName
  }: ${step.name ?? step.id}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  const targetId = targets.get(step.returnNpcTypeId);
  assert(targetId, `${label} has no target fixture ${step.returnNpcTypeId}`);
  const required = requiredEntries(step.itemsToTake);

  if (step.id === BUSTED_WATERLOGGED_DELIVERY_STEP_ID && required.length > 0) {
    const beforeMissingProbe = await authoritativeEntity(
      first.page,
      first.userId
    );
    const originalInventory = Inventory.clone(
      beforeMissingProbe.entity.inventory
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        inventory: withoutInventoryItem(
          beforeMissingProbe.entity,
          required[0].itemId
        ),
      },
    });
    await waitFor(
      `${label}: insufficient-item fixture synchronized`,
      () => localEntity(first.page, first.userId),
      ({ entity }) => inventoryCount(entity, required[0].itemId) === 0n,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    await bridgeCall(
      first.page,
      "publish",
      serializedEvent(
        new CompleteQuestStepAtEntityEvent({
          id: first.userId,
          challenge_id: questId,
          entity_id: targetId,
          step_id: step.id,
        })
      )
    );
    await delay(1500);
    const rejected = await authoritativeEntity(first.page, first.userId);
    assert.equal(
      serializedTriggerStepIsFired(rejected.entity, questId, step.id),
      false,
      `${label} advanced without the required turn-in item`
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: { id: first.userId, inventory: originalInventory },
    });
    await waitFor(
      `${label}: required item restored after rejection probe`,
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        inventoryCount(entity, required[0].itemId) >= required[0].count,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    report.scenarios.push({
      name: `${label}: missing required item is rejected`,
      status: "pass",
      questId: String(questId),
      stepId: String(step.id),
      requiredItems: required.map(({ itemId, count }) => ({
        itemId: String(itemId),
        count: String(count),
      })),
    });
  }

  const before = await authoritativeEntity(first.page, first.userId);
  for (const { itemId, count } of required) {
    assert(
      inventoryCount(before.entity, itemId) >= count,
      `${label} is missing ${count} of required item ${itemId}`
    );
  }
  const rewardIndex = Math.max(0, (step.rewardsList?.length ?? 1) - 1);
  const selectedRewards = rewardEntries(step.rewardsList?.[rewardIndex]);
  const after = await publishAndWaitForQuestStep({
    first,
    sameUserPeer,
    questId,
    step,
    label,
    event: new CompleteQuestStepAtEntityEvent({
      id: first.userId,
      challenge_id: questId,
      entity_id: targetId,
      step_id: step.id,
      chosen_reward_index: rewardIndex,
    }),
  });
  for (const { itemId, count } of required) {
    assert.equal(
      inventoryCount(after, itemId),
      inventoryCount(before.entity, itemId) - count,
      `${label} did not consume the exact required quantity of ${itemId}`
    );
  }
  for (const reward of selectedRewards) {
    if (reward.isRecipe) {
      assert(
        recipeBookHas(after, reward.itemId),
        `${label} did not unlock recipe ${reward.itemId}`
      );
    } else {
      assert(
        inventoryCount(after, reward.itemId) >=
          inventoryCount(before.entity, reward.itemId) + reward.count,
        `${label} did not grant selected reward ${reward.itemId}`
      );
    }
  }
  report.scenarios.push({
    name: `${label}: item contract`,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    chosenRewardIndex: rewardIndex,
    rewards: selectedRewards.map(({ itemId, count, isRecipe }) => ({
      itemId: String(itemId),
      count: String(count),
      isRecipe,
    })),
    itemsTaken: required.map(({ itemId, count }) => ({
      itemId: String(itemId),
      count: String(count),
    })),
  });
}

async function performBustedUnderwaterContainerStep({
  first,
  sameUserPeer,
  position,
  questId,
  step,
}) {
  const label = `Busted: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  const containerId = await bridgeCall(first.page, "allocateId");
  const containerItems = new Array(16);
  containerItems[0] = countOf(
    NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    1n
  );
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: containerId,
      position: Position.create({ v: [...position] }),
      label: Label.create({ text: "Chest The Grove Underwater Main" }),
      entity_description: EntityDescription.create({
        text: NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
      }),
      created_by: CreatedBy.create({
        id: first.userId,
        created_at: secondsSinceEpoch(),
      }),
      quest_giver: QuestGiver.create(),
      container_inventory: ContainerInventory.create({ items: containerItems }),
    },
  });
  await waitFor(
    `${label}: physical chest reaches frontend ECS`,
    () => localEntity(first.page, containerId),
    ({ entity }) =>
      entity?.container_inventory?.items?.[0]?.item?.id ===
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const before = await authoritativeEntity(first.page, first.userId);
  await publishAndWaitForQuestStep({
    first,
    sameUserPeer,
    questId,
    step,
    label,
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
  });
  const after = await authoritativeEntity(first.page, first.userId);
  const container = await authoritativeEntity(first.page, containerId);
  assert(!container.entity?.container_inventory?.items?.[0]);
  assert.equal(
    inventoryCount(
      after.entity,
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
    ),
    inventoryCount(
      before.entity,
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
    ) + 1n
  );
}

async function waitForQuestLeaf(first, questId, step, label) {
  return waitFor(
    `${label}: native trigger fires`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      serializedTriggerStepIsFired(entity, questId, step.id) ||
      entity?.challenges?.complete.has(questId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
}

async function performInventoryHasStep({ first, position, questId, step }) {
  const label = `${
    nativeRobotStoryBikkieTray.contents.get(questId).displayName
  }: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  const itemId = step.item.id;
  if (step.id === BUSTED_MUCK_BUSTER_STEP_ID) {
    const recipe = recipeProducing(itemId);
    assert(recipe, `${label} has no recipe producing ${itemId}`);
    while (
      inventoryCount(
        (await authoritativeEntity(first.page, first.userId)).entity,
        itemId
      ) < BigInt(step.count)
    ) {
      await craftRecipeOnce(first, position, recipe, itemId, label);
      const count = inventoryCount(
        (await authoritativeEntity(first.page, first.userId)).entity,
        itemId
      );
      if (count < BigInt(step.count)) {
        assert.equal(
          serializedTriggerStepIsFired(
            (await authoritativeEntity(first.page, first.userId)).entity,
            questId,
            step.id
          ),
          false,
          `${label} fired before the required quantity`
        );
        await waitForFrontendObjectiveIncludes(
          first.page,
          questId,
          `${count}/${step.count}`,
          label
        );
      }
    }
  } else if (step.id === BUSTED_WOODEN_AXE_STEP_ID) {
    const recipe = recipeProducing(itemId);
    assert(recipe, `${label} has no recipe producing ${itemId}`);
    await craftRecipeOnce(first, position, recipe, itemId, label);
  } else {
    const before = await authoritativeEntity(first.page, first.userId);
    const missing = BigInt(step.count) - inventoryCount(before.entity, itemId);
    if (missing > 1n) {
      await createAndPickupItem(first, position, itemId, missing - 1n, label);
      await delay(500);
      const partial = await authoritativeEntity(first.page, first.userId);
      assert.equal(
        serializedTriggerStepIsFired(partial.entity, questId, step.id),
        false,
        `${label} fired before the required quantity`
      );
      await waitForFrontendObjectiveIncludes(
        first.page,
        questId,
        `${step.count - 1}/${step.count}`,
        label
      );
      await createAndPickupItem(first, position, itemId, 1n, label);
    } else if (missing > 0n) {
      await createAndPickupItem(first, position, itemId, missing, label);
    }
  }
  const progressed = await waitForQuestLeaf(first, questId, step, label);
  assert(
    inventoryCount(progressed.value.entity, itemId) >= BigInt(step.count),
    `${label} fired without retaining the required inventory quantity`
  );
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    itemId: String(itemId),
    requiredCount: step.count,
  });
}

async function performCollectTypeStep({ first, position, questId, step }) {
  const label = `Busted: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, BUSTED_COLLECT_LOG_TYPE_STEP_ID);
  await createAndPickupItem(
    first,
    position,
    OAK_LOG_ITEM_ID,
    step.count - 1,
    label
  );
  await waitForFrontendObjectiveIncludes(
    first.page,
    questId,
    `${step.count - 1}/${step.count}`,
    label
  );
  assert.equal(
    serializedTriggerStepIsFired(
      (await authoritativeEntity(first.page, first.userId)).entity,
      questId,
      step.id
    ),
    false
  );
  await createAndPickupItem(first, position, OAK_LOG_ITEM_ID, 1, label);
  await waitForQuestLeaf(first, questId, step, label);
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    typeId: String(step.typeId),
    concreteItemId: String(OAK_LOG_ITEM_ID),
    requiredCount: step.count,
  });
}

async function performCraftStep({ first, position, questId, step }) {
  const label = `Get the Muck Out: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, GET_MUCK_OUT_WOODEN_WHACKER_STEP_ID);
  const recipe = recipeProducing(step.item.id);
  assert(recipe, `${label} has no authored recipe`);
  await craftRecipeOnce(first, position, recipe, step.item.id, label);
  await waitForQuestLeaf(first, questId, step, label);
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    recipeId: String(recipe.id),
    outputItemId: String(step.item.id),
    requiredCount: step.count,
  });
}

function eventPredicateItemId(step) {
  for (const [field, matcher] of step.predicate?.fields ?? []) {
    if (field === "item" && matcher?.bikkieId) return matcher.bikkieId;
  }
}

async function performPlaceStep({
  first,
  sameUserPeer,
  position,
  questId,
  step,
}) {
  const label = `Busted: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, BUSTED_PLACE_MUCK_BUSTER_STEP_ID);
  const itemId = eventPredicateItemId(step);
  assert(itemId, `${label} has no item predicate`);
  const player = await authoritativeEntity(first.page, first.userId);
  const inventoryRef = inventoryRefForItem(player.entity, itemId);
  assert(inventoryRef, `${label} has no inventory slot for ${itemId}`);
  const slot =
    inventoryRef.kind === "item"
      ? player.entity.inventory.items[inventoryRef.idx]
      : player.entity.inventory.hotbar[inventoryRef.idx];
  await publishAndWaitForQuestStep({
    first,
    sameUserPeer,
    questId,
    step,
    label,
    event: new PlacePlaceableEvent({
      id: first.userId,
      placeable_item: anItem(itemId),
      inventory_item: slot.item,
      inventory_ref: inventoryRef,
      position: [position[0] + 2, position[1], position[2]],
      orientation: [0, 0],
    }),
  });
}

async function createAndKillNpc(first, position, npcTypeId, label, index) {
  const npcId = await bridgeCall(first.page, "allocateId");
  const npcPosition = [position[0] + 2, position[1], position[2] + index * 0.1];
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: npcId,
      position: Position.create({ v: npcPosition }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      size: Size.create({ v: [1, 1, 1] }),
      health: Health.create({ hp: 10, maxHp: 10 }),
      npc_state: NpcState.create(),
      npc_metadata: NpcMetadata.create({
        type_id: npcTypeId,
        created_time: secondsSinceEpoch(),
        spawn_position: npcPosition,
        spawn_orientation: [0, 0],
      }),
      label: Label.create({ text: `${label} ${index}` }),
    },
  });
  await waitFor(
    `${label} ${index}: NPC fixture synchronized`,
    () => localEntity(first.page, npcId),
    ({ entity }) => entity?.health?.hp === 10,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  for (let hit = 1; hit <= 4; hit += 1) {
    const beforeHit = await authoritativeEntity(first.page, npcId);
    if ((beforeHit.entity?.health?.hp ?? 0) <= 0) break;
    await applyFixture(
      first.page,
      {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({ v: [...position] }),
        },
      },
      {
        kind: "update",
        entity: {
          id: npcId,
          position: Position.create({ v: npcPosition }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        },
      }
    );
    await bridgeCall(
      first.page,
      "publish",
      serializedEvent(
        new UpdateNpcHealthEvent({
          id: npcId,
          hp: -999,
          damageSource: {
            kind: "attack",
            attacker: first.userId,
            dir: [1, 0, 0],
          },
        })
      )
    );
    await waitFor(
      `${label} ${index}: hit ${hit} mutates NPC health`,
      () => authoritativeEntity(first.page, npcId),
      ({ version, entity }) =>
        version > beforeHit.version &&
        (entity?.health?.hp ?? beforeHit.entity.health.hp) <
          beforeHit.entity.health.hp,
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    );
  }
  const dead = await authoritativeEntity(first.page, npcId);
  assert(
    (dead.entity?.health?.hp ?? 1) <= 0,
    `${label} ${index} survived four authoritative attacks`
  );
}

async function performNpcKilledStep({ first, position, questId, step }) {
  const label = `Get the Muck Out: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, GET_MUCK_OUT_MUCKLING_STEP_ID);
  const wrongNpcTypeId = WRONG_MUCKLING_TYPE_ID;
  assert.notEqual(wrongNpcTypeId, MOSSY_MUCKLING_TYPE_ID);
  await createAndKillNpc(
    first,
    position,
    wrongNpcTypeId,
    `${label} wrong type`,
    0
  );
  await delay(500);
  assert.equal(
    serializedTriggerStepIsFired(
      (await authoritativeEntity(first.page, first.userId)).entity,
      questId,
      step.id
    ),
    false,
    `${label} counted a wrong NPC type`
  );
  for (let index = 1; index <= step.count; index += 1) {
    await createAndKillNpc(
      first,
      position,
      MOSSY_MUCKLING_TYPE_ID,
      label,
      index
    );
    if (index < step.count) {
      await waitForFrontendObjectiveIncludes(
        first.page,
        questId,
        `${index}/${step.count}`,
        label
      );
    }
  }
  await waitForQuestLeaf(first, questId, step, label);
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    npcTypeId: String(MOSSY_MUCKLING_TYPE_ID),
    requiredCount: step.count,
    wrongNpcTypeRejected: String(wrongNpcTypeId),
  });
}

async function performRaceStep({
  first,
  sameUserPeer,
  position,
  questId,
  step,
}) {
  const label = `Get the Muck Out: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, GET_MUCK_OUT_RACE_STEP_ID);
  const [minigameId, instanceId, finishElementId, stashId] = await Promise.all(
    [0, 1, 2, 3].map(() => bridgeCall(first.page, "allocateId"))
  );
  const startedAt = secondsSinceEpoch() - 5;
  await applyFixture(
    first.page,
    {
      kind: "update",
      entity: {
        id: first.userId,
        playing_minigame: PlayingMinigame.create({
          minigame_id: minigameId,
          minigame_instance_id: instanceId,
          minigame_type: "simple_race",
        }),
      },
    },
    {
      kind: "create",
      entity: {
        id: minigameId,
        position: Position.create({ v: [...position] }),
        created_by: CreatedBy.create({
          id: first.userId,
          created_at: secondsSinceEpoch(),
        }),
        minigame_component: MinigameComponent.create({
          metadata: {
            kind: "simple_race",
            checkpoint_ids: new Set(),
            start_ids: new Set(),
            end_ids: new Set([finishElementId]),
          },
          ready: true,
          minigame_element_ids: new Set([finishElementId]),
          active_instance_ids: new Set([instanceId]),
        }),
      },
    },
    {
      kind: "create",
      entity: {
        id: instanceId,
        created_by: CreatedBy.create({
          id: minigameId,
          created_at: secondsSinceEpoch(),
        }),
        minigame_instance: MinigameInstance.create({
          minigame_id: minigameId,
          finished: false,
          state: {
            kind: "simple_race",
            player_state: "racing",
            started_at: startedAt,
            deaths: 0,
            reached_checkpoints: new Map(),
            finished_at: undefined,
          },
          active_players: new Map([
            [
              first.userId,
              {
                entry_stash_id: stashId,
                entry_position: [...position],
                entry_warped_to: undefined,
                entry_time: startedAt,
              },
            ],
          ]),
        }),
      },
    },
    {
      kind: "create",
      entity: {
        id: finishElementId,
        position: Position.create({ v: [...position] }),
      },
    },
    {
      kind: "create",
      entity: {
        id: stashId,
        stashed: Stashed.create({
          stashed_at: startedAt,
          stashed_by: instanceId,
          original_entity_id: first.userId,
        }),
      },
    }
  );
  await waitFor(
    `${label}: race fixture synchronizes`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.playing_minigame?.minigame_instance_id === instanceId,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await publishAndWaitForQuestStep({
    first,
    sameUserPeer,
    questId,
    step,
    label,
    event: new FinishSimpleRaceMinigameEvent({
      id: first.userId,
      minigame_id: minigameId,
      minigame_element_id: finishElementId,
      minigame_instance_id: instanceId,
    }),
  });
  assert.equal(
    (await authoritativeEntity(first.page, first.userId)).entity
      ?.playing_minigame,
    undefined,
    `${label} left the player stuck in the race`
  );
}

async function performEventStep(args) {
  switch (args.step.eventKind) {
    case "place":
      return performPlaceStep(args);
    case "npcKilled":
      return performNpcKilledStep(args);
    case "minigame_simple_race_finish":
      return performRaceStep(args);
    default:
      throw new Error(
        `No exhaustive robot-story action for ${args.step.eventKind}`
      );
  }
}

async function executeRobotStoryTriggerNode(args) {
  const { first, questId, step } = args;
  switch (step.kind) {
    case "seq":
    case "all":
    case "any":
    case "variant":
      for (const child of step.triggers) {
        await executeRobotStoryTriggerNode({ ...args, step: child });
      }
      if (
        !(
          await authoritativeEntity(first.page, first.userId)
        ).entity?.challenges?.complete.has(questId)
      ) {
        await waitForQuestLeaf(
          first,
          questId,
          step,
          `${
            nativeRobotStoryBikkieTray.contents.get(questId).displayName
          }: group ${step.id}`
        );
      }
      return;
    case "challengeClaimRewards":
      if (step.id === NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId) {
        return performBustedUnderwaterContainerStep(args);
      }
      return performQuestClaimStep(args);
    case "inventoryHas":
      return performInventoryHasStep(args);
    case "collectType":
      return performCollectTypeStep(args);
    case "craft":
      return performCraftStep(args);
    case "event":
      return performEventStep(args);
    default:
      throw new Error(
        `No exhaustive robot-story action for trigger ${step.kind}:${step.id}`
      );
  }
}

async function proveNativeRobotStoryExhaustiveRoundTrip(
  first,
  sameUserPeer,
  position
) {
  assert(nativeRobotStoryBikkieTray, "robot story Bikkie tray was not loaded");
  const quests = NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS.map((questId) =>
    nativeRobotStoryBikkieTray.contents.get(questId)
  );
  const targets = await createRobotStoryTargets(
    first,
    position,
    quests.map((quest) => quest.trigger)
  );
  const before = await authoritativeEntity(first.page, first.userId);
  const challenges = Challenges.create();
  challenges.complete.add(NATIVE_ROAD_AHEAD_QUEST_ID);
  challenges.started_at.set(
    NATIVE_ROAD_AHEAD_QUEST_ID,
    secondsSinceEpoch() - 20
  );
  challenges.finished_at.set(
    NATIVE_ROAD_AHEAD_QUEST_ID,
    secondsSinceEpoch() - 10
  );
  challenges.in_progress.add(NATIVE_BUSTED_QUEST_ID);
  challenges.started_at.set(NATIVE_BUSTED_QUEST_ID, secondsSinceEpoch());
  const triggerState = TriggerState.clone(before.entity.trigger_state);
  for (const questId of NATIVE_ROBOT_STORY_QUEST_IDS) {
    triggerState.by_root.delete(questId);
  }
  const inventory = Inventory.create({
    items: [countOf(NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_SHELL, 1n)],
    hotbar: new Array(PLAYER_HOTBAR_SLOTS),
    currencies: new Map(),
    overflow: new Map(),
    selected: { kind: "hotbar", idx: 0 },
  });
  inventory.items.length = PLAYER_INVENTORY_SLOTS;
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      challenges,
      trigger_state: triggerState,
      inventory,
      recipe_book: RecipeBook.create(),
      wearing: Wearing.create({ items: new Map() }),
      position: Position.create({ v: [...position] }),
    },
  });
  await waitFor(
    "Busted exhaustive starting fixture synchronizes",
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.challenges?.in_progress.has(NATIVE_BUSTED_QUEST_ID) &&
      inventoryCount(entity, NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_SHELL) === 1n,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );

  for (let index = 0; index < quests.length; index += 1) {
    const quest = quests[index];
    const questId = quest.id;
    await waitFor(
      `${quest.displayName}: chapter is active before exhaustive actions`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) => entity?.challenges?.in_progress.has(questId),
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    );
    await executeRobotStoryTriggerNode({
      first,
      sameUserPeer,
      position,
      targets,
      questId,
      step: quest.trigger,
    });
    const nextQuestId = quests[index + 1]?.id;
    const completed = await waitFor(
      `${quest.displayName}: chapter completion and automatic continuation`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        entity?.challenges?.complete.has(questId) &&
        (nextQuestId ? entity.challenges.in_progress.has(nextQuestId) : true),
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    );
    if (nextQuestId) {
      await waitFor(
        `${quest.displayName}: next chapter reaches frontend`,
        () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
        (snapshot) =>
          snapshot.activeQuestId === String(nextQuestId) &&
          snapshot.mainQuestId === String(nextQuestId) &&
          questFromFrontend(snapshot, nextQuestId)?.status === "active",
        Math.max(originSyncGateMs, 10_000),
        timeoutMs
      );
    }
    report.scenarios.push({
      name: `${quest.displayName}: every authored action completed`,
      status: "pass",
      questId: String(questId),
      triggerNodeIds: triggerTreeNodeIds(quest.trigger).map(String),
      nextQuestId: nextQuestId ? String(nextQuestId) : undefined,
      authoritativeMs: completed.elapsedMs,
    });
  }

  const final = await authoritativeEntity(first.page, first.userId);
  assert.equal(
    inventoryCount(final.entity, NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_SHELL),
    0n,
    "Sophia did not consume the Robot Shell"
  );
  assert.equal(
    inventoryCount(final.entity, NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_MOTOR_UNIT),
    0n,
    "Sophia did not consume the Robot Motor Unit"
  );
  assert.equal(
    inventoryCount(
      final.entity,
      NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_POWER_SUPPLY
    ),
    0n,
    "Sophia did not consume the Robot Power Supply"
  );
  assert.equal(
    inventoryCount(final.entity, NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT),
    1n,
    "Sophia did not grant the assembled Robot"
  );
}

async function proveBustedUnderwaterContainerProgression(
  first,
  sameUserPeer,
  position
) {
  const before = await authoritativeEntity(first.page, first.userId);
  const challenges = Challenges.clone(before.entity.challenges);
  challenges.available.delete(NATIVE_BUSTED_QUEST_ID);
  challenges.in_progress.add(NATIVE_BUSTED_QUEST_ID);
  challenges.complete.add(NATIVE_ROAD_AHEAD_QUEST_ID);

  const triggerState = TriggerState.clone(before.entity.trigger_state);
  // These are the original Busted seq nodes before the sunken-ship reward
  // leaf. The inventory event below must fire the reward leaf itself.
  triggerState.by_root.set(
    NATIVE_BUSTED_QUEST_ID,
    new Map(
      [310783173745175, 859994236864492, 3346948724689018].map(
        (stepId, index) => [stepId, secondsSinceEpoch() - 10 + index]
      )
    )
  );

  const containerId = await bridgeCall(first.page, "allocateId");
  const containerItems = new Array(16);
  containerItems[0] = countOf(
    NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    1n
  );
  await applyFixture(
    first.page,
    {
      kind: "update",
      entity: {
        id: first.userId,
        challenges,
        trigger_state: triggerState,
      },
    },
    {
      kind: "create",
      entity: {
        id: containerId,
        position: Position.create({ v: [...position] }),
        label: Label.create({ text: "Chest The Grove Underwater Main" }),
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
    }
  );
  await waitFor(
    "Busted: underwater chest fixture synchronized",
    async () => ({
      player: await localEntity(first.page, first.userId),
      container: await localEntity(first.page, containerId),
    }),
    ({ player, container }) =>
      player.entity?.challenges?.in_progress.has(NATIVE_BUSTED_QUEST_ID) &&
      container.entity?.container_inventory?.items?.[0]?.item?.id ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    originSyncGateMs
  );

  const beforeContainer = await authoritativeEntity(first.page, containerId);
  await publishAndProve({
    name: "Busted: underwater chest reward transfer",
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
      player.entity?.inventory?.items?.[5]?.item?.id ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    localProbe: async () => ({
      container: await localEntity(first.page, containerId),
      player: await localEntity(first.page, first.userId),
    }),
    localPredicate: ({ container, player }) =>
      !container.entity?.container_inventory?.items?.[0] &&
      player.entity?.inventory?.items?.[5]?.item?.id ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    secondProbe: sameUserPeer
      ? async () => ({
          container: await localEntity(sameUserPeer, containerId),
          player: await localEntity(sameUserPeer, first.userId),
        })
      : undefined,
    secondPredicate: sameUserPeer
      ? ({ container, player }) =>
          !container.entity?.container_inventory?.items?.[0] &&
          player.entity?.inventory?.items?.[5]?.item?.id ===
            NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
      : undefined,
  });

  const progressed = await waitFor(
    "Busted: underwater reward advances native quest state",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      serializedTriggerStepIsFired(
        entity,
        NATIVE_BUSTED_QUEST_ID,
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId
      ),
    Math.max(acceptanceGateMs, 5_000),
    timeoutMs
  );
  const frontend = await waitFor(
    "Busted: progressed objective reaches frontend",
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) =>
      snapshot.activeQuestId === String(NATIVE_BUSTED_QUEST_ID) &&
      snapshot.mainQuestId === String(NATIVE_BUSTED_QUEST_ID) &&
      snapshot.quests.some(
        (quest) =>
          quest.questId === String(NATIVE_BUSTED_QUEST_ID) &&
          quest.status === "active" &&
          Boolean(quest.objective)
      ),
    originSyncGateMs,
    timeoutMs
  );
  report.scenarios.push({
    name: "Busted underwater chest advances native quest progression",
    status: "pass",
    questId: String(NATIVE_BUSTED_QUEST_ID),
    stepId: String(NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId),
    itemId: String(NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId),
    authoritativeMs: progressed.elapsedMs,
    frontendProjectionMs: frontend.elapsedMs,
  });
}

async function proveNativeRobotStoryRoundTrip(first, sameUserPeer, position) {
  const targetSpecs = [
    {
      name: "Jackie",
      typeId: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.roadAhead.targetId,
    },
    {
      name: "Spare Robot Parts",
      typeId: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.getTheMuckOut.targetId,
    },
    {
      name: "Sophia",
      typeId: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.muckVsMachine.targetId,
    },
  ];
  const targetIds = [];
  for (let index = 0; index < targetSpecs.length; index++) {
    targetIds.push(await bridgeCall(first.page, "allocateId"));
  }
  await applyFixture(
    first.page,
    ...targetSpecs.map((target, index) => ({
      kind: "create",
      entity: {
        id: targetIds[index],
        position: Position.create({
          v: [position[0] + index + 1, position[1], position[2]],
        }),
        npc_metadata: NpcMetadata.create({
          type_id: target.typeId,
          created_time: secondsSinceEpoch(),
          spawn_position: [position[0] + index + 1, position[1], position[2]],
          spawn_orientation: [0, 0],
        }),
        label: Label.create({ text: `E2E ${target.name}` }),
      },
    }))
  );

  const chapters = [
    {
      title: "The Road Ahead",
      handoff: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.roadAhead,
      targetId: targetIds[0],
      nextQuestId: NATIVE_BUSTED_QUEST_ID,
      nextTitle: "Busted",
    },
    {
      title: "Busted",
      handoff: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.busted,
      targetId: targetIds[0],
      nextQuestId: NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
      nextTitle: "Get the Muck Out",
    },
    {
      title: "Get the Muck Out",
      handoff: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.getTheMuckOut,
      targetId: targetIds[1],
      nextQuestId: NATIVE_MUCK_VS_MACHINE_QUEST_ID,
      nextTitle: "Muck vs. Machine",
    },
    {
      title: "Muck vs. Machine",
      handoff: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.muckVsMachine,
      targetId: targetIds[2],
    },
  ];
  const completedQuestIds = [];

  for (const chapter of chapters) {
    if (chapter.handoff.questId === NATIVE_BUSTED_QUEST_ID) {
      await proveBustedUnderwaterContainerProgression(
        first,
        sameUserPeer,
        position
      );
    }
    const before = await authoritativeEntity(first.page, first.userId);
    const fixture = nativeRobotStoryHandoffFixture(
      before.entity,
      chapter.handoff,
      completedQuestIds
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        challenges: fixture.challenges,
        trigger_state: fixture.triggerState,
      },
    });
    await waitFor(
      `${chapter.title}: final handoff fixture synchronized`,
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        entity?.challenges?.in_progress.has(chapter.handoff.questId),
      originSyncGateMs
    );

    const activeFrontend = await waitFor(
      `${chapter.title}: active objective projected before final handoff`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) =>
        snapshot.ecs.inProgress.includes(String(chapter.handoff.questId)) &&
        snapshot.activeQuestId === String(chapter.handoff.questId) &&
        snapshot.mainQuestId === String(chapter.handoff.questId) &&
        snapshot.quests.some(
          (quest) =>
            quest.questId === String(chapter.handoff.questId) &&
            quest.title === chapter.title &&
            quest.status === "active" &&
            Boolean(quest.objective)
        ),
      originSyncGateMs,
      timeoutMs
    );
    report.scenarios.push({
      name: `${chapter.title} active objective reaches the frontend`,
      status: "pass",
      questId: String(chapter.handoff.questId),
      frontendProjectionMs: activeFrontend.elapsedMs,
    });

    const preComplete = await authoritativeEntity(first.page, first.userId);
    await publishAndProve({
      name: `${chapter.title}: frontend final handoff completes native chapter`,
      page: first.page,
      event: new CompleteQuestStepAtEntityEvent({
        id: first.userId,
        challenge_id: chapter.handoff.questId,
        entity_id: chapter.targetId,
        step_id: chapter.handoff.finalStepId,
      }),
      authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
      authoritativePredicate: ({ version, entity }) =>
        version > preComplete.version &&
        entity?.challenges?.complete.has(chapter.handoff.questId) &&
        (chapter.nextQuestId
          ? entity.challenges.in_progress.has(chapter.nextQuestId)
          : true),
      localProbe: () => localEntity(first.page, first.userId),
      localPredicate: ({ entity }) =>
        entity?.challenges?.complete.has(chapter.handoff.questId) &&
        (chapter.nextQuestId
          ? entity.challenges.in_progress.has(chapter.nextQuestId)
          : true),
      secondProbe: sameUserPeer
        ? () => localEntity(sameUserPeer, first.userId)
        : undefined,
      secondPredicate: sameUserPeer
        ? ({ entity }) =>
            entity?.challenges?.complete.has(chapter.handoff.questId) &&
            (chapter.nextQuestId
              ? entity.challenges.in_progress.has(chapter.nextQuestId)
              : true)
        : undefined,
    });

    const frontend = await waitFor(
      `${chapter.title}: synchronized frontend quest projection`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) => {
        const completed = snapshot.quests.some(
          (quest) =>
            quest.questId === String(chapter.handoff.questId) &&
            quest.status === "completed"
        );
        if (!completed) return false;
        if (!chapter.nextQuestId) return true;
        return (
          snapshot.ecs.inProgress.includes(String(chapter.nextQuestId)) &&
          snapshot.activeQuestId === String(chapter.nextQuestId) &&
          snapshot.mainQuestId === String(chapter.nextQuestId) &&
          snapshot.quests.some(
            (quest) =>
              quest.questId === String(chapter.nextQuestId) &&
              quest.title === chapter.nextTitle &&
              quest.status === "active"
          )
        );
      },
      originSyncGateMs,
      timeoutMs
    );
    completedQuestIds.push(chapter.handoff.questId);
    report.scenarios.push({
      name: `${chapter.title} automatically continues the native robot story`,
      status: "pass",
      questId: String(chapter.handoff.questId),
      nextQuestId: chapter.nextQuestId
        ? String(chapter.nextQuestId)
        : undefined,
      frontendProjectionMs: frontend.elapsedMs,
    });
  }

  const completedStory = await authoritativeEntity(first.page, first.userId);
  assert(
    completedStory.entity?.challenges?.complete.has(
      NATIVE_MUCK_VS_MACHINE_QUEST_ID
    ),
    "Muck vs. Machine was not completed authoritatively"
  );
  assert(
    inventoryCount(
      completedStory.entity,
      NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT
    ) >= 1n,
    "the assembled robot reward was not delivered"
  );

  if (robotStoryOnly) {
    const reloadFailureBaseline = report.browser.failures.length;
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
      "robot story reload reconstructs all completed chapters",
      async () => ({
        entity: (await localEntity(first.page, first.userId)).entity,
        frontend: await bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      }),
      ({ entity, frontend }) =>
        inventoryCount(entity, NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT) >=
          1n &&
        NATIVE_ROBOT_STORY_QUEST_IDS.every((questId) =>
          frontend.ecs.complete.includes(String(questId))
        ) &&
        NATIVE_ROBOT_STORY_QUEST_IDS.every((questId) =>
          frontend.quests.some(
            (quest) =>
              quest.questId === String(questId) && quest.status === "completed"
          )
        ),
      originSyncGateMs,
      timeoutMs
    );
    // A deliberate full-page reload aborts in-flight mesh requests and briefly
    // tears down the old sync socket. The reconstructed frontend projection
    // and assembled-robot inventory check above prove the replacement client
    // is healthy, so preserve those navigation diagnostics as transients
    // rather than misreporting them as gameplay failures.
    report.browser.transients.push(
      ...report.browser.failures.splice(reloadFailureBaseline)
    );
    report.scenarios.push({
      name: "complete robot story survives reload and frontend reconstruction",
      status: "pass",
      frontendProjectionMs: reloaded.elapsedMs,
    });
  }
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
    const requirements = template.requirements.map((requirement) => ({
      ...requirement,
    }));
    if (template.kind === "delivery") {
      const parcel = requirements.find((requirement) => requirement.itemId);
      if (parcel) {
        // Production auto-seeding assigns a collection point to repeatable
        // deliveries. Keep the deterministic fixture production-shaped so the
        // browser test proves pickup -> parcel -> drop-off marker transitions.
        parcel.pickupMarkerId =
          template.boardScope === "harthmere"
            ? "harthmere_bridge_center"
            : "grove_tool_crate";
      }
    }
    jobs.postings[jobId] = {
      jobId,
      boardId,
      issuerKind: template.issuerKind,
      issuerId: template.issuerId,
      title: template.title,
      description: template.description,
      kind: template.kind,
      requirements,
      templateId: template.templateId,
      rewardGold,
      escrowGold: rewardGold,
      reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
      status: "open",
      townId: board.townId,
      regionId: board.regionId,
      createdAtMs: nowMs + index,
      deadlineAtMs: nowMs + 24 * 60 * 60 * 1000,
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
      requirements,
      rewardGold,
      mapMarkerId:
        jobs.postings[jobId].mapMarkerId ?? jobs.postings[jobId].targetId,
      targetId: jobs.postings[jobId].targetId,
    };
  });

  // Rebuild issuer indexes from the final posting set so accepting/completing
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

function nativeGold(entity) {
  return stackCount(
    [...(entity?.inventory?.currencies?.values?.() ?? [])],
    BikkieIds.bling
  );
}

function setNativeInventoryCount(inventory, itemId, count) {
  for (const slots of [inventory.items, inventory.hotbar]) {
    for (let index = 0; index < slots.length; index += 1) {
      if (slots[index]?.item?.id !== itemId) continue;
      slots[index] = count > 0 ? countOf(itemId, BigInt(count)) : undefined;
      return;
    }
  }
  const emptyIndex = inventory.items.findIndex((slot) => !slot);
  assert(emptyIndex >= 0, `no native inventory slot available for ${itemId}`);
  inventory.items[emptyIndex] = countOf(itemId, BigInt(count));
}

async function moveJobsE2EPlayer(first, position, label) {
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: position }),
    },
  });
  await waitFor(
    `${label}: native position synchronized`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.position?.v?.[0] === position[0] &&
      entity?.position?.v?.[2] === position[2],
    originSyncGateMs,
    timeoutMs
  );
}

async function provisionJobsE2ERequirements(first, expected) {
  const requiredItems = expected.requirements.filter(
    (requirement) => requirement.itemId && expected.kind !== "delivery"
  );
  const requiredToolAction = expected.requirements.find(
    (requirement) => requirement.requiredToolAction
  )?.requiredToolAction;
  if (!requiredItems.length && !requiredToolAction) return;

  const authoritative = await authoritativeEntity(first.page, first.userId);
  assert(
    authoritative.entity?.inventory,
    `${expected.templateId}: no inventory`
  );
  const inventory = Inventory.clone(authoritative.entity.inventory);
  for (const requirement of requiredItems) {
    const nativeItemId = harthmereNativeBiomesIdForItemId(requirement.itemId);
    assert(
      nativeItemId,
      `${expected.templateId}: ${requirement.itemId} has no native item id`
    );
    setNativeInventoryCount(
      inventory,
      nativeItemId,
      Math.max(1, Number(requirement.count ?? 1))
    );
  }

  let selectedItem;
  let selectedToolId;
  if (requiredToolAction) {
    const toolItemKey =
      requiredToolAction === "repair" ? "repair_mallet" : "muck_rake";
    const toolItemId = harthmereNativeBiomesIdForItemId(toolItemKey);
    assert(toolItemId, `${toolItemKey} has no native item id`);
    selectedToolId = toolItemId;
    inventory.hotbar[0] = countOf(toolItemId, 1n);
    inventory.selected = { kind: "hotbar", idx: 0 };
    selectedItem = SelectedItem.create({ item: inventory.hotbar[0] });
  }

  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      inventory,
      ...(selectedItem ? { selected_item: selectedItem } : {}),
    },
  });
  await waitFor(
    `${expected.templateId}: native requirements synchronized`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      requiredItems.every((requirement) => {
        const nativeItemId = harthmereNativeBiomesIdForItemId(
          requirement.itemId
        );
        return (
          nativeItemId &&
          inventoryCount(entity, nativeItemId) >=
            BigInt(Math.max(1, Number(requirement.count ?? 1)))
        );
      }) &&
      (!selectedToolId ||
        entity?.selected_item?.item?.item?.id === selectedToolId),
    originSyncGateMs,
    timeoutMs
  );
}

function jobsE2EMarkerPosition(markerId, label) {
  const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(markerId);
  assert(marker, `${label}: missing runtime marker ${markerId}`);
  return marker.position;
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

      const before = await jobsBoardFetchWithRetry(
        first.page,
        `${expected.templateId}:before`
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
      assert.deepEqual(acceptedJob, {
        jobId: expected.jobId,
        boardId: expected.boardId,
        templateId: expected.templateId,
        title: expected.title,
        kind: expected.kind,
      });
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
      const goldBefore = nativeGold(nativePlayer.entity);
      await provisionJobsE2ERequirements(first, expected);

      let objectiveCompleted;
      if (expected.kind === "delivery") {
        const parcel = expected.requirements.find(
          (requirement) => requirement.itemId
        );
        assert(
          parcel?.pickupMarkerId,
          `${expected.templateId}: pickup missing`
        );
        assert.equal(
          marker.mapMarkerId,
          parcel.pickupMarkerId,
          `${expected.templateId}: frontend did not start at parcel pickup`
        );
        const parcelItemId = harthmereNativeBiomesIdForItemId(parcel.itemId);
        assert(parcelItemId, `${expected.templateId}: parcel item id missing`);
        const beforePickup = inventoryCount(nativePlayer.entity, parcelItemId);
        await moveJobsE2EPlayer(
          first,
          jobsE2EMarkerPosition(
            parcel.pickupMarkerId,
            `${expected.templateId}: pickup`
          ),
          `${expected.templateId}: pickup`
        );
        const pickedUp = await bridgeCall(
          first.page,
          "jobsBoardFrontendRoundTrip",
          {
            operation: "pickup",
            jobId: expected.jobId,
            boardId: expected.boardId,
            questTodoId: todo.todoId,
            completedTargetId: parcel.pickupMarkerId,
            requestId: `jobs_e2e_pickup:${runId}:${expected.templateId}`,
          }
        );
        const dropoffMarker = pickedUp.markers.find(
          (row) => row.jobsBoardJobId === expected.jobId
        );
        assert(
          dropoffMarker,
          `${expected.templateId}: drop-off marker missing`
        );
        assert.equal(
          dropoffMarker.mapMarkerId,
          parcel.mapMarkerId,
          `${expected.templateId}: marker did not advance to drop-off`
        );
        const nativeAfterPickup = await authoritativeEntity(
          first.page,
          first.userId
        );
        assert.equal(
          inventoryCount(nativeAfterPickup.entity, parcelItemId),
          beforePickup + BigInt(parcel.count ?? 1),
          `${expected.templateId}: parcel was not created in native inventory`
        );
        await moveJobsE2EPlayer(
          first,
          jobsE2EMarkerPosition(
            parcel.mapMarkerId,
            `${expected.templateId}: drop-off`
          ),
          `${expected.templateId}: drop-off`
        );
        objectiveCompleted = await bridgeCall(
          first.page,
          "jobsBoardFrontendRoundTrip",
          {
            operation: "completeQuest",
            jobId: expected.jobId,
            boardId: expected.boardId,
            questTodoId: todo.todoId,
            completedTargetId:
              parcel.recipientNpcId ?? parcel.targetId ?? parcel.mapMarkerId,
            requestId: `jobs_e2e_objective:${runId}:${expected.templateId}`,
          }
        );
        const nativeAfterDropoff = await authoritativeEntity(
          first.page,
          first.userId
        );
        assert.equal(
          inventoryCount(nativeAfterDropoff.entity, parcelItemId),
          beforePickup,
          `${expected.templateId}: delivered parcel was not consumed natively`
        );
      } else if (expected.kind === "escort") {
        const escortTarget = expected.requirements[0]?.mapMarkerId;
        assert(escortTarget, `${expected.templateId}: escort target missing`);
        await moveJobsE2EPlayer(
          first,
          jobsE2EMarkerPosition(
            escortTarget,
            `${expected.templateId}: escort destination`
          ),
          `${expected.templateId}: escort destination`
        );
        objectiveCompleted = (
          await waitFor(
            `${expected.templateId}: server escort scheduler completed todo`,
            () =>
              bridgeCall(first.page, "jobsBoardFrontendRoundTrip", {
                operation: "fetch",
              }),
            (snapshot) =>
              snapshot.todos.some(
                (row) =>
                  row.todoId === todo.todoId && row.status === "completed"
              ),
            Math.max(originSyncGateMs, 10_000),
            timeoutMs
          )
        ).value;
      } else {
        const completionTarget =
          expected.requirements.find(
            (requirement) => requirement.mapMarkerId || requirement.targetId
          ) ?? {};
        const objectiveMarkerId =
          completionTarget.mapMarkerId ?? expected.mapMarkerId;
        if (expected.requirements.length && expected.kind !== "craft") {
          assert(
            objectiveMarkerId,
            `${expected.templateId}: field objective marker missing`
          );
        }
        if (objectiveMarkerId && expected.kind !== "craft") {
          await moveJobsE2EPlayer(
            first,
            jobsE2EMarkerPosition(
              objectiveMarkerId,
              `${expected.templateId}: objective`
            ),
            `${expected.templateId}: objective`
          );
        }
        objectiveCompleted = await bridgeCall(
          first.page,
          "jobsBoardFrontendRoundTrip",
          {
            operation: "completeQuest",
            jobId: expected.jobId,
            boardId: expected.boardId,
            questTodoId: todo.todoId,
            completedTargetId: completionTarget.targetId ?? objectiveMarkerId,
            requestId: `jobs_e2e_objective:${runId}:${expected.templateId}`,
          }
        );
      }

      assert(
        objectiveCompleted.todos.some(
          (row) => row.todoId === todo.todoId && row.status === "completed"
        ),
        `${expected.templateId}: objective did not complete`
      );
      const returnMarker = objectiveCompleted.markers.find(
        (row) => row.jobsBoardJobId === expected.jobId
      );
      assert(
        returnMarker,
        `${expected.templateId}: return-to-board marker missing`
      );
      assert(
        distance3(returnMarker.position, boardPosition) <=
          board.location.radius + 2,
        `${expected.templateId}: completed objective did not point to its board`
      );

      await moveJobsE2EPlayer(
        first,
        boardPosition,
        `${expected.templateId}: reward board`
      );
      const completed = await bridgeCall(
        first.page,
        "jobsBoardFrontendRoundTrip",
        {
          operation: "complete",
          jobId: expected.jobId,
          boardId: expected.boardId,
          requestId: `jobs_e2e_complete:${runId}:${expected.templateId}`,
        }
      );
      assert(
        !completed.acceptedJobs.some((row) => row.jobId === expected.jobId),
        `${expected.templateId}: completed job remained accepted`
      );
      assert(
        !completed.markers.some((row) => row.jobsBoardJobId === expected.jobId),
        `${expected.templateId}: completed marker remained active`
      );
      const nativeCompleted = await authoritativeEntity(
        first.page,
        first.userId
      );
      assert.equal(
        nativeGold(nativeCompleted.entity),
        goldBefore + BigInt(expected.rewardGold),
        `${expected.templateId}: reward was not paid through native wallet`
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
        rewardGold: expected.rewardGold,
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

async function proveNativeChaseRoundTrip(first, combatPosition) {
  // Keep this focused chase proof independent of audio state while exercising
  // the exact generated Harthmere NPC biscuit used by additive-town Muckers.
  // The snapshot's legacy dMucker biscuit is intentionally non-attackable and
  // therefore cannot prove the native Anima chase path.
  const combatSeed = harthmereGroundedMuckMonsterSeedsInTerritory().find(
    (seed) => seed.areaId !== "road_muckwad_patch"
  );
  assert(combatSeed, "no native combat NPC seed is available");
  const combatProfile = harthmereNativeNpcCombatProfileForSeed(combatSeed);
  await publishFrontendMove(first.page, first.userId, combatPosition);
  await waitFor(
    "open combat node reaches authoritative ECS/HFC position",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      Boolean(entity?.position?.v) &&
      distance3(entity.position.v, combatPosition) <= 0.75,
    15_000,
    30_000
  );
  await delay(500);
  const npcId = await bridgeCall(first.page, "allocateId");
  const targetPosition = [
    combatPosition[0] + 2,
    combatPosition[1],
    combatPosition[2],
  ];
  const maxHp = combatProfile.maxHp;
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: npcId,
      position: Position.create({ v: targetPosition }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      size: Size.create({ v: [1, 2, 1] }),
      health: Health.create({ hp: maxHp, maxHp }),
      npc_state: NpcState.create(),
      npc_metadata: NpcMetadata.create({
        type_id: combatProfile.id,
        created_time: secondsSinceEpoch(),
        spawn_position: targetPosition,
        spawn_orientation: [0, 0],
      }),
      label: Label.create({
        text: `E2E ${combatProfile.displayName} Chaser`,
      }),
    },
  });
  await waitFor(
    "native Mucker chase fixture synchronized to attacker",
    () => localEntity(first.page, npcId),
    ({ entity }) => entity?.health?.hp === maxHp,
    combatFixtureSyncGateMs
  );
  console.log("E2E chase: fixture synchronized; provoking Mucker");

  const beforeNpcHit = await authoritativeEntity(first.page, npcId);
  await publishAndProve({
    name: "frontend Mucker provocation",
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
      version > beforeNpcHit.version && entity?.health?.hp < maxHp,
    localProbe: () => localEntity(first.page, npcId),
    localPredicate: ({ entity }) => entity?.health?.hp < maxHp,
  });
  console.log("E2E chase: provocation authoritative; relocating player");

  const chaseStart = await authoritativeEntity(first.page, npcId);
  assert(chaseStart.entity?.position?.v, "Mucker has no chase start position");
  const chaseStartPosition = [...chaseStart.entity.position.v];
  const chasePlayerPosition = [
    combatPosition[0] + 6,
    combatPosition[1],
    combatPosition[2],
  ];
  const chaseStartDistance = distance3(chaseStartPosition, chasePlayerPosition);
  const chaseStartedAtMs = Date.now();
  const frontendMove = await publishFrontendMove(
    first.page,
    first.userId,
    chasePlayerPosition
  );
  const playerMoveSync = await waitFor(
    "frontend MoveEvent reaches authoritative ECS/HFC position",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      Boolean(entity?.position?.v) &&
      distance3(entity.position.v, chasePlayerPosition) <= 0.75,
    15_000,
    30_000
  );

  const authoritativeChase = await waitFor(
    "Anima moves the native Mucker toward the visible player",
    () => authoritativeEntity(first.page, npcId),
    ({ entity }) => {
      const position = entity?.position?.v;
      return (
        Boolean(position) &&
        distance3(position, chaseStartPosition) >= 0.75 &&
        distance3(position, chasePlayerPosition) <= chaseStartDistance - 0.5
      );
    },
    10_000,
    15_000
  );
  console.log("E2E chase: Anima movement authoritative; proving render sync");
  const chasePosition = [...authoritativeChase.value.entity.position.v];
  const chaseDisplacement = distance3(chaseStartPosition, chasePosition);
  const chaseElapsedSeconds = Math.max(
    0.001,
    (Date.now() - chaseStartedAtMs) / 1000
  );
  assert(
    chaseDisplacement <=
      HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND * chaseElapsedSeconds +
        1.5,
    `Mucker chase exceeded the player-safe speed cap: ${chaseDisplacement.toFixed(
      2
    )}m in ${chaseElapsedSeconds.toFixed(2)}s`
  );

  const localChase = await waitFor(
    "native Mucker chase reaches the attacking frontend",
    () => localEntity(first.page, npcId),
    ({ entity }) =>
      Boolean(entity?.position?.v) &&
      distance3(entity.position.v, chasePosition) <= 0.75,
    originSyncGateMs
  );
  const renderedChase = await waitFor(
    "native Mucker chase reaches the visible combat actor",
    () => bridgeCall(first.page, "combatRenderSnapshot"),
    (snapshot) => {
      const record = snapshot.liveCreatureRecords.find(
        (candidate) => Number(candidate.id) === Number(npcId)
      );
      const actor = snapshot.combatActors[String(npcId)];
      return (
        Boolean(record?.at && actor?.world) &&
        distance3(record.at, chasePosition) <= 0.75 &&
        distance3(actor.world, record.at) <= 1.5
      );
    },
    10_000,
    15_000
  );
  const renderedRecord = renderedChase.value.liveCreatureRecords.find(
    (candidate) => Number(candidate.id) === Number(npcId)
  );
  report.scenarios.push({
    name: "frontend attack -> Anima chase -> ECS sync -> frontend render",
    status: "pass",
    npcId: String(npcId),
    authoritativeChaseMs: authoritativeChase.elapsedMs,
    frontendMoveMs: frontendMove.elapsedMs,
    playerMoveSyncMs: playerMoveSync.elapsedMs,
    localSyncMs: localChase.elapsedMs,
    renderSyncMs: renderedChase.elapsedMs,
    chaseDisplacement,
    chaseStartDistance,
    chaseEndDistance: distance3(chasePosition, chasePlayerPosition),
    renderedPosition: renderedRecord?.at,
    speedCap: HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND,
  });
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
  const chaseStart = await authoritativeEntity(first.page, npcId);
  assert(
    chaseStart.entity?.position?.v,
    "combat NPC has no chase start position"
  );
  const chaseStartPosition = [...chaseStart.entity.position.v];
  const chasePlayerPosition = [
    combatPosition[0] + 6,
    combatPosition[1],
    combatPosition[2],
  ];
  const chaseStartDistance = distance3(chaseStartPosition, chasePlayerPosition);
  const chaseStartedAtMs = Date.now();
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: chasePlayerPosition }),
    },
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
  const authoritativeChase = await waitFor(
    "Anima moves the native combat NPC toward the visible player",
    () => authoritativeEntity(first.page, npcId),
    ({ entity }) => {
      const position = entity?.position?.v;
      return (
        Boolean(position) &&
        distance3(position, chaseStartPosition) >= 0.75 &&
        distance3(position, chasePlayerPosition) <= chaseStartDistance - 0.5
      );
    },
    10_000,
    15_000
  );
  const chasePosition = [...authoritativeChase.value.entity.position.v];
  const chaseDisplacement = distance3(chaseStartPosition, chasePosition);
  const chaseElapsedSeconds = Math.max(
    0.001,
    (Date.now() - chaseStartedAtMs) / 1000
  );
  assert(
    chaseDisplacement <=
      HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND * chaseElapsedSeconds +
        1.5,
    `NPC chase exceeded the player-safe speed cap: ${chaseDisplacement.toFixed(
      2
    )}m in ${chaseElapsedSeconds.toFixed(2)}s`
  );
  const localChase = await waitFor(
    "native chase position reaches the attacking frontend",
    () => localEntity(first.page, npcId),
    ({ entity }) =>
      Boolean(entity?.position?.v) &&
      distance3(entity.position.v, chasePosition) <= 0.75,
    originSyncGateMs
  );
  const renderedChase = await waitFor(
    "ECS chase reaches the live creature bridge and visible combat actor",
    () => bridgeCall(first.page, "combatRenderSnapshot"),
    (snapshot) => {
      const record = snapshot.liveCreatureRecords.find(
        (candidate) => Number(candidate.id) === Number(npcId)
      );
      const actor = snapshot.combatActors[String(npcId)];
      return (
        Boolean(record?.at && actor?.world) &&
        distance3(record.at, chasePosition) <= 0.75 &&
        distance3(actor.world, record.at) <= 1.5
      );
    },
    10_000,
    15_000
  );
  const renderedRecord = renderedChase.value.liveCreatureRecords.find(
    (candidate) => Number(candidate.id) === Number(npcId)
  );
  report.scenarios.push({
    name: "frontend attack -> Anima chase -> ECS sync -> frontend render",
    status: "pass",
    npcId: String(npcId),
    authoritativeChaseMs: authoritativeChase.elapsedMs,
    localSyncMs: localChase.elapsedMs,
    renderSyncMs: renderedChase.elapsedMs,
    chaseDisplacement,
    chaseStartDistance,
    chaseEndDistance: distance3(chasePosition, chasePlayerPosition),
    renderedPosition: renderedRecord?.at,
    speedCap: HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND,
  });
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

function finishFocusedChaseRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused native chase browser E2E (${report.scenarios.length} scenarios)`
  );
}

function finishFocusedRobotStoryRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused native robot story browser E2E (${report.scenarios.length} scenarios)`
  );
}

function finishFocusedJobsRun() {
  const expectedJobCount = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
    (template) =>
      harthmereAutoSeedTemplateRequirementsObtainable(template.requirements)
  ).length;
  assert.equal(
    report.scenarios.length,
    expectedJobCount + 1,
    `expected bootstrap plus ${expectedJobCount} job scenarios`
  );
  assert(
    report.scenarios.every((scenario) => scenario.status === "pass"),
    "one or more all-jobs browser scenarios did not pass"
  );
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused all-jobs browser E2E (${report.scenarios.length} scenarios)`
  );
}

async function run() {
  if (exhaustiveRobotStory) {
    await loadNativeRobotStoryBikkieTray();
  }
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
    if (!combatMusicOnly && !chaseOnly && !robotStoryOnly && !jobsOnly) {
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

    if (chaseOnly) {
      console.log("E2E chase: creating native Mucker fixture");
      const combatNode = HARTHMERE_GATHERING_AUTHORITY_NODES.find(
        (node) => node.requiredTool && node.requiredSkill <= 1
      );
      assert(combatNode, "no basic chase-position fixture is authored");
      await proveNativeChaseRoundTrip(first, [...combatNode.position]);
      finishFocusedChaseRun();
      return;
    }

    if (robotStoryOnly) {
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
      await waitForPlayerFixture(first.page, first.userId);
      if (exhaustiveRobotStory) {
        await proveNativeRobotStoryExhaustiveRoundTrip(
          first,
          sameUserPeer,
          position
        );
      } else {
        await proveNativeRobotStoryRoundTrip(first, sameUserPeer, position);
      }
      finishFocusedRobotStoryRun();
      return;
    }

    if (jobsOnly) {
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
      await waitForPlayerFixture(first.page, first.userId);
      await proveAllJobsBoardFrontendNativeEcsRoundTrips(first);
      finishFocusedJobsRun();
      return;
    }

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

    // Complete each chapter's final authored claim through the browser event
    // queue. The proof waits for logic/firehose/trigger processing, native ECS
    // challenge mutation, websocket sync to two clients, and the final Biomes
    // UI quest projection before moving to the next chapter.
    await proveNativeRobotStoryRoundTrip(first, sameUserPeer, position);

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
      await bridgeCall(first.page, "farmingHoeQuestSnapshot", "reset");
      const acceptedHoeGuide = await bridgeCall(
        first.page,
        "farmingHoeQuestSnapshot",
        "accept"
      );
      assert.equal(acceptedHoeGuide.state, "active");
      assert.equal(acceptedHoeGuide.quests?.[0]?.questId, "farming:buy-a-hoe");
      assert.equal(
        acceptedHoeGuide.markers?.[0]?.id,
        "farming:orchard-produce-stand"
      );
      assert.deepEqual(
        acceptedHoeGuide.markers?.[0]?.position,
        [2062, 53, -112]
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
      const completedHoeGuide = await waitFor(
        "native hoe permanently completes JavaScript farming guide",
        () => bridgeCall(first.page, "farmingHoeQuestSnapshot", "reconcile"),
        (snapshot) =>
          snapshot?.hasHoe === true &&
          snapshot?.state === "completed" &&
          snapshot?.quests?.length === 0 &&
          snapshot?.markers?.length === 0,
        originSyncGateMs,
        timeoutMs
      );

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
          snapshot?.plants?.every((plant) => plant.ownedByPlayer === true) &&
          snapshot?.plants?.some(
            (plant) =>
              String(plant.id) === String(plantedId) &&
              plant.status === "fully_grown"
          ),
        originSyncGateMs,
        timeoutMs
      );
      const frontendCropMap = await waitFor(
        "grown crop returns to JavaScript My Crops map layer",
        () => bridgeCall(first.page, "farmingMapFrontendSnapshot"),
        (snapshot) =>
          snapshot?.plants?.every((plant) => plant.ownedByPlayer === true) &&
          snapshot?.markers?.some(
            (marker) =>
              marker.id === `farming:crop:${String(plantedId)}` &&
              marker.position?.every(
                (coordinate, index) => coordinate === tillTarget.position[index]
              )
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
        frontendMapMs: frontendCropMap.elapsedMs,
        hoeGuideCompletedMs: completedHoeGuide.elapsedMs,
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
