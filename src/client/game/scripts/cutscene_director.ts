// HARTHMERE_CUTSCENE_DIRECTOR_SCRIPT
//
// The client-side executor for the pure cutscene runtime (director_core).
// Ticks BEFORE CameraScript (registration order in init_renderer.ts) so the
// pose written to /scene/waypoint_camera/active lands in the same frame.
//
// Responsibilities:
//  * drain cutscene requests (cutscene_service) into the queue;
//  * build providers over live resources (positions, shards, player health);
//  * execute runtime effects against resources / events / audio;
//  * drive actor visuals via the puppet bridge (clientPuppet mode) and via
//    SetNPCPositionEvent streaming (serverShared mode, become_npc precedent);
//  * snapshot + restore world overrides (time of day, HUD, fov) even when the
//    scene ends abnormally (clear() on teardown aborts through the same
//    finish path).

import type { Events } from "@/client/game/context_managers/events";
import type { CutscenePlayerAttackAnimation } from "@/client/game/cutscene/player_attack_visual";
import type { AudioManager } from "@/client/game/context_managers/audio_manager";
import { allAabbShardsLoaded } from "@/client/game/helpers/player_shards";
import {
  groundHarthmereLiveEntityFeetY,
  harthmereTerrainBlocksSight,
} from "@/client/game/util/harthmere_entity_grounding";
import { getCamOrientation } from "@/client/game/util/camera";
import type { ClientTable } from "@/client/game/game";
import type { WaypointCameraActive } from "@/client/game/resources/camera";
import { emptyCutsceneUiState } from "@/client/game/resources/cutscene";
import { ParticleSystem } from "@/client/game/resources/particles";
import type { ClientResources } from "@/client/game/resources/types";
import { getActiveRendererController } from "@/client/game/renderers/capture_bridge";
import type { Script } from "@/client/game/scripts/script_controller";
import { selectBackgroundMusicTrack } from "@/client/game/scripts/audio";
import { publishHarthmereLiveCreatureSnapshot } from "@/client/game/scripts/harthmere_live_creature_bridge_script";
import {
  combatImpactParticleMaterials,
  exoticMatterCreationParticleMaterials,
} from "@/client/game/util/particles_systems";
import {
  cutsceneQueue,
  drainCutsceneRequests,
  getCutsceneHook,
  runCutsceneCommitOnce,
} from "@/client/game/cutscene/cutscene_service";
import { publishCutscenePlayback } from "@/client/game/cutscene/playback_events";
import {
  deliverCutsceneCapture,
  failCutsceneCapture,
  failCutsceneCapturesForDef,
} from "@/client/game/cutscene/capture_service";
import type { ResolvedActor } from "@/shared/cutscene/binding";
import { resolveCast } from "@/shared/cutscene/binding";
import type {
  CutsceneEffect,
  CutsceneRuntime,
  CutsceneRuntimeProviders,
} from "@/shared/cutscene/director_core";
import { createCutsceneRuntime } from "@/shared/cutscene/director_core";
import type { CutsceneDef, CutsceneVec3 } from "@/shared/cutscene/schema";
import type { CutscenePuppetOverride } from "@/shared/cutscene/puppets";
import {
  clearCutscenePuppetOverrides,
  publishCutscenePuppetOverrides,
} from "@/shared/cutscene/puppets";
import { buildCutsceneWorldIndex } from "@/client/game/cutscene/client_bindings";
import { SetNPCPositionEvent } from "@/shared/ecs/gen/events";
import { zEmoteType } from "@/shared/ecs/gen/types";
import {
  PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES,
  PLAYER_MOVEMENT_ACTION_TIMING,
  type PlayerMovementActionAnimationName,
} from "@/shared/game/movement_actions";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { fireAndForget, sleep } from "@/shared/util/async";
import { EventThrottle } from "@/shared/util/throttling";

const NPC_STREAM_THROTTLE_MS = 100; // become_npc precedent

interface TimeOfDaySnapshot {
  overrideTimeOfDay: boolean;
  timeOfDay: number;
}

interface CutsceneResourceSnapshot {
  waypointCamera: WaypointCameraActive;
  fov: number;
}

interface DeferredEffect {
  at: number;
  order: number;
  effect: CutsceneEffect;
}

export class CutsceneDirectorScript implements Script {
  readonly name = "cutsceneDirector";

  private runtime?: CutsceneRuntime;
  private activeDef?: CutsceneDef;
  private actors = new Map<string, ResolvedActor>();
  private overrides = new Map<number, CutscenePuppetOverride>();
  private actorItems = new Map<number, number>();
  private npcStreamThrottles = new Map<number, EventThrottle>();
  private timeOfDaySnapshot?: TimeOfDaySnapshot;
  private lastAppliedTimeOfDay?: number;
  private fovOverride?: number;
  private resourceSnapshot?: CutsceneResourceSnapshot;
  private deferredEffects: DeferredEffect[] = [];
  private deferredEffectOrder = 0;
  private runtimePausedUntil = 0;
  private fadeInVisibleUntil = 0;
  private cutsceneParticleKeys = new Set<string>();
  private vfxGeneration = 0;
  private vfxSerial = 0;
  private pendingVfxLoads = 0;
  private pendingVfxCaptures: Array<
    Extract<CutsceneEffect, { kind: "capture" }>
  > = [];
  private vfxLoadError?: string;

  constructor(
    private readonly userId: BiomesId,
    private readonly resources: ClientResources,
    private readonly table: ClientTable,
    private readonly events: Events,
    private readonly audioManager?: AudioManager
  ) {}

  clear() {
    // Teardown mid-scene: run the abort finish path so HUD/camera/tweaks and
    // actor authority are always restored.
    if (this.runtime && !this.runtime.finished) {
      this.executeEffects(this.runtime.abort(), true);
    }
    if (this.activeDef) {
      failCutsceneCapturesForDef(
        this.activeDef.id,
        "cutscene director cleared"
      );
    }
    this.flushDeferredEffects(true);
    this.cleanupInstance();
    cutsceneQueue.clear();
  }

  tick(dt: number) {
    this.flushDeferredEffects();
    this.drainRequests();

    if (!this.runtime) {
      return;
    }

    const now = performance.now();
    if (this.runtime.finished) {
      if (this.deferredEffects.length === 0 && now >= this.fadeInVisibleUntil) {
        this.finishInstanceAndStartNext();
      }
      return;
    }

    if (now < this.runtimePausedUntil) {
      this.publishPuppetsAndPresentation();
      return;
    }

    // Overlay-driven skip requests.
    const ui = this.resources.get("/scene/cutscene");
    if (ui.skipRequested) {
      this.runtime.requestSkip();
      this.resources.update("/scene/cutscene", (s) => {
        s.skipRequested = false;
      });
    }

    const effects = this.runtime.tick(dt, this.makeProviders());
    this.executeEffects(effects);

    this.publishPuppetsAndPresentation();
    if (
      this.runtime.finished &&
      this.deferredEffects.length === 0 &&
      performance.now() >= this.fadeInVisibleUntil
    ) {
      this.finishInstanceAndStartNext();
    }
  }

  private publishPuppetsAndPresentation() {
    publishCutscenePuppetOverrides([...this.overrides.values()]);
    publishHarthmereLiveCreatureSnapshot(this.table);
    this.updateSkipUi();
    this.applyFovOverride();
  }

  private finishInstanceAndStartNext() {
    if (this.activeDef) {
      failCutsceneCapturesForDef(
        this.activeDef.id,
        `cutscene ended before all requested captures completed`
      );
    }
    this.cleanupInstance();
    const next = cutsceneQueue.onFinished();
    if (next) {
      this.startScene(next);
    }
  }

  // ---------------------------------------------------------------------
  // Scene lifecycle
  // ---------------------------------------------------------------------

  private drainRequests() {
    for (const request of drainCutsceneRequests()) {
      const startNow = cutsceneQueue.request(request, {
        skipActive: () => this.runtime?.requestSkip(),
        preemptActive: () => {
          if (this.runtime && !this.runtime.finished) {
            this.executeEffects(this.runtime.abort());
          }
        },
      });
      if (startNow) {
        this.startScene(startNow);
      }
    }
  }

  private startScene(def: CutsceneDef) {
    const world = buildCutsceneWorldIndex(
      this.userId,
      this.resources,
      this.table
    );
    const resolution = resolveCast(def, world);
    if (!resolution.ok) {
      log.warn(
        `cutscene "${def.id}" cancelled: ${resolution.cancelReason}; ` +
          resolution.diagnostics.join("; ")
      );
      // Cast failure happens before the runtime can emit its normal finish
      // effect. Still close the lifecycle so previews and MediaRecorder jobs
      // fail promptly instead of waiting for a multi-minute timeout.
      publishCutscenePlayback({
        kind: "finished",
        defId: def.id,
        reason: "cancelled",
        atMs: Date.now(),
      });
      if (def.settings.commitOn.includes("cancelled")) {
        this.commitEndStateForCancelledScene(def);
      }
      failCutsceneCapturesForDef(
        def.id,
        resolution.cancelReason ?? "cutscene cast resolution failed"
      );
      const next = cutsceneQueue.onFinished();
      if (next) {
        this.startScene(next);
      }
      return;
    }
    const waypoint = this.resources.get("/scene/waypoint_camera/active");
    this.resourceSnapshot = {
      waypointCamera:
        waypoint.kind === "active"
          ? {
              kind: "active",
              value: [[...waypoint.value[0]], [...waypoint.value[1]]],
            }
          : { kind: "empty" },
      fov: this.resources.get("/scene/camera").three.fov,
    };
    this.actors = resolution.actors;
    this.activeDef = def;
    this.vfxGeneration += 1;
    this.vfxSerial = 0;
    this.pendingVfxLoads = 0;
    this.pendingVfxCaptures = [];
    this.vfxLoadError = undefined;
    this.runtime = createCutsceneRuntime({ def, actors: resolution.actors });
    if (def.settings.lockPlayer) {
      this.resources.update("/sim/player", this.userId, (player) => {
        player.velocity = [0, 0, 0];
        player.previousPosition = [...player.position];
      });
    }
    this.resources.update("/scene/cutscene", (s) => {
      s.active = true;
      s.defId = def.id;
      s.lockInput = def.settings.lockPlayer;
      s.invulnerable = def.settings.invulnerablePlayer;
      s.musicOverride = def.settings.music;
    });
  }

  private commitEndStateForCancelledScene(def: CutsceneDef) {
    const token = `cutscene:${def.id}:v${def.version}:cancelled`;
    fireAndForget(
      this.runCommitWithRetry(token, async () => {
        for (const commit of def.onEnd.commits) {
          const hook = getCutsceneHook(commit.hook);
          if (!hook) {
            throw new Error(
              `cutscene "${def.id}": unknown commit hook "${commit.hook}"`
            );
          }
          await hook(commit.payload);
        }
      })
    );
  }

  private cleanupInstance() {
    this.cleanupCutsceneParticles();
    this.applyTimeOfDay(undefined);
    if (this.resourceSnapshot) {
      this.resources.set(
        "/scene/waypoint_camera/active",
        this.resourceSnapshot.waypointCamera
      );
      const camera = this.resources.get("/scene/camera");
      camera.three.fov = this.resourceSnapshot.fov;
      camera.three.updateProjectionMatrix();
    }
    if (this.activeDef?.settings.lockPlayer) {
      this.resources.update("/sim/player", this.userId, (player) => {
        // Never release retained pre-cutscene momentum into the restored world.
        player.velocity = [0, 0, 0];
        player.previousPosition = [...player.position];
      });
    }
    if (this.activeDef) {
      const localPlayer = this.resources.get("/scene/local_player");
      // Cinematic emotes are eager player emotes, not puppet metadata. They
      // must be explicitly cancelled or the body/face can remain in the final
      // expression after camera authority returns to gameplay.
      localPlayer.player.eagerCancelEmote(this.events);
      // Re-enter ambient playback from the visible local-player region rather
      // than retaining a scene's generic music or waiting on a lagging ECS
      // position. The normal AudioScript tick remains authoritative for combat,
      // caves and minigames immediately afterward.
      this.audioManager?.setBackgroundMusicTrack(
        selectBackgroundMusicTrack(
          this.resources.get("/camera/environment").muckyness.get(),
          false,
          localPlayer.player.position
        )
      );
    }
    this.runtime = undefined;
    this.activeDef = undefined;
    this.actors = new Map();
    this.overrides.clear();
    this.actorItems.clear();
    this.npcStreamThrottles.clear();
    this.fovOverride = undefined;
    this.lastAppliedTimeOfDay = undefined;
    this.resourceSnapshot = undefined;
    this.deferredEffects = [];
    this.runtimePausedUntil = 0;
    this.fadeInVisibleUntil = 0;
    clearCutscenePuppetOverrides();
    this.resources.set("/scene/cutscene", emptyCutsceneUiState());
  }

  private cleanupCutsceneParticles() {
    this.vfxGeneration += 1;
    const particleSystems = this.resources.get("/scene/particles");
    let changed = false;
    for (const key of this.cutsceneParticleKeys) {
      const system = particleSystems.get(key);
      if (!system) {
        continue;
      }
      particleSystems.delete(key);
      system.materials.dispose();
      changed = true;
    }
    this.cutsceneParticleKeys.clear();
    this.pendingVfxLoads = 0;
    this.pendingVfxCaptures = [];
    this.vfxLoadError = undefined;
    if (changed) {
      this.resources.set("/scene/particles", particleSystems);
    }
  }

  private updateSkipUi() {
    if (!this.runtime || !this.activeDef) {
      return;
    }
    const canSkip =
      this.activeDef.settings.skippable ||
      this.runtime.elapsed >= this.activeDef.settings.skipAfterSeconds;
    const shot = this.activeDef.shots[this.runtime.currentShotIndex];
    const canAdvance =
      shot?.until?.kind === "playerInput" &&
      this.runtime.currentShotElapsed >= shot.duration;
    const ui = this.resources.get("/scene/cutscene");
    if (ui.canSkip !== canSkip || ui.canAdvance !== canAdvance) {
      this.resources.update("/scene/cutscene", (s) => {
        s.canSkip = canSkip;
        s.canAdvance = canAdvance;
        if (!canAdvance) {
          s.advanceRequested = false;
        }
      });
    }
  }

  // ---------------------------------------------------------------------
  // Providers
  // ---------------------------------------------------------------------

  private makeProviders(): CutsceneRuntimeProviders {
    return {
      livePositionOf: (actor) => this.livePositionOf(actor),
      liveOrientationOf: (actor) => {
        if (actor.kind === "player") {
          const localPlayer = this.resources.get("/scene/local_player");
          return [...localPlayer.player.orientation] as [number, number];
        }
        if (actor.kind === "entity") {
          const orientation = this.resources.get(
            "/ecs/c/orientation",
            actor.entityId as BiomesId
          );
          return orientation?.v
            ? ([...orientation.v] as [number, number])
            : undefined;
        }
        return undefined;
      },
      playerAlive: () => {
        const health = this.resources.get("/ecs/c/health", this.userId);
        if (health && typeof health.hp === "number") {
          return health.hp > 0;
        }
        return true;
      },
      worldReadyAt: (position) =>
        allAabbShardsLoaded(this.resources, [
          [position[0] - 8, position[1] - 8, position[2] - 8],
          [position[0] + 8, position[1] + 8, position[2] + 8],
        ]),
      advanceRequested: () => {
        const ui = this.resources.get("/scene/cutscene");
        if (ui.advanceRequested) {
          this.resources.update("/scene/cutscene", (s) => {
            s.advanceRequested = false;
          });
          return true;
        }
        return false;
      },
      groundPosition: (_actor, desired) => {
        const groundedY = groundHarthmereLiveEntityFeetY(
          this.resources,
          desired[0],
          desired[2],
          desired[1],
          false
        );
        return groundedY === undefined
          ? [...desired]
          : [desired[0], groundedY, desired[2]];
      },
      resolveCameraPose: (pose) => {
        for (let dy = 0; dy <= 8; dy += 1) {
          const position: CutsceneVec3 = [
            pose.position[0],
            pose.position[1] + dy,
            pose.position[2],
          ];
          if (
            !harthmereTerrainBlocksSight(
              this.resources,
              Math.floor(position[0]),
              Math.floor(position[1]),
              Math.floor(position[2])
            )
          ) {
            return dy === 0 ? pose : { ...pose, position };
          }
        }
        return undefined;
      },
    };
  }

  private livePositionOf(actor: ResolvedActor): CutsceneVec3 | undefined {
    if (actor.kind === "player") {
      const scenePlayer = this.resources.get("/scene/player", this.userId);
      return [...scenePlayer.position] as CutsceneVec3;
    }
    if (actor.kind === "entity") {
      const position = this.resources.get(
        "/ecs/c/position",
        actor.entityId as BiomesId
      );
      return position?.v ? ([...position.v] as CutsceneVec3) : undefined;
    }
    return undefined;
  }

  // ---------------------------------------------------------------------
  // Effect execution
  // ---------------------------------------------------------------------

  private executeEffects(effects: CutsceneEffect[], immediate = false) {
    const now = performance.now();
    let cursor = now;
    let fadeInEnd = this.fadeInVisibleUntil;
    for (const effect of effects) {
      if (immediate || effect.kind !== "fade") {
        const at =
          !immediate && effect.kind === "finished"
            ? Math.max(cursor, fadeInEnd)
            : cursor;
        this.deferOrExecute(effect, at, immediate);
        continue;
      }

      this.deferOrExecute(effect, cursor, false);
      const durationMs = effect.duration * 1000;
      if (effect.direction === "out" && effect.blocking) {
        cursor += durationMs;
        this.runtimePausedUntil = Math.max(this.runtimePausedUntil, cursor);
      } else {
        fadeInEnd = Math.max(fadeInEnd, cursor + durationMs);
        this.fadeInVisibleUntil = fadeInEnd;
      }
    }
    this.flushDeferredEffects(immediate);
  }

  private deferOrExecute(
    effect: CutsceneEffect,
    at: number,
    immediate: boolean
  ) {
    if (immediate || at <= performance.now()) {
      this.executeEffectSafely(effect);
      return;
    }
    this.deferredEffects.push({
      at,
      order: this.deferredEffectOrder++,
      effect,
    });
    this.deferredEffects.sort((a, b) => a.at - b.at || a.order - b.order);
  }

  private flushDeferredEffects(force = false) {
    const now = performance.now();
    while (
      this.deferredEffects.length > 0 &&
      (force || this.deferredEffects[0].at <= now)
    ) {
      const deferred = this.deferredEffects.shift()!;
      this.executeEffectSafely(deferred.effect);
    }
  }

  private executeEffectSafely(effect: CutsceneEffect) {
    try {
      this.executeEffect(effect);
    } catch (error) {
      // One bad effect must never wedge the scene (or the finish path).
      log.error(`cutscene effect ${effect.kind} failed`, { error });
    }
  }

  private executeEffect(effect: CutsceneEffect) {
    switch (effect.kind) {
      case "begin":
        publishCutscenePlayback({
          kind: "started",
          defId: effect.defId,
          atMs: Date.now(),
        });
        break;
      case "cameraPose":
        this.resources.set("/scene/waypoint_camera/active", {
          kind: "active",
          value: [[...effect.pose.position], [...effect.pose.orientation]],
        });
        this.resources.update("/scene/camera", (camera) => {
          camera.isFirstPerson = false;
          camera.three.setRotationFromQuaternion(
            getCamOrientation(effect.pose.orientation)
          );
          camera.three.position.fromArray(effect.pose.position);
          camera.three.updateMatrixWorld();
          camera.three.updateProjectionMatrix();
          camera.updateFrustumBoundingSphere();
        });
        break;
      case "cameraClear":
        this.resources.set(
          "/scene/waypoint_camera/active",
          this.resourceSnapshot?.waypointCamera ?? { kind: "empty" }
        );
        break;
      case "hud":
        this.resources.update("/scene/cutscene", (s) => {
          s.hideHud = effect.hidden;
        });
        break;
      case "letterbox":
        this.resources.update("/scene/cutscene", (s) => {
          s.letterbox = effect.on;
        });
        break;
      case "lockInput":
        this.resources.update("/scene/cutscene", (s) => {
          s.lockInput = effect.on;
        });
        break;
      case "invulnerable":
        this.resources.update("/scene/cutscene", (s) => {
          s.invulnerable = effect.on;
        });
        break;
      case "timeOfDay":
        this.applyTimeOfDay(effect.value);
        break;
      case "music":
        this.resources.update("/scene/cutscene", (s) => {
          s.musicOverride = effect.track;
        });
        break;
      case "fov":
        this.fovOverride = effect.fov;
        if (effect.fov !== undefined) {
          const camera = this.resources.get("/scene/camera");
          camera.three.fov = effect.fov;
          camera.three.updateProjectionMatrix();
        } else if (this.resourceSnapshot) {
          const camera = this.resources.get("/scene/camera");
          camera.three.fov = this.resourceSnapshot.fov;
          camera.three.updateProjectionMatrix();
        }
        break;
      case "fade":
        this.resources.update("/scene/cutscene", (s) => {
          s.fadeTransitionMs = Math.round(effect.duration * 1000);
          s.fadeOpacity = effect.direction === "out" ? 1 : 0;
        });
        break;
      case "subtitle":
        this.resources.update("/scene/cutscene", (s) => {
          s.subtitle = effect.value;
        });
        break;
      case "actorPose":
        this.applyActorPose(effect);
        break;
      case "actorAnimation":
        this.applyActorAnimation(effect);
        break;
      case "actorItem":
        this.applyActorItem(effect);
        break;
      case "actorRelease":
        this.releaseActor(effect.actor);
        publishCutscenePuppetOverrides([...this.overrides.values()]);
        break;
      case "sfx":
        try {
          // Best-effort: unknown asset names no-op inside the audio manager.
          if (effect.position) {
            this.audioManager?.playSoundAt(
              effect.name as never,
              effect.position
            );
          } else {
            this.audioManager?.playSound(effect.name as never);
          }
        } catch {
          // Ignore unknown sfx.
        }
        break;
      case "shake":
        this.resources.update("/scene/camera_effects", (fx) => {
          fx.effects.push({
            kind: "shake",
            dampedMagnitude: effect.magnitude,
            repeats: effect.repeats,
            duration: effect.durationMs,
            start: performance.now(),
          });
        });
        break;
      case "vfx":
        this.spawnVfx(effect);
        break;
      case "custom": {
        const hook = getCutsceneHook(effect.hook);
        if (hook) {
          fireAndForget(Promise.resolve(hook(effect.payload)));
        } else {
          log.warn(`cutscene: unknown custom hook "${effect.hook}"`);
        }
        break;
      }
      case "capture":
        this.captureFrameWhenVfxReady(effect);
        break;
      case "commitEndState":
        this.commitEndState(effect);
        break;
      case "finished":
        if (this.activeDef) {
          publishCutscenePlayback({
            kind: "finished",
            defId: this.activeDef.id,
            reason: effect.reason,
            atMs: Date.now(),
          });
        }
        break;
    }
  }

  private spawnVfx(effect: Extract<CutsceneEffect, { kind: "vfx" }>) {
    const generation = this.vfxGeneration;
    const activeDefId = this.activeDef?.id;
    const serial = this.vfxSerial++;
    this.pendingVfxLoads += 1;
    const loadMaterials =
      effect.effect === "combatImpact"
        ? combatImpactParticleMaterials
        : exoticMatterCreationParticleMaterials;
    fireAndForget(
      loadMaterials()
        .then((materials) => {
          if (
            generation !== this.vfxGeneration ||
            !activeDefId ||
            this.activeDef?.id !== activeDefId
          ) {
            for (const material of materials) {
              material.dispose();
            }
            return;
          }
          const particleSystems = this.resources.get("/scene/particles");
          const startTime = this.resources.get("/clock").time;
          for (const [layer, material] of materials.entries()) {
            const key = `cutscene-vfx:${activeDefId}:${serial}:${layer}`;
            const system = new ParticleSystem(material, startTime);
            system.three.position.fromArray(effect.position);
            // Scale belongs to the scene action rather than the shared particle
            // material, so a promo impact can read at cinematic distance without
            // making every gameplay-sized combat hit enormous.
            system.three.scale.setScalar(effect.scale);
            particleSystems.set(key, system);
            this.cutsceneParticleKeys.add(key);
          }
          this.resources.set("/scene/particles", particleSystems);
        })
        .catch((error) => {
          if (generation === this.vfxGeneration) {
            this.vfxLoadError = String(error);
          }
          log.error(`cutscene VFX ${effect.effect} failed`, { error });
        })
        .finally(() => {
          if (generation !== this.vfxGeneration) {
            return;
          }
          this.pendingVfxLoads = Math.max(0, this.pendingVfxLoads - 1);
          if (this.pendingVfxLoads === 0) {
            this.flushPendingVfxCaptures();
          }
        })
    );
  }

  private captureFrameWhenVfxReady(
    effect: Extract<CutsceneEffect, { kind: "capture" }>
  ) {
    if (this.pendingVfxLoads > 0) {
      this.pendingVfxCaptures.push(effect);
      return;
    }
    if (this.vfxLoadError) {
      failCutsceneCapture(
        effect.captureId,
        `cutscene VFX failed before capture: ${this.vfxLoadError}`
      );
      return;
    }
    fireAndForget(this.captureFrameAfterSettledFrames(effect));
  }

  private async captureFrameAfterSettledFrames(
    effect: Extract<CutsceneEffect, { kind: "capture" }>
  ) {
    const activeDefId = this.activeDef?.id;
    for (let frame = 0; frame < effect.settleFrames; frame += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
    }
    if (!activeDefId || this.activeDef?.id !== activeDefId) {
      failCutsceneCapture(
        effect.captureId,
        "cutscene ended while waiting for capture settle frames"
      );
      return;
    }
    this.captureFrame(effect);
  }

  private flushPendingVfxCaptures() {
    const captures = this.pendingVfxCaptures.splice(
      0,
      this.pendingVfxCaptures.length
    );
    for (const capture of captures) {
      this.captureFrameWhenVfxReady(capture);
    }
  }

  private applyTimeOfDay(value: number | undefined) {
    if (value !== undefined) {
      if (!this.timeOfDaySnapshot) {
        const tweaks = this.resources.get("/tweaks");
        this.timeOfDaySnapshot = {
          overrideTimeOfDay: tweaks.overrideTimeOfDay,
          timeOfDay: tweaks.timeOfDay,
        };
      }
      this.resources.update("/tweaks", (tweaks) => {
        tweaks.overrideTimeOfDay = true;
        // Sky override is percent-based (see SkyRenderer / AdvancedOptions).
        tweaks.timeOfDay = value * 100;
      });
      this.lastAppliedTimeOfDay = value * 100;
    } else if (this.timeOfDaySnapshot) {
      const snapshot = this.timeOfDaySnapshot;
      this.timeOfDaySnapshot = undefined;
      this.resources.update("/tweaks", (tweaks) => {
        // Do not overwrite a newer external/night-vision/user change made
        // while the cinematic was active.
        if (
          this.lastAppliedTimeOfDay === undefined ||
          tweaks.timeOfDay === this.lastAppliedTimeOfDay
        ) {
          tweaks.overrideTimeOfDay = snapshot.overrideTimeOfDay;
          tweaks.timeOfDay = snapshot.timeOfDay;
        }
      });
      this.lastAppliedTimeOfDay = undefined;
    }
  }

  private applyFovOverride() {
    if (this.fovOverride === undefined) {
      return;
    }
    const camera = this.resources.get("/scene/camera");
    if (camera.three.fov !== this.fovOverride) {
      camera.three.fov = this.fovOverride;
      camera.three.updateProjectionMatrix();
    }
  }

  private applyActorPose(
    effect: Extract<CutsceneEffect, { kind: "actorPose" }>
  ) {
    const { actor, position, yaw } = effect;
    switch (actor.kind) {
      case "player":
        this.resources.update("/sim/player", this.userId, (player) => {
          player.position = [...position];
          player.orientation = [player.orientation[0], yaw];
        });
        break;
      case "entity": {
        const existing = this.overrides.get(actor.entityId);
        this.overrides.set(actor.entityId, {
          ...existing,
          id: actor.entityId,
          at: [...position],
          yaw,
          animation: effect.animation,
          animationTime: effect.animationTime,
          moving: effect.moving,
          motionTime: this.runtime?.elapsed ?? effect.animationTime,
          itemId: this.actorItems.get(actor.entityId),
        });
        if (this.activeDef?.settings.mode === "serverShared") {
          this.streamNpcPosition(actor.entityId, position, yaw);
        }
        break;
      }
      case "ghost": {
        const existing = this.overrides.get(actor.ghostId);
        this.overrides.set(actor.ghostId, {
          ...existing,
          id: actor.ghostId,
          at: [...position],
          yaw,
          animation: effect.animation,
          animationTime: effect.animationTime,
          moving: effect.moving,
          motionTime: this.runtime?.elapsed ?? effect.animationTime,
          itemId: this.actorItems.get(actor.ghostId),
          ghost: {
            asset: actor.asset,
            family: actor.family,
            label: actor.role,
            appearanceSourceEntityId: actor.appearanceSourceEntityId,
          },
        });
        break;
      }
      case "unbound":
      case "anchor":
        break;
    }
  }

  private streamNpcPosition(
    entityId: number,
    position: CutsceneVec3,
    yaw: number
  ) {
    let throttle = this.npcStreamThrottles.get(entityId);
    if (!throttle) {
      throttle = new EventThrottle(NPC_STREAM_THROTTLE_MS);
      this.npcStreamThrottles.set(entityId, throttle);
    }
    if (!throttle.testAndSet()) {
      return;
    }
    fireAndForget(
      this.events.publish(
        new SetNPCPositionEvent({
          id: this.userId,
          entity_id: entityId as BiomesId,
          position: [...position],
          orientation: [0, yaw],
          update_spawn: false,
        })
      )
    );
  }

  private applyActorAnimation(
    effect: Extract<CutsceneEffect, { kind: "actorAnimation" }>
  ) {
    const { actor, animation } = effect;
    if (actor.kind === "player") {
      if (
        PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES.includes(
          animation as PlayerMovementActionAnimationName
        )
      ) {
        const localPlayer = this.resources.get("/scene/local_player");
        const startTime = this.resources.get("/clock").time;
        const movementAnimation =
          animation as PlayerMovementActionAnimationName;
        const duration =
          movementAnimation === "evade"
            ? PLAYER_MOVEMENT_ACTION_TIMING.evade.durationSeconds
            : movementAnimation === "doubleJump"
              ? PLAYER_MOVEMENT_ACTION_TIMING.doubleJump.durationSeconds
              : PLAYER_MOVEMENT_ACTION_TIMING.dodge.durationSeconds;
        localPlayer.player.beginCutsceneMovementAnimation(
          movementAnimation,
          startTime,
          startTime + duration
        );
        return;
      }
      const parsed = zEmoteType.safeParse(animation);
      if (parsed.success) {
        const localPlayer = this.resources.get("/scene/local_player");
        if (parsed.data === "attack1" || parsed.data === "attack2") {
          localPlayer.player.beginCutsceneAttackAnimation(
            parsed.data as CutscenePlayerAttackAnimation,
            this.resources.get("/clock").time
          );
        }
        localPlayer.player.eagerEmote(this.events, this.resources, parsed.data);
      }
      return;
    }
    // Entity/ghost animation state is carried on the following actorPose so it
    // cannot be lost when an emote fires before the first bridge override.
  }

  private applyActorItem(
    effect: Extract<CutsceneEffect, { kind: "actorItem" }>
  ) {
    const id =
      effect.actor.kind === "entity"
        ? effect.actor.entityId
        : effect.actor.kind === "ghost"
          ? effect.actor.ghostId
          : undefined;
    if (id === undefined) {
      return;
    }
    if (effect.itemId === undefined) {
      this.actorItems.delete(id);
    } else {
      this.actorItems.set(id, effect.itemId);
    }
    const existing = this.overrides.get(id);
    if (existing) {
      this.overrides.set(id, { ...existing, itemId: effect.itemId });
    }
  }

  private releaseActor(actor: ResolvedActor) {
    if (actor.kind === "player") {
      const localPlayer = this.resources.get("/scene/local_player");
      localPlayer.player.cancelCutsceneMovementAnimation();
      localPlayer.player.cancelCutsceneAttackAnimation();
    } else if (actor.kind === "entity") {
      this.overrides.delete(actor.entityId);
      this.actorItems.delete(actor.entityId);
    } else if (actor.kind === "ghost") {
      this.overrides.delete(actor.ghostId);
      this.actorItems.delete(actor.ghostId);
    }
  }

  private captureFrame(effect: Extract<CutsceneEffect, { kind: "capture" }>) {
    const rendererController = getActiveRendererController();
    if (!rendererController || !this.activeDef) {
      failCutsceneCapture(effect.captureId, "renderer is unavailable");
      return;
    }
    // Ensure the live-creature renderer observes this tick's staged transforms
    // before the synchronous high-resolution draw.
    publishCutscenePuppetOverrides([...this.overrides.values()]);
    publishHarthmereLiveCreatureSnapshot(this.table);
    const priorRenderingEnabled = rendererController.renderingEnabled;
    rendererController.renderingEnabled = false;
    try {
      const capture = rendererController.captureScreenshot({
        width: effect.width,
        height: effect.height,
        format: effect.format,
        deltaSeconds: 0,
      });
      if (!capture) {
        failCutsceneCapture(effect.captureId, "renderer capture failed");
        return;
      }
      const camera = this.resources.get("/scene/camera");
      const waypoint = this.resources.get("/scene/waypoint_camera/active");
      const orientation =
        waypoint.kind === "active"
          ? ([...waypoint.value[1]] as [number, number])
          : ([0, camera.three.rotation.y] as [number, number]);
      deliverCutsceneCapture({
        captureId: effect.captureId,
        defId: this.activeDef.id,
        width: capture.width,
        height: capture.height,
        format: effect.format,
        filename:
          effect.filename ??
          `${this.activeDef.id}-${effect.captureId}.${
            effect.format === "image/jpeg" ? "jpg" : "png"
          }`,
        dataUri: capture.screenshotDataUri,
        cameraPosition: camera.three.position.toArray() as [
          number,
          number,
          number,
        ],
        cameraOrientation: orientation,
        capturedAt: Date.now(),
      });
    } catch (error) {
      failCutsceneCapture(effect.captureId, String(error));
      throw error;
    } finally {
      rendererController.renderingEnabled = priorRenderingEnabled;
    }
  }

  private async runCommitWithRetry(
    token: string,
    work: () => Promise<void>
  ): Promise<void> {
    await runCutsceneCommitOnce(token, async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await work();
          return;
        } catch (error) {
          lastError = error;
          if (attempt < 2) {
            await sleep(250 * 2 ** attempt);
          }
        }
      }
      throw lastError;
    });
  }

  private commitEndState(
    effect: Extract<CutsceneEffect, { kind: "commitEndState" }>
  ) {
    fireAndForget(
      this.runCommitWithRetry(effect.token, async () => {
        for (const placement of effect.placements) {
          const { actor } = placement;
          if (actor.kind === "player") {
            this.resources.update("/sim/player", this.userId, (player) => {
              if (placement.position) {
                player.position = [...placement.position];
              }
              if (placement.orientation) {
                player.orientation = [...placement.orientation];
              }
            });
          } else if (
            actor.kind === "entity" &&
            effect.mode === "serverShared"
          ) {
            await this.events.publish(
              new SetNPCPositionEvent({
                id: this.userId,
                entity_id: actor.entityId as BiomesId,
                position: placement.position
                  ? [...placement.position]
                  : undefined,
                orientation: placement.orientation
                  ? [...placement.orientation]
                  : undefined,
                update_spawn: false,
              })
            );
          }
        }
        for (const commit of effect.commits) {
          const hook = getCutsceneHook(commit.hook);
          if (!hook) {
            throw new Error(`cutscene: unknown commit hook "${commit.hook}"`);
          }
          await hook(commit.payload);
        }
      })
    );
  }
}
