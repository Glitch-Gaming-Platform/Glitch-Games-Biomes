// BiomesUIMount — a zero-prop self-contained wrapper that mounts the
// new BiomesUI. Pulls hotbar state from a small internal store so the
// UI is fully functional even before adapters are wired to the real
// Harthmere systems.
//
// Drop <BiomesUIMount /> anywhere in the HUD and you'll see the new UI.
// Hide it again by removing the mount. Both this file and BiomesUI
// itself are additive — nothing in the existing HUD is removed.
//
// Feature flag: set `BIOMES_UI_ENABLED=true` in the shell environment, or
// at runtime in dev tools:  localStorage.setItem("biomes_ui_enabled","1")
// then reload. Defaults to ON in development, OFF in production unless
// the flag is set.

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { BiomesUI } from "./BiomesUI";
import { TutorialDirector } from "./tutorial/TutorialDirector";
import type { TabKey } from "./BiomesUITypes";
import type { HotbarSlotItem } from "./hotbar/BiomesHotbar";

function isEnabled(): boolean {
  // Build-time
  if (typeof process !== "undefined" && process.env?.BIOMES_UI_ENABLED) {
    return process.env.BIOMES_UI_ENABLED !== "false";
  }
  // Runtime
  if (typeof window !== "undefined") {
    const ls = window.localStorage?.getItem("biomes_ui_enabled");
    if (ls === "1" || ls === "true") return true;
    if (ls === "0" || ls === "false") return false;
  }
  // Default: on outside production
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    return true;
  }
  return false;
}

const PLACEHOLDER_HOTBAR: Array<HotbarSlotItem | null> = [
  { id: "fists", label: "Bare Hands", icon: "✊", quality: "common" },
  { id: "block", label: "Singularity Block", icon: "◼", count: 64, quality: "uncommon" },
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

export const BiomesUIMount: React.FunctionComponent<{}> = () => {
  const [enabled, setEnabled] = useState<boolean>(() => false);
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(0);

  useEffect(() => {
    setEnabled(isEnabled());
  }, []);

  // Allow toggling at runtime via key combo: Shift+Alt+B
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
          console.log(`[BiomesUI] ${next ? "enabled" : "disabled"} via Shift+Alt+B`);
          return next;
        });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hotbar = useMemo(
    () => ({
      slots: PLACEHOLDER_HOTBAR,
      selectedIndex: selectedSlot,
      onSelect: setSelectedSlot,
      onUse: (i: number) => {
        // eslint-disable-next-line no-console
        console.log(`[BiomesUI] use slot ${i + 1}`);
      },
      onDrop: (i: number) => {
        // eslint-disable-next-line no-console
        console.log(`[BiomesUI] drop slot ${i + 1}`);
      },
    }),
    [selectedSlot]
  );

  if (!enabled) return null;

  return (
    <>
      <BiomesUI
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        hotbar={hotbar}
      />
      {/* TutorialDirector mounts with null step until the host wires the
          live mission state. With the registry running, you can already
          test cues from the browser console:
            requestHighlight({ uniqueId: "tab.inventory", style: "pulse" })
       */}
      <TutorialDirector step={null} />
    </>
  );
};
