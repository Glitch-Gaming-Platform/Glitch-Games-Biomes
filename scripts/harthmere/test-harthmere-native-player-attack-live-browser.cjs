#!/usr/bin/env node
"use strict";

/*
 * Real rendered-input -> native ECS combat acceptance.
 *
 * Admin APIs are used only to create deterministic fixtures and read the
 * authoritative result. Every attack originates from Playwright mouse or
 * keyboard input delivered to the rendered game. In particular, this runner
 * never publishes UpdateNpcHealthEvent itself.
 */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const {
  Collideable,
  Health,
  Inventory,
  Label,
  NpcMetadata,
  NpcState,
  Orientation,
  Position,
  Protection,
  RigidBody,
  SelectedItem,
  Size,
  TriggerState,
} = require("../../src/shared/ecs/gen/components");
const {
  EntitySerde,
  SerializeForServer,
} = require("../../src/shared/ecs/gen/json_serde");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
const { countOf } = require("../../src/shared/game/items");
const {
  harthmereNativeBiomesIdForItemId,
} = require("../../src/shared/harthmere/harthmere_native_item_ids");
const {
  harthmereGroundedMuckMonsterSeedsInTerritory,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  harthmereNativeNpcCombatProfileForSeed,
  writeHarthmereNativeCombatProgression,
} = require("../../src/shared/harthmere/harthmere_native_combat");
const { secondsSinceEpoch } = require("../../src/shared/ecs/config");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const baseUrl = process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3017";
const syncBaseUrl =
  process.env.HARTHMERE_E2E_SYNC_BASE_URL || "http://127.0.0.1:4907";
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120_000);
const runId =
  process.env.HARTHMERE_E2E_RUN_ID ||
  `native-player-attack-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
const username =
  process.env.HARTHMERE_E2E_USERNAME || `NativePlayerAttack-${Date.now()}`;
const artifactsDir = path.resolve(
  process.env.HARTHMERE_E2E_ARTIFACTS_DIR ||
    path.join(root, "artifacts/harthmere-native-player-attack", runId)
);
const reportPath = path.join(artifactsDir, "report.json");
const basePosition = [895, 62, -197];
const baseOrientation = [0, -Math.PI / 2]; // Positive X.
const scenarioCooldownMs = Number(
  process.env.HARTHMERE_E2E_ATTACK_SCENARIO_COOLDOWN_MS || 2_000
);
const selectedScenarioNames = process.env.HARTHMERE_E2E_ATTACK_SCENARIOS
  ? new Set(
      process.env.HARTHMERE_E2E_ATTACK_SCENARIOS.split("|")
        .map((name) => name.trim())
        .filter(Boolean)
    )
  : undefined;
const skipProjectileCatalog =
  process.env.HARTHMERE_E2E_ATTACK_SKIP_PROJECTILE_CATALOG === "1";
const skipPerformance =
  process.env.HARTHMERE_E2E_ATTACK_SKIP_PERFORMANCE === "1";
const preflightCleanupIds = (
  process.env.HARTHMERE_E2E_ATTACK_PREFLIGHT_CLEANUP_IDS || ""
)
  .split(",")
  .map((id) => Number(id.trim()))
  .filter((id) => Number.isSafeInteger(id) && id > 0);
let prepareScenario = async () => {};

const report = {
  runId,
  username,
  baseUrl,
  syncBaseUrl,
  buildId: fs.readFileSync(path.join(root, ".next/BUILD_ID"), "utf8").trim(),
  startedAt: new Date().toISOString(),
  browser: {
    console: [],
    failures: [],
    transients: [],
    pointerLockWarnings: [],
  },
  environment: {},
  performance: {},
  scenarios: [],
  projectileCatalog: [],
};

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

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function serializedChange(change) {
  return ChangeSerde.serializeProposed(SerializeForServer, change);
}

function deserializeEntity(serialized) {
  return serialized ? EntitySerde.deserialize(serialized, false) : undefined;
}

async function bridgeCall(page, method, ...args) {
  return page.evaluate(
    async ({ method, args }) => {
      const bridge = globalThis.__harthmereNativeEcsE2E;
      if (!bridge) throw new Error("Native ECS E2E bridge is not installed");
      const fn = bridge[method];
      if (typeof fn !== "function") {
        throw new Error(`Unknown Native ECS E2E bridge method: ${method}`);
      }
      return fn(...args);
    },
    { method, args }
  );
}

async function applyFixture(page, ...changes) {
  await bridgeCall(page, "applyChanges", changes.map(serializedChange));
}

async function authoritativeEntity(page, id) {
  const rows = await bridgeCall(page, "getAuthoritative", [id]);
  const [version, serialized] = rows[0] || [];
  return { version, entity: deserializeEntity(serialized) };
}

async function localEntity(page, id) {
  const [version, serialized] = await bridgeCall(page, "getLocal", id);
  return { version, entity: deserializeEntity(serialized) };
}

async function waitFor(
  label,
  probe,
  predicate,
  waitMs = timeoutMs,
  intervalMs = 75
) {
  const deadline = Date.now() + waitMs;
  let last;
  let lastError;
  while (Date.now() < deadline) {
    try {
      last = await probe();
      if (predicate(last)) return last;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `${label} timed out after ${waitMs}ms; last=${JSON.stringify(
      last,
      (_key, value) => (typeof value === "bigint" ? `${value}n` : value)
    )}; error=${lastError?.stack || lastError || "none"}`
  );
}

async function screenshot(page, name) {
  const file = path.join(artifactsDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

function safeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function waitForStableGameplay(page) {
  await page.waitForFunction(
    () =>
      globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1" &&
      Boolean(globalThis.clientContext),
    undefined,
    { timeout: timeoutMs }
  );
  await page.waitForFunction(
    () => {
      const key = "__nativeAttackLoadingClearSince";
      if (document.querySelector(".loading-wrapper")) {
        delete globalThis[key];
        return false;
      }
      globalThis[key] ??= Date.now();
      return Date.now() - globalThis[key] >= 1_000;
    },
    undefined,
    { timeout: timeoutMs }
  );
  const enter = page.getByRole("button", { name: "Enter Game", exact: true });
  if (
    (await enter.count()) === 1 &&
    (await enter.isVisible().catch(() => false))
  ) {
    await enter.click({ timeout: 20_000 });
    await enter
      .waitFor({ state: "hidden", timeout: 20_000 })
      .catch(() => undefined);
  }
  const canvas = page.locator("canvas.biomes-canvas").first();
  await canvas.waitFor({ state: "visible", timeout: timeoutMs });
  await canvas.focus();
  await page.waitForFunction(
    () =>
      Number(
        globalThis.clientContext?.rendererController?.renderedFrames ?? 0
      ) >= 30,
    undefined,
    { timeout: timeoutMs }
  );
}

async function placeFrontendPlayer(
  page,
  userId,
  position,
  orientation = baseOrientation
) {
  const updated = await page.evaluate(
    ({ userId, position, orientation }) => {
      const resources = globalThis.clientContext?.resources;
      if (!resources) return false;
      resources.update("/sim/player", userId, (player) => {
        player.position = [...position];
        player.orientation = [...orientation];
        player.velocity = [0, 0, 0];
      });
      resources.update("/scene/local_player", (localPlayer) => {
        localPlayer.player.position = [...position];
        localPlayer.player.orientation = [...orientation];
        localPlayer.player.velocity = [0, 0, 0];
      });
      return true;
    },
    { userId, position, orientation }
  );
  assert.equal(updated, true, "browser simulation player was unavailable");
}

async function interactionSnapshot(page) {
  return page.evaluate(() => {
    const context = globalThis.clientContext;
    const cursor = context?.resources?.get("/scene/cursor");
    const localPlayer = context?.resources?.get("/scene/local_player");
    const playerEntity = localPlayer
      ? context?.resources?.get("/ecs/entity", localPlayer.id)
      : undefined;
    const selected = playerEntity?.selected_item?.item?.item;
    const canvas = document.querySelector("canvas.biomes-canvas");
    const rect = canvas?.getBoundingClientRect();
    const crosshair = document.querySelector(".crosshair");
    return {
      attackableIds: (cursor?.attackableEntities || []).map((entity) =>
        String(entity.id)
      ),
      hit:
        cursor?.hit?.kind === "entity"
          ? {
              kind: "entity",
              id: String(cursor.hit.entity?.id),
              label: cursor.hit.entity?.label?.text,
              distance: cursor.hit.distance,
            }
          : cursor?.hit
            ? { kind: cursor.hit.kind, distance: cursor.hit.distance }
            : undefined,
      attackInfo: localPlayer?.attackInfo
        ? {
            start: localPlayer.attackInfo.start,
            duration: localPlayer.attackInfo.duration,
            movementScale: localPlayer.attackInfo.movementScale,
          }
        : undefined,
      selectedItemId:
        selected?.id === undefined ? undefined : String(selected.id),
      playerPosition: localPlayer?.player?.position
        ? [...localPlayer.player.position]
        : undefined,
      playerOrientation: localPlayer?.player?.orientation
        ? [...localPlayer.player.orientation]
        : undefined,
      pointerLocked: Boolean(document.pointerLockElement),
      crosshairClass: crosshair?.className,
      canvas: rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined,
      projectileRuntime: globalThis.__harthmereProjectileVisuals
        ? JSON.parse(JSON.stringify(globalThis.__harthmereProjectileVisuals))
        : undefined,
      magicChargeLog: (globalThis.__harthmereMagicChargeLog || []).slice(0, 12),
    };
  });
}

async function waitForLocalPose(page, userId, position, tolerance = 1) {
  return waitFor(
    "local player pose",
    async () => {
      const [local, visual] = await Promise.all([
        localEntity(page, userId),
        page.evaluate((id) => {
          const player = globalThis.clientContext?.resources?.get(
            "/sim/player",
            id
          );
          return player?.position ? [...player.position] : undefined;
        }, userId),
      ]);
      return { local, visual };
    },
    ({ local, visual }) => {
      const authoritativeLocal = local.entity?.position?.v;
      const close = (candidate) =>
        Array.isArray(candidate) &&
        candidate.length >= 3 &&
        Math.hypot(
          Number(candidate[0]) - position[0],
          Number(candidate[1]) - position[1],
          Number(candidate[2]) - position[2]
        ) <= tolerance;
      return (
        close(authoritativeLocal) &&
        close(visual) &&
        Number(local.entity?.health?.hp ?? 0) > 0 &&
        !local.entity?.death_info
      );
    },
    25_000
  );
}

async function holdDeterministicPlayerFixture(page) {
  const updated = await page.evaluate(() => {
    const resources = globalThis.clientContext?.resources;
    if (!resources) return false;
    resources.update("/tweaks", (tweaks) => {
      // This is the same focused-E2E setup used by the native round-trip
      // harness: the rendered browser actor remains authoritative for camera
      // and input, while its ordinary movement publisher cannot overwrite a
      // deterministic combat fixture between setup and the click.
      tweaks.syncPlayerPosition = false;
      // Never advance physics through unloaded terrain. The production player
      // controller intentionally freezes until all nearby shards are present;
      // bypassing that guard made a correctly positioned browser actor fall to
      // the world floor and die before the first real-input attack row.
      tweaks.permitVoidMovement = false;
    });
    return true;
  });
  assert.equal(updated, true, "client tweaks were unavailable");
}

async function selectWeapon(page, userId, itemIds, selectedIndex = 0) {
  const current = await authoritativeEntity(page, userId);
  assert(current.entity?.inventory, "browser actor has no native inventory");
  const inventory = Inventory.clone(current.entity.inventory);
  for (let index = 0; index < itemIds.length; index += 1) {
    const itemId = itemIds[index];
    inventory.hotbar[index] = itemId ? countOf(itemId, 1n) : undefined;
  }
  inventory.selected = { kind: "hotbar", idx: selectedIndex };
  const selectedStack = inventory.hotbar[selectedIndex];
  await applyFixture(page, {
    kind: "update",
    entity: {
      id: userId,
      inventory,
      selected_item: SelectedItem.create({ item: selectedStack }),
    },
  });
  await waitFor(
    `selected weapon ${selectedStack?.item?.id}`,
    () => localEntity(page, userId),
    ({ entity }) =>
      String(entity?.selected_item?.item?.item?.id) ===
      String(selectedStack?.item?.id),
    20_000
  );
  return selectedStack?.item?.id;
}

async function setTargetPosition(page, id, position) {
  await applyFixture(page, {
    kind: "update",
    entity: { id, position: Position.create({ v: position }) },
  });
  await waitFor(
    `target ${id} local position`,
    () => localEntity(page, id),
    ({ entity }) => {
      const current = entity?.position?.v;
      return (
        Array.isArray(current) &&
        Math.hypot(
          current[0] - position[0],
          current[1] - position[1],
          current[2] - position[2]
        ) < 0.2
      );
    },
    2_500,
    25
  );
}

async function createNpc(page, profile, options = {}) {
  const id = await bridgeCall(page, "allocateId");
  const position = options.position || [
    basePosition[0] + 2,
    basePosition[1],
    basePosition[2],
  ];
  const hp = options.hp ?? Math.max(500, profile.maxHp);
  const entity = {
    id,
    position: Position.create({ v: position }),
    orientation: Orientation.create({ v: [0, 0] }),
    rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
    size: Size.create({ v: options.size || [1, 2, 1] }),
    health: Health.create({ hp, maxHp: hp }),
    collideable: Collideable.create(),
    label: Label.create({
      text: options.label || `Rendered Attack Fixture ${id}`,
    }),
  };
  if (!options.withoutNpcMetadata) {
    entity.npc_state = NpcState.create();
    entity.npc_metadata = NpcMetadata.create({
      type_id: profile.id,
      created_time: secondsSinceEpoch(),
      spawn_position: position,
      spawn_orientation: [0, 0],
    });
  }
  if (options.protected) {
    entity.protection = Protection.create({ timestamp: secondsSinceEpoch() });
  }
  await applyFixture(page, { kind: "create", entity });
  await waitFor(
    `fixture ${id} synchronized`,
    () => localEntity(page, id),
    ({ entity: local }) => Number(local?.health?.hp) === hp,
    25_000
  );
  return { id, hp, position, label: entity.label.text };
}

async function createBlocker(page, position) {
  const id = await bridgeCall(page, "allocateId");
  await applyFixture(page, {
    kind: "create",
    entity: {
      id,
      position: Position.create({ v: position }),
      orientation: Orientation.create({ v: [0, 0] }),
      size: Size.create({ v: [0.8, 2.2, 1.4] }),
      collideable: Collideable.create(),
      label: Label.create({ text: `Rendered Attack Blocker ${id}` }),
    },
  });
  await waitFor(
    `blocker ${id} synchronized`,
    () => localEntity(page, id),
    ({ entity }) => Boolean(entity?.collideable && entity?.position),
    20_000
  );
  return id;
}

async function deleteFixtures(page, ids) {
  if (!ids.length || page.isClosed()) return;
  try {
    await applyFixture(page, ...ids.map((id) => ({ kind: "delete", id })));
    const deletedIds = new Set(ids.map(String));
    await waitFor(
      `fixture cleanup ${ids.join(",")}`,
      async () => ({
        authoritative: await Promise.all(
          ids.map((id) => authoritativeEntity(page, id))
        ),
        local: await Promise.all(ids.map((id) => localEntity(page, id))),
        cursor: await interactionSnapshot(page),
      }),
      ({ authoritative, local, cursor }) =>
        authoritative.every(({ entity }) => !entity) &&
        local.every(({ entity }) => !entity) &&
        cursor.attackableIds.every((id) => !deletedIds.has(id)) &&
        (cursor.hit?.kind !== "entity" || !deletedIds.has(cursor.hit.id)),
      8_000,
      40
    );
  } catch (error) {
    report.browser.transients.push(
      `fixture-cleanup:${error?.message || error}`
    );
  }
}

async function waitForCrosshair(
  page,
  targetId,
  shouldAttack = true,
  waitMs = 12_000
) {
  return waitFor(
    `${shouldAttack ? "attack" : "non-attack"} crosshair ${targetId}`,
    () => interactionSnapshot(page),
    (snapshot) => {
      const includes = snapshot.attackableIds.includes(String(targetId));
      return shouldAttack ? includes : !includes;
    },
    waitMs
  );
}

async function clickCanvas(page, options = {}) {
  const canvas = page.locator("canvas.biomes-canvas").first();
  const box = await canvas.boundingBox();
  assert(
    box && box.width > 500 && box.height > 300,
    "gameplay canvas is unavailable"
  );
  const clickSurface = await page.evaluate(
    ({ x, y }) => {
      const modal = globalThis.clientContext?.resources?.get("/game_modal");
      const point = document.elementFromPoint(x, y);
      const visible = (selector) =>
        [...document.querySelectorAll(selector)].some((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) > 0
          );
        });
      return {
        modalKind: modal?.kind,
        pointTag: point?.tagName,
        pointClass: point?.className,
        escapeOverlayVisible: visible(".esc-game-controls"),
        reportDialogVisible: visible('[role="dialog"], .report-flow'),
      };
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  );
  assert.equal(
    clickSurface.modalKind,
    "empty",
    `game modal must stay closed before combat input: ${JSON.stringify(clickSurface)}`
  );
  assert.equal(
    clickSurface.escapeOverlayVisible,
    false,
    `escape/feedback overlay blocks combat input: ${JSON.stringify(clickSurface)}`
  );
  assert.equal(
    clickSurface.reportDialogVisible,
    false,
    `feedback modal must stay closed: ${JSON.stringify(clickSurface)}`
  );
  assert.equal(
    clickSurface.pointTag,
    "CANVAS",
    `canvas center is covered by ${JSON.stringify(clickSurface)}`
  );
  await canvas.focus();
  await page.mouse.down({ button: "left" });
  await sleep(options.holdMs ?? 80);
  await page.mouse.up({ button: "left" });
}

async function hp(page, id) {
  const row = await authoritativeEntity(page, id);
  return { hp: finiteNumber(row.entity?.health?.hp), version: row.version };
}

async function waitForHpDecrease(page, id, before, waitMs = 8_000) {
  return waitFor(
    `authoritative HP decrease for ${id}`,
    () => hp(page, id),
    (after) =>
      after.hp !== undefined && before.hp !== undefined && after.hp < before.hp,
    waitMs
  );
}

async function assertHpUnchanged(page, id, before, settleMs = 1_500) {
  await sleep(settleMs);
  const after = await hp(page, id);
  assert.equal(after.hp, before.hp, `target ${id} HP changed unexpectedly`);
  return after;
}

async function runScenario(page, name, body) {
  if (selectedScenarioNames && !selectedScenarioNames.has(name)) {
    return undefined;
  }
  const row = {
    name,
    status: "running",
    startedAt: new Date().toISOString(),
    fixtureIds: [],
    screenshots: {},
  };
  report.scenarios.push(row);
  persist();
  const prefix = `${String(report.scenarios.length).padStart(2, "0")}-${safeName(name)}`;
  try {
    await sleep(scenarioCooldownMs);
    await prepareScenario();
    row.result = await body({
      addFixture: (id) => {
        row.fixtureIds.push(id);
        return id;
      },
      capture: async (label) => {
        const file = await screenshot(page, `${prefix}-${label}`);
        row.screenshots[label] = file;
        return file;
      },
    });
    row.status = "pass";
  } catch (error) {
    row.status = "fail";
    row.error = error?.stack || String(error);
    await screenshot(page, `${prefix}-failure`).then(
      (file) => (row.screenshots.failure = file),
      () => undefined
    );
  } finally {
    row.finishedAt = new Date().toISOString();
    await deleteFixtures(page, row.fixtureIds);
    persist();
  }
  return row;
}

async function collectPerformance(page, label, durationMs = 12_000) {
  const samples = [];
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    const sample = await page.evaluate(() => {
      const controller = globalThis.clientContext?.rendererController;
      const profiler = controller?.profiler?.();
      const interval = profiler?.renderInterval?.().getPercentile?.(0.5);
      const cpu = profiler?.cpuRenderTime?.().getPercentile?.(0.5);
      const gpu = profiler?.gpuRenderTime?.()?.getPercentile?.(0.1);
      const canvas = document.querySelector("canvas.biomes-canvas");
      let gpuRenderer;
      try {
        const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        gpuRenderer = ext
          ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : gl?.getParameter(gl.RENDERER);
      } catch {
        gpuRenderer = undefined;
      }
      return {
        at: Date.now(),
        fps: interval ? 1000 / interval : undefined,
        frameMs: interval,
        cpuMs: cpu,
        gpuMs: gpu,
        renderScale: controller?.passRenderer?.pixelRatio?.(),
        frames: controller?.renderedFrames,
        gpuRenderer,
      };
    });
    samples.push(sample);
    await sleep(750);
  }
  const finite = (key) =>
    samples
      .map((sample) => finiteNumber(sample[key]))
      .filter((v) => v !== undefined);
  const median = (values) => {
    if (!values.length) return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const result = {
    label,
    sampleCount: samples.length,
    medianFps: median(finite("fps")),
    minFps: finite("fps").length ? Math.min(...finite("fps")) : undefined,
    maxFps: finite("fps").length ? Math.max(...finite("fps")) : undefined,
    medianFrameMs: median(finite("frameMs")),
    medianCpuMs: median(finite("cpuMs")),
    medianGpuMs: median(finite("gpuMs")),
    medianRenderScale: median(finite("renderScale")),
    gpuRenderer: samples.find((sample) => sample.gpuRenderer)?.gpuRenderer,
    samples,
  };
  report.performance[label] = result;
  persist();
  return result;
}

async function runProjectileCatalog(page) {
  const panel = page.getByTestId("harthmere-projectile-visual-audit");
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  await waitFor(
    "projectile catalog loaded",
    () =>
      page.evaluate(() => ({
        runtime: document.querySelector(
          '[data-testid="harthmere-projectile-audit-runtime"]'
        )?.textContent,
        fallbacks: document.querySelector(
          '[data-testid="harthmere-projectile-audit-fallbacks"]'
        )?.textContent,
        failed: globalThis.__harthmereProjectileVisuals?.failedIds || [],
        loaded: globalThis.__harthmereProjectileVisuals?.loadedCount,
        manifest: globalThis.__harthmereProjectileVisuals?.manifestCount,
      })),
    (value) =>
      value.loaded > 0 &&
      value.loaded === value.manifest &&
      value.failed.length === 0 &&
      /Fallbacks:\s*none/i.test(value.fallbacks || ""),
    timeoutMs,
    250
  );
  report.projectileReadyScreenshot = await screenshot(
    page,
    "30-projectile-panel-ready"
  );

  const buttons = [
    {
      testId: "harthmere-magic-charge-audit-min",
      label: "minimum magic charge",
    },
    {
      testId: "harthmere-magic-charge-audit-max",
      label: "maximum magic charge",
    },
  ];
  const batchCount = await page
    .locator('[data-testid^="harthmere-projectile-audit-batch-"]')
    .count();
  for (let index = 1; index <= batchCount; index += 1) {
    buttons.push({
      testId: `harthmere-projectile-audit-batch-${index}`,
      label: `projectile batch ${index}`,
    });
  }

  for (const button of buttons) {
    const row = { name: button.label, status: "running" };
    report.projectileCatalog.push(row);
    try {
      const before = await page.evaluate(() => ({
        spawned: Number(
          globalThis.__harthmereProjectileVisuals?.spawnedCount || 0
        ),
        impacts: Number(
          globalThis.__harthmereProjectileVisuals?.impactCount || 0
        ),
        started: Number(
          globalThis.__harthmereProjectileVisuals?.magicChargeStartedCount || 0
        ),
        released: Number(
          globalThis.__harthmereProjectileVisuals?.magicChargeReleasedCount || 0
        ),
      }));
      const locator = page.getByTestId(button.testId);
      await locator.click({ timeout: 20_000 });
      await waitFor(
        `${button.label} becomes active`,
        () =>
          page.evaluate(() => ({
            active: globalThis.__harthmereProjectileVisuals?.active || [],
            charges:
              globalThis.__harthmereProjectileVisuals?.activeMagicCharges || [],
            spawned: Number(
              globalThis.__harthmereProjectileVisuals?.spawnedCount || 0
            ),
            started: Number(
              globalThis.__harthmereProjectileVisuals
                ?.magicChargeStartedCount || 0
            ),
          })),
        (value) =>
          value.active.length > 0 ||
          value.charges.length > 0 ||
          value.spawned > before.spawned ||
          value.started > before.started,
        15_000,
        50
      );
      row.screenshot = await screenshot(
        page,
        `31-${safeName(button.label)}-active`
      );
      const after = await waitFor(
        `${button.label} settles`,
        () =>
          page.evaluate(() => ({
            active: globalThis.__harthmereProjectileVisuals?.active || [],
            charges:
              globalThis.__harthmereProjectileVisuals?.activeMagicCharges || [],
            spawned: Number(
              globalThis.__harthmereProjectileVisuals?.spawnedCount || 0
            ),
            impacts: Number(
              globalThis.__harthmereProjectileVisuals?.impactCount || 0
            ),
            started: Number(
              globalThis.__harthmereProjectileVisuals
                ?.magicChargeStartedCount || 0
            ),
            released: Number(
              globalThis.__harthmereProjectileVisuals
                ?.magicChargeReleasedCount || 0
            ),
            failed: globalThis.__harthmereProjectileVisuals?.failedIds || [],
            fallbacks: (globalThis.__harthmereProjectileVisuals?.active || [])
              .filter((entry) => entry.usingFallback)
              .map((entry) => entry.projectileId),
          })),
        (value) =>
          value.active.length === 0 &&
          value.charges.length === 0 &&
          value.failed.length === 0 &&
          value.fallbacks.length === 0 &&
          (value.impacts > before.impacts || value.released > before.released),
        30_000,
        100
      );
      row.before = before;
      row.after = after;
      row.status = "pass";
    } catch (error) {
      row.status = "fail";
      row.error = error?.stack || String(error);
      row.screenshot = await screenshot(
        page,
        `31-${safeName(button.label)}-failure`
      ).catch(() => undefined);
    }
    persist();
  }
}

async function main() {
  assert(controlToken, "HARTHMERE_E2E_CONTROL_TOKEN is required");
  fs.mkdirSync(artifactsDir, { recursive: true });

  const browser = await chromium.launch({
    headless: process.env.HARTHMERE_E2E_HEADLESS !== "0",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  let context;
  let page;
  const allFixtureIds = new Set();
  try {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(() => {
      // Install the supported pointerless-desktop path before React evaluates
      // supportsPointerLock(). BiomesView then attaches mouse input immediately,
      // and EscGameMenu never covers the canvas with Give Feedback.
      Object.defineProperty(document, "exitPointerLock", {
        configurable: true,
        value: undefined,
      });
      localStorage.setItem("settings.hud.showPerformance", "true");
      localStorage.setItem("settings.hud.keepOverlaysVisible", "true");
      localStorage.setItem("settings.hud.hideReturnToGame", "true");
      sessionStorage.setItem(
        "biomes.harthmere.partialTerrainRecoveryReloaded",
        "1"
      );
      sessionStorage.setItem(
        "biomes.world.missingShardRecoveryReloadedAt",
        String(Date.now())
      );
      globalThis.__nativePlayerAttackInputLog = [];
      addEventListener(
        "mousedown",
        (event) => {
          globalThis.__nativePlayerAttackInputLog.push({
            type: "mousedown",
            button: event.button,
            at: Date.now(),
            target: event.target?.tagName,
          });
        },
        true
      );
      addEventListener(
        "keydown",
        (event) => {
          globalThis.__nativePlayerAttackInputLog.push({
            type: "keydown",
            key: event.key,
            code: event.code,
            at: Date.now(),
          });
        },
        true
      );
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
      `visual test auth failed HTTP ${authResponse.status()}: ${await authResponse.text()}`
    );
    const auth = await authResponse.json();
    assert.equal(
      auth.e2eAdmin,
      true,
      "visual test actor did not receive E2E admin"
    );
    const cookies = await context.cookies(baseUrl);
    const sessionId = cookies.find((cookie) => cookie.name === "BSID")?.value;
    assert(sessionId, "visual test auth did not set BSID");
    await context.addInitScript(
      ({ userId, sessionId }) => {
        const value = JSON.stringify({
          userId: String(userId),
          sessionId,
          createdAtMs: Date.now(),
        });
        localStorage.setItem("harthmere.biomesAuth", value);
        sessionStorage.setItem("harthmere.biomesAuth", value);
      },
      { userId: auth.userId, sessionId }
    );

    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.on("console", (message) => {
      const text = message.text();
      report.browser.console.push({
        type: message.type(),
        text,
        at: Date.now(),
      });
      if (
        /pointer.?lock.*UnknownError|UnknownError.*pointer.?lock/i.test(text)
      ) {
        report.browser.pointerLockWarnings.push({ text, at: Date.now() });
      }
    });
    page.on("pageerror", (error) => {
      report.browser.failures.push(`pageerror:${error?.stack || error}`);
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "unknown";
      const url = request.url();
      if (
        failure === "net::ERR_ABORTED" &&
        /avatar-placeholder|player_mesh\.glb|weapon_icons\/|destroy_hover|cval_logging|client_error|chapter1_(?:story|progress|gate)|live_mode_.*_state/.test(
          url
        )
      ) {
        report.browser.transients.push(`request:${failure}:${url}`);
      } else {
        report.browser.failures.push(`request:${failure}:${url}`);
      }
    });
    page.on("response", (response) => {
      if (response.url().startsWith(baseUrl) && response.status() >= 500) {
        report.browser.failures.push(
          `response:${response.status()}:${response.url()}`
        );
      }
    });

    const gameUrl = new URL("/at", baseUrl);
    gameUrl.searchParams.set("syncBaseUrl", syncBaseUrl);
    gameUrl.searchParams.set("glitch_auto_play", "1");
    gameUrl.searchParams.set("harthmere_native_ecs_e2e", "1");
    gameUrl.searchParams.set("harthmere_projectile_visual_audit", "1");
    gameUrl.searchParams.set("e2e_run", runId);
    const response = await page.goto(gameUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    assert(response && response.status() < 500, "game route failed");
    await waitForStableGameplay(page);
    const diagnostics = await bridgeCall(page, "diagnostics");
    assert.equal(String(diagnostics.userId), String(auth.userId));
    await holdDeterministicPlayerFixture(page);
    if (preflightCleanupIds.length > 0) {
      await deleteFixtures(page, preflightCleanupIds);
      report.preflightCleanupIds = preflightCleanupIds.map(String);
      persist();
    }

    const seed = harthmereGroundedMuckMonsterSeedsInTerritory().find(
      (candidate) => candidate.areaId !== "road_muckwad_patch"
    );
    assert(seed, "no native combat NPC seed is available");
    const profile = harthmereNativeNpcCombatProfileForSeed(seed);
    const swordId = harthmereNativeBiomesIdForItemId("iron_longsword");
    const heavyId = harthmereNativeBiomesIdForItemId("great_sword");
    const bowId = harthmereNativeBiomesIdForItemId("hunter_bow");
    const magicId = harthmereNativeBiomesIdForItemId("arcane_staff");
    assert(
      swordId && heavyId && bowId && magicId,
      "native weapon identities are missing"
    );

    const playerBefore = await authoritativeEntity(page, auth.userId);
    assert(
      playerBefore.entity?.inventory,
      "visual test player has no inventory"
    );
    const inventory = Inventory.clone(playerBefore.entity.inventory);
    inventory.hotbar[0] = countOf(swordId, 1n);
    inventory.hotbar[1] = countOf(bowId, 1n);
    inventory.hotbar[2] = countOf(heavyId, 1n);
    inventory.hotbar[3] = countOf(magicId, 1n);
    inventory.selected = { kind: "hotbar", idx: 0 };
    const triggerState = TriggerState.clone(playerBefore.entity.trigger_state);
    writeHarthmereNativeCombatProgression(triggerState, {
      level: Math.max(20, profile.level),
      migrationVersion: 1,
    });
    const realPlayerMaxHp = Math.max(
      1,
      Number(
        playerBefore.entity?.health?.maxHp ??
          playerBefore.entity?.health?.hp ??
          1
      )
    );
    await applyFixture(page, {
      kind: "update",
      entity: {
        id: auth.userId,
        position: Position.create({ v: basePosition }),
        orientation: Orientation.create({ v: baseOrientation }),
        inventory,
        selected_item: SelectedItem.create({ item: inventory.hotbar[0] }),
        trigger_state: triggerState,
        health: Health.create({ hp: realPlayerMaxHp, maxHp: realPlayerMaxHp }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        death_info: null,
        warping_to: null,
      },
    });
    await waitFor(
      "revived combat player fixture",
      () => localEntity(page, auth.userId),
      ({ entity }) =>
        Number(entity?.health?.hp ?? 0) === realPlayerMaxHp &&
        !entity?.death_info &&
        Math.hypot(
          Number(entity?.position?.v?.[0] ?? Infinity) - basePosition[0],
          Number(entity?.position?.v?.[1] ?? Infinity) - basePosition[1],
          Number(entity?.position?.v?.[2] ?? Infinity) - basePosition[2]
        ) <= 1,
      25_000
    );
    await placeFrontendPlayer(page, auth.userId, basePosition, baseOrientation);
    await waitForLocalPose(page, auth.userId, basePosition);
    prepareScenario = async () => {
      const canvas = page.locator("canvas.biomes-canvas").first();
      const box = await canvas.boundingBox();
      assert(
        box && box.width > 500 && box.height > 300,
        "gameplay canvas is unavailable while resetting combat input"
      );
      // The pointerless desktop path still turns the camera on mousemove. Move
      // to the canvas center first, then restore the authored pose so the real
      // mousedown below cannot inherit aim drift from a previous scenario.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await applyFixture(page, {
        kind: "update",
        entity: {
          id: auth.userId,
          position: Position.create({ v: basePosition }),
          orientation: Orientation.create({ v: baseOrientation }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          health: Health.create({ hp: realPlayerMaxHp, maxHp: realPlayerMaxHp }),
          death_info: null,
          warping_to: null,
        },
      });
      await placeFrontendPlayer(
        page,
        auth.userId,
        basePosition,
        baseOrientation
      );
      await waitFor(
        "idle centered combat player",
        () => interactionSnapshot(page),
        (snapshot) => {
          const orientation = snapshot.playerOrientation;
          const attack = snapshot.attackInfo;
          const now = Date.now() / 1000;
          return (
            Array.isArray(orientation) &&
            Math.abs(orientation[0] - baseOrientation[0]) < 0.03 &&
            Math.abs(
              Math.atan2(
                Math.sin(orientation[1] - baseOrientation[1]),
                Math.cos(orientation[1] - baseOrientation[1])
              )
            ) < 0.03 &&
            (!attack || now >= attack.start + attack.duration)
          );
        },
        5_000,
        25
      );
      await canvas.focus();
    };
    report.environment = await page.evaluate(() => ({
      url: location.href,
      userId: String(globalThis.clientContext?.userId),
      frames: Number(
        globalThis.clientContext?.rendererController?.renderedFrames || 0
      ),
      loading: Boolean(document.querySelector(".loading-wrapper")),
      protectedAreaVisible: /protected area/i.test(document.body.innerText),
      performanceStatsVisible: Boolean(
        document.querySelector(".performance-stats")
      ),
      projectilePanelVisible: Boolean(
        document.querySelector(
          '[data-testid="harthmere-projectile-visual-audit"]'
        )
      ),
    }));
    assert.equal(
      report.environment.protectedAreaVisible,
      false,
      "combat fixture is protected"
    );
    report.initialScreenshot = await screenshot(
      page,
      "00-authenticated-open-combat-fixture"
    );
    if (!skipPerformance) {
      report.performance.baseline = await collectPerformance(
        page,
        "baseline",
        12_000
      );
      report.performanceScreenshot = await screenshot(
        page,
        "01-performance-baseline"
      );
    }

    let singleHitDelta;

    await runScenario(
      page,
      "direct melee hit changes authoritative HP",
      async ({ addFixture, capture }) => {
        await selectWeapon(
          page,
          auth.userId,
          [swordId, bowId, heavyId, magicId],
          0
        );
        const target = await createNpc(page, profile);
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, true);
        await capture("before");
        const before = await hp(page, target.id);
        await clickCanvas(page);
        const after = await waitForHpDecrease(page, target.id, before);
        singleHitDelta = before.hp - after.hp;
        assert(singleHitDelta > 0, "melee hit did not reduce authoritative HP");
        await capture("after");
        return { target, cursor, before, after, damage: singleHitDelta };
      }
    );

    await runScenario(
      page,
      "bystander beside crosshair is not hit",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const primary = await createNpc(page, profile, {
          position: [basePosition[0] + 2, basePosition[1], basePosition[2]],
          label: "Primary Crosshair Target",
        });
        const bystander = await createNpc(page, profile, {
          position: [
            basePosition[0] + 2,
            basePosition[1],
            basePosition[2] + 1.35,
          ],
          label: "Off-axis Bystander",
        });
        addFixture(primary.id);
        addFixture(bystander.id);
        const cursor = await waitForCrosshair(page, primary.id, true);
        assert(!cursor.attackableIds.includes(String(bystander.id)));
        const primaryBefore = await hp(page, primary.id);
        const bystanderBefore = await hp(page, bystander.id);
        await capture("before");
        await clickCanvas(page);
        const primaryAfter = await waitForHpDecrease(
          page,
          primary.id,
          primaryBefore
        );
        const bystanderAfter = await assertHpUnchanged(
          page,
          bystander.id,
          bystanderBefore,
          1_100
        );
        await capture("after");
        return {
          cursor,
          primaryBefore,
          primaryAfter,
          bystanderBefore,
          bystanderAfter,
        };
      }
    );

    await runScenario(
      page,
      "out-of-range crosshair target is a whiff",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, {
          position: [basePosition[0] + 6, basePosition[1], basePosition[2]],
        });
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, false);
        const before = await hp(page, target.id);
        await capture("before");
        await clickCanvas(page);
        const after = await assertHpUnchanged(page, target.id, before);
        await capture("after");
        return { cursor, before, after };
      }
    );

    await runScenario(
      page,
      "collideable blocker prevents through-wall hit",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, {
          position: [basePosition[0] + 2.6, basePosition[1], basePosition[2]],
        });
        const blocker = await createBlocker(page, [
          basePosition[0] + 1.15,
          basePosition[1],
          basePosition[2],
        ]);
        addFixture(target.id);
        addFixture(blocker);
        const cursor = await waitForCrosshair(page, target.id, false);
        const before = await hp(page, target.id);
        await capture("before");
        await clickCanvas(page);
        const after = await assertHpUnchanged(page, target.id, before);
        await capture("after");
        return { cursor, before, after, blocker };
      }
    );

    await runScenario(
      page,
      "melee target leaving before impact is not hit",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [heavyId, bowId], 0);
        const target = await createNpc(page, profile);
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        await capture("before");
        await clickCanvas(page, { holdMs: 45 });
        await sleep(90);
        await setTargetPosition(page, target.id, [
          basePosition[0] + 7,
          basePosition[1],
          basePosition[2] + 2,
        ]);
        const after = await assertHpUnchanged(page, target.id, before, 1_700);
        await capture("after");
        return { cursor, before, after };
      }
    );

    await runScenario(
      page,
      "melee windup cannot transfer to a replacement target",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [heavyId, bowId], 0);
        const original = await createNpc(page, profile, {
          position: [basePosition[0] + 2, basePosition[1], basePosition[2]],
          label: "Original Windup Target",
        });
        const replacement = await createNpc(page, profile, {
          position: [
            basePosition[0] + 2,
            basePosition[1],
            basePosition[2] + 2.5,
          ],
          label: "Replacement Target",
        });
        addFixture(original.id);
        addFixture(replacement.id);
        await waitForCrosshair(page, original.id, true);
        const originalBefore = await hp(page, original.id);
        const replacementBefore = await hp(page, replacement.id);
        await capture("before");
        await clickCanvas(page, { holdMs: 45 });
        await sleep(85);
        await applyFixture(
          page,
          {
            kind: "update",
            entity: {
              id: original.id,
              position: Position.create({
                v: [basePosition[0] + 7, basePosition[1], basePosition[2] + 2],
              }),
            },
          },
          {
            kind: "update",
            entity: {
              id: replacement.id,
              position: Position.create({
                v: [basePosition[0] + 2, basePosition[1], basePosition[2]],
              }),
            },
          }
        );
        await waitForCrosshair(page, replacement.id, true, 2_500);
        const originalAfter = await assertHpUnchanged(
          page,
          original.id,
          originalBefore,
          1_600
        );
        const replacementAfter = await assertHpUnchanged(
          page,
          replacement.id,
          replacementBefore,
          100
        );
        await capture("after");
        return {
          originalBefore,
          originalAfter,
          replacementBefore,
          replacementAfter,
        };
      }
    );

    await runScenario(
      page,
      "actual hotbar switch cancels pending melee impact",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [heavyId, bowId], 0);
        const target = await createNpc(page, profile);
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        await capture("before");
        await clickCanvas(page, { holdMs: 45 });
        await sleep(80);
        await page.keyboard.press("Digit2");
        await waitFor(
          "hotbar switch reaches selected item",
          () => interactionSnapshot(page),
          (snapshot) => snapshot.selectedItemId === String(bowId),
          5_000,
          50
        );
        const after = await assertHpUnchanged(page, target.id, before, 1_700);
        await capture("after");
        return {
          before,
          after,
          inputLog: await page.evaluate(() =>
            globalThis.__nativePlayerAttackInputLog.slice(-12)
          ),
        };
      }
    );

    await runScenario(
      page,
      "dead native target cannot be attacked",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, { hp: 0 });
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, false);
        const before = await hp(page, target.id);
        await capture("before");
        await clickCanvas(page);
        const after = await assertHpUnchanged(page, target.id, before);
        await capture("after");
        return { cursor, before, after };
      }
    );

    await runScenario(
      page,
      "protected native target cannot be attacked",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, { protected: true });
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, false);
        const before = await hp(page, target.id);
        await capture("before");
        await clickCanvas(page);
        const after = await assertHpUnchanged(page, target.id, before);
        await capture("after");
        return { cursor, before, after };
      }
    );

    await runScenario(
      page,
      "health-backed entity without npc metadata is not promised as a hit",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, {
          withoutNpcMetadata: true,
        });
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, false);
        const before = await hp(page, target.id);
        await capture("before");
        await clickCanvas(page);
        const after = await assertHpUnchanged(page, target.id, before);
        await capture("after");
        return { cursor, before, after };
      }
    );

    await runScenario(
      page,
      "nearest collinear target alone receives melee damage",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const near = await createNpc(page, profile, {
          position: [basePosition[0] + 1.8, basePosition[1], basePosition[2]],
          label: "Nearest Target",
        });
        const far = await createNpc(page, profile, {
          position: [basePosition[0] + 3.15, basePosition[1], basePosition[2]],
          label: "Far Collinear Target",
        });
        addFixture(near.id);
        addFixture(far.id);
        const cursor = await waitForCrosshair(page, near.id, true);
        assert(!cursor.attackableIds.includes(String(far.id)));
        const nearBefore = await hp(page, near.id);
        const farBefore = await hp(page, far.id);
        await capture("before");
        await clickCanvas(page);
        const nearAfter = await waitForHpDecrease(page, near.id, nearBefore);
        const farAfter = await assertHpUnchanged(
          page,
          far.id,
          farBefore,
          1_100
        );
        await capture("after");
        return { cursor, nearBefore, nearAfter, farBefore, farAfter };
      }
    );

    await runScenario(
      page,
      "rapid double click produces one committed hit",
      async ({ addFixture, capture }) => {
        assert(singleHitDelta > 0, "single-hit baseline is unavailable");
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile);
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        await capture("before");
        await clickCanvas(page, { holdMs: 35 });
        await sleep(70);
        await clickCanvas(page, { holdMs: 35 });
        const after = await waitForHpDecrease(page, target.id, before);
        await sleep(1_250);
        const settled = await hp(page, target.id);
        const damage = before.hp - settled.hp;
        assert(
          damage <= singleHitDelta * 1.6,
          `rapid double click dealt ${damage}, above one-hit envelope ${singleHitDelta * 1.6}`
        );
        await capture("after");
        return { before, after, settled, damage, singleHitDelta };
      }
    );

    await runScenario(
      page,
      "ranged real input retains launch target and renders projectile",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [bowId, swordId], 0);
        const target = await createNpc(page, profile, {
          position: [basePosition[0] + 9, basePosition[1], basePosition[2]],
        });
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        const runtimeBefore = cursor.projectileRuntime || {};
        await capture("before");
        await clickCanvas(page, { holdMs: 45 });
        await sleep(90);
        await setTargetPosition(page, target.id, [
          basePosition[0] + 8.5,
          basePosition[1],
          basePosition[2] + 2.2,
        ]);
        const active = await waitFor(
          "ranged projectile becomes active",
          () => interactionSnapshot(page),
          (snapshot) =>
            Number(snapshot.projectileRuntime?.spawnedCount || 0) >
              Number(runtimeBefore.spawnedCount || 0) ||
            (snapshot.projectileRuntime?.active || []).length > 0,
          8_000,
          40
        );
        await capture("travel");
        const after = await waitForHpDecrease(page, target.id, before, 10_000);
        const settled = await waitFor(
          "ranged projectile impact settles",
          () => interactionSnapshot(page),
          (snapshot) =>
            Number(snapshot.projectileRuntime?.impactCount || 0) >
              Number(runtimeBefore.impactCount || 0) &&
            (snapshot.projectileRuntime?.active || []).length === 0,
          10_000,
          50
        );
        await capture("after");
        assert.equal(
          (settled.projectileRuntime?.active || []).some(
            (entry) => entry.usingFallback
          ),
          false
        );
        return { cursor, before, after, active, settled };
      }
    );

    await runScenario(
      page,
      "ranged miss still renders a projectile without damaging off-axis target",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [bowId, swordId], 0);
        const target = await createNpc(page, profile, {
          position: [basePosition[0] + 8, basePosition[1], basePosition[2] + 4],
        });
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, false);
        const before = await hp(page, target.id);
        const runtimeBefore = cursor.projectileRuntime || {};
        await capture("before");
        await clickCanvas(page, { holdMs: 45 });
        const active = await waitFor(
          "miss projectile becomes active",
          () => interactionSnapshot(page),
          (snapshot) =>
            Number(snapshot.projectileRuntime?.spawnedCount || 0) >
            Number(runtimeBefore.spawnedCount || 0),
          8_000,
          40
        );
        await capture("travel");
        const after = await assertHpUnchanged(page, target.id, before, 1_700);
        return { cursor, before, after, active };
      }
    );

    await runScenario(
      page,
      "magic real input shows charge projectile and authoritative hit",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [magicId, swordId], 0);
        const target = await createNpc(page, profile, {
          position: [basePosition[0] + 8, basePosition[1], basePosition[2]],
        });
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        const runtimeBefore = cursor.projectileRuntime || {};
        await capture("before");
        await clickCanvas(page, { holdMs: 45 });
        const charge = await waitFor(
          "magic charge becomes visible",
          () => interactionSnapshot(page),
          (snapshot) =>
            Number(snapshot.projectileRuntime?.magicChargeStartedCount || 0) >
              Number(runtimeBefore.magicChargeStartedCount || 0) &&
            (snapshot.projectileRuntime?.activeMagicCharges || []).length > 0,
          8_000,
          40
        );
        await capture("charge");
        const projectile = await waitFor(
          "magic projectile becomes active",
          () => interactionSnapshot(page),
          (snapshot) =>
            Number(snapshot.projectileRuntime?.spawnedCount || 0) >
              Number(runtimeBefore.spawnedCount || 0) &&
            (snapshot.projectileRuntime?.active || []).length > 0,
          10_000,
          40
        );
        await capture("travel");
        const after = await waitForHpDecrease(page, target.id, before, 12_000);
        const settled = await waitFor(
          "magic projectile settles",
          () => interactionSnapshot(page),
          (snapshot) =>
            Number(snapshot.projectileRuntime?.impactCount || 0) >
              Number(runtimeBefore.impactCount || 0) &&
            Number(snapshot.projectileRuntime?.magicChargeReleasedCount || 0) >
              Number(runtimeBefore.magicChargeReleasedCount || 0) &&
            (snapshot.projectileRuntime?.active || []).length === 0 &&
            (snapshot.projectileRuntime?.activeMagicCharges || []).length === 0,
          12_000,
          60
        );
        await capture("after");
        return { cursor, before, after, charge, projectile, settled };
      }
    );

    await runScenario(
      page,
      "actual hotbar switch cancels visible magic charge and damage",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [magicId, swordId], 0);
        const target = await createNpc(page, profile, {
          position: [basePosition[0] + 8, basePosition[1], basePosition[2]],
        });
        addFixture(target.id);
        const cursor = await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        const runtimeBefore = cursor.projectileRuntime || {};
        await capture("before");
        await clickCanvas(page, { holdMs: 45 });
        await waitFor(
          "magic charge starts before cancel",
          () => interactionSnapshot(page),
          (snapshot) =>
            (snapshot.projectileRuntime?.activeMagicCharges || []).length > 0,
          5_000,
          30
        );
        await capture("charge");
        await page.keyboard.press("Digit2");
        const cancelled = await waitFor(
          "magic charge cancellation",
          () => interactionSnapshot(page),
          (snapshot) =>
            Number(snapshot.projectileRuntime?.magicChargeCancelledCount || 0) >
              Number(runtimeBefore.magicChargeCancelledCount || 0) &&
            (snapshot.projectileRuntime?.activeMagicCharges || []).length === 0,
          8_000,
          40
        );
        const after = await assertHpUnchanged(page, target.id, before, 1_700);
        await capture("after");
        return { before, after, cancelled };
      }
    );

    if (!skipProjectileCatalog) {
      await runProjectileCatalog(page);
    }
    if (!skipPerformance) {
      report.performance.afterCatalog = await collectPerformance(
        page,
        "afterCatalog",
        8_000
      );
    }
    report.finalScreenshot = await screenshot(page, "40-final-rendered-state");
    report.actualInputLog = await page.evaluate(() =>
      globalThis.__nativePlayerAttackInputLog.slice(-100)
    );
    report.browser.pointerLockWarningCount =
      report.browser.pointerLockWarnings.length;
    const combatFailures = report.scenarios.filter(
      (row) => row.status !== "pass"
    );
    const catalogFailures = report.projectileCatalog.filter(
      (row) => row.status !== "pass"
    );
    report.summary = {
      combatPassed: report.scenarios.length - combatFailures.length,
      combatFailed: combatFailures.length,
      catalogPassed: report.projectileCatalog.length - catalogFailures.length,
      catalogFailed: catalogFailures.length,
      browserFailures: report.browser.failures.length,
    };
    report.status =
      combatFailures.length === 0 &&
      catalogFailures.length === 0 &&
      report.browser.failures.length === 0
        ? "pass"
        : "fail";
    report.finishedAt = new Date().toISOString();
    persist();
    console.log(JSON.stringify(report.summary));
    console.log(`REPORT ${reportPath}`);
    if (report.status !== "pass") process.exitCode = 1;
  } finally {
    if (page && !page.isClosed() && allFixtureIds.size > 0) {
      await deleteFixtures(page, [...allFixtureIds]);
    }
    await browser.close();
  }
}

main().catch((error) => {
  report.status = "infrastructure-failure";
  report.error = error?.stack || String(error);
  report.finishedAt = new Date().toISOString();
  persist();
  console.error(error?.stack || error);
  console.error(`REPORT ${reportPath}`);
  process.exit(1);
});
