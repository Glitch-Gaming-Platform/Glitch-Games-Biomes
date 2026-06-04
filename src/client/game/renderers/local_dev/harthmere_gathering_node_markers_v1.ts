// HARTHMERE_GATHERING_NODE_MARKERS_V1: small procedural, terrain-grounded
// resource nodes drawn at every Harthmere gathering position. Before this, the
// gathering "nodes" only existed as rows in a HUD menu — a quest marker would
// point a player at empty ground. These give each node a real, visible body the
// player can walk up to and harvest (the F-prompt lives in
// HarthmereGatheringNodeWorldInteractionV1). Grounding mirrors the quest-object
// marker renderer so nodes rest on the surface instead of floating/sinking.
import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";
import { groundHarthmereLiveEntityFeetYWithStatusV1 } from "@/client/game/util/harthmere_entity_grounding";
import {
  HARTHMERE_GATHERING_NODE_WORLD_TARGETS_V1,
  type HarthmereGatheringNodeWorldTargetV1,
} from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import * as THREE from "three";

export const HARTHMERE_GATHERING_NODE_MARKER_VERSION_V1 =
  "harthmere-gathering-node-markers-v1" as const;

// Accent per profession so a player can read what a node is from a distance.
const GATHERING_PROFESSION_ACCENTS_V1: Record<string, number> = {
  mining: 0x9da6ad,
  woodcutting: 0x8ce99a,
  herbalism: 0x7bd88f,
  fishing: 0x4cc9ff,
  scavenging: 0xffb74d,
  archaeology: 0xe5c78d,
  magical_harvesting: 0xb197fc,
  skinning: 0xff8fab,
};

function material(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1,
  });
}

function box(
  group: THREE.Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  mat: THREE.MeshBasicMaterial
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.frustumCulled = false;
  group.add(mesh);
  return mesh;
}

export function createHarthmereGatheringNodeMeshV1(
  target: HarthmereGatheringNodeWorldTargetV1
): THREE.Group {
  const group = new THREE.Group();
  group.name = `${target.name} ${HARTHMERE_GATHERING_NODE_MARKER_VERSION_V1}`;
  group.position.set(target.position[0], target.position[1], target.position[2]);

  const accentHex =
    GATHERING_PROFESSION_ACCENTS_V1[target.profession] ?? 0xffd54f;
  const accent = new THREE.Color(accentHex);
  const mats = {
    stone: material(0x7c7f86),
    dark: material(0x2a2f3a),
    accent: material(accentHex),
    glow: material(accent.clone().lerp(new THREE.Color(0xffffff), 0.45).getHex()),
  };

  // Low rocky base + a short stalk capped by a glowing accent crystal. Small
  // enough not to block movement, tall enough to spot from the marker beacon.
  box(group, "Gathering node base", [0.9, 0.24, 0.9], [0, 0.12, 0], mats.stone);
  box(group, "Gathering node rim", [0.62, 0.12, 0.62], [0, 0.3, 0], mats.dark);
  box(group, "Gathering node stalk", [0.22, 0.62, 0.22], [0, 0.62, 0], mats.accent);
  const crystal = box(
    group,
    "Gathering node crystal",
    [0.34, 0.34, 0.34],
    [0, 1.04, 0],
    mats.glow
  );
  crystal.rotation.set(0.6, 0.4, 0.3);

  const light = new THREE.PointLight(accentHex, 0.55, 6, 1.8);
  light.name = "Gathering node glow";
  light.position.set(0, 1.0, 0);
  group.add(light);

  // World XZ + authored Y hint used by per-frame terrain grounding.
  group.userData.harthmereGatheringNodeId = target.id;
  group.userData.harthmereGatheringNodeWorldXZ = [
    target.position[0],
    target.position[2],
  ];
  group.userData.harthmereGatheringNodeHintY = target.position[1];
  group.traverse((child) => {
    child.userData.harthmereGatheringNodeId = target.id;
  });
  return group;
}

export class HarthmereGatheringNodeMarkerRendererV1 implements Renderer {
  public readonly name = HARTHMERE_GATHERING_NODE_MARKER_VERSION_V1;
  private readonly root = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Group>();

  constructor(private readonly resources?: ClientResources) {
    this.root.name = `harthmere-gathering-node-markers root ${HARTHMERE_GATHERING_NODE_MARKER_VERSION_V1}`;
    for (const target of HARTHMERE_GATHERING_NODE_WORLD_TARGETS_V1) {
      const mesh = createHarthmereGatheringNodeMeshV1(target);
      this.meshes.set(target.id, mesh);
      this.root.add(mesh);
    }
  }

  draw(scenes: Scenes, _dt: number): void {
    addToScenes(scenes, this.root);
    this.groundNodesV1();
  }

  // Rest each node on the real terrain surface (cave-safe + water-aware). If the
  // terrain at a node hasn't streamed in yet, hide it for that frame rather than
  // showing it at the flat authored Y (which is what made props float/sink).
  private groundNodesV1(): void {
    if (!this.resources) {
      return;
    }
    for (const mesh of this.meshes.values()) {
      const xz = mesh.userData.harthmereGatheringNodeWorldXZ as
        | [number, number]
        | undefined;
      const hintY = mesh.userData.harthmereGatheringNodeHintY as
        | number
        | undefined;
      if (!xz || hintY === undefined) {
        continue;
      }
      const result = groundHarthmereLiveEntityFeetYWithStatusV1(
        this.resources,
        xz[0],
        xz[1],
        hintY,
        true
      );
      if (result.status === "grounded" && result.feetY !== undefined) {
        mesh.position.y = result.feetY;
        mesh.visible = true;
      } else if (result.status === "not-loaded") {
        mesh.visible = false;
      } else {
        // "no-surface": keep the authored Y as a best-effort fallback.
        mesh.visible = true;
      }
    }
  }
}

export function makeHarthmereGatheringNodeMarkersRendererV1(
  resources?: ClientResources
) {
  return new HarthmereGatheringNodeMarkerRendererV1(resources);
}
