import {
  useHarthmereCombatState,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  useHarthmereMultiplayerCombatState,
} from "@/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem";
import {
  useHarthmereFoodStaminaState,
} from "@/client/components/challenges/LocalDevHarthmereFoodStaminaSystem";
import {
  getHarthmereCombinedPublicTitle,
  useHarthmereReputationState,
} from "@/client/components/challenges/LocalDevHarthmereReputation";
import { BIOMES_GAME_NAME } from "@/shared/biomes/display_names";
import React from "react";
import {
  biomesUIVitalsCombatResourceDisplayForTest,
  biomesUIVitalsDisplayFromLiveStatusForTest,
  useBiomesUIPlayerStatusStateV1,
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
      className={`biomes-ui-vitals-bar ${highlightClassName(highlight.blinking, highlight.style)}`.trim()}
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
      className={`biomes-ui-vitals-chip ${highlightClassName(highlight.blinking, highlight.style)}`.trim()}
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

function useLiveModeGoldBalance(): number {
  const [gold, setGold] = React.useState(0);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const readGold = async () => {
      try {
        const response = await fetch("/api/harthmere/live_mode_inventory_loot_state", {
          method: "GET",
          credentials: "same-origin",
        });
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
      const nextGold = Number((event as CustomEvent<{ gold?: number }>).detail?.gold);
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
  const liveStatus = useBiomesUIPlayerStatusStateV1();

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
  const combatResource = biomesUIVitalsCombatResourceDisplayForTest(
    liveStatus,
    {
      resourceLabel: display.resourceLabel,
      resourceValue: display.resourceValue,
      resourceMax: display.resourceMax,
    }
  );
  const liveStaminaValue = Number(liveStatus?.combat?.resources?.stamina);
  const liveMaxStaminaValue = Number(liveStatus?.combat?.maxResources?.stamina);
  const staminaValue = Number.isFinite(liveStaminaValue)
    ? Math.max(0, liveStaminaValue)
    : stamina.stamina;
  const staminaMax = Number.isFinite(liveMaxStaminaValue) && liveMaxStaminaValue > 0
    ? Math.max(1, liveMaxStaminaValue)
    : stamina.maxStamina;
  const regional = display.standing ?? reputation.regions.harthmere;
  const headerTitle = display.classLine ?? title;
  const panelHighlight = useBlinkTarget<HTMLElement>(UI_IDS.HUD_VITALS);
  const goldHighlight = useBlinkTarget<HTMLDivElement>(UI_IDS.HUD_VITALS_GOLD);
  const levelProgress =
    display.xpCurrent !== undefined && display.xpNext !== undefined
      ? `${display.xpCurrent}/${display.xpNext} xp`
      : undefined;

  return (
    <aside
      ref={panelHighlight.ref}
      className={`biomes-ui-vitals-panel ${highlightClassName(panelHighlight.blinking, panelHighlight.style)}`.trim()}
      data-ui-id={UI_IDS.HUD_VITALS}
      data-ui-blinking={panelHighlight.blinking ? "true" : undefined}
      aria-label="Player vitals and reputation"
    >
      <div className="biomes-ui-vitals-panel__header">
        <div className="biomes-ui-vitals-panel__identity">
          <span className="biomes-ui-vitals-panel__game">{BIOMES_GAME_NAME}</span>
          <span
            className="biomes-ui-vitals-panel__title"
            title={levelProgress ? `${headerTitle} · ${levelProgress}` : headerTitle}
          >
            {headerTitle}
          </span>
        </div>
        <span className="biomes-ui-vitals-panel__state">
          {formatStateLabel(display.combatState)}
        </span>
      </div>

      <div className="biomes-ui-vitals-panel__bars">
        <VitalsBar
          label="Health"
          value={display.hp}
          max={display.maxHp}
          tone="health"
          uiId={UI_IDS.HUD_VITALS_HEALTH}
        />
        <VitalsBar
          label={combatResource.resourceLabel}
          value={combatResource.resourceValue}
          max={combatResource.resourceMax}
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
      <div
        ref={goldHighlight.ref}
        className={`biomes-ui-vitals-chip ${highlightClassName(goldHighlight.blinking, goldHighlight.style)}`.trim()}
        data-tone="notoriety"
        data-ui-id={UI_IDS.HUD_VITALS_GOLD}
        data-ui-blinking={goldHighlight.blinking ? "true" : undefined}
        aria-label={`Gold ${display.gold ?? gold}`}
        style={{ marginTop: 8 }}
      >
        <span className="biomes-ui-vitals-chip__label">Gold</span>
        <span className="biomes-ui-vitals-chip__value">
          {formatBiomesGoldForVitalsForTest(display.gold ?? gold)}
        </span>
      </div>
    </aside>
  );
};
