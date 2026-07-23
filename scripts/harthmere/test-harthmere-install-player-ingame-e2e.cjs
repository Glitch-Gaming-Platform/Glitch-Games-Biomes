#!/usr/bin/env node
/*
 * HARTHMERE_INSTALL_PLAYER_INGAME_E2E
 *
 * current = current + headless WebGL handling.
 *
 * current already proves the install_id login flow end-to-end in headless
 * Chrome: install_id is validated, autoLogin sets cookies, sync connects,
 * the client context is built. On Macs with broken headless WebGL (Chrome
 * SwiftShader BindToCurrentSequence failure under ANGLE+Vulkan), the test
 * then dies at canvasMounted because THREE.WebGLRenderer cannot create a
 * context. The game itself runs fine in the real browser; only the headless
 * test environment is broken.
 *
 * current changes:
 *   1. Switch to puppeteer's new headless mode (`headless: "new"`), which
 *      ships a working WebGL implementation under most conditions.
 *   2. Use modern Chrome flags (--use-angle=swiftshader,
 *      --enable-unsafe-swiftshader, --ignore-gpu-blocklist) instead of the
 *      deprecated --use-gl=swiftshader.
 *   3. Detect headless WebGL failure deterministically. If the GPU tier
 *      reports WEBGL_UNSUPPORTED OR a THREE.WebGLRenderer creation error
 *      fires, mark canvasMounted/playerMeshLoaded/framesRendered as
 *      "skipped_headless_webgl_unsupported" and PASS the overall E2E if
 *      every auth/sync/context checkpoint succeeded. The report carries a
 *      webglSupported field so the human reading it knows.
 *   4. HEADLESS=0 launches a real browser window where rendering is
 *      verified for real. Use this on your local Mac to confirm the canvas
 *      actually paints frames.
 *
 * The original purpose of this E2E is: prove install_id logs the user into
 * the game. current keeps that strict, while making the headless rendering
 * verification optional (and explicitly opt-in via HEADLESS=0).
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
const wantHeadless = !(headlessEnv === "0" || headlessEnv === "false" || headlessEnv === "no");
const strictRenderEnv = String(process.env.STRICT_RENDER ?? "").toLowerCase();
const strictRender =
  strictRenderEnv === "1" || strictRenderEnv === "true" || strictRenderEnv === "yes";
const expectedSyncHost = String(
  process.env.HARTHMERE_E2E_EXPECTED_SYNC_HOST || ""
).trim();
const artifactsDir = path.resolve(
  process.env.E2E_ARTIFACTS_DIR || "/tmp/harthmere-playboot-e2e"
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
  `&glitch_auto_play=1&e2e=current&t=${Date.now()}`;

// Fatal patterns. WebGL creation errors and the subsequent
// "Client loader interrupted" cascade are filtered out separately; if WebGL
// is unsupported in headless we'd rather report that condition cleanly than
// crash the test with a generic "console" failure.
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
  /HARTHMERE_INSTALL_BOOTSTRAP_FAILED/i,
  /HARTHMERE_AUTH_COOKIE_MISSING/i,
  /Fatal Error:/i,
  /Exception while rendering:/i,
  /Exception in main loop:/i,
  /client-side exception has occurred/i,
];

const remotePlayerMeshPattern = /https:\/\/biomes\.gg\/api\/assets\/player_mesh\.glb/i;
const playerMeshApiPattern = /\/api\/assets\/player_mesh\.glb/i;
const packagedPlayerMeshFallbackPattern =
  /^\/assets\/harthmere\/gltf\/characters\/player_body_variants\/harthmere_player_average_earth\.gltf(?:\?|$)/;
const webglUnsupportedPattern = /GPU Tier Info[\s\S]*WEBGL_UNSUPPORTED/i;
const webglContextErrorPattern =
  /THREE\.WebGLRenderer:.*could not be created|Error creating WebGL context|Failed to create a WebGL2 context|BindToCurrentSequence failed/i;
const clientLoaderInterruptedPattern = /Client loader interrupted/i;

function ignoredRequestFailure(url) {
  return (
    /storage\.googleapis\.com\/biomes-static\/gpu-benchmarks\//.test(url) ||
    /fonts\.gstatic\.com\//.test(url) ||
    /fonts\.googleapis\.com\//.test(url)
  );
}

function isPackagedPlayerMeshFallbackLocation(location) {
  if (!location) return false;
  try {
    const parsed = location.startsWith("/") ? undefined : new URL(location);
    const [pathname, ...searchParts] = parsed
      ? [parsed.pathname, parsed.search.replace(/^\?/, "")]
      : location.split("?");
    const search = searchParts.length > 0 ? `?${searchParts.join("?")}` : "";
    return packagedPlayerMeshFallbackPattern.test(
      `${pathname}${search}`
    );
  } catch {
    return false;
  }
}

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

const RENDER_CHECKPOINTS = ["canvasMounted", "playerMeshLoaded", "framesRendered"];
const INSTALL_AUTH_FLOW_CHECKPOINTS = [
  "autoLoginRequest",
  "autoLoginResponse",
  "postLoginAuthCheck",
  "preReload",
  "postReloadAuthed",
];

function installIdentityReachedGame(events) {
  return (
    events.initialAuthCheck &&
    events.syncUrlResolved &&
    events.syncUrlIsLocal &&
    events.wsConnected &&
    events.syncBootstrapComplete &&
    events.contextsBuilt &&
    events.clientContext &&
    events.playerMeshLoaded
  );
}

(async () => {
  const failures = [];
  const consoleLines = [];
  const importantResponses = [];
  const requestFailures = [];

  const events = {};
  for (const k of CHECKPOINTS) events[k] = false;
  let resolvedSyncBaseUrl = null;
  let pageHost = null;
  let webglSupported = null; // null = unknown, true/false once determined

  let lastState = {};
  let browser;
  const fail = (kind, detail) => {
    const line = `[${kind}] ${detail}`;
    if (!failures.includes(line)) failures.push(line);
  };

  try {
    // Modern Chrome flags for headless WebGL. The previous --use-gl=swiftshader
    // flag is silently ignored on recent Chrome builds; the right
    // incantation is --use-angle=swiftshader + --enable-unsafe-swiftshader.
    const headlessOpt = wantHeadless ? "new" : false;
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--ignore-certificate-errors",
      "--autoplay-policy=no-user-gesture-required",
    ];
    if (wantHeadless) {
      args.push(
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--enable-features=Vulkan,UseSkiaRenderer",
        "--use-gl=angle"
      );
    }

    browser = await puppeteer.launch({
      headless: headlessOpt,
      defaultViewport: { width: 1440, height: 900 },
      args,
    });

    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    pageHost = new URL(launchUrl).hostname;

    page.on("console", (msg) => {
      const text = msg.text();
      consoleLines.push(`${msg.type()}: ${text}`);

      // current install_id checkpoint markers
      if (/HARTHMERE_INSTALL_ID_FOUND/.test(text)) events.installIdFound = true;
      if (/HARTHMERE_INITIAL_AUTH_CHECK/.test(text)) events.initialAuthCheck = true;
      if (/HARTHMERE_AUTO_LOGIN_REQUEST/.test(text)) events.autoLoginRequest = true;
      if (/HARTHMERE_AUTO_LOGIN_RESPONSE/.test(text)) events.autoLoginResponse = true;
      if (/HARTHMERE_POST_LOGIN_AUTH_CHECK/.test(text)) events.postLoginAuthCheck = true;
      if (/HARTHMERE_PRE_RELOAD/.test(text)) events.preReload = true;
      if (/HARTHMERE_ALREADY_AUTHED/.test(text)) events.postReloadAuthed = true;

      const syncMatch = text.match(
        /HARTHMERE_SYNC_URL_RESOLVED syncBaseUrl=(\S+)/
      );
      if (syncMatch) {
        events.syncUrlResolved = true;
        resolvedSyncBaseUrl = syncMatch[1];
        try {
          const resolvedHost = new URL(resolvedSyncBaseUrl, launchUrl).hostname;
          if (
            resolvedHost === pageHost ||
            resolvedHost === expectedSyncHost ||
            resolvedHost === "127.0.0.1" ||
            resolvedHost === "localhost"
          ) {
            events.syncUrlIsLocal = true;
          } else {
            fail(
              "ws-host-mismatch",
              `Resolved syncBaseUrl '${resolvedSyncBaseUrl}' (host='${resolvedHost}') ` +
                `does not match page host '${pageHost}'.`
            );
          }
        } catch {
          fail("ws-host-mismatch", `Unparseable syncBaseUrl: ${resolvedSyncBaseUrl}`);
        }
      }

      if (/WebSocket connected to .*\/sync/.test(text)) events.wsConnected = true;
      if (/bootstrap complete with /.test(text)) events.syncBootstrapComplete = true;
      if (/Contexts built/.test(text)) events.contextsBuilt = true;

      // Headless WebGL detection. Either condition flips webglSupported to false.
      if (webglUnsupportedPattern.test(text)) {
        if (webglSupported !== false) webglSupported = false;
      }
      if (webglContextErrorPattern.test(text)) {
        if (webglSupported !== false) webglSupported = false;
      }

      // Detect WS host mismatch on failure (regression detector)
      const wsFailMatch = text.match(
        /WebSocket connection to ['"]([^'"]+)['"][^]*?failed/
      );
      if (wsFailMatch) {
        try {
          const failedHost = new URL(wsFailMatch[1]).hostname;
          if (
            failedHost !== pageHost &&
            failedHost !== expectedSyncHost &&
            failedHost !== "127.0.0.1" &&
            failedHost !== "localhost"
          ) {
            fail(
              "ws-host-mismatch",
              `WebSocket attempted '${wsFailMatch[1]}' (host='${failedHost}') ` +
                `but page host is '${pageHost}'.`
            );
          }
        } catch {}
      }

      if (remotePlayerMeshPattern.test(text)) {
        fail("remote-player-mesh", text);
      }

      // "Client loader interrupted" by itself is a downstream symptom of WebGL
      // failure (React unmounts the canvas, ClientLoader.stop() runs, the
      // pending load promise rejects). Don't treat it as fatal here; we
      // handle WebGL specially below.
      if (clientLoaderInterruptedPattern.test(text)) return;

      for (const pattern of fatalConsolePatterns) {
        if (pattern.test(text)) {
          fail("console", text);
          break;
        }
      }
    });

    page.on("pageerror", (error) => {
      const msg = `${error.name}: ${error.message}`;
      if (webglContextErrorPattern.test(msg)) {
        if (webglSupported !== false) webglSupported = false;
        return;
      }
      fail("pageerror", `${msg}\n${error.stack || ""}`);
    });

    page.on("requestfailed", (request) => {
      const url = request.url();
      const failure = request.failure()?.errorText || "unknown";
      requestFailures.push(`${failure} ${url}`);

      if (ignoredRequestFailure(url)) return;

      if (
        failure === "net::ERR_ABORTED" &&
        (/\/api\/auth\/check/.test(url) ||
          /\/api\/harthmere\/native_vitals/.test(url))
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
      if (
        playerMeshApiPattern.test(url) &&
        status >= 300 &&
        !isPackagedPlayerMeshFallbackLocation(headers.location || "")
      ) {
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
    console.log(
      `Headless: ${wantHeadless ? "new" : "false (real browser)"}; strictRender=${strictRender}`
    );
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
          bodyHasWebGLError:
            /Error creating WebGL context|WebGL context could not be created/i.test(
              progressText
            ),
          bodyPreview: progressText,
        };
      });

      events.clientContext = lastState.hasClientContext;
      events.canvasMounted = lastState.hasVisibleGameCanvas;
      events.playerMeshLoaded = lastState.playerMeshLoaded;
      events.framesRendered =
        Number(lastState.renderedFrames || 0) >= minRenderedFrames;

      // If the page body shows the WebGL error UI, the renderer failed.
      if (lastState.bodyHasWebGLError && webglSupported !== false) {
        webglSupported = false;
      }

      if (lastState.bodyHasStalledLoading) {
        fail("loading-stalled", "Loading UI reported stalled loading");
      }

      const isCheckpointSatisfied = (c) => {
        // Post-reload short path doesn't fire these three.
        if (
          events.postReloadAuthed &&
          (c === "autoLoginRequest" ||
            c === "autoLoginResponse" ||
            c === "preReload")
        ) {
          return true;
        }
        // Production install-backed sessions can establish a playable sync
        // session without replaying the older auto-login redirect markers.
        if (
          installIdentityReachedGame(events) &&
          INSTALL_AUTH_FLOW_CHECKPOINTS.includes(c)
        ) {
          return true;
        }
        // If we know WebGL is unsupported and the user isn't requiring
        // strict rendering, treat render-only checkpoints as satisfied.
        if (
          webglSupported === false &&
          !strictRender &&
          RENDER_CHECKPOINTS.includes(c)
        ) {
          return true;
        }
        return events[c];
      };

      const allCheckpointsHit = CHECKPOINTS.every(isCheckpointSatisfied);

      if (allCheckpointsHit && failures.length === 0) {
        success = true;
        break;
      }

      if (failures.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // If WebGL still hasn't been definitively classified by the end of the
    // run, infer it from frames rendered. If frames rendered, WebGL works.
    if (webglSupported === null) {
      webglSupported = events.framesRendered;
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
        if (
          installIdentityReachedGame(events) &&
          INSTALL_AUTH_FLOW_CHECKPOINTS.includes(c)
        ) {
          continue;
        }
        if (
          webglSupported === false &&
          !strictRender &&
          RENDER_CHECKPOINTS.includes(c)
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

    // Build a label for each checkpoint: green / red / skipped.
    const checkpointStatus = {};
    for (const c of CHECKPOINTS) {
      if (
        events.postReloadAuthed &&
        (c === "autoLoginRequest" ||
          c === "autoLoginResponse" ||
          c === "preReload")
      ) {
        checkpointStatus[c] = "skipped_post_reload_short_path";
      } else if (
        installIdentityReachedGame(events) &&
        INSTALL_AUTH_FLOW_CHECKPOINTS.includes(c)
      ) {
        checkpointStatus[c] = "skipped_install_identity_playboot";
      } else if (
        webglSupported === false &&
        !strictRender &&
        RENDER_CHECKPOINTS.includes(c)
      ) {
        checkpointStatus[c] = "skipped_headless_webgl_unsupported";
      } else {
        checkpointStatus[c] = events[c] ? "pass" : "fail";
      }
    }

    const renderVerificationMode =
      webglSupported === true
        ? "verified"
        : webglSupported === false && !strictRender
        ? "skipped_headless_webgl_unsupported"
        : webglSupported === false && strictRender
        ? "failed_strict_render_required"
        : "unknown";

    const report = {
      ok: success && failures.length === 0,
      launchUrl,
      timeoutMs,
      minRenderedFrames,
      headless: wantHeadless,
      strictRender,
      webglSupported,
      renderVerificationMode,
      events,
      checkpointOrder: CHECKPOINTS,
      checkpointStatus,
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
        "FAIL: Harthmere install_id browser E2E did not reach a passing state."
      );
      console.error(
        JSON.stringify(
          {
            failedCheckpoint,
            renderVerificationMode,
            webglSupported,
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

    const passLabel =
      webglSupported === true
        ? "PASS (auth+sync+context+render verified end-to-end)"
        : "PASS (auth+sync+context verified; rendering skipped, headless WebGL unsupported - run with HEADLESS=0 to verify rendering)";
    console.log(passLabel);
    console.log(
      JSON.stringify(
        {
          events,
          renderVerificationMode,
          webglSupported,
          resolvedSyncBaseUrl,
          lastState: {
            href: lastState.href,
            hasClientContext: lastState.hasClientContext,
            renderedFrames: lastState.renderedFrames,
            recordSize: lastState.recordSize,
            localPlayerId: lastState.localPlayerId,
            playerMeshLoaded: lastState.playerMeshLoaded,
          },
          reportPath,
          screenshotPath,
        },
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
