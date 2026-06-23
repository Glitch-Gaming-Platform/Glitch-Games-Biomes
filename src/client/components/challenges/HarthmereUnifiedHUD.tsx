import { installSnapshotLiveNpcLoreDebug } from "@/client/components/challenges/LocalDevSnapshotLiveNpcLoreRuntime";
import { HarthmereServerAuthorityPanel } from "@/client/components/challenges/LocalDevHarthmereServerAuthorityContracts";
import { HarthmereCrimeLawPanel } from "@/client/components/challenges/LocalDevHarthmereCrimeLawSystem";
import { HarthmereQuestGuidancePanel } from "@/client/components/challenges/LocalDevHarthmereQuestGuidanceSystem";
import { HarthmereDialogueSafetyPanel } from "@/client/components/challenges/LocalDevHarthmereDialogueSafetySystem";
import { HarthmereInventoryGuidancePanel } from "@/client/components/challenges/LocalDevHarthmereInventoryGuidance";
import { HarthmereMountPetCollectionPanel } from "@/client/components/challenges/LocalDevHarthmereMountPetCollections";
// harthmere-no-spark-basic-hud
import { HarthmereBuildingMenuPanel } from "@/client/components/challenges/LocalDevHarthmereBuildingSystem";
import {
  HARTHMERE_COMBAT_EFFECT_EVENT,
  HarthmereCombatMenuPanel,
  reviveHarthmerePlayer,
  useHarthmereAmbientThreats,
  useHarthmereCombatState,
  useHarthmereDrowningDamageBridge,
  useHarthmereFallDamageBridge,
  useHarthmereForwardArcRuntime,
  useHarthmerePvpIncomingDamageBridge,
  useHarthmereRealtimeCombatAI,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import { HarthmereClassSkillMenuPanel } from "@/client/components/challenges/LocalDevHarthmereClassSkillSystem";
import {
  HarthmereDeathHUD,
  HarthmereDeathMenuPanel,
  HarthmereDeathRuntimeController,
  HarthmereDeathScreenOverlay,
  useHarthmereDeathState,
} from "@/client/components/challenges/LocalDevHarthmereDeathSystem";
import {
  HarthmereCampfireWarmthRuntimeController,
  HarthmereFoodStaminaRuntimeController,
  useHarthmereFoodStaminaState,
} from "@/client/components/challenges/LocalDevHarthmereFoodStaminaSystem";
import { HarthmereDialogueMenuPanel } from "@/client/components/challenges/LocalDevHarthmereDialogueSystem";
import { HarthmereEconomyMenuPanel } from "@/client/components/challenges/LocalDevHarthmereEconomySystem";
import { HarthmereGatheringMenuPanel } from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import { HarthmereGuildMenuPanel } from "@/client/components/challenges/LocalDevHarthmereGuildSystem";
import { HarthmereTradeAuctionMenuPanel } from "@/client/components/challenges/LocalDevHarthmereTradeAuctionSystem";
import { HarthmereStorageMailRecoveryMenuPanel } from "@/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem";
import { HarthmereObjectContainerPanel } from "@/client/components/challenges/HarthmereObjectContainerPanel";
import { HarthmereCookingStationPanel } from "@/client/components/harthmere_cooking/HarthmereCookingStationPanel";
import { HarthmereGatheringNodeWorldInteraction } from "@/client/components/challenges/HarthmereGatheringNodeWorldInteraction";
import { HarthmereLootDropWorldInteraction } from "@/client/components/challenges/HarthmereLootDropWorldInteraction";
import {
  HarthmereInventoryMenuPanel,
  HarthmereNativeTerrainBlockInventoryBridge,
  HarthmereVendorTradePanel,
  cycleHarthmereWeapon,
  ensureHarthmereSpellSlotted,
  ensureHarthmereStarterSwordGranted,
  readHarthmereInventoryState,
  useHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  HARTHMERE_INVENTORY_EVENT,
  HARTHMERE_JOBS_BOARD_OPEN_EVENT,
} from "@/client/components/challenges/harthmereEvents";
import { harthmereLocalEquipmentBikkieWearables } from "@/shared/harthmere/harthmere_bikkie_wearables";
import { Wearing } from "@/shared/ecs/gen/components";
import { anItem } from "@/shared/game/item";
import { HarthmereLevelingMenuPanel } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { HarthmereMissionJournalPanel } from "@/client/components/challenges/LocalDevHarthmereMissionSystem";
import {
  SnapshotMissionJournalPanel,
  SnapshotMissionMapHUD,
  SnapshotMissionRuntimeController,
} from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import {
  SnapshotCombatJournalPanel,
  SnapshotCombatMapHUD,
  SnapshotCombatRuntimeController,
} from "@/client/components/challenges/LocalDevSnapshotCombatRuntime";
import {
  openSnapshotGroveTutorChatPanel,
  SnapshotGroveBibleRuntimeController,
  SnapshotGroveJournalPanel,
  SnapshotGroveMapHUD,
  SnapshotGroveTutorChatPanel,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  SnapshotCompletePortRuntimeController,
  SnapshotGroundingAuditPanel,
  SnapshotMissionAuditPanel,
  SnapshotPortStatusPanel,
} from "@/client/components/challenges/LocalDevSnapshotCompletePort";
import {
  SnapshotProductionPortFacts,
  SnapshotProductionPortRuntimeController,
  SnapshotProductionPortStatusPanel,
} from "@/client/components/challenges/SnapshotProductionPort";
import {
  SnapshotLiveDiagnosticsRuntimeController,
  SnapshotLiveGroundingAuditPanel,
  SnapshotPerformanceWalkerPanel,
  SnapshotRemainingPortAuditPanel,
} from "@/client/components/challenges/SnapshotLiveDiagnostics";
import {
  HARTHMERE_ATTACK_ANIMATION_EVENT,
  HarthmereMultiplayerCombatMenuPanel,
  cycleHarthmereCombatTarget,
  performHarthmereKeyedAttack,
  toggleHarthmereWeaponDrawn,
  useHarthmereCombatHotkeys,
  useHarthmereMultiplayerCombatState,
} from "@/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem";
import {
  HarthmereQuestMapHUD,
  HarthmereQuestNavAidController,
} from "@/client/components/challenges/LocalDevHarthmereQuests";
import { HarthmereHomeConsoleLiveContainer } from "@/client/components/harthmere_home";
import { HarthmereBusinessLiveContainer } from "@/client/components/harthmere_business";
import { nearestHarthmereBusinessBoardPhysicalPrompt } from "@/client/game/renderers/local_dev/harthmere_business_board_marker";
import { HarthmereJobsBoardLiveContainer } from "@/client/components/harthmere_jobs_board";
import {
  HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
  nearestHarthmereJobsBoardPhysicalPrompt,
  type HarthmereJobsBoardWorldContext,
} from "@/client/components/harthmere_jobs_board";
import {
  harthmereJobsBoardCameraPosition,
  harthmereJobsBoardPlayerPosition,
} from "@/client/components/harthmere_jobs_board/harthmereJobsBoardPosition";
import {
  closeHarthmereJobsBoardPointerLock,
  openHarthmereJobsBoardPointerLock,
} from "@/client/components/harthmere_jobs_board/jobsBoardPointerLock";
import {
  HarthmereReputationMenuPanel,
  getHarthmereCombinedPublicTitle,
  useHarthmereReputationState,
} from "@/client/components/challenges/LocalDevHarthmereReputation";
import { MiniMapHUD } from "@/client/components/MiniMapHUD";
import {
  biomesUIVitalsCombatResourceDisplayForTest,
  biomesUIVitalsDisplayFromLiveStatusForTest,
  biomesUIVitalsStaminaDisplayForTest,
  useBiomesUIPlayerStatusState,
} from "@/client/components/biomes_ui/adapters/playerStatusAdapter";
import { useBiomesHUDVisibilitySnapshot } from "@/client/components/biomes_ui/hudVisibilitySettings";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { setHarthmereLocalDevUserScope } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT,
  getHarthmereGlitchGameUserId,
} from "@/client/game/glitch/harthmere_glitch_identity";
import React, { useEffect, useMemo, useState } from "react";
import { Vector3 } from "three";
import { LocalDevHarthmereEconomyOptimizationSystem } from "./LocalDevHarthmereEconomyOptimizationSystem";
import LocalDevHarthmereDialogueRuleSystemPanel from "./LocalDevHarthmereDialogueRuleSystem";
import {
  BIOMES_GAME_NAME,
  BIOMES_HARTHMERE_TOWN_NAME,
} from "@/shared/biomes/display_names";
import {
  dispatchHarthmereHudActionEvent,
  harthmereHudBindingForCode,
  type HarthmereHudAction,
  type HarthmereHudSystemTab,
} from "@/shared/harthmere/harthmere_hud_key_bindings";
import {
  reduceHarthmereHudStateForAction,
  type HarthmereHudPanel,
} from "@/shared/harthmere/harthmere_hud_state";
export { reduceHarthmereHudStateForAction } from "@/shared/harthmere/harthmere_hud_state";

// HARTHMERE_POLISH_HUD_REDESIGN — switched to the in-house medieval pack
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

type MenuTab =
  | "journal"
  | "inventory"
  | "combat"
  | "standing"
  | "skills"
  | "world"
  | "dialogue";

const HARTHMERE_MENU_TABS_COVER_SHARED_BINDINGS: Record<
  HarthmereHudSystemTab,
  true
> = {
  journal: true,
  inventory: true,
  combat: true,
  standing: true,
  skills: true,
  world: true,
  dialogue: true,
};
void HARTHMERE_MENU_TABS_COVER_SHARED_BINDINGS;

const MENU_TABS: { id: MenuTab; label: string }[] = [
  { id: "journal", label: "Journal" },
  { id: "inventory", label: "Inventory" },
  { id: "combat", label: "Combat" },
  { id: "standing", label: "Standing" },
  { id: "skills", label: "Skills" },
  { id: "world", label: "World" },
  { id: "dialogue", label: "Dialogue Rules" },
];

const SYSTEM_TAB_DESCRIPTIONS: Record<MenuTab, string> = {
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

// SYSTEM_TAB_HIGHLIGHTS: in-world, production-ready bullets per panel.
// These replace the older dev-facing "What matters" copy ("The active tab
// stays visually highlighted", etc.) that read as debug notes.
const SYSTEM_TAB_HIGHLIGHTS: Record<MenuTab, string[]> = {
  journal: [
    "Your active lesson is at the top with its next stop.",
    "Each finished step gets a green check so the road feels traceable.",
    "Rewards and milestones land here as you earn them.",
  ],
  inventory: [
    "Bag, equipment, wallet, and bank all share one calm screen.",
    "Drag items to the hotbar for hands-free access on the road.",
    "Use Sort or Deposit Materials when the bag feels heavy.",
  ],
  combat: [
    "Targeting is opt-in: weapons draw before you can strike.",
    "PvP needs consent in safe zones, no farming new arrivals.",
    "Threat icons show when something nearby is actually angry.",
  ],
  standing: [
    "Standing rises with helpful work and falls with theft or harm.",
    "Guards and shopkeepers react to your current Like and Law numbers.",
    "Notoriety fades over time if you stop the behaviour that earned it.",
  ],
  skills: [
    "Levels come from finished lessons and real practice, not idle time.",
    "Each class branch unlocks a few starter habits before the deep skills.",
    "Recent XP shows you what the world rewarded most lately.",
  ],
  world: [
    "Service counters — mail, bank, repair, recovery — live together here.",
    "Crafting, building, and gathering each have their own quiet rules.",
    "Guild banks and safe-zone law affect what you can do where.",
  ],
  dialogue: [
    "NPCs remember the last few topics you brought up.",
    "Tone shifts with your standing in town and with that person.",
    "Codex references collect the lore you've heard and read so far.",
  ],
};

const SYSTEM_ENTRY_ACTION_COPY: Record<
  HarthmereHudAction,
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

// HARTHMERE_SYSTEMS_MENU_FOCUS_NAV:
// The right-side black Systems menu is a keyboard-first onboarding surface.
// Every interactive item inside every tab must be visibly focusable, arrow-key
// navigable, and activatable with Return/Space. The handler is scoped to the
// menu root so Enter still belongs to chat whenever focus is in chat UI.
const SYSTEM_MENU_SELECTABLE_QUERY = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[role='button']:not([aria-disabled='true'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isTextEntryElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

function ensureHarthmereSystemsMenuFocusStyles() {
  if (typeof document === "undefined") return;
  const id = "harthmere-systems-menu-focus-nav";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes harthmereSystemsMenuJump {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-2px) scale(1.018); }
}
[data-harthmere-system-menu="true"] button,
[data-harthmere-system-menu="true"] a[href],
[data-harthmere-system-menu="true"] input,
[data-harthmere-system-menu="true"] select,
[data-harthmere-system-menu="true"] textarea,
[data-harthmere-system-menu="true"] [role="button"] {
  scroll-margin: 5rem;
}
[data-harthmere-system-menu="true"] button:focus-visible,
[data-harthmere-system-menu="true"] a[href]:focus-visible,
[data-harthmere-system-menu="true"] input:focus-visible,
[data-harthmere-system-menu="true"] select:focus-visible,
[data-harthmere-system-menu="true"] textarea:focus-visible,
[data-harthmere-system-menu="true"] [role="button"]:focus-visible,
[data-harthmere-system-menu="true"] [data-harthmere-system-nav-focused="true"] {
  outline: 2px solid rgba(253, 224, 71, 0.98) !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.9), 0 0 18px rgba(253, 224, 71, 0.55) !important;
  animation: harthmereSystemsMenuJump 0.78s ease-in-out infinite;
  position: relative;
  z-index: 2;
}
[data-harthmere-system-menu="true"] [data-tutor-panel-highlighted="true"] {
  border-color: rgba(253, 224, 71, 0.75) !important;
  box-shadow: 0 0 0 1px rgba(253, 224, 71, 0.22), 0 0 22px rgba(253, 224, 71, 0.35) !important;
}
[data-harthmere-system-menu="true"] [data-harthmere-tutorial-item-highlight="true"] {
  border-color: rgba(190, 242, 100, 0.78) !important;
  background: rgba(101, 163, 13, 0.22) !important;
  box-shadow: 0 0 0 1px rgba(190, 242, 100, 0.22), 0 0 18px rgba(190, 242, 100, 0.35) !important;
}
`;
  document.head.appendChild(style);
}

function focusHarthmereSystemMenuElement(root: HTMLElement, next: HTMLElement) {
  root
    .querySelectorAll<HTMLElement>("[data-harthmere-system-nav-focused='true']")
    .forEach((node) =>
      node.removeAttribute("data-harthmere-system-nav-focused")
    );
  next.setAttribute("data-harthmere-system-nav-focused", "true");
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// HARTHMERE_SYSTEMS_MENU_AUTO_FOCUS:
// Opening the black Systems menu should immediately land keyboard focus on the
// useful game control. Prefer the active quest/item affordance, then the first
// visible action. This keeps onboarding playable without needing a mouse.
function findHarthmereSystemsMenuInitialFocus(root: HTMLElement) {
  const preferredSelectors = [
    "[data-harthmere-auto-focus='true'] button:not([disabled])",
    "[data-harthmere-auto-focus='true'] [role='button']:not([aria-disabled='true'])",
    "[data-harthmere-tutorial-item-highlight='true'] button:not([disabled])",
    "[data-harthmere-tutorial-item-highlight='true'][tabindex]:not([tabindex='-1'])",
    "[data-harthmere-primary-action='true']:not([disabled])",
    "button[aria-selected='true']",
    SYSTEM_MENU_SELECTABLE_QUERY,
  ];
  for (const selector of preferredSelectors) {
    const node = Array.from(root.querySelectorAll<HTMLElement>(selector)).find(
      (candidate) =>
        candidate.offsetParent !== null &&
        !candidate.closest("[aria-hidden='true']") &&
        !candidate.hasAttribute("disabled")
    );
    if (node) {
      return node;
    }
  }
  return undefined;
}

// harthmere-body-animation-weapon-sync
type HarthmereBodyAnimationGestureDetail = {
  attack?: string;
  at?: number;
  windupMs?: number;
  impactMs?: number;
  recoveryMs?: number;
  itemId?: string;
  emptyHanded?: boolean;
  weaponVisual?: boolean;
};

const HARTHMERE_BODY_ANIMATION_GESTURE_BRIDGE =
  "harthmere-body-animation-gesture-bridge";

function harthmereBodyAttackTimingFromWeaponEvent(
  detail: HarthmereBodyAnimationGestureDetail | undefined,
  attack: "basic" | "heavy"
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

function recordHarthmereBodyAnimationSyncDebug(
  payload: Record<string, unknown>
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
      bridge: HARTHMERE_BODY_ANIMATION_GESTURE_BRIDGE,
      upperBodyOnly: true,
      lowerBodyLocomotionPreserved: true,
      ...payload,
    },
    ...(win.__harthmereBodyAnimationSyncDebug ?? []),
  ].slice(0, 100);
}

function useHarthmereLocalPlayerAttackGestureBridge() {
  const { reactResources, resources, events, audioManager } =
    useClientContext();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<HarthmereBodyAnimationGestureDetail>)
        .detail;
      const attack = detail?.attack;
      if (attack !== "basic" && attack !== "heavy") {
        return;
      }

      try {
        const localPlayer = reactResources.get("/scene/local_player");
        const clock = resources.get("/clock");
        const selectedItem = resources.get("/hotbar/selection")?.item;
        const emoteType = attack === "heavy" ? "attack2" : "attack1";
        const desiredFileAnimationName =
          attack === "heavy"
            ? "HarthmereBodyWeaponHeavy_Aligned_30"
            : "HarthmereBodyWeaponBasic_Aligned_30";
        const bodyTiming = harthmereBodyAttackTimingFromWeaponEvent(
          detail,
          attack
        );
        const duration = bodyTiming.duration;

        // Do not call localPlayer.startAttack() here: the native helper
        // intentionally alternates attack1/attack2, which is correct for
        // mouse harvesting but wrong for explicit Harthmere B/N combat.
        // Keep the native sound + attackInfo + eagerEmote path, but choose
        // the exact emote for the key that was pressed.
        localPlayer.player.setSound(
          resources,
          audioManager,
          "attack",
          "swing",
          {
            resetIfAlreadyPlaying: true,
          }
        );
        localPlayer.attackInfo = {
          start: clock.time,
          duration,
        };
        localPlayer.player.eagerEmote(events, resources, emoteType);
        recordHarthmereBodyAnimationSyncDebug({
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

        const shouldEmitWeaponVisual =
          !detail?.emptyHanded &&
          detail?.weaponVisual !== false &&
          Boolean(detail?.itemId);

        if (
          shouldEmitWeaponVisual &&
          window.localStorage?.getItem(
            "biomes.localDev.harthmere.combatDebug"
          ) === "1"
        ) {
          emitHarthmerePlayerSwordVisual({
            action: "attack",
            drawn: true,
            itemId: detail?.itemId,
            attack,
          });

          console.info("[HarthmerePlayerAttackGesture]", {
            attack,
            emoteType,
            desiredFileAnimationName,
            duration,
            selectedItemId: selectedItem?.id,
            itemId: detail?.itemId,
            emptyHanded: detail?.emptyHanded === true,
          });
        }
      } catch (error) {
        console.warn(
          "Failed to play Harthmere local-player attack gesture",
          error
        );
      }
    };

    window.addEventListener(HARTHMERE_ATTACK_ANIMATION_EVENT, handler);
    return () =>
      window.removeEventListener(HARTHMERE_ATTACK_ANIMATION_EVENT, handler);
  }, [reactResources, resources, events, audioManager]);
}

const HARTHMERE_PLAYER_SWORD_VISUAL_EVENT =
  "biomes:harthmere-player-sword-visual";

type HarthmereSwordVisualAction =
  | "grant"
  | "draw"
  | "sheathe"
  | "attack"
  | "sync";

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
    })
  );
}

function useHarthmerePlayerSwordVisualBridge() {
  const inventory = useHarthmereInventoryState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  // This bridge drives the procedural visible longsword. Keep it mapped to
  // the Harthmere sword id instead of raw inventory/equipment ids such as
  // training_dagger, which do not have this visual attached yet.
  const itemId =
    inventory.equipment.main_hand?.itemId ??
    inventory.equipment.off_hand?.itemId ??
    "iron_longsword";

  useEffect(() => {
    // Give old local-dev saves a sword exactly once. The inventory helper is
    // idempotent, so it is safe when React remounts during development.
    ensureHarthmereStarterSwordGranted();
    // NOTE: repair/cleanup tools are NOT granted for free. The player must buy
    // them from the business that sells them (see harthmere_business_tool_shop);
    // a job that needs a tool the player lacks redirects them there on the map.
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

function useHarthmereLocalPlayerWearableMeshBridge() {
  const { resources, userId } = useClientContext();
  const localWearableSlotsRef = React.useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const refresh = () => {
      try {
        const mapped = harthmereLocalEquipmentBikkieWearables(
          readHarthmereInventoryState().equipment
        );
        const previousSlots = localWearableSlotsRef.current;
        if (mapped.length > 0 || previousSlots.size > 0) {
          const wearing =
            resources.peek("/ecs/c/wearing", userId) ?? Wearing.create();
          const items = new Map(wearing.items ?? []);
          for (const slot of previousSlots) {
            items.delete(slot as any);
          }
          for (const wearable of mapped) {
            items.set(wearable.slot, anItem(wearable.itemId));
          }
          localWearableSlotsRef.current = new Set(
            mapped.map((wearable) => Number(wearable.slot))
          );
          resources.set("/ecs/c/wearing", userId, { items } as Wearing);
        }
      } catch {}
      resources.invalidate("/scene/player/mesh", userId);
    };
    window.addEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [resources, userId]);
}

// harthmere-full-animation-runtime
type HarthmereFullAnimationFamily =
  | "creature"
  | "mount"
  | "ranged"
  | "magic"
  | "shield"
  | "dodge"
  | "airborne"
  | "gathering"
  | "crafting"
  | "building"
  | "social"
  | "deathRespawn"
  | "boss"
  | "screenshot";
type HarthmereFullAnimationRequest = {
  family?: HarthmereFullAnimationFamily;
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
const HARTHMERE_FULL_ANIMATION_RUNTIME_BRIDGE_VERSION =
  "harthmere-full-animation-runtime-bridge";
const HARTHMERE_FULL_ANIMATION_REQUEST_EVENT =
  "biomes:harthmere-animation-request";
const HARTHMERE_FULL_ANIMATION_DEBUG_EVENT = "biomes:harthmere-animation-debug";
const HARTHMERE_FULL_ANIMATION_FAMILIES: HarthmereFullAnimationFamily[] = [
  "creature",
  "mount",
  "ranged",
  "magic",
  "shield",
  "dodge",
  "airborne",
  "gathering",
  "crafting",
  "building",
  "social",
  "deathRespawn",
  "boss",
  "screenshot",
];
function harthmereAnimationDefaultTiming(family: HarthmereFullAnimationFamily) {
  switch (family) {
    case "ranged":
      return { windupMs: 180, impactMs: 300, recoveryMs: 420 };
    case "magic":
      return { windupMs: 220, impactMs: 380, recoveryMs: 520 };
    case "shield":
      return { windupMs: 70, impactMs: 110, recoveryMs: 260 };
    case "dodge":
      return { windupMs: 40, impactMs: 110, recoveryMs: 360 };
    case "gathering":
      return { windupMs: 180, impactMs: 360, recoveryMs: 420 };
    case "crafting":
      return { windupMs: 160, impactMs: 320, recoveryMs: 480 };
    case "building":
      return { windupMs: 150, impactMs: 300, recoveryMs: 400 };
    case "deathRespawn":
      return { windupMs: 0, impactMs: 180, recoveryMs: 900 };
    case "boss":
      return { windupMs: 700, impactMs: 1200, recoveryMs: 900 };
    default:
      return { windupMs: 120, impactMs: 240, recoveryMs: 360 };
  }
}
function useHarthmereComprehensiveAnimationRuntimeBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as typeof window & {
      __harthmereAnimationRuntime?: {
        version: string;
        families: HarthmereFullAnimationFamily[];
        log: unknown[];
        record: (request: HarthmereFullAnimationRequest) => unknown;
        request: (request: HarthmereFullAnimationRequest) => unknown;
        snapshot: () => unknown;
      };
      __harthmereFullAnimationRuntimeDebug?: unknown[];
    };
    const record = (request: HarthmereFullAnimationRequest) => {
      const family = request.family ?? "screenshot";
      const timing = harthmereAnimationDefaultTiming(family);
      const entry = {
        at: Date.now(),
        version: HARTHMERE_FULL_ANIMATION_RUNTIME_BRIDGE_VERSION,
        family,
        action: request.action ?? "debug",
        phase: request.phase ?? "start",
        windupMs: request.windupMs ?? timing.windupMs,
        impactMs: request.impactMs ?? timing.impactMs,
        recoveryMs: request.recoveryMs ?? timing.recoveryMs,
        lowerBodyLocomotionPreserved: [
          "ranged",
          "magic",
          "shield",
          "gathering",
          "crafting",
          "building",
          "social",
        ].includes(family),
        fullBodyAuthoritative: [
          "dodge",
          "airborne",
          "deathRespawn",
          "mount",
          "boss",
          "creature",
        ].includes(family),
        screenshotLabel: request.screenshotLabel,
        actorId: request.actorId,
        targetId: request.targetId,
        itemId: request.itemId,
      };
      win.__harthmereFullAnimationRuntimeDebug = [
        entry,
        ...(win.__harthmereFullAnimationRuntimeDebug ?? []),
      ].slice(0, 200);
      win.dispatchEvent(
        new CustomEvent(HARTHMERE_FULL_ANIMATION_DEBUG_EVENT, {
          detail: entry,
        })
      );
      return entry;
    };
    win.__harthmereAnimationRuntime = {
      version: HARTHMERE_FULL_ANIMATION_RUNTIME_BRIDGE_VERSION,
      families: HARTHMERE_FULL_ANIMATION_FAMILIES,
      get log() {
        return win.__harthmereFullAnimationRuntimeDebug ?? [];
      },
      record,
      request: (request) => {
        win.dispatchEvent(
          new CustomEvent(HARTHMERE_FULL_ANIMATION_REQUEST_EVENT, {
            detail: request,
          })
        );
        return record(request);
      },
      snapshot: () => ({
        version: HARTHMERE_FULL_ANIMATION_RUNTIME_BRIDGE_VERSION,
        families: HARTHMERE_FULL_ANIMATION_FAMILIES,
        last: win.__harthmereFullAnimationRuntimeDebug?.[0],
        count: win.__harthmereFullAnimationRuntimeDebug?.length ?? 0,
      }),
    };
    const onRequest = (event: Event) =>
      record(
        (event as CustomEvent<HarthmereFullAnimationRequest>).detail ?? {}
      );
    const onWeapon = (event: Event) => {
      const detail =
        (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      const attack = String(detail.attack ?? "");
      const itemId = String(detail.itemId ?? "");
      if (attack === "spark")
        record({
          family: "magic",
          action: "castRelease",
          phase: "impact",
          itemId,
        });
      else if (attack === "basic" || attack === "heavy")
        record({
          family: "ranged",
          action: /bow|crossbow|arrow/i.test(itemId)
            ? "projectileSpawn"
            : "meleeBodyAlreadyCovered",
          phase: "impact",
          itemId,
        });
    };
    win.addEventListener(HARTHMERE_FULL_ANIMATION_REQUEST_EVENT, onRequest);
    win.addEventListener("biomes:harthmere-player-sword-visual", onWeapon);
    record({
      family: "screenshot",
      action: "runtimeBridgeMounted",
      phase: "idle",
    });
    return () => {
      win.removeEventListener(
        HARTHMERE_FULL_ANIMATION_REQUEST_EVENT,
        onRequest
      );
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
      <div className="gap-1.5 flex items-center">
        {icon && <img src={icon} className="h-3 w-3 shrink-0 object-contain" />}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center justify-between gap-1 text-[10px] leading-none text-white/70">
            <span className="truncate font-semibold text-white">{label}</span>
            <span className="shrink-0 tabular-nums">{value}</span>
          </div>
          <div className="h-1.5 bg-black/45 overflow-hidden rounded-full ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-white/80 transition-[width] duration-300"
              style={{ width: `${clamp(percent, 0, 100)}%` }}
            />
          </div>
        </div>
      </div>
      {detail && (
        <div className="mt-0.5 text-white/45 ml-4 truncate text-[9px] leading-none">
          {detail}
        </div>
      )}
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
      className={`rounded-lg px-1.5 pointer-events-auto flex min-h-[2.65rem] min-w-[3.65rem] flex-col items-center justify-center border py-1 text-center shadow-lg backdrop-blur transition active:scale-95 ${
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

// HARTHMERE_POLISH_HUD_REDESIGN — heart-pip row + framed mana + standing chips
function HeartRow({ hp, maxHp }: { hp: number; maxHp: number }) {
  // One pip per 10 HP up to 10 pips. Sub-10 HP shows a half pip.
  const totalPips = Math.max(1, Math.min(10, Math.ceil(maxHp / 10)));
  const filledPips = Math.max(0, Math.min(totalPips, Math.floor(hp / 10)));
  const halfPip = hp > filledPips * 10 && hp < (filledPips + 1) * 10;
  return (
    <div
      className="flex items-center gap-[2px]"
      aria-label={`Health ${hp} of ${maxHp}`}
    >
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
      <span className="text-amber-50/95 ml-1 text-[11px] font-semibold tabular-nums tracking-tight">
        {hp}/{maxHp}
      </span>
    </div>
  );
}

function StandingChip({
  label,
  value,
  percent,
  accent,
}: {
  label: string;
  value: string;
  percent: number;
  accent: string;
}) {
  return (
    <div className="border-amber-200/15 bg-stone-900/70 py-0.5 text-amber-50/90 flex flex-col items-center justify-center rounded-md border px-1 text-[9px] leading-tight">
      <span className="text-amber-200/55 text-[8px] uppercase tracking-wider">
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="mt-[1px] h-[2px] w-full overflow-hidden rounded-full bg-black/50">
        <span
          className="block h-full"
          style={{
            width: `${Math.max(0, Math.min(100, percent))}%`,
            background: accent,
          }}
        />
      </span>
    </div>
  );
}

function CompactStatusCluster() {
  const combat = useHarthmereCombatState();
  const death = useHarthmereDeathState();
  const reputation = useHarthmereReputationState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  const stamina = useHarthmereFoodStaminaState();
  const liveStatus = useBiomesUIPlayerStatusState();
  const deathScreenActive = [
    "downed",
    "dead",
    "respawning",
    "ghost",
    "captured",
    "unconscious",
  ].includes(death.state);
  const display = biomesUIVitalsDisplayFromLiveStatusForTest(liveStatus, {
    hp: deathScreenActive ? 0 : combat.player.hp,
    maxHp: combat.player.maxHp,
    combatState: deathScreenActive ? death.state : combat.player.combatState,
    resourceLabel: "Mana",
    resourceValue: multiplayer.mana,
    resourceMax: multiplayer.maxMana,
    standing: reputation.regions.harthmere,
  });
  const combatResource = biomesUIVitalsCombatResourceDisplayForTest(
    liveStatus,
    {
      resourceLabel: display.resourceLabel,
      resourceValue: display.resourceValue,
      resourceMax: display.resourceMax,
    }
  );
  const regional = display.standing ?? reputation.regions.harthmere;
  const title =
    display.classLine ?? getHarthmereCombinedPublicTitle(reputation);
  const manaPct =
    (combatResource.resourceValue / Math.max(1, combatResource.resourceMax)) *
    100;
  const staminaFromStatus = biomesUIVitalsStaminaDisplayForTest(liveStatus, {
    staminaValue: Math.max(0, stamina.stamina),
    staminaMax: Math.max(1, Math.round(stamina.maxStamina)),
  });
  const staminaValue = staminaFromStatus.staminaValue;
  const staminaMax = staminaFromStatus.staminaMax;
  const staminaPct = (staminaValue / Math.max(1, staminaMax)) * 100;
  const staminaDisplay =
    staminaValue > 0 && !Number.isInteger(staminaValue)
      ? staminaValue.toFixed(1)
      : String(staminaValue > 0 ? Math.ceil(staminaValue) : 0);

  return (
    <div
      className="rounded-xl border-amber-200/25 from-stone-800/85 to-stone-950/90 text-amber-50 pointer-events-none fixed left-3 top-3 z-30 w-[min(17rem,calc(100vw-1rem))] select-none border bg-gradient-to-b p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-md md:w-[16.5rem]"
      style={{
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255, 215, 130, 0.07)",
      }}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <div className="text-amber-100 truncate text-sm font-bold tracking-wide">
          {BIOMES_GAME_NAME}
        </div>
        <div className="text-amber-200/55 truncate text-[9px] uppercase tracking-[0.18em]">
          {display.combatState.replaceAll("_", " ")}
        </div>
      </div>
      <div className="mb-1.5 rounded-lg border-amber-200/10 flex items-center justify-between gap-2 border bg-black/20 px-2 py-1">
        <div className="text-amber-200/55 text-[8px] font-semibold uppercase tracking-[0.2em]">
          Public standing
        </div>
        <div className="text-amber-100/85 max-w-[11rem] truncate text-right text-[10px] italic leading-tight">
          {title}
        </div>
      </div>
      <HeartRow hp={display.hp} maxHp={display.maxHp} />
      <div className="mt-1.5 gap-1.5 flex items-center">
        <img
          src={ICONS.spark}
          className="h-[14px] w-[14px] object-contain"
          alt=""
          draggable={false}
        />
        <span className="text-sky-100/90 w-[3.4rem] truncate text-[8px] font-black uppercase tracking-[0.14em]">
          {combatResource.resourceLabel}
        </span>
        <div className="border-amber-200/15 relative h-[10px] flex-1 overflow-hidden rounded-full border bg-black/50">
          <span
            className="from-sky-400 via-sky-300 to-indigo-300 absolute inset-y-0 left-0 bg-gradient-to-r"
            style={{ width: `${Math.max(0, Math.min(100, manaPct))}%` }}
          />
        </div>
        <span className="text-amber-50/90 text-[10px] font-semibold tabular-nums">
          {combatResource.resourceValue}/{combatResource.resourceMax}
        </span>
      </div>
      <div
        className="mt-1.5 gap-1.5 flex items-center"
        aria-label={`Stamina ${staminaDisplay} of ${staminaMax}`}
      >
        <span className="text-emerald-100/90 w-[3.4rem] text-[8px] font-black uppercase tracking-[0.14em]">
          Stamina
        </span>
        <div className="border-amber-200/15 relative h-[10px] flex-1 overflow-hidden rounded-full border bg-black/50">
          <span
            className="from-emerald-500 via-lime-300 to-amber-200 absolute inset-y-0 left-0 bg-gradient-to-r"
            style={{ width: `${Math.max(0, Math.min(100, staminaPct))}%` }}
          />
        </div>
        <span className="text-amber-50/90 text-[10px] font-semibold tabular-nums">
          {staminaDisplay}/{staminaMax}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        <StandingChip
          label="Like"
          value={String(regional.likeability)}
          percent={signedStandingPercent(regional.likeability)}
          accent="#8aff8a"
        />
        <StandingChip
          label="Law"
          value={String(regional.legal)}
          percent={signedStandingPercent(regional.legal)}
          accent="#aac8ff"
        />
        <StandingChip
          label="Known"
          value={String(regional.notoriety)}
          percent={notorietyPercent(regional.notoriety)}
          accent="#ffb673"
        />
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
  const [impact, setImpact] = useState<
    { id: string; attack: string } | undefined
  >(undefined);
  const [combatFloat, setCombatFloat] = useState<
    | { id: string; label: string; kind: string; targetOffset?: number }
    | undefined
  >(undefined);
  const combatActorHud = useHarthmereCombatActorHudSnapshots(90);

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
      const detail = (event as CustomEvent<{ attack?: string; at?: number }>)
        .detail;
      setImpact({
        id: `swing-${detail?.at ?? Date.now()}-${Math.floor(
          Math.random() * 1_000_000
        )}`,
        attack: detail?.attack ?? "basic",
      });
      window.setTimeout(() => setImpact(undefined), 460);
    };
    window.addEventListener(HARTHMERE_ATTACK_ANIMATION_EVENT, handler);
    return () =>
      window.removeEventListener(HARTHMERE_ATTACK_ANIMATION_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          id?: string;
          ability?: string;
          result?: string;
          finalDamage?: number;
          target?: string;
          targetOffset?: number;
          attackerOffset?: number;
          hitOffsets?: number[];
        }>
      ).detail;
      if (!detail) {
        return;
      }
      const resultLabel = detail.result?.replaceAll("_", " ") ?? "miss";
      const label =
        Number(detail.finalDamage ?? 0) > 0
          ? `-${Math.round(Number(detail.finalDamage))}`
          : resultLabel;
      const targetOffset = Number.isFinite(Number(detail.targetOffset))
        ? Number(detail.targetOffset)
        : Array.isArray(detail.hitOffsets) &&
          Number.isFinite(Number(detail.hitOffsets[0]))
        ? Number(detail.hitOffsets[0])
        : undefined;
      setCombatFloat({
        id: `${detail.id ?? Date.now()}-${Math.floor(
          Math.random() * 1_000_000
        )}`,
        label,
        kind: detail.result ?? "combat",
        targetOffset,
      });
      window.setTimeout(() => setCombatFloat(undefined), 760);
    };
    window.addEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, handler);
    return () =>
      window.removeEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, handler);
  }, []);

  return (
    <>
      {impact && (
        <div
          key={impact.id}
          className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center"
        >
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
          <div className="border-white/55 absolute h-16 w-16 animate-ping rounded-full border-2 opacity-75" />
          <div
            className="text-5xl absolute drop-shadow-[0_0_14px_rgba(255,255,255,0.85)]"
            style={{
              animation: "harthmere-fist-swing 460ms ease-out forwards",
            }}
          >
            {impact.attack === "spark"
              ? "✦"
              : impact.attack === "heavy"
              ? "⚔"
              : "🗡"}
          </div>
          <div
            className="h-1.5 w-36 absolute origin-left rounded-full bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.7)]"
            style={{
              animation: "harthmere-slash-flash 420ms ease-out forwards",
            }}
          />
        </div>
      )}
      {combatFloat &&
        combatFloat.targetOffset !== undefined &&
        combatActorHud[String(combatFloat.targetOffset)]?.screen?.visible && (
          <div
            key={combatFloat.id}
            className="pointer-events-none fixed inset-0 z-40"
          >
            <style>{`
            @keyframes harthmere-floating-combat {
              0% { transform: translate(-50%, -120%) scale(0.82); opacity: 0; }
              18% { opacity: 1; }
              100% { transform: translate(-50%, -190%) scale(1.08); opacity: 0; }
            }
          `}</style>
            <div
              className="border-white/35 text-base absolute rounded-full border bg-black/75 px-2.5 py-1 font-black uppercase tracking-wide text-white shadow-[0_0_18px_rgba(255,255,255,0.35)] sm:text-xl"
              style={{
                left:
                  combatActorHud[String(combatFloat.targetOffset)]?.screen?.x ??
                  0,
                top:
                  combatActorHud[String(combatFloat.targetOffset)]?.screen?.y ??
                  0,
                animation: "harthmere-floating-combat 760ms ease-out forwards",
              }}
            >
              {combatFloat.label}
            </div>
          </div>
        )}
      <div className="rounded-xl border-white/15 pointer-events-auto fixed left-2 top-[21rem] z-30 w-[min(16rem,calc(100vw-1rem))] border bg-black/60 p-2 text-white shadow-2xl backdrop-blur-md md:left-3 md:top-[21rem] md:w-[15.5rem]">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
          Fight Controls
        </div>
        <div className="rounded-lg bg-black/45 p-1.5 mb-2 border border-white/10 text-[10px] leading-snug text-white/70">
          <div>
            <span className="font-semibold text-white">Weapon:</span>{" "}
            {itemLabel(equippedWeapon?.itemId)}
          </div>
          <div>
            <span className="font-semibold text-white">Spell:</span>{" "}
            {spellLabel(primarySpell)}
          </div>
          <div>
            <span className="font-semibold text-white">Target:</span>{" "}
            {multiplayer.currentTargetLabel ?? "Training Dummy"}
          </div>
          <div>
            <span className="font-semibold text-white">Target HP:</span>{" "}
            {targetStats
              ? `${targetStats.hp}/${targetStats.maxHp}`
              : "not engaged"}
          </div>
        </div>
        <div className="gap-1.5 grid grid-cols-2">
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
        <div className="rounded bg-black/35 p-1.5 text-white/55 mt-2 border border-white/10 text-[9px] leading-snug">
          <div>
            <span className="font-semibold text-white/75">F</span> talk/interact
            · <span className="font-semibold text-white/75">M</span> map ·{" "}
            <span className="font-semibold text-white/75">J</span> quests
          </div>
          <div>
            <span className="font-semibold text-white/75">X</span> draw ·{" "}
            <span className="font-semibold text-white/75">Tab</span> target ·{" "}
            <span className="font-semibold text-white/75">B</span> Attack ·{" "}
            <span className="font-semibold text-white/75">H</span> HeavyAttack ·{" "}
            <span className="font-semibold text-white/75">L</span> BasicMagic ·{" "}
            <span className="font-semibold text-white/75">P</span> PvP
          </div>
          <div className="text-white/45 mt-1">
            Reserved: combat keys do not overlap with M map, J quests, K tasks,
            Y mail, N notifications, Esc systems, or F interact.
          </div>
        </div>
      </div>
    </>
  );
}

type HarthmereCombatActorHudSnapshot = {
  offset?: number;
  targetId?: string;
  liveModeTargetId?: string;
  label?: string;
  asset?: string;
  district?: string;
  pos?: [number, number];
  world?: [number, number, number];
  radius?: number;
  behavior?: string;
  socialRole?: string;
  attackable?: boolean;
  health?: {
    hp?: number;
    maxHp?: number;
  };
  screen?: {
    x: number;
    y: number;
    visible: boolean;
    depth: number;
  };
  at?: number;
};

type HarthmereLiveEntityHealthHudSnapshot = {
  entityId: string;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  isAttackable: boolean;
  position?: { x: number; y: number; z: number };
  lastAttackedAtMs?: number;
  showUntilMs: number;
};

function readHarthmereCombatActorHudSnapshots(): Record<
  string,
  HarthmereCombatActorHudSnapshot
> {
  if (typeof window === "undefined") {
    return {};
  }
  const win = window as typeof window & {
    __harthmereCombatActorPositions?: Record<
      string,
      HarthmereCombatActorHudSnapshot
    >;
  };
  return win.__harthmereCombatActorPositions ?? {};
}

function useHarthmereCombatActorHudSnapshots(intervalMs = 120) {
  const [snapshots, setSnapshots] = useState<
    Record<string, HarthmereCombatActorHudSnapshot>
  >({});
  useEffect(() => {
    const refresh = () => setSnapshots(readHarthmereCombatActorHudSnapshots());
    refresh();
    const interval = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);
  return snapshots;
}

function readHarthmereLiveEntityHealthHudSnapshots(): Record<
  string,
  HarthmereLiveEntityHealthHudSnapshot
> {
  if (typeof window === "undefined") {
    return {};
  }
  const win = window as typeof window & {
    __harthmereLiveEntityCombatHealth?: Record<
      string,
      HarthmereLiveEntityHealthHudSnapshot
    >;
  };
  return win.__harthmereLiveEntityCombatHealth ?? {};
}

function useHarthmereLiveEntityHealthHudSnapshots(intervalMs = 120) {
  const [snapshots, setSnapshots] = useState<
    Record<string, HarthmereLiveEntityHealthHudSnapshot>
  >({});
  useEffect(() => {
    const refresh = () =>
      setSnapshots(readHarthmereLiveEntityHealthHudSnapshots());
    refresh();
    const interval = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);
  return snapshots;
}

function harthmereHealthBarScreenProjection(
  position: { x: number; y?: number; z: number } | undefined,
  camera:
    | { three?: any; pos?: () => number[]; view?: () => number[] }
    | undefined
):
  | {
      x: number;
      y: number;
      visible: boolean;
      depth: number;
    }
  | undefined {
  if (typeof window === "undefined" || !position || !camera?.three) {
    return undefined;
  }
  const target = new Vector3(position.x, (position.y ?? 70) + 3.0, position.z);
  const cameraPos = camera.pos?.();
  const cameraView = camera.view?.();
  if (cameraPos && cameraView) {
    const dx = target.x - Number(cameraPos[0]);
    const dy = target.y - Number(cameraPos[1]);
    const dz = target.z - Number(cameraPos[2]);
    const facing =
      dx * Number(cameraView[0]) +
      dy * Number(cameraView[1]) +
      dz * Number(cameraView[2]);
    if (Number.isFinite(facing) && facing < 0) return undefined;
  }
  target.project(camera.three);
  const x = ((target.x + 1) / 2) * window.innerWidth;
  const y = ((1 - target.y) / 2) * window.innerHeight;
  return {
    x,
    y,
    visible:
      target.x >= -1 &&
      target.x <= 1 &&
      target.y >= -1 &&
      target.y <= 1 &&
      target.z >= -1 &&
      target.z <= 1 &&
      Number.isFinite(x) &&
      Number.isFinite(y),
    depth: target.z,
  };
}

type HarthmereEnemyHealthBarRow = {
  key: string;
  label: string;
  hp: number;
  maxHp: number;
  selected: boolean;
  screen: {
    x: number;
    y: number;
    visible: boolean;
    depth: number;
  };
  depth: number;
};

function harthmereFiniteHealthValue(value: unknown): number | undefined {
  const health = Number(value);
  if (!Number.isFinite(health)) {
    return undefined;
  }
  return Math.max(0, Math.round(health));
}

function harthmereCombatActorShouldShowHealth(
  actor: HarthmereCombatActorHudSnapshot
) {
  const label = (actor.label ?? "").toLowerCase();
  const behavior = (actor.behavior ?? "").toLowerCase();
  const socialRole = (actor.socialRole ?? "").toLowerCase();
  return (
    actor.attackable !== false ||
    behavior === "hostile" ||
    behavior === "training_dummy" ||
    socialRole === "hostile" ||
    socialRole === "wildlife" ||
    /muck|muckling|mucker|muckernot|hex|hexer|animal|wolf|bear|boar|deer|snake|rat|fox|cat|dog|hound|horse|cow|goat|sheep|frog|crow|raven|chicken|bunny|rabbit|pig|monster|creature|wyrm/.test(
      label
    )
  );
}

function harthmereHealthBarScreenIsVisible(
  screen:
    | {
        x: number;
        y: number;
        visible: boolean;
        depth: number;
      }
    | undefined,
  viewportWidth: number,
  viewportHeight: number
) {
  return (
    Boolean(screen?.visible) &&
    (screen?.x ?? -1) >= -48 &&
    (screen?.x ?? 0) <= viewportWidth + 48 &&
    (screen?.y ?? -1) >= -48 &&
    (screen?.y ?? 0) <= viewportHeight + 48
  );
}

function harthmereCombatActorHealthBarScreen(
  actor: HarthmereCombatActorHudSnapshot,
  camera:
    | { three?: any; pos?: () => number[]; view?: () => number[] }
    | undefined
) {
  if (actor.screen) {
    return actor.screen;
  }
  const world = actor.world;
  if (!world) {
    return undefined;
  }
  return harthmereHealthBarScreenProjection(
    { x: world[0], y: world[1], z: world[2] },
    camera
  );
}

export function harthmereAttackableActorHealthBarRows(input: {
  actorHud: Record<string, HarthmereCombatActorHudSnapshot>;
  camera?: { three?: any; pos?: () => number[]; view?: () => number[] };
  viewportWidth: number;
  viewportHeight: number;
  excludedActorKeys?: Iterable<string>;
  excludedLiveTargetIds?: Iterable<string>;
}): HarthmereEnemyHealthBarRow[] {
  const excludedActorKeys = new Set(input.excludedActorKeys ?? []);
  const excludedLiveTargetIds = new Set(input.excludedLiveTargetIds ?? []);
  const rows: HarthmereEnemyHealthBarRow[] = [];
  for (const [actorKey, actor] of Object.entries(input.actorHud)) {
    const liveTargetId = actor.liveModeTargetId ?? actor.targetId;
    if (
      excludedActorKeys.has(actorKey) ||
      (liveTargetId !== undefined && excludedLiveTargetIds.has(liveTargetId))
    ) {
      continue;
    }

    const hp = harthmereFiniteHealthValue(actor.health?.hp);
    const maxHp = harthmereFiniteHealthValue(actor.health?.maxHp) ?? hp ?? 0;
    if (
      hp === undefined ||
      hp <= 0 ||
      maxHp <= 0 ||
      !harthmereCombatActorShouldShowHealth(actor)
    ) {
      continue;
    }

    const screen = harthmereCombatActorHealthBarScreen(actor, input.camera);
    if (
      !screen ||
      !harthmereHealthBarScreenIsVisible(
        screen,
        input.viewportWidth,
        input.viewportHeight
      )
    ) {
      continue;
    }

    rows.push({
      key: `actor-${actorKey}`,
      label: actor.label ?? liveTargetId ?? actorKey,
      hp,
      maxHp,
      selected: false,
      screen,
      depth: screen.depth ?? 1,
    });
  }
  return rows;
}

function HarthmereEnemyHealthBarsHUD() {
  const { reactResources } = useClientContext();
  const combat = useHarthmereCombatState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  const actorHud = useHarthmereCombatActorHudSnapshots(100);
  const liveEntityHealth = useHarthmereLiveEntityHealthHudSnapshots(100);
  const camera = reactResources.use("/scene/camera") as any;
  const selectedOffset =
    multiplayer.currentTargetOffset ?? combat.selectedNpcOffset;
  const selectedActor =
    selectedOffset !== undefined ? actorHud[String(selectedOffset)] : undefined;
  const selectedLiveTargetId =
    selectedActor?.liveModeTargetId ?? selectedActor?.targetId;
  const now = Date.now();
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const localRows = Object.entries(combat.npcs)
    .map(([offsetText, npc]) => {
      const offset = Number(offsetText);
      const actor = actorHud[offsetText];
      const screen = actor?.screen;
      const isSelected = offset === selectedOffset;
      const damaged = npc.hp < npc.maxHp;
      const hostile =
        npc.behavior === "hostile" ||
        npc.behavior === "training_dummy" ||
        npc.socialRole === "hostile" ||
        npc.socialRole === "wildlife";
      const engaged =
        npc.combatState === "in_combat" ||
        npc.combatState === "alert" ||
        Boolean(npc.lastDamageAt && now - npc.lastDamageAt < 20_000);
      const alive = npc.hp > 0 && npc.combatState !== "dead";
      const visible =
        Boolean(screen?.visible) &&
        (screen?.x ?? -1) >= -48 &&
        (screen?.x ?? 0) <= viewportWidth + 48 &&
        (screen?.y ?? -1) >= -48 &&
        (screen?.y ?? 0) <= viewportHeight + 48;
      return {
        offset,
        npc,
        actor,
        screen,
        show:
          alive &&
          visible &&
          actor?.attackable !== false &&
          (hostile ||
            isSelected ||
            damaged ||
            engaged ||
            npc.behavior !== "passive"),
      };
    })
    .filter((row) => row.show);
  const actorsByLiveTargetId = new Map<
    string,
    HarthmereCombatActorHudSnapshot
  >();
  for (const actor of Object.values(actorHud)) {
    const liveId = actor.liveModeTargetId ?? actor.targetId;
    if (liveId) {
      actorsByLiveTargetId.set(String(liveId), actor);
    }
  }
  const liveRows = Object.entries(liveEntityHealth)
    .map(([entityId, health]) => {
      const actor = actorsByLiveTargetId.get(entityId);
      const screen =
        actor?.screen ??
        harthmereHealthBarScreenProjection(health.position, camera);
      const alive = health.isAlive && health.hp > 0;
      const damaged = health.hp < health.maxHp;
      const recentlyDamaged =
        (health.lastAttackedAtMs ?? 0) > 0 &&
        now - Number(health.lastAttackedAtMs) < 20_000;
      const selected = entityId === selectedLiveTargetId;
      const visible =
        Boolean(screen?.visible) &&
        (screen?.x ?? -1) >= -48 &&
        (screen?.x ?? 0) <= viewportWidth + 48 &&
        (screen?.y ?? -1) >= -48 &&
        (screen?.y ?? 0) <= viewportHeight + 48;
      return {
        offset: Number.NaN,
        key: `live-${entityId}`,
        entityId,
        label: actor?.label ?? entityId.replace(/^.*:/, ""),
        hp: health.hp,
        maxHp: health.maxHp,
        selected,
        screen,
        show:
          alive &&
          visible &&
          health.isAttackable !== false &&
          health.showUntilMs >= now &&
          (selected || health.isAttackable || damaged || recentlyDamaged),
      };
    })
    .filter((row) => row.show);
  const coveredActorKeys = new Set(localRows.map((row) => String(row.offset)));
  const coveredLiveTargetIds = new Set(liveRows.map((row) => row.entityId));
  const actorRows = harthmereAttackableActorHealthBarRows({
    actorHud,
    camera,
    viewportWidth,
    viewportHeight,
    excludedActorKeys: coveredActorKeys,
    excludedLiveTargetIds: coveredLiveTargetIds,
  });
  const rows = [
    ...localRows.map((row) => ({
      key: `${row.offset}-${row.npc.name}`,
      label: row.npc.name,
      hp: row.npc.hp,
      maxHp: row.npc.maxHp,
      selected: row.offset === selectedOffset,
      screen: row.screen,
      depth: row.screen?.depth ?? 1,
    })),
    ...liveRows.map((row) => ({
      ...row,
      depth: row.screen?.depth ?? 1,
    })),
    ...actorRows,
  ]
    .sort((a, b) => {
      if (a.selected) return -1;
      if (b.selected) return 1;
      return a.depth - b.depth;
    })
    .slice(0, 24);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-hidden="true">
      {rows.map(({ key, label, hp, maxHp, selected, screen }) => {
        const pct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100));
        return (
          <div
            key={key}
            className={`px-1.5 absolute w-[7.25rem] -translate-x-1/2 -translate-y-full rounded-md border py-1 text-center text-white shadow-lg backdrop-blur-sm sm:w-[8.75rem] ${
              selected
                ? "border-red-200/80 bg-black/80"
                : "border-red-300/35 bg-black/62"
            }`}
            style={{ left: screen?.x ?? 0, top: (screen?.y ?? 0) - 8 }}
          >
            <div className="flex items-center justify-between gap-1 text-[9px] font-bold leading-none sm:text-[10px]">
              <span className="truncate text-left">{label}</span>
              <span className="text-red-100 shrink-0 tabular-nums">
                {hp}/{maxHp}
              </span>
            </div>
            <div className="h-1.5 ring-black/35 mt-1 overflow-hidden rounded-full bg-white/20 ring-1 sm:h-2">
              <div
                className="bg-red-400 h-full rounded-full transition-[width] duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UtilityActionBar({
  onAction,
}: {
  onAction: (action: HarthmereHudAction) => void;
}) {
  // HARTHMERE_POLISH_HUD_REDESIGN — medieval nav strip pinned to the
  // bottom-center. The "primary" group on the left routes to the three
  // most-used menus (Inventory, Crafting, Map). The "secondary" group on
  // the right is for journal/social/settings — items the player needs but
  // not every minute.
  //
  // SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS:
  // Each NavSlot looks at the active tutorial's highlight broadcast and
  // pulses + shows a bouncing down-arrow when the current step needs that
  // specific button. The new "Chat" slot opens the tutor chat practice
  // panel so the chat lesson actually has a visible target.
  //
  // SNAPSHOT_GROVE_NAVSLOT_ARROW_KEYS:
  // Once a NavSlot button has focus (via Tab or click), Left/Right arrow
  // keys move focus to the previous/next slot. This follows the WAI-ARIA
  // toolbar roving-tabindex pattern. We only intercept the arrow when the
  // event target is one of our NavSlot buttons, so player movement using
  // arrow keys outside the HUD bar is unaffected.
  const tutorHighlights = useTutorHighlightedNavLabels();
  const barRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    ensureSnapshotGroveTutorHighlightStyles();
  }, []);
  const isHot = (label: string) => tutorHighlights.has(label);
  const onArrowKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const root = barRef.current;
    if (!root) return;
    const target = document.activeElement;
    if (!(target instanceof HTMLElement)) return;
    if (!target.hasAttribute("data-tutor-nav-label")) return;
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>("button[data-tutor-nav-label]")
    );
    if (!buttons.length) return;
    const idx = buttons.indexOf(target as HTMLButtonElement);
    if (idx < 0) return;
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next].focus();
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[7.25rem] z-30 flex justify-center px-2 max-sm:bottom-[6.75rem] md:bottom-[7.45rem]"
      onKeyDown={onArrowKey}
    >
      <div
        ref={barRef}
        className="gap-1.5 rounded-2xl border-amber-200/25 from-stone-950/95 to-stone-800/85 py-1.5 pointer-events-auto flex max-w-[calc(100vw-1rem)] items-end overflow-x-auto overscroll-contain border bg-gradient-to-t px-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-md md:gap-2"
        role="toolbar"
        aria-label="Game HUD action bar — use Left and Right arrow keys to switch between buttons"
        data-snapshot-grove-nav-arrow-keys="true"
        style={{
          boxShadow:
            "0 8px 24px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255, 215, 130, 0.07)",
        }}
      >
        <NavSlot
          icon={ICONS.navInventory}
          label="Bag"
          hint="I"
          onClick={() => onAction("inventory")}
          highlighted={isHot("Bag")}
        />
        <NavSlot
          icon={ICONS.navCrafting}
          label="Craft"
          hint="C"
          onClick={() => onAction("crafting")}
          highlighted={isHot("Craft")}
        />
        <NavSlot
          icon={ICONS.navMap}
          label="Map"
          hint="M"
          onClick={() => onAction("map")}
          highlighted={isHot("Map")}
        />
        <NavSlot
          icon={ICONS.quest}
          label="Quests"
          hint="J"
          onClick={() => onAction("quests")}
          highlighted={isHot("Quests")}
        />
        {/* HARTHMERE_JOBS_BOARD_PANEL: opens the live Grove Jobs Board */}
        <NavSlot
          icon={ICONS.navChallenges}
          label="Jobs"
          hint="B"
          onClick={openHarthmereJobsBoardPanel}
          highlighted={isHot("Jobs")}
        />
        <div className="bg-amber-200/20 mx-1 hidden h-7 w-px self-center sm:block" />
        <NavSlot
          icon={ICONS.navChallenges}
          label="Tasks"
          hint="K"
          onClick={() => onAction("tasks")}
          highlighted={isHot("Tasks")}
        />
        <NavSlot
          icon={ICONS.navInbox}
          label="Mail"
          hint="Y"
          onClick={() => onAction("mail")}
          highlighted={isHot("Mail")}
        />
        <NavSlot
          icon={ICONS.navNotifications}
          label="Chat"
          hint="Enter"
          onClick={() => openSnapshotGroveTutorChatPanel()}
          highlighted={isHot("Chat")}
        />
        <NavSlot
          icon={ICONS.navNotifications}
          label="Notif"
          hint="N"
          onClick={() => onAction("notifications")}
          highlighted={isHot("Notif")}
        />
        <NavSlot
          icon={ICONS.navCollections}
          label="Codex"
          hint="V"
          onClick={() => onAction("codex")}
          highlighted={isHot("Codex")}
        />
        <NavSlot
          icon={ICONS.navSettings}
          label="Settings"
          hint="Esc"
          onClick={() => onAction("settings")}
          highlighted={isHot("Settings")}
        />
        <div className="bg-amber-200/20 mx-1 h-7 w-px self-center" />
        <NavSlot
          icon={ICONS.heart}
          label="Revive"
          hint="Safe"
          onClick={() => reviveHarthmerePlayer("HUD")}
          highlighted={isHot("Revive")}
        />
      </div>
    </div>
  );
}

// HARTHMERE_POLISH_HUD_REDESIGN — nav slot button used by UtilityActionBar.
// SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS — accepts a `highlighted` prop that
// makes the button pulse and drops a bouncing arrow above it pointing down,
// so an active tutorial step's required HUD click is unmistakable.
function NavSlot({
  icon,
  label,
  hint,
  onClick,
  highlighted,
}: {
  icon: string;
  label: string;
  hint: string;
  onClick: () => void;
  highlighted?: boolean;
}) {
  const baseClass =
    "pointer-events-auto group relative flex shrink-0 flex-col items-center justify-center rounded-lg border bg-stone-900/75 px-1.5 py-1 text-amber-50 transition hover:bg-stone-800/85 active:scale-95";
  const calmClass = "border-amber-200/15 hover:border-amber-200/40";
  // Strong pulsing yellow-gold ring with outer glow when the tutorial wants
  // this exact slot pressed. The animation is css-keyframed so it works even
  // when the Framer Motion bundle is loaded lazily.
  const hotClass =
    "border-amber-300/95 ring-2 ring-amber-300/90 ring-offset-1 ring-offset-stone-900 [animation:snapshotGroveTutorPulse_1.05s_ease-in-out_infinite] shadow-[0_0_18px_rgba(252,211,77,0.65)]";
  return (
    <button
      className={`${baseClass} ${highlighted ? hotClass : calmClass}`}
      style={{ minWidth: "2.8rem", minHeight: "2.8rem" }}
      onClick={onClick}
      title={`${label} (${hint})${
        highlighted ? " — tutorial wants this next" : ""
      }`}
      aria-label={`${label} — hotkey ${hint}${
        highlighted ? " — tutorial highlight" : ""
      }`}
      data-tutor-nav-label={label}
      data-tutor-highlighted={highlighted ? "true" : "false"}
    >
      {highlighted && (
        <span
          aria-hidden="true"
          className="text-amber-200 pointer-events-none absolute -top-[1.55rem] left-1/2 -translate-x-1/2 drop-shadow-[0_0_6px_rgba(252,211,77,0.85)] [animation:snapshotGroveTutorArrow_0.85s_ease-in-out_infinite]"
          style={{
            fontSize: "1.05rem",
            lineHeight: "1rem",
            fontWeight: 900,
          }}
        >
          ▼
        </span>
      )}
      <img
        src={icon}
        className="h-5 w-5 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] sm:h-6 sm:w-6"
        alt=""
        draggable={false}
      />
      <span className="text-amber-200/85 mt-[1px] max-w-[2.85rem] truncate text-[7px] font-semibold uppercase leading-none tracking-wide sm:text-[8px]">
        {label}
      </span>
      <span className="top-0.5 rounded text-amber-200/80 absolute right-1 bg-black/60 px-1 text-[7.5px] font-bold leading-tight">
        {hint}
      </span>
    </button>
  );
}

// HARTHMERE_JOBS_BOARD_PANEL:
// Side-channel opener for the live Jobs Board container. NavSlot dispatches
// this event; the unified HUD listens and flips `jobsBoardOpen` to true.
// Routing it through a window event (rather than a callback) keeps NavSlot
// free of jobs-board-specific props and lets external code — like an "Open
// Jobs Board" prompt at the physical Grove board — open the panel without
// holding a React ref.
export function openHarthmereJobsBoardPanel() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(HARTHMERE_JOBS_BOARD_OPEN_EVENT));
  } catch {
    // Non-browser environments are no-op.
  }
}

// SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS:
// Listens for the runtime's "which nav slot to highlight right now?"
// broadcast. Returns a Set of NavSlot labels (e.g. "Bag", "Map", "Chat").
// HARTHMERE_TUTOR_HUD_HIGHLIGHT_MERGE:
// The Harthmere quest runtime publishes a parallel channel of its own labels
// so any non-Grove HUD/BiomesUI tutorial step (e.g. "you need an apple
// basket — look in your Bag", "an active quest is pinned on your Map") can
// pulse the right bottom-bar button. We merge both channels so neither one
// clobbers the other.
function useTutorHighlightedNavLabels(): Set<string> {
  const [groveLabels, setGroveLabels] = React.useState<Set<string>>(
    () => new Set()
  );
  const [harthmereLabels, setHarthmereLabels] = React.useState<Set<string>>(
    () => new Set()
  );
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const groveHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ labels?: string[] }>).detail;
      setGroveLabels(new Set(detail?.labels ?? []));
    };
    const harthmereHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ labels?: string[] }>).detail;
      setHarthmereLabels(new Set(detail?.labels ?? []));
    };
    window.addEventListener(
      "biomes:snapshot-grove-tutor-hud-highlights",
      groveHandler
    );
    window.addEventListener(
      "biomes:harthmere-quest-tutor-hud-highlights",
      harthmereHandler
    );
    return () => {
      window.removeEventListener(
        "biomes:snapshot-grove-tutor-hud-highlights",
        groveHandler
      );
      window.removeEventListener(
        "biomes:harthmere-quest-tutor-hud-highlights",
        harthmereHandler
      );
    };
  }, []);
  return React.useMemo(() => {
    const merged = new Set<string>();
    for (const label of groveLabels) merged.add(label);
    for (const label of harthmereLabels) merged.add(label);
    return merged;
  }, [groveLabels, harthmereLabels]);
}

// SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS — keyframe styles for the pulse + arrow.
// Injected once at module load via a stable element id.
function ensureSnapshotGroveTutorHighlightStyles() {
  if (typeof document === "undefined") return;
  const id = "snapshot-grove-tutor-highlight-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes snapshotGroveTutorPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(252, 211, 77, 0.85), 0 0 18px rgba(252, 211, 77, 0.55);
    transform: translateY(0px);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(252, 211, 77, 0), 0 0 26px rgba(252, 211, 77, 0.9);
    transform: translateY(-2px);
  }
}
@keyframes snapshotGroveTutorArrow {
  0%, 100% { transform: translate(-50%, 0); opacity: 0.95; }
  50% { transform: translate(-50%, 5px); opacity: 1; }
}
`;
  document.head.appendChild(style);
}

function FloatingPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border-white/15 pointer-events-auto fixed right-2 top-[6.5rem] z-40 max-h-[calc(100vh-7rem)] w-[min(36rem,calc(100vw-1rem))] overflow-y-auto border bg-black/90 p-3 text-white shadow-2xl backdrop-blur-md max-sm:inset-x-2 max-sm:top-16 max-sm:max-h-[calc(100vh-5rem)] md:right-4 md:top-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-white/85 text-sm font-bold uppercase tracking-wide">
          {title}
        </div>
        <button
          className="border-white/15 rounded-full border bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {children}
    </div>
  );
}

// HARTHMERE_JOBS_BOARD_PROXIMITY_GATE:
// Reads the player's live world position (from /scene/local_player) and
// passes it to the jobs board container as `worldContext.playerPosition`.
// The container then refuses to render the jobs list unless the player is
// actually inside a board's interaction radius. From the BiomesUI side this
// means: pressing B (or clicking the Jobs NavSlot) from anywhere other than
// a physical jobs board shows a wayfinding prompt instead of the jobs list.
function HarthmereJobsBoardLiveContainerWithPlayerProximity({
  onClose,
}: {
  onClose: () => void;
}) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as any;
  const camera = reactResources.use("/scene/camera") as any;
  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const worldContext: HarthmereJobsBoardWorldContext | undefined = (() => {
    if (playerPosition) {
      return {
        playerPosition: {
          x: playerPosition.x,
          y: playerPosition.y ?? 0,
          z: playerPosition.z,
        },
      };
    }
    return undefined;
  })();
  return (
    <HarthmereJobsBoardLiveContainer
      worldContext={worldContext}
      onClose={onClose}
    />
  );
}

// HARTHMERE_HOME_CONSOLE_WORLD_INTERFACE:
// Mirrors the physical jobs-board flow for player homes. The live container
// receives only the current player position; it resolves the nearest owned
// home_console marker from the server building snapshot before showing the
// prompt or allowing the management panel to open.
function HarthmereHomeConsoleWorldInterface({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as any;
  const camera = reactResources.use("/scene/camera") as any;
  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  return (
    <HarthmereHomeConsoleLiveContainer
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      playerPosition={
        playerPosition
          ? {
              x: playerPosition.x,
              y: playerPosition.y ?? 0,
              z: playerPosition.z,
            }
          : undefined
      }
    />
  );
}

function HarthmereBusinessWorldInterface({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as any;
  const camera = reactResources.use("/scene/camera") as any;
  const [selectedBusinessId, setSelectedBusinessId] = React.useState<
    string | undefined
  >();
  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const businessWorldContext = React.useMemo(
    () =>
      selectedBusinessId
        ? {
            nearbyBusinessId: selectedBusinessId,
            insideBusiness: true,
            interactionKeyLabel: "F",
          }
        : undefined,
    [selectedBusinessId]
  );
  const openFromPrompt = React.useCallback(
    (
      prompt: NonNullable<
        ReturnType<typeof nearestHarthmereBusinessBoardPhysicalPrompt>
      >
    ) => {
      setSelectedBusinessId(prompt.businessId);
      onOpen();
    },
    [onOpen]
  );
  const closeAndClearSelection = React.useCallback(() => {
    setSelectedBusinessId(undefined);
    onClose();
  }, [onClose]);
  return (
    <>
      <HarthmereBusinessBoardWorldPrompt onOpen={openFromPrompt} />
      <HarthmereBusinessLiveContainer
        open={open}
        onOpen={onOpen}
        onClose={closeAndClearSelection}
        showPrompt={false}
        worldContext={businessWorldContext}
        playerPosition={
          playerPosition
            ? {
                x: playerPosition.x,
                y: playerPosition.y ?? 0,
                z: playerPosition.z,
              }
            : undefined
        }
      />
    </>
  );
}

function HarthmereBusinessBoardWorldPrompt({
  onOpen,
}: {
  onOpen: (
    prompt: NonNullable<
      ReturnType<typeof nearestHarthmereBusinessBoardPhysicalPrompt>
    >
  ) => void;
}) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as any;
  const camera = reactResources.use("/scene/camera") as any;
  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const cameraPosition = harthmereJobsBoardCameraPosition(camera);
  const prompt = nearestHarthmereBusinessBoardPhysicalPrompt(playerPosition);
  const projectedPrompt = prompt
    ? harthmereJobsBoardPromptScreenProjection(prompt.position, camera)
    : undefined;

  const openBusinessBoardFromPrompt = React.useCallback(() => {
    if (!prompt) return;
    onOpen(prompt);
  }, [onOpen, prompt]);

  useEffect(() => {
    if (!prompt || typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
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
      if (event.code === "KeyF" || event.code === "KeyE") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openBusinessBoardFromPrompt();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [openBusinessBoardFromPrompt, prompt]);

  useEffect(() => {
    if (!prompt || typeof window === "undefined") return;
    const handler = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        harthmereJobsBoardEventFromEditable(event)
      ) {
        return;
      }
      const target = event.target as Element | null;
      const isGameCanvas =
        target?.tagName?.toLowerCase() === "canvas" ||
        Boolean(target?.closest?.("canvas"));
      if (!isGameCanvas) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openBusinessBoardFromPrompt();
    };
    window.addEventListener("click", handler, true);
    return () => window.removeEventListener("click", handler, true);
  }, [openBusinessBoardFromPrompt, prompt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const debug = {
      version: "harthmere-business-board-click",
      playerPosition,
      cameraPosition,
      prompt,
      open: () => prompt && onOpen(prompt),
    };
    (window as any).__harthmereBusinessBoardPromptDebug = debug;
    return () => {
      if ((window as any).__harthmereBusinessBoardPromptDebug === debug) {
        delete (window as any).__harthmereBusinessBoardPromptDebug;
      }
    };
  }, [cameraPosition, onOpen, playerPosition, prompt]);

  if (!prompt) return null;
  const openFromPromptClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    openBusinessBoardFromPrompt();
  };
  return (
    <>
      {projectedPrompt && (
        <div
          className="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-full px-3"
          style={{
            left: projectedPrompt.left,
            top: projectedPrompt.top,
          }}
          data-harthmere-business-board-world-prompt="projected"
        >
          <button
            type="button"
            className="min-h-14 min-w-40 rounded-xl border-emerald-200/45 bg-black/86 hover:border-emerald-100 hover:bg-black/92 focus:ring-emerald-100 pointer-events-auto border px-3 py-2 text-left text-white shadow-[0_10px_28px_rgba(0,0,0,0.55)] outline-none backdrop-blur transition focus:ring-2"
            onClick={openFromPromptClick}
            aria-label={`Open ${prompt.displayName}`}
          >
            <span className="text-emerald-100 block text-[10px] font-black uppercase tracking-[0.12em]">
              Click or press F
            </span>
            <span className="block text-sm font-black leading-tight">
              Open {prompt.displayName}
            </span>
            <span className="block text-[11px] leading-tight text-white/70">
              {Math.max(0, Math.round(prompt.distance))}m away
            </span>
          </button>
        </div>
      )}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[8.65rem] z-40 flex justify-center px-3"
        data-harthmere-business-board-world-prompt="bottom"
      >
        <button
          type="button"
          className="rounded-xl border-emerald-200/35 bg-black/82 pointer-events-auto flex items-center gap-3 border px-4 py-3 text-white shadow-[0_10px_28px_rgba(0,0,0,0.55)] backdrop-blur"
          onClick={openFromPromptClick}
          aria-label={`Open ${prompt.displayName}`}
        >
          <span className="min-w-8 bg-white/12 grid h-8 place-items-center rounded-md border border-white/20 text-sm font-black">
            F
          </span>
          <span className="text-left">
            <span className="mb-0.5 rounded border-emerald-200/35 bg-emerald-200/12 px-1.5 py-0.5 text-emerald-100 inline-flex border text-[10px] font-black uppercase tracking-[0.16em]">
              Business Board
            </span>
            <span className="block text-sm font-black">
              Open business services
            </span>
            <span className="text-white/65 block text-[11px]">
              Start shifts, buy goods, and request services.
            </span>
          </span>
        </button>
      </div>
    </>
  );
}

function HarthmereJobsBoardWorldPrompt({ onOpen }: { onOpen: () => void }) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as any;
  const camera = reactResources.use("/scene/camera") as any;
  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const cameraPosition = harthmereJobsBoardCameraPosition(camera);
  const prompt = nearestHarthmereJobsBoardPhysicalPrompt(playerPosition);
  const projectedPrompt = prompt
    ? harthmereJobsBoardPromptScreenProjection(prompt.position, camera)
    : undefined;

  useEffect(() => {
    if (!prompt || typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
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
      if (event.code === "KeyF" || event.code === "KeyE") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onOpen, prompt]);

  useEffect(() => {
    if (!prompt || typeof window === "undefined") return;
    const handler = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        harthmereJobsBoardEventFromEditable(event)
      ) {
        return;
      }
      const target = event.target as Element | null;
      const isGameCanvas =
        target?.tagName?.toLowerCase() === "canvas" ||
        Boolean(target?.closest?.("canvas"));
      if (!isGameCanvas) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onOpen();
    };
    window.addEventListener("click", handler, true);
    return () => window.removeEventListener("click", handler, true);
  }, [onOpen, prompt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const debug = {
      version: "harthmere-jobs-board-click",
      playerPosition,
      cameraPosition,
      prompt,
      boards: HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS,
      open: onOpen,
      dispatchOpen() {
        window.dispatchEvent(new Event(HARTHMERE_JOBS_BOARD_OPEN_EVENT));
      },
    };
    (window as any).__harthmereJobsBoardDebug = debug;
    return () => {
      if ((window as any).__harthmereJobsBoardDebug === debug) {
        delete (window as any).__harthmereJobsBoardDebug;
      }
    };
  }, [cameraPosition, onOpen, playerPosition, prompt]);

  if (!prompt) return null;
  const openFromPromptClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    onOpen();
  };
  return (
    <>
      {projectedPrompt && (
        <div
          className="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-full px-3"
          style={{
            left: projectedPrompt.left,
            top: projectedPrompt.top,
          }}
        >
          <button
            type="button"
            className="min-h-14 min-w-40 rounded-xl border-cyan-200/45 bg-black/86 hover:border-cyan-100 hover:bg-black/92 focus:ring-cyan-100 pointer-events-auto border px-3 py-2 text-left text-white shadow-[0_10px_28px_rgba(0,0,0,0.55)] outline-none backdrop-blur transition focus:ring-2"
            onClick={openFromPromptClick}
            aria-label={`Open ${prompt.displayName}`}
          >
            <span className="text-cyan-100 block text-[10px] font-black uppercase tracking-[0.12em]">
              Click or press F
            </span>
            <span className="block text-sm font-black leading-tight">
              Open {prompt.displayName}
            </span>
            <span className="block text-[11px] leading-tight text-white/70">
              {Math.max(0, Math.round(prompt.distance))}m away
            </span>
          </button>
        </div>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-[8.65rem] z-40 flex justify-center px-3">
        <button
          type="button"
          className="rounded-xl border-cyan-200/35 bg-black/82 pointer-events-auto flex items-center gap-3 border px-4 py-3 text-white shadow-[0_10px_28px_rgba(0,0,0,0.55)] backdrop-blur"
          onClick={openFromPromptClick}
          aria-label={`Read ${prompt.displayName}`}
        >
          <span className="min-w-8 bg-white/12 grid h-8 place-items-center rounded-md border border-white/20 text-sm font-black">
            F
          </span>
          <span className="text-left">
            <span className="mb-0.5 rounded border-cyan-200/35 bg-cyan-200/12 px-1.5 py-0.5 text-cyan-100 inline-flex border text-[10px] font-black uppercase tracking-[0.16em]">
              Job Board
            </span>
            <span className="block text-sm font-black">
              Read {prompt.displayName}
            </span>
            <span className="text-white/65 block text-[11px]">
              Find work, accept jobs, and turn in completed tasks.
            </span>
          </span>
        </button>
      </div>
    </>
  );
}

function harthmereJobsBoardEventFromEditable(event: Event) {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target?.isContentEditable) ||
    Boolean(
      target?.closest?.(
        "button,a,input,textarea,select,[contenteditable='true']"
      )
    )
  );
}

function harthmereJobsBoardPromptScreenProjection(
  position: { x: number; y?: number; z: number },
  camera:
    | { three?: any; pos?: () => number[]; view?: () => number[] }
    | undefined
):
  | {
      left: number;
      top: number;
    }
  | undefined {
  if (typeof window === "undefined" || !camera?.three) return undefined;
  const target = new Vector3(position.x, (position.y ?? 70) + 3.2, position.z);
  const cameraPos = camera.pos?.();
  const cameraView = camera.view?.();
  if (cameraPos && cameraView) {
    const dx = target.x - Number(cameraPos[0]);
    const dy = target.y - Number(cameraPos[1]);
    const dz = target.z - Number(cameraPos[2]);
    const facing =
      dx * Number(cameraView[0]) +
      dy * Number(cameraView[1]) +
      dz * Number(cameraView[2]);
    if (Number.isFinite(facing) && facing < 0) return undefined;
  }
  target.project(camera.three);
  if (
    target.x < -1 ||
    target.x > 1 ||
    target.y < -1 ||
    target.y > 1 ||
    target.z < -1 ||
    target.z > 1
  ) {
    return undefined;
  }
  return {
    left: ((target.x + 1) / 2) * window.innerWidth,
    top: ((1 - target.y) / 2) * window.innerHeight,
  };
}

function CenterMapPanel({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-black/45 pointer-events-auto fixed inset-0 z-50 flex items-start justify-center p-2 pt-10 backdrop-blur-sm sm:items-center sm:p-3 sm:pt-3">
      <div className="rounded-2xl border-white/15 max-h-[calc(100vh-2rem)] w-[min(54rem,calc(100vw-1rem))] overflow-hidden border bg-black/90 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
          <div>
            <div className="text-white/85 text-sm font-bold uppercase tracking-wide">
              {BIOMES_GAME_NAME} Map
            </div>
            <div className="text-white/55 text-[10px]">
              Current area map, objective markers, service landmarks, and
              vertical terrain level for the region the player is actually
              standing in.
            </div>
          </div>
          <button
            className="border-white/15 rounded-full border bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-3">
          {children}
        </div>
      </div>
    </div>
  );
}

installSnapshotLiveNpcLoreDebug();

export const HarthmereUnifiedHUD: React.FunctionComponent<{
  hideLegacyVisuals?: boolean;
}> = ({ hideLegacyVisuals = true }) => {
  useHarthmerePlayerSwordVisualBridge();
  useHarthmereLocalPlayerWearableMeshBridge();
  const pointerLockManager = usePointerLockManager();
  const jobsBoardReturnPointerLockRef = React.useRef(false);
  const { userId, reactResources } = useClientContext();
  const [glitchGameUserId, setGlitchGameUserId] = useState<string | undefined>(
    () => getHarthmereGlitchGameUserId()
  );
  useEffect(() => {
    const refresh = () => setGlitchGameUserId(getHarthmereGlitchGameUserId());
    refresh();
    window.addEventListener(HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(
        HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT,
        refresh
      );
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    setHarthmereLocalDevUserScope(glitchGameUserId ?? userId);
  }, [userId, glitchGameUserId]);
  useHarthmereAmbientThreats();
  useHarthmereRealtimeCombatAI();
  useHarthmereForwardArcRuntime();
  useHarthmereFallDamageBridge();
  useHarthmereDrowningDamageBridge();
  useHarthmerePvpIncomingDamageBridge();
  useHarthmereLocalPlayerAttackGestureBridge();
  useHarthmereComprehensiveAnimationRuntimeBridge();
  useHarthmereCombatHotkeys();
  const hudVisibility = useBiomesHUDVisibilitySnapshot();
  const [panel, setPanel] = useState<HarthmereHudPanel>();
  const [systemsTab, setSystemsTab] = useState<MenuTab | undefined>();
  const [focusAction, setFocusAction] = useState<
    HarthmereHudAction | undefined
  >();
  void hideLegacyVisuals;
  const legacyVisualsHidden = true;
  // HARTHMERE_JOBS_BOARD_PANEL:
  // Independent overlay state — the shared HUD reducer doesn't know about the
  // jobs board, and the panel is a self-contained live modal. Keeping it out
  // of `panel` avoids touching the reducer contract / tests.
  const [jobsBoardOpen, setJobsBoardOpen] = useState(false);
  const [homeConsoleOpen, setHomeConsoleOpen] = useState(false);
  const [businessInterfaceOpen, setBusinessInterfaceOpen] = useState(false);
  const openJobsBoard = React.useCallback(() => {
    openHarthmereJobsBoardPointerLock(
      pointerLockManager,
      jobsBoardReturnPointerLockRef
    );
    try {
      if (reactResources.get("/game_modal")?.kind !== "empty") {
        reactResources.set("/game_modal", {
          kind: "empty",
          returnPointerLock: false,
        });
      }
    } catch {}
    setJobsBoardOpen(true);
  }, [pointerLockManager, reactResources]);
  const closeJobsBoard = React.useCallback(() => {
    setJobsBoardOpen(false);
    closeHarthmereJobsBoardPointerLock(
      pointerLockManager,
      jobsBoardReturnPointerLockRef
    );
  }, [pointerLockManager]);
  const openBusinessInterface = React.useCallback(() => {
    setBusinessInterfaceOpen(true);
  }, []);
  const closeBusinessInterface = React.useCallback(() => {
    setBusinessInterfaceOpen(false);
  }, []);
  useEffect(() => {
    return () => {
      closeHarthmereJobsBoardPointerLock(
        pointerLockManager,
        jobsBoardReturnPointerLockRef
      );
    };
  }, [pointerLockManager]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const keyHandler = (event: KeyboardEvent) => {
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
      // B opens the Jobs Board (and toggles closed). Escape closes from
      // anywhere even when the panel is the focused modal.
      if (event.code === "KeyB") {
        event.preventDefault();
        if (jobsBoardOpen) {
          closeJobsBoard();
        } else {
          openJobsBoard();
        }
      }
    };
    window.addEventListener(HARTHMERE_JOBS_BOARD_OPEN_EVENT, openJobsBoard);
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener(
        HARTHMERE_JOBS_BOARD_OPEN_EVENT,
        openJobsBoard
      );
      window.removeEventListener("keydown", keyHandler);
    };
  }, [closeJobsBoard, jobsBoardOpen, openJobsBoard]);

  const openHudAction = (action: HarthmereHudAction) => {
    dispatchHarthmereHudActionEvent(action);
    const next = reduceHarthmereHudStateForAction(
      { panel, systemsTab, focusAction },
      action
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
      const binding = harthmereHudBindingForCode(event.code);
      if (!binding) {
        return;
      }
      if (legacyVisualsHidden) {
        // Replacement mode keeps all Harthmere runtime hooks/controllers alive,
        // but key presses should open the BiomesUI replacement tabs instead of
        // invisible legacy panels. BiomesUIMount handles those keys.
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openHudAction(binding.action);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [systemsTab, panel, focusAction, legacyVisualsHidden]);

  const runtimeControllers = (
    <>
      <HarthmereQuestNavAidController />
      <SnapshotMissionRuntimeController />
      <SnapshotGroveBibleRuntimeController />
      <SnapshotCompletePortRuntimeController />
      <SnapshotProductionPortRuntimeController />
      <SnapshotLiveDiagnosticsRuntimeController />
      <HarthmereDeathRuntimeController />
      <HarthmereFoodStaminaRuntimeController />
      <HarthmereCampfireWarmthRuntimeController />
      <HarthmereNativeTerrainBlockInventoryBridge />
      <SnapshotProductionPortFacts />
      <SnapshotCombatRuntimeController />
    </>
  );

  if (legacyVisualsHidden) {
    return (
      <>
        {runtimeControllers}
        <HarthmereDeathScreenOverlay />
        <HarthmereVendorTradePanel />
        <HarthmereObjectContainerPanel />
        <HarthmereCookingStationPanel />
        <HarthmereGatheringNodeWorldInteraction />
        <HarthmereLootDropWorldInteraction />
        <HarthmereJobsBoardWorldPrompt onOpen={openJobsBoard} />
        <HarthmereHomeConsoleWorldInterface
          open={homeConsoleOpen}
          onOpen={() => setHomeConsoleOpen(true)}
          onClose={() => setHomeConsoleOpen(false)}
        />
        <HarthmereBusinessWorldInterface
          open={businessInterfaceOpen}
          onOpen={openBusinessInterface}
          onClose={closeBusinessInterface}
        />
        {jobsBoardOpen && (
          <HarthmereJobsBoardLiveContainerWithPlayerProximity
            onClose={closeJobsBoard}
          />
        )}
      </>
    );
  }

  return (
    <>
      {runtimeControllers}
      {hudVisibility.vitals && <CompactStatusCluster />}
      <HarthmereDeathScreenOverlay />
      {hudVisibility.vitals && (
        <div className="fixed left-2 top-[9.25rem] z-30 md:left-3 md:top-[10.25rem]">
          <HarthmereDeathHUD />
        </div>
      )}
      <HarthmereEnemyHealthBarsHUD />
      {hudVisibility.miniMap && (
        <div className="fixed right-2 top-2 z-30 md:right-4 md:top-4">
          <MiniMapHUD />
        </div>
      )}
      {hudVisibility.objectives && (
        <div className="pointer-events-auto fixed right-2 top-[20.25rem] z-30 w-[min(19rem,calc(100vw-1rem))] max-sm:hidden md:right-4 md:top-[20.75rem]">
          <SnapshotGroveMapHUD />
        </div>
      )}
      {hudVisibility.helpButtons && <FightSideControls />}
      {hudVisibility.actionBar && <UtilityActionBar onAction={openHudAction} />}
      <SnapshotGroveTutorChatPanel />
      <HarthmereJobsBoardWorldPrompt onOpen={openJobsBoard} />
      <HarthmereHomeConsoleWorldInterface
        open={homeConsoleOpen}
        onOpen={() => setHomeConsoleOpen(true)}
        onClose={() => setHomeConsoleOpen(false)}
      />
      <HarthmereBusinessWorldInterface
        open={businessInterfaceOpen}
        onOpen={openBusinessInterface}
        onClose={closeBusinessInterface}
      />
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
        <CenterMapPanel
          onClose={() => {
            setPanel(undefined);
            setFocusAction(undefined);
          }}
        >
          <div className="space-y-4">
            <HarthmereQuestMapHUD />
            <div className="grid gap-3 md:grid-cols-3">
              <SnapshotMissionMapHUD />
              <SnapshotGroveMapHUD />
              <SnapshotCombatMapHUD />
            </div>
          </div>
        </CenterMapPanel>
      )}
      {panel === "quests" && (
        <FloatingPanel
          title="Quest journal"
          onClose={() => {
            setPanel(undefined);
            setFocusAction(undefined);
          }}
        >
          <div className="space-y-3">
            <SnapshotMissionJournalPanel />
            <SnapshotGroveJournalPanel />
            <SnapshotMissionAuditPanel />
            <SnapshotGroundingAuditPanel />
            <SnapshotLiveGroundingAuditPanel />
            <SnapshotPerformanceWalkerPanel />
            <SnapshotRemainingPortAuditPanel />
            <SnapshotCombatJournalPanel />
            <HarthmereMissionJournalPanel />
          </div>
        </FloatingPanel>
      )}
      <HarthmereVendorTradePanel />
      <HarthmereObjectContainerPanel />
      <HarthmereCookingStationPanel />
      <HarthmereGatheringNodeWorldInteraction />
      <HarthmereLootDropWorldInteraction />
      {/* HARTHMERE_JOBS_BOARD_PANEL:
          The live container fetches `/api/harthmere/live_mode_jobs_board_state`
          on mount and replays the server snapshot through every mutation.
          When `jobsBoardOpen` is true, the panel renders over the world; the
          panel itself fires `completeHarthmereJobsBoardReadQuest` so the
          starter "Read the Jobs Board" quest completes the first time the
          player opens it. */}
      {jobsBoardOpen && (
        <HarthmereJobsBoardLiveContainerWithPlayerProximity
          onClose={closeJobsBoard}
        />
      )}
    </>
  );
};

export const HARTHMERE_LEGACY_BIOMES_SYSTEMS_PANEL_RETIRED =
  "harthmere-legacy-biomes-systems-panel-retired" as const;

export const HarthmereSystemsMenuPanel: React.FunctionComponent<{
  initialTab?: MenuTab;
  initialAction?: HarthmereHudAction;
  onClose?: () => void;
}> = ({ initialTab = "journal", initialAction, onClose }) => {
  // The replacement BiomesUI now owns Journal/Inventory/Map/Bank/Skills/etc.
  // Keep this legacy right-side systems panel mounted as a no-op so older callers
  // do not crash, but never render the duplicate legacy systems screen.
  void initialTab;
  void initialAction;
  void onClose;
  void HARTHMERE_LEGACY_BIOMES_SYSTEMS_PANEL_RETIRED;
  return null;
};

// current attack variation debug payload marker
const __HARTHMERE_ATTACK_VARIATION_HUD = {
  attackVariationId: true,
  attackVariationFamily: true,
};

// current attack variation HUD bridge markers.
const __HARTHMERE_VARIATION_HUD = {
  attackVariationId: true,
  attackVariationFamily: true,
  attackVariationIndex: true,
  attackVariationEmoteType: true,
};

// HARTHMERE_ECONOMY_OPTIMIZATION_PANEL_WIRED
// LocalDevHarthmereEconomyOptimizationSystem is imported for economy health/market review wiring.
