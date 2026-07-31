// Tests for the crafting-table prompt gating: the prompt appears ONLY at usable
// crafting tables (placeable + isCraftingStation), wherever they are, and never
// for ordinary placeables, non-stations, out-of-range, or unfaced tables.

import {
  harthmereCraftingTableScore,
  isHarthmereCraftingTable,
  selectNearestHarthmereCraftingTable,
  type HarthmereCraftingTableCandidate,
} from "@/shared/harthmere/harthmere_crafting_table_proximity";
import assert from "assert";

const facingPlusX: readonly [number, number, number] = [1, 0, 0];

describe("harthmere crafting-table proximity gating", () => {
  it("isHarthmereCraftingTable: only a placeable crafting station qualifies", () => {
    assert.strictEqual(
      isHarthmereCraftingTable({
        hasPlaceableComponent: true,
        itemIsCraftingStation: true,
      }),
      true
    );
    assert.strictEqual(
      isHarthmereCraftingTable({
        hasPlaceableComponent: true,
        itemIsCraftingStation: false,
      }),
      false,
      "a non-station placeable is not a crafting table"
    );
    assert.strictEqual(
      isHarthmereCraftingTable({
        hasPlaceableComponent: false,
        itemIsCraftingStation: true,
      }),
      false,
      "a non-placeable is not a crafting table"
    );
  });

  it("selects a faced crafting table within range", () => {
    const candidates: HarthmereCraftingTableCandidate[] = [
      {
        entityId: "table-1",
        position: [3, 0, 0],
        isCraftingStation: true,
        stationName: "Workbench",
      },
    ];
    const sel = selectNearestHarthmereCraftingTable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates,
    });
    assert.ok(sel, "faced table should be selected");
    assert.strictEqual(sel!.entityId, "table-1");
    assert.strictEqual(sel!.stationName, "Workbench");
  });

  it("never offers the prompt for non-crafting placeables nearby", () => {
    const candidates: HarthmereCraftingTableCandidate[] = [
      { entityId: "chair", position: [1, 0, 0], isCraftingStation: false },
      { entityId: "lamp", position: [2, 0, 0], isCraftingStation: false },
    ];
    const sel = selectNearestHarthmereCraftingTable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates,
    });
    assert.strictEqual(sel, undefined);
  });

  it("excludes unusable tables (building requirements not met)", () => {
    const candidates: HarthmereCraftingTableCandidate[] = [
      {
        entityId: "needs-roof",
        position: [2, 0, 0],
        isCraftingStation: true,
        usable: false,
      },
    ];
    const sel = selectNearestHarthmereCraftingTable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates,
    });
    assert.strictEqual(sel, undefined, "unusable table is not offered");
  });

  it("works the same regardless of location (business / home / owned) — identity only", () => {
    // Three identical crafting stations standing in different 'places'; the
    // selector only cares that each is a placeable crafting station.
    for (const where of ["business", "home", "owned"]) {
      const sel = selectNearestHarthmereCraftingTable({
        playerPosition: [0, 0, 0],
        facingView: facingPlusX,
        candidates: [
          {
            entityId: `oven-${where}`,
            position: [2, 0, 0],
            isCraftingStation: true,
          },
        ],
      });
      assert.ok(sel, `${where} crafting table should be detected`);
      assert.strictEqual(sel!.entityId, `oven-${where}`);
    }
  });

  it("selects a placed campfire as a station candidate for the cooking overlay", () => {
    const sel = selectNearestHarthmereCraftingTable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates: [
        {
          entityId: "campfire-placeable",
          position: [1.75, 0, 0],
          isCraftingStation: true,
          stationName: "Campfire",
        },
      ],
    });
    assert.ok(sel, "campfire placeable should be selected by proximity");
    assert.strictEqual(sel!.entityId, "campfire-placeable");
    assert.strictEqual(sel!.stationName, "Campfire");
  });

  it("picks the nearest faced table when several are nearby", () => {
    const candidates: HarthmereCraftingTableCandidate[] = [
      { entityId: "far", position: [5, 0, 0], isCraftingStation: true },
      { entityId: "near", position: [2, 0, 0], isCraftingStation: true },
    ];
    const sel = selectNearestHarthmereCraftingTable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates,
    });
    assert.strictEqual(sel!.entityId, "near");
  });

  it("rejects tables out of range or behind the player", () => {
    assert.strictEqual(
      harthmereCraftingTableScore({
        playerPosition: [0, 0, 0],
        facingView: facingPlusX,
        tablePosition: [100, 0, 0],
      }),
      undefined,
      "out of range"
    );
    assert.strictEqual(
      harthmereCraftingTableScore({
        playerPosition: [0, 0, 0],
        facingView: facingPlusX,
        tablePosition: [-3, 0, 0],
      }),
      undefined,
      "behind the player"
    );
  });

  it("allows a very close table even when slightly off the facing axis", () => {
    const score = harthmereCraftingTableScore({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      tablePosition: [0, 0, 1.5], // close, 90 degrees off
    });
    assert.ok(
      score !== undefined,
      "close table is offered regardless of facing"
    );
  });
});
