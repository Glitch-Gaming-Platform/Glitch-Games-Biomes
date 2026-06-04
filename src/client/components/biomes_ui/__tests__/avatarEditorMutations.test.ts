import {
  avatarSelectionChangedV1,
  buildAvatarMutationEventsV1,
  normalizeAvatarHairId,
} from "@/client/components/biomes_ui/avatarEditorMutations";
import type { Appearance } from "@/shared/ecs/gen/types";
import { INVALID_BIOMES_ID } from "@/shared/ids";
import type { BiomesId } from "@/shared/ids";
import { generateTestId } from "@/shared/test_helpers";
import assert from "assert";

const USER_ID = generateTestId();
const HAIR_ID = generateTestId();
const HEAD_ID = generateTestId();

function baseAppearance(): Appearance {
  return {
    skin_color_id: "skin_color_1",
    eye_color_id: "eye_color_1",
    hair_color_id: "hair_color_1",
    head_id: HEAD_ID,
  };
}

describe("BiomesUI avatar editor mutations", () => {
  it("builds an AppearanceChangeEvent carrying every appearance part", () => {
    const appearance: Appearance = {
      skin_color_id: "skin_color_5",
      eye_color_id: "eye_color_3",
      hair_color_id: "hair_color_8",
      head_id: HEAD_ID,
    };

    const { appearanceEvent } = buildAvatarMutationEventsV1(USER_ID, {
      appearance,
      hairId: HAIR_ID,
    });

    assert.equal(appearanceEvent.kind, "appearanceChangeEvent");
    assert.equal(appearanceEvent.id, USER_ID);
    assert.equal(appearanceEvent.appearance.skin_color_id, "skin_color_5");
    assert.equal(appearanceEvent.appearance.eye_color_id, "eye_color_3");
    assert.equal(appearanceEvent.appearance.hair_color_id, "hair_color_8");
    assert.equal(appearanceEvent.appearance.head_id, HEAD_ID);
  });

  it("builds a HairTransplantEvent for the selected hair style", () => {
    const { hairEvent } = buildAvatarMutationEventsV1(USER_ID, {
      appearance: baseAppearance(),
      hairId: HAIR_ID,
    });

    assert.equal(hairEvent.kind, "hairTransplantEvent");
    assert.equal(hairEvent.id, USER_ID);
    assert.equal(hairEvent.newHairId, HAIR_ID);
  });

  it("treats INVALID_BIOMES_ID and undefined hair as 'no hair'", () => {
    assert.equal(normalizeAvatarHairId(undefined), undefined);
    assert.equal(normalizeAvatarHairId(INVALID_BIOMES_ID), undefined);
    assert.equal(normalizeAvatarHairId(HAIR_ID), HAIR_ID);

    const { hairEvent } = buildAvatarMutationEventsV1(USER_ID, {
      appearance: baseAppearance(),
      hairId: INVALID_BIOMES_ID as BiomesId,
    });
    assert.equal(hairEvent.newHairId, undefined);
  });

  it("detects a change for each editable appearance part", () => {
    const current = { appearance: baseAppearance(), hairId: HAIR_ID };

    // Identical selection => no change.
    assert.equal(
      avatarSelectionChangedV1(current, {
        appearance: baseAppearance(),
        hairId: HAIR_ID,
      }),
      false
    );

    // Skin color.
    assert.equal(
      avatarSelectionChangedV1(current, {
        appearance: { ...baseAppearance(), skin_color_id: "skin_color_9" },
        hairId: HAIR_ID,
      }),
      true
    );

    // Eye color.
    assert.equal(
      avatarSelectionChangedV1(current, {
        appearance: { ...baseAppearance(), eye_color_id: "eye_color_9" },
        hairId: HAIR_ID,
      }),
      true
    );

    // Hair color.
    assert.equal(
      avatarSelectionChangedV1(current, {
        appearance: { ...baseAppearance(), hair_color_id: "hair_color_9" },
        hairId: HAIR_ID,
      }),
      true
    );

    // Head shape.
    assert.equal(
      avatarSelectionChangedV1(current, {
        appearance: { ...baseAppearance(), head_id: generateTestId() },
        hairId: HAIR_ID,
      }),
      true
    );

    // Hair style (wearable).
    assert.equal(
      avatarSelectionChangedV1(current, {
        appearance: baseAppearance(),
        hairId: undefined,
      }),
      true
    );
  });
});
