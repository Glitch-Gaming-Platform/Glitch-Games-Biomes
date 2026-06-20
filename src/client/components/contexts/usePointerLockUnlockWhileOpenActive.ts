// HARTHMERE_UI: React hook returning whether any "unlock-while-open"
// surface (Jobs Board, Home Console, Business Interface, Crafting Station)
// is currently mounted. Surfaces signal this via the shared
// `pointerLockModalPolicy` depth counter. The EscGameMenu consumes this hook
// to suppress its "Return to Game" / "Give Feedback" overlay while those
// panels are open — the panels intentionally release pointer lock to let the
// player use the mouse, and the escape menu must not pop on top of them.

import * as React from "react";
import {
  isPointerLockUnlockWhileOpenActive,
  subscribePointerLockUnlockWhileOpen,
} from "./pointerLockModalPolicy";

export function usePointerLockUnlockWhileOpenActive(): boolean {
  const [active, setActive] = React.useState<boolean>(() =>
    isPointerLockUnlockWhileOpenActive()
  );
  React.useEffect(() => {
    const sync = () => setActive(isPointerLockUnlockWhileOpenActive());
    // Re-sync immediately in case a panel opened between render and effect.
    sync();
    return subscribePointerLockUnlockWhileOpen(sync);
  }, []);
  return active;
}
