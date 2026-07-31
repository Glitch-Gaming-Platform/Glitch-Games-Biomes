import {
  harthmereCinematicExpressionSpec,
  type HarthmereCinematicExpression,
} from "@/shared/cutscene/cinematic_expressions";
import type { CutsceneAction } from "@/shared/cutscene/schema";

export interface CutsceneExpressionCue {
  role: string;
  expression: HarthmereCinematicExpression;
  at: number;
  faceTowardsRole?: string;
}

function assertCue(cue: CutsceneExpressionCue): void {
  if (!cue.role.trim()) {
    throw new Error("A cutscene expression cue requires a role");
  }
  if (!Number.isFinite(cue.at) || cue.at < 0) {
    throw new Error(`Expression cue time must be finite and non-negative`);
  }
  if (cue.faceTowardsRole !== undefined && !cue.faceTowardsRole.trim()) {
    throw new Error("faceTowardsRole cannot be empty");
  }
}

/** Compile one body+face expression cue into existing cutscene actions. */
export function cutsceneExpressionActions(
  cue: CutsceneExpressionCue
): CutsceneAction[] {
  assertCue(cue);
  const actions: CutsceneAction[] = [];
  if (cue.faceTowardsRole && cue.faceTowardsRole !== cue.role) {
    actions.push({
      kind: "face",
      at: cue.at,
      role: cue.role,
      towards: { role: cue.faceTowardsRole },
    });
  }
  actions.push({
    kind: "emote",
    at: cue.at,
    role: cue.role,
    emote: cue.expression,
  });
  return actions;
}

/**
 * Compile multiple expressions for one or more actors. Cues are sorted by
 * timeline, but two expressions for the same actor at the same instant are
 * rejected because their ordering would otherwise depend on array order.
 */
export function cutsceneExpressionSequence(
  cues: readonly CutsceneExpressionCue[]
): CutsceneAction[] {
  const ordered = [...cues].sort(
    (a, b) => a.at - b.at || a.role.localeCompare(b.role)
  );
  const lastAtByRole = new Map<string, number>();
  const actions: CutsceneAction[] = [];
  for (const cue of ordered) {
    assertCue(cue);
    const priorAt = lastAtByRole.get(cue.role);
    if (priorAt !== undefined && Math.abs(cue.at - priorAt) < 1e-6) {
      throw new Error(
        `Actor ${cue.role} has two expressions at ${cue.at.toFixed(3)}s`
      );
    }
    lastAtByRole.set(cue.role, cue.at);
    actions.push(...cutsceneExpressionActions(cue));
  }
  return actions;
}

export interface PairedCutsceneExpressionCue {
  firstRole: string;
  secondRole: string;
  expression: "hug" | "handshake" | "highFive";
  at: number;
  approach?: boolean;
  arriveWithin?: number;
}

/**
 * Build a synchronized two-actor gesture without adding another director
 * action kind. Optional approach moves only the first actor, avoiding the
 * oscillation that can occur when both actors chase each other.
 */
export function pairedCutsceneExpressionActions(
  cue: PairedCutsceneExpressionCue
): CutsceneAction[] {
  if (!cue.firstRole.trim() || !cue.secondRole.trim()) {
    throw new Error("Paired expressions require two roles");
  }
  if (cue.firstRole === cue.secondRole) {
    throw new Error("A paired expression requires two different roles");
  }
  if (!Number.isFinite(cue.at) || cue.at < 0) {
    throw new Error("Paired expression time must be finite and non-negative");
  }
  if (
    harthmereCinematicExpressionSpec(cue.expression).interaction !== "paired"
  ) {
    throw new Error(`${cue.expression} is not a paired expression`);
  }
  const actions: CutsceneAction[] = [];
  if (cue.approach) {
    actions.push({
      kind: "moveTo",
      at: Math.max(0, cue.at - 1.5),
      role: cue.firstRole,
      to: { role: cue.secondRole },
      speed: 1.6,
      arriveWithin: Math.max(0.7, Math.min(1.5, cue.arriveWithin ?? 1.05)),
      timeoutSeconds: 2.5,
      timeoutFallback: "skip",
    });
  }
  actions.push(
    {
      kind: "face",
      at: cue.at,
      role: cue.firstRole,
      towards: { role: cue.secondRole },
    },
    {
      kind: "face",
      at: cue.at,
      role: cue.secondRole,
      towards: { role: cue.firstRole },
    },
    {
      kind: "emote",
      at: cue.at,
      role: cue.firstRole,
      emote: cue.expression,
    },
    {
      kind: "emote",
      at: cue.at,
      role: cue.secondRole,
      emote: cue.expression,
    }
  );
  return actions;
}
