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
  private refreshSeconds = 0;
  private readyPromise: Promise<void>;

  constructor(
    private readonly resources: ClientResources,
    private readonly load: (url: string) => Promise<GLTF> = loadGltf
  ) {
    this.root.name = `Harthmere additive town interiors ${HARTHMERE_ADDITIVE_TOWN_INTERIOR_RENDER_VERSION}`;
    this.readyPromise = this.loadAll();
    this.publishDebugBridge();
  }

  private async loadAll() {
    const grouped = fixturesByAsset();
    await Promise.all(
      [...grouped.entries()].map(async ([asset, fixtures]) => {
        const record =
          HARTHMERE_BUSINESS_FURNITURE_ASSETS[
            asset as keyof typeof HARTHMERE_BUSINESS_FURNITURE_ASSETS
          ];
        if (!record) {
          log.error("Missing Harthmere additive-town interior asset", {
            asset,
          });
          return;
        }
        try {
          const [lod0, lod1] = await Promise.all([
            this.load(record.lod0Url),
            this.load(record.lod1Url),
          ]);
          this.sourceRoots.push(lod0.scene, lod1.scene);
          this.batches.push(
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
            })
          );
        } catch (error) {
          log.error("Failed to load Harthmere additive-town interior asset", {
            asset,
            error,
          });
        }
      })
    );
    this.refreshSeconds = 0;
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
    this.refreshSeconds -= Math.min(dt, 0.5);
    if (this.refreshSeconds <= 0) {
      this.refreshSeconds = 0.2;
      this.refreshVisibleInstances(this.resources.get("/scene/camera").three);
    }
    scenes.three.add(this.root);
  }

  private publishDebugBridge() {
    if (typeof window === "undefined") return;
    (window as any).__harthmereAdditiveTownInteriors = {
      version: HARTHMERE_ADDITIVE_TOWN_INTERIOR_RENDER_VERSION,
      layoutVersion: HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION,
      fixtureCount: HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.length,
      visualFixtureCount:
        HARTHMERE_ADDITIVE_TOWN_INTERIOR_VISUAL_FIXTURES.length,
      ready: () => this.readyPromise,
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
  resources: ClientResources
) {
  return new HarthmereAdditiveTownInteriorsRenderer(resources);
}
