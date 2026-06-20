import assert from "assert";
import {
  HARTHMERE_GUILD_CREATION_MIN_LEVEL,
  HARTHMERE_GUILD_MAX_MEMBERS,
  createHarthmereLiveModeGuildClientSnapshot,
  defaultHarthmereLiveModeGuildState,
  hasHarthmereGuildPermission,
  linkHarthmereGuildHallProperty,
  reduceHarthmereGuildMutation,
  validateHarthmereGuildIdentity,
  type HarthmereLiveModeGuildState,
} from "../mmo_guild_authority";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import {
  registerHarthmereItemDefinition,
  type HarthmereItemDefinition,
} from "../mmo_inventory_authority";
import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAuthorityEnvelope,
} from "../live_mode_readiness";

const NOW_MS = 1_760_000_000_000;
const LEADER = "guild_leader_001";
const APPLICANT = "guild_applicant_002";
const RECRUIT = "guild_recruit_003";
const SECOND_LEADER = "guild_leader_004";

function ctx(overrides: Partial<{
  gold: number;
  items: Record<string, number>;
  canWithdraw: boolean;
  actorLevel: number;
  trustedTaxCollection: boolean;
  trustedGuildXpGrant: boolean;
}> = {}) {
  return {
    actorGold: overrides.gold ?? 10_000,
    actorInventoryItems: overrides.items ?? {},
    actorLevel: overrides.actorLevel ?? HARTHMERE_GUILD_CREATION_MIN_LEVEL,
    trustedTaxCollection: overrides.trustedTaxCollection,
    trustedGuildXpGrant: overrides.trustedGuildXpGrant,
    canDepositItem: (itemId: string) => !itemId.startsWith("quest_"),
    canWithdrawToInventory: () => overrides.canWithdraw ?? true,
    guildBankHasCapacity: (items: Record<string, number>, itemId: string, maxSlots: number) =>
      (items[itemId] ?? 0) > 0 || Object.values(items).filter((count) => count > 0).length < maxSlots,
  };
}

function mutate(
  state: HarthmereLiveModeGuildState,
  actorId: string,
  operation: string,
  payload: Record<string, unknown> = {},
  context = ctx(),
) {
  return reduceHarthmereGuildMutation(
    state,
    {
      requestId: `guild-test-${operation}-${Math.random()}`,
      actorId,
      nowMs: NOW_MS,
      operation,
      ...(payload as any),
    },
    context,
  );
}

function createGuild(state = defaultHarthmereLiveModeGuildState(), actorId = LEADER) {
  const result = mutate(state, actorId, "create_guild", {
    name: "Iron Lanterns",
    tag: "IL",
    description: "Protects the Grove and funds shared projects.",
    recruitment: "application",
    guildType: "civic",
  });
  assert.deepStrictEqual(result.warnings, []);
  const guildId = result.guild.memberGuildId!;
  return { state: result.guild, guildId, result };
}

function env(
  actionKind: HarthmereLiveModeActionKind,
  actorId: string,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelope> = {},
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: `live-guild-${actionKind}-${Math.random()}`,
    idempotencyKey: `idem-${Math.random()}`,
    actorId,
    actionKind,
    subsystem: "guild",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "harthmere_grove",
    payload,
    clientClaims: {},
    ...overrides,
  };
}

function applyLive(
  state: HarthmereLiveModeBackendState,
  actionKind: HarthmereLiveModeActionKind,
  actorId: string,
  payload: Record<string, unknown> = {},
) {
  return reduceHarthmereLiveModeBackendState(state, env(actionKind, actorId, payload), NOW_MS);
}

before(function registerGuildTestItems() {
  const ironOre: HarthmereItemDefinition = {
    itemId: "iron_ore",
    displayName: "Iron Ore",
    maxStackSize: 999,
    baseValue: 5,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: true,
  };
  const questSeal: HarthmereItemDefinition = {
    itemId: "quest_guild_seal",
    displayName: "Guild Quest Seal",
    maxStackSize: 1,
    baseValue: 0,
    binding: "quest",
    isQuestItem: true,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: false,
  };
  registerHarthmereItemDefinition(ironOre);
  registerHarthmereItemDefinition(questSeal);
});

describe("mmo_guild_authority — identity and creation", function () {
  it("rejects invalid, reserved, and malformed guild identity", function () {
    assert.ok(!validateHarthmereGuildIdentity({ name: "GM", tag: "G" }).ok);
    assert.ok(!validateHarthmereGuildIdentity({ name: "Biomes Admins", tag: "ADM" }).ok);
    assert.ok(!validateHarthmereGuildIdentity({ name: "Bad!!!Name", tag: "BAD" }).ok);
    assert.ok(validateHarthmereGuildIdentity({ name: "Iron Lanterns", tag: "IL" }).ok);
  });

  it("creates a production guild record, charges the charter fee, and makes the founder leader", function () {
    const { state, guildId, result } = createGuild();
    const guild = state.guilds[guildId];
    assert.strictEqual(result.inventoryGoldDelta, -250);
    assert.strictEqual(guild.name, "Iron Lanterns");
    assert.strictEqual(guild.tag, "IL");
    assert.strictEqual(guild.members[LEADER].rankId, "leader");
    assert.strictEqual(guild.bank.maxSlots, 48);
    assert.strictEqual(state.guildId, guildId);
    assert.strictEqual(state.role, "leader");
    assert.ok(hasHarthmereGuildPermission(guild, LEADER, "manage_ranks", NOW_MS));
  });

  it("rejects duplicate names, duplicate tags, insufficient level/gold, and already-in-guild creation", function () {
    const { state } = createGuild();
    const duplicateName = mutate(state, "other_player", "create_guild", { name: "Iron Lanterns", tag: "XX" });
    assert.ok(duplicateName.warnings.includes("guild_rejected:name_already_taken"));
    const duplicateTag = mutate(state, "other_player", "create_guild", { name: "Different Name", tag: "IL" });
    assert.ok(duplicateTag.warnings.includes("guild_rejected:tag_already_taken"));
    const underleveled = mutate(defaultHarthmereLiveModeGuildState(), "new_player", "create_guild", { name: "Young Owls", tag: "YOWL" }, ctx({ actorLevel: HARTHMERE_GUILD_CREATION_MIN_LEVEL - 1 }));
    assert.ok(underleveled.warnings.includes("guild_rejected:below_minimum_level"));
    const poor = mutate(defaultHarthmereLiveModeGuildState(), "poor_player", "create_guild", { name: "Stone Hawks", tag: "SH" }, ctx({ gold: 100 }));
    assert.ok(poor.warnings.includes("guild_rejected:not_enough_gold_for_charter"));
    const secondForLeader = mutate(state, LEADER, "create_guild", { name: "Second Guild", tag: "SG" });
    assert.ok(secondForLeader.warnings.includes("guild_rejected:already_in_guild"));
  });
});

describe("mmo_guild_authority — finder, applications, and invites", function () {
  it("exposes a guild finder entry and supports application accept/reject flow", function () {
    const { state, guildId } = createGuild();
    const finder = createHarthmereLiveModeGuildClientSnapshot(state, APPLICANT);
    assert.strictEqual(finder.finder.length, 1);
    assert.strictEqual(finder.finder[0].guildId, guildId);

    const applied = mutate(state, APPLICANT, "apply_to_guild", {
      guildId,
      displayName: "Applicant",
      message: "I want to help build the Grove.",
    });
    const app = Object.values(applied.guild.guilds[guildId].applications)[0];
    assert.strictEqual(app.status, "pending");

    const accepted = mutate(applied.guild, LEADER, "accept_application", {
      guildId,
      applicationId: app.applicationId,
    });
    assert.strictEqual(accepted.guild.guilds[guildId].members[APPLICANT].rankId, "member");

    const applyAgain = mutate(accepted.guild, APPLICANT, "apply_to_guild", { guildId });
    assert.ok(applyAgain.warnings.includes("guild_rejected:already_in_guild"));
  });

  it("supports direct invites, expiration, and target acceptance", function () {
    const { state, guildId } = createGuild();
    const invited = mutate(state, LEADER, "invite_member", {
      guildId,
      targetActorId: RECRUIT,
      displayName: "Recruit",
    });
    const invite = Object.values(invited.guild.guilds[guildId].invites)[0];
    assert.strictEqual(invite.status, "pending");

    const accepted = mutate(invited.guild, RECRUIT, "accept_invite", { guildId, inviteId: invite.inviteId });
    assert.strictEqual(accepted.guild.guilds[guildId].members[RECRUIT].rankId, "member");

    const expiredState = createGuild().state;
    const expiredInviteResult = mutate(expiredState, LEADER, "invite_member", { guildId: expiredState.memberGuildId, targetActorId: "late_player" });
    const expiredGuildId = expiredInviteResult.guild.memberGuildId!;
    const expiredInvite = Object.values(expiredInviteResult.guild.guilds[expiredGuildId].invites)[0];
    const expiredAccept = reduceHarthmereGuildMutation(expiredInviteResult.guild, {
      requestId: "expired-accept",
      actorId: "late_player",
      nowMs: NOW_MS + 8 * 24 * 60 * 60 * 1000,
      operation: "accept_invite",
      guildId: expiredGuildId,
      inviteId: expiredInvite.inviteId,
    }, ctx());
    assert.ok(expiredAccept.warnings.includes("guild_rejected:invite_expired"));
  });

  it("supports target invite decline without joining the guild", function () {
    const { state, guildId } = createGuild();
    const invited = mutate(state, LEADER, "invite_member", {
      guildId,
      targetActorId: RECRUIT,
      displayName: "Recruit",
    });
    const invite = Object.values(invited.guild.guilds[guildId].invites)[0];

    const declined = mutate(invited.guild, RECRUIT, "decline_invite", { guildId, inviteId: invite.inviteId });

    assert.strictEqual(declined.guild.guilds[guildId].invites[invite.inviteId].status, "declined");
    assert.equal(declined.guild.guilds[guildId].members[RECRUIT], undefined);
    assert.equal(declined.guild.memberGuildId, undefined);
  });

  it("clears stale pending applications and invites when a player joins one main guild", function () {
    const first = createGuild(defaultHarthmereLiveModeGuildState(), LEADER);
    const secondResult = mutate(first.state, SECOND_LEADER, "create_guild", {
      name: "Silver Wardens",
      tag: "SW",
      description: "Second test guild.",
      recruitment: "application",
      guildType: "civic",
    });
    assert.deepStrictEqual(secondResult.warnings, []);
    const firstGuildId = first.guildId;
    const secondGuildId = secondResult.guild.memberGuildId!;

    const applied = mutate(secondResult.guild, APPLICANT, "apply_to_guild", { guildId: firstGuildId });
    const invited = mutate(applied.guild, SECOND_LEADER, "invite_member", {
      guildId: secondGuildId,
      targetActorId: APPLICANT,
    });
    const invite = Object.values(invited.guild.guilds[secondGuildId].invites)[0];

    const accepted = mutate(invited.guild, APPLICANT, "accept_invite", {
      guildId: secondGuildId,
      inviteId: invite.inviteId,
    });

    const staleApplication = Object.values(accepted.guild.guilds[firstGuildId].applications)[0];
    assert.strictEqual(staleApplication.status, "cancelled");
    assert.strictEqual(accepted.guild.guilds[secondGuildId].members[APPLICANT].rankId, "member");
    assert.strictEqual(createHarthmereLiveModeGuildClientSnapshot(accepted.guild, APPLICANT).pendingApplications.length, 0);
  });

  it("requires application and invite permissions", function () {
    let { state, guildId } = createGuild();
    state.guilds[guildId].members[APPLICANT] = {
      actorId: APPLICANT,
      rankId: "member",
      joinedAtMs: NOW_MS,
      lastSeenAtMs: NOW_MS,
      status: "active",
      contributionXp: 0,
    };
    const blockedInvite = mutate(state, APPLICANT, "invite_member", { guildId, targetActorId: RECRUIT });
    assert.ok(blockedInvite.warnings.includes("guild_rejected:missing_permission:invite_members"));
  });
});

describe("mmo_guild_authority — member management and ranks", function () {
  it("supports custom ranks, assignment, and permission enforcement", function () {
    let { state, guildId } = createGuild();
    state.guilds[guildId].members[APPLICANT] = {
      actorId: APPLICANT,
      rankId: "member",
      joinedAtMs: NOW_MS,
      lastSeenAtMs: NOW_MS,
      status: "active",
      contributionXp: 0,
    };

    const denied = mutate(state, APPLICANT, "create_rank", { guildId, rankName: "Quartermaster" });
    assert.ok(denied.warnings.includes("guild_rejected:missing_permission:manage_ranks"));

    const created = mutate(state, LEADER, "create_rank", {
      guildId,
      rankName: "Quartermaster",
      permissions: { deposit_bank: true, withdraw_bank: true, send_chat: true },
      dailyBankWithdrawLimitGoldValue: 10,
    });
    const customRankId = Object.keys(created.guild.guilds[guildId].ranks).find((rankId) => rankId.startsWith("rank_quartermaster"))!;
    const assigned = mutate(created.guild, LEADER, "assign_rank", { guildId, targetActorId: APPLICANT, rankId: customRankId });
    assert.strictEqual(assigned.guild.guilds[guildId].members[APPLICANT].rankId, customRankId);

    const cannotDeleteInUse = mutate(assigned.guild, LEADER, "delete_rank", { guildId, rankId: customRankId });
    assert.ok(cannotDeleteInUse.warnings.includes("guild_rejected:rank_in_use"));
  });

  it("blocks invalid kicks, leader demotion, and leader leaving before transfer", function () {
    let { state, guildId } = createGuild();
    state.guilds[guildId].members[APPLICANT] = {
      actorId: APPLICANT,
      rankId: "member",
      joinedAtMs: NOW_MS,
      lastSeenAtMs: NOW_MS,
      status: "active",
      contributionXp: 0,
    };
    const memberKick = mutate(state, APPLICANT, "kick_member", { guildId, targetActorId: LEADER });
    assert.ok(memberKick.warnings.includes("guild_rejected:missing_permission:manage_members"));

    const kickLeader = mutate(state, LEADER, "kick_member", { guildId, targetActorId: LEADER });
    assert.ok(kickLeader.warnings.includes("guild_rejected:cannot_kick_leader"));

    const leaderLeave = mutate(state, LEADER, "leave_guild", { guildId });
    assert.ok(leaderLeave.warnings.includes("guild_rejected:leader_must_transfer_or_disband_first"));

    const transferred = mutate(state, LEADER, "transfer_leader", { guildId, targetActorId: APPLICANT });
    assert.strictEqual(transferred.guild.guilds[guildId].leaderActorId, APPLICANT);
  });

  it("enforces rank hierarchy so officers cannot seize leader rank or manage peers", function () {
    let { state, guildId } = createGuild();
    state.guilds[guildId].members[APPLICANT] = {
      actorId: APPLICANT,
      rankId: "officer",
      joinedAtMs: NOW_MS,
      lastSeenAtMs: NOW_MS,
      status: "active",
      contributionXp: 0,
    };
    state.guilds[guildId].members[RECRUIT] = {
      actorId: RECRUIT,
      rankId: "officer",
      joinedAtMs: NOW_MS,
      lastSeenAtMs: NOW_MS,
      status: "active",
      contributionXp: 0,
    };

    const seizeLeader = mutate(state, APPLICANT, "assign_rank", {
      guildId,
      targetActorId: APPLICANT,
      rankId: "leader",
    });
    assert.ok(seizeLeader.warnings.includes("guild_rejected:use_transfer_leader_for_leader_rank"));
    assert.strictEqual(seizeLeader.guild.guilds[guildId].leaderActorId, LEADER);

    const kickPeer = mutate(state, APPLICANT, "kick_member", { guildId, targetActorId: RECRUIT });
    assert.ok(kickPeer.warnings.includes("guild_rejected:cannot_manage_equal_or_higher_rank"));
    assert.ok(kickPeer.guild.guilds[guildId].members[RECRUIT]);

    state.guilds[guildId].members[RECRUIT].rankId = "member";
    const promotePeer = mutate(state, APPLICANT, "assign_rank", {
      guildId,
      targetActorId: RECRUIT,
      rankId: "officer",
    });
    assert.ok(promotePeer.warnings.includes("guild_rejected:cannot_assign_equal_or_higher_rank"));
    assert.strictEqual(promotePeer.guild.guilds[guildId].members[RECRUIT].rankId, "member");
  });
});

describe("mmo_guild_authority — bank, treasury, tax, and leveling", function () {
  it("deposits and withdraws real inventory items with permissions, limits, and logs", function () {
    let { state, guildId } = createGuild();
    state.guilds[guildId].members[APPLICANT] = {
      actorId: APPLICANT,
      rankId: "officer",
      joinedAtMs: NOW_MS,
      lastSeenAtMs: NOW_MS,
      status: "active",
      contributionXp: 0,
    };
    const deposited = mutate(state, APPLICANT, "guild_bank_deposit", { guildId, itemId: "iron_ore", count: 5, itemGoldValue: 5 }, ctx({ items: { iron_ore: 5 } }));
    assert.strictEqual(deposited.inventoryItemDeltas.iron_ore, -5);
    assert.strictEqual(deposited.guild.guilds[guildId].bank.items.iron_ore, 5);
    assert.strictEqual(deposited.guild.guilds[guildId].bank.logs[0].kind, "deposit");
    assert.strictEqual(deposited.guild.guilds[guildId].members[APPLICANT].contributionXp, 2);

    const withdrawn = mutate(deposited.guild, APPLICANT, "guild_bank_withdraw", { guildId, itemId: "iron_ore", count: 2, itemGoldValue: 5 });
    assert.strictEqual(withdrawn.inventoryItemDeltas.iron_ore, 2);
    assert.strictEqual(withdrawn.guild.guilds[guildId].bank.items.iron_ore, 3);

    const tooMuch = mutate(withdrawn.guild, APPLICANT, "guild_bank_withdraw", { guildId, itemId: "iron_ore", count: 2, itemGoldValue: 1_000 });
    assert.ok(tooMuch.warnings.includes("guild_rejected:daily_withdraw_limit_exceeded"));

    const blockedWeight = mutate(withdrawn.guild, APPLICANT, "guild_bank_withdraw", { guildId, itemId: "iron_ore", count: 1, itemGoldValue: 1 }, ctx({ canWithdraw: false }));
    assert.ok(blockedWeight.warnings.includes("guild_rejected:carry_weight_limit_exceeded"));
  });

  it("values guild bank withdrawal limits by count times item value", function () {
    let { state, guildId } = createGuild();
    state.guilds[guildId].members[APPLICANT] = {
      actorId: APPLICANT,
      rankId: "officer",
      joinedAtMs: NOW_MS,
      lastSeenAtMs: NOW_MS,
      status: "active",
      contributionXp: 0,
    };
    state.guilds[guildId].ranks.officer.dailyBankWithdrawLimitGoldValue = 10;
    state.guilds[guildId].bank.items.iron_ore = 4;

    const first = mutate(state, APPLICANT, "guild_bank_withdraw", {
      guildId,
      itemId: "iron_ore",
      count: 2,
      itemGoldValue: 5,
    });
    assert.strictEqual(first.guild.guilds[guildId].bank.dailyWithdrawals[APPLICANT].goldValue, 10);

    const second = mutate(first.guild, APPLICANT, "guild_bank_withdraw", {
      guildId,
      itemId: "iron_ore",
      count: 1,
      itemGoldValue: 1,
    });
    assert.ok(second.warnings.includes("guild_rejected:daily_withdraw_limit_exceeded"));
    assert.strictEqual(second.guild.guilds[guildId].bank.items.iron_ore, 2);
  });

  it("rejects guild bank deposit of unavailable, non-depositable, or over-capacity items", function () {
    const { state, guildId } = createGuild();
    const unavailable = mutate(state, LEADER, "guild_bank_deposit", { guildId, itemId: "iron_ore", count: 5 }, ctx({ items: { iron_ore: 1 } }));
    assert.ok(unavailable.warnings.includes("guild_rejected:insufficient_item_count"));

    const quest = mutate(state, LEADER, "guild_bank_deposit", { guildId, itemId: "quest_guild_seal", count: 1 }, ctx({ items: { quest_guild_seal: 1 } }));
    assert.ok(quest.warnings.includes("guild_rejected:item_not_depositable"));

    state.guilds[guildId].bank.items = Object.fromEntries(Array.from({ length: 48 }, (_, i) => [`filled_slot_${i}`, 1]));
    const full = mutate(state, LEADER, "guild_bank_deposit", { guildId, itemId: "copper_ore", count: 1 }, ctx({ items: { copper_ore: 1 } }));
    assert.ok(full.warnings.includes("guild_rejected:guild_bank_full"));
  });

  it("rejects zero, negative, and NaN economy payloads instead of coercing them to one", function () {
    const { state, guildId } = createGuild();
    const zeroGold = mutate(state, LEADER, "treasury_deposit", { guildId, amountGold: 0 });
    assert.ok(zeroGold.warnings.includes("guild_rejected:invalid_gold_amount"));
    assert.strictEqual(zeroGold.guild.guilds[guildId].treasuryGold, 0);

    const negativeWithdraw = mutate(state, LEADER, "treasury_withdraw", { guildId, amountGold: -5 });
    assert.ok(negativeWithdraw.warnings.includes("guild_rejected:invalid_gold_amount"));

    const nanItems = mutate(state, LEADER, "guild_bank_deposit", {
      guildId,
      itemId: "iron_ore",
      count: Number.NaN,
    }, ctx({ items: { iron_ore: 10 } }));
    assert.ok(nanItems.warnings.includes("guild_rejected:invalid_item_count"));
    assert.strictEqual(nanItems.guild.guilds[guildId].bank.items.iron_ore ?? 0, 0);

    const nanXp = mutate(state, LEADER, "add_xp", {
      guildId,
      xpDelta: Number.NaN,
    }, ctx({ trustedGuildXpGrant: true }));
    assert.ok(nanXp.warnings.includes("guild_rejected:invalid_xp_delta"));
    assert.strictEqual(nanXp.guild.guilds[guildId].xp, 0);
  });

  it("handles treasury deposits/withdrawals, tax caps, collection, bank slot upgrades, and XP levels", function () {
    const { state, guildId } = createGuild();
    const deposited = mutate(state, LEADER, "treasury_deposit", { guildId, amountGold: 1_000 });
    assert.strictEqual(deposited.inventoryGoldDelta, -1_000);
    assert.strictEqual(deposited.guild.guilds[guildId].treasuryGold, 1_000);

    const setTax = mutate(deposited.guild, LEADER, "set_tax", { guildId, taxRate: 0.08 });
    assert.strictEqual(setTax.guild.guilds[guildId].taxRate, 0.08);
    const badTax = mutate(setTax.guild, LEADER, "set_tax", { guildId, taxRate: 0.25 });
    assert.ok(badTax.warnings.includes("guild_rejected:invalid_tax_rate"));

    const unauthorizedTax = mutate(setTax.guild, LEADER, "collect_tax", { guildId, amountGold: 1_000 });
    assert.ok(unauthorizedTax.warnings.includes("guild_rejected:tax_collection_not_server_authorized"));
    assert.strictEqual(unauthorizedTax.guild.guilds[guildId].treasuryGold, 1_000);

    const tax = mutate(setTax.guild, LEADER, "collect_tax", { guildId, amountGold: 1_000 }, ctx({ trustedTaxCollection: true }));
    assert.strictEqual(tax.guild.guilds[guildId].treasuryGold, 1_080);

    const upgraded = mutate(tax.guild, LEADER, "upgrade_guild_bank_slots", { guildId });
    assert.strictEqual(upgraded.guild.guilds[guildId].bank.maxSlots, 60);
    assert.strictEqual(upgraded.guild.guilds[guildId].treasuryGold, 880);

    const untrustedXp = mutate(upgraded.guild, LEADER, "add_xp", { guildId, xpDelta: 1_250 });
    assert.ok(untrustedXp.warnings.includes("guild_rejected:xp_grant_not_server_authorized"));

    const leveled = mutate(upgraded.guild, LEADER, "add_xp", { guildId, xpDelta: 1_250 }, ctx({ trustedGuildXpGrant: true }));
    assert.strictEqual(leveled.guild.guilds[guildId].level, 3);

    const withdrawn = mutate(leveled.guild, LEADER, "treasury_withdraw", { guildId, amountGold: 100 });
    assert.strictEqual(withdrawn.inventoryGoldDelta, 100);
    assert.strictEqual(withdrawn.guild.guilds[guildId].treasuryGold, 780);
  });
});

describe("mmo_guild_authority — guild hall and chat", function () {
  it("links a completed guild hall to guild services", function () {
    const { state, guildId } = createGuild();
    const linked = linkHarthmereGuildHallProperty({
      state,
      guildId,
      actorId: LEADER,
      propertyId: "property_grove_guild_green_lot",
      plotId: "grove_guild_green_lot",
      blueprintId: "grove_voxel_guild_hall_tier_1",
      nowMs: NOW_MS,
    });
    assert.ok(linked.changed);
    assert.strictEqual(linked.state.guilds[guildId].guildHall.status, "completed");
    assert.ok(linked.state.guilds[guildId].guildHall.servicesUnlocked.includes("guild_bank"));
  });

  it("sends chat, rejects long chat, supports mute, and blocks muted users", function () {
    let { state, guildId } = createGuild();
    state.guilds[guildId].members[APPLICANT] = {
      actorId: APPLICANT,
      rankId: "member",
      joinedAtMs: NOW_MS,
      lastSeenAtMs: NOW_MS,
      status: "active",
      contributionXp: 0,
    };
    const sent = mutate(state, APPLICANT, "send_chat", { guildId, message: "Anyone need iron ore?" });
    assert.strictEqual(sent.guild.guilds[guildId].chatMessages.length, 1);

    const tooLong = mutate(sent.guild, APPLICANT, "send_chat", { guildId, message: "x".repeat(501) });
    assert.ok(tooLong.warnings.includes("guild_rejected:chat_message_too_long"));

    const muted = mutate(sent.guild, LEADER, "mute_member", { guildId, targetActorId: APPLICANT, amountGold: 60_000 });
    const blocked = mutate(muted.guild, APPLICANT, "send_chat", { guildId, message: "Can anyone hear me?" });
    assert.ok(blocked.warnings.includes("guild_rejected:missing_permission:send_chat_or_muted"));
  });
});

describe("mmo_guild_authority — disband edge cases", function () {
  it("rejects disband with treasury or bank contents and allows clean leader disband", function () {
    const { state, guildId } = createGuild();
    const funded = mutate(state, LEADER, "treasury_deposit", { guildId, amountGold: 50 });
    const rejectTreasury = mutate(funded.guild, LEADER, "disband_guild", { guildId });
    assert.ok(rejectTreasury.warnings.includes("guild_rejected:guild_treasury_not_empty"));

    funded.guild.guilds[guildId].treasuryGold = 0;
    funded.guild.guilds[guildId].bank.items.iron_ore = 1;
    const rejectBank = mutate(funded.guild, LEADER, "disband_guild", { guildId });
    assert.ok(rejectBank.warnings.includes("guild_rejected:guild_bank_not_empty"));

    funded.guild.guilds[guildId].bank.items = {};
    const disbanded = mutate(funded.guild, LEADER, "disband_guild", { guildId });
    assert.strictEqual(disbanded.guild.guilds[guildId].disbandedAtMs, NOW_MS);
  });
});

describe("live_mode_backend — guild integration", function () {
  it("persists guild creation through request_guild_mutation and mirrors shared guild state keys", function () {
    const s = defaultHarthmereLiveModeBackendState(LEADER, NOW_MS);
    s.inventory.gold = 1_000;
    s.classMagic.skills.character_level = { xp: 0, level: HARTHMERE_GUILD_CREATION_MIN_LEVEL };
    const { state, summary } = applyLive(s, "request_guild_mutation", LEADER, {
      operation: "create_guild",
      name: "Live Lanterns",
      tag: "LL",
      recruitment: "open",
    });
    assert.strictEqual(state.inventory.gold, 750);
    assert.ok(state.guild.guildId);
    assert.ok(summary.sharedStateKeys.some((key) => key.includes("guild_ll_1")));
    assert.ok(summary.touchedModels.includes("guild_created"));
  });

  it("moves real inventory into guild bank through the live backend", function () {
    let s = defaultHarthmereLiveModeBackendState(LEADER, NOW_MS);
    s.inventory.gold = 1_000;
    s.inventory.items.iron_ore = 5;
    s.classMagic.skills.character_level = { xp: 0, level: HARTHMERE_GUILD_CREATION_MIN_LEVEL };
    s = applyLive(s, "request_guild_mutation", LEADER, {
      operation: "create_guild",
      name: "Bank Lanterns",
      tag: "BL",
    }).state;
    const guildId = s.guild.guildId!;
    const deposited = applyLive(s, "request_guild_mutation", LEADER, {
      operation: "guild_bank_deposit",
      guildId,
      itemId: "iron_ore",
      count: 3,
      itemGoldValue: 15,
    });
    assert.strictEqual(deposited.state.inventory.items.iron_ore, 2);
    assert.strictEqual(deposited.state.guild.guilds[guildId].bank.items.iron_ore, 3);
  });

  it("links guild hall completion from the existing building system", function () {
    let s = defaultHarthmereLiveModeBackendState(LEADER, NOW_MS);
    s.inventory.gold = 10_000;
    s.classMagic.skills.character_level = { xp: 0, level: HARTHMERE_GUILD_CREATION_MIN_LEVEL };
    s = applyLive(s, "request_guild_mutation", LEADER, {
      operation: "create_guild",
      name: "Hall Lanterns",
      tag: "HL",
    }).state;
    const guildId = s.guild.guildId!;
    s.building.ownedPlots.push("grove_guild_green_lot");
    const placed = applyLive(s, "request_property_building_mutation", LEADER, {
      subAction: "place",
      plotId: "grove_guild_green_lot",
      blueprintId: "grove_voxel_guild_hall_tier_1",
      propertyId: "property_grove_guild_green_lot",
    });
    assert.strictEqual(placed.state.guild.guilds[guildId].guildHall.status, "completed");
    assert.ok(placed.summary.touchedModels.includes("guild_hall"));
  });

  it("rejects a solo leader leaving while the treasury still holds gold (no orphaned funds)", () => {
    const { state, guildId } = createGuild();
    state.guilds[guildId].treasuryGold = 500;
    const blocked = mutate(state, LEADER, "leave_guild", { guildId });
    assert.ok(blocked.warnings.includes("guild_rejected:leader_must_empty_before_leaving"), blocked.warnings.join(","));
    assert.ok(!blocked.guild.guilds[guildId].disbandedAtMs, "guild must not disband while holding assets");
    // Once emptied, the leader can leave and the guild disbands cleanly.
    state.guilds[guildId].treasuryGold = 0;
    const ok = mutate(state, LEADER, "leave_guild", { guildId });
    assert.deepStrictEqual(ok.warnings, []);
    assert.ok(ok.guild.guilds[guildId].disbandedAtMs);
  });

  it("rejects guild tax collection by a non-member even with a server-trusted tax flag", () => {
    const { state, guildId } = createGuild();
    const result = mutate(
      state,
      "outsider_not_in_guild",
      "collect_tax",
      { guildId, amountGold: 1000 },
      ctx({ trustedTaxCollection: true }),
    );
    assert.ok(result.warnings.includes("guild_rejected:tax_collector_not_a_member"), result.warnings.join(","));
    assert.strictEqual(result.guild.guilds[guildId].treasuryGold, 0, "an outsider must not credit the treasury");
  });

  it("rejects open-recruitment joins once the guild hits the member cap", () => {
    const { state, guildId } = createGuild();
    const guild = state.guilds[guildId];
    guild.recruitment = "open";
    // Leader counts as one active member; fill the rest to the cap.
    for (let i = 0; i < HARTHMERE_GUILD_MAX_MEMBERS - 1; i++) {
      guild.members[`filler_${i}`] = {
        actorId: `filler_${i}`,
        displayName: `Filler ${i}`,
        rankId: "member",
        joinedAtMs: NOW_MS,
        lastSeenAtMs: NOW_MS,
        status: "active",
        contributionXp: 0,
      } as (typeof guild.members)[string];
    }
    const blocked = mutate(state, "late_joiner", "apply_to_guild", { guildId, displayName: "Latecomer" });
    assert.ok(blocked.warnings.includes("guild_rejected:guild_member_cap_reached"), blocked.warnings.join(","));
  });
});
