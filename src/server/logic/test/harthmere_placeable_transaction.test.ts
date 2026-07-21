import { authorizeHarthmerePlaceableTransaction } from "@/server/harthmere/native_placeable_transaction_token";
import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  createEmptyTerrainShard,
  editEntity,
  setItemAtSlotIndex,
  TestLogicApi,
} from "@/server/test/test_helpers";
import { BikkieIds } from "@/shared/bikkie/ids";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { HarthmerePlaceableTransactionEvent } from "@/shared/ecs/gen/events";
import { countOf } from "@/shared/game/items";
import { SHARD_DIM } from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("Harthmere native placeable transaction", () => {
  let voxeloo!: VoxelooModule;
  let logic!: TestLogicApi;
  let playerId!: BiomesId;
  let placeableId!: BiomesId;

  before(async () => {
    voxeloo = await loadVoxeloo();
    BikkieRuntime.get().registerBiscuits(
      new Map([
        [
          BikkieIds.workbench,
          {
            id: BikkieIds.workbench,
            name: "test_workbench",
            displayName: "Test Workbench",
            isPlaceable: true,
            boxSize: [1, 1, 1],
            stackable: 1n,
          } as any,
        ],
        [
          BikkieIds.treasureChest,
          {
            id: BikkieIds.treasureChest,
            name: "test_treasure_chest",
            displayName: "Test Treasure Chest",
            isPlaceable: true,
            isContainer: true,
            boxSize: [1, 1, 1],
            stackable: 1n,
          } as any,
        ],
      ])
    );
  });

  beforeEach(async () => {
    logic = new TestLogicApi(voxeloo);
    playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    placeableId = generateTestId();
    for (const shard of [
      [-SHARD_DIM, 0, -SHARD_DIM],
      [-SHARD_DIM, 0, 0],
      [0, 0, -SHARD_DIM],
      [0, 0, 0],
    ] as Vec3[]) {
      createEmptyTerrainShard(logic.world, shard);
    }
  });

  function transaction(input: {
    transactionId: string;
    operation: "place" | "move" | "remove";
    itemId: BiomesId;
    position?: [number, number, number];
    oldPosition?: [number, number, number];
  }) {
    const eventInput = {
      id: playerId,
      transaction_id: input.transactionId,
      operation: input.operation,
      entity_id: placeableId,
      item_id: input.itemId,
      position: input.position ?? ([0, 0, 0] as [number, number, number]),
      orientation: [0, 0] as [number, number],
      old_position:
        input.oldPosition ?? ([0, 0, 0] as [number, number, number]),
      old_orientation: [0, 0] as [number, number],
    };
    return new GameEvent(
      playerId,
      new HarthmerePlaceableTransactionEvent({
        ...eventInput,
        authorization: authorizeHarthmerePlaceableTransaction(eventInput),
      })
    );
  }

  it("places, replays, and removes a physical item atomically", async () => {
    setItemAtSlotIndex(
      logic.world,
      playerId,
      countOf(BikkieIds.workbench, 1n),
      0
    );
    const place = transaction({
      transactionId: "test:placeable:place:1",
      operation: "place",
      itemId: BikkieIds.workbench,
    });

    await logic.publish(place);
    await logic.publish(place);

    assert.equal(
      logic.world.table.get(placeableId)?.placeable_component?.item_id,
      BikkieIds.workbench
    );
    assert.equal(logic.world.table.get(playerId)?.inventory?.items[0], null);
    assert.deepEqual(
      logic.world.table.get(playerId)?.harthmere_ecs_transaction_ledger
        ?.transaction_ids,
      ["test:placeable:place:1"]
    );

    await logic.publish(
      transaction({
        transactionId: "test:placeable:remove:1",
        operation: "remove",
        itemId: BikkieIds.workbench,
      })
    );

    assert.equal(logic.world.table.get(placeableId), undefined);
    const inventory = logic.world.table.get(playerId)?.inventory;
    assert.equal(
      [...(inventory?.items ?? []), ...(inventory?.hotbar ?? [])].some(
        (slot) => slot?.item.id === BikkieIds.workbench
      ),
      true
    );
  });

  it("refuses to remove a native container until every slot is empty", async () => {
    setItemAtSlotIndex(
      logic.world,
      playerId,
      countOf(BikkieIds.treasureChest, 1n),
      0
    );
    await logic.publish(
      transaction({
        transactionId: "test:placeable:container:place:1",
        operation: "place",
        itemId: BikkieIds.treasureChest,
      })
    );
    editEntity(logic.world, placeableId, (placeable) => {
      placeable.mutableContainerInventory().items[0] = countOf(
        BikkieIds.dirt,
        1n
      );
    });

    await logic.publish(
      transaction({
        transactionId: "test:placeable:container:remove:1",
        operation: "remove",
        itemId: BikkieIds.treasureChest,
      })
    );

    assert.equal(
      logic.world.table.get(placeableId)?.container_inventory?.items[0]?.item
        .id,
      BikkieIds.dirt
    );
    assert.equal(
      logic.world.table
        .get(playerId)
        ?.harthmere_ecs_transaction_ledger?.transaction_ids.includes(
          "test:placeable:container:remove:1"
        ),
      false
    );
  });
});
