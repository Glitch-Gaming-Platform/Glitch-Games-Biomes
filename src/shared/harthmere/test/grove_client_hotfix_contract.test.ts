import assert from "assert";
import fs from "fs";
import path from "path";
import vm from "vm";

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<(event: any) => void>>();

  addEventListener(type: string, listener: (event: any) => void) {
    const rows = this.listeners.get(type) ?? new Set();
    rows.add(listener);
    this.listeners.set(type, rows);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: any) {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    return true;
  }
}

class FakeStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class FakeElement extends FakeEventTarget {
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly roles = new Map<string, FakeElement>();
  textContent = "";
  disabled = false;
  private parent?: FakeElement;

  set innerHTML(_value: string) {
    for (const role of ["eyebrow", "title", "objective", "action"]) {
      this.roles.set(role, new FakeElement());
    }
  }

  querySelector(selector: string): FakeElement | undefined {
    const role = /\[data-role='([^']+)'\]/.exec(selector)?.[1];
    if (role) return this.roles.get(role);
    if (selector.includes("data-harthmere-grove-contextual-hotfix")) {
      return this.children.find(
        (child) => child.dataset.harthmereGroveContextualHotfix === "true"
      );
    }
    if (
      selector.includes(
        "data-harthmere-grove-completion-acknowledgement-hotfix"
      )
    ) {
      return this.children.find(
        (child) =>
          child.dataset.harthmereGroveCompletionAcknowledgementHotfix ===
          "true"
      );
    }
    if (selector.includes("data-harthmere-grove-world-object-hotfix")) {
      return this.children.find(
        (child) => child.dataset.harthmereGroveWorldObjectHotfix === "true"
      );
    }
    return undefined;
  }

  prepend(child: FakeElement) {
    child.parent = this;
    this.children.unshift(child);
  }

  append(child: FakeElement) {
    child.parent = this;
    this.children.push(child);
  }

  setAttribute(_name: string, _value: string) {}

  remove() {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = undefined;
  }
}

class FakeCustomEvent {
  constructor(
    readonly type: string,
    readonly init: { detail?: unknown } = {}
  ) {}

  get detail() {
    return this.init.detail;
  }
}

describe("Grove client hotfix contract", () => {
  it("survives pre-DOM bootstrap, restores exact pins, and mounts the contextual action", () => {
    const root = path.resolve(__dirname, "../../../..");
    const source = fs.readFileSync(
      path.join(
        root,
        "scripts/harthmere/grove-quest-client-hotfix-2026-08-07.js"
      ),
      "utf8"
    );
    assert.match(source, /Start Read the Jobs Board/);
    assert.match(source, /request_quest_state_update/);
    assert.match(source, /snapshotGroveTutorTarget/);
    assert.match(source, /grove_festival_skewer_ingredients/);
    assert.match(source, /refreshTalkNpcBridge/);
    assert.match(source, /refreshDocSampleWorldObjects/);
    assert.match(source, /harthmereQuestObjectMarkerId/);
    assert.match(source, /refreshWorldObjectPrompt/);
    assert.match(source, /worldInteractionCandidateId/);
    assert.match(source, /snapshot_grove_practice_action/);
    assert.match(source, /sourceTutorPromptSelector/);
    assert.match(source, /request_care_loop_action/);
    assert.match(source, /world_object_interaction/);
    assert.match(source, /hotfix_progress_repair/);
    assert.match(source, /hotfix_completion_repair/);
    assert.match(source, /harthmereGroveCompletionAcknowledgementHotfix/);
    assert.match(source, /job\.status = "ready"/);
    assert.match(source, /job\.progress = 1/);
    assert.match(source, /chapter1OwnsModal \|\| chapter1SupplierActive/);
    const localStorage = new FakeStorage();
    localStorage.setItem(
      "biomes.localDev.snapshotGroveQuestState",
      JSON.stringify({
        acceptedQuestIds: ["painted_path_language"],
        activeQuestId: "painted_path_language",
        activeObjectiveIndex: 4,
        objectiveIndexByQuestId: { painted_path_language: 4 },
        completedQuestIds: [],
      })
    );
    localStorage.setItem(
      "biomes_ui_active_map_pin",
      JSON.stringify({
        markerId: "native_quest:6193612340426932:6193612340426932",
        label: "Talk to Jackie",
      })
    );

    const mapPanel = new FakeElement();
    const document = {
      readyState: "loading",
      documentElement: null as object | null,
      createElement: () => new FakeElement(),
      querySelector: (selector: string) => {
        if (selector === "section[aria-label='Map panels']") return mapPanel;
        if (selector.includes("data-harthmere-grove-contextual-hotfix")) {
          return mapPanel.querySelector(selector);
        }
        return undefined;
      },
    };
    const published: unknown[] = [];
    let cleanup: (() => void) | undefined;
    const window = Object.assign(new FakeEventTarget(), {
      localStorage,
      __snapshotGrove: {
        quests: [
          {
            id: "painted_path_language",
            title: "Paint Knows Where Eyes Go",
            objectives: ["one", "two", "three", "four", "Choose the color"],
            triggers: ["talk_npc", "interact", "near_location", "open_tab", "choice"],
            markerIds: [
              "npc_taye",
              "paint_pot",
              "grove_painted_route_flags",
              "grove_hud_compass_ring",
              "grove_painted_route_flags",
            ],
          },
        ],
        landmarks: [
          {
            id: "grove_painted_route_flags",
            label: "Painted Route Flags",
            kind: "interactable",
            area: "the_grove",
            position: [501, 71, -131],
          },
        ],
      },
      __biomesGlitchMutableHotfix: {
        registerCleanup(fn: () => void) {
          cleanup = fn;
        },
      },
      clientContext: {
        resources: {
          get: () => ({ player: { position: [501, 71, -131] } }),
        },
        gardenHose: { publish: (event: unknown) => published.push(event) },
      },
      setTimeout(fn: () => void) {
        fn();
        return 1;
      },
      setInterval() {
        return 2;
      },
      clearInterval() {},
    });
    class FakeMutationObserver {
      observe(target: object | null) {
        assert.ok(target, "MutationObserver must not receive a null root");
      }
      disconnect() {}
    }

    vm.runInNewContext(source, {
      window,
      document,
      localStorage,
      Storage: FakeStorage,
      EventTarget: FakeEventTarget,
      CustomEvent: FakeCustomEvent,
      MutationObserver: FakeMutationObserver,
    });

    assert.match(
      String((window as any).__harthmereGroveExactMapPinHotfixVersion),
      /guidance-hotfix/
    );
    assert.equal(
      JSON.parse(localStorage.getItem("biomes_ui_active_map_pin")!).markerId,
      "grove_painted_route_flags"
    );
    localStorage.setItem(
      "biomes_ui_active_map_pin",
      JSON.stringify({ markerId: "native_quest:1:1", label: "Wrong" })
    );
    assert.equal(
      JSON.parse(localStorage.getItem("biomes_ui_active_map_pin")!).markerId,
      "grove_painted_route_flags"
    );
    localStorage.removeItem("biomes_ui_active_map_pin");
    assert.equal(
      JSON.parse(localStorage.getItem("biomes_ui_active_map_pin")!).markerId,
      "grove_painted_route_flags"
    );

    document.documentElement = {};
    document.readyState = "interactive";
    window.dispatchEvent({ type: "DOMContentLoaded" });
    const card = mapPanel.querySelector(
      "[data-harthmere-grove-contextual-hotfix='true']"
    );
    assert.ok(card, "contextual Grove card should mount above the native quest");
    const action = card.querySelector("[data-role='action']");
    assert.equal(action?.textContent, "Pick practice answer");
    action?.dispatchEvent({ type: "click" });
    assert.deepEqual(published, [
      {
        kind: "snapshot_grove_practice_action",
        questId: "painted_path_language",
        objectiveIndex: 4,
        trigger: "choice",
        markerId: "grove_painted_route_flags",
      },
    ]);

    assert.ok(cleanup, "hotfix should register cleanup");
    cleanup?.();
    localStorage.removeItem("biomes_ui_active_map_pin");
    assert.equal(localStorage.getItem("biomes_ui_active_map_pin"), null);
  });

  for (const testCase of [
    {
      questId: "sticky_medicine",
      objectiveIndex: 0,
      trigger: "collect",
      markerId: "doc_clean_root_sample",
      markerLabel: "Clean Root Sample",
      exactEventKind: undefined,
    },
    {
      questId: "lost_found_and_mail",
      objectiveIndex: 3,
      trigger: "item_grant",
      markerId: "grove_recovery_stone",
      markerLabel: "Lost-and-Found Stone",
      exactEventKind: "inventory_change",
    },
    {
      questId: "samples_for_the_chapel",
      objectiveIndex: 2,
      trigger: "interact",
      markerId: "harthmere_chapel_stone",
      markerLabel: "Chapel Listening Stone",
      exactEventKind: "inspect_frame",
    },
  ] as const) {
    it(`intercepts an exact native F prompt and emits signed ${testCase.trigger} evidence`, async () => {
      const root = path.resolve(__dirname, "../../../..");
      const source = fs.readFileSync(
        path.join(
          root,
          "scripts/harthmere/grove-quest-client-hotfix-2026-08-07.js"
        ),
        "utf8"
      );
      const localStorage = new FakeStorage();
      localStorage.setItem(
        "biomes.localDev.snapshotGroveQuestState",
        JSON.stringify({
          acceptedQuestIds: [testCase.questId],
          activeQuestId: testCase.questId,
          activeObjectiveIndex: testCase.objectiveIndex,
          objectiveIndexByQuestId: {
            [testCase.questId]: testCase.objectiveIndex,
          },
          completedQuestIds: [],
        })
      );
      const published: any[] = [];
      const worldEvents: any[] = [];
      const fetchBodies: any[] = [];
      const markerPosition = [500, 71, -150];
      const fetchImpl = async (input: any, init?: RequestInit) => {
        const url = String(input?.url ?? input ?? "");
        if (init?.body) fetchBodies.push(JSON.parse(String(init.body)));
        if (url.includes("live_mode_quest_state")) {
          return new Response(
            JSON.stringify({
              questState: {
                active: {
                  [testCase.questId]: {
                    progress: testCase.objectiveIndex + 1,
                  },
                },
                completed: {},
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            ok: true,
            backendMutation: { warnings: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };
      const document = {
        readyState: "interactive",
        documentElement: {},
        body: new FakeElement(),
        head: new FakeElement(),
        createElement: () => new FakeElement(),
        querySelector: () => undefined,
        getElementById: () => undefined,
      };
      let cleanup: (() => void) | undefined;
      const window = Object.assign(new FakeEventTarget(), {
        localStorage,
        fetch: fetchImpl,
        __snapshotGrove: {
          quests: [
            {
              id: testCase.questId,
              title: "Audit Quest",
              giverNpcId: "doc",
              objectives: Array.from(
                { length: Math.max(4, testCase.objectiveIndex + 2) },
                (_, index) =>
                  index === testCase.objectiveIndex
                    ? "Use the exact object"
                    : `Objective ${index + 1}`
              ),
              triggers: Array.from(
                { length: Math.max(4, testCase.objectiveIndex + 2) },
                (_, index) =>
                  index === testCase.objectiveIndex
                    ? testCase.trigger
                    : "talk_npc"
              ),
              markerIds: Array.from(
                { length: Math.max(4, testCase.objectiveIndex + 2) },
                (_, index) =>
                  index === testCase.objectiveIndex
                    ? testCase.markerId
                    : "npc_doc"
              ),
              reward: "Audit reward",
            },
          ],
          landmarks: [
            {
              id: testCase.markerId,
              label: testCase.markerLabel,
              kind: "interactable",
              area: "the_grove",
              position: markerPosition,
            },
          ],
          dumpGrounding: () => [],
        },
        __biomesGlitchMutableHotfix: {
          registerCleanup(fn: () => void) {
            cleanup = fn;
          },
        },
        clientContext: {
          resources: {
            get: (key: string) => {
              if (key === "/scene/local_player") {
                return { player: { position: markerPosition } };
              }
              if (key === "/overlays") {
                return {
                  get: () => ({
                    objectId: testCase.markerId,
                    label: testCase.markerLabel,
                  }),
                };
              }
              return undefined;
            },
          },
          gardenHose: { publish: (event: unknown) => published.push(event) },
        },
        setTimeout(fn: () => void) {
          fn();
          return 1;
        },
        setInterval() {
          return 2;
        },
        clearInterval() {},
      });
      window.addEventListener(
        "biomes:harthmere-world-object-interaction",
        (event: any) => worldEvents.push(event.detail)
      );
      class FakeMutationObserver {
        observe() {}
        disconnect() {}
      }

      vm.runInNewContext(source, {
        window,
        document,
        localStorage,
        Storage: FakeStorage,
        EventTarget: FakeEventTarget,
        CustomEvent: FakeCustomEvent,
        MutationObserver: FakeMutationObserver,
        Response,
        Event,
        fetch: fetchImpl,
        Date,
        Math,
      });

      let prevented = false;
      let stoppedImmediately = false;
      window.dispatchEvent({
        type: "keydown",
        code: "KeyF",
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation() {},
        stopImmediatePropagation: () => {
          stoppedImmediately = true;
        },
      });
      for (let index = 0; index < 8; index += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      assert.equal(prevented, true);
      assert.equal(stoppedImmediately, true);
      assert.ok(
        fetchBodies.some(
          (body) =>
            body.actionKind === "request_care_loop_action" &&
            body.payload?.operation === "world_object_interaction" &&
            body.payload?.objectId === testCase.markerId
        ),
        "the exact F action must cross the signed world-object authority"
      );
      assert.deepEqual(worldEvents, [
        {
          objectId: testCase.markerId,
          label: testCase.markerLabel,
          kind:
            testCase.trigger === "interact" ? "inspect" : "gather",
          title:
            testCase.trigger === "interact" ? "Inspect" : "Gather",
          serverAuthoritativePickup: testCase.trigger !== "interact",
        },
      ]);
      if (testCase.exactEventKind) {
        assert.ok(
          published.some(
            (event) =>
              event.kind === testCase.exactEventKind &&
              event.questId === testCase.questId &&
              event.objectiveIndex === testCase.objectiveIndex &&
              event.trigger === testCase.trigger &&
              event.markerId === testCase.markerId
          ),
          `missing exact ${testCase.exactEventKind} lesson event`
        );
      }
      assert.ok(
        published.some(
          (event) =>
            event.kind === "snapshot_grove_practice_action" &&
            event.questId === testCase.questId &&
            event.markerId === testCase.markerId
        ),
        "native Grove challenge evidence must follow the signed receipt"
      );
      cleanup?.();
    });
  }

  it("repairs a stale Cloud Save cursor one authored objective at a time", async () => {
    const root = path.resolve(__dirname, "../../../..");
    const source = fs.readFileSync(
      path.join(
        root,
        "scripts/harthmere/grove-quest-client-hotfix-2026-08-07.js"
      ),
      "utf8"
    );
    const questId = "lost_found_and_mail";
    const triggers = [
      "talk_npc",
      "open_tab",
      "interact",
      "item_grant",
      "inventory_change",
      "talk_npc",
    ];
    const localStorage = new FakeStorage();
    localStorage.setItem(
      "biomes.localDev.snapshotGroveQuestState",
      JSON.stringify({
        acceptedQuestIds: [questId],
        activeQuestId: questId,
        activeObjectiveIndex: 3,
        objectiveIndexByQuestId: { [questId]: 3 },
        completedQuestIds: [],
      })
    );
    let liveProgress = 1;
    const progressPayloads: any[] = [];
    const fetchImpl = async (input: any, init?: RequestInit) => {
      const url = String(input?.url ?? input ?? "");
      if (url.includes("live_mode_quest_state")) {
        return new Response(
          JSON.stringify({
            questState: {
              active: { [questId]: { progress: liveProgress } },
              completed: {},
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.actionKind === "request_quest_state_update") {
        progressPayloads.push(body.payload);
        liveProgress = Number(body.payload.progress);
      }
      return new Response(
        JSON.stringify({
          ok: true,
          backendMutation: { warnings: [] },
          questState: {
            active: { [questId]: { progress: liveProgress } },
            completed: {},
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };
    const body = new FakeElement();
    const document = {
      readyState: "interactive",
      documentElement: {},
      body,
      head: new FakeElement(),
      createElement: () => new FakeElement(),
      querySelector: (selector: string) => body.querySelector(selector),
      getElementById: () => undefined,
    };
    let cleanup: (() => void) | undefined;
    const window = Object.assign(new FakeEventTarget(), {
      localStorage,
      fetch: fetchImpl,
      __snapshotGrove: {
        quests: [
          {
            id: questId,
            title: "Nothing Useful Stays Lost",
            giverNpcId: "rosalyn",
            objectives: triggers.map((_, index) => `Objective ${index + 1}`),
            triggers,
            markerIds: triggers.map((_, index) => `marker_${index}`),
            reward: "Reward",
          },
        ],
        landmarks: triggers.map((_, index) => ({
          id: `marker_${index}`,
          label: `Marker ${index}`,
          kind: "interactable",
          area: "the_grove",
          position: [500 + index, 71, -150],
        })),
        dumpGrounding: () => [],
      },
      __biomesGlitchMutableHotfix: {
        registerCleanup(fn: () => void) {
          cleanup = fn;
        },
      },
      clientContext: {
        resources: { get: () => undefined },
        gardenHose: { publish() {} },
      },
      setTimeout(fn: () => void) {
        fn();
        return 1;
      },
      setInterval() {
        return 2;
      },
      clearInterval() {},
    });
    class FakeMutationObserver {
      observe() {}
      disconnect() {}
    }
    vm.runInNewContext(source, {
      window,
      document,
      localStorage,
      Storage: FakeStorage,
      EventTarget: FakeEventTarget,
      CustomEvent: FakeCustomEvent,
      MutationObserver: FakeMutationObserver,
      Response,
      Event,
      fetch: fetchImpl,
      Date,
      Math,
    });
    for (let index = 0; index < 16; index += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.deepEqual(
      progressPayloads.map((payload) => ({
        progress: payload.progress,
        objectiveIndex: payload.objectiveIndex,
        evidenceTrigger: payload.evidenceTrigger,
        reason: payload.reason,
      })),
      [
        {
          progress: 2,
          objectiveIndex: 0,
          evidenceTrigger: "talk_npc",
          reason: "hotfix_progress_repair",
        },
        {
          progress: 3,
          objectiveIndex: 1,
          evidenceTrigger: "open_tab",
          reason: "hotfix_progress_repair",
        },
        {
          progress: 4,
          objectiveIndex: 2,
          evidenceTrigger: "interact",
          reason: "hotfix_progress_repair",
        },
      ]
    );
    cleanup?.();
  });

  it("keeps Chapter 1 text in control, then restores the exact Grove completion acknowledgement", () => {
    const root = path.resolve(__dirname, "../../../..");
    const source = fs.readFileSync(
      path.join(
        root,
        "scripts/harthmere/grove-quest-client-hotfix-2026-08-07.js"
      ),
      "utf8"
    );
    const questId = "econ_kit_heavy_parcel_to_crossroads";
    const npcEntityId = 8810000000019322;
    const localStorage = new FakeStorage();
    localStorage.setItem(
      "biomes.localDev.snapshotGroveQuestState",
      JSON.stringify({
        acceptedQuestIds: [questId],
        activeQuestId: "",
        completedQuestIds: [questId],
      })
    );
    const body = new FakeElement();
    const document = {
      readyState: "interactive",
      documentElement: {},
      body,
      head: new FakeElement(),
      createElement: () => new FakeElement(),
      querySelector: (selector: string) => body.querySelector(selector),
      getElementById: () => undefined,
    };
    let cleanup: (() => void) | undefined;
    const window = Object.assign(new FakeEventTarget(), {
      localStorage,
      fetch: async () =>
        new Response(JSON.stringify({ questState: { active: {}, completed: {} } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      __chapter1ObjectiveWorldProjection: {
        targetEntityId: npcEntityId,
        trigger: "talk_npc",
      },
      __snapshotGrove: {
        quests: [
          {
            id: questId,
            title: "Kit's Heavy Parcel to the Crossroads",
            giverNpcId: "kit_the_courier",
            objectives: ["Start", "Return"],
            triggers: ["item_grant", "talk_npc"],
            markerIds: ["econ_kit_mailbag", "npc_kit_the_courier"],
            reward: "45 XP and courier wages.",
          },
        ],
        landmarks: [],
        dumpGrounding: () => [
          { id: "kit_the_courier", seededEntityId: npcEntityId },
        ],
      },
      __biomesGlitchMutableHotfix: {
        registerCleanup(fn: () => void) {
          cleanup = fn;
        },
      },
      clientContext: {
        resources: {
          get: (key: string) =>
            key === "/game_modal"
              ? { kind: "talk_to_npc", talkingToNPCId: npcEntityId }
              : undefined,
        },
        gardenHose: { publish() {} },
      },
      setTimeout(fn: () => void) {
        fn();
        return 1;
      },
      setInterval() {
        return 2;
      },
      clearInterval() {},
    });
    class FakeMutationObserver {
      observe() {}
      disconnect() {}
    }
    vm.runInNewContext(source, {
      window,
      document,
      localStorage,
      Storage: FakeStorage,
      EventTarget: FakeEventTarget,
      CustomEvent: FakeCustomEvent,
      MutationObserver: FakeMutationObserver,
      Response,
      Event,
      Date,
      Math,
    });
    assert.equal(
      body.querySelector(
        "[data-harthmere-grove-completion-acknowledgement-hotfix='true']"
      ),
      undefined,
      "Chapter 1 must retain the visible dialogue while it owns Kit"
    );
    (window as any).__chapter1ObjectiveWorldProjection = undefined;
    window.dispatchEvent({
      type: "biomes:local-dev-snapshot-grove-quest-state",
    });
    const panel = body.querySelector(
      "[data-harthmere-grove-completion-acknowledgement-hotfix='true']"
    );
    assert.ok(panel, "normal Grove completion text must return after Chapter 1");
    assert.equal(
      panel?.children[0]?.textContent,
      "Kit's Heavy Parcel to the Crossroads is handled."
    );
    cleanup?.();
  });

  it("promotes an elapsed retained-build cooking job to Ready during polling", async () => {
    const root = path.resolve(__dirname, "../../../..");
    const source = fs.readFileSync(
      path.join(
        root,
        "scripts/harthmere/grove-quest-client-hotfix-2026-08-07.js"
      ),
      "utf8"
    );
    const localStorage = new FakeStorage();
    localStorage.setItem(
      "biomes.localDev.snapshotGroveQuestState",
      JSON.stringify({ acceptedQuestIds: [], completedQuestIds: [] })
    );
    const originalUpdatedAtMs = Date.now() - 30_000;
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          farmingFoodState: {
            updatedAtMs: originalUpdatedAtMs,
            inventory: {},
            cookingStations: [
              {
                stationId: "label:carlo_s_campfire",
                jobs: [
                  {
                    jobId: "skewer",
                    status: "cooking",
                    progress: 0.5,
                    readyAtMs: Date.now() - 1_000,
                  },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    const document = {
      readyState: "interactive",
      documentElement: {},
      body: new FakeElement(),
      head: new FakeElement(),
      createElement: () => new FakeElement(),
      querySelector: () => undefined,
      getElementById: () => undefined,
    };
    let cleanup: (() => void) | undefined;
    const window = Object.assign(new FakeEventTarget(), {
      localStorage,
      fetch: fetchImpl,
      __snapshotGrove: { quests: [], landmarks: [], dumpGrounding: () => [] },
      __biomesGlitchMutableHotfix: {
        registerCleanup(fn: () => void) {
          cleanup = fn;
        },
      },
      clientContext: { resources: { get: () => undefined } },
      setTimeout(fn: () => void) {
        fn();
        return 1;
      },
      setInterval() {
        return 2;
      },
      clearInterval() {},
    });
    class FakeMutationObserver {
      observe() {}
      disconnect() {}
    }
    vm.runInNewContext(source, {
      window,
      document,
      localStorage,
      Storage: FakeStorage,
      EventTarget: FakeEventTarget,
      CustomEvent: FakeCustomEvent,
      MutationObserver: FakeMutationObserver,
      Response,
      Event,
      Date,
      Math,
    });
    const response = await (window as any).fetch(
      "/api/harthmere/live_mode_farming_food_state"
    );
    const state = (await response.json()).farmingFoodState;
    assert.equal(state.cookingStations[0].jobs[0].status, "ready");
    assert.equal(state.cookingStations[0].jobs[0].progress, 1);
    assert.ok(state.updatedAtMs > originalUpdatedAtMs);
    cleanup?.();
  });
});
