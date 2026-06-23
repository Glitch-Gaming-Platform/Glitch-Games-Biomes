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
import { addToScenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";
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
import { readSnapshotGroveQuestState } from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import { readActiveBiomesUIMapPin } from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_QUESTS,
  type SnapshotGroveLandmark,
} from "@/shared/harthmere/snapshot_grove_content";
import { isHarthmereContainerObjectLabel } from "@/shared/harthmere/object_interaction_semantics";
import * as THREE from "three";

export const HARTHMERE_QUEST_OBJECT_MARKER_VERSION =
  "harthmere-quest-object-marker" as const;

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
    pinId.startsWith(HARTHMERE_JOBS_BOARD_ACTIVE_PIN_MARKER_PREFIX)
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

export const HARTHMERE_VISIBLE_WORLD_OBJECT_MARKER_IDS: ReadonlySet<string> =
  new Set([
    // Non-container authored props that must stay physically visible in world.
    "econ_grove_billy_post",
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
  dynamic?: "live_entity_helper" | "jobs_board";
}

export interface HarthmereQuestObjectMarkerState {
  activeQuestId?: string;
  activeObjectiveIndex?: number;
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
  return [
    landmark.position[0],
    // Landmark pins hover above the target. Procedural props sit at the
    // player's feet/ground height so they do not float over the plaza.
    landmark.position[1] - 1,
    landmark.position[2],
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
    ? isHarthmereContainerObjectLabel({ label: marker.label })
    : false;
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

  const rawIndex =
    typeof state.activeObjectiveIndex === "number" &&
    Number.isFinite(state.activeObjectiveIndex)
      ? Math.trunc(state.activeObjectiveIndex)
      : 0;
  const clampedIndex = Math.max(
    0,
    Math.min(quest.markerIds.length - 1, rawIndex)
  );
  return quest.markerIds[clampedIndex];
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

const mesh = (
  geometry: THREE.BufferGeometry,
  color: number
): THREE.Mesh => {
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

  const base = addCylinder(group, 0.62, 0.08, [0, 0.04, 0], accent, 18);
  base.scale.z = 0.72;

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
  } else if (/dummy|scratch|repair post/.test(text)) {
    addBox(group, [0.26, 1.35, 0.26], [0, 0.72, 0], wood);
    addBox(group, [1.0, 0.18, 0.18], [0, 1.18, 0], darkWood);
    addBox(group, [0.42, 0.42, 0.14], [0, 0.58, 0.18], accent);
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
    addBox(
      group,
      [0.92, 0.16, 0.16],
      [0, 0.82, 0],
      accent
    ).rotation.z = 0.72;
    addBox(group, [0.92, 0.16, 0.16], [0, 0.44, 0], accent).rotation.z =
      -0.72;
    addBox(group, [0.22, 0.22, 0.22], [0.28, 1.08, 0.18], 0xffffff);
    addBox(group, [0.16, 0.16, 0.16], [-0.26, 0.94, -0.2], accent);
    addStoneCluster(group, accent, marker.id.length);
  } else if (/helix|boss/.test(text)) {
    addCylinder(group, 0.34, 1.05, [0, 0.58, 0], 0x25304a, 9);
    addBox(
      group,
      [0.92, 0.22, 0.22],
      [0, 0.92, 0],
      accent
    ).rotation.z = 0.68;
    addBox(group, [0.92, 0.22, 0.22], [0, 0.48, 0], accent).rotation.z =
      -0.68;
    addBox(group, [0.28, 0.28, 0.28], [0.28, 1.22, 0.18], 0xffffff);
    addBox(group, [0.18, 0.18, 0.18], [0.4, 1.24, 0.32], 0xff7a7a);
    addStoneCluster(group, accent, marker.id.length);
  } else if (/berry|muck|stone|material|food|aid|drop/.test(text)) {
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

export class HarthmereQuestObjectMarkersRenderer implements Renderer {
  public readonly name = HARTHMERE_QUEST_OBJECT_MARKER_VERSION;
  private readonly root = new THREE.Group();
  private readonly activeBeacons = new Map<string, THREE.Group>();
  private readonly markerMeshes = new Map<string, THREE.Group>();
  // Per-column last-grounded surface memory, shared with NPCs/items/gather nodes
  // via the one grounder. Keeps a marker resting on the real surface (never
  // buried at the flat authored Y) while its terrain shard streams in.
  private readonly groundedFeetYByColumn = new Map<string, number>();
  private activeMarkerId: string | undefined;
  private activeQuestStateRefreshSeconds = 0;
  private elapsedSeconds = 0;

  constructor(private readonly resources?: ClientResources) {
    this.root.name = `harthmere-quest-object-markers root ${HARTHMERE_QUEST_OBJECT_MARKER_VERSION}`;
    for (const marker of HARTHMERE_QUEST_OBJECT_MARKERS) {
      const isVisibleWorldObject =
        isVisibleHarthmereWorldObjectMarker(marker);
      const shouldRenderMesh =
        shouldRenderHarthmereQuestObjectMarkerMesh(marker);
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
    }
  }

  // HARTHMERE_ENTITY_GROUNDING: keep visible quest markers resting on the real
  // terrain surface (cave-safe + water-aware) instead of a flat authored Y.
  private groundVisibleMarkers(): void {
    if (!this.resources) {
      return;
    }
    for (const [id, mesh] of this.markerMeshes) {
      const isActive = id === this.activeMarkerId;
      const isAlwaysVisible =
        mesh.userData.harthmereQuestObjectMarkerAlwaysVisible === true;
      // Process visible meshes, plus the active marker even if it was deferred
      // (hidden) last frame while its terrain streamed in — so it can re-appear
      // once the real surface is known.
      if (!mesh.visible && !isActive && !isAlwaysVisible) {
        continue;
      }
      const xz = mesh.userData.harthmereMarkerWorldXZ as
        | [number, number]
        | undefined;
      const hintY = mesh.userData.harthmereMarkerHintY as number | undefined;
      if (!xz || hintY === undefined) {
        continue;
      }
      // Use THE shared world-placement grounder — the SAME one muckers, animals,
      // and dropped/quest items use (npcs.ts / drops.ts): one tri-state probe +
      // keep-last-surface memory. A defined feetY is the real (or last-known
      // real) surface; undefined means terrain is genuinely unknown here.
      const feetY = harthmereGroundedFeetYWithMemory(
        this.resources,
        this.groundedFeetYByColumn,
        xz[0],
        xz[1],
        hintY,
        true
      );
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
    this.activeQuestStateRefreshSeconds =
      ACTIVE_QUEST_BEACON_REFRESH_SECONDS;
    const marker = HARTHMERE_QUEST_OBJECT_MARKERS.find(
      (candidate) => candidate.id === markerId
    );
    if (!markerId || marker?.dynamic === "live_entity_helper") {
      this.applyLiveEntityHelperMarkerVisibility(
        markerId ? new Set([markerId]) : new Set()
      );
    }
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
    const snapshotGroveMarkerId = activeHarthmereQuestMarkerId(
      readSnapshotGroveQuestState()
    );
    this.applyActiveQuestMarkerId(
      harthmereResolveWorldQuestBeaconMarkerId({
        liveEntityHelperMarkerId,
        snapshotGroveMarkerId,
        activePinMarkerId: readActiveBiomesUIMapPin()?.markerId,
      })
    );
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
    if (this.activeMarkerId === markerId) {
      return;
    }
    this.activeMarkerId = markerId;
    for (const [id, beacon] of this.activeBeacons) {
      const active = id === markerId;
      const markerGroup = this.markerMeshes.get(id);
      if (markerGroup) {
        markerGroup.visible =
          active ||
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
      activeMarkerId: this.activeMarkerId,
      markers: () =>
        Array.from(this.markerMeshes.entries()).map(([id, mesh]) => ({
          id,
          label:
            HARTHMERE_QUEST_OBJECT_MARKERS.find(
              (marker) => marker.id === id
            )?.label ?? id,
          visible: mesh.visible,
          position: [mesh.position.x, mesh.position.y, mesh.position.z],
          dynamic: HARTHMERE_QUEST_OBJECT_MARKERS.find(
            (marker) => marker.id === id
          )?.dynamic,
          beaconVisible: this.activeBeacons.get(id)?.visible === true,
        })),
    };
  }

  draw(scenes: Scenes, dt: number): void {
    // Like the jobs-board renderer, reattach every frame so reconnects and
    // scene recreation do not strand the props in a stale scene.
    addToScenes(scenes, this.root);
    this.activeQuestStateRefreshSeconds -= dt;
    if (this.activeQuestStateRefreshSeconds <= 0) {
      this.activeQuestStateRefreshSeconds =
        ACTIVE_QUEST_BEACON_REFRESH_SECONDS;
      this.refreshActiveQuestMarkerFromLocalState();
    }
    this.animateActiveBeacons(dt);
    this.groundVisibleMarkers();
    this.publishDebug();
  }
}

export function makeHarthmereQuestObjectMarkersRenderer(
  resources?: ClientResources
) {
  return new HarthmereQuestObjectMarkersRenderer(resources);
}
