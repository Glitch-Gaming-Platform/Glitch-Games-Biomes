// HARTHMERE_CUTSCENE_SCHEMA
//
// Declarative cutscene definitions: Scene -> Shots -> parallel Actions.
// Pure data + validation, no client/server dependencies, fully unit-testable.
// See docs/cutscenes.md and CUTSCENE_GENERATOR_DESIGN.md.

import { zEmoteType } from "@/shared/ecs/gen/types";
import { z } from "zod";

export const MAX_CUTSCENE_SECONDS = 15 * 60;
export const MAX_CUTSCENE_SHOTS = 256;
export const MAX_CUTSCENE_ACTIONS_PER_SHOT = 256;
export const MAX_CUTSCENE_CAST = 128;
export const MAX_CAPTURE_DIMENSION = 8192;

const zFiniteNumber = z.number().finite();
const zFiniteNonNegative = zFiniteNumber.min(0);
const zFinitePositive = zFiniteNumber.positive();
const zCutsceneId = z.string().trim().min(1).max(128);
const zAssetName = z.string().trim().min(1).max(256);
const zBiomesIdNumber = zFiniteNumber.int().positive();

export const zCutsceneVec3 = z.tuple([
  zFiniteNumber,
  zFiniteNumber,
  zFiniteNumber,
]);
export const zCutsceneVec2 = z.tuple([zFiniteNumber, zFiniteNumber]);
export type CutsceneVec3 = z.infer<typeof zCutsceneVec3>;
export type CutsceneVec2 = z.infer<typeof zCutsceneVec2>;

// A camera pose: world position + [pitch, yaw] orientation (same convention as
// /scene/waypoint_camera/active, which the director writes verbatim).
export interface CutsceneCameraPose {
  position: CutsceneVec3;
  orientation: CutsceneVec2;
}

// ---------------------------------------------------------------------------
// Cast
// ---------------------------------------------------------------------------

export const zCutsceneRoleBinding = z.discriminatedUnion("kind", [
  // The local player is always bindable.
  z.object({ kind: z.literal("player") }),
  // A specific ECS entity (NPC, boss, animal...) by id.
  z.object({ kind: z.literal("entity"), entityId: zBiomesIdNumber }),
  // Nearest live NPC matching a label regex and/or Bikkie npc type id,
  // searched around the player (or `near` if given) within `within` meters.
  z.object({
    kind: z.literal("nearestNpc"),
    labelMatch: z.string().max(128).optional(),
    npcTypeId: zBiomesIdNumber.optional(),
    near: zCutsceneVec3.optional(),
    within: zFinitePositive.max(512).default(64),
  }),
  // A client-only ghost actor (renderer mesh, no ECS entity). Used for
  // flashbacks, crowds, and stand-ins. Never hittable, never persisted.
  z.object({
    kind: z.literal("ghost"),
    asset: zAssetName,
    family: z
      .enum([
        "human",
        "live_entity",
        "animal",
        "mucker",
        "hex",
        "quest_creature",
      ])
      .default("live_entity"),
    spawnAt: zCutsceneVec3.optional(),
    height: zFinitePositive.max(128).default(1.8),
  }),
  // A non-rendered world-space target. Useful for buildings, items, landmarks,
  // and camera focus points that should not be puppeteered as living actors.
  z.object({
    kind: z.literal("anchor"),
    position: zCutsceneVec3,
    height: zFiniteNonNegative.max(1024).default(0),
    label: z.string().max(128).optional(),
  }),
]);
export type CutsceneRoleBinding = z.infer<typeof zCutsceneRoleBinding>;
export type CutsceneRoleBindingInput = z.input<typeof zCutsceneRoleBinding>;

export const zCutsceneRole = z.object({
  role: zCutsceneId,
  binding: zCutsceneRoleBinding,
  // required + no resolution => scene cancels gracefully; cleanup always runs
  // and onEnd commits run only when settings.commitOn includes "cancelled".
  required: z.boolean().default(true),
  // What to do when a non-player binding cannot be resolved:
  //  "ghost"       -> spawn a ghost stand-in (needs ghostAsset)
  //  "skipActions" -> keep the scene, drop this role's actions/shots
  fallback: z.enum(["ghost", "skipActions"]).default("skipActions"),
  ghostAsset: zAssetName.optional(),
});
export type CutsceneRole = z.infer<typeof zCutsceneRole>;

// ---------------------------------------------------------------------------
// Camera specs (compiled to poses by the timeline sampler)
// ---------------------------------------------------------------------------

export const zCutsceneOrientedPoint = z.object({
  position: zCutsceneVec3,
  orientation: zCutsceneVec2.optional(),
});

export const zCutsceneCameraSpec = z.discriminatedUnion("kind", [
  // Locked-off shot. Orientation may be explicit or derived from lookAtRole.
  z.object({
    kind: z.literal("static"),
    position: zCutsceneVec3,
    orientation: zCutsceneVec2.optional(),
    lookAtRole: zCutsceneId.optional(),
  }),
  // Dolly/crane along waypoints, eased over the shot duration. Waypoints
  // without orientation look at lookAtRole (or along the path).
  z.object({
    kind: z.literal("dolly"),
    waypoints: z.array(zCutsceneOrientedPoint).min(2).max(256),
    easing: z.enum(["linear", "easeInOut"]).default("easeInOut"),
    lookAtRole: zCutsceneId.optional(),
  }),
  // Orbit around an actor. Angles in radians; height is relative to actor feet.
  z.object({
    kind: z.literal("orbit"),
    role: zCutsceneId,
    radius: zFinitePositive.max(4096),
    height: zFiniteNumber.max(4096).min(-4096).default(2),
    startAngle: zFiniteNumber.default(0),
    endAngle: zFiniteNumber.default(Math.PI),
    easing: z.enum(["linear", "easeInOut"]).default("easeInOut"),
  }),
  // Follow an actor at a fixed offset, always looking at them.
  z.object({
    kind: z.literal("trackRole"),
    role: zCutsceneId,
    offset: zCutsceneVec3.default([0, 2, 4]),
  }),
  // Over-the-shoulder two-shot: camera behind `from`, framing `to`.
  // Mirrors the proven NPC-talk framing in CameraScript (pullout, azimuth).
  z.object({
    kind: z.literal("overShoulder"),
    from: zCutsceneId,
    to: zCutsceneId,
    side: z.enum(["left", "right"]).default("right"),
    pullout: zFinitePositive.max(64).default(1.8),
  }),
  // First-person from an actor's eyes; looks at lookAtRole or along facing.
  z.object({
    kind: z.literal("pov"),
    role: zCutsceneId,
    eyeHeight: zFiniteNumber.max(128).min(-128).default(1.6),
    lookAtRole: zCutsceneId.optional(),
  }),
]);
export type CutsceneCameraSpec = z.infer<typeof zCutsceneCameraSpec>;

// ---------------------------------------------------------------------------
// Actions (parallel within a shot; each starts `at` seconds into the shot)
// ---------------------------------------------------------------------------

const zTargetRef = z.union([zCutsceneVec3, z.object({ role: zCutsceneId })]);
export type CutsceneTargetRef = z.infer<typeof zTargetRef>;

// Superset of player emotes plus the Harthmere NPC runtime clips
// (animation_runtime_contracts.ts). Validated so typos fail at author time.
export const HARTHMERE_NPC_RUNTIME_ANIMATIONS = [
  "vendorIdle",
  "talkGesture",
  "questGesture",
  "sit",
  "eat",
  "drink",
  "sleep",
  "workLoop",
  "smithWork",
  "cookWork",
  "dockWork",
  "healerWork",
  "guardPatrolIdle",
  "crowdEmote",
  // Deterministic cinematic-only combat reactions. These never mutate health;
  // they let a clientPuppet fight communicate hits and defeats visually.
  "hitReact",
  "death",
] as const;

export const zCutsceneAnimation = z.union([
  zEmoteType,
  z.enum(HARTHMERE_NPC_RUNTIME_ANIMATIONS),
]);

export const zCutsceneAction = z.discriminatedUnion("kind", [
  // Straight-line move at `speed` m/s. NOT a pathfinder: route corners with
  // consecutive moveTo actions. On timeout: teleport (covered by fade) or skip.
  z.object({
    kind: z.literal("moveTo"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    role: zCutsceneId,
    to: zTargetRef,
    speed: zFinitePositive.max(128).default(2.5),
    arriveWithin: zFinitePositive.max(64).default(0.5),
    timeoutSeconds: zFinitePositive.max(MAX_CUTSCENE_SECONDS).default(10),
    timeoutFallback: z.enum(["teleport", "skip"]).default("teleport"),
  }),
  z.object({
    kind: z.literal("teleport"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    role: zCutsceneId,
    to: zTargetRef,
    faceYaw: zFiniteNumber.optional(),
  }),
  z.object({
    kind: z.literal("face"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    role: zCutsceneId,
    towards: zTargetRef,
  }),
  z.object({
    kind: z.literal("emote"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    role: zCutsceneId,
    emote: zCutsceneAnimation,
  }),
  // Attach a native Bikkie item to an ECS NPC's rendered right hand. Null
  // explicitly clears the held item without touching ECS inventory/equipment.
  z.object({
    kind: z.literal("holdItem"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    role: zCutsceneId,
    itemId: zBiomesIdNumber.nullable(),
  }),
  // Subtitled dialogue line. `duration` omitted => auto (reading speed).
  z.object({
    kind: z.literal("dialogue"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    role: zCutsceneId.optional(),
    speaker: z.string().max(128).optional(),
    text: z.string().min(1).max(4096),
    // Provider-neutral actor descriptor used by the same TTS route as normal
    // NPC dialogue. Omitting it keeps player lines and narration text-only.
    voice: z.string().max(4096).optional(),
    duration: zFinitePositive.max(MAX_CUTSCENE_SECONDS).optional(),
  }),
  z.object({
    kind: z.literal("sfx"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    name: zAssetName,
    atRole: zCutsceneId.optional(),
  }),
  z.object({
    kind: z.literal("music"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    track: zAssetName.nullable(),
  }),
  z.object({
    kind: z.literal("shake"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    magnitude: zFinitePositive.max(10).default(0.05),
    repeats: zFinitePositive.int().max(100).default(4),
    durationMs: zFinitePositive.max(60_000).default(600),
  }),
  // Engine-rendered cinematic VFX. These are deliberately declarative and
  // client-only: they never create ECS entities or mutate Anima/Gaia state.
  z.object({
    kind: z.literal("vfx"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    effect: z.enum(["exoticMatterCreation", "combatImpact"]),
    // Scene-level art direction without forking particle definitions. The
    // particle system remains engine-native; only its world transform grows.
    scale: zFinitePositive.min(0.1).max(10).default(1),
    position: zCutsceneVec3.optional(),
    atRole: zCutsceneId.optional(),
  }),
  z.object({
    kind: z.literal("fov"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    fov: zFiniteNumber.min(10).max(140),
  }),
  z.object({
    kind: z.literal("fade"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    direction: z.enum(["in", "out"]),
    duration: zFinitePositive.max(30).default(0.5),
  }),
  // 0 = midnight, 0.5 = noon (client-visual only; Gaia clock untouched).
  z.object({
    kind: z.literal("timeOfDay"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    value: zFiniteNumber.min(0).max(1),
  }),
  // Named client-side hook (registered on the director) for bespoke beats.
  z.object({
    kind: z.literal("custom"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    hook: zCutsceneId,
    payload: z.unknown().optional(),
  }),
  // Capture the fully staged engine frame after camera and actor effects for
  // this tick have been applied. The client executor delivers the image to the
  // capture service; the pure runtime only emits the request as data.
  z.object({
    kind: z.literal("capture"),
    at: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(0),
    captureId: zCutsceneId,
    width: zFinitePositive.int().max(MAX_CAPTURE_DIMENSION).default(3840),
    height: zFinitePositive.int().max(MAX_CAPTURE_DIMENSION).default(2160),
    format: z.enum(["image/png", "image/jpeg"]).default("image/png"),
    filename: z.string().trim().min(1).max(256).optional(),
    // Puppet records and asynchronously loaded VFX are published during the
    // director tick. Waiting a few real renderer frames prevents a capture
    // from freezing the previous scene graph before those visuals are drawn.
    settleFrames: zFiniteNonNegative.int().max(10).default(2),
  }),
]);
export type CutsceneAction = z.infer<typeof zCutsceneAction>;

// ---------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------

export const zCutsceneShotUntil = z.discriminatedUnion("kind", [
  // Every `until` is hard-capped by maxDuration: a shot can never hang.
  z.object({
    kind: z.literal("dialogueDone"),
    maxDuration: zFinitePositive.max(MAX_CUTSCENE_SECONDS),
  }),
  z.object({
    kind: z.literal("actorArrived"),
    role: zCutsceneId,
    maxDuration: zFinitePositive.max(MAX_CUTSCENE_SECONDS),
  }),
  z.object({
    kind: z.literal("playerInput"),
    maxDuration: zFinitePositive.max(MAX_CUTSCENE_SECONDS),
  }),
]);
export type CutsceneShotUntil = z.infer<typeof zCutsceneShotUntil>;

export const zCutsceneShot = z.object({
  id: zCutsceneId,
  // Nominal duration in seconds. When `until` is set this is the minimum;
  // until.maxDuration is the ceiling.
  duration: zFinitePositive.max(MAX_CUTSCENE_SECONDS),
  until: zCutsceneShotUntil.optional(),
  camera: zCutsceneCameraSpec,
  transitionIn: z.enum(["cut", "blend", "fade"]).default("cut"),
  blendSeconds: zFinitePositive.max(30).default(0.5),
  actions: z
    .array(zCutsceneAction)
    .max(MAX_CUTSCENE_ACTIONS_PER_SHOT)
    .default([]),
});
export type CutsceneShot = z.infer<typeof zCutsceneShot>;

// ---------------------------------------------------------------------------
// End state (applied only for settings.commitOn outcomes; cleanup is universal)
// ---------------------------------------------------------------------------

export const zCutsceneEndState = z.object({
  placements: z
    .array(
      z.object({
        role: zCutsceneId,
        position: zCutsceneVec3.optional(),
        orientation: zCutsceneVec2.optional(),
      })
    )
    .max(128)
    .default([]),
  // Opaque commit descriptors executed by registered client hooks (e.g. quest
  // advances). MUST be idempotent/retryable: /sync reconnects can cancel
  // in-flight publishes and live-mode writes are slow — visual-first,
  // commit-after, never block a shot on a server ack.
  commits: z
    .array(z.object({ hook: zCutsceneId, payload: z.unknown().optional() }))
    .max(128)
    .default([]),
});
export type CutsceneEndState = z.infer<typeof zCutsceneEndState>;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export const zCutsceneSettings = z.object({
  // Skipping is always allowed after skipAfterSeconds even when skippable is
  // false (accessibility / repeat viewings).
  skippable: z.boolean().default(true),
  skipAfterSeconds: zFiniteNonNegative.max(MAX_CUTSCENE_SECONDS).default(3),
  lockPlayer: z.boolean().default(true),
  hideHud: z.boolean().default(true),
  letterbox: z.boolean().default(true),
  invulnerablePlayer: z.boolean().default(true),
  // Client-visual time override for the whole scene (0=midnight, 0.5=noon).
  timeOfDay: zFiniteNumber.min(0).max(1).optional(),
  music: zAssetName.optional(),
  // clientPuppet: visuals only, other players see nothing (default; safe with
  //   Anima brains — the server entity never moves).
  // serverShared:  ECS NPCs are moved authoritatively via SetNPCPositionEvent
  //   (visible to everyone; use for party/world moments only).
  mode: z.enum(["clientPuppet", "serverShared"]).default("clientPuppet"),
  // Seconds to wait for shards/assets around the first camera position before
  // starting anyway behind a fade.
  prewarmTimeoutSeconds: zFiniteNonNegative.max(60).default(2),
  // Story/world end state is applied only for these outcomes. Cleanup always
  // runs. Abort/death/cancel deliberately do not imply story success.
  commitOn: z
    .array(z.enum(["completed", "skipped", "aborted", "cancelled"]))
    .max(4)
    .default(["completed", "skipped"]),
  maxSceneDurationSeconds: zFinitePositive
    .max(MAX_CUTSCENE_SECONDS)
    .default(MAX_CUTSCENE_SECONDS),
});
export type CutsceneSettings = z.infer<typeof zCutsceneSettings>;

export const zCutsceneDef = z.object({
  id: zCutsceneId,
  name: z.string().trim().min(1).max(256),
  version: zFiniteNumber
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .default(1),
  // Higher priority wins when two triggers race; never overlaps (queue).
  priority: zFiniteNumber.int().min(-1_000_000).max(1_000_000).default(0),
  settings: zCutsceneSettings.default({}),
  cast: z.array(zCutsceneRole).min(1).max(MAX_CUTSCENE_CAST),
  shots: z.array(zCutsceneShot).min(1).max(MAX_CUTSCENE_SHOTS),
  onEnd: zCutsceneEndState.default({}),
});
export type CutsceneDef = z.infer<typeof zCutsceneDef>;

// ---------------------------------------------------------------------------
// Semantic validation (beyond zod shape checks)
// ---------------------------------------------------------------------------

export interface CutsceneValidationIssue {
  path: string;
  message: string;
}

function rolesReferencedByCamera(camera: CutsceneCameraSpec): string[] {
  switch (camera.kind) {
    case "static":
      return camera.lookAtRole ? [camera.lookAtRole] : [];
    case "dolly":
      return camera.lookAtRole ? [camera.lookAtRole] : [];
    case "orbit":
      return [camera.role];
    case "trackRole":
      return [camera.role];
    case "overShoulder":
      return [camera.from, camera.to];
    case "pov":
      return camera.lookAtRole
        ? [camera.role, camera.lookAtRole]
        : [camera.role];
  }
}

function rolesReferencedByAction(action: CutsceneAction): string[] {
  const roles: string[] = [];
  const anyAction = action as {
    role?: string;
    atRole?: string;
    to?: CutsceneTargetRef;
    towards?: CutsceneTargetRef;
  };
  if (anyAction.role) roles.push(anyAction.role);
  if (anyAction.atRole) roles.push(anyAction.atRole);
  for (const ref of [anyAction.to, anyAction.towards]) {
    if (ref && !Array.isArray(ref) && typeof ref === "object") {
      roles.push((ref as { role: string }).role);
    }
  }
  return roles;
}

/**
 * Parse + semantically validate a cutscene definition. Returns the parsed def
 * (with defaults applied) or a list of issues. A def that passes here can
 * always be compiled and run.
 */
export function validateCutsceneDef(
  raw: unknown
):
  | { ok: true; def: CutsceneDef }
  | { ok: false; issues: CutsceneValidationIssue[] } {
  const parsed = zCutsceneDef.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  const def = parsed.data;
  const issues: CutsceneValidationIssue[] = [];

  const roleNames = new Set<string>();
  const exactEntityBindings = new Map<number, string>();
  for (const [i, member] of def.cast.entries()) {
    if (roleNames.has(member.role)) {
      issues.push({
        path: `cast.${i}.role`,
        message: `duplicate role "${member.role}"`,
      });
    }
    roleNames.add(member.role);
    if (member.binding.kind === "entity") {
      const prior = exactEntityBindings.get(member.binding.entityId);
      if (prior) {
        issues.push({
          path: `cast.${i}.binding.entityId`,
          message: `entity ${member.binding.entityId} is already bound to role "${prior}"`,
        });
      } else {
        exactEntityBindings.set(member.binding.entityId, member.role);
      }
    }
    if (member.binding.kind === "nearestNpc" && member.binding.labelMatch) {
      try {
        new RegExp(member.binding.labelMatch, "i");
      } catch {
        issues.push({
          path: `cast.${i}.binding.labelMatch`,
          message: "must be a valid regular expression",
        });
      }
    }
    if (member.fallback === "ghost" && !member.ghostAsset) {
      issues.push({
        path: `cast.${i}`,
        message: `role "${member.role}" has fallback "ghost" but no ghostAsset`,
      });
    }
  }

  const playerRoles = def.cast.filter((c) => c.binding.kind === "player");
  if (playerRoles.length > 1) {
    issues.push({
      path: "cast",
      message: "at most one role may bind the player",
    });
  }

  const shotIds = new Set<string>();
  const captureIds = new Set<string>();
  let nominalDuration = 0;
  for (const [i, shot] of def.shots.entries()) {
    nominalDuration += shot.until?.maxDuration ?? shot.duration;
    if (shotIds.has(shot.id)) {
      issues.push({
        path: `shots.${i}.id`,
        message: `duplicate shot id "${shot.id}"`,
      });
    }
    shotIds.add(shot.id);

    for (const role of rolesReferencedByCamera(shot.camera)) {
      if (!roleNames.has(role)) {
        issues.push({
          path: `shots.${i}.camera`,
          message: `camera references unknown role "${role}"`,
        });
      }
    }
    if (shot.until) {
      if (shot.until.maxDuration < shot.duration) {
        issues.push({
          path: `shots.${i}.until`,
          message: "until.maxDuration must be >= shot.duration",
        });
      }
      if (
        shot.until.kind === "actorArrived" &&
        !roleNames.has(shot.until.role)
      ) {
        issues.push({
          path: `shots.${i}.until`,
          message: `until references unknown role "${shot.until.role}"`,
        });
      }
      if (
        shot.until.kind === "actorArrived" &&
        !shot.actions.some((action) => {
          const arrivedRole =
            shot.until?.kind === "actorArrived" ? shot.until.role : undefined;
          return action.kind === "moveTo" && action.role === arrivedRole;
        })
      ) {
        issues.push({
          path: `shots.${i}.until`,
          message: `actorArrived requires a moveTo action for role "${shot.until.role}"`,
        });
      }
    }
    const budget = shot.until?.maxDuration ?? shot.duration;
    for (const [j, action] of shot.actions.entries()) {
      for (const role of rolesReferencedByAction(action)) {
        if (!roleNames.has(role)) {
          issues.push({
            path: `shots.${i}.actions.${j}`,
            message: `action references unknown role "${role}"`,
          });
        }
      }
      if (action.at > budget) {
        issues.push({
          path: `shots.${i}.actions.${j}.at`,
          message: `action starts at ${action.at}s but shot budget is ${budget}s`,
        });
      }
      if (action.kind === "capture") {
        if (captureIds.has(action.captureId)) {
          issues.push({
            path: `shots.${i}.actions.${j}.captureId`,
            message: `duplicate capture id "${action.captureId}"`,
          });
        }
        captureIds.add(action.captureId);
      }
      if (
        action.kind === "vfx" &&
        action.position === undefined &&
        action.atRole === undefined
      ) {
        issues.push({
          path: `shots.${i}.actions.${j}`,
          message: `vfx action requires either "position" or "atRole"`,
        });
      }
      const primaryRole =
        "role" in action && typeof action.role === "string"
          ? def.cast.find((member) => member.role === action.role)
          : undefined;
      if (
        action.kind === "holdItem" &&
        primaryRole &&
        primaryRole.binding.kind !== "entity" &&
        primaryRole.binding.kind !== "nearestNpc" &&
        primaryRole.binding.kind !== "anchor"
      ) {
        issues.push({
          path: `shots.${i}.actions.${j}`,
          message: `holdItem requires an ECS NPC role, not "${primaryRole.binding.kind}"`,
        });
      }
      if (
        primaryRole?.binding.kind === "anchor" &&
        ["moveTo", "teleport", "face", "emote", "holdItem"].includes(
          action.kind
        )
      ) {
        issues.push({
          path: `shots.${i}.actions.${j}`,
          message: `action "${action.kind}" cannot puppeteer anchor role "${primaryRole.role}"`,
        });
      }
    }
  }

  if (nominalDuration > def.settings.maxSceneDurationSeconds) {
    issues.push({
      path: "settings.maxSceneDurationSeconds",
      message: `shot ceilings total ${nominalDuration}s, exceeding scene maximum ${def.settings.maxSceneDurationSeconds}s`,
    });
  }

  for (const [i, placement] of def.onEnd.placements.entries()) {
    if (!roleNames.has(placement.role)) {
      issues.push({
        path: `onEnd.placements.${i}`,
        message: `placement references unknown role "${placement.role}"`,
      });
    }
    const member = def.cast.find(
      (candidate) => candidate.role === placement.role
    );
    if (member?.binding.kind === "anchor") {
      issues.push({
        path: `onEnd.placements.${i}`,
        message: `anchor role "${placement.role}" cannot receive an end placement`,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, def };
}

/** Auto subtitle duration from text length (reading speed), clamped 1.5–8s. */
export function dialogueDurationSeconds(action: {
  text: string;
  duration?: number;
}): number {
  if (action.duration) {
    return action.duration;
  }
  const words = action.text.trim().split(/\s+/).length;
  return Math.min(8, Math.max(1.5, 0.8 + words * 0.32));
}
