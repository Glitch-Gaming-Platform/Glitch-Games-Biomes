/// <reference types="mocha" />
import assert from "assert";
import {
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES_V141,
  harthmereAutoSeedTemplateRequirementsObtainableV1,
} from "../mmo_jobs_board_authority_v1";
import { isKnownHarthmereJobsBoardExecutableItemIdV146 } from "../jobs_board_business_templates_v146";

// HARTHMERE_JOBS_BOARD_AUTO_SEED_OBTAINABLE_REQUIREMENTS_V1
// Locks the invariant that auto-seeded jobs only require obtainable items, so a
// player can never be handed a posting that can never be completed.
describe("jobs board auto-seed obtainable requirements", () => {
  it("allows requirements whose items are all in the executable set", () => {
    assert.strictEqual(
      harthmereAutoSeedTemplateRequirementsObtainableV1([
        { itemId: "raw_exotic_matter" },
        { itemId: "iron_ore" },
      ]),
      true
    );
  });

  it("allows target-only requirements (no itemId)", () => {
    assert.strictEqual(
      harthmereAutoSeedTemplateRequirementsObtainableV1([{}, {}]),
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
        isKnownHarthmereJobsBoardExecutableItemIdV146(phantom),
        false,
        `${phantom} should not be a known executable item`
      );
      assert.strictEqual(
        harthmereAutoSeedTemplateRequirementsObtainableV1([{ itemId: phantom }]),
        false,
        `a template requiring ${phantom} must be excluded from auto-seeding`
      );
    }
  });

  it("every auto-seed template that survives the filter requires only obtainable items", () => {
    const surviving = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES_V141.filter((t) =>
      harthmereAutoSeedTemplateRequirementsObtainableV1(t.requirements)
    );
    for (const tpl of surviving) {
      for (const req of tpl.requirements) {
        if (req.itemId) {
          assert.ok(
            isKnownHarthmereJobsBoardExecutableItemIdV146(req.itemId),
            `surviving template ${tpl.templateId} requires unobtainable item ${req.itemId}`
          );
        }
      }
    }
    // Sanity: the filter actually drops at least the known phantom-item templates.
    const dropped = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES_V141.length - surviving.length;
    assert.ok(dropped >= 1, "expected at least one unobtainable template to be filtered out");
  });
});
