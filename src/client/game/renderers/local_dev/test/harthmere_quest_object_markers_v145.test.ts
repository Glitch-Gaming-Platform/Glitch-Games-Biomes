/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  HARTHMERE_ACTIVE_QUEST_MARKER_BLUE_V145,
  HARTHMERE_ACTIVE_QUEST_MARKER_CAP_V145,
  HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145,
  HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY_V146,
  HARTHMERE_QUEST_OBJECT_MARKERS_V145,
  activeHarthmereQuestMarkerIdV145,
  createHarthmereActiveQuestMarkerBeaconV145,
  createHarthmereQuestObjectMarkerAnchorV146,
  createHarthmereQuestObjectMarkerMeshV145,
  isRenderableHarthmereQuestObjectLandmarkV145,
  makeHarthmereQuestObjectMarkersRendererV145,
} from "@/client/game/renderers/local_dev/harthmere_quest_object_markers_v145";
import { createNewScenes } from "@/client/game/renderers/scenes";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1,
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS_V1,
  isLiveEntityHelperMuckBossSpawnMarkerV1,
  liveEntityHelperQuestTargetMarkerForKindV1,
  liveEntityHelperQuestTargetMarkerIdForKindV1,
} from "@/shared/harthmere/live_entity_helper_quests_v1";
import { harthmereJobsBoardQuestMarkerPositionsV1 } from "@/shared/harthmere/jobs_board_quest_marker_positions_v1";
import {
  SNAPSHOT_GROVE_LANDMARKS_V75,
  SNAPSHOT_GROVE_QUESTS_V75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import * as THREE from "three";

const meshColors = (root: THREE.Object3D): number[] => {
  const colors: number[] = [];
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshBasicMaterial) {
        colors.push(material.color.getHex());
      }
    }
  });
  return colors;
};

const findRendererRoot = (scenes: ReturnType<typeof createNewScenes>) =>
  scenes.three.children.find((child) =>
    child.name.includes(HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145)
  ) as THREE.Group | undefined;

const findMarkerGroup = (root: THREE.Group, markerId: string) =>
  root.children.find(
    (child) => child.userData.harthmereQuestObjectMarkerId === markerId
  ) as THREE.Group | undefined;

const findActiveBeacon = (markerGroup: THREE.Group) =>
  markerGroup.children.find(
    (child) => child.userData.harthmereActiveQuestBeacon === true
  ) as THREE.Group | undefined;

describe("Harthmere quest object procedural markers V145", () => {
  it("registers every quest-linked non-NPC objective without requiring passive world props", () => {
    const expected = SNAPSHOT_GROVE_LANDMARKS_V75.filter(
      isRenderableHarthmereQuestObjectLandmarkV145
    );
    assert.ok(
      expected.length >= 25,
      `expected many quest object landmarks to be protected by procedural markers, got ${expected.length}`
    );
    const extraJobsBoardMarkers =
      harthmereJobsBoardQuestMarkerPositionsV1().filter(
        (marker) =>
          !SNAPSHOT_GROVE_LANDMARKS_V75.some(
            (landmark) => landmark.id === marker.markerId
          ) && marker.source !== "live_entity_helper"
      );
    assert.equal(
      HARTHMERE_QUEST_OBJECT_MARKERS_V145.length,
      expected.length +
        LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS_V1.length +
        extraJobsBoardMarkers.length
    );

    for (const landmark of expected) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS_V145.find(
        (candidate) => candidate.id === landmark.id
      );
      assert.ok(marker, `missing procedural marker for ${landmark.id}`);
      assert.equal(marker?.label, landmark.label);
      assert.equal(marker?.position[0], landmark.position[0]);
      assert.equal(marker?.position[2], landmark.position[2]);
      assert.equal(
        marker?.position[1],
        landmark.position[1] - 1,
        `${landmark.id} should render at feet/ground height, not at the hovering map-pin Y`
      );
    }
  });

  it("renders Jobs Board target markers, including monster-hunt destinations, from the shared resolver", () => {
    for (const id of [
      "muckwad_patch",
      "mosslawn_song_stones",
      "harthmere_market_office",
      "harthmere_chapel_stone",
      "harthmere_bridge_center",
      "refinery_intake_marker",
      "exotic_antihydrogen_east_underways_03",
      "exotic_antihelium_old_well_02",
      "exotic_antiboron_drain_vault_01",
      "exotic_antihydrogen_mossglass_survey_02",
      "exotic_antihelium_mossglass_survey_05",
      "exotic_antiboron_mossglass_survey_03",
      "exotic_antihydrogen_windowlight_02",
      "exotic_antihelium_deep_spindle_15",
      "exotic_antiboron_deep_spindle_16",
    ]) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS_V145.find(
        (candidate) => candidate.id === id
      );
      assert.ok(marker, `${id} should have a rendered quest/job marker`);
      const resolved = harthmereJobsBoardQuestMarkerPositionsV1().find(
        (candidate) => candidate.markerId === id
      );
      assert.ok(resolved, `${id} should resolve through the marker registry`);
      assert.equal(marker?.position[0], resolved!.position[0]);
      assert.equal(marker?.position[2], resolved!.position[2]);
    }
  });

  it("adds active-only live-entity helper quest targets at the authored coordinates", () => {
    for (const helperMarker of LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS_V1) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS_V145.find(
        (candidate) => candidate.id === helperMarker.id
      );
      assert.ok(marker, `missing helper marker ${helperMarker.id}`);
      assert.equal(marker?.dynamic, "live_entity_helper");
      assert.equal(marker?.label, helperMarker.label);
      assert.deepEqual(marker?.position, helperMarker.position);
    }

    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKindV1("exotic_matter"),
      "live_helper_old_well_exotic_residue"
    );
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKindV1("food_water"),
      "live_helper_bluewater_supply_route"
    );
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKindV1("hard_boss"),
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
    );
    assert.equal(
      isLiveEntityHelperMuckBossSpawnMarkerV1(
        liveEntityHelperQuestTargetMarkerForKindV1("hard_boss")
      ),
      true,
      "the boss marker must be in the authored Muck area and grounded"
    );
  });

  it("does not duplicate the oversized jobs board renderer", () => {
    const ids = new Set(
      HARTHMERE_QUEST_OBJECT_MARKERS_V145.map((marker) => marker.id)
    );
    assert.equal(ids.has("harthmere_market_posting_board"), false);
    assert.equal(ids.has("harthmere_town_market_posting_board"), false);
  });

  it("uses unlit non-culled meshes so quest props remain visible in dim or filtered scenes", () => {
    const sampleIds = [
      "grove_painted_route_flags",
      "grove_tool_crate",
      "grove_garden_edge_berries",
      "guild_project_table",
      "grove_drop_practice_stones",
      "exotic_antihydrogen_east_underways_03",
      "exotic_antihelium_old_well_02",
      "exotic_antiboron_drain_vault_01",
      "exotic_antihydrogen_mossglass_survey_02",
      "exotic_antihelium_mossglass_survey_05",
      "exotic_antiboron_mossglass_survey_03",
      "exotic_antihydrogen_windowlight_02",
      "exotic_antihelium_deep_spindle_15",
      "exotic_antiboron_deep_spindle_16",
    ];

    for (const id of sampleIds) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS_V145.find(
        (candidate) => candidate.id === id
      );
      assert.ok(marker, `${id} should have a procedural marker`);
      const mesh = createHarthmereQuestObjectMarkerMeshV145(marker!);
      assert.equal(
        mesh.userData.harthmereQuestObjectMarkerVersion,
        HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145
      );
      assert.equal(mesh.userData.harthmereQuestObjectMarkerId, id);

      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      assert.ok(
        size.x >= 0.7,
        `${id} should be wide enough to see, got ${size.x}`
      );
      assert.ok(
        size.y >= 0.3,
        `${id} should have visible object height, got ${size.y}`
      );
      assert.ok(
        size.z >= 0.7,
        `${id} should have visible depth, got ${size.z}`
      );

      let meshCount = 0;
      mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        meshCount += 1;
        assert.equal(
          child.material instanceof THREE.MeshBasicMaterial,
          true,
          `${id} should use MeshBasicMaterial so local lighting cannot hide it`
        );
        assert.equal(
          child.frustumCulled,
          false,
          `${id} should not be frustum-culled near the camera`
        );
      });
      assert.ok(
        meshCount >= 3,
        `${id} should be a real voxel object, got ${meshCount} meshes`
      );
    }
  });

  it("keeps active quest beacon art out of the always-visible base quest props", () => {
    for (const marker of HARTHMERE_QUEST_OBJECT_MARKERS_V145) {
      const mesh = createHarthmereQuestObjectMarkerMeshV145(marker);
      mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const colors = materials
          .filter(
            (material): material is THREE.MeshBasicMaterial =>
              material instanceof THREE.MeshBasicMaterial
          )
          .map((material) => material.color.getHex());

        assert.equal(
          colors.includes(HARTHMERE_ACTIVE_QUEST_MARKER_BLUE_V145),
          false,
          `${marker.id} must not draw an always-on blue active quest mast`
        );

        const box =
          child.geometry instanceof THREE.BoxGeometry
            ? child.geometry
            : undefined;
        const params = box?.parameters;
        const isOldWhiteCap =
          colors.includes(HARTHMERE_ACTIVE_QUEST_MARKER_CAP_V145) &&
          child.position.y > 1.4 &&
          params?.width === 0.26 &&
          params?.height === 0.26 &&
          params?.depth === 0.26;
        assert.equal(
          isOldWhiteCap,
          false,
          `${marker.id} must not draw an always-on white active quest cap`
        );
      });
    }
  });

  it("uses invisible active-beacon anchors in the live renderer instead of passive primitive props", () => {
    const marker = HARTHMERE_QUEST_OBJECT_MARKERS_V145[0];
    const anchor = createHarthmereQuestObjectMarkerAnchorV146(marker);
    assert.equal(anchor.visible, false);
    assert.equal(anchor.children.length, 0);
    assert.equal(
      anchor.userData.harthmereQuestObjectMarkerRenderPolicy,
      HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY_V146
    );

    const renderer = makeHarthmereQuestObjectMarkersRendererV145();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);
    const root = findRendererRoot(scenes);
    assert.ok(root, "quest object root must attach to the scene");
    for (const child of root!.children) {
      assert.equal(
        child.visible,
        false,
        `${child.userData.harthmereQuestObjectMarkerId} should not render a passive primitive marker body`
      );
      assert.equal(
        child.userData.harthmereQuestObjectMarkerRenderPolicy,
        HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY_V146
      );
      assert.equal(
        child.children.length,
        1,
        "renderer anchors should only carry the hidden active beacon"
      );
    }
  });

  it("resolves the user's current active quest step to exactly one marker id", () => {
    const quest = SNAPSHOT_GROVE_QUESTS_V75.find(
      (candidate) => candidate.markerIds.length > 1
    );
    assert.ok(
      quest,
      "expected a Grove quest with more than one objective marker"
    );

    assert.equal(
      activeHarthmereQuestMarkerIdV145({
        activeQuestId: quest!.id,
        activeObjectiveIndex: 0,
        completedQuestIds: [],
      }),
      quest!.markerIds[0]
    );
    assert.equal(
      activeHarthmereQuestMarkerIdV145({
        activeQuestId: quest!.id,
        activeObjectiveIndex: 999,
        completedQuestIds: [],
      }),
      quest!.markerIds[quest!.markerIds.length - 1],
      "out-of-range active steps should clamp to the last authored marker"
    );
    assert.equal(
      activeHarthmereQuestMarkerIdV145({
        activeQuestId: quest!.id,
        activeObjectiveIndex: 0,
        completedQuestIds: [quest!.id],
      }),
      undefined,
      "completed quests should not keep drawing an active in-world beacon"
    );
    assert.equal(
      activeHarthmereQuestMarkerIdV145({
        activeQuestId: "missing_quest",
        activeObjectiveIndex: 0,
        completedQuestIds: [],
      }),
      undefined,
      "unknown quest ids should fail closed"
    );
  });

  it("only shows the blue pole and white cap for the current user's active quest marker", () => {
    const activeMarker = HARTHMERE_QUEST_OBJECT_MARKERS_V145[0];
    const inactiveMarker = HARTHMERE_QUEST_OBJECT_MARKERS_V145.find(
      (marker) => marker.id !== activeMarker.id
    );
    assert.ok(inactiveMarker, "expected at least two quest object markers");

    const renderer = makeHarthmereQuestObjectMarkersRendererV145();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);

    const root = findRendererRoot(scenes);
    assert.ok(root, "quest object root must attach to the scene");
    const activeGroup = findMarkerGroup(root!, activeMarker.id);
    const inactiveGroup = findMarkerGroup(root!, inactiveMarker!.id);
    assert.ok(activeGroup, "active marker group should exist");
    assert.ok(inactiveGroup, "inactive marker group should exist");

    const activeBeacon = findActiveBeacon(activeGroup!);
    const inactiveBeacon = findActiveBeacon(inactiveGroup!);
    assert.ok(
      activeBeacon,
      "active marker group should have a hidden beacon child"
    );
    assert.ok(
      inactiveBeacon,
      "inactive marker group should have a hidden beacon child"
    );
    assert.equal(activeGroup!.visible, false);
    assert.equal(inactiveGroup!.visible, false);
    assert.equal(activeBeacon!.visible, false);
    assert.equal(inactiveBeacon!.visible, false);

    renderer.syncActiveQuestMarkerIdV145(activeMarker.id);

    assert.equal(activeGroup!.visible, true);
    assert.equal(inactiveGroup!.visible, false);
    assert.equal(activeBeacon!.visible, true);
    assert.equal(inactiveBeacon!.visible, false);
    assert.ok(
      meshColors(activeBeacon!).includes(
        HARTHMERE_ACTIVE_QUEST_MARKER_BLUE_V145
      ),
      "active marker should draw the blue pole"
    );
    assert.ok(
      meshColors(activeBeacon!).includes(
        HARTHMERE_ACTIVE_QUEST_MARKER_CAP_V145
      ),
      "active marker should draw the white cap"
    );

    renderer.syncActiveQuestMarkerIdV145(undefined);
    assert.equal(
      activeBeacon!.visible,
      false,
      "clearing or completing the quest should remove the active beacon"
    );
    assert.equal(activeGroup!.visible, false);
  });

  it("keeps helper quest encounter markers hidden until the matching quest is active", () => {
    const renderer = makeHarthmereQuestObjectMarkersRendererV145();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);

    const root = findRendererRoot(scenes);
    assert.ok(root, "quest object root must attach to the scene");
    const bossGroup = findMarkerGroup(
      root!,
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
    );
    assert.ok(bossGroup, "boss encounter marker should be registered");
    assert.equal(
      bossGroup!.visible,
      false,
      "boss encounter must not visibly spawn before a helper boss quest is active"
    );

    renderer.syncActiveQuestMarkerIdV145(
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
    );
    assert.equal(bossGroup!.visible, true);
    assert.equal(findActiveBeacon(bossGroup!)?.visible, true);

    renderer.syncActiveQuestMarkerIdV145(undefined);
    assert.equal(bossGroup!.visible, false);
  });

  it("builds active quest beacon art hidden by default", () => {
    const beacon = createHarthmereActiveQuestMarkerBeaconV145();
    assert.equal(beacon.visible, false);
    const colors = meshColors(beacon);
    assert.ok(colors.includes(HARTHMERE_ACTIVE_QUEST_MARKER_BLUE_V145));
    assert.ok(colors.includes(HARTHMERE_ACTIVE_QUEST_MARKER_CAP_V145));
  });

  it("reattaches to recreated scenes so reconnects cannot make quest props disappear", () => {
    const renderer = makeHarthmereQuestObjectMarkersRendererV145();
    const firstScenes = createNewScenes();
    renderer.draw(firstScenes, 0.016);
    const firstRoot = firstScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145)
    );
    assert.ok(firstRoot, "quest object root must attach to the first scene");

    const secondScenes = createNewScenes();
    renderer.draw(secondScenes, 0.016);
    const secondRoot = secondScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145)
    );
    assert.ok(secondRoot, "quest object root must attach to a recreated scene");
    assert.equal(secondRoot, firstRoot);
    assert.equal(
      firstScenes.three.children.includes(firstRoot!),
      false,
      "root should move to the current scene instead of remaining on a stale scene"
    );
  });

  it("is registered in the main renderer list", () => {
    const renderersSource = fs.readFileSync(
      path.join(__dirname, "../../renderers.ts"),
      "utf8"
    );
    assert.ok(
      renderersSource.includes("makeHarthmereQuestObjectMarkersRendererV145"),
      "main renderer list should include quest object procedural markers"
    );
  });
});
