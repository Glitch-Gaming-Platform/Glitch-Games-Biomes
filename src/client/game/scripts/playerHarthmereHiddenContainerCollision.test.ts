import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere hidden container movement collision", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/client/game/scripts/player.ts"),
    "utf8"
  );

  it("does not blanket-disable collision for visible live quest containers", () => {
    assert.doesNotMatch(
      source,
      /isInactiveHarthmereAuthoredContainerCollisionEntity/
    );
    assert.doesNotMatch(source, /isHarthmereContainerObjectLabel/);
    assert.doesNotMatch(source, /readActiveBiomesUIMapPin/);
    assert.match(
      source,
      /entity\?\.id === this\.userId \|\|\s*ruleset\.playerCollisionFilter/
    );
  });

  it("keeps native level HP as the client max-health base", () => {
    assert.match(source, /const nativeBaseMaxHealth =/);
    assert.match(source, /readHarthmereNativeCombatProgression\(/);
    assert.match(source, /harthmereNativeLevelStats\(/);
    assert.match(
      source,
      /const newMaxHealth = nativeBaseMaxHealth \+ maxHealthMod/
    );
    assert.doesNotMatch(source, /const newMaxHealth = 100 \+ maxHealthMod/);
  });
});
