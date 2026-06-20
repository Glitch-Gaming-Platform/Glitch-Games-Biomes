#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { resolvePlaywright } = require("./harthmere-live-runtime-probe.cjs");

const repo = path.resolve(process.argv[2] || process.env.REPO || process.cwd());
const baseUrl = String(
  process.env.HARTHMERE_QUEST_MARKER_VISUAL_BASE_URL ||
    process.env.HARTHMERE_E2E_URL ||
    "http://localhost:3000"
)
  .replace(/\/at\/.*$/, "")
  .replace(/\/$/, "");
const timeoutMs = Number(process.env.HARTHMERE_QUEST_MARKER_VISUAL_TIMEOUT_MS || 180_000);
const artifactsDir = path.resolve(
  process.env.HARTHMERE_QUEST_MARKER_VISUAL_ARTIFACTS_DIR ||
    path.join(repo, "artifacts", "harthmere-quest-marker-visuals")
);
const healthUrl = `${baseUrl}/api/social/featured_posts?count=0&quest_marker_visual=1`;
const baseHost = (() => {
  try {
    return new URL(baseUrl).hostname;
  } catch (_) {
    return "";
  }
})();
const isLocalBaseUrl = /^(localhost|127\.0\.0\.1|::1)$/.test(baseHost);
const devAuthUser = String(
  process.env.HARTHMERE_QUEST_MARKER_VISUAL_DEV_USER ||
    (isLocalBaseUrl ? "Joe" : "")
).trim();
const visualScope = String(
  process.env.HARTHMERE_QUEST_MARKER_VISUAL_SCOPE || "sample"
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
    "FAIL Playwright is installed for quest marker visual E2E. Run: npm install --save-dev playwright --legacy-peer-deps && npx playwright install chromium"
  );
  process.exit(1);
}

const {
  HARTHMERE_QUEST_OBJECT_MARKERS,
} = require("../../src/client/game/renderers/local_dev/harthmere_quest_object_markers");
const {
  HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS,
} = require("../../src/client/game/renderers/local_dev/harthmere_jobs_board_marker");
const {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  HARTHMERE_JOBS_BOARD_LOCATIONS,
  defaultHarthmereJobsBoardState,
  reduceHarthmereJobsBoardMutation,
} = require("../../src/shared/harthmere/mmo_jobs_board_authority");
const {
  HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES,
} = require("../../src/shared/harthmere/jobs_board_business_templates");
const {
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS,
} = require("../../src/shared/harthmere/live_entity_helper_quests");
const {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_QUESTS,
} = require("../../src/shared/harthmere/snapshot_grove_content");
const {
  harthmereJobsBoardQuestMarkerPositionForId,
  unresolvedHarthmereJobsBoardQuestMarkerIds,
} = require("../../src/shared/harthmere/jobs_board_quest_marker_positions");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function markerCameraRouteParts(position) {
  const [x, y, z] = position.map(Number);
  const target = [x, y + 0.85, z];
  const eye = [x + 8.5, y + 5.25, z + 8.5];
  const orientation = orientationFromViewDir([
    target[0] - eye[0],
    target[1] - eye[1],
    target[2] - eye[2],
  ]);
  return [...eye, ...orientation];
}

function check(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

function landmarkForId(markerId) {
  return SNAPSHOT_GROVE_LANDMARKS.find((landmark) => landmark.id === markerId);
}

function seedJobsBoard(boardId, ticks = 50) {
  let state = defaultHarthmereJobsBoardState(1_800_000_000_000);
  for (let i = 0; i < ticks; i += 1) {
    state = reduceHarthmereJobsBoardMutation(
      state,
      {
        requestId: `quest_marker_visual_${boardId}_${i}`,
        actorId: "quest_marker_visual_seeder",
        nowMs: 1_800_000_000_000 + i * 1000,
        operation: "economy_auto_seed_jobs",
        boardId,
      },
      {
        actorGold: 0,
        actorInventoryItems: {},
        nearbyBoardId: boardId,
      }
    ).jobsBoard;
  }
  return state;
}

function buildAuditSets() {
  const objectiveIds = Array.from(
    new Set(SNAPSHOT_GROVE_QUESTS.flatMap((quest) => quest.markerIds))
  );
  const nonNpcObjectiveIds = objectiveIds.filter((id) => {
    const landmark = landmarkForId(id);
    return !landmark || landmark.kind !== "npc";
  });

  const groveSeed = seedJobsBoard(HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID);
  const harthmereSeed = seedJobsBoard(HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID);
  const seededJobs = [
    ...Object.values(groveSeed.postings),
    ...Object.values(harthmereSeed.postings),
  ];
  const seededMarkerIds = seededJobs
    .map((job) => job.mapMarkerId)
    .filter(Boolean);
  const monsterHuntMarkerIds = seededJobs
    .filter((job) => job.kind === "hunt")
    .map((job) => job.mapMarkerId)
    .filter(Boolean);
  const businessTemplateMarkerIds = HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.map(
    (template) => template.mapMarkerId
  ).filter(Boolean);
  const helperMarkerIds = LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS.map(
    (marker) => marker.id
  );
  return {
    requiredMarkerIds: Array.from(
      new Set([
        ...nonNpcObjectiveIds,
        ...seededMarkerIds,
        ...businessTemplateMarkerIds,
        ...helperMarkerIds,
      ])
    ),
    monsterHuntMarkerIds: Array.from(new Set(monsterHuntMarkerIds)),
  };
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

async function gotoMarker(page, markerId, position) {
  const route = markerCameraRouteParts(position)
    .map((part) => encodeURIComponent(String(part)))
    .join("/");
  const url = `${baseUrl}/at/${route}?quest_marker_visual=${encodeURIComponent(markerId)}`;
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  assert(response && response.status() < 500, `${markerId} returned HTTP ${response?.status()}`);
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
  }, devAuthUser || "VisualQuestSmoke").then(async (result) => {
    if (!result.clicked && /Click anywhere to continue/i.test(bodySample)) {
      const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
      await page.mouse.click(viewport.width / 2, viewport.height / 2);
      return { clicked: true, label: "viewport" };
    }
    return result;
  });
}

async function activateHelperMarkers(page) {
  await page.evaluate(() => {
    const scope = "quest-marker-visual";
    window.sessionStorage?.setItem(
      "biomes.localDev.harthmere.activeUserScope",
      scope
    );
    window.localStorage.setItem(
      "biomes.localDev.harthmere.activeUserScope",
      scope
    );
    window.localStorage.setItem(
      `biomes.localDev.liveEntityHelperQuests.user.${scope}`,
      JSON.stringify({
        active: {
          "visual:exotic": {
            questId: "visual:exotic",
            kind: "exotic_matter",
            entityId: "visual_robot",
            giverName: "Visual Robot",
            at: Date.now() - 2,
          },
          "visual:food": {
            questId: "visual:food",
            kind: "food_water",
            entityId: "visual_person",
            giverName: "Visual Person",
            at: Date.now() - 1,
          },
          "visual:boss": {
            questId: "visual:boss",
            kind: "hard_boss",
            entityId: "visual_boss",
            giverName: "Visual Sentinel",
            at: Date.now(),
          },
        },
        completed: {},
      })
    );
    window.dispatchEvent(new Event("biomes:live-entity-helper-quest"));
  });
}

async function collectMarkerDebug(page) {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll("canvas")).map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    const questDebug = window.__harthmereQuestObjectMarkerDebug;
    const boardDebug = window.__harthmereJobsBoardMarkerDebug;
    let questMarkers = [];
    let boards = [];
    try {
      questMarkers = typeof questDebug?.markers === "function" ? questDebug.markers() : [];
    } catch (_) {}
    try {
      boards = typeof boardDebug?.boards === "function" ? boardDebug.boards() : [];
    } catch (_) {}
    return {
      href: location.href,
      bodySample: (document.body?.innerText ?? "").slice(0, 500),
      isLoginShell:
        /Signing in with Glitch/i.test(document.body?.innerText ?? "") ||
        (/Login to Play/i.test(document.body?.innerText ?? "") &&
          !/Observing Location/i.test(document.body?.innerText ?? "")),
      isLoadingShell:
        /^\s*BIOMES\s+/i.test(document.body?.innerText ?? "") ||
        (/Tip:/i.test(document.body?.innerText ?? "") &&
          !questDebug &&
          !canvases.some((canvas) => canvas.width > 300 && canvas.height > 200)),
      isWakeNameShell: /You vaguely recall a name|Set Name|Setting\.\.\./i.test(
        document.body?.innerText ?? ""
      ),
      hasCompileOverlay:
        /Unhandled Runtime Error|Failed to compile|Application error|Module build failed|SyntaxError|TypeError:/i.test(
          document.body?.innerText ?? ""
        ),
      renderedFrames: Number(window.clientContext?.rendererController?.renderedFrames ?? 0),
      hasSubstantialCanvas: canvases.some((canvas) => canvas.width > 300 && canvas.height > 200),
      questMarkers,
      boards,
    };
  });
}

async function waitForMarkerRuntime(page, expectedMarkerId) {
  const deadline = Date.now() + timeoutMs;
  let lastProbe = null;
  let gateAttempts = 0;
  let nextProgressAt = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await activateHelperMarkers(page).catch(() => undefined);
    lastProbe = await collectMarkerDebug(page);
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
    const expectedMarker = expectedMarkerId
      ? lastProbe.questMarkers.find((candidate) => candidate.id === expectedMarkerId)
      : undefined;
    const expectedMarkerDefinition = expectedMarkerId
      ? HARTHMERE_QUEST_OBJECT_MARKERS.find(
          (candidate) => candidate.id === expectedMarkerId
        )
      : undefined;
    const expectedMarkerReady =
      !expectedMarkerDefinition ||
      expectedMarkerDefinition.dynamic !== "live_entity_helper" ||
      expectedMarker?.visible === true;
    const ready =
      lastProbe.hasSubstantialCanvas &&
      lastProbe.renderedFrames >= 3 &&
      lastProbe.questMarkers.length >= HARTHMERE_QUEST_OBJECT_MARKERS.length &&
      lastProbe.boards.length >= HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.length &&
      !lastProbe.isLoginShell &&
      !lastProbe.isLoadingShell &&
      !lastProbe.isWakeNameShell &&
      expectedMarkerReady;
    if (ready) {
      return lastProbe;
    }
    if (Date.now() >= nextProgressAt) {
      console.log(
        `WAIT marker runtime: frames=${lastProbe.renderedFrames} markers=${lastProbe.questMarkers.length} boards=${lastProbe.boards.length} loading=${lastProbe.isLoadingShell} login=${lastProbe.isLoginShell} name=${lastProbe.isWakeNameShell} canvas=${lastProbe.hasSubstantialCanvas} expected=${expectedMarkerId ?? "<none>"} expectedVisible=${expectedMarker?.visible ?? "<not-found>"} body=${JSON.stringify(lastProbe.bodySample.slice(0, 120))}`
      );
      nextProgressAt = Date.now() + 15_000;
    }
    await delay(750);
  }
  throw new Error(`marker runtime did not become ready:\n${JSON.stringify(lastProbe, null, 2)}`);
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

async function captureVerifiedScreenshot(page, screenshotPath, markerId) {
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
    `${markerId} screenshot never reached a varied in-game view: ${JSON.stringify(
      lastStats
    )}`
  );
}

function expectedPositionForVisualId(markerId) {
  const dedicatedBoard = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
    (board) =>
      board.id === markerId ||
      (markerId === "harthmere_market_posting_board" &&
        board.id === "harthmere_grove_market_jobs_board") ||
      (markerId === "harthmere_town_market_posting_board" &&
        board.id === "harthmere_town_market_jobs_board")
  );
  if (dedicatedBoard) {
    return [dedicatedBoard.x, dedicatedBoard.y, dedicatedBoard.z];
  }
  return harthmereJobsBoardQuestMarkerPositionForId(markerId)?.position;
}

async function smokeVisualMarker(page, markerId) {
  const position = expectedPositionForVisualId(markerId);
  assert(position, `no visual position for ${markerId}`);
  await gotoMarker(page, markerId, position);
  const probe = await waitForMarkerRuntime(page, markerId);
  const marker = probe.questMarkers.find((candidate) => candidate.id === markerId);
  const board = probe.boards.find(
    (candidate) =>
      candidate.id === markerId ||
      (markerId === "harthmere_market_posting_board" &&
        candidate.id === "harthmere_grove_market_jobs_board") ||
      (markerId === "harthmere_town_market_posting_board" &&
        candidate.id === "harthmere_town_market_jobs_board")
  );
  if (marker) {
    const distance = Math.hypot(
      Number(marker.position?.[0]) - Number(position[0]),
      Number(marker.position?.[2]) - Number(position[2])
    );
    check(marker.visible === true, `${markerId} renderer marker is visible`);
    check(distance <= 0.25, `${markerId} renderer marker uses expected XZ`, JSON.stringify({ marker, position, distance }));
  } else if (board) {
    check(board.visible === true, `${markerId} dedicated jobs-board renderer is visible`);
    check(
      Math.hypot(
        Number(board.position?.[0]) - Number(position[0]),
        Number(board.position?.[2]) - Number(position[2])
      ) <= 0.25,
      `${markerId} jobs-board renderer uses expected XZ`,
      JSON.stringify({ board, position })
    );
  } else {
    check(false, `${markerId} has a visible quest marker or dedicated jobs-board marker`, JSON.stringify(probe));
  }
  const screenshotPath = path.join(artifactsDir, `${markerId}.png`);
  const { stats } = await captureVerifiedScreenshot(
    page,
    screenshotPath,
    markerId
  );
  check(stats.width >= 1000 && stats.height >= 650, `${markerId} screenshot has expected size`);
  check(
    screenshotLooksLikeGameView(stats),
    `${markerId} screenshot is nonblank, varied, and past the loading screen`,
    JSON.stringify(stats)
  );
  const postScreenshotProbe = await collectMarkerDebug(page);
  check(
    !postScreenshotProbe.isLoadingShell &&
      !postScreenshotProbe.isLoginShell &&
      !postScreenshotProbe.isWakeNameShell,
    `${markerId} screenshot captured actual game view, not loading/login shell`,
    JSON.stringify(postScreenshotProbe)
  );
  console.log(`SCREENSHOT ${screenshotPath}`);
}

async function main() {
  console.log("== Harthmere quest marker visual audit current ==");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Artifacts: ${artifactsDir}`);
  console.log(`Visual scope: ${visualScope}`);
  fs.mkdirSync(artifactsDir, { recursive: true });

  const audit = buildAuditSets();
  const unresolved = unresolvedHarthmereJobsBoardQuestMarkerIds(
    audit.requiredMarkerIds.filter((id) => !/^npc_/.test(id))
  );
  check(unresolved.length === 0, "all quest/job marker ids resolve to a world coordinate", unresolved.join(", "));

  const renderedIds = new Set(HARTHMERE_QUEST_OBJECT_MARKERS.map((marker) => marker.id));
  const dedicatedBoardObjectiveIds = new Set([
    "harthmere_market_posting_board",
    "harthmere_town_market_posting_board",
  ]);
  const missingRendered = audit.requiredMarkerIds.filter((id) => {
    const landmark = landmarkForId(id);
    if (landmark?.kind === "npc") return false;
    if (dedicatedBoardObjectiveIds.has(id)) return false;
    return !renderedIds.has(id);
  });
  check(
    missingRendered.length === 0,
    "all non-NPC quest/job targets have a renderer marker or dedicated board renderer",
    missingRendered.join(", ")
  );

  for (const board of [
    HARTHMERE_JOBS_BOARD_LOCATIONS[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID],
    HARTHMERE_JOBS_BOARD_LOCATIONS[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID],
  ]) {
    const rendered = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.id === board.boardId
    );
    check(Boolean(rendered), `${board.displayName} has a procedural jobs-board visual`);
    check(
      rendered &&
        rendered.x === board.location.x &&
        rendered.y === board.location.y &&
        rendered.z === board.location.z,
      `${board.displayName} visual coordinates match server authority`,
      JSON.stringify({ rendered, authority: board.location })
    );
  }

  await waitForServerReady();
  const browser = await playwright.chromium.launch({
    headless:
      process.env.HEADLESS === "0" || process.env.HARTHMERE_E2E_HEADLESS === "0"
        ? false
        : true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--enable-webgl"],
  });
  try {
    await loginWithVisualTestAuth(browser);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);
    const visualSampleIds =
      visualScope === "all"
        ? Array.from(
            new Set([
              "harthmere_market_posting_board",
              "harthmere_town_market_posting_board",
              ...audit.requiredMarkerIds,
            ])
          )
        : Array.from(
            new Set([
              "harthmere_market_posting_board",
              "harthmere_town_market_posting_board",
              ...audit.monsterHuntMarkerIds,
              "live_helper_muck_scarred_helix",
              "live_helper_old_well_exotic_residue",
              "live_helper_bluewater_supply_route",
              "grove_garden_edge_berries",
              "grove_repair_fence",
              "grove_mail_bank_satchel",
              "harthmere_market_office",
              "harthmere_chapel_stone",
              "harthmere_bridge_center",
              "refinery_intake_marker",
              "hunter_larder_marker",
            ])
          );
    for (const markerId of visualSampleIds) {
      await smokeVisualMarker(page, markerId);
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
