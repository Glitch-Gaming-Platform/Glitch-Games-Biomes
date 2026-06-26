/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const WORLD_INTERACTION_FILES = [
  "src/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteraction.tsx",
  "src/client/components/harthmere_business/HarthmereBusinessLiveContainer.tsx",
  "src/client/components/harthmere_home/HarthmereHomeConsoleLiveContainer.tsx",
  "src/client/components/challenges/HarthmereUnifiedHUD.tsx",
] as const;

function keyHandlerBlocksDefaultPreventedNearInteractKey(source: string) {
  const blocks =
    source.match(
      /const handler = \(event: KeyboardEvent\) => \{[\s\S]*?window\.addEventListener\("keydown", handler, true\);/g
    ) ?? [];
  return blocks.some(
    (block) => /KeyF|KeyE/.test(block) && /event\.defaultPrevented/.test(block)
  );
}

describe("world interaction F/E keys", () => {
  it("does not let stale defaultPrevented state block visible world prompts", () => {
    for (const relative of WORLD_INTERACTION_FILES) {
      const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
      assert.equal(
        keyHandlerBlocksDefaultPreventedNearInteractKey(source),
        false,
        `${relative} should not gate visible F/E prompts on event.defaultPrevented`
      );
    }
  });

  it("keeps repeat and editable-target guards for world prompt hotkeys", () => {
    for (const relative of WORLD_INTERACTION_FILES) {
      const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
      assert.match(source, /event\.repeat/, `${relative} must ignore repeats`);
      assert.match(
        source,
        /input|textarea|select|isContentEditable|eventStartedInEditable|isTypingInBusinessInput/,
        `${relative} must keep text-entry safety`
      );
    }
  });

  it("mounts hidden Harthmere runtime controllers in production HUD", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "src/client/components/QuestAndMinimapHUD.tsx"),
      "utf8"
    );
    assert.match(source, /process\.env\.NODE_ENV !== "production"/);
    assert.match(source, /<HarthmereUnifiedHUD hideLegacyVisuals \/>/);
  });
});
