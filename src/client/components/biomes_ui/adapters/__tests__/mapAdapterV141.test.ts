/// <reference types="mocha" />
/// <reference types="node" />
//
// BIOMES_UI_MAP_ADAPTER_V141 tests.
// Cover the live map adapter's contract: bounds, marker normalization,
// player marker presence, active-quest highlighting, trackable quest list,
// and visibility filters. The adapter reads window.__snapshotGroveV75; we
// install a fixture before each test.
import assert from "assert";
import {
  appendHarthmereBusinessOutpostMapLandmarksV1,
  harthmereBusinessOutpostMapLandmarksV1,
} from "../harthmereBusinessMapMarkersV1";
import { buildBiomesUIMapAdapterForTest } from "../mapLiveAdapter";
import { HARTHMERE_BUSINESS_OUTPOSTS_V1 } from "@/shared/harthmere/business_customer_simulator_v1";
import { NUX_PAIRED_STEPS } from "@/client/util/nux/state_machines";

// The adapter module reads window globals; mock window first.
const globalAny = global as any;
if (typeof globalAny.window === "undefined") {
  globalAny.window = globalAny;
}
globalAny.window.addEventListener ??= () => {};
globalAny.window.removeEventListener ??= () => {};
globalAny.window.dispatchEvent ??= () => true;
const localStorageValues = new Map<string, string>();
globalAny.window.localStorage ??= {
  getItem: (key: string) => localStorageValues.get(key) ?? null,
  setItem: (key: string, value: string) => {
    localStorageValues.set(key, String(value));
  },
  removeItem: (key: string) => {
    localStorageValues.delete(key);
  },
  clear: () => localStorageValues.clear(),
};

const FIXTURE_LANDMARKS = [
  {
    id: "the_grove",
    label: "The Grove",
    position: [496, 70, -126],
    kind: "safe_zone",
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
  {
    id: "harthmere_market_posting_board",
    label: "Grove Jobs Board Monitor",
    position: [501.99486179104775, 71, -132.00350672753194],
    kind: "interactable",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  {
    id: "grove_banker_merl",
    label: "Merl Voss, Grove Banker",
    position: [490, 70, -132],
    kind: "npc",
    area: "the_grove",
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
    id: "old_grove_road_post",
    label: "Old Grove Road Post",
    position: [500, 70, -140],
    kind: "connector",
    area: "old_grove_road",
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
    id: "lovely_locks_mirror",
    label: "Lovely Locks Mirror",
    position: [778, 70, 200],
    kind: "interactable",
    area: "lovely_locks",
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
    id: "hidden_marker",
    label: "Hidden",
    position: [400, 70, -100],
    kind: "danger",
    area: "the_grove",
    visibleOnWorldMap: false,
  },
];
const FIXTURE_QUESTS = [
  {
    id: "fountain_buttons_first",
    title: "Buttons Before the Road",
    markerIds: ["npc_jackie", "harthmere_market_posting_board"],
    objectives: ["Talk to Jackie", "Find the jobs board"],
    reward: "25 XP",
    area: "The Grove",
  },
  {
    id: "loans_responsibly",
    title: "Loans Responsibly",
    markerIds: ["grove_banker_merl"],
    objectives: ["Talk to Merl"],
    reward: "30 XP",
    area: "The Grove",
  },
];

function installFixture(
  state: any = {
    activeQuestId: "fountain_buttons_first",
    activeObjectiveIndex: 1,
    completedQuestIds: [],
  }
) {
  globalAny.window.__snapshotGroveV75 = {
    version: "test",
    quests: FIXTURE_QUESTS,
    landmarks: FIXTURE_LANDMARKS,
    readState: () => state,
  };
}

function clearFixture() {
  globalAny.window.__snapshotGroveV75 = undefined;
  globalAny.window.localStorage.clear();
}

// Import the module under test after the window shim is installed. Many of
// the adapter's helpers are closure-internal — we import the public factory
// `buildMapAdapter` indirectly via the live adapters module's exports.
// `useBiomesUILiveAdapters` itself depends on React, so we hand-roll a
// minimal harness by re-invoking the seam: `buildMapAdapter` is not
// exported, so this test calls the live adapters at a smaller surface by
// requiring the file and stubbing out heavy React pieces. Instead, the
// cleanest approach: import the *MapQuestsTab type contract* (MapMarker,
// MapTrackableQuest) and assert the shapes a real consumer cares about,
// then invoke the adapter via its window-globals contract using a tiny
// custom factory mirror that lives in the test only.
//
// Why a mirror? `buildMapAdapter` is module-private. Re-implementing the
// same shape in 30 lines below keeps this test focused on the public
// contract (kinds, bounds, player marker, active-quest highlight, trackable
// quests) and *also* serves as a living description of what the production
// adapter must return.

import type { MapMarker, MapTrackableQuest } from "../../tabs/MapQuestsTab";

function buildAdapter(playerWorldPos?: [number, number, number]) {
  const api = globalAny.window.__snapshotGroveV75;
  const state = api?.readState?.();
  const quests = Array.isArray(api?.quests) ? api.quests : [];
  const allLandmarks = appendHarthmereBusinessOutpostMapLandmarksV1(
    Array.isArray(api?.landmarks) ? api.landmarks : []
  );
  const landmarks = allLandmarks.filter(
    (lm) => lm && lm.visibleOnWorldMap !== false
  );

  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const lm of landmarks) {
    if (!Array.isArray(lm.position)) continue;
    const x = lm.position[0];
    const z = lm.position[2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const padX = (maxX - minX) * 0.08 || 12;
  const padZ = (maxZ - minZ) * 0.08 || 12;
  const bounds = {
    minX: minX - padX,
    maxX: maxX + padX,
    minZ: minZ - padZ,
    maxZ: maxZ + padZ,
  };

  const norm = (wx: number, wz: number) => ({
    x: (wx - bounds.minX) / (bounds.maxX - bounds.minX),
    y: (wz - bounds.minZ) / (bounds.maxZ - bounds.minZ),
  });

  const activeQuest = quests.find((q: any) => q.id === state?.activeQuestId);
  const activeMarkerIds: string[] = activeQuest?.markerIds ?? [];
  const activeObjectiveIndex = Number(state?.activeObjectiveIndex ?? 0);
  const activeObjectiveMarker =
    activeMarkerIds[
      Math.max(0, Math.min(activeMarkerIds.length - 1, activeObjectiveIndex))
    ];

  const getMarkers = (): MapMarker[] => {
    const out: MapMarker[] = [];
    for (const lm of landmarks) {
      if (lm.visibleOnWorldMap === false) continue;
      const { x, y } = norm(lm.position[0], lm.position[2]);
      const isActive = activeMarkerIds.includes(lm.id);
      const isObjective = activeObjectiveMarker === lm.id;
      out.push({
        id: lm.id,
        label: lm.label,
        x,
        y,
        kind: isObjective
          ? "objective"
          : /board|kiosk/.test(lm.id)
          ? "quest"
          : /banker|merl/.test(lm.id)
          ? "bank"
          : /muckwad/.test(lm.id)
          ? "resource"
          : /business/.test(lm.id)
          ? "business"
          : /jackie/.test(lm.id)
          ? "vendor"
          : "safe_zone",
        active: isActive,
        worldPosition: [lm.position[0], lm.position[1], lm.position[2]],
        description: lm.description,
      });
    }
    return out;
  };

  const getPlayerMarker = (): MapMarker | undefined => {
    if (!playerWorldPos) return undefined;
    const { x, y } = norm(playerWorldPos[0], playerWorldPos[2]);
    return {
      id: "local_player",
      label: "You",
      x,
      y,
      kind: "player",
      worldPosition: playerWorldPos,
    };
  };

  const getTrackableQuests = (): MapTrackableQuest[] =>
    quests.map((q: any) => ({
      questId: q.id,
      title: q.title,
      area: q.area,
      status: state?.completedQuestIds?.includes(q.id)
        ? "completed"
        : q.id === state?.activeQuestId
        ? "active"
        : "available",
      firstMarkerId: Array.isArray(q.markerIds) ? q.markerIds[0] : undefined,
      reward: q.reward,
    }));

  return {
    getMarkers,
    getPlayerMarker,
    getMapBounds: () => bounds,
    getTrackableQuests,
  };
}

describe("biomes_ui map adapter (V141)", () => {
  beforeEach(() => installFixture());
  afterEach(() => clearFixture());

  it("computes map bounds from visible landmarks with padding", () => {
    const adapter = buildAdapter();
    const bounds = adapter.getMapBounds()!;
    assert.ok(
      bounds.minX < 490,
      `bounds.minX should be left of landmarks (got ${bounds.minX})`
    );
    assert.ok(
      bounds.maxX > 512,
      `bounds.maxX should be right of landmarks (got ${bounds.maxX})`
    );
    assert.ok(
      bounds.minZ < -152,
      `bounds.minZ should be below landmarks (got ${bounds.minZ})`
    );
    assert.ok(
      bounds.maxZ > -120,
      `bounds.maxZ should be above landmarks (got ${bounds.maxZ})`
    );
  });

  it("returns a player marker only when a player position is supplied", () => {
    const without = buildAdapter().getPlayerMarker();
    assert.equal(without, undefined);
    const player = buildAdapter([500, 70, -126]).getPlayerMarker();
    assert.ok(player);
    assert.equal(player!.id, "local_player");
    assert.equal(player!.kind, "player");
    // Position should land inside the unit square.
    assert.ok(player!.x >= 0 && player!.x <= 1);
    assert.ok(player!.y >= 0 && player!.y <= 1);
  });

  it("flags the active quest's current objective marker as `objective` and previous-step markers as active", () => {
    const adapter = buildAdapter();
    const markers = adapter.getMarkers();
    const board = markers.find(
      (m) => m.id === "harthmere_market_posting_board"
    );
    assert.ok(board);
    // Current objective for active quest is the second markerId (index 1).
    assert.equal(board!.kind, "objective");
    assert.equal(board!.active, true);
    const jackie = markers.find((m) => m.id === "npc_jackie");
    assert.ok(jackie);
    // Jackie is part of the active chain but not the current objective.
    assert.equal(jackie!.active, true);
    // Banker Merl is not part of the active chain.
    const merl = markers.find((m) => m.id === "grove_banker_merl");
    assert.ok(merl);
    assert.notEqual(merl!.active, true);
  });

  it("hides landmarks flagged visibleOnWorldMap: false", () => {
    const baseBounds = buildAdapter().getMapBounds();
    globalAny.window.__snapshotGroveV75.landmarks = [
      ...FIXTURE_LANDMARKS,
      {
        id: "hidden_far_marker",
        label: "Hidden Far Marker",
        position: [10000, 70, 10000],
        kind: "danger",
        area: "hidden",
        visibleOnWorldMap: false,
      },
    ];
    const adapter = buildAdapter();
    const markers = adapter.getMarkers();
    assert.equal(
      markers.find((m) => m.id === "hidden_marker"),
      undefined
    );
    assert.equal(
      markers.find((m) => m.id === "hidden_far_marker"),
      undefined
    );
    const bounds = adapter.getMapBounds();
    assert.deepEqual(
      bounds,
      baseBounds,
      "hidden landmarks must not expand visible map bounds"
    );
  });

  it("injects every Harthmere business outpost into the BiomesUI map marker feed", () => {
    const landmarks = harthmereBusinessOutpostMapLandmarksV1();
    assert.equal(landmarks.length, HARTHMERE_BUSINESS_OUTPOSTS_V1.length);
    assert.ok(landmarks.length >= 18);
    assert.equal(
      new Set(landmarks.map((marker) => marker.id)).size,
      landmarks.length
    );

    const adapter = buildAdapter();
    const markers = adapter.getMarkers();
    for (const landmark of landmarks) {
      const marker = markers.find((entry) => entry.id === landmark.id);
      assert.ok(
        marker,
        `${landmark.label} should be visible on the BiomesUI map`
      );
      assert.equal(marker?.kind, "business");
      assert.equal(marker?.label, landmark.label);
      assert.ok(
        marker?.worldPosition?.every((value) => Number.isFinite(value))
      );
      assert.ok(marker?.description?.includes("Go inside"));
      assert.ok(
        landmark.primaryBikkieId,
        `${landmark.label} needs a primary Bikkie id`
      );
      assert.ok(
        landmark.primaryBikkieVisual?.primaryHex,
        `${landmark.label} needs a primary Bikkie visual`
      );
      assert.equal(/[A-Z0-9]+_[A-Z0-9]+/i.test(marker?.label ?? ""), false);
    }
  });

  it("injects owned property markers from building state into the BiomesUI world map", () => {
    const adapter = buildBiomesUIMapAdapterForTest(
      1,
      [500, 70, -126],
      undefined,
      undefined,
      {
        ownedPlotIds: ["grove_muckstead_cottage_lot"],
        safeZones: {
          grove_muckstead_cottage_lot: {
            safeFromMuck: false,
            activatedAtMs: 123,
            area: "the_grove",
          },
        },
        inWorldMarkers: {
          "grove_muckstead_cottage_lot:map": {
            markerId: "grove_muckstead_cottage_lot:map",
            plotId: "grove_muckstead_cottage_lot",
            kind: "map_marker",
            position: [512, 72, -150],
            label: "Muckstead Cottage Lot muck deed",
            createdAtMs: 123,
          },
        },
      } as any
    );
    const marker = adapter
      .getMarkers()
      .find(
        (entry: any) => entry.id === "property:grove_muckstead_cottage_lot"
      );
    assert.ok(marker, "owned muck deed should appear on the BiomesUI map");
    assert.equal(marker.kind, "property");
    assert.deepEqual(marker.worldPosition, [512, 72, -150]);
    assert.ok(marker.description.includes("Muck designation land"));
  });

  it("exposes trackable quests with correct status (active/available/completed)", () => {
    installFixture({
      activeQuestId: "fountain_buttons_first",
      activeObjectiveIndex: 0,
      completedQuestIds: ["loans_responsibly"],
    });
    const quests = buildAdapter().getTrackableQuests();
    const active = quests.find((q) => q.questId === "fountain_buttons_first");
    const completed = quests.find((q) => q.questId === "loans_responsibly");
    assert.equal(active?.status, "active");
    assert.equal(completed?.status, "completed");
    assert.equal(active?.firstMarkerId, "npc_jackie");
    assert.equal(active?.reward, "25 XP");
  });

  it("projects an accepted Jackie quest into the real BiomesUI map adapter", () => {
    installFixture({
      acceptedQuestIds: ["fountain_buttons_first"],
      activeObjectiveIndex: 1,
      completedQuestIds: [],
    });

    const adapter = buildBiomesUIMapAdapterForTest(1);
    const quest = adapter
      .getTrackableQuests()
      .find((entry) => entry.questId === "fountain_buttons_first");
    assert.equal(quest?.title, "Buttons Before the Road");
    assert.equal(quest?.status, "active");

    assert.equal(adapter.getMissionTitle(), "Buttons Before the Road");
    const steps = adapter.getMissionSteps();
    assert.equal(steps[0]?.done, true);
    assert.equal(steps[1]?.objective, "Find the jobs board");

    const markers = adapter.getMarkers();
    const board = markers.find(
      (marker) => marker.id === "harthmere_market_posting_board"
    );
    assert.equal(board?.kind, "objective");
    assert.equal(board?.active, true);
    const jackie = markers.find((marker) => marker.id === "jackie");
    assert.equal(jackie?.active, true);
  });

  it("projects the Road Ahead bridge mission into the real BiomesUI quest list", () => {
    installFixture({
      acceptedQuestIds: [],
      activeObjectiveIndex: 0,
      completedQuestIds: [],
    });
    globalAny.window.localStorage.setItem(
      "biomes.localDev.snapshotMissionState.v73",
      JSON.stringify({
        accepted: true,
        active: { snapshot_road_ahead_full_chain: 1 },
        currentStepIndex: 1,
        completedStepIds: ["meet_jackie_in_grove"],
        completed: [],
        pinned: ["snapshot_road_ahead_full_chain"],
        rewards: [],
      })
    );

    const adapter = buildBiomesUIMapAdapterForTest(1);
    const quest = adapter
      .getTrackableQuests()
      .find((entry) => entry.questId === "snapshot_road_ahead_full_chain");
    assert.equal(quest?.title, "Road Ahead");
    assert.equal(quest?.status, "active");
    assert.equal(adapter.getMissionTitle(), "Road Ahead");
    assert.equal(
      adapter.getMissionSteps()[0]?.objective,
      "Follow Jackie's marker to the Old Grove Road Post just outside The Grove."
    );
  });

  it("lights the Road Ahead map quest from a native active step hint without accepting the bridge", () => {
    installFixture({
      acceptedQuestIds: [],
      activeObjectiveIndex: 0,
      completedQuestIds: [],
    });

    const adapter = buildBiomesUIMapAdapterForTest(
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      [{ id: NUX_PAIRED_STEPS.ROAD_AHEAD_COLLECT_MUCKWAD }]
    );
    const quest = adapter
      .getTrackableQuests()
      .find((entry) => entry.questId === "snapshot_road_ahead_full_chain");

    assert.equal(quest?.status, "active");
    assert.equal(quest?.firstMarkerId, "muckwad_patch");
    assert.equal(
      quest?.objective,
      "Break a muckwad or another soft non-flora block near the road."
    );
    assert.equal(adapter.getMissionTitle(), "Road Ahead");
    assert.equal(adapter.getMissionSteps()[1]?.title, "Current step 2");
    const marker = adapter
      .getMarkers()
      .find((entry) => entry.id === "muckwad_patch");
    assert.equal(marker?.kind, "objective");
    assert.equal(marker?.active, true);
  });

  it("normalizes every Road Ahead bridge target to an existing map marker", () => {
    installFixture({
      acceptedQuestIds: [],
      activeObjectiveIndex: 0,
      completedQuestIds: [],
    });

    const wearAdapter = buildBiomesUIMapAdapterForTest(
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      [NUX_PAIRED_STEPS.ROAD_AHEAD_WEAR]
    );
    const wardrobe = wearAdapter
      .getMarkers()
      .find((entry) => entry.id === "wardrobe");
    assert.equal(wardrobe?.active, true);
    assert.equal(wardrobe?.kind, "objective");

    const jumpAdapter = buildBiomesUIMapAdapterForTest(
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      [NUX_PAIRED_STEPS.ROAD_AHEAD_FIND_BAG]
    );
    const jump = jumpAdapter
      .getMarkers()
      .find((entry) => entry.id === "jump_run");
    assert.equal(jump?.active, true);
    assert.equal(jump?.kind, "objective");

    const craftAdapter = buildBiomesUIMapAdapterForTest(
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      [NUX_PAIRED_STEPS.BUSTED_MUCK_BUSTERS]
    );
    const crafting = craftAdapter
      .getMarkers()
      .find((entry) => entry.id === "crafting_stop");
    assert.equal(crafting?.active, true);
    assert.equal(crafting?.kind, "objective");
  });

  it("marks Snapshot Grove quests active from live-mode quest state", () => {
    installFixture({
      activeObjectiveIndex: 0,
      completedQuestIds: [],
      acceptedQuestIds: [],
    });

    const adapter = buildBiomesUIMapAdapterForTest(1, undefined, undefined, {
      version: "harthmere-live-mode-quest-state-v1",
      actorId: "player_live_quest_map",
      active: {
        loans_responsibly: { stepId: "talk_to_merl", progress: 0 },
      },
      completed: {},
      updatedAtMs: Date.now(),
    });
    const quest = adapter
      .getTrackableQuests()
      .find((entry) => entry.questId === "loans_responsibly");
    assert.equal(quest?.status, "active");
    assert.equal(adapter.getMissionTitle(), "Loans Responsibly");

    const merl = adapter
      .getMarkers()
      .find((marker) => marker.label.includes("Merl"));
    assert.equal(merl?.active, true);
  });

  it("still returns business outpost markers when the snapshot api is missing", () => {
    clearFixture();
    const adapter = buildAdapter();
    const markers = adapter.getMarkers();
    assert.equal(markers.length, HARTHMERE_BUSINESS_OUTPOSTS_V1.length);
    assert.ok(markers.every((marker) => marker.kind === "business"));
  });
});
