import type { HarthmereEconomyBusinessTypeId } from "./mmo_economy_authority";

export const HARTHMERE_BUSINESS_MINIGAME_SPECS_VERSION =
  "harthmere-business-minigame-specs" as const;

export type HarthmereBusinessMiniGameDecisionValue =
  | boolean
  | number
  | string;

export type HarthmereBusinessMiniGameDecision = Record<
  string,
  HarthmereBusinessMiniGameDecisionValue
>;

export interface HarthmereBusinessMiniGameUiElement {
  elementId: string;
  label: string;
  description: string;
}

export interface HarthmereBusinessMiniGameCustomerType {
  customerTypeId: string;
  label: string;
  requirements: string;
}

export interface HarthmereBusinessMiniGameDifficultyTier {
  tier: "starter" | "shop" | "company" | "regional";
  rule: string;
}

export interface HarthmereBusinessMiniGameOfferRule {
  offerId: string;
  exact: HarthmereBusinessMiniGameDecision;
  min?: Record<string, number>;
  max?: Record<string, number>;
  blocked?: HarthmereBusinessMiniGameDecision;
  notes: readonly string[];
}

export interface HarthmereBusinessMiniGameEdgeFailure {
  failureId: string;
  when: HarthmereBusinessMiniGameDecision;
  warning: string;
  penalty: string;
}

export interface HarthmereBusinessMiniGameSpec {
  specId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  businessName: string;
  gameTitle: string;
  objective: string;
  coreMechanic: string;
  uniqueTwist: string;
  uiElements: readonly HarthmereBusinessMiniGameUiElement[];
  customerTypes: readonly HarthmereBusinessMiniGameCustomerType[];
  difficultyScaling: readonly HarthmereBusinessMiniGameDifficultyTier[];
  edgeCases: readonly string[];
  winConditions: readonly string[];
  loseConditions: readonly string[];
  offerRules: readonly HarthmereBusinessMiniGameOfferRule[];
  edgeFailureActions: readonly HarthmereBusinessMiniGameEdgeFailure[];
  interiorFixtureLabels: readonly [string, string, string, string];
}

export interface HarthmereBusinessMiniGameDecisionResult {
  ok: boolean;
  specId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  offerId: string;
  passedRules: string[];
  failedRules: string[];
  warnings: string[];
}

function ui(
  elementId: string,
  label: string,
  description: string
): HarthmereBusinessMiniGameUiElement {
  return { elementId, label, description };
}

function customer(
  customerTypeId: string,
  label: string,
  requirements: string
): HarthmereBusinessMiniGameCustomerType {
  return { customerTypeId, label, requirements };
}

function tier(
  tierName: HarthmereBusinessMiniGameDifficultyTier["tier"],
  rule: string
): HarthmereBusinessMiniGameDifficultyTier {
  return { tier: tierName, rule };
}

function rule(
  offerId: string,
  exact: HarthmereBusinessMiniGameDecision,
  notes: readonly string[],
  limits: Pick<HarthmereBusinessMiniGameOfferRule, "blocked" | "max" | "min"> = {}
): HarthmereBusinessMiniGameOfferRule {
  return { offerId, exact, notes, ...limits };
}

function edge(
  failureId: string,
  when: HarthmereBusinessMiniGameDecision,
  warning: string,
  penalty: string
): HarthmereBusinessMiniGameEdgeFailure {
  return { failureId, when, warning, penalty };
}

function spec(
  input: Omit<HarthmereBusinessMiniGameSpec, "specId">
): HarthmereBusinessMiniGameSpec {
  return {
    specId: `${input.typeId}:business_minigame:${HARTHMERE_BUSINESS_MINIGAME_SPECS_VERSION}`,
    ...input,
  };
}

export const HARTHMERE_BUSINESS_MINIGAME_SPECS: Record<
  HarthmereEconomyBusinessTypeId,
  HarthmereBusinessMiniGameSpec
> = {
  exotic_matter_refinery: spec({
    typeId: "exotic_matter_refinery",
    businessName: "Ashline Containment Works",
    gameTitle: "Contamination Sort & Certify",
    objective: "Route samples to the correct chamber before contamination spreads.",
    coreMechanic:
      "Operate four intake lanes, read green/yellow/red instability, route stable canisters to fuel, filter, or stabilizer chambers, and quarantine unstable canisters before matching certified output to the ticket.",
    uniqueTwist:
      "A contamination meter persists through the shift; routing unstable stock to a live chamber spikes it and can pause the queue for cleanup.",
    uiElements: [
      ui("conveyor_lanes", "Conveyor lanes", "Four incoming sample slots with glow and freshness timers."),
      ui("processing_chambers", "Processing chambers", "Fuel Cell, Filter Press, and Stabilization Tank capacity and timers."),
      ui("quarantine_bay", "Quarantine bay", "Side slot for unstable canisters and decon flush pressure."),
      ui("customer_ticket_panel", "Customer ticket panel", "Requested output, patience, and purity grade."),
      ui("contamination_meter", "Contamination meter", "Persistent contamination bar with partial decon reset."),
    ],
    customerTypes: [
      customer("refinery_hand", "Refinery Hand", "Certified fuel; green/yellow canisters; moderate patience."),
      customer("portal_tech", "Portal Tech", "High purity anchor fuel; short patience; may include one red canister."),
      customer("safety_inspector", "Safety Inspector", "Reviews quarantine bay and fines overfilled bays."),
      customer("emergency_disposal", "Emergency Disposal", "Red-only batch that must be quarantined before expiry."),
    ],
    difficultyScaling: [
      tier("starter", "Two lanes, no red canisters, single chamber."),
      tier("shop", "Four lanes, yellow canisters, contamination meter, two chambers."),
      tier("company", "Red canisters, inspectors, premium purity, quarantine pressure."),
      tier("regional", "Overlapping emergency disposal and normal queue batches."),
    ],
    edgeCases: [
      "Red canister routed to chamber adds 30 contamination.",
      "More than five backed-up canisters auto-fails the segment.",
      "Decon flush consumes a spent filter and pauses intake for 3 seconds.",
    ],
    winConditions: ["Correct output type, purity, and stock before patience expires."],
    loseConditions: ["Wrong output, missing stock, max contamination, or patience expiry."],
    offerRules: [
      rule("certified_fuel_sale", { output: "certified_fuel", route: "fuel_cell", instabilityAction: "quarantine_red", purityOk: true, stockReady: true, contaminationSafe: true }, ["Fuel tickets require the fuel chamber and red quarantine."]),
      rule("matter_stabilization", { output: "stabilized_matter", route: "stabilization_tank", instabilityAction: "quarantine_red", purityOk: true, stockReady: true, contaminationSafe: true }, ["Stabilization tickets require the stabilization tank and filter stock."]),
      rule("containment_audit", { output: "filter_run", route: "filter_press", instabilityAction: "quarantine_red", purityOk: true, stockReady: true, contaminationSafe: true }, ["Audit tickets are filter-press work, not fuel handoff."]),
    ],
    edgeFailureActions: [
      edge("red_canister_to_live_chamber", { instabilityAction: "route_red_to_chamber" }, "business_minigame:contamination_spike_30", "Hazard spike, lost batch, cleanup pause."),
      edge("conveyor_backlog_over_five", { backlogCount: 6 }, "business_minigame:conveyor_auto_fail", "Backed-up intake fails the segment."),
      edge("decon_flush_without_filter", { deconFlush: true, spentFilterReady: false }, "business_minigame:decon_filter_missing", "Flush cannot run without spent filter stock."),
    ],
    interiorFixtureLabels: ["Four-lane sample conveyor", "Fuel filter stabilizer chamber bank", "Quarantine bay", "Contamination meter"],
  }),
  biome_maintenance_repair: spec({
    typeId: "biome_maintenance_repair",
    businessName: "North Anchor Repair Shed",
    gameTitle: "Fault Diagnosis Tree",
    objective: "Read the symptom, branch the diagnostic tree, and commit to the right repair.",
    coreMechanic:
      "Branch through symptom categories before offers unlock; severity changes patience, reward, and the number of diagnosis steps required.",
    uniqueTwist:
      "Shortcutting a leak-level fault can consume parts, block the queue, and escalate the ticket harder than a timeout.",
    uiElements: [
      ui("symptom_card", "Symptom card", "Fault language with blue, amber, or red severity border."),
      ui("diagnostic_tree_panel", "Diagnostic tree panel", "Two to three branch-choice buttons before offer unlock."),
      ui("offer_buttons", "Offer buttons", "Inspect Anchor, Tune Climate, Patch Timeline Leak."),
      ui("parts_consumed_preview", "Parts consumed preview", "Required stock preview before commit."),
      ui("response_time_bonus_meter", "Response time bonus meter", "Independent bonus timer for subscription conversion."),
    ],
    customerTypes: [
      customer("homeowner", "Homeowner", "Mild drift, long patience, one branch."),
      customer("commercial_operator", "Commercial Operator", "Compound fault, medium patience, two branches."),
      customer("emergency_leak", "Emergency Leak", "Critical leak, short patience, three branches."),
      customer("inspector_visit", "Inspector Visit", "Audits the last three diagnostic choices."),
    ],
    difficultyScaling: [
      tier("starter", "Single branch, no emergencies, two offers."),
      tier("shop", "Two branches and subscriber conversion."),
      tier("company", "Three branches, emergencies, important parts preview."),
      tier("regional", "Queued compounding faults and inspector events."),
    ],
    edgeCases: [
      "Patch Timeline Leak on a climate fault consumes stabilized matter with no repair.",
      "Emergency escalation blocks new queue entries.",
      "Two wrong choices in the last three inspector records reduce future patience.",
    ],
    winConditions: ["Complete the correct diagnostic path and choose the matching stocked offer."],
    loseConditions: ["Wrong incomplete diagnosis, timeout, or two consecutive critical wrong branches."],
    offerRules: [
      rule("anchor_inspection", { faultClass: "structural", severity: "low", diagnosisDepth: 1, offerUnlocked: true, partsPreviewed: true }, ["Low structural reports resolve through inspection."]),
      rule("climate_tune", { faultClass: "environmental", severity: "medium", diagnosisDepth: 2, offerUnlocked: true, partsPreviewed: true }, ["Climate faults require tuning after two branches."]),
      rule("timeline_leak_patch", { faultClass: "timeline", severity: "critical", diagnosisDepth: 3, offerUnlocked: true, partsPreviewed: true }, ["Timeline leaks require the full three-branch diagnosis."]),
    ],
    edgeFailureActions: [
      edge("leak_patch_on_climate_fault", { faultClass: "environmental", selectedOffer: "timeline_leak_patch" }, "business_minigame:wrong_parts_consumed", "Parts consumed, no repair, complaint state."),
      edge("critical_shortcut", { severity: "critical", diagnosisDepth: 1 }, "business_minigame:critical_diagnosis_shortcut", "Emergency escalation blocks queue."),
      edge("inspector_two_wrong_choices", { inspectorWrongChoices: 2 }, "business_minigame:inspection_compliance_warning", "Next shift patience timers reduced."),
    ],
    interiorFixtureLabels: ["Diagnostic tree panel", "Parts consumed preview bench", "Response time bonus meter", "Emergency escalation board"],
  }),
  biome_design_studio: spec({
    typeId: "biome_design_studio",
    businessName: "Glassyard Biome Studio",
    gameTitle: "Mood Palette Assembly",
    objective: "Decode the client's mood, assemble terrain, lighting, and decor chips, and beat the trend window.",
    coreMechanic:
      "Pick one terrain, one lighting, and one decor chip from a 3x3 palette board; hidden tags reveal after selection and produce a match score.",
    uniqueTwist:
      "Luxury clients require three matching tags and trends shift between shifts, changing bonus and penalty pressure.",
    uiElements: [
      ui("mood_request_card", "Mood request card", "Client description with mood keyword highlights."),
      ui("chip_palette_board", "3x3 chip palette board", "Terrain, lighting, and decor rows with hidden tags."),
      ui("assembled_palette_preview", "Assembled palette preview", "Selected chips and running match score."),
      ui("trend_meter_sidebar", "Trend meter sidebar", "Top three trending style tags."),
      ui("client_tier_indicator", "Client tier indicator", "Budget, Standard, or Luxury threshold."),
    ],
    customerTypes: [
      customer("budget_client", "Budget Client", "Two-of-three match, long patience."),
      customer("standard_client", "Standard Client", "Two-of-three match, medium patience."),
      customer("luxury_client", "Luxury Client", "Three-of-three match, short patience."),
      customer("trend_collector", "Trend-Chasing Collector", "Trending tags on all chips for tip."),
    ],
    difficultyScaling: [
      tier("starter", "Six chips, no trend meter, budget clients."),
      tier("shop", "Full board, trend meter, hidden tags."),
      tier("company", "Luxury clients and swap penalties."),
      tier("regional", "Mid-shift trend shifts and stock outages."),
    ],
    edgeCases: [
      "Swapping after commit applies a second-guess penalty.",
      "Out-of-stock chip forces substitution and may drop luxury below threshold.",
      "Luxury two-of-three review suppresses next two clients' patience by 20%.",
    ],
    winConditions: ["Meet or exceed the client tier match score before patience expires."],
    loseConditions: ["Below-threshold score, timeout, or committed swap dropping luxury below threshold."],
    offerRules: [
      rule("habitat_mockup", { moodService: "habitat_mockup", terrainChip: "habitat", lightingChip: "calm", decorChip: "living", matchScore: 2, tierThresholdMet: true, committedSwap: false }, ["Habitat mockups need a two-tag room-feel match."], { min: { matchScore: 2 } }),
      rule("terrain_palette", { moodService: "terrain_palette", terrainChip: "terrain", lightingChip: "natural", decorChip: "plants", matchScore: 2, tierThresholdMet: true, committedSwap: false }, ["Terrain palettes require terrain and plant language."], { min: { matchScore: 2 } }),
      rule("lighting_scene", { moodService: "lighting_scene", terrainChip: "minimal", lightingChip: "featured", decorChip: "ambient", matchScore: 3, tierThresholdMet: true, committedSwap: false }, ["Luxury lighting scenes require three matching tags."], { min: { matchScore: 3 } }),
    ],
    edgeFailureActions: [
      edge("second_guess_penalty", { committedSwap: true }, "business_minigame:palette_second_guess_penalty", "Satisfaction penalty even if score improves."),
      edge("luxury_two_of_three", { clientTier: "luxury", matchScore: 2 }, "business_minigame:luxury_public_review", "Next two clients lose patience."),
      edge("chip_out_of_stock", { chipStockReady: false }, "business_minigame:palette_chip_out_of_stock", "Forced substitution can fail luxury threshold."),
    ],
    interiorFixtureLabels: ["Mood palette chip board", "Assembled palette preview", "Trend meter sidebar", "Client tier display"],
  }),
  security_defense_contractor: spec({
    typeId: "security_defense_contractor",
    businessName: "Redoubt Contract Yard",
    gameTitle: "Threat Assessment & Readiness Board",
    objective: "Classify the threat, check squad readiness, and deploy the right coverage before panic wins.",
    coreMechanic:
      "Read an intel card, classify low/medium/high, then select the matching service while guard slots and gear status constrain acceptance.",
    uniqueTwist:
      "High threats misclassified as low fail in the field, injuring guards and triggering refunds and reputation loss.",
    uiElements: [
      ui("intel_card", "Intel card", "Location, threat words, duration, and composure."),
      ui("threat_classification_buttons", "Threat classification buttons", "Low, Medium, High before offers unlock."),
      ui("offer_buttons", "Offer buttons", "Assign Guard, Plan Escort, Triage Threat."),
      ui("squad_readiness_board", "Squad readiness board", "Guard slots and gear status."),
      ui("panic_timer_overlay", "Panic timer overlay", "Independent red countdown for panicking clients."),
    ],
    customerTypes: [
      customer("property_owner", "Property Owner", "Low threat, calm, static guard."),
      customer("trade_route_operator", "Trade Route Operator", "Medium threat, escort, gear check."),
      customer("emergency_client", "Emergency Client", "High threat, panicking, two guard slots."),
      customer("inspector_audit", "Inspector Audit", "Reviews last three classifications."),
    ],
    difficultyScaling: [
      tier("starter", "Low/medium only, no panic, full squad."),
      tier("shop", "All tiers, readiness and gear degradation."),
      tier("company", "Panic timer, injury, pulled-contract fee."),
      tier("regional", "Simultaneous intel, audits, permit checks."),
    ],
    edgeCases: [
      "High threat marked low causes delayed mission failure and five-shift penalty.",
      "All injured guard slots closes the yard until medical recovery.",
      "Degraded gear on high threat reduces success and can refund client.",
    ],
    winConditions: ["Correct classification, matching service, available guards and gear."],
    loseConditions: ["Wrong threat field failure, panic zero, or squad unavailable."],
    offerRules: [
      rule("hire_static_guard", { threatTier: "low", service: "static_guard", guardSlotsReady: true, gearReady: true, panicActive: false }, ["Low threats accept one static guard."]),
      rule("escort_route_plan", { threatTier: "medium", service: "escort_route", guardSlotsReady: true, gearReady: true, panicActive: false }, ["Medium threats require escort planning and gear checks."]),
      rule("threat_triage", { threatTier: "high", service: "triage_threat", guardSlotsReady: true, gearReady: true, panicActive: true, panicTimerSafe: true }, ["High threats require triage before panic expires."]),
    ],
    edgeFailureActions: [
      edge("high_threat_marked_low", { actualThreatTier: "high", threatTier: "low" }, "business_minigame:security_field_failure", "Guard injured, refund, reputation penalty."),
      edge("all_guards_injured", { guardSlotsReady: false }, "business_minigame:security_squad_unavailable", "Queue closed for service."),
      edge("panic_timer_zero", { panicTimerSafe: false }, "business_minigame:panic_contract_lost", "Competitor takes contract for the week."),
    ],
    interiorFixtureLabels: ["Intel threat card table", "Threat classification board", "Squad readiness guard slots", "Panic timer marker"],
  }),
  portal_transit_company: spec({
    typeId: "portal_transit_company",
    businessName: "Eastgate Portal Office",
    gameTitle: "Route Traffic Controller",
    objective: "Assign arrivals to the right gate, verify fuel, and hold unstable links.",
    coreMechanic:
      "Move passenger or cargo arrivals to matching destination gates while monitoring fuel, stability, and gate queue limits.",
    uniqueTwist:
      "Route stability degrades in real time; red routes reject assignments unless temporarily stabilized with fuel.",
    uiElements: [
      ui("boarding_display", "Boarding display", "Destination, cargo type, and departure countdown."),
      ui("gate_board", "Gate board", "Destination, fuel, stability, and queue count."),
      ui("fuel_reserve_panel", "Fuel reserve panel", "Total fuel cells available for stabilization."),
      ui("assignment_drag_zone", "Assignment drag zone", "Arrival card to gate assignment."),
      ui("safety_hold_button", "Safety hold button", "Hold yellow route assignments."),
    ],
    customerTypes: [
      customer("standard_passenger", "Standard Passenger", "Single destination, stable gate."),
      customer("cargo_operator", "Cargo Operator", "Payload flag, extended gate lock."),
      customer("vip_transit", "VIP Transit", "Green gate only, short patience."),
      customer("emergency_evacuation", "Emergency Evacuation", "Many passengers for one destination."),
    ],
    difficultyScaling: [
      tier("starter", "Four gates, passengers, no degradation."),
      tier("shop", "Six gates, cargo, fuel reserve."),
      tier("company", "Eight gates, VIP, red stabilization."),
      tier("regional", "Evacuations, multiple red gates, congestion cascades."),
    ],
    edgeCases: [
      "Passenger assigned to red gate becomes lost and gate goes offline.",
      "Large cargo can block a VIP for the same destination.",
      "Ashline restock cannot solve same-shift fuel crisis.",
    ],
    winConditions: ["All arrivals assigned to correct fueled stable gates before departure."],
    loseConditions: ["Wrong gate, red miss-jump, congestion cascade, or VIP timeout."],
    offerRules: [
      rule("passenger_jump", { arrivalType: "passenger", destinationMatched: true, routeStability: "green", fuelReady: true, gateQueueCount: 1 }, ["Passengers need the matching stable gate."], { max: { gateQueueCount: 3 } }),
      rule("cargo_slot", { arrivalType: "cargo", destinationMatched: true, routeStability: "green", fuelReady: true, cargoFlagChecked: true, gateQueueCount: 1 }, ["Cargo needs flag checks and fuel."], { max: { gateQueueCount: 3 } }),
      rule("route_safety_check", { arrivalType: "safety_check", destinationMatched: true, routeStability: "yellow", safetyHold: true, fuelReady: true, gateQueueCount: 0 }, ["Yellow stability requires safety hold before use."], { max: { gateQueueCount: 3 } }),
    ],
    edgeFailureActions: [
      edge("red_gate_assignment", { routeStability: "red", stabilized: false }, "business_minigame:portal_miss_jump", "Customer lost and gate offline."),
      edge("gate_congestion", { gateQueueCount: 4 }, "business_minigame:portal_congestion_cascade", "Gate queue exceeds capacity."),
      edge("vip_blocked_by_cargo", { vipWaiting: true, cargoGateLocked: true, alternateGateReady: false }, "business_minigame:vip_stranded_by_cargo", "Cancel cargo or lose VIP satisfaction."),
    ],
    interiorFixtureLabels: ["Portal gate traffic board", "Fuel reserve panel", "Safety hold console", "Cargo assignment rail"],
  }),
  biome_farming_rare_foods: spec({
    typeId: "biome_farming_rare_foods",
    businessName: "Southplot Rare Foods",
    gameTitle: "Freshness Triage Counter",
    objective: "Match freshness grade to buyer, clear aging stock wisely, and protect clinic herbs.",
    coreMechanic:
      "Pull crop, herb, or tasting stock from Fresh, Good, Aging, and Near-Spoil bins while spoilage timers tick.",
    uniqueTwist:
      "Clinics reject Aging herbs; rare climate produce pays more but spoils fast and tempts the player to hold for collectors.",
    uiElements: [
      ui("freshness_bins", "Four freshness bins", "Fresh, Good, Aging, Near-Spoil counts and timers."),
      ui("customer_ticket", "Customer ticket", "Produce type, freshness badge, patience, budget."),
      ui("discount_toggle", "Discount toggle", "Discount aging stock to attract budget buyers."),
      ui("rare_produce_alert", "Rare produce alert", "Limited rare item timer."),
      ui("spoilage_log", "Spoilage log", "Items lost and penalty threshold."),
    ],
    customerTypes: [
      customer("local_buyer", "Local Buyer", "Good or Aging accepted."),
      customer("restaurant_buyer", "Restaurant Buyer", "Fresh or Good only."),
      customer("clinic_buyer", "Clinic Buyer", "Fresh only; strict complaint."),
      customer("rare_collector", "Rare Collector", "Specific rare item, short window."),
    ],
    difficultyScaling: [
      tier("starter", "Fresh and Good only."),
      tier("shop", "Four bins and clinic freshness badges."),
      tier("company", "Rare produce, discount toggle, spoilage log."),
      tier("regional", "Collector and clinic rush overlap."),
    ],
    edgeCases: [
      "Near-spoil timer expiry logs spoilage and can stop restaurant visits.",
      "Aging stock to clinic causes satisfaction suppression.",
      "Weather failure pauses new harvests.",
    ],
    winConditions: ["Correct produce type and freshness, with collector bonus for rare produce."],
    loseConditions: ["Clinic wrong freshness, timeout, or spoilage reputation decay."],
    offerRules: [
      rule("fresh_crop_bundle", { produceType: "crop_bundle", freshnessGrade: "good", minimumFreshnessMet: true, discountDecision: "none", stockReady: true }, ["Crop bundles can use Fresh or Good stock."]),
      rule("medicinal_herbs", { produceType: "medicinal_herbs", freshnessGrade: "fresh", minimumFreshnessMet: true, clinicFreshnessStrict: true, stockReady: true }, ["Clinic herbs must be Fresh."]),
      rule("rare_tasting_box", { produceType: "rare_tasting_box", freshnessGrade: "fresh", minimumFreshnessMet: true, rareWindowOpen: true, stockReady: true }, ["Rare tasting boxes must be sold within the rare window."]),
    ],
    edgeFailureActions: [
      edge("aging_herbs_to_clinic", { produceType: "medicinal_herbs", freshnessGrade: "aging", clinicFreshnessStrict: true }, "business_minigame:clinic_quality_complaint", "Next five tickets suppressed."),
      edge("near_spoil_expired", { spoilageExpired: true }, "business_minigame:spoilage_penalty_logged", "Lost stock and reputation decay risk."),
      edge("too_many_spoilage_logs", { spoilageLogCount: 4 }, "business_minigame:restaurant_visits_paused", "Restaurant buyer stops visiting."),
    ],
    interiorFixtureLabels: ["Freshness triage counter", "Freshness grade shelf", "Rare foods crate scale", "Spoilage bin"],
  }),
  weapons_tools: spec({
    typeId: "weapons_tools",
    businessName: "Cinderlane Tool Forge",
    gameTitle: "Gear-Type & Material Matching",
    objective: "Identify the gear, match the material, and use the right process.",
    coreMechanic:
      "Read gear type and durability history, choose the correct service, and select common, refined, or exotic material stock.",
    uniqueTwist:
      "Third-plus repeat repairs require upgrade material or return-customer complaints.",
    uiElements: [
      ui("gear_ticket", "Gear ticket", "Gear icon, durability, history, requested service."),
      ui("service_buttons", "Service buttons", "Repair Tool, Tune Weapon, Calibrate Scanner."),
      ui("material_stock_panel", "Material stock panel", "Quantities and rarity tiers."),
      ui("output_quality_preview", "Output quality preview", "Predicted quality before confirm."),
      ui("permit_warning", "Permit warning", "Restricted weapon permit gate."),
    ],
    customerTypes: [
      customer("tool_operator", "Tool Operator", "Tool repair, common material."),
      customer("guard_hunter", "Guard / Hunter", "Weapon tune, refined material."),
      customer("tech_professional", "Tech Professional", "Scanner calibration, exotic material."),
      customer("repeat_customer", "Repeat Customer", "Third-plus history requires upgrade path."),
    ],
    difficultyScaling: [
      tier("starter", "Tools, one material, no history."),
      tier("shop", "All gear types and two material tiers."),
      tier("company", "Repair history and permit warnings."),
      tier("regional", "Regular repeat customers and limited exotic stock."),
    ],
    edgeCases: [
      "Common material on high-tier gear completes with negative satisfaction.",
      "Uncleared permit creates compliance penalty.",
      "Required material stockout blocks queue.",
    ],
    winConditions: ["Correct service and material tier, with upgrade path for repeat gear."],
    loseConditions: ["Wrong service, wrong tier, permit violation, or stockout block."],
    offerRules: [
      rule("tool_repair", { gearType: "tool", service: "repair_tool", materialTier: "common", permitCleared: true, stockReady: true }, ["Tools use repair service and common material."]),
      rule("weapon_tune", { gearType: "weapon", service: "tune_weapon", materialTier: "refined", permitCleared: true, stockReady: true }, ["Weapons need refined material and permit clearance."]),
      rule("scanner_calibration", { gearType: "scanner", service: "calibrate_scanner", materialTier: "exotic", permitCleared: true, stockReady: true }, ["Scanners need calibration and exotic material."]),
    ],
    edgeFailureActions: [
      edge("common_on_high_tier", { gearTier: "high", materialTier: "common" }, "business_minigame:degraded_output_complaint", "Negative satisfaction and return complaint."),
      edge("permit_not_cleared", { gearType: "weapon", permitCleared: false }, "business_minigame:forge_permit_violation", "Compliance penalty and earlier inspector."),
      edge("material_stockout_block", { stockReady: false }, "business_minigame:forge_queue_blocked", "Customer blocks queue until restock or dismissal."),
    ],
    interiorFixtureLabels: ["Gear material matching bench", "Tool forge anvil", "Material rack", "Output quality meter"],
  }),
  magic_goods: spec({
    typeId: "magic_goods",
    businessName: "Moonstall Ward Shop",
    gameTitle: "Risk-Outcome Matcher",
    objective: "Read the threat, match the remedy, and handle unstable stock before expiry.",
    coreMechanic:
      "Translate outcome language into charm, potion, or ward while tracking expiry and instability in the stock panel.",
    uniqueTwist:
      "Expired potions become anomalous and must be disposed of before a shop anomaly pauses the queue.",
    uiElements: [
      ui("customer_problem_card", "Customer problem card", "Embedded risk-level cues."),
      ui("remedy_selection_buttons", "Remedy selection buttons", "Sell Charm, Mix Potion, Write Ward."),
      ui("stock_panel", "Stock panel", "Quantity, expiry, instability for each remedy."),
      ui("dispose_action", "Dispose action", "Safe zero-income removal under 20 percent expiry."),
      ui("anomaly_warning_indicator", "Anomaly warning indicator", "Pulses at zero expiry."),
    ],
    customerTypes: [
      customer("worried_civilian", "Worried Civilian", "Low risk charm."),
      customer("adventurer_hunter", "Adventurer / Hunter", "Medium risk potion."),
      customer("property_owner_crisis", "Property Owner in Crisis", "High risk ward."),
      customer("relic_identifier", "Relic Identifier", "Assessment event, not remedy."),
    ],
    difficultyScaling: [
      tier("starter", "Charms and potions, no expiry."),
      tier("shop", "Wards, expiry, instability, dispose."),
      tier("company", "Volatile misfires and relic events."),
      tier("regional", "Simultaneous expiries and anomaly cleanup."),
    ],
    edgeCases: [
      "Volatile ward can misfire and demand 2x refund.",
      "Ignored zero-expiry item triggers 10-second queue pause.",
      "Relic focus can fail a high-risk customer at the same time.",
    ],
    winConditions: ["Risk tier matched to non-expired, stable-enough stock."],
    loseConditions: ["Wrong risk, misfire, expired item, or ignored anomaly."],
    offerRules: [
      rule("sell_charm", { riskLevel: "low", remedyTier: "charm", stockExpired: false, instability: "stable", stockReady: true }, ["Low risk takes a charm."]),
      rule("mix_potion", { riskLevel: "medium", remedyTier: "potion", stockExpired: false, instability: "stable", stockReady: true }, ["Medium risk takes potion."]),
      rule("write_ward", { riskLevel: "high", remedyTier: "ward", stockExpired: false, instability: "stable", stockReady: true }, ["High risk takes ward."]),
    ],
    edgeFailureActions: [
      edge("volatile_ward_misfire", { remedyTier: "ward", instability: "volatile" }, "business_minigame:ward_misfire_refund", "2x refund demand and public warning."),
      edge("expired_item_served", { stockExpired: true }, "business_minigame:expired_magic_item", "Ticket fails and anomaly risk rises."),
      edge("ignored_anomaly", { anomalyIgnored: true }, "business_minigame:shop_anomaly_pause", "Queue paused and satisfaction deducted."),
    ],
    interiorFixtureLabels: ["Risk outcome ward board", "Charm shelf", "Outcome matcher table", "Anomaly warning light"],
  }),
  exploration_guide: spec({
    typeId: "exploration_guide",
    businessName: "Westtrail Guide Table",
    gameTitle: "Route Freshness & Safety Assessment",
    objective: "Check map freshness and match the client's ambition to a route you can vouch for.",
    coreMechanic:
      "Read destination, purpose, freshness, and danger tier; refresh stale maps or choose briefing, expedition, or danger read.",
    uniqueTwist:
      "Freshness decays in real time and nervous moderate-route clients can be upsold to expedition to avoid injury.",
    uiElements: [
      ui("map_display_panel", "Map display panel", "Route cards with freshness and danger tier."),
      ui("customer_intent_card", "Customer intent card", "Destination, purpose, composure."),
      ui("service_buttons", "Service buttons", "Route Briefing, Guided Expedition, Danger Read."),
      ui("map_refresh_action", "Map refresh action", "Spend supply token to restore current freshness."),
      ui("guide_roster", "Guide roster", "Available guide slots for expeditions."),
    ],
    customerTypes: [
      customer("tourist", "Tourist", "Sightseeing, safe route briefing."),
      customer("gatherer", "Gatherer", "Moderate resource route."),
      customer("survey_contractor", "Survey Contractor", "Hazardous survey needs danger read or expedition."),
      customer("nervous_explorer", "Nervous Explorer", "Moderate route with injury risk; upsell recommended."),
    ],
    difficultyScaling: [
      tier("starter", "Three fresh safe/moderate routes."),
      tier("shop", "Six routes, freshness decay, limited roster."),
      tier("company", "Faster decay, nervous clients, refresh cost."),
      tier("regional", "Ten routes, simultaneous stale routes, rare discoveries."),
    ],
    edgeCases: [
      "Expired route briefing causes field injury and route lock.",
      "All guide slots filled blocks expedition acceptance.",
      "Hazardous route briefing has 50 percent injury risk.",
    ],
    winConditions: ["Correct service tier using fresh-enough map; bonus for nervous expedition upsell."],
    loseConditions: ["Expired map confirmed, wrong danger service, or full roster blocks expedition."],
    offerRules: [
      rule("route_briefing", { purpose: "sightseeing", dangerTier: "safe", freshness: "current", serviceTier: "briefing", guideSlotReady: true }, ["Safe current routes can receive briefings."]),
      rule("guided_expedition", { purpose: "gathering", dangerTier: "moderate", freshness: "current", serviceTier: "expedition", guideSlotReady: true }, ["Moderate routes can be expedition service, especially for nervous clients."]),
      rule("danger_read", { purpose: "survey", dangerTier: "hazardous", freshness: "current", serviceTier: "danger_read", guideSlotReady: true }, ["Hazardous routes require danger read."]),
    ],
    edgeFailureActions: [
      edge("expired_map_confirmed", { freshness: "expired", mapRefreshed: false }, "business_minigame:expired_map_injury", "Refund, injury, and route locked unsafe."),
      edge("guide_roster_full", { serviceTier: "expedition", guideSlotReady: false }, "business_minigame:guide_roster_full", "Cancel another expedition or decline."),
      edge("hazardous_briefing_only", { dangerTier: "hazardous", serviceTier: "briefing" }, "business_minigame:hazardous_briefing_injury_risk", "Retroactive injury penalty risk."),
    ],
    interiorFixtureLabels: ["Route freshness map table", "Safety hazard pin board", "Trail supply crate", "Guide booking bench"],
  }),
  custom_home_property_development: spec({
    typeId: "custom_home_property_development",
    businessName: "Keylot Property Office",
    gameTitle: "Build-Stage & Permit Gate",
    objective: "Identify the project stage, check permits, and never sell a build package before clearance.",
    coreMechanic:
      "Read inquiry, mid-build, or final-install stage and verify cleared, pending, or blocked permit status before offering estimate, permit packet, or build package.",
    uniqueTwist:
      "Deadline pressure rises by stage and excessive expedite fees trigger follow-up audits.",
    uiElements: [
      ui("customer_project_card", "Customer project card", "Property type, stage, deadline."),
      ui("offer_buttons", "Offer buttons", "Estimate, Permit Packet, Build Package."),
      ui("permit_status_board", "Permit status board", "Cleared, pending, blocked, expedite."),
      ui("material_stock_panel", "Material stock panel", "Build package material quantities."),
      ui("expedite_fee_counter", "Expedite fee counter", "Audit risk from high expedite spend."),
    ],
    customerTypes: [
      customer("new_owner", "New Owner", "Estimate stage."),
      customer("mid_build_contractor", "Mid-Build Contractor", "Permit stage and deadline."),
      customer("final_stage_owner", "Final-Stage Owner", "Build package and cleared permit."),
      customer("inspector_visit", "Inspector Visit", "Audits blocked projects served packages."),
    ],
    difficultyScaling: [
      tier("starter", "Estimate and permit only."),
      tier("shop", "All stages, blocked permits, material stock."),
      tier("company", "Deadlines and inspector events."),
      tier("regional", "Backlogged permit office and shortages."),
    ],
    edgeCases: [
      "Build package on pending permit causes compliance stop.",
      "Insufficient materials locks final-stage package.",
      "Excess expedite fees trigger next-shift audit.",
    ],
    winConditions: ["Correct stage, permit status, and sufficient materials before deadline."],
    loseConditions: ["Blocked permit package, timeout, or material stockout."],
    offerRules: [
      rule("cost_estimate", { projectStage: "inquiry", permitStatus: "not_required", selectedService: "estimate", materialsReady: true }, ["Inquiry stage gets an estimate."]),
      rule("permit_packet", { projectStage: "mid_build", permitStatus: "pending", selectedService: "permit_packet", materialsReady: true }, ["Mid-build gets permit packet while permit is pending or cleared."]),
      rule("starter_build_package", { projectStage: "final_install", permitStatus: "cleared", selectedService: "build_package", materialsReady: true }, ["Final install requires cleared permit and materials."]),
    ],
    edgeFailureActions: [
      edge("pending_permit_build_package", { selectedService: "build_package", permitStatus: "pending" }, "business_minigame:property_compliance_stop", "Partial material refund and inspector log."),
      edge("blocked_permit_build_package", { selectedService: "build_package", permitStatus: "blocked" }, "business_minigame:blocked_permit_fine", "Significant compliance fine."),
      edge("build_material_stockout", { selectedService: "build_package", materialsReady: false }, "business_minigame:build_materials_missing", "Final-stage customer waits until stock arrives."),
    ],
    interiorFixtureLabels: ["Build stage permit board", "Blueprint drafting table", "Permit packet tray", "Material quote shelf"],
  }),
  general_trader: spec({
    typeId: "general_trader",
    businessName: "Brightcart General House",
    gameTitle: "Price-Board Demand Matching",
    objective: "Read urgency, check live prices, and know when to upsell.",
    coreMechanic:
      "Serve requested items from stock while using urgency, budget tier, live prices, and market intel to decide whether to upsell.",
    uniqueTwist:
      "Holding stock through a fall creates dead inventory that occupies a slot until marked down.",
    uiElements: [
      ui("customer_request_card", "Customer request card", "Item, urgency signal, budget tier."),
      ui("live_price_board", "Live price board", "Current prices and trend arrows."),
      ui("offer_buttons", "Offer buttons", "Road Rations, Repair Supplies, Special Order."),
      ui("upsell_prompt", "Upsell prompt", "Visible for standard/high-spend customers."),
      ui("market_intel_ticker", "Market intel ticker", "Predicted price shift for one item."),
    ],
    customerTypes: [
      customer("local_buyer", "Local Buyer", "Budget; refuses upsell."),
      customer("supply_runner", "Supply Runner", "Standard tier; relevant upsell possible."),
      customer("expedition_leader", "Expedition Leader", "High spend; complete kit."),
      customer("price_sensitive_merchant", "Price-Sensitive Merchant", "Bulk buys below average price."),
    ],
    difficultyScaling: [
      tier("starter", "Two items, no fluctuation."),
      tier("shop", "Price board and upsell prompt."),
      tier("company", "Market intel, dead inventory, merchant events."),
      tier("regional", "Mid-shift shifts and stockout cascades."),
    ],
    edgeCases: [
      "Upsell to budget customer causes walkout and distrust.",
      "Dead inventory requires markdown at loss.",
      "Bulk merchant can drain stock and trigger next stockout complaint.",
    ],
    winConditions: ["Correct item for tier; bonus for smart market timing."],
    loseConditions: ["Budget upsell, stockout cascade, or timeout."],
    offerRules: [
      rule("sell_road_rations", { requestedItem: "road_rations", budgetTier: "budget", upsellAccepted: false, stockReady: true, priceTrendHandled: true }, ["Budget road-ration buyers must not be upsold."]),
      rule("sell_repair_supplies", { requestedItem: "repair_supplies", budgetTier: "standard", upsellAccepted: false, stockReady: true, priceTrendHandled: true }, ["Repair supplies must match stock and current price."]),
      rule("broker_special_order", { requestedItem: "special_order", budgetTier: "high_spend", upsellAccepted: true, stockReady: true, priceTrendHandled: true }, ["High spend customers can accept special order upsell."]),
    ],
    edgeFailureActions: [
      edge("budget_upsell_walkout", { budgetTier: "budget", upsellAccepted: true }, "business_minigame:budget_upsell_walkout", "Customer leaves and distrust flag shortens patience."),
      edge("dead_inventory", { priceTrendHandled: false, priceTrend: "falling" }, "business_minigame:dead_inventory_markdown_required", "Stock slot locked until markdown."),
      edge("bulk_merchant_stockout", { bulkMerchantDrainedStock: true }, "business_minigame:merchant_stockout_cascade", "Next matching customer leaves."),
    ],
    interiorFixtureLabels: ["Live price board", "Demand matching shelf", "Market intel ticker", "Ready order crate"],
  }),
  hunter_wild_meat: spec({
    typeId: "hunter_wild_meat",
    businessName: "Ridgecooler Larder",
    gameTitle: "Cold Chain & Ecology Counter",
    objective: "Sell the right cut at the right freshness while respecting ecology limits.",
    coreMechanic:
      "Use cold storage species, cut type, preservation timer, and ecology gauge before serving meat, hides, or control advice.",
    uniqueTwist:
      "Popular species can become protected mid-shift, locking their cold slots and forcing diversions.",
    uiElements: [
      ui("cold_storage_panel", "Cold storage panel", "Species, cut, timer, quantity."),
      ui("customer_ticket", "Customer ticket", "Cut or advice request with freshness badge."),
      ui("offer_buttons", "Offer buttons", "Wild Meat, Hide Bundle, Control Advice."),
      ui("ecology_gauge", "Ecology gauge", "Per-species shift sales threshold."),
      ui("protected_species_warning", "Protected species warning", "Red border locks species sales."),
    ],
    customerTypes: [
      customer("restaurant_buyer", "Restaurant Buyer", "Fresh wild meat."),
      customer("crafter", "Crafter", "Hide bundles, no freshness."),
      customer("pest_control_client", "Pest Control Client", "Advice, no stock."),
      customer("rare_collector", "Rare Collector", "Rare cut and fast ecology fill."),
    ],
    difficultyScaling: [
      tier("starter", "Two species, no ecology."),
      tier("shop", "Four species, ecology and protection."),
      tier("company", "Rare species and rush events."),
      tier("regional", "Migration shifts and cold storage malfunction."),
    ],
    edgeCases: [
      "Locked requested species requires redirect or decline.",
      "Preservation timer zero triggers inspection after repeat.",
      "Pest control advice helps reset ecology.",
    ],
    winConditions: ["Correct cut and freshness while keeping ecology below threshold."],
    loseConditions: ["Redirect failure, spoilage inspection, or timeout."],
    offerRules: [
      rule("sell_wild_meat", { cutType: "wild_meat", freshnessGrade: "fresh", ecologyLocked: false, stockReady: true }, ["Restaurant meat requires fresh stock and unlocked species."]),
      rule("prepare_hide_bundle", { cutType: "hide_bundle", freshnessGrade: "any", ecologyLocked: false, stockReady: true }, ["Hide bundles ignore freshness but still respect ecology locks."]),
      rule("wildlife_control_advice", { cutType: "advice", freshnessGrade: "none", ecologyLocked: false, stockReady: true }, ["Advice consumes no cold stock and helps ecology recovery."]),
    ],
    edgeFailureActions: [
      edge("protected_species_locked", { ecologyLocked: true }, "business_minigame:protected_species_locked", "Redirect or decline, third redirect stops visits."),
      edge("cold_slot_spoilage", { preservationExpired: true }, "business_minigame:larder_spoilage_event", "Waste penalty and inspection risk."),
      edge("consecutive_redirects", { redirectCount: 3 }, "business_minigame:larder_unreliable_flag", "Customer stops visiting for two shifts."),
    ],
    interiorFixtureLabels: ["Cold chain larder shelf", "Ecology counter board", "Freshness scale", "Wrapped meat crate"],
  }),
  medical_doctor: spec({
    typeId: "medical_doctor",
    businessName: "Greenlamp Walk-In Clinic",
    gameTitle: "Severity Triage with Priority Queue",
    objective: "Read severity, prioritize critical patients, and never under-treat critical cases.",
    coreMechanic:
      "Assign queue patients to checkup, medkit, or urgent treatment based on visible severity, symptoms, and worsening state.",
    uniqueTwist:
      "Critical patients can jump queue with a priority flag; urgent stockout during critical visit is a severe fail.",
    uiElements: [
      ui("patient_queue", "Patient queue", "Up to five patients with severity, symptom, patience."),
      ui("priority_flag_button", "Priority flag button", "Move critical patient to front."),
      ui("treatment_track_buttons", "Treatment track buttons", "Checkup, Medkit, Urgent Treatment."),
      ui("medicine_stock_panel", "Medicine stock panel", "Per-track supply counts."),
      ui("outbreak_alert_bar", "Outbreak alert bar", "Shared symptom wave warning."),
    ],
    customerTypes: [
      customer("standard_patient", "Standard Patient", "Mild, checkup."),
      customer("injured_worker", "Injured Worker", "Moderate, medkit."),
      customer("critical_patient", "Critical Patient", "Urgent treatment and priority."),
      customer("outbreak_wave", "Outbreak Wave", "Multiple moderate+ patients."),
    ],
    difficultyScaling: [
      tier("starter", "Mild and moderate only."),
      tier("shop", "Critical severity and priority flag."),
      tier("company", "Outbreak and stock depletion."),
      tier("regional", "Misleading cues and simultaneous waves."),
    ],
    edgeCases: [
      "Checkup on critical triggers immediate emergency escalation.",
      "Urgent stock zero with critical patient pauses for emergency restock.",
      "Ignored outbreak alert doubles next-shift arrivals.",
    ],
    winConditions: ["Correct severity-to-treatment match; bonus for fast critical priority."],
    loseConditions: ["Critical under-treatment, urgent stockout, or ignored outbreak warning."],
    offerRules: [
      rule("basic_checkup", { severity: "mild", treatmentTrack: "checkup", priorityFlagged: false, stockReady: true }, ["Mild cases get checkup."]),
      rule("field_medkit_sale", { severity: "moderate", treatmentTrack: "medkit", priorityFlagged: false, stockReady: true }, ["Moderate injury gets medkit."]),
      rule("urgent_treatment", { severity: "critical", treatmentTrack: "urgent", priorityFlagged: true, stockReady: true }, ["Critical case must be prioritized and treated urgently."]),
    ],
    edgeFailureActions: [
      edge("critical_given_checkup", { severity: "critical", treatmentTrack: "checkup" }, "business_minigame:critical_undertriage", "Collapse and public health warning."),
      edge("urgent_stockout", { severity: "critical", stockReady: false }, "business_minigame:urgent_stockout_public_warning", "Emergency transfer and reputation penalty."),
      edge("outbreak_ignored", { outbreakAlertIgnored: true }, "business_minigame:outbreak_warning_ignored", "Next shift outbreak escalation."),
    ],
    interiorFixtureLabels: ["Severity triage board", "Treatment cot", "Medicine cabinet", "Priority queue marker"],
  }),
  teleport_owner: spec({
    typeId: "teleport_owner",
    businessName: "Returnstone Pad Office",
    gameTitle: "Access Rights & Link Stability Gate",
    objective: "Verify link stability, access tier, and fuel before sending anyone through.",
    coreMechanic:
      "Check destination stability, access rights, and fuel; manually stabilize yellow links and never use red links.",
    uniqueTwist:
      "Emergency returns bypass access and queue priority but consume double fuel, creating cascade pressure.",
    uiElements: [
      ui("link_stability_panel", "Link stability panel", "Destination, stability, access level, fuel cost."),
      ui("customer_access_card", "Customer access card", "Destination, access tier, urgency."),
      ui("offer_buttons", "Offer buttons", "Access Token, Emergency Return, Stability Check."),
      ui("fuel_reserve_gauge", "Fuel reserve gauge", "Fuel units remaining."),
      ui("manual_stabilise_action", "Manual stabilise action", "Restore yellow link to green with fuel."),
    ],
    customerTypes: [
      customer("standard_traveller", "Standard Traveller", "Public green link."),
      customer("guild_member", "Guild Member", "Guild/public link."),
      customer("emergency_return", "Emergency Return", "Bypass access, double fuel."),
      customer("vip_shortcut", "VIP Shortcut", "VIP green link only."),
    ],
    difficultyScaling: [
      tier("starter", "Three public green destinations."),
      tier("shop", "Six destinations, guild/VIP, fuel."),
      tier("company", "Emergency returns and drift timers."),
      tier("regional", "Emergency surges and cargo access."),
    ],
    edgeCases: [
      "Red link miss-jumps customer and takes link offline.",
      "Public customer on VIP link creates access violation.",
      "Emergency surge can drain fuel below stabilization needs.",
    ],
    winConditions: ["Correct access tier, green/stabilized link, sufficient fuel."],
    loseConditions: ["Red miss-jump, unauthorized access, or empty fuel during surge."],
    offerRules: [
      rule("issue_access_token", { accessTier: "public", linkStability: "green", accessAuthorized: true, fuelReady: true, selectedService: "access_token" }, ["Public access token needs authorized green link."]),
      rule("emergency_return", { accessTier: "emergency", linkStability: "green", accessAuthorized: true, fuelReady: true, selectedService: "emergency_return" }, ["Emergency return bypasses normal access but needs fuel."]),
      rule("pad_stability_check", { accessTier: "any", linkStability: "yellow", accessAuthorized: true, fuelReady: true, selectedService: "stability_check" }, ["Yellow links should receive stability check before jump."]),
    ],
    edgeFailureActions: [
      edge("red_link_jump", { linkStability: "red", stabilized: false }, "business_minigame:teleport_miss_jump", "Critical incident and link offline."),
      edge("unauthorized_access", { accessAuthorized: false }, "business_minigame:teleport_access_violation", "Compliance rating drops; repeated violations suspend permit."),
      edge("fuel_empty_emergency_surge", { emergencySurge: true, fuelReady: false }, "business_minigame:teleport_fuel_cascade", "Links drift red under emergency pressure."),
    ],
    interiorFixtureLabels: ["Access rights console", "Link stability meter", "Pad key token rack", "Private route ledger"],
  }),
  waste_sanitation_cleanup: spec({
    typeId: "waste_sanitation_cleanup",
    businessName: "Clearbarrel Cleanup Yard",
    gameTitle: "Contamination Classification & Fleet Dispatch",
    objective: "Classify waste correctly and dispatch the matching vehicle and gear.",
    coreMechanic:
      "Read situation cues, classify standard, hazardous, or exotic, then dispatch matching fleet with protective gear.",
    uniqueTwist:
      "District cleanliness is persistent; low cleanliness triggers audits where any wrong classification is fined immediately.",
    uiElements: [
      ui("situation_card", "Situation card", "Location, waste cues, urgency."),
      ui("classification_buttons", "Classification buttons", "Standard Pickup, Decontamination Kit, Clean Certificate."),
      ui("fleet_panel", "Fleet panel", "Vehicle status and gear rating."),
      ui("district_cleanliness_gauge", "District cleanliness gauge", "Persistent district health."),
      ui("inspector_audit_indicator", "Inspector audit indicator", "Next five tickets audited."),
    ],
    customerTypes: [
      customer("routine_pickup_client", "Routine Pickup Client", "Standard vehicle."),
      customer("hazard_report_client", "Hazard Report Client", "Hazmat vehicle."),
      customer("exotic_spill_alert", "Exotic Matter Spill Alert", "Exotic decon unit."),
      customer("inspector_audit_visit", "Inspector Audit Visit", "Scores classification decisions."),
    ],
    difficultyScaling: [
      tier("starter", "Routine pickup only."),
      tier("shop", "All waste types and cleanliness."),
      tier("company", "Exotic events and fleet limits."),
      tier("regional", "Overlapping audits, spills, repairs."),
    ],
    edgeCases: [
      "Standard truck to hazard/exotic injures worker and drops cleanliness by 20.",
      "Unavailable decon unit requires mutual aid delay.",
      "Cleanliness zero suspends contracts for one shift.",
    ],
    winConditions: ["Correct waste type and vehicle; bonus for cleanliness above threshold."],
    loseConditions: ["Wrong vehicle injury, unavailable decon, or cleanliness reaches zero."],
    offerRules: [
      rule("trash_pickup", { wasteType: "standard", vehicleType: "standard_truck", gearRating: "standard", cleanlinessAboveZero: true, fleetReady: true }, ["Routine waste uses standard truck."]),
      rule("decontam_kit", { wasteType: "hazardous", vehicleType: "hazmat_vehicle", gearRating: "hazmat", cleanlinessAboveZero: true, fleetReady: true }, ["Hazardous waste needs hazmat gear."]),
      rule("clean_certificate", { wasteType: "inspection", vehicleType: "audit_check", gearRating: "full_exotic", cleanlinessAboveZero: true, fleetReady: true }, ["Clean certificates require inspection-grade check."]),
    ],
    edgeFailureActions: [
      edge("standard_truck_to_hazard", { wasteType: "hazardous", vehicleType: "standard_truck" }, "business_minigame:cleanup_worker_injury", "Truck removed two shifts and cleanliness -20."),
      edge("exotic_decon_unavailable", { wasteType: "exotic", vehicleType: "exotic_decon_unit", fleetReady: false }, "business_minigame:mutual_aid_required", "Reduced delay penalty instead of immediate service."),
      edge("cleanliness_zero", { cleanlinessAboveZero: false }, "business_minigame:district_health_review", "Contracts suspended for one shift."),
    ],
    interiorFixtureLabels: ["Waste classification board", "Fleet dispatch map", "Exotic decon unit marker", "District cleanliness gauge"],
  }),
  repair_maintenance_person: spec({
    typeId: "repair_maintenance_person",
    businessName: "Hingehall Repair Shop",
    gameTitle: "Work Order Urgency & Object Identification",
    objective: "Identify the object and urgency before dispatching the right response.",
    coreMechanic:
      "Parse work order language and maintenance history to choose fixture fix, furniture patch, or urgent call.",
    uniqueTwist:
      "New or lapsed customers can understate emergencies; wrong dispatch doubles parts and time after escalation.",
    uiElements: [
      ui("customer_work_order_card", "Customer work order card", "Object description, urgency cues, history badge."),
      ui("object_categorybuttons", "Object category buttons", "Fixture Fix, Furniture Patch, Urgent Call."),
      ui("parts_stock_panel", "Parts stock panel", "Standard, specialty, emergency kit counts."),
      ui("urgency_confidence_indicator", "Urgency confidence indicator", "Accuracy bonus gauge."),
      ui("escalation_warning", "Escalation warning", "Wrong dispatch worsening banner."),
    ],
    customerTypes: [
      customer("subscriber", "Subscriber", "Routine fixture/furniture."),
      customer("new_customer", "New Customer", "Variable urgency from cues only."),
      customer("lapsed_subscriber", "Lapsed Subscriber", "Understates severity."),
      customer("emergency_caller", "Emergency Caller", "Interrupts queue and always urgent."),
    ],
    difficultyScaling: [
      tier("starter", "Subscribers and two categories."),
      tier("shop", "New customers and emergencies."),
      tier("company", "Lapsed traps and confidence bonus."),
      tier("regional", "Overlapping emergencies and specialty shortages."),
    ],
    edgeCases: [
      "Fixture fix on facility emergency escalates and doubles parts/time.",
      "Dismissed emergency self-escalates to critical damage.",
      "Lapsed subscriber understatement traps language-only dispatching.",
    ],
    winConditions: ["Correct category and urgency with stock before patience."],
    loseConditions: ["Wrong urgency, dismissed emergency, or urgent stockout."],
    offerRules: [
      rule("fixture_fix", { objectCategory: "fixture", urgency: "routine", historyBadgeChecked: true, partsReady: true }, ["Routine fixtures get fixture fix."]),
      rule("furniture_patch", { objectCategory: "furniture", urgency: "moderate", historyBadgeChecked: true, partsReady: true }, ["Furniture damage gets furniture patch."]),
      rule("urgent_service_call", { objectCategory: "facility_emergency", urgency: "critical", historyBadgeChecked: true, partsReady: true }, ["Facility emergencies require urgent call."]),
    ],
    edgeFailureActions: [
      edge("fixture_on_facility_emergency", { objectCategory: "facility_emergency", selectedService: "fixture_fix" }, "business_minigame:repair_escalation_double_parts", "Original ticket failed; complaint lodged."),
      edge("emergency_dismissed", { emergencyDismissed: true }, "business_minigame:critical_damage_event", "Property damage and reputation penalty."),
      edge("lapsed_badge_ignored", { customerHistory: "lapsed", historyBadgeChecked: false }, "business_minigame:lapsed_understatement_trap", "Escalation appears more often at scale."),
    ],
    interiorFixtureLabels: ["Work order card board", "Object category bench", "Urgency confidence gauge", "Parts stock shelf"],
  }),
  food_service_restaurant: spec({
    typeId: "food_service_restaurant",
    businessName: "Redpot Service Kitchen",
    gameTitle: "Buff Economy Service Line",
    objective: "Match activity need to meal buff, keep ingredients fresh, and survive rushes.",
    coreMechanic:
      "Translate labour, travel, or recovery activity into worker meal, road ration, or healing soup while checking ingredient freshness.",
    uniqueTwist:
      "Rush events double arrivals and sanitation checks can close the kitchen if too many ingredients are Aging or worse.",
    uiElements: [
      ui("activity_need_card", "Activity need card", "Customer activity cues without explicit food order."),
      ui("meal_type_buttons", "Meal type buttons", "Worker Meal, Road Ration, Healing Soup."),
      ui("service_line_panel", "Service line panel", "Meal stations with freshness and quantity."),
      ui("rush_indicator", "Rush indicator", "Double queue, half patience."),
      ui("sanitation_check_interrupt", "Sanitation check interrupt", "Swap aging ingredients before clear."),
    ],
    customerTypes: [
      customer("worker", "Worker", "Labour buff, worker meal."),
      customer("traveller", "Traveller", "Travel buff, road ration."),
      customer("recovering", "Injured / Recovering", "Recovery buff, Fresh healing soup."),
      customer("large_group_order", "Large Group Order", "Two to three same meal type."),
    ],
    difficultyScaling: [
      tier("starter", "Two meal types, no freshness."),
      tier("shop", "All meals, freshness, rush."),
      tier("company", "Strict soup freshness, sanitation, groups."),
      tier("regional", "Overlapping rushes and proactive resupply."),
    ],
    edgeCases: [
      "Aging ingredient in healing soup creates negative memory.",
      "Three flagged ingredients closes kitchen 15 seconds.",
      "Queue beyond five during rush causes walk-out wave.",
    ],
    winConditions: ["Correct meal type with fresh enough ingredients."],
    loseConditions: ["Wrong meal, aging soup complaint, sanitation closure, or walk-out wave."],
    offerRules: [
      rule("serve_worker_meal", { activityNeed: "labour", mealType: "worker_meal", ingredientFreshness: "good", rushQueueSafe: true, stockReady: true }, ["Labour activity maps to worker meal."]),
      rule("pack_road_ration", { activityNeed: "travel", mealType: "road_ration", ingredientFreshness: "good", rushQueueSafe: true, stockReady: true }, ["Travel activity maps to road ration."]),
      rule("serve_healing_soup", { activityNeed: "recovery", mealType: "healing_soup", ingredientFreshness: "fresh", rushQueueSafe: true, stockReady: true }, ["Recovery activity requires Fresh healing soup."]),
    ],
    edgeFailureActions: [
      edge("aging_healing_soup", { mealType: "healing_soup", ingredientFreshness: "aging" }, "business_minigame:healing_soup_negative_memory", "Complaint and permanent shorter patience at business."),
      edge("sanitation_three_flagged", { sanitationFlaggedIngredients: 3 }, "business_minigame:kitchen_closed_15s", "Kitchen closure while queue grows."),
      edge("rush_walkout_wave", { rushQueueSafe: false }, "business_minigame:rush_walkout_wave", "Customers beyond position five leave."),
    ],
    interiorFixtureLabels: ["Buff service line", "Meal station row", "Fresh ingredient shelf", "Sanitation check marker"],
  }),
  courier: spec({
    typeId: "courier",
    businessName: "Stampspur Courier Office",
    gameTitle: "Trust Ladder & Cargo Matching",
    objective: "Match cargo type to trust level, dispatch sensitive loads correctly, and build the ladder.",
    coreMechanic:
      "Read cargo tags, destination, size, trust rung, hazard flags, and timers before selecting standard parcel, locked delivery, or medicine run.",
    uniqueTwist:
      "Failed delivery drops trust; higher trust unlocks better cargo and pay but increases risk.",
    uiElements: [
      ui("cargo_intake_card", "Cargo intake card", "Cargo tag, destination, size, handling."),
      ui("trust_ladder_display", "Trust ladder display", "Rungs 1-5 and progress."),
      ui("service_tier_buttons", "Service tier buttons", "Standard Parcel, Locked Delivery, Medicine Run."),
      ui("route_hazard_indicator", "Route hazard indicator", "Acknowledge danger before dispatch."),
      ui("medicine_dispatch_timer", "Medicine dispatch timer", "Countdown to expiry."),
    ],
    customerTypes: [
      customer("standard_sender", "Standard Sender", "Any trust rung."),
      customer("fragile_goods_client", "Fragile Goods Client", "Trust 2+."),
      customer("restricted_document_client", "Restricted Document Client", "Trust 3+."),
      customer("medicine_emergency", "Medicine Emergency", "Trust 4+ and timer."),
    ],
    difficultyScaling: [
      tier("starter", "Standard parcels only."),
      tier("shop", "Fragile, locked delivery, trust ladder."),
      tier("company", "Restricted, medicine, timer."),
      tier("regional", "Multiple medicine timers and hazards."),
    ],
    edgeCases: [
      "Restricted cargo under trust causes compliance event and trust -1.",
      "Medicine timer expiry requires disposal and trust -1.",
      "Unacknowledged route hazard loses package and trust -2.",
    ],
    winConditions: ["Cargo type, trust, service tier, timers, and hazards all match."],
    loseConditions: ["Above-trust dispatch, expired medicine, unacknowledged hazard, or trust rung 0."],
    offerRules: [
      rule("standard_parcel", { cargoTag: "standard", trustRung: 1, serviceTier: "standard_parcel", hazardAcknowledged: true, timerSafe: true }, ["Standard cargo is open to any trust rung."], { min: { trustRung: 1 } }),
      rule("locked_delivery", { cargoTag: "restricted", trustRung: 3, serviceTier: "locked_delivery", hazardAcknowledged: true, timerSafe: true }, ["Locked/restricted cargo requires trust 3+."], { min: { trustRung: 3 } }),
      rule("medicine_run", { cargoTag: "medicine", trustRung: 4, serviceTier: "medicine_run", hazardAcknowledged: true, timerSafe: true }, ["Medicine runs require trust 4+ and active timer."], { min: { trustRung: 4 } }),
    ],
    edgeFailureActions: [
      edge("restricted_under_trust", { cargoTag: "restricted", trustRung: 2 }, "business_minigame:courier_restricted_under_trust", "Refund and trust ladder -1."),
      edge("medicine_timer_expired", { cargoTag: "medicine", timerSafe: false }, "business_minigame:medicine_expired_dispose", "Dispose cargo and trust ladder -1."),
      edge("hazard_not_acknowledged", { hazardAcknowledged: false }, "business_minigame:route_hazard_lost_package", "Trust ladder -2 and route closed."),
    ],
    interiorFixtureLabels: ["Trust ladder board", "Cargo intake scale", "Route hazard marker", "Medicine dispatch timer"],
  }),
  hospitality_inn_hotel_shelter: spec({
    typeId: "hospitality_inn_hotel_shelter",
    businessName: "Lanternrest Road Inn",
    gameTitle: "Dual-Mode Front Desk with Room QA",
    objective: "Book the right room, run QA, and flip to crisis shelter mode when needed.",
    coreMechanic:
      "Match lodging request to standard room, shelter bed, or room-meal bundle while checking room availability and cleanliness status.",
    uniqueTwist:
      "Crisis mode floods shelter requests at civic rates and penalizes inns that overbook shelter capacity.",
    uiElements: [
      ui("room_board", "Room board", "Room type, cleanliness, occupant."),
      ui("guest_request_card", "Guest request card", "Need, group size, budget, special flags."),
      ui("offer_buttons", "Offer buttons", "Standard Room, Shelter Bed, Room-Meal Bundle."),
      ui("qa_check_action", "QA check action", "Clear needs-check rooms to clean."),
      ui("crisis_mode_banner", "Crisis mode banner", "Civic rate, trust, shelter capacity."),
    ],
    customerTypes: [
      customer("traveller", "Traveller", "Clean standard room."),
      customer("displaced_resident", "Displaced Resident", "Shelter bed and civic trust."),
      customer("tourist", "Tourist", "Premium clean room or bundle."),
      customer("shelter_wave", "Shelter Wave", "Many displaced guests during crisis."),
    ],
    difficultyScaling: [
      tier("starter", "Four rooms, no QA."),
      tier("shop", "Eight rooms, QA, crisis mode."),
      tier("company", "Twelve rooms, review penalties, civic trust."),
      tier("regional", "Sixteen rooms, group bookings and crisis/tourist overlap."),
    ],
    edgeCases: [
      "Tourist in needs-check/dirty room reduces all new guest patience by 15%.",
      "Shelter beds unavailable in crisis can revoke emergency contract after five turnaways.",
      "Group booking shortage forces delay or split-room satisfaction loss.",
    ],
    winConditions: ["Correct room type, clean room, booked before patience; bonus for crisis trust."],
    loseConditions: ["Dirty tourist room, no shelter in crisis, or revoked civic contract."],
    offerRules: [
      rule("book_basic_room", { guestNeed: "standard_room", roomType: "standard", cleanliness: "clean", roomAvailable: true, crisisMode: false }, ["Standard travellers need clean standard room."]),
      rule("offer_shelter_bed", { guestNeed: "shelter_bed", roomType: "shelter", cleanliness: "clean", roomAvailable: true, civicTrustSafe: true }, ["Shelter guests need available clean shelter bed."]),
      rule("guest_meal_bundle", { guestNeed: "room_meal_bundle", roomType: "bundle", cleanliness: "clean", roomAvailable: true, mealStockReady: true }, ["Bundle guests need clean room and meal stock."]),
    ],
    edgeFailureActions: [
      edge("tourist_dirty_room", { guestType: "tourist", cleanliness: "dirty" }, "business_minigame:tourist_dirty_room_review", "Next two shifts all guest patience -15%."),
      edge("crisis_no_shelter", { crisisMode: true, roomType: "shelter", roomAvailable: false }, "business_minigame:civic_trust_penalty", "Shelter turnaways count toward contract revocation."),
      edge("civic_contract_revoked", { crisisTurnaways: 6 }, "business_minigame:emergency_shelter_contract_revoked", "Emergency shelter contract revoked."),
    ],
    interiorFixtureLabels: ["Room board", "QA check cart", "Crisis shelter banner", "Room key wall"],
  }),
};

export function getHarthmereBusinessMiniGameSpec(
  typeId: HarthmereEconomyBusinessTypeId
) {
  return HARTHMERE_BUSINESS_MINIGAME_SPECS[typeId];
}

function decisionMatches(
  decision: HarthmereBusinessMiniGameDecision,
  expected: HarthmereBusinessMiniGameDecision
) {
  return Object.entries(expected).every(
    ([key, value]) => decision[key] === value
  );
}

export function createHarthmereBusinessMiniGameDecisionForOffer(
  typeId: HarthmereEconomyBusinessTypeId,
  offerId: string
): HarthmereBusinessMiniGameDecision {
  const spec = getHarthmereBusinessMiniGameSpec(typeId);
  const offerRule = spec?.offerRules.find((candidate) => candidate.offerId === offerId);
  return offerRule ? { ...offerRule.exact } : {};
}

export function resolveHarthmereBusinessMiniGameDecision(input: {
  typeId: HarthmereEconomyBusinessTypeId;
  offerId: string;
  decision: HarthmereBusinessMiniGameDecision;
}): HarthmereBusinessMiniGameDecisionResult {
  const spec = getHarthmereBusinessMiniGameSpec(input.typeId);
  const failedRules: string[] = [];
  const passedRules: string[] = [];
  const warnings: string[] = [];
  if (!spec) {
    return {
      ok: false,
      specId: "missing_business_minigame_spec",
      typeId: input.typeId,
      offerId: input.offerId,
      passedRules,
      failedRules: ["missing_business_minigame_spec"],
      warnings: [`business_minigame:missing_spec:${input.typeId}`],
    };
  }

  for (const failure of spec.edgeFailureActions) {
    if (decisionMatches(input.decision, failure.when)) {
      failedRules.push(failure.failureId);
      warnings.push(failure.warning);
    }
  }

  const offerRule = spec.offerRules.find(
    (candidate) => candidate.offerId === input.offerId
  );
  if (!offerRule) {
    failedRules.push("offer_rule_missing");
    warnings.push(`business_minigame:offer_rule_missing:${input.offerId}`);
  } else {
    for (const [key, expected] of Object.entries(offerRule.exact)) {
      if (input.decision[key] === expected) {
        passedRules.push(`exact:${key}`);
      } else {
        failedRules.push(`exact:${key}`);
        warnings.push(`business_minigame:expected:${key}:${String(expected)}`);
      }
    }
    for (const [key, expected] of Object.entries(offerRule.min ?? {})) {
      const actual = Number(input.decision[key]);
      if (Number.isFinite(actual) && actual >= expected) {
        passedRules.push(`min:${key}`);
      } else {
        failedRules.push(`min:${key}`);
        warnings.push(`business_minigame:min:${key}:${expected}`);
      }
    }
    for (const [key, expected] of Object.entries(offerRule.max ?? {})) {
      const actual = Number(input.decision[key]);
      if (Number.isFinite(actual) && actual <= expected) {
        passedRules.push(`max:${key}`);
      } else {
        failedRules.push(`max:${key}`);
        warnings.push(`business_minigame:max:${key}:${expected}`);
      }
    }
    for (const [key, blocked] of Object.entries(offerRule.blocked ?? {})) {
      if (input.decision[key] === blocked) {
        failedRules.push(`blocked:${key}`);
        warnings.push(`business_minigame:blocked:${key}:${String(blocked)}`);
      } else {
        passedRules.push(`blocked:${key}`);
      }
    }
  }

  return {
    ok: failedRules.length === 0,
    specId: spec.specId,
    typeId: input.typeId,
    offerId: input.offerId,
    passedRules,
    failedRules,
    warnings,
  };
}
