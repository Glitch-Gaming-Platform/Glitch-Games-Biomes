/// <reference types="mocha" />

import assert from "assert";
import {
  allPlayerShardsLoaded,
  allPlayerShardsMeshed,
  playerShardLoadWorldAabb,
  playerShardMeshLoadScope,
  shouldRequestPlayerShardRecovery,
  triggerPlayerShardsMesh,
} from "@/client/game/helpers/player_shards";
import { voxelShard } from "@/shared/game/shard";
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import type { ReadonlyAABB } from "@/shared/math/types";

describe("player shard recovery", () => {
  it("uses a narrow startup mesh scope only for low-memory clients", () => {
    assert.equal(playerShardMeshLoadScope(true), "local");
    assert.equal(playerShardMeshLoadScope(false), "nearby");
  });

  it("waits for a sustained missing-shard window before recovery", () => {
    assert.equal(
      shouldRequestPlayerShardRecovery({
        missingSince: 1_000,
        now: 8_999,
        alreadyRequested: false,
        delayMs: 8_000,
      }),
      false
    );
    assert.equal(
      shouldRequestPlayerShardRecovery({
        missingSince: 1_000,
        now: 9_000,
        alreadyRequested: false,
        delayMs: 8_000,
      }),
      true
    );
  });

  it("never requests a second recovery from the same player controller", () => {
    assert.equal(
      shouldRequestPlayerShardRecovery({
        missingSince: 1_000,
        now: 20_000,
        alreadyRequested: true,
      }),
      false
    );
  });

  it("uses detached dungeon bounds without expanding ordinary WorldMetadata", () => {
    const ordinary: ReadonlyAABB = [
      [-1792, -224, -1792],
      [2560, 288, 1792],
    ];
    const winter = ch1ElsewhenSlot("ch1_dungeon_winter")!;
    const player: ReadonlyAABB = [
      [winter.arrival[0] - 0.5, winter.arrival[1], winter.arrival[2] - 0.5],
      [winter.arrival[0] + 0.5, winter.arrival[1] + 2, winter.arrival[2] + 0.5],
    ];

    const selected = playerShardLoadWorldAabb(ordinary, player);
    assert.deepEqual(selected[0], [winter.minX, -64, -512]);
    assert.deepEqual(selected[1], [winter.maxX, 192, 512]);
    assert.deepEqual(ordinary[1], [2560, 288, 1792]);
  });

  it("keeps ordinary players on the ordinary WorldMetadata bounds", () => {
    const ordinary: ReadonlyAABB = [
      [-1792, -224, -1792],
      [2560, 288, 1792],
    ];
    const player: ReadonlyAABB = [
      [2300, 52, -300],
      [2301, 54, -299],
    ];
    assert.equal(playerShardLoadWorldAabb(ordinary, player), ordinary);
  });

  it("does not wait for intentionally absent neighboring terrain shards", () => {
    const position: [number, number, number] = [2024, 54, -52];
    const supportingShard = voxelShard(...position);
    const resources = {
      get(path: string, shard?: string) {
        if (path === "/ecs/metadata") {
          return { aabb: { v0: [-2048, -256, -2048], v1: [2560, 512, 2048] } };
        }
        if (path === "/scene/local_player") {
          return {
            player: {
              position,
              aabb: () => [
                [position[0] - 0.5, position[1], position[2] - 0.5],
                [position[0] + 0.5, position[1] + 2, position[2] + 0.5],
              ],
            },
          };
        }
        if (path === "/ecs/terrain") {
          return shard === supportingShard ? { id: 1 } : undefined;
        }
        if (path === "/physics/boxes") {
          return shard === supportingShard ? {} : undefined;
        }
        return undefined;
      },
      cached(path: string, shard: string) {
        return path === "/terrain/combined_mesh" && shard === supportingShard
          ? {}
          : undefined;
      },
    };

    assert.equal(allPlayerShardsMeshed(resources as never), true);
  });

  it("still requires the terrain shard directly under the player", () => {
    const position: [number, number, number] = [2024, 54, -52];
    const nearbyTerrain = voxelShard(
      position[0] + 32,
      position[1],
      position[2]
    );
    const resources = {
      get(path: string, shard?: string) {
        if (path === "/ecs/metadata") {
          return { aabb: { v0: [-2048, -256, -2048], v1: [2560, 512, 2048] } };
        }
        if (path === "/scene/local_player") {
          return {
            player: {
              position,
              aabb: () => [
                [position[0] - 0.5, position[1], position[2] - 0.5],
                [position[0] + 0.5, position[1] + 2, position[2] + 0.5],
              ],
            },
          };
        }
        if (path === "/ecs/terrain") {
          return shard === nearbyTerrain ? { id: 2 } : undefined;
        }
        if (path === "/physics/boxes") {
          return shard === nearbyTerrain ? {} : undefined;
        }
        return undefined;
      },
      cached(path: string, shard: string) {
        return path === "/terrain/combined_mesh" && shard === nearbyTerrain
          ? {}
          : undefined;
      },
    };

    assert.equal(allPlayerShardsMeshed(resources as never), false);
  });

  it("waits for every present neighboring terrain shard to finish meshing", () => {
    const position: [number, number, number] = [2024, 54, -52];
    const supportingShard = voxelShard(
      position[0],
      position[1] - 1,
      position[2]
    );
    const presentNeighbor = voxelShard(
      position[0] + 32,
      position[1],
      position[2]
    );
    let neighborPhysicsLoaded = false;
    let neighborMeshLoaded = false;
    const resources = {
      get(path: string, shard?: string) {
        if (path === "/ecs/metadata") {
          return { aabb: { v0: [-2048, -256, -2048], v1: [2560, 512, 2048] } };
        }
        if (path === "/scene/local_player") {
          return {
            player: {
              position,
              aabb: () => [
                [position[0] - 0.5, position[1], position[2] - 0.5],
                [position[0] + 0.5, position[1] + 2, position[2] + 0.5],
              ],
            },
          };
        }
        if (path === "/ecs/terrain") {
          return shard === supportingShard || shard === presentNeighbor
            ? { id: 1 }
            : undefined;
        }
        if (path === "/physics/boxes") {
          return shard === supportingShard ||
            (shard === presentNeighbor && neighborPhysicsLoaded)
            ? {}
            : undefined;
        }
        return undefined;
      },
      cached(path: string, shard: string) {
        return path === "/terrain/combined_mesh" &&
          (shard === supportingShard ||
            (shard === presentNeighbor && neighborMeshLoaded))
          ? {}
          : undefined;
      },
    };

    assert.equal(allPlayerShardsMeshed(resources as never), false);
    neighborPhysicsLoaded = true;
    assert.equal(allPlayerShardsMeshed(resources as never), false);
    neighborMeshLoaded = true;
    assert.equal(allPlayerShardsMeshed(resources as never), true);
  });

  it("lets low-memory startup proceed once local supporting shards are ready", () => {
    const position: [number, number, number] = [2024, 54, -52];
    const supportingShard = voxelShard(
      position[0],
      position[1] - 1,
      position[2]
    );
    const distantNeighbor = voxelShard(
      position[0] + 32,
      position[1],
      position[2]
    );
    const resources = {
      get(path: string, shard?: string) {
        if (path === "/ecs/metadata") {
          return { aabb: { v0: [-2048, -256, -2048], v1: [2560, 512, 2048] } };
        }
        if (path === "/scene/local_player") {
          return {
            player: {
              position,
              aabb: () => [
                [position[0] - 0.5, position[1], position[2] - 0.5],
                [position[0] + 0.5, position[1] + 2, position[2] + 0.5],
              ],
            },
          };
        }
        if (path === "/ecs/terrain") {
          return shard === supportingShard || shard === distantNeighbor
            ? { id: 1 }
            : undefined;
        }
        if (path === "/physics/boxes") {
          return shard === supportingShard ? {} : undefined;
        }
        return undefined;
      },
      cached(path: string, shard: string) {
        return path === "/terrain/combined_mesh" && shard === supportingShard
          ? {}
          : undefined;
      },
    };

    assert.equal(allPlayerShardsMeshed(resources as never, "local"), true);
    assert.equal(allPlayerShardsMeshed(resources as never, "nearby"), false);
  });

  it("includes supporting terrain below an exact vertical shard boundary", () => {
    const position: [number, number, number] = [2024, 64, -52];
    const supportingShard = voxelShard(
      position[0],
      position[1] - 1,
      position[2]
    );
    const resources = {
      get(path: string, shard?: string) {
        if (path === "/ecs/metadata") {
          return { aabb: { v0: [-2048, -256, -2048], v1: [2560, 512, 2048] } };
        }
        if (path === "/scene/local_player") {
          return {
            player: {
              position,
              aabb: () => [
                [position[0] - 0.5, position[1], position[2] - 0.5],
                [position[0] + 0.5, position[1] + 2, position[2] + 0.5],
              ],
            },
          };
        }
        if (path === "/ecs/terrain") {
          return shard === supportingShard ? { id: 1 } : undefined;
        }
        if (path === "/physics/boxes") {
          return shard === supportingShard ? {} : undefined;
        }
        return undefined;
      },
      cached(path: string, shard: string) {
        return path === "/terrain/combined_mesh" && shard === supportingShard
          ? {}
          : undefined;
      },
    };

    assert.equal(allPlayerShardsLoaded(resources as never), true);
    assert.equal(allPlayerShardsMeshed(resources as never), true);
  });

  it("requests meshes only for terrain entities that are present", async () => {
    const position: [number, number, number] = [2024, 54, -52];
    const supportingShard = voxelShard(
      position[0],
      position[1] - 1,
      position[2]
    );
    const requested: string[] = [];
    const resources = {
      get(path: string, shard?: string) {
        if (path === "/ecs/metadata") {
          return { aabb: { v0: [-2048, -256, -2048], v1: [2560, 512, 2048] } };
        }
        if (path === "/scene/local_player") {
          return {
            player: {
              position,
              aabb: () => [
                [position[0] - 0.5, position[1], position[2] - 0.5],
                [position[0] + 0.5, position[1] + 2, position[2] + 0.5],
              ],
            },
          };
        }
        if (path === "/ecs/terrain") {
          return shard === supportingShard ? { id: 1 } : undefined;
        }
        if (path === "/terrain/combined_mesh" && shard) {
          requested.push(shard);
          return {};
        }
        return undefined;
      },
    };

    await triggerPlayerShardsMesh(resources as never);
    assert.deepEqual(requested, [supportingShard]);
  });
});
