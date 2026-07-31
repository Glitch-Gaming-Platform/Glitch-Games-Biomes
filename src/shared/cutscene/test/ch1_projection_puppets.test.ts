import { chapter1ProjectionPuppetOverrides } from "@/client/components/challenges/Chapter1WorldProjectionController";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET } from "@/shared/cutscene/puppets";
import assert from "assert";

describe("Chapter 1 projection puppet fallbacks", () => {
  it("publishes a render fallback for a staged human cast member", () => {
    const lou = CH1_NEW_CAST.find((member) => member.key === "lou_ardan")!;
    const [override] = chapter1ProjectionPuppetOverrides({
      staging: [
        {
          entityId: lou.entityId,
          displayName: lou.displayName,
          present: true,
          useSeededBody: true,
          position: [42, 44, -41],
          activity: "waiting",
        },
      ],
      worldPhase: [],
    });

    assert.deepStrictEqual(override.at, [42, 44, -41]);
    assert.strictEqual(override.id, lou.entityId);
    assert.strictEqual(override.ghost?.family, "live_entity");
    assert.strictEqual(override.ghost?.label, lou.displayName);
    assert.strictEqual(
      override.ghost?.asset,
      SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET
    );
  });

  it("publishes the dog fallback for Marrow and none for hidden cast", () => {
    const marrow = CH1_NEW_CAST.find((member) => member.key === "marrow")!;
    const [visible, hidden] = chapter1ProjectionPuppetOverrides({
      staging: [
        {
          entityId: marrow.entityId,
          displayName: marrow.displayName,
          present: true,
          useSeededBody: true,
          position: [1, 2, 3],
          activity: "walking home",
        },
        {
          entityId: marrow.entityId,
          displayName: marrow.displayName,
          present: false,
          useSeededBody: true,
          position: [1, 2, 3],
          activity: "waiting",
        },
      ],
      worldPhase: [],
    });

    assert.deepStrictEqual(visible.ghost, {
      family: "animal",
      asset: "npcs/dog_1",
      label: "Marrow",
    });
    assert.strictEqual(visible.animation, "walk");
    assert.strictEqual(hidden.hidden, true);
    assert.strictEqual(hidden.ghost, undefined);
  });

  it("hides persistent story bodies during isolated catalog playback", () => {
    const lou = CH1_NEW_CAST.find((member) => member.key === "lou_ardan")!;
    const [override] = chapter1ProjectionPuppetOverrides({
      staging: [
        {
          entityId: lou.entityId,
          displayName: lou.displayName,
          present: true,
          useSeededBody: true,
          position: [42, 44, -41],
          activity: "waiting",
        },
      ],
      worldPhase: [],
      isolateCutsceneCast: true,
    });

    assert.strictEqual(override.id, lou.entityId);
    assert.strictEqual(override.hidden, true);
    assert.strictEqual(override.at, undefined);
    assert.strictEqual(override.ghost, undefined);
  });
});
