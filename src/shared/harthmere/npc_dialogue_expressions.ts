// HARTHMERE_NPC_DIALOGUE_EXPRESSIONS
//
// Local presentation bridge for authored NPC dialogue acting. Dialogue is a
// per-player UI concern: it must not mutate the shared NPC Emote component or
// compete with Anima's authoritative movement/combat state. The NPC renderer
// reads this short-lived cue and applies the same body+face expression catalog
// used by cutscenes.

import type { HarthmereCinematicExpression } from "@/shared/cutscene/cinematic_expressions";

export interface HarthmereNpcDialogueExpressionCue {
  actorId: number;
  expression: HarthmereCinematicExpression;
  nonce: string;
  startedAtMs: number;
}

export interface HarthmereNpcDialogueActorCandidate {
  id: number;
  label?: string;
  position?: readonly [number, number, number];
}

export const HARTHMERE_NPC_DIALOGUE_EXPRESSION_BRIDGE_KEY =
  "__harthmereNpcDialogueExpression" as const;

const STALE_DIALOGUE_EXPRESSION_MS = 10 * 60 * 1000;

type DialogueExpressionWindow = typeof globalThis & {
  __harthmereNpcDialogueExpression?: HarthmereNpcDialogueExpressionCue;
};

function normalizedLabel(value: string | undefined): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function distanceSquared(
  a: readonly [number, number, number] | undefined,
  b: readonly [number, number, number] | undefined
): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

/** Resolve the exact rendered human who should perform a dialogue expression. */
export function resolveHarthmereNpcDialogueActor(input: {
  speaker: string;
  aliases?: readonly string[];
  preferredActorId?: number;
  targetPosition?: readonly [number, number, number];
  candidates: readonly HarthmereNpcDialogueActorCandidate[];
}): number | undefined {
  if (
    input.preferredActorId !== undefined &&
    Number.isSafeInteger(input.preferredActorId) &&
    input.preferredActorId > 0
  ) {
    return input.preferredActorId;
  }
  const labels = new Set(
    [input.speaker, ...(input.aliases ?? [])]
      .map(normalizedLabel)
      .filter(Boolean)
  );
  const matches = input.candidates.filter((candidate) =>
    labels.has(normalizedLabel(candidate.label))
  );
  matches.sort(
    (a, b) =>
      distanceSquared(a.position, input.targetPosition) -
        distanceSquared(b.position, input.targetPosition) || a.id - b.id
  );
  return matches[0]?.id;
}

export function publishHarthmereNpcDialogueExpression(
  input: Omit<HarthmereNpcDialogueExpressionCue, "startedAtMs"> & {
    startedAtMs?: number;
  }
): HarthmereNpcDialogueExpressionCue | undefined {
  if (
    typeof window === "undefined" ||
    !Number.isSafeInteger(input.actorId) ||
    input.actorId <= 0 ||
    !input.nonce.trim()
  ) {
    return undefined;
  }
  const cue: HarthmereNpcDialogueExpressionCue = {
    actorId: input.actorId,
    expression: input.expression,
    nonce: input.nonce,
    startedAtMs:
      input.startedAtMs !== undefined && Number.isFinite(input.startedAtMs)
        ? input.startedAtMs
        : Date.now(),
  };
  (window as DialogueExpressionWindow).__harthmereNpcDialogueExpression = cue;
  return cue;
}

export function clearHarthmereNpcDialogueExpression(nonce?: string): void {
  if (typeof window === "undefined") return;
  const win = window as DialogueExpressionWindow;
  if (
    nonce !== undefined &&
    win.__harthmereNpcDialogueExpression?.nonce !== nonce
  ) {
    return;
  }
  delete win.__harthmereNpcDialogueExpression;
}

export function readHarthmereNpcDialogueExpression(
  actorId: number,
  nowMs = Date.now()
): HarthmereNpcDialogueExpressionCue | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as DialogueExpressionWindow;
  const cue = win.__harthmereNpcDialogueExpression;
  if (!cue) return undefined;
  if (nowMs - cue.startedAtMs > STALE_DIALOGUE_EXPRESSION_MS) {
    delete win.__harthmereNpcDialogueExpression;
    return undefined;
  }
  return cue.actorId === actorId ? cue : undefined;
}
