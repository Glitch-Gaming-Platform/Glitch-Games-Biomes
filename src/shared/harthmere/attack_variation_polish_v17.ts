export const HARTHMERE_ATTACK_VARIATION_POLISH_VERSION_V17 =
  "harthmere-attack-variation-polish-v17";

export type HarthmereAttackFamilyV17 =
  | "basic"
  | "heavy"
  | "magic"
  | "rangedRelease"
  | "shieldBash"
  | "toolUse";

export type HarthmereAttackVariationV17 = {
  id: string;
  family: HarthmereAttackFamilyV17;
  clip: string;
  frameCount: 24;
  fps: 24;
  emoteType: string;
  windupFrame: number;
  impactFrame: number;
  recoveryFrame: number;
  stance: "open" | "closed" | "forward" | "low" | "high";
  leadFoot: "left" | "right" | "balanced";
  attackSide: "right" | "left" | "center";
  arc: string;
  torsoYawDeg: number;
  spineBendDeg: number;
  shoulderYawDeg: number;
  hipYawDeg: number;
  stepForwardMeters: number;
  stepLateralMeters: number;
  weaponTravelArcDeg: number;
  weightShift: "front" | "rear" | "left" | "right" | "center";
  locomotionAllowed: boolean;
  airAllowed: boolean;
  silhouetteTag: string;
  notes: string;
};

const make = (
  family: HarthmereAttackFamilyV17,
  index: number,
  data: Omit<HarthmereAttackVariationV17, "id" | "family" | "frameCount" | "fps">,
): HarthmereAttackVariationV17 => ({
  id: `${family}_${index}`,
  family,
  frameCount: 24,
  fps: 24,
  ...data,
});

export const HARTHMERE_ATTACK_VARIATIONS_POLISH_V17: Record<
  HarthmereAttackFamilyV17,
  readonly HarthmereAttackVariationV17[]
> = {
  basic: [
    make("basic", 1, { emoteType: "attack1Var1", clip: "HarthmereBodyWeaponBasic_Variation1_24", windupFrame: 5, impactFrame: 11, recoveryFrame: 20, stance: "forward", leadFoot: "left", attackSide: "right", arc: "forehand_high_diagonal", torsoYawDeg: 18, spineBendDeg: -7, shoulderYawDeg: 26, hipYawDeg: 10, stepForwardMeters: 0.10, stepLateralMeters: 0.02, weaponTravelArcDeg: 96, weightShift: "front", locomotionAllowed: true, airAllowed: false, silhouetteTag: "wide_forehand", notes: "Big forehand slash with clear shoulder lead." }),
    make("basic", 2, { emoteType: "attack1Var2", clip: "HarthmereBodyWeaponBasic_Variation2_24", windupFrame: 4, impactFrame: 10, recoveryFrame: 19, stance: "closed", leadFoot: "right", attackSide: "right", arc: "backhand_return", torsoYawDeg: -24, spineBendDeg: 8, shoulderYawDeg: -22, hipYawDeg: -12, stepForwardMeters: 0.02, stepLateralMeters: -0.08, weaponTravelArcDeg: 118, weightShift: "right", locomotionAllowed: true, airAllowed: false, silhouetteTag: "backhand_return", notes: "Backhand return slash with strong cross-body recoil." }),
    make("basic", 3, { emoteType: "attack1Var3", clip: "HarthmereBodyWeaponBasic_Variation3_24", windupFrame: 5, impactFrame: 12, recoveryFrame: 21, stance: "forward", leadFoot: "balanced", attackSide: "center", arc: "lunging_thrust", torsoYawDeg: 0, spineBendDeg: -4, shoulderYawDeg: 8, hipYawDeg: 0, stepForwardMeters: 0.16, stepLateralMeters: 0.0, weaponTravelArcDeg: 24, weightShift: "front", locomotionAllowed: true, airAllowed: true, silhouetteTag: "thrust_lunge", notes: "Distinct jab/lunge with forward reach." }),
    make("basic", 4, { emoteType: "attack1Var4", clip: "HarthmereBodyWeaponBasic_Variation4_24", windupFrame: 6, impactFrame: 13, recoveryFrame: 22, stance: "low", leadFoot: "left", attackSide: "right", arc: "rising_cut", torsoYawDeg: 28, spineBendDeg: 10, shoulderYawDeg: 30, hipYawDeg: 14, stepForwardMeters: 0.06, stepLateralMeters: 0.05, weaponTravelArcDeg: 132, weightShift: "left", locomotionAllowed: true, airAllowed: false, silhouetteTag: "rising_cut", notes: "Low crouched rising slash with obvious body lift." }),
  ],
  heavy: [
    make("heavy", 1, { emoteType: "attack2Var1", clip: "HarthmereBodyWeaponHeavy_Variation1_24", windupFrame: 7, impactFrame: 14, recoveryFrame: 22, stance: "high", leadFoot: "left", attackSide: "center", arc: "overhead_cleave", torsoYawDeg: 2, spineBendDeg: -12, shoulderYawDeg: 22, hipYawDeg: 4, stepForwardMeters: 0.12, stepLateralMeters: 0.0, weaponTravelArcDeg: 150, weightShift: "front", locomotionAllowed: false, airAllowed: false, silhouetteTag: "overhead_cleave", notes: "High, readable overhead strike." }),
    make("heavy", 2, { emoteType: "attack2Var2", clip: "HarthmereBodyWeaponHeavy_Variation2_24", windupFrame: 8, impactFrame: 15, recoveryFrame: 23, stance: "open", leadFoot: "right", attackSide: "right", arc: "side_sweep", torsoYawDeg: -32, spineBendDeg: 6, shoulderYawDeg: -28, hipYawDeg: -16, stepForwardMeters: 0.04, stepLateralMeters: -0.12, weaponTravelArcDeg: 160, weightShift: "right", locomotionAllowed: false, airAllowed: false, silhouetteTag: "broad_side_sweep", notes: "Wide side sweep with heavy weight transfer." }),
    make("heavy", 3, { emoteType: "attack2Var3", clip: "HarthmereBodyWeaponHeavy_Variation3_24", windupFrame: 8, impactFrame: 15, recoveryFrame: 23, stance: "closed", leadFoot: "left", attackSide: "right", arc: "backhand_crusher", torsoYawDeg: 30, spineBendDeg: 8, shoulderYawDeg: 26, hipYawDeg: 18, stepForwardMeters: 0.03, stepLateralMeters: 0.10, weaponTravelArcDeg: 148, weightShift: "left", locomotionAllowed: false, airAllowed: false, silhouetteTag: "backhand_crusher", notes: "Heavy backhand with strong torso unwind." }),
    make("heavy", 4, { emoteType: "attack2Var4", clip: "HarthmereBodyWeaponHeavy_Variation4_24", windupFrame: 9, impactFrame: 16, recoveryFrame: 23, stance: "forward", leadFoot: "balanced", attackSide: "center", arc: "committed_lunge", torsoYawDeg: 0, spineBendDeg: -6, shoulderYawDeg: 12, hipYawDeg: 0, stepForwardMeters: 0.22, stepLateralMeters: 0.0, weaponTravelArcDeg: 52, weightShift: "front", locomotionAllowed: true, airAllowed: false, silhouetteTag: "heavy_lunge", notes: "Forward-driving heavy thrust with body commitment." }),
  ],
  magic: [
    make("magic", 1, { emoteType: "magicCastVar1", clip: "HarthmereBodyMagicCast_Variation1_24", windupFrame: 5, impactFrame: 11, recoveryFrame: 20, stance: "open", leadFoot: "balanced", attackSide: "center", arc: "palm_burst", torsoYawDeg: 0, spineBendDeg: -2, shoulderYawDeg: 10, hipYawDeg: 0, stepForwardMeters: 0.02, stepLateralMeters: 0.0, weaponTravelArcDeg: 22, weightShift: "center", locomotionAllowed: true, airAllowed: true, silhouetteTag: "palm_burst", notes: "Straight forward palm/burst cast." }),
    make("magic", 2, { emoteType: "magicCastVar2", clip: "HarthmereBodyMagicCast_Variation2_24", windupFrame: 5, impactFrame: 12, recoveryFrame: 20, stance: "high", leadFoot: "left", attackSide: "center", arc: "overhead_invocation", torsoYawDeg: 14, spineBendDeg: -8, shoulderYawDeg: 18, hipYawDeg: 6, stepForwardMeters: 0.04, stepLateralMeters: 0.02, weaponTravelArcDeg: 86, weightShift: "front", locomotionAllowed: true, airAllowed: true, silhouetteTag: "overhead_invocation", notes: "Arms lift high then channel downward." }),
    make("magic", 3, { emoteType: "magicCastVar3", clip: "HarthmereBodyMagicCast_Variation3_24", windupFrame: 4, impactFrame: 10, recoveryFrame: 19, stance: "closed", leadFoot: "right", attackSide: "right", arc: "sweeping_sigil", torsoYawDeg: -22, spineBendDeg: 6, shoulderYawDeg: -24, hipYawDeg: -10, stepForwardMeters: 0.0, stepLateralMeters: -0.08, weaponTravelArcDeg: 110, weightShift: "right", locomotionAllowed: true, airAllowed: true, silhouetteTag: "sweeping_sigil", notes: "Broad sideways spell sweep." }),
    make("magic", 4, { emoteType: "magicCastVar4", clip: "HarthmereBodyMagicCast_Variation4_24", windupFrame: 6, impactFrame: 13, recoveryFrame: 21, stance: "low", leadFoot: "balanced", attackSide: "center", arc: "ground_slam_cast", torsoYawDeg: 0, spineBendDeg: 12, shoulderYawDeg: 14, hipYawDeg: 0, stepForwardMeters: 0.05, stepLateralMeters: 0.0, weaponTravelArcDeg: 74, weightShift: "front", locomotionAllowed: false, airAllowed: false, silhouetteTag: "ground_slam_cast", notes: "Crouched ground-focused release." }),
  ],
  rangedRelease: [
    make("rangedRelease", 1, { emoteType: "rangedReleaseVar1", clip: "HarthmereBodyRangedRelease_Variation1_24", windupFrame: 6, impactFrame: 12, recoveryFrame: 20, stance: "forward", leadFoot: "left", attackSide: "right", arc: "square_release", torsoYawDeg: 0, spineBendDeg: -3, shoulderYawDeg: 12, hipYawDeg: 0, stepForwardMeters: 0.02, stepLateralMeters: 0.0, weaponTravelArcDeg: 10, weightShift: "center", locomotionAllowed: false, airAllowed: false, silhouetteTag: "square_release", notes: "Neutral release." }),
    make("rangedRelease", 2, { emoteType: "rangedReleaseVar2", clip: "HarthmereBodyRangedRelease_Variation2_24", windupFrame: 6, impactFrame: 12, recoveryFrame: 20, stance: "open", leadFoot: "balanced", attackSide: "right", arc: "open_release", torsoYawDeg: 16, spineBendDeg: -2, shoulderYawDeg: 18, hipYawDeg: 6, stepForwardMeters: 0.03, stepLateralMeters: 0.05, weaponTravelArcDeg: 18, weightShift: "left", locomotionAllowed: true, airAllowed: false, silhouetteTag: "open_release", notes: "Open stance release with obvious body openness." }),
    make("rangedRelease", 3, { emoteType: "rangedReleaseVar3", clip: "HarthmereBodyRangedRelease_Variation3_24", windupFrame: 5, impactFrame: 11, recoveryFrame: 19, stance: "closed", leadFoot: "right", attackSide: "right", arc: "snap_release", torsoYawDeg: -18, spineBendDeg: 4, shoulderYawDeg: -16, hipYawDeg: -8, stepForwardMeters: 0.0, stepLateralMeters: -0.05, weaponTravelArcDeg: 12, weightShift: "right", locomotionAllowed: true, airAllowed: false, silhouetteTag: "snap_release", notes: "Short snap release from closed stance." }),
    make("rangedRelease", 4, { emoteType: "rangedReleaseVar4", clip: "HarthmereBodyRangedRelease_Variation4_24", windupFrame: 7, impactFrame: 13, recoveryFrame: 21, stance: "high", leadFoot: "balanced", attackSide: "right", arc: "lofted_release", torsoYawDeg: 0, spineBendDeg: -8, shoulderYawDeg: 14, hipYawDeg: 0, stepForwardMeters: 0.03, stepLateralMeters: 0.0, weaponTravelArcDeg: 24, weightShift: "center", locomotionAllowed: false, airAllowed: false, silhouetteTag: "lofted_release", notes: "Elevated shot release." }),
  ],
  shieldBash: [
    make("shieldBash", 1, { emoteType: "shieldBashVar1", clip: "HarthmereBodyShieldBash_Variation1_24", windupFrame: 5, impactFrame: 11, recoveryFrame: 19, stance: "forward", leadFoot: "left", attackSide: "left", arc: "short_jab", torsoYawDeg: -10, spineBendDeg: -2, shoulderYawDeg: -16, hipYawDeg: -6, stepForwardMeters: 0.08, stepLateralMeters: 0.0, weaponTravelArcDeg: 16, weightShift: "front", locomotionAllowed: true, airAllowed: false, silhouetteTag: "short_jab", notes: "Compact shield jab." }),
    make("shieldBash", 2, { emoteType: "shieldBashVar2", clip: "HarthmereBodyShieldBash_Variation2_24", windupFrame: 6, impactFrame: 12, recoveryFrame: 20, stance: "closed", leadFoot: "right", attackSide: "left", arc: "hook_bash", torsoYawDeg: -24, spineBendDeg: 5, shoulderYawDeg: -22, hipYawDeg: -12, stepForwardMeters: 0.02, stepLateralMeters: -0.08, weaponTravelArcDeg: 92, weightShift: "right", locomotionAllowed: false, airAllowed: false, silhouetteTag: "hook_bash", notes: "Hooking shield bash." }),
    make("shieldBash", 3, { emoteType: "shieldBashVar3", clip: "HarthmereBodyShieldBash_Variation3_24", windupFrame: 5, impactFrame: 11, recoveryFrame: 19, stance: "low", leadFoot: "balanced", attackSide: "left", arc: "rising_bump", torsoYawDeg: -16, spineBendDeg: 10, shoulderYawDeg: -18, hipYawDeg: -6, stepForwardMeters: 0.04, stepLateralMeters: 0.02, weaponTravelArcDeg: 84, weightShift: "left", locomotionAllowed: true, airAllowed: false, silhouetteTag: "rising_bump", notes: "Rising upward bump." }),
    make("shieldBash", 4, { emoteType: "shieldBashVar4", clip: "HarthmereBodyShieldBash_Variation4_24", windupFrame: 7, impactFrame: 13, recoveryFrame: 21, stance: "high", leadFoot: "left", attackSide: "left", arc: "slam_bash", torsoYawDeg: -8, spineBendDeg: -6, shoulderYawDeg: -12, hipYawDeg: -2, stepForwardMeters: 0.09, stepLateralMeters: 0.0, weaponTravelArcDeg: 118, weightShift: "front", locomotionAllowed: false, airAllowed: false, silhouetteTag: "slam_bash", notes: "Downward shield slam." }),
  ],
  toolUse: [
    make("toolUse", 1, { emoteType: "toolUseVar1", clip: "HarthmereBodyToolUse_Variation1_24", windupFrame: 5, impactFrame: 12, recoveryFrame: 20, stance: "high", leadFoot: "left", attackSide: "right", arc: "overhead_chop", torsoYawDeg: 0, spineBendDeg: -10, shoulderYawDeg: 18, hipYawDeg: 0, stepForwardMeters: 0.06, stepLateralMeters: 0.0, weaponTravelArcDeg: 132, weightShift: "front", locomotionAllowed: false, airAllowed: false, silhouetteTag: "overhead_chop", notes: "Obvious overhead gather hit." }),
    make("toolUse", 2, { emoteType: "toolUseVar2", clip: "HarthmereBodyToolUse_Variation2_24", windupFrame: 5, impactFrame: 11, recoveryFrame: 19, stance: "open", leadFoot: "right", attackSide: "right", arc: "angled_hack", torsoYawDeg: -18, spineBendDeg: 4, shoulderYawDeg: -16, hipYawDeg: -6, stepForwardMeters: 0.02, stepLateralMeters: -0.06, weaponTravelArcDeg: 108, weightShift: "right", locomotionAllowed: false, airAllowed: false, silhouetteTag: "angled_hack", notes: "Angled chop for wood/ore." }),
    make("toolUse", 3, { emoteType: "toolUseVar3", clip: "HarthmereBodyToolUse_Variation3_24", windupFrame: 4, impactFrame: 10, recoveryFrame: 18, stance: "closed", leadFoot: "left", attackSide: "right", arc: "cross_body_pick", torsoYawDeg: 22, spineBendDeg: 8, shoulderYawDeg: 20, hipYawDeg: 8, stepForwardMeters: 0.0, stepLateralMeters: 0.08, weaponTravelArcDeg: 116, weightShift: "left", locomotionAllowed: false, airAllowed: false, silhouetteTag: "cross_body_pick", notes: "Cross-body mining hit." }),
    make("toolUse", 4, { emoteType: "toolUseVar4", clip: "HarthmereBodyToolUse_Variation4_24", windupFrame: 6, impactFrame: 13, recoveryFrame: 21, stance: "low", leadFoot: "balanced", attackSide: "center", arc: "forward_dig", torsoYawDeg: 0, spineBendDeg: 14, shoulderYawDeg: 10, hipYawDeg: 0, stepForwardMeters: 0.08, stepLateralMeters: 0.0, weaponTravelArcDeg: 58, weightShift: "front", locomotionAllowed: true, airAllowed: false, silhouetteTag: "forward_dig", notes: "Forward dig/poke strike." }),
  ],
} as const;

const __harthmereVariationCycleStateV17: Record<HarthmereAttackFamilyV17, number> = {
  basic: 0,
  heavy: 0,
  magic: 0,
  rangedRelease: 0,
  shieldBash: 0,
  toolUse: 0,
};

export function advanceHarthmereAttackVariationIndexV17(
  family: HarthmereAttackFamilyV17,
): number {
  const variants = HARTHMERE_ATTACK_VARIATIONS_POLISH_V17[family];
  const nextIndex = (__harthmereVariationCycleStateV17[family] + 1) % variants.length;
  __harthmereVariationCycleStateV17[family] = nextIndex;
  return nextIndex;
}

export function pickHarthmereAttackVariationV17(
  family: HarthmereAttackFamilyV17,
): HarthmereAttackVariationV17 {
  const variants = HARTHMERE_ATTACK_VARIATIONS_POLISH_V17[family];
  return variants[advanceHarthmereAttackVariationIndexV17(family)];
}

export function getHarthmereAttackFamilyForActionV17(actionType: string): HarthmereAttackFamilyV17 {
  if (actionType === "attack2") return "heavy";
  if (actionType === "magicCast") return "magic";
  if (actionType === "rangedRelease") return "rangedRelease";
  if (actionType === "shieldBash") return "shieldBash";
  if (actionType === "toolUse") return "toolUse";
  return "basic";
}
