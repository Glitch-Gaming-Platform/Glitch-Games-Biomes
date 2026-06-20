/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";
import { HARTHMERE_JOBS_BOARD_CSS } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardStyles";

describe("harthmere gathering node world interaction styles", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/client/components/challenges/HarthmereGatheringNodeWorldInteraction.tsx"
    ),
    "utf8"
  );

  it("uses a gathering-specific prompt class without resizing every jobs prompt", () => {
    assert.match(
      source,
      /className="harthmere-jobs-prompt harthmere-gathering-node-prompt"/
    );
    assert.match(
      source,
      /data-harthmere-gathering-node-world-prompt="active"/
    );
    assert.match(source, /harthmere-gathering-node-prompt__key-group/);
    assert.match(source, /harthmere-gathering-node-prompt__verb/);

    const gatherRule = HARTHMERE_JOBS_BOARD_CSS.match(
      /\.harthmere-gathering-node-prompt\s*\{[^}]+\}/
    )?.[0];
    assert.ok(gatherRule, "expected gathering prompt rule to exist");
    assert.match(gatherRule, /font-size:\s*0\.82rem;/);
    assert.match(
      gatherRule,
      /min-width:\s*min\(19rem,\s*calc\(100vw - 2rem\)\);/
    );
    assert.match(
      gatherRule,
      /max-width:\s*min\(23rem,\s*calc\(100vw - 2rem\)\);/
    );
    assert.match(gatherRule, /border-radius:\s*8px;/);
  });

  it("renders requirement, failed feedback, and success details as state pills", () => {
    assert.match(
      source,
      /harthmere-gathering-node-prompt__detail--\$\{detailState\}/
    );
    assert.match(source, /data-state=\{detailState\}/);

    const detailRule = HARTHMERE_JOBS_BOARD_CSS.match(
      /\.harthmere-gathering-node-prompt__detail\s*\{[^}]+\}/
    )?.[0];
    assert.ok(detailRule, "expected detail pill base rule to exist");
    assert.match(detailRule, /border-radius:\s*6px;/);
    assert.match(detailRule, /text-transform:\s*none;/);

    const requirementRule = HARTHMERE_JOBS_BOARD_CSS.match(
      /\.harthmere-gathering-node-prompt__detail--requirement\s*\{[^}]+\}/
    )?.[0];
    assert.ok(requirementRule, "expected amber requirement rule to exist");
    assert.match(requirementRule, /color:\s*#fde68a;/);
    assert.match(
      requirementRule,
      /background:\s*rgba\(245,\s*158,\s*11,\s*0\.16\);/
    );

    const errorRule = HARTHMERE_JOBS_BOARD_CSS.match(
      /\.harthmere-gathering-node-prompt__detail--error\s*\{[^}]+\}/
    )?.[0];
    assert.ok(errorRule, "expected red error rule to exist");
    assert.match(errorRule, /color:\s*#fecaca;/);
    assert.match(errorRule, /background:\s*rgba\(239,\s*68,\s*68,\s*0\.18\);/);
  });
});
