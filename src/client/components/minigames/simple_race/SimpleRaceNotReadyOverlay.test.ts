import assert from "assert";
import { readFileSync } from "fs";
import path from "path";
import { SimpleRaceFinishOverlayComponent } from "./SimpleRaceFinishOverlayComponent";
import { SimpleRaceStartOverlayComponent } from "./SimpleRaceStartOverlayComponent";

describe("simple race not-ready overlays", () => {
  it("keeps the start and finish overlays importable", () => {
    assert.equal(typeof SimpleRaceStartOverlayComponent, "function");
    assert.equal(typeof SimpleRaceFinishOverlayComponent, "function");
  });

  for (const fileName of [
    "SimpleRaceStartOverlayComponent.tsx",
    "SimpleRaceFinishOverlayComponent.tsx",
  ]) {
    it(`${fileName} shows missing-line copy without logging it as a client error`, () => {
      const source = readFileSync(path.join(__dirname, fileName), "utf8");

      assert.doesNotMatch(source, /setError\(notReadyReason\)/);
      assert.match(source, /error=\{error \?\? notReadyReason\}/);
    });
  }
});
