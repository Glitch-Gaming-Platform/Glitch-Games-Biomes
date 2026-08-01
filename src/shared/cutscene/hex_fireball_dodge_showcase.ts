import { lookAtOrientation } from "@/shared/cutscene/math";
import {
  validateCutsceneDef,
  type CutsceneDef,
  type CutsceneVec3,
} from "@/shared/cutscene/schema";
import { SNAPSHOT_GROVE_LIVE_NPC_FEET_Y } from "@/shared/harthmere/snapshot_grove_ids";

export const HARTHMERE_HEX_FIREBALL_DODGE_SHOWCASE_ID =
  "harthmere-hex-fireball-dodge-showcase";
export const HARTHMERE_HEX_FIREBALL_DODGE_DURATION_SECONDS = 15;
export const HARTHMERE_HEX_FIREBALL_DODGE_MAX_SCENE_SECONDS = 18;
export const HARTHMERE_CUTSCENE_PROJECTILE_HOOK =
  "harthmere.cutscene.projectile";

export const HARTHMERE_HEX_FIREBALL_DODGE_STAGE_CENTER = [
  500,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
  // This Old Grove Road clearing is already visually validated for combat
  // cameras. The nearby -150 coordinate is partially occluded by terrain.
  -140,
] as const;

export interface HarthmereCutsceneProjectilePayload {
  projectileId: string;
  origin: CutsceneVec3;
  target: CutsceneVec3;
  result?: string;
  windupSecs?: number;
  visualScale?: number;
}

function camera(
  position: CutsceneVec3,
  focus: CutsceneVec3
): {
  kind: "static";
  position: CutsceneVec3;
  orientation: [number, number];
} {
  return {
    kind: "static",
    position,
    orientation: lookAtOrientation(position, focus),
  };
}

function fireball(at: number, origin: CutsceneVec3, target: CutsceneVec3) {
  return {
    kind: "custom" as const,
    at,
    hook: HARTHMERE_CUTSCENE_PROJECTILE_HOOK,
    payload: {
      projectileId: "fireball",
      origin,
      target,
      result: "dodge",
      windupSecs: 0.48,
      // Combat cameras are wider than normal gameplay. Keep the native
      // Fireball readable without replacing its production renderer.
      visualScale: 2.25,
    } satisfies HarthmereCutsceneProjectilePayload,
  };
}

/**
 * Mutation-free combat reel: a Hex casts three native Fireballs while a
 * local-player hero dodges and counters. Projectile travel is delegated to
 * the normal Harthmere projectile renderer through a registered custom hook.
 */
export function harthmereHexFireballDodgeShowcaseCutscene(): CutsceneDef {
  const [x, y, z] = HARTHMERE_HEX_FIREBALL_DODGE_STAGE_CENTER;
  const playerStart: CutsceneVec3 = [x + 3, y, z];
  const playerDodgeRight: CutsceneVec3 = [x + 3, y, z - 2.2];
  const playerCounter: CutsceneVec3 = [x - 0.7, y, z - 1.1];
  const playerDodgeLeft: CutsceneVec3 = [x - 0.7, y, z + 1.5];
  const playerDodgeBack: CutsceneVec3 = [x + 2.1, y, z + 1.5];
  const playerFinish: CutsceneVec3 = [x - 1.25, y, z + 0.45];
  const hexAt: CutsceneVec3 = [x - 3, y, z];

  const hexCastOrigin: CutsceneVec3 = [hexAt[0] + 0.65, y + 2.45, hexAt[2]];
  const raw = {
    id: HARTHMERE_HEX_FIREBALL_DODGE_SHOWCASE_ID,
    name: "Hero Versus Hex: Fireball Dodge",
    version: 1,
    priority: 8,
    settings: {
      mode: "clientPuppet" as const,
      skippable: true,
      skipAfterSeconds: 0,
      lockPlayer: true,
      hideHud: true,
      letterbox: true,
      invulnerablePlayer: true,
      timeOfDay: 0.72,
      music: "battle_music",
      prewarmTimeoutSeconds: 2,
      commitOn: [],
      // The director checks this safety ceiling before natural completion.
      // Keep headroom above the authored duration so slow software-WebGL
      // frames cannot turn the final shot into finishReason=aborted.
      maxSceneDurationSeconds: HARTHMERE_HEX_FIREBALL_DODGE_MAX_SCENE_SECONDS,
    },
    cast: [
      {
        role: "hero",
        binding: {
          kind: "player" as const,
        },
      },
      {
        // This is the authored Hex beast, not the small purple Hexer NPC.
        // Use the production boss GLB directly so the cinematic preserves its
        // torn cowl, lantern ribs, orbiting tablets, and full-height silhouette.
        role: "hex-wraith",
        binding: {
          kind: "ghost" as const,
          asset: "/assets/harthmere/glb/bosses/hex_wraith.glb",
          family: "hex" as const,
          spawnAt: hexAt,
          height: 3.8,
        },
      },
    ],
    shots: [
      {
        id: "hex-standoff",
        duration: 2.2,
        transitionIn: "fade" as const,
        camera: camera([x + 0.2, y + 3.15, z + 9.4], [x, y + 1.75, z - 0.2]),
        actions: [
          { kind: "teleport" as const, role: "hero", to: playerStart },
          { kind: "teleport" as const, role: "hex-wraith", to: hexAt },
          {
            kind: "face" as const,
            at: 0.05,
            role: "hero",
            towards: { role: "hex-wraith" },
          },
          {
            kind: "face" as const,
            at: 0.05,
            role: "hex-wraith",
            towards: { role: "hero" },
          },
          {
            kind: "emote" as const,
            at: 0.35,
            role: "hex-wraith",
            emote: "attack1",
          },
        ],
      },
      {
        id: "first-fireball-dodge-right",
        duration: 3,
        transitionIn: "cut" as const,
        camera: camera([x + 0.7, y + 2.8, z + 8.2], [x, y + 1.65, z - 0.8]),
        actions: [
          {
            kind: "face" as const,
            role: "hex-wraith",
            towards: { role: "hero" },
          },
          {
            kind: "emote" as const,
            at: 0.15,
            role: "hex-wraith",
            emote: "attack1",
          },
          fireball(0.48, hexCastOrigin, [
            playerStart[0],
            y + 1.05,
            playerStart[2],
          ]),
          {
            kind: "moveTo" as const,
            at: 0.52,
            role: "hero",
            to: playerDodgeRight,
            speed: 8.5,
            arriveWithin: 0.1,
            timeoutSeconds: 1,
            timeoutFallback: "teleport" as const,
          },
          {
            kind: "emote" as const,
            at: 0.52,
            role: "hero",
            emote: "dodgeRight",
          },
          {
            kind: "shake" as const,
            at: 0.86,
            magnitude: 0.035,
            repeats: 2,
            durationMs: 180,
          },
        ],
      },
      {
        id: "hero-counterattack",
        duration: 2.4,
        transitionIn: "cut" as const,
        camera: camera(
          [x + 4.6, y + 2.8, z + 5.8],
          [x - 0.8, y + 1.65, z - 0.4]
        ),
        actions: [
          {
            kind: "moveTo" as const,
            at: 0.05,
            role: "hero",
            to: playerCounter,
            speed: 4.4,
            arriveWithin: 0.2,
            timeoutSeconds: 1.2,
            timeoutFallback: "teleport" as const,
          },
          {
            kind: "face" as const,
            at: 0.72,
            role: "hero",
            towards: { role: "hex-wraith" },
          },
          { kind: "emote" as const, at: 0.92, role: "hero", emote: "attack1" },
          {
            kind: "emote" as const,
            at: 1.18,
            role: "hex-wraith",
            emote: "hitReact",
          },
          {
            kind: "vfx" as const,
            at: 1.18,
            effect: "combatImpact" as const,
            atRole: "hex-wraith",
            scale: 0.8,
          },
          {
            kind: "shake" as const,
            at: 1.18,
            magnitude: 0.065,
            repeats: 3,
            durationMs: 260,
          },
        ],
      },
      {
        id: "second-fireball-dodge-left",
        duration: 3,
        transitionIn: "cut" as const,
        camera: camera([x - 0.5, y + 3.35, z - 8.2], [x - 0.8, y + 1.75, z]),
        actions: [
          {
            kind: "face" as const,
            role: "hex-wraith",
            towards: { role: "hero" },
          },
          {
            kind: "emote" as const,
            at: 0.18,
            role: "hex-wraith",
            emote: "attack2",
          },
          fireball(0.5, hexCastOrigin, [
            playerCounter[0],
            y + 1.05,
            playerCounter[2],
          ]),
          {
            kind: "moveTo" as const,
            at: 0.54,
            role: "hero",
            to: playerDodgeLeft,
            speed: 8.5,
            arriveWithin: 0.1,
            timeoutSeconds: 1,
            timeoutFallback: "teleport" as const,
          },
          {
            kind: "emote" as const,
            at: 0.54,
            role: "hero",
            emote: "dodgeLeft",
          },
          {
            kind: "shake" as const,
            at: 0.9,
            magnitude: 0.035,
            repeats: 2,
            durationMs: 180,
          },
        ],
      },
      {
        id: "close-fireball-and-finisher",
        duration: 4.4,
        transitionIn: "cut" as const,
        camera: camera(
          [x + 5.6, y + 3.0, z + 6.4],
          [x - 0.4, y + 1.75, z + 0.5]
        ),
        actions: [
          {
            kind: "face" as const,
            role: "hex-wraith",
            towards: { role: "hero" },
          },
          {
            kind: "emote" as const,
            at: 0.12,
            role: "hex-wraith",
            emote: "attack1",
          },
          fireball(0.42, hexCastOrigin, [
            playerDodgeLeft[0],
            y + 1.05,
            playerDodgeLeft[2],
          ]),
          {
            kind: "moveTo" as const,
            at: 0.46,
            role: "hero",
            to: playerDodgeBack,
            speed: 8.5,
            arriveWithin: 0.1,
            timeoutSeconds: 1,
            timeoutFallback: "teleport" as const,
          },
          {
            kind: "emote" as const,
            at: 0.46,
            role: "hero",
            emote: "dodgeBack",
          },
          {
            kind: "moveTo" as const,
            at: 1.35,
            role: "hero",
            to: playerFinish,
            speed: 5.2,
            arriveWithin: 0.15,
            timeoutSeconds: 1.2,
            timeoutFallback: "teleport" as const,
          },
          {
            kind: "face" as const,
            at: 2.0,
            role: "hero",
            towards: { role: "hex-wraith" },
          },
          { kind: "emote" as const, at: 2.15, role: "hero", emote: "attack2" },
          {
            kind: "emote" as const,
            at: 2.45,
            role: "hex-wraith",
            emote: "hitReact",
          },
          {
            kind: "vfx" as const,
            at: 2.45,
            effect: "combatImpact" as const,
            atRole: "hex-wraith",
            scale: 1.15,
          },
          {
            kind: "shake" as const,
            at: 2.45,
            magnitude: 0.1,
            repeats: 5,
            durationMs: 420,
          },
          {
            kind: "face" as const,
            at: 3.15,
            role: "hero",
            towards: { role: "hex-wraith" },
          },
        ],
      },
    ],
    onEnd: { placements: [], commits: [] },
  };

  const result = validateCutsceneDef(raw);
  if (!result.ok) {
    throw new Error(
      `Invalid Hex Fireball dodge showcase: ${result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`
    );
  }
  return result.def;
}
