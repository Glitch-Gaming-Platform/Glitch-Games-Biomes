/// <reference types="mocha" />

import assert from "assert";
import {
  activeSharedQuestMissionStepsForBiomesUI,
  firstActiveSharedQuestTitleForBiomesUI,
  normalizeHarthmereQuestState,
  questInviteOptionsFromTrackableQuests,
  sharedQuestAcceptedLandmarksForBiomesUI,
  sharedQuestTrackableQuestsForBiomesUI,
  submitHarthmereQuestInviteMutation,
} from "../questInviteAdapter";

const NOW_MS = 1_702_100_000_000;

function questState() {
  return {
    version: "harthmere-live-mode-quest-state",
    actorId: "player_one",
    active: {},
    completed: {},
    pendingReceivedInvites: [
      {
        inviteId: "invite_1",
        sharedQuestId: "shared_1",
        questId: "grove_buttons",
        questTitle: "Buttons Before the Road",
        questArea: "The Grove",
        objectiveText: "Talk to Jackie.",
        inviterActorId: "player_two",
        inviteeActorId: "player_one",
        createdAtMs: NOW_MS,
      },
    ],
    sentPendingInvites: [],
    sharedQuests: [
      {
        sharedQuestId: "shared_accepted",
        questId: "muckwad_patch",
        questTitle: "Clear the Muckwad Patch",
        questArea: "Muck Edge",
        objectiveText: "Clear the threat together.",
        reward: "120 XP",
        memberActorIds: ["player_one", "player_two"],
        inviteIds: ["invite_old"],
        createdAtMs: NOW_MS - 100,
        updatedAtMs: NOW_MS,
        firstMarkerId: "muckwad_patch",
        markerWorldPosition: [512, 70, -152],
      },
    ],
    updatedAtMs: NOW_MS,
  };
}

describe("BiomesUI quest invite adapter", () => {
  it("normalizes pending invites and shared quests", () => {
    const state = normalizeHarthmereQuestState(questState());
    assert.equal(state.pendingReceivedInvites.length, 1);
    assert.equal(
      state.pendingReceivedInvites[0].questTitle,
      "Buttons Before the Road"
    );
    assert.equal(state.sharedQuests.length, 1);
    assert.deepEqual(
      state.sharedQuests[0].markerWorldPosition,
      [512, 70, -152]
    );
  });

  it("projects accepted shared quests into map markers, quest list, and mission steps", () => {
    const state = questState();
    const landmarks = sharedQuestAcceptedLandmarksForBiomesUI(state);
    assert.equal(landmarks.length, 1);
    assert.equal(landmarks[0].id, "shared_quest_marker:shared_accepted");
    assert.equal(landmarks[0].kind, "objective");
    assert.equal(landmarks[0].active, true);
    assert.deepEqual(landmarks[0].position, [512, 70, -152]);

    const quests = sharedQuestTrackableQuestsForBiomesUI(state);
    assert.deepEqual(quests, [
      {
        questId: "shared_quest:shared_accepted",
        title: "Clear the Muckwad Patch",
        area: "Muck Edge - 2 players",
        status: "active",
        firstMarkerId: "shared_quest_marker:shared_accepted",
        reward: "120 XP",
        kind: "muckwad_patch",
        kindLabel: "Shared Quest",
        objective: "Clear the threat together.",
        objectives: ["Clear the threat together."],
        description: "Clear the threat together.",
      },
    ]);

    const steps = activeSharedQuestMissionStepsForBiomesUI(state);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].objective, "Clear the threat together.");
    assert.equal(
      firstActiveSharedQuestTitleForBiomesUI(state),
      "Clear the Muckwad Patch"
    );
  });

  it("retires completed shared quest markers while keeping completed journal history", () => {
    const state = questState();
    state.sharedQuests[0] = {
      ...state.sharedQuests[0],
      status: "completed",
      completedAtMs: NOW_MS,
    } as any;
    assert.deepEqual(sharedQuestAcceptedLandmarksForBiomesUI(state), []);
    assert.equal(
      sharedQuestTrackableQuestsForBiomesUI(state)[0]?.status,
      "completed"
    );
    assert.equal(
      activeSharedQuestMissionStepsForBiomesUI(state)[0]?.done,
      true
    );
    assert.equal(firstActiveSharedQuestTitleForBiomesUI(state), undefined);
  });

  it("builds invite options from only usable trackable quests and deduplicates them", () => {
    const options = questInviteOptionsFromTrackableQuests([
      {
        questId: "quest_a",
        title: "Quest A",
        area: "The Grove",
        objectiveText: "Do A.",
        reward: "10 XP",
      },
      {
        questId: "quest_a",
        title: "Quest A Duplicate",
      },
      {
        title: "Missing id",
      },
    ]);
    assert.deepEqual(options, [
      {
        questId: "quest_a",
        title: "Quest A",
        area: "The Grove",
        objectiveText: "Do A.",
        reward: "10 XP",
        firstMarkerId: undefined,
        markerWorldPosition: undefined,
      },
    ]);
  });

  it("turns invite authority rejections into player-readable errors", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          backendMutation: {
            warnings: ["quest_invite_rejected:not_nearby"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
    await assert.rejects(
      () =>
        submitHarthmereQuestInviteMutation(
          {
            operation: "invite_to_quest",
            questId: "grove_buttons",
            questTitle: "Buttons Before the Road",
          },
          fetchImpl
        ),
      (error: any) =>
        error?.message === "Move closer to that player and try again." &&
        !error.message.includes("quest_invite_rejected")
    );
  });
});
