import type {
  HarthmereEconomyBusinessTypeId,
  HarthmereEconomyEmployeeRecord,
} from "./mmo_economy_authority";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPCS,
  getHarthmereBusinessMiniGameDefinition,
  getHarthmereBusinessServiceAnimationCueSpec,
  type HarthmereBusinessCustomerNpc,
  type HarthmereBusinessServiceOffer,
} from "./business_customer_simulator";
import {
  createHarthmereBusinessServiceProceduralClip,
  renderHarthmereBusinessServiceFrameSvg,
} from "./business_service_procedural_animations";
import { harthmereSublevelTradeBonus } from "./harthmere_sublevel_benefits";

export const HARTHMERE_BUSINESS_EMPLOYEE_AI_VERSION =
  "harthmere-business-employee-ai" as const;

export type HarthmereBusinessEmployeeAutomationRole =
  | "front_counter"
  | "branch_manager"
  | "courier_dispatch"
  | "purchasing_manager"
  | "quality_inspector";

export type HarthmereBusinessEmployeeTaskKind =
  | "counter_service"
  | "stock_fetch"
  | "production_station"
  | "quality_check"
  | "cleanup_route"
  | "dispatch_route"
  | "branch_management";

export type HarthmereBusinessEmployeeAssignableTaskId =
  | "front_counter"
  | "stock_runner"
  | "production_station"
  | "quality_check"
  | "cleanup_route"
  | "dispatch_runner"
  | "branch_manager"
  | "rest_required";

export type HarthmereBusinessEmployeeInterviewStyle =
  | "friendly"
  | "skill_test"
  | "values"
  | "schedule";

export type HarthmereBusinessEmployeeCandidateStatus =
  | "available"
  | "interviewed"
  | "offer_made"
  | "declined"
  | "hired"
  | "withdrawn";

export type HarthmereBusinessEmployeePersonality =
  | "warm"
  | "precise"
  | "practical"
  | "curious"
  | "steady"
  | "ambitious"
  | "shy"
  | "bold";

export type HarthmereBusinessEmployeeSchedule =
  | "morning"
  | "midday"
  | "evening"
  | "flex";

export type HarthmereBusinessEmployeeAiStatus =
  | "completed"
  | "recovered"
  | "failed";

export interface HarthmereBusinessEmployeeAiCell {
  x: number;
  y: number;
}

export interface HarthmereBusinessEmployeeAiBlockedCell extends HarthmereBusinessEmployeeAiCell {
  reason?: string;
}

export interface HarthmereBusinessEmployeeAiNode extends HarthmereBusinessEmployeeAiCell {
  nodeId: string;
  label: string;
}

export interface HarthmereBusinessEmployeeAiLayout {
  typeId: HarthmereEconomyBusinessTypeId;
  width: number;
  height: number;
  nodes: {
    customerEntry: HarthmereBusinessEmployeeAiNode;
    customerQueue: HarthmereBusinessEmployeeAiNode;
    customerCounter: HarthmereBusinessEmployeeAiNode;
    customerService: HarthmereBusinessEmployeeAiNode;
    customerExit: HarthmereBusinessEmployeeAiNode;
    employeeEntry: HarthmereBusinessEmployeeAiNode;
    employeeCounter: HarthmereBusinessEmployeeAiNode;
    stockRoom: HarthmereBusinessEmployeeAiNode;
    prepStation: HarthmereBusinessEmployeeAiNode;
    cleanupStation: HarthmereBusinessEmployeeAiNode;
    dispatchDesk: HarthmereBusinessEmployeeAiNode;
    branchDesk: HarthmereBusinessEmployeeAiNode;
    employeeExit: HarthmereBusinessEmployeeAiNode;
  };
  obstacles: HarthmereBusinessEmployeeAiBlockedCell[];
}

export interface HarthmereBusinessEmployeeTaskStep {
  stepId: string;
  label: string;
  nodeId: keyof HarthmereBusinessEmployeeAiLayout["nodes"];
  taskKind: HarthmereBusinessEmployeeTaskKind;
  animationCue?: string;
  requiredItems?: Record<string, number>;
}

export type HarthmereBusinessEmployeePhysicalActionKind =
  | "walk_to_node"
  | "open_station"
  | "take_item"
  | "operate_station"
  | "carry_item"
  | "serve_customer"
  | "clean_station"
  | "log_result";

export interface HarthmereBusinessEmployeePhysicalAction {
  actionId: string;
  kind: HarthmereBusinessEmployeePhysicalActionKind;
  nodeId: keyof HarthmereBusinessEmployeeAiLayout["nodes"];
  objectRef: string;
  label: string;
  requiredBeforeComplete: boolean;
  animationCue?: string;
}

export interface HarthmereBusinessEmployeeTaskFlow {
  typeId: HarthmereEconomyBusinessTypeId;
  offerId: string;
  offerLabel: string;
  counterLabel: string;
  taskKind: HarthmereBusinessEmployeeTaskKind;
  animationCue: string;
  serviceNeed: string;
  steps: HarthmereBusinessEmployeeTaskStep[];
  physicalActions: HarthmereBusinessEmployeePhysicalAction[];
}

export interface HarthmereBusinessEmployeeAssignableTask {
  taskId: HarthmereBusinessEmployeeAssignableTaskId;
  label: string;
  taskKind: HarthmereBusinessEmployeeTaskKind;
  cozyDescription: string;
}

export interface HarthmereBusinessEmployeeCandidate {
  candidateId: string;
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  displayName: string;
  role: string;
  skill: number;
  wageAskGoldPerDay: number;
  acceptedWageGoldPerDay?: number;
  personality: HarthmereBusinessEmployeePersonality;
  schedule: HarthmereBusinessEmployeeSchedule;
  workplacePreference: string;
  preferredTaskId: HarthmereBusinessEmployeeAssignableTaskId;
  status: HarthmereBusinessEmployeeCandidateStatus;
  interviewScore?: number;
  negotiationRounds: number;
  generatedAtMs: number;
  expiresAtMs: number;
  notes: string[];
}

export interface HarthmereBusinessEmployeeCandidateGenerationInput {
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  nowMs: number;
  count?: number;
  businessReputation?: number;
}

export interface HarthmereBusinessEmployeeNegotiationResult {
  candidate: HarthmereBusinessEmployeeCandidate;
  accepted: boolean;
  warning?: string;
}

export interface HarthmereBusinessEmployeePathAudit {
  ok: boolean;
  employeePathLength: number;
  customerPathLength: number;
  blockedCells: HarthmereBusinessEmployeeAiBlockedCell[];
  repathCount: number;
  sidestepCount: number;
  fallbackExitUsed: boolean;
  unreachableNodes: string[];
  warnings: string[];
}

export interface HarthmereBusinessEmployeeCollisionAudit {
  collisionCount: number;
  resolvedCollisions: number;
  unresolvedCollisions: number;
  sharedCells: HarthmereBusinessEmployeeAiCell[];
  warnings: string[];
}

export interface HarthmereBusinessEmployeeTaskRun {
  version: typeof HARTHMERE_BUSINESS_EMPLOYEE_AI_VERSION;
  taskRunId: string;
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  employeeId: string;
  employeeRole: string;
  assignedTask?: string;
  automationRole?: HarthmereBusinessEmployeeAutomationRole;
  offerId: string;
  offerLabel: string;
  taskKind: HarthmereBusinessEmployeeTaskKind;
  status: HarthmereBusinessEmployeeAiStatus;
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
  employeePath: HarthmereBusinessEmployeeAiCell[];
  customerPath: HarthmereBusinessEmployeeAiCell[];
  pathAudit: HarthmereBusinessEmployeePathAudit;
  collisionAudit: HarthmereBusinessEmployeeCollisionAudit;
  taskFlow: HarthmereBusinessEmployeeTaskFlow;
  warnings: string[];
  createdAtMs: number;
}

export interface HarthmereBusinessEmployeeTaskSimulationInput {
  taskRunId?: string;
  businessId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  employee: Pick<
    HarthmereEconomyEmployeeRecord,
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
  customerNpc?: HarthmereBusinessCustomerNpc;
  automationRole?: HarthmereBusinessEmployeeAutomationRole;
  nowMs?: number;
  blockedCells?: HarthmereBusinessEmployeeAiBlockedCell[];
  forceSharedServiceLane?: boolean;
}

export interface HarthmereBusinessEmployeeAiVisualAudit {
  ok: boolean;
  businessCount: number;
  roleCount: number;
  edgeCaseCount: number;
  renderedBusinessCells: number;
  renderedRoleCells: number;
  warnings: string[];
}

export const HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS: Readonly<
  Record<
    HarthmereBusinessEmployeeAutomationRole,
    {
      taskKind: HarthmereBusinessEmployeeTaskKind;
      stationNode: keyof HarthmereBusinessEmployeeAiLayout["nodes"];
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

export const HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS: Readonly<
  Record<HarthmereBusinessEmployeeAssignableTaskId, HarthmereBusinessEmployeeAssignableTask>
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

const BUSINESS_ORDER: HarthmereEconomyBusinessTypeId[] = [
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

const PERSONALITIES: HarthmereBusinessEmployeePersonality[] = [
  "warm",
  "precise",
  "practical",
  "curious",
  "steady",
  "ambitious",
  "shy",
  "bold",
];

const SCHEDULES: HarthmereBusinessEmployeeSchedule[] = [
  "morning",
  "midday",
  "evening",
  "flex",
];

const BASE_OBSTACLES: HarthmereBusinessEmployeeAiBlockedCell[] = [
  { x: 6, y: 3, reason: "service counter" },
  { x: 6, y: 4, reason: "service counter" },
  { x: 6, y: 5, reason: "service counter" },
  { x: 9, y: 2, reason: "prep table" },
  { x: 12, y: 5, reason: "stock shelf" },
  { x: 2, y: 2, reason: "display shelf" },
  { x: 3, y: 2, reason: "display shelf" },
];

export function normalizeHarthmereBusinessEmployeeTaskId(
  value: string | undefined,
): HarthmereBusinessEmployeeAssignableTaskId | undefined {
  const text = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!text) return undefined;
  const aliases: Record<string, HarthmereBusinessEmployeeAssignableTaskId> = {
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

export function validateHarthmereBusinessEmployeeAssignedTask(
  value: string | undefined,
) {
  const taskId = normalizeHarthmereBusinessEmployeeTaskId(value);
  return taskId ? HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS[taskId] : undefined;
}

function roleForBusiness(typeId: HarthmereEconomyBusinessTypeId, preferredTask: HarthmereBusinessEmployeeAssignableTaskId) {
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

function preferredTaskForBusiness(
  typeId: HarthmereEconomyBusinessTypeId,
  index: number,
): HarthmereBusinessEmployeeAssignableTaskId {
  const definition = getHarthmereBusinessMiniGameDefinition(typeId);
  const firstOffer = definition.offers[index % definition.offers.length];
  const kind = taskKindForOffer(firstOffer);
  const task = Object.values(HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS).find((entry) => entry.taskKind === kind);
  return task?.taskId ?? "front_counter";
}

export function generateHarthmereBusinessEmployeeCandidates(
  input: HarthmereBusinessEmployeeCandidateGenerationInput,
): HarthmereBusinessEmployeeCandidate[] {
  const count = Math.max(1, Math.min(6, Math.trunc(input.count ?? 3)));
  const businessIndex = Math.max(0, BUSINESS_ORDER.indexOf(input.typeId));
  const reputation = Math.max(0, Math.trunc(input.businessReputation ?? 0));
  return Array.from({ length: count }, (_, index) => {
    const seed = businessIndex * 11 + index * 5 + Math.floor(input.nowMs / 86_400_000);
    const preferredTaskId = preferredTaskForBusiness(input.typeId, index);
    const skill = Math.max(1, Math.min(5, 1 + (seed % 3) + Math.floor(reputation / 60)));
    const personality = PERSONALITIES[seed % PERSONALITIES.length];
    const schedule = SCHEDULES[(seed + businessIndex) % SCHEDULES.length];
    const role = roleForBusiness(input.typeId, preferredTaskId);
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
      workplacePreference: `${HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS[preferredTaskId].label} with ${schedule} shifts`,
      preferredTaskId,
      status: "available",
      negotiationRounds: 0,
      generatedAtMs: input.nowMs,
      expiresAtMs: input.nowMs + 2 * 86_400_000,
      notes: [
        `${PERSONALITIES[seed % PERSONALITIES.length]} ${role.toLowerCase()}`,
        `Prefers ${HARTHMERE_BUSINESS_EMPLOYEE_ASSIGNABLE_TASKS[preferredTaskId].label}.`,
      ],
    };
  });
}

export function interviewHarthmereBusinessEmployeeCandidate(
  candidate: HarthmereBusinessEmployeeCandidate,
  style: HarthmereBusinessEmployeeInterviewStyle,
): HarthmereBusinessEmployeeCandidate {
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

export function negotiateHarthmereBusinessEmployeeCandidate(
  candidate: HarthmereBusinessEmployeeCandidate,
  offeredWageGoldPerDay: number,
  persuasionLevel = 1,
): HarthmereBusinessEmployeeNegotiationResult {
  const offer = Math.max(1, Math.trunc(Number(offeredWageGoldPerDay) || 0));
  const minimumAccepted = Math.max(
    1,
    Math.floor(
      candidate.wageAskGoldPerDay *
        (candidate.personality === "ambitious" ? 0.95 : 0.82) *
        (1 - harthmereSublevelTradeBonus(persuasionLevel)),
    ),
  );
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

function cellKey(cell: HarthmereBusinessEmployeeAiCell) {
  return `${Math.trunc(cell.x)},${Math.trunc(cell.y)}`;
}

function sameCell(a: HarthmereBusinessEmployeeAiCell, b: HarthmereBusinessEmployeeAiCell) {
  return Math.trunc(a.x) === Math.trunc(b.x) && Math.trunc(a.y) === Math.trunc(b.y);
}

function uniqCells(cells: HarthmereBusinessEmployeeAiBlockedCell[]) {
  const seen = new Set<string>();
  const out: HarthmereBusinessEmployeeAiBlockedCell[] = [];
  for (const cell of cells) {
    const key = cellKey(cell);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x: Math.trunc(cell.x), y: Math.trunc(cell.y), reason: cell.reason });
  }
  return out;
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function taskKindForOffer(offer: HarthmereBusinessServiceOffer): HarthmereBusinessEmployeeTaskKind {
  const cue = offer.animationCue.toLowerCase();
  const text = `${offer.offerId} ${offer.label} ${offer.description}`.toLowerCase();
  if (/clean|decontam|trash|barrel|waste|spray|certificate/.test(`${cue} ${text}`)) return "cleanup_route";
  if (/dispatch|route|parcel|delivery|escort|guard|alarm|runner/.test(`${cue} ${text}`)) return "dispatch_route";
  if (/inspect|quality|audit|safety|check|calibrate|diagnose|triage/.test(`${cue} ${text}`)) return "quality_check";
  if (/hammer|wrench|patch|mix|cook|forge|tune|stabilize|prepare|build|repair/.test(`${cue} ${text}`)) return "production_station";
  if (Object.keys(offer.requiredItems).length > 1) return "stock_fetch";
  return "counter_service";
}

function stationForTaskKind(taskKind: HarthmereBusinessEmployeeTaskKind): keyof HarthmereBusinessEmployeeAiLayout["nodes"] {
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

function primaryStationObjectForBusiness(typeId: HarthmereEconomyBusinessTypeId, taskKind: HarthmereBusinessEmployeeTaskKind) {
  const stationByBusiness: Partial<Record<HarthmereEconomyBusinessTypeId, string>> = {
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

function carriedItemForOffer(offer: HarthmereBusinessServiceOffer) {
  const firstRequired = Object.keys(offer.requiredItems)[0];
  if (firstRequired) return firstRequired.replace(/_/g, " ");
  return offer.label.toLowerCase();
}

function createPhysicalActionsForFlow(
  typeId: HarthmereEconomyBusinessTypeId,
  offer: HarthmereBusinessServiceOffer,
  taskKind: HarthmereBusinessEmployeeTaskKind,
  stationNode: keyof HarthmereBusinessEmployeeAiLayout["nodes"],
): HarthmereBusinessEmployeePhysicalAction[] {
  const stationObject = primaryStationObjectForBusiness(typeId, taskKind);
  const carriedItem = carriedItemForOffer(offer);
  const baseActions: HarthmereBusinessEmployeePhysicalAction[] = [
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

function offerForSimulation(
  typeId: HarthmereEconomyBusinessTypeId,
  offerId?: string,
  automationRole?: HarthmereBusinessEmployeeAutomationRole,
) {
  const definition = getHarthmereBusinessMiniGameDefinition(typeId);
  if (!definition) return undefined;
  if (offerId) return definition.offers.find((offer) => offer.offerId === offerId);
  if (automationRole) {
    const behavior = HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS[automationRole];
    const preferred = definition.offers.find((offer) => taskKindForOffer(offer) === behavior.taskKind);
    if (preferred) return preferred;
  }
  return definition.offers[0];
}

function node(nodeId: string, label: string, x: number, y: number): HarthmereBusinessEmployeeAiNode {
  return { nodeId, label, x, y };
}

export function createHarthmereBusinessEmployeeAiLayout(
  typeId: HarthmereEconomyBusinessTypeId,
): HarthmereBusinessEmployeeAiLayout {
  const index = Math.max(0, BUSINESS_ORDER.indexOf(typeId));
  const serviceRow = 4 + (index % 2);
  return {
    typeId,
    width: 14,
    height: 10,
    nodes: {
      customerEntry: node("customer_entry", "Customer Entry", 1, 8),
      customerQueue: node("customer_queue", "Queue", 3, 7),
      customerCounter: node("customer_counter", "Customer Counter", 5, serviceRow),
      customerService: node("customer_service", "Service Spot", 5, Math.max(3, serviceRow - 1)),
      customerExit: node("customer_exit", "Customer Exit", 1, 8),
      employeeEntry: node("employee_entry", "Staff Entry", 12, 8),
      employeeCounter: node("employee_counter", "Staff Counter", 7, serviceRow),
      stockRoom: node("stock_room", "Stock Room", 11, 6),
      prepStation: node("prep_station", "Prep Station", 10, 3),
      cleanupStation: node("cleanup_station", "Cleanup Station", 10, 7),
      dispatchDesk: node("dispatch_desk", "Dispatch Desk", 8, 7),
      branchDesk: node("branch_desk", "Branch Desk", 11, 1),
      employeeExit: node("employee_exit", "Staff Exit", 12, 8),
    },
    obstacles: BASE_OBSTACLES,
  };
}

export function createHarthmereBusinessEmployeeTaskFlow(
  typeId: HarthmereEconomyBusinessTypeId,
  offerId?: string,
  automationRole?: HarthmereBusinessEmployeeAutomationRole,
): HarthmereBusinessEmployeeTaskFlow {
  const definition = getHarthmereBusinessMiniGameDefinition(typeId);
  if (!definition) {
    throw new Error(`business_employee_ai_missing_minigame:${typeId}`);
  }
  const offer = offerForSimulation(typeId, offerId, automationRole);
  if (!offer) {
    throw new Error(`business_employee_ai_missing_offer:${typeId}:${offerId ?? "default"}`);
  }
  const taskKind = automationRole
    ? HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS[automationRole].taskKind
    : taskKindForOffer(offer);
  const stationNode = automationRole
    ? HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS[automationRole].stationNode
    : stationForTaskKind(taskKind);
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
          ? HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS[automationRole].actionLabel
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
    physicalActions: createPhysicalActionsForFlow(typeId, offer, taskKind, stationNode),
  };
}

function walkable(
  layout: HarthmereBusinessEmployeeAiLayout,
  cell: HarthmereBusinessEmployeeAiCell,
  blocked: Set<string>,
) {
  const x = Math.trunc(cell.x);
  const y = Math.trunc(cell.y);
  if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) return false;
  return !blocked.has(`${x},${y}`);
}

function neighbors(cell: HarthmereBusinessEmployeeAiCell) {
  return [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ];
}

function nearestWalkableTarget(
  layout: HarthmereBusinessEmployeeAiLayout,
  target: HarthmereBusinessEmployeeAiCell,
  blocked: Set<string>,
) {
  if (walkable(layout, target, blocked)) return target;
  const queue = [target];
  const seen = new Set<string>([cellKey(target)]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of neighbors(current)) {
      const key = cellKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      if (walkable(layout, next, blocked)) return next;
      if (next.x >= -1 && next.y >= -1 && next.x <= layout.width && next.y <= layout.height) queue.push(next);
    }
  }
  return undefined;
}

function findPath(
  layout: HarthmereBusinessEmployeeAiLayout,
  start: HarthmereBusinessEmployeeAiCell,
  target: HarthmereBusinessEmployeeAiCell,
  blocked: Set<string>,
) {
  const adjustedTarget = nearestWalkableTarget(layout, target, blocked);
  if (!adjustedTarget || !walkable(layout, start, blocked)) return undefined;
  const startKey = cellKey(start);
  const targetKey = cellKey(adjustedTarget);
  const queue = [start];
  const cameFrom = new Map<string, string | undefined>([[startKey, undefined]]);
  while (queue.length) {
    const current = queue.shift()!;
    const currentKey = cellKey(current);
    if (currentKey === targetKey) {
      const path: HarthmereBusinessEmployeeAiCell[] = [];
      let key: string | undefined = currentKey;
      while (key) {
        const [x, y] = key.split(",").map((part) => Number(part));
        path.push({ x, y });
        key = cameFrom.get(key);
      }
      return path.reverse();
    }
    for (const next of neighbors(current)) {
      const key = cellKey(next);
      if (cameFrom.has(key) || !walkable(layout, next, blocked)) continue;
      cameFrom.set(key, currentKey);
      queue.push(next);
    }
  }
  return undefined;
}

function routePath(
  layout: HarthmereBusinessEmployeeAiLayout,
  route: HarthmereBusinessEmployeeAiCell[],
  blocked: Set<string>,
  audit: HarthmereBusinessEmployeePathAudit,
) {
  const path: HarthmereBusinessEmployeeAiCell[] = [];
  let from = route[0];
  for (let i = 1; i < route.length; i += 1) {
    const to = route[i];
    const segment = findPath(layout, from, to, blocked);
    if (!segment) {
      audit.unreachableNodes.push(`${cellKey(from)}->${cellKey(to)}`);
      audit.fallbackExitUsed = true;
      const fallback = findPath(layout, from, layout.nodes.employeeExit, blocked) ?? [from];
      if (path.length && sameCell(path[path.length - 1], fallback[0])) path.push(...fallback.slice(1));
      else path.push(...fallback);
      from = path[path.length - 1] ?? from;
      continue;
    }
    if (!sameCell(segment[segment.length - 1], to)) audit.repathCount += 1;
    if (path.length && sameCell(path[path.length - 1], segment[0])) path.push(...segment.slice(1));
    else path.push(...segment);
    from = segment[segment.length - 1];
  }
  return path;
}

function sidestepForCell(
  layout: HarthmereBusinessEmployeeAiLayout,
  cell: HarthmereBusinessEmployeeAiCell,
  blocked: Set<string>,
  avoided: HarthmereBusinessEmployeeAiCell[],
) {
  const avoidedKeys = new Set(avoided.map(cellKey));
  return neighbors(cell).find((candidate) => walkable(layout, candidate, blocked) && !avoidedKeys.has(cellKey(candidate)));
}

function resolveCollisions(
  layout: HarthmereBusinessEmployeeAiLayout,
  employeePath: HarthmereBusinessEmployeeAiCell[],
  customerPath: HarthmereBusinessEmployeeAiCell[],
  blocked: Set<string>,
  audit: HarthmereBusinessEmployeePathAudit,
): { employeePath: HarthmereBusinessEmployeeAiCell[]; collisionAudit: HarthmereBusinessEmployeeCollisionAudit } {
  const out = employeePath.slice();
  const sharedCells: HarthmereBusinessEmployeeAiCell[] = [];
  const collisionAudit: HarthmereBusinessEmployeeCollisionAudit = {
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
    const collides = sameCell(employeeCell, customerCell) ||
      (i > 0 && sameCell(employeeCell, previousCustomer) && sameCell(customerCell, previousEmployee));
    if (!collides) continue;
    collisionAudit.collisionCount += 1;
    sharedCells.push({ x: employeeCell.x, y: employeeCell.y });
    const sidestep = sidestepForCell(layout, previousEmployee, blocked, [customerCell, previousCustomer]);
    if (sidestep && audit.sidestepCount < 8) {
      out.splice(i, 0, sidestep);
      audit.sidestepCount += 1;
      collisionAudit.resolvedCollisions += 1;
      continue;
    }
    collisionAudit.unresolvedCollisions += 1;
    collisionAudit.warnings.push("employee_collision_unresolved:fallback_exit");
    audit.fallbackExitUsed = true;
    const exitPath = findPath(layout, employeeCell, layout.nodes.employeeExit, blocked);
    if (exitPath) out.splice(i, out.length - i, ...exitPath);
    break;
  }
  return { employeePath: out, collisionAudit };
}

function employeeNpcForAnimation(employee: HarthmereBusinessEmployeeTaskSimulationInput["employee"]) {
  const role = `${employee.role} ${employee.assignedTask ?? ""}`.toLowerCase();
  const base = HARTHMERE_BUSINESS_CUSTOMER_NPCS[(Math.max(0, Math.trunc(employee.skill ?? 1)) * 7) % HARTHMERE_BUSINESS_CUSTOMER_NPCS.length];
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
  } satisfies HarthmereBusinessCustomerNpc;
}

function customerNpcForBusiness(typeId: HarthmereEconomyBusinessTypeId, override?: HarthmereBusinessCustomerNpc) {
  if (override) return override;
  return HARTHMERE_BUSINESS_CUSTOMER_NPCS.find((npc) => npc.businessPreferences.includes(typeId)) ??
    HARTHMERE_BUSINESS_CUSTOMER_NPCS[0];
}

function statusFromAudits(
  morale: number,
  injured: boolean,
  pathAudit: HarthmereBusinessEmployeePathAudit,
  collisionAudit: HarthmereBusinessEmployeeCollisionAudit,
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

export function simulateHarthmereBusinessEmployeeTaskRun(
  input: HarthmereBusinessEmployeeTaskSimulationInput,
): HarthmereBusinessEmployeeTaskRun {
  const nowMs = Math.max(0, Math.trunc(input.nowMs ?? 0));
  const layout = createHarthmereBusinessEmployeeAiLayout(input.typeId);
  const flow = createHarthmereBusinessEmployeeTaskFlow(input.typeId, input.offerId, input.automationRole);
  const blockedCells = uniqCells([...(layout.obstacles ?? []), ...(input.blockedCells ?? [])]);
  const blocked = new Set(blockedCells.map(cellKey));
  const pathAudit: HarthmereBusinessEmployeePathAudit = {
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
  const station = stationForTaskKind(flow.taskKind);
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
  let employeePath = routePath(layout, employeeRoute, blocked, pathAudit);
  let customerPath = routePath(layout, customerRoute, blocked, pathAudit);
  if (input.forceSharedServiceLane && employeePath[8] && customerPath[8]) {
    customerPath = customerPath.slice();
    customerPath[8] = { ...employeePath[8] };
  }
  const collision = resolveCollisions(layout, employeePath, customerPath, blocked, pathAudit);
  employeePath = collision.employeePath;
  pathAudit.employeePathLength = employeePath.length;
  pathAudit.customerPathLength = customerPath.length;
  pathAudit.ok = pathAudit.unreachableNodes.length === 0 && collision.collisionAudit.unresolvedCollisions === 0;
  if (!pathAudit.ok) pathAudit.warnings.push("employee_path_requires_manual_review");
  const moraleBefore = Math.round(clamp(input.employee.morale, 0, 100, 50));
  const injured = typeof input.employee.injuredUntilMs === "number" && input.employee.injuredUntilMs > nowMs;
  const status = statusFromAudits(moraleBefore, injured, pathAudit, collision.collisionAudit);
  const warnings = [
    ...pathAudit.warnings,
    ...collision.collisionAudit.warnings,
  ];
  if (moraleBefore < 30) warnings.push("employee_low_morale_slow_service");
  if (status.reason === "employee_morale_too_low") warnings.push("employee_morale_failure:rest_required");
  if (status.reason === "employee_injured") warnings.push("employee_unavailable:injured");
  const offer = offerForSimulation(input.typeId, flow.offerId, input.automationRole)!;
  const clip = createHarthmereBusinessServiceProceduralClip({
    cueId: offer.animationCue,
    ownerNpc: employeeNpcForAnimation(input.employee),
    customerNpc: customerNpcForBusiness(input.typeId, input.customerNpc),
    sampleCount: 5,
  });
  const qualityPenalty = moraleBefore < 30 ? 0.25 : 0;
  const pathPenalty = pathAudit.sidestepCount > 0 || pathAudit.repathCount > 0 ? 0.1 : 0;
  const statusPenalty = status.status === "failed" ? 0.55 : status.status === "recovered" ? 0.15 : 0;
  const qualityMultiplier = Math.max(0.1, Number((1 - qualityPenalty - pathPenalty - statusPenalty).toFixed(2)));
  const speedMultiplier = Math.max(0.25, Number((1 + (input.employee.skill - 1) * 0.05 - (pathAudit.sidestepCount + pathAudit.repathCount) * 0.04 - (moraleBefore < 30 ? 0.2 : 0)).toFixed(2)));
  return {
    version: HARTHMERE_BUSINESS_EMPLOYEE_AI_VERSION,
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
    moraleAfter: Math.round(clamp(
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

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderGridSvg(run: HarthmereBusinessEmployeeTaskRun, width = 336, height = 252) {
  const layout = createHarthmereBusinessEmployeeAiLayout(run.typeId);
  const cellW = width / layout.width;
  const cellH = height / layout.height;
  const blocked = new Set(run.pathAudit.blockedCells.map(cellKey));
  const nodeCells = Object.values(layout.nodes);
  const nodeLookup = new Map(nodeCells.map((node) => [cellKey(node), node]));
  const pathPoints = (path: HarthmereBusinessEmployeeAiCell[]) =>
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
  return `<svg class="staff-path" data-task-run-id="${escape(run.taskRunId)}" data-status="${run.status}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Staff path for ${escape(run.typeId)}">
    <rect width="${width}" height="${height}" fill="#f8f6ef"/>
    ${cells.join("")}
    <polyline points="${pathPoints(run.customerPath)}" fill="none" stroke="#cf7f2a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="${pathPoints(run.employeePath)}" fill="none" stroke="#286bb5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${collisions}
    <circle cx="${run.customerPath[0].x * cellW + cellW / 2}" cy="${run.customerPath[0].y * cellH + cellH / 2}" r="6" fill="#cf7f2a"/>
    <circle cx="${run.employeePath[0].x * cellW + cellW / 2}" cy="${run.employeePath[0].y * cellH + cellH / 2}" r="6" fill="#286bb5"/>
  </svg>`;
}

function visualEmployeeFixture(
  role: string,
  overrides: Partial<Pick<HarthmereEconomyEmployeeRecord, "morale" | "skill" | "loyalty" | "assignedTask" | "injuredUntilMs">> = {},
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
  } satisfies HarthmereEconomyEmployeeRecord;
}

function renderRunCell(title: string, run: HarthmereBusinessEmployeeTaskRun) {
  const clip = createHarthmereBusinessServiceProceduralClip({
    cueId: run.animationCue,
    ownerNpc: employeeNpcForAnimation({
      employeeId: run.employeeId,
      role: run.employeeRole,
      skill: 3,
      morale: run.moraleBefore,
      loyalty: 50,
      assignedTask: run.assignedTask,
      npcId: run.employeeId,
    }),
    customerNpc: customerNpcForBusiness(run.typeId),
    sampleCount: 3,
  });
  const frame = clip.frames[Math.floor(clip.frames.length / 2)];
  return `<section class="audit-cell" data-status="${run.status}" data-type-id="${escape(run.typeId)}" data-task-kind="${run.taskKind}">
    <h3>${escape(title)}</h3>
    <p>${escape(run.offerLabel)} · ${escape(run.taskKind.replace(/_/g, " "))} · ${escape(run.status)}</p>
    ${renderGridSvg(run)}
    <div class="cell-meta"><span>staff ${run.employeePath.length} steps</span><span>customer ${run.customerPath.length} steps</span><span>${run.animationFrameCount} frames</span></div>
    <div class="pose-frame">${renderHarthmereBusinessServiceFrameSvg(clip, frame)}</div>
  </section>`;
}

export function renderHarthmereBusinessEmployeeAiVisualAuditHtml() {
  const businessRuns = BUSINESS_ORDER.map((typeId, index) => simulateHarthmereBusinessEmployeeTaskRun({
    taskRunId: `visual_business_${typeId}`,
    businessId: `visual_business_${typeId}`,
    typeId,
    employee: visualEmployeeFixture(index % 3 === 0 ? "Server" : index % 3 === 1 ? "Specialist" : "Runner"),
    nowMs: 1_800_000_000_000 + index,
  }));
  const roleRuns = (Object.keys(HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS) as HarthmereBusinessEmployeeAutomationRole[]).map((role, index) => simulateHarthmereBusinessEmployeeTaskRun({
    taskRunId: `visual_role_${role}`,
    businessId: "visual_role_business",
    typeId: "food_service_restaurant",
    employee: visualEmployeeFixture(role, { skill: 2 + index }),
    automationRole: role,
    nowMs: 1_800_000_010_000 + index,
  }));
  const edgeRuns = [
    simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "visual_edge_blocked_counter",
      businessId: "visual_edge_business",
      typeId: "repair_maintenance_person",
      employee: visualEmployeeFixture("Fix-It Apprentice"),
      blockedCells: [{ x: 10, y: 3, reason: "customer dropped crate" }],
      nowMs: 1_800_000_020_000,
    }),
    simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "visual_edge_shared_lane",
      businessId: "visual_edge_business",
      typeId: "courier",
      employee: visualEmployeeFixture("Dispatch Runner"),
      forceSharedServiceLane: true,
      nowMs: 1_800_000_020_001,
    }),
    simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "visual_edge_low_morale",
      businessId: "visual_edge_business",
      typeId: "medical_doctor",
      employee: visualEmployeeFixture("Clinic Aide", { morale: 8 }),
      nowMs: 1_800_000_020_002,
    }),
  ];
  const audit = validateHarthmereBusinessEmployeeAiVisualAudit();
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
  <div class="grid" id="business-flow-atlas">${businessRuns.map((run) => renderRunCell(run.typeId.replace(/_/g, " "), run)).join("")}</div>
  <h2>Automation Role Behaviors</h2>
  <div class="grid" id="automation-role-atlas">${roleRuns.map((run) => renderRunCell(run.automationRole?.replace(/_/g, " ") ?? run.taskKind, run)).join("")}</div>
  <h2>Pathing And Morale Edge Cases</h2>
  <div class="grid" id="edge-case-atlas">${edgeRuns.map((run) => renderRunCell(run.taskRunId.replace(/visual_edge_/g, "").replace(/_/g, " "), run)).join("")}</div>
</body>
</html>`;
}

export function validateHarthmereBusinessEmployeeAiVisualAudit(): HarthmereBusinessEmployeeAiVisualAudit {
  const warnings: string[] = [];
  const businessRuns = BUSINESS_ORDER.map((typeId, index) => simulateHarthmereBusinessEmployeeTaskRun({
    taskRunId: `audit_business_${typeId}`,
    businessId: `audit_business_${typeId}`,
    typeId,
    employee: visualEmployeeFixture(`Audit Worker ${index}`, { skill: 3 }),
    nowMs: 1_800_000_000_000 + index,
  }));
  const roleRuns = (Object.keys(HARTHMERE_BUSINESS_EMPLOYEE_AUTOMATION_ROLE_BEHAVIORS) as HarthmereBusinessEmployeeAutomationRole[]).map((role, index) => simulateHarthmereBusinessEmployeeTaskRun({
    taskRunId: `audit_role_${role}`,
    businessId: "audit_role_business",
    typeId: "food_service_restaurant",
    employee: visualEmployeeFixture(role, { skill: 2 + index }),
    automationRole: role,
    nowMs: 1_800_000_010_000 + index,
  }));
  const edgeRuns = [
    simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "audit_edge_blocked",
      businessId: "audit_edge_business",
      typeId: "repair_maintenance_person",
      employee: visualEmployeeFixture("Repair Staff"),
      blockedCells: [{ x: 10, y: 3, reason: "blocked prep station" }],
      nowMs: 1_800_000_020_000,
    }),
    simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "audit_edge_collision",
      businessId: "audit_edge_business",
      typeId: "courier",
      employee: visualEmployeeFixture("Courier Staff"),
      forceSharedServiceLane: true,
      nowMs: 1_800_000_020_001,
    }),
    simulateHarthmereBusinessEmployeeTaskRun({
      taskRunId: "audit_edge_morale",
      businessId: "audit_edge_business",
      typeId: "medical_doctor",
      employee: visualEmployeeFixture("Clinic Staff", { morale: 8 }),
      nowMs: 1_800_000_020_002,
    }),
  ];
  for (const run of [...businessRuns, ...roleRuns]) {
    if (run.status === "failed") warnings.push(`employee_ai_failed:${run.taskRunId}:${run.failureReason ?? "unknown"}`);
    if (!getHarthmereBusinessServiceAnimationCueSpec(run.animationCue)) warnings.push(`employee_ai_missing_animation:${run.taskRunId}:${run.animationCue}`);
    if (!run.employeePath.length || !run.customerPath.length) warnings.push(`employee_ai_empty_path:${run.taskRunId}`);
    if (!run.animationSafety.noRootMotion || !run.animationSafety.voxelSafe) warnings.push(`employee_ai_unsafe_animation:${run.taskRunId}`);
    const svg = renderGridSvg(run);
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
