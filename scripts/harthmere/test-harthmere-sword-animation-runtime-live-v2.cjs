#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const { makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere live sword animation runtime tests v2", root);
const url = process.env.HARTHMERE_E2E_URL || "http://localhost:3000/at/Joe";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 45000);
const settleMs = Number(process.env.HARTHMERE_SWORD_E2E_SETTLE_MS || 550);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch (error) {
    report.fail("puppeteer is installed", "Install dependencies first; this repo usually provides puppeteer through yarn/npm install.");
    report.finish();
    return;
  }

  const browser = await puppeteer.launch({
    headless: process.env.HARTHMERE_E2E_HEADFUL === "1" ? false : "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.on("console", (message) => {
      if (process.env.HARTHMERE_E2E_VERBOSE === "1") {
        console.log(`[browser:${message.type()}] ${message.text()}`);
      }
    });

    await page.evaluateOnNewDocument(() => {
      window.localStorage?.setItem("biomes.localDev.harthmere.rendererVerbose", "1");
      window.localStorage?.setItem("biomes.localDev.harthmere.combatDebug", "1");
      window.__harthmereSwordRuntimeV2Log = [];
      const push = (type, detail) => {
        window.__harthmereSwordRuntimeV2Log.unshift({ at: Date.now(), type, detail });
        window.__harthmereSwordRuntimeV2Log.length = Math.min(window.__harthmereSwordRuntimeV2Log.length, 200);
      };
      window.addEventListener("biomes:harthmere-player-sword-visual", (event) => push("sword-visual", event.detail));
      window.addEventListener("biomes:harthmere-attack-animation", (event) => push("attack-animation", event.detail));
      window.addEventListener("biomes:harthmere-combat-effect", (event) => push("combat-effect", event.detail));
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForFunction(() => Boolean(window.__harthmereRendererDebug), { timeout: timeoutMs });

    const hasSwordDebug = await page.evaluate(() => {
      const debug = window.__harthmereRendererDebug;
      return Boolean(
        debug &&
          (typeof debug.swordState === "function" ||
            typeof debug.playerSword === "function" ||
            typeof debug.swordDebug === "function" ||
            typeof debug.swordSnapshot === "function")
      );
    });
    report.check("renderer exposes sword debug snapshot API", hasSwordDebug, "Expected __harthmereRendererDebug.swordState() or equivalent.");

    await page.evaluate(() => {
      window.__harthmereSwordRuntimeV2Log = [];
      window.__harthmereForwardArcRuntime = {
        position: [10, 53.05, 20],
        forward: [1, 0],
        bodyForward: [1, 0],
        movementForward: [0, -1],
        viewForward: [0, -1],
        yaw: Math.PI / 2,
        at: Date.now(),
        source: "sword_runtime_v2_east",
      };
      window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", {
        detail: { action: "draw", drawn: true, itemId: "iron_longsword", at: Date.now() },
      }));
    });
    await sleep(settleMs);

    const afterDraw = await page.evaluate(() => {
      const debug = window.__harthmereRendererDebug;
      const sword = debug?.swordState?.() ?? debug?.playerSword?.() ?? debug?.swordDebug?.() ?? debug?.swordSnapshot?.() ?? null;
      const log = window.__harthmereSwordRuntimeV2Log || [];
      const rendererLog = debug?.log?.() || [];
      return { sword, log, rendererLog };
    });

    report.check("draw event is observed", afterDraw.log.some((entry) => entry.type === "sword-visual" && entry.detail?.action === "draw" && entry.detail?.drawn === true), afterDraw.log.map((entry) => JSON.stringify(entry)).slice(0, 10));
    report.check("draw sets sword drawn state", afterDraw.sword?.state?.drawn === true || afterDraw.sword?.drawn === true, JSON.stringify(afterDraw.sword));
    report.check("draw plays Draw_24 or ends in IdleDrawn_24", /Draw_24|IdleDrawn_24/.test(String(afterDraw.sword?.activeClip ?? afterDraw.sword?.clip ?? afterDraw.rendererLog?.map((entry) => entry?.clip).join("|"))), JSON.stringify(afterDraw.sword));

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", {
        detail: { action: "attack", attack: "basic", drawn: true, itemId: "iron_longsword", at: Date.now() },
      }));
    });
    await sleep(settleMs);

    const afterBasic = await page.evaluate(() => {
      const debug = window.__harthmereRendererDebug;
      const sword = debug?.swordState?.() ?? debug?.playerSword?.() ?? debug?.swordDebug?.() ?? debug?.swordSnapshot?.() ?? null;
      const rendererLog = debug?.log?.() || [];
      return { sword, rendererLog };
    });
    report.check("basic attack selects BasicSlash_24", /BasicSlash_24/.test(String(afterBasic.sword?.activeClip ?? afterBasic.sword?.clip ?? afterBasic.rendererLog?.map((entry) => entry?.clip).join("|"))), JSON.stringify(afterBasic.sword));

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", {
        detail: { action: "attack", attack: "heavy", drawn: true, itemId: "iron_longsword", at: Date.now() },
      }));
    });
    await sleep(settleMs);

    const afterHeavy = await page.evaluate(() => {
      const debug = window.__harthmereRendererDebug;
      const sword = debug?.swordState?.() ?? debug?.playerSword?.() ?? debug?.swordDebug?.() ?? debug?.swordSnapshot?.() ?? null;
      const rendererLog = debug?.log?.() || [];
      return { sword, rendererLog };
    });
    report.check("heavy attack selects HeavySlash_24", /HeavySlash_24/.test(String(afterHeavy.sword?.activeClip ?? afterHeavy.sword?.clip ?? afterHeavy.rendererLog?.map((entry) => entry?.clip).join("|"))), JSON.stringify(afterHeavy.sword));

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", {
        detail: { action: "sheathe", drawn: false, itemId: "iron_longsword", at: Date.now() },
      }));
    });
    await sleep(settleMs);

    const afterSheathe = await page.evaluate(() => {
      const debug = window.__harthmereRendererDebug;
      const sword = debug?.swordState?.() ?? debug?.playerSword?.() ?? debug?.swordDebug?.() ?? debug?.swordSnapshot?.() ?? null;
      const rendererLog = debug?.log?.() || [];
      return { sword, rendererLog };
    });
    report.check("sheathe sets drawn false", afterSheathe.sword?.state?.drawn === false || afterSheathe.sword?.drawn === false, JSON.stringify(afterSheathe.sword));
    report.check("sheathe plays Sheathe_24", /Sheathe_24/.test(String(afterSheathe.sword?.activeClip ?? afterSheathe.sword?.clip ?? afterSheathe.rendererLog?.map((entry) => entry?.clip).join("|"))), JSON.stringify(afterSheathe.sword));

    const directionResult = await page.evaluate(async () => {
      const debug = window.__harthmereRendererDebug;
      const snapshot = () => debug?.swordState?.() ?? debug?.playerSword?.() ?? debug?.swordDebug?.() ?? debug?.swordSnapshot?.() ?? null;
      window.__harthmereForwardArcRuntime = { position: [10, 53.05, 20], forward: [1, 0], bodyForward: [1, 0], yaw: Math.PI / 2, at: Date.now(), source: "sword_runtime_v2_east" };
      window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", { detail: { action: "draw", drawn: true, itemId: "iron_longsword", at: Date.now() } }));
      await new Promise((resolve) => setTimeout(resolve, 300));
      const east = snapshot();
      window.__harthmereForwardArcRuntime = { position: [10, 53.05, 20], forward: [0, 1], bodyForward: [0, 1], yaw: 0, at: Date.now(), source: "sword_runtime_v2_north" };
      window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", { detail: { action: "draw", drawn: true, itemId: "iron_longsword", at: Date.now() } }));
      await new Promise((resolve) => setTimeout(resolve, 300));
      const north = snapshot();
      const eastYaw = Number(east?.rotation?.y ?? east?.yaw ?? NaN);
      const northYaw = Number(north?.rotation?.y ?? north?.yaw ?? NaN);
      return { east, north, eastYaw, northYaw, yawDelta: Math.abs(eastYaw - northYaw) };
    });

    report.check("sword yaw changes when bodyForward changes", Number.isFinite(directionResult.yawDelta) && directionResult.yawDelta > 0.5, JSON.stringify(directionResult));

    await page.keyboard.press("KeyB");
    await sleep(700);
    await page.keyboard.press("KeyB");
    await sleep(900);
    await page.keyboard.press("KeyN");
    await sleep(900);

    const keyResult = await page.evaluate(() => {
      const log = window.__harthmereSwordRuntimeV2Log || [];
      return {
        basicAttackEvents: log.filter((entry) => entry.type === "sword-visual" && entry.detail?.action === "attack" && entry.detail?.attack === "basic").length,
        heavyAttackEvents: log.filter((entry) => entry.type === "sword-visual" && entry.detail?.action === "attack" && entry.detail?.attack === "heavy").length,
        attackAnimations: log.filter((entry) => entry.type === "attack-animation"),
        combatEffects: log.filter((entry) => entry.type === "combat-effect"),
      };
    });

    report.check("B key eventually emits basic sword attack", keyResult.basicAttackEvents >= 1, JSON.stringify(keyResult));
    report.check("N key emits heavy sword attack when cooldown allows", keyResult.heavyAttackEvents >= 1, JSON.stringify(keyResult));
    report.check("key attacks also emit player body attack animation events", keyResult.attackAnimations.length >= 1, JSON.stringify(keyResult));

  } finally {
    await browser.close();
  }

  report.finish();
}

main().catch((error) => {
  report.fail("live sword animation runtime test completed", error && error.stack ? error.stack : String(error));
  report.finish();
});
