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
  activeLod: HarthmereBusinessInteriorLod;
};

function prepareInteriorRoot(
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
  private loadPromise: Promise<void>;

  constructor(
    private readonly resources: ClientResources,
    private readonly load: (url: string) => Promise<GLTF> = loadGltf
  ) {
    this.root.name = `harthmere business interiors ${HARTHMERE_BUSINESS_INTERIOR_RENDER_VERSION}`;
    this.loadPromise = this.loadAll();
    this.publishDebugBridge();
  }

  private async loadAll() {
    await Promise.all(
      HARTHMERE_BUSINESS_INTERIORS.map(async (record) => {
        try {
          const [lod0, lod1] = await Promise.all([
            this.load(record.assets.lod0),
            this.load(record.assets.lod1),
          ]);
          const lod0Root = prepareInteriorRoot(record, lod0.scene, "lod0");
          const lod1Root = prepareInteriorRoot(record, lod1.scene, "lod1");
          this.root.add(lod0Root, lod1Root);
          this.loaded.set(record.outpostId, {
            record,
            center: new THREE.Vector3(
              record.assetWorldAnchor[0] + record.footprint.width / 2,
              record.assetWorldAnchor[1] +
                (record.footprint.floors > 1 ? 3 : 1.4),
              record.assetWorldAnchor[2] + record.footprint.depth / 2
            ),
            lod0Root,
            lod1Root,
            activeLod: "hidden",
          });
        } catch (error) {
          log.error("Failed to load Harthmere business combined interior", {
            outpostId: record.outpostId,
            error,
          });
        }
      })
    );
  }

  draw(scenes: Scenes, _dt: number): void {
    const camera = this.resources.get("/scene/camera").three;
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
      expectedCount: HARTHMERE_BUSINESS_INTERIORS.length,
      ready: () => this.loadPromise,
      interiors: () =>
        [...this.loaded.values()].map((entry) => ({
          outpostId: entry.record.outpostId,
          businessType: entry.record.businessType,
          activeLod: entry.activeLod,
          lod0Visible: entry.lod0Root.visible,
          lod1Visible: entry.lod1Root.visible,
          origin: [...entry.record.assetWorldAnchor],
          desk: [...entry.record.deskWorldPivot],
          fixtureCount: entry.record.fixtures.length,
          collisionCount: entry.record.collisionBoxes.length,
        })),
    };
  }
}

export function makeHarthmereBusinessInteriorsRenderer(
  resources: ClientResources
) {
  return new HarthmereBusinessInteriorsRenderer(resources);
}
