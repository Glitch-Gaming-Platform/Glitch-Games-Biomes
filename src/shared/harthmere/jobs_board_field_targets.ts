// HARTHMERE_JOBS_BOARD_FIELD_TARGETS
//
// Every Jobs Board job that "requires field work" points the player at a marker
// position. Until now, the 19 business-issued templates and the 19 business
// outpost starter jobs pointed at a *coordinate* with no physical object at it:
//
//   - the client's world-object prompt selector only knows Grove landmarks and
//     live ECS entities, so `refinery_intake` / `farm_supply_crate` /
//     `clinic_supply_shelf` / `inn_linen_shelf` had nothing to press F on, and
//   - the outpost starter jobs reused the outpost's own jobs-board marker, so
//     "sort refinery stock" was satisfied by re-opening the board you accepted
//     it from.
//
// This module is the single, shared authority for those physical targets. It
// declares, per target id:
//
//   - the world-object LABEL (which drives the interaction semantics, so the
//     client prompt and the server receipt validator agree on the verb), and
//   - the resolved world POSITION, derived from the owning outpost's footprint
//     via harthmereBusinessOutpostFrontPosition, so the object always stands on
//     the shop apron next to (never inside) the building.
//
// Consumers:
//   - jobs_board_quest_marker_positions: map pins / runtime marker resolution
//   - client overlays.ts: the "F" world-object prompt candidate set
//   - client harthmere_quest_object_markers: the in-world procedural prop
//   - live_mode_backend: server-side world_object_interaction validation and
//     the jobs-board observed-target gate (a receipt, not mere proximity)
//
// Pure module: string ids, numbers, and the outpost table only.

import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostFrontPosition,
  type HarthmereBusinessOutpost,
} from "@/shared/harthmere/business_customer_simulator";
import { HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES } from "@/shared/harthmere/jobs_board_business_templates";
import type { HarthmereEconomyBusinessTypeId } from "@/shared/harthmere/mmo_economy_authority";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_JOBS_BOARD_FIELD_TARGETS_VERSION =
  "harthmere-jobs-board-field-targets" as const;

/** Lateral offset (metres) from the outpost's jobs board along the facing. */
export const HARTHMERE_JOBS_BOARD_FIELD_TARGET_LATERAL = 3.25;
export const HARTHMERE_OUTPOST_WORK_STATION_LATERAL = -3.25;

export type HarthmereJobsBoardFieldTargetSource =
  | "business_template_target"
  | "business_outpost_work_station";

export interface HarthmereJobsBoardFieldTarget {
  /** The requirement/job `targetId` the completion flow matches on. */
  targetId: string;
  /** The map marker id shown on every map surface for this target. */
  mapMarkerId: string;
  /** World-object label; drives object-interaction semantics on both sides. */
  label: string;
  businessType: HarthmereEconomyBusinessTypeId;
  outpostId: string;
  position: Vec3;
  source: HarthmereJobsBoardFieldTargetSource;
}

/** targetId -> the physical prop label the player interacts with. */
const BUSINESS_TEMPLATE_TARGET_LABELS: Readonly<Record<string, string>> = {
  refinery_intake: "Refinery Intake Terminal",
  biome_anchor_leak: "Biome Anchor Leak Pillar",
  design_studio_workbench: "Design Studio Workbench",
  trade_route_watch: "Trade Route Watch Post",
  portal_gate_office: "Portal Gate Office Terminal",
  farm_supply_crate: "Farm Supply Crate",
  forge_material_bin: "Forge Material Bin",
  safe_ruin_cache: "Safe Ruin Cache",
  old_route_marker: "Old Route Marker Stone",
  property_material_crate: "Property Material Crate",
  trader_ration_crate: "Trader Ration Crate",
  hunter_larder: "Hunter Larder Shelf",
  clinic_supply_shelf: "Clinic Supply Shelf",
  teleport_pad_terminal: "Teleport Pad Terminal",
  sanitation_barrels: "Sanitation Barrels",
  market_fixture: "Broken Market Fixture Stand",
  restaurant_kitchen: "Restaurant Kitchen Prep Table",
  clinic_lockbox: "Clinic Delivery Lockbox",
  inn_linen_shelf: "Inn Linen Shelf",
};

// HARTHMERE_OUTPOST_STARTER_WORK_STATION
// The starter job's described work ("sort refinery stock", "prepare bandages",
// "wrap meat", "mark hazards", "reset rooms") now has a real station on the
// outpost apron. The starter requirement points HERE instead of at the outpost
// jobs board, so re-opening the board can no longer satisfy the objective.
interface OutpostWorkStationSpec {
  label: string;
  /** Short imperative used by the job description ("Sort stock at ..."). */
  action: string;
}

const OUTPOST_WORK_STATIONS: Readonly<
  Record<HarthmereEconomyBusinessTypeId, OutpostWorkStationSpec>
> = {
  exotic_matter_refinery: {
    label: "Refinery Stock Shelf",
    action: "Sort the sealed refinery stock",
  },
  biome_maintenance_repair: {
    label: "Anchor Parts Table",
    action: "Lay out and count anchor parts",
  },
  biome_design_studio: {
    label: "Design Sample Table",
    action: "Lay out the seasonal design samples",
  },
  security_defense_contractor: {
    label: "Patrol Duty Board",
    action: "Sign on for the patrol rotation",
  },
  portal_transit_company: {
    label: "Transit Manifest Desk",
    action: "Check the transit manifests",
  },
  biome_farming_rare_foods: {
    label: "Seed Sorting Table",
    action: "Sort the seed trays",
  },
  weapons_tools: {
    label: "Tool Order Bin",
    action: "Fill the standing tool orders",
  },
  magic_goods: {
    label: "Ward Component Shelf",
    action: "Sort the ward components",
  },
  exploration_guide: {
    label: "Route Planning Table",
    action: "Plot the day's guided routes",
  },
  custom_home_property_development: {
    label: "Build Order Table",
    action: "Check the build orders",
  },
  general_trader: {
    label: "Market Stock Shelf",
    action: "Restock the market shelf",
  },
  hunter_wild_meat: {
    label: "Meat Wrapping Table",
    action: "Wrap and label the day's cuts",
  },
  medical_doctor: {
    label: "Bandage Prep Table",
    action: "Prepare clean bandages",
  },
  teleport_owner: {
    label: "Pad Calibration Terminal",
    action: "Calibrate the teleport pad",
  },
  waste_sanitation_cleanup: {
    label: "Hazard Marking Post",
    action: "Mark the hazard zones",
  },
  repair_maintenance_person: {
    label: "Fixture Labelling Table",
    action: "Label the broken fixtures",
  },
  food_service_restaurant: {
    label: "Service Line Prep Table",
    action: "Prep the service line",
  },
  courier: {
    label: "Parcel Sorting Table",
    action: "Sort the outgoing parcels",
  },
  hospitality_inn_hotel_shelter: {
    label: "Guest Room Linen Shelf",
    action: "Reset the guest room linen",
  },
};

export function harthmereOutpostWorkStationTargetId(outpostId: string) {
  return `${outpostId}_work_station`;
}

export function harthmereOutpostWorkStationMarkerId(outpostId: string) {
  return `${outpostId}_work_station_marker`;
}

function outpostForType(
  businessType: HarthmereEconomyBusinessTypeId
): HarthmereBusinessOutpost | undefined {
  return HARTHMERE_BUSINESS_OUTPOSTS.find(
    (outpost) => outpost.businessType === businessType
  );
}

function vec3From(position: { x: number; y: number; z: number }): Vec3 {
  return [position.x, position.y, position.z];
}

function buildFieldTargets(): HarthmereJobsBoardFieldTarget[] {
  const targets: HarthmereJobsBoardFieldTarget[] = [];

  for (const template of HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES) {
    const label = BUSINESS_TEMPLATE_TARGET_LABELS[template.targetId];
    const outpost = outpostForType(template.businessType);
    if (!label || !outpost) {
      continue;
    }
    targets.push({
      targetId: template.targetId,
      mapMarkerId: template.mapMarkerId,
      label,
      businessType: template.businessType,
      outpostId: outpost.outpostId,
      position: vec3From(
        harthmereBusinessOutpostFrontPosition(outpost, {
          lateral: HARTHMERE_JOBS_BOARD_FIELD_TARGET_LATERAL,
        })
      ),
      source: "business_template_target",
    });
  }

  for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
    const spec = OUTPOST_WORK_STATIONS[outpost.businessType];
    if (!spec) {
      continue;
    }
    targets.push({
      targetId: harthmereOutpostWorkStationTargetId(outpost.outpostId),
      mapMarkerId: harthmereOutpostWorkStationMarkerId(outpost.outpostId),
      label: spec.label,
      businessType: outpost.businessType,
      outpostId: outpost.outpostId,
      position: vec3From(
        harthmereBusinessOutpostFrontPosition(outpost, {
          lateral: HARTHMERE_OUTPOST_WORK_STATION_LATERAL,
        })
      ),
      source: "business_outpost_work_station",
    });
  }

  return targets;
}

let cached: readonly HarthmereJobsBoardFieldTarget[] | undefined;

export function harthmereJobsBoardFieldTargets(): readonly HarthmereJobsBoardFieldTarget[] {
  if (!cached) {
    cached = buildFieldTargets();
  }
  return cached;
}

let byKey: ReadonlyMap<string, HarthmereJobsBoardFieldTarget> | undefined;

function fieldTargetIndex() {
  if (!byKey) {
    const index = new Map<string, HarthmereJobsBoardFieldTarget>();
    for (const target of harthmereJobsBoardFieldTargets()) {
      index.set(target.targetId, target);
      index.set(target.mapMarkerId, target);
    }
    byKey = index;
  }
  return byKey;
}

/** Resolve by either the requirement `targetId` or the `mapMarkerId`. */
export function harthmereJobsBoardFieldTargetForId(
  id: string | undefined
): HarthmereJobsBoardFieldTarget | undefined {
  return id ? fieldTargetIndex().get(id) : undefined;
}

export function isHarthmereJobsBoardFieldTargetId(id: string | undefined) {
  return Boolean(harthmereJobsBoardFieldTargetForId(id));
}

export function harthmereOutpostWorkStationForOutpost(outpostId: string) {
  return harthmereJobsBoardFieldTargetForId(
    harthmereOutpostWorkStationTargetId(outpostId)
  );
}

export function harthmereOutpostWorkStationAction(
  businessType: HarthmereEconomyBusinessTypeId | undefined
): string | undefined {
  return businessType ? OUTPOST_WORK_STATIONS[businessType]?.action : undefined;
}

/**
 * Validation used by tests + the jobs-board audit: every business template must
 * own exactly one physical target, every outpost exactly one work station, and
 * no two field targets may share an id, a marker id, or a position.
 */
export function validateHarthmereJobsBoardFieldTargets(): string[] {
  const errors: string[] = [];
  const targets = harthmereJobsBoardFieldTargets();

  for (const template of HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES) {
    const match = targets.find(
      (target) =>
        target.source === "business_template_target" &&
        target.targetId === template.targetId
    );
    if (!match) {
      errors.push(`${template.templateId}:missing_field_target`);
      continue;
    }
    if (match.mapMarkerId !== template.mapMarkerId) {
      errors.push(`${template.templateId}:marker_id_mismatch`);
    }
  }

  for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
    if (!harthmereOutpostWorkStationForOutpost(outpost.outpostId)) {
      errors.push(`${outpost.outpostId}:missing_work_station`);
    }
  }

  const seenTargetIds = new Set<string>();
  const seenMarkerIds = new Set<string>();
  const seenPositions = new Set<string>();
  for (const target of targets) {
    if (seenTargetIds.has(target.targetId)) {
      errors.push(`${target.targetId}:duplicate_target_id`);
    }
    seenTargetIds.add(target.targetId);
    if (seenMarkerIds.has(target.mapMarkerId)) {
      errors.push(`${target.mapMarkerId}:duplicate_marker_id`);
    }
    seenMarkerIds.add(target.mapMarkerId);
    const positionKey = target.position
      .map((value) => value.toFixed(2))
      .join(",");
    if (seenPositions.has(positionKey)) {
      errors.push(`${target.targetId}:duplicate_position`);
    }
    seenPositions.add(positionKey);
    if (!target.label.trim()) {
      errors.push(`${target.targetId}:blank_label`);
    }
    if (!target.position.every((value) => Number.isFinite(value))) {
      errors.push(`${target.targetId}:non_finite_position`);
    }
  }

  return errors;
}
