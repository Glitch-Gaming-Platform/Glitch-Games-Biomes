/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD = "1";

import {
  HARTHMERE_ACTIVE_QUEST_MARKER_BLUE,
  HARTHMERE_ACTIVE_QUEST_MARKER_CAP,
  HARTHMERE_ACTIVE_WORLD_OBJECT_MARKER_RENDER_POLICY,
  HARTHMERE_LUIS_REPAIR_CART_ASSET_URL,
  HARTHMERE_MOBILE_QUEST_MARKER_MAX_NEARBY,
  HARTHMERE_QUEST_OBJECT_MARKER_VERSION,
  HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY,
  HARTHMERE_QUEST_OBJECT_MARKERS,
  isHarthmereJobsBoardFieldTargetAliasId,
  isHarthmereJobsBoardFieldTargetMarkerId,
  harthmereResolveWorldQuestBeaconMarkerId,
  harthmereWorldObjectMarkerIdForActiveMapPinForTest,
  harthmereMobileQuestObjectMarkerIds,
  HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_RENDER_POLICY,
  activeHarthmereQuestMarkerId,
  activeHarthmereQuestMarkerIds,
  createHarthmereActiveQuestMarkerBeacon,
  createHarthmereQuestObjectMarkerAnchor,
  createHarthmereQuestObjectMarkerMesh,
  isVisibleHarthmereWorldObjectMarker,
  shouldRenderHarthmereQuestObjectMarkerMesh,
  isRenderableHarthmereQuestObjectLandmark,
  makeHarthmereQuestObjectMarkersRenderer,
  replaceHarthmereRepairCartFallbackWithAsset,
} from "@/client/game/renderers/local_dev/harthmere_quest_object_markers";
import { createNewScenes } from "@/client/game/renderers/scenes";
import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID,
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS,
  isLiveEntityHelperMuckBossSpawnMarker,
  liveEntityHelperQuestTargetMarkerForKind,
  liveEntityHelperQuestTargetMarkerIdForKind,
} from "@/shared/harthmere/live_entity_helper_quests";
import {
  HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID,
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
  HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID,
} from "@/shared/harthmere/jobs_board_muck_bounty_targets";
import {
  harthmereJobsBoardQuestMarkerPositions,
  harthmereJobsBoardQuestMarkerRuntimePosition,
  harthmereJobsBoardQuestMarkerRuntimePositionForId,
} from "@/shared/harthmere/jobs_board_quest_marker_positions";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_QUESTS,
} from "@/shared/harthmere/snapshot_grove_content";
import { isHarthmereContainerObjectLabel } from "@/shared/harthmere/object_interaction_semantics";
import * as THREE from "three";
import { publishChapter1ObjectiveWorldProjection } from "@/client/components/challenges/Chapter1ObjectiveWorldState";

describe("harthmereResolveWorldQuestBeaconMarkerId (cross-system eclipse)", () => {
  it("allows permanent business fixtures to ground beneath authored awnings", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../harthmere_quest_object_markers.ts"),
      "utf8"
    );
    assert.match(
      source,
      /const isFieldTarget = isHarthmereJobsBoardFieldTargetMarkerId\(id\)/
    );
    assert.match(
      source,
      /harthmereGroundedFeetYWithMemory\([\s\S]*!isFieldTarget\s*\)/
    );
    assert.match(
      source,
      /isFieldTarget\s*\? harthmereJobsBoardFieldTargetFeetY\(groundedFeetY, hintY\)/,
      "field props must stay visible at their authored apron height while terrain streams"
    );
  });

  it("shows the helper/grove beacon when there is no active pin", () => {
    assert.equal(
      harthmereResolveWorldQuestBeaconMarkerId({
        liveEntityHelperMarkerId: "boss_marker",
        snapshotGroveMarkerId: "grove_marker",
      }),
      "boss_marker"
    );
  });

  it("falls back to the snapshot grove beacon when no helper marker", () => {
    assert.equal(
      harthmereResolveWorldQuestBeaconMarkerId({
        snapshotGroveMarkerId: "grove_marker",
      }),
      "grove_marker"
    );
  });

  it("suppresses the boss beacon while navigating to a jobs-board objective", () => {
    // The reported bug: a freshly-accepted fence repair (jobs-board pin) was
    // eclipsed by the boss "kill a monster" world beacon.
    assert.equal(
      harthmereResolveWorldQuestBeaconMarkerId({
        liveEntityHelperMarkerId: "boss_marker",
        snapshotGroveMarkerId: "grove_marker",
        activePinMarkerId: "jobs_board_marker:todo-123",
      }),
      undefined
    );
  });

  it("keeps the beacon when the active pin IS the quest target", () => {
    assert.equal(
      harthmereResolveWorldQuestBeaconMarkerId({
        liveEntityHelperMarkerId: "boss_marker",
        activePinMarkerId: "boss_marker",
      }),
      "boss_marker"
    );
  });

  it("ignores non-jobs-board pins (e.g. a located vendor)", () => {
    assert.equal(
      harthmereResolveWorldQuestBeaconMarkerId({
        liveEntityHelperMarkerId: "boss_marker",
        activePinMarkerId: "vendor_marker:smith",
      }),
      "boss_marker"
    );
  });
});

describe("jobs-board active pin physical prop resolution", () => {
  it("reveals the exact sealed-package pickup prop behind a synthetic todo pin", () => {
    assert.equal(
      harthmereWorldObjectMarkerIdForActiveMapPinForTest({
        markerId: "jobs_board_marker:delivery_todo",
        worldPosition: [0, 0, 0],
        worldObjectId: "coop_supply_box",
        interactionTargetId: "sealed_package_pickup",
      }),
      "coop_supply_box"
    );
  });

  it("recovers old persisted job pins by matching the physical marker position", () => {
    const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      (candidate) => candidate.id === "coop_supply_box"
    );
    assert.ok(marker);
    assert.equal(
      harthmereWorldObjectMarkerIdForActiveMapPinForTest({
        markerId: "jobs_board_marker:legacy_delivery_todo",
        worldPosition: [...marker!.position],
      }),
      "coop_supply_box"
    );
  });
});

describe("Luis repair cart authored asset", () => {
  it("ships a non-empty binary glTF at the renderer URL", () => {
    assert.equal(
      HARTHMERE_LUIS_REPAIR_CART_ASSET_URL,
      "/assets/harthmere/glb/quest/luis_repair_cart.glb"
    );
    const assetPath = path.join(
      process.cwd(),
      "public",
      HARTHMERE_LUIS_REPAIR_CART_ASSET_URL.replace(/^\/assets\//, "assets/")
    );
    const contents = fs.readFileSync(assetPath);
    assert.equal(contents.subarray(0, 4).toString("utf8"), "glTF");
    assert.ok(
      contents.length > 20_000,
      "authored cart GLB is unexpectedly small"
    );
  });

  it("replaces only the procedural cart while preserving its quest beacon", () => {
    const marker = createHarthmereQuestObjectMarkerMesh({
      id: "chapter1_objective:stand-him-up:gather-parts",
      label: "Luis's Repair Cart",
      kind: "interactable",
      position: [490, 65, -206],
      dynamic: "chapter1",
    });
    const beacon = createHarthmereActiveQuestMarkerBeacon();
    marker.add(beacon);
    const prototype = new THREE.Group();
    prototype.name = "test-authored-cart";
    prototype.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 2.4, 1.8),
        new THREE.MeshBasicMaterial()
      )
    );

    const asset = replaceHarthmereRepairCartFallbackWithAsset(
      marker,
      prototype
    );
    assert.ok(asset, "authored cart should replace the procedural fallback");
    assert.ok(
      marker.children.includes(beacon),
      "quest beacon must be retained"
    );
    assert.equal(
      marker.children.some(
        (child) => typeof child.userData.harthmereRepairCartPart === "string"
      ),
      false,
      "procedural fallback pieces must not remain stacked under the GLB"
    );
    assert.equal(asset!.userData.harthmereRepairCartAsset, true);
    assert.equal(
      marker.userData.harthmereRepairCartAssetUrl,
      HARTHMERE_LUIS_REPAIR_CART_ASSET_URL
    );
    assert.equal(
      replaceHarthmereRepairCartFallbackWithAsset(marker, prototype),
      undefined,
      "asset replacement must be idempotent"
    );
  });
});

describe("Grove berry source visibility", () => {
  it("renders a waist-high berry thicket instead of an invisible ground cluster", () => {
    const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      (candidate) => candidate.id === "grove_garden_edge_berries"
    );
    assert.ok(marker, "Garden Edge Berries marker should exist");
    const berryThicket = createHarthmereQuestObjectMarkerMesh(marker!);
    assert.equal(
      berryThicket.userData.harthmereQuestObjectVisualKind,
      "berry_thicket"
    );
    const bounds = new THREE.Box3().setFromObject(berryThicket);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    assert.ok(
      size.x >= 1.2,
      `berry thicket width should be visible, got ${size.x}`
    );
    assert.ok(
      size.y >= 1.5,
      `berry thicket should rise above flowers, got ${size.y}`
    );
    assert.ok(
      size.z >= 1.0,
      `berry thicket depth should be visible, got ${size.z}`
    );
  });
});

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
    child.name.includes(HARTHMERE_QUEST_OBJECT_MARKER_VERSION)
  ) as THREE.Group | undefined;

const findMarkerGroup = (root: THREE.Group, markerId: string) =>
  root.children.find(
    (child) => child.userData.harthmereQuestObjectMarkerId === markerId
  ) as THREE.Group | undefined;

const findActiveBeacon = (markerGroup: THREE.Group) =>
  markerGroup.children.find(
    (child) => child.userData.harthmereActiveQuestBeacon === true
  ) as THREE.Group | undefined;

describe("Harthmere quest object procedural markers current", () => {
  it("registers every quest-linked or visible authored non-NPC objective without requiring broad passive world props", () => {
    const expected = SNAPSHOT_GROVE_LANDMARKS.filter(
      isRenderableHarthmereQuestObjectLandmark
    );
    assert.ok(
      expected.length >= 25,
      `expected many quest object landmarks to be protected by procedural markers, got ${expected.length}`
    );
    const extraJobsBoardMarkers =
      harthmereJobsBoardQuestMarkerPositions().filter(
        (marker) =>
          !SNAPSHOT_GROVE_LANDMARKS.some(
            (landmark) => landmark.id === marker.markerId
          ) &&
          marker.source !== "live_entity_helper" &&
          marker.source !== "business_outpost_jobs_board" &&
          // Field targets publish a map-marker id AND a requirement target-id
          // alias; only the map-marker id is drawn.
          !isHarthmereJobsBoardFieldTargetAliasId(marker.markerId)
      );
    assert.equal(
      HARTHMERE_QUEST_OBJECT_MARKERS.length,
      expected.length +
        LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS.length +
        extraJobsBoardMarkers.length
    );

    for (const landmark of expected) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
        (candidate) => candidate.id === landmark.id
      );
      const resolved = harthmereJobsBoardQuestMarkerRuntimePositionForId(
        landmark.id
      );
      const expectedPosition =
        resolved?.position ??
        ([
          landmark.position[0],
          landmark.position[1] - 1,
          landmark.position[2],
        ] as [number, number, number]);
      assert.ok(marker, `missing procedural marker for ${landmark.id}`);
      assert.equal(marker?.label, landmark.label);
      assert.equal(marker?.position[0], expectedPosition[0]);
      assert.equal(marker?.position[2], expectedPosition[2]);
      assert.equal(
        marker?.position[1],
        expectedPosition[1],
        `${landmark.id} should render at feet/ground height, not at the hovering map-pin Y`
      );
    }
  });

  it("renders Jobs Board target markers, including monster-hunt destinations, from the shared resolver", () => {
    for (const id of [
      "harthmere_orchard_softwood",
      "harthmere_north_iron_vein",
      "muckwad_patch",
      HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
      HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID,
      HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID,
      "harthmere_market_office",
      "harthmere_chapel_stone",
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
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
        (candidate) => candidate.id === id
      );
      assert.ok(marker, `${id} should have a rendered quest/job marker`);
      const resolved = harthmereJobsBoardQuestMarkerPositions().find(
        (candidate) => candidate.markerId === id
      );
      assert.ok(resolved, `${id} should resolve through the marker registry`);
      const runtime = harthmereJobsBoardQuestMarkerRuntimePosition(resolved!);
      assert.equal(marker?.position[0], runtime.position[0]);
      assert.equal(marker?.position[2], runtime.position[2]);
      assert.equal(
        marker?.position[1],
        runtime.position[1],
        `${id} should use the shared visible quest marker height`
      );
    }
  });

  it("keeps additive-town item-source markers on the reachable Harthmere floor", () => {
    const orchard = harthmereJobsBoardQuestMarkerRuntimePositionForId(
      "harthmere_orchard_softwood"
    );
    assert.ok(orchard, "Orchard softwood source marker should resolve");
    assert.deepEqual(orchard!.position, [2068, 53, -118]);
  });

  it("adds active-only live-entity helper quest targets at the authored coordinates", () => {
    for (const helperMarker of LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
        (candidate) => candidate.id === helperMarker.id
      );
      assert.ok(marker, `missing helper marker ${helperMarker.id}`);
      assert.equal(marker?.dynamic, "live_entity_helper");
      assert.equal(marker?.label, helperMarker.label);
      assert.deepEqual(marker?.position, helperMarker.position);
    }

    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKind("exotic_matter"),
      "live_helper_old_well_exotic_residue"
    );
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKind("food_water"),
      "live_helper_bluewater_supply_route"
    );
    assert.equal(
      liveEntityHelperQuestTargetMarkerIdForKind("hard_boss"),
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
    );
    assert.equal(
      isLiveEntityHelperMuckBossSpawnMarker(
        liveEntityHelperQuestTargetMarkerForKind("hard_boss")
      ),
      true,
      "the boss marker must be in the authored Muck area and grounded"
    );
  });

  it("does not duplicate the oversized jobs board renderer", () => {
    const ids = new Set(
      HARTHMERE_QUEST_OBJECT_MARKERS.map((marker) => marker.id)
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
      "econ_grove_billy_post",
      "econ_grove_billy_toolbag",
      "grove_tool_crate",
      "grove_first_aid_bin",
      "econ_grove_supply_chest",
      "sanitation_barrels_marker",
    ];

    for (const id of sampleIds) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
        (candidate) => candidate.id === id
      );
      assert.ok(marker, `${id} should have a procedural marker`);
      const mesh = createHarthmereQuestObjectMarkerMesh(marker!);
      assert.equal(
        mesh.userData.harthmereQuestObjectMarkerVersion,
        HARTHMERE_QUEST_OBJECT_MARKER_VERSION
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
    for (const marker of HARTHMERE_QUEST_OBJECT_MARKERS) {
      const mesh = createHarthmereQuestObjectMarkerMesh(marker);
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
          colors.includes(HARTHMERE_ACTIVE_QUEST_MARKER_BLUE),
          false,
          `${marker.id} must not draw an always-on blue active quest mast`
        );

        const box =
          child.geometry instanceof THREE.BoxGeometry
            ? child.geometry
            : undefined;
        const params = box?.parameters;
        const isOldWhiteCap =
          colors.includes(HARTHMERE_ACTIVE_QUEST_MARKER_CAP) &&
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

  it("prebuilds geometry for every Snapshot Grove objective prop and keeps inactive props hidden", () => {
    const marker = HARTHMERE_QUEST_OBJECT_MARKERS[0];
    const anchor = createHarthmereQuestObjectMarkerAnchor(marker);
    assert.equal(anchor.visible, false);
    assert.equal(anchor.children.length, 0);
    assert.equal(
      anchor.userData.harthmereQuestObjectMarkerRenderPolicy,
      HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY
    );

    const renderer = makeHarthmereQuestObjectMarkersRenderer();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);
    const root = findRendererRoot(scenes);
    assert.ok(root, "quest object root must attach to the scene");
    for (const child of root!.children) {
      const markerId = child.userData.harthmereQuestObjectMarkerId as string;
      if (isVisibleHarthmereWorldObjectMarker(markerId)) {
        assert.equal(
          child.visible,
          true,
          `${markerId} should render an authored visible world prop`
        );
        assert.equal(
          child.userData.harthmereQuestObjectMarkerRenderPolicy,
          HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_RENDER_POLICY
        );
        assert.ok(
          child.children.length > 1,
          "visible authored props should carry geometry plus the hidden active beacon"
        );
        continue;
      }

      assert.equal(
        child.visible,
        false,
        `${markerId} should not render passively before it is active`
      );
      if (shouldRenderHarthmereQuestObjectMarkerMesh(markerId)) {
        assert.equal(
          child.userData.harthmereQuestObjectMarkerRenderPolicy,
          HARTHMERE_ACTIVE_WORLD_OBJECT_MARKER_RENDER_POLICY
        );
        assert.ok(
          child.children.length > 1,
          "active-only Grove props should keep hidden geometry for the active quest step"
        );
      } else {
        assert.equal(
          child.userData.harthmereQuestObjectMarkerRenderPolicy,
          HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY
        );
        assert.equal(
          child.children.length,
          1,
          "renderer anchors should only carry the hidden active beacon"
        );
      }
    }

    const groveObjectiveMarkerIds = new Set(
      SNAPSHOT_GROVE_QUESTS.flatMap((quest) => quest.markerIds)
    );
    for (const markerId of groveObjectiveMarkerIds) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
        (candidate) => candidate.id === markerId
      );
      if (!marker || marker.kind === "npc") continue;
      assert.equal(
        shouldRenderHarthmereQuestObjectMarkerMesh(marker),
        true,
        `${markerId} must have real geometry instead of a beacon-only anchor`
      );
    }
  });

  it("keeps only required and nearby permanent quest props on mobile", () => {
    const nearbyMarker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      isVisibleHarthmereWorldObjectMarker
    );
    const requiredMarker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      (marker) =>
        marker.id !== nearbyMarker?.id &&
        !isVisibleHarthmereWorldObjectMarker(marker)
    );
    assert.ok(nearbyMarker);
    assert.ok(requiredMarker);
    const selected = harthmereMobileQuestObjectMarkerIds(
      new THREE.Vector3(
        nearbyMarker!.position[0],
        nearbyMarker!.position[1],
        nearbyMarker!.position[2]
      ),
      new Set([requiredMarker!.id])
    );
    assert.ok(selected.includes(nearbyMarker!.id));
    assert.ok(selected.includes(requiredMarker!.id));
    assert.ok(selected.length <= HARTHMERE_MOBILE_QUEST_MARKER_MAX_NEARBY + 1);

    const renderer = makeHarthmereQuestObjectMarkersRenderer(
      undefined,
      undefined,
      true
    );
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);
    const root = findRendererRoot(scenes);
    assert.ok(root);
    assert.equal(root!.children.length, 0);
    renderer.syncActiveQuestMarkerId(requiredMarker!.id);
    assert.equal(root!.children.length, 1);
    assert.equal(
      root!.children[0].userData.harthmereQuestObjectMarkerId,
      requiredMarker!.id
    );
  });

  it("draws the active Chapter 1 repair cart as a visible interaction target", () => {
    publishChapter1ObjectiveWorldProjection({
      key: "stand-him-up:gather-parts",
      authoredStepId: "gather_parts",
      label: "Luis's Repair Cart",
      position: [490, 65, -206],
      trigger: "collect",
    });
    const renderer = makeHarthmereQuestObjectMarkersRenderer();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.3);
    const root = findRendererRoot(scenes)!;
    const markerId = "chapter1_objective:stand-him-up:gather-parts";
    const cart = findMarkerGroup(root, markerId);
    assert.ok(
      cart,
      "the active repair cart should be projected into the world"
    );
    assert.equal(cart!.visible, true);
    assert.equal(findActiveBeacon(cart!)?.visible, true);
    assert.equal(cart!.userData.harthmereQuestObjectVisualKind, "repair_cart");
    const parts = new Set<string>();
    cart!.traverse((child) => {
      const part = child.userData.harthmereRepairCartPart;
      if (typeof part === "string") parts.add(part);
    });
    for (const requiredPart of [
      "deck",
      "left-rail",
      "right-rail",
      "tailgate",
      "wheel-front-left",
      "wheel-front-right",
      "wheel-rear-left",
      "wheel-rear-right",
      "handle-left",
      "handle-right",
      "repair-chest",
      "iron-ingots",
      "wrench-handle",
      "repair-flag",
    ]) {
      assert.ok(parts.has(requiredPart), `repair cart missing ${requiredPart}`);
    }
    const bounds = new THREE.Box3().setFromObject(cart!);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x >= 2.7, "repair cart should read as a full-size wagon");
    assert.ok(
      size.y >= 2,
      "repair flag should make the hand-in point readable"
    );
    assert.ok(size.z >= 1.3, "wheels should be visible from either side");

    publishChapter1ObjectiveWorldProjection(undefined);
    renderer.draw(scenes, 0.3);
    assert.equal(
      findMarkerGroup(root, markerId),
      undefined,
      "the prop should disappear as soon as the objective advances"
    );
  });

  it("keeps Billy's real post visible but hides the quest toolbag until active", () => {
    const renderer = makeHarthmereQuestObjectMarkersRenderer();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);
    const root = findRendererRoot(scenes);
    assert.ok(root, "quest object root must attach to the scene");

    const post = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      (candidate) => candidate.id === "econ_grove_billy_post"
    );
    assert.ok(post, "Billy's post should be registered");
    assert.equal(post!.label, "Billy's Drop Post");
    const postGroup = findMarkerGroup(root!, "econ_grove_billy_post");
    assert.ok(postGroup, "Billy's post should have a renderer group");
    assert.equal(postGroup!.visible, true);
    assert.equal(
      postGroup!.userData.harthmereQuestObjectMarkerAlwaysVisible,
      true
    );
    assert.equal(
      postGroup!.userData.harthmereQuestObjectMarkerRenderPolicy,
      HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_RENDER_POLICY
    );

    const toolbag = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      (candidate) => candidate.id === "econ_grove_billy_toolbag"
    );
    assert.ok(toolbag, "Billy's toolbag should be registered");
    assert.equal(toolbag!.label, "Billy's Toolbag");
    assert.equal(isVisibleHarthmereWorldObjectMarker(toolbag!), false);
    assert.equal(shouldRenderHarthmereQuestObjectMarkerMesh(toolbag!), true);
    const toolbagGroup = findMarkerGroup(root!, "econ_grove_billy_toolbag");
    assert.ok(toolbagGroup, "Billy's toolbag should have a renderer group");
    assert.equal(toolbagGroup!.visible, false);
    assert.equal(
      toolbagGroup!.userData.harthmereQuestObjectMarkerRenderPolicy,
      HARTHMERE_ACTIVE_WORLD_OBJECT_MARKER_RENDER_POLICY
    );
    assert.ok(
      toolbagGroup!.children.some((child) => child instanceof THREE.Mesh),
      "toolbag should keep prop art ready for the active quest step"
    );
    assert.equal(findActiveBeacon(toolbagGroup!)?.visible, false);

    renderer.syncActiveQuestMarkerId("econ_grove_billy_toolbag");
    assert.equal(toolbagGroup!.visible, true);
    assert.equal(findActiveBeacon(toolbagGroup!)?.visible, true);
  });

  it("keeps authored quest containers hidden until their marker is active", () => {
    const renderer = makeHarthmereQuestObjectMarkersRenderer();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);
    const root = findRendererRoot(scenes);
    assert.ok(root, "quest object root must attach to the scene");

    const containerMarkers = HARTHMERE_QUEST_OBJECT_MARKERS.filter((marker) =>
      isHarthmereContainerObjectLabel({ label: marker.label })
    );
    assert.ok(
      containerMarkers.length >= 10,
      "expected the Grove/tutorial/jobs-board container markers to be registered"
    );

    for (const marker of containerMarkers) {
      // Business intake props (refinery intake, farm supply crate, sanitation
      // barrels, ...) are permanent public shop fixtures with the same policy
      // as the jobs board itself: always drawn, always interactable. The
      // hidden-until-active rule exists so another player's QUEST loot box does
      // not read as public loot, which does not apply to them.
      if (isHarthmereJobsBoardFieldTargetMarkerId(marker.id)) {
        assert.equal(
          isVisibleHarthmereWorldObjectMarker(marker),
          true,
          `${marker.id} (${marker.label}) is a permanent business fixture and must stay visible`
        );
        continue;
      }
      assert.equal(
        isVisibleHarthmereWorldObjectMarker(marker),
        false,
        `${marker.id} (${marker.label}) should not be marked always-visible`
      );
      assert.equal(
        shouldRenderHarthmereQuestObjectMarkerMesh(marker),
        true,
        `${marker.id} (${marker.label}) should keep active quest prop geometry`
      );

      const group = findMarkerGroup(root!, marker.id);
      assert.ok(group, `${marker.id} should have a renderer group`);
      assert.equal(
        group!.visible,
        false,
        `${marker.id} (${marker.label}) should be hidden until active`
      );
      assert.equal(
        group!.userData.harthmereQuestObjectMarkerAlwaysVisible,
        undefined
      );
      assert.equal(
        group!.userData.harthmereQuestObjectMarkerRenderPolicy,
        HARTHMERE_ACTIVE_WORLD_OBJECT_MARKER_RENDER_POLICY
      );

      let meshCount = 0;
      group!.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshCount += 1;
        }
      });
      assert.ok(
        meshCount >= 5,
        `${marker.id} (${marker.label}) should use container prop art, got ${meshCount} meshes`
      );
    }

    const activeContainer = containerMarkers[0]!;
    const activeGroup = findMarkerGroup(root!, activeContainer.id);
    assert.ok(activeGroup, "active container candidate should exist");
    renderer.syncActiveQuestMarkerId(activeContainer.id);
    assert.equal(activeGroup!.visible, true);
    assert.equal(findActiveBeacon(activeGroup!)?.visible, true);
  });

  it("promotes container landmarks without quest ids into the marker renderer", () => {
    const supplyChest = SNAPSHOT_GROVE_LANDMARKS.find(
      (landmark) => landmark.id === "econ_grove_supply_chest"
    );
    assert.ok(supplyChest, "Grove Supply Chest landmark should exist");
    assert.equal(supplyChest!.questIds, undefined);
    assert.equal(
      isRenderableHarthmereQuestObjectLandmark(supplyChest!),
      true,
      "container landmarks should be renderable even without a quest id"
    );
    assert.ok(
      HARTHMERE_QUEST_OBJECT_MARKERS.some(
        (marker) => marker.id === "econ_grove_supply_chest"
      ),
      "Grove Supply Chest should enter the procedural marker list"
    );
    assert.equal(
      isVisibleHarthmereWorldObjectMarker("econ_grove_supply_chest"),
      false
    );
    assert.equal(
      shouldRenderHarthmereQuestObjectMarkerMesh("econ_grove_supply_chest"),
      true
    );
  });

  it("resolves the user's current active quest step to exactly one marker id", () => {
    const quest = SNAPSHOT_GROVE_QUESTS.find(
      (candidate) => candidate.markerIds.length > 1
    );
    assert.ok(
      quest,
      "expected a Grove quest with more than one objective marker"
    );

    assert.equal(
      activeHarthmereQuestMarkerId({
        activeQuestId: quest!.id,
        activeObjectiveIndex: 0,
        completedQuestIds: [],
      }),
      quest!.markerIds[0]
    );
    assert.equal(
      activeHarthmereQuestMarkerId({
        activeQuestId: quest!.id,
        activeObjectiveIndex: 999,
        completedQuestIds: [],
      }),
      quest!.markerIds[quest!.markerIds.length - 1],
      "out-of-range active steps should clamp to the last authored marker"
    );
    assert.equal(
      activeHarthmereQuestMarkerId({
        activeQuestId: quest!.id,
        activeObjectiveIndex: 0,
        completedQuestIds: [quest!.id],
      }),
      undefined,
      "completed quests should not keep drawing an active in-world beacon"
    );
    assert.equal(
      activeHarthmereQuestMarkerId({
        activeQuestId: "missing_quest",
        activeObjectiveIndex: 0,
        completedQuestIds: [],
      }),
      undefined,
      "unknown quest ids should fail closed"
    );
  });

  it("keeps every accepted quest's current objective prop visible and only one selected beacon", () => {
    const quests = SNAPSHOT_GROVE_QUESTS.filter(
      (candidate) => candidate.markerIds.length > 2
    ).slice(0, 2);
    assert.equal(quests.length, 2);
    const state = {
      acceptedQuestIds: quests.map((quest) => quest.id),
      activeQuestId: quests[1].id,
      activeObjectiveIndex: 2,
      objectiveIndexByQuestId: {
        [quests[0].id]: 1,
        [quests[1].id]: 2,
      },
      objectiveProgressByQuestId: {},
      completedQuestIds: [],
    };
    assert.deepEqual(
      [...activeHarthmereQuestMarkerIds(state)].sort(),
      [quests[0].markerIds[1], quests[1].markerIds[2]].sort()
    );
    assert.equal(activeHarthmereQuestMarkerId(state), quests[1].markerIds[2]);
  });

  it("only shows the blue pole and white cap for the current user's active quest marker", () => {
    const activeMarker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      (marker) => !isVisibleHarthmereWorldObjectMarker(marker)
    );
    const inactiveMarker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      (marker) =>
        marker.id !== activeMarker?.id &&
        !isVisibleHarthmereWorldObjectMarker(marker)
    );
    assert.ok(activeMarker, "expected an active-beacon-only marker");
    assert.ok(inactiveMarker, "expected at least two quest object markers");

    const renderer = makeHarthmereQuestObjectMarkersRenderer();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);

    const root = findRendererRoot(scenes);
    assert.ok(root, "quest object root must attach to the scene");
    const activeGroup = findMarkerGroup(root!, activeMarker!.id);
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

    renderer.syncActiveQuestMarkerId(activeMarker.id);

    assert.equal(activeGroup!.visible, true);
    assert.equal(inactiveGroup!.visible, false);
    assert.equal(activeBeacon!.visible, true);
    assert.equal(inactiveBeacon!.visible, false);
    assert.ok(
      meshColors(activeBeacon!).includes(HARTHMERE_ACTIVE_QUEST_MARKER_BLUE),
      "active marker should draw the blue pole"
    );
    assert.ok(
      meshColors(activeBeacon!).includes(HARTHMERE_ACTIVE_QUEST_MARKER_CAP),
      "active marker should draw the white cap"
    );

    renderer.syncActiveQuestMarkerId(undefined);
    assert.equal(
      activeBeacon!.visible,
      false,
      "clearing or completing the quest should remove the active beacon"
    );
    assert.equal(activeGroup!.visible, false);
  });

  it("keeps helper quest encounter markers hidden until the matching quest is active", () => {
    const renderer = makeHarthmereQuestObjectMarkersRenderer();
    const scenes = createNewScenes();
    renderer.draw(scenes, 0.016);

    const root = findRendererRoot(scenes);
    assert.ok(root, "quest object root must attach to the scene");
    const bossGroup = findMarkerGroup(
      root!,
      LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
    );
    assert.ok(bossGroup, "boss encounter marker should be registered");
    assert.equal(
      bossGroup!.visible,
      false,
      "boss encounter must not visibly spawn before a helper boss quest is active"
    );

    renderer.syncActiveQuestMarkerId(LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID);
    assert.equal(bossGroup!.visible, true);
    assert.equal(findActiveBeacon(bossGroup!)?.visible, true);

    renderer.syncActiveQuestMarkerId(undefined);
    assert.equal(bossGroup!.visible, false);
  });

  it("builds active quest beacon art hidden by default", () => {
    const beacon = createHarthmereActiveQuestMarkerBeacon();
    assert.equal(beacon.visible, false);
    const colors = meshColors(beacon);
    assert.ok(colors.includes(HARTHMERE_ACTIVE_QUEST_MARKER_BLUE));
    assert.ok(colors.includes(HARTHMERE_ACTIVE_QUEST_MARKER_CAP));
  });

  it("reattaches to recreated scenes so reconnects cannot make quest props disappear", () => {
    const renderer = makeHarthmereQuestObjectMarkersRenderer();
    const firstScenes = createNewScenes();
    renderer.draw(firstScenes, 0.016);
    const firstRoot = firstScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_QUEST_OBJECT_MARKER_VERSION)
    );
    assert.ok(firstRoot, "quest object root must attach to the first scene");

    const secondScenes = createNewScenes();
    renderer.draw(secondScenes, 0.016);
    const secondRoot = secondScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_QUEST_OBJECT_MARKER_VERSION)
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
      renderersSource.includes("makeHarthmereQuestObjectMarkersRenderer"),
      "main renderer list should include quest object procedural markers"
    );
  });
});
