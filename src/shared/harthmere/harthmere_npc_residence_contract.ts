// HARTHMERE_NPC_RESIDENCE_CONTRACT
//
// The user-facing promise: every NPC in Harthmere has a living quarters that
// is part of their walking route. This file is the programmatic contract.
//
// What it asserts:
//   1. Every named NPC in HARTHMERE_NAMED_NPCS has a non-empty `home`.
//   2. Every named NPC has `route.goesHomeDaily === true`.
//   3. Every named NPC has at least one schedule entry where
//      `location === "home"` AND that entry has a valid Vec3 waypoint.
//   4. Each home schedule entry's waypoint matches the canonical residence
//      doorstep declared in `harthmere_district_bible_layout.ts` (within
//      a 12-block tolerance), so the home position the NPC walks to actually
//      sits in the district building it's labelled as.
//   5. Every named bible NPC declared in HARTHMERE_BIBLE_NPC_RESIDENCES
//      exists in HARTHMERE_NAMED_NPCS.

import {
  HARTHMERE_BIBLE_NPC_RESIDENCES,
  harthmereDistrictById,
  harthmereResidenceByNpcId,
} from "@/shared/harthmere/harthmere_district_bible_layout";
import { HARTHMERE_NAMED_NPCS } from "@/shared/harthmere/npc_compendium";

export const HARTHMERE_NPC_RESIDENCE_CONTRACT_VERSION =
  "harthmere-npc-residence-contract" as const;

export const HARTHMERE_RESIDENCE_DOORSTEP_TOLERANCE = 12;

interface HarthmereNamedNpcLike {
  id: string;
  name?: string;
  home?: string;
  district?: string;
  route?: {
    routeId?: string;
    goesHomeDaily?: boolean;
    homeLocation?: string;
    schedule?: Array<{
      hour?: number;
      timeOfDay?: string;
      location?: string;
      district?: string;
      waypoint?: number[];
      activity?: string;
    }>;
  };
}

// The current NPCs are declared `as const` so each schedule entry has unique
// literal types for hour/timeOfDay/etc. The contract only cares about a
// shape-compatible read view, so cast through `unknown` to drop the
// over-specific literal types without losing field names.
const NPC_LIST = HARTHMERE_NAMED_NPCS as unknown as ReadonlyArray<HarthmereNamedNpcLike>;

function isValidVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function distanceXZ(a: readonly number[], b: readonly number[]) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export interface HarthmereResidenceContractResult {
  ok: boolean;
  failures: string[];
  totalNpcs: number;
  npcsMissingHome: string[];
  npcsMissingHomeSchedule: string[];
  npcsWithMismatchedDoorstep: { npcId: string; expected: number[]; actual: number[]; distance: number }[];
  bibleResidencesMissingFromCompendium: string[];
}

export function validateHarthmereNpcResidences(): HarthmereResidenceContractResult {
  const failures: string[] = [];
  const npcsMissingHome: string[] = [];
  const npcsMissingHomeSchedule: string[] = [];
  const npcsWithMismatchedDoorstep: HarthmereResidenceContractResult["npcsWithMismatchedDoorstep"] = [];
  const knownNpcIds = new Set(NPC_LIST.map((n) => n.id));

  // 1-3: every named NPC has home + goesHomeDaily + schedule
  for (const npc of NPC_LIST) {
    if (!npc.home || typeof npc.home !== "string") {
      npcsMissingHome.push(npc.id);
      failures.push(`${npc.id} (${npc.name ?? "?"}) has no 'home' description`);
    }
    if (!npc.route?.goesHomeDaily) {
      failures.push(`${npc.id} has route.goesHomeDaily !== true`);
    }
    const homeEntries = (npc.route?.schedule ?? []).filter(
      (s) => s.location === "home",
    );
    if (homeEntries.length === 0) {
      npcsMissingHomeSchedule.push(npc.id);
      failures.push(`${npc.id} has no schedule entry with location='home'`);
      continue;
    }
    if (!homeEntries.some((s) => isValidVec3(s.waypoint))) {
      failures.push(`${npc.id} 'home' schedule entries have no valid Vec3 waypoint`);
      continue;
    }
    // 4: cross-check against the bible residence layout if one exists for
    // this NPC.  We only enforce when both exist; not every npc_compendium
    // entry has a bible doorstep (the ambient NPCs intentionally don't).
    const residence = harthmereResidenceByNpcId(npc.id);
    if (!residence) continue;
    const district = harthmereDistrictById(residence.districtId);
    const declaredDoorstep = residence.doorstep;
    const homeWaypoint = homeEntries.find((s) => isValidVec3(s.waypoint))?.waypoint!;
    const d = distanceXZ(homeWaypoint, declaredDoorstep);
    if (d > HARTHMERE_RESIDENCE_DOORSTEP_TOLERANCE) {
      npcsWithMismatchedDoorstep.push({
        npcId: npc.id,
        expected: declaredDoorstep,
        actual: homeWaypoint,
        distance: Number(d.toFixed(2)),
      });
      failures.push(
        `${npc.id} home waypoint ${JSON.stringify(homeWaypoint)} is ${d.toFixed(1)}m from bible doorstep ${JSON.stringify(
          declaredDoorstep,
        )} (district=${district?.id ?? "unknown"})`,
      );
    }
  }

  // 5: every residence row points to a real NPC
  const bibleResidencesMissingFromCompendium: string[] = [];
  for (const residence of HARTHMERE_BIBLE_NPC_RESIDENCES) {
    if (!knownNpcIds.has(residence.npcId)) {
      bibleResidencesMissingFromCompendium.push(residence.npcId);
      failures.push(
        `bible residence references unknown NPC id '${residence.npcId}' — add to HARTHMERE_NAMED_NPCS or remove from layout`,
      );
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    totalNpcs: NPC_LIST.length,
    npcsMissingHome,
    npcsMissingHomeSchedule,
    npcsWithMismatchedDoorstep,
    bibleResidencesMissingFromCompendium,
  };
}

/** Convenience accessor for the local-dev diagnostics panel. */
export function harthmereNamedNpcIds(): ReadonlySet<string> {
  return new Set(NPC_LIST.map((n) => n.id));
}
