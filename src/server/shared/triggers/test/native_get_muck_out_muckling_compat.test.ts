import assert from "assert";
import { eventTriggerMatchesEventForTest } from "@/server/shared/triggers/leaves/event";
import type { NpcKilledEvent } from "@/shared/firehose/events";
import {
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_MOSSY_MUCKLING_TYPE_ID,
  NATIVE_GET_THE_MUCK_OUT_MUCKLING_STEP_ID,
  NATIVE_GET_THE_MUCK_OUT_RESTORED_MOSSY_MUCKLING_TYPE_ID,
} from "@/shared/harthmere/native_road_ahead_contract";
import type { BiomesId } from "@/shared/ids";
import type { Matcher } from "@/shared/triggers/matcher_schema";

const predicate: Matcher = {
  kind: "object",
  fields: [
    [
      "npcTypeId",
      {
        kind: "anyItemEqual",
        bikkieId: NATIVE_GET_THE_MUCK_OUT_MOSSY_MUCKLING_TYPE_ID,
      },
    ],
  ],
};

function killed(npcTypeId: number): NpcKilledEvent {
  return {
    kind: "npcKilled",
    entityId: 1 as BiomesId,
    npcTypeId: npcTypeId as BiomesId,
  };
}

describe("Get the Muck Out Muckling compatibility", () => {
  const trigger = {
    questId: NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
    triggerId: NATIVE_GET_THE_MUCK_OUT_MUCKLING_STEP_ID,
    eventKind: "npcKilled" as const,
    predicate,
  };

  it("counts the original and restored production Muckling families", () => {
    assert.equal(
      eventTriggerMatchesEventForTest(
        trigger,
        killed(Number(NATIVE_GET_THE_MUCK_OUT_MOSSY_MUCKLING_TYPE_ID))
      ),
      true
    );
    assert.equal(
      eventTriggerMatchesEventForTest(
        trigger,
        killed(Number(NATIVE_GET_THE_MUCK_OUT_RESTORED_MOSSY_MUCKLING_TYPE_ID))
      ),
      true,
      "restored Mossy Muckling"
    );
    assert.equal(
      eventTriggerMatchesEventForTest(trigger, killed(8700372047004309)),
      true,
      "West Breach Muckling"
    );
    assert.equal(
      eventTriggerMatchesEventForTest(trigger, killed(8722418610125863)),
      true,
      "Gravewood Pale Muckling"
    );
  });

  it("does not weaken other NPC types or other kill objectives", () => {
    assert.equal(
      eventTriggerMatchesEventForTest(trigger, killed(8997551883502313)),
      false
    );
    assert.equal(
      eventTriggerMatchesEventForTest(
        { ...trigger, triggerId: 999 as BiomesId },
        killed(8700372047004309)
      ),
      false
    );
  });
});
