import assert from "assert";
import { nativeStructureCollisionIdsForPlotForTest } from "../live_mode";
import { buildingSystemPlotById } from "@/shared/harthmere/building_system";

describe("property native ECS/Gaia clearance", () => {
  it("reports groups, placeables, and blueprints while ignoring terrain and actors", async () => {
    const plot = buildingSystemPlotById("harthmere_riverside_cottage_lot")!;
    let scannedAabb: unknown;
    const entity = (
      id: number,
      kind: "group" | "placeable" | "blueprint" | "actor" | "terrain"
    ) => ({
      id,
      hasIced: () => false,
      hasShardSeed: () => kind === "terrain",
      hasGroupComponent: () => kind === "group",
      hasPlaceableComponent: () => kind === "placeable",
      hasBlueprintComponent: () => kind === "blueprint",
    });
    const collisions = await nativeStructureCollisionIdsForPlotForTest({
      plot,
      askApi: {
        scanForExport: async function* ({ aabb }: any) {
          scannedAabb = aabb;
          yield [1, entity(10, "terrain")] as any;
          yield [1, entity(11, "actor")] as any;
          yield [1, entity(12, "group")] as any;
          yield [1, entity(13, "placeable")] as any;
          yield [1, entity(14, "blueprint")] as any;
        },
      } as any,
    });
    assert.ok(
      scannedAabb,
      "the requested deed should produce a native AABB scan"
    );
    assert.deepEqual(collisions, ["12", "13", "14"]);
  });
});
