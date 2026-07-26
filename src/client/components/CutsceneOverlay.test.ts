import { nextCutsceneSpokenSubtitleForTest } from "@/client/components/CutsceneOverlay";
import assert from "assert";

describe("CutsceneOverlay voice retention", () => {
  const voiced = {
    speaker: "Jackie",
    text: "You were gone three days.",
    voice: "azure-speech|voice=en-US-LunaNeural",
  };

  it("retains audio through the subtitle-clear gap between shots", () => {
    assert.deepStrictEqual(
      nextCutsceneSpokenSubtitleForTest({ active: true, current: voiced }),
      voiced
    );
  });

  it("stops an NPC line when player or narration text replaces it", () => {
    assert.strictEqual(
      nextCutsceneSpokenSubtitleForTest({
        active: true,
        current: voiced,
        subtitle: { speaker: "You", text: "Not this small." },
      }),
      undefined
    );
  });

  it("clears retained audio when the cutscene finishes", () => {
    assert.strictEqual(
      nextCutsceneSpokenSubtitleForTest({
        active: false,
        current: voiced,
      }),
      undefined
    );
  });
});
