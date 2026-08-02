// HighlightOverlay — applies a blinking/pulsing visual treatment when its
// child element has an active highlight. Wrap any element you want to be
// "blinkable" in this component (or use the lower-level `useBlinkTarget`
// hook directly for more control).
//
// Example:
//   <Highlightable uniqueId="tab.inventory">
//     <button>Inventory</button>
//   </Highlightable>

import * as React from "react";
import { useBlinkTarget } from "./useBlinkTarget";

interface HighlightableProps {
  uniqueId: string;
  /** Render a caption above the element when highlighted */
  showCaption?: boolean;
  children: React.ReactElement<{
    className?: string;
    ref?: React.Ref<HTMLElement>;
    "data-ui-id"?: string;
    "data-ui-blinking"?: string;
  }>;
  /** Extra class applied while blinking */
  blinkClassName?: string;
}

/**
 * Wraps a child element so it pulses when requestHighlight(uniqueId) fires.
 *
 * Implementation note: we clone the child to attach our ref + data-ui-id
 * + a className when blinking. This keeps the API non-invasive — callers
 * don't have to thread refs themselves.
 */
export const Highlightable: React.FunctionComponent<HighlightableProps> = ({
  uniqueId,
  children,
  showCaption,
  blinkClassName,
}) => {
  const { ref, blinking, style, caption } = useBlinkTarget<HTMLElement>(
    uniqueId
  );

  const styleClass = (() => {
    if (!blinking) return "";
    if (blinkClassName) return blinkClassName;
    switch (style) {
      case "ring":
        return "biomes-ui-blink-ring";
      case "arrow":
        return "biomes-ui-blink-arrow";
      case "shimmer":
        return "biomes-ui-blink-shimmer";
      case "pulse":
      default:
        return "biomes-ui-blink-pulse";
    }
  })();

  const mergedClassName = [
    children.props.className ?? "",
    styleClass,
  ]
    .filter(Boolean)
    .join(" ");

  const childWithRef = React.cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      ref.current = node;
      // forward to any existing ref on the child
      const existing = children.props.ref;
      if (typeof existing === "function") existing(node);
      else if (existing && typeof existing === "object") existing.current = node;
    },
    "data-ui-id": uniqueId,
    "data-ui-blinking": blinking ? "true" : undefined,
    className: mergedClassName,
  });

  if (!showCaption || !caption || !blinking) return childWithRef;

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {childWithRef}
      <span
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "2px 8px",
          borderRadius: 6,
          background: "rgba(11, 22, 38, 0.92)",
          color: "#9ce8ff",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          boxShadow: "0 0 12px rgba(0, 200, 255, 0.45)",
          pointerEvents: "none",
        }}
      >
        {caption}
      </span>
    </span>
  );
};
