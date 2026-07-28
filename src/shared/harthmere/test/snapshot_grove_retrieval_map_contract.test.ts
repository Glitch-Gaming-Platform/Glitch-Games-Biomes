import assert from "assert";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_QUESTS,
} from "../snapshot_grove_content";
import { harthmereObjectInteractionForLabel } from "../object_interaction_semantics";
import { snapshotGrovePracticeItemFixtureForObjective } from "../snapshot_grove_trigger_contract";

describe("Snapshot Grove retrieval map contract", () => {
  const retrievalRows = SNAPSHOT_GROVE_QUESTS.flatMap((quest) =>
    quest.triggers.flatMap((trigger, objectiveIndex) =>
      trigger === "collect" || trigger === "item_grant"
        ? [{ quest, trigger, objectiveIndex }]
        : []
    )
  );

  it("gives every retrieval objective a visible, usable map landmark", () => {
    assert.ok(retrievalRows.length > 0);
    for (const { quest, objectiveIndex } of retrievalRows) {
      const markerId = quest.markerIds[objectiveIndex];
      const marker = SNAPSHOT_GROVE_LANDMARKS.find(
        (candidate) => candidate.id === markerId
      );
      assert.ok(marker, `${quest.id}[${objectiveIndex}] has no landmark`);
      assert.notEqual(
        marker!.visibleOnWorldMap,
        false,
        `${quest.id}[${objectiveIndex}] is hidden from the map`
      );
      assert.notEqual(
        marker!.kind,
        "npc",
        `${quest.id}[${objectiveIndex}] points at an NPC instead of the item`
      );
      assert.ok(
        snapshotGrovePracticeItemFixtureForObjective(quest, objectiveIndex),
        `${quest.id}[${objectiveIndex}] has no authoritative pickup item`
      );
      const interaction = harthmereObjectInteractionForLabel({
        label: marker!.label,
      });
      assert.ok(
        interaction,
        `${quest.id}[${objectiveIndex}] cannot be retrieved from ${
          marker!.label
        }`
      );
    }
  });

  it("uses item-specific props for the named Grove handoffs", () => {
    const expected = [
      [
        "econ_billys_lost_lunch_pail",
        2,
        "econ_billy_lunch_pail",
        "Billy's Lunch Pail",
        "billys_lunch_pail",
      ],
      [
        "coops_key_hen",
        1,
        "grove_coop_dropped_feed",
        "Coop's Dropped Feed",
        "field_wheat",
      ],
      [
        "letter_for_the_north_gate",
        0,
        "grove_jackie_sealed_letter",
        "Jackie's Sealed Letter",
        "jackies_sealed_letter",
      ],
      [
        "toll_ledger_problem",
        0,
        "grove_luis_bolt_order",
        "Luis's Bolt Order",
        "bolt_order",
      ],
      [
        "tone_beneath_the_road",
        0,
        "mosslawn_sil_tuning_strip",
        "Sil's Tuning Strip",
        "sils_tuning_strip",
      ],
    ] as const;

    for (const [questId, objectiveIndex, markerId, label, itemId] of expected) {
      const quest = SNAPSHOT_GROVE_QUESTS.find(
        (candidate) => candidate.id === questId
      );
      const marker = SNAPSHOT_GROVE_LANDMARKS.find(
        (candidate) => candidate.id === markerId
      );
      assert.equal(quest?.markerIds[objectiveIndex], markerId);
      assert.equal(marker?.label, label);
      assert.equal(marker?.visibleOnWorldMap, true);
      assert.equal(
        snapshotGrovePracticeItemFixtureForObjective(quest!, objectiveIndex)
          ?.itemId,
        itemId
      );
      assert.equal(
        harthmereObjectInteractionForLabel({ label })?.kind,
        "gather"
      );
    }
  });

  it("routes basket ingredients through the marked resource prop", () => {
    const cartQuest = SNAPSHOT_GROVE_QUESTS.find(
      (quest) => quest.id === "cart_that_forgot_its_wheel"
    );
    assert.equal(cartQuest?.markerIds[1], "grove_resource_basket");
    assert.equal(
      snapshotGrovePracticeItemFixtureForObjective(cartQuest!, 1)?.quantity,
      3
    );
    assert.equal(
      harthmereObjectInteractionForLabel({ label: "Rin's Forage Basket" })
        ?.kind,
      "gather"
    );
  });
});
