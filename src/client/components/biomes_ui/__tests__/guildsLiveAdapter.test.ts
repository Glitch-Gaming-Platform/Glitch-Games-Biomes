/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  createBiomesUIGuildsAdapterV1,
  fetchBiomesUIGuildStateV1,
  normalizeBiomesUIGuildSnapshotV1,
  submitBiomesUIGuildMutationV1,
  type BiomesUIGuildClientSnapshotV1,
  type BiomesUIGuildLiveModeResponseV1,
  type BiomesUIGuildMutationOperationV1,
  type BiomesUIGuildMutationPayloadV1,
} from "../adapters/guildsLiveAdapter";

describe("BiomesUI guild live adapter", () => {
  function sampleSnapshot(): BiomesUIGuildClientSnapshotV1 {
    const now = 1_800_000_000_000;
    return normalizeBiomesUIGuildSnapshotV1({
      actorId: "player_a",
      memberGuildId: "guild_iron_1",
      role: "leader",
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
      guild: {
        guildId: "guild_iron_1",
        name: "Iron Lanterns",
        tag: "IRON",
        description: "Grove builders",
        type: "adventuring",
        recruitment: "application",
        leaderActorId: "player_a",
        createdAtMs: now,
        updatedAtMs: now,
        level: 3,
        xp: 1200,
        treasuryGold: 450,
        taxRate: 0.05,
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
            createdAtMs: now,
            updatedAtMs: now,
          },
          member: {
            rankId: "member",
            name: "Member",
            order: 2,
            permissions: {
              invite_members: false,
              manage_applications: false,
              manage_members: false,
              manage_ranks: false,
              deposit_bank: true,
              withdraw_bank: false,
              manage_treasury: false,
              set_tax: false,
              manage_guild_hall: false,
              send_chat: true,
              moderate_chat: false,
              disband_guild: false,
            },
            dailyBankWithdrawLimitGoldValue: 0,
            createdAtMs: now,
            updatedAtMs: now,
          },
        },
        members: {
          player_a: {
            actorId: "player_a",
            displayName: "Asha",
            rankId: "leader",
            joinedAtMs: now,
            lastSeenAtMs: Date.now(),
            status: "active",
            contributionXp: 1000,
          },
          player_b: {
            actorId: "player_b",
            displayName: "Bryn",
            rankId: "member",
            joinedAtMs: now,
            lastSeenAtMs: now,
            status: "active",
            contributionXp: 200,
          },
        },
        applications: {
          guild_app_1: {
            applicationId: "guild_app_1",
            guildId: "guild_iron_1",
            applicantActorId: "player_c",
            applicantDisplayName: "Cora",
            message: "I can gather stone.",
            status: "pending",
            createdAtMs: now,
          },
        },
        invites: {
          guild_invite_1: {
            inviteId: "guild_invite_1",
            guildId: "guild_iron_1",
            targetActorId: "player_d",
            invitedByActorId: "player_a",
            targetDisplayName: "Dane",
            status: "pending",
            createdAtMs: now,
            expiresAtMs: now + 1_000_000,
          },
        },
        bank: {
          items: { stone: 20 },
          maxSlots: 48,
          logs: [],
          dailyWithdrawals: {},
        },
        treasuryLogs: [],
        chatMessages: [
          {
            messageId: "guild_chat_1",
            guildId: "guild_iron_1",
            actorId: "player_a",
            displayName: "Asha",
            channel: "guild",
            body: "Meet at the hall.",
            createdAtMs: now,
          },
        ],
        auditLogs: [],
        guildHall: {
          propertyId: "property_grove_guild_plot",
          plotId: "grove_guild_plot",
          blueprintId: "guild_hall",
          status: "completed",
          servicesUnlocked: ["guild_bank", "guild_chat_anchor"],
          linkedAtMs: now,
        },
      },
      finder: [
        {
          guildId: "guild_iron_1",
          name: "Iron Lanterns",
          tag: "IRON",
          description: "Grove builders",
          type: "adventuring",
          recruitment: "application",
          level: 3,
          xp: 1200,
          memberCount: 2,
          taxRate: 0.05,
          hasGuildHall: true,
        },
      ],
      pendingApplications: [],
      pendingInvites: [],
    });
  }

  it("fetches the server guild snapshot from the dedicated guild state endpoint", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ guildState: sampleSnapshot() }),
      };
    }) as any;

    const state = await fetchBiomesUIGuildStateV1(fetchImpl);
    assert.equal(calls[0].url, "/api/harthmere/live_mode_guild_state");
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[0].init.credentials, "same-origin");
    assert.equal(state?.guild?.name, "Iron Lanterns");
  });

  it("posts BiomesUI guild actions through request_guild_mutation", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true, guildState: sampleSnapshot() }),
      };
    }) as any;

    await submitBiomesUIGuildMutationV1(
      "create_guild",
      { name: "Iron Lanterns", tag: "IRON", description: "Grove builders" },
      { fetchImpl, requestId: "fixed_request" },
    );

    assert.equal(calls[0].url, "/api/harthmere/live_mode");
    assert.equal(calls[0].init.method, "POST");
    const envelope = JSON.parse(calls[0].init.body);
    assert.equal(envelope.requestId, "fixed_request");
    assert.equal(envelope.idempotencyKey, "fixed_request");
    assert.equal(envelope.actionKind, "request_guild_mutation");
    assert.equal(envelope.subsystem, "guild");
    assert.equal(envelope.zoneId, "the_grove");
    assert.equal(envelope.payload.operation, "create_guild");
    assert.equal(envelope.payload.tag, "IRON");
  });

  it("throws when the live backend rejects a guild reducer operation", async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({ ok: true, backendMutation: { warnings: ["guild_rejected:missing_permission:manage_members"] } }),
    })) as any;

    await assert.rejects(
      () => submitBiomesUIGuildMutationV1("kick_member", { guildId: "guild_iron_1", targetActorId: "player_b" }, { fetchImpl, requestId: "fixed_request" }),
      /missing_permission:manage_members/,
    );
  });

  it("normalizes guild state for the BiomesUI tab and exposes roster, finder, ranks, bank, and permissions", () => {
    const snapshot = sampleSnapshot();
    let saved: BiomesUIGuildClientSnapshotV1 | undefined = snapshot;
    const adapter = createBiomesUIGuildsAdapterV1({
      state: snapshot,
      hydrated: true,
      setState: (next) => { saved = next; },
      refresh: async () => {},
      submit: async () => ({ ok: true, guildState: saved }),
      inventoryDepositCandidates: [{ id: "stone", name: "Stone", icon: "◼", quantity: 12, category: "materials" }],
      guildHallCandidates: [{ propertyId: "property_grove_guild_plot", plotId: "grove_guild_plot", blueprintId: "guild_hall", label: "Grove Guild Hall" }],
    });

    assert.equal(adapter.isHydrated(), true);
    assert.equal(adapter.getGuildName(), "Iron Lanterns");
    assert.equal(adapter.getRoster().length, 2);
    assert.equal(adapter.getRoster()[0].contributionXp, 1000);
    assert.equal(adapter.getRanks().find((rank) => rank.id === "leader")?.canEditBank, true);
    assert.equal(adapter.getFinder()[0].guildId, "guild_iron_1");
    assert.equal(adapter.getDepositCandidates()[0].id, "stone");
    assert.equal(adapter.getGuildHallCandidates()[0].propertyId, "property_grove_guild_plot");
    assert.match(adapter.getBulletin(), /Level 3/);
  });

  it("maps BiomesUI tab actions to the exact guild backend operations", async () => {
    const operations: Array<{ operation: BiomesUIGuildMutationOperationV1; payload: BiomesUIGuildMutationPayloadV1 }> = [];
    let saved: BiomesUIGuildClientSnapshotV1 | undefined = sampleSnapshot();
    const submit = async (
      operation: BiomesUIGuildMutationOperationV1,
      payload: BiomesUIGuildMutationPayloadV1 = {},
    ): Promise<BiomesUIGuildLiveModeResponseV1> => {
      operations.push({ operation, payload });
      return { ok: true, guildState: saved };
    };
    const adapter = createBiomesUIGuildsAdapterV1({
      state: saved,
      hydrated: true,
      setState: (next) => { saved = next; },
      refresh: async () => {},
      submit,
    });

    await adapter.createGuild({ name: "River Knots", tag: "RIVR", description: "Trade guild", guildType: "trade", recruitment: "open" });
    await adapter.applyToGuild("guild_iron_1", "Let me in");
    await adapter.acceptApplication("guild_iron_1", "guild_app_1");
    await adapter.rejectApplication("guild_iron_1", "guild_app_2");
    await adapter.inviteMember("player_d", "Dane");
    await adapter.acceptInvite("guild_iron_1", "guild_invite_1");
    await adapter.declineInvite("guild_iron_1", "guild_invite_2");
    await adapter.assignRank("player_b", "member");
    await adapter.transferLeadership("player_b");
    await adapter.depositGuildBank("stone", 3);
    await adapter.withdrawGuildBank("stone", 1);
    await adapter.depositTreasury(25, "dues");
    await adapter.withdrawTreasury(10, "supplies");
    await adapter.setTaxRate(0.05);
    await adapter.upgradeGuildBankSlots();
    await adapter.linkGuildHall({ propertyId: "property_grove_guild_plot", plotId: "grove_guild_plot", blueprintId: "guild_hall", label: "Grove Guild Hall" });
    await adapter.sendChat("Hello guild", "guild");
    await adapter.deleteChatMessage("guild_chat_1");
    await adapter.muteMember("player_b", 60_000);
    await adapter.leaveGuild();
    await adapter.disbandGuild();

    assert.deepEqual(operations.map((entry) => entry.operation), [
      "create_guild",
      "apply_to_guild",
      "accept_application",
      "reject_application",
      "invite_member",
      "accept_invite",
      "decline_invite",
      "assign_rank",
      "transfer_leader",
      "guild_bank_deposit",
      "guild_bank_withdraw",
      "treasury_deposit",
      "treasury_withdraw",
      "set_tax",
      "upgrade_guild_bank_slots",
      "link_guild_hall",
      "send_chat",
      "delete_chat_message",
      "mute_member",
      "leave_guild",
      "disband_guild",
    ]);
    assert.deepEqual(operations[6], {
      operation: "decline_invite",
      payload: { guildId: "guild_iron_1", inviteId: "guild_invite_2" },
    });
    assert.deepEqual(operations[8], {
      operation: "transfer_leader",
      payload: { guildId: "guild_iron_1", targetActorId: "player_b" },
    });
    assert.equal(operations[9].payload.guildId, "guild_iron_1");
    assert.equal(operations[9].payload.itemId, "stone");
    assert.equal(Object.prototype.hasOwnProperty.call(operations[9].payload, "itemGoldValue"), false);
    assert.equal(operations[15].payload.propertyId, "property_grove_guild_plot");
    assert.equal(operations[16].payload.message, "Hello guild");
    assert.equal(operations[17].payload.message, "guild_chat_1");
  });

  it("does not allow player UI calls to server-only guild economy operations", async () => {
    const fetchImpl = (async () => {
      throw new Error("server-only operation should not be posted");
    }) as any;

    await assert.rejects(
      () => submitBiomesUIGuildMutationV1("collect_tax" as any, { guildId: "guild_iron_1", amountGold: 100 }, { fetchImpl }),
      /server_only_operation:collect_tax/,
    );
    await assert.rejects(
      () => submitBiomesUIGuildMutationV1("add_xp" as any, { guildId: "guild_iron_1", xpDelta: 100 } as any, { fetchImpl }),
      /server_only_operation:add_xp/,
    );
  });
});
