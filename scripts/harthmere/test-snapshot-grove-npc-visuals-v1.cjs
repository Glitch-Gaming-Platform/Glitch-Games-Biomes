#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { resolvePlaywright } = require("./harthmere-live-runtime-probe-v1.cjs");

const repo = path.resolve(process.argv[2] || process.env.REPO || process.cwd());
const baseUrl = String(
  process.env.HARTHMERE_GROVE_NPC_VISUAL_BASE_URL ||
    process.env.HARTHMERE_E2E_URL ||
    "http://localhost:3000"
)
  .replace(/\/at\/.*$/, "")
  .replace(/\/$/, "");
const timeoutMs = Number(process.env.HARTHMERE_GROVE_NPC_VISUAL_TIMEOUT_MS || 240_000);
const artifactsDir = path.resolve(
  process.env.HARTHMERE_GROVE_NPC_VISUAL_ARTIFACTS_DIR ||
    path.join(repo, "artifacts", "snapshot-grove-npc-visuals-v1")
);
const healthUrl = `${baseUrl}/api/social/featured_posts?count=0&grove_npc_visual=1`;
const baseHost = (() => {
  try {
    return new URL(baseUrl).hostname;
  } catch (_) {
    return "";
  }
})();
const isLocalBaseUrl = /^(localhost|127\.0\.0\.1|::1)$/.test(baseHost);
const devAuthUser = String(
  process.env.HARTHMERE_GROVE_NPC_VISUAL_DEV_USER ||
    (isLocalBaseUrl ? "Joe" : "")
).trim();

function requireFromRepo(moduleName) {
  const candidate = path.join(repo, "node_modules", moduleName);
  try {
    return require(candidate);
  } catch (_) {
    return require(moduleName);
  }
}

const sharp = requireFromRepo("sharp");
const playwright = resolvePlaywright(repo);
if (!playwright) {
  console.error(
    "FAIL Playwright is installed for Grove NPC visual E2E. Run: npm install --save-dev playwright --legacy-peer-deps && npx playwright install chromium"
  );
  process.exit(1);
}

const {
  SNAPSHOT_GROVE_NPCS_V75,
  SNAPSHOT_GROVE_NPC_ROUTE_PROFILES_V137,
  snapshotGroveGroundedPositionV75,
  snapshotGroveNpcEntityIdV75,
} = require("../../src/shared/harthmere/snapshot_grove_content_v75");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function check(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

function orientationFromViewDir(viewDir) {
  const [dx, dy, dz] = viewDir.map(Number);
  const len = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(len) || len <= 0.00001) {
    return [-0.45, 0.75];
  }
  return [
    -Math.acos(dy / len) + Math.PI / 2,
    Math.atan2(-dx, -dz),
  ];
}

function npcCameraRouteParts(position) {
  const [x, y, z] = position.map(Number);
  const target = [x, y + 1.1, z];
  const eye = [x + 6.5, y + 3.6, z + 6.5];
  const orientation = orientationFromViewDir([
    target[0] - eye[0],
    target[1] - eye[1],
    target[2] - eye[2],
  ]);
  return [...eye, ...orientation];
}

function pointSegmentDistance2D(point, start, end) {
  const px = Number(point[0]);
  const pz = Number(point[2]);
  const ax = Number(start[0]);
  const az = Number(start[2]);
  const bx = Number(end[0]);
  const bz = Number(end[2]);
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq <= 0.000001) {
    return Math.hypot(px - ax, pz - az);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / lenSq));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

function routeCorridorDistance(npcId, position) {
  const profile = SNAPSHOT_GROVE_NPC_ROUTE_PROFILES_V137[npcId];
  if (!profile?.points?.length) {
    return undefined;
  }
  let best = Infinity;
  for (let i = 0; i < profile.points.length; i += 1) {
    best = Math.min(
      best,
      pointSegmentDistance2D(
        position,
        profile.points[i],
        profile.points[(i + 1) % profile.points.length]
      )
    );
  }
  return Number(best.toFixed(3));
}

function buildNpcTargets() {
  return SNAPSHOT_GROVE_NPCS_V75.filter((npc) => npc.seedServerNpc).map((npc) => ({
    id: npc.id,
    name: npc.displayName,
    entityId: String(snapshotGroveNpcEntityIdV75(npc)),
    expectedPosition: snapshotGroveGroundedPositionV75(npc.authoredPosition),
    authoredPosition: npc.authoredPosition,
    routeProfile: Boolean(SNAPSHOT_GROVE_NPC_ROUTE_PROFILES_V137[npc.id]),
  }));
}

async function waitForServerReady() {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { headers: { accept: "application/json" } });
      if (response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await delay(1000);
  }
  throw new Error(`server did not become ready at ${healthUrl}: ${lastError}`);
}

async function readAuthCheck(page) {
  try {
    return await page.evaluate(async () => {
      const response = await fetch("/api/auth/check", {
        credentials: "include",
      });
      const text = await response.text();
      let json = {};
      try {
        json = JSON.parse(text);
      } catch (_) {}
      return {
        ok: response.ok,
        status: response.status,
        userId: json?.userId ?? json?.user?.id ?? null,
      };
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

async function loginWithVisualTestAuth(browser) {
  if (!devAuthUser) {
    return null;
  }
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);
  try {
    const authUrl = `${baseUrl}/api/harthmere/visual_test_auth?usernameOrId=${encodeURIComponent(
      devAuthUser
    )}`;
    const response = await page.goto(authUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    assert(
      response && response.ok(),
      `visual test auth failed: HTTP ${response?.status()}`
    );
    const bodyText = await page.evaluate(
      () => document.body?.innerText?.trim() ?? ""
    );
    const authJson = JSON.parse(bodyText);
    const authCheck = await readAuthCheck(page);
    assert(
      authCheck.ok && authCheck.userId,
      `visual test auth did not produce an authenticated session: ${JSON.stringify(
        { authJson, authCheck }
      )}`
    );
    console.log(`OK visual test auth session userId=${authCheck.userId}`);
    return authCheck.userId;
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function gotoEntityObserver(page, target) {
  const url = `${baseUrl}/at/${encodeURIComponent(target.entityId)}?grove_npc_visual=${encodeURIComponent(target.id)}`;
  const response = await page.goto(url, {
    waitUntil: "commit",
    timeout: timeoutMs,
  });
  assert(response && response.status() < 500, `${target.id} returned HTTP ${response?.status()}`);
}

async function advancePlayableGate(page, bodySample) {
  return await page.evaluate((fallbackName) => {
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
        setter?.call(input, input.value || fallbackName);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) => /Enter Game|Set Name|Continue/i.test(element.textContent ?? "")
    );
    if (button) {
      button.click();
      return { clicked: true, label: button.textContent?.trim() ?? "" };
    }
    return { clicked: false, label: "", needsName, text: text.slice(0, 160) };
  }, devAuthUser || "VisualGroveNpcSmoke").then(async (result) => {
    if (!result.clicked && /Click anywhere to continue/i.test(bodySample)) {
      const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
      await page.mouse.click(viewport.width / 2, viewport.height / 2);
      return { clicked: true, label: "viewport" };
    }
    return result;
  });
}

async function collectNpcDebug(page, targets) {
  return page.evaluate((inputTargets) => {
    const canvases = Array.from(document.querySelectorAll("canvas")).map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    const bodyText = document.body?.innerText ?? "";
    const ctx = window.clientContext;
    const reactResources = ctx?.reactResources;
    const positions = inputTargets.map((target) => {
      let position;
      let label;
      try {
        const rawPosition = reactResources?.get?.("/ecs/c/position", Number(target.entityId));
        position = Array.isArray(rawPosition?.v) || rawPosition?.v?.length
          ? Array.from(rawPosition.v).map(Number)
          : undefined;
      } catch (_) {}
      try {
        label = reactResources?.get?.("/ecs/c/label", Number(target.entityId))?.text;
      } catch (_) {}
      return {
        id: target.id,
        name: target.name,
        entityId: target.entityId,
        label,
        position,
      };
    });
    return {
      href: location.href,
      bodySample: bodyText.slice(0, 700),
      isLoginShell:
        /Signing in with Glitch/i.test(bodyText) ||
        (/Login to Play/i.test(bodyText) &&
          !/Observing\b/i.test(bodyText)),
      isLoadingShell:
        /^\s*BIOMES\s+/i.test(bodyText) ||
        (/Tip:/i.test(bodyText) &&
          !canvases.some((canvas) => canvas.width > 300 && canvas.height > 200)),
      isWakeNameShell: /You vaguely recall a name|Set Name|Setting\.\.\./i.test(bodyText),
      hasCompileOverlay:
        /Unhandled Runtime Error|Failed to compile|Application error|Module build failed|SyntaxError|TypeError:/i.test(bodyText),
      renderedFrames: Number(window.clientContext?.rendererController?.renderedFrames ?? 0),
      hasClientContext: Boolean(window.clientContext),
      hasReactResources: Boolean(reactResources),
      hasSubstantialCanvas: canvases.some((canvas) => canvas.width > 300 && canvas.height > 200),
      positions,
    };
  }, targets);
}

async function waitForNpcRuntime(page, targets, target) {
  const deadline = Date.now() + timeoutMs;
  let lastProbe = null;
  let gateAttempts = 0;
  let nextProgressAt = Date.now() + 15_000;
  while (Date.now() < deadline) {
    lastProbe = await collectNpcDebug(page, targets);
    if (lastProbe.hasCompileOverlay) {
      throw new Error(`runtime error screen:\n${JSON.stringify(lastProbe, null, 2)}`);
    }
    if (
      gateAttempts < 5 &&
      /Click anywhere to continue|Enter Game|Set Name|You vaguely recall a name|Setting\.\.\./i.test(
        lastProbe.bodySample
      )
    ) {
      const gateResult = await advancePlayableGate(page, lastProbe.bodySample);
      console.log(`WAIT playable gate: ${JSON.stringify(gateResult)}`);
      gateAttempts += 1;
      await delay(1000);
      continue;
    }
    const targetRecord = lastProbe.positions.find((record) => record.id === target.id);
    const ready =
      lastProbe.hasSubstantialCanvas &&
      lastProbe.renderedFrames >= 3 &&
      lastProbe.hasClientContext &&
      lastProbe.hasReactResources &&
      Array.isArray(targetRecord?.position) &&
      !lastProbe.isLoginShell &&
      !lastProbe.isLoadingShell &&
      !lastProbe.isWakeNameShell;
    if (ready) {
      return { probe: lastProbe, targetRecord };
    }
    if (Date.now() >= nextProgressAt) {
      console.log(
        `WAIT Grove NPC runtime: npc=${target.id} frames=${lastProbe.renderedFrames} client=${lastProbe.hasClientContext} resources=${lastProbe.hasReactResources} canvas=${lastProbe.hasSubstantialCanvas} position=${JSON.stringify(targetRecord?.position ?? null)} loading=${lastProbe.isLoadingShell} login=${lastProbe.isLoginShell} name=${lastProbe.isWakeNameShell} body=${JSON.stringify(lastProbe.bodySample.slice(0, 120))}`
      );
      nextProgressAt = Date.now() + 15_000;
    }
    await delay(750);
  }
  throw new Error(`Grove NPC runtime did not become ready for ${target.id}:\n${JSON.stringify(lastProbe, null, 2)}`);
}

async function imageStats(buffer) {
  const image = sharp(buffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const stride = Math.max(1, Math.floor((info.width * info.height) / 20_000));
  let alpha = 0;
  let bright = 0;
  let transitions = 0;
  let previous = -1;
  let red = 0;
  let green = 0;
  let blue = 0;
  let lumaSum = 0;
  let lumaSumSq = 0;
  let sampled = 0;
  for (let pixel = 0; pixel < info.width * info.height; pixel += stride) {
    const offset = pixel * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const luma = (r + g + b) / 3;
    red += r;
    green += g;
    blue += b;
    lumaSum += luma;
    lumaSumSq += luma * luma;
    sampled += 1;
    if (data[offset + 3] > 0) alpha += 1;
    if (luma > 24) bright += 1;
    if (previous >= 0 && Math.abs(luma - previous) > 8) transitions += 1;
    previous = luma;
  }
  const lumaMean = sampled > 0 ? lumaSum / sampled : 0;
  const lumaStdDev =
    sampled > 0
      ? Math.sqrt(Math.max(0, lumaSumSq / sampled - lumaMean * lumaMean))
      : 0;
  return {
    width: info.width,
    height: info.height,
    sampleCount: Math.ceil((info.width * info.height) / stride),
    alpha,
    bright,
    transitions,
    avgRgb:
      sampled > 0
        ? [red / sampled, green / sampled, blue / sampled].map((value) =>
            Number(value.toFixed(1))
          )
        : [0, 0, 0],
    lumaMean: Number(lumaMean.toFixed(1)),
    lumaStdDev: Number(lumaStdDev.toFixed(1)),
  };
}

function screenshotLooksLikeGameView(stats) {
  const [r, g, b] = stats.avgRgb ?? [0, 0, 0];
  const mostlyWhite = stats.lumaMean > 245 && stats.lumaStdDev < 8;
  const loadingPurple =
    r >= 55 &&
    r <= 95 &&
    g >= 45 &&
    g <= 80 &&
    b >= 95 &&
    b <= 145 &&
    stats.lumaStdDev < 26;
  return (
    stats.width >= 1000 &&
    stats.height >= 650 &&
    stats.alpha > stats.sampleCount * 0.9 &&
    stats.bright > stats.sampleCount * 0.03 &&
    stats.transitions > stats.sampleCount * 0.015 &&
    stats.lumaStdDev >= 10 &&
    !mostlyWhite &&
    !loadingPurple
  );
}

async function captureVerifiedScreenshot(page, screenshotPath, target) {
  const deadline = Date.now() + timeoutMs;
  let lastStats = null;
  while (Date.now() < deadline) {
    const screenshot = await page.screenshot({ path: screenshotPath });
    lastStats = await imageStats(screenshot);
    if (screenshotLooksLikeGameView(lastStats)) {
      return { screenshot, stats: lastStats };
    }
    await delay(2000);
  }
  throw new Error(
    `${target.id} screenshot never reached a varied in-game view: ${JSON.stringify(
      lastStats
    )}`
  );
}

function smokeRuntimePosition(target, record) {
  const position = record.position.map(Number);
  const expected = target.expectedPosition.map(Number);
  check(
    position.length === 3 && position.every((part) => Number.isFinite(part)),
    `${target.name} runtime position is finite and camera-targetable`,
    JSON.stringify({ position })
  );

  const homeDistance = Math.hypot(position[0] - expected[0], position[2] - expected[2]);
  const routeDistance = routeCorridorDistance(target.id, position);
  if (routeDistance !== undefined) {
    check(
      routeDistance <= 1.25 || homeDistance <= 0.75,
      `${target.name} runtime X/Z stays inside its authored route corridor or home point`,
      JSON.stringify({ position, expectedHome: expected, routeDistance, homeDistance: Number(homeDistance.toFixed(3)) })
    );
  } else {
    check(
      homeDistance <= 0.75,
      `${target.name} runtime X/Z matches its authored live coordinate`,
      JSON.stringify({ position, expected, homeDistance: Number(homeDistance.toFixed(3)) })
    );
  }
  console.log(
    `NOTE ${target.name} visual-camera runtime position ${JSON.stringify(position)} authored-live-reference ${JSON.stringify(expected)} routeDistance=${routeDistance ?? "<static>"} homeDistance=${Number(homeDistance.toFixed(3))}`
  );
}

async function smokeVisualNpc(page, targets, target) {
  console.log(`VISUAL ${target.name} (${target.id}) entity=${target.entityId}`);
  await gotoEntityObserver(page, target);
  const { targetRecord } = await waitForNpcRuntime(page, targets, target);
  smokeRuntimePosition(target, targetRecord);

  const screenshotPath = path.join(artifactsDir, `${target.id}.png`);
  fs.rmSync(screenshotPath, { force: true });
  const { stats } = await captureVerifiedScreenshot(
    page,
    screenshotPath,
    target
  );
  check(stats.width >= 1000 && stats.height >= 650, `${target.name} screenshot has expected size`);
  check(
    screenshotLooksLikeGameView(stats),
    `${target.name} screenshot is nonblank, varied, and past the loading screen`,
    JSON.stringify(stats)
  );
  const postScreenshotProbe = await collectNpcDebug(page, targets);
  check(
    !postScreenshotProbe.isLoadingShell &&
      !postScreenshotProbe.isLoginShell &&
      !postScreenshotProbe.isWakeNameShell,
    `${target.name} screenshot captured actual game view, not loading/login shell`,
    JSON.stringify(postScreenshotProbe)
  );
  console.log(`SCREENSHOT ${screenshotPath}`);
}

async function buildContactSheet(targets) {
  const thumbWidth = 480;
  const thumbHeight = 300;
  const labelHeight = 44;
  const columns = 3;
  const rows = Math.ceil(targets.length / columns);
  const sheetWidth = columns * thumbWidth;
  const sheetHeight = rows * (thumbHeight + labelHeight);
  const composites = [];
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const sourcePath = path.join(artifactsDir, `${target.id}.png`);
    const resized = await sharp(sourcePath)
      .resize(thumbWidth, thumbHeight, { fit: "cover", position: "center" })
      .png()
      .toBuffer();
    const labelSvg = Buffer.from(
      `<svg width="${thumbWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07101d"/><text x="12" y="18" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#f4f7ff">${escapeXml(target.name)}</text><text x="12" y="35" font-family="Arial, sans-serif" font-size="12" fill="#b8c4d8">${escapeXml(target.id)} · ${escapeXml(target.entityId)} · visual runtime capture</text></svg>`
    );
    const x = (index % columns) * thumbWidth;
    const y = Math.floor(index / columns) * (thumbHeight + labelHeight);
    composites.push({ input: resized, left: x, top: y });
    composites.push({ input: labelSvg, left: x, top: y + thumbHeight });
  }
  const contactSheet = path.join(artifactsDir, "contact-sheet.png");
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: "#05070a",
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheet);
  return contactSheet;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  console.log("== Snapshot Grove NPC visual audit v1 ==");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Artifacts: ${artifactsDir}`);
  fs.mkdirSync(artifactsDir, { recursive: true });

  const targets = buildNpcTargets();
  const ids = new Set();
  const entityIds = new Set();
  for (const target of targets) {
    check(!ids.has(target.id), `${target.id} has a unique Grove NPC id`);
    check(!entityIds.has(target.entityId), `${target.name} has a unique seeded entity id`);
    ids.add(target.id);
    entityIds.add(target.entityId);
    check(
      target.authoredPosition.length === 3 &&
        target.authoredPosition.every((part) => Number.isFinite(Number(part))),
      `${target.name} authored coordinate is finite`
    );
  }
  check(targets.length === SNAPSHOT_GROVE_NPCS_V75.length, "every Grove NPC is seeded for visual/live testing", `${targets.length}/${SNAPSHOT_GROVE_NPCS_V75.length}`);

  await waitForServerReady();
  const browser = await playwright.chromium.launch({
    headless:
      process.env.HEADLESS === "0" || process.env.HARTHMERE_E2E_HEADLESS === "0"
        ? false
        : true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--enable-webgl"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await loginWithVisualTestAuth(context);
    for (const target of targets) {
      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);
      page.setDefaultNavigationTimeout(timeoutMs);
      try {
        await smokeVisualNpc(page, targets, target);
      } finally {
        await page.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    }
  } finally {
    await context.close().catch(() => undefined);
    await browser.close();
  }

  const contactSheet = await buildContactSheet(targets);
  console.log(`CONTACT_SHEET ${contactSheet}`);

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
