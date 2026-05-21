// HARTHMERE_NPC_RESIDENCE_CONTRACT_V80
//
// The user-facing promise: every NPC in Harthmere has a living quarters that
// is part of their walking route. This file is the programmatic contract.
//
// What it asserts:
//   1. Every named NPC in HARTHMERE_NAMED_NPCS_V44 has a non-empty `home`.
//   2. Every named NPC has `route.goesHomeDaily === true`.
//   3. Every named NPC has at least one schedule entry where
//      `location === "home"` AND that entry has a valid Vec3 waypoint.
//   4. Each home schedule entry's waypoint matches the canonical residence
//      doorstep declared in `harthmere_district_bible_layout_v80.ts` (within
//      a 12-block tolerance), so the home position the NPC walks to actually
//      sits in the district building it's labelled as.
//   5. Every named bible NPC declared in HARTHMERE_BIBLE_NPC_RESIDENCES_V80
//      exists in HARTHMERE_NAMED_NPCS_V44.

import {
  HARTHMERE_BIBLE_NPC_RESIDENCES_V80,
  harthmereDistrictByIdV80,
  harthmereResidenceByNpcIdV80,
} from "@/shared/harthmere/harthmere_district_bible_layout_v80";
import { HARTHMERE_NAMED_NPCS_V44 } from "@/shared/harthmere/npc_compendium_v44";

export const HARTHMERE_NPC_RESIDENCE_CONTRACT_VERSION_V80 =
  "harthmere-npc-residence-contract-v80" as const;

export const HARTHMERE_RESIDENCE_DOORSTEP_TOLERANCE_V80 = 12;

interface HarthmereNamedNpcLikeV80 {
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

const NPC_LIST = HARTHMERE_NAMED_NPCS_V44 as ReadonlyArray<HarthmereNamedNpcLikeV80>;

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

export interface HarthmereResidenceContractResultV80 {
  ok: boolean;
  failures: string[];
  totalNpcs: number;
  npcsMissingHome: string[];
  npcsMissingHomeSchedule: string[];
  npcsWithMismatchedDoorstep: { npcId: string; expected: number[]; actual: number[]; distance: number }[];
  bibleResidencesMissingFromCompendium: string[];
}

export function validateHarthmereNpcResidencesV80(): HarthmereResidenceContractResultV80 {
  const failures: string[] = [];
  const npcsMissingHome: string[] = [];
  const npcsMissingHomeSchedule: string[] = [];
  const npcsWithMismatchedDoorstep: HarthmereResidenceContractResultV80["npcsWithMismatchedDoorstep"] = [];
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
    const residence = harthmereResidenceByNpcIdV80(npc.id);
    if (!residence) continue;
    const district = harthmereDistrictByIdV80(residence.districtId);
    const declaredDoorstep = residence.doorstep;
    const homeWaypoint = homeEntries.find((s) => isValidVec3(s.waypoint))?.waypoint!;
    const d = distanceXZ(homeWaypoint, declaredDoorstep);
    if (d > HARTHMERE_RESIDENCE_DOORSTEP_TOLERANCE_V80) {
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
  for (const residence of HARTHMERE_BIBLE_NPC_RESIDENCES_V80) {
    if (!knownNpcIds.has(residence.npcId)) {
      bibleResidencesMissingFromCompendium.push(residence.npcId);
      failures.push(
        `bible residence references unknown NPC id '${residence.npcId}' — add to HARTHMERE_NAMED_NPCS_V44 or remove from layout`,
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
export function harthmereNamedNpcIdsV80(): ReadonlySet<string> {
  return new Set(NPC_LIST.map((n) => n.id));
}
