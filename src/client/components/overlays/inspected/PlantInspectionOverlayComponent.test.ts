import { CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST } from "@/client/components/overlays/inspected/inspectionShortcutKeys";
import { submitHarthmereNativePlantHarvestToLiveModeForTest } from "@/client/components/overlays/inspected/nativePlantHarvestLiveModeBridge";
import {
  plantInspectionCanHarvest,
  plantInspectionShortcutTitlesForTest,
} from "@/client/components/overlays/inspected/plantInspectionShortcuts";
import { HARTHMERE_LIVE_INVENTORY_SYNC_EVENT } from "@/client/components/challenges/harthmereEvents";
import { BikkieIds } from "@/shared/bikkie/ids";
import assert from "assert";

describe("PlantInspectionOverlayComponent harvest shortcut", () => {
  it("shows harvest only for fully grown non-tree plants", () => {
    assert.equal(plantInspectionCanHarvest("fully_grown", "plant"), true);
    assert.equal(plantInspectionCanHarvest("fully_grown", "tree"), false);
    assert.equal(plantInspectionCanHarvest("growing", "plant"), false);
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

  it("bridges native F harvests into Cloud Save inventory mutations", async () => {
    const dispatched: Event[] = [];
    (globalThis as any).window = {
      location: {
        href: "http://localhost/play?install_id=test-install",
        search: "?install_id=test-install",
      },
      localStorage: { getItem: () => null },
      dispatchEvent: (event: Event) => {
        dispatched.push(event);
        return true;
      },
    };
    const calls: Array<{ input: unknown; init?: RequestInit }> = [];
    (globalThis as any).fetch = async (input: unknown, init?: RequestInit) => {
      calls.push({ input, init });
      return {
        ok: true,
        clone() {
          return this;
        },
        json: async () => ({
          ok: true,
          farmingFoodState: {},
          inventoryLootState: {
            actor: { items: { "4732724694489497": 1 } },
          },
        }),
      };
    };

    await submitHarthmereNativePlantHarvestToLiveModeForTest({
      plantId: BikkieIds.raspberrySeed,
      seedItemId: BikkieIds.raspberrySeed,
      plantStatus: "fully_grown",
      farmingKind: "plant",
      plantLabel: "Raspberry",
      position: [1, 2, 3],
    });

    assert.equal(calls.length, 1);
    assert.match(String(calls[0].input), /install_id=test-install/);
    const body = JSON.parse(String(calls[0].init?.body ?? "{}"));
    assert.equal(body.actionKind, "request_farming_action");
    assert.equal(body.payload.operation, "native_plant_harvest");
    assert.equal(body.payload.seedItemId, String(BikkieIds.raspberrySeed));
    assert.equal(body.payload.plantStatus, "fully_grown");
    assert.ok(body.includeSnapshots.includes("inventoryLootState"));
    assert.ok(
      dispatched.some(
        (event) => event.type === HARTHMERE_LIVE_INVENTORY_SYNC_EVENT
      )
    );
  });
});
