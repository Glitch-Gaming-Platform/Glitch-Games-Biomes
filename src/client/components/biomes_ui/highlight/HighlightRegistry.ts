// BiomesUI HighlightRegistry
// ---------------------------------------------------------------------------
// A small pub/sub registry that lets any UI element opt in to being a
// "highlight target" by registering its unique id (e.g. "tab.inventory",
// "hotbar.slot_2", "abilities.slot_1"). Tutorial missions, quest hints,
// notifications, and admin tools can then call requestHighlight(uniqueId)
// to make that element blink/pulse.
//
// The registry is intentionally framework-agnostic — it is consumed by
// `useBlinkTarget` (React hook) and `HighlightOverlay` (React component),
// but the data model is plain JS so it can be unit-tested without a DOM.
//
// Design notes:
//   * IDs are namespaced strings. Conventions:
//       tab.<key>                e.g. tab.inventory, tab.abilities
//       hotbar.slot_<n>          e.g. hotbar.slot_3
//       inventory.slot.<slot>    e.g. inventory.slot.chest
//       abilities.slot_<n>       e.g. abilities.slot_1
//       recipes.<recipeId>       e.g. recipes.muck_buster
//       map.marker.<id>          e.g. map.marker.road_marker
//       camera.selfie
//   * Multiple registrations under the same id are allowed (e.g. a slot
//     used twice in two views). Highlight events fire for all of them.
//   * Highlights can be one-shot ("blink for 5s"), persistent (until
//     cleared), or cycling (every N seconds while target unmet).
//   * If no element is registered for a requested id, the request is
//     queued and delivered when the element registers. This avoids the
//     timing race where a mission step asks to highlight a tab that
//     hasn't mounted yet.

export type HighlightStyle =
  | "pulse" // soft glow pulse (default)
  | "ring" // hard outline ring
  | "arrow" // floating arrow pointer above element
  | "shimmer"; // animated shimmer sweep — used for exotic-matter feel

export interface HighlightRequest {
  uniqueId: string;
  style?: HighlightStyle;
  /** ms — 0 means persistent until cleared */
  durationMs?: number;
  /** Free-form label rendered as a small caption above the element */
  caption?: string;
  /** Optional reason — used by the tutorial system to disambiguate */
  source?: string;
}

interface RegisteredTarget {
  uniqueId: string;
  /** The DOM element this id is anchored to, or null if non-DOM */
  element: HTMLElement | null;
  /** Called when a highlight is requested for this id */
  onHighlight: (req: HighlightRequest) => void;
  /** Called when a highlight is explicitly cleared */
  onClear: () => void;
}

const targets = new Map<string, Set<RegisteredTarget>>();
const queued = new Map<string, HighlightRequest[]>();
const activeHighlights = new Map<string, HighlightRequest>();

type Listener = (state: Map<string, HighlightRequest>) => void;
const listeners = new Set<Listener>();

function notify() {
  for (const l of Array.from(listeners)) {
    l(new Map(activeHighlights));
  }
}

/** Register an element to receive highlight events for `uniqueId`. */
export function registerHighlightTarget(target: RegisteredTarget): () => void {
  const set = targets.get(target.uniqueId) ?? new Set<RegisteredTarget>();
  set.add(target);
  targets.set(target.uniqueId, set);

  // Drain any queued requests for this id.
  const q = queued.get(target.uniqueId);
  if (q && q.length > 0) {
    queued.delete(target.uniqueId);
    for (const req of q) {
      target.onHighlight(req);
    }
  }

  return () => {
    const cur = targets.get(target.uniqueId);
    if (!cur) return;
    cur.delete(target);
    if (cur.size === 0) {
      targets.delete(target.uniqueId);
    }
  };
}

/** Ask all currently-registered targets with this id to blink/pulse. */
export function requestHighlight(req: HighlightRequest): void {
  const style: HighlightStyle = req.style ?? "pulse";
  const durationMs = req.durationMs ?? 4500;
  const normalized: HighlightRequest = { ...req, style, durationMs };

  activeHighlights.set(req.uniqueId, normalized);
  notify();

  const set = targets.get(req.uniqueId);
  if (!set || set.size === 0) {
    // Queue it — we'll fire when something registers.
    const q = queued.get(req.uniqueId) ?? [];
    q.push(normalized);
    queued.set(req.uniqueId, q);
    return;
  }

  for (const t of Array.from(set)) {
    try {
      t.onHighlight(normalized);
    } catch {
      // never let a bad listener break the loop
    }
  }

  if (durationMs > 0) {
    setTimeout(() => clearHighlight(req.uniqueId), durationMs);
  }
}

/** Clear any active highlight for `uniqueId`. */
export function clearHighlight(uniqueId: string): void {
  const hadActive = activeHighlights.delete(uniqueId);
  const hadQueued = queued.delete(uniqueId);
  if (!hadActive && !hadQueued) return;
  if (hadActive) {
    notify();
  }
  const set = targets.get(uniqueId);
  if (!set) return;
  for (const t of Array.from(set)) {
    try {
      t.onClear();
    } catch {
      // ignore
    }
  }
}

/** Clear every active highlight. */
export function clearAllHighlights(): void {
  const ids = Array.from(activeHighlights.keys());
  for (const id of ids) clearHighlight(id);
  // Also drop any queued-but-never-delivered requests.
  queued.clear();
}

/** Subscribe to active-highlight state changes (for overlays/devtools). */
export function subscribeHighlights(listener: Listener): () => void {
  listeners.add(listener);
  listener(new Map(activeHighlights));
  return () => {
    listeners.delete(listener);
  };
}

/** Inspection helpers — primarily for tests. */
export function _internalsForTest() {
  return { targets, queued, activeHighlights, listeners };
}

/** Hard reset — primarily for tests. */
export function _resetHighlightRegistryForTest() {
  targets.clear();
  queued.clear();
  activeHighlights.clear();
  listeners.clear();
}
