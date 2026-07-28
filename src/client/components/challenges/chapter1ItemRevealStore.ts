// CHAPTER_1_ITEM_REVEAL_STORE  (client presentation only)
//
// The Card renames itself on screen during the Act 6 consolidation, and both
// compounds acquire their real names at the same moment. That rename was
// authored (ch1_items.ts) and surfaced in the Recovered tab, but the NATIVE
// INVENTORY kept showing "Grey Card" forever, because the Harthmere item
// definition registry holds one static displayName for every player and Chapter
// 1 state is per-player.
//
// This store is the per-player overlay. It holds nothing but presentation:
// authority for the flags lives on the server, the names themselves are
// authored shared data, and a client that lies to itself here changes nothing
// except the label on its own screen.

import { CH1_ITEMS, ch1ItemDescription, ch1ItemDisplayName } from "@/shared/harthmere/ch1_items";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";

export const CHAPTER_1_ITEM_REVEAL_EVENT = "chapter1-item-reveal-updated";

let revealedFlags: readonly string[] = [];
let loaded = false;
let inFlight: Promise<void> | undefined;

const CH1_ITEM_IDS = new Set(CH1_ITEMS.map((item) => item.id));

/** Only Chapter 1 plot items can ever be overridden. */
export function isChapter1RevealableItem(itemId: string): boolean {
  return CH1_ITEM_IDS.has(itemId.replace(/^b:/, ""));
}

export function chapter1RevealedItemName(itemId: string): string | undefined {
  const id = itemId.replace(/^b:/, "");
  if (!CH1_ITEM_IDS.has(id)) return undefined;
  return ch1ItemDisplayName(id, revealedFlags);
}

export function chapter1RevealedItemDescription(
  itemId: string
): string | undefined {
  const id = itemId.replace(/^b:/, "");
  if (!CH1_ITEM_IDS.has(id)) return undefined;
  return ch1ItemDescription(id, revealedFlags);
}

export function setChapter1RevealFlags(flags: readonly string[]): void {
  const next = [...flags];
  const changed =
    next.length !== revealedFlags.length ||
    next.some((flag, index) => flag !== revealedFlags[index]);
  revealedFlags = next;
  loaded = true;
  if (changed && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHAPTER_1_ITEM_REVEAL_EVENT));
  }
}

/**
 * The story route deliberately does not ship raw flags to the client (they name
 * the twist). It ships the already-resolved card name instead, which is enough
 * to decide whether the consolidation has happened.
 */
export function applyChapter1StoryProjection(payload: {
  cardName?: string;
  ledger?: { consolidated?: boolean };
}): void {
  const revealed =
    payload.ledger?.consolidated === true ||
    (payload.cardName !== undefined && payload.cardName !== "Grey Card");
  setChapter1RevealFlags(revealed ? ["ch1_act6_truth_known"] : []);
}

/**
 * Fetch once, lazily, the first time an inventory cell asks about a Chapter 1
 * item. Refreshed by the chapter's existing DOM events, so the rename lands the
 * moment the consolidation cutscene fires its `ch1.renameCard` hook rather than
 * on the next reload.
 */
export function ensureChapter1RevealLoaded(): void {
  if (typeof window === "undefined" || loaded || inFlight) return;
  inFlight = (async () => {
    try {
      const response = await defaultHarthmereLiveFetch(
        "/api/harthmere/chapter1_story",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "state" }),
        cache: "no-store",
        }
      );
      if (!response.ok) return;
      applyChapter1StoryProjection(await response.json());
    } catch {
      // Presentation only. A failed fetch leaves the pre-reveal names, which
      // is the correct default and never blocks inventory rendering.
    } finally {
      inFlight = undefined;
    }
  })();
}

export function refreshChapter1Reveal(): void {
  loaded = false;
  ensureChapter1RevealLoaded();
}

if (typeof window !== "undefined") {
  for (const event of [
    "chapter1-card-renamed",
    "chapter1-ledger-revision",
    "chapter1-story-updated",
  ]) {
    window.addEventListener(event, () => refreshChapter1Reveal());
  }
}
