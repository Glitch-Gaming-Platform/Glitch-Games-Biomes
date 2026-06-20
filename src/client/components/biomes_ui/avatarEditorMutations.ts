// Pure helpers for the BiomesUI avatar editor.
//
// The avatar editor in the options tab reuses the same persistence path as the
// wake-up screen / EditCharacterScreen: it publishes an AppearanceChangeEvent
// (skin/eye/hair color + head shape) and a HairTransplantEvent (hair style
// wearable). Keeping the event construction and change-detection in a pure,
// React-free module lets us unit test that *every* appearance part maps to the
// correct backend event without standing up the 3D preview or client context.

import {
  AppearanceChangeEvent,
  HairTransplantEvent,
} from "@/shared/ecs/gen/events";
import type {
  Appearance,
  OptionalBiomesId,
  ReadonlyAppearance,
} from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";
import { INVALID_BIOMES_ID } from "@/shared/ids";

export interface AvatarEditorSelection {
  appearance: ReadonlyAppearance;
  // The selected hair wearable item id, or undefined for "no hair".
  hairId?: BiomesId;
}

export interface AvatarMutationEvents {
  appearanceEvent: AppearanceChangeEvent;
  hairEvent: HairTransplantEvent;
}

// Normalize a hair selection coming from the editor (which uses
// INVALID_BIOMES_ID to mean "bald"/no hair) into the OptionalBiomesId the
// HairTransplantEvent expects (undefined for no hair).
export function normalizeAvatarHairId(
  hairId: BiomesId | undefined
): OptionalBiomesId {
  if (!hairId || hairId === INVALID_BIOMES_ID) {
    return undefined;
  }
  return hairId;
}

// Build the pair of ECS events that fully alter the player's appearance. The
// server handlers (appearanceChangeEventHandler / hairTransplantEventHandler)
// consume these to update the AppearanceComponent and the hair wearable slot.
export function buildAvatarMutationEvents(
  userId: BiomesId,
  selection: AvatarEditorSelection
): AvatarMutationEvents {
  const { skin_color_id, eye_color_id, hair_color_id, head_id } =
    selection.appearance;

  const appearance: Appearance = {
    skin_color_id,
    eye_color_id,
    hair_color_id,
    head_id,
  };

  return {
    appearanceEvent: new AppearanceChangeEvent({
      id: userId,
      appearance,
    }),
    hairEvent: new HairTransplantEvent({
      id: userId,
      newHairId: normalizeAvatarHairId(selection.hairId),
    }),
  };
}

// Whether the desired selection differs from the player's current appearance.
// Used to enable/disable the Save button so we don't publish no-op events.
export function avatarSelectionChanged(
  current: AvatarEditorSelection,
  next: AvatarEditorSelection
): boolean {
  const a = current.appearance;
  const b = next.appearance;
  return (
    a.skin_color_id !== b.skin_color_id ||
    a.eye_color_id !== b.eye_color_id ||
    a.hair_color_id !== b.hair_color_id ||
    a.head_id !== b.head_id ||
    normalizeAvatarHairId(current.hairId) !==
      normalizeAvatarHairId(next.hairId)
  );
}
