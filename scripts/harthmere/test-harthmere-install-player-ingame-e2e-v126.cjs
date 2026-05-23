#!/usr/bin/env node
/*
 * HARTHMERE_INSTALL_PLAYER_INGAME_E2E_V126
 * Full install_id browser playboot test. This is intentionally not a marker test:
 * it opens the real /at install URL in Chromium and waits until the client
 * context exists, the sync subscription bootstrapped, and rendered frames prove
 * the player is past the loading screen and in the game.
 */
const fs = require("fs");
const path = require("path");

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env[name.toUpperCase().replace(/-/g, "_")] ?? fallback;
}

const repo = path.resolve(process.argv[2] || process.env.REPO || process.cwd());
const baseUrl = String(arg("base-url", "http://127.0.0.1:3017")).replace(/\/$/, "");
const installId = arg("install-id", "f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7");
const timeoutMs = Number(arg("timeout-ms", "150000"));
const minRenderedFrames = Number(arg("min-rendered-frames", "30"));
const headlessEnv = String(process.env.HEADLESS ?? "1").toLowerCase();
const headless = !(headlessEnv === "0" || headlessEnv === "false" || headlessEnv === "no");
const artifactsDir = path.resolve(process.env.E2E_ARTIFACTS_DIR || "/tmp/harthmere-playboot-e2e-v126");
fs.mkdirSync(artifactsDir, { recursive: true });

function requireFromRepo(moduleName) {
  const candidate = path.join(repo, "node_modules", moduleName);
  try {
    return require(candidate);
  } catch (error) {
    try {
      return require(moduleName);
    } catch (fallbackError) {
      console.error(`Unable to require ${moduleName}. Run yarn/npm install in ${repo}.`);
      throw error;
    }
  }
}

const puppeteer = requireFromRepo("puppeteer");

const launchUrl = `${baseUrl}/at?install_id=${encodeURIComponent(installId)}&glitch_install_id=${encodeURIComponent(installId)}&game_install_id=${encodeURIComponent(installId)}&glitch_auto_play=1&e2e=v126&t=${Date.now()}`;

const fatalPatterns = [
  /assert\(secrets\)/i,
  /getGlobalSecrets/i,
  /\/api\/auth\/dev\/login.*500/i,
  /\/sync\/createPlayer.*(UNKNOWN|Not supported)/i,
  /\/sync\/oob: Bad JSON/i,
  /Bad JSON errorCode=404/i,
  /Asset server not enabled/i,
  /ModuleNotFoundError/i,
  /No module named ['"]numpy['"]/i,
  /ECONNRESET/i,
  /Empty reply from server/i,
  /Load screen stuck/i,
  /ClientLongLoad/i,
  /Error while initializing client context/i,
  /Unhandled exception/i,
  /Uncaught \(in promise\)/i,
];

const remotePlayerMeshPattern = /https:\/\/biomes\.gg\/api\/assets\/player_mesh\.glb/i;
const playerMeshApiPattern = /\/api\/assets\/player_mesh\.glb/i;

const ignoredRequestFailure = (url) => {
  return /storage\.googleapis\.com\/biomes-static\/gpu-benchmarks\//.test(url) ||
    /fonts\.gstatic\.com\//.test(url) ||
    /fonts\.googleapis\.com\//.test(url);
};

(async () => {
  const failures = [];
  const consoleLines = [];
  const importantResponses = [];
  const requestFailures = [];
  const events = {
    installBootstrap: false,
    authCheck200: false,
    wsConnected: false,
    syncBootstrapComplete: false,
    contextsBuilt: false,
    oobOk: false,
    playerMeshRemoteRequested: false,
    playerMeshLocalOk: false,
  };

  let lastState = {};
  let browser;
  const fail = (kind, detail) => {
    const line = `[${kind}] ${detail}`;
    if (!failures.includes(line)) failures.push(line);
  };

  try {
    browser = await puppeteer.launch({
      headless,
      defaultViewport: { width: 1440, height: 900 },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--use-gl=swiftshader",
        "--enable-webgl",
        "--ignore-certificate-errors",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });

    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    page.on("console", (msg) => {
      const text = msg.text();
      consoleLines.push(`${msg.type()}: ${text}`);
      if (/GLITCH_INSTALL_BOOTSTRAP_AUTO_LOGIN_V115/.test(text)) events.installBootstrap = true;
      if (/WebSocket connected to .*\/sync/.test(text)) events.wsConnected = true;
      if (/subscription:.*bootstrap complete/i.test(text)) events.syncBootstrapComplete = true;
      if (/Contexts built/i.test(text)) events.contextsBuilt = true;
      if (remotePlayerMeshPattern.test(text)) {
        events.playerMeshRemoteRequested = true;
        fail("remote-player-mesh", text);
      }
      for (const pattern of fatalPatterns) {
        if (pattern.test(text)) {
          fail("console", text);
          break;
        }
      }
    });

    page.on("pageerror", (error) => {
      fail("pageerror", `${error.name}: ${error.message}\n${error.stack || ""}`);
    });

    page.on("requestfailed", (request) => {
      const url = request.url();
      const failure = request.failure()?.errorText || "unknown";
      requestFailures.push(`${failure} ${url}`);
      if (ignoredRequestFailure(url)) return;
      if (remotePlayerMeshPattern.test(url)) {
        events.playerMeshRemoteRequested = true;
        fail("requestfailed", `${failure} ${url}`);
        return;
      }
      if (/\/api\/|\/sync|player_mesh|\.glb|\.gltf/.test(url)) {
        fail("requestfailed", `${failure} ${url}`);
      }
    });

    page.on("response", async (response) => {
      const url = response.url();
      const status = response.status();
      const headers = response.headers();
      const contentType = headers["content-type"] || "";
      const interesting = /\/api\/glitch\/harthmere|\/api\/auth\/check|\/sync\/oob|player_mesh\.glb|\.gltf/.test(url);
      if (interesting) {
        importantResponses.push({ status, url, contentType, location: headers.location || "" });
      }
      if (/\/api\/auth\/check/.test(url) && status === 200) events.authCheck200 = true;
      if (/\/sync\/oob/.test(url) && status === 200 && !/html/i.test(contentType)) events.oobOk = true;
      if (remotePlayerMeshPattern.test(url)) {
        events.playerMeshRemoteRequested = true;
        fail("remote-player-mesh-response", `${status} ${url}`);
      }
      if (playerMeshApiPattern.test(url)) {
        if (status >= 300) {
          fail("player-mesh-response", `${status} ${url} content-type=${contentType} location=${headers.location || ""}`);
        } else if (/model\/gltf|model\/gltf-binary|application\/octet-stream|application\/json/i.test(contentType) || url.endsWith(".glb")) {
          events.playerMeshLocalOk = true;
        }
      }
      if (/\/sync\/oob/.test(url) && (status >= 300 || /html/i.test(contentType))) {
        fail("oob-response", `${status} ${url} content-type=${contentType}`);
      }
      if (/\/api\//.test(url) && status >= 500) {
        fail("api-5xx", `${status} ${url}`);
      }
    });

    console.log(`Opening ${launchUrl}`);
    await page.goto(launchUrl, { waitUntil: "domcontentloaded" });

    const deadline = Date.now() + timeoutMs;
    let success = false;
    while (Date.now() < deadline) {
      lastState = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll("canvas"));
        const canvasInfo = canvases.map((canvas) => {
          const rect = canvas.getBoundingClientRect();
          return {
            className: canvas.className,
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            rectWidth: rect.width,
            rectHeight: rect.height,
            visible: rect.width > 100 && rect.height > 100,
          };
        });
        const anyWindow = window;
        const context = anyWindow.clientContext;
        const progressText = document.body?.innerText?.slice(0, 2000) || "";
        let renderedFrames = 0;
        let recordSize = 0;
        let localPlayerId = undefined;
        let playerMeshLoaded = false;
        try {
          renderedFrames = context?.rendererController?.renderedFrames || 0;
          recordSize = context?.table?.recordSize || 0;
          localPlayerId = context?.resources?.get?.("/scene/local_player")?.id;
          if (localPlayerId) {
            playerMeshLoaded = context?.resources?.cached?.("/scene/player/mesh", localPlayerId) !== undefined;
          }
        } catch (_) {}
        return {
          href: location.href,
          title: document.title,
          hasClientContext: Boolean(context),
          renderedFrames,
          recordSize,
          localPlayerId,
          playerMeshLoaded,
          canvasCount: canvases.length,
          canvasInfo,
          hasVisibleGameCanvas: canvasInfo.some((c) => String(c.className).includes("biomes-canvas") && c.visible),
          bodyHasStalledLoading: /Loading is unexpectedly stalled|Load screen stuck/i.test(progressText),
          bodyPreview: progressText,
        };
      });

      if (lastState.bodyHasStalledLoading) {
        fail("loading-stalled", "Loading UI reported stalled loading");
      }

      const playerIsIn =
        events.wsConnected &&
        events.syncBootstrapComplete &&
        events.contextsBuilt &&
        lastState.hasClientContext &&
        lastState.playerMeshLoaded &&
        lastState.hasVisibleGameCanvas &&
        Number(lastState.renderedFrames || 0) >= minRenderedFrames;

      if (playerIsIn && failures.length === 0) {
        success = true;
        break;
      }

      if (failures.length > 0) {
        // Keep collecting briefly to capture follow-on errors, but do not wait the full timeout.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const screenshotPath = path.join(artifactsDir, success ? "success.png" : "failure.png");
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);

    const report = {
      ok: success && failures.length === 0,
      launchUrl,
      timeoutMs,
      minRenderedFrames,
      events,
      lastState,
      failures,
      importantResponses,
      requestFailures,
      consoleTail: consoleLines.slice(-120),
      screenshotPath,
    };
    const reportPath = path.join(artifactsDir, "report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (!report.ok) {
      console.error("FAIL: Harthmere install_id browser E2E did not reach player-in-game.");
      console.error(JSON.stringify({ events, lastState, failures, reportPath, screenshotPath }, null, 2));
      process.exit(1);
    }

    console.log("PASS: Harthmere install_id browser E2E reached player-in-game.");
    console.log(JSON.stringify({ events, lastState, reportPath, screenshotPath }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
})().catch((error) => {
  console.error("FAIL: E2E runner crashed.");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
