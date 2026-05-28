// BIOMES_HUD_STATE_V97
// Pure HUD state reducer shared by the client HUD and Node/Mocha tests.
// Keep this file free of React/client/asset imports so tests do not load Next image assets.

import {
  harthmereHudBindingForActionV96,
  type HarthmereHudActionV96,
  type HarthmereHudSystemTabV96,
} from "@/shared/harthmere/harthmere_hud_key_bindings_v96";

export type HarthmereHudPanelV97 = "map" | "quests" | undefined;

export interface HarthmereHudViewStateV97 {
  panel: HarthmereHudPanelV97;
  systemsTab?: HarthmereHudSystemTabV96;
  focusAction?: HarthmereHudActionV96;
}

export function reduceHarthmereHudStateForActionV97(
  state: HarthmereHudViewStateV97,
  action: HarthmereHudActionV96,
): HarthmereHudViewStateV97 {
  const binding = harthmereHudBindingForActionV96(action);
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
