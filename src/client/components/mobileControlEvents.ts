export interface MobileControlEventLike {
  preventDefault(): void;
  stopPropagation(): void;
  nativeEvent?: {
    stopImmediatePropagation?: () => void;
  };
}

export interface MobileBrowserGestureEventLike {
  cancelable: boolean;
  preventDefault(): void;
}

/**
 * Keep a touch HUD control from becoming a canvas mouse gesture. Mobile
 * browsers commonly synthesize a click after pointer/touch input; stopping the
 * React event and its native event prevents that compatibility click from
 * reaching the gameplay primary/secondary bindings.
 */
export function containMobileControlEvent(event: MobileControlEventLike) {
  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent?.stopImmediatePropagation?.();
}

/**
 * Keep a one-finger movement gesture owned by the game instead of allowing
 * mobile Safari to reinterpret a leftward drag as browser history navigation.
 * This must be called from a non-passive touch listener.
 */
export function preventMobileBrowserNavigationGesture(
  event: MobileBrowserGestureEventLike
) {
  if (event.cancelable) {
    event.preventDefault();
  }
}
