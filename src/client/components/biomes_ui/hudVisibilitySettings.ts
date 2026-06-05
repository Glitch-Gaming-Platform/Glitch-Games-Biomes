import {
  addTypedStorageChangeListener,
  getTypedStorageItem,
  removeTypedStorageChangeListener,
  setTypedStorageItem,
  type TypesafeLocalStorageSchema,
} from "@/client/util/typed_local_storage";
import * as React from "react";

export type BiomesHUDVisibilityIdV1 =
  | "objectives"
  | "miniMap"
  | "helpButtons"
  | "hotbar"
  | "vitals"
  | "actionBar";

type BiomesHUDVisibilityStorageKeyV1 = Extract<
  keyof TypesafeLocalStorageSchema,
  | "settings.hud.showObjectives"
  | "settings.hud.showMiniMap"
  | "settings.hud.showHelpButtons"
  | "settings.hud.showHotbar"
  | "settings.hud.showVitals"
  | "settings.hud.showActionBar"
>;

export type BiomesHUDVisibilitySnapshotV1 = Record<
  BiomesHUDVisibilityIdV1,
  boolean
>;

export const BIOMES_HUD_VISIBILITY_OPTIONS_V1: readonly {
  id: BiomesHUDVisibilityIdV1;
  label: string;
  description: string;
  storageKey: BiomesHUDVisibilityStorageKeyV1;
}[] = [
  {
    id: "objectives",
    label: "Objectives",
    description: "Current objective cards and quest tracker HUD callouts.",
    storageKey: "settings.hud.showObjectives",
  },
  {
    id: "miniMap",
    label: "Mini Map",
    description: "The circular map in the corner of the HUD.",
    storageKey: "settings.hud.showMiniMap",
  },
  {
    id: "helpButtons",
    label: "Help Buttons",
    description: "On-screen shortcut prompts and tutorial cue buttons.",
    storageKey: "settings.hud.showHelpButtons",
  },
  {
    id: "hotbar",
    label: "Hotbar",
    description: "The bottom item/action slot bar.",
    storageKey: "settings.hud.showHotbar",
  },
  {
    id: "vitals",
    label: "Vitals",
    description: "Health, mana, stamina, level, gold, and reputation.",
    storageKey: "settings.hud.showVitals",
  },
  {
    id: "actionBar",
    label: "Action Bar",
    description: "The Harthmere bottom action shortcuts.",
    storageKey: "settings.hud.showActionBar",
  },
];

const HUD_VISIBILITY_BY_ID_V1 = new Map(
  BIOMES_HUD_VISIBILITY_OPTIONS_V1.map((option) => [option.id, option])
);

export function defaultBiomesHUDVisibilitySnapshotV1(): BiomesHUDVisibilitySnapshotV1 {
  return {
    objectives: true,
    miniMap: true,
    helpButtons: true,
    hotbar: true,
    vitals: true,
    actionBar: true,
  };
}

export function biomesHUDVisibilityStorageKeyForTest(
  id: BiomesHUDVisibilityIdV1
): BiomesHUDVisibilityStorageKeyV1 {
  const option = HUD_VISIBILITY_BY_ID_V1.get(id);
  if (!option) {
    throw new Error(`Unknown HUD visibility setting: ${id}`);
  }
  return option.storageKey;
}

export function readBiomesHUDVisibilitySettingV1(
  id: BiomesHUDVisibilityIdV1
): boolean {
  return getTypedStorageItem(biomesHUDVisibilityStorageKeyForTest(id)) ?? true;
}

export function setBiomesHUDVisibilitySettingV1(
  id: BiomesHUDVisibilityIdV1,
  visible: boolean
) {
  setTypedStorageItem(biomesHUDVisibilityStorageKeyForTest(id), visible);
}

export function biomesHUDVisibilitySnapshotWithDefaultsForTest(
  overrides: Partial<BiomesHUDVisibilitySnapshotV1> = {}
): BiomesHUDVisibilitySnapshotV1 {
  return { ...defaultBiomesHUDVisibilitySnapshotV1(), ...overrides };
}

export function shouldShowBiomesHUDElementForTest(
  snapshot: Partial<BiomesHUDVisibilitySnapshotV1> | undefined,
  id: BiomesHUDVisibilityIdV1
): boolean {
  return snapshot?.[id] ?? true;
}

export function toggledBiomesHUDVisibilitySnapshotForTest(
  snapshot: Partial<BiomesHUDVisibilitySnapshotV1> | undefined,
  id: BiomesHUDVisibilityIdV1,
  visible: boolean
): BiomesHUDVisibilitySnapshotV1 {
  return {
    ...defaultBiomesHUDVisibilitySnapshotV1(),
    ...snapshot,
    [id]: visible,
  };
}

export function useBiomesHUDVisibilitySettingV1(
  id: BiomesHUDVisibilityIdV1
): [boolean, (visible: boolean) => void] {
  const storageKey = biomesHUDVisibilityStorageKeyForTest(id);
  const [visible, setVisibleState] = React.useState(() =>
    readBiomesHUDVisibilitySettingV1(id)
  );

  React.useEffect(() => {
    const onChange = (next: boolean) => setVisibleState(next ?? true);
    const refresh = () => setVisibleState(readBiomesHUDVisibilitySettingV1(id));
    addTypedStorageChangeListener(storageKey, onChange);
    if (typeof window !== "undefined") {
      window.addEventListener("storage", refresh);
    }
    return () => {
      removeTypedStorageChangeListener(storageKey, onChange);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", refresh);
      }
    };
  }, [id, storageKey]);

  const setVisible = React.useCallback(
    (next: boolean) => {
      setBiomesHUDVisibilitySettingV1(id, next);
      setVisibleState(next);
    },
    [id]
  );

  return [visible, setVisible];
}

export function useBiomesHUDVisibilitySnapshotV1(
  overrides: Partial<BiomesHUDVisibilitySnapshotV1> = {}
): BiomesHUDVisibilitySnapshotV1 {
  const [objectives] = useBiomesHUDVisibilitySettingV1("objectives");
  const [miniMap] = useBiomesHUDVisibilitySettingV1("miniMap");
  const [helpButtons] = useBiomesHUDVisibilitySettingV1("helpButtons");
  const [hotbar] = useBiomesHUDVisibilitySettingV1("hotbar");
  const [vitals] = useBiomesHUDVisibilitySettingV1("vitals");
  const [actionBar] = useBiomesHUDVisibilitySettingV1("actionBar");

  return {
    objectives,
    miniMap,
    helpButtons,
    hotbar,
    vitals,
    actionBar,
    ...overrides,
  };
}
