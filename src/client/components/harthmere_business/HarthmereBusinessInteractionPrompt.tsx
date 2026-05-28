import * as React from "react";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import type { HarthmereBusinessInterfaceAdapterV1, HarthmereBusinessWorldContextV1 } from "./businessInterfaceLiveAdapter";

export interface HarthmereBusinessInteractionPromptProps {
  adapter: HarthmereBusinessInterfaceAdapterV1;
  context: HarthmereBusinessWorldContextV1;
  onInteract?: (businessId: string) => void;
}

export const HarthmereBusinessInteractionPrompt: React.FunctionComponent<HarthmereBusinessInteractionPromptProps> = ({ adapter, context, onInteract }) => {
  React.useEffect(() => installBiomesUITheme(), []);
  if (!adapter.isHydrated()) return null;
  const prompt = adapter.getInteractionPrompt(context);
  if (!prompt.visible || !prompt.businessId) return null;

  return (
    <button
      type="button"
      className="biomes-ui-panel"
      data-harthmere-business-prompt="true"
      data-business-id={prompt.businessId}
      data-business-mode={prompt.mode}
      onClick={() => onInteract?.(prompt.businessId!)}
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(22px, env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 1200,
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 10,
        alignItems: "center",
        maxWidth: "min(92vw, 520px)",
        padding: "10px 14px",
        textAlign: "left",
        cursor: "pointer",
      }}
      aria-label={prompt.label}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          minWidth: 34,
          minHeight: 34,
          border: "1px solid var(--biomes-edge-cyan-soft)",
          borderRadius: 4,
          color: "var(--biomes-fg)",
          fontWeight: 700,
        }}
      >
        {prompt.keyLabel}
      </span>
      <span style={{ display: "grid", gap: 2 }}>
        <strong style={{ fontSize: 13, color: "var(--biomes-fg)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{prompt.label}</strong>
        <span style={{ fontSize: 12, color: "var(--biomes-fg-muted)" }}>{prompt.helper}</span>
      </span>
    </button>
  );
};
