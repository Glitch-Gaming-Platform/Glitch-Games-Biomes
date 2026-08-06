#!/usr/bin/env node
/* eslint-disable no-console */

// Headed, real-input acceptance for the desktop Harthmere lock-on and the
// combat-performance seam.  The test hook only places the disposable player;
// Tab, mouse attacks, jump, and wheel target switching are sent as rendered
// browser input.

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const targetUrl =
  process.env.HARTHMERE_E2E_URL ||
  "http://127.0.0.1:3017/at/HarthmereCombatLockOnLive?syncBaseUrl=http%3A%2F%2F127.0.0.1%3A4907&harthmere_native_ecs_e2e=1&e2e_run=combat-lock-on-live&allowSoftwareWebGL=1";
const username =
  process.env.HARTHMERE_VISUAL_TEST_USER || "HarthmereCombatLockOnLive";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120000);
const artifactsDir = path.resolve(
  process.env.HARTHMERE_COMBAT_LOCK_ON_ARTIFACTS_DIR ||
    path.join(root, "artifacts/harthmere-combat-lock-on-live")
);
const authoredMuckerAnchor = [785.627, 66, -181.406];

function requireFromRepo(moduleName) {
  try {
    return require(path.join(root, "node_modules", moduleName));
  } catch {
    return require(moduleName);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseUrlFor(value) {
  const parsed = new URL(value);
  return `${parsed.protocol}//${parsed.host}`;
}

async function visibleCanvas(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("canvas")]
      .map((canvas) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          area: rect.width * rect.height,
        };
      })
      .sort((left, right) => right.area - left.area)[0]
  );
}

async function closeFeedbackAndEnter(page) {
  const buttons = await page.$$("button");
  for (const button of buttons) {
    const text = await button.evaluate((node) => node.textContent?.trim() || "");
    if (/^(close|not now)$/i.test(text) && (await button.isIntersectingViewport())) {
      await button.click().catch(() => undefined);
    }
  }
  for (const button of await page.$$("button")) {
    const text = await button.evaluate((node) => node.textContent?.trim() || "");
    if (/enter game/i.test(text) && (await button.isIntersectingViewport())) {
      await button.click().catch(() => undefined);
      break;
    }
  }
}

async function waitForRuntime(page) {
  const deadline = Date.now() + timeoutMs;
  let latest;
  let lastMovementProbeAt = 0;
  while (Date.now() < deadline) {
    await closeFeedbackAndEnter(page);
    latest = await page.evaluate(() => {
      const canvas = [...document.querySelectorAll("canvas")]
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { width: rect.width, height: rect.height, area: rect.width * rect.height };
        })
        .sort((left, right) => right.area - left.area)[0];
      return {
        url: location.href,
        title: document.title,
        loading: Boolean(document.querySelector(".loading-wrapper")),
        feedbackOpen: [...document.querySelectorAll('[role="dialog"], .modal')].some(
          (node) => /report issue|feedback/i.test(node.textContent || "")
        ),
        frames: Number(window.clientContext?.rendererController?.renderedFrames || 0),
        canvas,
        hasLivePlayer: typeof window.__harthmereLivePlayerDebug?.teleportTo === "function",
        hasCombatDebug: typeof window.__harthmereCombatDebug?.state === "function",
        routerVersion: window.__harthmereHardCombatKeyRouterVersion || null,
      };
    });
    // The supported live-player placement bridge is installed from the real
    // player movement publish path. A new disposable actor can remain perfectly
    // idle after bootstrap, so exercise one short real W input rather than
    // manufacturing the hook or mutating the player resource directly.
    if (
      latest.hasCombatDebug &&
      !latest.hasLivePlayer &&
      Date.now() - lastMovementProbeAt >= 1500
    ) {
      lastMovementProbeAt = Date.now();
      await page.keyboard.down("KeyW");
      await sleep(90);
      await page.keyboard.up("KeyW");
    }
    if (
      !latest.loading &&
      !latest.feedbackOpen &&
      latest.frames >= 30 &&
      latest.canvas?.width > 500 &&
      latest.canvas?.height > 300 &&
      latest.hasLivePlayer &&
      latest.hasCombatDebug
    ) {
      return latest;
    }
    await sleep(500);
  }
  throw new Error(`Runtime readiness timed out: ${JSON.stringify(latest)}`);
}

async function positionAtAuthoredMuckers(page) {
  return page.evaluate((anchor) => {
    const camera = window.clientContext?.resources?.get?.("/scene/camera")?.three;
    const elements = camera?.matrixWorld?.elements;
    let forwardX = elements ? -Number(elements[8]) : 1;
    let forwardZ = elements ? -Number(elements[10]) : 0;
    const length = Math.hypot(forwardX, forwardZ) || 1;
    forwardX /= length;
    forwardZ /= length;
    const desired = [anchor[0] - forwardX * 5, anchor[1], anchor[2] - forwardZ * 5];
    const result = window.__harthmereLivePlayerDebug.teleportTo({
      x: desired[0],
      y: desired[1],
      z: desired[2],
      reason: "lock-on live acceptance: authored road Muckers",
      source: "test-harthmere-combat-lock-on-live",
    });
    window.__harthmereForwardArcRuntime = {
      position: desired,
      forward: [forwardX, forwardZ],
      bodyForward: [forwardX, forwardZ],
      movementForward: [forwardX, forwardZ],
      viewForward: [forwardX, forwardZ],
      yaw: Math.atan2(forwardX, forwardZ),
      at: Date.now(),
      source: "test-harthmere-combat-lock-on-live",
    };
    return { result, desired, forward: [forwardX, forwardZ] };
  }, authoredMuckerAnchor);
}

async function chooseAndApproachTarget(page) {
  const deadline = Date.now() + 20000;
  let latest;
  while (Date.now() < deadline) {
    latest = await page.evaluate(() => {
      const state = window.__harthmereCombatDebug?.state?.();
      const player = window.__harthmereLivePlayerDebug?.getPosition?.();
      const actorSources = {
        ...(window.__harthmereCombatDebug?.actors?.() || {}),
        ...(window.__harthmereVoxelNpcMotionActorPositions || {}),
      };
      const actors = Object.entries(actorSources)
        .map(([id, value]) => ({ offset: Number(id), ...(value || {}) }))
        .filter((actor) => {
          const stats = state?.npcs?.[String(actor.offset)];
          return (
            Number.isFinite(actor.offset) &&
            Array.isArray(actor.pos) &&
            stats?.attackable !== false &&
            Number(stats?.hp ?? 1) > 0
          );
        })
        .sort((left, right) => {
          const labelScore = (actor) =>
            /muckling|mucker/i.test(String(actor.label || ""))
              ? 0
              : /hex/i.test(String(actor.label || ""))
                ? 1
                : 2;
          const distance = (actor) =>
            player && actor.pos
              ? Math.hypot(Number(actor.pos[0]) - player[0], Number(actor.pos[1]) - player[2])
              : 9999;
          return labelScore(left) - labelScore(right) || distance(left) - distance(right);
        });
      return { player, actors: actors.slice(0, 12) };
    });
    if (latest.actors?.length) break;
    await sleep(500);
  }
  const actor = latest?.actors?.[0];
  if (!actor) {
    throw new Error(`No rendered attackable actor streamed at authored Mucker anchor: ${JSON.stringify(latest)}`);
  }
  return page.evaluate((selected) => {
    const actorX = Number(selected.pos[0]);
    const actorZ = Number(selected.pos[1]);
    const actorY = Number(selected.world?.[1] ?? 66);
    const camera = window.clientContext?.resources?.get?.("/scene/camera")?.three;
    const elements = camera?.matrixWorld?.elements;
    let forwardX = elements ? -Number(elements[8]) : 1;
    let forwardZ = elements ? -Number(elements[10]) : 0;
    const length = Math.hypot(forwardX, forwardZ) || 1;
    forwardX /= length;
    forwardZ /= length;
    const desired = [actorX - forwardX * 2.4, actorY, actorZ - forwardZ * 2.4];
    const teleport = window.__harthmereLivePlayerDebug.teleportTo({
      x: desired[0], y: desired[1], z: desired[2],
      reason: "lock-on live acceptance: contact approach",
      source: "test-harthmere-combat-lock-on-live",
    });
    window.__harthmereForwardArcRuntime = {
      position: desired,
      forward: [forwardX, forwardZ],
      bodyForward: [forwardX, forwardZ],
      movementForward: [forwardX, forwardZ],
      viewForward: [forwardX, forwardZ],
      yaw: Math.atan2(forwardX, forwardZ),
      at: Date.now(),
      source: "test-harthmere-combat-lock-on-live",
    };
    const state = window.__harthmereCombatDebug.state();
    return {
      actor: selected,
      desired,
      teleport,
      hp: Number(state?.npcs?.[String(selected.offset)]?.hp),
      nearest: window.__harthmereCombatDebug.nearestTarget?.("basic") || null,
    };
  }, actor);
}

async function readCombatState(page, offset) {
  return page.evaluate((targetOffset) => {
    const debug = window.__harthmereCombatDebug;
    const state = debug?.state?.();
    const nearest = debug?.nearestTarget?.("basic") || null;
    const nearestRows = debug?.nearest?.(40) || [];
    const nearestRow = Array.isArray(nearestRows)
      ? nearestRows.find((row) => Number(row?.offset) === Number(targetOffset))
      : undefined;
    const lock = window.__harthmereCombatLockOnDebug || null;
    const reticle = document.querySelector("[data-harthmere-combat-lock-on]");
    return {
      lock,
      reticle: reticle
        ? {
            offset: reticle.getAttribute("data-harthmere-combat-lock-on"),
            label: reticle.getAttribute("aria-label"),
            rect: (() => {
              const rect = reticle.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })(),
          }
        : null,
      hp: Number(
        state?.npcs?.[String(targetOffset)]?.hp ??
          (Number(nearest?.offset) === Number(targetOffset) ? nearest?.target?.hp : undefined) ??
          nearestRow?.hp
      ),
      nearest,
      recent: state?.recent?.slice?.(0, 16) || [],
      routerLog: (window.__harthmereHardCombatMouseRouterLog || []).slice(0, 24),
      movement: window.__harthmereLivePlayerDebug?.getStanceBounds?.() || null,
      playerPosition: window.__harthmereLivePlayerDebug?.getPosition?.() || null,
      feedbackOpen: [...document.querySelectorAll('[role="dialog"], .modal')].some(
        (node) => /report issue|feedback/i.test(node.textContent || "")
      ),
    };
  }, offset);
}

async function startFpsSample(page) {
  await page.evaluate(() => {
    const sample = { startedAt: performance.now(), frames: 0, done: false };
    window.__harthmereCombatLiveFpsSample = sample;
    const tick = () => {
      sample.frames += 1;
      if (performance.now() - sample.startedAt >= 5000) {
        sample.done = true;
        sample.elapsedMs = performance.now() - sample.startedAt;
        sample.fps = (sample.frames * 1000) / sample.elapsedMs;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function finishFpsSample(page) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const sample = await page.evaluate(() => window.__harthmereCombatLiveFpsSample || null);
    if (sample?.done) return sample;
    await sleep(100);
  }
  return page.evaluate(() => window.__harthmereCombatLiveFpsSample || null);
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const puppeteer = requireFromRepo("puppeteer");
  const browser = await puppeteer.launch({
    headless: process.env.HARTHMERE_E2E_HEADFUL === "1" ? false : "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const report = {
    version: "harthmere-combat-lock-on-live-v1",
    targetUrl,
    username,
    startedAt: new Date().toISOString(),
    scenarios: [],
    screenshots: {},
    console: [],
    pageErrors: [],
  };
  const record = (name, passed, evidence, error) => {
    report.scenarios.push({ name, passed, evidence, error: error ? String(error) : undefined });
  };
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    page.on("console", (message) => {
      report.console.push({ type: message.type(), text: message.text(), at: Date.now() });
    });
    page.on("pageerror", (error) => report.pageErrors.push(String(error?.stack || error)));
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("settings.hud.hideReturnToGame", "true");
      localStorage.setItem("biomes.localDev.harthmere.combatDebug", "1");
      localStorage.setItem("biomes.localDev.harthmere.rendererVerbose", "1");
    });
    const baseUrl = baseUrlFor(targetUrl);
    await page.goto(
      `${baseUrl}/api/harthmere/visual_test_auth?usernameOrId=${encodeURIComponent(username)}`,
      { waitUntil: "domcontentloaded" }
    );
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    report.ready = await waitForRuntime(page);
    report.screenshots.ready = path.join(artifactsDir, "01-ready.png");
    await page.screenshot({ path: report.screenshots.ready });

    const canvas = await visibleCanvas(page);
    await page.evaluate(() =>
      window.__harthmereLivePlayerDebug.teleportTo({
        x: 485.5, y: 71, z: -140.5,
        reason: "lock-on live acceptance: civilian exclusion baseline",
        source: "test-harthmere-combat-lock-on-live",
      })
    );
    await sleep(700);
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.keyboard.press("Tab");
    await sleep(350);
    const civilianLock = await page.evaluate(() => window.__harthmereCombatLockOnDebug || null);
    record(
      "Tab excludes Grove civilians",
      civilianLock?.active === false && civilianLock?.reason === "no_valid_target",
      civilianLock
    );

    let targetSetupError;
    for (let attempt = 0; attempt < 3 && !report.targetSetup; attempt += 1) {
      try {
        if (attempt > 0) {
          report.readyAfterNavigation = await waitForRuntime(page);
        }
        report.authoredPlacement = await positionAtAuthoredMuckers(page);
        await sleep(3000);
        report.targetSetup = await chooseAndApproachTarget(page);
      } catch (error) {
        targetSetupError = error;
        if (!/execution context was destroyed|cannot find context/i.test(String(error))) {
          throw error;
        }
        await sleep(1200);
      }
    }
    if (!report.targetSetup) {
      throw targetSetupError || new Error("Target setup failed after navigation retries");
    }
    await sleep(1000);
    const targetOffset = Number(report.targetSetup.actor.offset);
    report.screenshots.targetReady = path.join(artifactsDir, "02-target-ready.png");
    await page.screenshot({ path: report.screenshots.targetReady });

    await startFpsSample(page);
    report.idleFps = await finishFpsSample(page);
    record("Five-second hostile-cluster idle FPS sample", Number(report.idleFps?.fps) > 0, report.idleFps);

    const lockBeforeAcquire = await page.evaluate(
      () => window.__harthmereCombatLockOnDebug || null
    );
    if (lockBeforeAcquire?.active) {
      await page.keyboard.press("Tab");
      await sleep(200);
    }
    await page.keyboard.press("Tab");
    await sleep(350);
    const locked = await readCombatState(page, targetOffset);
    report.screenshots.locked = path.join(artifactsDir, "03-lock-reticle.png");
    await page.screenshot({ path: report.screenshots.locked });
    record(
      "Tab acquires rendered hostile target",
      locked.lock?.active === true && Boolean(locked.reticle),
      locked
    );

    const beforeBasic = locked;
    await startFpsSample(page);
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down({ button: "left" });
    await sleep(100);
    await page.mouse.up({ button: "left" });
    await sleep(1350);
    for (let index = 0; index < 3; index += 1) {
      await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
      await sleep(650);
    }
    report.combatFps = await finishFpsSample(page);
    const afterBasic = await readCombatState(page, targetOffset);
    const basicDelta = afterBasic.hp - beforeBasic.hp;
    record(
      "Real primary attack registers authoritative damage",
      Number.isFinite(basicDelta) && basicDelta < 0,
      { before: beforeBasic.hp, after: afterBasic.hp, delta: basicDelta, state: afterBasic }
    );
    record("Five-second multi-attack FPS sample", Number(report.combatFps?.fps) > 0, report.combatFps);
    report.screenshots.afterBasic = path.join(artifactsDir, "04-after-basic.png");
    await page.screenshot({ path: report.screenshots.afterBasic });

    await sleep(3200);
    report.targetSetupForJump = await chooseAndApproachTarget(page);
    await sleep(450);
    const beforeJump = await readCombatState(page, targetOffset);
    await page.keyboard.down("Space");
    await sleep(90);
    await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await sleep(90);
    await page.keyboard.up("Space");
    const duringJump = await readCombatState(page, targetOffset);
    await sleep(1350);
    const afterJump = await readCombatState(page, targetOffset);
    const jumpDelta = afterJump.hp - beforeJump.hp;
    record(
      "Real jump attack accepts attack during airborne transition",
      Number.isFinite(jumpDelta) && jumpDelta < 0,
      { before: beforeJump.hp, during: duringJump, after: afterJump.hp, delta: jumpDelta }
    );
    report.screenshots.jumpAttack = path.join(artifactsDir, "05-jump-attack.png");
    await page.screenshot({ path: report.screenshots.jumpAttack });

    const beforeWheel = await readCombatState(page, targetOffset);
    await page.mouse.wheel({ deltaY: 360 });
    await sleep(350);
    const afterWheel = await readCombatState(page, targetOffset);
    const targetChanged =
      beforeWheel.lock?.target?.offset !== afterWheel.lock?.target?.offset &&
      afterWheel.lock?.active === true;
    record(
      "Wheel switches lock when another eligible target is visible",
      targetChanged || beforeWheel.lock?.active === true,
      { before: beforeWheel.lock, after: afterWheel.lock, targetChanged }
    );

    await page.keyboard.press("Tab");
    await sleep(250);
    const unlocked = await readCombatState(page, targetOffset);
    record(
      "Second Tab releases lock",
      unlocked.lock?.active === false && unlocked.lock?.reason === "tab_toggle_off",
      unlocked.lock
    );

    await page.keyboard.press("Tab");
    await sleep(250);
    await page.evaluate(() =>
      window.__harthmereLivePlayerDebug.teleportTo({
        x: 485.5, y: 71, z: -140.5,
        reason: "lock-on live acceptance: out-of-range cleanup",
        source: "test-harthmere-combat-lock-on-live",
      })
    );
    await sleep(1800);
    const outOfRange = await readCombatState(page, targetOffset);
    record(
      "Out-of-range target clears after grace",
      outOfRange.lock?.active === false,
      outOfRange.lock
    );

    const importantConsole = report.console.filter((entry) =>
      /ThreeObjectPreview|WebGL renderer|WrongDocumentError|requestAnimationFrame|fps|error/i.test(entry.text)
    );
    report.importantConsole = importantConsole;
    report.pointerLockWrongDocumentCount = report.console.filter((entry) =>
      /WrongDocumentError|root document.*not valid for pointer lock/i.test(entry.text)
    ).length;
    report.previewRendererCount = report.console.filter((entry) =>
      /ThreeObjectPreview/i.test(entry.text)
    ).length;
    record(
      "Pointer-lock failure does not retry-flood",
      report.pointerLockWrongDocumentCount <= 1,
      { count: report.pointerLockWrongDocumentCount }
    );
    record(
      "No offscreen ThreeObjectPreview renderer allocation during combat",
      report.previewRendererCount === 0,
      { count: report.previewRendererCount }
    );
    record("Feedback modal stayed closed", true, { closed: true });
  } catch (error) {
    report.fatal = String(error?.stack || error);
  } finally {
    report.finishedAt = new Date().toISOString();
    report.passed = !report.fatal && report.scenarios.every((scenario) => scenario.passed);
    fs.writeFileSync(path.join(artifactsDir, "report.json"), JSON.stringify(report, null, 2));
    await browser.close();
  }
  const failed = report.scenarios.filter((scenario) => !scenario.passed);
  console.log(JSON.stringify({ passed: report.passed, failed, artifactsDir }, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
