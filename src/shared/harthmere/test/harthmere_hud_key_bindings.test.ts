import assert from "assert";

import {
  HARTHMERE_HUD_KEY_BINDINGS,
  dispatchHarthmereHudActionEvent,
  harthmereHudBindingForAction,
  harthmereHudBindingForCode,
} from "@/shared/harthmere/harthmere_hud_key_bindings";
import { reduceHarthmereHudStateForAction } from "@/shared/harthmere/harthmere_hud_state";

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

describe("harthmere_hud_key_bindings", () => {
  it("maps every configured keyboard code back to the correct action", () => {
    for (const binding of HARTHMERE_HUD_KEY_BINDINGS) {
      assert.deepStrictEqual(harthmereHudBindingForCode(binding.code), binding);
      assert.deepStrictEqual(harthmereHudBindingForAction(binding.action), binding);
    }
  });

  it("returns undefined for unknown keys", () => {
    assert.strictEqual(harthmereHudBindingForCode("KeyQ"), undefined);
  });

  it("dispatches the HUD event payload with action and binding", () => {
    withHudEventTarget(() => {
      let received: CustomEvent | undefined;
      const handler = (event: Event) => {
        received = event as CustomEvent;
      };
      window.addEventListener("biomes:harthmere-hud-action", handler);
      dispatchHarthmereHudActionEvent("tasks");
      window.removeEventListener("biomes:harthmere-hud-action", handler);

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
        reduceHarthmereHudStateForAction(
          { panel: undefined, systemsTab: undefined, focusAction: undefined },
          action,
        ),
        expected,
      );
    }
  });

  it("toggles repeated actions closed but preserves distinct actions that share a tab", () => {
    const openedByTasks = reduceHarthmereHudStateForAction(
      { panel: undefined, systemsTab: undefined, focusAction: undefined },
      "tasks",
    );
    assert.deepStrictEqual(openedByTasks, {
      panel: undefined,
      systemsTab: "journal",
      focusAction: "tasks",
    });

    const retargetedToNotifications = reduceHarthmereHudStateForAction(
      openedByTasks,
      "notifications",
    );
    assert.deepStrictEqual(retargetedToNotifications, {
      panel: undefined,
      systemsTab: "journal",
      focusAction: "notifications",
    });

    const closedByRepeatingNotifications = reduceHarthmereHudStateForAction(
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
