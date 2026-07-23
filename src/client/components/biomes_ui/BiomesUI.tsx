import * as React from "react";
import { useEffect, useRef } from "react";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "@/client/components/contexts/pointerLockModalPolicy";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { emitHarthmereGlitchBehaviorEvent } from "@/client/game/glitch/harthmere_glitch_behavior_events";
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
import { CurrentQuestObjectiveHUD } from "./CurrentQuestObjectiveHUD";
import { QuestInviteHUD } from "./quest_invites/QuestInviteHUD";
import {
  type BiomesHUDVisibilitySnapshot,
  useBiomesHUDVisibilitySnapshot,
} from "./hudVisibilitySettings";

import { DailyTodoTab } from "./tabs/DailyTodoTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { FarmingTab } from "./tabs/FarmingTab";
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
    onUse?: (i: number) => unknown | Promise<unknown>;
    onDrop?: (i: number) => unknown | Promise<unknown>;
    onRemove?: (i: number) => void;
  };
  badges?: Partial<Record<TabKey, number>>;
  shortcutOverrides?: TabShortcut[];
  adapters?: BiomesUIAdapters;
  paneMode?: "overlay" | "compact";
  hudVisibilityOverride?: Partial<BiomesHUDVisibilitySnapshot>;
}

export interface BiomesUIAdapters {
  daily?: any;
  inventory?: any;
  farming?: any;
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
  questInvites?: any;
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
  hudVisibilityOverride,
}) => {
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLock = useRef<PointerLockUnlockWhileOpenReturnRef>({
    current: false,
  });
  const shortcuts = shortcutOverrides ?? DEFAULT_TAB_SHORTCUTS;
  const hudVisibility = useBiomesHUDVisibilitySnapshot(hudVisibilityOverride);

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
    emitHarthmereGlitchBehaviorEvent(
      "biomes_ui",
      activeTab ? "open_tab" : "close",
      { tab: activeTab ?? previous ?? "none", previous_tab: previous ?? "none" }
    );
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === null || paneMode !== "overlay") {
      closePointerLockUnlockWhileOpen(
        pointerLockManager,
        shouldReturnPointerLock.current
      );
      return;
    }
    openPointerLockUnlockWhileOpen(
      pointerLockManager,
      shouldReturnPointerLock.current
    );
    return () => {
      closePointerLockUnlockWhileOpen(
        pointerLockManager,
        shouldReturnPointerLock.current
      );
    };
  }, [activeTab, paneMode, pointerLockManager]);

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
      {hudVisibility.helpButtons && (
        <BiomesUIOpenPrompt isOpen={activeTab !== null} />
      )}
      {hudVisibility.objectives && (
        <CurrentQuestObjectiveHUD
          adapter={adapters?.map}
          isOpen={activeTab !== null}
        />
      )}
      <QuestInviteHUD adapter={adapters?.questInvites} />
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
          <button
            type="button"
            aria-label="Close Biomes UI"
            onClick={() => onActiveTabChange(null)}
            style={{
              position: "absolute",
              top: 18,
              right: 18,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              border: "1px solid var(--biomes-edge-cyan-soft)",
              borderRadius: 4,
              background: "rgba(7, 12, 26, 0.82)",
              color: "var(--biomes-fg-muted)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-grid",
                minWidth: 28,
                placeItems: "center",
                padding: "2px 5px",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: 3,
                background: "rgba(255,255,255,0.08)",
                color: "var(--biomes-fg)",
              }}
            >
              Esc
            </span>
            Close
          </button>
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
      {hudVisibility.hotbar && (
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
                emitHarthmereGlitchBehaviorEvent("hotbar", "select_slot", {
                  slot: i + 1,
                });
                hotbar.onSelect(i);
              }}
              onUse={
                hotbar.onUse
                  ? (i) => {
                      emitHarthmereGlitchBehaviorEvent("hotbar", "use_slot", {
                        slot: i + 1,
                      });
                      return hotbar.onUse?.(i);
                    }
                  : undefined
              }
              onDrop={
                hotbar.onDrop
                  ? (i) => {
                      emitHarthmereGlitchBehaviorEvent("hotbar", "drop_slot", {
                        slot: i + 1,
                      });
                      return hotbar.onDrop?.(i);
                    }
                  : undefined
              }
              onRemove={
                hotbar.onRemove
                  ? (i) => {
                      emitHarthmereGlitchBehaviorEvent(
                        "hotbar",
                        "remove_slot",
                        {
                          slot: i + 1,
                        }
                      );
                      hotbar.onRemove?.(i);
                    }
                  : undefined
              }
              enabled={activeTab === null}
            />
          </div>
        </div>
      )}
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
      {tab === "daily" && <DailyTodoTab adapter={adapters?.daily} />}
      {tab === "inventory" && <InventoryTab adapter={adapters?.inventory} />}
      {tab === "farming" && <FarmingTab adapter={adapters?.farming} />}
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
