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

const INVITER = "player_quest_inviter";
const INVITEE = "player_quest_invitee";
const THIRD = "player_quest_third";
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
    questId: "grove_buttons",
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
    assert.ok(accepted.state.quests.active.grove_buttons);

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
    completedQuestState.quests.completed.grove_buttons = NOW_MS;
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
