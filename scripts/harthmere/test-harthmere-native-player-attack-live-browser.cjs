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
  acquireBrowserRuntimeLease,
} = require("./browser-runtime-lease.cjs");
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
  harthmereBackpackArrowCount,
} = require("../../src/shared/harthmere/harthmere_ranged_resources");
const {
  harthmereGroundedMuckMonsterSeedsInTerritory,
  HARTHMERE_NATIVE_THAEDRYN_SEED,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  HARTHMERE_NATIVE_BANDIT_SEEDS,
} = require("../../src/shared/harthmere/bandit_production_seed");
const {
  HARTHMERE_ROAD_GROUP_MONSTER_SEEDS,
} = require("../../src/shared/harthmere/road_to_harthmere_groups");
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
let browserRuntimeLease;
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
if (
  selectedScenarioNames &&
  [
    "rapid double click queues exactly one committed follow-up hit",
    "holding primary commits one 50-percent-stronger 30-percent-slower heavy attack",
    "second cow pressed during recovery receives the queued next attack",
  ].some((name) => selectedScenarioNames.has(name))
) {
  selectedScenarioNames.add("direct melee hit changes authoritative HP");
}
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
        localPlayer.playerStatus = "alive";
        globalThis.clientContext?.resources?.set("/game_modal", {
          kind: "empty",
        });
      });
      return true;
    },
    { userId, position, orientation }
  );
  assert.equal(updated, true, "browser simulation player was unavailable");
}

function orientationToward(from, to) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  return [0, Math.atan2(-dx, -dz)];
}

async function interactionSnapshot(page) {
  return page.evaluate(async () => {
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
    const playerMesh = localPlayer
      ? await context?.resources?.get("/scene/player/mesh", localPlayer.id)
      : undefined;
    const itemAttachment = playerMesh?.itemAttachment;
    const equippedVisual = {
      selectedItemId:
        itemAttachment?.selectedItem?.id === undefined
          ? undefined
          : String(itemAttachment.selectedItem.id),
      attachmentChildren:
        playerMesh?.threeWeaponAttachment?.children?.length ?? 0,
      meshName: itemAttachment?.itemMeshInstance?.three?.name,
      runtime: globalThis.__harthmereRendererDebug?.swordState?.() ?? undefined,
    };
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
            timingClass: localPlayer.attackInfo.timingClass,
            damageMultiplier: localPlayer.attackInfo.damageMultiplier,
            combatCombo: localPlayer.attackInfo.combatCombo
              ? { ...localPlayer.attackInfo.combatCombo }
              : undefined,
          }
        : undefined,
      movementActionInfo: localPlayer?.player?.movementActionInfo
        ? {
            action: localPlayer.player.movementActionInfo.action,
            startTime: localPlayer.player.movementActionInfo.startTime,
            expiryTime: localPlayer.player.movementActionInfo.expiryTime,
            nonce: localPlayer.player.movementActionInfo.nonce,
          }
        : undefined,
      replicatedMovementState: playerEntity?.movement_state
        ? {
            action: playerEntity.movement_state.action,
            startTime: playerEntity.movement_state.action_start_time,
            expiryTime: playerEntity.movement_state.action_expiry_time,
            cooldownExpiryTime:
              playerEntity.movement_state.cooldown_expiry_time,
            nonce: playerEntity.movement_state.action_nonce,
          }
        : undefined,
      emoteInfo: localPlayer?.player?.emoteInfo
        ? {
            emoteType: localPlayer.player.emoteInfo.emoteType,
            emoteStartTime: localPlayer.player.emoteInfo.emoteStartTime,
            attackVariationIndex:
              localPlayer.player.emoteInfo.attackVariationIndex,
          }
        : undefined,
      airborne: localPlayer?.player
        ? {
            onGround: localPlayer.player.onGround,
            lastJumpTime: localPlayer.player.lastJumpTime,
            velocity: [...localPlayer.player.velocity],
          }
        : undefined,
      selectedItemId:
        selected?.id === undefined ? undefined : String(selected.id),
      equippedVisual,
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
      heldBowArrowSocket: globalThis.__harthmereHeldBowArrowSocket
        ? [...globalThis.__harthmereHeldBowArrowSocket]
        : undefined,
      magicChargeLog: (globalThis.__harthmereMagicChargeLog || []).slice(0, 12),
      projectileEvents: (
        globalThis.__nativePlayerAttackProjectileEvents || []
      ).slice(-12),
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
  await page.evaluate((selectedIndex) => {
    const resources = globalThis.clientContext?.resources;
    if (resources) {
      resources.set("/hotbar/index", { value: selectedIndex });
    }
  }, selectedIndex);
  await waitFor(
    `rendered selected weapon ${selectedStack?.item?.id}`,
    () => interactionSnapshot(page),
    (snapshot) =>
      String(snapshot.selectedItemId) === String(selectedStack?.item?.id),
    20_000,
    40
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

async function setCombatPlayerPose(page, userId, position, orientation) {
  await applyFixture(page, {
    kind: "update",
    entity: {
      id: userId,
      position: Position.create({ v: position }),
      orientation: Orientation.create({ v: orientation }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
    },
  });
  await placeFrontendPlayer(page, userId, position, orientation);
  await waitForLocalPose(page, userId, position);
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
    if (!options.withoutNpcState) {
      entity.npc_state = NpcState.create();
    }
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

async function activateNpcDamageAuthority(page, id) {
  await applyFixture(page, {
    kind: "update",
    entity: { id, npc_state: NpcState.create() },
  });
  await waitFor(
    `fixture ${id} native damage authority`,
    () => authoritativeEntity(page, id),
    ({ entity }) => Boolean(entity?.npc_state),
    5_000,
    25
  );
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
        staggerDebug: await page.evaluate(
          (entityIds) =>
            entityIds.filter(
              (id) =>
                globalThis.__harthmereNpcStaggerDebug?.[String(id)] !==
                undefined
            ),
          ids
        ),
      }),
      ({ authoritative, local, cursor, staggerDebug }) =>
        authoritative.every(({ entity }) => !entity) &&
        local.every(({ entity }) => !entity) &&
        staggerDebug.length === 0 &&
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

async function npcStaggerSnapshot(page, id) {
  const [row, debug] = await Promise.all([
    authoritativeEntity(page, id),
    page.evaluate((entityId) => {
      const value = globalThis.__harthmereNpcStaggerDebug?.[String(entityId)];
      return value ? JSON.parse(JSON.stringify(value)) : undefined;
    }, id),
  ]);
  const combat = row.entity?.npc_combat_state;
  return {
    sampledAt: Date.now() / 1000,
    version: row.version,
    hp: finiteNumber(row.entity?.health?.hp),
    public: combat
      ? {
          kind: combat.stagger_kind,
          startTime: finiteNumber(combat.stagger_start_time),
          expiryTime: finiteNumber(combat.stagger_expiry_time),
          direction: combat.stagger_direction
            ? [...combat.stagger_direction]
            : undefined,
          sequence: finiteNumber(combat.stagger_sequence) ?? 0,
          poise: finiteNumber(combat.poise),
          poiseMax: finiteNumber(combat.poise_max),
          rangedCastTime: finiteNumber(combat.ranged_attack_cast_time),
          rangedReleaseTime: finiteNumber(combat.ranged_attack_release_time),
          rangedResult: combat.ranged_attack_result,
        }
      : undefined,
    debug,
  };
}

async function waitForNpcStagger(page, id, label, predicate, waitMs = 8_000) {
  return waitFor(
    label,
    () => npcStaggerSnapshot(page, id),
    predicate,
    waitMs,
    20
  );
}

async function npcAnimationSnapshot(page, id) {
  return page.evaluate((entityId) => {
    const value =
      globalThis.__harthmereVoxelNpcAnimationAudit?.[String(entityId)];
    return value ? JSON.parse(JSON.stringify(value)) : undefined;
  }, id);
}

function nativeInventoryItemCount(entity, itemId) {
  const inventory = entity?.inventory;
  return [...(inventory?.items || []), ...(inventory?.hotbar || [])].reduce(
    (total, stack) =>
      String(stack?.item?.id) === String(itemId)
        ? total + Number(stack?.count || 0)
        : total,
    0
  );
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
      let effectiveDrawDistance;
      let requestedDynamicDrawDistance;
      try {
        const resources = globalThis.clientContext?.resources;
        effectiveDrawDistance = resources?.get(
          "/settings/graphics/dynamic"
        )?.drawDistance;
        requestedDynamicDrawDistance = resources?.get(
          "/settings/graphics/dynamic_draw_distance"
        )?.value;
      } catch {
        effectiveDrawDistance = undefined;
        requestedDynamicDrawDistance = undefined;
      }
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
        effectiveDrawDistance,
        requestedDynamicDrawDistance,
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
    medianEffectiveDrawDistance: median(finite("effectiveDrawDistance")),
    medianRequestedDynamicDrawDistance: median(
      finite("requestedDynamicDrawDistance")
    ),
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
  const preflight = await waitFor(
    "projectile catalog manifest ready",
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
      value.manifest > 0 &&
      value.failed.length === 0 &&
      /Fallbacks:\s*none/i.test(value.fallbacks || ""),
    timeoutMs,
    250
  );
  report.projectileCatalogPreflight = preflight;
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
      await prepareScenario();
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
      await locator.evaluate((element) => element.click());
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
  browserRuntimeLease = acquireBrowserRuntimeLease({
    runner: "harthmere-native-player-attack-live-browser",
    runId,
    baseUrl,
    syncBaseUrl,
    stackContainer: process.env.HARTHMERE_E2E_STACK_CONTAINER || "",
    redisContainer: process.env.HARTHMERE_E2E_REDIS_CONTAINER || "",
  });
  report.browserRuntimeLane = browserRuntimeLease.laneId;

  const browser = await chromium.launch({
    headless: process.env.HARTHMERE_E2E_HEADLESS !== "0",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      `--use-angle=${process.env.HARTHMERE_E2E_ANGLE || "metal"}`,
      "--use-gl=angle",
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
      globalThis.__nativePlayerAttackProjectileEvents = [];
      addEventListener("biomes:harthmere-projectile-visual", (event) => {
        globalThis.__nativePlayerAttackProjectileEvents.push({
          at: Date.now(),
          detail: JSON.parse(JSON.stringify(event.detail ?? {})),
        });
      });
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
      if (
        /GL_INVALID_OPERATION.*(?:missing fragment shader outputs|active draw buffers)/i.test(
          text
        )
      ) {
        report.browser.failures.push(`webgl-missing-fragment-output:${text}`);
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
        /avatar-placeholder|player_mesh\.glb|weapon_icons\/|audio\/music-|destroy_hover|cval_logging|client_error|chapter1_(?:story|progress|gate)|live_mode_.*_state/.test(
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
    const staggerHexSeed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.find(
      (candidate) => /Hex/.test(candidate.displayName)
    );
    assert(staggerHexSeed, "no native Hex stagger seed is available");
    const staggerHexProfile =
      harthmereNativeNpcCombatProfileForSeed(staggerHexSeed);
    const staggerBossProfile = harthmereNativeNpcCombatProfileForSeed(
      HARTHMERE_NATIVE_THAEDRYN_SEED
    );
    const staggerPlayerLikeProfile = harthmereNativeNpcCombatProfileForSeed(
      HARTHMERE_NATIVE_BANDIT_SEEDS[0]
    );
    const swordId = harthmereNativeBiomesIdForItemId("iron_longsword");
    const heavyId = harthmereNativeBiomesIdForItemId("great_sword");
    const bowId = harthmereNativeBiomesIdForItemId("hunter_bow");
    const arrowId = harthmereNativeBiomesIdForItemId("hunting_arrow");
    const magicId = harthmereNativeBiomesIdForItemId("arcane_staff");
    const ironIngotId = harthmereNativeBiomesIdForItemId("iron_ingot");
    const axeId = harthmereNativeBiomesIdForItemId("woodcutters_axe");
    const pickaxeId = harthmereNativeBiomesIdForItemId("rusty_pickaxe");
    const shovelId = harthmereNativeBiomesIdForItemId("clay_shovel");
    assert(
      swordId &&
        heavyId &&
        bowId &&
        arrowId &&
        magicId &&
        ironIngotId &&
        axeId &&
        pickaxeId &&
        shovelId,
      "native weapon/tool identities are missing"
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
    for (let index = 0; index < inventory.items.length; index += 1) {
      if (inventory.items[index]?.item?.id === arrowId) {
        inventory.items[index] = undefined;
      }
    }
    const arrowBackpackIndex = inventory.items.findIndex((stack) => !stack);
    assert(
      arrowBackpackIndex >= 0,
      "visual test player has no backpack cell for hunting arrows"
    );
    inventory.items[arrowBackpackIndex] = countOf(arrowId, 5n);
    inventory.selected = { kind: "hotbar", idx: 0 };
    const triggerState = TriggerState.clone(playerBefore.entity.trigger_state);
    writeHarthmereNativeCombatProgression(triggerState, {
      level: Math.max(20, profile.level),
      migrationVersion: 1,
      lastAttackMs: 0,
      comboHits: 0,
      comboExpiresAtMs: 0,
      comboCooldownUntilMs: 0,
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
        movement_state: MovementState.create(),
      },
    });
    // Move the real rendered actor immediately as well. On a retained HFC
    // world, waiting for the stale browser pose to discover the primary write
    // can let its next MoveEvent overwrite the fixture back to the Grove.
    await placeFrontendPlayer(page, auth.userId, basePosition, baseOrientation);
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
          health: Health.create({
            hp: realPlayerMaxHp,
            maxHp: realPlayerMaxHp,
          }),
          trigger_state: TriggerState.clone(triggerState),
          death_info: null,
          warping_to: null,
          movement_state: MovementState.create(),
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
      await page.evaluate(() => {
        const localPlayer = globalThis.clientContext?.resources?.get(
          "/scene/local_player"
        );
        if (!localPlayer) return;
        localPlayer.resetCombatAttackState();
        localPlayer.player.cancelMovementAction();
        localPlayer.player.onGround = true;
        localPlayer.player.lastJumpTime = undefined;
        localPlayer.player.velocity = [0, 0, 0];
      });
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
      if (Number(report.performance.baseline.medianFps || 0) < 30) {
        report.browser.failures.push(
          `performance:combat baseline remained below 30 FPS:${JSON.stringify(report.performance.baseline)}`
        );
      }
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
      "non-boss stagger accumulates, breaks once, rejects chain-lock, and recovers",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, staggerHexProfile, {
          hp: 700,
          label: "Rendered Non-Boss Stagger Target",
          size: [1, 3.5, 1],
        });
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const before = await npcStaggerSnapshot(page, target.id);
        await capture("before");

        await clickCanvas(page, { holdMs: 35 });
        const accumulated = await waitForNpcStagger(
          page,
          target.id,
          "first hit reduces poise without staggering",
          (snapshot) =>
            snapshot.hp < before.hp &&
            snapshot.public?.poise < snapshot.public?.poiseMax &&
            Number(snapshot.public?.sequence || 0) === 0
        );
        await capture("accumulated");

        let breakPresses = 0;
        let broken;
        let lastAccumulationHp = accumulated.hp;
        while (!broken && breakPresses < 3) {
          await sleep(420);
          await waitForCrosshair(page, target.id, true);
          await clickCanvas(page, { holdMs: 35 });
          breakPresses += 1;
          const next = await waitForNpcStagger(
            page,
            target.id,
            "light combo either accumulates or breaks poise",
            (snapshot) =>
              Number(snapshot.public?.sequence || 0) === 1 ||
              snapshot.hp < lastAccumulationHp,
            2_500
          );
          if (Number(next.public?.sequence || 0) === 1) {
            broken = next;
          } else {
            lastAccumulationHp = next.hp;
          }
        }
        assert(
          broken,
          "three linked follow-up hits never broke non-boss poise"
        );
        broken = await waitForNpcStagger(
          page,
          target.id,
          "linked light hits trigger one visible authoritative stagger",
          (snapshot) =>
            Number(snapshot.public?.sequence || 0) === 1 &&
            Number(snapshot.public?.expiryTime || 0) > snapshot.sampledAt &&
            snapshot.debug?.active === true &&
            snapshot.debug?.graphicsVisible === true &&
            snapshot.debug?.attackSuppressed === true
        );
        assert.equal(broken.debug?.version, "harthmere-non-boss-stagger-v1");
        await capture("break");

        await clickCanvas(page, { holdMs: 25 });
        await sleep(180);
        const during = await npcStaggerSnapshot(page, target.id);
        assert.equal(during.public?.sequence, broken.public?.sequence);
        await capture("immunity");

        const recovered = await waitForNpcStagger(
          page,
          target.id,
          "stagger expires and post-stagger poise is restored",
          (snapshot) =>
            Number(snapshot.public?.sequence || 0) === 1 &&
            snapshot.debug?.active === false &&
            snapshot.public?.poise >= snapshot.public?.poiseMax * 0.65,
          5_000
        );
        await sleep(1_250);
        const afterRecoveryDelay = await npcStaggerSnapshot(page, target.id);
        assert(
          afterRecoveryDelay.public?.poise >= recovered.public?.poise,
          "poise regressed after the recovery delay"
        );
        await capture("recovered");

        await sleep(3_100);
        let rebreak;
        let rebreakPresses = 0;
        let lastRecoveryHp = afterRecoveryDelay.hp;
        while (!rebreak && rebreakPresses < 3) {
          await waitForCrosshair(page, target.id, true);
          await clickCanvas(page, { holdMs: 35 });
          rebreakPresses += 1;
          const next = await waitForNpcStagger(
            page,
            target.id,
            "later recovered target accepts a legitimate new poise break",
            (snapshot) =>
              Number(snapshot.public?.sequence || 0) === 2 ||
              snapshot.hp < lastRecoveryHp,
            2_500
          );
          if (Number(next.public?.sequence || 0) === 2) {
            rebreak = next;
          } else {
            lastRecoveryHp = next.hp;
            await sleep(420);
          }
        }
        assert(rebreak, "recovered target never accepted a second poise break");
        await capture("rebreak");
        return {
          before,
          accumulated,
          broken,
          breakPresses,
          during,
          recovered,
          afterRecoveryDelay,
          rebreak,
          rebreakPresses,
        };
      }
    );

    await runScenario(
      page,
      "heavy weapon produces the long heavy non-boss stagger window",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId, heavyId], 2);
        const target = await createNpc(page, profile, {
          hp: 180,
          label: "Rendered Heavy Stagger Target",
          size: [1, 3.5, 1],
        });
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const before = await npcStaggerSnapshot(page, target.id);
        await capture("before");
        await clickCanvas(page, { holdMs: 780 });
        const broken = await waitForNpcStagger(
          page,
          target.id,
          "heavy attack triggers heavy stagger",
          (snapshot) =>
            snapshot.public?.kind === "heavy" &&
            Number(snapshot.public?.sequence || 0) === 1 &&
            snapshot.debug?.active === true &&
            snapshot.debug?.graphicsVisible === true
        );
        const duration = broken.public.expiryTime - broken.public.startTime;
        assert(
          Math.abs(duration - 2.15) <= 0.08,
          `heavy stagger duration was ${duration}`
        );
        await capture("break");
        return { before, broken, duration };
      }
    );

    await runScenario(
      page,
      "stagger during a visible Mucker windup cancels its pending contact",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, {
          hp: 100,
          label: "Rendered Melee Windup Interrupt",
          size: [1, 3.5, 1],
        });
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const windup = await waitFor(
          "Mucker begins a newly rendered melee windup",
          () => npcAnimationSnapshot(page, target.id),
          (snapshot) =>
            snapshot?.bodyAttackActive === true &&
            Number(snapshot.attackAgeMs) >= 0 &&
            Number(snapshot.attackAgeMs) <= 100,
          20_000,
          15
        );
        const playerBefore = await hp(page, auth.userId);
        await capture("windup");
        await clickCanvas(page, { holdMs: 25 });
        const staggered = await waitForNpcStagger(
          page,
          target.id,
          "real sword contact breaks poise during the windup",
          (snapshot) =>
            Number(snapshot.public?.sequence || 0) === 1 &&
            snapshot.debug?.attackSuppressed === true,
          3_000
        );
        await sleep(900);
        const playerAfter = await hp(page, auth.userId);
        assert.equal(
          playerAfter.hp,
          playerBefore.hp,
          "the canceled Mucker windup still landed damage"
        );
        const heldReaction = await npcAnimationSnapshot(page, target.id);
        await capture("interrupted");
        return { windup, staggered, playerBefore, playerAfter, heldReaction };
      }
    );

    await runScenario(
      page,
      "heavy stagger interrupts a Hex cast before projectile release",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [heavyId, bowId], 0);
        const castPosition = [
          basePosition[0] + 8,
          basePosition[1],
          basePosition[2],
        ];
        const target = await createNpc(page, staggerHexProfile, {
          hp: 180,
          label: "Rendered Pre-Release Hex Interrupt",
          position: castPosition,
          size: [1, 3.5, 1],
        });
        addFixture(target.id);
        const casting = await waitForNpcStagger(
          page,
          target.id,
          "Hex enters a visible pre-release cast",
          (snapshot) =>
            Number.isFinite(snapshot.public?.rangedCastTime) &&
            Number.isFinite(snapshot.public?.rangedReleaseTime) &&
            snapshot.public?.rangedResult === undefined,
          20_000
        );
        const playerBefore = await hp(page, auth.userId);
        await setTargetPosition(page, target.id, [
          basePosition[0] + 2,
          basePosition[1],
          basePosition[2],
        ]);
        await waitForCrosshair(page, target.id, true);
        await capture("casting");
        await clickCanvas(page, { holdMs: 35 });
        const interrupted = await waitForNpcStagger(
          page,
          target.id,
          "stagger cancels the unresolved Hex release",
          (snapshot) =>
            Number(snapshot.public?.sequence || 0) === 1 &&
            snapshot.public?.rangedResult === "miss" &&
            snapshot.debug?.attackSuppressed === true,
          5_000
        );
        await sleep(1_600);
        const playerAfter = await hp(page, auth.userId);
        assert.equal(
          playerAfter.hp,
          playerBefore.hp,
          "the interrupted pre-release cast still damaged the player"
        );
        await capture("interrupted");
        return { casting, interrupted, playerBefore, playerAfter };
      }
    );

    await runScenario(
      page,
      "already-released Hex projectile continues through a later stagger",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [heavyId, bowId], 0);
        const target = await createNpc(page, staggerHexProfile, {
          hp: 180,
          label: "Rendered In-Flight Hex Continuation",
          position: [basePosition[0] + 10, basePosition[1], basePosition[2]],
          size: [1, 3.5, 1],
        });
        addFixture(target.id);
        const released = await waitForNpcStagger(
          page,
          target.id,
          "Hex publishes its projectile release",
          (snapshot) =>
            Number.isFinite(snapshot.public?.rangedReleaseTime) &&
            snapshot.sampledAt >= snapshot.public.rangedReleaseTime &&
            snapshot.public?.rangedResult === undefined,
          20_000
        );
        const playerBefore = await hp(page, auth.userId);
        await setTargetPosition(page, target.id, [
          basePosition[0] + 2,
          basePosition[1],
          basePosition[2],
        ]);
        await waitForCrosshair(page, target.id, true);
        await capture("released");
        await clickCanvas(page, { holdMs: 35 });
        const staggered = await waitForNpcStagger(
          page,
          target.id,
          "later hit staggers the caster after release",
          (snapshot) =>
            Number(snapshot.public?.sequence || 0) === 1 &&
            snapshot.debug?.attackSuppressed === true,
          5_000
        );
        const playerAfter = await waitFor(
          "the already-released projectile still resolves",
          () => hp(page, auth.userId),
          (snapshot) => snapshot.hp < playerBefore.hp,
          5_000,
          25
        );
        const settled = await npcStaggerSnapshot(page, target.id);
        assert(
          settled.public?.rangedResult === "hit" ||
            settled.public?.rangedResult === "miss",
          "released projectile never resolved"
        );
        await capture("resolved");
        return { released, staggered, playerBefore, playerAfter, settled };
      }
    );

    await runScenario(
      page,
      "boss and player-like NPC attacks never publish non-boss stagger",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const rows = [];
        for (const [label, excludedProfile] of [
          ["boss", staggerBossProfile],
          ["player-like", staggerPlayerLikeProfile],
        ]) {
          const target = await createNpc(page, excludedProfile, {
            hp: 700,
            label: `Rendered ${label} Stagger Exclusion`,
            size: label === "boss" ? [4, 5, 7] : [1, 3.5, 1],
            position:
              label === "boss"
                ? [basePosition[0] + 5.2, basePosition[1], basePosition[2]]
                : [basePosition[0] + 2, basePosition[1], basePosition[2]],
          });
          addFixture(target.id);
          const cursor =
            label === "boss"
              ? await waitForCrosshair(page, target.id, true)
              : await waitFor(
                  "player-like exclusion reaches the rendered cursor",
                  () => interactionSnapshot(page),
                  (snapshot) =>
                    snapshot.hit?.kind === "entity" &&
                    snapshot.hit.id === String(target.id),
                  5_000,
                  25
                );
          const canAttack = cursor.attackableIds.includes(String(target.id));
          const before = await npcStaggerSnapshot(page, target.id);
          await clickCanvas(page, { holdMs: 35 });
          const afterHp = canAttack
            ? await waitForHpDecrease(page, target.id, before)
            : await assertHpUnchanged(page, target.id, before, 850);
          const after = await npcStaggerSnapshot(page, target.id);
          assert.equal(after.public?.kind, undefined);
          assert.equal(Number(after.public?.sequence || 0), 0);
          assert.notEqual(after.debug?.active, true);
          rows.push({
            label,
            target,
            cursor,
            canAttack,
            before,
            afterHp,
            after,
          });
          await applyFixture(page, { kind: "delete", id: target.id });
          await placeFrontendPlayer(
            page,
            auth.userId,
            basePosition,
            baseOrientation
          );
          await sleep(250);
        }
        await capture("after");
        return rows;
      }
    );

    await runScenario(
      page,
      "multi-enemy stagger fight has no WebGL error storm or material FPS collapse",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [heavyId, bowId], 0);
        const targets = [];
        for (let index = 0; index < 8; index += 1) {
          const row = Math.floor(index / 4);
          const column = index % 4;
          const target = await createNpc(
            page,
            index % 2 === 0 ? profile : staggerHexProfile,
            {
              hp: index === 0 ? 180 : 500,
              label: `Rendered Stagger Performance ${index + 1}`,
              position: [
                basePosition[0] + 2.2 + row * 2.2,
                basePosition[1],
                basePosition[2] + (column - 1.5) * 1.8,
              ],
              size: [1, 3.5, 1],
            }
          );
          targets.push(target);
          addFixture(target.id);
        }
        await setTargetPosition(page, targets[0].id, [
          basePosition[0] + 2,
          basePosition[1],
          basePosition[2],
        ]);
        await waitForCrosshair(page, targets[0].id, true);
        const glErrorsBefore = report.browser.console.filter(({ text }) =>
          /GL_INVALID_OPERATION|active draw buffers|missing fragment shader outputs/i.test(
            text
          )
        ).length;
        await capture("before");
        await clickCanvas(page, { holdMs: 35 });
        const staggered = await waitForNpcStagger(
          page,
          targets[0].id,
          "performance target enters stagger",
          (snapshot) => Number(snapshot.public?.sequence || 0) === 1,
          5_000
        );
        const performance = await collectPerformance(
          page,
          "multi-enemy-stagger-fight",
          8_000
        );
        const glErrorsAfter = report.browser.console.filter(({ text }) =>
          /GL_INVALID_OPERATION|active draw buffers|missing fragment shader outputs/i.test(
            text
          )
        ).length;
        assert.equal(
          glErrorsAfter,
          glErrorsBefore,
          "multi-enemy combat introduced a new WebGL draw-buffer error"
        );
        const baselineFps = Number(report.performance.baseline?.medianFps || 0);
        assert(
          performance.medianFps >= 20 &&
            (!baselineFps || performance.medianFps >= baselineFps * 0.65),
          `multi-enemy combat FPS collapsed: baseline=${baselineFps}, fight=${performance.medianFps}`
        );
        report.performance.multiEnemyStaggerFight = performance;
        await capture("after");
        return {
          targets,
          staggered,
          performance,
          glErrorsBefore,
          glErrorsAfter,
        };
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
      "off-reticle weapon sweep intersects the Mucker body",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, {
          hp: 700,
          label: "Off-Reticle Body Sweep Mucker",
          position: [basePosition[0] + 2.25, basePosition[1], basePosition[2]],
          size: [1.4, 1.4, 1.4],
        });
        addFixture(target.id);
        const directOrientation = orientationToward(
          basePosition,
          target.position
        );
        const offReticleOrientation = [
          directOrientation[0],
          directOrientation[1] + 0.35,
        ];
        await setCombatPlayerPose(
          page,
          auth.userId,
          basePosition,
          offReticleOrientation
        );
        const cursor = await waitForCrosshair(page, target.id, false);
        assert(
          !cursor.attackableIds.includes(String(target.id)),
          "the direct center-ray cursor must remain outside the Mucker body"
        );
        const before = await hp(page, target.id);
        await capture("before");
        await clickCanvas(page, { holdMs: 35 });
        const after = await waitForHpDecrease(page, target.id, before);
        await capture("after");
        return {
          target,
          cursor,
          before,
          after,
          damage: before - after,
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
      "held tool and weapon graphics extend authoritative reach beyond bare hand",
      async ({ addFixture, capture }) => {
        const rows = [];
        const proveBoundary = async ({
          label,
          shorterItems,
          shorterIndex,
          longerItems,
          longerIndex,
          centerDistance,
        }) => {
          await prepareScenario();
          const settledPlayer = await interactionSnapshot(page);
          assert(
            Array.isArray(settledPlayer.playerPosition) &&
              settledPlayer.playerPosition.length === 3,
            `${label}: settled rendered player position is unavailable`
          );
          const playerPosition = [...settledPlayer.playerPosition];
          const target = await createNpc(page, profile, {
            hp: 700,
            label,
            position: [
              playerPosition[0],
              playerPosition[1],
              playerPosition[2] - centerDistance,
            ],
            size: [0.5, 3.5, 0.5],
            withoutNpcState: true,
          });
          addFixture(target.id);
          await selectWeapon(page, auth.userId, longerItems, longerIndex);
          const directions = [
            [0, 0, -1],
            [0, 0, 1],
            [-1, 0, 0],
            [1, 0, 0],
            [Math.SQRT1_2, 0, -Math.SQRT1_2],
            [-Math.SQRT1_2, 0, -Math.SQRT1_2],
            [Math.SQRT1_2, 0, Math.SQRT1_2],
            [-Math.SQRT1_2, 0, Math.SQRT1_2],
          ];
          let clearPlacement;
          for (const direction of directions) {
            const candidatePosition = [
              playerPosition[0] + direction[0] * centerDistance,
              playerPosition[1],
              playerPosition[2] + direction[2] * centerDistance,
            ];
            const candidateOrientation = orientationToward(
              playerPosition,
              candidatePosition
            );
            await setTargetPosition(page, target.id, candidatePosition);
            await setCombatPlayerPose(
              page,
              auth.userId,
              playerPosition,
              candidateOrientation
            );
            try {
              await waitForCrosshair(page, target.id, true, 1_250);
              clearPlacement = {
                targetPosition: candidatePosition,
                directOrientation: candidateOrientation,
              };
              break;
            } catch {
              // Try the next cardinal/diagonal lane. The retained world has a
              // large trunk beside the canonical player fixture, so a fixed
              // direction is not reliable reach evidence.
            }
          }
          assert(
            clearPlacement,
            `${label}: no unobstructed rendered body lane was available`
          );
          const { targetPosition, directOrientation } = clearPlacement;

          await selectWeapon(page, auth.userId, shorterItems, shorterIndex);
          await prepareScenario();
          await setTargetPosition(page, target.id, targetPosition);
          await setCombatPlayerPose(
            page,
            auth.userId,
            playerPosition,
            directOrientation
          );
          const shorterCursor = await waitForCrosshair(page, target.id, false);
          const before = await hp(page, target.id);
          await clickCanvas(page, { holdMs: 35 });
          const afterShorter = await assertHpUnchanged(
            page,
            target.id,
            before,
            850
          );

          await selectWeapon(page, auth.userId, longerItems, longerIndex);
          await prepareScenario();
          await setCombatPlayerPose(
            page,
            auth.userId,
            playerPosition,
            directOrientation
          );
          await setTargetPosition(page, target.id, targetPosition);
          const longerCursor = await waitForCrosshair(page, target.id, true);
          await activateNpcDamageAuthority(page, target.id);
          await setCombatPlayerPose(
            page,
            auth.userId,
            playerPosition,
            directOrientation
          );
          await setTargetPosition(page, target.id, targetPosition);
          await clickCanvas(page, { holdMs: 35 });
          const afterLonger = await waitForHpDecrease(
            page,
            target.id,
            afterShorter
          );
          rows.push({
            label,
            target,
            shorterCursor,
            longerCursor,
            before,
            afterShorter,
            afterLonger,
          });
          // Each boundary is independent. Leaving the previous target in the
          // same narrow +X aim lane lets it steal the next row's crosshair even
          // though its own reach assertion already completed.
          await deleteFixtures(page, [target.id]);
          await sleep(1_250);
        };

        await capture("before");
        await proveBoundary({
          label: "Bare Hand Versus Held Tool Reach",
          shorterItems: [undefined],
          shorterIndex: 0,
          longerItems: [axeId],
          longerIndex: 0,
          centerDistance: 2.25,
        });
        await proveBoundary({
          label: "Held Tool Versus One-Handed Sword Reach",
          shorterItems: [axeId],
          shorterIndex: 0,
          longerItems: [swordId],
          longerIndex: 0,
          centerDistance: 3.15,
        });
        await proveBoundary({
          label: "One-Handed Sword Versus Great Sword Reach",
          shorterItems: [swordId],
          shorterIndex: 0,
          longerItems: [heavyId],
          longerIndex: 0,
          centerDistance: 3.85,
        });
        await capture("after");
        return rows;
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
      "hotbar switch preserves pending melee impact and replaces the attached item once",
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
        const after = await waitForHpDecrease(page, target.id, before, 1_700);
        const visual = await waitFor(
          "bow replaces the sword attachment exactly once",
          () => interactionSnapshot(page),
          (snapshot) =>
            snapshot.equippedVisual?.selectedItemId === String(bowId) &&
            snapshot.equippedVisual?.attachmentChildren === 1 &&
            snapshot.equippedVisual?.runtime
              ?.deprecatedWorldSpaceWeaponPresent === false,
          5_000,
          40
        );
        await capture("after");
        return {
          before,
          after,
          visual,
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
      "rapid double click queues exactly one committed follow-up hit",
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
        const settled = await waitFor(
          "queued second committed hit",
          () => hp(page, target.id),
          (value) =>
            value.hp !== undefined &&
            before.hp !== undefined &&
            before.hp - value.hp >= singleHitDelta * 1.8,
          5_000,
          40
        );
        const damage = before.hp - settled.hp;
        assert(
          damage <= singleHitDelta * 2.2,
          `rapid double click dealt ${damage}, above two-hit envelope ${singleHitDelta * 2.2}`
        );
        await capture("after");
        return { before, after, settled, damage, singleHitDelta };
      }
    );

    await runScenario(
      page,
      "holding primary commits one 50-percent-stronger 30-percent-slower heavy attack",
      async ({ addFixture, capture }) => {
        assert(singleHitDelta > 0, "single-hit baseline is unavailable");
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, {
          hp: 1_000,
          label: "Held Heavy Cow",
        });
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        await capture("before");
        const pressedAt = Date.now();
        await clickCanvas(page, { holdMs: 280 });
        const attack = await waitFor(
          "held primary promotes to heavy",
          () => interactionSnapshot(page),
          (snapshot) =>
            snapshot.attackInfo?.timingClass === "heavy" &&
            snapshot.attackInfo?.damageMultiplier === 1.5 &&
            /attack2/.test(snapshot.emoteInfo?.emoteType || ""),
          3_000,
          15
        );
        assert.equal(attack.attackInfo.duration, 1.083);
        const after = await waitForHpDecrease(page, target.id, before, 4_000);
        const damage = before.hp - after.hp;
        assert(
          damage >= singleHitDelta * 1.45 && damage <= singleHitDelta * 1.55,
          `held heavy dealt ${damage}; expected 1.5x ${singleHitDelta}`
        );
        const contactMs = Date.now() - pressedAt;
        assert(
          contactMs >= 850,
          `held heavy contacted after only ${contactMs}ms instead of the slower clock`
        );
        await sleep(300);
        const settled = await hp(page, target.id);
        assert.equal(
          settled.hp,
          after.hp,
          "held primary release produced a second basic hit"
        );
        await capture("after");
        return { before, after, damage, singleHitDelta, contactMs, attack };
      }
    );

    await runScenario(
      page,
      "four authored swings chain once then enforce the three-second combo cooldown",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, heavyId], 0);
        const target = await createNpc(page, profile, {
          hp: 2_000,
          label: "Four Hit Combo Cow",
        });
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const starts = [];
        const variations = [];
        const hpAfterHits = [];
        let before = await hp(page, target.id);
        await capture("before");

        await clickCanvas(page, { holdMs: 30 });
        for (let hit = 1; hit <= 4; hit += 1) {
          const attack = await waitFor(
            `combo hit ${hit} starts`,
            () => interactionSnapshot(page),
            (snapshot) => snapshot.attackInfo?.combatCombo?.hit === hit,
            4_000,
            15
          );
          starts.push(attack.attackInfo.start);
          variations.push(attack.attackInfo.combatCombo.variation);
          assert.equal(
            attack.emoteInfo?.attackVariationIndex,
            attack.attackInfo.combatCombo.variation,
            `hit ${hit} body clip did not use its combo variation`
          );
          if (hit < 4) {
            // Buffer the next real press while this hit is still committed.
            // The current impact must land once, and the queued hit must link
            // from authored contact instead of waiting for screenshots/polls.
            await sleep(70);
            await clickCanvas(page, { holdMs: 30 });
          }
          const after = await waitForHpDecrease(page, target.id, before, 4_000);
          hpAfterHits.push(after.hp);
          before = after;
        }

        // Screenshots are intentionally deferred until every follow-up press is
        // buffered. A synchronous capture between hit starts can consume most
        // of the 250 ms authored light link and turn a correct combo into a test-made
        // recovery pause.
        await capture("four-hits");

        assert.equal(new Set(variations).size, 4, "combo repeated a swing");
        for (let index = 1; index < starts.length; index += 1) {
          const link = starts[index] - starts[index - 1];
          assert(
            link >= 0.14 && link <= 0.28,
            `combo link ${index} waited ${link.toFixed(3)} seconds instead of flowing after contact`
          );
        }

        const fourth = await interactionSnapshot(page);
        const fourthStart = fourth.attackInfo.start;
        const fourthCooldownUntil = fourth.attackInfo.combatCombo.cooldownUntil;
        await clickCanvas(page, { holdMs: 30 });
        await sleep(500);
        const blockedFifth = await interactionSnapshot(page);
        assert.equal(
          blockedFifth.attackInfo.start,
          fourthStart,
          "fifth hit bypassed the post-chain cooldown"
        );
        const nextChain = await waitFor(
          "queued fifth press starts a new chain after cooldown",
          () => interactionSnapshot(page),
          (snapshot) =>
            snapshot.attackInfo?.start > fourthStart &&
            snapshot.attackInfo?.combatCombo?.hit === 1,
          5_000,
          20
        );
        assert(
          nextChain.attackInfo.start >= fourthCooldownUntil - 0.08,
          `next chain started before ${fourthCooldownUntil}`
        );
        assert.notEqual(
          nextChain.attackInfo.combatCombo.variation,
          variations[0],
          "a new chain did not rotate its starting swing"
        );
        await capture("cooldown-released");
        return {
          starts,
          variations,
          hpAfterHits,
          fourthCooldownUntil,
          blockedFifth,
          nextChain,
        };
      }
    );

    await runScenario(
      page,
      "second cow pressed during recovery receives the queued next attack",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [heavyId, swordId], 0);
        const first = await createNpc(page, profile, {
          hp: singleHitDelta,
          position: [basePosition[0] + 2, basePosition[1], basePosition[2]],
          label: "First Sequential Cow",
        });
        const second = await createNpc(page, profile, {
          position: [basePosition[0] + 2.8, basePosition[1], basePosition[2]],
          label: "Second Sequential Cow",
        });
        addFixture(first.id);
        addFixture(second.id);
        await waitForCrosshair(page, first.id, true);
        const firstBefore = await hp(page, first.id);
        const secondBefore = await hp(page, second.id);
        await capture("before");
        await clickCanvas(page, { holdMs: 35 });
        const firstAttack = await waitFor(
          "first sequential attack starts",
          () => interactionSnapshot(page),
          (snapshot) => Boolean(snapshot.attackInfo?.start),
          1_000,
          15
        );
        const firstAfterPromise = waitForHpDecrease(
          page,
          first.id,
          firstBefore,
          1_500
        );
        // Move the already-contacted/dead front target out of the cursor lane
        // immediately after its authored impact. Waiting for the streamed
        // death projection can consume the entire recovery window and turns a
        // second-target buffer test into a projection-latency test.
        await sleep(280);
        await setTargetPosition(page, first.id, [
          basePosition[0] + 20,
          basePosition[1],
          basePosition[2],
        ]);
        await waitForCrosshair(page, second.id, true, 2_500);
        const firstCommitment = await interactionSnapshot(page);
        assert(
          firstCommitment.attackInfo &&
            Date.now() / 1000 <
              firstCommitment.attackInfo.start +
                firstCommitment.attackInfo.duration,
          "second-cow press was not made during the first commitment"
        );
        await clickCanvas(page, { holdMs: 35 });
        const firstAfter = await firstAfterPromise;
        const secondAfter = await waitForHpDecrease(
          page,
          second.id,
          secondBefore,
          5_000
        );
        const firstSettled = await assertHpUnchanged(
          page,
          first.id,
          firstAfter,
          250
        );
        await capture("after");
        return {
          firstBefore,
          firstAfter,
          firstSettled,
          secondBefore,
          secondAfter,
          firstAttack,
          firstCommitment,
        };
      }
    );

    await runScenario(
      page,
      "out-of-range buffered cow yields to the current valid second cow",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const first = await createNpc(page, profile, {
          label: "First Combo Cow",
        });
        const stale = await createNpc(page, profile, {
          position: [
            basePosition[0] + 2,
            basePosition[1],
            basePosition[2] + 2.8,
          ],
          label: "Buffered Cow Leaving Range",
        });
        const replacement = await createNpc(page, profile, {
          position: [
            basePosition[0] + 2,
            basePosition[1],
            basePosition[2] + 5.5,
          ],
          label: "Current Valid Cow",
        });
        addFixture(first.id);
        addFixture(stale.id);
        addFixture(replacement.id);
        await waitForCrosshair(page, first.id, true);
        const firstBefore = await hp(page, first.id);
        const staleBefore = await hp(page, stale.id);
        const replacementBefore = await hp(page, replacement.id);
        await capture("before");
        await clickCanvas(page, { holdMs: 30 });
        const firstAttack = await waitFor(
          "first combo attack starts",
          () => interactionSnapshot(page),
          (snapshot) => snapshot.attackInfo?.combatCombo?.hit === 1,
          3_000,
          15
        );
        await applyFixture(
          page,
          {
            kind: "update",
            entity: {
              id: first.id,
              position: Position.create({
                v: [
                  basePosition[0] + 2,
                  basePosition[1],
                  basePosition[2] - 2.8,
                ],
              }),
            },
          },
          {
            kind: "update",
            entity: {
              id: stale.id,
              position: Position.create({
                v: [basePosition[0] + 2, basePosition[1], basePosition[2]],
              }),
            },
          }
        );
        await waitForCrosshair(page, stale.id, true, 2_500);
        await clickCanvas(page, { holdMs: 30 });
        await applyFixture(
          page,
          {
            kind: "update",
            entity: {
              id: stale.id,
              position: Position.create({
                v: [basePosition[0] + 15, basePosition[1], basePosition[2]],
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
        await placeFrontendPlayer(
          page,
          auth.userId,
          basePosition,
          baseOrientation
        );
        await waitForCrosshair(page, replacement.id, true, 2_500);
        const staleAfter = await assertHpUnchanged(
          page,
          stale.id,
          staleBefore,
          150
        );
        const replacementAttack = await waitFor(
          "replacement attack starts from the buffered press",
          () => interactionSnapshot(page),
          (snapshot) => snapshot.attackInfo?.combatCombo?.hit === 2,
          2_000,
          15
        );
        const firstAfter = await waitForHpDecrease(
          page,
          first.id,
          firstBefore,
          5_000
        );
        const replacementAfter = await waitForHpDecrease(
          page,
          replacement.id,
          replacementBefore,
          5_000
        );
        const staleSettled = await assertHpUnchanged(
          page,
          stale.id,
          staleAfter,
          300
        );
        await capture("after");
        return {
          firstBefore,
          firstAfter,
          staleBefore,
          staleAfter,
          staleSettled,
          replacementBefore,
          replacementAfter,
          firstAttack,
          replacementAttack,
        };
      }
    );

    await runScenario(
      page,
      "selected hotbar item is the sole hand attachment with no trailing sword",
      async ({ capture }) => {
        const itemIds = [
          swordId,
          axeId,
          pickaxeId,
          shovelId,
          bowId,
          magicId,
          ironIngotId,
          undefined,
        ];
        await selectWeapon(page, auth.userId, itemIds, 0);
        const states = [];
        for (let index = 0; index < itemIds.length; index += 1) {
          if (index > 0) {
            await page.keyboard.press(`Digit${index + 1}`);
          }
          const expected = itemIds[index];
          const state = await waitFor(
            `hotbar item ${index + 1} attaches exactly once`,
            () => interactionSnapshot(page),
            (snapshot) =>
              snapshot.selectedItemId ===
                (expected === undefined ? undefined : String(expected)) &&
              snapshot.equippedVisual?.selectedItemId ===
                (expected === undefined ? undefined : String(expected)) &&
              snapshot.equippedVisual?.attachmentChildren ===
                (expected === undefined ? 0 : 1) &&
              snapshot.equippedVisual?.runtime
                ?.deprecatedWorldSpaceWeaponPresent === false,
            8_000,
            30
          );
          states.push({
            index,
            expected: expected === undefined ? undefined : String(expected),
            selected: state.selectedItemId,
            attached: state.equippedVisual,
          });
          await capture(`hotbar-${index + 1}`);
        }
        return { states };
      }
    );

    await runScenario(
      page,
      "selected mining tool uses its own visual on the combat attack path",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [axeId, pickaxeId], 0);
        const target = await createNpc(page, profile, {
          label: "Tool Combat Target",
        });
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        const visualBefore = await interactionSnapshot(page);
        assert.equal(visualBefore.equippedVisual.selectedItemId, String(axeId));
        assert.equal(visualBefore.equippedVisual.attachmentChildren, 1);
        assert.equal(
          visualBefore.equippedVisual.runtime
            ?.deprecatedWorldSpaceWeaponPresent,
          false
        );
        await capture("before");
        await clickCanvas(page, { holdMs: 35 });
        const after = await waitForHpDecrease(page, target.id, before, 5_000);
        const attack = await interactionSnapshot(page);
        assert.equal(attack.equippedVisual.selectedItemId, String(axeId));
        assert.equal(attack.attackInfo?.combatCombo?.hit, 1);
        await capture("after");
        return { before, after, visualBefore, attack };
      }
    );

    const runMovementAttackScenario = async ({
      name,
      key,
      action,
      expectedOpenSeconds,
    }) =>
      runScenario(page, name, async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, {
          label: `${action} Attack Target`,
        });
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        await capture("before");
        await page.keyboard.press(key);
        const movement = await waitFor(
          `${action} starts from real keyboard input`,
          () => interactionSnapshot(page),
          (snapshot) => snapshot.movementActionInfo?.action === action,
          3_000,
          20
        );
        await sleep(70);
        await clickCanvas(page, { holdMs: 30 });
        const queued = await interactionSnapshot(page);
        const attack = queued.attackInfo
          ? queued
          : await waitFor(
              `${action} flows into attack without a post-movement cooldown`,
              () => interactionSnapshot(page),
              (snapshot) => Boolean(snapshot.attackInfo),
              2_000,
              15
            );
        const transitionSeconds =
          attack.attackInfo.start - movement.movementActionInfo.startTime;
        assert(
          transitionSeconds >= 0 &&
            transitionSeconds <= expectedOpenSeconds + 0.14,
          `${action} attack opened at ${transitionSeconds.toFixed(3)}s, after its allowed ${expectedOpenSeconds.toFixed(3)}s bound`
        );
        // Deterministic harness placement only: the key/click, attack start,
        // impact timer, and authoritative damage remain real game paths.
        await placeFrontendPlayer(
          page,
          auth.userId,
          basePosition,
          baseOrientation
        );
        const after = await waitForHpDecrease(page, target.id, before, 5_000);
        await capture("after");
        return { before, after, movement, queued, attack, transitionSeconds };
      });

    await runMovementAttackScenario({
      name: "dodge input flows directly into a damaging attack",
      key: "KeyE",
      action: "dodge",
      expectedOpenSeconds: 0.1,
    });
    await runMovementAttackScenario({
      name: "evade input flows directly into a damaging attack",
      key: "KeyQ",
      action: "evade",
      expectedOpenSeconds: 0.1,
    });

    await runScenario(
      page,
      "jump input permits an immediate visible damaging attack",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, {
          label: "Jump Attack Target",
          size: [1, 3.5, 1],
        });
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        await capture("before");
        await page.keyboard.press("Space");
        await sleep(35);
        await clickCanvas(page, { holdMs: 30 });
        const attack = await waitFor(
          "jump attack starts while airborne",
          () => interactionSnapshot(page),
          (snapshot) =>
            Boolean(snapshot.attackInfo) &&
            snapshot.airborne?.onGround === false &&
            /attack[12]/.test(snapshot.emoteInfo?.emoteType || ""),
          2_000,
          15
        );
        const after = await waitForHpDecrease(page, target.id, before, 5_000);
        await capture("after");
        return { before, after, attack };
      }
    );

    await runScenario(
      page,
      "double jump buffers into an airborne hit and lands without cancelling it",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [swordId, bowId], 0);
        const target = await createNpc(page, profile, {
          label: "Double Jump Attack Target",
          size: [1, 4.5, 1],
        });
        addFixture(target.id);
        await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        const beforeJump = await interactionSnapshot(page);
        await capture("before");
        await page.keyboard.press("Space");
        await waitFor(
          "first jump launches from real keyboard input",
          () => interactionSnapshot(page),
          (snapshot) =>
            Number(snapshot.airborne?.lastJumpTime || 0) >
            Number(beforeJump.airborne?.lastJumpTime || 0),
          2_000,
          15
        );
        await page.evaluate(() => {
          const player = globalThis.clientContext?.resources?.get(
            "/scene/local_player"
          )?.player;
          if (!player) return;
          player.onGround = false;
          player.velocity[1] = Math.max(4, player.velocity[1]);
        });
        await sleep(80);
        await page.keyboard.press("Space");
        const doubleJump = await waitFor(
          "double jump starts",
          () => interactionSnapshot(page),
          (snapshot) =>
            snapshot.movementActionInfo?.action === "doubleJump" &&
            snapshot.airborne?.onGround === false,
          2_000,
          15
        );
        await clickCanvas(page, { holdMs: 30 });
        const attack = await waitFor(
          "double jump links into attack",
          () => interactionSnapshot(page),
          (snapshot) =>
            Boolean(snapshot.attackInfo) &&
            /attack[12]/.test(snapshot.emoteInfo?.emoteType || ""),
          2_000,
          15
        );
        await placeFrontendPlayer(
          page,
          auth.userId,
          basePosition,
          baseOrientation
        );
        const after = await waitForHpDecrease(page, target.id, before, 5_000);
        const landed = await waitFor(
          "player lands after airborne hit",
          () => interactionSnapshot(page),
          (snapshot) => snapshot.airborne?.onGround === true,
          4_000,
          25
        );
        await capture("after");
        return { before, after, doubleJump, attack, landed };
      }
    );

    for (const movement of [
      {
        action: "dodge",
        key: "KeyE",
        name: "dodge can repeat at the exact half-second cooldown",
      },
      {
        action: "evade",
        key: "KeyQ",
        name: "evade can repeat at the exact half-second cooldown",
      },
    ]) {
      await runScenario(page, movement.name, async ({ capture }) => {
        await capture("before");
        await page.keyboard.press(movement.key);
        const first = await waitFor(
          `first ${movement.action}`,
          () => interactionSnapshot(page),
          (snapshot) =>
            snapshot.movementActionInfo?.action === movement.action &&
            snapshot.replicatedMovementState?.action === movement.action &&
            snapshot.replicatedMovementState?.startTime > 0,
          3_000,
          15
        );
        const earlyPressAt = first.movementActionInfo.startTime + 0.25;
        await sleep(Math.max(0, (earlyPressAt - Date.now() / 1000) * 1000));
        await page.keyboard.press(movement.key);
        await sleep(120);
        const early = await interactionSnapshot(page);
        assert.equal(
          early.replicatedMovementState?.startTime,
          first.replicatedMovementState.startTime,
          `${movement.action} authority accepted a repeat before 0.5 seconds`
        );
        await waitFor(
          `${movement.action} half-second boundary`,
          () => interactionSnapshot(page),
          (snapshot) =>
            Date.now() / 1000 >= first.movementActionInfo.startTime + 0.51,
          1_500,
          10
        );
        await page.keyboard.press(movement.key);
        const second = await waitFor(
          `second ${movement.action}`,
          () => interactionSnapshot(page),
          (snapshot) =>
            snapshot.movementActionInfo?.action === movement.action &&
            snapshot.replicatedMovementState?.action === movement.action &&
            snapshot.replicatedMovementState.startTime >
              first.replicatedMovementState.startTime,
          3_000,
          15
        );
        const interval =
          second.replicatedMovementState.startTime -
          first.replicatedMovementState.startTime;
        assert(
          interval >= 0.5 && interval <= 0.68,
          `${movement.action} repeated after ${interval.toFixed(3)} seconds`
        );
        await capture("after");
        return { first, early, second, interval };
      });
    }

    await runScenario(
      page,
      "ranged real input retains launch target and renders projectile",
      async ({ addFixture, capture }) => {
        await selectWeapon(page, auth.userId, [bowId, swordId], 0);
        // The retained production world can contain a real West Breach Muckling
        // on the straight +X lane. Aim this deterministic arrow row diagonally
        // so a legitimate persistent NPC cannot steal the crosshair before the
        // click. This changes only the fixture lane; the rendered input,
        // authoritative target lock, and post-release movement remain real.
        const targetPosition = [
          basePosition[0] + 6.5,
          basePosition[1],
          basePosition[2] + 6.5,
        ];
        const arrowOrientation = orientationToward(
          basePosition,
          targetPosition
        );
        const target = await createNpc(page, profile, {
          position: targetPosition,
        });
        addFixture(target.id);
        await applyFixture(page, {
          kind: "update",
          entity: {
            id: auth.userId,
            orientation: Orientation.create({ v: arrowOrientation }),
          },
        });
        await placeFrontendPlayer(
          page,
          auth.userId,
          basePosition,
          arrowOrientation
        );
        const cursor = await waitForCrosshair(page, target.id, true);
        const before = await hp(page, target.id);
        const playerBeforeArrow = await authoritativeEntity(page, auth.userId);
        const arrowsBefore = harthmereBackpackArrowCount(
          playerBeforeArrow.entity?.inventory
        );
        assert.equal(
          arrowsBefore,
          5n,
          "arrow row did not start with five backpack arrows"
        );
        const runtimeBefore = cursor.projectileRuntime || {};
        await capture("before");
        await clickCanvas(page, { holdMs: 45 });
        await sleep(90);
        await setTargetPosition(page, target.id, [
          basePosition[0] + 6.2,
          basePosition[1],
          basePosition[2] + 6.8,
        ]);
        const active = await waitFor(
          "authored hunter arrow projectile launches",
          () => interactionSnapshot(page),
          (snapshot) => {
            const arrow = (snapshot.projectileRuntime?.active || []).find(
              (entry) => entry.projectileId === "hunter_bow_shot"
            );
            const launchEvent = (snapshot.projectileEvents || []).find(
              (entry) => entry.detail?.projectileVisualId === "hunter_bow_shot"
            );
            return (
              Number(snapshot.projectileRuntime?.spawnedCount || 0) >
                Number(runtimeBefore.spawnedCount || 0) &&
              Boolean(launchEvent) &&
              (arrow === undefined || arrow.usingFallback === false)
            );
          },
          8_000,
          40
        );
        assert(
          (active.projectileRuntime?.loadedIds || []).includes(
            "hunter_bow_shot"
          ),
          "the exact hunter_bow_shot GLB was not loaded"
        );
        assert.equal(
          (active.projectileRuntime?.failedIds || []).includes(
            "hunter_bow_shot"
          ),
          false,
          "the exact hunter_bow_shot GLB failed to load"
        );
        const activeArrow = (active.projectileRuntime?.active || []).find(
          (entry) => entry.projectileId === "hunter_bow_shot"
        );
        const arrowLaunchEvent = (active.projectileEvents || []).find(
          (entry) => entry.detail?.projectileVisualId === "hunter_bow_shot"
        );
        const arrowOrigin =
          activeArrow?.origin ?? arrowLaunchEvent?.detail?.origin;
        assert(
          Array.isArray(cursor.heldBowArrowSocket),
          "the selected bow did not expose its ArrowSocket"
        );
        assert(
          Array.isArray(arrowOrigin) &&
            Math.hypot(
              arrowOrigin[0] - cursor.heldBowArrowSocket[0],
              arrowOrigin[1] - cursor.heldBowArrowSocket[1],
              arrowOrigin[2] - cursor.heldBowArrowSocket[2]
            ) < 1.5,
          "the new arrow did not launch from the held bow ArrowSocket"
        );
        await capture("travel");
        const after = await waitForHpDecrease(page, target.id, before, 10_000);
        assert.equal(
          before.hp - after.hp,
          5,
          "a paid hunter bow hit must deal exactly five authoritative HP"
        );
        const playerAfterArrow = await authoritativeEntity(page, auth.userId);
        const arrowsAfter = harthmereBackpackArrowCount(
          playerAfterArrow.entity?.inventory
        );
        assert.equal(
          arrowsAfter,
          arrowsBefore - 1n,
          "one paid bow release must consume exactly one backpack arrow"
        );
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
        const combatPerformance = await collectPerformance(
          page,
          "arrowCombat",
          8_000
        );
        assert(
          Number(combatPerformance.medianFps || 0) >= 30,
          `arrow combat remained below 30 FPS: ${JSON.stringify(combatPerformance)}`
        );
        return {
          cursor,
          before,
          after,
          arrowsBefore,
          arrowsAfter,
          active,
          settled,
          combatPerformance,
        };
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
          "magic projectile spawns",
          () => interactionSnapshot(page),
          (snapshot) =>
            Number(snapshot.projectileRuntime?.spawnedCount || 0) >
            Number(runtimeBefore.spawnedCount || 0),
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
        await waitFor(
          "actual hotbar switch selects the sword",
          () => interactionSnapshot(page),
          (snapshot) => snapshot.selectedItemId === String(swordId),
          4_000,
          20
        );
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

    await runScenario(
      page,
      "inventory Drop 1 Destroy and Drop All mutate authoritative items",
      async ({ addFixture, capture }) => {
        const playerRow = await authoritativeEntity(page, auth.userId);
        assert(playerRow.entity?.inventory, "inventory fixture is unavailable");
        const originalInventory = Inventory.clone(playerRow.entity.inventory);
        const testInventory = Inventory.clone(playerRow.entity.inventory);
        for (let index = 0; index < testInventory.items.length; index += 1) {
          if (
            String(testInventory.items[index]?.item?.id) === String(ironIngotId)
          ) {
            testInventory.items[index] = undefined;
          }
        }
        for (let index = 0; index < testInventory.hotbar.length; index += 1) {
          if (
            String(testInventory.hotbar[index]?.item?.id) ===
            String(ironIngotId)
          ) {
            testInventory.hotbar[index] = undefined;
          }
        }
        const slotIndex = testInventory.items.findIndex((stack) => !stack);
        assert(slotIndex >= 0, "inventory fixture has no empty backpack slot");
        testInventory.items[slotIndex] = countOf(ironIngotId, 4n);
        const nearbyDropIds = () =>
          page.evaluate((position) => {
            const entities =
              globalThis.clientContext?.table?.contents?.() || [];
            return [...entities]
              .filter((entity) => {
                const p = entity?.position?.v;
                return (
                  entity?.grab_bag &&
                  Array.isArray(p) &&
                  Math.hypot(
                    Number(p[0]) - position[0],
                    Number(p[1]) - position[1],
                    Number(p[2]) - position[2]
                  ) <= 8
                );
              })
              .map((entity) => String(entity.id));
          }, basePosition);
        const dropsBefore = new Set(await nearbyDropIds());
        try {
          await applyFixture(page, {
            kind: "update",
            entity: { id: auth.userId, inventory: testInventory },
          });
          await waitFor(
            "four test ingots reach authoritative inventory",
            () => authoritativeEntity(page, auth.userId),
            ({ entity }) => nativeInventoryItemCount(entity, ironIngotId) === 4,
            10_000,
            40
          );
          await page.keyboard.press("KeyI");
          const inventoryPanel = page.locator(".biomes-ui-inventory");
          await inventoryPanel.waitFor({ state: "visible", timeout: 10_000 });
          await capture("inventory-open");

          const selectIngotStack = async (count) => {
            const slot = inventoryPanel
              .getByRole("button", {
                name: new RegExp(`Iron Ingot x${count}$`, "i"),
              })
              .first();
            await slot.waitFor({ state: "visible", timeout: 10_000 });
            await slot.click();
          };
          const waitForCount = (count) =>
            waitFor(
              `authoritative ingot count ${count}`,
              () => authoritativeEntity(page, auth.userId),
              ({ entity }) =>
                nativeInventoryItemCount(entity, ironIngotId) === count,
              10_000,
              40
            );

          await selectIngotStack(4);
          const dropOne = inventoryPanel.locator(
            '[data-inventory-action="drop-one"]'
          );
          assert.equal(await dropOne.isEnabled(), true, "Drop 1 is disabled");
          await dropOne.click();
          const afterDropOne = await waitForCount(3);

          await selectIngotStack(3);
          const destroy = inventoryPanel.locator(
            '[data-inventory-action="destroy"]'
          );
          assert.equal(await destroy.isEnabled(), true, "Destroy is disabled");
          await destroy.click();
          const afterDestroy = await waitForCount(2);

          await selectIngotStack(2);
          const dropAll = inventoryPanel.locator(
            '[data-inventory-action="drop-all"]'
          );
          assert.equal(await dropAll.isEnabled(), true, "Drop All is disabled");
          await dropAll.click();
          const afterDropAll = await waitForCount(0);
          const createdDropIds = await waitFor(
            "physical inventory drops appear in local ECS",
            nearbyDropIds,
            (ids) => ids.some((id) => !dropsBefore.has(id)),
            10_000,
            50
          );
          for (const id of createdDropIds) {
            if (!dropsBefore.has(id)) addFixture(Number(id));
          }
          await capture("inventory-mutated");
          await page.keyboard.press("KeyI");
          await inventoryPanel.waitFor({ state: "hidden", timeout: 10_000 });
          assert.equal(
            await page.evaluate(
              () =>
                [
                  ...document.querySelectorAll('[role="dialog"], .report-flow'),
                ].filter((element) => {
                  const rect = element.getBoundingClientRect();
                  const style = getComputedStyle(element);
                  return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== "none" &&
                    style.visibility !== "hidden"
                  );
                }).length
            ),
            0,
            "feedback modal opened while closing inventory"
          );
          return {
            slotIndex,
            afterDropOne: nativeInventoryItemCount(
              afterDropOne.entity,
              ironIngotId
            ),
            afterDestroy: nativeInventoryItemCount(
              afterDestroy.entity,
              ironIngotId
            ),
            afterDropAll: nativeInventoryItemCount(
              afterDropAll.entity,
              ironIngotId
            ),
            createdDropIds,
          };
        } finally {
          await applyFixture(page, {
            kind: "update",
            entity: { id: auth.userId, inventory: originalInventory },
          }).catch(() => undefined);
          if (
            await page
              .locator(".biomes-ui-inventory")
              .isVisible()
              .catch(() => false)
          ) {
            await page.keyboard.press("KeyI").catch(() => undefined);
          }
        }
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
  process.exitCode = 1;
}).finally(() => browserRuntimeLease?.release());
