import { useHarthmereCombatState } from "@/client/components/challenges/LocalDevHarthmereCombat";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { useHarthmereMultiplayerCombatState } from "@/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem";
import { useHarthmereFoodStaminaState } from "@/client/components/challenges/LocalDevHarthmereFoodStaminaSystem";
import {
  getHarthmereCombinedPublicTitle,
  useHarthmereReputationState,
} from "@/client/components/challenges/LocalDevHarthmereReputation";
import {
  useHarthmereLevelingState,
  xpRequiredForNextHarthmereLevel,
} from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { BIOMES_GAME_NAME } from "@/shared/biomes/display_names";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import {
  harthmereNativeXpForNextLevel,
  readHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { readHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";
import { HARTHMERE_GOLD_ECS_CURRENCY_ID } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import React from "react";
import {
  biomesUIVitalsDisplayFromLiveStatusForTest,
  biomesUIVitalsStaminaDisplayForTest,
  useBiomesUIPlayerStatusState,
} from "./adapters/playerStatusAdapter";
import { biomesUIStaminaWarningLevelForTest } from "./staminaWarning";
import type { HighlightStyle } from "./highlight/HighlightRegistry";
import { useBlinkTarget } from "./highlight/useBlinkTarget";
import { UI_IDS } from "./uniqueIds";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function percent(value: number, max: number): number {
  return clamp((value / Math.max(1, max)) * 100, 0, 100);
}

function signedStandingPercent(value: number): number {
  return clamp(((value + 10_000) / 20_000) * 100, 0, 100);
}

function notorietyPercent(value: number): number {
  return clamp((value / 10_000) * 100, 0, 100);
}

const STANDING_ICONS = {
  like: "♥",
  law: "⚖",
  notoriety: "◉",
} as const;

function formatStateLabel(value: string | undefined): string {
  return String(value ?? "ready").replaceAll("_", " ");
}

function highlightClassName(blinking: boolean, style: HighlightStyle | null) {
  if (!blinking) {
    return "";
  }
  switch (style) {
    case "ring":
      return "biomes-ui-blink-ring";
    case "arrow":
      return "biomes-ui-blink-arrow";
    case "shimmer":
      return "biomes-ui-blink-shimmer";
    case "pulse":
    default:
      return "biomes-ui-blink-pulse";
  }
}

export function displayBiomesVitalsBarValueForTest(value: unknown): number {
  const rawValue = Math.max(0, Number(value) || 0);
  return rawValue > 0 ? Math.max(1, Math.ceil(rawValue)) : 0;
}

export function formatBiomesVitalsBarValueForTest(
  value: unknown,
  options: { showTenths?: boolean } = {}
): string {
  const rawValue = Math.max(0, Number(value) || 0);
  if (options.showTenths && rawValue > 0 && !Number.isInteger(rawValue)) {
    return rawValue.toFixed(1);
  }
  return String(displayBiomesVitalsBarValueForTest(rawValue));
}

function VitalsBar({
  label,
  value,
  max,
  tone,
  uiId,
}: {
  label: string;
  value: number;
  max: number;
  tone: "health" | "mana" | "stamina";
  uiId: string;
}) {
  const highlight = useBlinkTarget<HTMLDivElement>(uiId);
  const rawValue = Math.max(0, Number(value) || 0);
  const displayValue = formatBiomesVitalsBarValueForTest(rawValue, {
    showTenths: tone === "stamina",
  });
  const safeMax = Math.max(1, Math.round(Number(max) || 1));
  const width = percent(rawValue, safeMax);
  const staminaWarning =
    tone === "stamina"
      ? biomesUIStaminaWarningLevelForTest(rawValue, safeMax)
      : "none";

  return (
    <div
      ref={highlight.ref}
      className={`biomes-ui-vitals-bar ${highlightClassName(
        highlight.blinking,
        highlight.style
      )}`.trim()}
      data-ui-id={uiId}
      data-ui-blinking={highlight.blinking ? "true" : undefined}
      data-stamina-warning={
        staminaWarning !== "none" ? staminaWarning : undefined
      }
    >
      <div className="biomes-ui-vitals-bar__meta">
        <span className="biomes-ui-vitals-bar__label">
          <span className="biomes-ui-vitals-bar__label-text">{label}</span>
          <span
            className={`biomes-ui-vitals-bar__icon biomes-ui-vitals-bar__icon--${tone}`}
            aria-hidden
          >
            {tone === "health" ? "♥" : tone === "mana" ? "✦" : "⚡"}
          </span>
        </span>
        <span className="biomes-ui-vitals-bar__value">
          {displayValue}/{safeMax}
        </span>
      </div>
      <div
        className="biomes-ui-vitals-bar__track"
        aria-label={`${label} ${displayValue} of ${safeMax}`}
      >
        <span
          className={`biomes-ui-vitals-bar__fill biomes-ui-vitals-bar__fill--${tone}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function StandingChip({
  label,
  value,
  percent,
  tone,
  uiId,
}: {
  label: string;
  value: number;
  percent: number;
  tone: "like" | "law" | "notoriety";
  uiId: string;
}) {
  const highlight = useBlinkTarget<HTMLDivElement>(uiId);
  return (
    <div
      ref={highlight.ref}
      className={`biomes-ui-vitals-chip ${highlightClassName(
        highlight.blinking,
        highlight.style
      )}`.trim()}
      data-tone={tone}
      data-ui-id={uiId}
      data-ui-blinking={highlight.blinking ? "true" : undefined}
    >
      <span className="biomes-ui-vitals-chip__label">
        <span className="biomes-ui-vitals-chip__label-text">{label}</span>
        <span
          className={`biomes-ui-vitals-chip__icon biomes-ui-vitals-chip__icon--${tone}`}
          aria-hidden
        >
          {STANDING_ICONS[tone]}
        </span>
      </span>
      <span className="biomes-ui-vitals-chip__value">{value}</span>
      <span className="biomes-ui-vitals-chip__track">
        <span
          className="biomes-ui-vitals-chip__fill"
          style={{ width: `${clamp(percent, 0, 100)}%` }}
        />
      </span>
    </div>
  );
}

export function formatBiomesGoldForVitalsForTest(value: unknown): string {
  const gold = Math.max(0, Math.floor(Number(value) || 0));
  return `${gold} gold`;
}

export function formatBiomesLevelForVitalsForTest(value: unknown): string {
  const level = Math.max(1, Math.floor(Number(value) || 1));
  return `Level ${level}`;
}

export function nativeGoldBalanceForVitalsForTest(
  inventory:
    | { currencies?: ReadonlyMap<string, { count?: bigint }> }
    | undefined
) {
  const count = inventory?.currencies?.get(
    String(HARTHMERE_GOLD_ECS_CURRENCY_ID)
  )?.count;
  return Math.max(0, Number(count ?? 0n));
}

function useLiveModeGoldBalance(): number {
  const [gold, setGold] = React.useState(0);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const readGold = async () => {
      try {
        const response = await defaultHarthmereLiveFetch(
          "/api/harthmere/live_mode_inventory_loot_state",
          {
            method: "GET",
            credentials: "same-origin",
          }
        );
        if (!response.ok) return;
        const body = await response.json();
        const nextGold = Number(body?.inventoryLootState?.actor?.gold ?? 0);
        if (!cancelled && Number.isFinite(nextGold)) {
          setGold(Math.max(0, Math.floor(nextGold)));
        }
      } catch {
        // The HUD stays playable if the wallet is still loading.
      }
    };
    const onWallet = (event: Event) => {
      const nextGold = Number(
        (event as CustomEvent<{ gold?: number }>).detail?.gold
      );
      if (Number.isFinite(nextGold)) {
        setGold(Math.max(0, Math.floor(nextGold)));
      } else {
        void readGold();
      }
    };
    void readGold();
    window.addEventListener("biomes:live-mode-wallet-updated", onWallet);
    return () => {
      cancelled = true;
      window.removeEventListener("biomes:live-mode-wallet-updated", onWallet);
    };
  }, []);
  return gold;
}

export const BiomesUIVitalsPanel: React.FunctionComponent<{}> = () => {
  const { clientConfig, reactResources, userId } = useClientContext();
  const nativeHealth = reactResources.use("/ecs/c/health", userId);
  const nativeTriggerState = reactResources.use("/ecs/c/trigger_state", userId);
  const nativeInventory = reactResources.use("/ecs/c/inventory", userId);
  const combat = useHarthmereCombatState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  const stamina = useHarthmereFoodStaminaState();
  const reputation = useHarthmereReputationState();
  const leveling = useHarthmereLevelingState();
  const liveStatus = useBiomesUIPlayerStatusState();

  React.useEffect(() => {
    if (!nativeBiomesEcsAuthorityEnabled()) return;
    // One idempotent server migration imports legacy level/equipment once.
    // Subsequent combat and HUD updates arrive through normal ECS sync.
    void defaultHarthmereLiveFetch("/api/harthmere/native_combat_sync", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!nativeBiomesEcsAuthorityEnabled()) return;
    let stopped = false;
    let inFlight = false;
    let activeController: AbortController | undefined;
    const heartbeat = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      activeController = new AbortController();
      try {
        await defaultHarthmereLiveFetch("/api/harthmere/native_vitals", {
          method: "POST",
          credentials: "same-origin",
          signal: activeController.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "heartbeat",
          }),
        });
      } catch {
        // ECS remains authoritative. The bounded next heartbeat safely resumes
        // without stacking concurrent writes or applying a large catch-up tick.
      } finally {
        inFlight = false;
        activeController = undefined;
      }
    };
    void heartbeat();
    // The server scheduler is the periodic ECS authority. This heartbeat only
    // provides a bounded fallback/read response and must not contend with the
    // scheduler on every single world tick.
    const interval = window.setInterval(() => void heartbeat(), 15_000);
    return () => {
      stopped = true;
      activeController?.abort();
      window.clearInterval(interval);
    };
  }, []);

  const player = combat.player;
  const title = getHarthmereCombinedPublicTitle(reputation);
  const legacyGold = useLiveModeGoldBalance();
  const display = biomesUIVitalsDisplayFromLiveStatusForTest(liveStatus, {
    hp: player.hp,
    maxHp: player.maxHp,
    combatState: player.combatState,
    resourceLabel: "Mana",
    resourceValue: multiplayer.mana,
    resourceMax: multiplayer.maxMana,
    standing: reputation.regions.harthmere,
    gold: legacyGold,
  });
  // BiomesUI is the only active vitals surface. The data can arrive from the
  // server or the local-dev ECS bridge, but it must pass through the BiomesUI
  // player-status adapter so the panel never has competing health authorities.
  // ECS component updates arrive over the existing world sync websocket and
  // invalidate this resource immediately. Reading it directly removes the
  // multi-second REST/Redis polling delay and restores the May 16 snapshot's
  // single health/death authority.
  const useNativeHealth =
    nativeBiomesEcsAuthorityEnabled() && nativeHealth !== undefined;
  const nativeVitals = readHarthmereNativeVitals(nativeTriggerState);
  const useNativeVitals =
    nativeBiomesEcsAuthorityEnabled() && nativeTriggerState !== undefined;
  const healthHp = Math.max(
    0,
    Math.round(useNativeHealth ? nativeHealth.hp : display.hp)
  );
  const healthMaxHp = Math.max(
    1,
    Math.round(useNativeHealth ? nativeHealth.maxHp : display.maxHp)
  );
  const healthCombatState = useNativeHealth
    ? nativeHealth.hp <= 0
      ? "dead"
      : nativeHealth.lastDamageTime
      ? "in_combat"
      : "idle"
    : display.combatState;
  // Mana, survival stamina, breath, and standing share the server-synced ECS
  // TriggerState used by attacks, consumables, drowning, and death. As soon as
  // the synchronized component exists, its native defaults are authoritative;
  // waiting for the first migration write would briefly resurrect the stale
  // legacy 108/108 stamina snapshot.
  const manaValue = Math.max(
    0,
    Math.round(useNativeVitals ? nativeVitals.mana : multiplayer.mana)
  );
  const manaMax = Math.max(
    1,
    Math.round(useNativeVitals ? nativeVitals.maxMana : multiplayer.maxMana)
  );
  const staminaDisplay = biomesUIVitalsStaminaDisplayForTest(liveStatus, {
    staminaValue: Math.max(0, Number(stamina.stamina) || 0),
    staminaMax: Math.max(1, Math.round(stamina.maxStamina)),
  });
  const staminaValue = useNativeVitals
    ? nativeVitals.stamina
    : staminaDisplay.staminaValue;
  const staminaMax = useNativeVitals
    ? nativeVitals.maxStamina
    : staminaDisplay.staminaMax;
  const regional = useNativeVitals
    ? {
        likeability: nativeVitals.likeability,
        legal: nativeVitals.legal,
        notoriety: nativeVitals.notoriety,
        notorietyFloor: nativeVitals.notorietyFloor,
      }
    : display.standing ?? reputation.regions.harthmere;
  const gold = useNativeVitals
    ? nativeGoldBalanceForVitalsForTest(nativeInventory)
    : display.gold ?? legacyGold;
  const nativeProgression =
    readHarthmereNativeCombatProgression(nativeTriggerState);
  const useNativeProgression =
    nativeBiomesEcsAuthorityEnabled() && nativeProgression.migrationVersion > 0;
  // Native combat level and XP share the TriggerState document used by the
  // server's weapon gates and kill transaction. The local state is visible only
  // before the one-time migration completes, preventing a temporary Level 1
  // flash without keeping a second post-migration authority.
  const playerLevel = Math.max(
    1,
    Math.floor(useNativeProgression ? nativeProgression.level : leveling.level)
  );
  const xpCurrent = Math.max(
    0,
    Math.floor(useNativeProgression ? nativeProgression.xp : leveling.xpCurrent)
  );
  const xpNext = Math.max(
    1,
    Math.floor(
      useNativeProgression
        ? harthmereNativeXpForNextLevel(playerLevel)
        : xpRequiredForNextHarthmereLevel(playerLevel)
    )
  );
  const levelProgress = `${xpCurrent}/${xpNext} xp`;
  // Keep the class name from the live status but show the LOCAL level so the
  // header and the footer Level chip never disagree.
  const className = display.classLine
    ?.replace(/\s*·\s*Level\s*\d+\s*$/i, "")
    .trim();
  const headerTitle = className ? `${className} · Level ${playerLevel}` : title;
  const panelHighlight = useBlinkTarget<HTMLElement>(UI_IDS.HUD_VITALS);
  const goldHighlight = useBlinkTarget<HTMLDivElement>(UI_IDS.HUD_VITALS_GOLD);

  return (
    <aside
      ref={panelHighlight.ref}
      className={`biomes-ui-vitals-panel ${
        clientConfig.showVirtualJoystick ? "biomes-ui-vitals-panel--mobile" : ""
      } ${highlightClassName(
        panelHighlight.blinking,
        panelHighlight.style
      )}`.trim()}
      data-ui-id={UI_IDS.HUD_VITALS}
      data-ui-blinking={panelHighlight.blinking ? "true" : undefined}
      aria-label="Player vitals and reputation"
    >
      <div className="biomes-ui-vitals-panel__header">
        <div className="biomes-ui-vitals-panel__identity">
          <span className="biomes-ui-vitals-panel__game">
            {BIOMES_GAME_NAME}
          </span>
          <span
            className="biomes-ui-vitals-panel__title"
            title={
              levelProgress ? `${headerTitle} · ${levelProgress}` : headerTitle
            }
          >
            {headerTitle}
          </span>
        </div>
        <span className="biomes-ui-vitals-panel__state">
          {formatStateLabel(healthCombatState)}
        </span>
      </div>

      <div className="biomes-ui-vitals-panel__bars">
        <VitalsBar
          label="Health"
          value={healthHp}
          max={healthMaxHp}
          tone="health"
          uiId={UI_IDS.HUD_VITALS_HEALTH}
        />
        <VitalsBar
          label="Mana"
          value={manaValue}
          max={manaMax}
          tone="mana"
          uiId={UI_IDS.HUD_VITALS_MANA}
        />
        <VitalsBar
          label="Stamina"
          value={staminaValue}
          max={staminaMax}
          tone="stamina"
          uiId={UI_IDS.HUD_VITALS_STAMINA}
        />
      </div>

      <div className="biomes-ui-vitals-panel__standing">
        <StandingChip
          label="Like"
          value={regional.likeability}
          percent={signedStandingPercent(regional.likeability)}
          tone="like"
          uiId={UI_IDS.HUD_VITALS_LIKEABILITY}
        />
        <StandingChip
          label="Law"
          value={regional.legal}
          percent={signedStandingPercent(regional.legal)}
          tone="law"
          uiId={UI_IDS.HUD_VITALS_LEGAL}
        />
        <StandingChip
          label="Known"
          value={regional.notoriety}
          percent={notorietyPercent(regional.notoriety)}
          tone="notoriety"
          uiId={UI_IDS.HUD_VITALS_NOTORIETY}
        />
      </div>
      <div className="biomes-ui-vitals-panel__footer">
        <div
          ref={goldHighlight.ref}
          className={`biomes-ui-vitals-chip ${highlightClassName(
            goldHighlight.blinking,
            goldHighlight.style
          )}`.trim()}
          data-tone="notoriety"
          data-ui-id={UI_IDS.HUD_VITALS_GOLD}
          data-ui-blinking={goldHighlight.blinking ? "true" : undefined}
          aria-label={`Gold ${gold}`}
        >
          <span className="biomes-ui-vitals-chip__label">
            <span className="biomes-ui-vitals-chip__label-text">Gold</span>
            <span
              className="biomes-ui-vitals-chip__icon biomes-ui-vitals-chip__icon--gold"
              aria-hidden
            >
              ●
            </span>
          </span>
          <span className="biomes-ui-vitals-chip__value biomes-ui-vitals-chip__value--desktop">
            {formatBiomesGoldForVitalsForTest(gold)}
          </span>
          <span className="biomes-ui-vitals-chip__value biomes-ui-vitals-chip__value--mobile">
            {Math.max(0, Math.floor(gold))}
          </span>
        </div>
        <div
          className="biomes-ui-vitals-chip"
          data-tone="level"
          aria-label={formatBiomesLevelForVitalsForTest(playerLevel)}
          title={levelProgress}
        >
          <span className="biomes-ui-vitals-chip__label">
            <span className="biomes-ui-vitals-chip__label-text">Level</span>
            <span
              className="biomes-ui-vitals-chip__icon biomes-ui-vitals-chip__icon--level"
              aria-hidden
            >
              ▲
            </span>
          </span>
          <span className="biomes-ui-vitals-chip__value biomes-ui-vitals-chip__value--desktop">
            {formatBiomesLevelForVitalsForTest(playerLevel)}
          </span>
          <span className="biomes-ui-vitals-chip__value biomes-ui-vitals-chip__value--mobile">
            {playerLevel}
          </span>
        </div>
      </div>
    </aside>
  );
};
