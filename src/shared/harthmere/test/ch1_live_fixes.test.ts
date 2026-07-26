/// <reference types="mocha" />
/// <reference types="node" />
//
// Tests for the 2026-07-25 live-session fixes:
//   1. Busted's underwater chest F-prompt (quest completability)
//   2. Cloud-save rehydration through deployments
//   3. Chapter 1 Glitch behavioral-event catalog
//
// Evidence base: the uploaded HAR (player on Busted step 4 "Recover some
// Muck Busters", quest state served from server Redis, cloud save restoring
// only to localStorage) and the in-game screenshot of the Map & Quests panel.

import assert from "assert";
import {
  isNativeBustedUnderwaterContainerLabel,
  isNativeQuestContainerLabel,
  nativeQuestGiverUsesEcsDialogue,
  NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC,
  NATIVE_ROAD_AHEAD_CONTAINER_SPECS,
} from "../native_road_ahead_contract";
import {
  selectNearestHarthmereWorldObjectInspectable,
  HARTHMERE_CONTAINER_INSPECT_MAX_VERTICAL_DISTANCE,
} from "../harthmere_world_object_inspectable";
import {
  decideHarthmereRehydration,
  harthmereSnapshotHasMeaningfulProgress,
  projectHarthmereCloudSaveToPlayerSeed,
} from "../harthmere_cloud_save_rehydration";
import {
  CH1_ANALYTICS_EVENTS,
  CH1_FUNNELS,
  ch1ValidateAnalyticsCatalog,
} from "../ch1_analytics";

// ---------------------------------------------------------------------------
// 1. The underwater chest
// ---------------------------------------------------------------------------

describe("live fix - Busted underwater chest F prompt", () => {
  it("classifies every native quest container label, Busted's included", () => {
    assert.equal(
      isNativeQuestContainerLabel("chest the grove underwater main"),
      true,
      "the sunken chest must be a recognized quest container"
    );
    assert.equal(
      isNativeQuestContainerLabel("Chest The Grove Underwater Main"),
      true,
      "label matching must be case-insensitive"
    );
    assert.equal(
      isNativeBustedUnderwaterContainerLabel("chest the grove underwater main"),
      true
    );
    for (const spec of Object.values(NATIVE_ROAD_AHEAD_CONTAINER_SPECS)) {
      for (const label of spec.labels) {
        assert.equal(
          isNativeQuestContainerLabel(label),
          true,
          `Road Ahead container "${label}" must stay covered`
        );
      }
    }
    assert.equal(isNativeQuestContainerLabel("Jackie"), false);
    assert.equal(isNativeQuestContainerLabel(""), false);
    assert.equal(isNativeQuestContainerLabel(undefined), false);
  });

  it("selects the chest from a swimming player's position", () => {
    // The actual geometry from the spec: chest at [528.5, 59, -96.5], player
    // swimming above it near the surface (~y 63). The container-specific
    // vertical allowance (8) must cover the dive approach; the ordinary 3.5
    // would not — which is why containers get their own constant.
    const chest = NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.position;
    const swimmer: [number, number, number] = [chest[0] - 2, 63, chest[2] - 2];
    const facing: [number, number, number] = [
      chest[0] - swimmer[0],
      0,
      chest[2] - swimmer[2],
    ];
    const picked = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: swimmer,
      facingView: facing,
      candidates: [
        {
          id: "ecs:4149747832010135",
          label: "chest the grove underwater main",
          position: [chest[0], chest[1], chest[2]],
        },
      ],
    });
    assert.ok(picked, "the chest must be selectable while swimming above it");
    assert.equal(picked!.isContainer, true);
    assert.equal(picked!.interaction.kind, "open_container");
    assert.ok(
      63 - chest[1] <= HARTHMERE_CONTAINER_INSPECT_MAX_VERTICAL_DISTANCE,
      "the surface-to-chest depth must sit inside the container allowance"
    );

    // Focused live-browser evidence: at the actual waterline the cursor hit
    // terrain at distance zero and swimming drift put the chest 1.05 blocks
    // behind the current yaw. The close-container exception must cover that
    // pose as well; otherwise the player receives no F prompt despite standing
    // in valid server range.
    const livePose = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [528.5, 67, -97.55260902415804],
      facingView: [0, 0, -1],
      candidates: [
        {
          id: "ecs:4149747832010135",
          label: "Chest The Grove Underwater Main",
          position: [chest[0], chest[1], chest[2]],
        },
      ],
      radius: 0,
      containerRadius: 6.5,
    });
    assert.ok(livePose, "the exact failed browser pose must expose the chest");
    assert.equal(livePose!.interaction.kind, "open_container");
  });

  it("keeps the ordinary skip for genuinely player-placed containers", () => {
    // The overlays.ts exemption is label-scoped. A random player-placed chest
    // labeled by its owner must NOT be treated as a quest container, or the
    // proximity prompt fights the richer aimed overlay everywhere.
    assert.equal(isNativeQuestContainerLabel("my house chest"), false);
    assert.equal(isNativeQuestContainerLabel("storage chest"), false);
  });

  it("does not let the snapshot quest-giver marker suppress container UI", () => {
    assert.equal(
      nativeQuestGiverUsesEcsDialogue(
        { concurrent_quests: 1 },
        "Chest The Grove Underwater Main"
      ),
      false,
      "the resolved chest inspectable must render Open Container, not Talk"
    );
  });

  it("audit: every physical quest container has prior steps and objectives", () => {
    // Completability: a container claim must always be able to tell the
    // player which earlier step is missing rather than silently refusing.
    const busted = NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC;
    assert.ok(busted.labels.length > 0);
    assert.ok(Number(busted.stepId) > 0);
    assert.ok(Number(busted.itemId) > 0);
    assert.ok(Number(busted.sourceEntityId) > 0);
    for (const [name, spec] of Object.entries(
      NATIVE_ROAD_AHEAD_CONTAINER_SPECS
    )) {
      assert.ok(spec.labels.length > 0, `${name} has no labels`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Deployment persistence
// ---------------------------------------------------------------------------

const PROGRESSED_STORAGE: Record<string, string> = {
  "biomes.localDev.harthmere.questState": JSON.stringify({
    active: { road_ready_bag_check: { stepId: "x", progress: 6 } },
    completed: { fountain_buttons_first: 1784897177426 },
  }),
  "biomes.localDev.harthmere.levelingState": JSON.stringify({
    level: 3,
    xpCurrent: 240,
  }),
  "biomes.localDev.harthmere.inventoryState": JSON.stringify({
    backpack: { items: [{ id: "muck_buster" }] },
    wallet: { gold: 9 },
  }),
};

describe("live fix - cloud save rehydration through deployments", () => {
  it("rehydrates a wiped Redis record for a logged-in player", () => {
    const decision = decideHarthmereRehydration({
      playerRecordExists: false,
      playerRecordHasProgress: false,
      isGuest: false,
      cloudSave: {
        version: 7,
        payloadVersion: "harthmere-glitch-save",
        schemaVersion: "harthmere-glitch-save-all-state",
        storage: PROGRESSED_STORAGE,
      },
    });
    assert.deepEqual(decision, { rehydrate: true, fromVersion: 7 });
  });

  it("never overwrites live progress with an old snapshot", () => {
    const decision = decideHarthmereRehydration({
      playerRecordExists: true,
      playerRecordHasProgress: true,
      isGuest: false,
      cloudSave: {
        version: 99,
        payloadVersion: "harthmere-glitch-save",
        schemaVersion: "harthmere-glitch-save-all-state",
        storage: PROGRESSED_STORAGE,
      },
    });
    assert.equal(decision.rehydrate, false);
  });

  it("refuses guests — Glitch itself returns GUEST_NOT_ALLOWED", () => {
    const decision = decideHarthmereRehydration({
      playerRecordExists: false,
      playerRecordHasProgress: false,
      isGuest: true,
      cloudSave: {
        version: 7,
        payloadVersion: "harthmere-glitch-save",
        schemaVersion: "harthmere-glitch-save-all-state",
        storage: PROGRESSED_STORAGE,
      },
    });
    assert.equal(decision.rehydrate, false);
  });

  it("does not re-seed a record the player emptied themselves", () => {
    const decision = decideHarthmereRehydration({
      playerRecordExists: true,
      playerRecordHasProgress: false,
      isGuest: false,
      alreadyRehydratedFromVersion: 7,
      cloudSave: {
        version: 7,
        payloadVersion: "harthmere-glitch-save",
        schemaVersion: "harthmere-glitch-save-all-state",
        storage: PROGRESSED_STORAGE,
      },
    });
    assert.equal(decision.rehydrate, false);
    // ...but a NEWER save version rehydrates again.
    const newer = decideHarthmereRehydration({
      playerRecordExists: true,
      playerRecordHasProgress: false,
      isGuest: false,
      alreadyRehydratedFromVersion: 7,
      cloudSave: {
        version: 8,
        payloadVersion: "harthmere-glitch-save",
        schemaVersion: "harthmere-glitch-save-all-state",
        storage: PROGRESSED_STORAGE,
      },
    });
    assert.equal(newer.rehydrate, true);
  });

  it("rejects unknown schemas and empty saves", () => {
    assert.equal(
      decideHarthmereRehydration({
        playerRecordExists: false,
        playerRecordHasProgress: false,
        isGuest: false,
        cloudSave: {
          version: 1,
          payloadVersion: "some-other-game",
          schemaVersion: "some-other-game",
          storage: PROGRESSED_STORAGE,
        },
      }).rehydrate,
      false
    );
    assert.equal(
      decideHarthmereRehydration({
        playerRecordExists: false,
        playerRecordHasProgress: false,
        isGuest: false,
        cloudSave: {
          version: 1,
          payloadVersion: "harthmere-glitch-save",
          schemaVersion: "harthmere-glitch-save-all-state",
          storage: {},
        },
      }).rehydrate,
      false
    );
    assert.equal(harthmereSnapshotHasMeaningfulProgress({}), false);
    assert.equal(
      harthmereSnapshotHasMeaningfulProgress(PROGRESSED_STORAGE),
      true
    );
  });

  it("projects the snapshot into a player seed and survives corruption", () => {
    const seed = projectHarthmereCloudSaveToPlayerSeed({
      storage: {
        ...PROGRESSED_STORAGE,
        // A corrupt section must not cost the player their quest log.
        "biomes.localDev.harthmere.reputationState": "{not json",
      },
      saveVersion: 7,
      nowMs: 1000,
    });
    assert.ok(seed.questState, "quest state survives");
    assert.equal(
      (seed.levelingState as { level: number }).level,
      3,
      "level survives the deploy"
    );
    assert.equal(seed.reputationState, undefined, "corrupt section dropped");
    assert.equal(seed.rehydratedFromCloudSaveVersion, 7);
  });
});

// ---------------------------------------------------------------------------
// 3. Analytics catalog
// ---------------------------------------------------------------------------

describe("live fix - Chapter 1 analytics catalog", () => {
  it("passes the Glitch contract validation", () => {
    assert.deepEqual(ch1ValidateAnalyticsCatalog(), []);
  });

  it("covers the chapter spine, both dungeons, puzzles, and endings", () => {
    const pairs = new Set(
      CH1_ANALYTICS_EVENTS.map((e) => `${e.step_key}:${e.action_key}`)
    );
    for (const required of [
      "ch1_ignition:start",
      "ch1_act1_card:complete",
      "ch1_act6_seven:complete",
      "ch1_gate_desert:provision_blocked",
      "ch1_dungeon_desert:exit_complete",
      "ch1_dungeon_winter:boss_defeated",
      "ch1_dungeon_desert:weights_solved",
      "ch1_act4_hands:containment_complete",
      "ch1_act6_seven:ledger_surrendered",
      "ch1_ending:chosen",
    ]) {
      assert.ok(pairs.has(required), `missing event ${required}`);
    }
  });

  it("defines funnels from step_keys only, story funnel end to end", () => {
    const story = CH1_FUNNELS.find(
      (f) => f.name === "Chapter 1 Story Progression"
    );
    assert.ok(story);
    assert.equal(story!.steps.length, 8);
    assert.equal(story!.steps[0].step_key, "ch1_ignition");
    assert.equal(story!.steps[story!.steps.length - 1].step_key, "ch1_ending");
  });
});
