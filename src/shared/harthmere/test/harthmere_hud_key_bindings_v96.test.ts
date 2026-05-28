declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: any;
declare const jest: any;

import {
  HARTHMERE_HUD_KEY_BINDINGS_V96,
  dispatchHarthmereHudActionEventV96,
  harthmereHudBindingForActionV96,
  harthmereHudBindingForCodeV96,
} from "@/shared/harthmere/harthmere_hud_key_bindings_v96";
import { reduceHarthmereHudStateForActionV97 } from "@/shared/harthmere/harthmere_hud_state_v97";

describe("harthmere_hud_key_bindings_v96", () => {
  it("maps every configured keyboard code back to the correct action", () => {
    for (const binding of HARTHMERE_HUD_KEY_BINDINGS_V96) {
      expect(harthmereHudBindingForCodeV96(binding.code)).toEqual(binding);
      expect(harthmereHudBindingForActionV96(binding.action)).toEqual(binding);
    }
  });

  it("returns undefined for unknown keys", () => {
    expect(harthmereHudBindingForCodeV96("KeyQ")).toBeUndefined();
  });

  it("dispatches the HUD event payload with action and binding", () => {
    const handler = jest.fn();
    window.addEventListener("biomes:harthmere-hud-action-v96", handler as EventListener);
    dispatchHarthmereHudActionEventV96("tasks");
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent | undefined;
    expect(event?.detail).toMatchObject({
      action: "tasks",
      binding: expect.objectContaining({ code: "KeyK" }),
    });
    window.removeEventListener("biomes:harthmere-hud-action-v96", handler as EventListener);
  });

  it("opens the correct panel or tab for every HUD action", () => {
    const expectedTransitions = [
      ["inventory", { panel: undefined, systemsTab: "inventory", focusAction: "inventory" }],
      ["crafting", { panel: undefined, systemsTab: "world", focusAction: "crafting" }],
      ["map", { panel: "map", systemsTab: undefined, focusAction: undefined }],
      ["quests", { panel: "quests", systemsTab: undefined, focusAction: undefined }],
      ["tasks", { panel: undefined, systemsTab: "journal", focusAction: "tasks" }],
      ["mail", { panel: undefined, systemsTab: "world", focusAction: "mail" }],
      ["notifications", { panel: undefined, systemsTab: "journal", focusAction: "notifications" }],
      ["codex", { panel: undefined, systemsTab: "dialogue", focusAction: "codex" }],
      ["settings", { panel: undefined, systemsTab: "world", focusAction: "settings" }],
    ] as const;

    for (const [action, expected] of expectedTransitions) {
      expect(
        reduceHarthmereHudStateForActionV97(
          { panel: undefined, systemsTab: undefined, focusAction: undefined },
          action,
        ),
      ).toEqual(expected);
    }
  });

  it("toggles repeated actions closed but preserves distinct actions that share a tab", () => {
    const openedByTasks = reduceHarthmereHudStateForActionV97(
      { panel: undefined, systemsTab: undefined, focusAction: undefined },
      "tasks",
    );
    expect(openedByTasks).toEqual({
      panel: undefined,
      systemsTab: "journal",
      focusAction: "tasks",
    });

    const retargetedToNotifications = reduceHarthmereHudStateForActionV97(
      openedByTasks,
      "notifications",
    );
    expect(retargetedToNotifications).toEqual({
      panel: undefined,
      systemsTab: "journal",
      focusAction: "notifications",
    });

    const closedByRepeatingNotifications = reduceHarthmereHudStateForActionV97(
      retargetedToNotifications,
      "notifications",
    );
    expect(closedByRepeatingNotifications).toEqual({
      panel: undefined,
      systemsTab: undefined,
      focusAction: undefined,
    });
  });
});
