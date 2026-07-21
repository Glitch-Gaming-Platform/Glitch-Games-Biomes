import assert from "assert";
import { NpcRespawnService } from "@/server/spawn/respawn_service";
import { npcEntity } from "@/server/spawn/spawn_npc";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { BikkieIds } from "@/shared/bikkie/ids";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { Expires, NpcState } from "@/shared/ecs/gen/components";
import { harthmereRespawningLiveCreatureSeedIds } from "@/shared/harthmere/live_entity_production_seed";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";

describe("NpcRespawnService native persistence", () => {
  it("rehydrates a dead fixed-id creature and revives that same ECS entity", async () => {
    const now = secondsSinceEpoch();
    const fixedId = harthmereRespawningLiveCreatureSeedIds()[0];
    const base = npcEntity(
      {
        id: fixedId,
        typeId: BikkieIds.dMucker,
        position: [10, 20, 30],
        orientation: [0, 0],
      },
      now - 60
    );
    const custom = deserializeNpcCustomState(base.npc_state?.data);
    (custom as any).harthmereRespawnAt = now - 1;
    const dead = {
      ...base,
      health: { ...base.health!, hp: 0 },
      npc_state: NpcState.create({
        data: serializeNpcCustomState(custom),
      }),
      expires: Expires.create({ trigger_at: now + 60 }),
    };

    const world = new InMemoryWorld();
    world.applyChanges([{ kind: "create", entity: dead }]);
    const worldApi = ShimWorldApi.createForWorld(world);
    const service = new NpcRespawnService(
      {
        next: async () => {
          throw new Error(
            "fixed-id respawn must not allocate a replacement id"
          );
        },
        batch: async () => {
          throw new Error("fixed-id respawn must not allocate replacement ids");
        },
      },
      worldApi
    );
    await service.start(world.table);
    await (service as any).tick();
    await service.stop();

    const revived = world.table.get(fixedId)!;
    assert.ok(revived.health!.hp > 0);
    assert.equal(revived.id, fixedId);
    assert.equal(revived.expires, undefined);
    assert.deepEqual(revived.position?.v, [10, 20, 30]);
  });
});
