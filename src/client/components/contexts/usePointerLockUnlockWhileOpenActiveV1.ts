// HARTHMERE_UI_V147: React hook returning whether any "unlock-while-open"
// surface (Jobs Board, Home Console, Business Interface, Crafting Station)
// is currently mounted. Surfaces signal this via the shared
// `pointerLockModalPolicy` depth counter. The EscGameMenu consumes this hook
// to suppress its "Return to Game" / "Give Feedback" overlay while those
// panels are open — the panels intentionally release pointer lock to let the
// player use the mouse, and the escape menu must not pop on top of them.

import * as React from "react";
import {
  isPointerLockUnlockWhileOpenActiveV1,
  subscribePointerLockUnlockWhileOpenV1,
} from "./pointerLockModalPolicy";

export function usePointerLockUnlockWhileOpenActiveV1(): boolean {
  const [active, setActive] = React.useState<boolean>(() =>
    isPointerLockUnlockWhileOpenActiveV1()
  );
  React.useEffect(() => {
    const sync = () => setActive(isPointerLockUnlockWhileOpenActiveV1());
    // Re-sync immediately in case a panel opened between render and effect.
    sync();
    return subscribePointerLockUnlockWhileOpenV1(sync);
  }, []);
  return active;
}
