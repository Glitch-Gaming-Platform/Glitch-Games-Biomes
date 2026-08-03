import { iterBackupEntriesFromFile } from "@/server/backup/serde";
import {
  loadBakedTrayFromProd,
  loadTrayDefinitionFromProd,
} from "@/server/shared/bikkie/dev";
import { RedisBikkieStorage } from "@/server/shared/bikkie/storage/redis";
import {
  connectToRedis,
  connectToRedisWithLua,
} from "@/server/shared/redis/connection";
import { scriptInit } from "@/server/shared/script_init";
import { RedisWorld } from "@/server/shared/world/redis";
import { buildHarthmereGroveRaceMinigameSeedProposedChanges } from "@/server/harthmere/grove_race_minigame_ecs_seed";
import { buildHarthmereLiveEntityProductionSeedProposedChanges } from "@/server/harthmere/live_entity_ecs_seed";
import { buildSnapshotMinigameCatalogSeedProposedChanges } from "@/server/harthmere/snapshot_minigame_ecs_seed";
import { buildHarthmereSnapshotGroveNpcSeedProposedChanges } from "@/server/harthmere/snapshot_grove_npc_ecs_seed";
import { ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { Timer, TimerNeverSet } from "@/shared/metrics/timer";
import { chunk } from "lodash";

export async function bootstrapRedis(backupFile?: string) {
  if (!backupFile) {
    log.fatal(`Usage: node bootstrap_redis.js <backup_file>`);
    return;
  }

  await scriptInit();

  const storage = new RedisBikkieStorage(await connectToRedis("bikkie"));
  if (process.env.SKIP_PROD_LOAD === "false") {
    await loadTrayDefinitionFromProd(storage);
    await storage.save(await loadBakedTrayFromProd());
  }

  console.log("Loading world...");
  const changes: ProposedChange[] = [];
  for await (const [version, value] of iterBackupEntriesFromFile(backupFile)) {
    if (version === "bikkie") {
      const { definition, baked } = value;
      await Promise.all([
        storage.saveDefinition(definition),
        storage.save(baked),
      ]);
    } else {
      changes.push({
        kind: "create",
        entity: value,
      });
    }
  }
  await storage.stop();

  const snapshotEntities = changes.flatMap((change) =>
    change.kind === "create" ? [change.entity] : []
  );

  const existingIds = new Set(
    changes
      .map(
        (change) =>
          (change.kind === "create" || change.kind === "update"
            ? change.entity.id
            : change.id) as BiomesId
      )
      .filter((id) => id !== undefined)
  );
  const liveEntitySeedChanges =
    buildHarthmereLiveEntityProductionSeedProposedChanges({
      nowSeconds: secondsSinceEpoch(),
      existingIds,
    });
  const groveRaceSeedChanges =
    buildHarthmereGroveRaceMinigameSeedProposedChanges({
      nowSeconds: secondsSinceEpoch(),
      existingIds,
    });
  const snapshotMinigameSeedChanges =
    buildSnapshotMinigameCatalogSeedProposedChanges({
      nowSeconds: secondsSinceEpoch(),
      entities: snapshotEntities,
    });
  const snapshotGroveNpcSeedChanges =
    buildHarthmereSnapshotGroveNpcSeedProposedChanges({
      nowSeconds: secondsSinceEpoch(),
      existingIds,
    });
  changes.push(
    ...liveEntitySeedChanges,
    ...groveRaceSeedChanges,
    ...snapshotMinigameSeedChanges,
    ...snapshotGroveNpcSeedChanges
  );
  console.log(
    `Added ${liveEntitySeedChanges.length} Harthmere live entity seed changes, ${groveRaceSeedChanges.length} Grove race minigame seed changes, ${snapshotMinigameSeedChanges.length} snapshot minigame repair changes, and ${snapshotGroveNpcSeedChanges.length} Grove NPC seed changes.`
  );

  console.log(`Loaded ${changes.length} changes, placing into redis.`);

  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  await world.waitForHealthy();

  const timer = new Timer();
  const lastMessage = new Timer(TimerNeverSet);
  let processed = 0;

  const printStatus = () => {
    console.log(
      `Processed ${processed} changes, at ${
        (processed / timer.elapsed) * 1000
      } changes/s`
    );
    lastMessage.reset();
  };

  for (const batch of chunk(changes, CONFIG.redisMaxKeysPerBatch - 1)) {
    await world.apply({ changes: batch });
    processed += batch.length;
    if (lastMessage.elapsed > 5000) {
      printStatus();
    }
  }

  printStatus();
  await world.stop();
  console.log("Done!");
}

const [backupFile] = process.argv.slice(2);
bootstrapRedis(backupFile);
