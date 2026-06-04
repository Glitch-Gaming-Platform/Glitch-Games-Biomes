// HARTHMERE_CONTAINER_DRAG_AND_KEYBOARD_V1:
// Pure, dependency-free decision logic for the container panel's drag-and-drop
// and keyboard navigation. The panel is a heavy React surface; keeping the rules
// here makes every edge case unit-testable in isolation.
//
// Model: two columns — "container" (left) and "inventory" (right). The player can
//  - drag an item from one column and drop it on the OTHER column, and
//  - move a focus cursor with the arrow keys and press Enter/Return to move the
//    focused item to the other column.
// Moving container -> inventory TAKES; inventory -> container STORES. A move onto
// the same column is a no-op.

export type HarthmereContainerSideV1 = "container" | "inventory";

export interface HarthmereContainerFocusV1 {
  side: HarthmereContainerSideV1;
  index: number;
}

export interface HarthmereContainerColumnCountsV1 {
  containerCount: number;
  inventoryCount: number;
}

export type HarthmereContainerTransferActionV1 = "take" | "store" | "none";

// The MIME type used on the native DataTransfer. A custom type keeps unrelated
// drags (text, files) from being interpreted as item moves; we also mirror the
// payload onto text/plain for browsers/tests that only expose that.
export const HARTHMERE_CONTAINER_DRAG_MIME_V1 =
  "application/x-harthmere-container-item";

export interface HarthmereContainerDragPayloadV1 {
  side: HarthmereContainerSideV1;
  itemId: string;
}

export function serializeHarthmereContainerDragPayloadV1(
  payload: HarthmereContainerDragPayloadV1
): string {
  return JSON.stringify({ side: payload.side, itemId: payload.itemId });
}

export function parseHarthmereContainerDragPayloadV1(
  text: string | null | undefined
): HarthmereContainerDragPayloadV1 | undefined {
  if (!text) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(text) as Partial<HarthmereContainerDragPayloadV1>;
    if (
      parsed &&
      (parsed.side === "container" || parsed.side === "inventory") &&
      typeof parsed.itemId === "string" &&
      parsed.itemId.length > 0
    ) {
      return { side: parsed.side, itemId: parsed.itemId };
    }
  } catch {
    // not our payload
  }
  return undefined;
}

// What dropping an item from `sourceSide` onto `targetSide` should do.
export function resolveHarthmereContainerTransferV1(
  sourceSide: HarthmereContainerSideV1,
  targetSide: HarthmereContainerSideV1
): HarthmereContainerTransferActionV1 {
  if (sourceSide === targetSide) {
    return "none";
  }
  return sourceSide === "container" ? "take" : "store";
}

// Pressing Enter/Return on the focused item moves it to the OTHER column.
export function harthmereContainerEnterActionV1(
  side: HarthmereContainerSideV1
): HarthmereContainerTransferActionV1 {
  return side === "container" ? "take" : "store";
}

function countForSideV1(
  side: HarthmereContainerSideV1,
  counts: HarthmereContainerColumnCountsV1
): number {
  return side === "container" ? counts.containerCount : counts.inventoryCount;
}

// Clamp a (possibly stale or undefined) focus to a valid position. If the focused
// column is empty, fall back to the other column. Returns undefined only when
// BOTH columns are empty (there is nothing to focus).
export function clampHarthmereContainerFocusV1(
  focus: HarthmereContainerFocusV1 | undefined,
  counts: HarthmereContainerColumnCountsV1
): HarthmereContainerFocusV1 | undefined {
  const containerCount = Math.max(0, counts.containerCount);
  const inventoryCount = Math.max(0, counts.inventoryCount);
  if (containerCount <= 0 && inventoryCount <= 0) {
    return undefined;
  }
  let side: HarthmereContainerSideV1 = focus?.side ?? "container";
  if (side === "container" && containerCount <= 0) {
    side = "inventory";
  } else if (side === "inventory" && inventoryCount <= 0) {
    side = "container";
  }
  const count = side === "container" ? containerCount : inventoryCount;
  const index = Math.max(0, Math.min(focus?.index ?? 0, count - 1));
  return { side, index };
}

export type HarthmereContainerArrowKeyV1 =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight";

// Move the focus cursor for an arrow key. Up/Down move within the current column
// (clamped, no wrap). Left/Right switch to the container/inventory column
// respectively, preserving the row index (clamped to the target). If the target
// column is empty, focus stays where it is.
export function moveHarthmereContainerFocusV1(
  focus: HarthmereContainerFocusV1 | undefined,
  key: HarthmereContainerArrowKeyV1,
  counts: HarthmereContainerColumnCountsV1
): HarthmereContainerFocusV1 | undefined {
  const start = clampHarthmereContainerFocusV1(focus, counts);
  if (!start) {
    return undefined;
  }
  if (key === "ArrowUp") {
    return { side: start.side, index: Math.max(0, start.index - 1) };
  }
  if (key === "ArrowDown") {
    const max = countForSideV1(start.side, counts) - 1;
    return { side: start.side, index: Math.min(max, start.index + 1) };
  }
  const targetSide: HarthmereContainerSideV1 =
    key === "ArrowLeft" ? "container" : "inventory";
  if (targetSide === start.side) {
    return start;
  }
  const targetCount = countForSideV1(targetSide, counts);
  if (targetCount <= 0) {
    return start;
  }
  return { side: targetSide, index: Math.min(start.index, targetCount - 1) };
}
