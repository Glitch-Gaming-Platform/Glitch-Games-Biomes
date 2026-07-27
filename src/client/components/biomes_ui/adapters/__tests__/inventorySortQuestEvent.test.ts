import assert from "assert";
import fs from "fs";
import path from "path";

describe("BiomesUI inventory sort quest notification", () => {
  it("notifies shared inventory consumers after the native sort succeeds", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts"
      ),
      "utf8"
    );
    const sortStart = source.indexOf("sortInventory: async () => {");
    assert.notEqual(sortStart, -1, "async sort adapter is missing");
    const sortBody = source.slice(sortStart, sortStart + 700);

    assert.match(sortBody, /await events\.publish\(new InventorySortEvent/);
    assert.match(
      sortBody,
      /window\.dispatchEvent\(new Event\(HARTHMERE_INVENTORY_EVENT\)\)/
    );
    assert.ok(
      sortBody.indexOf("await events.publish") <
        sortBody.indexOf("window.dispatchEvent"),
      "the shared notification must follow native authority"
    );
  });

  it("publishes native hotbar assignment as an equipped hand item", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts"
      ),
      "utf8"
    );
    const marker = source.indexOf("biomes-ui-native-hotbar-equip");
    assert.notEqual(marker, -1, "native hotbar equip bridge is missing");
    const bridge = source.slice(marker - 900, marker + 700);

    assert.match(bridge, /window\.dispatchEvent\(new Event\(HARTHMERE_INVENTORY_EVENT\)\)/);
    assert.match(bridge, /kind: "equip"/);
    assert.match(bridge, /slot: "main_hand"/);
    assert.match(bridge, /operation: "equip"/);
    assert.ok(
      source.indexOf(".then(() => onPublished?.())") < marker,
      "the quest equip signal must follow native InventorySwapEvent authority"
    );
  });
});
