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
  UpdateNpcHealthEvent,
  UpdatePlayerHealthEvent,
} = require("../../src/shared/ecs/gen/events");
const {
  EntitySerde,
  EventSerde,
  SerializeForServer,
} = require("../../src/shared/ecs/gen/json_serde");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
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
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_LOCATIONS,
} = require("../../src/shared/harthmere/mmo_jobs_board_authority");
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
const configuredGameUrl = process.env.HARTHMERE_E2E_URL || `${baseUrl}/at/Joe`;
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120000);
const acceptanceGateMs = Number(
  process.env.HARTHMERE_E2E_ACCEPTANCE_GATE_MS || 2000
);
const originSyncGateMs = Number(
  process.env.HARTHMERE_E2E_ORIGIN_SYNC_GATE_MS || 1000
);
const secondClientSyncGateMs = Number(
  process.env.HARTHMERE_E2E_SECOND_SYNC_GATE_MS || 1500
);
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
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
  gates: {
    acceptanceGateMs,
    originSyncGateMs,
    secondClientSyncGateMs,
  },
  startedAt: new Date().toISOString(),
  scenarios: [],
  browser: { console: [], requests: [], failures: [] },
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
    if (message.type() === "error") {
      report.browser.failures.push(text);
    }
  });
  page.on("request", (request) => {
    const url = request.url();
    if (/\/api\/|\/sync(?:\?|$)/.test(url)) {
      report.browser.requests.push({
        client: label,
        method: request.method(),
        url: url.replace(baseUrl, ""),
        at: Date.now(),
      });
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(baseUrl)) {
      report.browser.failures.push(
        `${label}:requestfailed:${request.method()}:${request.url()}:${
          request.failure()?.errorText
        }`
      );
    }
  });
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 500) {
      report.browser.failures.push(
        `${label}:response:${response.status()}:${response.url()}`
      );
    }
  });
}

async function openUser(browser, username, label) {
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
  return { context, page, userId: auth.userId, username };
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

async function run() {
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

  const suffix = runId.replace(/[^0-9]/g, "").slice(-10);
  let first;
  let second;
  let sameUserPeer;
  try {
    first = await openUser(browser, `NativeECS-A-${suffix}`, "client-a");
    sameUserPeer = await openSameUserPeer(first, "client-a-peer");
    second = await openUser(browser, `NativeECS-B-${suffix}`, "client-b");

    const initial = await authoritativeEntity(first.page, first.userId);
    assert(initial.entity?.position?.v, "E2E player has no native position");
    const position = [...initial.entity.position.v];
    const initialDiagnostics = await bridgeCall(first.page, "diagnostics");
    assert(
      initialDiagnostics.tableSize > 0,
      "world sync completed without hydrating any ECS entities"
    );
    const peerInitial = await waitFor(
      "same-user peer world bootstrap",
      () => localEntity(sameUserPeer, first.userId),
      ({ entity }) => Boolean(entity?.position && entity?.inventory),
      secondClientSyncGateMs
    );
    report.scenarios.push({
      name: "world bootstrap and same-user identity",
      status: "pass",
      hydratedEntityCount: initialDiagnostics.tableSize,
      secondClientSyncMs: peerInitial.elapsedMs,
    });

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

    // Jobs-board mutations are intentionally Redis-authoritative metadata, but
    // the backend must read the actor's native ECS position before accepting
    // them. Prove the same browser request is rejected away from the board and
    // accepted after the synchronized Position component moves into range.
    const board =
      HARTHMERE_JOBS_BOARD_LOCATIONS[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID];
    const awayJobResult = await postLiveMode(
      first.page,
      "request_jobs_board_mutation",
      "jobs",
      {
        operation: "economy_auto_seed_jobs",
        boardId: board.boardId,
        interactionTargetId: board.boardId,
      },
      board.boardId
    );
    const awayJobWarnings =
      awayJobResult.body?.backendMutation?.warnings ??
      awayJobResult.body?.validation?.warnings ??
      [];
    assert(
      awayJobWarnings.some((warning) =>
        String(warning).startsWith("jobs_board_rejected:")
      ),
      "jobs board mutation away from the native ECS board position was accepted"
    );
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
      "jobs board native position sync",
      () => localEntity(first.page, first.userId),
      ({ entity }) => entity?.position?.v?.[0] === boardPosition[0],
      originSyncGateMs
    );
    const seedJobsResult = await postLiveMode(
      first.page,
      "request_jobs_board_mutation",
      "jobs",
      {
        operation: "economy_auto_seed_jobs",
        boardId: board.boardId,
        interactionTargetId: board.boardId,
      },
      board.boardId
    );
    assert(seedJobsResult.ok && seedJobsResult.body?.ok !== false);
    const seedWarnings = seedJobsResult.body?.backendMutation?.warnings ?? [];
    assert(
      !seedWarnings.some((warning) =>
        String(warning).startsWith("jobs_board_rejected:")
      ),
      `jobs board seed rejected in range: ${seedWarnings.join(",")}`
    );
    const jobsStateResult = await pageJson(
      first.page,
      "/api/harthmere/live_mode_jobs_board_state"
    );
    assert(jobsStateResult.ok && jobsStateResult.body?.ok !== false);
    const jobsState = jobsStateResult.body.jobsBoardState;
    const openJob = (jobsState?.openJobs ?? []).find(
      (job) => job.boardId === board.boardId
    );
    assert(openJob, "jobs board auto-seed produced no executable open job");
    const acceptJobResult = await postLiveMode(
      first.page,
      "request_jobs_board_mutation",
      "jobs",
      {
        operation: "accept_job",
        boardId: board.boardId,
        interactionTargetId: board.boardId,
        jobId: openJob.jobId,
      },
      board.boardId
    );
    const acceptWarnings =
      acceptJobResult.body?.backendMutation?.warnings ?? [];
    assert(
      acceptJobResult.ok &&
        acceptJobResult.body?.ok !== false &&
        !acceptWarnings.some((warning) =>
          String(warning).startsWith("jobs_board_rejected:")
        ),
      `jobs board accept failed: ${acceptWarnings.join(",")}`
    );
    const acceptedJobsState = (
      await pageJson(first.page, "/api/harthmere/live_mode_jobs_board_state")
    ).body.jobsBoardState;
    assert(
      (acceptedJobsState?.myTodos ?? []).some(
        (todo) => todo.jobId === openJob.jobId && todo.status === "active"
      ),
      "accepted job did not become an authoritative jobs-board todo"
    );
    report.scenarios.push({
      name: "jobs board ECS position gate and accept",
      status: "pass",
      jobId: openJob.jobId,
      boardId: board.boardId,
    });

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
    const combatPosition = [...gatheringNode.position];
    const targetPosition = [
      combatPosition[0] + 2,
      combatPosition[1],
      combatPosition[2],
    ];
    const npcId = await bridgeCall(first.page, "allocateId");
    const combatPlayer = await authoritativeEntity(first.page, first.userId);
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
    await applyFixture(
      first.page,
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
        kind: "update",
        entity: {
          id: second.userId,
          position: Position.create({ v: combatPosition }),
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
      }
    );
    await Promise.all([
      waitFor(
        "combat fixture synchronized to attacker",
        () => localEntity(first.page, npcId),
        ({ entity }) => entity?.health?.hp === combatProfile.maxHp,
        secondClientSyncGateMs
      ),
      waitFor(
        "combat fixture synchronized to observer",
        () => localEntity(second.page, npcId),
        ({ entity }) => entity?.health?.hp === combatProfile.maxHp,
        secondClientSyncGateMs
      ),
    ]);
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
      secondProbe: () => localEntity(second.page, npcId),
      secondPredicate: ({ entity }) => entity?.health?.hp < combatProfile.maxHp,
    });
    const retaliation = await waitFor(
      "Anima retaliation updates native player health",
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) => entity?.health?.hp < 100,
      15_000,
      20_000
    );
    await waitFor(
      "retaliation reaches HUD health source",
      () => localEntity(first.page, first.userId),
      ({ entity }) => entity?.health?.hp < 100,
      originSyncGateMs
    );
    report.scenarios.push({
      name: "Anima native retaliation",
      status: "pass",
      authoritativeMs: retaliation.elapsedMs,
      npcId: String(npcId),
    });

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

    // Exercise the handler->Gaia boundary against a synchronized ripe plant if
    // the packaged snapshot contains one. Fresh production-parity snapshots are
    // expected to satisfy this; explicit opt-out is only for minimal unit stacks.
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
      const plant = plants[0];
      const plantPosition = plant.position.v;
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({
            v: [
              plantPosition[0] + 0.5,
              plantPosition[1],
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
            plant_id: plant.id,
            position: plantPosition.map(Math.floor),
          })
        )
      );
      const queued = await waitFor(
        "harvest action queued in ECS",
        () => authoritativeEntity(first.page, plant.id),
        ({ entity }) =>
          entity?.farming_plant_component?.player_actions?.some(
            (action) => action.kind === "harvest"
          ),
        acceptanceGateMs
      );
      const materialized = await waitFor(
        "Gaia harvest materializes native drop",
        async () => ({
          plant: await authoritativeEntity(first.page, plant.id),
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
        name: "ripe crop harvest through Gaia",
        eventKind: "harvestPlantEvent",
        status: "pass",
        queuedMs: queued.elapsedMs,
        materializedMs: materialized.elapsedMs,
      });
    } else if (process.env.HARTHMERE_E2E_ALLOW_NO_RIPE_PLANT === "1") {
      report.scenarios.push({
        name: "ripe crop harvest through Gaia",
        status: "skipped",
        reason: "no synchronized fully-grown plant in minimal test world",
      });
    } else {
      throw new Error(
        "No synchronized fully-grown plant was available; production-shaped E2E requires a ripe crop fixture"
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
