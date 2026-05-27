// useBlinkTarget — React hook that wires any element into the HighlightRegistry.
//
// Usage:
//   const { ref, blinking, request } = useBlinkTarget("tab.inventory");
//   return <button ref={ref} data-ui-id="tab.inventory" ...>...</button>;
//
// When something elsewhere in the app calls
//     requestHighlight({ uniqueId: "tab.inventory" })
// `blinking` flips to true for the request's duration. Wrap your visual
// effect (CSS class, framer-motion variant, etc) with `blinking`.

import { useCallback, useEffect, useRef, useState } from "react";
import type { HighlightRequest, HighlightStyle } from "./HighlightRegistry";
import {
  registerHighlightTarget,
  requestHighlight,
  clearHighlight,
} from "./HighlightRegistry";

export interface UseBlinkTargetResult<T extends HTMLElement = HTMLElement> {
  ref: React.MutableRefObject<T | null>;
  blinking: boolean;
  style: HighlightStyle | null;
  caption: string | null;
  /** Manually request a highlight on this id (handy for hover/test buttons). */
  request: (req?: Partial<HighlightRequest>) => void;
  /** Manually clear any active highlight. */
  clear: () => void;
}

export function useBlinkTarget<T extends HTMLElement = HTMLElement>(
  uniqueId: string
): UseBlinkTargetResult<T> {
  const ref = useRef<T | null>(null);
  const [blinking, setBlinking] = useState(false);
  const [style, setStyle] = useState<HighlightStyle | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = registerHighlightTarget({
      uniqueId,
      element: ref.current,
      onHighlight: (req) => {
        setBlinking(true);
        setStyle(req.style ?? "pulse");
        setCaption(req.caption ?? null);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (req.durationMs && req.durationMs > 0) {
          timeoutRef.current = setTimeout(() => {
            setBlinking(false);
            setStyle(null);
            setCaption(null);
          }, req.durationMs);
        }
      },
      onClear: () => {
        setBlinking(false);
        setStyle(null);
        setCaption(null);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      },
    });
    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [uniqueId]);

  const request = useCallback(
    (req?: Partial<HighlightRequest>) => {
      requestHighlight({ uniqueId, ...(req ?? {}) });
    },
    [uniqueId]
  );

  const clear = useCallback(() => {
    clearHighlight(uniqueId);
  }, [uniqueId]);

  return { ref, blinking, style, caption, request, clear };
}
