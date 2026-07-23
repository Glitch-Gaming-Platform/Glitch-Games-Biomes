import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import { Npc } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import { SimulatedNpc } from "@/shared/npc/simulated";
import assert from "assert";

const NPC_ID = 8101 as BiomesId;
const PLAYER_ID = 8102 as BiomesId;

describe("SimulatedNpc public combat state", () => {
  it("publishes and clears the active chase target without exposing private NPC state", () => {
    const entity = Npc.from(
      npcEntity(
        {
          id: NPC_ID,
          typeId: BikkieIds.dMucker,
          position: [0, 0, 0],
        },
        100
      )
    );
    assert.ok(entity);
    const npc = new SimulatedNpc(entity);

    npc.setPublicCombatTarget(PLAYER_ID);
    const acquired = npc.finish();
    assert.equal(
      acquired?.state[0]?.npc_combat_state?.attack_target,
      PLAYER_ID
    );
    assert.equal(acquired?.state[0]?.npc_state, undefined);

    npc.setPublicCombatTarget(undefined);
    const released = npc.finish();
    assert.equal(released?.state[0]?.npc_combat_state, null);
    assert.equal(released?.state[0]?.npc_state, undefined);
  });
});
