import {
  validateCutsceneDef,
  type CutsceneDef,
} from "@/shared/cutscene/schema";
import { PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES } from "@/shared/game/movement_actions";

export const HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID =
  "harthmere-movement-action-showcase";

const SUBJECT_ROLE = "movement-action-subject";

const DISPLAY_NAMES: Record<
  (typeof PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES)[number],
  string
> = {
  dodgeLeft: "Dodge left",
  dodgeRight: "Dodge right",
  dodgeForward: "Dodge forward",
  dodgeBack: "Dodge back",
  evade: "Evade roll",
  doubleJump: "Double jump",
};

/**
 * Game-rendered visual gate for dodge, evade, and double jump. The scene is
 * client-puppet-only and has no commits, so repeated screenshots cannot change
 * player, quest, Anima, Gaia, or combat state.
 */
export function harthmereMovementActionShowcaseCutscene(): CutsceneDef {
  const actionShots = PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES.map(
    (animation, index) => ({
      id: `movement-action-${animation}`,
      duration: 2.1,
      transitionIn: index === 0 ? ("fade" as const) : ("cut" as const),
      camera: {
        // Follow the authenticated player's already-streamed mesh. This keeps
        // the actions readable without loading a second world-space stage.
        kind: "trackRole" as const,
        role: SUBJECT_ROLE,
        offset: [3.5, 1.85, 6.5] as [number, number, number],
      },
      actions: [
        {
          kind: "dialogue" as const,
          at: 0,
          speaker: "Movement action",
          text: DISPLAY_NAMES[animation],
          duration: 1.6,
        },
        {
          kind: "emote" as const,
          at: 0.3,
          role: SUBJECT_ROLE,
          emote: animation,
        },
      ],
    })
  );
  const raw = {
    id: HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID,
    name: "Harthmere Movement Action Showcase",
    version: 1,
    settings: {
      mode: "clientPuppet" as const,
      skippable: true,
      skipAfterSeconds: 0,
      lockPlayer: true,
      hideHud: true,
      letterbox: true,
      invulnerablePlayer: true,
      timeOfDay: 0.68,
      prewarmTimeoutSeconds: 2,
      commitOn: [],
      maxSceneDurationSeconds: 30,
    },
    cast: [
      {
        role: SUBJECT_ROLE,
        binding: {
          // Use the authenticated player's already-loaded mesh. Snapshot
          // townsperson ghosts can resolve to tiny fallback props when their
          // archived appearance is unavailable, which makes the visual gate
          // look successful while hiding the actual movement animation.
          // Client-puppet mode plus empty commits keeps this render-only.
          kind: "player" as const,
        },
      },
    ],
    shots: [
      ...actionShots,
      {
        id: "movement-action-evade-attack",
        duration: 2.1,
        transitionIn: "cut" as const,
        camera: {
          kind: "trackRole" as const,
          role: SUBJECT_ROLE,
          offset: [3.5, 1.85, 6.5] as [number, number, number],
        },
        actions: [
          {
            kind: "dialogue" as const,
            at: 0,
            speaker: "Movement action",
            text: "Evade into attack",
            duration: 1.6,
          },
          {
            kind: "emote" as const,
            at: 0.3,
            role: SUBJECT_ROLE,
            emote: "evade",
          },
          {
            kind: "emote" as const,
            at: 0.9,
            role: SUBJECT_ROLE,
            emote: "attack1",
          },
        ],
      },
    ],
    onEnd: { placements: [], commits: [] },
  };

  const result = validateCutsceneDef(raw);
  if (!result.ok) {
    throw new Error(
      `Invalid Harthmere movement-action showcase: ${result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`
    );
  }
  return result.def;
}
