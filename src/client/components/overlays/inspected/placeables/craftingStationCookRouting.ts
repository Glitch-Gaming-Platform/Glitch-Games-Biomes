import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";

// A placed campfire / oven / pot / fire pit is a cooking station — pressing F
// opens the timer-based cooking panel rather than the generic crafting UI.
export const HARTHMERE_PLACED_COOK_STATION_RE =
  /\b(ovens?|cookpots?|cook\s+pots?|cooking\s+pots?|soup\s+pots?|stew\s+pots?|kitchen\s+pots?|pots?|campfires?|camp\s+fires?|firepits?|fire\s+pits?)\b/i;

// HARTHMERE_PLACED_COOK_STATION_PROMPT
// Decides whether a *placed placeable* should get the "F" cook prompt at all.
// This is deliberately TIGHTER than HARTHMERE_PLACED_COOK_STATION_RE above:
// the routing regex includes a bare "pot" alternative (so a station already
// known to be a cooking station still resolves correctly), but the prompt gate
// must not fire for ordinary decorative props a player might place — a flower
// pot, paint pot, honey pot, chimney pot, etc. So the prompt regex requires an
// explicit cooking word (campfire / fire pit / oven / cookpot / kettle / hearth)
// and never matches a standalone "pot".
const HARTHMERE_PLACED_COOK_STATION_PROMPT_RE =
  /\b(ovens?|cookpots?|cook\s+pots?|cooking\s+pots?|soup\s+pots?|stew\s+pots?|kitchen\s+pots?|kettles?|campfires?|camp\s+fires?|firepits?|fire\s+pits?|fire\s+rings?|hearths?|cooking\s+fires?)\b/i;

/** Minimal item shape needed to classify a placeable as a cooking station.
 *  Kept structural so the predicate stays pure and node-testable without
 *  pulling in the bikkie item runtime. */
export interface HarthmereCookStationItemLike {
  id?: BiomesId | number;
  displayName?: string | null;
}

/** True when a placed placeable item is a campfire / oven / cookpot / fire pit
 *  that should surface the cook "F" prompt and open the cooking panel. Matches
 *  on the item's display name (e.g. "Campfire", "Stone Oven", "Cookpot") and, as
 *  a belt-and-suspenders guard for the base-game campfire whose name could be
 *  empty or localized, on the known campfire bikkie id. */
export function isHarthmerePlacedCookStationItem(
  item: HarthmereCookStationItemLike | undefined | null
): boolean {
  if (!item) {
    return false;
  }
  if (item.id !== undefined && item.id === BikkieIds.campfire) {
    return true;
  }
  const text = `${item.displayName ?? ""}`.trim();
  if (!text) {
    return false;
  }
  return HARTHMERE_PLACED_COOK_STATION_PROMPT_RE.test(text);
}
