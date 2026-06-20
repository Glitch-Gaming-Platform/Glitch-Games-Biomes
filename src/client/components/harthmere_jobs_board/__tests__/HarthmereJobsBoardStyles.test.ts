/// <reference types="mocha" />

import assert from "assert";
import { HARTHMERE_JOBS_BOARD_CSS } from "../HarthmereJobsBoardStyles";

describe("Harthmere jobs board styles", () => {
  it("centers the physical jobs board prompt in the viewport", () => {
    const promptRule = HARTHMERE_JOBS_BOARD_CSS.match(
      /\.harthmere-jobs-prompt\s*\{[^}]+\}/
    )?.[0];

    assert.ok(promptRule, "expected the jobs board prompt rule to exist");
    assert.match(promptRule, /top:\s*50%;/);
    assert.match(promptRule, /left:\s*50%;/);
    assert.match(promptRule, /transform:\s*translate\(-50%,\s*-50%\);/);
    assert.doesNotMatch(promptRule, /bottom:\s*12\.5rem;/);
  });
});
