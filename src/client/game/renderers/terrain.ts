import type { AuthManager } from "@/client/game/context_managers/auth_manager";
import type { Priority } from "@/client/game/context_managers/biomes_async";
import { priorityForPosition } from "@/client/game/context_managers/biomes_async";
import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScene, addToScenes } from "@/client/game/renderers/scenes";
import type { BlockMesh } from "@/client/game/resources/blocks";
import type { FloraMesh } from "@/client/game/resources/florae";
import type { GlassMesh } from "@/client/game/resources/glass";
import type {
  OcclusionData,
  OcclusionDebugMesh,
} from "@/client/game/resources/terrain";
import { updateOcclusionMesh } from "@/client/game/resources/terrain";
import type {
  ClientResourcePaths,
  ClientResources,
  ClientResourcesStats,
} from "@/client/game/resources/types";
import type { WaterMesh } from "@/client/game/resources/water";
import type { BlocksUniforms } from "@/gen/client/game/shaders/blocks";
import { updateBlocksMaterial } from "@/gen/client/game/shaders/blocks";
import type { FloraUniforms } from "@/gen/client/game/shaders/flora";
import { updateFloraMaterial } from "@/gen/client/game/shaders/flora";
import { FloraLowQualityShaders } from "@/gen/client/game/shaders/flora_low_quality_shaders";
import { FloraShaders } from "@/gen/client/game/shaders/flora_shaders";
import type { GlassUniforms } from "@/gen/client/game/shaders/glass";
import { updateGlassMaterial } from "@/gen/client/game/shaders/glass";
import type { WaterUniforms } from "@/gen/client/game/shaders/water";
import { updateWaterMaterial } from "@/gen/client/game/shaders/water";
import { using } from "@/shared/deletable";
import type { ShardId } from "@/shared/ecs/gen/types";
import { shardCenter, voxelShard } from "@/shared/game/shard";
import { distSq } from "@/shared/math/linear";
import { clamp } from "@/shared/math/math";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import type { ResourcesStats } from "@/shared/resources/biomes";
import { ResourceLimiter } from "@/shared/resources/biomes";
import type { PathMap } from "@/shared/resources/path_map";
import type {
  Args,
  Key,
  Resolve,
  Ret,
  TypedResources,
} from "@/shared/resources/types";
import { Cval } from "@/shared/util/cvals";
import type { Optional } from "@/shared/util/type_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import { HARTHMERE_PERF_AND_PLACEMENT_PREWARM } from "@/shared/harthmere/town_production_polish";
import type {
  FrustumSharder,
  VisibilitySharder,
} from "@/shared/wasm/types/shards";

const numRenderedBlockShards = new Cval({
  path: ["renderer", "terrain", "numRenderedBlockShards"],
  help: "The total number of block terrain shards that are rendered in the previous frame.",
  initialValue: 0,
});
const numRenderedGlassShards = new Cval({
  path: ["renderer", "terrain", "numRenderedGlassShards"],
  help: "The total number of glass terrain shards that are rendered in the previous frame.",
  initialValue: 0,
});
const numRenderedFloraShards = new Cval({
  path: ["renderer", "terrain", "numRenderedFloraShards"],
  help: "The total number of flora terrain shards that are rendered in the previous frame.",
  initialValue: 0,
});
const numRenderedWaterShards = new Cval({
  path: ["renderer", "terrain", "numRenderedWaterShards"],
  help: "The total number of water terrain shards that are rendered in the previous frame.",
  initialValue: 0,
});
const numRenderedOccluders = new Cval({
  path: ["renderer", "terrain", "numRenderedOccluders"],
  help: "The total number of occluders rasterized to the occlusion buffer.",
  initialValue: 0,
});

// Encapsulates terrain-specific logic for resource build queue throttling.
// Namely that we:
//   1. Want high priority terrain shards to (almost) always get enqueued ASAP,
//      to reduce edit latency.
class TerrainResourceLimiter<P extends PathMap<P>> {
  defaultThrottler: ResourceLimiter<P>;
  criticalThrottler: ResourceLimiter<P>;

  constructor(resources: TypedResources<P>, stats: ResourcesStats<P>) {
    this.defaultThrottler = new ResourceLimiter(resources, stats, 6);
    this.criticalThrottler = new ResourceLimiter(resources, stats, 40);
  }

  cached<K extends Key<P>>(
    priority: Priority,
    path: K,
    ...args: [...Args<P, K>]
  ): Resolve<Ret<P, K>> | undefined {
    if (priority === "critical") {
      return this.criticalThrottler.cached(path, ...args);
    } else {
      return this.defaultThrottler.cached(path, ...args);
    }
  }
}

const OCCLUSION_BUFFER_SHAPE = [128, 64] as const;
const OCCLUSION_MESH_UPDATE_MS = 1_000.0;

class OcclusionMeshWriter {
  stale: boolean;

  constructor(
    readonly occlusionMesh: OcclusionDebugMesh,
    readonly step: number
  ) {
    const now = performance.now();
    this.stale = now - this.occlusionMesh.time > OCCLUSION_MESH_UPDATE_MS;
  }

  update(sharder: VisibilitySharder, step: number) {
    if (this.stale && this.step > 0 && step >= this.step) {
      this.occlusionMesh.time = performance.now();
      this.stale = false;

      // Update the debug mesh to reflect the current occlusion buffer data.
      sharder.writeOcclusionBuffer(this.occlusionMesh.buffer);
      this.occlusionMesh.shape = OCCLUSION_BUFFER_SHAPE;
      updateOcclusionMesh(this.occlusionMesh);
    }
  }
}

export class TerrainRenderer implements Renderer {
  name = "terrain";
  time: number = 0;
  sharder: FrustumSharder;
  private harthmerePrewarmOrigin?: Vec3;
  private harthmerePrewarmQueue: ShardId[] = [];
  private harthmerePrewarmInFlight = 0;
  private harthmerePrewarmLastPlanAt = 0;
  // PERF (2026-08-03 render audit): ResourceLimiter is stateless -- all of its
  // throttling state lives in the shared ResourcesStats it reads through
  // pathStats(). Rebuilding it (and its two inner limiters) on every frame was
  // pure allocation with no semantic effect, so it is hoisted here.
  private readonly throttledResources: TerrainResourceLimiter<ClientResourcePaths>;

  constructor(
    private readonly resources: ClientResources,
    private readonly resourcesStats: ClientResourcesStats,
    private readonly authManager: AuthManager,
    private readonly voxeloo: VoxelooModule
  ) {
    this.sharder = new voxeloo.FrustumSharder(5 /* shard level */);
    this.throttledResources = new TerrainResourceLimiter(
      this.resources,
      this.resourcesStats
    );
  }

  draw(scenes: Scenes, dt: number) {
    this.time += dt;
    const settings = this.resources.get("/settings/graphics/dynamic");
    const tweaks = this.resources.get("/tweaks");
    const camera = this.resources.get("/scene/camera");
    const env = this.resources.get("/camera/environment");
    const sky = this.resources.get("/scene/sky_params");
    const enableWaterReflection = settings.postprocesses.waterReflection;
    this.updateHarthmereTerrainPrewarm(camera.pos());

    // The reosurce limiter throttles how often resource generation occurs as a
    // side effect of fetching resources from the cache. Internally, the limiter
    // maintains a quota and only generates so many new terrain shards per frame.
    const throttledResources = this.throttledResources;

    // PERF (2026-08-03 render audit): destruction/shaping uniforms can only
    // ever apply to the single shard the local player is currently mining, but
    // this used to be recomputed per shard per frame -- each call re-fetching
    // /scene/local_player and two /materials/* resources and then discarding
    // the result for every shard that wasn't the destroy target. Resolve it
    // once per frame instead and compare shard ids in the loop.
    const frameDestruction = this.destructionUniformsForFrame();

    // Fetch the debug occlusion mesh data.
    const occlusionDebugMeshWriter = new OcclusionMeshWriter(
      this.resources.get("/terrain/occlusion_debug_mesh"),
      tweaks.showOcclusionMask ? tweaks.occlusionMeshStep : 0
    );

    // Figure out which shards are should be rendered with occlusion culling.
    const shards: {
      shard: ShardId;
      center: Vec3;
      occlusion: Optional<OcclusionData>;
    }[] = [];
    using(
      new this.voxeloo.VisibilitySharder(
        camera.viewProj(),
        camera.pos(),
        camera.view(),
        OCCLUSION_BUFFER_SHAPE
      ),
      (sharder) => {
        let step = 0;
        numRenderedOccluders.value = 0;
        sharder.scan((shard) => {
          const center = shardCenter(shard);
          const priority = priorityForPosition(camera, center);

          const occlusion = throttledResources.cached(
            priority,
            "/terrain/occluder",
            shard
          );

          shards.push({ shard, center, occlusion });
          if (occlusion) {
            numRenderedOccluders.value += occlusion.occluder?.size() ?? 0;
            occlusionDebugMeshWriter.update(sharder, step++);
            return occlusion.occluder;
          }
          return undefined;
        });
        occlusionDebugMeshWriter.update(sharder, Infinity);
      }
    );

    // Since toArray() is called frequently, precompute it here.
    const defaultBlockMaterial: Partial<BlocksUniforms> = {
      destroyPos: [Infinity, Infinity, Infinity],
      shapePos: [Infinity, Infinity, Infinity],
      light: sky.sunDirection.toArray(),
    };

    const defaultGlassMaterial: Partial<GlassUniforms> = {
      destroyPos: [Infinity, Infinity, Infinity],
      shapePos: [Infinity, Infinity, Infinity],
      light: sky.sunDirection.toArray(),
      sunDirection: sky.sunDirection.toArray(),
      sunColor: [sky.sunColor.r, sky.sunColor.g, sky.sunColor.b],
      skyGroundOffset: sky.groundOffset,
      skyHeightScale: sky.heightScale,
      inWater: env.inWater ? 1 : 0,
      muckyness: env.muckyness.get(),
      cameraPosition: camera.three.position.toArray(),
    };

    const defaultFloraMaterial: Partial<FloraUniforms> = {
      time: this.time,
      light: sky.sunDirection.toArray(),
    };

    const DEFAULT_WATER_REFLECTION_STEPS = 30;

    const waterMaterial: Partial<WaterUniforms> = {
      time: this.time,
      light: sky.sunDirection.toArray(),
      inWater: env.inWater ? 1 : 0,
      numReflectionSteps: enableWaterReflection
        ? DEFAULT_WATER_REFLECTION_STEPS
        : 0,
      ...tweaks.water,
      normalOctaveStrength1: 1.0,
      normalOctaveStrength2: 1.0,
      useReflection: 0.3,
      muckRate: 0.05,
    };

    const blockMeshes: BlockMesh[] = [];
    const floraMeshes: FloraMesh[] = [];
    const glassMeshes: GlassMesh[] = [];
    // PERF (2026-08-03 render audit): water is blended, so it must be drawn
    // back-to-front. It previously relied on `waterMesh.renderOrder`, but that
    // is inert here: three only consults renderOrder inside its opaque and
    // transparent sort comparators, and those only run when
    // renderer.sortObjects === true -- which PassRenderer explicitly disables
    // so that draw order can be controlled manually (pass_renderer.ts). Since
    // insertion order IS draw order under sortObjects=false, sort the meshes
    // ourselves before adding them. Carry the distance alongside so we don't
    // recompute it.
    const waterMeshes: { mesh: WaterMesh; distance: number }[] = [];

    numRenderedBlockShards.value = 0;
    numRenderedGlassShards.value = 0;
    numRenderedFloraShards.value = 0;
    numRenderedWaterShards.value = 0;
    const cameraPosition = camera.three.position.toArray();
    for (let i = 0; i < shards.length; ++i) {
      const { shard: id, center, occlusion } = shards[i];
      if (occlusion) {
        const shardDistance = distSq(cameraPosition, center);

        // Don't throttle shards adjacent to the player, we want to make sure
        // they're always up-to-date, especially for edit latency.
        const priority = priorityForPosition(camera, center);

        const combinedMesh = throttledResources.cached(
          priority,
          "/terrain/combined_mesh",
          id
        );
        if (!combinedMesh) {
          continue;
        }
        const [blockMesh, glassMesh, floraMesh, waterMesh] = combinedMesh;

        const destructionUniforms =
          frameDestruction && frameDestruction.shardId === id
            ? frameDestruction.uniforms
            : undefined;
        // Render the block mesh.
        if (blockMesh) {
          updateBlocksMaterial(blockMesh.material, {
            ...defaultBlockMaterial,
            ...destructionUniforms,
          });
          blockMesh.material.wireframe = tweaks.showWireframe;
          ++numRenderedBlockShards.value;

          if (
            !tweaks.showStaleBlockShards ||
            !this.highlightOutOfDateShard("/terrain/block/mesh", id, scenes)
          ) {
            blockMeshes.push(blockMesh);
          }
        }

        // Render the glass mesh
        if (glassMesh) {
          updateGlassMaterial(glassMesh.material, {
            ...defaultGlassMaterial,
            ...destructionUniforms,
          });
          glassMesh.material.wireframe = tweaks.showWireframe;
          ++numRenderedGlassShards.value;

          if (
            !tweaks.showStaleGlassShards ||
            !this.highlightOutOfDateShard("/terrain/glass/mesh", id, scenes)
          ) {
            glassMeshes.push(glassMesh);
          }
        }

        // Render the flora mesh.
        if (floraMesh) {
          updateFloraMaterial(floraMesh.material, defaultFloraMaterial);
          if (settings.floraQuality === "low") {
            floraMesh.material.vertexShader =
              FloraLowQualityShaders.vertexShader;
          } else {
            floraMesh.material.vertexShader = FloraShaders.vertexShader;
          }
          floraMesh.material.wireframe = tweaks.showWireframe;
          ++numRenderedFloraShards.value;

          if (
            !tweaks.showStaleFloraShards ||
            !this.highlightOutOfDateShard("/terrain/flora/mesh", id, scenes)
          ) {
            floraMeshes.push(floraMesh);
          }
        }

        // Render the water mesh.
        if (waterMesh) {
          updateWaterMaterial(waterMesh.material, waterMaterial);
          waterMesh.material.wireframe = tweaks.showWireframe;
          // Kept in sync so that ordering stays correct if sortObjects is ever
          // re-enabled; the explicit sort below is what actually takes effect
          // today. See the waterMeshes declaration above.
          waterMesh.renderOrder = shardDistance;
          waterMeshes.push({ mesh: waterMesh, distance: shardDistance });
          ++numRenderedWaterShards.value;
        }
      }

      // Render debug meshes if enabled.
      if (tweaks.showCollisionBoxes) {
        const boxes = this.resources.cached("/terrain/boxes_mesh", id);
        if (boxes) {
          addToScenes(scenes, boxes);
        }
      }
      if (tweaks.showShardBoundaries) {
        const shard = this.resources.cached("/terrain/shard_mesh", id);
        if (shard) {
          addToScenes(scenes, shard);
        }
      }
      if (tweaks.showOcclusionMask) {
        addToScenes(scenes, occlusionDebugMeshWriter.occlusionMesh.mesh);
      }
      if (tweaks.showOccluderMesh && i <= tweaks.occlusionMeshStep) {
        const mesh = this.resources.cached("/terrain/occluder_mesh", id);
        if (mesh) {
          addToScenes(scenes, mesh);
        }
      }
      if (
        tweaks.showEditedVoxels &&
        this.authManager.currentUser.hasSpecialRole("admin")
      ) {
        const boxes = this.resources.cached("/terrain/edits_debug_mesh", id);
        if (boxes) {
          addToScenes(scenes, boxes);
        }
      }
      if (
        tweaks.showPlacerVoxels &&
        this.authManager.currentUser.hasSpecialRole("admin")
      ) {
        const boxes = this.resources.cached("/terrain/placer_debug_mesh", id);
        if (boxes) {
          addToScenes(scenes, boxes);
        }
      }
      if (
        tweaks.showDanglingOccupancy &&
        this.authManager.currentUser.hasSpecialRole("admin")
      ) {
        const boxes = this.resources.cached(
          "/terrain/dangling_occupancy_mesh",
          id
        );
        if (boxes) {
          addToScenes(scenes, boxes);
        }
      }
      if (tweaks.showWaterSources) {
        const shard = this.resources.cached("/water/debug", id);
        if (shard) {
          addToScenes(scenes, shard);
        }
      }
    }

    // Render all of each type so that similar materials are rendered
    // consecutively to improve performance.
    for (const blockMesh of blockMeshes) {
      addToScene(scenes.base, blockMesh);
    }
    for (const floraMesh of floraMeshes) {
      addToScene(scenes.base, floraMesh);
    }
    for (const glassMesh of glassMeshes) {
      addToScene(scenes.translucent, glassMesh);
    }
    // Farthest first: under sortObjects=false, insertion order is draw order,
    // so this is what actually gives water correct back-to-front blending.
    waterMeshes.sort((a, b) => b.distance - a.distance);
    for (const { mesh } of waterMeshes) {
      addToScene(scenes.water, mesh);
    }
  }

  private updateHarthmereTerrainPrewarm(position: ReadonlyVec3) {
    // HARTHMERE_TERRAIN_PREWARM_IS_NOT_A_LOCAL_DEV_FEATURE (2026-08-03).
    //
    // This used to early-return on `!shouldRenderHarthmereRuntimeAssets()`,
    // which is true only on localhost or with the `biomes.harthmereAssets`
    // localStorage key set. So the shard pre-warm ring — whose entire job is to
    // hide the whitespace-pop and hitch after spawn and after a long fast-travel
    // move — ran on developer machines and never for a single real player. That
    // also made it invisible in every local test of the thing it exists to fix.
    //
    // Nothing in here touches Harthmere runtime assets. It reads `/ecs/terrain`
    // and warms `/terrain/occluder` + `/terrain/combined_mesh`: all native
    // terrain resources that exist in every build. It borrowed that flag only
    // because the tuning constants happen to live in a Harthmere module.
    //
    // It is safe to run everywhere because it is bounded on all four axes:
    // at most 144 probes per plan, replanned at most once per second and only
    // after the player moves 64 m, never more than 2 fetches in flight, and it
    // skips shards already cached. `docs/harthmere/PERFORMANCE_AND_PLACEMENT.md`
    // already documents it as a shipped guardrail; the code simply disagreed.
    const config = HARTHMERE_PERF_AND_PLACEMENT_PREWARM;
    const now = performance.now();
    const previous = this.harthmerePrewarmOrigin;
    const movedFarEnough =
      !previous ||
      distSq(previous, position) >= config.teleportPrewarmThresholdMeters ** 2;
    if (movedFarEnough && now - this.harthmerePrewarmLastPlanAt >= 1_000) {
      this.harthmerePrewarmLastPlanAt = now;
      const queued = new Set<ShardId>();
      const radius = config.ringRadiusMeters;
      const stride = config.probeStrideMeters;
      for (let dx = -radius; dx <= radius; dx += stride) {
        for (let dz = -radius; dz <= radius; dz += stride) {
          if (dx * dx + dz * dz > radius * radius) continue;
          const shard = voxelShard(
            position[0] + dx,
            position[1],
            position[2] + dz
          );
          if (this.resources.get("/ecs/terrain", shard)) {
            queued.add(shard);
          }
        }
      }
      const planned = [...queued]
        .sort(
          (a, b) =>
            distSq(shardCenter(a), position) - distSq(shardCenter(b), position)
        )
        .slice(0, config.maxProbesPerPrewarm);
      if (planned.length > 0) {
        this.harthmerePrewarmOrigin = [...position] as Vec3;
        this.harthmerePrewarmQueue = planned;
      }
    }

    while (
      this.harthmerePrewarmInFlight < 2 &&
      this.harthmerePrewarmQueue.length > 0
    ) {
      const shard = this.harthmerePrewarmQueue.shift()!;
      if (
        this.resources.cached("/terrain/occluder", shard) &&
        this.resources.cached("/terrain/combined_mesh", shard)
      ) {
        continue;
      }
      this.harthmerePrewarmInFlight += 1;
      void Promise.all([
        this.resources.get("/terrain/occluder", shard),
        this.resources.get("/terrain/combined_mesh", shard),
      ])
        .catch(() => {})
        .finally(() => {
          this.harthmerePrewarmInFlight -= 1;
        });
    }
  }

  // PERF (2026-08-03 render audit): formerly destructionUniforms(shardId),
  // called once per visible shard per frame. Every call re-read
  // /scene/local_player plus both /materials/* resources and then threw the
  // work away for all but (at most) one shard, since destroyInfo describes a
  // single voxel. Resolve the target shard and its uniforms once per frame and
  // let the draw loop compare shard ids. Behaviourally identical -- the guard
  // conditions below are unchanged, only `destroyShard === shardId` has moved
  // out to the caller.
  private destructionUniformsForFrame():
    | { shardId: ShardId; uniforms: Partial<BlocksUniforms & GlassUniforms> }
    | undefined {
    const player = this.resources.get("/scene/local_player");
    const destroyShard = player.destroyInfo
      ? voxelShard(...player.destroyInfo.pos)
      : undefined;

    const destroyingMaterial = this.resources.cached(
      "/materials/destroying_material"
    );
    const shapingMaterial = this.resources.cached(
      "/materials/shaping_material"
    );

    // Populate the destruction animation uniforms.
    if (
      player.destroyInfo &&
      destroyShard &&
      !player.destroyInfo.groupId &&
      destroyingMaterial &&
      shapingMaterial
    ) {
      let percentage = player.destroyInfo.percentage ?? 0;
      if (player.destroyInfo.finished) {
        if (player.destroyInfo.activeAction.action === "destroy") {
          percentage = 1.0;
        } else {
          percentage = 0.0;
        }
      }

      const ret = {
        ...getDestructionAnimationUniforms(
          player.destroyInfo.pos as Vec3,
          player.destroyInfo.activeAction.action === "destroy" &&
            player.destroyInfo.canDestroy
            ? percentage
            : -1,
          destroyingMaterial.numFrames
        ),

        ...getShapingAnimationUniforms(
          player.destroyInfo.pos as Vec3,
          player.destroyInfo.activeAction.action === "shape" ||
            player.destroyInfo.activeAction.action === "till"
            ? percentage
            : -1,
          shapingMaterial.numFrames
        ),
      };
      return { shardId: destroyShard, uniforms: ret };
    }
  }

  private highlightOutOfDateShard(
    path: Key<ClientResourcePaths>,
    id: ShardId,
    scenes: Scenes
  ) {
    if (
      this.resources.cachedVersion(path, id) == this.resources.version(path, id)
    ) {
      return false;
    }

    const shardMesh = this.resources.cached("/terrain/shard_mesh", id);
    if (shardMesh) {
      addToScenes(scenes, shardMesh);
    }
    return true;
  }
}

function getDestructionAnimationUniforms(
  pos: ReadonlyVec3,
  completion: number,
  frames: number
) {
  const frame =
    completion > 0 ? Math.floor(clamp(frames * completion, 0, frames - 1)) : -1;
  return {
    destroyPos: pos as Vec3,
    destroyTextureFrame: frame,
  };
}

function getShapingAnimationUniforms(
  pos: ReadonlyVec3,
  completion: number,
  frames: number
) {
  const frame =
    completion > 0 ? Math.floor(clamp(frames * completion, 0, frames - 1)) : -1;
  return {
    shapePos: pos as Vec3,
    shapeTextureFrame: frame,
  };
}
