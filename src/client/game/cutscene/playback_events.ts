// HARTHMERE_CUTSCENE_PLAYBACK_EVENTS
//
// Small client-local lifecycle bus shared by preview/video tooling. The pure
// runtime stays platform-agnostic; the client director reports only when a
// scene actually begins after prewarm and when its finish path completes.

import type { CutsceneFinishReason } from "@/shared/cutscene/director_core";

export type CutscenePlaybackEvent =
  | { kind: "started"; defId: string; atMs: number }
  | {
      kind: "finished";
      defId: string;
      reason: CutsceneFinishReason;
      atMs: number;
    };

const listeners = new Set<(event: CutscenePlaybackEvent) => void>();

export function subscribeCutscenePlayback(
  listener: (event: CutscenePlaybackEvent) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishCutscenePlayback(event: CutscenePlaybackEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}
