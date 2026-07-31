import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere placeable crafting-station F fallback", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/client/game/scripts/overlays.ts"),
    "utf8"
  );

  it("scans nearby placeable crafting stations with the shared proximity gate", () => {
    assert.match(source, /HARTHMERE_PLACEABLE_CRAFTING_STATION_FALLBACK/);
    assert.match(source, /selectNearestHarthmereCraftingTable/);
    assert.match(source, /PlaceableSelector\.query\.spatial\.inSphere/);
    assert.match(source, /item\.isCraftingStation/);
  });

  it("also surfaces the prompt for placed cooking stations (campfire/oven/pot)", () => {
    // A placed campfire is not flagged isCraftingStation, so the proximity
    // fallback must additionally accept cook stations or standing over a
    // campfire shows no F prompt.
    assert.match(source, /isHarthmerePlacedCookStationItem/);
    assert.match(source, /!item\.isCraftingStation\s*&&\s*!isCookStation/);
  });

  it("returns the native placeable overlay so cooking and crafting keep existing routing", () => {
    assert.match(
      source,
      /kind:\s*"placeable"[\s\S]*itemId:\s*entity\.placeable_component\.item_id/
    );
    assert.match(source, /label:\s*selected\.stationName/);
  });

  it("checks placeable stations before falling back to NPC talk", () => {
    const priority =
      /getNearbyHarthmereObjectInspectableOverlay\(\)\s*\?\?\s*this\.getNearbyHarthmerePlaceableCraftingStationOverlay\(\)\s*\?\?\s*this\.getNearbyNpcTalkInspectableOverlay\(\)/;
    assert.match(source, priority);
  });

  it("keeps a directly targeted native crop ahead of every proximity fallback", () => {
    const directTerrainTarget = source.indexOf(
      "A terrain ray hit is more specific than any proximity fallback"
    );
    const nearbyFallbacks = source.indexOf(
      "const nearbyGrabBagOverlay = this.getNearbyGrabBagInspectableOverlay()"
    );
    assert.ok(
      directTerrainTarget >= 0,
      "direct terrain priority is documented"
    );
    assert.ok(nearbyFallbacks >= 0, "nearby fallback chain exists");
    assert.ok(
      directTerrainTarget < nearbyFallbacks,
      "the crop under the reticle must mount its plant overlay before a nearby NPC, container, bag, or station can claim F"
    );
  });

  it("shows the planted crop overlay while the cursor is over its soil plot", () => {
    assert.match(
      source,
      /const plantId = plantExperimentalAt\([\s\S]*?if \(projection\) \{[\s\S]*?kind: "plant"/
    );
    assert.doesNotMatch(
      source,
      /projection && hit\.terrainId !== getTerrainID\("soil"\)/
    );
  });

  it("keeps hidden static quest containers gated without suppressing visible live crates", () => {
    assert.match(source, /harthmereVisibleStaticWorldObjectInspectCandidates/);
    assert.match(
      source,
      /harthmereWorldObjectCandidateIsVisibleForInteraction/
    );
    assert.match(source, /activeHarthmereQuestMarkerIds/);
    assert.match(source, /activeMarkerIds\.has\(candidate\.id\)/);
    assert.match(source, /readActiveBiomesUIMapPin/);
    assert.match(
      source,
      /live ECS[\s\S]{0,200}already rendered[\s\S]{0,200}must keep its prompt/
    );
    assert.doesNotMatch(
      source,
      /harthmereLiveWorldObjectCandidateIsVisibleForInteraction/
    );
    assert.doesNotMatch(source, /isAuthoredQuestContainer/);
  });

  it("imports the shared world-object radius used by the render loop", () => {
    assert.match(
      source,
      /import\s*\{[\s\S]*?HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS[\s\S]*?\}\s*from\s*["']@\/shared\/harthmere\/harthmere_world_object_inspectable["']/
    );
    assert.match(
      source,
      /Math\.min\(HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS,\s*maxDistance\)/
    );
  });
});
