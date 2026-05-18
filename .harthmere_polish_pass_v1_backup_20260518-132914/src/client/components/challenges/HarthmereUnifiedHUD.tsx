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
import { HarthmereDeathMenuPanel } from "@/client/components/challenges/LocalDevHarthmereDeathSystem";
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
  HARTHMERE_ATTACK_ANIMATION_EVENT,
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
import React, { useEffect, useMemo, useState } from "react";
import { LocalDevHarthmereEconomyOptimizationSystem } from "./LocalDevHarthmereEconomyOptimizationSystem";
import LocalDevHarthmereDialogueRuleSystemPanel from "./LocalDevHarthmereDialogueRuleSystem";

const ICONS = {
  heart: "/assets/harthmere/png/icons/quaternius_rpg_items/Heart.png",
  sword: "/assets/harthmere/png/icons/quaternius_rpg_items/Sword_Big.png",
  spark: "/assets/harthmere/png/icons/quaternius_rpg_items/Book1_Open.png",
  shield: "/assets/harthmere/png/icons/quaternius_rpg_items/Shield.png",
  quest: "/assets/harthmere/png/ui/kenney_game_icons/PNG/White/2x/question.png",
};

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

function CompactStatusCluster() {
  const combat = useHarthmereCombatState();
  const reputation = useHarthmereReputationState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  const regional = reputation.regions.harthmere;
  const title = getHarthmereCombinedPublicTitle(reputation);

  return (
    <div className="pointer-events-none fixed left-2 top-2 z-30 w-[min(16rem,calc(100vw-1rem))] rounded-xl border border-white/15 bg-black/60 p-2 text-white shadow-2xl backdrop-blur-md md:left-3 md:top-3 md:w-[15.5rem]">
      <div className="mb-1.5 min-w-0">
        <div className="truncate text-xs font-bold tracking-wide text-white">Harthmere</div>
        <div className="truncate text-[9px] leading-none text-white/55">{title}</div>
      </div>
      <div className="space-y-1.5">
        <Bar
          icon={ICONS.heart}
          label="Health"
          value={`${combat.player.hp}/${combat.player.maxHp}`}
          percent={(combat.player.hp / Math.max(1, combat.player.maxHp)) * 100}
          detail={combat.player.combatState.replaceAll("_", " ")}
        />
        <Bar
          icon={ICONS.spark}
          label="Mana"
          value={`${multiplayer.mana}/${multiplayer.maxMana}`}
          percent={(multiplayer.mana / Math.max(1, multiplayer.maxMana)) * 100}
        />
        <div className="grid grid-cols-3 gap-1 pt-0.5">
          <Bar label="Like" value={String(regional.likeability)} percent={signedStandingPercent(regional.likeability)} />
          <Bar label="Law" value={String(regional.legal)} percent={signedStandingPercent(regional.legal)} />
          <Bar label="Known" value={String(regional.notoriety)} percent={notorietyPercent(regional.notoriety)} />
        </div>
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
    { id: string; label: string; kind: string } | undefined
  >(undefined);

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
      }>).detail;
      if (!detail) {
        return;
      }
      const resultLabel = detail.result?.replaceAll("_", " ") ?? "miss";
      const label =
        Number(detail.finalDamage ?? 0) > 0
          ? `-${Math.round(Number(detail.finalDamage))}`
          : resultLabel;
      setCombatFloat({
        id: `${detail.id ?? Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        label,
        kind: detail.result ?? "combat",
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
      {combatFloat && (
        <div key={combatFloat.id} className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <style>{`
            @keyframes harthmere-floating-combat {
              0% { transform: translateY(0) scale(0.82); opacity: 0; }
              18% { opacity: 1; }
              100% { transform: translateY(-74px) scale(1.18); opacity: 0; }
            }
          `}</style>
          <div
            className="rounded-full border border-white/35 bg-black/70 px-4 py-2 text-3xl font-black uppercase tracking-wide text-white shadow-[0_0_24px_rgba(255,255,255,0.45)]"
            style={{ animation: "harthmere-floating-combat 760ms ease-out forwards" }}
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
            label="Heavy"
            hint="N / HeavyAttack"
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
          <div><span className="font-semibold text-white/75">X</span> draw · <span className="font-semibold text-white/75">Tab</span> target · <span className="font-semibold text-white/75">B</span> Attack · <span className="font-semibold text-white/75">N</span> HeavyAttack · <span className="font-semibold text-white/75">L</span> BasicMagic · <span className="font-semibold text-white/75">P</span> PvP</div><div className="mt-1 text-white/45">Reserved: combat keys do not overlap with M map, J quests, or F interact.</div>
        </div>
      </div>
    </>
  );
}

function UtilityActionBar({ onOpenMap, onOpenQuests }: { onOpenMap: () => void; onOpenQuests: () => void }) {
  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-30 flex w-[min(20rem,calc(100vw-1rem))] -translate-x-1/2 justify-center gap-2 md:bottom-5">
      <TouchButton icon={ICONS.quest} label="Quests" hint="J" onClick={onOpenQuests} />
      <TouchButton label="Map" hint="M" onClick={onOpenMap} />
      <TouchButton label="Revive" hint="Safe" onClick={() => reviveHarthmerePlayer("HUD")} />
    </div>
  );
}

function FloatingPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto fixed right-2 top-[7rem] z-40 max-h-[calc(100vh-8rem)] w-[min(32rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-white/15 bg-black/90 p-3 text-white shadow-2xl backdrop-blur-md md:right-4 md:top-4">
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
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-2rem)] w-[min(50rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-white/15 bg-black/90 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
          <div className="text-sm font-bold uppercase tracking-wide text-white/85">Harthmere Map</div>
          <button className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20" onClick={onClose}>Close</button>
        </div>
        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-3">
          {children}
        </div>
      </div>
    </div>
  );
}

export const HarthmereUnifiedHUD: React.FunctionComponent<{}> = () => {
  useHarthmerePlayerSwordVisualBridge();
  const { userId } = useClientContext();
  useEffect(() => {
    setHarthmereLocalDevUserScope(userId);
  }, [userId]);
  useHarthmereAmbientThreats();
  useHarthmereRealtimeCombatAI();
  useHarthmereForwardArcRuntime();
  useHarthmereLocalPlayerAttackGestureBridge();
  useHarthmereComprehensiveAnimationRuntimeBridgeV6();
  useHarthmereCombatHotkeys();
  const [panel, setPanel] = useState<"map" | "quests" | undefined>();

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
      if (event.code === "KeyM") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setPanel((current) => (current === "map" ? undefined : "map"));
      } else if (event.code === "KeyJ") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setPanel((current) => (current === "quests" ? undefined : "quests"));
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  return (
    <>
      <CompactStatusCluster />
      <div className="fixed right-2 top-2 z-30 md:right-4 md:top-4">
        <MiniMapHUD />
      </div>
      <FightSideControls />
      <UtilityActionBar
        onOpenMap={() => setPanel((current) => (current === "map" ? undefined : "map"))}
        onOpenQuests={() => setPanel((current) => (current === "quests" ? undefined : "quests"))}
      />
      {panel === "map" && (
        <CenterMapPanel onClose={() => setPanel(undefined)}>
          <HarthmereQuestMapHUD />
        </CenterMapPanel>
      )}
      {panel === "quests" && (
        <FloatingPanel title="Quest journal" onClose={() => setPanel(undefined)}>
          <HarthmereMissionJournalPanel />
        </FloatingPanel>
      )}
      <HarthmereVendorTradePanel />
    </>
  );
};

type MenuTab =
  | "journal"
  | "inventory"
  | "combat"
  | "standing"
  | "skills"
  | "world"
  | "dialogue";

const MENU_TABS: { id: MenuTab; label: string }[] = [
  { id: "journal", label: "Journal" },
  { id: "inventory", label: "Inventory" },
  { id: "combat", label: "Combat" },
  { id: "standing", label: "Standing" },
  { id: "skills", label: "Skills" },
  { id: "world", label: "World" },
  { id: "dialogue", label: "Dialogue Rules" },
];

export const HarthmereSystemsMenuPanel: React.FunctionComponent<{}> = () => {
  const [tab, setTab] = useState<MenuTab>("journal");
  const tabContent = useMemo(() => {
    if (tab === "journal") {
      return <HarthmereMissionJournalPanel />;
    }
    if (tab === "inventory") {
      return <HarthmereInventoryMenuPanel />;
    }
    if (tab === "combat") {
      return (
        <div className="space-y-2">
          <HarthmereCombatMenuPanel />
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
    <div className="pointer-events-auto max-h-[calc(100vh-8rem)] w-[min(34rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-white/15 bg-black/90 text-white shadow-2xl backdrop-blur-md">
      <div className="border-b border-white/10 p-3">
        <div className="mb-2 text-sm font-bold uppercase tracking-wide text-white/85">
          Harthmere Systems
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-[11px] md:grid-cols-7">
          {MENU_TABS.map((entry) => (
            <button
              key={entry.id}
              className={`rounded-lg px-2 py-1 font-semibold transition ${
                tab === entry.id
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/75 hover:bg-white/20"
              }`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[calc(100vh-15rem)] overflow-y-auto p-2">{tabContent}</div>
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
