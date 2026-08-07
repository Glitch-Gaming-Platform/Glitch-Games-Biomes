export interface Chapter1ObjectiveWorldProjection {
  key: string;
  authoredStepId: string;
  label: string;
  position: [number, number, number];
  trigger: string;
  targetEntityId?: number;
}

export const CHAPTER1_OBJECTIVE_INTERACT_EVENT =
  "chapter1-objective-interact" as const;
export const CHAPTER1_RECOVERED_TAB_VISIBILITY_EVENT =
  "chapter1-recovered-tab-visibility" as const;

let activeProjection: Chapter1ObjectiveWorldProjection | undefined;
let recoveredTabVisible = false;

export function publishChapter1ObjectiveWorldProjection(
  projection: Chapter1ObjectiveWorldProjection | undefined
) {
  activeProjection = projection;
  if (typeof window !== "undefined") {
    (
      window as typeof window & {
        __chapter1ObjectiveWorldProjection?: Chapter1ObjectiveWorldProjection;
      }
    ).__chapter1ObjectiveWorldProjection = projection;
  }
}

export function readChapter1ObjectiveWorldProjection() {
  return activeProjection;
}

export function publishChapter1RecoveredTabVisibility(visible: boolean) {
  recoveredTabVisible = visible;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CHAPTER1_RECOVERED_TAB_VISIBILITY_EVENT, {
        detail: { visible },
      })
    );
  }
}

export function readChapter1RecoveredTabVisibility() {
  return recoveredTabVisible;
}
