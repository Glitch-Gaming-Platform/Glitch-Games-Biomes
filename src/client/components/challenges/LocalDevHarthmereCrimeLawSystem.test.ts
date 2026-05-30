import assert from "assert";

import {
  calculateHarthmereEffectiveCrimeSeverity,
  calculateHarthmereFineGold,
  createHarthmereCrimeRecord,
  describeHarthmereIllegalActionWarning,
  validateHarthmereLegalAccess,
  type HarthmereCrimeContext,
} from "./LocalDevHarthmereCrimeLawSystem";

function crimeContext(overrides: Partial<HarthmereCrimeContext> = {}): HarthmereCrimeContext {
  return {
    crimeType: "theft",
    severity: 0,
    value: 0,
    witnesses: 0,
    lineOfSight: false,
    noise: 0,
    lighting: "dark",
    disguiseQuality: 100,
    guardAlertness: 0,
    crowdDensity: 0,
    legalStanding: 0,
    notoriety: 0,
    location: "Market Square",
    ...overrides,
  };
}

describe("LocalDevHarthmereCrimeLawSystem", function () {
  it("uses contextual severity for detection, response, and fines", function () {
    const mild = createHarthmereCrimeRecord(crimeContext({
      crimeType: "trespassing",
      severity: 0,
    }));
    const escalated = createHarthmereCrimeRecord(crimeContext({
      crimeType: "trespassing",
      severity: 2_500,
    }));

    assert.equal(mild.detected, false);
    assert.equal(mild.response, "warning");
    assert.equal(escalated.detected, true);
    assert.equal(escalated.response, "combat");
    assert.ok(calculateHarthmereEffectiveCrimeSeverity(escalated.context) > calculateHarthmereEffectiveCrimeSeverity(mild.context));
    assert.ok(escalated.fineGold > mild.fineGold);
  });

  it("does not let hidden non-line-of-sight witnesses force detection", function () {
    const hidden = createHarthmereCrimeRecord(crimeContext({
      witnesses: 1,
      lineOfSight: false,
      noise: 0,
      lighting: "dark",
      guardAlertness: 0,
      disguiseQuality: 100,
    }));

    assert.equal(hidden.detected, false);
    assert.equal(hidden.response, "warning");
    assert.equal(hidden.fineGold, 0);
  });

  it("applies the harshest repeat-offender fine multiplier before lower tiers", function () {
    const seriousOffenderFine = calculateHarthmereFineGold(crimeContext({ legalStanding: -6_000 }));
    const minorOffenderFine = calculateHarthmereFineGold(crimeContext({ legalStanding: -3_000 }));

    assert.ok(seriousOffenderFine > minorOffenderFine);
  });

  it("warns before illegal ability use in lawful areas unless a valid permit applies", function () {
    const warning = describeHarthmereIllegalActionWarning({
      crimeType: "illegal_magic",
      location: "Temple District",
      witnesses: 1,
      lineOfSight: true,
      noise: 0,
      lighting: "normal",
      lawfulArea: true,
    });
    const permitted = describeHarthmereIllegalActionWarning({
      crimeType: "illegal_magic",
      location: "Licensed Duel Hall",
      witnesses: 1,
      lineOfSight: true,
      noise: 0,
      lighting: "normal",
      lawfulArea: true,
      hasPermit: true,
      permitId: "licensed_magic_duel",
    });

    assert.equal(warning.shouldWarn, true);
    assert.equal(warning.witnessRisk, true);
    assert.equal(permitted.shouldWarn, false);
  });

  it("blocks permits and restricted services on bounty, standing, zoning, plan, or missing license gaps", function () {
    const blocked = validateHarthmereLegalAccess({
      purpose: "building_permit",
      legalStanding: -750,
      townReputation: 10,
      activeBountyGold: 100,
      requiredPermitId: "market_building_permit",
      heldPermitIds: [],
      minLegalStanding: 0,
      minTownReputation: 50,
      zoneMatches: false,
      planApproved: false,
    });

    assert.equal(blocked.allowed, false);
    assert.ok(blocked.reasons.includes("active_bounty"));
    assert.ok(blocked.reasons.includes("missing_permit:market_building_permit"));
    assert.ok(blocked.reasons.includes("legal_standing_too_low"));
    assert.ok(blocked.reasons.includes("town_reputation_too_low"));
    assert.ok(blocked.reasons.includes("zoning_mismatch"));
    assert.ok(blocked.reasons.includes("plan_not_approved"));
  });

  it("allows licensed security work while warning when the insurance bond is missing", function () {
    const access = validateHarthmereLegalAccess({
      purpose: "security_contract",
      legalStanding: 500,
      townReputation: 200,
      requiredLicenseId: "guard_bounty_security_license",
      heldLicenseIds: ["guard_bounty_security_license"],
      minLegalStanding: 0,
      minTownReputation: 100,
      insuranceBonded: false,
    });

    assert.equal(access.allowed, true);
    assert.deepEqual(access.reasons, []);
    assert.ok(access.warnings.includes("insurance_bond_recommended"));
  });
});
