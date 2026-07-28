// CHAPTER_1_FRACTURE_GATES
//
// A Fracture Gate is a hole in the present tense. Where enough anchors have
// been stacked and stressed, the local timeline loses containment and a
// stable-for-a-while aperture forms onto a real place at a real other time.
// Not a pocket dimension. Not a simulation. The past, still running.
//
// Harthmere calls them Mouths. Collective field reports say "aperture event".
// The Grove calls them gates and stays away from them.
//
// HARD RULES (journal §5.2 — these are story-critical invariants, tested):
//  1. Gates only appear where Biomes are used. Anchor density drives spawning.
//  2. NO GATES IN HARTHMERE. Ever. Harthmere refuses Exotic Matter, so it has
//     no anchors, so it has no Mouths. Enforced by x < bridge center.
//  3. A gate is one-way until the far anchor is reached.
//  4. No merchants, no rest areas, no safe rooms, no resupply.
//  5. Time inside runs differently and inconsistently — a dread mechanic,
//     never a puzzle mechanic.
//  6. Something always has to come back with you.

import {
  CH1_ANCHORS,
  CH1_FLAGS,
  CH1_HARTHMERE_BRIDGE_X,
  isCh1LegalGatePosition,
  type Ch1Vec3,
} from "@/shared/harthmere/ch1_ids";

export const CH1_FRACTURE_GATES_VERSION = 1 as const;

/** One Grove-side day, in milliseconds. */
export const CH1_GROVE_DAY_MS = 24 * 60 * 60 * 1000;

export type Ch1GateBehavior =
  /** Opens, holds for a fixed window, closes on its own. */
  | "transient"
  /** Opens and stays open. Something can come out. */
  | "persistent";

export interface Ch1FractureGateDef {
  id: string;
  name: string;
  /** What Harthmere calls it. */
  harthmereName: string;
  position: Ch1Vec3;
  behavior: Ch1GateBehavior;
  /** For transient gates: seconds before self-collapse. */
  openSeconds?: number;
  /** Dungeon reached through this gate, if any. */
  dungeonId?: string;
  /** Act in which the gate first appears. */
  act: number;
  /** Flag that causes this gate to exist in the world. */
  requiresFlag?: string;
  /** Flag set when the gate is first witnessed. */
  setsFlag?: string;
  /**
   * Grove-side hours that elapse per hour spent inside. Revealed on exit,
   * never before. Inconsistent between gates on purpose.
   */
  timeDilation: number;
  /**
   * The authored beat, in Grove-side milliseconds, that the fiction requires
   * regardless of how fast the player was.
   *
   * The multiplier alone cannot deliver it. Act 3 closes on a Grove that has
   * had THREE DAYS and Act 5 on a Grove that has had TWO; a brisk two-hour
   * desert run at x9 produces eighteen hours, and a player who sprints the
   * fjord produces less than one day. Rather than inflate the multiplier until
   * a slow player loses a month, the elapsed time is
   *
   *     max(insideMs * timeDilation, groveSideFloorMs)
   *
   * which keeps "time inside runs differently AND INCONSISTENTLY" (journal
   * §5.2 rule 5) honest in both directions: fast players get the authored
   * dread, slow players get worse.
   */
  groveSideFloorMs?: number;
  /** Can the player enter it in Chapter 1? */
  enterable: boolean;
  description: string;
}

export const CH1_FRACTURE_GATES: readonly Ch1FractureGateDef[] = Object.freeze([
  {
    id: "ch1_gate_fence_sighting",
    name: "The Fence Line Seam",
    harthmereName: "a small Mouth",
    position: CH1_ANCHORS.gate_fence_sighting,
    behavior: "transient",
    openSeconds: 90,
    act: 1,
    requiresFlag: CH1_FLAGS.started,
    setsFlag: CH1_FLAGS.seenFirstGate,
    timeDilation: 1,
    enterable: false,
    description:
      "A vertical seam of light, two metres tall, humming. It closes on its own after ninety seconds. The Card goes hot enough to hurt.",
  },
  {
    id: "ch1_gate_desert",
    name: "The Old Wood Aperture",
    harthmereName: "the Dry Mouth",
    position: CH1_ANCHORS.gate_desert,
    behavior: "persistent",
    dungeonId: "ch1_dungeon_desert",
    act: 2,
    requiresFlag: CH1_FLAGS.act2Complete,
    setsFlag: CH1_FLAGS.gatePersistentOpen,
    // Ninety seconds inside becomes three days in the Grove.
    timeDilation: 9,
    groveSideFloorMs: CH1_GROVE_DAY_MS * 3,
    enterable: true,
    description:
      "It did not close. It is still there in the morning, and a single set of sandal-leather footprints walks north out of it and stops halfway.",
  },
  {
    id: "ch1_gate_winter",
    name: "The Cold Gate",
    harthmereName: "the Long Winter Mouth",
    position: CH1_ANCHORS.gate_winter,
    behavior: "persistent",
    dungeonId: "ch1_dungeon_winter",
    act: 5,
    requiresFlag: CH1_FLAGS.act4Complete,
    timeDilation: 6,
    groveSideFloorMs: CH1_GROVE_DAY_MS * 2,
    enterable: true,
    description:
      "At the far edge of the anchor field, past the muck flats. It has been there for weeks and everybody has been ignoring it because it is unpleasant to stand near.",
  },
  {
    id: "ch1_gate_prime",
    name: "The One That Doesn't Close",
    harthmereName: "the Wide Mouth",
    position: CH1_ANCHORS.gate_prime,
    behavior: "persistent",
    act: 6,
    requiresFlag: CH1_FLAGS.complete,
    timeDilation: 1,
    enterable: false,
    description:
      "Three hundred metres out from the Grove fence, at dusk. Bigger than either of the ones you walked through. It does not close.",
  },
]);

const GATES_BY_ID = new Map(CH1_FRACTURE_GATES.map((g) => [g.id, g]));

export function ch1Gate(id: string): Ch1FractureGateDef | undefined {
  return GATES_BY_ID.get(id);
}

export function ch1GatesForAct(act: number): readonly Ch1FractureGateDef[] {
  return CH1_FRACTURE_GATES.filter((g) => g.act === act);
}

export function ch1ActiveGates(
  flags: ReadonlySet<string> | readonly string[]
): readonly Ch1FractureGateDef[] {
  const set = flags instanceof Set ? flags : new Set(flags);
  return CH1_FRACTURE_GATES.filter(
    (g) => !g.requiresFlag || set.has(g.requiresFlag)
  );
}

/**
 * The Harthmere invariant. Any gate east of the bridge is a story bug, not a
 * balance problem: Harthmere uses no Exotic Matter and therefore cannot have
 * an aperture. Enforced in ch1_fracture_gates.test.ts over every authored gate
 * and every dungeon entrance.
 */
export function ch1ValidateGatePlacement(gate: Ch1FractureGateDef): string[] {
  const errors: string[] = [];
  if (!isCh1LegalGatePosition(gate.position)) {
    errors.push(
      `${gate.id}: gate at x=${gate.position[0]} is east of the Harthmere ` +
        `bridge (x=${CH1_HARTHMERE_BRIDGE_X}). Harthmere uses no Biomes and ` +
        `therefore has no Mouths.`
    );
  }
  if (gate.behavior === "transient" && !gate.openSeconds) {
    errors.push(`${gate.id}: transient gates require openSeconds`);
  }
  if (gate.dungeonId && !gate.enterable) {
    errors.push(`${gate.id}: has a dungeon but is not enterable`);
  }
  if (gate.timeDilation <= 0) {
    errors.push(`${gate.id}: timeDilation must be positive`);
  }
  if (gate.dungeonId && !gate.groveSideFloorMs) {
    errors.push(
      `${gate.id}: an enterable gate needs a groveSideFloorMs, or the authored ` +
        `"the Grove has had N days" beat depends on how slowly the player played`
    );
  }
  return errors;
}

export function ch1ValidateAllGates(): string[] {
  return CH1_FRACTURE_GATES.flatMap(ch1ValidateGatePlacement);
}

/**
 * Grove-side elapsed time for a stay inside a gate. The player is never told
 * this in advance; it is delivered on exit as dread, not as a puzzle input.
 */
export function ch1GroveSideElapsedMs(
  gateId: string,
  insideMs: number
): number {
  const gate = GATES_BY_ID.get(gateId);
  if (!gate) {
    throw new Error(`unknown chapter 1 gate: ${gateId}`);
  }
  const elapsed = Math.max(0, insideMs) * gate.timeDilation;
  return Math.max(elapsed, gate.groveSideFloorMs ?? 0);
}

/**
 * The line the game says on the way out. Never before: the dilation is dread,
 * not a puzzle input, and the player must not be able to budget against it.
 */
export function ch1GroveSideElapsedSummary(
  gateId: string,
  insideMs: number
): string {
  const elapsed = ch1GroveSideElapsedMs(gateId, insideMs);
  const days = Math.floor(elapsed / CH1_GROVE_DAY_MS);
  if (days >= 1) {
    return days === 1
      ? "The Grove has had a day."
      : `The Grove has had ${days} days.`;
  }
  const hours = Math.max(1, Math.round(elapsed / (60 * 60 * 1000)));
  return hours === 1
    ? "The Grove has had an hour."
    : `The Grove has had ${hours} hours.`;
}

// ---------------------------------------------------------------------------
// Provisioning
//
// Both dungeons open with a required loadout check that cannot be skipped and
// cannot be satisfied from one vendor. The player has to work the Grove
// economy: Rin for forage, Fern for produce, Gus for keeping-bread, Carlo for
// cooked stock, Doc for field medicine, Luis for repair kits, Mel for tools.
//
// This is not padding. It is the chapter's argument that the world runs on
// people doing jobs.
// ---------------------------------------------------------------------------

export interface Ch1ProvisioningRequirement {
  key: string;
  label: string;
  quantity: number;
  /** Who in the Grove supplies this. */
  sourceNpc: string;
}

export interface Ch1ProvisioningCheck {
  gateId: string;
  /** The NPC who inspects the pack and does not explain how they know. */
  inspector: string;
  requirements: readonly Ch1ProvisioningRequirement[];
  /** Under-provisioned players are blocked. This is a hard gate. */
  hardBlock: true;
}

export const CH1_PROVISIONING: readonly Ch1ProvisioningCheck[] = Object.freeze([
  {
    gateId: "ch1_gate_desert",
    inspector: "Jackie",
    hardBlock: true,
    requirements: [
      { key: "water", label: "Water", quantity: 12, sourceNpc: "Fern the Grower" },
      { key: "food", label: "Keeping-bread and stock", quantity: 10, sourceNpc: "Gus the Baker" },
      { key: "cooked", label: "Cooked rations", quantity: 6, sourceNpc: "Carlo the Cook" },
      { key: "forage", label: "Field forage", quantity: 8, sourceNpc: "Rin the Forager" },
      { key: "light", label: "Torches", quantity: 10, sourceNpc: "Mel the Handyman" },
      { key: "repair_kit", label: "Repair kits", quantity: 2, sourceNpc: "Luis" },
      { key: "bandage", label: "Field medicine", quantity: 6, sourceNpc: "Doc" },
    ],
  },
  {
    gateId: "ch1_gate_winter",
    inspector: "Ranger Jane",
    hardBlock: true,
    requirements: [
      { key: "fuel", label: "Fuel", quantity: 18, sourceNpc: "Mel the Handyman" },
      { key: "food", label: "Keeping-bread and stock", quantity: 20, sourceNpc: "Gus the Baker" },
      { key: "cooked", label: "Cooked rations", quantity: 12, sourceNpc: "Carlo the Cook" },
      { key: "cold_gear", label: "Cold-weather gear", quantity: 1, sourceNpc: "Richard" },
      { key: "rope", label: "Rope", quantity: 4, sourceNpc: "Halden Rook" },
      { key: "iron", label: "Iron stock", quantity: 6, sourceNpc: "Luis" },
      { key: "repair_kit", label: "Repair kits", quantity: 3, sourceNpc: "Luis" },
      { key: "bandage", label: "Field medicine", quantity: 10, sourceNpc: "Doc" },
    ],
  },
]);

export function ch1ProvisioningFor(
  gateId: string
): Ch1ProvisioningCheck | undefined {
  return CH1_PROVISIONING.find((p) => p.gateId === gateId);
}

export interface Ch1ProvisioningResult {
  ok: boolean;
  missing: Array<{ key: string; label: string; need: number; have: number }>;
}

export function ch1CheckProvisioning(
  gateId: string,
  carried: Readonly<Record<string, number>>
): Ch1ProvisioningResult {
  const check = ch1ProvisioningFor(gateId);
  if (!check) {
    return { ok: true, missing: [] };
  }
  const missing = check.requirements
    .map((r) => ({
      key: r.key,
      label: r.label,
      need: r.quantity,
      have: carried[r.key] ?? 0,
    }))
    .filter((m) => m.have < m.need);
  return { ok: missing.length === 0, missing };
}
