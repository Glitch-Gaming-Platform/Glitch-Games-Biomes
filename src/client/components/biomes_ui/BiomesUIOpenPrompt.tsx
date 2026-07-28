import { useBiomesUIReplaceLegacyFlag } from "@/client/components/biomes_ui/BiomesUIFlags";
import { usePointerLockUnlockWhileOpenActive } from "@/client/components/contexts/usePointerLockUnlockWhileOpenActive";
import React from "react";
import {
  BIOMES_UI_QUESTS_SHORTCUT,
  BIOMES_UI_RECIPES_SHORTCUT,
} from "./BiomesUITypes";
import { Highlightable } from "./highlight/HighlightOverlay";
import { UI_IDS } from "./uniqueIds";

export const BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS = [
  ".loading-wrapper",
  ".wake-up-container",
  ".harthmere-wakeup-character-builder",
  ".harthmere-wakeup-name-entry",
  "[data-ui-id='wake_up.screen']",
  "[data-ui-id='character_builder.screen']",
  "[data-ui-id='enter_world.screen']",
] as const;

type BiomesUINonGameplayRoot = Pick<ParentNode, "querySelector">;
type BiomesUINonGameplayStyleReader = (
  element: Element
) => Pick<CSSStyleDeclaration, "display" | "visibility">;

function defaultBiomesUINonGameplayRoot():
  | BiomesUINonGameplayRoot
  | undefined {
  return typeof document === "undefined" ? undefined : document;
}

function defaultBiomesUINonGameplayStyleReader():
  | BiomesUINonGameplayStyleReader
  | undefined {
  return typeof window === "undefined"
    ? undefined
    : (element) => window.getComputedStyle(element);
}

export function biomesUIIsNonGameplayScreenVisible(
  root:
    | BiomesUINonGameplayRoot
    | undefined = defaultBiomesUINonGameplayRoot(),
  readStyle:
    | BiomesUINonGameplayStyleReader
    | undefined = defaultBiomesUINonGameplayStyleReader()
) {
  if (!root || !readStyle) {
    return false;
  }
  return BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS.some((selector) => {
    const element = root.querySelector(selector);
    if (!element) {
      return false;
    }
    const style = readStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  });
}

function useBiomesUINonGameplayScreenVisible() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const update = () => setVisible(biomesUIIsNonGameplayScreenVisible());
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
  const nonGameplayScreenVisible = useBiomesUINonGameplayScreenVisible();
  const uiOpen = usePointerLockUnlockWhileOpenActive();

  if (!replaceLegacy || isOpen || uiOpen || nonGameplayScreenVisible) {
    return null;
  }

  return (
    <Highlightable uniqueId={UI_IDS.HUD_PROMPT_OPEN_MENU} showCaption>
      <div
        className="biomes-ui-open-prompt"
        data-ui-id={UI_IDS.HUD_PROMPT_OPEN_MENU}
        data-biomes-ui-open={isOpen ? "true" : "false"}
        aria-label={`Press ${BIOMES_UI_RECIPES_SHORTCUT} to open Recipes. Press ${BIOMES_UI_QUESTS_SHORTCUT} to open quests`}
      >
        <div className="biomes-ui-open-prompt__row">
          <div className="biomes-ui-open-prompt__key">
            {BIOMES_UI_RECIPES_SHORTCUT}
          </div>
          <div className="biomes-ui-open-prompt__text">
            <div className="biomes-ui-open-prompt__label">Open Recipes</div>
            <div className="biomes-ui-open-prompt__hint">
              Press {BIOMES_UI_RECIPES_SHORTCUT}
            </div>
          </div>
        </div>
        <div className="biomes-ui-open-prompt__row biomes-ui-open-prompt__row--secondary">
          <div className="biomes-ui-open-prompt__key">
            {BIOMES_UI_QUESTS_SHORTCUT}
          </div>
          <div className="biomes-ui-open-prompt__text">
            <div className="biomes-ui-open-prompt__label">Open Quests</div>
            <div className="biomes-ui-open-prompt__hint">
              Press {BIOMES_UI_QUESTS_SHORTCUT}
            </div>
          </div>
        </div>
      </div>
    </Highlightable>
  );
};
