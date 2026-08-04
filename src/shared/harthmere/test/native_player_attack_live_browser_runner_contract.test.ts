/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../../../..");
const runnerPath = path.join(
  root,
  "scripts/harthmere/test-harthmere-native-player-attack-live-browser.cjs"
);
const source = fs.readFileSync(runnerPath, "utf8");

describe("native player-attack live-browser runner contract", () => {
  it("originates attacks from rendered mouse and keyboard input", () => {
    assert.match(source, /page\.mouse\.down\(\{ button: "left" \}\)/);
    assert.match(source, /page\.mouse\.up\(\{ button: "left" \}\)/);
    assert.match(source, /page\.keyboard\.press\("Digit2"\)/);
    assert.match(source, /page\.locator\("canvas\.biomes-canvas"\)/);
  });

  it("never substitutes a direct native damage event for player input", () => {
    assert.doesNotMatch(source, /new\s+UpdateNpcHealthEvent/);
    assert.doesNotMatch(source, /bridgeCall\([^\n]*"publish"/);
    assert.doesNotMatch(source, /gen\/events/);
    assert.match(source, /"getAuthoritative"/);
    assert.match(source, /authoritative HP decrease/);
  });

  it("keeps the feedback modal and escape overlay closed before every click", () => {
    assert.match(source, /Object\.defineProperty\(document, "exitPointerLock"/);
    assert.match(source, /modalKind/);
    assert.match(source, /escapeOverlayVisible/);
    assert.match(source, /reportDialogVisible/);
    assert.match(source, /feedback modal must stay closed/);
    assert.match(source, /document\.elementFromPoint\(x, y\)/);
    assert.match(source, /clickSurface\.pointTag/);
  });

  it("keeps the revived player frozen until combat terrain is loaded", () => {
    assert.match(source, /tweaks\.syncPlayerPosition = false/);
    assert.match(source, /tweaks\.permitVoidMovement = false/);
    assert.match(source, /death_info: null/);
    assert.match(source, /rigid_body: RigidBody\.create/);
    assert.match(source, /revived combat player fixture/);
    assert.match(source, /Number\(local\.entity\?\.health\?\.hp \?\? 0\) > 0/);
    assert.doesNotMatch(source, /page\.reload\(/);
  });

  it("recenters real mouse input before every scenario and supports failed-only reruns", () => {
    assert.match(source, /HARTHMERE_E2E_ATTACK_SCENARIOS/);
    assert.match(source, /HARTHMERE_E2E_ATTACK_SKIP_PROJECTILE_CATALOG/);
    assert.match(source, /HARTHMERE_E2E_ATTACK_SKIP_PERFORMANCE/);
    assert.match(source, /await prepareScenario\(\)/);
    assert.match(source, /await page\.mouse\.move/);
    assert.match(source, /idle centered combat player/);
    assert.match(source, /await page\.mouse\.down/);
    assert.doesNotMatch(
      source,
      /await page\.mouse\.move[\s\S]{0,200}await page\.mouse\.down/
    );
  });

  it("runs the full edge matrix without stopping on a scenario failure", () => {
    assert.match(source, /async function runScenario/);
    assert.match(source, /row\.status = "fail"/);
    assert.match(source, /finally \{\s*row\.finishedAt/);

    const requiredScenarios = [
      "direct melee hit changes authoritative HP",
      "bystander beside crosshair is not hit",
      "out-of-range crosshair target is a whiff",
      "collideable blocker prevents through-wall hit",
      "melee target leaving before impact is not hit",
      "melee windup cannot transfer to a replacement target",
      "actual hotbar switch cancels pending melee impact",
      "dead native target cannot be attacked",
      "protected native target cannot be attacked",
      "health-backed entity without npc metadata is not promised as a hit",
      "nearest collinear target alone receives melee damage",
      "rapid double click produces one committed hit",
      "ranged real input retains launch target and renders projectile",
      "ranged miss still renders a projectile without damaging off-axis target",
      "magic real input shows charge projectile and authoritative hit",
      "actual hotbar switch cancels visible magic charge and damage",
    ];
    for (const scenario of requiredScenarios) {
      assert.ok(
        source.includes(`"${scenario}"`),
        `missing scenario: ${scenario}`
      );
    }
    assert.match(source, /runProjectileCatalog\(page\)/);
  });

  it("persists screenshots and authoritative reports for failures and passes", () => {
    assert.match(source, /page\.screenshot/);
    assert.match(source, /report\.json/);
    assert.match(source, /row\.screenshots\.failure/);
    assert.match(source, /combatPassed/);
    assert.match(source, /catalogPassed/);
  });

  it("waits for deleted fixtures to leave authority, local ECS, and the cursor", () => {
    assert.match(source, /fixture cleanup \$\{ids\.join/);
    assert.match(source, /authoritative\.every\(\(\{ entity \}\) => !entity\)/);
    assert.match(source, /local\.every\(\(\{ entity \}\) => !entity\)/);
    assert.match(source, /cursor\.attackableIds\.every/);
    assert.match(source, /cursor\.hit\?\.kind !== "entity"/);
    assert.match(source, /HARTHMERE_E2E_ATTACK_PREFLIGHT_CLEANUP_IDS/);
    assert.match(source, /await deleteFixtures\(page, preflightCleanupIds\)/);
  });
});
