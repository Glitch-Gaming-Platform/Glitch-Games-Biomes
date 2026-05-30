import type { BiomesId } from "../ids";
import type { HarthmereItemObjectMetadataV1 } from "./mmo_inventory_authority_v1";

export const HARTHMERE_BIKKIE_VISUAL_RESOLVER_VERSION_V1 =
  "harthmere-bikkie-visual-resolver-v1" as const;

export type HarthmereResolvedBikkieVisualSourceV1 =
  | "galois_icon"
  | "drive_asset"
  | "procedural_voxel"
  | "metadata";

export type HarthmereResolvedBikkieVisualShapeV1 =
  | "block"
  | "canister"
  | "capsule"
  | "crystal"
  | "device"
  | "document"
  | "food"
  | "seed"
  | "station"
  | "tool"
  | "utility";

export interface HarthmereBikkieVisualResolverInputV1 {
  id?: string;
  visualId?: string;
  bikkieId?: BiomesId | string;
  label?: string;
  displayName?: string;
  bikkieName?: string;
  kind?: string;
  role?: string;
  colors?: readonly string[];
  galoisPath?: string;
  visualAsset?: string;
  objectMetadata?: HarthmereItemObjectMetadataV1;
  bikkieGraphicHints?: readonly string[];
  description?: string;
}

export interface HarthmereResolvedBikkieVisualV1 {
  version: typeof HARTHMERE_BIKKIE_VISUAL_RESOLVER_VERSION_V1;
  visualId: string;
  source: HarthmereResolvedBikkieVisualSourceV1;
  label: string;
  ariaLabel: string;
  bikkieId?: BiomesId | string;
  kind?: string;
  role?: string;
  shape: HarthmereResolvedBikkieVisualShapeV1;
  glyph: string;
  colors: readonly string[];
  hexColors: readonly string[];
  primaryHex: string;
  accentHex: string;
  cssGradient: string;
  cssShadow: string;
  galoisPath?: string;
  visualAsset?: string;
  iconAssetPath?: string;
  modelAssetPath?: string;
  procedural: {
    canGenerateWithVoxels: boolean;
    suggestedShape: string;
    sizeVoxels?: { width: number; depth: number; height: number };
    emission?: string;
  };
  metadataSummary: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

const NAMED_COLOR_HEX_V1: Array<[RegExp, string]> = [
  [/electric|screen|home[-\s]*blue|water|blue|teal|cyan|frost/i, "#3f91c8"],
  [/violet|purple|plum|indigo|lilac|rose|magenta|quartz/i, "#8664c7"],
  [/green|leaf|moss|fern|mint|olive|kelp|pine|seaweed/i, "#4f9a64"],
  [/carrot|orange|ember|fire|copper|rust|salmon|red meat|warning/i, "#d8683f"],
  [/red|cherry|seal/i, "#bd4c48"],
  [/gold|yellow|amber|brass|wheat|straw|sun/i, "#d1a84d"],
  [/brown|wood|oak|log|chestnut|soil|coffee|twine|post|grip|hide|mud/i, "#7b5438"],
  [/tan|beige|cream|ceramic|linen|paper|rice|bone|mug/i, "#e2c892"],
  [/white|moon|ivory|pearl|opal|clear/i, "#f2eadb"],
  [/silver|gray|grey|graphite|steel|iron|metal|ash|storm|slate|mailbox/i, "#8e9aa7"],
  [/black|charcoal|coal|ink|obsidian|void|dark casing|black glass/i, "#202535"],
  [/pink|raspberry|strawberry/i, "#d56b83"],
];

function hashStringV1(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hslToHexV1(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  const [r1, g1, b1] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r1, g1, b1]
    .map((v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

function shadeHexV1(hex: string, amount: number) {
  const clean = HEX.test(hex) ? hex.slice(1) : "777777";
  const values = [0, 2, 4].map((offset) =>
    parseInt(clean.slice(offset, offset + 2), 16)
  );
  return `#${values
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value + amount)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

export function harthmereBikkieColorHexV1(
  color: string | undefined,
  fallbackText = "bikkie visual"
) {
  const text = String(color ?? "").trim();
  if (HEX.test(text)) return text.toLowerCase();
  for (const [pattern, hex] of NAMED_COLOR_HEX_V1) {
    if (pattern.test(text)) return hex;
  }
  const hash = hashStringV1(`${text}:${fallbackText}`);
  return hslToHexV1(hash % 360, 48, 48);
}

export function harthmereInitialsGlyphV1(
  label: string | undefined,
  fallback = "BI"
) {
  const words = String(label ?? "")
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
  const glyph = words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (glyph || fallback).slice(0, 3);
}

function assetPathFromVisualPathV1(path: string | undefined) {
  if (!path || path.startsWith("drive://")) return undefined;
  if (path.startsWith("icons/")) return path;
  return `icons/${path}`;
}

function visualShapeForInputV1(
  input: HarthmereBikkieVisualResolverInputV1
): HarthmereResolvedBikkieVisualShapeV1 {
  const metadata = input.objectMetadata;
  const hints = input.bikkieGraphicHints ?? metadata?.bikkieGraphicHints ?? [];
  const text = [
    input.kind,
    input.role,
    input.label,
    input.displayName,
    input.bikkieName,
    metadata?.objectKind,
    metadata?.physicalForm,
    ...hints,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (metadata?.physicalForm === "block" || text.includes("voxel_block")) {
    return "block";
  }
  if (metadata?.physicalForm === "particle_capsule") return "capsule";
  if (metadata?.physicalForm === "fuel_cell") return "canister";
  if (metadata?.physicalForm === "canister") return "canister";
  if (metadata?.physicalForm === "crystal") return "crystal";
  if (metadata?.physicalForm === "document" || text.includes("document")) {
    return "document";
  }
  if (metadata?.physicalForm === "crafting_station" || text.includes("station")) {
    return "station";
  }
  if (text.includes("seed") || text.includes("spore")) return "seed";
  if (
    text.includes("food") ||
    text.includes("fish") ||
    text.includes("crop") ||
    text.includes("vegetable") ||
    text.includes("fruit") ||
    text.includes("grain")
  ) {
    return "food";
  }
  if (text.includes("tool") || text.includes("wand") || text.includes("axe")) {
    return "tool";
  }
  if (text.includes("device") || text.includes("core") || text.includes("cell")) {
    return "device";
  }
  return "utility";
}

function suggestedShapeForV1(shape: HarthmereResolvedBikkieVisualShapeV1) {
  switch (shape) {
    case "block":
      return "one-voxel block with emissive corner accents";
    case "canister":
      return "short cylinder canister with banded caps";
    case "capsule":
      return "small containment capsule with glowing center";
    case "crystal":
      return "faceted crystal shard";
    case "device":
      return "compact device with screen or energy core";
    case "document":
      return "flat document card";
    case "food":
      return "rounded food item or plated serving";
    case "seed":
      return "small seed packet";
    case "station":
      return "functional crafting station silhouette";
    case "tool":
      return "held tool silhouette";
    case "utility":
      return "compact utility prop";
  }
}

function fallbackColorsForInputV1(
  input: HarthmereBikkieVisualResolverInputV1,
  shape: HarthmereResolvedBikkieVisualShapeV1,
) {
  const text = [
    input.label,
    input.displayName,
    input.bikkieName,
    input.kind,
    input.objectMetadata?.physicalForm,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/exotic|antimatter|anti(hydrogen|helium|boron)|positron|antiproton/.test(text)) {
    return ["teal glow", "white core", "black glass"];
  }
  if (/carrot|pumpkin|marigold|azalea|daylily/.test(text)) {
    return ["carrot orange", "leaf green", "cream"];
  }
  if (/corn|wheat|grain|bread|popcorn|banana|dandelion|sunflower/.test(text)) {
    return ["wheat gold", "seed tan", "leaf green"];
  }
  if (/tomato|rose|raspberry|strawberry|berry|radish/.test(text)) {
    return ["berry red", "leaf green", "cream"];
  }
  if (/mushroom|muck|shroom|violet|lilac|grape|orchid|plumeria/.test(text)) {
    return ["violet glow", "moss green", "cream"];
  }
  if (/fish|sashimi/.test(text)) {
    return ["water blue", "silver", "salmon pink"];
  }
  if (/meat|burger|patty/.test(text)) {
    return ["red meat", "bone cream", "charcoal"];
  }
  if (/coffee|tea|cola|smoothie|drink/.test(text)) {
    return ["coffee brown", "mug cream", "teal"];
  }
  if (/seed|spore/.test(text) || shape === "seed") {
    return ["seed tan", "leaf green", "paper cream"];
  }
  if (shape === "block") return ["stone gray", "electric blue", "white"];
  if (shape === "station") return ["oak brown", "iron gray", "warm amber"];
  if (shape === "tool") return ["stone gray", "wood brown", "iron gray"];
  return ["stone gray", "electric blue"];
}

export function harthmereResolveBikkieVisualV1(
  input: HarthmereBikkieVisualResolverInputV1
): HarthmereResolvedBikkieVisualV1 {
  const label =
    input.label ??
    input.displayName ??
    input.bikkieName ??
    input.objectMetadata?.visualDescription ??
    input.id ??
    "Bikkie Item";
  const explicitColors = [
    ...(input.colors ?? []),
    ...(input.objectMetadata?.colors ?? []),
    ...(input.objectMetadata?.procedural?.palette ?? []),
  ].filter((color, index, list) => list.indexOf(color) === index);
  const shape = visualShapeForInputV1(input);
  const colors = explicitColors.length
    ? explicitColors
    : fallbackColorsForInputV1(input, shape);
  const hexColors = colors
    .slice(0, 4)
    .map((color) => harthmereBikkieColorHexV1(color, label));
  const primaryHex = hexColors[0] ?? harthmereBikkieColorHexV1(undefined, label);
  const accentHex = hexColors[1] ?? shadeHexV1(primaryHex, 38);
  const visualAsset = input.visualAsset || input.objectMetadata?.bikkieGraphicHints?.[0];
  const hasDriveAsset = Boolean(visualAsset?.startsWith("drive://"));
  const iconAssetPath = assetPathFromVisualPathV1(
    input.galoisPath || (!hasDriveAsset ? input.visualAsset : undefined)
  );
  const canGenerateWithVoxels =
    input.objectMetadata?.procedural?.canGenerateWithVoxels ??
    (shape === "block" || shape === "station" || !iconAssetPath);
  const source: HarthmereResolvedBikkieVisualSourceV1 = iconAssetPath
    ? "galois_icon"
    : hasDriveAsset
      ? "drive_asset"
      : canGenerateWithVoxels
        ? "procedural_voxel"
        : "metadata";
  const visualId =
    input.visualId ??
    input.id ??
    (input.bikkieId ? `bikkie:${input.bikkieId}` : undefined) ??
    label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  return {
    version: HARTHMERE_BIKKIE_VISUAL_RESOLVER_VERSION_V1,
    visualId,
    source,
    label,
    ariaLabel: `${label} visual`,
    bikkieId: input.bikkieId,
    kind: input.kind,
    role: input.role,
    shape,
    glyph: harthmereInitialsGlyphV1(label),
    colors,
    hexColors,
    primaryHex,
    accentHex,
    cssGradient: `linear-gradient(135deg, ${shadeHexV1(primaryHex, 26)}, ${primaryHex} 54%, ${accentHex})`,
    cssShadow: `0 0 0 1px ${shadeHexV1(accentHex, -35)}, 0 10px 18px ${shadeHexV1(primaryHex, -42)}66`,
    galoisPath: input.galoisPath,
    visualAsset: input.visualAsset,
    iconAssetPath,
    modelAssetPath: input.galoisPath,
    procedural: {
      canGenerateWithVoxels,
      suggestedShape:
        input.objectMetadata?.procedural?.suggestedShape ??
        suggestedShapeForV1(shape),
      sizeVoxels: input.objectMetadata?.sizeVoxels,
      emission: input.objectMetadata?.procedural?.emission,
    },
    metadataSummary:
      input.description ??
      input.objectMetadata?.visualDescription ??
      `${label} ${shape} visual`,
  };
}
