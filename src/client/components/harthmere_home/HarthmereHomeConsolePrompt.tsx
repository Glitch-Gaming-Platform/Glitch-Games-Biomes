import * as React from "react";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import { HarthmereInterfaceAccessPoint } from "../harthmere_access/HarthmereInterfaceAccessPoint";
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
    <HarthmereInterfaceAccessPoint
      kind="home_owner"
      title={prompt.label}
      helper={prompt.helper}
      keyLabel={prompt.keyLabel}
      eyebrow="Home owner access"
      ariaLabel="Open home console"
      onClick={() => onInteract?.(prompt.propertyId!)}
      dataAttributes={{
        "data-harthmere-home-console-prompt": "true",
        "data-home-console-access": "owner-only",
        "data-home-console-marker-kind": "home_console",
        "data-home-console-property-id": prompt.propertyId,
        "data-home-console-id": prompt.consoleId,
      }}
    />
  );
};
