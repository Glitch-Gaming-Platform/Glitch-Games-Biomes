import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  editEntity,
  setItemAtSlotIndex,
  testInventoryEditor,
  TestLogicApi,
} from "@/server/test/test_helpers";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import {
  InventoryCombineEvent,
  InventorySplitEvent,
  InventorySwapEvent,
} from "@/shared/ecs/gen/events";
import { bagCount, countOf, createBag } from "@/shared/game/items";
import {
  PLAYER_HOTBAR_SLOTS,
  PLAYER_INVENTORY_SLOTS,
} from "@/shared/game/inventory";
import type { BiomesId } from "@/shared/ids";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert, { ok } from "assert";

const TEST_ID = generateTestId();

describe("Inventory", () => {
  let voxeloo!: VoxelooModule;
  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  let logic: TestLogicApi;
  let tommyd: ReadonlyEntity;
  beforeEach(async () => {
    voxeloo = await loadVoxeloo();
    logic = new TestLogicApi(voxeloo);
    tommyd = await addGameUser(logic.world, TEST_ID, {})!;
  });

  const inventorySlotSwap = async (
    entityId: BiomesId,
    srcIdx: number,
    dstIdx: number
  ) => {
    return logic.publish(
      new GameEvent(
        entityId,
        new InventorySwapEvent({
          src_id: entityId,
          src: {
            kind: "item",
            idx: srcIdx,
          },
          dst: {
            kind: "item",
            idx: dstIdx,
          },
          player_id: entityId,
        })
      )
    );
  };

  describe("swapping", () => {
    it("creates players with a real 40-slot native backpack", () => {
      assert.equal(tommyd.inventory?.items.length, PLAYER_INVENTORY_SLOTS);
    });

    it("should work between empty slots", async () => {
      assert.ok(tommyd.inventory?.items.length ?? 0 > 0);
      assert.ok(tommyd.inventory!.items[0] === undefined);
      assert.ok(tommyd.inventory!.items[1] === undefined);
      await inventorySlotSwap(tommyd.id, 0, 1);
      const newTommy = logic.world.table.get(tommyd.id);
      ok(newTommy);
      assert.ok(newTommy.inventory!.items[0] === undefined);
      assert.ok(newTommy.inventory!.items[1] === undefined);
    });

    it("should work between set slots", async () => {
      setItemAtSlotIndex(
        logic.world,
        tommyd.id,
        countOf(BikkieIds.dirt, undefined, 99n),
        0
      );

      let tommy = logic.world.table.get(tommyd.id)!;
      assert.ok(tommy.inventory!.items[0] !== undefined);
      await inventorySlotSwap(tommyd.id, 0, 1);

      tommy = logic.world.table.get(tommyd.id)!;
      assert.ok(tommy.inventory!.items[0] === undefined);
      assert.ok(tommy.inventory!.items[1]?.count === 99n);
      assert.ok(tommy.inventory!.items[1]?.item.id === BikkieIds.dirt);
    });

    it("should move backpack items into hotbar slots", async () => {
      setItemAtSlotIndex(
        logic.world,
        tommyd.id,
        countOf(BikkieIds.dirt, undefined, 12n),
        0
      );

      await logic.publish(
        new GameEvent(
          tommyd.id,
          new InventorySwapEvent({
            src_id: tommyd.id,
            src: {
              kind: "item",
              idx: 0,
            },
            dst_id: tommyd.id,
            dst: {
              kind: "hotbar",
              idx: 2,
            },
            player_id: tommyd.id,
          })
        )
      );

      const newTommy = logic.world.table.get(tommyd.id);
      ok(newTommy);
      assert.ok(newTommy.inventory!.items[0] === undefined);
      assert.ok(newTommy.inventory!.hotbar[2]?.count === 12n);
      assert.ok(newTommy.inventory!.hotbar[2]?.item.id === BikkieIds.dirt);
    });

    it("shouldn't work between crazy slots", async () => {
      setItemAtSlotIndex(
        logic.world,
        tommyd.id,
        countOf(BikkieIds.dirt, undefined, 99n),
        0
      );

      let tommy = logic.world.table.get(tommyd.id)!;
      assert.ok(tommy.inventory!.items[0] !== undefined);
      await inventorySlotSwap(tommyd.id, 0, 10000);
      tommy = logic.world.table.get(tommyd.id)!;
      assert.ok(tommy.inventory!.items[0] !== undefined);
    });
  });

  describe("Inventory Overflow", () => {
    it("keeps a quest-style unpaid reward recoverable until a slot is freed", () => {
      editEntity(logic.world, tommyd.id, (entity) => {
        const editor = testInventoryEditor(entity);
        for (let i = 0; i < PLAYER_INVENTORY_SLOTS; i += 1) {
          editor.set({ kind: "item", idx: i }, countOf(BikkieIds.dirt, 99n));
        }
        for (let i = 0; i < PLAYER_HOTBAR_SLOTS; i += 1) {
          editor.set({ kind: "hotbar", idx: i }, countOf(BikkieIds.dirt, 99n));
        }
        const reward = createBag(countOf(BikkieIds.grass, 1n));
        editor.giveWithInventoryOverflow(reward);
        assert.equal(
          entity
            .inventory()
            ?.items.some((slot) => slot?.item.id === BikkieIds.grass),
          false
        );
        assert.equal(
          bagCount(entity.inventory()?.overflow, { id: BikkieIds.grass }),
          1n
        );

        // The game never chooses an item to delete. The player frees one slot,
        // then claims the protected reward from overflow exactly once.
        editor.set({ kind: "item", idx: 0 }, undefined);
        assert.equal(
          editor.moveFromOverflow(reward, { kind: "item", idx: 0 }),
          true
        );
        assert.equal(entity.inventory()?.items[0]?.item.id, BikkieIds.grass);
        assert.equal(
          bagCount(entity.inventory()?.overflow, { id: BikkieIds.grass }),
          0n
        );
      });
    });

    it("Should overflow when needed", () => {
      editEntity(logic.world, tommyd.id, (entity) => {
        const editor = testInventoryEditor(entity);
        assert.ok(!entity.inventory()?.overflow.size);
        editor.giveWithInventoryOverflow(
          createBag(countOf(BikkieIds.dirt, undefined, 100000n))
        );

        assert.ok(entity.inventory()?.overflow.size);
      });
    });

    it("Should accept currency always", () => {
      editEntity(logic.world, tommyd.id, (entity) => {
        assert.ok(!entity.inventory()?.overflow.size);
        assert.ok(!entity.inventory()?.currencies.size);
        const editor = testInventoryEditor(entity);
        editor.giveWithInventoryOverflow(
          createBag(
            countOf(BikkieIds.dirt, undefined, 100000n),
            countOf(BikkieIds.bling, undefined, 1000000n)
          )
        );
        assert.ok(entity.inventory()?.overflow.size);
        assert.ok(entity.inventory()?.currencies.size);
      });
    });
  });

  describe("combining", () => {
    it("should stack stuffs", async () => {
      setItemAtSlotIndex(
        logic.world,
        tommyd.id,
        countOf(BikkieIds.dirt, undefined, 99n),
        0
      );
      setItemAtSlotIndex(
        logic.world,
        tommyd.id,
        countOf(BikkieIds.dirt, undefined, 49n),
        1
      );

      await logic.publish(
        new GameEvent(
          tommyd.id,
          new InventoryCombineEvent({
            src_id: tommyd.id,
            src: {
              kind: "item",
              idx: 0,
            },
            dst: {
              kind: "item",
              idx: 1,
            },
            player_id: tommyd.id,
            count: 50n,
          })
        )
      );

      const newTommy = logic.world.table.get(tommyd.id);
      assert.ok(newTommy?.inventory?.items[0]?.count === 99n - 50n);
      assert.ok(newTommy?.inventory?.items[1]?.count === 99n);
    });

    it("shouldn't overflow a stack", async () => {
      setItemAtSlotIndex(
        logic.world,
        tommyd.id,
        countOf(BikkieIds.dirt, undefined, 99n),
        0
      );
      setItemAtSlotIndex(
        logic.world,
        tommyd.id,
        countOf(BikkieIds.dirt, undefined, 49n),
        1
      );

      await logic.publish(
        new GameEvent(
          tommyd.id,
          new InventoryCombineEvent({
            src_id: tommyd.id,
            src: {
              kind: "item",
              idx: 0,
            },
            dst: {
              kind: "item",
              idx: 1,
            },
            count: 51n,
          })
        )
      );

      const newTommy = logic.world.table.get(tommyd.id);
      assert.ok(newTommy?.inventory?.items[0]?.count === 99n);
      assert.ok(newTommy?.inventory?.items[1]?.count === 49n);
    });
  });

  describe("splitting", () => {
    it("should work", async () => {
      setItemAtSlotIndex(
        logic.world,
        tommyd.id,
        countOf(BikkieIds.dirt, undefined, 99n),
        0
      );
      await logic.publish(
        new GameEvent(
          tommyd.id,
          new InventorySplitEvent({
            src_id: tommyd.id,
            src: {
              kind: "item",
              idx: 0,
            },
            dst: {
              kind: "item",
              idx: 1,
            },
            player_id: tommyd.id,
            count: 49n,
          })
        )
      );

      const newTommy = logic.world.table.get(tommyd.id);
      assert.ok(newTommy?.inventory?.items[0]?.count === 50n);
      assert.ok(newTommy?.inventory?.items[1]?.count === 49n);
    });
    it("shouldn't split too much", async () => {
      setItemAtSlotIndex(
        logic.world,
        tommyd.id,
        countOf(BikkieIds.dirt, undefined, 1n),
        0
      );
      await logic.publish(
        new GameEvent(
          tommyd.id,
          new InventorySplitEvent({
            src_id: tommyd.id,
            src: {
              kind: "item",
              idx: 0,
            },
            dst: {
              kind: "item",
              idx: 1,
            },
            count: 49n,
          })
        )
      );
      const newTommy = logic.world.table.get(tommyd.id);
      assert.ok(newTommy?.inventory?.items[0]?.count === 1n);
      assert.ok(newTommy?.inventory?.items[1] === undefined);
    });
    it("shouldn't split an empty slot", async () => {
      await logic.publish(
        new GameEvent(
          tommyd.id,
          new InventorySplitEvent({
            src_id: tommyd.id,
            src: {
              kind: "item",
              idx: 0,
            },
            dst: {
              kind: "item",
              idx: 1,
            },
            count: 49n,
          })
        )
      );
      const newTommy = logic.world.table.get(tommyd.id);
      assert.ok(newTommy?.inventory?.items[0] === undefined);
      assert.ok(newTommy?.inventory?.items[1] === undefined);
    });
  });
});
