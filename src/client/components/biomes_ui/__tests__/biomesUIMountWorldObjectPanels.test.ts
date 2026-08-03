import assert from "assert";
import fs from "fs";
import path from "path";

describe("BiomesUIMount world-object interaction surfaces", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/client/components/biomes_ui/BiomesUIMount.tsx"
    ),
    "utf8"
  );

  it("mounts the container and cooking panels that consume F-open events", () => {
    assert.match(source, /import \{ HarthmereObjectContainerPanel \}/);
    assert.match(source, /import \{ HarthmereCookingStationPanel \}/);
    assert.match(source, /<HarthmereObjectContainerPanel \/>/);
    assert.match(source, /<HarthmereCookingStationPanel \/>/);
  });

  it("keeps the existing working F prompt surfaces mounted", () => {
    for (const component of [
      "HarthmereJobsBoardWorldInteraction",
      "HarthmereRequestBoardWorldInteraction",
      "HarthmereWantedBoardWorldInteraction",
      "HarthmereBusinessWorldInteraction",
      "HarthmerePropertyForSaleWorldInteraction",
      "HarthmereGatheringNodeWorldInteraction",
    ]) {
      assert.match(
        source,
        new RegExp(`<${component}\\b`),
        `${component} should still be mounted`
      );
    }
  });

  it("closes native Recipes before opening a locate-on-map request", () => {
    assert.match(source, /useClientContext/);
    assert.match(
      source,
      /reactResources\.set\("\/game_modal",\s*\{\s*kind: "empty",\s*returnPointerLock: false,?\s*\}\);[\s\S]*setActiveTab\("map"\)/
    );
  });
});
