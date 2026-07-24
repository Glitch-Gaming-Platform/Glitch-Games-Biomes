#!/usr/bin/env node

// Read-only preflight for selecting a cinematic cast from the installed ECS
// snapshot. Canonical IDs can still be too far apart for one observer to
// stream, so report both identity and spatial spread before authoring a scene.
process.env.IS_SERVER ??= "true";
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const {
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const {
  harthmereMuckCreatureAssetKeyForLabel,
} = require("../../src/shared/harthmere/muck_creature_assets");

function usage() {
  console.error(
    "Usage: scripts/cutscenes/inspect-live-cast.cjs ENTITY_ID [ENTITY_ID ...]"
  );
}

function finiteEntityIds(values) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
}

function centroid(positions) {
  if (positions.length === 0) {
    return undefined;
  }
  return positions
    .reduce(
      (sum, position) => [
        sum[0] + position[0],
        sum[1] + position[1],
        sum[2] + position[2],
      ],
      [0, 0, 0]
    )
    .map((value) => value / positions.length);
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function main() {
  const ids = finiteEntityIds(process.argv.slice(2));
  if (ids.length === 0) {
    usage();
    process.exitCode = 2;
    return;
  }

  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  await world.waitForHealthy();
  try {
    const actors = [];
    for (const id of ids) {
      const lazy = await world.get(id);
      const entity = lazy?.materialize?.() ?? lazy;
      const label = entity?.label?.text;
      actors.push({
        id,
        found: Boolean(entity),
        label,
        position: entity?.position?.v,
        npcTypeId: entity?.npc_metadata?.type_id,
        hp: entity?.health?.hp,
        maxHp: entity?.health?.maxHp,
        nativeCreatureAsset: harthmereMuckCreatureAssetKeyForLabel(label),
      });
    }

    const positions = actors
      .map((actor) => actor.position)
      .filter(
        (position) =>
          Array.isArray(position) &&
          position.length === 3 &&
          position.every(Number.isFinite)
      );
    const center = centroid(positions);
    console.log(
      JSON.stringify(
        {
          actors,
          centroid: center,
          maxDistanceFromCentroid: center
            ? Math.max(
                ...positions.map((position) => distance(position, center))
              )
            : undefined,
        },
        undefined,
        2
      )
    );
  } finally {
    await world.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
