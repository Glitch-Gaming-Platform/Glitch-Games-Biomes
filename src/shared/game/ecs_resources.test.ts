import { addTableResources } from "@/shared/game/ecs_resources";
import type { EcsResourcePaths } from "@/shared/game/ecs_resources";
import { SyntheticStats, WorldMetadata } from "@/shared/ecs/gen/components";
import { WorldMetadataId } from "@/shared/ecs/ids";
import { createTable } from "@/shared/ecs/table";
import { HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X } from "@/shared/harthmere/world_extension";
import { BiomesResourcesBuilder } from "@/shared/resources/biomes";
import assert from "assert";

function metadataResourceFromTable() {
  const table = createTable({} as any);
  const builder = new BiomesResourcesBuilder<EcsResourcePaths>({
    collectorParams: {
      capacities: {
        count: 0,
      },
    },
  });
  addTableResources(table, builder);
  return { table, resources: builder.build() };
}

describe("ECS metadata resources", () => {
  it("uses conservative fallback metadata instead of crashing when world metadata is absent", () => {
    const { resources } = metadataResourceFromTable();

    const metadata = resources.get("/ecs/metadata");

    assert.deepEqual(metadata.aabb.v0, [-2048, -256, -2048]);
    assert.deepEqual(metadata.aabb.v1, [
      HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
      512,
      2048,
    ]);
  });

  it("uses fallback metadata for synthetic-only WorldMetadataId updates", () => {
    const { table, resources } = metadataResourceFromTable();
    table.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          id: WorldMetadataId,
          synthetic_stats: SyntheticStats.create({ online_players: 3 }),
        },
      },
    ]);

    const metadata = resources.get("/ecs/metadata");

    assert.deepEqual(metadata.aabb.v0, [-2048, -256, -2048]);
    assert.deepEqual(metadata.aabb.v1, [
      HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
      512,
      2048,
    ]);
  });

  it("prefers real world metadata when present", () => {
    const { table, resources } = metadataResourceFromTable();
    table.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          id: WorldMetadataId,
          world_metadata: WorldMetadata.create({
            aabb: {
              v0: [-10, -20, -30],
              v1: [10, 20, 30],
            },
          }),
        },
      },
    ]);

    const metadata = resources.get("/ecs/metadata");

    assert.deepEqual(metadata.aabb.v0, [-10, -20, -30]);
    assert.deepEqual(metadata.aabb.v1, [10, 20, 30]);
  });
});
