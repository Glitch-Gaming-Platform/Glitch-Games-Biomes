import * as React from "react";
import {
  BIOMES_UI_ACTIVE_MAP_PIN_EVENT_V142,
  readActiveBiomesUIMapPinV142,
  type BiomesUIActiveMapPinV142,
} from "./adapters/mapPinnedDestination";
import {
  BIOMES_UI_MAIN_QUEST_EVENT_V1,
  type BiomesUIMainQuestSelectionV1,
  mainQuestFromTrackableQuestsForTest,
  readBiomesUIMainQuestSelectionV1,
} from "./adapters/mainQuestSelection";
import { questDetailToolShopMarkerCandidatesV1 } from "./tabs/questDetailToolSourceV1";
import type { MapTrackableQuest } from "./tabs/MapQuestsTab";

interface CurrentQuestObjectiveMapAdapter {
  getTrackableQuests?: () => MapTrackableQuest[];
  getMissionSteps?: () => Array<{ objective: string; done: boolean }>;
  getActiveMapPin?: () => BiomesUIActiveMapPinV142 | undefined;
  getMainQuestSelection?: () => BiomesUIMainQuestSelectionV1 | undefined;
}

function cleanObjectiveText(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : undefined;
}

function questToolSourceMatchesActivePin(
  quest: MapTrackableQuest,
  pin: BiomesUIActiveMapPinV142 | undefined
): boolean {
  return Boolean(
    pin?.markerId &&
      questDetailToolShopMarkerCandidatesV1(quest).includes(pin.markerId)
  );
}

function questIsDisplayableOnHUD(quest: MapTrackableQuest): boolean {
  return quest.status !== "completed" && quest.status !== "failed";
}

function questObjectiveForHUD(
  quest: MapTrackableQuest | undefined,
  pin?: BiomesUIActiveMapPinV142
): string | undefined {
  if (!quest) return undefined;
  if (questToolSourceMatchesActivePin(quest, pin)) {
    const toolHint = cleanObjectiveText(quest.toolSource?.hint);
    if (toolHint) return toolHint;
  }
  return (
    cleanObjectiveText(quest.objective) ??
    quest.objectives?.map(cleanObjectiveText).find(Boolean)
  );
}

function questMatchesActivePin(
  quest: MapTrackableQuest,
  pin: BiomesUIActiveMapPinV142 | undefined
): boolean {
  if (!pin?.markerId) return false;
  if (quest.firstMarkerId === pin.markerId) return true;
  return questDetailToolShopMarkerCandidatesV1(quest).includes(pin.markerId);
}

export function currentQuestObjectiveForHUDForTest(input: {
  quests: MapTrackableQuest[];
  missionSteps?: Array<{ objective: string; done: boolean }>;
  activeMapPin?: BiomesUIActiveMapPinV142;
  mainQuestSelection?: BiomesUIMainQuestSelectionV1;
}): string | undefined {
  const mainQuest = mainQuestFromTrackableQuestsForTest(
    input.quests,
    input.mainQuestSelection
  );
  const pinnedQuest = input.activeMapPin
    ? input.quests.find((quest) =>
        questMatchesActivePin(quest, input.activeMapPin)
      )
    : undefined;
  const activeQuest = input.quests.find(
    (quest) =>
      quest.status === "active" &&
      questIsDisplayableOnHUD(quest) &&
      questObjectiveForHUD(quest)
  );
  const currentMissionStep = input.missionSteps?.find(
    (step) => !step.done && cleanObjectiveText(step.objective)
  );
  return (
    questObjectiveForHUD(mainQuest) ??
    (input.quests.length === 0
      ? cleanObjectiveText(input.mainQuestSelection?.objective)
      : undefined) ??
    questObjectiveForHUD(
      pinnedQuest && questIsDisplayableOnHUD(pinnedQuest)
        ? pinnedQuest
        : undefined,
      input.activeMapPin
    ) ??
    questObjectiveForHUD(activeQuest) ??
    cleanObjectiveText(currentMissionStep?.objective)
  );
}

export const CurrentQuestObjectiveHUD: React.FunctionComponent<{
  adapter?: CurrentQuestObjectiveMapAdapter;
  isOpen?: boolean;
}> = ({ adapter, isOpen = false }) => {
  const [activeMapPin, setActiveMapPin] = React.useState<
    BiomesUIActiveMapPinV142 | undefined
  >(() => adapter?.getActiveMapPin?.() ?? readActiveBiomesUIMapPinV142());
  const [mainQuestSelection, setMainQuestSelection] = React.useState<
    BiomesUIMainQuestSelectionV1 | undefined
  >(
    () =>
      adapter?.getMainQuestSelection?.() ?? readBiomesUIMainQuestSelectionV1()
  );
  const [revision, setRevision] = React.useState(0);

  React.useEffect(() => {
    setActiveMapPin(
      adapter?.getActiveMapPin?.() ?? readActiveBiomesUIMapPinV142()
    );
    setMainQuestSelection(
      adapter?.getMainQuestSelection?.() ?? readBiomesUIMainQuestSelectionV1()
    );
  }, [adapter]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onPin = (event: Event) => {
      setActiveMapPin(
        (event as CustomEvent<BiomesUIActiveMapPinV142 | undefined>).detail ??
          readActiveBiomesUIMapPinV142()
      );
      setRevision((value) => value + 1);
    };
    window.addEventListener(BIOMES_UI_ACTIVE_MAP_PIN_EVENT_V142, onPin);
    window.addEventListener("storage", onPin);
    return () => {
      window.removeEventListener(BIOMES_UI_ACTIVE_MAP_PIN_EVENT_V142, onPin);
      window.removeEventListener("storage", onPin);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onMainQuest = (event: Event) => {
      setMainQuestSelection(
        (event as CustomEvent<BiomesUIMainQuestSelectionV1 | undefined>)
          .detail ??
          adapter?.getMainQuestSelection?.() ??
          readBiomesUIMainQuestSelectionV1()
      );
      setRevision((value) => value + 1);
    };
    window.addEventListener(BIOMES_UI_MAIN_QUEST_EVENT_V1, onMainQuest);
    window.addEventListener("storage", onMainQuest);
    return () => {
      window.removeEventListener(BIOMES_UI_MAIN_QUEST_EVENT_V1, onMainQuest);
      window.removeEventListener("storage", onMainQuest);
    };
  }, [adapter]);

  const objective = React.useMemo(() => {
    const quests = adapter?.getTrackableQuests?.() ?? [];
    const missionSteps = adapter?.getMissionSteps?.();
    return currentQuestObjectiveForHUDForTest({
      quests,
      missionSteps,
      activeMapPin,
      mainQuestSelection,
    });
  }, [adapter, activeMapPin, mainQuestSelection, revision]);

  if (isOpen || !objective) {
    return null;
  }

  return (
    <aside
      className="biomes-ui-current-objective-hud"
      aria-label="Current objective"
      aria-live="polite"
    >
      <div className="biomes-ui-current-objective-hud__label">Objective</div>
      <div className="biomes-ui-current-objective-hud__text">{objective}</div>
    </aside>
  );
};
