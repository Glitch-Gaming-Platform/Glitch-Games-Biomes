import { useBiomesUIReplaceLegacyFlag } from "@/client/components/biomes_ui/BiomesUIFlags";
import { usePointerLockUnlockWhileOpenActiveV1 } from "@/client/components/contexts/usePointerLockUnlockWhileOpenActiveV1";
import React from "react";
import {
  BIOMES_UI_OPEN_MENU_SHORTCUT,
  BIOMES_UI_QUESTS_SHORTCUT,
} from "./BiomesUITypes";
import { Highlightable } from "./highlight/HighlightOverlay";
import { UI_IDS } from "./uniqueIds";

export const BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS_V137 = [
  ".loading-wrapper",
  ".wake-up-container",
  ".harthmere-wakeup-character-builder",
  ".harthmere-wakeup-name-entry",
  "[data-ui-id='wake_up.screen']",
  "[data-ui-id='character_builder.screen']",
  "[data-ui-id='enter_world.screen']",
] as const;

type BiomesUINonGameplayRootV137 = Pick<ParentNode, "querySelector">;
type BiomesUINonGameplayStyleReaderV137 = (
  element: Element
) => Pick<CSSStyleDeclaration, "display" | "visibility">;

function defaultBiomesUINonGameplayRootV137():
  | BiomesUINonGameplayRootV137
  | undefined {
  return typeof document === "undefined" ? undefined : document;
}

function defaultBiomesUINonGameplayStyleReaderV137():
  | BiomesUINonGameplayStyleReaderV137
  | undefined {
  return typeof window === "undefined"
    ? undefined
    : (element) => window.getComputedStyle(element);
}

export function biomesUIIsNonGameplayScreenVisibleV137(
  root:
    | BiomesUINonGameplayRootV137
    | undefined = defaultBiomesUINonGameplayRootV137(),
  readStyle:
    | BiomesUINonGameplayStyleReaderV137
    | undefined = defaultBiomesUINonGameplayStyleReaderV137()
) {
  if (!root || !readStyle) {
    return false;
  }
  return BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS_V137.some((selector) => {
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
  const uiOpen = usePointerLockUnlockWhileOpenActiveV1();

  if (!replaceLegacy || isOpen || uiOpen || nonGameplayScreenVisible) {
    return null;
  }

  return (
    <Highlightable uniqueId={UI_IDS.HUD_PROMPT_OPEN_MENU} showCaption>
      <div
        className="biomes-ui-open-prompt"
        data-ui-id={UI_IDS.HUD_PROMPT_OPEN_MENU}
        data-biomes-ui-open={isOpen ? "true" : "false"}
        aria-label={`Press ${BIOMES_UI_OPEN_MENU_SHORTCUT} to open menu. Press ${BIOMES_UI_QUESTS_SHORTCUT} to open quests`}
      >
        <div className="biomes-ui-open-prompt__row">
          <div className="biomes-ui-open-prompt__key">
            {BIOMES_UI_OPEN_MENU_SHORTCUT}
          </div>
          <div className="biomes-ui-open-prompt__text">
            <div className="biomes-ui-open-prompt__label">Open Menu</div>
            <div className="biomes-ui-open-prompt__hint">
              Press {BIOMES_UI_OPEN_MENU_SHORTCUT}
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
