import { colorEntries } from "@/shared/asset_defs/color_palettes";
import type { PaletteKey } from "@/shared/asset_defs/color_palettes";
import { getBiscuits } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import { bikkie } from "@/shared/bikkie/schema/biomes";
import type {
  Appearance,
  Item,
  ItemAssignment,
  ReadonlyAppearance,
} from "@/shared/ecs/gen/types";
import { anItem } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";
import { INVALID_BIOMES_ID } from "@/shared/ids";

export const BIOMES_UI_AVATAR_OPTION_KINDS = [
  "head",
  "skin",
  "eyes",
  "hairColor",
  "hairStyle",
] as const;

export type BiomesUIAvatarOptionKind =
  (typeof BIOMES_UI_AVATAR_OPTION_KINDS)[number];

export interface AvatarEditorSelectionState {
  appearance: ReadonlyAppearance;
  hairId?: BiomesId;
}

export type AvatarEditorOptionChange =
  | { kind: "head"; id: BiomesId }
  | { kind: "skin"; id: string }
  | { kind: "eyes"; id: string }
  | { kind: "hairColor"; id: string }
  | { kind: "hairStyle"; id: BiomesId };

export interface AvatarEditorOptionSummary {
  kind: BiomesUIAvatarOptionKind;
  label: string;
  count: number;
  palette?: PaletteKey;
}

export function avatarEditorHeadIds(): BiomesId[] {
  return getBiscuits(bikkie.schema.head).map(({ id }) => id);
}

export function avatarEditorHairStyleIds(): BiomesId[] {
  return getBiscuits(bikkie.schema.items.wearables.hair)
    .map(({ id }) => id)
    .filter((id) => id !== BikkieIds.hair);
}

export function avatarEditorOptionSummaryForTest(): AvatarEditorOptionSummary[] {
  return [
    {
      kind: "head",
      label: "Head shape",
      count: avatarEditorHeadIds().length,
    },
    {
      kind: "skin",
      label: "Skin",
      palette: "color_palettes/skin_colors",
      count: colorEntries("color_palettes/skin_colors").length,
    },
    {
      kind: "eyes",
      label: "Eye color",
      palette: "color_palettes/eye_colors",
      count: colorEntries("color_palettes/eye_colors").length,
    },
    {
      kind: "hairColor",
      label: "Hair color",
      palette: "color_palettes/hair_colors",
      count: colorEntries("color_palettes/hair_colors").length,
    },
    {
      kind: "hairStyle",
      label: "Hair style",
      count: avatarEditorHairStyleIds().length + 1,
    },
  ];
}

export function applyAvatarEditorOptionChange(
  selection: AvatarEditorSelectionState,
  change: AvatarEditorOptionChange
): AvatarEditorSelectionState {
  const appearance: Appearance = { ...selection.appearance };
  switch (change.kind) {
    case "head":
      appearance.head_id = change.id;
      return { appearance, hairId: selection.hairId };
    case "skin":
      appearance.skin_color_id = change.id;
      return { appearance, hairId: selection.hairId };
    case "eyes":
      appearance.eye_color_id = change.id;
      return { appearance, hairId: selection.hairId };
    case "hairColor":
      appearance.hair_color_id = change.id;
      return { appearance, hairId: selection.hairId };
    case "hairStyle":
      return {
        appearance,
        hairId: change.id === INVALID_BIOMES_ID ? undefined : change.id,
      };
  }
}

export function itemForAvatarHairId(
  id: BiomesId | undefined
): Item | undefined {
  return id && id !== INVALID_BIOMES_ID ? anItem(id) : undefined;
}

export function buildAvatarPreviewWearableOverrides(
  currentWearing: ItemAssignment | undefined,
  previewHair: Item | undefined
): ItemAssignment {
  const wearableOverrides: ItemAssignment = new Map(currentWearing);
  if (previewHair) {
    wearableOverrides.set(BikkieIds.hair, previewHair);
  } else {
    wearableOverrides.delete(BikkieIds.hair);
  }
  return wearableOverrides;
}
