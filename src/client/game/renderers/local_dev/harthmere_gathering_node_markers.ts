// Blender-authored, terrain-grounded resource graphics for every authoritative
// Harthmere gathering node. F interaction, tool/skill validation, yields,
// respawn, and ownership remain in the existing server authority and
// HarthmereGatheringNodeWorldInteraction; this renderer is presentation only.
import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { freezeStaticObjectMatrices } from "@/client/game/renderers/static_object_matrices";
import type { ClientResources } from "@/client/game/resources/types";
import { harthmereGroundedFeetYWithMemory } from "@/client/game/util/harthmere_entity_grounding";
import { loadGltf } from "@/client/game/util/gltf_helpers";
import {
  HARTHMERE_GATHERING_NODE_WORLD_TARGETS,
  type HarthmereGatheringNodeWorldTarget,
} from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import { HARTHMERE_GATHERING_NODE_VISUAL_RESPAWN_EVENT } from "@/client/components/challenges/harthmereGatheringLiveAuthority";
import {
  HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY,
  HARTHMERE_GATHERING_NODE_GROW_IN_SECONDS,
  harthmereGatheringNodeGrowInTransform,
  harthmereGatheringNodeGraphic,
  harthmereWorldInteractionGraphicLod,
  type HarthmereWorldInteractionGraphicLod,
} from "@/shared/harthmere/world_interaction_graphics";
import { log } from "@/shared/logging";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export const HARTHMERE_GATHERING_NODE_MARKER_VERSION =
  "harthmere-gathering-node-blender-lod-grow-in-v2" as const;

type GatheringNodeVisual = {
  target: HarthmereGatheringNodeWorldTarget;
  anchor: THREE.Group;
  content: THREE.Group;
  lod0?: THREE.Object3D;
  lod1?: THREE.Object3D;
  fallback?: THREE.Group;
  activeLod: HarthmereWorldInteractionGraphicLod;
  groundKnown: boolean;
  requested: Set<"lod0" | "lod1">;
  failed: boolean;
  growInElapsedSeconds?: number;
  growInComplete: boolean;
  respawnAtMs?: number;
};

function fallbackMaterial(color: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.05,
  });
}

function fallbackBox(
  group: THREE.Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  group.add(mesh);
}

/** Cheap load-failure fallback. It is never the normal presentation path. */
export function createHarthmereGatheringNodeMesh(
  target: HarthmereGatheringNodeWorldTarget
): THREE.Group {
  const group = new THREE.Group();
  group.name = `${target.name} gathering load-failure fallback`;
  const base = fallbackMaterial(0x6d7478);
  const professionColor: Record<string, number> = {
    mining: 0xb6a06d,
    logging: 0x6f9a5a,
    herbalism: 0x83b76d,
    fishing: 0x4f9fbd,
    farming: 0xc8a457,
    scavenging: 0xb56f42,
    archaeology: 0xd0b77a,
    magical_harvesting: 0x9a67cf,
    skinning: 0xa86d60,
    monster_harvesting: 0x748b52,
  };
  const accent = fallbackMaterial(
    professionColor[target.profession] ?? 0xd3a84f
  );
  fallbackBox(group, "fallback base", [1.2, 0.18, 1.0], [0, 0.09, 0], base);
  fallbackBox(
    group,
    "fallback identity",
    [0.62, 0.52, 0.62],
    [0, 0.43, 0],
    accent
  );
  group.userData.harthmereGatheringNodeFallback = true;
  return group;
}

function prepareLoadedNode(
  target: HarthmereGatheringNodeWorldTarget,
  root: THREE.Object3D,
  lod: "lod0" | "lod1"
) {
  root.name = `${target.name} Blender ${lod}`;
  root.visible = false;
  root.userData.harthmereGatheringNodeId = target.id;
  root.userData.harthmereGatheringNodeLod = lod;
  root.userData.harthmereGatheringGraphicSource = "blender_glb";
  root.traverse((child) => {
    child.userData.harthmereGatheringNodeId = target.id;
    child.userData.harthmereGatheringNodeLod = lod;
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
      child.frustumCulled = true;
    }
  });
  freezeStaticObjectMatrices(root);
  return root;
}

export class HarthmereGatheringNodeMarkerRenderer implements Renderer {
  public readonly name = HARTHMERE_GATHERING_NODE_MARKER_VERSION;
  private readonly root = new THREE.Group();
  private readonly visuals = new Map<string, GatheringNodeVisual>();
  private readonly groundedFeetYByColumn = new Map<string, number>();
  private groundRefreshSeconds = 0;
  private lodRefreshSeconds = 0;

  constructor(
    private readonly resources?: ClientResources,
    private readonly load: (url: string) => Promise<GLTF> = loadGltf
  ) {
    this.root.name = `harthmere gathering graphics ${HARTHMERE_GATHERING_NODE_MARKER_VERSION}`;
    for (const target of HARTHMERE_GATHERING_NODE_WORLD_TARGETS) {
      const anchor = new THREE.Group();
      const content = new THREE.Group();
      anchor.name = `${target.name} gathering anchor`;
      content.name = `${target.name} gathering grow-in content`;
      anchor.position.set(
        target.position[0],
        target.position[1],
        target.position[2]
      );
      anchor.visible = false;
      anchor.userData.harthmereGatheringNodeId = target.id;
      anchor.userData.harthmereGatheringNodeWorldXZ = [
        target.position[0],
        target.position[2],
      ];
      anchor.userData.harthmereGatheringNodeHintY = target.position[1];
      anchor.add(content);
      this.root.add(anchor);
      this.visuals.set(target.id, {
        target,
        anchor,
        content,
        activeLod: "hidden",
        groundKnown: !resources,
        requested: new Set(),
        failed: false,
        growInComplete: false,
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener(
        HARTHMERE_GATHERING_NODE_VISUAL_RESPAWN_EVENT,
        this.onVisualRespawn
      );
    }
    this.publishDebugBridge();
  }

  draw(scenes: Scenes, dt: number): void {
    scenes.three.add(this.root);
    this.groundRefreshSeconds -= Math.min(dt, 0.25);
    this.lodRefreshSeconds -= Math.min(dt, 0.25);
    if (this.groundRefreshSeconds <= 0) {
      this.groundRefreshSeconds = 0.25;
      this.groundNodes();
    }
    if (this.lodRefreshSeconds <= 0) {
      this.lodRefreshSeconds = 0.1;
      this.updateLods();
    }
    this.updateGrowIn(dt);
  }

  private onVisualRespawn = (event: Event) => {
    const detail = (event as CustomEvent).detail as
      { nodeId?: string; respawnAtMs?: number } | undefined;
    const visual = detail?.nodeId ? this.visuals.get(detail.nodeId) : undefined;
    const respawnAtMs = Number(detail?.respawnAtMs);
    if (!visual || !Number.isFinite(respawnAtMs) || respawnAtMs <= Date.now()) {
      return;
    }
    visual.respawnAtMs = Math.trunc(respawnAtMs);
    visual.growInElapsedSeconds = undefined;
    visual.growInComplete = false;
    visual.anchor.visible = false;
  };

  private updateGrowIn(dt: number) {
    const step = Math.min(Math.max(dt, 0), 0.1);
    for (const visual of this.visuals.values()) {
      if (
        visual.growInElapsedSeconds === undefined ||
        visual.growInComplete ||
        !visual.anchor.visible
      ) {
        continue;
      }
      visual.growInElapsedSeconds = Math.min(
        HARTHMERE_GATHERING_NODE_GROW_IN_SECONDS,
        visual.growInElapsedSeconds + step
      );
      const progress =
        visual.growInElapsedSeconds / HARTHMERE_GATHERING_NODE_GROW_IN_SECONDS;
      const transform = harthmereGatheringNodeGrowInTransform(progress);
      visual.content.position.y = transform.y;
      visual.content.scale.set(
        transform.scaleXZ,
        transform.scaleY,
        transform.scaleXZ
      );
      if (progress >= 1) {
        visual.content.position.y = 0;
        visual.content.scale.set(1, 1, 1);
        visual.growInComplete = true;
      }
    }
  }

  private cameraPosition() {
    return this.resources?.get("/scene/camera").three.position;
  }

  private drawDistance() {
    return (
      this.resources?.get("/settings/graphics/dynamic").drawDistance ??
      HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY.hiddenBeyondMeters
    );
  }

  private groundNodes() {
    if (!this.resources) return;
    const camera = this.cameraPosition();
    if (!camera) return;
    const maxDistance = Math.min(
      this.drawDistance(),
      HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY.hiddenBeyondMeters
    );
    const maxDistanceSq = maxDistance * maxDistance;
    for (const visual of this.visuals.values()) {
      const [x, , z] = visual.target.position;
      const dx = x - camera.x;
      const dz = z - camera.z;
      if (dx * dx + dz * dz > maxDistanceSq) {
        visual.groundKnown = false;
        visual.anchor.visible = false;
        continue;
      }
      const feetY = harthmereGroundedFeetYWithMemory(
        this.resources,
        this.groundedFeetYByColumn,
        x,
        z,
        visual.target.position[1],
        true
      );
      visual.groundKnown = feetY !== undefined;
      if (feetY !== undefined) visual.anchor.position.y = feetY;
    }
  }

  private updateLods() {
    const camera = this.cameraPosition();
    if (!camera) return;
    const hiddenBeyond = Math.min(
      this.drawDistance(),
      HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY.hiddenBeyondMeters
    );
    for (const visual of this.visuals.values()) {
      const nowMs = Date.now();
      const depleted =
        visual.respawnAtMs !== undefined && visual.respawnAtMs > nowMs;
      if (visual.respawnAtMs !== undefined && !depleted) {
        visual.respawnAtMs = undefined;
        visual.growInElapsedSeconds = 0;
        visual.growInComplete = false;
        const transform = harthmereGatheringNodeGrowInTransform(0);
        visual.content.position.y = transform.y;
        visual.content.scale.set(
          transform.scaleXZ,
          transform.scaleY,
          transform.scaleXZ
        );
      }
      const distance = Math.hypot(
        visual.target.position[0] - camera.x,
        visual.target.position[2] - camera.z
      );
      const desired =
        distance > hiddenBeyond
          ? "hidden"
          : harthmereWorldInteractionGraphicLod(
              distance,
              HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY
            );
      if (desired !== "hidden") void this.ensureLod(visual, desired);
      const available =
        desired === "lod0"
          ? (visual.lod0 ?? visual.lod1)
          : desired === "lod1"
            ? (visual.lod1 ?? visual.lod0)
            : undefined;
      visual.activeLod = available
        ? available === visual.lod0
          ? "lod0"
          : "lod1"
        : desired;
      visual.anchor.visible =
        !depleted &&
        desired !== "hidden" &&
        visual.groundKnown &&
        !!(available || visual.fallback);
      if (
        visual.anchor.visible &&
        !visual.growInComplete &&
        visual.growInElapsedSeconds === undefined
      ) {
        visual.growInElapsedSeconds = 0;
        const transform = harthmereGatheringNodeGrowInTransform(0);
        visual.content.position.y = transform.y;
        visual.content.scale.set(
          transform.scaleXZ,
          transform.scaleY,
          transform.scaleXZ
        );
      }
      if (visual.lod0) visual.lod0.visible = available === visual.lod0;
      if (visual.lod1) visual.lod1.visible = available === visual.lod1;
      if (visual.fallback) visual.fallback.visible = !available;
    }
  }

  private async ensureLod(visual: GatheringNodeVisual, lod: "lod0" | "lod1") {
    if (visual.requested.has(lod) || visual.failed || visual[lod]) return;
    const graphic = harthmereGatheringNodeGraphic(visual.target.id);
    if (!graphic) {
      this.installFallback(visual, "missing_manifest_record");
      return;
    }
    visual.requested.add(lod);
    try {
      const gltf = await this.load(graphic.assets[lod]);
      const root = prepareLoadedNode(visual.target, gltf.scene, lod);
      visual[lod] = root;
      visual.content.add(root);
      this.updateLods();
    } catch (error) {
      this.installFallback(visual, "load_failed", error);
    }
  }

  private installFallback(
    visual: GatheringNodeVisual,
    reason: string,
    error?: unknown
  ) {
    visual.failed = true;
    if (!visual.fallback) {
      visual.fallback = createHarthmereGatheringNodeMesh(visual.target);
      visual.content.add(visual.fallback);
    }
    log.error("Failed to load Harthmere gathering-node Blender graphic", {
      nodeId: visual.target.id,
      reason,
      error,
    });
  }

  private publishDebugBridge() {
    if (typeof window === "undefined") return;
    (window as any).__harthmereGatheringNodeGraphics = {
      version: HARTHMERE_GATHERING_NODE_MARKER_VERSION,
      expectedCount: HARTHMERE_GATHERING_NODE_WORLD_TARGETS.length,
      nodes: () =>
        [...this.visuals.values()].map((visual) => ({
          nodeId: visual.target.id,
          name: visual.target.name,
          profession: visual.target.profession,
          activeLod: visual.activeLod,
          visible: visual.anchor.visible,
          grounded: visual.groundKnown,
          lod0Loaded: !!visual.lod0,
          lod1Loaded: !!visual.lod1,
          fallback: !!visual.fallback,
          growInComplete: visual.growInComplete,
          growInProgress:
            visual.growInElapsedSeconds === undefined
              ? 0
              : Math.min(
                  1,
                  visual.growInElapsedSeconds /
                    HARTHMERE_GATHERING_NODE_GROW_IN_SECONDS
                ),
          depleted:
            visual.respawnAtMs !== undefined && visual.respawnAtMs > Date.now(),
          respawnAtMs: visual.respawnAtMs,
          worldPosition: visual.anchor.position.toArray(),
        })),
    };
  }
}

export function makeHarthmereGatheringNodeMarkersRenderer(
  resources?: ClientResources
) {
  return new HarthmereGatheringNodeMarkerRenderer(resources);
}
