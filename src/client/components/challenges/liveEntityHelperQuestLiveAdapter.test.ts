/// <reference types="mocha" />

import assert from "assert";
import {
  harthmereLiveEntityHelperLiveModeHeaders,
  harthmereLiveEntityHelperLiveModeUrl,
  isLiveEntityHelperLiveModeRejectionError,
  liveEntityHelperLiveSnapshotFromResponse,
  liveEntityHelperQuestPayloadForLiveMode,
  readLiveEntityHelperQuestLiveModeState,
  submitLiveEntityRobotRechargeMutation,
  submitLiveEntityHelperQuestMutation,
} from "./liveEntityHelperQuestLiveAdapter";
import {
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS,
  LIVE_ENTITY_HELPER_QUEST_DEFINITIONS,
  liveEntityHelperQuestId,
  type LiveEntityHelperQuestInstance,
} from "@/shared/harthmere/live_entity_helper_quests";

function quest(): LiveEntityHelperQuestInstance {
  return {
    ...LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.food_water,
    questId: liveEntityHelperQuestId("boba", "food_water"),
    entityId: "boba",
    giverName: "Boba :)",
  };
}

const context = {
  entityId: "boba",
  label: "Boba :)",
  position: [307, 71, -364] as const,
  hasAppearanceComponent: true,
  hasTalkableDialog: true,
  hasPlayerStatus: true,
};

describe("live-entity helper live-mode adapter", () => {
  it("carries Glitch install identity through URL and headers", () => {
    const search = "?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b";
    assert.equal(
      harthmereLiveEntityHelperLiveModeUrl(search),
      "/api/harthmere/live_mode?install_id=25f687dd-9ebe-4c31-8810-719ddfafe66b"
    );
    assert.equal(
      harthmereLiveEntityHelperLiveModeHeaders(search)["X-Glitch-Install-Id"],
      "25f687dd-9ebe-4c31-8810-719ddfafe66b"
    );
  });

  it("builds a server-verifiable quest payload from the same entity context as the dialog", () => {
    const payload = liveEntityHelperQuestPayloadForLiveMode(
      quest(),
      context,
      "live_entity_helper_accept"
    );
    assert.deepEqual(payload, {
      operation: "live_entity_helper_accept",
      questId: "live-helper:boba:food_water",
      questKind: "food_water",
      entityId: "boba",
      entityLabel: "Boba :)",
      entityX: 307,
      entityY: 71,
      entityZ: -364,
      hasRobotComponent: false,
      hasAppearanceComponent: true,
      hasNpcMetadata: false,
      hasPlayerStatus: true,
      hasTalkableDialog: true,
      isRobotLike: false,
      iced: false,
      isMuckMonster: false,
      isJobsBoard: false,
      isMountOnly: false,
    });
  });

  it("submits accept mutations to live-mode quest authority and returns inventory plus quest state", async () => {
    let call: { url: string; init: any } | undefined;
    const fetchImpl = async (url: string, init: any) => {
      call = { url, init };
      return {
        ok: true,
        json: async () => ({
          ok: true,
          backendMutation: { warnings: [] },
          inventoryLootState: {
            actor: { items: { road_ration: 3, clean_water: 2 } },
          },
          questState: {
            active: {
              "live-helper:boba:food_water": {
                stepId: "live_helper_bluewater_supply_route",
                progress: 0,
              },
            },
            completed: {},
          },
        }),
      } as any;
    };

    const snapshot = await submitLiveEntityHelperQuestMutation(
      "live_entity_helper_accept",
      quest(),
      context,
      {
        fetchImpl: fetchImpl as any,
        requestId: "accept-boba",
        locationSearch: "?install_id=glitch-install",
      }
    );

    assert.ok(call);
    assert.equal(
      call!.url,
      "/api/harthmere/live_mode?install_id=glitch-install"
    );
    assert.equal(
      new Headers(call!.init.headers).get("X-Glitch-Install-Id"),
      "glitch-install"
    );
    const body = JSON.parse(call!.init.body);
    assert.equal(body.actionKind, "request_quest_state_update");
    assert.equal(body.subsystem, "quest");
    assert.equal(body.targetId, "boba");
    assert.equal(body.payload.operation, "live_entity_helper_accept");
    assert.equal(body.payload.hasTalkableDialog, true);
    assert.deepEqual(snapshot.inventoryItems, {
      road_ration: 3,
      clean_water: 2,
    });
    assert.ok(snapshot.quests.active["live-helper:boba:food_water"]);
  });

  it("submits completion mutations and surfaces completed quest state plus rewards", async () => {
    let payload: any;
    const fetchImpl = async (_url: string, init: any) => {
      payload = JSON.parse(init.body).payload;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          backendMutation: { warnings: [] },
          inventoryLootState: {
            actor: {
              items: {
                minor_healing_salve: 2,
                repair_voucher: 1,
              },
            },
          },
          questState: {
            active: {},
            completed: {
              "live-helper:boba:food_water": 1_700_000_000_000,
            },
          },
        }),
      } as any;
    };

    const snapshot = await submitLiveEntityHelperQuestMutation(
      "live_entity_helper_complete",
      quest(),
      context,
      { fetchImpl: fetchImpl as any, requestId: "complete-boba" }
    );

    assert.equal(payload.operation, "live_entity_helper_complete");
    assert.deepEqual(snapshot.inventoryItems, {
      minor_healing_salve: 2,
      repair_voucher: 1,
    });
    assert.equal(
      snapshot.quests.completed["live-helper:boba:food_water"],
      1_700_000_000_000
    );
  });

  it("submits boss defeat proof separately from the completion request", async () => {
    let payload: any;
    const fetchImpl = async (_url: string, init: any) => {
      payload = JSON.parse(init.body).payload;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          backendMutation: { warnings: [] },
          questState: {
            active: {
              "live-helper:boba:hard_boss": {
                stepId: "live_entity_helper:boss_defeated",
                progress: 1,
              },
            },
            completed: {},
          },
        }),
      } as any;
    };
    const bossQuest: LiveEntityHelperQuestInstance = {
      ...LIVE_ENTITY_HELPER_QUEST_DEFINITIONS.hard_boss,
      questId: liveEntityHelperQuestId("boba", "hard_boss"),
      entityId: "boba",
      giverName: "Boba :)",
    };

    await submitLiveEntityHelperQuestMutation(
      "live_entity_helper_record_boss_defeat",
      bossQuest,
      context,
      {
        fetchImpl: fetchImpl as any,
        requestId: "record-boss",
        extraPayload: {
          bossDefeated: true,
          bossKillCredit: 1,
          bossEntityId: "9014",
        },
      }
    );

    assert.equal(payload.operation, "live_entity_helper_record_boss_defeat");
    assert.equal(payload.bossDefeated, true);
    assert.equal(payload.bossKillCredit, 1);
    assert.equal(payload.bossEntityId, "9014");
  });

  it("submits robot recharge mutations to the same quest authority path", async () => {
    let body: any;
    const fetchImpl = async (_url: string, init: any) => {
      body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          ok: true,
          backendMutation: { warnings: [] },
          inventoryLootState: {
            actor: { items: { repair_voucher: 1, minor_healing_salve: 2 } },
          },
          questState: { active: {}, completed: {} },
        }),
      } as any;
    };

    const westBreach = LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS.find(
      (marker) => marker.areaId === "west_muck_breach"
    );
    assert.ok(westBreach);
    await submitLiveEntityRobotRechargeMutation(
      {
        entityId: "west-breach-sentinel",
        label: "West Muck Breach Sentinel",
        position: westBreach.position,
      },
      { fetchImpl: fetchImpl as any, requestId: "recharge-sentinel" }
    );

    assert.equal(body.actionKind, "request_quest_state_update");
    assert.equal(body.subsystem, "quest");
    assert.equal(body.payload.operation, "live_entity_robot_energy_recharge");
    assert.equal(body.payload.areaId, "west_muck_breach");
    assert.equal(body.payload.robotId, "sentinel-robot:west_muck_breach");
  });

  it("throws typed rejection errors so the dialog does not create local progress on server rejection", async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          backendMutation: {
            warnings: ["live_entity_helper_rejected:ineligible_entity"],
          },
          questState: { active: {}, completed: {} },
        }),
      } as any);

    await assert.rejects(
      () =>
        submitLiveEntityHelperQuestMutation(
          "live_entity_helper_accept",
          quest(),
          context,
          { fetchImpl: fetchImpl as any, requestId: "reject-boba" }
        ),
      (error) =>
        isLiveEntityHelperLiveModeRejectionError(error) &&
        error.warnings.includes("live_entity_helper_rejected:ineligible_entity")
    );
  });

  it("reads live helper state without requiring entity context", async () => {
    let payload: any;
    const fetchImpl = async (_url: string, init: any) => {
      payload = JSON.parse(init.body).payload;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          backendMutation: { warnings: [] },
          questState: { active: {}, completed: {} },
        }),
      } as any;
    };

    await readLiveEntityHelperQuestLiveModeState({
      fetchImpl: fetchImpl as any,
      requestId: "read-state",
    });

    assert.deepEqual(payload, { operation: "live_entity_helper_read_state" });
  });

  it("normalizes live-mode response snapshots without leaking backend item ids", () => {
    const snapshot = liveEntityHelperLiveSnapshotFromResponse({
      backendMutation: { warnings: [] },
      inventoryLootState: {
        actor: { items: { minor_healing_salve: 2, repair_voucher: 1 } },
      },
      questState: {
        active: {},
        completed: { "live-helper:boba:food_water": 1_700_000_000_000 },
      },
    });

    assert.equal(snapshot.inventoryItems.minor_healing_salve, 2);
    assert.equal(
      snapshot.quests.completed["live-helper:boba:food_water"],
      1_700_000_000_000
    );
  });
});
