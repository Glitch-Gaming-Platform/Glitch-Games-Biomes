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
});
