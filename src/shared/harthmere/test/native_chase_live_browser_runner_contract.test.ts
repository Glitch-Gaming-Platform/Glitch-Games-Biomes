/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../../../..");
const runner = fs.readFileSync(
  path.join(
    root,
    "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs"
  ),
  "utf8"
);

describe("native chase live-browser runner contract", () => {
  it("boots chase-only users on known terrain before opening the browser", () => {
    assert.match(runner, /if \(chaseOnly\) \{\s*const chasePlayerChange/);
    assert.match(
      runner,
      /position: Position\.create\(\{ v: \[\.\.\.FOCUSED_E2E_SAFE_START\] \}\)/
    );
    assert.match(
      runner,
      /health: Health\.create\(\{ hp: 1_000_000, maxHp: 1_000_000 \}\)/
    );
    assert.match(
      runner,
      /player_status: PlayerStatus\.create\(\{ init: true \}\)/
    );
    assert.match(runner, /death_info: null/);
    assert.match(runner, /focused chase player bootstrap failed/);
  });

  it("uses the bounded low-memory terrain profile for chase-only rendering", () => {
    assert.match(runner, /skillsOnly \|\|\s*chaseOnly \|\|\s*hoePurchaseOnly/);
    assert.match(runner, /url\.searchParams\.set\("lowMemory", "1"\)/);
    assert.match(runner, /biomes\.harthmere\.partialTerrainRecoveryReloaded/);
  });

  it("never lets the chase browser actor fall through unloaded terrain", () => {
    assert.match(runner, /focused chase player tweaks were unavailable/);
    assert.match(runner, /tweaks\.syncPlayerPosition = false/);
    assert.match(runner, /tweaks\.permitVoidMovement = false/);
  });

  it("bounds a full-world Anima observation without assuming a straight path", () => {
    assert.match(runner, /HARTHMERE_E2E_CHASE_OBSERVATION_TIMEOUT_MS/);
    assert.match(runner, /displacement >= 3/);
    assert.match(runner, /approach >= 2/);
    assert.doesNotMatch(
      runner,
      /position\[0\] >= upperStepPosition\[0\] \+ 0\.75/
    );
    assert.match(
      runner,
      /HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND \*\s*chaseElapsedSeconds/
    );
  });
});
