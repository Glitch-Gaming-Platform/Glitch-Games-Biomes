/// <reference types="mocha" />

import assert from "assert";
import {
  createHarthmereLiveModeQuestClientSnapshot,
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import type { HarthmereLiveModeAuthorityEnvelope } from "../live_mode_readiness";
import { harthmereNativeQuestId } from "../harthmere_native_quests";

const INVITER = "player_quest_inviter";
const INVITEE = "player_quest_invitee";
const THIRD = "player_quest_third";
const QUEST_ID = "fountain_buttons_first";
const NOW_MS = 1_702_000_000_000;
const INVITER_POSITION = { x: 0, y: 64, z: 0 };
const INVITEE_POSITION = { x: 4, y: 64, z: 0 };
const THIRD_POSITION = { x: 6, y: 64, z: 2 };

function serverPositionForActorId(
  actorId?: string
): { x: number; y: number; z: number } | undefined {
  if (actorId === INVITER) return INVITER_POSITION;
  if (actorId === INVITEE) return INVITEE_POSITION;
  if (actorId === THIRD) return THIRD_POSITION;
  return undefined;
}

let seq = 0;
function envelope(
  actorId: string,
  payload: Record<string, unknown>,
  targetId?: string,
  serverTargetPosition = serverPositionForActorId(targetId)
): HarthmereLiveModeAuthorityEnvelope {
  seq += 1;
  return {
    requestId: `quest_invite_test_${seq}`,
    idempotencyKey: `quest_invite_test_${seq}`,
    actorId,
    targetId,
    actionKind: "request_quest_state_update",
    subsystem: "quest",
    source: "client_request",
    serverActorPosition: serverPositionForActorId(actorId),
    serverTargetPosition,
    serverReceivedAtMs: NOW_MS,
    serverTick: seq,
    actorEntityVersion: 1,
    zoneId: "harthmere",
    payload,
    clientClaims: {},
  };
}

function invitePayload(overrides: Record<string, unknown> = {}) {
  return {
    operation: "invite_to_quest",
    inviteeActorId: INVITEE,
    questId: QUEST_ID,
    questTitle: "Buttons Before the Road",
    questArea: "The Grove",
    objectiveText: "Talk to Jackie and find the jobs board.",
    reward: "25 XP",
    firstMarkerId: "jackie",
    markerWorldPosition: [496, 70, -126],
    ...overrides,
  };
}

function reduce(
  state: HarthmereLiveModeBackendState,
  actorId: string,
  payload: Record<string, unknown>,
  targetId?: string,
  atMs = NOW_MS,
  serverTargetPosition = serverPositionForActorId(targetId)
) {
  if (
    payload.operation === "invite_to_quest" &&
    !state.quests.active[QUEST_ID] &&
    state.quests.completed[QUEST_ID] === undefined
  ) {
    state.quests.active[QUEST_ID] = {
      stepId: "fountain_buttons_first_obj_01",
      progress: 1,
      source: "snapshot_grove",
      title: "Buttons Before the Road",
    };
  }
  return reduceHarthmereLiveModeBackendState(
    state,
    envelope(actorId, payload, targetId, serverTargetPosition),
    atMs
  );
}

describe("Harthmere live-mode quest invites", () => {
  it("creates pending invites visible only to inviter and invitee snapshots", () => {
    const inviterState = defaultHarthmereLiveModeBackendState(
      INVITER,
      NOW_MS
    );
    const reduced = reduce(inviterState, INVITER, invitePayload(), INVITEE);
    assert.deepEqual(reduced.summary.warnings, []);
    assert.ok(reduced.summary.touchedModels.includes("quest_invites"));
    assert.equal(Object.keys(reduced.state.questInvites.invites).length, 1);

    const inviterSnapshot = createHarthmereLiveModeQuestClientSnapshot(
      reduced.state
    );
    assert.equal(inviterSnapshot.sentPendingInvites.length, 1);
    assert.equal(inviterSnapshot.pendingReceivedInvites.length, 0);
    assert.equal(inviterSnapshot.sharedQuests.length, 0);

    const inviteeState = defaultHarthmereLiveModeBackendState(
      INVITEE,
      NOW_MS
    );
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      inviteeState,
      createHarthmereLiveModeSharedWorldState(reduced.state, NOW_MS),
      NOW_MS
    );
    const inviteeSnapshot =
      createHarthmereLiveModeQuestClientSnapshot(inviteeState);
    assert.equal(inviteeSnapshot.pendingReceivedInvites.length, 1);
    assert.equal(inviteeSnapshot.sharedQuests.length, 0);
  });

  it("accepts an invite, removes it, and exposes the shared quest to both players", () => {
    const invited = reduce(
      defaultHarthmereLiveModeBackendState(INVITER, NOW_MS),
      INVITER,
      invitePayload(),
      INVITEE
    ).state;
    const inviteId = Object.keys(invited.questInvites.invites)[0];
    const inviteeState = defaultHarthmereLiveModeBackendState(
      INVITEE,
      NOW_MS
    );
    inviteeState.questInvites = invited.questInvites;

    const accepted = reduce(
      inviteeState,
      INVITEE,
      {
        operation: "respond_to_quest_invite",
        inviteId,
        response: "accept",
      },
      undefined,
      NOW_MS + 1
    );
    assert.deepEqual(accepted.summary.warnings, []);
    assert.equal(Object.keys(accepted.state.questInvites.invites).length, 0);
    assert.ok(accepted.state.quests.active[QUEST_ID]);

    const inviteeSnapshot = createHarthmereLiveModeQuestClientSnapshot(
      accepted.state
    );
    assert.equal(inviteeSnapshot.pendingReceivedInvites.length, 0);
    assert.equal(inviteeSnapshot.sharedQuests.length, 1);
    assert.deepEqual(inviteeSnapshot.sharedQuests[0].memberActorIds.sort(), [
      INVITEE,
      INVITER,
    ]);
    assert.deepEqual(
      inviteeSnapshot.sharedQuests[0].markerWorldPosition,
      [496, 70, -126]
    );

    const inviterState = defaultHarthmereLiveModeBackendState(
      INVITER,
      NOW_MS
    );
    inviterState.questInvites = accepted.state.questInvites;
    const inviterSnapshot =
      createHarthmereLiveModeQuestClientSnapshot(inviterState);
    assert.equal(inviterSnapshot.sharedQuests.length, 1);
  });

  it("denies an invite without creating a shared quest", () => {
    const invited = reduce(
      defaultHarthmereLiveModeBackendState(INVITER, NOW_MS),
      INVITER,
      invitePayload(),
      INVITEE
    ).state;
    const inviteId = Object.keys(invited.questInvites.invites)[0];
    const inviteeState = defaultHarthmereLiveModeBackendState(
      INVITEE,
      NOW_MS
    );
    inviteeState.questInvites = invited.questInvites;

    const denied = reduce(inviteeState, INVITEE, {
      operation: "respond_to_quest_invite",
      inviteId,
      response: "deny",
    });
    assert.equal(Object.keys(denied.state.questInvites.invites).length, 0);
    assert.equal(Object.keys(denied.state.questInvites.sharedQuests).length, 0);
    assert.equal(
      createHarthmereLiveModeQuestClientSnapshot(denied.state).sharedQuests
        .length,
      0
    );
  });

  it("supports inviting multiple players one by one into the same shared quest", () => {
    const firstInvite = reduce(
      defaultHarthmereLiveModeBackendState(INVITER, NOW_MS),
      INVITER,
      invitePayload(),
      INVITEE
    );
    const secondInvite = reduce(
      firstInvite.state,
      INVITER,
      invitePayload({ inviteeActorId: THIRD }),
      THIRD,
      NOW_MS + 1
    );
    assert.deepEqual(secondInvite.summary.warnings, []);
    assert.equal(
      Object.keys(secondInvite.state.questInvites.invites).length,
      2
    );

    const sharedWorld = createHarthmereLiveModeSharedWorldState(
      secondInvite.state,
      NOW_MS + 1
    );
    const inviteeState = defaultHarthmereLiveModeBackendState(
      INVITEE,
      NOW_MS
    );
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      inviteeState,
      sharedWorld,
      NOW_MS + 1
    );
    const thirdState = defaultHarthmereLiveModeBackendState(THIRD, NOW_MS);
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      thirdState,
      sharedWorld,
      NOW_MS + 1
    );
    const inviteeSnapshot =
      createHarthmereLiveModeQuestClientSnapshot(inviteeState);
    const thirdSnapshot =
      createHarthmereLiveModeQuestClientSnapshot(thirdState);
    assert.equal(inviteeSnapshot.pendingReceivedInvites.length, 1);
    assert.equal(thirdSnapshot.pendingReceivedInvites.length, 1);
    assert.notEqual(
      inviteeSnapshot.pendingReceivedInvites[0].inviteId,
      thirdSnapshot.pendingReceivedInvites[0].inviteId
    );
    assert.equal(inviteeSnapshot.sharedQuests.length, 0);
    assert.equal(thirdSnapshot.sharedQuests.length, 0);

    const acceptedByInvitee = reduce(
      inviteeState,
      INVITEE,
      {
        operation: "respond_to_quest_invite",
        inviteId: inviteeSnapshot.pendingReceivedInvites[0].inviteId,
        response: "accept",
      },
      undefined,
      NOW_MS + 2
    );
    const thirdPendingState = defaultHarthmereLiveModeBackendState(
      THIRD,
      NOW_MS
    );
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      thirdPendingState,
      createHarthmereLiveModeSharedWorldState(
        acceptedByInvitee.state,
        NOW_MS + 2
      ),
      NOW_MS + 2
    );
    const thirdPendingSnapshot =
      createHarthmereLiveModeQuestClientSnapshot(thirdPendingState);
    assert.equal(thirdPendingSnapshot.pendingReceivedInvites.length, 1);
    assert.equal(thirdPendingSnapshot.sharedQuests.length, 0);

    const acceptedByThird = reduce(
      thirdPendingState,
      THIRD,
      {
        operation: "respond_to_quest_invite",
        inviteId: thirdPendingSnapshot.pendingReceivedInvites[0].inviteId,
        response: "accept",
      },
      undefined,
      NOW_MS + 3
    );
    assert.equal(
      Object.keys(acceptedByThird.state.questInvites.invites).length,
      0
    );
    const memberActorIds = createHarthmereLiveModeQuestClientSnapshot(
      acceptedByThird.state
    ).sharedQuests[0].memberActorIds.sort();
    assert.deepEqual(memberActorIds, [INVITEE, INVITER, THIRD].sort());
  });

  it("lets either member advance canonical progress and projects completion to both", () => {
    const invited = reduce(
      defaultHarthmereLiveModeBackendState(INVITER, NOW_MS),
      INVITER,
      invitePayload(),
      INVITEE
    ).state;
    const inviteId = Object.keys(invited.questInvites.invites)[0];
    const inviteeState = defaultHarthmereLiveModeBackendState(INVITEE, NOW_MS);
    inviteeState.questInvites = invited.questInvites;
    const accepted = reduce(
      inviteeState,
      INVITEE,
      {
        operation: "respond_to_quest_invite",
        inviteId,
        response: "accept",
      },
      undefined,
      NOW_MS + 1
    );

    const advancedByInvitee = reduce(
      accepted.state,
      INVITEE,
      {
        operation: "shared_quest_progress",
        questId: QUEST_ID,
        source: "snapshot_grove",
        objectiveIndex: 0,
        progress: 2,
        stepId: "fountain_buttons_first_obj_02",
      },
      undefined,
      NOW_MS + 2
    );
    assert.equal(
      advancedByInvitee.state.questInvites.sharedQuests[
        `shared_quest:${QUEST_ID}:${INVITER}`
      ]?.activeState?.progress,
      2
    );
    assert.equal(
      advancedByInvitee.state.questInvites.sharedQuests[
        `shared_quest:${QUEST_ID}:${INVITER}`
      ]?.lastProgressActorId,
      INVITEE
    );

    const inviterState = defaultHarthmereLiveModeBackendState(INVITER, NOW_MS);
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      inviterState,
      createHarthmereLiveModeSharedWorldState(
        advancedByInvitee.state,
        NOW_MS + 2
      ),
      NOW_MS + 2
    );
    assert.equal(inviterState.quests.active[QUEST_ID]?.progress, 2);

    inviterState.quests.completed[QUEST_ID] = NOW_MS + 3;
    delete inviterState.quests.active[QUEST_ID];
    const completedByInviter = reduce(
      inviterState,
      INVITER,
      { operation: "shared_quest_sync" },
      undefined,
      NOW_MS + 3
    );
    const inviteeAfterCompletion = defaultHarthmereLiveModeBackendState(
      INVITEE,
      NOW_MS
    );
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      inviteeAfterCompletion,
      createHarthmereLiveModeSharedWorldState(
        completedByInviter.state,
        NOW_MS + 3
      ),
      NOW_MS + 3
    );
    assert.equal(inviteeAfterCompletion.quests.completed[QUEST_ID], NOW_MS + 3);
    assert.equal(inviteeAfterCompletion.quests.active[QUEST_ID], undefined);
    assert.equal(
      createHarthmereLiveModeQuestClientSnapshot(inviteeAfterCompletion)
        .sharedQuests[0]?.status,
      "completed"
    );
  });

  it("uses server-owned quest identity and metadata instead of client overrides", () => {
    const result = reduce(
      defaultHarthmereLiveModeBackendState(INVITER, NOW_MS),
      INVITER,
      invitePayload({
        inviteId: "forged_invite",
        sharedQuestId: "forged_shared",
        questTitle: "Free Dragon Loot",
        questArea: "Nowhere",
        objectiveText: "Skip everything",
        reward: "999999 gold",
      }),
      INVITEE
    );
    const invite = Object.values(result.state.questInvites.invites)[0];
    assert.ok(invite);
    assert.notEqual(invite.inviteId, "forged_invite");
    assert.notEqual(invite.sharedQuestId, "forged_shared");
    assert.equal(invite.questTitle, "Buttons Before the Road");
    assert.equal(invite.questArea, "The Grove Fountain");
    assert.notEqual(invite.objectiveText, "Skip everything");
    assert.notEqual(invite.reward, "999999 gold");
  });

  it("materializes acceptance and each progress step for every numeric ECS party member", () => {
    const inviter = "101";
    const invitee = "202";
    const nativeQuestId = harthmereNativeQuestId("grove", QUEST_ID)!;
    const inviterState = defaultHarthmereLiveModeBackendState(inviter, NOW_MS);
    inviterState.quests.active[QUEST_ID] = {
      stepId: "fountain_buttons_first_obj_01",
      progress: 1,
      source: "snapshot_grove",
      title: "Buttons Before the Road",
    };
    const inviteEnvelope: HarthmereLiveModeAuthorityEnvelope = {
      ...envelope(
        inviter,
        invitePayload({ inviteeActorId: invitee }),
        invitee,
        {
          x: 4,
          y: 64,
          z: 0,
        }
      ),
      serverActorEntityId: 101 as any,
      serverActorPosition: { x: 0, y: 64, z: 0 },
      serverActorInProgressQuestIds: [String(nativeQuestId)],
    };
    const invited = reduceHarthmereLiveModeBackendState(
      inviterState,
      inviteEnvelope,
      NOW_MS
    );
    const inviteId = Object.keys(invited.state.questInvites.invites)[0];
    assert.ok(inviteId);

    const inviteeState = defaultHarthmereLiveModeBackendState(invitee, NOW_MS);
    inviteeState.questInvites = invited.state.questInvites;
    const accepted = reduceHarthmereLiveModeBackendState(
      inviteeState,
      {
        ...inviteEnvelope,
        requestId: "numeric_accept",
        idempotencyKey: "numeric_accept",
        actorId: invitee,
        serverActorEntityId: 202 as any,
        serverActorPosition: { x: 4, y: 64, z: 0 },
        serverActorInProgressQuestIds: [],
        payload: {
          operation: "respond_to_quest_invite",
          inviteId,
          response: "accept",
        },
      },
      NOW_MS + 1
    );
    assert.ok(
      accepted.summary.nativeEcsMaterializationPlans?.some(
        (plan) => plan.kind === "quest_accept" && plan.actorId === invitee
      )
    );

    const advanced = reduceHarthmereLiveModeBackendState(
      accepted.state,
      {
        ...inviteEnvelope,
        requestId: "numeric_progress",
        idempotencyKey: "numeric_progress",
        actorId: invitee,
        serverActorEntityId: 202 as any,
        serverActorPosition: { x: 4, y: 64, z: 0 },
        serverActorInProgressQuestIds: [String(nativeQuestId)],
        payload: {
          operation: "shared_quest_progress",
          questId: QUEST_ID,
          source: "snapshot_grove",
          objectiveIndex: 0,
          progress: 2,
          stepId: "fountain_buttons_first_obj_02",
        },
      },
      NOW_MS + 2
    );
    const progressActorIds =
      advanced.summary.nativeEcsMaterializationPlans
        ?.filter((plan) => plan.kind === "quest_progress")
        .map((plan) => plan.actorId)
        .sort() ?? [];
    assert.deepEqual(progressActorIds, [inviter, invitee].sort());
  });

  it("rejects a known but inactive quest", () => {
    const inactive = defaultHarthmereLiveModeBackendState(INVITER, NOW_MS);
    const result = reduceHarthmereLiveModeBackendState(
      inactive,
      envelope(INVITER, invitePayload(), INVITEE),
      NOW_MS
    );
    assert.ok(
      result.summary.warnings.includes(
        "quest_invite_rejected:active_shareable_quest_required"
      )
    );
    assert.equal(Object.keys(result.state.questInvites.invites).length, 0);
  });

  it("rejects self invites, duplicates, and responses from the wrong actor", () => {
    const selfInvite = reduce(
      defaultHarthmereLiveModeBackendState(INVITER, NOW_MS),
      INVITER,
      invitePayload({ inviteeActorId: INVITER }),
      INVITER
    );
    assert.ok(
      selfInvite.summary.warnings.includes("quest_invite_rejected:self_invite")
    );

    const first = reduce(
      defaultHarthmereLiveModeBackendState(INVITER, NOW_MS),
      INVITER,
      invitePayload(),
      INVITEE
    );
    const duplicate = reduce(first.state, INVITER, invitePayload(), INVITEE);
    assert.ok(
      duplicate.summary.warnings.includes(
        "quest_invite_rejected:duplicate_pending"
      )
    );
    assert.equal(Object.keys(duplicate.state.questInvites.invites).length, 1);

    const completedQuestState = defaultHarthmereLiveModeBackendState(
      INVITER,
      NOW_MS
    );
    completedQuestState.quests.completed[QUEST_ID] = NOW_MS;
    const completedQuestInvite = reduce(
      completedQuestState,
      INVITER,
      invitePayload(),
      INVITEE
    );
    assert.ok(
      completedQuestInvite.summary.warnings.includes(
        "quest_invite_rejected:quest_completed"
      )
    );
    assert.equal(
      Object.keys(completedQuestInvite.state.questInvites.invites).length,
      0
    );

    const farInvite = reduce(
      defaultHarthmereLiveModeBackendState(INVITER, NOW_MS),
      INVITER,
      invitePayload(),
      INVITEE,
      NOW_MS,
      { x: 100, y: 64, z: 0 }
    );
    assert.ok(
      farInvite.summary.warnings.includes("quest_invite_rejected:not_nearby")
    );
    assert.equal(Object.keys(farInvite.state.questInvites.invites).length, 0);

    const inviteId = Object.keys(first.state.questInvites.invites)[0];
    const wrongActorState = defaultHarthmereLiveModeBackendState(
      THIRD,
      NOW_MS
    );
    wrongActorState.questInvites = first.state.questInvites;
    const wrongActor = reduce(wrongActorState, THIRD, {
      operation: "respond_to_quest_invite",
      inviteId,
      response: "accept",
    });
    assert.ok(
      wrongActor.summary.warnings.includes(
        "quest_invite_response_rejected:not_invitee"
      )
    );
    assert.equal(Object.keys(wrongActor.state.questInvites.invites).length, 1);
  });
});
