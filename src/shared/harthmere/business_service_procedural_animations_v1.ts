import {
  HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1,
  HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1,
  getHarthmereBusinessBikkieGraphicForServiceCueV1,
  getHarthmereBusinessServiceAnimationCueSpecV1,
  type HarthmereBusinessBikkieGraphicV1,
  type HarthmereBusinessCustomerAppearanceV1,
  type HarthmereBusinessCustomerNpcV1,
  type HarthmereBusinessServiceAnimationCueSpecV1,
} from "./business_customer_simulator_v1";
import {
  harthmereResolveBikkieVisualV1,
  type HarthmereResolvedBikkieVisualV1,
} from "./bikkie_visual_resolver_v1";
import type { BiomesId } from "../ids";

export const HARTHMERE_BUSINESS_SERVICE_PROCEDURAL_ANIMATION_VERSION_V1 =
  "harthmere-business-service-procedural-animation-v1" as const;

export type HarthmereBusinessProceduralPartV1 =
  | "head"
  | "hair"
  | "eyes"
  | "nose"
  | "torso"
  | "leftArm"
  | "rightArm"
  | "leftHand"
  | "rightHand"
  | "leftLeg"
  | "rightLeg"
  | "feet"
  | "accessory"
  | "prop";

export interface HarthmereBusinessProceduralPaletteV1 {
  skin: string;
  hair: string;
  eyes: string;
  outfit: string;
  accent: string;
  accessory: string;
  shadow: string;
}

export interface HarthmereBusinessProceduralRigPartV1 {
  part: HarthmereBusinessProceduralPartV1;
  anchor: { x: number; y: number };
  size: { w: number; h: number };
  color: string;
  shape: "box" | "ellipse" | "hair" | "eyes" | "nose" | "prop";
  sourceFeature: keyof HarthmereBusinessCustomerAppearanceV1 | "derived";
}

export interface HarthmereBusinessProceduralCustomerRigV1 {
  npcId: string;
  displayName: string;
  palette: HarthmereBusinessProceduralPaletteV1;
  bodyScale: { width: number; height: number; shoulder: number };
  postureLeanDeg: number;
  gaitEnergy: number;
  parts: Record<HarthmereBusinessProceduralPartV1, HarthmereBusinessProceduralRigPartV1>;
  coverageTags: string[];
}

export interface HarthmereBusinessProceduralPartPoseV1 {
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
  visible: boolean;
}

export interface HarthmereBusinessProceduralFrameV1 {
  timeMs: number;
  normalizedTime: number;
  owner: Record<HarthmereBusinessProceduralPartV1, HarthmereBusinessProceduralPartPoseV1>;
  customer: Record<HarthmereBusinessProceduralPartV1, HarthmereBusinessProceduralPartPoseV1>;
  prop: {
    label: string;
    color: string;
    source: "bikkie" | "procedural_fallback";
    graphicId?: string;
    bikkieId?: BiomesId;
    bikkieName?: string;
    bikkieKind?: HarthmereBusinessBikkieGraphicV1["kind"];
    galoisPath?: string;
    boxSize?: readonly [number, number, number];
    colors?: readonly string[];
    visual: HarthmereResolvedBikkieVisualV1;
    x: number;
    y: number;
    rotationDeg: number;
    scale: number;
    visible: boolean;
  };
}

export interface HarthmereBusinessProceduralClipV1 {
  version: typeof HARTHMERE_BUSINESS_SERVICE_PROCEDURAL_ANIMATION_VERSION_V1;
  cueId: string;
  family: HarthmereBusinessServiceAnimationCueSpecV1["family"];
  durationMs: number;
  customerRig: HarthmereBusinessProceduralCustomerRigV1;
  ownerRig: HarthmereBusinessProceduralCustomerRigV1;
  frames: HarthmereBusinessProceduralFrameV1[];
  safety: {
    procedural: true;
    voxelSafe: true;
    noRootMotion: true;
    noSkeletonRequirement: true;
    rotationOnlyPose: true;
    rootMotionMeters: 0;
    maxFootDriftMeters: number;
    maxPartRotationDeg: number;
  };
  warnings: string[];
}

export interface HarthmereBusinessProceduralVisualAuditV1 {
  ok: boolean;
  customerCount: number;
  cueCount: number;
  renderedCustomerCells: number;
  renderedCueCells: number;
  warnings: string[];
}

export interface HarthmereBusinessProceduralRuntimeComboV1 {
  comboId: string;
  coverageKind: "cue" | "customer";
  cueId: string;
  npcId: string;
  label: string;
  family: HarthmereBusinessServiceAnimationCueSpecV1["family"];
  durationMs: number;
  frameSvgs: string[];
}

export interface HarthmereBusinessProceduralRuntimeAuditV1 {
  ok: boolean;
  comboCount: number;
  customerCoverageCount: number;
  cueCoverageCount: number;
  movingComboCount: number;
  warnings: string[];
}

const HEX = /^#[0-9a-f]{6}$/i;

const NAMED_COLORS: Array<[RegExp, string]> = [
  [/black|charcoal|ink|obsidian|void/i, "#1d2230"],
  [/white|moon|cream|ivory|pearl|opal/i, "#f1e6d0"],
  [/silver|gray|grey|graphite|steel|ash|storm|slate/i, "#8c97a4"],
  [/copper|auburn|rust|red|ember|cherry/i, "#b8573c"],
  [/brown|chestnut|umber|hazel|honey|sable|mud/i, "#7a5137"],
  [/blond|gold|yellow|ocher|sand|straw/i, "#c8a34a"],
  [/green|jade|moss|fern|mint|olive|kelp|pine/i, "#4f8a5b"],
  [/blue|teal|sea|glass|electric/i, "#3f7fb6"],
  [/violet|purple|plum|lilac|rose|quartz/i, "#805c9f"],
  [/tan|beige|peach|clay|tawny|russet/i, "#b88762"],
];

const SKIN_COLORS: Array<[RegExp, string]> = [
  [/ebony|deep neutral|deep chestnut|rich mahogany|dark cool/i, "#5b3326"],
  [/deep|umber|bronze|russet|brown/i, "#7d4f37"],
  [/copper|clay|olive|tawny/i, "#9a6748"],
  [/gold|golden|amber|warm beige|tan/i, "#bc8761"],
  [/ivory|fair|pale|light/i, "#d5aa86"],
  [/peach|freckled/i, "#c99473"],
];

function hashStringV1(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function colorFromTextV1(text: string, fallbackHueOffset = 0) {
  for (const [pattern, color] of NAMED_COLORS) {
    if (pattern.test(text)) return color;
  }
  const hash = hashStringV1(text);
  const hue = (hash + fallbackHueOffset) % 360;
  return hslToHexV1(hue, 46, 48);
}

function skinColorFromTextV1(text: string) {
  for (const [pattern, color] of SKIN_COLORS) {
    if (pattern.test(text)) return color;
  }
  return colorFromTextV1(text, 25);
}

function hslToHexV1(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function shadeHexV1(hex: string, amount: number) {
  const clean = HEX.test(hex) ? hex.slice(1) : "777777";
  const values = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
  return `#${values.map((v) => Math.max(0, Math.min(255, Math.round(v + amount))).toString(16).padStart(2, "0")).join("")}`;
}

function bodyWidthScaleV1(appearance: HarthmereBusinessCustomerAppearanceV1) {
  const text = `${appearance.bodyBuild} ${appearance.shoulderShape}`.toLowerCase();
  if (/barrel|stocky|round|broad|wide|muscular|strong|padded|blocky/.test(text)) return 1.14;
  if (/thin|slim|wiry|lithe|willow|narrow|gaunt|birdlike|small/.test(text)) return 0.88;
  if (/athletic|corded|triangular|curved|hourglass/.test(text)) return 1.04;
  return 1;
}

function bodyHeightScaleV1(appearance: HarthmereBusinessCustomerAppearanceV1) {
  const text = appearance.heightBand.toLowerCase();
  if (/towering|very tall|tall/.test(text)) return 1.16;
  if (/petite|short|small/.test(text)) return 0.88;
  if (/mid-tall|rangy|long/.test(text)) return 1.07;
  return 1;
}

function shoulderScaleV1(appearance: HarthmereBusinessCustomerAppearanceV1) {
  const text = appearance.shoulderShape.toLowerCase();
  if (/broad|wide|square|shelf|armor/.test(text)) return 1.12;
  if (/narrow|thin|fine|sloped|tapered/.test(text)) return 0.9;
  return 1;
}

function postureLeanDegV1(posture: string) {
  const text = posture.toLowerCase();
  if (/forward|ready|crouch|lean/.test(text)) return -5;
  if (/stoop|hunch|bent/.test(text)) return 5;
  if (/tilted|off-center|twist/.test(text)) return 3;
  return 0;
}

function gaitEnergyV1(gait: string) {
  const text = gait.toLowerCase();
  if (/rush|quick|fast|spring|bouncy|skipping|zigzag/.test(text)) return 1.2;
  if (/slow|careful|glide|measured|tired|dragged/.test(text)) return 0.72;
  return 1;
}

function rigPartV1(
  part: HarthmereBusinessProceduralPartV1,
  anchor: { x: number; y: number },
  size: { w: number; h: number },
  color: string,
  shape: HarthmereBusinessProceduralRigPartV1["shape"],
  sourceFeature: HarthmereBusinessProceduralRigPartV1["sourceFeature"],
): HarthmereBusinessProceduralRigPartV1 {
  return { part, anchor, size, color, shape, sourceFeature };
}

export function buildHarthmereBusinessCustomerProceduralRigV1(
  npc: HarthmereBusinessCustomerNpcV1,
): HarthmereBusinessProceduralCustomerRigV1 {
  const appearance = npc.appearance;
  const width = bodyWidthScaleV1(appearance);
  const height = bodyHeightScaleV1(appearance);
  const shoulder = shoulderScaleV1(appearance);
  const palette: HarthmereBusinessProceduralPaletteV1 = {
    skin: skinColorFromTextV1(appearance.skinTone),
    hair: colorFromTextV1(appearance.hairColor, 40),
    eyes: colorFromTextV1(appearance.eyeColor, 120),
    outfit: colorFromTextV1(appearance.outfit, 180),
    accent: colorFromTextV1(`${appearance.accessory} ${appearance.voice}`, 260),
    accessory: colorFromTextV1(appearance.accessory, 320),
    shadow: "#1b1f2a",
  };
  const torsoW = 24 * width * shoulder;
  const torsoH = 42 * height;
  const armH = 34 * height;
  const legH = 38 * height;
  const parts = {
    head: rigPartV1("head", { x: 0, y: -58 * height }, { w: 24 * width, h: 25 * height }, palette.skin, "ellipse", "skinTone"),
    hair: rigPartV1("hair", { x: 0, y: -66 * height }, { w: 30 * width, h: 20 * height }, palette.hair, "hair", "hairStyle"),
    eyes: rigPartV1("eyes", { x: 0, y: -60 * height }, { w: 16 * width, h: 4 * height }, palette.eyes, "eyes", "eyeShape"),
    nose: rigPartV1("nose", { x: 0, y: -55 * height }, { w: 5 * width, h: 8 * height }, shadeHexV1(palette.skin, -24), "nose", "noseShape"),
    torso: rigPartV1("torso", { x: 0, y: -27 * height }, { w: torsoW, h: torsoH }, palette.outfit, "box", "outfit"),
    leftArm: rigPartV1("leftArm", { x: -torsoW * 0.62, y: -32 * height }, { w: 7 * width, h: armH }, palette.outfit, "box", "shoulderShape"),
    rightArm: rigPartV1("rightArm", { x: torsoW * 0.62, y: -32 * height }, { w: 7 * width, h: armH }, palette.outfit, "box", "shoulderShape"),
    leftHand: rigPartV1("leftHand", { x: -torsoW * 0.68, y: -8 * height }, { w: 8 * width, h: 8 * height }, palette.skin, "ellipse", "skinTone"),
    rightHand: rigPartV1("rightHand", { x: torsoW * 0.68, y: -8 * height }, { w: 8 * width, h: 8 * height }, palette.skin, "ellipse", "skinTone"),
    leftLeg: rigPartV1("leftLeg", { x: -7 * width, y: 14 * height }, { w: 8 * width, h: legH }, shadeHexV1(palette.outfit, -28), "box", "bodyBuild"),
    rightLeg: rigPartV1("rightLeg", { x: 7 * width, y: 14 * height }, { w: 8 * width, h: legH }, shadeHexV1(palette.outfit, -28), "box", "bodyBuild"),
    feet: rigPartV1("feet", { x: 0, y: 39 * height }, { w: 30 * width, h: 7 * height }, palette.shadow, "box", "gait"),
    accessory: rigPartV1("accessory", { x: 14 * width, y: -48 * height }, { w: 8 * width, h: 10 * height }, palette.accessory, "box", "accessory"),
    prop: rigPartV1("prop", { x: 0, y: -30 * height }, { w: 12, h: 12 }, palette.accent, "prop", "derived"),
  } satisfies Record<HarthmereBusinessProceduralPartV1, HarthmereBusinessProceduralRigPartV1>;
  return {
    npcId: npc.npcId,
    displayName: npc.displayName,
    palette,
    bodyScale: { width, height, shoulder },
    postureLeanDeg: postureLeanDegV1(appearance.posture),
    gaitEnergy: gaitEnergyV1(appearance.gait),
    parts,
    coverageTags: [
      `hairStyle:${appearance.hairStyle}`,
      `hairColor:${appearance.hairColor}`,
      `bodyBuild:${appearance.bodyBuild}`,
      `heightBand:${appearance.heightBand}`,
      `shoulderShape:${appearance.shoulderShape}`,
      `posture:${appearance.posture}`,
      `gait:${appearance.gait}`,
      `eyeColor:${appearance.eyeColor}`,
      `eyeShape:${appearance.eyeShape}`,
      `browShape:${appearance.browShape}`,
      `noseShape:${appearance.noseShape}`,
      `noseBridge:${appearance.noseBridge}`,
      `skinTone:${appearance.skinTone}`,
      `outfit:${appearance.outfit}`,
      `accessory:${appearance.accessory}`,
      `voice:${appearance.voice}`,
    ],
  };
}

const FALLBACK_OWNER_NPC_V1: HarthmereBusinessCustomerNpcV1 = {
  ...HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1[0],
  npcId: "business_owner_voxel_service_rig",
  displayName: "Business Owner",
  appearance: {
    ...HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1[0].appearance,
    outfit: "service counter apron",
    accessory: "owner ledger pin",
  },
};

function ownerNpcForCueSpecV1(
  spec: HarthmereBusinessServiceAnimationCueSpecV1,
): HarthmereBusinessCustomerNpcV1 {
  const base = HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1[hashStringV1(spec.cueId) % HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length] ?? FALLBACK_OWNER_NPC_V1;
  const familyLook: Record<HarthmereBusinessServiceAnimationCueSpecV1["family"], { outfit: string; accessory: string; voice: string }> = {
    access_control: { outfit: "blue transit service coat", accessory: "polished access token", voice: "measured gate voice" },
    cleanup: { outfit: "green sanitation apron", accessory: "sealed cleanup glove", voice: "calm practical voice" },
    counter_handoff: { outfit: "warm counter service apron", accessory: "small service bell", voice: "bright shop voice" },
    diagnostic: { outfit: "white clinic work coat", accessory: "glass diagnostic lens", voice: "focused gentle voice" },
    dispatch: { outfit: "blue courier dispatch vest", accessory: "brass route whistle", voice: "clear dispatch voice" },
    paperwork: { outfit: "cream clerk ledger coat", accessory: "ink ledger pin", voice: "careful clerk voice" },
    planning: { outfit: "teal design studio wrap", accessory: "rolled blueprint tube", voice: "thoughtful planner voice" },
    tool_work: { outfit: "charcoal tool apron", accessory: "copper repair gauge", voice: "steady workshop voice" },
  };
  const look = familyLook[spec.family];
  return {
    ...base,
    npcId: `business_owner_${spec.family}_service_rig`,
    displayName: "Service Owner",
    appearance: {
      ...base.appearance,
      outfit: look.outfit,
      accessory: look.accessory,
      voice: look.voice,
    },
  };
}

function defaultPoseV1(): HarthmereBusinessProceduralPartPoseV1 {
  return { rotationDeg: 0, scaleX: 1, scaleY: 1, visible: true };
}

function poseSetV1(): Record<HarthmereBusinessProceduralPartV1, HarthmereBusinessProceduralPartPoseV1> {
  return {
    head: defaultPoseV1(),
    hair: defaultPoseV1(),
    eyes: defaultPoseV1(),
    nose: defaultPoseV1(),
    torso: defaultPoseV1(),
    leftArm: defaultPoseV1(),
    rightArm: defaultPoseV1(),
    leftHand: defaultPoseV1(),
    rightHand: defaultPoseV1(),
    leftLeg: defaultPoseV1(),
    rightLeg: defaultPoseV1(),
    feet: defaultPoseV1(),
    accessory: defaultPoseV1(),
    prop: defaultPoseV1(),
  };
}

function waveV1(t: number) {
  return Math.sin(t * Math.PI * 2);
}

function arcV1(t: number) {
  return Math.sin(t * Math.PI);
}

function clamp01V1(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function cueSpecOrFallbackV1(cueId: string): { spec: HarthmereBusinessServiceAnimationCueSpecV1; warnings: string[] } {
  const existing = getHarthmereBusinessServiceAnimationCueSpecV1(cueId);
  if (existing) return { spec: existing, warnings: [] };
  return {
    spec: {
      cueId,
      family: "counter_handoff",
      durationMs: 750,
      ownerChannels: ["head", "right_arm", "left_arm", "prop_item"],
      propMotion: "fallback counter handoff",
      customerReaction: "quick_accept",
      safety: {
        procedural: true,
        voxelSafe: true,
        noRootMotion: true,
        noSkeletonRequirement: true,
        rotationOnlyPose: true,
      },
    },
    warnings: [`unknown_cue_fallback:${cueId}`],
  };
}

function propForCueV1(spec: HarthmereBusinessServiceAnimationCueSpecV1) {
  const text = `${spec.cueId} ${spec.propMotion}`.toLowerCase();
  if (/stamp|certificate|paper|ledger|permit|ticket/.test(text)) return "Paper";
  if (/hammer|wrench|tool|blade|whetstone/.test(text)) return "Tool";
  if (/scanner|scope|lens|scan/.test(text)) return "Scanner";
  if (/bottle|potion|soup|water|herb/.test(text)) return "Bottle";
  if (/key|token|gate|pad|crystal/.test(text)) return "Key";
  if (/parcel|package|lockbox|crate|barrel/.test(text)) return "Package";
  if (/flag|signal|guard|dispatch/.test(text)) return "Signal";
  if (/map|route|blueprint|design/.test(text)) return "Plan";
  return "Item";
}

function propColorForFamilyV1(family: HarthmereBusinessServiceAnimationCueSpecV1["family"]) {
  switch (family) {
    case "access_control": return "#5fb2ff";
    case "cleanup": return "#7bd88f";
    case "diagnostic": return "#88d7ff";
    case "dispatch": return "#ffbf5f";
    case "planning": return "#d3c08c";
    case "paperwork": return "#f0e7c8";
    case "tool_work": return "#a9b0b8";
    case "counter_handoff": return "#e6b16d";
  }
}

function applyFamilyMotionV1(
  family: HarthmereBusinessServiceAnimationCueSpecV1["family"],
  t: number,
  owner: Record<HarthmereBusinessProceduralPartV1, HarthmereBusinessProceduralPartPoseV1>,
  customer: Record<HarthmereBusinessProceduralPartV1, HarthmereBusinessProceduralPartPoseV1>,
) {
  const pulse = arcV1(t);
  const wave = waveV1(t);
  owner.torso.rotationDeg = pulse * 2;
  customer.torso.rotationDeg = -pulse * 1.5;
  owner.head.rotationDeg = wave * 4;
  customer.head.rotationDeg = -wave * 3;
  switch (family) {
    case "access_control":
      owner.rightArm.rotationDeg = -45 + pulse * 70;
      owner.leftArm.rotationDeg = 20 - pulse * 25;
      customer.rightArm.rotationDeg = -18 + pulse * 28;
      break;
    case "cleanup":
      owner.rightArm.rotationDeg = -30 + wave * 35;
      owner.leftArm.rotationDeg = 38 - pulse * 22;
      customer.head.rotationDeg -= 8 * pulse;
      customer.leftArm.rotationDeg = 8 + pulse * 20;
      break;
    case "diagnostic":
      owner.rightArm.rotationDeg = -55 + pulse * 90;
      owner.leftArm.rotationDeg = 18;
      customer.head.rotationDeg = -8 + pulse * 16;
      break;
    case "dispatch":
      owner.rightArm.rotationDeg = -80 + pulse * 145;
      owner.leftArm.rotationDeg = -20 + wave * 18;
      customer.rightArm.rotationDeg = -10 + pulse * 36;
      break;
    case "planning":
      owner.rightArm.rotationDeg = -22 + pulse * 28;
      owner.leftArm.rotationDeg = -34 + pulse * 22;
      customer.leftArm.rotationDeg = 24 - pulse * 30;
      customer.rightArm.rotationDeg = -16 + pulse * 20;
      break;
    case "paperwork":
      owner.rightArm.rotationDeg = -18 + pulse * 62;
      owner.leftArm.rotationDeg = 28 - pulse * 15;
      customer.rightArm.rotationDeg = -8 + pulse * 18;
      break;
    case "tool_work":
      owner.rightArm.rotationDeg = -85 + pulse * 135;
      owner.leftArm.rotationDeg = 34 - pulse * 20;
      customer.head.rotationDeg = pulse > 0.8 ? -6 : 0;
      break;
    case "counter_handoff":
      owner.rightArm.rotationDeg = -34 + pulse * 58;
      owner.leftArm.rotationDeg = 12 + pulse * 18;
      customer.rightArm.rotationDeg = 28 - pulse * 48;
      customer.leftArm.rotationDeg = -8 + pulse * 14;
      break;
  }
  owner.rightHand.rotationDeg = owner.rightArm.rotationDeg * 0.5;
  owner.leftHand.rotationDeg = owner.leftArm.rotationDeg * 0.5;
  customer.rightHand.rotationDeg = customer.rightArm.rotationDeg * 0.5;
  customer.leftHand.rotationDeg = customer.leftArm.rotationDeg * 0.5;
  owner.leftLeg.rotationDeg = -2 * pulse;
  owner.rightLeg.rotationDeg = 2 * pulse;
  customer.leftLeg.rotationDeg = 1.5 * pulse;
  customer.rightLeg.rotationDeg = -1.5 * pulse;
}

function frameForSpecV1(
  spec: HarthmereBusinessServiceAnimationCueSpecV1,
  timeMs: number,
): HarthmereBusinessProceduralFrameV1 {
  const t = clamp01V1(timeMs / Math.max(1, spec.durationMs));
  const owner = poseSetV1();
  const customer = poseSetV1();
  const bikkieGraphic = getHarthmereBusinessBikkieGraphicForServiceCueV1(spec.cueId);
  const fallbackLabel = propForCueV1(spec);
  const visual =
    bikkieGraphic?.visual ??
    harthmereResolveBikkieVisualV1({
      id: spec.cueId,
      label: fallbackLabel,
      kind: spec.family,
      colors: [propColorForFamilyV1(spec.family)],
    });
  applyFamilyMotionV1(spec.family, t, owner, customer);
  const handoff = spec.family === "counter_handoff" || spec.family === "access_control" || spec.family === "paperwork";
  const propX = handoff ? -22 + t * 44 : -18 + Math.sin(t * Math.PI * 2) * 18;
  const propY = spec.family === "tool_work" ? -40 + arcV1(t) * 34 : -35 + arcV1(t) * 12;
  return {
    timeMs,
    normalizedTime: t,
    owner,
    customer,
    prop: {
      label: bikkieGraphic?.label ?? fallbackLabel,
      color: visual.primaryHex,
      source: bikkieGraphic ? "bikkie" : "procedural_fallback",
      graphicId: bikkieGraphic?.graphicId,
      bikkieId: bikkieGraphic?.bikkieId,
      bikkieName: bikkieGraphic?.bikkieName,
      bikkieKind: bikkieGraphic?.kind,
      galoisPath: bikkieGraphic?.galoisPath,
      boxSize: bikkieGraphic?.boxSize,
      colors: bikkieGraphic?.colors,
      visual,
      x: propX,
      y: propY,
      rotationDeg: spec.family === "dispatch" ? waveV1(t) * 45 : owner.rightArm.rotationDeg * 0.45,
      scale: 0.85 + arcV1(t) * 0.15,
      visible: true,
    },
  };
}

export function createHarthmereBusinessServiceProceduralClipV1(input: {
  cueId: string;
  customerNpc?: HarthmereBusinessCustomerNpcV1;
  ownerNpc?: HarthmereBusinessCustomerNpcV1;
  sampleCount?: number;
}): HarthmereBusinessProceduralClipV1 {
  const { spec, warnings } = cueSpecOrFallbackV1(input.cueId);
  const sampleCount = Math.max(2, Math.min(24, Math.trunc(input.sampleCount ?? 5)));
  const frames = Array.from({ length: sampleCount }, (_, index) => {
    const t = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    return frameForSpecV1(spec, Math.round(spec.durationMs * t));
  });
  return {
    version: HARTHMERE_BUSINESS_SERVICE_PROCEDURAL_ANIMATION_VERSION_V1,
    cueId: spec.cueId,
    family: spec.family,
    durationMs: spec.durationMs,
    customerRig: buildHarthmereBusinessCustomerProceduralRigV1(input.customerNpc ?? HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1[0]),
    ownerRig: buildHarthmereBusinessCustomerProceduralRigV1(input.ownerNpc ?? ownerNpcForCueSpecV1(spec)),
    frames,
    safety: {
      procedural: true,
      voxelSafe: true,
      noRootMotion: true,
      noSkeletonRequirement: true,
      rotationOnlyPose: true,
      rootMotionMeters: 0,
      maxFootDriftMeters: 0,
      maxPartRotationDeg: Math.max(...frames.flatMap((frame) => [
        ...Object.values(frame.owner).map((pose) => Math.abs(pose.rotationDeg)),
        ...Object.values(frame.customer).map((pose) => Math.abs(pose.rotationDeg)),
      ])),
    },
    warnings,
  };
}

function escV1(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

function renderPartV1(
  part: HarthmereBusinessProceduralRigPartV1,
  pose: HarthmereBusinessProceduralPartPoseV1,
) {
  if (!pose.visible) return "";
  const rotate = `rotate(${pose.rotationDeg.toFixed(2)} ${part.anchor.x.toFixed(2)} ${part.anchor.y.toFixed(2)}) scale(${pose.scaleX.toFixed(3)} ${pose.scaleY.toFixed(3)})`;
  const x = part.anchor.x - part.size.w / 2;
  const y = part.anchor.y - part.size.h / 2;
  if (part.shape === "ellipse") {
    return `<ellipse cx="${part.anchor.x.toFixed(2)}" cy="${part.anchor.y.toFixed(2)}" rx="${(part.size.w / 2).toFixed(2)}" ry="${(part.size.h / 2).toFixed(2)}" fill="${part.color}" transform="${rotate}"/>`;
  }
  if (part.shape === "eyes") {
    const eyeW = Math.max(2, part.size.w / 4);
    return `<circle cx="${(part.anchor.x - part.size.w / 4).toFixed(2)}" cy="${part.anchor.y.toFixed(2)}" r="${eyeW.toFixed(2)}" fill="${part.color}" transform="${rotate}"/><circle cx="${(part.anchor.x + part.size.w / 4).toFixed(2)}" cy="${part.anchor.y.toFixed(2)}" r="${eyeW.toFixed(2)}" fill="${part.color}" transform="${rotate}"/>`;
  }
  if (part.shape === "nose") {
    return `<path d="M ${part.anchor.x.toFixed(2)} ${(part.anchor.y - part.size.h / 2).toFixed(2)} l ${(part.size.w / 2).toFixed(2)} ${part.size.h.toFixed(2)} l ${(-part.size.w).toFixed(2)} 0 Z" fill="${part.color}" transform="${rotate}"/>`;
  }
  if (part.shape === "hair") {
    return `<path d="M ${x.toFixed(2)} ${part.anchor.y.toFixed(2)} q ${(part.size.w / 2).toFixed(2)} ${(-part.size.h).toFixed(2)} ${part.size.w.toFixed(2)} 0 v ${(part.size.h * 0.65).toFixed(2)} q ${(-part.size.w / 2).toFixed(2)} ${(part.size.h * 0.45).toFixed(2)} ${(-part.size.w).toFixed(2)} 0 Z" fill="${part.color}" transform="${rotate}"/>`;
  }
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${part.size.w.toFixed(2)}" height="${part.size.h.toFixed(2)}" rx="2" fill="${part.color}" transform="${rotate}"/>`;
}

function renderRigFrameV1(
  rig: HarthmereBusinessProceduralCustomerRigV1,
  framePose: Record<HarthmereBusinessProceduralPartV1, HarthmereBusinessProceduralPartPoseV1>,
  x: number,
  y: number,
  mirror = false,
) {
  const scale = mirror ? "-1 1" : "1 1";
  const ordered: HarthmereBusinessProceduralPartV1[] = [
    "feet",
    "leftLeg",
    "rightLeg",
    "torso",
    "leftArm",
    "rightArm",
    "leftHand",
    "rightHand",
    "head",
    "hair",
    "eyes",
    "nose",
    "accessory",
  ];
  return `<g transform="translate(${x} ${y}) scale(${scale}) rotate(${rig.postureLeanDeg})">${ordered.map((part) => renderPartV1(rig.parts[part], framePose[part])).join("")}</g>`;
}

function displayFamilyLabelV1(family: HarthmereBusinessServiceAnimationCueSpecV1["family"]) {
  return family.replace(/_/g, " ");
}

function renderBikkiePropVisualSvgV1(
  visual: HarthmereResolvedBikkieVisualV1,
  label: string
) {
  const primary = escV1(visual.primaryHex);
  const accent = escV1(visual.accentHex);
  const shadow = `<ellipse cx="0" cy="8" rx="12" ry="3.5" fill="#000000" opacity="0.22"/>`;
  const glyph = `<text x="0" y="4" fill="#ffffff" text-anchor="middle" font-family="Arial, sans-serif" font-size="5" font-weight="800">${escV1(visual.glyph || label.slice(0, 3))}</text>`;
  switch (visual.shape) {
    case "block":
      return `${shadow}<path d="M -10 -4 L 0 -10 L 10 -4 L 0 2 Z" fill="${accent}" opacity="0.95"/><path d="M -10 -4 L 0 2 L 0 12 L -10 6 Z" fill="${primary}"/><path d="M 10 -4 L 0 2 L 0 12 L 10 6 Z" fill="${accent}" opacity="0.72"/><path d="M -6 -2 L 0 -5 L 6 -2" fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="1"/>`;
    case "canister":
    case "capsule":
      return `${shadow}<rect x="-10" y="-7" width="20" height="14" rx="7" fill="${primary}" stroke="${accent}" stroke-width="2"/><circle cx="-4" cy="0" r="3" fill="#ffffff" opacity="0.42"/><path d="M 3 -4 V 4" stroke="#ffffff" stroke-opacity="0.42" stroke-width="1.4"/>`;
    case "crystal":
      return `${shadow}<path d="M 0 -12 L 9 -2 L 5 11 L -5 11 L -9 -2 Z" fill="${primary}" stroke="${accent}" stroke-width="2"/><path d="M 0 -9 L 0 9 M -6 -1 H 6" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>`;
    case "document":
      return `${shadow}<path d="M -8 -11 H 5 L 10 -6 V 11 H -8 Z" fill="${primary}" stroke="${accent}" stroke-width="1.4"/><path d="M 5 -11 V -6 H 10 M -5 -2 H 5 M -5 2 H 6 M -5 6 H 2" stroke="#1c2230" stroke-opacity="0.45" stroke-width="1"/>`;
    case "food":
      return `${shadow}<ellipse cx="0" cy="1" rx="12" ry="8" fill="${primary}" stroke="${accent}" stroke-width="1.5"/><path d="M -6 -1 C -2 -5 3 -5 7 -1" fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="1.2"/>`;
    case "seed":
      return `${shadow}<path d="M -8 4 C -9 -6 -1 -12 8 -7 C 10 1 3 10 -6 10 C -7 8 -8 6 -8 4 Z" fill="${primary}" stroke="${accent}" stroke-width="1.5"/><path d="M -3 5 C 0 1 3 -3 7 -7" fill="none" stroke="#ffffff" stroke-opacity="0.38" stroke-width="1"/>`;
    case "station":
      return `${shadow}<rect x="-12" y="-8" width="24" height="15" rx="2" fill="${primary}" stroke="${accent}" stroke-width="1.5"/><rect x="-8" y="-12" width="16" height="5" rx="2" fill="${accent}"/><path d="M -7 -2 H 7 M -4 4 H 4" stroke="#ffffff" stroke-opacity="0.38" stroke-width="1"/>${glyph}`;
    case "tool":
      return `${shadow}<path d="M -8 8 L 7 -7" stroke="${primary}" stroke-width="4" stroke-linecap="round"/><path d="M 2 -12 L 12 -2 L 8 2 L -2 -8 Z" fill="${accent}" stroke="#ffffff" stroke-opacity="0.32" stroke-width="1"/>`;
    case "device":
    case "utility":
    default:
      return `${shadow}<rect x="-10" y="-8" width="20" height="16" rx="3" fill="${primary}" stroke="${accent}" stroke-width="1.5"/><circle cx="6" cy="-4" r="2" fill="#ffffff" opacity="0.45"/><path d="M -6 3 H 5" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>${glyph}`;
  }
}

export function renderHarthmereBusinessServiceFrameSvgV1(
  clip: HarthmereBusinessProceduralClipV1,
  frame: HarthmereBusinessProceduralFrameV1,
  options: { width?: number; height?: number; showLabel?: boolean } = {},
) {
  const width = options.width ?? 220;
  const height = options.height ?? 150;
  const showLabel = options.showLabel !== false;
  const label = showLabel
    ? `<text x="10" y="18" fill="#dfe8ff" font-family="Arial, sans-serif" font-size="10">${escV1(clip.customerRig.displayName)}</text><text x="10" y="32" fill="#aeb9cf" font-family="Arial, sans-serif" font-size="9">${escV1(displayFamilyLabelV1(clip.family))} ${Math.round(frame.normalizedTime * 100)}%</text>`
    : "";
  const owner = renderRigFrameV1(clip.ownerRig, frame.owner, 70, 98, false);
  const customer = renderRigFrameV1(clip.customerRig, frame.customer, 150, 98, true);
  const propDataAttrs = `data-prop-source="${escV1(frame.prop.source)}" data-visual-source="${escV1(frame.prop.visual.source)}" data-visual-kind="${escV1(frame.prop.visual.shape)}" data-visual-id="${escV1(frame.prop.visual.visualId)}"${frame.prop.bikkieId ? ` data-bikkie-id="${frame.prop.bikkieId}"` : ""}${frame.prop.graphicId ? ` data-graphic-id="${escV1(frame.prop.graphicId)}"` : ""}${frame.prop.galoisPath ? ` data-galois-path="${escV1(frame.prop.galoisPath)}"` : ""}${frame.prop.visual.iconAssetPath ? ` data-icon-asset-path="${escV1(frame.prop.visual.iconAssetPath)}"` : ""}`;
  const prop = frame.prop.visible
    ? `<g ${propDataAttrs} transform="translate(${110 + frame.prop.x} ${74 + frame.prop.y * 0.18}) rotate(${frame.prop.rotationDeg.toFixed(2)}) scale(${frame.prop.scale.toFixed(2)})">${renderBikkiePropVisualSvgV1(frame.prop.visual, frame.prop.label)}</g>`
    : "";
  const progress = Math.max(0, Math.min(width - 24, (width - 24) * frame.normalizedTime));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-cue-id="${escV1(clip.cueId)}" data-npc-id="${escV1(clip.customerRig.npcId)}"><rect width="${width}" height="${height}" fill="#101722"/><rect x="0" y="0" width="${width}" height="${height}" fill="#172235" opacity="0.42"/><rect x="8" y="118" width="${width - 16}" height="7" fill="#273447"/><rect x="76" y="82" width="68" height="18" rx="3" fill="#26364d" stroke="#516680" stroke-opacity="0.7"/><rect x="84" y="78" width="52" height="5" rx="2" fill="#364961"/><path d="M 80 86 L 140 86" stroke="#8aa0b8" stroke-width="2" stroke-linecap="round" opacity="0.65"/><circle cx="110" cy="68" r="24" fill="${frame.prop.color}" opacity="0.08"/><rect x="12" y="${height - 10}" width="${width - 24}" height="3" rx="1.5" fill="#263244"/><rect x="12" y="${height - 10}" width="${progress.toFixed(2)}" height="3" rx="1.5" fill="${frame.prop.color}"/>${owner}${customer}${prop}${label}</svg>`;
}

function renderCustomerCoverageAtlasV1() {
  const cellW = 184;
  const cellH = 132;
  const cols = 5;
  const rows = Math.ceil(HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length / cols);
  const cueIds = Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1);
  const cells = HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.map((npc, index) => {
    const x = (index % cols) * cellW;
    const y = Math.floor(index / cols) * cellH;
    const cueId = cueIds[index % cueIds.length];
    const clip = createHarthmereBusinessServiceProceduralClipV1({ cueId, customerNpc: npc, sampleCount: 3 });
    const frame = clip.frames[1];
    const inner = renderHarthmereBusinessServiceFrameSvgV1(clip, frame, { width: cellW, height: cellH }).replace(/^<svg[^>]*>|<\/svg>$/g, "");
    return `<g transform="translate(${x} ${y})">${inner}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cellW * cols}" height="${cellH * rows}" viewBox="0 0 ${cellW * cols} ${cellH * rows}" data-atlas="customers" data-customer-count="${HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length}">${cells}</svg>`;
}

function renderCueCoverageAtlasV1() {
  const cues = Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1);
  const cellW = 184;
  const frameH = 132;
  const cellH = 154;
  const cols = 5;
  const rows = Math.ceil(cues.length / cols);
  const cells = cues.map((cueId, index) => {
    const x = (index % cols) * cellW;
    const y = Math.floor(index / cols) * cellH;
    const npc = HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1[index % HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length];
    const clip = createHarthmereBusinessServiceProceduralClipV1({ cueId, customerNpc: npc, sampleCount: 5 });
    const frame = clip.frames[2];
    const inner = renderHarthmereBusinessServiceFrameSvgV1(clip, frame, { width: cellW, height: frameH }).replace(/^<svg[^>]*>|<\/svg>$/g, "");
    return `<g transform="translate(${x} ${y})"><rect width="${cellW}" height="${cellH}" fill="#111722"/>${inner}<rect x="0" y="${frameH}" width="${cellW}" height="${cellH - frameH}" fill="#0f1622"/><text x="10" y="${frameH + 15}" fill="#dfe8ff" font-family="Arial, sans-serif" font-size="8">${escV1(cueId.replace(/^procedural_/, "").replace(/_/g, " ").slice(0, 32))}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cellW * cols}" height="${cellH * rows}" viewBox="0 0 ${cellW * cols} ${cellH * rows}" data-atlas="cues" data-cue-count="${cues.length}">${cells}</svg>`;
}

export function renderHarthmereBusinessProceduralAnimationVisualAuditHtmlV1() {
  const customerAtlas = renderCustomerCoverageAtlasV1();
  const cueAtlas = renderCueCoverageAtlasV1();
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Business Service Procedural Animation Visual Audit</title><style>body{margin:0;background:#0c1018;color:#dfe8ff;font-family:Inter,Arial,sans-serif}main{padding:24px;display:grid;gap:18px}.hero{display:grid;gap:10px}.summary{display:flex;gap:10px;flex-wrap:wrap}.summary span{border:1px solid #33415a;border-radius:6px;background:#141d2b;padding:8px 10px;color:#dfe8ff}section{border:1px solid #33415a;border-radius:8px;padding:14px;background:#111722;box-shadow:0 14px 28px rgba(0,0,0,.22)}h1{margin:0;font-size:30px;letter-spacing:.01em}h2{margin:0 0 12px;font-size:20px}svg{display:block;max-width:100%;height:auto}p{margin:0;color:#aeb9cf;line-height:1.5}@media(max-width:720px){main{padding:12px}h1{font-size:24px}}</style></head><body data-version="${HARTHMERE_BUSINESS_SERVICE_PROCEDURAL_ANIMATION_VERSION_V1}" data-customer-count="${HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length}" data-cue-count="${Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1).length}"><main><div class="hero"><h1>Business Service Procedural Animation Visual Audit</h1><p>Customer-only NPCs, owner service rigs, props, and cue timing are rendered from procedural voxel-safe animation data.</p><div class="summary"><span>${HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length} customer designs</span><span>${Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1).length} service cues</span><span>0 root motion</span><span>voxel safe</span></div></div><section><h2>Customer Design Coverage</h2>${customerAtlas}</section><section><h2>Service Cue Coverage</h2>${cueAtlas}</section></main></body></html>`;
}

function runtimeCombosV1() {
  const cueIds = Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1);
  const customers = HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1;
  return [
    ...cueIds.map((cueId, index) => ({
      comboId: `cue:${cueId}`,
      coverageKind: "cue" as const,
      cueId,
      customerNpc: customers[index % customers.length],
    })),
    ...customers.map((customerNpc, index) => ({
      comboId: `customer:${customerNpc.npcId}`,
      coverageKind: "customer" as const,
      cueId: cueIds[index % cueIds.length],
      customerNpc,
    })),
  ];
}

function frameMotionSignatureV1(svg: string) {
  return svg
    .replace(/\sdata-[^=]+="[^"]*"/g, "")
    .replace(/<text[\s\S]*?<\/text>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildHarthmereBusinessProceduralRuntimeCombosV1(
  sampleCount = 24,
): HarthmereBusinessProceduralRuntimeComboV1[] {
  return runtimeCombosV1().map((entry) => {
    const clip = createHarthmereBusinessServiceProceduralClipV1({
      cueId: entry.cueId,
      customerNpc: entry.customerNpc,
      sampleCount,
    });
    return {
      comboId: entry.comboId,
      coverageKind: entry.coverageKind,
      cueId: clip.cueId,
      npcId: clip.customerRig.npcId,
      label: `${clip.customerRig.displayName} · ${entry.cueId.replace(/^procedural_/, "").replace(/_/g, " ")}`,
      family: clip.family,
      durationMs: clip.durationMs,
      frameSvgs: clip.frames.map((frame) =>
        renderHarthmereBusinessServiceFrameSvgV1(clip, frame, {
          width: 220,
          height: 150,
        }),
      ),
    };
  });
}

function safeJsonScriptV1(value: unknown) {
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

export function renderHarthmereBusinessProceduralAnimationRuntimeAuditHtmlV1() {
  const combos = buildHarthmereBusinessProceduralRuntimeCombosV1();
  const data = {
    version: HARTHMERE_BUSINESS_SERVICE_PROCEDURAL_ANIMATION_VERSION_V1,
    customerCount: HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length,
    cueCount: Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1).length,
    combos,
  };
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Business Service Procedural Animation Runtime Audit</title><style>
body{margin:0;background:#0b1018;color:#e5edff;font-family:Inter,Arial,sans-serif}
main{display:grid;grid-template-columns:minmax(280px,420px) minmax(0,1fr);gap:18px;padding:22px;min-height:100vh;box-sizing:border-box}
.stage,.rail{border:1px solid #33415a;border-radius:8px;background:#111824;box-shadow:0 18px 40px rgba(0,0,0,.28)}
.stage{display:grid;align-content:start;gap:14px;padding:16px;position:sticky;top:16px;max-height:calc(100vh - 32px)}
.rail{padding:14px;overflow:auto}
h1{margin:0;font-size:24px;letter-spacing:0}p{margin:0;color:#aeb9cf;line-height:1.45}.summary{display:flex;flex-wrap:wrap;gap:8px}.summary span{border:1px solid #3d506d;border-radius:6px;background:#172235;padding:7px 9px;font-size:12px;color:#dce8ff}.viewport{border:1px solid #435976;border-radius:6px;background:#0f1622;display:grid;place-items:center;min-height:280px;overflow:hidden}.viewport svg{width:min(100%,390px);height:auto;image-rendering:auto}.controls{display:flex;gap:8px;flex-wrap:wrap}.controls button,.combo{border:1px solid #435976;border-radius:6px;background:#172235;color:#e5edff;padding:8px 10px;font-weight:800;cursor:pointer}.controls button[aria-pressed=true],.combo[aria-current=true]{border-color:#67e8f9;background:#123045}.meter{height:5px;border-radius:999px;background:#253247;overflow:hidden}.meter span{display:block;height:100%;width:0;background:#67e8f9}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}.combo{text-align:left;min-height:58px}.combo small{display:block;color:#aeb9cf;font-weight:700;margin-top:4px}.status{font-size:12px;color:#aeb9cf}
@media(max-width:860px){main{grid-template-columns:1fr;padding:12px}.stage{position:relative;top:auto;max-height:none}.viewport{min-height:230px}}
</style></head><body data-version="${HARTHMERE_BUSINESS_SERVICE_PROCEDURAL_ANIMATION_VERSION_V1}" data-runtime-audit="business-service-procedural-animation-runtime-v1" data-customer-count="${data.customerCount}" data-cue-count="${data.cueCount}" data-combo-count="${combos.length}"><main><section class="stage" aria-label="Live procedural business service animation"><div><h1>Business Service Animation Runtime Audit</h1><p>Live playback from procedural voxel-safe service frames. The viewer auto-advances through every service cue and every customer design.</p></div><div class="summary"><span>${data.customerCount} customer designs</span><span>${data.cueCount} service cues</span><span>${combos.length} runtime checks</span><span>0 root motion</span></div><div id="runtime-frame" class="viewport" aria-live="polite"></div><div class="meter" aria-label="Animation progress"><span id="runtime-progress"></span></div><div class="controls"><button id="runtime-play" type="button" aria-pressed="true">Pause</button><button id="runtime-prev" type="button">Previous</button><button id="runtime-next" type="button">Next</button><button id="runtime-speed" type="button" aria-pressed="false">1x</button></div><p id="runtime-label" class="status"></p></section><section class="rail"><h2 style="margin:0 0 10px;font-size:16px">Runtime Coverage</h2><div id="runtime-grid" class="grid"></div></section></main><script id="runtime-data" type="application/json">${safeJsonScriptV1(data)}</script><script>
(() => {
  const data = JSON.parse(document.getElementById("runtime-data").textContent);
  const frameHost = document.getElementById("runtime-frame");
  const progress = document.getElementById("runtime-progress");
  const label = document.getElementById("runtime-label");
  const grid = document.getElementById("runtime-grid");
  const playButton = document.getElementById("runtime-play");
  const speedButton = document.getElementById("runtime-speed");
  const state = { index: 0, frameIndex: -1, playing: true, speed: 1, startedAt: performance.now(), lastAdvanceCycle: -1 };
  function setIndex(index) {
    state.index = ((index % data.combos.length) + data.combos.length) % data.combos.length;
    state.frameIndex = -1;
    state.startedAt = performance.now();
    state.lastAdvanceCycle = -1;
    updateButtons();
    render(performance.now());
  }
  function updateButtons() {
    document.querySelectorAll(".combo").forEach((button, index) => {
      button.setAttribute("aria-current", String(index === state.index));
    });
  }
  function render(now) {
    const combo = data.combos[state.index];
    const elapsed = state.playing ? (now - state.startedAt) * state.speed : 0;
    const cycle = Math.floor(elapsed / combo.durationMs);
    const normalized = ((elapsed % combo.durationMs) / combo.durationMs + 1) % 1;
    const nextFrame = Math.min(combo.frameSvgs.length - 1, Math.floor(normalized * combo.frameSvgs.length));
    if (nextFrame !== state.frameIndex) {
      state.frameIndex = nextFrame;
      frameHost.innerHTML = combo.frameSvgs[nextFrame];
      frameHost.dataset.comboId = combo.comboId;
      frameHost.dataset.cueId = combo.cueId;
      frameHost.dataset.npcId = combo.npcId;
      frameHost.dataset.frameIndex = String(nextFrame);
    }
    progress.style.width = Math.round(normalized * 100) + "%";
    label.textContent = combo.label + " · " + combo.family.replace(/_/g, " ") + " · frame " + (nextFrame + 1) + "/" + combo.frameSvgs.length;
    if (state.playing && cycle > state.lastAdvanceCycle && cycle >= 2) {
      state.lastAdvanceCycle = cycle;
      setIndex(state.index + 1);
      return;
    }
    requestAnimationFrame(render);
  }
  data.combos.forEach((combo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "combo";
    button.innerHTML = "<span>" + combo.label.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char])) + "</span><small>" + combo.coverageKind + " · " + combo.family.replace(/_/g, " ") + "</small>";
    button.addEventListener("click", () => setIndex(index));
    grid.appendChild(button);
  });
  playButton.addEventListener("click", () => {
    state.playing = !state.playing;
    state.startedAt = performance.now();
    state.frameIndex = -1;
    playButton.textContent = state.playing ? "Pause" : "Play";
    playButton.setAttribute("aria-pressed", String(state.playing));
  });
  document.getElementById("runtime-prev").addEventListener("click", () => setIndex(state.index - 1));
  document.getElementById("runtime-next").addEventListener("click", () => setIndex(state.index + 1));
  speedButton.addEventListener("click", () => {
    state.speed = state.speed === 1 ? 0.5 : state.speed === 0.5 ? 1.5 : 1;
    speedButton.textContent = state.speed + "x";
    speedButton.setAttribute("aria-pressed", String(state.speed !== 1));
    state.startedAt = performance.now();
    state.frameIndex = -1;
  });
  window.__harthmereBusinessAnimationRuntimeAuditV1 = {
    data,
    state,
    select: setIndex,
    play: () => { if (!state.playing) playButton.click(); },
    pause: () => { if (state.playing) playButton.click(); },
    currentFrameHtml: () => frameHost.innerHTML,
    currentLabel: () => label.textContent,
  };
  setIndex(0);
  requestAnimationFrame(render);
})();
</script></body></html>`;
}

export function validateHarthmereBusinessProceduralAnimationRuntimeAuditV1(): HarthmereBusinessProceduralRuntimeAuditV1 {
  const cueIds = Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1);
  const warnings: string[] = [];
  const combos = buildHarthmereBusinessProceduralRuntimeCombosV1();
  let movingComboCount = 0;
  for (const combo of combos) {
    const signatures = new Set(combo.frameSvgs.map(frameMotionSignatureV1));
    if (signatures.size < 3) {
      warnings.push(`static_or_underanimated_combo:${combo.comboId}`);
    } else {
      movingComboCount += 1;
    }
    if (combo.frameSvgs.some((svg) => svg.includes("NaN") || svg.includes("undefined"))) {
      warnings.push(`invalid_runtime_svg:${combo.comboId}`);
    }
  }
  const customerCoverage = new Set(combos.map((combo) => combo.npcId));
  const cueCoverage = new Set(combos.map((combo) => combo.cueId));
  if (customerCoverage.size !== HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length) {
    warnings.push(`customer_runtime_coverage:${customerCoverage.size}`);
  }
  if (cueCoverage.size !== cueIds.length) {
    warnings.push(`cue_runtime_coverage:${cueCoverage.size}`);
  }
  return {
    ok: warnings.length === 0,
    comboCount: combos.length,
    customerCoverageCount: customerCoverage.size,
    cueCoverageCount: cueCoverage.size,
    movingComboCount,
    warnings,
  };
}

export function validateHarthmereBusinessProceduralAnimationVisualAuditV1(): HarthmereBusinessProceduralVisualAuditV1 {
  const cueIds = Object.keys(HARTHMERE_BUSINESS_SERVICE_ANIMATION_CUE_SPECS_V1);
  const warnings: string[] = [];
  for (const npc of HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1) {
    const rig = buildHarthmereBusinessCustomerProceduralRigV1(npc);
    for (const color of Object.values(rig.palette)) {
      if (!HEX.test(color)) warnings.push(`invalid_color:${npc.npcId}:${color}`);
    }
  }
  for (const cueId of cueIds) {
    for (const npc of HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1) {
      const clip = createHarthmereBusinessServiceProceduralClipV1({ cueId, customerNpc: npc, sampleCount: 5 });
      if (clip.safety.rootMotionMeters !== 0) warnings.push(`root_motion:${npc.npcId}:${cueId}`);
      if (clip.safety.maxFootDriftMeters > 0.02) warnings.push(`foot_drift:${npc.npcId}:${cueId}`);
      if (clip.safety.maxPartRotationDeg > 150) warnings.push(`rotation_over_budget:${npc.npcId}:${cueId}`);
      for (const frame of clip.frames) {
        const values = [
          frame.timeMs,
          frame.normalizedTime,
          frame.prop.x,
          frame.prop.y,
          frame.prop.rotationDeg,
          ...Object.values(frame.owner).flatMap((pose) => [pose.rotationDeg, pose.scaleX, pose.scaleY]),
          ...Object.values(frame.customer).flatMap((pose) => [pose.rotationDeg, pose.scaleX, pose.scaleY]),
        ];
        if (values.some((value) => !Number.isFinite(value))) warnings.push(`non_finite_frame:${npc.npcId}:${cueId}`);
      }
    }
  }
  return {
    ok: warnings.length === 0,
    customerCount: HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length,
    cueCount: cueIds.length,
    renderedCustomerCells: HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.length,
    renderedCueCells: cueIds.length,
    warnings,
  };
}
