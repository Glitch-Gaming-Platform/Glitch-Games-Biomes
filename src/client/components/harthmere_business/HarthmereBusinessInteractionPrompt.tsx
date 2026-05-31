import * as React from "react";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import { HarthmereInterfaceAccessPoint } from "../harthmere_access/HarthmereInterfaceAccessPoint";
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
    <HarthmereInterfaceAccessPoint
      kind={prompt.mode === "owner" ? "business_owner" : "business_customer"}
      title={prompt.label}
      helper={prompt.helper}
      keyLabel={prompt.keyLabel}
      eyebrow={prompt.mode === "owner" ? "Business owner access" : "Customer service access"}
      ariaLabel={prompt.label}
      onClick={() => onInteract?.(prompt.businessId!)}
      dataAttributes={{
        "data-harthmere-business-prompt": "true",
        "data-business-id": prompt.businessId,
        "data-business-mode": prompt.mode,
      }}
    />
  );
};
