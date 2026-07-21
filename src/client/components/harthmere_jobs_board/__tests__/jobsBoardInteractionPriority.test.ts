import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere jobs-board interaction priority", () => {
  it("uses the jobs-board tier in both active world-prompt implementations", () => {
    for (const relativePath of [
      "src/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteraction.tsx",
      "src/client/components/challenges/HarthmereUnifiedHUD.tsx",
    ]) {
      const source = fs.readFileSync(
        path.join(process.cwd(), relativePath),
        "utf8"
      );
      assert.match(
        source,
        /id:\s*`harthmere:jobs-board:[^`]+`[\s\S]{0,180}WORLD_INTERACTION_PRIORITY\.jobsBoard/
      );
    }
  });
});
