// BIOMES_HUD_STATE
// Pure HUD state reducer shared by the client HUD and Node/Mocha tests.
// Keep this file free of React/client/asset imports so tests do not load Next image assets.

import {
  harthmereHudBindingForAction,
  type HarthmereHudAction,
  type HarthmereHudSystemTab,
} from "@/shared/harthmere/harthmere_hud_key_bindings";

export type HarthmereHudPanel = "map" | "quests" | undefined;

export interface HarthmereHudViewState {
  panel: HarthmereHudPanel;
  systemsTab?: HarthmereHudSystemTab;
  focusAction?: HarthmereHudAction;
}

export function reduceHarthmereHudStateForAction(
  state: HarthmereHudViewState,
  action: HarthmereHudAction,
): HarthmereHudViewState {
  const binding = harthmereHudBindingForAction(action);
  if (binding.targetPanel === "map") {
    return {
      panel: state.panel === "map" ? undefined : "map",
      systemsTab: undefined,
      focusAction: undefined,
    };
  }
  if (binding.targetPanel === "quests") {
    return {
      panel: state.panel === "quests" ? undefined : "quests",
      systemsTab: undefined,
      focusAction: undefined,
    };
  }
  const nextTab = binding.targetTab ?? "world";
  const isSameOpenTarget =
    state.panel === undefined &&
    state.systemsTab === nextTab &&
    state.focusAction === action;
  if (isSameOpenTarget) {
    return { panel: undefined, systemsTab: undefined, focusAction: undefined };
  }
  return {
    panel: undefined,
    systemsTab: nextTab,
    focusAction: action,
  };
}
