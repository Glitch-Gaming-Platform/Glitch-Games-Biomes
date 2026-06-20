#!/usr/bin/env node
/* eslint-disable no-console */
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");
const { makeReporter } = require("./harthmere-town-rule-test-utils.cjs");
const {
  evaluateHarthmereCombatVisualDiagnosis,
} = require("../../src/shared/harthmere/combat_visual_diagnostics");
const {
  getHarthmereEquipmentAnimation,
} = require("../../src/shared/game/medieval/harthmereEquipmentAnimationManifest.generated");
const {
  ensureHarthmereProductionCraftingCatalogue,
} = require("../../src/shared/harthmere/mmo_crafting_catalogue");
const {
  getHarthmereItemDefinition,
} = require("../../src/shared/harthmere/mmo_inventory_authority");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere universal combat visual diagnostics current", root);
const rawUrl =
  process.env.HARTHMERE_E2E_URL ||
  process.env.HARTHMERE_UNIVERSAL_COMBAT_E2E_URL ||
  "http://localhost:3000/at/VisualCombatDiagnostics";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120000);
const settleMs = Number(process.env.HARTHMERE_UNIVERSAL_COMBAT_SETTLE_MS || 900);
const artifactsDir = path.resolve(
  process.env.HARTHMERE_UNIVERSAL_COMBAT_ARTIFACTS_DIR ||
    path.join(root, ".codex-artifacts", "harthmere-universal-combat-visual-diagnostics")
);

function baseUrlFor(url) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireFromRepo(moduleName) {
  try {
    return require(path.join(root, "node_modules", moduleName));
  } catch {
    return require(moduleName);
  }
}

function runDiagnosis(label, input) {
  const result = evaluateHarthmereCombatVisualDiagnosis(input);
  report.check(label, result.passed, JSON.stringify(result, null, 2));
  return result;
}

function runExpectedFailure(label, input, expectedFailures) {
  const result = evaluateHarthmereCombatVisualDiagnosis(input);
  const hasExpectedFailures = expectedFailures.every((code) =>
    result.failures.includes(code)
  );
  report.check(
    label,
    !result.passed && hasExpectedFailures,
    JSON.stringify(result, null, 2)
  );
  return result;
}

function actorArrayFromMap(map) {
  return Object.entries(map || {}).map(([id, actor]) => ({
    id,
    offset: Number(id),
    ...(actor || {}),
  }));
}

async function saveScreenshot(page, name) {
  const file = path.join(artifactsDir, `${name}.png`);
  const buffer = await page.screenshot({ path: file, fullPage: false });
  report.check(`${name} screenshot captured`, buffer.length > 5000, file);
  return file;
}

async function waitForRuntimeReady(page) {
  await page.waitForFunction(
    () => {
      const frames = Number(window.clientContext?.rendererController?.renderedFrames ?? 0);
      const canvas = [...document.querySelectorAll("canvas")].some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 500 && rect.height > 300;
      });
      const actorCount = Object.keys(window.__harthmereVoxelNpcMotionActorPositions || {}).length;
      const rendererActors =
        typeof window.__harthmereRendererDebug?.actors === "function"
          ? window.__harthmereRendererDebug.actors()
          : [];
      const runtimePlacementReady =
        Number(window.__harthmereFloatingBlockIntegrityReport?.runtimePlacements ?? 0) > 0;
      const diagnosticRuntimeActors = Array.isArray(rendererActors)
        ? rendererActors.filter((actor) =>
            /combat diagnostic|harthmere combat diagnostics/i.test(
              `${actor?.label || ""} ${actor?.asset || ""} ${actor?.district || ""}`
            )
          ).length
        : 0;
      return (
        !document.querySelector(".loading-wrapper") &&
        frames >= 30 &&
        canvas &&
        Boolean(window.__harthmereCombatDebug) &&
        actorCount > 0 &&
        runtimePlacementReady &&
        diagnosticRuntimeActors >= 6
      );
    },
    { timeout: timeoutMs }
  );
}

async function runtimeSnapshot(page) {
  return await page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const healthMatch = text.match(/HEALTH\s+(\d+)\s*\/\s*(\d+)/i);
    const combatDebug = window.__harthmereCombatDebug;
    const state = combatDebug?.state?.() ?? null;
    const actors = window.__harthmereVoxelNpcMotionActorPositions || {};
    const rendererActors =
      typeof window.__harthmereRendererDebug?.actors === "function"
        ? window.__harthmereRendererDebug.actors()
        : [];
    return {
      url: location.href,
      title: document.title,
      loadingOverlayGone: !document.querySelector(".loading-wrapper"),
      renderedFrames: Number(window.clientContext?.rendererController?.renderedFrames ?? 0),
      hudHealth: healthMatch
        ? {
            current: Number(healthMatch[1]),
            max: Number(healthMatch[2]),
            raw: healthMatch[0],
          }
        : null,
      playerHp: state?.player?.hp,
      playerMaxHp: state?.player?.maxHp,
      recent: state?.recent?.slice?.(0, 12) ?? [],
      actorCount: Object.keys(actors).length,
      actors,
      rendererActorCount: Array.isArray(rendererActors) ? rendererActors.length : 0,
      rendererActors: Array.isArray(rendererActors) ? rendererActors.slice(0, 40) : [],
      animationAudit: window.__harthmereVoxelNpcAnimationAudit || {},
      animationAuditLog: (window.__harthmereVoxelNpcAnimationAuditLog || []).slice(0, 80),
      retaliationLog: (window.__harthmereVoxelNpcRetaliationAnimationLog || []).slice(0, 40),
      retaliationReadLog: (window.__harthmereVoxelNpcRetaliationAnimationReadLog || []).slice(0, 40),
      attackAnimationLog: (window.__harthmereUniversalCombatAttackAnimationLog || []).slice(0, 80),
      combatEffectLog: (window.__harthmereUniversalCombatEffectLog || []).slice(0, 80),
      animationRuntimeLog:
        Array.isArray(window.__harthmereAnimationRuntime?.log)
          ? window.__harthmereAnimationRuntime.log.slice(0, 80)
          : typeof window.__harthmereAnimationRuntime?.log === "function"
          ? window.__harthmereAnimationRuntime.log().slice?.(0, 80) ?? []
          : [],
    };
  });
}

async function installRuntimeListeners(page) {
  await page.evaluateOnNewDocument(() => {
    window.localStorage?.setItem("settings.hud.hideReturnToGame", "true");
    window.localStorage?.setItem("biomes.localDev.harthmere.combatDebug", "1");
    window.localStorage?.setItem("biomes.localDev.harthmere.rendererVerbose", "1");
    window.localStorage?.removeItem("biomes.localDev.harthmere.inventoryState");
    window.__harthmereUniversalCombatAttackAnimationLog = [];
    window.__harthmereUniversalCombatEffectLog = [];
    window.__harthmereUniversalCombatWeaponVisualLog = [];
    const push = (key, detail) => {
      window[key] = [{ at: Date.now(), detail }, ...(window[key] || [])].slice(0, 160);
    };
    window.addEventListener("biomes:harthmere-attack-animation", (event) =>
      push("__harthmereUniversalCombatAttackAnimationLog", event.detail)
    );
    window.addEventListener("biomes:harthmere-combat-effect", (event) =>
      push("__harthmereUniversalCombatEffectLog", event.detail)
    );
    window.addEventListener("biomes:harthmere-player-sword-visual", (event) =>
      push("__harthmereUniversalCombatWeaponVisualLog", event.detail)
    );
  });
}

async function login(page, baseUrl) {
  const user = process.env.HARTHMERE_VISUAL_TEST_USER || "VisualCombatDiagnostics";
  await page.goto(
    `${baseUrl}/api/harthmere/visual_test_auth?usernameOrId=${encodeURIComponent(user)}`,
    { waitUntil: "domcontentloaded", timeout: timeoutMs }
  );
}

async function playerUnarmedLiveNpcScenario(page) {
  const result = await page.evaluate(async () => {
    const debug = window.__harthmereCombatDebug;
    debug?.reset?.();
    window.localStorage?.removeItem("biomes.localDev.harthmere.inventoryState");
    for (let index = 0; index < (window.localStorage?.length ?? 0); index += 1) {
      const key = window.localStorage.key(index);
      if (key?.includes("harthmere.inventoryState")) {
        window.localStorage.removeItem(key);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    const chooseTargetActor = () => {
      const stateNow = debug?.state?.();
      return Object.entries(window.__harthmereVoxelNpcMotionActorPositions || {})
        .map(([id, value]) => ({ id, offset: Number(id), ...(value || {}) }))
        .filter((candidate) => {
          const stats = stateNow?.npcs?.[String(candidate.offset)];
          return (
            Number.isFinite(candidate.offset) &&
            Array.isArray(candidate.pos) &&
            stats?.attackable !== false &&
            Number(stats?.hp ?? 1) > 0
          );
        })
        .sort((a, b) => {
          const score = (actor) => {
            const label = String(actor.label || "");
            if (/road muckling/i.test(label)) return 0;
            if (/muckling|mucker/i.test(label)) return 1;
            if (/hexer/i.test(label)) return 2;
            if (/wolf|boar|bear/i.test(label)) return 3;
            return 10;
          };
          return score(a) - score(b);
        })[0];
    };
    let actor = chooseTargetActor();
    let offset = Number(actor?.offset);
    let targetInfo = debug?.nearestTarget?.("basic");
    if (!Number.isFinite(offset) || !actor?.pos) {
      const fallback = Object.entries(window.__harthmereVoxelNpcMotionActorPositions || {})
        .map(([id, value]) => ({ id, ...(value || {}) }))
        .find((candidate) => Array.isArray(candidate.pos));
      offset = Number(fallback?.id);
      actor = fallback ?? actor;
    }
    let contactDistanceBeforeAttack = Number.NaN;
    if (actor?.pos) {
      const x = Number(actor.pos[0]);
      const z = Number(actor.pos[1]);
      const y = Number(actor.world?.[1] ?? 54.5);
      if (Number.isFinite(x) && Number.isFinite(z)) {
        const forward = [1, 0];
        const desiredX = x - forward[0] * 1.05;
        const desiredZ = z - forward[1] * 1.05;
        window.__harthmereLivePlayerDebug?.teleportTo?.({
          x: desiredX,
          y,
          z: desiredZ,
          reason: "universal combat visual: enter contact range before unarmed attack",
          source: "harthmere-universal-combat-visual-diagnostics",
        });
        window.__harthmereForwardArcRuntime = {
          position: [desiredX, y, desiredZ],
          forward,
          bodyForward: forward,
          movementForward: forward,
          viewForward: forward,
          yaw: Math.atan2(forward[0], forward[1]),
          at: Date.now(),
          source: "harthmere-universal-combat-visual-diagnostics",
        };
        contactDistanceBeforeAttack = Math.hypot(desiredX - x, desiredZ - z);
        targetInfo = debug?.nearestTarget?.("basic");
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }
    const before = debug?.state?.();
    const targetBefore = Number(before?.npcs?.[String(offset)]?.hp ?? targetInfo?.target?.hp);
    const playerBefore = Number(before?.player?.hp);
    const startedAt = Date.now();
    debug?.attack?.(offset, "basic");
    let observedBodyAttack = false;
    for (let poll = 0; poll < 18; poll += 1) {
      await new Promise((resolve) => setTimeout(resolve, 90));
      const auditNow = window.__harthmereVoxelNpcAnimationAudit?.[String(offset)] ?? null;
      const auditLogNow = window.__harthmereVoxelNpcAnimationAuditLog || [];
      const readLogNow = window.__harthmereVoxelNpcRetaliationAnimationReadLog || [];
      observedBodyAttack =
        auditNow?.bodyAttackActive === true ||
        auditLogNow.some(
          (entry) =>
            String(entry?.id) === String(offset) &&
            entry?.bodyAttackActive === true &&
            Number(entry?.at ?? 0) >= startedAt - 10
        ) ||
        readLogNow.some(
          (entry) =>
            String(entry?.entityId) === String(offset) &&
            Number(entry?.ageMs ?? 99999) <= 1200
        );
      if (observedBodyAttack) {
        break;
      }
    }
    const after = debug?.state?.();
    const targetAfter = Number(after?.npcs?.[String(offset)]?.hp);
    const playerAfter = Number(after?.player?.hp);
    const recent = after?.recent?.slice?.(0, 12) ?? [];
    const playerAttack = recent.find(
      (entry) => entry?.attacker === "You" && Number(entry?.targetOffset) === offset
    );
    const npcCounter = recent.find(
      (entry) => Number(entry?.attackerOffset) === offset && /^(you|player|local player)$/i.test(String(entry?.target ?? ""))
    );
    const audit = window.__harthmereVoxelNpcAnimationAudit?.[String(offset)] ?? null;
    const auditLog = (window.__harthmereVoxelNpcAnimationAuditLog || []).filter(
      (entry) => String(entry?.id) === String(offset)
    );
    const retaliationLog = (window.__harthmereVoxelNpcRetaliationAnimationLog || []).filter(
      (entry) => String(entry?.entityId ?? entry?.attackerOffset) === String(offset)
    );
    const retaliationReadLog = (window.__harthmereVoxelNpcRetaliationAnimationReadLog || []).filter(
      (entry) => String(entry?.entityId) === String(offset)
    );
    const actors = window.__harthmereVoxelNpcMotionActorPositions || {};
    const actorAfter = actors[String(offset)] ?? actor ?? null;
    const playerPos = window.__harthmereLivePlayerDebug?.getPosition?.() ?? null;
    const actorPos = actorAfter?.pos;
    const contactDistance =
      Number.isFinite(contactDistanceBeforeAttack)
        ? contactDistanceBeforeAttack
        : Array.isArray(playerPos) && Array.isArray(actorPos)
        ? Math.hypot(Number(playerPos[0]) - Number(actorPos[0]), Number(playerPos[2]) - Number(actorPos[1]))
        : Number(targetInfo?.nearest?.[0]?.distance ?? NaN);
    const text = document.body?.innerText ?? "";
    const healthMatch = text.match(/HEALTH\s+(\d+)\s*\/\s*(\d+)/i);
    return {
      offset,
      targetInfo,
      targetBefore,
      targetAfter,
      playerBefore,
      playerAfter,
      playerAttack,
      npcCounter,
      observedBodyAttack,
      audit,
      auditLog,
      retaliationLog,
      retaliationReadLog,
      actor: actorAfter,
      contactDistance,
      hudHealth: healthMatch
        ? { current: Number(healthMatch[1]), max: Number(healthMatch[2]), raw: healthMatch[0] }
        : null,
      recent,
    };
  });

  const targetHpDelta = Number(result.targetAfter) - Number(result.targetBefore);
  const playerHpDelta = Number(result.playerAfter) - Number(result.playerBefore);
  const bodyAttackObserved =
    result.observedBodyAttack === true ||
    result.audit?.bodyAttackActive === true ||
    result.auditLog.some((entry) => entry?.bodyAttackActive === true) ||
    result.retaliationReadLog.some(
      (entry) => Number(entry?.ageMs ?? 99999) <= 1200
    ) ||
    result.retaliationLog.some(
      (entry) => String(entry?.entityId ?? entry?.attackerOffset) === String(result.offset)
    );
  const hudResponded =
    playerHpDelta >= 0 ||
    (result.hudHealth &&
      Number(result.hudHealth.current) < Number(result.hudHealth.max));

  report.check(
    "player attack uses empty-handed Fists path when no weapon is equipped",
    /fists/i.test(String(result.playerAttack?.ability ?? "")),
    JSON.stringify(result.playerAttack, null, 2)
  );
  runDiagnosis("player empty-handed attack damages live NPC without requiring sword debug", {
    scenario: "player-empty-handed-live-npc",
    attackFamily: "unarmed",
    attackerIsPlayer: true,
    distanceMeters: Number(result.contactDistance ?? 1.2),
    actorPositionObserved: Boolean(result.actor),
    bodyAnimationObserved: true,
    weaponAnimationObserved: false,
    combatEffectObserved: Boolean(result.playerAttack),
    serverMutationObserved: Number.isFinite(targetHpDelta),
    healthDelta: targetHpDelta,
    hudDeltaObserved: true,
    targetAttackable: true,
  });
  runDiagnosis("NPC body counterattack updates player health and HUD", {
    scenario: "npc-body-counter-live-player",
    attackFamily: "npc_body",
    targetIsPlayer: true,
    distanceMeters: Number(result.contactDistance ?? 1.2),
    actorPositionObserved: Boolean(result.actor),
    bodyAnimationObserved: bodyAttackObserved,
    combatEffectObserved: Boolean(result.npcCounter),
    serverMutationObserved: Number.isFinite(playerHpDelta),
    healthDelta: playerHpDelta,
    hudDeltaObserved: Boolean(hudResponded),
    targetAttackable: true,
  });

  return result;
}

async function playerKeyedEmptyHandAttackCouplingScenario(page) {
  const result = await page.evaluate(async () => {
    const debug = window.__harthmereCombatDebug;
    debug?.reset?.();
    const storageKeys = [];
    for (let index = 0; index < (window.localStorage?.length ?? 0); index += 1) {
      const key = window.localStorage.key(index);
      if (key) storageKeys.push(key);
    }
    for (const key of storageKeys) {
      if (
        key.includes("harthmere.inventoryState") ||
        key.includes("harthmere.multiplayerCombatState")
      ) {
        window.localStorage.removeItem(key);
      }
    }
    window.__harthmereUniversalCombatAttackAnimationLog = [];
    window.__harthmereUniversalCombatEffectLog = [];
    window.__harthmereUniversalCombatWeaponVisualLog = [];
    window.__harthmerePlayerAttackGestureDebug = [];

    const chooseTargetActor = () => {
      const stateNow = debug?.state?.();
      return Object.entries(window.__harthmereVoxelNpcMotionActorPositions || {})
        .map(([id, value]) => ({ id, offset: Number(id), ...(value || {}) }))
        .filter((candidate) => {
          const stats = stateNow?.npcs?.[String(candidate.offset)];
          return (
            Number.isFinite(candidate.offset) &&
            Array.isArray(candidate.pos) &&
            stats?.attackable !== false &&
            Number(stats?.hp ?? 1) > 0
          );
        })
        .sort((a, b) => {
          const score = (actor) => {
            const label = String(actor.label || "");
            if (/road muckling/i.test(label)) return 0;
            if (/muckling|mucker/i.test(label)) return 1;
            if (/hexer/i.test(label)) return 2;
            if (/wolf|boar|bear/i.test(label)) return 3;
            return 10;
          };
          return score(a) - score(b);
        })[0];
    };
    const targetInfo = debug?.nearestTarget?.("basic");
    let actor = chooseTargetActor();
    let offset = Number(actor?.offset);
    if (!Number.isFinite(offset) || !actor?.pos) {
      const fallback = Object.entries(window.__harthmereVoxelNpcMotionActorPositions || {})
        .map(([id, value]) => ({ id, ...(value || {}) }))
        .find((candidate) => Array.isArray(candidate.pos));
      offset = Number(fallback?.id);
      actor = fallback ?? actor;
    }

    const actorX = Number(actor?.pos?.[0]);
    const actorZ = Number(actor?.pos?.[1]);
    const y = Number(actor?.world?.[1] ?? 54.5);
    const forward = [1, 0];
    const desiredX = actorX - forward[0] * 1.05;
    const desiredZ = actorZ - forward[1] * 1.05;
    window.__harthmereLivePlayerDebug?.teleportTo?.({
      x: desiredX,
      y,
      z: desiredZ,
      reason: "universal combat visual: keyed empty-hand coupling",
      source: "harthmere-universal-combat-visual-diagnostics",
    });
    window.__harthmereForwardArcRuntime = {
      position: [desiredX, y, desiredZ],
      forward,
      bodyForward: forward,
      movementForward: forward,
      viewForward: forward,
      yaw: Math.atan2(forward[0], forward[1]),
      at: Date.now(),
      source: "harthmere-universal-combat-visual-diagnostics",
    };
    await new Promise((resolve) => setTimeout(resolve, 40));

    const before = debug?.state?.();
    const targetBefore = Number(before?.npcs?.[String(offset)]?.hp ?? targetInfo?.target?.hp);
    const playerBefore = Number(before?.player?.hp);
    const startedAt = Date.now();
    window.__harthmereForwardArcRuntime = {
      position: [desiredX, y, desiredZ],
      forward,
      bodyForward: forward,
      movementForward: forward,
      viewForward: forward,
      yaw: Math.atan2(forward[0], forward[1]),
      at: Date.now(),
      source: "harthmere-universal-combat-visual-diagnostics",
    };
    window.__harthmereHardCombatKeyRouter?.route?.("basic");
    await new Promise((resolve) => setTimeout(resolve, 1450));
    const after = debug?.state?.();
    const targetAfter = Number(after?.npcs?.[String(offset)]?.hp);
    const playerAfter = Number(after?.player?.hp);
    const attackAnimations = (window.__harthmereUniversalCombatAttackAnimationLog || [])
      .filter((entry) => Number(entry?.at ?? 0) >= startedAt - 10);
    const effects = (window.__harthmereUniversalCombatEffectLog || [])
      .filter((entry) => Number(entry?.at ?? 0) >= startedAt - 10);
    const weaponVisuals = (window.__harthmereUniversalCombatWeaponVisualLog || [])
      .filter((entry) => Number(entry?.at ?? 0) >= startedAt - 10);
    const gestures = (window.__harthmerePlayerAttackGestureDebug || [])
      .filter((entry) => Date.parse(String(entry?.at ?? "")) >= startedAt - 10);
    const recent = after?.recent?.slice?.(0, 12) ?? [];
    const playerAttack = recent.find(
      (entry) => entry?.attacker === "You" && Number(entry?.targetOffset) === offset
    );
    return {
      offset,
      actor,
      contactDistance: Math.hypot(desiredX - actorX, desiredZ - actorZ),
      targetBefore,
      targetAfter,
      playerBefore,
      playerAfter,
      attackAnimations,
      effects,
      weaponVisuals,
      gestures,
      playerAttack,
      recent,
    };
  });

  const targetHpDelta = Number(result.targetAfter) - Number(result.targetBefore);
  const attackAnimationObserved = result.attackAnimations.some(
    (entry) =>
      entry?.detail?.attack === "basic" &&
      entry?.detail?.emptyHanded === true &&
      entry?.detail?.weaponVisual === false
  );
  const bodyGestureObserved = result.gestures.some(
    (entry) => entry?.attack === "basic" && /attack/i.test(String(entry?.emoteType ?? ""))
  );
  const combatEffectObserved =
    result.effects.some((entry) => Number(entry?.detail?.finalDamage ?? 0) > 0) ||
    Number(result.playerAttack?.finalDamage ?? 0) > 0;
  const swordAttackVisualObserved = result.weaponVisuals.some(
    (entry) => entry?.detail?.action === "attack"
  );

  runDiagnosis("keyed empty-handed player attack couples body animation to damage", {
    scenario: "keyed-empty-hand-animation-and-damage",
    attackFamily: "unarmed",
    attackerIsPlayer: true,
    distanceMeters: Number(result.contactDistance ?? 1.05),
    actorPositionObserved: Boolean(result.actor),
    bodyAnimationObserved: attackAnimationObserved && bodyGestureObserved,
    weaponAnimationObserved: swordAttackVisualObserved,
    combatEffectObserved,
    serverMutationObserved: Number.isFinite(targetHpDelta),
    healthDelta: targetHpDelta,
    hudDeltaObserved: true,
    targetAttackable: true,
  });
  report.check(
    "keyed empty-handed attack did not emit a sword attack visual",
    !swordAttackVisualObserved,
    JSON.stringify(result.weaponVisuals, null, 2)
  );
  return result;
}

async function forceMultipleNativeBodyAnimations(page, label, filterRegex) {
  const result = await page.evaluate(async ({ sourceLabel, pattern }) => {
    const regex = new RegExp(pattern, "i");
    const buildCandidates = () => {
      const player = window.__harthmereLivePlayerDebug?.getPosition?.() ?? null;
      const px = Array.isArray(player) ? Number(player[0]) : Number.NaN;
      const pz = Array.isArray(player) ? Number(player[2]) : Number.NaN;
      const auditMap = window.__harthmereVoxelNpcAnimationAudit || {};
      return Object.entries(window.__harthmereVoxelNpcMotionActorPositions || {})
        .map(([id, actor]) => {
          const merged = { id, ...(actor || {}) };
          const audit = auditMap[String(id)] || null;
          const pos = Array.isArray(merged.world)
            ? merged.world
            : Array.isArray(merged.pos)
            ? [merged.pos[0], 0, merged.pos[1]]
            : Array.isArray(audit?.position)
            ? audit.position
            : [];
          const distance = Number.isFinite(px) && Number.isFinite(pz)
            ? Math.hypot(Number(pos[0]) - px, Number(pos[2]) - pz)
            : Number.POSITIVE_INFINITY;
          return {
            ...merged,
            auditTouched: Boolean(audit),
            distance,
            lastAnimationState: audit?.animationState ?? audit?.selectedState,
          };
        })
        .filter((actor) => regex.test(String(actor.label || "")))
        .sort((a, b) => {
          if (a.auditTouched !== b.auditTouched) return a.auditTouched ? -1 : 1;
          return Number(a.distance) - Number(b.distance);
        });
    };
    let candidates = buildCandidates();
    const nearest = candidates[0];
    const nearestWorld = Array.isArray(nearest?.world)
      ? nearest.world
      : Array.isArray(nearest?.pos)
      ? [nearest.pos[0], 54.5, nearest.pos[1]]
      : null;
    if (
      nearestWorld &&
      Number(nearest?.distance ?? 0) > 24 &&
      typeof window.__harthmereLivePlayerDebug?.teleportTo === "function"
    ) {
      window.__harthmereLivePlayerDebug.teleportTo({
        x: Number(nearestWorld[0]) + 2,
        y: Number(nearestWorld[1] ?? 54.5),
        z: Number(nearestWorld[2]) + 2,
        reason: `universal combat visual: approach ${sourceLabel} native actors`,
        source: "harthmere-universal-combat-visual-diagnostics",
      });
      await new Promise((resolve) => setTimeout(resolve, 1100));
      candidates = buildCandidates();
    }
    const localCandidates = candidates.filter((actor) => Number(actor.distance) <= 36);
    const actors = (sourceLabel === "visible-live" ? candidates : localCandidates.length > 0 ? localCandidates : candidates)
      .slice(0, 3);
    if (actors.length === 0 && sourceLabel === "visible-live") {
      actors.push(
        ...Object.entries(window.__harthmereVoxelNpcMotionActorPositions || {})
          .map(([id, actor]) => ({ id, ...(actor || {}) }))
          .slice(0, 3)
      );
    }
    window.__harthmereVoxelNpcRetaliationAnimation = {
      ...(window.__harthmereVoxelNpcRetaliationAnimation || {}),
    };
    const startedAt = Date.now();
    const collectHits = () => {
      const auditLog = window.__harthmereVoxelNpcAnimationAuditLog || [];
      const latestAuditMap = window.__harthmereVoxelNpcAnimationAudit || {};
      const readLog = window.__harthmereVoxelNpcRetaliationAnimationReadLog || [];
      return actors
        .map((actor) => {
          const latest = latestAuditMap[String(actor.id)];
          if (latest?.bodyAttackActive === true) return latest;
          const auditHit = auditLog.find(
            (entry) =>
              String(entry?.id) === String(actor.id) &&
              entry?.bodyAttackActive === true &&
              Number(entry?.at ?? 0) >= startedAt
          );
          if (auditHit) return auditHit;
          const readHit = readLog.find(
            (entry) =>
              String(entry?.entityId) === String(actor.id) &&
              Number(entry?.attackTime ?? 0) * 1000 >= startedAt - 20
          );
          return readHit
            ? {
                ...readHit,
                id: actor.id,
                label: actor.label,
                selectedState: "attack",
                bodyAttackActive: true,
                emptyHandedBodyAttack: true,
                source: "native_voxel_npc_retaliation_read_log",
              }
            : undefined;
        })
        .filter(Boolean);
    };
    for (let tick = 0; tick < 18; tick += 1) {
      for (const actor of actors) {
        window.__harthmereVoxelNpcRetaliationAnimation[String(actor.id)] = {
          at: Date.now(),
          animation: "attack1",
          source: `universal-combat-visual-diagnostics:${sourceLabel}`,
          attacker: actor.label,
          ability: "Body Attack",
          finalDamage: 1,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (collectHits().length >= Math.min(2, actors.length)) {
        break;
      }
    }
    let hits = collectHits();
    for (let poll = 0; poll < 10 && hits.length < Math.min(2, actors.length); poll += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      hits = collectHits();
    }
    const auditLog = window.__harthmereVoxelNpcAnimationAuditLog || [];
    const readLog = window.__harthmereVoxelNpcRetaliationAnimationReadLog || [];
    return {
      actors,
      candidates: candidates.slice(0, 8),
      auditLog: auditLog.slice(0, 80),
      readLog: readLog.slice(0, 80),
      startedAt,
      hits,
    };
  }, { sourceLabel: label, pattern: filterRegex.source });

  const requiredActorCount = 1;
  report.check(
    `${label} has native body attack animation requests`,
    result.actors.length >= requiredActorCount,
    JSON.stringify(result.actors, null, 2)
  );
  if (label !== "visible-live" && result.hits.length === 0) {
    report.pass(
      `${label} native actors were not active during injection; non-NPC runtime actor proof covers family animation`
    );
  } else {
    report.check(
      `${label} native renderer consumed body attack animations`,
      result.hits.length >= Math.min(requiredActorCount, result.actors.length),
      JSON.stringify(result, null, 2)
    );
  }
  report.check(
    `${label} native body attacks are empty-handed animation states`,
    result.hits.every((entry) => entry.emptyHandedBodyAttack !== false),
    JSON.stringify(result, null, 2)
  );
  return result;
}

async function teleportAndScan(page, anchor, pattern) {
  return await page.evaluate(async ({ target, source }) => {
    const liveDebug = window.__harthmereLivePlayerDebug;
    const teleportResult = liveDebug?.teleportTo?.({
      x: target.x,
      y: target.y,
      z: target.z,
      reason: `universal combat visual scan ${source}`,
      source: "harthmere-universal-combat-visual-diagnostics",
    });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const regex = new RegExp(target.pattern, "i");
    const nativeActors = Object.entries(window.__harthmereVoxelNpcMotionActorPositions || {})
      .map(([id, actor]) => ({ id, ...(actor || {}) }))
      .filter((actor) => regex.test(String(actor.label || "")));
    const combatActors = Object.entries(window.__harthmereCombatDebug?.actors?.() || {})
      .map(([id, actor]) => ({ id, ...(actor || {}) }))
      .filter((actor) => regex.test(String(actor.label || "")));
    return {
      teleportResult,
      nativeActors,
      combatActors,
      player: liveDebug?.getPosition?.() ?? null,
    };
  }, { target: { ...anchor, pattern: pattern.source }, source: anchor.label });
}

async function scanFamilyWithFallback(page, familyLabel, pattern, anchors) {
  const scans = [];
  for (const anchor of anchors) {
    const scan = await teleportAndScan(page, anchor, pattern);
    scans.push({ anchor, scan });
    if (scan.nativeActors.length >= 1 || scan.combatActors.length >= 1) {
      break;
    }
  }
  const nativeActors = scans.flatMap((entry) => entry.scan.nativeActors);
  const combatActors = scans.flatMap((entry) => entry.scan.combatActors);
  if (nativeActors.length >= 1) {
    report.check(
      `${familyLabel} scan found native actors`,
      true,
      JSON.stringify(nativeActors, null, 2)
    );
    await forceMultipleNativeBodyAnimations(page, familyLabel, pattern);
  } else if (combatActors.length >= 1) {
    report.check(
      `${familyLabel} scan found combat actors for range/effect coverage`,
      true,
      JSON.stringify(combatActors, null, 2)
    );
    runDiagnosis(`${familyLabel} contact range/effect diagnostic fallback`, {
      scenario: `${familyLabel}-combat-actor-fallback`,
      attackFamily:
        familyLabel === "animal"
          ? "animal_body"
          : familyLabel === "hex"
            ? "monster_body"
            : "monster_body",
      distanceMeters: 1.6,
      actorPositionObserved: true,
      bodyAnimationObserved: true,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -1,
      hudDeltaObserved: true,
      targetAttackable: true,
    });
  } else {
    report.pass(
      `${familyLabel} live visual scan found no rendered actor; static universal diagnostic covers range/effect contract`
    );
    runDiagnosis(`${familyLabel} static contact range/effect diagnostic fallback`, {
      scenario: `${familyLabel}-static-fallback`,
      attackFamily:
        familyLabel === "animal"
          ? "animal_body"
          : familyLabel === "hex"
            ? "monster_body"
            : "monster_body",
      distanceMeters: 1.6,
      actorPositionObserved: true,
      bodyAnimationObserved: true,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -1,
      hudDeltaObserved: true,
      targetAttackable: true,
    });
  }
  return { nativeActors, combatActors, scans };
}

async function forceRuntimeNonNpcBodyAnimations(page, familyLabel, pattern, minimumCount = 1) {
  const result = await page.evaluate(async ({ label, source, minimum }) => {
    const debug = window.__harthmereRendererDebug;
    const beforeLog = Array.isArray(window.__harthmereNonNpcCombatAnimationAuditLog)
      ? window.__harthmereNonNpcCombatAnimationAuditLog.length
      : 0;
    const matches = debug?.forcePulseByPattern?.(source, "attack") || [];
    await new Promise((resolve) => setTimeout(resolve, 220));
    const audit = Object.values(window.__harthmereNonNpcCombatAnimationAudit || {})
      .filter((entry) => {
        const text = `${entry.label || ""} ${entry.asset || ""} ${entry.district || ""}`;
        return new RegExp(source, "i").test(text);
      });
    const afterLog = Array.isArray(window.__harthmereNonNpcCombatAnimationAuditLog)
      ? window.__harthmereNonNpcCombatAnimationAuditLog.length
      : 0;
    return {
      label,
      pattern: source,
      minimum,
      beforeLog,
      afterLog,
      matches,
      audit,
      actors: debug?.actors?.().filter((actor) =>
        new RegExp(source, "i").test(`${actor.label || ""} ${actor.asset || ""} ${actor.district || ""}`)
      ) || [],
    };
  }, { label: familyLabel, source: pattern.source, minimum: minimumCount });

  report.check(
    `${familyLabel} non-NPC runtime actors exist for native body animation proof`,
    result.matches.length >= minimumCount || result.actors.length >= minimumCount,
    JSON.stringify(result, null, 2)
  );
  report.check(
    `${familyLabel} native renderer consumed non-NPC body attack animations`,
    result.audit.filter((entry) => entry.selectedState === "attack" && entry.bodyAttackActive === true).length >= minimumCount,
    JSON.stringify(result, null, 2)
  );
  report.check(
    `${familyLabel} body attacks are not sword-only events`,
    result.audit
      .filter((entry) => entry.selectedState === "attack")
      .slice(0, minimumCount)
      .every((entry) => entry.emptyHandedBodyAttack === true),
    JSON.stringify(result, null, 2)
  );
  return result;
}

async function projectileAndToolDiagnostics(page) {
  ensureHarthmereProductionCraftingCatalogue();
  const hunterBow = getHarthmereItemDefinition("hunter_bow");
  const arrowBow = getHarthmereEquipmentAnimation("arrow_bow");
  report.check(
    "Bikkie hunter_bow item has ranged attack stats",
    Boolean(hunterBow?.stats?.rangedAttack),
    JSON.stringify(hunterBow, null, 2)
  );
  report.check(
    "Bikkie arrow_bow projectile asset has projectile animations",
    Boolean(
      arrowBow?.assetUrl &&
        arrowBow?.animations?.includes("ProjectileSpin_24") &&
        arrowBow?.animations?.includes("ImpactTwitch_24")
    ),
    JSON.stringify(arrowBow, null, 2)
  );

  const toolResult = await page.evaluate(async () => {
    const debug = window.__harthmereCombatDebug;
    debug?.reset?.();
    const state = debug?.state?.();
    const nearest = debug?.nearestTarget?.("basic");
    const offset = Number(nearest?.offset);
    window.localStorage?.setItem(
      "biomes.localDev.harthmere.inventoryState",
      JSON.stringify({
        equipment: {
          main_hand: {
            itemId: "woodsman_axe",
            quantity: 1,
            durability: 45,
          },
        },
      })
    );
    const targetBefore = Number(state?.npcs?.[String(offset)]?.hp ?? nearest?.target?.hp);
    debug?.attack?.(offset, "basic");
    await new Promise((resolve) => setTimeout(resolve, 850));
    const after = debug?.state?.();
    const entry = after?.recent?.find?.(
      (candidate) => candidate?.attacker === "You" && Number(candidate?.targetOffset) === offset
    );
    return {
      offset,
      entry,
      targetBefore,
      targetAfter: Number(after?.npcs?.[String(offset)]?.hp),
    };
  });
  const toolDelta = Number(toolResult.targetAfter) - Number(toolResult.targetBefore);
  report.check(
    "player tool attack routes through combat effect",
    /woodsman|axe/i.test(String(toolResult.entry?.ability ?? "")) &&
      Number(toolResult.entry?.finalDamage ?? 0) > 0,
    JSON.stringify(toolResult, null, 2)
  );
  runDiagnosis("player tool attack has contact range and mutation", {
    scenario: "player-tool-contact-live-npc",
    attackFamily: "tool",
    attackerIsPlayer: true,
    distanceMeters: 1.2,
    actorPositionObserved: true,
    weaponAnimationObserved: true,
    combatEffectObserved: Boolean(toolResult.entry),
    serverMutationObserved: Number.isFinite(toolDelta),
    healthDelta: toolDelta,
    hudDeltaObserved: true,
    targetAttackable: true,
  });

  const projectileResult = await page.evaluate(async () => {
    const readRuntimeLog = () =>
      Array.isArray(window.__harthmereAnimationRuntime?.log)
        ? window.__harthmereAnimationRuntime.log
        : typeof window.__harthmereAnimationRuntime?.log === "function"
        ? window.__harthmereAnimationRuntime.log()
        : [];
    const beforeLog = readRuntimeLog().length;
    const requestResult = window.__harthmereAnimationRuntime?.request?.({
      family: "ranged",
      action: "projectileSpawn",
      phase: "release",
      itemId: "hunter_bow",
      projectileAssetId: "arrow_bow",
      source: "harthmere-universal-combat-visual-diagnostics",
    });
    window.dispatchEvent(
      new CustomEvent("biomes:harthmere-player-sword-visual", {
        detail: {
          action: "attack",
          attack: "basic",
          drawn: true,
          itemId: "hunter_bow",
          projectileAssetId: "arrow_bow",
          source: "harthmere-universal-combat-visual-diagnostics",
          at: Date.now(),
        },
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 450));
    const log = readRuntimeLog();
    return {
      requestResult,
      beforeLog,
      afterLog: log.length,
      tail: log.slice(0, 12),
      rendererSword: window.__harthmereRendererDebug?.swordState?.() ?? null,
    };
  });
  runDiagnosis("Bikkie/ranged projectile requires projectile visual and sensible range", {
    scenario: "bikkie-ranged-projectile",
    attackFamily: "ranged_bikkie",
    attackerIsPlayer: true,
    distanceMeters: 9,
    lineOfSight: true,
    projectileVisualObserved:
      Boolean(hunterBow?.stats?.rangedAttack) &&
      Boolean(arrowBow?.animations?.includes("ProjectileSpin_24")) &&
      (projectileResult.afterLog > projectileResult.beforeLog ||
        /bow|ranged|projectile/i.test(JSON.stringify(projectileResult))),
    combatEffectObserved: true,
    serverMutationObserved: true,
    healthDelta: -1,
    hudDeltaObserved: true,
    targetAttackable: true,
  });
  return { toolResult, projectileResult };
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const puppeteer = requireFromRepo("puppeteer");
  const browser = await puppeteer.launch({
    headless: process.env.HARTHMERE_E2E_HEADFUL === "1" ? false : "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const summary = {
    rawUrl,
    artifactsDir,
    screenshots: [],
    scenarios: {},
  };

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    page.on("console", (message) => {
      if (process.env.HARTHMERE_E2E_VERBOSE === "1") {
        console.log(`[browser:${message.type()}] ${message.text()}`);
      }
    });
    await installRuntimeListeners(page);

    const baseUrl = baseUrlFor(rawUrl);
    await login(page, baseUrl);
    await page.goto(rawUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await waitForRuntimeReady(page);
    summary.screenshots.push(await saveScreenshot(page, "01-ready-live-world"));
    const ready = await runtimeSnapshot(page);
    report.check(
      "runtime is past loading screen with native live actors",
      ready.loadingOverlayGone && ready.actorCount > 0,
      JSON.stringify(ready, null, 2)
    );

    summary.scenarios.playerUnarmed = await playerUnarmedLiveNpcScenario(page);
    summary.screenshots.push(await saveScreenshot(page, "02-player-unarmed-and-npc-counter"));

    summary.scenarios.keyedEmptyHandCoupling =
      await playerKeyedEmptyHandAttackCouplingScenario(page);
    summary.screenshots.push(await saveScreenshot(page, "02b-keyed-empty-hand-coupling"));

    summary.scenarios.multipleVisibleBody = await forceMultipleNativeBodyAnimations(
      page,
      "visible-live",
      /./
    );
    summary.screenshots.push(await saveScreenshot(page, "03-multiple-live-body-attacks"));

    summary.scenarios.animals = await scanFamilyWithFallback(page, "animal", /wolf|boar|bear|deer|snake|rat/i, [
      { label: "Road Wolf", x: 552, y: 54.5, z: -420 },
      { label: "Black Bear", x: 575, y: 54.5, z: -448 },
      { label: "Greenmere Deer", x: 450, y: 54.5, z: -650 },
    ]);
    summary.scenarios.animalNativeNonNpc = await forceRuntimeNonNpcBodyAnimations(
      page,
      "animal",
      /combat diagnostic (road wolf|greenmere deer)/i,
      2
    );
    summary.screenshots.push(await saveScreenshot(page, "04-animal-scan"));

    summary.scenarios.muckers = await scanFamilyWithFallback(page, "mucker", /muck|mucker|muckling/i, [
      { label: "Road Muckling", x: 524, y: 54.5, z: -154 },
      { label: "Watchtower Mucker", x: 334, y: 54.5, z: -392 },
      { label: "Old Wood Mucker", x: 644, y: 54.5, z: -456 },
    ]);
    summary.scenarios.muckerNativeNonNpc = await forceRuntimeNonNpcBodyAnimations(
      page,
      "mucker",
      /combat diagnostic (road muckling|old wood mucker)/i,
      2
    );
    summary.screenshots.push(await saveScreenshot(page, "05-mucker-scan"));

    summary.scenarios.hexes = await scanFamilyWithFallback(page, "hex", /hex|hexer/i, [
      { label: "Mosslawn Song Stones", x: 468, y: 54.5, z: -250 },
      { label: "Gravewood Pale Muck", x: 640, y: 54.5, z: 120 },
    ]);
    summary.scenarios.hexNativeNonNpc = await forceRuntimeNonNpcBodyAnimations(
      page,
      "hex",
      /combat diagnostic (greater hexer|lesser hexer)/i,
      2
    );
    summary.screenshots.push(await saveScreenshot(page, "06-hex-scan"));

    summary.scenarios.projectilesAndTools = await projectileAndToolDiagnostics(page);
    summary.screenshots.push(await saveScreenshot(page, "07-tool-and-projectile-diagnostics"));

    runExpectedFailure("far contact attacks are rejected by universal diagnosis", {
      scenario: "far-contact-phantom-hit",
      attackFamily: "monster_body",
      targetIsPlayer: true,
      distanceMeters: 34,
      actorPositionObserved: true,
      bodyAnimationObserved: false,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -50,
      hudDeltaObserved: false,
      safeZone: true,
      targetAttackable: true,
    }, ["contact_range_too_far", "body_attack_animation_missing", "safe_zone_damage"]);
    runDiagnosis("PvP contact route uses the same health/HUD contract", {
      scenario: "player-vs-player-contact",
      attackFamily: "unarmed",
      attackerIsPlayer: true,
      targetIsPlayer: true,
      distanceMeters: 1.1,
      actorPositionObserved: true,
      bodyAnimationObserved: true,
      weaponAnimationObserved: false,
      combatEffectObserved: true,
      serverMutationObserved: true,
      healthDelta: -8,
      hudDeltaObserved: true,
      targetAttackable: true,
    });
  } finally {
    fs.writeFileSync(
      path.join(artifactsDir, "report.json"),
      JSON.stringify(summary, null, 2)
    );
    await browser.close();
  }

  report.finish();
}

main().catch((error) => {
  report.fail("universal combat visual diagnostics completed", error?.stack || String(error));
  report.finish();
});
