// BiomesHotbar — sci-fi themed hotbar that REPLACES the rendering of the
// existing Minecraft-look hotbar without removing any functionality.
//
// Important: this is purely a presentational replacement that wires into
// the same `slots` / `selectedIndex` / `onSelect` props the existing
// HotBar manages internally. The original HotBar.tsx remains untouched
// for backward compatibility and admin tooling.
//
// Keyboard: 1..9 selects directly; ←/→ moves selection; Enter activates
// (fires onUse). Q drops, R reloads/cycles (delegated to onAction).

import * as React from "react";
import { useCallback, useEffect } from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";

export interface HotbarSlotItem {
  id: string;
  label: string;
  /** Either an image url or an emoji/glyph */
  icon: string;
  count?: number;
  /** Quality tier — controls border tinting */
  quality?: "common" | "uncommon" | "rare" | "epic" | "legendary" | "quest";
}

interface BiomesHotbarProps {
  /** 9 slots — null for empty */
  slots: Array<HotbarSlotItem | null>;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onUse?: (index: number) => void;
  onDrop?: (index: number) => void;
  /** Whether the hotbar is currently focusable (closed when chat is open, etc) */
  enabled?: boolean;
}

const QUALITY_COLOR: Record<string, string> = {
  common: "rgba(180, 200, 220, 0.4)",
  uncommon: "rgba(120, 230, 140, 0.55)",
  rare: "rgba(95, 165, 255, 0.6)",
  epic: "rgba(200, 100, 255, 0.7)",
  legendary: "rgba(255, 184, 68, 0.8)",
  quest: "rgba(255, 84, 196, 0.8)",
};

export const BiomesHotbar: React.FunctionComponent<BiomesHotbarProps> = ({
  slots,
  selectedIndex,
  onSelect,
  onUse,
  onDrop,
  enabled = true,
}) => {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      // Digit shortcuts
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        onSelect(parseInt(e.key, 10) - 1);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onSelect(Math.max(0, selectedIndex - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onSelect(Math.min(slots.length - 1, selectedIndex + 1));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onUse?.(selectedIndex);
      } else if (e.key.toLowerCase() === "q") {
        onDrop?.(selectedIndex);
      }
    },
    [enabled, slots.length, selectedIndex, onSelect, onUse, onDrop]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div
      role="toolbar"
      aria-label="Action hotbar"
      className="biomes-ui-panel"
      style={{
        display: "flex",
        gap: 6,
        padding: 8,
        margin: "0 auto",
        width: "fit-content",
      }}
    >
      {slots.map((slot, i) => {
        const selected = i === selectedIndex;
        const qcolor = QUALITY_COLOR[slot?.quality ?? "common"];
        return (
          <Highlightable key={i} uniqueId={UI_IDS.HOTBAR_SLOT(i + 1)} showCaption>
            <button
              type="button"
              role="button"
              aria-label={
                slot
                  ? `Slot ${i + 1}: ${slot.label}`
                  : `Slot ${i + 1}: empty`
              }
              aria-pressed={selected}
              data-selected={selected ? "true" : undefined}
              className="biomes-ui-slot"
              style={{ borderColor: selected ? undefined : qcolor }}
              onClick={() => onSelect(i)}
              onDoubleClick={() => onUse?.(i)}
            >
              {slot && (
                <>
                  <span
                    aria-hidden
                    style={{ fontSize: 22, lineHeight: 1 }}
                  >
                    {slot.icon}
                  </span>
                  {slot.count && slot.count > 1 ? (
                    <span
                      style={{
                        position: "absolute",
                        right: 4,
                        top: 2,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                        textShadow: "0 0 4px rgba(0,0,0,0.7)",
                      }}
                    >
                      {slot.count}
                    </span>
                  ) : null}
                </>
              )}
              <span className="biomes-ui-slot-key">{i + 1}</span>
            </button>
          </Highlightable>
        );
      })}
    </div>
  );
};
