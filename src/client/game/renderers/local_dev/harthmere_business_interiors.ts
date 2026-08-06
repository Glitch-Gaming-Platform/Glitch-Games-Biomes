import type { ClientResources } from "@/client/game/resources/types";
import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { loadGltf } from "@/client/game/util/gltf_helpers";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  type HarthmereBusinessInteriorManifestRecord,
} from "@/shared/harthmere/business_interior_runtime";
import { log } from "@/shared/logging";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export const HARTHMERE_BUSINESS_INTERIOR_RENDER_VERSION =
  "harthmere-business-interior-combined-lod-v1" as const;
export const HARTHMERE_MOBILE_BUSINESS_INTERIOR_PREFETCH_METERS = 12;
export const HARTHMERE_MOBILE_BUSINESS_INTERIOR_MAX_LOADED = 1;
export const HARTHMERE_DESKTOP_BUSINESS_INTERIOR_MAX_LOADED = 2;

export type HarthmereBusinessInteriorLod = "lod0" | "lod1" | "hidden";

export function harthmereBusinessInteriorLodForDistance(
  record: HarthmereBusinessInteriorManifestRecord,
  distance: number
): HarthmereBusinessInteriorLod {
  if (distance <= record.lodPolicy.lod0MaxDistanceMeters) return "lod0";
  if (distance <= record.lodPolicy.lod1MaxDistanceMeters) return "lod1";
  return "hidden";
}

type LoadedInterior = {
  record: HarthmereBusinessInteriorManifestRecord;
  center: THREE.Vector3;
  lod0Root: THREE.Group;
  lod1Root: THREE.Group;
  lod0WorldBounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  lod1WorldBounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  activeLod: HarthmereBusinessInteriorLod;
};

function interiorCenter(record: HarthmereBusinessInteriorManifestRecord) {
  return new THREE.Vector3(
    record.assetWorldAnchor[0] + record.footprint.width / 2,
    record.assetWorldAnchor[1] + (record.footprint.floors > 1 ? 3 : 1.4),
    record.assetWorldAnchor[2] + record.footprint.depth / 2
  );
}

export function harthmereMobileBusinessInteriorIds(
  position: THREE.Vector3,
  maxLoaded = HARTHMERE_MOBILE_BUSINESS_INTERIOR_MAX_LOADED
): readonly string[] {
  return HARTHMERE_BUSINESS_INTERIORS.map((record) => ({
    record,
    distance: position.distanceTo(interiorCenter(record)),
  }))
    .filter(
      ({ record, distance }) =>
        distance <=
        record.lodPolicy.lod1MaxDistanceMeters +
          HARTHMERE_MOBILE_BUSINESS_INTERIOR_PREFETCH_METERS
    )
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxLoaded)
    .map(({ record }) => record.outpostId);
}

function disposeInteriorRoot(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of childMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function worldBounds(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  return {
    min: bounds.min.toArray() as [number, number, number],
    max: bounds.max.toArray() as [number, number, number],
  };
}

export function prepareHarthmereBusinessInteriorRoot(
  record: HarthmereBusinessInteriorManifestRecord,
  root: THREE.Group,
  lod: "lod0" | "lod1"
) {
  root.name = `${record.displayName} combined interior ${lod}`;
  root.position.set(
    record.assetWorldAnchor[0],
    record.assetWorldAnchor[1],
    record.assetWorldAnchor[2]
  );
  // Blender authors depth along +Y. The glTF exporter converts that axis to
  // -Z, while Harthmere building interiors extend from the southwest shell
  // origin along +world-Z. Reflect the loaded scene once at its authored
  // origin so the combined GLB occupies the same positive-depth footprint as
  // the manifest, collision proxies, and native ECS interaction anchors.
  root.scale.z *= -1;
  root.visible = false;
  root.userData.harthmereBusinessInteriorVersion =
    HARTHMERE_BUSINESS_INTERIOR_RENDER_VERSION;
  root.userData.harthmereBusinessInteriorOutpostId = record.outpostId;
  root.userData.harthmereBusinessInteriorBusinessType = record.businessType;
  root.userData.harthmereBusinessInteriorLod = lod;
  root.userData.harthmereBusinessInteriorStaticClutter = true;
  root.traverse((child) => {
    child.userData.harthmereBusinessInteriorOutpostId = record.outpostId;
    child.userData.harthmereBusinessInteriorLod = lod;
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });
  return root;
}

export class HarthmereBusinessInteriorsRenderer implements Renderer {
  public readonly name = HARTHMERE_BUSINESS_INTERIOR_RENDER_VERSION;
  private readonly root = new THREE.Group();
  private readonly loaded = new Map<string, LoadedInterior>();
  private readonly loading = new Map<string, Promise<void>>();
  private desiredOutpostIds = new Set<string>();
  private streamRefreshSeconds = 0;
  private loadPromise: Promise<void>;

  constructor(
    private readonly resources: ClientResources,
    private readonly load: (url: string) => Promise<GLTF> = loadGltf,
    private readonly mobileDevice = false
  ) {
    this.root.name = `harthmere business interiors ${HARTHMERE_BUSINESS_INTERIOR_RENDER_VERSION}`;
    // Loading all 19 interiors and both LODs in the constructor added 38 GLBs
    // to the same first-frame request burst as projectile and town-furniture
    // catalogues. The nearby selector already has the correct visibility and
    // disposal behavior, so use it on every platform.
    this.loadPromise = Promise.resolve();
    this.publishDebugBridge();
  }

  private async loadRecord(record: HarthmereBusinessInteriorManifestRecord) {
    try {
      const [lod0, lod1] = await Promise.all([
        this.load(record.assets.lod0),
        this.load(record.assets.lod1),
      ]);
      const lod0Root = prepareHarthmereBusinessInteriorRoot(
        record,
        lod0.scene,
        "lod0"
      );
      const lod1Root = prepareHarthmereBusinessInteriorRoot(
        record,
        lod1.scene,
        "lod1"
      );
      if (!this.desiredOutpostIds.has(record.outpostId)) {
        disposeInteriorRoot(lod0Root);
        disposeInteriorRoot(lod1Root);
        return;
      }
      this.root.add(lod0Root, lod1Root);
      const lod0WorldBounds = worldBounds(lod0Root);
      const lod1WorldBounds = worldBounds(lod1Root);
      this.loaded.set(record.outpostId, {
        record,
        center: interiorCenter(record),
        lod0Root,
        lod1Root,
        lod0WorldBounds,
        lod1WorldBounds,
        activeLod: "hidden",
      });
    } catch (error) {
      log.error("Failed to load Harthmere business combined interior", {
        outpostId: record.outpostId,
        error,
      });
    }
  }

  private unloadRecord(outpostId: string) {
    const interior = this.loaded.get(outpostId);
    if (!interior) return;
    this.root.remove(interior.lod0Root, interior.lod1Root);
    disposeInteriorRoot(interior.lod0Root);
    disposeInteriorRoot(interior.lod1Root);
    this.loaded.delete(outpostId);
  }

  private syncNearbyInteriors(cameraPosition: THREE.Vector3) {
    this.desiredOutpostIds = new Set(
      harthmereMobileBusinessInteriorIds(
        cameraPosition,
        this.mobileDevice
          ? HARTHMERE_MOBILE_BUSINESS_INTERIOR_MAX_LOADED
          : HARTHMERE_DESKTOP_BUSINESS_INTERIOR_MAX_LOADED
      )
    );
    for (const outpostId of this.loaded.keys()) {
      if (!this.desiredOutpostIds.has(outpostId)) {
        this.unloadRecord(outpostId);
      }
    }
    for (const outpostId of this.desiredOutpostIds) {
      if (this.loaded.has(outpostId) || this.loading.has(outpostId)) continue;
      const record = HARTHMERE_BUSINESS_INTERIORS.find(
        (candidate) => candidate.outpostId === outpostId
      );
      if (!record) continue;
      const promise = this.loadRecord(record).finally(() => {
        this.loading.delete(outpostId);
      });
      this.loading.set(outpostId, promise);
    }
  }

  draw(scenes: Scenes, dt: number): void {
    const camera = this.resources.get("/scene/camera").three;
    this.streamRefreshSeconds -= Math.min(dt, 0.5);
    if (this.streamRefreshSeconds <= 0) {
      this.streamRefreshSeconds = 0.25;
      this.syncNearbyInteriors(camera.position);
    }
    for (const interior of this.loaded.values()) {
      const lod = harthmereBusinessInteriorLodForDistance(
        interior.record,
        camera.position.distanceTo(interior.center)
      );
      if (lod === interior.activeLod) continue;
      interior.activeLod = lod;
      interior.lod0Root.visible = lod === "lod0";
      interior.lod1Root.visible = lod === "lod1";
    }
    scenes.three.add(this.root);
  }

  private publishDebugBridge() {
    if (typeof window === "undefined") return;
    (window as any).__harthmereBusinessInteriors = {
      version: HARTHMERE_BUSINESS_INTERIOR_RENDER_VERSION,
      mobileDevice: this.mobileDevice,
      expectedCount: HARTHMERE_BUSINESS_INTERIORS.length,
      loadedCount: () => this.loaded.size,
      loadingCount: () => this.loading.size,
      ready: () =>
        Promise.all([this.loadPromise, ...this.loading.values()]).then(
          () => undefined
        ),
      interiors: () =>
        [...this.loaded.values()].map((entry) => ({
          outpostId: entry.record.outpostId,
          businessType: entry.record.businessType,
          activeLod: entry.activeLod,
          lod0Visible: entry.lod0Root.visible,
          lod1Visible: entry.lod1Root.visible,
          origin: [...entry.record.assetWorldAnchor],
          desk: [...entry.record.deskWorldPivot],
          footprint: { ...entry.record.footprint },
          lod0WorldBounds: entry.lod0WorldBounds,
          lod1WorldBounds: entry.lod1WorldBounds,
          fixtureCount: entry.record.fixtures.length,
          collisionCount: entry.record.collisionBoxes.length,
        })),
    };
  }
}

export function makeHarthmereBusinessInteriorsRenderer(
  resources: ClientResources,
  mobileDevice = false
) {
  return new HarthmereBusinessInteriorsRenderer(
    resources,
    loadGltf,
    mobileDevice
  );
}
