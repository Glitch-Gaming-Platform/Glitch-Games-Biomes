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
import React from "react";
import {
  biomesUIVitalsDisplayFromLiveStatusForTest,
  useBiomesUIPlayerStatusState,
} from "./adapters/playerStatusAdapter";
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
  const safeValue = displayBiomesVitalsBarValueForTest(rawValue);
  const safeMax = Math.max(1, Math.round(Number(max) || 1));
  const width = percent(rawValue, safeMax);

  return (
    <div
      ref={highlight.ref}
      className={`biomes-ui-vitals-bar ${highlightClassName(
        highlight.blinking,
        highlight.style
      )}`.trim()}
      data-ui-id={uiId}
      data-ui-blinking={highlight.blinking ? "true" : undefined}
    >
      <div className="biomes-ui-vitals-bar__meta">
        <span>{label}</span>
        <span className="biomes-ui-vitals-bar__value">
          {safeValue}/{safeMax}
        </span>
      </div>
      <div
        className="biomes-ui-vitals-bar__track"
        aria-label={`${label} ${safeValue} of ${safeMax}`}
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
      <span className="biomes-ui-vitals-chip__label">{label}</span>
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
  const combat = useHarthmereCombatState();
  const multiplayer = useHarthmereMultiplayerCombatState();
  const stamina = useHarthmereFoodStaminaState();
  const reputation = useHarthmereReputationState();
  const leveling = useHarthmereLevelingState();
  const liveStatus = useBiomesUIPlayerStatusState();

  const player = combat.player;
  const title = getHarthmereCombinedPublicTitle(reputation);
  const gold = useLiveModeGoldBalance();
  const display = biomesUIVitalsDisplayFromLiveStatusForTest(liveStatus, {
    hp: player.hp,
    maxHp: player.maxHp,
    combatState: player.combatState,
    resourceLabel: "Mana",
    resourceValue: multiplayer.mana,
    resourceMax: multiplayer.maxMana,
    standing: reputation.regions.harthmere,
    gold,
  });
  // BiomesUI is the only active vitals surface. The data can arrive from the
  // server or the local-dev ECS bridge, but it must pass through the BiomesUI
  // player-status adapter so the panel never has competing health authorities.
  const healthHp = Math.max(0, Math.round(display.hp));
  const healthMaxHp = Math.max(1, Math.round(display.maxHp));
  const healthCombatState = display.combatState;
  // Mana & Stamina, like Health, read their LOCAL real-time systems as the
  // source of truth — the multiplayer-combat mana pool and the food-stamina
  // system — NOT the 5-15s-polled backend status. Both of those local systems
  // tick/consume during gameplay (casting drains mana; sprinting/hunger drains
  // stamina; eating restores it) and handle their own death/respawn, so binding
  // to them keeps all three vitals real-time and mutually consistent instead of
  // snapping back to a stale backend snapshot.
  const manaValue = Math.max(0, Math.round(multiplayer.mana));
  const manaMax = Math.max(1, Math.round(multiplayer.maxMana));
  const staminaValue = Math.max(0, Math.round(stamina.stamina));
  const staminaMax = Math.max(1, Math.round(stamina.maxStamina));
  const regional = display.standing ?? reputation.regions.harthmere;
  // Level / XP come from the LOCAL leveling system (the source of truth where
  // quests, gathering, building, and combat actually award XP via
  // awardHarthmereXp) — not the 5-15s-polled backend status, which doesn't see
  // those local awards and would otherwise show "Level 1" until the next poll.
  const playerLevel = Math.max(1, Math.floor(leveling.level));
  const xpCurrent = Math.max(0, Math.floor(leveling.xpCurrent));
  const xpNext = Math.max(
    1,
    Math.floor(xpRequiredForNextHarthmereLevel(playerLevel))
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
      className={`biomes-ui-vitals-panel ${highlightClassName(
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
          aria-label={`Gold ${display.gold ?? gold}`}
        >
          <span className="biomes-ui-vitals-chip__label">Gold</span>
          <span className="biomes-ui-vitals-chip__value">
            {formatBiomesGoldForVitalsForTest(display.gold ?? gold)}
          </span>
        </div>
        <div
          className="biomes-ui-vitals-chip"
          data-tone="level"
          aria-label={formatBiomesLevelForVitalsForTest(playerLevel)}
          title={levelProgress}
        >
          <span className="biomes-ui-vitals-chip__label">Level</span>
          <span className="biomes-ui-vitals-chip__value">
            {formatBiomesLevelForVitalsForTest(playerLevel)}
          </span>
        </div>
      </div>
    </aside>
  );
};
