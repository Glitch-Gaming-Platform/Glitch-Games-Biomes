export const HARTHMERE_LEVEL_UP_SOUND_PATH =
  "/assets/harthmere/audio/freesound-gamestudio-drop-coin-384921.mp3";

export function effectiveLevelForCelebrationForTest(input: {
  nativeAuthority: boolean;
  nativeMigrationVersion: number;
  nativeLevel: number;
  legacyLevel: number;
}): number | undefined {
  if (input.nativeAuthority) {
    // Wait for the native progression document to hydrate. Treating its
    // temporary Level 1 default as real would celebrate when an existing
    // higher-level character merely finishes loading.
    if (input.nativeMigrationVersion <= 0) return undefined;
    return Math.max(1, Math.floor(Number(input.nativeLevel) || 1));
  }
  return Math.max(1, Math.floor(Number(input.legacyLevel) || 1));
}

export function levelUpCelebrationTransitionForTest(
  previousLevel: number | undefined,
  currentLevel: number | undefined
): {
  nextPreviousLevel: number | undefined;
  celebrationLevel?: number;
} {
  if (currentLevel === undefined) {
    return { nextPreviousLevel: previousLevel };
  }
  const normalized = Math.max(1, Math.floor(Number(currentLevel) || 1));
  return {
    nextPreviousLevel: normalized,
    celebrationLevel:
      previousLevel !== undefined && normalized > previousLevel
        ? normalized
        : undefined,
  };
}
