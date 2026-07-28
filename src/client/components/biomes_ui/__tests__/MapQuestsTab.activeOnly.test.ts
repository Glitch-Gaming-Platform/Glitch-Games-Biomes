import assert from "assert";

import { activeMapTrackableQuestsForTest } from "@/client/components/biomes_ui/tabs/MapQuestsTab";

describe("MapQuestsTab active quest policy", () => {
  it("keeps completed and failed quests out of the map surface", () => {
    const quests = [
      {
        questId: "active",
        title: "Active Quest",
        area: "The Grove",
        status: "active" as const,
      },
      {
        questId: "completed",
        title: "Completed Quest",
        area: "The Grove",
        status: "completed" as const,
      },
      {
        questId: "failed",
        title: "Failed Quest",
        area: "The Grove",
        status: "failed" as const,
      },
      {
        questId: "available",
        title: "Available Quest",
        area: "The Grove",
        status: "available" as const,
      },
    ];

    assert.deepEqual(
      activeMapTrackableQuestsForTest(quests).map((quest) => quest.questId),
      ["active"]
    );
  });
});
