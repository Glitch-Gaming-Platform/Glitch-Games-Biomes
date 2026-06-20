import assert from "assert";
import {
  HARTHMERE_WANTED_BOARD_OPEN_EVENT,
  performHarthmereObjectInteraction,
} from "./harthmereObjectInteractions";

describe("harthmere object interactions wanted board dispatch", () => {
  it("dispatches the wanted-board open event for F interactions", () => {
    const originalWindow = (globalThis as any).window;
    const originalFetch = (globalThis as any).fetch;
    const windowTarget = new EventTarget() as EventTarget & {
      CustomEvent?: typeof CustomEvent;
    };
    (globalThis as any).window = windowTarget;
    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    });
    let detail: any;
    windowTarget.addEventListener(HARTHMERE_WANTED_BOARD_OPEN_EVENT, (event) => {
      detail = (event as CustomEvent).detail;
    });

    try {
      performHarthmereObjectInteraction({
        label: "Farming Wanted Board",
        entityId: "wanted_board_entity",
        interaction: {
          kind: "open_wanted_board",
          title: "Open Wanted Board",
          toastVerb: "Opened",
        },
        resources: {} as any,
        gardenHose: { publish: () => {} },
      });
    } finally {
      (globalThis as any).window = originalWindow;
      (globalThis as any).fetch = originalFetch;
    }

    assert.equal(detail?.source, "harthmere_object_interaction");
    assert.equal(detail?.label, "Farming Wanted Board");
    assert.equal(detail?.entityId, "wanted_board_entity");
  });
});

