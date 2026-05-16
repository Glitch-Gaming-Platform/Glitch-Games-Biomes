#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const { makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere live B-key animation action-chain tests v1", root);
const url = process.env.HARTHMERE_E2E_URL || "http://localhost:3000/at/Joe";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 45000);

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
      window.__harthmereAnimationActionChainLog = [];
      const push = (type, detail) => {
        window.__harthmereAnimationActionChainLog.unshift({
          at: Date.now(),
          type,
          detail,
        });
        window.__harthmereAnimationActionChainLog.length = Math.min(window.__harthmereAnimationActionChainLog.length, 100);
      };
      window.addEventListener("biomes:harthmere-attack-animation", (event) => push("attack-animation", event.detail));
      window.addEventListener("biomes:harthmere-player-sword-visual", (event) => push("player-sword-visual", event.detail));
      window.addEventListener("biomes:harthmere-combat-effect", (event) => push("combat-effect", event.detail));
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForFunction(() => Boolean(window.__harthmereHardCombatKeyRouter), { timeout: timeoutMs });

    await page.evaluate(() => {
      // The action animation should not depend on debug mode being enabled.
      window.localStorage.removeItem("biomes.localDev.harthmere.combatDebug");
      window.__harthmereAnimationActionChainLog = [];
      window.__harthmereForwardArcRuntime = {
        position: [0, 53.05, 0],
        forward: [1, 0],
        bodyForward: [1, 0],
        movementForward: [0, -1],
        viewForward: [0, -1],
        yaw: Math.PI / 2,
        at: Date.now(),
        source: "animation_action_chain_live_test",
      };
    });

    // First B may draw the weapon depending on persisted state. After a short
    // cooldown, the next B must resolve a real basic attack animation chain.
    await page.keyboard.press("KeyB");
    await new Promise((resolve) => setTimeout(resolve, 650));
    await page.evaluate(() => {
      window.__harthmereForwardArcRuntime = {
        position: [0, 53.05, 0],
        forward: [1, 0],
        bodyForward: [1, 0],
        movementForward: [0, -1],
        viewForward: [0, -1],
        yaw: Math.PI / 2,
        at: Date.now(),
        source: "animation_action_chain_live_test",
      };
    });
    await page.keyboard.press("KeyB");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = await page.evaluate(() => {
      const logs = window.__harthmereAnimationActionChainLog || [];
      const routerLog = window.__harthmereHardCombatKeyRouter?.log?.() || window.__harthmereHardCombatKeyRouterLog || [];
      const attackEvents = logs.filter((entry) => entry.type === "attack-animation");
      const swordEvents = logs.filter((entry) => entry.type === "player-sword-visual");
      const combatEvents = logs.filter((entry) => entry.type === "combat-effect");
      const lastSwing = combatEvents.find((entry) => entry.detail?.visualKind === "player_swing" || entry.detail?.playerSwing === true);
      const runtime = window.__harthmereForwardArcRuntime;
      const swingForward = lastSwing?.detail?.swingForward;
      const bodyForward = runtime?.bodyForward;
      let dot;
      if (Array.isArray(swingForward) && Array.isArray(bodyForward)) {
        const sl = Math.hypot(Number(swingForward[0]), Number(swingForward[1])) || 1;
        const bl = Math.hypot(Number(bodyForward[0]), Number(bodyForward[1])) || 1;
        dot = (Number(swingForward[0]) / sl) * (Number(bodyForward[0]) / bl) + (Number(swingForward[1]) / sl) * (Number(bodyForward[1]) / bl);
      }
      return {
        logs,
        routerLog,
        attackEvents,
        swordEvents,
        combatEvents,
        lastSwing,
        runtime,
        dot,
      };
    });

    report.check("KeyB was captured by the hard Harthmere router", result.routerLog.some((entry) => entry?.code === "KeyB" || entry?.action === "basic"), result.routerLog.slice(0, 10).map((entry) => JSON.stringify(entry)));
    report.check("KeyB produced a basic attack-animation event", result.attackEvents.some((entry) => entry.detail?.attack === "basic"), result.attackEvents.map((entry) => JSON.stringify(entry)));
    report.check("KeyB produced a visible sword attack animation event without combatDebug", result.swordEvents.some((entry) => entry.detail?.action === "attack" && entry.detail?.attack === "basic"), result.swordEvents.map((entry) => JSON.stringify(entry)));
    report.check("KeyB produced a physical player_swing combat effect", result.combatEvents.some((entry) => entry.detail?.visualKind === "player_swing" && entry.detail?.effectKind === "physical"), result.combatEvents.map((entry) => JSON.stringify(entry)).slice(0, 20));
    report.check("player_swing carries swingForward", Array.isArray(result.lastSwing?.detail?.swingForward), JSON.stringify(result.lastSwing));
    report.check("attack animation direction matches visible bodyForward", typeof result.dot === "number" && result.dot > 0.98, `dot=${result.dot}; runtime=${JSON.stringify(result.runtime)}; swing=${JSON.stringify(result.lastSwing?.detail?.swingForward)}`);
  } finally {
    await browser.close();
  }

  report.finish();
}

main().catch((error) => {
  report.fail("live animation action-chain test completed", error && error.stack ? error.stack : String(error));
  report.finish();
});
