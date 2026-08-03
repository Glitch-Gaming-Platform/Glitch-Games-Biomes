import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { freezeStaticObjectMatrices } from "@/client/game/renderers/static_object_matrices";
import type { ClientResources } from "@/client/game/resources/types";
import { loadGltf } from "@/client/game/util/gltf_helpers";
import { harthmereRequestBoardPhysicalPromptRecords } from "@/shared/harthmere/native_request_board_locations";
import {
  HARTHMERE_REQUEST_BOARD_GRAPHIC_LOD_POLICY,
  harthmereRequestBoardGraphic,
  harthmereWorldInteractionGraphicLod,
  type HarthmereRequestBoardGraphicVariant,
  type HarthmereWorldInteractionGraphicLod,
} from "@/shared/harthmere/world_interaction_graphics";
import { log } from "@/shared/logging";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export const HARTHMERE_REQUEST_BOARD_MARKER_VERSION =
  "harthmere-request-board-blender-lod-v1" as const;
export const HARTHMERE_REQUEST_BOARD_GRAPHIC_VERSION =
  "harthmere-request-board-category-graphics-v1" as const;
export const HARTHMERE_REQUEST_BOARD_FRONT_FLIP_YAW = Math.PI;

const ACCENT_BY_VARIANT: Readonly<
  Record<HarthmereRequestBoardGraphicVariant, number>
> = Object.freeze({
  fishing: 0x1f7ab8,
  farming: 0x5c9e2e,
  industrial: 0xc75c1a,
  research: 0x7347c2,
});

export interface HarthmereRequestBoardMarkerLocation {
  readonly id: string;
  readonly entityId: number;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly variant: HarthmereRequestBoardGraphicVariant;
  readonly accentColor: number;
}

export const HARTHMERE_REQUEST_BOARD_MARKER_LOCATIONS:
  readonly HarthmereRequestBoardMarkerLocation[] =
  harthmereRequestBoardPhysicalPromptRecords().map((board) => ({
    id: board.boardId,
    entityId: board.boardEntityId,
    label: board.displayName,
    x: board.position.x,
    y: board.position.y,
    z: board.position.z,
    variant: board.category,
    accentColor: ACCENT_BY_VARIANT[board.category],
  }));

function fallbackMaterial(color: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.02,
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

/** Cheap but still landmark-sized fallback if a category GLB cannot load. */
export function createHarthmereRequestBoardFallback(
  location: HarthmereRequestBoardMarkerLocation
) {
  const group = new THREE.Group();
  group.name = `${location.label} request-board load-failure fallback`;
  group.position.set(location.x, location.y, location.z);
  group.rotation.y = HARTHMERE_REQUEST_BOARD_FRONT_FLIP_YAW;
  const wood = fallbackMaterial(0x4a3020);
  const face = fallbackMaterial(0x6f4d30);
  const accent = fallbackMaterial(location.accentColor);
  const paper = fallbackMaterial(0xe2ca93);
  fallbackBox(group, "fallback foot", [6.5, 0.24, 0.9], [0, 0.12, 0], accent);
  for (const x of [-2.65, 2.65]) {
    fallbackBox(group, "fallback post", [0.38, 6.0, 0.34], [x, 3.05, 0], wood);
  }
  fallbackBox(group, "fallback face", [5.7, 4.1, 0.34], [0, 3.35, 0], face);
  fallbackBox(group, "fallback header", [4.2, 0.82, 0.42], [0, 5.58, 0], accent);
  fallbackBox(group, "fallback roof", [6.55, 0.34, 1.0], [0, 6.30, 0], wood);
  for (const x of [-1.7, 0, 1.7]) {
    fallbackBox(group, "fallback notice", [1.18, 1.35, 0.08], [x, 3.4, -0.22], paper);
  }
  group.userData.harthmereRequestBoardFallback = true;
  group.userData.harthmereRequestBoardMarkerId = location.id;
  group.userData.harthmereRequestBoardVariant = location.variant;
  return group;
}

type RequestBoardVisual = {
  location: HarthmereRequestBoardMarkerLocation;
  anchor: THREE.Group;
  lod0?: THREE.Object3D;
  lod1?: THREE.Object3D;
  fallback?: THREE.Group;
  activeLod: HarthmereWorldInteractionGraphicLod;
  requested: Set<"lod0" | "lod1">;
};

function prepareBoardClone(
  location: HarthmereRequestBoardMarkerLocation,
  root: THREE.Object3D,
  lod: "lod0" | "lod1"
) {
  root.name = `${location.label} Blender ${lod}`;
  root.visible = false;
  root.userData.harthmereRequestBoardMarkerVersion =
    HARTHMERE_REQUEST_BOARD_MARKER_VERSION;
  root.userData.harthmereRequestBoardGraphicVersion =
    HARTHMERE_REQUEST_BOARD_GRAPHIC_VERSION;
  root.userData.harthmereRequestBoardGraphicSource = "blender_glb";
  root.userData.harthmereRequestBoardMarkerId = location.id;
  root.userData.harthmereRequestBoardVariant = location.variant;
  root.userData.harthmereRequestBoardLod = lod;
  root.traverse((child) => {
    child.userData.harthmereRequestBoardMarkerId = location.id;
    child.userData.harthmereRequestBoardVariant = location.variant;
    child.userData.harthmereRequestBoardLod = lod;
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
      child.frustumCulled = true;
    }
  });
  freezeStaticObjectMatrices(root);
  return root;
}

export class HarthmereRequestBoardMarkerRenderer implements Renderer {
  public readonly name = HARTHMERE_REQUEST_BOARD_MARKER_VERSION;
  private readonly root = new THREE.Group();
  private readonly visuals: RequestBoardVisual[] = [];
  private readonly templatePromises = new Map<
    string,
    Promise<THREE.Object3D>
  >();
  private lodRefreshSeconds = 0;

  constructor(
    private readonly resources?: ClientResources,
    private readonly load: (url: string) => Promise<GLTF> = loadGltf
  ) {
    this.root.name = `harthmere request-board graphics ${HARTHMERE_REQUEST_BOARD_MARKER_VERSION}`;
    for (const location of HARTHMERE_REQUEST_BOARD_MARKER_LOCATIONS) {
      const anchor = new THREE.Group();
      anchor.name = `${location.label} request-board anchor`;
      anchor.position.set(location.x, location.y, location.z);
      anchor.rotation.y = HARTHMERE_REQUEST_BOARD_FRONT_FLIP_YAW;
      anchor.visible = false;
      anchor.userData.harthmereRequestBoardMarkerId = location.id;
      anchor.userData.harthmereRequestBoardVariant = location.variant;
      this.root.add(anchor);
      this.visuals.push({
        location,
        anchor,
        activeLod: "hidden",
        requested: new Set(),
      });
    }
    this.publishDebugBridge();
  }

  draw(scenes: Scenes, dt: number): void {
    scenes.three.add(this.root);
    this.lodRefreshSeconds -= Math.min(dt, 0.25);
    if (this.lodRefreshSeconds <= 0) {
      this.lodRefreshSeconds = 0.1;
      this.updateLods();
    }
  }

  private cameraPosition() {
    return this.resources?.get("/scene/camera").three.position;
  }

  private drawDistance() {
    return (
      this.resources?.get("/settings/graphics/dynamic").drawDistance ??
      HARTHMERE_REQUEST_BOARD_GRAPHIC_LOD_POLICY.hiddenBeyondMeters
    );
  }

  private updateLods() {
    const camera = this.cameraPosition();
    if (!camera) return;
    const hiddenBeyond = Math.min(
      this.drawDistance(),
      HARTHMERE_REQUEST_BOARD_GRAPHIC_LOD_POLICY.hiddenBeyondMeters
    );
    for (const visual of this.visuals) {
      const distance = Math.hypot(
        visual.location.x - camera.x,
        visual.location.y - camera.y,
        visual.location.z - camera.z
      );
      const desired =
        distance > hiddenBeyond
          ? "hidden"
          : harthmereWorldInteractionGraphicLod(
              distance,
              HARTHMERE_REQUEST_BOARD_GRAPHIC_LOD_POLICY
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
        desired !== "hidden" && !!(available || visual.fallback);
      if (visual.lod0) visual.lod0.visible = available === visual.lod0;
      if (visual.lod1) visual.lod1.visible = available === visual.lod1;
      if (visual.fallback) visual.fallback.visible = !available;
    }
  }

  private template(
    variant: HarthmereRequestBoardGraphicVariant,
    lod: "lod0" | "lod1"
  ) {
    const key = `${variant}:${lod}`;
    let promise = this.templatePromises.get(key);
    if (!promise) {
      const graphic = harthmereRequestBoardGraphic(variant);
      promise = this.load(graphic.assets[lod]).then((gltf) => {
        freezeStaticObjectMatrices(gltf.scene);
        return gltf.scene;
      });
      this.templatePromises.set(key, promise);
    }
    return promise;
  }

  private async ensureLod(
    visual: RequestBoardVisual,
    lod: "lod0" | "lod1"
  ) {
    if (visual.requested.has(lod) || visual[lod]) return;
    visual.requested.add(lod);
    try {
      const template = await this.template(visual.location.variant, lod);
      const root = prepareBoardClone(
        visual.location,
        template.clone(true),
        lod
      );
      visual[lod] = root;
      visual.anchor.add(root);
      this.updateLods();
    } catch (error) {
      if (!visual.fallback) {
        const fallback = createHarthmereRequestBoardFallback({
          ...visual.location,
          x: 0,
          y: 0,
          z: 0,
        });
        fallback.rotation.set(0, 0, 0);
        visual.fallback = fallback;
        visual.anchor.add(fallback);
      }
      log.error("Failed to load Harthmere request-board Blender graphic", {
        boardId: visual.location.id,
        variant: visual.location.variant,
        lod,
        error,
      });
    }
  }

  private publishDebugBridge() {
    if (typeof window === "undefined") return;
    (window as any).__harthmereRequestBoardMarkerDebug = {
      version: HARTHMERE_REQUEST_BOARD_MARKER_VERSION,
      graphicVersion: HARTHMERE_REQUEST_BOARD_GRAPHIC_VERSION,
      boards: () =>
        this.visuals.map((visual) => ({
          id: visual.location.id,
          entityId: visual.location.entityId,
          label: visual.location.label,
          variant: visual.location.variant,
          position: [visual.location.x, visual.location.y, visual.location.z],
          activeLod: visual.activeLod,
          visible: visual.anchor.visible,
          lod0Loaded: !!visual.lod0,
          lod1Loaded: !!visual.lod1,
          fallback: !!visual.fallback,
        })),
    };
  }
}

export function makeHarthmereRequestBoardMarkerRenderer(
  resources?: ClientResources
) {
  return new HarthmereRequestBoardMarkerRenderer(resources);
}
