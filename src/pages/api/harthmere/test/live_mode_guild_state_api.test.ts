import assert from "assert";
import {
  readHarthmereLiveModeGuildStateForActorV1,
} from "../live_mode_guild_state";
import {
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeSharedWorldStateKeyV1,
} from "@/shared/harthmere/live_mode_backend_v1";

const ACTOR = "player_api_guild_001";
const NOW_MS = 1_700_300_000_000;

describe("live_mode_guild_state API route integration", () => {
  it("reads Redis state and returns the guild snapshot for the actor", async () => {
    const backend = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    backend.guild.guildId = "guild_api_iron";
    backend.guild.role = "leader";
    backend.guild.guilds.guild_api_iron = {
      guildId: "guild_api_iron",
      name: "API Iron Lanterns",
      tag: "API",
      description: "Route integration guild.",
      type: "civic",
      recruitment: "application",
      leaderActorId: ACTOR,
      createdAtMs: NOW_MS,
      updatedAtMs: NOW_MS,
      level: 2,
      xp: 400,
      treasuryGold: 100,
      taxRate: 0.04,
      ranks: {
        leader: {
          rankId: "leader",
          name: "Leader",
          order: 0,
          permissions: {
            invite_members: true,
            manage_applications: true,
            manage_members: true,
            manage_ranks: true,
            deposit_bank: true,
            withdraw_bank: true,
            manage_treasury: true,
            set_tax: true,
            manage_guild_hall: true,
            send_chat: true,
            moderate_chat: true,
            disband_guild: true,
          },
          dailyBankWithdrawLimitGoldValue: Number.MAX_SAFE_INTEGER,
          createdAtMs: NOW_MS,
          updatedAtMs: NOW_MS,
        },
      },
      members: {
        [ACTOR]: {
          actorId: ACTOR,
          displayName: "API Player",
          rankId: "leader",
          joinedAtMs: NOW_MS,
          lastSeenAtMs: NOW_MS,
          status: "active",
          contributionXp: 50,
        },
      },
      applications: {},
      invites: {},
      bank: { items: {}, maxSlots: 48, logs: [], dailyWithdrawals: {} },
      treasuryLogs: [],
      chatMessages: [],
      auditLogs: [],
      guildHall: { status: "none", servicesUnlocked: [] },
    };
    const calls: string[] = [];
    const redis = {
      primary: {
        get: async (key: string) => {
          calls.push(key);
          return JSON.stringify(backend);
        },
      },
    };

    const snapshot = await readHarthmereLiveModeGuildStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.deepEqual(calls, [
      harthmereLiveModePlayerStateKeyV1(ACTOR),
      harthmereLiveModeSharedWorldStateKeyV1(),
    ]);
    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.guild?.name, "API Iron Lanterns");
    assert.equal(snapshot.memberGuildId, "guild_api_iron");
    assert.equal(snapshot.permissions.manage_ranks, true);
  });

  it("returns default guild state when Redis has no actor state", async () => {
    const redis = { primary: { get: async () => null } };
    const snapshot = await readHarthmereLiveModeGuildStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.equal(snapshot.actorId, ACTOR);
    assert.equal(snapshot.memberGuildId, undefined);
    assert.equal(snapshot.guild, undefined);
    assert.deepEqual(snapshot.pendingApplications, []);
    assert.deepEqual(snapshot.pendingInvites, []);
  });
});
