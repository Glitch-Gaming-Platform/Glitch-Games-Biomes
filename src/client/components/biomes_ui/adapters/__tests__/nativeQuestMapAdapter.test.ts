/// <reference types="mocha" />

import assert from "assert";
import type {
  QuestBundle,
  TriggerProgress,
} from "@/client/game/resources/challenges";
import {
  activeNativeQuest,
  activeNativeQuestTriggerLeaves,
  nativeQuestMapMarkers,
  nativeQuestMissionSteps,
  nativeQuestTrackableQuests,
} from "../nativeQuestMapAdapter";

function leaf(
  id: number,
  objective: string,
  progressPercentage: number,
  position?: [number, number, number]
): TriggerProgress {
  return {
    id,
    payload: { kind: "collect" },
    progressString: objective,
    progressPercentage,
    navigationAid: position ? { kind: "position", pos: position } : undefined,
  } as TriggerProgress;
}

function group(
  id: number,
  kind: "all" | "any" | "seq",
  children: TriggerProgress[],
  progressPercentage: number
): TriggerProgress {
  return {
    id,
    payload: { kind },
    progressString: "",
    progressPercentage,
    children,
  } as TriggerProgress;
}

function quest(
  id: number,
  state: QuestBundle["state"],
  progress: TriggerProgress,
  category: "main" | "discover" = "discover"
): QuestBundle {
  return {
    challengeDeps: [],
    biscuit: {
      id,
      isQuest: true,
      displayName: `Quest ${id}`,
      description: `Description ${id}`,
      questCategory: category,
    } as QuestBundle["biscuit"],
    progress,
    state,
  };
}

describe("nativeQuestMapAdapter", () => {
  it("preserves seq semantics instead of activating every incomplete step", () => {
    const completed = leaf(11, "Collect clothes", 1);
    const current = leaf(12, "Wear the clothes", 0);
    const future = leaf(13, "Talk to Jackie", 0);
    const progress = group(10, "seq", [completed, current, future], 1 / 3);

    assert.deepStrictEqual(
      activeNativeQuestTriggerLeaves(progress).map((step) => step.id),
      [12]
    );
    assert.deepStrictEqual(
      nativeQuestMissionSteps(quest(1, "in_progress", progress)).map(
        ({ title, done }) => ({ title, done })
      ),
      [
        { title: "Completed step 1", done: true },
        { title: "Current step 2", done: false },
        { title: "Upcoming step 3", done: false },
      ]
    );
  });

  it("keeps all incomplete branches active for all/any objectives", () => {
    for (const kind of ["all", "any"] as const) {
      const progress = group(
        20,
        kind,
        [leaf(21, "Own a sword", 0), leaf(22, "Own a shield", 0.5)],
        0.25
      );
      assert.deepStrictEqual(
        activeNativeQuestTriggerLeaves(progress).map((step) => step.id),
        [21, 22]
      );
    }
  });

  it("uses native navigation positions for active objective markers", () => {
    const bundle = quest(
      30,
      "in_progress",
      group(31, "seq", [leaf(32, "Place Muckwad", 0, [501, 70, -142])], 0),
      "main"
    );
    assert.deepStrictEqual(nativeQuestMapMarkers([bundle]), [
      {
        id: "native_quest:30:32",
        label: "Place Muckwad",
        kind: "objective",
        active: true,
        worldPosition: [501, 70, -142],
        description: "Current objective for Quest 30.",
      },
    ]);
    assert.equal(
      nativeQuestTrackableQuests([bundle])[0].firstMarkerId,
      "native_quest:30:32"
    );
  });

  it("prioritizes an active native main quest and retains completed quests", () => {
    const side = quest(40, "in_progress", leaf(41, "Side objective", 0));
    const main = quest(
      42,
      "in_progress",
      leaf(43, "Story objective", 0),
      "main"
    );
    const completed = quest(44, "completed", leaf(45, "Done", 1));

    assert.equal(activeNativeQuest([side, main, completed])?.biscuit.id, 42);
    assert.deepStrictEqual(
      nativeQuestTrackableQuests([side, main, completed]).map(
        ({ questId, status }) => ({ questId, status })
      ),
      [
        { questId: "40", status: "active" },
        { questId: "42", status: "active" },
        { questId: "44", status: "completed" },
      ]
    );
  });

  it("does not preload available or locked quests into the journal", () => {
    const available = quest(50, "available", leaf(51, "Not accepted", 0));
    const locked = quest(52, "locked", leaf(53, "Not discovered", 0));
    const active = quest(54, "in_progress", leaf(55, "Accepted", 0));

    assert.deepStrictEqual(
      nativeQuestTrackableQuests([available, locked, active]).map(
        (entry) => entry.questId
      ),
      ["54"]
    );
  });
});
