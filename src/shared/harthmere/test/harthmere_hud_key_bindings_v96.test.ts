import assert from "assert";

import {
  HARTHMERE_HUD_KEY_BINDINGS_V96,
  dispatchHarthmereHudActionEventV96,
  harthmereHudBindingForActionV96,
  harthmereHudBindingForCodeV96,
} from "@/shared/harthmere/harthmere_hud_key_bindings_v96";
import { reduceHarthmereHudStateForActionV97 } from "@/shared/harthmere/harthmere_hud_state_v97";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;

function withHudEventTarget(fn: () => void) {
  const globalAny = globalThis as any;
  const previousWindow = globalAny.window;
  const previousCustomEvent = globalAny.CustomEvent;

  class TestCustomEvent<T = unknown> extends Event {
    readonly detail: T;
    constructor(type: string, init?: CustomEventInit<T>) {
      super(type);
      this.detail = init?.detail as T;
    }
  }

  const eventTarget = new EventTarget();
  globalAny.window = eventTarget;
  if (typeof globalAny.CustomEvent === "undefined") {
    globalAny.CustomEvent = TestCustomEvent;
  }

  try {
    fn();
  } finally {
    if (previousWindow === undefined) {
      delete globalAny.window;
    } else {
      globalAny.window = previousWindow;
    }
    if (previousCustomEvent === undefined) {
      delete globalAny.CustomEvent;
    } else {
      globalAny.CustomEvent = previousCustomEvent;
    }
  }
}

describe("harthmere_hud_key_bindings_v96", () => {
  it("maps every configured keyboard code back to the correct action", () => {
    for (const binding of HARTHMERE_HUD_KEY_BINDINGS_V96) {
      assert.deepStrictEqual(harthmereHudBindingForCodeV96(binding.code), binding);
      assert.deepStrictEqual(harthmereHudBindingForActionV96(binding.action), binding);
    }
  });

  it("returns undefined for unknown keys", () => {
    assert.strictEqual(harthmereHudBindingForCodeV96("KeyQ"), undefined);
  });

  it("dispatches the HUD event payload with action and binding", () => {
    withHudEventTarget(() => {
      let received: CustomEvent | undefined;
      const handler = (event: Event) => {
        received = event as CustomEvent;
      };
      window.addEventListener("biomes:harthmere-hud-action-v96", handler);
      dispatchHarthmereHudActionEventV96("tasks");
      window.removeEventListener("biomes:harthmere-hud-action-v96", handler);

      assert.ok(received, "expected HUD action event to be dispatched");
      assert.strictEqual(received.detail.action, "tasks");
      assert.strictEqual(received.detail.binding.code, "KeyK");
    });
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
      assert.deepStrictEqual(
        reduceHarthmereHudStateForActionV97(
          { panel: undefined, systemsTab: undefined, focusAction: undefined },
          action,
        ),
        expected,
      );
    }
  });

  it("toggles repeated actions closed but preserves distinct actions that share a tab", () => {
    const openedByTasks = reduceHarthmereHudStateForActionV97(
      { panel: undefined, systemsTab: undefined, focusAction: undefined },
      "tasks",
    );
    assert.deepStrictEqual(openedByTasks, {
      panel: undefined,
      systemsTab: "journal",
      focusAction: "tasks",
    });

    const retargetedToNotifications = reduceHarthmereHudStateForActionV97(
      openedByTasks,
      "notifications",
    );
    assert.deepStrictEqual(retargetedToNotifications, {
      panel: undefined,
      systemsTab: "journal",
      focusAction: "notifications",
    });

    const closedByRepeatingNotifications = reduceHarthmereHudStateForActionV97(
      retargetedToNotifications,
      "notifications",
    );
    assert.deepStrictEqual(closedByRepeatingNotifications, {
      panel: undefined,
      systemsTab: undefined,
      focusAction: undefined,
    });
  });
});
