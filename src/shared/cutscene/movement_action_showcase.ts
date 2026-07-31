import {
  validateCutsceneDef,
  type CutsceneDef,
} from "@/shared/cutscene/schema";
import { PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES } from "@/shared/game/movement_actions";
import { SNAPSHOT_GROVE_LIVE_NPC_FEET_Y } from "@/shared/harthmere/snapshot_grove_ids";

export const HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID =
  "harthmere-movement-action-showcase";

const CENTER = [500, SNAPSHOT_GROVE_LIVE_NPC_FEET_Y, -140] as const;
const SUBJECT_ROLE = "movement-action-subject";
const CAMERA_MARK_ROLE = "movement-action-camera-mark";

const DISPLAY_NAMES: Record<
  (typeof PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES)[number],
  string
> = {
  dodgeLeft: "Dodge left",
  dodgeRight: "Dodge right",
  dodgeForward: "Dodge forward",
  dodgeBack: "Dodge back",
  evade: "Evade roll",
};

/**
 * Game-rendered visual gate for the desktop X/C movement actions. The scene is
 * client-puppet-only and has no commits, so repeated screenshots cannot change
 * player, quest, Anima, Gaia, or combat state.
 */
export function harthmereMovementActionShowcaseCutscene(): CutsceneDef {
  const [x, y, z] = CENTER;
  const raw = {
    id: HARTHMERE_MOVEMENT_ACTION_SHOWCASE_ID,
    name: "Harthmere Dodge and Evade Showcase",
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
          kind: "ghost" as const,
          asset: "townsperson_guard",
          family: "human" as const,
          spawnAt: [x, y, z] as [number, number, number],
          height: 1.8,
        },
      },
      {
        role: CAMERA_MARK_ROLE,
        binding: {
          kind: "anchor" as const,
          position: [x + 3.5, y, z + 6.5] as [number, number, number],
          height: 1.7,
          label: "Movement action camera mark",
        },
      },
    ],
    shots: PLAYER_MOVEMENT_ACTION_ANIMATION_NAMES.map((animation, index) => ({
      id: `movement-action-${animation}`,
      duration: 2.1,
      transitionIn: index === 0 ? ("fade" as const) : ("cut" as const),
      camera: {
        kind: "static" as const,
        // A stable three-quarter side view makes both lateral direction and
        // forward/back body pitch readable in one compact capture sequence.
        position: [x + 3.5, y + 1.85, z + 6.5] as [number, number, number],
        lookAtRole: SUBJECT_ROLE,
      },
      actions: [
        {
          kind: "teleport" as const,
          at: 0,
          role: SUBJECT_ROLE,
          to: [x, y, z] as [number, number, number],
        },
        {
          kind: "face" as const,
          at: 0.02,
          role: SUBJECT_ROLE,
          towards: { role: CAMERA_MARK_ROLE },
        },
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
    })),
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
