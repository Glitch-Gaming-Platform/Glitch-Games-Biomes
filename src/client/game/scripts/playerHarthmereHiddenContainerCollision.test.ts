import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere hidden container movement collision", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/client/game/scripts/player.ts"),
    "utf8"
  );

  it("lets players move through hidden quest containers until the active pin reveals them", () => {
    assert.match(
      source,
      /isInactiveHarthmereAuthoredContainerCollisionEntity/
    );
    assert.match(source, /isHarthmereContainerObjectLabel/);
    assert.match(source, /readActiveBiomesUIMapPin/);
    assert.match(source, /harthmereWorldObjectCandidateIsVisibleForInteraction/);
    assert.match(
      source,
      /entity\?\.id === this\.userId \|\|\s*isInactiveHarthmereAuthoredContainerCollisionEntity\(entity\) \|\|\s*ruleset\.playerCollisionFilter/
    );
  });
});
