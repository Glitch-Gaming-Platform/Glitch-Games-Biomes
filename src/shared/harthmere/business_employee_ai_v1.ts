import type {
  HarthmereEconomyBusinessTypeIdV1,
  HarthmereEconomyEmployeeRecordV1,
} from "./mmo_economy_authority_v1";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1,
  getHarthmereBusinessMiniGameDefinitionV1,
  getHarthmereBusinessServiceAnimationCueSpecV1,
  type HarthmereBusinessCustomerNpcV1,
  type HarthmereBusinessServiceOfferV1,
} from "./business_customer_simulator_v1";
import {
  createHarthmereBusinessServiceProceduralClipV1,
  renderHarthmereBusinessServiceFrameSvgV1,
} from "./business_service_procedural_animations_v1";

export const HARTHMERE_BUSINESS_EMPLOYEE_AI_VERSION_V1 =
  "harthmere-business-employee-ai-v1" as const;

export type HarthmereBusinessEmployeeAutomationRoleV1 =
  | "front_counter"
  | "branch_manager"
  | "courier_dispatch"
  | "purchasing_manager"
  | "quality_inspector";

export type HarthmereBusinessEmployeeTaskKindV1 =
  | "counter_service"
  | "stock_fetch"
  | "production_station"
  | "quality_check"
  | "cleanup_route"
  | "dispatch_route"
  | "branch_management";

export type HarthmereBusinessEmployeeAssignableTaskIdV1 =
  | "front_counter"
  | "stock_runner"
  | "production_station"
  | "quality_check"
  | "cleanup_route"
  | "dispatch_runner"
  | "branch_manager"
  | "rest_required";

export type HarthmereBusinessEmployeeInterviewStyleV1 =
  | "friendly"
  | "skill_test"
  | "values"
  | "schedule";

export type HarthmereBusinessEmployeeCandidateStatusV1 =
  | "available"
  | "interviewed"
  | "offer_made"
  | "declined"
  | "hired"
  | "withdrawn";

export type HarthmereBusinessEmployeePersonalityV1 =
  | "warm"
  | "precise"
  | "practical"
  | "curious"
  | "steady"
  | "ambitious"
  | "shy"
  | "bold";

export type HarthmereBusinessEmployeeScheduleV1 =
  | "morning"
  | "midday"
  | "evening"
  | "flex";

export type HarthmereBusinessEmployeeAiStatusV1 =
  | "completed"
  | "recovered"
  | "failed";

export interface HarthmereBusinessEmployeeAiCellV1 {
  x: number;
  y: number;
}

export interface HarthmereBusinessEmployeeAiBlockedCellV1 extends HarthmereBusinessEmployeeAiCellV1 {
  reason?: string;
}

export interface HarthmereBusinessEmployeeAiNodeV1 extends HarthmereBusinessEmployeeAiCellV1 {
  nodeId: string;
  label: string;
}

export interface HarthmereBusinessEmployeeAiLayoutV1 {
  typeId: HarthmereEconomyBusinessTypeIdV1;
  width: number;
  height: number;
  nodes: {
    customerEntry: HarthmereBusinessEmployeeAiNodeV1;
    customerQueue: HarthmereBusinessEmployeeAiNodeV1;
    customerCounter: HarthmereBusinessEmployeeAiNodeV1;
    customerService: HarthmereBusinessEmployeeAiNodeV1;
    customerExit: HarthmereBusinessEmployeeAiNodeV1;
    employeeEntry: HarthmereBusinessEmployeeAiNodeV1;
    employeeCounter: HarthmereBusinessEmployeeAiNodeV1;
    stockRoom: HarthmereBusinessEmployeeAiNodeV1;
    prepStation: HarthmereBusinessEmployeeAiNodeV1;
    cleanupStation: HarthmereBusinessEmployeeAiNodeV1;
    dispatchDesk: HarthmereBusinessEmployeeAiNodeV1;
    branchDesk: HarthmereBusinessEmployeeAiNodeV1;
    employeeExit: HarthmereBusinessEmployeeAiNodeV1;
  };
  obstacles: HarthmereBusinessEmployeeAiBlockedCellV1[];
}

export interface HarthmereBusinessEmployeeTaskStepV1 {
  stepId: string;
  label: string;
  nodeId: keyof HarthmereBusinessEmployeeAiLayoutV1["nodes"];
  taskKind: HarthmereBusinessEmployeeTaskKindV1;
  animationCue?: string;
  requiredItems?: Record<string, number>;
}

export type HarthmereBusinessEmployeePhysicalActionKindV1 =
  | "walk_to_node"
  | "open_station"
  | "take_item"
  | "operate_station"
  | "carry_item"
  | "serve_customer"
  | "clean_station"
  | "log_result";

export interface HarthmereBusinessEmployeePhysicalActionV1 {
  actionId: string;
  kind: HarthmereBusinessEmployeePhysicalActionKindV1;
  nodeId: keyof HarthmereBusinessEmployeeAiLayoutV1["nodes"];
  objectRef: string;
  label: string;
  requiredBeforeComplete: boolean;
  animationCue?: string;
}

export interface HarthmereBusinessEmployeeTaskFlowV1 {
  typeId: HarthmereEconomyBusinessTypeIdV1;
  offerId: string;
  offerLabel: string;
  counterLabel: string;
  taskKind: HarthmereBusinessEmployeeTaskKindV1;
  animationCue: string;
  serviceNeed: string;
  steps: HarthmereBusinessEmployeeTaskStepV1[];
  physicalActions: HarthmereBusinessEmployeePhysicalActionV1[];
}

export interface HarthmereBusinessEmployeeAssignableTaskV1 {
  taskId: HarthmereBusinessEmployeeAssignableTaskIdV1;
  label: string;
  taskKind: HarthmereBusinessEmployeeTaskKindV1;
  cozyDescription: string;
}

export interface HarthmereBusinessEmployeeCandidateV1 {
  candidateId: string;
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeIdV1;
  displayName: string;
  role: string;
  skill: number;
  wageAskGoldPerDay: number;
  acceptedWageGoldPerDay?: number;
  personality: HarthmereBusinessEmployeePersonalityV1;
  schedule: HarthmereBusinessEmployeeScheduleV1;
  workplacePreference: string;
  preferredTaskId: HarthmereBusinessEmployeeAssignableTaskIdV1;
  status: HarthmereBusinessEmployeeCandidateStatusV1;
  interviewScore?: number;
  negotiationRounds: number;
  generatedAtMs: number;
  expiresAtMs: number;
  notes: string[];
}

export interface HarthmereBusinessEmployeeCandidateGenerationInputV1 {
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeIdV1;
  nowMs: number;
  count?: number;
  businessReputation?: number;
}

export interface HarthmereBusinessEmployeeNegotiationResultV1 {
  candidate: HarthmereBusinessEmployeeCandidateV1;
  accepted: boolean;
  warning?: string;
}

export interface HarthmereBusinessEmployeePathAuditV1 {
  ok: boolean;
  employeePathLength: number;
  customerPathLength: number;
  blockedCells: HarthmereBusinessEmployeeAiBlockedCellV1[];
  repathCount: number;
  sidestepCount: number;
  fallbackExitUsed: boolean;
  unreachableNodes: string[];
  warnings: string[];
}

export interface HarthmereBusinessEmployeeCollisionAuditV1 {
  collisionCount: number;
  resolvedCollisions: number;
  unresolvedCollisions: number;
  sharedCells: HarthmereBusinessEmployeeAiCellV1[];
  warnings: string[];
}

export interface HarthmereBusinessEmployeeTaskRunV1 {
  version: typeof HARTHMERE_BUSINESS_EMPLOYEE_AI_VERSION_V1;
  taskRunId: string;
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeIdV1;
  employeeId: string;
  employeeRole: string;
  assignedTask?: string;
  automationRole?: HarthmereBusinessEmployeeAutomationRoleV1;
  offerId: string;
  offerLabel: string;
  taskKind: HarthmereBusinessEmployeeTaskKindV1;
  status: HarthmereBusinessEmployeeAiStatusV1;
  failureReason?: string;
  moraleBefore: number;
  moraleAfter: number;
  qualityMultiplier: number;
  speedMultiplier: number;
  animationCue: string;
  animationFamily: string;
  animationFrameCount: number;
  animationSafety: {
    procedural: true;
    voxelSafe: true;
    noRootMotion: true;
    noSkeletonRequirement: true;
    rotationOnlyPose: true;
  };
  employeePath: HarthmereBusinessEmployeeAiCellV1[];
  customerPath: HarthmereBusinessEmployeeAiCellV1[];
  pathAudit: HarthmereBusinessEmployeePathAuditV1;
  collisionAudit: HarthmereBusinessEmployeeCollisionAuditV1;
  taskFlow: HarthmereBusinessEmployeeTaskFlowV1;
  warnings: string[];
  createdAtMs: number;
}

export interface HarthmereBusinessEmployeeTaskSimulationInputV1 {
  taskRunId?: string;
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeIdV1;
  employee: Pick<
    HarthmereEconomyEmployeeRecordV1,
    | "employeeId"
    | "role"
    | "skill"
    | "morale"
    | "loyalty"
    | "assignedTask"
    | "npcId"
    | "injuredUntilMs"
  >;
  offerId?: string;
  customerNpc?: HarthmereBusinessCustomerNpcV1;
  automationRole?: HarthmereBusinessEmployeeAutomationRoleV1;
  nowMs?: number;
  blockedCells?: HarthmereBusinessEmployeeAiBlockedCellV1[];
  forceSharedServiceLane?: boolean;
}

export interface HarthmereBusinessEmployeeAiVisualAuditV1 {
  ok: boolean;
  businessCount: number;
  roleCount: number;
  edgeCaseCount: number;
  renderedBusinessCells: number;
  renderedRoleCells: number;
  warnings: string[];
}

export const HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS_V1: Readonly<
  Record<
    HarthmereBusinessEmployeeAutomationRoleV1,
    {
      taskKind: HarthmereBusinessEmployeeTaskKindV1;
      stationNode: keyof HarthmereBusinessEmployeeAiLayoutV1["nodes"];
      actionLabel: string;
      serviceCapacityWeight: number;
    }
  >
> = Object.freeze({
  front_counter: {
    taskKind: "counter_service",
    stationNode: "employeeCounter",
    actionLabel: "Serve queued customers",
    serviceCapacityWeight: 3,
  },
  branch_manager: {
    taskKind: "branch_management",
    stationNode: "branchDesk",
    actionLabel: "Route branch work",
    serviceCapacityWeight: 4,
  },
  courier_dispatch: {
    taskKind: "dispatch_route",
    stationNode: "dispatchDesk",
    actionLabel: "Dispatch route tickets",
    serviceCapacityWeight: 2,
  },
  purchasing_manager: {
    taskKind: "stock_fetch",
    stationNode: "stockRoom",
    actionLabel: "Reorder stock",
    serviceCapacityWeight: 2,
  },
  quality_inspector: {
    taskKind: "quality_check",
    stationNode: "prepStation",
    actionLabel: "Inspect service quality",
    serviceCapacityWeight: 1,
  },
});

export const HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS_V1: Readonly<
  Record<HarthmereBusinessEmployeeAssignableTaskIdV1, HarthmereBusinessEmployeeAssignableTaskV1>
> = Object.freeze({
  front_counter: {
    taskId: "front_counter",
    label: "Front Counter",
    taskKind: "counter_service",
    cozyDescription: "Greet customers, read tickets, and complete handoffs.",
  },
  stock_runner: {
    taskId: "stock_runner",
    label: "Stock Runner",
    taskKind: "stock_fetch",
    cozyDescription: "Fetch ingredients, parts, forms, and shelf goods.",
  },
  production_station: {
    taskId: "production_station",
    label: "Production Station",
    taskKind: "production_station",
    cozyDescription: "Use the oven, bench, forge, lab, or prep table.",
  },
  quality_check: {
    taskId: "quality_check",
    label: "Quality Check",
    taskKind: "quality_check",
    cozyDescription: "Inspect work before the customer receives it.",
  },
  cleanup_route: {
    taskId: "cleanup_route",
    label: "Cleanup Route",
    taskKind: "cleanup_route",
    cozyDescription: "Reset counters, clear mess, and keep aisles open.",
  },
  dispatch_runner: {
    taskId: "dispatch_runner",
    label: "Dispatch Runner",
    taskKind: "dispatch_route",
    cozyDescription: "Move orders, tickets, parcels, and route notes.",
  },
  branch_manager: {
    taskId: "branch_manager",
    label: "Branch Manager",
    taskKind: "branch_management",
    cozyDescription: "Coordinate remote locations and daily branch reports.",
  },
  rest_required: {
    taskId: "rest_required",
    label: "Rest Required",
    taskKind: "cleanup_route",
    cozyDescription: "Recover from burnout before returning to service.",
  },
});

const BUSINESS_ORDER: HarthmereEconomyBusinessTypeIdV1[] = [
  "exotic_matter_refinery",
  "biome_maintenance_repair",
  "biome_design_studio",
  "security_defense_contractor",
  "portal_transit_company",
  "biome_farming_rare_foods",
  "weapons_tools",
  "magic_goods",
  "exploration_guide",
  "custom_home_property_development",
  "general_trader",
  "hunter_wild_meat",
  "medical_doctor",
  "teleport_owner",
  "waste_sanitation_cleanup",
  "repair_maintenance_person",
  "food_service_restaurant",
  "courier",
  "hospitality_inn_hotel_shelter",
];

const CANDIDATE_NAMES = [
  "Mira Button",
  "Tobin Lark",
  "Elsa Brim",
  "Jun Pip",
  "Nora Vale",
  "Kett Rowan",
  "Sima Wren",
  "Ollie Fern",
  "Paz Hearth",
  "Rill Stone",
] as const;

const PERSONALITIES: HarthmereBusinessEmployeePersonalityV1[] = [
  "warm",
  "precise",
  "practical",
  "curious",
  "steady",
  "ambitious",
  "shy",
  "bold",
];

const SCHEDULES: HarthmereBusinessEmployeeScheduleV1[] = [
  "morning",
  "midday",
  "evening",
  "flex",
];

const BASE_OBSTACLES: HarthmereBusinessEmployeeAiBlockedCellV1[] = [
  { x: 6, y: 3, reason: "service counter" },
  { x: 6, y: 4, reason: "service counter" },
  { x: 6, y: 5, reason: "service counter" },
  { x: 9, y: 2, reason: "prep table" },
  { x: 12, y: 5, reason: "stock shelf" },
  { x: 2, y: 2, reason: "display shelf" },
  { x: 3, y: 2, reason: "display shelf" },
];

export function normalizeHarthmereBusinessEmployeeTaskIdV1(
  value: string | undefined,
): HarthmereBusinessEmployeeAssignableTaskIdV1 | undefined {
  const text = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!text) return undefined;
  const aliases: Record<string, HarthmereBusinessEmployeeAssignableTaskIdV1> = {
    counter: "front_counter",
    front: "front_counter",
    front_counter: "front_counter",
    service_counter: "front_counter",
    stock: "stock_runner",
    stock_fetch: "stock_runner",
    stock_runner: "stock_runner",
    kitchen: "production_station",
    oven: "production_station",
    forge: "production_station",
    prep: "production_station",
    production: "production_station",
    production_station: "production_station",
    quality: "quality_check",
    quality_check: "quality_check",
    inspector: "quality_check",
    cleanup: "cleanup_route",
    cleanup_route: "cleanup_route",
    cleaning: "cleanup_route",
    dispatch: "dispatch_runner",
    route: "dispatch_runner",
    dispatch_runner: "dispatch_runner",
    branch: "branch_manager",
    branch_manager: "branch_manager",
    manager: "branch_manager",
    rest: "rest_required",
    rest_required: "rest_required",
  };
  return aliases[text];
}

export function validateHarthmereBusinessEmployeeAssignedTaskV1(
  value: string | undefined,
) {
  const taskId = normalizeHarthmereBusinessEmployeeTaskIdV1(value);
  return taskId ? HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS_V1[taskId] : undefined;
}

function roleForBusinessV1(typeId: HarthmereEconomyBusinessTypeIdV1, preferredTask: HarthmereBusinessEmployeeAssignableTaskIdV1) {
  if (preferredTask === "front_counter") return "Server";
  if (preferredTask === "stock_runner") return "Stock Runner";
  if (preferredTask === "cleanup_route") return "Cleaner";
  if (preferredTask === "dispatch_runner") return "Dispatcher";
  if (preferredTask === "branch_manager") return "Branch Manager";
  if (preferredTask === "quality_check") return "Quality Inspector";
  if (/doctor|medical/.test(typeId)) return "Clinic Aide";
  if (/restaurant|food/.test(typeId)) return "Line Cook";
  if (/weapons|repair/.test(typeId)) return "Bench Helper";
  if (/courier|portal|teleport/.test(typeId)) return "Route Clerk";
  return "Specialist";
}

function preferredTaskForBusinessV1(
  typeId: HarthmereEconomyBusinessTypeIdV1,
  index: number,
): HarthmereBusinessEmployeeAssignableTaskIdV1 {
  const definition = getHarthmereBusinessMiniGameDefinitionV1(typeId);
  const firstOffer = definition.offers[index % definition.offers.length];
  const kind = taskKindForOfferV1(firstOffer);
  const task = Object.values(HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS_V1).find((entry) => entry.taskKind === kind);
  return task?.taskId ?? "front_counter";
}

export function generateHarthmereBusinessEmployeeCandidatesV1(
  input: HarthmereBusinessEmployeeCandidateGenerationInputV1,
): HarthmereBusinessEmployeeCandidateV1[] {
  const count = Math.max(1, Math.min(6, Math.trunc(input.count ?? 3)));
  const businessIndex = Math.max(0, BUSINESS_ORDER.indexOf(input.typeId));
  const reputation = Math.max(0, Math.trunc(input.businessReputation ?? 0));
  return Array.from({ length: count }, (_, index) => {
    const seed = businessIndex * 11 + index * 5 + Math.floor(input.nowMs / 86_400_000);
    const preferredTaskId = preferredTaskForBusinessV1(input.typeId, index);
    const skill = Math.max(1, Math.min(5, 1 + (seed % 3) + Math.floor(reputation / 60)));
    const personality = PERSONALITIES[seed % PERSONALITIES.length];
    const schedule = SCHEDULES[(seed + businessIndex) % SCHEDULES.length];
    const role = roleForBusinessV1(input.typeId, preferredTaskId);
    const wageAskGoldPerDay = 8 + skill * 5 + (personality === "ambitious" ? 4 : 0);
    return {
      candidateId: `business_candidate_${input.businessId}_${index + 1}`,
      businessId: input.businessId,
      typeId: input.typeId,
      displayName: CANDIDATE_NAMES[seed % CANDIDATE_NAMES.length],
      role,
      skill,
      wageAskGoldPerDay,
      personality,
      schedule,
      workplacePreference: `${HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS_V1[preferredTaskId].label} with ${schedule} shifts`,
      preferredTaskId,
      status: "available",
      negotiationRounds: 0,
      generatedAtMs: input.nowMs,
      expiresAtMs: input.nowMs + 2 * 86_400_000,
      notes: [
        `${PERSONALITIES[seed % PERSONALITIES.length]} ${role.toLowerCase()}`,
        `Prefers ${HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS_V1[preferredTaskId].label}.`,
      ],
    };
  });
}

export function interviewHarthmereBusinessEmployeeCandidateV1(
  candidate: HarthmereBusinessEmployeeCandidateV1,
  style: HarthmereBusinessEmployeeInterviewStyleV1,
): HarthmereBusinessEmployeeCandidateV1 {
  const personalityMatch =
    (style === "friendly" && (candidate.personality === "warm" || candidate.personality === "shy")) ||
    (style === "skill_test" && (candidate.personality === "precise" || candidate.personality === "practical")) ||
    (style === "values" && (candidate.personality === "steady" || candidate.personality === "curious")) ||
    (style === "schedule" && candidate.schedule === "flex");
  const interviewScore = Math.max(1, Math.min(100, 42 + candidate.skill * 9 + (personalityMatch ? 18 : 4)));
  return {
    ...candidate,
    status: "interviewed",
    interviewScore,
    notes: [
      ...candidate.notes,
      `${style.replace(/_/g, " ")} interview scored ${interviewScore}.`,
    ],
  };
}

export function negotiateHarthmereBusinessEmployeeCandidateV1(
  candidate: HarthmereBusinessEmployeeCandidateV1,
  offeredWageGoldPerDay: number,
): HarthmereBusinessEmployeeNegotiationResultV1 {
  const offer = Math.max(1, Math.trunc(Number(offeredWageGoldPerDay) || 0));
  const minimumAccepted = Math.max(1, Math.floor(candidate.wageAskGoldPerDay * (candidate.personality === "ambitious" ? 0.95 : 0.82)));
  const rounds = candidate.negotiationRounds + 1;
  if (rounds >= 3) {
    return {
      candidate: {
        ...candidate,
        status: "withdrawn",
        negotiationRounds: rounds,
        notes: [...candidate.notes, "Withdrew after too many negotiation rounds."],
      },
      accepted: false,
      warning: "business_employee_candidate_withdrawn",
    };
  }
  if (offer < minimumAccepted) {
    return {
      candidate: {
        ...candidate,
        status: "declined",
        negotiationRounds: rounds,
        notes: [...candidate.notes, `Declined ${offer} gold per day.`],
      },
      accepted: false,
      warning: "business_employee_candidate_offer_too_low",
    };
  }
  return {
    candidate: {
      ...candidate,
      status: "offer_made",
      acceptedWageGoldPerDay: offer,
      negotiationRounds: rounds,
      notes: [...candidate.notes, `Accepted ${offer} gold per day.`],
    },
    accepted: true,
  };
}

function cellKeyV1(cell: HarthmereBusinessEmployeeAiCellV1) {
  return `${Math.trunc(cell.x)},${Math.trunc(cell.y)}`;
}

function sameCellV1(a: HarthmereBusinessEmployeeAiCellV1, b: HarthmereBusinessEmployeeAiCellV1) {
  return Math.trunc(a.x) === Math.trunc(b.x) && Math.trunc(a.y) === Math.trunc(b.y);
}

function uniqCellsV1(cells: HarthmereBusinessEmployeeAiBlockedCellV1[]) {
  const seen = new Set<string>();
  const out: HarthmereBusinessEmployeeAiBlockedCellV1[] = [];
  for (const cell of cells) {
    const key = cellKeyV1(cell);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x: Math.trunc(cell.x), y: Math.trunc(cell.y), reason: cell.reason });
  }
  return out;
}

function clampV1(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function taskKindForOfferV1(offer: HarthmereBusinessServiceOfferV1): HarthmereBusinessEmployeeTaskKindV1 {
  const cue = offer.animationCue.toLowerCase();
  const text = `${offer.offerId} ${offer.label} ${offer.description}`.toLowerCase();
  if (/clean|decontam|trash|barrel|waste|spray|certificate/.test(`${cue} ${text}`)) return "cleanup_route";
  if (/dispatch|route|parcel|delivery|escort|guard|alarm|runner/.test(`${cue} ${text}`)) return "dispatch_route";
  if (/inspect|quality|audit|safety|check|calibrate|diagnose|triage/.test(`${cue} ${text}`)) return "quality_check";
  if (/hammer|wrench|patch|mix|cook|forge|tune|stabilize|prepare|build|repair/.test(`${cue} ${text}`)) return "production_station";
  if (Object.keys(offer.requiredItems).length > 1) return "stock_fetch";
  return "counter_service";
}

function stationForTaskKindV1(taskKind: HarthmereBusinessEmployeeTaskKindV1): keyof HarthmereBusinessEmployeeAiLayoutV1["nodes"] {
  switch (taskKind) {
    case "cleanup_route": return "cleanupStation";
    case "dispatch_route": return "dispatchDesk";
    case "branch_management": return "branchDesk";
    case "production_station": return "prepStation";
    case "quality_check": return "prepStation";
    case "stock_fetch": return "stockRoom";
    case "counter_service": return "employeeCounter";
  }
}

function primaryStationObjectForBusinessV1(typeId: HarthmereEconomyBusinessTypeIdV1, taskKind: HarthmereBusinessEmployeeTaskKindV1) {
  const stationByBusiness: Partial<Record<HarthmereEconomyBusinessTypeIdV1, string>> = {
    exotic_matter_refinery: "sealed stabilizer bench",
    biome_maintenance_repair: "anchor diagnostic ring",
    biome_design_studio: "sample board table",
    security_defense_contractor: "threat board desk",
    portal_transit_company: "fare gate console",
    biome_farming_rare_foods: "harvest scale",
    weapons_tools: "forge service bench",
    magic_goods: "ward tray",
    exploration_guide: "route map table",
    custom_home_property_development: "permit blueprint desk",
    general_trader: "stock shelf",
    hunter_wild_meat: "cold wrap counter",
    medical_doctor: "treatment cot",
    teleport_owner: "pad key terminal",
    waste_sanitation_cleanup: "seal-and-spray station",
    repair_maintenance_person: "fixture repair bench",
    food_service_restaurant: "oven and plating pass",
    courier: "parcel scale",
    hospitality_inn_hotel_shelter: "room ledger desk",
  };
  if (taskKind === "dispatch_route") return "dispatch board";
  if (taskKind === "quality_check") return "inspection checklist";
  if (taskKind === "stock_fetch") return "labeled stock shelf";
  if (taskKind === "cleanup_route") return "cleanup bin";
  if (taskKind === "branch_management") return "branch ledger";
  return stationByBusiness[typeId] ?? "service station";
}

function carriedItemForOfferV1(offer: HarthmereBusinessServiceOfferV1) {
  const firstRequired = Object.keys(offer.requiredItems)[0];
  if (firstRequired) return firstRequired.replace(/_/g, " ");
  return offer.label.toLowerCase();
}

function createPhysicalActionsForFlowV1(
  typeId: HarthmereEconomyBusinessTypeIdV1,
  offer: HarthmereBusinessServiceOfferV1,
  taskKind: HarthmereBusinessEmployeeTaskKindV1,
  stationNode: keyof HarthmereBusinessEmployeeAiLayoutV1["nodes"],
): HarthmereBusinessEmployeePhysicalActionV1[] {
  const stationObject = primaryStationObjectForBusinessV1(typeId, taskKind);
  const carriedItem = carriedItemForOfferV1(offer);
  const baseActions: HarthmereBusinessEmployeePhysicalActionV1[] = [
    {
      actionId: "walk_to_counter",
      kind: "walk_to_node",
      nodeId: "employeeCounter",
      objectRef: "customer ticket",
      label: "Walk to the counter and read the customer ticket.",
      requiredBeforeComplete: true,
    },
    {
      actionId: "walk_to_stock",
      kind: "walk_to_node",
      nodeId: "stockRoom",
      objectRef: "stock room",
      label: "Walk to the stock room without crossing the customer queue.",
      requiredBeforeComplete: true,
    },
    {
      actionId: "take_required_item",
      kind: "take_item",
      nodeId: "stockRoom",
      objectRef: carriedItem,
      label: `Take ${carriedItem} for the order.`,
      requiredBeforeComplete: true,
    },
    {
      actionId: "walk_to_station",
      kind: "walk_to_node",
      nodeId: stationNode,
      objectRef: stationObject,
      label: `Walk to the ${stationObject}.`,
      requiredBeforeComplete: true,
    },
    {
      actionId: "open_station",
      kind: "open_station",
      nodeId: stationNode,
      objectRef: stationObject,
      label: `Open or ready the ${stationObject}.`,
      requiredBeforeComplete: true,
    },
    {
      actionId: "operate_station",
      kind: "operate_station",
      nodeId: stationNode,
      objectRef: stationObject,
      label: offer.label,
      requiredBeforeComplete: true,
      animationCue: offer.animationCue,
    },
    {
      actionId: "carry_to_counter",
      kind: "carry_item",
      nodeId: "employeeCounter",
      objectRef: carriedItem,
      label: `Carry ${carriedItem} back to the counter.`,
      requiredBeforeComplete: true,
      animationCue: offer.animationCue,
    },
    {
      actionId: "serve_customer",
      kind: "serve_customer",
      nodeId: "employeeCounter",
      objectRef: offer.offerId,
      label: "Serve the customer and wait for their reaction.",
      requiredBeforeComplete: true,
      animationCue: offer.animationCue,
    },
    {
      actionId: "clean_station",
      kind: "clean_station",
      nodeId: "cleanupStation",
      objectRef: stationObject,
      label: `Clean and reset the ${stationObject}.`,
      requiredBeforeComplete: true,
    },
    {
      actionId: "log_result",
      kind: "log_result",
      nodeId: "employeeExit",
      objectRef: "shift ledger",
      label: "Log the result before taking the next customer.",
      requiredBeforeComplete: true,
    },
  ];
  if (typeId === "food_service_restaurant") {
    return baseActions.map((action) => {
      if (action.actionId === "open_station") return { ...action, objectRef: "oven", label: "Open the oven or warming station." };
      if (action.actionId === "operate_station") return { ...action, objectRef: "plating pass", label: "Cook, plate, and garnish the requested order." };
      if (action.actionId === "serve_customer") return { ...action, objectRef: "service plate", label: "Slide the plate to the customer only after plating is complete." };
      if (action.actionId === "clean_station") return { ...action, objectRef: "plating pass", label: "Wipe the plating pass and return the utensil." };
      return action;
    });
  }
  if (typeId === "medical_doctor") {
    return baseActions.map((action) => {
      if (action.actionId === "open_station") return { ...action, objectRef: "treatment cot", label: "Ready the treatment cot and clean wrap." };
      if (action.actionId === "operate_station") return { ...action, objectRef: "treatment kit", label: "Treat the case, verify symptoms, and mark the chart." };
      return action;
    });
  }
  if (typeId === "courier") {
    return baseActions.map((action) => {
      if (action.actionId === "open_station") return { ...action, objectRef: "parcel scale", label: "Open the parcel scale and proof slip." };
      if (action.actionId === "operate_station") return { ...action, objectRef: "route stamp", label: "Weigh, tag, stamp, and route the parcel." };
      return action;
    });
  }
  return baseActions;
}

function offerForSimulationV1(
  typeId: HarthmereEconomyBusinessTypeIdV1,
  offerId?: string,
  automationRole?: HarthmereBusinessEmployeeAutomationRoleV1,
) {
  const definition = getHarthmereBusinessMiniGameDefinitionV1(typeId);
  if (!definition) return undefined;
  if (offerId) return definition.offers.find((offer) => offer.offerId === offerId);
  if (automationRole) {
    const behavior = HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS_V1[automationRole];
    const preferred = definition.offers.find((offer) => taskKindForOfferV1(offer) === behavior.taskKind);
    if (preferred) return preferred;
  }
  return definition.offers[0];
}

function nodeV1(nodeId: string, label: string, x: number, y: number): HarthmereBusinessEmployeeAiNodeV1 {
  return { nodeId, label, x, y };
}

export function createHarthmereBusinessEmployeeAiLayoutV1(
  typeId: HarthmereEconomyBusinessTypeIdV1,
): HarthmereBusinessEmployeeAiLayoutV1 {
  const index = Math.max(0, BUSINESS_ORDER.indexOf(typeId));
  const serviceRow = 4 + (index % 2);
  return {
    typeId,
    width: 14,
    height: 10,
    nodes: {
      customerEntry: nodeV1("customer_entry", "Customer Entry", 1, 8),
      customerQueue: nodeV1("customer_queue", "Queue", 3, 7),
      customerCounter: nodeV1("customer_counter", "Customer Counter", 5, serviceRow),
      customerService: nodeV1("customer_service", "Service Spot", 5, Math.max(3, serviceRow - 1)),
      customerExit: nodeV1("customer_exit", "Customer Exit", 1, 8),
      employeeEntry: nodeV1("employee_entry", "Staff Entry", 12, 8),
      employeeCounter: nodeV1("employee_counter", "Staff Counter", 7, serviceRow),
      stockRoom: nodeV1("stock_room", "Stock Room", 11, 6),
      prepStation: nodeV1("prep_station", "Prep Station", 10, 3),
      cleanupStation: nodeV1("cleanup_station", "Cleanup Station", 10, 7),
      dispatchDesk: nodeV1("dispatch_desk", "Dispatch Desk", 8, 7),
      branchDesk: nodeV1("branch_desk", "Branch Desk", 11, 1),
      employeeExit: nodeV1("employee_exit", "Staff Exit", 12, 8),
    },
    obstacles: BASE_OBSTACLES,
  };
}

export function createHarthmereBusinessEmployeeTaskFlowV1(
  typeId: HarthmereEconomyBusinessTypeIdV1,
  offerId?: string,
  automationRole?: HarthmereBusinessEmployeeAutomationRoleV1,
): HarthmereBusinessEmployeeTaskFlowV1 {
  const definition = getHarthmereBusinessMiniGameDefinitionV1(typeId);
  if (!definition) {
    throw new Error(`business_employee_ai_missing_minigame:${typeId}`);
  }
  const offer = offerForSimulationV1(typeId, offerId, automationRole);
  if (!offer) {
    throw new Error(`business_employee_ai_missing_offer:${typeId}:${offerId ?? "default"}`);
  }
  const taskKind = automationRole
    ? HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS_V1[automationRole].taskKind
    : taskKindForOfferV1(offer);
  const stationNode = automationRole
    ? HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS_V1[automationRole].stationNode
    : stationForTaskKindV1(taskKind);
  return {
    typeId,
    offerId: offer.offerId,
    offerLabel: offer.label,
    counterLabel: definition.counterLabel,
    taskKind,
    animationCue: offer.animationCue,
    serviceNeed: offer.serviceNeed,
    steps: [
      {
        stepId: "read_ticket",
        label: `Read ${definition.counterLabel} request`,
        nodeId: "employeeCounter",
        taskKind: "counter_service",
      },
      {
        stepId: "fetch_required_stock",
        label: "Fetch required stock",
        nodeId: "stockRoom",
        taskKind: "stock_fetch",
        requiredItems: offer.requiredItems,
      },
      {
        stepId: "perform_service",
        label: automationRole
          ? HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS_V1[automationRole].actionLabel
          : offer.label,
        nodeId: stationNode,
        taskKind,
        animationCue: offer.animationCue,
      },
      {
        stepId: "handoff",
        label: "Serve the customer",
        nodeId: "employeeCounter",
        taskKind: "counter_service",
        animationCue: offer.animationCue,
      },
      {
        stepId: "reset_station",
        label: "Reset station",
        nodeId: "employeeExit",
        taskKind: "cleanup_route",
      },
    ],
    physicalActions: createPhysicalActionsForFlowV1(typeId, offer, taskKind, stationNode),
  };
}

function walkableV1(
  layout: HarthmereBusinessEmployeeAiLayoutV1,
  cell: HarthmereBusinessEmployeeAiCellV1,
  blocked: Set<string>,
) {
  const x = Math.trunc(cell.x);
  const y = Math.trunc(cell.y);
  if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) return false;
  return !blocked.has(`${x},${y}`);
}

function neighborsV1(cell: HarthmereBusinessEmployeeAiCellV1) {
  return [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ];
}

function nearestWalkableTargetV1(
  layout: HarthmereBusinessEmployeeAiLayoutV1,
  target: HarthmereBusinessEmployeeAiCellV1,
  blocked: Set<string>,
) {
  if (walkableV1(layout, target, blocked)) return target;
  const queue = [target];
  const seen = new Set<string>([cellKeyV1(target)]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of neighborsV1(current)) {
      const key = cellKeyV1(next);
      if (seen.has(key)) continue;
      seen.add(key);
      if (walkableV1(layout, next, blocked)) return next;
      if (next.x >= -1 && next.y >= -1 && next.x <= layout.width && next.y <= layout.height) queue.push(next);
    }
  }
  return undefined;
}

function findPathV1(
  layout: HarthmereBusinessEmployeeAiLayoutV1,
  start: HarthmereBusinessEmployeeAiCellV1,
  target: HarthmereBusinessEmployeeAiCellV1,
  blocked: Set<string>,
) {
  const adjustedTarget = nearestWalkableTargetV1(layout, target, blocked);
  if (!adjustedTarget || !walkableV1(layout, start, blocked)) return undefined;
  const startKey = cellKeyV1(start);
  const targetKey = cellKeyV1(adjustedTarget);
  const queue = [start];
  const cameFrom = new Map<string, string | undefined>([[startKey, undefined]]);
  while (queue.length) {
    const current = queue.shift()!;
    const currentKey = cellKeyV1(current);
    if (currentKey === targetKey) {
      const path: HarthmereBusinessEmployeeAiCellV1[] = [];
      let key: string | undefined = currentKey;
      while (key) {
        const [x, y] = key.split(",").map((part) => Number(part));
        path.push({ x, y });
        key = cameFrom.get(key);
      }
      return path.reverse();
    }
    for (const next of neighborsV1(current)) {
      const key = cellKeyV1(next);
      if (cameFrom.has(key) || !walkableV1(layout, next, blocked)) continue;
      cameFrom.set(key, currentKey);
      queue.push(next);
    }
  }
  return undefined;
}

function routePathV1(
  layout: HarthmereBusinessEmployeeAiLayoutV1,
  route: HarthmereBusinessEmployeeAiCellV1[],
  blocked: Set<string>,
  audit: HarthmereBusinessEmployeePathAuditV1,
) {
  const path: HarthmereBusinessEmployeeAiCellV1[] = [];
  let from = route[0];
  for (let i = 1; i < route.length; i += 1) {
    const to = route[i];
    const segment = findPathV1(layout, from, to, blocked);
    if (!segment) {
      audit.unreachableNodes.push(`${cellKeyV1(from)}->${cellKeyV1(to)}`);
      audit.fallbackExitUsed = true;
      const fallback = findPathV1(layout, from, layout.nodes.employeeExit, blocked) ?? [from];
      if (path.length && sameCellV1(path[path.length - 1], fallback[0])) path.push(...fallback.slice(1));
      else path.push(...fallback);
      from = path[path.length - 1] ?? from;
      continue;
    }
    if (!sameCellV1(segment[segment.length - 1], to)) audit.repathCount += 1;
    if (path.length && sameCellV1(path[path.length - 1], segment[0])) path.push(...segment.slice(1));
    else path.push(...segment);
    from = segment[segment.length - 1];
  }
  return path;
}

function sidestepForCellV1(
  layout: HarthmereBusinessEmployeeAiLayoutV1,
  cell: HarthmereBusinessEmployeeAiCellV1,
  blocked: Set<string>,
  avoided: HarthmereBusinessEmployeeAiCellV1[],
) {
  const avoidedKeys = new Set(avoided.map(cellKeyV1));
  return neighborsV1(cell).find((candidate) => walkableV1(layout, candidate, blocked) && !avoidedKeys.has(cellKeyV1(candidate)));
}

function resolveCollisionsV1(
  layout: HarthmereBusinessEmployeeAiLayoutV1,
  employeePath: HarthmereBusinessEmployeeAiCellV1[],
  customerPath: HarthmereBusinessEmployeeAiCellV1[],
  blocked: Set<string>,
  audit: HarthmereBusinessEmployeePathAuditV1,
): { employeePath: HarthmereBusinessEmployeeAiCellV1[]; collisionAudit: HarthmereBusinessEmployeeCollisionAuditV1 } {
  const out = employeePath.slice();
  const sharedCells: HarthmereBusinessEmployeeAiCellV1[] = [];
  const collisionAudit: HarthmereBusinessEmployeeCollisionAuditV1 = {
    collisionCount: 0,
    resolvedCollisions: 0,
    unresolvedCollisions: 0,
    sharedCells,
    warnings: [],
  };
  const maxSteps = Math.max(out.length, customerPath.length);
  for (let i = 0; i < maxSteps; i += 1) {
    const employeeCell = out[Math.min(i, out.length - 1)];
    const customerCell = customerPath[Math.min(i, customerPath.length - 1)];
    const previousEmployee = out[Math.max(0, Math.min(i - 1, out.length - 1))];
    const previousCustomer = customerPath[Math.max(0, Math.min(i - 1, customerPath.length - 1))];
    const collides = sameCellV1(employeeCell, customerCell) ||
      (i > 0 && sameCellV1(employeeCell, previousCustomer) && sameCellV1(customerCell, previousEmployee));
    if (!collides) continue;
    collisionAudit.collisionCount += 1;
    sharedCells.push({ x: employeeCell.x, y: employeeCell.y });
    const sidestep = sidestepForCellV1(layout, previousEmployee, blocked, [customerCell, previousCustomer]);
    if (sidestep && audit.sidestepCount < 8) {
      out.splice(i, 0, sidestep);
      audit.sidestepCount += 1;
      collisionAudit.resolvedCollisions += 1;
      continue;
    }
    collisionAudit.unresolvedCollisions += 1;
    collisionAudit.warnings.push("employee_collision_unresolved:fallback_exit");
    audit.fallbackExitUsed = true;
    const exitPath = findPathV1(layout, employeeCell, layout.nodes.employeeExit, blocked);
    if (exitPath) out.splice(i, out.length - i, ...exitPath);
    break;
  }
  return { employeePath: out, collisionAudit };
}

function employeeNpcForAnimationV1(employee: HarthmereBusinessEmployeeTaskSimulationInputV1["employee"]) {
  const role = `${employee.role} ${employee.assignedTask ?? ""}`.toLowerCase();
  const base = HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1[(Math.max(0, Math.trunc(employee.skill ?? 1)) * 7) % HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length];
  const outfit = /cook|food|server|kitchen/.test(role)
    ? "white service apron"
    : /guard|security|patrol/.test(role)
      ? "red guard service coat"
      : /doctor|clinic|aide|medical/.test(role)
        ? "green clinic assistant wrap"
        : /courier|dispatch|runner/.test(role)
          ? "blue courier work vest"
          : /smith|forge|repair|tool/.test(role)
            ? "charcoal work apron"
            : "brown staff utility coat";
  return {
    ...base,
    npcId: employee.npcId ?? `generated_employee_visual:${employee.employeeId}`,
    displayName: `${employee.role || "Worker"} Staff`,
    appearance: {
      ...base.appearance,
      outfit,
      accessory: /manager|quality|inspect/.test(role) ? "brass checklist pin" : "service tool badge",
      voice: employee.morale < 30 ? "tired practical voice" : "steady helpful voice",
    },
  } satisfies HarthmereBusinessCustomerNpcV1;
}

function customerNpcForBusinessV1(typeId: HarthmereEconomyBusinessTypeIdV1, override?: HarthmereBusinessCustomerNpcV1) {
  if (override) return override;
  return HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.find((npc) => npc.businessPreferences.includes(typeId)) ??
    HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1[0];
}

function statusFromAuditsV1(
  morale: number,
  injured: boolean,
  pathAudit: HarthmereBusinessEmployeePathAuditV1,
  collisionAudit: HarthmereBusinessEmployeeCollisionAuditV1,
) {
  if (injured) return { status: "failed" as const, reason: "employee_injured" };
  if (morale < 15) return { status: "failed" as const, reason: "employee_morale_too_low" };
  if (!pathAudit.ok || collisionAudit.unresolvedCollisions > 0) {
    return { status: "failed" as const, reason: "employee_path_unresolved" };
  }
  if (morale < 30 || pathAudit.repathCount > 0 || pathAudit.sidestepCount > 0 || pathAudit.fallbackExitUsed) {
    return { status: "recovered" as const, reason: undefined };
  }
  return { status: "completed" as const, reason: undefined };
}

export function simulateHarthmereBusinessEmployeeTaskRunV1(
  input: HarthmereBusinessEmployeeTaskSimulationInputV1,
): HarthmereBusinessEmployeeTaskRunV1 {
  const nowMs = Math.max(0, Math.trunc(input.nowMs ?? 0));
  const layout = createHarthmereBusinessEmployeeAiLayoutV1(input.typeId);
  const flow = createHarthmereBusinessEmployeeTaskFlowV1(input.typeId, input.offerId, input.automationRole);
  const blockedCells = uniqCellsV1([...(layout.obstacles ?? []), ...(input.blockedCells ?? [])]);
  const blocked = new Set(blockedCells.map(cellKeyV1));
  const pathAudit: HarthmereBusinessEmployeePathAuditV1 = {
    ok: true,
    employeePathLength: 0,
    customerPathLength: 0,
    blockedCells,
    repathCount: 0,
    sidestepCount: 0,
    fallbackExitUsed: false,
    unreachableNodes: [],
    warnings: [],
  };
  const station = stationForTaskKindV1(flow.taskKind);
  const employeeRoute = [
    layout.nodes.employeeEntry,
    layout.nodes.employeeCounter,
    layout.nodes.stockRoom,
    layout.nodes[station],
    layout.nodes.employeeCounter,
    layout.nodes.employeeExit,
  ];
  const customerCounter = input.forceSharedServiceLane
    ? layout.nodes.employeeCounter
    : layout.nodes.customerCounter;
  const customerRoute = [
    layout.nodes.customerEntry,
    layout.nodes.customerQueue,
    customerCounter,
    layout.nodes.customerService,
    layout.nodes.customerExit,
  ];
  let employeePath = routePathV1(layout, employeeRoute, blocked, pathAudit);
  let customerPath = routePathV1(layout, customerRoute, blocked, pathAudit);
  if (input.forceSharedServiceLane && employeePath[8] && customerPath[8]) {
    customerPath = customerPath.slice();
    customerPath[8] = { ...employeePath[8] };
  }
  const collision = resolveCollisionsV1(layout, employeePath, customerPath, blocked, pathAudit);
  employeePath = collision.employeePath;
  pathAudit.employeePathLength = employeePath.length;
  pathAudit.customerPathLength = customerPath.length;
  pathAudit.ok = pathAudit.unreachableNodes.length === 0 && collision.collisionAudit.unresolvedCollisions === 0;
  if (!pathAudit.ok) pathAudit.warnings.push("employee_path_requires_manual_review");
  const moraleBefore = Math.round(clampV1(input.employee.morale, 0, 100, 50));
  const injured = typeof input.employee.injuredUntilMs === "number" && input.employee.injuredUntilMs > nowMs;
  const status = statusFromAuditsV1(moraleBefore, injured, pathAudit, collision.collisionAudit);
  const warnings = [
    ...pathAudit.warnings,
    ...collision.collisionAudit.warnings,
  ];
  if (moraleBefore < 30) warnings.push("employee_low_morale_slow_service");
  if (status.reason === "employee_morale_too_low") warnings.push("employee_morale_failure:rest_required");
  if (status.reason === "employee_injured") warnings.push("employee_unavailable:injured");
  const offer = offerForSimulationV1(input.typeId, flow.offerId, input.automationRole)!;
  const clip = createHarthmereBusinessServiceProceduralClipV1({
    cueId: offer.animationCue,
    ownerNpc: employeeNpcForAnimationV1(input.employee),
    customerNpc: customerNpcForBusinessV1(input.typeId, input.customerNpc),
    sampleCount: 5,
  });
  const qualityPenalty = moraleBefore < 30 ? 0.25 : 0;
  const pathPenalty = pathAudit.sidestepCount > 0 || pathAudit.repathCount > 0 ? 0.1 : 0;
  const statusPenalty = status.status === "failed" ? 0.55 : status.status === "recovered" ? 0.15 : 0;
  const qualityMultiplier = Math.max(0.1, Number((1 - qualityPenalty - pathPenalty - statusPenalty).toFixed(2)));
  const speedMultiplier = Math.max(0.25, Number((1 + (input.employee.skill - 1) * 0.05 - (pathAudit.sidestepCount + pathAudit.repathCount) * 0.04 - (moraleBefore < 30 ? 0.2 : 0)).toFixed(2)));
  return {
    version: HARTHMERE_BUSINESS_EMPLOYEE_AI_VERSION_V1,
    taskRunId: input.taskRunId ?? `business_employee_task_${nowMs || 1}`,
    businessId: input.businessId,
    typeId: input.typeId,
    employeeId: input.employee.employeeId,
    employeeRole: input.employee.role,
    assignedTask: input.employee.assignedTask,
    automationRole: input.automationRole,
    offerId: offer.offerId,
    offerLabel: offer.label,
    taskKind: flow.taskKind,
    status: status.status,
    failureReason: status.reason,
    moraleBefore,
    moraleAfter: Math.round(clampV1(
      moraleBefore + (status.status === "completed" ? 2 : status.status === "recovered" ? -1 : -8),
      0,
      100,
      moraleBefore,
    )),
    qualityMultiplier,
    speedMultiplier,
    animationCue: offer.animationCue,
    animationFamily: clip.family,
    animationFrameCount: clip.frames.length,
    animationSafety: {
      procedural: true,
      voxelSafe: true,
      noRootMotion: true,
      noSkeletonRequirement: true,
      rotationOnlyPose: true,
    },
    employeePath,
    customerPath,
    pathAudit,
    collisionAudit: collision.collisionAudit,
    taskFlow: flow,
    warnings,
    createdAtMs: nowMs,
  };
}

function escapeV1(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderGridSvgV1(run: HarthmereBusinessEmployeeTaskRunV1, width = 336, height = 252) {
  const layout = createHarthmereBusinessEmployeeAiLayoutV1(run.typeId);
  const cellW = width / layout.width;
  const cellH = height / layout.height;
  const blocked = new Set(run.pathAudit.blockedCells.map(cellKeyV1));
  const nodeCells = Object.values(layout.nodes);
  const nodeLookup = new Map(nodeCells.map((node) => [cellKeyV1(node), node]));
  const pathPoints = (path: HarthmereBusinessEmployeeAiCellV1[]) =>
    path.map((cell) => `${cell.x * cellW + cellW / 2},${cell.y * cellH + cellH / 2}`).join(" ");
  const cells: string[] = [];
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      const key = `${x},${y}`;
      const node = nodeLookup.get(key);
      const fill = blocked.has(key) ? "#2d3341" : node ? "#eef4ff" : "#f8f6ef";
      const stroke = blocked.has(key) ? "#151922" : "#ded8c8";
      cells.push(`<rect x="${x * cellW}" y="${y * cellH}" width="${cellW}" height="${cellH}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`);
      if (node) cells.push(`<circle cx="${x * cellW + cellW / 2}" cy="${y * cellH + cellH / 2}" r="4" fill="#2f6f91"/>`);
    }
  }
  const collisions = run.collisionAudit.sharedCells.map((cell) =>
    `<circle cx="${cell.x * cellW + cellW / 2}" cy="${cell.y * cellH + cellH / 2}" r="7" fill="none" stroke="#d94f45" stroke-width="3"/>`,
  ).join("");
  return `<svg class="staff-path" data-task-run-id="${escapeV1(run.taskRunId)}" data-status="${run.status}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Staff path for ${escapeV1(run.typeId)}">
    <rect width="${width}" height="${height}" fill="#f8f6ef"/>
    ${cells.join("")}
    <polyline points="${pathPoints(run.customerPath)}" fill="none" stroke="#cf7f2a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="${pathPoints(run.employeePath)}" fill="none" stroke="#286bb5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${collisions}
    <circle cx="${run.customerPath[0].x * cellW + cellW / 2}" cy="${run.customerPath[0].y * cellH + cellH / 2}" r="6" fill="#cf7f2a"/>
    <circle cx="${run.employeePath[0].x * cellW + cellW / 2}" cy="${run.employeePath[0].y * cellH + cellH / 2}" r="6" fill="#286bb5"/>
  </svg>`;
}

function visualEmployeeFixtureV1(
  role: string,
  overrides: Partial<Pick<HarthmereEconomyEmployeeRecordV1, "morale" | "skill" | "loyalty" | "assignedTask" | "injuredUntilMs">> = {},
) {
  return {
    employeeId: `visual_employee_${role.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
    businessId: "visual_business",
    npcId: `visual_npc_${role}`,
    role,
    skill: overrides.skill ?? 3,
    wageGoldPerDay: 12,
    morale: overrides.morale ?? 70,
    loyalty: overrides.loyalty ?? 55,
    assignedTask: overrides.assignedTask,
    hiredAtMs: 0,
    lastPaidAtMs: 0,
    injuredUntilMs: overrides.injuredUntilMs,
  } satisfies HarthmereEconomyEmployeeRecordV1;
}

function renderRunCellV1(title: string, run: HarthmereBusinessEmployeeTaskRunV1) {
  const clip = createHarthmereBusinessServiceProceduralClipV1({
    cueId: run.animationCue,
    ownerNpc: employeeNpcForAnimationV1({
      employeeId: run.employeeId,
      role: run.employeeRole,
      skill: 3,
      morale: run.moraleBefore,
      loyalty: 50,
      assignedTask: run.assignedTask,
      npcId: run.employeeId,
    }),
    customerNpc: customerNpcForBusinessV1(run.typeId),
    sampleCount: 3,
  });
  const frame = clip.frames[Math.floor(clip.frames.length / 2)];
  return `<section class="audit-cell" data-status="${run.status}" data-type-id="${escapeV1(run.typeId)}" data-task-kind="${run.taskKind}">
    <h3>${escapeV1(title)}</h3>
    <p>${escapeV1(run.offerLabel)} · ${escapeV1(run.taskKind.replace(/_/g, " "))} · ${escapeV1(run.status)}</p>
    ${renderGridSvgV1(run)}
    <div class="cell-meta"><span>staff ${run.employeePath.length} steps</span><span>customer ${run.customerPath.length} steps</span><span>${run.animationFrameCount} frames</span></div>
    <div class="pose-frame">${renderHarthmereBusinessServiceFrameSvgV1(clip, frame)}</div>
  </section>`;
}

export function renderHarthmereBusinessEmployeeAiVisualAuditHtmlV1() {
  const businessRuns = BUSINESS_ORDER.map((typeId, index) => simulateHarthmereBusinessEmployeeTaskRunV1({
    taskRunId: `visual_business_${typeId}`,
    businessId: `visual_business_${typeId}`,
    typeId,
    employee: visualEmployeeFixtureV1(index % 3 === 0 ? "Server" : index % 3 === 1 ? "Specialist" : "Runner"),
    nowMs: 1_800_000_000_000 + index,
  }));
  const roleRuns = (Object.keys(HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS_V1) as HarthmereBusinessEmployeeAutomationRoleV1[]).map((role, index) => simulateHarthmereBusinessEmployeeTaskRunV1({
    taskRunId: `visual_role_${role}`,
    businessId: "visual_role_business",
    typeId: "food_service_restaurant",
    employee: visualEmployeeFixtureV1(role, { skill: 2 + index }),
    automationRole: role,
    nowMs: 1_800_000_010_000 + index,
  }));
  const edgeRuns = [
    simulateHarthmereBusinessEmployeeTaskRunV1({
      taskRunId: "visual_edge_blocked_counter",
      businessId: "visual_edge_business",
      typeId: "repair_maintenance_person",
      employee: visualEmployeeFixtureV1("Fix-It Apprentice"),
      blockedCells: [{ x: 10, y: 3, reason: "customer dropped crate" }],
      nowMs: 1_800_000_020_000,
    }),
    simulateHarthmereBusinessEmployeeTaskRunV1({
      taskRunId: "visual_edge_shared_lane",
      businessId: "visual_edge_business",
      typeId: "courier",
      employee: visualEmployeeFixtureV1("Dispatch Runner"),
      forceSharedServiceLane: true,
      nowMs: 1_800_000_020_001,
    }),
    simulateHarthmereBusinessEmployeeTaskRunV1({
      taskRunId: "visual_edge_low_morale",
      businessId: "visual_edge_business",
      typeId: "medical_doctor",
      employee: visualEmployeeFixtureV1("Clinic Aide", { morale: 8 }),
      nowMs: 1_800_000_020_002,
    }),
  ];
  const audit = validateHarthmereBusinessEmployeeAiVisualAuditV1();
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Business Employee AI Visual Audit</title>
  <style>
    body { margin: 0; padding: 24px; font-family: Inter, system-ui, sans-serif; background: #0c1018; color: #e8eefc; }
    h1 { font-size: 30px; margin: 0 0 10px; }
    h2 { font-size: 19px; margin: 28px 0 12px; }
    h3 { font-size: 14px; margin: 0 0 4px; text-transform: capitalize; }
    p { margin: 0 0 10px; font-size: 12px; color: #aab5c8; }
    .summary,.legend { display: flex; gap: 10px; flex-wrap: wrap; margin: 14px 0 18px; font-size: 13px; }
    .summary span,.legend span { background: #141d2b; border: 1px solid #33415a; padding: 8px 10px; border-radius: 6px; }
    .legend .customer { color: #f4a85d; }
    .legend .staff { color: #7fb3ff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
    .audit-cell { background: #111722; border: 1px solid #33415a; border-radius: 8px; padding: 12px; overflow: hidden; box-shadow: 0 12px 28px rgba(0,0,0,.24); }
    .audit-cell[data-status="recovered"] { border-color: #7e6a32; }
    .audit-cell[data-status="failed"] { border-color: #7b3d42; }
    .staff-path { width: 100%; height: auto; border: 1px solid #36465d; background: #f8f6ef; border-radius: 4px; }
    .cell-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .cell-meta span { font-size: 11px; color: #cbd6e8; border: 1px solid #33415a; background: #151f2f; border-radius: 999px; padding: 4px 7px; }
    .pose-frame svg { width: 190px; height: 130px; margin-top: 8px; border: 1px solid #36465d; border-radius: 4px; background: #101722; }
    @media (max-width: 720px) { body { padding: 12px; } h1 { font-size: 24px; } }
  </style>
</head>
<body data-business-count="${BUSINESS_ORDER.length}" data-role-count="${roleRuns.length}" data-edge-count="${edgeRuns.length}" data-ok="${audit.ok}">
  <h1>Business Employee AI Visual Audit</h1>
  <div class="summary">
    <span>${BUSINESS_ORDER.length} business flows</span>
    <span>${roleRuns.length} automation roles</span>
    <span>${edgeRuns.length} edge cases</span>
    <span>${audit.warnings.length} warnings</span>
  </div>
  <div class="legend"><span class="customer">orange path: customer route</span><span class="staff">blue path: employee route</span><span>dark blocks: counters, walls, or placed objects</span></div>
  <h2>Per-Business Staff Task Flows</h2>
  <div class="grid" id="business-flow-atlas">${businessRuns.map((run) => renderRunCellV1(run.typeId.replace(/_/g, " "), run)).join("")}</div>
  <h2>Automation Role Behaviors</h2>
  <div class="grid" id="automation-role-atlas">${roleRuns.map((run) => renderRunCellV1(run.automationRole?.replace(/_/g, " ") ?? run.taskKind, run)).join("")}</div>
  <h2>Pathing And Morale Edge Cases</h2>
  <div class="grid" id="edge-case-atlas">${edgeRuns.map((run) => renderRunCellV1(run.taskRunId.replace(/visual_edge_/g, "").replace(/_/g, " "), run)).join("")}</div>
</body>
</html>`;
}

export function validateHarthmereBusinessEmployeeAiVisualAuditV1(): HarthmereBusinessEmployeeAiVisualAuditV1 {
  const warnings: string[] = [];
  const businessRuns = BUSINESS_ORDER.map((typeId, index) => simulateHarthmereBusinessEmployeeTaskRunV1({
    taskRunId: `audit_business_${typeId}`,
    businessId: `audit_business_${typeId}`,
    typeId,
    employee: visualEmployeeFixtureV1(`Audit Worker ${index}`, { skill: 3 }),
    nowMs: 1_800_000_000_000 + index,
  }));
  const roleRuns = (Object.keys(HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS_V1) as HarthmereBusinessEmployeeAutomationRoleV1[]).map((role, index) => simulateHarthmereBusinessEmployeeTaskRunV1({
    taskRunId: `audit_role_${role}`,
    businessId: "audit_role_business",
    typeId: "food_service_restaurant",
    employee: visualEmployeeFixtureV1(role, { skill: 2 + index }),
    automationRole: role,
    nowMs: 1_800_000_010_000 + index,
  }));
  const edgeRuns = [
    simulateHarthmereBusinessEmployeeTaskRunV1({
      taskRunId: "audit_edge_blocked",
      businessId: "audit_edge_business",
      typeId: "repair_maintenance_person",
      employee: visualEmployeeFixtureV1("Repair Staff"),
      blockedCells: [{ x: 10, y: 3, reason: "blocked prep station" }],
      nowMs: 1_800_000_020_000,
    }),
    simulateHarthmereBusinessEmployeeTaskRunV1({
      taskRunId: "audit_edge_collision",
      businessId: "audit_edge_business",
      typeId: "courier",
      employee: visualEmployeeFixtureV1("Courier Staff"),
      forceSharedServiceLane: true,
      nowMs: 1_800_000_020_001,
    }),
    simulateHarthmereBusinessEmployeeTaskRunV1({
      taskRunId: "audit_edge_morale",
      businessId: "audit_edge_business",
      typeId: "medical_doctor",
      employee: visualEmployeeFixtureV1("Clinic Staff", { morale: 8 }),
      nowMs: 1_800_000_020_002,
    }),
  ];
  for (const run of [...businessRuns, ...roleRuns]) {
    if (run.status === "failed") warnings.push(`employee_ai_failed:${run.taskRunId}:${run.failureReason ?? "unknown"}`);
    if (!getHarthmereBusinessServiceAnimationCueSpecV1(run.animationCue)) warnings.push(`employee_ai_missing_animation:${run.taskRunId}:${run.animationCue}`);
    if (!run.employeePath.length || !run.customerPath.length) warnings.push(`employee_ai_empty_path:${run.taskRunId}`);
    if (!run.animationSafety.noRootMotion || !run.animationSafety.voxelSafe) warnings.push(`employee_ai_unsafe_animation:${run.taskRunId}`);
    const svg = renderGridSvgV1(run);
    if (svg.includes("NaN") || svg.includes("undefined")) warnings.push(`employee_ai_bad_svg:${run.taskRunId}`);
  }
  const blocked = edgeRuns[0];
  if (blocked.pathAudit.repathCount < 1 && !blocked.pathAudit.fallbackExitUsed) warnings.push("employee_ai_edge_blocked_not_recovered");
  const collision = edgeRuns[1];
  if (collision.collisionAudit.collisionCount < 1 || collision.collisionAudit.resolvedCollisions < 1) warnings.push("employee_ai_edge_collision_not_resolved");
  const morale = edgeRuns[2];
  if (morale.status !== "failed" || morale.failureReason !== "employee_morale_too_low") warnings.push("employee_ai_edge_morale_not_failed");
  return {
    ok: warnings.length === 0,
    businessCount: BUSINESS_ORDER.length,
    roleCount: roleRuns.length,
    edgeCaseCount: edgeRuns.length,
    renderedBusinessCells: businessRuns.length,
    renderedRoleCells: roleRuns.length,
    warnings,
  };
}
