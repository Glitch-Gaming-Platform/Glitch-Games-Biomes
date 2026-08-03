import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import { NpcMetadata, Size } from "@/shared/ecs/gen/components";
import { Npc } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import {
  LOCAL_DEV_HUMAN_NPC_TYPE_ID,
  getNpcRotateSpeed,
  getNpcRunSpeed,
} from "@/shared/npc/bikkie";
import { SimulatedNpc } from "@/shared/npc/simulated";
import assert from "assert";

describe("SimulatedNpc external ECS refresh", () => {
  it("refreshes native type and size after a live partial-create view completes", () => {
    const id = 8_812_999_999_999_901 as BiomesId;
    const initial = Npc.from(
      npcEntity(
        {
          id,
          typeId: BikkieIds.dMucker,
          position: [10, 20, 30],
        },
        100
      )
    );
    assert.ok(initial);
    const npc = new SimulatedNpc(initial);
    assert.notEqual(npc.type.id, LOCAL_DEV_HUMAN_NPC_TYPE_ID);

    npc.updateFromExternal({
      ...initial,
      npc_metadata: NpcMetadata.create({
        ...initial.npc_metadata,
        type_id: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
      }),
      size: Size.create({ v: [0.75, 1.8, 0.75] }),
    });

    assert.equal(npc.type.id, LOCAL_DEV_HUMAN_NPC_TYPE_ID);
    assert.equal(getNpcRunSpeed(npc.type), 4.4);
    assert.equal(getNpcRotateSpeed(npc.type), 200);
    assert.deepEqual(npc.size, [0.75, 1.8, 0.75]);
  });
});
