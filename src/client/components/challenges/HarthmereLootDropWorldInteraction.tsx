import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { harthmereJobsBoardPlayerPosition } from "@/client/components/harthmere_jobs_board/harthmereJobsBoardPosition";
import {
  HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT,
  HARTHMERE_INVENTORY_EVENT,
  HARTHMERE_LIVE_INVENTORY_SYNC_EVENT,
} from "@/client/components/challenges/harthmereEvents";
// HARTHMERE_LOOT_DROP_WORLD_STATE (audit fix, 2026-07-13): every refresh is
// published to the module store so the 3D marker renderer can draw the drops.
import { publishHarthmereWorldLootDrops } from "@/client/components/challenges/harthmereLootDropWorldState";
import type { HarthmereInventoryLootDrop } from "@/shared/harthmere/mmo_inventory_loot_authority";
import { hasNativeInspectableWorldTarget } from "@/client/components/challenges/worldInteractionPriority";
import {
  useWorldInteractionCandidate,
  WORLD_INTERACTION_PRIORITY,
} from "@/client/components/challenges/worldInteractionDispatcher";

export const HARTHMERE_LOOT_DROP_WORLD_INTERACTION_VERSION =
  "harthmere-loot-drop-world-interaction" as const;

// Keep the prompt inside the backend's authoritative five-block 3D claim
// radius. A wider/XZ-only prompt offered F through floors and then failed.
const HARTHMERE_LOOT_DROP_PROMPT_RADIUS = 5;
const HARTHMERE_LOOT_DROP_REFRESH_MS = 10_000;
const HARTHMERE_LOOT_FEEDBACK_VISIBLE_MS = 4500;
type HarthmereLootPoint = { x: number; y?: number; z: number };

function itemLabel(itemId: string): string {
  return itemId
    .replace(/^raw_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function lootDropLabel(drop: HarthmereInventoryLootDrop): string {
  const entries = Object.entries(drop.itemStacks ?? {}).filter(
    ([, count]) => Number(count) > 0
  );
  if (entries.length === 0) return "Loot";
  return entries
    .slice(0, 2)
    .map(([itemId, count]) => `${itemLabel(itemId)} x${count}`)
    .join(", ");
}

export function nearestAvailableHarthmereLootDrop(
  drops: readonly HarthmereInventoryLootDrop[],
  playerPosition: HarthmereLootPoint | undefined,
  nowMs: number,
  radius = HARTHMERE_LOOT_DROP_PROMPT_RADIUS
): (HarthmereInventoryLootDrop & { distance: number }) | undefined {
  if (!playerPosition) return undefined;
  let best: (HarthmereInventoryLootDrop & { distance: number }) | undefined;
  for (const drop of drops) {
    if (drop.status !== "available" || drop.expiresAtMs <= nowMs) continue;
    const position = drop.position;
    if (!position) continue;
    const distance = Math.hypot(
      position.x - playerPosition.x,
      Number.isFinite(position.y) && Number.isFinite(playerPosition.y)
        ? Number(position.y) - Number(playerPosition.y)
        : 0,
      position.z - playerPosition.z
    );
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { ...drop, distance };
    }
  }
  return best;
}

async function fetchAvailableLootDrops(): Promise<
  HarthmereInventoryLootDrop[]
> {
  const response = await defaultHarthmereLiveFetch(
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
  return Array.isArray(drops) ? (drops as HarthmereInventoryLootDrop[]) : [];
}

async function claimLootDrop(drop: HarthmereInventoryLootDrop) {
  const requestId = `harthmere_loot_salvage_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await defaultHarthmereLiveFetch("/api/harthmere/live_mode", {
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

function installHarthmereLootDropPromptStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("harthmere-loot-drop-prompt-styles")) return;
  const style = document.createElement("style");
  style.id = "harthmere-loot-drop-prompt-styles";
  style.textContent = [
    ".harthmere-loot-drop-prompt { position: fixed; left: 50%; bottom: 7.25rem; z-index: 55; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: .65rem; width: min(23rem, calc(100vw - 1.5rem)); transform: translateX(-50%); padding: .7rem .8rem; border: 1px solid rgba(244, 198, 106, .62); border-radius: 8px; background: linear-gradient(180deg, rgba(16, 25, 45, .94), rgba(8, 13, 25, .96)); color: #f6f1df; box-shadow: 0 0 0 1px rgba(255,255,255,.05), 0 12px 32px rgba(0,0,0,.45), 0 0 22px rgba(244,198,106,.20); pointer-events: auto; text-align: left; }",
    ".harthmere-loot-drop-prompt__key { display: inline-grid; place-items: center; width: 2.15rem; height: 2.15rem; border-radius: 7px; border: 1px solid rgba(244, 198, 106, .78); background: rgba(244, 198, 106, .14); color: #ffe8a6; font-weight: 900; font-size: 1rem; }",
    ".harthmere-loot-drop-prompt__body { display: grid; gap: .12rem; min-width: 0; }",
    ".harthmere-loot-drop-prompt__verb { color: #ffe8a6; font-size: .67rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }",
    ".harthmere-loot-drop-prompt strong { min-width: 0; overflow-wrap: anywhere; font-size: .92rem; line-height: 1.15; }",
    ".harthmere-loot-drop-prompt small { color: rgba(246, 241, 223, .72); font-size: .72rem; line-height: 1.2; }",
    ".harthmere-loot-drop-prompt[data-feedback='success'] { border-color: rgba(111, 238, 167, .75); box-shadow: 0 12px 32px rgba(0,0,0,.45), 0 0 24px rgba(111,238,167,.20); }",
    ".harthmere-loot-drop-prompt[data-feedback='error'] { border-color: rgba(255, 133, 126, .75); box-shadow: 0 12px 32px rgba(0,0,0,.45), 0 0 24px rgba(255,133,126,.18); }",
  ].join("\n");
  document.head.appendChild(style);
}

function lootClaimErrorLabel(message: string) {
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

export function HarthmereLootDropWorldInteraction({
  suppressPrompt = false,
}: {
  suppressPrompt?: boolean;
} = {}) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;
  const overlays = reactResources.use("/overlays");
  const playerPosition = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const [drops, setDrops] = React.useState<HarthmereInventoryLootDrop[]>([]);
  const [feedback, setFeedback] = React.useState<
    { message: string; ok: boolean } | undefined
  >();
  const [claimingDropId, setClaimingDropId] = React.useState<string>();
  const feedbackTimer = React.useRef<ReturnType<typeof setTimeout>>();

  const refreshDrops = React.useCallback(async () => {
    const nextDrops = await fetchAvailableLootDrops();
    setDrops(nextDrops);
    publishHarthmereWorldLootDrops(nextDrops);
  }, []);

  React.useEffect(() => {
    installHarthmereLootDropPromptStyles();
    if (typeof window === "undefined") return;
    let cancelled = false;
    const refresh = async () => {
      const nextDrops = await fetchAvailableLootDrops();
      if (!cancelled) {
        setDrops(nextDrops);
        publishHarthmereWorldLootDrops(nextDrops);
      }
    };
    void refresh();
    let refreshTimer: number | undefined;
    const refreshSoon = () => {
      if (refreshTimer !== undefined) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        void refresh();
      }, 350);
    };
    const interval = window.setInterval(
      () => void refresh(),
      HARTHMERE_LOOT_DROP_REFRESH_MS
    );
    const eventRefresh = () => refreshSoon();
    const inventoryLootEventRefresh = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail ?? {};
      const nextDrops =
        detail.inventoryLootState?.availableLootDrops ??
        detail.body?.inventoryLootState?.availableLootDrops;
      if (Array.isArray(nextDrops)) {
        setDrops(nextDrops as HarthmereInventoryLootDrop[]);
        return;
      }
      void refresh();
    };
    window.addEventListener(HARTHMERE_INVENTORY_EVENT, eventRefresh);
    window.addEventListener("biomes:harthmere-combat-changed", eventRefresh);
    window.addEventListener(
      "biomes:harthmere-multiplayer-combat-changed",
      eventRefresh
    );
    window.addEventListener(
      HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT,
      inventoryLootEventRefresh
    );
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
      window.removeEventListener(HARTHMERE_INVENTORY_EVENT, eventRefresh);
      window.removeEventListener(
        "biomes:harthmere-combat-changed",
        eventRefresh
      );
      window.removeEventListener(
        "biomes:harthmere-multiplayer-combat-changed",
        eventRefresh
      );
      window.removeEventListener(
        HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT,
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
      HARTHMERE_LOOT_FEEDBACK_VISIBLE_MS
    );
  }, []);

  const activeDrop = React.useMemo(
    () => nearestAvailableHarthmereLootDrop(drops, playerPosition, Date.now()),
    [drops, playerPosition?.x, playerPosition?.y, playerPosition?.z]
  );
  const promptBlocked =
    suppressPrompt || hasNativeInspectableWorldTarget(overlays);

  const salvage = React.useCallback(async () => {
    if (!activeDrop || claimingDropId) return;
    setClaimingDropId(activeDrop.dropId);
    try {
      const body = await claimLootDrop(activeDrop);
      showFeedback(`Salvaged ${lootDropLabel(activeDrop)}.`, true);
      await refreshDrops();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(HARTHMERE_INVENTORY_EVENT));
        window.dispatchEvent(
          new CustomEvent(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT, {
            detail: { body },
          })
        );
      }
    } catch (error) {
      showFeedback(
        lootClaimErrorLabel(
          error instanceof Error ? error.message : String(error ?? "")
        ),
        false
      );
    } finally {
      setClaimingDropId(undefined);
    }
  }, [activeDrop, claimingDropId, refreshDrops, showFeedback]);

  const worldCandidate = React.useMemo(
    () =>
      activeDrop && !promptBlocked
        ? {
            id: `harthmere:loot:${activeDrop.dropId}`,
            priority:
              WORLD_INTERACTION_PRIORITY.authoredLoot - activeDrop.distance,
            disabled: Boolean(claimingDropId),
            onInteract: salvage,
          }
        : undefined,
    [activeDrop, claimingDropId, promptBlocked, salvage]
  );
  const ownsInteraction = useWorldInteractionCandidate(worldCandidate);

  if (!activeDrop || promptBlocked || !ownsInteraction) return null;

  const feedbackState = feedback ? (feedback.ok ? "success" : "error") : "";
  const distance = `${Math.max(0, activeDrop.distance).toFixed(1)}m`;
  return (
    <button
      type="button"
      className="harthmere-loot-drop-prompt"
      data-feedback={feedbackState}
      data-harthmere-loot-drop-world-prompt="active"
      data-testid="harthmere-loot-drop-world-prompt"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        void salvage();
      }}
      aria-label={`Salvage ${lootDropLabel(activeDrop)}`}
    >
      <span className="harthmere-loot-drop-prompt__key" aria-hidden="true">
        F
      </span>
      <span className="harthmere-loot-drop-prompt__body">
        <span className="harthmere-loot-drop-prompt__verb">Salvage</span>
        <strong>{lootDropLabel(activeDrop)}</strong>
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
