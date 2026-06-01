/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  HARTHMERE_DIALOGUE_LIVE_MODE_RESPONSE_EVENT_V1,
  harthmereDialogueLiveModeHeadersV1,
  harthmereDialogueLiveModeMutationsForChoiceV1,
  harthmereDialogueLiveModeUrlV1,
  submitHarthmereDialogueLiveModeChoiceV1,
} from "@/client/components/challenges/dialogueLiveModeReputation";
import { contextForLiveEntityHelperQuestV1 } from "@/client/components/challenges/LocalDevLiveEntityHelperQuests";
import { BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT } from "@/client/components/biomes_ui/adapters/playerStatusAdapter";
import { getLiveEntityHelperQuestForEntityV1 } from "@/shared/harthmere/live_entity_helper_quests_v1";
import type { BiomesId } from "@/shared/ids";

describe("live-entity helper dialog context", () => {
  it("treats default-dialog live entities as helper eligible without NPC metadata", () => {
    const entityId = 232_054_506 as BiomesId;

    const context = contextForLiveEntityHelperQuestV1({
      entityId,
      label: "Frogberry",
      position: [232, 54, -506],
      defaultDialog: "BEEP BOOP BEEP",
    });

    assert.equal(context.hasTalkableDialog, true);
    assert.ok(getLiveEntityHelperQuestForEntityV1(context));
  });
});

describe("NPC dialogue live-mode reputation bridge", () => {
  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).CustomEvent;
  });

  it("keeps Glitch install identity on dialogue reputation requests", () => {
    assert.equal(
      harthmereDialogueLiveModeUrlV1("?install_id=install with spaces"),
      "/api/harthmere/live_mode?install_id=install%20with%20spaces"
    );
    assert.equal(
      harthmereDialogueLiveModeHeadersV1("?installId=install-123")[
        "X-Glitch-Install-Id"
      ],
      "install-123"
    );
  });

  it("splits option impact into personal NPC standing and visible world HUD standing", () => {
    assert.deepEqual(
      harthmereDialogueLiveModeMutationsForChoiceV1({
        entityId: 123,
        message: "Ask about this place",
        likeabilityDelta: 0,
      }),
      []
    );

    const positive = harthmereDialogueLiveModeMutationsForChoiceV1({
      entityId: 123,
      label: "Ruthe",
      message: "Compliment Ruthe's steady eye",
      likeabilityDelta: 6,
    });
    assert.equal(positive[0].factionId, "npc:123");
    assert.equal(positive[0].likeabilityDelta, 6);
    assert.equal(positive[0].witnessLevel, "direct");
    assert.equal(positive[1].factionId, "harthmere");
    assert.equal(positive[1].likeabilityDelta, 2);
    assert.equal(positive[1].legalDelta, 0);
    assert.equal(positive[1].notorietyDelta, 0);

    const negative = harthmereDialogueLiveModeMutationsForChoiceV1({
      entityId: 123,
      message: "Call Ruthe useless",
      likeabilityDelta: -8,
    });
    assert.equal(negative[1].factionId, "harthmere");
    assert.equal(negative[1].likeabilityDelta, -3);
    assert.equal(negative[1].legalDelta, -3);
    assert.equal(negative[1].notorietyDelta, 3);
  });

  it("posts both mutations and publishes player status so the HUD refreshes immediately", async () => {
    const dispatched: Array<{ type: string; detail: any }> = [];
    (globalThis as any).CustomEvent = class {
      type: string;
      detail: any;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    (globalThis as any).window = {
      location: { search: "?install_id=install-abc" },
      dispatchEvent: (event: any) => {
        dispatched.push({ type: event.type, detail: event.detail });
      },
    };

    const calls: Array<{ url: string; init: any; body: any }> = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          playerStatusState: {
            standing: { likeability: calls.length, legal: 0, notoriety: 0 },
          },
        }),
      };
    }) as any;

    await submitHarthmereDialogueLiveModeChoiceV1(
      {
        entityId: 456,
        label: "Ruthe",
        message: "Compliment Ruthe's steady eye",
        likeabilityDelta: 6,
      },
      { fetchImpl, requestIdPrefix: "test_dialogue" }
    );

    assert.equal(calls.length, 2);
    assert.equal(
      calls[0].url,
      "/api/harthmere/live_mode?install_id=install-abc"
    );
    assert.equal(calls[0].init.headers["X-Glitch-Install-Id"], "install-abc");
    assert.equal(calls[0].body.actionKind, "request_law_reputation_mutation");
    assert.equal(calls[0].body.payload.factionId, "npc:456");
    assert.equal(calls[1].body.payload.factionId, "harthmere");
    assert.ok(
      dispatched.some(
        (event) => event.type === HARTHMERE_DIALOGUE_LIVE_MODE_RESPONSE_EVENT_V1
      )
    );
    const playerStatusEvents = dispatched.filter(
      (event) => event.type === BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT
    );
    assert.equal(playerStatusEvents.length, 1);
    assert.equal(playerStatusEvents[0].detail?.standing?.likeability, 2);
  });
});
