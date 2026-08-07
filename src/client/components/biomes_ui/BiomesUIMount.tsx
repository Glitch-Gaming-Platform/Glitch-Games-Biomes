// BiomesUIMount — zero-prop wrapper for the replacement Biomes UI.
//
// This is no longer a placeholder-only shell. It reads the live client
// inventory/hotbar resources, maps legacy game-modal shortcuts into BiomesUI
// tabs during replacement mode, and feeds live Grove tutorial state into the
// TutorialDirector when that runtime is present.

import * as React from "react";
import { useEffect, useState } from "react";
import { BiomesUI } from "./BiomesUI";
import { useBiomesUIReplaceLegacyFlag } from "./BiomesUIFlags";
import { useBiomesUILiveAdapters } from "./adapters/useBiomesUILiveAdapters";
import { TutorialDirector } from "./tutorial/TutorialDirector";
import { BiomesUIVitalsPanel } from "./BiomesUIVitalsPanel";
import { HarthmereLevelUpCelebration } from "./HarthmereLevelUpCelebration";
import { HarthmereQuestCompletionCelebration } from "./HarthmereQuestCompletionCelebration";
import { HarthmereJobsBoardWorldInteraction } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteraction";
import { HarthmereRequestBoardWorldInteraction } from "@/client/components/harthmere_request_board/HarthmereRequestBoardWorldInteraction";
import { HarthmereWantedBoardWorldInteraction } from "@/client/components/harthmere_wanted_board/HarthmereWantedBoardWorldInteraction";
import { HarthmerePropertyForSaleWorldInteraction } from "@/client/components/harthmere_building/HarthmerePropertyForSaleWorldInteraction";
import { HarthmereGatheringNodeWorldInteraction } from "@/client/components/challenges/HarthmereGatheringNodeWorldInteraction";
import { HarthmereObjectContainerPanel } from "@/client/components/challenges/HarthmereObjectContainerPanel";
import { HarthmereCookingStationPanel } from "@/client/components/harthmere_cooking/HarthmereCookingStationPanel";
import { HarthmereProjectileVisualAuditPanel } from "@/client/components/challenges/HarthmereProjectileVisualAuditPanel";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { BIOMES_UI_LOCATE_ON_MAP_EVENT } from "./adapters/mapPinnedDestination";
import { useBiomesHUDVisibilitySnapshot } from "./hudVisibilitySettings";
import type { TabKey } from "./BiomesUITypes";
import { useBiomesUINonGameplayScreenVisible } from "./BiomesUIOpenPrompt";
import { setHarthmereBiomesUiOpen } from "@/client/game/util/harthmere_combat_presentation";

function truthy(value: string | undefined | null): boolean {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function falsy(value: string | undefined | null): boolean {
  return ["0", "false", "no", "off"].includes(
    String(value ?? "").toLowerCase()
  );
}

function isEnabled(): boolean {
  // Build-time flags. NEXT_PUBLIC is the browser-safe one for Next.js; the
  // non-prefixed name remains supported for local server-side/dev workflows.
  if (typeof process !== "undefined") {
    if (truthy(process.env.NEXT_PUBLIC_BIOMES_UI_ENABLED)) return true;
    if (falsy(process.env.NEXT_PUBLIC_BIOMES_UI_ENABLED)) return false;
    if (truthy(process.env.BIOMES_UI_ENABLED)) return true;
    if (falsy(process.env.BIOMES_UI_ENABLED)) return false;
  }

  // Runtime flag.
  if (typeof window !== "undefined") {
    const ls = window.localStorage?.getItem("biomes_ui_enabled");
    if (truthy(ls)) return true;
    if (falsy(ls)) return false;
  }

  // Default: on outside production, off in production.
  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production"
  ) {
    return true;
  }
  return false;
}

export const BiomesUIMount: React.FunctionComponent<{
  forceEnabled?: boolean;
}> = ({ forceEnabled = false }) => {
  const { clientConfig, reactResources } = useClientContext();
  const replaceLegacy = useBiomesUIReplaceLegacyFlag();
  const nonGameplayScreenVisible = useBiomesUINonGameplayScreenVisible();
  const replacementMode = forceEnabled || replaceLegacy;
  const [enabled, setEnabled] = useState<boolean>(() => false);
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const hudVisibility = useBiomesHUDVisibilitySnapshot();
  const live = useBiomesUILiveAdapters({
    activeTab,
    onActiveTabChange: setActiveTab,
    replacementMode,
  });

  useEffect(() => {
    setEnabled(forceEnabled || isEnabled());
  }, [forceEnabled]);

  useEffect(() => {
    setHarthmereBiomesUiOpen(activeTab !== null);
  }, [activeTab]);

  useEffect(() => () => setHarthmereBiomesUiOpen(false), []);

  // "Locate on map": when any panel fires the locate request, open the Map tab.
  // The Map tab itself centers on the pin (it reads the recent active pin on
  // mount, since this tab switch happens after the event fired).
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    function onLocate() {
      // The Recipes screen intentionally remains a native game modal. Close it
      // before opening the replacement Map tab; otherwise the live-adapter
      // modal reconciliation sees Recipes still active and immediately closes
      // the requested Map tab again. Keep pointer lock released for the map.
      if (reactResources.get("/game_modal").kind !== "empty") {
        reactResources.set("/game_modal", {
          kind: "empty",
          returnPointerLock: false,
        });
      }
      setActiveTab("map");
    }
    window.addEventListener(BIOMES_UI_LOCATE_ON_MAP_EVENT, onLocate);
    return () =>
      window.removeEventListener(BIOMES_UI_LOCATE_ON_MAP_EVENT, onLocate);
  }, [reactResources]);

  // Allow toggling at runtime via key combo: Shift+Alt+B.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.shiftKey && e.altKey && e.code === "KeyB") {
        e.preventDefault();
        setEnabled((v) => {
          const next = !v;
          try {
            window.localStorage.setItem("biomes_ui_enabled", next ? "1" : "0");
          } catch {}
          // eslint-disable-next-line no-console
          console.log(
            `[BiomesUI] ${next ? "enabled" : "disabled"} via Shift+Alt+B`
          );
          return next;
        });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const projectileVisualAudit = <HarthmereProjectileVisualAuditPanel />;

  if (!forceEnabled && !enabled) return projectileVisualAudit;
  if (clientConfig.mobileDevice && nonGameplayScreenVisible) {
    return projectileVisualAudit;
  }

  return (
    <>
      {projectileVisualAudit}
      {hudVisibility.vitals && <BiomesUIVitalsPanel />}
      <HarthmereLevelUpCelebration />
      <HarthmereQuestCompletionCelebration />
      <BiomesUI
        activeTab={activeTab}
        onActiveTabChange={live.onActiveTabChange}
        hotbar={live.hotbar}
        adapters={live.adapters}
        shortcutOverrides={live.shortcuts}
      />
      <HarthmereJobsBoardWorldInteraction suppressPrompt={activeTab !== null} />
      <HarthmereRequestBoardWorldInteraction
        suppressPrompt={activeTab !== null}
      />
      <HarthmereWantedBoardWorldInteraction
        suppressPrompt={activeTab !== null}
      />
      <HarthmerePropertyForSaleWorldInteraction
        suppressPrompt={activeTab !== null}
      />
      <HarthmereGatheringNodeWorldInteraction
        suppressPrompt={activeTab !== null}
      />
      <HarthmereObjectContainerPanel />
      <HarthmereCookingStationPanel />
      <TutorialDirector step={live.tutorialStep} />
    </>
  );
};
