export const HARTHMERE_COMBAT_INTERFACE_KEY_COPY_V1 = {
  draw: "X",
  target: "Tab",
  basic: "B",
  heavy: "H",
  spark: "L",
  pvp: "P",
} as const;

export type HarthmereInterfacePvpModeV1 =
  | "pve"
  | "duel"
  | "normal_pvp"
  | "hardcore_pvp";

export interface HarthmereInterfaceCombatantSnapshotV1 {
  hp?: number;
  maxHp?: number;
  combatState?: string;
}

export interface HarthmereMultiplayerInterfaceSnapshotV1 {
  safeZone?: boolean;
  pvpFlag?: string;
  mode?: string;
  protectedUntil?: number;
  currentTargetOffset?: number;
  currentTargetLabel?: string;
}

export interface HarthmereDeathInterfaceRecordSnapshotV1 {
  killerType?: string;
  killerName?: string;
  pvpMode?: HarthmereInterfacePvpModeV1;
  inventoryDropPolicy?: string;
  availableRespawns?: string[];
}

export interface HarthmereDeathInterfaceSnapshotV1 {
  state?: string;
  currentDeath?: HarthmereDeathInterfaceRecordSnapshotV1;
  protectionUntil?: number;
  resurrectionSicknessUntil?: number;
}

const BLOCKED_COMBAT_STATES = new Set([
  "dead",
  "downed",
  "respawning",
  "ghost",
  "permadead",
]);

const PROTECTED_COMBAT_STATES = new Set([
  "protected_after_respawn",
  "invulnerable",
]);

const RESPAWNABLE_DEATH_STATES = new Set(["downed", "dead", "ghost"]);

function secondsUntil(deadline: number | undefined, atMs: number) {
  if (!deadline) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadline - atMs) / 1000));
}

export function getHarthmereCombatantActionBlockReasonV1(
  combatant: HarthmereInterfaceCombatantSnapshotV1 | undefined,
  atMs = Date.now(),
) {
  const state = String(combatant?.combatState ?? "idle");
  if ((combatant?.hp ?? 1) <= 0 || BLOCKED_COMBAT_STATES.has(state)) {
    return "Revive or respawn before using combat actions.";
  }
  if (PROTECTED_COMBAT_STATES.has(state)) {
    return "Respawn protection is active. Wait for it to expire before attacking.";
  }
  void atMs;
  return undefined;
}

export function getHarthmereMultiplayerAttackDisabledReasonV1(
  attack: "basic" | "heavy" | "spark",
  state: HarthmereMultiplayerInterfaceSnapshotV1,
  combatant: HarthmereInterfaceCombatantSnapshotV1 | undefined,
  atMs = Date.now(),
) {
  const combatantBlock = getHarthmereCombatantActionBlockReasonV1(
    combatant,
    atMs,
  );
  if (combatantBlock) {
    return combatantBlock;
  }
  if (state.pvpFlag === "spawn_protected") {
    return "Spawn protection is active. Wait for it to expire before attacking.";
  }
  if (secondsUntil(state.protectedUntil, atMs) > 0) {
    return "Respawn protection is active. Wait for it to expire before attacking.";
  }
  if (attack === "spark" && state.currentTargetOffset === undefined) {
    return "Select a valid target before casting Spark.";
  }
  return undefined;
}

export function inferHarthmereInterfacePvpModeV1(
  state: HarthmereMultiplayerInterfaceSnapshotV1,
): HarthmereInterfacePvpModeV1 {
  if (state.mode === "duel" || state.pvpFlag === "duel_flagged") {
    return "duel";
  }
  if (state.pvpFlag === "hardcore_pvp") {
    return "hardcore_pvp";
  }
  if (
    [
      "voluntary_pvp",
      "arena_flagged",
      "battleground_flagged",
      "criminal_flagged",
      "bounty_target",
    ].includes(String(state.pvpFlag))
  ) {
    return "normal_pvp";
  }
  return "pve";
}

export function harthmerePvpRewardPolicySummaryV1(
  mode: HarthmereInterfacePvpModeV1,
) {
  switch (mode) {
    case "duel":
      return "Duel: ends at 1 HP, no item drop, no durability loss, no legal penalty.";
    case "normal_pvp":
      return "Normal PvP: no item drop; rewards come from meaningful participation and objectives.";
    case "hardcore_pvp":
      return "Hardcore PvP: only unbound trade goods and gathered resources may drop; bound, quest, spellbook, mount, pet, cosmetic, and keyring items are protected.";
    case "pve":
    default:
      return "PvE: normal combat credit, XP, loot, reputation, and economy rules apply.";
  }
}

export function describeHarthmereMultiplayerCombatInterfaceV1(
  state: HarthmereMultiplayerInterfaceSnapshotV1,
  combatant: HarthmereInterfaceCombatantSnapshotV1 | undefined,
  atMs = Date.now(),
) {
  const pvpMode = inferHarthmereInterfacePvpModeV1(state);
  const protectedSeconds = Math.max(
    secondsUntil(state.protectedUntil, atMs),
    state.pvpFlag === "spawn_protected" ? 1 : 0,
  );
  const attackDisabledReason = getHarthmereMultiplayerAttackDisabledReasonV1(
    "basic",
    state,
    combatant,
    atMs,
  );
  return {
    canUseHostileActions: !attackDisabledReason,
    attackDisabledReason,
    protectionSummary:
      protectedSeconds > 0
        ? `Protected for ${protectedSeconds}s; hostile actions are locked.`
        : "No respawn protection active.",
    pvpLegalitySummary: state.safeZone
      ? "Safe zone: PvP damage and hostile spells across the boundary are blocked."
      : pvpMode === "pve"
        ? "PvP off: NPC combat remains available."
        : "PvP active: combat follows consent, flag, contribution, and anti-abuse rules.",
    rewardPolicySummary: harthmerePvpRewardPolicySummaryV1(pvpMode),
    pvpMode,
  };
}

function deathRecordMode(
  record: HarthmereDeathInterfaceRecordSnapshotV1 | undefined,
): HarthmereInterfacePvpModeV1 {
  if (record?.pvpMode) {
    return record.pvpMode;
  }
  if (
    record?.inventoryDropPolicy ===
    "drop_only_unbound_trade_goods_and_gathered_resources"
  ) {
    return "hardcore_pvp";
  }
  if (record?.killerType === "player") {
    return "normal_pvp";
  }
  return "pve";
}

export function harthmereDeathPenaltySummaryV1(
  record: HarthmereDeathInterfaceRecordSnapshotV1 | undefined,
) {
  return harthmerePvpRewardPolicySummaryV1(deathRecordMode(record)).replace(
    "PvE: normal combat credit, XP, loot, reputation, and economy rules apply.",
    "PvE death: safe respawn, short recovery sickness, durability recovery, and no permanent item loss in local-dev.",
  );
}

export function harthmereRespawnDisabledReasonV1(
  death: HarthmereDeathInterfaceSnapshotV1,
  respawnId: string,
) {
  if (!RESPAWNABLE_DEATH_STATES.has(String(death.state))) {
    return "Respawn is only available while downed, dead, or ghosted.";
  }
  const availableRespawns = death.currentDeath?.availableRespawns ?? [];
  if (availableRespawns.length > 0 && !availableRespawns.includes(respawnId)) {
    return "This respawn point is not available for this death.";
  }
  return undefined;
}

export function harthmereReviveDisabledReasonV1(
  death: HarthmereDeathInterfaceSnapshotV1,
) {
  if (!["downed", "dead"].includes(String(death.state))) {
    return "Revive is only available while downed or dead.";
  }
  if (deathRecordMode(death.currentDeath) === "hardcore_pvp") {
    return "Revive is disabled by hardcore PvP death rules.";
  }
  return undefined;
}

export function harthmereReleaseDisabledReasonV1(
  death: HarthmereDeathInterfaceSnapshotV1,
) {
  if (death.state !== "downed") {
    return "Release is only available from the downed state.";
  }
  return undefined;
}

export function describeHarthmereDeathInterfaceV1(
  death: HarthmereDeathInterfaceSnapshotV1,
) {
  return {
    penaltySummary: harthmereDeathPenaltySummaryV1(death.currentDeath),
    reviveDisabledReason: harthmereReviveDisabledReasonV1(death),
    releaseDisabledReason: harthmereReleaseDisabledReasonV1(death),
    mode: deathRecordMode(death.currentDeath),
  };
}
