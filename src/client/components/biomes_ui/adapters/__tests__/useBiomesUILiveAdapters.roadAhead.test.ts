/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import { createRequire } from "module";

// Opt into the legacy bridge solely for its compatibility marker tests.
process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD = "1";

const globalAny = global as any;
const localStorageValues = new Map<string, string>();

function installWindowShim() {
  globalAny.window = {
    __snapshotGrove: undefined,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    localStorage: {
      getItem: (key: string) => localStorageValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageValues.set(key, String(value));
      },
      removeItem: (key: string) => {
        localStorageValues.delete(key);
      },
      clear: () => localStorageValues.clear(),
    },
  };
}

installWindowShim();

const requireForTest = createRequire(import.meta.url);
const Module = requireForTest("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolvePublicAsset(
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (request.startsWith("/public/")) {
    return request;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
requireForTest.extensions[".png"] = (module: any, filename: string) => {
  module.exports = filename;
};

const { buildBiomesUIMapAdapterForTest } = requireForTest(
  "../useBiomesUILiveAdapters"
);

const FIXTURE_LANDMARKS = [
  {
    id: "old_grove_road_post",
    label: "Old Grove Road Post",
    position: [500, 70, -140],
    kind: "connector",
    area: "old_grove_road",
    visibleOnWorldMap: true,
  },
  {
    id: "muckwad_patch",
    label: "Muckwad Patch",
    position: [512, 70, -152],
    kind: "resource",
    area: "muck_edges",
    visibleOnWorldMap: true,
  },
  {
    id: "building_practice_spot",
    label: "Building Practice Spot",
    position: [528, 70, -152],
    kind: "interactable",
    area: "old_grove_road",
    visibleOnWorldMap: true,
  },
  {
    id: "lovely_locks_mirror",
    label: "Lovely Locks Mirror",
    position: [778, 70, 200],
    kind: "interactable",
    area: "lovely_locks",
    visibleOnWorldMap: true,
  },
  {
    id: "road_jump_stretch",
    label: "Road Jump Stretch",
    position: [548, 70, -170],
    kind: "connector",
    area: "old_grove_road",
    visibleOnWorldMap: true,
  },
  {
    id: "selfie_overlook",
    label: "Selfie Overlook",
    position: [560, 70, -182],
    kind: "connector",
    area: "old_grove_road",
    visibleOnWorldMap: true,
  },
  {
    id: "service_tower_platform",
    label: "Service Tower Platform",
    position: [504, 70, -130],
    kind: "interactable",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  {
    id: "npc_jackie",
    label: "Jackie",
    position: [496, 70, -126],
    kind: "npc",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
];

const ROAD_AHEAD_STEP_IDS = [
  "meet_jackie_in_grove",
  "road_ahead_meet_up_with_billy",
  "road_ahead_collect_muckwad",
  "road_ahead_place_blocks",
  "road_ahead_wear",
  "road_ahead_find_bag",
  "road_ahead_selfie",
  "busted_wooden_axe",
  "busted_muck_busters",
  "return_to_jackie",
];

function installFixture() {
  globalAny.window.__snapshotGrove = {
    version: "test",
    quests: [],
    landmarks: FIXTURE_LANDMARKS,
    readState: () => ({
      acceptedQuestIds: [],
      completedQuestIds: [],
      activeObjectiveIndex: 0,
    }),
  };
}

function writeRoadAheadState(currentStepIndex: number) {
  globalAny.window.localStorage.setItem(
    "biomes.localDev.snapshotMissionState",
    JSON.stringify({
      accepted: true,
      active: { snapshot_road_ahead_full_chain: currentStepIndex },
      currentStepIndex,
      completedStepIds: ROAD_AHEAD_STEP_IDS.slice(0, currentStepIndex),
      completed: [],
      pinned: ["snapshot_road_ahead_full_chain"],
      rewards: [],
    })
  );
}

describe("useBiomesUILiveAdapters Road Ahead map markers", () => {
  beforeEach(() => {
    localStorageValues.clear();
    installWindowShim();
    installFixture();
  });

  it("marks the current block placement step as an active live map objective", () => {
    writeRoadAheadState(3);

    const adapter = buildBiomesUIMapAdapterForTest(1);
    const quest = adapter
      .getTrackableQuests()
      .find((entry: any) => entry.questId === "snapshot_road_ahead_full_chain");
    assert.equal(quest?.status, "active");
    assert.equal(quest?.firstMarkerId, "building_spot");

    const marker = adapter
      .getMarkers()
      .find((entry: any) => entry.id === "building_spot");
    assert.equal(marker?.kind, "objective");
    assert.equal(marker?.active, true);
    assert.equal(
      marker?.description,
      "Current Road Ahead objective - head here to advance the route."
    );
  });

  it("normalizes every Road Ahead target used after block placement", () => {
    const cases = [
      [4, "wardrobe"],
      [5, "jump_run"],
      [6, "selfie_overlook"],
      [8, "crafting_stop"],
      [9, "jackie"],
    ] as const;

    for (const [stepIndex, markerId] of cases) {
      localStorageValues.clear();
      installFixture();
      writeRoadAheadState(stepIndex);

      const marker = buildBiomesUIMapAdapterForTest(1)
        .getMarkers()
        .find((entry: any) => entry.id === markerId);
      assert.equal(marker?.kind, "objective", markerId);
      assert.equal(marker?.active, true, markerId);
    }
  });
});
