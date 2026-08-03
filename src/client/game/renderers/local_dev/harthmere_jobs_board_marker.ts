// Blender-authored physical graphics for the Grove, Harthmere, and 19 business
// jobs boards. Board authority/proximity/F interaction remains unchanged. The
// old hundreds-of-BoxGeometry procedural implementation is retained only as a
// cheap landmark-scale load-failure fallback.
import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { freezeStaticObjectMatrices } from "@/client/game/renderers/static_object_matrices";
import type { ClientResources } from "@/client/game/resources/types";
import { loadGltf } from "@/client/game/util/gltf_helpers";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostJobsBoardPosition,
} from "@/shared/harthmere/business_customer_simulator";
import { HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION } from "@/shared/harthmere/mmo_jobs_board_authority";
import {
  HARTHMERE_JOBS_BOARD_GRAPHIC_LOD_POLICY,
  harthmereJobsBoardGraphic,
  harthmereWorldInteractionGraphicLod,
  type HarthmereJobsBoardGraphicVariant,
  type HarthmereWorldInteractionGraphicLod,
} from "@/shared/harthmere/world_interaction_graphics";
import { log } from "@/shared/logging";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export const HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION =
  "harthmere-jobs-board-blender-lod-v1" as const;
export const HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION =
  "harthmere-jobs-board-blender-polish-v1" as const;
export const HARTHMERE_JOBS_BOARD_WANTED_NOTICE_GRAPHIC_VERSION =
  "harthmere-jobs-board-notice-layout-blender-v1" as const;
export const HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW = Math.PI;
export const HARTHMERE_BUSINESS_JOBS_BOARD_FRONT_YAW = 0;

export interface HarthmereJobsBoardMarkerLocation {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  accentColor: number;
  variant: HarthmereJobsBoardGraphicVariant;
  yaw: number;
}

const BOARD_VARIANTS: readonly HarthmereJobsBoardGraphicVariant[] = [
  "blue",
  "amber",
  "rose",
  "green",
  "violet",
];

export const HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS: readonly HarthmereJobsBoardMarkerLocation[] =
  [
    {
      id: "harthmere_grove_market_jobs_board",
      label: "Grove Jobs Board",
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
      accentColor: 0x4cc9ff,
      variant: "blue",
      yaw: HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW,
    },
    {
      id: "harthmere_town_market_jobs_board",
      label: "Harthmere Jobs Board",
      x: HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[0],
      y: HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[1],
      z: HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[2],
      accentColor: 0xffb74d,
      variant: "amber",
      yaw: HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW,
    },
    ...HARTHMERE_BUSINESS_OUTPOSTS.map((outpost, index) => {
      const position = harthmereBusinessOutpostJobsBoardPosition(outpost);
      const variant = BOARD_VARIANTS[index % BOARD_VARIANTS.length];
      const accentByVariant: Record<HarthmereJobsBoardGraphicVariant, number> =
        {
          blue: 0x4cc9ff,
          amber: 0xffb74d,
          rose: 0xf472b6,
          green: 0x84cc16,
          violet: 0xc084fc,
        };
      return {
        id: `${outpost.outpostId}_jobs_board`,
        label: `${outpost.displayName} Jobs Board`,
        x: position.x,
        y: position.y,
        z: position.z,
        accentColor: accentByVariant[variant],
        variant,
        // Business boards were presenting the blank back toward their
        // approach/interact point. Flip only these 19 instances; Grove and the
        // Harthmere town board retain their established orientation above.
        yaw: HARTHMERE_BUSINESS_JOBS_BOARD_FRONT_YAW,
      } satisfies HarthmereJobsBoardMarkerLocation;
    }),
  ];

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

/** Cheap fallback used only when the optimized GLB cannot load. */
export function createHarthmereJobsBoardKioskMesh(
  location: HarthmereJobsBoardMarkerLocation
): THREE.Group {
  const group = new THREE.Group();
  group.name = `${location.label} jobs-board load-failure fallback`;
  group.position.set(location.x, location.y, location.z);
  group.rotation.y = location.yaw;
  const wood = fallbackMaterial(0x4a3020);
  const face = fallbackMaterial(0x8b6441);
  const accent = fallbackMaterial(location.accentColor);
  const paper = fallbackMaterial(0xe1c994);
  fallbackBox(group, "fallback foot", [6.6, 0.22, 0.8], [0, 0.11, 0], accent);
  for (const x of [-2.65, 2.65]) {
    fallbackBox(group, "fallback post", [0.34, 6.0, 0.32], [x, 3.05, 0], wood);
  }
  fallbackBox(group, "fallback board", [5.65, 4.25, 0.28], [0, 3.35, 0], face);
  fallbackBox(group, "fallback roof", [6.4, 0.3, 0.92], [0, 6.25, 0], wood);
  fallbackBox(
    group,
    "fallback notice",
    [1.05, 1.35, 0.05],
    [-1.65, 3.65, 0.18],
    paper
  );
  fallbackBox(
    group,
    "fallback notice",
    [1.05, 1.35, 0.05],
    [0, 3.65, 0.18],
    paper
  );
  fallbackBox(
    group,
    "fallback notice",
    [1.05, 1.35, 0.05],
    [1.65, 3.65, 0.18],
    accent
  );
  group.userData.harthmereJobsBoardFallback = true;
  group.userData.harthmereJobsBoardMarkerId = location.id;
  return group;
}

type JobsBoardVisual = {
  location: HarthmereJobsBoardMarkerLocation;
  anchor: THREE.Group;
  lod0?: THREE.Object3D;
  lod1?: THREE.Object3D;
  fallback?: THREE.Group;
  activeLod: HarthmereWorldInteractionGraphicLod;
  requested: Set<"lod0" | "lod1">;
};

function prepareBoardClone(
  location: HarthmereJobsBoardMarkerLocation,
  root: THREE.Object3D,
  lod: "lod0" | "lod1"
) {
  root.name = `${location.label} Blender ${lod}`;
  root.visible = false;
  root.userData.harthmereJobsBoardMarkerVersion =
    HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION;
  root.userData.harthmereJobsBoardPolishVersion =
    HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION;
  root.userData.harthmereJobsBoardGraphicVersion =
    HARTHMERE_JOBS_BOARD_WANTED_NOTICE_GRAPHIC_VERSION;
  root.userData.harthmereJobsBoardGraphicSource = "blender_glb";
  root.userData.harthmereJobsBoardMarkerId = location.id;
  root.userData.harthmereJobsBoardLod = lod;
  root.traverse((child) => {
    child.userData.harthmereJobsBoardMarkerId = location.id;
    child.userData.harthmereJobsBoardLod = lod;
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
      child.frustumCulled = true;
    }
  });
  freezeStaticObjectMatrices(root);
  return root;
}

export class HarthmereJobsBoardMarkerRenderer implements Renderer {
  public readonly name = HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION;
  private readonly root = new THREE.Group();
  private readonly visuals: JobsBoardVisual[] = [];
  private readonly templatePromises = new Map<
    string,
    Promise<THREE.Object3D>
  >();
  private lodRefreshSeconds = 0;

  constructor(
    private readonly resources?: ClientResources,
    private readonly load: (url: string) => Promise<GLTF> = loadGltf
  ) {
    this.root.name = `harthmere jobs-board graphics ${HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION}`;
    for (const location of HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS) {
      const anchor = new THREE.Group();
      anchor.name = `${location.label} jobs-board anchor`;
      anchor.position.set(location.x, location.y, location.z);
      anchor.rotation.y = location.yaw;
      anchor.visible = false;
      anchor.userData.harthmereJobsBoardMarkerId = location.id;
      anchor.userData.harthmereJobsBoardVariant = location.variant;
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
      HARTHMERE_JOBS_BOARD_GRAPHIC_LOD_POLICY.hiddenBeyondMeters
    );
  }

  private updateLods() {
    const camera = this.cameraPosition();
    if (!camera) return;
    const hiddenBeyond = Math.min(
      this.drawDistance(),
      HARTHMERE_JOBS_BOARD_GRAPHIC_LOD_POLICY.hiddenBeyondMeters
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
              HARTHMERE_JOBS_BOARD_GRAPHIC_LOD_POLICY
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
    variant: HarthmereJobsBoardGraphicVariant,
    lod: "lod0" | "lod1"
  ) {
    const key = `${variant}:${lod}`;
    let promise = this.templatePromises.get(key);
    if (!promise) {
      const graphic = harthmereJobsBoardGraphic(variant);
      promise = this.load(graphic.assets[lod]).then((gltf) => {
        freezeStaticObjectMatrices(gltf.scene);
        return gltf.scene;
      });
      this.templatePromises.set(key, promise);
    }
    return promise;
  }

  private async ensureLod(visual: JobsBoardVisual, lod: "lod0" | "lod1") {
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
        const fallbackAtOrigin = createHarthmereJobsBoardKioskMesh({
          ...visual.location,
          x: 0,
          y: 0,
          z: 0,
        });
        fallbackAtOrigin.rotation.set(0, 0, 0);
        visual.fallback = fallbackAtOrigin;
        visual.anchor.add(fallbackAtOrigin);
      }
      log.error("Failed to load Harthmere jobs-board Blender graphic", {
        boardId: visual.location.id,
        variant: visual.location.variant,
        lod,
        error,
      });
    }
  }

  private publishDebugBridge() {
    if (typeof window === "undefined") return;
    (window as any).__harthmereJobsBoardMarkerDebug = {
      version: HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION,
      polishVersion: HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION,
      graphicVersion: HARTHMERE_JOBS_BOARD_WANTED_NOTICE_GRAPHIC_VERSION,
      boards: () =>
        this.visuals.map((visual) => ({
          id: visual.location.id,
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

export function makeHarthmereJobsBoardMarkerRenderer(
  resources?: ClientResources
) {
  return new HarthmereJobsBoardMarkerRenderer(resources);
}
