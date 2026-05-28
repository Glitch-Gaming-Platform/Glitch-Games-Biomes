import { useBiomesUIReplaceLegacyFlag } from "@/client/components/biomes_ui/BiomesUIFlags";
import React from "react";

const BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS_V137 = [
  ".wake-up-container",
  ".harthmere-wakeup-character-builder",
  ".harthmere-wakeup-name-entry",
  "[data-ui-id='wake_up.screen']",
  "[data-ui-id='character_builder.screen']",
  "[data-ui-id='enter_world.screen']",
] as const;

function biomesUIIsNonGameplayScreenVisibleV137() {
  if (typeof document === "undefined") {
    return false;
  }
  return BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS_V137.some((selector) => {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  });
}

function useBiomesUINonGameplayScreenVisibleV137() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const update = () => setVisible(biomesUIIsNonGameplayScreenVisibleV137());
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "style", "data-ui-id"],
    });

    const interval = window.setInterval(update, 500);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return visible;
}

export const BiomesUIOpenPrompt: React.FunctionComponent<{
  isOpen?: boolean;
}> = ({ isOpen = false }) => {
  const replaceLegacy = useBiomesUIReplaceLegacyFlag();
  const nonGameplayScreenVisible = useBiomesUINonGameplayScreenVisibleV137();

  if (!replaceLegacy || isOpen || nonGameplayScreenVisible) {
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
