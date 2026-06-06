import { CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST } from "@/client/components/overlays/inspected/inspectionShortcutKeys";
import {
  plantInspectionCanHarvestV1,
  plantInspectionShortcutTitlesForTest,
} from "@/client/components/overlays/inspected/plantInspectionShortcuts";
import assert from "assert";

describe("PlantInspectionOverlayComponent harvest shortcut", () => {
  it("shows harvest only for fully grown non-tree plants", () => {
    assert.equal(plantInspectionCanHarvestV1("fully_grown", "plant"), true);
    assert.equal(plantInspectionCanHarvestV1("fully_grown", "tree"), false);
    assert.equal(plantInspectionCanHarvestV1("growing", "plant"), false);
  });

  it("puts harvest on the F shortcut before admin destroy", () => {
    assert.deepEqual(CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST[0], {
      key: "F",
      keyCode: "KeyF",
    });
    assert.deepEqual(
      plantInspectionShortcutTitlesForTest({
        status: "fully_grown",
        farmingKind: "plant",
        destroyPermitted: true,
      }),
      ["Harvest", "[Admin] Destroy Plant"]
    );
  });
});
