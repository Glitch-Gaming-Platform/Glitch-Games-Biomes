import type { ChangeToApply } from "@/shared/api/transaction";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { idToNpcType } from "@/shared/npc/bikkie";
import { setNpcRespawnEnqueue } from "@/shared/npc/modify_health";
import type { IdGenerator } from "@/server/shared/ids/generator";
import type { WorldApi } from "@/server/shared/world/api";
import { makeSpawnChangeToApply } from "@/server/spawn/spawn_npc";
import { RepeatingAsyncTimer } from "@/shared/util/async";

export const HARTHMERE_NPC_RESPAWN_SERVICE_VERSION_V37 =
  "harthmere-npc-respawn-service-v37";

type RespawnEntry = {
  typeId: BiomesId;
  spawnPosition: [number, number, number];
  spawnOrientation?: [number, number];
  respawnAt: number;
  previousId: BiomesId;
};

export class NpcRespawnService {
  private pending = new Map<BiomesId, RespawnEntry>();
  private timer?: RepeatingAsyncTimer;

  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly worldApi: WorldApi
  ) {
    setNpcRespawnEnqueue((entry) => this.enqueue(entry));
  }

  enqueue(entry: RespawnEntry) {
    this.pending.set(entry.previousId, entry);
    log.debug(
      `Queued NPC respawn: type=${idToNpcType(entry.typeId).name}, ` +
        `at=${entry.respawnAt}, position=[${entry.spawnPosition}]`
    );
  }

  async start() {
    this.timer = new RepeatingAsyncTimer(
      () => this.tick(),
      () => 1000
    );
  }

  async stop() {
    await this.timer?.stop();
    this.timer = undefined;
  }

  private async tick() {
    const now = secondsSinceEpoch();
    const due: RespawnEntry[] = [];
    for (const [key, entry] of this.pending) {
      if (entry.respawnAt <= now) {
        due.push(entry);
        this.pending.delete(key);
      }
    }
    if (due.length === 0) {
      return;
    }

    const ids = await this.idGenerator.batch(due.length);
    const changes: ChangeToApply[] = due.map((entry, index) =>
      makeSpawnChangeToApply(now, {
        id: ids[index],
        typeId: entry.typeId,
        position: entry.spawnPosition,
        orientation: entry.spawnOrientation,
      })
    );

    try {
      await this.worldApi.apply(changes);
      log.info(`Respawned ${due.length} persistent NPC(s).`);
    } catch (error) {
      for (const entry of due) {
        this.pending.set(entry.previousId, {
          ...entry,
          respawnAt: now + 5,
        });
      }
      log.warn(`NPC respawn failed; will retry: ${error}`);
    }
  }
}
