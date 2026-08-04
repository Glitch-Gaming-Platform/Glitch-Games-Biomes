import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";
import { loadGltf } from "@/client/game/util/gltf_helpers";
import { HARTHMERE_BUSINESS_FURNITURE_ASSETS } from "@/shared/harthmere/generated/harthmere_business_furniture_manifest";
import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES,
  HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION,
  harthmereAdditiveTownInteriorWorldPosition,
  type HarthmereTownInteriorFixture,
} from "@/shared/harthmere/harthmere_additive_town_interiors";
import { log } from "@/shared/logging";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_RENDER_VERSION =
  "harthmere-additive-town-interiors-instanced-lod-v1" as const;
export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD0_METERS = 16;
export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD1_METERS = 28;
export const HARTHMERE_MOBILE_ADDITIVE_TOWN_INTERIOR_PREFETCH_METERS = 12;
export const HARTHMERE_MOBILE_ADDITIVE_TOWN_INTERIOR_MAX_LOADED_ASSETS = 8;
export const HARTHMERE_MOBILE_ADDITIVE_TOWN_INTERIOR_MAX_CONCURRENT_LOADS = 2;

type VisualFixture = HarthmereTownInteriorFixture & {
  visualAsset: string;
  worldPosition: readonly [number, number, number];
};
type InteriorLod = "lod0" | "lod1";

interface InstancedPrimitive {
  readonly mesh: THREE.InstancedMesh;
  readonly sourceMatrix: THREE.Matrix4;
}

interface InstancedAssetBatch {
  readonly asset: string;
  readonly lod: InteriorLod;
  readonly fixtures: readonly VisualFixture[];
  readonly worldMatrices: readonly THREE.Matrix4[];
  readonly primitives: readonly InstancedPrimitive[];
}

interface LoadedInteriorAsset {
  readonly batches: readonly InstancedAssetBatch[];
  readonly sourceRoots: readonly THREE.Object3D[];
}

function visualAssetForFixture(
  fixture: HarthmereTownInteriorFixture
): string | undefined {
  return fixture.furnitureItemId ?? fixture.asset;
}

export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES: readonly VisualFixture[] =
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.flatMap((fixture) => {
    const visualAsset = visualAssetForFixture(fixture);
    return visualAsset
      ? [
          {
            ...fixture,
            visualAsset,
            worldPosition: harthmereAdditiveTownInteriorWorldPosition(
              fixture.position
            ),
          },
        ]
      : [];
  });

function fixtureWorldMatrix(fixture: VisualFixture) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...fixture.worldPosition),
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      fixture.yaw
    ),
    new THREE.Vector3(fixture.scale, fixture.scale, fixture.scale)
  );
}

function fixturesByAsset() {
  const grouped = new Map<string, VisualFixture[]>();
  for (const fixture of HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES) {
    const list = grouped.get(fixture.visualAsset) ?? [];
    list.push(fixture);
    grouped.set(fixture.visualAsset, list);
  }
  return grouped;
}

export function harthmereMobileAdditiveTownInteriorAssets(
  position: THREE.Vector3
): readonly string[] {
  const maxDistance =
    HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD1_METERS +
    HARTHMERE_MOBILE_ADDITIVE_TOWN_INTERIOR_PREFETCH_METERS;
  const maxDistanceSq = maxDistance * maxDistance;
  const nearestDistanceSqByAsset = new Map<string, number>();
  for (const fixture of HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES) {
    const dx = position.x - fixture.worldPosition[0];
    const dz = position.z - fixture.worldPosition[2];
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > maxDistanceSq) continue;
    nearestDistanceSqByAsset.set(
      fixture.visualAsset,
      Math.min(
        nearestDistanceSqByAsset.get(fixture.visualAsset) ?? Infinity,
        distanceSq
      )
    );
  }
  return [...nearestDistanceSqByAsset]
    .sort((left, right) => left[1] - right[1])
    .slice(0, HARTHMERE_MOBILE_ADDITIVE_TOWN_INTERIOR_MAX_LOADED_ASSETS)
    .map(([asset]) => asset);
}

function disposeInteriorAssetRoot(root: THREE.Object3D) {
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

export function validateHarthmereAdditiveTownInteriorVisualAssets() {
  const problems: string[] = [];
  for (const fixture of HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES) {
    if (!(fixture.visualAsset in HARTHMERE_BUSINESS_FURNITURE_ASSETS)) {
      problems.push(
        `${fixture.fixtureId}:missing_visual_asset:${fixture.visualAsset}`
      );
    }
  }
  return problems;
}

function prepareInstancedBatch(input: {
  asset: string;
  lod: InteriorLod;
  fixtures: readonly VisualFixture[];
  root: THREE.Object3D;
  destination: THREE.Group;
}): InstancedAssetBatch {
  input.root.updateWorldMatrix(true, true);
  const primitives: InstancedPrimitive[] = [];
  input.root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mesh = new THREE.InstancedMesh(
      child.geometry,
      child.material,
      input.fixtures.length
    );
    mesh.name = `${input.asset} ${input.lod} instanced interior primitive`;
    mesh.count = 0;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    // Matrices are compacted to nearby instances every 0.2 seconds. Per-object
    // frustum tests would defeat the purpose of one shared draw primitive.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.harthmereAdditiveTownInteriorVersion =
      HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION;
    mesh.userData.harthmereAdditiveTownInteriorRenderVersion =
      HARTHMERE_ADDITIVE_TOWN_INTERIOR_RENDER_VERSION;
    mesh.userData.harthmereAdditiveTownInteriorAsset = input.asset;
    mesh.userData.harthmereAdditiveTownInteriorLod = input.lod;
    input.destination.add(mesh);
    primitives.push({ mesh, sourceMatrix: child.matrixWorld.clone() });
  });
  return {
    asset: input.asset,
    lod: input.lod,
    fixtures: input.fixtures,
    worldMatrices: input.fixtures.map(fixtureWorldMatrix),
    primitives,
  };
}

export class HarthmereAdditiveTownInteriorsRenderer implements Renderer {
  public readonly name = HARTHMERE_ADDITIVE_TOWN_INTERIOR_RENDER_VERSION;
  private readonly root = new THREE.Group();
  private readonly batches: InstancedAssetBatch[] = [];
  private readonly sourceRoots: THREE.Object3D[] = [];
  private readonly groupedFixtures = fixturesByAsset();
  private readonly loadedAssets = new Map<string, LoadedInteriorAsset>();
  private readonly loadingAssets = new Map<string, Promise<void>>();
  private desiredMobileAssets = new Set<string>();
  private mobileRefreshSeconds = 0;
  private refreshSeconds = 0;
  private readyPromise: Promise<void>;

  constructor(
    private readonly resources: ClientResources,
    private readonly load: (url: string) => Promise<GLTF> = loadGltf,
    private readonly mobileDevice = false
  ) {
    this.root.name = `Harthmere additive town interiors ${HARTHMERE_ADDITIVE_TOWN_INTERIOR_RENDER_VERSION}`;
    // The catalogue is 31 assets x two LODs. Loading all 62 GLBs at phone boot
    // pinned Mobile Safari's main thread before its first frame even when the
    // nearest additive-town fixture was over a kilometre away. Desktop keeps
    // the existing eager path; mobile streams only nearby asset families.
    this.readyPromise = mobileDevice ? Promise.resolve() : this.loadAll();
    this.publishDebugBridge();
  }

  private async loadAll() {
    await Promise.all(
      [...this.groupedFixtures.entries()].map(([asset, fixtures]) =>
        this.loadAsset(asset, fixtures)
      )
    );
    this.refreshSeconds = 0;
  }

  private async loadAsset(asset: string, fixtures: readonly VisualFixture[]) {
    const record =
      HARTHMERE_BUSINESS_FURNITURE_ASSETS[
        asset as keyof typeof HARTHMERE_BUSINESS_FURNITURE_ASSETS
      ];
    if (!record) {
      log.error("Missing Harthmere additive-town interior asset", { asset });
      return;
    }
    try {
      const [lod0, lod1] = await Promise.all([
        this.load(record.lod0Url),
        this.load(record.lod1Url),
      ]);
      if (this.mobileDevice && !this.desiredMobileAssets.has(asset)) {
        disposeInteriorAssetRoot(lod0.scene);
        disposeInteriorAssetRoot(lod1.scene);
        return;
      }
      const batches = [
        prepareInstancedBatch({
          asset,
          lod: "lod0",
          fixtures,
          root: lod0.scene,
          destination: this.root,
        }),
        prepareInstancedBatch({
          asset,
          lod: "lod1",
          fixtures,
          root: lod1.scene,
          destination: this.root,
        }),
      ];
      const sourceRoots = [lod0.scene, lod1.scene];
      this.sourceRoots.push(...sourceRoots);
      this.batches.push(...batches);
      this.loadedAssets.set(asset, { batches, sourceRoots });
    } catch (error) {
      log.error("Failed to load Harthmere additive-town interior asset", {
        asset,
        error,
      });
    }
  }

  private unloadAsset(asset: string) {
    const loaded = this.loadedAssets.get(asset);
    if (!loaded) return;
    for (const batch of loaded.batches) {
      for (const primitive of batch.primitives) {
        primitive.mesh.removeFromParent();
      }
      const batchIndex = this.batches.indexOf(batch);
      if (batchIndex >= 0) this.batches.splice(batchIndex, 1);
    }
    for (const sourceRoot of loaded.sourceRoots) {
      const sourceIndex = this.sourceRoots.indexOf(sourceRoot);
      if (sourceIndex >= 0) this.sourceRoots.splice(sourceIndex, 1);
      disposeInteriorAssetRoot(sourceRoot);
    }
    this.loadedAssets.delete(asset);
  }

  private syncMobileAssets(position: THREE.Vector3) {
    this.desiredMobileAssets = new Set(
      harthmereMobileAdditiveTownInteriorAssets(position)
    );
    for (const asset of this.loadedAssets.keys()) {
      if (!this.desiredMobileAssets.has(asset)) this.unloadAsset(asset);
    }
    let availableLoads = Math.max(
      0,
      HARTHMERE_MOBILE_ADDITIVE_TOWN_INTERIOR_MAX_CONCURRENT_LOADS -
        this.loadingAssets.size
    );
    for (const asset of this.desiredMobileAssets) {
      if (availableLoads <= 0) break;
      if (this.loadedAssets.has(asset) || this.loadingAssets.has(asset)) {
        continue;
      }
      const fixtures = this.groupedFixtures.get(asset);
      if (!fixtures) continue;
      availableLoads -= 1;
      const pending = this.loadAsset(asset, fixtures).finally(() => {
        this.loadingAssets.delete(asset);
      });
      this.loadingAssets.set(asset, pending);
    }
  }

  private refreshVisibleInstances(camera: THREE.Camera) {
    const composed = new THREE.Matrix4();
    for (const batch of this.batches) {
      let visibleCount = 0;
      for (let index = 0; index < batch.fixtures.length; index += 1) {
        const fixture = batch.fixtures[index];
        const dx = camera.position.x - fixture.worldPosition[0];
        const dy = camera.position.y - fixture.worldPosition[1];
        const dz = camera.position.z - fixture.worldPosition[2];
        const distanceSq = dx * dx + dy * dy + dz * dz;
        const visible =
          batch.lod === "lod0"
            ? distanceSq <= HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD0_METERS ** 2
            : distanceSq > HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD0_METERS ** 2 &&
              distanceSq <= HARTHMERE_ADDITIVE_TOWN_INTERIOR_LOD1_METERS ** 2;
        if (!visible) continue;
        for (const primitive of batch.primitives) {
          composed.multiplyMatrices(
            batch.worldMatrices[index],
            primitive.sourceMatrix
          );
          primitive.mesh.setMatrixAt(visibleCount, composed);
        }
        visibleCount += 1;
      }
      for (const primitive of batch.primitives) {
        primitive.mesh.count = visibleCount;
        primitive.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  draw(scenes: Scenes, dt: number) {
    const camera = this.resources.get("/scene/camera").three;
    if (this.mobileDevice) {
      this.mobileRefreshSeconds -= Math.min(dt, 0.5);
      if (this.mobileRefreshSeconds <= 0) {
        this.mobileRefreshSeconds = 0.25;
        this.syncMobileAssets(camera.position);
      }
    }
    this.refreshSeconds -= Math.min(dt, 0.5);
    if (this.refreshSeconds <= 0) {
      this.refreshSeconds = 0.2;
      this.refreshVisibleInstances(camera);
    }
    scenes.three.add(this.root);
  }

  private publishDebugBridge() {
    if (typeof window === "undefined") return;
    (window as any).__harthmereAdditiveTownInteriors = {
      version: HARTHMERE_ADDITIVE_TOWN_INTERIOR_RENDER_VERSION,
      layoutVersion: HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION,
      mobileDevice: this.mobileDevice,
      fixtureCount: HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.length,
      visualFixtureCount:
        HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES.length,
      ready: () =>
        Promise.all([this.readyPromise, ...this.loadingAssets.values()]).then(
          () => undefined
        ),
      loadedAssetCount: () => this.loadedAssets.size,
      loadingAssetCount: () => this.loadingAssets.size,
      batchCount: () => this.batches.length,
      drawPrimitiveCount: () =>
        this.batches.reduce((sum, batch) => sum + batch.primitives.length, 0),
      visibleInstanceCount: () =>
        this.batches.reduce(
          (sum, batch) =>
            sum +
            batch.primitives.reduce(
              (primitiveSum, primitive) => primitiveSum + primitive.mesh.count,
              0
            ),
          0
        ),
    };
  }
}

export function makeHarthmereAdditiveTownInteriorsRenderer(
  resources: ClientResources,
  mobileDevice = false
) {
  return new HarthmereAdditiveTownInteriorsRenderer(
    resources,
    loadGltf,
    mobileDevice
  );
}
