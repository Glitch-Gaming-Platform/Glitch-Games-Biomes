#!/usr/bin/env node
"use strict";

/*
 * Physical-iPhone Harthmere fight acceptance.
 *
 * This runner deliberately uses SafariDriver on a paired USB device. It does
 * not emulate an iPhone in Chromium. Admin APIs create one deterministic
 * player/NPC fixture, but every attack and movement gesture is delivered as a
 * W3C touch pointer action to the rendered mobile HUD.
 */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  Collideable,
  Health,
  Inventory,
  Label,
  MovementState,
  NpcMetadata,
  NpcState,
  Orientation,
  Position,
  RigidBody,
  SelectedItem,
  Size,
  TriggerState,
} = require("../../src/shared/ecs/gen/components");
const { SerializeForServer } = require("../../src/shared/ecs/gen/json_serde");
const {
  zGetWithVersionResponse,
} = require("../../src/pages/api/admin/ecs/get_with_version");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
const { countOf } = require("../../src/shared/game/items");
const {
  harthmereGroundedMuckMonsterSeedsInTerritory,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  harthmereNativeBiomesIdForItemId,
} = require("../../src/shared/harthmere/harthmere_native_item_ids");
const {
  harthmereNativeNpcCombatProfileForSeed,
  writeHarthmereNativeCombatProgression,
} = require("../../src/shared/harthmere/harthmere_native_combat");
const {
  zrpcWebDeserialize,
  zrpcWebSerialize,
} = require("../../src/shared/zrpc/serde");
const { secondsSinceEpoch } = require("../../src/shared/ecs/config");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const baseUrl =
  process.env.HARTHMERE_IOS_BASE_URL || "http://192.168.0.204:3017";
const syncBaseUrl =
  process.env.HARTHMERE_IOS_SYNC_BASE_URL || "http://192.168.0.204:4907";
const webDriverUrl =
  process.env.HARTHMERE_IOS_WEBDRIVER_URL || "http://127.0.0.1:4444";
const existingSessionId = process.env.HARTHMERE_IOS_WEBDRIVER_SESSION;
const deviceUdid =
  process.env.HARTHMERE_IOS_DEVICE_UDID || "00008101-000450913699001E";
const deviceName = process.env.HARTHMERE_IOS_DEVICE_NAME || "iPhone (85)";
const platformVersion = process.env.HARTHMERE_IOS_PLATFORM_VERSION || "26.5.2";
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const timeoutMs = Number(process.env.HARTHMERE_IOS_TIMEOUT_MS || 180_000);
const sessionTimeoutMs = Number(
  process.env.HARTHMERE_IOS_SESSION_TIMEOUT_MS || 45_000
);
const idleSampleMs = Number(process.env.HARTHMERE_IOS_IDLE_SAMPLE_MS || 20_000);
const combatSampleMs = Number(
  process.env.HARTHMERE_IOS_COMBAT_SAMPLE_MS || 20_000
);
const soakMs = Number(process.env.HARTHMERE_IOS_SOAK_MS || 600_000);
const warmupMs = Number(process.env.HARTHMERE_IOS_WARMUP_MS || 20_000);
const observeOnly = process.env.HARTHMERE_IOS_OBSERVE_ONLY === "1";
const keepSession = process.env.HARTHMERE_IOS_KEEP_SESSION === "1";
const safariDiagnose = process.env.HARTHMERE_IOS_SAFARI_DIAGNOSE === "1";
const previewCleanupAb = process.env.HARTHMERE_IOS_PREVIEW_CLEANUP_AB === "1";
const clientHotfixScriptPath = process.env.HARTHMERE_IOS_CLIENT_HOTFIX_SCRIPT
  ? path.resolve(process.env.HARTHMERE_IOS_CLIENT_HOTFIX_SCRIPT)
  : undefined;
const minimumCombatFps = Number(process.env.HARTHMERE_IOS_MIN_COMBAT_FPS || 20);
const minimumSoakFps = Number(process.env.HARTHMERE_IOS_MIN_SOAK_FPS || 18);
const enemyCount = Math.max(
  1,
  Math.min(8, Number(process.env.HARTHMERE_IOS_ENEMY_COUNT || 5))
);
const runId =
  process.env.HARTHMERE_IOS_RUN_ID ||
  `physical-iphone-fight-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
const username =
  process.env.HARTHMERE_IOS_USERNAME ||
  `PhysicalIPhoneFight-${deviceUdid.slice(-6)}`;
const artifactsDir = path.resolve(
  process.env.HARTHMERE_IOS_ARTIFACTS_DIR ||
    path.join(root, "artifacts/harthmere-physical-iphone-fight", runId)
);
const reportPath = path.join(artifactsDir, "report.json");
const basePosition = [895, 62, -197];
const baseOrientation = [0, -Math.PI / 2]; // Positive X.

const report = {
  runId,
  username,
  baseUrl,
  syncBaseUrl,
  device: { udid: deviceUdid, name: deviceName, platformVersion },
  hostBuildId: fs
    .readFileSync(path.join(root, ".next/BUILD_ID"), "utf8")
    .trim(),
  expectedBuildId: process.env.HARTHMERE_IOS_EXPECTED_BUILD_ID,
  safariDiagnose,
  sessionTimeoutMs,
  startedAt: new Date().toISOString(),
  phases: [],
  touchEvents: [],
  errors: [],
};
let authCookieHeader = "";

function persist() {
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializedChange(change) {
  return ChangeSerde.serializeProposed(SerializeForServer, change);
}

async function waitFor(
  label,
  probe,
  predicate,
  waitMs = timeoutMs,
  intervalMs = 250
) {
  const deadline = Date.now() + waitMs;
  let last;
  let lastError;
  while (Date.now() < deadline) {
    try {
      last = await probe();
      if (predicate(last)) {
        return last;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `${label} timed out after ${waitMs}ms; last=${JSON.stringify(last)}; error=${
      lastError?.stack || lastError || "none"
    }`
  );
}

async function webDriverRequest(
  sessionId,
  method,
  commandPath,
  body,
  requestTimeout = timeoutMs
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeout);
  try {
    const response = await fetch(
      `${webDriverUrl}/session/${sessionId}${commandPath}`,
      {
        method,
        headers:
          body === undefined
            ? undefined
            : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      }
    );
    const payload = await response.json();
    if (!response.ok || payload?.value?.error) {
      throw new Error(
        `SafariDriver ${method} ${commandPath} failed: ${JSON.stringify(payload)}`
      );
    }
    return payload.value;
  } finally {
    clearTimeout(timer);
  }
}

async function createSession() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), sessionTimeoutMs);
  try {
    const response = await fetch(`${webDriverUrl}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        capabilities: {
          alwaysMatch: {
            browserName: "Safari",
            platformName: "iOS",
            "safari:useSimulator": false,
            "safari:deviceUDID": deviceUdid,
            "safari:deviceName": deviceName,
            "safari:deviceType": "iPhone",
            "safari:platformVersion": platformVersion,
            // Diagnostic collection is opt-in because acceptance measures the
            // phone, not SafariDriver's instrumentation. Enable it only for a
            // bridge failure that needs a diagnostic bundle.
            "safari:diagnose": safariDiagnose,
          },
        },
      }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok || payload?.value?.error || !payload?.value?.sessionId) {
      throw new Error(
        `SafariDriver session creation failed: ${JSON.stringify(payload)}`
      );
    }
    report.device.capabilities = payload.value.capabilities;
    return payload.value.sessionId;
  } finally {
    clearTimeout(timer);
  }
}

async function execute(sessionId, script, args = []) {
  return webDriverRequest(sessionId, "POST", "/execute/sync", { script, args });
}

async function executeAsync(
  sessionId,
  script,
  args = [],
  requestTimeout = timeoutMs
) {
  return webDriverRequest(
    sessionId,
    "POST",
    "/execute/async",
    { script, args },
    requestTimeout
  );
}

async function navigate(sessionId, url) {
  return webDriverRequest(sessionId, "POST", "/url", { url }, timeoutMs);
}

async function screenshot(sessionId, name) {
  const encoded = await webDriverRequest(sessionId, "GET", "/screenshot");
  const file = path.join(artifactsDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(encoded, "base64"));
  return file;
}

async function adminFetch(apiPath, init = {}) {
  const response = await fetch(new URL(apiPath, baseUrl), {
    ...init,
    headers: {
      cookie: authCookieHeader,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(
      `admin API ${apiPath} failed HTTP ${response.status}: ${await response.text()}`
    );
  }
  return response;
}

async function applyFixture(_sessionId, ...changes) {
  await adminFetch("/api/admin/apply_ecs_changes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      z: zrpcWebSerialize(changes.map(serializedChange)),
    }),
  });
}

async function authoritativeEntity(sessionId, id) {
  void sessionId;
  const response = await adminFetch("/api/admin/ecs/get_with_version", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ z: zrpcWebSerialize([id]) }),
  });
  const payload = await response.json();
  const rows = zrpcWebDeserialize(payload.z, zGetWithVersionResponse);
  const [version, wrapped] = rows?.[0] || [];
  return { version, entity: wrapped?.entity };
}

async function localEntity(sessionId, id) {
  return execute(
    sessionId,
    `
      const entity = globalThis.clientContext?.resources?.get("/ecs/entity", arguments[0]);
      if (!entity) return { entity: null };
      return {
        entity: {
          id: String(entity.id),
          health: entity.health ? { hp: entity.health.hp, maxHp: entity.health.maxHp } : undefined,
          position: entity.position ? { v: [...entity.position.v] } : undefined,
          death_info: Boolean(entity.death_info),
          npc_state: Boolean(entity.npc_state),
        },
      };
    `,
    [Number(id)]
  );
}

async function allocateId() {
  const response = await adminFetch("/api/admin/allocate_id");
  return response.json();
}

async function physicalTestPlayers() {
  const response = await adminFetch("/api/admin/ecs/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filter: "players", namedOnly: true }),
  });
  return response.json();
}

async function cleanupStalePhysicalTestPlayers(currentUserId) {
  const stale = (await physicalTestPlayers()).filter(
    (player) =>
      String(player.id) !== String(currentUserId) &&
      String(player.name).startsWith("PhysicalIPhoneFight-")
  );
  if (stale.length === 0) {
    return [];
  }
  await applyFixture(
    undefined,
    ...stale.map((player) => ({ kind: "delete", id: player.id }))
  );
  await waitFor(
    "stale physical iPhone player cleanup",
    physicalTestPlayers,
    (players) =>
      players.every(
        (player) =>
          String(player.id) === String(currentUserId) ||
          !String(player.name).startsWith("PhysicalIPhoneFight-")
      ),
    30_000,
    500
  );
  return stale.map((player) => ({ id: String(player.id), name: player.name }));
}

async function authenticateAndPlacePlayer() {
  const authUrl = new URL("/api/harthmere/visual_test_auth", baseUrl);
  authUrl.searchParams.set("usernameOrId", username);
  authUrl.searchParams.set("e2eAdmin", "1");
  const authResponse = await fetch(authUrl, {
    headers: { "x-harthmere-e2e-token": controlToken },
  });
  if (!authResponse.ok) {
    throw new Error(
      `visual auth failed HTTP ${authResponse.status}: ${await authResponse.text()}`
    );
  }
  const setCookieHeaders =
    authResponse.headers.getSetCookie?.() ||
    [authResponse.headers.get("set-cookie")].filter(Boolean);
  const cookies = setCookieHeaders
    .map((header) => {
      const [pair] = String(header).split(";", 1);
      const separator = pair.indexOf("=");
      return separator > 0
        ? { name: pair.slice(0, separator), value: pair.slice(separator + 1) }
        : undefined;
    })
    .filter(Boolean);
  const auth = await authResponse.json();
  const sessionId = auth.sessionId;
  assert(sessionId, "visual auth did not return a session id");
  assert.equal(auth.e2eAdmin, true, "physical test actor is not E2E admin");
  authCookieHeader = cookies
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  report.cleanedStalePhysicalPlayers = await cleanupStalePhysicalTestPlayers(
    auth.userId
  );

  const fixtureResponse = await fetch(
    new URL("/api/admin/apply_ecs_changes", baseUrl),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authCookieHeader,
      },
      body: JSON.stringify({
        z: zrpcWebSerialize([
          serializedChange({
            kind: "update",
            entity: {
              id: auth.userId,
              position: Position.create({ v: basePosition }),
              orientation: Orientation.create({ v: baseOrientation }),
              health: Health.create({ hp: 1_000, maxHp: 1_000 }),
              rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
              death_info: null,
              icing: null,
              warping_to: null,
              movement_state: MovementState.create(),
            },
          }),
        ]),
      }),
    }
  );
  if (!fixtureResponse.ok) {
    throw new Error(
      `pre-navigation fixture failed HTTP ${fixtureResponse.status}: ${await fixtureResponse.text()}`
    );
  }
  return { ...auth, sessionId, cookies };
}

async function installSessionAuth(sessionId, auth) {
  await navigate(sessionId, new URL("/privacy-policy", baseUrl).toString());
  for (const cookie of auth.cookies) {
    if (!cookie.value && cookie.name === "BCBF") {
      continue;
    }
    await webDriverRequest(sessionId, "POST", "/cookie", {
      cookie: {
        name: cookie.name,
        value: cookie.value,
        path: "/",
        httpOnly: cookie.name === "BSID" || cookie.name === "BDID",
        secure: false,
      },
    });
  }
  await execute(
    sessionId,
    `
      const value = JSON.stringify({
        userId: String(arguments[0]),
        sessionId: arguments[1],
        createdAtMs: Date.now(),
      });
      localStorage.setItem("harthmere.biomesAuth", value);
      sessionStorage.setItem("harthmere.biomesAuth", value);
      localStorage.setItem("biomes_ui_enabled", "1");
      localStorage.setItem("settings.hud.showMiniMap", "true");
      localStorage.setItem("settings.hud.showHotbar", "true");
      localStorage.setItem("settings.hud.showVitals", "true");
      sessionStorage.setItem("biomes.harthmere.partialTerrainRecoveryReloaded", "1");
      sessionStorage.setItem("biomes.world.missingShardRecoveryReloadedAt", String(Date.now()));
      return true;
    `,
    [String(auth.userId), auth.sessionId]
  );
}

async function waitForGameplay(sessionId) {
  return waitFor(
    "physical iPhone gameplay readiness",
    () =>
      execute(
        sessionId,
        `
          const context = globalThis.clientContext;
          return {
            href: location.href,
            hasContext: Boolean(context),
            frames: Number(context?.rendererController?.renderedFrames || 0),
            loading: Boolean(document.querySelector(".loading-wrapper")),
            wakeup: Boolean(document.querySelector(
              ".wake-up-container, .harthmere-wakeup-character-builder, .harthmere-wakeup-name-entry, [data-ui-id='wake_up.screen'], [data-ui-id='character_builder.screen'], [data-ui-id='enter_world.screen']"
            )),
            controls: Boolean(document.querySelector('[data-biomes-mobile-controls="true"]')),
            primary: Boolean(document.querySelector('[data-biomes-mobile-action-button="primary"]')),
          };
        `
      ),
    (state) =>
      state?.hasContext &&
      state.frames >= 30 &&
      !state.loading &&
      !state.wakeup &&
      state.controls &&
      state.primary,
    timeoutMs,
    1_000
  );
}

async function placeFrontendPlayer(sessionId, userId) {
  const updated = await execute(
    sessionId,
    `
      const userId = arguments[0];
      const position = arguments[1];
      const orientation = arguments[2];
      const resources = globalThis.clientContext?.resources;
      if (!resources) return false;
      resources.update("/tweaks", (tweaks) => {
        tweaks.syncPlayerPosition = false;
        tweaks.permitVoidMovement = false;
      });
      resources.update("/sim/player", userId, (player) => {
        player.position = [...position];
        player.orientation = [...orientation];
        player.velocity = [0, 0, 0];
      });
      resources.update("/scene/local_player", (localPlayer) => {
        localPlayer.player.position = [...position];
        localPlayer.player.orientation = [...orientation];
        localPlayer.player.velocity = [0, 0, 0];
        localPlayer.playerStatus = "alive";
      });
      resources.set("/game_modal", { kind: "empty" });
      return true;
    `,
    [Number(userId), basePosition, baseOrientation]
  );
  assert.equal(updated, true, "physical player resources were unavailable");
}

async function prepareCombatFixture(sessionId, userId) {
  const seed = harthmereGroundedMuckMonsterSeedsInTerritory().find(
    (candidate) => candidate.areaId !== "road_muckwad_patch"
  );
  assert(seed, "no native combat NPC seed is available");
  const profile = harthmereNativeNpcCombatProfileForSeed(seed);
  const swordId = harthmereNativeBiomesIdForItemId("iron_longsword");
  assert(swordId, "iron longsword native id is missing");

  const current = await authoritativeEntity(sessionId, userId);
  assert(current.entity?.inventory, "physical player has no native inventory");
  const inventory = Inventory.clone(current.entity.inventory);
  inventory.hotbar[0] = countOf(swordId, 1n);
  inventory.selected = { kind: "hotbar", idx: 0 };
  const triggerState = TriggerState.clone(current.entity.trigger_state);
  writeHarthmereNativeCombatProgression(triggerState, {
    level: Math.max(20, profile.level),
    migrationVersion: 1,
    lastAttackMs: 0,
    comboHits: 0,
    comboExpiresAtMs: 0,
    comboCooldownUntilMs: 0,
  });
  await applyFixture(sessionId, {
    kind: "update",
    entity: {
      id: userId,
      position: Position.create({ v: basePosition }),
      orientation: Orientation.create({ v: baseOrientation }),
      inventory,
      selected_item: SelectedItem.create({ item: inventory.hotbar[0] }),
      trigger_state: triggerState,
      health: Health.create({ hp: 100_000, maxHp: 100_000 }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      death_info: null,
      warping_to: null,
      movement_state: MovementState.create(),
    },
  });
  await placeFrontendPlayer(sessionId, userId);
  await execute(
    sessionId,
    `globalThis.clientContext?.resources?.set("/hotbar/index", { value: 0 }); return true;`
  );

  const hp = 1_000_000;
  const offsets = [
    [2, 0],
    [3.25, 2],
    [3.25, -2],
    [5, 1.5],
    [5, -1.5],
    [6.25, 3],
    [6.25, -3],
    [7, 0],
  ];
  const targetIds = [];
  const targetPositions = [];
  const creates = [];
  for (let index = 0; index < enemyCount; index += 1) {
    const targetId = await allocateId();
    const [offsetX, offsetZ] = offsets[index];
    const targetPosition = [
      basePosition[0] + offsetX,
      basePosition[1],
      basePosition[2] + offsetZ,
    ];
    targetIds.push(targetId);
    report.pendingFixtureIds = targetIds.map(String);
    persist();
    targetPositions.push(targetPosition);
    creates.push({
      kind: "create",
      entity: {
        id: targetId,
        position: Position.create({ v: targetPosition }),
        orientation: Orientation.create({ v: [0, 0] }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        size: Size.create({ v: [1, 2, 1] }),
        health: Health.create({ hp, maxHp: hp }),
        collideable: Collideable.create(),
        label: Label.create({
          text: `Physical iPhone Fight Fixture ${index + 1}`,
        }),
        npc_state: NpcState.create(),
        npc_metadata: NpcMetadata.create({
          type_id: profile.id,
          created_time: secondsSinceEpoch(),
          spawn_position: targetPosition,
          spawn_orientation: [0, 0],
        }),
      },
    });
  }
  await applyFixture(sessionId, ...creates);
  await waitFor(
    "physical multi-enemy fight fixture synchronization",
    async () => ({
      player: await localEntity(sessionId, userId),
      targets: await Promise.all(
        targetIds.map((targetId) => localEntity(sessionId, targetId))
      ),
      selected: await execute(
        sessionId,
        `
          const local = globalThis.clientContext?.resources?.get("/scene/local_player");
          const entity = local ? globalThis.clientContext?.resources?.get("/ecs/entity", local.id) : undefined;
          return entity?.selected_item?.item?.item?.id === undefined
            ? undefined
            : String(entity.selected_item.item.item.id);
        `
      ),
    }),
    (state) =>
      Number(state?.player?.entity?.health?.hp || 0) > 0 &&
      state?.targets?.every(
        (target) => Number(target?.entity?.health?.hp || 0) === hp
      ) &&
      String(state?.selected) === String(swordId),
    30_000,
    250
  );
  return {
    targetId: targetIds[0],
    targetIds,
    targetPositions,
    hp,
    profileId: profile.id,
    swordId,
  };
}

async function installTouchProbe(sessionId) {
  return execute(
    sessionId,
    `
      globalThis.__physicalIPhoneTouchEvents = [];
      for (const type of ["pointerdown", "pointerup", "pointercancel", "touchstart", "touchend", "click"]) {
        document.addEventListener(type, (event) => {
          const target = event.target?.closest?.("[data-biomes-mobile-action-button], [aria-label='Movement joystick']");
          if (!target) return;
          globalThis.__physicalIPhoneTouchEvents.push({
            type,
            trusted: event.isTrusted,
            pointerType: event.pointerType,
            pointerId: event.pointerId,
            defaultPrevented: event.defaultPrevented,
            target: target.getAttribute("data-biomes-mobile-action-button") || target.getAttribute("aria-label"),
            at: performance.now(),
          });
        }, true);
      }
      return true;
    `
  );
}

async function rectFor(sessionId, selector) {
  const rect = await execute(
    sessionId,
    `
      const element = document.querySelector(arguments[0]);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        right: rect.right, bottom: rect.bottom,
        display: style.display, visibility: style.visibility,
        disabled: Boolean(element.disabled),
      };
    `,
    [selector]
  );
  assert(
    rect && rect.width >= 40 && rect.height >= 40,
    `${selector} is not touch-safe: ${JSON.stringify(rect)}`
  );
  assert.equal(rect.disabled, false, `${selector} is disabled`);
  return rect;
}

async function touchTap(
  sessionId,
  selector,
  durationMs = 120,
  pointerId = "fight-finger"
) {
  const rect = await rectFor(sessionId, selector);
  const x = Math.round(rect.x + rect.width / 2);
  const y = Math.round(rect.y + rect.height / 2);
  await webDriverRequest(sessionId, "POST", "/actions", {
    actions: [
      {
        type: "pointer",
        id: pointerId,
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, origin: "viewport", x, y },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: durationMs },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
  await webDriverRequest(sessionId, "DELETE", "/actions").catch(
    () => undefined
  );
  return { x, y, durationMs, rect };
}

async function touchJoystick(sessionId, pointerId = "move-finger") {
  const selector =
    '[aria-label="Movement joystick"] [data-testid="joystick-base"] button';
  const rect = await rectFor(sessionId, selector);
  const startX = Math.round(rect.x + rect.width / 2);
  const startY = Math.round(rect.y + rect.height / 2);
  const endX = Math.round(startX + Math.min(38, rect.width * 0.42));
  const endY = startY;
  await webDriverRequest(sessionId, "POST", "/actions", {
    actions: [
      {
        type: "pointer",
        id: pointerId,
        parameters: { pointerType: "touch" },
        actions: [
          {
            type: "pointerMove",
            duration: 0,
            origin: "viewport",
            x: startX,
            y: startY,
          },
          { type: "pointerDown", button: 0 },
          {
            type: "pointerMove",
            duration: 160,
            origin: "viewport",
            x: endX,
            y: endY,
          },
          { type: "pause", duration: 350 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
  await webDriverRequest(sessionId, "DELETE", "/actions").catch(
    () => undefined
  );
  return { startX, startY, endX, endY, rect };
}

async function runtimeSnapshot(sessionId) {
  return execute(
    sessionId,
    `
      const context = globalThis.clientContext;
      const dynamic = context?.resources?.get("/settings/graphics/dynamic");
      const resolved = context?.resources?.get("/settings/graphics/resolved");
      const info = context?.rendererController?.passRenderer?.renderer?.info ||
        context?.rendererController?.passRenderer?.three?.info;
      const profiler = context?.rendererController?.profiler?.();
      const renderIntervalMs = profiler?.renderInterval?.().getPercentile?.(0.5);
      const cpuRenderMs = profiler?.cpuRenderTime?.().getPercentile?.(0.5);
      const gpuRenderMs = profiler?.gpuRenderTime?.()?.getPercentile?.(0.1);
      const local = context?.resources?.get("/scene/local_player");
      const entity = local ? context?.resources?.get("/ecs/entity", local.id) : undefined;
      return {
        href: location.href,
        documentState: {
          visibilityState: document.visibilityState,
          hidden: document.hidden,
          hasFocus: document.hasFocus(),
          webdriver: navigator.webdriver,
          standalone: navigator.standalone,
        },
        nextBuildId: globalThis.__NEXT_DATA__?.buildId,
        serverBuildId: context?.io?.serverBuildId,
        viewport: {
          innerWidth, innerHeight, dpr: devicePixelRatio,
          screenWidth: screen.width, screenHeight: screen.height,
          orientation: screen.orientation?.type,
        },
        frames: Number(context?.rendererController?.renderedFrames || 0),
        mobileDevice: context?.clientConfig?.mobileDevice,
        lowMemory: context?.clientConfig?.lowMemory,
        voxelooMemoryMb: context?.clientConfig?.voxelooMemoryMb,
        resourceCapacityScale: context?.clientConfig?.resourceCapacityScale,
        graphics: dynamic,
        resolvedGraphics: resolved,
        rendererPixelRatio: context?.rendererController?.passRenderer?.pixelRatio?.(),
        rendererInfo: info ? JSON.parse(JSON.stringify(info)) : undefined,
        profiler: {
          renderIntervalMs,
          fps: renderIntervalMs ? 1000 / renderIntervalMs : undefined,
          cpuRenderMs,
          gpuRenderMs,
        },
        canvases: Array.from(document.querySelectorAll("canvas")).map((canvas) => ({
          className: canvas.className,
          width: canvas.width,
          height: canvas.height,
          connected: canvas.isConnected,
          rect: (() => {
            const rect = canvas.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          })(),
        })),
        mobileRuntimeStreaming: globalThis.__harthmereMobileRuntimeStreaming
          ? JSON.parse(JSON.stringify(globalThis.__harthmereMobileRuntimeStreaming))
          : undefined,
        mobileOverlayPerformanceHotfix:
          globalThis.__harthmereMobileOverlayPerformanceHotfix
            ? JSON.parse(JSON.stringify(globalThis.__harthmereMobileOverlayPerformanceHotfix))
            : undefined,
        localPlayerId: local?.id === undefined ? undefined : String(local.id),
        localPlayerPosition: local?.player?.position ? [...local.player.position] : undefined,
        selectedItemId: entity?.selected_item?.item?.item?.id === undefined
          ? undefined
          : String(entity.selected_item.item.item.id),
        attackInfo: local?.attackInfo ? JSON.parse(JSON.stringify(local.attackInfo)) : undefined,
        actionButtons: Array.from(document.querySelectorAll("[data-biomes-mobile-action-button]")).map((element) => ({
          kind: element.getAttribute("data-biomes-mobile-action-button"),
          title: element.getAttribute("title"),
          aria: element.getAttribute("aria-label"),
          disabled: Boolean(element.disabled),
          rect: (() => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          })(),
        })),
        sound: globalThis.__harthmereSoundEffectDebug
          ? JSON.parse(JSON.stringify(globalThis.__harthmereSoundEffectDebug))
          : undefined,
        touchEvents: (globalThis.__physicalIPhoneTouchEvents || []).slice(-80),
      };
    `
  );
}

async function previewLifecycleSnapshot(sessionId, applyCleanup = false) {
  return execute(
    sessionId,
    `
      const applyCleanup = arguments[0] === true;
      const instances = [];
      const seen = new Set();
      for (const wrapper of document.querySelectorAll(".three-object-preview-wrapper")) {
        const fiberKey = Object.keys(wrapper).find((key) => key.startsWith("__reactFiber$"));
        let fiber = fiberKey ? wrapper[fiberKey] : undefined;
        let instance;
        while (fiber) {
          const candidate = fiber.stateNode;
          if (
            candidate &&
            typeof candidate.shutdownRenderer === "function" &&
            typeof candidate.hasVisibleLayout === "function"
          ) {
            instance = candidate;
            break;
          }
          fiber = fiber.return;
        }
        if (!instance || seen.has(instance)) continue;
        seen.add(instance);
        const rect = wrapper.getBoundingClientRect();
        const visibleLayout = instance.hasVisibleLayout();
        const hadRenderer = Boolean(instance.passRenderer);
        if (
          applyCleanup &&
          globalThis.clientContext?.clientConfig?.mobileDevice === true &&
          hadRenderer &&
          !visibleLayout
        ) {
          if (instance.animationFrameId !== undefined) {
            cancelAnimationFrame(instance.animationFrameId);
            instance.animationFrameId = undefined;
          }
          if (instance.inactiveFrameTimer !== undefined) {
            clearTimeout(instance.inactiveFrameTimer);
            instance.inactiveFrameTimer = undefined;
          }
          instance.intersecting = false;
          instance.shutdownRenderer();
          instance.startRenderLoop();
        }
        instances.push({
          visibleLayout,
          intersecting: instance.intersecting,
          hadRenderer,
          hasRenderer: Boolean(instance.passRenderer),
          hasAnimationFrame: instance.animationFrameId !== undefined,
          hasInactiveTimer: instance.inactiveFrameTimer !== undefined,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }
      return instances;
    `,
    [applyCleanup]
  );
}

async function startPerformanceMeasures(sessionId) {
  return execute(
    sessionId,
    `
      globalThis.enablePerformanceApi = true;
      performance.clearMeasures();
      return true;
    `
  );
}

async function collectPerformanceMeasures(sessionId) {
  return execute(
    sessionId,
    `
      const groups = new Map();
      for (const entry of performance.getEntriesByType("measure")) {
        const values = groups.get(entry.name) || [];
        values.push(entry.duration);
        groups.set(entry.name, values);
      }
      const percentile = (values, fraction) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] || 0;
      };
      const rows = [...groups].map(([name, values]) => ({
        name,
        count: values.length,
        totalMs: values.reduce((sum, value) => sum + value, 0),
        averageMs: values.reduce((sum, value) => sum + value, 0) / values.length,
        p50Ms: percentile(values, 0.5),
        p95Ms: percentile(values, 0.95),
        maxMs: Math.max(...values),
      }));
      return {
        byTotal: [...rows].sort((a, b) => b.totalMs - a.totalMs).slice(0, 30),
        byP95: [...rows].sort((a, b) => b.p95Ms - a.p95Ms).slice(0, 30),
      };
    `
  );
}

async function sampleRenderedFrames(sessionId, durationMs) {
  return executeAsync(
    sessionId,
    `
      const durationMs = arguments[0];
      const done = arguments[arguments.length - 1];
      const context = globalThis.clientContext;
      const startFrames = Number(context?.rendererController?.renderedFrames || 0);
      const start = performance.now();
      let rafFrames = 0;
      let worstRafGapMs = 0;
      let lastRaf = start;
      let stopped = false;
      const tick = (now) => {
        if (stopped) return;
        rafFrames += 1;
        worstRafGapMs = Math.max(worstRafGapMs, now - lastRaf);
        lastRaf = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setTimeout(() => {
        stopped = true;
        const end = performance.now();
        const endFrames = Number(context?.rendererController?.renderedFrames || 0);
        done({
          elapsedMs: end - start,
          renderedFrames: endFrames - startFrames,
          renderedFps: ((endFrames - startFrames) * 1000) / (end - start),
          rafFrames,
          rafFps: (rafFrames * 1000) / (end - start),
          worstRafGapMs,
        });
      }, durationMs);
    `,
    [durationMs],
    durationMs + 30_000
  );
}

async function runCombatSample(sessionId, targetId, durationMs) {
  const before = await authoritativeEntity(sessionId, targetId);
  const samples = [];
  const framePromise = sampleRenderedFrames(sessionId, durationMs);
  const deadline = Date.now() + durationMs - 1_000;
  let attack = 0;
  while (Date.now() < deadline) {
    attack += 1;
    samples.push(
      await touchTap(
        sessionId,
        '[data-biomes-mobile-action-button="primary"]',
        attack % 5 === 0 ? 650 : 120,
        `fight-finger-${attack}`
      )
    );
    if (attack % 4 === 0) {
      await touchJoystick(sessionId, `move-finger-${attack}`).catch((error) => {
        report.errors.push(`joystick:${error?.message || error}`);
      });
      await placeFrontendPlayer(sessionId, Number(report.auth.userId));
    }
    await sleep(850);
  }
  const frames = await framePromise;
  const after = await authoritativeEntity(sessionId, targetId);
  return {
    frames,
    attacksAttempted: attack,
    hpBefore: Number(before.entity?.health?.hp),
    hpAfter: Number(after.entity?.health?.hp),
    acceptedDamage:
      Number(before.entity?.health?.hp) - Number(after.entity?.health?.hp),
    touchSamples: samples,
  };
}

async function deleteFixture(sessionId, id) {
  if (!id) return;
  await applyFixture(sessionId, { kind: "delete", id }).catch(() => undefined);
}

async function main() {
  assert(controlToken, "HARTHMERE_E2E_CONTROL_TOKEN is required");
  fs.mkdirSync(artifactsDir, { recursive: true });
  const auth = await authenticateAndPlacePlayer();
  report.auth = { userId: String(auth.userId), e2eAdmin: auth.e2eAdmin };
  persist();

  const sessionId = existingSessionId || (await createSession());
  const ownsSession = !existingSessionId;
  report.webDriverSessionId = sessionId;
  await webDriverRequest(sessionId, "POST", "/timeouts", {
    script: timeoutMs,
    pageLoad: timeoutMs,
    implicit: 0,
  });

  let targetId;
  let fixtureIds = [];
  try {
    await installSessionAuth(sessionId, auth);
    const gameUrl = new URL("/at", baseUrl);
    gameUrl.searchParams.set("syncBaseUrl", syncBaseUrl);
    gameUrl.searchParams.set("glitch_auto_play", "1");
    gameUrl.searchParams.set("e2e_run", runId);
    await navigate(sessionId, gameUrl.toString());
    report.initialReadiness = await waitForGameplay(sessionId);
    if (clientHotfixScriptPath) {
      await execute(sessionId, fs.readFileSync(clientHotfixScriptPath, "utf8"));
      report.clientHotfix = await waitFor(
        "mobile client hotfix application",
        () =>
          execute(
            sessionId,
            `return globalThis.__harthmereMobileOverlayPerformanceHotfix || null;`
          ),
        Boolean,
        10_000,
        250
      );
      persist();
    }
    await installTouchProbe(sessionId);
    await placeFrontendPlayer(sessionId, auth.userId);
    const fixture = await prepareCombatFixture(sessionId, auth.userId);
    targetId = fixture.targetId;
    fixtureIds = fixture.targetIds;
    report.fixture = {
      ...fixture,
      targetId: String(fixture.targetId),
      targetIds: fixture.targetIds.map(String),
    };
    report.before = await runtimeSnapshot(sessionId);
    if (report.expectedBuildId) {
      assert.equal(
        report.before.nextBuildId,
        report.expectedBuildId,
        "physical Safari loaded an unexpected Next build"
      );
    }
    report.beforeScreenshot = await screenshot(sessionId, "01-before-combat");
    persist();

    if (warmupMs > 0) {
      await sleep(warmupMs);
      report.warmup = {
        durationMs: warmupMs,
        snapshot: await runtimeSnapshot(sessionId),
      };
      persist();
    }

    await startPerformanceMeasures(sessionId);
    const idle = await sampleRenderedFrames(sessionId, idleSampleMs);
    report.phases.push({
      name: "idle",
      ...idle,
      performanceMeasures: await collectPerformanceMeasures(sessionId),
      snapshot: await runtimeSnapshot(sessionId),
    });
    console.log(
      `IOS_FIGHT_PHASE idle fps=${idle.renderedFps.toFixed(2)} frames=${idle.renderedFrames}`
    );
    persist();

    report.previewLifecycleBefore = await previewLifecycleSnapshot(sessionId);
    if (previewCleanupAb) {
      report.previewLifecycleApplied = await previewLifecycleSnapshot(
        sessionId,
        true
      );
      await sleep(1_000);
      const previewAb = await sampleRenderedFrames(sessionId, idleSampleMs);
      report.phases.push({
        name: "mobile-preview-cleanup-ab",
        ...previewAb,
        previewLifecycle: await previewLifecycleSnapshot(sessionId),
        snapshot: await runtimeSnapshot(sessionId),
      });
      console.log(
        `IOS_FIGHT_PHASE mobile-preview-cleanup-ab fps=${previewAb.renderedFps.toFixed(2)} frames=${previewAb.renderedFrames}`
      );
      persist();
    }

    await startPerformanceMeasures(sessionId);
    const combat = await runCombatSample(sessionId, targetId, combatSampleMs);
    report.phases.push({
      name: "combat",
      ...combat,
      performanceMeasures: await collectPerformanceMeasures(sessionId),
      snapshot: await runtimeSnapshot(sessionId),
    });
    console.log(
      `IOS_FIGHT_PHASE combat fps=${combat.frames.renderedFps.toFixed(2)} damage=${combat.acceptedDamage} attacks=${combat.attacksAttempted}`
    );
    assert(
      combat.acceptedDamage > 0,
      "trusted mobile primary actions caused no authoritative damage"
    );
    if (!observeOnly) {
      assert(
        combat.frames.renderedFps >= minimumCombatFps,
        `physical iPhone combat rendered FPS is below ${minimumCombatFps}: ${combat.frames.renderedFps}`
      );
    }
    report.combatScreenshot = await screenshot(sessionId, "02-combat");
    persist();

    if (soakMs > 0) {
      const soakStarted = Date.now();
      let soakWindow = 0;
      let totalDamage = 0;
      while (Date.now() - soakStarted < soakMs) {
        soakWindow += 1;
        const remaining = soakMs - (Date.now() - soakStarted);
        const windowMs = Math.min(30_000, Math.max(5_000, remaining));
        const sample = await runCombatSample(sessionId, targetId, windowMs);
        totalDamage += sample.acceptedDamage;
        report.phases.push({
          name: `soak-${soakWindow}`,
          elapsedMs: Date.now() - soakStarted,
          ...sample,
          snapshot: await runtimeSnapshot(sessionId),
        });
        console.log(
          `IOS_FIGHT_SOAK window=${soakWindow} elapsed=${Math.round(
            (Date.now() - soakStarted) / 1000
          )}s fps=${sample.frames.renderedFps.toFixed(2)} damage=${sample.acceptedDamage}`
        );
        persist();
        assert(
          sample.acceptedDamage > 0,
          `soak window ${soakWindow} stopped applying authoritative damage`
        );
        assert(
          sample.frames.renderedFps >= minimumSoakFps,
          `soak window ${soakWindow} dropped below ${minimumSoakFps} rendered FPS: ${sample.frames.renderedFps}`
        );
      }
      report.soak = {
        durationMs: Date.now() - soakStarted,
        windows: soakWindow,
        acceptedDamage: totalDamage,
      };
    }

    report.after = await runtimeSnapshot(sessionId);
    report.touchEvents = report.after.touchEvents || [];
    report.afterScreenshot = await screenshot(sessionId, "03-after-soak");
    const trustedPrimaryDown = report.touchEvents.some(
      (event) =>
        event.target === "primary" &&
        event.type === "pointerdown" &&
        event.trusted === true &&
        event.pointerType === "touch"
    );
    assert(
      trustedPrimaryDown,
      "SafariDriver returned success without a trusted primary touch"
    );
    report.status = "pass";
  } catch (error) {
    report.status = "fail";
    report.errors.push(error?.stack || error?.message || String(error));
    report.failureSnapshot = await runtimeSnapshot(sessionId).catch(
      () => undefined
    );
    report.failureScreenshot = await screenshot(sessionId, "99-failure").catch(
      () => undefined
    );
    throw error;
  } finally {
    const cleanupIds = new Set([
      ...fixtureIds.map(String),
      ...(report.pendingFixtureIds || []),
    ]);
    for (const fixtureId of cleanupIds) {
      await deleteFixture(sessionId, fixtureId).catch(() => undefined);
    }
    report.pendingFixtureIds = [];
    report.finishedAt = new Date().toISOString();
    persist();
    if (ownsSession && !keepSession) {
      await webDriverRequest(sessionId, "DELETE", "").catch(() => undefined);
    }
  }

  console.log(`IOS_FIGHT_RESULT ${report.status}`);
  console.log(`REPORT ${reportPath}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
