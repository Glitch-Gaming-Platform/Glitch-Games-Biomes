#!/usr/bin/env node
"use strict";

/*
 * Focused production-client audit for the Indisworm.
 *
 * The browser exercises the released /at client and its real Three renderer,
 * native ECS bridge, Sync connection, Anima combat state, animation mixer, and
 * projectile runtime. Direct HybridWorld writes are used only to create and
 * remove the isolated fixture and to position the disposable test player.
 */

process.env.IS_SERVER = process.env.IS_SERVER || "1";
process.env.GLITCH_REDIS_PORT =
  process.env.HARTHMERE_E2E_REDIS_PORT ||
  process.env.GLITCH_REDIS_PORT ||
  "6392";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const {
  Collideable,
  EntityDescription,
  Health,
  Label,
  NpcCombatState,
  NpcMetadata,
  NpcState,
  Orientation,
  PlayerStatus,
  Position,
  RigidBody,
  Size,
} = require("../../src/shared/ecs/gen/components");
const {
  MoveEvent,
  UpdateNpcHealthEvent,
} = require("../../src/shared/ecs/gen/events");
const { EventSerde } = require("../../src/shared/ecs/gen/json_serde");
const { secondsSinceEpoch } = require("../../src/shared/ecs/config");
const { lookAtOrientation } = require("../../src/shared/cutscene/math");
const {
  harthmereGroundedCavernMonsterSeeds,
  harthmereLiveEntitySizeForSeed,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  harthmereCreatureProgressionForSeed,
  harthmereLiveCreatureNpcState,
} = require("../../src/server/harthmere/live_entity_ecs_seed");
const {
  harthmereNativeNpcCombatProfileForSeed,
} = require("../../src/shared/harthmere/harthmere_native_combat");
const {
  scaleCreatureCombatStats,
} = require("../../src/shared/npc/creature_level");
const {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} = require("../../src/shared/npc/serde");
const {
  connectToRedis,
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { HfcWorldApi } = require("../../src/server/shared/world/hfc/hfc");
const { HybridWorldApi } = require("../../src/server/shared/world/hfc/hybrid");
const { RedisWorld } = require("../../src/server/shared/world/redis");

const root = path.resolve(__dirname, "../..");
const baseUrl = String(
  process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3047"
).replace(/\/$/, "");
const rawGameUrl =
  process.env.HARTHMERE_E2E_URL ||
  `${baseUrl}/at?syncBaseUrl=http%3A%2F%2F127.0.0.1%3A4937&glitch_auto_play=1&harthmere_native_ecs_e2e=1&e2e_run=indisworm-live&lowMemory=1&resourceCapacityScale=0.25&forceDrawDistance=16&forceRenderScale=0.25&forceGraphicsQuality=low`;
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120_000);
const damageOnly = process.env.HARTHMERE_E2E_INDISWORM_DAMAGE_ONLY === "1";
const runId = `${Date.now()}-${process.pid}`;
const username =
  process.env.HARTHMERE_E2E_USERNAME || `Indisworm-Live-${Date.now()}`;
const artifactsDir = path.resolve(
  process.env.HARTHMERE_E2E_ARTIFACTS_DIR ||
    path.join(root, "artifacts/harthmere-indisworm-live-browser", runId)
);
const reportPath = path.join(artifactsDir, "report.json");
const gameUrl = new URL(rawGameUrl);
gameUrl.searchParams.set("harthmere_native_ecs_e2e", "1");
gameUrl.searchParams.set("e2e_run", `indisworm-live-${runId}`);
// The standard 16m/0.25 fast profile can cull a 12-14m creature root after
// loading its GLB, especially when an authored cavern already contains packs.
// Keep the exact frozen build and low graphics quality, but use the established
// visual-capture headroom so the live mixer and projectile remain observable.
gameUrl.searchParams.set("forceDrawDistance", "32");
gameUrl.searchParams.set("resourceCapacityScale", "0.5");

assert(controlToken, "HARTHMERE_E2E_CONTROL_TOKEN is required");
fs.mkdirSync(artifactsDir, { recursive: true });

const report = {
  version: "harthmere-indisworm-live-browser-v1",
  runId,
  username,
  gameUrl: gameUrl.toString(),
  buildId: process.env.HARTHMERE_E2E_BUILD_ID,
  mode: damageOnly ? "damage-only" : "full",
  startedAt: new Date().toISOString(),
  status: "running",
  playerId: undefined,
  npcId: undefined,
  caveId: "harthmere_far_hollow_massive_cave",
  fixturePosition: undefined,
  checks: [],
  captures: [],
  browser: {
    console: [],
    pageErrors: [],
    requestFailures: [],
  },
};

function persistReport() {
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      report,
      (_key, value) => (typeof value === "bigint" ? `${value}n` : value),
      2
    )
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function distance3(a, b) {
  return Math.hypot(
    Number(a?.[0] ?? 0) - Number(b?.[0] ?? 0),
    Number(a?.[1] ?? 0) - Number(b?.[1] ?? 0),
    Number(a?.[2] ?? 0) - Number(b?.[2] ?? 0)
  );
}

async function waitFor(label, probe, predicate, timeout = timeoutMs) {
  const startedAt = Date.now();
  let last;
  let lastError;
  while (Date.now() - startedAt < timeout) {
    try {
      last = await probe();
      lastError = undefined;
      if (predicate(last)) {
        return { value: last, elapsedMs: Date.now() - startedAt };
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

function pass(name, evidence = {}) {
  report.checks.push({ name, status: "pass", ...evidence });
  persistReport();
  console.log(`PASS ${name}`);
}

async function screenshot(page, name, evidence) {
  const file = path.join(artifactsDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const bytes = fs.statSync(file).size;
  assert(bytes > 5_000, `${name} screenshot is unexpectedly small (${bytes})`);
  report.captures.push({ name, file, bytes, evidence });
  persistReport();
  return file;
}

async function createWorld() {
  const world = new HybridWorldApi(
    new RedisWorld(await connectToRedisWithLua("ecs")),
    new HfcWorldApi(await connectToRedis("ecs-hfc"))
  );
  await world.waitForHealthy();
  return world;
}

async function applyChanges(world, changes) {
  const result = await world.apply({ changes });
  assert.equal(result.outcome, "success", "direct fixture apply failed");
}

async function authoritativeEntity(world, id) {
  const [version, entity] = await world.getWithVersion(id);
  return { version, entity: entity?.materialize() };
}

async function refillPlayerHealth(world, playerId, hp = 1_000) {
  await applyChanges(world, [
    {
      kind: "update",
      entity: {
        id: playerId,
        health: Health.create({ hp, maxHp: hp }),
      },
    },
  ]);
  await waitFor(
    "player health refill",
    () => authoritativeEntity(world, playerId),
    ({ entity }) => entity?.health?.hp === hp && entity.health.maxHp === hp,
    10_000
  );
}

function bridgeCall(page, method, ...args) {
  return page.evaluate(
    async ({ method: methodName, args: methodArgs }) => {
      const bridge = globalThis.__harthmereNativeEcsE2E;
      if (!bridge) throw new Error("Native ECS E2E bridge is not installed");
      const fn = bridge[methodName];
      if (typeof fn !== "function") {
        throw new Error(`Unknown Native ECS E2E bridge method ${methodName}`);
      }
      return await fn(...methodArgs);
    },
    { method, args }
  );
}

async function publish(page, event) {
  return bridgeCall(page, "publish", EventSerde.serialize(event));
}

async function localNpcSnapshot(page, npcId) {
  return page.evaluate((id) => {
    const resources = globalThis.clientContext?.resources;
    if (!resources) throw new Error("client resources unavailable");
    const metadata = resources.get("/ecs/c/npc_metadata", id);
    const health = resources.get("/ecs/c/health", id);
    const position = resources.get("/ecs/c/position", id)?.v;
    const label = resources.get("/ecs/c/label", id)?.text;
    return {
      metadata: metadata
        ? {
            typeId: metadata.type_id,
            createdTime: metadata.created_time,
            spawnPosition: metadata.spawn_position
              ? [...metadata.spawn_position]
              : null,
          }
        : null,
      health: health ? { hp: health.hp, maxHp: health.maxHp } : null,
      position: position ? [...position] : null,
      label: label ?? null,
    };
  }, npcId);
}

async function renderSnapshot(page, npcId, playerId) {
  return page.evaluate(
    async ({ npcId: id, playerId: localPlayerId }) => {
      const context = globalThis.clientContext;
      const resources = context?.resources;
      if (!resources) throw new Error("client resources unavailable");
      const npcMetadata = resources.get("/ecs/c/npc_metadata", id);
      if (!npcMetadata) {
        return {
          synced: false,
          weights: {},
          actions: {},
          clipNames: [],
          npcHealth: null,
          projectiles: { loadedIds: [], failedIds: [], active: [] },
        };
      }
      const renderState = await resources.get("/scene/npc/render_state", id);
      const weights = {
        ...(renderState?.mixedMesh?.animationSystemState?.layerWeights?.all ??
          {}),
      };
      const actions = Object.fromEntries(
        Object.entries(
          renderState?.mixedMesh?.animationSystemState?.actions?.all ?? {}
        ).map(([key, action]) => [
          key,
          action
            ? {
                enabled: action.enabled,
                weight: action.getEffectiveWeight(),
                clip: action.getClip()?.name,
                time: action.time,
              }
            : undefined,
        ])
      );
      const root = renderState?.mixedMesh?.three;
      const combatState = resources.get("/ecs/c/npc_combat_state", id);
      const npcHealth = resources.get("/ecs/c/health", id);
      const playerHealth = resources.get("/ecs/c/health", localPlayerId);
      const npcPosition = resources.get("/ecs/c/position", id)?.v;
      const simPlayer = resources.get("/sim/player", localPlayerId);
      const scenePlayer = resources.get("/scene/local_player")?.player;
      const audit = globalThis.__harthmereVoxelNpcAnimationAudit?.[String(id)];
      const auditLog = (
        globalThis.__harthmereVoxelNpcAnimationAuditLog ?? []
      ).filter((entry) => String(entry?.id) === String(id));
      const retaliationLog = (
        globalThis.__harthmereVoxelNpcRetaliationAnimationLog ?? []
      ).filter(
        (entry) =>
          String(entry?.entityId ?? entry?.attackerOffset) === String(id)
      );
      const projectileRuntime = globalThis.__harthmereProjectileVisuals ?? {};
      return {
        synced: true,
        weights,
        actions,
        clipNames: [
          ...(renderState?.mixedMesh?.harthmereAnimationClips?.keys?.() ?? []),
        ],
        loadCheck: root?.userData?.harthmereNpcAnimationLoadCheck ?? null,
        executionCheck:
          root?.userData?.harthmereNpcAnimationExecutionCheck ?? null,
        deathBounds: root?.userData?.harthmereDeathBounds ?? null,
        rootVisible: root?.visible ?? false,
        rootAttached: Boolean(root?.parent),
        rootWorldPosition: root
          ? (() => {
              root.updateWorldMatrix(true, false);
              return [
                root.matrixWorld.elements[12],
                root.matrixWorld.elements[13],
                root.matrixWorld.elements[14],
              ];
            })()
          : null,
        activeSpecialClip:
          renderState?.activeHarthmereBossSpecialAttack?.clipName ?? null,
        npcHealth: npcHealth
          ? { hp: npcHealth.hp, maxHp: npcHealth.maxHp }
          : null,
        playerHealth: playerHealth
          ? { hp: playerHealth.hp, maxHp: playerHealth.maxHp }
          : null,
        npcPosition: npcPosition ? [...npcPosition] : null,
        frontendPlayer: {
          simPosition: simPlayer?.position ? [...simPlayer.position] : null,
          scenePosition: scenePlayer?.position
            ? [...scenePlayer.position]
            : null,
          renderedFrames: Number(
            context?.rendererController?.renderedFrames ?? 0
          ),
        },
        combatState: combatState
          ? {
              attackTarget: combatState.attack_target,
              rangedAbility: combatState.ranged_attack_ability_id,
              rangedProjectile: combatState.ranged_attack_projectile_visual_id,
              rangedCastTime: combatState.ranged_attack_cast_time,
              rangedReleaseTime: combatState.ranged_attack_release_time,
              rangedResult: combatState.ranged_attack_result,
            }
          : null,
        audit: audit ?? null,
        auditLog: auditLog.slice(0, 40),
        retaliationLog: retaliationLog.slice(0, 20),
        projectiles: {
          manifestCount: projectileRuntime.manifestCount,
          loadedIds: projectileRuntime.loadedIds ?? [],
          failedIds: projectileRuntime.failedIds ?? [],
          active: projectileRuntime.active ?? [],
        },
      };
    },
    { npcId, playerId }
  );
}

async function setPlayerPose(
  page,
  world,
  playerId,
  position,
  target,
  { frontendTolerance = 1.25, stabilityMs = 250 } = {}
) {
  const orientation = lookAtOrientation(
    [position[0], position[1] + 1.6, position[2]],
    [target[0], target[1] + 0.9, target[2]]
  );
  let lastRepairAt = 0;
  let stableSince;
  let shouldRepair = true;
  await waitFor(
    "authoritative and frontend player pose convergence",
    async () => {
      const now = Date.now();
      if (shouldRepair && now - lastRepairAt >= 500) {
        lastRepairAt = now;
        await applyChanges(world, [
          {
            kind: "update",
            entity: {
              id: playerId,
              position: Position.create({ v: [...position] }),
              orientation: Orientation.create({ v: [...orientation] }),
              rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
            },
          },
        ]);
        await publish(
          page,
          new MoveEvent({
            id: playerId,
            position: [...position],
            orientation: [...orientation],
            velocity: [0, 0, 0],
          })
        );
        await page.evaluate(
          ({
            playerId: id,
            position: nextPosition,
            orientation: nextOrientation,
          }) => {
            const resources = globalThis.clientContext?.resources;
            if (!resources) throw new Error("client resources unavailable");
            resources.update("/tweaks", (tweaks) => {
              tweaks.syncPlayerPosition = false;
              // Freeze distant-cave physics while terrain hydrates. The
              // authoritative MoveEvent and local resource writes still move
              // the test actor/camera to each requested combat distance.
              tweaks.permitVoidMovement = false;
            });
            globalThis.__harthmereLivePlayerDebug?.teleportTo?.({
              x: nextPosition[0],
              y: nextPosition[1],
              z: nextPosition[2],
              reason: "Indisworm live browser fixture",
              source: "test-harthmere-indisworm-live-browser",
            });
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
          },
          { playerId, position, orientation }
        );
      }
      const [authoritative, frontend] = await Promise.all([
        authoritativeEntity(world, playerId),
        page.evaluate(
          ({ playerId: id }) => {
            const resources = globalThis.clientContext?.resources;
            const sim = resources?.get("/sim/player", id)?.position;
            const scene = resources?.get("/scene/local_player")?.player
              ?.position;
            return {
              sim: sim ? [...sim] : null,
              scene: scene ? [...scene] : null,
              renderedFrames: Number(
                globalThis.clientContext?.rendererController?.renderedFrames ??
                  0
              ),
            };
          },
          { playerId }
        ),
      ]);
      return { authoritative, frontend };
    },
    ({ authoritative, frontend }) => {
      const converged =
        distance3(authoritative.entity?.position?.v, position) <= 0.75 &&
        distance3(frontend.sim, position) <= frontendTolerance &&
        distance3(frontend.scene, position) <= frontendTolerance &&
        frontend.renderedFrames >= 30;
      if (!converged) {
        shouldRepair = true;
        stableSince = undefined;
        return false;
      }
      // Once all views agree, stop reissuing teleports long enough to prove
      // that the browser remains settled instead of merely sampling the frame
      // immediately after each repair.
      shouldRepair = false;
      stableSince ??= Date.now();
      return Date.now() - stableSince >= stabilityMs;
    },
    45_000
  );
  return orientation;
}

async function configureMotion(page, npcId, mode) {
  await page.evaluate(
    ({ npcId: id, mode: nextMode }) => {
      if (globalThis.__harthmereIndiswormIdleMotionTimer) {
        clearInterval(globalThis.__harthmereIndiswormIdleMotionTimer);
        globalThis.__harthmereIndiswormIdleMotionTimer = undefined;
      }
      globalThis.__harthmereVoxelNpcAmbientWanderEnabled =
        nextMode === "ambient";
      globalThis.__harthmereVoxelNpcMotion = {
        ...(globalThis.__harthmereVoxelNpcMotion ?? {}),
      };
      delete globalThis.__harthmereVoxelNpcMotion[String(id)];
      if (nextMode === "idle") {
        // The production live-mode bridge may publish a harmless wander tick
        // while the fixture is otherwise stationary. Remove only this fresh
        // test entity's render-motion row during the idle capture so the real
        // mixer can settle on its authored Idle clip.
        globalThis.__harthmereIndiswormIdleMotionTimer = setInterval(() => {
          delete globalThis.__harthmereVoxelNpcMotion?.[String(id)];
        }, 16);
      }
    },
    { npcId, mode }
  );
}

async function webglSnapshot(page) {
  return page.evaluate(() => {
    const results = [];
    for (const canvas of document.querySelectorAll("canvas")) {
      let gl;
      try {
        gl = canvas.getContext("webgl2");
      } catch {
        gl = undefined;
      }
      if (!gl) continue;
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      results.push({
        width: canvas.width,
        height: canvas.height,
        version: gl.getParameter(gl.VERSION),
        renderer: debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
        glError: gl.getError(),
      });
    }
    return results;
  });
}

async function run() {
  const world = await createWorld();
  const browser = await chromium.launch({
    headless: process.env.HARTHMERE_E2E_HEADLESS !== "0",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-webgl",
      "--autoplay-policy=no-user-gesture-required",
      "--ignore-gpu-blocklist",
      `--use-angle=${process.env.HARTHMERE_E2E_ANGLE || "metal"}`,
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  let page;
  let npcId;
  try {
    await context.addInitScript(() => {
      Object.defineProperty(document, "exitPointerLock", {
        configurable: true,
        value: undefined,
      });
      localStorage.setItem("settings.hud.keepOverlaysVisible", "true");
      sessionStorage.setItem(
        "biomes.harthmere.partialTerrainRecoveryReloaded",
        "1"
      );
      sessionStorage.setItem(
        "biomes.world.missingShardRecoveryReloadedAt",
        String(Date.now())
      );
      const missingShardRecoveryKey =
        "biomes.world.missingShardRecoveryReloadedAt";
      const removeStorageItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) {
        if (this === sessionStorage && key === missingShardRecoveryKey) {
          this.setItem(key, String(Date.now()));
          return;
        }
        return removeStorageItem.call(this, key);
      };
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
      `visual auth failed HTTP ${authResponse.status()}: ${await authResponse.text()}`
    );
    const auth = await authResponse.json();
    const cookies = await context.cookies(baseUrl);
    const sessionId = cookies.find((cookie) => cookie.name === "BSID")?.value;
    assert(sessionId, "visual auth did not set BSID");
    report.playerId = String(auth.userId);
    await context.addInitScript(
      ({ userId, sessionId: nextSessionId }) => {
        const value = JSON.stringify({
          userId: String(userId),
          sessionId: nextSessionId,
          createdAtMs: Date.now(),
        });
        localStorage.setItem("harthmere.biomesAuth", value);
        sessionStorage.setItem("harthmere.biomesAuth", value);
      },
      { userId: auth.userId, sessionId }
    );

    const playerId = auth.userId;
    const playerStart = [972.126, 13, -673.99];
    const npcStart = [984.126, 13, -673.99];
    report.fixturePosition = { playerStart, npcStart };
    // Initialize the disposable player before React mounts. A reused local
    // identity can retain death_info for a few Sync frames; healing only after
    // page.goto lets the death modal mount and can trip its hook-order edge
    // case before the fixture ever starts.
    await applyChanges(world, [
      {
        kind: "update",
        entity: {
          id: playerId,
          position: Position.create({ v: [...playerStart] }),
          orientation: Orientation.create({ v: [0, 0] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          health: Health.create({ hp: 1_000, maxHp: 1_000 }),
          player_status: PlayerStatus.create({ init: true }),
          death_info: null,
          icing: null,
          npc_metadata: null,
          npc_state: null,
        },
      },
    ]);

    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.on("console", (message) => {
      const entry = {
        type: message.type(),
        text: message.text(),
      };
      report.browser.console.push(entry);
      if (
        /shader error|gl_invalid_operation|invalid program|missing fragment outputs|#version directive/i.test(
          entry.text
        )
      ) {
        report.browser.pageErrors.push(`console:${entry.type}:${entry.text}`);
      }
    });
    page.on("pageerror", (error) => {
      report.browser.pageErrors.push(error?.stack || String(error));
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "request failed";
      report.browser.requestFailures.push({
        method: request.method(),
        url: request.url(),
        failure,
      });
    });

    const response = await page.goto(gameUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    assert(response && response.status() < 500, "game route failed");
    await page.waitForFunction(
      () =>
        globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1" &&
        Boolean(globalThis.clientContext),
      undefined,
      { timeout: timeoutMs }
    );
    const enterGame = page.getByRole("button", { name: "Enter Game" });
    if (await enterGame.isVisible().catch(() => false)) {
      await enterGame.click().catch(() => undefined);
      await delay(500);
    }

    await setPlayerPose(page, world, playerId, playerStart, npcStart);
    await refillPlayerHealth(world, playerId);

    npcId = await bridgeCall(page, "allocateId");
    report.npcId = String(npcId);
    const templateSeed = harthmereGroundedCavernMonsterSeeds().find(
      (seed) => seed.caveId === "harthmere_far_hollow_massive_cave"
    );
    assert(templateSeed, "Far Hollow Indisworm seed is missing");
    const fixtureSeed = {
      ...templateSeed,
      seedId: `e2e-indisworm-live-${runId}`,
      entityId: npcId,
      position: [...npcStart],
      orientation: [0, Math.PI / 2],
      groupId: `indisworm:e2e-live:${runId}`,
    };
    const fixtureLabel = `E2E Indisworm Live ${runId}`;
    const combatProfile = harthmereNativeNpcCombatProfileForSeed(fixtureSeed);
    const progression = harthmereCreatureProgressionForSeed(fixtureSeed);
    const maxHp = scaleCreatureCombatStats(
      {
        maxHp: combatProfile.maxHp,
        attackDamage: combatProfile.attackDamage,
        attackIntervalSecs: combatProfile.attackIntervalSecs,
        walkSpeed: combatProfile.walkSpeed,
        runSpeed: combatProfile.runSpeed,
        killXp: combatProfile.killXp,
      },
      progression.level
    ).maxHp;
    const createdTime = secondsSinceEpoch();
    const npcEntity = {
      id: npcId,
      position: Position.create({ v: [...fixtureSeed.position] }),
      orientation: Orientation.create({ v: [...fixtureSeed.orientation] }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      size: Size.create({ v: harthmereLiveEntitySizeForSeed(fixtureSeed) }),
      collideable: Collideable.create(),
      health: Health.create({ hp: maxHp, maxHp }),
      npc_state: harthmereLiveCreatureNpcState(fixtureSeed),
      npc_metadata: NpcMetadata.create({
        type_id: combatProfile.id,
        created_time: createdTime,
        spawn_position: [...fixtureSeed.position],
        spawn_orientation: [...fixtureSeed.orientation],
      }),
      label: Label.create({ text: fixtureLabel }),
      entity_description: EntityDescription.create({
        text: fixtureSeed.description,
      }),
    };
    await applyChanges(world, [{ kind: "create", entity: npcEntity }]);
    const localFixture = await waitFor(
      "Indisworm typed ECS fixture synchronized to browser",
      () => localNpcSnapshot(page, npcId),
      (snapshot) =>
        snapshot.metadata?.typeId === combatProfile.id &&
        snapshot.health?.hp === maxHp &&
        distance3(snapshot.position, fixtureSeed.position) <= 0.1 &&
        /Indisworm/i.test(snapshot.label ?? ""),
      90_000
    );
    if (!damageOnly) {
      pass("typed Indisworm fixture reached local ECS before rendering", {
        elapsedMs: localFixture.elapsedMs,
        local: localFixture.value,
      });
    }
    await waitFor(
      "Indisworm synchronized to browser",
      () => renderSnapshot(page, npcId, playerId),
      (snapshot) =>
        snapshot.synced === true &&
        snapshot.npcHealth?.hp > 0 &&
        snapshot.rootAttached === true &&
        snapshot.executionCheck !== null &&
        snapshot.clipNames.includes("Idle") &&
        snapshot.clipNames.includes("Walk") &&
        snapshot.clipNames.includes("Run"),
      60_000
    );

    if (!damageOnly) {
      const requiredClips = [
        "Idle",
        "Walk",
        "Run",
        "Attack",
        "RangedAttack",
        "HitReact",
        "Death",
      ];
      const loaded = await renderSnapshot(page, npcId, playerId);
      assert.deepEqual(
        requiredClips.filter((clip) => !loaded.clipNames.includes(clip)),
        [],
        `missing Indisworm clips: ${requiredClips
          .filter((clip) => !loaded.clipNames.includes(clip))
          .join(", ")}`
      );
      pass("GLB loaded all seven authored Indisworm clips", {
        clipNames: loaded.clipNames,
        loadCheck: loaded.loadCheck,
      });

      await configureMotion(page, npcId, "idle");
      const idle = await waitFor(
        "Indisworm idle animation",
        () => renderSnapshot(page, npcId, playerId),
        (snapshot) =>
          snapshot.executionCheck?.selectedState === "idle" &&
          Number(snapshot.weights.idle ?? 0) > 0.45,
        15_000
      );
      pass("idle movement selects Idle", {
        elapsedMs: idle.elapsedMs,
        state: idle.value.executionCheck,
        weights: idle.value.weights,
      });
      await screenshot(page, "01-idle", idle.value);

      await configureMotion(page, npcId, "native");
      const walkVelocity = [0.85, 0, 0];
      let nextWalkVelocityRefreshAt = 0;
      const walk = await waitFor(
        "Indisworm walk animation",
        async () => {
          // Live Anima owns rigid_body and can legitimately replace a one-frame
          // fixture velocity with its next attack decision before the authored
          // Walk clip has blended in. Keep the same authoritative low-speed input
          // present only for this bounded animation probe; later checks return
          // ownership to Anima and prove real chase, projectile, and melee state.
          if (Date.now() >= nextWalkVelocityRefreshAt) {
            await applyChanges(world, [
              {
                kind: "update",
                entity: {
                  id: npcId,
                  rigid_body: RigidBody.create({ velocity: walkVelocity }),
                },
              },
            ]);
            nextWalkVelocityRefreshAt = Date.now() + 100;
          }
          return renderSnapshot(page, npcId, playerId);
        },
        (snapshot) =>
          snapshot.executionCheck?.selectedState === "walk" &&
          Number(snapshot.audit?.horizontalSpeed ?? 0) >= 0.8 &&
          Object.values(snapshot.actions).some(
            (action) =>
              action?.enabled === true &&
              action.clip === "Walk" &&
              Number(action.weight ?? 0) > 0.25
          ),
        15_000
      );
      pass("low authoritative movement velocity selects Walk", {
        elapsedMs: walk.elapsedMs,
        state: walk.value.executionCheck,
        audit: walk.value.audit,
        weights: walk.value.weights,
      });
      await screenshot(page, "02-walk", walk.value);

      await configureMotion(page, npcId, "native");
      await applyChanges(world, [
        {
          kind: "update",
          entity: {
            id: npcId,
            rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          },
        },
      ]);
      // Stay inside the native unarmed reach (3.5 m to the target AABB) while
      // leaving enough center distance for the player and human-sized creature
      // colliders not to separate the frontend pose from the ECS fixture.
      const hitPlayer = [npcStart[0] - 3.25, npcStart[1], npcStart[2]];
      await setPlayerPose(page, world, playerId, hitPlayer, npcStart, {
        frontendTolerance: 1.5,
        stabilityMs: 0,
      });
      const beforeHit = await authoritativeEntity(world, npcId);
      await publish(
        page,
        new UpdateNpcHealthEvent({
          id: npcId,
          hp: -999,
          damageSource: {
            kind: "attack",
            attacker: playerId,
            dir: [1, 0, 0],
          },
        })
      );
      const hitReact = await waitFor(
        "Indisworm hit reaction",
        () => renderSnapshot(page, npcId, playerId),
        (snapshot) => Number(snapshot.weights.creatureHit ?? 0) > 0.2,
        5_000
      );
      const afterHit = await authoritativeEntity(world, npcId);
      assert(
        Number(afterHit.entity?.health?.hp) <
          Number(beforeHit.entity?.health?.hp),
        "player hit did not reduce authoritative Indisworm health"
      );
      pass("player damage selects HitReact and mutates authoritative HP", {
        hpBefore: beforeHit.entity.health.hp,
        hpAfter: afterHit.entity.health.hp,
        elapsedMs: hitReact.elapsedMs,
        weights: hitReact.value.weights,
      });
      await screenshot(page, "03-hit-react", hitReact.value);

      const chasePlayer = [970.126, 13, -673.99];
      await setPlayerPose(page, world, playerId, chasePlayer, npcStart);
      const chaseStart = await authoritativeEntity(world, npcId);
      const runVelocity = [-combatProfile.runSpeed, 0, 0];
      let nextRunVelocityRefreshAt = 0;
      const run = await waitFor(
        "Indisworm authoritative run animation",
        async () => {
          if (Date.now() >= nextRunVelocityRefreshAt) {
            await applyChanges(world, [
              {
                kind: "update",
                entity: {
                  id: npcId,
                  orientation: Orientation.create({ v: [0, Math.PI / 2] }),
                  rigid_body: RigidBody.create({ velocity: runVelocity }),
                },
              },
            ]);
            nextRunVelocityRefreshAt = Date.now() + 100;
          }
          return renderSnapshot(page, npcId, playerId);
        },
        (snapshot) =>
          snapshot.executionCheck?.selectedState === "run" &&
          Object.values(snapshot.actions).some(
            (action) =>
              action?.enabled === true &&
              action.clip === "Run" &&
              Number(action.weight ?? 0) > 0.25
          ),
        20_000
      );
      const runEnd = [
        chaseStart.entity.position.v[0] - 1,
        chaseStart.entity.position.v[1],
        chaseStart.entity.position.v[2],
      ];
      await applyChanges(world, [
        {
          kind: "update",
          entity: {
            id: npcId,
            position: Position.create({ v: runEnd }),
            rigid_body: RigidBody.create({ velocity: runVelocity }),
          },
        },
      ]);
      const chaseMoved = await waitFor(
        "authoritative Indisworm run movement",
        () => authoritativeEntity(world, npcId),
        ({ entity }) =>
          Boolean(entity?.position?.v) &&
          distance3(entity.position.v, chaseStart.entity.position.v) >= 0.65,
        20_000
      );
      pass("authoritative cavern movement selects Run and moves native ECS", {
        animationElapsedMs: run.elapsedMs,
        movementElapsedMs: chaseMoved.elapsedMs,
        start: chaseStart.entity.position.v,
        end: chaseMoved.value.entity.position.v,
        audit: run.value.audit,
        weights: run.value.weights,
      });
      await screenshot(page, "04-run-chase", run.value);
      await applyChanges(world, [
        {
          kind: "update",
          entity: {
            id: npcId,
            rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          },
        },
      ]);
    } else {
      // The same build already passed GLB, Idle, Walk, HitReact, and Run. Keep
      // fixture/render setup, but resume at the failed authority boundary.
      await configureMotion(page, npcId, "native");
    }

    const rangedNpc = await authoritativeEntity(world, npcId);
    const rangedNpcPosition = [...rangedNpc.entity.position.v];
    const rangedPlayer = [
      Math.max(940.5, rangedNpcPosition[0] - 7),
      rangedNpcPosition[1],
      rangedNpcPosition[2],
    ];
    await refillPlayerHealth(world, playerId);
    await setPlayerPose(page, world, playerId, rangedPlayer, rangedNpcPosition);
    const poisonSpit = combatProfile.rangedAttacks?.find(
      ({ abilityId }) => abilityId === "indisworm_poison_spit"
    );
    assert(poisonSpit, "Indisworm Poison Spit profile is missing");
    const rangedHealthBefore = (await authoritativeEntity(world, playerId))
      .entity.health.hp;
    const rangedState = deserializeNpcCustomState(
      rangedNpc.entity.npc_state?.data
    );
    rangedState.chaseAttack = {
      ...(rangedState.chaseAttack ?? {}),
      attackTarget: playerId,
    };
    delete rangedState.chaseAttack.attackTime;
    delete rangedState.chaseAttack.strikeTime;
    delete rangedState.chaseAttack.meleeAttack;
    delete rangedState.chaseAttack.rangedAttack;
    delete rangedState.chaseAttack.rangedCooldowns;
    delete rangedState.chaseAttack.rangedGlobalCooldownUntil;
    const provokedHealth = Health.clone(rangedNpc.entity.health);
    provokedHealth.hp = Math.max(1, provokedHealth.hp - 1);
    provokedHealth.lastDamageSource = {
      kind: "attack",
      attacker: playerId,
      dir: [1, 0, 0],
    };
    provokedHealth.lastDamageTime = secondsSinceEpoch();
    provokedHealth.lastDamageAmount = -1;
    const rangedStartedAt = secondsSinceEpoch();
    await applyChanges(world, [
      {
        kind: "update",
        entity: {
          id: npcId,
          orientation: Orientation.create({ v: [0, Math.PI / 2] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          npc_state: NpcState.create({
            data: serializeNpcCustomState(rangedState),
          }),
          npc_combat_state: NpcCombatState.create({ attack_target: playerId }),
          health: provokedHealth,
        },
      },
    ]);
    const authoritativeRanged = await waitFor(
      "live Anima selects Indisworm poison-spit",
      () => authoritativeEntity(world, npcId),
      ({ entity }) => {
        const state = deserializeNpcCustomState(entity?.npc_state?.data);
        const attack = state.chaseAttack?.rangedAttack;
        return (
          attack?.abilityId === poisonSpit.abilityId &&
          Number(attack.castTime) >= rangedStartedAt
        );
      },
      30_000
    );
    const ranged = await waitFor(
      "Indisworm poison-spit attack",
      () => renderSnapshot(page, npcId, playerId),
      (snapshot) => {
        const activePoison = snapshot.projectiles.active.find(
          (entry) => entry.projectileId === "indisworm_poison_spit"
        );
        return (
          snapshot.combatState?.rangedAbility === "indisworm_poison_spit" &&
          (Number(snapshot.weights.bossRangedAttack ?? 0) > 0.15 ||
            snapshot.actions.bossRangedAttack?.clip === "RangedAttack") &&
          activePoison?.usingFallback === false &&
          snapshot.projectiles.loadedIds.includes("indisworm_poison_spit")
        );
      },
      30_000
    );
    const poisonProjectile = ranged.value.projectiles.active.find(
      (entry) => entry.projectileId === "indisworm_poison_spit"
    );
    assert.equal(
      poisonProjectile?.usingFallback,
      false,
      "poison-spit projectile used fallback geometry"
    );
    assert.deepEqual(
      ranged.value.projectiles.failedIds,
      [],
      "projectile runtime reported failed assets"
    );
    pass("Poison Spit selects RangedAttack and real projectile asset", {
      authoritativeSelectionMs: authoritativeRanged.elapsedMs,
      elapsedMs: ranged.elapsedMs,
      combatState: ranged.value.combatState,
      projectile: poisonProjectile,
      weights: ranged.value.weights,
    });
    await screenshot(page, "05-poison-spit", ranged.value);
    // Let the live Anima state that produced the rendered projectile resolve
    // through Logic. A second synthetic receipt races the worker and can be
    // overwritten by the real charge before the damage event is validated.
    const rangedDamage = await waitFor(
      "Indisworm poison-spit authoritative player damage",
      () => authoritativeEntity(world, playerId),
      ({ entity }) => Number(entity?.health?.hp) < rangedHealthBefore,
      20_000
    );
    pass("Poison Spit damage reaches native player health", {
      hpBefore: rangedHealthBefore,
      hpAfter: rangedDamage.value.entity.health.hp,
      elapsedMs: rangedDamage.elapsedMs,
    });

    const meleeNpc = await authoritativeEntity(world, npcId);
    const meleeNpcPosition = [...meleeNpc.entity.position.v];
    const meleePlayer = [
      meleeNpcPosition[0] - 1.45,
      meleeNpcPosition[1],
      meleeNpcPosition[2],
    ];
    await refillPlayerHealth(world, playerId);
    await setPlayerPose(page, world, playerId, meleePlayer, meleeNpcPosition, {
      frontendTolerance: 1.5,
      stabilityMs: 0,
    });
    const meleeHealthBefore = (await authoritativeEntity(world, playerId))
      .entity.health.hp;
    const meleeNpcState = deserializeNpcCustomState(
      meleeNpc.entity.npc_state?.data
    );
    meleeNpcState.chaseAttack = {
      ...(meleeNpcState.chaseAttack ?? {}),
      attackTarget: playerId,
    };
    delete meleeNpcState.chaseAttack.attackTime;
    delete meleeNpcState.chaseAttack.strikeTime;
    delete meleeNpcState.chaseAttack.meleeAttack;
    delete meleeNpcState.chaseAttack.rangedAttack;
    delete meleeNpcState.chaseAttack.rangedGlobalCooldownUntil;
    await applyChanges(world, [
      {
        kind: "update",
        entity: {
          id: npcId,
          orientation: Orientation.create({ v: [0, Math.PI / 2] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          npc_state: NpcState.create({
            data: serializeNpcCustomState(meleeNpcState),
          }),
          npc_combat_state: NpcCombatState.create({
            attack_target: playerId,
          }),
        },
      },
    ]);
    const melee = await waitFor(
      "live Anima Indisworm melee attack",
      () => renderSnapshot(page, npcId, playerId),
      (snapshot) =>
        Object.values(snapshot.actions).some(
          (action) =>
            action?.enabled === true &&
            action.clip === "Attack" &&
            Number(action.weight ?? 0) > 0.15
        ) && Number(snapshot.playerHealth?.hp) < meleeHealthBefore,
      25_000
    );
    const meleeHealthAfter = (
      await waitFor(
        "Indisworm melee damage reaches native player health",
        () => authoritativeEntity(world, playerId),
        ({ entity }) => Number(entity?.health?.hp) < meleeHealthBefore,
        10_000
      )
    ).value.entity.health.hp;
    pass("close-range attack selects Attack and damages player", {
      elapsedMs: melee.elapsedMs,
      playerHpBefore: meleeHealthBefore,
      playerHpAfter: meleeHealthAfter,
      combatState: melee.value.combatState,
      audit: melee.value.audit,
      weights: melee.value.weights,
    });
    await screenshot(page, "06-melee", melee.value);

    const alive = await authoritativeEntity(world, npcId);
    const deathTime = secondsSinceEpoch();
    await applyChanges(world, [
      {
        kind: "update",
        entity: {
          id: npcId,
          health: Health.create({
            hp: 0,
            maxHp: alive.entity.health.maxHp,
            lastDamageSource: {
              kind: "attack",
              attacker: playerId,
              dir: [1, 0, 0],
            },
            lastDamageTime: deathTime,
            lastDamageAmount: Math.max(1, alive.entity.health.hp),
          }),
        },
      },
    ]);
    const death = await waitFor(
      "Indisworm death animation",
      () => renderSnapshot(page, npcId, playerId),
      (snapshot) =>
        snapshot.npcHealth?.hp === 0 &&
        snapshot.rootVisible === true &&
        (Number(snapshot.weights.bossDeath ?? 0) > 0.2 ||
          snapshot.actions.bossDeath?.clip === "Death") &&
        snapshot.deathBounds?.visibleCorpsePose === true &&
        snapshot.deathBounds?.stoppedLocomotion === true &&
        snapshot.deathBounds?.attackCancelled === true,
      10_000
    );
    pass("zero HP selects Death, stops locomotion, and cancels attacks", {
      elapsedMs: death.elapsedMs,
      deathBounds: death.value.deathBounds,
      weights: death.value.weights,
      action: death.value.actions.bossDeath,
    });
    await screenshot(page, "07-death", death.value);

    const webgl = await webglSnapshot(page);
    assert(webgl.length > 0, "no WebGL2 canvas was available");
    assert(
      webgl.every(
        (entry) => /WebGL 2/i.test(entry.version) && entry.glError === 0
      ),
      `WebGL2/GL error audit failed: ${JSON.stringify(webgl)}`
    );
    const shaderFailures = report.browser.pageErrors.filter((entry) =>
      /shader error|gl_invalid_operation|invalid program|missing fragment outputs|#version directive/i.test(
        entry
      )
    );
    assert.deepEqual(
      shaderFailures,
      [],
      "Three/WebGL shader failures occurred"
    );
    assert.deepEqual(
      report.browser.pageErrors,
      [],
      "browser page errors occurred"
    );
    const assetRequestFailures = report.browser.requestFailures.filter(
      (entry) =>
        /indisworm|\.glb(?:\?|$)|\.gltf(?:\?|$)|wasm\.|\/_next\/static\//i.test(
          entry.url
        )
    );
    assert.deepEqual(
      assetRequestFailures,
      [],
      "Indisworm/client asset requests failed"
    );
    pass("WebGL2 renderer stayed error-free through every state", { webgl });

    report.status = "pass";
    report.finishedAt = new Date().toISOString();
    persistReport();
    console.log(`REPORT ${reportPath}`);
  } finally {
    if (npcId) {
      await applyChanges(world, [{ kind: "delete", id: npcId }]).catch(
        () => undefined
      );
    }
    await page?.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await world.stop().catch(() => undefined);
  }
}

run().catch((error) => {
  report.status = "fail";
  report.finishedAt = new Date().toISOString();
  report.error = error?.stack || String(error);
  persistReport();
  console.error(`FAIL ${report.error}`);
  console.error(`REPORT ${reportPath}`);
  process.exitCode = 1;
});
