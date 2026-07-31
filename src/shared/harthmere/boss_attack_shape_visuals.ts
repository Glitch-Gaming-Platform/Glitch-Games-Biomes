import type { BehaviorRangedAttackParams } from "@/shared/npc/npc_types";

export const HARTHMERE_BOSS_ATTACK_SHAPE_VISUAL_VERSION =
  "harthmere-boss-attack-shapes-v1" as const;

export type HarthmereBossAttackShape = NonNullable<
  BehaviorRangedAttackParams["attackShape"]
>;

export type HarthmereBossAreaAttackShape = Exclude<
  HarthmereBossAttackShape,
  "projectile"
>;

export interface HarthmereBossAttackShapeVisualDefinition {
  shape: HarthmereBossAreaAttackShape;
  label: string;
  assetUrl: string;
  previewUrl: string;
  animationClip: "PulseLoop_24";
  baseRadius: number;
  baseLength: number;
}

const shapeVisual = (
  definition: Omit<
    HarthmereBossAttackShapeVisualDefinition,
    "assetUrl" | "previewUrl" | "animationClip"
  >
): HarthmereBossAttackShapeVisualDefinition => ({
  ...definition,
  assetUrl: `/assets/harthmere/glb/boss_attack_shapes/${definition.shape}.glb`,
  previewUrl: `/assets/harthmere/boss_attack_shape_previews/${definition.shape}.png`,
  animationClip: "PulseLoop_24",
});

export const HARTHMERE_BOSS_ATTACK_SHAPE_VISUALS = Object.freeze([
  shapeVisual({
    shape: "beam",
    label: "Boss Beam",
    baseRadius: 0.22,
    baseLength: 1,
  }),
  shapeVisual({
    shape: "cone",
    label: "Boss Cone",
    baseRadius: 0.62,
    baseLength: 1,
  }),
  shapeVisual({
    shape: "ground_aoe",
    label: "Boss Ground Area",
    baseRadius: 1,
    baseLength: 1,
  }),
  shapeVisual({
    shape: "self_aoe",
    label: "Boss Radial Area",
    baseRadius: 1,
    baseLength: 1,
  }),
] satisfies readonly HarthmereBossAttackShapeVisualDefinition[]);

const shapeVisualsByShape = new Map(
  HARTHMERE_BOSS_ATTACK_SHAPE_VISUALS.map((definition) => [
    definition.shape,
    definition,
  ])
);

export function getHarthmereBossAttackShapeVisual(
  shape: HarthmereBossAttackShape | undefined
) {
  return shape === undefined || shape === "projectile"
    ? undefined
    : shapeVisualsByShape.get(shape);
}
