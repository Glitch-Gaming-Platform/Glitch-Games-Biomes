// HARTHMERE_CUTSCENE_DIRECTOR_CORE
//
// The pure cutscene runtime: a state machine that consumes a validated
// CutsceneDef + resolved cast and, per tick, emits *effects as data*. The
// client CutsceneDirector script executes effects against resources/events;
// tests execute them against plain arrays. Nothing here touches the DOM,
// three.js, the ECS table, or the network.
//
// Guarantees (the edge-case contract):
//  * A scene can never hang: every shot has a hard time ceiling.
//  * Skip, abort, and natural completion all run the same cleanup path;
//    end-state commits are explicitly gated by the configured outcome.
//  * Player death mid-scene aborts to the finish path immediately.
//  * moveTo cannot stall: straight-line motion with timeout fallback.
//  * dt spikes are clamped; NaN/negative dt is treated as 0.
//  * Restore effects are always emitted in a fixed order at finish.

import type { ResolvedActor } from "@/shared/cutscene/binding";
import {
  clampDt,
  faceYaw,
  lookAtOrientation,
  orbitPose,
  orientationLerp,
  overShoulderPose,
  samplePolyline,
  v3dist,
  v3lerp,
  yawForward,
} from "@/shared/cutscene/math";
import type {
  CutsceneAction,
  CutsceneCameraPose,
  CutsceneCameraSpec,
  CutsceneDef,
  CutsceneShot,
  CutsceneTargetRef,
  CutsceneVec2,
  CutsceneVec3,
} from "@/shared/cutscene/schema";
import { dialogueDurationSeconds } from "@/shared/cutscene/schema";
import { easeInOut } from "@/shared/math/easing";

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export type CutsceneEffect =
  | { kind: "begin"; defId: string }
  | { kind: "cameraPose"; pose: CutsceneCameraPose }
  | { kind: "cameraClear" }
  | { kind: "hud"; hidden: boolean }
  | { kind: "letterbox"; on: boolean }
  | { kind: "lockInput"; on: boolean }
  | { kind: "invulnerable"; on: boolean }
  | { kind: "timeOfDay"; value: number | undefined }
  | { kind: "music"; track: string | undefined }
  | { kind: "fov"; fov: number | undefined }
  | {
      kind: "fade";
      direction: "in" | "out";
      duration: number;
      /** Cover a cut/teleport/cleanup and pause execution until fully black. */
      blocking?: boolean;
    }
  | {
      kind: "subtitle";
      value?: { speaker?: string; text: string; voice?: string };
    }
  | {
      kind: "actorPose";
      actor: ResolvedActor;
      position: CutsceneVec3;
      yaw: number;
      moving: boolean;
      animation?: string;
      animationTime: number;
    }
  | { kind: "actorAnimation"; actor: ResolvedActor; animation: string }
  | { kind: "actorItem"; actor: ResolvedActor; itemId?: number }
  | { kind: "actorRelease"; actor: ResolvedActor }
  | { kind: "sfx"; name: string; position?: CutsceneVec3 }
  | { kind: "shake"; magnitude: number; repeats: number; durationMs: number }
  | {
      kind: "vfx";
      effect: "exoticMatterCreation" | "combatImpact";
      position: CutsceneVec3;
      scale: number;
    }
  | { kind: "custom"; hook: string; payload?: unknown }
  | {
      kind: "capture";
      captureId: string;
      width: number;
      height: number;
      format: "image/png" | "image/jpeg";
      filename?: string;
      settleFrames: number;
    }
  | {
      kind: "commitEndState";
      token: string;
      mode: "clientPuppet" | "serverShared";
      placements: Array<{
        actor: ResolvedActor;
        position?: CutsceneVec3;
        orientation?: CutsceneVec2;
      }>;
      commits: Array<{ hook: string; payload?: unknown }>;
    }
  | { kind: "finished"; reason: CutsceneFinishReason };

export type CutsceneFinishReason =
  | "completed"
  | "skipped"
  | "aborted"
  | "cancelled";

// ---------------------------------------------------------------------------
// Providers: the runtime's only window on the live world.
// ---------------------------------------------------------------------------

export interface CutsceneRuntimeProviders {
  livePositionOf(actor: ResolvedActor): CutsceneVec3 | undefined;
  liveOrientationOf(actor: ResolvedActor): CutsceneVec2 | undefined;
  playerAlive(): boolean;
  /** Are shards/assets around this position renderable yet? */
  worldReadyAt(position: CutsceneVec3): boolean;
  /** "advance dialogue / continue" input (distinct from skip). */
  advanceRequested(): boolean;
  /** Optional terrain/water grounding for walking puppets. */
  groundPosition?(
    actor: ResolvedActor,
    desired: CutsceneVec3
  ): CutsceneVec3 | undefined;
  /** Resolve/reject a camera pose against streamed terrain. */
  resolveCameraPose?(pose: CutsceneCameraPose): CutsceneCameraPose | undefined;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface PuppetState {
  position: CutsceneVec3;
  yaw: number;
  height: number;
  // Once the scene touches an actor (moveTo/teleport/face/emote) the puppet
  // becomes authoritative until release; before that we track live position.
  controlled: boolean;
  moving: boolean;
  animation?: string;
  animationStartedAt: number;
  move?: {
    action: Extract<CutsceneAction, { kind: "moveTo" }>;
    elapsed: number;
    done: boolean;
  };
}

interface ActiveDialogue {
  speaker?: string;
  text: string;
  voice?: string;
  endsAt: number; // shot clock
}

type Phase = "prewarm" | "running" | "finished";

export interface CutsceneRuntime {
  readonly def: CutsceneDef;
  readonly token: string;
  requestSkip(): void;
  /** Abort immediately (external failure: disconnect, death, teardown). */
  abort(reason?: string): CutsceneEffect[];
  tick(dt: number, providers: CutsceneRuntimeProviders): CutsceneEffect[];
  readonly finished: boolean;
  readonly finishReason: CutsceneFinishReason | undefined;
  /** Elapsed scene time in seconds (for skip gating / UI). */
  readonly elapsed: number;
  readonly currentShotIndex: number;
  readonly currentShotElapsed: number;
}

export function createCutsceneRuntime(args: {
  def: CutsceneDef;
  actors: Map<string, ResolvedActor>;
  instanceNonce?: string;
}): CutsceneRuntime {
  return new CutsceneRuntimeImpl(
    args.def,
    args.actors,
    args.instanceNonce ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  );
}

class CutsceneRuntimeImpl implements CutsceneRuntime {
  readonly token: string;

  private phase: Phase = "prewarm";
  private prewarmStarted = false;
  private prewarmElapsed = 0;
  private sceneElapsed = 0;
  private shotIndex = 0;
  private shotClock = 0;
  private previousShotPose?: CutsceneCameraPose;
  private lastPose?: CutsceneCameraPose;
  private firedActionIdx = new Set<string>();
  private dialogues: ActiveDialogue[] = [];
  private subtitleVisible = false;
  private pendingCaptures: Array<Extract<CutsceneEffect, { kind: "capture" }>> =
    [];
  private puppets = new Map<string, PuppetState>();
  private skipRequested = false;
  private endCommitted = false;
  private reason: CutsceneFinishReason | undefined;
  private startedEffectsEmitted = false;
  private prewarmPositions?: CutsceneVec3[];

  constructor(
    readonly def: CutsceneDef,
    private readonly actors: Map<string, ResolvedActor>,
    instanceNonce: string
  ) {
    this.token = `cutscene:${def.id}:v${def.version}:${instanceNonce}`;
  }

  get finished(): boolean {
    return this.phase === "finished";
  }

  get finishReason(): CutsceneFinishReason | undefined {
    return this.reason;
  }

  get elapsed(): number {
    return this.sceneElapsed;
  }

  get currentShotIndex(): number {
    return this.shotIndex;
  }

  get currentShotElapsed(): number {
    return this.shotClock;
  }

  requestSkip(): void {
    this.skipRequested = true;
  }

  abort(): CutsceneEffect[] {
    if (this.phase === "finished") {
      return [];
    }
    return this.finish("aborted");
  }

  // -------------------------------------------------------------------------

  tick(rawDt: number, providers: CutsceneRuntimeProviders): CutsceneEffect[] {
    if (this.phase === "finished") {
      return [];
    }
    const dt = clampDt(rawDt);
    const effects: CutsceneEffect[] = [];

    // Never trap a dead player in a cutscene.
    if (!providers.playerAlive()) {
      return this.finish("aborted");
    }

    if (this.phase === "prewarm") {
      this.tickPrewarm(dt, providers, effects);
      // tickPrewarm may have advanced the phase; TS can't see the mutation.
      if ((this.phase as Phase) !== "running") {
        return effects;
      }
    }

    this.sceneElapsed += dt;

    if (this.sceneElapsed >= this.def.settings.maxSceneDurationSeconds) {
      return this.finish("aborted");
    }

    // Skip handling: allowed when skippable, and always after skipAfterSeconds.
    if (this.skipRequested) {
      this.skipRequested = false;
      const allowed =
        this.def.settings.skippable ||
        this.sceneElapsed >= this.def.settings.skipAfterSeconds;
      if (allowed) {
        effects.push(...this.finish("skipped"));
        return effects;
      }
    }

    const shot = this.def.shots[this.shotIndex];
    this.shotClock += dt;

    this.refreshUncontrolledPuppets(providers);
    this.tickActions(shot, dt, effects, providers);
    this.tickDialogues(effects);
    this.emitCamera(shot, effects, providers);
    this.emitControlledPoses(effects);
    if (this.pendingCaptures.length > 0) {
      effects.push(...this.pendingCaptures.splice(0));
    }

    if (this.shotShouldEnd(shot, providers)) {
      this.previousShotPose = this.lastPose;
      this.shotIndex += 1;
      this.shotClock = 0;
      this.dialogues = [];
      if (this.shotIndex >= this.def.shots.length) {
        effects.push(...this.finish("completed"));
        return effects;
      }
      const next = this.def.shots[this.shotIndex];
      if (next.transitionIn === "fade") {
        effects.push({
          kind: "fade",
          direction: "out",
          duration: 0.25,
          blocking: true,
        });
        // Stage the incoming camera while the screen is fully covered. The
        // client executor sequences effects around fade durations.
        this.emitCamera(next, effects, providers);
        effects.push({ kind: "fade", direction: "in", duration: 0.25 });
      }
    }

    return effects;
  }

  // -------------------------------------------------------------------------
  // Phases
  // -------------------------------------------------------------------------

  private tickPrewarm(
    dt: number,
    providers: CutsceneRuntimeProviders,
    effects: CutsceneEffect[]
  ): void {
    if (!this.prewarmStarted) {
      this.prewarmStarted = true;
      // Cover the load with a fade and freeze input immediately.
      effects.push({ kind: "lockInput", on: this.def.settings.lockPlayer });
      effects.push({
        kind: "fade",
        direction: "out",
        duration: 0.3,
        blocking: true,
      });
      this.initPuppets(providers);
    }
    this.prewarmElapsed += dt;

    this.prewarmPositions ??= this.buildPrewarmPositions();
    const ready = this.prewarmPositions.every((position) =>
      providers.worldReadyAt(position)
    );
    const timedOut =
      this.prewarmElapsed >= this.def.settings.prewarmTimeoutSeconds;
    if (ready || timedOut) {
      this.phase = "running";
      this.emitBeginEffects(effects);
    }
  }

  private buildPrewarmPositions(): CutsceneVec3[] {
    const positions: CutsceneVec3[] = [];
    for (const shot of this.def.shots) {
      if (shot.camera.kind === "dolly") {
        for (const waypoint of shot.camera.waypoints) {
          positions.push([...waypoint.position]);
        }
      }
      // Sample curved/generated camera paths as well as explicit waypoints.
      // Nine samples catches orbit quadrants and long track motion while the
      // final global cap keeps streaming work bounded.
      for (let sample = 0; sample <= 8; sample += 1) {
        const t = sample / 8;
        const pose = this.sampleCamera(shot, t);
        if (pose) {
          positions.push([...pose.position]);
        }
      }
    }
    for (const puppet of this.puppets.values()) {
      positions.push([...puppet.position]);
    }
    const deduped = positions.filter(
      (position, index) =>
        positions.findIndex((candidate) => v3dist(candidate, position) < 1) ===
        index
    );
    if (deduped.length <= 64) {
      return deduped;
    }
    const sampled: CutsceneVec3[] = [];
    for (let i = 0; i < 64; i += 1) {
      sampled.push(deduped[Math.floor((i * deduped.length) / 64)]);
    }
    return sampled;
  }

  private emitBeginEffects(effects: CutsceneEffect[]): void {
    if (this.startedEffectsEmitted) {
      return;
    }
    this.startedEffectsEmitted = true;
    const s = this.def.settings;
    effects.push({ kind: "begin", defId: this.def.id });
    effects.push({ kind: "lockInput", on: s.lockPlayer });
    effects.push({ kind: "hud", hidden: s.hideHud });
    effects.push({ kind: "letterbox", on: s.letterbox });
    effects.push({ kind: "invulnerable", on: s.invulnerablePlayer });
    if (s.timeOfDay !== undefined) {
      effects.push({ kind: "timeOfDay", value: s.timeOfDay });
    }
    if (s.music !== undefined) {
      effects.push({ kind: "music", track: s.music });
    }
    effects.push({ kind: "fade", direction: "in", duration: 0.4 });
  }

  /**
   * The single finish path used by completion, skip, abort, and cancel.
   * End-state commit is outcome-gated and can only ever be emitted once.
   */
  private finish(reason: CutsceneFinishReason): CutsceneEffect[] {
    const effects: CutsceneEffect[] = [];
    this.phase = "finished";
    this.reason = reason;

    effects.push({ kind: "subtitle", value: undefined });
    effects.push({
      kind: "fade",
      direction: "out",
      duration: 0.3,
      blocking: true,
    });

    if (!this.endCommitted && this.def.settings.commitOn.includes(reason)) {
      this.endCommitted = true;
      const placements = this.def.onEnd.placements
        .map((p) => {
          const actor = this.actors.get(p.role);
          if (!actor || actor.kind === "unbound" || actor.kind === "anchor") {
            return undefined;
          }
          return {
            actor,
            position: p.position,
            orientation: p.orientation,
          };
        })
        .filter((p): p is NonNullable<typeof p> => !!p);
      effects.push({
        kind: "commitEndState",
        token: this.token,
        mode: this.def.settings.mode,
        placements,
        commits: this.def.onEnd.commits,
      });
    }

    // Release every bound actor back to its authority (Anima brain, bridge).
    for (const actor of this.actors.values()) {
      if (actor.kind !== "unbound" && actor.kind !== "anchor") {
        effects.push({ kind: "actorRelease", actor });
      }
    }

    // Fixed restore order: camera, UI, world, then the closing fade-in.
    effects.push({ kind: "cameraClear" });
    effects.push({ kind: "hud", hidden: false });
    effects.push({ kind: "letterbox", on: false });
    effects.push({ kind: "lockInput", on: false });
    effects.push({ kind: "invulnerable", on: false });
    effects.push({ kind: "timeOfDay", value: undefined });
    effects.push({ kind: "music", track: undefined });
    effects.push({ kind: "fov", fov: undefined });
    effects.push({ kind: "fade", direction: "in", duration: 0.4 });
    effects.push({ kind: "finished", reason });
    return effects;
  }

  // -------------------------------------------------------------------------
  // Puppets
  // -------------------------------------------------------------------------

  private initPuppets(providers: CutsceneRuntimeProviders): void {
    for (const [role, actor] of this.actors) {
      if (actor.kind === "unbound") {
        continue;
      }
      const live =
        actor.kind === "ghost"
          ? actor.spawnAt
          : actor.kind === "anchor"
          ? actor.position
          : providers.livePositionOf(actor) ?? [0, 0, 0];
      const orientation =
        actor.kind === "ghost" || actor.kind === "anchor"
          ? ([0, 0] as CutsceneVec2)
          : providers.liveOrientationOf(actor) ?? ([0, 0] as CutsceneVec2);
      this.puppets.set(role, {
        position: [...live] as CutsceneVec3,
        yaw: orientation[1] ?? 0,
        height:
          actor.kind === "player" ||
          actor.kind === "entity" ||
          actor.kind === "ghost" ||
          actor.kind === "anchor"
            ? actor.height
            : 1.8,
        // Ghosts are always ours to drive.
        controlled: actor.kind === "ghost",
        moving: false,
        animationStartedAt: 0,
      });
    }
  }

  private refreshUncontrolledPuppets(
    providers: CutsceneRuntimeProviders
  ): void {
    for (const [role, actor] of this.actors) {
      if (
        actor.kind === "unbound" ||
        actor.kind === "ghost" ||
        actor.kind === "anchor"
      ) {
        continue;
      }
      const puppet = this.puppets.get(role);
      if (!puppet || puppet.controlled) {
        continue;
      }
      const live = providers.livePositionOf(actor);
      if (live) {
        puppet.position = [...live] as CutsceneVec3;
      }
      const orientation = providers.liveOrientationOf(actor);
      if (orientation) {
        puppet.yaw = orientation[1];
      }
    }
  }

  private puppetOf(role: string): PuppetState | undefined {
    return this.puppets.get(role);
  }

  private resolveTarget(ref: CutsceneTargetRef): CutsceneVec3 | undefined {
    if (Array.isArray(ref)) {
      return ref as CutsceneVec3;
    }
    return this.puppetOf(ref.role)?.position;
  }

  private takeControl(role: string): PuppetState | undefined {
    const puppet = this.puppets.get(role);
    if (puppet) {
      puppet.controlled = true;
    }
    return puppet;
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  private actionKey(shot: CutsceneShot, index: number): string {
    return `${shot.id}:${index}`;
  }

  private tickActions(
    shot: CutsceneShot,
    dt: number,
    effects: CutsceneEffect[],
    providers: CutsceneRuntimeProviders
  ): void {
    for (const [i, action] of shot.actions.entries()) {
      const key = this.actionKey(shot, i);
      if (this.shotClock >= action.at && !this.firedActionIdx.has(key)) {
        this.firedActionIdx.add(key);
        this.fireAction(action, effects, providers);
      }
    }
    // Continuous move progression.
    for (const [role, puppet] of this.puppets) {
      const move = puppet.move;
      if (!move || move.done) {
        continue;
      }
      const actor = this.actors.get(role);
      if (!actor || actor.kind === "unbound") {
        move.done = true;
        continue;
      }
      const target = this.resolveTarget(move.action.to);
      if (!target) {
        move.done = true;
        puppet.moving = false;
        continue;
      }
      move.elapsed += dt;
      const remaining = v3dist(puppet.position, target);
      if (remaining <= move.action.arriveWithin) {
        move.done = true;
        puppet.moving = false;
        continue;
      }
      if (move.elapsed > move.action.timeoutSeconds) {
        move.done = true;
        puppet.moving = false;
        if (move.action.timeoutFallback === "teleport") {
          // Cover the pop with a short fade pulse.
          effects.push({
            kind: "fade",
            direction: "out",
            duration: 0.15,
            blocking: true,
          });
          puppet.yaw = faceYaw(puppet.position, target);
          puppet.position =
            actor.kind === "ghost"
              ? ([...target] as CutsceneVec3)
              : providers.groundPosition?.(actor, target) ??
                ([...target] as CutsceneVec3);
          effects.push({ kind: "fade", direction: "in", duration: 0.15 });
        }
        continue;
      }
      const step = Math.min(move.action.speed * dt, remaining);
      const dir = v3lerp(puppet.position, target, step / remaining);
      puppet.yaw = faceYaw(puppet.position, target);
      puppet.position =
        actor.kind === "ghost"
          ? dir
          : providers.groundPosition?.(actor, dir) ?? dir;
      puppet.moving = true;
    }
  }

  private fireAction(
    action: CutsceneAction,
    effects: CutsceneEffect[],
    providers: CutsceneRuntimeProviders
  ): void {
    switch (action.kind) {
      case "moveTo": {
        const puppet = this.takeControl(action.role);
        if (puppet) {
          puppet.move = { action, elapsed: 0, done: false };
        }
        break;
      }
      case "teleport": {
        const puppet = this.takeControl(action.role);
        const target = this.resolveTarget(action.to);
        if (puppet && target) {
          const actor = this.actors.get(action.role);
          puppet.position =
            actor && actor.kind !== "unbound" && actor.kind !== "ghost"
              ? providers.groundPosition?.(actor, target) ??
                ([...target] as CutsceneVec3)
              : ([...target] as CutsceneVec3);
          if (action.faceYaw !== undefined) {
            puppet.yaw = action.faceYaw;
          }
          puppet.moving = false;
        }
        break;
      }
      case "face": {
        const puppet = this.takeControl(action.role);
        const target = this.resolveTarget(action.towards);
        if (puppet && target) {
          puppet.yaw = faceYaw(puppet.position, target);
        }
        break;
      }
      case "emote": {
        const actor = this.actors.get(action.role);
        const puppet = this.takeControl(action.role);
        if (puppet) {
          puppet.animation = action.emote;
          puppet.animationStartedAt = this.sceneElapsed;
        }
        if (actor && actor.kind !== "unbound") {
          effects.push({
            kind: "actorAnimation",
            actor,
            animation: action.emote,
          });
        }
        break;
      }
      case "holdItem": {
        const actor = this.actors.get(action.role);
        this.takeControl(action.role);
        if (actor && actor.kind !== "unbound" && actor.kind !== "anchor") {
          effects.push({
            kind: "actorItem",
            actor,
            itemId: action.itemId ?? undefined,
          });
        }
        break;
      }
      case "dialogue": {
        const actor = action.role ? this.actors.get(action.role) : undefined;
        this.dialogues.push({
          speaker:
            action.speaker ??
            (actor?.kind === "player" ? "You" : action.role),
          text: action.text,
          voice: action.voice,
          endsAt: this.shotClock + dialogueDurationSeconds(action),
        });
        break;
      }
      case "sfx": {
        const position = action.atRole
          ? this.puppetOf(action.atRole)?.position
          : undefined;
        effects.push({ kind: "sfx", name: action.name, position });
        break;
      }
      case "music":
        effects.push({ kind: "music", track: action.track ?? undefined });
        break;
      case "shake":
        effects.push({
          kind: "shake",
          magnitude: action.magnitude,
          repeats: action.repeats,
          durationMs: action.durationMs,
        });
        break;
      case "vfx": {
        const position =
          action.position ??
          (action.atRole ? this.puppetOf(action.atRole)?.position : undefined);
        if (position) {
          effects.push({
            kind: "vfx",
            effect: action.effect,
            position: [...position],
            scale: action.scale,
          });
        }
        break;
      }
      case "fov":
        effects.push({ kind: "fov", fov: action.fov });
        break;
      case "fade":
        effects.push({
          kind: "fade",
          direction: action.direction,
          duration: action.duration,
        });
        break;
      case "timeOfDay":
        effects.push({ kind: "timeOfDay", value: action.value });
        break;
      case "custom":
        effects.push({
          kind: "custom",
          hook: action.hook,
          payload: action.payload,
        });
        break;
      case "capture":
        this.pendingCaptures.push({
          kind: "capture",
          captureId: action.captureId,
          width: action.width,
          height: action.height,
          format: action.format,
          filename: action.filename,
          settleFrames: action.settleFrames,
        });
        break;
    }
  }

  /**
   * Emit a pose every tick for every puppet the scene controls (and always
   * for ghosts, which have no other authority). Drivers render these.
   */
  private emitControlledPoses(effects: CutsceneEffect[]): void {
    for (const [role, puppet] of this.puppets) {
      const actor = this.actors.get(role);
      if (!actor || actor.kind === "unbound" || actor.kind === "anchor") {
        continue;
      }
      if (!puppet.controlled && actor.kind !== "ghost") {
        continue;
      }
      effects.push({
        kind: "actorPose",
        actor,
        position: puppet.position,
        yaw: puppet.yaw,
        moving: puppet.moving,
        animation: puppet.animation,
        animationTime: Math.max(
          0,
          this.sceneElapsed - puppet.animationStartedAt
        ),
      });
    }
  }

  private tickDialogues(effects: CutsceneEffect[]): void {
    const active = this.dialogues.filter((d) => d.endsAt > this.shotClock);
    const top = active[active.length - 1];
    if (top) {
      effects.push({
        kind: "subtitle",
        value: { speaker: top.speaker, text: top.text, voice: top.voice },
      });
      this.subtitleVisible = true;
    } else if (this.subtitleVisible) {
      effects.push({ kind: "subtitle", value: undefined });
      this.subtitleVisible = false;
    }
  }

  private allShotDialoguesDone(shot: CutsceneShot): boolean {
    for (const [i, action] of shot.actions.entries()) {
      if (action.kind !== "dialogue") {
        continue;
      }
      if (!this.firedActionIdx.has(this.actionKey(shot, i))) {
        return false;
      }
    }
    return this.dialogues.every((d) => d.endsAt <= this.shotClock);
  }

  // -------------------------------------------------------------------------
  // Shot end conditions
  // -------------------------------------------------------------------------

  private shotShouldEnd(
    shot: CutsceneShot,
    providers: CutsceneRuntimeProviders
  ): boolean {
    if (!shot.until) {
      return this.shotClock >= shot.duration;
    }
    // Hard ceiling first: a shot can never outlive maxDuration.
    if (this.shotClock >= shot.until.maxDuration) {
      return true;
    }
    if (this.shotClock < shot.duration) {
      return false;
    }
    switch (shot.until.kind) {
      case "dialogueDone":
        return this.allShotDialoguesDone(shot);
      case "actorArrived": {
        // Not arrived until every moveTo for this role in this shot has both
        // fired and completed (guards against ending before a late `at`).
        for (const [i, action] of shot.actions.entries()) {
          if (action.kind !== "moveTo" || action.role !== shot.until.role) {
            continue;
          }
          if (!this.firedActionIdx.has(this.actionKey(shot, i))) {
            return false;
          }
        }
        const puppet = this.puppetOf(shot.until.role);
        return !puppet || !puppet.move || puppet.move.done;
      }
      case "playerInput":
        return providers.advanceRequested();
    }
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  private emitCamera(
    shot: CutsceneShot,
    effects: CutsceneEffect[],
    providers?: CutsceneRuntimeProviders
  ): void {
    // Camera motion completes over the nominal duration, then holds (shots
    // extended by `until` hold their final framing).
    const t = Math.min(
      1,
      shot.duration <= 0 ? 1 : this.shotClock / shot.duration
    );
    let pose = this.sampleCamera(shot, t);
    if (pose && providers?.resolveCameraPose) {
      pose = providers.resolveCameraPose(pose);
    }
    if (!pose) {
      // Degenerate camera (e.g. role unbound): hold the previous pose so the
      // screen never snaps to origin. If there is none, skip the write.
      pose = this.lastPose ?? this.previousShotPose;
      if (!pose) {
        return;
      }
    }
    if (
      shot.transitionIn === "blend" &&
      this.previousShotPose &&
      this.shotClock < shot.blendSeconds
    ) {
      const blendT = easeInOut(this.shotClock / shot.blendSeconds);
      pose = {
        position: v3lerp(this.previousShotPose.position, pose.position, blendT),
        orientation: orientationLerp(
          this.previousShotPose.orientation,
          pose.orientation,
          blendT
        ),
      };
    }
    this.lastPose = pose;
    effects.push({ kind: "cameraPose", pose });
  }

  private sampleCamera(
    shot: CutsceneShot,
    t: number
  ): CutsceneCameraPose | undefined {
    return sampleCameraSpec(shot.camera, t, {
      positionOf: (role) => this.puppetOf(role)?.position,
      yawOf: (role) => this.puppetOf(role)?.yaw,
      heightOf: (role) => this.puppetOf(role)?.height ?? 1.8,
    });
  }
}

// ---------------------------------------------------------------------------
// Camera spec sampling (exported for tests and template previews)
// ---------------------------------------------------------------------------

export interface CameraSampleWorld {
  positionOf(role: string): CutsceneVec3 | undefined;
  yawOf(role: string): number | undefined;
  heightOf(role: string): number;
}

export function sampleCameraSpec(
  spec: CutsceneCameraSpec,
  t: number,
  world: CameraSampleWorld
): CutsceneCameraPose | undefined {
  switch (spec.kind) {
    case "static": {
      if (spec.orientation) {
        return { position: spec.position, orientation: spec.orientation };
      }
      const targetPosition = spec.lookAtRole
        ? world.positionOf(spec.lookAtRole)
        : undefined;
      if (spec.lookAtRole && !targetPosition) {
        return undefined;
      }
      if (!targetPosition) {
        return { position: spec.position, orientation: [0, 0] };
      }
      const target: CutsceneVec3 = [
        targetPosition[0],
        targetPosition[1] + world.heightOf(spec.lookAtRole!) * 0.85,
        targetPosition[2],
      ];
      return {
        position: spec.position,
        orientation: lookAtOrientation(spec.position, target),
      };
    }
    case "dolly": {
      const sample = samplePolyline(
        spec.waypoints.map((w) => w.position),
        t,
        spec.easing
      );
      // Orientation: explicit per-waypoint, else look at role, else along path.
      const from = spec.waypoints[sample.segment];
      const to =
        spec.waypoints[Math.min(sample.segment + 1, spec.waypoints.length - 1)];
      const lookTargetPosition = spec.lookAtRole
        ? world.positionOf(spec.lookAtRole)
        : undefined;
      if (spec.lookAtRole && !lookTargetPosition) {
        return undefined;
      }
      const lookTarget =
        lookTargetPosition && spec.lookAtRole
          ? ([
              lookTargetPosition[0],
              lookTargetPosition[1] + world.heightOf(spec.lookAtRole) * 0.85,
              lookTargetPosition[2],
            ] as CutsceneVec3)
          : undefined;
      const fallbackFrom = lookTarget
        ? lookAtOrientation(from.position, lookTarget)
        : lookAtOrientation(from.position, to.position);
      const afterToIndex = Math.min(
        sample.segment + 2,
        spec.waypoints.length - 1
      );
      const fallbackTo = lookTarget
        ? lookAtOrientation(to.position, lookTarget)
        : afterToIndex === sample.segment + 1
        ? fallbackFrom
        : lookAtOrientation(to.position, spec.waypoints[afterToIndex].position);
      if (from.orientation || to.orientation) {
        return {
          position: sample.position,
          orientation: orientationLerp(
            from.orientation ?? fallbackFrom,
            to.orientation ?? fallbackTo,
            sample.segmentT
          ),
        };
      }
      if (lookTarget) {
        return {
          position: sample.position,
          orientation: lookAtOrientation(sample.position, lookTarget),
        };
      }
      return {
        position: sample.position,
        orientation: lookAtOrientation(sample.position, to.position),
      };
    }
    case "orbit": {
      const target = world.positionOf(spec.role);
      if (!target) {
        return undefined;
      }
      const eased = spec.easing === "easeInOut" ? easeInOut(t) : t;
      const angle = spec.startAngle + (spec.endAngle - spec.startAngle) * eased;
      const head: CutsceneVec3 = [
        target[0],
        target[1] + world.heightOf(spec.role) * 0.75,
        target[2],
      ];
      const pose = orbitPose(head, spec.radius, spec.height, angle);
      return pose;
    }
    case "trackRole": {
      const target = world.positionOf(spec.role);
      if (!target) {
        return undefined;
      }
      const head: CutsceneVec3 = [
        target[0],
        target[1] + world.heightOf(spec.role) * 0.85,
        target[2],
      ];
      const position: CutsceneVec3 = [
        target[0] + spec.offset[0],
        target[1] + spec.offset[1],
        target[2] + spec.offset[2],
      ];
      return { position, orientation: lookAtOrientation(position, head) };
    }
    case "overShoulder": {
      const fromPos = world.positionOf(spec.from);
      const toPos = world.positionOf(spec.to);
      if (!fromPos || !toPos) {
        return undefined;
      }
      return overShoulderPose({
        fromPos,
        fromHeight: world.heightOf(spec.from),
        toPos,
        toHeight: world.heightOf(spec.to),
        side: spec.side,
        pullout: spec.pullout,
      });
    }
    case "pov": {
      const at = world.positionOf(spec.role);
      if (!at) {
        return undefined;
      }
      const eye: CutsceneVec3 = [at[0], at[1] + spec.eyeHeight, at[2]];
      const lookTarget = spec.lookAtRole
        ? world.positionOf(spec.lookAtRole)
        : undefined;
      if (lookTarget) {
        return {
          position: eye,
          orientation: lookAtOrientation(eye, [
            lookTarget[0],
            lookTarget[1] + world.heightOf(spec.lookAtRole!) * 0.85,
            lookTarget[2],
          ]),
        };
      }
      const yaw = world.yawOf(spec.role) ?? 0;
      const forward = yawForward(yaw);
      return {
        position: eye,
        orientation: lookAtOrientation(eye, [
          eye[0] + forward[0],
          eye[1],
          eye[2] + forward[2],
        ]),
      };
    }
  }
}
