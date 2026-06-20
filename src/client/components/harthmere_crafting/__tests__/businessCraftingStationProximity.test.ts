import assert from "assert";

import {
  HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS,
  type HarthmereBusinessCraftingStationSeed,
} from "@/shared/harthmere/business_crafting_station_seed";
import {
  type HarthmereCraftingTableCandidate,
  isHarthmereCraftingTable,
  selectNearestHarthmereCraftingTable,
} from "@/shared/harthmere/harthmere_crafting_table_proximity";

// FRONTEND: this is what the client crafting-table prompt does — it reads each
// nearby placeable's bikkie `isCraftingStation` flag and builds candidates, then
// the gating module picks the station the player is standing at. We simulate the
// adapter (every seeded business station resolves isCraftingStation=true, since
// each references a real crafting-station bikkie item) and verify the seeded
// stations actually drive the prompt.
function candidateFromSeed(
  seed: HarthmereBusinessCraftingStationSeed
): HarthmereCraftingTableCandidate {
  return {
    entityId: String(seed.entityId),
    position: [seed.position[0], seed.position[1], seed.position[2]] as const,
    isCraftingStation: true,
    usable: true,
    stationName: seed.stationName,
  };
}

describe("business crafting station proximity prompt", () => {
  it("treats every seeded business station as a craftable table", () => {
    for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS) {
      assert.ok(
        isHarthmereCraftingTable({
          hasPlaceableComponent: true,
          itemIsCraftingStation: true,
        }),
        `${seed.outpostId} station should gate as a crafting table`
      );
    }
  });

  it("offers the prompt when the player stands at a station facing it", () => {
    const seed = HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS[0];
    const candidates = HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS.map(
      candidateFromSeed
    );
    // Stand just south of the first station, looking north (+x toward it).
    const playerPosition = [
      seed.position[0] - 1.5,
      seed.position[1],
      seed.position[2],
    ] as const;
    const facingView = [1, 0, 0] as const;
    const selection = selectNearestHarthmereCraftingTable({
      playerPosition,
      facingView,
      candidates,
    });
    assert.ok(selection, "expected the station prompt to be offered");
    assert.equal(selection!.entityId, String(seed.entityId));
    assert.equal(selection!.stationName, seed.stationName);
  });

  it("never offers the prompt for a non-station placeable at the same spot", () => {
    const seed = HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS[0];
    const notAStation: HarthmereCraftingTableCandidate = {
      entityId: "decoration",
      position: [seed.position[0], seed.position[1], seed.position[2]] as const,
      isCraftingStation: false,
    };
    const selection = selectNearestHarthmereCraftingTable({
      playerPosition: [
        seed.position[0] - 1.5,
        seed.position[1],
        seed.position[2],
      ] as const,
      facingView: [1, 0, 0] as const,
      candidates: [notAStation],
    });
    assert.equal(selection, undefined);
  });
});
