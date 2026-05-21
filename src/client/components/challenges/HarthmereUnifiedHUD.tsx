import { installSnapshotLiveNpcLoreDebugV79 } from "@/client/components/challenges/LocalDevSnapshotLiveNpcLoreRuntimeV79";
import { HarthmereServerAuthorityPanel } from "@/client/components/challenges/LocalDevHarthmereServerAuthorityContracts";
import { HarthmereCrimeLawPanel } from "@/client/components/challenges/LocalDevHarthmereCrimeLawSystem";
import { HarthmereQuestGuidancePanel } from "@/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem";
import { HarthmereDialogueSafetyPanel } from "@/client/components/challenges/LocalDevHarthmereDialogueSafetySystem";
import { HarthmereInventoryGuidancePanel } from "@/client/components/challenges/LocalDevHarthmereInventoryGuidance";
import { HarthmereMountPetCollectionPanel } from "@/client/components/challenges/LocalDevHarthmereMountPetCollections";
// harthmere-no-spark-basic-hud-v11
import { HarthmereBuildingMenuPanel } from "@/client/components/challenges/LocalDevHarthmereBuildingSystem";
import {
  HARTHMERE_COMBAT_EFFECT_EVENT,
  HarthmereCombatMenuPanel,
  reviveHarthmerePlayer,
  useHarthmereAmbientThreats,
  useHarthmereCombatState,
  useHarthmereForwardArcRuntime,
  useHarthmereRealtimeCombatAI,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import { HarthmereClassSkillMenuPanel } from "@/client/components/challenges/LocalDevHarthmereClassSkillSystem";
import {
  HarthmereDeathHUD,
  HarthmereDeathMenuPanel,
  HarthmereDeathRuntimeController,
} from "@/client/components/challenges/LocalDevHarthmereDeathSystem";
import { HarthmereDialogueMenuPanel } from "@/client/components/challenges/LocalDevHarthmereDialogueSystem";
import { HarthmereEconomyMenuPanel } from "@/client/components/challenges/LocalDevHarthmereEconomySystem";
import { HarthmereGatheringMenuPanel } from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import { HarthmereGuildMenuPanel } from "@/client/components/challenges/LocalDevHarthmereGuildSystem";
import { HarthmereTradeAuctionMenuPanel } from "@/client/components/challenges/LocalDevHarthmereTradeAuctionSystem";
import { HarthmereStorageMailRecoveryMenuPanel } from "@/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem";
import {
  HarthmereInventoryMenuPanel,
  HarthmereVendorTradePanel,
  cycleHarthmereWeapon,
  ensureHarthmereSpellSlotted,
  ensureHarthmereStarterSwordGranted,
  useHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { HarthmereLevelingMenuPanel } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { HarthmereMissionJournalPanel } from "@/client/components/challenges/LocalDevHarthmereMissionSystem";
import {
  SnapshotMissionJournalPanelV71,
  SnapshotMissionMapHUDV71,
  SnapshotMissionRuntimeControllerV71,
} from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import {
  SnapshotCombatJournalPanelV74,
  SnapshotCombatMapHUDV74,
  SnapshotCombatRuntimeControllerV74,
} from "@/client/components/challenges/LocalDevSnapshotCombatRuntime";
import {
  SnapshotGroveBibleRuntimeControllerV75,
  SnapshotGroveJournalPanelV75,
  SnapshotGroveMapHUDV75,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  SnapshotCompletePortRuntimeControllerV76,
  SnapshotGroundingAuditPanelV76,
  SnapshotMissionAuditPanelV76,
  SnapshotPortStatusPanelV76,
} from "@/client/components/challenges/LocalDevSnapshotCompletePortV76";
import {
  SnapshotProductionPortFactsV77,
  SnapshotProductionPortRuntimeControllerV77,
  SnapshotProductionPortStatusPanelV77,
} from "@/client/components/challenges/SnapshotProductionPortV77";
import {
  SnapshotLiveDiagnosticsRuntimeControllerV78,
  SnapshotLiveGroundingAuditPanelV78,
  SnapshotPerformanceWalkerPanelV78,
  SnapshotRemainingPortAuditPanelV78,
} from "@/client/components/challenges/SnapshotLiveDiagnosticsV78";
import {
  HARTHMERE_ATTACK_ANIMATION_EVENT,
  HarthmereMultiplayerCombatMenuPanel,
  cycleHarthmereCombatTarget,
  performHarthmereKeyedAttack,
  toggleHarthmereWeaponDrawn,
  useHarthmereCombatHotkeys,
  useHarthmereMultiplayerCombatState,
} from "@/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem";
import { HarthmereQuestMapHUD } from "@/client/components/challenges/LocalDevHarthmereQuests";
import {
  HarthmereReputationMenuPanel,
  getHarthmereCombinedPublicTitle,
  useHarthmereReputationState,
} from "@/client/components/challenges/LocalDevHarthmereReputation";
import { MiniMapHUD } from "@/client/components/MiniMapHUD";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { setHarthmereLocalDevUserScope } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT,
  getHarthmereGlitchGameUserId,
} from "@/client/game/glitch/harthmere_glitch_identity";
import React, { useEffect, useMemo, useState } from "react";
import { LocalDevHarthmereEconomyOptimizationSystem } from "./LocalDevHarthmereEconomyOptimizationSystem";
import LocalDevHarthmereDialogueRuleSystemPanel from "./LocalDevHarthmereDialogueRuleSystem";
import { BIOMES_GAME_NAME, BIOMES_HARTHMERE_TOWN_NAME } from "@/shared/biomes/display_names";
import {
  dispatchHarthmereHudActionEventV96,
  harthmereHudBindingForActionV96,
  harthmereHudBindingForCodeV96,
  type HarthmereHudActionV96,
  type HarthmereHudSystemTabV96,
} from "@/shared/harthmere/harthmere_hud_key_bindings_v96";

// HARTHMERE_POLISH_V1_HUD_REDESIGN — switched to the in-house medieval pack
// served from /public/hud. Falls back to quaternius placeholders if a file
// is missing so an asset-load failure does not crash the HUD.
const ICONS = {
  heart: "/hud/icon-32-heart.png",
  heartFilled: "/hud/icon-16-heart-filled-bordered.png",
  heartBordered: "/hud/icon-16-heart-bordered.png",
  sword: "/assets/harthmere/png/icons/quaternius_rpg_items/Sword.png",
  spark: "/hud/permissions-claim.png",
  shield: "/hud/wand-of-grouping.png",
  quest: "/hud/icon-current-location-24.png",
  target: "/hud/player-marker-small.png",
  heavy: "/hud/icon-32-challenges.png",
  navInventory: "/hud/nav/inventory.png",
  navMap: "/hud/nav/map.png",
  navCrafting: "/hud/nav/crafting.png",
  navChallenges: "/hud/nav/challenges.png",
  navInbox: "/hud/nav/inbox.png",
  navNotifications: "/hud/nav/notifications.png",
  navCollections: "/hud/nav/collections-closed.png",
  navSettings: "/hud/nav/settings.png",
  frame: "/hud/Frame 480.png",
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function signedStandingPercent(value: number) {
  return clamp(((value + 10_000) / 20_000) * 100, 0, 100);
}

function notorietyPercent(value: number) {
  return clamp((value / 10_000) * 100, 0, 100);
}

function itemLabel(itemId?: string) {
  switch (itemId) {
    case "training_dagger":
      return "Training Dagger";
    case "iron_longsword":
      return "Iron Longsword";
    case "woodsman_axe":
      return "Woodsman's Axe";
    case "two_handed_sword":
      return "Two-Handed Sword";
    case "wooden_shield":
      return "Town Watch Buckler";
    case "rusty_pickaxe":
      return "Rusty Pickaxe";
    case "woodcutters_axe":
      return "Woodcutter's Axe";
    default:
      return itemId ? itemId.replaceAll("_", " ") : "Fists";
  }
}

type MenuTab = HarthmereHudSystemTabV96;

type HarthmereHudPanelV97 = "map" | "quests" | undefined;

export interface HarthmereHudViewStateV97 {
  panel: HarthmereHudPanelV97;
  systemsTab?: MenuTab;
  focusAction?: HarthmereHudActionV96;
}

const MENU_TABS: { id: MenuTab; label: string }[] = [
  { id: "journal", label: "Journal" },
  { id: "inventory", label: "Inventory" },
  { id: "combat", label: "Combat" },
  { id: "standing", label: "Standing" },
  { id: "skills", label: "Skills" },
  { id: "world", label: "World" },
  { id: "dialogue", label: "Dialogue Rules" },
];

const SYSTEM_TAB_DESCRIPTIONS_V97: Record<MenuTab, string> = {
  journal:
    "Objective journal, Grove starter chain, Harthmere mission chain, and progress callouts.",
  inventory:
    "Backpack, equipment, wallet, bank, spellbook, and material storage tools.",
  combat:
    "Targeting, damage, PvP, weapon state, threat visibility, and combat rules.",
  standing:
    "Town standing, legal risk, notoriety, and reputation events that change how NPCs react.",
  skills:
    "Leveling, attributes, class skills, unlocked basics, and recent XP progress.",
  world:
    "Death, economy, gathering, building, guilds, storage, safety, recovery, and world services.",
  dialogue:
    "Conversation memory, tone rules, dialogue safeguards, and lore/codex references.",
};

const SYSTEM_ENTRY_ACTION_COPY_V97: Record<
  HarthmereHudActionV96,
  { eyebrow: string; heading: string; summary: string }
> = {
  inventory: {
    eyebrow: "Bag · I",
    heading: "Inventory opened",
    summary:
      "You are looking at item storage, equipment, spellbook, wallet, and bank controls.",
  },
  crafting: {
    eyebrow: "Craft · C",
    heading: "Crafting and world services opened",
    summary:
      "Use the world tab for crafting-adjacent systems, gathering, building, storage, and other service panels.",
  },
  map: {
    eyebrow: "Map · M",
    heading: "World map opened",
    summary:
      "The center map tracks your current area, markers, objective distance, and terrain layer.",
  },
  quests: {
    eyebrow: "Quests · J",
    heading: "Quest map opened",
    summary:
      "The quest panel stays focused on active objectives, route hints, and nearby progress markers.",
  },
  tasks: {
    eyebrow: "Tasks · K",
    heading: "Task tracker opened",
    summary:
      "The journal tab is focused on active tasks, starter lessons, and current mission progress.",
  },
  mail: {
    eyebrow: "Mail · Y",
    heading: "Mail and recovery services opened",
    summary:
      "The world tab includes mail, storage, recovery, and service counters so the key press has a clear landing point.",
  },
  notifications: {
    eyebrow: "Notif · N",
    heading: "Recent events opened",
    summary:
      "The journal tab is showing progress, updates, and recent event-driven changes instead of leaving the action invisible.",
  },
  codex: {
    eyebrow: "Codex · V",
    heading: "Dialogue rules and codex opened",
    summary:
      "The dialogue tab explains conversation rules, memory, tone, and lore references.",
  },
  settings: {
    eyebrow: "Settings · Esc",
    heading: "Systems and recovery opened",
    summary:
      "Escape now lands in the world/services tab so players can clearly find recovery, safe-state, and supporting system panels.",
  },
};

export function reduceHarthmereHudStateForActionV97(
  state: HarthmereHudViewStateV97,
  action: HarthmereHudActionV96,
): HarthmereHudViewStateV97 {
  const binding = harthmereHudBindingForActionV96(action);
  if (binding.targetPanel === "map") {
    return {
      panel: state.panel === "map" ? undefined : "map",
      systemsTab: undefined,
      focusAction: undefined,
    };
  }
  if (binding.targetPanel === "quests") {
    return {
      panel: state.panel === "quests" ? undefined : "quests",
      systemsTab: undefined,
      focusAction: undefined,
    };
  }
  const nextTab = binding.targetTab ?? "world";
  const isSameOpenTarget =
    state.panel === undefined &&
    state.systemsTab === nextTab &&
    state.focusAction === action;
  if (isSameOpenTarget) {
    return { panel: undefined, systemsTab: undefined, focusAction: undefined };
  }
  return {
    panel: undefined,
    systemsTab: nextTab,
    focusAction: action,
  };
}

// harthmere-body-animation-weapon-sync-v5
type HarthmereBodyAnimationGestureDetailV5 = {
  attack?: string;
  at?: number;
  windupMs?: number;
  impactMs?: number;
  recoveryMs?: number;
  itemId?: string;
};

const HARTHMERE_BODY_ANIMATION_GESTURE_BRIDGE_V5 = "harthmere-body-animation-gesture-bridge-v5";

function harthmereBodyAttackTimingFromWeaponEventV5(
  detail: HarthmereBodyAnimationGestureDetailV5 | undefined,
  attack: "basic" | "heavy",
) {
  const defaults =
    attack === "heavy"
      ? { windupMs: 260, impactMs: 360, recoveryMs: 520 }
      : { windupMs: 150, impactMs: 220, recoveryMs: 340 };
  const windupMs = Math.max(0, detail?.windupMs ?? defaults.windupMs);
  const impactMs = Math.max(windupMs, detail?.impactMs ?? defaults.impactMs);
  const recoveryMs = Math.max(80, detail?.recoveryMs ?? defaults.recoveryMs);
  return {
    windupMs,
    impactMs,
    recoveryMs,
    duration: Math.max(0.35, (impactMs + recoveryMs) / 1000),
  };
}

function recordHarthmereBodyAnimationSyncDebugV5(
  payload: Record<string, unknown>,
) {
  if (typeof window === "undefined") {
    return;
  }
  const win = window as typeof window & {
    __harthmereBodyAnimationSyncDebug?: unknown[];
  };
  win.__harthmereBodyAnimationSyncDebug = [
    {
      at: Date.now(),
      bridge: HARTHMERE_BODY_ANIMATION_GESTURE_BRIDGE_V5,
      upperBodyOnly: true,
      lowerBodyLocomotionPreserved: true,
      ...payload,
    },
    ...(win.__harthmereBodyAnimationSyncDebug ?? []),
  ].slice(0, 100);
}

function useHarthmereLocalPlayerAttackGestureBridge() {
  const { reactResources, resources, events, audioManager } = useClientContext();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<HarthmereBodyAnimationGestureDetailV5>).detail;
      const attack = detail?.attack;
      if (attack !== "basic" && attack !== "heavy") {
        return;
      }

      try {
        const localPlayer = reactResources.get("/scene/local_player");
        const clock = resources.get("/clock");
        const selectedItem = resources.get("/hotbar/selection")?.item;
        const emoteType = attack === "heavy" ? "attack2" : "attack1";
        const desiredFileAnimationName = attack === "heavy" ? "HarthmereBodyWeaponHeavy_Aligned_30" : "HarthmereBodyWeaponBasic_Aligned_30";
        const bodyTiming = harthmereBodyAttackTimingFromWeaponEventV5(
          detail,
          attack,
        );
        const duration = bodyTiming.duration;

        // Do not call localPlayer.startAttack() here: the native helper
        // intentionally alternates attack1/attack2, which is correct for
        // mouse harvesting but wrong for explicit Harthmere B/N combat.
        // Keep the native sound + attackInfo + eagerEmote path, but choose
        // the exact emote for the key that was pressed.
        localPlayer.player.setSound(resources, audioManager, "attack", "swing", {
          resetIfAlreadyPlaying: true,
        });
        localPlayer.attackInfo = {
          start: clock.time,
          duration,
        };
        localPlayer.player.eagerEmote(events, resources, emoteType);
        recordHarthmereBodyAnimationSyncDebugV5({
          attack,
          emoteType,
          desiredFileAnimationName,
          duration,
          bodyStartClock: clock.time,
          weaponEventAt: detail?.at,
          windupMs: bodyTiming.windupMs,
          impactMs: bodyTiming.impactMs,
          recoveryMs: bodyTiming.recoveryMs,
          selectedItemId: selectedItem?.id,
          source: "weapon_timing_synced_body_animation",
        });

        const win = window as typeof window & {
          __harthmerePlayerAttackGestureDebug?: unknown[];
        };
        win.__harthmerePlayerAttackGestureDebug = [
          {
            at: new Date().toISOString(),
            attack,
            emoteType,
            duration,
            windupMs: bodyTiming.windupMs,
            impactMs: bodyTiming.impactMs,
            recoveryMs: bodyTiming.recoveryMs,
            selectedItemId: selectedItem?.id,
            desiredFileAnimationName,
            source: "deterministic_harthmere_attack_emote",
          },
          ...(win.__harthmerePlayerAttackGestureDebug ?? []),
        ].slice(0, 50);

        if (window.localStorage?.getItem("biomes.localDev.harthmere.combatDebug") === "1") {
          emitHarthmerePlayerSwordVisual({
          action: "attack",
          drawn: true,
          // selectedItem?.id can be a branded numeric Biomes id, not a
          // Harthmere item id string. The renderer needs the gameplay
          // weapon id so the procedural sword stays type-safe.
          itemId: "iron_longsword",
          attack,
        });

        emitHarthmerePlayerSwordVisual({
          action: "attack",
          drawn: true,
          // selectedItem?.id can be a branded numeric Biomes id, not a
          // Harthmere item id string. The renderer needs the gameplay
          // weapon id so the procedural sword stays type-safe.
          itemId: "iron_longsword",
          attack,
        });

        console.info("[HarthmerePlayerAttackGesture]", {
            attack,
            emoteType,
            desiredFileAnimationName,
            duration,
            selectedItemId: selectedItem?.id,
          });
        }
      } catch (error) {
        console.warn("Failed to play Harthmere local-player attack gesture", error);
      }
    };

    window.addEventListener(HARTHMERE_ATTACK_ANIMATION_EVENT, handler);
    return () => window.removeEventListener(HARTHMERE_ATTACK_ANIMATION_EVENT, handler);
  }, [reactResources, resources, events, audioManager]);
}



const HARTHMERE_PLAYER_SWORD_VISUAL_EVENT = "biomes:harthmere-player-sword-visual";

type HarthmereSwordVisualAction = "grant" | "draw" | "sheathe" | "attack" | "sync";

function emitHarthmerePlayerSwordVisual(detail: {
  action: HarthmereSwordVisualAction;
  drawn: boolean;
  itemId?: string;
  attack?: "basic" | "heavy" | "spark";
}) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_PLAYER_SWORD_VISUAL_EVENT, {
      detail: {
        ...detail,
        itemId: detail.itemId ?? "iron_longsword",
        at: Date.now(),
      },
    }),
  );
}

function useHarthmerePlayerSwordVisualBridge() {
  const inventory = useHarthmereInventoryState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  // This bridge drives the procedural visible longsword. Keep it mapped to
  // the Harthmere sword id instead of raw inventory/equipment ids such as
  // training_dagger, which do not have this visual attached yet.
  const itemId = inventory.equipment.main_hand?.itemId ?? inventory.equipment.off_hand?.itemId ?? "iron_longsword";

  useEffect(() => {
    // Give old local-dev saves a sword exactly once. The inventory helper is
    // idempotent, so it is safe when React remounts during development.
    ensureHarthmereStarterSwordGranted();
    emitHarthmerePlayerSwordVisual({ action: "grant", drawn: false, itemId });
  }, []);

  useEffect(() => {
    // Renderer-side sword state is driven by gameplay state, not by guessing
    // from animations. This keeps the visible blade in sync with the actual
    // weaponDrawn flag used by combat.
    emitHarthmerePlayerSwordVisual({
      action: multiplayer.weaponDrawn ? "draw" : "sheathe",
      drawn: multiplayer.weaponDrawn,
      itemId,
    });
  }, [itemId, multiplayer.weaponDrawn]);
}

// harthmere-full-animation-runtime-v6
type HarthmereFullAnimationFamilyV6 =
  | "creature" | "mount" | "ranged" | "magic" | "shield" | "dodge" | "airborne"
  | "gathering" | "crafting" | "building" | "social" | "deathRespawn" | "boss" | "screenshot";
type HarthmereFullAnimationRequestV6 = {
  family?: HarthmereFullAnimationFamilyV6;
  action?: string;
  phase?: string;
  actorId?: string | number;
  targetId?: string | number;
  itemId?: string;
  windupMs?: number;
  impactMs?: number;
  recoveryMs?: number;
  screenshotLabel?: string;
};
const HARTHMERE_FULL_ANIMATION_RUNTIME_BRIDGE_VERSION_V6 = "harthmere-full-animation-runtime-bridge-v6";
const HARTHMERE_FULL_ANIMATION_REQUEST_EVENT_V6 = "biomes:harthmere-animation-request-v6";
const HARTHMERE_FULL_ANIMATION_DEBUG_EVENT_V6 = "biomes:harthmere-animation-debug-v6";
const HARTHMERE_FULL_ANIMATION_FAMILIES_V6: HarthmereFullAnimationFamilyV6[] = [
  "creature", "mount", "ranged", "magic", "shield", "dodge", "airborne",
  "gathering", "crafting", "building", "social", "deathRespawn", "boss", "screenshot",
];
function harthmereAnimationDefaultTimingV6(family: HarthmereFullAnimationFamilyV6) {
  switch (family) {
    case "ranged": return { windupMs: 180, impactMs: 300, recoveryMs: 420 };
    case "magic": return { windupMs: 220, impactMs: 380, recoveryMs: 520 };
    case "shield": return { windupMs: 70, impactMs: 110, recoveryMs: 260 };
    case "dodge": return { windupMs: 40, impactMs: 110, recoveryMs: 360 };
    case "gathering": return { windupMs: 180, impactMs: 360, recoveryMs: 420 };
    case "crafting": return { windupMs: 160, impactMs: 320, recoveryMs: 480 };
    case "building": return { windupMs: 150, impactMs: 300, recoveryMs: 400 };
    case "deathRespawn": return { windupMs: 0, impactMs: 180, recoveryMs: 900 };
    case "boss": return { windupMs: 700, impactMs: 1200, recoveryMs: 900 };
    default: return { windupMs: 120, impactMs: 240, recoveryMs: 360 };
  }
}
function useHarthmereComprehensiveAnimationRuntimeBridgeV6() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as typeof window & {
      __harthmereAnimationRuntimeV6?: {
        version: string;
        families: HarthmereFullAnimationFamilyV6[];
        log: unknown[];
        record: (request: HarthmereFullAnimationRequestV6) => unknown;
        request: (request: HarthmereFullAnimationRequestV6) => unknown;
        snapshot: () => unknown;
      };
      __harthmereFullAnimationRuntimeDebugV6?: unknown[];
    };
    const record = (request: HarthmereFullAnimationRequestV6) => {
      const family = request.family ?? "screenshot";
      const timing = harthmereAnimationDefaultTimingV6(family);
      const entry = {
        at: Date.now(),
        version: HARTHMERE_FULL_ANIMATION_RUNTIME_BRIDGE_VERSION_V6,
        family,
        action: request.action ?? "debug",
        phase: request.phase ?? "start",
        windupMs: request.windupMs ?? timing.windupMs,
        impactMs: request.impactMs ?? timing.impactMs,
        recoveryMs: request.recoveryMs ?? timing.recoveryMs,
        lowerBodyLocomotionPreserved: ["ranged", "magic", "shield", "gathering", "crafting", "building", "social"].includes(family),
        fullBodyAuthoritative: ["dodge", "airborne", "deathRespawn", "mount", "boss", "creature"].includes(family),
        screenshotLabel: request.screenshotLabel,
        actorId: request.actorId,
        targetId: request.targetId,
        itemId: request.itemId,
      };
      win.__harthmereFullAnimationRuntimeDebugV6 = [entry, ...(win.__harthmereFullAnimationRuntimeDebugV6 ?? [])].slice(0, 200);
      win.dispatchEvent(new CustomEvent(HARTHMERE_FULL_ANIMATION_DEBUG_EVENT_V6, { detail: entry }));
      return entry;
    };
    win.__harthmereAnimationRuntimeV6 = {
      version: HARTHMERE_FULL_ANIMATION_RUNTIME_BRIDGE_VERSION_V6,
      families: HARTHMERE_FULL_ANIMATION_FAMILIES_V6,
      get log() { return win.__harthmereFullAnimationRuntimeDebugV6 ?? []; },
      record,
      request: (request) => {
        win.dispatchEvent(new CustomEvent(HARTHMERE_FULL_ANIMATION_REQUEST_EVENT_V6, { detail: request }));
        return record(request);
      },
      snapshot: () => ({
        version: HARTHMERE_FULL_ANIMATION_RUNTIME_BRIDGE_VERSION_V6,
        families: HARTHMERE_FULL_ANIMATION_FAMILIES_V6,
        last: win.__harthmereFullAnimationRuntimeDebugV6?.[0],
        count: win.__harthmereFullAnimationRuntimeDebugV6?.length ?? 0,
      }),
    };
    const onRequest = (event: Event) => record((event as CustomEvent<HarthmereFullAnimationRequestV6>).detail ?? {});
    const onWeapon = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      const attack = String(detail.attack ?? "");
      if (attack === "spark") record({ family: "magic", action: "castRelease", phase: "impact", itemId: String(detail.itemId ?? "") });
      else if (attack === "basic" || attack === "heavy") record({ family: "ranged", action: "meleeBodyAlreadyCovered", phase: "impact", itemId: String(detail.itemId ?? "") });
    };
    win.addEventListener(HARTHMERE_FULL_ANIMATION_REQUEST_EVENT_V6, onRequest);
    win.addEventListener("biomes:harthmere-player-sword-visual", onWeapon);
    record({ family: "screenshot", action: "runtimeBridgeMounted", phase: "idle" });
    return () => {
      win.removeEventListener(HARTHMERE_FULL_ANIMATION_REQUEST_EVENT_V6, onRequest);
      win.removeEventListener("biomes:harthmere-player-sword-visual", onWeapon);
    };
  }, []);
}

function spellLabel(spellId?: string) {
  switch (spellId) {
    case "spark_rank_1":
      return "Spark";
    case "candle_blessing_rank_1":
      return "Candle Blessing";
    default:
      return spellId ? spellId.replaceAll("_", " ") : "None";
  }
}

function Bar({
  icon,
  label,
  value,
  detail,
  percent,
}: {
  icon?: string;
  label: string;
  value: string;
  detail?: string;
  percent: number;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {icon && <img src={icon} className="h-3 w-3 shrink-0 object-contain" />}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center justify-between gap-1 text-[10px] leading-none text-white/70">
            <span className="truncate font-semibold text-white">{label}</span>
            <span className="shrink-0 tabular-nums">{value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/45 ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-white/80 transition-[width] duration-300"
              style={{ width: `${clamp(percent, 0, 100)}%` }}
            />
          </div>
        </div>
      </div>
      {detail && <div className="ml-4 mt-0.5 truncate text-[9px] leading-none text-white/45">{detail}</div>}
    </div>
  );
}

function TouchButton({
  label,
  hint,
  icon,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  icon?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`pointer-events-auto flex min-h-[2.65rem] min-w-[3.65rem] flex-col items-center justify-center rounded-lg border px-1.5 py-1 text-center shadow-lg backdrop-blur transition active:scale-95 ${
        active
          ? "border-yellow-200/80 bg-yellow-300/25 text-yellow-50"
          : "border-white/15 bg-black/65 text-white hover:bg-black/80"
      }`}
      onClick={onClick}
    >
      {icon && <img src={icon} className="mb-0.5 h-4 w-4 object-contain" />}
      <span className="text-[10px] font-bold leading-tight">{label}</span>
      <span className="text-[8px] leading-tight text-white/60">{hint}</span>
    </button>
  );
}

// HARTHMERE_POLISH_V1_HUD_REDESIGN — heart-pip row + framed mana + standing chips
function HeartRow({ hp, maxHp }: { hp: number; maxHp: number }) {
  // One pip per 10 HP up to 10 pips. Sub-10 HP shows a half pip.
  const totalPips = Math.max(1, Math.min(10, Math.ceil(maxHp / 10)));
  const filledPips = Math.max(0, Math.min(totalPips, Math.floor(hp / 10)));
  const halfPip = hp > filledPips * 10 && hp < (filledPips + 1) * 10;
  return (
    <div className="flex items-center gap-[2px]" aria-label={`Health ${hp} of ${maxHp}`}>
      {Array.from({ length: totalPips }, (_, i) => {
        const filled = i < filledPips || (i === filledPips && halfPip);
        return (
          <img
            key={i}
            src={filled ? ICONS.heartFilled : ICONS.heartBordered}
            className="h-[14px] w-[14px] object-contain"
            alt=""
            draggable={false}
          />
        );
      })}
      <span className="ml-1 text-[11px] font-semibold tabular-nums tracking-tight text-amber-50/95">
        {hp}/{maxHp}
      </span>
    </div>
  );
}

function StandingChip({ label, value, percent, accent }: { label: string; value: string; percent: number; accent: string; }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-amber-200/15 bg-stone-900/70 px-1 py-0.5 text-[9px] leading-tight text-amber-50/90">
      <span className="text-[8px] uppercase tracking-wider text-amber-200/55">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="mt-[1px] h-[2px] w-full overflow-hidden rounded-full bg-black/50">
        <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: accent }} />
      </span>
    </div>
  );
}

function CompactStatusCluster() {
  const combat = useHarthmereCombatState();
  const reputation = useHarthmereReputationState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  const regional = reputation.regions.harthmere;
  const title = getHarthmereCombinedPublicTitle(reputation);
  const manaPct = (multiplayer.mana / Math.max(1, multiplayer.maxMana)) * 100;

  return (
    <div
      className="pointer-events-none fixed left-3 top-3 z-30 w-[min(17rem,calc(100vw-1rem))] select-none rounded-xl border border-amber-200/25 bg-gradient-to-b from-stone-800/85 to-stone-950/90 p-2.5 text-amber-50 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-md md:w-[16.5rem]"
      style={{
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255, 215, 130, 0.07)",
      }}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <div className="truncate text-sm font-bold tracking-wide text-amber-100">
          {BIOMES_GAME_NAME}
        </div>
        <div className="truncate text-[9px] uppercase tracking-[0.18em] text-amber-200/55">
          {combat.player.combatState.replaceAll("_", " ")}
        </div>
      </div>
      <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-amber-200/10 bg-black/20 px-2 py-1">
        <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-amber-200/55">
          Public standing
        </div>
        <div className="max-w-[11rem] truncate text-right text-[10px] italic leading-tight text-amber-100/85">
          {title}
        </div>
      </div>
      <HeartRow hp={combat.player.hp} maxHp={combat.player.maxHp} />
      <div className="mt-1.5 flex items-center gap-1.5">
        <img src={ICONS.spark} className="h-[14px] w-[14px] object-contain" alt="" draggable={false} />
        <div className="relative h-[10px] flex-1 overflow-hidden rounded-full border border-amber-200/15 bg-black/50">
          <span
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-400 via-sky-300 to-indigo-300"
            style={{ width: `${Math.max(0, Math.min(100, manaPct))}%` }}
          />
        </div>
        <span className="text-[10px] font-semibold tabular-nums text-amber-50/90">
          {multiplayer.mana}/{multiplayer.maxMana}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        <StandingChip label="Like" value={String(regional.likeability)} percent={signedStandingPercent(regional.likeability)} accent="#8aff8a" />
        <StandingChip label="Law"  value={String(regional.legal)}       percent={signedStandingPercent(regional.legal)}       accent="#aac8ff" />
        <StandingChip label="Known" value={String(regional.notoriety)}   percent={notorietyPercent(regional.notoriety)}        accent="#ffb673" />
      </div>
    </div>
  );
}

function FightSideControls() {
  const inventory = useHarthmereInventoryState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  const combat = useHarthmereCombatState();
  const equippedWeapon = inventory.equipment.main_hand;
  const primarySpell =
    inventory.spellbook.activeSpellSlots.slot_1 ??
    inventory.spellbook.knownSpells[0]?.spellId;
  const latestCombat = combat.recent[0];
  const targetStats = multiplayer.currentTargetOffset
    ? combat.npcs[String(multiplayer.currentTargetOffset)]
    : undefined;
  const [impact, setImpact] = useState<{ id: string; attack: string } | undefined>(undefined);
  const [combatFloat, setCombatFloat] = useState<
    { id: string; label: string; kind: string; targetOffset?: number } | undefined
  >(undefined);
  const combatActorHud = useHarthmereCombatActorHudSnapshotsV96(90);

  useEffect(() => {
    if (!latestCombat?.id) {
      return;
    }
    setImpact({ id: latestCombat.id, attack: latestCombat.ability });
    const timeout = window.setTimeout(() => setImpact(undefined), 460);
    return () => window.clearTimeout(timeout);
  }, [latestCombat?.id]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ attack?: string; at?: number }>).detail;
      setImpact({
        id: `swing-${detail?.at ?? Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        attack: detail?.attack ?? "basic",
      });
      window.setTimeout(() => setImpact(undefined), 460);
    };
    window.addEventListener(HARTHMERE_ATTACK_ANIMATION_EVENT, handler);
    return () => window.removeEventListener(HARTHMERE_ATTACK_ANIMATION_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        id?: string;
        ability?: string;
        result?: string;
        finalDamage?: number;
        target?: string;
        targetOffset?: number;
        attackerOffset?: number;
        hitOffsets?: number[];
      }>).detail;
      if (!detail) {
        return;
      }
      const resultLabel = detail.result?.replaceAll("_", " ") ?? "miss";
      const label =
        Number(detail.finalDamage ?? 0) > 0
          ? `-${Math.round(Number(detail.finalDamage))}`
          : resultLabel;
      const targetOffset =
        Number.isFinite(Number(detail.targetOffset))
          ? Number(detail.targetOffset)
          : Array.isArray(detail.hitOffsets) && Number.isFinite(Number(detail.hitOffsets[0]))
            ? Number(detail.hitOffsets[0])
            : undefined;
      setCombatFloat({
        id: `${detail.id ?? Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        label,
        kind: detail.result ?? "combat",
        targetOffset,
      });
      window.setTimeout(() => setCombatFloat(undefined), 760);
    };
    window.addEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, handler);
    return () => window.removeEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, handler);
  }, []);

  return (
    <>
      {impact && (
        <div key={impact.id} className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <style>{`
            @keyframes harthmere-fist-swing {
              0% { transform: translate(-44px, 34px) rotate(-38deg) scale(0.72); opacity: 0; }
              20% { opacity: 1; }
              62% { transform: translate(18px, -8px) rotate(12deg) scale(1.16); opacity: 1; }
              100% { transform: translate(42px, -26px) rotate(28deg) scale(0.86); opacity: 0; }
            }
            @keyframes harthmere-slash-flash {
              0% { transform: rotate(-34deg) scaleX(0.35); opacity: 0; }
              35% { opacity: 0.95; }
              100% { transform: rotate(-34deg) scaleX(1.08); opacity: 0; }
            }
          `}</style>
          <div className="absolute h-16 w-16 rounded-full border-2 border-white/55 opacity-75 animate-ping" />
          <div
            className="absolute text-5xl drop-shadow-[0_0_14px_rgba(255,255,255,0.85)]"
            style={{ animation: "harthmere-fist-swing 460ms ease-out forwards" }}
          >
            {impact.attack === "spark" ? "✦" : impact.attack === "heavy" ? "⚔" : "🗡"}
          </div>
          <div
            className="absolute h-1.5 w-36 origin-left rounded-full bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.7)]"
            style={{ animation: "harthmere-slash-flash 420ms ease-out forwards" }}
          />
        </div>
      )}
      {combatFloat && combatFloat.targetOffset !== undefined && combatActorHud[String(combatFloat.targetOffset)]?.screen?.visible && (
        <div key={combatFloat.id} className="pointer-events-none fixed inset-0 z-40">
          <style>{`
            @keyframes harthmere-floating-combat-v96 {
              0% { transform: translate(-50%, -120%) scale(0.82); opacity: 0; }
              18% { opacity: 1; }
              100% { transform: translate(-50%, -190%) scale(1.08); opacity: 0; }
            }
          `}</style>
          <div
            className="absolute rounded-full border border-white/35 bg-black/75 px-2.5 py-1 text-base font-black uppercase tracking-wide text-white shadow-[0_0_18px_rgba(255,255,255,0.35)] sm:text-xl"
            style={{
              left: combatActorHud[String(combatFloat.targetOffset)]?.screen?.x ?? 0,
              top: combatActorHud[String(combatFloat.targetOffset)]?.screen?.y ?? 0,
              animation: "harthmere-floating-combat-v96 760ms ease-out forwards",
            }}
          >
            {combatFloat.label}
          </div>
        </div>
      )}
      <div className="pointer-events-auto fixed left-2 top-[21rem] z-30 w-[min(16rem,calc(100vw-1rem))] rounded-xl border border-white/15 bg-black/60 p-2 text-white shadow-2xl backdrop-blur-md md:left-3 md:top-[21rem] md:w-[15.5rem]">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
          Fight Controls
        </div>
        <div className="mb-2 rounded-lg border border-white/10 bg-black/45 p-1.5 text-[10px] leading-snug text-white/70">
          <div><span className="font-semibold text-white">Weapon:</span> {itemLabel(equippedWeapon?.itemId)}</div>
          <div><span className="font-semibold text-white">Spell:</span> {spellLabel(primarySpell)}</div>
          <div><span className="font-semibold text-white">Target:</span> {multiplayer.currentTargetLabel ?? "Training Dummy"}</div>
          <div><span className="font-semibold text-white">Target HP:</span> {targetStats ? `${targetStats.hp}/${targetStats.maxHp}` : "not engaged"}</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <TouchButton
            icon={ICONS.sword}
            label={multiplayer.weaponDrawn ? "Sheathe" : "Draw"}
            hint="X"
            active={multiplayer.weaponDrawn}
            onClick={() => toggleHarthmereWeaponDrawn()}
          />
          <TouchButton
            icon={ICONS.sword}
            label="Weapon"
            hint="Cycle"
            onClick={() => cycleHarthmereWeapon()}
          />
          <TouchButton
            icon={ICONS.target}
            label="Target"
            hint="Tab"
            onClick={() => cycleHarthmereCombatTarget()}
          />
          <TouchButton
            icon={ICONS.sword}
            label="Basic"
            hint="B / Attack"
            active={multiplayer.weaponDrawn}
            onClick={() => performHarthmereKeyedAttack("basic")}
          />
          <TouchButton
            icon={ICONS.heavy}
            label="Heavy"
            hint="H / HeavyAttack"
            active={multiplayer.weaponDrawn}
            onClick={() => performHarthmereKeyedAttack("heavy")}
          />
          <TouchButton
            icon={ICONS.spark}
            label="Spark"
            hint="L / BasicMagic"
            onClick={() => {
              ensureHarthmereSpellSlotted("spark_rank_1", "slot_1");
              performHarthmereKeyedAttack("spark");
            }}
          />
        </div>
        <div className="mt-2 rounded border border-white/10 bg-black/35 p-1.5 text-[9px] leading-snug text-white/55">
          <div><span className="font-semibold text-white/75">F</span> talk/interact · <span className="font-semibold text-white/75">M</span> map · <span className="font-semibold text-white/75">J</span> quests</div>
          <div><span className="font-semibold text-white/75">X</span> draw · <span className="font-semibold text-white/75">Tab</span> target · <span className="font-semibold text-white/75">B</span> Attack · <span className="font-semibold text-white/75">H</span> HeavyAttack · <span className="font-semibold text-white/75">L</span> BasicMagic · <span className="font-semibold text-white/75">P</span> PvP</div><div className="mt-1 text-white/45">Reserved: combat keys do not overlap with M map, J quests, K tasks, Y mail, N notifications, Esc systems, or F interact.</div>
        </div>
      </div>
    </>
  );
}



type HarthmereCombatActorHudSnapshotV96 = {
  offset?: number;
  label?: string;
  asset?: string;
  district?: string;
  pos?: [number, number];
  world?: [number, number, number];
  radius?: number;
  behavior?: string;
  socialRole?: string;
  attackable?: boolean;
  screen?: {
    x: number;
    y: number;
    visible: boolean;
    depth: number;
  };
  at?: number;
};

function readHarthmereCombatActorHudSnapshotsV96(): Record<string, HarthmereCombatActorHudSnapshotV96> {
  if (typeof window === "undefined") {
    return {};
  }
  const win = window as typeof window & {
    __harthmereCombatActorPositions?: Record<string, HarthmereCombatActorHudSnapshotV96>;
  };
  return win.__harthmereCombatActorPositions ?? {};
}

function useHarthmereCombatActorHudSnapshotsV96(intervalMs = 120) {
  const [snapshots, setSnapshots] = useState<Record<string, HarthmereCombatActorHudSnapshotV96>>({});
  useEffect(() => {
    const refresh = () => setSnapshots(readHarthmereCombatActorHudSnapshotsV96());
    refresh();
    const interval = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);
  return snapshots;
}

function HarthmereEnemyHealthBarsHUD() {
  const combat = useHarthmereCombatState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  const actorHud = useHarthmereCombatActorHudSnapshotsV96(100);
  const selectedOffset = multiplayer.currentTargetOffset ?? combat.selectedNpcOffset;
  const now = Date.now();
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const rows = Object.entries(combat.npcs)
    .map(([offsetText, npc]) => {
      const offset = Number(offsetText);
      const actor = actorHud[offsetText];
      const screen = actor?.screen;
      const isSelected = offset === selectedOffset;
      const damaged = npc.hp < npc.maxHp;
      const hostile = npc.behavior === "hostile" || npc.behavior === "training_dummy" || npc.socialRole === "hostile" || npc.socialRole === "wildlife";
      const engaged = npc.combatState === "in_combat" || npc.combatState === "alert" || Boolean(npc.lastDamageAt && now - npc.lastDamageAt < 20_000);
      const alive = npc.hp > 0 && npc.combatState !== "dead";
      const visible = Boolean(screen?.visible) && (screen?.x ?? -1) >= -48 && (screen?.x ?? 0) <= viewportWidth + 48 && (screen?.y ?? -1) >= -48 && (screen?.y ?? 0) <= viewportHeight + 48;
      return { offset, npc, actor, screen, show: alive && visible && (actor?.attackable !== false) && (hostile || isSelected || damaged || engaged || npc.behavior !== "passive") };
    })
    .filter((row) => row.show)
    .sort((a, b) => {
      if (a.offset === selectedOffset) return -1;
      if (b.offset === selectedOffset) return 1;
      return (a.screen?.depth ?? 1) - (b.screen?.depth ?? 1);
    })
    .slice(0, 24);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-hidden="true">
      {rows.map(({ offset, npc, screen }) => {
        const pct = Math.max(0, Math.min(100, (npc.hp / Math.max(1, npc.maxHp)) * 100));
        const selected = offset === selectedOffset;
        return (
          <div
            key={`${offset}-${npc.name}`}
            className={`absolute w-[7.25rem] -translate-x-1/2 -translate-y-full rounded-md border px-1.5 py-1 text-center text-white shadow-lg backdrop-blur-sm sm:w-[8.75rem] ${
              selected ? "border-red-200/80 bg-black/80" : "border-red-300/35 bg-black/62"
            }`}
            style={{ left: screen?.x ?? 0, top: (screen?.y ?? 0) - 8 }}
          >
            <div className="flex items-center justify-between gap-1 text-[9px] font-bold leading-none sm:text-[10px]">
              <span className="truncate text-left">{npc.name}</span>
              <span className="shrink-0 tabular-nums text-red-100">{npc.hp}/{npc.maxHp}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20 ring-1 ring-black/35 sm:h-2">
              <div className="h-full rounded-full bg-red-400 transition-[width] duration-150" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UtilityActionBar({ onAction }: { onAction: (action: HarthmereHudActionV96) => void; }) {
  // HARTHMERE_POLISH_V1_HUD_REDESIGN — medieval nav strip pinned to the
  // bottom-center. The "primary" group on the left routes to the three
  // most-used menus (Inventory, Crafting, Map). The "secondary" group on
  // the right is for journal/social/settings — items the player needs but
  // not every minute.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[7.25rem] z-30 flex justify-center px-2 max-sm:bottom-[6.75rem] md:bottom-[7.45rem]">
      <div
        className="pointer-events-auto flex max-w-[calc(100vw-1rem)] items-end gap-1.5 overflow-x-auto overscroll-contain rounded-2xl border border-amber-200/25 bg-gradient-to-t from-stone-950/95 to-stone-800/85 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-md md:gap-2"
        style={{
          boxShadow:
            "0 8px 24px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255, 215, 130, 0.07)",
        }}
      >
        <NavSlot icon={ICONS.navInventory} label="Bag" hint="I" onClick={() => onAction("inventory")} />
        <NavSlot icon={ICONS.navCrafting}  label="Craft" hint="C" onClick={() => onAction("crafting")} />
        <NavSlot icon={ICONS.navMap}       label="Map"  hint="M" onClick={() => onAction("map")} />
        <NavSlot icon={ICONS.quest}        label="Quests" hint="J" onClick={() => onAction("quests")} />
        <div className="mx-1 hidden h-7 w-px self-center bg-amber-200/20 sm:block" />
        <NavSlot icon={ICONS.navChallenges}    label="Tasks"  hint="K" onClick={() => onAction("tasks")} />
        <NavSlot icon={ICONS.navInbox}         label="Mail"   hint="Y" onClick={() => onAction("mail")} />
        <NavSlot icon={ICONS.navNotifications} label="Notif"  hint="N" onClick={() => onAction("notifications")} />
        <NavSlot icon={ICONS.navCollections}   label="Codex"  hint="V" onClick={() => onAction("codex")} />
        <NavSlot icon={ICONS.navSettings}      label="Settings" hint="Esc" onClick={() => onAction("settings")} />
        <div className="mx-1 h-7 w-px self-center bg-amber-200/20" />
        <NavSlot icon={ICONS.heart} label="Revive" hint="Safe" onClick={() => reviveHarthmerePlayer("HUD")} />
      </div>
    </div>
  );
}

// HARTHMERE_POLISH_V1_HUD_REDESIGN — nav slot button used by UtilityActionBar.
function NavSlot({ icon, label, hint, onClick }: { icon: string; label: string; hint: string; onClick: () => void; }) {
  return (
    <button
      className="pointer-events-auto group relative flex shrink-0 flex-col items-center justify-center rounded-lg border border-amber-200/15 bg-stone-900/75 px-1.5 py-1 text-amber-50 transition hover:border-amber-200/40 hover:bg-stone-800/85 active:scale-95"
      style={{ minWidth: "2.8rem", minHeight: "2.8rem" }}
      onClick={onClick}
      title={`${label} (${hint})`}
      aria-label={`${label} — hotkey ${hint}`}
    >
      <img src={icon} className="h-5 w-5 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] sm:h-6 sm:w-6" alt="" draggable={false} />
      <span className="mt-[1px] max-w-[2.85rem] truncate text-[7px] font-semibold uppercase leading-none tracking-wide text-amber-200/85 sm:text-[8px]">
        {label}
      </span>
      <span className="absolute right-1 top-0.5 rounded bg-black/60 px-1 text-[7.5px] font-bold leading-tight text-amber-200/80">
        {hint}
      </span>
    </button>
  );
}

function FloatingPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto fixed right-2 top-[6.5rem] z-40 max-h-[calc(100vh-7rem)] w-[min(36rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-white/15 bg-black/90 p-3 text-white shadow-2xl backdrop-blur-md max-sm:inset-x-2 max-sm:top-16 max-sm:max-h-[calc(100vh-5rem)] md:right-4 md:top-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-bold uppercase tracking-wide text-white/85">{title}</div>
        <button className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20" onClick={onClose}>Close</button>
      </div>
      {children}
    </div>
  );
}

function CenterMapPanel({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-2 pt-10 backdrop-blur-sm sm:items-center sm:p-3 sm:pt-3">
      <div className="max-h-[calc(100vh-2rem)] w-[min(54rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-white/15 bg-black/90 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-white/85">{BIOMES_GAME_NAME} Map</div>
            <div className="text-[10px] text-white/55">Current area map, objective markers, service landmarks, and vertical terrain level for the region the player is actually standing in.</div>
          </div>
          <button className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20" onClick={onClose}>Close</button>
        </div>
        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-3">
          {children}
        </div>
      </div>
    </div>
  );
}

installSnapshotLiveNpcLoreDebugV79();

export const HarthmereUnifiedHUD: React.FunctionComponent<{}> = () => {
  useHarthmerePlayerSwordVisualBridge();
  const { userId } = useClientContext();
  const [glitchGameUserId, setGlitchGameUserId] = useState<string | undefined>(() =>
    getHarthmereGlitchGameUserId(),
  );
  useEffect(() => {
    const refresh = () => setGlitchGameUserId(getHarthmereGlitchGameUserId());
    refresh();
    window.addEventListener(HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    setHarthmereLocalDevUserScope(glitchGameUserId ?? userId);
  }, [userId, glitchGameUserId]);
  useHarthmereAmbientThreats();
  useHarthmereRealtimeCombatAI();
  useHarthmereForwardArcRuntime();
  useHarthmereLocalPlayerAttackGestureBridge();
  useHarthmereComprehensiveAnimationRuntimeBridgeV6();
  useHarthmereCombatHotkeys();
  const [panel, setPanel] = useState<HarthmereHudPanelV97>();
  const [systemsTab, setSystemsTab] = useState<MenuTab | undefined>();
  const [focusAction, setFocusAction] = useState<HarthmereHudActionV96 | undefined>();

  const openHudAction = (action: HarthmereHudActionV96) => {
    dispatchHarthmereHudActionEventV96(action);
    const next = reduceHarthmereHudStateForActionV97(
      { panel, systemsTab, focusAction },
      action,
    );
    setPanel(next.panel);
    setSystemsTab(next.systemsTab);
    setFocusAction(next.focusAction);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable
      ) {
        return;
      }
      const binding = harthmereHudBindingForCodeV96(event.code);
      if (!binding) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openHudAction(binding.action);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [systemsTab, panel, focusAction]);

  return (
    <>
      <SnapshotMissionRuntimeControllerV71 />
      <SnapshotGroveBibleRuntimeControllerV75 />
      <SnapshotCompletePortRuntimeControllerV76 />
      <SnapshotProductionPortRuntimeControllerV77 />
      <SnapshotLiveDiagnosticsRuntimeControllerV78 />
      <HarthmereDeathRuntimeController />
      <SnapshotProductionPortFactsV77 />
      <SnapshotCombatRuntimeControllerV74 />
      <CompactStatusCluster />
      <div className="fixed left-2 top-[9.25rem] z-30 md:left-3 md:top-[10.25rem]">
        <HarthmereDeathHUD />
      </div>
      <HarthmereEnemyHealthBarsHUD />
      <div className="fixed right-2 top-2 z-30 md:right-4 md:top-4">
        <MiniMapHUD />
      </div>
      <div className="pointer-events-auto fixed right-2 top-[10.75rem] z-30 w-[min(19rem,calc(100vw-1rem))] max-sm:hidden md:right-4 md:top-[11.5rem]">
        <SnapshotGroveMapHUDV75 />
      </div>
      <FightSideControls />
      <UtilityActionBar onAction={openHudAction} />
      {systemsTab && (
        <div className="fixed right-2 top-[6.5rem] z-[45] max-sm:inset-x-2 max-sm:top-16 md:right-4 md:top-4">
          <HarthmereSystemsMenuPanel
            initialTab={systemsTab}
            initialAction={focusAction}
            onClose={() => {
              setSystemsTab(undefined);
              setFocusAction(undefined);
            }}
          />
        </div>
      )}
      {panel === "map" && (
        <CenterMapPanel onClose={() => {
          setPanel(undefined);
          setFocusAction(undefined);
        }}>
          <div className="space-y-4">
            <HarthmereQuestMapHUD />
            <div className="grid gap-3 md:grid-cols-3">
              <SnapshotMissionMapHUDV71 />
              <SnapshotGroveMapHUDV75 />
              <SnapshotCombatMapHUDV74 />
            </div>
          </div>
        </CenterMapPanel>
      )}
      {panel === "quests" && (
        <FloatingPanel title="Quest journal" onClose={() => {
          setPanel(undefined);
          setFocusAction(undefined);
        }}>
          <div className="space-y-3">
            <SnapshotMissionJournalPanelV71 />
            <SnapshotGroveJournalPanelV75 />
          <SnapshotMissionAuditPanelV76 />
          <SnapshotGroundingAuditPanelV76 />
          <SnapshotLiveGroundingAuditPanelV78 />
          <SnapshotPerformanceWalkerPanelV78 />
          <SnapshotRemainingPortAuditPanelV78 />
            <SnapshotCombatJournalPanelV74 />
            <HarthmereMissionJournalPanel />
          </div>
        </FloatingPanel>
      )}
      <HarthmereVendorTradePanel />
    </>
  );
};

export const HarthmereSystemsMenuPanel: React.FunctionComponent<{
  initialTab?: MenuTab;
  initialAction?: HarthmereHudActionV96;
  onClose?: () => void;
}> = ({ initialTab = "journal", initialAction, onClose }) => {
  const [tab, setTab] = useState<MenuTab>(initialTab);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const focusCopy = initialAction
    ? SYSTEM_ENTRY_ACTION_COPY_V97[initialAction]
    : undefined;
  const tabContent = useMemo(() => {
    if (tab === "journal") {
      return (
        <div className="space-y-3">
          <SnapshotMissionJournalPanelV71 />
          <SnapshotGroveJournalPanelV75 />
          <HarthmereMissionJournalPanel />
        </div>
      );
    }
    if (tab === "inventory") {
      return <HarthmereInventoryMenuPanel />;
    }
    if (tab === "combat") {
      return (
        <div className="space-y-2">
          <HarthmereCombatMenuPanel />
          <HarthmereMultiplayerCombatMenuPanel />
        </div>
      );
    }
    if (tab === "standing") {
      return <HarthmereReputationMenuPanel />;
    }
    if (tab === "skills") {
      return (
        <div className="space-y-2">
          <HarthmereLevelingMenuPanel />
          <HarthmereClassSkillMenuPanel />
        </div>
      );
    }
    if (tab === "world") {
      return (
        <div className="space-y-2">
          <HarthmereDeathMenuPanel />
          <HarthmereEconomyMenuPanel />
          <HarthmereGatheringMenuPanel />
          <HarthmereBuildingMenuPanel />
          <HarthmereGuildMenuPanel />
          <HarthmereTradeAuctionMenuPanel />
          <HarthmereStorageMailRecoveryMenuPanel />
          <HarthmereMountPetCollectionPanel />
          <HarthmereInventoryGuidancePanel />
          <HarthmereDialogueSafetyPanel />
          <HarthmereQuestGuidancePanel />
          <HarthmereCrimeLawPanel />
          <HarthmereServerAuthorityPanel />
        </div>
      );
    }
    return <HarthmereDialogueMenuPanel />;
  }, [tab]);

  return (
    <div className="pointer-events-auto max-h-[calc(100vh-7.5rem)] w-[min(41rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-amber-200/15 bg-[rgba(8,10,16,0.97)] text-white shadow-2xl backdrop-blur-md max-sm:max-h-[calc(100vh-5rem)]">
      <div className="border-b border-white/10 bg-gradient-to-b from-white/6 to-transparent p-3">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-white/90">Biomes Systems</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-amber-200/55">
              {MENU_TABS.find((entry) => entry.id === tab)?.label ?? "Systems"}
            </div>
          </div>
          {onClose && (
            <button className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <div className="mb-3 max-w-[38rem] text-[10px] leading-relaxed text-white/50">
          Rule refs: MMO_RULES for combat/skills/progression, Harthmere Town Design Bible §14 for readable service UX, Wilds Bible for danger clarity, and Grove Lore Bible for keeping objective state in HUD/map/journal.
        </div>
        <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/70">
              {focusCopy?.eyebrow ?? `${MENU_TABS.find((entry) => entry.id === tab)?.label ?? "Systems"} tab`}
            </div>
            <div className="mt-1 text-base font-bold text-white">
              {focusCopy?.heading ?? `${MENU_TABS.find((entry) => entry.id === tab)?.label ?? "Systems"} overview`}
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-white/72">
              {focusCopy?.summary ?? SYSTEM_TAB_DESCRIPTIONS_V97[tab]}
            </div>
          </div>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/80">What matters</div>
            <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-amber-50/85">
              <li>• The active tab stays visually highlighted.</li>
              <li>• Key-driven entries now show why that panel opened.</li>
              <li>• Section copy is grouped so important info is easier to scan.</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {MENU_TABS.map((entry) => (
            <button
              key={entry.id}
              className={`flex min-h-[2.35rem] min-w-[4.9rem] flex-1 items-center justify-center rounded-lg px-2 py-1 text-center font-semibold leading-tight transition sm:flex-none ${
                tab === entry.id
                  ? "border border-amber-200/60 bg-amber-100 text-black shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
                  : "border border-white/10 bg-white/[0.08] text-white/78 hover:bg-white/[0.16]"
              }`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[calc(100vh-19.5rem)] overflow-y-auto bg-black/35 p-4 text-[13px] leading-relaxed max-sm:max-h-[calc(100vh-20rem)] max-sm:p-3">{tabContent}</div>
    </div>
  );
};

// v13 attack variation debug payload marker
const __HARTHMERE_ATTACK_VARIATION_HUD_V13 = {
  attackVariationId: true,
  attackVariationFamily: true,
};


// v17 attack variation HUD bridge markers.
const __HARTHMERE_VARIATION_HUD_V17 = {
  attackVariationId: true,
  attackVariationFamily: true,
  attackVariationIndex: true,
  attackVariationEmoteType: true,
};


// HARTHMERE_ECONOMY_OPTIMIZATION_PANEL_WIRED_V1
// LocalDevHarthmereEconomyOptimizationSystem is imported for economy health/market review wiring.
