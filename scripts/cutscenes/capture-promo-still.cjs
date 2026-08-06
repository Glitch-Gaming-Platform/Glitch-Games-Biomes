#!/usr/bin/env node
"use strict";
/*
CAPTURE_PROMO_STILL — one command from a warm stack to a branded PNG.

  node scripts/cutscenes/capture-promo-still.cjs dungeon-portal
  node scripts/cutscenes/capture-promo-still.cjs dungeon-portal --at 3.8
  node scripts/cutscenes/capture-promo-still.cjs boss-gilded-bull \
    --camera-preset three-quarter-left \
    --output-dir artifacts/cutscenes/bull-three-quarter-left
  node scripts/cutscenes/capture-promo-still.cjs --list

Writes artifacts/cutscenes/<filename>            (branded)
       artifacts/cutscenes/<filename basename>-raw.png  (unbranded engine frame)

WHY A SCRIPT AND NOT JUST A URL
The URL in docs/cutscenes.md works, but it makes you: open a tab, wait an
unknown amount of time, poll a hidden JSON element by hand, base64-decode the
payload with the `;base64,` gotcha, and write two files. That is five chances
to get it wrong and no failure signal if the scene cancels. This does all of
it and exits non-zero when the capture did not happen.

PREREQUISITE: the stack must already be up.
  node scripts/harthmere/e2e-jump.cjs ready

LESSONS ENCODED HERE (each cost a real debugging session, see docs/cutscenes.md)
  * Authenticate through the gated visual-auth bridge in a disposable page,
    then open the raw /at URL in a clean second page. The bridge is required for
    a live player, but reusing its redirected document can leave the first game
    tab in a frame-zero spin while a second tab in the same context loads.
  * Wait for `status: "complete"`, never for the tab to merely load. A queued
    request is not a started scene, and a started scene is not a finished one.
  * Split the data URI on `;base64,` — NOT on the first comma. Codec MIME types
    like `codecs=vp9,opus` contain an earlier comma and will corrupt the file.
  * Software WebGL is slow. The default timeout is generous on purpose.
  * A cancelled scene publishes `status: "error"`; surface it instead of
    writing a blank PNG.
*/

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "artifacts/cutscenes");
const ORIGIN = process.env.HARTHMERE_E2E_URL || "http://localhost:3000";
const SYNC_BASE_URL = process.env.HARTHMERE_E2E_SYNC_BASE_URL;
const HEADED_CAPTURE = process.env.PROMO_CAPTURE_HEADED === "1";
const DEFAULT_TIMEOUT_MS = Number(
  process.env.PROMO_CAPTURE_TIMEOUT_MS || 240_000
);
const AUTH_STORAGE_KEY = "harthmere.biomesAuth";

function isForbiddenLegacyHost(hostname) {
  if (hostname === "fonts.googleapis.com" || hostname === "fonts.gstatic.com") {
    return false;
  }
  return [
    "biomes.gg",
    "firebaseio.com",
    "firebasedatabase.app",
    "storage.googleapis.com",
    "storage.cloud.google.com",
    "appspot.com",
  ].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function isGameAssetUrl(value) {
  const pathname = new URL(value).pathname;
  return (
    pathname.startsWith("/assets/") ||
    /\.(?:glb|gltf|fbx|obj|mtl|png|jpe?g|webp|wasm|mp3|webm|ogg)(?:$|\?)/i.test(
      pathname
    )
  );
}

function parseArgs(argv) {
  const out = {
    id: undefined,
    at: undefined,
    run: "1",
    list: false,
    cameraPreset: undefined,
    outputDir: undefined,
    printUrl: false,
    authUser: process.env.PROMO_CAPTURE_AUTH_USER || "Chapter1Marketing",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") out.list = true;
    else if (a === "--at") out.at = argv[++i];
    else if (a === "--run") out.run = argv[++i];
    else if (a === "--camera-preset") out.cameraPreset = argv[++i];
    else if (a === "--output-dir") out.outputDir = argv[++i];
    else if (a === "--auth-user") out.authUser = argv[++i];
    else if (a === "--print-url") out.printUrl = true;
    else if (!a.startsWith("-") && !out.id) out.id = a;
  }
  return out;
}

/** Split a data URI correctly. See the header note about `codecs=vp9,opus`. */
function decodeDataUri(dataUri) {
  const marker = ";base64,";
  const at = dataUri.indexOf(marker);
  if (at < 0) {
    throw new Error("capture payload is not a base64 data URI");
  }
  return Buffer.from(dataUri.slice(at + marker.length), "base64");
}

async function writeFailureDiagnostics(page, sceneId, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const diagnostic = path.join(
    outputDir,
    `promo-capture-diagnostic-${sceneId}.png`
  );
  console.log(`diagnostic url ${page.url()}`);
  try {
    const bodyText = await page.locator("body").innerText({ timeout: 1_000 });
    console.log(
      `diagnostic body ${bodyText.replace(/\s+/g, " ").trim().slice(0, 1_000)}`
    );
  } catch (error) {
    console.log(`diagnostic body unavailable: ${String(error)}`);
  }
  try {
    await page.screenshot({ path: diagnostic, timeout: 2_000 });
    console.log(`diagnostic screenshot ${path.relative(ROOT, diagnostic)}`);
  } catch (error) {
    console.log(`diagnostic screenshot unavailable: ${String(error)}`);
  }
}

async function loadRegistry() {
  // The registry is TypeScript; run through ts-node so this stays a single
  // source of truth with the client instead of duplicating scene metadata.
  require("ts-node/register");
  require("tsconfig-paths/register");
  return require(path.join(ROOT, "src/shared/cutscene/promo_scenes.ts"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry();

  if (args.list || !args.id) {
    console.log("Registered promo stills:\n");
    for (const scene of registry.PROMO_SCENES) {
      console.log(`  ${scene.id}`);
      console.log(`      ${scene.brand.subtitle}`);
      console.log(
        `      shot "${scene.shotId}" @ ${scene.captureAt}s ` +
          `(0..${scene.captureAtMax}s)  -> ${scene.filename}`
      );
    }
    console.log("\nLegacy bespoke still: exotic-matter");
    process.exit(args.id ? 0 : 2);
  }

  const registeredScene = registry.promoSceneById(args.id);
  if (!registeredScene) {
    console.error(`unknown promo still "${args.id}". Try --list.`);
    process.exit(2);
  }
  let scene;
  try {
    scene = registry.promoSceneWithBossCameraPreset(
      registeredScene,
      args.cameraPreset
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  const outputDir = args.outputDir
    ? path.resolve(ROOT, args.outputDir)
    : OUT_DIR;

  const extra = { captureRun: String(args.run) };
  if (args.at !== undefined) extra.captureAt = String(args.at);
  if (args.cameraPreset) extra.cameraPreset = args.cameraPreset;
  if (SYNC_BASE_URL) {
    extra.harthmere_native_ecs_e2e = "1";
    extra.syncBaseUrl = SYNC_BASE_URL;
    extra.glitch_auto_play = "1";
  }
  let captureUrl = registry.promoCaptureUrl(scene, ORIGIN, extra);
  if (scene.runtimeScenery) {
    // Authenticated coordinate `/at/x/y/z` is a position-observer route. Its
    // Sync-target swap can delete the entity the client table still considers
    // local, which hard-fails before authored Underways scenery streams. Enter
    // interactive `/at` instead; promo_capture.ts then moves the real player
    // through the existing gated teleport hook before the director starts.
    const playerRoute = new URL(captureUrl);
    playerRoute.pathname = "/at";
    captureUrl = playerRoute.toString();
  }
  const authApiUrl = new URL("/api/harthmere/visual_test_auth", ORIGIN);
  authApiUrl.searchParams.set("usernameOrId", args.authUser);

  console.log(`scene   ${scene.id}`);
  console.log(`shot    ${scene.shotId} @ ${args.at ?? scene.captureAt}s`);
  if (scene.cameraPreset) console.log(`camera  ${scene.cameraPreset}`);
  console.log(`auth    ${authApiUrl}`);
  console.log(`url     ${captureUrl}`);
  console.log(`output  ${path.relative(ROOT, outputDir) || "."}`);
  console.log("");

  if (args.printUrl) {
    console.log("URL validated; --print-url skips Playwright and capture.");
    return;
  }

  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error(
      "playwright is not available. Either install it, or open the URL above\n" +
        "in a real browser and read #biomes-promo-capture-output by hand."
    );
    process.exit(3);
  }

  const browser = await chromium.launch({
    headless: !HEADED_CAPTURE,
    args: [
      "--no-sandbox",
      ...(HEADED_CAPTURE
        ? ["--ignore-gpu-blocklist"]
        : [
            // The engine needs a GL context; on headless hosts that means
            // SwiftShader. Desktop capture intentionally keeps the native GPU.
            "--use-gl=swiftshader",
            "--enable-unsafe-swiftshader",
          ]),
      "--disable-dev-shm-usage",
    ],
  });
  let context;
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    const harPath = path.join(
      outputDir,
      `promo-capture-network-${scene.id}.har`
    );
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordHar: { path: harPath, content: "omit" },
    });
    let forbiddenLegacyUrl;
    const assetRequests = new Map();
    const assetRequestByHandle = new Map();
    const assetRequestRecords = [];
    await context.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      const hostname = requestUrl.hostname;
      if (isForbiddenLegacyHost(hostname)) {
        forbiddenLegacyUrl ??= route.request().url();
        console.log(`  [blocked legacy request] ${forbiddenLegacyUrl}`);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    // BrowserContext.request shares this context's cookie jar, so the auth API
    // installs the HttpOnly session without navigating any page. Mirror the
    // returned session into storage before the first game script executes.
    // This avoids accidentally booting an intermediate homepage with the old
    // cloud Sync sentinel while preserving the production authentication path.
    const authResponse = await context.request.get(authApiUrl.toString());
    if (!authResponse.ok()) {
      throw new Error(
        `visual auth failed (${authResponse.status()} ${authResponse.statusText()})`
      );
    }
    const auth = await authResponse.json();
    const authSession = {
      userId: String(auth.userId),
      sessionId: String(auth.sessionId),
      createdAtMs: Date.now(),
    };
    await context.addInitScript(
      ({ storageKey, session }) => {
        const serialized = JSON.stringify(session);
        window.__HARTHMERE_BIOMES_AUTH_SESSION = session;
        window.localStorage.setItem(storageKey, serialized);
        window.sessionStorage.setItem(storageKey, serialized);
      },
      { storageKey: AUTH_STORAGE_KEY, session: authSession }
    );
    console.log("visual auth primed without navigating a game page...");

    const page = await context.newPage();
    page.on("websocket", (webSocket) => {
      const url = webSocket.url();
      console.log(`  [websocket] ${url}`);
      if (isForbiddenLegacyHost(new URL(url).hostname)) {
        forbiddenLegacyUrl ??= url;
      }
    });
    page.on("request", (request) => {
      if (isGameAssetUrl(request.url())) {
        assetRequests.set(request.url(), "pending");
        const record = {
          order: assetRequestRecords.length,
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
          status: "pending",
          startedAtMs: Date.now(),
        };
        assetRequestRecords.push(record);
        assetRequestByHandle.set(request, record);
      }
    });
    page.on("response", (response) => {
      if (isGameAssetUrl(response.url())) {
        assetRequests.set(response.url(), String(response.status()));
        const record = assetRequestByHandle.get(response.request());
        if (record) {
          record.status = String(response.status());
          record.statusText = response.statusText();
          record.contentType = response.headers()["content-type"];
          record.respondedAtMs = Date.now();
        }
      }
    });
    page.on("requestfinished", (request) => {
      const record = assetRequestByHandle.get(request);
      if (record) {
        record.finishedAtMs = Date.now();
      }
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "unknown";
      console.log(`  [request failed] ${failure} ${request.url()}`);
      if (isGameAssetUrl(request.url())) {
        assetRequests.set(request.url(), `failed:${failure}`);
        const record = assetRequestByHandle.get(request);
        if (record) {
          record.status = `failed:${failure}`;
          record.finishedAtMs = Date.now();
        }
      }
    });
    page.on("console", (msg) => {
      const t = msg.text();
      if (
        /error|fail|cancel|webgl renderer info|contexts built|promo|capture|renderer.*ready/i.test(
          t
        )
      ) {
        console.log(`  [page] ${t}`);
      }
    });
    page.on("pageerror", (error) => {
      console.log(`  [pageerror] ${String(error)}`);
    });

    await page.goto(captureUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    console.log("page loaded; waiting for capture (software WebGL is slow)...");

    const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
    let state;
    let lastStateKey;
    while (Date.now() < deadline) {
      if (forbiddenLegacyUrl) {
        throw new Error(
          `capture attempted forbidden legacy network host: ${forbiddenLegacyUrl}`
        );
      }
      try {
        const text = await page
          .locator("#biomes-promo-capture-output")
          .textContent({ timeout: 1_000 });
        if (text) {
          try {
            state = JSON.parse(text);
          } catch {
            state = undefined;
          }
        }
      } catch (error) {
        const message = String(error);
        if (
          /execution context was destroyed|cannot find context with specified id|most likely because of a navigation|timeout 1000ms exceeded/i.test(
            message
          )
        ) {
          // The visual-auth bridge intentionally replaces its document while
          // redirecting to the observer route. That navigation is progress,
          // not a failed capture. A saturated WebGL frame can also delay a DOM
          // read, so every poll is bounded and the overall deadline remains
          // authoritative instead of hanging forever inside page.evaluate.
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw error;
      }
      // A queued request is not a started scene, and a started scene is not a
      // finished one. Only "complete" or "error" are terminal.
      const stateKey = state
        ? `${state.status}:${state.completed ?? ""}:${state.current ?? ""}`
        : undefined;
      if (stateKey && stateKey !== lastStateKey) {
        console.log(`capture status ${stateKey}`);
        lastStateKey = stateKey;
      }
      if (state && (state.status === "complete" || state.status === "error")) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!state) {
      const summary = [...assetRequests.entries()].reduce(
        (counts, [, status]) => {
          const key = status.startsWith("failed") ? "failed" : status;
          counts[key] = (counts[key] ?? 0) + 1;
          return counts;
        },
        {}
      );
      console.log(`asset request summary ${JSON.stringify(summary)}`);
      const assetAuditPath = path.join(
        outputDir,
        `promo-capture-assets-${scene.id}.json`
      );
      fs.writeFileSync(
        assetAuditPath,
        JSON.stringify(assetRequestRecords, null, 2)
      );
      console.log(`asset audit ${path.relative(ROOT, assetAuditPath)}`);
      for (const record of assetRequestRecords
        .filter((record) => record.status === "pending")
        .slice(0, 25)) {
        console.log(`  [pending asset ${record.order}] ${record.url}`);
      }
      console.log(`network har ${path.relative(ROOT, harPath)}`);
      await writeFailureDiagnostics(page, scene.id, outputDir);
      throw new Error(
        "no capture output was published. The promo hook never ran — check " +
          "that the URL kept ?cutscenePromo= and that the client mounted."
      );
    }
    if (state.status === "pending") {
      await writeFailureDiagnostics(page, scene.id, outputDir);
      throw new Error(
        `capture did not reach a terminal state within ${DEFAULT_TIMEOUT_MS}ms` +
          (state.current ? ` (waiting on ${state.current})` : "")
      );
    }
    if (state.status === "error") {
      throw new Error(`capture failed in page: ${state.error}`);
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const branded = path.join(outputDir, scene.filename);
    const raw = path.join(
      outputDir,
      scene.filename.replace(/\.png$/, "-raw.png")
    );
    fs.writeFileSync(branded, decodeDataUri(state.dataUri));
    fs.writeFileSync(raw, decodeDataUri(state.rawDataUri));
    const definition = await scene.build();
    const shot = definition.shots.find(
      (candidate) => candidate.id === scene.shotId
    );
    const cameraWaypoints =
      shot?.camera.kind === "dolly"
        ? shot.camera.waypoints.map((waypoint) => waypoint.position)
        : undefined;
    const metadata = path.join(outputDir, "capture-metadata.json");
    fs.writeFileSync(
      metadata,
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          scene: scene.id,
          shot: scene.shotId,
          captureAt: Number(args.at ?? scene.captureAt),
          captureRun: String(args.run),
          authUser: args.authUser,
          cameraPreset: scene.cameraPreset ?? "baseline",
          cameraWaypoints,
          fov:
            shot?.actions.find((action) => action.kind === "fov")?.fov ??
            undefined,
          sampledCameraPosition: state.cameraPosition,
          sampledCameraOrientation: state.cameraOrientation,
          origin: ORIGIN,
          syncBaseUrl: SYNC_BASE_URL,
          files: {
            branded: path.basename(branded),
            raw: path.basename(raw),
            har: path.basename(harPath),
          },
        },
        null,
        2
      )}\n`
    );

    console.log("");
    console.log(`branded  ${path.relative(ROOT, branded)}`);
    console.log(`raw      ${path.relative(ROOT, raw)}`);
    console.log(`metadata ${path.relative(ROOT, metadata)}`);
    console.log(
      `camera   ${JSON.stringify(state.cameraPosition)} ` +
        `${JSON.stringify(state.cameraOrientation)}`
    );
    console.log("");
    console.log(
      "Before shipping the frame, verify by eye:\n" +
        "  * the aperture is not clipped by terrain or the camera\n" +
        "  * the player reads as standing BEFORE the gate, not inside it\n" +
        "  * no generic humanoid stands in for a bound actor\n" +
        "  * the brand text has title-safe space and is not over busy pixels\n" +
        "If the moment is off, bracket it: --at 3.6 / 4.2 / 4.8 (--run 2, 3...)."
    );
  } finally {
    await context?.close().catch(() => {});
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`);
  process.exit(1);
});
