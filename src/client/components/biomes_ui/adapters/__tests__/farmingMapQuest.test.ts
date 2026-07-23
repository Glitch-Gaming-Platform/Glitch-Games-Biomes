import assert from "assert";
import { generateTestId } from "@/shared/test_helpers";
import {
  HARTHMERE_HOE_VENDOR_AUTHORED_POSITION,
  HARTHMERE_HOE_VENDOR_MARKER_ID,
  HARTHMERE_HOE_VENDOR_POSITION,
  acceptHarthmereHoeQuest,
  harthmereHoeQuestMapLandmarks,
  harthmereHoeQuestTrackableQuests,
  harthmereNativeCropMapLandmarks,
  readHarthmereHoeQuestState,
  reconcileHarthmereHoeQuestState,
} from "@/client/components/biomes_ui/adapters/farmingMapQuest";

const globalAny = global as any;
const values = new Map<string, string>();
globalAny.window ??= globalAny;
globalAny.window.localStorage ??= {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, String(value)),
  removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(),
};
globalAny.window.dispatchEvent ??= () => true;
globalAny.CustomEvent ??= class CustomEvent {
  constructor(public type: string, public init?: unknown) {}
};

describe("farming map and hoe quest projection", () => {
  it("persists the guide once and permanently completes it after a hoe is owned", () => {
    const userId = generateTestId();
    assert.equal(readHarthmereHoeQuestState(userId), "available");
    assert.equal(acceptHarthmereHoeQuest(userId), "active");
    assert.equal(readHarthmereHoeQuestState(userId), "active");
    assert.equal(reconcileHarthmereHoeQuestState(userId, true), "completed");
    assert.equal(readHarthmereHoeQuestState(userId), "completed");
    assert.equal(reconcileHarthmereHoeQuestState(userId, false), "completed");
  });

  it("projects only the supplied native crops and points the quest at the real vendor", () => {
    const cropId = generateTestId();
    const cropMarkers = harthmereNativeCropMapLandmarks({
      supplies: [],
      seedCount: 0,
      hasHoe: false,
      hasWateringCan: false,
      plants: [
        {
          id: cropId,
          name: "Carrot",
          seedId: generateTestId(),
          status: "growing",
          stage: 1,
          stageProgress: 0.5,
          waterLevel: 0.8,
          wilt: 0,
          position: [401, 54, -155],
          distance: 8,
          ownedByPlayer: true,
        },
      ],
    });
    assert.equal(cropMarkers.length, 1);
    assert.equal(cropMarkers[0].id, `farming:crop:${String(cropId)}`);
    assert.deepEqual(cropMarkers[0].position, [401, 54, -155]);

    const vendorMarker = harthmereHoeQuestMapLandmarks("active")[0];
    assert.deepEqual(HARTHMERE_HOE_VENDOR_AUTHORED_POSITION, [462, 53, -112]);
    assert.deepEqual(HARTHMERE_HOE_VENDOR_POSITION, [2062, 53, -112]);
    assert.equal(vendorMarker.id, HARTHMERE_HOE_VENDOR_MARKER_ID);
    assert.deepEqual(vendorMarker.position, HARTHMERE_HOE_VENDOR_POSITION);
    const quest = harthmereHoeQuestTrackableQuests("active")[0];
    assert.equal(quest.firstMarkerId, HARTHMERE_HOE_VENDOR_MARKER_ID);
    assert.equal(quest.toolSource?.vendorName, "Orchard Produce Stand");
    assert.match(quest.toolSource?.hint ?? "", /22 gold/);
  });
});
