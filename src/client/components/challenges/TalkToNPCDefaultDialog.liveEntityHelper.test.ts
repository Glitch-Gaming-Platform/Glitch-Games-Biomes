/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import { contextForLiveEntityHelperQuestV1 } from "@/client/components/challenges/LocalDevLiveEntityHelperQuests";
import { getLiveEntityHelperQuestForEntityV1 } from "@/shared/harthmere/live_entity_helper_quests_v1";
import type { BiomesId } from "@/shared/ids";

describe("live-entity helper dialog context", () => {
  it("treats default-dialog live entities as helper eligible without NPC metadata", () => {
    const entityId = 232_054_506 as BiomesId;

    const context = contextForLiveEntityHelperQuestV1({
      entityId,
      label: "Frogberry",
      position: [232, 54, -506],
      defaultDialog: "BEEP BOOP BEEP",
    });

    assert.equal(context.hasTalkableDialog, true);
    assert.ok(getLiveEntityHelperQuestForEntityV1(context));
  });
});
