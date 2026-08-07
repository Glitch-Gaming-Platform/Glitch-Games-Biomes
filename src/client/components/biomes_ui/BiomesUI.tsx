import * as React from "react";
import { useEffect, useRef } from "react";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "@/client/components/contexts/pointerLockModalPolicy";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { containMobileControlEvent } from "@/client/components/mobileControlEvents";
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
import { PlayerInviteModal } from "@/client/components/system/PlayerInviteModal";
import { PLAYER_INVITE_HOTKEY_CODE } from "@/client/game/invites/player_invites";
import {
  SNAPSHOT_GROVE_TUTOR_HIGHLIGHT_EVENT,
  SnapshotGroveMapHUD,
  openSnapshotGroveTutorChatPanel,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import { SnapshotGroveTutorPrompt } from "./SnapshotGroveTutorPrompt";
import { useHarthmereCombatPresentation } from "@/client/components/challenges/useHarthmereCombatPresentation";
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
import { QuestsTab } from "./tabs/QuestsTab";
import { RecoveredTab } from "./tabs/RecoveredTab";
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
  const { clientConfig, reactResources } = useClientContext();
  const phoneLayout = clientConfig.mobileDevice;
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLock = useRef<PointerLockUnlockWhileOpenReturnRef>({
    current: false,
  });
  const shortcuts = shortcutOverrides ?? DEFAULT_TAB_SHORTCUTS;
  const hudVisibility = useBiomesHUDVisibilitySnapshot(hudVisibilityOverride);
  const combatPresentation = useHarthmereCombatPresentation();
  const [playerInviteOpen, setPlayerInviteOpen] = React.useState(false);
  const [snapshotGroveTutorLabels, setSnapshotGroveTutorLabels] =
    React.useState<Set<string>>(
      () =>
        new Set(
          typeof window === "undefined"
            ? []
            : ((
                window as typeof window & {
                  __snapshotGroveTutorHighlights?: { labels?: string[] };
                }
              ).__snapshotGroveTutorHighlights?.labels ?? [])
        )
    );

  useEffect(() => {
    installBiomesUITheme();
  }, []);

  useEffect(() => {
    const onTutorHighlights = (event: Event) => {
      const labels = (event as CustomEvent<{ labels?: string[] }>).detail
        ?.labels;
      setSnapshotGroveTutorLabels(new Set(labels ?? []));
    };
    window.addEventListener(
      SNAPSHOT_GROVE_TUTOR_HIGHLIGHT_EVENT,
      onTutorHighlights
    );
    return () =>
      window.removeEventListener(
        SNAPSHOT_GROVE_TUTOR_HIGHLIGHT_EVENT,
        onTutorHighlights
      );
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
    if (playerInviteOpen) {
      return;
    }
    const cleanup = installTabShortcuts(
      shortcuts,
      (tab) => {
        onActiveTabChange(activeTab === tab ? null : tab);
      },
      isTypingInInput
    );
    return cleanup;
  }, [shortcuts, activeTab, onActiveTabChange, playerInviteOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== PLAYER_INVITE_HOTKEY_CODE ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTypingInInput() ||
        activeTab !== null
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPlayerInviteOpen((current) => !current);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [activeTab]);

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
      {(hudVisibility.helpButtons || clientConfig.showVirtualJoystick) && (
        <BiomesUIOpenPrompt
          isOpen={activeTab !== null}
          onOpenMenu={() => onActiveTabChange("inventory")}
          onOpenInvite={() => setPlayerInviteOpen(true)}
        />
      )}
      {hudVisibility.objectives && !combatPresentation.suspended && (
        <CurrentQuestObjectiveHUD
          adapter={adapters?.map}
          isOpen={activeTab !== null}
        />
      )}
      {!combatPresentation.suspended && (
        <QuestInviteHUD adapter={adapters?.questInvites} />
      )}
      <PlayerInviteModal
        open={playerInviteOpen}
        mobile={phoneLayout}
        onClose={() => setPlayerInviteOpen(false)}
      />
      {activeTab === null && !combatPresentation.suspended && (
        <SnapshotGroveTutorPrompt
          labels={snapshotGroveTutorLabels}
          onOpenTab={onActiveTabChange}
          onOpenRecipes={() =>
            reactResources.set("/game_modal", { kind: "crafting" })
          }
          onOpenChat={openSnapshotGroveTutorChatPanel}
        />
      )}
      {paneMode === "overlay" && activeTab !== null && (
        <div
          role="dialog"
          aria-label={`${TAB_DESCRIPTORS[activeTab].label} panel`}
          className={
            phoneLayout
              ? "biomes-ui-overlay biomes-ui-overlay--mobile"
              : "biomes-ui-overlay"
          }
          data-biomes-mobile-ui-overlay={phoneLayout ? "true" : undefined}
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            padding: phoneLayout
              ? "calc(max(8px, env(safe-area-inset-top)) + 50px) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))"
              : "20px 16px",
            background:
              "radial-gradient(ellipse at center, rgba(7,12,26,0.55) 0%, rgba(7,12,26,0.92) 80%)",
            zIndex: 1100,
          }}
        >
          <button
            type="button"
            aria-label="Close Biomes UI"
            onPointerDown={(event) => {
              if (!phoneLayout) {
                return;
              }
              // MOBILE_BIOMES_UI_CLOSE_TOUCH: iOS may deliver a complete
              // pointer/touch sequence without synthesizing click. Close on
              // touch-down like the phone HUD open controls, before the button
              // unmounts with the overlay.
              containMobileControlEvent(event);
              onActiveTabChange(null);
            }}
            onClick={(event) => {
              if (phoneLayout) {
                containMobileControlEvent(event);
                // Preserve keyboard activation while avoiding a second close
                // after a browser that does synthesize click for touch.
                if (event.detail !== 0) {
                  return;
                }
              }
              onActiveTabChange(null);
            }}
            style={{
              position: "absolute",
              top: phoneLayout ? "max(8px, env(safe-area-inset-top))" : 18,
              right: phoneLayout ? "max(8px, env(safe-area-inset-right))" : 18,
              zIndex: phoneLayout ? 5 : undefined,
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
              minHeight: phoneLayout ? 44 : undefined,
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
            mobile={phoneLayout}
            tutorLabels={snapshotGroveTutorLabels}
          />
          <div
            className={`biomes-ui-panel biomes-ui-overlay__panel ${
              phoneLayout ? "biomes-ui-overlay__panel--mobile" : ""
            }`.trim()}
            style={{
              flex: 1,
              minHeight: 0,
              marginTop: phoneLayout ? 8 : 12,
              padding: phoneLayout
                ? "12px max(10px, env(safe-area-inset-right)) 12px max(10px, env(safe-area-inset-left))"
                : "16px 18px",
              maxWidth: 1100,
              width: "100%",
              boxSizing: "border-box",
              alignSelf: "center",
              overflow: "auto",
              overscrollBehavior: phoneLayout ? "contain" : undefined,
              WebkitOverflowScrolling: phoneLayout ? "touch" : undefined,
            }}
          >
            <ActiveTabPane
              tab={activeTab}
              adapters={adapters}
              onActiveTabChange={onActiveTabChange}
            />
          </div>
        </div>
      )}
      {hudVisibility.hotbar && (
        <div
          className={`biomes-ui-hotbar-hud ${
            clientConfig.showVirtualJoystick
              ? "biomes-ui-hotbar-hud--mobile"
              : ""
          }`.trim()}
          data-biomes-mobile-hotbar={phoneLayout ? "true" : undefined}
        >
          <div className="biomes-ui-hotbar-hud__content">
            <BiomesHotbar
              slots={hotbar.slots}
              selectedIndex={hotbar.selectedIndex}
              mobile={clientConfig.showVirtualJoystick}
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
  onActiveTabChange: (next: TabKey | null) => void;
}> = ({ tab, adapters, onActiveTabChange }) => {
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
      {tab === "quests" && (
        <QuestsTab
          adapter={adapters?.map}
          onOpenMap={() => onActiveTabChange("map")}
        />
      )}
      {tab === "recovered" && <RecoveredTab />}
      {tab === "map" && (
        <MapQuestsTab
          adapter={adapters?.map}
          // Production hides the legacy Harthmere map. Reuse its universal
          // Grove objective card inside the replacement map so every authored
          // contextual action remains reachable from the shipped UI.
          contextualQuestPanel={<SnapshotGroveMapHUD />}
          showContextualQuestPanelWithActiveQuest
        />
      )}
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
