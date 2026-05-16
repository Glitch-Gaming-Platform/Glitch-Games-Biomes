import { materializeLazyChange } from "@/server/shared/ecs/lazy";
import { connectToRedisWithLua } from "@/server/shared/redis/connection";
import { scriptInit } from "@/server/shared/script_init";
import { RedisWorld } from "@/server/shared/world/redis";
import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";
import { chunk } from "lodash";

type Candidate = {
  id: BiomesId;
  label: string;
};

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const keepRaw = readArg("--keep") ?? process.env.HARTHMERE_KEEP_USER_ID;
  const keepId = keepRaw ? safeParseBiomesId(keepRaw) : undefined;
  const dryRun = hasFlag("--dry-run");
  const forceAll = hasFlag("--force-all");

  if (!keepId && !forceAll) {
    console.error(
      [
        "Refusing to delete local-dev avatar/player entities without a keep id.",
        "Run this from a second terminal while ./b data-snapshot run is up:",
        "  ./b script harthmere_clear_local_dev_avatars -- --keep <currentUserId>",
        "To inspect first:",
        "  ./b script harthmere_clear_local_dev_avatars -- --keep <currentUserId> --dry-run",
        "If you intentionally want to remove every local-dev player entity:",
        "  ./b script harthmere_clear_local_dev_avatars -- --force-all",
      ].join("\n"),
    );
    process.exit(1);
  }

  await scriptInit();
  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  try {
    await world.waitForHealthy(10_000);
    const candidates = new Map<BiomesId, Candidate>();

    for await (const update of world.subscribe({
      filter: { anyOf: ["player_status"] },
    })) {
      for (const lazyChange of update.changes) {
        const change = materializeLazyChange(lazyChange);
        if (change.kind === "delete") {
          continue;
        }
        const entity = change.entity;
        if (!entity.player_status) {
          continue;
        }
        if (entity.gremlin) {
          continue;
        }
        if (keepId && entity.id === keepId) {
          continue;
        }
        candidates.set(entity.id, {
          id: entity.id,
          label: entity.label?.text ?? "<unnamed>",
        });
      }

      if (update.bootstrapped) {
        break;
      }
    }

    const stalePlayers = [...candidates.values()].sort((a, b) => a.id - b.id);
    console.log(
      `Found ${stalePlayers.length} local-dev avatar/player entities to delete.`,
    );
    for (const player of stalePlayers) {
      console.log(`- ${player.id} ${player.label}`);
    }

    if (dryRun || stalePlayers.length === 0) {
      console.log(dryRun ? "Dry run only; nothing deleted." : "Nothing to delete.");
      return;
    }

    for (const batch of chunk(stalePlayers, 100)) {
      await world.apply({
        changes: batch.map(({ id }) => ({
          kind: "delete" as const,
          id,
        })),
      });
    }

    console.log(
      `Deleted ${stalePlayers.length} stale local-dev avatar/player entities from Redis ECS.`,
    );
  } finally {
    await world.stop();
  }
}

void main();
