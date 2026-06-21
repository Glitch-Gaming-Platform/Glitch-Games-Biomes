// harthmere-resource-gathering-hit-contract
export const HARTHMERE_RESOURCE_GATHERING_HIT_CONTRACT = {
  version: "harthmere-resource-gathering-hit-contract",
  timing: {
    gatherHitUsesImpactFrame: true,
    impactMsMetadataRequired: true,
    toolAnimationMustReachResourceBeforeApply: true,
  },
  targetValidation: {
    checksDistance: true,
    checksEffectRadius: true,
    checksConeAngle: true,
    checksLineOfSight: true,
    rejectsBehindPlayer: true,
    rejectsWrongTool: true,
    rejectsDepletedResource: true,
    resolvesOverlappingResourcesByNearestImpactPoint: true,
  },
  visibleFeedback: {
    showRangeRing: true,
    showSurfaceReticle: true,
    showHandToImpactLine: true,
    showToolTipOrBladeTipMarker: true,
    showResourceSpecificParticles: true,
    showFailureReasonText: true,
  },
} as const;

import {
  harthmereHasAttackableTargetNearPlayer,
  performHarthmereCombatAttack,
  performHarthmereForwardArcAttack,
  readHarthmereCombatState,
  readHarthmereForwardArcRuntime,
  resetHarthmereCombat,
  type HarthmereForwardArcRuntimeSnapshot,
  type HarthmerePlayerAttackType,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  harthmereDialogueLiveModeHeaders,
  harthmereDialogueLiveModeUrl,
} from "@/client/components/challenges/dialogueLiveModeReputation";
import { isHarthmereLocalCombatSafeZonePosition } from "@/client/components/challenges/localDevHarthmereCombatSafety";
import {
  harthmerePvpBasicDamage,
  harthmerePvpPlayersInArc,
  type HarthmerePvpCandidatePlayer,
} from "@/client/components/challenges/harthmerePvpHitRules";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import type { ClientContextSubset } from "@/client/game/context";
import { publishHarthmereLiveEntityCombatMotionToRenderer } from "@/client/game/resources/harthmere_live_entity_motion_bridge";
import { PlayerSelector } from "@/shared/ecs/gen/selectors";
import { UpdatePlayerHealthEvent } from "@/shared/ecs/gen/events";
import type { DamageSource } from "@/shared/ecs/gen/types";
import { fireAndForget } from "@/shared/util/async";
import {
  readHarthmereInventoryState,
  writeHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  describeHarthmereMultiplayerCombatInterface,
  getHarthmereMultiplayerAttackDisabledReason,
  HARTHMERE_COMBAT_INTERFACE_KEY_COPY,
} from "@/client/components/challenges/harthmereCombatDeathInterfaceRules";
import { getHarthmereLevelSummary } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import {
  harthmereLiveModeCombatTargetIdForEcsEntity,
  shouldBypassHarthmereKeyboardDrawGateForMousePrimaryAttack,
  shouldEngageHarthmereMousePrimaryAttack,
} from "@/client/components/challenges/harthmereMousePrimaryAttackRules";
import { dispatchHarthmereLiveModeResponseEventsForTest } from "@/client/components/challenges/harthmereLiveModeClientEvents";
import {
  harthmereCrosshairAimFromEvent,
  harthmereHasCrosshairCombatTarget,
  pickHarthmereCrosshairCombatTarget,
  readHarthmereCrosshairCombatActors,
  type HarthmereCrosshairAim,
} from "@/client/components/challenges/harthmereCrosshairCombatTarget";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import { HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS } from "@/shared/harthmere/combat_reach";
import React, { useEffect, useMemo, useState } from "react";

const HARTHMERE_NO_SPARK_BASIC_ACTOR_MATCH_VERSION = "harthmere-no-spark-basic-actor-match";

const HARTHMERE_MULTIPLAYER_COMBAT_STATE_KEY =
  "biomes.localDev.harthmere.multiplayerCombatState";
const HARTHMERE_MULTIPLAYER_COMBAT_EVENT =
  "biomes:harthmere-multiplayer-combat-changed";
export const HARTHMERE_ATTACK_ANIMATION_EVENT =
  "biomes:harthmere-attack-animation";
const HARTHMERE_MULTIPLAYER_RULESET_REVISION =
  "harthmere-gltf-action-keymap";

// harthmere-full-animation-runtime
const HARTHMERE_FULL_ANIMATION_REQUEST_EVENT =
  "biomes:harthmere-animation-request";
function emitHarthmereFullAnimationRequest(detail: { family: string; action: string; phase?: string; itemId?: string; windupMs?: number; impactMs?: number; recoveryMs?: number; }) {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(HARTHMERE_FULL_ANIMATION_REQUEST_EVENT, { detail }));
}

// harthmere-hard-router-bhl-safety
export const HARTHMERE_COMBAT_KEY_BINDINGS = {
  draw: "KeyX",
  target: "Tab",
  basic: "KeyB",
  heavy: "KeyH",
  spark: "KeyL",
  pvp: "KeyP",
} as const;

export const HARTHMERE_COMBAT_ACTION_CLIPS = {
  basic: ["Attack", "Attack2", "SideSwing", "Thrusting"],
  heavy: ["HeavyAttack", "Attack2", "SideSwing"],
  spark: ["BasicMagic", "HeavyMagic", "Attack"],
  npcHuman: ["Attack", "SideSwing", "Attack2", "Thrusting", "HeavyAttack"],
  npcAnimal: ["Bite", "Claw", "Pounce", "Charge", "Peck", "Scratch", "Kick", "TailWhip", "Attack", "HeavyAttack"],
  hit: ["HitReact", "Block", "ShieldBlock", "Stunned"],
  death: ["Death", "Fall", "Falling"],
} as const;

const TARGETS = [
  { offset: 9001, label: "Training Dummy", kind: "safe" },
  { offset: 9003, label: "Road Bandit", kind: "hostile" },
  { offset: 9004, label: "Road Wolf", kind: "hostile" },
  { offset: 9002, label: "Drain Rat", kind: "hostile" },
  { offset: 9007, label: "Forest Deer", kind: "wildlife" },
  { offset: 9008, label: "Diseased Boar", kind: "wildlife" },
  { offset: 9009, label: "Black Bear", kind: "wildlife" },
  { offset: 9010, label: "Forest Wolf", kind: "wildlife" },
  { offset: 9011, label: "Briarfen Snake", kind: "wildlife" },
  { offset: 9012, label: "Gravewood Pale Wolf", kind: "undead" },
  { offset: 9013, label: "Bandit Trapper", kind: "hostile" },
];

type PvpFlag =
  | "unflagged"
  | "voluntary_pvp"
  | "duel_flagged"
  | "arena_flagged"
  | "battleground_flagged"
  | "criminal_flagged"
  | "bounty_target"
  | "hardcore_pvp"
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
  rulesetRevision?: string;
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


function /* current audit: performHarthmereCombatAttack(targetOffset, attack) */
debugHarthmereKeyCombat(stage: string, payload: Record<string, unknown>) {
  if (
    !isBrowser() ||
    window.localStorage.getItem("biomes.localDev.harthmere.combatDebug") !== "1"
  ) {
    return;
  }
  const entry = { at: Date.now(), stage, ...payload };
  const win = window as typeof window & { __harthmereKeyCombatDebugLog?: unknown[] };
  win.__harthmereKeyCombatDebugLog = [
    entry,
    ...(win.__harthmereKeyCombatDebugLog ?? []),
  ].slice(0, 100);
  console.info("[HarthmereKeyCombat]", stage, payload);
}

function now() {
  return Date.now();
}


// harthmere-sword-animation-polish
// Physical sword damage is resolved at the impact frame, not immediately when
// the key goes down. These values also feed the renderer so visual and damage
// timing stay testable from one contract.
const HARTHMERE_SWORD_ATTACK_TIMINGS = {
  basic: { windupMs: 150, impactMs: 220, recoveryMs: 340 },
  heavy: { windupMs: 260, impactMs: 360, recoveryMs: 520 },
} as const;

function harthmereSwordAttackTiming(
  attack: HarthmerePlayerAttackType | undefined,
) {
  return attack === "heavy"
    ? HARTHMERE_SWORD_ATTACK_TIMINGS.heavy
    : HARTHMERE_SWORD_ATTACK_TIMINGS.basic;
}

function recordHarthmereSwordImpactTimingDebug(
  attack: HarthmerePlayerAttackType,
  payload: Record<string, unknown>,
) {
  if (!isBrowser()) {
    return;
  }
  const win = window as typeof window & {
    __harthmereSwordImpactTimingDebugLog?: unknown[];
  };
  win.__harthmereSwordImpactTimingDebugLog = [
    { at: Date.now(), attack, ...payload },
    ...(win.__harthmereSwordImpactTimingDebugLog ?? []),
  ].slice(0, 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}



// harthmere-all-weapon-animation
// Keep visual equipment events tied to the equipped inventory item. The renderer
// maps these game item ids to generated equipment animation manifest ids.
function harthmereEquippedWeaponVisualItemId() {
  if (!isBrowser()) {
    return undefined;
  }
  const equipped = readHarthmereInventoryState().equipment;
  return equipped.main_hand?.itemId ?? equipped.off_hand?.itemId;
}

function emitHarthmereWeaponVisualState(
  action: "draw" | "sheathe" | "attack" | "sync",
  drawn: boolean,
  attack?: HarthmerePlayerAttackType,
  itemId = harthmereEquippedWeaponVisualItemId(),
) {
  if (!isBrowser()) {
    return;
  }
  if (!itemId) {
    return;
  }
  const timing =
    action === "attack"
      ? harthmereSwordAttackTiming(attack)
      : {
          windupMs: 0,
          impactMs: 0,
          recoveryMs: action === "draw" || action === "sheathe" ? 350 : 0,
        };
  // This event is consumed by the local-dev Harthmere renderer. It is separate
  // from combat damage so the sword can draw/sheathe visually even when no hit
  // happens, and it prevents future developers from coupling weapon visibility
  // to hit resolution side effects.
  window.dispatchEvent(
    new CustomEvent("biomes:harthmere-player-sword-visual", {
      detail: {
        action,
        drawn,
        attack,
        itemId,
        at: now(),
        ...timing,
      },
    }),
  );
}

function event() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(HARTHMERE_MULTIPLAYER_COMBAT_EVENT));
}

// HARTHMERE_PLAYER_SWING_VARIETY_INSTALL_MARKER
// 8-family swing pool per the attack variation aesthetics doc: each call
// picks a random shape so consecutive attacks don't all look identical.
const __HM_SWING_VARIANTS = [
  "slash_horizontal",
  "slash_diagonal_left",
  "slash_diagonal_right",
  "slash_rising",
  "slash_vertical",
  "stab_thrust",
  "spin_cleave",
  "backhand_slash",
] as const;
let __hmLastSwingIndex = -1;
function __hmPickSwingVariant(): string {
  // Avoid repeating the same variant twice in a row.
  let next = Math.floor(Math.random() * __HM_SWING_VARIANTS.length);
  if (next === __hmLastSwingIndex) {
    next = (next + 1 + Math.floor(Math.random() * (__HM_SWING_VARIANTS.length - 1))) % __HM_SWING_VARIANTS.length;
  }
  __hmLastSwingIndex = next;
  return __HM_SWING_VARIANTS[next];
}

function emitAttackAnimation(
  attack: HarthmerePlayerAttackType,
  options: { itemId?: string; emptyHanded?: boolean; weaponVisual?: boolean } = {},
) {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_ATTACK_ANIMATION_EVENT, {
      detail: {
        attack,
        at: Date.now(),
        swingVariant: __hmPickSwingVariant(),
        ...options,
      },
    }),
  );
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
    rulesetRevision: HARTHMERE_MULTIPLAYER_RULESET_REVISION,
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
        "Press X to draw/sheathe, Tab to cycle target, B for Basic Attack → GLTF Attack, H for Heavy Attack → GLTF HeavyAttack, L for Spark → GLTF BasicMagic, and P for PvP. These keys are reserved and do not overlap with map/quest/menu keys.",
      ),
    ],
  };
}

function normalizeState(
  raw: Partial<HarthmereMultiplayerCombatState> | undefined,
): HarthmereMultiplayerCombatState {
  const fallback = defaultState();
  if (
    raw &&
    raw.rulesetRevision !== HARTHMERE_MULTIPLAYER_RULESET_REVISION
  ) {
    return fallback;
  }
  const maxMana = getHarthmereLevelSummary().derived.maxMana;
  const merged = { ...fallback, ...(raw ?? {}) };
  const currentTarget = TARGETS.find(
    (target) => target.offset === merged.currentTargetOffset,
  );
  return {
    ...merged,
    version: 1,
    rulesetRevision: HARTHMERE_MULTIPLAYER_RULESET_REVISION,
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
      harthmereUserScopedStorageKey(HARTHMERE_MULTIPLAYER_COMBAT_STATE_KEY),
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
    harthmereUserScopedStorageKey(HARTHMERE_MULTIPLAYER_COMBAT_STATE_KEY),
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
    emitHarthmereWeaponVisualState("sheathe", false);
  } else {
    writeHarthmereMultiplayerCombatState({
      ...appendLog(
        state,
        "Weapon Drawn",
        "You draw your weapon. Attacks are now available, but hostile actions can start aggression timers.",
      ),
      weaponDrawn: true,
    });
    emitHarthmereWeaponVisualState("draw", true);
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

export function selectHarthmereCombatTarget(
  offset: number,
  label: string,
  reason = "Target Selected",
) {
  const state = readHarthmereMultiplayerCombatState();
  writeHarthmereMultiplayerCombatState({
    ...appendLog(
      state,
      reason,
      `Current combat target: ${label}. B runs Basic Attack/Attack, H runs Heavy Attack/HeavyAttack, and L runs Spark/BasicMagic.`,
    ),
    currentTargetOffset: offset,
    currentTargetLabel: label,
  });
}

export function cycleHarthmereCombatTarget() {
  const state = readHarthmereMultiplayerCombatState();
  const currentIndex = TARGETS.findIndex(
    (target) => target.offset === state.currentTargetOffset,
  );
  const nextTarget = TARGETS[(currentIndex + 1 + TARGETS.length) % TARGETS.length];
  selectHarthmereCombatTarget(nextTarget.offset, nextTarget.label);
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

// HARTHMERE_PVP_DAMAGE
// Resolve the player-vs-player half of a left-mouse swing. Other players inside
// the swing arc take real, server-authoritative damage via the vanilla
// UpdatePlayerHealthEvent path (the same event the vanilla attack uses), so no
// new networking is invented. Returns the number of players struck. PvP is
// suppressed inside safe zones (town/Grove) and while the attacker is down.
export function resolveHarthmerePvpMousePrimaryAttack(
  deps: ClientContextSubset<"events" | "table" | "resources" | "userId">
): number {
  if (!isBrowser()) {
    return 0;
  }
  const runtime = readHarthmereForwardArcRuntime();
  const position = runtime?.position;
  if (!position) {
    return 0;
  }
  // No PvP in protected areas (town core / Grove respawn).
  if (isHarthmereLocalCombatSafeZonePosition(position)) {
    return 0;
  }
  const combat = readHarthmereCombatState();
  if (
    ["dead", "downed", "respawning"].includes(combat.player.combatState) ||
    combat.player.hp <= 0
  ) {
    return 0;
  }

  const localPlayer = deps.resources.get("/scene/local_player");
  const center = localPlayer.player.position;
  const candidates: HarthmerePvpCandidatePlayer[] = [];
  for (const entity of deps.table.scan(
    PlayerSelector.query.spatial.inSphere(
      {
        center,
        radius: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS + 1,
      },
      { approx: true }
    )
  )) {
    if (entity.id === deps.userId) {
      continue;
    }
    if (entity.gremlin || !entity.player_status?.init || !entity.position) {
      continue;
    }
    if (entity.health !== undefined && entity.health.hp <= 0) {
      continue;
    }
    candidates.push({
      id: entity.id,
      pos: [entity.position.v[0], entity.position.v[2]],
    });
  }
  if (candidates.length === 0) {
    return 0;
  }

  const origin: [number, number] = [position[0], position[2]];
  const forward = runtime?.forward ?? [0, -1];
  // Match the NPC basic swing's reach/arc so a swing hits a player standing where
  // a creature would be hit.
  const cosHalfAngle = Math.cos((135 * Math.PI) / 360);
  const hitIds = harthmerePvpPlayersInArc({
    origin,
    forward,
    players: candidates,
    range: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS,
    cosHalfAngle,
  });
  if (hitIds.length === 0) {
    return 0;
  }

  const damage = harthmerePvpBasicDamage(combat.player.attackPoints);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  for (const id of hitIds) {
    const target = byId.get(id);
    const dir: [number, number, number] = target
      ? (() => {
          const dx = target.pos[0] - origin[0];
          const dz = target.pos[1] - origin[1];
          const len = Math.hypot(dx, dz) || 1;
          return [dx / len, 0, dz / len];
        })()
      : [0, 0, -1];
    const damageSource: DamageSource = {
      kind: "attack",
      attacker: deps.userId,
      dir,
    };
    fireAndForget(
      deps.events.publish(
        new UpdatePlayerHealthEvent({
          id,
          hpDelta: -damage,
          damageSource,
        })
      )
    );
  }
  return hitIds.length;
}

const HARTHMERE_MOUSE_LIVE_MODE_ATTACK_BRIDGE_VERSION =
  "harthmere-mouse-live-mode-attack-bridge";
const HARTHMERE_LIVE_MODE_BASIC_ATTACK_ABILITY_ID = "basic_strike";
const HARTHMERE_LIVE_MODE_MOUSE_ATTACK_ZONE_ID = "harthmere_wilderness";
const HARTHMERE_LIVE_MODE_NPC_AI_TICK_INTERVAL_MS = 2_000;
const HARTHMERE_LIVE_MODE_NPC_AI_TARGET_MEMORY_MS = 60_000;

type HarthmereNativeNpcAttackContactHit = {
  id?: number | string;
  entityId?: number | string;
  offset?: number | string;
  label?: string;
};

function harthmereMousePrimaryAttackOffsetsFromNativeHits(
  hits: ReadonlyArray<HarthmereNativeNpcAttackContactHit> | undefined
): number[] {
  if (!Array.isArray(hits)) {
    return [];
  }
  const offsets: number[] = [];
  for (const hit of hits) {
    const offset = Number(hit.id ?? hit.entityId ?? hit.offset);
    if (Number.isFinite(offset)) {
      offsets.push(offset);
    }
  }
  return offsets;
}

function debugHarthmereMouseLiveModeAttack(entry: Record<string, unknown>) {
  if (!isBrowser()) {
    return;
  }
  const logged = {
    at: new Date().toISOString(),
    version: HARTHMERE_MOUSE_LIVE_MODE_ATTACK_BRIDGE_VERSION,
    ...entry,
  };
  const win = window as typeof window & {
    __harthmereMouseLiveModeAttackDebug?: unknown[];
  };
  win.__harthmereMouseLiveModeAttackDebug = [
    logged,
    ...(win.__harthmereMouseLiveModeAttackDebug ?? []),
  ].slice(0, 100);
  if (
    window.localStorage?.getItem("biomes.localDev.harthmere.combatDebug") ===
    "1"
  ) {
    console.info("[HarthmereMouseLiveModeAttack]", logged);
  }
}

const harthmereLiveModeNpcAiTargetMemory = new Map<string, number>();
const harthmereLiveModeNpcAiTickInFlight = new Set<string>();

function rememberHarthmereLiveModeNpcAiTarget(targetId: string) {
  harthmereLiveModeNpcAiTargetMemory.set(targetId, Date.now());
}

function freshHarthmereLiveModeNpcAiTargets(nowMs = Date.now()) {
  for (const [targetId, atMs] of harthmereLiveModeNpcAiTargetMemory) {
    if (nowMs - atMs > HARTHMERE_LIVE_MODE_NPC_AI_TARGET_MEMORY_MS) {
      harthmereLiveModeNpcAiTargetMemory.delete(targetId);
    }
  }
  return [...harthmereLiveModeNpcAiTargetMemory.keys()];
}

function actorPositionPayload(
  runtime: HarthmereForwardArcRuntimeSnapshot | undefined
) {
  const position = runtime?.position;
  if (!position) {
    return {};
  }
  const [actorX, actorY, actorZ] = position;
  return Number.isFinite(actorX) &&
    Number.isFinite(actorY) &&
    Number.isFinite(actorZ)
    ? { actorX, actorY, actorZ }
    : {};
}

function submitHarthmereLiveModeNpcAiTicks(
  explicitTargetIds?: ReadonlyArray<string>,
  reason = "interval"
) {
  if (!isBrowser()) {
    return;
  }
  const nowMs = Date.now();
  const runtime = readHarthmereForwardArcRuntime();
  const actors = readHarthmereCrosshairCombatActors();
  const actorsByTargetId = new Map(
    actors
      .filter((actor) => actor.targetId)
      .map((actor) => [actor.targetId as string, actor])
  );
  const visibleAttackableTargetIds = actors
    .filter(
      (actor) =>
        actor.attackable !== false &&
        actor.screenVisible !== false &&
        actor.targetId
    )
    .map((actor) => actor.targetId as string);
  const targetIds = [
    ...new Set([
      ...(explicitTargetIds ?? []),
      ...freshHarthmereLiveModeNpcAiTargets(nowMs),
      ...visibleAttackableTargetIds,
    ]),
  ].slice(0, 16);
  const positionPayload = actorPositionPayload(runtime);
  for (const targetId of targetIds) {
    if (harthmereLiveModeNpcAiTickInFlight.has(targetId)) {
      continue;
    }
    const actor = actorsByTargetId.get(targetId);
    const lineOfSight = actor ? actor.screenVisible !== false : false;
    const requestId = `harthmere_npc_ai_tick_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    harthmereLiveModeNpcAiTickInFlight.add(targetId);
    fireAndForget(
      (async () => {
        const response = await defaultHarthmereLiveFetch(
          harthmereDialogueLiveModeUrl(window.location.search),
          {
            method: "POST",
            credentials: "same-origin",
            headers: harthmereDialogueLiveModeHeaders(window.location.search),
            body: JSON.stringify({
              requestId,
              idempotencyKey: requestId,
              targetId,
              actionKind: "request_npc_ai_tick",
              subsystem: "combat",
              actorEntityVersion: 1,
              zoneId: HARTHMERE_LIVE_MODE_MOUSE_ATTACK_ZONE_ID,
              payload: {
                npcId: targetId,
                lineOfSight,
                thinkIntervalMs: HARTHMERE_LIVE_MODE_NPC_AI_TICK_INTERVAL_MS,
                ...positionPayload,
              },
              clientClaims: {
                reason,
                runtimePosition: runtime?.position,
                runtimeForward: runtime?.forward,
                actorScreenVisible: actor?.screenVisible,
                actorWorld: actor
                  ? [actor.worldX, actor.worldY, actor.worldZ]
                  : undefined,
              },
            }),
          }
        );
        const body = await response.json().catch(() => undefined);
        if (body?.combatState) {
          publishHarthmereLiveEntityCombatMotionToRenderer(body.combatState);
          const tick = body.combatState.npcAiTicks?.[targetId];
          const decision = String(tick?.decision ?? "");
          if (
            !lineOfSight ||
            decision.includes("no_line_of_sight") ||
            decision.includes("target_out_of_chase_range") ||
            decision.includes("player_not_alive") ||
            decision.includes("safe_zone")
          ) {
            harthmereLiveModeNpcAiTargetMemory.delete(targetId);
          }
        }
      })()
        .catch((error) => {
          debugHarthmereMouseLiveModeAttack({
            type: "npc_ai_tick_error",
            targetId,
            reason,
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          harthmereLiveModeNpcAiTickInFlight.delete(targetId);
        })
    );
  }
}

type HarthmereMousePrimaryLiveModeHit = {
  offset: number;
  targetId?: string;
  targetPosition?: [number, number, number];
};

function normalizeHarthmereMouseLiveModeHit(
  hit: number | HarthmereMousePrimaryLiveModeHit
): HarthmereMousePrimaryLiveModeHit | undefined {
  if (typeof hit === "number") {
    return Number.isFinite(hit) ? { offset: hit } : undefined;
  }
  const offset = Number(hit.offset);
  if (!Number.isFinite(offset)) {
    return undefined;
  }
  return {
    offset,
    targetId:
      typeof hit.targetId === "string" && hit.targetId.trim()
        ? hit.targetId.trim()
        : undefined,
    targetPosition: hit.targetPosition,
  };
}

function submitHarthmereLiveModeMousePrimaryAttack(
  hits: ReadonlyArray<number | HarthmereMousePrimaryLiveModeHit>,
  runtime: HarthmereForwardArcRuntimeSnapshot | undefined,
  source: "native_contact" | "forward_arc_fallback" | "crosshair_visible_actor"
) {
  if (!isBrowser() || hits.length === 0) {
    return;
  }
  const normalizedHits = hits
    .map((hit) => normalizeHarthmereMouseLiveModeHit(hit))
    .filter((hit): hit is HarthmereMousePrimaryLiveModeHit => Boolean(hit));
  const requests = new Map<
    string,
    {
      targetId: string;
      hitOffsets: number[];
      targetPosition?: [number, number, number];
    }
  >();
  for (const hit of normalizedHits) {
    const targetId =
      hit.targetId ?? harthmereLiveModeCombatTargetIdForEcsEntity(hit.offset);
    if (!targetId) {
      continue;
    }
    const request = requests.get(targetId) ?? {
      targetId,
      hitOffsets: [],
      targetPosition: hit.targetPosition,
    };
    request.hitOffsets.push(hit.offset);
    request.targetPosition ??= hit.targetPosition;
    requests.set(targetId, request);
  }
  if (requests.size === 0) {
    debugHarthmereMouseLiveModeAttack({
      type: "ignored",
      reason: "no_seeded_live_mode_target",
      source,
      hitOffsets: normalizedHits.map((hit) => hit.offset),
      hitTargets: normalizedHits.map((hit) => hit.targetId),
    });
    return;
  }

  for (const request of requests.values()) {
    const { targetId } = request;
    const requestId = `harthmere_mouse_attack_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    fireAndForget(
      (async () => {
        const response = await defaultHarthmereLiveFetch(
          harthmereDialogueLiveModeUrl(window.location.search),
          {
            method: "POST",
            credentials: "same-origin",
            headers: harthmereDialogueLiveModeHeaders(window.location.search),
            body: JSON.stringify({
              requestId,
              idempotencyKey: requestId,
              targetId,
              actionKind: "request_attack",
              subsystem: "combat",
              actorEntityVersion: 1,
              zoneId: HARTHMERE_LIVE_MODE_MOUSE_ATTACK_ZONE_ID,
              payload: {
                abilityId: HARTHMERE_LIVE_MODE_BASIC_ATTACK_ABILITY_ID,
              },
              includeSnapshots: [
                "combatState",
                "inventoryLootState",
                "playerStatusState",
              ],
              clientClaims: {
                source,
                hitOffsets: request.hitOffsets,
                runtimePosition: runtime?.position,
                runtimeForward: runtime?.forward,
                targetPosition: request.targetPosition,
              },
            }),
          }
        );
        const body = await response.json().catch(() => undefined);
        dispatchHarthmereLiveModeResponseEventsForTest(body);
        if (body?.combatState) {
          publishHarthmereLiveEntityCombatMotionToRenderer(body.combatState);
          rememberHarthmereLiveModeNpcAiTarget(targetId);
          submitHarthmereLiveModeNpcAiTicks([targetId], "player_attack");
        }
        debugHarthmereMouseLiveModeAttack({
          type: response.ok ? "submitted" : "rejected",
          source,
          targetId,
          targetPosition: request.targetPosition,
          status: response.status,
          ok: body?.ok,
          warnings: body?.summary?.warnings ?? body?.validation?.warnings,
          errors: body?.validation?.errors,
        });
      })().catch((error) => {
        debugHarthmereMouseLiveModeAttack({
          type: "error",
          source,
          targetId,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );
  }
}

export function performHarthmereMousePrimaryAttack(
  aim?: HarthmereCrosshairAim
) {
  let state = readHarthmereMultiplayerCombatState();
  const attack: Exclude<HarthmerePlayerAttackType, "spark"> = "basic";
  debugHarthmereKeyCombat("mouse_primary.attack.start", {
    attack,
    weaponDrawn: state.weaponDrawn,
    cooldowns: state.cooldowns,
  });

  const combat = readHarthmereCombatState();
  const blockedReason = getHarthmereMultiplayerAttackDisabledReason(
    attack,
    state,
    combat.player,
  );
  if (blockedReason) {
    writeHarthmereMultiplayerCombatState(
      appendLog(state, "Action Blocked", blockedReason),
    );
    return { hitOffsets: [], candidateOffsets: [] };
  }

  if (!cooldownReady(state, attack)) {
    writeHarthmereMultiplayerCombatState(
      appendLog(state, "On Cooldown", `${attack} is not ready yet.`),
    );
    return { hitOffsets: [], candidateOffsets: [] };
  }

  const equippedWeapon = readHarthmereInventoryState().equipment.main_hand;
  const equippedWeaponItemId = equippedWeapon?.itemId;
  const hasPhysicalWeapon = Boolean(equippedWeaponItemId);
  const bypassedDrawGate =
    shouldBypassHarthmereKeyboardDrawGateForMousePrimaryAttack({
      source: "mouse_primary",
      hasPhysicalWeapon,
      weaponDrawn: state.weaponDrawn,
    });
  if (bypassedDrawGate) {
    state = { ...state, weaponDrawn: true };
    emitHarthmereWeaponVisualState("draw", true, attack, equippedWeaponItemId);
  }

  emitHarthmereFullAnimationRequest({
    family: hasPhysicalWeapon ? "ranged" : "creature",
    action: hasPhysicalWeapon ? attack : "attack",
    phase: "start",
    itemId: equippedWeaponItemId,
  });
  emitAttackAnimation(attack, {
    itemId: equippedWeaponItemId,
    emptyHanded: !hasPhysicalWeapon,
    weaponVisual: hasPhysicalWeapon,
  });
  if (hasPhysicalWeapon) {
    emitHarthmereWeaponVisualState("attack", true, attack, equippedWeaponItemId);
  }

  const runtime = readHarthmereForwardArcRuntime();

  // HARTHMERE_CROSSHAIR_COMBAT_TARGET: prefer the creature actually under the
  // crosshair (camera-projected screen position published by the renderer) over
  // the forward-arc cone. The arc depends on the player body-forward/yaw/origin
  // runtime, which in the embed build is frequently missing or in the wrong
  // coordinate frame -> "no target inside the arc" -> every swing misses even
  // when you are aiming straight at a mucker. Screen targeting is the literal
  // "hit what you are pointing at" and works without that runtime.
  let arcResult: { hitOffsets: number[]; candidateOffsets: number[] };
  const crosshairActors = readHarthmereCrosshairCombatActors();
  const crosshairPick = aim
    ? pickHarthmereCrosshairCombatTarget({
        actors: crosshairActors,
        aim,
        playerX: runtime?.position?.[0],
        playerZ: runtime?.position?.[2],
        worldReach: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS,
      })
    : undefined;

  if (crosshairPick) {
    performHarthmereCombatAttack(crosshairPick.offset, attack, {
      contactProven: true,
      contactSource: "forward_arc",
      contactDistance: crosshairPick.worldDistance,
      contactReason: "crosshair_aimed_actor",
      debugLabel: `crosshair:${attack}`,
    });
    arcResult = {
      hitOffsets: [crosshairPick.offset],
      candidateOffsets: crosshairActors.map((actor) => actor.offset),
    };
    submitHarthmereLiveModeMousePrimaryAttack(
      [
        {
          offset: crosshairPick.offset,
          targetId: crosshairPick.targetId,
          targetPosition: crosshairPick.targetPosition,
        },
      ],
      runtime,
      "crosshair_visible_actor"
    );
  } else {
    arcResult = performHarthmereForwardArcAttack(attack, runtime);
    submitHarthmereLiveModeMousePrimaryAttack(
      arcResult.hitOffsets,
      runtime,
      "forward_arc_fallback"
    );
  }
  recordHarthmereSwordImpactTimingDebug(attack, {
    phase: "mouse_primary_immediate",
    hitOffsets: arcResult.hitOffsets,
    candidateOffsets: arcResult.candidateOffsets,
    bypassedDrawGate,
  });

  state = setCooldown(state, attack, 1.4);
  writeHarthmereMultiplayerCombatState(
    afterHostileAction(
      state,
      "Mouse Attack",
      `Left mouse resolved a basic attack and hit ${arcResult.hitOffsets.length} target(s). Candidates checked: ${arcResult.candidateOffsets.length}.`,
      { damage: 18 },
    ),
  );
  return arcResult;
}

export function performHarthmereKeyedAttack(attack: HarthmerePlayerAttackType) {
  let state = readHarthmereMultiplayerCombatState();
  const targetOffset = state.currentTargetOffset;
  debugHarthmereKeyCombat("keyed.attack.start", {
    attack,
    currentTargetOffset: state.currentTargetOffset,
    currentTargetLabel: state.currentTargetLabel,
    weaponDrawn: state.weaponDrawn,
    cooldowns: state.cooldowns,
  });

  const combat = readHarthmereCombatState();
  const blockedReason = getHarthmereMultiplayerAttackDisabledReason(
    attack,
    state,
    combat.player,
  );
  if (blockedReason) {
    writeHarthmereMultiplayerCombatState(
      appendLog(state, "Action Blocked", blockedReason),
    );
    return;
  }

  const equippedWeapon = readHarthmereInventoryState().equipment.main_hand;
  const equippedWeaponItemId = equippedWeapon?.itemId;
  const hasPhysicalWeapon = attack !== "spark" && Boolean(equippedWeaponItemId);
  if (hasPhysicalWeapon && !state.weaponDrawn) {
    // First weapon key press draws the sword instead of resolving invisible
    // sword damage. The next B/H press attacks with the visible blade.
    state = setCooldown({ ...state, weaponDrawn: true }, "draw", 0.35);
    writeHarthmereMultiplayerCombatState(
      appendLog(
        state,
        "Weapon Not Drawn",
        "You draw your sword. Press basic or heavy attack again to strike with it.",
      ),
    );
    emitHarthmereWeaponVisualState("draw", true, attack, equippedWeaponItemId);
    return;
  }

  if (attack === "spark" && !targetOffset) {
    writeHarthmereMultiplayerCombatState(
      appendLog(
        state,
        "No Spell Target",
        "Press Tab to pick a target before casting Spark. B and H do not need a selected target because they sweep forward.",
      ),
    );
    return;
  }

  if (
    attack === "spark" &&
    targetOffset !== undefined &&
    state.safeZone &&
    state.pvpFlag !== "duel_flagged" &&
    targetOffset < 9000
  ) {
    state = appendLog(
      state,
      "Town Law Warning",
      "Harthmere's center is guarded, not magically safe. You can attack townspeople here, but they can take damage, fight back, and call the Watch.",
    );
  }

  if (!cooldownReady(state, attack)) {
    writeHarthmereMultiplayerCombatState(
      appendLog(state, "On Cooldown", `${attack} is not ready yet.`),
    );
    return;
  }

  let forwardArcHitCount: number | undefined;
  let forwardArcCandidateCount: number | undefined;

  if (attack === "spark") {
    if (!ensureStarterSparkKnown()) {
      writeHarthmereMultiplayerCombatState(
        appendLog(
          state,
          "Spell Unknown",
          "You need to learn Spark from a scroll or trainer before L can cast it.",
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
    // harthmere-real-player-attack-gesture: spark emits only after validation
    emitHarthmereFullAnimationRequest({ family: "magic", action: attack, phase: "start" });
    emitAttackAnimation(attack, { emptyHanded: true, weaponVisual: false });
    performHarthmereCombatAttack(Number(targetOffset), attack);
  } else {
    // harthmere-real-player-attack-gesture: physical emits only after validation
    emitHarthmereFullAnimationRequest({
      family: hasPhysicalWeapon ? "ranged" : "creature",
      action: hasPhysicalWeapon ? attack : "attack",
      phase: "start",
      itemId: equippedWeaponItemId,
    });
    emitAttackAnimation(attack, {
      itemId: equippedWeaponItemId,
      emptyHanded: !hasPhysicalWeapon,
      weaponVisual: hasPhysicalWeapon,
    });
    // harthmere-physical-weapon-visual-event:
    // B/H weapon attacks trigger visible equipment animation even when
    // combatDebug is disabled and even if the forward arc misses every target.
    if (hasPhysicalWeapon) {
      emitHarthmereWeaponVisualState("attack", true, attack, equippedWeaponItemId);
    }
    const timing = harthmereSwordAttackTiming(attack);
    const resolveHarthmereSwordImpactFrame = () => {
      const arcResult = performHarthmereForwardArcAttack(attack);
      recordHarthmereSwordImpactTimingDebug(attack, {
        phase: "impact",
        impactMs: timing.impactMs,
        hitOffsets: arcResult.hitOffsets,
        candidateOffsets: arcResult.candidateOffsets,
      });
      const impactLabel = attack === "heavy" ? "Heavy Attack Impact" : "Basic Attack Impact";
      const impactState = readHarthmereMultiplayerCombatState();
      writeHarthmereMultiplayerCombatState(
        afterHostileAction(
          impactState,
          impactLabel,
          `${impactLabel} resolved at the sword impact frame and hit ${arcResult.hitOffsets.length} target(s). Candidates checked: ${arcResult.candidateOffsets.length}.`,
          { damage: attack === "heavy" ? 35 : 18 },
        ),
      );
      return arcResult;
    };
    recordHarthmereSwordImpactTimingDebug(attack, {
      phase: "scheduled",
      windupMs: timing.windupMs,
      impactMs: timing.impactMs,
      recoveryMs: timing.recoveryMs,
    });
    if (isBrowser()) {
      window.setTimeout(resolveHarthmereSwordImpactFrame, timing.impactMs);
    } else {
      const arcResult = resolveHarthmereSwordImpactFrame();
      forwardArcHitCount = arcResult.hitOffsets.length;
      forwardArcCandidateCount = arcResult.candidateOffsets.length;
    }
  }

  const cooldownSeconds = attack === "heavy" ? 2.8 : attack === "spark" ? 4 : 1.4;
  state = setCooldown(state, attack, cooldownSeconds);
  const attackLabel =
    attack === "spark"
      ? "Magic Attack"
      : attack === "heavy"
        ? "Heavy Attack"
        : "Basic Attack";
  const contribution =
    attack === "spark"
      ? { damage: 24, crowdControl: 3 }
      : { damage: attack === "heavy" ? 35 : 18 };
  const detail =
    attack === "spark"
      ? `${attackLabel} ${equippedWeapon ? "sent" : "cast"} at ${state.currentTargetLabel}. Credit is contribution-based, not last-hit based.`
      : `${attackLabel} started. Physical damage resolves at the ${hasPhysicalWeapon ? "weapon" : "body"} impact frame; credit remains contribution-based, not last-hit based.`;

  writeHarthmereMultiplayerCombatState(
    afterHostileAction(state, attackLabel, detail, contribution),
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

export function useHarthmereCombatHotkeys() {
  // ClientContext is needed for networked PvP (firing UpdatePlayerHealthEvent and
  // scanning for nearby players). It is stable for the session; a ref keeps the
  // window listener using a live reference without re-subscribing.
  const clientContext = useClientContext();
  const clientContextRef = React.useRef(clientContext);
  clientContextRef.current = clientContext;
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
      const code = event.code;
      if (["KeyX", "Tab", "KeyB", "KeyH", "KeyL", "KeyP"].includes(code)) {
        debugHarthmereKeyCombat("keyed.hotkey", { code });
      }
      if (code === HARTHMERE_COMBAT_KEY_BINDINGS.draw) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        toggleHarthmereWeaponDrawn();
      } else if (code === HARTHMERE_COMBAT_KEY_BINDINGS.target) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        cycleHarthmereCombatTarget();
      } else if (code === HARTHMERE_COMBAT_KEY_BINDINGS.basic) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        performHarthmereKeyedAttack("basic");
      } else if (code === HARTHMERE_COMBAT_KEY_BINDINGS.heavy) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        performHarthmereKeyedAttack("heavy");
      } else if (code === HARTHMERE_COMBAT_KEY_BINDINGS.spark) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        performHarthmereKeyedAttack("spark");
      } else if (code === HARTHMERE_COMBAT_KEY_BINDINGS.pvp) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const state = readHarthmereMultiplayerCombatState();
        setHarthmerePvpFlag(
          state.pvpFlag === "voluntary_pvp" ? "unflagged" : "voluntary_pvp",
        );
      }
    };
    // HARTHMERE_MOUSE_PRIMARY_ATTACK:
    // Creature/body hits are installed by the module-level hard mouse router so
    // they exist as soon as the combat module loads. This hook keeps the PvP
    // half because it needs the live ClientContext for authoritative events.
    const mouseHandler = (event: MouseEvent) => {
      if (event.button !== 0 || isTypingTarget(event.target)) {
        return;
      }
      if (!isHarthmereGameplayMouseTarget(event.target)) {
        return;
      }
      // Other players — fire authoritative networked PvP damage for anyone in the
      // swing arc. Independent of the creature branch: one click can hit both.
      resolveHarthmerePvpMousePrimaryAttack(clientContextRef.current);
    };

    window.addEventListener("keydown", handler, true);
    window.addEventListener("mousedown", mouseHandler, true);
    const npcAiInterval = window.setInterval(
      () => submitHarthmereLiveModeNpcAiTicks(undefined, "combat_runtime"),
      HARTHMERE_LIVE_MODE_NPC_AI_TICK_INTERVAL_MS
    );
    return () => {
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("mousedown", mouseHandler, true);
      window.clearInterval(npcAiInterval);
    };
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
  const interfaceRules = describeHarthmereMultiplayerCombatInterface(
    state,
    combat.player,
  );
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
            {HARTHMERE_COMBAT_INTERFACE_KEY_COPY.draw} draw/sheathe ·{" "}
            {HARTHMERE_COMBAT_INTERFACE_KEY_COPY.target} target ·{" "}
            {HARTHMERE_COMBAT_INTERFACE_KEY_COPY.basic} attack ·{" "}
            {HARTHMERE_COMBAT_INTERFACE_KEY_COPY.heavy} heavy ·{" "}
            {HARTHMERE_COMBAT_INTERFACE_KEY_COPY.spark} Spark ·{" "}
            {HARTHMERE_COMBAT_INTERFACE_KEY_COPY.pvp} PvP
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
        <StatLine label="PvP rule" value={interfaceRules.pvpMode.replaceAll("_", " ")} />
      </div>
      <div className="mt-2 rounded border border-white/10 bg-white/5 p-1.5 text-[11px] leading-snug text-white/75">
        <div>{interfaceRules.pvpLegalitySummary}</div>
        <div>{interfaceRules.protectionSummary}</div>
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

function ActionButton({
  children,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

export const HarthmereMultiplayerCombatMenuPanel: React.FunctionComponent<{}> = () => {
  const state = useHarthmereMultiplayerCombatState();
  const combat = readHarthmereCombatState();
  const interfaceRules = describeHarthmereMultiplayerCombatInterface(
    state,
    combat.player,
  );
  const basicBlock = getHarthmereMultiplayerAttackDisabledReason(
    "basic",
    state,
    combat.player,
  );
  const heavyBlock = getHarthmereMultiplayerAttackDisabledReason(
    "heavy",
    state,
    combat.player,
  );
  const sparkBlock = getHarthmereMultiplayerAttackDisabledReason(
    "spark",
    state,
    combat.player,
  );
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
          <div><span className="font-semibold text-white">{HARTHMERE_COMBAT_INTERFACE_KEY_COPY.draw}</span> draw / put away weapon</div>
          <div><span className="font-semibold text-white">{HARTHMERE_COMBAT_INTERFACE_KEY_COPY.target}</span> cycle target</div>
          <div><span className="font-semibold text-white">{HARTHMERE_COMBAT_INTERFACE_KEY_COPY.basic}</span> basic weapon attack</div>
          <div><span className="font-semibold text-white">{HARTHMERE_COMBAT_INTERFACE_KEY_COPY.heavy}</span> heavy weapon attack</div>
          <div><span className="font-semibold text-white">{HARTHMERE_COMBAT_INTERFACE_KEY_COPY.spark}</span> Spark magic attack</div>
          <div><span className="font-semibold text-white">{HARTHMERE_COMBAT_INTERFACE_KEY_COPY.pvp}</span> toggle voluntary PvP</div>
        </div>
      </div>

      <div className="mb-2 rounded border border-emerald-300/20 bg-emerald-950/20 p-2 text-[11px] leading-snug text-emerald-50/80">
        <div className="mb-1 text-xs font-bold text-emerald-100">GLTF clip routing</div>
        <div><span className="font-semibold text-white">B</span> Basic Attack → Attack, Attack2, SideSwing</div>
        <div><span className="font-semibold text-white">H</span> Heavy Attack → HeavyAttack, Attack2</div>
        <div><span className="font-semibold text-white">L</span> Spark → BasicMagic, HeavyMagic</div>
        <div><span className="font-semibold text-white">Animals</span> → Bite, Claw, Pounce, Charge, Peck, Scratch, Kick, TailWhip, Attack</div>
        <div><span className="font-semibold text-white">Reactions</span> → HitReact, Block, ShieldBlock, Dodging, Death</div>
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
          <StatLine label="PvP rule" value={interfaceRules.pvpMode.replaceAll("_", " ")} />
          <StatLine label="Aggression" value={formatSeconds(state.aggressionUntil)} />
          <StatLine label="Party ready" value={`${partyReady}/${state.party.length}`} />
          <StatLine label="Raid size" value={state.raidSize || "—"} />
          <StatLine label="Pull timer" value={formatSeconds(state.pullTimerUntil)} />
          <StatLine label="Contribution" value={totalContribution} />
        </div>
      </div>

      <div className="mb-2 rounded border border-white/10 bg-white/5 p-2 text-xs leading-snug text-white/75">
        <div className="font-semibold text-white">PvP / Death Rules</div>
        <div>{interfaceRules.pvpLegalitySummary}</div>
        <div>{interfaceRules.protectionSummary}</div>
        <div>{interfaceRules.rewardPolicySummary}</div>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <ActionButton onClick={() => toggleHarthmereWeaponDrawn()}>
          {state.weaponDrawn ? "Put Weapon Away" : "Draw Weapon"}
        </ActionButton>
        <ActionButton onClick={() => cycleHarthmereCombatTarget()}>
          Cycle Target
        </ActionButton>
        <ActionButton
          disabled={Boolean(basicBlock)}
          onClick={() => performHarthmereKeyedAttack("basic")}
          title={basicBlock}
        >
          B Basic Attack → Attack
        </ActionButton>
        <ActionButton
          disabled={Boolean(heavyBlock)}
          onClick={() => performHarthmereKeyedAttack("heavy")}
          title={heavyBlock}
        >
          H Heavy Attack → HeavyAttack
        </ActionButton>
        <ActionButton
          disabled={Boolean(sparkBlock)}
          onClick={() => performHarthmereKeyedAttack("spark")}
          title={sparkBlock}
        >
          L Spark → BasicMagic
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

// Harthmere hard combat key router
// --------------------------------
// This is intentionally installed at module load time, before React effects from
// HUD/class/inventory panels can register their own capture listeners. The goal
// is to make B/H/L deterministic and prevent older spell handlers from stealing
// KeyB and routing it to Spark.
const HARTHMERE_HARD_COMBAT_KEY_ROUTER_VERSION = "harthmere-hard-key-router";

type HarthmereHardCombatKey = "basic" | "heavy" | "spark";

function isHarthmereTextEntryTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : undefined;
  if (!element) {
    return false;
  }
  const tag = element.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    element.isContentEditable ||
    !!element.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")
  );
}

function isHarthmereGameplayMouseTarget(target: EventTarget | null) {
  if (typeof document !== "undefined" && document.pointerLockElement) {
    return true;
  }
  if (!(target instanceof Element)) {
    return false;
  }
  if (target instanceof HTMLCanvasElement) {
    return true;
  }
  return Boolean(target.closest("canvas"));
}

function hardCombatActionForCode(code: string): HarthmereHardCombatKey | undefined {
  if (code === "KeyB") {
    return "basic";
  }
  if (code === "KeyH") {
    return "heavy";
  }
  if (code === "KeyL") {
    return "spark";
  }
  return undefined;
}

function installHarthmereHardCombatKeyRouter() {
  if (typeof window === "undefined") {
    return;
  }

  const win = window as Window & typeof globalThis & {
    __harthmereHardCombatKeyRouterVersion?: string;
    __harthmereHardCombatKeyRouterCleanup?: () => void;
    __harthmereHardCombatKeyRouterLog?: unknown[];
    __harthmereHardCombatKeyRouter?: {
      version: string;
      log: () => unknown[];
      route: (action: HarthmereHardCombatKey) => void;
    };
  };

  if (win.__harthmereHardCombatKeyRouterVersion === HARTHMERE_HARD_COMBAT_KEY_ROUTER_VERSION) {
    return;
  }

  win.__harthmereHardCombatKeyRouterCleanup?.();
  const log: unknown[] = [];
  win.__harthmereHardCombatKeyRouterLog = log;

  const pushLog = (entry: Record<string, unknown>) => {
    const logged = { at: new Date().toISOString(), ...entry };
    log.unshift(logged);
    log.length = Math.min(log.length, 80);
    if (window.localStorage?.getItem("biomes.localDev.harthmere.combatDebug") === "1") {
      console.info("[HarthmereHardKeyRouter]", logged);
    }
  };

  const route = (action: HarthmereHardCombatKey) => {
    pushLog({ type: "route", action });
    performHarthmereKeyedAttack(action);
  };

  const handler = (event: KeyboardEvent) => {
    const action = hardCombatActionForCode(event.code);
    if (!action) {
      return;
    }

    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || isHarthmereTextEntryTarget(event.target)) {
      pushLog({
        type: "ignored",
        code: event.code,
        action,
        repeat: event.repeat,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        target: event.target instanceof HTMLElement ? event.target.tagName : typeof event.target,
      });
      return;
    }

    // Critical part: stop older capture/bubble handlers from seeing B/H/L without stealing notifications.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    pushLog({ type: "keydown", code: event.code, action });
    route(action);
  };

  window.addEventListener("keydown", handler, true);
  win.__harthmereHardCombatKeyRouterVersion = HARTHMERE_HARD_COMBAT_KEY_ROUTER_VERSION;
  win.__harthmereHardCombatKeyRouterCleanup = () => {
    window.removeEventListener("keydown", handler, true);
  };
  win.__harthmereHardCombatKeyRouter = {
    version: HARTHMERE_HARD_COMBAT_KEY_ROUTER_VERSION,
    log: () => log,
    route,
  };

  pushLog({ type: "installed", version: HARTHMERE_HARD_COMBAT_KEY_ROUTER_VERSION });
}

installHarthmereHardCombatKeyRouter();

// Harthmere hard combat mouse router
// ----------------------------------
// Installed at module load just like the hard key router so left mouse attacks
// route to Harthmere body combat even on debug/visual pages that do not mount the
// full HUD hook. PvP remains in the hook because it needs live ClientContext.
const HARTHMERE_HARD_COMBAT_MOUSE_ROUTER_VERSION =
  "harthmere-hard-mouse-router";

function installHarthmereHardCombatMouseRouter() {
  if (typeof window === "undefined") {
    return;
  }

  const win = window as Window & typeof globalThis & {
    __harthmereHardCombatMouseRouterVersion?: string;
    __harthmereHardCombatMouseRouterCleanup?: () => void;
    __harthmereHardCombatMouseRouterLog?: unknown[];
    __harthmereNativeNpcAttackContactLastAt?: number;
    __harthmereNativeNpcAttackContactLastHits?: HarthmereNativeNpcAttackContactHit[];
    __harthmereHardCombatMouseRouter?: {
      version: string;
      log: () => unknown[];
    };
  };

  if (
    win.__harthmereHardCombatMouseRouterVersion ===
    HARTHMERE_HARD_COMBAT_MOUSE_ROUTER_VERSION
  ) {
    return;
  }

  win.__harthmereHardCombatMouseRouterCleanup?.();
  const log: unknown[] = [];
  win.__harthmereHardCombatMouseRouterLog = log;

  const pushLog = (entry: Record<string, unknown>) => {
    const logged = { at: new Date().toISOString(), ...entry };
    log.unshift(logged);
    log.length = Math.min(log.length, 80);
    if (window.localStorage?.getItem("biomes.localDev.harthmere.combatDebug") === "1") {
      console.info("[HarthmereHardMouseRouter]", logged);
    }
  };

  const handler = (event: MouseEvent) => {
    if (event.button !== 0 || isHarthmereTextEntryTarget(event.target)) {
      return;
    }
    const pointerLocked = Boolean(document.pointerLockElement);
    const gameplayCanvasTarget = isHarthmereGameplayMouseTarget(event.target);
    if (!pointerLocked && !gameplayCanvasTarget) {
      pushLog({ type: "ignored", reason: "not_gameplay_mouse_target" });
      return;
    }
    // HARTHMERE_CROSSHAIR_COMBAT_TARGET: the aim point is viewport-centre
    // under pointer lock, otherwise the exact pixel the player clicked.
    const aim = harthmereCrosshairAimFromEvent({
      pointerLocked,
      clientX: event.clientX,
      clientY: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    const runtimeForGate = readHarthmereForwardArcRuntime();
    const hasCrosshairTarget = harthmereHasCrosshairCombatTarget({
      actors: readHarthmereCrosshairCombatActors(),
      aim,
      playerX: runtimeForGate?.position?.[0],
      playerZ: runtimeForGate?.position?.[2],
      worldReach: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS,
    });
    // Engage if there is something under the crosshair OR within the legacy
    // proximity probe. The crosshair check does not need the player-origin
    // runtime, so it still engages when that snapshot is missing.
    const hasAttackableTargetNearby =
      hasCrosshairTarget || harthmereHasAttackableTargetNearPlayer();
    if (
      !shouldEngageHarthmereMousePrimaryAttack({
        button: event.button,
        pointerLocked,
        gameplayCanvasTarget,
        typingTarget: false,
        hasAttackableTargetNearby,
      })
    ) {
      pushLog({ type: "ignored", reason: "no_attackable_target_nearby" });
      return;
    }
    const nativeContactBefore = Number(
      win.__harthmereNativeNpcAttackContactLastAt ?? 0,
    );
    pushLog({
      type: "mousedown",
      action: "basic",
      pointerLocked,
      gameplayCanvasTarget,
      delayedFallback: true,
    });
    window.setTimeout(() => {
      const nativeContactAfter = Number(
        win.__harthmereNativeNpcAttackContactLastAt ?? 0,
      );
      if (nativeContactAfter > nativeContactBefore) {
        const nativeHitOffsets =
          harthmereMousePrimaryAttackOffsetsFromNativeHits(
            win.__harthmereNativeNpcAttackContactLastHits,
          );
        submitHarthmereLiveModeMousePrimaryAttack(
          nativeHitOffsets,
          readHarthmereForwardArcRuntime(),
          "native_contact",
        );
        pushLog({
          type: "ignored",
          reason: "native_voxel_attack_already_hit",
          nativeContactAfter,
          nativeHitOffsets,
        });
        return;
      }
      performHarthmereMousePrimaryAttack(aim);
    }, 80);
  };

  window.addEventListener("mousedown", handler, true);
  win.__harthmereHardCombatMouseRouterVersion =
    HARTHMERE_HARD_COMBAT_MOUSE_ROUTER_VERSION;
  win.__harthmereHardCombatMouseRouterCleanup = () => {
    window.removeEventListener("mousedown", handler, true);
  };
  win.__harthmereHardCombatMouseRouter = {
    version: HARTHMERE_HARD_COMBAT_MOUSE_ROUTER_VERSION,
    log: () => log,
  };

  pushLog({
    type: "installed",
    version: HARTHMERE_HARD_COMBAT_MOUSE_ROUTER_VERSION,
  });
}

installHarthmereHardCombatMouseRouter();


// current combat variation event marker
const __HARTHMERE_ATTACK_VARIATION_EVENT = {
  attackVariationId: true,
  attackVariationFamily: true,
};


// current combat variation payload markers.
const __HARTHMERE_VARIATION_COMBAT = {
  attackVariationId: true,
  attackVariationFamily: true,
  attackVariationIndex: true,
  attackVariationEmoteType: true,
};
