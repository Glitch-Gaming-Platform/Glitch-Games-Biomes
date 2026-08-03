import {
  chapter1ProjectionPuppetOverrides,
  chapter1ProjectionSignature,
} from "@/client/components/challenges/Chapter1WorldProjectionController";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { CH1_SERGEANT_HOLT } from "@/shared/harthmere/ch1_returning_npcs";
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
      appearanceSourceEntityId: marrow.entityId,
    });
    assert.strictEqual(visible.animation, "walk");
    assert.strictEqual(hidden.hidden, true);
    assert.strictEqual(hidden.ghost, undefined);
  });

  it("uses Jackie's archived snapshot body when her shared ECS body is outside subscription", () => {
    const jackie = CH1_NEW_CAST.find((member) => member.key === "jackie")!;
    const [override] = chapter1ProjectionPuppetOverrides({
      staging: [
        {
          entityId: jackie.entityId,
          displayName: jackie.displayName,
          present: true,
          useSeededBody: false,
          position: [476, 70, -129],
          activity: "Keeping the road-house running.",
        },
      ],
      worldPhase: [],
    });

    assert.deepEqual(override.ghost, {
      family: "live_entity",
      asset: "npcs/jackie",
      label: "Jackie",
      appearanceSourceEntityId: jackie.entityId,
    });
  });

  it("uses Holt's authored player-like fallback for his per-player watch-house stage", () => {
    const [override] = chapter1ProjectionPuppetOverrides({
      staging: [
        {
          key: CH1_SERGEANT_HOLT.key,
          entityId: Number(CH1_SERGEANT_HOLT.entityId),
          displayName: CH1_SERGEANT_HOLT.displayName,
          present: true,
          useSeededBody: false,
          position: [...CH1_SERGEANT_HOLT.position],
          activity: "Taking the player's statement.",
        },
      ],
      worldPhase: [],
    });

    assert.deepEqual(override.ghost, {
      family: "live_entity",
      asset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
      label: CH1_SERGEANT_HOLT.displayName,
      appearanceSourceEntityId: Number(CH1_SERGEANT_HOLT.entityId),
    });
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

  it("keeps identical projection polls on one stable publication signature", () => {
    const response = {
      staging: [],
      worldPhase: [{ id: "grove-stable", summary: "The Grove is stable." }],
    };
    assert.strictEqual(
      chapter1ProjectionSignature(response),
      chapter1ProjectionSignature(structuredClone(response))
    );
    assert.notStrictEqual(
      chapter1ProjectionSignature(response),
      chapter1ProjectionSignature({
        ...response,
        worldPhase: [
          { id: "grove-shifted", summary: "The Grove has shifted." },
        ],
      })
    );
  });
});
