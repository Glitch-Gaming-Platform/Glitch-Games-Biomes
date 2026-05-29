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
  const safeValue = Math.max(0, Math.round(Number(value) || 0));
  const safeMax = Math.max(1, Math.round(Number(max) || 1));
  const width = percent(safeValue, safeMax);

  return (
    <div className="biomes-ui-vitals-bar" data-ui-id={uiId}>
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
  return (
    <div className="biomes-ui-vitals-chip" data-tone={tone} data-ui-id={uiId}>
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

  const player = combat.player;
  const regional = reputation.regions.harthmere;
  const title = getHarthmereCombinedPublicTitle(reputation);
  const gold = useLiveModeGoldBalance();

  return (
    <aside
      className="biomes-ui-vitals-panel"
      data-ui-id={UI_IDS.HUD_VITALS}
      aria-label="Player vitals and reputation"
    >
      <div className="biomes-ui-vitals-panel__header">
        <div className="biomes-ui-vitals-panel__identity">
          <span className="biomes-ui-vitals-panel__game">{BIOMES_GAME_NAME}</span>
          <span className="biomes-ui-vitals-panel__title" title={title}>
            {title}
          </span>
        </div>
        <span className="biomes-ui-vitals-panel__state">
          {formatStateLabel(player.combatState)}
        </span>
      </div>

      <div className="biomes-ui-vitals-panel__bars">
        <VitalsBar
          label="Health"
          value={player.hp}
          max={player.maxHp}
          tone="health"
          uiId={UI_IDS.HUD_VITALS_HEALTH}
        />
        <VitalsBar
          label="Mana"
          value={multiplayer.mana}
          max={multiplayer.maxMana}
          tone="mana"
          uiId={UI_IDS.HUD_VITALS_MANA}
        />
        <VitalsBar
          label="Stamina"
          value={stamina.stamina}
          max={stamina.maxStamina}
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
        className="biomes-ui-vitals-chip"
        data-tone="notoriety"
        data-ui-id={UI_IDS.HUD_VITALS_GOLD}
        aria-label={`Gold ${gold}`}
        style={{ marginTop: 8 }}
      >
        <span className="biomes-ui-vitals-chip__label">Gold</span>
        <span className="biomes-ui-vitals-chip__value">
          {formatBiomesGoldForVitalsForTest(gold)}
        </span>
      </div>
    </aside>
  );
};
