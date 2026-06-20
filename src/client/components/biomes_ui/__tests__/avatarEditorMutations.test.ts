import {
  avatarSelectionChanged,
  buildAvatarMutationEvents,
  normalizeAvatarHairId,
} from "@/client/components/biomes_ui/avatarEditorMutations";
import {
  BIOMES_UI_AVATAR_OPTION_KINDS,
  applyAvatarEditorOptionChange,
  avatarEditorOptionSummaryForTest,
  buildAvatarPreviewWearableOverrides,
  itemForAvatarHairId,
} from "@/client/components/biomes_ui/avatarEditorOptions";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import type { Appearance } from "@/shared/ecs/gen/types";
import { anItem } from "@/shared/game/item";
import { INVALID_BIOMES_ID } from "@/shared/ids";
import type { BiomesId } from "@/shared/ids";
import { generateTestId } from "@/shared/test_helpers";
import assert from "assert";

const USER_ID = generateTestId();
const HAIR_ID = generateTestId();
const NEXT_HAIR_ID = generateTestId();
const HEAD_ID = generateTestId();
const NEXT_HEAD_ID = generateTestId();

function baseAppearance(): Appearance {
  return {
    skin_color_id: "skin_color_1",
    eye_color_id: "eye_color_1",
    hair_color_id: "hair_color_1",
    head_id: HEAD_ID,
  };
}

describe("BiomesUI avatar editor mutations", () => {
  before(() => {
    BikkieRuntime.get().registerBiscuits(
      new Map<BiomesId, Biscuit>([
        [
          HEAD_ID,
          {
            id: HEAD_ID,
            name: "test_head",
            isHead: true,
          } as Biscuit,
        ],
        [
          NEXT_HEAD_ID,
          {
            id: NEXT_HEAD_ID,
            name: "next_test_head",
            isHead: true,
          } as Biscuit,
        ],
        [
          HAIR_ID,
          {
            id: HAIR_ID,
            name: "test_hair",
            displayName: "Test Hair",
            wearAsHair: true,
            isWearable: true,
            stackable: 1n,
          } as Biscuit,
        ],
        [
          NEXT_HAIR_ID,
          {
            id: NEXT_HAIR_ID,
            name: "next_test_hair",
            displayName: "Next Test Hair",
            wearAsHair: true,
            isWearable: true,
            stackable: 1n,
          } as Biscuit,
        ],
      ])
    );
  });

  it("exposes the same five character-design option groups as the wake-up builder", () => {
    const summaries = avatarEditorOptionSummaryForTest();

    assert.deepEqual(
      summaries.map((entry) => entry.kind),
      BIOMES_UI_AVATAR_OPTION_KINDS
    );
    assert.deepEqual(
      summaries.map((entry) => entry.label),
      ["Head shape", "Skin", "Eye color", "Hair color", "Hair style"]
    );
    for (const summary of summaries) {
      assert.ok(
        summary.count > 0,
        `${summary.kind} should expose at least one option`
      );
    }
  });

  it("maps every frontend option group to the mesh-backed selection fields", () => {
    const current = { appearance: baseAppearance(), hairId: HAIR_ID };

    assert.deepEqual(
      applyAvatarEditorOptionChange(current, {
        kind: "head",
        id: NEXT_HEAD_ID,
      }).appearance,
      { ...baseAppearance(), head_id: NEXT_HEAD_ID }
    );
    assert.deepEqual(
      applyAvatarEditorOptionChange(current, {
        kind: "skin",
        id: "skin_color_9",
      }).appearance,
      { ...baseAppearance(), skin_color_id: "skin_color_9" }
    );
    assert.deepEqual(
      applyAvatarEditorOptionChange(current, {
        kind: "eyes",
        id: "eye_color_9",
      }).appearance,
      { ...baseAppearance(), eye_color_id: "eye_color_9" }
    );
    assert.deepEqual(
      applyAvatarEditorOptionChange(current, {
        kind: "hairColor",
        id: "hair_color_9",
      }).appearance,
      { ...baseAppearance(), hair_color_id: "hair_color_9" }
    );

    assert.equal(
      applyAvatarEditorOptionChange(current, {
        kind: "hairStyle",
        id: NEXT_HAIR_ID,
      }).hairId,
      NEXT_HAIR_ID
    );
    assert.equal(
      applyAvatarEditorOptionChange(current, {
        kind: "hairStyle",
        id: INVALID_BIOMES_ID as BiomesId,
      }).hairId,
      undefined
    );
  });

  it("updates the preview wearable inputs that rebuild the player mesh", () => {
    const currentHair = anItem(HAIR_ID);
    const nextHair = anItem(NEXT_HAIR_ID);
    const wearing = new Map([[BikkieIds.hair, currentHair]]);

    const withNewHair = buildAvatarPreviewWearableOverrides(
      wearing,
      nextHair
    );
    assert.equal(withNewHair.get(BikkieIds.hair)?.id, NEXT_HAIR_ID);

    const bald = buildAvatarPreviewWearableOverrides(wearing, undefined);
    assert.equal(bald.get(BikkieIds.hair), undefined);
    assert.equal(
      itemForAvatarHairId(INVALID_BIOMES_ID as BiomesId),
      undefined
    );
  });

  it("builds an AppearanceChangeEvent carrying every appearance part", () => {
    const appearance: Appearance = {
      skin_color_id: "skin_color_5",
      eye_color_id: "eye_color_3",
      hair_color_id: "hair_color_8",
      head_id: HEAD_ID,
    };

    const { appearanceEvent } = buildAvatarMutationEvents(USER_ID, {
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
    const { hairEvent } = buildAvatarMutationEvents(USER_ID, {
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

    const { hairEvent } = buildAvatarMutationEvents(USER_ID, {
      appearance: baseAppearance(),
      hairId: INVALID_BIOMES_ID as BiomesId,
    });
    assert.equal(hairEvent.newHairId, undefined);
  });

  it("detects a change for each editable appearance part", () => {
    const current = { appearance: baseAppearance(), hairId: HAIR_ID };

    // Identical selection => no change.
    assert.equal(
      avatarSelectionChanged(current, {
        appearance: baseAppearance(),
        hairId: HAIR_ID,
      }),
      false
    );

    // Skin color.
    assert.equal(
      avatarSelectionChanged(current, {
        appearance: { ...baseAppearance(), skin_color_id: "skin_color_9" },
        hairId: HAIR_ID,
      }),
      true
    );

    // Eye color.
    assert.equal(
      avatarSelectionChanged(current, {
        appearance: { ...baseAppearance(), eye_color_id: "eye_color_9" },
        hairId: HAIR_ID,
      }),
      true
    );

    // Hair color.
    assert.equal(
      avatarSelectionChanged(current, {
        appearance: { ...baseAppearance(), hair_color_id: "hair_color_9" },
        hairId: HAIR_ID,
      }),
      true
    );

    // Head shape.
    assert.equal(
      avatarSelectionChanged(current, {
        appearance: { ...baseAppearance(), head_id: generateTestId() },
        hairId: HAIR_ID,
      }),
      true
    );

    // Hair style (wearable).
    assert.equal(
      avatarSelectionChanged(current, {
        appearance: baseAppearance(),
        hairId: undefined,
      }),
      true
    );
  });
});
