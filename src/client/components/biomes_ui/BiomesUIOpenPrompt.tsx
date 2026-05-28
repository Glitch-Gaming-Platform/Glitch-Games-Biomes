import { useBiomesUIReplaceLegacyFlag } from "@/client/components/biomes_ui/BiomesUIFlags";
import React from "react";

export const BiomesUIOpenPrompt: React.FunctionComponent<{
  isOpen?: boolean;
}> = ({ isOpen = false }) => {
  const replaceLegacy = useBiomesUIReplaceLegacyFlag();

  if (!replaceLegacy || isOpen) {
    return null;
  }

  return (
    <div
      className="biomes-ui-open-prompt"
      data-ui-id="hud.prompt.open_menu"
      aria-label="Press E to open menu"
    >
      <div className="biomes-ui-open-prompt__key">E</div>
      <div className="biomes-ui-open-prompt__text">
        <div className="biomes-ui-open-prompt__label">Open Menu</div>
        <div className="biomes-ui-open-prompt__hint">Press E</div>
      </div>
    </div>
  );
};
