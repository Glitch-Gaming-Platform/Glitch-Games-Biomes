import { dedupeTrackableQuestProjections } from "@/client/components/biomes_ui/adapters/questProjectionDedupe";
import { HARTHMERE_NATIVE_QUEST_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";
import assert from "assert";

describe("dedupeTrackableQuestProjections", () => {
  it("prefers the native ECS projection for a mapped Bible quest", () => {
    const authoredId = "starter_apples_for_dawnloaf";
    const nativeId = String(
      HARTHMERE_NATIVE_QUEST_ID_MANIFEST[`bible:${authoredId}`]
    );
    const deduped = dedupeTrackableQuestProjections([
      {
        questId: authoredId,
        title: "Apples for Dawnloaf",
        area: "Harthmere",
        status: "active",
        kind: "bible_side_quest",
      },
      {
        questId: nativeId,
        title: "Apples for Dawnloaf",
        area: "Biomes",
        status: "active",
        kind: "native_ecs_discover",
      },
    ]);

    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].questId, nativeId);
  });

  it("does not merge unrelated compatibility quests without a shared ID", () => {
    const deduped = dedupeTrackableQuestProjections([
      { questId: "job_a", title: "A", area: "Town", status: "active" },
      { questId: "job_b", title: "B", area: "Town", status: "active" },
    ]);
    assert.equal(deduped.length, 2);
  });
});
