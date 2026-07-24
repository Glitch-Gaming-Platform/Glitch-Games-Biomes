/// <reference types="mocha" />
import assert from "assert";
import { ensureHarthmereNativeItemCatalogue } from "../harthmere_native_bikkie_items";
import { harthmereNativeBiomesIdForItemId } from "../harthmere_native_item_ids";
import {
  HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES,
  HARTHMERE_JOBS_BOARD_EXECUTABLE_ITEM_IDS,
} from "../jobs_board_business_templates";

describe("Jobs Board business native item identities", () => {
  it("maps every executable requirement item to a physical native stack", () => {
    const definitions = new Set(
      ensureHarthmereNativeItemCatalogue().map(({ itemId }) => itemId)
    );
    for (const itemId of HARTHMERE_JOBS_BOARD_EXECUTABLE_ITEM_IDS) {
      assert.ok(definitions.has(itemId), `${itemId} has no item definition`);
      assert.ok(
        harthmereNativeBiomesIdForItemId(itemId),
        `${itemId} has no native Biomes ID`
      );
    }
  });

  it("keeps every authored business-template item executable", () => {
    for (const template of HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES) {
      for (const requirement of template.requirements) {
        if (!requirement.itemId) continue;
        assert.ok(
          HARTHMERE_JOBS_BOARD_EXECUTABLE_ITEM_IDS.has(requirement.itemId),
          `${template.templateId} uses non-executable ${requirement.itemId}`
        );
        assert.ok(
          harthmereNativeBiomesIdForItemId(requirement.itemId),
          `${template.templateId} uses native-unmapped ${requirement.itemId}`
        );
      }
    }
  });
});
