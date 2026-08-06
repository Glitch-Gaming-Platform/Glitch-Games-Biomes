import assert from "assert";
import { humanReadableHarthmereIdentifier } from "@/shared/harthmere/harthmere_readable_names";
import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";
import { CH1_FRAGMENTS } from "@/shared/harthmere/ch1_fragment_ledger";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";

describe("Harthmere readable names", () => {
  it("removes developer separators and prefixes from identifiers", () => {
    assert.equal(
      humanReadableHarthmereIdentifier("wild_berries"),
      "Wild Berries"
    );
    assert.equal(
      humanReadableHarthmereIdentifier(
        "Get Sealed Package — harthmere_business_outpost_sanitation_clearbarrel"
      ),
      "Get Sealed Package — Sanitation Clearbarrel"
    );
  });

  it("preserves authored human-facing labels", () => {
    assert.equal(
      humanReadableHarthmereIdentifier("Old Supply Box"),
      "Old Supply Box"
    );
  });

  it("uses authored Chapter 1 names instead of exposing internal ids", () => {
    assert.equal(
      humanReadableHarthmereIdentifier("item_bulls_core"),
      "The Bull's Core"
    );
    assert.equal(
      humanReadableHarthmereIdentifier("item_augur9_core_cell"),
      "Core Cell"
    );
    assert.equal(
      humanReadableHarthmereIdentifier("frag_a1_echo_get_back"),
      "Get Back From It"
    );
  });

  it("keeps every authored Chapter 1 player-facing catalog string free of internal ids", () => {
    const strings = [
      ...CH1_ITEMS.flatMap((item) => [
        item.name,
        item.revealedName,
        item.description,
        item.revealedDescription,
      ]),
      ...CH1_FRAGMENTS.flatMap((fragment) => [
        fragment.title,
        fragment.body,
        fragment.revisedBody,
      ]),
      ...CH1_QUESTS.flatMap((quest) => [
        quest.title,
        quest.giver,
        quest.district,
        quest.summary,
        ...quest.steps.flatMap((step) => [
          step.title,
          step.objective,
          step.targetLabel,
          ...(step.inventoryRequirements?.map(
            (requirement) => requirement.label
          ) ?? []),
        ]),
      ]),
    ].filter((value): value is string => Boolean(value));
    const leaks = strings.filter((text) =>
      /\b(?:item|frag|ch1)_[a-z0-9_]+\b/i.test(text)
    );
    assert.deepEqual(leaks, []);
  });
});
