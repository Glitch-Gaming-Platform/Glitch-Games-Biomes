import assert from "assert";
import fs from "fs";
import path from "path";
import {
  effectiveLevelForCelebrationForTest,
  HARTHMERE_LEVEL_UP_SOUND_PATH,
  levelUpCelebrationTransitionForTest,
} from "../levelUpCelebrationState";

describe("Harthmere level-up celebration", () => {
  it("waits for native progression hydration before observing a level", () => {
    assert.equal(
      effectiveLevelForCelebrationForTest({
        nativeAuthority: true,
        nativeMigrationVersion: 0,
        nativeLevel: 1,
        legacyLevel: 4,
      }),
      undefined
    );
    assert.equal(
      effectiveLevelForCelebrationForTest({
        nativeAuthority: true,
        nativeMigrationVersion: 2,
        nativeLevel: 4,
        legacyLevel: 1,
      }),
      4
    );
  });

  it("celebrates only a real increase after the initial level is known", () => {
    assert.deepEqual(levelUpCelebrationTransitionForTest(undefined, 4), {
      nextPreviousLevel: 4,
      celebrationLevel: undefined,
    });
    assert.deepEqual(levelUpCelebrationTransitionForTest(4, 5), {
      nextPreviousLevel: 5,
      celebrationLevel: 5,
    });
    assert.deepEqual(levelUpCelebrationTransitionForTest(5, 5), {
      nextPreviousLevel: 5,
      celebrationLevel: undefined,
    });
    assert.deepEqual(levelUpCelebrationTransitionForTest(5, 3), {
      nextPreviousLevel: 3,
      celebrationLevel: undefined,
    });
  });

  it("ships the exact supplied level-up sound", () => {
    const assetPath = path.join(
      process.cwd(),
      "public",
      HARTHMERE_LEVEL_UP_SOUND_PATH
    );
    assert.equal(HARTHMERE_LEVEL_UP_SOUND_PATH.endsWith("384921.mp3"), true);
    assert.equal(fs.existsSync(assetPath), true);
    assert.ok(fs.statSync(assetPath).size > 30_000);
  });
});
