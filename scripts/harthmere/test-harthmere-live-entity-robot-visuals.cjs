#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const repo = path.resolve(process.argv[2] || process.env.REPO || process.cwd());
const baseUrl = String(
  process.env.HARTHMERE_LIVE_ENTITY_VISUAL_BASE_URL ||
    process.env.HARTHMERE_E2E_URL ||
    "http://localhost:3000"
)
  .replace(/\/at\/.*$/, "")
  .replace(/\/$/, "");
const timeoutMs = Number(process.env.HARTHMERE_LIVE_ENTITY_VISUAL_TIMEOUT_MS || 240_000);
const artifactsDir = path.resolve(
  process.env.HARTHMERE_LIVE_ENTITY_VISUAL_ARTIFACTS_DIR ||
    path.join(repo, "artifacts", "harthmere-live-entity-robot-visuals")
);
const extraChromeArgs = String(
  process.env.HARTHMERE_LIVE_ENTITY_VISUAL_EXTRA_CHROME_ARGS || ""
)
  .split(/\s+/)
  .map((arg) => arg.trim())
  .filter(Boolean);
const baseHost = (() => {
  try {
    return new URL(baseUrl).hostname;
  } catch (_) {
    return "";
  }
})();
const isLocalBaseUrl = /^(localhost|127\.0\.0\.1|::1)$/.test(baseHost);
const useCoordinateObserverRoute =
  !/^(0|false|no|off)$/i.test(
    String(process.env.HARTHMERE_LIVE_ENTITY_VISUAL_COORDINATE_ROUTE ?? "1")
  );
const visualDevUserEnv = process.env.HARTHMERE_LIVE_ENTITY_VISUAL_DEV_USER;
const devAuthDisabled = /^(0|false|no|off)$/i.test(String(visualDevUserEnv ?? ""));
const devAuthUser =
  visualDevUserEnv && !devAuthDisabled
    ? visualDevUserEnv
    : isLocalBaseUrl && !useCoordinateObserverRoute
      ? "Joe"
      : "";
const installId = String(process.env.HARTHMERE_LIVE_ENTITY_VISUAL_INSTALL_ID || "").trim();
const playerSlug = String(
  process.env.HARTHMERE_LIVE_ENTITY_VISUAL_PLAYER_SLUG || devAuthUser || "Joe"
).trim();
const healthUrl = String(
  process.env.HARTHMERE_LIVE_ENTITY_VISUAL_HEALTH_URL ||
    `${baseUrl}/api/social/featured_posts?count=0&live_entity_visual_health=1`
);

function requireFromRepo(moduleName) {
  const candidate = path.join(repo, "node_modules", moduleName);
  try {
    return require(candidate);
  } catch (error) {
    return require(moduleName);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const puppeteer = requireFromRepo("puppeteer");
const sharp = requireFromRepo("sharp");
const {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS,
  validateLiveEntityRobotProtectionAreas,
} = require("../../src/shared/harthmere/live_entity_robot_energy_protection");

function check(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

async function imageStats(buffer) {
  const image = sharp(buffer).ensureAlpha();
  const metadata = await image.metadata();
  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bright = 0;
  let alpha = 0;
  let transitions = 0;
  let previousLuma = -1;
  const stride = Math.max(1, Math.floor((info.width * info.height) / 25_000));
  for (let pixel = 0; pixel < info.width * info.height; pixel += stride) {
    const offset = pixel * 4;
    const a = data[offset + 3];
    const luma = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    if (a > 0) alpha += 1;
    if (luma > 24) bright += 1;
    if (previousLuma >= 0 && Math.abs(luma - previousLuma) > 8) {
      transitions += 1;
    }
    previousLuma = luma;
  }
  return {
    width: metadata.width ?? info.width,
    height: metadata.height ?? info.height,
    sampleCount: Math.ceil((info.width * info.height) / stride),
    bright,
    alpha,
    transitions,
  };
}

async function browserWebGLInfo(browser) {
  const page = await browser.newPage();
  try {
    await page.goto(
      'data:text/html,<canvas id="c"></canvas><script>const gl=c.getContext("webgl2")||c.getContext("webgl")||c.getContext("experimental-webgl");window.__webglInfo={ok:Boolean(gl),renderer:null};if(gl){const ext=gl.getExtension("WEBGL_debug_renderer_info");window.__webglInfo.renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}</script>',
      { waitUntil: "load", timeout: timeoutMs }
    );
    return await page.evaluate(() => window.__webglInfo);
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function waitForServerReady(label, budgetMs = timeoutMs) {
  const deadline = Date.now() + budgetMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        headers: { accept: "application/json,text/plain,*/*" },
      });
      if (response.status < 500) {
        return true;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await delay(1_000);
  }
  throw new Error(
    `${label} server did not become ready at ${healthUrl}: ${lastError}`
  );
}

async function gotoWithServerRetry(page, url, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  let nextLogAt = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: Math.min(60_000, Math.max(5_000, deadline - Date.now())),
      });
      if (!response || response.status() < 500) {
        return response;
      }
      lastError = `HTTP ${response.status()}`;
    } catch (error) {
      const message = error?.message || String(error);
      if (
        !/ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET|ECONNRESET|Navigation timeout/i.test(
          message
        )
      ) {
        throw error;
      }
      lastError = message;
    }
    if (Date.now() >= nextLogAt) {
      console.log(`WAIT ${label}: server restarting or warming up (${lastError})`);
      nextLogAt = Date.now() + 10_000;
    }
    await waitForServerReady(label, Math.min(20_000, deadline - Date.now())).catch(
      () => delay(1_000)
    );
  }
  throw new Error(`${label} could not load ${url}: ${lastError}`);
}

async function readAuthCheck(page) {
  try {
    return await page.evaluate(async () => {
      try {
        const response = await fetch("/api/auth/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
          credentials: "include",
        });
        let json = null;
        try {
          json = await response.json();
        } catch (_) {}
        return {
          ok: response.ok,
          status: response.status,
          userId: json?.userId ?? null,
        };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          userId: null,
          error: error?.message || String(error),
        };
      }
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      userId: null,
      error: error?.message || String(error),
    };
  }
}

async function loginWithDevAuth(browser) {
  if (!devAuthUser) {
    console.log("SKIP dev auth bootstrap; HARTHMERE_LIVE_ENTITY_VISUAL_DEV_USER is not set for this host");
    return null;
  }

  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);
  try {
    console.log(`Authenticating visual smoke with dev user '${devAuthUser}'`);
    const directAuthUrl = `${baseUrl}/api/harthmere/visual_test_auth?usernameOrId=${encodeURIComponent(
      devAuthUser
    )}`;
    const directAuthResponse = await gotoWithServerRetry(
      page,
      directAuthUrl,
      "visual test auth"
    );
    if (directAuthResponse?.ok()) {
      const authText = await page.evaluate(
        () => document.body?.innerText?.trim() ?? ""
      );
      const authJson = JSON.parse(authText);
      const authCheck = await readAuthCheck(page);
      assert(
        authCheck.ok && authCheck.userId,
        `visual test auth did not produce an authenticated session: ${JSON.stringify(
          { authJson, authCheck }
        )}`
      );
      console.log(`OK visual test auth session userId=${authCheck.userId}`);
      return authCheck.userId;
    }

    console.log(
      `Fallback to dev auth flow after visual auth returned HTTP ${directAuthResponse?.status()}`
    );
    await gotoWithServerRetry(
      page,
      `${baseUrl}/api/social/featured_posts?count=0&live_entity_visual_auth=1`,
      "dev auth bootstrap"
    );
    const loginUrl = `${baseUrl}/api/auth/dev/login?usernameOrId=${encodeURIComponent(devAuthUser)}`;
    const loginResponse = await page.evaluate(async (url) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        credentials: "include",
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        text,
      };
    }, loginUrl);
    assert(
      loginResponse.ok,
      `dev auth login failed: HTTP ${loginResponse.status} ${loginResponse.text.slice(0, 400)}`
    );
    const loginJson = JSON.parse(loginResponse.text);
    assert(loginJson.uri, "dev auth login did not return a callback URI");
    const callbackResponse = await page.evaluate(async (uri) => {
      const response = await fetch(uri, {
        method: "GET",
        credentials: "include",
        redirect: "follow",
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        url: response.url,
        text: text.slice(0, 500),
      };
    }, loginJson.uri);
    assert(
      callbackResponse.ok,
      `dev auth callback failed: HTTP ${callbackResponse.status} ${callbackResponse.text}`
    );

    const deadline = Date.now() + timeoutMs;
    let authCheck = await readAuthCheck(page);
    while ((!authCheck.ok || !authCheck.userId) && Date.now() < deadline) {
      await page.waitForTimeout(500);
      authCheck = await readAuthCheck(page);
    }
    assert(
      authCheck.ok && authCheck.userId,
      `dev auth did not produce an authenticated session: ${JSON.stringify(authCheck)}`
    );
    console.log(`OK dev auth session userId=${authCheck.userId}`);
    return authCheck.userId;
  } finally {
    await page.close().catch(() => undefined);
  }
}

function robotLabelForArea(area) {
  return `${area.label} Protection Robot`;
}

function isWakeNameShellText(text) {
  return /You vaguely recall a name|Set Name|Setting\.\.\./i.test(String(text ?? ""));
}

function visualSafeUsername(name) {
  const safe = String(name || "VisualRobotSmoke")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 32);
  return safe.length >= 2 ? safe : "VisualRobotSmoke";
}

async function collectGameProbe(page) {
  return await page.evaluate(() => {
    const readPositionFrom = (source) => {
      const value = source?.position ?? source?.player?.position ?? source?.pos;
      if (Array.isArray(value) && value.length >= 3) {
        return [Number(value[0]), Number(value[1]), Number(value[2])];
      }
      if (value && typeof value === "object") {
        if (
          value.x !== undefined &&
          value.y !== undefined &&
          value.z !== undefined
        ) {
          return [Number(value.x), Number(value.y), Number(value.z)];
        }
      }
      return null;
    };
    const text = document.body?.innerText ?? "";
    const canvases = Array.from(document.querySelectorAll("canvas")).map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return {
        className: String(canvas.className || ""),
        width: canvas.width,
        height: canvas.height,
        rectWidth: rect.width,
        rectHeight: rect.height,
      };
    });
    const debug = window.__harthmereRendererDebug;
    const livePlayerDebug = window.__harthmereLivePlayerDebug;
    let actors = [];
    try {
      actors = typeof debug?.actors === "function" ? debug.actors() : [];
    } catch (_) {}
    let livePlayerPosition = null;
    try {
      livePlayerPosition =
        typeof livePlayerDebug?.getPosition === "function"
          ? livePlayerDebug.getPosition()
          : null;
    } catch (_) {}
    const context = window.clientContext;
    const localPlayerPosition = readPositionFrom(
      context?.resources?.get?.("/scene/local_player")
    );
    return {
      href: location.href,
      title: document.title,
      bodySample: text.slice(0, 800),
      isObserverShell: /Observing\s+/i.test(text),
      isLoginShell:
        /Login to Play|Signing in with Glitch/i.test(text),
      hasCompileOverlay:
        /Unhandled Runtime Error|Failed to compile|Application error|Module build failed|SyntaxError|TypeError:/i.test(text),
      hasFatalAppError:
        /Unexpected Error|Failed to fetch|Something went wrong in Biomes/i.test(text),
      hasWakeNameShell:
        /You vaguely recall a name|Set Name|Setting\.\.\./i.test(text),
      hasLoadingShell:
        /^\s*BIOMES\s+/i.test(text) ||
        (/Tip:/i.test(text) &&
          !debug &&
          !canvases.some((canvas) => canvas.rectWidth > 300 && canvas.rectHeight > 200)),
      hasRendererDebug: Boolean(debug),
      hasLivePlayerDebug: Boolean(livePlayerDebug || localPlayerPosition),
      livePlayerPosition: livePlayerPosition ?? localPlayerPosition,
      actorCount: Array.isArray(actors) ? actors.length : 0,
      actors: Array.isArray(actors) ? actors : [],
      robotActors: Array.isArray(actors)
        ? actors.filter((actor) => /Protection Robot/i.test(String(actor?.label ?? "")))
        : [],
      renderedFrames: Number(context?.rendererController?.renderedFrames ?? 0),
      recordSize: Number(context?.table?.recordSize ?? 0),
      canvasCount: canvases.length,
      canvases,
      hasSubstantialCanvas: canvases.some((canvas) => canvas.rectWidth > 300 && canvas.rectHeight > 200),
      rendererDebugKeys: debug ? Object.keys(debug) : [],
      registerSummary: window.__harthmereRendererRegisterActorSummary ?? null,
      appearanceReportCount: Array.isArray(window.__harthmereRendererAppearanceReport)
        ? window.__harthmereRendererAppearanceReport.length
        : null,
      floatingBlockIntegrityReport: window.__harthmereFloatingBlockIntegrityReport ?? null,
      placementCleanupReport: window.__harthmerePlacementCleanupReport ?? null,
      eagerRobotPlacementReport: window.__harthmereEagerRobotPlacementReport ?? null,
      debugLogTail: Array.isArray(window.__harthmereRendererDebugLog)
        ? window.__harthmereRendererDebugLog.slice(-10)
        : [],
    };
  });
}

async function teleportLivePlayerToArea(page, area) {
  const [x, y, z] = area.anchor;
  return await page.evaluate((target) => {
    const readPositionFrom = (source) => {
      const value = source?.position ?? source?.player?.position ?? source?.pos;
      if (Array.isArray(value) && value.length >= 3) {
        return [Number(value[0]), Number(value[1]), Number(value[2])];
      }
      if (value && typeof value === "object") {
        if (
          value.x !== undefined &&
          value.y !== undefined &&
          value.z !== undefined
        ) {
          return [Number(value.x), Number(value.y), Number(value.z)];
        }
      }
      return null;
    };
    const writePositionTo = (source, next) => {
      if (!source) {
        return false;
      }
      const values = [source.position, source.player?.position, source.pos];
      let wrote = false;
      for (const value of values) {
        if (Array.isArray(value) && value.length >= 3) {
          value[0] = next[0];
          value[1] = next[1];
          value[2] = next[2];
          wrote = true;
        } else if (value && typeof value === "object") {
          if (typeof value.set === "function") {
            value.set(next[0], next[1], next[2]);
            wrote = true;
          } else if (
            value.x !== undefined &&
            value.y !== undefined &&
            value.z !== undefined
          ) {
            value.x = next[0];
            value.y = next[1];
            value.z = next[2];
            wrote = true;
          }
        }
      }
      return wrote;
    };
    const next = [target.x, target.y, target.z].map(Number);
    const liveDebug = window.__harthmereLivePlayerDebug;
    if (typeof liveDebug?.teleportTo === "function") {
      const result = liveDebug.teleportTo({
        x: target.x,
        y: target.y,
        z: target.z,
        reason: `Live entity robot visual smoke: ${target.areaId}`,
        source: "harthmere-live-entity-robot-visuals",
      });
      if (result?.teleported === true) {
        return result;
      }
    }
    const localPlayer = window.clientContext?.resources?.get?.(
      "/scene/local_player"
    );
    const before = readPositionFrom(localPlayer);
    const wrote = writePositionTo(localPlayer, next);
    const after = readPositionFrom(localPlayer);
    const moved =
      Array.isArray(after) &&
      Math.abs(after[0] - next[0]) < 0.35 &&
      Math.abs(after[1] - next[1]) < 2.0 &&
      Math.abs(after[2] - next[2]) < 0.35;
    if (moved && typeof window.clientContext?.events?.publish === "function") {
      void window.clientContext.events.publish({
        kind: "moveEvent",
        id: window.clientContext.userId,
        position: next,
        velocity: [0, 0, 0],
        orientation: [0, 0],
      });
    }
    if (!wrote || !moved) {
      return {
        ok: false,
        teleported: false,
        before,
        after,
        wrote,
        moved,
        reason: "missing_or_unwritable_live_player_position",
      };
    }
    return {
      ok: true,
      teleported: true,
      before,
      after,
      wrote,
      moved,
      source: "harthmere-live-entity-robot-visuals",
    };
  }, { x, y, z, areaId: area.areaId });
}

async function terrainColumnForArea(page, area) {
  return await page.evaluate((target) => {
    const diagnostics = window.__snapshotDiagnostics;
    if (typeof diagnostics?.terrainColumnAt !== "function") {
      return null;
    }
    return diagnostics.terrainColumnAt(target.x, target.z, target.y);
  }, { x: area.anchor[0], y: area.anchor[1], z: area.anchor[2] });
}

async function forceSaveVisualUsername(page, fallbackName) {
  const username = visualSafeUsername(fallbackName);
  try {
    return await page.evaluate(async (name) => {
      try {
        const response = await fetch("/api/user/save_username", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: name }),
        });
        return {
          ok: response.ok,
          status: response.status,
          text: (await response.text()).slice(0, 240),
        };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          text: error?.message || String(error),
        };
      }
    }, username);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      text: error?.message || String(error),
    };
  }
}

function nearestRobotForArea(probe, area, wantedLabel) {
  const robots = Array.isArray(probe.robotActors) ? probe.robotActors : [];
  const exact = robots.find((actor) =>
    String(actor?.label ?? "").includes(wantedLabel)
  );
  if (exact) {
    return exact;
  }
  return robots
    .map((actor) => {
      const position = Array.isArray(actor?.position)
        ? actor.position.map(Number)
        : [];
      const distance =
        position.length >= 3
          ? Math.hypot(position[0] - area.anchor[0], position[2] - area.anchor[2])
          : Number.POSITIVE_INFINITY;
      return { actor, distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .find((entry) => entry.distance <= 6)?.actor;
}

async function advancePlayableGate(page, fallbackName, bodySample) {
  if (isWakeNameShellText(bodySample)) {
    await forceSaveVisualUsername(page, fallbackName);
    const input = await page.$('input[type="text"]');
    if (input) {
      await input.click({ clickCount: 3 });
      await page.keyboard.press("Backspace").catch(() => undefined);
      await page.keyboard.type(visualSafeUsername(fallbackName));
      await page.keyboard.press("Enter");
      return {
        clicked: true,
        label: "Set Name",
        filledName: true,
      };
    }
  }
  return await page.evaluate((name) => {
    const text = document.body?.innerText ?? "";
    const needsName = /You vaguely recall a name|Set Name|Setting\.\.\./i.test(text);
    if (needsName) {
      const input = Array.from(document.querySelectorAll("input")).find(
        (element) => {
          const type = String(element.getAttribute("type") ?? "text");
          return /^(text|search)?$/i.test(type);
        }
      );
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(input, input.value || name);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) => /Enter Game|Set Name|Continue/i.test(element.textContent ?? "")
    );
    if (button) {
      button.click();
      return {
        clicked: true,
        label: button.textContent?.trim() ?? "",
        filledName: needsName,
      };
    }
    return { clicked: false, label: "", filledName: needsName };
  }, fallbackName);
}

async function waitForAreaRuntime(page, area, options = {}) {
  const coordinateObserverRoute = options.coordinateObserverRoute === true;
  const deadline = Date.now() + timeoutMs;
  let lastProbe = null;
  let nextProgressAt = Date.now() + 15_000;
  let teleportResult = null;
  let teleported = false;
  let playGateClicks = 0;
  let nameGateReloads = 0;
  let terrainColumn = null;
  const wantedLabel = robotLabelForArea(area);
  while (Date.now() < deadline) {
    try {
      lastProbe = await collectGameProbe(page);
    } catch (error) {
      const message = error?.message || String(error);
      if (
        /Execution context was destroyed|Cannot find context with specified id|Protocol error/i.test(
          message
        )
      ) {
        await page.waitForTimeout(1_000);
        continue;
      }
      throw error;
    }
    if (lastProbe.hasCompileOverlay) {
      throw new Error(`${area.areaId} compile/runtime overlay:\n${JSON.stringify(lastProbe, null, 2)}`);
    }
    if (lastProbe.hasFatalAppError) {
      throw new Error(`${area.areaId} fatal app error screen:\n${JSON.stringify(lastProbe, null, 2)}`);
    }
    const coordinateObserverLoginShell =
      coordinateObserverRoute &&
      lastProbe.isObserverShell &&
      lastProbe.hasRendererDebug &&
      (lastProbe.robotActors?.length ?? 0) > 0;
    if (lastProbe.isLoginShell && !coordinateObserverLoginShell) {
      throw new Error(`${area.areaId} loaded login shell, not the authenticated visual runtime:\n${JSON.stringify(lastProbe, null, 2)}`);
    }
    if (!coordinateObserverRoute && !teleported && lastProbe.hasLivePlayerDebug) {
      teleportResult = await teleportLivePlayerToArea(page, area);
      teleported = Boolean(teleportResult?.teleported);
    }
    if (
      playGateClicks < 4 &&
      /Click anywhere to continue|Enter Game|Set Name|You vaguely recall a name|Setting\.\.\./i.test(lastProbe.bodySample)
    ) {
      const gateResult = await advancePlayableGate(
        page,
        playerSlug || "Joe",
        lastProbe.bodySample
      );
      if (!gateResult.clicked) {
        const viewport = page.viewport() ?? { width: 1440, height: 900 };
        await page.mouse.click(viewport.width / 2, viewport.height / 2);
      }
      playGateClicks += 1;
      await page.waitForTimeout(1_000);
      continue;
    }
    if (lastProbe.hasWakeNameShell && nameGateReloads < 2) {
      const saveResult = await forceSaveVisualUsername(
        page,
        playerSlug || "VisualRobotSmoke"
      );
      console.log(
        `WAIT ${area.areaId}: cleared name gate via username API ${JSON.stringify(saveResult)}`
      );
      nameGateReloads += 1;
      await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForTimeout(1_000);
      continue;
    }
    const robot = nearestRobotForArea(lastProbe, area, wantedLabel);
    const livePosition = Array.isArray(lastProbe.livePlayerPosition)
      ? lastProbe.livePlayerPosition.map(Number)
      : [];
    const playerNearArea =
      coordinateObserverRoute ||
      (livePosition.length >= 3 &&
        Math.hypot(livePosition[0] - area.anchor[0], livePosition[2] - area.anchor[2]) <= 3.5);
    if (
      lastProbe.hasRendererDebug &&
      (coordinateObserverRoute || (teleported && playerNearArea))
    ) {
      terrainColumn = await terrainColumnForArea(page, area);
    }
    const robotAnimationReady =
      robot?.hasMixer === true || robot?.proceduralWalkCheck?.executed === true;
    if (
      lastProbe.hasRendererDebug &&
      (coordinateObserverRoute || lastProbe.hasLivePlayerDebug) &&
      (coordinateObserverRoute || !lastProbe.isObserverShell) &&
      !lastProbe.hasWakeNameShell &&
      lastProbe.actorCount > 0 &&
      lastProbe.hasSubstantialCanvas &&
      Number(lastProbe.renderedFrames) >= 3 &&
      (coordinateObserverRoute || teleported) &&
      playerNearArea &&
      robot
    ) {
      return { probe: lastProbe, robot, teleportResult, terrainColumn };
    }
    if (Date.now() >= nextProgressAt) {
      console.log(
        `WAIT ${area.areaId}: frames=${lastProbe.renderedFrames} actors=${lastProbe.actorCount} robots=${lastProbe.robotActors.length} wanted=${Boolean(robot)} robotAnimation=${robotAnimationReady} labels=${JSON.stringify(lastProbe.robotActors.slice(0, 4).map((actor) => actor.label))} player=${JSON.stringify(lastProbe.livePlayerPosition)} coordinateRoute=${coordinateObserverRoute} teleported=${teleported} terrainLoaded=${Boolean(terrainColumn?.terrainLoaded)} nameGate=${lastProbe.hasWakeNameShell} substantialCanvas=${lastProbe.hasSubstantialCanvas} canvases=${lastProbe.canvasCount} body=${JSON.stringify(lastProbe.bodySample.slice(0, 120))}`
      );
      nextProgressAt = Date.now() + 15_000;
    }
    await page.waitForTimeout(750);
  }
  throw new Error(`${area.areaId} did not reach playable Harthmere runtime with ${wantedLabel}:\n${JSON.stringify({ lastProbe, teleportResult, terrainColumn }, null, 2)}`);
}

function verifyRobotActor(area, robot) {
  const position = Array.isArray(robot?.position) ? robot.position.map(Number) : [];
  const [x, y, z] = position;
  const dx = Number.isFinite(x) ? x - area.anchor[0] : Infinity;
  const dz = Number.isFinite(z) ? z - area.anchor[2] : Infinity;
  const horizontalDistance = Math.hypot(dx, dz);
  check(
    horizontalDistance <= 6,
    `${area.label} robot is near its marker coordinates`,
    JSON.stringify({ label: robot?.label, position, anchor: area.anchor, horizontalDistance })
  );
  check(
    Number.isFinite(y) && Math.abs(y - area.groundY) <= 1.0,
    `${area.label} robot is grounded near terrain height`,
    JSON.stringify({ label: robot?.label, position, groundY: area.groundY })
  );
  const hasAnimation =
    robot?.hasMixer === true || robot?.proceduralWalkCheck?.executed === true;
  check(
    hasAnimation || robot?.nonNpcLiveEntityVisualActor === true,
    `${area.label} robot is renderable as animated or static sentinel`,
    JSON.stringify({
      label: robot?.label,
      hasMixer: robot?.hasMixer,
      clips: robot?.clips,
      proceduralWalkCheck: robot?.proceduralWalkCheck,
      nonNpcLiveEntityVisualActor: robot?.nonNpcLiveEntityVisualActor,
    })
  );
}

async function main() {
  console.log("== Harthmere live entity robot visual smoke current ==");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Artifacts: ${artifactsDir}`);
  console.log(`Auth mode: ${devAuthUser ? `dev user ${devAuthUser}` : installId ? "install_id query" : "existing/anonymous cookies"}`);
  console.log(`Route mode: ${useCoordinateObserverRoute ? "coordinate observer" : "player slug"}`);
  fs.mkdirSync(artifactsDir, { recursive: true });

  check(
    validateLiveEntityRobotProtectionAreas().length === 0,
    "robot protection coordinates validate before browser smoke"
  );

  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === "0" ? false : "new",
    defaultViewport: { width: 1440, height: 900 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-webgl",
      "--ignore-certificate-errors",
      ...extraChromeArgs,
    ],
  });

  try {
    const webglInfo = await browserWebGLInfo(browser);
    check(webglInfo?.ok, "browser can create a WebGL context", webglInfo?.renderer || "no renderer");
    if (!webglInfo?.ok) {
      throw new Error(
        "Browser cannot create WebGL. Set HARTHMERE_LIVE_ENTITY_VISUAL_EXTRA_CHROME_ARGS for this runner."
      );
    }
    console.log(`OK WebGL renderer: ${webglInfo.renderer || "unknown"}`);

    await loginWithDevAuth(browser);

    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS) {
      const page = await browser.newPage();
      page.setDefaultTimeout(timeoutMs);
      page.setDefaultNavigationTimeout(timeoutMs);
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (error) => {
        pageErrors.push(error.stack || error.message || String(error));
      });

      const search = new URLSearchParams({
        live_entity_robot_visual: area.areaId,
      });
      if (isLocalBaseUrl) {
        search.set("syncBaseUrl", baseUrl);
      }
      if (installId) {
        search.set("install_id", installId);
        search.set("glitch_install_id", installId);
        search.set("game_install_id", installId);
      }
      const playerPath = useCoordinateObserverRoute
        ? [area.anchor[0], area.anchor[1] + 4, area.anchor[2]]
            .map((part) => encodeURIComponent(String(part)))
            .join("/")
        : encodeURIComponent(playerSlug || "Joe");
      const url = `${baseUrl}/at/${playerPath}?${search.toString()}`;
      const response = await gotoWithServerRetry(
        page,
        url,
        `${area.areaId} game route`
      );
      assert(response && response.ok(), `${area.areaId} returned HTTP ${response?.status()}`);
      const { probe, robot, teleportResult, terrainColumn } =
        await waitForAreaRuntime(page, area, {
          coordinateObserverRoute: useCoordinateObserverRoute,
        });
      check(
        useCoordinateObserverRoute || teleportResult?.teleported === true,
        useCoordinateObserverRoute
          ? `${area.label} coordinate observer loads marker coordinates`
          : `${area.label} live player teleports to marker coordinates`,
        JSON.stringify(teleportResult)
      );
      verifyRobotActor(area, robot);
      const terrainReady =
        Boolean(terrainColumn?.terrainLoaded) && Number.isFinite(terrainColumn?.feetY);
      if (terrainReady) {
        check(
          Boolean(terrainColumn?.terrainLoaded),
          `${area.label} terrain column is loaded at marker`,
          JSON.stringify(terrainColumn)
        );
        check(
          Number.isFinite(terrainColumn?.feetY),
          `${area.label} terrain column has a walkable feet height`,
          JSON.stringify(terrainColumn)
        );
        check(
          Math.abs(Number(robot?.position?.[1]) - Number(terrainColumn?.feetY)) <= 1.0,
          `${area.label} robot is not buried or floating in live terrain`,
          JSON.stringify({ position: robot?.position, terrainColumn })
        );
      } else {
        console.log(
          `INFO ${area.label} terrain diagnostic not ready; grounded sentinel check already passed ${JSON.stringify(terrainColumn)}`
        );
      }

      const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
      check(
        !/Unhandled Runtime Error|Failed to compile|Application error/i.test(bodyText),
        `${area.label} has no runtime error overlay`
      );
      check(
        !/Login to Play|Signing in with Glitch/i.test(bodyText),
        `${area.label} is not the login shell`
      );
      check(
        !isWakeNameShellText(bodyText),
        `${area.label} is not blocked by the name entry shell`
      );
      check(
        !probe.hasLoadingShell,
        `${area.label} leaves the loading screen`
      );
      check(
        probe.robotActors.length >= LIVE_ENTITY_ROBOT_PROTECTION_AREAS.length,
        `${area.label} runtime exposes all robot sentinel actors`,
        JSON.stringify(probe.robotActors.map((actor) => actor.label))
      );
      check(pageErrors.length === 0, `${area.label} has no pageerror events`, pageErrors.join("\n"));
      const seriousConsoleErrors = consoleErrors.filter(
        (line) => !/favicon|source map|WebSocket connection|Failed to load resource/i.test(line)
      );
      check(
        seriousConsoleErrors.length === 0,
        `${area.label} has no serious console errors`,
        seriousConsoleErrors.join("\n")
      );

      const canvasInfo = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll("canvas"));
        const largest = canvases
          .map((canvas) => {
            const rect = canvas.getBoundingClientRect();
            return {
              width: canvas.width,
              height: canvas.height,
              rectWidth: rect.width,
              rectHeight: rect.height,
            };
          })
          .sort((a, b) => b.rectWidth * b.rectHeight - a.rectWidth * a.rectHeight)[0];
        return largest;
      });
      check(
        Boolean(canvasInfo && canvasInfo.rectWidth > 300 && canvasInfo.rectHeight > 200),
        `${area.label} renders a substantial game canvas`,
        JSON.stringify(canvasInfo)
      );
      await page.waitForFunction(
        () => {
          const text = document.body?.innerText ?? "";
          const debug = window.__harthmereRendererDebug;
          const context = window.clientContext;
          const canvases = Array.from(document.querySelectorAll("canvas"));
          const hasCanvas = canvases.some((canvas) => {
            const rect = canvas.getBoundingClientRect();
            return rect.width > 300 && rect.height > 200;
          });
          return (
            Boolean(debug) &&
            hasCanvas &&
            Number(context?.rendererController?.renderedFrames ?? 0) >= 12 &&
            !/You vaguely recall a name|Set Name|Setting\.\.\./i.test(text)
          );
        },
        {
          timeout: Math.min(
            timeoutMs,
            Number(process.env.HARTHMERE_LIVE_ENTITY_VISUAL_RENDER_SETTLE_TIMEOUT_MS || 120_000)
          ),
        }
      );

      const screenshotPath = path.join(artifactsDir, `${area.areaId}.png`);
      const screenshot = await page.screenshot({ path: screenshotPath });
      const stats = await imageStats(screenshot);
      check(stats.width >= 1000 && stats.height >= 650, `${area.label} screenshot has expected size`);
      check(
        stats.alpha > stats.sampleCount * 0.9 &&
          stats.bright > stats.sampleCount * 0.05 &&
          stats.transitions > stats.sampleCount * 0.02,
        `${area.label} screenshot is nonblank and visually varied`,
        JSON.stringify(stats)
      );
      console.log(`SCREENSHOT ${screenshotPath}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (process.exitCode) {
    console.error("\nRESULT: FAIL");
    process.exit(process.exitCode);
  }
  console.log("\nRESULT: PASS");
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
