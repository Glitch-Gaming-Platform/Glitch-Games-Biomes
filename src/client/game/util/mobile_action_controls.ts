// HARTHMERE_MOBILE_ACTION_CONTROLS (2026-08-04 mobile audit, items 1 and 14).
//
// Before this module a phone could walk, jump, crouch, look, press F, and open
// menus -- and could not mine, place, or fight. The reasons were split across
// three systems, which is why each one looked fine in isolation:
//
//  1. `primary` / `primary_hold` / `secondary` / `secondary_hold` are bound
//     through `bindMouseClick` and driven by `mousedown` / `mouseup` listeners
//     in `context_managers/input.ts`. There is no touch path into any of them.
//     iOS synthesises a click for a *tap*, but it never holds `mousedown`, so
//     even the accidental path could not sustain a hold.
//  2. The only mobile route into `primary_hold` was tapping a hotbar slot,
//     which pulses it for a fixed `holdDurationMs` -- 350 ms for everything
//     except eat/drink/warp. Mining a block that takes longer than 350 ms was
//     therefore impossible, and `secondary` (place / alternate use) had no
//     mobile invocation at all.
//  3. The Harthmere combat verbs -- draw/sheathe, cycle target, basic, heavy,
//     spark -- are dispatched from a `keydown` handler keyed on
//     `HARTHMERE_COMBAT_KEY_BINDINGS` in
//     `LocalDevHarthmereMultiplayerCombatSystem.tsx`. With no keyboard, all
//     five were unreachable on a phone.
//
// This module is the pure policy half of the fix: which buttons exist, what
// they are called, and which input each one drives. The React half lives in
// `JoystickInput.tsx` and is mounted only when `clientConfig.mobileDevice` is
// true, so nothing here can reach a desktop client.
//
// Design rules the implementation must preserve:
//
//  - Buttons drive *input*, never gameplay directly. Primary and secondary set
//    the same synthetic motions the mouse sets, so `InteractScript` remains the
//    sole authority over what the selected item actually does -- mine, attack,
//    place, cast, eat, fish. We are adding a way to press the button, not a
//    second implementation of the verb.
//  - Hold is a real hold. Press sets the motion to 1, release sets it to 0.
//    That is what makes mining a slow block work, and it is why these are not
//    implemented with `pulseMotion`.
//  - Every button releases on pointer cancel, blur, visibility loss, and
//    unmount, exactly like the existing crouch/jump controls. A stuck
//    `primary_hold` would swing forever.

import type { HarthmereCombatKeyAction } from "@/client/components/challenges/harthmereNativeCombatKeyRouting";

/** Synthetic-motion source names. One per control, so releases never collide. */
export const MOBILE_PRIMARY_ACTION_SOURCE = "mobile-primary-button";
export const MOBILE_SECONDARY_ACTION_SOURCE = "mobile-secondary-button";

/**
 * The verbs a phone control can invoke.
 *
 * `primary` / `secondary` are hold-capable input motions. The three combat
 * entries are discrete presses routed through the existing native combat
 * dispatcher so they keep the same authority as their keyboard equivalents.
 */
export type MobileActionKind =
  | "primary"
  | "secondary"
  | "draw"
  | "target"
  | "heavy"
  | "spark";

export interface MobileActionButtonSpec {
  kind: MobileActionKind;
  /** Short glyph shown in the button. */
  glyph: string;
  /** Accessible name; also the visible caption. */
  label: string;
  /** Screen-reader description of what the control does. */
  ariaLabel: string;
  /** True when the control must hold its input while the finger is down. */
  holdable: boolean;
  /** Test/e2e hook, mirrors the existing `data-biomes-mobile-*` convention. */
  testAttribute: string;
}

/**
 * Primary is labelled from the selected item so the button reads "Mine",
 * "Attack", "Place" or "Use" rather than a generic verb. The kinds come from
 * `describeHotbarPrimaryAction`, which already classifies every authored item
 * action; we only translate them into a caption.
 */
export type MobilePrimaryLabelKind =
  | "attack"
  | "cast"
  | "consume"
  | "fish"
  | "place"
  | "tool"
  | "use"
  | "mine";

const PRIMARY_LABELS: Record<MobilePrimaryLabelKind, string> = {
  attack: "Attack",
  cast: "Cast",
  consume: "Use",
  fish: "Fish",
  place: "Place",
  tool: "Use",
  use: "Use",
  mine: "Mine",
};

/**
 * Caption for the primary button.
 *
 * An empty hand still mines -- that is the default voxel interaction -- so a
 * missing/unknown item reads "Mine" rather than an unhelpful "Use".
 */
export function mobilePrimaryActionLabel(
  kind: MobilePrimaryLabelKind | undefined
) {
  return kind ? PRIMARY_LABELS[kind] : PRIMARY_LABELS.mine;
}

/** Map a combat button to the action understood by the native combat router. */
export function mobileCombatActionForKind(
  kind: MobileActionKind
): HarthmereCombatKeyAction | undefined {
  switch (kind) {
    case "heavy":
      return "heavy";
    case "spark":
      return "spark";
    default:
      return undefined;
  }
}

export interface MobileActionAvailability {
  /**
   * True once native ECS authority is on, which is the mode in which the
   * combat verbs route through `InteractScript`. When it is off the combat
   * buttons are hidden rather than disabled: the retired local simulator is a
   * developer path and should not be reachable from a phone HUD.
   */
  nativeCombatEnabled: boolean;
  /** Mirrors the combat system's own `weaponDrawn` flag. */
  weaponDrawn: boolean;
  /**
   * Reason the combat actions are currently blocked (respawn protection,
   * downed, no spark target...), taken verbatim from
   * `getHarthmereMultiplayerAttackDisabledReason` so the phone HUD cannot
   * invent its own rules or drift from the desktop ones.
   */
  attackBlockedReason?: string;
  sparkBlockedReason?: string;
}

const PRIMARY_SPEC: Omit<MobileActionButtonSpec, "label"> = {
  kind: "primary",
  glyph: "⛏",
  ariaLabel: "Primary action: hold to mine, attack, or use the selected item",
  holdable: true,
  testAttribute: "primary",
};

const SECONDARY_SPEC: MobileActionButtonSpec = {
  kind: "secondary",
  glyph: "▣",
  label: "Place",
  ariaLabel: "Secondary action: place the selected block or use the alternate action",
  holdable: true,
  testAttribute: "secondary",
};

const DRAW_SPEC: MobileActionButtonSpec = {
  kind: "draw",
  glyph: "🗡",
  label: "Draw",
  ariaLabel: "Draw or sheathe your weapon",
  holdable: false,
  testAttribute: "draw",
};

const TARGET_SPEC: MobileActionButtonSpec = {
  kind: "target",
  glyph: "◎",
  label: "Target",
  ariaLabel: "Cycle combat target",
  holdable: false,
  testAttribute: "target",
};

const HEAVY_SPEC: MobileActionButtonSpec = {
  kind: "heavy",
  glyph: "⚔",
  label: "Heavy",
  ariaLabel: "Heavy attack",
  holdable: false,
  testAttribute: "heavy",
};

const SPARK_SPEC: MobileActionButtonSpec = {
  kind: "spark",
  glyph: "✦",
  label: "Spark",
  ariaLabel: "Cast Spark",
  holdable: false,
  testAttribute: "spark",
};

/**
 * Build the mobile action cluster.
 *
 * Ordering matters: it is the thumb-reach order, closest first. Primary and
 * secondary always exist because mining and placing are core to the game and
 * must never depend on combat state. The combat controls only appear in native
 * ECS authority mode, and heavy/spark only once a weapon is drawn -- matching
 * the keyboard flow, where the first B/H press draws the weapon and the second
 * one strikes.
 */
export function mobileActionButtons(
  availability: MobileActionAvailability,
  primaryLabelKind?: MobilePrimaryLabelKind
): MobileActionButtonSpec[] {
  const buttons: MobileActionButtonSpec[] = [
    { ...PRIMARY_SPEC, label: mobilePrimaryActionLabel(primaryLabelKind) },
    SECONDARY_SPEC,
  ];
  if (!availability.nativeCombatEnabled) {
    return buttons;
  }
  buttons.push(DRAW_SPEC);
  if (availability.weaponDrawn) {
    buttons.push(TARGET_SPEC, HEAVY_SPEC, SPARK_SPEC);
  }
  return buttons;
}

/**
 * Disabled reason for a control, or undefined when it is usable.
 *
 * Primary and secondary are never disabled: they cover mining, placing, and
 * every non-combat item use, and the combat rules that block an attack do not
 * block chopping a tree. `InteractScript` and the server remain the real
 * gates.
 */
export function mobileActionDisabledReason(
  kind: MobileActionKind,
  availability: MobileActionAvailability
): string | undefined {
  switch (kind) {
    case "primary":
    case "secondary":
    case "draw":
    case "target":
      return undefined;
    case "heavy":
      return availability.attackBlockedReason;
    case "spark":
      return availability.sparkBlockedReason ?? availability.attackBlockedReason;
  }
}
