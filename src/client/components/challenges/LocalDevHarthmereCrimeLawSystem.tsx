
import React from "react";

export const HARTHMERE_CRIME_LAW_SYSTEM_VERSION = "harthmere-crime-law-depth-v1";

export type HarthmereCrimeType = "theft" | "pickpocket" | "lockpicking" | "trespassing" | "assault" | "murder" | "smuggling" | "illegal_magic" | "bribery" | "arson";
export type HarthmereGuardResponseLevel = "warning" | "questioning" | "fine" | "confiscation" | "arrest_attempt" | "combat" | "reinforcements" | "city_lockdown";

export type HarthmereCrimeContext = {
  crimeType: HarthmereCrimeType;
  severity: number;
  value: number;
  witnesses: number;
  lineOfSight: boolean;
  noise: number;
  lighting: "dark" | "dim" | "normal" | "bright";
  disguiseQuality: number;
  guardAlertness: number;
  crowdDensity: number;
  legalStanding: number;
  notoriety: number;
  location: string;
  victimId?: string;
  itemIds?: string[];
};

export type HarthmereCrimeRecord = {
  crimeId: string;
  context: HarthmereCrimeContext;
  detected: boolean;
  detectionScore: number;
  response: HarthmereGuardResponseLevel;
  fineGold: number;
  confiscatedItemIds: string[];
  bountyGold?: number;
  evidenceExpiresAt: number;
};

export type HarthmereLegalAccessPurpose =
  | "ability_use"
  | "building_permit"
  | "business_license"
  | "restricted_service"
  | "property_entry"
  | "security_contract";

export type HarthmereLegalAccessContext = {
  purpose: HarthmereLegalAccessPurpose;
  legalStanding: number;
  townReputation: number;
  activeBountyGold?: number;
  requiredPermitId?: string;
  heldPermitIds?: string[];
  requiredLicenseId?: string;
  heldLicenseIds?: string[];
  minLegalStanding?: number;
  minTownReputation?: number;
  zoneMatches?: boolean;
  planApproved?: boolean;
  insuranceBonded?: boolean;
  licenseSuspended?: boolean;
};

export type HarthmereLegalAccessResult = {
  allowed: boolean;
  reasons: string[];
  warnings: string[];
  requiredActions: string[];
};

export const HARTHMERE_CRIME_SEVERITY: Record<HarthmereCrimeType, number> = {
  theft: 120,
  pickpocket: 180,
  lockpicking: 130,
  trespassing: 80,
  assault: 350,
  murder: 1500,
  smuggling: 500,
  illegal_magic: 420,
  bribery: 250,
  arson: 1200,
};

export const HARTHMERE_CRIME_EVIDENCE_MEMORY: Record<HarthmereCrimeType, { evidenceHours: number; rumorMultiplier: number }> = {
  theft: { evidenceHours: 48, rumorMultiplier: 0.8 },
  pickpocket: { evidenceHours: 24, rumorMultiplier: 0.7 },
  lockpicking: { evidenceHours: 24, rumorMultiplier: 0.6 },
  trespassing: { evidenceHours: 6, rumorMultiplier: 0.4 },
  assault: { evidenceHours: 72, rumorMultiplier: 1.0 },
  murder: { evidenceHours: 240, rumorMultiplier: 2.0 },
  smuggling: { evidenceHours: 72, rumorMultiplier: 1.2 },
  illegal_magic: { evidenceHours: 96, rumorMultiplier: 1.4 },
  bribery: { evidenceHours: 48, rumorMultiplier: 0.9 },
  arson: { evidenceHours: 168, rumorMultiplier: 1.8 },
};

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

export function calculateHarthmereEffectiveCrimeSeverity(ctx: Pick<HarthmereCrimeContext, "crimeType" | "severity">) {
  const severityModifier = Number.isFinite(ctx.severity) ? Math.max(0, Math.round(ctx.severity)) : 0;
  return HARTHMERE_CRIME_SEVERITY[ctx.crimeType] + severityModifier;
}

export function calculateHarthmereCrimeDetectionScore(ctx: HarthmereCrimeContext) {
  const base = calculateHarthmereEffectiveCrimeSeverity(ctx) / 20;
  const witness = ctx.witnesses * 15;
  const los = ctx.lineOfSight ? 25 : -20;
  const noise = clamp(ctx.noise, 0, 100) * 0.35;
  const lighting = ctx.lighting === "bright" ? 20 : ctx.lighting === "normal" ? 10 : ctx.lighting === "dim" ? -5 : -15;
  const disguise = -clamp(ctx.disguiseQuality, 0, 100) * 0.35;
  const alertness = clamp(ctx.guardAlertness, 0, 100) * 0.4;
  const crowd = ctx.crowdDensity > 70 && ctx.crimeType === "pickpocket" ? -10 : ctx.crowdDensity * 0.05;
  const reputation = ctx.legalStanding < -500 ? 12 : ctx.legalStanding > 2000 ? -10 : 0;
  const notoriety = ctx.notoriety > 5000 ? 8 : 0;
  return clamp(base + witness + los + noise + lighting + disguise + alertness + crowd + reputation + notoriety, 0, 100);
}

export function getHarthmereGuardResponseLevel(ctx: HarthmereCrimeContext, detectionScore = calculateHarthmereCrimeDetectionScore(ctx)): HarthmereGuardResponseLevel {
  const seriousness = calculateHarthmereEffectiveCrimeSeverity(ctx) + ctx.value + Math.max(0, -ctx.legalStanding / 2) + ctx.notoriety / 10;
  if (ctx.legalStanding <= -8000 || seriousness > 5500) return "city_lockdown";
  if (seriousness > 3500) return "reinforcements";
  if (seriousness > 2200) return "combat";
  if (seriousness > 1200) return "arrest_attempt";
  if (ctx.value > 250 || ctx.crimeType === "smuggling") return "confiscation";
  if (detectionScore > 45) return "fine";
  if (detectionScore > 25) return "questioning";
  return "warning";
}

export function calculateHarthmereFineGold(ctx: HarthmereCrimeContext) {
  const repeatOffender = ctx.legalStanding < -5000 ? 2 : ctx.legalStanding < -2000 ? 1.5 : 1;
  const notoriety = 1 + Math.min(1, ctx.notoriety / 20_000);
  return Math.max(1, Math.ceil((calculateHarthmereEffectiveCrimeSeverity(ctx) + ctx.value * 0.75) * repeatOffender * notoriety / 10));
}

export function createHarthmereCrimeRecord(ctx: HarthmereCrimeContext): HarthmereCrimeRecord {
  const detectionScore = calculateHarthmereCrimeDetectionScore(ctx);
  const witnessCanReport = ctx.witnesses > 0 && (ctx.lineOfSight || ctx.noise >= 25 || ctx.lighting !== "dark");
  const detected = detectionScore >= 35 || witnessCanReport;
  const response = getHarthmereGuardResponseLevel(ctx, detectionScore);
  const confiscatedItemIds = detected && ["confiscation", "arrest_attempt", "combat", "reinforcements", "city_lockdown"].includes(response) ? (ctx.itemIds ?? []) : [];
  const evidence = HARTHMERE_CRIME_EVIDENCE_MEMORY[ctx.crimeType];
  const fineGold = detected ? calculateHarthmereFineGold(ctx) : 0;
  const bountyGold = detected && (["murder", "arson", "smuggling", "assault"].includes(ctx.crimeType) || ctx.legalStanding < -5000) ? Math.ceil(fineGold * 1.5) : undefined;
  const evidenceSeverityHours = Math.min(72, Math.floor(calculateHarthmereEffectiveCrimeSeverity(ctx) / 250));
  return { crimeId: `crime-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`, context: ctx, detected, detectionScore, response, fineGold, confiscatedItemIds, bountyGold, evidenceExpiresAt: Date.now() + (evidence.evidenceHours + evidenceSeverityHours) * 60 * 60 * 1000 };
}

export function performHarthmereTheftAction(ctx: Omit<HarthmereCrimeContext, "crimeType">) { return createHarthmereCrimeRecord({ ...ctx, crimeType: "theft" }); }
export function performHarthmerePickpocketAction(ctx: Omit<HarthmereCrimeContext, "crimeType">) { return createHarthmereCrimeRecord({ ...ctx, crimeType: "pickpocket" }); }
export function performHarthmereLockpickAction(ctx: Omit<HarthmereCrimeContext, "crimeType">) { return createHarthmereCrimeRecord({ ...ctx, crimeType: "lockpicking" }); }
export function escalateHarthmereTrespass(ctx: Omit<HarthmereCrimeContext, "crimeType">, secondsTrespassing: number) { return createHarthmereCrimeRecord({ ...ctx, crimeType: "trespassing", severity: ctx.severity + Math.floor(secondsTrespassing / 10) }); }

export function offerHarthmereBribe(ctx: HarthmereCrimeContext, bribeGold: number, guardCorruption: number) {
  const needed = calculateHarthmereFineGold(ctx) * (1.2 - clamp(guardCorruption, 0, 100) / 200);
  if (guardCorruption < 25) return { ok: false, reason: "honest_guard_reports_bribe" as const, crime: createHarthmereCrimeRecord({ ...ctx, crimeType: "bribery" }) };
  if (bribeGold < needed) return { ok: false, reason: "bribe_too_low" as const, needed: Math.ceil(needed) };
  return { ok: true, paid: bribeGold, legalPenalty: -Math.ceil(HARTHMERE_CRIME_SEVERITY.bribery / 2) };
}

export function describeHarthmereIllegalActionWarning(ctx: Pick<HarthmereCrimeContext, "crimeType" | "location" | "witnesses" | "lineOfSight" | "noise" | "lighting"> & {
  lawfulArea?: boolean;
  hasPermit?: boolean;
  permitId?: string;
}) {
  const regulatedCrimes: HarthmereCrimeType[] = ["theft", "pickpocket", "lockpicking", "trespassing", "assault", "murder", "smuggling", "illegal_magic", "bribery", "arson"];
  const applies = (ctx.lawfulArea ?? true) && regulatedCrimes.includes(ctx.crimeType) && !ctx.hasPermit;
  const witnessCanReport = ctx.witnesses > 0 && (ctx.lineOfSight || ctx.noise >= 25 || ctx.lighting !== "dark");
  return {
    shouldWarn: applies,
    reason: applies ? `${ctx.crimeType}_illegal_in_lawful_area` : undefined,
    witnessRisk: witnessCanReport,
    permitId: ctx.permitId,
    message: applies
      ? `${ctx.crimeType.replace("_", " ")} is illegal in ${ctx.location}; witnesses or guards may report it.`
      : undefined,
  };
}

export function validateHarthmereLegalAccess(ctx: HarthmereLegalAccessContext): HarthmereLegalAccessResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const requiredActions: string[] = [];
  const heldPermitIds = new Set(ctx.heldPermitIds ?? []);
  const heldLicenseIds = new Set(ctx.heldLicenseIds ?? []);

  if ((ctx.activeBountyGold ?? 0) > 0) {
    reasons.push("active_bounty");
    requiredActions.push("clear_bounty");
  }
  if (ctx.licenseSuspended) {
    reasons.push("license_suspended");
    requiredActions.push("restore_license");
  }
  if (ctx.requiredPermitId && !heldPermitIds.has(ctx.requiredPermitId)) {
    reasons.push(`missing_permit:${ctx.requiredPermitId}`);
    requiredActions.push(`obtain_permit:${ctx.requiredPermitId}`);
  }
  if (ctx.requiredLicenseId && !heldLicenseIds.has(ctx.requiredLicenseId)) {
    reasons.push(`missing_license:${ctx.requiredLicenseId}`);
    requiredActions.push(`obtain_license:${ctx.requiredLicenseId}`);
  }
  if (ctx.minLegalStanding !== undefined && ctx.legalStanding < ctx.minLegalStanding) {
    reasons.push("legal_standing_too_low");
    requiredActions.push("repair_legal_standing");
  }
  if (ctx.minTownReputation !== undefined && ctx.townReputation < ctx.minTownReputation) {
    reasons.push("town_reputation_too_low");
    requiredActions.push("raise_town_reputation");
  }
  if (ctx.purpose === "building_permit" && ctx.zoneMatches === false) {
    reasons.push("zoning_mismatch");
    requiredActions.push("choose_valid_zone");
  }
  if (ctx.purpose === "building_permit" && ctx.planApproved === false) {
    reasons.push("plan_not_approved");
    requiredActions.push("submit_building_plan");
  }
  if (ctx.purpose === "security_contract" && ctx.insuranceBonded === false) {
    warnings.push("insurance_bond_recommended");
    requiredActions.push("post_insurance_bond");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    warnings,
    requiredActions: Array.from(new Set(requiredActions)),
  };
}

export function createHarthmereCourtTrial(record: HarthmereCrimeRecord) {
  return { trialId: `trial-${record.crimeId}`, charges: [record.context.crimeType], evidenceScore: record.detectionScore + record.context.witnesses * 20, possibleOutcomes: ["pay_fine", "confiscation", "jail", "community_service", "bounty"], fineGold: record.fineGold };
}

export function getHarthmereOutlawEscalation(legalStanding: number, activeBounties: number) {
  if (legalStanding <= -8000 || activeBounties >= 5) return { tier: "public_enemy", cityLockdown: true, bountyHunters: true };
  if (legalStanding <= -5000 || activeBounties >= 2) return { tier: "outlaw", cityLockdown: false, bountyHunters: true };
  if (legalStanding <= -2000) return { tier: "troublemaker", cityLockdown: false, bountyHunters: false };
  if (legalStanding <= -500) return { tier: "suspicious", cityLockdown: false, bountyHunters: false };
  return { tier: "lawful_or_neutral", cityLockdown: false, bountyHunters: false };
}

export const HarthmereCrimeLawPanel: React.FunctionComponent<{}> = () => {
  const sample = createHarthmereCrimeRecord({ crimeType: "theft", severity: 1, value: 80, witnesses: 1, lineOfSight: true, noise: 20, lighting: "normal", disguiseQuality: 0, guardAlertness: 70, crowdDensity: 40, legalStanding: 0, notoriety: 0, location: "Market Square", itemIds: ["apple_basket"] });
  return <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs" data-harthmere-crime-law="v1"><div className="text-sm font-bold text-red-100">Crime & Law</div><div>Sample response: {sample.response}</div><div>Fine: {sample.fineGold} gold</div><div>Evidence expires: {new Date(sample.evidenceExpiresAt).toLocaleString()}</div></div>;
};
