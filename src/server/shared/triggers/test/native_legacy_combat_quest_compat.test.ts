import assert from "assert";
import { eventTriggerMatchesEventForTest } from "@/server/shared/triggers/leaves/event";
import type { NpcKilledEvent } from "@/shared/firehose/events";
import {
  NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS,
  NATIVE_LEGACY_COMBAT_QUEST_IDS,
  NATIVE_LEGACY_COMBAT_STEP_IDS,
  NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS,
} from "@/shared/harthmere/native_combat_quest_routing";
import type { BiomesId } from "@/shared/ids";
import type { Matcher } from "@/shared/triggers/matcher_schema";

function killed(npcTypeId: BiomesId): NpcKilledEvent {
  return { kind: "npcKilled", entityId: 1 as BiomesId, npcTypeId };
}

function predicateFor(npcTypeId: BiomesId): Matcher {
  return {
    kind: "object",
    fields: [["npcTypeId", { kind: "anyItemEqual", bikkieId: npcTypeId }]],
  };
}

function trigger(
  questId: BiomesId,
  triggerId: BiomesId,
  legacyNpcTypeId: BiomesId
) {
  return {
    questId,
    triggerId,
    eventKind: "npcKilled" as const,
    predicate: predicateFor(legacyNpcTypeId),
  };
}

describe("restored native combat quest compatibility", () => {
  it("counts each restored visual family only for its exact original quest leaf", () => {
    const rows = [
      {
        questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.NUTHIN_TO_MUCK_WITH,
        stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.COBBLED_MUCKLING,
        legacyType: NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.COBBLED_MUCKLING,
        restoredType: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.COBBLED_MUCKLING,
      },
      {
        questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.SEEDY_SAPPERS,
        stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
        legacyType: NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING,
        restoredType: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING,
      },
      {
        questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.JUGGEMENT_DAY,
        stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.EIGHT_JUGGERMUCKERS,
        legacyType: NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER,
        restoredType: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER,
      },
      {
        questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.COMBAT_JUGGMENT_DAY,
        stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
        legacyType: NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER,
        restoredType: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER,
      },
    ] as const;

    for (const row of rows) {
      assert.equal(
        eventTriggerMatchesEventForTest(
          trigger(row.questId, row.stepId, row.legacyType),
          killed(row.restoredType)
        ),
        true
      );
    }
  });

  it("keeps the duplicated board trigger id scoped by quest id", () => {
    const seedy = trigger(
      NATIVE_LEGACY_COMBAT_QUEST_IDS.SEEDY_SAPPERS,
      NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
      NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING
    );
    const jugger = trigger(
      NATIVE_LEGACY_COMBAT_QUEST_IDS.COMBAT_JUGGMENT_DAY,
      NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
      NATIVE_LEGACY_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER
    );
    assert.equal(
      eventTriggerMatchesEventForTest(
        seedy,
        killed(NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER)
      ),
      false
    );
    assert.equal(
      eventTriggerMatchesEventForTest(
        jugger,
        killed(NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING)
      ),
      false
    );
    assert.equal(
      eventTriggerMatchesEventForTest(
        { ...seedy, questId: 999 as BiomesId },
        killed(NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING)
      ),
      false
    );
  });
});
