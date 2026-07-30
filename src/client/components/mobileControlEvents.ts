export interface MobileControlEventLike {
  preventDefault(): void;
  stopPropagation(): void;
  nativeEvent?: {
    stopImmediatePropagation?: () => void;
  };
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
