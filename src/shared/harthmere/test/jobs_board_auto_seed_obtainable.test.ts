/// <reference types="mocha" />
import assert from "assert";
import {
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES,
  harthmereAutoSeedTemplateRequirementsObtainable,
} from "../mmo_jobs_board_authority";
import { isKnownHarthmereJobsBoardExecutableItemId } from "../jobs_board_business_templates";

// HARTHMERE_JOBS_BOARD_AUTO_SEED_OBTAINABLE_REQUIREMENTS
// Locks the invariant that auto-seeded jobs only require obtainable items, so a
// player can never be handed a posting that can never be completed.
describe("jobs board auto-seed obtainable requirements", () => {
  it("allows requirements whose items are all in the executable set", () => {
    assert.strictEqual(
      harthmereAutoSeedTemplateRequirementsObtainable([
        { itemId: "raw_exotic_matter" },
        { itemId: "iron_ore" },
        { itemId: "sealed_package" },
        { itemId: "wild_berries" },
      ]),
      true
    );
  });

  it("allows target-only requirements (no itemId)", () => {
    assert.strictEqual(
      harthmereAutoSeedTemplateRequirementsObtainable([{}, {}]),
      true
    );
  });

  it("rejects requirements referencing a non-obtainable placeholder item", () => {
    // These ids were auto-seeded but exist nowhere as loot/vendor/craft output.
    for (const phantom of [
      "apple_basket",
      "harthmere_ledger_pouch",
      "courier_pouch",
      "iron_lantern",
    ]) {
      assert.strictEqual(
        isKnownHarthmereJobsBoardExecutableItemId(phantom),
        false,
        `${phantom} should not be a known executable item`
      );
      assert.strictEqual(
        harthmereAutoSeedTemplateRequirementsObtainable([{ itemId: phantom }]),
        false,
        `a template requiring ${phantom} must be excluded from auto-seeding`
      );
    }
  });

  it("every auto-seed template that survives the filter requires only obtainable items", () => {
    const surviving = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter((t) =>
      harthmereAutoSeedTemplateRequirementsObtainable(t.requirements)
    );
    for (const tpl of surviving) {
      for (const req of tpl.requirements) {
        if (req.itemId) {
          assert.ok(
            isKnownHarthmereJobsBoardExecutableItemId(req.itemId),
            `surviving template ${tpl.templateId} requires unobtainable item ${req.itemId}`
          );
        }
      }
    }
    assert.ok(surviving.length > 0, "expected auto-seed templates to survive");
  });
});
