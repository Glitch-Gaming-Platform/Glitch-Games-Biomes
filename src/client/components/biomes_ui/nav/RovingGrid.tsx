// RovingGrid — keyboard-navigable grid primitive used by the inventory,
// banking vault, abilities loadout, and other slot-based panels.
//
// Implements the "roving tabindex" pattern (WAI-ARIA Authoring Practices):
//   * Only the focused cell has tabindex=0; the rest are -1.
//   * Arrow keys move focus by one cell. PageUp/Down jump a row.
//   * Home/End jump to row start/end. Ctrl+Home/End jump to grid corners.
//   * Enter / Space fires onActivate(row, col).
//
// The grid is purely a layout helper — it doesn't know what your cells
// represent. Pass a render function and we'll wire focus/keys for you.

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface RovingGridProps<T> {
  items: T[][];
  /** Render one cell. Provided handlers must be spread on the cell element. */
  renderCell: (
    item: T,
    coords: { row: number; col: number; focused: boolean },
    cellProps: {
      ref: (el: HTMLElement | null) => void;
      tabIndex: number;
      onFocus: () => void;
      onClick: () => void;
      onKeyDown: (e: React.KeyboardEvent) => void;
    }
  ) => React.ReactNode;
  onActivate?: (row: number, col: number, item: T) => void;
  /** Optional initial focus position. */
  initialRow?: number;
  initialCol?: number;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}

export function RovingGrid<T>({
  items,
  renderCell,
  onActivate,
  initialRow = 0,
  initialCol = 0,
  ariaLabel,
  className,
  style,
}: RovingGridProps<T>): React.ReactElement {
  const [pos, setPos] = useState({ row: initialRow, col: initialCol });
  const cellRefs = useRef<Map<string, HTMLElement | null>>(new Map());

  const moveTo = useCallback(
    (row: number, col: number) => {
      if (items.length === 0) return;
      const clampedRow =
        ((row % items.length) + items.length) % items.length;
      const rowLen = items[clampedRow]?.length ?? 0;
      if (rowLen === 0) return;
      const clampedCol = ((col % rowLen) + rowLen) % rowLen;
      setPos({ row: clampedRow, col: clampedCol });
      cellRefs.current.get(`${clampedRow}:${clampedCol}`)?.focus();
    },
    [items]
  );

  useEffect(() => {
    // Re-focus when the grid first mounts if a cell wants it.
    // (We don't auto-focus to avoid stealing focus from the world view.)
  }, []);

  const handleKey = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      const rowLen = items[row]?.length ?? 0;
      const last = items.length - 1;
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          moveTo(row, col + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveTo(row, col - 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveTo(row + 1, col);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveTo(row - 1, col);
          break;
        case "Home":
          e.preventDefault();
          if (e.ctrlKey) moveTo(0, 0);
          else moveTo(row, 0);
          break;
        case "End":
          e.preventDefault();
          if (e.ctrlKey) moveTo(last, (items[last]?.length ?? 1) - 1);
          else moveTo(row, rowLen - 1);
          break;
        case "PageDown":
          e.preventDefault();
          moveTo(Math.min(last, row + 3), col);
          break;
        case "PageUp":
          e.preventDefault();
          moveTo(Math.max(0, row - 3), col);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onActivate?.(row, col, items[row][col]);
          break;
      }
    },
    [items, moveTo, onActivate]
  );

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      {items.map((row, r) => (
        <div role="row" key={r} style={{ display: "flex", gap: 4 }}>
          {row.map((item, c) => {
            const focused = r === pos.row && c === pos.col;
            return (
              <React.Fragment key={c}>
                {renderCell(
                  item,
                  { row: r, col: c, focused },
                  {
                    ref: (el) => {
                      cellRefs.current.set(`${r}:${c}`, el);
                    },
                    tabIndex: focused ? 0 : -1,
                    onFocus: () => setPos({ row: r, col: c }),
                    onClick: () => {
                      setPos({ row: r, col: c });
                      onActivate?.(r, c, item);
                    },
                    onKeyDown: (e) => handleKey(e, r, c),
                  }
                )}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}
