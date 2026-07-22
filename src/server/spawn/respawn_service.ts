import type { ChangeToApply } from "@/shared/api/transaction";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { idToNpcType } from "@/shared/npc/bikkie";
import { setNpcRespawnEnqueue } from "@/shared/npc/modify_health";
import type { IdGenerator } from "@/server/shared/ids/generator";
import type { WorldApi } from "@/server/shared/world/api";
import { makeSpawnChangeToApply, npcEntity } from "@/server/spawn/spawn_npc";
import { buildHarthmereLiveCreatureEntity } from "@/server/harthmere/live_entity_ecs_seed";
import { RepeatingAsyncTimer } from "@/shared/util/async";
import { deserializeNpcCustomState } from "@/shared/npc/serde";
import {
  harthmereRespawningLiveCreatureSeedForId,
  harthmereRespawningLiveCreatureSeedIds,
} from "@/shared/harthmere/live_entity_production_seed";

export const HARTHMERE_NPC_RESPAWN_SERVICE_VERSION =
  "harthmere-npc-respawn-service";

type RespawnEntry = {
  typeId: BiomesId;
  spawnPosition: [number, number, number];
  spawnOrientation?: [number, number];
  respawnAt: number;
  previousId: BiomesId;
};

const HARTHMERE_FIXED_RESPAWN_IDS = new Set(
  harthmereRespawningLiveCreatureSeedIds()
);
const NPC_CORPSE_LINGER_SECS = 90;

function persistedRespawnEntry(
  entity: ReadonlyEntity
): RespawnEntry | undefined {
  if (
    !entity.health ||
    entity.health.hp > 0 ||
    !entity.npc_metadata ||
    !entity.position
  ) {
    return undefined;
  }
  const custom = deserializeNpcCustomState(entity.npc_state?.data);
  const customRespawnAt = Number((custom as any).harthmereRespawnAt);
  const respawnAt =
    Number.isFinite(customRespawnAt) && customRespawnAt > 0
      ? customRespawnAt
      : Number(entity.expires?.trigger_at) - NPC_CORPSE_LINGER_SECS;
  if (!Number.isFinite(respawnAt) || respawnAt <= 0) return undefined;
  return {
    typeId: entity.npc_metadata.type_id,
    spawnPosition: [
      ...(entity.npc_metadata.spawn_position ?? entity.position.v),
    ] as [number, number, number],
    spawnOrientation: entity.npc_metadata.spawn_orientation
      ? ([...entity.npc_metadata.spawn_orientation] as [number, number])
      : undefined,
    respawnAt,
    previousId: entity.id,
  };
}

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

  async start(table?: { contents(): Iterable<ReadonlyEntity> }) {
    // The death transaction stores the deadline in NpcState. Rebuild the
    // process-local timer queue only as an execution cache after replica
    // bootstrap; ECS remains the durable lifecycle authority.
    for (const entity of table?.contents() ?? []) {
      const entry = persistedRespawnEntry(entity);
      if (entry) this.enqueue(entry);
    }
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

    try {
      const changes: ChangeToApply[] = [];
      for (const entry of due) {
        if (HARTHMERE_FIXED_RESPAWN_IDS.has(entry.previousId)) {
          const existing = await this.worldApi.get(entry.previousId);
          if (existing?.health()?.hp && existing.health()!.hp > 0) {
            continue;
          }
          const canonicalSeed = harthmereRespawningLiveCreatureSeedForId(
            entry.previousId
          );
          // Rebuild the exact authored creature entity. Generic npcEntity()
          // respawn loses species size/combat health and reintroduces spawn
          // jitter, which can make animals vanish into terrain after respawn.
          const spawned = canonicalSeed
            ? buildHarthmereLiveCreatureEntity(
                {
                  ...canonicalSeed,
                  // The production grounding reconciler may move a large body
                  // a few columns to find dry, fully-supported terrain. Keep
                  // that persisted repair across every future respawn.
                  position: [...entry.spawnPosition],
                  orientation:
                    entry.spawnOrientation ?? canonicalSeed.orientation,
                },
                now
              )
            : npcEntity(
                {
                  id: entry.previousId,
                  typeId: entry.typeId,
                  position: entry.spawnPosition,
                  orientation: entry.spawnOrientation,
                },
                now
              );
          changes.push(
            existing
              ? ({
                  changes: [
                    {
                      kind: "update",
                      entity: { ...spawned, expires: null },
                    },
                  ],
                } as ChangeToApply)
              : canonicalSeed
              ? ({
                  changes: [{ kind: "create", entity: spawned }],
                } as ChangeToApply)
              : makeSpawnChangeToApply(now, {
                  id: entry.previousId,
                  typeId: entry.typeId,
                  position: entry.spawnPosition,
                  orientation: entry.spawnOrientation,
                })
          );
        } else {
          const id = await this.idGenerator.next();
          changes.push(
            makeSpawnChangeToApply(now, {
              id,
              typeId: entry.typeId,
              position: entry.spawnPosition,
              orientation: entry.spawnOrientation,
            })
          );
        }
      }
      for (const change of changes) {
        const applied = await this.worldApi.apply(change);
        if (applied.outcome !== "success") {
          throw new Error(`world_apply_${applied.outcome}`);
        }
      }
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
