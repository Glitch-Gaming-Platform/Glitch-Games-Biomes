/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const WORLD_INTERACTION_FILES = [
  "src/client/components/challenges/Chapter1NativeObjectivePrompt.tsx",
  "src/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteraction.tsx",
  "src/client/components/harthmere_business/HarthmereBusinessLiveContainer.tsx",
  "src/client/components/harthmere_home/HarthmereHomeConsoleLiveContainer.tsx",
  "src/client/components/challenges/HarthmereGatheringNodeWorldInteraction.tsx",
  "src/client/components/challenges/HarthmereLootDropWorldInteraction.tsx",
  "src/client/components/challenges/HarthmereUnifiedHUD.tsx",
] as const;

describe("world interaction F/E keys", () => {
  it("registers world prompts instead of installing competing keyboard listeners", () => {
    for (const relative of WORLD_INTERACTION_FILES) {
      const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
      assert.match(
        source,
        /useWorldInteractionCandidate/,
        `${relative} must register with the central dispatcher`
      );
    }
  });

  it("keeps one dispatcher with repeat and editable-target guards", () => {
    const source = fs.readFileSync(
      path.join(
        ROOT,
        "src/client/components/challenges/worldInteractionDispatcher.ts"
      ),
      "utf8"
    );
    assert.match(source, /event\.repeat/);
    assert.match(source, /input/);
    assert.match(source, /textarea/);
    assert.match(source, /select/);
    assert.match(source, /isContentEditable/);
    assert.equal(
      source.match(/window\.addEventListener\("keydown"/g)?.length,
      1,
      "the dispatcher must own exactly one world-interaction key listener"
    );
  });

  it("mounts hidden Harthmere runtime controllers in production HUD", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "src/client/components/QuestAndMinimapHUD.tsx"),
      "utf8"
    );
    assert.match(source, /process\.env\.NODE_ENV !== "production"/);
    assert.match(source, /<HarthmereUnifiedHUD hideLegacyVisuals \/>/);
  });

  it("keeps the right-side Grove tracker out of the in-world HUD", () => {
    const source = fs.readFileSync(
      path.join(
        ROOT,
        "src/client/components/challenges/HarthmereUnifiedHUD.tsx"
      ),
      "utf8"
    );
    const branchStart = source.indexOf(
      "if (legacyVisualsHidden) {\n    return ("
    );
    assert.notEqual(branchStart, -1, "production render branch is missing");
    const productionBranch = source.slice(
      branchStart,
      source.indexOf("\n  return (", branchStart + 1)
    );
    assert.doesNotMatch(productionBranch, /<SnapshotGroveMapHUD \/>/);
    assert.match(productionBranch, /<SnapshotGroveTutorChatPanel \/>/);
    assert.equal(
      source.match(/<SnapshotGroveMapHUD \/>/g)?.length,
      1,
      "the Grove tracker should only render inside the opened map panel"
    );
  });
});
