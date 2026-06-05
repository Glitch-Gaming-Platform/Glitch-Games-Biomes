import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere placeable crafting-station F fallback", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/client/game/scripts/overlays.ts"),
    "utf8"
  );

  it("scans nearby placeable crafting stations with the shared proximity gate", () => {
    assert.match(
      source,
      /HARTHMERE_PLACEABLE_CRAFTING_STATION_FALLBACK_V1/
    );
    assert.match(source, /selectNearestHarthmereCraftingTableV1/);
    assert.match(source, /PlaceableSelector\.query\.spatial\.inSphere/);
    assert.match(source, /item\.isCraftingStation/);
  });

  it("also surfaces the prompt for placed cooking stations (campfire/oven/pot)", () => {
    // A placed campfire is not flagged isCraftingStation, so the proximity
    // fallback must additionally accept cook stations or standing over a
    // campfire shows no F prompt.
    assert.match(source, /isHarthmerePlacedCookStationItemV1/);
    assert.match(
      source,
      /!item\.isCraftingStation\s*&&\s*!isCookStation/
    );
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
      /getNearbyHarthmereObjectInspectableOverlayV1\(\)\s*\?\?\s*this\.getNearbyHarthmerePlaceableCraftingStationOverlayV1\(\)\s*\?\?\s*this\.getNearbyNpcTalkInspectableOverlayV140\(\)/;
    assert.match(source, priority);
  });
});
