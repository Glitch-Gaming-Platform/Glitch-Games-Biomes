import assert from "assert";
import fs from "fs";
import path from "path";

describe("quest-giver frame inspection", () => {
  it("routes Road Ahead storage frames through container semantics, never Talk", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/client/components/overlays/inspected/placeables/FramePlaceableOverlayComponent.tsx"
      ),
      "utf8"
    );
    const questContainerBranch = source.indexOf(
      "isNativeRoadAheadQuestObjectLabel(label?.text)"
    );
    const genericQuestBranch = source.indexOf("if (questGiver)");
    assert.ok(questContainerBranch >= 0);
    assert.ok(
      source.includes("allowPlaceableObjectInteraction"),
      "the storage frame must opt into the native container/object route"
    );
    assert.ok(
      source.includes("suppressTalkShortcut"),
      "the storage frame must never expose generated NPC dialogue"
    );
    assert.ok(
      questContainerBranch < genericQuestBranch,
      "the exact container role must win before the generic quest-giver role"
    );
  });

  it("keeps photo and minigame contents ahead of generic quest metadata", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/client/components/overlays/inspected/placeables/FramePlaceableOverlayComponent.tsx"
      ),
      "utf8"
    );
    assert.ok(
      source.indexOf("pictureFrameContents?.photo_id") <
        source.indexOf("if (questGiver)")
    );
    assert.ok(
      source.indexOf("pictureFrameContents?.minigame_id") <
        source.indexOf("if (questGiver)")
    );
  });
});
