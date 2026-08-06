// HARTHMERE_QUEST_OBJECT_MARKERS
//
// The Biomes UI map and quest tracker can point at Grove objects such as
// paint pots, repair posts, practice crates, and field tables. Those markers
// used to rely on a mixture of imported OBJ/GLB props and map pins, which is
// fragile in the snapshot-built runtime because structural asset filters can
// remove "board", "table", "fence", "crate", or "sign" placements. These
// lightweight procedural props make every active quest-linked non-NPC Grove
// landmark available in-world without depending on asset loading, lighting, or
// the snapshot merge filter. Quest containers stay hidden until their quest is
// active so another player's/source quest box does not read like public loot.

import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";
import { createGltfLoader } from "@/client/game/util/gltf_helpers";
import { harthmereGroundedFeetYWithMemory } from "@/client/game/util/harthmere_entity_grounding";
import {
  activeLiveEntityHelperQuestMarkerId,
  activeLiveEntityHelperQuestMarkerIds,
  readLiveEntityHelperQuestState,
} from "@/client/components/challenges/LocalDevLiveEntityHelperQuestState";
import {
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS,
  type LiveEntityHelperQuestTargetMarker,
} from "@/shared/harthmere/live_entity_helper_quests";
import {
  harthmereJobsBoardQuestMarkerPositions,
  harthmereJobsBoardQuestMarkerRuntimePosition,
  harthmereJobsBoardQuestMarkerRuntimePositionForId,
} from "@/shared/harthmere/jobs_board_quest_marker_positions";
import {
  harthmereJobsBoardFieldTargetFeetY,
  harthmereJobsBoardFieldTargets,
} from "@/shared/harthmere/jobs_board_field_targets";
import {
  activeSnapshotGroveQuestMarkerIds,
  readSnapshotGroveQuestState,
  snapshotGroveObjectiveIndexForQuest,
  type SnapshotGroveQuestState,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  readActiveBiomesUIMapPin,
  type BiomesUIActiveMapPin,
} from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import { HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MATCH_RADIUS } from "@/shared/harthmere/harthmere_world_object_inspectable";
import { readChapter1ObjectiveWorldProjection } from "@/client/components/challenges/Chapter1ObjectiveWorldState";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_QUESTS,
  type SnapshotGroveLandmark,
} from "@/shared/harthmere/snapshot_grove_content";
import { groveLandmarkWorldPosition } from "@/shared/harthmere/grove/grove_waypoints";
import { isHarthmereContainerObjectLabel } from "@/shared/harthmere/object_interaction_semantics";
import { snapshotGroveObjectiveMarkerIdForProgress } from "@/shared/harthmere/snapshot_grove_trigger_contract";
import * as THREE from "three";

export const HARTHMERE_QUEST_OBJECT_MARKER_VERSION =
  "harthmere-quest-object-marker" as const;
export const HARTHMERE_LUIS_REPAIR_CART_ASSET_URL =
  "/assets/harthmere/glb/quest/luis_repair_cart.glb" as const;

export type HarthmereRepairCartAssetLoader = {
  loadAsync: (url: string) => Promise<{
    scene?: THREE.Object3D;
    scenes?: THREE.Object3D[];
  }>;
};

// HARTHMERE_WORLD_QUEST_BEACON_ACTIVE_PIN_OVERRIDE:
// The in-world quest beacon used to ALWAYS prefer the boss-prioritized
// live-entity-helper marker (then a snapshot-grove quest). That eclipsed a
// freshly-accepted jobs-board job: the player accepted (say) a fence repair —
// which sets the active map pin and HUD aid to the fence — yet the world still
// glowed/aimed the boss "kill a monster" beacon, so the on-screen guidance
// contradicted the map/HUD and walked the player to a monster.
//
// Rule: when the player is actively navigating to a jobs-board objective (an
// active map pin whose markerId is a jobs-board marker, and which is not this
// quest's own target), the jobs-board map pin / HUD aid is the single source of
// guidance — suppress the conflicting helper/grove world beacon. Any other pin
// (or a pin that IS the quest target) leaves the existing beacon behavior intact.
export const HARTHMERE_JOBS_BOARD_ACTIVE_PIN_MARKER_PREFIX =
  "jobs_board_marker:";

function isHarthmereJobsBoardActivePinMarkerId(markerId: string | undefined) {
  return /^(?:jobs_board_marker|jobs_board_item_source|jobs_board_tool_source):/.test(
    String(markerId ?? "")
  );
}

export function harthmereResolveWorldQuestBeaconMarkerId(input: {
  liveEntityHelperMarkerId?: string;
  snapshotGroveMarkerId?: string;
  activePinMarkerId?: string;
}): string | undefined {
  const questBeacon =
    input.liveEntityHelperMarkerId ?? input.snapshotGroveMarkerId;
  if (!questBeacon) {
    return undefined;
  }
  const pinId = input.activePinMarkerId;
  if (
    pinId &&
    pinId !== questBeacon &&
    isHarthmereJobsBoardActivePinMarkerId(pinId)
  ) {
    return undefined;
  }
  return questBeacon;
}
export const HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY =
  "active-marker-hidden-until-needed" as const;
export const HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_RENDER_POLICY =
  "visible-authored-world-prop" as const;
export const HARTHMERE_ACTIVE_WORLD_OBJECT_MARKER_RENDER_POLICY =
  "active-quest-world-prop-hidden-until-needed" as const;
export const HARTHMERE_ACTIVE_QUEST_MARKER_BLUE = 0x5bd7ff;
export const HARTHMERE_ACTIVE_QUEST_MARKER_CAP = 0xffffff;

const ACTIVE_QUEST_BEACON_REFRESH_SECONDS = 0.25;
export const HARTHMERE_MOBILE_QUEST_MARKER_LOAD_DISTANCE_METERS = 80;
export const HARTHMERE_MOBILE_QUEST_MARKER_MAX_NEARBY = 24;

// HARTHMERE_JOBS_BOARD_FIELD_TARGET_PROPS
// Business job-template targets and outpost starter work stations are permanent
// shop fixtures. They must always be drawn (and therefore always interactable),
// unlike quest containers which stay hidden until their quest is active.
// The registry publishes each field target twice (map-marker id + requirement
// target id) so a pin resolves either way. Draw the map-marker id — the
// historical marker naming — and skip the target-id alias so the outpost apron
// does not get two identical props stacked on one column.
const HARTHMERE_FIELD_TARGET_MARKER_IDS: ReadonlySet<string> = new Set(
  harthmereJobsBoardFieldTargets().map((target) => target.mapMarkerId)
);

const HARTHMERE_FIELD_TARGET_ALIAS_MARKER_IDS: ReadonlySet<string> = new Set(
  harthmereJobsBoardFieldTargets()
    .filter((target) => target.mapMarkerId !== target.targetId)
    .map((target) => target.targetId)
);

/** True for the permanent business/outpost job fixtures (not quest loot). */
export function isHarthmereJobsBoardFieldTargetMarkerId(markerId: string) {
  return (
    HARTHMERE_FIELD_TARGET_MARKER_IDS.has(markerId) ||
    HARTHMERE_FIELD_TARGET_ALIAS_MARKER_IDS.has(markerId)
  );
}

/** The requirement-target-id alias of a field target (never drawn on its own). */
export function isHarthmereJobsBoardFieldTargetAliasId(markerId: string) {
  return HARTHMERE_FIELD_TARGET_ALIAS_MARKER_IDS.has(markerId);
}

export const HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_IDS: ReadonlySet<string> =
  new Set([
    // Non-container authored props that must stay physically visible in world.
    "econ_grove_billy_post",
    ...HARTHMERE_FIELD_TARGET_MARKER_IDS,
  ]);

const QUEST_OBJECT_MARKER_SKIP_IDS = new Set([
  // The jobs boards have their own oversized renderer because they are a
  // primary town building, not a small quest prop.
  "harthmere_market_posting_board",
  "harthmere_town_market_posting_board",
]);

const SNAPSHOT_GROVE_OBJECTIVE_MARKER_IDS = new Set(
  SNAPSHOT_GROVE_QUESTS.flatMap((quest) => quest.markerIds)
);

export interface HarthmereQuestObjectMarker {
  id: string;
  label: string;
  kind: SnapshotGroveLandmark["kind"] | "business";
  position: [number, number, number];
  dynamic?: "live_entity_helper" | "jobs_board" | "chapter1";
}

export interface HarthmereQuestObjectMarkerState {
  acceptedQuestIds?: readonly string[];
  activeQuestId?: string;
  activeObjectiveIndex?: number;
  objectiveIndexByQuestId?: Record<string, number>;
  objectiveProgressByQuestId?: Record<
    string,
    { objectiveIndex: number; count: number; evidenceKeys?: readonly string[] }
  >;
  completedQuestIds?: readonly string[];
}

export function isRenderableHarthmereQuestObjectLandmark(
  landmark: SnapshotGroveLandmark
): boolean {
  return Boolean(
    (landmark.questIds?.length ||
      HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_IDS.has(landmark.id) ||
      isHarthmereContainerObjectLabel({ label: landmark.label }) ||
      SNAPSHOT_GROVE_OBJECTIVE_MARKER_IDS.has(landmark.id)) &&
    landmark.kind !== "npc" &&
    !QUEST_OBJECT_MARKER_SKIP_IDS.has(landmark.id)
  );
}

const resolvedJobsBoardQuestMarkers = () => {
  const existing = new Set(
    SNAPSHOT_GROVE_LANDMARKS.map((landmark) => landmark.id)
  );
  return harthmereJobsBoardQuestMarkerPositions()
    .filter(
      (marker) =>
        !existing.has(marker.markerId) &&
        marker.source !== "live_entity_helper" &&
        marker.source !== "business_outpost_jobs_board" &&
        // A field target registers BOTH its target id and its map-marker alias
        // so pins resolve either way. Render only the target id so the outpost
        // apron does not get two identical props stacked on one column.
        !HARTHMERE_FIELD_TARGET_ALIAS_MARKER_IDS.has(marker.markerId) &&
        !QUEST_OBJECT_MARKER_SKIP_IDS.has(marker.markerId)
    )
    .map(harthmereJobsBoardQuestMarkerRuntimePosition)
    .map((marker) => ({
      id: marker.markerId,
      label: marker.label,
      kind:
        marker.source === "exotic_matter_deposit"
          ? ("resource" as const)
          : marker.source === "business_outpost" ||
              marker.source === "business_outpost_jobs_board" ||
              marker.source === "business_outpost_work_station" ||
              marker.source === "business_template_target"
            ? ("business" as const)
            : ("interactable" as const),
      position: marker.position,
      dynamic: "jobs_board" as const,
    }));
};

function harthmereQuestObjectLandmarkRuntimePosition(
  landmark: SnapshotGroveLandmark
): [number, number, number] {
  const resolved = harthmereJobsBoardQuestMarkerRuntimePositionForId(
    landmark.id
  );
  if (resolved) {
    return [...resolved.position] as [number, number, number];
  }
  // RESOLVED, not raw: 15 Grove-area landmarks are still authored at the
  // retired Y=54 while live terrain is Y=71, so a raw read sinks the prop 17
  // blocks under the courtyard.
  const world = groveLandmarkWorldPosition(landmark);
  return [
    world[0],
    // Landmark pins hover above the target. Procedural props sit at the
    // player's feet/ground height so they do not float over the plaza.
    world[1] - 1,
    world[2],
  ];
}

export const HARTHMERE_QUEST_OBJECT_MARKERS: readonly HarthmereQuestObjectMarker[] =
  [
    ...SNAPSHOT_GROVE_LANDMARKS.filter(
      isRenderableHarthmereQuestObjectLandmark
    ).map((landmark) => ({
      id: landmark.id,
      label: landmark.label,
      kind: landmark.kind,
      position: harthmereQuestObjectLandmarkRuntimePosition(landmark),
    })),
    ...LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS.map(
      (marker: LiveEntityHelperQuestTargetMarker) => ({
        id: marker.id,
        label: marker.label,
        kind: marker.kind,
        position: marker.position,
        dynamic: "live_entity_helper" as const,
      })
    ),
    ...resolvedJobsBoardQuestMarkers(),
  ];

const HARTHMERE_QUEST_OBJECT_MARKER_BY_ID = new Map(
  HARTHMERE_QUEST_OBJECT_MARKERS.map((marker) => [marker.id, marker])
);

/** Resolve a synthetic jobs-board todo pin to the physical prop it represents. */
export function harthmereWorldObjectMarkerIdForActiveMapPinForTest(
  pin:
    | Pick<
        BiomesUIActiveMapPin,
        "markerId" | "worldPosition" | "worldObjectId" | "interactionTargetId"
      >
    | undefined
): string | undefined {
  if (!pin || !isHarthmereJobsBoardActivePinMarkerId(pin.markerId)) {
    return undefined;
  }
  for (const id of [pin.worldObjectId, pin.interactionTargetId, pin.markerId]) {
    if (id && HARTHMERE_QUEST_OBJECT_MARKER_BY_ID.has(id)) return id;
  }
  const position = pin.worldPosition;
  if (!Array.isArray(position)) return undefined;
  let best: { id: string; distance: number } | undefined;
  for (const marker of HARTHMERE_QUEST_OBJECT_MARKERS) {
    const distance = Math.hypot(
      marker.position[0] - position[0],
      marker.position[2] - position[2]
    );
    if (
      distance <= HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MATCH_RADIUS &&
      (!best || distance < best.distance)
    ) {
      best = { id: marker.id, distance };
    }
  }
  return best?.id;
}

export function harthmereMobileQuestObjectMarkerIds(
  position: THREE.Vector3,
  requiredMarkerIds: ReadonlySet<string> = new Set()
): readonly string[] {
  const ids = new Set(
    [...requiredMarkerIds].filter((id) =>
      HARTHMERE_QUEST_OBJECT_MARKER_BY_ID.has(id)
    )
  );
  const maxDistanceSquared =
    HARTHMERE_MOBILE_QUEST_MARKER_LOAD_DISTANCE_METERS ** 2;
  const nearby = HARTHMERE_QUEST_OBJECT_MARKERS.filter(
    isVisibleHarthmereWorldObjectMarker
  )
    .map((marker) => ({
      marker,
      distanceSquared:
        (marker.position[0] - position.x) ** 2 +
        (marker.position[2] - position.z) ** 2,
    }))
    .filter(({ distanceSquared }) => distanceSquared <= maxDistanceSquared)
    .sort((a, b) => a.distanceSquared - b.distanceSquared)
    .slice(0, HARTHMERE_MOBILE_QUEST_MARKER_MAX_NEARBY);
  for (const { marker } of nearby) ids.add(marker.id);
  return [...ids];
}

export function isVisibleHarthmereWorldObjectMarker(
  markerOrId: HarthmereQuestObjectMarker | string
): boolean {
  if (typeof markerOrId !== "string") {
    return HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_IDS.has(markerOrId.id);
  }
  return HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_IDS.has(markerOrId);
}

export function shouldRenderHarthmereQuestObjectMarkerMesh(
  markerOrId: HarthmereQuestObjectMarker | string
): boolean {
  if (typeof markerOrId !== "string") {
    return (
      markerOrId.dynamic === undefined ||
      isVisibleHarthmereWorldObjectMarker(markerOrId) ||
      isHarthmereContainerObjectLabel({ label: markerOrId.label })
    );
  }
  if (isVisibleHarthmereWorldObjectMarker(markerOrId)) {
    return true;
  }
  const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
    (candidate) => candidate.id === markerOrId
  );
  return marker
    ? marker.dynamic === undefined ||
        isHarthmereContainerObjectLabel({ label: marker.label })
    : false;
}

export function activeHarthmereQuestMarkerIds(
  state: HarthmereQuestObjectMarkerState
): ReadonlySet<string> {
  return activeSnapshotGroveQuestMarkerIds({
    acceptedQuestIds: [...(state.acceptedQuestIds ?? [])],
    activeQuestId: state.activeQuestId,
    activeObjectiveIndex: state.activeObjectiveIndex ?? 0,
    objectiveIndexByQuestId: state.objectiveIndexByQuestId ?? {},
    objectiveProgressByQuestId: Object.fromEntries(
      Object.entries(state.objectiveProgressByQuestId ?? {}).map(
        ([questId, progress]) => [
          questId,
          {
            objectiveIndex: progress.objectiveIndex,
            count: progress.count,
            evidenceKeys: [...(progress.evidenceKeys ?? [])],
          },
        ]
      )
    ),
    completedQuestIds: [...(state.completedQuestIds ?? [])],
    completedObjectiveIds: [],
    rewards: [],
  });
}

export function activeHarthmereQuestMarkerId(
  state: HarthmereQuestObjectMarkerState
): string | undefined {
  const activeQuestId = state.activeQuestId;
  if (!activeQuestId) {
    return undefined;
  }

  const quest = SNAPSHOT_GROVE_QUESTS.find(
    (entry) => entry.id === activeQuestId
  );
  if (!quest || !quest.markerIds.length) {
    return undefined;
  }
  if (state.completedQuestIds?.includes(quest.id)) {
    return undefined;
  }

  const rawIndex = snapshotGroveObjectiveIndexForQuest(
    state as SnapshotGroveQuestState,
    activeQuestId
  );
  const clampedIndex = Math.max(
    0,
    Math.min(quest.markerIds.length - 1, rawIndex)
  );
  const partial = state.objectiveProgressByQuestId?.[quest.id];
  return snapshotGroveObjectiveMarkerIdForProgress(
    quest,
    clampedIndex,
    partial?.objectiveIndex === clampedIndex ? partial.count : 0
  );
}

const colorForMarker = (marker: HarthmereQuestObjectMarker) => {
  const text = `${marker.id} ${marker.label}`.toLowerCase();
  if (/antihydrogen/.test(text)) return 0x8fd3ff;
  if (/antihelium/.test(text)) return 0xa7f070;
  if (/antiboron/.test(text)) return 0xf07aff;
  if (/exotic|antimatter|deposit/.test(text)) return 0x56e0c2;
  if (/berry|food|aid|satchel/.test(text)) return 0xa7f070;
  if (/muck|danger|scratch|combat|dummy/.test(text)) return 0xff7a7a;
  if (/paint|route|flag/.test(text)) return 0xffd24d;
  if (/guild|charter|bank|trade/.test(text)) return 0xc7a7ff;
  if (
    /crate|basket|material|stone|repair|claim|ledger|workbench|table/.test(text)
  )
    return 0x8fd3ff;
  if (marker.kind === "safe_zone") return 0x9dfcc3;
  if (marker.kind === "resource") return 0xb5f48e;
  return 0x8fd3ff;
};

const mesh = (geometry: THREE.BufferGeometry, color: number): THREE.Mesh => {
  const material = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
};

const addBox = (
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  color: number
) => {
  const box = mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), color);
  box.position.set(position[0], position[1], position[2]);
  group.add(box);
  return box;
};

const addCylinder = (
  group: THREE.Group,
  radius: number,
  height: number,
  position: [number, number, number],
  color: number,
  radialSegments = 8
) => {
  const cylinder = mesh(
    new THREE.CylinderGeometry(radius, radius, height, radialSegments),
    color
  );
  cylinder.position.set(position[0], position[1], position[2]);
  group.add(cylinder);
  return cylinder;
};

const addStoneCluster = (group: THREE.Group, accent: number, seed = 0) => {
  const offsets = [
    [-0.34, 0.12, -0.16],
    [0.12, 0.15, 0.18],
    [0.38, 0.1, -0.08],
    [-0.04, 0.2, -0.38],
  ] as const;
  for (const [index, offset] of offsets.entries()) {
    const stone = addBox(
      group,
      [0.34, 0.22 + index * 0.02, 0.32],
      [offset[0], offset[1], offset[2]],
      index % 2 === seed % 2 ? accent : 0xd8d5c8
    );
    stone.rotation.y = index * 0.4;
  }
};

const addBerryThicket = (group: THREE.Group) => {
  const leafDark = 0x21633f;
  const leaf = 0x3f9b56;
  const leafBright = 0x75c95c;
  const berry = 0xd92f6f;
  const berryBright = 0xff6a9d;

  // The former fallback was four stones only 20–30 cm tall. In the Grove's
  // flower beds that made the valid F target look completely invisible. Build
  // a waist-high, broad thicket with berries above the surrounding plants so
  // the resource reads as a gatherable object from every approach angle.
  addBox(group, [0.26, 0.76, 0.26], [0, 0.42, 0], 0x65452d);
  for (const [index, position] of [
    [-0.42, 0.72, -0.18],
    [0.38, 0.82, -0.12],
    [-0.18, 1.02, 0.24],
    [0.26, 1.12, 0.26],
    [0, 1.28, -0.06],
  ].entries()) {
    const crown = addBox(
      group,
      [0.68, 0.54, 0.62],
      position as [number, number, number],
      [leafDark, leaf, leafBright][index % 3]
    );
    crown.rotation.y = index * 0.47;
  }
  for (const [index, position] of [
    [-0.5, 1.0, -0.5],
    [0.48, 1.08, -0.36],
    [-0.3, 1.4, 0.3],
    [0.34, 1.48, 0.2],
    [0.02, 1.6, -0.24],
    [0.58, 1.32, 0.34],
  ].entries()) {
    addBox(
      group,
      [0.18, 0.18, 0.18],
      position as [number, number, number],
      index % 2 ? berryBright : berry
    );
  }
};

export function createHarthmereQuestObjectMarkerMesh(
  marker: HarthmereQuestObjectMarker
): THREE.Group {
  const group = new THREE.Group();
  group.name = `${marker.label} ${HARTHMERE_QUEST_OBJECT_MARKER_VERSION}`;
  group.position.set(
    marker.position[0],
    marker.position[1],
    marker.position[2]
  );
  group.userData.harthmereQuestObjectMarkerVersion =
    HARTHMERE_QUEST_OBJECT_MARKER_VERSION;
  group.userData.harthmereQuestObjectMarkerId = marker.id;

  const text = `${marker.id} ${marker.label}`.toLowerCase();
  const accent = colorForMarker(marker);
  const wood = 0x7a4a2c;
  const darkWood = 0x4f2e1c;
  const parchment = 0xf5e1b4;
  const stone = 0xaeb6bd;
  const isRepairCart = /cart|wagon/.test(text);

  if (!isRepairCart) {
    const base = addCylinder(group, 0.62, 0.08, [0, 0.04, 0], accent, 18);
    base.scale.z = 0.72;
  }

  if (/paint/.test(text)) {
    addCylinder(group, 0.24, 0.38, [0, 0.28, 0], 0xd6488b, 12);
    addBox(group, [0.1, 0.72, 0.1], [0.32, 0.52, -0.08], wood).rotation.z =
      -0.45;
    addBox(group, [0.34, 0.12, 0.12], [0.48, 0.82, -0.12], accent);
  } else if (/flag|route/.test(text)) {
    addBox(group, [0.12, 1.35, 0.12], [-0.25, 0.72, 0], wood);
    addBox(group, [0.12, 1.1, 0.12], [0.25, 0.58, 0.08], wood);
    addBox(group, [0.56, 0.32, 0.06], [0.04, 1.2, 0.04], accent);
    addBox(group, [0.44, 0.26, 0.06], [0.48, 0.95, 0.12], 0xff7a7a);
  } else if (isRepairCart) {
    group.userData.harthmereQuestObjectVisualKind = "repair_cart";
    const cartPart = <T extends THREE.Object3D>(part: string, object: T): T => {
      object.name = `repair-cart-${part}`;
      object.userData.harthmereRepairCartPart = part;
      return object;
    };
    const iron = 0x5d6670;
    const toolSteel = 0xc6d1d8;

    cartPart("deck", addBox(group, [2.15, 0.22, 1.08], [0, 0.72, 0], darkWood));
    cartPart(
      "left-rail",
      addBox(group, [1.95, 0.46, 0.12], [-0.08, 1.0, -0.48], wood)
    );
    cartPart(
      "right-rail",
      addBox(group, [1.95, 0.46, 0.12], [-0.08, 1.0, 0.48], wood)
    );
    cartPart(
      "tailgate",
      addBox(group, [0.12, 0.46, 0.86], [-1.0, 1.0, 0], wood)
    );

    for (const x of [-0.72, 0.72]) {
      cartPart(
        `axle-${x < 0 ? "rear" : "front"}`,
        addBox(group, [0.14, 0.14, 1.45], [x, 0.46, 0], iron)
      );
      for (const z of [-0.67, 0.67]) {
        const wheel = cartPart(
          `wheel-${x < 0 ? "rear" : "front"}-${z < 0 ? "left" : "right"}`,
          mesh(new THREE.TorusGeometry(0.38, 0.09, 10, 24), iron)
        );
        wheel.position.set(x, 0.42, z);
        group.add(wheel);
      }
    }

    for (const z of [-0.34, 0.34]) {
      cartPart(
        `handle-${z < 0 ? "left" : "right"}`,
        addBox(group, [1.35, 0.11, 0.11], [1.62, 0.6, z], wood)
      ).rotation.z = -0.08;
    }
    cartPart(
      "repair-chest",
      addBox(group, [0.72, 0.44, 0.62], [-0.5, 1.18, 0], 0x6b3d25)
    );
    cartPart(
      "repair-chest-lid",
      addBox(group, [0.78, 0.11, 0.68], [-0.5, 1.43, 0], iron)
    );
    cartPart(
      "iron-ingots",
      addBox(group, [0.5, 0.2, 0.34], [0.28, 0.98, 0.16], toolSteel)
    );
    const wrenchHandle = cartPart(
      "wrench-handle",
      addBox(group, [0.72, 0.1, 0.1], [0.34, 1.18, -0.26], toolSteel)
    );
    wrenchHandle.rotation.y = -0.55;
    cartPart(
      "wrench-head",
      addBox(group, [0.24, 0.24, 0.08], [0.64, 1.18, -0.47], toolSteel)
    ).rotation.y = -0.55;
    cartPart(
      "repair-flag-pole",
      addBox(group, [0.1, 1.18, 0.1], [-0.9, 1.65, -0.36], wood)
    );
    cartPart(
      "repair-flag",
      addBox(group, [0.72, 0.36, 0.06], [-0.5, 2.05, -0.36], accent)
    );
  } else if (/dummy|scratch|repair post/.test(text)) {
    addBox(group, [0.26, 1.35, 0.26], [0, 0.72, 0], wood);
    addBox(group, [1.0, 0.18, 0.18], [0, 1.18, 0], darkWood);
    addBox(group, [0.42, 0.42, 0.14], [0, 0.58, 0.18], accent);
  } else if (/lunch pail|\bpail\b/.test(text)) {
    addCylinder(group, 0.38, 0.5, [0, 0.32, 0], accent, 14);
    const handle = mesh(new THREE.TorusGeometry(0.34, 0.045, 7, 18), darkWood);
    handle.rotation.x = Math.PI / 2;
    handle.position.y = 0.66;
    group.add(handle);
    addBox(group, [0.5, 0.08, 0.5], [0, 0.6, 0], parchment);
  } else if (/drop post|road post|post|marker/.test(text)) {
    addBox(group, [0.16, 1.28, 0.16], [-0.22, 0.68, 0], wood);
    addBox(group, [0.82, 0.36, 0.1], [0.14, 1.12, 0], parchment);
    addBox(group, [0.58, 0.045, 0.04], [0.16, 1.18, 0.06], 0x1d2b44);
    addBox(group, [0.5, 0.34, 0.3], [0.28, 0.32, 0.2], darkWood);
    addBox(group, [0.38, 0.08, 0.32], [0.28, 0.52, 0.2], accent);
  } else if (/toolbag|mailbag|satchel|bag/.test(text)) {
    addBox(group, [0.88, 0.46, 0.56], [0, 0.34, 0], darkWood);
    addBox(group, [0.68, 0.11, 0.5], [0, 0.61, 0], accent);
    addBox(group, [0.12, 0.52, 0.08], [-0.26, 0.42, -0.28], parchment);
    addBox(group, [0.12, 0.52, 0.08], [0.26, 0.42, -0.28], parchment);
    addBox(group, [0.4, 0.08, 0.1], [0, 0.76, -0.26], accent);
  } else if (/first[-\s]?aid|aid bin|medicine|medical/.test(text)) {
    addBox(group, [0.94, 0.46, 0.68], [0, 0.34, 0], 0xf4f1e8);
    addBox(group, [0.78, 0.12, 0.74], [0, 0.62, 0], accent);
    addBox(group, [0.16, 0.34, 0.04], [0, 0.36, -0.36], 0xd93f3f);
    addBox(group, [0.48, 0.12, 0.04], [0, 0.36, -0.365], 0xd93f3f);
    addBox(group, [0.34, 0.07, 0.08], [0, 0.78, -0.18], 0xd8d5c8);
  } else if (/barrels?/.test(text)) {
    addCylinder(group, 0.36, 0.72, [0, 0.44, 0], darkWood, 12);
    addCylinder(group, 0.38, 0.08, [0, 0.82, 0], accent, 12);
    addCylinder(group, 0.38, 0.08, [0, 0.08, 0], accent, 12);
    addBox(group, [0.86, 0.08, 0.08], [0, 0.52, 0.3], wood);
    addBox(group, [0.86, 0.08, 0.08], [0, 0.3, 0.3], wood);
  } else if (
    /crate|basket|bank|chest|box(?:es)?|bin|container|cache|locker|wardrobe|cabinet|lockbox|strongbox|stash|footlocker/.test(
      text
    )
  ) {
    addBox(group, [0.95, 0.52, 0.72], [0, 0.34, 0], darkWood);
    addBox(group, [0.78, 0.1, 0.78], [0, 0.64, 0], accent);
    addBox(group, [0.1, 0.52, 0.78], [-0.34, 0.36, 0], wood);
    addBox(group, [0.1, 0.52, 0.78], [0.34, 0.36, 0], wood);
    addBox(group, [0.18, 0.16, 0.08], [0, 0.39, -0.39], parchment);
  } else if (/ledger|board|table|workbench|desk|mirror/.test(text)) {
    addBox(group, [1.25, 0.12, 0.72], [0, 0.78, 0], darkWood);
    addBox(group, [0.14, 0.72, 0.14], [-0.48, 0.42, -0.22], wood);
    addBox(group, [0.14, 0.72, 0.14], [0.48, 0.42, -0.22], wood);
    addBox(group, [0.78, 0.06, 0.48], [0, 0.88, 0.08], parchment);
    addBox(group, [0.56, 0.035, 0.04], [0, 0.93, 0.18], 0x1d2b44);
  } else if (/ring|boundary/.test(text)) {
    const ring = mesh(new THREE.TorusGeometry(0.72, 0.055, 8, 28), accent);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    group.add(ring);
    addBox(group, [0.12, 0.5, 0.12], [-0.72, 0.32, 0], wood);
    addBox(group, [0.12, 0.5, 0.12], [0.72, 0.32, 0], wood);
  } else if (
    /antihydrogen|antihelium|antiboron|exotic|antimatter|deposit/.test(text)
  ) {
    addCylinder(group, 0.32, 0.92, [0, 0.52, 0], 0x151927, 9);
    addBox(group, [0.92, 0.16, 0.16], [0, 0.82, 0], accent).rotation.z = 0.72;
    addBox(group, [0.92, 0.16, 0.16], [0, 0.44, 0], accent).rotation.z = -0.72;
    addBox(group, [0.22, 0.22, 0.22], [0.28, 1.08, 0.18], 0xffffff);
    addBox(group, [0.16, 0.16, 0.16], [-0.26, 0.94, -0.2], accent);
    addStoneCluster(group, accent, marker.id.length);
  } else if (/helix|boss/.test(text)) {
    addCylinder(group, 0.34, 1.05, [0, 0.58, 0], 0x25304a, 9);
    addBox(group, [0.92, 0.22, 0.22], [0, 0.92, 0], accent).rotation.z = 0.68;
    addBox(group, [0.92, 0.22, 0.22], [0, 0.48, 0], accent).rotation.z = -0.68;
    addBox(group, [0.28, 0.28, 0.28], [0.28, 1.22, 0.18], 0xffffff);
    addBox(group, [0.18, 0.18, 0.18], [0.4, 1.24, 0.32], 0xff7a7a);
    addStoneCluster(group, accent, marker.id.length);
  } else if (/berr/.test(text)) {
    group.userData.harthmereQuestObjectVisualKind = "berry_thicket";
    addBerryThicket(group);
  } else if (/muck|stone|material|food|aid|drop/.test(text)) {
    addStoneCluster(group, accent, marker.id.length);
  } else if (/firefly|dim/.test(text)) {
    addCylinder(group, 0.38, 0.12, [0, 0.18, 0], darkWood, 12);
    for (const [index, offset] of [
      [-0.25, 0.58, 0],
      [0.2, 0.72, 0.18],
      [0.1, 0.5, -0.26],
    ].entries()) {
      addBox(
        group,
        [0.16, 0.16, 0.16],
        offset as [number, number, number],
        index === 1 ? 0xffffff : accent
      );
    }
  } else {
    addBox(group, [0.76, 0.76, 0.76], [0, 0.46, 0], accent);
    addBox(group, [0.42, 0.42, 0.42], [0, 1.04, 0], parchment);
  }

  return group;
}

function disposeQuestMarkerFallbackObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) material.dispose();
  });
}

export function replaceHarthmereRepairCartFallbackWithAsset(
  markerGroup: THREE.Group,
  prototype: THREE.Object3D
): THREE.Object3D | undefined {
  if (
    markerGroup.userData.harthmereQuestObjectVisualKind !== "repair_cart" ||
    markerGroup.userData.harthmereRepairCartAssetLoaded === true
  ) {
    return undefined;
  }

  // Preserve the director-owned active quest beacon. Only remove direct
  // children tagged as procedural repair-cart fallback parts.
  for (const child of [...markerGroup.children]) {
    if (typeof child.userData.harthmereRepairCartPart !== "string") continue;
    markerGroup.remove(child);
    disposeQuestMarkerFallbackObject(child);
  }

  const asset = prototype.clone(true);
  asset.name = "luis-repair-cart-authored-asset";
  asset.userData.harthmereRepairCartAsset = true;
  asset.userData.harthmereRepairCartAssetUrl =
    HARTHMERE_LUIS_REPAIR_CART_ASSET_URL;
  asset.traverse((child) => {
    child.frustumCulled = false;
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });
  markerGroup.add(asset);
  markerGroup.userData.harthmereRepairCartAssetLoaded = true;
  markerGroup.userData.harthmereRepairCartAssetUrl =
    HARTHMERE_LUIS_REPAIR_CART_ASSET_URL;
  return asset;
}

export function createHarthmereQuestObjectMarkerAnchor(
  marker: HarthmereQuestObjectMarker
): THREE.Group {
  const group = new THREE.Group();
  group.name = `${marker.label} ${HARTHMERE_QUEST_OBJECT_MARKER_VERSION} anchor ${HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY}`;
  group.position.set(
    marker.position[0],
    marker.position[1],
    marker.position[2]
  );
  group.visible = false;
  group.userData.harthmereQuestObjectMarkerVersion =
    HARTHMERE_QUEST_OBJECT_MARKER_VERSION;
  group.userData.harthmereQuestObjectMarkerRenderPolicy =
    HARTHMERE_QUEST_OBJECT_MARKER_RENDER_POLICY;
  group.userData.harthmereQuestObjectMarkerId = marker.id;
  return group;
}

export function createHarthmereActiveQuestMarkerBeacon(): THREE.Group {
  const beacon = new THREE.Group();
  beacon.name = `active-quest-beacon ${HARTHMERE_QUEST_OBJECT_MARKER_VERSION}`;
  beacon.visible = false;
  beacon.userData.harthmereActiveQuestBeacon = true;

  const pole = addBox(
    beacon,
    [0.08, 1.55, 0.08],
    [0.72, 0.82, 0.72],
    HARTHMERE_ACTIVE_QUEST_MARKER_BLUE
  );
  pole.userData.harthmereActiveQuestBeaconPart = "pole";

  const cap = addBox(
    beacon,
    [0.26, 0.26, 0.26],
    [0.72, 1.68, 0.72],
    HARTHMERE_ACTIVE_QUEST_MARKER_CAP
  );
  cap.userData.harthmereActiveQuestBeaconPart = "cap";

  return beacon;
}

function disposeHarthmereQuestMarker(root: THREE.Object3D) {
  const dispose = (object: THREE.Object3D) => {
    // Authored repair-cart clones share their geometry/materials with the
    // retained prototype. Detach that subtree without disposing shared data.
    if (object.userData.harthmereRepairCartAsset === true) return;
    for (const child of object.children) dispose(child);
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) material.dispose();
  };
  dispose(root);
}

export class HarthmereQuestObjectMarkersRenderer implements Renderer {
  public readonly name = HARTHMERE_QUEST_OBJECT_MARKER_VERSION;
  private readonly root = new THREE.Group();
  private readonly activeBeacons = new Map<string, THREE.Group>();
  private readonly markerMeshes = new Map<string, THREE.Group>();
  // Per-column last-grounded surface memory, shared with NPCs/items/gather nodes
  // via the one grounder. Keeps a marker resting on the real surface (never
  // buried at the flat authored Y) while its terrain shard streams in.
  private readonly groundedFeetYByColumn = new Map<string, number>();
  private debugRefreshSeconds = 0;
  private activeMarkerId: string | undefined;
  private visibleSnapshotGroveMarkerIds = new Set<string>();
  private chapter1ObjectiveMarkerId: string | undefined;
  private chapter1ObjectiveProjectionSignature: string | undefined;
  private activeQuestStateRefreshSeconds = 0;
  private mobileProximityRefreshSeconds = 0;
  private elapsedSeconds = 0;
  private repairCartPrototype: THREE.Object3D | undefined;
  private repairCartAssetLoading: Promise<void> | undefined;
  private repairCartAssetFailed = false;

  constructor(
    private readonly resources?: ClientResources,
    private readonly repairCartAssetLoader: HarthmereRepairCartAssetLoader = createGltfLoader(),
    private readonly mobileDevice = false
  ) {
    this.root.name = `harthmere-quest-object-markers root ${HARTHMERE_QUEST_OBJECT_MARKER_VERSION}`;
    if (!mobileDevice) {
      for (const marker of HARTHMERE_QUEST_OBJECT_MARKERS) {
        this.ensureMarker(marker);
      }
    }
  }

  private ensureMarker(marker: HarthmereQuestObjectMarker): THREE.Group {
    const existing = this.markerMeshes.get(marker.id);
    if (existing) return existing;
    const isVisibleWorldObject = isVisibleHarthmereWorldObjectMarker(marker);
    const shouldRenderMesh = shouldRenderHarthmereQuestObjectMarkerMesh(marker);
    const mesh = shouldRenderMesh
      ? createHarthmereQuestObjectMarkerMesh(marker)
      : createHarthmereQuestObjectMarkerAnchor(marker);
    mesh.visible = isVisibleWorldObject;
    if (isVisibleWorldObject) {
      mesh.userData.harthmereQuestObjectMarkerAlwaysVisible = true;
      mesh.userData.harthmereQuestObjectMarkerRenderPolicy =
        HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_RENDER_POLICY;
    } else if (shouldRenderMesh) {
      mesh.userData.harthmereQuestObjectMarkerRenderPolicy =
        HARTHMERE_ACTIVE_WORLD_OBJECT_MARKER_RENDER_POLICY;
    }
    const beacon = createHarthmereActiveQuestMarkerBeacon();
    mesh.add(beacon);
    // Remember the authored world XZ + hint Y so we can re-ground the marker
    // onto real terrain each frame (markers are outdoor quest beacons).
    mesh.userData.harthmereMarkerWorldXZ = [
      marker.position[0],
      marker.position[2],
    ];
    mesh.userData.harthmereMarkerHintY = marker.position[1];
    this.markerMeshes.set(marker.id, mesh);
    this.activeBeacons.set(marker.id, beacon);
    this.root.add(mesh);
    if (this.repairCartPrototype) {
      replaceHarthmereRepairCartFallbackWithAsset(
        mesh,
        this.repairCartPrototype
      );
    }
    return mesh;
  }

  private removeMarker(markerId: string) {
    const mesh = this.markerMeshes.get(markerId);
    if (!mesh) return;
    this.root.remove(mesh);
    disposeHarthmereQuestMarker(mesh);
    this.markerMeshes.delete(markerId);
    this.activeBeacons.delete(markerId);
    // The shared grounding helper keys memory by world column, not marker id.
    // This mobile set is deliberately tiny, so clearing prevents stale columns
    // from accumulating as the player crosses the world.
    this.groundedFeetYByColumn.clear();
  }

  private syncMobileMarkers() {
    if (!this.mobileDevice || !this.resources) return;
    const requiredMarkerIds = new Set<string>();
    if (this.activeMarkerId) requiredMarkerIds.add(this.activeMarkerId);
    for (const id of this.visibleSnapshotGroveMarkerIds) {
      requiredMarkerIds.add(id);
    }
    const activePinMarkerId =
      harthmereWorldObjectMarkerIdForActiveMapPinForTest(
        readActiveBiomesUIMapPin()
      );
    if (activePinMarkerId) requiredMarkerIds.add(activePinMarkerId);
    const desiredMarkerIds = new Set(
      harthmereMobileQuestObjectMarkerIds(
        this.resources.get("/scene/camera").three.position,
        requiredMarkerIds
      )
    );
    if (this.chapter1ObjectiveMarkerId) {
      desiredMarkerIds.add(this.chapter1ObjectiveMarkerId);
    }
    for (const id of desiredMarkerIds) {
      const marker = HARTHMERE_QUEST_OBJECT_MARKER_BY_ID.get(id);
      if (marker) this.ensureMarker(marker);
    }
    for (const id of [...this.markerMeshes.keys()]) {
      if (!desiredMarkerIds.has(id)) this.removeMarker(id);
    }
    // Newly-created meshes need the current visibility/beacon state.
    this.applyActiveQuestMarkerId(this.activeMarkerId);
  }

  private applyLoadedRepairCartAsset(): void {
    if (!this.repairCartPrototype) return;
    for (const markerMesh of this.markerMeshes.values()) {
      replaceHarthmereRepairCartFallbackWithAsset(
        markerMesh,
        this.repairCartPrototype
      );
    }
  }

  private queueRepairCartAssetLoad(): void {
    if (
      this.mobileDevice &&
      ![...this.markerMeshes.values()].some(
        (mesh) => mesh.userData.harthmereQuestObjectVisualKind === "repair_cart"
      )
    ) {
      return;
    }
    if (
      this.repairCartPrototype ||
      this.repairCartAssetLoading ||
      this.repairCartAssetFailed ||
      typeof document === "undefined"
    ) {
      this.applyLoadedRepairCartAsset();
      return;
    }
    this.repairCartAssetLoading = this.repairCartAssetLoader
      .loadAsync(HARTHMERE_LUIS_REPAIR_CART_ASSET_URL)
      .then((gltf) => {
        const prototype = gltf.scene ?? gltf.scenes?.[0];
        if (!prototype) {
          throw new Error("Luis repair cart GLB has no scene");
        }
        this.repairCartPrototype = prototype;
        this.repairCartAssetFailed = false;
        this.applyLoadedRepairCartAsset();
      })
      .catch(() => {
        // The existing semantic procedural cart intentionally remains visible
        // and interactable if an asset/CDN request fails.
        this.repairCartAssetFailed = true;
      })
      .finally(() => {
        this.repairCartAssetLoading = undefined;
      });
  }

  // HARTHMERE_ENTITY_GROUNDING: keep visible quest markers resting on the real
  // terrain surface (cave-safe + water-aware) instead of a flat authored Y.
  private groundVisibleMarkers(): void {
    if (!this.resources) {
      return;
    }
    for (const [id, mesh] of this.markerMeshes) {
      const isActive =
        id === this.activeMarkerId ||
        this.visibleSnapshotGroveMarkerIds.has(id);
      const isAlwaysVisible =
        mesh.userData.harthmereQuestObjectMarkerAlwaysVisible === true;
      // Process visible meshes, plus the active marker even if it was deferred
      // (hidden) last frame while its terrain streamed in — so it can re-appear
      // once the real surface is known.
      if (!mesh.visible && !isActive && !isAlwaysVisible) {
        continue;
      }
      const xz = mesh.userData.harthmereMarkerWorldXZ as
        [number, number] | undefined;
      const hintY = mesh.userData.harthmereMarkerHintY as number | undefined;
      if (!xz || hintY === undefined) {
        continue;
      }
      // Use THE shared world-placement grounder — the SAME one muckers, animals,
      // and dropped/quest items use (npcs.ts / drops.ts): one tri-state probe +
      // keep-last-surface memory. A defined feetY is the real (or last-known
      // real) surface; undefined means terrain is genuinely unknown here.
      const isFieldTarget = isHarthmereJobsBoardFieldTargetMarkerId(id);
      const groundedFeetY = harthmereGroundedFeetYWithMemory(
        this.resources,
        this.groundedFeetYByColumn,
        xz[0],
        xz[1],
        hintY,
        // Permanent business fixtures may be under an authored awning. Other
        // outdoor quest props retain open-sky grounding so cave ceilings do
        // not pull them away from their intended surface.
        !isFieldTarget
      );
      const feetY = isFieldTarget
        ? harthmereJobsBoardFieldTargetFeetY(groundedFeetY, hintY)
        : groundedFeetY;
      if (feetY !== undefined) {
        // Rest on the (remembered) real surface and (re)show the active marker.
        mesh.position.y = feetY;
        if (isActive || isAlwaysVisible) {
          mesh.visible = true;
        }
      } else {
        // Terrain hasn't streamed in and we have no remembered surface yet:
        // DON'T show the marker at the flat authored Y (that is what made quest
        // items float/sink/bury). Defer; the next frame re-checks because we
        // still process the active marker when hidden.
        mesh.visible = false;
      }
    }
  }

  syncActiveQuestMarkerId(markerId: string | undefined): void {
    // Tests and local-dev quest events can push a known active marker directly.
    // The next render still polls local state, but this short grace period keeps
    // explicit updates from being immediately overwritten in non-browser tests.
    this.activeQuestStateRefreshSeconds = ACTIVE_QUEST_BEACON_REFRESH_SECONDS;
    const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      (candidate) => candidate.id === markerId
    );
    if (!markerId || marker?.dynamic === "live_entity_helper") {
      this.applyLiveEntityHelperMarkerVisibility(
        markerId ? new Set([markerId]) : new Set()
      );
    }
    this.visibleSnapshotGroveMarkerIds = markerId
      ? new Set([markerId])
      : new Set();
    this.applyActiveQuestMarkerId(markerId);
  }

  private refreshActiveQuestMarkerFromLocalState(): void {
    const liveEntityHelperState = readLiveEntityHelperQuestState();
    const liveEntityHelperMarkerId = activeLiveEntityHelperQuestMarkerId(
      liveEntityHelperState
    );
    this.applyLiveEntityHelperMarkerVisibility(
      activeLiveEntityHelperQuestMarkerIds(liveEntityHelperState)
    );
    const snapshotGroveState = readSnapshotGroveQuestState();
    const snapshotGroveMarkerId =
      activeHarthmereQuestMarkerId(snapshotGroveState);
    this.visibleSnapshotGroveMarkerIds = new Set(
      activeHarthmereQuestMarkerIds(snapshotGroveState)
    );
    const activePin = readActiveBiomesUIMapPin();
    const activePinWorldObjectMarkerId =
      harthmereWorldObjectMarkerIdForActiveMapPinForTest(activePin);
    this.applyActiveQuestMarkerId(
      activePinWorldObjectMarkerId ??
        harthmereResolveWorldQuestBeaconMarkerId({
          liveEntityHelperMarkerId,
          snapshotGroveMarkerId,
          activePinMarkerId: activePin?.markerId,
        })
    );
    this.refreshChapter1ObjectiveWorldMarker();
  }

  private refreshChapter1ObjectiveWorldMarker(): void {
    const projection = readChapter1ObjectiveWorldProjection();
    const needsProp =
      projection &&
      ["collect", "interact", "use_item", "place", "sleep"].includes(
        projection.trigger
      );
    const nextId =
      projection && needsProp && projection.targetEntityId === undefined
        ? `chapter1_objective:${projection.key}`
        : undefined;
    const nextSignature =
      projection && nextId
        ? JSON.stringify([
            nextId,
            projection.label,
            ...projection.position,
            projection.trigger,
          ])
        : undefined;
    if (
      this.chapter1ObjectiveMarkerId &&
      (this.chapter1ObjectiveMarkerId !== nextId ||
        this.chapter1ObjectiveProjectionSignature !== nextSignature)
    ) {
      this.removeMarker(this.chapter1ObjectiveMarkerId);
      this.chapter1ObjectiveMarkerId = undefined;
      this.chapter1ObjectiveProjectionSignature = undefined;
    }
    if (!projection || !nextId) return;

    let markerMesh = this.markerMeshes.get(nextId);
    if (!markerMesh) {
      const marker: HarthmereQuestObjectMarker = {
        id: nextId,
        label: projection.label,
        kind: "interactable",
        position: [...projection.position],
        dynamic: "chapter1",
      };
      markerMesh = createHarthmereQuestObjectMarkerMesh(marker);
      markerMesh.userData.harthmereQuestObjectMarkerRenderPolicy =
        HARTHMERE_ACTIVE_WORLD_OBJECT_MARKER_RENDER_POLICY;
      markerMesh.userData.harthmereMarkerWorldXZ = [
        projection.position[0],
        projection.position[2],
      ];
      markerMesh.userData.harthmereMarkerHintY = projection.position[1];
      const beacon = createHarthmereActiveQuestMarkerBeacon();
      beacon.visible = true;
      markerMesh.add(beacon);
      this.markerMeshes.set(nextId, markerMesh);
      this.activeBeacons.set(nextId, beacon);
      this.root.add(markerMesh);
      this.applyLoadedRepairCartAsset();
    }
    markerMesh.visible = true;
    this.activeBeacons.get(nextId)!.visible = true;
    this.chapter1ObjectiveMarkerId = nextId;
    this.chapter1ObjectiveProjectionSignature = nextSignature;
  }

  private applyLiveEntityHelperMarkerVisibility(
    visibleMarkerIds: ReadonlySet<string>
  ): void {
    // The quest marker renderer is intentionally active-beacon-only in world.
    // Keep the registry and active-id flow, but do not spawn passive primitive
    // marker bodies for helper/business/tutorial targets.
    void visibleMarkerIds;
    for (const marker of HARTHMERE_QUEST_OBJECT_MARKERS) {
      if (marker.dynamic !== "live_entity_helper") {
        continue;
      }
      const mesh = this.markerMeshes.get(marker.id);
      if (mesh) {
        mesh.visible = marker.id === this.activeMarkerId;
      }
    }
  }

  private applyActiveQuestMarkerId(markerId: string | undefined): void {
    this.activeMarkerId = markerId;
    if (this.mobileDevice) {
      const markerIds = new Set(this.visibleSnapshotGroveMarkerIds);
      if (markerId) markerIds.add(markerId);
      for (const id of markerIds) {
        const marker = HARTHMERE_QUEST_OBJECT_MARKER_BY_ID.get(id);
        if (marker) this.ensureMarker(marker);
      }
    }
    for (const [id, beacon] of this.activeBeacons) {
      const active = id === markerId;
      const markerGroup = this.markerMeshes.get(id);
      if (markerGroup) {
        markerGroup.visible =
          id === this.chapter1ObjectiveMarkerId ||
          active ||
          this.visibleSnapshotGroveMarkerIds.has(id) ||
          markerGroup.userData.harthmereQuestObjectMarkerAlwaysVisible === true;
      }
      beacon.visible = active;
      beacon.position.y = 0;
      beacon.rotation.y = 0;
    }
  }

  private animateActiveBeacons(dt: number): void {
    this.elapsedSeconds += dt;
    for (const beacon of this.activeBeacons.values()) {
      if (!beacon.visible) {
        continue;
      }
      beacon.position.y = Math.sin(this.elapsedSeconds * 4) * 0.05;
      beacon.rotation.y = this.elapsedSeconds * 1.2;
    }
  }

  private publishDebug(): void {
    if (typeof window === "undefined") {
      return;
    }
    (window as any).__harthmereQuestObjectMarkerDebug = {
      version: HARTHMERE_QUEST_OBJECT_MARKER_VERSION,
      mobileDevice: this.mobileDevice,
      expectedMarkerCount: HARTHMERE_QUEST_OBJECT_MARKERS.length,
      loadedMarkerCount: this.markerMeshes.size,
      repairCartAssetUrl: HARTHMERE_LUIS_REPAIR_CART_ASSET_URL,
      repairCartAssetLoaded: Boolean(this.repairCartPrototype),
      repairCartAssetFailed: this.repairCartAssetFailed,
      activeMarkerId: this.activeMarkerId,
      visibleSnapshotGroveMarkerIds: [...this.visibleSnapshotGroveMarkerIds],
      markers: () =>
        Array.from(this.markerMeshes.entries()).map(([id, mesh]) => ({
          id,
          label:
            HARTHMERE_QUEST_OBJECT_MARKERS.find((marker) => marker.id === id)
              ?.label ?? id,
          visible: mesh.visible,
          position: [mesh.position.x, mesh.position.y, mesh.position.z],
          dynamic: HARTHMERE_QUEST_OBJECT_MARKERS.find(
            (marker) => marker.id === id
          )?.dynamic,
          beaconVisible: this.activeBeacons.get(id)?.visible === true,
          chapter1Objective: id === this.chapter1ObjectiveMarkerId,
        })),
    };
  }

  draw(scenes: Scenes, dt: number): void {
    // Like the jobs-board renderer, reattach every frame so reconnects and
    // scene recreation do not strand the props in a stale scene.
    // Quest markers use only stock Three.js materials. Their hierarchy can be
    // large, so bypass addToScenes()'s per-frame classification/dependency
    // traversals and route the root directly to the stock-material pass.
    scenes.three.add(this.root);
    this.activeQuestStateRefreshSeconds -= dt;
    if (this.activeQuestStateRefreshSeconds <= 0) {
      this.activeQuestStateRefreshSeconds = ACTIVE_QUEST_BEACON_REFRESH_SECONDS;
      this.refreshActiveQuestMarkerFromLocalState();
    }
    if (this.mobileDevice) {
      this.mobileProximityRefreshSeconds -= Math.min(dt, 0.5);
      if (this.mobileProximityRefreshSeconds <= 0) {
        this.mobileProximityRefreshSeconds = 0.25;
        this.syncMobileMarkers();
      }
    }
    this.queueRepairCartAssetLoad();
    this.animateActiveBeacons(dt);
    this.groundVisibleMarkers();
    this.debugRefreshSeconds -= Math.min(dt, 0.5);
    if (this.debugRefreshSeconds <= 0) {
      this.debugRefreshSeconds = 0.5;
      this.publishDebug();
    }
  }
}

export function makeHarthmereQuestObjectMarkersRenderer(
  resources?: ClientResources,
  repairCartAssetLoader?: HarthmereRepairCartAssetLoader,
  mobileDevice = false
) {
  return new HarthmereQuestObjectMarkersRenderer(
    resources,
    repairCartAssetLoader,
    mobileDevice
  );
}
