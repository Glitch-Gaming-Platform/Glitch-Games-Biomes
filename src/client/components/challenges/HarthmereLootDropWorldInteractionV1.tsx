import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { defaultHarthmereLiveFetchV1 } from "@/client/components/harthmere_live_fetch";
import { harthmereJobsBoardPlayerPositionV146 } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteractionV146";
import type { HarthmereInventoryLootDropV1 } from "@/shared/harthmere/mmo_inventory_loot_authority_v1";

export const HARTHMERE_LOOT_DROP_WORLD_INTERACTION_VERSION_V1 =
  "harthmere-loot-drop-world-interaction-v1" as const;

const HARTHMERE_LOOT_DROP_PROMPT_RADIUS_V1 = 7.5;
const HARTHMERE_LOOT_DROP_REFRESH_MS_V1 = 10_000;
const HARTHMERE_LOOT_FEEDBACK_VISIBLE_MS_V1 = 4500;
const HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT_V1 =
  "biomes:harthmere-business-inventory-loot-updated-v1";

type HarthmereLootPointV1 = { x: number; y?: number; z: number };

function eventStartedInEditableV1(event: Event): boolean {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target?.isContentEditable)
  );
}

function itemLabelV1(itemId: string): string {
  return itemId
    .replace(/^raw_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function lootDropLabelV1(drop: HarthmereInventoryLootDropV1): string {
  const entries = Object.entries(drop.itemStacks ?? {}).filter(
    ([, count]) => Number(count) > 0
  );
  if (entries.length === 0) return "Loot";
  return entries
    .slice(0, 2)
    .map(([itemId, count]) => `${itemLabelV1(itemId)} x${count}`)
    .join(", ");
}

export function nearestAvailableHarthmereLootDropV1(
  drops: readonly HarthmereInventoryLootDropV1[],
  playerPosition: HarthmereLootPointV1 | undefined,
  nowMs: number,
  radius = HARTHMERE_LOOT_DROP_PROMPT_RADIUS_V1
): (HarthmereInventoryLootDropV1 & { distance: number }) | undefined {
  if (!playerPosition) return undefined;
  let best: (HarthmereInventoryLootDropV1 & { distance: number }) | undefined;
  for (const drop of drops) {
    if (drop.status !== "available" || drop.expiresAtMs <= nowMs) continue;
    const position = drop.position;
    if (!position) continue;
    const distance = Math.hypot(
      position.x - playerPosition.x,
      position.z - playerPosition.z
    );
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { ...drop, distance };
    }
  }
  return best;
}

async function fetchAvailableLootDropsV1(): Promise<
  HarthmereInventoryLootDropV1[]
> {
  const response = await defaultHarthmereLiveFetchV1(
    "/api/harthmere/live_mode_inventory_loot_state",
    {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }
  );
  if (!response.ok) return [];
  const body = await response.json();
  const drops = body?.inventoryLootState?.availableLootDrops;
  return Array.isArray(drops) ? (drops as HarthmereInventoryLootDropV1[]) : [];
}

async function claimLootDropV1(drop: HarthmereInventoryLootDropV1) {
  const requestId = `harthmere_loot_salvage_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await defaultHarthmereLiveFetchV1("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_loot_claim",
      subsystem: "loot",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload: {
        dropId: drop.dropId,
        pickupToken: drop.pickupToken,
      },
      clientClaims: {},
    }),
  });
  const body = await response.json().catch(() => ({}));
  const warnings = [
    ...(Array.isArray(body?.backendMutation?.warnings)
      ? body.backendMutation.warnings
      : []),
    ...(Array.isArray(body?.warnings) ? body.warnings : []),
  ].map(String);
  const rejection = warnings.find(
    (warning) =>
      warning.includes("_rejected:") || warning.includes("carry_weight")
  );
  if (!response.ok || body?.ok === false || rejection) {
    throw new Error(rejection ?? "loot_claim_failed");
  }
  return body;
}

function installHarthmereLootDropPromptStylesV1() {
  if (typeof document === "undefined") return;
  if (document.getElementById("harthmere-loot-drop-prompt-styles-v1")) return;
  const style = document.createElement("style");
  style.id = "harthmere-loot-drop-prompt-styles-v1";
  style.textContent = [
    ".harthmere-loot-drop-prompt-v1 { position: fixed; left: 50%; bottom: 7.25rem; z-index: 55; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: .65rem; width: min(23rem, calc(100vw - 1.5rem)); transform: translateX(-50%); padding: .7rem .8rem; border: 1px solid rgba(244, 198, 106, .62); border-radius: 8px; background: linear-gradient(180deg, rgba(16, 25, 45, .94), rgba(8, 13, 25, .96)); color: #f6f1df; box-shadow: 0 0 0 1px rgba(255,255,255,.05), 0 12px 32px rgba(0,0,0,.45), 0 0 22px rgba(244,198,106,.20); pointer-events: auto; text-align: left; }",
    ".harthmere-loot-drop-prompt-v1__key { display: inline-grid; place-items: center; width: 2.15rem; height: 2.15rem; border-radius: 7px; border: 1px solid rgba(244, 198, 106, .78); background: rgba(244, 198, 106, .14); color: #ffe8a6; font-weight: 900; font-size: 1rem; }",
    ".harthmere-loot-drop-prompt-v1__body { display: grid; gap: .12rem; min-width: 0; }",
    ".harthmere-loot-drop-prompt-v1__verb { color: #ffe8a6; font-size: .67rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }",
    ".harthmere-loot-drop-prompt-v1 strong { min-width: 0; overflow-wrap: anywhere; font-size: .92rem; line-height: 1.15; }",
    ".harthmere-loot-drop-prompt-v1 small { color: rgba(246, 241, 223, .72); font-size: .72rem; line-height: 1.2; }",
    ".harthmere-loot-drop-prompt-v1[data-feedback='success'] { border-color: rgba(111, 238, 167, .75); box-shadow: 0 12px 32px rgba(0,0,0,.45), 0 0 24px rgba(111,238,167,.20); }",
    ".harthmere-loot-drop-prompt-v1[data-feedback='error'] { border-color: rgba(255, 133, 126, .75); box-shadow: 0 12px 32px rgba(0,0,0,.45), 0 0 24px rgba(255,133,126,.18); }",
  ].join("\n");
  document.head.appendChild(style);
}

function lootClaimErrorLabelV1(message: string) {
  if (message.includes("carry_weight")) {
    return "Too much carried weight to salvage this.";
  }
  if (message.includes("invalid_pickup_token")) {
    return "That loot marker expired. Step away and back.";
  }
  if (message.includes("unknown_drop_id")) {
    return "That loot is gone.";
  }
  return "Could not salvage this loot.";
}

export function HarthmereLootDropWorldInteractionV1({
  suppressPrompt = false,
}: {
  suppressPrompt?: boolean;
} = {}) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;
  const playerPosition = harthmereJobsBoardPlayerPositionV146(
    localPlayer,
    camera
  );
  const [drops, setDrops] = React.useState<HarthmereInventoryLootDropV1[]>([]);
  const [feedback, setFeedback] = React.useState<
    { message: string; ok: boolean } | undefined
  >();
  const [claimingDropId, setClaimingDropId] = React.useState<string>();
  const feedbackTimer = React.useRef<ReturnType<typeof setTimeout>>();

  const refreshDrops = React.useCallback(async () => {
    const nextDrops = await fetchAvailableLootDropsV1();
    setDrops(nextDrops);
  }, []);

  React.useEffect(() => {
    installHarthmereLootDropPromptStylesV1();
    if (typeof window === "undefined") return;
    let cancelled = false;
    const refresh = async () => {
      const nextDrops = await fetchAvailableLootDropsV1();
      if (!cancelled) setDrops(nextDrops);
    };
    void refresh();
    let refreshTimer: ReturnType<typeof window.setTimeout> | undefined;
    const refreshSoon = () => {
      if (refreshTimer !== undefined) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        void refresh();
      }, 350);
    };
    const interval = window.setInterval(
      () => void refresh(),
      HARTHMERE_LOOT_DROP_REFRESH_MS_V1
    );
    const eventRefresh = () => refreshSoon();
    const inventoryLootEventRefresh = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail ?? {};
      const nextDrops =
        detail.inventoryLootState?.availableLootDrops ??
        detail.body?.inventoryLootState?.availableLootDrops;
      if (Array.isArray(nextDrops)) {
        setDrops(nextDrops as HarthmereInventoryLootDropV1[]);
        return;
      }
      void refresh();
    };
    window.addEventListener("biomes:harthmere-inventory-changed", eventRefresh);
    window.addEventListener("biomes:harthmere-combat-changed", eventRefresh);
    window.addEventListener(
      "biomes:harthmere-multiplayer-combat-changed",
      eventRefresh
    );
    window.addEventListener(
      HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT_V1,
      inventoryLootEventRefresh
    );
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
      window.removeEventListener(
        "biomes:harthmere-inventory-changed",
        eventRefresh
      );
      window.removeEventListener(
        "biomes:harthmere-combat-changed",
        eventRefresh
      );
      window.removeEventListener(
        "biomes:harthmere-multiplayer-combat-changed",
        eventRefresh
      );
      window.removeEventListener(
        HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT_V1,
        inventoryLootEventRefresh
      );
    };
  }, []);

  React.useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const showFeedback = React.useCallback((message: string, ok: boolean) => {
    setFeedback({ message, ok });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(
      () => setFeedback(undefined),
      HARTHMERE_LOOT_FEEDBACK_VISIBLE_MS_V1
    );
  }, []);

  const activeDrop = nearestAvailableHarthmereLootDropV1(
    drops,
    playerPosition,
    Date.now()
  );

  const salvage = React.useCallback(async () => {
    if (!activeDrop || claimingDropId) return;
    setClaimingDropId(activeDrop.dropId);
    try {
      await claimLootDropV1(activeDrop);
      showFeedback(`Salvaged ${lootDropLabelV1(activeDrop)}.`, true);
      await refreshDrops();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("biomes:harthmere-inventory-changed"));
      }
    } catch (error) {
      showFeedback(
        lootClaimErrorLabelV1(
          error instanceof Error ? error.message : String(error ?? "")
        ),
        false
      );
    } finally {
      setClaimingDropId(undefined);
    }
  }, [activeDrop, claimingDropId, refreshDrops, showFeedback]);

  React.useEffect(() => {
    if (!activeDrop || suppressPrompt || typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        eventStartedInEditableV1(event)
      ) {
        return;
      }
      if (event.code === "KeyF") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void salvage();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [activeDrop, salvage, suppressPrompt]);

  if (!activeDrop || suppressPrompt) return null;

  const feedbackState = feedback ? (feedback.ok ? "success" : "error") : "";
  const distance = `${Math.max(0, activeDrop.distance).toFixed(1)}m`;
  return (
    <button
      type="button"
      className="harthmere-loot-drop-prompt-v1"
      data-feedback={feedbackState}
      data-harthmere-loot-drop-world-prompt-v1="active"
      data-testid="harthmere-loot-drop-world-prompt-v1"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        void salvage();
      }}
      aria-label={`Salvage ${lootDropLabelV1(activeDrop)}`}
    >
      <span className="harthmere-loot-drop-prompt-v1__key" aria-hidden="true">
        F
      </span>
      <span className="harthmere-loot-drop-prompt-v1__body">
        <span className="harthmere-loot-drop-prompt-v1__verb">Salvage</span>
        <strong>{lootDropLabelV1(activeDrop)}</strong>
        <small>
          {feedback
            ? feedback.message
            : claimingDropId === activeDrop.dropId
            ? "Salvaging..."
            : `Loot marker nearby · ${distance}`}
        </small>
      </span>
    </button>
  );
}
