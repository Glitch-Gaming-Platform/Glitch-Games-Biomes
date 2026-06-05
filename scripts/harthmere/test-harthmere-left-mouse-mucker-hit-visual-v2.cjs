#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const rawUrl =
  process.env.HARTHMERE_E2E_URL ||
  "http://127.0.0.1:3000/at/VisualCombatDiagnostics";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120000);
const artifactsDir = path.resolve(
  process.env.HARTHMERE_LEFT_MOUSE_MUCKER_ARTIFACTS_DIR ||
    path.join(root, ".codex-artifacts", "harthmere-mucker-hit-visual-v2")
);

function requireFromRepo(moduleName) {
  try {
    return require(path.join(root, "node_modules", moduleName));
  } catch {
    return require(moduleName);
  }
}

function baseUrlFor(url) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveScreenshot(page, name) {
  const file = path.join(artifactsDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function installRuntimeListeners(page) {
  await page.evaluateOnNewDocument(() => {
    window.localStorage?.setItem("settings.hud.hideReturnToGame", "true");
    window.localStorage?.setItem("biomes.localDev.harthmere.combatDebug", "1");
    window.localStorage?.setItem("biomes.localDev.harthmere.rendererVerbose", "1");
    window.localStorage?.removeItem("biomes.localDev.harthmere.inventoryState.v1");
    window.__harthmereLeftMouseVisualEffectLogV2 = [];
    window.addEventListener("biomes:harthmere-combat-effect", (event) => {
      window.__harthmereLeftMouseVisualEffectLogV2 = [
        { at: Date.now(), detail: event.detail },
        ...(window.__harthmereLeftMouseVisualEffectLogV2 || []),
      ].slice(0, 40);
    });
  });
}

async function login(page, baseUrl) {
  const user =
    process.env.HARTHMERE_VISUAL_TEST_USER || "VisualCombatDiagnostics";
  await page.goto(
    `${baseUrl}/api/harthmere/visual_test_auth?usernameOrId=${encodeURIComponent(
      user
    )}`,
    { waitUntil: "domcontentloaded", timeout: timeoutMs }
  );
}

async function closeDevOverlayAndEnterGame(page) {
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const close = buttons.find(
      (button) => button.textContent?.trim().toLowerCase() === "close"
    );
    close?.click();
    const enter = buttons.find((button) =>
      /enter game/i.test(button.textContent || "")
    );
    enter?.click();
  });
}

async function readRuntimeProbe(page) {
  return await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")]
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          area: rect.width * rect.height,
        };
      })
      .sort((a, b) => b.area - a.area);
    const rendererActors =
      typeof window.__harthmereRendererDebug?.actors === "function"
        ? window.__harthmereRendererDebug.actors()
        : [];
    return {
      url: location.href,
      title: document.title,
      loading: Boolean(document.querySelector(".loading-wrapper")),
      devOverlay: Boolean(document.querySelector("[data-nextjs-dialog-overlay]")),
      frames: Number(
        window.clientContext?.rendererController?.renderedFrames ?? 0
      ),
      canvas: canvases[0] ?? null,
      hasCombatDebug: Boolean(window.__harthmereCombatDebug),
      actorCount: Object.keys(
        window.__harthmereVoxelNpcMotionActorPositionsV193 || {}
      ).length,
      runtimePlacements: Number(
        window.__harthmereFloatingBlockIntegrityReport?.runtimePlacements ?? 0
      ),
      diagnosticActors: Array.isArray(rendererActors)
        ? rendererActors.filter((actor) =>
            /combat diagnostic|harthmere combat diagnostics/i.test(
              `${actor?.label || ""} ${actor?.asset || ""} ${
                actor?.district || ""
              }`
            )
          ).length
        : 0,
    };
  });
}

async function waitForRuntimeReady(page) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    await closeDevOverlayAndEnterGame(page).catch(() => undefined);
    latest = await readRuntimeProbe(page).catch((error) => ({
      error: error?.message || String(error),
    }));
    if (
      !latest.loading &&
      latest.frames >= 30 &&
      latest.canvas?.width > 500 &&
      latest.canvas?.height > 300 &&
      latest.hasCombatDebug &&
      latest.actorCount > 0 &&
      latest.runtimePlacements > 0 &&
      latest.diagnosticActors >= 6
    ) {
      return latest;
    }
    await sleep(1000);
  }
  throw new Error(
    `Timed out waiting for Harthmere runtime: ${JSON.stringify(latest)}`
  );
}

async function placePlayerAtMucker(page) {
  return await page.evaluate(async () => {
    const debug = window.__harthmereCombatDebug;
    debug?.reset?.();
    window.localStorage?.removeItem(
      "biomes.localDev.harthmere.inventoryState.v1"
    );
    await new Promise((resolve) => setTimeout(resolve, 250));

    const state = debug?.state?.();
    const candidates = Object.entries(
      window.__harthmereVoxelNpcMotionActorPositionsV193 || {}
    )
      .map(([id, actor]) => ({
        id,
        offset: Number(id),
        ...(actor || {}),
      }))
      .filter((actor) => {
        const stats = state?.npcs?.[String(actor.offset)];
        return (
          Number.isFinite(actor.offset) &&
          Array.isArray(actor.pos) &&
          Number(stats?.hp ?? 0) > 0 &&
          stats?.attackable !== false
        );
      })
      .sort((a, b) => {
        const score = (actor) => {
          const label = String(actor.label || "");
          if (/road muckling/i.test(label)) return 0;
          if (/muckling|mucker/i.test(label)) return 1;
          if (/hexer/i.test(label)) return 2;
          return 20;
        };
        return score(a) - score(b);
      });
    const actor = candidates[0];
    if (!actor) {
      throw new Error("No attackable mucker actor found");
    }
    const offset = Number(actor.offset);
    const x = Number(actor.pos[0]);
    const z = Number(actor.pos[1]);
    const y = Number(actor.world?.[1] ?? 54.5);
    const forward = [1, 0];
    const desiredX = x - forward[0] * 1.05;
    const desiredZ = z - forward[1] * 1.05;
    window.__harthmereLivePlayerDebug?.teleportTo?.({
      x: desiredX,
      y,
      z: desiredZ,
      reason: "left mouse mucker visual regression: contact range",
      source: "test-harthmere-left-mouse-mucker-hit-visual-v2",
    });
    window.__harthmereForwardArcRuntime = {
      position: [desiredX, y, desiredZ],
      forward,
      bodyForward: forward,
      movementForward: forward,
      viewForward: forward,
      yaw: Math.atan2(forward[0], forward[1]),
      at: Date.now(),
      source: "test-harthmere-left-mouse-mucker-hit-visual-v2",
    };
    await new Promise((resolve) => setTimeout(resolve, 600));
    const before = debug?.state?.();
    const targetBefore = Number(before?.npcs?.[String(offset)]?.hp);
    const creatureAudit =
      window.__harthmereRendererDebug?.creatureAnimationAudit?.() ?? null;
    const auditedActor = (creatureAudit?.actors || []).find((entry) =>
      String(entry?.label || "").includes(String(actor.label || ""))
    );
    return {
      offset,
      label: actor.label,
      position: actor.world ?? [x, y, z],
      targetBefore,
      playerPosition: window.__harthmereLivePlayerDebug?.getPosition?.() ?? null,
      contactDistance: Math.hypot(desiredX - x, desiredZ - z),
      nearest: debug?.nearestTarget?.("basic") ?? null,
      auditedActor,
      pointerLocked: Boolean(document.pointerLockElement),
    };
  });
}

async function readLargestCanvas(page) {
  return await page.evaluate(() => {
    return [...document.querySelectorAll("canvas")]
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          area: rect.width * rect.height,
        };
      })
      .sort((a, b) => b.area - a.area)[0];
  });
}

async function readAttackResult(page, offset, label) {
  return await page.evaluate(
    ({ targetOffset, targetLabel }) => {
      const debug = window.__harthmereCombatDebug;
      const after = debug?.state?.();
      const recent = after?.recent?.slice?.(0, 12) ?? [];
      const playerAttack = recent.find(
        (entry) =>
          entry?.attacker === "You" &&
          Number(entry?.targetOffset) === Number(targetOffset)
      );
      const creatureAudit =
        window.__harthmereRendererDebug?.creatureAnimationAudit?.() ?? null;
      const auditedActor = (creatureAudit?.actors || []).find((entry) =>
        String(entry?.label || "").includes(String(targetLabel || ""))
      );
      return {
        targetAfter: Number(after?.npcs?.[String(targetOffset)]?.hp),
        recent,
        playerAttack,
        routerLog: (window.__harthmereHardCombatMouseRouterLog || []).slice(
          0,
          20
        ),
        effectLog: (
          window.__harthmereLeftMouseVisualEffectLogV2 || []
        ).slice(0, 20),
        nativeContactLastAt: Number(
          window.__harthmereNativeNpcAttackContactLastAtV189 ?? 0
        ),
        auditedActor,
        pointerLocked: Boolean(document.pointerLockElement),
      };
    },
    { targetOffset: offset, targetLabel: label }
  );
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const puppeteer = requireFromRepo("puppeteer");
  const browser = await puppeteer.launch({
    headless: process.env.HARTHMERE_E2E_HEADFUL === "1" ? false : "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const report = {
    url: rawUrl,
    artifactsDir,
    screenshots: {},
  };

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await installRuntimeListeners(page);

    await login(page, baseUrlFor(rawUrl));
    await page.goto(rawUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    report.ready = await waitForRuntimeReady(page);
    report.setup = await placePlayerAtMucker(page);
    report.screenshots.before = await saveScreenshot(page, "01-before-left-mouse");

    const canvas = await readLargestCanvas(page);
    if (!canvas || canvas.width < 500 || canvas.height < 300) {
      throw new Error(`No gameplay canvas found: ${JSON.stringify(canvas)}`);
    }
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down({ button: "left" });
    await sleep(120);
    await page.mouse.up({ button: "left" });
    await sleep(1400);

    report.after = await readAttackResult(
      page,
      report.setup.offset,
      report.setup.label
    );
    report.screenshots.after = await saveScreenshot(page, "02-after-left-mouse");
    report.hpDelta =
      Number(report.after.targetAfter) - Number(report.setup.targetBefore);
    report.routerAccepted = report.after.routerLog.some(
      (entry) => entry?.type === "mousedown" && entry?.action === "basic"
    );
    report.bodyVisibleAtContact =
      report.setup.auditedActor?.visible === true &&
      report.after.auditedActor?.visible === true;
    report.passed =
      Number.isFinite(report.hpDelta) &&
      report.hpDelta < 0 &&
      report.routerAccepted &&
      report.bodyVisibleAtContact;

    fs.writeFileSync(
      path.join(artifactsDir, "report.json"),
      JSON.stringify(report, null, 2)
    );

    if (!report.passed) {
      throw new Error(`Left mouse mucker visual failed: ${JSON.stringify(report)}`);
    }
    console.log(
      `PASS left mouse hit ${report.setup.label}: ${report.setup.targetBefore} -> ${report.after.targetAfter} (${report.hpDelta})`
    );
    console.log(`Artifacts: ${artifactsDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  try {
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(
      path.join(artifactsDir, "failure.txt"),
      error?.stack || String(error)
    );
  } catch {
    // Best effort; the thrown error still reaches the process.
  }
  console.error(error?.stack || String(error));
  process.exit(1);
});
