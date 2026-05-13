import {
  performHarthmereCombatAttack,
  readHarthmereCombatState,
  resetHarthmereCombat,
  type HarthmerePlayerAttackType,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  readHarthmereInventoryState,
  writeHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { getHarthmereLevelSummary } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import React, { useEffect, useMemo, useState } from "react";

const HARTHMERE_MULTIPLAYER_COMBAT_STATE_KEY =
  "biomes.localDev.harthmere.multiplayerCombatState.v1";
const HARTHMERE_MULTIPLAYER_COMBAT_EVENT =
  "biomes:harthmere-multiplayer-combat-changed";

const TARGETS = [
  { offset: 9001, label: "Training Dummy", kind: "safe" },
  { offset: 9003, label: "Road Bandit", kind: "hostile" },
  { offset: 9004, label: "Road Wolf", kind: "hostile" },
  { offset: 9002, label: "Drain Rat", kind: "hostile" },
];

type PvpFlag =
  | "unflagged"
  | "voluntary_pvp"
  | "duel_flagged"
  | "arena_flagged"
  | "battleground_flagged"
  | "criminal_flagged"
  | "bounty_target"
  | "spawn_protected";

type CombatRelationship =
  | "friendly"
  | "neutral"
  | "hostile"
  | "party_member"
  | "raid_member"
  | "duel_opponent"
  | "criminal_target"
  | "bounty_target";

type GroupRole = "tank" | "healer" | "damage" | "support" | "controller";

type MultiplayerMode =
  | "solo"
  | "party"
  | "raid"
  | "duel"
  | "public_event"
  | "battleground";

interface MultiplayerCombatLogEntry {
  id: string;
  at: number;
  label: string;
  detail: string;
}

interface MultiplayerPartyMember {
  id: string;
  name: string;
  role: GroupRole;
  level: number;
  hpPercent: number;
  relationship: CombatRelationship;
  ready: boolean;
  connected: boolean;
}

interface MultiplayerContribution {
  damage: number;
  healing: number;
  shielding: number;
  objectives: number;
  revives: number;
  crowdControl: number;
}

interface HarthmereMultiplayerCombatState {
  version: 1;
  weaponDrawn: boolean;
  pvpFlag: PvpFlag;
  mode: MultiplayerMode;
  role: GroupRole;
  currentTargetOffset?: number;
  currentTargetLabel?: string;
  safeZone: boolean;
  aggressionUntil?: number;
  protectedUntil?: number;
  mana: number;
  maxMana: number;
  comboWindowUntil?: number;
  readyCheckUntil?: number;
  pullTimerUntil?: number;
  party: MultiplayerPartyMember[];
  raidSize: number;
  contribution: MultiplayerContribution;
  cooldowns: Partial<Record<HarthmerePlayerAttackType | "draw" | "sheathe", number>>;
  recent: MultiplayerCombatLogEntry[];
}

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function now() {
  return Date.now();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function event() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(HARTHMERE_MULTIPLAYER_COMBAT_EVENT));
}

function logEntry(label: string, detail: string): MultiplayerCombatLogEntry {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    at: Date.now(),
    label,
    detail,
  };
}

function defaultParty(): MultiplayerPartyMember[] {
  return [
    {
      id: "hm-party-tank",
      name: "Sergeant Bram Holt",
      role: "tank",
      level: 15,
      hpPercent: 1,
      relationship: "party_member",
      ready: false,
      connected: true,
    },
    {
      id: "hm-party-healer",
      name: "Sister Maelle",
      role: "healer",
      level: 12,
      hpPercent: 0.92,
      relationship: "party_member",
      ready: false,
      connected: true,
    },
    {
      id: "hm-party-support",
      name: "Edrin Starling",
      role: "support",
      level: 11,
      hpPercent: 0.86,
      relationship: "party_member",
      ready: false,
      connected: true,
    },
  ];
}

function defaultState(): HarthmereMultiplayerCombatState {
  const level = getHarthmereLevelSummary();
  return {
    version: 1,
    weaponDrawn: false,
    pvpFlag: "unflagged",
    mode: "solo",
    role: "damage",
    currentTargetOffset: 9001,
    currentTargetLabel: "Training Dummy",
    safeZone: true,
    mana: level.derived.maxMana,
    maxMana: level.derived.maxMana,
    party: defaultParty(),
    raidSize: 0,
    contribution: {
      damage: 0,
      healing: 0,
      shielding: 0,
      objectives: 0,
      revives: 0,
      crowdControl: 0,
    },
    cooldowns: {},
    recent: [
      logEntry(
        "Controls Ready",
        "Press X to draw or sheathe, Tab to cycle target, F for attack, R for heavy attack, and Q for Spark.",
      ),
    ],
  };
}

function normalizeState(
  raw: Partial<HarthmereMultiplayerCombatState> | undefined,
): HarthmereMultiplayerCombatState {
  const fallback = defaultState();
  const maxMana = getHarthmereLevelSummary().derived.maxMana;
  const merged = { ...fallback, ...(raw ?? {}) };
  const currentTarget = TARGETS.find(
    (target) => target.offset === merged.currentTargetOffset,
  );
  return {
    ...merged,
    version: 1,
    currentTargetOffset: currentTarget?.offset ?? fallback.currentTargetOffset,
    currentTargetLabel: currentTarget?.label ?? fallback.currentTargetLabel,
    maxMana,
    mana: clamp(Number(merged.mana ?? maxMana), 0, maxMana),
    party: (merged.party?.length ? merged.party : fallback.party).slice(0, 40),
    contribution: {
      ...fallback.contribution,
      ...(merged.contribution ?? {}),
    },
    cooldowns: merged.cooldowns ?? {},
    recent: (merged.recent ?? fallback.recent).slice(0, 16),
  };
}

export function readHarthmereMultiplayerCombatState(): HarthmereMultiplayerCombatState {
  if (!isBrowser()) {
    return normalizeState(undefined);
  }
  try {
    const raw = window.localStorage.getItem(
      HARTHMERE_MULTIPLAYER_COMBAT_STATE_KEY,
    );
    if (!raw) {
      return normalizeState(undefined);
    }
    return normalizeState(
      JSON.parse(raw) as Partial<HarthmereMultiplayerCombatState>,
    );
  } catch {
    return normalizeState(undefined);
  }
}

function writeHarthmereMultiplayerCombatState(
  state: HarthmereMultiplayerCombatState,
) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_MULTIPLAYER_COMBAT_STATE_KEY,
    JSON.stringify(normalizeState(state)),
  );
  event();
}

function appendLog(
  state: HarthmereMultiplayerCombatState,
  label: string,
  detail: string,
): HarthmereMultiplayerCombatState {
  return {
    ...state,
    recent: [logEntry(label, detail), ...state.recent].slice(0, 16),
  };
}

function cooldownReady(
  state: HarthmereMultiplayerCombatState,
  key: HarthmerePlayerAttackType | "draw" | "sheathe",
) {
  return (state.cooldowns[key] ?? 0) <= now();
}

function setCooldown(
  state: HarthmereMultiplayerCombatState,
  key: HarthmerePlayerAttackType | "draw" | "sheathe",
  seconds: number,
) {
  return {
    ...state,
    cooldowns: { ...state.cooldowns, [key]: now() + seconds * 1000 },
  };
}

function hasKnownSpell(spellId: string) {
  const inventory = readHarthmereInventoryState();
  return inventory.spellbook.knownSpells.some(
    (spell) => spell.spellId === spellId,
  );
}

function ensureStarterSparkKnown() {
  if (hasKnownSpell("spark_rank_1")) {
    return true;
  }
  const inventory = readHarthmereInventoryState();
  writeHarthmereInventoryState({
    ...inventory,
    spellbook: {
      ...inventory.spellbook,
      knownSpells: [
        ...inventory.spellbook.knownSpells,
        {
          spellId: "spark_rank_1",
          learnedAt: now(),
          source: "multiplayer combat starter cantrip",
          equippedSlot: "action_bar_1",
          runes: [],
        },
      ],
      activeSpellSlots: {
        ...inventory.spellbook.activeSpellSlots,
        slot_1: inventory.spellbook.activeSpellSlots.slot_1 ?? "spark_rank_1",
      },
    },
  });
  return true;
}

function isAggressor(state: HarthmereMultiplayerCombatState) {
  return Boolean(state.aggressionUntil && state.aggressionUntil > now());
}

export function toggleHarthmereWeaponDrawn() {
  let state = readHarthmereMultiplayerCombatState();
  if (!cooldownReady(state, state.weaponDrawn ? "sheathe" : "draw")) {
    writeHarthmereMultiplayerCombatState(
      appendLog(state, "Too Fast", "Wait a moment before changing weapon stance again."),
    );
    return;
  }
  state = setCooldown(state, state.weaponDrawn ? "sheathe" : "draw", 0.35);
  if (state.weaponDrawn) {
    writeHarthmereMultiplayerCombatState({
      ...appendLog(
        state,
        "Weapon Sheathed",
        "You put your weapon away. Services and normal town dialogue feel safer now.",
      ),
      weaponDrawn: false,
    });
  } else {
    writeHarthmereMultiplayerCombatState({
      ...appendLog(
        state,
        "Weapon Drawn",
        "You draw your weapon. Attacks are now available, but hostile actions can start aggression timers.",
      ),
      weaponDrawn: true,
    });
  }
}

export function setHarthmerePvpFlag(flag: PvpFlag) {
  const state = readHarthmereMultiplayerCombatState();
  const safeZoneDetail = state.safeZone
    ? " You are in a safe service area, so hostile PvP actions remain blocked until you leave or join a valid PvP mode."
    : "";
  writeHarthmereMultiplayerCombatState({
    ...appendLog(
      state,
      "PvP Flag Changed",
      `Your PvP flag is now ${flag.replaceAll("_", " ")}.${safeZoneDetail}`,
    ),
    pvpFlag: flag,
  });
}

export function cycleHarthmereCombatTarget() {
  const state = readHarthmereMultiplayerCombatState();
  const currentIndex = TARGETS.findIndex(
    (target) => target.offset === state.currentTargetOffset,
  );
  const nextTarget = TARGETS[(currentIndex + 1 + TARGETS.length) % TARGETS.length];
  writeHarthmereMultiplayerCombatState({
    ...appendLog(
      state,
      "Target Selected",
      `Current combat target: ${nextTarget.label}.`,
    ),
    currentTargetOffset: nextTarget.offset,
    currentTargetLabel: nextTarget.label,
  });
}

function afterHostileAction(
  state: HarthmereMultiplayerCombatState,
  label: string,
  detail: string,
  contribution: Partial<MultiplayerContribution>,
): HarthmereMultiplayerCombatState {
  const nextContribution = { ...state.contribution };
  for (const [key, value] of Object.entries(contribution) as [
    keyof MultiplayerContribution,
    number,
  ][]) {
    nextContribution[key] += value;
  }
  return {
    ...appendLog(state, label, detail),
    aggressionUntil: now() + 45_000,
    protectedUntil: undefined,
    contribution: nextContribution,
  };
}

export function performHarthmereKeyedAttack(attack: HarthmerePlayerAttackType) {
  let state = readHarthmereMultiplayerCombatState();
  const targetOffset = state.currentTargetOffset;
  if (!targetOffset) {
    writeHarthmereMultiplayerCombatState(
      appendLog(
        state,
        "No Target",
        "Press Tab to pick a local-dev combat target before attacking.",
      ),
    );
    return;
  }

  if (attack !== "spark" && !state.weaponDrawn) {
    writeHarthmereMultiplayerCombatState(
      appendLog(
        state,
        "Weapon Not Drawn",
        "Press X to draw your weapon before using F or R attacks.",
      ),
    );
    return;
  }

  if (state.safeZone && state.pvpFlag !== "duel_flagged" && targetOffset < 9000) {
    writeHarthmereMultiplayerCombatState(
      appendLog(
        state,
        "Safe Zone Blocked",
        "Safe zones block hostile player-versus-player actions and protected-service combat abuse.",
      ),
    );
    return;
  }

  if (!cooldownReady(state, attack)) {
    writeHarthmereMultiplayerCombatState(
      appendLog(state, "On Cooldown", `${attack} is not ready yet.`),
    );
    return;
  }

  if (attack === "spark") {
    if (!ensureStarterSparkKnown()) {
      writeHarthmereMultiplayerCombatState(
        appendLog(
          state,
          "Spell Unknown",
          "You need to learn Spark from a scroll or trainer before Q can cast it.",
        ),
      );
      return;
    }
    if (state.mana < 10) {
      writeHarthmereMultiplayerCombatState(
        appendLog(
          state,
          "Not Enough Mana",
          "Spark needs 10 mana. Rest, respawn, or wait for recovery before casting again.",
        ),
      );
      return;
    }
    state = { ...state, mana: Math.max(0, state.mana - 10) };
  }

  performHarthmereCombatAttack(targetOffset, attack);

  const cooldownSeconds = attack === "heavy" ? 2.8 : attack === "spark" ? 4 : 1.4;
  state = setCooldown(state, attack, cooldownSeconds);
  const attackLabel =
    attack === "spark"
      ? "Magic Attack"
      : attack === "heavy"
        ? "Heavy Attack"
        : "Basic Attack";
  const contribution =
    attack === "spark" ? { damage: 24, crowdControl: 3 } : { damage: attack === "heavy" ? 35 : 18 };
  writeHarthmereMultiplayerCombatState(
    afterHostileAction(
      state,
      attackLabel,
      `${attackLabel} sent to ${state.currentTargetLabel}. Credit is contribution-based, not last-hit based.`,
      contribution,
    ),
  );
}

export function simulateHarthmereAllySupport(kind: "heal" | "shield" | "revive") {
  const state = readHarthmereMultiplayerCombatState();
  const details = {
    heal: "You support nearby allies with a practical group heal. Meaningful healing counts toward contribution.",
    shield:
      "You shield the front line. Shielding contributes when it prevents real damage, not when spammed on full-health allies.",
    revive:
      "You attempt a party revive. Revives matter in open-world and dungeon-style group content, but can be interrupted in PvP.",
  };
  const contribution =
    kind === "heal"
      ? { healing: 42 }
      : kind === "shield"
        ? { shielding: 35 }
        : { revives: 1 };
  writeHarthmereMultiplayerCombatState(
    afterHostileAction(state, "Co-op Support", details[kind], contribution),
  );
}

export function setHarthmereMultiplayerMode(mode: MultiplayerMode) {
  const state = readHarthmereMultiplayerCombatState();
  const raidSize = mode === "raid" ? Math.max(10, state.raidSize || 10) : state.raidSize;
  writeHarthmereMultiplayerCombatState({
    ...appendLog(
      state,
      "Group Mode",
      `Combat mode changed to ${mode.replaceAll("_", " ")}. Rewards, revive rules, and contribution expectations now follow that mode.`,
    ),
    mode,
    raidSize,
  });
}

export function startHarthmereReadyCheck() {
  const state = readHarthmereMultiplayerCombatState();
  writeHarthmereMultiplayerCombatState({
    ...appendLog(
      state,
      "Ready Check",
      "Ready check started. Group members should confirm before a dungeon, raid, world boss, or PvP objective pull.",
    ),
    readyCheckUntil: now() + 30_000,
    party: state.party.map((member) => ({ ...member, ready: false })),
  });
}

export function markHarthmerePartyReady() {
  const state = readHarthmereMultiplayerCombatState();
  writeHarthmereMultiplayerCombatState({
    ...appendLog(
      state,
      "Ready",
      "You marked yourself ready. In production, every affected player would confirm their own readiness.",
    ),
    party: state.party.map((member, index) =>
      index === 0 ? { ...member, ready: true } : member,
    ),
  });
}

export function startHarthmerePullTimer() {
  const state = readHarthmereMultiplayerCombatState();
  writeHarthmereMultiplayerCombatState({
    ...appendLog(
      state,
      "Pull Timer",
      "Pull timer started: 10 seconds. This gives tanks, healers, damage dealers, and support players time to prepare.",
    ),
    pullTimerUntil: now() + 10_000,
  });
}

export function resetHarthmereMultiplayerCombat() {
  resetHarthmereCombat();
  writeHarthmereMultiplayerCombatState(defaultState());
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) {
    return false;
  }
  const tagName = el.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    el.isContentEditable
  );
}

function useHarthmereCombatHotkeys() {
  useEffect(() => {
    if (!isBrowser()) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isTypingTarget(event.target)) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "x") {
        event.preventDefault();
        toggleHarthmereWeaponDrawn();
      } else if (key === "tab") {
        event.preventDefault();
        cycleHarthmereCombatTarget();
      } else if (key === "f") {
        event.preventDefault();
        performHarthmereKeyedAttack("basic");
      } else if (key === "r") {
        event.preventDefault();
        performHarthmereKeyedAttack("heavy");
      } else if (key === "q") {
        event.preventDefault();
        performHarthmereKeyedAttack("spark");
      } else if (key === "v") {
        event.preventDefault();
        const state = readHarthmereMultiplayerCombatState();
        setHarthmerePvpFlag(
          state.pvpFlag === "voluntary_pvp" ? "unflagged" : "voluntary_pvp",
        );
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);
}

export function useHarthmereMultiplayerCombatState() {
  const [state, setState] = useState<HarthmereMultiplayerCombatState>(() =>
    readHarthmereMultiplayerCombatState(),
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereMultiplayerCombatState());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_MULTIPLAYER_COMBAT_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_MULTIPLAYER_COMBAT_EVENT, refresh);
    };
  }, []);

  return state;
}

function formatSeconds(deadline?: number) {
  if (!deadline) {
    return "—";
  }
  return `${Math.max(0, Math.ceil((deadline - now()) / 1000))}s`;
}

function pvpFlagLabel(flag: PvpFlag) {
  return flag.replaceAll("_", " ");
}

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2 text-[11px] text-white/75">
      <span>{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export const HarthmereMultiplayerCombatHUD: React.FunctionComponent<{}> = () => {
  useHarthmereCombatHotkeys();
  const state = useHarthmereMultiplayerCombatState();
  const combat = readHarthmereCombatState();
  const latest = state.recent[0];
  const activeTarget = useMemo(
    () =>
      TARGETS.find((target) => target.offset === state.currentTargetOffset) ??
      TARGETS[0],
    [state.currentTargetOffset],
  );

  return (
    <div
      className="pointer-events-none w-[22rem] rounded-lg border border-orange-300/30 bg-black/70 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-orange-200">
            Multiplayer Fighting
          </div>
          <div className="text-xs text-white/75">
            X draw/sheathe · Tab target · F attack · R heavy · Q Spark · V PvP
          </div>
        </div>
        <div className="rounded bg-orange-300/20 px-1.5 py-0.5 text-xs font-semibold text-orange-100">
          {state.weaponDrawn ? "Drawn" : "Sheathed"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-white/10 bg-white/5 p-2">
        <StatLine label="Mode" value={state.mode.replaceAll("_", " ")} />
        <StatLine label="PvP" value={pvpFlagLabel(state.pvpFlag)} />
        <StatLine label="Target" value={activeTarget.label} />
        <StatLine label="Mana" value={`${state.mana}/${state.maxMana}`} />
        <StatLine label="Aggression" value={formatSeconds(state.aggressionUntil)} />
        <StatLine label="Player HP" value={`${combat.player.hp}/${combat.player.maxHp}`} />
      </div>
      {latest && (
        <div className="mt-2 rounded border border-white/10 bg-white/5 p-1.5 text-[11px] leading-snug text-white/80">
          <span className="font-semibold text-white">{latest.label}:</span>{" "}
          {latest.detail}
        </div>
      )}
    </div>
  );
};

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export const HarthmereMultiplayerCombatMenuPanel: React.FunctionComponent<{}> = () => {
  const state = useHarthmereMultiplayerCombatState();
  const activeTarget =
    TARGETS.find((target) => target.offset === state.currentTargetOffset) ?? TARGETS[0];
  const partyReady = state.party.filter((member) => member.ready).length;
  const totalContribution =
    state.contribution.damage +
    state.contribution.healing +
    state.contribution.shielding +
    state.contribution.objectives +
    state.contribution.revives * 50 +
    state.contribution.crowdControl;

  return (
    <div className="pointer-events-auto mt-2 max-h-[55vh] w-[30rem] overflow-y-auto rounded-lg border border-orange-300/25 bg-black/75 p-3 text-white shadow-xl">
      <div className="mb-2">
        <div className="text-base font-bold text-orange-200">
          Harthmere Multiplayer Fighting
        </div>
        <div className="text-xs text-white/75">
          Local-dev controls and multiplayer combat rules for PvP, parties,
          raids, public events, contribution, safe zones, and grief prevention.
        </div>
      </div>

      <div className="mb-2 rounded border border-white/10 bg-white/5 p-2">
        <div className="mb-1 text-xs font-semibold text-white">Keyboard</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-white/75">
          <div><span className="font-semibold text-white">X</span> draw / put away weapon</div>
          <div><span className="font-semibold text-white">Tab</span> cycle target</div>
          <div><span className="font-semibold text-white">F</span> basic weapon attack</div>
          <div><span className="font-semibold text-white">R</span> heavy weapon attack</div>
          <div><span className="font-semibold text-white">Q</span> Spark magic attack</div>
          <div><span className="font-semibold text-white">V</span> toggle voluntary PvP</div>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 rounded border border-white/10 bg-white/5 p-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-white">Combat State</div>
          <StatLine label="Weapon" value={state.weaponDrawn ? "drawn" : "sheathed"} />
          <StatLine label="Target" value={activeTarget.label} />
          <StatLine label="Mode" value={state.mode.replaceAll("_", " ")} />
          <StatLine label="Role" value={state.role} />
          <StatLine label="Mana" value={`${state.mana}/${state.maxMana}`} />
          <StatLine label="Safe zone" value={state.safeZone ? "yes" : "no"} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-white">PvP / Group</div>
          <StatLine label="PvP flag" value={pvpFlagLabel(state.pvpFlag)} />
          <StatLine label="Aggression" value={formatSeconds(state.aggressionUntil)} />
          <StatLine label="Party ready" value={`${partyReady}/${state.party.length}`} />
          <StatLine label="Raid size" value={state.raidSize || "—"} />
          <StatLine label="Pull timer" value={formatSeconds(state.pullTimerUntil)} />
          <StatLine label="Contribution" value={totalContribution} />
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <ActionButton onClick={() => toggleHarthmereWeaponDrawn()}>
          {state.weaponDrawn ? "Put Weapon Away" : "Draw Weapon"}
        </ActionButton>
        <ActionButton onClick={() => cycleHarthmereCombatTarget()}>
          Cycle Target
        </ActionButton>
        <ActionButton onClick={() => performHarthmereKeyedAttack("basic")}>
          Basic Attack
        </ActionButton>
        <ActionButton onClick={() => performHarthmereKeyedAttack("heavy")}>
          Heavy Attack
        </ActionButton>
        <ActionButton onClick={() => performHarthmereKeyedAttack("spark")}>
          Cast Spark
        </ActionButton>
        <ActionButton
          onClick={() =>
            setHarthmerePvpFlag(
              state.pvpFlag === "voluntary_pvp" ? "unflagged" : "voluntary_pvp",
            )
          }
        >
          Toggle PvP Flag
        </ActionButton>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <ActionButton onClick={() => setHarthmereMultiplayerMode("party")}>
          Form Party
        </ActionButton>
        <ActionButton onClick={() => setHarthmereMultiplayerMode("raid")}>
          Form Raid
        </ActionButton>
        <ActionButton onClick={() => setHarthmereMultiplayerMode("public_event")}>
          Public Event
        </ActionButton>
        <ActionButton onClick={() => setHarthmereMultiplayerMode("duel")}>
          Duel Mode
        </ActionButton>
        <ActionButton onClick={() => startHarthmereReadyCheck()}>
          Ready Check
        </ActionButton>
        <ActionButton onClick={() => markHarthmerePartyReady()}>
          Mark Ready
        </ActionButton>
        <ActionButton onClick={() => startHarthmerePullTimer()}>
          Pull Timer
        </ActionButton>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <ActionButton onClick={() => simulateHarthmereAllySupport("heal")}>
          Heal Ally
        </ActionButton>
        <ActionButton onClick={() => simulateHarthmereAllySupport("shield")}>
          Shield Ally
        </ActionButton>
        <ActionButton onClick={() => simulateHarthmereAllySupport("revive")}>
          Revive Ally
        </ActionButton>
        <ActionButton onClick={() => resetHarthmereMultiplayerCombat()}>
          Reset Multiplayer Combat
        </ActionButton>
      </div>

      <div className="mb-2 rounded border border-white/10 bg-white/5 p-2 text-xs leading-snug text-white/75">
        <div className="mb-1 font-semibold text-white">Rules implemented</div>
        <div>
          Safe zones block surprise PvP, aggression timers prevent hit-and-hide
          abuse, contribution tracks damage/healing/shields/revives/objectives,
          party and raid tools include ready checks and pull timers, and rewards
          should be based on meaningful participation rather than last hit.
        </div>
      </div>

      <div className="space-y-1">
        {state.recent.slice(0, 8).map((entry) => (
          <div key={entry.id} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
            <div className="font-semibold text-white">{entry.label}</div>
            <div className="text-white/70">{entry.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
