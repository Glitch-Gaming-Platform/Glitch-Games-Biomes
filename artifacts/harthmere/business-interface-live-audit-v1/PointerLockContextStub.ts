import * as React from "react";
export class PointerLockManager { isLocked() { return false; } unlock() {} focusAndLock() {} }
export const PointerLockManagerContext = React.createContext(new PointerLockManager());
export const usePointerLockManager = () => React.useContext(PointerLockManagerContext);
