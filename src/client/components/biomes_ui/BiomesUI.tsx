import * as React from "react";
import { useEffect, useRef } from "react";
import { emitHarthmereGlitchBehaviorEventV138 } from "@/client/game/glitch/harthmere_glitch_behavior_events";
import { installBiomesUITheme } from "./theme/biomesUITheme";
import { BiomesNav } from "./nav/BiomesNav";
import { BiomesHotbar } from "./hotbar/BiomesHotbar";
import type { HotbarSlotItem } from "./hotbar/BiomesHotbar";
import { TAB_DESCRIPTORS, TAB_ORDER } from "./BiomesUITypes";
import type { TabKey } from "./BiomesUITypes";
import {
  DEFAULT_TAB_SHORTCUTS,
  installTabShortcuts,
} from "./shortcuts/BiomesShortcuts";
import type { TabShortcut } from "./shortcuts/BiomesShortcuts";
import { BiomesUIOpenPrompt } from "./BiomesUIOpenPrompt";

import { InventoryTab } from "./tabs/InventoryTab";
import { AbilitiesTab } from "./tabs/AbilitiesTab";
import { SkillsTab } from "./tabs/SkillsTab";
import { ClassesTab } from "./tabs/ClassesTab";
import { LandTab } from "./tabs/LandTab";
import { LootTab } from "./tabs/LootTab";
import { GuildsTab } from "./tabs/GuildsTab";
import { BankingTab } from "./tabs/BankingTab";
import { MapQuestsTab } from "./tabs/MapQuestsTab";
import { CollectionsTab } from "./tabs/CollectionsTab";
import { InboxTab } from "./tabs/InboxTab";
import { OptionsTab } from "./tabs/OptionsTab";

export interface BiomesUIProps {
  activeTab: TabKey | null;
  onActiveTabChange: (next: TabKey | null) => void;
  hotbar: {
    slots: Array<HotbarSlotItem | null>;
    selectedIndex: number;
    onSelect: (i: number) => void;
    onUse?: (i: number) => void;
    onDrop?: (i: number) => void;
  };
  badges?: Partial<Record<TabKey, number>>;
  shortcutOverrides?: TabShortcut[];
  adapters?: BiomesUIAdapters;
  paneMode?: "overlay" | "compact";
}

export interface BiomesUIAdapters {
  inventory?: any;
  abilities?: any;
  skills?: any;
  classes?: any;
  land?: any;
  loot?: any;
  guilds?: any;
  banking?: any;
  map?: any;
  collections?: any;
  inbox?: any;
  options?: any;
}

function isTypingInInput(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const ae = document.activeElement as HTMLElement | null;
  if (!ae) return false;
  const tag = ae.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || ae.isContentEditable;
}

export const BiomesUI: React.FunctionComponent<BiomesUIProps> = ({
  activeTab,
  onActiveTabChange,
  hotbar,
  badges,
  shortcutOverrides,
  adapters,
  paneMode = "overlay",
}) => {
  const shortcuts = shortcutOverrides ?? DEFAULT_TAB_SHORTCUTS;

  useEffect(() => {
    installBiomesUITheme();
  }, []);

  const previousActiveTabRef = useRef<TabKey | null | undefined>(undefined);
  useEffect(() => {
    if (previousActiveTabRef.current === undefined) {
      previousActiveTabRef.current = activeTab;
      return;
    }
    const previous = previousActiveTabRef.current;
    previousActiveTabRef.current = activeTab;
    emitHarthmereGlitchBehaviorEventV138(
      "biomes_ui",
      activeTab ? "open_tab" : "close",
      { tab: activeTab ?? previous ?? "none", previous_tab: previous ?? "none" }
    );
  }, [activeTab]);

  useEffect(() => {
    const cleanup = installTabShortcuts(
      shortcuts,
      (tab) => {
        onActiveTabChange(activeTab === tab ? null : tab);
      },
      isTypingInInput
    );
    return cleanup;
  }, [shortcuts, activeTab, onActiveTabChange]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && activeTab !== null && !isTypingInInput()) {
        onActiveTabChange(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeTab, onActiveTabChange]);

  return (
    <>
      <BiomesUIOpenPrompt isOpen={activeTab !== null} />
      {paneMode === "overlay" && activeTab !== null && (
        <div
          role="dialog"
          aria-label={`${TAB_DESCRIPTORS[activeTab].label} panel`}
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: "20px 16px",
            background:
              "radial-gradient(ellipse at center, rgba(7,12,26,0.55) 0%, rgba(7,12,26,0.92) 80%)",
            zIndex: 1100,
          }}
        >
          <BiomesNav
            activeTab={activeTab}
            onTabChange={onActiveTabChange}
            badges={badges}
          />
          <div
            className="biomes-ui-panel"
            style={{
              flex: 1,
              marginTop: 12,
              padding: "16px 18px",
              maxWidth: 1100,
              width: "100%",
              alignSelf: "center",
              overflow: "auto",
            }}
          >
            <ActiveTabPane tab={activeTab} adapters={adapters} />
          </div>
        </div>
      )}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 16,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          zIndex: 1090,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <BiomesHotbar
            slots={hotbar.slots}
            selectedIndex={hotbar.selectedIndex}
            onSelect={(i) => {
              emitHarthmereGlitchBehaviorEventV138("hotbar", "select_slot", {
                slot: i + 1,
              });
              hotbar.onSelect(i);
            }}
            onUse={
              hotbar.onUse
                ? (i) => {
                    emitHarthmereGlitchBehaviorEventV138("hotbar", "use_slot", {
                      slot: i + 1,
                    });
                    hotbar.onUse?.(i);
                  }
                : undefined
            }
            onDrop={
              hotbar.onDrop
                ? (i) => {
                    emitHarthmereGlitchBehaviorEventV138(
                      "hotbar",
                      "drop_slot",
                      {
                        slot: i + 1,
                      }
                    );
                    hotbar.onDrop?.(i);
                  }
                : undefined
            }
          />
        </div>
      </div>
    </>
  );
};

const ActiveTabPane: React.FunctionComponent<{
  tab: TabKey;
  adapters?: BiomesUIAdapters;
}> = ({ tab, adapters }) => {
  const desc = TAB_DESCRIPTORS[tab];
  return (
    <div>
      <header style={{ marginBottom: 14 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--biomes-fg)",
          }}
        >
          {desc.label}
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 12,
            color: "var(--biomes-fg-muted)",
          }}
        >
          {desc.subtitle}
        </p>
      </header>
      {tab === "inventory" && <InventoryTab adapter={adapters?.inventory} />}
      {tab === "abilities" && <AbilitiesTab adapter={adapters?.abilities} />}
      {tab === "skills" && <SkillsTab adapter={adapters?.skills} />}
      {tab === "classes" && <ClassesTab adapter={adapters?.classes} />}
      {tab === "land" && <LandTab adapter={adapters?.land} />}
      {tab === "loot" && <LootTab adapter={adapters?.loot} />}
      {tab === "guilds" && <GuildsTab adapter={adapters?.guilds} />}
      {tab === "banking" && <BankingTab adapter={adapters?.banking} />}
      {tab === "map" && <MapQuestsTab adapter={adapters?.map} />}
      {tab === "collections" && (
        <CollectionsTab adapter={adapters?.collections} />
      )}
      {tab === "inbox" && <InboxTab adapter={adapters?.inbox} />}
      {tab === "options" && <OptionsTab adapter={adapters?.options} />}
    </div>
  );
};

export { TAB_ORDER, TAB_DESCRIPTORS };
export type { TabKey, HotbarSlotItem };
