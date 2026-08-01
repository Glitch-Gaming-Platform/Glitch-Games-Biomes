import {
  HARTHMERE_CINEMATIC_EXPRESSIONS,
  harthmereCinematicExpressionDisplayName,
  harthmereCinematicExpressionSpec,
  type HarthmereCinematicExpression,
} from "@/shared/cutscene/cinematic_expressions";
import {
  cutsceneExpressionSequence,
  pairedCutsceneExpressionActions,
} from "@/shared/cutscene/expression_actions";
import {
  validateCutsceneDef,
  type CutsceneAction,
  type CutsceneDef,
  type CutsceneVec3,
} from "@/shared/cutscene/schema";
import { SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET } from "@/shared/cutscene/puppets";
import { SNAPSHOT_GROVE_LIVE_NPC_FEET_Y } from "@/shared/harthmere/snapshot_grove_ids";

export const HARTHMERE_EXPRESSION_SHOWCASE_ID = "harthmere-expression-showcase";
export const HARTHMERE_EXPRESSION_SHOWCASE_CAMERA_ROLE =
  "expression-camera-mark";

export const HARTHMERE_EXPRESSION_SHOWCASE_CENTER: CutsceneVec3 = [
  500,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
  -140,
];

const PERFORMER_ROLES = [
  "expression-performer-1",
  "expression-performer-2",
  "expression-performer-3",
  "expression-performer-4",
] as const;

const PARTNER_ROLES = ["expression-partner-1", "expression-partner-2"] as const;

const SOLO_EXPRESSIONS = HARTHMERE_CINEMATIC_EXPRESSIONS.filter(
  (expression) =>
    harthmereCinematicExpressionSpec(expression).interaction !== "paired"
);

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function expressionLabel(expressions: readonly HarthmereCinematicExpression[]) {
  return expressions
    .map((expression) => harthmereCinematicExpressionDisplayName(expression))
    .join(" · ");
}

/**
 * A generated, previewable scene that exercises every public gameplay emote.
 * It uses ghosts only, so it never mutates ECS entities, Anima, or Gaia.
 */
export function harthmereExpressionShowcaseCutscene(): CutsceneDef {
  const [centerX, centerY, centerZ] = HARTHMERE_EXPRESSION_SHOWCASE_CENTER;
  const soloShots = chunk(SOLO_EXPRESSIONS, PERFORMER_ROLES.length).map(
    (expressions, index) => {
      const duration = Math.max(
        3,
        ...expressions.map(
          (expression) =>
            harthmereCinematicExpressionSpec(expression).durationSeconds + 0.8
        )
      );
      const actions: CutsceneAction[] = [
        {
          kind: "dialogue",
          at: 0,
          speaker: "Expression library",
          text: expressionLabel(expressions),
          duration: Math.min(2.4, duration - 0.1),
        },
        ...cutsceneExpressionSequence(
          expressions.map((expression, expressionIndex) => ({
            role: PERFORMER_ROLES[expressionIndex],
            expression,
            at: 0.25,
            faceTowardsRole: HARTHMERE_EXPRESSION_SHOWCASE_CAMERA_ROLE,
          }))
        ),
      ];
      return {
        id: `expression-solo-${index + 1}`,
        duration,
        transitionIn: index === 0 ? ("fade" as const) : ("blend" as const),
        blendSeconds: 0.25,
        camera: {
          kind: "static" as const,
          position: [
            centerX + (index % 2 === 0 ? -0.8 : 0.8),
            centerY + 2.35,
            centerZ + 7.2,
          ] as CutsceneVec3,
          lookAtRole: PERFORMER_ROLES[1],
        },
        actions,
      };
    }
  );

  const pairedExpressions = ["hug", "handshake", "highFive"] as const;
  const pairedShots = pairedExpressions.map((expression, index) => ({
    id: `expression-paired-${expression}`,
    duration:
      Math.max(
        2.8,
        harthmereCinematicExpressionSpec(expression).durationSeconds
      ) + 0.8,
    transitionIn: "blend" as const,
    blendSeconds: 0.25,
    camera: {
      kind: "static" as const,
      position: [centerX, centerY + 2.1, centerZ + 5.4] as CutsceneVec3,
      lookAtRole: PARTNER_ROLES[0],
    },
    actions: [
      {
        kind: "dialogue" as const,
        at: 0,
        speaker: "Paired expression",
        text: harthmereCinematicExpressionDisplayName(expression),
        duration: 2,
      },
      ...pairedCutsceneExpressionActions({
        firstRole: PARTNER_ROLES[0],
        secondRole: PARTNER_ROLES[1],
        expression,
        at: 0.25,
      }),
    ],
  }));

  const raw = {
    id: HARTHMERE_EXPRESSION_SHOWCASE_ID,
    name: "Harthmere Gameplay Expression Library",
    version: 1,
    settings: {
      mode: "clientPuppet",
      skippable: true,
      skipAfterSeconds: 0,
      lockPlayer: true,
      hideHud: true,
      letterbox: true,
      invulnerablePlayer: true,
      timeOfDay: 0.68,
      prewarmTimeoutSeconds: 2,
      commitOn: [],
      maxSceneDurationSeconds: 180,
    },
    cast: [
      ...PERFORMER_ROLES.map((role, index) => ({
        role,
        binding: {
          kind: "ghost" as const,
          asset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
          family: "human" as const,
          spawnAt: [centerX + (index - 1.5) * 1.45, centerY, centerZ],
          height: 1.8,
        },
      })),
      ...PARTNER_ROLES.map((role, index) => ({
        role,
        binding: {
          kind: "ghost" as const,
          asset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
          family: "human" as const,
          spawnAt: [centerX + (index === 0 ? -0.55 : 0.55), centerY, centerZ],
          height: 1.8,
        },
      })),
      {
        role: HARTHMERE_EXPRESSION_SHOWCASE_CAMERA_ROLE,
        binding: {
          kind: "anchor" as const,
          position: [centerX, centerY, centerZ + 9] as CutsceneVec3,
          height: 1.8,
          label: "Expression camera mark",
        },
      },
    ],
    shots: [...soloShots, ...pairedShots],
    onEnd: { placements: [], commits: [] },
  };

  const result = validateCutsceneDef(raw);
  if (!result.ok) {
    throw new Error(
      `Invalid Harthmere expression showcase: ${result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`
    );
  }
  return result.def;
}
