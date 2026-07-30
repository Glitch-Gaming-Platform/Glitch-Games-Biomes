import {
  addTypedStorageChangeListener,
  getTypedStorageItem,
  removeTypedStorageChangeListener,
  setTypedStorageItem,
  type TypesafeLocalStorageSchema,
} from "@/client/util/typed_local_storage";
import * as React from "react";

export type BiomesHUDVisibilityId =
  | "objectives"
  | "miniMap"
  | "helpButtons"
  | "hotbar"
  | "vitals"
  | "actionBar";

type BiomesHUDVisibilityStorageKey = Extract<
  keyof TypesafeLocalStorageSchema,
  | "settings.hud.showObjectives"
  | "settings.hud.showMiniMap"
  | "settings.hud.showHelpButtons"
  | "settings.hud.showHotbar"
  | "settings.hud.showVitals"
  | "settings.hud.showActionBar"
>;

export type BiomesHUDVisibilitySnapshot = Record<
  BiomesHUDVisibilityId,
  boolean
>;

export const BIOMES_HUD_VISIBILITY_OPTIONS: readonly {
  id: BiomesHUDVisibilityId;
  label: string;
  description: string;
  storageKey: BiomesHUDVisibilityStorageKey;
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
    description: "On-screen shortcut prompts for recipes and quests.",
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

const HUD_VISIBILITY_BY_ID = new Map(
  BIOMES_HUD_VISIBILITY_OPTIONS.map((option) => [option.id, option])
);

export function defaultBiomesHUDVisibilitySnapshot(): BiomesHUDVisibilitySnapshot {
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
  id: BiomesHUDVisibilityId
): BiomesHUDVisibilityStorageKey {
  const option = HUD_VISIBILITY_BY_ID.get(id);
  if (!option) {
    throw new Error(`Unknown HUD visibility setting: ${id}`);
  }
  return option.storageKey;
}

export function readBiomesHUDVisibilitySetting(
  id: BiomesHUDVisibilityId
): boolean {
  return getTypedStorageItem(biomesHUDVisibilityStorageKeyForTest(id)) ?? true;
}

export function setBiomesHUDVisibilitySetting(
  id: BiomesHUDVisibilityId,
  visible: boolean
) {
  setTypedStorageItem(biomesHUDVisibilityStorageKeyForTest(id), visible);
}

export function biomesHUDVisibilitySnapshotWithDefaultsForTest(
  overrides: Partial<BiomesHUDVisibilitySnapshot> = {}
): BiomesHUDVisibilitySnapshot {
  return { ...defaultBiomesHUDVisibilitySnapshot(), ...overrides };
}

export function shouldShowBiomesHUDElementForTest(
  snapshot: Partial<BiomesHUDVisibilitySnapshot> | undefined,
  id: BiomesHUDVisibilityId
): boolean {
  return snapshot?.[id] ?? true;
}

export function toggledBiomesHUDVisibilitySnapshotForTest(
  snapshot: Partial<BiomesHUDVisibilitySnapshot> | undefined,
  id: BiomesHUDVisibilityId,
  visible: boolean
): BiomesHUDVisibilitySnapshot {
  return {
    ...defaultBiomesHUDVisibilitySnapshot(),
    ...snapshot,
    [id]: visible,
  };
}

export function useBiomesHUDVisibilitySetting(
  id: BiomesHUDVisibilityId
): [boolean, (visible: boolean) => void] {
  const storageKey = biomesHUDVisibilityStorageKeyForTest(id);
  const [visible, setVisibleState] = React.useState(() =>
    readBiomesHUDVisibilitySetting(id)
  );

  React.useEffect(() => {
    const onChange = (next: boolean) => setVisibleState(next ?? true);
    const refresh = () => setVisibleState(readBiomesHUDVisibilitySetting(id));
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
      setBiomesHUDVisibilitySetting(id, next);
      setVisibleState(next);
    },
    [id]
  );

  return [visible, setVisible];
}

export function useBiomesHUDVisibilitySnapshot(
  overrides: Partial<BiomesHUDVisibilitySnapshot> = {}
): BiomesHUDVisibilitySnapshot {
  const [objectives] = useBiomesHUDVisibilitySetting("objectives");
  const [miniMap] = useBiomesHUDVisibilitySetting("miniMap");
  const [helpButtons] = useBiomesHUDVisibilitySetting("helpButtons");
  const [hotbar] = useBiomesHUDVisibilitySetting("hotbar");
  const [vitals] = useBiomesHUDVisibilitySetting("vitals");
  const [actionBar] = useBiomesHUDVisibilitySetting("actionBar");

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
