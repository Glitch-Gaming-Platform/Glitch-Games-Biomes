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
    assert.match(
      runner,
      /skillsOnly \|\|\s*chaseOnly \|\|\s*hillCombatOnly \|\|\s*retaliationOnly \|\|\s*hoePurchaseOnly/
    );
    assert.match(runner, /url\.searchParams\.set\("lowMemory", "1"\)/);
    assert.match(runner, /biomes\.harthmere\.partialTerrainRecoveryReloaded/);
  });

  it("keeps ambient track cancellation transient only for the non-audio hill gate", () => {
    assert.match(runner, /const abortedHillCombatAmbientMusicTransition =/);
    assert.match(
      runner,
      /\(hillCombatOnly \|\| retaliationOnly\) &&\s*errorText === "net::ERR_ABORTED"[\s\S]*asset_data\\\/audio\\\/\[\^\?\]\+\\\.webm/
    );
    assert.match(runner, /const abortedHillCombatChapter1StoryPoll =/);
    assert.match(
      runner,
      /request\.method\(\) === "POST" &&\s*url === `\$\{baseUrl\}\/api\/harthmere\/chapter1_story`/
    );
  });

  it("can focus retaliation without replaying unrelated giant traversal", () => {
    assert.match(runner, /HARTHMERE_E2E_RETALIATION_ONLY/);
    assert.match(runner, /HARTHMERE_E2E_RETALIATION_SOLO_ROTATION/);
    assert.match(runner, /proveNativeMultiplayerRetaliationRoundTrip/);
    assert.match(runner, /const sourceId = roadSeed\.entityId/);
    assert.match(
      runner,
      /const sourcePackSeeds = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS\.filter/
    );
    assert.match(runner, /const sourcePackIds = sourcePackSeeds\.map/);
    assert.match(runner, /const soloId = retaliationOnlySeed\.entityId/);
    assert.match(
      runner,
      /const HARTHMERE_RETALIATION_BROWSER_FIXTURE_POSITION = \[\s*781\.227, 66, -180\.855/
    );
    assert.match(
      runner,
      /proveNativeMultiplayerRetaliationRoundTrip\(first, \[\s*\.\.\.HARTHMERE_RETALIATION_BROWSER_FIXTURE_POSITION/
    );
    assert.match(runner, /originalCombatNpcs = await Promise\.all/);
    assert.match(runner, /buildHarthmereLiveCreatureEntity/);
    assert.match(runner, /missing authored fixtures restored from production seeds/);
    assert.match(
      runner,
      /originalCombatNpcs = originalCombatNpcs\.map\(\(row, index\) => \(\{[\s\S]*entity: canonicalCombatNpcs\[index\]/
    );
    assert.match(runner, /const restorableCombatNpcs = originalCombatNpcs\.filter/);
    assert.match(runner, /new UpdateNpcHealthEvent/);
    assert.match(
      runner,
      /equipFocusedNativeCombatItem\(\s*first,\s*"training_dagger",\s*combatPosition/
    );
    assert.match(runner, /originalPlayerInventory = Inventory\.clone/);
    assert.match(runner, /originalPlayerSelectedItem = originalPlayer\.entity\.selected_item/);
    assert.match(runner, /originalPlayerTriggerState = TriggerState\.clone/);
    assert.match(runner, /selected_item: originalPlayerSelectedItem \?\? null/);
    assert.match(runner, /group fixtures settle without stale targets/);
    assert.match(runner, /const scenarioFailures = \[\]/);
    assert.match(runner, /scenarioFailures\.push\(`group:/);
    assert.match(runner, /scenarioFailures\.push\(`solo:/);
    assert.match(runner, /throw new AggregateError/);
    assert.match(
      runner,
      /\[\.\.\.sourcePackIds, strangerId\]\.map\(\(id\) => \(\{[\s\S]*npc_metadata: null/
    );
    assert.match(runner, /const soloParticipantProbe = async \(\) =>/);
    assert.match(runner, /nextSoloParticipantReassertAt = Date\.now\(\) \+ 1_000/);
    assert.match(runner, /const publishEncounterPlayerPose = async/);
    assert.match(runner, /nextGroupParticipantReassertAt = Date\.now\(\) \+ 1_000/);
    assert.match(
      runner,
      /restorableCombatNpcs\.map\(\(\{ entity \}\) => \(\{\s*kind: "update",\s*entity/
    );
    assert.match(runner, /authored pack distributes across both nearby players/);
    assert.match(runner, /E2E solitary retaliation floor/);
    assert.match(runner, /deterministic unit-covered diagnostic/);
    assert.match(runner, /HARTHMERE_E2E_HILL_COMBAT_SKIP_GIANT/);
    assert.match(runner, /if \(!hillCombatSkipGiant\) \{/);
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
