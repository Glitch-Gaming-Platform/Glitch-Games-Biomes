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
import { BiomesUITutorialCueBar } from "./tutorial/BiomesUITutorialCueBar";
import { BiomesUIVitalsPanel } from "./BiomesUIVitalsPanel";
import { HarthmereJobsBoardWorldInteractionV146 } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteractionV146";
import { HarthmereBusinessWorldInteractionV1 } from "@/client/components/harthmere_business/HarthmereBusinessWorldInteractionV1";
import type { TabKey } from "./BiomesUITypes";

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
  const replaceLegacy = useBiomesUIReplaceLegacyFlag();
  const replacementMode = forceEnabled || replaceLegacy;
  const [enabled, setEnabled] = useState<boolean>(() => false);
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const live = useBiomesUILiveAdapters({
    activeTab,
    onActiveTabChange: setActiveTab,
    replacementMode,
  });

  useEffect(() => {
    setEnabled(forceEnabled || isEnabled());
  }, [forceEnabled]);

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

  if (!forceEnabled && !enabled) return null;

  return (
    <>
      <BiomesUIVitalsPanel />
      <BiomesUI
        activeTab={activeTab}
        onActiveTabChange={live.onActiveTabChange}
        hotbar={live.hotbar}
        adapters={live.adapters}
      />
      <HarthmereJobsBoardWorldInteractionV146 />
      <HarthmereBusinessWorldInteractionV1
        suppressPrompt={activeTab !== null}
      />
      <BiomesUITutorialCueBar />
      <TutorialDirector step={live.tutorialStep} />
    </>
  );
};
