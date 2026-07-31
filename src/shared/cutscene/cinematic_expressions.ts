import catalog from "@/shared/cutscene/cinematic_expression_catalog.json";
import type { HarthmereFacialExpression } from "@/shared/harthmere/voxel_faces";
import { z } from "zod";

export type HarthmereCinematicExpression = keyof typeof catalog;

export type HarthmereCinematicExpressionPlayback = "once" | "loop" | "hold";
export type HarthmereCinematicExpressionInteraction =
  | "solo"
  | "targeted"
  | "paired"
  | "stance"
  | "locomotion"
  | "idle";

export interface HarthmereCinematicExpressionSpec {
  clip: string;
  motion: string;
  face: HarthmereFacialExpression;
  playback: HarthmereCinematicExpressionPlayback;
  durationSeconds: number;
  interaction: HarthmereCinematicExpressionInteraction;
  fallbacks: readonly string[];
}

export const HARTHMERE_CINEMATIC_EXPRESSION_CATALOG = catalog as Readonly<
  Record<HarthmereCinematicExpression, HarthmereCinematicExpressionSpec>
>;

export const HARTHMERE_CINEMATIC_EXPRESSIONS = Object.freeze(
  Object.keys(catalog) as HarthmereCinematicExpression[]
) as readonly HarthmereCinematicExpression[];

export const zHarthmereCinematicExpression =
  z.custom<HarthmereCinematicExpression>(
    (value) =>
      typeof value === "string" &&
      Object.prototype.hasOwnProperty.call(catalog, value),
    { message: "must be a registered Harthmere cinematic expression" }
  );

export function isHarthmereCinematicExpression(
  value: unknown
): value is HarthmereCinematicExpression {
  return zHarthmereCinematicExpression.safeParse(value).success;
}

const NORMALIZED_EXPRESSION_IDS = new Map(
  HARTHMERE_CINEMATIC_EXPRESSIONS.map((expression) => [
    expression.toLowerCase().replace(/[^a-z0-9]+/g, ""),
    expression,
  ])
);

export function parseHarthmereCinematicExpression(
  value: string
): HarthmereCinematicExpression | undefined {
  return NORMALIZED_EXPRESSION_IDS.get(
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
  );
}

export function harthmereCinematicExpressionDisplayName(
  expression: HarthmereCinematicExpression
): string {
  return expression
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (first) => first.toUpperCase());
}

export function harthmereCinematicExpressionSpec(
  expression: HarthmereCinematicExpression
): HarthmereCinematicExpressionSpec {
  return HARTHMERE_CINEMATIC_EXPRESSION_CATALOG[expression];
}

export const HARTHMERE_CINEMATIC_EXPRESSION_CLIPS = Object.freeze([
  ...new Set(
    HARTHMERE_CINEMATIC_EXPRESSIONS.map(
      (expression) => harthmereCinematicExpressionSpec(expression).clip
    )
  ),
]);

export interface HarthmereCinematicAnimationDefinition {
  fileAnimationName: string;
  backupFileAnimationNames: string[];
}

export const HARTHMERE_CINEMATIC_ANIMATION_DEFINITIONS = Object.fromEntries(
  HARTHMERE_CINEMATIC_EXPRESSIONS.map((expression) => {
    const spec = harthmereCinematicExpressionSpec(expression);
    return [
      expression,
      {
        fileAnimationName: spec.clip,
        backupFileAnimationNames: [...spec.fallbacks],
      },
    ];
  })
) as unknown as {
  [K in HarthmereCinematicExpression]: HarthmereCinematicAnimationDefinition;
};

export function harthmereCinematicExpressionRepeat(
  expression: HarthmereCinematicExpression
): { kind: "repeat" } | { kind: "once"; clampWhenFinished?: boolean } {
  switch (harthmereCinematicExpressionSpec(expression).playback) {
    case "loop":
      return { kind: "repeat" };
    case "hold":
      return { kind: "once", clampWhenFinished: true };
    case "once":
      return { kind: "once" };
  }
}

export interface HarthmereCinematicExpressionPlaybackCursor {
  expression?: HarthmereCinematicExpression;
  time: number;
}

export interface HarthmereCinematicExpressionPlaybackTransition
  extends HarthmereCinematicExpressionPlaybackCursor {
  started: boolean;
  ended: boolean;
}

/**
 * Detect expression starts, ends, and same-expression timeline restarts.
 * Cutscene puppet animation time resets at each authored action, so comparing
 * the cursor prevents per-frame face events without missing a repeated cue.
 */
export function harthmereCinematicExpressionPlaybackTransition(
  prior: HarthmereCinematicExpressionPlaybackCursor | undefined,
  animation: string | undefined,
  time: number
): HarthmereCinematicExpressionPlaybackTransition {
  const expression = isHarthmereCinematicExpression(animation)
    ? animation
    : undefined;
  const normalizedTime = Number.isFinite(time) ? Math.max(0, time) : 0;
  const restarted = Boolean(
    expression &&
      prior?.expression === expression &&
      normalizedTime + 1e-3 < prior.time
  );
  return {
    expression,
    time: normalizedTime,
    started: Boolean(
      expression && (expression !== prior?.expression || restarted)
    ),
    ended: Boolean(prior?.expression && !expression),
  };
}

export function harthmereCinematicExpressionDurationMs(
  expression: HarthmereCinematicExpression
): number {
  return Math.round(
    harthmereCinematicExpressionSpec(expression).durationSeconds * 1000
  );
}
