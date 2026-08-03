import assert from "assert";
import fs from "fs";
import path from "path";

describe("additive-town native cooking station overlay", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/client/components/overlays/inspected/placeables/CraftingStationOverlayComponent.tsx"
    ),
    "utf8"
  );

  it("uses the ECS label and reserved station identity to route F to cooking", () => {
    assert.match(source, /reactResources\.use\("\/ecs\/c\/label"/);
    assert.match(source, /isHarthmereAdditiveTownCookingStationEntityId/);
    assert.match(source, /harthmereAdditiveTownCookingStationKind/);
    assert.match(source, /openHarthmereCookingStation/);
    assert.match(source, /label:\s*displayName/);
  });
});
