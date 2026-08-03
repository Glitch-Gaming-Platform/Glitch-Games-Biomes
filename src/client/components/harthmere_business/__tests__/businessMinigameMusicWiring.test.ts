import assert from "assert";
import { readFileSync } from "fs";

describe("Harthmere business minigame music wiring", () => {
  it("binds shift music to the active session and authored interior presence", () => {
    const containerSource = readFileSync(
      "src/client/components/harthmere_business/HarthmereBusinessLiveContainer.tsx",
      "utf8"
    );
    const hudSource = readFileSync(
      "src/client/components/harthmere_business/HarthmereBusinessShiftHUD.tsx",
      "utf8"
    );
    const worldSource = readFileSync(
      "src/client/components/harthmere_business/HarthmereBusinessWorldInteraction.tsx",
      "utf8"
    );
    assert.match(containerSource, /insideBusiness=\{context\.insideBusiness/);
    assert.match(hudSource, /harthmereBusinessMinigameMusicTrack/);
    assert.match(hudSource, /setBackgroundMusicOverride/);
    assert.match(worldSource, /harthmereBusinessInteriorContainingPosition/);
    assert.match(
      worldSource,
      /insideBusiness: containingBusinessId === activeBusinessId/
    );
  });
});
