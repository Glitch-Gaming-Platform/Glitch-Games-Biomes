import { harthmereE2EControlTokenMatches } from "@/pages/api/harthmere/visual_test_auth";
import assert from "assert";

describe("Harthmere visual-test native ECS authorization", () => {
  it("requires an exact non-empty control token", () => {
    assert.equal(harthmereE2EControlTokenMatches("secret", "secret"), true);
    assert.equal(harthmereE2EControlTokenMatches("secret", "Secret"), false);
    assert.equal(harthmereE2EControlTokenMatches("secret", "short"), false);
    assert.equal(harthmereE2EControlTokenMatches("", ""), false);
    assert.equal(harthmereE2EControlTokenMatches(undefined, "secret"), false);
  });

  it("rejects duplicate/multi-valued token headers", () => {
    assert.equal(
      harthmereE2EControlTokenMatches("secret", ["secret", "secret"]),
      false
    );
  });
});
