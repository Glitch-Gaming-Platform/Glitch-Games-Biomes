import * as React from "react";
import {
  BIOMES_UI_ACTIVE_MAP_PIN_EVENT,
  readActiveBiomesUIMapPin,
  type BiomesUIActiveMapPin,
} from "./adapters/mapPinnedDestination";
import {
  BIOMES_UI_MAIN_QUEST_EVENT,
  type BiomesUIMainQuestSelection,
  isBiomesUIMainQuestClearedSelection,
  mainQuestFromTrackableQuestsForTest,
  readBiomesUIMainQuestSelection,
} from "./adapters/mainQuestSelection";
import {
  questDetailItemSourceMarkerCandidates,
  questDetailToolShopMarkerCandidates,
} from "./tabs/questDetailToolSource";
import type { MapTrackableQuest } from "./tabs/MapQuestsTab";

interface CurrentQuestObjectiveMapAdapter {
  getTrackableQuests?: () => MapTrackableQuest[];
  getMissionSteps?: () => Array<{ objective: string; done: boolean }>;
  getActiveMapPin?: () => BiomesUIActiveMapPin | undefined;
  getMainQuestSelection?: () => BiomesUIMainQuestSelection | undefined;
}

function cleanObjectiveText(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : undefined;
}

/**
 * Keep recipe guidance semantic rather than quest-id-specific. Native Bikkie,
 * jobs-board, and future authored quests all feed objective prose into this
 * HUD, so an imperative creation verb is the stable common contract. Avoid
 * broad words such as "get" or "obtain": those objectives may point to a
 * crate, vendor, or drop and should not incorrectly send the player to R.
 */
export function objectiveRequiresRecipesForTest(objective: unknown) {
  const text = cleanObjectiveText(objective)?.toLowerCase();
  return Boolean(
    text &&
      /\b(?:handcraft|craft|mix|brew|cook|bake|smelt|forge|assemble)\b/.test(
        text
      )
  );
}

export function shouldShowRecipeObjectiveHintForTest(
  objective: unknown,
  isOpen: boolean
) {
  return !isOpen && objectiveRequiresRecipesForTest(objective);
}

function questToolSourceMatchesActivePin(
  quest: MapTrackableQuest,
  pin: BiomesUIActiveMapPin | undefined
): boolean {
  return Boolean(
    pin?.markerId &&
      questDetailToolShopMarkerCandidates(quest).includes(pin.markerId)
  );
}

function questItemSourceMatchesActivePin(
  quest: MapTrackableQuest,
  pin: BiomesUIActiveMapPin | undefined
): boolean {
  return Boolean(
    pin?.markerId &&
      questDetailItemSourceMarkerCandidates(quest).includes(pin.markerId)
  );
}

function questIsDisplayableOnHUD(quest: MapTrackableQuest): boolean {
  return quest.status !== "completed" && quest.status !== "failed";
}

function questIsRoadAheadStoryQuest(quest: MapTrackableQuest): boolean {
  return (
    quest.questId === "snapshot_road_ahead_full_chain" ||
    quest.kind === "snapshot_nux_challenge_bridge" ||
    (quest.title.trim().toLowerCase() === "road ahead" &&
      quest.kindLabel?.trim().toLowerCase() === "story quest")
  );
}

function questObjectiveForHUD(
  quest: MapTrackableQuest | undefined,
  pin?: BiomesUIActiveMapPin
): string | undefined {
  if (!quest) return undefined;
  if (questToolSourceMatchesActivePin(quest, pin)) {
    const toolHint = cleanObjectiveText(quest.toolSource?.hint);
    if (toolHint) return toolHint;
  }
  if (questItemSourceMatchesActivePin(quest, pin)) {
    const itemHint = cleanObjectiveText(quest.itemSource?.hint);
    if (itemHint) return itemHint;
  }
  return (
    cleanObjectiveText(quest.objective) ??
    quest.objectives?.map(cleanObjectiveText).find(Boolean)
  );
}

function questMatchesActivePin(
  quest: MapTrackableQuest,
  pin: BiomesUIActiveMapPin | undefined
): boolean {
  if (!pin?.markerId) return false;
  if (quest.firstMarkerId === pin.markerId) return true;
  return (
    questDetailToolShopMarkerCandidates(quest).includes(pin.markerId) ||
    questDetailItemSourceMarkerCandidates(quest).includes(pin.markerId)
  );
}

export function currentQuestObjectiveForHUDForTest(input: {
  quests: MapTrackableQuest[];
  missionSteps?: Array<{ objective: string; done: boolean }>;
  activeMapPin?: BiomesUIActiveMapPin;
  mainQuestSelection?: BiomesUIMainQuestSelection;
}): string | undefined {
  const explicitlyCleared = isBiomesUIMainQuestClearedSelection(
    input.mainQuestSelection
  );
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
  const activeRoadAheadQuest = input.quests.find(
    (quest) =>
      quest.status === "active" &&
      questIsRoadAheadStoryQuest(quest) &&
      questIsDisplayableOnHUD(quest) &&
      questObjectiveForHUD(quest)
  );
  const currentMissionStep = input.missionSteps?.find(
    (step) => !step.done && cleanObjectiveText(step.objective)
  );
  return (
    // An explicit map destination is the player's current instruction. It must
    // override the default story quest; otherwise selecting an accepted job
    // changes the beam but leaves the HUD permanently showing Road Ahead.
    questObjectiveForHUD(
      pinnedQuest && questIsDisplayableOnHUD(pinnedQuest)
        ? pinnedQuest
        : undefined,
      input.activeMapPin
    ) ??
    questObjectiveForHUD(mainQuest) ??
    (input.quests.length === 0
      ? cleanObjectiveText(input.mainQuestSelection?.objective)
      : undefined) ??
    (explicitlyCleared
      ? undefined
      : questObjectiveForHUD(activeRoadAheadQuest) ??
        questObjectiveForHUD(activeQuest) ??
        cleanObjectiveText(currentMissionStep?.objective))
  );
}

export const CurrentQuestObjectiveHUD: React.FunctionComponent<{
  adapter?: CurrentQuestObjectiveMapAdapter;
  isOpen?: boolean;
}> = ({ adapter, isOpen = false }) => {
  const [activeMapPin, setActiveMapPin] = React.useState<
    BiomesUIActiveMapPin | undefined
  >(() => adapter?.getActiveMapPin?.() ?? readActiveBiomesUIMapPin());
  const [mainQuestSelection, setMainQuestSelection] = React.useState<
    BiomesUIMainQuestSelection | undefined
  >(
    () => adapter?.getMainQuestSelection?.() ?? readBiomesUIMainQuestSelection()
  );
  const [revision, setRevision] = React.useState(0);

  React.useEffect(() => {
    setActiveMapPin(adapter?.getActiveMapPin?.() ?? readActiveBiomesUIMapPin());
    setMainQuestSelection(
      adapter?.getMainQuestSelection?.() ?? readBiomesUIMainQuestSelection()
    );
  }, [adapter]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onPin = (event: Event) => {
      setActiveMapPin(
        (event as CustomEvent<BiomesUIActiveMapPin | undefined>).detail ??
          readActiveBiomesUIMapPin()
      );
      setRevision((value) => value + 1);
    };
    window.addEventListener(BIOMES_UI_ACTIVE_MAP_PIN_EVENT, onPin);
    window.addEventListener("storage", onPin);
    return () => {
      window.removeEventListener(BIOMES_UI_ACTIVE_MAP_PIN_EVENT, onPin);
      window.removeEventListener("storage", onPin);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onMainQuest = (event: Event) => {
      setMainQuestSelection(
        (event as CustomEvent<BiomesUIMainQuestSelection | undefined>).detail ??
          adapter?.getMainQuestSelection?.() ??
          readBiomesUIMainQuestSelection()
      );
      setRevision((value) => value + 1);
    };
    window.addEventListener(BIOMES_UI_MAIN_QUEST_EVENT, onMainQuest);
    window.addEventListener("storage", onMainQuest);
    return () => {
      window.removeEventListener(BIOMES_UI_MAIN_QUEST_EVENT, onMainQuest);
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

  const showRecipeHint = shouldShowRecipeObjectiveHintForTest(
    objective,
    isOpen
  );

  return (
    <aside
      className="biomes-ui-current-objective-hud"
      aria-label="Current objective"
      aria-live="polite"
    >
      <div className="biomes-ui-current-objective-hud__label">Objective</div>
      <div className="biomes-ui-current-objective-hud__text">{objective}</div>
      {showRecipeHint && (
        <div
          className="biomes-ui-current-objective-hud__recipe-hint"
          data-biomes-recipe-objective-hint="visible"
        >
          <span className="biomes-ui-current-objective-hud__recipe-key">R</span>
          Press R to open Recipes and create the required item.
        </div>
      )}
    </aside>
  );
};
