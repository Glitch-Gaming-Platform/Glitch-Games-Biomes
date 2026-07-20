/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";

process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD = "1";
import {
  HARTHMERE_DIALOGUE_LIVE_MODE_RESPONSE_EVENT,
  harthmereDialogueLiveModeHeaders,
  harthmereDialogueLiveModeMutationsForChoice,
  harthmereDialogueLiveModeUrl,
  submitHarthmereDialogueLiveModeChoice,
} from "@/client/components/challenges/dialogueLiveModeReputation";
import { isHarthmereNonLivingDialogueObjectLabel } from "@/client/components/challenges/dialogueObjectSemantics";
import { harthmereContainerLootForLabel } from "@/client/components/challenges/harthmereObjectContainers";
import { harthmereReadableObjectTextForLabel } from "@/client/components/challenges/harthmereObjectInteractions";
import { contextForLiveEntityHelperQuest } from "@/client/components/challenges/LocalDevLiveEntityHelperQuests";
import { BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT } from "@/client/components/biomes_ui/adapters/playerStatusAdapter";
import { getLiveEntityHelperQuestForEntity } from "@/shared/harthmere/live_entity_helper_quests";
import { GROVE_ECONOMY_STARTER_LANDMARKS } from "@/shared/harthmere/grove_economy_starter";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_NPCS,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  harthmereObjectInteractionForLabel,
  isHarthmereContainerObjectLabel,
  isHarthmereNonLivingObjectLabel,
} from "@/shared/harthmere/object_interaction_semantics";
import type { BiomesId } from "@/shared/ids";

describe("live-entity helper dialog context", () => {
  it("treats default-dialog live entities as helper eligible without NPC metadata", () => {
    const entityId = 232_054_506 as BiomesId;

    const context = contextForLiveEntityHelperQuest({
      entityId,
      label: "Frogberry",
      position: [232, 54, -506],
      defaultDialog: "BEEP BOOP BEEP",
    });

    assert.equal(context.hasTalkableDialog, true);
    assert.ok(getLiveEntityHelperQuestForEntity(context));
  });

  it("keeps containers and road objects out of NPC dialogue", () => {
    const objectLabels = [
      {
        label: "Clothing Crate",
        entityDescription: "Quest container with starter clothes.",
      },
      {
        label: "Billy's Toolbag",
        entityDescription: "A searched bag with road tools.",
      },
      {
        label: "Chest The Grove Underwater Main",
        entityDescription: "An underwater chest with supplies.",
      },
      {
        label: "Old Grove Road Post",
        entityDescription: "A marked route object.",
      },
    ];

    for (const objectLabel of objectLabels) {
      assert.equal(isHarthmereNonLivingDialogueObjectLabel(objectLabel), true);
      assert.equal(
        getLiveEntityHelperQuestForEntity(
          contextForLiveEntityHelperQuest({
            entityId: 9001 as BiomesId,
            label: objectLabel.label,
            position: [100, 54, 100],
            defaultDialog: "Legacy object dialogue must not create a quest.",
          })
        ),
        undefined
      );
    }

    assert.equal(
      isHarthmereNonLivingDialogueObjectLabel({
        label: "Billy Rhodes",
        entityDescription: "Runner, errand scout, and missing road-hand.",
      }),
      false
    );
    // Billy Rhodes is a living NPC (not a non-living object), but he already
    // owns authored quest content — every seeded Grove/Harthmere NPC carries an
    // ECS quest_giver component. A quest giver must NOT also hand out a generic
    // helper quest, regardless of where he wanders.
    assert.equal(
      getLiveEntityHelperQuestForEntity(
        contextForLiveEntityHelperQuest({
          entityId: 9002 as BiomesId,
          label: "Billy Rhodes",
          position: [100, 54, 100],
          defaultDialog: "I'm Billy. I run parcels and messages.",
          questGiver: { concurrent_quests: 1 },
        })
      ),
      undefined
    );
    // The SAME living entity without authored quest content (no quest_giver) is
    // an anonymous wilds local and stays eligible for a helper quest.
    assert.ok(
      getLiveEntityHelperQuestForEntity(
        contextForLiveEntityHelperQuest({
          entityId: 9002 as BiomesId,
          label: "Wandering Stranger",
          position: [100, 54, 100],
          defaultDialog: "I'm just passing through.",
        })
      )
    );
    assert.equal(
      isHarthmereNonLivingDialogueObjectLabel({
        label: "Mucked Robot",
        entityDescription: "A living service robot with dialogue.",
      }),
      false
    );
  });

  it("keeps Harthmere containers loot-routable through real inventory item ids", () => {
    assert.deepEqual(harthmereContainerLootForLabel("Billy's Toolbag"), [
      { itemId: "woodcutters_axe", quantity: 1 },
      { itemId: "rough_stone", quantity: 3 },
      { itemId: "scrap_metal", quantity: 2 },
    ]);
    assert.deepEqual(
      harthmereContainerLootForLabel("Chest The Grove Underwater Main"),
      [
        { itemId: "clean_water", quantity: 3 },
        { itemId: "river_trout", quantity: 2 },
      ]
    );
    // The Road Ahead "Gear Up" step requires equipping BOTH clothing slots
    // (a top in the chest slot AND bottoms in the legs slot), so the Clothing
    // Crate must contain both halves. baker_apron => chest, field_trousers =>
    // legs. See hasRequiredClothing in LocalDevSnapshotMissionBridge.
    assert.deepEqual(harthmereContainerLootForLabel("Clothing Crate"), [
      { itemId: "baker_apron", quantity: 1 },
      { itemId: "field_trousers", quantity: 1 },
      { itemId: "cloth_scrap", quantity: 4 },
    ]);
  });

  it("classifies every authored Grove world-object landmark as non-living", () => {
    const livingLabels = new Set(
      SNAPSHOT_GROVE_NPCS.map((npc) => npc.displayName)
    );
    const nonObjectLabels = new Set([
      "The Grove",
      "Road to Harthmere",
      "Harthmere Bridge Center",
    ]);
    const worldObjectLabels = SNAPSHOT_GROVE_LANDMARKS.filter(
      (landmark) =>
        landmark.kind !== "npc" &&
        landmark.kind !== "danger" &&
        !livingLabels.has(landmark.label) &&
        !nonObjectLabels.has(landmark.label)
    ).map((landmark) => landmark.label);

    assert.ok(worldObjectLabels.length > 30);
    for (const label of worldObjectLabels) {
      assert.equal(
        isHarthmereNonLivingObjectLabel({ label }),
        true,
        `${label} should be a non-living world object`
      );
      assert.equal(
        getLiveEntityHelperQuestForEntity(
          contextForLiveEntityHelperQuest({
            entityId: 9100 as BiomesId,
            label,
            position: [100, 54, 100],
            defaultDialog: "Object labels must not create helper quests.",
          })
        ),
        undefined,
        `${label} should not create a helper quest`
      );
    }
  });

  it("classifies authored storage-like landmarks as containers", () => {
    for (const label of [
      "Road Kit Crate",
      "Mail and Bank Satchel",
      "Practice Guild Bank Crate",
      "Old Supply Box",
      "Fountain Food Satchel",
      "First-Aid Bin",
      "Rin's Forage Basket",
      "Kit's Mailbag Stand",
    ]) {
      assert.equal(
        isHarthmereContainerObjectLabel({ label }),
        true,
        `${label} should open through the container path`
      );
    }
  });

  it("maps every authored Grove world object to its intended F-key action", () => {
    const livingLabels = new Set(
      SNAPSHOT_GROVE_NPCS.map((npc) => npc.displayName)
    );
    const nonObjectLabels = new Set([
      "The Grove",
      "Road to Harthmere",
      "Harthmere Bridge Center",
    ]);
    const labels = [
      ...SNAPSHOT_GROVE_LANDMARKS,
      ...GROVE_ECONOMY_STARTER_LANDMARKS,
    ]
      .filter(
        (landmark) =>
          landmark.kind !== "npc" &&
          landmark.kind !== "danger" &&
          !livingLabels.has(landmark.label) &&
          !nonObjectLabels.has(landmark.label)
      )
      .map((landmark) => landmark.label);
    const uniqueLabels = [...new Set(labels)].sort();
    const expected: Record<string, [string, string]> = {
      "Berry Patch": ["gather", "Gather"],
      "Billy's Drop Post": ["read", "Read"],
      "Billy's Toolbag": ["open_container", "Open Container"],
      "Broken Safe-Zone Fence": ["repair", "Repair"],
      "Building Practice Spot": ["practice", "Practice"],
      "Carlo's Cookpot": ["cook", "Cook"],
      "Charter Trade Desk": ["use", "Use Desk"],
      "Chat Practice Board": ["read", "Read"],
      "Compass Practice Ring": ["practice", "Practice"],
      "Consent Sparring Ring": ["practice", "Practice"],
      "Crossroads Service Tower": ["inspect", "Inspect"],
      "Doc's Field Table": ["use", "Use Table"],
      "Fern's Sprout Beds": ["tend", "Tend"],
      "First-Aid Bin": ["open_container", "Open Container"],
      "Fountain Dim Corner": ["inspect", "Inspect"],
      "Fountain Food Satchel": ["open_container", "Open Container"],
      "Fountain Lesson Board": ["read", "Read"],
      "Fountain Repair Post": ["repair", "Repair"],
      "Fountain Workbench": ["craft", "Craft"],
      "Garden Edge Berries": ["gather", "Gather"],
      "Grove Garden Gate": ["open_gate", "Open Gate"],
      "Grove Guild Charter Board": ["read", "Read"],
      "Grove Practice Claim Stakes": ["practice", "Practice"],
      "Grove Storehouse Door": ["open_door", "Open Door"],
      "Grove Supply Chest": ["open_container", "Open Container"],
      "Grove Wishing Well": ["inspect", "Inspect"],
      "Guild Project Table": ["use", "Use Table"],
      "Gus's Oven": ["cook", "Cook"],
      "Harthmere Chapel Stone": ["inspect", "Inspect"],
      "Harthmere Market Office": ["inspect", "Inspect"],
      "Harthmere Town Jobs Board": ["open_jobs_board", "Open Jobs Board"],
      "Jobs Board": ["open_jobs_board", "Open Jobs Board"],
      "Kit's Mailbag Stand": ["open_container", "Open Container"],
      "Lost-and-Found Stone": ["recover", "Recover Items"],
      "Lovely Locks Mirror": ["check_outfit", "Check Outfit"],
      "Luis's Repair Cart": ["repair", "Repair"],
      "Mail and Bank Satchel": ["open_container", "Open Container"],
      "Marked Practice Materials": ["gather", "Gather"],
      "Mel's Workbench": ["craft", "Craft"],
      "Mosslawn Song Stones": ["inspect", "Inspect"],
      "Muckwad Patch": ["gather", "Gather"],
      "Old Grove Road Post": ["read", "Read"],
      "Old Supply Box": ["open_container", "Open Container"],
      "Painted Route Flags": ["practice", "Practice"],
      "Party Rope Marker": ["practice", "Practice"],
      "Practice Drop Stones": ["practice", "Practice"],
      "Practice Guild Bank Crate": ["open_container", "Open Container"],
      "Practice Land Ledger": ["read", "Read"],
      "Practice Scratch Post": ["repair", "Repair"],
      "Ready Check Fireflies": ["practice", "Practice"],
      "Rin's Forage Basket": ["open_container", "Open Container"],
      "Road Jump Stretch": ["practice", "Practice"],
      "Road Kit Crate": ["open_container", "Open Container"],
      "Safe-Zone Boundary Stones": ["inspect", "Inspect"],
      "Selfie Overlook": ["take_photo", "Take Photo"],
      "Shutter Cove Photo Marker": ["take_photo", "Take Photo"],
      "Softwood Practice Dummy": ["practice", "Practice"],
      "Taye's Paint Pot": ["use", "Use Pot"],
      "Warning Moss Patch": ["gather", "Gather"],
    };

    assert.deepEqual(uniqueLabels, Object.keys(expected).sort());
    for (const [label, [kind, title]] of Object.entries(expected)) {
      const action = harthmereObjectInteractionForLabel({ label });
      assert.equal(action?.kind, kind, `${label} action kind`);
      assert.equal(action?.title, title, `${label} action title`);
    }
    assert.equal(
      harthmereObjectInteractionForLabel({ label: "Town Door" })?.title,
      "Open Door"
    );
    assert.equal(
      harthmereObjectInteractionForLabel({ label: "North Gate" })?.title,
      "Open Gate"
    );
    assert.ok(harthmereReadableObjectTextForLabel("Old Grove Road Post"));
    assert.ok(harthmereReadableObjectTextForLabel("Fountain Lesson Board"));
  });
});

describe("NPC dialogue live-mode reputation bridge", () => {
  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).CustomEvent;
  });

  it("keeps Glitch install identity on dialogue reputation requests", () => {
    assert.equal(
      harthmereDialogueLiveModeUrl("?install_id=install with spaces"),
      "/api/harthmere/live_mode?install_id=install%20with%20spaces"
    );
    assert.equal(
      harthmereDialogueLiveModeHeaders("?installId=install-123")[
        "X-Glitch-Install-Id"
      ],
      "install-123"
    );
  });

  it("splits option impact into personal NPC standing and visible world HUD standing", () => {
    assert.deepEqual(
      harthmereDialogueLiveModeMutationsForChoice({
        entityId: 123,
        message: "Ask about this place",
        likeabilityDelta: 0,
      }),
      []
    );

    const positive = harthmereDialogueLiveModeMutationsForChoice({
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

    const negative = harthmereDialogueLiveModeMutationsForChoice({
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

    await submitHarthmereDialogueLiveModeChoice(
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
    assert.equal(
      new Headers(calls[0].init.headers).get("X-Glitch-Install-Id"),
      "install-abc"
    );
    assert.equal(calls[0].body.actionKind, "request_law_reputation_mutation");
    assert.equal(calls[0].body.payload.factionId, "npc:456");
    assert.equal(calls[1].body.payload.factionId, "harthmere");
    assert.ok(
      dispatched.some(
        (event) => event.type === HARTHMERE_DIALOGUE_LIVE_MODE_RESPONSE_EVENT
      )
    );
    const playerStatusEvents = dispatched.filter(
      (event) => event.type === BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT
    );
    assert.equal(playerStatusEvents.length, 1);
    assert.equal(playerStatusEvents[0].detail?.standing?.likeability, 2);
  });
});
