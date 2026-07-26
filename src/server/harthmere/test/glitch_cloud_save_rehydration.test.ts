import assert from "assert";
import {
  adoptHarthmereActorStateIfTargetEmpty,
  enrichHarthmereGlitchSnapshotWithServerState,
  latestHarthmereGlitchCloudSave,
  parseHarthmereGlitchCloudPayload,
  projectLegacyHarthmereCloudSaveToLiveModeState,
  rehydrateHarthmereActorFromGlitchSaves,
} from "@/server/harthmere/glitch_cloud_save_rehydration";
import {
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
  stringifyHarthmereLiveModePlayerPersistenceState,
} from "@/shared/harthmere/live_mode_backend";

const ACTOR_ID = "5891787439984351";
const STABLE_GLITCH_ACTOR_ID =
  "glitch:43af071c-9922-4e02-ba46-32ee2b7479a6";
const NOW = 1_784_999_000_000;

function legacyPayload() {
  return {
    version: "harthmere-glitch-save-v1",
    schemaAuditVersion: "harthmere-glitch-save-all-state-v153",
    localStorage: {
      "biomes.localDev.harthmere.levelingState.v1.user.install:test":
        JSON.stringify({ level: 2, xpCurrent: 21 }),
      "biomes.localDev.harthmere.levelingState.v1.user.glitch:test":
        JSON.stringify({ level: 1, xpCurrent: 6 }),
      "biomes.localDev.harthmere.inventoryState.v1": JSON.stringify({
        backpack: {
          items: [
            { itemId: "road_ration", quantity: 9 },
            { itemId: "field_trousers", quantity: 1 },
          ],
        },
        questPouch: [{ itemId: "muck_buster", quantity: 1 }],
        materialStorage: { cloth_scrap: 14 },
        wallet: { gold: 75 },
        bank: { maxSlots: 48, items: [] },
      }),
      "biomes.localDev.harthmere.questState.v1": JSON.stringify({
        active: {},
        completed: ["read-the-jobs-board"],
      }),
      "biomes.localDev.snapshotGroveQuestState.v75": JSON.stringify({
        acceptedQuestIds: ["tools_before_treasure"],
        activeQuestId: "tools_before_treasure",
        activeObjectiveIndex: 1,
        completedQuestIds: ["fountain_buttons_first"],
        completedObjectiveIds: ["tools_before_treasure:0:talked_to_giver"],
      }),
      "biomes.localDev.snapshotMissionState.v73": JSON.stringify({
        active: { snapshot_road_ahead_full_chain: 3 },
        completedStepIds: [
          "meet_jackie_in_grove",
          "road_ahead_meet_up_with_billy",
          "road_ahead_collect_muckwad",
        ],
        completed: [],
      }),
      // Must never be mistaken for a questState row merely because it has the
      // same `.vN.user.*` suffix shape.
      "biomes.localDev.harthmere.foodStaminaState.v1.user.glitch:test":
        JSON.stringify({ inventory: { road_ration: 999 } }),
    },
  };
}

class FakeRedis {
  readonly values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.values.set(key, value);
    return "OK";
  }
}

describe("Glitch Cloud Save server rehydration", () => {
  it("accepts the shipped v1 payload and versioned storage keys", () => {
    const parsed = parseHarthmereGlitchCloudPayload(legacyPayload());
    assert.ok(parsed);
    assert.equal(parsed.payloadVersion, "harthmere-glitch-save-v1");
    assert.equal(parsed.schemaVersion, "harthmere-glitch-save-all-state-v153");
    assert.equal(Object.keys(parsed.storage).length, 7);
  });

  it("projects inventory, level, Grove quests, and Road Ahead progress", () => {
    const parsed = parseHarthmereGlitchCloudPayload(legacyPayload())!;
    const state = projectLegacyHarthmereCloudSaveToLiveModeState({
      storage: parsed.storage,
      actorId: ACTOR_ID,
      nowMs: NOW,
    });
    assert.deepEqual(state.classMagic.skills.character_level, {
      level: 2,
      xp: 21,
    });
    assert.equal(state.inventory.items.road_ration, 9);
    assert.equal(state.inventory.items.muck_buster, 1);
    assert.equal(state.inventory.gold, 75);
    assert.equal(state.banking.materialStorage.cloth_scrap, 14);
    assert.ok(state.quests.completed["read-the-jobs-board"]);
    assert.ok(state.quests.completed.fountain_buttons_first);
    assert.equal(state.quests.active.tools_before_treasure.progress, 1);
    assert.equal(
      state.quests.active.snapshot_road_ahead_full_chain.progress,
      3
    );
  });

  it("preserves quest IDs under a stable Glitch actor without numeric coercion", async () => {
    const redis = new FakeRedis();
    const result = await rehydrateHarthmereActorFromGlitchSaves({
      redis: { primary: redis },
      actorId: STABLE_GLITCH_ACTOR_ID,
      saves: [
        { version: 2288, slot_index: 0, decoded_payload: legacyPayload() },
      ],
      nowMs: NOW,
    });

    assert.equal(result.restored, true);
    const key = harthmereLiveModePlayerStateKey(STABLE_GLITCH_ACTOR_ID);
    assert.equal(
      key,
      `harthmere:live_mode:current:player_state:${STABLE_GLITCH_ACTOR_ID}`
    );
    const state = parseHarthmereLiveModeBackendState(
      await redis.get(key),
      STABLE_GLITCH_ACTOR_ID,
      NOW
    );
    assert.equal(state.actorId, STABLE_GLITCH_ACTOR_ID);
    assert.ok(state.quests.completed["read-the-jobs-board"]);
    assert.ok(state.quests.completed.fountain_buttons_first);
    assert.equal(state.quests.active.tools_before_treasure.progress, 1);
    assert.equal(
      state.quests.active.snapshot_road_ahead_full_chain.progress,
      3
    );
  });

  it("adopts meaningful numeric-actor quests into an empty stable Glitch actor", async () => {
    const redis = new FakeRedis();
    const sourceState = projectLegacyHarthmereCloudSaveToLiveModeState({
      storage: parseHarthmereGlitchCloudPayload(legacyPayload())!.storage,
      actorId: ACTOR_ID,
      nowMs: NOW,
    });
    await redis.set(
      harthmereLiveModePlayerStateKey(ACTOR_ID),
      stringifyHarthmereLiveModePlayerPersistenceState(sourceState)
    );
    // A newer-but-empty cloud restore may already have created the target.
    const emptyTarget = parseHarthmereLiveModeBackendState(
      null,
      STABLE_GLITCH_ACTOR_ID,
      NOW
    );
    emptyTarget.rehydratedFromCloudSaveVersion = 2380;
    await redis.set(
      harthmereLiveModePlayerStateKey(STABLE_GLITCH_ACTOR_ID),
      stringifyHarthmereLiveModePlayerPersistenceState(emptyTarget)
    );

    const result = await adoptHarthmereActorStateIfTargetEmpty({
      redis: { primary: redis },
      sourceActorId: ACTOR_ID,
      targetActorId: STABLE_GLITCH_ACTOR_ID,
      nowMs: NOW + 1,
    });
    assert.equal(result.adopted, true);

    const adopted = parseHarthmereLiveModeBackendState(
      await redis.get(harthmereLiveModePlayerStateKey(STABLE_GLITCH_ACTOR_ID)),
      STABLE_GLITCH_ACTOR_ID,
      NOW + 1
    );
    assert.equal(adopted.actorId, STABLE_GLITCH_ACTOR_ID);
    assert.equal(adopted.inventory.gold, 75);
    assert.ok(adopted.quests.completed["read-the-jobs-board"]);
    assert.equal(adopted.quests.active.tools_before_treasure.progress, 1);
    assert.equal(
      adopted.quests.active.snapshot_road_ahead_full_chain.progress,
      3
    );
    assert.ok(
      await redis.get(harthmereLiveModePlayerStateKey(ACTOR_ID)),
      "source remains available as a rollback copy"
    );
  });

  it("never replaces meaningful stable-actor quest progress with a legacy actor", async () => {
    const redis = new FakeRedis();
    const sourceState = projectLegacyHarthmereCloudSaveToLiveModeState({
      storage: parseHarthmereGlitchCloudPayload(legacyPayload())!.storage,
      actorId: ACTOR_ID,
      nowMs: NOW,
    });
    const targetState = projectLegacyHarthmereCloudSaveToLiveModeState({
      storage: parseHarthmereGlitchCloudPayload(legacyPayload())!.storage,
      actorId: STABLE_GLITCH_ACTOR_ID,
      nowMs: NOW,
    });
    targetState.inventory.gold = 999;
    targetState.quests.completed["ch1_target_only"] = NOW;
    await redis.set(
      harthmereLiveModePlayerStateKey(ACTOR_ID),
      stringifyHarthmereLiveModePlayerPersistenceState(sourceState)
    );
    await redis.set(
      harthmereLiveModePlayerStateKey(STABLE_GLITCH_ACTOR_ID),
      stringifyHarthmereLiveModePlayerPersistenceState(targetState)
    );

    const result = await adoptHarthmereActorStateIfTargetEmpty({
      redis: { primary: redis },
      sourceActorId: ACTOR_ID,
      targetActorId: STABLE_GLITCH_ACTOR_ID,
      nowMs: NOW + 1,
    });
    assert.equal(result.adopted, false);
    const retained = parseHarthmereLiveModeBackendState(
      await redis.get(harthmereLiveModePlayerStateKey(STABLE_GLITCH_ACTOR_ID)),
      STABLE_GLITCH_ACTOR_ID,
      NOW + 1
    );
    assert.equal(retained.inventory.gold, 999);
    assert.ok(retained.quests.completed.ch1_target_only);
  });

  it("ignores higher per-slot versions outside authoritative slot 0", () => {
    const selected = latestHarthmereGlitchCloudSave([
      { version: 8, slot_index: 0, decoded_payload: legacyPayload() },
      {
        version: 999,
        slot_index: 5,
        decoded_payload: {
          ...legacyPayload(),
          localStorage: { unrelated: "slot" },
        },
      },
    ]);
    assert.equal(selected?.slot_index, 0);
    assert.equal(selected?.version, 8);
  });

  it("restores legacy data once, then saves and restores the exact server record", async () => {
    const redis = new FakeRedis();
    const first = await rehydrateHarthmereActorFromGlitchSaves({
      redis: { primary: redis },
      actorId: ACTOR_ID,
      saves: [
        { version: 2288, slot_index: 0, decoded_payload: legacyPayload() },
      ],
      nowMs: NOW,
    });
    assert.equal(first.restored, true);
    assert.equal(first.source, "legacy_browser_projection");

    const key = harthmereLiveModePlayerStateKey(ACTOR_ID);
    const firstRaw = await redis.get(key);
    const firstState = parseHarthmereLiveModeBackendState(
      firstRaw,
      ACTOR_ID,
      NOW
    );
    assert.equal(firstState.inventory.items.road_ration, 9);
    assert.equal(firstState.rehydratedFromCloudSaveVersion, 2288);

    const enriched = enrichHarthmereGlitchSnapshotWithServerState({
      snapshot: legacyPayload(),
      rawPlayerState: firstRaw,
      actorId: ACTOR_ID,
      nowMs: NOW + 1,
    });
    redis.values.delete(key); // simulate an app rollout rebuilding actor Redis

    const second = await rehydrateHarthmereActorFromGlitchSaves({
      redis: { primary: redis },
      actorId: ACTOR_ID,
      saves: [{ version: 2289, slot_index: 0, decoded_payload: enriched }],
      nowMs: NOW + 2,
    });
    assert.equal(second.restored, true);
    assert.equal(second.source, "server_player_state");
    const secondState = parseHarthmereLiveModeBackendState(
      await redis.get(key),
      ACTOR_ID,
      NOW + 2
    );
    assert.equal(secondState.inventory.items.road_ration, 9);
    assert.equal(secondState.classMagic.skills.character_level.level, 2);
    assert.equal(secondState.rehydratedFromCloudSaveVersion, 2289);
  });

  it("never overwrites a live actor record that already has progress", async () => {
    const redis = new FakeRedis();
    const key = harthmereLiveModePlayerStateKey(ACTOR_ID);
    const live = projectLegacyHarthmereCloudSaveToLiveModeState({
      storage: parseHarthmereGlitchCloudPayload(legacyPayload())!.storage,
      actorId: ACTOR_ID,
      nowMs: NOW,
    });
    live.inventory.gold = 999;
    await redis.set(
      key,
      stringifyHarthmereLiveModePlayerPersistenceState(live)
    );
    const result = await rehydrateHarthmereActorFromGlitchSaves({
      redis: { primary: redis },
      actorId: ACTOR_ID,
      saves: [
        { version: 3000, slot_index: 0, decoded_payload: legacyPayload() },
      ],
      nowMs: NOW + 1,
    });
    assert.equal(result.restored, false);
    const retained = parseHarthmereLiveModeBackendState(
      await redis.get(key),
      ACTOR_ID,
      NOW + 1
    );
    assert.equal(retained.inventory.gold, 999);
  });
});
