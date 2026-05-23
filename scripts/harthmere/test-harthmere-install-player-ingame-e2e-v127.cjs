#!/usr/bin/env node
/*
 * HARTHMERE_INSTALL_PLAYER_INGAME_E2E_V127
 *
 * Step-by-step browser E2E. Each phase of the install_id login flow has a
 * named checkpoint. When the test fails, the report names the first
 * checkpoint that never fired (failedCheckpoint), so the human reading the
 * report knows where to look.
 *
 * Checkpoints (in order):
 *   1. installIdFound          - HARTHMERE_INSTALL_ID_FOUND_V127
 *   2. initialAuthCheck        - HARTHMERE_INITIAL_AUTH_CHECK_V127
 *   3. autoLoginRequest        - HARTHMERE_AUTO_LOGIN_REQUEST_V127  (skipped if already authed)
 *   4. autoLoginResponse       - HARTHMERE_AUTO_LOGIN_RESPONSE_V127 (skipped if already authed)
 *   5. postLoginAuthCheck      - HARTHMERE_POST_LOGIN_AUTH_CHECK_V127
 *   6. preReload               - HARTHMERE_PRE_RELOAD_V127           (skipped if already authed)
 *   7. postReloadAuthed        - HARTHMERE_ALREADY_AUTHED_V127
 *   8. syncUrlResolved         - HARTHMERE_SYNC_URL_RESOLVED_V127
 *   9. syncUrlIsLocal          - resolved URL hostname == window.location.hostname
 *  10. wsConnected             - log.info "WebSocket connected to .../sync"
 *  11. syncBootstrapComplete   - log.info "... bootstrap complete with N changes"
 *  12. contextsBuilt           - log.info "Contexts built, pre-load=..., early=..."
 *  13. clientContext           - window.clientContext !== undefined
 *  14. canvasMounted           - <canvas class="biomes-canvas..."> is visible
 *  15. playerMeshLoaded        - context.resources.cached("/scene/player/mesh", id)
 *  16. framesRendered          - rendererController.renderedFrames >= minRenderedFrames
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
const timeoutMs = Number(arg("timeout-ms", "180000"));
const minRenderedFrames = Number(arg("min-rendered-frames", "30"));
const headlessEnv = String(process.env.HEADLESS ?? "1").toLowerCase();
const headless = !(headlessEnv === "0" || headlessEnv === "false" || headlessEnv === "no");
const artifactsDir = path.resolve(
  process.env.E2E_ARTIFACTS_DIR || "/tmp/harthmere-playboot-e2e-v127"
);
fs.mkdirSync(artifactsDir, { recursive: true });

function requireFromRepo(moduleName) {
  const candidate = path.join(repo, "node_modules", moduleName);
  try {
    return require(candidate);
  } catch (error) {
    try {
      return require(moduleName);
    } catch (fallbackError) {
      console.error(
        `Unable to require ${moduleName}. Run yarn/npm install in ${repo}.`
      );
      throw error;
    }
  }
}

const puppeteer = requireFromRepo("puppeteer");

const launchUrl =
  `${baseUrl}/at?install_id=${encodeURIComponent(installId)}` +
  `&glitch_install_id=${encodeURIComponent(installId)}` +
  `&game_install_id=${encodeURIComponent(installId)}` +
  `&glitch_auto_play=1&e2e=v127&t=${Date.now()}`;

const fatalConsolePatterns = [
  /assert\(secrets\)/i,
  /getGlobalSecrets/i,
  /\/api\/auth\/dev\/login.*500/i,
  /\/sync\/createPlayer.*(UNKNOWN|Not supported)/i,
  /\/sync\/oob: Bad JSON/i,
  /Bad JSON errorCode=404/i,
  /Asset server not enabled/i,
  /ModuleNotFoundError/i,
  /No module named ['"]numpy['"]/i,
  /Empty reply from server/i,
  /Load screen stuck/i,
  /ClientLongLoad/i,
  /Error while initializing client context/i,
  /HARTHMERE_INSTALL_BOOTSTRAP_FAILED_V127/i,
  /HARTHMERE_AUTH_COOKIE_MISSING_V127/i,
];

const remotePlayerMeshPattern = /https:\/\/biomes\.gg\/api\/assets\/player_mesh\.glb/i;
const playerMeshApiPattern = /\/api\/assets\/player_mesh\.glb/i;

function ignoredRequestFailure(url) {
  return (
    /storage\.googleapis\.com\/biomes-static\/gpu-benchmarks\//.test(url) ||
    /fonts\.gstatic\.com\//.test(url) ||
    /fonts\.googleapis\.com\//.test(url)
  );
}

// Ordered list of checkpoints. The first one that's still false on failure is
// reported as failedCheckpoint so the human reading the report knows where to
// look.
const CHECKPOINTS = [
  "installIdFound",
  "initialAuthCheck",
  "autoLoginRequest",
  "autoLoginResponse",
  "postLoginAuthCheck",
  "preReload",
  "postReloadAuthed",
  "syncUrlResolved",
  "syncUrlIsLocal",
  "wsConnected",
  "syncBootstrapComplete",
  "contextsBuilt",
  "clientContext",
  "canvasMounted",
  "playerMeshLoaded",
  "framesRendered",
];

(async () => {
  const failures = [];
  const consoleLines = [];
  const importantResponses = [];
  const requestFailures = [];

  const events = {};
  for (const k of CHECKPOINTS) events[k] = false;
  let resolvedSyncBaseUrl = null;
  let pageHost = null;

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

    pageHost = new URL(launchUrl).hostname;

    page.on("console", (msg) => {
      const text = msg.text();
      consoleLines.push(`${msg.type()}: ${text}`);

      // v127 checkpoint markers
      if (/HARTHMERE_INSTALL_ID_FOUND_V127/.test(text)) events.installIdFound = true;
      if (/HARTHMERE_INITIAL_AUTH_CHECK_V127/.test(text)) events.initialAuthCheck = true;
      if (/HARTHMERE_AUTO_LOGIN_REQUEST_V127/.test(text)) events.autoLoginRequest = true;
      if (/HARTHMERE_AUTO_LOGIN_RESPONSE_V127/.test(text)) events.autoLoginResponse = true;
      if (/HARTHMERE_POST_LOGIN_AUTH_CHECK_V127/.test(text)) events.postLoginAuthCheck = true;
      if (/HARTHMERE_PRE_RELOAD_V127/.test(text)) events.preReload = true;
      if (/HARTHMERE_ALREADY_AUTHED_V127/.test(text)) events.postReloadAuthed = true;

      // Sync URL marker carries the resolved value inline. Parse it out so we
      // can verify the host matches the page host.
      const syncMatch = text.match(
        /HARTHMERE_SYNC_URL_RESOLVED_V127 syncBaseUrl=(\S+)/
      );
      if (syncMatch) {
        events.syncUrlResolved = true;
        resolvedSyncBaseUrl = syncMatch[1];
        try {
          const resolvedHost = new URL(
            resolvedSyncBaseUrl,
            launchUrl
          ).hostname;
          if (
            resolvedHost === pageHost ||
            resolvedHost === "127.0.0.1" ||
            resolvedHost === "localhost"
          ) {
            events.syncUrlIsLocal = true;
          } else {
            fail(
              "ws-host-mismatch",
              `Resolved syncBaseUrl '${resolvedSyncBaseUrl}' (host='${resolvedHost}') ` +
                `does not match page host '${pageHost}'. ` +
                `Likely cause: NEXT_PUBLIC_GLITCH_SYNC_BASE_URL leaked from .env.local.`
            );
          }
        } catch (e) {
          fail("ws-host-mismatch", `Unparseable syncBaseUrl: ${resolvedSyncBaseUrl}`);
        }
      }

      if (/WebSocket connected to .*\/sync/.test(text)) events.wsConnected = true;
      if (/bootstrap complete with /.test(text)) events.syncBootstrapComplete = true;
      if (/Contexts built/.test(text)) events.contextsBuilt = true;

      // Detect attempted-but-failed WS URLs (e.g. ERR_CONNECTION_RESET) and
      // verify their host is local. This is the regression detector for the
      // azurecontainerapps leak.
      const wsFailMatch = text.match(
        /WebSocket connection to ['"]([^'"]+)['"][^]*?failed/
      );
      if (wsFailMatch) {
        try {
          const failedHost = new URL(wsFailMatch[1]).hostname;
          if (
            failedHost !== pageHost &&
            failedHost !== "127.0.0.1" &&
            failedHost !== "localhost"
          ) {
            fail(
              "ws-host-mismatch",
              `WebSocket attempted '${wsFailMatch[1]}' (host='${failedHost}') ` +
                `but page host is '${pageHost}'. Local playboot must use a local sync host.`
            );
          }
        } catch {}
      }

      if (remotePlayerMeshPattern.test(text)) {
        fail("remote-player-mesh", text);
      }
      for (const pattern of fatalConsolePatterns) {
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

      // ERR_ABORTED on /api/auth/check during the planned reload is expected,
      // not fatal. The bootstrap calls /api/auth/check, then while it's still
      // in flight we may call window.location.replace(), which aborts the
      // request. The post-reload page makes a fresh /api/auth/check that
      // succeeds.
      if (
        failure === "net::ERR_ABORTED" &&
        /\/api\/auth\/check/.test(url)
      ) {
        return;
      }

      if (remotePlayerMeshPattern.test(url)) {
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
      const interesting =
        /\/api\/glitch\/harthmere|\/api\/auth\/check|\/sync\/oob|player_mesh\.glb|\.gltf/.test(
          url
        );
      if (interesting) {
        importantResponses.push({
          status,
          url,
          contentType,
          location: headers.location || "",
        });
      }
      if (remotePlayerMeshPattern.test(url)) {
        fail("remote-player-mesh-response", `${status} ${url}`);
      }
      if (playerMeshApiPattern.test(url) && status >= 300) {
        fail(
          "player-mesh-response",
          `${status} ${url} content-type=${contentType} location=${headers.location || ""}`
        );
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
        let localPlayerId;
        let playerMeshLoaded = false;
        try {
          renderedFrames = context?.rendererController?.renderedFrames || 0;
          recordSize = context?.table?.recordSize || 0;
          localPlayerId = context?.resources?.get?.("/scene/local_player")?.id;
          if (localPlayerId) {
            playerMeshLoaded =
              context?.resources?.cached?.("/scene/player/mesh", localPlayerId) !==
              undefined;
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
          hasVisibleGameCanvas: canvasInfo.some(
            (c) => String(c.className).includes("biomes-canvas") && c.visible
          ),
          bodyHasStalledLoading:
            /Loading is unexpectedly stalled|Load screen stuck/i.test(progressText),
          bodyPreview: progressText,
        };
      });

      events.clientContext = lastState.hasClientContext;
      events.canvasMounted = lastState.hasVisibleGameCanvas;
      events.playerMeshLoaded = lastState.playerMeshLoaded;
      events.framesRendered =
        Number(lastState.renderedFrames || 0) >= minRenderedFrames;

      if (lastState.bodyHasStalledLoading) {
        fail("loading-stalled", "Loading UI reported stalled loading");
      }

      const allCheckpointsHit = CHECKPOINTS.every((c) => {
        // After post-reload, autoLoginRequest/Response/preReload are skipped
        // intentionally. Treat them as satisfied once postReloadAuthed fires.
        if (
          events.postReloadAuthed &&
          (c === "autoLoginRequest" ||
            c === "autoLoginResponse" ||
            c === "preReload")
        ) {
          return true;
        }
        return events[c];
      });

      if (allCheckpointsHit && failures.length === 0) {
        success = true;
        break;
      }

      if (failures.length > 0) {
        // Give the page a beat to surface follow-on context, then stop.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    let failedCheckpoint = null;
    if (!success) {
      for (const c of CHECKPOINTS) {
        if (
          events.postReloadAuthed &&
          (c === "autoLoginRequest" ||
            c === "autoLoginResponse" ||
            c === "preReload")
        ) {
          continue;
        }
        if (!events[c]) {
          failedCheckpoint = c;
          break;
        }
      }
    }

    const screenshotPath = path.join(
      artifactsDir,
      success ? "success.png" : "failure.png"
    );
    await page
      .screenshot({ path: screenshotPath, fullPage: false })
      .catch(() => undefined);

    const report = {
      ok: success && failures.length === 0,
      launchUrl,
      timeoutMs,
      minRenderedFrames,
      events,
      checkpointOrder: CHECKPOINTS,
      failedCheckpoint,
      resolvedSyncBaseUrl,
      pageHost,
      lastState,
      failures,
      importantResponses,
      requestFailures,
      consoleTail: consoleLines.slice(-160),
      screenshotPath,
    };
    const reportPath = path.join(artifactsDir, "report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (!report.ok) {
      console.error(
        "FAIL: Harthmere install_id browser E2E did not reach player-in-game."
      );
      console.error(
        JSON.stringify(
          {
            failedCheckpoint,
            events,
            resolvedSyncBaseUrl,
            pageHost,
            failures,
            reportPath,
            screenshotPath,
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    console.log(
      "PASS: Harthmere install_id browser E2E reached player-in-game."
    );
    console.log(
      JSON.stringify(
        { events, resolvedSyncBaseUrl, lastState, reportPath, screenshotPath },
        null,
        2
      )
    );
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
})().catch((error) => {
  console.error("FAIL: E2E runner crashed.");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
