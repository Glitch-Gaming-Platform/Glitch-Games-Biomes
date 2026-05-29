// HARTHMERE_QUEST_OBJECT_MARKERS_V145
//
// The Biomes UI map and quest tracker can point at Grove objects such as
// paint pots, repair posts, practice crates, and field tables. Those markers
// used to rely on a mixture of imported OBJ/GLB props and map pins, which is
// fragile in the snapshot-built runtime because structural asset filters can
// remove "board", "table", "fence", "crate", or "sign" placements. These
// lightweight procedural props make every quest-linked non-NPC Grove landmark
// visible in-world without depending on asset loading, lighting, or the
// snapshot merge filter.

import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import { readSnapshotGroveQuestStateV75 } from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  SNAPSHOT_GROVE_LANDMARKS_V75,
  SNAPSHOT_GROVE_QUESTS_V75,
  type SnapshotGroveLandmarkV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import * as THREE from "three";

export const HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145 =
  "harthmere-quest-object-marker-v145" as const;
export const HARTHMERE_ACTIVE_QUEST_MARKER_BLUE_V145 = 0x5bd7ff;
export const HARTHMERE_ACTIVE_QUEST_MARKER_CAP_V145 = 0xffffff;

const ACTIVE_QUEST_BEACON_REFRESH_SECONDS_V145 = 0.25;

const QUEST_OBJECT_MARKER_SKIP_IDS_V145 = new Set([
  // The jobs boards have their own oversized renderer because they are a
  // primary town building, not a small quest prop.
  "harthmere_market_posting_board",
  "harthmere_town_market_posting_board",
]);

export interface HarthmereQuestObjectMarkerV145 {
  id: string;
  label: string;
  kind: SnapshotGroveLandmarkV75["kind"];
  position: [number, number, number];
}

export interface HarthmereQuestObjectMarkerStateV145 {
  activeQuestId?: string;
  activeObjectiveIndex?: number;
  completedQuestIds?: readonly string[];
}

export function isRenderableHarthmereQuestObjectLandmarkV145(
  landmark: SnapshotGroveLandmarkV75
): boolean {
  return Boolean(
    landmark.questIds?.length &&
      landmark.kind !== "npc" &&
      landmark.area !== "harthmere" &&
      !QUEST_OBJECT_MARKER_SKIP_IDS_V145.has(landmark.id)
  );
}

export const HARTHMERE_QUEST_OBJECT_MARKERS_V145: readonly HarthmereQuestObjectMarkerV145[] =
  SNAPSHOT_GROVE_LANDMARKS_V75.filter(
    isRenderableHarthmereQuestObjectLandmarkV145
  ).map((landmark) => ({
    id: landmark.id,
    label: landmark.label,
    kind: landmark.kind,
    position: [
      landmark.position[0],
      // Landmark pins hover above the target. Procedural props sit at the
      // player's feet/ground height so they do not float over the plaza.
      landmark.position[1] - 1,
      landmark.position[2],
    ],
  }));

export function activeHarthmereQuestMarkerIdV145(
  state: HarthmereQuestObjectMarkerStateV145
): string | undefined {
  const activeQuestId = state.activeQuestId;
  if (!activeQuestId) {
    return undefined;
  }

  const quest = SNAPSHOT_GROVE_QUESTS_V75.find(
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

const colorForMarkerV145 = (marker: HarthmereQuestObjectMarkerV145) => {
  const text = `${marker.id} ${marker.label}`.toLowerCase();
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

const meshV145 = (
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

const addBoxV145 = (
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  color: number
) => {
  const box = meshV145(new THREE.BoxGeometry(size[0], size[1], size[2]), color);
  box.position.set(position[0], position[1], position[2]);
  group.add(box);
  return box;
};

const addCylinderV145 = (
  group: THREE.Group,
  radius: number,
  height: number,
  position: [number, number, number],
  color: number,
  radialSegments = 8
) => {
  const cylinder = meshV145(
    new THREE.CylinderGeometry(radius, radius, height, radialSegments),
    color
  );
  cylinder.position.set(position[0], position[1], position[2]);
  group.add(cylinder);
  return cylinder;
};

const addStoneClusterV145 = (group: THREE.Group, accent: number, seed = 0) => {
  const offsets = [
    [-0.34, 0.12, -0.16],
    [0.12, 0.15, 0.18],
    [0.38, 0.1, -0.08],
    [-0.04, 0.2, -0.38],
  ] as const;
  for (const [index, offset] of offsets.entries()) {
    const stone = addBoxV145(
      group,
      [0.34, 0.22 + index * 0.02, 0.32],
      [offset[0], offset[1], offset[2]],
      index % 2 === seed % 2 ? accent : 0xd8d5c8
    );
    stone.rotation.y = index * 0.4;
  }
};

export function createHarthmereQuestObjectMarkerMeshV145(
  marker: HarthmereQuestObjectMarkerV145
): THREE.Group {
  const group = new THREE.Group();
  group.name = `${marker.label} ${HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145}`;
  group.position.set(
    marker.position[0],
    marker.position[1],
    marker.position[2]
  );
  group.userData.harthmereQuestObjectMarkerVersion =
    HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145;
  group.userData.harthmereQuestObjectMarkerId = marker.id;

  const text = `${marker.id} ${marker.label}`.toLowerCase();
  const accent = colorForMarkerV145(marker);
  const wood = 0x7a4a2c;
  const darkWood = 0x4f2e1c;
  const parchment = 0xf5e1b4;
  const stone = 0xaeb6bd;

  const base = addCylinderV145(group, 0.62, 0.08, [0, 0.04, 0], accent, 18);
  base.scale.z = 0.72;

  if (/paint/.test(text)) {
    addCylinderV145(group, 0.24, 0.38, [0, 0.28, 0], 0xd6488b, 12);
    addBoxV145(group, [0.1, 0.72, 0.1], [0.32, 0.52, -0.08], wood).rotation.z =
      -0.45;
    addBoxV145(group, [0.34, 0.12, 0.12], [0.48, 0.82, -0.12], accent);
  } else if (/flag|route/.test(text)) {
    addBoxV145(group, [0.12, 1.35, 0.12], [-0.25, 0.72, 0], wood);
    addBoxV145(group, [0.12, 1.1, 0.12], [0.25, 0.58, 0.08], wood);
    addBoxV145(group, [0.56, 0.32, 0.06], [0.04, 1.2, 0.04], accent);
    addBoxV145(group, [0.44, 0.26, 0.06], [0.48, 0.95, 0.12], 0xff7a7a);
  } else if (/dummy|scratch|repair post/.test(text)) {
    addBoxV145(group, [0.26, 1.35, 0.26], [0, 0.72, 0], wood);
    addBoxV145(group, [1.0, 0.18, 0.18], [0, 1.18, 0], darkWood);
    addBoxV145(group, [0.42, 0.42, 0.14], [0, 0.58, 0.18], accent);
  } else if (/crate|basket|satchel|bank/.test(text)) {
    addBoxV145(group, [0.95, 0.52, 0.72], [0, 0.34, 0], darkWood);
    addBoxV145(group, [0.78, 0.1, 0.78], [0, 0.64, 0], accent);
    addBoxV145(group, [0.1, 0.52, 0.78], [-0.34, 0.36, 0], wood);
    addBoxV145(group, [0.1, 0.52, 0.78], [0.34, 0.36, 0], wood);
  } else if (/ledger|board|table|workbench|desk|mirror/.test(text)) {
    addBoxV145(group, [1.25, 0.12, 0.72], [0, 0.78, 0], darkWood);
    addBoxV145(group, [0.14, 0.72, 0.14], [-0.48, 0.42, -0.22], wood);
    addBoxV145(group, [0.14, 0.72, 0.14], [0.48, 0.42, -0.22], wood);
    addBoxV145(group, [0.78, 0.06, 0.48], [0, 0.88, 0.08], parchment);
    addBoxV145(group, [0.56, 0.035, 0.04], [0, 0.93, 0.18], 0x1d2b44);
  } else if (/ring|boundary/.test(text)) {
    const ring = meshV145(new THREE.TorusGeometry(0.72, 0.055, 8, 28), accent);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    group.add(ring);
    addBoxV145(group, [0.12, 0.5, 0.12], [-0.72, 0.32, 0], wood);
    addBoxV145(group, [0.12, 0.5, 0.12], [0.72, 0.32, 0], wood);
  } else if (/berry|muck|stone|material|food|aid|drop/.test(text)) {
    addStoneClusterV145(group, accent, marker.id.length);
  } else if (/firefly|dim/.test(text)) {
    addCylinderV145(group, 0.38, 0.12, [0, 0.18, 0], darkWood, 12);
    for (const [index, offset] of [
      [-0.25, 0.58, 0],
      [0.2, 0.72, 0.18],
      [0.1, 0.5, -0.26],
    ].entries()) {
      addBoxV145(
        group,
        [0.16, 0.16, 0.16],
        offset as [number, number, number],
        index === 1 ? 0xffffff : accent
      );
    }
  } else {
    addBoxV145(group, [0.76, 0.76, 0.76], [0, 0.46, 0], accent);
    addBoxV145(group, [0.42, 0.42, 0.42], [0, 1.04, 0], parchment);
  }

  return group;
}

export function createHarthmereActiveQuestMarkerBeaconV145(): THREE.Group {
  const beacon = new THREE.Group();
  beacon.name = `active-quest-beacon ${HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145}`;
  beacon.visible = false;
  beacon.userData.harthmereActiveQuestBeacon = true;

  const pole = addBoxV145(
    beacon,
    [0.08, 1.55, 0.08],
    [0.72, 0.82, 0.72],
    HARTHMERE_ACTIVE_QUEST_MARKER_BLUE_V145
  );
  pole.userData.harthmereActiveQuestBeaconPart = "pole";

  const cap = addBoxV145(
    beacon,
    [0.26, 0.26, 0.26],
    [0.72, 1.68, 0.72],
    HARTHMERE_ACTIVE_QUEST_MARKER_CAP_V145
  );
  cap.userData.harthmereActiveQuestBeaconPart = "cap";

  return beacon;
}

export class HarthmereQuestObjectMarkersRendererV145 implements Renderer {
  public readonly name = HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145;
  private readonly root = new THREE.Group();
  private readonly activeBeacons = new Map<string, THREE.Group>();
  private activeMarkerId: string | undefined;
  private activeQuestStateRefreshSeconds = 0;
  private elapsedSeconds = 0;

  constructor() {
    this.root.name = `harthmere-quest-object-markers root ${HARTHMERE_QUEST_OBJECT_MARKER_VERSION_V145}`;
    for (const marker of HARTHMERE_QUEST_OBJECT_MARKERS_V145) {
      const mesh = createHarthmereQuestObjectMarkerMeshV145(marker);
      const beacon = createHarthmereActiveQuestMarkerBeaconV145();
      mesh.add(beacon);
      this.activeBeacons.set(marker.id, beacon);
      this.root.add(mesh);
    }
  }

  syncActiveQuestMarkerIdV145(markerId: string | undefined): void {
    // Tests and local-dev quest events can push a known active marker directly.
    // The next render still polls local state, but this short grace period keeps
    // explicit updates from being immediately overwritten in non-browser tests.
    this.activeQuestStateRefreshSeconds =
      ACTIVE_QUEST_BEACON_REFRESH_SECONDS_V145;
    this.applyActiveQuestMarkerIdV145(markerId);
  }

  private refreshActiveQuestMarkerFromLocalStateV145(): void {
    this.applyActiveQuestMarkerIdV145(
      activeHarthmereQuestMarkerIdV145(readSnapshotGroveQuestStateV75())
    );
  }

  private applyActiveQuestMarkerIdV145(markerId: string | undefined): void {
    if (this.activeMarkerId === markerId) {
      return;
    }
    this.activeMarkerId = markerId;
    for (const [id, beacon] of this.activeBeacons) {
      beacon.visible = id === markerId;
      beacon.position.y = 0;
      beacon.rotation.y = 0;
    }
  }

  private animateActiveBeaconsV145(dt: number): void {
    this.elapsedSeconds += dt;
    for (const beacon of this.activeBeacons.values()) {
      if (!beacon.visible) {
        continue;
      }
      beacon.position.y = Math.sin(this.elapsedSeconds * 4) * 0.05;
      beacon.rotation.y = this.elapsedSeconds * 1.2;
    }
  }

  draw(scenes: Scenes, dt: number): void {
    // Like the jobs-board renderer, reattach every frame so reconnects and
    // scene recreation do not strand the props in a stale scene.
    addToScenes(scenes, this.root);
    this.activeQuestStateRefreshSeconds -= dt;
    if (this.activeQuestStateRefreshSeconds <= 0) {
      this.activeQuestStateRefreshSeconds =
        ACTIVE_QUEST_BEACON_REFRESH_SECONDS_V145;
      this.refreshActiveQuestMarkerFromLocalStateV145();
    }
    this.animateActiveBeaconsV145(dt);
  }
}

export function makeHarthmereQuestObjectMarkersRendererV145() {
  return new HarthmereQuestObjectMarkersRendererV145();
}
