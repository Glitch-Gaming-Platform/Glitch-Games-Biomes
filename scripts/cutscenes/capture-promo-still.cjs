#!/usr/bin/env node
"use strict";
/*
CAPTURE_PROMO_STILL — one command from a warm stack to a branded PNG.

  node scripts/cutscenes/capture-promo-still.cjs dungeon-portal
  node scripts/cutscenes/capture-promo-still.cjs dungeon-portal --at 3.8
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
  * Enter through the gated visual-auth bridge. A raw /at URL can render WebGL
    while still showing Login to Play; that page has no live player or valid
    terrain/ECS streaming observer and will produce empty distant captures.
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
const DEFAULT_TIMEOUT_MS = Number(process.env.PROMO_CAPTURE_TIMEOUT_MS || 240_000);

function parseArgs(argv) {
  const out = { id: undefined, at: undefined, run: "1", list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") out.list = true;
    else if (a === "--at") out.at = argv[++i];
    else if (a === "--run") out.run = argv[++i];
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
      console.log(`      shot "${scene.shotId}" @ ${scene.captureAt}s ` +
        `(0..${scene.captureAtMax}s)  -> ${scene.filename}`);
    }
    console.log("\nLegacy bespoke still: exotic-matter");
    process.exit(args.id ? 0 : 2);
  }

  const scene = registry.promoSceneById(args.id);
  if (!scene) {
    console.error(`unknown promo still "${args.id}". Try --list.`);
    process.exit(2);
  }

  const extra = { captureRun: String(args.run) };
  if (args.at !== undefined) extra.captureAt = String(args.at);
  if (SYNC_BASE_URL) {
    extra.harthmere_native_ecs_e2e = "1";
    extra.syncBaseUrl = SYNC_BASE_URL;
    extra.glitch_auto_play = "1";
  }
  const url = registry.promoCaptureAuthUrl(scene, ORIGIN, extra);

  console.log(`scene   ${scene.id}`);
  console.log(`shot    ${scene.shotId} @ ${args.at ?? scene.captureAt}s`);
  console.log(`url     ${url}`);
  console.log("");

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
  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    page.on("console", (msg) => {
      const t = msg.text();
      if (/error|fail|cancel/i.test(t)) console.log(`  [page] ${t}`);
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    console.log("page loaded; waiting for capture (software WebGL is slow)...");

    const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
    let state;
    while (Date.now() < deadline) {
      try {
        state = await page.evaluate(() => {
          const el = document.getElementById("biomes-promo-capture-output");
          if (!el || !el.textContent) return undefined;
          try {
            return JSON.parse(el.textContent);
          } catch {
            return undefined;
          }
        });
      } catch (error) {
        const message = String(error);
        if (
          /execution context was destroyed|cannot find context with specified id|most likely because of a navigation/i.test(
            message
          )
        ) {
          // The visual-auth bridge intentionally replaces its document while
          // redirecting to the observer route. That navigation is progress,
          // not a failed capture; resume polling in the new page context.
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw error;
      }
      // A queued request is not a started scene, and a started scene is not a
      // finished one. Only "complete" or "error" are terminal.
      if (state && (state.status === "complete" || state.status === "error")) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!state) {
      throw new Error(
        "no capture output was published. The promo hook never ran — check " +
          "that the URL kept ?cutscenePromo= and that the client mounted."
      );
    }
    if (state.status === "error") {
      throw new Error(`capture failed in page: ${state.error}`);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const branded = path.join(OUT_DIR, scene.filename);
    const raw = path.join(
      OUT_DIR,
      scene.filename.replace(/\.png$/, "-raw.png")
    );
    fs.writeFileSync(branded, decodeDataUri(state.dataUri));
    fs.writeFileSync(raw, decodeDataUri(state.rawDataUri));

    console.log("");
    console.log(`branded  ${path.relative(ROOT, branded)}`);
    console.log(`raw      ${path.relative(ROOT, raw)}`);
    console.log(`camera   ${JSON.stringify(state.cameraPosition)} ` +
      `${JSON.stringify(state.cameraOrientation)}`);
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
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`);
  process.exit(1);
});
