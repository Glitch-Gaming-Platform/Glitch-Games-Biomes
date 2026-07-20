import assert from "assert";
import fs from "fs";
import path from "path";

describe("quest-giver frame inspection", () => {
  it("routes snapshot quest objects through Talk before blank-frame editing", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/client/components/overlays/inspected/placeables/FramePlaceableOverlayComponent.tsx"
      ),
      "utf8"
    );
    const questBranch = source.indexOf("if (questGiver)");
    const blankFrameBranch = source.indexOf(
      "if (pictureFrameContents?.photo_id)"
    );
    assert.ok(questBranch >= 0, "quest-giver frames need a native Talk branch");
    assert.ok(
      source.includes("<CursorInspectionComponent overlay={overlay} />"),
      "the quest-giver frame must use the normal native inspection/dialog path"
    );
    assert.ok(
      questBranch < blankFrameBranch,
      "native quest dialog must win before picture/blank frame routing"
    );
  });
});
