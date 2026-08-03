import { reconcileSnapshotMinigameCatalog } from "@/server/harthmere/snapshot_minigame_ecs_seed";
import { connectToRedisWithLua } from "@/server/shared/redis/connection";
import { scriptInit } from "@/server/shared/script_init";
import { RedisWorld } from "@/server/shared/world/redis";

async function main() {
  await scriptInit();
  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  await world.waitForHealthy();
  try {
    const result = await reconcileSnapshotMinigameCatalog(world);
    console.log(
      `SNAPSHOT_MINIGAME_RECONCILIATION applied=${result.applied} changes=${result.changes}`
    );
  } finally {
    await world.stop();
  }
}

void main();
