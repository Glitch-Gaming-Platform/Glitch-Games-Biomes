import * as React from "react";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import type {
  HarthmereHomeConsoleAdapterV1,
  HarthmereHomeConsoleWorldContextV1,
} from "./homeConsoleLiveAdapter";

export interface HarthmereHomeConsolePromptProps {
  adapter: HarthmereHomeConsoleAdapterV1;
  context: HarthmereHomeConsoleWorldContextV1;
  onInteract?: (propertyId: string) => void;
}

export const HarthmereHomeConsolePrompt: React.FunctionComponent<
  HarthmereHomeConsolePromptProps
> = ({ adapter, context, onInteract }) => {
  React.useEffect(() => installBiomesUITheme(), []);
  if (!adapter.isHydrated()) return null;
  const prompt = adapter.getInteractionPrompt(context);
  if (!prompt.visible || !prompt.propertyId) return null;

  return (
    <button
      type="button"
      className="biomes-ui-panel"
      data-harthmere-home-console-prompt="true"
      data-home-console-access="owner-only"
      data-home-console-marker-kind="home_console"
      data-home-console-property-id={prompt.propertyId}
      data-home-console-id={prompt.consoleId}
      onClick={() => onInteract?.(prompt.propertyId!)}
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(22px, env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 1205,
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 10,
        alignItems: "center",
        maxWidth: "min(92vw, 540px)",
        padding: "10px 14px",
        textAlign: "left",
        cursor: "pointer",
      }}
      aria-label="Open home console"
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
          letterSpacing: 0,
        }}
      >
        {prompt.keyLabel}
      </span>
      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <strong
          style={{
            fontSize: 13,
            color: "var(--biomes-fg)",
            letterSpacing: 0,
            textTransform: "uppercase",
          }}
        >
          {prompt.label}
        </strong>
        <span
          style={{
            fontSize: 12,
            color: "var(--biomes-fg-muted)",
            letterSpacing: 0,
          }}
        >
          {prompt.helper}
        </span>
      </span>
    </button>
  );
};
