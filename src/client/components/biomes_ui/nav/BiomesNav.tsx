// BiomesNav — the top tab rail.
//
// Keyboard model:
//   ←/→ : move focus between tabs (rolls over)
//   Enter / Space : activate the focused tab
//   Tab : moves focus out of the rail (standard browser behavior)
//   Direct shortcut keys: R/I/P/B/K/Y/L/O/G/Q/J/M/C/V/, also activate.
//
// Mouse: click a tab to activate. Hover shows tooltip with shortcut hint.

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { TAB_DESCRIPTORS, TAB_ORDER } from "../BiomesUITypes";
import type { TabKey } from "../BiomesUITypes";
import { UI_IDS } from "../uniqueIds";

interface BiomesNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  /** Optional badge counts per tab (e.g. inbox unread count) */
  badges?: Partial<Record<TabKey, number>>;
}

const tabIdMap: Record<TabKey, string> = {
  daily: UI_IDS.TAB_DAILY,
  inventory: UI_IDS.TAB_INVENTORY,
  farming: UI_IDS.TAB_FARMING,
  abilities: UI_IDS.TAB_ABILITIES,
  skills: UI_IDS.TAB_SKILLS,
  classes: UI_IDS.TAB_CLASSES,
  land: UI_IDS.TAB_LAND,
  loot: UI_IDS.TAB_LOOT,
  guilds: UI_IDS.TAB_GUILDS,
  banking: UI_IDS.TAB_BANKING,
  quests: UI_IDS.TAB_QUESTS,
  recovered: UI_IDS.TAB_RECOVERED,
  map: UI_IDS.TAB_MAP,
  collections: UI_IDS.TAB_COLLECTIONS,
  inbox: UI_IDS.TAB_INBOX,
  options: UI_IDS.TAB_OPTIONS,
};

export const BiomesNav: React.FunctionComponent<BiomesNavProps> = ({
  activeTab,
  onTabChange,
  badges,
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(() =>
    Math.max(0, TAB_ORDER.indexOf(activeTab))
  );
  const railRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Keep focused index in sync when activeTab changes externally
  useEffect(() => {
    const idx = TAB_ORDER.indexOf(activeTab);
    if (idx >= 0) setFocusedIndex(idx);
  }, [activeTab]);

  const focusIndex = useCallback((idx: number) => {
    const clamped =
      ((idx % TAB_ORDER.length) + TAB_ORDER.length) % TAB_ORDER.length;
    setFocusedIndex(clamped);
    buttonRefs.current[clamped]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          focusIndex(focusedIndex + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          focusIndex(focusedIndex - 1);
          break;
        case "Home":
          e.preventDefault();
          focusIndex(0);
          break;
        case "End":
          e.preventDefault();
          focusIndex(TAB_ORDER.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onTabChange(TAB_ORDER[focusedIndex]);
          break;
      }
    },
    [focusedIndex, focusIndex, onTabChange]
  );

  return (
    <div
      role="tablist"
      aria-label="Biomes navigation"
      ref={railRef}
      onKeyDown={onKeyDown}
      className="biomes-ui-panel"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        padding: "6px 10px",
        margin: "0 auto",
        maxWidth: 980,
      }}
    >
      {TAB_ORDER.map((tab, idx) => {
        const desc = TAB_DESCRIPTORS[tab];
        const selected = tab === activeTab;
        const focused = focusedIndex === idx;
        const badge = badges?.[tab] ?? 0;
        return (
          <Highlightable key={tab} uniqueId={tabIdMap[tab]} showCaption>
            <button
              ref={(el) => {
                buttonRefs.current[idx] = el;
              }}
              role="tab"
              aria-selected={selected}
              aria-label={`${desc.label} — shortcut ${desc.shortcut}`}
              tabIndex={selected ? 0 : -1}
              data-focused={focused ? "true" : undefined}
              data-tab={tab}
              className="biomes-ui-tab"
              onClick={() => {
                setFocusedIndex(idx);
                onTabChange(tab);
              }}
              onFocus={() => setFocusedIndex(idx)}
              title={`${desc.label} (${desc.shortcut}) — ${desc.subtitle}`}
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {desc.code}
                <span
                  style={{
                    fontSize: 9,
                    opacity: 0.55,
                    padding: "1px 4px",
                    border: "1px solid rgba(232,244,255,0.25)",
                    borderRadius: 3,
                  }}
                >
                  {desc.shortcut}
                </span>
                {badge > 0 && (
                  <span
                    aria-label={`${badge} new`}
                    style={{
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg,#ff54c4,#ff8a3d)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 6px rgba(255,84,196,0.55)",
                    }}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
            </button>
          </Highlightable>
        );
      })}
    </div>
  );
};
