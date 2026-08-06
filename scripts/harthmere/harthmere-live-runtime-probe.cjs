#!/usr/bin/env node
"use strict";

/**
 * HARTHMERE_LIVE_RUNTIME_PROBE
 *
 * Shared Playwright helpers for tests that must prove the real browser page
 * loaded the Harthmere runtime, not a marketing page, login shell, compile
 * overlay, or stale bundle.
 */

const path = require("path");
const {
  acquireBrowserRuntimeLease,
} = require("./browser-runtime-lease.cjs");

const LEASED_PLAYWRIGHT = Symbol("harthmereLeasedPlaywright");

function firstConfiguredValue(...values) {
  return values.find((value) => String(value || "").trim());
}

function browserRuntimeLeaseInput(input = {}) {
  const configuredUrl = firstConfiguredValue(
    input.baseUrl,
    process.env.HARTHMERE_E2E_BASE_URL,
    process.env.HARTHMERE_E2E_URL,
    process.env.HARTHMERE_QUEST_MARKER_VISUAL_BASE_URL,
    process.env.HARTHMERE_GROVE_NPC_VISUAL_BASE_URL,
    process.env.BUILDING_SYSTEM_BROWSER_URL,
    process.env.HARTHMERE_BASE_URL,
    "http://127.0.0.1:3017"
  );
  let baseUrl = configuredUrl;
  let querySyncBaseUrl;
  try {
    const parsed = new URL(configuredUrl);
    baseUrl = parsed.origin;
    querySyncBaseUrl = parsed.searchParams.get("syncBaseUrl");
  } catch {}
  return {
    runner: input.runner || path.basename(process.argv[1] || "browser-e2e"),
    runId: input.runId,
    leaseRoot: input.leaseRoot,
    legacyLockPath: input.legacyLockPath,
    waitTimeoutMs: input.waitTimeoutMs,
    pollMs: input.pollMs,
    baseUrl,
    syncBaseUrl: firstConfiguredValue(
      input.syncBaseUrl,
      process.env.HARTHMERE_E2E_SYNC_BASE_URL,
      querySyncBaseUrl,
      "http://127.0.0.1:4907"
    ),
  };
}

function leasePlaywright(playwright, input = {}) {
  if (!playwright?.chromium || playwright[LEASED_PLAYWRIGHT]) {
    return playwright;
  }
  const originalLaunch = playwright.chromium.launch.bind(playwright.chromium);
  const chromium = Object.create(playwright.chromium);
  chromium.launch = async (...args) => {
    const lease = acquireBrowserRuntimeLease(
      browserRuntimeLeaseInput(input)
    );
    let browser;
    try {
      browser = await originalLaunch(...args);
    } catch (error) {
      lease.release();
      throw error;
    }
    const originalClose = browser.close.bind(browser);
    let closed = false;
    browser.close = async (...closeArgs) => {
      try {
        return await originalClose(...closeArgs);
      } finally {
        if (!closed) {
          closed = true;
          lease.release();
        }
      }
    };
    return browser;
  };
  return Object.assign(Object.create(playwright), playwright, {
    chromium,
    [LEASED_PLAYWRIGHT]: true,
  });
}

function resolvePlaywright(root) {
  const candidates = [
    path.join(root, "node_modules", "playwright"),
    path.join(root, "node_modules", "@playwright/test"),
    "playwright",
    "@playwright/test",
  ];
  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      if (mod.chromium) return leasePlaywright(mod);
    } catch (_) {}
  }
  return null;
}

function fixtureMovementCases() {
  return [
    {
      id: "north_gate_large_flag_fixture",
      district: "North Gate",
      assetHints: ["obj_flag_large_red", "flag_large", "large imported flag"],
      reason: "reported North Gate flag/fixture should be solid",
      requireActualMovement: true,
    },
    {
      id: "north_gate_ground_lamp_fixture",
      district: "North Gate",
      assetHints: ["obj_lamp_ground_large", "obj_lamp_ground_small", "ground lamp", "brazier"],
      reason: "reported small North Gate imported structure should be solid",
      requireActualMovement: true,
    },
    {
      id: "market_square_fountain_side_graphic",
      district: "Market Square",
      assetHints: ["fountain_round_detail", "fountain_center", "obj_lamp_ground_small", "Bridge Fountain"],
      reason: "reported graphic next to town square fountain should be solid",
      requireActualMovement: true,
    },
    {
      id: "temple_green_church_body",
      district: "Temple Green",
      assetHints: ["obj_church_iso", "obj_church_base_lower", "Ivory chapel", "church"],
      reason: "reported church imported graphics should be solid",
      requireActualMovement: true,
    },
    {
      id: "temple_green_church_fence_wall",
      district: "Temple Green",
      assetHints: ["obj_church_grave_wall", "obj_church_grave_fence", "cemetery", "grave fence"],
      reason: "church/cemetery boundary graphics should be solid",
      requireActualMovement: true,
    },
  ];
}

function fixtureOverlayViewpoints() {
  return [
    {
      id: "north_gate_fixtures",
      district: "North Gate",
      targets: ["obj_flag_large_red", "obj_lamp_ground_large", "obj_lamp_ground_small"],
      requireAttachedVisuals: true,
    },
    {
      id: "market_fountain_fixtures",
      district: "Market Square",
      targets: ["fountain_round", "fountain_round_detail", "fountain_center", "obj_lamp_ground_small"],
      requireAttachedVisuals: true,
    },
    {
      id: "temple_church_fixtures",
      district: "Temple Green",
      targets: ["obj_church_iso", "obj_church_base_lower", "obj_church_grave_wall", "obj_church_grave_fence"],
      requireAttachedVisuals: true,
    },
  ];
}

async function collectRuntimeProbe(page) {
  return await page.evaluate(() => {
    const g = globalThis;
    const bodyText = document.body?.innerText || "";
    const obstacleList = Array.isArray(g.__harthmereNpcCollisionObstacles)
      ? g.__harthmereNpcCollisionObstacles
      : [];
    const stats = g.__harthmereHorizontalPlayerTownCollisionStats || null;
    const townAudit = g.__harthmereTownAudit || null;
    const collisionE2E = g.__harthmereCollisionE2E || null;
    const overlayAudit = g.__harthmereCollisionOverlayAudit || null;
    return {
      href: location.href,
      title: document.title,
      bodySample: bodyText.slice(0, 700),
      hasCanvas: Boolean(document.querySelector("canvas")),
      canvasCount: document.querySelectorAll("canvas").length,
      hasHarthmereText: /harthmere/i.test(bodyText),
      hasCompileOverlay: /Failed to compile|Module build failed|defined multiple times|SyntaxError|TypeError:/.test(bodyText),
      hasNpcCollisionObstacles: Array.isArray(g.__harthmereNpcCollisionObstacles),
      obstacleCount: obstacleList.length,
      obstacleSample: obstacleList.slice(0, 5).map((o) => ({
        name: o?.name,
        asset: o?.asset,
        district: o?.district,
        collisionProfile: o?.collisionProfile,
        collisionHardness: o?.collisionHardness,
        playerCanWalkThrough: o?.playerCanWalkThrough,
      })),
      hasTownAudit: Boolean(townAudit),
      townAuditKeys: townAudit && typeof townAudit === "object" ? Object.keys(townAudit).sort() : [],
      hasCollisionE2E: Boolean(collisionE2E),
      collisionE2EKeys: collisionE2E && typeof collisionE2E === "object" ? Object.keys(collisionE2E).sort() : [],
      hasOverlayAudit: Boolean(overlayAudit),
      overlayAuditKeys: overlayAudit && typeof overlayAudit === "object" ? Object.keys(overlayAudit).sort() : [],
      hasStats: Boolean(stats),
      stats,
      hasRendererDebug: Boolean(g.__harthmereRendererDebug),
      hasTownWalkDebug: Boolean(g.__harthmereTownWalkDebug),
      localStorageKeys: (() => {
        try {
          return Object.keys(localStorage).filter((key) => /harthmere|biomes/i.test(key)).slice(0, 30);
        } catch (_) {
          return [];
        }
      })(),
    };
  });
}

function runtimeLooksLoaded(probe) {
  return Boolean(
    probe.hasNpcCollisionObstacles ||
    probe.obstacleCount > 0 ||
    probe.hasTownAudit ||
    probe.hasCollisionE2E ||
    probe.hasOverlayAudit ||
    probe.hasStats ||
    probe.hasRendererDebug ||
    probe.hasTownWalkDebug
  );
}

function formatProbe(probe) {
  return JSON.stringify(probe, null, 2);
}

async function assertNoCompileOverlay(page) {
  const probe = await collectRuntimeProbe(page);
  if (probe.hasCompileOverlay) {
    throw new Error(`Browser compile/runtime overlay detected:\n${formatProbe(probe)}`);
  }
  return probe;
}

async function waitForHarthmereRuntime(page, timeoutMs) {
  const started = Date.now();
  let lastProbe = null;

  while (Date.now() - started < timeoutMs) {
    lastProbe = await collectRuntimeProbe(page);
    if (lastProbe.hasCompileOverlay) {
      throw new Error(`Browser compile/runtime overlay detected:\n${formatProbe(lastProbe)}`);
    }
    if (runtimeLooksLoaded(lastProbe)) {
      return lastProbe;
    }
    await page.waitForTimeout(750).catch(() => null);
  }

  return lastProbe || await collectRuntimeProbe(page);
}

function movementReportProvesActualMovement(result) {
  if (!result || typeof result !== "object") return false;
  if (result.actualMovementVerified === true || result.movementVerified === true || result.usedActualMovement === true) {
    return true;
  }
  const results = Array.isArray(result.results) ? result.results : [];
  return results.length > 0 && results.every((item) =>
    item &&
    item.ok === true &&
    (
      item.actualMovementVerified === true ||
      item.movementVerified === true ||
      item.usedActualMovement === true ||
      item.beforePosition && item.afterPosition && item.blockedByMovement === true
    )
  );
}

module.exports = {
  browserRuntimeLeaseInput,
  leasePlaywright,
  resolvePlaywright,
  fixtureMovementCases,
  fixtureOverlayViewpoints,
  collectRuntimeProbe,
  runtimeLooksLoaded,
  formatProbe,
  assertNoCompileOverlay,
  waitForHarthmereRuntime,
  movementReportProvesActualMovement,
};
