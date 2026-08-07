export const HARTHMERE_COMBAT_PRESENTATION_VERSION =
  "harthmere-combat-presentation-v1" as const;

export type HarthmereCombatPresentationSnapshot = {
  version: typeof HARTHMERE_COMBAT_PRESENTATION_VERSION;
  activeCombat: boolean;
  biomesUiOpen: boolean;
  suspended: boolean;
};

const listeners = new Set<() => void>();
let snapshot: HarthmereCombatPresentationSnapshot = {
  version: HARTHMERE_COMBAT_PRESENTATION_VERSION,
  activeCombat: false,
  biomesUiOpen: false,
  suspended: false,
};

function publish(input: { activeCombat?: boolean; biomesUiOpen?: boolean }) {
  const activeCombat = input.activeCombat ?? snapshot.activeCombat;
  const biomesUiOpen = input.biomesUiOpen ?? snapshot.biomesUiOpen;
  const next: HarthmereCombatPresentationSnapshot = {
    version: HARTHMERE_COMBAT_PRESENTATION_VERSION,
    activeCombat,
    biomesUiOpen,
    suspended: activeCombat && !biomesUiOpen,
  };
  if (
    next.activeCombat === snapshot.activeCombat &&
    next.biomesUiOpen === snapshot.biomesUiOpen
  ) {
    return;
  }
  snapshot = next;
  if (typeof window !== "undefined") {
    (
      window as typeof window & {
        __harthmereCombatPresentationDebug?: HarthmereCombatPresentationSnapshot;
      }
    ).__harthmereCombatPresentationDebug = { ...next };
  }
  for (const listener of listeners) listener();
}

export function setHarthmereCombatPresentationActive(activeCombat: boolean) {
  publish({ activeCombat });
}

export function setHarthmereBiomesUiOpen(biomesUiOpen: boolean) {
  publish({ biomesUiOpen });
}

export function readHarthmereCombatPresentation() {
  return snapshot;
}

export function subscribeHarthmereCombatPresentation(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetHarthmereCombatPresentationForTest() {
  snapshot = {
    version: HARTHMERE_COMBAT_PRESENTATION_VERSION,
    activeCombat: false,
    biomesUiOpen: false,
    suspended: false,
  };
}
